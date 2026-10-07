// Cloudflare Worker: бесплатный прокси цен для RusPredict.
// Браузер не может напрямую запрашивать Yahoo Finance (нет CORS), поэтому запрос идёт через этот скрипт.
//
// Использование: GET https://<ваш-воркер>.workers.dev/?symbols=AAPL,NVDA,GC=F
// Ответ: { "AAPL": { "price": 230.1, "prev": 228.9, "time": 1760000000 }, ... }
//
// Чтобы чужие сайты не тратили ваш лимит, замените "*" на адрес вашего сайта, например "https://svinp002007.github.io".
const ALLOWED_ORIGIN = "*";

const SYMBOL_RE = /^[A-Z0-9=.^-]{1,12}$/; // только тикеры, никаких произвольных адресов

export default {
  async fetch(request) {
    const cors = {
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-methods": "GET, OPTIONS"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const symbols = (url.searchParams.get("symbols") || "")
      .split(",").map((s) => s.trim()).filter((s) => SYMBOL_RE.test(s)).slice(0, 20);
    if (!symbols.length) {
      return new Response(JSON.stringify({ error: "укажите ?symbols=AAPL,GC=F" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    const out = {};
    await Promise.all(symbols.map(async (s) => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1m&range=1d`, {
          headers: { "user-agent": "Mozilla/5.0" },
          cf: { cacheTtl: 10, cacheEverything: true }
        });
        if (!r.ok) return;
        const d = await r.json();
        const m = d && d.chart && d.chart.result && d.chart.result[0] && d.chart.result[0].meta;
        if (m && m.regularMarketPrice > 0) out[s] = { price: m.regularMarketPrice, prev: m.chartPreviousClose || m.previousClose || null, time: m.regularMarketTime || null };
      } catch (e) { /* пропускаем тикер, остальные вернутся */ }
    }));

    return new Response(JSON.stringify(out), { headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=10" } });
  }
};

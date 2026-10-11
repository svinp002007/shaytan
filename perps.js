// Перпы: бессрочные контракты (perps) на крипту, акции и сырьё. Демо на игровые рубли.
// Цены живые, если открыт доступ к источнику (бейдж Live); иначе актив торгуется по симулированной цене (бейдж Демо).
// Использует общие функции приложения через window.RP (баланс, подтверждение, уведомления, хранилище).
const PERPS = (() => {
  const FEE = 0.0005; // комиссия 0,05% от размера позиции при открытии и при закрытии
  const MMR = 0.005; // поддерживающая маржа 0,5%
  const CLS = { crypto: "Крипто", stock: "Акции", commodity: "Сырьё" };
  const ASSETS = [
    { sym: "BTC",   name: "Биткоин",         cls: "crypto",    base: 96500, sig: 0.00040, maxLev: 100, ccy: "$", dec: 1, fund: 0.0001 },
    { sym: "ETH",   name: "Эфириум",         cls: "crypto",    base: 3600,  sig: 0.00045, maxLev: 100, ccy: "$", dec: 2, fund: 0.0001 },
    { sym: "SOL",   name: "Solana",          cls: "crypto",    base: 210,   sig: 0.00060, maxLev: 100, ccy: "$", dec: 2, fund: 0.00012 },
    { sym: "SBER",  name: "Сбербанк",        cls: "stock",     base: 305,   sig: 0.00018, maxLev: 50, ccy: "₽", dec: 2, fund: 0.00005 },
    { sym: "GAZP",  name: "Газпром",         cls: "stock",     base: 135,   sig: 0.00020, maxLev: 50, ccy: "₽", dec: 2, fund: 0.00005 },
    { sym: "YDEX",  name: "Яндекс",          cls: "stock",     base: 4800,  sig: 0.00022, maxLev: 50, ccy: "₽", dec: 1, fund: 0.00005 },
    { sym: "LKOH",  name: "Лукойл",          cls: "stock",     base: 7000,  sig: 0.00016, maxLev: 50, ccy: "₽", dec: 0, fund: 0.00005 },
    { sym: "AAPL",  name: "Apple",           cls: "stock",     base: 230,   sig: 0.00020, maxLev: 50, ccy: "$", dec: 2, fund: 0.00005 },
    { sym: "NVDA",  name: "Nvidia",          cls: "stock",     base: 180,   sig: 0.00030, maxLev: 50, ccy: "$", dec: 2, fund: 0.00006 },
    { sym: "TSLA",  name: "Tesla",           cls: "stock",     base: 330,   sig: 0.00038, maxLev: 50, ccy: "$", dec: 2, fund: 0.00006 },
    { sym: "BRENT", name: "Нефть Brent",     cls: "commodity", base: 72,    sig: 0.00018, maxLev: 50, ccy: "$", dec: 2, fund: 0.00004 },
    { sym: "XAU",   name: "Золото",          cls: "commodity", base: 4150,  sig: 0.00010, maxLev: 50, ccy: "$", dec: 1, fund: 0.00004 },
    { sym: "XAG",   name: "Серебро",         cls: "commodity", base: 48,    sig: 0.00018, maxLev: 50, ccy: "$", dec: 2, fund: 0.00004 },
    { sym: "NG",    name: "Природный газ",   cls: "commodity", base: 3.2,   sig: 0.00030, maxLev: 50, ccy: "$", dec: 3, fund: 0.00004 },
    { sym: "WHEAT", name: "Пшеница",         cls: "commodity", base: 5.6,   sig: 0.00015, maxLev: 50, ccy: "$", dec: 2, fund: 0.00004 }
  ];
  const A = Object.fromEntries(ASSETS.map((a) => [a.sym, a]));
  // Что предложить рядом с выбранным активом: близкие по теме и «соседи» из других классов.
  const REL = {
    BTC: ["ETH", "SOL", "XAU", "NVDA"], ETH: ["BTC", "SOL", "NVDA", "TSLA"], SOL: ["ETH", "BTC", "TSLA", "NVDA"],
    SBER: ["GAZP", "LKOH", "YDEX", "XAU"], GAZP: ["LKOH", "SBER", "NG", "BRENT"], YDEX: ["SBER", "NVDA", "AAPL", "BTC"], LKOH: ["BRENT", "GAZP", "SBER", "XAU"],
    AAPL: ["NVDA", "TSLA", "YDEX", "BTC"], NVDA: ["AAPL", "TSLA", "BTC", "ETH"], TSLA: ["NVDA", "AAPL", "BTC", "XAG"],
    BRENT: ["LKOH", "GAZP", "NG", "XAU"], XAU: ["XAG", "BTC", "BRENT", "SBER"], XAG: ["XAU", "BRENT", "TSLA", "BTC"],
    NG: ["BRENT", "GAZP", "WHEAT", "LKOH"], WHEAT: ["NG", "BRENT", "XAU", "SBER"]
  };
  // Откуда берутся живые цены. Нет источника или ключа: актив остаётся на симуляции.
  const SRC = {
    BTC: { bn: "BTCUSDT", cb: "BTC-USD", kr: "XBT", yf: "BTC-USD" }, ETH: { bn: "ETHUSDT", cb: "ETH-USD", kr: "ETH", yf: "ETH-USD" }, SOL: { bn: "SOLUSDT", cb: "SOL-USD", kr: "SOL", yf: "SOL-USD" },
    SBER: { moex: "SBER" }, GAZP: { moex: "GAZP" }, YDEX: { moex: "YDEX" }, LKOH: { moex: "LKOH" },
    AAPL: { fh: "AAPL", yf: "AAPL", pm: "AAPL-USD" }, NVDA: { fh: "NVDA", yf: "NVDA", pm: "NVDA-USD" }, TSLA: { fh: "TSLA", yf: "TSLA", pm: "TSLA-USD" },
    XAU: { td: "XAU/USD", yf: "GC=F", pm: "GOLD-USD" }, XAG: { td: "XAG/USD", yf: "SI=F", pm: "SILVER-USD" },
    BRENT: { yf: "BZ=F" }, NG: { yf: "NG=F" }, WHEAT: { yf: "ZW=F" }
  };
  const YF_SCALE = { "ZW=F": 0.01 }; // пшеница на Yahoo в центах за бушель, у нас в долларах
  const SRC_NAME = { bn: "Binance, обновление каждые 2 с", cb: "Coinbase, обновление каждые 2 с", kr: "Kraken, обновление каждые 2 с", pm: "Polymarket Perps (mark-цена контракта), обновление каждые 3 с", moex: "Мосбиржа (ISS), бесплатные данные с задержкой ~15 мин", fh: "Finnhub, обновление каждые 15 с", td: "Twelve Data, обновление раз в минуту", yf: "Yahoo Finance через ваш прокси, обновление каждые 15 с (у некоторых бирж задержка до 15 мин)" };
  const SRC_TTL = { bn: 15000, cb: 15000, kr: 15000, pm: 20000, moex: 45000, fh: 60000, td: 180000, yf: 90000 }; // через сколько цена считается устаревшей
  const P = { sel: "BTC", cls: "crypto", ctype: "line", range: "LIVE", dir: "long", lev: 1, margin: 1000, tp: "", sl: "" };
  let positions = [], closed = [], plog = [], ticks = 0, chartHover = false, ready = false;

  const nf = new Intl.NumberFormat("ru-RU");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v, d) => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const fee2 = (v) => (v < 10 ? "₽ " + num(v, 2) : RP.rub(v));
  const price = (a, v) => (a.ccy === "₽" ? num(v, a.dec) + " ₽" : "$" + num(v, a.dec));
  const sg = (v, d = 2) => (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d);
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = (r = Math.random) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const seedOf = (s) => [...s].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 11);

  // ---------- рынок ----------
  function init() {
    const saved = RP.store.get("prices", {});
    ASSETS.forEach((a) => {
      a.price = Number(saved[a.sym]) > 0 ? Number(saved[a.sym]) : a.base;
      const r = mulberry(seedOf(a.sym));
      const hs = a.sig * 60 * 0.3; // часовая волатильность истории
      const hh = [1];
      for (let i = 1; i < 168; i++) hh.push(hh[i - 1] * Math.exp(hs * gauss(r)));
      const k = a.price / hh[167];
      a.hh = hh.map((v) => v * k);
      // дневная история на год: нужна для периодов 1М, 3М и 1Г
      const ds = a.sig * 60 * 0.3 * Math.sqrt(24) * 0.55; // дневная волатильность
      const dd = [1];
      for (let i = 1; i < 365; i++) dd.push(dd[i - 1] * Math.exp(ds * gauss(r)));
      const kd = a.price / dd[364];
      a.dd = dd.map((v) => v * kd);
      // минутный график за час (60 точек)
      const mv = a.sig * Math.sqrt(60);
      const mm = [1];
      for (let i = 1; i < 60; i++) mm.push(mm[i - 1] * Math.exp(mv * gauss(r)));
      const km = a.price / mm[59];
      a.mm = mm.map((v) => v * km);
      const lv = [a.price];
      for (let i = 1; i < 90; i++) lv.unshift(lv[0] * Math.exp(-a.sig * gauss(r)));
      a.live = lv;
    });
    drawings = RP.store.get("pdraw", {});
    P.ctype = RP.store.get("pctype", "line") === "candles" ? "candles" : "line";
    positions = RP.store.get("ppos", []);
    closed = RP.store.get("pclosed", []);
    plog = RP.store.get("plog", []);
    ready = true;
    checkLiquidations();
    startFeeds();
  }
  const change24 = (a) => {
    if (a.isLive && typeof a.liveChange === "number") return a.liveChange;
    if (a.isLive && !a.realHist) return null; // у живой цены нет настоящего изменения за 24 часа, выдумывать его не будем
    return (a.price / a.hh[a.hh.length - 25] - 1) * 100;
  };
  const savePrices = () => RP.store.set("prices", Object.fromEntries(ASSETS.map((a) => [a.sym, a.price])));

  // ---------- живые цены ----------
  const PRI = { pm: 4, bn: 3, moex: 3, fh: 3, td: 3, yf: 2, cb: 2, kr: 2 }; // при двух источниках побеждает более надёжный
  const fresh = (a) => a.isLive && Date.now() - a.lastReal < (SRC_TTL[a.srcKey] || 45000);
  function adopt(a, p) {
    // Первая настоящая цена: подгоняем симулированную историю и открытые позиции, чтобы PnL в процентах не менялся.
    const ratio = p / a.price;
    positions.forEach((pos) => {
      if (pos.sym === a.sym) ["entry", "liq", "tp", "sl"].forEach((k) => { if (pos[k]) pos[k] *= ratio; });
    });
    a.hh = a.hh.map((v) => v * ratio);
    a.dd = a.dd.map((v) => v * ratio);
    a.mm = a.mm.map((v) => v * ratio);
    a.live = Array(30).fill(p);
    a.price = p;
    a.base = p;
    a.adopted = true;
    persist();
    if (RP.route() === "trade" && $("#t-pos")) paintPositions();
  }
  function setReal(sym, p, ch, srcKey) {
    const a = A[sym];
    if (!a || !(p > 0) || !isFinite(p)) return;
    if (a.srcKey && a.srcKey !== srcKey && fresh(a) && PRI[a.srcKey] > PRI[srcKey]) return;
    a.srcKey = srcKey;
    a.lastReal = Date.now();
    if (Number.isFinite(ch)) a.liveChange = ch;
    if (!a.adopted) adopt(a, p);
    else a.price = p;
    a.isLive = true;
  }
  const feedStatus = {}; // имя источника -> { ok, lastOk, err, at }
  async function getJSON(url, ms = 6000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  // Повторяет запрос по расписанию; при ошибках делает паузы длиннее (до минуты).
  function schedule(fn, every, name) {
    let fails = 0;
    const run = async () => {
      const prev = feedStatus[name] || {};
      try { await fn(); fails = 0; feedStatus[name] = { ok: true, lastOk: Date.now(), at: Date.now() }; }
      catch (e) { fails++; feedStatus[name] = { ok: false, lastOk: prev.lastOk, err: (e && (e.name === "AbortError" ? "AbortError" : e.message)) || String(e), at: Date.now() }; }
      setTimeout(run, fails ? Math.min(60000, every * 2 ** Math.min(fails, 4)) : every);
    };
    run();
  }
  const BN_HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"]; // второй адрес Binance отдаёт те же публичные данные
  let bnHost = BN_HOSTS[0];
  // Настоящие свечи (открытие, максимум, минимум, закрытие) от Binance для режима «Свечи».
  function saveOhlc(a, key, k, len) {
    const arr = k.filter((x) => Number(x[4]) > 0).map((x) => [Number(x[1]), Number(x[2]), Number(x[3]), Number(x[4])]);
    while (arr.length < len) arr.unshift(arr[0].slice());
    const L = arr[len - 1]; L[3] = a.price; L[1] = Math.max(L[1], a.price); L[2] = Math.min(L[2], a.price);
    (a.ohlcReal = a.ohlcReal || {})[key] = arr;
  }
  async function loadKlines(a) {
    try {
      const k = await getJSON(`${bnHost}/api/v3/klines?symbol=${SRC[a.sym].bn}&interval=1h&limit=168`);
      const closes = k.map((x) => Number(x[4])).filter((v) => v > 0);
      if (closes.length < 30) return;
      while (closes.length < 168) closes.unshift(closes[0]);
      closes[167] = a.price;
      a.hh = closes;
      a.realHist = true;
      saveOhlc(a, "hh", k, 168);
    } catch {}
    try {
      const k = await getJSON(`${bnHost}/api/v3/klines?symbol=${SRC[a.sym].bn}&interval=1m&limit=60`);
      const m = k.map((x) => Number(x[4])).filter((v) => v > 0);
      if (m.length >= 30) { while (m.length < 60) m.unshift(m[0]); m[59] = a.price; a.mm = m; a.realMin = true; saveOhlc(a, "mm", k, 60); }
    } catch {}
    try {
      const k = await getJSON(`${bnHost}/api/v3/klines?symbol=${SRC[a.sym].bn}&interval=1d&limit=365`);
      const d = k.map((x) => Number(x[4])).filter((v) => v > 0);
      if (d.length < 30) return;
      while (d.length < 365) d.unshift(d[0]);
      d[364] = a.price;
      a.dd = d;
      a.realDaily = true;
      saveOhlc(a, "dd", k, 365);
    } catch {}
  }
  const errTxt = (e) => (e && e.name === "AbortError" ? "AbortError" : (e && e.message) || String(e));
  // Крипта: Binance, затем его запасной адрес, затем Coinbase, затем Kraken. Берётся первый, кто ответил.
  async function pollCrypto() {
    const list = ASSETS.filter((a) => SRC[a.sym] && SRC[a.sym].bn);
    const errs = [];
    for (const host of BN_HOSTS) {
      try {
        const syms = encodeURIComponent(JSON.stringify(list.map((a) => SRC[a.sym].bn)));
        const data = await getJSON(`${host}/api/v3/ticker/24hr?symbols=${syms}`);
        let n = 0;
        data.forEach((d) => {
          const a = list.find((x) => SRC[x.sym].bn === d.symbol);
          if (!a || !(Number(d.lastPrice) > 0)) return;
          const first = !a.adopted;
          bnHost = host;
          if (Number(d.highPrice) > 0 && Number(d.lowPrice) > 0) a.t24 = { hi: Number(d.highPrice), lo: Number(d.lowPrice), vol: Number(d.quoteVolume), at: Date.now() };
          setReal(a.sym, Number(d.lastPrice), Number(d.priceChangePercent), "bn");
          n++;
          if (first && a.adopted) loadKlines(a);
        });
        if (n) return;
        errs.push(`${host.replace("https://", "")}: пустой ответ`);
      } catch (e) { errs.push(`${host.replace("https://", "")}: ${errTxt(e)}`); }
    }
    let ok = 0;
    await Promise.all(list.map(async (a) => {
      try {
        const d = await getJSON(`https://api.coinbase.com/v2/prices/${SRC[a.sym].cb}/spot`);
        setReal(a.sym, Number(d.data.amount), NaN, "cb");
        ok++;
      } catch (e) { if (!errs.some((x) => x.startsWith("Coinbase"))) errs.push("Coinbase: " + errTxt(e)); }
    }));
    if (ok) return;
    try {
      const d = await getJSON("https://api.kraken.com/0/public/Ticker?pair=" + list.map((a) => SRC[a.sym].kr + "USD").join(","));
      Object.entries(d.result || {}).forEach(([key, v]) => {
        const a = list.find((x) => key.includes(SRC[x.sym].kr));
        const last = Number(v.c && v.c[0]), open = Number(v.o);
        if (a && last > 0) { setReal(a.sym, last, open > 0 ? (last / open - 1) * 100 : NaN, "kr"); ok++; }
      });
      if (ok) return;
      errs.push("Kraken: пустой ответ");
    } catch (e) { errs.push("Kraken: " + errTxt(e)); }
    throw new Error(errs.join("; "));
  }
  // Polymarket Perps: публичные данные без ключей. Если браузер не пускает напрямую, запрос идёт через ваш прокси (?pm=1).
  const PM_BASE = "https://api.perpetuals.polymarket.com";
  const pick = (o, keys) => { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; };
  const asList = (x) => (Array.isArray(x) ? x : (x && (x.data || x.instruments || x.tickers || x.result)) || []);
  let pmIds = null, pmNote = "";
  async function pollPolymarket() {
    let inst = null, tick;
    try {
      [inst, tick] = await Promise.all([pmIds ? null : getJSON(PM_BASE + "/v1/info/instruments"), getJSON(PM_BASE + "/v1/info/tickers")]);
    } catch (e) {
      const proxy = typeof LIVE_PROXY !== "undefined" && LIVE_PROXY;
      if (!proxy) throw e;
      const d = await getJSON(`${proxy}${proxy.includes("?") ? "&" : "?"}pm=1`);
      inst = d.instruments; tick = d.tickers;
      if (!tick) throw e;
    }
    if (inst) {
      pmIds = {};
      const equity = [];
      asList(inst).forEach((i) => {
        const sym = pick(i, ["symbol"]), id = pick(i, ["id", "instrument_id", "instrumentId"]);
        if (sym !== undefined && id !== undefined) pmIds[sym] = id;
        if (sym !== undefined && /equity|stock|index/i.test(String(pick(i, ["category"]) || ""))) equity.push(sym);
      });
      const want = ASSETS.filter((a) => SRC[a.sym] && SRC[a.sym].pm);
      const missing = want.filter((a) => pmIds[SRC[a.sym].pm] === undefined).map((a) => SRC[a.sym].pm);
      pmNote = missing.length ? `Не найдены на Polymarket: ${missing.join(", ")}. Доступные акции и индексы: ${equity.slice(0, 40).join(", ") || "список пуст"}.` : "";
    }
    if (!pmIds) throw new Error("Polymarket: нет списка контрактов");
    const byKey = {};
    asList(tick).forEach((t) => { const k = pick(t, ["instrument_id", "instrumentId", "id", "symbol"]); if (k !== undefined) byKey[k] = t; });
    let n = 0;
    ASSETS.filter((a) => SRC[a.sym] && SRC[a.sym].pm).forEach((a) => {
      const sym = SRC[a.sym].pm, t = byKey[pmIds[sym]] || byKey[sym];
      const p = Number(pick(t, ["mark_price", "markPrice", "index_price", "indexPrice", "last_price", "lastPrice"]));
      if (p > 0) { setReal(a.sym, p, NaN, "pm"); n++; }
    });
    if (!n) throw new Error("Polymarket ответил, но цен по нужным контрактам нет");
  }
  async function pollMoex() {
    const ids = ASSETS.filter((a) => SRC[a.sym] && SRC[a.sym].moex).map((a) => SRC[a.sym].moex);
    const d = await getJSON(`https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities.json?iss.meta=off&iss.only=marketdata&marketdata.columns=SECID,LAST,LCURRENTPRICE,MARKETPRICE,LCLOSEPRICE,LASTTOPREVPRICE&securities=${ids.join(",")}`);
    const cols = d.marketdata.columns, ix = (n) => cols.indexOf(n);
    let n = 0;
    d.marketdata.data.forEach((r) => {
      const a = ASSETS.find((x) => SRC[x.sym] && SRC[x.sym].moex === r[ix("SECID")]);
      // когда торги закрыты, LAST может быть пустым: берём последнюю доступную цену
      const p = [r[ix("LAST")], r[ix("LCURRENTPRICE")], r[ix("MARKETPRICE")], r[ix("LCLOSEPRICE")]].find((v) => v > 0);
      if (a && p) { setReal(a.sym, Number(p), r[ix("LASTTOPREVPRICE")] === null ? NaN : Number(r[ix("LASTTOPREVPRICE")]), "moex"); n++; }
    });
    if (!n) throw new Error("Мосбиржа ответила, но без цен по бумагам");
  }
  async function pollFinnhub(key) {
    for (const a of ASSETS.filter((x) => SRC[x.sym] && SRC[x.sym].fh)) {
      const d = await getJSON(`https://finnhub.io/api/v1/quote?symbol=${SRC[a.sym].fh}&token=${encodeURIComponent(key)}`);
      if (d && d.c > 0) setReal(a.sym, Number(d.c), Number(d.dp), "fh");
    }
  }
  async function pollTwelve(key) {
    const list = ASSETS.filter((x) => SRC[x.sym] && SRC[x.sym].td);
    const d = await getJSON(`https://api.twelvedata.com/quote?symbol=${list.map((a) => SRC[a.sym].td).join(",")}&apikey=${encodeURIComponent(key)}`);
    list.forEach((a) => {
      const o = d[SRC[a.sym].td] || (list.length === 1 ? d : null);
      if (o && Number(o.close) > 0) setReal(a.sym, Number(o.close), Number(o.percent_change), "td");
    });
  }
  async function pollYahoo(base) {
    const list = ASSETS.filter((a) => SRC[a.sym] && SRC[a.sym].yf);
    const d = await getJSON(`${base}${base.includes("?") ? "&" : "?"}symbols=${encodeURIComponent(list.map((a) => SRC[a.sym].yf).join(","))}`);
    let n = 0;
    list.forEach((a) => {
      const o = d[SRC[a.sym].yf];
      if (!o || !(o.price > 0)) return;
      setReal(a.sym, o.price * (YF_SCALE[SRC[a.sym].yf] || 1), o.prev > 0 ? (o.price / o.prev - 1) * 100 : NaN, "yf");
      n++;
    });
    if (!n) {
      const why = d._errors ? " Причины от Yahoo: " + Object.values(d._errors).slice(0, 2).join("; ") : " Обновите код воркера из файла worker/yahoo-proxy.js, чтобы видеть причину.";
      throw new Error("Прокси ответил, но без цен." + why);
    }
  }
  function startFeeds() {
    if (typeof fetch !== "function") return;
    const keys = typeof LIVE_KEYS !== "undefined" ? LIVE_KEYS : {};
    schedule(pollCrypto, 2000, "Крипта (Binance, Coinbase, Kraken)");
    schedule(pollMoex, 10000, "Мосбиржа (российские акции)");
    if (keys.finnhub) schedule(() => pollFinnhub(keys.finnhub), 15000, "Finnhub (акции США)");
    schedule(pollPolymarket, 3000, "Polymarket Perps (акции США, золото, серебро)");
    if (typeof LIVE_PROXY !== "undefined" && LIVE_PROXY) schedule(() => pollYahoo(LIVE_PROXY), 15000, "Прокси Yahoo (акции США, золото, нефть…)");
    if (keys.twelvedata) schedule(() => pollTwelve(keys.twelvedata), 60000, "Twelve Data (золото, серебро)");
  }
  const errHint = (err) => {
    if (/AbortError/.test(err)) return "Нет ответа за 6 секунд: медленная сеть или источник недоступен.";
    if (/HTTP 451/.test(err)) return "Источник недоступен в вашей стране.";
    if (/HTTP (403|401)/.test(err)) return "Доступ запрещён (проверьте ключ или адрес).";
    if (/HTTP 429/.test(err)) return "Превышен лимит запросов, подождите.";
    if (/HTTP 5\d\d/.test(err)) return "Источник временно не работает.";
    if (/без цен|цен по нужным/.test(err)) return "Источник ответил, но данных по бумагам нет (биржа закрыта, тикер не найден или источник блокирует запросы).";
    if (/Failed to fetch|NetworkError|Load failed/i.test(err)) return "Запрос не прошёл. Частые причины: сайт открыт внутри claude.ai (там внешние запросы запрещены), источник не разрешает запросы с этого сайта (CORS), либо запрос блокирует провайдер, VPN или расширение браузера.";
    return "";
  };
  const agoTxt = (t) => { if (!t) return "ещё не было"; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? s + " с назад" : Math.floor(s / 60) + " мин назад"; };
  function feedsHTML() {
    const where = location.protocol === "file:" ? "локальный файл" : location.hostname;
    const rows = Object.entries(feedStatus).map(([name, s]) => `<tr><td>${esc(name)}</td><td class="${s.ok ? "pos" : "neg"}">${s.ok ? "работает" : "ошибка"}</td><td>${agoTxt(s.lastOk)}</td><td class="fe">${s.ok ? "" : esc(s.err) + (errHint(s.err) ? `<small>${esc(errHint(s.err))}</small>` : "")}</td></tr>`).join("");
    const proxy = typeof LIVE_PROXY !== "undefined" && LIVE_PROXY ? esc(LIVE_PROXY) : "не задан (акции США, золото, нефть, газ и пшеница останутся на симуляции)";
    const live = ASSETS.filter((x) => fresh(x)).length;
    return `${pmNote ? `<p class="neg" style="margin:0 0 10px">${esc(pmNote)}</p>` : ""}
    <p class="muted" style="margin:0 0 10px">Страница открыта с: <b>${esc(where)}</b> · Live-цены: <b>${live} из ${ASSETS.length}</b> · Адрес прокси: ${proxy}</p>
      <div class="table-wrap" style="margin:0"><table class="ptable feeds"><thead><tr><th>Источник</th><th>Статус</th><th>Последний успех</th><th>Что не так</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Запросы ещё не отправлялись.</td></tr>'}</tbody></table></div>`;
  }
  function paintFeeds() { const el = $("#t-feedbody"); if (el && $("#t-feeds") && $("#t-feeds").open) el.innerHTML = feedsHTML(); }
  const liveBadge = (a) => (fresh(a) ? '<span class="lv on">Live</span>' : '<span class="lv">Демо</span>');
  // Откуда взят график за выбранный период: настоящие свечи или симуляция (честно помечаем).
  const histNote = (a) => {
    if (P.range === "LIVE") return "";
    const real = P.range === "1Ч" ? a.realMin : isDaily() ? a.realDaily : a.realHist;
    return real ? ` История за период: настоящие свечи Binance.` : ` История за период смоделирована (демо), это не реальные котировки.`;
  };
  const srcText = (a) => (fresh(a) ? "Источник цены: " + SRC_NAME[a.srcKey] : "Источник цены: симуляция. " + (SRC[a.sym] ? "Живой источник не ответил: причина в разделе «Статус источников цен» внизу страницы." : "Для этого актива бесплатного живого источника нет.") + histNote(a));
  const RANGES = ["LIVE", "1Ч", "1Д", "1Н", "1М", "3М", "1Г"]; // час, день, неделя, месяц, 3 месяца, год
  const rangesFor = () => RANGES;
  const rangeHTML = (a) => { if (!rangesFor(a).includes(P.range)) P.range = "LIVE"; return rangesFor(a).map((k) => `<button data-range="${k}" class="${k === P.range ? "on" : ""}">${k === "LIVE" ? "Live" : k}</button>`).join(""); };

  // ---------- позиции ----------
  const liqPrice = (entry, lev, dir) => (dir === "long" ? entry * (1 - 1 / lev + MMR) : entry * (1 + 1 / lev - MMR));
  function stats(pos, p) {
    const a = A[pos.sym], d = pos.dir === "long" ? 1 : -1;
    const pnl = pos.notional * d * (p / pos.entry - 1);
    const funding = (pos.notional * a.fund * d * ((Date.now() - pos.ts) / 3.6e6)) / 8;
    const feeClose = pos.notional * (p / pos.entry) * FEE;
    const equity = pos.margin + pnl - funding - feeClose;
    return { pnl, funding, feeClose, equity, result: equity - pos.margin - pos.feeOpen, roe: ((equity - pos.margin) / pos.margin) * 100 };
  }
  const sideTag = (pos) => `<span class="tag ${pos.dir === "long" ? "yes" : "no"}">${pos.dir === "long" ? "Long" : "Short"} ${pos.lev === 1 ? "без плеча" : pos.lev + "x"}</span>`;

  let logSeq = 0;
  function logEvent(e) { plog.push({ id: Date.now().toString(36) + "-" + logSeq++, t: Date.now(), ...e }); }

  function checkLiquidations() {
    const hit = positions.filter((pos) => {
      const p = A[pos.sym].price;
      return pos.dir === "long" ? p <= pos.liq : p >= pos.liq;
    });
    if (!hit.length) return;
    hit.forEach((pos) => {
      closed.push({ sym: pos.sym, dir: pos.dir, lev: pos.lev, margin: pos.margin, entry: pos.entry, exit: pos.liq, pnl: -pos.margin - pos.feeOpen, kind: "liq", ts: Date.now() });
      logEvent({ kind: "liq", sym: pos.sym, dir: pos.dir, lev: pos.lev, amt: 0, price: pos.liq, pnl: -pos.margin - pos.feeOpen });
      RP.toast(`Ликвидация: ${pos.sym} ${pos.dir === "long" ? "Long" : "Short"} ${pos.lev}x. Маржа ${RP.rub(pos.margin)} потеряна.`);
    });
    positions = positions.filter((p) => !hit.includes(p));
    persist();
    if (RP.route() === "trade") paintPositions();
  }
  function persist() {
    RP.store.set("ppos", positions);
    RP.store.set("pclosed", closed.slice(-100));
    RP.store.set("plog", plog.slice(-300));
  }

  // ---------- стоп-лосс и тейк-профит ----------
  const dsign = (dir) => (dir === "long" ? 1 : -1);
  const parseP = (s) => { s = String(s ?? "").trim().replace(",", "."); return s === "" ? null : Number(s); };
  const fmtIn = (a, v) => String(Number(v.toFixed(a.dec + (a.dec < 2 ? 1 : 0))));
  // Возвращает текст ошибки или пустую строку. ref — текущая цена, liq — цена ликвидации.
  function tpslError(a, dir, tp, sl, ref, liq) {
    if (Number.isNaN(tp) || (tp !== null && tp <= 0)) return "Некорректная цена тейк-профита.";
    if (Number.isNaN(sl) || (sl !== null && sl <= 0)) return "Некорректная цена стоп-лосса.";
    const long = dir === "long";
    if (tp !== null && (long ? tp <= ref : tp >= ref)) return `Тейк-профит должен быть ${long ? "выше" : "ниже"} текущей цены (${price(a, ref)}).`;
    if (sl !== null && (long ? sl >= ref : sl <= ref)) return `Стоп-лосс должен быть ${long ? "ниже" : "выше"} текущей цены (${price(a, ref)}).`;
    if (sl !== null && (long ? sl <= liq : sl >= liq)) return `Стоп-лосс должен быть ${long ? "выше" : "ниже"} цены ликвидации (${price(a, liq)}), иначе он не сработает.`;
    return "";
  }
  // Цена из процента от маржи (ROE) с учётом плеча: +50% при 10x это движение цены на 5%.
  const priceFromRoe = (a, dir, lev, ref, roe) => ref * (1 + (dsign(dir) * roe) / 100 / lev);
  function estResult(dir, entry, notional, exit) {
    const pnl = notional * dsign(dir) * (exit / entry - 1);
    return pnl - notional * FEE - notional * (exit / entry) * FEE;
  }
  const levTxt = (l) => (l === 1 ? "без плеча" : l + "x");
  const KIND = { liq: ["Ликвидация", "no"], tp: ["Тейк-профит", "yes"], sl: ["Стоп-лосс", "no"] };

  function settle(pos, kind, exitPrice) {
    const a = A[pos.sym], s = stats(pos, exitPrice);
    positions = positions.filter((x) => x !== pos);
    RP.setBalance(RP.getBalance() + Math.max(0, s.equity));
    closed.push({ sym: pos.sym, dir: pos.dir, lev: pos.lev, margin: pos.margin, entry: pos.entry, exit: exitPrice, pnl: s.result, kind, ts: Date.now() });
    logEvent({ kind, sym: pos.sym, dir: pos.dir, lev: pos.lev, amt: Math.max(0, s.equity), price: exitPrice, pnl: s.result });
    persist();
    const word = { close: "Позиция закрыта", tp: "Сработал тейк-профит", sl: "Сработал стоп-лосс" }[kind];
    RP.toast(`${word}: ${pos.sym} ${pos.dir === "long" ? "Long" : "Short"} ${levTxt(pos.lev)}. Итог ${sg(s.result, 0)} ₽`);
    if (RP.route() === "trade") { paintPositions(); paintChart(); }
  }
  function checkTpSl() {
    const hit = [];
    positions.forEach((pos) => {
      const p = A[pos.sym].price, long = pos.dir === "long";
      if (pos.tp && (long ? p >= pos.tp : p <= pos.tp)) hit.push([pos, "tp", p]);
      else if (pos.sl && (long ? p <= pos.sl : p >= pos.sl)) hit.push([pos, "sl", p]);
    });
    hit.forEach(([pos, kind, p]) => settle(pos, kind, p));
  }

  function maxMargin() { return Math.max(0, Math.floor(RP.getBalance() / (1 + P.lev * FEE))); }

  function confirmOpen() {
    const a = A[P.sel], m = Math.floor(Number($("#t-margin").value));
    const msg = $("#t-msg");
    msg.className = "msg err";
    if (!(m > 0)) return (msg.textContent = "Введите сумму маржи.");
    const notional = m * P.lev, fee = notional * FEE;
    if (m + fee > RP.getBalance()) return (msg.textContent = "Недостаточно средств. Уменьшите маржу или пополните баланс.");
    msg.textContent = "";
    const entry = a.price, liq = liqPrice(entry, P.lev, P.dir), dir = P.dir, lev = P.lev;
    const tp = parseP($("#t-tp").value), sl = parseP($("#t-sl").value);
    const err = tpslError(a, dir, tp, sl, entry, liq);
    if (err) return (msg.textContent = err);
    RP.askConfirm({
      title: "Подтвердите открытие позиции",
      okText: dir === "long" ? "Открыть Long" : "Открыть Short",
      danger: dir === "short",
      rows: [
        ["Контракт", `${a.sym}-PERP`],
        ["Направление", `${dir === "long" ? "Long (рост)" : "Short (падение)"}, ${lev === 1 ? "без плеча" : lev + "x"}`],
        ["Маржа", RP.rub(m)],
        ["Размер позиции", RP.rub(notional)],
        ["Цена входа", price(a, entry)],
        ["Цена ликвидации", price(a, liq)],
        ...(tp ? [["Тейк-профит", `${price(a, tp)} (${sg(estResult(dir, entry, notional, tp), 0)} ₽)`, "pos"]] : []),
        ...(sl ? [["Стоп-лосс", `${price(a, sl)} (${sg(estResult(dir, entry, notional, sl), 0)} ₽)`, "neg"]] : []),
        ["Комиссия 0,05%", fee2(fee)]
      ]
    }, () => {
      if (m + fee > RP.getBalance()) return RP.toast("Недостаточно средств");
      RP.setBalance(RP.getBalance() - m - fee);
      positions.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 6), sym: a.sym, dir, lev, margin: m, notional, entry, liq, tp, sl, feeOpen: fee, ts: Date.now() });
      logEvent({ kind: "open", sym: a.sym, dir, lev, amt: m, price: entry });
      persist();
      RP.toast(`Позиция открыта: ${a.sym} ${dir === "long" ? "Long" : "Short"} ${levTxt(lev)}`);
      if (RP.route() === "trade") { paintPositions(); paintSummary(); paintChart(); }
    });
  }

  function confirmClose(id) {
    const pos = positions.find((x) => x.id === id);
    if (!pos) return;
    const a = A[pos.sym], p = a.price, s = stats(pos, p);
    RP.askConfirm({
      title: "Подтвердите закрытие позиции",
      okText: "Закрыть позицию",
      danger: true,
      rows: [
        ["Контракт", `${pos.sym}-PERP, ${pos.dir === "long" ? "Long" : "Short"} ${pos.lev === 1 ? "без плеча" : pos.lev + "x"}`],
        ["Вход → выход", `${price(a, pos.entry)} → ${price(a, p)}`],
        ["Результат по цене", `${sg(s.pnl, 0)} ₽`, s.pnl >= 0 ? "pos" : "neg"],
        ["Комиссия закрытия", "− " + fee2(s.feeClose)],
        ["Фандинг", `${sg(-s.funding, 2)} ₽`],
        ["Вы получите", `<b>${RP.rub(Math.max(0, s.equity))}</b>`],
        ["Итог с комиссиями", `${sg(s.result, 0)} ₽`, s.result >= 0 ? "pos" : "neg"]
      ]
    }, () => closePosition(id));
  }
  function closePosition(id) {
    const pos = positions.find((x) => x.id === id);
    if (pos) settle(pos, "close", A[pos.sym].price);
  }

  function openEdit(id) {
    const pos = positions.find((x) => x.id === id);
    if (!pos) return;
    const a = A[pos.sym];
    RP.openSheet(`
      <h2>Стоп-лосс и тейк-профит</h2>
      <p>${pos.sym}-PERP, ${pos.dir === "long" ? "Long" : "Short"} ${levTxt(pos.lev)}. Вход ${price(a, pos.entry)}, сейчас <b id="e-cur">${price(a, a.price)}</b>, ликвидация ${price(a, pos.liq)}.</p>
      <label class="l" for="e-tp">Тейк-профит, цена</label>
      <input class="field" id="e-tp" type="text" inputmode="decimal" placeholder="Пусто — без тейк-профита" value="${pos.tp ? fmtIn(a, pos.tp) : ""}">
      <div class="chips" id="e-tpchips" style="margin-top:8px">${[25, 50, 100].map((r) => `<button class="chip" data-roe="${r}">+${r}%</button>`).join("")}<span class="chip-note">от маржи</span></div>
      <label class="l" for="e-sl">Стоп-лосс, цена</label>
      <input class="field" id="e-sl" type="text" inputmode="decimal" placeholder="Пусто — без стоп-лосса" value="${pos.sl ? fmtIn(a, pos.sl) : ""}">
      <div class="chips" id="e-slchips" style="margin:8px 0 14px">${[10, 25, 50].map((r) => `<button class="chip" data-roe="${r}">−${r}%</button>`).join("")}<span class="chip-note">от маржи</span></div>
      <button class="submit" id="e-save">Сохранить</button>
      <div class="msg err" id="e-msg"></div>`);
    const chips = (cid, inp, sign) => {
      $(cid).onclick = (ev) => {
        const b = ev.target.closest("[data-roe]");
        if (b) $(inp).value = fmtIn(a, priceFromRoe(a, pos.dir, pos.lev, a.price, sign * Number(b.dataset.roe)));
      };
    };
    chips("#e-tpchips", "#e-tp", 1);
    chips("#e-slchips", "#e-sl", -1);
    $("#e-save").onclick = () => {
      const tp = parseP($("#e-tp").value), sl = parseP($("#e-sl").value);
      const err = tpslError(a, pos.dir, tp, sl, a.price, pos.liq);
      if (err) return ($("#e-msg").textContent = err);
      pos.tp = tp; pos.sl = sl;
      persist();
      RP.closeModal();
      RP.toast(tp || sl ? "Стоп-лосс и тейк-профит сохранены" : "Стоп-лосс и тейк-профит сняты");
      paintPositions();
      paintChart();
    };
  }

  // ---------- графики ----------
  function seriesFor(a) {
    if (P.range === "LIVE") return a.live;
    switch (P.range) {
      case "1Ч": return a.mm;
      case "1Д": return a.hh.slice(-24);
      case "1Н": return a.hh;
      case "1М": return a.dd.slice(-30);
      case "3М": return a.dd.slice(-90);
      default: return a.dd;
    }
  }
  const isDaily = () => P.range === "1М" || P.range === "3М" || P.range === "1Г";
  function labelAt(n, i) {
    if (P.range === "LIVE") return i === n - 1 ? "сейчас" : `−${n - 1 - i} с`;
    if (isDaily()) return new Date(Date.now() - (n - 1 - i) * 86400e3).toLocaleDateString("ru-RU", P.range === "1Г" ? { day: "numeric", month: "short", year: "2-digit" } : { day: "numeric", month: "short" });
    if (P.range === "1Ч") return new Date(Date.now() - (n - 1 - i) * 60e3).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const d = new Date(Date.now() - (n - 1 - i) * 3600e3);
    return P.range === "1Д"
      ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }
  function pgeom(vals, a, ext) {
    const W = 560, H = 380, L = 64, R = 10, T = 12, B = 24, n = vals.length;
    let lo = Math.min(...(ext || vals)), hi = Math.max(...(ext || vals));
    const pad = (hi - lo) * 0.12 || hi * 0.001;
    lo -= pad; hi += pad;
    return { W, H, L, R, T, B, n, lo, hi, x: (i) => L + (i * (W - L - R)) / (n - 1), y: (v) => T + ((hi - v) * (H - T - B)) / (hi - lo) };
  }
  // ---------- график: окно просмотра (масштаб и сдвиг) и привязка рисунков ко времени и цене ----------
  let VW = { span: null, end: null, key: "" }; // сколько точек видно и где правый край; null — весь график, правый край у последней точки
  let M = null, HV = null; // текущая раскладка графика и управление курсором
  const T = { tool: "cursor", pending: null, sel: null, measure: null, busy: false, textOpen: false, emoji: "🚀", hist: [] };
  let drawings = {}; // тикер -> список рисунков [{ id, type, pts: [{t, p}], text, emoji }]
  const DCOL = "#f5c542";
  const stepMs = () => (P.range === "LIVE" ? 1000 : P.range === "1Ч" ? 60e3 : isDaily() ? 86400e3 : 3600e3);
  function viewWin(nF) {
    const key = P.sel + P.range;
    if (VW.key !== key) VW = { span: null, end: null, key };
    const span = clamp(VW.span || nF, Math.min(10, nF), nF);
    const end = clamp(VW.end == null ? nF - 1 : VW.end, span - 1, nF - 1);
    return { span, end, i0: end - span + 1, nF, zoomed: span < nF };
  }
  const RK = { "1Ч": ["mm", 0], "1Д": ["hh", 24], "1Н": ["hh", 0], "1М": ["dd", 30], "3М": ["dd", 90], "1Г": ["dd", 0] };
  // Свечи на весь ряд: настоящие от Binance, где они есть, иначе из ряда цен с восстановленными тенями (демо, помечается).
  function ohlcFull(a, S) {
    const n = S.length, k = RK[P.range], step = stepMs(), now = Date.now();
    let real = null;
    if (k && a.ohlcReal && a.ohlcReal[k[0]]) { const arr = a.ohlcReal[k[0]]; real = k[1] ? arr.slice(-k[1]) : arr; if (real.length !== n) real = null; }
    let unit = 0;
    for (let i = 1; i < n; i++) unit += Math.abs(S[i] - S[i - 1]);
    unit = unit / Math.max(1, n - 1) || S[n - 1] * 0.0005;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      if (real) { out[i] = real[i].slice(); continue; }
      const c = S[i], o = i ? S[i - 1] : S[0];
      if (P.range === "LIVE") { out[i] = [o, Math.max(o, c), Math.min(o, c), c]; continue; } // тики: тени получатся при объединении
      const rnd = mulberry(seedOf(a.sym) + Math.floor((now - (n - 1 - i) * step) / step) * 7 + 3);
      out[i] = [o, Math.max(o, c) + unit * (0.15 + 0.9 * rnd()), Math.min(o, c) - unit * (0.15 + 0.9 * rnd()), c];
    }
    const L = out[n - 1]; L[3] = S[n - 1]; L[1] = Math.max(L[1], L[3]); L[2] = Math.min(L[2], L[3]);
    return out;
  }
  function buildCandles(a, S, w) {
    const O = ohlcFull(a, S), step = stepMs(), now = Date.now(), vis = O.slice(w.i0, w.i0 + w.span);
    const gs = Math.max(1, Math.ceil(vis.length / 70)), cs = [];
    let curKey = null;
    vis.forEach((q, j) => {
      const key = Math.floor(Math.floor((now - (w.nF - 1 - (w.i0 + j)) * step) / step) / gs);
      if (key !== curKey) { cs.push({ i0: j, i1: j, o: q[0], h: q[1], l: q[2], c: q[3] }); curKey = key; }
      else { const c = cs[cs.length - 1]; c.i1 = j; c.h = Math.max(c.h, q[1]); c.l = Math.min(c.l, q[2]); c.c = q[3]; }
    });
    const ext = [];
    cs.forEach((c) => ext.push(c.h, c.l));
    return { cs, gs, ext, real: !!(a.ohlcReal && RK[P.range] && a.ohlcReal[RK[P.range][0]]) };
  }
  function mapChart(a) {
    const S = seriesFor(a), nF = S.length, w = viewWin(nF), vals = S.slice(w.i0, w.i0 + w.span);
    const cd = P.ctype === "candles" ? buildCandles(a, S, w) : null, g = pgeom(vals, a, cd ? cd.ext : null);
    const step = stepMs(), now = Date.now();
    return {
      a, S, nF, w, vals, g, step, now, cd,
      X: (t) => g.x(nF - 1 - (now - t) / step - w.i0),
      Y: (p) => g.y(p),
      inv: (px, py) => ({ t: now - (nF - 1 - (w.i0 + ((px - g.L) / (g.W - g.L - g.R)) * (g.n - 1))) * step, p: g.hi - ((py - g.T) * (g.hi - g.lo)) / (g.H - g.T - g.B) })
    };
  }
  function candlesSVG(m) {
    const { g, cd } = m, n = m.vals.length, slot = ((g.W - g.L - g.R) / Math.max(1, n - 1)) * cd.gs, bw = Math.max(1.6, Math.min(16, slot * 0.68));
    return `<g class="cnd">${cd.cs.map((c) => {
      const x = g.x((c.i0 + c.i1) / 2), up = c.c >= c.o, yo = g.y(c.o), yc = g.y(c.c);
      return `<g class="${up ? "cu" : "cd"}"><line class="wk" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${g.y(c.h).toFixed(1)}" y2="${g.y(c.l).toFixed(1)}"/><rect class="bd" x="${(x - bw / 2).toFixed(1)}" y="${Math.min(yo, yc).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1.2, Math.abs(yo - yc)).toFixed(1)}"/></g>`;
    }).join("")}</g>`;
  }
  function chartHTML(a, m) {
    const { g, vals, w, nF } = m, n = vals.length;
    const step = Math.max(1, Math.floor(n / 150));
    let line = "";
    for (let i = 0; i < n; i += step) line += (line ? "L" : "M") + g.x(i).toFixed(1) + " " + g.y(vals[i]).toFixed(1);
    line += "L" + g.x(n - 1).toFixed(1) + " " + g.y(vals[n - 1]).toFixed(1);
    const base = g.H - g.B, up = vals[n - 1] >= vals[0];
    const ticks = [0, 1, 2, 3].map((k) => {
      const v = g.lo + ((g.hi - g.lo) * k) / 3;
      return `<line class="gl" x1="${g.L}" x2="${g.W - g.R}" y1="${g.y(v).toFixed(1)}" y2="${g.y(v).toFixed(1)}"/><text class="tx" x="${g.L - 6}" y="${(g.y(v) + 4).toFixed(1)}" text-anchor="end">${num(v, a.dec)}</text>`;
    }).join("");
    const xl = [[0, "start"], [Math.round((n - 1) / 2), "middle"], [n - 1, "end"]]
      .map(([i, an]) => `<text class="tx" x="${g.x(i).toFixed(1)}" y="${g.H - 6}" text-anchor="${an}">${labelAt(nF, w.i0 + i)}</text>`).join("");
    // линии входа и ликвидации открытых позиций по этому активу
    const marks = positions.filter((p) => p.sym === a.sym).map((p) => {
      const mk = (v, cls, txt) => (v > g.lo && v < g.hi ? `<line class="${cls}" x1="${g.L}" x2="${g.W - g.R}" y1="${g.y(v).toFixed(1)}" y2="${g.y(v).toFixed(1)}"/><text class="mk ${cls}" x="${g.W - g.R - 4}" y="${(g.y(v) - 4).toFixed(1)}" text-anchor="end">${txt}</text>` : "");
      return mk(p.entry, "m-entry", "вход") + mk(p.liq, "m-liq", "ликвидация") + (p.tp ? mk(p.tp, "m-tp", "тейк") : "") + (p.sl ? mk(p.sl, "m-sl", "стоп") : "");
    }).join("");
    return `<svg viewBox="0 0 ${g.W} ${g.H}" class="chart-svg ${up ? "up" : "down"} tool-${T.tool}" role="img" aria-label="График цены ${a.sym}">
      <defs><clipPath id="dclip"><rect x="${g.L}" y="${g.T}" width="${g.W - g.L - g.R}" height="${base - g.T}"/></clipPath></defs>
      ${ticks}${xl}${marks}
      ${m.cd ? candlesSVG(m) : `<path class="ca" d="${line}L${g.x(n - 1).toFixed(1)} ${base}L${g.L} ${base}Z"/>
      <path class="cl" d="${line}"/>`}
      <g class="drw" clip-path="url(#dclip)"></g>
      <line class="cross" y1="${g.T}" y2="${base}" hidden/><circle class="dot" r="4.5" hidden/>
    </svg>`;
  }

  // ---------- рисунки ----------
  const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const durTxt = (ms) => {
    const s = Math.round(Math.abs(ms) / 1000);
    if (s < 90) return s + " с";
    const m = Math.round(s / 60);
    if (m < 90) return m + " мин";
    const h = Math.round(m / 60);
    if (h < 48) return h + " ч";
    return Math.round(h / 24) + " дн";
  };
  function dwSVG(d, m, pend) {
    const { X, Y, a, g } = m;
    const P2 = d.pts.map((q) => [X(q.t), Y(q.p)]);
    const f = (v) => v.toFixed(1);
    const hit = (inner) => `<g class="dh">${inner}</g>`;
    let body = "", hitb = "";
    const seg = (x1, y1, x2, y2, cls = "dl") => `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    const dots = P2.map(([x, y]) => `<circle class="dp" cx="${f(x)}" cy="${f(y)}" r="3"/>`).join("");
    if (d.type === "line") {
      const [[x1, y1], [x2, y2]] = P2;
      body = seg(x1, y1, x2, y2) + dots; hitb = seg(x1, y1, x2, y2, "dh-l");
    } else if (d.type === "fib") {
      const [[x1, y1], [x2, y2]] = P2, xa = Math.min(x1, x2), xb = Math.max(x1, x2);
      const [p1, p2] = [d.pts[0].p, d.pts[1].p];
      body = FIB.map((l, k) => {
        const pr = p2 - (p2 - p1) * l, y = Y(pr);
        return `${k < FIB.length - 1 ? `<rect class="fz" x="${f(xa)}" y="${f(Math.min(y, Y(p2 - (p2 - p1) * FIB[k + 1])))}" width="${f(xb - xa)}" height="${f(Math.abs(Y(p2 - (p2 - p1) * FIB[k + 1]) - y))}" opacity="${k % 2 ? 0.05 : 0.11}"/>` : ""}${seg(xa, y, xb, y, "dl thin")}<text class="dt s" x="${f(xa + 4)}" y="${f(y - 3)}">${String(l).replace(".", ",")} · ${num(pr, a.dec)}</text>`;
      }).join("") + seg(x1, y1, x2, y2, "dl dash") + dots;
      hitb = FIB.map((l) => { const y = Y(p2 - (p2 - p1) * l); return seg(xa, y, xb, y, "dh-l"); }).join("");
    } else if (d.type === "poly" || d.type === "brush") {
      const path = P2.map(([x, y], i) => (i ? "L" : "M") + f(x) + " " + f(y)).join("");
      body = `<path class="dl ${d.type === "brush" ? "brush" : ""}" d="${path}"/>` + (d.type === "poly" ? dots : "");
      hitb = `<path class="dh-l" d="${path}"/>`;
    } else if (d.type === "channel") {
      const [[x1, y1], [x2, y2]] = P2, third = d.pts[2] || d.pts[1];
      // сдвиг параллельной линии по цене: третья точка лежит на второй линии канала
      const k = (d.pts[1].t - d.pts[0].t) || 1;
      const pOnBase = d.pts[0].p + ((d.pts[1].p - d.pts[0].p) * (third.t - d.pts[0].t)) / k;
      const dy = Y(third.p) - Y(pOnBase);
      body = `<path class="fz" d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}L${f(x2)} ${f(y2 + dy)}L${f(x1)} ${f(y1 + dy)}Z" opacity=".09"/>` +
        seg(x1, y1, x2, y2) + seg(x1, y1 + dy, x2, y2 + dy) + seg(x1, y1 + dy / 2, x2, y2 + dy / 2, "dl dash thin") + dots;
      hitb = seg(x1, y1, x2, y2, "dh-l") + seg(x1, y1 + dy, x2, y2 + dy, "dh-l");
    } else if (d.type === "text") {
      const [[x, y]] = P2;
      body = `<text class="dt" x="${f(x)}" y="${f(y)}">${esc(d.text)}</text>`;
      hitb = `<rect class="dh-r" x="${f(x - 4)}" y="${f(y - 16)}" width="${f(d.text.length * 8 + 8)}" height="22"/>`;
    } else if (d.type === "emoji") {
      const [[x, y]] = P2;
      body = `<text class="de" x="${f(x)}" y="${f(y + 8)}" text-anchor="middle">${d.emoji}</text>`;
      hitb = `<circle class="dh-r" cx="${f(x)}" cy="${f(y)}" r="16"/>`;
    } else if (d.type === "measure") {
      const [[x1, y1], [x2, y2]] = P2, dp = d.pts[1].p - d.pts[0].p, pc = (dp / d.pts[0].p) * 100, col = dp >= 0 ? "var(--yes)" : "var(--no)";
      const lab1 = `${sg(dp, a.dec)} (${sg(pc)}%)`, lab2 = durTxt(d.pts[1].t - d.pts[0].t);
      const bw = Math.max(lab1.length, lab2.length) * 6.6 + 16, bx = clamp(x2 + 10, g.L, g.W - g.R - bw), by = clamp(y2 - 18, g.T, g.H - g.B - 40);
      body = `<rect class="fz" x="${f(Math.min(x1, x2))}" y="${f(Math.min(y1, y2))}" width="${f(Math.abs(x2 - x1))}" height="${f(Math.abs(y2 - y1))}" style="fill:${col}" opacity=".12"/>` +
        `<line class="dl dash" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" style="stroke:${col}"/>${dots}` +
        `<rect class="mbox" x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="38" rx="6"/><text class="dt s" x="${f(bx + 8)}" y="${f(by + 16)}" style="fill:${col}">${lab1}</text><text class="dt s" x="${f(bx + 8)}" y="${f(by + 31)}">${lab2}</text>`;
    }
    return `<g class="dw ${pend ? "pend" : ""} ${T.sel === d.id ? "sel" : ""}" data-id="${d.id || ""}">${body}${hitb ? hit(hitb) : ""}</g>`;
  }
  function renderDrawings() {
    const g = $(".drw", $("#t-chart"));
    if (!g || !M) return;
    const list = drawings[P.sel] || [];
    g.innerHTML = list.map((d) => dwSVG(d, M, false)).join("") + (T.measure ? dwSVG(T.measure, M, false) : "") + (T.pending ? dwSVG(T.pending, M, true) : "");
  }
  const saveDraw = () => RP.store.set("pdraw", drawings);
  const snap = () => { T.hist.push({ sym: P.sel, json: JSON.stringify(drawings[P.sel] || []) }); if (T.hist.length > 40) T.hist.shift(); };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  function setTool(t) {
    T.tool = t; T.pending = null; T.measure = null; T.sel = null; T.busy = false;
    closeTextInput();
    const bar = $("#t-tools");
    if (bar) bar.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
    const emo = $("#t-emo"); if (emo) emo.hidden = t !== "emoji";
    const hint = $("#t-hint"); if (hint) hint.textContent = HINTS[t];
    paintChart();
  }
  const HINTS = {
    cursor: "Колесо мыши или кнопки +/−: масштаб. Потяните график, чтобы сдвинуть. Нажмите на рисунок, чтобы выбрать, Delete удалит.",
    line: "Линия тренда: нажмите и протяните или поставьте две точки кликами.",
    fib: "Уровни Фибоначчи: от начала движения до его конца, две точки.",
    poly: "Ломаная: ставьте точки кликами, двойной клик или Enter завершает.",
    channel: "Параллельный канал: две точки задают линию, третий клик сдвигает вторую.",
    brush: "Кисть: зажмите и рисуйте от руки.",
    text: "Текст: нажмите в нужном месте и введите подпись.",
    emoji: "Эмодзи: выберите значок и нажмите на график.",
    measure: "Линейка: две точки покажут изменение цены, процент и время."
  };
  function commit(d) {
    snap();
    d.id = newId();
    if (d.type !== "measure") { (drawings[P.sel] = drawings[P.sel] || []).push(d); saveDraw(); }
    T.pending = null; T.busy = false;
    setTool("cursor");
    if (d.type === "measure") T.measure = d; else T.sel = d.id; // линейка временная: исчезает при следующем клике
    renderDrawings();
  }
  function closeTextInput() { const i = $("#t-txt"); if (i) i.remove(); T.textOpen = false; }
  function openTextInput(q, ev) {
    closeTextInput();
    const wrap = $("#t-drawmain"), host = $("#t-chart");
    if (!wrap || !host) return;
    const hr = host.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const inp = document.createElement("input");
    inp.id = "t-txt"; inp.className = "draw-txt field"; inp.maxLength = 60; inp.placeholder = "Текст и Enter";
    inp.style.left = Math.min(ev.clientX - wr.left, wr.width - 170) + "px";
    inp.style.top = ev.clientY - wr.top - 14 + "px";
    wrap.appendChild(inp);
    T.textOpen = true;
    inp.focus();
    inp.onkeydown = (e) => {
      if (e.key === "Enter") { const v = inp.value.trim(); closeTextInput(); if (v) commit({ type: "text", pts: [q], text: v }); else setTool("cursor"); }
      if (e.key === "Escape") { closeTextInput(); setTool("cursor"); }
    };
    inp.onblur = () => setTimeout(() => { if ($("#t-txt")) { closeTextInput(); T.busy = false; } }, 120);
  }

  // ---------- масштаб и сдвиг ----------
  function zoomBy(f, fx = 0.5) {
    if (!M) return;
    const w = M.w, nF = M.nF;
    const ns = clamp(Math.round(w.span * f), Math.min(10, nF), nF);
    const idx = w.i0 + fx * (w.span - 1);
    const end = clamp(Math.round(idx - fx * (ns - 1) + ns - 1), ns - 1, nF - 1);
    VW.span = ns >= nF ? null : ns;
    VW.end = end >= nF - 1 ? null : end;
    paintChart();
  }
  const zoomReset = () => { VW.span = null; VW.end = null; paintChart(); };

  // ---------- мышь, палец и клавиатура на графике ----------
  function bindHost(host) {
    if (host.__bound) return;
    host.__bound = true;
    const ptrs = new Map();
    let pan = null, pinch = null, brushing = false, dragged = null;
    const toPt = (ev) => {
      const svg = $("svg", host), r = svg.getBoundingClientRect(), g = M.g;
      const px = clamp(((ev.clientX - r.left) / r.width) * g.W, g.L, g.W - g.R), py = clamp(((ev.clientY - r.top) / r.height) * g.H, g.T, g.H - g.B);
      const q = M.inv(px, py);
      return { t: q.t, p: q.p, px, py };
    };
    const strip = (q) => ({ t: q.t, p: q.p });
    const refreshPend = () => renderDrawings();
    host.addEventListener("pointerenter", () => (chartHover = true));
    host.addEventListener("pointerleave", (ev) => { if (ev.pointerType !== "touch") { chartHover = false; if (HV && !pan) HV.hide(); } });
    host.addEventListener("pointerdown", (ev) => {
      if (!M || ev.button > 0) return;
      ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (ptrs.size === 2) { // два пальца: масштаб щипком
        const [p1, p2] = [...ptrs.values()];
        pinch = { d0: Math.hypot(p1.x - p2.x, p1.y - p2.y), span0: M.w.span };
        pan = null; T.busy = true;
        return;
      }
      const q = toPt(ev), tool = T.tool;
      if (tool === "cursor") {
        const dw = ev.target.closest(".dw");
        if (dw && dw.dataset.id) { T.sel = dw.dataset.id; renderDrawings(); return; }
        if (T.sel || T.measure) { T.sel = null; T.measure = null; renderDrawings(); }
        HV && HV.move(ev);
        if (M.w.zoomed) { pan = { x0: ev.clientX, end0: M.w.end, moved: false }; T.busy = true; host.setPointerCapture(ev.pointerId); }
        return;
      }
      T.busy = true;
      host.setPointerCapture(ev.pointerId);
      if (tool === "text") { openTextInput(strip(q), ev); return; }
      if (tool === "emoji") { commit({ type: "emoji", pts: [strip(q)], emoji: T.emoji }); return; }
      if (tool === "brush") { T.pending = { type: "brush", pts: [strip(q)] }; brushing = true; refreshPend(); return; }
      if (tool === "poly") {
        if (!T.pending) T.pending = { type: "poly", pts: [strip(q), strip(q)] };
        else { T.pending.pts[T.pending.pts.length - 1] = strip(q); T.pending.pts.push(strip(q)); }
        refreshPend(); return;
      }
      if (tool === "channel" && T.pending && T.pending.stage === 1) { T.pending.pts[1] = strip(q); T.pending.stage = 2; T.pending.pts[2] = strip(q); refreshPend(); return; }
      if (tool === "channel" && T.pending && T.pending.stage === 2) { T.pending.pts[2] = strip(q); const d = T.pending; delete d.stage; commit(d); return; }
      if (T.pending && (tool === "line" || tool === "fib" || tool === "measure")) { T.pending.pts[1] = strip(q); commit(T.pending); return; }
      if (tool === "measure") T.measure = null;
      T.pending = { type: tool, pts: [strip(q), strip(q)], stage: tool === "channel" ? 1 : undefined };
      dragged = { x: ev.clientX, y: ev.clientY, moved: false };
      refreshPend();
    });
    host.addEventListener("pointermove", (ev) => {
      if (!M) return;
      if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && ptrs.size >= 2) {
        const [p1, p2] = [...ptrs.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
        const ns = clamp(Math.round(pinch.span0 * (pinch.d0 / d)), Math.min(10, M.nF), M.nF);
        if (ns !== M.w.span) { VW.span = ns >= M.nF ? null : ns; VW.end = M.w.end >= M.nF - 1 ? null : M.w.end; paintChart(); }
        return;
      }
      if (pan) {
        const r = $("svg", host).getBoundingClientRect(), g = M.g;
        const dIdx = (((ev.clientX - pan.x0) / r.width) * g.W / (g.W - g.L - g.R)) * (M.w.span - 1);
        if (Math.abs(ev.clientX - pan.x0) > 3) pan.moved = true;
        const end = clamp(Math.round(pan.end0 - dIdx), M.w.span - 1, M.nF - 1);
        if (end !== M.w.end) { VW.end = end >= M.nF - 1 ? null : end; paintChart(); }
        return;
      }
      if (HV) HV.move(ev);
      if (!T.pending) return;
      const q = strip(toPt(ev)), p = T.pending;
      if (dragged && Math.hypot(ev.clientX - dragged.x, ev.clientY - dragged.y) > 6) dragged.moved = true;
      if (p.type === "brush") { if (brushing) { const l = p.pts[p.pts.length - 1]; if (Math.hypot(M.X(q.t) - M.X(l.t), M.Y(q.p) - M.Y(l.p)) > 2) p.pts.push(q); } }
      else if (p.type === "poly") p.pts[p.pts.length - 1] = q;
      else if (p.type === "channel" && p.stage === 2) p.pts[2] = q;
      else p.pts[1] = q;
      refreshPend();
    });
    const up = (ev) => {
      ptrs.delete(ev.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (pan) { const moved = pan.moved; pan = null; T.busy = false; if (!moved) return; return; }
      if (brushing) { brushing = false; const p = T.pending; if (p && p.pts.length > 1) commit(p); else { T.pending = null; T.busy = false; refreshPend(); } return; }
      if (dragged) {
        const dg = dragged; dragged = null;
        const p = T.pending;
        if (p && dg.moved) { // протянули: линия готова (у канала дальше третья точка)
          if (p.type === "channel") { p.stage = 2; p.pts[2] = p.pts[1]; refreshPend(); }
          else commit(p);
        }
      }
      if (!T.pending && !T.textOpen && T.tool === "cursor") T.busy = false;
    };
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    host.addEventListener("dblclick", () => {
      const p = T.pending;
      if (p && p.type === "poly") { p.pts.pop(); p.pts.pop(); if (p.pts.length >= 2) commit(p); else { T.pending = null; T.busy = false; refreshPend(); } }
    });
    host.addEventListener("wheel", (ev) => {
      if (!M) return;
      ev.preventDefault();
      const svg = $("svg", host), r = svg.getBoundingClientRect(), g = M.g;
      const fx = clamp((((ev.clientX - r.left) / r.width) * g.W - g.L) / (g.W - g.L - g.R), 0, 1);
      zoomBy(ev.deltaY > 0 ? 1.2 : 1 / 1.2, fx);
    }, { passive: false });
    host.addEventListener("contextmenu", (ev) => { if (T.pending) { ev.preventDefault(); T.pending = null; T.busy = false; renderDrawings(); } });
  }
  function onKey(ev) {
    if (RP.route() !== "trade") return;
    const tag = (ev.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (ev.key === "Escape") { if (T.pending || T.tool !== "cursor") setTool("cursor"); else { T.sel = null; renderDrawings(); } }
    else if (ev.key === "Enter" && T.pending && T.pending.type === "poly") { const p = T.pending; p.pts.pop(); if (p.pts.length >= 2) commit(p); else setTool("cursor"); }
    else if ((ev.key === "Delete" || ev.key === "Backspace") && T.sel) { ev.preventDefault(); deleteSelected(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); undoDraw(); }
  }
  function deleteSelected() {
    const list = drawings[P.sel] || [], i = list.findIndex((d) => d.id === T.sel);
    if (i < 0) return;
    snap(); list.splice(i, 1); T.sel = null; saveDraw(); renderDrawings();
  }
  function undoDraw() {
    const h = T.hist.pop();
    if (!h) return RP.toast("Нечего отменять");
    drawings[h.sym] = JSON.parse(h.json); T.sel = null; saveDraw();
    if (h.sym === P.sel) renderDrawings();
  }
  function trashDraw() {
    if (T.sel) return deleteSelected();
    const list = drawings[P.sel] || [];
    if (!list.length) return RP.toast("На этом графике пока нет рисунков");
    snap(); drawings[P.sel] = []; T.measure = null; saveDraw(); renderDrawings();
    RP.toast("Рисунки удалены. Кнопка «Отменить» вернёт их.");
  }

  // ---------- панель инструментов ----------
  const ICON = {
    cursor: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
    line: '<circle cx="5.5" cy="18.5" r="2.2"/><circle cx="18.5" cy="5.5" r="2.2"/><path d="M7.2 16.8l9.6-9.6"/>',
    fib: '<path d="M3 5h12M3 12h18M9 19h12"/><circle cx="19" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/>',
    poly: '<circle cx="5" cy="17" r="2"/><circle cx="9" cy="6" r="2"/><circle cx="17" cy="9" r="2"/><circle cx="20" cy="18" r="2"/><path d="M5.6 15l2.4-7M11 6.6l4.2 1.6M17.4 11l2 5M7 17.4l11 .4"/>',
    channel: '<path d="M3 6h14M7 18h14"/><path d="M5 14l14-4" stroke-dasharray="2.5 2.5"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/>',
    brush: '<path d="M4 20c3.5 0 5-1.2 5-4.2l7-7 3.2 3.2-7 7C11 20.3 8 21 4 20z"/><path d="M15 6.2l2.8 2.8M18 3.5l2.5 2.5"/>',
    text: '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
    emoji: '<circle cx="12" cy="12" r="9"/><path d="M8.2 14c1 2.2 6.6 2.2 7.6 0"/><path d="M9 9.6h.01M15 9.6h.01" stroke-width="3"/>',
    measure: '<path d="M3.5 16.5L16.5 3.5l4 4-13 13z"/><path d="M7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2"/>',
    undo: '<path d="M9 6L4 11l5 5"/><path d="M4 11h10a6 6 0 0 1 0 9h-3"/>',
    trash: '<path d="M4 7h16M10 7V4h4v3M6.5 7l1 13h9l1-13"/>',
    zin: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5M11 8v6M8 11h6"/>',
    zout: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5M8 11h6"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
  };
  const TOOLS = [["cursor", "Курсор"], ["line", "Линия тренда"], ["fib", "Уровни Фибоначчи"], ["poly", "Ломаная"], ["channel", "Параллельный канал"], ["brush", "Кисть"], ["text", "Текст"], ["emoji", "Эмодзи"], ["measure", "Линейка"]];
  const EMOJIS = ["🚀", "📈", "📉", "💰", "🔥", "⚠️", "✅", "❌", "🐂", "🐻", "🎯", "💎"];
  function toolsHTML() {
    return `<div class="draw-tb" id="t-tools" role="toolbar" aria-label="Инструменты рисования">
      ${TOOLS.map(([k, n]) => `<button type="button" class="dtb ${T.tool === k ? "on" : ""}" data-tool="${k}" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg></button>`).join("")}
      <span class="dtb-sep"></span>
      ${[["undo", "Отменить (Ctrl+Z)"], ["trash", "Удалить выбранное или все рисунки"], ["zin", "Приблизить"], ["zout", "Отдалить"], ["fit", "Показать весь график"]].map(([k, n]) => `<button type="button" class="dtb" data-act="${k}" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg></button>`).join("")}
    </div>`;
  }
  function bindTools() {
    const bar = $("#t-tools");
    if (!bar) return;
    bar.onclick = (ev) => {
      const t = ev.target.closest("[data-tool]"), a = ev.target.closest("[data-act]");
      if (t) return setTool(T.tool === t.dataset.tool && t.dataset.tool !== "cursor" ? "cursor" : t.dataset.tool);
      if (!a) return;
      ({ undo: undoDraw, trash: trashDraw, zin: () => zoomBy(1 / 1.5), zout: () => zoomBy(1.5), fit: zoomReset })[a.dataset.act]();
    };
    const emo = $("#t-emo");
    if (emo) emo.onclick = (ev) => { const b = ev.target.closest("[data-emo]"); if (!b) return; T.emoji = b.dataset.emo; emo.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); };
    if (!document.__pdKey) { document.__pdKey = true; document.addEventListener("keydown", onKey); }
  }

  function paintChart() {
    const host = $("#t-chart");
    if (!host) return;
    const a = A[P.sel];
    M = mapChart(a);
    host.innerHTML = chartHTML(a, M);
    host.style.touchAction = T.tool !== "cursor" || M.w.zoomed ? "none" : "pan-y";
    const svg = $("svg", host);
    HV = attachHover(svg, M.g, M.vals, {
      manual: true,
      val: (v, i) => {
        if (!M.cd) return price(a, v);
        const c = M.cd.cs.find((q) => i >= q.i0 && i <= q.i1) || M.cd.cs[M.cd.cs.length - 1];
        const f = (v) => num(v, a.dec);
        return `O ${f(c.o)}  H ${f(c.h)}  L ${f(c.l)}  C ${f(c.c)}`;
      },
      time: (i) => hoverTime(M.nF, M.w.i0 + i)
    });
    renderDrawings();
    bindHost(host);
  }
  // Полная подпись момента для курсора: дата и время (для длинных периодов только дата)
  function hoverTime(n, i) {
    if (P.range === "LIVE") return i === n - 1 ? "сейчас" : `${n - 1 - i} с назад`;
    if (isDaily()) return new Date(Date.now() - (n - 1 - i) * 86400e3).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
    if (P.range === "1Ч") return new Date(Date.now() - (n - 1 - i) * 60e3).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return new Date(Date.now() - (n - 1 - i) * 3600e3).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  // ---------- интерфейс ----------
  const $ = (s, r = document) => r.querySelector(s);
  const badge = (a) => `<span class="abadge c-${a.cls}">${a.sym.length > 4 ? a.sym.slice(0, 4) : a.sym}</span>`;
  // ---------- «Другие перпы» и «Связанные рынки» ----------
  const MK_KEYS = {
    BTC: [[/биткоин|bitcoin/i, 3], [/крипт|стейбл|хешрейт|доминирован/i, 1]],
    ETH: [[/эфир|ethereum/i, 3], [/крипт/i, 1]],
    SOL: [[/solana/i, 3], [/крипт/i, 1]],
    SBER: [[/сбер/i, 3], [/мосбирж|imoex|ключев/i, 2], [/банк россии/i, 1]],
    GAZP: [[/газпром/i, 3], [/мосбирж|imoex/i, 2], [/газ\b|нефт|brent/i, 1]],
    YDEX: [[/яндекс|алис/i, 3], [/мосбирж|imoex/i, 1]],
    LKOH: [[/лукойл/i, 3], [/нефт|brent/i, 2], [/мосбирж|imoex/i, 1]],
    AAPL: [[/apple|iphone|ios/i, 3], [/s&p|акции/i, 1]],
    NVDA: [[/nvidia|nvda/i, 3], [/s&p|капитализац|акции/i, 1]],
    TSLA: [[/tesla/i, 3], [/s&p|акции/i, 1]],
    BRENT: [[/нефт|brent/i, 3]],
    XAU: [[/золот/i, 3]],
    XAG: [[/серебр/i, 3], [/золот/i, 1]],
    NG: [[/газ\b|природн/i, 3], [/нефт|brent/i, 1]],
    WHEAT: [[/пшениц/i, 3]]
  };
  const MK_CATS = { crypto: ["crypto"], stock: ["tech", "world", "russia"], commodity: ["world"] };
  function relatedMarkets(a) {
    if (typeof EVENTS === "undefined") return [];
    const open = EVENTS.filter((e) => !e.resolved);
    const score = (e) => (MK_KEYS[a.sym] || []).reduce((t, [re, w]) => t + (re.test(e.q) ? w : 0), 0);
    const hits = open.map((e) => [e, score(e)]).filter(([, sc]) => sc > 0).sort((x, y) => y[1] - x[1] || y[0].vol - x[0].vol).map(([e]) => e);
    const out = hits.slice(0, 8);
    if (out.length < 4) { // не хватает по ключевым словам: добавляем самые крупные рынки близких категорий
      (MK_CATS[a.cls] || []).forEach((c) => open.filter((e) => e.cat === c && !out.includes(e)).sort((x, y) => y.vol - x.vol).forEach((e) => { if (out.length < 6) out.push(e); }));
    }
    return out;
  }
  function miniSpark(vals, up) {
    const W = 220, H = 84, lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1;
    const d = vals.map((v, i) => (i ? "L" : "M") + ((i * W) / (vals.length - 1)).toFixed(1) + " " + (4 + ((hi - v) * (H - 8)) / sp).toFixed(1)).join("");
    return `<svg class="mc-sp ${up ? "up" : "dn"}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
  }
  const tri = (c) => (c === null ? "" : c >= 0 ? "▲" : "▼");
  function perpCard(x) {
    const c = change24(x), up = c === null ? x.price >= x.hh[x.hh.length - 25] : c >= 0;
    return `<button type="button" class="mc" data-sg="${x.sym}"><span class="mc-top">${badge(x)}</span><b class="mc-t">${x.sym}</b>
      <span class="mc-pr">${price(x, x.price)} <em class="${up ? "pos" : "neg"}">${c === null ? "" : tri(c) + " " + num(Math.abs(c), 2) + "%"}</em></span>${miniSpark(x.hh.slice(-24), up)}</button>`;
  }
  function marketCard(e) {
    const st = typeof CAT_STYLE !== "undefined" && CAT_STYLE[e.cat] ? CAT_STYLE[e.cat] : ["#3b5bdb", "#5f3dc4"];
    const g = typeof GLYPHS !== "undefined" ? GLYPHS[e.img] || GLYPHS.globe : "";
    const d = e.hist[e.hist.length - 1] - e.hist[Math.max(0, e.hist.length - 25)], up = d >= 0;
    const cat = typeof CATEGORIES !== "undefined" ? (CATEGORIES.find((c) => c.id === e.cat) || {}).name || "" : "";
    return `<button type="button" class="mc mk" data-mk="${e.id}"><span class="mc-top"><span class="mk-ic" style="background:linear-gradient(135deg,${st[0]},${st[1]})"><svg viewBox="0 0 64 64" width="26" height="26" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg></span><small class="mk-cat">${esc(cat)}</small></span>
      <b class="mc-q">${esc(e.q)}</b>
      <span class="mc-pr">Да ${num(e.yes, 1)}% <em class="${up ? "pos" : "neg"}">${tri(d)} ${num(Math.abs(d), 1)} п.п.</em></span>${miniSpark(e.hist.slice(-48), up)}</button>`;
  }
  function moreHTML(a) {
    const tab = P.moreTab || "perps";
    // только активы того же класса: у крипты крипта, у акций акции, у сырья сырьё; близкие по теме идут первыми
    const same = ASSETS.filter((x) => x.cls === a.cls && x.sym !== a.sym);
    const rel = (REL[a.sym] || []).map((s) => A[s]).filter((x) => x.cls === a.cls);
    const perps = [...rel, ...same.filter((x) => !rel.includes(x))].slice(0, 8);
    const mk = relatedMarkets(a);
    return `<div class="mc-tabs" role="tablist"><button type="button" role="tab" data-mtab="perps" class="${tab === "perps" ? "on" : ""}">Другие перпы</button><button type="button" role="tab" data-mtab="markets" class="${tab === "markets" ? "on" : ""}">Связанные рынки${mk.length ? ` · ${mk.length}` : ""}</button></div>
      <div class="mc-row">${tab === "perps" ? perps.map(perpCard).join("") : mk.length ? mk.map(marketCard).join("") : '<p class="muted" style="padding:16px 4px">Для этого актива связанных рынков прогнозов пока нет.</p>'}</div>`;
  }
  function paintMore() {
    const el = $("#t-sugg");
    if (!el) return;
    const row = $(".mc-row", el), left = row ? row.scrollLeft : 0;
    el.innerHTML = moreHTML(A[P.sel]);
    const n = $(".mc-row", el);
    if (n) n.scrollLeft = left;
  }
  const shiftOhlc = (a, key) => { const arr = a.ohlcReal && a.ohlcReal[key]; if (arr) { arr.push([a.price, a.price, a.price, a.price]); arr.shift(); } };
  // ---------- обзор: цена, изменение, объём, максимум и минимум за 24 ч, открытый интерес, фандинг ----------
  // Настоящие значения: максимум, минимум и объём у крипты с живой ценой Binance. Остальное считается из графика или смоделировано (помечено «демо»).
  const DEMO_VOL = { BTC: 2.4e10, ETH: 1.1e10, SOL: 3.2e9, SBER: 4.5e9, GAZP: 3e9, YDEX: 1.6e9, LKOH: 1.8e9, AAPL: 6e9, NVDA: 2e10, TSLA: 1.5e10, BRENT: 1.2e10, XAU: 2.8e10, XAG: 4e9, NG: 1.1e9, WHEAT: 5e8 };
  const bigNum = (v, a) => {
    const t = v >= 1e9 ? num(v / 1e9, 2) + " млрд" : v >= 1e6 ? num(v / 1e6, 1) + " млн" : num(v, 0);
    return a.ccy === "₽" ? t + " ₽" : "$" + t;
  };
  function stats24(a) {
    const real = fresh(a) && a.t24 && Date.now() - a.t24.at < 120000 ? a.t24 : null;
    const day = a.hh.slice(-24);
    const hi = Math.max(real ? real.hi : Math.max(...day), a.price), lo = Math.min(real ? real.lo : Math.min(...day), a.price);
    const dayK = 0.85 + 0.3 * mulberry(seedOf(a.sym) + Math.floor(Date.now() / 86400e3))();
    const vol = real ? real.vol : (DEMO_VOL[a.sym] || 1e9) * dayK;
    return {
      hi, lo, vol, oi: (DEMO_VOL[a.sym] || 1e9) * 0.42 * (0.9 + 0.2 * dayK),
      hiReal: !!real || (isRealHistNow(a)), volReal: !!real
    };
  }
  const isRealHistNow = (a) => !!(a.realHist && fresh(a));
  const fundCountdown = () => {
    const left = Math.floor((8 * 3600e3 - (Date.now() % (8 * 3600e3))) / 1000);
    return Math.floor(left / 3600) + ":" + String(Math.floor((left % 3600) / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
  };
  function overviewHTML(a) {
    const st = stats24(a), c = change24(a);
    const demo = '<i class="ov-demo" title="Значение смоделировано: живого источника для него нет">демо</i>';
    const prev = c === null ? null : a.price / (1 + c / 100);
    const chg = c === null ? '<span class="muted">—</span>' : `<span class="${c >= 0 ? "pos" : "neg"}">${sg(a.price - prev, a.dec)}</span> <span class="ov-sl">/</span> <span class="${c >= 0 ? "pos" : "neg"}">${sg(c)}%</span>`;
    const cell = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`;
    return `<h3>Обзор</h3><div class="ov-grid">
      ${cell("Цена", price(a, a.price))}
      ${cell("Изм. 24 ч", chg)}
      ${cell("Объём 24 ч" + (st.volReal ? "" : demo), bigNum(st.vol, a))}
      ${cell("Макс. 24 ч" + (st.hiReal ? "" : demo), price(a, st.hi))}
      ${cell("Мин. 24 ч" + (st.hiReal ? "" : demo), price(a, st.lo))}
      ${cell("Откр. интерес" + demo, bigNum(st.oi, a))}
      ${cell("Фандинг" + demo + ' <span class="ov-sl">/</span> Таймер', `<span class="${a.fund >= 0 ? "pos" : "neg"} ov-fund">${num(a.fund * 100, 4)}%</span> <span class="ov-cd">${fundCountdown()}</span>`)}
    </div>`;
  }
  const paintOverview = () => { const el = $("#t-ov"); if (el && P.sel) el.innerHTML = overviewHTML(A[P.sel]); };
  const chText = (a) => { const c = change24(a); return c === null ? '<span class="muted">—</span>' : `<span class="${c >= 0 ? "pos" : "neg"}">${sg(c)}%</span>`; };

  function listHTML() {
    return ASSETS.filter((a) => a.cls === P.cls).map((a) => `
      <button class="arow ${a.sym === P.sel ? "on" : ""}" data-asset="${a.sym}">
        ${badge(a)}
        <span class="ainfo"><b>${a.sym}-PERP <span data-lv="${a.sym}">${liveBadge(a)}</span></b><small>${esc(a.name)}</small></span>
        <span class="aprice"><b data-pr="${a.sym}">${price(a, a.price)}</b><small data-ch="${a.sym}">${chText(a)}</small></span>
      </button>`).join("");
  }
  function mainHTML() {
    const a = A[P.sel];
    P.lev = clamp(P.lev, 1, a.maxLev);
    const levs = [1, 2, 3, 5, 10, 25, 50, 100].filter((l) => l <= a.maxLev);
    return `
    <div class="panel tchart">
      <div class="th">
        <div class="th-l">
          <div class="th-sym">${badge(a)}<h2>${a.sym}-PERP</h2><span class="tag-cat">${CLS[a.cls]}</span><span id="t-lv">${liveBadge(a)}</span></div>
          <div class="th-name">${esc(a.name)} · бессрочный контракт</div>
        </div>
        <div class="th-r"><b id="t-price">${price(a, a.price)}</b><span id="t-ch">${chText(a)} за 24 ч</span></div>
      </div>
      <div class="rangebar">
        <div class="range" id="t-range">${rangeHTML(a)}</div>
        <div class="range ctype" id="t-ctype" role="group" aria-label="Тип графика">
          <button type="button" data-ct="line" class="${P.ctype === "line" ? "on" : ""}" title="Линия" aria-label="Линия"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-6 4 3 8-9"/></svg></button>
          <button type="button" data-ct="candles" class="${P.ctype === "candles" ? "on" : ""}" title="Японские свечи" aria-label="Японские свечи"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 3v4M7 17v4M17 6v3M17 18v3"/><rect x="4.5" y="7" width="5" height="10" rx="1"/><rect x="14.5" y="9" width="5" height="9" rx="1"/></svg></button>
        </div>
      </div>
      <div class="draw-wrap">
        ${toolsHTML()}
        <div class="draw-main" id="t-drawmain">
          <div class="chart" id="t-chart"></div>
          <div class="draw-emo" id="t-emo" ${T.tool === "emoji" ? "" : "hidden"}>${EMOJIS.map((e) => `<button type="button" data-emo="${e}" class="${e === T.emoji ? "on" : ""}">${e}</button>`).join("")}</div>
        </div>
      </div>
      <div class="draw-hint" id="t-hint">${HINTS[T.tool]}</div>
      <div class="t-stats"><span>Макс. плечо <b>${a.maxLev}x</b></span><span>Комиссия <b>0,05%</b></span></div>
      <div class="t-src" id="t-src">${srcText(a)}</div>
    </div>
    <div class="panel torder">
      <h3>Открыть позицию</h3>
      <div class="seg" id="t-dir">
        <button class="yes ${P.dir === "long" ? "on" : ""}" data-dir="long">Long · рост</button>
        <button class="no ${P.dir === "short" ? "on" : ""}" data-dir="short">Short · падение</button>
      </div>
      <label class="l" for="t-margin">Маржа, ₽</label>
      <input class="field" id="t-margin" type="number" min="1" step="100" value="${P.margin}">
      <div class="chips" id="t-pct" style="margin-top:8px">${[25, 50, 75, 100].map((p) => `<button class="chip" data-pct="${p}">${p === 100 ? "Макс" : p + "%"}</button>`).join("")}</div>
      <label class="l" for="t-lev">Плечо: <b id="t-levv"></b></label>
      <input id="t-lev" class="lev" type="range" min="1" max="${a.maxLev}" step="1" value="${P.lev}">
      <div class="chips" id="t-levchips" style="margin-top:8px">${levs.map((l) => `<button class="chip" data-lev="${l}">${l === 1 ? "Без плеча" : l + "x"}</button>`).join("")}</div>
      <div class="tpsl">
        <label class="l" for="t-tp">Тейк-профит, цена <span class="opt">необязательно</span></label>
        <input class="field" id="t-tp" type="text" inputmode="decimal" placeholder="Закрыть с прибылью по цене" value="${esc(P.tp)}">
        <div class="chips" id="t-tpchips" style="margin-top:8px">${[25, 50, 100].map((r) => `<button class="chip" data-roe="${r}">+${r}%</button>`).join("")}<span class="chip-note">от маржи</span></div>
        <label class="l" for="t-sl">Стоп-лосс, цена <span class="opt">необязательно</span></label>
        <input class="field" id="t-sl" type="text" inputmode="decimal" placeholder="Закрыть с убытком по цене" value="${esc(P.sl)}">
        <div class="chips" id="t-slchips" style="margin-top:8px">${[10, 25, 50].map((r) => `<button class="chip" data-roe="${r}">−${r}%</button>`).join("")}<span class="chip-note">от маржи</span></div>
      </div>
      <div class="impact" id="t-sum"></div>
      <button class="submit" id="t-open"></button>
      <div class="msg" id="t-msg"></div>
      <p class="fee-note warn" id="t-warn" hidden></p>
      <p class="fee-note">Плечо увеличивает и прибыль, и убыток. Если цена дойдёт до цены ликвидации, вся маржа сгорает. Без плеча (1x) ликвидация почти невозможна.</p>
    </div>
`;
  }
  // Обзор, «Другие перпы» и чат — на всю ширину страницы, под графиком и формой позиции
  function wideHTML(a) {
    return `<div class="panel ov" id="t-ov">${overviewHTML(a)}</div>
    <div class="panel tmore" id="t-sugg">${moreHTML(a)}</div>
    <div class="panel tchat" id="t-chat"></div>`;
  }
  function paintSummary() {
    const a = A[P.sel];
    if (!$("#t-sum")) return;
    const m = Math.floor(Number($("#t-margin").value)) || 0, notional = m * P.lev, fee = notional * FEE;
    $("#t-levv").textContent = P.lev === 1 ? "без плеча (1x)" : P.lev + "x";
    $("#t-lev").value = P.lev;
    document.querySelectorAll("#t-levchips .chip").forEach((c) => c.classList.toggle("on", Number(c.dataset.lev) === P.lev));
    document.querySelectorAll("#t-dir button").forEach((b) => b.classList.toggle("on", b.dataset.dir === P.dir));
    const liq = liqPrice(a.price, P.lev, P.dir);
    const tp = parseP($("#t-tp").value), sl = parseP($("#t-sl").value);
    const line = (label, v, cls) => (v ? `<div><span>${label}</span><b class="${cls}">${sg(estResult(P.dir, a.price, notional, v), 0)} ₽</b></div>` : "");
    const okTp = tp && !Number.isNaN(tp) && (P.dir === "long" ? tp > a.price : tp < a.price);
    const okSl = sl && !Number.isNaN(sl) && (P.dir === "long" ? sl < a.price && sl > liq : sl > a.price && sl < liq);
    const tpLine = okTp ? line("Итог при тейк-профите", tp, "pos") : "";
    const slLine = okSl ? line("Итог при стоп-лоссе", sl, "neg") : "";
    const w = $("#t-warn");
    w.hidden = P.lev < 25;
    w.textContent = P.lev >= 25 ? `Высокое плечо ${P.lev}x: движение цены всего на ${num(Math.abs(liq / a.price - 1) * 100, 2)}% против вас сожжёт всю маржу. Комиссия за открытие уже составляет ${num(P.lev * FEE * 100, 1)}% от маржи.` : "";
    const btn = $("#t-open");
    btn.className = "submit " + (P.dir === "long" ? "long" : "short");
    btn.textContent = P.dir === "long" ? `Открыть Long ${a.sym}` : `Открыть Short ${a.sym}`;
    $("#t-sum").innerHTML = m > 0
      ? `<div><span>Размер позиции</span><b>${RP.rub(notional)}</b></div>
         <div><span>Цена входа (рыночная)</span><b>${price(a, a.price)}</b></div>
         <div><span>Цена ликвидации</span><b>${price(a, liqPrice(a.price, P.lev, P.dir))}</b></div>
         <div><span>До ликвидации</span><b class="${P.lev >= 25 ? "neg" : ""}">${num(Math.abs(liqPrice(a.price, P.lev, P.dir) / a.price - 1) * 100, 2)}% от цены</b></div>
         <div><span>Комиссия 0,05%</span><b>${fee2(fee)}</b></div>
         ${tpLine}${slLine}
         <div><span>Доступно</span><b>${RP.rub(RP.getBalance())}</b></div>`
      : "";
  }

  const tpslCell = (a, pos) => (pos.tp || pos.sl ? `${pos.tp ? `<span class="pos">TP ${price(a, pos.tp)}</span>` : ""}${pos.sl ? `<span class="neg">SL ${price(a, pos.sl)}</span>` : ""}` : '<span class="muted">—</span>');
  function posRowHTML(pos) {
    const a = A[pos.sym], s = stats(pos, a.price);
    return `<tr data-pid="${pos.id}">
      <td><span class="who">${badge(a)}<span><b>${pos.sym}-PERP</b><br>${sideTag(pos)}</span></span></td>
      <td>${RP.rub(pos.notional)}<small>маржа ${RP.rub(pos.margin)}</small></td>
      <td>${price(a, pos.entry)}</td>
      <td class="pp-cur">${price(a, a.price)}</td>
      <td>${price(a, pos.liq)}</td>
      <td class="pp-tpsl">${tpslCell(a, pos)}</td>
      <td class="pp-pnl ${s.result >= 0 ? "pos" : "neg"}">${sg(s.result, 0)} ₽<small>${sg(s.roe, 1)}%</small></td>
      <td><span class="pbtns"><button class="sbtn small" data-edit="${pos.id}">TP/SL</button><button class="sell" data-close="${pos.id}">Закрыть</button></span></td>
    </tr>`;
  }
  function paintPositions() {
    const box = $("#t-pos");
    if (!box) return;
    box.innerHTML = positions.length
      ? `<div class="table-wrap" style="margin:0"><table class="ptable"><thead><tr><th>Контракт</th><th>Размер</th><th>Вход</th><th>Сейчас</th><th>Ликвидация</th><th>TP / SL</th><th>PnL</th><th></th></tr></thead><tbody>${positions.slice().reverse().map(posRowHTML).join("")}</tbody></table></div>`
      : `<p class="empty" style="padding:18px">Открытых позиций нет. Выберите актив и откройте Long или Short.</p>`;
    const h = $("#t-hist");
    h.innerHTML = closed.length
      ? `<div class="table-wrap" style="margin:0"><table class="ptable"><thead><tr><th>Контракт</th><th>Сторона</th><th>Вход → выход</th><th>Итог</th><th>Когда</th></tr></thead><tbody>${closed.slice(-10).reverse().map((c) => {
          const a = A[c.sym], d = new Date(c.ts);
          return `<tr><td><b>${c.sym}-PERP</b></td><td><span class="tag ${c.dir === "long" ? "yes" : "no"}">${c.dir === "long" ? "Long" : "Short"} ${c.lev === 1 ? "без плеча" : c.lev + "x"}</span>${KIND[c.kind] ? ` <span class="tag ${KIND[c.kind][1]}">${KIND[c.kind][0]}</span>` : ""}</td><td>${price(a, c.entry)} → ${price(a, c.exit)}</td><td class="${c.pnl >= 0 ? "pos" : "neg"}">${sg(c.pnl, 0)} ₽</td><td>${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</td></tr>`;
        }).join("")}</tbody></table></div>`
      : `<p class="empty" style="padding:18px">Закрытых сделок пока нет.</p>`;
  }

  function view() {
    // скрытые в настройках классы не показываем
    const clsList = Object.entries(CLS).filter(([id]) => RP.clsOn(id));
    if (!RP.clsOn(P.cls)) { P.cls = clsList[0][0]; P.sel = ASSETS.find((x) => x.cls === P.cls).sym; }
    return `<div class="wrap">
      <h1 class="page-title">Перпы</h1>
      <p class="page-sub">Бессрочные контракты на крипту, акции и сырьё. Торгуйте без плеча или с плечом, в рост (Long) и в падение (Short). Демо: игровые рубли. Цены живые там, где виден бейдж Live, остальные симулируются.</p>
      <div class="trade">
        <aside class="panel assets">
          <div class="tabs" id="t-tabs" style="padding:0 0 10px">${clsList.map(([id, n]) => `<button class="tab ${id === P.cls ? "active" : ""}" data-tcls="${id}">${n}</button>`).join("")}</div>
          <div id="t-list" class="alist">${listHTML()}</div>
        </aside>
        <section class="tmain" id="t-main">${mainHTML()}</section>
      </div>
      <div class="twide" id="t-wide">${wideHTML(A[P.sel])}</div>
      <div class="panel" style="margin:16px 0 40px">
        <h3>Открытые позиции</h3>
        <div id="t-pos"></div>
        <h3 style="margin-top:22px">Последние сделки</h3>
        <div id="t-hist"></div>
      </div>
      <details class="panel" id="t-feeds" style="margin:0 0 40px">
        <summary style="cursor:pointer;font-weight:700">Статус источников цен</summary>
        <div id="t-feedbody" style="margin-top:12px"></div>
      </details>
    </div>`;
  }

  function bind() {
    const root = $("#view");
    const rebuildMain = () => { P.tp = ""; P.sl = ""; $("#t-main").innerHTML = mainHTML(); $("#t-wide").innerHTML = wideHTML(A[P.sel]); bindMain(); paintChart(); paintSummary(); };
    $("#t-tabs").onclick = (ev) => {
      const b = ev.target.closest("[data-tcls]");
      if (!b) return;
      P.cls = b.dataset.tcls;
      document.querySelectorAll("#t-tabs .tab").forEach((t) => t.classList.toggle("active", t === b));
      const first = ASSETS.find((a) => a.cls === P.cls);
      if (A[P.sel].cls !== P.cls) P.sel = first.sym;
      $("#t-list").innerHTML = listHTML();
      rebuildMain();
    };
    $("#t-list").onclick = (ev) => {
      const b = ev.target.closest("[data-asset]");
      if (!b) return;
      P.sel = b.dataset.asset;
      document.querySelectorAll(".arow").forEach((r) => r.classList.toggle("on", r === b));
      rebuildMain();
    };
    $("#t-pos").onclick = (ev) => {
      const c = ev.target.closest("[data-close]");
      if (c) return confirmClose(c.dataset.close);
      const e = ev.target.closest("[data-edit]");
      if (e) openEdit(e.dataset.edit);
    };
    function bindMain() {
      bindTools();
      $("#t-ctype").onclick = (ev) => {
        const b = ev.target.closest("[data-ct]");
        if (!b || b.dataset.ct === P.ctype) return;
        P.ctype = b.dataset.ct;
        RP.store.set("pctype", P.ctype);
        document.querySelectorAll("#t-ctype button").forEach((x) => x.classList.toggle("on", x === b));
        paintChart();
      };
      $("#t-range").onclick = (ev) => {
        const b = ev.target.closest("[data-range]");
        if (!b) return;
        P.range = b.dataset.range;
        $("#t-src").textContent = srcText(A[P.sel]);
        document.querySelectorAll("#t-range button").forEach((x) => x.classList.toggle("on", x === b));
        paintChart();
      };
      $("#t-dir").onclick = (ev) => { const b = ev.target.closest("[data-dir]"); if (b) { P.dir = b.dataset.dir; paintSummary(); } };
      $("#t-margin").oninput = (ev) => { P.margin = Number(ev.target.value) || 0; paintSummary(); };
      $("#t-pct").onclick = (ev) => {
        const b = ev.target.closest("[data-pct]");
        if (!b) return;
        P.margin = Math.floor((maxMargin() * Number(b.dataset.pct)) / 100);
        $("#t-margin").value = P.margin;
        paintSummary();
      };
      $("#t-lev").oninput = (ev) => { P.lev = Number(ev.target.value); paintSummary(); };
      $("#t-levchips").onclick = (ev) => { const b = ev.target.closest("[data-lev]"); if (b) { P.lev = Number(b.dataset.lev); paintSummary(); } };
      $("#t-tp").oninput = (ev) => { P.tp = ev.target.value; paintSummary(); };
      $("#t-sl").oninput = (ev) => { P.sl = ev.target.value; paintSummary(); };
      const roeChips = (id, field, sign) => {
        $(id).onclick = (ev) => {
          const b = ev.target.closest("[data-roe]");
          if (!b) return;
          const a = A[P.sel], v = priceFromRoe(a, P.dir, P.lev, a.price, sign * Number(b.dataset.roe));
          P[field] = fmtIn(a, v);
          $("#t-" + field).value = P[field];
          paintSummary();
        };
      };
      roeChips("#t-tpchips", "tp", 1);
      roeChips("#t-slchips", "sl", -1);
      $("#t-chat").innerHTML = RP.chatHTML("t-" + P.sel);
      RP.chatBind($("#t-chat"), "t-" + P.sel);
      $("#t-open").onclick = confirmOpen;
      $("#t-sugg").onclick = (ev) => {
        const tabBtn = ev.target.closest("[data-mtab]");
        if (tabBtn) { P.moreTab = tabBtn.dataset.mtab; return paintMore(); }
        const mk = ev.target.closest("[data-mk]");
        if (mk) return RP.openMarket(Number(mk.dataset.mk));
        const b = ev.target.closest("[data-sg]");
        if (!b) return;
        P.sel = b.dataset.sg;
        P.cls = A[P.sel].cls;
        document.querySelectorAll("#t-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.tcls === P.cls));
        $("#t-list").innerHTML = listHTML();
        rebuildMain();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }
    bindMain();
    paintChart();
    paintSummary();
    paintPositions();
    $("#t-feeds").ontoggle = paintFeeds;
  }

  // ---------- обновление цен ----------
  function tick() {
    if (!ready) return;
    if (!$("#confirm").hidden) return; // цены стоят, пока открыто подтверждение
    ASSETS.forEach((a) => {
      if (a.isLive && !fresh(a)) a.isLive = false; // источник замолчал: возвращаемся к симуляции
      if (!a.isLive) {
        const pull = ((a.base - a.price) / a.base) * 0.0005; // слабая тяга к базовой цене
        a.price = a.price * Math.exp(a.sig * gauss() + pull);
      }
      a.live.push(a.price);
      if (a.live.length > 120) a.live.shift();
      a.hh[a.hh.length - 1] = a.price;
      a.dd[a.dd.length - 1] = a.price;
      a.mm[a.mm.length - 1] = a.price;
      if (a.ohlcReal) Object.values(a.ohlcReal).forEach((arr) => { const L = arr[arr.length - 1]; L[3] = a.price; if (a.price > L[1]) L[1] = a.price; if (a.price < L[2]) L[2] = a.price; });
    });
    if (++ticks % 3600 === 0) { // раз в час сдвигаем часовой график
      ASSETS.forEach((a) => { a.hh.push(a.price); a.hh.shift(); shiftOhlc(a, "hh"); });
    }
    if (ticks % 60 === 0) ASSETS.forEach((a) => { a.mm.push(a.price); a.mm.shift(); shiftOhlc(a, "mm"); });
    if (ticks % 86400 === 0) ASSETS.forEach((a) => { a.dd.push(a.price); a.dd.shift(); shiftOhlc(a, "dd"); });
    if (ticks % 5 === 0) savePrices();
    if (ticks % 3 === 0) paintFeeds();
    checkLiquidations();
    checkTpSl();
    if (RP.route() !== "trade" || !$("#t-main")) return;
    ASSETS.forEach((a) => {
      const p = $(`[data-pr="${a.sym}"]`), c = $(`[data-ch="${a.sym}"]`);
      if (p) p.textContent = price(a, a.price);
      if (c) c.innerHTML = chText(a);
    });
    ASSETS.forEach((x) => {
      const b = $(`[data-lv="${x.sym}"]`); if (b) b.innerHTML = liveBadge(x);
      const sp = $(`[data-sp="${x.sym}"]`), sc = $(`[data-sc="${x.sym}"]`);
      if (sp) sp.textContent = price(x, x.price);
      if (sc) sc.innerHTML = chText(x);
    });
    const a = A[P.sel];
    $("#t-lv").innerHTML = liveBadge(a);
    $("#t-src").textContent = srcText(a);
    const rk = rangesFor(a).join();
    if ($("#t-range").dataset.k !== rk) { $("#t-range").dataset.k = rk; $("#t-range").innerHTML = rangeHTML(a); }
    $("#t-price").textContent = price(a, a.price);
    $("#t-ch").innerHTML = chText(a) + " за 24 ч";
    paintOverview();
    if (ticks % 5 === 0) paintMore();
    if (!chartHover && !T.busy && !T.textOpen) paintChart();
    paintSummary();
    positions.forEach((pos) => {
      const row = $(`tr[data-pid="${pos.id}"]`);
      if (!row) return;
      const pa = A[pos.sym], s = stats(pos, pa.price);
      $(".pp-cur", row).textContent = price(pa, pa.price);
      const cell = $(".pp-pnl", row);
      cell.className = "pp-pnl " + (s.result >= 0 ? "pos" : "neg");
      cell.innerHTML = `${sg(s.result, 0)} ₽<small>${sg(s.roe, 1)}%</small>`;
    });
  }

  // блок для главной страницы
  function promo() {
    const pick = ["BTC", "NVDA", "SBER", "XAU"].map((s) => A[s]);
    return `<div class="promo-trade">
      <div class="pt-text">
        <h2>Перпы с плечом и без</h2>
        <p>Бессрочные контракты на крипту, акции и сырьё. Long и Short, плечо до 100x, комиссия 0,05%.</p>
        <a class="cta primary" href="#trade">Открыть терминал</a>
      </div>
      <div class="pt-tiles">${pick.map((a) => `<a class="pt-tile" href="#trade" data-goasset="${a.sym}">${badge(a)}<b>${a.sym}-PERP</b><span>${price(a, a.price)}</span><small>${chText(a)}</small></a>`).join("")}</div>
    </div>`;
  }
  function select(sym) { if (A[sym]) { P.sel = sym; P.cls = A[sym].cls; } }

  const realized = () => closed.reduce((s, c) => s + c.pnl, 0);
  const closedMargin = () => closed.reduce((s, c) => s + c.margin, 0);
  const count = () => closed.length + positions.length;
  // Маржа в открытых позициях (деньги, которые сейчас «в игре» в перпах).
  const locked = () => positions.reduce((s, p) => s + p.margin, 0);
  function reset() { positions = []; closed = []; plog = []; persist(); }
  // Все сделки в виде строк для истории аккаунта.
  function rows() {
    return plog.map((x) => {
      const a = A[x.sym], side = `${x.dir === "long" ? "Long" : "Short"} ${levTxt(x.lev)}`;
      const action = { open: "Открытие", close: "Закрытие", tp: "Тейк-профит", sl: "Стоп-лосс", liq: "Ликвидация" }[x.kind] + " · " + side;
      return { t: x.t, sec: "perp", title: x.sym + "-PERP", action, cls: x.kind === "open" ? (x.dir === "long" ? "yes" : "no") : (x.pnl >= 0 ? "yes" : "no"), amt: x.amt, priceText: price(a, x.price), pnl: x.kind === "open" ? null : x.pnl };
    });
  }

  return { init, view, bind, tick, promo, select, realized, closedMargin, count, locked, reset, rows };
})();

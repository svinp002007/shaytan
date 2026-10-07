// Трейдинг: бессрочные контракты (perps) на крипту, акции и сырьё. Демо на игровые рубли.
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
  // Откуда берутся живые цены. Нет источника или ключа: актив остаётся на симуляции.
  const SRC = {
    BTC: { bn: "BTCUSDT", cb: "BTC-USD" }, ETH: { bn: "ETHUSDT", cb: "ETH-USD" }, SOL: { bn: "SOLUSDT", cb: "SOL-USD" },
    SBER: { moex: "SBER" }, GAZP: { moex: "GAZP" }, YDEX: { moex: "YDEX" }, LKOH: { moex: "LKOH" },
    AAPL: { fh: "AAPL" }, NVDA: { fh: "NVDA" }, TSLA: { fh: "TSLA" },
    XAU: { td: "XAU/USD" }, XAG: { td: "XAG/USD" }
  };
  const SRC_NAME = { bn: "Binance, обновление каждые 2 с", cb: "Coinbase, обновление каждые 2 с", moex: "Мосбиржа (ISS), бесплатные данные с задержкой ~15 мин", fh: "Finnhub, обновление каждые 15 с", td: "Twelve Data, обновление раз в минуту" };
  const SRC_TTL = { bn: 15000, cb: 15000, moex: 45000, fh: 60000, td: 180000 }; // через сколько цена считается устаревшей
  const P = { sel: "BTC", cls: "crypto", range: "LIVE", dir: "long", lev: 1, margin: 1000, tp: "", sl: "" };
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
      const lv = [a.price];
      for (let i = 1; i < 90; i++) lv.unshift(lv[0] * Math.exp(-a.sig * gauss(r)));
      a.live = lv;
    });
    positions = RP.store.get("ppos", []);
    closed = RP.store.get("pclosed", []);
    plog = RP.store.get("plog", []);
    ready = true;
    checkLiquidations();
    startFeeds();
  }
  const change24 = (a) => (a.isLive && typeof a.liveChange === "number" ? a.liveChange : (a.price / a.hh[a.hh.length - 25] - 1) * 100);
  const savePrices = () => RP.store.set("prices", Object.fromEntries(ASSETS.map((a) => [a.sym, a.price])));

  // ---------- живые цены ----------
  const fresh = (a) => a.isLive && Date.now() - a.lastReal < (SRC_TTL[a.srcKey] || 45000);
  function adopt(a, p) {
    // Первая настоящая цена: подгоняем симулированную историю и открытые позиции, чтобы PnL в процентах не менялся.
    const ratio = p / a.price;
    positions.forEach((pos) => {
      if (pos.sym === a.sym) ["entry", "liq", "tp", "sl"].forEach((k) => { if (pos[k]) pos[k] *= ratio; });
    });
    a.hh = a.hh.map((v) => v * ratio);
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
    a.srcKey = srcKey;
    a.lastReal = Date.now();
    if (Number.isFinite(ch)) a.liveChange = ch;
    if (!a.adopted) adopt(a, p);
    else a.price = p;
    a.isLive = true;
  }
  async function getJSON(url, ms = 6000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  // Повторяет запрос по расписанию; при ошибках делает паузы длиннее (до минуты).
  function schedule(fn, every) {
    let fails = 0;
    const run = async () => {
      try { await fn(); fails = 0; } catch { fails++; }
      setTimeout(run, fails ? Math.min(60000, every * 2 ** Math.min(fails, 4)) : every);
    };
    run();
  }
  async function loadKlines(a) {
    try {
      const k = await getJSON(`https://api.binance.com/api/v3/klines?symbol=${SRC[a.sym].bn}&interval=1h&limit=168`);
      const closes = k.map((x) => Number(x[4])).filter((v) => v > 0);
      if (closes.length < 30) return;
      while (closes.length < 168) closes.unshift(closes[0]);
      closes[167] = a.price;
      a.hh = closes;
      a.realHist = true;
    } catch {}
  }
  async function pollCrypto() {
    const list = ASSETS.filter((a) => SRC[a.sym] && SRC[a.sym].bn);
    try {
      const syms = encodeURIComponent(JSON.stringify(list.map((a) => SRC[a.sym].bn)));
      const data = await getJSON(`https://api.binance.com/api/v3/ticker/24hr?symbols=${syms}`);
      data.forEach((d) => {
        const a = list.find((x) => SRC[x.sym].bn === d.symbol);
        if (!a) return;
        const first = !a.adopted;
        setReal(a.sym, Number(d.lastPrice), Number(d.priceChangePercent), "bn");
        if (first && a.adopted) loadKlines(a);
      });
      return;
    } catch {}
    // запасной источник
    let ok = 0;
    await Promise.all(list.map(async (a) => {
      try {
        const d = await getJSON(`https://api.coinbase.com/v2/prices/${SRC[a.sym].cb}/spot`);
        setReal(a.sym, Number(d.data.amount), NaN, "cb");
        ok++;
      } catch {}
    }));
    if (!ok) throw new Error("crypto feed unavailable");
  }
  async function pollMoex() {
    const ids = ASSETS.filter((a) => SRC[a.sym] && SRC[a.sym].moex).map((a) => SRC[a.sym].moex);
    const d = await getJSON(`https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities.json?iss.meta=off&iss.only=marketdata&marketdata.columns=SECID,LAST,LASTTOPREVPRICE&securities=${ids.join(",")}`);
    const cols = d.marketdata.columns, iS = cols.indexOf("SECID"), iL = cols.indexOf("LAST"), iC = cols.indexOf("LASTTOPREVPRICE");
    d.marketdata.data.forEach((r) => {
      const a = ASSETS.find((x) => SRC[x.sym] && SRC[x.sym].moex === r[iS]);
      if (a && r[iL] > 0) setReal(a.sym, Number(r[iL]), r[iC] === null ? NaN : Number(r[iC]), "moex");
    });
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
  function startFeeds() {
    if (typeof fetch !== "function") return;
    const keys = typeof LIVE_KEYS !== "undefined" ? LIVE_KEYS : {};
    schedule(pollCrypto, 2000);
    schedule(pollMoex, 10000);
    if (keys.finnhub) schedule(() => pollFinnhub(keys.finnhub), 15000);
    if (keys.twelvedata) schedule(() => pollTwelve(keys.twelvedata), 60000);
  }
  const liveBadge = (a) => (fresh(a) ? '<span class="lv on">Live</span>' : '<span class="lv">Демо</span>');
  const srcText = (a) => (fresh(a) ? "Источник цены: " + SRC_NAME[a.srcKey] : "Источник цены: симуляция (живой источник недоступен или не подключён)");
  const rangesFor = (a) => (fresh(a) && !a.realHist ? ["LIVE"] : ["LIVE", "1Д", "1Н"]);
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
    return P.range === "1Д" ? a.hh.slice(-24) : a.hh;
  }
  function labelAt(n, i) {
    if (P.range === "LIVE") return i === n - 1 ? "сейчас" : `−${n - 1 - i} с`;
    const d = new Date(Date.now() - (n - 1 - i) * 3600e3);
    return P.range === "1Д"
      ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }
  function pgeom(vals, a) {
    const W = 560, H = 380, L = 64, R = 10, T = 12, B = 24, n = vals.length;
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.12 || hi * 0.001;
    lo -= pad; hi += pad;
    return { W, H, L, R, T, B, n, lo, hi, x: (i) => L + (i * (W - L - R)) / (n - 1), y: (v) => T + ((hi - v) * (H - T - B)) / (hi - lo) };
  }
  function chartHTML(a) {
    const vals = seriesFor(a), g = pgeom(vals, a), n = vals.length;
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
      .map(([i, an]) => `<text class="tx" x="${g.x(i).toFixed(1)}" y="${g.H - 6}" text-anchor="${an}">${labelAt(n, i)}</text>`).join("");
    // линии входа и ликвидации открытых позиций по этому активу
    const marks = positions.filter((p) => p.sym === a.sym).map((p) => {
      const mk = (v, cls, txt) => (v > g.lo && v < g.hi ? `<line class="${cls}" x1="${g.L}" x2="${g.W - g.R}" y1="${g.y(v).toFixed(1)}" y2="${g.y(v).toFixed(1)}"/><text class="mk ${cls}" x="${g.W - g.R - 4}" y="${(g.y(v) - 4).toFixed(1)}" text-anchor="end">${txt}</text>` : "");
      return mk(p.entry, "m-entry", "вход") + mk(p.liq, "m-liq", "ликвидация") + (p.tp ? mk(p.tp, "m-tp", "тейк") : "") + (p.sl ? mk(p.sl, "m-sl", "стоп") : "");
    }).join("");
    return `<svg viewBox="0 0 ${g.W} ${g.H}" class="chart-svg ${up ? "up" : "down"}" role="img" aria-label="График цены ${a.sym}">
      ${ticks}${xl}${marks}
      <path class="ca" d="${line}L${g.x(n - 1).toFixed(1)} ${base}L${g.L} ${base}Z"/>
      <path class="cl" d="${line}"/>
      <line class="cross" y1="${g.T}" y2="${base}" hidden/><circle class="dot" r="4.5" hidden/><text class="tip" hidden></text>
    </svg>`;
  }
  function paintChart() {
    const host = $("#t-chart");
    if (!host) return;
    const a = A[P.sel];
    host.innerHTML = chartHTML(a);
    const svg = $("svg", host), vals = seriesFor(a), g = pgeom(vals, a);
    const cross = $(".cross", svg), dot = $(".dot", svg), tip = $(".tip", svg);
    const show = (on) => [cross, dot, tip].forEach((el) => (el.hidden = !on));
    svg.onpointerenter = () => (chartHover = true);
    svg.onpointerleave = () => { chartHover = false; show(false); };
    svg.onpointermove = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * g.W;
      const i = clamp(Math.round(((px - g.L) / (g.W - g.L - g.R)) * (g.n - 1)), 0, g.n - 1);
      const x = g.x(i), y = g.y(vals[i]);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      dot.setAttribute("cx", x); dot.setAttribute("cy", y);
      tip.textContent = `${price(a, vals[i])} · ${labelAt(g.n, i)}`;
      tip.setAttribute("x", clamp(x, 90, g.W - 90)); tip.setAttribute("y", Math.max(y - 10, g.T + 10));
      tip.setAttribute("text-anchor", "middle");
      show(true);
    };
  }

  // ---------- интерфейс ----------
  const $ = (s, r = document) => r.querySelector(s);
  const badge = (a) => `<span class="abadge c-${a.cls}">${a.sym.length > 4 ? a.sym.slice(0, 4) : a.sym}</span>`;
  const chText = (a) => { const c = change24(a); return `<span class="${c >= 0 ? "pos" : "neg"}">${sg(c)}%</span>`; };

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
      <div class="range" id="t-range">${rangeHTML(a)}</div>
      <div class="chart" id="t-chart"></div>
      <div class="t-stats"><span>Макс. плечо <b>${a.maxLev}x</b></span><span>Комиссия <b>0,05%</b></span><span>Фандинг <b>${num(a.fund * 100, 3)}% / 8 ч</b></span></div>
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
    </div>`;
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
    return `<div class="wrap">
      <h1 class="page-title">Трейдинг</h1>
      <p class="page-sub">Бессрочные контракты на крипту, акции и сырьё. Торгуйте без плеча или с плечом, в рост (Long) и в падение (Short). Демо: игровые рубли. Цены живые там, где виден бейдж Live, остальные симулируются.</p>
      <div class="trade">
        <aside class="panel assets">
          <div class="tabs" id="t-tabs" style="padding:0 0 10px">${Object.entries(CLS).map(([id, n]) => `<button class="tab ${id === P.cls ? "active" : ""}" data-tcls="${id}">${n}</button>`).join("")}</div>
          <div id="t-list" class="alist">${listHTML()}</div>
        </aside>
        <section class="tmain" id="t-main">${mainHTML()}</section>
      </div>
      <div class="panel" style="margin:16px 0 40px">
        <h3>Открытые позиции</h3>
        <div id="t-pos"></div>
        <h3 style="margin-top:22px">Последние сделки</h3>
        <div id="t-hist"></div>
      </div>
    </div>`;
  }

  function bind() {
    const root = $("#view");
    const rebuildMain = () => { P.tp = ""; P.sl = ""; $("#t-main").innerHTML = mainHTML(); bindMain(); paintChart(); paintSummary(); };
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
      $("#t-range").onclick = (ev) => {
        const b = ev.target.closest("[data-range]");
        if (!b) return;
        P.range = b.dataset.range;
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
      $("#t-open").onclick = confirmOpen;
    }
    bindMain();
    paintChart();
    paintSummary();
    paintPositions();
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
    });
    if (++ticks % 3600 === 0) { // раз в час сдвигаем часовой график
      ASSETS.forEach((a) => { a.hh.push(a.price); a.hh.shift(); });
    }
    if (ticks % 5 === 0) savePrices();
    checkLiquidations();
    checkTpSl();
    if (RP.route() !== "trade" || !$("#t-main")) return;
    ASSETS.forEach((a) => {
      const p = $(`[data-pr="${a.sym}"]`), c = $(`[data-ch="${a.sym}"]`);
      if (p) p.textContent = price(a, a.price);
      if (c) c.innerHTML = chText(a);
    });
    ASSETS.forEach((x) => { const b = $(`[data-lv="${x.sym}"]`); if (b) b.innerHTML = liveBadge(x); });
    const a = A[P.sel];
    $("#t-lv").innerHTML = liveBadge(a);
    $("#t-src").textContent = srcText(a);
    const rk = rangesFor(a).join();
    if ($("#t-range").dataset.k !== rk) { $("#t-range").dataset.k = rk; $("#t-range").innerHTML = rangeHTML(a); }
    $("#t-price").textContent = price(a, a.price);
    $("#t-ch").innerHTML = chText(a) + " за 24 ч";
    if (!chartHover) paintChart();
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
        <h2>Трейдинг с плечом и без</h2>
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
  function reset() { positions = []; closed = []; plog = []; persist(); }
  // Все сделки в виде строк для истории аккаунта.
  function rows() {
    return plog.map((x) => {
      const a = A[x.sym], side = `${x.dir === "long" ? "Long" : "Short"} ${levTxt(x.lev)}`;
      const action = { open: "Открытие", close: "Закрытие", tp: "Тейк-профит", sl: "Стоп-лосс", liq: "Ликвидация" }[x.kind] + " · " + side;
      return { t: x.t, sec: "perp", title: x.sym + "-PERP", action, cls: x.kind === "open" ? (x.dir === "long" ? "yes" : "no") : (x.pnl >= 0 ? "yes" : "no"), amt: x.amt, priceText: price(a, x.price), pnl: x.kind === "open" ? null : x.pnl };
    });
  }

  return { init, view, bind, tick, promo, select, realized, closedMargin, count, reset, rows };
})();

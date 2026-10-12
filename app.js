(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const COLORS = ["#1d4ed8", "#d52b1e", "#15803d", "#b45309", "#7c3aed", "#0e7490"];
  const DEFAULT_PROFILE = { nick: "Гость", city: "", bio: "", color: COLORS[0], fav: "all" };
  const FEE = 0.02; // комиссия за продажу позиции
  const WIN_FEE = 0.02; // комиссия платформы с выигрыша: 2% от (выплата минус ставка)
  const HOURS = 720; // история цены: 30 дней по часам
  const RANGES = { "1Ч": 60, "1Д": 24, "1Н": 168, "1М": 720 }; // 1Ч — 60 минутных точек, остальные почасовые
  const state = { cat: "all", q: "", sort: "volume", route: "home" };
  let modalEvent = null; // рынок, открытый в окне
  let modalRange = "1Н";

  // ---------- хранилище (localStorage может быть недоступен) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("rp_" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("rp_" + k, JSON.stringify(v)); } catch {} }
  };
  let profile = { ...DEFAULT_PROFILE, ...store.get("profile", {}) };
  // Настройки: оформление (dark | light | system) и скрытые категории рынков и классов перпов
  let settings = { theme: "dark", hiddenCats: [], hiddenCls: [], hiddenBonus: [], ...store.get("settings", {}) };
  if (!Array.isArray(settings.hiddenBonus)) settings.hiddenBonus = [];
  settings.hiddenCats = []; settings.hiddenCls = []; // скрытие категорий и классов перпов убрано из настроек, прежние значения сбрасываются
  if (!["dark", "light", "system"].includes(settings.theme)) settings.theme = "dark";
  const catOn = (id) => !settings.hiddenCats.includes(id);
  const clsOn = (id) => !settings.hiddenCls.includes(id);
  const bonusOn = (id) => !settings.hiddenBonus.includes(id);
  const syncBonusNav = () => { const n = document.querySelector("#nav [data-r=bonus]"); if (n) n.hidden = !bonusOn("ref") && !bonusOn("liq"); };
  const saveSettings = () => store.set("settings", settings);
  const applyTheme = () => document.documentElement.setAttribute("data-theme", settings.theme);
  applyTheme();
  let balance = Number(store.get("balance", 10000)) || 0;
  let bets = store.get("bets", []);
  let closed = store.get("closed", []);
  bets.forEach((b, i) => { if (!b.id) b.id = b.ts + "-" + i; });
  let resolved = store.get("resolved", {}); // id рынка -> "yes" | "no"
  // Миграция: рынки №75–77 и №83–86 заменены другими. Старые ставки возвращаются, сохранённые итоги и записи сбрасываются.
  (function migrate() {
    if (store.get("mig_cat1", false)) return;
    const reset = [75, 76, 77, 83, 84, 85, 86];
    const refund = bets.filter((b) => reset.includes(b.eid)).reduce((s, b) => s + b.amt, 0);
    bets = bets.filter((b) => !reset.includes(b.eid));
    closed = closed.filter((c) => !reset.includes(c.eid));
    reset.forEach((id) => delete resolved[id]);
    store.set("bets", bets); store.set("closed", closed); store.set("resolved", resolved);
    if (refund) { balance += refund; store.set("balance", balance); }
    try { localStorage.setItem("rp_mig_cat1", "true"); } catch {}
  })();

  let myIdeas = store.get("ideas", []);
  let voted = store.get("voted", []);
  let deposits = store.get("deposits", []); // демо-пополнения: СБП и криптовалюта

  // ---------- утилиты ----------
  const nf = new Intl.NumberFormat("ru-RU");
  const rub = (n) => "₽ " + nf.format(Math.round(n));
  const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + nf.format(Math.abs(Math.round(n)));
  const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " млн" : Math.round(n / 1e3) + " тыс.");
  const catName = (id) => CATEGORIES.find((c) => c.id === id).name;
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const initials = (n) => (n.trim()[0] || "?").toUpperCase() + (n.trim()[1] || "").toUpperCase();
  const avatar = (nick, color, cls = "") => `<span class="avatar ${cls}" style="background:${color}">${esc(initials(nick))}</span>`;
  const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const traderColor = (nick) => COLORS[hash(nick) % COLORS.length];
  const byId = (id) => EVENTS.find((e) => e.id === id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pct1 = (v) => v.toFixed(1).replace(".", ",");

  function setBalance(v) {
    balance = Math.max(0, v);
    store.set("balance", balance);
    paintWallet();
    queueMicrotask(paintWallet); // ставки и позиции обновляются сразу после списания, поэтому повторяем после текущего кода
  }
  // Шапка: «Портфель» — наличные плюс вложенное в пулы и перпы, «Наличные» — свободный баланс.
  function paintWallet() {
    const cash = $("#balance"), port = $("#portfolio");
    if (!cash) return;
    cash.textContent = rub(balance);
    let inPlay = 0;
    try { inPlay = bets.reduce((s, b) => s + b.amt, 0) + PERPS.locked(); } catch {}
    if (port) port.textContent = rub(inPlay);
  }
  setInterval(() => paintWallet(), 1500);
  let toastTimer;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2800);
  }

  // ---------- история цены (демо-данные) ----------
  function mulberry(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function makeHistory(seed, end) {
    const rnd = mulberry(seed * 9301 + 7);
    const start = clamp(end + (rnd() - 0.5) * 36, 4, 96);
    const w = [0];
    for (let i = 1; i < HOURS; i++) w.push(w[i - 1] + (rnd() - 0.5) * 0.9);
    const out = w.map((x, i) => {
      const k = i / (HOURS - 1);
      return clamp(start + (end - start) * k + (x - w[HOURS - 1] * k), 2, 98);
    });
    out[HOURS - 1] = end;
    return out.map((v) => Math.round(v * 10) / 10);
  }
  EVENTS.forEach((e) => { e.hist = makeHistory(e.id, e.yes); });
  // Минутный график за последний час: мост от значения час назад до текущего, шум зависит от рынка и часа (не дрожит при перерисовке).
  function minuteSeries(e) {
    const rnd = mulberry(e.id * 7919 + Math.floor(Date.now() / 3600e3)), n = 60;
    const a0 = e.hist[e.hist.length - 2], b0 = e.yes;
    const w = [0];
    for (let i = 1; i < n; i++) w.push(w[i - 1] + (rnd() - 0.5) * 0.35);
    return w.map((x, i) => { const k = i / (n - 1); return i === n - 1 ? b0 : Math.round(clamp(a0 + (b0 - a0) * k + (x - w[n - 1] * k), 1, 99) * 10) / 10; });
  }

  // ---------- механизм цены (автоматический маркет-мейкер) ----------
  // В каждом рынке есть два резерва: y (доли «Да») и n (доли «Нет»). Вероятность «Да» = n / (y + n).
  // Покупка «Да» забирает доли «Да» из резерва и добавляет деньги в оба резерва: вероятность «Да» растёт, «Нет» падает.
  // Продажа делает обратное. Произведение y·n сохраняется, поэтому крупная ставка двигает цену сильнее мелкой.
  EVENTS.forEach((e) => {
    const S = clamp(e.vol * 0.02, 50000, 150000);
    e.n = (S * e.yes) / 100;
    e.y = S - e.n;
    e.p0 = e.yes;
  });
  const prob = (e) => (e.n / (e.y + e.n)) * 100;
  const cents = (e) => clamp(Math.round(e.yes), 1, 99);
  // Коэффициент (десятичный): во сколько раз выплата больше ставки. Цена 19¢ (19%) даёт ×5,26.
  const coefTxt = (c) => "×" + (100 / clamp(c, 0.5, 99.5)).toFixed(2).replace(".", ",");
  const sideBtn = (e, side) => { const c = side === "yes" ? cents(e) : 100 - cents(e); return `<b>${side === "yes" ? "Да" : "Нет"} ${c}%</b><small>${coefTxt(c)}</small>`; };
  const priceOf = (e, side) => (side === "yes" ? cents(e) : 100 - cents(e));
  function syncYes(e) {
    if (e.resolved) return; // итог рынка уже определён
    e.yes = Math.round(prob(e) * 10) / 10;
    e.hist[e.hist.length - 1] = e.yes;
  }
  function quoteBuy(e, side, amt) {
    if (!(amt > 0)) return { shares: 0, avg: 0, y: e.y, n: e.n, after: prob(e) };
    const k = e.y * e.n;
    let y = e.y, n = e.n, shares;
    if (side === "yes") { n = e.n + amt; y = k / n; shares = e.y + amt - y; }
    else { y = e.y + amt; n = k / y; shares = e.n + amt - n; }
    return { shares, avg: (amt / shares) * 100, y, n, after: (n / (y + n)) * 100 };
  }
  function quoteSell(e, side, s) {
    const A = side === "yes" ? e.y : e.n, B = side === "yes" ? e.n : e.y;
    const t = A + s + B;
    const r = (t - Math.sqrt(t * t - 4 * s * B)) / 2;
    const nA = A + s - r, nB = B - r;
    const y = side === "yes" ? nA : nB, n = side === "yes" ? nB : nA;
    return { gross: r, y, n, after: (n / (y + n)) * 100 };
  }
  bets.forEach((b) => { if (!b.shares) b.shares = (b.amt / b.price) * 100; });

  // ---------- история сделок по рынку ----------
  const EXTRA_NICKS = ["user_4821", "Алекс_М", "Катя_Прогноз", "vlad_trader", "Миша_Б", "Anna_K", "Сергей_74", "Тимур_Р", "nkr_91", "Лена_Инвест"];
  const NICKS = [...TRADERS.map((t) => t.nick), ...EXTRA_NICKS];
  let myTx = store.get("mytx", []);
  { const reset = [75, 76, 77, 83, 84, 85, 86]; if (!store.get("mig_tx1", false)) { myTx = myTx.filter((t) => !reset.includes(t.eid)); store.set("mytx", myTx); store.set("mig_tx1", true); } }
  let txSeq = 0;
  const txId = () => "t" + Date.now().toString(36) + "-" + txSeq++;
  // Демо: сделки других трейдеров за последние трое суток (цена берётся из графика на тот момент).
  function seedTrades(e) {
    const rnd = mulberry(e.id * 7717 + 3);
    const n = 22 + Math.floor(rnd() * 10);
    const out = [];
    for (let i = 0; i < n; i++) {
      const hrs = Math.pow(rnd(), 2.2) * 72;
      const t = Date.now() - hrs * 3600e3 - rnd() * 1800e3;
      const idx = clamp(HOURS - 1 - Math.floor(hrs), 0, HOURS - 1);
      const yesPrice = e.hist[idx];
      const side = rnd() < yesPrice / 100 ? "yes" : "no";
      let amt = 100 * Math.exp(rnd() * 4.6);
      if (rnd() < 0.1) amt *= 8;
      out.push({
        id: `s${e.id}-${i}`, t, nick: NICKS[Math.floor(rnd() * NICKS.length)], side,
        kind: rnd() < 0.18 ? "sell" : "buy", amt: Math.round(amt / 50) * 50 || 50,
        price: clamp((side === "yes" ? yesPrice : 100 - yesPrice) + (rnd() - 0.5) * 2, 1, 99)
      });
    }
    return out;
  }
  EVENTS.forEach((e) => { e.trades = seedTrades(e); });
  myTx.forEach((tr) => { const e = byId(tr.eid); if (e) e.trades.push(tr); });
  EVENTS.forEach((e) => e.trades.sort((x, y) => y.t - x.t));
  function addTrade(e, tr) {
    const full = { id: txId(), t: Date.now(), ...tr };
    e.trades.unshift(full);
    if (e.trades.length > 80) e.trades.length = 80;
    if (tr.own) {
      myTx.push({ eid: e.id, ...full });
      if (myTx.length > 200) myTx.shift();
      store.set("mytx", myTx);
    }
  }
  // сроки: рынок принимает ставки до конца дня закрытия
  const todayISO = () => new Date().toLocaleDateString("sv");
  const isExpired = (e) => !e.resolved && e.closes < todayISO();
  const daysLeft = (e) => Math.round((new Date(e.closes + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
  const isOpen = (e) => !e.resolved && !isExpired(e);
  const leftTxt = (e) => {
    if (e.resolved) return "завершён";
    const d = daysLeft(e);
    return d < 0 ? "срок вышел" : d === 0 ? "сегодня" : d === 1 ? "завтра" : d <= 21 ? `через ${d} дн.` : "";
  };
  const TX_LABEL = { buy: "Покупка", sell: "Продажа", win: "Выигрыш", loss: "Проигрыш" };
  const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  function when(t) {
    const d = new Date(t), two = (n) => String(n).padStart(2, "0");
    const abs = `${d.getDate()} ${MONTHS[d.getMonth()]}, ${two(d.getHours())}:${two(d.getMinutes())}`;
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    const rel = s < 60 ? "только что" : s < 3600 ? Math.floor(s / 60) + " мин назад" : s < 86400 ? Math.floor(s / 3600) + " ч назад" : Math.floor(s / 86400) + " дн назад";
    return { abs, rel };
  }
  function txHTML(e) {
    const day = e.trades.filter((x) => x.t > Date.now() - 86400e3).reduce((s, x) => s + x.amt, 0);
    const rows = e.trades.slice(0, 30).map((x) => {
      const w = when(x.t);
      return `<tr class="${x.own ? "me" : ""}">
        <td><span class="tx-when">${w.abs}</span><small>${w.rel}</small></td>
        <td><span class="who">${avatar(x.nick, x.own ? profile.color : traderColor(x.nick))}<span class="tx-nick">${esc(x.nick)}${x.own ? " (вы)" : ""}</span></span></td>
        <td><span class="tag ${x.side}">${TX_LABEL[x.kind] || "Покупка"} · ${x.side === "yes" ? "Да" : "Нет"}</span></td>
        <td>${rub(x.amt)}</td>
        <td>${pct1(x.price)}% · ${coefTxt(x.price)}</td>
      </tr>`;
    }).join("");
    return `<h3 class="pos-title">История сделок</h3>
      <p class="tx-sum">${e.trades.length} сделок · за 24 часа ${rub(day)}</p>
      <div class="tx-scroll"><table class="tx"><thead><tr><th>Когда</th><th>Трейдер</th><th>Сделка</th><th>Сумма</th><th>Вер. · коэф. / №</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- графики ----------
  function downsample(vals, max) {
    if (vals.length <= max) return vals.map((v, i) => [i, v]);
    const out = [];
    const step = (vals.length - 1) / (max - 1);
    for (let k = 0; k < max; k++) { const i = Math.round(k * step); out.push([i, vals[i]]); }
    return out;
  }
  function spark(vals) {
    const s = vals.slice(-168);
    const pts = downsample(s, 40);
    const lo = Math.min(...s), hi = Math.max(...s), span = Math.max(hi - lo, 4);
    const X = (i) => (i / (s.length - 1)) * 100;
    const Y = (v) => 3 + (1 - (v - lo) / span) * 26;
    const line = pts.map(([i, v], k) => (k ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join("");
    const up = s[s.length - 1] >= s[0];
    return `<svg viewBox="0 0 100 32" preserveAspectRatio="none" class="spark ${up ? "up" : "down"}" aria-hidden="true"><path class="sa" d="${line}L100 32L0 32Z"/><path class="sl" d="${line}"/></svg>`;
  }
  function timeLabel(n, i, key) {
    const d = new Date(Date.now() - (n - 1 - i) * (key === "1Ч" ? 60e3 : 3600e3));
    return key === "1Д" || key === "1Ч"
      ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }
  function geom(vals) {
    const W = 540, H = 230, L = 38, R = 12, T = 12, B = 24, n = vals.length;
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max(2, (hi - lo) * 0.15);
    lo = Math.max(0, Math.floor(lo - pad)); hi = Math.min(100, Math.ceil(hi + pad));
    if (hi - lo < 6) { hi = Math.min(100, lo + 6); lo = Math.max(0, hi - 6); }
    return { W, H, L, R, T, B, n, lo, hi, x: (i) => L + (i * (W - L - R)) / (n - 1), y: (v) => T + ((hi - v) * (H - T - B)) / (hi - lo) };
  }
  function chartMarkup(vals, key) {
    const g = geom(vals);
    const pts = downsample(vals, 150);
    const line = pts.map(([i, v], k) => (k ? "L" : "M") + g.x(i).toFixed(1) + " " + g.y(v).toFixed(1)).join("");
    const base = g.H - g.B;
    const up = vals[g.n - 1] >= vals[0];
    const ticks = [0, 1, 2, 3].map((k) => {
      const v = g.lo + ((g.hi - g.lo) * k) / 3;
      return `<line class="gl" x1="${g.L}" x2="${g.W - g.R}" y1="${g.y(v).toFixed(1)}" y2="${g.y(v).toFixed(1)}"/><text class="tx" x="${g.L - 6}" y="${(g.y(v) + 4).toFixed(1)}" text-anchor="end">${Math.round(v)}%</text>`;
    }).join("");
    const xl = [[0, "start"], [Math.round((g.n - 1) / 2), "middle"], [g.n - 1, "end"]]
      .map(([i, a]) => `<text class="tx" x="${g.x(i).toFixed(1)}" y="${g.H - 6}" text-anchor="${a}">${timeLabel(g.n, i, key)}</text>`).join("");
    return `<svg viewBox="0 0 ${g.W} ${g.H}" class="chart-svg ${up ? "up" : "down"}" role="img" aria-label="График вероятности «Да»">
      ${ticks}${xl}
      <path class="ca" d="${line}L${g.x(g.n - 1).toFixed(1)} ${base}L${g.L} ${base}Z"/>
      <path class="cl" d="${line}"/>
      <line class="cross" y1="${g.T}" y2="${base}" hidden/>
      <circle class="dot" r="4.5" hidden/>
    </svg>`;
  }
  let mChartHover = false;
  function bindChart(host, vals, key) {
    const svg = $("svg", host);
    if (!svg) return;
    attachHover(svg, geom(vals), vals, {
      name: "Да",
      onEnter: () => (mChartHover = true),
      onLeave: () => (mChartHover = false),
      val: (v) => pct1(v) + "%",
      time: (i) => new Date(Date.now() - (vals.length - 1 - i) * (key === "1Ч" ? 60e3 : 3600e3)).toLocaleString("ru-RU", key === "1Ч" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    });
  }

  // ---------- подтверждение действий ----------
  let onConfirm = null;
  function askConfirm({ title, rows, okText, danger }, ok) {
    $("#c-title").textContent = title;
    $("#c-rows").innerHTML = rows.map(([k, v, cls]) => `<div><dt>${k}</dt><dd class="${cls || ""}">${v}</dd></div>`).join("");
    const y = $("#c-yes");
    y.textContent = okText;
    y.className = danger ? "pbtn danger-fill" : "pbtn";
    onConfirm = ok;
    $("#confirm").hidden = false;
    y.focus();
  }
  function closeConfirm() { $("#confirm").hidden = true; onConfirm = null; }

  // ---------- позиции и продажа ----------
  function valueOf(b) {
    const e = byId(b.eid);
    const q = quoteSell(e, b.side, b.shares);
    const fee = q.gross * FEE;
    return { gross: q.gross, fee, net: q.gross - fee, pnl: q.gross - fee - b.amt, q };
  }
  function confirmSell(id) {
    const b = bets.find((x) => x.id === id);
    if (!b) return;
    const v = valueOf(b), e = byId(b.eid);
    askConfirm({
      title: "Подтвердите продажу",
      okText: "Продать",
      danger: true,
      rows: [
        ["Рынок", esc(e.q)],
        ["Позиция", `«${b.side === "yes" ? "Да" : "Нет"}», ${pct1(b.shares)} долей, вложено ${rub(b.amt)}`],
        ["Стоимость по рынку", rub(v.gross)],
        ["Комиссия 2%", "− " + rub(v.fee)],
        ["Вы получите", `<b>${rub(v.net)}</b>`],
        ["Итог по сделке", `${signed(v.pnl)} ₽`, v.pnl >= 0 ? "pos" : "neg"],
        ["«Да» после продажи", `${pct1(prob(e))}% → ${pct1(v.q.after)}%`]
      ]
    }, () => sellBet(id));
  }
  function sellBet(id) {
    const i = bets.findIndex((b) => b.id === id);
    if (i < 0) return;
    const b = bets[i], v = valueOf(b), e = byId(b.eid);
    bets.splice(i, 1);
    e.y = v.q.y; e.n = v.q.n; syncYes(e);
    addTrade(e, { nick: profile.nick, own: true, side: b.side, kind: "sell", amt: v.net, price: (v.gross / b.shares) * 100, pnl: v.pnl });
    closed.push({ eid: b.eid, side: b.side, amt: b.amt, net: v.net, fee: v.fee, ts: Date.now() });
    store.set("bets", bets);
    store.set("closed", closed);
    setBalance(balance + v.net);
    refreshPrices();
    toast(`Продано за ${rub(v.net)} (комиссия ${rub(v.fee)}). ${v.pnl >= 0 ? "Прибыль" : "Убыток"}: ${signed(v.pnl)} ₽`);
    if (modalEvent) { paintChart(); paintModalLive(); }
    if (state.route === "account") paintAccountRight();
  }
  // ---------- завершение рынка и выплаты ----------
  // Выигравшая доля стоит ₽1. Выигрыш = выплата минус ставка. С выигрыша платформа удерживает 2% (WIN_FEE), с проигрыша ничего.
  function previewSettle(e, outcome) {
    let stake = 0, payout = 0, fee = 0, n = 0;
    bets.filter((b) => b.eid === e.id).forEach((b) => {
      n++; stake += b.amt;
      if (b.side === outcome) { payout += b.shares; fee += Math.max(0, b.shares - b.amt) * WIN_FEE; }
    });
    return { n, stake, payout, fee, net: payout - fee };
  }
  function settleMarket(e, outcome, silent) {
    const pv = previewSettle(e, outcome);
    bets.filter((b) => b.eid === e.id).forEach((b) => {
      if (b.side === outcome) {
        const fee = Math.max(0, b.shares - b.amt) * WIN_FEE, net = b.shares - fee;
        setBalance(balance + net);
        closed.push({ eid: b.eid, side: b.side, amt: b.amt, net, fee, kind: "win", ts: Date.now() });
        addTrade(e, { nick: profile.nick, own: true, side: b.side, kind: "win", amt: net, price: 100, pnl: net - b.amt });
      } else {
        closed.push({ eid: b.eid, side: b.side, amt: b.amt, net: 0, fee: 0, kind: "loss", ts: Date.now() });
        addTrade(e, { nick: profile.nick, own: true, side: b.side, kind: "loss", amt: 0, price: 0, pnl: -b.amt });
      }
    });
    bets = bets.filter((b) => b.eid !== e.id);
    e.resolved = outcome;
    e.yes = outcome === "yes" ? 100 : 0;
    e.hist[e.hist.length - 1] = e.yes;
    resolved[e.id] = outcome;
    store.set("resolved", resolved);
    store.set("bets", bets);
    store.set("closed", closed);
    if (pv.n && !silent) toast(pv.payout > 0 ? `Рынок завершён: «${outcome === "yes" ? "Да" : "Нет"}». Выплата ${rub(pv.payout)}, комиссия 2% с выигрыша ${rub(pv.fee)}, вы получили ${rub(pv.net)}.` : `Рынок завершён: «${outcome === "yes" ? "Да" : "Нет"}». Ваши ставки не сыграли.`);
    else if (!silent) toast(`Рынок завершён: «${outcome === "yes" ? "Да" : "Нет"}».`);
    refreshPrices();
    if (modalEvent === e) openBet(e.id);
    if (state.route === "markets") paintGrid();
    if (state.route === "account") { paintAccountRight(); }
  }
  function confirmResolve(e, outcome) {
    const pv = previewSettle(e, outcome), word = outcome === "yes" ? "Да" : "Нет";
    askConfirm({
      title: "Демо: завершить рынок",
      okText: `Итог «${word}»`,
      rows: [
        ["Рынок", esc(e.q)],
        ["Итог", `«${word}»`],
        ["Ваших ставок", String(pv.n)],
        ["Выплата по ставкам", rub(pv.payout)],
        ["Комиссия 2% с выигрыша", "− " + rub(pv.fee)],
        ["Вы получите", `<b>${rub(pv.net)}</b>`],
        ["Результат с учётом ставок", `${signed(pv.net - pv.stake)} ₽`, pv.net - pv.stake >= 0 ? "pos" : "neg"]
      ]
    }, () => settleMarket(e, outcome));
  }

  const realized = () => closed.reduce((s, c) => s + (c.net - c.amt), 0) + PERPS.realized();
  const closedStake = () => closed.reduce((s, c) => s + c.amt, 0) + PERPS.closedMargin();

  function positionsHTML(list) {
    return list.map((b) => {
      const v = valueOf(b);
      return `<div class="pos-row">
        <div class="pos-main">
          <span class="tag ${b.side}">${b.side === "yes" ? "Да" : "Нет"}</span>
          <span>${rub(b.amt)} · ${pct1(b.shares)} долей · коэф. ${coefTxt(b.price)}</span>
          <span class="${v.pnl >= 0 ? "pos" : "neg"}">${signed(v.pnl)} ₽</span>
        </div>
        <button class="sell" data-sell="${b.id}">Продать за ${rub(v.net)}</button>
        <div class="pos-note">По рынку ${rub(v.gross)} − комиссия 2% (${rub(v.fee)})</div>
      </div>`;
    }).join("");
  }

  // ---------- Polymarket (ориентир для цены) ----------
  const polyFresh = (e) => e.poly != null && Date.now() - e.polyAt < 300000;
  const polyChip = (e) => (POLY_SLUGS[e.id] ? `<span class="pm" data-pm="${e.id}" title="Вероятность «Да» на Polymarket">Polymarket ${polyFresh(e) ? Math.round(e.poly) + "%" : "…"}</span>` : "");
  const polyUrl = (e) => `https://polymarket.com/market/${encodeURIComponent(POLY_SLUGS[e.id])}`;
  // Разбор ответа Polymarket Gamma API: outcomes и outcomePrices приходят JSON-строками. Возвращает вероятность «Да» в процентах.
  function parsePoly(m) {
    if (!m || m.closed) return null;
    try {
      const names = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes;
      const prices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices;
      const i = names.findIndex((n) => String(n).toLowerCase() === "yes");
      if (i < 0 || names.length !== 2) return null; // только рынки «Да/Нет»
      const v = Number(prices[i]);
      return v > 0 && v < 1 ? clamp(v * 100, 1, 99) : null;
    } catch { return null; }
  }
  async function pollPoly(e) {
    if (e.resolved) return;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
    try {
      const r = await fetch(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(POLY_SLUGS[e.id])}`, { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const list = await r.json();
      const pct = parsePoly(Array.isArray(list) ? list[0] : list);
      if (pct === null) throw new Error("нет цены");
      if (e.poly == null) { // первая цена: переносим рынок на эту вероятность и перерисовываем историю
        const S = e.y + e.n;
        e.n = (S * pct) / 100; e.y = S - e.n;
        e.hist = makeHistory(e.id, Math.round(pct * 10) / 10);
        syncYes(e);
      }
      e.poly = pct; e.polyAt = Date.now(); e.p0 = pct;
      refreshPrices();
      if (modalEvent === e) paintModalLive();
    } finally { clearTimeout(t); }
  }
  function startPoly() {
    if (typeof fetch !== "function" || typeof POLY_SLUGS === "undefined") return;
    EVENTS.filter((e) => POLY_SLUGS[e.id]).forEach((e, i) => {
      let fails = 0;
      const run = async () => {
        try { await pollPoly(e); fails = 0; } catch { fails++; }
        setTimeout(run, fails ? Math.min(300000, 30000 * 2 ** Math.min(fails - 1, 4)) : 30000);
      };
      setTimeout(run, 500 + i * 400); // запросы идут не разом
    });
  }

  // ---------- чат ----------
  // Демо без сервера: свои сообщения хранятся в браузере, «собеседники» сымитированы.
  const CHAT_SEED = ["Коэффициент выглядит интересно, но я сначала проверю правила рынка.", "Итог определяет только источник из правил. Новости не в счёт.", "Беру небольшую ставку, не больше 5% баланса.", "Кто смотрел график за неделю?", "Не кладите всё на один рынок.", "Пул небольшой, цена двигается быстро.", "Жду, пока вероятность вырастет, потом продам.", "Комиссия 2% с выигрыша, я это уже закладываю.", "Срок близко, ставки закроются в конце дня.", "Похожие рынки внизу страницы тоже полезно посмотреть."];
  const CHAT_TRADE_SEED = ["Плечо выше 10x беру только со стоп-лоссом.", "Без плеча спокойнее, ликвидации нет.", "Цену ликвидации смотрю до открытия позиции.", "Фандинг небольшой, но на длинной позиции он копится.", "Кто торгует Short на этом активе?", "Пока флэт, жду движения.", "Тейк-профит ставлю заранее, иначе жадность мешает.", "Не открывайте 100x на последние деньги.", "Цена Live или Демо, смотрите бейдж рядом с тикером."];
  const chatStore = store.get("chat", {}); // свои сообщения: комната -> [{t, nick, text}]
  const chatLive = {}; // сымитированные новые сообщения
  let chatSentAt = 0;
  const chatClean = (s) => s.replace(/(https?:\/\/|www\.|t\.me\/)\S+/gi, "[ссылка удалена]").trim().slice(0, 280);
  function chatMsgs(room) {
    const rnd = mulberry(hash(room) + 11), pool = room[0] === "t" ? CHAT_TRADE_SEED : CHAT_SEED, now = Date.now();
    const seeded = Array.from({ length: 6 }, (_, i) => ({ t: now - (6 - i) * (4 + rnd() * 9) * 60000, nick: NICKS[Math.floor(rnd() * NICKS.length)], text: pool[Math.floor(rnd() * pool.length)] }));
    return [...seeded, ...(chatLive[room] || []), ...(chatStore[room] || []).map((m) => ({ ...m, own: true }))].sort((a, b) => a.t - b.t);
  }
  const chatTime = (t) => new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  function chatHTML(room) {
    return `<section class="chat" data-room="${room}">
      <h3 class="pos-title">${room[0] === "t" ? "Чат трейдеров" : "Чат рынка"}</h3>
      <div class="chat-list"></div>
      <form class="chat-form"><input class="field chat-in" maxlength="280" placeholder="Напишите сообщение" aria-label="Сообщение в чат"><button class="pbtn" type="submit">Отправить</button></form>
      <p class="fee-note">Демо: ваши сообщения видны только вам, собеседники сымитированы. Без ссылок и рекламы. Чат не является инвестиционной рекомендацией.</p>
    </section>`;
  }
  function chatPaint(root, first) {
    const room = $(".chat", root).dataset.room, list = $(".chat-list", root);
    const stick = first || list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    list.innerHTML = chatMsgs(room).slice(-60).map((m) => `<div class="cm ${m.own ? "own" : ""}">${avatar(m.nick, m.own ? profile.color : traderColor(m.nick))}<div><b>${esc(m.nick)}${m.own ? " (вы)" : ""}</b><small>${chatTime(m.t)}</small><p>${esc(m.text)}</p></div></div>`).join("");
    if (stick) list.scrollTop = list.scrollHeight;
  }
  function chatBind(root, room) {
    chatPaint(root, true);
    $(".chat-form", root).onsubmit = (ev) => {
      ev.preventDefault();
      const inp = $(".chat-in", root), text = chatClean(inp.value);
      if (!text) return;
      if (Date.now() - chatSentAt < 2000) return toast("Не так быстро: одно сообщение в 2 секунды");
      chatSentAt = Date.now();
      (chatStore[room] = chatStore[room] || []).push({ t: Date.now(), nick: profile.nick, text });
      if (chatStore[room].length > 100) chatStore[room].shift();
      store.set("chat", chatStore);
      inp.value = "";
      chatPaint(root, true);
    };
  }
  setInterval(() => { // «собеседники» иногда пишут сами
    const c = document.querySelector(".chat[data-room]");
    if (!c || Math.random() > 0.5 || (c.closest("#modal") && $("#modal").hidden)) return;
    const room = c.dataset.room, pool = room[0] === "t" ? CHAT_TRADE_SEED : CHAT_SEED;
    (chatLive[room] = chatLive[room] || []).push({ t: Date.now(), nick: NICKS[Math.floor(Math.random() * NICKS.length)], text: pool[Math.floor(Math.random() * pool.length)] });
    if (chatLive[room].length > 40) chatLive[room].shift();
    chatPaint(c.parentElement, false);
  }, 20000);

  // ---------- правила рынка ----------
  function rulesHTML(e) {
    const r = rulesFor(e);
    return `<div class="rules">
      <h3 class="pos-title">Правила: как определим победителя</h3>
      <dl class="rules-dl">
        <div><dt>Итог «Да», если</dt><dd>${esc(r.cond)}</dd></div>
        <div><dt>Источник результата</dt><dd>${esc(r.src)}</dd></div>
        <div><dt>Особые случаи</dt><dd>${esc(r.edge)}</dd></div>
        <div><dt>Приём ставок</dt><dd>до 23:59:59 МСК ${fmtDate(e.closes)}</dd></div>
      </dl>
      <details class="rules-gen"><summary>Общие правила и порядок спора</summary><ol>${RULES_GENERAL.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></details>
      <p class="fee-note">Не согласны с итогом? В течение 24 часов напишите в <a href="${TELEGRAM_URL}" target="_blank" rel="noopener">Telegram-канал</a> и укажите «Рынок №${e.id}».</p>
    </div>`;
  }

  // ---------- похожие рынки ----------
  const STOP_WORDS = new Set(["будет", "выше", "ниже", "этой", "этого", "после", "более", "менее", "хотя", "бы", "раз", "для", "что", "при", "или"]);
  const wordsOf = (s) => (s.toLowerCase().match(/[a-zа-яё0-9]{4,}/g) || []).filter((w) => !STOP_WORDS.has(w));
  // Очки: та же категория, тот же значок (тема), общие слова в вопросе, близкий срок. Только открытые рынки.
  function similarTo(e, n = 4) {
    const w = new Set(wordsOf(e.q));
    return EVENTS.filter((x) => x.id !== e.id && isOpen(x) && catOn(x.cat))
      .map((x) => {
        let s = (x.cat === e.cat ? 3 : 0) + (x.img === e.img ? 2 : 0);
        wordsOf(x.q).forEach((t) => { if (w.has(t)) s += 1; });
        if (Math.abs(daysLeft(x) - daysLeft(e)) <= 7) s += 1;
        return { x, s };
      })
      .filter((o) => o.s > 0)
      .sort((a, b) => b.s - a.s || b.x.vol - a.x.vol)
      .slice(0, n)
      .map((o) => o.x);
  }
  function similarHTML(e) {
    const list = similarTo(e);
    if (!list.length) return "";
    return `<h3 class="pos-title">Похожие рынки</h3><div class="similar">${list.map((x) => `
      <button class="sim" data-open="${x.id}">
        ${banner(x, "sim-thumb", 96, 56)}
        <span class="sim-body"><b>${esc(x.q)}</b><small>${catName(x.cat)}${leftTxt(x) ? " · " + leftTxt(x) : ""}</small></span>
        <span class="sim-pct">${Math.round(x.yes)}%<small>${coefTxt(cents(x))}</small></span>
      </button>`).join("")}</div>`;
  }

  // ---------- карточка рынка ----------
  const cardHTML = (e) => `
    <article class="card" data-open="${e.id}">
      ${banner(e, "", 320, 64)}
      <div class="cat"><span>${catName(e.cat)}</span>${polyChip(e)}</div>
      <h3>${esc(e.q)}</h3>
      <div class="meter">
        <div class="pct">${Math.round(e.yes)}%</div>
        <div class="spark-host">${spark(e.hist)}</div>
      </div>
      ${e.resolved || isExpired(e)
        ? `<div class="resolved">${e.resolved ? `Рынок завершён · итог «${e.resolved === "yes" ? "Да" : "Нет"}»` : "Приём ставок закрыт · ждём итог"}</div>`
        : `<div class="btns">
        <button class="btn yes" data-open="${e.id}" data-side="yes">${sideBtn(e, "yes")}</button>
        <button class="btn no" data-open="${e.id}" data-side="no">${sideBtn(e, "no")}</button>
      </div>`}
      <div class="meta"><span class="vol">Пул ${short(e.vol)} ₽</span><span>до ${fmtDate(e.closes)}${leftTxt(e) ? ` · <b>${leftTxt(e)}</b>` : ""}</span></div>
    </article>`;

  // ---------- страницы ----------
  function viewHome() {
    const hot = EVENTS.filter((e) => catOn(e.cat) || e.id === MAIN_MARKET).sort((a, b) => b.vol - a.vol);
    const featured = (typeof MAIN_MARKET !== "undefined" && byId(MAIN_MARKET)) || hot[0];
    const news = (typeof MAIN_NEWS !== "undefined" && MAIN_NEWS[featured.id]) || [];
    const totalVol = EVENTS.reduce((s, e) => s + e.vol, 0);
    const topTraders = [...TRADERS].sort((a, b) => b.profit - a.profit).slice(0, 5);
    return `
    <section class="hero">
      <div class="wrap">
        <div>
          <div class="eyebrow">Рынок прогнозов России</div>
          <h1>Знаешь, что будет дальше? <em>Вложи в пул</em> и забери разницу.</h1>
          <p class="lead">Ставь на курс рубля, решения ЦБ, нефть, крипту, спорт и политику. Рядом с каждым исходом видны вероятность и коэффициент: 62% это ×1,61, а 20% это ×5,00. Угадал — выплата равна ставке, умноженной на коэффициент, платформа берёт 2% от выигрыша. Передумал — продай в любой момент.</p>
          <div class="cta-row">
            <button class="cta primary" data-deposit>Пополнить пул</button>
            <a class="cta ghost" href="#markets">Смотреть рынки</a>
          </div>
          <div class="demo-note">Демо-режим: игровые рубли, реальные деньги не принимаются.</div>
        </div>
        <div class="hero-card" data-open="${featured.id}" style="cursor:pointer">
          ${banner(featured, "in-hero", 460, 96)}
          <div class="eyebrow">${typeof MAIN_MARKET !== "undefined" && byId(MAIN_MARKET) ? "Главный рынок" : "Самый большой пул"} · ${catName(featured.cat)}</div>
          <div class="q">${esc(featured.q)}</div>
          <div class="big"><span class="pct">${Math.round(featured.yes)}%</span> <small>вероятность «Да»</small></div>
          <div class="spark-host hero-spark">${spark(featured.hist)}</div>
          <div class="btns">
            <button class="btn yes" data-open="${featured.id}" data-side="yes">${sideBtn(featured, "yes")}</button>
            <button class="btn no" data-open="${featured.id}" data-side="no">${sideBtn(featured, "no")}</button>
          </div>
          ${news.length ? `<div class="thesis">
            <div class="ths-label">Новости</div>
            ${news.map((n) => `<a class="news-item" href="${esc(/^https?:\/\//i.test(n.url) ? n.url : "#")}" target="_blank" rel="noopener noreferrer">
              <b>${esc(n.title)}</b>
              <span>${esc(n.text)}</span>
              <small>${esc(n.source)}${n.date ? " · " + fmtDate(n.date) : ""}</small>
            </a>`).join("")}
            <small class="ths-note">Пересказ публикаций в СМИ. Цифры проверяйте по ссылке, не инвестиционная рекомендация.</small>
          </div>` : ""}
        </div>
      </div>
    </section>

    <div class="wrap">
      <div class="stats">
        <div class="stat"><b>${EVENTS.length}</b><span>открытых рынков</span></div>
        <div class="stat"><b>${short(totalVol)} ₽</b><span>объём всех пулов</span></div>
        <div class="stat"><b>${nf.format(12480 + TRADERS.length)}</b><span>трейдеров (демо)</span></div>
        <div class="stat"><b>2%</b><span>комиссия при продаже</span></div>
      </div>

      <section class="block cats-top">
        <div class="block-head"><h2>Категории</h2></div>
        <div class="cats">${CATEGORIES.filter((c) => catOn(c.id)).map((c) => {
          const n = EVENTS.filter((e) => e.cat === c.id);
          return `<a class="cat-tile" href="#markets" data-pick="${c.id}"><b>${c.name}</b><span>${n.length} рынков · пул ${short(n.reduce((s, e) => s + e.vol, 0))} ₽</span></a>`;
        }).join("")}</div>
      </section>

      <section class="block">
        <div class="block-head"><h2>Горячие рынки</h2><a href="#markets">Все рынки →</a></div>
        <div class="grid" style="padding-bottom:0">${hot.filter((x) => x !== featured).slice(0, 6).map(cardHTML).join("")}</div>
      </section>

      <section class="block">
        <div class="block-head"><h2>Скоро закроются</h2><a href="#markets" data-pick="soon">Все короткие рынки →</a></div>
        <div class="grid" style="padding-bottom:0">${EVENTS.filter((e) => catOn(e.cat) && isOpen(e) && daysLeft(e) <= 14).sort((x, y) => x.closes.localeCompare(y.closes) || y.vol - x.vol).slice(0, 6).map(cardHTML).join("")}</div>
      </section>

      <section class="block">
        <div class="block-head"><h2>Как это работает</h2></div>
        <div class="steps">
          <div class="step"><b>Пополните пул</b><span>Получите игровые рубли на баланс одним нажатием.</span></div>
          <div class="step"><b>Выберите исход</b><span>«Да» или «Нет». У каждого исхода есть вероятность в процентах и коэффициент: ×5 значит, что выплата в 5 раз больше ставки.</span></div>
          <div class="step"><b>Заберите выплату или продайте</b><span>Если исход сбылся, каждая доля стоит ₽1, с выигрыша удерживается 2%. Продать позицию можно в любой момент, комиссия тоже 2%.</span></div>
        </div>
      </section>

      <section class="block">
        <div class="block-head"><h2>Лучшие трейдеры</h2><a href="#leaderboard">Весь рейтинг →</a></div>
        ${leaderTable(topTraders, false)}
      </section>

      <section class="block">${PERPS.promo()}</section>

      <section class="block">${tgCard()}</section>

      <div class="final">
        <h2>Начните с ₽10 000 игровых денег и проверьте свой прогноз.</h2>
        <button class="cta primary" data-deposit>Пополнить пул</button>
      </div>
    </div>`;
  }

  function visibleEvents() {
    const q = state.q.trim().toLowerCase();
    const sorts = {
      volume: (a, b) => b.vol - a.vol,
      closing: (a, b) => (isOpen(b) - isOpen(a)) || a.closes.localeCompare(b.closes), // сначала открытые, ближайший срок первым
      chance: (a, b) => b.yes - a.yes
    };
    if (state.cat !== "all" && state.cat !== "soon" && !catOn(state.cat)) state.cat = "all";
    const inCat = (e) => catOn(e.cat) && (state.cat === "all" || (state.cat === "soon" ? isOpen(e) && daysLeft(e) <= 14 : e.cat === state.cat));
    return EVENTS.filter((e) => inCat(e) && (!q || e.q.toLowerCase().includes(q))).sort(state.cat === "soon" && state.sort === "volume" ? sorts.closing : sorts[state.sort]);
  }

  function viewMarkets() {
    const tabs = [{ id: "all", name: "Все" }, { id: "soon", name: "Скоро закроются" }, ...CATEGORIES.filter((c) => catOn(c.id))];
    return `
    <div class="wrap">
      <h1 class="page-title">Рынки</h1>
      <p class="page-sub">Выберите событие, изучите график и поставьте на «Да» или «Нет». Продать позицию можно в любой момент.</p>
      <nav id="tabs" class="tabs">${tabs.map((t) => `<button class="tab ${t.id === state.cat ? "active" : ""}" data-cat="${t.id}">${t.name}</button>`).join("")}</nav>
      <div class="toolbar">
        <span id="count"></span>
        <div class="tools">
          <input id="search" class="field" type="search" placeholder="Поиск событий…" value="${esc(state.q)}" aria-label="Поиск событий">
          <select id="sort" aria-label="Сортировка">
            <option value="volume" ${state.sort === "volume" ? "selected" : ""}>По объёму</option>
            <option value="closing" ${state.sort === "closing" ? "selected" : ""}>Скоро закроются</option>
            <option value="chance" ${state.sort === "chance" ? "selected" : ""}>Высокая вероятность</option>
          </select>
        </div>
      </div>
      <div id="grid" class="grid"></div>
      <p id="empty" class="empty" hidden>Ничего не найдено.</p>
    </div>`;
  }

  function paintGrid() {
    const list = visibleEvents();
    const n = list.length;
    const word = n % 10 === 1 && n % 100 !== 11 ? "событие" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "события" : "событий";
    $("#count").textContent = `${n} ${word}`;
    $("#empty").hidden = n > 0;
    $("#grid").innerHTML = list.map(cardHTML).join("");
  }

  function leaderTable(rows, withMe) {
    let list = rows.map((t) => ({ ...t }));
    if (withMe) {
      const profit = realized(), stake = closedStake();
      list.push({ nick: profile.nick, profit, pnl: stake ? (profit / stake) * 100 : 0, trades: closed.length + bets.length + PERPS.count(), me: true, color: profile.color });
      list.sort((a, b) => b.profit - a.profit);
    }
    return `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>Трейдер</th><th>PNL</th><th>Общая прибыль</th><th>Сделок</th></tr></thead>
      <tbody>${list.map((t, i) => `
        <tr class="${t.me ? "me" : ""} lb-go" data-go="${t.me ? "#account" : "#trader/" + encodeURIComponent(t.nick)}" tabindex="0">
          <td class="rank ${i < 3 ? "top" : ""}">${i + 1}</td>
          <td><a class="who" href="${t.me ? "#account" : "#trader/" + encodeURIComponent(t.nick)}">${avatar(t.nick, t.color || traderColor(t.nick))}${esc(t.nick)}${t.me ? " (вы)" : ""}</a></td>
          <td class="${t.pnl >= 0 ? "pos" : "neg"}">${t.pnl > 0 ? "+" : t.pnl < 0 ? "−" : ""}${Math.abs(t.pnl).toFixed(1).replace(".", ",")}%</td>
          <td class="${t.profit >= 0 ? "pos" : "neg"}">${signed(t.profit)} ₽</td>
          <td>${t.trades}</td>
        </tr>`).join("")}
      </tbody></table></div>`;
  }

  function viewLeaderboard() {
    const rows = [...TRADERS].sort((a, b) => b.profit - a.profit);
    return `<div class="wrap">
      <h1 class="page-title">Таблица лидеров</h1>
      <p class="page-sub">PNL — доходность на вложенные средства, общая прибыль — в игровых рублях. Все трейдеры вымышлены. Ваша прибыль считается по проданным позициям, с учётом комиссии 2%. <b>Нажмите на трейдера, чтобы увидеть его сделки в прогнозах и перпах.</b></p>
      ${leaderTable(rows, true)}
    </div>`;
  }

  function accountRight() {
    const r = realized();
    const open = bets.length
      ? bets.slice().reverse().map((b) => {
          const e = byId(b.eid);
          return `<div class="bet"><div class="t">${esc(e.q)}</div>${positionsHTML([b])}</div>`;
        }).join("")
      : `<p class="empty" style="padding:20px">Открытых ставок нет. Откройте <a href="#markets" style="color:var(--brand)">рынки</a> и сделайте первый прогноз.</p>`;
    const hist = closed.length
      ? `<h3 style="margin-top:22px">Закрытые сделки</h3><div class="bets">${closed.slice(-5).reverse().map((c) => {
          const p = c.net - c.amt;
          return `<div class="bet"><div class="t">${esc(byId(c.eid).q)}</div><div class="d"><span><span class="tag ${c.side}">${c.side === "yes" ? "Да" : "Нет"}</span> вложено ${rub(c.amt)} · получено ${rub(c.net)}${c.kind === "win" ? ` · комиссия 2% с выигрыша ${rub(c.fee)}` : c.kind === "loss" ? " · ставка не сыграла" : ""}</span><span class="${p >= 0 ? "pos" : "neg"}">${signed(p)} ₽</span></div></div>`;
        }).join("")}</div>`
      : "";
    return `
      <h3>Мои ставки</h3>
      <div class="kpis">
        <div class="kpi"><b>${bets.length}</b><span>открытых ставок</span></div>
        <div class="kpi"><b class="${r >= 0 ? "pos" : "neg"}">${signed(r)} ₽</b><span>прибыль по проданным</span></div>
      </div>
      <div class="row-actions" style="margin:0 0 18px"><button class="pbtn" data-deposit>Пополнить пул</button></div>
      <div class="bets">${open}</div>${hist}`;
  }
  const paintAccountRight = () => {
    const el = $("#acc-right");
    if (el) el.innerHTML = accountRight();
    paintAccountStats();
    paintDeposits();
    paintAccountTx();
  };

  // ---------- портфель на странице аккаунта ----------
  const acp = { cat: "pred", range: "1Д", sub: "pos", q: "", sort: "value", arch: false, ...store.get("acp", {}) };
  const saveAcp = () => store.set("acp", { cat: acp.cat, hide: acp.hide, arch: acp.arch });
  const ACP_RANGES = ["1Д", "1Н", "1М", "1Г", "YTD", "ВСЕ"];
  const ACP_NAME = { "1Д": "за последний день", "1Н": "за последнюю неделю", "1М": "за последний месяц", "1Г": "за последний год", YTD: "с начала года", "ВСЕ": "за всё время" };
  const ICO = {
    eye: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeoff: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.7 6.7A17 17 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V5M7 9l5-5 5 5M5 20h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>'
  };
  // Все данные по одному виду портфеля: открытые позиции, история, оценка и результат по периодам.
  function acpData(cat) {
    if (cat === "pred") {
      const open = bets.map((b) => {
        const e = byId(b.eid), v = valueOf(b), cur = b.side === "yes" ? prob(e) : 100 - prob(e);
        return { key: b.id, ts: b.ts, title: e.q, eid: e.id, tag: `<span class="tag ${b.side}">${b.side === "yes" ? "Да" : "Нет"}</span>`, avg: pct1(b.price) + "%", cur: pct1(cur) + "%", vol: b.amt, win: b.shares, value: v.net, pnl: v.pnl, sell: b.id };
      });
      const hist = closed.map((c, i) => { const e = byId(c.eid), pnl = c.net - c.amt; return { key: "c" + i, ts: c.ts || 0, title: e ? e.q : "Рынок №" + c.eid, eid: c.eid, tag: `<span class="tag ${c.side}">${c.side === "yes" ? "Да" : "Нет"}</span>`, vol: c.amt, value: c.net, pnl, status: c.kind === "win" ? "Выигрыш" : c.kind === "loss" ? "Проигрыш" : "Продано" }; });
      return { open, hist };
    }
    const d = PERPS.account();
    const open = d.open.map((x) => ({ key: x.id, ts: x.ts, sym: x.sym, name: x.name, badge: x.badge, tag: `<span class="tag ${x.dir === "long" ? "yes" : "no"}">${x.dir === "long" ? "Long" : "Short"} ${x.lev === 1 ? "без плеча" : x.lev + "x"}</span>`, avg: x.entry, cur: x.cur, vol: x.margin, notional: x.notional, liq: x.liq, tp: x.tp, sl: x.sl, value: x.equity, pnl: x.pnl, roe: x.roe, close: x.id }));
    const hist = d.closed.map((x, i) => ({ key: "c" + i, ts: x.ts || 0, sym: x.sym, name: x.name, badge: x.badge, tag: `<span class="tag ${x.dir === "long" ? "yes" : "no"}">${x.dir === "long" ? "Long" : "Short"} ${x.lev === 1 ? "без плеча" : x.lev + "x"}</span>`, avg: x.entry, cur: x.exit, vol: x.margin, value: Math.max(0, x.margin + x.pnl), pnl: x.pnl, status: { liq: "Ликвидация", tp: "Тейк-профит", sl: "Стоп-лосс", close: "Закрыто" }[x.kind] || "Закрыто" }));
    return { open, hist };
  }
  function acpStart(range, d) {
    const now = Date.now();
    if (range === "1Д") return now - DAY;
    if (range === "1Н") return now - 7 * DAY;
    if (range === "1М") return now - 30 * DAY;
    if (range === "1Г") return now - 365 * DAY;
    if (range === "YTD") return new Date(new Date().getFullYear(), 0, 1).getTime();
    const ts = [...d.open, ...d.hist].map((x) => x.ts).filter(Boolean);
    return ts.length ? Math.min(...ts) - 3600e3 : now - 30 * DAY;
  }
  // Результат за период: закрытые сделки периода плюс текущая оценка открытых позиций.
  function acpPnl(d, range) {
    const start = acpStart(range, d), unreal = d.open.reduce((s, x) => s + x.pnl, 0);
    const ev = d.hist.filter((x) => x.ts >= start).map((x) => ({ ts: x.ts, pnl: x.pnl }));
    return { start, ev, unreal, total: ev.reduce((s, x) => s + x.pnl, 0) + unreal };
  }
  function acpChart(d, range) {
    const r = acpPnl(d, range), N = 48, now = Date.now(), step = (now - r.start) / (N - 1);
    const times = Array.from({ length: N }, (_, i) => r.start + i * step);
    const vals = times.map((t, i) => r.ev.filter((e) => e.ts <= t + (i === N - 1 ? 1 : 0)).reduce((s, e) => s + e.pnl, 0) + (i === N - 1 ? r.unreal : 0));
    const W = 600, H = 150, L = 6, R = 6, T = 10, B = 22;
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1;
    const g = { W, H, L, R, T, B, n: N, x: (i) => L + (i * (W - L - R)) / (N - 1), y: (v) => T + (1 - (v - lo) / span) * (H - T - B) };
    const line = vals.map((v, i) => (i ? "L" : "M") + g.x(i).toFixed(1) + " " + g.y(v).toFixed(1)).join("");
    const z = g.y(0).toFixed(1), day = range === "1Д";
    const fmt = (t) => new Date(t).toLocaleString("ru-RU", day ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
    const fmtTip = (t) => new Date(t).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const up = r.total >= 0;
    const svg = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg acp-svg ${up ? "up" : "down"}" role="img" aria-label="Прибыль и убыток">
      <line class="gl acp-zero" x1="${L}" x2="${W - R}" y1="${z}" y2="${z}"/>
      <text class="tx" x="${L}" y="${H - 5}" text-anchor="start">${fmt(times[0])}</text><text class="tx" x="${W - R}" y="${H - 5}" text-anchor="end">${fmt(times[N - 1])}</text>
      <path class="ca" d="${line}L${g.x(N - 1).toFixed(1)} ${z}L${g.x(0)} ${z}Z"/><path class="cl" d="${line}"/>
      <line class="cross" y1="${T}" y2="${H - B}" hidden/><circle class="dot" r="4.5" hidden/>
    </svg>`;
    return { svg, g, vals, times, fmtTip, total: r.total };
  }
  let acpHover = false;
  function paintAcpChart(d, sel = "#acp-chart", range = acp.range) {
    const host = $(sel);
    if (!host) return;
    const c = acpChart(d, range);
    host.innerHTML = c.svg;
    attachHover($("svg", host), c.g, c.vals, { val: (v) => signed(v) + " ₽", time: (i) => c.fmtTip(c.times[i]) });
  }
  const acpMask = (t) => (acp.hide ? "₽ •••" : t);
  function paintAccountStats() {
    const box = $("#acc-stats");
    if (!box) return;
    const keep = document.activeElement && (document.activeElement.id === "acp-q" || document.activeElement.id === "acp-sort");
    const dP = acpData("pred"), dT = acpData("perps");
    const valP = dP.open.reduce((s, x) => s + x.value, 0), valT = dT.open.reduce((s, x) => s + x.value, 0);
    const d = acp.cat === "pred" ? dP : dT, val = acp.cat === "pred" ? valP : valT;
    const day = acpPnl(d, "1Д"), pnl = acpPnl(d, acp.range), pct = val > 0 ? (day.total / val) * 100 : 0;
    const top = `
      <div class="acp-tabs" role="tablist">${[["pred", "Прогнозы"], ["perps", "Перпы"]].map(([k, n]) => `<button type="button" role="tab" data-acp-cat="${k}" class="${acp.cat === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="acp-cards">
        <div class="acp-card">
          <div class="acp-row">
            <div class="acp-main">
              <small>Портфель · ${acp.cat === "pred" ? "прогнозы" : "перпы"}</small>
              <b class="acp-big">${acpMask(rub(val))} <button type="button" class="acp-eye" data-acp-eye title="${acp.hide ? "Показать суммы" : "Скрыть суммы"}" aria-label="Скрыть или показать суммы">${acp.hide ? ICO.eyeoff : ICO.eye}</button></b>
              <span class="acp-sub ${day.total >= 0 ? "pos" : "neg"}">${acpMask(`${signed(day.total)} ₽ (${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1).replace(".", ",")}%)`)} <i>за день</i></span>
            </div>
            <div class="acp-av">
              <small>Доступно для торговли</small>
              <b>${acpMask(rub(balance))}</b>
              <span class="acp-pill" title="Деньги в пулах: ${rub(valP)}, в перпах: ${rub(valT)}">в пулах ${acpMask(rub(valP))} · в перпах ${acpMask(rub(valT))}</span>
            </div>
          </div>
          <div class="acp-btns"><button type="button" class="acp-dep" data-deposit>${ICO.down}Депозит</button><button type="button" class="acp-wd" data-acp-wd>${ICO.up}Вывод</button></div>
        </div>
        <div class="acp-card">
          <div class="acp-row acp-prow">
            <div class="acp-main">
              <small><span class="acp-dot ${pnl.total >= 0 ? "pos" : "neg"}"></span>Прибыль/убыток</small>
              <b class="acp-big ${pnl.total >= 0 ? "pos" : "neg"}">${acpMask(signed(pnl.total) + " ₽")} <span class="acp-share" title="Результат считается по закрытым сделкам периода и текущей оценке открытых позиций">${ICO.share}</span></b>
              <span class="acp-sub muted">${ACP_NAME[acp.range][0].toUpperCase() + ACP_NAME[acp.range].slice(1)}</span>
            </div>
            <div class="acp-rng">${ACP_RANGES.map((k) => `<button type="button" data-acp-range="${k}" class="${acp.range === k ? "on" : ""}">${k}</button>`).join("")}<span class="acp-brand">${document.querySelector(".logo-svg") ? document.querySelector(".logo-svg").outerHTML : ""}RusPredict</span></div>
          </div>
          <div id="acp-chart" class="acp-chart"></div>
        </div>
      </div>`;
    const sub = `<div class="acp-sub-tabs" role="tablist">${[["pos", "Позиции", d.open.length], ["orders", "Открытые заявки", null], ["hist", "История", d.hist.length]].map(([k, n, c]) => `<button type="button" role="tab" data-acp-sub="${k}" class="${acp.sub === k ? "on" : ""}">${n}${c ? ` <em>${c}</em>` : ""}</button>`).join("")}</div>`;
    const tools = `<div class="acp-tools">${sub}
      <label class="acp-search">${ICO.search}<input id="acp-q" type="search" placeholder="Поиск" value="${esc(acp.q)}" autocomplete="off"></label>
      <select id="acp-sort" class="acp-sort" aria-label="Сортировка">${[["value", "Текущая стоимость"], ["pnl", "Прибыль"], ["vol", "Объём сделок"], ["new", "Сначала новые"]].map(([k, n]) => `<option value="${k}" ${acp.sort === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <label class="acp-tg"><span class="sw"><input type="checkbox" id="acp-arch" ${acp.arch ? "checked" : ""}><i></i></span>Показать архивные</label></div>`;
    $("#acp-top").innerHTML = top;
    if (!keep) $("#acp-tools").innerHTML = tools;
    paintAcpChart(d);
    paintAcpList(d);
  }
  function paintAcpList(d) {
    const host = $("#acp-list");
    if (!host) return;
    d = d || acpData(acp.cat);
    const q = acp.q.trim().toLowerCase(), perps = acp.cat === "perps";
    const name = (x) => (perps ? x.sym + " " + x.name : x.title).toLowerCase();
    const sorters = { value: (a, b) => b.value - a.value, pnl: (a, b) => b.pnl - a.pnl, vol: (a, b) => b.vol - a.vol, new: (a, b) => b.ts - a.ts };
    const pnlCell = (x) => `<small class="${x.pnl >= 0 ? "pos" : "neg"}">${signed(x.pnl)} ₽ (${x.vol > 0 ? (x.pnl >= 0 ? "+" : "−") + Math.abs((x.pnl / x.vol) * 100).toFixed(1).replace(".", ",") : "0"}%)</small>`;
    const mk = (x) => (perps ? `<a href="#trade" class="acp-mk" data-goasset="${x.sym}">${x.badge}<span><b>${esc(x.sym)}-PERP</b><small>${esc(x.name)} · ${x.tag}</small></span></a>` : `<span class="acp-mk" role="button" tabindex="0" data-open="${x.eid}"><span><b>${esc(x.title)}</b><small>${x.tag}${x.win ? ` ${pct1(x.win)} долей` : ""}</small></span></span>`);
    let html;
    if (acp.sub === "orders") {
      if (perps) {
        const rows = d.open.filter((x) => x.tp || x.sl).flatMap((x) => [x.tp && { x, k: "Тейк-профит", v: x.tp, cls: "yes" }, x.sl && { x, k: "Стоп-лосс", v: x.sl, cls: "no" }].filter(Boolean)).filter((r) => !q || name(r.x).includes(q));
        html = rows.length ? `<div class="table-wrap" style="margin:0"><table class="acc-tx acp-tx"><thead><tr><th>Позиция</th><th>Тип заявки</th><th>Срабатывает при цене</th><th>Сейчас</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${mk(r.x)}</td><td><span class="tag ${r.cls}">${r.k}</span></td><td>${r.v}</td><td>${r.x.cur}</td></tr>`).join("")}</tbody></table></div>` : "";
      } else {
        const rows = liq.orders.map((o) => ({ o, e: byId(o.eid) })).filter((r) => r.e && (!q || r.e.q.toLowerCase().includes(q)));
        html = rows.length ? `<div class="table-wrap" style="margin:0"><table class="acc-tx acp-tx"><thead><tr><th>Рынок</th><th>Размер</th><th>От цены</th><th>Награда в день</th><th>Заработано</th></tr></thead><tbody>${rows.map(({ o, e }) => `<tr><td class="ev"><span class="acp-mk" role="button" tabindex="0" data-open="${e.id}"><span><b>${esc(e.q)}</b><small>Заявка ликвидности</small></span></span></td><td>${rub(o.size)}</td><td>${String(o.spread).replace(".", ",")}¢ из ${lqMeta(e).maxS}¢</td><td>${rub(lqRate(o) * DAY)}</td><td class="pos"><b>${rub(o.acc)}</b></td></tr>`).join("")}</tbody></table></div>` : "";
      }
      if (!html) html = `<p class="acp-empty">${perps ? "Заявок с тейк-профитом и стоп-лоссом нет. Задайте их в позиции кнопкой TP/SL." : "Открытых заявок ликвидности нет. Их можно выставить в разделе «Бонус»."}</p>`;
    } else {
      const showHist = acp.sub === "hist" || acp.arch;
      let list = (acp.sub === "hist" ? [] : d.open.map((x) => ({ ...x, live: true }))).concat(showHist ? d.hist : []).filter((x) => !q || name(x).includes(q));
      list.sort(acp.sub === "hist" ? sorters.new : sorters[acp.sort]);
      const head = perps ? ["Позиция", "Вход → Сейчас", "Маржа", "Ликвидация", "Стоимость"] : ["Рынок", "Средн. → Сейчас", "Объем сделок", acp.sub === "hist" ? "Итог" : "Выигрыш", "Стоимость"];
      html = list.length ? `<div class="table-wrap" style="margin:0"><table class="acc-tx acp-tx"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${list.map((x) => {
        const act = x.live ? (x.sell ? `<button type="button" class="sell" data-sell="${x.sell}">Продать</button>` : `<button type="button" class="sell" data-acp-close="${x.close}">Закрыть</button>`) : `<span class="tag ${x.pnl >= 0 ? "yes" : "no"}">${x.status}</span>`;
        const c4 = perps ? (x.live ? x.liq : "—") : x.live ? rub(x.win) : x.status;
        return `<tr><td class="ev">${mk(x)}</td><td>${x.avg ? `${x.avg} → ${x.cur}` : "—"}</td><td>${rub(x.vol)}${perps && x.notional ? `<small>объём ${rub(x.notional)}</small>` : ""}</td><td>${c4}</td><td><b>${rub(x.value)}</b>${pnlCell(x)}<span class="acp-act">${act}</span></td></tr>`;
      }).join("")}</tbody></table></div>` : `<p class="acp-empty">${acp.sub === "hist" ? "История пуста." : "Позиции не обнаружены."}${acp.sub !== "hist" && !q ? ` <a href="${perps ? "#trade" : "#markets"}" style="color:var(--brand)">${perps ? "Открыть перпы" : "Открыть рынки"}</a>` : ""}</p>`;
    }
    host.innerHTML = html;
  }
  function bindAcp() {
    const box = $("#acc-stats");
    if (!box) return;
    box.onclick = (ev) => {
      const t = ev.target, one = (s) => t.closest(s);
      let c;
      if ((c = one("[data-acp-cat]"))) { acp.cat = c.dataset.acpCat; saveAcp(); return paintAccountStats(); }
      if ((c = one("[data-acp-range]"))) { acp.range = c.dataset.acpRange; return paintAccountStats(); }
      if ((c = one("[data-acp-sub]"))) { acp.sub = c.dataset.acpSub; return paintAccountStats(); }
      if (one("[data-acp-eye]")) { acp.hide = !acp.hide; saveAcp(); return paintAccountStats(); }
      if (one("[data-acp-wd]")) return toast("В демо вывод недоступен: на балансе игровые рубли, а не настоящие деньги");
      if ((c = one("[data-acp-close]"))) return PERPS.closeById(c.dataset.acpClose);
    };
    box.oninput = (ev) => { if (ev.target.id === "acp-q") { acp.q = ev.target.value; paintAcpList(); } };
    box.onchange = (ev) => {
      if (ev.target.id === "acp-sort") { acp.sort = ev.target.value; paintAcpList(); }
      if (ev.target.id === "acp-arch") { acp.arch = ev.target.checked; saveAcp(); paintAcpList(); }
    };
    box.onmouseover = (ev) => { if (ev.target.closest(".acp-chart")) acpHover = true; };
    box.onmouseout = (ev) => { if (ev.target.closest(".acp-chart")) acpHover = false; };
  }
  // живая оценка позиций: цены в перпах и рынки меняются, обновляем портфель
  setInterval(() => {
    if (state.route !== "account" || document.hidden || acpHover || !$("#modal").hidden) return;
    const a = document.activeElement;
    if (a && (a.id === "acp-q" || a.id === "acp-sort")) return;
    paintAccountStats();
  }, 3000);

  // ---------- профили других трейдеров (демо) ----------
  let trNick = "";
  const trv = { nick: "", cat: "pred", range: "ВСЕ", sub: "pos", q: "", sort: "new", lim: 25 };
  const trCache = {};
  // Сделки вымышленных трейдеров генерируются из их ника: итоговая прибыль сходится с таблицей лидеров.
  function trSpec(t) {
    if (trCache[t.nick]) return trCache[t.nick];
    const rnd = mulberry(hash(t.nick) ^ 0x5bd1), now = Date.now(), N = Math.min(t.trades, 400);
    const predShare = 0.45 + rnd() * 0.35, syms = PERPS.sim.syms(), winRate = t.win / 100;
    const LEV = [1, 2, 3, 5, 5, 10, 10, 20];
    const hist = [];
    for (let i = 0; i < N; i++) {
      const ts = now - 3600e3 - Math.pow(rnd(), 0.85) * 120 * DAY, win = rnd() < winRate;
      if (rnd() < predShare) {
        const e = EVENTS[Math.floor(rnd() * EVENTS.length)], p = 10 + rnd() * 75, amt = 300 * Math.exp(rnd() * 3.5), shares = (amt / p) * 100;
        hist.push({ cat: "pred", ts, eid: e.id, side: rnd() < 0.5 ? "yes" : "no", p, amt, shares, win, pnl: win ? (shares - amt) * 0.98 : -amt });
      } else {
        const sym = syms[Math.floor(rnd() * syms.length)], dir = rnd() < 0.55 ? "long" : "short", lev = LEV[Math.floor(rnd() * LEV.length)], amt = 500 * Math.exp(rnd() * 3.2), move = 0.003 + rnd() * 0.05, base = 0.8 + rnd() * 0.4;
        const liqd = !win && lev * move >= 0.9, pnl = win ? amt * lev * move - amt * lev * 0.001 : liqd ? -amt : -Math.min(amt, amt * lev * move) - amt * lev * 0.001;
        hist.push({ cat: "perps", ts, sym, dir, lev, amt, win, move, base, pnl, kind: liqd ? "liq" : win ? "tp" : "sl" });
      }
    }
    // масштаб размеров: выигрыши (при прибыли) или проигрыши (при убытке) подгоняем под итог из рейтинга
    const P = hist.filter((x) => x.pnl > 0).reduce((s, x) => s + x.pnl, 0), Ng = -hist.filter((x) => x.pnl < 0).reduce((s, x) => s + x.pnl, 0);
    if (t.profit >= 0 ? P > 0 : Ng > 0) {
      const k = clamp(t.profit >= 0 ? (t.profit + Ng) / P : (P - t.profit) / Ng, 0.2, 60);
      hist.forEach((x) => { if (t.profit >= 0 ? x.pnl > 0 : x.pnl < 0) { x.pnl *= k; x.amt *= k; if (x.shares) x.shares *= k; } });
    }
    const resid = t.profit - hist.reduce((s, x) => s + x.pnl, 0), big = hist.reduce((m, x) => (!m || Math.abs(x.pnl) > Math.abs(m.pnl) ? x : m), null);
    if (big) big.pnl += resid;
    hist.sort((a, b) => b.ts - a.ts);
    // открытые позиции
    const open = [], np = 3 + Math.floor(rnd() * 4), nt = 2 + Math.floor(rnd() * 3), used = new Set();
    for (let i = 0; i < np; i++) {
      const e = EVENTS[Math.floor(rnd() * EVENTS.length)];
      if (used.has(e.id)) continue; used.add(e.id);
      const side = rnd() < 0.5 ? "yes" : "no", cur = side === "yes" ? prob(e) : 100 - prob(e), p = clamp(cur + (rnd() - 0.5) * 24, 4, 96), amt = 400 * Math.exp(rnd() * 3);
      open.push({ cat: "pred", ts: now - rnd() * 20 * DAY, eid: e.id, side, p, amt, shares: (amt / p) * 100 });
    }
    for (let i = 0; i < nt; i++) {
      const sym = syms[Math.floor(rnd() * syms.length)], inf = PERPS.sim.info(sym), dir = rnd() < 0.55 ? "long" : "short", lev = LEV[Math.floor(rnd() * LEV.length)];
      open.push({ cat: "perps", ts: now - rnd() * 6 * DAY, sym, dir, lev, amt: 500 * Math.exp(rnd() * 2.8), entry: inf.cur * (1 + (rnd() - 0.5) * 0.08) });
    }
    return (trCache[t.nick] = { hist, open });
  }
  // Открытые позиции с живой оценкой по текущим ценам.
  function trOpenLive(spec, cat) {
    return spec.open.filter((x) => x.cat === cat).map((x) => {
      if (cat === "pred") {
        const e = byId(x.eid), cur = x.side === "yes" ? prob(e) : 100 - prob(e), value = ((x.shares * cur) / 100) * (1 - FEE);
        return { ...x, title: e.q, cur, value, pnl: value - x.amt };
      }
      const inf = PERPS.sim.info(x.sym), d = x.dir === "long" ? 1 : -1, pnl = x.amt * x.lev * d * (inf.cur / x.entry - 1);
      return { ...x, ...inf, curTxt: inf.fmt(inf.cur), entryTxt: inf.fmt(x.entry), value: Math.max(0, x.amt + pnl), pnl };
    });
  }
  function viewTrader() {
    const rows = [...TRADERS].sort((a, b) => b.profit - a.profit), i = rows.findIndex((t) => t.nick === trNick), t = rows[i];
    if (!t) return `<div class="wrap"><div class="fs-top"><a class="fs-back" href="#leaderboard">← К рейтингу</a></div><h1 class="page-title">Трейдер не найден</h1></div>`;
    if (trv.nick !== t.nick) Object.assign(trv, { nick: t.nick, cat: "pred", range: "ВСЕ", sub: "pos", q: "", sort: "new", lim: 25 });
    const col = t.color || traderColor(t.nick);
    return `<div class="wrap trd">
      <div class="fs-top"><a class="fs-back" href="#leaderboard">← К рейтингу</a></div>
      <div class="trd-head">${avatar(t.nick, col, "lg")}<div><h1>${esc(t.nick)}</h1><span class="trd-rank">Место №${i + 1} в рейтинге · демо-трейдер</span></div></div>
      <div class="kpis trd-kpis">
        <div class="kpi"><b class="${t.profit >= 0 ? "pos" : "neg"}">${signed(t.profit)} ₽</b><span>общая прибыль</span></div>
        <div class="kpi"><b class="${t.pnl >= 0 ? "pos" : "neg"}">${t.pnl > 0 ? "+" : t.pnl < 0 ? "−" : ""}${Math.abs(t.pnl).toFixed(1).replace(".", ",")}%</b><span>доходность (PNL)</span></div>
        <div class="kpi"><b>${t.trades}</b><span>сделок</span></div>
        <div class="kpi"><b>${t.win}%</b><span>прибыльных сделок</span></div>
      </div>
      <div id="tr-body"></div>
      <p class="fee-note" style="margin:18px 0 40px">Демо: трейдеры и их сделки вымышлены. История генерируется из ника трейдера, а итоговая прибыль совпадает с таблицей лидеров. Открытые позиции оцениваются по текущим ценам рынков и перпов.</p>
    </div>`;
  }
  function paintTrader() {
    const host = $("#tr-body");
    if (!host) return;
    const t = TRADERS.find((x) => x.nick === trv.nick);
    if (!t) return;
    const spec = trSpec(t), perps = trv.cat === "perps";
    const hist = spec.hist.filter((x) => x.cat === trv.cat), open = trOpenLive(spec, trv.cat);
    const d = { open: open.map((x) => ({ pnl: x.pnl })), hist: hist.map((x) => ({ ts: x.ts, pnl: x.pnl })) };
    const pnl = acpPnl(d, trv.range), val = open.reduce((s, x) => s + x.value, 0), unreal = open.reduce((s, x) => s + x.pnl, 0);
    const wins = hist.filter((x) => x.pnl > 0).length, best = hist.reduce((m, x) => Math.max(m, x.pnl), 0), all = hist.reduce((s, x) => s + x.pnl, 0);
    const keep = document.activeElement && document.activeElement.id === "tr-q";
    const top = `
      <div class="acp-tabs" role="tablist">${[["pred", "Прогнозы"], ["perps", "Перпы"]].map(([k, n]) => `<button type="button" role="tab" data-tr-cat="${k}" class="${trv.cat === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="acp-cards">
        <div class="acp-card">
          <div class="acp-main"><small>Открытые позиции · ${perps ? "перпы" : "прогнозы"}</small><b class="acp-big">${rub(val)}</b>
            <span class="acp-sub ${unreal >= 0 ? "pos" : "neg"}">${signed(unreal)} ₽ <i>нереализованный результат</i></span></div>
          <div class="trd-mini">
            <div><b>${hist.length}</b><span>закрытых сделок</span></div>
            <div><b>${hist.length ? Math.round((wins / hist.length) * 100) : 0}%</b><span>прибыльных</span></div>
            <div><b class="${all >= 0 ? "pos" : "neg"}">${signed(all)} ₽</b><span>результат в категории</span></div>
            <div><b class="pos">${best > 0 ? "+" + nf.format(Math.round(best)) + " ₽" : "—"}</b><span>лучшая сделка</span></div>
          </div>
        </div>
        <div class="acp-card">
          <div class="acp-row acp-prow">
            <div class="acp-main"><small><span class="acp-dot ${pnl.total >= 0 ? "pos" : "neg"}"></span>Прибыль/убыток</small>
              <b class="acp-big ${pnl.total >= 0 ? "pos" : "neg"}">${signed(pnl.total)} ₽</b>
              <span class="acp-sub muted">${ACP_NAME[trv.range][0].toUpperCase() + ACP_NAME[trv.range].slice(1)}</span></div>
            <div class="acp-rng">${ACP_RANGES.map((k) => `<button type="button" data-tr-range="${k}" class="${trv.range === k ? "on" : ""}">${k}</button>`).join("")}<span class="acp-brand">${document.querySelector(".logo-svg") ? document.querySelector(".logo-svg").outerHTML : ""}RusPredict</span></div>
          </div>
          <div id="tr-chart" class="acp-chart"></div>
        </div>
      </div>
      <div class="acp-tools"><div class="acp-sub-tabs" role="tablist">${[["pos", "Позиции", open.length], ["hist", "История сделок", hist.length]].map(([k, n, c]) => `<button type="button" role="tab" data-tr-sub="${k}" class="${trv.sub === k ? "on" : ""}">${n} <em>${c}</em></button>`).join("")}</div>
        <label class="acp-search">${ICO.search}<input id="tr-q" type="search" placeholder="Поиск" value="${esc(trv.q)}" autocomplete="off"></label>
        <select id="tr-sort" class="acp-sort" aria-label="Сортировка">${[["new", "Сначала новые"], ["pnl", "Лучшие результаты"], ["loss", "Худшие результаты"], ["amt", "Крупные сделки"]].map(([k, n]) => `<option value="${k}" ${trv.sort === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div id="tr-list"></div>`;
    if (!keep) host.innerHTML = top; else { $(".acp-tabs", host).outerHTML = top.slice(0, top.indexOf("</div>") + 6); }
    paintAcpChart(d, "#tr-chart", trv.range);
    paintTrList(open, hist);
  }
  function paintTrList(open, hist) {
    const host = $("#tr-list");
    if (!host) return;
    if (!open) { const t = TRADERS.find((x) => x.nick === trv.nick), sp = trSpec(t); open = trOpenLive(sp, trv.cat); hist = sp.hist.filter((x) => x.cat === trv.cat); }
    const perps = trv.cat === "perps", q = trv.q.trim().toLowerCase();
    const title = (x) => (perps ? (x.sym + " " + (PERPS.sim.info(x.sym) || {}).name) : byId(x.eid).q).toLowerCase();
    const sorters = { new: (a, b) => b.ts - a.ts, pnl: (a, b) => b.pnl - a.pnl, loss: (a, b) => a.pnl - b.pnl, amt: (a, b) => b.amt - a.amt };
    const side = (x) => (perps ? `<span class="tag ${x.dir === "long" ? "yes" : "no"}">${x.dir === "long" ? "Long" : "Short"} ${x.lev === 1 ? "без плеча" : x.lev + "x"}</span>` : `<span class="tag ${x.side}">${x.side === "yes" ? "Да" : "Нет"}</span>`);
    const mk = (x) => {
      if (perps) { const inf = PERPS.sim.info(x.sym); return `<a href="#trade" class="acp-mk" data-goasset="${x.sym}">${inf.badge}<span><b>${esc(x.sym)}-PERP</b><small>${esc(inf.name)} · ${side(x)}</small></span></a>`; }
      const e = byId(x.eid);
      return `<span class="acp-mk" role="button" tabindex="0" data-open="${e.id}"><span><b>${esc(e.q)}</b><small>${side(x)}</small></span></span>`;
    };
    const resTxt = (x) => `<b class="${x.pnl >= 0 ? "pos" : "neg"}">${signed(x.pnl)} ₽</b><small class="${x.pnl >= 0 ? "pos" : "neg"}">${x.pnl >= 0 ? "+" : "−"}${Math.abs((x.pnl / x.amt) * 100).toFixed(1).replace(".", ",")}%</small>`;
    let html;
    if (trv.sub === "pos") {
      const list = open.filter((x) => !q || title(x).includes(q)).sort((a, b) => (trv.sort === "new" ? b.ts - a.ts : sorters[trv.sort](a, b)));
      html = list.length ? `<div class="table-wrap" style="margin:0"><table class="acc-tx acp-tx"><thead><tr><th>${perps ? "Позиция" : "Рынок"}</th><th>${perps ? "Вход → Сейчас" : "Средн. → Сейчас"}</th><th>${perps ? "Маржа" : "Вложено"}</th><th>Открыта</th><th>Стоимость</th></tr></thead><tbody>${list.map((x) => `<tr><td class="ev">${mk(x)}</td><td>${perps ? `${x.entryTxt} → ${x.curTxt}` : `${pct1(x.p)}% → ${pct1(x.cur)}%`}</td><td>${rub(x.amt)}</td><td><span class="tx-when">${when(x.ts).abs}</span></td><td><b>${rub(x.value)}</b><small class="${x.pnl >= 0 ? "pos" : "neg"}">${signed(x.pnl)} ₽ (${x.pnl >= 0 ? "+" : "−"}${Math.abs((x.pnl / x.amt) * 100).toFixed(1).replace(".", ",")}%)</small></td></tr>`).join("")}</tbody></table></div>` : `<p class="acp-empty">Открытых позиций нет.</p>`;
    } else {
      const list = hist.filter((x) => !q || title(x).includes(q)).sort(sorters[trv.sort]);
      const kindTag = (x) => (perps ? `<span class="tag ${x.pnl >= 0 ? "yes" : "no"}">${{ liq: "Ликвидация", tp: "Тейк-профит", sl: "Стоп-лосс" }[x.kind]}</span>` : `<span class="tag ${x.pnl >= 0 ? "yes" : "no"}">${x.pnl >= 0 ? "Выигрыш" : "Проигрыш"}</span>`);
      html = list.length ? `<div class="table-wrap" style="margin:0"><table class="acc-tx acp-tx"><thead><tr><th>${perps ? "Позиция" : "Рынок"}</th><th>Когда</th><th>${perps ? "Вход → Выход" : "Цена входа"}</th><th>${perps ? "Маржа" : "Вложено"}</th><th>Результат</th></tr></thead><tbody>${list.slice(0, trv.lim).map((x) => {
        const w = when(x.ts), inf = perps ? PERPS.sim.info(x.sym) : null, entry = perps ? inf.cur * x.base : 0, exit = perps ? entry * (1 + (x.dir === "long" ? 1 : -1) * (x.kind === "liq" ? -1 / x.lev : (x.win ? 1 : -1) * x.move)) : 0;
        return `<tr><td class="ev">${mk(x)}</td><td><span class="tx-when">${w.abs}</span><small>${w.rel}</small></td><td>${perps ? `${inf.fmt(entry)} → ${inf.fmt(exit)}` : `${pct1(x.p)}% · ${coefTxt(x.p)}`}</td><td>${rub(x.amt)}</td><td>${resTxt(x)}<span class="acp-act">${kindTag(x)}</span></td></tr>`;
      }).join("")}</tbody></table></div>${list.length > trv.lim ? `<button type="button" class="sbtn" style="margin-top:12px" data-tr-more>Показать ещё (${list.length - trv.lim})</button>` : ""}` : `<p class="acp-empty">Сделок не найдено.</p>`;
    }
    host.innerHTML = html;
  }
  function bindTrader() {
    const v = $("#view");
    paintTrader();
    v.onclick = (ev) => {
      const t = ev.target; let c;
      if ((c = t.closest("[data-tr-cat]"))) { trv.cat = c.dataset.trCat; trv.lim = 25; return paintTrader(); }
      if ((c = t.closest("[data-tr-range]"))) { trv.range = c.dataset.trRange; return paintTrader(); }
      if ((c = t.closest("[data-tr-sub]"))) { trv.sub = c.dataset.trSub; trv.lim = 25; return paintTrader(); }
      if (t.closest("[data-tr-more]")) { trv.lim += 25; return paintTrList(); }
    };
    v.oninput = (ev) => { if (ev.target.id === "tr-q") { trv.q = ev.target.value; trv.lim = 25; paintTrList(); } };
    v.onchange = (ev) => { if (ev.target.id === "tr-sort") { trv.sort = ev.target.value; paintTrList(); } };
    v.onmouseover = (ev) => { if (ev.target.closest(".acp-chart")) acpHover = true; };
    v.onmouseout = (ev) => { if (ev.target.closest(".acp-chart")) acpHover = false; };
  }
  setInterval(() => { if (state.route === "trader" && !document.hidden && !acpHover && $("#modal").hidden && !(document.activeElement && /^tr-/.test(document.activeElement.id || ""))) paintTrader(); }, 4000);

  // ---------- история пополнений ----------
  let depFilter = "all", depLimit = 10;
  const depVia = (d) => {
    if (d.method === "sbp") return { head: "СБП", sub: d.via, icon: d.via };
    const [coin, net] = String(d.via).split(" · ");
    return { head: "Криптовалюта", sub: coin + (net ? " · " + net : ""), icon: coin };
  };
  function paintDeposits() {
    const box = $("#acc-dep");
    if (!box) return;
    const sum = (m) => deposits.filter((d) => !m || d.method === m).reduce((s, d) => s + d.rub, 0);
    const cnt = (m) => deposits.filter((d) => !m || d.method === m).length;
    const list = deposits.filter((d) => depFilter === "all" || d.method === depFilter).slice().reverse();
    const tabs = [["all", "Все", cnt()], ["sbp", "СБП", cnt("sbp")], ["crypto", "Криптовалюта", cnt("crypto")]];
    box.innerHTML = `
      <div class="kpis">
        <div class="kpi"><b>${rub(sum())}</b><span>всего пополнено (${cnt()})</span></div>
        <div class="kpi"><b>${rub(sum("sbp"))}</b><span>через СБП (${cnt("sbp")})</span></div>
        <div class="kpi"><b>${rub(sum("crypto"))}</b><span>криптовалютой (${cnt("crypto")})</span></div>
      </div>
      <div class="chips" style="margin-bottom:12px">${tabs.map(([id, n, c]) => `<button class="chip ${id === depFilter ? "on" : ""}" data-depf="${id}">${n} · ${c}</button>`).join("")}</div>
      ${list.length
        ? `<div class="table-wrap" style="margin:0"><table class="acc-tx"><thead><tr><th>Когда</th><th>Способ</th><th>Банк или монета</th><th>Отправлено</th><th>Номер платежа</th><th>Статус</th><th>Зачислено</th></tr></thead><tbody>${list.slice(0, depLimit).map((d) => {
            const v = depVia(d), w = when(d.t);
            return `<tr>
              <td><span class="tx-when">${w.abs}</span><small>${w.rel}</small></td>
              <td><span class="dp-inl" style="justify-content:flex-start">${payIcon(d.method === "sbp" ? "sbp" : "crypto", 24)}${v.head}</span></td>
              <td><span class="dp-inl" style="justify-content:flex-start">${payIcon(v.icon, 24)}${esc(v.sub)}</span></td>
              <td>${d.coin ? esc(d.coin) : rub(d.rub)}${d.rate ? `<small class="dp-rt">курс ${nf.format(Math.round(d.rate * 100) / 100)} ₽${d.live ? "" : " (демо)"}</small>` : ""}</td>
              <td>${d.method === "sbp" ? "СБП-" : ""}${esc(d.id)}</td>
              <td><span class="tag yes">Зачислено</span></td>
              <td class="pos"><b>+${rub(d.rub)}</b></td>
            </tr>`;
          }).join("")}</tbody></table></div>${list.length > depLimit ? `<button class="sbtn" style="margin-top:12px" data-depmore>Показать ещё (${list.length - depLimit})</button>` : ""}`
        : `<p class="empty" style="padding:18px">${deposits.length ? "По этому способу пополнений нет." : "Пополнений пока нет."} <a href="#account" style="color:var(--brand)" data-deposit>Пополнить баланс</a></p>`}`;
  }

  // ---------- все операции аккаунта (рынки прогнозов, перпы и пополнения) ----------
  let accFilter = "all", accLimit = 15;
  function allTrades() {
    const rows = [];
    myTx.forEach((x) => {
      const e = byId(x.eid);
      if (!e) return;
      rows.push({ t: x.t, sec: "pred", title: e.q, action: `${TX_LABEL[x.kind] || "Покупка"} · ${x.side === "yes" ? "Да" : "Нет"}`, cls: x.side, amt: x.amt, priceText: pct1(x.price) + "% · " + coefTxt(x.price), pnl: x.pnl === undefined ? null : x.pnl });
    });
    PERPS.rows().forEach((r) => rows.push(r));
    deposits.forEach((d) => { const v = depVia(d); rows.push({ t: d.t, sec: "dep", title: "Пополнение баланса", action: v.head === "СБП" ? "СБП · " + v.sub : v.sub, cls: "yes", amt: d.rub, priceText: (d.method === "sbp" ? "СБП-" : "") + d.id, pnl: null }); });
    return rows.sort((a, b) => b.t - a.t);
  }
  function paintAccountTx() {
    const box = $("#acc-tx");
    if (!box) return;
    const all = allTrades();
    const list = all.filter((r) => accFilter === "all" || r.sec === accFilter);
    const tabs = [["all", "Все"], ["pred", "Рынки прогнозов"], ["perp", "Перпы"], ["dep", "Пополнения"]];
    $("#acc-txf").innerHTML = tabs.map(([id, n]) => `<button class="chip ${id === accFilter ? "on" : ""}" data-txf="${id}">${n} · ${id === "all" ? all.length : all.filter((r) => r.sec === id).length}</button>`).join("");
    if (!list.length) {
      box.innerHTML = `<p class="empty" style="padding:18px">Сделок пока нет. Откройте <a href="#markets" style="color:var(--brand)">рынки</a> или <a href="#trade" style="color:var(--brand)">перпы</a>.</p>`;
      return;
    }
    box.innerHTML = `<div class="table-wrap" style="margin:0"><table class="acc-tx"><thead><tr><th>Когда</th><th>Раздел</th><th>Событие</th><th>Сделка</th><th>Сумма</th><th>Вер. · коэф.</th><th>Результат</th></tr></thead><tbody>${list.slice(0, accLimit).map((r) => {
      const w = when(r.t);
      return `<tr>
        <td><span class="tx-when">${w.abs}</span><small>${w.rel}</small></td>
        <td>${{ pred: "Прогноз", perp: "Перпы", dep: "Пополнение" }[r.sec]}</td>
        <td class="ev">${esc(r.title)}</td>
        <td><span class="tag ${r.cls}">${esc(r.action)}</span></td>
        <td>${rub(r.amt)}</td>
        <td>${r.priceText}</td>
        <td class="${r.pnl === null ? "" : r.pnl >= 0 ? "pos" : "neg"}">${r.pnl === null ? "—" : signed(r.pnl) + " ₽"}</td>
      </tr>`;
    }).join("")}</tbody></table></div>${list.length > accLimit ? `<button class="sbtn" style="margin-top:12px" data-txmore>Показать ещё (${list.length - accLimit})</button>` : ""}`;
  }

  function viewAccount() {
    return `<div class="wrap">
      <h1 class="page-title">Мой аккаунт</h1>
      <p class="page-sub">Данные профиля хранятся в вашем браузере и меняются в любой момент.</p>
      <div class="acp" id="acc-stats"><div id="acp-top"></div><div id="acp-tools"></div><div id="acp-list"></div></div>
      <div class="acc">
        <div class="panel">
          <h3>Профиль</h3>
          <div class="profile-head">
            <span id="av">${avatar(profile.nick, profile.color, "lg")}</span>
            <div><b id="av-name">${esc(profile.nick)}</b><span>${esc(profile.city) || "Город не указан"}</span></div>
          </div>
          <form id="profile-form">
            <label class="l" for="f-nick">Никнейм</label>
            <input class="field" id="f-nick" maxlength="24" value="${esc(profile.nick)}" required>
            <label class="l" for="f-city">Город</label>
            <input class="field" id="f-city" maxlength="40" value="${esc(profile.city)}" placeholder="Например, Казань">
            <label class="l" for="f-bio">О себе</label>
            <textarea class="field" id="f-bio" maxlength="140" placeholder="Коротко о вашей стратегии">${esc(profile.bio)}</textarea>
            <label class="l" for="f-fav">Любимая категория</label>
            <select class="field" id="f-fav">
              <option value="all">Все категории</option>
              ${CATEGORIES.map((c) => `<option value="${c.id}" ${profile.fav === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
            </select>
            <label class="l">Цвет аватара</label>
            <div class="swatches" id="swatches">${COLORS.map((c) => `<button type="button" class="swatch ${c === profile.color ? "on" : ""}" data-color="${c}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join("")}</div>
            <div class="row-actions">
              <button class="pbtn" type="submit">Сохранить</button>
              <button class="sbtn" type="button" data-settings>Настройки</button>
              <button class="sbtn danger" type="button" id="reset">Сбросить аккаунт</button>
            </div>
          </form>
        </div>
        <div class="panel" id="acc-right">${accountRight()}</div>
      </div>
      <div class="panel" style="margin:16px 0">
        <h3>История пополнений</h3>
        <div id="acc-dep"></div>
      </div>
      <div class="panel" style="margin-bottom:40px">
        <h3>Все операции</h3>
        <div id="acc-txf" class="chips" style="margin-bottom:12px"></div>
        <div id="acc-tx"></div>
      </div>
    </div>`;
  }

  // ---------- рефералы (демо) ----------
  // Серверов нет, поэтому приглашённые пользователи и их сделки симулируются: так видно, как работает программа.
  // Доход реферера — 15% комиссий платформы с торговли прямых рефералов и 5% с непрямых (тех, кого пригласили ваши рефералы): на рынках прогнозов (2% при продаже и с выигрыша)
  // и в перпах (0,05% при открытии и закрытии позиции). Одни и те же данные при каждом открытии страницы (генератор с зерном).
  const REF_PCT = { 1: 0.15, 2: 0.05 }, DAY = 86400e3; // доля реферера: 15% с прямых рефералов и 5% с непрямых (приглашённых вашими рефералами)
  const REF_NICKS = ["Тихий_Омут", "Рубль_Мастер", "Нефтяной_Лис", "Крипто_Барон", "Сибирский_Волк", "Бык_с_Арбата", "Золотая_Рыбка", "Кедр_Капитал", "Уральский_Шорт", "Лунный_Трейдер", "Дон_Хеджер", "Мартовский_Заяц", "Байкал_Алго", "Северный_Лонг", "Степной_Бот", "Алтайский_Бык"];
  let refs = store.get("refs", { list: [], claimed: { pred: 0, perps: 0 } });
  if (!refs.claimed) refs.claimed = { pred: 0, perps: 0 };
  const saveRefs = () => store.set("refs", refs);
  // Рефералы и награды открываются и на странице «Бонус», и на весь экран из настроек: bq ищет элементы в нужном месте
  let bonusFs = null;
  const bq = (s) => (bonusFs ? $(s, $("#sheet-body")) : $(s));
  const bqa = (s) => (bonusFs ? $("#sheet-body") : document).querySelectorAll(s);
  let refTab = "pred", refMetric = "inc";
  const refLink = () => "ruspredict.ru/?r=" + profile.nick; // для показа; в буфер уходит версия с кодированием
  const refUrl = () => "https://ruspredict.ru/?r=" + encodeURIComponent(profile.nick);
  const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  // сделки одного реферала в одной категории: [{ t, fee, inc }]
  function refEvents(r, cat) {
    if (!r.cats[cat]) return [];
    const rnd = mulberry(r.seed + (cat === "pred" ? 11 : 29)), out = [], now = Date.now();
    for (let t = r.t; t < now; t += 3600e3) {
      const h = new Date(t).getHours();
      if (rnd() < r.rate[cat] * (h >= 9 ? 1 : 0.3)) {
        const fee = cat === "pred" ? (1000 + rnd() * 39000) * 0.02 : (20000 + rnd() * 580000) * 0.0005 * 2;
        out.push({ t: t + Math.floor(rnd() * 3600e3), fee, inc: fee * REF_PCT[r.lvl || 1] });
      }
    }
    return out;
  }
  function refStats(cat) {
    const now = Date.now(), first = dayStart(now - 6 * DAY);
    const list = refs.list.filter((r) => r.cats[cat]);
    const days = Array.from({ length: 7 }, (_, i) => first + i * DAY);
    const rows = list.map((r) => { const ev = refEvents(r, cat); return { r, ev, lvl: r.lvl || 1, fee: ev.reduce((s, e) => s + e.fee, 0), inc: ev.reduce((s, e) => s + e.inc, 0) }; });
    const reg = days.map((d) => list.filter((r) => r.t < d + DAY).length);
    const act = days.map((d) => rows.filter((x) => x.ev.some((e) => e.t >= d && e.t < d + DAY)).length);
    const inc = days.map((d) => rows.reduce((s, x) => s + x.ev.filter((e) => e.t >= d && e.t < d + DAY).reduce((q, e) => q + e.inc, 0), 0));
    const total = rows.reduce((s, x) => s + x.inc, 0);
    const byLvl = (l) => rows.filter((x) => x.lvl === l);
    return { days, rows, reg, act, inc, regN: list.length, direct: byLvl(1).length, indirect: byLvl(2).length, incDirect: byLvl(1).reduce((s, x) => s + x.inc, 0), incIndirect: byLvl(2).reduce((s, x) => s + x.inc, 0), actN: rows.filter((x) => x.ev.some((e) => e.t >= now - 7 * DAY)).length, total, avail: Math.max(0, Math.floor(total) - refs.claimed[cat]) };
  }
  const REF_TXT = {
    pred: { tab: "Прогнозы", ico: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>', line: "за торговлю на рынках прогнозов", rule: "2% при продаже позиции и 2% с выигрыша" },
    perps: { tab: "Перпы", ico: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>', line: "за торговлю в перпах", rule: "0,05% при открытии и 0,05% при закрытии позиции" }
  };
  const REF_METRICS = { reg: "Регистрации", act: "Активные трейдеры", inc: "Доход" };
  const refVal = (m, v) => (m === "inc" ? rub(v) : String(Math.round(v)));
  function refChart(st) {
    const vals = st[refMetric], n = vals.length;
    const W = 900, H = 280, L = 18, R = 54, T = 22, B = 36, top = Math.max(...vals) || 1;
    const g = { W, H, L, R, T, B, n, x: (i) => L + (i * (W - L - R)) / (n - 1), y: (v) => T + (1 - v / (top * 1.15)) * (H - T - B) };
    const base = H - B, line = vals.map((v, i) => (i ? "L" : "M") + g.x(i).toFixed(1) + " " + g.y(v).toFixed(1)).join("");
    const ticks = [0, 0.5, 1].map((k) => ({ v: top * 1.15 * k, y: g.y(top * 1.15 * k) }));
    const fmt = (t) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    const svg = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg up rf-svg" role="img" aria-label="${REF_METRICS[refMetric]} за 7 дней">
      ${ticks.map((t) => `<line class="gl" x1="${L}" x2="${W - R + 8}" y1="${t.y.toFixed(1)}" y2="${t.y.toFixed(1)}"/><text class="tx" x="${W - R + 14}" y="${(t.y + 4).toFixed(1)}">${t.v === 0 ? "0" : refMetric === "inc" ? Math.round(t.v) : Math.round(t.v * 10) / 10}</text>`).join("")}
      ${st.days.map((d, i) => `<text class="tx" x="${g.x(i).toFixed(1)}" y="${H - 10}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${fmt(d)}</text>`).join("")}
      <path class="ca" d="${line}L${g.x(n - 1).toFixed(1)} ${base}L${g.x(0)} ${base}Z"/><path class="cl rf-line" d="${line}"/>
      <line class="cross" y1="${T}" y2="${base}" hidden/><circle class="dot" r="4.5" hidden/>
    </svg>`;
    return { svg, g, vals, fmt, days: st.days };
  }
  function paintRefChart(st) {
    const host = bq("#rf-chart");
    if (!host) return;
    const c = refChart(st);
    host.innerHTML = c.svg;
    attachHover($("svg", host), c.g, c.vals, { val: (v) => refVal(refMetric, v), time: (i) => c.fmt(c.days[i]) });
  }
  function refBodyHTML() {
    const st = refStats(refTab), T = REF_TXT[refTab];
    const sub = { reg: st.regN ? `${st.direct} прямых · ${st.indirect} непрямых` : "", act: "", inc: st.total ? `прямые ${rub(st.incDirect)} · непрямые ${rub(st.incIndirect)}` : "" };
    const head = (m, extra = "") => `<button type="button" class="rf-stat ${refMetric === m ? "on" : ""}" data-rm="${m}"><small>${REF_METRICS[m]}${extra}</small><b>${refVal(m, m === "reg" ? st.regN : m === "act" ? st.actN : st.total)}</b>${sub[m] ? `<em>${sub[m]}</em>` : ""}</button>`;
    const coin = '<span class="rf-coin" aria-hidden="true"></span>';
    const table = st.rows.length
      ? `<div class="table-wrap" style="margin:0"><table class="acc-tx"><thead><tr><th>Реферал</th><th>Уровень</th><th>Присоединился</th><th>Сделок</th><th>Комиссии платформе</th><th>Ваш доход</th></tr></thead><tbody>${st.rows.slice().sort((x, y) => y.inc - x.inc).map((x) => `<tr><td><span class="dp-inl" style="justify-content:flex-start">${avatar(x.r.nick, traderColor(x.r.nick), "")}${esc(x.r.nick)}</span></td><td>${x.lvl === 1 ? '<span class="tag yes">Прямой · 15%</span>' : `<span class="tag no rf-ind">Непрямой · 5%</span><small class="rf-via">через ${esc((refs.list.find((q) => q.id === x.r.parent) || {}).nick || "—")}</small>`}</td><td>${new Date(x.r.t).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</td><td>${x.ev.length}</td><td>${rub(x.fee)}</td><td class="pos"><b>+${rub(x.inc)}</b></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="empty" style="padding:22px">Рефералов пока нет. Поделитесь ссылкой, а в демо добавьте тестового реферала кнопкой ниже.</p>`;
    return `<div class="rf-card">
        <div class="rf-stats">${head("reg")}${head("act")}${head("inc", coin)}</div>
        <div class="rf-chart"><div class="rf-wm">${document.querySelector(".logo-svg") ? document.querySelector(".logo-svg").outerHTML : ""}<span>RusPredict</span></div><div id="rf-chart"></div><small class="rf-upd">Данные обновляются каждые 30 минут</small></div>
      </div>
      <div class="rf-pay"><div><small>Доступно к выводу</small><b>${rub(st.avail)}</b></div><button type="button" class="pbtn" data-refclaim ${st.avail >= 1 ? "" : "disabled"}>Забрать на баланс</button></div>
      <div class="panel" style="margin:16px 0"><h3>Ваши рефералы · <span class="rf-chip">${T.tab}</span></h3>${table}
        <div class="row-actions" style="margin-top:14px"><button type="button" class="sbtn" data-refadd>Добавить прямого реферала (демо)</button><button type="button" class="sbtn" data-refadd2 ${refs.list.some((r) => (r.lvl || 1) === 1) ? "" : "disabled"} title="Реферал вашего реферала">Добавить непрямого (демо)</button>${refs.list.length ? '<button type="button" class="sbtn danger" data-refclear>Удалить тестовых</button>' : ""}</div>
        <p class="fee-note">Демо: рефералы и их сделки симулируются, реальных приглашений нет. Доход считается как 15% от комиссий платформы с торговли прямых рефералов и 5% с торговли непрямых (${T.rule}) и начисляется игровыми рублями.</p></div>`;
  }
  function refInnerHTML() {
    const T = REF_TXT[refTab], bolt = '<svg class="rf-bolt" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M13 2L5 14h6l-1 8 8-12h-6z" fill="#f5b301"/></svg>';
    return `<div class="ref" data-cat="${refTab}">
      <div class="rf-switch" role="tablist" aria-label="Тип рефералов">${Object.entries(REF_TXT).map(([k, v]) => { const q = refStats(k); return `<button type="button" role="tab" aria-selected="${refTab === k}" data-rtab="${k}" data-cat="${k}" class="rf-opt ${refTab === k ? "on" : ""}"><span class="rf-ico">${v.ico}</span><span class="rf-ot"><b>${v.tab}</b><small>${v.rule}</small></span><span class="rf-os"><b>${rub(q.total)}</b><small>${q.regN} реф.</small></span></button>`; }).join("")}</div>
      <div class="rf-title">
        <div><h1>Рефералы ${bolt} <span class="rf-bonus">БОНУС</span></h1>
          <div class="rf-kind"><span class="rf-ico">${T.ico}</span>${T.tab.toUpperCase()}<i>${T.line}</i></div>
          <p class="rf-sub">Получайте <b>15% комиссий</b> от прямых рефералов и <b>5% комиссий</b> от непрямых ${T.line}. <a href="#referrals" data-refinfo>Подробнее</a></p></div>
        <div class="rf-link"><span id="rf-url">${esc(refLink())}</span><button type="button" data-refcopy title="Скопировать ссылку" aria-label="Скопировать ссылку"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button></div>
      </div>
      <div class="rf-user">${avatar(profile.nick, profile.color, "lg")}<b>${esc(profile.nick)}</b></div>
      <div id="rf-body">${refBodyHTML()}</div>
    </div>`;
  }
  function paintRefs() {
    const el = bq("#rf-body");
    if (!el) return;
    el.innerHTML = refBodyHTML();
    paintRefChart(refStats(refTab));
  }
  function openRefInfo() {
    modalEvent = null;
    openSheet(`<h2>Как работают рефералы</h2>
      <ol class="rules-list">
        <li>Скопируйте свою реферальную ссылку и отправьте друзьям. Каждый, кто зарегистрируется по ней, становится вашим прямым рефералом.</li>
        <li>Вы получаете <b>15% комиссий платформы</b> с торговли прямых рефералов. Рынки прогнозов и перпы считаются отдельно, у каждой программы своя вкладка.</li>
        <li><b>Непрямой реферал</b> — тот, кто пришёл по ссылке вашего реферала. С его торговли вы получаете <b>5% комиссий платформы</b>, а его пригласивший получает свои 15%. Эти 5% платит платформа, они не уменьшают чужой доход.</li>
        <li>На рынках прогнозов комиссия платформы: 2% при продаже позиции и 2% с выигрыша. В перпах: 0,05% при открытии и 0,05% при закрытии позиции.</li>
        <li>Начисления видны в графике за 7 дней. Накопленный доход можно забрать на игровой баланс одной кнопкой.</li>
      </ol>
      <p class="fee-note">Это демонстрационный прототип: у сайта нет сервера, поэтому приглашённые пользователи и их сделки симулируются. В демо кнопки «Добавить прямого реферала» и «Добавить непрямого» создают таких пользователей, чтобы показать начисления.</p>`);
  }
  function refClick(ev) {
    {
      const t = ev.target;
      const tab = t.closest("[data-rtab]");
      if (tab) { refTab = tab.dataset.rtab; bq("#bonus-body").innerHTML = refInnerHTML(); return paintRefChart(refStats(refTab)); }
      const m = t.closest("[data-rm]");
      if (m) { refMetric = m.dataset.rm; return paintRefs(); }
      if (t.closest("[data-refcopy]")) return copyText(refUrl()).then((ok) => toast(ok ? "Ссылка скопирована" : "Не удалось скопировать, выделите ссылку вручную"));
      if (t.closest("[data-refinfo]")) { ev.preventDefault(); return openRefInfo(); }
      if (t.closest("[data-refadd]")) {
        const used = new Set(refs.list.map((r) => r.nick)), nick = REF_NICKS.find((n) => !used.has(n)) || REF_NICKS[refs.list.length % REF_NICKS.length] + "_" + (refs.list.length + 1);
        const rnd = mulberry(Date.now() % 1e9), pred = rnd() < 0.75, perps = !pred || rnd() < 0.6;
        refs.list.push({ id: Date.now().toString(36), lvl: 1, nick, t: Date.now() - (1 + Math.floor(rnd() * 5)) * DAY - Math.floor(rnd() * DAY), seed: Math.floor(rnd() * 1e9), cats: { pred, perps }, rate: { pred: 0.1 + rnd() * 0.15, perps: 0.08 + rnd() * 0.12 } });
        saveRefs(); toast(`Реферал «${nick}» добавлен (демо)`);
        return paintRefs();
      }
      if (t.closest("[data-refadd2]")) {
        const direct = refs.list.filter((r) => (r.lvl || 1) === 1);
        if (!direct.length) return toast("Сначала добавьте прямого реферала");
        const kids = (id) => refs.list.filter((r) => r.parent === id).length;
        const parent = direct.slice().sort((x, y) => kids(x.id) - kids(y.id))[0];
        const used = new Set(refs.list.map((r) => r.nick)), nick = REF_NICKS.slice().reverse().find((n) => !used.has(n)) || "Гость_" + (refs.list.length + 1);
        const rnd = mulberry((Date.now() + 7) % 1e9), perps = rnd() < 0.85, pred = rnd() < 0.85 || !perps; // чаще торгует и там и там, чтобы обе вкладки показывали доход
        refs.list.push({ id: Date.now().toString(36) + "b", lvl: 2, parent: parent.id, nick, t: Math.max(parent.t + DAY / 2, Date.now() - (1 + Math.floor(rnd() * 3)) * DAY), seed: Math.floor(rnd() * 1e9), cats: { pred, perps }, rate: { pred: 0.1 + rnd() * 0.15, perps: 0.08 + rnd() * 0.12 } });
        saveRefs(); toast(`Непрямой реферал «${nick}» (через ${parent.nick}) добавлен (демо)`);
        return paintRefs();
      }
      if (t.closest("[data-refclear]")) { refs.list = []; refs.claimed = { pred: 0, perps: 0 }; saveRefs(); return paintRefs(); }
      if (t.closest("[data-refclaim]")) {
        const st = refStats(refTab), v = Math.floor(st.avail);
        if (v < 1) return;
        refs.claimed[refTab] += v; saveRefs(); setBalance(balance + v);
        toast(`Реферальный доход ${rub(v)} зачислен на баланс`);
        return paintRefs();
      }
    }
  }

  // ---------- награды за ликвидность (демо) ----------
  // На Polymarket маркет-мейкеры получают ежедневные награды за лимитные заявки рядом с ценой. У нас цену задаёт пул, поэтому
  // награда считается за «заявки ликвидности»: вы замораживаете сумму рядом с текущей ценой рынка и делите дневной пул награды
  // с другими участниками. Балл заявки = ((макс. расстояние − расстояние) / макс. расстояние)² × размер; для заявки с обеих
  // сторон полный, с одной стороны треть. Ваша доля = ваш балл / (ваш балл + балл конкурентов). Заявки не исполняются (демо).
  const LQ_ONE = 1 / 3;
  let liq = { orders: [], banked: 0, paid: 0, days: {}, favs: [], ...store.get("liq", {}) };
  const saveLiq = () => store.set("liq", liq);
  let liqTab = "rewards", liqCat = "all", liqQ = "", liqSort = { k: "pool", dir: 1 }, liqMine = false, liqFav = false, liqOpen = null;
  const liqForm = { size: 5000, spread: null, sides: "both" };
  function lqMeta(e) {
    const comp = 1 + (hash(String(e.id)) % 5);
    return { e, pool: Math.max(100, Math.round(e.vol / 3000 / 100) * 100), maxS: e.vol >= 6e6 ? 2 : 4, minSize: 500, comp, compScore: comp * 8000 };
  }
  const lqScore = (o, m) => Math.pow(Math.max(0, (m.maxS - o.spread) / m.maxS), 2) * o.size * (o.sides === "both" ? 1 : LQ_ONE);
  const lqMy = (eid) => { const m = lqMeta(byId(eid)); return liq.orders.filter((o) => o.eid === eid).reduce((s, o) => s + lqScore(o, m), 0); };
  const lqShare = (eid) => { const my = lqMy(eid); return my ? my / (my + lqMeta(byId(eid)).compScore) : 0; };
  // ₽ в миллисекунду для одной заявки: дневной пул рынка × её доля в общем счёте рынка
  const lqRate = (o) => { const m = lqMeta(byId(o.eid)); return (m.pool * lqScore(o, m)) / (lqMy(o.eid) + m.compScore) / DAY; };
  // начисляет награду по каждой заявке с прошлого момента; делит интервал по суткам для «сегодняшней» суммы
  function lqSettle() {
    const now = Date.now();
    liq.orders.forEach((o) => {
      const r = lqRate(o);
      for (let t = o.t0; t < now;) {
        const next = Math.min(now, dayStart(t) + DAY), amt = r * (next - t), k = dayStart(t);
        o.acc += amt; liq.days[k] = (liq.days[k] || 0) + amt; t = next;
      }
      o.t0 = now;
    });
  }
  const lqUnclaimed = () => liq.banked + liq.orders.reduce((s, o) => s + o.acc, 0);
  const lqToday = () => liq.days[dayStart(Date.now())] || 0;
  const LQ_SORT = { pool: (m) => m.pool, spread: (m) => m.maxS, comp: (m) => -m.comp, earned: (m) => lqEarned(m.e.id), share: (m) => lqShare(m.e.id) };
  const lqEarned = (eid) => liq.orders.filter((o) => o.eid === eid).reduce((s, o) => s + o.acc, 0);
  const lqRows = () => {
    const q = liqQ.trim().toLowerCase();
    const list = EVENTS.filter((e) => isOpen(e) && catOn(e.cat) && (liqCat === "all" || e.cat === liqCat) && (!q || e.q.toLowerCase().includes(q))
      && (!liqMine || liq.orders.some((o) => o.eid === e.id)) && (!liqFav || liq.favs.includes(e.id))).map(lqMeta);
    const f = LQ_SORT[liqSort.k];
    return list.sort((a, b) => (f(b) - f(a)) * liqSort.dir || b.pool - a.pool);
  };
  const lqIcon = (e) => {
    const st = (typeof CAT_STYLE !== "undefined" && CAT_STYLE[e.cat]) || ["#3b5bdb", "#5f3dc4"], g = typeof GLYPHS !== "undefined" ? GLYPHS[e.img] || GLYPHS.globe : "";
    return `<span class="mk-ic" style="background:linear-gradient(135deg,${st[0]},${st[1]})"><svg viewBox="0 0 64 64" width="24" height="24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg></span>`;
  };
  const lqBars = (n) => `<span class="lq-bars c${n}" title="Конкуренция: ${n} из 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
  function lqPreview() {
    const m = lqMeta(byId(liqOpen)), sp = liqForm.spread == null ? m.maxS / 2 : liqForm.spread;
    const o = { eid: m.e.id, size: liqForm.size, spread: sp, sides: liqForm.sides }, sc = lqScore(o, m), my = lqMy(m.e.id), share = sc / (my + sc + m.compScore);
    return { m, o, sc, share, perDay: m.pool * share };
  }
  function lqFormHTML(m) {
    const sp = liqForm.spread == null ? m.maxS / 2 : liqForm.spread;
    return `<div class="lq-form">
      <div class="lq-f"><label for="lq-size">Размер заявки, ₽ (от ${rub(m.minSize)})</label><input class="field" id="lq-size" type="number" min="${m.minSize}" step="500" value="${liqForm.size}"><div class="chips">${[1000, 5000, 20000, 50000].map((v) => `<button type="button" class="chip" data-lqsize="${v}">${rub(v)}</button>`).join("")}</div></div>
      <div class="lq-f"><label for="lq-spr">Расстояние от цены: <b id="lq-sprv">${String(sp).replace(".", ",")}¢</b> (макс. ±${m.maxS}¢)</label><input class="lev" id="lq-spr" type="range" min="0" max="${m.maxS}" step="0.5" value="${sp}"><small class="muted">Чем ближе к цене, тем выше балл: он растёт в квадрате.</small></div>
      <div class="lq-f"><label>Стороны</label><div class="seg" id="lq-sides">${[["both", "Обе стороны"], ["yes", "Только «Да»"], ["no", "Только «Нет»"]].map(([k, n]) => `<button type="button" class="${liqForm.sides === k ? "on" : ""}" data-lqsides="${k}">${n}</button>`).join("")}</div><small class="muted">Заявка с одной стороны приносит треть балла.</small></div>
      <div class="lq-prev" id="lq-prev"></div>
      <button type="button" class="pbtn" data-lqplace>Выставить заявку</button>
    </div>`;
  }
  function lqPrevHTML() {
    const p = lqPreview();
    return `<div><small>Ваш балл</small><b>${nf.format(Math.round(p.sc))}</b></div><div><small>Доля пула</small><b>${(p.share * 100).toFixed(1).replace(".", ",")}%</b></div><div><small>Награда в день</small><b>${rub(p.perDay)}</b></div><div><small>Заморозится</small><b>${rub(liqForm.size)}</b></div>`;
  }
  function lqRowHTML(m) {
    const e = m.e, my = lqMy(e.id), d = e.hist[e.hist.length - 1] - e.hist[Math.max(0, e.hist.length - 25)], open = liqOpen === e.id, fav = liq.favs.includes(e.id);
    return `<div class="lq-item ${open ? "open" : ""}"><div class="lq-row" data-lqrow="${e.id}">
        <span class="lq-mk">${lqIcon(e)}<span class="lq-q">${esc(e.q)}</span></span>
        <span class="lq-c">±${m.maxS}¢</span><span class="lq-c">${m.minSize}</span><span class="lq-c lq-pool">${rub(m.pool)}</span>
        <span class="lq-c">${lqBars(m.comp)}</span><span class="lq-c ${lqEarned(e.id) > 0 ? "pos" : ""}">${rub(lqEarned(e.id))}</span>
        <span class="lq-c">${my ? (lqShare(e.id) * 100).toFixed(1).replace(".", ",") + "%" : "—"}</span>
        <span class="lq-px"><em class="yes">Да ${num0(e.yes)}¢</em><em class="no">Нет ${num0(100 - e.yes)}¢</em></span>
        <span class="lq-c ${d >= 0 ? "pos" : "neg"}">${d === 0 ? "—" : (d > 0 ? "+" : "−") + pct1(Math.abs(d))}</span>
        <button type="button" class="fav ${fav ? "on" : ""}" data-lqfav="${e.id}" aria-label="Избранное"><svg viewBox="0 0 24 24" width="20" height="20" fill="${fav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg></button>
        <span class="lq-chev" aria-hidden="true">${open ? "▴" : "▾"}</span></div>${open ? lqFormHTML(m) : ""}</div>`;
  }
  const num0 = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
  function lqOrdersHTML() {
    if (!liq.orders.length) return '<p class="empty" style="padding:30px">Открытых заявок нет. Выберите рынок на вкладке «Награды» и выставьте заявку ликвидности.</p>';
    const SIDE = { both: "Обе стороны", yes: "Только «Да»", no: "Только «Нет»" };
    return `<div class="table-wrap" style="margin:0"><table class="acc-tx"><thead><tr><th>Рынок</th><th>Размер</th><th>От цены</th><th>Стороны</th><th>Награда в день</th><th>Заработано</th><th></th></tr></thead><tbody>${liq.orders.slice().reverse().map((o) => {
      const e = byId(o.eid), m = lqMeta(e);
      return `<tr><td class="ev">${esc(e.q)}</td><td>${rub(o.size)}</td><td>${String(o.spread).replace(".", ",")}¢ из ${m.maxS}¢</td><td>${SIDE[o.sides]}</td><td>${rub(lqRate(o) * DAY)}</td><td class="pos"><b>${rub(o.acc)}</b></td><td><button type="button" class="sbtn danger" data-lqcancel="${o.id}">Отменить</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
  }
  function lqBannerHTML() {
    const now = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    return `<div class="lq-banner"><div class="lq-bt"><small>Ежедневные вознаграждения <span class="lq-i" title="Сколько вы заработали за сегодня на наградах за ликвидность">ⓘ</span></small><b>${rub(lqToday())}</b>
        <span>${now} · обновляется каждую минуту</span>
        <div class="lq-claim"><span>Не забрано: <b>${rub(lqUnclaimed())}</b> · всего выплачено ${rub(liq.paid)}</span><button type="button" class="pbtn" data-lqclaim ${Math.floor(lqUnclaimed()) >= 1 ? "" : "disabled"}>Забрать на баланс</button></div></div>
      <svg class="lq-art" viewBox="0 0 420 275" aria-hidden="true"><g fill="none" stroke="#fff" stroke-opacity=".12"><circle cx="270" cy="330" r="130"/><circle cx="270" cy="330" r="190"/><circle cx="270" cy="330" r="250"/></g>
        <circle cx="270" cy="330" r="115" fill="#ffffff" fill-opacity=".25"/><circle cx="270" cy="330" r="92" fill="#ffffff" fill-opacity=".18"/>
        <path d="M270 190c4 36 16 48 52 52-36 4-48 16-52 52-4-36-16-48-52-52 36-4 48-16 52-52z" fill="#fff"/>
        <rect x="150" y="30" width="16" height="88" rx="8" transform="rotate(18 158 74)" fill="url(#lqg1)"/><rect x="354" y="22" width="16" height="70" rx="8" transform="rotate(-38 362 57)" fill="url(#lqg1)"/>
        <defs><linearGradient id="lqg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa2ff"/><stop offset="1" stop-color="#e49bff"/></linearGradient></defs></svg></div>`;
  }
  function lqBodyHTML() {
    lqSettle();
    const cats = [{ id: "all", name: "Все" }, ...CATEGORIES.filter((c) => catOn(c.id))];
    if (liqCat !== "all" && !catOn(liqCat)) liqCat = "all";
    const rows = lqRows();
    const th = (k, n, tip = "") => `<button type="button" class="lq-th ${liqSort.k === k ? "on" : ""}" data-lqsort="${k}" ${tip ? `title="${tip}"` : ""}>${n}${liqSort.k === k ? (liqSort.dir === 1 ? " ↓" : " ↑") : ""}</button>`;
    const body = liqTab === "orders" ? lqOrdersHTML()
      : `<div class="lq-tools"><div class="tabs lq-cats">${cats.map((c) => `<button type="button" class="tab ${c.id === liqCat ? "active" : ""}" data-lqcat="${c.id}">${c.name}</button>`).join("")}</div>
        <div class="lq-bar"><input class="field" id="lq-q" type="search" placeholder="Поиск рынков" value="${esc(liqQ)}" aria-label="Поиск рынков">
          <button type="button" class="sbtn ${liqMine ? "on" : ""}" data-lqmine>Мои заявки</button><button type="button" class="sbtn ${liqFav ? "on" : ""}" data-lqfavf>Избранное</button></div></div>
        <div class="lq-table"><div class="lq-head"><span>Рынок</span>${th("spread", "Макс. спред", "Насколько далеко от цены заявка ещё приносит награду")}<span title="Минимальный размер заявки">Мин. размер</span>${th("pool", "Награда в день", "Дневной пул награды рынка")}${th("comp", "Конкур.", "Сколько ещё участников делят пул: больше делений — меньше ваша доля")}${th("earned", "Заработано")}${th("share", "Доля")}<span>Цена</span><span>Изм.</span><span></span><span></span></div>
        ${rows.length ? rows.map(lqRowHTML).join("") : '<p class="empty" style="padding:30px">Ничего не найдено.</p>'}</div>`;
    return lqBannerHTML() + `<div class="mc-tabs lq-tabs" role="tablist"><button type="button" role="tab" data-lqtab="rewards" class="${liqTab === "rewards" ? "on" : ""}">Награды</button><button type="button" role="tab" data-lqtab="orders" class="${liqTab === "orders" ? "on" : ""}">Открытые заявки${liq.orders.length ? ` · ${liq.orders.length}` : ""}</button></div>` + body
      + `<p class="fee-note">Демо: заявки ликвидности не исполняются и не меняют цену рынка, сумма замораживается на балансе и возвращается при отмене. Конкуренты и размеры пулов симулируются.</p>`;
  }
  const liqInnerHTML = () => `<div class="lq" id="lq-body">${lqBodyHTML()}</div>`;
  function paintLiq(keepFocus) {
    const el = bq("#lq-body");
    if (!el) return;
    const sc = bonusFs ? $("#modal") : null, y = sc ? sc.scrollTop : window.scrollY;
    el.innerHTML = lqBodyHTML();
    if (liqOpen && bq("#lq-prev")) bq("#lq-prev").innerHTML = lqPrevHTML();
    if (sc) sc.scrollTop = y; else window.scrollTo(0, y);
    if (keepFocus) { const q = bq("#lq-q"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }
  function liqClick(ev) {
    const t = ev.target;
    const act = (fn) => { fn(); };
    const tab = t.closest("[data-lqtab]"); if (tab) { liqTab = tab.dataset.lqtab; return paintLiq(); }
    const cat = t.closest("[data-lqcat]"); if (cat) { liqCat = cat.dataset.lqcat; return paintLiq(); }
    if (t.closest("[data-lqmine]")) { liqMine = !liqMine; return paintLiq(); }
    if (t.closest("[data-lqfavf]")) { liqFav = !liqFav; return paintLiq(); }
    const sort = t.closest("[data-lqsort]"); if (sort) { const k = sort.dataset.lqsort; liqSort = { k, dir: liqSort.k === k ? -liqSort.dir : 1 }; return paintLiq(); }
    const fav = t.closest("[data-lqfav]");
    if (fav) { const id = Number(fav.dataset.lqfav); liq.favs = liq.favs.includes(id) ? liq.favs.filter((x) => x !== id) : [...liq.favs, id]; saveLiq(); return paintLiq(); }
    const sz = t.closest("[data-lqsize]"); if (sz) { liqForm.size = Number(sz.dataset.lqsize); bq("#lq-size").value = liqForm.size; return (bq("#lq-prev").innerHTML = lqPrevHTML()); }
    const sd = t.closest("[data-lqsides]"); if (sd) { liqForm.sides = sd.dataset.lqsides; bqa("#lq-sides button").forEach((b) => b.classList.toggle("on", b === sd)); return (bq("#lq-prev").innerHTML = lqPrevHTML()); }
    if (t.closest("[data-lqclaim]")) {
      lqSettle();
      const v = Math.floor(lqUnclaimed());
      if (v < 1) return;
      const rest = lqUnclaimed() - v;
      liq.orders.forEach((o) => (o.acc = 0)); liq.banked = rest; liq.paid += v; saveLiq(); setBalance(balance + v);
      toast(`Награды за ликвидность ${rub(v)} зачислены на баланс`);
      return paintLiq();
    }
    const cancel = t.closest("[data-lqcancel]");
    if (cancel) {
      lqSettle();
      const o = liq.orders.find((x) => x.id === cancel.dataset.lqcancel);
      if (!o) return;
      liq.banked += o.acc; liq.orders = liq.orders.filter((x) => x !== o); saveLiq(); setBalance(balance + o.size);
      toast(`Заявка отменена, ${rub(o.size)} вернулись на баланс`);
      return paintLiq();
    }
    if (t.closest("[data-lqplace]")) {
      const m = lqMeta(byId(liqOpen)), size = Math.floor(Number(bq("#lq-size").value)), sp = liqForm.spread == null ? m.maxS / 2 : liqForm.spread;
      if (!(size >= m.minSize)) return toast(`Минимальный размер заявки: ${rub(m.minSize)}`);
      if (size > balance) return toast("Недостаточно средств на балансе");
      liqForm.size = size;
      return askConfirm({ title: "Выставить заявку ликвидности?", okText: "Выставить", rows: [["Рынок", esc(m.e.q)], ["Размер (заморозится)", rub(size)], ["Расстояние от цены", `${String(sp).replace(".", ",")}¢ из ${m.maxS}¢`], ["Стороны", { both: "Обе", yes: "Только «Да»", no: "Только «Нет»" }[liqForm.sides]], ["Ожидаемая награда в день", rub(lqPreview().perDay)]] }, () => {
        lqSettle();
        liq.orders.push({ id: Date.now().toString(36), eid: m.e.id, size, spread: sp, sides: liqForm.sides, t0: Date.now(), acc: 0 });
        saveLiq(); setBalance(balance - size); liqOpen = null; liqTab = "orders";
        toast("Заявка ликвидности выставлена");
        paintLiq();
      });
    }
    const row = t.closest("[data-lqrow]");
    if (row) { const id = Number(row.dataset.lqrow); liqOpen = liqOpen === id ? null : id; liqForm.spread = null; return paintLiq(); }
  }
  function liqInput(ev) {
    if (ev.target.id === "lq-q") { liqQ = ev.target.value; return paintLiq(true); }
    if (ev.target.id === "lq-size") { liqForm.size = Math.max(0, Math.floor(Number(ev.target.value))); return (bq("#lq-prev").innerHTML = lqPrevHTML()); }
    if (ev.target.id === "lq-spr") { liqForm.spread = Number(ev.target.value); bq("#lq-sprv").textContent = String(liqForm.spread).replace(".", ",") + "¢"; return (bq("#lq-prev").innerHTML = lqPrevHTML()); }
  }

  // ---------- «Бонус»: рефералы и награды за ликвидность ----------
  let bonusTab = "ref";
  const BONUS_TABS = [["ref", "Рефералы"], ["liq", "Награды за ликвидность"]];
  const isBonusRoute = () => ["bonus", "referrals", "rewards"].includes(state.route);
  function viewBonus() {
    const tabs = BONUS_TABS.filter(([id]) => bonusOn(id));
    if (!tabs.length) return `<div class="wrap"><h1 class="page-title">Бонус</h1><p class="page-sub">Бонусные программы отключены в настройках.</p><button type="button" class="pbtn" data-settings>Открыть настройки</button></div>`;
    if (!tabs.some(([id]) => id === bonusTab)) bonusTab = tabs[0][0];
    return `<div class="wrap ref bonus">
      ${tabs.length > 1 ? `<div class="mc-tabs bonus-tabs" role="tablist">${tabs.map(([id, n]) => `<button type="button" role="tab" data-btab="${id}" class="${id === bonusTab ? "on" : ""}">${n}</button>`).join("")}</div>` : ""}
      <div id="bonus-body">${bonusTab === "ref" ? refInnerHTML() : liqInnerHTML()}</div>
    </div>`;
  }
  function bindBonus() {
    const root = $("#view");
    root.onclick = (ev) => {
      const bt = ev.target.closest("[data-btab]");
      if (bt) { bonusTab = bt.dataset.btab; $("#view").innerHTML = viewBonus(); document.querySelectorAll(".bonus-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.btab === bonusTab)); return bonusTab === "ref" ? paintRefChart(refStats(refTab)) : null; }
      return bonusTab === "ref" ? refClick(ev) : liqClick(ev);
    };
    root.oninput = (ev) => { if (bonusTab === "liq") liqInput(ev); };
    if (bonusTab === "ref" && bq("#rf-chart")) paintRefChart(refStats(refTab));
  }

  // полноэкранное окно «Рефералы» или «Награды за ликвидность» (открывается из настроек)
  function openBonusFs(id) {
    modalEvent = null;
    openSheet(`<div class="fs-top"><button type="button" class="fs-back" id="fs-back">← Назад в настройки</button></div><div class="ref bonus"><div id="bonus-body">${id === "ref" ? refInnerHTML() : liqInnerHTML()}</div></div>`, true);
    bonusFs = id;
    const sb = $("#sheet-body");
    sb.onclick = (ev) => { if (ev.target.closest("#fs-back")) return openSettings(); return id === "ref" ? refClick(ev) : liqClick(ev); };
    sb.oninput = (ev) => { if (id === "liq") liqInput(ev); };
    if (id === "ref") paintRefChart(refStats(refTab));
  }

  // ---------- правила ----------
  function viewRules() {
    return `<div class="wrap">
      <h1 class="page-title">Правила рынков</h1>
      <p class="page-sub">Как определяется победитель и как решаются споры. У каждого рынка свои условие «Да», источник результата и особые случаи: они показаны в окне рынка в блоке «Правила».</p>
      <div class="panel" style="margin-top:20px">
        <h3>Общие правила</h3>
        <ol class="rules-list">${RULES_GENERAL.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      </div>
      <div class="panel" style="margin:16px 0 40px">
        <h3>Как оспорить итог</h3>
        <ol class="rules-list">
          <li>Итог рынка отображается на его странице. Откройте рынок и проверьте блок «Правила».</li>
          <li>В течение 24 часов после объявления итога напишите в <a href="${TELEGRAM_URL}" target="_blank" rel="noopener">Telegram-канал RusPredict</a>: номер рынка, ссылка на источник из правил и суть возражения.</li>
          <li>Администрация сверяет итог только с источником из правил рынка и отвечает в течение 3 рабочих дней.</li>
          <li>Если ошибка признана, итог меняется, выплаты и комиссия пересчитываются. Если нет, итог остаётся, а решение окончательное.</li>
        </ol>
        <p class="fee-note">Это демонстрационный прототип: пока у сайта нет сервера, заявки на спор принимаются только вручную через Telegram.</p>
      </div>
    </div>`;
  }

  // ---------- сообщество ----------
  const planeIcon = '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M58 8 6 29l15 6 6 19 9-10 13 10z"/><path d="M21 35 58 8 28 40"/></svg>';
  function tgCard() {
    return `<div class="tg">
      <div class="tg-icon">${planeIcon}</div>
      <div class="tg-text">
        <h2>Канал RusPredict в Telegram</h2>
        <p>Новые рынки, итоги, разборы прогнозов и конкурсы для трейдеров. Подпишитесь и предложите свою тему.</p>
      </div>
      <div class="tg-actions">
        <a class="cta primary" href="${TELEGRAM_URL}" target="_blank" rel="noopener">Открыть канал</a>
        <a class="cta ghost" href="#community">Предложить рынок</a>
      </div>
    </div>`;
  }
  const ideaList = () => [...myIdeas.map((i) => ({ ...i, own: true })), ...SEED_IDEAS].map((i) => ({ ...i, count: i.votes + (voted.includes(i.id) ? 1 : 0) })).sort((x, y) => y.count - x.count);
  function ideasHTML() {
    return ideaList().map((i) => `
      <article class="idea">
        <button class="vote ${voted.includes(i.id) ? "on" : ""}" data-vote="${i.id}" aria-label="Голос за идею" aria-pressed="${voted.includes(i.id)}"><span>▲</span><b>${i.count}</b></button>
        <div class="idea-body">
          <h3>${esc(i.title)}</h3>
          <div class="idea-meta"><span class="tag-cat">${i.cat === "other" ? "Другое" : catName(i.cat)}</span>${i.own ? '<span class="tag-own">Ваша идея</span>' : ""}${i.src ? `<span>Источник: ${esc(i.src)}</span>` : ""}</div>
          ${i.desc ? `<p>${esc(i.desc)}</p>` : ""}
          ${i.own ? `<button class="sbtn small" data-copyidea="${i.id}">Скопировать для Telegram</button>` : ""}
        </div>
      </article>`).join("");
  }
  const ideaText = (i) => `Идея рынка для RusPredict\nТема: ${i.title}\nКатегория: ${i.cat === "other" ? "Другое" : catName(i.cat)}${i.src ? "\nИсточник проверки: " + i.src : ""}${i.desc ? "\nОписание: " + i.desc : ""}`;
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
  function viewCommunity() {
    return `<div class="wrap">
      <h1 class="page-title">Сообщество</h1>
      <p class="page-sub">Подписывайтесь на канал и предлагайте темы для новых рынков. Самые популярные идеи мы запускаем первыми.</p>
      <div style="margin-top:20px">${tgCard()}</div>
      <div class="acc" style="grid-template-columns:1fr 1.3fr">
        <div class="panel">
          <h3>Предложить тему рынка</h3>
          <form id="idea-form">
            <label class="l" for="i-title">Вопрос для рынка</label>
            <input class="field" id="i-title" maxlength="140" required placeholder="Например: Курс доллара превысит 100 ₽ в марте?">
            <label class="l" for="i-cat">Категория</label>
            <select class="field" id="i-cat">${CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}<option value="other">Другое</option></select>
            <label class="l" for="i-src">Чем проверить результат</label>
            <input class="field" id="i-src" maxlength="140" placeholder="Например: официальный курс Банка России">
            <label class="l" for="i-desc">Пояснение (необязательно)</label>
            <textarea class="field" id="i-desc" maxlength="400" placeholder="Почему это интересно и когда должен закрыться рынок"></textarea>
            <div class="row-actions"><button class="pbtn" type="submit">Предложить</button></div>
            <div class="msg" id="i-msg"></div>
          </form>
          <p class="fee-note">Демо: идеи сохраняются в вашем браузере и не уходят на сервер. Чтобы команда увидела идею, скопируйте её кнопкой «Скопировать для Telegram» и отправьте в чат канала.</p>
        </div>
        <div class="panel">
          <h3>Идеи сообщества</h3>
          <div class="ideas" id="ideas">${ideasHTML()}</div>
        </div>
      </div>
    </div>`;
  }
  function bindCommunity() {
    $("#idea-form").onsubmit = (ev) => {
      ev.preventDefault();
      const idea = { id: "u" + Date.now(), title: $("#i-title").value.trim(), cat: $("#i-cat").value, src: $("#i-src").value.trim(), desc: $("#i-desc").value.trim(), votes: 0, ts: Date.now() };
      if (!idea.title) return;
      myIdeas.unshift(idea);
      voted.push(idea.id);
      store.set("ideas", myIdeas);
      store.set("voted", voted);
      ev.target.reset();
      $("#ideas").innerHTML = ideasHTML();
      const m = $("#i-msg");
      m.className = "msg";
      m.textContent = "Идея добавлена в список. Скопируйте её для Telegram кнопкой под идеей.";
    };
  }

  // ---------- роутер ----------
  const routes = { bonus: viewBonus, referrals: () => { bonusTab = "ref"; return viewBonus(); }, rewards: () => { bonusTab = "liq"; return viewBonus(); }, rules: viewRules, home: viewHome, markets: viewMarkets, trade: () => PERPS.view(), leaderboard: viewLeaderboard, trader: () => viewTrader(), community: viewCommunity, account: viewAccount };
  function render() {
    const raw = (location.hash || "#home").slice(1);
    const isTr = raw.startsWith("trader/");
    if (isTr) { try { trNick = decodeURIComponent(raw.slice(7)); } catch { trNick = raw.slice(7); } }
    const r = isTr ? "trader" : raw;
    state.route = routes[r] ? r : "home";
    $("#view").onclick = null; $("#view").oninput = null;
    $("#view").innerHTML = routes[state.route]();
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === (isBonusRoute() ? "bonus" : state.route === "trader" ? "leaderboard" : state.route)));
    if (state.route === "markets") paintGrid();
    if (state.route === "account") { bindAccount(); bindAcp(); paintAccountStats(); paintDeposits(); paintAccountTx(); }
    if (state.route === "community") bindCommunity();
    if (state.route === "trader") bindTrader();
    if (state.route === "trade") PERPS.bind();
    if (isBonusRoute()) bindBonus();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);
  setInterval(() => { if ((isBonusRoute() || bonusFs) && !document.hidden) { if ((bonusFs || bonusTab) === "ref") paintRefs(); else if (!liqOpen && !document.activeElement.matches("input")) paintLiq(); } }, 60000);

  // ---------- аккаунт ----------
  function bindAccount() {
    let color = profile.color;
    $("#swatches").onclick = (ev) => {
      const b = ev.target.closest(".swatch");
      if (!b) return;
      color = b.dataset.color;
      document.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("on", s === b));
      $("#av").innerHTML = avatar($("#f-nick").value || "?", color, "lg");
    };
    $("#f-nick").oninput = (ev) => ($("#av").innerHTML = avatar(ev.target.value || "?", color, "lg"));
    $("#profile-form").onsubmit = (ev) => {
      ev.preventDefault();
      profile = {
        nick: $("#f-nick").value.trim() || "Гость",
        city: $("#f-city").value.trim(),
        bio: $("#f-bio").value.trim(),
        fav: $("#f-fav").value,
        color
      };
      store.set("profile", profile);
      toast("Профиль сохранён");
      render();
    };
    let armed = false;
    $("#reset").onclick = (ev) => {
      if (!armed) { armed = true; ev.target.textContent = "Нажмите ещё раз для сброса"; return; }
      profile = { ...DEFAULT_PROFILE };
      bets = [];
      closed = [];
      PERPS.reset();
      myTx = [];
      store.set("mytx", myTx);
      EVENTS.forEach((e) => { e.trades = e.trades.filter((t) => !t.own); });
      store.set("profile", profile);
      store.set("bets", bets);
      store.set("closed", closed);
      setBalance(10000);
      toast("Аккаунт сброшен");
      render();
    };
  }

  // ---------- модальные окна ----------
  const openSheet = (html, fs) => { const sb = $("#sheet-body"); sb.onclick = null; sb.oninput = null; bonusFs = null; sb.innerHTML = html; $("#modal").classList.toggle("fs", !!fs); $("#modal").hidden = false; $("#modal").scrollTop = 0; };
  const closeModal = () => { $("#modal").hidden = true; modalEvent = null; bonusFs = null; const sb = $("#sheet-body"); sb.onclick = null; sb.oninput = null; };

  let chosenSide = "yes";
  function openBet(id, side) {
    const e = byId(id);
    modalEvent = e;
    chosenSide = side || "yes";
    openSheet(`
      <div class="fs-top"><button class="fs-back" id="fs-back">← Назад к рынкам</button><span class="fs-id">Рынок №${e.id}</span></div>
      ${banner(e, "in-modal", 1100, 150)}
      <div class="fs-head">
        <div class="cat">${catName(e.cat)}</div>
        <h2>${esc(e.q)}</h2>
        <p>Закрытие ${fmtDate(e.closes)}${leftTxt(e) ? ` (${leftTxt(e)})` : ""} · <span id="m-vol"></span></p>
      </div>
      <div class="fs-grid">
        <div class="fs-main">
          <div class="chart-head">
            <div><span class="chart-now" id="m-now"></span> <span class="chart-delta" id="m-delta"></span></div>
            <div class="range" id="m-range">${Object.keys(RANGES).map((k) => `<button data-range="${k}" class="${k === modalRange ? "on" : ""}">${k}</button>`).join("")}</div>
          </div>
          <div class="chart" id="m-chart"></div>
          <div class="probbar" id="m-bar"></div>
          <div class="poly-note" id="m-poly"></div>
          ${rulesHTML(e)}
          <div id="m-chat">${chatHTML("m" + e.id)}</div>
          ${similarHTML(e)}
          <div id="m-tx"></div>
        </div>
        <aside class="fs-side">
          ${e.resolved ? `<div class="resolved-note">Рынок завершён. Итог: «${e.resolved === "yes" ? "Да" : "Нет"}». Выплаты по ставкам уже рассчитаны, комиссия платформы 2% удержана с выигрыша.</div>` : isExpired(e) ? `<div class="resolved-note">Срок рынка вышел (${fmtDate(e.closes)}). Новые ставки не принимаются, ждём итог.</div>` : ""}
          <div id="m-form"${e.resolved || isExpired(e) ? " hidden" : ""}>
            <div class="seg">
              <button class="yes" data-side="yes"></button>
              <button class="no" data-side="no"></button>
            </div>
            <p class="coef-note">Коэффициент показывает, во сколько раз выплата больше ставки (до комиссии 2% с выигрыша).</p>
            <input class="field" id="amt" type="number" min="1" step="100" value="500" aria-label="Сумма ставки в рублях">
            <div class="impact" id="impact"></div>
            <button class="submit" id="buy">Вложить в пул</button>
            <div class="msg" id="msg"></div>
            <p class="fee-note">Цену определяет поток денег: чем больше ставок на «Да», тем выше вероятность «Да» и ниже «Нет». Продать позицию можно в любой момент, комиссия 2%. Если ставка выиграет, платформа удержит 2% от выигрыша (выплата минус ставка).</p>
            <div id="m-pos"></div>
          </div>
          ${!e.resolved && typeof DEMO_RESOLVE !== "undefined" && DEMO_RESOLVE ? `<details class="demo-resolve"><summary>Демо: завершить рынок и увидеть выплату</summary><p>Настоящий итог определяет источник результата. В демо вы выбираете его сами.</p><div class="btns"><button class="btn yes" data-demoresolve="yes">Итог «Да»</button><button class="btn no" data-demoresolve="no">Итог «Нет»</button></div></details>` : ""}
        </aside>
      </div>`, true);
    $("#fs-back").onclick = closeModal;
    chatBind($("#m-chat"), "m" + e.id);
    $(".seg").onclick = (ev) => { const b = ev.target.closest("button"); if (b) { chosenSide = b.dataset.side; paintModalLive(); } };
    $("#m-range").onclick = (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      modalRange = b.dataset.range;
      document.querySelectorAll("#m-range button").forEach((x) => x.classList.toggle("on", x === b));
      paintChart();
    };
    $("#amt").oninput = paintModalLive;
    $("#buy").onclick = () => {
      const amt = Math.floor(Number($("#amt").value));
      const msg = $("#msg");
      msg.className = "msg err";
      if (!(amt > 0)) return (msg.textContent = "Введите сумму.");
      if (!isOpen(e)) return (msg.textContent = "Приём ставок на этот рынок закрыт.");
      if (amt > balance) return (msg.textContent = "Недостаточно средств. Пополните пул.");
      const side = chosenSide, q = quoteBuy(e, side, amt);
      askConfirm({
        title: "Подтвердите покупку",
        okText: "Купить",
        rows: [
          ["Рынок", esc(e.q)],
          ["Исход", `«${side === "yes" ? "Да" : "Нет"}», вероятность ${pct1(q.avg)}%, коэффициент ${coefTxt(q.avg)}`],
          ["Сумма", rub(amt)],
          ["Долей", pct1(q.shares)],
          ["Выплата при успехе", `<b>${rub(q.shares)}</b>`],
          ["«Да» после ставки", `${pct1(prob(e))}% → ${pct1(q.after)}%`],
          ["Комиссия при продаже", "2%"],
          ["Комиссия с выигрыша", "2% от (выплата − ставка)"]
        ]
      }, () => {
        if (amt > balance) return toast("Недостаточно средств");
        setBalance(balance - amt);
        e.y = q.y; e.n = q.n; e.vol += amt; syncYes(e);
        addTrade(e, { nick: profile.nick, own: true, side, kind: "buy", amt, price: q.avg });
        bets.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 6), eid: e.id, side, amt, shares: q.shares, price: q.avg, ts: Date.now() });
        store.set("bets", bets);
        msg.className = "msg";
        msg.textContent = `Ставка принята: ${rub(amt)} на «${side === "yes" ? "Да" : "Нет"}». Вероятность «Да» теперь ${pct1(e.yes)}%.`;
        refreshPrices();
        paintChart();
        paintModalLive();
        if (state.route === "account") paintAccountRight();
      });
    };
    paintChart();
    paintModalLive();
  }

  function paintChart() {
    if (!modalEvent) return;
    const vals = modalRange === "1Ч" ? minuteSeries(modalEvent) : modalEvent.hist.slice(-RANGES[modalRange]);
    const host = $("#m-chart");
    host.innerHTML = chartMarkup(vals, modalRange);
    bindChart(host, vals, modalRange);
    const d = vals[vals.length - 1] - vals[0];
    const el = $("#m-delta");
    el.textContent = `${d >= 0 ? "+" : "−"}${pct1(Math.abs(d))} п.п. за ${modalRange}`;
    el.className = "chart-delta " + (d >= 0 ? "pos" : "neg");
  }

  // обновляет цены, расчёты и позиции в открытом окне (без сброса поля суммы)
  function paintModalLive() {
    const e = modalEvent;
    if (!e || !$("#m-now")) return;
    $("#m-now").textContent = `${pct1(e.yes)}% «Да»`;
    $("#m-vol").textContent = `пул ${short(e.vol)} ₽`;
    $("#m-bar").innerHTML = `<div class="pbar"><div style="width:${e.yes}%"></div></div><div class="pleg"><span>Да ${pct1(e.yes)}% · ${coefTxt(e.yes)}</span><span>Нет ${pct1(100 - e.yes)}% · ${coefTxt(100 - e.yes)}</span></div>`;
    $("#m-poly").innerHTML = e.poly != null
      ? (polyFresh(e)
          ? `Polymarket: <b>${pct1(e.poly)}%</b> · у нас ${pct1(e.yes)}% (${e.yes - e.poly >= 0 ? "+" : "−"}${pct1(Math.abs(e.yes - e.poly))} п.п.) · <a href="${polyUrl(e)}" target="_blank" rel="noopener">источник</a>`
          : `Polymarket: данные устарели · <a href="${polyUrl(e)}" target="_blank" rel="noopener">источник</a>`)
      : "";
    const yb = $(".seg .yes"), nb = $(".seg .no");
    yb.textContent = `Да ${cents(e)}% · ${coefTxt(cents(e))}`; nb.textContent = `Нет ${100 - cents(e)}% · ${coefTxt(100 - cents(e))}`;
    yb.classList.toggle("on", chosenSide === "yes"); nb.classList.toggle("on", chosenSide === "no");
    const amt = Number($("#amt").value) || 0;
    const q = quoteBuy(e, chosenSide, amt);
    const word = chosenSide === "yes" ? "Да" : "Нет";
    $("#impact").innerHTML = amt > 0
      ? `<div><span>Долей · коэффициент</span><b>${pct1(q.shares)} · ${coefTxt(q.avg)}</b></div>
         <div><span>Выплата при «${word}»</span><b>${rub(q.shares)}</b></div>
         <div><span>Вероятность после ставки</span><b>Да ${pct1(prob(e))}% → ${pct1(q.after)}% · Нет ${pct1(100 - prob(e))}% → ${pct1(100 - q.after)}%</b></div>`
      : "";
    const tx = $("#m-tx"), box = $(".tx-scroll", tx), top = box ? box.scrollTop : 0;
    tx.innerHTML = txHTML(e);
    if (top) $(".tx-scroll", tx).scrollTop = top;
    const mine = bets.filter((b) => b.eid === e.id);
    $("#m-pos").innerHTML = mine.length ? `<h3 class="pos-title">Ваши позиции на этом рынке</h3>${positionsHTML(mine)}` : "";
  }

  // ---------- пополнение (демо): СБП и криптовалюта ----------
  // Платежей нет: адреса и реквизиты вымышлены, «оплата» подтверждается нажатием кнопки и зачисляет игровые рубли.
  const DEP_MIN = 100, DEP_MAX = 300000;
  const BANKS = ["Сбербанк", "Т-Банк", "ВТБ", "Альфа-Банк", "Газпромбанк", "Райффайзен", "Совкомбанк", "Другой банк"];
  // rate — демо-курс в рублях, nets — сети с числом подтверждений
  const COINS = {
    USDT: { name: "Tether", rate: 95, dec: 2, chips: [10, 50, 100, 500], nets: [["TRC-20 (Tron)", 19, "TRX"], ["ERC-20 (Ethereum)", 12, "ETH"], ["TON", 1, "TON"]] },
    USDC: { name: "USD Coin", rate: 95, dec: 2, chips: [10, 50, 100, 500], nets: [["ERC-20 (Ethereum)", 12, "ETH"]] },
    BTC: { name: "Bitcoin", rate: 7800000, dec: 6, chips: [0.0005, 0.001, 0.005, 0.01], nets: [["Bitcoin", 2, "BTC"]] },
    ETH: { name: "Ethereum", rate: 280000, dec: 5, chips: [0.01, 0.05, 0.1, 0.5], nets: [["ERC-20 (Ethereum)", 12, "ETH"]] },
    TON: { name: "Toncoin", rate: 300, dec: 2, chips: [10, 50, 100, 500], nets: [["TON", 1, "TON"]] }
  };
  // ---------- реальные курсы ----------
  // Курс монеты в рублях = цена в долларах (Binance, запасной Coinbase) × курс доллара (ЦБ РФ, запасная Мосбиржа).
  // USDT и USDC приравнены к $1. Нет доступа к источникам (например, внутри claude.ai): остаётся демо-курс, он помечен.
  const RATE = { t: 0, loading: false, fx: 0, srcFx: "", failed: false };
  const fetchJSON = async (url, ms = 7000) => {
    const c = new AbortController(), id = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { signal: c.signal, cache: "no-store" }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(id); }
  };
  async function usdRub() {
    try { const v = (await fetchJSON("https://www.cbr-xml-daily.ru/daily_json.js")).Valute.USD; const x = v.Value / v.Nominal; if (x > 0) return { v: x, src: "ЦБ РФ" }; } catch {}
    const j = await fetchJSON("https://iss.moex.com/iss/engines/currency/markets/selt/boards/CETS/securities/USD000UTSTOM.json?iss.meta=off&iss.only=marketdata&marketdata.columns=LAST");
    const x = Number(j.marketdata.data[0][0]);
    if (!(x > 0)) throw new Error("usdrub");
    return { v: x, src: "Мосбиржа" };
  }
  async function coinUsd(sym) {
    try { const x = Number((await fetchJSON("https://api.binance.com/api/v3/ticker/price?symbol=" + sym + "USDT")).price); if (x > 0) return { v: x, src: "Binance" }; } catch {}
    const x = Number((await fetchJSON(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`)).data.amount);
    if (!(x > 0)) throw new Error(sym);
    return { v: x, src: "Coinbase" };
  }
  async function loadRates() {
    if (RATE.loading) return;
    RATE.loading = true;
    try {
      const fx = await usdRub();
      RATE.fx = fx.v; RATE.srcFx = fx.src;
      COINS.USDT.rate = COINS.USDC.rate = fx.v; COINS.USDT.live = COINS.USDC.live = true; COINS.USDT.src = COINS.USDC.src = "$1 · " + fx.src;
      const syms = ["BTC", "ETH", "TON"];
      const res = await Promise.allSettled(syms.map(coinUsd));
      res.forEach((r, i) => { if (r.status === "fulfilled") { const k = COINS[syms[i]]; k.rate = r.value.v * fx.v; k.live = true; k.src = r.value.src + " · " + fx.src; } });
      RATE.t = Date.now(); RATE.failed = false;
    } catch { RATE.failed = true; }
    RATE.loading = false;
    if (depAlive() && dep.sync) dep.sync();
  }
  const rateBadge = () => {
    const c = COINS[dep.coin];
    if (c.live) return `<span class="dp-live"></span>Живой курс · ${c.src} · ${new Date(RATE.t).toLocaleTimeString("ru-RU")}`;
    if (RATE.loading || !RATE.t && !RATE.failed) return `<span class="dp-live wait"></span>Загружаем курс…`;
    return `<span class="dp-live off"></span>Демо-курс: источники курса недоступны (в окне claude.ai внешние запросы закрыты). Откройте сайт на своём хостинге или из архива, чтобы курс стал живым.`;
  };
  const rateTxt = (c) => nf.format(Math.round(c.rate * 100) / 100).replace(/,00$/, "");

  // amount — сумма в рублях (её зачислим), tok — точное число токенов, если человек ввёл именно токены (иначе считается по курсу)
  const dep = { method: "sbp", amount: 5000, tok: null, bank: BANKS[0], coin: "USDT", net: 0 };
  const depAlive = () => !!$("#dep-root");
  const depTicker = (fn, ms) => { const id = setInterval(() => { if (!depAlive()) return clearInterval(id); fn(() => clearInterval(id)); }, ms); };

  function fakeQR(seed) {
    const n = 25, rnd = mulberry(hash(seed) + 11);
    const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    const fcell = (x, y) => { const [fx, fy] = [[0, 0], [n - 7, 0], [0, n - 7]].find(([a, b]) => x >= a && x < a + 7 && y >= b && y < b + 7); const dx = x - fx, dy = y - fy; return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4); };
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const on = finder(x, y) ? fcell(x, y) : rnd() > 0.52;
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }
    return `<svg class="dp-qr" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="Демо-QR, не сканируется"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#0b1630"/></svg>`;
  }
  const fakeAddr = (code, seed) => {
    const rnd = mulberry(hash(seed) + 5), ch = "0123456789abcdefghijkmnpqrstuvwxyz";
    let s = ""; for (let i = 0; i < 28; i++) s += ch[Math.floor(rnd() * ch.length)];
    return `DEMO-${code}-${s}`;
  };
  const depTok = () => (dep.tok != null ? dep.tok : dep.amount / COINS[dep.coin].rate);
  const tokStr = (n) => Number(n).toFixed(COINS[dep.coin].dec).replace(".", ",");
  const tokInput = (n) => String(+Number(n).toFixed(COINS[dep.coin].dec));
  const parseTok = (s) => { const x = Number(String(s).replace(",", ".").replace(/\s/g, "")); const k = 10 ** COINS[dep.coin].dec; return Number.isFinite(x) ? Math.round(x * k) / k : 0; };
  const mmss = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  const depAmount = () => Math.floor(Number($("#dep").value));

  // ---------- настройки: оформление и категории ----------
  function openSettings() {
    modalEvent = null;
    const row = (id, name, sub) => `<div class="st-row st-go" data-gobonus="${id}" role="button" tabindex="0"><span><b>${name}</b><small>${sub}</small></span><span class="st-chev" aria-hidden="true">›</span><span class="sw" title="Показывать в разделе «Бонус»"><input type="checkbox" data-sb="${id}" ${bonusOn(id) ? "checked" : ""} aria-label="Показывать в разделе Бонус"><i></i></span></div>`;
    openSheet(`
      <h2>Настройки</h2>
      <h3 class="st-h">Оформление</h3>
      <div class="st-themes" id="st-themes">${[["dark", "Тёмное"], ["light", "Светлое"], ["system", "Как в системе"]].map(([k, n]) => `<button type="button" class="st-th ${settings.theme === k ? "on" : ""}" data-th="${k}"><span class="st-prev st-${k}"><i></i><i></i><i></i></span><b>${n}</b></button>`).join("")}</div>
      <h3 class="st-h">Бонусы</h3>
      <p class="st-note">Нажмите на программу, чтобы открыть её на весь экран. Переключатель справа решает, показывать ли её в разделе «Бонус» в меню; если выключены обе, пункт меню пропадает.</p>
      <div class="st-list" id="st-bonus">${row("liq", "Награды за ликвидность", "Доход за заявки ликвидности в пулах рынков")}${row("ref", "Рефералы", "15% с прямых и 5% с непрямых рефералов")}</div>`);
    const sheet = $("#sheet-body");
    $("#st-themes").onclick = (ev) => {
      const b = ev.target.closest("[data-th]");
      if (!b) return;
      settings.theme = b.dataset.th; saveSettings(); applyTheme();
      sheet.querySelectorAll(".st-th").forEach((x) => x.classList.toggle("on", x === b));
    };
    $("#st-bonus").onchange = (ev) => {
      const id = ev.target.dataset.sb;
      if (!id) return;
      settings.hiddenBonus = ev.target.checked ? settings.hiddenBonus.filter((x) => x !== id) : [...settings.hiddenBonus, id];
      saveSettings(); syncBonusNav();
      if (isBonusRoute()) render();
    };
    $("#st-bonus").onclick = (ev) => {
      if (ev.target.closest(".sw")) return; // переключатель не открывает окно
      const r = ev.target.closest("[data-gobonus]");
      if (r) openBonusFs(r.dataset.gobonus);
    };
    $("#st-bonus").onkeydown = (ev) => { const r = ev.target.closest("[data-gobonus]"); if (r && (ev.key === "Enter" || ev.key === " ") && !ev.target.closest(".sw")) { ev.preventDefault(); openBonusFs(r.dataset.gobonus); } };
  }

  function openDeposit() {
    modalEvent = null;
    dep.tok = null; dep.q = null;
    openSheet(`
      <h2>Пополнить пул</h2>
      <p>Демо-режим: реальные платежи не принимаются, вы получаете игровые рубли. Реквизиты ниже вымышлены, ничего не отправляйте.</p>
      <div id="dep-root"></div>`);
    depStep1();
    loadRates();
    depTicker(() => loadRates(), 15000);
  }

  function depStep1(note) {
    const root = $("#dep-root");
    const m = dep.method, c = COINS[dep.coin];
    if (dep.net >= c.nets.length) dep.net = 0;
    root.innerHTML = `
      <div class="dp-tabs" role="tablist">
        <button role="tab" data-m="sbp" class="${m === "sbp" ? "on" : ""}">${payIcon("sbp", 34)}<span><b>СБП</b><small>Система быстрых платежей</small></span></button>
        <button role="tab" data-m="crypto" class="${m === "crypto" ? "on" : ""}">${payIcon("crypto", 34)}<span><b>Криптовалюта</b><small>USDT, BTC, ETH, TON</small></span></button>
      </div>
      ${m === "sbp"
        ? `<label class="dp-l" for="dep">Сумма пополнения, ₽</label>
      <div class="chips">${[1000, 5000, 10000, 50000].map((v) => `<button class="chip" data-v="${v}">${rub(v)}</button>`).join("")}</div>
      <input class="field" id="dep" type="number" min="${DEP_MIN}" max="${DEP_MAX}" step="100" value="${dep.amount}" aria-label="Сумма пополнения в рублях">`
        : `<label class="dp-l">Сколько пополнить: в рублях или в ${dep.coin}</label>
      <div class="dp-dual">
        <div><small>В рублях</small><div class="dp-inp"><input class="field" id="dep" type="number" min="1" step="any" value="${dep.amount || ""}" aria-label="Сумма пополнения в рублях"><i>₽</i></div></div>
        <span class="dp-swap" aria-hidden="true">⇄</span>
        <div><small>В ${dep.coin}</small><div class="dp-inp"><input class="field" id="dep-tok" type="text" inputmode="decimal" autocomplete="off" value="${dep.tok != null ? tokInput(dep.tok) : dep.amount > 0 ? tokInput(dep.amount / c.rate) : ""}" aria-label="Сумма пополнения в ${dep.coin}"><i>${dep.coin}</i></div></div>
      </div>
      <div class="chips" id="dep-rchips">${[1000, 5000, 10000, 50000].map((v) => `<button class="chip" data-v="${v}">${rub(v)}</button>`).join("")}</div>
      <div class="chips" id="dep-tchips">${c.chips.map((t) => `<button class="chip" data-t="${t}">${String(t).replace(".", ",")} ${dep.coin}</button>`).join("")}</div>`}
      ${m === "sbp"
        ? `<label class="dp-l">Ваш банк</label>
           <div class="dp-banks" id="dep-banks">${BANKS.map((b) => `<button type="button" class="dp-bank ${b === dep.bank ? "on" : ""}" data-bank="${b}">${payIcon(b, 38)}<small>${b}</small></button>`).join("")}</div>`
        : `<label class="dp-l">Монета</label>
           <div class="chips" id="dep-coins">${Object.keys(COINS).map((k) => `<button class="chip dp-coin ${k === dep.coin ? "on" : ""}" data-coin="${k}">${payIcon(k, 22)}${k}</button>`).join("")}</div>
           <label class="dp-l" for="dep-net">Сеть</label>
           <select class="field" id="dep-net">${c.nets.map((n, i) => `<option value="${i}" ${i === dep.net ? "selected" : ""}>${n[0]}</option>`).join("")}</select>`}
      <div class="dp-sum" id="dp-sum"></div>
      ${m === "crypto" ? `<div class="dp-rate" id="dp-rate"></div>` : ""}
      <button class="submit" id="dep-go">Продолжить</button>
      <div class="msg ${note ? "err" : ""}" id="msg">${note || ""}</div>
      <small class="dp-fine">${m === "sbp" ? `Лимиты СБП: от ${rub(DEP_MIN)} до ${rub(DEP_MAX)}.` : "Пополнение криптовалютой без лимитов."} Комиссия за пополнение в демо не взимается.</small>`;
    const sum = () => {
      const v = depAmount();
      $("#dp-sum").innerHTML = m === "sbp"
        ? `<div><span>К оплате</span><b>${v > 0 ? rub(v) : "—"}</b></div>`
        : `<div><span>Будет зачислено</span><b>${v > 0 ? rub(v) : "—"}</b></div>
           <div><span>К отправке · 1 ${dep.coin} = ${rateTxt(c)} ₽${c.live ? "" : " (демо)"}</span><b>${v > 0 ? tokStr(depTok()) + " " + dep.coin : "—"}</b></div>`;
    };
    sum();
    const paintRate = () => { const el = $("#dp-rate"); if (el) el.innerHTML = rateBadge(); };
    paintRate();
    dep.sync = null;
    if (m === "sbp") {
      $("#dep").oninput = () => { dep.amount = depAmount() || 0; sum(); };
      root.querySelector(".chips").onclick = (ev) => { const b = ev.target.closest(".chip"); if (b) { $("#dep").value = b.dataset.v; dep.amount = Number(b.dataset.v); sum(); } };
    } else {
      // два поля связаны: меняете рубли — пересчитываются токены, меняете токены — пересчитываются рубли
      const rubIn = $("#dep"), tokIn = $("#dep-tok");
      const fromRub = () => { dep.tok = null; dep.amount = depAmount() || 0; tokIn.value = dep.amount > 0 ? tokInput(dep.amount / c.rate) : ""; sum(); };
      const fromTok = () => { const t = parseTok(tokIn.value); dep.tok = t > 0 ? t : null; dep.amount = t > 0 ? Math.round(t * c.rate) : 0; rubIn.value = dep.amount > 0 ? dep.amount : ""; sum(); };
      // новый курс: что вводили последним, то и остаётся (токены или рубли), второе поле пересчитывается
      dep.sync = () => { if (!$("#dep-tok")) return; (dep.tok != null ? fromTok : fromRub)(); paintRate(); };
      rubIn.oninput = fromRub;
      tokIn.oninput = fromTok;
      $("#dep-rchips").onclick = (ev) => { const b = ev.target.closest("[data-v]"); if (b) { rubIn.value = b.dataset.v; fromRub(); } };
      $("#dep-tchips").onclick = (ev) => { const b = ev.target.closest("[data-t]"); if (b) { tokIn.value = b.dataset.t; fromTok(); } };
    }
    root.querySelector(".dp-tabs").onclick = (ev) => { const b = ev.target.closest("[data-m]"); if (b && b.dataset.m !== dep.method) { dep.method = b.dataset.m; depStep1(); } };
    if (m === "sbp") $("#dep-banks").onclick = (ev) => { const b = ev.target.closest("[data-bank]"); if (!b) return; dep.bank = b.dataset.bank; root.querySelectorAll(".dp-bank").forEach((x) => x.classList.toggle("on", x === b)); };
    else {
      $("#dep-coins").onclick = (ev) => { const b = ev.target.closest("[data-coin]"); if (b) { dep.coin = b.dataset.coin; dep.net = 0; dep.tok = null; depStep1(); } };
      $("#dep-net").onchange = (ev) => { dep.net = Number(ev.target.value); };
    }
    $("#dep-go").onclick = () => {
      const v = depAmount();
      if (m === "crypto") {
        if (!(depTok() > 0)) return depStep1("Введите сумму в рублях или в " + dep.coin + ".");
        if (dep.tok != null) dep.amount = Math.round(dep.tok * c.rate); // токены вводили сами: рубли считаем по свежему курсу
        if (!(dep.amount >= 1)) return depStep1("Сумма меньше ₽ 1, зачислять нечего.");
        if (dep.amount > 1e12) return depStep1("Слишком большая сумма.");
        // курс и суммы фиксируются на время платежа
        const k = 10 ** c.dec, tok = Math.round(depTok() * k) / k;
        dep.q = { amount: dep.amount, tok, rate: c.rate, live: !!c.live, src: c.src || "" };
      } else {
        if (!(v >= DEP_MIN)) return depStep1(`Минимальная сумма СБП — ${rub(DEP_MIN)}.`);
        if (v > DEP_MAX) return depStep1(`Максимальная сумма СБП — ${rub(DEP_MAX)}.`);
        dep.amount = v;
        dep.q = { amount: v };
      }
      depStep2(Math.random().toString(36).slice(2, 8).toUpperCase());
    };
  }

  function depStep2(ref) {
    const root = $("#dep-root"), v = dep.q.amount, m = dep.method, c = COINS[dep.coin], net = c.nets[dep.net];
    dep.sync = null;
    const total = m === "sbp" ? 15 * 60 : 30 * 60;
    let left = total;
    const addr = m === "crypto" ? fakeAddr(net[2], ref + dep.coin) : "";
    root.innerHTML = payHero(m, m === "sbp" ? "Оплата по СБП" : `Перевод ${dep.coin}`, m === "sbp" ? `Платёж СБП-${ref} · ${esc(dep.bank)}` : `Сеть ${net[0]}`, dep.coin) + (m === "sbp"
      ? `<div class="dp-pay">
          ${fakeQR("sbp" + ref)}
          <div class="dp-det">
            <div><span>Сумма</span><b>${rub(v)}</b></div>
            <div><span>Получатель</span><b>RusPredict (демо)</b></div>
            <div><span>Номер платежа</span><b>СБП-${ref}</b></div>
            <div><span>Ваш банк</span><b class="dp-inl">${payIcon(dep.bank, 20)}${esc(dep.bank)}</b></div>
          </div>
        </div>
        <ol class="dp-steps">
          <li>Откройте приложение «${esc(dep.bank)}».</li>
          <li>Выберите «Оплата по QR-коду» или «Перевод по СБП» и наведите камеру на QR.</li>
          <li>Подтвердите платёж на ${rub(v)} и вернитесь сюда.</li>
        </ol>`
      : `<div class="dp-pay">
          ${fakeQR(addr)}
          <div class="dp-det">
            <div><span>Отправьте ровно</span><b>${tokStr(dep.q.tok)} ${dep.coin}</b></div>
            <div><span>Монета</span><b class="dp-inl">${payIcon(dep.coin, 20)}${dep.coin}</b></div>
            <div><span>Сеть</span><b>${net[0]}</b></div>
            <div><span>Эквивалент</span><b>${rub(v)}</b></div>
            <div><span>Курс зафиксирован</span><b>1 ${dep.coin} = ${rateTxt({ rate: dep.q.rate })} ₽${dep.q.live ? "" : " (демо)"}</b></div>
          </div>
        </div>
        <div class="dp-addr"><span>Демо-адрес для пополнения</span><code id="dp-addr">${addr}</code><button class="chip" id="dp-copy" type="button">Копировать</button></div>
        ${net[2] === "TON" ? `<div class="dp-addr"><span>Комментарий (memo)</span><code>${ref}</code></div>` : ""}
        <p class="dp-warn">Адрес вымышлен и настоящим кошельком не является. Не отправляйте реальные средства, достаточно нажать кнопку ниже.</p>`);
    root.insertAdjacentHTML("beforeend", `
      <div class="dp-status" id="dp-status"><span class="dp-dot"></span><span id="dp-stxt">${m === "sbp" ? "Ожидаем оплату" : "Ожидаем перевод"} · осталось <b id="dp-timer">${mmss(left)}</b></span></div>
      <div class="dp-bar" id="dp-barw" hidden><i id="dp-bar"></i></div>
      <div class="c-actions">
        <button class="sbtn" id="dp-back">Назад</button>
        <button class="pbtn" id="dp-paid">${m === "sbp" ? "Я оплатил(а)" : "Я отправил(а)"}</button>
      </div>
      <small class="dp-fine">Демо: нажатие кнопки имитирует платёж и подтверждение ${m === "sbp" ? "банка" : "сети"}.</small>`);
    let busy = false;
    const copy = $("#dp-copy");
    if (copy) copy.onclick = () => { try { navigator.clipboard.writeText(addr); } catch {} toast("Демо-адрес скопирован"); };
    $("#dp-back").onclick = () => { if (!busy) depStep1(); };
    depTicker((stop) => {
      if (busy) return;
      left--;
      const t = $("#dp-timer"); if (t) t.textContent = mmss(left);
      if (left <= 0) { stop(); depStep1("Время ожидания вышло. Создайте платёж заново."); }
    }, 1000);
    $("#dp-paid").onclick = () => {
      if (busy) return;
      busy = true;
      $("#dp-paid").disabled = true; $("#dp-back").disabled = true;
      $("#dp-barw").hidden = false;
      const need = m === "sbp" ? 1 : net[1];
      let got = 0;
      const upd = () => {
        $("#dp-bar").style.width = Math.round((got / need) * 100) + "%";
        $("#dp-stxt").textContent = m === "sbp" ? "Проверяем платёж в банке…" : got === 0 ? "Транзакция найдена в сети…" : `Подтверждения сети: ${got} из ${need}`;
      };
      upd();
      depTicker((stop) => {
        got++;
        upd();
        if (got >= need) { stop(); setTimeout(() => depDone(ref), 400); }
      }, m === "sbp" ? 1400 : Math.max(140, Math.round(3200 / need)));
    };
  }

  function depDone(ref) {
    if (!depAlive()) return;
    const v = dep.q.amount, m = dep.method, c = COINS[dep.coin], net = c.nets[dep.net];
    const rec = { id: ref, t: Date.now(), status: "done", method: m, rub: v, via: m === "sbp" ? dep.bank : dep.coin + " · " + net[0], coin: m === "crypto" ? tokStr(dep.q.tok) + " " + dep.coin : "", rate: m === "crypto" ? dep.q.rate : 0, live: m === "crypto" ? dep.q.live : false };
    deposits.push(rec);
    store.set("deposits", deposits.slice(-50));
    setBalance(balance + v);
    if (state.route === "account") paintAccountRight();
    $("#dep-root").innerHTML = `
      <div class="dp-ok">
        <svg class="dp-conf" viewBox="0 0 220 90" aria-hidden="true"><g stroke-linecap="round"><path d="M20 70l8-14M44 22l10 6M70 10l2 12M150 12l-3 12M178 28l11-5M200 62l-12-8M110 6v10M16 38l12 2M204 36l-12 4" stroke="#f59e0b" stroke-width="4"/><circle cx="36" cy="80" r="4" fill="#1e48c8"/><circle cx="92" cy="20" r="3.5" fill="#16a34a"/><circle cx="130" cy="6" r="4" fill="#ef4444"/><circle cx="190" cy="80" r="4" fill="#6a3df0"/><rect x="160" y="40" width="9" height="5" rx="1" fill="#16a34a" transform="rotate(30 164 42)"/><rect x="52" y="48" width="9" height="5" rx="1" fill="#ef4444" transform="rotate(-25 56 50)"/></g></svg>
        <div class="dp-check">✓</div>
        <h3>Зачислено ${rub(v)}</h3>
        <p>${m === "sbp" ? `Платёж СБП-${ref} через ${esc(dep.bank)}` : `Перевод ${rec.coin} по сети ${net[0]}`} подтверждён. Баланс: <b>${rub(balance)}</b>.</p>
        <div class="c-actions">
          <button class="sbtn" id="dp-more">Пополнить ещё</button>
          <button class="pbtn" id="dp-close">Готово</button>
        </div>
      </div>`;
    $("#dp-more").onclick = () => depStep1();
    $("#dp-close").onclick = () => { $("#modal").hidden = true; };
    toast(`Баланс пополнен на ${rub(v)}`);
  }

  // ---------- «живые» цены ----------
  // Обновляет цены на карточках и в открытом окне после любой сделки.
  function refreshPrices() {
    document.querySelectorAll(".card[data-open], .hero-card[data-open]").forEach((c) => {
      const e = byId(Number(c.dataset.open));
      const p = $(".pct", c);
      if (p) p.textContent = Math.round(e.yes) + "%";
      const y = $(".btn.yes", c), n = $(".btn.no", c);
      if (y) y.innerHTML = sideBtn(e, "yes");
      if (n) n.innerHTML = sideBtn(e, "no");
      const v = $(".vol", c);
      if (v) v.textContent = `Пул ${short(e.vol)} ₽`;
      const pm = $(".pm", c);
      if (pm) pm.textContent = `Polymarket ${polyFresh(e) ? Math.round(e.poly) + "%" : "…"}`;
      const s = $(".spark-host", c);
      if (s) s.innerHTML = spark(e.hist);
    });
  }
  // Демо: другие трейдеры тоже делают небольшие ставки, поэтому цены двигаются сами, по тем же правилам.
  function tick() {
    if (!$("#confirm").hidden) return; // цены стоят, пока открыто подтверждение
    EVENTS.forEach((e) => {
      if (e.resolved) return;
      if (polyFresh(e)) { // мягко возвращаем цену к Polymarket: после ставки отклонение гаснет примерно за пару минут
        const S = e.y + e.n, next = prob(e) + (e.poly - prob(e)) * 0.03;
        e.n = (S * next) / 100; e.y = S - e.n; syncYes(e);
      }
      if (Math.random() > 0.15) return;
      const pYes = clamp(0.5 + (e.p0 - e.yes) / 40, 0.1, 0.9); // лёгкая тяга к исходной цене
      const side = Math.random() < pYes ? "yes" : "no";
      const amt = 100 + Math.floor(Math.random() * 700);
      const q = quoteBuy(e, side, amt);
      e.y = q.y; e.n = q.n; e.vol += amt; syncYes(e);
      addTrade(e, { nick: NICKS[Math.floor(Math.random() * NICKS.length)], side, kind: "buy", amt, price: q.avg });
    });
    refreshPrices();
    if (modalEvent && $("#m-chart")) { if (!mChartHover) paintChart(); paintModalLive(); } // пока курсор на графике, не перерисовываем его
    if (state.route === "account" && $("#modal").hidden) paintAccountRight();
  }
  setInterval(tick, 5000);
  setInterval(() => PERPS.tick(), 1000);

  // ---------- общие обработчики ----------
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    const dr = t.closest("[data-demoresolve]");
    if (dr && modalEvent) return confirmResolve(modalEvent, dr.dataset.demoresolve);
    const depf = t.closest("[data-depf]");
    if (depf) { depFilter = depf.dataset.depf; depLimit = 10; return paintDeposits(); }
    if (t.closest("[data-depmore]")) { depLimit += 10; return paintDeposits(); }
    const txf = t.closest("[data-txf]");
    if (txf) { accFilter = txf.dataset.txf; accLimit = 15; return paintAccountTx(); }
    if (t.closest("[data-txmore]")) { accLimit += 15; return paintAccountTx(); }
    const lbr = t.closest("tr[data-go]");
    if (lbr && !t.closest("a")) { location.hash = lbr.dataset.go; return; }
    const go = t.closest("[data-goasset]");
    if (go) PERPS.select(go.dataset.goasset);
    const vote = t.closest("[data-vote]");
    if (vote) {
      const id = vote.dataset.vote;
      voted = voted.includes(id) ? voted.filter((x) => x !== id) : [...voted, id];
      store.set("voted", voted);
      return ($("#ideas").innerHTML = ideasHTML());
    }
    const cp = t.closest("[data-copyidea]");
    if (cp) {
      const idea = myIdeas.find((x) => x.id === cp.dataset.copyidea);
      return copyText(ideaText(idea)).then((ok) => toast(ok ? "Скопировано. Вставьте в чат канала." : "Не удалось скопировать. Выделите текст вручную."));
    }
    const sell = t.closest("[data-sell]");
    if (sell) return confirmSell(sell.dataset.sell);
    if (t.closest("[data-settings]") || t.closest("#settings")) return openSettings();
    if (t.closest("[data-deposit]") || t.closest("#wallet")) return openDeposit();
    const pick = t.closest("[data-pick]");
    if (pick) state.cat = pick.dataset.pick;
    const tab = t.closest(".tab[data-cat]");
    if (tab) {
      state.cat = tab.dataset.cat;
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === tab));
      return paintGrid();
    }
    const open = t.closest("[data-open]");
    if (open) {
      const btn = t.closest(".btn");
      openBet(Number(open.dataset.open), btn ? btn.dataset.side : undefined);
    }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "search") { state.q = ev.target.value; paintGrid(); }
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.id === "sort") { state.sort = ev.target.value; paintGrid(); }
  });
  $("#c-no").onclick = closeConfirm;
  $("#c-yes").onclick = () => { const f = onConfirm; closeConfirm(); if (f) f(); };
  $("#confirm").onclick = (ev) => { if (ev.target.id === "confirm") closeConfirm(); };
  $("#close").onclick = closeModal;
  $("#modal").onclick = (ev) => { if (ev.target.id === "modal") closeModal(); };
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { if (!$("#confirm").hidden) closeConfirm(); else closeModal(); } });

  EVENTS.forEach((e) => { // итоги, заданные заранее (в events.js) или сохранённые в браузере
    const out = resolved[e.id] || (typeof RESOLUTIONS !== "undefined" ? RESOLUTIONS[e.id] : null);
    if (out === "yes" || out === "no") settleMarket(e, out, true);
  });
  window.RP = {
    store, rub, toast, askConfirm, openSheet, closeModal, chatHTML, chatBind,
    route: () => state.route,
    clsOn,
    openMarket: (id) => openBet(id),
    getBalance: () => balance,
    setBalance: (v) => { setBalance(v); if (state.route === "account") paintAccountRight(); }
  };
  PERPS.init();
  syncBonusNav();
  startPoly();
  setBalance(balance);
  render();
})();

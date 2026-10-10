(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const COLORS = ["#1d4ed8", "#d52b1e", "#15803d", "#b45309", "#7c3aed", "#0e7490"];
  const DEFAULT_PROFILE = { nick: "Гость", city: "", bio: "", color: COLORS[0], fav: "all" };
  const FEE = 0.02; // комиссия за продажу позиции
  const WIN_FEE = 0.02; // комиссия платформы с выигрыша: 2% от (выплата минус ставка)
  const HOURS = 720; // история цены: 30 дней по часам
  const RANGES = { "1Д": 24, "1Н": 168, "1М": 720 };
  const state = { cat: "all", q: "", sort: "volume", route: "home" };
  let modalEvent = null; // рынок, открытый в окне
  let modalRange = "1Н";

  // ---------- хранилище (localStorage может быть недоступен) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("rp_" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("rp_" + k, JSON.stringify(v)); } catch {} }
  };
  let profile = { ...DEFAULT_PROFILE, ...store.get("profile", {}) };
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
  // Шапка: «Портфель» — наличные плюс вложенное в пулы и трейдинг, «Наличные» — свободный баланс.
  function paintWallet() {
    const cash = $("#balance"), port = $("#portfolio");
    if (!cash) return;
    cash.textContent = rub(balance);
    let inPlay = 0;
    try { inPlay = bets.reduce((s, b) => s + b.amt, 0) + PERPS.locked(); } catch {}
    if (port) port.textContent = rub(balance + inPlay);
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
    const d = new Date(Date.now() - (n - 1 - i) * 3600e3);
    return key === "1Д"
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
      <text class="tip" hidden></text>
    </svg>`;
  }
  function bindChart(host, vals, key) {
    const svg = $("svg", host);
    if (!svg) return;
    const g = geom(vals);
    const cross = $(".cross", svg), dot = $(".dot", svg), tip = $(".tip", svg);
    const show = (on) => [cross, dot, tip].forEach((el) => (el.hidden = !on));
    svg.onpointerleave = () => show(false);
    svg.onpointermove = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * g.W;
      const i = clamp(Math.round(((px - g.L) / (g.W - g.L - g.R)) * (g.n - 1)), 0, g.n - 1);
      const x = g.x(i), y = g.y(vals[i]);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      dot.setAttribute("cx", x); dot.setAttribute("cy", y);
      tip.textContent = `${pct1(vals[i])}% · ${timeLabel(g.n, i, key)}`;
      tip.setAttribute("x", clamp(x, 70, g.W - 70)); tip.setAttribute("y", Math.max(y - 10, g.T + 10));
      tip.setAttribute("text-anchor", "middle");
      show(true);
    };
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
    return EVENTS.filter((x) => x.id !== e.id && isOpen(x))
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
    const hot = [...EVENTS].sort((a, b) => b.vol - a.vol);
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
        <div class="cats">${CATEGORIES.map((c) => {
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
        <div class="grid" style="padding-bottom:0">${EVENTS.filter((e) => isOpen(e) && daysLeft(e) <= 14).sort((x, y) => x.closes.localeCompare(y.closes) || y.vol - x.vol).slice(0, 6).map(cardHTML).join("")}</div>
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
    const inCat = (e) => state.cat === "all" || (state.cat === "soon" ? isOpen(e) && daysLeft(e) <= 14 : e.cat === state.cat);
    return EVENTS.filter((e) => inCat(e) && (!q || e.q.toLowerCase().includes(q))).sort(state.cat === "soon" && state.sort === "volume" ? sorts.closing : sorts[state.sort]);
  }

  function viewMarkets() {
    const tabs = [{ id: "all", name: "Все" }, { id: "soon", name: "Скоро закроются" }, ...CATEGORIES];
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
        <tr class="${t.me ? "me" : ""}">
          <td class="rank ${i < 3 ? "top" : ""}">${i + 1}</td>
          <td><span class="who">${avatar(t.nick, t.color || traderColor(t.nick))}${esc(t.nick)}${t.me ? " (вы)" : ""}</span></td>
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
      <p class="page-sub">PNL — доходность на вложенные средства, общая прибыль — в игровых рублях. Все трейдеры вымышлены. Ваша прибыль считается по проданным позициям, с учётом комиссии 2%.</p>
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

  // ---------- наличные и деньги в игре ----------
  function paintAccountStats() {
    const box = $("#acc-stats");
    if (!box) return;
    const inPools = bets.reduce((s, b) => s + b.amt, 0);
    const inTrade = PERPS.locked();
    const inPlay = inPools + inTrade, total = balance + inPlay;
    const share = total > 0 ? Math.round((balance / total) * 100) : 100;
    box.innerHTML = `
      <div class="stat cash">
        <span class="stat-ic">${payIcon("crypto", 40)}</span>
        <div><small>Наличные на балансе</small><b>${rub(balance)}</b><em>свободные деньги: можно сразу вложить в пул или трейдинг</em></div>
        <button class="pbtn" data-deposit>Пополнить</button>
      </div>
      <div class="stat play">
        <span class="stat-ic play-ic">${payIcon("sbp", 40)}</span>
        <div><small>В пулах и трейдинге</small><b>${rub(inPlay)}</b><em>в пулах ${rub(inPools)} (${bets.length} ${bets.length === 1 ? "ставка" : "ставок"}) · в трейдинге ${rub(inTrade)} (маржа)</em></div>
      </div>
      <div class="stat-bar" title="Доля наличных в общих средствах">
        <div class="stat-bar-t"><span>Всего средств: <b>${rub(total)}</b></span><span>наличные ${share}% · в игре ${100 - share}%</span></div>
        <div class="stat-bar-b"><i style="width:${share}%"></i></div>
      </div>`;
  }

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
              <td>${d.coin ? esc(d.coin) : rub(d.rub)}</td>
              <td>${d.method === "sbp" ? "СБП-" : ""}${esc(d.id)}</td>
              <td><span class="tag yes">Зачислено</span></td>
              <td class="pos"><b>+${rub(d.rub)}</b></td>
            </tr>`;
          }).join("")}</tbody></table></div>${list.length > depLimit ? `<button class="sbtn" style="margin-top:12px" data-depmore>Показать ещё (${list.length - depLimit})</button>` : ""}`
        : `<p class="empty" style="padding:18px">${deposits.length ? "По этому способу пополнений нет." : "Пополнений пока нет."} <a href="#account" style="color:var(--brand)" data-deposit>Пополнить баланс</a></p>`}`;
  }

  // ---------- все операции аккаунта (рынки прогнозов, трейдинг и пополнения) ----------
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
    const tabs = [["all", "Все"], ["pred", "Рынки прогнозов"], ["perp", "Трейдинг"], ["dep", "Пополнения"]];
    $("#acc-txf").innerHTML = tabs.map(([id, n]) => `<button class="chip ${id === accFilter ? "on" : ""}" data-txf="${id}">${n} · ${id === "all" ? all.length : all.filter((r) => r.sec === id).length}</button>`).join("");
    if (!list.length) {
      box.innerHTML = `<p class="empty" style="padding:18px">Сделок пока нет. Откройте <a href="#markets" style="color:var(--brand)">рынки</a> или <a href="#trade" style="color:var(--brand)">трейдинг</a>.</p>`;
      return;
    }
    box.innerHTML = `<div class="table-wrap" style="margin:0"><table class="acc-tx"><thead><tr><th>Когда</th><th>Раздел</th><th>Событие</th><th>Сделка</th><th>Сумма</th><th>Вер. · коэф.</th><th>Результат</th></tr></thead><tbody>${list.slice(0, accLimit).map((r) => {
      const w = when(r.t);
      return `<tr>
        <td><span class="tx-when">${w.abs}</span><small>${w.rel}</small></td>
        <td>${{ pred: "Прогноз", perp: "Трейдинг", dep: "Пополнение" }[r.sec]}</td>
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
      <div class="acc-stats" id="acc-stats"></div>
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
  const routes = { rules: viewRules, home: viewHome, markets: viewMarkets, trade: () => PERPS.view(), leaderboard: viewLeaderboard, community: viewCommunity, account: viewAccount };
  function render() {
    const r = (location.hash || "#home").slice(1);
    state.route = routes[r] ? r : "home";
    $("#view").innerHTML = routes[state.route]();
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === state.route));
    if (state.route === "markets") paintGrid();
    if (state.route === "account") { bindAccount(); paintAccountStats(); paintDeposits(); paintAccountTx(); }
    if (state.route === "community") bindCommunity();
    if (state.route === "trade") PERPS.bind();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);

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
  const openSheet = (html, fs) => { $("#sheet-body").innerHTML = html; $("#modal").classList.toggle("fs", !!fs); $("#modal").hidden = false; $("#modal").scrollTop = 0; };
  const closeModal = () => { $("#modal").hidden = true; modalEvent = null; };

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
    const vals = modalEvent.hist.slice(-RANGES[modalRange]);
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

  function openDeposit() {
    modalEvent = null;
    openSheet(`
      <h2>Пополнить пул</h2>
      <p>Демо-режим: реальные платежи не принимаются, вы получаете игровые рубли. Реквизиты ниже вымышлены, ничего не отправляйте.</p>
      <div id="dep-root"></div>`);
    depStep1();
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
        <div><small>В рублях</small><div class="dp-inp"><input class="field" id="dep" type="number" min="${DEP_MIN}" max="${DEP_MAX}" step="100" value="${dep.amount || ""}" aria-label="Сумма пополнения в рублях"><i>₽</i></div></div>
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
      <button class="submit" id="dep-go">Продолжить</button>
      <div class="msg ${note ? "err" : ""}" id="msg">${note || ""}</div>
      <small class="dp-fine">Лимиты: от ${rub(DEP_MIN)} до ${rub(DEP_MAX)}. Комиссия за пополнение в демо не взимается.</small>`;
    const sum = () => {
      const v = depAmount();
      $("#dp-sum").innerHTML = m === "sbp"
        ? `<div><span>К оплате</span><b>${v > 0 ? rub(v) : "—"}</b></div>`
        : `<div><span>Будет зачислено</span><b>${v > 0 ? rub(v) : "—"}</b></div>
           <div><span>К отправке · демо-курс 1 ${dep.coin} = ${nf.format(c.rate)} ₽</span><b>${v > 0 ? tokStr(depTok()) + " " + dep.coin : "—"}</b></div>`;
    };
    sum();
    if (m === "sbp") {
      $("#dep").oninput = () => { dep.amount = depAmount() || 0; sum(); };
      root.querySelector(".chips").onclick = (ev) => { const b = ev.target.closest(".chip"); if (b) { $("#dep").value = b.dataset.v; dep.amount = Number(b.dataset.v); sum(); } };
    } else {
      // два поля связаны: меняете рубли — пересчитываются токены, меняете токены — пересчитываются рубли
      const rubIn = $("#dep"), tokIn = $("#dep-tok");
      const fromRub = () => { dep.tok = null; dep.amount = depAmount() || 0; tokIn.value = dep.amount > 0 ? tokInput(dep.amount / c.rate) : ""; sum(); };
      const fromTok = () => { const t = parseTok(tokIn.value); dep.tok = t > 0 ? t : null; dep.amount = t > 0 ? Math.round(t * c.rate) : 0; rubIn.value = dep.amount > 0 ? dep.amount : ""; sum(); };
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
      if (m === "crypto" && !(depTok() > 0)) return depStep1("Введите сумму в рублях или в " + dep.coin + ".");
      if (!(v >= DEP_MIN)) return depStep1(`Минимальная сумма — ${rub(DEP_MIN)} (≈ ${tokStr(DEP_MIN / c.rate)} ${dep.coin}).`);
      if (v > DEP_MAX) return depStep1(`Максимальная сумма — ${rub(DEP_MAX)} (≈ ${tokStr(DEP_MAX / c.rate)} ${dep.coin}).`);
      dep.amount = v;
      depStep2(Math.random().toString(36).slice(2, 8).toUpperCase());
    };
  }

  function depStep2(ref) {
    const root = $("#dep-root"), v = dep.amount, m = dep.method, c = COINS[dep.coin], net = c.nets[dep.net];
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
            <div><span>Отправьте ровно</span><b>${tokStr(depTok())} ${dep.coin}</b></div>
            <div><span>Монета</span><b class="dp-inl">${payIcon(dep.coin, 20)}${dep.coin}</b></div>
            <div><span>Сеть</span><b>${net[0]}</b></div>
            <div><span>Эквивалент</span><b>${rub(v)}</b></div>
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
    const v = dep.amount, m = dep.method, c = COINS[dep.coin], net = c.nets[dep.net];
    const rec = { id: ref, t: Date.now(), status: "done", method: m, rub: v, via: m === "sbp" ? dep.bank : dep.coin + " · " + net[0], coin: m === "crypto" ? tokStr(depTok()) + " " + dep.coin : "" };
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
    if (modalEvent && $("#m-chart")) { paintChart(); paintModalLive(); }
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
    getBalance: () => balance,
    setBalance: (v) => { setBalance(v); if (state.route === "account") paintAccountRight(); }
  };
  PERPS.init();
  startPoly();
  setBalance(balance);
  render();
})();

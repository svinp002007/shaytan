(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const COLORS = ["#1d4ed8", "#d52b1e", "#15803d", "#b45309", "#7c3aed", "#0e7490"];
  const DEFAULT_PROFILE = { nick: "Гость", city: "", bio: "", color: COLORS[0], fav: "all" };
  const FEE = 0.02; // комиссия за продажу позиции
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
  let myIdeas = store.get("ideas", []);
  let voted = store.get("voted", []);

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
    $("#balance").textContent = rub(balance);
  }
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
  const priceOf = (e, side) => (side === "yes" ? cents(e) : 100 - cents(e));
  function syncYes(e) {
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
        <td><span class="tag ${x.side}">${x.kind === "sell" ? "Продажа" : "Покупка"} · ${x.side === "yes" ? "Да" : "Нет"}</span></td>
        <td>${rub(x.amt)}</td>
        <td>${pct1(x.price)}¢</td>
      </tr>`;
    }).join("");
    return `<h3 class="pos-title">История сделок</h3>
      <p class="tx-sum">${e.trades.length} сделок · за 24 часа ${rub(day)}</p>
      <div class="tx-scroll"><table class="tx"><thead><tr><th>Когда</th><th>Трейдер</th><th>Сделка</th><th>Сумма</th><th>Цена</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
    addTrade(e, { nick: profile.nick, own: true, side: b.side, kind: "sell", amt: v.net, price: (v.gross / b.shares) * 100 });
    closed.push({ eid: b.eid, side: b.side, amt: b.amt, net: v.net, fee: v.fee, ts: Date.now() });
    store.set("bets", bets);
    store.set("closed", closed);
    setBalance(balance + v.net);
    refreshPrices();
    toast(`Продано за ${rub(v.net)} (комиссия ${rub(v.fee)}). ${v.pnl >= 0 ? "Прибыль" : "Убыток"}: ${signed(v.pnl)} ₽`);
    if (modalEvent) { paintChart(); paintModalLive(); }
    if (state.route === "account") paintAccountRight();
  }
  const realized = () => closed.reduce((s, c) => s + (c.net - c.amt), 0) + PERPS.realized();
  const closedStake = () => closed.reduce((s, c) => s + c.amt, 0) + PERPS.closedMargin();

  function positionsHTML(list) {
    return list.map((b) => {
      const v = valueOf(b);
      return `<div class="pos-row">
        <div class="pos-main">
          <span class="tag ${b.side}">${b.side === "yes" ? "Да" : "Нет"}</span>
          <span>${rub(b.amt)} · ${pct1(b.shares)} долей · ср. ${pct1(b.price)}¢</span>
          <span class="${v.pnl >= 0 ? "pos" : "neg"}">${signed(v.pnl)} ₽</span>
        </div>
        <button class="sell" data-sell="${b.id}">Продать за ${rub(v.net)}</button>
        <div class="pos-note">По рынку ${rub(v.gross)} − комиссия 2% (${rub(v.fee)})</div>
      </div>`;
    }).join("");
  }

  // ---------- карточка рынка ----------
  const cardHTML = (e) => `
    <article class="card" data-open="${e.id}">
      ${banner(e)}
      <div class="cat">${catName(e.cat)}</div>
      <h3>${esc(e.q)}</h3>
      <div class="meter">
        <div class="pct">${Math.round(e.yes)}%</div>
        <div class="spark-host">${spark(e.hist)}</div>
      </div>
      <div class="btns">
        <button class="btn yes" data-open="${e.id}" data-side="yes">Да ${cents(e)}¢</button>
        <button class="btn no" data-open="${e.id}" data-side="no">Нет ${100 - cents(e)}¢</button>
      </div>
      <div class="meta"><span class="vol">Пул ${short(e.vol)} ₽</span><span>до ${fmtDate(e.closes)}</span></div>
    </article>`;

  // ---------- страницы ----------
  function viewHome() {
    const hot = [...EVENTS].sort((a, b) => b.vol - a.vol);
    const featured = hot[0];
    const totalVol = EVENTS.reduce((s, e) => s + e.vol, 0);
    const topTraders = [...TRADERS].sort((a, b) => b.profit - a.profit).slice(0, 5);
    return `
    <section class="hero">
      <div class="wrap">
        <div>
          <div class="eyebrow">Рынок прогнозов России</div>
          <h1>Знаешь, что будет дальше? <em>Вложи в пул</em> и забери разницу.</h1>
          <p class="lead">Ставь на курс рубля, решения ЦБ, нефть, крипту, спорт и политику. Цена «Да» — это вероятность события: 62¢ значит 62%. Угадал — получил ₽1 за каждую долю. Передумал — продай в любой момент.</p>
          <div class="cta-row">
            <button class="cta primary" data-deposit>Пополнить пул</button>
            <a class="cta ghost" href="#markets">Смотреть рынки</a>
          </div>
          <div class="demo-note">Демо-режим: игровые рубли, реальные деньги не принимаются.</div>
        </div>
        <div class="hero-card" data-open="${featured.id}" style="cursor:pointer">
          ${banner(featured, "in-hero", 460, 96)}
          <div class="eyebrow">Самый большой пул · ${catName(featured.cat)}</div>
          <div class="q">${esc(featured.q)}</div>
          <div class="big"><span class="pct">${Math.round(featured.yes)}%</span> <small>вероятность «Да»</small></div>
          <div class="spark-host hero-spark">${spark(featured.hist)}</div>
          <div class="btns">
            <button class="btn yes" data-open="${featured.id}" data-side="yes">Да ${cents(featured)}¢</button>
            <button class="btn no" data-open="${featured.id}" data-side="no">Нет ${100 - cents(featured)}¢</button>
          </div>
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

      <section class="block">
        <div class="block-head"><h2>Горячие рынки</h2><a href="#markets">Все рынки →</a></div>
        <div class="grid" style="padding-bottom:0">${hot.slice(1, 7).map(cardHTML).join("")}</div>
      </section>

      <section class="block">
        <div class="block-head"><h2>Категории</h2></div>
        <div class="cats">${CATEGORIES.map((c) => {
          const n = EVENTS.filter((e) => e.cat === c.id);
          return `<a class="cat-tile" href="#markets" data-pick="${c.id}"><b>${c.name}</b><span>${n.length} рынков · пул ${short(n.reduce((s, e) => s + e.vol, 0))} ₽</span></a>`;
        }).join("")}</div>
      </section>

      <section class="block">
        <div class="block-head"><h2>Как это работает</h2></div>
        <div class="steps">
          <div class="step"><b>Пополните пул</b><span>Получите игровые рубли на баланс одним нажатием.</span></div>
          <div class="step"><b>Выберите исход</b><span>«Да» или «Нет» по цене в копейках. Смотрите график цены перед ставкой.</span></div>
          <div class="step"><b>Заберите выплату или продайте</b><span>Если исход сбылся, каждая доля стоит ₽1. Продать позицию можно в любой момент, комиссия 2%.</span></div>
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
      closing: (a, b) => a.closes.localeCompare(b.closes),
      chance: (a, b) => b.yes - a.yes
    };
    return EVENTS.filter((e) => (state.cat === "all" || e.cat === state.cat) && (!q || e.q.toLowerCase().includes(q))).sort(sorts[state.sort]);
  }

  function viewMarkets() {
    const tabs = [{ id: "all", name: "Все" }, ...CATEGORIES];
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
    const staked = bets.reduce((s, b) => s + b.amt, 0);
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
          return `<div class="bet"><div class="t">${esc(byId(c.eid).q)}</div><div class="d"><span><span class="tag ${c.side}">${c.side === "yes" ? "Да" : "Нет"}</span> вложено ${rub(c.amt)} · получено ${rub(c.net)}</span><span class="${p >= 0 ? "pos" : "neg"}">${signed(p)} ₽</span></div></div>`;
        }).join("")}</div>`
      : "";
    return `
      <h3>Мои средства и ставки</h3>
      <div class="kpis">
        <div class="kpi"><b>${rub(balance)}</b><span>баланс</span></div>
        <div class="kpi"><b>${rub(staked)}</b><span>в игре</span></div>
        <div class="kpi"><b>${bets.length}</b><span>открытых ставок</span></div>
        <div class="kpi"><b class="${r >= 0 ? "pos" : "neg"}">${signed(r)} ₽</b><span>прибыль по проданным</span></div>
      </div>
      <div class="row-actions" style="margin:0 0 18px"><button class="pbtn" data-deposit>Пополнить пул</button></div>
      <div class="bets">${open}</div>${hist}`;
  }
  const paintAccountRight = () => { const el = $("#acc-right"); if (el) el.innerHTML = accountRight(); };

  function viewAccount() {
    return `<div class="wrap">
      <h1 class="page-title">Мой аккаунт</h1>
      <p class="page-sub">Данные профиля хранятся в вашем браузере и меняются в любой момент.</p>
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
  const routes = { home: viewHome, markets: viewMarkets, trade: () => PERPS.view(), leaderboard: viewLeaderboard, community: viewCommunity, account: viewAccount };
  function render() {
    const r = (location.hash || "#home").slice(1);
    state.route = routes[r] ? r : "home";
    $("#view").innerHTML = routes[state.route]();
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === state.route));
    if (state.route === "markets") paintGrid();
    if (state.route === "account") bindAccount();
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
      store.set("profile", profile);
      store.set("bets", bets);
      store.set("closed", closed);
      setBalance(10000);
      toast("Аккаунт сброшен");
      render();
    };
  }

  // ---------- модальные окна ----------
  const openSheet = (html) => { $("#sheet-body").innerHTML = html; $("#modal").hidden = false; };
  const closeModal = () => { $("#modal").hidden = true; modalEvent = null; };

  let chosenSide = "yes";
  function openBet(id, side) {
    const e = byId(id);
    modalEvent = e;
    chosenSide = side || "yes";
    openSheet(`
      ${banner(e, "in-modal", 560, 120)}
      <div class="cat">${catName(e.cat)}</div>
      <h2>${esc(e.q)}</h2>
      <p>Закрытие ${fmtDate(e.closes)} · <span id="m-vol"></span></p>
      <div class="chart-head">
        <div><span class="chart-now" id="m-now"></span> <span class="chart-delta" id="m-delta"></span></div>
        <div class="range" id="m-range">${Object.keys(RANGES).map((k) => `<button data-range="${k}" class="${k === modalRange ? "on" : ""}">${k}</button>`).join("")}</div>
      </div>
      <div class="chart" id="m-chart"></div>
      <div class="probbar" id="m-bar"></div>
      <div class="seg">
        <button class="yes" data-side="yes"></button>
        <button class="no" data-side="no"></button>
      </div>
      <input class="field" id="amt" type="number" min="1" step="100" value="500" aria-label="Сумма ставки в рублях">
      <div class="impact" id="impact"></div>
      <button class="submit" id="buy">Вложить в пул</button>
      <div class="msg" id="msg"></div>
      <p class="fee-note">Цену определяет поток денег: чем больше ставок на «Да», тем выше вероятность «Да» и ниже «Нет». Продать позицию можно в любой момент, комиссия 2%.</p>
      <div id="m-pos"></div>
      <div id="m-tx"></div>`);
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
      if (amt > balance) return (msg.textContent = "Недостаточно средств. Пополните пул.");
      const side = chosenSide, q = quoteBuy(e, side, amt);
      askConfirm({
        title: "Подтвердите покупку",
        okText: "Купить",
        rows: [
          ["Рынок", esc(e.q)],
          ["Исход", `«${side === "yes" ? "Да" : "Нет"}», средняя цена ${pct1(q.avg)}¢`],
          ["Сумма", rub(amt)],
          ["Долей", pct1(q.shares)],
          ["Выплата при успехе", `<b>${rub(q.shares)}</b>`],
          ["«Да» после ставки", `${pct1(prob(e))}% → ${pct1(q.after)}%`],
          ["Комиссия при продаже", "2%"]
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
    $("#m-bar").innerHTML = `<div class="pbar"><div style="width:${e.yes}%"></div></div><div class="pleg"><span>Да ${pct1(e.yes)}%</span><span>Нет ${pct1(100 - e.yes)}%</span></div>`;
    const yb = $(".seg .yes"), nb = $(".seg .no");
    yb.textContent = `Да ${cents(e)}¢`; nb.textContent = `Нет ${100 - cents(e)}¢`;
    yb.classList.toggle("on", chosenSide === "yes"); nb.classList.toggle("on", chosenSide === "no");
    const amt = Number($("#amt").value) || 0;
    const q = quoteBuy(e, chosenSide, amt);
    const word = chosenSide === "yes" ? "Да" : "Нет";
    $("#impact").innerHTML = amt > 0
      ? `<div><span>Долей · средняя цена</span><b>${pct1(q.shares)} · ${pct1(q.avg)}¢</b></div>
         <div><span>Выплата при «${word}»</span><b>${rub(q.shares)}</b></div>
         <div><span>Вероятность после ставки</span><b>Да ${pct1(prob(e))}% → ${pct1(q.after)}% · Нет ${pct1(100 - prob(e))}% → ${pct1(100 - q.after)}%</b></div>`
      : "";
    const tx = $("#m-tx"), box = $(".tx-scroll", tx), top = box ? box.scrollTop : 0;
    tx.innerHTML = txHTML(e);
    if (top) $(".tx-scroll", tx).scrollTop = top;
    const mine = bets.filter((b) => b.eid === e.id);
    $("#m-pos").innerHTML = mine.length ? `<h3 class="pos-title">Ваши позиции на этом рынке</h3>${positionsHTML(mine)}` : "";
  }

  function openDeposit() {
    modalEvent = null;
    openSheet(`
      <h2>Пополнить пул</h2>
      <p>Демо-режим: вы получаете игровые рубли. Реальные платежи не принимаются.</p>
      <div class="chips">${[1000, 5000, 10000, 50000].map((v) => `<button class="chip" data-v="${v}">${rub(v)}</button>`).join("")}</div>
      <input class="field" id="dep" type="number" min="1" step="100" value="5000" aria-label="Сумма пополнения в рублях" style="margin-bottom:14px">
      <button class="submit" id="dep-go">Пополнить</button>
      <div class="msg" id="msg"></div>`);
    $(".chips").onclick = (ev) => { const c = ev.target.closest(".chip"); if (c) $("#dep").value = c.dataset.v; };
    $("#dep-go").onclick = () => {
      const v = Math.floor(Number($("#dep").value));
      const msg = $("#msg");
      if (!(v > 0)) { msg.className = "msg err"; return (msg.textContent = "Введите сумму."); }
      setBalance(balance + v);
      msg.className = "msg";
      msg.textContent = `Баланс пополнен на ${rub(v)}.`;
      if (state.route === "account") paintAccountRight();
    };
  }

  // ---------- «живые» цены ----------
  // Обновляет цены на карточках и в открытом окне после любой сделки.
  function refreshPrices() {
    document.querySelectorAll(".card[data-open], .hero-card[data-open]").forEach((c) => {
      const e = byId(Number(c.dataset.open));
      const p = $(".pct", c);
      if (p) p.textContent = Math.round(e.yes) + "%";
      const y = $(".btn.yes", c), n = $(".btn.no", c);
      if (y) y.textContent = `Да ${cents(e)}¢`;
      if (n) n.textContent = `Нет ${100 - cents(e)}¢`;
      const v = $(".vol", c);
      if (v) v.textContent = `Пул ${short(e.vol)} ₽`;
      const s = $(".spark-host", c);
      if (s) s.innerHTML = spark(e.hist);
    });
  }
  // Демо: другие трейдеры тоже делают небольшие ставки, поэтому цены двигаются сами, по тем же правилам.
  function tick() {
    if (!$("#confirm").hidden) return; // цены стоят, пока открыто подтверждение
    EVENTS.forEach((e) => {
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

  window.RP = {
    store, rub, toast, askConfirm, openSheet, closeModal,
    route: () => state.route,
    getBalance: () => balance,
    setBalance: (v) => { setBalance(v); if (state.route === "account") paintAccountRight(); }
  };
  PERPS.init();
  setBalance(balance);
  render();
})();

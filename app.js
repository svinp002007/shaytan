(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const COLORS = ["#1d4ed8", "#d52b1e", "#15803d", "#b45309", "#7c3aed", "#0e7490"];
  const DEFAULT_PROFILE = { nick: "Гость", city: "", bio: "", color: COLORS[0], fav: "all" };
  const state = { cat: "all", q: "", sort: "volume", route: "home" };

  // ---------- хранилище (localStorage может быть недоступен) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("rp_" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("rp_" + k, JSON.stringify(v)); } catch {} }
  };
  let profile = { ...DEFAULT_PROFILE, ...store.get("profile", {}) };
  let balance = Number(store.get("balance", 10000)) || 0;
  let bets = store.get("bets", []);

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
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- карточка рынка ----------
  const cardHTML = (e) => `
    <article class="card" data-open="${e.id}">
      <div class="cat">${catName(e.cat)}</div>
      <h3>${esc(e.q)}</h3>
      <div class="meter">
        <div class="pct">${e.yes}%</div>
        <div class="bar-track"><div class="bar-fill" style="width:${e.yes}%"></div></div>
      </div>
      <div class="btns">
        <button class="btn yes" data-open="${e.id}" data-side="yes">Да ${e.yes}¢</button>
        <button class="btn no" data-open="${e.id}" data-side="no">Нет ${100 - e.yes}¢</button>
      </div>
      <div class="meta"><span>Пул ${short(e.vol)} ₽</span><span>до ${fmtDate(e.closes)}</span></div>
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
          <p class="lead">Ставь на курс рубля, решения ЦБ, нефть, крипту, спорт и политику. Цена «Да» — это вероятность события: 62¢ значит 62%. Угадал — получил ₽1 за каждую долю.</p>
          <div class="cta-row">
            <button class="cta primary" data-deposit>Пополнить пул</button>
            <a class="cta ghost" href="#markets">Смотреть рынки</a>
          </div>
          <div class="demo-note">Демо-режим: игровые рубли, реальные деньги не принимаются.</div>
        </div>
        <div class="hero-card" data-open="${featured.id}" style="cursor:pointer">
          <div class="eyebrow">Самый большой пул · ${catName(featured.cat)}</div>
          <div class="q">${esc(featured.q)}</div>
          <div class="big">${featured.yes}% <small>вероятность «Да»</small></div>
          <div class="track"><div class="fill" style="width:${featured.yes}%"></div></div>
          <div class="btns">
            <button class="btn yes" data-open="${featured.id}" data-side="yes">Да ${featured.yes}¢</button>
            <button class="btn no" data-open="${featured.id}" data-side="no">Нет ${100 - featured.yes}¢</button>
          </div>
        </div>
      </div>
    </section>

    <div class="wrap">
      <div class="stats">
        <div class="stat"><b>${EVENTS.length}</b><span>открытых рынков</span></div>
        <div class="stat"><b>${short(totalVol)} ₽</b><span>объём всех пулов</span></div>
        <div class="stat"><b>${nf.format(12480 + TRADERS.length)}</b><span>трейдеров (демо)</span></div>
        <div class="stat"><b>${CATEGORIES.length}</b><span>категорий</span></div>
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
          <div class="step"><b>Выберите исход</b><span>«Да» или «Нет» по цене в копейках. Чем дешевле доля, тем больше выплата.</span></div>
          <div class="step"><b>Заберите выплату</b><span>Если исход сбылся, каждая доля стоит ₽1. Если нет, ставка сгорает.</span></div>
        </div>
      </section>

      <section class="block">
        <div class="block-head"><h2>Лучшие трейдеры</h2><a href="#leaderboard">Весь рейтинг →</a></div>
        ${leaderTable(topTraders, false)}
      </section>

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
      <p class="page-sub">Выберите событие и поставьте на «Да» или «Нет».</p>
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
      const staked = bets.reduce((s, b) => s + b.amt, 0);
      list.push({ nick: profile.nick, profit: 0, pnl: 0, trades: bets.length, win: 0, me: true, color: profile.color, staked });
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
      <p class="page-sub">PNL — доходность на вложенные средства, общая прибыль — в игровых рублях. Все трейдеры вымышлены. Ваша строка появится в рейтинге после первых закрытых рынков.</p>
      ${leaderTable(rows, true)}
    </div>`;
  }

  function viewAccount() {
    const staked = bets.reduce((s, b) => s + b.amt, 0);
    const betsHTML = bets.length
      ? bets.slice().reverse().map((b) => {
          const e = byId(b.eid);
          const shares = (b.amt / b.price) * 100;
          return `<div class="bet">
            <div class="t">${esc(e.q)}</div>
            <div class="d"><span><span class="tag ${b.side}">${b.side === "yes" ? "Да" : "Нет"}</span> по ${b.price}¢ · ${rub(b.amt)}</span><span>Выплата при успехе: <b>${rub(shares)}</b></span></div>
          </div>`;
        }).join("")
      : `<p class="empty" style="padding:20px">Ставок пока нет. Откройте <a href="#markets" style="color:var(--brand)">рынки</a> и сделайте первый прогноз.</p>`;
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
        <div class="panel">
          <h3>Мои средства и ставки</h3>
          <div class="kpis">
            <div class="kpi"><b>${rub(balance)}</b><span>баланс</span></div>
            <div class="kpi"><b>${rub(staked)}</b><span>в игре</span></div>
            <div class="kpi"><b>${bets.length}</b><span>открытых ставок</span></div>
          </div>
          <div class="row-actions" style="margin:0 0 18px"><button class="pbtn" data-deposit>Пополнить пул</button></div>
          <div class="bets">${betsHTML}</div>
        </div>
      </div>
    </div>`;
  }

  // ---------- роутер ----------
  const routes = { home: viewHome, markets: viewMarkets, leaderboard: viewLeaderboard, account: viewAccount };
  function render() {
    const r = (location.hash || "#home").slice(1);
    state.route = routes[r] ? r : "home";
    $("#view").innerHTML = routes[state.route]();
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === state.route));
    if (state.route === "markets") paintGrid();
    if (state.route === "account") bindAccount();
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
      store.set("profile", profile);
      store.set("bets", bets);
      setBalance(10000);
      toast("Аккаунт сброшен");
      render();
    };
  }

  // ---------- модальные окна ----------
  const openSheet = (html) => { $("#sheet-body").innerHTML = html; $("#modal").hidden = false; };
  const closeModal = () => ($("#modal").hidden = true);

  function openBet(id, side) {
    const e = byId(id);
    let chosen = side || "yes";
    const price = () => (chosen === "yes" ? e.yes : 100 - e.yes);
    openSheet(`
      <div class="cat">${catName(e.cat)}</div>
      <h2>${esc(e.q)}</h2>
      <p>Закрытие ${fmtDate(e.closes)} · пул ${short(e.vol)} ₽</p>
      <div class="seg">
        <button class="yes" data-side="yes">Да ${e.yes}¢</button>
        <button class="no" data-side="no">Нет ${100 - e.yes}¢</button>
      </div>
      <input class="field" id="amt" type="number" min="1" step="100" value="500" aria-label="Сумма ставки в рублях">
      <div class="calc"><span id="shares"></span><span id="payout"></span></div>
      <button class="submit" id="buy">Вложить в пул</button>
      <div class="msg" id="msg"></div>`);
    const refresh = () => {
      document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.side === chosen));
      const amt = Number($("#amt").value) || 0;
      const shares = (amt / price()) * 100;
      $("#shares").textContent = `Долей: ${shares.toFixed(1).replace(".", ",")}`;
      $("#payout").textContent = `Выплата при «${chosen === "yes" ? "Да" : "Нет"}»: ${rub(shares)}`;
    };
    $(".seg").onclick = (ev) => { const b = ev.target.closest("button"); if (b) { chosen = b.dataset.side; refresh(); } };
    $("#amt").oninput = refresh;
    $("#buy").onclick = () => {
      const amt = Math.floor(Number($("#amt").value));
      const msg = $("#msg");
      msg.className = "msg err";
      if (!(amt > 0)) return (msg.textContent = "Введите сумму.");
      if (amt > balance) return (msg.textContent = "Недостаточно средств. Пополните пул.");
      setBalance(balance - amt);
      bets.push({ eid: e.id, side: chosen, amt, price: price(), ts: Date.now() });
      store.set("bets", bets);
      msg.className = "msg";
      msg.textContent = `Ставка принята: ${rub(amt)} на «${chosen === "yes" ? "Да" : "Нет"}».`;
      if (state.route === "account") render();
    };
    refresh();
  }

  function openDeposit() {
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
      if (state.route === "account") render();
    };
  }

  // ---------- общие обработчики ----------
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t.closest("[data-deposit]") || t.closest("#wallet")) return openDeposit();
    const pick = t.closest("[data-pick]");
    if (pick) state.cat = pick.dataset.pick;
    const tab = t.closest(".tab");
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
  $("#close").onclick = closeModal;
  $("#modal").onclick = (ev) => { if (ev.target.id === "modal") closeModal(); };
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeModal(); });

  setBalance(balance);
  render();
})();

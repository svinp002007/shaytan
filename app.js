(() => {
  const $ = (s) => document.querySelector(s);
  const state = { cat: "all", q: "", sort: "volume", balance: 10000 };

  try {
    const saved = Number(localStorage.getItem("rp_balance"));
    if (saved > 0) state.balance = saved;
  } catch {}

  const rub = (n) => "₽ " + Math.round(n).toLocaleString("en-US");
  const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : Math.round(n / 1e3) + "K");
  const catName = (id) => CATEGORIES.find((c) => c.id === id).name;
  const fmtDate = (d) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function setBalance(v) {
    state.balance = v;
    $("#balance").textContent = rub(v);
    try { localStorage.setItem("rp_balance", v); } catch {}
  }

  function renderTabs() {
    const tabs = [{ id: "all", name: "All" }, ...CATEGORIES];
    $("#tabs").innerHTML = tabs
      .map((t) => `<button class="tab ${t.id === state.cat ? "active" : ""}" data-cat="${t.id}">${t.name}</button>`)
      .join("");
  }

  function visible() {
    const q = state.q.trim().toLowerCase();
    let list = EVENTS.filter(
      (e) => (state.cat === "all" || e.cat === state.cat) && (!q || e.q.toLowerCase().includes(q))
    );
    const sorts = {
      volume: (a, b) => b.vol - a.vol,
      closing: (a, b) => a.closes.localeCompare(b.closes),
      chance: (a, b) => b.yes - a.yes
    };
    return list.sort(sorts[state.sort]);
  }

  function renderGrid() {
    const list = visible();
    $("#count").textContent = `${list.length} event${list.length === 1 ? "" : "s"}`;
    $("#empty").hidden = list.length > 0;
    $("#grid").innerHTML = list
      .map(
        (e) => `
      <article class="card" data-id="${e.id}">
        <div class="cat">${catName(e.cat)}</div>
        <h3>${esc(e.q)}</h3>
        <div class="meter">
          <div class="pct">${e.yes}%</div>
          <div class="bar-track"><div class="bar-fill" style="width:${e.yes}%"></div></div>
        </div>
        <div class="btns">
          <button class="btn yes" data-id="${e.id}" data-side="yes">Yes ${e.yes}¢</button>
          <button class="btn no" data-id="${e.id}" data-side="no">No ${100 - e.yes}¢</button>
        </div>
        <div class="meta"><span>Vol ${short(e.vol)} ₽</span><span>Closes ${fmtDate(e.closes)}</span></div>
      </article>`
      )
      .join("");
  }

  function openModal(id, side) {
    const e = EVENTS.find((x) => x.id === id);
    let chosen = side || "yes";
    const price = () => (chosen === "yes" ? e.yes : 100 - e.yes);

    $("#sheet-body").innerHTML = `
      <div class="cat">${catName(e.cat)}</div>
      <h2>${esc(e.q)}</h2>
      <p>Closes ${fmtDate(e.closes)} · Volume ${short(e.vol)} ₽</p>
      <div class="seg">
        <button class="yes" data-side="yes">Yes ${e.yes}¢</button>
        <button class="no" data-side="no">No ${100 - e.yes}¢</button>
      </div>
      <input class="amount" id="amt" type="number" min="1" step="100" value="500" aria-label="Amount in rubles">
      <div class="calc"><span id="shares"></span><span id="payout"></span></div>
      <button class="submit" id="buy">Place demo bet</button>
      <div class="msg" id="msg"></div>`;

    const refresh = () => {
      document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.side === chosen));
      const amt = Number($("#amt").value) || 0;
      const shares = (amt / price()) * 100;
      $("#shares").textContent = `Shares: ${shares.toFixed(1)}`;
      $("#payout").textContent = `Payout if ${chosen === "yes" ? "Yes" : "No"}: ${rub(shares)}`;
    };
    $(".seg").onclick = (ev) => {
      const b = ev.target.closest("button");
      if (b) { chosen = b.dataset.side; refresh(); }
    };
    $("#amt").oninput = refresh;
    $("#buy").onclick = () => {
      const amt = Number($("#amt").value);
      if (!(amt > 0)) return ($("#msg").textContent = "Enter an amount.");
      if (amt > state.balance) return ($("#msg").textContent = "Not enough demo balance.");
      setBalance(state.balance - amt);
      $("#msg").textContent = `Bet placed: ${rub(amt)} on ${chosen.toUpperCase()}.`;
    };
    refresh();
    $("#modal").hidden = false;
  }

  const closeModal = () => ($("#modal").hidden = true);

  $("#tabs").onclick = (ev) => {
    const b = ev.target.closest(".tab");
    if (!b) return;
    state.cat = b.dataset.cat;
    renderTabs();
    renderGrid();
  };
  $("#search").oninput = (ev) => { state.q = ev.target.value; renderGrid(); };
  $("#sort").onchange = (ev) => { state.sort = ev.target.value; renderGrid(); };
  $("#grid").onclick = (ev) => {
    const btn = ev.target.closest(".btn");
    const card = ev.target.closest(".card");
    if (btn) openModal(Number(btn.dataset.id), btn.dataset.side);
    else if (card) openModal(Number(card.dataset.id));
  };
  $("#close").onclick = closeModal;
  $("#modal").onclick = (ev) => { if (ev.target.id === "modal") closeModal(); };
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeModal(); });

  setBalance(state.balance);
  renderTabs();
  renderGrid();
})();

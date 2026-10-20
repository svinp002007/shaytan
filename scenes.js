// Новые иллюстрации рынков: объёмные «сцены» вместо линейных значков (всё рисуется в SVG, без внешних файлов и чужих фото).
// Каждая сцена: фон с мягким светом и боке в цветах категории + крупный предмет по теме события.
(() => {
  let uid = 0;
  const f = (n) => Number(n.toFixed(1));
  // Градиенты сцены собираются в defs с уникальными id, чтобы одинаковые баннеры на странице не конфликтовали.
  function kit() {
    const p = "sc" + ++uid + "_", defs = [];
    const lin = (n, a, b, x2 = 0, y2 = 1) => { defs.push(`<linearGradient id="${p}${n}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`); return `url(#${p}${n})`; };
    const rad = (n, a, b) => { defs.push(`<radialGradient id="${p}${n}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`); return `url(#${p}${n})`; };
    return { p, defs, lin, rad };
  }
  const G = () => (typeof GLYPHS !== "undefined" ? GLYPHS : {});
  const glyph = (key, k, stroke = "#fff", w = 4, op = 0.95) => `<g transform="translate(${f(-32 * k)} ${f(-32 * k)}) scale(${k})" stroke="${stroke}" fill="none" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}">${G()[key] || G().globe}</g>`;
  const shadow = (y = 42, rx = 34) => `<ellipse cx="0" cy="${y}" rx="${rx}" ry="5" fill="#000" opacity=".28"/>`;

  // монета с символом: основной предмет для денег и крипты
  const coin = (K, c1, c2, gl, rim = "#ffffff55") => {
    const a = K.rad("c", c1, c2);
    return `${shadow(44, 40)}
      <g opacity=".55" transform="translate(-34 20) rotate(-14)"><circle r="17" fill="${a}"/><circle r="13" fill="none" stroke="${rim}" stroke-width="2"/></g>
      <g opacity=".7" transform="translate(37 24) rotate(12)"><circle r="14" fill="${a}"/><circle r="10" fill="none" stroke="${rim}" stroke-width="2"/></g>
      <circle r="31" fill="${a}"/><circle r="31" fill="none" stroke="#00000033" stroke-width="3"/><circle r="25" fill="none" stroke="${rim}" stroke-width="2.5"/>
      <ellipse cx="-10" cy="-16" rx="17" ry="8" fill="#fff" opacity=".22" transform="rotate(-24 -10 -16)"/>${glyph(gl, 0.6, "#fff", 4.5)}`;
  };
  const bars = (K) => {
    const top = K.lin("t", "#fff3b0", "#f6c945"), front = K.lin("f", "#f2c230", "#b9831a"), side = K.lin("s", "#d9a024", "#8f5f10");
    const bar = (x, y, w) => `<polygon points="${x + 6},${y} ${x + w},${y} ${x + w - 6},${y + 9} ${x},${y + 9}" fill="${top}"/><polygon points="${x},${y + 9} ${x + w - 6},${y + 9} ${x + w - 6},${y + 22} ${x - 4},${y + 22}" fill="${front}"/><polygon points="${x + w - 6},${y + 9} ${x + w},${y} ${x + w - 1},${y + 14} ${x + w - 6},${y + 22}" fill="${side}"/><text x="${x + (w - 6) / 2 - 3}" y="${y + 19}" font-size="7" font-weight="700" fill="#7a4d0a" opacity=".6" text-anchor="middle" font-family="sans-serif">999.9</text>`;
    return `${shadow(46, 44)}${bar(-44, 22, 46)}${bar(4, 22, 46)}${bar(-20, 0, 46)}`;
  };
  const barrel = (K) => {
    const body = K.lin("b", "#3b4252", "#12151c", 1, 0), band = K.lin("bd", "#f59e0b", "#b45309");
    return `${shadow(46, 30)}
      <path d="M-44 44V8l9-26 4 0 2 70z" fill="#0000" /><g opacity=".5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"><path d="M-46 44 -30 -18 -14 44M-38 20h16M-34 4h8M-30 -18l30-8 18 14-8 10"/><circle cx="2" cy="-8" r="3"/></g>
      <path d="M2 -30h46a8 8 0 0 1 4 7v62a8 8 0 0 1-4 7H2a8 8 0 0 1-4-7v-62a8 8 0 0 1 4-7z" fill="${body}" transform="translate(-2 4)"/>
      <rect x="0" y="-12" width="52" height="7" fill="${band}" transform="translate(-2 4)"/><rect x="0" y="22" width="52" height="7" fill="${band}" transform="translate(-2 4)"/>
      <ellipse cx="24" cy="-26" rx="25" ry="5" fill="#5b6478" transform="translate(-2 4)"/>
      <path d="M24 -5c-6 8-9 12-9 17a9 9 0 0 0 18 0c0-5-3-9-9-17z" fill="#ffb020" transform="translate(-2 4)"/>`;
  };
  const candles = (K, up, label) => {
    const n = 7, xs = Array.from({ length: n }, (_, i) => -42 + i * 14), vals = up ? [10, 18, 12, 24, 20, 32, 40] : [40, 32, 36, 22, 26, 14, 8];
    const g = K.lin("g", "#6dffb5", "#10b46b"), r = K.lin("r", "#ff9bb0", "#e0314f");
    const body = xs.map((x, i) => { const v = vals[i], bull = i === 0 ? up : up ? vals[i] >= vals[i - 1] : vals[i] >= vals[i - 1], h = 10 + (i % 3) * 5, y = 40 - v - h / 2; return `<line x1="${x}" x2="${x}" y1="${y - 6}" y2="${y + h + 6}" stroke="${bull ? "#34d399" : "#fb7185"}" stroke-width="2"/><rect x="${x - 4.5}" y="${y}" width="9" height="${h}" rx="2" fill="${bull ? g : r}"/>`; }).join("");
    const line = xs.map((x, i) => `${i ? "L" : "M"}${x} ${40 - vals[i] - 8}`).join("");
    return `${shadow(46, 46)}<g opacity=".18" stroke="#fff"><path d="M-50 -30h100M-50 -8h100M-50 14h100M-50 36h100"/></g>${body}<path d="${line}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/><circle cx="${xs[n - 1]}" cy="${40 - vals[n - 1] - 8}" r="4" fill="#fff"/>${up ? '<path d="M30 -34h14v14" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>' : ""}`;
  };
  const pie = (K) => `${shadow(46, 36)}<circle r="34" fill="${K.rad("p1", "#7dd3fc", "#2563eb")}"/><path d="M0 0V-34A34 34 0 0 1 32.3 10.5z" fill="${K.rad("p2", "#fde68a", "#f59e0b")}"/><path d="M0 0 32.3 10.5A34 34 0 0 1 -20 27.5z" fill="${K.rad("p3", "#f9a8d4", "#db2777")}"/><circle r="12" fill="#0b1220" opacity=".55"/>`;
  const percent = (K) => `${shadow(44, 38)}<circle r="32" fill="${K.rad("pc", "#a78bfa", "#4c1d95")}"/><circle r="32" fill="none" stroke="#ffffff44" stroke-width="3"/><g stroke="#fff" fill="none" stroke-width="5" stroke-linecap="round"><circle cx="-12" cy="-12" r="7"/><circle cx="12" cy="12" r="7"/><path d="M16 -18 -16 18"/></g>`;
  const bank = (K) => {
    const st = K.lin("st", "#f1f5f9", "#94a3b8"), ro = K.lin("ro", "#e2e8f0", "#64748b");
    const cols = [-30, -15, 0, 15, 30].map((x) => `<rect x="${x - 4}" y="-12" width="8" height="40" rx="1" fill="${st}"/>`).join("");
    return `${shadow(46, 48)}<polygon points="-46,-14 0,-42 46,-14" fill="${ro}"/><polygon points="-36,-16 0,-36 36,-16" fill="#ffffff55"/>${cols}<rect x="-46" y="28" width="92" height="6" fill="${st}"/><rect x="-50" y="34" width="100" height="6" fill="${ro}"/><circle cy="-22" r="4" fill="#475569"/>`;
  };
  const city = (K) => {
    const bl = [[-46, 16, 12], [-33, 38, 14], [-18, 24, 12], [-5, 54, 15], [11, 32, 13], [25, 46, 14], [40, 22, 10]];
    const tw = K.lin("tw", "#475569", "#1e293b"), tw2 = K.lin("tw2", "#64748b", "#334155");
    return `${shadow(46, 52)}${bl.map(([x, h, w], i) => `<rect x="${x}" y="${44 - h}" width="${w}" height="${h}" fill="${i % 2 ? tw : tw2}"/>${Array.from({ length: Math.floor(h / 9) }, (_, j) => `<rect x="${x + 3}" y="${44 - h + 4 + j * 9}" width="3" height="3" fill="#fde68a" opacity="${(i + j) % 3 ? ".85" : ".25"}"/><rect x="${x + w - 7}" y="${44 - h + 4 + j * 9}" width="3" height="3" fill="#fde68a" opacity="${(i * j) % 2 ? ".85" : ".3"}"/>`).join("")}`).join("")}<line x1="-50" x2="50" y1="44" y2="44" stroke="#fff" opacity=".35"/>`;
  };
  const doc = (K) => `${shadow(46, 34)}<g transform="rotate(-8 -6 4)"><rect x="-28" y="-40" width="42" height="56" rx="3" fill="#cbd5e1"/></g><g transform="rotate(6 6 4)"><rect x="-18" y="-40" width="44" height="60" rx="3" fill="${K.lin("d", "#fff", "#e2e8f0")}"/><g stroke="#94a3b8" stroke-width="3" stroke-linecap="round"><path d="M-10 -28h28M-10 -18h28M-10 -8h28M-10 2h16"/></g><circle cx="16" cy="12" r="9" fill="#ef4444"/><path d="M12 12l3 3 6-7" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`;
  const briefcase = (K) => `${shadow(46, 38)}<path d="M-12 -14v-8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v8" fill="none" stroke="#8b5e34" stroke-width="5"/><rect x="-38" y="-14" width="76" height="52" rx="7" fill="${K.lin("br", "#b7793f", "#6b3f17")}"/><rect x="-38" y="6" width="76" height="4" fill="#00000040"/><rect x="-6" y="2" width="12" height="12" rx="2" fill="#fbbf24"/>`;
  const basket = (K) => `${shadow(46, 38)}<path d="M-38 -6h76l-8 44H-30z" fill="${K.lin("ba", "#f59e0b", "#b45309")}"/><path d="M-22 -6 -12 -30M22 -6 12 -30" stroke="#92400e" stroke-width="5" stroke-linecap="round"/><g stroke="#7c2d12" stroke-width="3" opacity=".5"><path d="M-18 4v28M0 4v28M18 4v28"/></g><circle cx="-8" cy="-12" r="9" fill="#ef4444"/><circle cx="12" cy="-14" r="8" fill="#84cc16"/>`;
  const chip = (K) => {
    const pins = Array.from({ length: 5 }, (_, i) => { const t = -24 + i * 12; return `<rect x="${t - 2}" y="-44" width="4" height="12" fill="#cbd5e1"/><rect x="${t - 2}" y="32" width="4" height="12" fill="#cbd5e1"/><rect x="-44" y="${t - 2}" width="12" height="4" fill="#cbd5e1"/><rect x="32" y="${t - 2}" width="12" height="4" fill="#cbd5e1"/>`; }).join("");
    return `${shadow(46, 36)}${pins}<rect x="-32" y="-32" width="64" height="64" rx="8" fill="${K.lin("ch", "#334155", "#0f172a")}"/><rect x="-22" y="-22" width="44" height="44" rx="4" fill="${K.rad("cc", "#22d3ee", "#0e7490")}"/><g stroke="#fff" stroke-width="2" fill="none" opacity=".75"><path d="M-12 -12h10v10h12M-12 8h8M12 -12v8M4 12h8"/></g><circle r="22" fill="#22d3ee" opacity=".22"/>`;
  };
  const wheat = (K) => {
    const stalk = (x, h, rot) => `<g transform="translate(${x} 44) rotate(${rot})"><path d="M0 0V${-h}" stroke="#a16207" stroke-width="2.5"/>${Array.from({ length: 6 }, (_, i) => `<ellipse cx="${i % 2 ? 4 : -4}" cy="${-h + i * 7}" rx="3" ry="6" fill="${K.lin("w" + x + i, "#fde68a", "#d97706")}" transform="rotate(${i % 2 ? 28 : -28} ${i % 2 ? 4 : -4} ${-h + i * 7})"/>`).join("")}<ellipse cy="${-h - 6}" rx="3" ry="7" fill="#f59e0b"/></g>`;
    return `<circle cx="22" cy="-10" r="22" fill="#fff7c2" opacity=".4"/><circle cx="22" cy="-10" r="13" fill="#fde047" opacity=".8"/>${shadow(46, 44)}${[[-36, 46, -8], [-22, 56, -3], [-6, 50, 2], [10, 58, 6], [26, 48, 10], [40, 42, 14]].map(([x, h, r]) => stalk(x, h, r)).join("")}`;
  };
  const football = (K) => `${shadow(46, 44)}<ellipse cy="40" rx="50" ry="9" fill="${K.lin("fg", "#34d399", "#047857")}"/><g stroke="#fff" fill="none" opacity=".5" stroke-width="2"><ellipse cy="40" rx="46" ry="7"/><path d="M0 33v14"/></g><circle cy="-2" r="31" fill="${K.rad("fb", "#ffffff", "#cbd5e1")}"/><g fill="#1e293b"><polygon points="0,-17 10,-9 6,3 -6,3 -10,-9"/><polygon points="-24,-8 -15,-12 -12,-2 -19,6 -27,2" opacity=".85"/><polygon points="24,-8 15,-12 12,-2 19,6 27,2" opacity=".85"/><polygon points="-8,16 8,16 12,26 0,31 -12,26" opacity=".85"/></g><g stroke="#94a3b8" stroke-width="1.5"><path d="M0 -17V-31M10 -9l13-4M-10 -9l-13-4M6 3l6 14M-6 3l-6 14"/></g>`;
  const hockey = (K) => `${shadow(46, 44)}<ellipse cy="40" rx="50" ry="9" fill="${K.lin("ic", "#bae6fd", "#38bdf8")}"/><path d="M-30 -40l8 0 22 66h28v9H-6z" fill="${K.lin("hk", "#fbbf24", "#92400e")}"/><path d="M-6 35h34" stroke="#1f2937" stroke-width="5"/><ellipse cx="26" cy="38" rx="13" ry="5" fill="#0f172a"/><ellipse cx="26" cy="35" rx="13" ry="5" fill="#334155"/>`;
  const tennis = (K) => `${shadow(46, 44)}<ellipse cy="40" rx="50" ry="9" fill="${K.lin("tc", "#c2410c", "#7c2d12")}"/><g stroke="#fff" opacity=".6" stroke-width="2" fill="none"><path d="M-44 40h88M0 32v16"/></g><circle cy="-2" r="31" fill="${K.rad("tb", "#fef08a", "#84cc16")}"/><path d="M-24 -22C-8 -10 -8 14 -24 26M24 -22C8 -10 8 14 24 26" stroke="#fff" stroke-width="3.5" fill="none" opacity=".9"/>`;
  const trophy = (K) => {
    const au = K.lin("tr", "#fde68a", "#d97706", 1, 1);
    return `${shadow(46, 30)}<path d="M-24 -34h48v22a24 24 0 0 1-48 0z" fill="${au}"/><path d="M-24 -28h-14c0 14 6 22 16 24M24 -28h14c0 14-6 22-16 24" stroke="#f59e0b" stroke-width="5" fill="none"/><rect x="-5" y="12" width="10" height="16" fill="#d97706"/><rect x="-18" y="28" width="36" height="9" rx="2" fill="${K.lin("tb", "#b45309", "#78350f")}"/><ellipse cx="-10" cy="-20" rx="6" ry="14" fill="#fff" opacity=".3"/><path d="M0 -22l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#fff7ed" opacity=".9"/>`;
  };
  const medal = (K) => `${shadow(46, 30)}<path d="M-20 -46 -4 -10h8l16-36h-12L0 -22 -8 -46z" fill="${K.lin("rb", "#60a5fa", "#1d4ed8")}"/><circle cy="14" r="26" fill="${K.rad("md", "#fde68a", "#b45309")}"/><circle cy="14" r="19" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.5"/><text y="22" text-anchor="middle" font-size="22" font-weight="800" fill="#fff7ed" font-family="sans-serif">1</text>`;
  const mic = (K) => `${shadow(46, 24)}<rect x="-14" y="-40" width="28" height="46" rx="14" fill="${K.lin("mc", "#e2e8f0", "#64748b", 1, 0)}"/><g stroke="#475569" stroke-width="2"><path d="M-14 -26h28M-14 -16h28M-14 -6h28"/></g><path d="M-26 -4a26 26 0 0 0 52 0M0 22v18M-14 40h28" stroke="#cbd5e1" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const person = (K) => `${shadow(46, 38)}<rect x="-34" y="14" width="68" height="30" rx="3" fill="${K.lin("pd", "#6366f1", "#312e81")}"/><circle cy="-22" r="13" fill="#f1c9a5"/><path d="M-24 14c0-16 10-24 24-24s24 8 24 24z" fill="${K.lin("pj", "#1e293b", "#0f172a")}"/><path d="M-4 -8 0 6 4 -8" fill="#fff"/><path d="M-6 -30c2-8 12-8 14-2z" fill="#4b3621"/><rect x="18" y="-6" width="3" height="22" fill="#94a3b8"/><circle cx="19.5" cy="-9" r="5" fill="#475569"/>`;
  const peace = (K) => `${shadow(46, 36)}<circle r="32" fill="${K.rad("pe", "#a7f3d0", "#047857")}"/><g stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".95"><circle r="22"/><path d="M0 -22V22M0 0 -16 16M0 0l16 16"/></g>`;
  const talk = (K) => `${shadow(46, 38)}<path d="M-42 -32h46a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H-20l-14 12V-4a8 8 0 0 1-8-8z" fill="${K.lin("t1", "#60a5fa", "#1d4ed8")}"/><path d="M-6 6h42a8 8 0 0 1 8 8v18a8 8 0 0 1-8 8H24l12 12-24-12H-6a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" fill="${K.lin("t2", "#f472b6", "#be185d")}" opacity=".95"/><g fill="#fff"><circle cx="-26" cy="-12" r="3"/><circle cx="-14" cy="-12" r="3"/><circle cx="-2" cy="-12" r="3"/><circle cx="6" cy="22" r="3"/><circle cx="18" cy="22" r="3"/><circle cx="30" cy="22" r="3"/></g>`;
  const shield = (K) => `${shadow(46, 30)}<path d="M0 -42 34 -30v24c0 22-14 36-34 46C-20 30-34 16-34 -6v-24z" fill="${K.lin("sh", "#60a5fa", "#1e3a8a")}"/><path d="M0 -34 26 -25v19c0 16-10 28-26 36z" fill="#ffffff22"/><path d="M-14 -2l10 10 18-20" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ballot = (K) => `${shadow(46, 38)}<rect x="-14" y="-40" width="28" height="36" rx="2" fill="#f8fafc" transform="rotate(-6 0 -22)"/><path d="M-6 -30l4 4 8-9" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="-36" y="-4" width="72" height="44" rx="5" fill="${K.lin("bx", "#6366f1", "#312e81")}"/><rect x="-18" y="-4" width="36" height="6" rx="3" fill="#0f172a"/>`;
  const snow = (K) => {
    const arms = [0, 60, 120].map((a) => `<g transform="rotate(${a})"><path d="M0 -34V34M-7 -26 0 -19 7 -26M-7 26 0 19 7 26M-6 -12 0 -6 6 -12M-6 12 0 6 6 12" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/></g>`).join("");
    return `<path d="M-50 44c14-20 28-18 38-8 12-14 28-18 62 4v10H-50z" fill="#e0f2fe" opacity=".9"/><circle r="30" fill="#bae6fd" opacity=".25"/>${arms}<g fill="#fff" opacity=".8"><circle cx="-38" cy="-22" r="2.5"/><circle cx="40" cy="-14" r="2"/><circle cx="34" cy="18" r="2.5"/><circle cx="-34" cy="14" r="2"/></g>`;
  };
  const thermo = (K) => `${shadow(46, 24)}<rect x="-10" y="-42" width="20" height="62" rx="10" fill="#f1f5f9"/><circle cy="26" r="16" fill="#f1f5f9"/><rect x="-4" y="-24" width="8" height="48" rx="4" fill="${K.lin("th", "#fb7185", "#dc2626")}"/><circle cy="26" r="11" fill="${K.rad("tr", "#fda4af", "#dc2626")}"/><g stroke="#94a3b8" stroke-width="2"><path d="M14 -30h8M14 -18h6M14 -6h8M14 6h6"/></g>`;
  const cloud = (K) => `<path d="M-30 14a15 15 0 0 1 3-30 21 21 0 0 1 40-4 14 14 0 0 1 2 34z" fill="${K.lin("cl", "#f8fafc", "#94a3b8")}"/><g stroke="#38bdf8" stroke-width="4" stroke-linecap="round"><path d="M-20 24l-4 12M-4 24l-4 12M12 24l-4 12M28 24l-4 12"/></g>`;
  const sun = (K) => `<circle r="34" fill="#fde047" opacity=".22"/><circle r="22" fill="${K.rad("su", "#fef08a", "#f59e0b")}"/><g stroke="#fde047" stroke-width="4" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45})" d="M0 -30V-40"/>`).join("")}</g><path d="M-50 40c14-8 28-8 40 0s28 8 60-2v12H-50z" fill="#0ea5e9" opacity=".5"/>`;
  const rocket = (K) => `<g fill="#fff" opacity=".8"><circle cx="-38" cy="-30" r="1.6"/><circle cx="34" cy="-36" r="2"/><circle cx="42" cy="6" r="1.5"/><circle cx="-44" cy="14" r="1.8"/></g><g transform="rotate(35)"><path d="M-8 22C-12 36 0 50 0 50s12-14 8-28z" fill="${K.lin("fl", "#fde047", "#ef4444")}"/><path d="M0 -42c14 12 16 30 12 54h-24C-16 -12 -14 -30 0 -42z" fill="${K.lin("ro", "#f8fafc", "#94a3b8", 1, 0)}"/><circle cy="-14" r="7" fill="#38bdf8" stroke="#475569" stroke-width="2"/><path d="M-12 12 -24 28l12-2zM12 12l12 16-12-2z" fill="#ef4444"/></g>`;
  const phone = (K) => `${shadow(46, 26)}<rect x="-18" y="-42" width="36" height="76" rx="8" fill="${K.lin("ph", "#475569", "#0f172a")}"/><rect x="-14" y="-36" width="28" height="60" rx="4" fill="${K.lin("sc", "#38bdf8", "#6366f1")}"/><circle cy="28" r="2.5" fill="#94a3b8"/><g stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"><path d="M24 -14a14 14 0 0 1 0 20M32 -22a26 26 0 0 1 0 36"/></g>`;
  const plane = (K) => `<g transform="rotate(-18)"><path d="M-44 8 44 -20 10 30 2 10z" fill="${K.lin("pl", "#f8fafc", "#cbd5e1")}"/><path d="M2 10 44 -20-6 14z" fill="#94a3b8"/><path d="M2 10 10 30 14 14z" fill="#64748b"/></g><g stroke="#fff" stroke-width="2" opacity=".4" stroke-dasharray="3 5" fill="none"><path d="M-48 30C-30 34-14 26 0 20"/></g>`;
  const film = (K) => `${shadow(46, 36)}<rect x="-38" y="-8" width="76" height="46" rx="4" fill="${K.lin("fm", "#334155", "#0f172a")}"/><path d="M-38 -8-30 -30 38 -20 38 -8z" fill="${K.lin("cp", "#e2e8f0", "#64748b")}"/><g fill="#0f172a">${[-30, -14, 2, 18].map((x) => `<polygon points="${x},-28 ${x + 8},-27 ${x + 3},-10 ${x - 5},-10"/>`).join("")}</g><path d="M-8 6l18 10-18 10z" fill="#f8fafc"/>`;
  const gamepad = (K) => `${shadow(46, 40)}<path d="M-26 -18h52c14 0 20 18 24 38 2 12-8 18-16 10l-12-12H-22L-34 30c-8 8-18 2-16-10 4-20 10-38 24-38z" fill="${K.lin("gp", "#6366f1", "#1e1b4b")}"/><g stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"><path d="M-28 0v12M-34 6h12"/></g><circle cx="26" cy="2" r="4" fill="#f43f5e"/><circle cx="34" cy="10" r="4" fill="#22d3ee"/><circle cx="18" cy="10" r="4" fill="#facc15"/><circle cx="26" cy="18" r="4" fill="#4ade80"/>`;
  const crosshair = (K) => `<circle r="34" fill="${K.rad("cr", "#7f1d1d", "#1a0505")}"/><g stroke="#f43f5e" stroke-width="3" fill="none"><circle r="34"/><circle r="22"/><circle r="9" fill="#f43f5e"/><path d="M0 -44V-12M0 12V44M-44 0H-12M12 0H44" stroke="#fff" stroke-width="2.5"/></g>`;
  const bolt = (K) => `<circle r="34" fill="#fde047" opacity=".16"/><path d="M12 -44-22 4h18L-8 44 26 -8H8z" fill="${K.lin("bo", "#fef08a", "#f59e0b")}" stroke="#fff7c2" stroke-width="2" stroke-linejoin="round"/>`;
  const globe = (K) => `${shadow(46, 34)}<circle r="34" fill="${K.rad("gl", "#7dd3fc", "#1e40af")}"/><g stroke="#fff" fill="none" opacity=".6" stroke-width="2"><ellipse rx="14" ry="34"/><path d="M-34 0h68M-30 -16h60M-30 16h60"/></g><path d="M-18 -14c8-6 14-2 12 4s-10 8-14 4zM8 6c8-4 16 0 14 8s-12 8-16 2z" fill="#34d399" opacity=".85"/>`;
  const ruble = (K) => coin(K, "#fb7185", "#7f1d1d", "ruble");
  const SCENE = {
    btc: (K) => coin(K, "#fbbf24", "#c2410c", "btc"), eth: (K) => coin(K, "#a5b4fc", "#3730a3", "eth"), sol: (K) => coin(K, "#c084fc", "#0f766e", "sol"), tether: (K) => coin(K, "#4ade80", "#047857", "tether"),
    euro: (K) => coin(K, "#60a5fa", "#1e3a8a", "euro"), yuan: (K) => coin(K, "#f87171", "#7f1d1d", "yuan"), ruble,
    gold: bars, oil: barrel, stocks: (K) => candles(K, true), growth: (K) => candles(K, true), down: (K) => candles(K, false), pie, percent, bank, building: bank, city, doc, briefcase, basket, chip, wheat,
    football, hockey, tennis, trophy, rings: medal, medal, mic, person, peace, talk, shield, ballot, snow, thermo, cloud, sun, rocket, phone, plane, film, gamepad, crosshair, bolt, globe
  };
  const TINT = { world: "#38bdf8", russia: "#f43f5e", crypto: "#f59e0b", sport: "#34d399", politics: "#a855f7", tech: "#22d3ee", esports: "#fb7185", weather: "#7dd3fc", internet: "#818cf8" };

  // Фон: градиент категории, мягкие световые пятна и боке, виньетка. Предмет рисуется справа, на узких баннерах по центру.
  function scene(e, extra = "", W = 320, H = 110) {
    const K = kit(), st = (typeof CAT_STYLE !== "undefined" && CAT_STYLE[e.cat]) || ["#0f3d6b", "#1d8aa8"];
    const ang = 100 + ((e.id * 37) % 80), tint = TINT[e.cat] || "#7dd3fc";
    const draw = SCENE[e.img] || SCENE.globe, body = draw(K);
    const small = W < 400, cx = small ? W / 2 : W * 0.66, k = Math.min(1.6, (H * 1.0) / 100);
    const bokeh = Array.from({ length: 9 }, (_, i) => {
      const r = 6 + ((e.id * 13 + i * 29) % 22), x = ((e.id * 71 + i * 113) % 1000) / 1000 * W, y = ((e.id * 37 + i * 59) % 1000) / 1000 * H;
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${i % 3 ? "#fff" : tint}" opacity="${(0.05 + (i % 4) * 0.025).toFixed(3)}"/>`;
    }).join("");
    const light = K.rad("lg", tint + "aa", tint + "00");
    return `<div class="banner scene ${extra}" style="background:linear-gradient(${ang}deg,${st[0]},${st[1]})"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>${K.defs.join("")}<radialGradient id="${K.p}vg" cx=".5" cy=".5" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>
      <ellipse cx="${f(cx)}" cy="${f(H * 0.5)}" rx="${f(Math.min(W * 0.5, H * 2.2))}" ry="${f(H * 0.85)}" fill="${light}" opacity=".6"/>${bokeh}
      <g transform="translate(${f(cx)} ${f(H * 0.5)}) scale(${f(k)})">${body}</g>
      <rect width="${W}" height="${H}" fill="url(#${K.p}vg)"/>
    </svg></div>`;
  }
  window.bannerLine = typeof banner === "function" ? banner : null; // прежние линейные значки сохранены
  window.banner = scene;
  window.SCENE_KEYS = Object.keys(SCENE);
})();

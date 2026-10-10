// Иллюстрации для рынков: градиентный баннер + значок по теме события (всё рисуется в SVG, без внешних файлов).
const GLYPHS = {
  oil: '<ellipse cx="32" cy="16" rx="16" ry="6"/><path d="M16 16v32c0 3.3 7 6 16 6s16-2.7 16-6V16"/><path d="M16 28c0 3.3 7 6 16 6s16-2.7 16-6M16 40c0 3.3 7 6 16 6s16-2.7 16-6"/>',
  bank: '<path d="M8 26 32 10l24 16z"/><path d="M14 30v18M26 30v18M38 30v18M50 30v18M8 54h48"/>',
  gold: '<path d="M6 46h26l-4-12H10zM32 46h26l-4-12H36zM19 34h26l-4-12H23z"/>',
  stocks: '<path d="M8 52V12M8 52h48"/><path d="M14 42l12-12 8 8 16-18"/><path d="M42 20h8v8"/>',
  euro: '<circle cx="32" cy="32" r="24"/><path d="M43 22a13 13 0 1 0 0 20M17 28h19M17 36h19"/>',
  yuan: '<circle cx="32" cy="32" r="24"/><path d="M23 18l9 14 9-14M32 32v16M24 37h16M24 43h16"/>',
  down: '<path d="M8 12v40h48"/><path d="M14 20l12 12 8-8 16 18"/><path d="M40 42h10V32"/>',
  wheat: '<path d="M32 58V22"/><path d="M32 22c-8-2-10-8-10-14 6 0 10 5 10 14zM32 22c8-2 10-8 10-14-6 0-10 5-10 14zM32 36c-8-2-10-8-10-14 6 0 10 5 10 14zM32 36c8-2 10-8 10-14-6 0-10 5-10 14zM32 50c-8-2-10-8-10-14 6 0 10 5 10 14zM32 50c8-2 10-8 10-14-6 0-10 5-10 14z"/>',
  chip: '<rect x="18" y="18" width="28" height="28" rx="4"/><rect x="26" y="26" width="12" height="12"/><path d="M24 10v8M32 10v8M40 10v8M24 46v8M32 46v8M40 46v8M10 24h8M10 32h8M10 40h8M46 24h8M46 32h8M46 40h8"/>',
  percent: '<circle cx="20" cy="20" r="7"/><circle cx="44" cy="44" r="7"/><path d="M50 12 14 52"/>',
  ruble: '<circle cx="32" cy="32" r="24"/><path d="M25 46V19h11a7.5 7.5 0 0 1 0 15H21M21 41h15"/>',
  basket: '<path d="M8 24h48l-5 28H13z"/><path d="M20 24l8-14M44 24l-8-14M22 33v11M32 33v11M42 33v11"/>',
  growth: '<path d="M12 54V40M26 54V30M40 54V20M54 54V8" stroke-width="7"/>',
  briefcase: '<rect x="8" y="22" width="48" height="32" rx="4"/><path d="M24 22v-7h16v7M8 36h48"/>',
  doc: '<path d="M16 6h24l10 10v42H16z"/><path d="M40 6v10h10M24 30h18M24 38h18M24 46h10"/>',
  building: '<rect x="14" y="8" width="36" height="46"/><path d="M22 18h6M36 18h6M22 28h6M36 28h6M22 38h6M36 38h6M28 54v-8h8v8"/>',
  city: '<path d="M6 54V30h15v24M21 54V12h20v42M41 54V26h17v28M4 54h56M28 22h6M28 30h6M28 38h6"/>',
  btc: '<circle cx="32" cy="32" r="24"/><path d="M26 20v24M26 20h10a6 6 0 0 1 0 12H26M26 32h12a6 6 0 0 1 0 12H26M30 15v5M36 15v5M30 44v5M36 44v5"/>',
  eth: '<path d="M32 4 14 32l18 11 18-11z"/><path d="M14 38l18 22 18-22M32 4v39"/>',
  pie: '<circle cx="32" cy="32" r="24"/><path d="M32 32V8M32 32l21 13"/>',
  tether: '<circle cx="32" cy="32" r="24"/><path d="M19 21h26M32 21v26M23 30c0 4 18 4 18 0"/>',
  globe: '<circle cx="32" cy="32" r="24"/><ellipse cx="32" cy="32" rx="10" ry="24"/><path d="M8 32h48M12 20h40M12 44h40"/>',
  sol: '<path d="M16 14h36l-6 10H10zM10 27h36l6 10H16zM16 40h36l-6 10H10z"/>',
  football: '<circle cx="32" cy="32" r="24"/><path d="M32 21l10 7-4 12H26l-4-12z"/><path d="M32 21V8M42 28l12-4M38 40l7 11M26 40l-7 11M22 28 10 24"/>',
  trophy: '<path d="M20 8h24v16a12 12 0 0 1-24 0zM20 13h-9c0 9 5 13 11 13M44 13h9c0 9-5 13-11 13M32 36v11M22 56h20M26 47h12"/>',
  hockey: '<path d="M16 6l16 40h20v8H28L10 8z"/><ellipse cx="14" cy="56" rx="9" ry="3"/>',
  tennis: '<circle cx="32" cy="32" r="24"/><path d="M14 14c14 8 14 28 0 36M50 14c-14 8-14 28 0 36"/>',
  rings: '<circle cx="16" cy="26" r="9"/><circle cx="32" cy="26" r="9"/><circle cx="48" cy="26" r="9"/><circle cx="24" cy="37" r="9"/><circle cx="40" cy="37" r="9"/>',
  mic: '<rect x="23" y="6" width="18" height="30" rx="9"/><path d="M14 30a18 18 0 0 0 36 0M32 48v10M23 58h18"/>',
  person: '<circle cx="32" cy="20" r="11"/><path d="M10 56c0-13 10-21 22-21s22 8 22 21z"/>',
  peace: '<circle cx="32" cy="32" r="24"/><path d="M32 8v48M32 32 15 49M32 32l17 17"/>',
  talk: '<path d="M6 10h30v20H18l-8 8V30H6z"/><path d="M44 26h14v22h-4v9l-9-9H26v-8"/>',
  shield: '<path d="M32 6l22 9v17c0 13-9 22-22 26C19 54 10 45 10 32V15z"/><path d="M22 32l8 8 13-14"/>',
  snow: '<path d="M32 6v52M10 19l44 26M10 45l44-26M24 10l8 6 8-6M24 54l8-6 8 6"/>',
  thermo: '<path d="M26 8h12v30a14 14 0 1 1-12 0z"/><path d="M32 22v26"/>',
  cloud: '<path d="M18 46a12 12 0 0 1 2-23 16 16 0 0 1 30 5 10 10 0 0 1-2 18z"/>',
  rocket: '<path d="M32 6c10 8 14 20 12 34H20C18 26 22 14 32 6z"/><circle cx="32" cy="26" r="5"/><path d="M20 40l-8 10 12-2M44 40l8 10-12-2M28 48l4 10 4-10"/>',
  sun: '<circle cx="32" cy="32" r="11"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13 13l6 6M45 45l6 6M13 51l6-6M45 19l6-6"/>',
  film: '<rect x="8" y="14" width="48" height="36" rx="3"/><path d="M8 24h48M8 40h48M18 14v36M46 14v36"/>',
  medal: '<circle cx="32" cy="38" r="15"/><path d="M22 6l10 18 10-18M32 31v14M27 38h10"/>',
  bolt: '<path d="M36 4 14 36h14l-4 24 26-34H36z"/>',
  phone: '<path d="M14 8h12l4 14-8 5c4 8 9 13 17 17l5-8 14 4v12c0 4-3 6-6 6C27 58 6 37 8 14c0-3 3-6 6-6z"/>',
  crosshair: '<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="7"/><path d="M32 6v10M32 48v10M6 32h10M48 32h10"/>',
  gamepad: '<path d="M18 20h28c8 0 12 9 14 20 1 7-3 11-9 8l-8-6H21l-8 6c-6 3-10-1-9-8 2-11 6-20 14-20z"/><path d="M20 30v10M15 35h10M42 32h.01M48 38h.01"/>',
  plane: '<path d="M58 8 6 29l15 6 6 19 9-10 13 10z"/><path d="M21 35 58 8 28 40"/>',
  ballot: '<rect x="8" y="28" width="48" height="28" rx="3"/><path d="M20 28V10h24v18M23 42l6 6 12-12"/>'
};

// какой значок у какого рынка (по порядку в EVENTS)
const BANNER_ICONS = [
  "oil", "bank", "gold", "stocks", "euro", "yuan", "down", "oil", "wheat", "chip",
  "percent", "ruble", "basket", "stocks", "bank", "growth", "oil", "briefcase", "doc", "building", "city",
  "btc", "btc", "eth", "stocks", "pie", "tether", "bank", "globe", "sol", "chip",
  "football", "football", "trophy", "hockey", "hockey", "tennis", "tennis", "hockey", "football", "rings", "football",
  "mic", "doc", "person", "peace", "talk", "shield", "person", "globe", "ballot", "city",
  // короткие рынки (в том же порядке, что и в events.js)
  "oil", "gold", "stocks", "ruble", "stocks", "basket",
  "btc", "eth", "btc", "sol",
  "football", "football", "hockey", "hockey",
  "phone", "doc", "shield",
  "chip", "chip", "chip", "chip", "cloud",
  "crosshair", "trophy", "gamepad",
  "snow", "thermo", "snow", "cloud", "snow",
  "plane", "shield", "phone", "mic",
  "gamepad", "growth", "talk"
];
EVENTS.forEach((e, i) => { e.img = BANNER_ICONS[i] || "globe"; });

const CAT_STYLE = {
  world:    ["#0f3d6b", "#1d8aa8"],
  russia:   ["#1e3a8a", "#c3281c"],
  crypto:   ["#2a1b6e", "#e8830c"],
  sport:    ["#0b5d3b", "#19a864"],
  politics: ["#1f2a44", "#7a2fa8"],
  tech:     ["#0b3b5c", "#2bb3c0"],
  esports:  ["#1b1f4b", "#e11d48"],
  weather:  ["#1c3b6b", "#6fa8dc"],
  internet: ["#3a1d6e", "#22d3ee"]
};

function bannerPattern(cat, W, H) {
  const w = 'stroke="#fff" fill="none"';
  if (cat === "world" || cat === "tech" || cat === "esports") {
    let d = `M0 ${H / 3}h${W}M0 ${(2 * H) / 3}h${W}`;
    for (let i = 1; i < 4; i++) d += `M${(W * i) / 4} 0v${H}`;
    return `<path d="${d}" ${w} opacity=".08"/>`;
  }
  if (cat === "russia") return `<rect y="${H - 12}" width="${W}" height="4" fill="#fff" opacity=".9"/><rect y="${H - 8}" width="${W}" height="4" fill="#1d4ed8"/><rect y="${H - 4}" width="${W}" height="4" fill="#d52b1e"/>`;
  if (cat === "crypto" || cat === "weather" || cat === "internet") {
    let d = "";
    for (let i = 0; i < Math.ceil(W / 29); i++) for (let j = 0; j < 4; j++) d += `<circle cx="${14 + i * 29 + (j % 2) * 14}" cy="${H * 0.11 + j * (H * 0.25)}" r="2.2"/>`;
    return `<g fill="#fff" opacity=".16">${d}</g>`;
  }
  if (cat === "sport") return `<circle cx="${W / 2}" cy="${H / 2}" r="${H * 0.42}" ${w} opacity=".16" stroke-width="2"/><circle cx="${W / 2}" cy="${H / 2}" r="${H * 0.73}" ${w} opacity=".1" stroke-width="2"/><path d="M${W / 2} 0v${H}" ${w} opacity=".1" stroke-width="2"/>`;
  let d = "";
  for (let i = 0; i < 6; i++) d += `M${(W * (i + 0.5)) / 6} ${H}V${H - (i % 2 ? 46 : 36)}`;
  return `<path d="${d}" ${w} opacity=".1" stroke-width="12"/>`;
}

function banner(e, extra = "", W = 320, H = 110) {
  const [a, b] = CAT_STYLE[e.cat];
  const ang = 100 + ((e.id * 37) % 80);
  const c1 = 30 + ((e.id * 53) % (W - 60)), c2 = (e.id * 97) % W;
  const g = GLYPHS[e.img] || GLYPHS.globe;
  const gs = Math.min(1.25, (H - 14) / 64); // значок уменьшается вместе с баннером
  const attrs = 'stroke="#fff" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  return `<div class="banner ${extra}" style="background:linear-gradient(${ang}deg,${a},${b})"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <circle cx="${c1}" cy="18" r="68" fill="#fff" opacity=".07"/><circle cx="${c2}" cy="${H + 2}" r="58" fill="#fff" opacity=".07"/>
    ${bannerPattern(e.cat, W, H)}
    <g ${attrs} opacity=".16" transform="translate(${W * 0.07} ${H * 0.47}) scale(${(0.62 * gs) / 1.25}) rotate(-12 32 32)">${g}</g>
    <g ${attrs} opacity=".16" transform="translate(${W * 0.82} ${H * 0.09}) scale(${(0.58 * gs) / 1.25}) rotate(14 32 32)">${g}</g>
    <g ${attrs} opacity=".96" transform="translate(${W / 2 - 32 * gs} ${H / 2 - 32 * gs}) scale(${gs})">${g}</g>
  </svg></div>`;
}

// ---------- иллюстрации для пополнения (оригинальные значки, не логотипы банков и платёжных систем) ----------
const PAY_GLYPHS = {
  sbp: '<path d="M38 6 16 36h15l-5 22 22-31H33z"/>',
  crypto: '<ellipse cx="32" cy="16" rx="18" ry="7"/><path d="M14 16v13c0 4 8 7 18 7s18-3 18-7V16M14 29v13c0 4 8 7 18 7s18-3 18-7V29M14 42v6c0 4 8 7 18 7s18-3 18-7v-6"/>',
  usdc: '<circle cx="32" cy="32" r="24"/><path d="M39 25c-1-3-4-5-8-5-4 0-7 2-7 6 0 8 15 3 15 11 0 4-3 6-7 6-4 0-7-2-8-5M32 13v7M32 44v7"/>',
  ton: '<path d="M10 16h44L32 52z"/><path d="M32 16v36"/>',
  bank: GLYPHS.bank, btc: GLYPHS.btc, eth: GLYPHS.eth, tether: GLYPHS.tether
};
const COIN_LOOK = { USDT: ["#26a17b", "tether"], USDC: ["#2775ca", "usdc"], BTC: ["#f7931a", "btc"], ETH: ["#627eea", "eth"], TON: ["#0098ea", "ton"] };
// монограммы банков: [фон, цвет текста, буквы]
const BANK_LOOK = {
  "Сбербанк": ["#21a038", "#fff", "С"], "Т-Банк": ["#ffdd2d", "#1a1a1a", "Т"], "ВТБ": ["#0a2896", "#fff", "ВТБ"],
  "Альфа-Банк": ["#ef3124", "#fff", "А"], "Газпромбанк": ["#1c5fd1", "#fff", "ГПБ"], "Райффайзен": ["#2b2d33", "#ffe600", "Р"],
  "Совкомбанк": ["#0f7ab8", "#fff", "СКБ"], "Другой банк": ["#667085", "#fff", null]
};
function payIcon(kind, size = 36) {
  let bg, glyph, txt = null, fg = "#fff";
  if (COIN_LOOK[kind]) [bg, glyph] = COIN_LOOK[kind];
  else if (BANK_LOOK[kind]) { [bg, fg, txt] = BANK_LOOK[kind]; glyph = "bank"; }
  else if (kind === "sbp") { bg = "linear-gradient(135deg,#6a3df0,#1e90ff)"; glyph = "sbp"; }
  else { bg = "linear-gradient(135deg,#f59e0b,#ef6c00)"; glyph = "crypto"; }
  const inner = txt
    ? `<span style="color:${fg};font-weight:800;font-size:${size * (txt.length > 1 ? 0.3 : 0.44)}px">${txt}</span>`
    : `<svg viewBox="0 0 64 64" width="${size * 0.58}" height="${size * 0.58}" fill="none" stroke="${fg}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PAY_GLYPHS[glyph]}</svg>`;
  return `<span class="dp-ic" style="width:${size}px;height:${size}px;background:${bg}">${inner}</span>`;
}
// большая картинка вверху экрана оплаты: телефон с QR (СБП) или монета в кошельке (крипта)
function payHero(kind, title, sub, coin) {
  const phone = `<g transform="translate(18 8)"><rect x="0" y="0" width="52" height="84" rx="9" fill="#fff" opacity=".95"/><rect x="5" y="9" width="42" height="62" rx="4" fill="#0b1630" opacity=".92"/>
      <g fill="#fff"><rect x="10" y="14" width="12" height="12" rx="1.5"/><rect x="30" y="14" width="12" height="12" rx="1.5"/><rect x="10" y="44" width="12" height="12" rx="1.5"/><rect x="26" y="30" width="5" height="5"/><rect x="34" y="34" width="8" height="5"/><rect x="28" y="46" width="6" height="8"/><rect x="38" y="48" width="4" height="4"/></g>
      <rect x="18" y="76" width="16" height="3" rx="1.5" fill="#0b1630" opacity=".3"/></g>
    <g transform="translate(90 26)" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="24" fill="#ffffff22"/><path d="M27 6 13 26h11l-3 16 14-20H25z" fill="#fff" stroke="none"/></g>`;
  const wallet = `<g transform="translate(14 22)"><rect x="0" y="6" width="74" height="52" rx="10" fill="#fff" opacity=".95"/><path d="M0 16c0-6 4-10 10-10h50" fill="none" stroke="#0b1630" stroke-opacity=".15" stroke-width="3"/><rect x="48" y="24" width="32" height="18" rx="9" fill="#0b1630" opacity=".9"/><circle cx="60" cy="33" r="4" fill="#fff"/></g>
    <g transform="translate(86 6)"><circle cx="22" cy="22" r="22" fill="${(COIN_LOOK[coin] || ["#fbbf24"])[0]}"/><circle cx="22" cy="22" r="18" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><g transform="translate(9.5 9.5) scale(.39)" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${PAY_GLYPHS[(COIN_LOOK[coin] || [0, "crypto"])[1]]}</g></g>
    <g fill="#fff" opacity=".55"><circle cx="20" cy="10" r="2.5"/><circle cx="116" cy="62" r="3"/><circle cx="8" cy="64" r="2"/></g>`;
  const bg = kind === "sbp" ? "linear-gradient(120deg,#4527c7,#1e6fe0)" : "linear-gradient(120deg,#b45309,#f59e0b)";
  return `<div class="dp-hero" style="background:${bg}"><svg viewBox="0 0 150 96" aria-hidden="true">${kind === "sbp" ? phone : wallet}</svg><div><b>${title}</b><span>${sub}</span></div></div>`;
}

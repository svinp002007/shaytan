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
  ballot: '<rect x="8" y="28" width="48" height="28" rx="3"/><path d="M20 28V10h24v18M23 42l6 6 12-12"/>'
};

// какой значок у какого рынка (по порядку в EVENTS)
const BANNER_ICONS = [
  "oil", "bank", "gold", "stocks", "euro", "yuan", "down", "oil", "wheat", "chip",
  "percent", "ruble", "basket", "stocks", "bank", "growth", "oil", "briefcase", "doc", "building", "city",
  "btc", "btc", "eth", "stocks", "pie", "tether", "bank", "globe", "sol", "chip",
  "football", "football", "trophy", "hockey", "hockey", "tennis", "tennis", "hockey", "football", "rings", "football",
  "mic", "doc", "person", "peace", "talk", "shield", "person", "globe", "ballot", "city"
];
EVENTS.forEach((e, i) => { e.img = BANNER_ICONS[i] || "globe"; });

const CAT_STYLE = {
  world:    ["#0f3d6b", "#1d8aa8"],
  russia:   ["#1e3a8a", "#c3281c"],
  crypto:   ["#2a1b6e", "#e8830c"],
  sport:    ["#0b5d3b", "#19a864"],
  politics: ["#1f2a44", "#7a2fa8"]
};

function bannerPattern(cat, W, H) {
  const w = 'stroke="#fff" fill="none"';
  if (cat === "world") {
    let d = `M0 ${H / 3}h${W}M0 ${(2 * H) / 3}h${W}`;
    for (let i = 1; i < 4; i++) d += `M${(W * i) / 4} 0v${H}`;
    return `<path d="${d}" ${w} opacity=".08"/>`;
  }
  if (cat === "russia") return `<rect y="${H - 12}" width="${W}" height="4" fill="#fff" opacity=".9"/><rect y="${H - 8}" width="${W}" height="4" fill="#1d4ed8"/><rect y="${H - 4}" width="${W}" height="4" fill="#d52b1e"/>`;
  if (cat === "crypto") {
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
  const attrs = 'stroke="#fff" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  return `<div class="banner ${extra}" style="background:linear-gradient(${ang}deg,${a},${b})"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <circle cx="${c1}" cy="18" r="68" fill="#fff" opacity=".07"/><circle cx="${c2}" cy="${H + 2}" r="58" fill="#fff" opacity=".07"/>
    ${bannerPattern(e.cat, W, H)}
    <g ${attrs} opacity=".16" transform="translate(${W * 0.07} ${H * 0.47}) scale(.62) rotate(-12 32 32)">${g}</g>
    <g ${attrs} opacity=".16" transform="translate(${W * 0.82} ${H * 0.09}) scale(.58) rotate(14 32 32)">${g}</g>
    <g ${attrs} opacity=".96" transform="translate(${W / 2 - 40} ${H / 2 - 40}) scale(1.25)">${g}</g>
  </svg></div>`;
}

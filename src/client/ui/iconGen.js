/**
 * Procedural serrane-glyph icons. shape = what it is, colour = element (consistent iconography,
 * no external assets → no licensing risk). Accessibility: tone/rarity also encoded by shape/border elsewhere.
 */
const ELEM = {
  sonic: ['#7fe3ff', '#1f5870'], fire: ['#ffa05a', '#7a2e12'], frost: ['#bdefff', '#26506a'], shock: ['#ffe86a', '#6a5a12'], toxic: ['#b6e84a', '#3a5412'],
  physical: ['#f0e4c8', '#4a4030'], hollow: ['#c9b4ff', '#3a2a66'], heal: ['#8dffb0', '#165a32'], none: ['#e8dcc0', '#2b3140'], brass: ['#ffd27a', '#6a4a14'],
};
const G = {
  bell: '<path d="M24 7c-9 3-10 15-12 25h24C34 22 33 10 24 7z"/><circle cx="24" cy="37" r="3.6"/><path d="M24 4v4" fill="none"/>',
  shield: '<path d="M24 7l14 5v12c0 8-7 14-14 17C17 38 10 32 10 24V12z"/>',
  chain: '<ellipse cx="17" cy="24" rx="8" ry="5" fill="none" transform="rotate(-35 17 24)"/><ellipse cx="31" cy="24" rx="8" ry="5" fill="none" transform="rotate(-35 31 24)"/><circle cx="38" cy="14" r="3.5"/>',
  waves: '<path fill="none" d="M10 24a14 14 0 0 1 28 0M15 24a9 9 0 0 1 18 0M20 24a4 4 0 0 1 8 0"/><circle cx="24" cy="30" r="3"/>',
  ram: '<path d="M8 24h24M24 14l12 10-12 10" fill="none"/><path d="M8 16l6 8-6 8" fill="none"/>',
  alarm: '<path d="M24 12c-6 2-7 10-8 17h16c-1-7-2-15-8-17z"/><path fill="none" d="M9 14l-4-2M39 14l4-2M8 24H3M45 24h-5"/><circle cx="24" cy="33" r="3"/>',
  orbit: '<circle cx="24" cy="24" r="4"/><ellipse cx="24" cy="24" rx="16" ry="8" fill="none" transform="rotate(-30 24 24)"/><circle cx="38" cy="19" r="3"/><circle cx="10" cy="29" r="3"/>',
  bellcrown: '<path d="M24 11c-8 3-9 14-11 22h22c-2-8-3-19-11-22z"/><path d="M14 11l4 5 6-8 6 8 4-5" fill="none"/><circle cx="24" cy="37" r="3"/>',
  roll: '<path d="M34 14a13 13 0 1 0 3 12" fill="none"/><path d="M38 8v8h-8" fill="none"/>',
  prism: '<path d="M24 8l13 24H11z" fill="none"/><path d="M24 8v24M11 32l13-8 13 8" fill="none"/><path d="M40 12l5-3M40 20l6 0" fill="none"/>',
  beam: '<path d="M6 30L42 18" fill="none" stroke-width="5"/><path d="M6 30L42 18" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="8" cy="29" r="4"/>',
  nova: '<path d="M24 6l4 12 12-4-8 10 10 8-13-1-3 13-3-13-13 1 10-8-8-10 12 4z"/>',
  spear: '<path d="M8 40L36 12" fill="none" stroke-width="3"/><path d="M36 12l-3 9 9-3z"/>',
  dome: '<path d="M8 34a16 16 0 0 1 32 0z" fill="none"/><path d="M14 34a10 10 0 0 1 20 0" fill="none"/><circle cx="24" cy="26" r="3"/>',
  storm: '<path d="M14 30a8 8 0 0 1 1-16 10 10 0 0 1 19 3 7 7 0 0 1-2 13z" fill="none"/><path d="M25 22l-5 9h6l-3 9 9-12h-6l3-6z"/>',
  fracture: '<path d="M24 5l3 12 11-6-6 11 11 3-11 4 6 11-11-6-3 12-3-12-11 6 6-11-11-4 11-3-6-11 11 6z" fill="none"/><circle cx="24" cy="24" r="3"/>',
  blades: '<path d="M10 38L34 10M38 38L14 10" fill="none" stroke-width="3"/><path d="M34 10l5-2-2 5zM14 10L9 8l2 5z"/>',
  leap: '<path d="M8 36q12-30 32-20" fill="none"/><path d="M40 16l-8-1 3 8z"/><circle cx="10" cy="36" r="3"/>',
  smoke: '<circle cx="16" cy="28" r="7"/><circle cx="28" cy="24" r="9"/><circle cx="34" cy="32" r="6"/>',
  drops: '<path d="M24 8c6 8 9 12 9 17a9 9 0 0 1-18 0c0-5 3-9 9-17z"/><path d="M36 28c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z"/>',
  trap: '<circle cx="24" cy="24" r="9" fill="none"/><path d="M24 6v8M24 34v8M6 24h8M34 24h8M11 11l6 6M31 31l6 6M37 11l-6 6M17 31l-6 6" fill="none"/>',
  spin: '<path d="M24 24m0 0a4 4 0 1 1 6 3 9 9 0 1 1-12-8 14 14 0 1 1 18 14" fill="none"/>',
  flurry: '<path d="M10 14l28 4M8 24l32 0M10 34l28-4" fill="none" stroke-width="3"/>',
  potion: '<path d="M20 6h8v8l8 18a6 6 0 0 1-5 9H17a6 6 0 0 1-5-9l8-18z" fill="none"/><path d="M14 30h20" fill="none"/>',
  ear: '<path d="M30 12a10 10 0 0 0-18 6c0 8 8 8 8 16a5 5 0 0 0 10 0" fill="none"/><path d="M20 20a4 4 0 0 1 6 0" fill="none"/>',
  voice: '<path d="M10 20v8M16 14v20M22 8v32M28 16v16M34 20v8M40 22v4" fill="none" stroke-width="3"/>',
  mute: '<path d="M10 20h6l8-7v22l-8-7h-6z"/><path d="M30 18l10 12M40 18L30 30" fill="none"/>',
  flame: '<path d="M24 6c2 8 10 10 10 20a10 10 0 0 1-20 0c0-5 3-6 4-12 3 2 4 4 6-8z"/>',
  flake: '<path d="M24 6v36M8 15l32 18M8 33l32-18" fill="none"/><path d="M24 12l-4-4M24 12l4-4M24 36l-4 4M24 36l4 4" fill="none"/>',
  bolt: '<path d="M27 5L13 26h9l-3 17 15-23h-9z"/>',
  ember: '<path d="M24 6c2 8 10 10 10 20a10 10 0 0 1-20 0c0-5 3-6 4-12 3 2 4 4 6-8z"/>',
  crystal: '<path d="M24 5l9 12-3 22H18L15 17z" fill="none"/><path d="M15 17h18M24 5v34" fill="none"/>',
  stars: '<path d="M14 14l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1zM32 22l2 4 4 1-3 3 1 4-4-2-3 2 1-4-3-3 4-1z"/>',
  snail: '<path d="M8 36h30M12 36a12 12 0 0 1 24-4 8 8 0 0 0-8-8 7 7 0 0 0-7 7" fill="none"/>',
  roots: '<path d="M24 8v14M24 22l-10 14M24 22l10 14M24 22l-14 4M24 22l14 4" fill="none"/>',
  feather: '<path d="M10 38C12 20 24 10 40 8 38 24 28 36 12 38zM10 38l14-14" fill="none"/>',
  crack: '<path d="M20 6l4 10-6 8 8 6-4 14" fill="none"/>',
  target: '<circle cx="24" cy="24" r="14" fill="none"/><circle cx="24" cy="24" r="6" fill="none"/><path d="M24 4v8M24 36v8M4 24h8M36 24h8" fill="none"/>',
  crosshair: '<circle cx="24" cy="24" r="12" fill="none"/><path d="M24 8v10M24 30v10M8 24h10M30 24h10" fill="none"/>',
  wave: '<path d="M6 24q6-12 12 0t12 0 12 0" fill="none"/>',
  chord: '<circle cx="14" cy="32" r="4"/><circle cx="26" cy="26" r="4"/><circle cx="36" cy="18" r="4"/><path d="M18 32V12M30 26V8M40 18V6" fill="none"/>',
  wing: '<path d="M8 34C14 22 24 14 40 12 36 24 26 34 8 34z" fill="none"/><path d="M14 30l16-10M18 32l14-8" fill="none"/>',
  leaf: '<path d="M10 38C8 20 22 8 40 8 40 26 28 40 10 38zM10 38l18-18" fill="none"/>',
  sun: '<circle cx="24" cy="24" r="8"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" fill="none"/>',
  arrowup: '<path d="M24 40V10M12 22l12-12 12 12" fill="none"/>',
  smokeb: '<circle cx="18" cy="28" r="8"/><circle cx="30" cy="24" r="9"/>',
  weapon: '<path d="M10 38l24-24M30 10l8 8-4 4-8-8z" fill="none"/>',
  helm: '<path d="M10 28a14 14 0 0 1 28 0v8H10z" fill="none"/><path d="M24 14v16M16 30h16" fill="none"/>',
  chest: '<path d="M12 10h24l4 8-6 4v18H14V22l-6-4z" fill="none"/>',
  gloves: '<path d="M14 40V22l-3-8 5-2 2 6 2-12 5 1 1 11 2-6 4 2-3 14v12z" fill="none"/>',
  boots: '<path d="M16 8h14v18l12 6v8H12V28z" fill="none"/>',
  ring: '<circle cx="24" cy="28" r="11" fill="none"/><path d="M18 14l6-8 6 8-6 4z"/>',
  amulet: '<path d="M10 8c4 14 24 14 28 0" fill="none"/><circle cx="24" cy="32" r="7"/>',
  relic: '<path d="M24 5l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="none"/><circle cx="24" cy="24" r="4"/>',
  offhand: '<path d="M24 8l12 4v12c0 8-6 12-12 14-6-2-12-6-12-14V12z" fill="none"/><circle cx="24" cy="22" r="4"/>',
  material: '<path d="M24 6l14 10v16L24 42 10 32V16z" fill="none"/><path d="M10 16l14 8 14-8M24 24v18" fill="none"/>',
  gem: '<path d="M12 18l6-8h12l6 8-12 20z" fill="none"/><path d="M12 18h24M18 10l6 28M30 10l-6 28" fill="none"/>',
  scroll: '<path d="M12 8h22v28a4 4 0 0 1-8 0V14" fill="none"/><path d="M12 8a4 4 0 0 0 0 8h14" fill="none"/>',
};

export function iconSVG(icon, size = 48, opts = {}) {
  const g = G[icon?.glyph] ?? G.relic;
  const [fg, bg] = ELEM[icon?.elem ?? 'none'] ?? ELEM.none;
  const id = `g${Math.abs(hash(`${icon?.glyph}${icon?.elem}`))}`;
  const rar = opts.rarity ? `<rect x="1" y="1" width="46" height="46" rx="6" fill="none" stroke="${opts.rarity}" stroke-width="2"/>` : '';
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${fg}" stop-opacity=".28"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs><rect width="48" height="48" rx="6" fill="url(#${id})"/>${rar}<g fill="${fg}" fill-opacity=".92" stroke="${fg}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`;
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
export const GLYPHS = Object.keys(G);

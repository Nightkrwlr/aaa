/**
 * Thumb-cluster layout — pure functions (no DOM) so they can be unit-tested in Node.
 *
 * The right thumb pivots around the bottom-right corner: the big attack button sits there and every other round button is
 * placed on rings around it (preferred polar slots), then a small relaxation pass guarantees that nothing overlaps, nothing
 * leaves the safe rectangle and nothing drifts out of thumb reach, whatever the screen size or number of unlocked skills.
 */

/** @typedef {{id:string, r:number, x:number, y:number, fixed?:boolean, px?:number, py?:number}} Btn */

/**
 * push overlapping circles apart (fixed ones never move), keep them inside `rect`, pull them softly back to their preferred spot
 * @param {Btn[]} btns  @param {{x0:number,y0:number,x1:number,y1:number}} rect
 */
export function relax(btns, rect, { iterations = 260, gap = 6, spring = 0.06, reach = null } = {}) {
  for (const b of btns) { b.px ??= b.x; b.py ??= b.y; }
  const clamp = (b) => {
    b.x = Math.min(rect.x1 - b.r, Math.max(rect.x0 + b.r, b.x));
    b.y = Math.min(rect.y1 - b.r, Math.max(rect.y0 + b.r, b.y));
    if (reach) { const dx = b.x - reach.cx, dy = b.y - reach.cy, d = Math.hypot(dx, dy); if (d > reach.r && !b.fixed) { b.x = reach.cx + dx / d * reach.r; b.y = reach.cy + dy / d * reach.r; } }
  };
  for (const b of btns) clamp(b);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i], b = btns[j];
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const min = a.r + b.r + gap;
      if (d >= min) continue;
      if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
      const push = (min - d) / d;
      const wa = a.fixed ? 0 : (b.fixed ? 1 : 0.5), wb = b.fixed ? 0 : (a.fixed ? 1 : 0.5);
      a.x -= dx * push * wa; a.y -= dy * push * wa; b.x += dx * push * wb; b.y += dy * push * wb; moved = true;
    }
    for (const b of btns) { if (!b.fixed) { b.x += (b.px - b.x) * spring; b.y += (b.py - b.y) * spring; } clamp(b); }
    if (!moved && it > 40) break;
  }
  // final pure separation (no spring pulling things back together): must end overlap-free whenever there is room
  for (let it = 0; it < 400; it++) {
    let moved = false;
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i], b = btns[j];
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const min = a.r + b.r + gap;
      if (d >= min - 0.01) continue;
      if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
      const push = (min - d) / d * 1.02;
      const wa = a.fixed ? 0 : (b.fixed ? 1 : 0.5), wb = b.fixed ? 0 : (a.fixed ? 1 : 0.5);
      a.x -= dx * push * wa; a.y -= dy * push * wa; b.x += dx * push * wb; b.y += dy * push * wb; moved = true;
    }
    for (const b of btns) clamp(b);
    if (!moved) break;
  }
  return btns;
}

/** metrics scaled to the screen: u = 1 for a ~390 px high landscape phone */
export function metrics(W, H, scale = 1) {
  const short = Math.min(W, H);
  const u = Math.max(0.78, Math.min(1.4, short / 390)) * scale;
  // the screen may be tiny, a thumb is not: every touch target keeps a floor (44 px is the platform guideline for small buttons)
  const px = (base, floor) => Math.max(floor, Math.round(base * u));
  return {
    u,
    attack: px(82, 68), skill: px(54, 46), dodge: px(56, 48), small: px(44, 44),
    stick: Math.round(60 * u), menu: px(44, 44), margin: Math.round(14 * u),
  };
}

/**
 * preferred slots, in priority order. ring 1 fits three buttons (46° apart), ring 2 fits four+ (25° apart);
 * `edge:n` = n-th utility button stacked up the thumb-side edge above the rings (not time-critical: listen, voice)
 */
const SLOTS = {
  dodge: { ring: 1, a: 180 }, s1: { ring: 1, a: 134 }, s2: { ring: 1, a: 88 },
  s3: { ring: 2, a: 168 }, s4: { ring: 2, a: 143 }, s5: { ring: 2, a: 118 }, s6: { ring: 2, a: 93 },
  potion: { ring: 2, a: 68 }, listen: { edge: 1 }, voice: { edge: 2 },
};

/**
 * @param {{W:number,H:number,insets?:{top:number,right:number,bottom:number,left:number},scale?:number,leftHanded?:boolean,ids:string[],topReserve?:number}} o
 * @returns {{m:ReturnType<typeof metrics>, attack:{x:number,y:number,r:number}, buttons:Record<string,{x:number,y:number,r:number}>, stickHome:{x:number,y:number}, rect:object}}
 */
export function clusterLayout({ W, H, insets = { top: 0, right: 0, bottom: 0, left: 0 }, scale = 1, leftHanded = false, ids, topReserve = null }) {
  const m = metrics(W, H, scale);
  const size = (id) => (id === 'dodge' ? m.dodge : (id.startsWith('s') && id.length === 2 ? m.skill : m.small));
  const mg = m.margin;
  const rect = { x0: insets.left + mg, x1: W - insets.right - mg, y0: insets.top + (topReserve ?? Math.round(58 * m.u)), y1: H - insets.bottom - mg };
  const ax = rect.x1 - m.attack / 2, ay = rect.y1 - m.attack / 2;
  const R1 = m.attack / 2 + m.skill / 2 + Math.round(10 * m.u), R2 = R1 + m.skill + Math.round(8 * m.u);
  const btns = [{ id: 'attack', r: m.attack / 2, x: ax, y: ay, fixed: true }];
  for (const id of ids) {
    const s = SLOTS[id]; if (!s) continue;
    if (s.edge) { btns.push({ id, r: size(id) / 2, x: rect.x1 - size(id) / 2, y: ay - R2 - m.skill * 0.6 - (s.edge - 1) * (m.small + 8 * m.u) }); continue; }
    const R = s.ring === 1 ? R1 : R2, th = (s.a * Math.PI) / 180;
    btns.push({ id, r: size(id) / 2, x: ax + Math.cos(th) * R, y: ay - Math.sin(th) * R });
  }
  relax(btns, rect, { reach: { cx: ax, cy: ay, r: R2 + m.skill * 2.4 } });
  const out = {};
  for (const b of btns) out[b.id] = { x: leftHanded ? W - b.x : b.x, y: b.y, r: b.r };
  const sh = { x: leftHanded ? W - (insets.left + mg + m.stick + 10 * m.u) : insets.left + mg + m.stick + 10 * m.u, y: H - insets.bottom - mg - m.stick - 8 * m.u };
  // note: with leftHanded the stick moves to the right edge, the cluster to the left
  if (leftHanded) sh.x = W - (insets.right + mg + m.stick + 10 * m.u);
  return { m, attack: out.attack, buttons: out, stickHome: sh, rect };
}

/** true when no two circles overlap (used by tests) */
export function overlaps(buttons, gap = 0) {
  const a = Object.entries(buttons), bad = [];
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
    const p = a[i][1], q = a[j][1]; if (Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r + gap - 0.01) bad.push([a[i][0], a[j][0]]);
  }
  return bad;
}

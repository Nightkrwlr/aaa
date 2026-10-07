/**
 * Dressing — hand-authored set pieces that make each area of the Terraza Baja feel lived-in or ominous:
 *   settlement (rim fence, well, notice board, hay, woodpile, cart, planters, lantern posts, pumpkins),
 *   quarry (cut-stone stacks, carts + rails, crane, scaffold, camp fire, rubble),
 *   Choir (resonance floor diagram, bone piles, candles, broken benches, shards), overlook (balustrade, telescope),
 *   start chamber (awakening dais, broken arch, leaning pillars), trail markers (cairns, signposts).
 * Everything is merged into a few world-space meshes per area (see Build); pieces stay where the player does not walk
 * (the sim owns collision) or are low enough to read as ground clutter.
 */
import * as THREE from 'three';
import { Rng } from '../../core/rng.js';
import { Paint, PAT } from './paint.js';
import { Build, PI, TAU, CYAN, WARM, EMBER, flowerBox } from './structKit.js';
import { glowMaterial } from './worldMaterials.js';

const TWO = TAU;

// ───────────────────────────────────────────────────────── small reusable pieces (local frames, y up, origin on the ground)
function blockStack(r, n = 6) {
  const p = new Paint(); let placed = 0;
  for (let layer = 0; layer < 3 && placed < n; layer++) for (let i = 0; i < 3 - layer && placed < n; i++, placed++) {
    p.box(1.3, 0.72, 0.82, { pos: [(i - (2 - layer) / 2) * 1.38 + r.range(-0.05, 0.05), 0.36 + layer * 0.74, r.range(-0.06, 0.06)], rot: [0, r.range(-0.08, 0.08), 0], mat: layer % 2 ? 'limestoneLight' : 'limestone', pat: PAT.stone, bevel: 0.05, tile: 1.1 });
  }
  return p;
}
function cart(r) {
  const p = new Paint();
  p.box(2.1, 0.12, 1.15, { pos: [0, 0.62, 0], mat: 'wood', pat: PAT.plank, bevel: 0.02 });
  for (const sz of [-1, 1]) p.box(2.1, 0.5, 0.1, { pos: [0, 0.9, sz * 0.55], mat: 'woodLight', pat: PAT.plank }); for (const sx of [-1, 1]) p.box(0.1, 0.5, 1.15, { pos: [sx * 1.0, 0.9, 0], mat: 'woodLight', pat: PAT.plank });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { p.cyl(0.42, 0.42, 0.1, 10, { pos: [sx * 0.62, 0.42, sz * 0.66], rot: [PI / 2, 0, 0], mat: 'woodDark' }); p.cyl(0.1, 0.1, 0.16, 6, { pos: [sx * 0.62, 0.42, sz * 0.66], rot: [PI / 2, 0, 0], mat: 'iron' }); }
  p.cyl(0.05, 0.05, 1.5, 5, { pos: [0, 0.42, 0], rot: [PI / 2, 0, 0], mat: 'iron' });
  for (const sz of [-0.35, 0.35]) p.box(1.5, 0.07, 0.07, { pos: [-1.65, 0.62, sz], rot: [0, 0, 0.08], mat: 'woodDark' });
  for (let i = 0; i < 4; i++) p.ico(0.3 + r.next() * 0.16, 0, { pos: [r.range(-0.6, 0.6), 0.95, r.range(-0.3, 0.3)], mat: 'rock', pat: PAT.rock, scale: [1, 0.8, 1] });
  return p;
}
function crane(r) {
  const p = new Paint();
  p.box(3.2, 0.3, 3.2, { pos: [0, 0.15, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.04 });
  for (const [x, z] of [[-1.2, -1.0], [1.2, -1.0], [-1.2, 1.0], [1.2, 1.0]]) p.box(0.22, 5.6, 0.22, { pos: [x * 0.45, 3.0, z * 0.45], rot: [z * 0.07, 0, -x * 0.12], mat: 'woodDark', pat: PAT.plank });
  p.box(0.4, 0.4, 0.4, { pos: [0, 5.7, 0], mat: 'iron' });
  p.box(5.2, 0.24, 0.24, { pos: [1.4, 5.5, 0], rot: [0, 0, 0.14], mat: 'woodLight', pat: PAT.plank });
  p.box(0.12, 4.2, 0.12, { pos: [3.6, 3.3, 0], rot: [0, 0, 0], mat: 'rope' });
  p.box(1.1, 0.7, 0.7, { pos: [3.6, 1.0, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.04 });
  p.cyl(0.18, 0.18, 0.12, 8, { pos: [3.6, 5.8, 0], rot: [PI / 2, 0, 0], mat: 'iron' });
  p.cyl(0.35, 0.35, 0.8, 8, { pos: [-0.9, 0.7, 0.6], rot: [0, 0, PI / 2], mat: 'woodDark', pat: PAT.plank });
  return p;
}
function scaffold(r) {
  const p = new Paint();
  for (const x of [-1.8, 0, 1.8]) for (const z of [-0.9, 0.9]) p.box(0.14, 3.6, 0.14, { pos: [x, 1.8, z], mat: 'woodDark', pat: PAT.plank });
  for (const y of [1.2, 2.4]) { p.box(3.9, 0.12, 0.12, { pos: [0, y, 0.9], mat: 'woodLight' }); p.box(3.9, 0.12, 0.12, { pos: [0, y, -0.9], mat: 'woodLight' }); for (const x of [-1.8, 0, 1.8]) p.box(0.12, 0.12, 1.9, { pos: [x, y, 0], mat: 'woodLight' }); }
  p.box(3.8, 0.1, 1.9, { pos: [0, 2.48, 0], mat: 'wood', pat: PAT.plank });
  p.box(0.1, 3.3, 0.1, { pos: [-1.2, 1.5, 1.3], rot: [-0.35, 0, 0], mat: 'woodDark' }); for (let i = 0; i < 6; i++) p.box(0.5, 0.06, 0.06, { pos: [-1.2, 0.4 + i * 0.5, 1.1 + i * 0.0], mat: 'woodDark' });
  return p;
}
function well() {
  const p = new Paint();
  p.cyl(1.0, 1.1, 0.9, 10, { pos: [0, 0.45, 0], mat: 'limestone', pat: PAT.stone, g: [0.1, 0.9] }); p.cyl(1.12, 1.12, 0.12, 10, { pos: [0, 0.94, 0], mat: 'limestoneLight' });
  for (const x of [-1, 1]) p.box(0.16, 2.3, 0.16, { pos: [x * 0.95, 1.6, 0], mat: 'woodDark', pat: PAT.plank });
  p.cyl(0.07, 0.07, 2.0, 6, { pos: [0, 2.3, 0], rot: [0, 0, PI / 2], mat: 'woodLight' });
  p.gable(2.4, 1.9, 0.8, { pos: [0, 2.7, 0], yaw: 0, overhang: 0.25, mat: 'thatch', ridgeMat: 'thatch', pat: PAT.thatch, gables: false, thick: 0.1 });
  p.cyl(0.015, 0.015, 1.1, 4, { pos: [0, 1.75, 0], mat: 'rope' }); p.cyl(0.14, 0.12, 0.2, 7, { pos: [0, 1.1, 0], mat: 'woodDark' });
  return p;
}
function hayBale(r) { const p = new Paint(); p.cyl(0.55, 0.55, 0.95, 9, { pos: [0, 0.55, 0], rot: [PI / 2, 0, 0], mat: 'thatch', pat: PAT.thatch, g: [0.1, 0.8] }); for (const z of [-0.25, 0.25]) p.cyl(0.57, 0.57, 0.05, 9, { pos: [0, 0.55, z], rot: [PI / 2, 0, 0], mat: 'rope' }); return p; }
function woodpile(r) {
  const p = new Paint();
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6 - j; i++) p.cyl(0.19, 0.19, 1.3, 7, { pos: [(i - (5 - j) / 2) * 0.38, 0.2 + j * 0.33, r.range(-0.03, 0.03)], rot: [PI / 2, 0, 0], mat: j % 2 ? 'woodLight' : 'wood', g: [0.2, 0.7] });
  p.box(2.5, 0.08, 0.08, { pos: [0, 0.04, 0.7], mat: 'woodDark' }); p.box(2.5, 0.08, 0.08, { pos: [0, 0.04, -0.7], mat: 'woodDark' });
  return p;
}
function noticeBoard(r) {
  const p = new Paint();
  for (const x of [-0.8, 0.8]) p.box(0.14, 2.2, 0.14, { pos: [x, 1.1, 0], mat: 'woodDark', pat: PAT.plank });
  p.box(1.9, 1.15, 0.1, { pos: [0, 1.5, 0.05], mat: 'woodLight', pat: PAT.plank, bevel: 0.02 });
  p.gable(2.1, 0.7, 0.35, { pos: [0, 2.2, 0.05], overhang: 0.18, mat: 'thatch', ridgeMat: 'thatch', pat: PAT.thatch, gables: false, thick: 0.06 });
  for (let i = 0; i < 5; i++) p.box(0.34 + r.next() * 0.1, 0.42 + r.next() * 0.12, 0.02, { pos: [-0.65 + i * 0.33, 1.5 + r.range(-0.2, 0.2), 0.12], rot: [0, 0, r.range(-0.12, 0.12)], mat: i % 3 ? 'clothCream' : 'plasterRose' });
  return p;
}
function cairn(r, n = 5) { const p = new Paint(); for (let i = 0; i < n; i++) { const k = 1 - i / n; p.ico(0.34 * (0.5 + k * 0.7), 0, { pos: [r.range(-0.04, 0.04), 0.08 + i * 0.2, r.range(-0.04, 0.04)], mat: i % 2 ? 'rock' : 'rockWarm', pat: PAT.rock, scale: [1.2, 0.55, 1.1], rot: [0, r.range(0, 6), 0] }); } p.ico(0.07, 0, { pos: [0, 0.08 + n * 0.2, 0], mat: 'moss' }); return p; }
function signpost(r) {
  const p = new Paint();
  p.box(0.14, 2.4, 0.14, { pos: [0, 1.2, 0], mat: 'woodDark', pat: PAT.plank });
  for (let i = 0; i < 2; i++) { const dir = i ? -1 : 1; p.box(1.0, 0.28, 0.06, { pos: [dir * 0.5, 2.0 - i * 0.42, 0.1], rot: [0, 0, 0], mat: 'woodLight', pat: PAT.plank }); p.prism([[0, -0.14], [0.24 * dir, 0], [0, 0.14]], 0.06, { pos: [dir * 1.0, 2.0 - i * 0.42, 0.1], mat: 'woodLight' }); }
  p.sphere(0.1, 6, 4, { pos: [0, 2.46, 0], mat: 'brass' });
  return p;
}
function brokenArch(r) {
  const p = new Paint();
  for (const [x, h] of [[-2.1, 4.6], [2.1, 2.7]]) { p.box(1.0, 0.45, 1.0, { pos: [x, 0.1, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.05 }); p.box(0.7, h, 0.7, { pos: [x, 0.3 + h / 2, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.05, g: [0.05, 0.9] }); p.box(0.9, 0.3, 0.9, { pos: [x, 0.3 + h, 0], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.05 }); }
  p.add(new THREE.TorusGeometry(2.1, 0.33, 4, 8, PI * 0.42), { pos: [-2.1, 4.9, 0], rot: [0, 0, PI * 0.52], mat: 'limestone', pat: PAT.stone, yr: [0, 2.5] });
  for (let i = 0; i < 4; i++) p.box(0.9 + r.next() * 0.3, 0.5, 0.7, { pos: [1.2 + r.range(-0.3, 1.6), 0.25, 1.1 + r.range(-0.5, 1.0)], rot: [r.range(-0.3, 0.3), r.range(0, 6), r.range(-0.3, 0.3)], mat: 'limestone', pat: PAT.stone, bevel: 0.04 });
  return p;
}
function telescope() {
  const p = new Paint();
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; p.box(0.08, 1.6, 0.08, { pos: [Math.sin(a) * 0.38, 0.75, Math.cos(a) * 0.38], rot: [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25], mat: 'woodDark' }); }
  p.cyl(0.14, 0.14, 0.1, 8, { pos: [0, 1.55, 0], mat: 'brass' });
  p.cyl(0.1, 0.13, 1.5, 8, { pos: [0.4, 1.9, 0.0], rot: [0, 0, -0.75], mat: 'brass', g: [0.1, 0.8] }); p.cyl(0.14, 0.14, 0.2, 8, { pos: [1.05, 2.45, 0.0], rot: [0, 0, -0.75], mat: 'bronze' });
  return p;
}
function railTrack(pts, r) {
  const p = new Paint();
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), yaw = -Math.atan2(dz, dx), n = Math.floor(L / 0.8);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = ax + dx * t, z = az + dz * t, y = ay + (by - ay) * t; p.box(0.14, 0.1, 1.5, { pos: [x, y + 0.05, z], rot: [0, yaw + PI / 2, 0], mat: 'woodDark' }); }
    for (const off of [-0.55, 0.55]) { const ox = -dz / L * off, oz = dx / L * off; p.box(L + 0.05, 0.1, 0.1, { pos: [(ax + bx) / 2 + ox, (ay + by) / 2 + 0.14, (az + bz) / 2 + oz], rot: [0, yaw, Math.atan2(by - ay, L)], mat: 'iron' }); }
  }
  return p;
}

// ───────────────────────────────────────────────────────── fences along cliff rims
/** walk the rim of an elliptical plateau and return a polyline of points just inside the first steep slope */
function rimPolyline(Hf, c, rad, { from = 0, to = TAU, step = 0.04, inset = 0.9 } = {}) {
  const slope = (x, z) => Math.hypot(Hf(x + 0.6, z) - Hf(x - 0.6, z), Hf(x, z + 0.6) - Hf(x, z - 0.6)) / 1.2;
  const pts = [];
  for (let a = from; a <= to + 1e-6; a += step) {
    const dx = Math.sin(a), dz = Math.cos(a); let found = null;
    for (let k = 0.5; k < 1.25; k += 0.008) { const x = c[0] + dx * rad[0] * k, z = c[1] + dz * rad[1] * k; if (slope(x, z) > 0.5) { found = k; break; } }
    if (found === null) { pts.push(null); continue; }
    const k = found - inset / Math.hypot(dx * rad[0], dz * rad[1]);
    pts.push([c[0] + dx * rad[0] * k, c[1] + dz * rad[1] * k]);
  }
  return pts;
}
function railing(poly, Hf, kind, r) {
  const p = new Paint(); const seg = [];
  let prev = null, acc = 0;
  for (const q of poly) {
    if (!q) { prev = null; continue; }
    if (prev) {
      const dx = q[0] - prev[0], dz = q[1] - prev[1], L = Math.hypot(dx, dz);
      if (L > 6) { prev = q; continue; }
      acc += L;
      if (acc >= 2.3) { seg.push([prev, q]); acc = 0; }
    }
    prev = q;
  }
  let last = null;
  for (const [a, b] of seg) {
    const ya = Hf(a[0], a[1]), yb = Hf(b[0], b[1]), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), yaw = -Math.atan2(dz, dx), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, my = (ya + yb) / 2;
    if (kind === 'wood') {
      p.box(0.15, 1.15, 0.15, { pos: [a[0], ya + 0.5, a[1]], mat: 'woodDark', pat: PAT.plank }); p.box(0.2, 0.1, 0.2, { pos: [a[0], ya + 1.1, a[1]], mat: 'woodLight' });
      for (const h of [0.55, 0.92]) p.box(L + 0.05, 0.09, 0.07, { pos: [mx, my + h, mz], rot: [0, yaw, Math.atan2(yb - ya, L)], mat: 'woodLight', pat: PAT.plank });
    } else {
      p.box(L + 0.05, 0.85, 0.34, { pos: [mx, my + 0.42, mz], rot: [0, yaw, Math.atan2(yb - ya, L)], mat: 'limestone', pat: PAT.stone, bevel: 0.04 });
      p.box(L + 0.08, 0.14, 0.46, { pos: [mx, my + 0.9, mz], rot: [0, yaw, Math.atan2(yb - ya, L)], mat: 'limestoneLight', bevel: 0.03 });
      p.box(0.5, 1.15, 0.5, { pos: [a[0], ya + 0.55, a[1]], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.04 });
    }
    last = [b, yb];
  }
  return p;
}

// ───────────────────────────────────────────────────────── area builders
export function buildDressing(zone, ctx) {
  const root = new THREE.Group(); root.name = 'dressing';
  const updaters = [];
  const T = ctx.terrain.userData, Hf = T.heightFn, wa = ctx.wa?.ready ? ctx.wa : null;
  const R = new Rng(`dress:${zone.def.seed}`);
  const aoStamps = [];
  const sample = T.sample;
  const world = (name, fn) => { const b = new Build({ wa: ctx.wa, q: ctx.q, session: ctx.session }, `dress_${name}`); try { fn(b); } catch (e) { console.warn(`dressing ${name} failed`, e); } const g = b.finish({ shadows: true }); g.name = name; root.add(g); if (g.userData.update) updaters.push((t, f) => g.userData.update(t, undefined, f)); return g; };
  const put = (b, paint, x, z, yaw = 0, dy = 0, name = 'solid') => b.solid.merge(paint, [x, Hf(x, z) + dy, z], yaw);
  const kit = (b, key, x, z, o = {}) => b.kit(key, { pos: [x, Hf(x, z) + (o.dy ?? 0), z], ry: o.ry ?? R.range(0, TAU), s: o.s ?? 1, variant: o.variant ?? 'base' });
  const stamp = (x, z, r, k = 0.5) => aoStamps.push({ x, z, r, k });
  const light = (b, color, i, d, x, y, z, flicker = false) => { const l = b.light(color, i, d, [x, y, z], flicker); return l; };

  // ── settlement
  world('settlement', (b) => {
    const rim = rimPolyline(Hf, [0, -30], [24, 17], { step: 0.035, inset: 1.0 });
    b.solid.merge(railing(rim, Hf, 'wood', R));
    put(b, well(), 13.5, -27.5, 0.6); stamp(13.5, -27.5, 1.6, 0.5);
    put(b, noticeBoard(R), -4.4, -24.6, 0.25); stamp(-4.4, -24.6, 1.2);
    for (const [x, z, a] of [[16.2, -37.6, 0.2], [15.2, -38.4, 0.9], [16.6, -39.0, 0.1]]) put(b, hayBale(R), x, z, a, 0, 'solid');
    put(b, woodpile(R), -22.2, -41.4, 1.0); put(b, woodpile(R), 15.6, -41.8, -0.2);
    put(b, cart(R), 11.0, -41.4, 0.5); stamp(11, -41.4, 1.8);
    for (const [x, z, a] of [[-5.8, -35.6, 0.2], [3.4, -36.8, -0.1]]) { b.solid.merge(flowerBox(1.5), [x, Hf(x, z) + 0.05, z], a); }
    ['dungeon/barrel_large', 'dungeon/barrel_small', 'dungeon/crates_stacked', 'dungeon/box_large'].forEach((k, i) => kit(b, k, [-14.2, -13.4, 13.2, 11.6][i] + (i < 2 ? 0 : 0), [-35.4, -36.6, -30.8, -31.8][i], { s: i === 2 ? 0.55 : 0.78 }));
    // pumpkins and jack-o'-lanterns by the doors (a nod to the kit's harvest mood)
    [['graveyard/pumpkin_orange', -11.8, -36.0, 0.7], ['graveyard/pumpkin_orange_small', -12.3, -35.4, 0.8], ['graveyard/pumpkin_yellow', 16.3, -33.8, 0.8], ['graveyard/pumpkin_yellow_small', 16.9, -33.2, 0.7], ['graveyard/pumpkin_orange', -2.4, -35.8, 0.55], ['graveyard/pumpkin_orange_small', 2.4, -35.6, 0.6]].forEach(([k, x, z, s]) => kit(b, k, x, z, { s }));
    // lamp posts at the ramp heads + the benches
    [[-14.5, -31.5], [13.5, -31.0], [-3, -15.5], [6.5, -46.0], [-2.5, -46.2]].forEach(([x, z], i) => { kit(b, 'graveyard/lantern_standing', x, z, { s: 1.15, ry: i * 1.3 }); b.halo([x, Hf(x, z) + 1.25, z], WARM, 1.3); });
    kit(b, 'graveyard/bench', -9.0, -24.4, { s: 0.9, ry: 0 }); kit(b, 'graveyard/bench', 9.5, -23.5, { s: 0.9, ry: 0.1 });
    for (const [x, z] of [[-6.5, -21.5], [6.5, -21.5]]) kit(b, 'dungeon/torch_lit', x, z, { s: 1.0 });
  });

  // ── quarry
  world('quarry', (b) => {
    const spots = [[36.5, 10], [38.2, 3.5], [60, 16], [62.5, 10], [44, 24], [56, -12], [67, -2], [27, 14]];
    spots.forEach(([x, z], i) => { put(b, blockStack(R, 4 + (i % 4) * 2), x, z, R.range(0, 6)); stamp(x, z, 2.2, 0.55); });
    put(b, crane(R), 52, 14, -0.3); stamp(52, 14, 2.4, 0.5);
    put(b, scaffold(R), 66, 8, 1.2); stamp(66, 8, 2.4);
    put(b, cart(R), 44.5, -6, 0.4); put(b, cart(R), 33, 0, -0.6);
    const tr = [[26, 10], [34, 6], [42, 3.5], [50, 1.5], [58, -2], [64, -5]].map(([x, z]) => [x, Hf(x, z) + 0.02, z]); b.solid.merge(railTrack(tr, R));
    kit(b, 'dungeon/rubble_large', 28, 20, { s: 0.7, ry: 0.5 }); kit(b, 'dungeon/rubble_half', 64, 22, { s: 0.8, ry: 2.2 }); kit(b, 'dungeon/rubble_half', 45, -14, { s: 0.7, ry: 1.1 }); kit(b, 'dungeon/rubble_large', 70, -10, { s: 0.7, ry: -0.5 });
    [['dungeon/barrel_large', 53.5, 18], ['dungeon/barrel_small', 54.8, 19.2], ['dungeon/crates_stacked', 49.5, 17.5], ['dungeon/box_large', 62, 14.4], ['dungeon/barrel_small_stack', 59.5, 20]].forEach(([k, x, z], i) => kit(b, k, x, z, { s: k.includes('stacked') ? 0.55 : 0.75 }));
    [[40, 18], [57, 4], [34, -6]].forEach(([x, z]) => { const y = Hf(x, z); b.solid.cyl(0.07, 0.09, 2.2, 6, { pos: [x, y + 1.1, z], mat: 'woodDark' }); kit(b, 'dungeon/torch_lit', x, z, { dy: 2.0, s: 1.1 }); b.halo([x, y + 3.0, z], EMBER, 1.5).floorGlow([x, y + 0.08, z], EMBER, 4.2); light(b, EMBER, 4, 9, x, y + 3.0, z, true); });
    // campfire by Tarn's lore stone
    const cx = 31, cz = -11, cy = Hf(cx, cz);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; b.solid.ico(0.2, 0, { pos: [cx + Math.sin(a) * 0.65, cy + 0.1, cz + Math.cos(a) * 0.65], mat: 'rock', pat: PAT.rock, scale: [1, 0.7, 1] }); }
    for (let i = 0; i < 3; i++) b.solid.cyl(0.09, 0.1, 1.1, 6, { pos: [cx, cy + 0.22, cz], rot: [PI / 2 - 0.2, (i / 3) * TAU, 0.4], mat: 'woodDark' });
    b.glow.cone(0.3, 0.8, 6, { pos: [cx, cy + 0.65, cz], mat: 'ember', g: [0.1, 0.8] });
    b.halo([cx, cy + 1.0, cz], EMBER, 2.4).floorGlow([cx, cy + 0.08, cz], EMBER, 5.5); b.smoke([cx, cy + 1.1, cz], 5, 0.5);
    const fl = light(b, EMBER, 7, 12, cx, cy + 1.2, cz, true); b.onUpdate((t) => { fl.intensity = 6 + Math.sin(t * 12) * 1.1 + Math.sin(t * 7.1) * 0.8; });
  });

  // ── Empty Choir
  world('choir', (b) => {
    const cx = 5, cz = 62, cy = Hf(cx, cz);
    // resonance diagram on the floor (own emissive material: it breathes)
    const ringMat = glowMaterial(CYAN, 1.2, { fade: false }).clone(); ringMat.userData.shared = false; ringMat.userData.glowBase = 0; ringMat.polygonOffset = true; ringMat.polygonOffsetFactor = -4; ringMat.polygonOffsetUnits = -4; ringMat.depthWrite = false;
    const fg = new Paint();
    const mk = (g, y = 0.1) => { g.rotateX(-PI / 2); return g; };
    for (const rr of [3.2, 6.2, 9.6, 13.2]) fg.add(mk(new THREE.RingGeometry(rr - 0.07, rr + 0.07, 72)), { pos: [0, 0.1, 0], mat: 'glassCyan', g: [0.8, 1] });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; fg.box(9.6, 0.02, 0.1, { pos: [Math.sin(a) * 8.0, 0.1, Math.cos(a) * 8.0], rot: [0, a + PI / 2, 0], mat: 'glassCyan', g: [0.8, 1] }); }
    for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; fg.box(0.18, 0.02, 0.9, { pos: [Math.sin(a) * 11.4, 0.1, Math.cos(a) * 11.4], rot: [0, a, 0], mat: 'glassCyan', g: [0.7, 1] }); }
    fg.add(mk(new THREE.RingGeometry(0.0, 1.0, 24)), { pos: [0, 0.1, 0], mat: 'glassCyan', g: [0.8, 1] });
    const mesh = new THREE.Mesh(fg.build(), ringMat); mesh.position.set(cx, cy, cz); mesh.renderOrder = 2; b.add(mesh);
    b.onUpdate((t) => { ringMat.emissiveIntensity = 0.5 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.4)); });
    // bones, skulls, ribcages, candles, tipped benches, shards
    const rr = new Rng('choirdress');
    for (let i = 0; i < 26; i++) { const a = rr.range(0, TAU), d = rr.range(3, 14), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d; kit(b, pick(rr, ['graveyard/bone_A', 'graveyard/bone_B', 'graveyard/bone_C', 'graveyard/skull', 'graveyard/ribcage']), x, z, { s: rr.range(0.7, 1.1), ry: rr.range(0, 6) }); }
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2, d = rr.range(8.5, 12.5), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d; kit(b, 'graveyard/candle_triple', x, z, { s: 1.0 }); b.halo([x, Hf(x, z) + 0.8, z], CYAN, 1.0).floorGlow([x, Hf(x, z) + 0.06, z], CYAN, 2.4); }
    for (const [x, z, a] of [[-3, 52, 0.8], [13.5, 54, -0.5], [-4, 70, 2.3], [14, 68, 1.0]]) { const g = b.wa?.geo('graveyard/bench'); kit(b, 'graveyard/bench', x, z, { ry: a, s: 0.95, dy: 0.0 }); }
    for (let i = 0; i < 7; i++) { const a = rr.range(0, TAU), d = rr.range(5, 15), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, y = Hf(x, z); b.solid.box(rr.range(0.5, 1.1), 0.12, rr.range(0.3, 0.7), { pos: [x, y + 0.28, z], rot: [rr.range(0.2, 0.9), rr.range(0, 6), rr.range(0.1, 0.5)], mat: 'bronze', g: [0.1, 0.8] }); }
    for (const [x, z, s] of [[-8, 56, 0.8], [20, 56, 0.7], [-6, 74, 0.7], [18, 72, 0.8]]) kit(b, 'dungeon/rubble_half', x, z, { s, variant: 'base' });
    b.light(CYAN, 5, 16, [cx, cy + 3.0, cz]);
  });

  // ── overlook
  world('overlook', (b) => {
    const rim = rimPolyline(Hf, [45, -58], [19, 15], { step: 0.04, inset: 0.7 });
    b.solid.merge(railing(rim, Hf, 'stone', R));
    put(b, telescope(), 52.6, -66.8, 2.6);
    kit(b, 'graveyard/bench_decorated', 41, -64.4, { s: 0.95, ry: PI }); kit(b, 'graveyard/bench', 50, -63.5, { s: 0.9, ry: PI });
    kit(b, 'graveyard/shrine_candles', 47.8, -62.6, { s: 1.0, ry: PI }); b.halo([47.8, Hf(47.8, -62.6) + 1.4, -62.6], WARM, 1.2);
    for (const [x, z] of [[34, -55], [34.5, -62]]) { b.solid.cyl(0.07, 0.09, 3.6, 6, { pos: [x, Hf(x, z) + 1.8, z], mat: 'woodDark' }); }
    b.cloth('dungeon/banner_thin_white', { pos: [34, Hf(34, -55) + 0.0, -55], s: 1.0, swayHeight: 3.7 }); b.cloth('dungeon/banner_thin_blue', { pos: [34.5, Hf(34.5, -62) + 0.0, -62], s: 1.0, swayHeight: 3.7 });
    stamp(52.6, -66.8, 1.3);
  });

  // ── start chamber ("latency chamber"): an awakening dais, leaning pillars, a broken arch
  world('start', (b) => {
    const cx = -60, cz = 50, cy = Hf(cx, cz);
    b.solid.cyl(3.7, 3.9, 0.35, 16, { pos: [cx, cy + 0.0, cz], mat: 'limestoneDark', pat: PAT.stone }); b.solid.cyl(3.2, 3.5, 0.3, 16, { pos: [cx, cy + 0.2, cz], mat: 'limestone', pat: PAT.stone });
    const ringMat = glowMaterial(CYAN, 1.4, { fade: false }).clone(); ringMat.userData.shared = false; ringMat.userData.glowBase = 0; ringMat.polygonOffset = true; ringMat.polygonOffsetFactor = -4; ringMat.depthWrite = false;
    const fg = new Paint();
    for (const rr of [1.4, 2.4, 3.0]) fg.add(new THREE.RingGeometry(rr - 0.05, rr + 0.05, 48).rotateX(-PI / 2), { pos: [0, 0.07, 0], mat: 'glassCyan', g: [0.8, 1] });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; fg.box(1.5, 0.02, 0.07, { pos: [Math.sin(a) * 2.2, 0.07, Math.cos(a) * 2.2], rot: [0, a + PI / 2, 0], mat: 'glassCyan', g: [0.8, 1] }); }
    const m = new THREE.Mesh(fg.build(), ringMat); m.position.set(cx, cy + 0.36, cz); m.renderOrder = 2; b.add(m);
    b.onUpdate((t) => { ringMat.emissiveIntensity = 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.1)); });
    put(b, brokenArch(R), -64.5, 58.2, 2.7); put(b, cairn(R, 5), -52.5, 52.5); put(b, cairn(R, 4), -66.5, 42.5);
    for (const [k, x, z, ry, rz] of [['dungeon/pillar', -66.4, 51.8, 0.5, 0.3], ['dungeon/pillar_decorated', -53.6, 58.6, 2.2, -0.35], ['dungeon/column', -67.8, 56.4, 1.2, 1.2]]) b.kit(k, { pos: [x, Hf(x, z) - 0.2, z], ry, rz, s: 1.0, variant: 'limestone' });
    kit(b, 'dungeon/rubble_half', -69, 47, { s: 0.7, ry: 0.7 }); kit(b, 'dungeon/rubble_large', -49, 60, { s: 0.6, ry: 2.0 });
    for (const [x, z] of [[-55.5, 54.5], [-64.5, 46.5]]) { kit(b, 'graveyard/candle_triple', x, z, { s: 1.0 }); b.halo([x, Hf(x, z) + 0.8, z], WARM, 0.9); }
    b.halo([cx, cy + 0.9, cz], CYAN, 3).floorGlow([cx, cy + 0.4, cz], CYAN, 8.5);
    b.light(CYAN, 5, 14, [cx, cy + 2.4, cz]);
  });

  // ── trail markers along the main path
  world('trail', (b) => {
    for (const [x, z] of [[-45.5, 36.5], [-31.5, 21.5], [-16.5, 3.5], [-8, -10], [0, 22], [26, -12], [12, -48]]) {
      const p = R.next() < 0.5 ? cairn(R, 4 + Math.floor(R.next() * 3)) : signpost(R); put(b, p, x, z, R.range(0, TAU)); stamp(x, z, 0.9, 0.4);
    }
  });

  ctx.terrain.userData.paintAO(aoStamps);
  return { group: root, updaters };
}

function pick(r, list) { return list[Math.floor(r.next() * list.length)]; }

/**
 * DungeonMesh — a generated dungeon (tilemap + content) turned into 3D in the same painted-stone language as the overworld.
 *
 *  · floor, walls and wall caps are painted quads (palette swatch + analytic stone courses) — only faces you can actually see,
 *    in 16×16-tile chunks so the GPU culls what is off screen. Walls get a plinth and a cap ledge, thick rock fades to black.
 *  · lighting is BAKED into vertex colours: ambient occlusion where stone meets floor + a warm/cool pool around every torch,
 *    brazier, crystal… — unlimited light sources at zero runtime cost; the nearest few also get real point lights (Scene3D budget).
 *  · KayKit props (barrels, banners, coffins, pillars, sconces…) are merged per chunk; flames are one instanced mesh + additive halos.
 *  · the runtime stays the source of truth: doors opening are mirrored through openDoor().
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/rng.js';
import { T, TILE } from '../../sim/dungeon/tilemap.js';
import { Paint, PAT } from './paint.js';
import { paintMaterial, glowMaterial, glowPaintMaterial } from './worldMaterials.js';
import { disposeTree } from './kit.js';

const PI = Math.PI, WALL_H = 3.6, CH = 16, RING_MAX = 5, PLINTH = 0.42, LEDGE = 0.5;
/** brightness of a wall-top tile by its distance (in tiles) to open ground: thick rock fades into the dark */
const RING = [0, 1, 0.74, 0.52, 0.32, 0.18];
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];                  // the side a face looks to: −z, +z, −x, +x
const ROOM_TINT = { boss: '#8a4a3a', shrine: '#4a8aa8', secret: '#8a6aa8', treasure: '#a88a3a', entrance: '#6a8a6a', exit: '#6a8a6a', wave_arena: '#8a5a4a', puzzle: '#5a6a9a' };

/** what each family is built from (palette swatches of worldMaterials.js). floor/wall = [main, patches, rare patches] */
const STYLE = {
  crypt: {
    floor: ['limestoneDark', 'limestoneCool', 'limestoneDark'], wall: ['slate', 'limestoneCool', 'slate'],
    cap: 'ironLight', ledge: 'iron', plinth: 'limestoneLight', door: 'limestoneCool', trim: 'brass',
    pat: PAT.stone, floorTile: 0.55, wallTile: 1, capTile: 0.9, bands: true, torches: true, banners: true, moss: true, clutter: ['dungeon/barrel_small', 'dungeon/box_small', 'dungeon/trunk_small_A', 'dungeon/keg'], bones: true,
  },
  cavern: {
    floor: ['earth', 'earth', 'caveRock'], wall: ['caveViolet', 'caveRock', 'caveViolet'],
    cap: 'caveDark', ledge: 'caveDark', plinth: 'caveRock', door: 'caveRock', trim: 'crystal',
    pat: PAT.rock, wallPat: PAT.strata, floorTile: 1, wallTile: 1, capTile: 1, bands: false, torches: false, banners: false, moss: true, clutter: [], bones: true, boulders: true,
  },
  facility: {
    floor: ['ironLight', 'ironLight', 'slate'], wall: ['slate', 'ironLight', 'slate'],
    cap: 'ironLight', ledge: 'soot', plinth: 'hazard', door: 'ironLight', trim: 'hazard',
    pat: PAT.stone, floorTile: 0.8, wallTile: 0.6, capTile: 0.7, bands: true, torches: false, lamps: true, banners: false, moss: false, clutter: ['dungeon/box_large', 'dungeon/crates_stacked', 'dungeon/barrel_large', 'dungeon/box_stacked'], bones: false, strips: true,
  },
};

/** the mood of each family: ambient colours, fog, grade and the colour of the torch the player carries */
const MOOD = {
  crypt: { sky: '#9aa8c8', ground: '#5c4a46', hemi: 1.7, sun: '#c4d2f4', sunI: 1.2, fogK: 0.5, fogMix: 0.22, torch: '#ffb458', shadow: [0.9, 0.97, 1.14] },
  cavern: { sky: '#9aa8b8', ground: '#5a4a42', hemi: 1.75, sun: '#b4d8ee', sunI: 1.0, fogK: 0.5, fogMix: 0.2, torch: '#ffd08a', shadow: [0.9, 0.98, 1.12] },
  facility: { sky: '#a2aec0', ground: '#4c4642', hemi: 1.8, sun: '#d6e0f0', sunI: 1.2, fogK: 0.48, fogMix: 0.16, torch: '#ffd9a0', shadow: [0.94, 0.98, 1.08] },
};
export const dungeonTorchColor = (family) => (MOOD[family.theme] ?? MOOD.crypt).torch;

export function applyDungeonAtmosphere(a, family, mult = 1) {
  const lt = family.light, m = MOOD[family.theme] ?? MOOD.crypt, C = (h) => new THREE.Color(h);
  a.fog.set(lt.fog).lerp(C('#8090b0'), m.fogMix); a.density = lt.fogDensity * m.fogK * (mult < 1 ? 1.3 : 1); a.falloff = 0;
  a.hemiSky.set(m.sky).lerp(C(lt.ambient), 0.18); a.hemiGround.set(m.ground); a.hemiIntensity = m.hemi * (0.55 + 0.45 * mult);
  a.sun.set(m.sun); a.sunIntensity = m.sunI * (0.6 + 0.4 * mult); a.sunDir.set(-0.38, 1, -0.28).normalize();
  a.exposure = 1.1; a.sat = 1.12; a.contrast = 1.1; a.vignette = 0.46; a.lift = 0.018; a.stars = 0; a.glow = 1.35; a.cloud = 0; a.shafts = 0;
  a.shadowTint = new THREE.Vector3(...m.shadow); a.highTint = new THREE.Vector3(1.08, 1.0, 0.9);
  a.bloom = [0.5, 0.7, 1.12];
  return a;
}

// ───────────────────────────────────────────────────────── helpers
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** integer hash → [0,1) */
function h2(x, y, s = 0) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483629); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** smooth value noise in [0,1] */
function vn(x, y, s = 0) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const pick = (arr, h) => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))];
const lin = (hex) => new THREE.Color(hex);

export function buildDungeonMesh(dungeon, family, scene3d) {
  const map = dungeon.map, content = dungeon.content, theme = STYLE[family.theme] ? family.theme : 'crypt';
  const S = STYLE[theme], wa = scene3d.wa?.ready ? scene3d.wa : null, mult = content.lightMult ?? 1;
  const root = new THREE.Group(); root.name = 'dungeon';
  const rng = new Rng(`${dungeon.seed}:mesh`);
  const out = { root, doorViews: new Map(), update: () => {}, kitUsed: !!wa };
  const W = map.w, HH = map.h, runtimeDoors = scene3d.session.dungeon.doors;

  const solid = (x, y) => { const t = map.get(x, y); return t === T.WALL || t === T.SECRET; };

  // ── how deep inside rock every solid tile is (Chebyshev distance to the nearest non-solid tile); deep rock is never drawn
  const ring = new Uint8Array(W * HH).fill(255);
  { const q = [];
    for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) if (!solid(x, y)) { ring[y * W + x] = 0; q.push(x, y); }
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1], r = ring[y * W + x]; if (r >= RING_MAX) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= HH) continue; const k = ny * W + nx; if (ring[k] === 255) { ring[k] = r + 1; q.push(nx, ny); } }
    } }

  const regionRoom = new Map(); for (const rm of dungeon.rooms.values()) regionRoom.set(rm.region, rm);
  const roomAt = (tx, ty) => regionRoom.get(map.region[map.idx(tx, ty)]);
  const secretDoor = new Map();                                   // tile index → door id (secret doors are drawn apart so they can vanish)
  for (const d of runtimeDoors) if (d.kind === 'secret') for (const [x, y] of d.cells) secretDoor.set(map.idx(x, y), d.id);

  // ── chunks
  const chunks = new Map();
  const chunkAt = (tx, ty) => { const cx = tx >> 4, cy = ty >> 4, k = cy * 4096 + cx; let c = chunks.get(k); if (!c) chunks.set(k, c = { cx, cy, floor: new Paint({ colors: true }), wall: new Paint({ colors: true }), props: new Paint({ colors: true }), glow: new Paint(), kit: new Map() }); return c; };
  const chunkAtW = (x, z) => chunkAt(Math.floor(x / TILE), Math.floor(z / TILE));
  const secretP = new Map();

  /** which way a door spans and how wide it is (metres) */
  const orient = (d) => {
    const xs = d.cells.map(([x]) => x), ys = d.cells.map(([, y]) => y);
    const passAlongX = (x, y) => map.get(x - 1, y) !== T.WALL && map.get(x + 1, y) !== T.WALL;
    const spanX = new Set(xs).size > 1 || (new Set(ys).size === 1 && !passAlongX(xs[0], ys[0]));
    return { spanX, span: (spanX ? (Math.max(...xs) - Math.min(...xs) + 1) : (Math.max(...ys) - Math.min(...ys) + 1)) * TILE };
  };

  // ── lights to bake (every torch, brazier, crystal…)
  const lights = [];
  const addLight = (x, y, z, hex, range, power) => { const c = lin(hex), m = Math.max(c.r, c.g, c.b, 1e-3); lights.push({ x, y, z, range, power: power * (0.45 + 0.55 * mult), r: c.r / m, g: c.g / m, b: c.b / m }); };
  const emit = (x, y, z, hex, intensity, range, flicker) => {                       // real point light, budgeted by Scene3D
    const light = new THREE.PointLight(hex, intensity * mult, range, 2), holder = new THREE.Object3D(); holder.position.set(x, y, z); root.add(holder); scene3d.addEmitter(holder, light, flicker);
  };
  const flames = [], halos = { warm: [], cool: [], green: [] };

  // ═════════════════════════════════════════════ floor
  const dimTint = new THREE.Color(), tmpC = new THREE.Color();
  const emitFloor = (P, tx, ty, t) => {
    const x0 = tx * TILE, z0 = ty * TILE, rm = roomAt(tx, ty), v = 0.985 + 0.03 * h2(tx, ty, 2);
    let sw = vn(tx * 0.22, ty * 0.22, 31) > 0.62 ? S.floor[1] : vn(tx * 0.3 + 9, ty * 0.3, 32) > 0.72 ? S.floor[2] : S.floor[0], col = [v, v, v];
    if (t === T.DOOR || t === T.LOCK || t === T.ONEWAY) { sw = 'limestoneLight'; col = [v * 1.05, v * 1.0, v * 0.9]; }
    if (rm && ROOM_TINT[rm.node?.type]) { dimTint.set(ROOM_TINT[rm.node.type]); const m = Math.max(dimTint.r, dimTint.g, dimTint.b); col = col.map((c, i) => c * (1 + 0.2 * ((i === 0 ? dimTint.r : i === 1 ? dimTint.g : dimTint.b) / m - 1))); }
    if (t === T.PIT) { sw = 'void'; col = [0.5, 0.5, 0.5]; }
    for (let sx = 0; sx < 2; sx++) for (let sz = 0; sz < 2; sz++) {
      const a = x0 + sx, b = z0 + sz, tt = 0.12 + 0.22 * vn(a * 0.33, b * 0.33, 5);
      P.quad([[a, 0, b], [a, 0, b + 1], [a + 1, 0, b + 1], [a + 1, 0, b]], { mat: sw, pat: t === T.PIT ? 0 : S.pat, tile: S.floorTile, t: [tt, tt, tt, tt], s: [[a, b], [a, b + 1], [a + 1, b + 1], [a + 1, b]], col });
    }
  };

  // ═════════════════════════════════════════════ walls
  const faceQuad = (P, d, x0, z0, x1, z1, y0, y1, off, o) => {
    let p, s;
    switch (d) {
      case 0: { const z = z0 - off; p = [[x0, y0, z], [x0, y1, z], [x1, y1, z], [x1, y0, z]]; s = [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]; break; }
      case 1: { const z = z1 + off; p = [[x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]]; s = [[x1, y0], [x1, y1], [x0, y1], [x0, y0]]; break; }
      case 2: { const x = x0 - off; p = [[x, y0, z1], [x, y1, z1], [x, y1, z0], [x, y0, z0]]; s = [[z1, y0], [z1, y1], [z0, y1], [z0, y0]]; break; }
      default: { const x = x1 + off; p = [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]; s = [[z0, y0], [z0, y1], [z1, y1], [z1, y0]]; }
    }
    P.quad(p, { ...o, s });
  };
  const rect = (P, xa, za, xb, zb, y, o) => P.quad([[xa, y, za], [xa, y, zb], [xb, y, zb], [xb, y, za]], { ...o, s: [[xa, za], [xa, zb], [xb, zb], [xb, za]] });
  const strip = (P, d, x0, z0, x1, z1, y, o0, o1, o) => {
    switch (d) {
      case 0: rect(P, x0, z0 - o1, x1, z0 - o0, y, o); break;
      case 1: rect(P, x0, z1 + o0, x1, z1 + o1, y, o); break;
      case 2: rect(P, x0 - o1, z0, x0 - o0, z1, y, o); break;
      default: rect(P, x1 + o0, z0, x1 + o1, z1, y, o);
    }
  };
  const G0 = 0.08, G1 = 0.86, tOf = (y) => G0 + (G1 - G0) * (1 - y / WALL_H);
  const emitWall = (P, tx, ty, r, isSecret) => {
    const x0 = tx * TILE, z0 = ty * TILE, x1 = x0 + TILE, z1 = z0 + TILE, hv = h2(tx, ty, 5);
    const sw = vn(tx * 0.25, ty * 0.25, 33) > 0.66 ? S.wall[1] : hv > 0.9 ? S.wall[2] : S.wall[0], v = (0.94 + 0.12 * h2(tx, ty, 6)) * (isSecret ? 0.94 : 1), shade = RING[r] ?? 0.16;
    // top
    const ct = 0.16 + 0.2 * h2(tx, ty, 7);
    rect(P, x0, z0, x1, z1, WALL_H, { mat: S.cap, pat: S.pat, tile: S.capTile, t: [ct, ct, ct, ct], col: [v * shade, v * shade, v * shade] });
    if (r !== 1) return;
    const exposed = (nx, ny) => { const t = map.get(nx, ny); return isSecret ? !(t === T.WALL || t === T.SECRET) : t !== T.WALL; };
    for (let d = 0; d < 4; d++) {
      if (!exposed(tx + DIRS[d][0], ty + DIRS[d][1])) continue;
      const top = S.bands ? WALL_H - LEDGE : WALL_H, bot = S.bands ? PLINTH : 0;
      faceQuad(P, d, x0, z0, x1, z1, bot, top, 0, { mat: sw, pat: S.wallPat ?? S.pat, tile: S.wallTile, t: [tOf(bot), tOf(top), tOf(top), tOf(bot)], col: [v, v, v] });
      if (S.bands) {
        const pc = [v * 0.95, v * 0.95, v * 0.95];
        faceQuad(P, d, x0, z0, x1, z1, 0, PLINTH, 0.1, { mat: S.plinth, pat: S.pat, tile: S.wallTile, t: [0.55, 0.2, 0.2, 0.55], col: pc });
        strip(P, d, x0, z0, x1, z1, PLINTH, 0, 0.1, { mat: S.plinth, t: [0.12, 0.12, 0.12, 0.12], col: pc });
        faceQuad(P, d, x0, z0, x1, z1, WALL_H - LEDGE, WALL_H, 0.16, { mat: S.ledge, pat: S.pat, tile: S.capTile, t: [0.6, 0.2, 0.2, 0.6], col: [v, v, v] });
        strip(P, d, x0, z0, x1, z1, WALL_H, 0, 0.16, { mat: S.cap, t: [0.2, 0.2, 0.2, 0.2], col: [v, v, v] });
      }
    }
  };

  for (let ty = 0; ty < HH; ty++) for (let tx = 0; tx < W; tx++) {
    const k = ty * W + tx, t = map.get(tx, ty);
    if (t === T.WALL || t === T.SECRET) {
      const r = ring[k]; if (r === 0 || r === 255) continue;
      if (t === T.SECRET) {
        emitFloor(chunkAt(tx, ty).floor, tx, ty, T.FLOOR);
        const id = secretDoor.get(k) ?? 'secret'; let P = secretP.get(id); if (!P) secretP.set(id, P = new Paint({ colors: true }));
        emitWall(P, tx, ty, r, true);
      } else emitWall(chunkAt(tx, ty).wall, tx, ty, r, false);
    } else emitFloor(chunkAt(tx, ty).floor, tx, ty, t);
  }

  // ═════════════════════════════════════════════ kit props / painted props
  const Y = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const kitAdd = (ch, key, x, y, z, rot = 0, sc = 1) => {
    if (!wa) return false; const geo = wa.geo(key); if (!geo) return false;
    const group = key.split('/')[0]; let list = ch.kit.get(group); if (!list) ch.kit.set(group, list = []);
    list.push({ geo, m: new THREE.Matrix4().compose(pv.set(x, y, z), qa.setFromAxisAngle(Y, rot), sv.setScalar(sc)) }); return true;
  };
  const local = (build, ch, x, z, rot, glow = false) => { const P = new Paint(); build(P); (glow ? ch.glow : ch.props).merge(P, [x, 0, z], rot); };
  const flame = (x, y, z, s = 1, kind = 'warm') => { flames.push({ x, y, z, s, ph: flames.length * 1.7 }); halos[kind].push(x, y + 0.1, z); };

  // painted fallbacks / always-painted props
  const paintPillar = (P) => {
    P.cyl(0.8, 0.92, 0.5, 10, { pos: [0, 0.25, 0], mat: S.wall[0], pat: PAT.stone });
    P.cyl(0.56, 0.62, 2.8, 10, { pos: [0, 1.9, 0], mat: S.door, pat: PAT.stone, tile: 1.2 });
    P.cyl(0.9, 0.64, 0.42, 10, { pos: [0, 3.4, 0], mat: S.cap }); P.box(1.8, 0.22, 1.8, { pos: [0, 3.68, 0], mat: S.cap, pat: PAT.stone });
  };
  const paintSarcophagus = (P) => {
    P.box(1.1, 0.8, 2.3, { pos: [0, 0.4, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.05 });
    P.box(1.28, 0.3, 2.5, { pos: [0, 0.95, 0], mat: 'limestoneCool', bevel: 0.07 });
    P.box(0.34, 0.1, 1.3, { pos: [0, 1.14, 0], mat: S.trim }); P.box(0.8, 0.1, 0.22, { pos: [0, 1.14, 0.3], mat: S.trim });
  };
  const paintBarrel = (P) => { P.cyl(0.46, 0.4, 0.9, 9, { pos: [0, 0.45, 0], mat: 'wood', pat: PAT.plank, tile: 1.4 }); P.cyl(0.48, 0.48, 0.07, 9, { pos: [0, 0.2, 0], mat: 'iron' }); P.cyl(0.48, 0.48, 0.07, 9, { pos: [0, 0.7, 0], mat: 'iron' }); };
  const paintBrazier = (P) => {
    P.cyl(0.1, 0.22, 0.95, 6, { pos: [0, 0.48, 0], mat: 'iron' }); P.cyl(0.58, 0.34, 0.34, 9, { pos: [0, 1.1, 0], mat: 'iron' }); P.cyl(0.62, 0.62, 0.07, 9, { pos: [0, 1.28, 0], mat: 'ironLight' });
    for (let i = 0; i < 3; i++) P.cyl(0.05, 0.09, 0.8, 5, { pos: [Math.cos(i * 2.09) * 0.2, 0.4, Math.sin(i * 2.09) * 0.2], rot: [Math.sin(i * 2.09) * 0.25, 0, -Math.cos(i * 2.09) * 0.25], mat: 'iron' });
  };

  const sconces = [];                                           // wall torches placed so far (spacing / reserved spots)
  const addTorch = (x, z, ox, oz, y = 2.0) => {                 // x,z on the wall plane, (ox,oz) = outward normal
    const ch = chunkAtW(x, z), rot = Math.atan2(ox, oz);
    if (!kitAdd(ch, 'dungeon/torch_mounted', x, y, z, rot, 1.35)) local((P) => { P.box(0.16, 0.5, 0.16, { pos: [0, 0.2, 0.2], mat: 'iron' }); }, ch, x, z, rot);
    const fx = x + ox * 0.36, fz = z + oz * 0.36;
    flame(fx, y + 0.78, fz, 1.15);
    addLight(fx, y + 0.8, fz, family.light.torch, 9.5, 1.35); emit(fx, y + 0.9, fz, family.light.torch, 4.2, 11, true);
    sconces.push([x, z]);
  };

  const addLamp = (x, z, ox, oz, y = 2.55) => {                 // facility: a caged wall lamp, cold white-cyan (sometimes amber)
    const ch = chunkAtW(x, z), rot = Math.atan2(ox, oz), warm = h2(Math.round(x * 2), Math.round(z * 2), 15) < 0.28, hex = warm ? '#ffb050' : '#8fe8ff';
    local((P) => { P.box(0.78, 0.34, 0.24, { pos: [0, y, 0.12], mat: 'iron', bevel: 0.03 }); P.box(0.1, 0.9, 0.1, { pos: [-0.3, y, 0.06], mat: 'iron' }); P.box(0.1, 0.9, 0.1, { pos: [0.3, y, 0.06], mat: 'iron' }); }, ch, x, z, rot);
    local((P) => { P.box(0.6, 0.17, 0.06, { pos: [0, y, 0.26], mat: warm ? 'ember' : 'crystal' }); }, ch, x, z, rot, true);
    const fx = x + ox * 0.5, fz = z + oz * 0.5;
    (warm ? halos.warm : halos.cool).push(fx, y, fz); addLight(fx, y, fz, hex, 9.5, 1.25); emit(fx, y, fz, hex, 3.6, 10.5, false);
    sconces.push([x, z]);
  };
  const mount = S.torches ? addTorch : S.lamps ? addLamp : null;

  for (const p of content.props) {
    const ch = chunkAtW(p.x, p.z), r = p.rot ?? 0, sc = p.scale ?? 1;
    switch (p.kind) {
      case 'd_pillar': if (!kitAdd(ch, 'dungeon/pillar', p.x, 0, p.z, 0, 0.78)) local(paintPillar, ch, p.x, p.z, 0); break;
      case 'sarcophagus': if (h2(Math.round(p.x), Math.round(p.z), 8) < 0.45 && kitAdd(ch, 'graveyard/coffin', p.x, 0, p.z, r, 0.72)) break; local(paintSarcophagus, ch, p.x, p.z, r); break;
      case 'urn': { const key = pick(S.clutter.length ? S.clutter : ['dungeon/barrel_small'], h2(Math.round(p.x * 3), Math.round(p.z * 3), 9)); if (!kitAdd(ch, key, p.x, 0, p.z, r, key.includes('keg') ? 0.55 : 0.95)) local(paintBarrel, ch, p.x, p.z, r); break; }
      case 'brazier': local(paintBrazier, ch, p.x, p.z, 0); flame(p.x, 1.45, p.z, 1.6); break;
      case 'crystal_cluster': local((P) => { for (let i = 0; i < 4; i++) P.ico(0.4 * sc, 0, { pos: [Math.sin(i * 1.7) * 0.55 * sc, 0.55 * sc * (1 - i * 0.1), Math.cos(i * 1.7) * 0.55 * sc], scale: [0.5, 1.7 + (i % 2) * 0.7, 0.5], rot: [0.25 * i, i, 0.22], mat: 'crystal' }); }, ch, p.x, p.z, r, true); halos.cool.push(p.x, 0.9 * sc, p.z); addLight(p.x, 0.9 * sc, p.z, '#5fd8ff', 6 * sc, 1.05); break;
      case 'stalagmite': local((P) => { P.cone(0.55 * sc, 1.9 * sc, 6, { pos: [0, 0.95 * sc, 0], mat: 'caveViolet', pat: PAT.rock }); P.cone(0.3 * sc, 1.0 * sc, 5, { pos: [0.5 * sc, 0.5 * sc, 0.2 * sc], mat: 'caveRock', pat: PAT.rock }); }, ch, p.x, p.z, r); break;
      case 'mushroom': local((P) => { P.cyl(0.07, 0.1, 0.5, 5, { pos: [0, 0.25, 0], mat: 'bone' }); }, ch, p.x, p.z, r); local((P) => { P.sphere(0.32, 8, 5, { pos: [0, 0.55, 0], scale: [1, 0.55, 1], mat: 'mushGlow' }); }, ch, p.x, p.z, r, true); halos.green.push(p.x, 0.6, p.z); addLight(p.x, 0.6, p.z, '#6dffaa', 3.6, 0.7); break;
      case 'machine': local((P) => { P.box(1.7, 2.1, 1.3, { pos: [0, 1.05, 0], mat: 'iron', pat: PAT.stone, tile: 0.8, bevel: 0.05 }); P.cyl(0.46, 0.46, 0.3, 10, { pos: [0, 1.5, 0.7], rot: [PI / 2, 0, 0], mat: 'brass' }); P.box(1.4, 0.16, 0.3, { pos: [0, 2.2, 0], mat: 'soot' }); }, ch, p.x, p.z, r); local((P) => { P.box(0.9, 0.22, 0.06, { pos: [0, 1.9, 0.66], mat: 'ember' }); }, ch, p.x, p.z, r, true); addLight(p.x, 1.6, p.z, '#ffb050', 4.5, 0.7); break;
      case 'console': local((P) => { P.box(1.5, 0.95, 0.8, { pos: [0, 0.48, 0], mat: 'ironLight', pat: PAT.stone, tile: 0.8, bevel: 0.04 }); P.box(1.4, 0.12, 0.8, { pos: [0, 1.03, 0], rot: [-0.45, 0, 0], mat: 'iron' }); }, ch, p.x, p.z, r); local((P) => { P.box(1.0, 0.05, 0.42, { pos: [0, 1.1, 0.0], rot: [-0.45, 0, 0], mat: 'crystal' }); }, ch, p.x, p.z, r, true); addLight(p.x, 1.2, p.z, '#7fe3ff', 4, 0.7); break;
      case 'cargo': if (!kitAdd(ch, pick(['dungeon/crates_stacked', 'dungeon/box_large', 'dungeon/box_stacked'], h2(Math.round(p.x), Math.round(p.z), 10)), p.x, 0, p.z, r, 0.95)) local((P) => { P.box(1.3, 1.1, 1.3, { pos: [0, 0.55, 0], mat: 'woodDark', pat: PAT.plank }); }, ch, p.x, p.z, r); break;
      case 'lamp_post': local((P) => { P.cyl(0.07, 0.1, 2.6, 5, { pos: [0, 1.3, 0], mat: 'iron' }); P.box(0.4, 0.12, 0.4, { pos: [0, 2.6, 0], mat: 'iron' }); }, ch, p.x, p.z, r); local((P) => { P.sphere(0.24, 8, 6, { pos: [0, 2.82, 0], mat: 'glowWarm' }); }, ch, p.x, p.z, r, true); halos.cool.push(p.x, 2.8, p.z); addLight(p.x, 2.8, p.z, family.light.torch, 8, 1.0); break;
      default: break;
    }
  }
  for (const l of content.lights) { addLight(l.x, 1.7, l.z, l.color, l.range * 0.95, 0.85 * (l.intensity / 5)); emit(l.x, 2.2, l.z, l.color, l.intensity, l.range, l.flicker); }

  // ── wall dressing: torches, banners, strips, shelves — only on flat stretches of wall
  const reserved = new Set(), mark = (x, z, r = 1) => { const tx = Math.floor(x / TILE), ty = Math.floor(z / TILE); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) reserved.add((ty + dy) * W + tx + dx); };
  for (const k of ['chests', 'shrines', 'lore', 'puzzles', 'objects', 'secretCaches']) for (const o of content[k] ?? []) mark(o.x, o.z, 1);
  for (const o of [content.entrance, content.exit, content.boss]) if (o) mark(o.x, o.z, 1);
  for (const d of runtimeDoors) for (const [x, y] of d.cells) { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) reserved.add((y + dy) * W + x + dx); }
  const faces = [], allFaces = [];                                   // wall faces looking at open floor: the flat stretches (mounts) and every one (boulders)
  for (let ty = 0; ty < HH; ty++) for (let tx = 0; tx < W; tx++) {
    if (ring[ty * W + tx] !== 1 || map.get(tx, ty) !== T.WALL) continue;
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIRS[d], nx = tx + dx, ny = ty + dy; if (map.get(nx, ny) !== T.FLOOR || reserved.has(ny * W + nx)) continue;
      const ax = d < 2 ? 1 : 0, ay = d < 2 ? 0 : 1, flat = (s) => map.get(tx + ax * s, ty + ay * s) === T.WALL && map.get(tx + ax * s + dx, ty + ay * s + dy) === T.FLOOR;
      const fx = d === 3 ? (tx + 1) * TILE : d === 2 ? tx * TILE : (tx + 0.5) * TILE, fz = d === 1 ? (ty + 1) * TILE : d === 0 ? ty * TILE : (ty + 0.5) * TILE;
      const f = { tx, ty, d, x: fx, z: fz, ox: dx, oz: dy, room: roomAt(nx, ny) };
      allFaces.push(f); if (flat(-1) && flat(1)) faces.push(f);
    }
  }
  const spaced = (x, z, r) => !sconces.some(([a, b]) => Math.hypot(a - x, b - z) < r) && !lights.some((l) => Math.hypot(l.x - x, l.z - z) < r * 0.6);
  const order = [...faces].sort((a, b) => h2(a.tx, a.ty, 11 + a.d) - h2(b.tx, b.ty, 11 + b.d));
  let torchCount = 0;
  if (mount) for (const f of order) { if (torchCount >= 160) break; if (!spaced(f.x, f.z, f.room?.node?.type === 'boss' || f.room?.node?.type === 'shrine' ? 6.5 : 10.5)) continue; mount(f.x, f.z, f.ox, f.oz); torchCount++; }
  // torches flanking every doorway
  if (mount) for (const d of runtimeDoors) {
    if (d.kind === 'secret') continue;
    const { spanX, span } = orient(d);
    for (const sg of [-1, 1]) { const x = d.x + (spanX ? sg * span / 2 : 0), z = d.z + (spanX ? 0 : sg * span / 2); mount(x, z, spanX ? -sg : 0, spanX ? 0 : -sg, S.torches ? 2.0 : 2.55); }
  }
  if (S.banners) {
    const per = new Map(), kinds = ['banner_red', 'banner_blue', 'banner_white', 'banner_shield_red', 'banner_patternA_red', 'banner_thin_red'];
    for (const f of order) {
      const ty = f.room?.node?.type; if (!['boss', 'shrine', 'treasure', 'entrance', 'exit', 'puzzle', 'wave_arena'].includes(ty)) continue;
      const n = per.get(f.room) ?? 0; if (n >= (ty === 'boss' ? 4 : 2)) continue;
      if (sconces.some(([a, b]) => Math.hypot(a - f.x, b - f.z) < 2.6) || (per.get(`${f.room}p`) ?? []).some(([a, b]) => Math.hypot(a - f.x, b - f.z) < 7)) continue;
      const key = pick(kinds, h2(f.tx, f.ty, 12)), shield = key.includes('shield');
      if (kitAdd(chunkAtW(f.x, f.z), `dungeon/${key}`, f.x - f.ox * 0.36, shield ? 0.45 : 0.1, f.z - f.oz * 0.36, Math.atan2(f.ox, f.oz), shield ? 0.85 : 0.82)) { per.set(f.room, n + 1); const l = per.get(`${f.room}p`) ?? []; l.push([f.x, f.z]); per.set(`${f.room}p`, l); }
    }
  }
  if (S.strips) for (const f of order) {                           // glowing seams on the facility walls
    if (h2(f.tx, f.ty, 13) > 0.22 || sconces.some(([a, b]) => Math.hypot(a - f.x, b - f.z) < 4)) continue;
    const ch = chunkAtW(f.x, f.z), len = 1.7, rot = Math.atan2(f.ox, f.oz), hex = h2(f.tx, f.ty, 14) < 0.7 ? '#7fe3ff' : '#ffb050';
    const P = new Paint(); P.box(len, 0.14, 0.06, { pos: [0, 2.35, 0.03], mat: hex === '#7fe3ff' ? 'crystal' : 'ember' }); ch.glow.merge(P, [f.x, 0, f.z], rot);
    addLight(f.x + f.ox * 0.4, 2.35, f.z + f.oz * 0.4, hex, 6.5, 0.8); (hex === '#7fe3ff' ? halos.cool : halos.warm).push(f.x + f.ox * 0.25, 2.35, f.z + f.oz * 0.25);
  }
  if (S.boulders) for (const f of allFaces) {                        // rock piles at the foot of cave walls break the straight tile edges
    if (h2(f.tx, f.ty, 16 + f.d) > 0.34) continue;
    const rr = new Rng(`${dungeon.seed}:boulder:${f.tx}:${f.ty}:${f.d}`), rad = rr.range(0.5, 1.0), along = rr.range(-0.7, 0.7), ax = f.d < 2 ? 1 : 0, az = 1 - ax;
    const x = f.x + f.ox * rad * 0.5 + ax * along, z = f.z + f.oz * rad * 0.5 + az * along, ch = chunkAtW(x, z), P = new Paint(), sw = rr.pick(['caveRock', 'caveViolet', 'caveDark']);
    P.ico(rad, 1, { pos: [0, rad * 0.4, 0], scale: [1, rr.range(0.55, 0.85), rr.range(0.8, 1.1)], rot: [rr.range(-0.2, 0.2), rr.range(0, 6.28), 0], mat: sw, pat: PAT.rock });
    if (rr.chance(0.55)) P.ico(rad * 0.55, 1, { pos: [(rr.chance(0.5) ? 1 : -1) * rad * 0.95, rad * 0.2, rad * 0.35], scale: [1, 0.7, 1], rot: [0, rr.range(0, 6.28), 0], mat: rr.pick(['caveRock', 'caveDark']), pat: PAT.rock });
    ch.props.merge(P, [x, 0, z], 0);
  }
  { // bones and clutter along the walls of rooms
    const edge = new Map();
    for (const f of order) { const k = f.room; if (!k) continue; const a = edge.get(k) ?? []; a.push(f); edge.set(k, a); }
    for (const [rm, list] of edge) {
      const ty = rm.node?.type; if (['entrance', 'exit'].includes(ty)) continue;
      const n = Math.min(list.length, Math.max(1, Math.round(list.length / 9))), r = new Rng(`${dungeon.seed}:clutter:${rm.region}`);
      for (let i = 0; i < n; i++) {
        const f = r.pick(list); if (sconces.some(([a, b]) => Math.hypot(a - f.x, b - f.z) < 1.8)) continue;
        const x = f.x + f.ox * 0.62, z = f.z + f.oz * 0.62, ch = chunkAtW(x, z), rot = r.range(0, 6.28);
        if (S.clutter.length && r.chance(0.5)) { kitAdd(ch, r.pick(S.clutter), x, 0, z, rot, 0.9); if (r.chance(0.5)) kitAdd(ch, r.pick(S.clutter), x + f.oz * 0.9 + f.ox * 0.2, 0, z + f.ox * 0.9 + f.oz * 0.2, r.range(0, 6.28), 0.78); }
        else if (S.bones) { const b = r.pick(['graveyard/bone_A', 'graveyard/bone_B', 'graveyard/bone_C', 'graveyard/skull', 'graveyard/ribcage']); kitAdd(ch, b, x, 0.04, z, rot, b.includes('skull') ? 0.5 : 0.9); if (r.chance(0.5)) kitAdd(ch, 'graveyard/bone_B', x + r.range(-0.5, 0.5), 0.04, z + r.range(-0.5, 0.5), r.range(0, 6.28), 0.9); }
      }
    }
  }

  // ═════════════════════════════════════════════ bake lighting + build meshes
  const solidNear = (x, z) => {                                     // metres from a floor point to the nearest solid tile (capped)
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE); let best = 2.4;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!solid(tx + dx, tz + dz)) continue;
      const rx = (tx + dx) * TILE, rz = (tz + dz) * TILE, ex = Math.max(rx - x, 0, x - rx - TILE), ez = Math.max(rz - z, 0, z - rz - TILE);
      best = Math.min(best, Math.hypot(ex, ez));
    }
    return best;
  };
  const GAIN = 2.4;
  /** multiplies a geometry's vertex colours by: stains/patina (smooth noise), ambient occlusion and every baked light around it */
  const bake = (geo, near, mode) => {
    const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, n = pos.length / 3;
    let ca = geo.attributes.color; if (!ca) { ca = new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3); geo.setAttribute('color', ca); }
    const c = ca.array;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], nx = nor[i * 3], ny = nor[i * 3 + 1], nz = nor[i * 3 + 2];
      let r = 1, g = 1, b = 1, m = 1;
      if (mode === 'floor') m = S.pat === PAT.rock ? 0.74 + 0.42 * vn(x * 0.14, z * 0.14, 41) + 0.12 * (vn(x * 0.8, z * 0.8, 42) - 0.5) : 0.88 + 0.24 * vn(x * 0.17, z * 0.17, 41) + 0.07 * (vn(x * 0.9, z * 0.9, 42) - 0.5);
      else if (mode === 'wall') {
        m = 0.86 + 0.28 * vn((x + z) * 0.2, y * 0.4, 43);
        if (S.moss && y < 1.7) { const k = smooth(0.56, 0.78, vn((x + z) * 0.3, 7, 44)) * (1 - y / 1.7); r *= 1 - 0.2 * k; g *= 1 + 0.05 * k; b *= 1 - 0.32 * k; }
      }
      for (let j = 0; j < near.length; j++) {
        const l = near[j], dx = l.x - x, dy = l.y - y, dz = l.z - z, d2 = dx * dx + dy * dy + dz * dz; if (d2 >= l.range * l.range) continue;
        const d = Math.sqrt(d2), f = 1 - d / l.range, ndl = d > 0.05 ? Math.max(0, (nx * dx + ny * dy + nz * dz) / d) : 1, k = GAIN * l.power * f * f * (0.3 + 0.7 * ndl);
        r += l.r * k; g += l.g * k; b += l.b * k;
      }
      if (mode === 'floor' && ny > 0.9 && y < 0.2) m *= 0.52 + 0.48 * smooth(0, 2.2, solidNear(x, z));
      c[i * 3] *= r * m; c[i * 3 + 1] *= g * m; c[i * 3 + 2] *= b * m;
    }
  };
  const nearLights = (cx, cy) => { const x0 = cx * CH * TILE, z0 = cy * CH * TILE, x1 = x0 + CH * TILE, z1 = z0 + CH * TILE; return lights.filter((l) => l.x > x0 - l.range && l.x < x1 + l.range && l.z > z0 - l.range && l.z < z1 + l.range); };

  const matStone = paintMaterial({ vc: true, cloud: false, rough: 0.92 }), matProp = paintMaterial({ vc: true, cloud: false }), matGlow = glowPaintMaterial(2.4);
  const mk = (P, material, cast, receive, name) => { if (!P.count) return null; const geo = P.build(); return { geo, mesh: Object.assign(new THREE.Mesh(geo, material), { castShadow: cast, receiveShadow: receive, name }) }; };
  for (const ch of chunks.values()) {
    const near = nearLights(ch.cx, ch.cy);
    const fl = mk(ch.floor, matStone, false, true, 'floor'); if (fl) { bake(fl.geo, near, 'floor'); root.add(fl.mesh); }
    const wl = mk(ch.wall, matStone, true, true, 'wall'); if (wl) { bake(wl.geo, near, 'wall'); root.add(wl.mesh); }
    const pr = mk(ch.props, matProp, true, true, 'props'); if (pr) { bake(pr.geo, near, 'prop'); root.add(pr.mesh); }
    const gl = mk(ch.glow, matGlow, false, false, 'glow'); if (gl) root.add(gl.mesh);
    for (const [group, list] of ch.kit) {
      const mat = wa.material(group, 'base', { vertexColors: true, cloud: false }); if (!mat) continue;
      const geos = list.map(({ geo, m }) => { const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m); return g; });
      const merged = mergeGeometries(geos, false); for (const g of geos) g.dispose(); if (!merged) continue;
      merged.computeBoundingSphere(); bake(merged, near, 'kit');
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = `kit_${group}`; root.add(mesh);
    }
  }
  // secret walls: their own meshes so they can disappear
  for (const [id, P] of secretP) { const m = mk(P, matStone, true, true, 'secret'); if (!m) continue; bake(m.geo, lights.filter((l) => Math.hypot(l.x - m.geo.boundingSphere.center.x, l.z - m.geo.boundingSphere.center.z) < l.range + 6), 'wall'); root.add(m.mesh); secretP.set(id, m.mesh); }

  // ── flames (one instanced mesh) + halos (additive points)
  let flameMesh = null;
  if (flames.length) {
    const g = new THREE.ConeGeometry(0.17, 0.62, 7); g.translate(0, 0.31, 0);
    flameMesh = new THREE.InstancedMesh(g, glowMaterial('#ffb24a', 3.6, { body: '#ffd27a' }), flames.length); flameMesh.frustumCulled = false; flameMesh.name = 'flames'; root.add(flameMesh);
  }
  const haloTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const haloMats = [];
  for (const [kind, size, hex, op] of [['warm', 14, '#ff9a3c', 0.46], ['cool', 9, '#46d2ff', 0.34], ['green', 6, '#5dffa0', 0.34]]) {
    const arr = halos[kind]; if (!arr.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: true, map: haloTex, color: hex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    m.userData.base = size; haloMats.push(m);
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; root.add(pts);
  }

  // ── dust motes drifting in the light, anchored to the world around the player
  const MOTES = 72, MOTE_L = 30, moteBase = new Float32Array(MOTES * 3), motePos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) { moteBase[i * 3] = rng.next() * MOTE_L; moteBase[i * 3 + 1] = 0.3 + rng.next() * 4.4; moteBase[i * 3 + 2] = rng.next() * MOTE_L; }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ size: 0.6, sizeAttenuation: true, map: haloTex, color: '#ffe2b8', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const motes = new THREE.Points(moteGeo, moteMat); motes.frustumCulled = false; motes.renderOrder = 6; root.add(motes);

  // ── room emblems (glowing floor rings) for boss / shrine / arena
  for (const rm of dungeon.rooms.values()) {
    const ty = rm.node?.type; if (!['boss', 'shrine', 'wave_arena'].includes(ty)) continue;
    const r = Math.min(rm.w, rm.h) * TILE * 0.32, col = ty === 'boss' ? '#ff6a4a' : ty === 'shrine' ? '#7fe3ff' : '#ffb050';
    const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const a = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 48), ringMat); a.rotation.x = -PI / 2; a.position.set((rm.cx + 0.5) * TILE, 0.04, (rm.cy + 0.5) * TILE); root.add(a);
    const b = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r * 0.6, 48), ringMat); b.rotation.x = -PI / 2; b.position.copy(a.position); root.add(b);
  }

  // ═════════════════════════════════════════════ doors
  const door = (d) => {
    const g = new THREE.Group(), { spanX, span } = orient(d);
    g.position.set(d.x, 0, d.z); g.rotation.y = spanX ? 0 : PI / 2;
    const kind = d.kind, P = new Paint();
    if (kind !== 'secret' && (family.rules.doorStyle !== 'none' || d.type === T.LOCK)) {      // lintel bridge over the opening
      const w = span + 1.5;
      P.box(w, 0.72, 1.2, { pos: [0, 3.2, 0], mat: S.door, pat: S.pat, tile: S.wallTile, bevel: 0.05 });
      P.box(w + 0.36, 0.2, 1.4, { pos: [0, 3.66, 0], mat: S.cap, pat: S.pat, tile: S.capTile });
      P.box(span * 0.92, 0.12, 1.26, { pos: [0, 2.78, 0], mat: S.trim });
      P.box(0.9, 0.95, 1.3, { pos: [0, 3.1, 0], mat: 'limestoneLight', pat: S.pat, bevel: 0.05 });
      for (const sg of [-1, 1]) P.box(0.5, 3.6, 1.1, { pos: [sg * (span / 2 + 0.55), 1.8, 0], mat: S.door, pat: S.pat, tile: S.wallTile });
    }
    if (P.count) { const fm = new THREE.Mesh(P.build(), paintMaterial({ cloud: false })); fm.castShadow = true; fm.receiveShadow = true; g.add(fm); }
    if (d.type === T.LOCK) {
      const B = new Paint(), n = Math.max(3, Math.round(span / 0.45));
      for (let i = 0; i < n; i++) B.cyl(0.07, 0.07, 3.0, 6, { pos: [-span / 2 + 0.3 + i * (span - 0.6) / (n - 1), 1.5, 0], mat: 'ironLight' });
      B.box(span, 0.2, 0.22, { pos: [0, 3.0, 0], mat: 'iron' }); B.box(span, 0.2, 0.22, { pos: [0, 0.45, 0], mat: 'iron' }); B.box(span, 0.14, 0.2, { pos: [0, 1.7, 0], mat: 'iron' });
      B.box(0.5, 0.6, 0.3, { pos: [0, 1.6, 0.1], mat: 'brass', bevel: 0.05 });
      const bars = new THREE.Mesh(B.build(), paintMaterial({ cloud: false })); bars.castShadow = true; g.add(bars); out.doorViews.set(d.id, { g, bars });
    } else if (kind === 'shortcut' || d.type === T.ONEWAY) {
      const B = new Paint();
      for (let i = 0; i < 5; i++) B.box(span, 0.38, 0.2, { pos: [0, 0.3 + i * 0.52, 0.05 * (i % 2)], rot: [0, 0, (i % 2 ? 1 : -1) * 0.04], mat: 'wood', pat: PAT.plank });
      B.box(0.22, 3.0, 0.34, { pos: [-span / 2 + 0.2, 1.5, 0], mat: 'woodDark' }); B.box(0.22, 3.0, 0.34, { pos: [span / 2 - 0.2, 1.5, 0], mat: 'woodDark' });
      const pl = new THREE.Mesh(B.build(), paintMaterial({ cloud: false })); pl.castShadow = true; g.add(pl); out.doorViews.set(d.id, { g, bars: pl });
    } else if (kind === 'secret') {
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.9, 2.4), new THREE.MeshBasicMaterial({ color: '#b79cff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      seam.position.set(0, 1.4, 0); g.add(seam); out.doorViews.set(d.id, { g, seam, secret: true });
    }
    root.add(g);
  };
  for (const d of runtimeDoors) door(d);

  out.openDoor = (d) => {
    const v = out.doorViews.get(d.id), sm = secretP.get(d.id);
    if (sm?.isObject3D) sm.visible = false;
    if (v) { v.opening = 0; v.open = true; }
  };

  // ═════════════════════════════════════════════ per-frame
  const q0 = new THREE.Quaternion(), p0 = new THREE.Vector3(), s0 = new THREE.Vector3();
  out.update = (t, focus) => {
    if (flameMesh) {
      const fx = focus?.x ?? 0, fz = focus?.z ?? 0, near2 = 46 * 46;
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i]; if (focus && (f.x - fx) ** 2 + (f.z - fz) ** 2 > near2) continue;
        const k = 1 + Math.sin(t * 11 + f.ph) * 0.2 + Math.sin(t * 17.3 + f.ph * 2) * 0.08, w = 1 + Math.sin(t * 8.3 + f.ph * 1.7) * 0.1;
        m4.compose(p0.set(f.x, f.y, f.z), q0, s0.set(f.s * w, f.s * k, f.s * w)); flameMesh.setMatrixAt(i, m4);
      }
      flameMesh.instanceMatrix.needsUpdate = true;
    }
    for (const m of haloMats) m.size = m.userData.base * (1 + Math.sin(t * 7.1) * 0.025);
    if (focus) {
      const wrap = (v) => ((v % MOTE_L) + MOTE_L) % MOTE_L, fx = focus.x - MOTE_L / 2, fz = focus.z - MOTE_L / 2;
      for (let i = 0; i < MOTES; i++) {
        motePos[i * 3] = fx + wrap(moteBase[i * 3] + t * (0.1 + 0.06 * Math.sin(i * 2.3)) - fx);
        motePos[i * 3 + 1] = moteBase[i * 3 + 1] + Math.sin(t * 0.6 + i) * 0.3;
        motePos[i * 3 + 2] = fz + wrap(moteBase[i * 3 + 2] + t * 0.06 * Math.cos(i * 1.7) - fz);
      }
      moteGeo.attributes.position.needsUpdate = true;
    }
    for (const v of out.doorViews.values()) {
      if (v.secret && v.seam) v.seam.material.opacity += ((v.revealed ? 0.55 + Math.sin(t * 4) * 0.2 : 0) - v.seam.material.opacity) * 0.15;
      if (v.open && v.bars && v.opening !== undefined) { v.opening = Math.min(1, v.opening + 0.03); v.bars.position.y = v.opening * 3.2; if (v.opening >= 1) v.bars.visible = false; }
    }
  };
  out.dispose = () => { disposeTree(root); haloTex.dispose(); moteGeo.dispose(); moteMat.dispose(); for (const m of haloMats) m.dispose(); };
  return out;
}

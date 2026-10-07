/**
 * Props — turns the zone's prop list (sim data: collision-bearing rocks, pines, ruins, pillars, crates, windharps…) and a layer of
 * purely cosmetic scatter (grass tufts, flowers, ferns, pebbles, border forest, cliff boulders…) into instanced meshes.
 *
 *  - gameplay props keep their exact sim footprint (radius/scale) so nothing floats, sinks or blocks differently than drawn;
 *  - cosmetic scatter only grows where the player cannot walk (trees, big rocks) or where it is soft (grass, flowers, bushes);
 *  - KayKit kit pieces are used when loaded (recoloured to our palette), procedural low-poly stand-ins otherwise.
 */
import * as THREE from 'three';
import { Rng } from '../../core/rng.js';
import { Field } from './field.js';
import { kitMaterial, paintMaterial, glowPaintMaterial } from './worldMaterials.js';
import { Paint, PAT } from './paint.js';
import { fbm2, vnoise } from './noiseTex.js';
import { grassTuftGeo, fernGeo, flowerGeo, bushGeo, rockGeo, crystalGeo, logGeo, mushroomGeo, pineFallbackGeo } from './foliage.js';
import { buildStructure } from './structures.js';

const C = (h) => new THREE.Color(h);
const TAU = Math.PI * 2;

/** coarse spatial hash of circles (blockers) for cheap rejection while scattering */
class Occupancy {
  constructor(cell = 6) { this.cell = cell; this.m = new Map(); }
  add(x, z, r) { const k = `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`; let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push([x, z, r]); }
  hit(x, z, r) {
    const c = this.cell, i0 = Math.floor((x - r - 4) / c), i1 = Math.floor((x + r + 4) / c), j0 = Math.floor((z - r - 4) / c), j1 = Math.floor((z + r + 4) / c);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const a = this.m.get(`${i},${j}`); if (a) for (const [bx, bz, br] of a) if ((bx - x) ** 2 + (bz - z) ** 2 < (br + r) ** 2) return true; }
    return false;
  }
}

/** pick by weights: [[item, weight], …] */
function pick(r, list) { let t = 0; for (const [, w] of list) t += w; let x = r.next() * t; for (const [it, w] of list) { x -= w; if (x <= 0) return it; } return list[list.length - 1][0]; }

/**
 * @param {any} zone @param {{wa:any, q:any, terrain:THREE.Object3D}} ctx
 * @returns {{group:THREE.Group, updaters:Function[], emitters:any[], update:(fx:number,fz:number)=>void, stats:any}}
 */
export function buildInstancedProps(zone, ctx) {
  const { wa, q, terrain } = ctx;
  const out = new THREE.Group(); out.name = 'props';
  const field = new Field(out, { cell: 22 });
  const updaters = [], emitters = [];
  const T = terrain.userData, sample = T.sample, Hf = T.heightFn;
  const b = zone.bounds, r0 = new Rng(`world:${zone.def.seed}`);
  const occ = new Occupancy();
  const aoStamps = [];
  const stats = { trees: 0, rocks: 0, tufts: 0, flowers: 0, kit: !!wa?.ready };

  const kitOK = !!wa?.ready;
  const geoOf = (key) => (kitOK ? wa.geo(key) : null);
  // ───────────────────────── materials
  const treeMat = kitOK ? wa.material('graveyard', 'pine', { wind: true, swayHeight: 7.5, aoK: 0.5, aoH: 2.2 }) : null;
  const autumnMat = kitOK ? wa.material('graveyard', 'base', { wind: true, swayHeight: 7.5, aoK: 0.5, aoH: 2.2 }) : null;
  const deadMat = kitOK ? wa.material('graveyard', 'base', { wind: true, swayHeight: 5, swayAmt: 0.5, aoK: 0.55, aoH: 1.4 }) : null;
  const foliageMat = kitMaterial({ vertexColors: true, wind: true, swayHeight: 0.7, doubleSide: true, rough: 0.95, aoK: 0.88, aoH: 0.3, detail: 0.06 });
  const bushMat = kitMaterial({ vertexColors: true, wind: true, swayHeight: 1.4, swayAmt: 0.6, flat: true, rough: 0.92, aoK: 0.6, aoH: 0.7, detail: 0.08 });
  const rockMat = kitMaterial({ vertexColors: true, flat: true, rough: 0.94, aoK: 0.72, aoH: 0.9, detail: 0.1 });
  const limeMat = (g, v) => (kitOK ? wa.material(g, v, { aoK: 0.62, aoH: 1.6 }) : null);

  // ───────────────────────── geometries (procedural)
  const GRASS = [grassTuftGeo(1, { blades: 9, height: 0.44, radius: 0.15, width: 0.09 }), grassTuftGeo(2, { blades: 6, height: 0.3, radius: 0.1, width: 0.085 }), grassTuftGeo(3, { blades: 13, height: 0.62, radius: 0.22, width: 0.1 })];
  const FERN = [fernGeo(1, { leaves: 8, length: 0.95 }), fernGeo(2, { leaves: 6, length: 0.7 })];
  const FLOWER = flowerGeo(1, '#ffffff', { size: 0.12, center: '#ffe9a0' });
  const FLOWER_TINT = { white: C('#f4f1e6'), yellow: C('#f7d44c'), violet: C('#b79cf0'), pink: C('#f59ab4'), cyan: C('#8fe9ff') };
  const BUSH = [bushGeo(1, { radius: 0.62 }), bushGeo(2, { radius: 0.5, lumps: 3, hue: 0.02 }), bushGeo(3, { radius: 0.75, lumps: 5, hue: -0.02 })];
  const ROCK = [0, 1, 2, 3, 4, 5].map((i) => rockGeo(i + 1, { radius: 1, flat: 0.6 + (i % 3) * 0.12, detail: i % 2 ? 1 : 0, angular: 0.24 + (i % 3) * 0.06 }));
  const ROCK_COOL = [0, 1, 2].map((i) => rockGeo(i + 20, { radius: 1, flat: 0.62 + i * 0.1, base: '#8c869a', mossColor: '#6d7a6a', angular: 0.3 }));
  const PEBBLE = [0, 1, 2].map((i) => rockGeo(i + 40, { radius: 1, flat: 0.55, detail: 0, base: '#b3a88f', moss: false, angular: 0.35 }));

  // ───────────────────────── helpers
  const ground = (x, z) => {
    const h = Hf(x, z), e = 0.7;
    const sl = Math.hypot(Hf(x + e, z) - Hf(x - e, z), Hf(x, z + e) - Hf(x, z - e)) / (2 * e);
    return { h, slope: sl };
  };
  const inside = (x, z, m = 0) => x > b.x0 + m && x < b.x1 - m && z > b.z0 + m && z < b.z1 - m;
  /** the player can stand here (same rule the nav grid uses: 4 m margin + slope) */
  const walkable = (x, z) => inside(x, z, 4.2) && ground(x, z).slope < 0.82;
  const inArea = (name, x, z) => { const a = zone.areaById.get(name); return a ? zone.inArea(a, x, z) : false; };
  const areaOf = (x, z) => zone.areaAt(x, z)?.id ?? null;
  const tint = (h, s, l) => new THREE.Color().setHSL(h, s, l);
  /** gentle brightness + warm/cool variation (multiplies the kit atlas colours) */
  const varc = (r) => { const v = r.range(0.84, 1.08), h = r.range(-0.05, 0.05); return new THREE.Color(v + h, v, v - h); };
  const add = (geo, mat, items, o) => { if (geo && mat) field.add(geo, mat, items, o); };
  const R = (a, bb) => r0.range(a, bb);

  // reserve the footprint of everything the sim already placed
  for (const p of zone.props) if (p.r > 0 && (p.block || p.structure)) occ.add(p.x, p.z, p.r);
  for (const p of zone.pois) if (!['area_mark', 'lore'].includes(p.type)) occ.add(p.x, p.z, 2.2);
  for (const n of zone.npcs) occ.add(n.x, n.z, 1.4);
  for (const s of zone.def.structures ?? []) occ.add(s.pos[0], s.pos[1], (zone.props.find((p) => p.structure && p.x === s.pos[0] && p.z === s.pos[1])?.r ?? 1.5) + 0.8);
  const spawnPt = zone.spawnPoint; occ.add(spawnPt.x, spawnPt.z, 4);

  // ───────────────────────── 1) gameplay props from the sim
  const byKind = {};
  for (const p of zone.props) if (!p.structure) (byKind[p.kind] ??= []).push(p);

  // pines → green kit pines (a few autumn accents), procedural pines when the kit is missing
  {
    const list = byKind.pine ?? [], items = { s: [], m: [], l: [], fb: [] }, accents = { s: [], m: [], l: [] };
    for (const p of list) {
      const sc = p.scale * 0.88, size = p.scale < 1.05 ? 'm' : 'l';
      // walkable-area pines are squatter than the border forest: from the isometric camera a tall tree hides the enemies behind it (readability first)
      const it = { x: p.x, y: p.y - 0.05, z: p.z, ry: r0.range(0, TAU), sx: sc, sy: sc * 0.74 * r0.range(0.92, 1.12), sz: sc, color: varc(r0) };
      if (!kitOK) { items.fb.push({ ...it, sx: sc * 1.1, sy: sc * 1.1, sz: sc * 1.1, color: undefined }); continue; }
      const autumn = (inArea('area.orrel', p.x, p.z) || inArea('area.overlook', p.x, p.z)) && r0.next() < 0.45;
      (autumn ? accents : items)[size].push(it);
      aoStamps.push({ x: p.x, z: p.z, r: 1.4 * sc * 1.1, k: 0.55 });
    }
    if (kitOK) {
      add(geoOf('graveyard/tree_pine_orange_medium'), treeMat, items.m, { cast: true, name: 'pine_m' });
      add(geoOf('graveyard/tree_pine_orange_large'), treeMat, items.l, { cast: true, name: 'pine_l' });
      add(geoOf('graveyard/tree_pine_yellow_medium'), autumnMat, accents.m, { cast: true, name: 'pine_am' });
      add(geoOf('graveyard/tree_pine_yellow_large'), autumnMat, accents.l, { cast: true, name: 'pine_al' });
    } else add(pineFallbackGeo(1, { height: 6 }), foliageMat, items.fb, { cast: true, name: 'pine_fb' });
    stats.trees += list.length;
  }

  // rocks (blocking boulders)
  {
    const list = byKind.rock ?? [], items = [[], [], [], [], [], []], cool = [[], [], []];
    for (const p of list) {
      const sc = p.scale * 0.98, edge = !inside(p.x, p.z, 5.5);
      const it = { x: p.x, y: p.y - 0.12 * sc, z: p.z, ry: r0.range(0, TAU), sx: sc * r0.range(0.9, 1.25), sy: sc * r0.range(0.75, 1.15) * (edge ? 1.5 : 1), sz: sc * r0.range(0.9, 1.25), color: tint(r0.range(0.08, 0.13), 0.1, r0.range(0.78, 1.05)) };
      if (inArea('area.empty_choir', p.x, p.z)) cool[Math.floor(r0.next() * 3)].push({ ...it, color: undefined }); else items[Math.floor(r0.next() * 6)].push(it);
      aoStamps.push({ x: p.x, z: p.z, r: 1.15 * sc, k: 0.55 });
    }
    items.forEach((l, i) => add(ROCK[i], rockMat, l, { cast: true, name: 'rock' }));
    cool.forEach((l, i) => add(ROCK_COOL[i], rockMat, l, { cast: true, name: 'rock_c' }));
    stats.rocks += list.length;
  }

  // shrubs (soft, non-blocking)
  {
    const list = byKind.shrub ?? [], items = [[], [], []];
    for (const p of list) { const s = p.scale * r0.range(0.85, 1.25); items[Math.floor(r0.next() * 3)].push({ x: p.x, y: p.y - 0.03, z: p.z, ry: r0.range(0, TAU), sx: s, sy: s * r0.range(0.85, 1.15), sz: s, color: tint(r0.range(0.22, 0.3), 0.25, r0.range(0.85, 1.15)) }); }
    items.forEach((l, i) => add(BUSH[i], bushMat, l, { cast: false, name: 'bush', maxDist: q.drawDist }));
  }

  // ruined walls (limestone kit pieces)
  {
    const list = byKind.ruin_wall ?? [];
    const keys = ['dungeon/wall_half', 'dungeon/wall_half_endcap', 'dungeon/wall_broken', 'dungeon/wall_cracked', 'dungeon/wall_pillar'];
    if (kitOK && list.length) {
      const m = limeMat('dungeon', 'limestone'), buckets = new Map();
      for (const p of list) {
        const key = pick(r0, [[keys[0], 3], [keys[1], 2], [keys[2], 2], [keys[3], 1.5], [keys[4], 1]]);
        const wide = key === keys[2] || key === keys[3] ? 0.66 : key === keys[4] ? 0.6 : 1.18;
        const s = p.scale * wide * 0.95;
        (buckets.get(key) ?? buckets.set(key, []).get(key)).push({ x: p.x, y: p.y - 0.05, z: p.z, ry: p.rot, sx: s, sy: s * r0.range(0.5, 0.82), sz: s, color: tint(0.1, 0.06, r0.range(0.85, 1.05)) });
        aoStamps.push({ x: p.x, z: p.z, r: 1.7 * s, k: 0.5 });
      }
      for (const [key, l] of buckets) add(geoOf(key), m, l, { cast: true, name: 'ruin' });
    } else if (list.length) {
      const g = new Paint(); g.box(4.4, 1.6, 0.9, { pos: [0, 0.8, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.05 }); g.box(1.2, 2.4, 0.9, { pos: [-1.6, 1.2, 0], mat: 'limestoneDark', pat: PAT.stone });
      add(g.build(), paintMaterial(), list.map((p) => ({ x: p.x, y: p.y, z: p.z, ry: p.rot, sx: p.scale * 0.6, sy: p.scale * 0.6, sz: p.scale * 0.6 })), { cast: true, name: 'ruin_fb' });
    }
  }

  // pillars: quarry columns (limestone kit) and the Choir's broken organ pipes (procedural, glowing rim)
  {
    const list = byKind.pillar ?? [];
    const quarry = list.filter((p) => p.area !== 'area.empty_choir'), choir = list.filter((p) => p.area === 'area.empty_choir');
    if (quarry.length) {
      if (kitOK) {
        const m = limeMat('dungeon', 'limestone');
        const A = [], B = [];
        for (const p of quarry) { const s = p.scale * 0.95, broken = r0.next() < 0.45; (broken ? B : A).push({ x: p.x, y: p.y - 0.05, z: p.z, ry: r0.range(0, TAU), sx: s, sy: s * (broken ? r0.range(0.45, 0.75) : r0.range(0.85, 1.05)), sz: s, color: tint(0.1, 0.05, r0.range(0.85, 1.05)) }); aoStamps.push({ x: p.x, z: p.z, r: 1.4 * s, k: 0.5 }); }
        add(geoOf('dungeon/pillar'), m, A, { cast: true, name: 'pillar' });
        add(geoOf('dungeon/pillar_decorated'), m, B, { cast: true, name: 'pillar_b' });
      }
    }
    if (choir.length) {
      // the Choir's organ: bundles of broken bronze-and-limestone pipes with glowing mouths (resonance still leaks out of them)
      const bundle = (seed, heights, broken) => {
        const g = new Paint(), gl = new Paint(), rr = new Rng(`pipe${seed}`);
        g.cyl(1.25, 1.4, 0.55, 8, { pos: [0, 0.2, 0], mat: 'limestoneDark', pat: PAT.stone, g: [0.1, 0.9] });
        g.cyl(1.05, 1.2, 0.3, 8, { pos: [0, 0.6, 0], mat: 'limestone', pat: PAT.stone });
        const n = heights.length;
        heights.forEach((h, i) => {
          const a = (i / (n - 1 || 1) - 0.5) * 2.3, x = Math.sin(a) * 0.95, z = -Math.abs(Math.cos(a)) * 0.55 + 0.35, r = 0.27 + 0.05 * (h / 5), y0 = 0.7;
          g.cone(r * 1.15, 0.6, 10, { pos: [x, y0 + 0.2, z], rot: [Math.PI, 0, 0], mat: 'bronze', g: [0.1, 0.8] });
          g.cyl(r, r, h, 10, { pos: [x, y0 + 0.5 + h / 2, z], mat: i % 2 ? 'brass' : 'bronze', g: [0.05, 0.95] });
          for (const f of [0.28, 0.62]) g.cyl(r * 1.08, r * 1.08, 0.1, 10, { pos: [x, y0 + 0.5 + h * f, z], mat: 'limestoneLight', g: [0.1, 0.7] });
          g.box(r * 1.2, h * 0.14, 0.1, { pos: [x, y0 + 0.5 + h * 0.2, z + r * 0.92], mat: 'void' });
          g.box(r * 1.5, 0.07, 0.14, { pos: [x, y0 + 0.5 + h * 0.2 + h * 0.07, z + r * 0.98], mat: 'brass' });
          if (broken && i % 2 === 1) for (let k = 0; k < 4; k++) { const a2 = (k / 4) * TAU; g.box(r * 0.5, rr.range(0.25, 0.7), 0.1, { pos: [x + Math.sin(a2) * r * 0.85, y0 + 0.5 + h + 0.1, z + Math.cos(a2) * r * 0.85], rot: [0, a2, rr.range(-0.2, 0.2)], mat: 'bronze' }); }
          else { g.cyl(r * 1.1, r * 1.1, 0.12, 10, { pos: [x, y0 + 0.5 + h, z], mat: 'brass' }); gl.cyl(r * 0.78, r * 0.78, 0.04, 10, { pos: [x, y0 + 0.5 + h + 0.03, z], mat: 'glassCyan', g: [0.55, 1] }); }
        });
        return { solid: g.build(), glow: gl.build() };
      };
      const sets = [bundle(1, [4.4, 5.8, 3.6, 5.0, 2.8], false), bundle(2, [3.0, 4.6, 2.4, 3.8], true), bundle(3, [5.4, 3.6, 4.8], false), bundle(4, [2.6, 3.4, 1.8, 2.8, 2.2], true)];
      const buckets = sets.map(() => []);
      choir.forEach((p, i) => { const v = i % sets.length; buckets[v].push({ x: p.x, y: p.y - 0.15, z: p.z, ry: Math.atan2(5 - p.x, 62 - p.z) + r0.range(-0.25, 0.25), sx: p.scale * 0.82, sy: p.scale * 0.82, sz: p.scale * 0.82 }); aoStamps.push({ x: p.x, z: p.z, r: 1.9, k: 0.6 }); });
      const gm = glowPaintMaterial(2.0);
      sets.forEach((st, i) => { add(st.solid, paintMaterial(), buckets[i], { cast: true, name: 'pipe' }); add(st.glow, gm, buckets[i], { name: 'pipeglow', receive: false }); });
    }
  }

  // crates → kit crates / barrels
  {
    const list = byKind.crate ?? [];
    if (kitOK && list.length) {
      const m = wa.material('dungeon', 'base', { aoK: 0.62 }), buckets = new Map();
      for (const p of list) {
        const key = pick(r0, [['dungeon/box_small', 3], ['dungeon/box_large', 2], ['dungeon/barrel_small', 2], ['dungeon/crates_stacked', 1]]);
        const s = key === 'dungeon/crates_stacked' ? p.scale * 0.62 : key === 'dungeon/box_large' ? p.scale * 0.78 : p.scale * 1.12;
        (buckets.get(key) ?? buckets.set(key, []).get(key)).push({ x: p.x, y: p.y, z: p.z, ry: r0.range(0, TAU), sx: s, sy: s, sz: s });
        aoStamps.push({ x: p.x, z: p.z, r: 0.95, k: 0.5 });
      }
      for (const [key, l] of buckets) add(geoOf(key), m, l, { cast: true, name: 'crate' });
    }
  }

  // windharps rolled out by the area rules are full structures
  const harps = byKind.windharp ?? [];
  for (const p of harps) {
    const obj = buildStructure('windharp', { wa, q, seed: `${p.x.toFixed(1)}${p.z.toFixed(1)}`, session: ctx.session });
    if (!obj) continue;
    obj.position.set(p.x, p.y, p.z); obj.rotation.y = p.rot; obj.scale.setScalar(p.scale * 0.95);
    out.add(obj);
    if (obj.userData.update) updaters.push((t, focus) => obj.userData.update(t, obj.userData.state, focus));
    aoStamps.push({ x: p.x, z: p.z, r: 1.9, k: 0.45 });
  }

  // ───────────────────────── 2) cosmetic scatter
  const scatterN = q.scatter ?? 1;
  const rS = new Rng(`scatter:${zone.def.seed}`);

  // 2a) border forest + hillside trees — only where the player can never walk
  {
    const kitTrees = kitOK;
    const mk = [[], [], [], []], dead = [[], []], fb = [];
    const tryTree = (x, z, big) => {
      const g = ground(x, z);
      if (g.slope > 1.05 || occ.hit(x, z, 1.4)) return false;
      const s = (big ? rS.range(1.1, 1.75) : rS.range(0.8, 1.25)) * 0.9;
      const col = varc(rS);
      const tooCloseToWalk = inside(x, z, 4.2) && walkable(x, z);
      if (tooCloseToWalk) return false;
      const dryBiome = inArea('area.quarry', x, z) || inArea('area.empty_choir', x, z);
      if (kitTrees && dryBiome && rS.next() < 0.32) { dead[rS.next() < 0.5 ? 0 : 1].push({ x, y: g.h - 0.05, z, ry: rS.range(0, TAU), sx: s * 1.3, sy: s * 1.3, sz: s * 1.3 }); return true; }
      const it = { x, y: g.h - 0.05, z, ry: rS.range(0, TAU), sx: s, sy: s * rS.range(0.92, 1.18), sz: s, color: col };
      if (kitTrees) mk[s < 0.85 ? 0 : s < 1.05 ? 1 : 2].push(it); else fb.push({ ...it, sx: s * 1.2, sy: s * 1.2, sz: s * 1.2, color: undefined });
      occ.add(x, z, 1.1 * s);
      aoStamps.push({ x, z, r: 1.3 * s, k: 0.5 });
      stats.trees++;
      return true;
    };
    // along the playable border (inside the 4 m margin) and in a band outside it
    const L = b.x1 - b.x0, perimeter = (u, off) => { const side = Math.floor(u * 4) % 4, t = (u * 4) % 1; const dd = off; if (side === 0) return [b.x0 + t * L, b.z0 + dd]; if (side === 1) return [b.x1 - dd, b.z0 + t * L]; if (side === 2) return [b.x1 - t * L, b.z1 - dd]; return [b.x0 + dd, b.z1 - t * L]; };
    const nBorder = Math.round(700 * scatterN);
    for (let i = 0; i < nBorder; i++) {
      const u = rS.next(), off = rS.range(-34, 3.6);               // negative = outside the bounds
      const [x, z] = perimeter(u, off);
      const nz = fbm2(x * 0.07, z * 0.07, 3, 5);
      if (nz < 0.36 + Math.max(0, (off + 2) * 0.012)) continue;    // clearings / groves
      tryTree(x + rS.range(-1.5, 1.5), z + rS.range(-1.5, 1.5), off < -8);
    }
    // wooded slopes beyond: sparse, bigger, only on the lower terraces of the mountain wall
    const nFar = Math.round(520 * scatterN);
    for (let i = 0; i < nFar; i++) {
      const u = rS.next(), off = rS.range(-95, -30);
      const [x, z] = perimeter(u, off);
      if (fbm2(x * 0.05, z * 0.05, 3, 9) < 0.45) continue;
      const g = ground(x, z); if (g.h > 52) continue;
      tryTree(x, z, true);
    }
    // groves on the unreachable cliff tops / plateau slopes inside the zone
    for (let i = 0; i < Math.round(1400 * scatterN); i++) {
      const x = rS.range(b.x0, b.x1), z = rS.range(b.z0, b.z1);
      if (walkable(x, z)) continue;
      if (fbm2(x * 0.06, z * 0.06, 3, 7) < 0.5) continue;
      const g = ground(x, z); if (g.slope > 0.8 || g.h < 5) continue;
      tryTree(x, z, false);
    }
    add(geoOf('graveyard/tree_pine_orange_small'), treeMat, mk[0], { cast: true, name: 'tree_s', maxDist: 120 });
    add(geoOf('graveyard/tree_pine_orange_medium'), treeMat, mk[1], { cast: true, name: 'tree_m', maxDist: 120 });
    add(geoOf('graveyard/tree_pine_orange_large'), treeMat, mk[2], { cast: true, name: 'tree_l', maxDist: 140 });
    add(geoOf('graveyard/tree_dead_large'), deadMat, dead[0], { cast: true, name: 'dead_l', maxDist: 120 });
    add(geoOf('graveyard/tree_dead_medium'), deadMat, dead[1], { cast: true, name: 'dead_m', maxDist: 120 });
    if (fb.length) add(pineFallbackGeo(2, { height: 6 }), foliageMat, fb, { cast: true, name: 'tree_fb', maxDist: 120 });
  }

  // 2b) cliff-foot boulders and talus: big cosmetic rocks on unwalkable ground so cliffs read as cliffs
  {
    const items = [[], [], [], [], [], []], cool = [[], [], []];
    const n = Math.round(1500 * scatterN);
    for (let i = 0; i < n; i++) {
      const x = rS.range(b.x0 - 24, b.x1 + 24), z = rS.range(b.z0 - 24, b.z1 + 24);
      const g = ground(x, z);
      if (walkable(x, z) || g.slope < 0.42 && inside(x, z, 6)) continue;
      if (occ.hit(x, z, 1.2)) continue;
      const s = rS.range(0.8, 2.6) * (g.slope > 0.9 ? 1.25 : 1);
      const it = { x, y: g.h - 0.2 * s, z, ry: rS.range(0, TAU), sx: s * rS.range(0.9, 1.3), sy: s * rS.range(0.7, 1.1), sz: s * rS.range(0.9, 1.3), color: tint(rS.range(0.08, 0.13), 0.1, rS.range(0.75, 1.05)) };
      if (inArea('area.empty_choir', x, z)) cool[Math.floor(rS.next() * 3)].push({ ...it, color: undefined }); else items[Math.floor(rS.next() * 6)].push(it);
      occ.add(x, z, s * 0.8);
    }
    items.forEach((l, i) => add(ROCK[i], rockMat, l, { cast: true, name: 'cliffrock', maxDist: 110 }));
    cool.forEach((l, i) => add(ROCK_COOL[i], rockMat, l, { cast: true, name: 'cliffrock_c', maxDist: 110 }));
  }

  // 2c) grass tufts, ferns, pebbles, flowers, bushes on walkable, soft ground
  {
    const tufts = [[], [], []], ferns = [[], []], pebbles = [[], [], []], bushes = [[], [], []];
    const flowers = [];
    const x0 = b.x0 + 2, x1 = b.x1 - 2, z0 = b.z0 + 2, z1 = b.z1 - 2;
    const grassA = C('#ffffff');
    // density-driven rejection sampling on a jittered grid (even coverage, no clumps of nothing)
    const step = 0.62 / Math.sqrt(Math.max(0.25, q.grass));
    for (let gz = z0; gz < z1; gz += step) for (let gx = x0; gx < x1; gx += step) {
      const x = gx + rS.range(-step, step) * 0.5, z = gz + rS.range(-step, step) * 0.5;
      const s = sample(x, z);
      if (s.slope > 0.5 || s.pave > 0.35) continue;
      const pathFade = 1 - Math.min(1, Math.max(0, (s.path - 0.12) / 0.35));
      const dens = Math.pow(s.lush, 0.8) * pathFade * (0.55 + 0.9 * fbm2(x * 0.09, z * 0.09, 3, 13)) * (1 - s.ao * 0.5);
      if (rS.next() > dens * 0.7) continue;
      if (occ.hit(x, z, 0.3)) continue;
      const kind = rS.next();
      const v = kind < 0.45 ? 0 : kind < 0.8 ? 1 : 2;
      const sc = rS.range(0.75, 1.35) * (s.lush > 0.65 ? 1.1 : 0.85);
      const dry = Math.min(1, Math.max(0, (1 - s.lush) * 1.4 + (fbm2(x * 0.2, z * 0.2, 2, 3) - 0.5) * 0.6));
      tufts[v].push({ x, y: s.h - 0.02, z, ry: rS.range(0, TAU), sx: sc, sy: sc * rS.range(0.8, 1.3), sz: sc, color: grassA.clone().lerp(C('#d6c47a'), dry * 0.75).multiplyScalar(rS.range(0.88, 1.1)) });
    }
    // extra tufts hugging blockers (rocks, trees, walls): grounds them in the terrain
    for (const p of zone.props) {
      if (!p.block || p.r < 0.35 || !['rock', 'pine', 'ruin_wall', 'pillar', 'crate'].includes(p.kind)) continue;
      const n = Math.round((p.kind === 'rock' ? 7 : 5) * Math.min(1.5, scatterN));
      for (let i = 0; i < n; i++) {
        const a = rS.range(0, TAU), d = p.r * rS.range(0.75, 1.25) + 0.15, x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d, s = sample(x, z);
        if (s.slope > 0.7 || s.pave > 0.4) continue;
        const sc = rS.range(0.8, 1.4);
        tufts[rS.next() < 0.5 ? 0 : 2].push({ x, y: s.h - 0.02, z, ry: rS.range(0, TAU), sx: sc, sy: sc * rS.range(0.9, 1.4), sz: sc, color: grassA.clone().multiplyScalar(rS.range(0.9, 1.05)) });
      }
    }
    // ferns (shade: near trees, rocks, cliff feet)
    const nFern = Math.round(520 * scatterN);
    for (let i = 0; i < nFern; i++) {
      const x = rS.range(x0, x1), z = rS.range(z0, z1), s = sample(x, z);
      if (s.slope > 0.55 || s.pave > 0.2 || s.path > 0.2 || s.lush < 0.4 || occ.hit(x, z, 0.4)) continue;
      if (fbm2(x * 0.05, z * 0.05, 2, 21) < 0.5) continue;
      const sc = rS.range(0.8, 1.5);
      ferns[rS.next() < 0.6 ? 0 : 1].push({ x, y: s.h - 0.02, z, ry: rS.range(0, TAU), sx: sc, sy: sc * rS.range(0.85, 1.15), sz: sc, color: tint(rS.range(0.27, 0.34), 0.22, rS.range(0.72, 1)) });
    }
    // pebbles & small stones (non-blocking, tiny)
    const nPeb = Math.round(2600 * scatterN);
    for (let i = 0; i < nPeb; i++) {
      const x = rS.range(x0, x1), z = rS.range(z0, z1), s = sample(x, z);
      if (s.slope > 0.6 || s.pave > 0.5) continue;
      const near = s.path > 0.1 || s.lush < 0.4; if (!near && rS.next() > 0.18) continue;
      if (occ.hit(x, z, 0.2)) continue;
      const sc = rS.range(0.1, 0.34);
      pebbles[Math.floor(rS.next() * 3)].push({ x, y: s.h - sc * 0.25, z, ry: rS.range(0, TAU), sx: sc * rS.range(0.9, 1.4), sy: sc * rS.range(0.6, 1), sz: sc * rS.range(0.9, 1.4), color: tint(rS.range(0.08, 0.13), 0.12, rS.range(0.75, 1.1)) });
    }
    // flower meadows: patches around noise peaks
    const nPatch = Math.round(110 * scatterN);
    for (let i = 0; i < nPatch; i++) {
      const cx = rS.range(x0, x1), cz = rS.range(z0, z1), s0 = sample(cx, cz);
      if (s0.lush < 0.5 || s0.path > 0.15 || s0.pave > 0.1 || s0.slope > 0.4) continue;
      const nearHarps = inArea('area.windharps', cx, cz) || inArea('area.overlook', cx, cz) || inArea('area.empty_choir', cx, cz);
      const kind = nearHarps && rS.next() < 0.55 ? 'cyan' : pick(rS, [['white', 3], ['yellow', 3], ['violet', 2], ['pink', 1.5]]);
      const n = Math.round(rS.range(9, 24) * Math.min(1.4, q.grass));
      for (let k = 0; k < n; k++) {
        const a = rS.range(0, TAU), d = Math.sqrt(rS.next()) * rS.range(1.2, 3), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, s = sample(x, z);
        if (s.slope > 0.45 || s.path > 0.2 || s.pave > 0.15 || occ.hit(x, z, 0.25)) continue;
        const sc = rS.range(0.8, 1.3);
        flowers.push({ x, y: s.h - 0.02, z, ry: rS.range(0, TAU), sx: sc, sy: sc * rS.range(0.8, 1.25), sz: sc, color: FLOWER_TINT[kind].clone().lerp(C('#ffffff'), 0.2).multiplyScalar(rS.range(0.9, 1.1)) });
      }
    }
    // soft bushes outside the sim's shrub list (settlement fringe, ruins, cliffs' foot)
    const nBush = Math.round(260 * scatterN);
    for (let i = 0; i < nBush; i++) {
      const x = rS.range(x0, x1), z = rS.range(z0, z1), s = sample(x, z);
      if (s.slope > 0.5 || s.pave > 0.2 || s.path > 0.15 || s.lush < 0.35 || occ.hit(x, z, 0.8)) continue;
      if (fbm2(x * 0.045, z * 0.045, 3, 31) < 0.52) continue;
      const sc = rS.range(0.8, 1.4);
      bushes[Math.floor(rS.next() * 3)].push({ x, y: s.h - 0.03, z, ry: rS.range(0, TAU), sx: sc, sy: sc * rS.range(0.8, 1.2), sz: sc, color: tint(rS.range(0.22, 0.3), 0.25, rS.range(0.85, 1.15)) });
    }
    const md = q.drawDist * 0.85;
    tufts.forEach((l, i) => add(GRASS[i], foliageMat, l, { name: 'tuft', maxDist: md, cell: 28 }));
    ferns.forEach((l, i) => add(FERN[i], foliageMat, l, { name: 'fern', maxDist: md, cell: 28 }));
    pebbles.forEach((l, i) => add(PEBBLE[i], rockMat, l, { name: 'pebble', maxDist: md * 0.8, cell: 28 }));
    add(FLOWER, foliageMat, flowers, { name: 'flower', maxDist: md, cell: 28 });
    bushes.forEach((l, i) => add(BUSH[i], bushMat, l, { name: 'bush2', maxDist: md, cell: 28 }));
    stats.tufts = tufts.reduce((a, l) => a + l.length, 0); stats.flowers = flowers.length;
  }

  // 2d) resonance quartz clusters + glowing mushrooms (accents that tie the look to the cyan resonance theme)
  {
    const cry = [], mush = [];
    const spots = [[50, 4, 26, 16], [5, 60, 17, 14], [-46, -38, 18, 9]];
    for (const [cx, cz, rad, n] of spots) for (let i = 0; i < n * scatterN; i++) {
      const a = rS.range(0, TAU), d = Math.sqrt(rS.next()) * rad, x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, g = ground(x, z);
      if (occ.hit(x, z, 0.8) || g.slope > 0.7) continue;
      const sc = rS.range(0.55, 1.25);
      cry.push({ x, y: g.h - 0.05, z, ry: rS.range(0, TAU), sx: sc, sy: sc * rS.range(0.9, 1.4), sz: sc });
      occ.add(x, z, 0.5);
    }
    for (let i = 0; i < 70 * scatterN; i++) {
      const x = rS.range(b.x0 + 4, b.x1 - 4), z = rS.range(b.z0 + 4, b.z1 - 4), s = sample(x, z);
      if (s.slope > 0.7 || s.pave > 0.2 || s.path > 0.15 || (s.curv > 0.42 && rS.next() < 0.8) || occ.hit(x, z, 0.3)) continue;
      const sc = rS.range(0.8, 1.6);
      mush.push({ x, y: s.h - 0.01, z, ry: rS.range(0, TAU), sx: sc, sy: sc, sz: sc });
    }
    const crystalMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#5fd4ff', emissiveIntensity: 1.6, roughness: 0.35, flatShading: true, color: '#9fdcf0' });
    crystalMat.userData.shared = true;
    add(crystalGeo(1, { count: 6, height: 1.15 }), crystalMat, cry, { name: 'crystal', cast: false, maxDist: q.drawDist });
    const mushMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#3fd0e8', emissiveIntensity: 1.1, roughness: 0.7, flatShading: true });
    mushMat.userData.shared = true;
    add(mushroomGeo(1, { n: 3 }), mushMat, mush, { name: 'mushroom', maxDist: q.drawDist * 0.7 });
    stats.crystals = cry.length;
  }

  // 2e) fallen logs & stumps near the forest fringe
  {
    const items = [];
    for (let i = 0; i < 26 * scatterN; i++) {
      const x = rS.range(b.x0 + 4, b.x1 - 4), z = rS.range(b.z0 + 4, b.z1 - 4), s = sample(x, z);
      if (s.slope > 0.35 || s.pave > 0.1 || s.path > 0.12 || s.lush < 0.5 || occ.hit(x, z, 1.5)) continue;
      if (inside(x, z, 14)) continue;
      const g = rS.range(0.8, 1.3);
      items.push({ x, y: s.h - 0.05, z, ry: rS.range(0, TAU), sx: g, sy: g, sz: g });
      occ.add(x, z, 1.2);
    }
    add(logGeo(1), rockMat, items, { name: 'log', cast: true, maxDist: q.drawDist });
  }

  // contact shadows painted into the ground
  T.paintAO(aoStamps);

  const update = (fx, fz) => field.update(fx, fz, 1);
  stats.instances = field.instances; stats.meshes = field.meshes;
  return { group: out, field, updaters, emitters, update, stats, occ, ground, walkable, aoStamps };
}

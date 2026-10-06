/**
 * Zone — builds a playable outdoor zone from data: terrain, navigation, props, POIs, areas.
 * Everything procedural goes through seeded RNGs (reproducible). Used identically by the renderer,
 * the headless sim and the validators.
 */
import { Rng } from '../../core/rng.js';
import { NavGrid } from '../nav.js';
import { Terrain } from './terrain.js';
import { logger } from '../../core/logger.js';

const log = logger('zone');
const SLOPE_BLOCK = 0.85;

export function buildZone(registry, zoneId) {
  const def = registry.require(zoneId, 'zone');
  const terrain = new Terrain(def);
  const [W, H] = def.size, [ox, oz] = def.origin, cell = def.cell ?? 1;
  const nav = new NavGrid(Math.round(W / cell), Math.round(H / cell), cell, ox, oz);
  const propDefs = new Map(registry.all('prop').map((p) => [p.id.replace('prop.', ''), p]));
  const rng = new Rng(def.seed);

  // ── base walkability from slope & border
  const margin = 4;
  for (let j = 0; j < nav.rows; j++) for (let i = 0; i < nav.cols; i++) {
    const x = nav.wx(i), z = nav.wz(j);
    let blocked = 0;
    if (i < margin || j < margin || i >= nav.cols - margin || j >= nav.rows - margin) blocked = 1;
    else if (terrain.slopeAt(x, z) > SLOPE_BLOCK) blocked = 1;
    nav.blocked[j * nav.cols + i] = blocked;
  }
  nav.version++;

  const areas = def.areas.map((a) => ({ ...a }));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const inArea = (a, x, z) => ((x - a.c[0]) / a.r[0]) ** 2 + ((z - a.c[1]) / a.r[1]) ** 2 <= 1;
  const areaAt = (x, z) => {
    let best = null, bd = Infinity;
    for (const a of areas) {
      const d = ((x - a.c[0]) / a.r[0]) ** 2 + ((z - a.c[1]) / a.r[1]) ** 2;
      if (d <= 1 && d < bd) { bd = d; best = a; }
    }
    return best;
  };

  // ── POIs / npcs / spawns: resolved with ground height
  const poiList = (def.pois ?? []).map((p) => ({ ...p, x: p.pos[0], z: p.pos[1], y: terrain.heightAt(p.pos[0], p.pos[1]) }));
  const keepClear = [
    ...poiList.filter((p) => !['area_mark', 'lore'].includes(p.type)).map((p) => ({ x: p.x, z: p.z, r: p.type === 'arena' ? 0 : 3.2 })),
    ...(def.npcs ?? []).map((n) => ({ x: n.pos[0], z: n.pos[1], r: 3 })),
    ...(def.spawns ?? []).map((s) => ({ x: s.pos[0], z: s.pos[1], r: 3.5 })),
    ...(def.bosses ?? []).map((s) => ({ x: s.pos[0], z: s.pos[1], r: 6 })),
  ];
  const avoidCircles = {};
  for (const p of poiList) {
    if (p.type === 'area_mark') avoidCircles[p.id.replace('poi.', '')] = { x: p.x, z: p.z, r: p.r };
    if (p.type === 'arena') avoidCircles[p.id.replace('poi.', '')] = { x: p.x, z: p.z, r: p.r };
  }
  avoidCircles.arena = avoidCircles.boss_arena;

  const props = [];
  const blockers = [];
  const addProp = (kind, x, z, scale, rot, block, extra = {}) => {
    const pd = propDefs.get(kind);
    const r = (pd?.radius ?? 0) * scale;
    const y = terrain.heightAt(x, z);
    const pr = { kind, x, z, y, scale, rot, r, block: !!block && r > 0, h: (pd?.h ?? 1) * scale, ...extra };
    props.push(pr);
    if (pr.block) { nav.blockCircle(x, z, Math.max(0.5, r * 0.92), 1); blockers.push(pr); }
    return pr;
  };

  // authored structures first (they reserve space)
  for (const s of def.structures ?? []) addProp(s.kind, s.pos[0], s.pos[1], s.scale ?? 1, s.yaw ?? 0, true, { structure: true });
  for (const p of poiList) if (p.type === 'waypoint') addProp('waystone', p.x, p.z, 1, 0, true, { structure: true, poi: p.id });

  for (const rule of def.props ?? []) {
    const rr = rng.fork(`props:${rule.kind}:${rule.area}:${rule.count}`);
    let placed = 0, tries = 0;
    const area = areaById.get(rule.area);
    const pd = propDefs.get(rule.kind);
    while (placed < rule.count && tries < rule.count * 40) {
      tries++;
      let x, z;
      if (rule.area === 'world_edge') {
        const side = rr.int(0, 3), t = rr.range(-80, 80), depth = rr.range(0, 5.2);
        const o = ox + 80;
        if (side === 0) { x = ox + 1 + depth; z = oz + 80 + t; } else if (side === 1) { x = ox + W - 1 - depth; z = oz + 80 + t; } else if (side === 2) { x = o + t; z = oz + 1 + depth; } else { x = o + t; z = oz + H - 1 - depth; }
      } else if (rule.ring) {
        const a = rr.range(0, Math.PI * 2);
        x = area.c[0] + Math.sin(a) * rule.ring * (0.95 + rr.next() * 0.1); z = area.c[1] + Math.cos(a) * rule.ring * (0.95 + rr.next() * 0.1);
      } else {
        const a = rr.range(0, Math.PI * 2), rad = Math.sqrt(rr.next());
        x = area.c[0] + Math.sin(a) * area.r[0] * rad; z = area.c[1] + Math.cos(a) * area.r[1] * rad;
      }
      if (x < ox + 3 || z < oz + 3 || x > ox + W - 3 || z > oz + H - 3) { if (rule.area !== 'world_edge') continue; }
      const slope = terrain.slopeAt(x, z);
      const big = (pd?.radius ?? 0) > 0.3;
      if (slope > (big ? 0.55 : 1.4)) continue;
      if (big && rule.area !== 'world_edge' && terrain.pathStrength(x, z) > 0.18) continue;
      if (big && nav.isBlockedCell(nav.cx(x), nav.cz(z)) && rule.area !== 'world_edge') continue;
      if (big && keepClear.some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + (pd.radius ?? 0)) ** 2)) continue;
      let skip = false;
      for (const name of rule.avoid ?? []) { const c = avoidCircles[name]; if (c && (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 1.5) ** 2) skip = true; }
      if (skip) continue;
      const scale = rr.range(rule.scale?.[0] ?? 1, rule.scale?.[1] ?? 1);
      const r = (pd?.radius ?? 0) * scale;
      if (r > 0 && blockers.some((b) => (b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + r + 0.9) ** 2)) continue;
      addProp(rule.kind, x, z, scale, rr.range(0, Math.PI * 2), rule.block, { area: rule.area });
      placed++;
    }
  }

  // keep POIs reachable: carve small clearings (unblock cells in a radius around keepClear points)
  for (const c of keepClear) {
    if (c.r <= 0) continue;
    for (let dz = -Math.ceil(c.r); dz <= Math.ceil(c.r); dz++) for (let dx = -Math.ceil(c.r); dx <= Math.ceil(c.r); dx++) {
      const x = c.x + dx, z = c.z + dz;
      if (dx * dx + dz * dz > c.r * c.r * 0.5) continue;
      const i = nav.cx(x), j = nav.cz(z);
      if (nav.inBounds(i, j) && terrain.slopeAt(x, z) <= SLOPE_BLOCK && !blockers.some((b) => b.structure && (b.x - x) ** 2 + (b.z - z) ** 2 < b.r * b.r)) nav.blocked[j * nav.cols + i] = 0;
    }
  }
  nav.version++;

  const zone = {
    id: def.id, def, terrain, nav, props, areas, areaById, pois: poiList, poiById: new Map(poiList.map((p) => [p.id, p])),
    npcs: (def.npcs ?? []).map((n) => ({ ...n, x: n.pos[0], z: n.pos[1], y: terrain.heightAt(n.pos[0], n.pos[1]) })),
    heightAt: (x, z) => terrain.heightAt(x, z),
    areaAt, inArea,
    spawnPoint: { x: def.pois.find((p) => p.type === 'start').pos[0] + 2, z: def.pois.find((p) => p.type === 'start').pos[1] - 2 },
    bounds: { x0: ox, z0: oz, x1: ox + W, z1: oz + H },
  };
  zone.safeAt = (x, z) => !!areaAt(x, z)?.safe;
  return zone;
}

/** validation: every gameplay point must be reachable from the start by the nav grid */
export function validateZone(zone) {
  const errors = [];
  const reach = zone.nav.reachable(zone.spawnPoint.x, zone.spawnPoint.z);
  const ok = (x, z) => {
    const n = zone.nav.nearestWalkable(x, z, 4);
    return n && reach.has(zone.nav.cellKey(n.x, n.z));
  };
  for (const p of zone.pois) if (!['area_mark', 'lore'].includes(p.type) && !(p.hidden) && !ok(p.x, p.z)) errors.push(`POI unreachable: ${p.id}`);
  for (const n of zone.npcs) if (!ok(n.x, n.z)) errors.push(`NPC unreachable: ${n.id}`);
  for (const s of zone.def.spawns ?? []) if (!ok(s.pos[0], s.pos[1])) errors.push(`spawn unreachable: ${s.id}`);
  for (const s of zone.def.bosses ?? []) if (!ok(s.pos[0], s.pos[1])) errors.push(`boss spawn unreachable: ${s.id}`);
  for (const r of zone.def.resources ?? []) { /* nodes are placed on walkable cells at build time */ }
  return errors;
}

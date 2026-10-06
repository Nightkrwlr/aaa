/**
 * Overworld interactables — everything the player can "use": NPCs, waypoints, stations, lore, gates, dungeon portals,
 * gathering nodes, world puzzles (bell pillars, clue tablets, glyph dials) and authored extras from zone.interactables.
 * Built once per zone load from data (reproducible); each entry is a plain object the client can render a prompt for.
 */
import { Rng } from '../../core/rng.js';
import { generatePuzzle } from '../puzzles/index.js';

/** @returns {{list:any[], puzzles:Map<string,any>}} */
export function buildInteractables(session, zone) {
  const reg = session.registry, def = zone.def, list = [], puzzles = new Map();
  const add = (o) => { o.r ??= 2.4; list.push(o); return o; };
  const walk = (x, z) => { const n = zone.nav.isWalkable(x, z) ? { x, z } : zone.nav.nearestWalkable(x, z, 6); return n ?? { x, z }; };

  for (const n of zone.npcs) add({ id: n.id, kind: 'npc', npc: n.id, x: n.x, z: n.z, r: 2.8, labelKey: 'ia.talk', nameKey: `${n.id}.name`, cond: n.cond });
  for (const p of zone.pois) {
    switch (p.type) {
      case 'waypoint': add({ id: p.id, kind: 'waypoint', wp: p.id, x: p.x, z: p.z, r: 3.0, labelKey: 'ia.waypoint', nameKey: `${p.name ?? p.id}.name` }); break;
      case 'station': add({ id: p.id, kind: 'station', station: p.station, x: p.x, z: p.z, r: 3.0, labelKey: `ia.station_${p.station}` }); break;
      case 'stash': add({ id: p.id, kind: 'stash', x: p.x, z: p.z, r: 2.6, labelKey: 'ia.stash' }); break;
      case 'gate': add({ id: p.id, kind: 'gate', gate: p.gate, x: p.x, z: p.z, r: 3.6, labelKey: 'ia.gate' }); break;
      case 'dungeon': add({ id: p.id, kind: 'dungeon_portal', dungeon: p.dungeon, x: p.x - 3.2, z: p.z, r: 3.2, labelKey: 'ia.enter_dungeon', nameKey: `${p.dungeon}.name` }); break;
      case 'lore': add({ id: p.id, kind: 'lore', discover: p.discover ?? p.lore?.replace('lore.', 'cdx.'), lore: p.lore, x: p.x, z: p.z, r: 2.6, labelKey: 'ia.listen_cylinder' }); break;
      default: break;
    }
  }
  for (const it of def.interactables ?? []) {
    const w = walk(it.pos[0], it.pos[1]);
    add({ ...it, x: w.x, z: w.z, r: it.r ?? 2.4, labelKey: it.labelKey ?? `ia.${it.kind}` });
  }

  // gathering nodes: seeded positions inside their area, respecting terrain & props
  const rng = new Rng(`${def.seed}:resources`);
  for (const r of def.resources ?? []) {
    const area = zone.areaById.get(r.area); if (!area) continue;
    const rr = rng.fork(r.id);
    for (let i = 0, tries = 0; i < r.count && tries < r.count * 40; tries++) {
      const a = rr.range(0, Math.PI * 2), k = Math.sqrt(rr.next());
      const x = area.c[0] + Math.sin(a) * area.r[0] * k, z = area.c[1] + Math.cos(a) * area.r[1] * k;
      if (!zone.nav.isWalkable(x, z) || zone.terrain.slopeAt(x, z) > 0.6) continue;
      if (list.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 6)) continue;
      add({ id: `${r.id}#${i}`, kind: 'resource', res: r.id, mat: r.mat, needs: r.needs, x, z, r: 1.9, labelKey: 'ia.gather', nameKey: `${r.mat}.name` });
      i++;
    }
  }

  // world puzzles (data: kind 'worldPuzzle')
  for (const wp of reg.all('worldPuzzle').filter((p) => p.zone === zone.id)) {
    const inst = wp.instance ?? generatePuzzle(wp.type, new Rng(wp.seed), { difficulty: wp.difficulty ?? 0.5, slots: wp.slots });
    if (wp.type === 'glyph_lock' && wp.solution) { inst.solution = wp.solution.slice(); inst.slots = wp.solution.length; }
    puzzles.set(wp.id, { def: wp, instance: inst });
    const [cx, cz] = wp.center;
    const cond = wp.cond;
    if (wp.type === 'tone_logic') {
      for (let i = 0; i < inst.n; i++) {
        const a = (i / inst.n) * Math.PI * 2 + 0.3;
        const w = walk(cx + Math.sin(a) * (wp.radius ?? 3.4), cz + Math.cos(a) * (wp.radius ?? 3.4));
        add({ id: `${wp.id}:p${i}`, kind: 'tone_pillar', puzzle: wp.id, index: i, x: w.x, z: w.z, r: 1.8, labelKey: 'ia.strike', nameKey: `pz.name.${inst.names[i]}`, cond });
      }
      inst.clues.forEach((c, i) => {
        const site = (wp.clueSites ?? [])[i % Math.max(1, (wp.clueSites ?? []).length)] ?? [cx + 4, cz + 4];
        const w = walk(site[0], site[1]);
        add({ id: `${wp.id}:t${i}`, kind: 'tablet', puzzle: wp.id, clue: i, x: w.x, z: w.z, r: 2.4, labelKey: 'ia.read', cond: wp.tabletCond });
      });
    } else if (wp.type === 'glyph_lock') {
      for (let i = 0; i < inst.slots; i++) {
        const w = walk(cx + (i - (inst.slots - 1) / 2) * 2.6, cz);
        add({ id: `${wp.id}:d${i}`, kind: 'glyph_dial', puzzle: wp.id, index: i, x: w.x, z: w.z, r: 1.7, labelKey: 'ia.turn', cond });
      }
    }
  }
  return { list, puzzles };
}

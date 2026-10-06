import { Rng } from '../../core/rng.js';
import { composeEncounter } from '../director/encounters.js';

/**
 * Instantiates authored spawn points into the world using the Encounter Director.
 * Group formations face the zone start so the "front" line meets the player first.
 * returns [{id, area, enemies:[entity]}]
 */
export function populateZone(world, zone, { seed, difficulty, skip } = {}) {
  const rng = new Rng(`${seed ?? zone.def.seed}:pop`);
  const groups = [];
  const startX = zone.spawnPoint.x, startZ = zone.spawnPoint.z;
  let gid = 1;
  for (const sp of zone.def.spawns ?? []) {
    const r = rng.fork(sp.id);
    if (skip?.has(sp.id)) continue;
    if (sp.rare !== undefined && !r.chance(sp.rare)) continue;
    let list;
    if (sp.template) list = composeEncounter(world.registry, sp.template, r, { level: sp.level, difficulty: difficulty ?? world.difficulty });
    else list = (sp.enemies ?? []).map((e, i) => ({ ...e, dx: i * 1.5, dz: 0 }));
    const yaw = Math.atan2(startX - sp.pos[0], startZ - sp.pos[1]);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const group = { id: sp.id, area: sp.area, enemies: [] };
    const tag = `g${gid++}`;
    for (const m of list) {
      let x = sp.pos[0] + m.dx * c + m.dz * s, z = sp.pos[1] - m.dx * s + m.dz * c;
      if (!world.nav.isWalkable(x, z)) { const n = world.nav.nearestWalkable(x, z, 6); if (!n) continue; x = n.x; z = n.z; }
      const e = world.spawnEnemy(m.id, x, z, { level: sp.level, yaw: yaw + Math.PI, hidden: m.hidden });
      e.group = tag; e.spawnId = sp.id;
      if (m.track) e.ai.cfg.track = m.track;
      group.enemies.push(e);
    }
    groups.push(group);
  }
  return groups;
}

import { T } from './tilemap.js';
import { simulateProgress } from './graph.js';
import { solvePuzzle } from '../puzzles/index.js';

/**
 * Automatic validation of a generated dungeon. Checks logic (keys/locks), geometry (connectivity, no bypass of
 * locks, doors between floors), content (spawns/objects on reachable floor, objectives present) and puzzles (solvable).
 * @returns {string[]} errors (empty = valid)
 */
export function validateDungeon(registry, d) {
  const errors = [];
  const { graph, map, rooms, content } = d;
  const err = (m) => errors.push(m);

  // 1. graph logic
  const sim = simulateProgress(graph);
  errors.push(...sim.errors);
  for (const k of graph.keys) {
    // a key must not be placed behind a door that needs itself: node must be reachable using only OTHER keys
    const edgesNeedingK = graph.edges.filter((e) => e.kind === 'lock' && e.needs.includes(k.key));
    const g2 = { ...graph, edges: graph.edges.map((e) => (e.kind === 'lock' && e.needs.includes(k.key) ? { ...e, needs: [...e.needs, '__never__'] } : e)) };
    const s2 = simulateProgress(g2);
    if (edgesNeedingK.length && !s2.reach.has(k.node)) err(`key ${k.key} sits behind its own lock`);
  }

  // 2. rooms
  for (const r of rooms.values()) { if (r.floor.length < 12) err(`room ${r.id} too small (${r.floor.length})`); }
  const ent = rooms.get(graph.entrance), ex = rooms.get(graph.exit);

  // 3. geometry connectivity: all floors reachable when every door can be opened
  const allOpen = map.flood(ent.cx, ent.cy, (t) => t !== T.WALL);
  let floors = 0, unreached = 0;
  for (const r of rooms.values()) for (const [x, y] of r.floor) { floors++; if (!allOpen[map.idx(x, y)]) unreached++; }
  if (unreached) err(`${unreached}/${floors} floor tiles unreachable with doors open`);
  if (!allOpen[map.idx(ex.cx, ex.cy)]) err('exit unreachable');

  // 4. no geometric bypass of locks: with lock/secret/one-way doors closed, only graph-reachable-without-keys rooms may be reached
  const closed = map.flood(ent.cx, ent.cy, (t) => t === T.FLOOR || t === T.DOOR || t === T.PIT);
  const noKeys = simulateProgress({ ...graph, edges: graph.edges.filter((e) => e.kind === 'normal') }, { useSecrets: false });
  for (const r of rooms.values()) {
    const reachedGeo = closed[map.idx(r.cx, r.cy)] === 1;
    const reachedLogic = noKeys.reach.has(r.id);
    if (reachedGeo && !reachedLogic) err(`room ${r.id} (${r.node.type}) bypasses its lock geometrically`);
    if (!reachedGeo && reachedLogic) err(`room ${r.id} (${r.node.type}) unreachable although logic says open`);
  }

  // 5. doors sit between floors
  for (const dr of map.doors) for (const [x, y] of dr.cells) {
    const horiz = map.isWalkableType(map.get(x - 1, y)) || map.get(x - 1, y) >= T.DOOR, vert = map.isWalkableType(map.get(x, y - 1)) || map.get(x, y - 1) >= T.DOOR;
    if (!horiz && !vert) err(`door ${dr.edge} isolated at ${x},${y}`);
  }

  // 6. content on reachable floor
  const onFloor = (x, z) => { const [tx, ty] = map.tileOf(x, z); return map.get(tx, ty) === T.FLOOR && allOpen[map.idx(tx, ty)] === 1; };
  for (const s of content.spawns) if (!onFloor(s.x, s.z)) err(`spawn ${s.id} off-floor`);
  for (const c of content.chests) if (!onFloor(c.x, c.z)) err(`chest in ${c.room} off-floor`);
  for (const o of content.objects) if (!onFloor(o.x, o.z)) err(`object ${o.kind} in ${o.room} off-floor`);
  for (const l of content.lore) if (!onFloor(l.x, l.z)) err(`lore ${l.id} off-floor`);
  for (const s of content.shrines) if (!onFloor(s.x, s.z)) err('shrine off-floor');
  if (!content.entrance || !onFloor(content.entrance.x, content.entrance.z)) err('entrance spawn invalid');
  if (!content.exit || !onFloor(content.exit.x, content.exit.z)) err('exit spawn invalid');
  if (graph.nodes.some((n) => n.type === 'boss') && (!content.boss || !onFloor(content.boss.x, content.boss.z))) err('boss spawn invalid');
  if (graph.nodes.some((n) => n.type === 'wave_arena') && !content.waveArena) err('wave arena missing');
  for (const k of graph.keys) {
    if (k.key.startsWith('puz_')) continue;
    const node = graph.nodes.find((n) => n.id === k.node);
    if (!content.objects.some((o) => o.key === k.key && o.room === node.id)) err(`key ${k.key} has no physical object in ${node.id}`);
  }
  // spawn must not be on top of the entrance
  for (const s of content.spawns) if (s.trigger !== 'enter' && Math.hypot(s.x - content.entrance.x, s.z - content.entrance.z) < 6) err(`spawn ${s.id} too close to entrance`);

  // 7. puzzles
  for (const p of content.puzzles) { try { if (solvePuzzle(p.instance).length < 1) err(`puzzle ${p.id} unsolvable`); } catch (e) { err(`puzzle ${p.id} solver failed: ${e.message}`); } }

  // 8. objective-specific
  const obj = registry.require(d.objective, 'dungeonObjective');
  for (const ex_ of obj.extraNodes ?? []) {
    const n = graph.nodes.filter((x) => x.type === ex_.type).length;
    if (n < ex_.count) err(`objective ${obj.id} needs ${ex_.count} ${ex_.type}, has ${n}`);
  }

  // 9. size sanity
  if (map.w * map.h > 260 * 260) err('dungeon too large');
  return errors;
}

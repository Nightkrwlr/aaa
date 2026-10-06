/**
 * Content placement for a rasterised dungeon: encounters (by depth), props by theme, lights, chests, shrines,
 * lore pieces (recombined narrative modules), puzzles, objective objects, secrets, hazards, modifiers.
 * Pure data out — the runtime and renderer instantiate it. Every position is a floor tile (validated).
 */
import { composeEncounter } from '../director/encounters.js';
import { TILE, T } from './tilemap.js';
import { generatePuzzle } from '../puzzles/index.js';

export function placeContent(registry, family, graph, map, rooms, rng, { ilvl, difficulty = 'seeker', modifiers = [] }) {
  const content = { spawns: [], props: [], lights: [], chests: [], shrines: [], lore: [], puzzles: [], objects: [], hazards: [], ambushes: [], secretCaches: [] };
  const doorsByRoom = new Map();
  for (const d of map.doors) for (const id of [d.a, d.b]) { if (!doorsByRoom.has(id)) doorsByRoom.set(id, []); doorsByRoom.get(id).push(...d.cells); }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const critIdx = new Map(graph.critical.map((id, i) => [id, i]));
  const L = graph.critical.length;
  const pools = family.pools;

  const roomTiles = (room, { avoidDoors = 2, avoidCenter = 0 } = {}) => room.floor.filter(([x, y]) => {
    for (const [dx, dy] of doorsByRoom.get(room.id) ?? []) if (Math.abs(dx - x) + Math.abs(dy - y) <= avoidDoors) return false;
    if (avoidCenter && Math.hypot(x - room.cx, y - room.cy) < avoidCenter) return false;
    // keep a 1-tile margin from walls for large things
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => map.isOpen(x + a, y + b));
  });
  const W = (x, y) => [map.wx(x), map.wz(y)];
  const centre = (room) => W(room.cx, room.cy);
  const depthPool = (idx) => { const t = idx / Math.max(1, L - 1); return t < 0.35 ? pools.easy : t < 0.75 ? pools.mid : pools.hard; };

  // ── narrative microstory
  const narPool = registry.all('narrative').filter((n) => n.families.includes(family.id));
  const narrative = narPool.length ? rng.pick(narPool) : null;
  const loreRooms = { early: [], mid: [], late: [] };
  graph.nodes.forEach((n) => {
    if (['entrance', 'exit'].includes(n.type)) return;
    const idx = critIdx.has(n.id) ? critIdx.get(n.id) / (L - 1) : 0.5;
    (idx < 0.34 ? loreRooms.early : idx < 0.7 ? loreRooms.mid : loreRooms.late).push(n);
  });

  for (const node of graph.nodes) {
    const room = rooms.get(node.id), r = rng.fork(`content${node.id}`);
    const idx = critIdx.get(node.id) ?? Math.floor(L * 0.5);
    const level = ilvl + Math.round((idx / L) * 2);
    const tiles = roomTiles(room);
    const pick = () => (tiles.length ? r.pick(tiles) : r.pick(room.floor));
    const addGroup = (templateId, o = {}) => {
      const [tx, ty] = o.at ?? pick();
      content.spawns.push({ id: `${node.id}_s${content.spawns.length}`, room: node.id, template: templateId, x: map.wx(tx), z: map.wz(ty), level, trigger: o.trigger ?? null, elite: o.elite ?? false, eliteCount: o.eliteCount, hidden: o.hidden });
    };
    switch (node.type) {
      case 'entrance': content.entrance = { x: centre(room)[0], z: centre(room)[1], room: node.id }; break;
      case 'exit': content.exit = { x: centre(room)[0], z: centre(room)[1], room: node.id }; break;
      case 'combat': addGroup(r.pick(depthPool(idx)), { at: [room.cx + r.int(-1, 1), room.cy + r.int(-1, 1)] }); if (room.floor.length > 70 && r.chance(0.5)) addGroup(r.pick(depthPool(idx))); break;
      case 'ambush': addGroup(r.pick(pools.mid), { trigger: 'enter' }); if (family.embedder === 'cavern') addGroup('enc.ambush_burrowers', { hidden: true }); break;
      case 'elite': addGroup(r.pick(depthPool(idx)), { elite: true, eliteCount: 2 }); break;
      case 'miniboss': addGroup(r.pick(pools.hard), { elite: true, eliteCount: 3 }); content.objects.push({ kind: 'banner_miniboss', room: node.id, x: centre(room)[0], z: centre(room)[1] }); break;
      case 'key': case 'treasure': case 'event': case 'lore': break;
      default: break;
    }
    // guards for treasure & keys
    if (node.type === 'treasure' && r.chance(0.5)) addGroup(r.pick(pools.easy));
    if (node.type === 'key') addGroup(r.pick(depthPool(idx)));
    if (node.type === 'event') { const kind = r.pick(['stranded_scout', 'ritual', 'cache_trap']); content.objects.push({ kind: `event_${kind}`, room: node.id, x: centre(room)[0], z: centre(room)[1] }); if (kind !== 'stranded_scout') addGroup(r.pick(depthPool(idx)), { trigger: 'interact' }); }

    // objects & objectives
    const [cx, cz] = centre(room);
    switch (node.type) {
      case 'shrine': content.shrines.push({ room: node.id, x: cx, z: cz }); break;
      case 'treasure': { const n = r.int(1, 2); for (let i = 0; i < n; i++) { const [tx, ty] = pick(); content.chests.push({ room: node.id, x: map.wx(tx), z: map.wz(ty), tier: idx > 0.6 * L ? 2 : 1 }); } break; }
      case 'secret': content.secretCaches.push({ room: node.id, x: cx, z: cz, tier: 2 }); content.chests.push({ room: node.id, x: cx, z: cz + 1, tier: 2, secret: true }); break;
      case 'mechanism': content.objects.push({ kind: 'mechanism', room: node.id, x: cx, z: cz, key: node.tags.find((t) => t.startsWith('key:'))?.slice(4) }); break;
      case 'resonance_node': content.objects.push({ kind: 'resonance_node', room: node.id, x: cx, z: cz, key: node.tags.find((t) => t.startsWith('key:'))?.slice(4) }); break;
      case 'survivor': content.objects.push({ kind: 'survivor', room: node.id, x: cx, z: cz, key: node.tags.find((t) => t.startsWith('key:'))?.slice(4) }); break;
      case 'key': content.objects.push({ kind: 'key_pedestal', room: node.id, x: cx, z: cz, key: node.tags.find((t) => t.startsWith('key:'))?.slice(4) }); break;
      case 'boss': content.boss = { room: node.id, x: cx, z: cz, boss: family.boss, artifact: node.tags.includes('artifact'), collapse: node.tags.includes('collapse') }; break;
      case 'wave_arena': content.waveArena = { room: node.id, x: cx, z: cz, waves: 4 + (graph.size === 'large' ? 2 : 0) }; break;
      case 'puzzle': {
        const type = r.pick(family.puzzles);
        const pz = generatePuzzle(type, r.fork('pz'), { difficulty: Math.min(1, 0.35 + idx / L * 0.5) });
        content.puzzles.push({ id: `pz_${node.id}`, room: node.id, type, x: cx, z: cz, instance: pz, key: node.tags.find((t) => t.startsWith('key:puz'))?.slice(4) ?? null, reward: node.crit ? 'door' : 'chest' });
        if (!node.crit) content.chests.push({ room: node.id, x: cx + 2 * (r.chance(0.5) ? 1 : -1), z: cz, tier: 2, sealed: `pz_${node.id}` });
        break;
      }
      default: break;
    }
    // decor by theme
    decorate(content, family, node, room, map, r, tiles);
  }

  // ── lore pieces along the path
  if (narrative) {
    for (const piece of narrative.pieces) {
      const cands = loreRooms[piece.where].filter((n) => !['boss', 'wave_arena', 'shrine'].includes(n.type));
      const n = cands.length ? rng.pick(cands) : rng.pick(graph.nodes.filter((x) => !['entrance', 'exit'].includes(x.type)));
      const room = rooms.get(n.id);
      const fl = room.floor.filter(([x, y]) => map.isOpen(x + 1, y) && map.isOpen(x - 1, y));
      const [tx, ty] = rng.fork(`lore${piece.id}`).pick(fl.length ? fl : room.floor);
      content.lore.push({ id: `${narrative.id}.${piece.id}`, kind: piece.kind, textKey: `${narrative.id}.${piece.id}`, room: n.id, x: map.wx(tx), z: map.wz(ty) });
    }
    content.narrative = narrative.id;
  }

  // ── environmental modifier hazards
  for (const mid of modifiers) {
    const m = registry.get(mid)?.effect ?? {};
    const mk = (kind, count) => { for (let i = 0; i < count; i++) { const n = rng.pick(graph.nodes.filter((x) => !['entrance', 'exit', 'shrine', 'boss'].includes(x.type))); const room = rooms.get(n.id); const [tx, ty] = rng.pick(room.floor); content.hazards.push({ kind, room: n.id, x: map.wx(tx), z: map.wz(ty), radius: 2.6 }); } };
    if (m.hushZones) mk('hush', m.hushZones);
    if (m.toxicZones) mk('toxic', m.toxicZones);
    if (m.shockZones) mk('shock', m.shockZones);
  }
  content.lightMult = modifiers.reduce((a, mid) => a * (registry.get(mid)?.effect?.lightMult ?? 1), 1);
  return content;
}

function decorate(content, family, node, room, map, r, tiles) {
  const theme = family.theme;
  const edge = room.floor.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !map.isOpen(x + a, y + b)) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => map.get(x + a, y + b) === T.DOOR));
  const add = (kind, [x, y], extra = {}) => content.props.push({ kind, x: map.wx(x) + (extra.dx ?? 0), z: map.wz(y) + (extra.dz ?? 0), rot: extra.rot ?? r.range(0, 6.28), scale: extra.scale ?? 1, block: extra.block ?? false, room: node.id });
  const big = room.w >= 8 && room.h >= 8;
  if (theme === 'crypt') {
    if (big && family.rules.pillarChance > r.next()) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = Math.round(room.cx + sx * room.w / 3), y = Math.round(room.cy + sy * room.h / 3); if (map.isOpen(x, y)) add('d_pillar', [x, y], { block: true, rot: 0 }); }
    for (let i = 0; i < r.int(1, 3); i++) if (edge.length) add('sarcophagus', r.pick(edge), { block: true });
    for (let i = 0; i < r.int(2, 4); i++) if (edge.length) add('urn', r.pick(edge), {});
    if (edge.length && node.type !== 'secret') { add('brazier', r.pick(edge), { block: false }); content.lights.push({ x: content.props[content.props.length - 1].x, z: content.props[content.props.length - 1].z, color: '#ffb050', intensity: 5, range: 11, flicker: true }); }
  } else if (theme === 'cavern') {
    for (let i = 0; i < r.int(3, 6); i++) if (edge.length) { add('crystal_cluster', r.pick(edge), { scale: r.range(0.8, 1.6) }); }
    for (let i = 0; i < r.int(3, 7); i++) if (edge.length) add('stalagmite', r.pick(edge), { scale: r.range(0.7, 1.8) });
    for (let i = 0; i < r.int(2, 5); i++) if (edge.length) add('mushroom', r.pick(edge), {});
    if (edge.length) { const e = r.pick(edge); content.lights.push({ x: map.wx(e[0]), z: map.wz(e[1]), color: '#7fe3ff', intensity: 4.5, range: 12 }); }
  } else {
    if (big && r.chance(family.rules.pillarChance + 0.2)) { for (const [sx, sy] of [[-1, 0], [1, 0]]) { const x = Math.round(room.cx + sx * room.w / 3), y = room.cy; if (map.isOpen(x, y)) add('machine', [x, y], { block: true, rot: 0 }); } }
    for (let i = 0; i < r.int(1, 3); i++) if (edge.length) add('console', r.pick(edge), { block: true });
    for (let i = 0; i < r.int(1, 3); i++) if (edge.length) add('cargo', r.pick(edge), { block: true });
    if (edge.length) { const e = r.pick(edge); content.lights.push({ x: map.wx(e[0]), z: map.wz(e[1]), color: '#7fe3ff', intensity: 4, range: 11, flicker: false }); add('lamp_post', e, {}); }
  }
}

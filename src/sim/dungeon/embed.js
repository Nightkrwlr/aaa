/**
 * Embedder — turns a mission graph into geometry.
 *  1. Lattice placement: every node gets a lattice cell adjacent to its tree-parent (backtracking DFS), so every
 *     required edge is *guaranteed* to be a short corridor between neighbouring cells (no random overlaps).
 *  2. Rasterisation: rooms (shape by node type + family rules) are carved per cell; corridors connect doors;
 *     lock/secret/one-way doors are marked; shortcut loops are routed with A* through solid rock.
 */
import { Tilemap, T } from './tilemap.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ───────────────────────── lattice placement
export function placeOnLattice(graph, rng, tries = 60) {
  const treeEdges = graph.edges.filter((e) => e.kind !== 'shortcut');
  const adj = new Map(graph.nodes.map((n) => [n.id, []]));
  for (const e of treeEdges) { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
  // spanning tree from entrance, critical continuation first
  const parent = new Map([[graph.entrance, null]]);
  const children = new Map(graph.nodes.map((n) => [n.id, []]));
  const order = [graph.entrance];
  const critSet = new Set(graph.critical);
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const nb = adj.get(id).filter((x) => !parent.has(x)).sort((a, b) => Number(critSet.has(b)) - Number(critSet.has(a)));
    for (const x of nb) { parent.set(x, id); children.get(id).push(x); order.push(x); }
  }
  const n = graph.nodes.length;
  for (let attempt = 0; attempt < tries; attempt++) {
    const r = rng.fork(`lat${attempt}`);
    const W = 7 + Math.ceil(n / 6) + (attempt > 20 ? 2 : 0), H = 6 + Math.ceil(n / 7) + (attempt > 20 ? 2 : 0);
    let budget = 6000;
    const occ = new Map(), place = new Map();
    const key = (x, y) => `${x},${y}`;
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !occ.has(key(x, y));
    const nodeById = new Map(graph.nodes.map((nn) => [nn.id, nn]));
    const put = (id, x, y) => { occ.set(key(x, y), id); place.set(id, { cells: [[x, y]] }); };
    const unput = (id) => { for (const [x, y] of place.get(id).cells) occ.delete(key(x, y)); place.delete(id); };
    const go = (id, x, y, dir) => {
      if (--budget < 0) return false;
      put(id, x, y);
      const node = nodeById.get(id);
      if (node.big) { // try to claim a second cell for a grand hall
        const opts = r.shuffle(DIRS).filter(([dx, dy]) => free(x + dx, y + dy));
        if (opts.length) { const [dx, dy] = opts[0]; occ.set(key(x + dx, y + dy), id); place.get(id).cells.push([x + dx, y + dy]); }
      }
      const kids = children.get(id);
      const placed = [];
      for (const kid of kids) {
        const cands = DIRS.map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([cx, cy]) => free(cx, cy));
        // momentum for the critical path, wander for branches
        cands.sort((a, b) => score(b, dir, critSet.has(kid), r) - score(a, dir, critSet.has(kid), r));
        let ok = false;
        for (const [cx, cy, dx, dy] of cands) { if (go(kid, cx, cy, [dx, dy])) { ok = true; break; } }
        if (!ok) { for (const p of placed) unplaceSubtree(p); unput(id); return false; }
        placed.push(kid);
      }
      return true;
    };
    const unplaceSubtree = (id) => { for (const k of children.get(id)) if (place.has(k)) unplaceSubtree(k); if (place.has(id)) unput(id); };
    if (go(graph.entrance, 1, Math.floor(H / 2), [1, 0])) return { W, H, place, attempt, parent };
  }
  return null;
}
function score([, , dx, dy], dir, isCrit, r) {
  const mom = dir ? (dx === dir[0] && dy === dir[1] ? 1 : 0) : 0;
  return (isCrit ? mom * 1.2 : mom * 0.3) + r.next();
}

// ───────────────────────── rasterisation
const ROOM_DIMS = {
  entrance: [6, 8, 6, 8], exit: [6, 8, 6, 8], shrine: [5, 6, 5, 6], boss: [9, 10, 9, 10], wave_arena: [9, 10, 9, 10],
  puzzle: [8, 9, 8, 9], hub: [4, 5, 8, 10], combat: [6, 10, 6, 10], ambush: [6, 9, 6, 9], elite: [8, 10, 8, 10], miniboss: [9, 10, 9, 10],
  treasure: [5, 7, 5, 7], lore: [5, 7, 5, 7], event: [6, 8, 6, 8], secret: [4, 6, 4, 6], key: [6, 8, 6, 8], mechanism: [6, 8, 6, 8], resonance_node: [7, 9, 7, 9], survivor: [5, 7, 5, 7],
};

export function rasterize(graph, placement, family, rng) {
  const cs = family.cell, margin = 2;
  const map = new Tilemap((placement.W) * cs, (placement.H) * cs);
  const rooms = new Map();
  let regionId = 0;
  const cw = family.rules.corridorWidth;
  for (const node of graph.nodes) {
    const pl = placement.place.get(node.id);
    const [cx, cy] = pl.cells[0];
    const second = pl.cells[1];
    const [wMin, wMax, hMin, hMax] = ROOM_DIMS[node.type] ?? [6, 8, 6, 8];
    const r = rng.fork(`room${node.id}`);
    let x0 = cx * cs, y0 = cy * cs, spanW = cs, spanH = cs;
    if (second) { x0 = Math.min(cx, second[0]) * cs; y0 = Math.min(cy, second[1]) * cs; if (second[0] !== cx) spanW = cs * 2; else spanH = cs * 2; }
    let w = r.int(wMin, wMax), h = r.int(hMin, hMax);
    if (second) { if (spanW > cs) w = Math.min(spanW - 2 * margin, r.int(16, 22)); else h = Math.min(spanH - 2 * margin, r.int(16, 22)); }
    w = Math.min(w, spanW - 2 * margin); h = Math.min(h, spanH - 2 * margin);
    const rx = x0 + margin + r.int(0, spanW - 2 * margin - w), ry = y0 + margin + r.int(0, spanH - 2 * margin - h);
    const shapes = family.rules.roomShapes;
    let shape = ['boss', 'wave_arena'].includes(node.type) && family.embedder !== 'cavern' ? (family.theme === 'crypt' ? 'circle' : 'hall') : r.pick(shapes);
    if (node.type === 'shrine' || node.type === 'secret') shape = family.embedder === 'cavern' ? 'blob' : 'rect';
    if (node.type === 'puzzle' && shape === 'cross') shape = 'rect';
    const room = { id: node.id, node, rx, ry, w, h, shape, region: regionId++, floor: [], second: !!second };
    carveRoom(map, room, r);
    rooms.set(node.id, room);
    map.rooms.push(room);
  }
  // corridors for tree edges (adjacent cells) — doors per edge kind
  const doorRecords = [];
  for (const e of graph.edges) {
    const A = rooms.get(e.a), B = rooms.get(e.b);
    const pa = placement.place.get(e.a).cells, pb = placement.place.get(e.b).cells;
    let pair = null;
    for (const ca of pa) for (const cb of pb) if (Math.abs(ca[0] - cb[0]) + Math.abs(ca[1] - cb[1]) === 1) pair = pair ?? [ca, cb];
    const r = rng.fork(`cor${e.id}`);
    let res = null;
    if (pair) res = carveCorridor(map, A, B, pair, cs, cw, family.embedder === 'cavern', r);
    else res = routeCorridor(map, A, B, e.kind === 'secret' ? 1 : cw, r);
    if (!res) { if (e.kind === 'shortcut') continue; return { ok: false, error: `corridor ${e.id} failed` }; }
    doorRecords.push({ edge: e, ...res });
  }
  // place doors
  for (const d of doorRecords) {
    const e = d.edge;
    const styled = e.kind !== 'normal' || family.rules.doorStyle !== 'none';
    if (!styled) continue;
    if (!d.doorTile) { if (e.kind === 'normal') continue; return { ok: false, error: `no door spot for ${e.kind} edge ${e.id}` }; }
    const [dx, dy] = d.doorTile;
    const type = e.kind === 'lock' ? T.LOCK : e.kind === 'secret' ? T.SECRET : e.kind === 'shortcut' ? T.ONEWAY : T.DOOR;
    if (e.kind === 'normal' && !(d.cw <= 3 && rng.fork(`dd${e.id}`).chance(0.55))) continue;
    // widen: fill the whole corridor cross-section at the door position
    const cells = d.doorCells ?? [[dx, dy]];
    for (const [x, y] of cells) map.set(x, y, type);
    map.doors.push({ x: dx, y: dy, cells, kind: e.kind, edge: e.id, needs: e.needs ?? null, openFrom: e.openFrom ?? null, a: e.a, b: e.b, type });
  }
  return { ok: true, map, rooms };
}

function carveRoom(map, room, r) {
  const { rx, ry, w, h, shape } = room;
  const inside = (x, y) => {
    const lx = x - rx, ly = y - ry;
    switch (shape) {
      case 'cross': { const cutX = Math.max(2, Math.floor(w / 3)), cutY = Math.max(2, Math.floor(h / 3)); return !((lx < cutX || lx >= w - cutX) && (ly < cutY || ly >= h - cutY)); }
      case 'octagon': { const c = Math.max(1, Math.floor(Math.min(w, h) / 4)); return !(lx + ly < c || (w - 1 - lx) + ly < c || lx + (h - 1 - ly) < c || (w - 1 - lx) + (h - 1 - ly) < c); }
      case 'circle': { const a = (lx - (w - 1) / 2) / (w / 2), b = (ly - (h - 1) / 2) / (h / 2); return a * a + b * b <= 1.02; }
      case 'blob': { const a = (lx - (w - 1) / 2) / (w / 2), b = (ly - (h - 1) / 2) / (h / 2); const ang = Math.atan2(b, a); const wob = 0.82 + 0.2 * Math.sin(ang * 3 + room.region) + 0.1 * Math.sin(ang * 5 + room.region * 2.3); return Math.hypot(a, b) <= wob; }
      default: return true;
    }
  };
  for (let y = ry; y < ry + h; y++) for (let x = rx; x < rx + w; x++) if (inside(x, y)) { map.set(x, y, T.FLOOR); map.region[map.idx(x, y)] = room.region; room.floor.push([x, y]); }
  room.cx = Math.floor(rx + w / 2); room.cy = Math.floor(ry + h / 2);
  if (!map.isOpen(room.cx, room.cy)) { const f = room.floor[Math.floor(room.floor.length / 2)]; room.cx = f[0]; room.cy = f[1]; }
}

/**
 * Find a spot on a corridor centre-line where one door seals the WHOLE cross-section: a straight stretch whose
 * perpendicular open run is bounded by walls on both sides and contains no room floor. Doors placed here can
 * never be walked around (even next to concave caves / circular rooms).
 */
function findDoorSpot(map, tiles, skip = 2) {
  for (let i = Math.max(1, skip); i < tiles.length - 2; i++) {
    const [x, y] = tiles[i], [px, py] = tiles[i - 1], [nx, ny] = tiles[i + 1];
    const dx = x - px, dy = y - py;
    if (!(dx || dy) || nx - x !== dx || ny - y !== dy) continue; // straight only
    const ox = dy !== 0 ? 1 : 0, oy = dx !== 0 ? 1 : 0; // perpendicular axis
    const run = [[x, y]];
    let ok = map.region[map.idx(x, y)] === -1;
    for (const sgn of [1, -1]) {
      for (let k = 1; k <= 6; k++) {
        const tx = x + ox * sgn * k, ty = y + oy * sgn * k;
        if (!map.isOpen(tx, ty)) break;
        if (map.region[map.idx(tx, ty)] !== -1) { ok = false; break; }
        run.push([tx, ty]);
        if (k === 6) ok = false;
      }
      if (!ok) break;
    }
    if (!ok) continue;
    // the cells immediately before/after the run along travel must not be room floor either (door sits mid-corridor)
    if (map.region[map.idx(px, py)] !== -1 && map.region[map.idx(px, py)] !== undefined && map.region[map.idx(px, py)] >= 0) continue;
    return { tile: [x, y], cells: run };
  }
  return null;
}

function carveRect(map, x0, y0, x1, y1) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { if (!map.isOpen(x, y)) map.set(x, y, T.FLOOR); }
}

/** corridor between rooms in adjacent lattice cells. Returns {doorTile, doorCells, cw} */
function carveCorridor(map, A, B, [ca, cb], cs, cw, winding, r) {
  const dx = cb[0] - ca[0], dy = cb[1] - ca[1];
  const horiz = dx !== 0;
  const anchor = (room, towards) => {
    // pick a floor tile on room boundary facing `towards`
    const opts = room.floor.filter(([x, y]) => horiz ? (towards > 0 ? !room.floor.some(([a, b]) => a === x + 1 && b === y) : !room.floor.some(([a, b]) => a === x - 1 && b === y)) : (towards > 0 ? !room.floor.some(([a, b]) => a === x && b === y + 1) : !room.floor.some(([a, b]) => a === x && b === y - 1)));
    if (!opts.length) return null;
    const mid = horiz ? room.cy : room.cx;
    const near = opts.filter(([x, y]) => Math.abs((horiz ? y : x) - mid) <= Math.max(1, Math.floor((horiz ? room.h : room.w) / 3)));
    return r.pick(near.length ? near : opts);
  };
  const t = horiz ? Math.sign(dx) : Math.sign(dy);
  const pa = anchor(A, t), pb = anchor(B, -t);
  if (!pa || !pb) return null;
  const half = Math.floor((cw - 1) / 2);
  const path = [];
  if (horiz) {
    const midX = Math.floor((pa[0] + pb[0]) / 2) + r.int(-1, 1);
    path.push([pa[0], pa[1], midX, pa[1]], [midX, pa[1], midX, pb[1]], [midX, pb[1], pb[0], pb[1]]);
  } else {
    const midY = Math.floor((pa[1] + pb[1]) / 2) + r.int(-1, 1);
    path.push([pa[0], pa[1], pa[0], midY], [pa[0], midY, pb[0], midY], [pb[0], midY, pb[0], pb[1]]);
  }
  for (const [x0, y0, x1, y1] of path) {
    for (let o = -half; o <= cw - 1 - half; o++) {
      if (x0 === x1) carveRect(map, x0 + o, y0, x1 + o, y1); else carveRect(map, x0, y0 + o, x1, y1 + o);
    }
    if (winding) { // organic wobble: carve extra blobs along the tunnel
      const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 2));
      for (let i = 0; i <= n; i++) { const cx = Math.round(x0 + (x1 - x0) * i / n) + r.int(-1, 1), cy = Math.round(y0 + (y1 - y0) * i / n) + r.int(-1, 1); if (Math.abs(cx - pa[0]) + Math.abs(cy - pa[1]) < 5) continue; carveRect(map, cx, cy, cx + 1, cy + 1); } // no wobble near the door: a lock must seal the whole cross-section
    }
  }
  // centre-line of the corridor, then a door spot that seals its whole cross-section
  const line = [];
  for (const [x0, y0, x1, y1] of path) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) { const p = [x0 + Math.sign(x1 - x0) * i, y0 + Math.sign(y1 - y0) * i]; const last = line[line.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) line.push(p); }
  }
  const spot = findDoorSpot(map, line, 2);
  if (!spot) return { doorTile: null, doorCells: [], cw, noSpot: true };
  return { doorTile: spot.tile, doorCells: spot.cells, cw };
}

/** A* corridor through solid rock between two rooms (shortcuts / non-adjacent edges) */
function routeCorridor(map, A, B, cw, r) {
  const start = A.floor[Math.floor(r.next() * A.floor.length)], goal = B.floor[Math.floor(r.next() * B.floor.length)];
  // closest pair heuristic
  let best = [A.floor[0], B.floor[0]], bd = Infinity;
  for (let i = 0; i < 40; i++) { const a = r.pick(A.floor), b = r.pick(B.floor); const d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); if (d < bd) { bd = d; best = [a, b]; } }
  const [s, g] = best;
  const W = map.w, H = map.h, idx = (x, y) => y * W + x;
  const open = [[0, s[0], s[1]]], gs = new Map([[idx(s[0], s[1]), 0]]), from = new Map(), closed = new Set();
  const regionOf = (x, y) => map.region[idx(x, y)];
  let found = false, it = 0;
  while (open.length && it++ < 40000) {
    open.sort((a, b) => a[0] - b[0]);
    const [, x, y] = open.shift();
    const k = idx(x, y);
    if (closed.has(k)) continue; closed.add(k);
    if (x === g[0] && y === g[1]) { found = true; break; }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
      const rg = regionOf(nx, ny);
      if (rg !== -1 && rg !== A.region && rg !== B.region) continue; // never cut through other rooms
      const open_ = map.isOpen(nx, ny);
      if (open_ && rg === -1) continue; // never merge into an existing corridor
      if (rg === -1) { // keep a 1-tile gap from every foreign open tile so the new tunnel can't touch other corridors/rooms
        let touch = false;
        for (const [ax, ay] of DIRS) { const tx = nx + ax, ty = ny + ay; if ((tx === x && ty === y) || !map.isOpen(tx, ty)) continue; const trg = regionOf(tx, ty); if (trg !== A.region && trg !== B.region) { touch = true; break; } if (trg !== -1 && !(((x === s[0] && y === s[1]) || trg === A.region || trg === B.region))) { touch = true; break; } }
        if (touch) continue;
      }
      const cost = (gs.get(k) ?? 0) + (open_ ? 1 : 2);
      const nk = idx(nx, ny);
      if (!gs.has(nk) || cost < gs.get(nk)) { gs.set(nk, cost); from.set(nk, k); open.push([cost + Math.abs(nx - g[0]) + Math.abs(ny - g[1]), nx, ny]); }
    }
  }
  if (!found) return null;
  const pathTiles = [];
  for (let k = idx(g[0], g[1]); k !== undefined; k = from.get(k)) { pathTiles.push([k % W, Math.floor(k / W)]); if (k === idx(s[0], s[1])) break; }
  pathTiles.reverse();
  let doorTile = null;
  for (const [x, y] of pathTiles) {
    const wasRoom = regionOf(x, y) !== -1;
    if (!map.isOpen(x, y)) map.set(x, y, T.FLOOR);
    if (!wasRoom && !doorTile && regionOf(x, y) === -1) doorTile = [x, y];
  }
  const spot = findDoorSpot(map, pathTiles, 2);
  if (!spot) return { doorTile: null, doorCells: [], cw: 1, noSpot: true };
  return { doorTile: spot.tile, doorCells: spot.cells, cw: 1 };
}

/**
 * Beam & Mirrors (Luz y rotación): route a beam from the emitter through every receptor by flipping the
 * rotatable mirrors ('/' ↔ '\'). The generator carves a real beam path, places decoy mirrors, scrambles the
 * mirrors until the board is unsolved, and brute-forces all 2^M states to prove it is solvable and non-trivial.
 */
const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const SLASH = { '/': { N: 'E', E: 'N', S: 'W', W: 'S' }, '\\': { N: 'W', W: 'N', S: 'E', E: 'S' } };

/** trace the beam. returns {cells:[[x,y,dir]], lit:Set(receptor index), hitWall} */
export function trace(inst, state) {
  const { w, h, emitter, walls, mirrors, receptors } = inst;
  const wall = new Set(walls.map(([x, y]) => `${x},${y}`));
  const mirAt = new Map(mirrors.map((m, i) => [`${m.x},${m.y}`, i]));
  const recAt = new Map(receptors.map((r, i) => [`${r[0]},${r[1]}`, i]));
  let [x, y] = emitter.pos, dir = emitter.dir;
  const cells = [], lit = new Set();
  const seen = new Set();
  for (let step = 0; step < w * h * 4; step++) {
    x += DIRS[dir][0]; y += DIRS[dir][1];
    if (x < 0 || y < 0 || x >= w || y >= h || wall.has(`${x},${y}`)) break;
    const k = `${x},${y},${dir}`;
    if (seen.has(k)) break; seen.add(k);
    cells.push([x, y, dir]);
    const mi = mirAt.get(`${x},${y}`);
    if (mi !== undefined) dir = SLASH[state[mi]][dir];
    const ri = recAt.get(`${x},${y}`);
    if (ri !== undefined) lit.add(ri);
  }
  return { cells, lit, solved: lit.size === receptors.length };
}

export function solve(inst) {
  const M = inst.mirrors.length;
  const sols = [];
  for (let mask = 0; mask < (1 << M); mask++) {
    const st = inst.mirrors.map((_, i) => ((mask >> i) & 1 ? '\\' : '/'));
    if (trace(inst, st).solved) sols.push(st);
  }
  return sols;
}

function flips(a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }

export function generate(rng, { difficulty = 0.5 } = {}) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const r = rng.fork(`bm${attempt}`);
    const size = 6 + (difficulty > 0.5 ? 1 : 0) + (difficulty > 0.85 ? 1 : 0);
    const w = size, h = size;
    const turns = 3 + Math.round(difficulty * 3); // mirrors on the true path
    const walls = [];
    for (let i = 0; i < Math.round(size * 0.8 * (0.5 + difficulty)); i++) walls.push([r.int(0, w - 1), r.int(0, h - 1)]);
    const emitterPos = [-1, r.int(1, h - 2)];
    const emitter = { pos: emitterPos, dir: 'E' };
    // build a path of straight runs turning at mirrors
    let x = 0, y = emitterPos[1], dir = 'E';
    const used = new Set([`${x},${y}`]);
    const mirrors = [], receptors = [], truth = [];
    let ok = true;
    for (let t = 0; t < turns && ok; t++) {
      const run = r.int(2, Math.max(2, size - 3));
      let moved = 0;
      for (let s = 0; s < run; s++) {
        const nx = x + DIRS[dir][0], ny = y + DIRS[dir][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || used.has(`${nx},${ny}`)) break;
        x = nx; y = ny; used.add(`${x},${y}`); moved++;
      }
      if (moved < 1) { ok = false; break; }
      if (t === turns - 1) break;
      // turn: choose a perpendicular direction with room
      const opts = (dir === 'E' || dir === 'W') ? ['N', 'S'] : ['E', 'W'];
      const nd = r.shuffle(opts).find((d) => { const nx = x + DIRS[d][0], ny = y + DIRS[d][1]; return nx >= 0 && ny >= 0 && nx < w && ny < h && !used.has(`${nx},${ny}`); });
      if (!nd) { ok = false; break; }
      const sl = Object.entries(SLASH).find(([, m]) => m[dir] === nd)[0];
      mirrors.push({ x, y, truth: sl });
      dir = nd;
    }
    if (!ok || mirrors.length < 2) continue;
    const pathCells = [...used].map((k) => k.split(',').map(Number)).filter(([cx, cy]) => !mirrors.some((m) => m.x === cx && m.y === cy));
    // receptors along the path (not on mirrors); last cell is always a receptor
    const lastCell = [x, y];
    const nRec = 1 + Math.round(difficulty * 2);
    const recCells = r.shuffle(pathCells.filter(([cx, cy]) => !(cx === lastCell[0] && cy === lastCell[1]) && !(cx === 0 && cy === emitterPos[1]))).slice(0, nRec - 1);
    recCells.push(lastCell);
    for (const c of recCells) receptors.push(c);
    // decoy mirrors off the path (never on walls/receptors)
    const nDecoy = 1 + Math.round(difficulty * 3);
    const free = [];
    for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) if (!used.has(`${cx},${cy}`)) free.push([cx, cy]);
    for (const c of r.shuffle(free).slice(0, nDecoy)) mirrors.push({ x: c[0], y: c[1], truth: r.pick(['/', '\\']), decoy: true });
    const wallSet = new Set(walls.map(([a, b]) => `${a},${b}`));
    const cleanWalls = walls.filter(([a, b]) => !used.has(`${a},${b}`) && !mirrors.some((m) => m.x === a && m.y === b));
    const inst = { type: 'beam_mirrors', w, h, emitter, walls: cleanWalls, mirrors: mirrors.map(({ x, y }) => ({ x, y })), receptors, difficulty, decoys: nDecoy, hintDelay: [90, 240] };
    const truthState = mirrors.map((m) => m.truth);
    if (!trace(inst, truthState).solved) continue;
    // scramble until unsolved and at least 2 flips from every solution
    const sols = solve(inst);
    if (!sols.length) continue;
    let start = null;
    for (let tries = 0; tries < 60; tries++) {
      const s = mirrors.map(() => r.pick(['/', '\\']));
      const minFlip = Math.min(...sols.map((sol) => flips(s, sol)));
      if (minFlip >= 2 + (difficulty > 0.6 ? 1 : 0) && !trace(inst, s).solved) { start = s; break; }
    }
    if (!start) continue;
    inst.start = start; inst.minMoves = Math.min(...sols.map((sol) => flips(start, sol))); inst.solutions = sols.length;
    return inst;
  }
  throw new Error('beam_mirrors: could not generate a puzzle');
}

export class BeamMirrorsState {
  constructor(inst) { this.inst = inst; this.state = inst.start.slice(); this.solved = false; this.moves = 0; this.trace = trace(inst, this.state); }
  rotate(i) {
    if (this.solved) return { ok: false, reason: 'solved' };
    this.state[i] = this.state[i] === '/' ? '\\' : '/';
    this.moves++;
    this.trace = trace(this.inst, this.state);
    if (this.trace.solved) this.solved = true;
    return { ok: true, solved: this.solved, lit: this.trace.lit.size };
  }
  hint(level) {
    if (level <= 0) return null;
    if (level === 1) return { type: 'text', key: this.trace.lit.size === 0 ? 'pz.hint.beam.start' : 'pz.hint.beam.corners' };
    // direct: a mirror whose state differs from the closest solution
    const sols = solve(this.inst);
    const best = sols.map((s) => ({ s, d: flips(this.state, s) })).sort((a, b) => a.d - b.d)[0];
    const i = this.state.findIndex((v, k) => v !== best.s[k]);
    return { type: 'mirror', index: i };
  }
}

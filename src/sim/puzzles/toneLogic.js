/**
 * Tone Logic (Coro de Pilares): strike N resonant pillars in the one order that satisfies a handful of
 * carved clues. The generator brute-forces all permutations, guarantees a UNIQUE solution and prunes clues
 * to a minimal set — so it is always solvable by pure reasoning, never by trial & error (a wrong strike
 * only costs a little time: the sequence resets).
 */
const NAMES = ['alba', 'marea', 'brasa', 'cierzo', 'hondo', 'eco', 'umbral', 'cuarzo'];

const CLUE = {
  before: (s, [a, b]) => s[a] < s[b],
  notFirst: (s, [a]) => s[a] !== 0,
  notLast: (s, [a], n) => s[a] !== n - 1,
  first: (s, [a]) => s[a] === 0,
  last: (s, [a], n) => s[a] === n - 1,
  adjacent: (s, [a, b]) => Math.abs(s[a] - s[b]) === 1,
  notAdjacent: (s, [a, b]) => Math.abs(s[a] - s[b]) !== 1,
  between: (s, [a, b, c]) => s[a] < s[b] && s[b] < s[c],
  exactly: (s, [a, k]) => s[a] === k,
  gap: (s, [a, b, k]) => Math.abs(s[a] - s[b]) === k,
};
const HARD = new Set(['adjacent', 'between', 'gap', 'notAdjacent']);

function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  function* rec(k) { if (k === n) { yield a.slice(); return; } for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; yield* rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; } }
  yield* rec(0);
}
/** s[pillar] = strike position. count solutions satisfying clues */
function solutions(n, clues, limit = 2) {
  const out = [];
  for (const p of perms(n)) {
    if (clues.every((c) => CLUE[c.kind](p, c.args, n))) { out.push(p.slice()); if (out.length >= limit) break; }
  }
  return out;
}

export function generate(rng, { difficulty = 0.5 } = {}) {
  const n = 4 + (difficulty > 0.45 ? 1 : 0) + (difficulty > 0.8 ? 1 : 0);
  const names = rng.shuffle(NAMES).slice(0, n);
  const pos = rng.shuffle(Array.from({ length: n }, (_, i) => i)); // pos[pillar] = strike position
  const order = []; for (let i = 0; i < n; i++) order[pos[i]] = i;  // order[k] = pillar struck k-th
  // candidate true clues
  const cands = [];
  for (let a = 0; a < n; a++) {
    if (pos[a] !== 0) cands.push({ kind: 'notFirst', args: [a] });
    if (pos[a] !== n - 1) cands.push({ kind: 'notLast', args: [a] });
    if (pos[a] === 0) cands.push({ kind: 'first', args: [a] });
    if (pos[a] === n - 1) cands.push({ kind: 'last', args: [a] });
    cands.push({ kind: 'exactly', args: [a, pos[a]] });
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      if (pos[a] < pos[b]) cands.push({ kind: 'before', args: [a, b] });
      if (Math.abs(pos[a] - pos[b]) === 1) cands.push({ kind: 'adjacent', args: [a, b] }); else cands.push({ kind: 'notAdjacent', args: [a, b] });
      cands.push({ kind: 'gap', args: [a, b, Math.abs(pos[a] - pos[b])] });
      for (let c = 0; c < n; c++) if (c !== a && c !== b && pos[a] < pos[b] && pos[b] < pos[c]) cands.push({ kind: 'between', args: [a, b, c] });
    }
  }
  // greedy: add the clue that prunes most, preferring harder kinds with difficulty, until unique
  let clues = [];
  const weight = (c) => (HARD.has(c.kind) ? 1 + difficulty * 2 : 1) * (c.kind === 'exactly' ? (1.2 - difficulty) : 1) * (0.6 + rng.next() * 0.8);
  let guard = 0;
  while (solutions(n, clues, 2).length > 1 && guard++ < 40) {
    const sample = rng.shuffle(cands).slice(0, 18);
    let best = null, bs = -1;
    for (const c of sample) {
      const cnt = solutions(n, [...clues, c], 200).length;
      const score = (1 / cnt) * weight(c);
      if (score > bs) { bs = score; best = c; }
    }
    clues.push(best);
  }
  // prune redundant clues
  for (let i = clues.length - 1; i >= 0; i--) {
    const without = clues.filter((_, j) => j !== i);
    if (without.length && solutions(n, without, 2).length === 1) clues = without;
  }
  const sol = solutions(n, clues, 2);
  if (sol.length !== 1) return generate(rng.fork('retry'), { difficulty });
  return { type: 'tone_logic', n, names, order, clues, difficulty, hintDelay: [90, 240] };
}

export function solve(inst) { return solutions(inst.n, inst.clues, 5).map((p) => { const o = []; p.forEach((pos, pillar) => { o[pos] = pillar; }); return o; }); }

export class ToneLogicState {
  constructor(inst) { this.inst = inst; this.progress = []; this.solved = false; this.attempts = 0; this.lastWrong = -1; }
  /** player strikes pillar i. returns {ok, correct, done} */
  strike(i) {
    if (this.solved) return { ok: false, reason: 'solved' };
    const want = this.inst.order[this.progress.length];
    if (i === want) {
      this.progress.push(i);
      if (this.progress.length === this.inst.n) { this.solved = true; return { ok: true, correct: true, done: true }; }
      return { ok: true, correct: true, done: false };
    }
    this.progress = []; this.attempts++; this.lastWrong = i;
    return { ok: true, correct: false, done: false };
  }
  /** layered hint: 0 env only, 1 character nudge, 2 direct (next pillar) */
  hint(level) {
    if (level <= 0) return null;
    if (level === 1) {
      const kinds = new Set(this.inst.clues.map((c) => c.kind));
      const key = kinds.has('exactly') || kinds.has('first') || kinds.has('last') ? 'pz.hint.tone.fixed' : kinds.has('adjacent') ? 'pz.hint.tone.pairs' : 'pz.hint.tone.order';
      return { type: 'text', key };
    }
    return { type: 'pillar', index: this.inst.order[this.progress.length] };
  }
}

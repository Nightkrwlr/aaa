import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/core/rng.js';
import { generatePuzzle, solvePuzzle, createPuzzleState, HintTimer } from '../src/sim/puzzles/index.js';
import { trace } from '../src/sim/puzzles/beamMirrors.js';

test('tone_logic: unique solution, minimal clues, reproducible, solvable by following the order', () => {
  for (const diff of [0.2, 0.5, 0.9]) for (let seed = 0; seed < 25; seed++) {
    const inst = generatePuzzle('tone_logic', new Rng(`tl${seed}`), { difficulty: diff });
    const sols = solvePuzzle(inst);
    assert.equal(sols.length, 1, 'exactly one solution');
    assert.deepEqual(sols[0], inst.order);
    assert.ok(inst.clues.length >= 2 && inst.clues.length <= 9, `clues ${inst.clues.length}`);
    // pruned: removing any clue breaks uniqueness
    // (re-verify with the solver on reduced sets)
    for (let i = 0; i < inst.clues.length; i++) {
      const reduced = { ...inst, clues: inst.clues.filter((_, j) => j !== i) };
      assert.ok(solvePuzzle(reduced).length > 1 || reduced.clues.length === 0, 'clue is necessary');
    }
    const st = createPuzzleState(inst);
    for (let k = 0; k < inst.n; k++) { const r = st.strike(inst.order[k]); assert.ok(r.correct); }
    assert.ok(st.solved);
  }
  const a = generatePuzzle('tone_logic', new Rng('same'), { difficulty: 0.6 }), b = generatePuzzle('tone_logic', new Rng('same'), { difficulty: 0.6 });
  assert.deepEqual(a, b);
});

test('tone_logic: wrong strike resets, counts attempts, hints escalate in layers', () => {
  const inst = generatePuzzle('tone_logic', new Rng('hint'), { difficulty: 0.6 });
  const st = createPuzzleState(inst);
  st.strike(inst.order[0]);
  const wrong = inst.order.find((_, i) => i !== 1);
  const r = st.strike(inst.order[2] === inst.order[1] ? inst.order[3] : inst.order[2]);
  assert.equal(r.correct, false); assert.equal(st.progress.length, 0); assert.equal(st.attempts, 1);
  assert.equal(st.hint(0), null);
  assert.equal(st.hint(1).type, 'text');
  assert.equal(st.hint(2).type, 'pillar');
  assert.equal(st.hint(2).index, inst.order[0]);
  const ht = new HintTimer(inst, true);
  assert.equal(ht.tick(10), 0); assert.equal(ht.tick(100), 1); assert.equal(ht.tick(200), 2);
  const off = new HintTimer(inst, false); assert.equal(off.tick(1000), 0, 'hints can be disabled');
});

test('beam_mirrors: always solvable, never pre-solved, non-trivial, deterministic', () => {
  for (const diff of [0.2, 0.55, 0.95]) for (let seed = 0; seed < 25; seed++) {
    const inst = generatePuzzle('beam_mirrors', new Rng(`bm${seed}`), { difficulty: diff });
    const sols = solvePuzzle(inst);
    assert.ok(sols.length >= 1, 'solvable');
    assert.equal(trace(inst, inst.start).solved, false, 'not pre-solved');
    assert.ok(inst.minMoves >= 2, `minMoves ${inst.minMoves}`);
    const st = createPuzzleState(inst);
    // follow the closest solution by flipping mirrors
    const target = sols[0];
    for (let i = 0; i < inst.mirrors.length; i++) if (st.state[i] !== target[i]) st.rotate(i);
    assert.ok(st.solved);
    assert.ok(st.hint(2) === null || st.hint(2).type === 'mirror');
  }
  assert.deepEqual(generatePuzzle('beam_mirrors', new Rng('d'), { difficulty: 0.5 }), generatePuzzle('beam_mirrors', new Rng('d'), { difficulty: 0.5 }));
});

test('glyph_lock: solvable by information from elsewhere; feedback counts correct dials', () => {
  const inst = generatePuzzle('glyph_lock', new Rng('gl'), { slots: 3 });
  assert.equal(new Set(inst.solution).size, 3);
  const st = createPuzzleState(inst);
  assert.equal(st.correct() <= 1, true);
  for (let i = 0; i < 3; i++) while (st.dials[i] !== inst.solution[i]) st.turn(i, 1);
  assert.ok(st.solved);
  assert.equal(createPuzzleState(inst).hint(2).type, 'glyph_source');
});

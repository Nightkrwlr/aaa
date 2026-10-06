import * as tone from './toneLogic.js';
import * as beam from './beamMirrors.js';
import * as glyph from './glyphLock.js';

const TYPES = { tone_logic: tone, beam_mirrors: beam, glyph_lock: glyph };
export const PUZZLE_TYPES = Object.keys(TYPES);

export function generatePuzzle(type, rng, opts = {}) {
  const t = TYPES[type];
  if (!t) throw new Error(`unknown puzzle type ${type}`);
  return t.generate(rng, opts);
}
export function solvePuzzle(inst) { return TYPES[inst.type].solve(inst); }

export function createPuzzleState(inst) {
  switch (inst.type) {
    case 'tone_logic': return new tone.ToneLogicState(inst);
    case 'beam_mirrors': return new beam.BeamMirrorsState(inst);
    case 'glyph_lock': return new glyph.GlyphLockState(inst);
    default: throw new Error(`unknown puzzle type ${inst.type}`);
  }
}

/** Layered help: 0 environment only → 1 character nudge → 2 direct. Delays come from the instance; can be disabled by the player. */
export class HintTimer {
  constructor(inst, enabled = true) { this.delays = inst.hintDelay ?? [90, 240]; this.enabled = enabled; this.t = 0; this.level = 0; }
  tick(dt, progressed) { if (progressed) this.t = Math.max(0, this.t - 30); this.t += dt; if (!this.enabled) { this.level = 0; return 0; } this.level = this.t >= this.delays[1] ? 2 : this.t >= this.delays[0] ? 1 : 0; return this.level; }
}

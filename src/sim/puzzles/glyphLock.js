/**
 * Glyph Lock (Símbolos, información previa): a sealed door with N dials. The right symbols are not in the room —
 * they are engraved in other places of the world. Solvable by observation and reasoning only; hints point at
 * the places to revisit (never at the solution itself, except the optional direct layer).
 */
export const GLYPH_SYMBOLS = ['circle_notch', 'tide', 'ember', 'wing', 'root', 'bell', 'eye_closed', 'spiral'];

export function generate(rng, { slots = 3 } = {}) {
  const sol = [];
  const pool = rng.shuffle(GLYPH_SYMBOLS.map((_, i) => i));
  for (let i = 0; i < slots; i++) sol.push(pool[i]);
  return { type: 'glyph_lock', slots, symbols: GLYPH_SYMBOLS.length, solution: sol, sources: ['overlook', 'crypt', 'windharps'].slice(0, slots), hintDelay: [120, 360] };
}

export function solve(inst) { return [inst.solution.slice()]; }

export class GlyphLockState {
  constructor(inst) { this.inst = inst; this.dials = Array(inst.slots).fill(0); this.solved = false; this.attempts = 0; }
  turn(i, dir = 1) {
    if (this.solved) return { ok: false, reason: 'solved' };
    this.dials[i] = (this.dials[i] + dir + this.inst.symbols) % this.inst.symbols;
    return { ok: true, solved: this.#check() };
  }
  #check() { if (this.dials.every((d, i) => d === this.inst.solution[i])) { this.solved = true; return true; } return false; }
  /** number of dials correct (feedback hum: lets the player confirm progress without brute forcing blindly) */
  correct() { return this.dials.filter((d, i) => d === this.inst.solution[i]).length; }
  hint(level) {
    if (level <= 0) return null;
    if (level === 1) return { type: 'text', key: 'pz.hint.glyph.places' };
    const i = this.dials.findIndex((d, k) => d !== this.inst.solution[k]);
    return i < 0 ? null : { type: 'glyph_source', index: i, where: this.inst.sources[i] };
  }
}

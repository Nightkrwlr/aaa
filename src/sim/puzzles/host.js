/**
 * PuzzleHost — runtime wrapper for puzzle instances, shared by dungeons and overworld puzzles.
 * Owns state + layered hints, applies the (small) punishment for a wrong tone and emits events:
 *   puzzle:strike / puzzle:mirror / puzzle:dial / puzzle:hint / puzzle (solved)
 */
import { createPuzzleState, HintTimer } from './index.js';

export class PuzzleHost {
  constructor(session) { this.s = session; this.map = new Map(); }

  /** @param {{id:string,type:string,instance:any,room?:string,onSolve?:Function,meta?:any}} def */
  add(def) {
    const entry = { ...def, state: createPuzzleState(def.instance), hints: new HintTimer(def.instance, this.s.settings?.puzzleHints !== false), solved: false };
    this.map.set(def.id, entry);
    return entry;
  }
  get(id) { return this.map.get(id); }
  values() { return this.map.values(); }

  strike(obj) {
    const pz = this.map.get(obj.puzzle); if (!pz || pz.solved) return { ok: false };
    const r = pz.state.strike(obj.index);
    const s = this.s;
    s.events.emit('puzzle:strike', { puzzle: pz.id, index: obj.index, correct: r.correct, done: r.done, progress: pz.state.progress.length });
    if (!r.correct) { s.world.status.apply(s.player, 'st.hush', { duration: 1.2 }); s.world.dealDirect(null, s.player, s.player.hpMax * 0.03, 'sonic', { reaction: true }); }
    if (r.done) this.#solve(pz);
    return { ok: true, ...r };
  }
  rotate(obj) {
    const pz = this.map.get(obj.puzzle); if (!pz || pz.solved) return { ok: false };
    const r = pz.state.rotate(obj.index);
    this.s.events.emit('puzzle:mirror', { puzzle: pz.id, index: obj.index });
    if (r.solved) this.#solve(pz);
    return { ok: true, ...r };
  }
  turn(obj) {
    const pz = this.map.get(obj.puzzle); if (!pz || pz.solved) return { ok: false };
    const r = pz.state.turn(obj.index, 1);
    this.s.events.emit('puzzle:dial', { puzzle: pz.id, index: obj.index, value: pz.state.dials[obj.index] });
    if (r.solved) this.#solve(pz);
    return { ok: true, ...r, correct: pz.state.correct() };
  }

  #solve(pz) {
    pz.solved = true;
    pz.onSolve?.(pz);
    this.s.events.emit('puzzle', { id: pz.id, type: pz.type });
    this.s.events.emit('toast', { key: 'toast.puzzle_solved' });
  }

  /** advance hint timers for puzzles whose area is active */
  update(dt, isActive) {
    for (const pz of this.map.values()) {
      if (pz.solved || !isActive(pz)) continue;
      const before = pz.hints.level;
      const lvl = pz.hints.tick(dt, false);
      if (lvl !== before && lvl > 0) this.s.events.emit('puzzle:hint', { id: pz.id, level: lvl, hint: pz.state.hint(lvl) });
    }
  }

  /** the text clue for a tablet (clue index) */
  static clueOf(entry, index) { return entry.instance.clues?.[index] ?? null; }
}

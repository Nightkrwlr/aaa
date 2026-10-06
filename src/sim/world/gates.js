import { checkCond } from '../state.js';

/**
 * Gates — region transitions are objectives, not level numbers. Each gate lists requirements
 * (flags, items, bosses, secrets, quests…) evaluated live; the UI shows which are met so players know what to do.
 */
export class GateSystem {
  constructor(session) { this.s = session; }
  def(id) { return this.s.registry.require(id, 'gate'); }

  status(id) {
    const d = this.def(id);
    const reqs = d.requirements.map((r) => ({ id: r.id, textKey: r.textKey, met: checkCond(this.s, r.cond), optional: !!r.optional, hidden: !!r.hidden && !checkCond(this.s, r.cond) }));
    return { id, open: !!this.s.state.gates[id], reqs, canOpen: reqs.filter((r) => !r.optional).every((r) => r.met) };
  }

  tryOpen(id) {
    const st = this.status(id);
    if (st.open) return { ok: true, already: true };
    if (!st.canOpen) return { ok: false, status: st };
    this.s.state.gates[id] = 'open';
    this.s.events.emit('gate:open', { id });
    return { ok: true };
  }
  isOpen(id) { return !!this.s.state.gates[id]; }
}

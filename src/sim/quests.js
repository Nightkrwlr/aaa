/**
 * QuestSystem — data-driven quests with stages and typed objectives; reacts to session events.
 * Objective types: reach, kill, interact, talk, collect, flag, listen, discover, defeatBoss, completeDungeon, solvePuzzle, haveItem.
 */
import { applyEffects } from './effects.js';
import { checkCond } from './state.js';
import { logger } from '../core/logger.js';
const log = logger('quests');

export class QuestSystem {
  constructor(session) {
    this.s = session;
    const ev = session.events;
    ev.on('kill', (i) => this.#progress('kill', (o) => this.#killMatch(o, i.entity)));
    ev.on('interact', (i) => this.#progress('interact', (o) => o.target === i.id || o.target === i.kind, 1, i));
    ev.on('talk', (i) => this.#progress('talk', (o) => o.npc === i.npc));
    ev.on('flag', () => this.#recheck());
    ev.on('listen', (i) => this.#progress('listen', (o) => !o.near || (i.near ?? []).includes(o.near)));
    ev.on('discover', (i) => this.#progress('discover', (o) => o.id === i.id));
    ev.on('boss', (i) => this.#progress('defeatBoss', (o) => o.boss === i.boss));
    ev.on('dungeonDone', (i) => this.#progress('completeDungeon', (o) => !o.family || o.family === i.family));
    ev.on('puzzle', (i) => this.#progress('solvePuzzle', (o) => o.id === i.id));
    ev.on('collect', () => this.#recheck());
    ev.on('area', (i) => this.#progress('reach', (o) => o.area === i.area));
  }

  def(id) { return this.s.registry.require(id, 'quest'); }
  stateOf(id) { return this.s.state.quests[id]; }
  active() { return Object.entries(this.s.state.quests).filter(([, q]) => q.state === 'active').map(([id]) => id); }

  start(id) {
    if (this.s.state.quests[id]) return false;
    const d = this.def(id);
    this.s.state.quests[id] = { state: 'active', stage: d.stages[0].id, progress: {}, startedAt: this.s.state.clock.seconds };
    this.s.events.emit('quest:started', { id });
    this.s.events.emit('toast', { key: 'toast.quest_started', params: { name: id } });
    applyEffects(this.s, d.stages[0].onEnter);
    this.#recheck();
    return true;
  }

  advanceTo(id, stageId) {
    const q = this.stateOf(id); if (!q) return;
    const d = this.def(id), st = d.stages.find((x) => x.id === stageId);
    if (!st) { log.warn(`quest ${id} has no stage ${stageId}`); return; }
    q.stage = stageId; q.progress = {};
    this.s.events.emit('quest:stage', { id, stage: stageId });
    applyEffects(this.s, st.onEnter);
    this.#recheck();
  }

  complete(id) {
    const q = this.stateOf(id); if (!q || q.state !== 'active') return;
    const d = this.def(id);
    q.state = 'done';
    const rw = d.rewards ?? {};
    if (rw.xp) applyEffects(this.s, [{ op: 'xp', amount: rw.xp }]);
    if (rw.chimes) applyEffects(this.s, [{ op: 'chimes', amount: rw.chimes }]);
    if (rw.talentPoints) applyEffects(this.s, [{ op: 'talentPoints', amount: rw.talentPoints }]);
    for (const it of rw.items ?? []) applyEffects(this.s, [{ op: 'giveItem', ...it }]);
    applyEffects(this.s, rw.effects);
    this.s.events.emit('quest:done', { id });
    this.s.events.emit('toast', { key: 'toast.quest_done', params: { name: id } });
    for (const n of d.next ?? []) if (!this.s.state.quests[n]) { const nd = this.def(n); if (checkCond(this.s, nd.requires)) this.start(n); }
  }

  fail(id) { const q = this.stateOf(id); if (q?.state === 'active') { q.state = 'failed'; this.s.events.emit('quest:failed', { id }); } }

  /** can the player start this quest right now? */
  available(id) { const d = this.def(id); return !this.s.state.quests[id] && checkCond(this.s, d.requires); }

  objectives(id) {
    const q = this.stateOf(id); if (!q) return [];
    const d = this.def(id), st = d.stages.find((x) => x.id === q.stage);
    return (st?.objectives ?? []).map((o, i) => ({ ...o, index: i, have: q.progress[i] ?? 0, need: o.count ?? 1, done: this.#done(o, q, i) }));
  }

  #done(o, q, i) {
    if (o.type === 'flag') return checkCond(this.s, { flag: o.flag });
    if (o.type === 'haveItem') return checkCond(this.s, { item: o.item });
    if (o.type === 'collect') return (this.s.character.inv.materials[o.id] ?? 0) >= (o.count ?? 1);
    return (q.progress[i] ?? 0) >= (o.count ?? 1);
  }

  #killMatch(o, e) {
    if (o.enemy && e.id !== o.enemy) return false;
    if (o.family && e.def?.family !== o.family) return false;
    if (o.tier && e.tier !== o.tier) return false;
    if (o.area && this.s.zone?.areaAt(e.x, e.z)?.id !== o.area) return false;
    return true;
  }

  #progress(type, match, amount = 1, payload) {
    for (const id of this.active()) {
      const q = this.stateOf(id), d = this.def(id), st = d.stages.find((x) => x.id === q.stage);
      st?.objectives.forEach((o, i) => { if (o.type === type && match(o)) q.progress[i] = Math.min(o.count ?? 1, (q.progress[i] ?? 0) + amount); });
    }
    this.#recheck();
  }

  /** advance stages whose objectives are all complete */
  #recheck() {
    let changed = true, guard = 0;
    while (changed && guard++ < 8) {
      changed = false;
      for (const id of this.active()) {
        const q = this.stateOf(id), d = this.def(id), st = d.stages.find((x) => x.id === q.stage);
        if (!st) continue;
        const all = st.objectives.length > 0 && st.objectives.every((o, i) => this.#done(o, q, i));
        if (!all) continue;
        changed = true;
        this.s.events.emit('quest:objectives_done', { id, stage: st.id });
        applyEffects(this.s, st.onComplete);
        if (st.end) { this.complete(id); }
        else if (st.next) this.advanceTo(id, st.next);
        else if (!st.manual) { const idx = d.stages.indexOf(st); if (d.stages[idx + 1]) this.advanceTo(id, d.stages[idx + 1].id); else this.complete(id); }
        else { q.stage = st.id; /* waits for a dialogue effect */ q.waiting = true; }
        if (q.waiting) { changed = false; }
      }
    }
  }
}

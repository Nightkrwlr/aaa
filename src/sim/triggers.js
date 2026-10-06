/**
 * TriggerSystem — event-driven effects granted by items and talents ("on dodge → decoy", "on kill → spread burn").
 * Data: { on, chance, icd, cond, ability | effects, atNearest } . ICDs and a re-entrancy guard make loops impossible.
 */
import { logger } from '../core/logger.js';
const log = logger('triggers');

export class TriggerSystem {
  constructor(world) {
    this.w = world;
    this.running = 0;
    const ev = world.events;
    ev.on('dash:start', (i) => { if (i.ab?.slotType === 'dodge') this.#fire(i.entity, 'dodge', {}); });
    ev.on('perfectDodge', (i) => this.#fire(i.entity, 'perfectDodge', {}));
    ev.on('entity:died', (i) => { if (i.killer) this.#fire(i.killer, 'kill', { victim: i.entity }); });
    ev.on('damage', (i) => {
      if (i.dot) return;
      if (i.source) { this.#fire(i.source, 'hit', { target: i.target, info: i }); if (i.crit) this.#fire(i.source, 'crit', { target: i.target, info: i }); }
      if (i.target && !i.target.dead) this.#fire(i.target, 'hurt', { source: i.source, info: i });
    });
    ev.on('cast:start', (i) => this.#fire(i.entity, 'cast', { ab: i.ab }));
    ev.on('cadence:chord', (i) => this.#fire(i.entity, 'chord', { chord: i.chord }));
  }

  set(e, src, list) {
    e.triggers = (e.triggers ?? []).filter((t) => t.src !== src);
    (list ?? []).forEach((t, i) => e.triggers.push({ ...t, src, key: `${src}:${i}` }));
  }
  clear(e, prefix) { e.triggers = (e.triggers ?? []).filter((t) => !t.src.startsWith(prefix)); }

  #fire(e, on, ctx) {
    if (!e.triggers?.length || this.running > 0) return;
    const w = this.w;
    for (const t of e.triggers) {
      if (t.on !== on) continue;
      if (e.dead && on !== 'kill') continue;
      e.trigIcd ??= {};
      if ((e.trigIcd[t.key] ?? 0) > w.time) continue;
      if (!this.#cond(e, t.cond, ctx)) continue;
      if (t.chance !== undefined && t.chance < 1 && w.rng.next() >= t.chance) continue;
      e.trigIcd[t.key] = w.time + (t.icd ?? 0.5);
      this.#run(e, t, ctx);
    }
  }

  #cond(e, c, ctx) {
    if (!c) return true;
    if (c.victimHas && !(ctx.victim?.st ?? []).some((s) => s.def.id === c.victimHas)) return false;
    if (c.selfHasAny && !c.selfHasAny.some((id) => this.w.status.has(e, id))) return false;
    if (c.selfHas && !this.w.status.has(e, c.selfHas)) return false;
    if (c.chord && ctx.chord?.type !== c.chord) return false;
    if (c.hpBelow !== undefined && e.hp / e.hpMax > c.hpBelow) return false;
    if (c.tag && !ctx.ab?.tags?.includes(c.tag)) return false;
    return true;
  }

  #run(e, t, ctx) {
    const w = this.w;
    this.running++;
    try {
      let x = e.x, z = e.z;
      if (t.ability && ctx.victim && !t.atNearest) { x = ctx.victim.x; z = ctx.victim.z; }
      if (t.atNearest) {
        const n = w.nearestHostile(e, t.atNearest);
        if (!n) return;
        x = n.x; z = n.z;
      }
      if (t.ability) w.abilities.castImmediate(e, t.ability, x, z);
      else if (t.effects) w.abilities.runInline(e, t.effects, x, z);
      w.events.emit('trigger', { entity: e, trigger: t });
    } catch (err) { log.error(`trigger ${t.key} failed`, err); }
    finally { this.running--; }
  }
}

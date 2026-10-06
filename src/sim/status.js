/**
 * Status system — data-driven ailments, buffs, controls and reactions.
 *
 * Behaviors (statuses.json → `behavior`):
 *   dot      damage over time (stacking: strongest | stack | independent)
 *   chill    builds `progress`; at threshold becomes the freezeStatus (then immune for `immuneAfter`)
 *   control  sets ctl flags (stunned/frozen/silenced/rooted/cloaked); diminishing returns via `dr`
 *   debuff / buff  stat modifiers while active
 *   stacker  accumulates stacks; at `burstAt` explodes (Dissonance)
 * Reactions (reactions.json) are tiny rules with internal cooldowns so chains can never loop.
 */
import { logger } from '../core/logger.js';
const log = logger('status');

let uidCounter = 1;

export class StatusSystem {
  /**
   * @param {{registry:any, balance:any, events:any, now:()=>number, hooks:any}} deps
   * hooks: dealDot({target,source,amount,type,statusId,ignoreArmor}), burst({target,source,amount,type,radius}),
   *        echoHit({target,source,amount,type}), chainDamage({target,source,amount,type,radius,targets}), refund({source,fraction})
   */
  constructor({ registry, balance, events, now, hooks }) {
    this.reg = registry;
    this.bal = balance;
    this.events = events;
    this.now = now;
    this.hooks = hooks ?? {};
    this.reactions = registry.all('reaction');
    this.stats = { applied: 0, resisted: 0, reactions: 0 };
  }

  def(id) { return this.reg.require(id, 'status'); }

  /** attach status state to an entity */
  init(e) {
    e.st = [];
    e.ctl = { stunned: false, frozen: false, silenced: false, rooted: false, cloaked: false };
    e.imm = {};      // statusId → time until which re-application is refused
    e.drMem = {};    // statusId → {count, until}
    e.reactIcd = {}; // reactionId → time
    return e;
  }

  has(e, id) { return e.st.some((s) => s.def.id === id); }
  stacks(e, id) { let n = 0; for (const s of e.st) if (s.def.id === id) n += s.stacks; return n; }
  get(e, id) { return e.st.find((s) => s.def.id === id); }
  hasTag(e, tag) { return e.st.some((s) => s.def.tags?.includes(tag)); }

  /**
   * @param {any} target
   * @param {string} statusId
   * @param {{source?:any, duration?:number, potency?:number, stacks?:number, snapshot?:number, build?:number, durMult?:number, silent?:boolean}} [o]
   */
  apply(target, statusId, o = {}) {
    if (!target || target.dead || !target.st) return null;
    const def = this.def(statusId);
    const now = this.now();
    if (target.statusImmune?.has(statusId)) { this.stats.resisted++; return null; }
    if (def.behavior === 'control' && target.ccImmune?.includes?.(def.ctl?.[0]) ) { this.stats.resisted++; return null; }
    if ((target.imm[statusId] ?? 0) > now) { this.stats.resisted++; return null; }

    let duration = (o.duration ?? def.duration) * (o.durMult ?? 1);
    if (def.behavior === 'control' || statusId === 'st.slowed') duration *= 1 - (target.ccResist ?? 0);
    if (def.dr) {
      const mem = target.drMem[statusId];
      if (mem && mem.until > now) {
        duration *= Math.max(def.dr.min, def.dr.factor ** mem.count);
        mem.count++; mem.until = now + def.dr.window;
      } else target.drMem[statusId] = { count: 1, until: now + def.dr.window };
    }
    if (duration <= 0.05) return null;
    const potency = o.potency ?? 1;
    let inst = this.get(target, statusId);

    if (def.behavior === 'chill') {
      inst ??= this.#create(target, def, { duration, potency, source: o.source });
      inst.progress = (inst.progress ?? 0) + (o.build ?? 40) * potency;
      inst.remaining = Math.max(inst.remaining, duration);
      inst.lastBuild = now;
      if (inst.progress >= def.freezeThreshold) {
        this.remove(target, statusId, 'converted');
        this.apply(target, def.freezeStatus, { source: o.source, durMult: o.durMult });
      } else this.#refreshMods(target, inst);
      this.#afterApply(target, def, inst, o);
      return inst;
    }

    switch (def.stacking) {
      case 'stack': case 'stacker': {
        if (inst) {
          inst.stacks = Math.min(def.maxStacks ?? 99, inst.stacks + (o.stacks ?? 1));
          inst.remaining = Math.max(inst.remaining, duration);
          if (o.snapshot) inst.snapshot = Math.max(inst.snapshot ?? 0, o.snapshot);
          this.#refreshMods(target, inst);
        } else inst = this.#create(target, def, { duration, potency, source: o.source, snapshot: o.snapshot, stacks: o.stacks ?? 1 });
        break;
      }
      case 'independent': {
        const same = target.st.filter((s) => s.def.id === statusId);
        if (same.length >= (def.maxStacks ?? 8)) {
          const weakest = same.reduce((a, b) => ((a.snapshot ?? 0) * a.remaining < (b.snapshot ?? 0) * b.remaining ? a : b));
          if ((o.snapshot ?? 0) <= (weakest.snapshot ?? 0)) { this.stats.resisted++; return null; }
          this.#destroy(target, weakest, 'replaced');
        }
        inst = this.#create(target, def, { duration, potency, source: o.source, snapshot: o.snapshot });
        break;
      }
      case 'strongest': {
        if (inst) {
          if ((o.snapshot ?? 0) * potency >= (inst.snapshot ?? 0) * inst.potency) { inst.snapshot = o.snapshot; inst.potency = potency; inst.source = o.source ?? inst.source; }
          inst.remaining = Math.max(inst.remaining, duration);
          this.#refreshMods(target, inst);
        } else inst = this.#create(target, def, { duration, potency, source: o.source, snapshot: o.snapshot });
        break;
      }
      default: { // refresh
        if (inst) { inst.remaining = Math.max(inst.remaining, duration); inst.potency = Math.max(inst.potency, potency); this.#refreshMods(target, inst); }
        else inst = this.#create(target, def, { duration, potency, source: o.source, snapshot: o.snapshot });
      }
    }

    if (def.behavior === 'stacker' && def.burstAt && inst.stacks >= def.burstAt) {
      const amount = (inst.snapshot ?? this.bal.enemyHit(target.level ?? 1, 0.05)) * def.burstCoef;
      this.remove(target, statusId, 'burst');
      this.hooks.burst?.({ target, source: o.source, amount, type: def.burstType, radius: def.burstRadius, statusId });
      this.events.emit('status:burst', { target, statusId });
      return null;
    }
    this.#afterApply(target, def, inst, o);
    return inst;
  }

  #afterApply(target, def, inst, o) {
    this.stats.applied++;
    this.recomputeCtl(target);
    if (!o.silent) this.events.emit('status:applied', { target, statusId: def.id, source: o.source, stacks: inst.stacks });
    this.#react('applied', target, o.source, { status: def.id, amount: inst.snapshot ?? 0 });
  }

  #create(target, def, { duration, potency = 1, source, snapshot, stacks = 1 }) {
    const inst = {
      uid: uidCounter++, def, remaining: duration, total: duration, potency, stacks, source,
      snapshot, tickT: def.tick ?? 0, progress: 0, appliedAt: this.now(),
    };
    target.st.push(inst);
    this.#refreshMods(target, inst);
    return inst;
  }

  #refreshMods(target, inst) {
    const key = `st:${inst.uid}`;
    target.stats.remove(key);
    const def = inst.def;
    const mods = [];
    for (const m of def.mods ?? []) {
      const scale = (m.perStack ? inst.stacks : 1);
      const v = m.value * scale * (m.value < 0 ? 1 : Math.min(inst.potency, 2)) ;
      mods.push({ ...m, value: v });
    }
    if (def.behavior === 'chill') {
      const f = Math.min(1, inst.progress / def.freezeThreshold);
      const slow = def.slowMin + (def.slowMax - def.slowMin) * f;
      mods.push({ stat: 'moveSpeed', op: 'more', group: 'slow', value: -slow }, { stat: 'actionSpeed', op: 'more', group: 'slow', value: -slow * 0.6 });
    }
    if (mods.length) target.stats.add(key, mods);
  }

  recomputeCtl(e) {
    const ctl = e.ctl;
    ctl.stunned = ctl.frozen = ctl.silenced = ctl.rooted = ctl.cloaked = false;
    for (const s of e.st) for (const c of s.def.ctl ?? []) ctl[c] = true;
    if (ctl.frozen) ctl.stunned = true; // frozen implies unable to act
  }

  remove(e, id, reason = 'removed') {
    const list = e.st.filter((s) => s.def.id === id);
    for (const s of list) this.#destroy(e, s, reason);
    return list.length > 0;
  }

  #destroy(e, inst, reason) {
    const i = e.st.indexOf(inst);
    if (i < 0) return;
    e.st.splice(i, 1);
    e.stats.remove(`st:${inst.uid}`);
    if (inst.def.immuneAfter && reason !== 'cleared') e.imm[inst.def.id] = this.now() + inst.def.immuneAfter;
    this.recomputeCtl(e);
    this.events.emit('status:expired', { target: e, statusId: inst.def.id, reason });
  }

  clear(e, pred = () => true) {
    for (const s of [...e.st]) if (pred(s.def)) this.#destroy(e, s, 'cleared');
  }

  /** advance statuses by dt seconds */
  tick(e, dt) {
    if (!e.st.length) return;
    const moving = (e.vx ?? 0) ** 2 + (e.vz ?? 0) ** 2 > 0.25;
    for (const s of [...e.st]) {
      s.remaining -= dt;
      const def = s.def;
      if (def.behavior === 'dot' && s.snapshot) {
        s.tickT -= dt;
        while (s.tickT <= 0 && s.remaining > -0.01) {
          s.tickT += def.tick;
          let amount = s.snapshot * def.dotCoef * s.potency * def.tick * s.stacks;
          if (def.movingBonus && moving) amount *= 1 + def.movingBonus;
          this.hooks.dealDot?.({ target: e, source: s.source, amount, type: def.damageType, statusId: def.id, ignoreArmor: !!def.ignoreArmor });
          if (e.dead) return;
        }
      }
      if (def.behavior === 'chill' && this.now() - (s.lastBuild ?? 0) > 1) {
        s.progress -= 22 * dt;
        if (s.progress <= 0) s.remaining = 0; else this.#refreshMods(e, s);
      }
      if (s.remaining <= 0) this.#destroy(e, s, 'expired');
    }
  }

  /** notify of a landed hit so reactions can fire. hit: {source, type, amount, crit} */
  onHit(target, hit) {
    this.#react('hit', target, hit.source, hit);
    if (hit.crit) this.#react('crit', target, hit.source, hit);
  }

  #react(trigger, target, source, info) {
    if (!this.reactions.length || target.dead) return;
    const now = this.now();
    for (const r of this.reactions) {
      if (r.trigger !== trigger) continue;
      if (trigger === 'applied' && r.status !== info.status) continue;
      if (trigger === 'hit' && r.hitTypes && !r.hitTypes.includes(info.type)) continue;
      if (!r.requires.every((id) => this.has(target, id))) continue;
      const key = `${r.id}:${target.uid ?? ''}`;
      if ((this.#icd[key] ?? 0) > now) continue;
      this.#icd[key] = now + r.icd;
      this.stats.reactions++;
      this.#runEffect(r, target, source, info);
    }
  }
  #icd = {};

  #runEffect(r, target, source, info) {
    const fx = r.effect;
    const base = info.amount || 0;
    switch (fx.op) {
      case 'burst':
        if (fx.removeStatus) this.remove(target, fx.removeStatus, 'reaction');
        this.hooks.burst?.({ target, source, amount: base * fx.coef, type: fx.type, radius: fx.radius, statusId: r.id });
        break;
      case 'echoHit':
        if (fx.removeStatus) this.remove(target, fx.removeStatus, 'reaction');
        this.hooks.echoHit?.({ target, source, amount: base * fx.coef, type: info.type ?? 'sonic' });
        break;
      case 'consumeStacks': {
        const n = this.stacks(target, fx.status);
        this.remove(target, fx.status, 'reaction');
        if (n > 0) this.hooks.burst?.({ target, source, amount: (info.amount || 1) * fx.perStackCoef * n, type: fx.type, radius: 1.6, statusId: r.id });
        break;
      }
      case 'chainDamage':
        this.hooks.chainDamage?.({ target, source, amount: (this.get(target, 'st.shocked')?.snapshot ?? info.amount ?? 10) * fx.coef, type: fx.type, radius: fx.radius, targets: fx.targets });
        break;
      case 'refund':
        this.hooks.refund?.({ source, fraction: fx.resource });
        break;
      default: log.warn(`unknown reaction op ${fx.op}`);
    }
    this.events.emit('status:reaction', { reaction: r.id, target, source });
  }
}

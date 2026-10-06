/**
 * ResourceSystem — class resources configured purely by data (classes/*.json → resource{}).
 *   Tañido (Toll)  : builds from hitting/being hit, decays out of combat, ≥80 grants Resonating
 *   Fulgor         : builds from casting, ≥60 Incandescent (+dmg), 100 = Dazzle overload
 *   Ritmo (Tempo)  : stacks from movement/dodges, each stack = speed, lost when hit
 */
export class ResourceSystem {
  constructor(world) { this.w = world; }

  init(e, cfg) {
    e.res = { cfg, id: cfg.id, value: cfg.start ?? 0, max: cfg.max, lastGain: -99, moveAcc: 0, stackShown: -1 };
    e.stats.add('res:base', [{ stat: 'resourceMax', op: 'base', value: cfg.max }]);
  }

  max(e) { return e.res ? Math.max(1, e.stats.get('resourceMax') || e.res.cfg.max) : 0; }

  gain(e, amount, reason = '') {
    const r = e.res;
    if (!r || amount === 0) return 0;
    const a = amount > 0 ? amount * e.stats.get('resourceGain', EMPTY, e.flags) : amount;
    const before = r.value;
    r.value = Math.max(0, Math.min(this.max(e), r.value + a));
    if (a > 0) r.lastGain = this.w.time;
    return r.value - before;
  }
  gainFraction(e, f) { if (e.res) this.gain(e, this.max(e) * f, 'refund'); }

  canAfford(e, cost) {
    if (!cost || !cost.amount) return true;
    if (cost.res === 'life') return e.hp > this.lifeCost(e, cost) + 1;
    if (!e.res || e.res.id !== cost.res) return cost.res === 'none';
    return e.res.value + 1e-6 >= this.cost(e, cost);
  }
  cost(e, cost) {
    if (cost.res === 'life') return this.lifeCost(e, cost);
    return cost.amount * e.stats.get('resourceCost', EMPTY, e.flags);
  }
  lifeCost(e, cost) { return Math.round(e.hpMax * (cost.pct ?? 0.05)); }
  spend(e, cost) {
    if (!cost || !cost.amount) return;
    if (cost.res === 'life') { e.hp = Math.max(1, e.hp - this.lifeCost(e, cost)); return; }
    if (e.res?.id === cost.res) e.res.value = Math.max(0, e.res.value - this.cost(e, cost));
  }

  onHit(source, target, info) {
    if (source?.res && source.res.cfg.onHit && !info.dot && (info.ab ? !info.ab.noResourceGain : true)) this.gain(source, source.res.cfg.onHit, 'hit');
    if (target?.res && target.res.cfg.onHurt) this.gain(target, target.res.cfg.onHurt, 'hurt');
    if (target?.res && target.flags.has('damageToToll') && info.life > 0) this.gain(target, info.life / target.hpMax * 100 * 0.9, 'conversion');
  }
  onKill(killer, victim) { if (killer?.res?.cfg.onKill) this.gain(killer, killer.res.cfg.onKill, 'kill'); }
  onDodge(e, perfect) {
    const c = e.res?.cfg;
    if (!c) return;
    if (c.onDodge) this.gain(e, c.onDodge, 'dodge');
    if (perfect && c.onPerfectDodge) this.gain(e, c.onPerfectDodge, 'perfect');
  }

  update(e, dt) {
    const r = e.res;
    if (!r) return;
    const c = r.cfg, now = this.w.time;
    // movement-based gain
    if (c.moveGainDist && (e.vx || e.vz)) {
      r.moveAcc += Math.hypot(e.vx, e.vz) * dt;
      while (r.moveAcc >= c.moveGainDist) { r.moveAcc -= c.moveGainDist; this.gain(e, c.moveGain ?? 1, 'move'); }
    }
    // decay
    if (c.decay && !e.flags.has('noDecay') && now - r.lastGain > c.decay.delay && (c.decay.outOfCombatOnly ? now - Math.max(e.lastHitTime, e.lastHurtTime) > c.decay.delay : true)) {
      r.value = Math.max(0, r.value - c.decay.rate * dt);
    }
    if (c.regen) r.value = Math.max(0, Math.min(this.max(e), r.value + c.regen * dt * e.stats.get('resourceRegen')));
    // thresholds → status buffs
    for (const t of c.thresholds ?? []) {
      const at = t.at - (t.status === 'st.incandescent' ? (e.stats.get('thresholdShift') || 0) : 0);
      const on = r.value >= at;
      const cur = this.w.status.get(e, t.status);
      if (on && (!cur || cur.remaining < 0.15)) this.w.status.apply(e, t.status, { duration: 0.5, silent: true });
      else if (!on && cur) this.w.status.remove(e, t.status, 'threshold');
    }
    // stack-based speed (Ritmo)
    if (c.perStack) {
      const n = Math.min(c.maxStacks ?? 99, Math.floor(r.value + 1e-6));
      if (n !== r.stackShown) {
        r.stackShown = n;
        e.stats.remove('res:stacks');
        if (n > 0) e.stats.add('res:stacks', c.perStack.map((m) => ({ ...m, value: m.value * n })));
      }
    }
    // overflow
    if (c.overflow && r.value >= this.max(e) - 1e-6) {
      if (e.flags.has('noOverload')) r.value = this.max(e) - 0.01;
      else this.#overflow(e, c.overflow);
    }
  }

  #overflow(e, o) {
    const w = this.w;
    w.status.apply(e, o.status ?? 'st.dazzled', { silent: false });
    e.res.value = o.resetTo ?? 0;
    const big = e.flags.has('bigOverload');
    const amount = w.balance.expectedLife(e.level) * (o.burstPct ?? 0.2) * 0.25 * (big ? 3 : 1);
    w.events.emit('resource:overflow', { entity: e, resource: e.res.id });
    for (const v of w.queryCircle(e.x, e.z, (o.radius ?? 3.5) * (big ? 1.6 : 1), (x) => w.isHostile(e, x))) w.dealDirect(e, v, amount * e.stats.get('damage', ['area']), 'fire', { reaction: true });
  }
}
const EMPTY = [];

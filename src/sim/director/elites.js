/**
 * Elite modifiers — each one changes behaviour mechanically (not just numbers), and combinations are
 * constrained by exclusion lists, role filters and a "danger budget" that grows with level so a fight
 * is never an unfair pile-up (e.g. no Twins+Barrier, no Blinker+Mine Layer).
 */
const DANGER = { 'elm.hush_aura': 2, 'elm.twins': 3, 'elm.barrier': 2, 'elm.blinker': 3, 'elm.absorb': 1, 'elm.warcry': 2, 'elm.mine_layer': 2, 'elm.frenzy': 2, 'elm.swift': 1 };

export function eliteBudget(level) { return level < 4 ? 3 : level < 8 ? 5 : 6; }
export function eliteMaxMods(level) { return level < 4 ? 1 : level < 8 ? 2 : 3; }

export function pickEliteMods(registry, def, level, rng, count) {
  const all = registry.all('eliteMod');
  const chosen = [];
  let budget = eliteBudget(level);
  const n = Math.min(count ?? rng.int(1, eliteMaxMods(level)), eliteMaxMods(level));
  for (let i = 0; i < n; i++) {
    const pool = all.filter((m) => m.minLevel <= level && !chosen.includes(m.id)
      && !chosen.some((c) => registry.get(c).exclusive?.includes(m.id) || m.exclusive?.includes(c))
      && !(m.excludeRoles ?? []).some((r) => def.role?.includes(r)) && (DANGER[m.id] ?? 1) <= budget);
    if (!pool.length) break;
    const m = rng.weighted(pool, (x) => x.weight);
    chosen.push(m.id); budget -= DANGER[m.id] ?? 1;
  }
  return chosen;
}

export class ElitesSystem {
  constructor(world) {
    this.w = world;
    world.events.on('ai:aggro', (i) => {
      const e = i.entity;
      for (const h of e.eliteHooks ?? []) if (h.onAggro && !h.done) { h.done = true; this.#cast(e, h); }
    });
  }

  /** turn a freshly created enemy into an elite with the given modifier ids */
  apply(e, modIds) {
    const w = this.w, reg = w.registry;
    e.eliteMods = modIds.slice();
    e.eliteHooks = [];
    e.eliteColor = reg.get(modIds[0])?.color ?? '#ffcf5a';
    e.eliteExtraDrops = Math.max(0, modIds.length - 1);
    let hpMult = 1;
    for (const id of modIds) {
      const m = reg.require(id, 'eliteMod');
      hpMult *= m.hpMult ?? 1;
      if (m.mods) e.stats.add(`elite:${id}`, m.mods);
      for (const h of m.hooks ?? []) e.eliteHooks.push({ ...h, next: w.time + (h.first ?? h.every ?? 5) + (e.uid % 3) * 0.4 });
      if (m.shield) { e.eliteBarrier = true; w.addShield(e, e.hpMax * m.shield); e.shieldMax = 0; }
      if (m.absorbTags) { const prev = e.damageGate; e.damageGate = function absorb(dmg, ctx) { const base = prev ? (prev.call(this, dmg, ctx) ?? dmg) : dmg; if (ctx.ab?.tags?.some((t) => m.absorbTags.includes(t))) { this.hp = Math.min(this.hpMax, this.hp + base * 0.6); this.world?.events?.emit('elite:absorb', { entity: this }); return 1; } return base; }; e.world = w; }
      if (m.lowHp) e.eliteLowHp = m.lowHp;
    }
    if (hpMult !== 1) { e.stats.add('elite:hp', [{ stat: 'life', op: 'more', group: 'elite', value: hpMult - 1 }]); w.refreshLife(e, true); }
    e.damageMult *= 1.1;
    return e;
  }

  update() {
    const w = this.w;
    for (const e of w.entities) {
      if (!e.eliteMods || e.dead || e.asleep) continue;
      const tgt = e.ai?.target;
      for (const h of e.eliteHooks) {
        if (h.onAggro || w.time < h.next) continue;
        if (!tgt || tgt.dead) { h.next = w.time + 1; continue; }
        if (e.cast || e.ctl.stunned) { h.next = w.time + 0.4; continue; }
        if (h.needsTarget && Math.hypot(tgt.x - e.x, tgt.z - e.z) > 14) { h.next = w.time + 1; continue; }
        h.next = w.time + h.every;
        this.#cast(e, h);
      }
      if (e.eliteBarrier && !e.barrierBroken && e.shield <= 0) { e.barrierBroken = true; w.status.apply(e, 'st.vulnerable', { duration: 4 }); w.events.emit('elite:barrier_break', { entity: e }); }
      if (e.eliteLowHp && !e.frenzied && e.hp / e.hpMax < e.eliteLowHp.below) {
        e.frenzied = true; w.status.apply(e, e.eliteLowHp.status, { duration: 60 });
        e.stats.add('elite:frenzy', [{ stat: 'moveSpeed', op: 'more', group: 'elite', value: e.eliteLowHp.speed }]);
        w.events.emit('elite:frenzy', { entity: e });
      }
    }
  }

  #cast(e, h) {
    const t = e.ai?.target;
    this.w.abilities.tryCast(e, h.ability, t?.x ?? e.x, t?.z ?? e.z, { free: true, target: t?.uid });
  }
}

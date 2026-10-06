/**
 * Damage model — ONE pipeline for everyone (player, enemies, DoTs, reactions).
 *
 *   base      = scalingBase(source, effect) × coef (+ flat added scaled by coef)
 *   outgoing  = base × damage(tags)          ← damage = (1 + Σinc) × Π_group(1 + more_group)  [caps in balance.json]
 *   crit      = × critMult   with  P = critChance(tags) + ability bonus + target.critChanceTaken
 *   mitigated = outgoing × (1 − armorReduction)         for physical (unless ignoreArmor)
 *             | outgoing × (1 − clamp(res − pen, −1, cap)) for elements
 *             × target.damageTaken                       ← vulnerable/ward groups multiply here, floor 0.2
 *   final     = max(1, round(mitigated))   → absorbed by shield first, then life
 *
 * Documented in docs/BALANCE.md §"Cómo se calcula el daño".
 */
export const DAMAGE_TYPES = ['physical', 'fire', 'frost', 'shock', 'toxic', 'sonic', 'hollow'];

export class DamageModel {
  constructor(balance) { this.bal = balance; }

  /** base damage before modifiers */
  scalingBase(source, eff) {
    const sc = eff.scaling ?? (source.team === 'player' ? 'weapon' : 'pct');
    if (source.owner && (sc === 'weapon' || sc === 'spell')) source = source.owner;
    const coef = eff.coef ?? 1;
    switch (sc) {
      case 'weapon': return (source.weaponHit ?? this.bal.weaponHit(source.level ?? 1) * 0.6) * coef;
      case 'spell': return (source.spellHit ?? this.bal.weaponHit(source.level ?? 1) * 0.6) * coef;
      case 'pct': return (source.hitScale ?? this.bal.enemyHit(source.level ?? 1, 1)) * (eff.pct ?? 0.05) * (source.damageMult ?? 1);
      case 'flat': return eff.flat ?? 1;
      case 'lifeMax': return source.hpMax * (eff.pct ?? 0.1);
      default: return coef;
    }
  }

  /**
   * @param {any} source
   * @param {{type:string, coef?:number, scaling?:string, pct?:number, flat?:number, critBonus?:number}} eff
   * @param {string[]} tags ability tags (+ extra such as 'hit')
   * @param {{next:()=>number}} rng
   * @param {{target?:any, extraMore?:number, forceCrit?:boolean, noCrit?:boolean, flags?:Set<string>}} [opts]
   */
  roll(source, eff, tags, rng, opts = {}) {
    const type = eff.type ?? 'physical';
    const qtags = tags.includes(type) ? tags : [...tags, type];
    let base = this.scalingBase(source, eff);
    const flatAdded = source.stats.get('damageFlat', qtags, source.flags ?? undefined) ?? 0;
    if (flatAdded) base += flatAdded * Math.min(1, eff.coef ?? 1) * (source.team === 'player' ? this.bal.P(source.level ?? 1) / 4 : 1);
    const flags = opts.flags ?? source.flags ?? EMPTY_FLAGS;
    let out = base * source.stats.get('damage', qtags, flags);
    if (opts.extraMore) out *= 1 + opts.extraMore;
    let crit = false;
    if (!opts.noCrit && !eff.noCrit) {
      let cc = source.stats.get('critChance', qtags, flags) + (eff.critBonus ?? 0) + (opts.target?.stats?.get('critChanceTaken') ?? 0);
      cc = Math.min(this.bal.caps().critChance, Math.max(0, cc));
      crit = opts.forceCrit || rng.next() < cc;
      if (crit) out *= source.stats.get('critMult', qtags, flags);
    }
    return { base, amount: out, type, crit, tags: qtags };
  }

  /** defensive side. Returns final integer damage before shield absorption */
  mitigate(target, amount, type, o = {}) {
    let a = amount;
    if (type === 'physical') {
      if (!o.ignoreArmor) a *= 1 - this.bal.armorReduction(Math.max(0, target.stats.get('armor') - (o.armorPen ?? 0)), o.attackerLevel ?? target.level ?? 1);
    } else {
      const res = Math.min(this.bal.caps().resist, target.stats.get(`res.${type}`) - (o.pen ?? 0));
      a *= 1 - Math.max(-1, res);
    }
    a *= target.stats.get('damageTaken');
    return Math.max(1, Math.round(a));
  }
}

const EMPTY_FLAGS = new Set();

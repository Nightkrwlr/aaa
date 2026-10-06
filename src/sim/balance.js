/**
 * Balance — the single source of numeric truth. Every system asks this module for level-scaled numbers.
 * Parameters live in data/balance/balance.json (changing balance never requires touching logic).
 *
 * Power index  P(L) = 1 + a·(L−1) + b·(L−1)²
 *   expected player life    = life0 · P(L)
 *   expected player DPS     = dps0  · P(L)
 *   enemy HP                = DPS(L) · TTK(tier) · hpMult · difficultyHp      ← no HP sponges: HP follows "time to kill"
 *   enemy hit damage        = life(L) · pctLife · difficultyDamage            ← damage follows the player's expected life
 */
import { clamp } from '../core/math.js';

export class Balance {
  /** @param {any} data bal.main entry */
  constructor(data) {
    this.d = data;
    this.levelCap = data.levelCap;
  }

  static from(registry) { return new Balance(registry.require('bal.main', 'balance')); }

  /** power index */
  P(level) {
    const l = clamp(level, 1, this.levelCap + 20) - 1;
    const { linear, quadratic } = this.d.power;
    return 1 + linear * l + quadratic * l * l;
  }

  expectedLife(level) { return this.d.player.life * this.P(level); }
  expectedDps(level) { return this.d.player.dps * this.P(level); }
  /** armor needed to have ~33 % reduction at level L */
  armorK(level) { return this.d.player.armorK * this.P(level); }
  expectedArmor(level) { return this.armorK(level) * 0.5; }

  /** physical mitigation fraction for `armor` vs an attacker of `level` */
  armorReduction(armor, level) {
    if (armor <= 0) return 0;
    const k = this.armorK(level);
    return Math.min(this.d.caps.armorReduction, armor / (armor + k));
  }

  /** weapon "hit" value for ilvl: average damage of a coefficient‑1.0 hit before gear/talent multipliers */
  weaponHit(ilvl) { return this.expectedDps(ilvl) * this.d.items.weaponHitFraction; }

  tier(name) {
    const t = this.d.enemyTiers[name];
    if (!t) throw new Error(`Balance: unknown tier ${name}`);
    return t;
  }

  enemyHp(level, tier, hpMult = 1, difficulty = 'seeker') {
    const dm = this.d.enemyDamage.difficultyHp[difficulty] ?? 1;
    return Math.max(8, Math.round(this.expectedDps(level) * this.tier(tier).ttk * hpMult * dm));
  }

  /** absolute damage of an enemy attack expressed as a fraction of the player's expected life */
  enemyHit(level, pctLife, damageMult = 1, difficulty = 'seeker') {
    const dd = this.d.enemyDamage.difficultyDamage[difficulty] ?? 1;
    return Math.max(1, this.expectedLife(level) * pctLife * damageMult * dd);
  }

  playerBaseLife(level) { return Math.round(this.expectedLife(level) * this.d.player.baseLifeShareOfExpected); }

  /** XP */
  xpPerStandard(level) { const x = this.d.xp; return x.perStandardBase * this.P(level) ** x.perStandardExponent; }
  xpToNext(level) {
    const x = this.d.xp;
    return Math.round(this.xpPerStandard(level) * (x.killsPerLevelBase + x.killsPerLevelSlope * level));
  }
  /** cumulative xp required to reach `level` */
  xpTotalFor(level) { let s = 0; for (let l = 1; l < level; l++) s += this.xpToNext(l); return s; }
  xpFor(enemyLevel, tier, playerLevel) {
    const x = this.d.xp;
    const gap = playerLevel - enemyLevel;
    const penalty = gap > x.levelGapPenaltyStart ? Math.max(x.minFactor, 1 - (gap - x.levelGapPenaltyStart) * x.levelGapPenaltyStep) : 1;
    return Math.max(1, Math.round(this.xpPerStandard(enemyLevel) * this.tier(tier).xp * penalty));
  }

  /** chimes (currency) */
  chimeUnit(level) { const e = this.d.economy; return e.chimeUnit * this.P(level) ** e.chimeUnitExponent; }
  chimesFor(level, tier) { return Math.max(1, Math.round(this.chimeUnit(level) * this.tier(tier).chimes)); }
  sellValue(ilvl, rarity, affixCount = 0) {
    const e = this.d.economy;
    return Math.max(1, Math.round(this.chimeUnit(ilvl) * (e.rarityValue[rarity] ?? 1) * (1 + affixCount * 0.15) * e.sellFraction * 4));
  }
  buyValue(ilvl, rarity, affixCount = 0) { return Math.round(this.sellValue(ilvl, rarity, affixCount) / this.d.economy.sellFraction * 0.8); }
  respecCost(level, timesUsed) {
    const r = this.d.economy.respec;
    if (timesUsed < r.freeRespecs) return 0;
    const n = timesUsed - r.freeRespecs;
    return Math.round(this.chimeUnit(level) * r.base * Math.min(r.cap, 1 + r.growth * n) * 4);
  }
  reforgeCost(ilvl, affixCount, times) {
    const r = this.d.economy.reforge;
    return Math.round(this.chimeUnit(ilvl) * r.base * (1 + r.perAffixStep * affixCount) * (1 + 0.25 * times));
  }
  upgradeCost(ilvl, tierLevel) { const u = this.d.economy.upgrade; return Math.round(this.chimeUnit(ilvl) * u.base * (1 + u.step * tierLevel)); }

  /** percent-affix scaling factor by item level (0.55 → 1.0) */
  affixPercentScale(ilvl) {
    const s = this.d.items.affixPercentScale;
    return s.atLevel1 + (s.atCap - s.atLevel1) * clamp((ilvl - 1) / (this.levelCap - 1), 0, 1);
  }
  /** flat-affix scaling by item level */
  affixFlatScale(ilvl) { return this.P(ilvl); }

  rarity(name) { return this.d.items.rarity[name]; }
  cadence() { return this.d.cadence; }
  caps() { return this.d.caps; }
  moreGroupCaps() { return this.d.moreGroupCaps; }
  statRules() { return { moreGroupCaps: this.d.moreGroupCaps, moreGroupCap: this.d.caps.moreGroupCap, incCap: this.d.caps.increasedDamage }; }
}

/**
 * Build-aware item comparison. Instead of a single green/red arrow it reports several dimensions
 * (offence, survivability, utility) and flags which stats matter to the character's current skills.
 */
export function summarize(character, equipment, alloc = character.alloc) {
  const bal = character.bal;
  const { sb, weapon } = character.buildStatBlock(equipment, alloc);
  const primary = character.reg.get(character.loadout.primary);
  const tags = [...(primary?.tags ?? [])];
  const eff = primary?.effects?.[0]?.hit?.find((h) => h.op === 'damage') ?? primary?.effects?.[0]?.onHit?.[0] ?? { type: 'physical', coef: 1, scaling: 'weapon' };
  const type = eff.type ?? 'physical';
  const qt = tags.includes(type) ? tags : [...tags, type];
  const base = ((eff.scaling === 'spell' ? weapon?.spell : weapon?.hit) ?? bal.weaponHit(character.level) * (character.cls.profile.unarmedMult ?? 0.6)) * (eff.coef ?? 1);
  const flat = sb.get('damageFlat', qt) * 0.01 * bal.P(character.level);
  const dmg = (base + flat) * sb.get('damage', qt);
  const cc = Math.min(0.75, sb.get('critChance', qt));
  const speed = sb.get('actionSpeed', tags);
  const hitsPerSec = speed / ((primary?.cast?.windup ?? 0.2) + (primary?.cast?.recover ?? 0.25));
  const dps = dmg * (1 + cc * (sb.get('critMult', qt) - 1)) * hitsPerSec;
  const life = sb.get('life');
  const armorRed = bal.armorReduction(sb.get('armor'), character.level);
  const avgRes = ['fire', 'frost', 'shock', 'sonic', 'toxic'].reduce((s, t) => s + sb.get(`res.${t}`), 0) / 5;
  const ehp = (life + sb.get('shieldMax')) / (1 - (armorRed * 0.5 + avgRes * 0.5)) / sb.get('damageTaken');
  return {
    dps: Math.round(dps * 10) / 10, burst: Math.round(dmg * (1 + cc * (sb.get('critMult', qt) - 1)) * 3 * 10) / 10, life: Math.round(life), ehp: Math.round(ehp), armor: Math.round(sb.get('armor')), armorReduction: armorRed,
    moveSpeed: Math.round(sb.get('moveSpeed') * 100) / 100, cooldownRate: sb.get('cooldownRate'), resourceGain: sb.get('resourceGain'), crit: cc, listenRange: sb.get('listenRange'),
    res: Object.fromEntries(['fire', 'frost', 'shock', 'toxic', 'sonic', 'hollow'].map((t) => [t, sb.get(`res.${t}`)])),
    statusChance: sb.get('statusChance'), chordWindow: sb.get('chord.window'), pickup: sb.get('pickupRadius'),
  };
}

/** @returns {{rows:{key:string,before:number,after:number,delta:number,pct:number,relevant:boolean}[], verdict:string, slot:string}} */
export function compareItem(character, factory, item, slot) {
  slot ??= character.slotFor(item);
  const before = summarize(character, character.equipment);
  const after = summarize(character, { ...character.equipment, [slot]: item });
  const buildTags = new Set(character.buildTags());
  const keys = ['dps', 'burst', 'ehp', 'life', 'armor', 'moveSpeed', 'cooldownRate', 'resourceGain', 'crit', 'listenRange', 'statusChance', 'chordWindow'];
  const rows = [];
  for (const k of keys) {
    const b = before[k], a = after[k], d = a - b;
    if (Math.abs(d) < 1e-6) continue;
    rows.push({ key: k, before: b, after: a, delta: d, pct: b ? d / b : 1, relevant: (k === 'dps' || k === 'burst') || (k === 'chordWindow' && buildTags.size > 0) });
  }
  for (const t of Object.keys(before.res)) {
    const d = after.res[t] - before.res[t];
    if (Math.abs(d) > 1e-6) rows.push({ key: `res.${t}`, before: before.res[t], after: after.res[t], delta: d, pct: d, relevant: false });
  }
  const dps = rows.find((r) => r.key === 'dps')?.pct ?? 0, ehp = rows.find((r) => r.key === 'ehp')?.pct ?? 0;
  const verdict = dps > 0.03 && ehp >= -0.03 ? 'upgrade' : dps >= -0.03 && ehp > 0.03 ? 'defensive' : dps > 0.03 && ehp < -0.03 ? 'trade_offense' : dps < -0.03 && ehp > 0.03 ? 'trade_defense' : Math.abs(dps) <= 0.03 && Math.abs(ehp) <= 0.03 ? 'sidegrade' : 'downgrade';
  const derived = factory.derive(item);
  const transforms = derived.patches.length + derived.flags.length + derived.triggers.length > 0;
  return { rows, verdict, slot, transforms, before, after };
}

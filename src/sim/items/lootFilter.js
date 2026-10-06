/**
 * Loot filter — hides low-relevance drops BEFORE they hit the floor (and converts them to chimes by default),
 * so the player never manages junk. Modes: all · normal · strict · custom. Never hides uniques or on-build gear
 * when `keepBuild` is set.
 */
const RAR = { common: 0, fine: 1, attuned: 2, relic: 3 };

export const DEFAULT_FILTER = { mode: 'normal', minRarity: 'common', convertHidden: true, keepBuild: true, keepUniques: true, ilvlSlack: 4, rules: [] };

/** @returns 'show' | 'hide' */
export function lootFilterAction(item, filter, ctx) {
  const f = { ...DEFAULT_FILTER, ...filter };
  if (f.mode === 'all') return 'show';
  if (item.unique && f.keepUniques) return 'show';
  const { reg, playerLevel, buildTags = [] } = ctx;
  const base = reg.get(item.base);
  const onBuild = f.keepBuild && item.affixes.some((a) => { const d = reg.get(a.id); return d && d.tags.some((t) => buildTags.includes(t)); });
  // custom rules (first match wins)
  for (const r of f.rules ?? []) {
    const w = r.when ?? {};
    if (w.rarity && !w.rarity.includes(item.rarity)) continue;
    if (w.slot && !w.slot.includes(base.slot)) continue;
    if (w.ilvlBelow !== undefined && !(item.ilvl < w.ilvlBelow)) continue;
    if (w.affixTag && !item.affixes.some((a) => reg.get(a.id)?.tags.includes(w.affixTag))) continue;
    return r.do === 'hide' ? 'hide' : 'show';
  }
  if (f.mode === 'strict') {
    if (RAR[item.rarity] >= RAR.attuned) return 'show';
    if (item.rarity === 'fine' && onBuild && item.ilvl >= playerLevel - 2) return 'show';
    return 'hide';
  }
  // normal: hide common/fine that are clearly behind the character and not on-build
  if (RAR[item.rarity] >= RAR.attuned) return 'show';
  if (item.rarity === 'common' && item.ilvl < playerLevel - f.ilvlSlack + 2 && !onBuild) return 'hide';
  if (item.rarity === 'fine' && item.ilvl < playerLevel - f.ilvlSlack && !onBuild) return 'hide';
  if (RAR[item.rarity] < RAR[f.minRarity]) return 'hide';
  return 'show';
}

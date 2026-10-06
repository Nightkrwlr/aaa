/**
 * Crafting — salvage, reforge, re-tune an affix, upgrade, sockets, recipes, gem fusion, professions.
 * Anti-"perfect item" rules:
 *   • STABILITY: every reforge / re-tune spends stability (Fine 5 · Attuned 6 · Relic 3 · Common 4). At 0 the item cracks and can't be reworked.
 *   • RISK: re-tuning an affix can crack the item (-2 stability); upgrades above +2 can fail and downgrade.
 *   • COST: chimes + materials scale with item level and with how often the item was already reworked.
 *   • Unique (relic) items: values can be reforged but never swapped for different affixes.
 */
const UP_CHANCE = [1, 0.95, 0.8, 0.65, 0.5];
const MAX_UP = 5;

export class Crafting {
  constructor(registry, balance, factory) { this.reg = registry; this.bal = balance; this.factory = factory; }

  // ───────────────────────── salvage
  salvageYield(item, rng) {
    const out = {};
    const k = 1 + item.ilvl / 30;
    const add = (id, n) => { if (n > 0) out[id] = (out[id] ?? 0) + Math.max(1, Math.round(n * k)); };
    switch (item.rarity) {
      case 'common': add('mat.resonant_dust', rng.int(1, 2)); break;
      case 'fine': add('mat.resonant_dust', rng.int(2, 4)); if (rng.chance(0.4)) add('mat.tuning_shard', 1); break;
      case 'attuned': add('mat.resonant_dust', rng.int(3, 6)); add('mat.tuning_shard', rng.int(1, 2)); if (rng.chance(0.2)) add('mat.echo_core', 1); break;
      case 'relic': add('mat.echo_core', rng.int(1, 2)); add('mat.tuning_shard', 2); add('mat.resonant_dust', 5); break;
      default: break;
    }
    const gems = (item.sockets ?? []).filter(Boolean);
    return { materials: out, gems, chimes: Math.round(this.factory.sellValue(item) * 0.25) };
  }

  salvage(character, iid, rng) {
    const item = character.inv.find(iid);
    if (!item) return { ok: false, reason: 'notfound' };
    if (item.locked || item.fav) return { ok: false, reason: 'locked' };
    const y = this.salvageYield(item, rng);
    character.inv.remove(iid);
    for (const [id, n] of Object.entries(y.materials)) character.inv.addMaterial(id, n);
    for (const g of y.gems) character.inv.addConsumable(g, 1, 99);
    character.inv.addChimes(y.chimes);
    return { ok: true, ...y };
  }

  sell(character, iid) {
    const item = character.inv.find(iid);
    if (!item) return { ok: false, reason: 'notfound' };
    if (item.locked || item.fav) return { ok: false, reason: 'locked' };
    const v = this.factory.sellValue(item);
    character.inv.remove(iid);
    character.inv.addChimes(v);
    return { ok: true, chimes: v };
  }

  // ───────────────────────── costs
  reworkCost(item, kind) {
    const times = item.reworks ?? 0;
    const af = item.affixes.length;
    const chimes = this.bal.reforgeCost(item.ilvl, af, times) * (kind === 'reroll' ? 0.7 : 1);
    const shards = (kind === 'reroll' ? 2 : 1) + Math.floor(af / 3) + Math.floor(times / 2);
    return { chimes, materials: { 'mat.tuning_shard': shards } };
  }
  upgradeCost(item) {
    const lvl = item.up ?? 0;
    return { chimes: this.bal.upgradeCost(item.ilvl, lvl), materials: { 'mat.echo_core': lvl + 1, 'mat.resonant_dust': 4 + lvl * 3 } };
  }

  #pay(character, cost) {
    if (character.inv.chimes < cost.chimes) return { ok: false, reason: 'chimes' };
    if (!character.inv.hasMaterials(cost.materials)) return { ok: false, reason: 'materials' };
    character.inv.spendChimes(cost.chimes); character.inv.spendMaterials(cost.materials);
    return { ok: true };
  }

  // ───────────────────────── reforge: re-roll all affix values, keep affixes
  reforge(character, iid, rng) {
    const item = this.#locate(character, iid);
    if (!item) return { ok: false, reason: 'notfound' };
    if (!item.affixes.length) return { ok: false, reason: 'noaffix' };
    if (item.stability <= 0) return { ok: false, reason: 'cracked' };
    const cost = this.reworkCost(item, 'reforge');
    const pay = this.#pay(character, cost); if (!pay.ok) return pay;
    const spec = this.bal.rarity(item.rarity);
    const floor = spec.rollFloor;
    // keep the better of old/new per affix 35% of the time: reforging explores, it doesn't strictly improve
    for (const a of item.affixes) a.q = floor + rng.next() * (1 - floor);
    item.stability--; item.reworks = (item.reworks ?? 0) + 1; item.crafted = true;
    this.#xp(character, 'forge', 6);
    return { ok: true, cost, stability: item.stability };
  }

  // ───────────────────────── re-tune: replace ONE affix (chosen) with a new one of the same side
  rerollAffix(character, iid, index, rng, { focusTag } = {}) {
    const item = this.#locate(character, iid);
    if (!item) return { ok: false, reason: 'notfound' };
    if (item.unique) return { ok: false, reason: 'unique' };
    if (item.stability <= 0) return { ok: false, reason: 'cracked' };
    const old = item.affixes[index];
    if (!old) return { ok: false, reason: 'noaffix' };
    const oldDef = this.reg.get(old.id);
    const base = this.reg.get(item.base);
    const used = new Set(item.affixes.map((a, i) => (i === index ? null : this.reg.get(a.id)?.group)));
    const cands = this.factory.affixes.filter((a) => a.type === oldDef.type && a.id !== old.id && !used.has(a.group) && a.slots.includes(base.slot) && a.minIlvl <= item.ilvl);
    if (!cands.length) return { ok: false, reason: 'nocandidates' };
    const cost = this.reworkCost(item, 'reroll');
    const pay = this.#pay(character, cost); if (!pay.ok) return pay;
    const bias = new Set([...(character.buildTags?.(null) ?? []), ...(focusTag ? [focusTag] : [])]);
    const pick = rng.weighted(cands, (a) => a.weight * (a.tags.some((t) => bias.has(t)) ? 2 : 1));
    const spec = this.bal.rarity(item.rarity);
    item.affixes[index] = { id: pick.id, q: spec.rollFloor + rng.next() * (1 - spec.rollFloor) };
    const crackChance = 0.12 + 0.06 * (item.reworks ?? 0);
    const cracked = rng.chance(crackChance);
    item.stability = Math.max(0, item.stability - (cracked ? 2 : 1));
    item.reworks = (item.reworks ?? 0) + 1; item.crafted = true;
    this.#xp(character, 'forge', 9);
    return { ok: true, cost, cracked, stability: item.stability, affix: pick.id };
  }

  // ───────────────────────── upgrade
  upgrade(character, iid, rng) {
    const item = this.#locate(character, iid);
    if (!item) return { ok: false, reason: 'notfound' };
    if ((item.up ?? 0) >= MAX_UP) return { ok: false, reason: 'max' };
    const cost = this.upgradeCost(item);
    const pay = this.#pay(character, cost); if (!pay.ok) return pay;
    const lvl = item.up ?? 0;
    const ok = rng.chance(UP_CHANCE[lvl]);
    if (ok) item.up = lvl + 1;
    else if (lvl >= 3 && rng.chance(0.3)) item.up = lvl - 1;
    this.#xp(character, 'forge', 5 + lvl * 3);
    return { ok: true, success: ok, up: item.up ?? 0, cost };
  }

  // ───────────────────────── sockets
  socket(character, iid, index, gemId) {
    const item = this.#locate(character, iid);
    if (!item) return { ok: false, reason: 'notfound' };
    if (index >= (item.sockets?.length ?? 0)) return { ok: false, reason: 'nosocket' };
    if (!character.inv.consumables[gemId]) return { ok: false, reason: 'nogem' };
    const prev = item.sockets[index];
    character.inv.useConsumable(gemId);
    if (prev) character.inv.addConsumable(prev, 1, 99); // swapping returns the old stone
    item.sockets[index] = gemId;
    this.#xp(character, 'runes', 4);
    return { ok: true, returned: prev };
  }
  extractGem(character, iid, index, rng) {
    const item = this.#locate(character, iid);
    const gem = item?.sockets?.[index];
    if (!gem) return { ok: false, reason: 'empty' };
    const cost = { chimes: this.bal.chimeUnit(item.ilvl) * 8, materials: {} };
    const pay = this.#pay(character, cost); if (!pay.ok) return pay;
    const survived = rng.chance(0.7);
    item.sockets[index] = null;
    if (survived) character.inv.addConsumable(gem, 1, 99);
    return { ok: true, survived };
  }
  fuseGems(character, stone, quality, rng) {
    const id = `gem.${stone}_${quality}`, next = `gem.${stone}_${quality + 1}`;
    if (!this.reg.has(next)) return { ok: false, reason: 'max' };
    if ((character.inv.consumables[id] ?? 0) < 3) return { ok: false, reason: 'nogem' };
    const cost = { chimes: this.bal.chimeUnit(character.level) * 6 * quality, materials: {} };
    const pay = this.#pay(character, cost); if (!pay.ok) return pay;
    character.inv.consumables[id] -= 3; if (!character.inv.consumables[id]) delete character.inv.consumables[id];
    character.inv.addConsumable(next, 1, 99);
    this.#xp(character, 'runes', 10 * quality);
    return { ok: true, gem: next };
  }

  // ───────────────────────── recipes
  recipesFor(category) { return this.reg.all('recipe').filter((r) => !category || r.category === category); }

  craft(character, recipeId, rng, opts = {}) {
    const r = this.reg.get(recipeId);
    if (!r) return { ok: false, reason: 'missing' };
    const prof = character.prof[r.category];
    if (prof.level < r.minProf) return { ok: false, reason: 'proflevel', need: r.minProf };
    const cost = { chimes: r.chimes, materials: r.inputs };
    const out = r.output;
    if (out.type === 'gem_fuse') return this.fuseGems(character, opts.stone, opts.quality ?? 1, rng);
    if (out.type === 'item' && out.slot === 'armor' && opts.slot && !['head', 'chest', 'hands', 'feet', 'offhand'].includes(opts.slot)) return { ok: false, reason: 'badslot' };
    if (character.inv.free < 1 && out.type === 'item') return { ok: false, reason: 'full' };
    const pay = this.#pay(character, cost); if (!pay.ok) return pay;
    let result = { ok: true, recipe: r.id };
    switch (out.type) {
      case 'refill': character.potion.charges = Math.min(character.potion.max, character.potion.charges + out.belt); break;
      case 'consumable': character.inv.addConsumable(out.id, out.count ?? 1); break;
      case 'gem': character.inv.addConsumable(out.id, 1, 99); break;
      case 'material': character.inv.addMaterial(out.id, out.count ?? 1); break;
      case 'item': {
        const slot = out.slot === 'armor' ? (opts.slot ?? 'chest') : out.slot === 'jewelry' ? (opts.slot ?? 'ring') : out.slot;
        const item = this.factory.roll(rng, { ilvl: character.level + 1, rarity: out.rarity, slot, tags: character.buildTags?.(null), classId: character.classId, focus: opts.focusTag, noUnique: true });
        item.crafted = true;
        character.inv.add(item);
        result.item = item;
        break;
      }
      default: return { ok: false, reason: 'unknown' };
    }
    this.#xp(character, r.category, 8 + r.minProf * 6);
    return result;
  }

  #locate(character, iid) {
    const inInv = character.inv.find(iid);
    if (inInv) return inInv;
    for (const it of Object.values(character.equipment)) if (it && it.iid === iid) return it;
    return null;
  }

  #xp(character, cat, amount) {
    const p = character.prof[cat]; if (!p) return;
    p.xp += amount;
    while (p.level < 10 && p.xp >= 40 * p.level ** 1.5) { p.xp -= Math.round(40 * p.level ** 1.5); p.level++; }
  }
}

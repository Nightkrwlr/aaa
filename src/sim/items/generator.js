/**
 * ItemFactory — loot generation with a power budget instead of "bigger rarity = better".
 *  • Rarity decides affix COUNT and roll floor; fine items roll tighter (higher floor) than attuned ones,
 *    so a well-rolled Fine item with on-build affixes can beat an Attuned one that doesn't fit the build.
 *  • Affix pools are filtered by slot, item level, mutual-exclusion groups and weighted toward the build
 *    (skill tags of the character) so loot is rarely junk — but never guaranteed.
 *  • Values scale with the central Balance curves (percent vs flat scaling).
 */
const RARITIES = ['common', 'fine', 'attuned', 'relic'];
export const RARITY_ORDER = Object.fromEntries(RARITIES.map((r, i) => [r, i]));

const BASE_RARITY = { common: 640, fine: 270, attuned: 80, relic: 10 };

export class ItemFactory {
  constructor(registry, balance) {
    this.reg = registry; this.bal = balance;
    this.bases = registry.all('itemBase');
    this.affixes = registry.all('affix');
    this.uniques = registry.all('unique');
    this.nextId = 1;
  }

  newIid() { return `i${(this.nextId++).toString(36)}`; }

  rollRarity(rng, bias = 0, lootFind = 0, { min = 'common', max = 'relic' } = {}) {
    const w = {
      common: BASE_RARITY.common * (1 - 0.8 * bias),
      fine: BASE_RARITY.fine * (1 + 0.3 * bias) * (1 + lootFind),
      attuned: BASE_RARITY.attuned * (1 + 4 * bias) * (1 + lootFind * 2),
      relic: BASE_RARITY.relic * (1 + 6 * bias) * (1 + lootFind * 2),
    };
    for (const r of RARITIES) if (RARITY_ORDER[r] < RARITY_ORDER[min] || RARITY_ORDER[r] > RARITY_ORDER[max]) w[r] = 0;
    const pick = rng.weighted(RARITIES, (r) => w[r]);
    return pick ?? min;
  }

  /**
   * @param {{next:()=>number}} rng
   * @param {{ilvl:number, rarity?:string, slot?:string, bias?:number, lootFind?:number, tags?:string[], classId?:string, baseId?:string, focus?:string, unique?:string, noUnique?:boolean}} o
   */
  roll(rng, o) {
    const ilvl = Math.max(1, Math.round(o.ilvl));
    let rarity = o.rarity ?? this.rollRarity(rng, o.bias ?? 0, o.lootFind ?? 0, { max: o.noUnique ? 'attuned' : 'relic' });
    if (o.unique) return this.makeUnique(rng, o.unique, ilvl);
    if (rarity === 'relic') {
      const u = this.pickUnique(rng, ilvl, o.slot, o.classId, o.source);
      if (u) return this.makeUnique(rng, u.id, ilvl);
      rarity = 'attuned';
    }
    const base = o.baseId ? this.reg.require(o.baseId, 'itemBase') : this.pickBase(rng, ilvl, o.slot, o.classId, o.armorOnly);
    const item = this.#blank(base, ilvl, rarity);
    const spec = this.bal.rarity(rarity);
    const n = rng.int(spec.affixes[0], spec.affixes[1]);
    this.#rollAffixes(rng, item, base, n, spec, o);
    item.sockets = rng.chance(this.bal.d.items.socketChanceByRarity[rarity] ?? 0) ? Array(rarity === 'attuned' && rng.chance(0.3) ? 2 : 1).fill(null) : [];
    if (rarity === 'attuned') item.epithet = rng.int(0, 23);
    return item;
  }

  #blank(base, ilvl, rarity) {
    const st = this.bal.rarity(rarity)?.stability ?? 4;
    return { iid: this.newIid(), base: base.id, ilvl, rarity, affixes: [], sockets: [], up: 0, stability: st, maxStability: st, fav: false, locked: false, crafted: false };
  }

  pickBase(rng, ilvl, slot, classId, armorOnly) {
    let pool = this.bases.filter((b) => b.minIlvl <= ilvl && (!slot || b.slot === slot || (slot === 'armor' && ['head', 'chest', 'hands', 'feet', 'offhand'].includes(b.slot)) || (slot === 'jewelry' && ['neck', 'ring', 'relic'].includes(b.slot))));
    if (armorOnly) pool = pool.filter((b) => ['head', 'chest', 'hands', 'feet'].includes(b.slot));
    if (!pool.length) pool = this.bases.filter((b) => b.minIlvl <= ilvl);
    // prefer the two highest tiers available per type, and bias toward the class's own gear types
    const cls = classId ? this.reg.get(classId) : null;
    const prefers = cls?.profile?.weaponKinds ?? [];
    return rng.weighted(pool, (b) => {
      const recency = 1 + Math.max(0, 1 - (ilvl - b.minIlvl) / 14) * 1.2;
      const fit = b.slot === 'weapon' && prefers.includes(b.kind) ? 2.2 : b.slot === 'weapon' ? 0.9 : 1;
      return (b.weight ?? 100) * recency * fit;
    });
  }

  pickUnique(rng, ilvl, slot, classId, source) {
    const pool = this.uniques.filter((u) => u.minIlvl <= ilvl + 2 && (!slot || u.slot === slot) && (u.source === 'drop' || u.source === source) && (!u.classes || !classId || u.classes.includes(classId)));
    return pool.length ? rng.weighted(pool, (u) => u.weight ?? 100) : null;
  }

  makeUnique(rng, uniqueId, ilvl) {
    const u = this.reg.require(uniqueId, 'unique');
    const base = this.reg.require(u.base, 'itemBase');
    const item = this.#blank(base, Math.max(ilvl, u.minIlvl), 'relic');
    item.unique = u.id;
    const floor = this.bal.rarity('relic').rollFloor;
    item.affixes = u.mods.map((mod, i) => ({ fixed: i, q: floor + rng.next() * (1 - floor) }));
    item.sockets = [];
    return item;
  }

  #rollAffixes(rng, item, base, n, spec, o) {
    const maxSide = this.bal.d.items.maxAffixPerSide;
    const used = new Set(), counts = { prefix: 0, suffix: 0 };
    const bias = new Set(o.tags ?? []);
    const focus = o.focus ? [o.focus] : [];
    const baseTags = new Set(base.tags ?? []);
    const wantTags = new Set([...bias, ...focus]);
    const chosen = [];
    for (let i = 0; i < n; i++) {
      const side = counts.prefix >= maxSide ? 'suffix' : counts.suffix >= maxSide ? 'prefix' : rng.chance(0.5) ? 'prefix' : 'suffix';
      let cands = this.affixes.filter((a) => a.type === side && !used.has(a.group) && a.slots.includes(base.slot) && a.minIlvl <= item.ilvl && (a.maxIlvl ?? 99) >= item.ilvl);
      if (!cands.length) { const other = side === 'prefix' ? 'suffix' : 'prefix'; if (counts[other] >= maxSide) continue; cands = this.affixes.filter((a) => a.type === other && !used.has(a.group) && a.slots.includes(base.slot) && a.minIlvl <= item.ilvl); if (!cands.length) continue; }
      const a = rng.weighted(cands, (af) => af.weight * (af.tags.some((t) => wantTags.has(t)) ? (focus.length && af.tags.includes(focus[0]) ? 6 : 2.4) : 1) * (af.tags.some((t) => baseTags.has(t)) ? 1.5 : 1));
      used.add(a.group); counts[a.type]++;
      chosen.push(a);
    }
    // relevance guard: attuned+ items should usually contain something that serves the build
    if (wantTags.size && chosen.length >= 3 && !chosen.some((a) => a.tags.some((t) => wantTags.has(t))) && rng.chance(0.7)) {
      const rel = this.affixes.filter((a) => a.slots.includes(base.slot) && a.minIlvl <= item.ilvl && a.tags.some((t) => wantTags.has(t)) && !used.has(a.group));
      if (rel.length) { const r = rng.weighted(rel, (x) => x.weight); chosen[chosen.length - 1] = r; }
    }
    for (const a of chosen) item.affixes.push({ id: a.id, q: spec.rollFloor + rng.next() * (1 - spec.rollFloor) });
  }

  // ───────────────────────── derived values
  /** value range for one mod at this item level: {min,max} */
  modRange(mod, ilvl) {
    const k = mod.scale === 'flat' ? this.bal.affixFlatScale(ilvl) : mod.scale === 'pct' ? this.bal.affixPercentScale(ilvl) : 1;
    return { min: mod.range[0] * k, max: mod.range[1] * k };
  }

  rollValue(mod, q, ilvl) {
    const { min, max } = this.modRange(mod, ilvl);
    const v = min + (max - min) * q;
    if (mod.scale === 'flat') return Math.max(1, Math.round(v * (Math.abs(v) < 5 ? 10 : 1)) / (Math.abs(v) < 5 ? 10 : 1));
    return Math.round(v * 1000) / 1000;
  }

  /**
   * All stat modifiers granted by an item (for StatBlock). Also returns armour & weapon numbers.
   * @returns {{mods:any[], armor:number, weapon:null|{hit:number, spell:number, speed:number}, patches:any[], flags:string[], triggers:any[], lines:any[]}}
   */
  derive(item) {
    const base = this.reg.require(item.base, 'itemBase');
    const out = { mods: [], armor: 0, weapon: null, patches: [], flags: [], triggers: [], lines: [] };
    const up = 1 + 0.07 * (item.up ?? 0);
    for (const imp of base.implicit ?? []) { out.mods.push({ ...imp, group: 'gear', value: imp.value * up }); out.lines.push({ kind: 'implicit', mod: imp, value: imp.value * up }); }
    if (base.armorShare) {
      const mult = { heavy: 1.45, medium: 1.0, light: 0.4 }[base.armorClass] ?? 1;
      out.armor = this.bal.expectedArmor(item.ilvl) * base.armorShare * mult * 1.4 * up;
      out.mods.push({ stat: 'armor', op: 'flat', value: out.armor });
    }
    if (base.weapon) {
      const hit = this.bal.weaponHit(item.ilvl);
      out.weapon = { hit: hit * base.weapon.mult * up, spell: hit * base.weapon.spell * up, speed: base.weapon.speed, kind: base.kind };
      if (base.weapon.speed !== 1) out.mods.push({ stat: 'actionSpeed', op: 'more', group: 'weapon', value: base.weapon.speed - 1 });
    }
    if (item.unique) {
      const u = this.reg.require(item.unique, 'unique');
      item.affixes.forEach((af) => {
        const mod = u.mods[af.fixed]; if (!mod) return;
        const v = this.rollValue(mod, af.q, item.ilvl);
        out.mods.push({ stat: mod.stat, op: mod.op, value: v, tags: mod.tags, group: mod.op === 'more' ? 'unique' : undefined });
        out.lines.push({ kind: 'unique', mod, value: v, range: this.modRange(mod, item.ilvl) });
      });
      out.patches.push(...u.patches.map((p, i) => ({ ...p, id: `${u.id}#${i}` })));
      out.flags.push(...u.flags);
      out.triggers.push(...u.triggers.map((t, i) => ({ ...t, id: `${u.id}#t${i}` })));
    } else {
      for (const af of item.affixes) {
        const def = this.reg.get(af.id); if (!def) continue;
        def.mods.forEach((mod) => {
          const v = this.rollValue(mod, af.q, item.ilvl);
          out.mods.push({ stat: mod.stat, op: mod.op, value: v, tags: mod.tags, group: mod.op === 'more' ? 'gear' : undefined });
          out.lines.push({ kind: def.type, affix: def, mod, value: v, range: this.modRange(mod, item.ilvl), q: af.q });
        });
      }
    }
    const kind = base.slot === 'weapon' ? 'weapon' : ['neck', 'ring', 'relic'].includes(base.slot) ? 'jewelry' : 'armor';
    for (const gid of item.sockets ?? []) {
      if (!gid) continue;
      const g = this.reg.get(gid); if (!g) continue;
      for (const gm of g.effects[kind] ?? []) { out.mods.push({ ...gm }); out.lines.push({ kind: 'gem', gem: g, mod: gm, value: gm.value }); }
    }
    return out;
  }

  /** compact power estimate used by compare/sort: Σ affix value-quality weighted by cost */
  power(item) {
    const d = this.derive(item);
    let p = 0;
    for (const l of d.lines) if (l.affix) p += (l.q ?? 0.5) * (l.affix.cost ?? 1);
    return p + (item.unique ? 2 : 0) + (item.up ?? 0) * 0.5;
  }

  sellValue(item) {
    const n = item.affixes.length + (item.sockets?.filter(Boolean).length ?? 0);
    return this.bal.sellValue(item.ilvl, item.rarity, n) + (item.up ?? 0) * Math.round(this.bal.chimeUnit(item.ilvl) * 2);
  }
}

export const EPITHETS = 24;

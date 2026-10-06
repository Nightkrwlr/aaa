/**
 * Character — persistent hero state (level, xp, talents, equipment, inventory, potions, voices, professions)
 * and the single place where those are turned into stat modifiers, ability patches, flags and triggers on the
 * live entity. Everything is serialisable (see toJSON) and migration-friendly.
 */
import { StatBlock, statDefsFrom } from './stats.js';
import { TalentTree } from './talents.js';
import { Inventory } from './items/inventory.js';
import { classMods } from './player.js';
import { syncLife } from './entity.js';
import { logger } from '../core/logger.js';

const log = logger('character');
export const EQUIP_SLOTS = ['weapon', 'offhand', 'head', 'chest', 'hands', 'feet', 'neck', 'ring1', 'ring2', 'relic'];
const SLOT_FOR = { weapon: ['weapon'], offhand: ['offhand'], head: ['head'], chest: ['chest'], hands: ['hands'], feet: ['feet'], neck: ['neck'], ring: ['ring1', 'ring2'], relic: ['relic'] };

export class Character {
  constructor({ registry, balance, factory, classId, name = 'Reposo' }) {
    this.reg = registry; this.bal = balance; this.factory = factory;
    this.classId = classId; this.name = name;
    this.cls = registry.require(classId, 'class');
    this.level = 1; this.xp = 0;
    this.tree = new TalentTree(registry.require(this.cls.talentTree, 'talentTree'));
    this.alloc = new Set([this.tree.start]);
    this.talentBonus = 0; this.respecs = 0;
    this.equipment = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null]));
    this.inv = new Inventory(60);
    this.loadout = { ...this.cls.loadout };
    this.potion = { charges: balance.d.potions.belt, max: balance.d.potions.belt };
    this.voices = { library: [], equipped: [], charges: 0 };
    this.prof = { forge: { level: 1, xp: 0 }, alchemy: { level: 1, xp: 0 }, runes: { level: 1, xp: 0 } };
    this.counters = { kills: 0, deaths: 0, playSeconds: 0, itemsFound: 0, chimesEarned: 0, secrets: 0 };
    this.cdUntil = {};
    this.sick = { n: 0, until: 0 };
    this.unlockedLevels = {};
  }

  // ───────────────────────── level / xp
  get cap() { return this.bal.levelCap; }
  talentPoints() { return this.level - 1 + this.talentBonus - this.tree.spent(this.alloc); }

  grantXp(world, entity, amount) {
    if (this.level >= this.cap) return 0;
    const gain = Math.round(amount * (entity?.stats.get('xpGain') ?? 1));
    this.xp += gain;
    let leveled = 0;
    while (this.level < this.cap && this.xp >= this.bal.xpToNext(this.level)) {
      this.xp -= this.bal.xpToNext(this.level);
      this.level++; leveled++;
    }
    if (leveled && entity) {
      entity.level = this.level;
      this.recompute(world, entity);
      syncLife(entity, true);
      const unlocks = this.cls.unlocks.filter((u) => u.level > this.level - leveled && u.level <= this.level).map((u) => u.ability);
      world.events.emit('level:up', { entity, level: this.level, unlocks, points: this.talentPoints() });
    }
    world.events.emit('xp:gain', { entity, amount: gain });
    return gain;
  }

  availableAbilities() { return this.cls.unlocks.filter((u) => u.level <= this.level).map((u) => u.ability); }

  autoLoadout() {
    const slots = ['s1', 's2', 's3', 's4', 's5', 's6'];
    const avail = this.availableAbilities();
    const keep = new Set(Object.values(this.loadout));
    for (const id of avail) {
      if (keep.has(id)) continue;
      const free = slots.find((s) => !this.loadout[s]);
      if (free) { this.loadout[free] = id; keep.add(id); }
    }
    // drop abilities no longer available (e.g. migrated saves)
    for (const s of slots) if (this.loadout[s] && !avail.includes(this.loadout[s])) delete this.loadout[s];
  }

  setLoadout(slot, abilityId) {
    if (!['s1', 's2', 's3', 's4', 's5', 's6'].includes(slot)) return false;
    if (abilityId && !this.availableAbilities().includes(abilityId)) return false;
    for (const s of Object.keys(this.loadout)) if (s !== slot && s.startsWith('s') && this.loadout[s] === abilityId) this.loadout[s] = this.loadout[slot];
    if (abilityId) this.loadout[slot] = abilityId; else delete this.loadout[slot];
    return true;
  }

  // ───────────────────────── talents
  allocate(world, entity, nodeId) {
    const chk = this.tree.canAllocate(this.alloc, nodeId, { points: this.talentPoints(), level: this.level });
    if (!chk.ok) return chk;
    this.alloc.add(nodeId);
    this.recompute(world, entity);
    return { ok: true };
  }
  deallocate(world, entity, nodeId) {
    const chk = this.tree.canDeallocate(this.alloc, nodeId);
    if (!chk.ok) return chk;
    this.alloc.delete(nodeId);
    this.recompute(world, entity);
    return { ok: true };
  }
  respecCost() { return this.bal.respecCost(this.level, this.respecs); }
  respecAll(world, entity) {
    const cost = this.respecCost();
    if (!this.inv.spendChimes(cost)) return { ok: false, reason: 'chimes', cost };
    this.alloc = new Set([this.tree.start]);
    this.respecs++;
    this.recompute(world, entity);
    return { ok: true, cost };
  }

  // ───────────────────────── equipment
  reqLevel(item) { return Math.max(1, Math.floor(item.ilvl * 0.8)); }

  canEquip(item, slot) {
    const base = this.reg.get(item.base);
    if (!base) return { ok: false, reason: 'missing' };
    const ok = SLOT_FOR[base.slot]?.includes(slot);
    if (!ok) return { ok: false, reason: 'slot' };
    if (this.level < this.reqLevel(item)) return { ok: false, reason: 'level', need: this.reqLevel(item) };
    if (item.unique) { const u = this.reg.get(item.unique); if (u?.classes && !u.classes.includes(this.classId)) return { ok: false, reason: 'class' }; }
    return { ok: true };
  }

  slotFor(item) {
    const base = this.reg.get(item.base);
    const opts = SLOT_FOR[base.slot] ?? [];
    return opts.find((s) => !this.equipment[s]) ?? opts[0];
  }

  /** equip an item from the inventory. Returns {ok, replaced?} */
  equip(world, entity, iid, slot) {
    const item = this.inv.find(iid);
    if (!item) return { ok: false, reason: 'notfound' };
    slot ??= this.slotFor(item);
    const chk = this.canEquip(item, slot);
    if (!chk.ok) return chk;
    const idx = this.inv.indexOf(iid);
    const prev = this.equipment[slot];
    this.inv.slots[idx] = prev; // swap in place: never loses an item, never needs free space
    this.equipment[slot] = item;
    this.recompute(world, entity);
    world?.events.emit('equip', { entity, item, slot });
    return { ok: true, replaced: prev };
  }

  unequip(world, entity, slot) {
    const item = this.equipment[slot];
    if (!item) return { ok: false, reason: 'empty' };
    if (this.inv.add(item) < 0) return { ok: false, reason: 'full' };
    this.equipment[slot] = null;
    this.recompute(world, entity);
    return { ok: true };
  }

  equippedItems() { return Object.entries(this.equipment).filter(([, i]) => i); }

  /** skill tags of the current loadout — used to bias loot toward the build */
  buildTags(world) {
    const tags = new Set();
    for (const [slot, id] of Object.entries(this.loadout)) { if (slot === 'dodge') continue; const ab = this.reg.get(id); for (const t of ab?.tags ?? []) tags.add(t); }
    tags.delete('basic'); tags.delete('attack');
    return [...tags];
  }

  // ───────────────────────── stat application
  /** Build a standalone StatBlock for an equipment/talent configuration (used by compare/preview and sim bots). */
  buildStatBlock(equipment = this.equipment, alloc = this.alloc, level = this.level) {
    const sb = new StatBlock(statDefsFrom(this.reg), this.bal.statRules());
    sb.add('class', classMods({ balance: this.bal }, this.cls, level));
    let weapon = null;
    for (const [slot, item] of Object.entries(equipment)) {
      if (!item) continue;
      const d = this.factory.derive(item);
      sb.add(`eq:${slot}`, d.mods);
      if (slot === 'weapon') weapon = d.weapon;
    }
    const eff = this.tree.effects(alloc);
    sb.add('tal:all', eff.mods);
    return { sb, weapon, eff };
  }

  recompute(world, entity) {
    if (!entity) return;
    const st = entity.stats;
    st.removePrefix('eq:'); st.remove('class'); st.remove('tal:all');
    st.add('class', classMods(world, this.cls, this.level));
    const flags = new Set(), patches = [];
    let weapon = null;
    for (const [slot, item] of Object.entries(this.equipment)) {
      if (!item) { world.triggers.set(entity, `eq:${slot}`, []); continue; }
      const d = this.factory.derive(item);
      st.add(`eq:${slot}`, d.mods);
      patches.push(...d.patches); d.flags.forEach((f) => flags.add(f));
      world.triggers.set(entity, `eq:${slot}`, d.triggers);
      if (slot === 'weapon') weapon = d.weapon;
    }
    const eff = this.tree.effects(this.alloc);
    st.add('tal:all', eff.mods);
    patches.push(...eff.patches); eff.flags.forEach((f) => flags.add(f));
    world.triggers.set(entity, 'tal', eff.triggers);
    entity.patches = patches;
    entity.flags = flags;
    const unarmed = this.cls.profile.unarmedMult ?? 0.6;
    entity.weaponHit = weapon ? weapon.hit : this.bal.weaponHit(this.level) * unarmed;
    entity.spellHit = weapon ? weapon.spell : this.bal.weaponHit(this.level) * unarmed;
    entity.level = this.level;
    entity.statusImmune = flags.has('hushImmune') ? new Set(['st.hush', 'st.silenced']) : undefined;
    entity.voices.max = Math.round(3 + st.get('voiceCharges'));
    entity.voices.slotCount = Math.round(st.get('voiceSlots'));
    entity.voices.library = new Set(this.voices.library);
    entity.voices.equipped = this.voices.equipped.slice(0, entity.voices.slotCount);
    entity.voices.charges = Math.min(entity.voices.max, this.voices.charges);
    this.#applyLoadout(entity);
    world.abilities.invalidate(entity);
    st.dirty();
    syncLife(entity, false);
    world.events.emit('character:changed', { entity });
  }

  #applyLoadout(entity) {
    entity.loadout = { ...this.loadout };
    const v = this.voices.equipped[0];
    if (v) { const def = this.reg.get(v); if (def) entity.loadout.voice = def.ability; }
    else delete entity.loadout.voice;
  }

  // ───────────────────────── voices
  captureVoice(id) {
    if (this.voices.library.includes(id)) return false;
    this.voices.library.push(id);
    if (!this.voices.equipped.length) this.voices.equipped.push(id);
    return true;
  }
  equipVoice(id, slot = 0) {
    if (!this.voices.library.includes(id)) return false;
    this.voices.equipped = this.voices.equipped.filter((v) => v !== id);
    this.voices.equipped.splice(slot, 0, id);
    this.voices.equipped = this.voices.equipped.slice(0, 2);
    return true;
  }

  // ───────────────────────── consumables & potions
  usePotion(world, entity) {
    const cfg = world.balance.d.potions;
    if (entity.dead || this.potion.charges <= 0) return { ok: false, reason: this.potion.charges <= 0 ? 'empty' : 'dead' };
    if ((this.cdUntil.potion ?? 0) > world.time) return { ok: false, reason: 'cooldown' };
    if (entity.hp >= entity.hpMax - 1) return { ok: false, reason: 'full' };
    this.sick.n = world.time < this.sick.until ? this.sick.n + 1 : 0;
    this.sick.until = world.time + 9;
    entity.potionMult = 0.72 ** this.sick.n; // spamming potions loses efficacy
    this.potion.charges--;
    this.cdUntil.potion = world.time + cfg.cooldown;
    world.abilities.castImmediate(entity, 'abl.con.potion_mend');
    world.events.emit('potion:used', { entity });
    return { ok: true };
  }

  refillPotions() { this.potion.charges = this.potion.max; }

  useConsumable(world, entity, id) {
    const def = this.reg.get(id);
    if (!def) return { ok: false, reason: 'missing' };
    if ((this.inv.consumables[id] ?? 0) <= 0) return { ok: false, reason: 'none' };
    if ((this.cdUntil[def.group] ?? 0) > world.time) return { ok: false, reason: 'cooldown' };
    this.inv.useConsumable(id);
    this.cdUntil[def.group] = world.time + def.cooldown;
    world.abilities.castImmediate(entity, def.ability);
    world.events.emit('consumable:used', { entity, id });
    return { ok: true };
  }

  // ───────────────────────── persistence
  toJSON() {
    return {
      classId: this.classId, name: this.name, level: this.level, xp: this.xp, alloc: [...this.alloc], talentBonus: this.talentBonus, respecs: this.respecs,
      equipment: this.equipment, inv: this.inv.toJSON(), loadout: this.loadout, potion: this.potion, voices: this.voices, prof: this.prof, counters: this.counters,
      nextItemId: this.factory.nextId,
    };
  }
  static fromJSON(ctx, d) {
    const c = new Character({ ...ctx, classId: d.classId, name: d.name });
    c.level = d.level ?? 1; c.xp = d.xp ?? 0; c.alloc = new Set(d.alloc ?? [c.tree.start]);
    if (!c.alloc.has(c.tree.start)) c.alloc.add(c.tree.start);
    for (const id of [...c.alloc]) if (!c.tree.node(id)) { log.warn(`dropping unknown talent ${id}`); c.alloc.delete(id); }
    c.talentBonus = d.talentBonus ?? 0; c.respecs = d.respecs ?? 0;
    c.equipment = { ...Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null])), ...(d.equipment ?? {}) };
    c.inv = Inventory.fromJSON(d.inv);
    c.loadout = d.loadout ?? { ...c.cls.loadout };
    c.potion = d.potion ?? c.potion; c.voices = d.voices ?? c.voices; c.prof = { ...c.prof, ...(d.prof ?? {}) }; c.counters = { ...c.counters, ...(d.counters ?? {}) };
    ctx.factory.nextId = Math.max(ctx.factory.nextId, d.nextItemId ?? 1);
    return c;
  }
}

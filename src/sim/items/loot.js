/**
 * LootSystem — drop tables, ground items, auto-pickup, voice echoes.
 * All randomness comes from world.rng (deterministic per seed). Drop *rolling* is a pure function
 * (rollDrops) so balance tools and tests can simulate thousands of kills without a World.
 */
import { lootFilterAction } from './lootFilter.js';

const SLOT_WEIGHTS = { weapon: 12, offhand: 8, head: 10, chest: 12, hands: 10, feet: 10, neck: 8, ring: 10, relic: 4 };

/**
 * @param {any} def enemy definition   @param {{level:number,tier:string}} e
 * @returns drops: {type, ...}
 */
export function rollDrops({ registry, balance, factory, rng, def, level, tier, ctx, killedBefore = false }) {
  const bal = balance, T = bal.tier(tier), out = [];
  const lf = ctx.lootFind ?? 0;
  const dropBonus = bal.d.enemyDamage.difficultyDropBonus[ctx.difficulty ?? 'seeker'] ?? 0;
  // currency
  if (rng.chance(tier === 'minion' ? 0.5 : tier === 'standard' ? 0.85 : 1)) {
    const n = bal.chimesFor(level, tier) * (0.7 + rng.next() * 0.6) * (1 + (ctx.chimeFind ?? 0));
    out.push({ type: 'chimes', amount: Math.max(1, Math.round(n)) });
  }
  // materials
  for (const m of def?.drops?.materials ?? []) if (rng.chance(m.chance * (1 + lf) * (tier === 'standard' || tier === 'minion' ? 1 : 1.6))) out.push({ type: 'material', id: m.id, amount: m.min ? rng.int(m.min, m.max ?? m.min) : 1 });
  // items
  let nItems = 0;
  if (T.dropCount) nItems = rng.int(T.dropCount[0], T.dropCount[1]);
  else if (rng.chance(Math.min(0.5, (T.dropChance + dropBonus * 0.05) * (1 + lf)))) nItems = 1;
  for (let i = 0; i < nItems; i++) {
    const slotKey = rng.weighted(Object.keys(SLOT_WEIGHTS), (k) => SLOT_WEIGHTS[k]);
    const slot = slotKey;
    const ilvl = level + (tier === 'boss' ? 2 : tier === 'miniboss' ? 1 : 0);
    const item = factory.roll(rng, { ilvl, slot, bias: Math.min(1, T.dropRarityBias + dropBonus), lootFind: lf, tags: ctx.buildTags, classId: ctx.classId, source: def?.bossId });
    out.push({ type: 'item', item });
  }
  // guaranteed / chance unique drops (bosses)
  for (const u of def?.uniqueDrops ?? []) if (rng.chance(killedBefore ? u.chance : Math.max(u.chance, u.firstChance ?? u.chance))) out.push({ type: 'item', item: factory.makeUnique(rng, u.id, level + 2) });
  // small extras
  if (tier !== 'minion' && rng.chance(0.035 * (1 + lf))) out.push({ type: 'potionCharge' });
  if (rng.chance(tier === 'standard' || tier === 'tough' ? 0.025 : 0.08)) {
    const pool = registry.all('consumable').filter((c) => c.minLevel <= level && c.group !== 'belt');
    if (pool.length) out.push({ type: 'consumable', id: rng.pick(pool).id, amount: 1 });
  }
  // voice echo
  if (def?.voice) {
    const p = tier === 'boss' || tier === 'miniboss' ? 1 : tier === 'elite' ? 0.45 : 0.07;
    if (rng.chance(p)) out.push({ type: 'voice', id: def.voice });
  }
  return out;
}

export class LootSystem {
  /** @param {any} world @param {any} factory @param {() => {character:any, settings:any}} getCtx */
  constructor(world, factory, getCtx) {
    this.w = world; this.factory = factory; this.getCtx = getCtx;
    this.ground = []; this.voiceEchoes = []; this.nextUid = 1;
    this.stats = { dropped: 0, hidden: 0, convertedChimes: 0 };
    this.pity = { kills: 0, items: 0 };   // early-game generosity: drops arrive on a schedule instead of by luck (see onKill)
    world.hooks.onKill.push((e, killer) => this.onKill(e, killer));
  }

  context() {
    const { character, settings } = this.getCtx();
    const p = this.w.player;
    return {
      lootFind: p?.stats.get('lootFind') ?? 0, chimeFind: p?.stats.get('chimeFind') ?? 0, difficulty: this.w.difficulty,
      buildTags: character ? character.buildTags(this.w) : [], classId: character?.classId, playerLevel: character?.level ?? 1, filter: settings?.lootFilter, character,
    };
  }

  onKill(e, killer) {
    if (e.team !== 'enemy' || e.noLoot || e.kind === 'object') return;
    const ctx = this.context();
    const def = e.def ? { ...e.def, bossId: e.def.bossId } : null;
    const drops = rollDrops({ registry: this.w.registry, balance: this.w.balance, factory: this.factory, rng: this.w.rng, def, level: e.level, tier: e.tier, ctx });
    this.#pity(drops, e, ctx);
    this.spawn(e.x, e.z, drops, ctx, e);
    // elite modifiers can add extra drop rolls
    if (e.eliteExtraDrops) for (let i = 0; i < e.eliteExtraDrops; i++) this.spawn(e.x, e.z, rollDrops({ registry: this.w.registry, balance: this.w.balance, factory: this.factory, rng: this.w.rng, def: null, level: e.level, tier: 'standard', ctx }), ctx, e);
  }

  /**
   * Pity timer for the first levels: the very first fight rewards a Fine weapon (the first upgrade is the first "I got something!"),
   * and afterwards a drop is guaranteed whenever a few kills in a row gave no item. Late game keeps pure chance.
   */
  #pity(drops, e, ctx) {
    const cfg = this.w.balance.d.loot.pity;
    if (!cfg || (ctx.playerLevel ?? 1) > cfg.untilLevel || e.tier === 'minion') return;
    const P = this.pity;
    if (drops.some((d) => d.type === 'item')) { P.kills = 0; P.items++; return; }
    P.kills++;
    if (P.kills < (P.items === 0 ? cfg.firstAfterKills : cfg.everyKills)) return;
    const first = P.items === 0;
    const item = this.factory.roll(this.w.rng, {
      ilvl: e.level, slot: first ? 'weapon' : this.w.rng.weighted(Object.keys(SLOT_WEIGHTS), (k) => SLOT_WEIGHTS[k]), rarity: first ? 'fine' : undefined, bias: first ? 0.5 : 0.25,
      tags: ctx.buildTags, classId: ctx.classId, lootFind: ctx.lootFind ?? 0, noUnique: true,
    });
    drops.push({ type: 'item', item }); P.kills = 0; P.items++;
  }

  spawn(x, z, drops, ctx = this.context(), src = null) {
    const rng = this.w.rng;
    for (const d of drops) {
      const ang = rng.range(0, Math.PI * 2), r = rng.range(0.4, 1.7);
      const px = x + Math.sin(ang) * r, pz = z + Math.cos(ang) * r;
      const spot = this.w.nav.isWalkable(px, pz) ? { x: px, z: pz } : { x, z };
      if (d.type === 'voice') { this.voiceEchoes.push({ uid: this.nextUid++, x, z, voice: d.id, expires: this.w.time + this.w.balance.d.voices.captureWindow + 2, born: this.w.time }); this.w.events.emit('voice:echo', { x, z, voice: d.id }); continue; }
      if (d.type === 'item') {
        const action = ctx.character ? lootFilterAction(d.item, ctx.filter ?? { mode: 'normal' }, { reg: this.w.registry, playerLevel: ctx.playerLevel, buildTags: ctx.buildTags }) : 'show';
        if (action === 'hide') {
          this.stats.hidden++;
          const v = this.factory.sellValue(d.item);
          this.stats.convertedChimes += v;
          this.ground.push({ uid: this.nextUid++, kind: 'chimes', amount: v, x: spot.x, z: spot.z, born: this.w.time, converted: true });
          continue;
        }
        this.stats.dropped++;
        this.ground.push({ uid: this.nextUid++, kind: 'item', item: d.item, x: spot.x, z: spot.z, born: this.w.time, rarity: d.item.rarity });
        this.w.events.emit('loot:drop', { item: d.item, x: spot.x, z: spot.z });
        continue;
      }
      this.ground.push({ uid: this.nextUid++, kind: d.type, id: d.id, amount: d.amount ?? 1, x: spot.x, z: spot.z, born: this.w.time });
    }
  }

  find(uid) { return this.ground.find((g) => g.uid === uid); }

  /** player picks a ground object. returns {ok, ...} */
  pickup(uid, { force = false } = {}) {
    const g = this.find(uid); if (!g) return { ok: false, reason: 'gone' };
    const { character } = this.getCtx(); const p = this.w.player;
    if (!force && Math.hypot(g.x - p.x, g.z - p.z) > 3.4) return { ok: false, reason: 'far' };
    switch (g.kind) {
      case 'item': {
        if (character.inv.add(g.item) < 0) return { ok: false, reason: 'full' };
        character.counters.itemsFound++;
        this.w.events.emit('loot:picked', { item: g.item });
        break;
      }
      case 'chimes': character.inv.addChimes(g.amount); character.counters.chimesEarned += g.amount; this.w.events.emit('loot:chimes', { amount: g.amount }); break;
      case 'material': character.inv.addMaterial(g.id, g.amount); this.w.events.emit('loot:material', { id: g.id, amount: g.amount }); break;
      case 'consumable': { const n = character.inv.addConsumable(g.id, g.amount); if (!n) return { ok: false, reason: 'full' }; this.w.events.emit('loot:consumable', { id: g.id }); break; }
      case 'potionCharge': character.potion.charges = Math.min(character.potion.max, character.potion.charges + 1); this.w.events.emit('loot:potion', {}); break;
      case 'deathBundle': character.inv.addChimes(g.amount); this.w.events.emit('loot:chimes', { amount: g.amount, recovered: true }); this.deathBundle = null; break;
      default: break;
    }
    this.ground.splice(this.ground.indexOf(g), 1);
    return { ok: true, kind: g.kind };
  }

  update(dt) {
    const p = this.w.player; const { character, settings } = this.getCtx();
    if (!p || p.dead || !character) return;
    const radius = p.stats.get('pickupRadius');
    for (let i = this.ground.length - 1; i >= 0; i--) {
      const g = this.ground[i];
      if (this.w.time - g.born > this.w.balance.d.loot.itemLifetimeSeconds && g.kind === 'item') { this.ground.splice(i, 1); continue; }
      const auto = g.kind === 'chimes' || g.kind === 'potionCharge' || g.kind === 'deathBundle' || ((g.kind === 'material' || g.kind === 'consumable') && (settings?.autoPickupMaterials ?? true));
      if (!auto) continue;
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (d < radius * 2) { // magnet: drift toward player, then collect
        const k = Math.min(1, dt * 9);
        g.x += (p.x - g.x) * k * (d < radius ? 1 : 0.5); g.z += (p.z - g.z) * k * (d < radius ? 1 : 0.5);
        if (d < 0.9) this.pickup(g.uid, { force: true });
      }
    }
    for (let i = this.voiceEchoes.length - 1; i >= 0; i--) if (this.w.time > this.voiceEchoes[i].expires) { this.w.events.emit('voice:lost', this.voiceEchoes[i]); this.voiceEchoes.splice(i, 1); }
  }

  /** called from Listen pulses: capture echoes in range */
  captureVoices(player) {
    const { character } = this.getCtx(); if (!character) return;
    const R = this.w.balance.d.voices.captureRadius;
    for (let i = this.voiceEchoes.length - 1; i >= 0; i--) {
      const v = this.voiceEchoes[i];
      if (Math.hypot(v.x - player.x, v.z - player.z) > R) continue;
      this.voiceEchoes.splice(i, 1);
      const isNew = character.captureVoice(v.voice);
      if (!isNew) character.voices.charges = Math.min(player.voices.max, character.voices.charges + 1);
      else character.voices.charges = Math.max(character.voices.charges, 2);
      character.recompute(this.w, player);
      player.voices.charges = character.voices.charges;
      this.w.events.emit('voice:captured', { voice: v.voice, isNew });
    }
  }

  /** death penalty: a recoverable bundle holding a % of the player's chimes */
  dropDeathBundle(x, z) {
    const { character } = this.getCtx();
    const lost = Math.floor(character.inv.chimes * this.w.balance.d.economy.deathChimeLossPct);
    if (lost <= 0) return 0;
    character.inv.spendChimes(lost);
    if (this.deathBundle) this.ground = this.ground.filter((g) => g !== this.deathBundle); // the previous one is lost
    this.deathBundle = { uid: this.nextUid++, kind: 'deathBundle', amount: lost, x, z, born: this.w.time };
    this.ground.push(this.deathBundle);
    return lost;
  }
}

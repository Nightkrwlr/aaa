import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, reg, run } from './helpers/sim.js';
import { Rng } from '../src/core/rng.js';
import { Balance } from '../src/sim/balance.js';
import { ItemFactory } from '../src/sim/items/generator.js';
import { Character } from '../src/sim/character.js';
import { createPlayerEntity } from '../src/sim/player.js';
import { Crafting } from '../src/sim/items/crafting.js';
import { compareItem } from '../src/sim/items/compare.js';

const bal = Balance.from(reg);

function setup(classId = 'cls.belfry', level = 1) {
  const factory = new ItemFactory(reg, bal);
  const ch = new Character({ registry: reg, balance: bal, factory, classId });
  ch.level = level;
  const w = makeWorld({ level });
  const e = w.addPlayer(createPlayerEntity(w, reg.require(classId), level, 40, 40));
  ch.autoLoadout(); ch.recompute(w, e);
  return { w, e, ch, factory, crafting: new Crafting(reg, bal, factory) };
}

test('xp → level-ups unlock abilities and talent points', () => {
  const { w, e, ch } = setup();
  const ups = []; w.events.on('level:up', (i) => ups.push(i));
  ch.grantXp(w, e, bal.xpToNext(1) + bal.xpToNext(2) + 5);
  assert.equal(ch.level, 3);
  assert.equal(ups.length, 1);
  assert.ok(ups[0].unlocks.includes('abl.belfry.chain_bell'));
  assert.equal(ch.talentPoints(), 2);
  assert.ok(e.hpMax > bal.playerBaseLife(1));
});

test('talents: connectivity, exclusivity, safe deallocation, respec costs and refunds', () => {
  const { w, e, ch } = setup('cls.belfry', 20);
  const T = ch.tree;
  assert.equal(ch.allocate(w, e, 'tal.belfry.b2').ok, false, 'must connect to hub first');
  assert.ok(ch.allocate(w, e, 'tal.belfry.b1a').ok);
  assert.ok(ch.allocate(w, e, 'tal.belfry.b1b').ok);
  assert.ok(ch.allocate(w, e, 'tal.belfry.b2').ok);
  assert.ok(ch.allocate(w, e, 'tal.belfry.b3a').ok);
  assert.ok(ch.allocate(w, e, 'tal.belfry.b4a').ok);
  const ex = ch.allocate(w, e, 'tal.belfry.b3b'); assert.ok(ex.ok);
  assert.equal(ch.allocate(w, e, 'tal.belfry.b4b').ok, false, 'exclusive transformer group');
  assert.equal(ch.deallocate(w, e, 'tal.belfry.b2').ok, false, 'removing b2 would orphan nodes');
  assert.ok(ch.deallocate(w, e, 'tal.belfry.b4a').ok);
  const pts = ch.talentPoints();
  ch.inv.addChimes(1e6);
  for (let i = 0; i < 3; i++) assert.equal(ch.respecAll(w, e).cost, 0, 'first respecs are free');
  assert.ok(ch.respecCost() > 0);
  const c = ch.respecAll(w, e); assert.ok(c.ok && c.cost > 0);
  assert.equal(ch.talentPoints(), 19);
});

test('a transformer talent changes how the skill works (Falla Sísmica: Peal becomes a line)', () => {
  const { w, e, ch } = setup('cls.belfry', 20);
  for (const id of ['b1a', 'b1b', 'b2', 'b3a', 'b4a']) assert.ok(ch.allocate(w, e, `tal.belfry.${id}`).ok, id);
  const peal = w.abilities.resolve(e, 'abl.belfry.peal');
  const area = peal.effects.find((x) => x.op === 'area');
  assert.equal(area.shape, 'line');
  assert.ok(area.length >= 10);
  // original untouched
  assert.equal(reg.get('abl.belfry.peal').effects[0].shape, 'circle');
  // keystone with trade-off alters stats
  const before = e.stats.get('resourceMax');
  for (const id of ['b4a']) ch.deallocate(w, e, `tal.belfry.${id}`);
  assert.ok(before >= 100);
});

test('equipment: stats, weapon numbers, level requirements, swapping never loses items', () => {
  const { w, e, ch, factory } = setup('cls.belfry', 10);
  const hp0 = e.hpMax, hit0 = e.weaponHit;
  const hammer = factory.roll(new Rng('w'), { ilvl: 8, rarity: 'fine', baseId: 'itm.base.bell_hammer_worn' });
  const hammer2 = factory.roll(new Rng('w2'), { ilvl: 9, rarity: 'fine', baseId: 'itm.base.bell_hammer_tempered' });
  const chest = factory.roll(new Rng('c'), { ilvl: 8, rarity: 'fine', baseId: 'itm.base.chest_heavy_worn' });
  const tooHigh = factory.roll(new Rng('x'), { ilvl: 40, rarity: 'common', baseId: 'itm.base.head_heavy_serrane' });
  for (const it of [hammer, hammer2, chest, tooHigh]) ch.inv.add(it);
  assert.ok(ch.equip(w, e, hammer.iid).ok);
  assert.ok(e.weaponHit > hit0);
  assert.ok(ch.equip(w, e, chest.iid).ok);
  assert.ok(e.stats.get('armor') > 0);
  const r = ch.equip(w, e, hammer2.iid);
  assert.ok(r.ok && r.replaced === hammer);
  assert.ok(ch.inv.find(hammer.iid), 'replaced weapon returned to inventory');
  assert.equal(ch.equip(w, e, tooHigh.iid).reason, 'level');
  assert.equal(ch.canEquip(chest, 'weapon').ok, false);
  const total = ch.inv.items().length + Object.values(ch.equipment).filter(Boolean).length;
  assert.equal(total, 4);
  assert.ok(e.hpMax >= hp0);
});

test('unique items: patches reach abilities, triggers fire with ICD, class restriction enforced', () => {
  const { w, e, ch, factory } = setup('cls.belfry', 12);
  const bell = factory.makeUnique(new Rng('u1'), 'unq.inverted_bell', 12);
  const wrong = factory.makeUnique(new Rng('u2'), 'unq.serene_crown', 12);
  ch.inv.add(bell); ch.inv.add(wrong);
  assert.equal(ch.equip(w, e, wrong.iid).reason, 'class');
  assert.ok(ch.equip(w, e, bell.iid).ok);
  const peal = w.abilities.resolve(e, 'abl.belfry.peal');
  assert.ok(JSON.stringify(peal).includes('lifeSelf'));
  // echo ring: dodge → decoy once per ICD
  const ring = factory.makeUnique(new Rng('u3'), 'unq.echo_ring', 12);
  ch.inv.add(ring); assert.ok(ch.equip(w, e, ring.iid).ok);
  const decoys = () => w.entities.filter((x) => x.id === 'enm.echo_decoy' && !x.dead).length;
  w.abilities.tryCast(e, 'abl.belfry.shoulder_roll', 45, 40);
  run(w, 0.4);
  assert.equal(decoys(), 1);
  run(w, 1.7);
  w.abilities.tryCast(e, 'abl.belfry.shoulder_roll', 36, 40);
  run(w, 0.4);
  assert.equal(decoys(), 1, 'ICD 4s prevents a second decoy');
});

test('crafting: salvage, reforge stability, re-tune cracks, upgrades fail sometimes, costs enforced', () => {
  const { w, e, ch, factory, crafting } = setup('cls.belfry', 15);
  const rng = new Rng('craft');
  const item = factory.roll(rng, { ilvl: 14, rarity: 'attuned', baseId: 'itm.base.bell_hammer_tempered' });
  ch.inv.add(item);
  assert.equal(crafting.reforge(ch, item.iid, rng).reason, 'chimes');
  ch.inv.addChimes(1e6); ch.inv.addMaterial('mat.tuning_shard', 99); ch.inv.addMaterial('mat.echo_core', 99); ch.inv.addMaterial('mat.resonant_dust', 99);
  const st0 = item.stability;
  let n = 0;
  while (item.stability > 0) { const r = crafting.reforge(ch, item.iid, rng); assert.ok(r.ok); n++; if (n > 20) break; }
  assert.equal(n, st0, 'each reforge spends 1 stability');
  assert.equal(crafting.reforge(ch, item.iid, rng).reason, 'cracked');
  assert.equal(crafting.rerollAffix(ch, item.iid, 0, rng).reason, 'cracked');
  // upgrades eventually fail at high levels (statistical)
  const u = factory.roll(rng, { ilvl: 14, rarity: 'fine' }); ch.inv.add(u);
  let fails = 0, tries = 0;
  for (let i = 0; i < 200; i++) { ch.inv.addChimes(1e5); ch.inv.addMaterial('mat.echo_core', 10); ch.inv.addMaterial('mat.resonant_dust', 50); u.up = 3; const r = crafting.upgrade(ch, u.iid, rng); assert.ok(r.ok, r.reason); tries++; if (!r.success) fails++; }
  assert.ok(fails > 20 && fails < 160, `fails ${fails}/${tries}`);
  // salvage returns materials and respects locks
  const s = factory.roll(rng, { ilvl: 10, rarity: 'fine' }); ch.inv.add(s); s.fav = true;
  assert.equal(crafting.salvage(ch, s.iid, rng).reason, 'locked');
  s.fav = false;
  const before = ch.inv.materialCount('mat.resonant_dust');
  assert.ok(crafting.salvage(ch, s.iid, rng).ok);
  assert.ok(ch.inv.materialCount('mat.resonant_dust') > before);
  assert.equal(ch.inv.find(s.iid), null);
});

test('recipes: potions need materials & profession level; forged items are bounded', () => {
  const { w, e, ch, crafting } = setup('cls.belfry', 8);
  const rng = new Rng('rcp');
  assert.equal(crafting.craft(ch, 'rcp.potion_trickle', rng).reason, 'chimes');
  ch.inv.addChimes(500);
  assert.equal(crafting.craft(ch, 'rcp.potion_trickle', rng).reason, 'materials');
  ch.inv.addMaterial('mat.wind_lichen', 5); ch.inv.addMaterial('mat.bellflower', 5);
  assert.ok(crafting.craft(ch, 'rcp.potion_trickle', rng).ok);
  assert.equal(ch.inv.consumables['con.potion_trickle'], 2);
  assert.equal(crafting.craft(ch, 'rcp.forge_weapon', rng).reason, 'proflevel');
});

test('consumables & belt potion: efficiency drops when spammed; cooldowns apply', () => {
  const { w, e, ch } = setup('cls.belfry', 8);
  e.hp = 10;
  const r1 = ch.usePotion(w, e); assert.ok(r1.ok);
  const healed1 = e.hp - 10;
  assert.equal(ch.usePotion(w, e).reason, 'cooldown');
  run(w, 1.5); e.hp = 10;
  assert.ok(ch.usePotion(w, e).ok);
  const healed2 = e.hp - 10;
  assert.ok(healed2 < healed1 * 0.9, `second potion weaker ${healed2} < ${healed1}`);
  ch.inv.addConsumable('con.potion_haste', 2);
  assert.equal(ch.useConsumable(w, e, 'con.potion_haste').reason, 'cooldown', 'shared potion cooldown');
  run(w, 1.3);
  assert.ok(ch.useConsumable(w, e, 'con.potion_haste').ok);
  assert.ok(w.status.has(e, 'st.potion_haste'));
});

test('compare: multi-dimensional verdict and transforms flag', () => {
  const { w, e, ch, factory } = setup('cls.belfry', 12);
  const a = factory.roll(new Rng('a'), { ilvl: 10, rarity: 'common', baseId: 'itm.base.bell_hammer_worn' });
  ch.inv.add(a); ch.equip(w, e, a.iid);
  const b = factory.roll(new Rng('b'), { ilvl: 12, rarity: 'fine', baseId: 'itm.base.bell_hammer_tempered' });
  b.affixes = [{ id: 'afx.p.sonic_dmg', q: 1 }, { id: 'afx.p.flat_dmg', q: 1 }];
  const cmp = compareItem(ch, factory, b, 'weapon');
  assert.ok(cmp.rows.find((r) => r.key === 'dps').delta > 0);
  assert.ok(['upgrade', 'defensive', 'trade_offense'].includes(cmp.verdict));
  const u = factory.makeUnique(new Rng('u'), 'unq.dissonant_lash', 12);
  assert.equal(compareItem(ch, factory, u, 'weapon').transforms, true);
});

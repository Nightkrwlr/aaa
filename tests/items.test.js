import test from 'node:test';
import assert from 'node:assert/strict';
import { reg } from './helpers/sim.js';
import { Rng } from '../src/core/rng.js';
import { Balance } from '../src/sim/balance.js';
import { ItemFactory, RARITY_ORDER } from '../src/sim/items/generator.js';

const bal = Balance.from(reg);
const mk = () => new ItemFactory(reg, bal);

test('item generation is deterministic and respects rarity affix counts / slot rules', () => {
  const f1 = mk(), f2 = mk();
  const a = f1.roll(new Rng('x'), { ilvl: 10, rarity: 'attuned' });
  const b = f2.roll(new Rng('x'), { ilvl: 10, rarity: 'attuned' });
  assert.deepEqual({ ...a, iid: 0 }, { ...b, iid: 0 });
  const f = mk(), rng = new Rng('counts');
  for (let i = 0; i < 400; i++) {
    for (const [rarity, lo, hi] of [['common', 0, 0], ['fine', 1, 2], ['attuned', 3, 5]]) {
      const it = f.roll(rng, { ilvl: 12, rarity });
      assert.ok(it.affixes.length >= (rarity === 'attuned' ? 2 : lo) && it.affixes.length <= hi, `${rarity} has ${it.affixes.length}`);
      const base = reg.get(it.base);
      const groups = new Set();
      for (const af of it.affixes) {
        const def = reg.get(af.id);
        assert.ok(def.slots.includes(base.slot), `${def.id} not allowed on ${base.slot}`);
        assert.ok(def.minIlvl <= it.ilvl, 'ilvl gate');
        assert.ok(!groups.has(def.group), 'no duplicate group'); groups.add(def.group);
      }
      assert.ok(it.affixes.filter((a) => reg.get(a.id).type === 'prefix').length <= 3);
      assert.ok(it.affixes.filter((a) => reg.get(a.id).type === 'suffix').length <= 3);
    }
  }
});

test('rarity distribution shifts with bias but never guarantees relics from trash', () => {
  const f = mk(), rng = new Rng('dist');
  const count = (bias) => { const c = { common: 0, fine: 0, attuned: 0, relic: 0 }; for (let i = 0; i < 4000; i++) c[f.rollRarity(rng, bias)]++; return c; };
  const trash = count(0), boss = count(1);
  assert.ok(trash.common > 0.55 * 4000);
  assert.ok(boss.attuned > trash.attuned * 3);
  assert.ok(boss.relic > trash.relic);
  assert.ok(trash.relic < 0.03 * 4000);
});

test('build-aware weighting: sonic/melee focus raises fitting affixes without removing others', () => {
  const f = mk();
  const share = (tags) => { const rng = new Rng('bias'); let fit = 0, n = 0; for (let i = 0; i < 600; i++) { const it = f.roll(rng, { ilvl: 14, rarity: 'attuned', slot: 'weapon', tags }); for (const a of it.affixes) { n++; if (reg.get(a.id).tags.includes('sonic')) fit++; } } return fit / n; };
  assert.ok(share(['sonic']) > share([]) * 1.3);
  assert.ok(share(['sonic']) < 0.8, 'still diverse');
});

test('values scale with item level; derive() yields armour, weapon hit and valid stat mods', () => {
  const f = mk(), rng = new Rng('scale');
  const lo = f.roll(rng, { ilvl: 1, rarity: 'common', baseId: 'itm.base.chest_heavy_worn' });
  const hi = f.roll(rng, { ilvl: 40, rarity: 'common', baseId: 'itm.base.chest_heavy_serrane' });
  assert.ok(f.derive(hi).armor > f.derive(lo).armor * 6);
  const w = f.roll(rng, { ilvl: 10, rarity: 'fine', baseId: 'itm.base.bell_hammer_worn' });
  const d = f.derive(w);
  assert.ok(d.weapon.hit > 0 && d.weapon.spell > 0);
  for (const m of d.mods) assert.ok(typeof m.stat === 'string' && Number.isFinite(m.value), JSON.stringify(m));
});

test('unique items carry transforming patches/triggers and fixed mods with rolled ranges', () => {
  const f = mk(), rng = new Rng('unique');
  for (const u of reg.all('unique')) {
    const it = f.makeUnique(rng, u.id, 15);
    const d = f.derive(it);
    assert.equal(it.rarity, 'relic');
    assert.ok(d.mods.length >= 1);
    assert.ok(d.patches.length + d.flags.length + d.triggers.length > 0 || d.mods.some((m) => ['voiceSlots', 'voiceCharges'].includes(m.stat)), `${u.id} must transform something`);
  }
});

test('a Fine item with on-build affixes can outscore an Attuned item with off-build rolls (rarity ≠ power)', () => {
  const f = mk();
  const fine = f.roll(new Rng(1), { ilvl: 15, rarity: 'fine', baseId: 'itm.base.bell_hammer_tempered' });
  fine.affixes = [{ id: 'afx.p.sonic_dmg', q: 1 }, { id: 'afx.p.flat_dmg', q: 1 }];
  const att = f.roll(new Rng(2), { ilvl: 15, rarity: 'attuned', baseId: 'itm.base.bell_hammer_tempered' });
  att.affixes = [{ id: 'afx.p.proj_dmg', q: 0.3 }, { id: 'afx.s.res_toxic', q: 0.3 }, { id: 'afx.s.pickup', q: 0.3 }];
  const sonicDamage = (it) => { const s = f.derive(it).mods.filter((m) => m.stat === 'damage' && (m.tags ?? []).includes('sonic')).reduce((a, m) => a + m.value, 0) + f.derive(it).mods.filter((m) => m.stat === 'damageFlat').reduce((a, m) => a + m.value, 0) * 0.01; return s; };
  assert.ok(sonicDamage(fine) > sonicDamage(att), 'on-build Fine beats off-build Attuned for a sonic melee build');
  assert.ok(RARITY_ORDER.attuned > RARITY_ORDER.fine);
});

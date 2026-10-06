import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, makePlayer, run, reg } from './helpers/sim.js';

test('basic attack damages target in arc, builds Toll, applies cooldown/cost rules', () => {
  const w = makeWorld();
  const p = makePlayer(w);
  const d = w.spawnEnemy('enm.test_dummy', 40, 43);
  const hp0 = d.hp;
  assert.ok(w.abilities.tryCast(p, 'abl.belfry.clapper', d.x, d.z));
  run(w, 0.7);
  assert.ok(d.hp < hp0, 'damage applied');
  assert.ok(p.res.value > 0, 'toll gained');
  // peal needs 30 toll
  assert.equal(w.abilities.tryCast(p, 'abl.belfry.peal', d.x, d.z), false);
  p.res.value = 100;
  assert.ok(w.abilities.tryCast(p, 'abl.belfry.peal', d.x, d.z));
  assert.ok(p.res.value <= 70.01);
  run(w, 1.0);
  assert.ok(d.st.some((s) => s.def.id === 'st.dissonance' || s.def.id === 'st.stunned') || d.hp < hp0 - 5);
});

test('damage numbers are deterministic for equal seeds', () => {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const w = makeWorld({ seed: 'determinism' });
    const p = makePlayer(w);
    const d = w.spawnEnemy('enm.test_dummy', 40, 42.5);
    const seen = [];
    w.events.on('damage', (e) => seen.push(e.amount + (e.crit ? 'c' : '')));
    for (let k = 0; k < 6; k++) { w.abilities.tryCast(p, 'abl.belfry.clapper', d.x, d.z); run(w, 0.5); }
    out.push(seen.join(','));
  }
  assert.equal(out[0], out[1]);
});

test('flat added damage is scaled once (by item level at roll time), not again by the damage model', () => {
  const w = makeWorld();
  const p = makePlayer(w);
  const eff = { type: 'physical', coef: 1, scaling: 'weapon' };
  const noCrit = { noCrit: true };
  const a = w.dmg.roll(p, eff, ['attack'], w.rng, noCrit).amount;
  p.stats.add('test', [{ stat: 'damageFlat', op: 'flat', value: 50 }]);
  const b = w.dmg.roll(p, eff, ['attack'], w.rng, noCrit).amount;
  const mult = p.stats.get('damage', ['attack', 'physical'], p.flags ?? undefined);
  assert.ok(Math.abs((b - a) - 50 * mult) < 1e-6, `flat +50 must add exactly 50 × damage multiplier (got ${(b - a).toFixed(2)})`);
  // coefficient below 1 scales the added flat proportionally
  const half = w.dmg.roll(p, { ...eff, coef: 0.5 }, ['attack'], w.rng, noCrit).amount;
  assert.ok(Math.abs(half - (a / 2 + 25 * mult)) < 1e-6);
});

test('armor and resistance mitigate; vulnerable multiplies; floor of 1', () => {
  const w = makeWorld();
  const d = w.spawnEnemy('enm.test_dummy', 40, 42);
  const base = w.dmg.mitigate(d, 100, 'sonic');
  d.stats.add('t', [{ stat: 'res.sonic', op: 'flat', value: 0.5 }]);
  assert.equal(w.dmg.mitigate(d, 100, 'sonic'), 50);
  w.status.apply(d, 'st.vulnerable');
  assert.equal(w.dmg.mitigate(d, 100, 'sonic'), 60);
  assert.equal(w.dmg.mitigate(d, 0.1, 'sonic'), 1);
  assert.ok(base === 100);
});

test('dodge grants i-frames: damage during dash is ignored and perfect dodge fires', () => {
  const w = makeWorld();
  const p = makePlayer(w);
  const dummy = w.spawnEnemy('enm.test_dummy', 40, 44);
  let perfect = 0;
  w.events.on('perfectDodge', () => perfect++);
  p.cmd.aim = { x: 43, z: 40 };
  assert.ok(w.abilities.tryCast(p, 'abl.belfry.shoulder_roll', 45, 40));
  run(w, 0.05);
  const hp = p.hp;
  w.dealDirect(dummy, p, 500, 'physical');
  assert.equal(p.hp, hp);
  assert.equal(perfect, 1);
  run(w, 0.6);
  assert.ok(p.x > 43, `moved ${p.x}`);
  w.dealDirect(dummy, p, 5, 'physical');
  assert.ok(p.hp < hp);
});

test('stun prevents casting; silence blocks skills but not primary', () => {
  const w = makeWorld();
  const p = makePlayer(w);
  p.res.value = 100;
  w.status.apply(p, 'st.silenced');
  assert.equal(w.abilities.tryCast(p, 'abl.belfry.peal', 41, 40), false);
  assert.ok(w.abilities.tryCast(p, 'abl.belfry.clapper', 41, 40));
  run(w, 0.6);
  w.status.apply(p, 'st.stunned');
  assert.equal(w.abilities.tryCast(p, 'abl.belfry.clapper', 41, 40), false);
});

test('control diminishing returns and freeze immunity window', () => {
  const w = makeWorld();
  const d = w.spawnEnemy('enm.test_dummy', 40, 42);
  const a = w.status.apply(d, 'st.stunned');
  const first = a.remaining;
  w.status.remove(d, 'st.stunned');
  const b = w.status.apply(d, 'st.stunned');
  assert.ok(b.remaining < first, 'second stun shorter');
  w.status.apply(d, 'st.frozen');
  w.status.remove(d, 'st.frozen', 'expired');
  assert.equal(w.status.apply(d, 'st.frozen'), null, 'freeze immunity after thaw');
});

test('chill builds to freeze; shatter reaction has ICD', () => {
  const w = makeWorld();
  const p = makePlayer(w);
  const d = w.spawnEnemy('enm.test_dummy', 40, 42);
  for (let i = 0; i < 3; i++) w.status.apply(d, 'st.chilled', { source: p, build: 40 });
  assert.ok(w.status.has(d, 'st.frozen'));
  let bursts = 0;
  w.events.on('burst', () => bursts++);
  const ab = reg.require('abl.belfry.clapper');
  w.hit(p, d, ab.effects[0].hit[0], ab);
  assert.equal(bursts, 1, 'physical/sonic hit on frozen target shatters it');
  w.status.apply(d, 'st.chilled', { source: p, build: 120 }); // re-freeze is refused (immunity) → no second shatter
  w.hit(p, d, ab.effects[0].hit[0], ab);
  assert.equal(bursts, 1, 'ICD / consumed frozen prevents repeated shatter');
});

test('DoT: burning snapshot damages over time and strongest-only stacking', () => {
  const w = makeWorld();
  const p = makePlayer(w);
  const d = w.spawnEnemy('enm.test_dummy', 40, 42, { hpMult: 50 });
  w.status.apply(d, 'st.burning', { source: p, snapshot: 100 });
  w.status.apply(d, 'st.burning', { source: p, snapshot: 40 });
  assert.equal(d.st.filter((s) => s.def.id === 'st.burning').length, 1);
  const hp = d.hp;
  run(w, 2);
  assert.ok(d.hp < hp - 100, `burn ticked ${hp - d.hp}`);
});

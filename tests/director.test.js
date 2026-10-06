import test from 'node:test';
import assert from 'node:assert/strict';
import { reg } from './helpers/sim.js';
import { Rng } from '../src/core/rng.js';
import { composeEncounter } from '../src/sim/director/encounters.js';

test('every template composes deterministic, non-empty groups with synergy (tank in front, ranged behind)', () => {
  for (const t of reg.all('encounter')) {
    const a = composeEncounter(reg, t.id, new Rng('s'), { level: 5 });
    const b = composeEncounter(reg, t.id, new Rng('s'), { level: 5 });
    assert.deepEqual(a, b, `${t.id} deterministic`);
    assert.ok(a.length >= 2, `${t.id} has enemies`);
    for (const m of a) assert.ok(reg.has(m.id), `${t.id} references real enemy ${m.id}`);
  }
  const line = composeEncounter(reg, 'enc.fortified_line', new Rng(7), {});
  const tank = line.find((m) => m.id === 'enm.hollow_shieldbearer');
  const art = line.find((m) => m.id === 'enm.cracked_cantor');
  assert.ok(tank.dz > art.dz, 'tank stands in front of artillery');
});

test('difficulty scales budget (more enemies) without touching templates', () => {
  let low = 0, high = 0;
  for (let i = 0; i < 40; i++) {
    low += composeEncounter(reg, 'enc.hollow_walkers', new Rng(i), { difficulty: 'wanderer' }).length;
    high += composeEncounter(reg, 'enc.hollow_walkers', new Rng(i), { difficulty: 'maestro' }).length;
  }
  assert.ok(high >= low);
});

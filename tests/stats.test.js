import test from 'node:test';
import assert from 'node:assert/strict';
import { StatBlock } from '../src/sim/stats.js';

const defs = { damage: { base: 1 }, life: { base: 0, min: 1 }, 'res.fire': { max: 0.75, min: -1 }, critChance: { base: 0.05, max: 0.75 } };
const rules = { moreGroupCaps: { talent: 1.5, cadence: 0.5 }, moreGroupCap: 1.5, incCap: 6 };

test('flat → inc → more pipeline order', () => {
  const s = new StatBlock(defs, rules);
  s.add('a', [{ stat: 'life', op: 'base', value: 100 }, { stat: 'life', op: 'flat', value: 50 }, { stat: 'life', op: 'inc', value: 0.2 }, { stat: 'life', op: 'inc', value: 0.3 }, { stat: 'life', op: 'more', group: 'talent', value: 0.1 }]);
  assert.equal(Math.round(s.get('life')), Math.round(150 * 1.5 * 1.1));
});

test('increased pool is additive, more groups multiply, same group is additive and capped', () => {
  const s = new StatBlock(defs, rules);
  s.add('x', [{ stat: 'damage', op: 'inc', value: 0.5 }, { stat: 'damage', op: 'more', group: 'talent', value: 0.4 }, { stat: 'damage', op: 'more', group: 'talent', value: 0.4 }, { stat: 'damage', op: 'more', group: 'gear', value: 0.2 }]);
  // talent group sums to 0.8 (<1.5): (1.5) * 1.8 * 1.2
  assert.ok(Math.abs(s.get('damage') - 1.5 * 1.8 * 1.2) < 1e-9);
  s.add('y', [{ stat: 'damage', op: 'more', group: 'cadence', value: 0.9 }]);
  // cadence capped at 0.5
  assert.ok(Math.abs(s.get('damage') - 1.5 * 1.8 * 1.2 * 1.5) < 1e-9);
});

test('inc damage cap and stat caps (resist, crit)', () => {
  const s = new StatBlock(defs, rules);
  s.add('x', [{ stat: 'damage', op: 'inc', value: 50 }, { stat: 'res.fire', op: 'flat', value: 2 }, { stat: 'critChance', op: 'flat', value: 3 }]);
  assert.equal(s.get('damage'), 7); // 1 * (1+6)
  assert.equal(s.get('res.fire'), 0.75);
  assert.equal(s.get('critChance'), 0.75);
});

test('tag & flag conditions', () => {
  const s = new StatBlock(defs, rules);
  s.add('x', [{ stat: 'damage', op: 'inc', value: 0.4, tags: ['fire', 'area'] }, { stat: 'damage', op: 'inc', value: 0.2, when: ['lowLife'] }]);
  assert.equal(s.get('damage', ['fire']), 1);
  assert.equal(s.get('damage', ['fire', 'area', 'x']), 1.4);
  assert.ok(Math.abs(s.get('damage', ['fire', 'area'], new Set(['lowLife'])) - 1.6) < 1e-9);
});

test('remove by source and prefix, cache invalidation', () => {
  const s = new StatBlock(defs, rules);
  s.add('eq:head', [{ stat: 'life', op: 'flat', value: 30 }]);
  s.add('eq:chest', [{ stat: 'life', op: 'flat', value: 40 }]);
  assert.equal(s.get('life'), 70);
  s.removePrefix('eq:');
  assert.equal(s.get('life'), 1); // min clamp
});

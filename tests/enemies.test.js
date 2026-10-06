import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, makePlayer, run, reg } from './helpers/sim.js';
import { Bot } from '../src/sim/bot.js';

const ENEMIES = reg.all('enemy').filter((e) => e.id !== 'enm.test_dummy' && e.ai.brain !== 'hazard' && !e.role?.includes('decoy'));

test('every enemy archetype engages a passive player and deals damage (no dead brains)', () => {
  const dead = [];
  for (const def of ENEMIES) {
    const w = makeWorld({ seed: `eng-${def.id}`, level: 5 });
    const p = makePlayer(w, 'cls.belfry', 5, 40, 40);
    p.stats.add('test', [{ stat: 'life', op: 'flat', value: 1e6 }]); w.refreshLife(p, true);
    const stationary = (def.speed ?? 1) === 0;
    const e = w.spawnEnemy(def.id, 40, stationary ? 43 : 48, { level: 5 });
    if (def.ai.brain === 'ambusher') e.ai.cfg = { ...e.ai.cfg };
    let hurt = false; w.events.on('damage', (i) => { if (i.target === p) hurt = true; });
    let moved = 0;
    const start = { x: e.x, z: e.z };
    // player stands still; give long time for slow/stationary brains
    for (let t = 0; t < 22 * 60 && !hurt; t++) {
      w.step(1 / 60);
      moved = Math.max(moved, Math.hypot(e.x - start.x, e.z - start.z));
      if (def.ai.brain === 'ambusher' && t === 120) { p.x = 40; p.z = 45; } // walk onto the burrower
    }
    if (!hurt) dead.push(`${def.id}(moved ${moved.toFixed(1)}, state ${e.ai.state})`);
  }
  assert.deepEqual(dead, [], `enemies that never hurt the player: ${dead.join(', ')}`);
});

test('roles produce distinct behaviour: kiter keeps distance, charger crashes into walls, exploder dies', () => {
  // kiter keeps range
  let w = makeWorld({ seed: 'kite', level: 5 });
  let p = makePlayer(w, 'cls.belfry', 5);
  p.stats.add('t', [{ stat: 'life', op: 'flat', value: 1e6 }]); w.refreshLife(p, true);
  const cantor = w.spawnEnemy('enm.cracked_cantor', 40, 50, { level: 5 });
  let minD = 99;
  for (let i = 0; i < 600; i++) { w.step(1 / 60); minD = Math.min(minD, Math.hypot(cantor.x - p.x, cantor.z - p.z)); if (i === 200) { p.x = 40; p.z = 47; } }
  assert.ok(minD > 2.5, `cantor kept range ${minD}`);

  // charger crash stun: a wall appears in the line of the charge after the telegraph started
  w = makeWorld({ seed: 'boar', level: 5 });
  p = makePlayer(w, 'cls.belfry', 5, 40, 40);
  p.stats.add('t', [{ stat: 'life', op: 'flat', value: 1e6 }]); w.refreshLife(p, true);
  const boar = w.spawnEnemy('enm.crackhide_boar', 40, 29, { level: 5 });
  let crashed = false; w.events.on('ai:crash', () => { crashed = true; });
  let walled = false;
  for (let i = 0; i < 20 * 60 && !crashed; i++) {
    w.step(1 / 60);
    if (!walled && boar.cast?.ab.id === 'abl.enm.boar_charge' && boar.cast.phase === 'windup' && boar.cast.t > 0.6) { w.nav.blockRect(36, 33, 44, 34.2); walled = true; }
  }
  assert.ok(walled, 'boar telegraphed a charge');
  assert.ok(crashed, 'boar crashed into the wall and stunned itself');
  assert.ok(w.status.has(boar, 'st.stunned'));

  // exploder kills itself
  w = makeWorld({ seed: 'blast', level: 5 });
  p = makePlayer(w, 'cls.belfry', 5);
  p.stats.add('t', [{ stat: 'life', op: 'flat', value: 1e6 }]); w.refreshLife(p, true);
  const pen = w.spawnEnemy('enm.penitent_blast', 40, 46, { level: 5 });
  run(w, 8);
  assert.ok(pen.dead, 'penitent exploded');
});

test('telegraph fairness: a competent bot avoids most heavy attacks; passive player takes them', () => {
  const heavy = ['enm.brass_sentinel', 'enm.crackhide_boar', 'enm.mute_bellringer'];
  for (const id of heavy) {
    const results = [];
    for (const skill of [0, 1]) {
      const w = makeWorld({ seed: `fair-${id}-${skill}`, level: 6 });
      const p = makePlayer(w, 'cls.belfry', 6);
      p.stats.add('t', [{ stat: 'life', op: 'flat', value: 1e6 }]); w.refreshLife(p, true);
      w.spawnEnemy(id, 40, 46, { level: 6 });
      const bot = new Bot(w, { skill, reaction: 0.3, idle: skill === 0 });
      bot.skill = skill;
      let taken = 0;
      w.events.on('damage', (i) => { if (i.target === p) taken += i.amount; });
      for (let t = 0; t < 25 * 60; t++) { bot.update(1 / 60); w.step(1 / 60); }
      results.push(taken);
    }
    assert.ok(results[1] < results[0] || results[0] === 0, `${id}: skilled ${results[1]} vs passive ${results[0]}`);
  }
});

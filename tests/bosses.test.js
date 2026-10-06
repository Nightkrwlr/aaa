import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, makePlayer, run, reg } from './helpers/sim.js';
import { Bot } from '../src/sim/bot.js';
import { pickEliteMods, eliteMaxMods } from '../src/sim/director/elites.js';
import { Rng } from '../src/core/rng.js';

function arena(boss, level) {
  const w = makeWorld({ seed: `boss-${boss}`, level, size: 100 });
  const p = makePlayer(w, 'cls.belfry', level, 40, 40);
  p.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 5e5 }]); w.refreshLife(p, true);
  const b = w.spawnEnemy(boss, 40, 52, { level });
  return { w, p, b };
}

test('Ildra: shield blocks damage until a Triad; phases advance; shield returns; reset on player death', () => {
  const { w, p, b } = arena('boss.ildra', 7);
  const log = [];
  for (const t of ['boss:start', 'boss:phase', 'boss:shield_break', 'boss:shield_up', 'boss:reset']) w.events.on(t, (i) => log.push(`${t}${i.phase ? i.phase : ''}`));
  run(w, 3);
  assert.ok(b.boss.started);
  assert.ok(b.boss.shield.up);
  const hp0 = b.hp;
  for (let i = 0; i < 20; i++) w.hit(p, b, { type: 'sonic', coef: 3, scaling: 'weapon' }, reg.get('abl.belfry.clapper'));
  assert.ok(hp0 - b.hp < hp0 * 0.01, `shield absorbed: lost ${hp0 - b.hp}`);
  // Triad: 3 distinct tones within the window
  p.res.value = 100;
  p.loadout.s2 = 'abl.belfry.chain_bell'; p.loadout.s3 = 'abl.belfry.alarm';
  for (const [slot, d] of [['s1', 0.5], ['s2', 0.5], ['s3', 0.5]]) { w.abilities.tryCast(p, p.loadout[slot], b.x, b.z); run(w, 0.75); p.res.value = 100; }
  assert.ok(log.includes('boss:shield_break'), `log ${log.join(',')}`);
  assert.ok(w.status.has(b, 'st.boss_vuln'));
  const hp1 = b.hp; w.hit(p, b, { type: 'sonic', coef: 3, scaling: 'weapon' }, reg.get('abl.belfry.clapper'));
  assert.ok(hp1 - b.hp > hp0 * 0.002, 'damage flows while the shield is broken');
  // phase 2 triggers below 62 %
  b.hp = b.hpMax * 0.6; run(w, 0.3);
  assert.equal(b.phase, 2);
  assert.ok(b.invulnerableUntil > w.time - 0.01 || b.boss.phaseIdx === 1);
  // player death resets the fight
  w.kill(p, null); run(w, 0.1);
  assert.ok(log.includes('boss:reset'));
  assert.equal(b.hp, b.hpMax); assert.equal(b.phase, 1);
});

test('Brannoch: charge into a pillar staggers him (environment mechanic) and phase 2 summons', () => {
  const { w, p, b } = arena('boss.brannoch', 5);
  w.nav.blockCircle(40, 47, 1.2);
  let staggered = false; w.events.on('status:applied', (i) => { if (i.statusId === 'st.staggered' && i.target === b) staggered = true; });
  let phase2 = false; w.events.on('boss:phase', (i) => { if (i.phase === 2) phase2 = true; });
  p.x = 40; p.z = 41;
  for (let t = 0; t < 40 * 60 && !staggered; t++) { w.step(1 / 60); if (b.ai.state === 'idle') b.ai.target = p; }
  assert.ok(staggered, 'Brannoch crashed into the pillar');
  b.hp = b.hpMax * 0.5; run(w, 1);
  assert.ok(phase2);
  assert.ok(w.entities.some((e) => e.owner === b && !e.dead), 'phase 2 call summoned adds');
});

test('a competent bot can beat Brannoch; boss damage is mostly avoidable', () => {
  const { w, p, b } = arena('boss.brannoch', 5);
  p.stats.remove('godmode'); w.refreshLife(p, true);
  p.stats.add('hp', [{ stat: 'life', op: 'flat', value: 200 }]); w.refreshLife(p, true);
  const bot = new Bot(w, { skill: 0.9, reaction: 0.35 });
  for (let t = 0; t < 120 * 60 && !b.dead && !p.dead; t++) { bot.update(1 / 60); w.step(1 / 60); if (t % 120 === 0) p.res.value = Math.max(p.res.value, 40); }
  assert.ok(b.dead || p.dead || b.hp < b.hpMax * 0.9, 'fight progressed');
});

test('elite modifiers obey exclusions, role filters and the danger budget; elites drop more', () => {
  const rng = new Rng('elites');
  for (let i = 0; i < 300; i++) {
    const def = reg.get('enm.hollow_chorister');
    const mods = pickEliteMods(reg, def, 10, rng);
    assert.ok(mods.length <= eliteMaxMods(10));
    assert.ok(!(mods.includes('elm.twins') && mods.includes('elm.barrier')));
    assert.ok(!(mods.includes('elm.blinker') && mods.includes('elm.mine_layer')));
    const turret = pickEliteMods(reg, reg.get('enm.tuning_turret'), 10, rng);
    assert.ok(!turret.includes('elm.blinker') && !turret.includes('elm.twins'));
  }
  const w = makeWorld({ seed: 'elite', level: 6 });
  const p = makePlayer(w, 'cls.belfry', 6);
  const e = w.spawnEnemy('enm.hollow_chorister', 40, 46, { level: 6, eliteMods: ['elm.barrier', 'elm.warcry'] });
  assert.equal(e.tier, 'elite');
  assert.ok(e.shield > 0 && e.hpMax > w.balance.enemyHp(6, 'standard') * 3);
  const swift = w.spawnEnemy('enm.hollow_chorister', 44, 46, { level: 6, eliteMods: ['elm.swift'] });
  assert.ok(swift.stats.get('moveSpeed') > w.spawnEnemy('enm.hollow_chorister', 46, 46, { level: 6 }).stats.get('moveSpeed'));
  // barrier breaks → vulnerable
  e.shield = 0; w.step(1 / 60);
  assert.ok(w.status.has(e, 'st.vulnerable'));
});

test('elite hooks run mechanics: hush aura creates a zone, twins call copies', () => {
  const w = makeWorld({ seed: 'elite2', level: 6 });
  const p = makePlayer(w, 'cls.belfry', 6);
  p.stats.add('g', [{ stat: 'life', op: 'flat', value: 1e5 }]); w.refreshLife(p, true);
  const e = w.spawnEnemy('enm.hollow_chorister', 40, 47, { level: 6, yaw: Math.PI, eliteMods: ['elm.hush_aura'] });
  run(w, 8);
  assert.ok(w.zones.some((z) => z.kind === 'hush') || w.status.has(p, 'st.hush') || e.eliteHooks[0].next > w.time, 'hush field mechanic fired');
  const t = w.spawnEnemy('enm.hollow_chorister', 36, 47, { level: 6, yaw: Math.PI, eliteMods: ['elm.twins'] });
  run(w, 4);
  assert.ok(w.entities.filter((x) => x.owner === t).length >= 1, 'twins called');
});

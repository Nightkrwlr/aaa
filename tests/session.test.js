import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSession, tick, teleport, ia, slay, talk, talkThrough, sreg, hearCylinder } from './helpers/session.js';

test('new game: first quest starts, session is deterministic', () => {
  const a = makeSession({ seed: 'det-1' }), b = makeSession({ seed: 'det-1' });
  assert.equal(a.state.quests['qst.first_echo'].state, 'active');
  assert.equal(a.state.quests['qst.first_echo'].stage, 'wake');
  assert.ok(a.state.waypoints.has('wp.latency'), 'waypoint unlocked by quest effect');
  const sig = (s) => s.world.entities.filter((e) => e.kind === 'enemy').map((e) => `${e.id}@${e.x.toFixed(2)},${e.z.toFixed(2)}`).join('|');
  assert.equal(sig(a), sig(b));
  tick(a, 5); tick(b, 5);
  assert.equal(sig(a), sig(b), 'identical after simulating');
});

test('opening quest chain: cylinder → area → Orrel → quarry (order independent, level-triggered)', () => {
  const s = makeSession();
  teleport(s, ia(s, 'poi.voice_cylinder_1').x, ia(s, 'poi.voice_cylinder_1').z);
  s.interact(ia(s, 'poi.voice_cylinder_1'));
  assert.equal(s.state.quests['qst.first_echo'].stage, 'path');
  teleport(s, 0, -30); tick(s, 1);
  assert.equal(s.state.quests['qst.first_echo'].stage, 'meet');
  const r = talk(s, 'npc.orrel');
  assert.equal(r.dialogue.node, 'first_1');
  assert.equal(s.state.quests['qst.first_echo'].stage, 'quarry');
  assert.ok(s.state.discovered.has('cdx.coro') === false);
  s.dialogue.advance(null); // → hub
  s.dialogue.advance(0);    // "where am I" → place
  assert.ok(s.state.discovered.has('cdx.coro'));
});

test('boss kill advances quest, drops loot, gives XP; report completes quest and chains the next', () => {
  const s = makeSession({ seed: 'story-2' });
  hearCylinder(s);
  teleport(s, 0, -30); tick(s, 1); talk(s, 'npc.orrel'); s.dialogue.end();
  const brannoch = s.world.entities.find((e) => e.id === 'boss.brannoch');
  assert.ok(brannoch, 'Brannoch is placed in the quarry');
  const xp0 = s.character.xp + s.character.level * 1000;
  slay(s, brannoch);
  assert.ok(s.state.bosses.has('boss.brannoch'));
  assert.equal(s.state.quests['qst.first_echo'].stage, 'report');
  assert.ok(s.character.xp + s.character.level * 1000 > xp0, 'xp granted');
  assert.ok(s.loot.ground.length > 0, 'loot on the ground');
  // reporting: the dialogue picks the report root, quest completes
  const seen = talkThrough(s, 'npc.orrel', [1]);
  assert.equal(seen[0], 'report_1');
  assert.equal(s.state.quests['qst.first_echo'].state, 'done');
  assert.equal(s.state.quests['qst.empty_choir'].state, 'active', 'next quest auto-starts');
  assert.ok(s.character.inv.chimes >= 25, 'reward chimes');
});

test('level-triggered objectives: killing the boss BEFORE the quest reaches that stage still counts', () => {
  const s = makeSession({ seed: 'story-3' });
  hearCylinder(s);
  slay(s, s.world.entities.find((e) => e.id === 'boss.brannoch'));
  teleport(s, 0, -30); tick(s, 1);
  talk(s, 'npc.orrel'); s.dialogue.end();
  assert.equal(s.state.quests['qst.first_echo'].stage, 'report');
});

test('death: bundle drops, respawn restores, bundle can be recovered', () => {
  const s = makeSession({ seed: 'death-1' });
  s.character.inv.addChimes(500);
  teleport(s, -30, 10);
  const lostBefore = s.character.inv.chimes;
  s.world.kill(s.player, null);
  assert.ok(s.dead);
  assert.equal(s.state.stats.deaths, 1);
  const lost = s.pendingDeath.lost;
  assert.ok(lost > 0 && s.character.inv.chimes === lostBefore - lost);
  assert.ok(s.respawn());
  assert.ok(!s.player.dead && s.player.hp === s.player.hpMax);
  assert.ok(s.loot.ground.some((g) => g.kind === 'deathBundle'));
  const b = s.loot.ground.find((g) => g.kind === 'deathBundle');
  teleport(s, b.x, b.z); tick(s, 2);
  assert.equal(s.character.inv.chimes, lostBefore, 'bundle recovered');
});

test('fast travel & rest rules', () => {
  const s = makeSession({ seed: 'ft-1' });
  assert.equal(s.fastTravel('wp.orrel').reason, 'locked');
  teleport(s, ia(s, 'wp.orrel').x, ia(s, 'wp.orrel').z); s.interact(ia(s, 'wp.orrel'));
  assert.ok(s.state.waypoints.has('wp.orrel'));
  teleport(s, -30, 10);
  assert.equal(s.fastTravel('wp.orrel').ok, true);
  assert.ok(Math.hypot(s.player.x - 2, s.player.z + 22) < 8);
  s.character.potion.charges = 0; s.player.hp = 1;
  assert.equal(s.rest().ok, true);
  assert.equal(s.character.potion.charges, s.character.potion.max);
  assert.equal(s.player.hp, s.player.hpMax);
});

test('early loot pity: the first fights always pay out (a Fine weapon first, then a drop at least every 6 kills)', () => {
  for (const seed of ['pity-a', 'pity-b', 'pity-c']) {
    const s = makeSession({ seed });
    s.world.rng.chance = () => false;                         // no natural drops: everything that appears comes from the pity timer
    const items = () => s.loot.ground.filter((g) => g.kind === 'item');
    const firstAtKill = [];
    for (let k = 1; k <= 16; k++) {
      const e = s.world.spawnEnemy('enm.hollow_chorister', s.player.x + 4, s.player.z + 4, { level: 1 });
      const n0 = items().length; slay(s, e);
      if (items().length > n0) firstAtKill.push(k);
    }
    assert.deepEqual(firstAtKill, [4, 10, 16], `${seed}: drops on kills 4, 10, 16`);
    const first = items()[0].item;
    assert.equal(s.registry.get(first.base).slot, 'weapon', 'the guaranteed first drop is a weapon');
    assert.notEqual(first.rarity, 'common', 'and it is Fine or better');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeSession, tick, teleport, ia, slay, talk, hearCylinder, sreg } from './helpers/session.js';
import { SaveManager, MemoryAdapter, checksum, SAVE_VERSION, AutoSaver, snapshot } from '../src/sim/save.js';
import { fsAdapter } from '../src/sim/saveFs.js';

function playedSession(seed = 'save-1') {
  const s = makeSession({ seed });
  hearCylinder(s); teleport(s, 0, -30); tick(s, 1); talk(s, 'npc.orrel'); s.dialogue.end();
  s.character.grantXp(s.world, s.player, 500);
  s.character.inv.addChimes(321); s.character.inv.addMaterial('mat.brass_scrap', 7);
  for (let i = 0; i < 3; i++) { const it = s.factory.roll(s.world.rng, { ilvl: s.character.level, rarity: 'attuned', tags: [], classId: s.character.classId }); s.character.inv.add(it); }
  const w = s.character.inv.items()[0]; s.character.inv.find(w.iid).fav = true;
  s.stashPut(s.character.inv.items()[1].iid);
  s.state.setFlag('hello', 3); s.unlockWaypoint('wp.orrel');
  const free = s.character.talentPoints(); if (free > 0) { const c = s.character.tree.canAllocate; }
  tick(s, 2);
  return s;
}

test('roundtrip: character, inventory, stash, quests, flags and position survive save/load', () => {
  const s = playedSession();
  const m = new SaveManager(new MemoryAdapter());
  const r = m.save('slot1', s); assert.ok(r.ok, r.error);
  const out = m.load('slot1', sreg());
  assert.ok(out.ok, out.error);
  const t = out.session;
  assert.equal(t.character.level, s.character.level);
  assert.equal(t.character.xp, s.character.xp);
  assert.equal(t.character.inv.chimes, 321);
  assert.equal(t.character.inv.materials['mat.brass_scrap'], 7);
  assert.deepEqual(t.character.inv.items().map((i) => i.iid), s.character.inv.items().map((i) => i.iid));
  assert.equal(t.character.inv.items().find((i) => i.fav)?.iid, s.character.inv.items().find((i) => i.fav)?.iid);
  assert.equal(t.stash.items().length, 1);
  assert.deepEqual(t.state.quests, s.state.quests);
  assert.equal(t.state.flags.hello, 3);
  assert.ok(t.state.waypoints.has('wp.orrel'));
  assert.ok(Math.hypot(t.player.x - s.player.x, t.player.z - s.player.z) < 3);
  assert.equal(t.character.name, s.character.name);
  // item ids keep counting up (no collisions after load)
  const n = t.factory.newIid(); assert.ok(!t.character.inv.find(n) && !t.stash.find(n));
  // and the loaded game keeps running
  tick(t, 3);
  assert.ok(!t.player.dead);
});

test('cleared groups and defeated bosses are not respawned after loading', () => {
  const s = makeSession({ seed: 'save-2' });
  const g = s.overworld.groups[0];
  for (const e of g.enemies) slay(s, e);
  slay(s, s.world.entities.find((e) => e.id === 'boss.brannoch'));
  assert.ok(s.state.cleared.has(g.id));
  const m = new SaveManager(new MemoryAdapter()); m.save('slot1', s);
  const t = m.load('slot1', sreg()).session;
  assert.ok(!t.world.entities.some((e) => e.id === 'boss.brannoch'), 'defeated boss stays dead');
  assert.ok(!t.world.entities.some((e) => e.spawnId === g.id), 'cleared pack stays cleared');
  t.character.level = 3; t.teleport?.(0, 0);
  teleport(t, ia(t, 'wp.orrel').x, ia(t, 'wp.orrel').z); t.interact(ia(t, 'wp.orrel')); tick(t, 8);
  assert.equal(t.rest().ok, true);
  assert.ok(t.world.entities.some((e) => e.spawnId === g.id), 'resting respawns the pack');
});

test('corruption: checksum catches tampering and the previous backup is used', () => {
  const s = playedSession('save-3');
  const ad = new MemoryAdapter(); const m = new SaveManager(ad);
  m.save('slot1', s); s.character.inv.addChimes(100); m.save('slot1', s);
  assert.ok(ad.read('sdc.save.slot1.bak1'));
  const raw = ad.read('sdc.save.slot1');
  ad.write('sdc.save.slot1', raw.replace('"chimes\\":421', '"chimes\\":999999'));
  const out = m.load('slot1', sreg());
  assert.ok(out.ok); assert.ok(out.recovered); assert.equal(out.source, 'bak1');
  assert.equal(out.session.character.inv.chimes, 321, 'older state restored, not the tampered one');
  // truncated file
  ad.write('sdc.save.slot1', raw.slice(0, raw.length / 2));
  assert.equal(m.read('slot1').source, 'bak1');
});

test('rotation keeps N backups, interrupted promote recovers from .tmp, total loss reports cleanly', () => {
  const s = playedSession('save-4');
  const ad = new MemoryAdapter(); const m = new SaveManager(ad, { backups: 3 });
  for (let i = 0; i < 6; i++) { s.character.inv.addChimes(1); m.save('slot1', s); }
  for (const k of ['', '.bak1', '.bak2', '.bak3']) assert.ok(ad.read(`sdc.save.slot1${k}`), `has ${k}`);
  assert.equal(ad.read('sdc.save.slot1.bak4'), null);
  // corrupt main and bak1 → bak2 survives
  ad.write('sdc.save.slot1', '{garbage'); ad.write('sdc.save.slot1.bak1', '');
  assert.equal(m.read('slot1').source, 'bak2');
  // interrupted: main missing but a verified tmp exists
  const good = ad.read('sdc.save.slot1.bak2'); ad.remove('sdc.save.slot1'); ad.write('sdc.save.slot1.tmp', good);
  assert.equal(m.read('slot1').source, 'tmp');
  m.delete('slot1');
  const none = m.load('slot1', sreg()); assert.equal(none.ok, false);
  assert.equal(m.list(['slot1'])[0].empty, true);
});

test('migrations: a v1 payload upgrades to the current version and loads', () => {
  const s = playedSession('save-5');
  const cur = JSON.parse(JSON.stringify(snapshot(s)));
  // fabricate a v1 payload: flags at top level, no stash/cleared/depleted/specs
  const v1 = { seed: cur.seed, settings: cur.settings, flags: cur.state.flags, character: { ...cur.character }, pos: undefined, zone: cur.zone };
  v1.character.pos = cur.pos; delete v1.character.inv.keyItems;
  v1.state = undefined; delete v1.state;
  const payload = JSON.stringify(v1);
  const env = JSON.stringify({ magic: 'SDCH', version: 1, build: 'old', savedAt: 1, meta: { name: 'x' }, checksum: checksum(payload), payload });
  const ad = new MemoryAdapter(); ad.write('sdc.save.slot1', env);
  const m = new SaveManager(ad);
  const out = m.load('slot1', sreg());
  assert.ok(out.ok, out.error); assert.ok(out.migrated);
  assert.equal(out.session.state.flags.hello, 3);
  assert.equal(out.session.stash.capacity, 80);
  assert.equal(out.session.character.level, s.character.level);
});

test('a save from a newer version is refused (never guessed at)', () => {
  const s = playedSession('save-6');
  const ad = new MemoryAdapter(); const m = new SaveManager(ad); m.save('slot1', s);
  const env = JSON.parse(ad.read('sdc.save.slot1')); env.version = SAVE_VERSION + 1; ad.write('sdc.save.slot1', JSON.stringify(env));
  const r = m.load('slot1', sreg()); assert.equal(r.ok, false); assert.match(r.error, /newer version/);
});

test('export/import blob and filesystem adapter', async () => {
  const s = playedSession('save-7');
  const m1 = new SaveManager(new MemoryAdapter()); m1.save('slot1', s);
  const blob = m1.exportSlot('slot1'); assert.ok(blob.length > 100);
  const m2 = new SaveManager(await fsAdapter(mkdtempSync(join(tmpdir(), 'sdc-'))));
  assert.ok(m2.importSlot('slot2', blob).ok);
  assert.equal(m2.load('slot2', sreg()).session.character.inv.chimes, 321);
  assert.equal(m2.importSlot('slot3', 'not base64 at all').ok, false);
  assert.ok(m2.save('slot1', s).ok);
  assert.equal(m2.list(['slot1', 'slot2', 'slot9']).map((x) => !!x.meta).join(), 'true,true,false');
});

test('saving inside a dungeon stores the portal position; autosave is debounced but important events force it', () => {
  const s = playedSession('save-8'); s.character.level = 5;
  const p = ia(s, 'poi.dungeon_crypt'); teleport(s, p.x, p.z); tick(s, 0.1); assert.ok(s.interact(p).ok);
  const m = new SaveManager(new MemoryAdapter());
  assert.ok(m.save('slot1', s).ok);
  const t = m.load('slot1', sreg()).session;
  assert.equal(t.mode, 'overworld');
  assert.ok(Math.hypot(t.player.x - p.x, t.player.z - p.z) < 6, 'back at the portal');
  // autosave
  const a = new AutoSaver(t, m, { minGap: 30 });
  t.events.emit('autosave', { reason: 'rest' }); t.events.emit('autosave', { reason: 'waypoint' });
  assert.equal(a.count, 1, 'minor reasons are debounced');
  t.events.emit('autosave', { reason: 'boss' });
  assert.equal(a.count, 2, 'bosses always save');
});

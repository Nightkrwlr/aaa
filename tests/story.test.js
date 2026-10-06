import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSession, tick, teleport, ia, slay, talk, talkThrough, hearCylinder } from './helpers/session.js';

/** bring a fresh session to "Brannoch dead, quest reported" so the crypt chapter is open */
function chapterTwo(seed) {
  const s = makeSession({ seed });
  hearCylinder(s); teleport(s, 0, -30); tick(s, 1); talk(s, 'npc.orrel'); s.dialogue.end();
  slay(s, s.world.entities.find((e) => e.id === 'boss.brannoch'));
  talkThrough(s, 'npc.orrel', [1]);
  return s;
}
const enterCrypt = (s) => { const p = ia(s, 'poi.dungeon_crypt'); teleport(s, p.x, p.z); tick(s, 0.1); const r = s.interact(p); assert.ok(r.ok, JSON.stringify(r)); return s.dungeon; };

test('story crypt: deterministic story dungeon with Tarn, narrative flags, boss, artifact, rewards', () => {
  const s = chapterTwo('crypt-1');
  const rt = enterCrypt(s);
  assert.equal(s.mode, 'dungeon');
  assert.equal(rt.d.family, 'dfm.serrane_crypt');
  assert.equal(rt.d.content.boss.boss, 'boss.crypt_warden');
  const tarn = rt.interactables.find((o) => o.kind === 'stranded_scout' && o.npc === 'npc.tarn');
  assert.ok(tarn, 'Tarn is guaranteed in the story crypt');
  const lore = rt.interactables.filter((o) => o.kind === 'lore');
  assert.ok(lore.length >= 4, 'tarn expedition narrative pieces');
  // read all lore → the censored register flag
  for (const l of lore) { teleport(s, l.x, l.z); tick(s, 0.05); s.interact(l); }
  assert.ok(s.state.flags.found_censored_record, 'reading the last cylinder sets the memory flag');
  assert.ok(s.state.discovered.has('cdx.censored_register'));
  // determinism: same spec → same layout
  const again = chapterTwo('crypt-1-b'); const rt2 = enterCrypt(again);
  assert.equal(rt2.d.id, rt.d.id); assert.equal(rt2.d.map.ascii?.() ?? rt2.d.rooms.size, rt.d.map.ascii?.() ?? rt.d.rooms.size);
  // boss room triggers the guardian; killing it reveals the artifact
  const b = rt.d.content.boss;
  teleport(s, b.x, b.z); tick(s, 0.3);
  const boss = s.world.entities.find((e) => e.id === 'boss.crypt_warden');
  assert.ok(boss, 'guardian spawned on entering its room');
  slay(s, boss);
  const art = rt.interactables.find((o) => o.kind === 'artifact');
  assert.ok(art, 'artifact appears');
  teleport(s, art.x, art.z); assert.ok(s.interact(art).ok);
  const exit = rt.interactables.find((o) => o.kind === 'dungeon_exit');
  teleport(s, exit.x, exit.z); tick(s, 0.1);
  s.interact(exit);
  assert.equal(s.mode, 'overworld');
  assert.ok(s.character.inv.keyItems.has('key.resonant_core'));
  assert.equal(s.state.quests['qst.empty_choir'].stage, 'door');
  assert.ok(s.state.dungeons.specs['dgn.crypt_resonance']);
  assert.ok(s.loot.ground.length > 0, 'completion rewards spawned');
});

test('Tarn: rescue vs abandon changes the world (NPC in town, Hesk reaction, discount)', () => {
  for (const choice of [0, 1]) {
    const s = chapterTwo(`tarn-${choice}`);
    // Hesk gives the quest
    talkThrough(s, 'npc.hesk', [3, 0]);
    assert.equal(s.state.quests['qst.apprentice']?.state, 'active', 'Hesk offered the job');
    const rt = enterCrypt(s);
    const tarn = rt.interactables.find((o) => o.npc === 'npc.tarn');
    teleport(s, tarn.x, tarn.z);
    s.interact(tarn);
    assert.ok(s.state.flags.tarn_found);
    s.dialogue.advance(choice); s.dialogue.end();
    assert.equal(!!s.state.flags.tarn_rescued, choice === 0);
    assert.equal(!!s.state.flags.tarn_abandoned, choice === 1);
    assert.equal(s.state.quests['qst.apprentice'].stage, 'return');
    rt.leave(false);
    assert.equal(s.mode, 'overworld');
    assert.equal(s.overworld.npcs.has('npc.tarn'), choice === 0, 'Tarn only shows up in town if rescued');
    const seen = talkThrough(s, 'npc.hesk', [0]);
    assert.equal(seen[0], choice === 0 ? 'app_rescued' : 'app_abandoned');
    assert.equal(s.state.quests['qst.apprentice'].state, 'done');
    assert.equal(!!s.state.flags.hesk_discount, choice === 0);
  }
});

test('Bell Gate: sealed by a resonance curtain until objectives are met (no level gating)', () => {
  const s = chapterTwo('gate-1');
  s.character.level = 30; // level is irrelevant to the gate
  const reach = () => s.zone.nav.reachable(s.zone.spawnPoint.x, s.zone.spawnPoint.z);
  const inChoir = () => { const n = s.zone.nav.nearestWalkable(5, 56, 3); return n && reach().has(s.zone.nav.cellKey(n.x, n.z)); };
  assert.ok(!inChoir(), 'choir region unreachable while the curtain stands');
  const gate = ia(s, 'poi.bellgate'); teleport(s, gate.x, gate.z); tick(s, 0.1);
  const r1 = s.interact(gate);
  assert.equal(r1.ok, false);
  assert.equal(s.gates.status('gate.choir_door').reqs.find((r) => r.id === 'r1').met, true, 'Brannoch is dead');
  assert.equal(s.gates.status('gate.choir_door').reqs.find((r) => r.id === 'r2').met, false, 'core missing');
  s.character.inv.keyItems.add('key.resonant_core');
  s.state.dungeons.specs['dgn.crypt_resonance'] = true; s.events.emit('dungeonDone', { family: 'dfm.serrane_crypt', spec: 'dgn.crypt_resonance' });
  const r2 = s.interact(gate);
  assert.equal(r2.ok, true);
  assert.ok(inChoir(), 'region reachable after the gate opens');
  assert.ok(s.state.flags['open:gate.choir_door']);
  assert.equal(s.state.quests['qst.empty_choir'].stage, 'ildra');
  // Ildra → final talk → quest done
  const ildra = s.world.entities.find((e) => e.id === 'boss.ildra'); assert.ok(ildra);
  slay(s, ildra);
  assert.equal(s.state.quests['qst.empty_choir'].stage, 'end');
  assert.ok(s.state.flags.ildra_freed);
  const seen = talkThrough(s, 'npc.orrel', [1]);
  assert.equal(seen[0], 'final_1');
  assert.equal(s.state.quests['qst.empty_choir'].state, 'done');
  assert.ok(s.state.flags.slice_complete);
});

test('Orrel remembers: confronting him about the censored register changes later dialogue', () => {
  for (const pick of [0, 1]) {
    const s = chapterTwo(`orrel-${pick}`);
    s.state.flags.found_censored_record = true;
    talkThrough(s, 'npc.orrel', [0, pick]); // crypt_1 → confront → pick
    assert.ok(s.state.flags.orrel_truth);
    assert.equal(!!s.state.flags.orrel_forgiven, pick === 0);
    assert.equal(!!s.state.flags.orrel_cold, pick === 1);
    assert.equal(s.state.rep.vigilia, pick === 0 ? 1 : -1);
  }
});

test('silent bells: info gathered at three places solves a unique ordering puzzle', () => {
  const s = makeSession({ seed: 'bells-1' });
  talkThrough(s, 'npc.maeve', [1, 1]); // hub → rumor1 (starts quest) → enough
  assert.equal(s.state.quests['qst.silent_bells'].state, 'active');
  const tablets = s.interactables.filter((o) => o.kind === 'tablet');
  const pillars = s.interactables.filter((o) => o.kind === 'tone_pillar');
  assert.equal(pillars.length, 5);
  assert.equal(tablets.length, 3);
  assert.ok(new Set(tablets.map((t) => Math.round(t.x / 20))).size >= 2, 'tablets are far apart');
  for (const t of tablets) { teleport(s, t.x, t.z); tick(s, 0.05); assert.ok(s.interact(t).ok); }
  assert.equal(s.state.quests['qst.silent_bells'].stage, 'bells');
  const pz = s.puzzleHost.get('wpz.silent_bells');
  for (const idx of pz.instance.order) { const p = pillars.find((o) => o.index === idx); teleport(s, p.x, p.z); tick(s, 0.05); assert.ok(s.interact(p).ok); }
  assert.ok(pz.solved);
  assert.equal(s.state.quests['qst.silent_bells'].state, 'done');
  assert.ok(s.loot.ground.some((g) => g.kind === 'item' && g.item.unique === 'unq.inverted_bell'), 'unique reward drops');
});

test('secret chain: three hidden glyphs (Listen + weather) → glyph door → Discord Chamber → optional boss', () => {
  const s = makeSession({ seed: 'glyph-1' });
  s.character.level = 6; s.character.recompute(s.world, s.player);
  const pulse = (x, z) => { teleport(s, x, z); tick(s, 0.05); s.world.listen.pulse(s.player); };
  pulse(44, -60); // overlook: needs no weather
  assert.ok(s.state.flags.glyph_1);
  assert.equal(s.state.quests['qst.footprints'].state, 'active');
  pulse(-44, -30);
  assert.ok(!s.state.flags.glyph_2, 'harps glyph is silent in calm weather');
  s.weather.force('windstorm', 300); tick(s, 0.1);
  pulse(-44, -30);
  assert.ok(s.state.flags.glyph_2, 'the storm makes it ring');
  pulse(22, -6);
  assert.ok(s.state.flags.glyph_3);
  assert.equal(s.state.secrets['sec.glyph_statue'], 'found');
  const dials = s.interactables.filter((o) => o.kind === 'glyph_dial');
  assert.equal(dials.length, 3);
  const sol = s.puzzleHost.get('wpz.glyph_door').instance.solution;
  dials.forEach((d, i) => { teleport(s, d.x, d.z); for (let k = 0; k < sol[i]; k++) s.interact(d); });
  assert.ok(s.puzzleHost.get('wpz.glyph_door').solved);
  const portal = ia(s, 'ia.desafine_portal'); teleport(s, portal.x, portal.z); tick(s, 0.1);
  assert.ok(s.interact(portal).ok);
  const rt = s.dungeon; const b = rt.d.content.boss;
  assert.equal(b.boss, 'boss.tarn_echo');
  teleport(s, b.x, b.z); tick(s, 0.3);
  slay(s, s.world.entities.find((e) => e.id === 'boss.tarn_echo'));
  assert.ok(s.loot.ground.some((g) => g.kind === 'item' && g.item.unique === 'unq.rest_pendant'), 'boss drops the unique on first kill');
  const exit = rt.interactables.find((o) => o.kind === 'dungeon_exit'); teleport(s, exit.x, exit.z); s.interact(exit);
  assert.equal(s.state.quests['qst.footprints'].state, 'done');
});

test('hidden caches are revealed only by Listening', () => {
  const s = makeSession({ seed: 'cache-1' });
  const c = ia(s, 'sec.cache_bellpath');
  assert.ok(c && !s.isActive(c));
  teleport(s, c.x, c.z); tick(s, 0.1);
  assert.equal(s.nearestInteractable(), null);
  s.world.listen.pulse(s.player);
  assert.ok(s.isActive(c));
  assert.equal(s.nearestInteractable(), c);
  assert.ok(s.interact(c).ok);
  assert.ok(s.loot.ground.length > 0);
  assert.ok(!s.isActive(c));
});

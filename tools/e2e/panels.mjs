// Opens every UI panel on a populated session and screenshots it (visual QA). usage: node tools/shot.mjs x.png --script tools/e2e/panels.mjs --query "e2e=1&autostart=belfry&seed=panels"
const OUT = process.env.SHOT_DIR ?? '/tmp/claude-0/-home-user-aaa/3b641f7c-91e0-5f65-bdba-08dc578ec535/scratchpad/shots';
export default async function ({ page, wait, shot, logs }) {
  await page.evaluate(() => {
    const g = window.__game, s = g.session, c = s.character;
    c.level = 9; c.talentBonus = 6; c.inv.addChimes(4200);
    for (const m of ['mat.brass_scrap', 'mat.resonant_dust', 'mat.tuning_shard', 'mat.echo_core', 'mat.sonic_quartz', 'mat.limestone_dust', 'mat.wind_lichen']) c.inv.addMaterial(m, 12);
    for (let i = 0; i < 22; i++) c.inv.add(s.factory.roll(s.world.rng, { ilvl: 8 + (i % 4), bias: i % 5 === 0 ? 0.9 : 0.3, tags: c.buildTags(), classId: c.classId }));
    c.inv.add(s.factory.makeUnique(s.world.rng, 'unq.brannoch_maul', 9));
    for (const sl of ['weapon', 'chest', 'head']) { const it = s.factory.roll(s.world.rng, { ilvl: 8, rarity: 'fine', slot: sl, classId: c.classId }); c.inv.add(it); s.equip(it.iid); }
    c.inv.addConsumable('con.antidote', 2); c.inv.addConsumable('gem.sonic_1', 3); c.inv.keyItems.add('key.tarn_compass');
    c.recompute(s.world, s.player);
    s.state.visitedAreas.add('area.orrel'); s.state.visitedAreas.add('area.bell_path'); s.unlockWaypoint('wp.orrel'); s.unlockWaypoint('wp.latency');
    s.player.x = 0; s.player.z = -26; for (let i = 0; i < 40; i++) s.state.explore(s.zone, -60 + i * 3, 50 - i * 2.2, 30);
    s.state.explore(s.zone, 0, -30, 40);
    for (const id of ['cdx.coro', 'cdx.hollows', 'cdx.cylinder_awakening', 'cdx.glyph_1', 'cdx.vigilia']) s.discover(id);
    s.state.kills['enm.hollow_chorister'] = 17; s.state.kills['enm.cliff_stalker'] = 6;
    s.quests.start('qst.silent_bells'); s.quests.start('qst.apprentice');
    g.ui.closeAll();
  });
  const panels = [['inventory', {}], ['talents', {}], ['skills', {}], ['quests', {}], ['map', { mode: 'travel' }], ['codex', {}], ['craft', { station: 'forge' }], ['settings', {}], ['pause', {}], ['rift', {}]];
  for (const [p, d] of panels) {
    await page.evaluate(([p, d]) => { const g = window.__game; g.ui.closeAll(); g.ui.open(p, d); }, [p, d]);
    await wait(900);
    await shot(`${OUT}/panel_${p}.png`);
  }
  // shop (opens inventory alongside)
  await page.evaluate(() => { const g = window.__game; g.ui.closeAll(); g.ui.open('shop', { npc: 'npc.hesk' }); });
  await wait(700); await shot(`${OUT}/panel_shop.png`);
  // dialogue
  await page.evaluate(() => { const g = window.__game, s = g.session; g.ui.closeAll(); const o = s.interactables.find((x) => x.id === 'npc.orrel'); s.player.x = o.x; s.player.z = o.z + 1.5; s.interact(o); });
  await wait(1500); await shot(`${OUT}/panel_dialogue.png`);
  await page.evaluate(() => window.__game.ui.closeAll());
  await wait(300);
  if (logs.length) console.log('LOGS', logs.slice(0, 10).join('\n'));
}

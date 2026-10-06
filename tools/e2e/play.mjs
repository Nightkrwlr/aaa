// Scripted playthrough through the REAL input path (keyboard + mouse) in headless Chromium.
// usage: node tools/shot.mjs out.png --script tools/e2e/play.mjs --query "e2e=1&autostart=belfry&seed=play" --wait 3000
const OUT = process.env.SHOT_DIR ?? 'artifacts/shots';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); };

export default async function ({ page, wait: wallWait, shot, logs }) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // frame-based waiting: the sim runs a fixed 1/30 s per frame (?fixed=1), so slow software GL cannot change outcomes
  const wait = async (ms) => { const n = Math.max(1, Math.ceil(ms / 33)); const f0 = await ev(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 120000, polling: 50 }); };
  const screenOf = (sel) => ev((sel) => { const g = window.__game; const e = g.world.entities.find((x) => x.team === 'enemy' && !x.dead && !x.hidden && (sel === 'any' || x.id === sel)); if (!e) return null; const p = g.scene3d.project(e.x, e.y + 0.8, e.z); return { x: p.x, y: p.y, uid: e.uid, d: Math.hypot(e.x - g.player.x, e.z - g.player.z), id: e.id }; }, sel);

  // 1. tutorial cylinder via the interact key
  await ev(() => { const g = window.__game, s = g.session, c = s.interactables.find((o) => o.id === 'poi.voice_cylinder_1'); s.player.x = c.x - 1; s.player.z = c.z; g.rig.initialised = false; });
  await wait(600);
  const prompt = await ev(() => document.querySelector('.prompt')?.textContent);
  check('prompt appears next to the cylinder', /Escuchar|cilindro/i.test(prompt ?? ''), prompt);
  await page.keyboard.press('KeyE'); await wait(500);
  check('E opens the lore panel and discovers the codex entry', await ev(() => window.__game.ui.isOpen('lore') && window.__game.session.state.discovered.has('cdx.cylinder_awakening')));
  await page.keyboard.press('Escape'); await wait(300);
  check('Escape closes the panel', await ev(() => !window.__game.ui.isOpen('lore')));
  check('quest advanced to the path stage', await ev(() => window.__game.session.state.quests['qst.first_echo'].stage === 'path'));

  // 2. movement with WASD (camera-relative) on open ground
  await ev(() => { const g = window.__game; g.player.x = -30; g.player.z = 20; g.rig.initialised = false; }); await wait(600);
  const before = await ev(() => ({ x: window.__game.player.x, z: window.__game.player.z }));
  await page.keyboard.down('KeyW'); await wait(1200); await page.keyboard.up('KeyW');
  const after = await ev(() => ({ x: window.__game.player.x, z: window.__game.player.z }));
  check('WASD moves the player', Math.hypot(after.x - before.x, after.z - before.z) > 1.5, `${Math.hypot(after.x - before.x, after.z - before.z).toFixed(1)} m`);

  // 3. click-to-move
  const sc = await ev(() => { const g = window.__game, p = g.player; const s = g.scene3d.project(p.x + 6, g.zone.heightAt(p.x + 6, p.z), p.z); return { x: s.x, y: s.y, tx: p.x + 6, tz: p.z }; });
  const p0 = await ev(() => ({ x: window.__game.player.x, z: window.__game.player.z }));
  await page.mouse.move(sc.x, sc.y); await wait(200); await page.mouse.click(sc.x, sc.y); await wait(1800);
  const p1 = await ev(() => ({ x: window.__game.player.x, z: window.__game.player.z }));
  check('click-to-move walks towards the clicked ground', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 2, `${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);

  // 4. combat: go to the first pack, fight with real clicks + skills, survive
  await ev(() => { const g = window.__game, s = g.session; s.player.x = -38; s.player.z = 30; g.rig.initialised = false; s.player.stats.add('test', [{ stat: 'life', op: 'flat', value: 400 }]); g.world.refreshLife(g.player, true); });
  await wait(800);
  const killsBefore = await ev(() => window.__game.session.state.stats.kills);
  const t0 = Date.now(); let fought = 0; const fStart = await ev(() => window.__game.frames);
  while ((await ev(() => window.__game.frames)) - fStart < 2400) {
    const e = await screenOf('any');
    if (!e) break;
    if (e.d > 10) { await ev((uid) => { const g = window.__game, en = g.world.get(uid); g.player.cmd.moveTo = { x: en.x, z: en.z }; }, e.uid); await wait(500); continue; }
    await page.mouse.move(e.x, e.y); await page.mouse.click(e.x, e.y); fought++;
    await page.keyboard.press('Digit1'); await wait(350);
    if (fought % 6 === 0) { await page.keyboard.press('Space'); }
    if ((await ev(() => window.__game.session.state.stats.kills)) - killsBefore >= 3) break;
  }
  const kills = (await ev(() => window.__game.session.state.stats.kills)) - killsBefore;
  check('real input kills enemies', kills >= 1, `${kills} kills`);
  await shot(`${OUT}/play_combat.png`);
  const xp = await ev(() => window.__game.character.xp + window.__game.character.level * 1000);
  check('kills grant XP', xp > 1000, String(xp));
  const ground = await ev(() => window.__game.session.loot.ground.length);
  const wealth = await ev(() => window.__game.character.inv.chimes + window.__game.character.inv.used);
  check('kills yield loot (ground piles or auto-collected chimes)', ground > 0 || wealth > 0, `${ground} piles, wealth ${wealth}`);

  // 5. pick up loot by walking over it / pressing E
  await ev(() => { const g = window.__game, s = g.session, l = s.loot.ground.find((x) => x.kind === 'item') ?? s.loot.ground[0]; if (l) { s.player.x = l.x; s.player.z = l.z + 1; } });
  await wait(500); await page.keyboard.press('KeyE'); await wait(1200);
  check('inventory gained something', await ev(() => window.__game.character.inv.used > 0 || window.__game.character.inv.chimes > 0));

  // 6. inventory panel via keyboard
  await page.keyboard.press('KeyI'); await wait(500);
  check('I opens inventory', await ev(() => window.__game.ui.isOpen('inventory')));
  await shot(`${OUT}/play_inventory.png`);
  await page.keyboard.press('Escape'); await wait(300);

  // 7. talk to Orrel through the dialogue panel
  await ev(() => { const g = window.__game, s = g.session, o = s.interactables.find((x) => x.id === 'npc.orrel'); s.player.x = o.x + 1; s.player.z = o.z + 1.2; s.state.visitedAreas.add('area.orrel'); g.rig.initialised = false; });
  await wait(700); await page.keyboard.press('KeyE'); await wait(900);
  check('dialogue opens with E', await ev(() => window.__game.ui.isOpen('dialogue')));
  await page.keyboard.press('Space'); await wait(600); await page.keyboard.press('Space'); await wait(600);
  await page.keyboard.press('Digit4'); await wait(900);
  await shot(`${OUT}/play_dialogue.png`);
  await page.keyboard.press('Escape'); await wait(300);
  check('talking advanced the story', await ev(() => ['meet', 'quarry'].includes(window.__game.session.state.quests['qst.first_echo'].stage)));

  // 7b. audio engine is alive and produces signal after a skill press
  await page.keyboard.press('Digit1'); await wait(250);
  const aud = await ev(async () => { const a = window.__game.audio; a.resume(); await new Promise((r) => setTimeout(r, 400)); window.__game.audio.sfx('bell'); await new Promise((r) => setTimeout(r, 300)); return { state: a.ctx?.state ?? 'none', rms: a.level() }; });
  check('procedural audio runs (AudioContext running, non-zero output)', aud.state === 'running' && aud.rms > 0.0005, JSON.stringify(aud));

  // 7c. dungeon portal through the interact key, then back
  await ev(() => { const g = window.__game, s = g.session, o = s.interactables.find((x) => x.id === 'poi.dungeon_crypt'); s.player.x = o.x; s.player.z = o.z; g.rig.initialised = false; s.player.stats.add('test2', [{ stat: 'life', op: 'flat', value: 300 }]); });
  await wait(600); await page.keyboard.press('KeyE'); await wait(5000);
  check('portal enters the crypt (dungeon mode)', await ev(() => window.__game.session.mode === 'dungeon'));
  await shot(`${OUT}/play_crypt.png`);
  await ev(() => window.__game.session.dungeon.leave(false)); await wait(4500);
  check('leaving returns to the overworld at the portal', await ev(() => window.__game.session.mode === 'overworld'));

  // 8. pause menu + manual save + reload
  await page.keyboard.press('Escape'); await wait(500);
  check('Escape opens pause', await ev(() => window.__game.ui.isOpen('pause')));
  await ev(() => { const g = window.__game; g.saves.save('slot1', g.session); });
  check('manual save works', await ev(() => !!window.__game.saves.list(['slot1'])[0].meta));
  await page.keyboard.press('Escape'); await wait(300);
  const rl = await ev(() => { const g = window.__game; const lvl = g.character.level; const r = g.continueGame('slot1'); return { ok: r.ok, lvl, now: g.character.level, quest: g.session.state.quests['qst.first_echo']?.stage }; });
  check('continue loads the save into a running session', rl.ok && rl.now === rl.lvl, JSON.stringify(rl));
  await wait(1500);
  check('loaded game keeps running (no frame errors)', logs.filter((l) => /pageerror|frame failed/.test(l)).length === 0, logs.slice(0, 3).join(' | '));
  await shot(`${OUT}/play_loaded.png`);

  const failed = results.filter((x) => !x).length;
  console.log(failed ? `E2E FAILED: ${failed}` : `E2E OK: ${results.length} checks`);
  if (failed) process.exitCode = 1;
}

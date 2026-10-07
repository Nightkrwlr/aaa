// Animation QA: captures filmstrips of the PLAYER's animation states (idle, run, attack, skill, dodge, hit, death) from the real game camera.
// The game clock is frozen between captures (fixedDt = 0) and advanced by exact frame counts, so every strip is deterministic.
//
//   node tools/shot.mjs out.png --script tools/e2e/chars-anim.mjs --wait 600 --query "e2e=1&autostart=belfry&seed=anim&fixed=1&quality=high"
//   env: SEQ=idle,run,attack,skill,dodge,hit,death  FRAMES=8  TAG=belfry  SHOT_DIR=artifacts/shots  ZOOM=15
const OUT = process.env.SHOT_DIR ?? 'artifacts/shots';
const TAG = process.env.TAG ?? 'anim';

export default async function ({ page }) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(() => window.__game.assetsReady);
  const zoom = Number(process.env.ZOOM ?? 15);
  const seqs = (process.env.SEQ ?? 'idle,run,attack,skill,dodge,hit,death').split(',');
  const N = Number(process.env.FRAMES ?? 8);
  await ev(() => { document.getElementById('ui').style.visibility = 'hidden'; document.getElementById('overlay').style.visibility = 'hidden'; });
  const advance = (k) => ev((k) => new Promise((res) => { const g = window.__game, f0 = g.frames; g.fixedDt = 1 / 30; const tick = () => { if (g.frames >= f0 + k) { g.fixedDt = 0; res(); } else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }), k);
  const vp = page.viewportSize(); const cw = Math.round(vp.height * 0.52), ch = Math.round(vp.height * 0.58);
  const clip = { x: Math.round(vp.width / 2 - cw / 2), y: Math.round(vp.height * 0.46 - ch / 2), width: cw, height: ch };
  const grab = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return (await page.screenshot({ clip, timeout: 20000 })).toString('base64'); } catch (e) { console.log('screenshot retry', attempt, String(e.message).split('\n')[0]); await advance(1); }
    }
    throw new Error('screenshot failed');
  };

  // stage: flat clearing, player facing screen-down-right, a dummy 2.8 m in front, an enemy "source" for the hit sequence
  const cls = await ev(() => {
    const g = window.__game, w = g.world, p = g.player;
    w.ai.update = () => {};
    for (const e of w.entities) if (e.team === 'enemy') e.removed = true;
    p.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 99999 }]); w.refreshLife(p, true);
    let best = null; const z = g.zone;
    for (let r = 0; r < 50; r++) { const x = p.x + (Math.random() - 0.5) * 80, zz = p.z + (Math.random() - 0.5) * 80; if (!w.nav.isWalkable(x, zz)) continue; let lo = 1e9, hi = -1e9; for (let i = -8; i <= 8; i += 2) for (let j = -8; j <= 8; j += 2) { const h = z.heightAt(x + i, zz + j); lo = Math.min(lo, h); hi = Math.max(hi, h); } if (!best || hi - lo < best.v) best = { x, z: zz, v: hi - lo }; }
    p.x = best.x; p.z = best.z; p.yaw = Math.PI / 2; p.res.value = 100;
    const d = w.spawnEnemy('enm.test_dummy', p.x + 2.8, p.z, { level: 1 }); d.ai.cfg.aggroRange = 0; d.hp = d.hpMax = 1e9;
    g.rig.initialised = false; g.rig.setZoom(15);
    g.fixedDt = 0;
    return { cls: p.cls.id, dummy: d.uid };
  });
  await advance(30);
  await ev((zoom) => { window.__game.rig.setZoom(zoom); }, zoom);
  await advance(20);

  const strips = {};
  const frame = async (name, k) => { (strips[name] ??= []).push(await grab()); if (k > 0) await advance(k); };

  // Game.#feedCommands rewrites cmd.aim from the mouse every frame, so aim by moving the real pointer onto the dummy
  const aimAtDummy = async () => { const q = await ev(() => { const g = window.__game, d = g.world.entities.find((e) => e.id === 'enm.test_dummy'); return g.scene3d.project(d.x, d.y + 0.6, d.z); }); await page.mouse.move(q.x, q.y); await advance(2); };
  const cast = async (slot) => { await aimAtDummy(); await ev((slot) => { const g = window.__game; g.world.controller.castSlot(g.player, slot); }, slot); };
  const stop = () => ev(() => { const p = window.__game.player; p.cmd.moveDir = null; p.cmd.moveTo = null; p.cmd.attackTarget = null; p.cmd.holdPrimary = false; p.cmd.channel = false; });

  for (const s of seqs) {
    console.log('sequence', s);
    if (s === 'idle') { for (let i = 0; i < Math.min(N, 5); i++) await frame('idle', 7); }
    if (s === 'run') {
      await ev(() => { const p = window.__game.player; p.cmd.moveTo = { x: p.x + 24, z: p.z - 16 }; });
      await advance(14);
      for (let i = 0; i < N; i++) await frame('run', 2);
      await stop(); await advance(18);
    }
    if (s === 'attack') {
      await advance(4);
      await cast('primary'); await advance(1);
      for (let i = 0; i < N; i++) await frame('attack', 1);
      await advance(25);
    }
    if (s === 'skill') {
      await ev(() => { const p = window.__game.player; p.res.value = 100; }); await cast('s1'); await advance(1);
      for (let i = 0; i < N; i++) await frame('skill', 3);
      await advance(30);
    }
    if (s === 'dodge') {
      await ev(() => { const p = window.__game.player; p.cmd.moveTo = { x: p.x + 24, z: p.z - 16 }; }); await advance(3);
      await cast('dodge'); await advance(1);
      for (let i = 0; i < N; i++) await frame('dodge', 1);
      await stop(); await advance(25);
    }
    if (s === 'hit') {
      await advance(10);
      await ev(() => { const g = window.__game, w = g.world, p = g.player; const d = w.entities.find((e) => e.id === 'enm.test_dummy'); w.dealDirect(d, p, 5, 'physical', {}); });
      for (let i = 0; i < N; i++) await frame('hit', 2);
      await advance(20);
    }
    if (s === 'death') {
      await ev(() => { const g = window.__game, w = g.world, p = g.player; w.kill(p, null); });
      for (let i = 0; i < N; i++) await frame('death', 5);
      await ev(() => { const g = window.__game; g.ui.closeAll?.(); g.session.respawn(); g.fixedDt = 0; }); await advance(10);
    }
  }

  // compose: one labelled row per sequence
  const rows = Object.entries(strips).map(([name, imgs]) => `<div class="r"><div class="n">${name}</div>${imgs.map((b) => `<img src="data:image/png;base64,${b}">`).join('')}</div>`).join('');
  const html = `<html><body style="margin:0;background:#1b1f27;font:12px monospace;color:#9fe8ff"><style>.r{display:flex;align-items:center;border-bottom:2px solid #000}.n{width:60px;padding:4px}img{width:190px;height:210px;object-fit:cover}</style>${rows}</body></html>`;
  const ctx2 = await page.context().browser().newContext({ viewport: { width: 60 + N * 190 + 10, height: 220 * Object.keys(strips).length + 10 } });
  const page2 = await ctx2.newPage();
  await page2.setContent(html);
  await page2.waitForTimeout(400);
  await page2.screenshot({ path: `${OUT}/${TAG}_${cls.cls.replace('cls.', '')}.png` });
  await page2.close(); await ctx2.close();
  console.log('strips:', Object.keys(strips).join(','), cls.cls);
}

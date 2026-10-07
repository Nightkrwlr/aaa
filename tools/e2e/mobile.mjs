// Phone/tablet end-to-end: real multi-touch (CDP) against the on-screen controls, menus, lifecycle and layout audits.
// usage: node tools/mobile-shot.mjs [--device pixel7|iphone14|se|tablet|small] [--portrait]
const OUT = process.env.SHOT_DIR ?? 'artifacts/shots';
const results = [];
const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); };

export default async function ({ page, touch, wait, shot, logs, device, size }) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const tag = `${device}_${size.width > size.height ? 'land' : 'port'}`;
  const rect = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }, sel);
  const pos = () => ev(() => ({ x: window.__game.player.x, z: window.__game.player.z }));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const waitForControls = async () => { for (let i = 0; i < 60; i++) { if (await ev(() => !!window.__game.session && !document.getElementById('tc').classList.contains('hidden'))) return true; await page.waitForTimeout(250); } return false; };

  // ── 1. device mode + controls
  const cls = await ev(() => [...document.documentElement.classList]);
  check('touch mode detected (html.touch)', cls.includes('touch'), cls.join(' '));
  check('phone/tablet class', cls.includes('phone') || cls.includes('tablet'), cls.join(' '));
  check('orientation class matches', cls.includes(size.width > size.height ? 'landscape' : 'portrait'));
  check('touch controls visible while playing', await waitForControls());
  check('desktop HUD bottom bar hidden on touch', await ev(() => getComputedStyle(document.querySelector('.hud-bottom')).display === 'none'));
  await wait(600); await shot(`${OUT}/mobile_${tag}_idle.png`);

  // ── 2. layout audit: every control tappable, on screen, not overlapping
  const audit = await ev(() => {
    const vw = innerWidth, vh = innerHeight, out = { small: [], off: [], overlap: [], count: 0 };
    const els = [...document.querySelectorAll('#tc .tc-btn, #tc .tc-menu, #tc .tc-interact:not(.hidden)')];
    const rs = els.map((e) => { const r = e.getBoundingClientRect(); return { n: e.dataset.id ?? e.className, x: r.x, y: r.y, w: r.width, h: r.height }; });
    out.count = rs.length;
    for (const r of rs) { if (Math.min(r.w, r.h) < 40) out.small.push(`${r.n} ${Math.round(r.w)}x${Math.round(r.h)}`); if (r.x < -1 || r.y < -1 || r.x + r.w > vw + 1 || r.y + r.h > vh + 1) out.off.push(r.n); }
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; const round = (r) => /tc-menu|tc-interact/.test(String(r.n)) ? null : r.w / 2; const ra = round(a), rb = round(b); if (ra && rb) { if (Math.hypot((a.x + ra) - (b.x + rb), (a.y + ra) - (b.y + rb)) < ra + rb - 1) out.overlap.push(`${a.n}×${b.n}`); } else if (a.x < b.x + b.w - 3 && b.x < a.x + a.w - 3 && a.y < b.y + b.h - 3 && b.y < a.y + a.h - 3) out.overlap.push(`${a.n}×${b.n}`); }
    return out;
  });
  check(`controls: ${audit.count} buttons, none smaller than 40 css px`, audit.small.length === 0, audit.small.join(', '));
  check('controls: none outside the screen', audit.off.length === 0, audit.off.join(', '));
  check('controls: none overlap', audit.overlap.length === 0, audit.overlap.join(', '));

  // ── 3. virtual stick moves the hero
  const zone = await rect('.tc-zone');
  const sx = zone.x + zone.w * 0.35, sy = zone.y + zone.h * 0.6;
  const p0 = await pos();
  await touch.down(1, sx, sy); await touch.move(1, sx + 30, sy - 20); await wait(100);
  const stickShown = await ev(() => !document.querySelector('.tc-stick').classList.contains('hidden'));
  await touch.move(1, sx + 70, sy - 45); await wait(900);
  const p1 = await pos(); const stickVec = await ev(() => ({ id: window.__game.input.touch.stickId, dx: window.__game.input.touch.dx, dz: window.__game.input.touch.dz }));
  await shot(`${OUT}/mobile_${tag}_stick.png`);
  await touch.up(1); await wait(200);
  check('stick appears under the thumb', stickShown);
  check('stick drives input (analog vector, deadzone)', stickVec.id === 'tc' && Math.hypot(stickVec.dx, stickVec.dz) > 0.5, JSON.stringify(stickVec));
  check('stick moves the hero', dist(p0, p1) > 2, `${dist(p0, p1).toFixed(1)} m`);
  check('stick releases cleanly', await ev(() => window.__game.input.touch.stickId === null && window.__game.player.cmd.moveDir === null));

  // ── 4. attack button: hold = auto-attack the nearest enemy
  await ev(() => { const g = window.__game, s = g.session, p = s.player; p.x = -38; p.z = 30; g.rig.initialised = false; p.stats.add('test', [{ stat: 'life', op: 'flat', value: 600 }]); g.world.refreshLife(p, true); });
  await wait(900);
  const atk = await rect('.tc-attack');
  const dmg0 = await ev(() => window.__game.world.metrics.damageDealt);
  await touch.down(2, atk.cx, atk.cy);
  await wait(1800);
  const holding = await ev(() => ({ prim: window.__game.input.virtual.primary, hold: window.__game.player.cmd.holdPrimary, enemies: window.__game.world.entities.filter((e) => e.team === 'enemy' && !e.dead).length }));
  await shot(`${OUT}/mobile_${tag}_combat.png`);
  await touch.up(2); await wait(200);
  const dmg1 = await ev(() => window.__game.world.metrics.damageDealt);
  check('attack button holds the primary attack', holding.prim && holding.hold, JSON.stringify(holding));
  check('holding attack deals damage (auto-aim at nearest enemy)', dmg1 > dmg0, `${Math.round(dmg1 - dmg0)} damage`);
  check('releasing attack stops the attack', await ev(() => window.__game.input.virtual.primary === false && window.__game.player.cmd.holdPrimary === false));

  // ── 5. skills: tap casts (auto-aim), drag aims, drag-back cancels
  const slots = await ev(() => Object.keys(window.__game.player.loadout).filter((k) => /^s\d$/.test(k)));
  check('skill buttons exist for the unlocked skills', slots.length >= 1 && (await ev((s) => s.every((k) => !!document.querySelector(`.tc-${k}`)), slots)), slots.join(','));
  const s1 = slots[0]; const b1 = await rect(`.tc-${s1}`);
  const cdOf = () => ev((k) => { const g = window.__game, p = g.player, id = p.loadout[k]; return g.world.abilities.cooldownLeft(p, id); }, s1);
  await ev((k) => { const p = window.__game.player; p.cd = {}; p.res && (p.res.value = 100); }, s1);
  await touch.tap(b1.cx, b1.cy); await wait(500);
  check('tapping a skill button casts it', (await cdOf()) > 0, `cooldown ${(await cdOf()).toFixed(1)}s`);
  await ev(() => { window.__game.player.cd = {}; });
  await touch.down(3, b1.cx, b1.cy); await touch.move(3, b1.cx - 40, b1.cy - 60); await touch.move(3, b1.cx - 70, b1.cy - 110); await wait(150);
  const aiming = await ev(() => ({ dir: window.__game.input.virtual.aimDir, ctl: !!window.__game.mobile.controls.aim }));
  await shot(`${OUT}/mobile_${tag}_aim.png`);
  check('dragging from a skill aims it (aim line shown)', !!aiming.dir && aiming.ctl, JSON.stringify(aiming));
  await touch.up(3); await wait(500);
  check('releasing the drag casts in the aimed direction', (await cdOf()) > 0);
  await ev(() => { window.__game.player.cd = {}; });
  await touch.down(4, b1.cx, b1.cy); await touch.move(4, b1.cx - 30, b1.cy - 90); await touch.move(4, b1.cx - 70, b1.cy - 130); await touch.move(4, b1.cx - 2, b1.cy - 1); await wait(100); await touch.up(4); await wait(500);
  check('dragging back onto the button cancels the cast', (await cdOf()) === 0, `cooldown ${(await cdOf()).toFixed(2)}s`);

  // dodge
  const dodge = await rect('.tc-dodge');
  if (dodge) { const d0 = await pos(); await touch.tap(dodge.cx, dodge.cy); await wait(500); const d1 = await pos(); check('dodge button dashes away', dist(d0, d1) > 1.2, `${dist(d0, d1).toFixed(1)} m`); }

  // ── 6. tap on an enemy attacks it; pinch zooms
  await ev(() => { const g = window.__game, w = g.world, p = g.player; for (const e of w.entities) if (e.team === 'enemy' && !e.dead) { e.x = p.x + 5; e.z = p.z + 1; break; } });
  await wait(300);
  const en = await ev(() => { const g = window.__game; const e = g.world.entities.find((x) => x.team === 'enemy' && !x.dead); const q = g.scene3d.project(e.x, e.y + 0.9, e.z); return { x: q.x, y: q.y, uid: e.uid }; });
  // by now a whole horde is around the hero, so the finger may land on a neighbour of the enemy we placed: any enemy targeted proves the tap works.
  // The order can also be consumed within the 500 ms (the enemy dies), so watch every frame instead of sampling once.
  await ev(() => { window.__seen = false; window.__watch = setInterval(() => { const g = window.__game, id = g.player.cmd.attackTarget, e = id != null ? g.world.entities.find((x) => x.uid === id) : null; if ((e && e.team === 'enemy') || g.hoverEnemy) window.__seen = true; }, 8); });
  await touch.tap(en.x, en.y); await wait(500);
  const tapped = await ev(() => { clearInterval(window.__watch); return { seen: window.__seen }; });
  check('tap on an enemy targets it', tapped.seen, JSON.stringify(tapped));
  const z0 = await ev(() => window.__game.rig.zoomTarget);
  const py = size.height * 0.2;
  await touch.down(5, size.width * 0.47, py); await touch.down(6, size.width * 0.53, py);
  await touch.move(5, size.width * 0.35, py); await touch.move(6, size.width * 0.65, py); await wait(150);
  await touch.up(5); await touch.up(6);
  const z1 = await ev(() => window.__game.rig.zoomTarget);
  check('pinch changes camera zoom', Math.abs(z1 - z0) > 0.5, `${z0.toFixed(1)} → ${z1.toFixed(1)}`);

  // ── 7. contextual interact button
  await ev(() => { const g = window.__game, s = g.session, c = s.interactables.find((o) => o.id === 'poi.voice_cylinder_1'); s.player.x = c.x - 1; s.player.z = c.z; g.rig.initialised = false; });
  await wait(700);
  const ib = await rect('.tc-interact:not(.hidden)');
  check('interact button appears near an interactable', !!ib && ib.h >= 44, ib ? `${Math.round(ib.w)}x${Math.round(ib.h)}` : 'missing');
  await shot(`${OUT}/mobile_${tag}_interact.png`);
  if (ib) { await touch.tap(ib.cx, ib.cy); await wait(500); }
  check('tapping interact opens the lore panel', await ev(() => window.__game.ui.isOpen('lore')));
  await shot(`${OUT}/mobile_${tag}_lore.png`);
  await ev(() => window.__game.ui.closeAll()); await wait(300);

  // ── 8. menu + panels fit the screen
  const menu = await rect('.tc-menu');
  await touch.tap(menu.cx, menu.cy); await wait(400);
  check('menu button opens the mobile menu', await ev(() => window.__game.ui.isOpen('mmenu')));
  await shot(`${OUT}/mobile_${tag}_menu.png`);
  const panels = [['inventory', 'inventory'], ['talents', 'talents'], ['quests', 'quests'], ['map', 'map'], ['codex', 'codex'], ['settings', 'settings']];
  for (const [key, id] of panels) {
    await ev(() => window.__game.ui.closeAll()); await wait(100);
    await ev(() => window.__game.ui.open('mmenu')); await wait(150);
    const tile = await ev((i) => { const tiles = [...document.querySelectorAll('.mm-tile')]; const idx = ['inventory', 'skills', 'talents', 'quests', 'map', 'codex', 'craft', 'settings'].indexOf(i); const r = tiles[idx]?.getBoundingClientRect(); return r ? { cx: r.x + r.width / 2, cy: r.y + r.height / 2 } : null; }, key);
    if (tile) await touch.tap(tile.cx, tile.cy);
    await wait(500);
    const open = await ev((i) => window.__game.ui.isOpen(i), id);
    const fit = await ev((i) => { const e = document.querySelector(`.p-${i}`); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, vw: innerWidth, vh: innerHeight, sw: e.scrollWidth, cw: e.clientWidth }; }, id);
    check(`${id} panel opens from the menu and fits the screen`, open && fit && fit.l >= -1 && fit.t >= -1 && fit.r <= fit.vw + 1 && fit.b <= fit.vh + 1 && fit.sw <= fit.cw + 2, JSON.stringify(fit));
    if (key === 'inventory' || key === 'talents' || key === 'settings') await shot(`${OUT}/mobile_${tag}_${id}.png`);
  }
  await ev(() => window.__game.ui.closeAll()); await wait(300);
  check('controls come back after closing panels', await waitForControls());

  // ── 9. lifecycle: background → autosave; foreground → pause; back button → pause
  await ev(() => { try { localStorage.removeItem('sdc.save.auto'); } catch {} Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1600);
  const saved = await ev(() => { try { return !!localStorage.getItem('sdc.save.auto'); } catch { return false; } });
  await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(300);
  check('going to background autosaves', saved);
  check('coming back from background opens the pause menu', await ev(() => window.__game.ui.isOpen('pause')));
  await ev(() => window.__game.ui.closeAll()); await wait(200);
  await ev(() => history.back()); await page.waitForTimeout(500);
  check('system back button opens pause instead of leaving', await ev(() => window.__game.ui.isOpen('pause')));
  await ev(() => window.__game.ui.closeAll()); await wait(200);

  // ── 10. GPU context loss is survived
  await ev(() => { const gl = document.getElementById('gl').getContext('webgl2') ?? document.getElementById('gl').getContext('webgl'); window.__lose = gl?.getExtension('WEBGL_lose_context'); window.__lose?.loseContext(); });
  await page.waitForTimeout(800);
  const lost = await ev(() => !!document.querySelector('.mob-resume'));
  await ev(() => window.__lose?.restoreContext()); await page.waitForTimeout(1200);
  const f0 = await ev(() => window.__game.frames); await page.waitForTimeout(1500); const f1 = await ev(() => window.__game.frames);
  check('context loss shows the recovery notice', lost);
  check('rendering resumes after context restore', f1 > f0 && !(await ev(() => !!document.querySelector('.mob-resume'))), `${f1 - f0} frames`);
  await ev(() => window.__game.ui.closeAll());

  const bad = logs.filter((l) => /pageerror|frame failed|\[touch\]|\[ERROR\]/.test(l));
  check('no page errors', bad.length === 0, bad.slice(0, 2).join(' | '));
  const failed = results.filter((x) => !x).length;
  console.log(failed ? `MOBILE E2E FAILED: ${failed}` : `MOBILE E2E OK: ${results.length} checks (${tag})`);
  return failed;
}

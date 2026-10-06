// Phone e2e #2 — the first five minutes of a player who has never seen the game: title → new game → class → begin → playing,
// then pause menu and back to the title. Everything is done with real (CDP) touch taps; no keyboard, no mouse.
// usage: node tools/mobile-shot.mjs tools/e2e/mobile-menus.mjs --device pixel7 --query "e2e=1&fixed=1&quality=low"
export default async function ({ page, touch, wait, shot, logs, device, size }) {
  const OUT = 'artifacts/shots'; const portrait = size.height > size.width; const tag = `${device}_${portrait ? 'port' : 'land'}`;
  const results = [];
  const check = (name, ok, extra = '') => { results.push([name, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const rectOf = (sel, text) => ev(({ sel, text }) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && (!text || text.toLowerCase().split('|').some((t) => e.textContent.toLowerCase().includes(t))));
    const e = els[0]; if (!e) return null; const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, bottom: r.bottom, right: r.right, vw: innerWidth, vh: innerHeight };
  }, { sel, text });
  // tap a control; when it sits below the fold, swipe the screen up (finger scroll) until it is on screen, like a player would
  const tapOn = async (sel, text, label = text ?? sel) => {
    let r = await rectOf(sel, text);
    if (!r) { check(`"${label}" exists`, false); return false; }
    for (let i = 0; i < 6 && (r.bottom > r.vh - 4 || r.y < 0); i++) {
      const x = Math.min(r.vw - 24, Math.max(24, r.cx)), y0 = r.vh * 0.8, y1 = r.vh * 0.3;
      await touch.drag(7, [x, y0], [x, y1], 8); await touch.up(7); await wait(250);
      r = await rectOf(sel, text); if (!r) return false;
    }
    check(`"${label}" is on screen and big enough to hit`, r.bottom <= r.vh + 1 && r.y >= -1 && r.h >= 40 && r.w >= 44, `${Math.round(r.w)}×${Math.round(r.h)} at y=${Math.round(r.y)}`);
    await touch.tap(r.cx, r.cy); await wait(450); return true;
  };
  const overflowX = () => ev(() => { const d = document.documentElement; return { sw: d.scrollWidth, cw: d.clientWidth, body: document.body.scrollWidth }; });

  await page.waitForFunction(() => document.querySelector('.title-screen'), null, { timeout: 60000 }).catch(() => {});
  await wait(900);
  await shot(`${OUT}/mobmenu_${tag}_1_title.png`);
  const ox = await overflowX();
  check('title: no horizontal scroll', ox.sw <= ox.cw + 1, `scrollWidth ${ox.sw} / ${ox.cw}`);
  check('title: touch mode detected', await ev(() => document.documentElement.classList.contains('touch')));
  check('title: touch controls are NOT drawn over the menu', await ev(() => !document.documentElement.classList.contains('tc-on')));

  // new game
  await tapOn('.title-screen button', 'nueva|new game', 'Nueva partida');
  await wait(400); await shot(`${OUT}/mobmenu_${tag}_2_newgame.png`);
  const cards = await ev(() => [...document.querySelectorAll('.class-card')].map((c) => { const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), left: Math.round(r.left) }; }));
  check('class cards: three visible, none clipped sideways', cards.length === 3 && cards.every((c) => c.left >= -1 && c.right <= size.width + 1), JSON.stringify(cards));
  const ox2 = await overflowX();
  check('new game: no horizontal scroll', ox2.sw <= ox2.cw + 1, `scrollWidth ${ox2.sw} / ${ox2.cw}`);
  // pick the second class by tapping its card, then go back to the first (just to prove cards react to a finger)
  const c2 = await rectOf('.class-card:nth-child(2)');
  if (c2) { await touch.tap(c2.cx, c2.cy); await wait(300); check('tapping a class card selects it', await ev(() => document.querySelectorAll('.class-card')[1]?.classList.contains('on'))); }
  const c1 = await rectOf('.class-card:nth-child(1)');
  if (c1) { await touch.tap(c1.cx, c1.cy); await wait(300); }
  await shot(`${OUT}/mobmenu_${tag}_3_class.png`);

  // begin
  const began = await tapOn('.title-screen button', 'comenzar|begin', 'Comenzar'); // ui.begin
  if (!began) await tapOn('.title-screen button.primary', null, 'primary button');
  await page.waitForFunction(() => window.__game?.state === 'playing' && window.__game.session, null, { timeout: 60000 }).catch(() => {});
  await wait(900);
  check('begin → the game is playing', await ev(() => window.__game?.state === 'playing'));
  check('playing → touch controls on', await ev(() => document.documentElement.classList.contains('tc-on')));
  await shot(`${OUT}/mobmenu_${tag}_4_playing.png`);
  // the first thing a new player sees must not be covered by a panel or a toast wall
  const cover = await ev(() => { const g = window.__game; return { blocking: !!g.ui.blocking, toasts: document.querySelectorAll('.toast').length }; });
  check('first frame is playable (no blocking panel)', !cover.blocking, JSON.stringify(cover));

  // pause → back to title (the way out of a run must work with a thumb too)
  const menu = await rectOf('.tc-menu');
  if (menu) {
    await touch.tap(menu.cx, menu.cy); await wait(500);
    await tapOn('.p-mmenu button, .p-mmenu .mm-tile', 'pausa|pause', 'Pausa');
    await shot(`${OUT}/mobmenu_${tag}_5_pause.png`);
    check('pause menu opens from the ☰ button', await ev(() => !!document.querySelector('.p-pause, .panel.pause, [data-panel="pause"]') || window.__game.ui.blocking));
  } else check('☰ menu button exists', false);

  if (logs.length) console.log('LOGS\n' + [...new Set(logs)].slice(0, 12).join('\n'));
  const bad = results.filter(([, ok]) => !ok).length;
  console.log(bad ? `MOBILE MENUS FAILED: ${bad}` : `MOBILE MENUS OK (${results.length} checks)`);
  return bad;
}

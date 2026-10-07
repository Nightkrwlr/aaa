// Phone e2e #4 — canvases inside panels (talent tree, map) were written for a mouse. A finger must pan, pinch-zoom, tap and long-press them.
// Checked two ways: (1) a synthetic panel canvas records exactly which mouse/wheel events the bridge produces; (2) the real talent tree reacts.
// usage: node tools/mobile-shot.mjs tools/e2e/mobile-canvas.mjs --device pixel7 --dpr 1
export default async function ({ page, touch, wait, shot, logs, device, size }) {
  const OUT = 'artifacts/shots'; const tag = `${device}_${size.height > size.width ? 'port' : 'land'}`;
  const results = [];
  const check = (name, ok, extra = '') => { results.push([name, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── 1. synthetic panels: one plain, one that asks for tap-to-confirm (class p-talents)
  await ev(() => {
    window.__ev = [];
    for (const [cls, left] of [['p-plain', 10], ['p-talents', 330]]) {
      const panel = document.createElement('div'); panel.className = `panel ${cls}`;
      // `html.phone .panel` makes real panels full-screen: pin the test panels to their own box so they do not stack
      panel.style.cssText = `position:fixed !important;inset:auto !important;left:${left}px !important;top:60px !important;width:300px !important;height:200px !important;z-index:900;background:#223;`;
      const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.style.cssText = 'width:300px;height:200px;display:block';
      panel.append(c); document.body.append(panel);
      for (const t of ['mousedown', 'mousemove', 'mouseup', 'wheel', 'contextmenu', 'click']) (t === 'mouseup' ? window : c).addEventListener(t, (e) => window.__ev.push({ cls, t, x: Math.round(e.clientX), y: Math.round(e.clientY), b: e.button, dy: e.deltaY ?? 0 }));
    }
  });
  await wait(300);
  const take = () => ev(() => window.__ev.splice(0));
  const types = (evs, cls, keepClick = false) => evs.filter((e) => e.cls === cls && (keepClick || e.t !== 'click')).map((e) => e.t);
  await take();

  // one-finger drag: mousedown at the START point, then moves, then a mouseup parked outside (never a click)
  await touch.drag(21, [60, 150], [160, 180], 8); await touch.up(21); await wait(200);
  let ev1 = await take(), t1 = types(ev1, 'p-plain');
  check('drag: mousedown first, then mousemoves, then mouseup', t1[0] === 'mousedown' && t1.filter((t) => t === 'mousemove').length >= 3 && t1.at(-1) === 'mouseup', t1.join(','));
  const md = ev1.find((e) => e.cls === 'p-plain' && e.t === 'mousedown'), up = ev1.find((e) => e.cls === 'p-plain' && e.t === 'mouseup');
  check('drag: the mousedown is where the finger landed', md && Math.abs(md.x - 60) < 3 && Math.abs(md.y - 150) < 3, JSON.stringify(md));
  check('drag: the final mouseup is parked off-canvas (cannot click anything)', up && (up.x < 0 || up.y < 0), JSON.stringify(up));

  // quick tap on a plain canvas = click immediately
  await touch.tap(100, 120); await wait(250);
  t1 = types(await take(), 'p-plain');
  check('tap on a plain canvas: hover then mousedown+mouseup', t1.join(',') === 'mousemove,mousedown,mouseup', t1.join(','));

  // tap on a confirm canvas: first tap inspects (hover only), second tap on the same spot confirms
  await touch.tap(430, 120); await wait(250);
  let t2 = types(await take(), 'p-talents', true);
  check('confirm canvas: first tap only hovers (no mouse click, native click swallowed)', t2.join(',') === 'mousemove', t2.join(','));
  await touch.tap(432, 121, 90, 0.7); await wait(250);                       // 0.7 s later on the event clock, 2 px away
  t2 = types(await take(), 'p-talents');
  check('confirm canvas: second tap on the same spot clicks', t2.join(',') === 'mousemove,mousedown,mouseup', t2.join(','));
  await touch.tap(430, 120); await wait(200); await touch.tap(600, 220); await wait(250); t2 = types(await take(), 'p-talents');
  check('confirm canvas: a second tap somewhere else only inspects again', !t2.includes('mousedown'), t2.join(','));

  // long press = secondary click (button 2) + contextmenu
  await touch.down(22, 100, 120); await sleep(800); await touch.up(22); await wait(250);
  ev1 = await take(); t1 = types(ev1, 'p-plain');
  check('long press: right mousedown/mouseup + contextmenu', t1.includes('contextmenu') && ev1.some((e) => e.cls === 'p-plain' && e.t === 'mousedown' && e.b === 2), t1.join(','));

  // pinch: fingers apart = wheel up (zoom in), together = wheel down
  await touch.down(23, 120, 130); await touch.down(24, 180, 130);
  for (let i = 1; i <= 8; i++) { await touch.move(23, 120 - i * 7, 130); await touch.move(24, 180 + i * 7, 130); }
  await wait(150); await touch.up(23); await touch.up(24); await wait(250);
  ev1 = await take(); const wheelsOut = ev1.filter((e) => e.cls === 'p-plain' && e.t === 'wheel');
  check('pinch out zooms in (wheel deltaY < 0)', wheelsOut.length >= 3 && wheelsOut.every((w) => w.dy < 0), `${wheelsOut.length} notches`);
  check('pinch ends without a click', ev1.filter((e) => e.t === 'mouseup').every((e) => e.x < 0 || e.y < 0));
  await touch.down(25, 60, 130); await touch.down(26, 240, 130);
  for (let i = 1; i <= 8; i++) { await touch.move(25, 60 + i * 9, 130); await touch.move(26, 240 - i * 9, 130); }
  await wait(150); await touch.up(25); await touch.up(26); await wait(250);
  const wheelsIn = (await take()).filter((e) => e.cls === 'p-plain' && e.t === 'wheel');
  check('pinch in zooms out (wheel deltaY > 0)', wheelsIn.length >= 3 && wheelsIn.every((w) => w.dy > 0), `${wheelsIn.length} notches`);
  await ev(() => document.querySelectorAll('.panel.p-plain, .panel.p-talents').forEach((e) => e.remove()));

  // ── 2. the real talent tree: drag pans it, pinch zooms it, tap-tap does not crash
  await ev(() => window.__game.ui.open('talents')); await wait(700);
  const cv = await ev(() => { const c = document.querySelector('.p-talents canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  check('talent tree canvas is there', !!cv);
  if (cv) {
    const hash = () => ev(() => { const c = document.querySelector('.p-talents canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
    await wait(300); const h0 = await hash();
    await touch.drag(31, [cv.x + cv.w * 0.5, cv.y + cv.h * 0.5], [cv.x + cv.w * 0.25, cv.y + cv.h * 0.3], 10); await touch.up(31); await wait(500);
    const h1 = await hash(); check('dragging the real tree pans it (picture changed)', h1 !== h0);
    await shot(`${OUT}/mobcanvas_${tag}_1_panned.png`);
    const cx = cv.x + cv.w / 2, cy = cv.y + cv.h / 2;
    await touch.down(32, cx - 30, cy); await touch.down(33, cx + 30, cy);
    for (let i = 1; i <= 9; i++) { await touch.move(32, cx - 30 - i * 9, cy); await touch.move(33, cx + 30 + i * 9, cy); }
    await wait(300); await touch.up(32); await touch.up(33); await wait(500);
    const h2 = await hash(); check('pinching the real tree zooms it (picture changed)', h2 !== h1);
    await shot(`${OUT}/mobcanvas_${tag}_2_zoomed.png`);
    check('page did not scroll or zoom meanwhile', await ev(() => scrollY === 0 && scrollX === 0 && (visualViewport?.scale ?? 1) === 1));
  }
  if (logs.length) console.log('LOGS\n' + [...new Set(logs)].slice(0, 12).join('\n'));
  const bad = results.filter(([, ok]) => !ok).length;
  console.log(bad ? `MOBILE CANVAS FAILED: ${bad}` : `MOBILE CANVAS OK (${results.length} checks)`);
  return bad;
}

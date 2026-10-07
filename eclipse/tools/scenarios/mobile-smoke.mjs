// humo móvil: el menú, los controles táctiles aparecen, el joystick mueve al jugador, los botones responden
// uso: node tools/shot.mjs --device pixel7 --dpr 1 --scenario tools/scenarios/mobile-smoke.mjs   (añade --portrait para vertical)
export default async function (api) {
  const { boot, ev, wait, shot, touch, size, logs, page } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  if (!touch) throw new Error('este guion necesita --device pixel7|iphone14|se|tablet');
  await boot();
  const menu = await ev(() => { const b = [...document.querySelectorAll('#menu button')].map((e) => ({ t: e.textContent.trim(), r: e.getBoundingClientRect().toJSON() })); return b; });
  check('el menú principal tiene botones táctiles de ≥ 40 px', menu.length >= 2 && menu.every((b) => b.r.height >= 40), JSON.stringify(menu.map((b) => `${b.t}:${Math.round(b.r.height)}`)));
  await shot('menu');
  const nb = menu.find((b) => /Nueva/i.test(b.t));
  await touch.tap(nb.r.x + nb.r.width / 2, nb.r.y + nb.r.height / 2); await wait(10);
  const go = await ev(() => { const e = document.querySelector('#mGo'); const r = e?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, bottom: r.bottom } : null; });
  check('"Desplegar" cabe en pantalla', go && go.bottom <= size.height, JSON.stringify(go));
  await shot('nueva-partida');
  if (go) await touch.tap(go.x, go.y); await wait(60);
  check('la partida empieza', await ev(() => window.__G.started));
  check('los controles táctiles son visibles', await ev(() => !document.getElementById('touch').hidden));
  const btns = await ev(() => [...document.querySelectorAll('#touch .tb, #tmenu button')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), right: Math.round(r.right), bottom: Math.round(r.bottom) }; }));
  check('hay botones de acción y de menú', btns.length >= 4, btns.map((b) => `${b.id}:${b.w}x${b.h}`).join(' '));
  check('ningún botón se sale de la pantalla', btns.every((b) => b.x >= 0 && b.y >= 0 && b.right <= size.width && b.bottom <= size.height), JSON.stringify(btns.filter((b) => b.right > size.width || b.bottom > size.height)));
  await ev(() => { window.__G.uiBlockDamage = true; });
  await wait(20); await shot('hud');
  const p0 = await ev(() => ({ x: window.__G.player.x, z: window.__G.player.z }));
  const cx = size.width * 0.2, cy = size.height * 0.7;
  await touch.drag(5, [cx, cy], [cx + 70, cy], 6); await wait(45); await shot('stick');
  await touch.up(5); await wait(5);
  const p1 = await ev(() => ({ x: window.__G.player.x, z: window.__G.player.z }));
  check('el joystick flotante mueve al jugador', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.5, `${p0.x.toFixed(1)},${p0.z.toFixed(1)} → ${p1.x.toFixed(1)},${p1.z.toFixed(1)}`);
  for (const b of btns.filter((q) => /^(tb|INV|MAPA)/i.test(q.id) || q.id.startsWith('tb')).slice(0, 3)) { await touch.tap(b.x + b.w / 2, b.y + b.h / 2); await wait(6); }
  const fps = await ev(() => window.__fps());
  console.log(`fps (software GL, orientativo): ${fps}`);
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok); console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

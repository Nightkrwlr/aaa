// humo: arranque, partida nueva, movimiento, combate contra una manada, paneles y guardado, sin errores de consola
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  const s0 = await ev(() => ({ hp: window.__G.player.hp, started: window.__G.started, mode: window.__G.mode, region: window.__G.regionId, enemies: window.__G.enemies.length }));
  check('la partida arranca', s0.started && s0.hp > 0, JSON.stringify(s0));
  const p0 = await ev(() => ({ x: window.__G.player.x, z: window.__G.player.z }));
  await page.keyboard.down('d'); await page.waitForTimeout(1200); await page.keyboard.up('d'); await wait(5);
  const p1 = await ev(() => ({ x: window.__G.player.x, z: window.__G.player.z }));
  check('WASD mueve al jugador', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.5, `${p0.x.toFixed(1)},${p0.z.toFixed(1)} → ${p1.x.toFixed(1)},${p1.z.toFixed(1)}`);
  // combate: una manada de rastreros junto al jugador y 20 s de simulación determinista
  const n = await ev(() => { const G = window.__G, p = G.player; let k = 0; for (let i = 0; i < 4; i++) { const a = i * 1.57; if (window.__spawn('rastrero', p.x + Math.cos(a) * 7, p.z + Math.sin(a) * 7, 2, { alerted: true })) k++; } return k; });
  check('se generan enemigos', n > 0, `${n}`);
  await ev(() => window.__step(600, 1 / 30));
  await wait(3);
  const s1 = await ev(() => ({ alive: window.__G.enemies.filter((e) => !e.dead).length, kills: window.__G.S.stats.kills, hp: window.__G.player.hp, dead: window.__G.player.dead }));
  check('el arma automática mata enemigos', s1.kills > 0, JSON.stringify(s1));
  await shot('combat');
  for (const [name, fn] of [['inventario', () => window.__dbg.openInventory('inv')], ['mapa', () => window.__dbg.openMap(false)], ['misiones', () => window.__dbg.openQuests('act')], ['pausa', () => window.__dbg.openPause('main')]]) {
    await ev(fn); await wait(8);
    const open = await ev(() => !!window.__G.uiOpen);
    check(`panel ${name} se abre`, open); await shot('panel-' + name);
    await page.keyboard.press('Escape'); await wait(5);
    const closed = await ev(() => !window.__G.uiOpen); check(`panel ${name} se cierra`, closed);
  }
  const fps = await ev(() => window.__fps());
  console.log(`fps (software GL, solo orientativo): ${fps}`);
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok); console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

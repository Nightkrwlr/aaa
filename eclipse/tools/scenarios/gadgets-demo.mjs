// frente GADGETS: comprobaciones funcionales + capturas de la UI nueva (botón táctil, HUD, pestaña del Taller, gadgets desplegados).
// uso:  node tools/shot.mjs --scenario tools/scenarios/gadgets-demo.mjs --out DIR [--device pixel7|iphone14|se] [--portrait] --dpr 1
// En escritorio entra por teclado (X, mantener X, Z); en móvil por toques reales (CDP): tocar, mantener y deslizar hacia arriba.
// SHOTS=0 desactiva las capturas; ROW=1 añade la toma de «todos los modelos en fila» (solo escritorio).
export default async function (api) {
  const { boot, newGame, ev, wait, shot, page, touch, device, god, region, hideUi, logs } = api;
  const mobile = device !== 'desktop';
  const SHOTS = process.env.SHOTS !== '0';
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await god(); await region('desierto'); // fuera del Bastión (la región 'valle' lo contiene y allí no se puede desplegar)
  const st = () => ev(() => { const G = window.__G, gd = window.__gadgets.state; return { inv: { ...G.S.gadgets.inv }, sel: G.S.gadgets.sel, known: Object.keys(G.S.gadgets.known), n: gd.list.length, kinds: gd.list.map((g) => g.id), states: gd.list.map((g) => g.st), hp: G.player.hp, tip: !!(G.S.seenTips && G.S.seenTips.gadgets) }; });
  const clean = () => ev(() => { const G = window.__G; for (const e of G.enemies) e.remove?.(); G.enemies.length = 0; G.projs.length = 0; window.__gadgets.clear(); G.player.reloadT[G.S.activeW] = 1e9; G.player.powers.clear(); G.player.droneT = 1e9; G.uiOpen = null; });
  const press = async (key) => { await page.keyboard.down(key); await wait(2); await page.keyboard.up(key); await wait(2); };
  const btn = () => ev(() => { const r = document.getElementById('tbGdg').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, shown: getComputedStyle(document.getElementById('tbGdg')).display !== 'none' }; });
  await clean();

  // 1. estado inicial: 2 minas conocidas y 3 cargas de proximidad
  let s = await st();
  check('arranca con 2 gadgets conocidos y 3 minas de proximidad', s.known.length === 2 && s.inv.proximity === 3 && s.sel === 'proximity', JSON.stringify(s.known) + ' ' + JSON.stringify(s.inv));
  if (mobile) { const b = await btn(); check('el botón GADGET existe y se ve', b.shown && b.w >= 44, `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}px`); }
  else check('la casilla del HUD de escritorio existe', await ev(() => !!document.getElementById('gdgChip')));

  // 2. desplegar: X / toque
  if (mobile) { const b = await btn(); await touch.tap(b.x, b.y); } else await press('x');
  await wait(3);
  s = await st();
  check('tocar/pulsar despliega una mina y gasta una carga', s.n === 1 && s.inv.proximity === 2, `${s.n} desplegadas · ${s.inv.proximity} cargas`);
  await ev(() => window.__step(40, 1 / 30));
  s = await st();
  check('la mina se arma (0,8 s)', s.states[0] === 'ready', s.states.join());

  // 3. una manada la cruza: explota, hiere a los enemigos, NO hiere al jugador (sin invulnerabilidad)
  const fight = await ev(() => {
    const G = window.__G, gd = window.__gadgets, p = G.player, g = gd.state.list[0];
    G.uiBlockDamage = false; p.hp = p.maxHp;
    const a = Math.atan2(g.x - p.x, g.z - p.z), pack = [];
    for (let i = 0; i < 6; i++) { const e = window.__spawn('rastrero', 3, g.x + Math.sin(a) * (6 + i * 0.5), g.z + Math.cos(a) * (6 + i * 0.5), { alerted: true }); if (e) pack.push(e); }
    const hp0 = pack.map((e) => e.hp); const php = p.hp;
    let trig = 0; for (let i = 0; i < 100 && !trig; i++) { window.__step(3, 1 / 30); trig = gd.state.stats.triggered; }
    window.__step(6, 1 / 30);
    const hurt = pack.filter((e, i) => e.dead || e.hp < hp0[i]).length;
    // el jugador está a 1,7 m de la mina: aún así no debe sufrir daño de ella
    const out = { trig, hurt, n: pack.length, listAfter: gd.state.list.length };
    G.uiBlockDamage = true; return out;
  });
  check('la mina estalla al pisarla y daña a la manada', fight.trig >= 1 && fight.hurt >= 2 && fight.listAfter === 0, JSON.stringify(fight));
  await clean();
  const selfHit = await ev(() => {
    const G = window.__G, p = G.player; for (const e of G.enemies) e.remove?.(); G.enemies.length = 0;
    G.uiBlockDamage = false;
    const run = (mine) => { p.hp = p.maxHp; if (mine) window.__gadgets.deploy('proximity', { force: true, x: p.x + 0.5, z: p.z }); window.__step(40, 1 / 30); const n = mine ? window.__gadgets.detonate() : 0; window.__step(30, 1 / 30); return [p.maxHp - p.hp, n]; };
    const [ctrl] = run(false), [loss, det] = run(true); // el desierto quema un poco: se compara con un control sin mina
    G.uiBlockDamage = true; return { ctrl: +ctrl.toFixed(2), loss: +loss.toFixed(2), det, enemies: G.enemies.length };
  });
  check('la explosión no daña al jugador (ni a 0,5 m)', selfHit.det === 1 && selfHit.loss <= selfHit.ctrl + 0.01 && selfHit.enemies === 0, JSON.stringify(selfHit));

  // 4. mantener = detonar a distancia
  await ev(() => { const gd = window.__gadgets, p = window.__G.player; window.__G.S.gadgets.inv.proximity = 3; gd.deploy('proximity', { force: true, x: p.x + 6, z: p.z }); gd.deploy('proximity', { force: true, x: p.x + 8, z: p.z + 2 }); window.__step(40, 1 / 30); });
  if (mobile) { const b = await btn(); await touch.down(11, b.x, b.y); await page.waitForFunction(() => window.__gadgets.state.hold.fired, null, { timeout: 30000 }); await touch.up(11); }
  else { await page.keyboard.down('x'); await page.waitForFunction(() => window.__gadgets.state.hold.fired, null, { timeout: 30000 }); await page.keyboard.up('x'); }
  await wait(3); await ev(() => window.__step(30, 1 / 30));
  s = await st();
  check('mantener detona las minas armadas (y no despliega otra)', s.n === 0 && s.inv.proximity === 3, `${s.n} desplegadas · ${s.inv.proximity} cargas`);
  await clean();

  // 5. cambiar de gadget: Z / deslizar hacia arriba
  await ev(() => { window.__gadgets.learn('net', 2); });
  if (mobile) { const b = await btn(); await touch.drag(12, [b.x, b.y], [b.x, b.y - 70], 6); await touch.up(12); } else await press('z');
  await wait(3);
  s = await st();
  check('Z / deslizar hacia arriba cambia de gadget', s.sel !== 'proximity', s.sel);

  // 6. límite de desplegados (3) y de cargas (12)
  const lim = await ev(() => { const gd = window.__gadgets, G = window.__G; G.S.gadgets.inv.proximity = 12; G.S.gadgets.sel = 'proximity'; gd.state.placeCd = 0; let ok = 0; for (let i = 0; i < 5; i++) { gd.state.placeCd = 0; if (gd.deploy()) ok++; } const n = gd.state.list.length; G.S.talentFx = { gadgetSlots: 20 }; const max = gd.maxSlots(); G.S.talentFx = undefined; return { ok, n, max, max0: gd.maxSlots() }; });
  check('máximo 3 desplegados (8 con talentos) y ≤ 12 cargas', lim.n === 3 && lim.max === 8 && lim.max0 === 3, JSON.stringify(lim));
  const full = await ev(() => { const gd = window.__gadgets, G = window.__G; const r = gd.craft('proximity', 1); return { r, inv: G.S.gadgets.inv.proximity }; });
  check('fabricar por encima de 12 cargas se rechaza', full.r === false && full.inv <= 12, JSON.stringify(full));
  await clean();

  // 7. salir de la región retira los gadgets
  await ev(() => { const gd = window.__gadgets; gd.deploy('proximity', { force: true }); window.__step(5, 1 / 30); });
  await region('tundra'); await wait(5);
  await ev(() => window.__step(5, 1 / 30));
  s = await st();
  check('al cambiar de región se retiran los gadgets', s.n === 0, `${s.n}`);
  await region('desierto'); await clean();

  // 8. aviso de aprendizaje (una vez)
  await ev(() => window.__step(400, 1 / 30));
  s = await st();
  check('el aviso de aprendizaje se muestra una vez', s.tip);

  // 9. Taller: pestaña Gadgets
  await ev(() => { const G = window.__G; G.S.mats.scrap = 40; G.S.mats.bio = 20; G.S.mats.battery = 10; G.S.credits = 5000; G.S.junk = G.S.junk || { 'trofeo_prueba': 30 }; window.__dbg.openWorkbench('gadgets'); });
  await wait(6);
  const wbk = await ev(() => ({ cards: document.querySelectorAll('#panel .gdcard').length, locked: document.querySelectorAll('#panel .gdcard.locked').length, buttons: document.querySelectorAll('#panel [data-gfab]').length }));
  check('el Taller muestra 12 tarjetas de gadget', wbk.cards === 12, JSON.stringify(wbk));
  const before = (await st()).inv.cluster | 0;
  await ev(() => document.querySelector('#panel [data-gfab="cluster"]')?.click());
  await wait(4);
  const after = (await st()).inv.cluster | 0;
  check('fabricar suma una carga y gasta materiales', after === before + 1, `${before} → ${after}`);
  if (SHOTS) await shot(`taller-${device}${api.portrait ? '-v' : ''}`);
  await page.keyboard.press('Escape'); await wait(4);

  // 10. escena para la captura: varios gadgets desplegados con enemigos acercándose
  await clean();
  if (SHOTS) {
    await ev(() => {
      const G = window.__G, gd = window.__gadgets, p = G.player; p.face = Math.PI / 2;
      const kinds = ['proximity', 'cluster', 'incendiary', 'cryo', 'emp', 'net', 'blades', 'shock', 'gravity', 'sentinel', 'decoy', 'barrier'];
      G.S.gadgets.known = Object.fromEntries(kinds.map((k) => [k, 1]));
      const row = window.__ROW === 1;
      kinds.forEach((k, i) => { const col = i % 4, rw = Math.floor(i / 4); gd.deploy(k, { force: true, x: p.x + 3 + col * 2.4, z: p.z - 3 + rw * 2.8, yaw: Math.PI / 2 }); });
      for (let i = 0; i < 6; i++) window.__spawn(['rastrero', 'mantis', 'infectado'][i % 3], 3, p.x + 17 + i * 0.7, p.z + (i - 3) * 1.3, { alerted: true });
      window.__step(70, 1 / 30);
    });
    await ev(() => { window.__G.paused = false; });
    await wait(6);
    await shot(`escena-${device}${api.portrait ? '-v' : ''}`);
    const perf = await api.perf();
    console.log('presupuesto de dibujo con 12 gadgets:', JSON.stringify(perf));
  }

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok); console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

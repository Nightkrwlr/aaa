// Regresión del fallo «con el juego en pausa se acumulan enemigos y sale una horda enorme»:
//   · causa 1: una manada despejada hace más de 15 min (reloj real) volvía a soltarse en CADA pasada del barrido del mundo (no se borraba la marca «despejada»);
//   · causa 2: los enfriamientos del mundo usaban el reloj real (Date.now): en pausa, en el menú o con la pestaña oculta seguían corriendo y todo se repoblaba de golpe al volver.
// Arreglos: la manada vuelve una sola vez (26-spawner.js), los enfriamientos usan gnow() (hora real menos el tiempo en que el juego no corre; 00-core.js y 32-boot.js)
// y un tope de enemigos vivos frena cualquier suelta de manadas del mundo (31e2-zonas.js).
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/pausa-horda.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, page } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await api.god(true);
  await ev(() => { window.__silence && window.__silence(true); });

  // un sitio con varias manadas del mundo cerca; se despejan todas
  const setup = () => ev(() => {
    const G = window.__G, W = G.world, p = G.player;
    const packs = G.map.ents.filter((e) => e.k === 'spawnpack' && !e.op);
    let best = null, bn = 0;
    for (const a of packs) { const n = packs.filter((b) => Math.hypot(a.x - b.x, a.z - b.z) < 22).length; if (n > bn) { bn = n; best = a; } }
    p.x = best.x; p.z = best.z; W.check(true); window.__step(30, 1 / 30);
    const alive = () => G.enemies.filter((e) => !e.dead && !e.static).length;
    const out = { packsNear: bn, enemies0: alive() };
    for (const e of G.enemies) if (!e.boss) { e.hp = 0; e.kill && e.kill({}); }
    window.__step(60, 1 / 30);
    out.after = alive();
    out.cleared = [...W.rt.values()].filter((o) => o.e.k === 'spawnpack' && o.clearedAt).length;
    return out;
  });
  const alive = () => ev(() => window.__G.enemies.filter((e) => !e.dead && !e.static).length);
  const respawned = () => ev(() => [...window.__G.world.rt.values()].filter((o) => o.e.k === 'spawnpack' && o.spawned && o.pack && o.pack.length).length);

  // ── 1) el bucle sin fin: enfriamiento cumplido (se falsea el reloj real +20 min) → cada manada vuelve UNA vez y la cuenta se queda plana ──
  const A = await setup();
  console.log('despejado', JSON.stringify(A));
  check('hay ≥ 3 manadas del mundo juntas y quedan despejadas (marca «despejada» en cada una)', A.packsNear >= 3 && A.cleared >= 3, JSON.stringify(A));
  const B = await ev(() => {
    const G = window.__G, real = Date.now.bind(Date); Date.now = () => real() + 20 * 60 * 1000;
    const alive = () => G.enemies.filter((e) => !e.dead && !e.static).length, out = { t: [] };
    out.base = alive();
    for (let k = 0; k < 10; k++) { window.__step(30, 1 / 30); out.t.push(alive()); }
    Date.now = real;
    out.maxPerPack = [...G.world.rt.values()].filter((o) => o.e.k === 'spawnpack').map((o) => o.pack ? o.pack.length : 0);
    return out;
  });
  console.log('tras 20 min', JSON.stringify(B));
  const grow = B.t[B.t.length - 1] - B.t[1];
  check('con el enfriamiento cumplido las manadas vuelven UNA vez (no una cada pasada): la cuenta de enemigos se queda plana durante 10 s', B.t[0] > B.base && grow <= 3 && Math.max(...B.t) <= 35, JSON.stringify({ base: B.base, t: B.t, grow }));

  // ── 2) el reloj del mundo no corre en pausa: con enfriamiento de 4 s, una pausa de 7 s reales NO repuebla ──
  await setup();
  const C0 = await ev(() => { window.__Fi.pack = 4000; return { lost0: Math.round(window.__GN.lost) }; });
  // se despeja de nuevo con el enfriamiento corto
  await setup();
  await ev(() => window.__dbg.openPause());
  const t0 = Date.now(); await page.waitForTimeout(7000);
  const mid = await ev(() => ({ lost: Math.round(window.__GN.lost), paused: window.__G.paused, n: window.__G.enemies.filter((e) => !e.dead && !e.static).length }));
  await ev(() => window.__dbg.UI.close());
  await wait(20);
  const C1 = await ev(() => {
    const G = window.__G, W = G.world;
    const stamps = [...W.rt.values()].filter((o) => o.e.k === 'spawnpack' && o.clearedAt).map((o) => Math.round((window.gnow ? window.gnow() : 0) - o.clearedAt));
    return { n: G.enemies.filter((e) => !e.dead && !e.static).length, lost: Math.round(window.__GN.lost) };
  });
  console.log('pausa', JSON.stringify({ C0, mid, C1 }));
  check('la pausa (7 s reales) se descuenta del reloj del mundo (≥ 6 s «perdidos»)', mid.paused && mid.lost - C0.lost0 >= 6000, JSON.stringify({ lost0: C0.lost0, lostMid: mid.lost, dt: Date.now() - t0 }));
  check('tras la pausa NO se ha repoblado nada (el enfriamiento de 4 s no ha corrido): ningún enemigo nuevo', C1.n <= mid.n + 1, JSON.stringify({ mid: mid.n, after: C1.n }));
  // con el juego corriendo, al cumplirse el enfriamiento (4 s de JUEGO, no de reloj: el motor por software va lento) vuelven las manadas, UNA vez cada una
  // (se cuentan las sueltas por manada; el momento exacto depende de la velocidad del motor, así que no se miden ventanas de tiempo)
  await ev(() => {
    const W = window.__G.world, orig = W.spawnPack; window.__spc = {};
    W.spawnPack = function (o) { const was = o.spawned; const r = orig.apply(this, arguments); if (!was && o.spawned && o.pack && o.pack.length) window.__spc[o.e.id] = (window.__spc[o.e.id] || 0) + 1; return r; };
  });
  let first = -1, seen = [];
  for (let k = 0; k < 40 && first < 0; k++) { await page.waitForTimeout(1000); const n = await ev(() => { window.__step(2, 1 / 30); return window.__G.enemies.filter((e) => !e.dead && !e.static).length; }); seen.push(n); if (n > C1.n) first = k; }
  for (let k = 0; k < 10; k++) { await page.waitForTimeout(1000); await ev(() => window.__step(2, 1 / 30)); }   // 10 s más: cualquier segunda suelta saldría aquí
  const C3 = await ev(() => { const G = window.__G; window.__step(10, 1 / 30); return { n: G.enemies.filter((e) => !e.dead && !e.static).length, spc: { ...window.__spc } }; });
  const spcMax = Math.max(0, ...Object.values(C3.spc)), spcN = Object.keys(C3.spc).length;
  console.log('tras correr', JSON.stringify({ first, seen, C3 }));
  check('con el juego corriendo, al cumplirse el enfriamiento (4 s de juego) vuelven las manadas (≥ 1) y cada una se suelta UNA sola vez en los 10+ s siguientes', first >= 0 && spcN >= 1 && spcMax === 1 && C3.n <= 35, JSON.stringify({ antes: C1.n, first, manadas: spcN, maxVeces: spcMax, c3: C3.n }));
  await ev(() => { window.__Fi.pack = 15 * 6e4; });

  // ── 3) pestaña oculta: el juego se pausa solo y ese tiempo tampoco cuenta ──
  await setup();
  const H = await ev(() => {
    const G = window.__G, lost0 = window.__GN.lost;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    return { ui: G.uiOpen, paused: G.paused, lost0 };
  });
  await page.waitForTimeout(3000);
  const H2 = await ev(() => { const o = { lost: window.__GN.lost }; Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); window.__dbg.UI.close(); return o; });
  check('con la pestaña oculta se abre la pausa y esos segundos se descuentan', H.ui === 'pause' && H.paused && H2.lost - H.lost0 >= 2500, JSON.stringify({ H, lost: Math.round(H2.lost - H.lost0) }));

  // ── 4) tope de seguridad: con muchos enemigos vivos no se suelta ninguna manada del mundo más ──
  const T = await ev(() => {
    const G = window.__G, W = G.world, p = G.player;
    for (const e of G.enemies) { e.dead = true; e.deadT = 0; } window.__step(5, 1 / 30);
    const cap = window.__zonas.cfg.exit.cap;
    for (let i = 0; i < cap + 5; i++) window.__spawn('rastrero', 3, p.x + 30 + (i % 10), p.z + 30 + Math.floor(i / 10), { alerted: false, persist: true });
    G.S.world.packs = {}; // sin marcas de «despejada» (si no, la manada se da por despejada y no llega a soltarse nunca)
    const pk = G.map.ents.find((e) => e.k === 'spawnpack' && !e.op && Math.hypot(e.x - p.x, e.z - p.z) > 16 && Math.hypot(e.x - p.x, e.z - p.z) < 90); // a ≥ minSpawn del jugador: solo el tope puede frenarla
    const o = { e: pk, spawned: false, pack: null };
    const n0 = G.enemies.length;
    W.spawnPack(o);
    const held = !o.spawned && G.enemies.length === n0;
    // al bajar la cuenta sí se suelta
    for (const e of G.enemies.slice(0, 20)) { e.dead = true; e.deadT = 0; } window.__step(5, 1 / 30);
    W.spawnPack(o);
    return { cap, n0, held, spawnedAfter: !!o.spawned, now: G.enemies.filter((e) => !e.dead).length };
  });
  check(`tope de seguridad: con ${T.cap}+ enemigos vivos la manada espera (no se suelta) y al bajar la cuenta sí`, T.held && T.spawnedAfter, JSON.stringify(T));

  const logs = api.logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', logs.length === 0, logs.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
  return results;
}

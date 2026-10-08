// Puzles (D7) · presupuesto de render, fugas y CPU:
//  1) llamadas de dibujo con cada tipo de puzle montado (api.perf: todas las pasadas) frente a la escena sin puzle
//  2) fugas: 6 ciclos de montar/dibujar/desmontar los 8 tipos y 6 entradas/salidas de un subterráneo con acertijo (geometrías, texturas y
//     objetos de la escena del renderer idénticos tras el primer ciclo)
//  3) CPU de pzTick (con el puzle activo, dibujando) y asignaciones por fotograma (muestreo de montículo de CDP: bytes atribuibles a pz*)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/puzles-perf.mjs --size 960x540 --quality medium --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page, perf } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });
  await api.region('desierto');
  await ev(() => { window.__G.player.inv = 9999; window.__step(10, 1 / 30); });
  const spawnAt = (kind, tier, id) => ev(([kind, tier, id]) => {
    const P = window.__puzzles, G = window.__G;
    let rt = null;
    for (let a = 0; a < 8 && !rt; a++) rt = P.spawn(kind, tier, 3, { radius: 26, dx: (a % 3 - 1) * 10, dz: (Math.floor(a / 3) - 0.5) * 12, id });
    if (!rt) return false;
    const z = rt.pz, T = z.T, lx = z.d.lw / 2, lz = z.d.lh + 1;
    G.player.x = T.tx + T.m00 * lx + T.m01 * lz; G.player.z = T.tz + T.m10 * lx + T.m11 * lz;
    window.__step(8, 1 / 30);
    return true;
  }, [kind, tier, id]);

  // ── 1 · llamadas de dibujo ──
  await wait(6);
  const p0 = await perf();
  console.log('sin puzle', JSON.stringify(p0));
  const kinds = ['mirrors', 'boxes', 'timed', 'runes', 'circuit', 'lasers', 'memory', 'valves'];
  let worst = 0; const table = {};
  for (const k of kinds) {
    const ok = await spawnAt(k, 3, 'pz_p');
    if (!ok) { table[k] = 'sin sitio'; continue; }
    await wait(4);
    const p = await perf(); const g = await ev(() => window.__puzzles.gfx());
    table[k] = { calls: p.calls, delta: p.calls - p0.calls, tris: p.triangles - p0.triangles, instancias: g.instances, mallas: g.drawn };
    worst = Math.max(worst, p.calls - p0.calls);
    await ev(() => window.__puzzles.remove('pz_p'));
  }
  console.log(JSON.stringify(table));
  check('cada puzle añade ≤ 25 llamadas de dibujo (≤ 8 % de la escena; mallas instanciadas compartidas, nunca por baldosa)', worst <= 25 && worst / p0.calls <= 0.1, `peor caso +${worst} (de ${p0.calls})`);
  check('las mallas del puzle son ≤ 16 en total, sea cual sea el tamaño', Object.values(table).every((t) => typeof t === 'string' || t.mallas <= 16), JSON.stringify(Object.values(table).map((t) => t.mallas)));
  const p1 = await perf();
  check('al quitar el puzle las llamadas de dibujo vuelven a las de antes', Math.abs(p1.calls - p0.calls) <= 2, `${p0.calls} → ${p1.calls}`);

  // ── 2 · fugas ──
  await ev(() => window.__puzzles.mem()); // calienta
  const cyc = [];
  for (let c = 0; c < 6; c++) {
    for (const k of kinds) { await spawnAt(k, 2, 'pz_l'); await ev(() => { window.__step(6, 1 / 30); window.__puzzles.remove('pz_l'); window.__step(2, 1 / 30); }); }
    cyc.push(await ev(() => window.__puzzles.mem()));
  }
  console.log('ciclos', JSON.stringify(cyc));
  const base = cyc[0];
  check('6 ciclos de montar/dibujar/desmontar los 8 tipos no dejan geometrías, texturas ni objetos en la escena', cyc.every((m) => m.geometries === base.geometries && m.textures === base.textures && m.puzzleMeshes === 16), JSON.stringify(cyc.map((m) => [m.geometries, m.textures, m.puzzleMeshes])));
  const gf = await ev(() => { const P = window.__puzzles; return { b: P.gfx(), meshes: Object.keys(P.PZR.b).length * 2, mounted: P.api.mounted().length }; });
  check('no queda nada montado y el juego de mallas sigue siendo el mismo (16)', gf.meshes === 16 && gf.mounted === 0, JSON.stringify(gf));

  // subterráneo con y sin acertijo: 6 entradas y salidas (la huella no crece frente a los subterráneos sin acertijo)
  const cycles = await ev(() => {
    const P = window.__puzzles, G = window.__G;
    const stairs = G.world.map.ents.filter((e) => e.k === 'stairs');
    const withP = stairs.filter((e) => P.api.stairsHave(e)), without = stairs.filter((e) => !P.api.stairsHave(e) && e.enc !== 'puzzle');
    const run = (list) => {
      const out = [];
      for (let c = 0; c < 5; c++) {
        const e = list[c % Math.min(3, list.length)];
        G.player.x = e.x + 1.5; G.player.z = e.z; G.world.enterSub(e); window.__step(30, 1 / 30);
        const ent = G.map.ents.find((q) => q.k === 'puzzle'); if (ent) { G.player.x = ent.x; G.player.z = ent.z + ent.pz.H / 2 + 1.5; window.__step(20, 1 / 30); }
        G.world.leaveSub(); window.__step(30, 1 / 30);
        out.push(P.mem());
      }
      return out;
    };
    const a = run(without), b = run(withP);
    return { sin: a.map((m) => [m.geometries, m.textures, m.children]), con: b.map((m) => [m.geometries, m.textures, m.children]), n: [without.length, withP.length] };
  });
  console.log('subterráneos', JSON.stringify(cycles));
  const growth = (arr) => [arr[arr.length - 1][0] - arr[1][0], arr[arr.length - 1][1] - arr[1][1], arr[arr.length - 1][2] - arr[1][2]];
  const gSin = growth(cycles.sin), gCon = growth(cycles.con);
  check('entrar y salir 5 veces de subterráneos con acertijo no crece más que sin acertijo (geometrías, texturas, objetos)', gCon[0] <= gSin[0] && gCon[1] <= gSin[1] && gCon[2] <= gSin[2], `sin ${gSin} · con ${gCon}`);

  // ── 3 · CPU y asignaciones por fotograma ──
  await api.region('desierto');
  await spawnAt('circuit', 3, 'pz_c'); await spawnAt('mirrors', 3, 'pz_c2');
  const cpu = await ev(() => {
    const P = window.__puzzles; const N = 600;
    for (let i = 0; i < 60; i++) P.tick(1 / 60);
    const t0 = performance.now(); for (let i = 0; i < N; i++) P.tick(1 / 60); const t1 = performance.now();
    return { us: ((t1 - t0) / N) * 1000, mounted: P.api.mounted().length, inst: P.gfx().instances };
  });
  console.log('CPU', JSON.stringify(cpu));
  check('pzTick con dos puzles montados (y uno activo) cuesta < 150 µs por fotograma', cpu.us < 150 && cpu.mounted === 2, `${cpu.us.toFixed(1)} µs · ${cpu.inst} instancias`);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 64 });
  await ev(() => { const P = window.__puzzles; for (let i = 0; i < 1500; i++) P.tick(1 / 60); });
  const prof = (await cdp.send('HeapProfiler.stopSampling')).profile;
  let mine = 0, total = 0; const byFn = {};
  const walk = (n, inMine) => {
    const fn = n.callFrame.functionName || '';
    const here = inMine || /^(pzTick|pzDrawAll|pzHud|pzLabels)$/.test(fn);
    total += n.selfSize;
    if (here) { mine += n.selfSize; if (n.selfSize) byFn[fn || '(anónima)'] = (byFn[fn || '(anónima)'] || 0) + n.selfSize; }
    for (const c of n.children || []) walk(c, here);
  };
  walk(prof.head, false);
  console.log('asignaciones en 1500 fotogramas bajo pzTick:', mine, 'B', JSON.stringify(byFn), '· total muestreado', total, 'B');
  check('pzTick no asigna memoria por fotograma (< 4 KB muestreados en 1500 fotogramas)', mine < 4096, `${mine} B ${JSON.stringify(byFn)}`);
  await ev(() => { window.__puzzles.remove('pz_c'); window.__puzzles.remove('pz_c2'); });

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
}

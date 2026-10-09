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
  // Cada tipo se mide EN EL MISMO SITIO con y sin puzle (montado → quitado, unos pasos de simulación en medio, que es lo que oculta las mallas):
  // comparar contra una medida tomada en otro punto del mapa mezcla el coste del puzle con el de los trozos del mundo que se ven (±100 llamadas).
  await wait(6);
  const kinds = ['mirrors', 'boxes', 'timed', 'runes', 'circuit', 'lasers', 'memory', 'valves'];
  const visibles = () => ev(() => { let n = 0; window.__G.R.scene.traverse((o) => { if (/^puzzle-/.test(o.name) && o.visible) n++; }); return n; });
  let worst = 0, worstBase = 1, leftVisible = 0; const table = {};
  for (const k of kinds) {
    const ok = await spawnAt(k, 3, 'pz_p');
    if (!ok) { table[k] = 'sin sitio'; continue; }
    await wait(4);
    const con = await perf(); const g = await ev(() => window.__puzzles.gfx());
    await ev(() => window.__puzzles.remove('pz_p'));
    await ev(() => window.__step(3, 1 / 30)); await wait(3);
    const sin = await perf(); const vis = await visibles();
    leftVisible += vis;
    table[k] = { con: con.calls, sin: sin.calls, delta: con.calls - sin.calls, tris: con.triangles - sin.triangles, instancias: g.instances, mallas: g.drawn, visiblesTrasQuitar: vis };
    if (con.calls - sin.calls > worst) { worst = con.calls - sin.calls; worstBase = sin.calls; }
  }
  console.log(JSON.stringify(table));
  check('cada puzle añade ≤ 25 llamadas de dibujo (≤ 10 % de la escena; mallas instanciadas compartidas, nunca por baldosa)', worst <= 25 && worst / worstBase <= 0.1, `peor caso +${worst} (de ${worstBase})`);
  check('las mallas del puzle son ≤ 16 en total, sea cual sea el tamaño', Object.values(table).every((t) => typeof t === 'string' || t.mallas <= 16), JSON.stringify(Object.values(table).map((t) => t.mallas)));
  check('al quitar el puzle no queda ninguna malla suya visible (coste de dibujo cero)', leftVisible === 0, `visibles tras quitar: ${leftVisible}`);

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
  // calentamiento: los primeros miles de llamadas corren en el intérprete (V8 encaja los dobles en cajas) y no son lo que cuesta en régimen estable
  await ev(() => { const P = window.__puzzles; for (let i = 0; i < 3000; i++) P.tick(1 / 60); });
  // muestreo de montículo de CDP; `soloPz`: cuenta solo lo que cuelga de pzTick/pzDrawAll/pzHud/pzLabels, si no, todo lo muestreado
  const muestrea = async (fn, soloPz) => {
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 64 });
    await ev(fn);
    const prof = (await cdp.send('HeapProfiler.stopSampling')).profile;
    let mine = 0; const byFn = {};
    const walk = (n, inMine) => {
      const name = n.callFrame.functionName || '';
      const here = !soloPz || inMine || /^(pzTick|pzDrawAll|pzHud|pzLabels)$/.test(name);
      if (here && n.selfSize) { mine += n.selfSize; byFn[name || '(anónima)'] = (byFn[name || '(anónima)'] || 0) + n.selfSize; }
      for (const c of n.children || []) walk(c, here);
    };
    walk(prof.head, false);
    return { mine, byFn };
  };
  const inst = cpu.inst, FR = 1500;
  // CONTROL: exactamente las mismas llamadas a Matrix4.compose que hacen 1500 fotogramas del puzle, sin puzle de por medio. Si Three/V8 ya
  // reparten unos bytes en esas llamadas (cajas de dobles), eso no es del puzle: el puzle solo puede pasarse del control, no del cero.
  const ctl = (n) => () => { const C = window.__G.R.camera, M4 = C.matrix.constructor, M = new M4(), q = C.quaternion.clone(), p = C.position.clone(), sc = C.scale.clone(); for (let i = 0; i < n; i++) { p.x = i * 0.001; M.compose(p, q, sc); } };
  await ev(ctl(inst * 3000));
  const ctrl = await muestrea(ctl(inst * FR), false);
  const real = await muestrea(() => { const P = window.__puzzles; for (let i = 0; i < 1500; i++) P.tick(1 / 60); }, true);
  console.log(`asignaciones en ${FR} fotogramas: pzTick ${real.mine} B ${JSON.stringify(real.byFn)} · control (${inst * FR} compose sin puzle) ${ctrl.mine} B ${JSON.stringify(ctrl.byFn)}`);
  check('pzTick no asigna más que el mismo número de Matrix4.compose sin puzle (+ 4 KB de margen del muestreo)', real.mine <= ctrl.mine + 4096, `puzle ${real.mine} B · control ${ctrl.mine} B · ${(real.mine / FR).toFixed(1)} B/fotograma`);
  await ev(() => { window.__puzzles.remove('pz_c'); window.__puzzles.remove('pz_c2'); });

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
}

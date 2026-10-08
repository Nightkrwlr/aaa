// Puzles (D7) · migración del guardado: DUMP=ruta (con la build ANTIGUA, sin puzles) crea una partida y vuelca localStorage;
// LOAD=ruta (con la NUEVA) la carga con «Continuar» y comprueba S.puzzles / S.puzzleStats / S.puzzleV, la idempotencia y la limpieza de basura.
//   DUMP=/tmp/s.json node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/puzles-migrate.mjs
//   LOAD=/tmp/s.json node tools/shot.mjs --html dist/dev.html   --scenario tools/scenarios/puzles-migrate.mjs
import fs from 'node:fs';
export default async function ({ boot, newGame, ev, wait, page, logs }) {
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  if (process.env.DUMP) {
    await boot(); await newGame();
    await ev(() => { const G = window.__G; G.S.credits = 4321; G.S.mats.scrap = 33; G.S.lvl = 9; });
    await ev(() => window.__step(60, 1 / 30));
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await ev(() => { try { window.__G.S.t = Date.now(); localStorage.setItem('opeclipse_save_v1', JSON.stringify(window.__G.S)); } catch (e) { console.log(e); } });
    const raw = await ev(() => localStorage.getItem('opeclipse_save_v1'));
    fs.writeFileSync(process.env.DUMP, raw);
    console.log('guardado antiguo volcado:', raw.length, 'bytes · tiene puzzles:', raw.includes('"puzzles"'), '· tiene puzzleV:', raw.includes('puzzleV'));
    return;
  }
  const raw = fs.readFileSync(process.env.LOAD, 'utf8');
  console.log('guardado antiguo: tiene puzzles =', raw.includes('"puzzles"'));
  await page.addInitScript((r) => { try { localStorage.setItem('opeclipse_save_v1', r); } catch (e) {} }, raw);
  await boot();
  await page.click('#mCont'); await page.waitForTimeout(1500); await wait(10);
  const r = await ev(() => { const G = window.__G, S = G.S; return { started: G.started, lvl: S.lvl, credits: S.credits, puzzles: S.puzzles, stats: S.puzzleStats, v: S.puzzleV }; });
  console.log(JSON.stringify(r));
  check('el guardado antiguo se carga con los datos intactos y los campos nuevos creados', r.started && r.lvl === 9 && r.credits === 4321 && r.v === 1 && r.puzzles && Object.keys(r.puzzles).length === 0 && r.stats && r.stats.n === 0 && r.stats.byKind && typeof r.stats.byKind === 'object', JSON.stringify(r));
  // idempotencia, JSON puro y limpieza de basura
  const m = await ev(() => {
    const G = window.__G, P = window.__puzzles, S = G.S, now = Date.now();
    const j0 = JSON.stringify({ p: S.puzzles, s: S.puzzleStats, v: S.puzzleV });
    P.migrate(S); P.migrate(S);
    const j1 = JSON.stringify({ p: S.puzzles, s: S.puzzleStats, v: S.puzzleV });
    // datos corruptos: lista en vez de objeto, entradas sin fecha, del futuro, muy antiguas, nivel absurdo; estadísticas con basura
    const T = JSON.parse(JSON.stringify(S));
    T.puzzles = [1, 2]; T.puzzleStats = 'x'; T.puzzleV = 0;
    P.migrate(T);
    const U = JSON.parse(JSON.stringify(S));
    U.puzzles = { ok1: { t: now - 1000, k: 'mirrors', tier: 2 }, sinFecha: { k: 'boxes' }, futuro: { t: now + 9e9, k: 'x', tier: 1 }, viejo: { t: now - 40 * 3600e3, k: 'valves', tier: 9 }, nulo: null, texto: 'x', tierMalo: { t: now - 5, k: 'timed', tier: -4 } };
    U.puzzleStats = { n: -5, perfect: 'a', hints: 3.7, errors: null, byKind: [1] };
    P.migrate(U);
    return { idem: j0 === j1, T: { p: T.puzzles, v: T.puzzleV, st: T.puzzleStats }, U: { keys: Object.keys(U.puzzles), tiers: Object.values(U.puzzles).map((q) => q.tier), st: U.puzzleStats }, json: JSON.stringify(S).length };
  });
  console.log(JSON.stringify(m));
  check('la migración es idempotente (dos pasadas dan el mismo JSON)', m.idem);
  check('si S.puzzles era una lista o las estadísticas eran texto, se rehacen', !Array.isArray(m.T.p) && Object.keys(m.T.p).length === 0 && m.T.v === 1 && m.T.st.n === 0 && typeof m.T.st.byKind === 'object', JSON.stringify(m.T));
  check('se descartan entradas mal formadas, del futuro o muy antiguas y se acota el nivel', JSON.stringify(m.U.keys.sort()) === JSON.stringify(['ok1', 'tierMalo'].sort()) && m.U.tiers.every((t) => t >= 1 && t <= 3), JSON.stringify(m.U));
  check('las estadísticas corruptas se sanean a enteros ≥ 0', m.U.st.n === 0 && m.U.st.perfect === 0 && m.U.st.hints === 3 && m.U.st.errors === 0 && typeof m.U.st.byKind === 'object' && !Array.isArray(m.U.st.byKind), JSON.stringify(m.U.st));
  // lo resuelto se guarda y se recarga: S.puzzles viaja en el JSON del guardado
  const rs = await ev(() => {
    const G = window.__G, P = window.__puzzles, S = G.S;
    S.puzzles['sub:prueba'] = { t: Date.now(), k: 'circuit', tier: 2, p: 1 };
    const j = JSON.parse(JSON.stringify(S)); P.migrate(j);
    return { vuelve: !!j.puzzles['sub:prueba'] && j.puzzles['sub:prueba'].k === 'circuit', recent: P.api.doneRecently('sub:prueba'), noRecent: P.api.doneRecently('sub:otra') };
  });
  check('un acertijo resuelto sobrevive a guardar y cargar y cuenta como «reciente» (< 120 min)', rs.vuelve && rs.recent && !rs.noRecent, JSON.stringify(rs));
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni de migración', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((x) => !x.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nPASS migración (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
}

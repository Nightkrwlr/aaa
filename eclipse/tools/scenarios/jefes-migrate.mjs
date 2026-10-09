// D8 · migración de un guardado ANTIGUO (build publicada antes de las guaridas): LOAD=ruta con «Continuar»
//   (el volcado se hace con tools/scenarios/puzles-migrate.mjs: DUMP=/tmp/s.json node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/puzles-migrate.mjs)
//   LOAD=/tmp/s.json node tools/shot.mjs --html dist/eclipse.html --scenario tools/scenarios/jefes-migrate.mjs
import fs from 'node:fs';
export default async function ({ boot, ev, wait, page, logs, teleport }) {
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  const raw = fs.readFileSync(process.env.LOAD, 'utf8');
  const old = JSON.parse(raw);
  // el guardado antiguo se retoca solo para que haya terminales hackeadas y un jefe ya abatido (lo que un jugador real tendría)
  old.world = old.world || {}; old.world.term = { term_0_st1: Date.now(), term_0_st2: Date.now(), term_1_st1: Date.now() }; old.world.bosses = { reg0: Date.now() - 3 * 3600e3, reg0_t: Date.now() - 3 * 3600e3 };
  delete old.bossGate; delete old.relics; if (old.world) delete old.world.lair; old.lvl = 12;
  await page.addInitScript((r) => { try { localStorage.setItem('opeclipse_save_v1', r); } catch (e) {} }, JSON.stringify(old));
  await boot();
  await page.click('#mCont'); await page.waitForTimeout(1500); await wait(10);
  const r = await ev(() => { const G = window.__G, S = G.S; return { started: G.started, lvl: S.lvl, bg: S.bossGate && S.bossGate.v, term0: S.bossGate && S.bossGate.r[0] && S.bossGate.r[0].n.terminal, term1: S.bossGate && S.bossGate.r[1] && S.bossGate.r[1].n.terminal, rel: S.relics && S.relics.v, lair: S.world && typeof S.world.lair, killed: !!S.world.bosses.reg0 }; });
  console.log(JSON.stringify(r));
  check('el guardado antiguo carga y crea S.bossGate, S.relics y S.world.lair', r.started && r.bg === 1 && r.rel === 1 && r.lair === 'object', JSON.stringify(r));
  check('las terminales ya hackeadas cuentan como sellos de su región (con tope)', r.term0 === 2 && r.term1 === 1, `${r.term0}/${r.term1}`);
  const a = await ev(() => { const G = window.__G; G.map && 0; return G.map.ents.find((e) => e.id === 'arena_0') ? 1 : 0; });
  const st = await ev(() => window.__lair.status(window.__G.map.ents.find((e) => e.id === 'arena_0')));
  check('quien ya había abatido al jefe tiene el altar abierto sin pedir sellos ni misión', st === 'open', st);
  const idem = await ev(() => { const S = window.__G.S; const j0 = JSON.stringify([S.bossGate, S.relics, S.world.lair]); window.__G.migrations.forEach((f) => f(S)); window.__G.migrations.forEach((f) => f(S)); return j0 === JSON.stringify([S.bossGate, S.relics, S.world.lair]); });
  check('migrar dos veces más no cambia nada (idempotente)', idem);
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((x) => !x.ok);
  console.log(bad.length ? `FALLAN ${bad.length}/${results.length}` : `TODO OK ${results.length}/${results.length}`);
}

// Migración del guardado (lore): DUMP=ruta → (con la build ANTIGUA, S.lore = lista de índices) crea una partida con dos registros de datos y
// vuelca localStorage; LOAD=ruta → (con la build NUEVA) la carga con «Continuar» y comprueba la migración, la colocación y el guardado.
//   node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/lore-migrate.mjs      (con DUMP=/tmp/save-lore.json)
//   node tools/shot.mjs --scenario tools/scenarios/lore-migrate.mjs                             (con LOAD=/tmp/save-lore.json)
import fs from 'node:fs';
export default async function ({ boot, newGame, ev, wait, page, logs }) {
  if (process.env.DUMP) {
    await boot(); await newGame();
    await ev(() => { const G = window.__G, S = G.S; S.credits = 777; S.lvl = 7; S.lore.push(0); S.lore.push(4); S.world.dp.dp_0_w1 = 1; });
    await ev(() => window.__step(60, 1 / 30));
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await ev(() => { try { window.__G.S.t = Date.now(); localStorage.setItem('opeclipse_save_v1', JSON.stringify(window.__G.S)); } catch (e) { console.log(e); } });
    const raw = await ev(() => localStorage.getItem('opeclipse_save_v1'));
    fs.writeFileSync(process.env.DUMP, raw);
    const j = JSON.parse(raw);
    console.log('guardado antiguo volcado:', raw.length, 'bytes · S.lore es lista:', Array.isArray(j.lore), JSON.stringify(j.lore), '· loreV:', j.loreV);
    return;
  }
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  const raw = fs.readFileSync(process.env.LOAD, 'utf8');
  await page.addInitScript((r) => { try { localStorage.setItem('opeclipse_save_v1', r); } catch (e) {} }, raw);
  await boot();
  await page.click('#mCont'); await page.waitForTimeout(1500); await wait(10);
  const r = await ev(() => {
    const G = window.__G, S = G.S, L = S.lore;
    return { started: G.started, lvl: S.lvl, credits: S.credits, v: S.loreV, arr: Array.isArray(L), pads: L.pads, len: L.length, inc: L.includes(4), seed: L.seed, nodes: window.__lore.nodes().length, plan: window.__lore.plan().placed.length };
  });
  console.log(JSON.stringify(r));
  check('la partida antigua carga con sus datos', r.started && r.lvl === 7 && r.credits === 777);
  check('S.lore se migra a objeto con S.loreV = 1 y conserva los dos registros antiguos', r.v === 1 && !r.arr && r.pads.join() === '0,4' && r.len === 2 && r.inc, JSON.stringify(r));
  check('se colocan las 47 entradas de mundo (37 nodos + 10 terminales) para esta partida', r.plan === 47 && r.nodes === 37, `${r.plan}/${r.nodes} · semilla ${r.seed}`);
  // el Archivo antiguo cuenta los registros viejos
  const old = await ev(() => { window.__dbg.UI.close(); return null; });
  await ev(() => { window.__lore.open('libros'); });
  await page.click('#panel [data-lt="diario"]'); await wait(4);
  await page.click('#panel [data-t="pads"]'); await wait(4);
  const tabs = await ev(() => [...document.querySelectorAll('#panel .tab')].map((t) => t.textContent).join('|'));
  check('la pestaña «Registros» del Archivo antiguo sigue contando los 2 registros', /Registros 2\/\d+/.test(tabs), tabs);
  await page.keyboard.press('Escape'); await wait(3);
  // lo nuevo funciona sobre la partida antigua y se guarda sin perder lo viejo
  const w = await ev(() => {
    const G = window.__G, S = G.S, L = window.__lore;
    L.grant('v_ronda7', { quiet: true });
    G.world.takeDatapad({ id: 'dp_x', reg: 0, x: 0, z: 0 }, {});
    window.dispatchEvent(new Event('pagehide'));
    S.t = Date.now(); localStorage.setItem('opeclipse_save_v1', JSON.stringify(S));
    const j = JSON.parse(localStorage.getItem('opeclipse_save_v1'));
    return { f: Object.keys(j.lore.f), pads: j.lore.pads, v: j.loreV, hasLen: 'length' in j.lore };
  });
  check('guardar y recargar no pierde ni duplica: f, pads y loreV viajan; los atajos no', w.f.join() === 'v_ronda7' && w.pads.length === 3 && w.pads.slice(0, 2).join() === '0,4' && w.v === 1 && !w.hasLen, JSON.stringify(w));
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((x) => !x.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

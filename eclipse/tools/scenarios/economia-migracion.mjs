// Migración de un guardado antiguo (de antes de la ampliación de economía).
//   1) volcar un guardado con la build base:
//        ECO_SAVE_DUMP=/ruta/old.json node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/economia-migracion.mjs --out DIR
//   2) cargarlo con la build nueva y comprobar la migración (idempotente, tienda regenerada, nada se rompe):
//        ECO_SAVE_LOAD=/ruta/old.json node tools/shot.mjs --scenario tools/scenarios/economia-migracion.mjs --out DIR
import fs from 'node:fs';
export default async function (api) {
  const { boot, newGame, ev, wait, page, logs } = api;
  const dump = process.env.ECO_SAVE_DUMP, load = process.env.ECO_SAVE_LOAD;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  if (dump) {
    await boot(); await newGame();
    // algo de historia: muertes, un par de objetos, créditos y una tienda abierta (guardada con el stock antiguo)
    await ev(() => {
      const G = window.__G, p = G.player;
      for (let i = 0; i < 12; i++) window.__spawn('rastrero', 3, p.x + 3 + i * 0.2, p.z + 2, {});
      for (const e of [...G.enemies]) e.kill({});
      G.S.credits = 777; G.S.lvl = 7; G.S.xp = 400; G.S.stats.kills = 345;
      window.__dbg.openService('shop', 'vega'); window.__dbg.UI.close();
    });
    await ev(() => window.__step(60, 1 / 30));
    const json = await ev(() => JSON.stringify(window.__G.S));
    fs.writeFileSync(dump, json);
    const S = JSON.parse(json);
    console.log(`guardado antiguo volcado: lvl ${S.lvl}, ${S.inv.length} objetos, junk=${typeof S.junk}, shop=${S.shop ? Object.keys(S.shop) : null}`);
    return;
  }
  const old = fs.readFileSync(load, 'utf8');
  await boot();
  await page.evaluate((j) => localStorage.setItem('opeclipse_save_v1', j), old);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 240000 });
  await page.waitForFunction(() => window.__G?.R);
  await wait(10);
  await page.click('#mCont'); await wait(20);
  const r = await ev(() => {
    const G = window.__G, S = G.S, E = window.__eco;
    return { started: G.started, lvl: S.lvl, credits: S.credits, junk: typeof S.junk, sig: typeof S.sig, hitos: Array.isArray(S.hitos), econV: S.econV, shopCleared: S.shop === null || S.shop === undefined || !S.shop.vega || S.shop.vega.v3 === 1, virt: Object.getOwnPropertyDescriptor(S.mats, 'sigilo')?.enumerable === false, matsKeys: Object.keys(S.mats).join(',') };
  });
  check('el guardado antiguo carga y arranca', r.started && r.lvl === 7 && r.credits >= 777, JSON.stringify(r));
  check('campos nuevos creados (S.junk, S.sig, S.hitos, S.econV) y materiales virtuales no enumerables', r.junk === 'object' && r.sig === 'object' && r.hitos && r.econV === 1 && r.virt && !/sigilo/.test(r.matsKeys));
  const t = await ev(() => { window.__dbg.give('trofeos', 6); window.__dbg.openShop('vega'); const st = window.__G.S.shop.vega; const ok = st.items.length === 2 && st.chips.length === 3 && st.v3 === 1; window.__dbg.UI.close(); return { ok, plans: st.items.length, mods: st.chips.length }; });
  check('la tienda guardada con el stock antiguo se regenera (2 planos + 3 módulos)', t.ok, JSON.stringify(t));
  // idempotencia: segunda ejecución de las migraciones y guardado/recarga JSON
  const idem = await ev(() => { const G = window.__G, S = G.S; const before = JSON.stringify(S); for (const m of G.migrations) m(S); const after = JSON.stringify(S); return before === after; });
  check('las migraciones son idempotentes', idem);
  const rt = await ev(() => { const S = JSON.parse(JSON.stringify(window.__G.S)); return { junk: Object.keys(S.junk).length, hasSig: 'sigilo' in S.mats }; });
  check('el guardado serializa sin los materiales virtuales', rt.junk > 0 && !rt.hasSig, JSON.stringify(rt));
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((x) => !x.ok); console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

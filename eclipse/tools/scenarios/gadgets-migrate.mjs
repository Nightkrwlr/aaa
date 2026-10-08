// Migración del guardado: DUMP=ruta → (con la build ANTIGUA) crea una partida y vuelca localStorage; LOAD=ruta → (con la build NUEVA) la carga con «Continuar».
//   node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/gadgets-migrate.mjs     (con DUMP=/tmp/save.json)
//   node tools/shot.mjs --scenario tools/scenarios/gadgets-migrate.mjs                             (con LOAD=/tmp/save.json)
import fs from 'node:fs';
export default async function ({ boot, newGame, ev, wait, page, logs }) {
  if (process.env.DUMP) {
    await boot(); await newGame();
    await ev(() => { const G = window.__G; G.S.credits = 777; G.S.mats.scrap = 12; G.S.lvl = 7; });
    await ev(() => window.__step(60, 1 / 30));
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await ev(() => { try { window.__G.S.t = Date.now(); localStorage.setItem('opeclipse_save_v1', JSON.stringify(window.__G.S)); } catch (e) { console.log(e); } });
    const raw = await ev(() => localStorage.getItem('opeclipse_save_v1'));
    fs.writeFileSync(process.env.DUMP, raw);
    console.log('guardado antiguo volcado:', raw.length, 'bytes · tiene gadgets:', raw.includes('"gadgets"'));
    return;
  }
  const raw = fs.readFileSync(process.env.LOAD, 'utf8');
  await page.addInitScript((r) => { try { localStorage.setItem('opeclipse_save_v1', r); } catch (e) {} }, raw);
  await boot();
  await page.click('#mCont'); await page.waitForTimeout(1500); await wait(10);
  const r = await ev(() => { const G = window.__G, S = G.S; return { started: G.started, lvl: S.lvl, credits: S.credits, gadgets: JSON.stringify(S.gadgets), v: S.gadgetsV, list: window.__gadgets.state.list.length }; });
  console.log(JSON.stringify(r));
  const ok1 = r.started && r.lvl === 7 && r.credits === 777 && r.v === 1 && /"proximity":3/.test(r.gadgets);
  await ev(() => { const g = window.__gadgets; g.deploy('proximity', { force: true }); window.__step(60, 1 / 30); });
  // guardar y recargar no pierde nada ni duplica
  const r2 = await ev(() => { const S = window.__G.S; const j = JSON.parse(JSON.stringify(S)); return { n: Object.keys(j.gadgets.inv).length, inv: j.gadgets.inv, sel: j.gadgets.sel }; });
  console.log(JSON.stringify(r2));
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  console.log(ok1 && r2.inv.proximity >= 2 && !errors.length ? 'PASS migración' : 'FAIL migración ' + errors.join('|'));
}

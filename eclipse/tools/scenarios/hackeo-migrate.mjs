// Migración del guardado de HACKEO: DUMP=ruta → (con la build ANTIGUA) crea una partida con terminales hackeadas y vuelca localStorage;
// LOAD=ruta → (con la build NUEVA) la carga con «Continuar» y comprueba S.hack / S.hackV, el nivel retroactivo y que no se duplica nada.
//   node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/hackeo-migrate.mjs     (con DUMP=/tmp/save.json)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/hackeo-migrate.mjs        (con LOAD=/tmp/save.json)
import fs from 'node:fs';
export default async function ({ boot, newGame, ev, wait, page, logs }) {
  if (process.env.DUMP) {
    await boot(); await newGame();
    await ev(() => { const G = window.__G, S = G.S; S.stats.terminals = 14; S.credits = 4321; S.lvl = 9; S.mats.data = 7; S.lore = [0, 1, 2]; });
    await ev(() => window.__step(60, 1 / 30));
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await ev(() => { try { window.__G.S.t = Date.now(); localStorage.setItem('opeclipse_save_v1', JSON.stringify(window.__G.S)); } catch (e) { console.log(e); } });
    const raw = await ev(() => localStorage.getItem('opeclipse_save_v1'));
    fs.writeFileSync(process.env.DUMP, raw);
    console.log('guardado antiguo volcado:', raw.length, 'bytes · tiene hack:', raw.includes('"hack"'), '· terminales:', JSON.parse(raw).stats.terminals);
    return;
  }
  const raw = fs.readFileSync(process.env.LOAD, 'utf8');
  await page.addInitScript((r) => { try { localStorage.setItem('opeclipse_save_v1', r); } catch (e) {} }, raw);
  await boot();
  await page.click('#mCont'); await page.waitForTimeout(1500); await wait(10);
  const r = await ev(() => { const G = window.__G, S = G.S, H = S.hack; return { started: G.started, lvl: S.lvl, credits: S.credits, terminals: S.stats.terminals, v: S.hackV, hack: JSON.stringify(H), api: !!G.hackApi && G.hackApi.level() }; });
  console.log(JSON.stringify(r));
  const H = JSON.parse(r.hack);
  const ok1 = r.started && r.lvl === 9 && r.credits === 4321 && r.v === 1 && H.lvl >= 3 && H.stats.ok === 14 && H.tools.disipador === 2 && r.api === H.lvl;
  // un hackeo con la partida migrada, guardar y recargar el JSON no pierde ni duplica nada
  const r2 = await ev(() => {
    const h = window.__hack, S = window.__G.S, a = JSON.stringify(S.hack);
    h.migrate(S); h.migrate(S);
    const same = a === JSON.stringify(S.hack);
    h.addXp(30);
    const j = JSON.parse(JSON.stringify(S));
    return { same, lvl: j.hack.lvl, xp: Math.round(j.hack.xp), v: j.hackV };
  });
  console.log(JSON.stringify(r2));
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  console.log(ok1 && r2.same && r2.v === 1 && !errors.length ? 'PASS migración' : 'FAIL migración ' + errors.join('|'));
  if (!(ok1 && r2.same && !errors.length)) process.exitCode = 1;
}

// Genera un guardado ANTIGUO (perks aleatorios + pendingPerks) arrancando una build del commit base y lo vuelca a un fichero.
//   node tools/shot.mjs --html /ruta/build-base.html --scenario tools/scenarios/talents-oldsave.mjs --out DIR     (OLDSAVE=/ruta/old-save.json)
import fs from 'node:fs';
export default async function (api) {
  const { boot, newGame, ev } = api;
  await boot(); await newGame();
  const out = process.env.OLDSAVE || 'old-save.json';
  const json = await ev(() => {
    const G = window.__G, S = G.S, p = G.player;
    // sube a nivel 9 por el camino normal (en el original cada nivel da un pendingPerks)
    for (let i = 0; i < 40 && S.lvl < 9; i++) p.addXp(120);
    // elige 7 mejoras como lo haría el modal: rangos de perks reales + un poder
    S.perks = { dmg: 3, hp: 2, rate: 1, p_phx: 1 };
    S.pendingPerks = S.lvl - 1 - 7;
    S.credits = 777;
    // marca un jefe principal como derrotado (reg0) para probar el reembolso por jefes
    S.world.bosses.reg0 = Date.now();
    p.recalc();
    G.events.save.forEach((f) => f(true));
    return localStorage.getItem('opeclipse_save_v1');
  });
  fs.writeFileSync(out, json);
  const o = JSON.parse(json);
  console.log(`guardado antiguo: nivel ${o.lvl}, perks ${JSON.stringify(o.perks)}, pendingPerks ${o.pendingPerks}, créditos ${o.credits} -> ${out}`);
}

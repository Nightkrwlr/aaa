// frente «Clima, atmósfera, iluminación y ciclo día/noche»: escenas de prueba con la misma semilla y hora para comparar antes/después.
//   valle día / tarde / alba / noche · ciudad (lluvia) · desierto (polvo) · tundra (nieve) · caldera (brasas) · yermo (ceniza)
//   marisma y colmena de noche (esporas) · valle de noche con linterna
// uso: node tools/shot.mjs --scenario tools/scenarios/clima-escenas.mjs --tag antes --seed 1 --size 960x540
//      ESCENAS=valle-dia,ciudad (filtra)   PERF=1 (imprime api.perf() de cada escena)   SETTLE=n (fotogramas de espera)
export const ESCENAS = [
  // [nombre, región, hora, linterna]
  ['valle-dia', 'valle', 0.30], ['ciudad', 'ciudad', 0.30], ['desierto', 'desierto', 0.30], ['tundra', 'tundra', 0.30],
  ['caldera', 'caldera', 0.30], ['yermo', 'yermo', 0.30],
  ['valle-tarde', 'valle', 0.57], ['valle-alba', 'valle', 0.99],
  ['valle-noche', 'valle', 0.80], ['marisma-noche', 'marisma', 0.80], ['colmena-noche', 'colmena', 0.80],
  ['valle-linterna', 'valle', 0.80, true],
];

export default async function ({ boot, newGame, god, region, setTime, still, wait, ev, perf }) {
  const quiero = (process.env.ESCENAS || ESCENAS.map((e) => e[0]).join(',')).split(',');
  const settle = +(process.env.SETTLE || 40);
  await boot(); await newGame(); await god();
  let tPrev = null;
  for (const [nombre, reg, t, lint] of ESCENAS) {
    if (!quiero.includes(nombre)) continue;
    if (t !== tPrev) { await setTime(t); tPrev = t; }
    await region(reg);
    await ev((l) => { const G = window.__G; G.S.flags.flashlight = !!l; G.player.flashOn = !!l; }, lint);
    await wait(settle);
    await still(nombre);
    if (process.env.PERF) console.log('perf', nombre, JSON.stringify(await perf()));
  }
}

// frente «Terreno, muros y agua»: las seis escenas de prueba, con la misma semilla y hora para comparar antes/después.
//   valle   → césped + sendero + muros de la base       ciudad → asfalto + ruinas      desierto → arena
//   tundra  → nieve + hielo                             caldera → lava                 marisma → agua
// uso: node tools/shot.mjs --scenario tools/scenarios/terreno-escenas.mjs --tag antes --seed 1 --size 960x540
//      ESCENAS=valle,caldera (filtra)   PERF=1 (imprime api.perf() de cada escena)
// Las coordenadas se eligieron sobre el mapa generado con la semilla 1 (576x576 casillas, regiones de 192).
export const ESCENAS = {
  valle: { x: 288.5, z: 285.5 },       // base: muros y sendero de entrada, césped alrededor
  valle2: { x: 262, z: 226 },          // valle al norte de la base: orilla de agua + césped
  ciudad: null,                        // centro de la región (se calcula)
  desierto: null,
  tundra: null,
  caldera: { x: 462, z: 20 },          // lago de lava
  marisma: null,                       // agua: se busca la mayor charca cerca del centro
  acido: { x: 342, z: 8 },
};

export default async function ({ boot, newGame, god, region, setTime, still, wait, ev, teleport, perf }) {
  const quiero = (process.env.ESCENAS || 'valle,ciudad,desierto,tundra,caldera,marisma').split(',');
  await boot(); await newGame(); await god();
  await setTime(0.3);
  for (const k of quiero) {
    const e = ESCENAS[k];
    if (e) await teleport(e.x, e.z);
    else if (k === 'marisma') {
      // la charca de agua más grande de la región marisma (gx 0, gz 1)
      const c = await ev(() => {
        const m = window.__G.map; let b = null;
        for (let z = 200; z < 376; z += 2) for (let x = 12; x < 180; x += 2) {
          let w = 0, g = 0;
          for (let dz = -6; dz <= 6; dz++) for (let dx = -8; dx <= 8; dx++) { const q = m.ter[(z + dz) * m.w + x + dx]; if (q === 4) w++; else if (q === 0) g++; }
          const s = Math.min(w, 70) + Math.min(g, 60);
          if (w > 25 && (!b || s > b.s)) b = { x, z, s };
        }
        return b;
      });
      console.log('marisma', JSON.stringify(c));
      await teleport(c.x + 0.5, c.z + 0.5);
    } else await region(k);
    await wait(25);
    await still(k);
    if (process.env.PERF) console.log('perf', k, JSON.stringify(await perf()));
  }
}

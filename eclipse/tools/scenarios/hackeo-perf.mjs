// HACKEO · presupuesto de render: llamadas de dibujo / triángulos en tres vistas (Bastión, valle, ciudad) con y sin el módulo Hacker y un marcador de torreta.
// Se ejecuta con la build NUEVA y con la ANTIGUA y se comparan los números (el frente no debe añadir llamadas de dibujo).
//   node tools/shot.mjs --html dist/eclipse.html --scenario tools/scenarios/hackeo-perf.mjs --size 960x540 --out /ruta
export default async function ({ boot, newGame, god, region, setTime, wait, perf, ev }) {
  await boot(); await newGame(); await god(); await setTime(0.3);
  const rows = {};
  rows.base = await perf();
  for (const key of ['valle', 'ciudad']) { await region(key); await wait(20); rows[key] = await perf(); }
  // con el módulo Hacker desplegado y una torreta marcada (solo si existen en la build)
  const extra = await ev(() => {
    const G = window.__G, p = G.player;
    if (!window.__hack) return null;
    const g = window.__gadgets; g.learn('hacker', 3); g.deploy('hacker', { force: true, x: p.x + 2, z: p.z + 1 });
    window.__spawn('torreta', 4, p.x + 4, p.z + 2); window.__step(40, 1 / 30);
    return { marcador: !!document.querySelector('.hk-mark') && getComputedStyle(document.querySelector('.hk-mark')).display !== 'none' };
  });
  if (extra) { await wait(10); rows['con módulo + marcador'] = await perf(); console.log('extra', JSON.stringify(extra)); }
  for (const k in rows) console.log(`perf ${k.padEnd(22)} llamadas ${rows[k].calls} · triángulos ${rows[k].triangles} · programas ${rows[k].programs} · texturas ${rows[k].textures} · geometrías ${rows[k].geometries}`);
}

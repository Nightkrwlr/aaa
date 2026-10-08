// Presupuesto de render del recorrido corto (tour-lite) con api.perf() en cada parada: se ejecuta con la build base y con la nueva y se
// comparan llamadas de dibujo y triángulos (regla: sin regresión). No usa nada de lore, así que sirve para ambas.
//   node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/lore-perf.mjs --size 640x360 --tag base
//   node tools/shot.mjs --scenario tools/scenarios/lore-perf.mjs --size 640x360 --tag nueva
export default async function ({ boot, newGame, god, region, setTime, wait, perf, ev }) {
  await boot(); await newGame(); await god();
  const rows = [];
  const mark = async (name) => { await wait(12); const p = await perf(); rows.push({ name, ...p }); console.log('PERF ' + name + ' ' + JSON.stringify(p)); };
  await setTime(0.3);
  await mark('base-day');
  for (const key of ['valle', 'ciudad', 'desierto', 'marisma', 'tundra', 'complejo', 'caldera', 'yermo', 'colmena']) { await region(key); await wait(15); await mark('reg-' + key); }
  await region('valle'); await setTime(0.8); await wait(20); await mark('valle-night');
  // junto a un nodo de lore, si existe (la build base no lo tiene)
  const n = await ev(() => (window.__lore ? window.__lore.nodes().map((e) => ({ id: e.lid, x: e.x, z: e.z, f: e.form })) : []));
  const tot = rows.reduce((a, r) => ({ calls: a.calls + r.calls, tri: a.tri + r.triangles }), { calls: 0, tri: 0 });
  console.log('PERFTOTAL ' + JSON.stringify({ stops: rows.length, calls: tot.calls, triangles: tot.tri, nodosEnElMapa: n.length }));
}

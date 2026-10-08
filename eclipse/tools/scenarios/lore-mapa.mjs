// Lore (D5): comprueba que el mapa generado NO cambia con el frente (regla dura: no desplazar el RNG del mundo, no subir mapV).
// Imprime un hash de terreno, regiones, bloqueos, props, decorado, puntos de interés y entidades (sin los nodos de lore). Se ejecuta con la
// build base y con la nueva; con EXPECT_MAP='<json impreso por la base>' compara y falla si difiere.
//   node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/lore-mapa.mjs --size 480x270
//   EXPECT_MAP='{…}' node tools/shot.mjs --scenario tools/scenarios/lore-mapa.mjs --size 480x270
export default async function ({ boot, newGame, ev }) {
  await boot(); await newGame();
  const h = await ev(() => {
    const m = window.__G.map, a = (t) => { let x = 2166136261 >>> 0; for (let i = 0; i < t.length; i++) { x ^= t[i]; x = Math.imul(x, 16777619) >>> 0; } return x; };
    const s = (t) => { let x = 2166136261 >>> 0; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; };
    return { ter: a(m.ter), reg: a(m.reg), blk: a(m.blk), props: s(JSON.stringify(m.props)), decor: s(JSON.stringify(m.decor)), ents: s(JSON.stringify(m.ents.filter((e) => e.k !== 'lore'))), pois: s(JSON.stringify(m.pois)), mapV: window.__G.S.mapV };
  });
  const j = JSON.stringify(h);
  console.log('MAPHASH ' + j);
  if (process.env.EXPECT_MAP) {
    const ok = j === process.env.EXPECT_MAP;
    console.log(ok ? 'PASS mapa idéntico al de la base' : 'FAIL el mapa difiere de la base: ' + j);
    if (!ok) process.exitCode = 1;
  }
}

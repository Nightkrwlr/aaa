// HACKEO · el mapa generado no puede cambiar: huella (FNV-1a) del terreno y de las entidades del mundo tras una partida nueva.
// Se ejecuta con la build ANTIGUA y con la NUEVA y las dos líneas «huella» deben ser idénticas (con la misma --seed).
//   node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/hackeo-map.mjs --size 640x360 --seed 1
//   node tools/shot.mjs --html dist/eclipse.html --scenario tools/scenarios/hackeo-map.mjs --size 640x360 --seed 1
export default async function ({ boot, newGame, ev }) {
  await boot(); await newGame();
  const r = await ev(() => {
    const G = window.__G, m = G.map;
    const fnv = (h, n) => { h ^= n & 0xffffffff; return Math.imul(h, 16777619) >>> 0; };
    let h = 2166136261, n = 0;
    const ter = m.ter || [];
    for (let i = 0; i < ter.length; i++) { h = fnv(h, ter[i]); n++; }
    let he = 2166136261, ne = 0;
    for (const e of (m.ents || []).filter((q) => q.k !== 'lore')) { // los nodos de lore (frente LORE) se añaden después de generar el mapa: no cuentan
      he = fnv(he, Math.round((e.x || 0) * 100)); he = fnv(he, Math.round((e.z || 0) * 100));
      const k = String(e.k) + String(e.id || '') + String(e.eff || '');
      for (let i = 0; i < k.length; i++) he = fnv(he, k.charCodeAt(i));
      ne++;
    }
    return { celdas: n, ter: h.toString(16), ents: ne, entsHash: he.toString(16), mapV: G.S.mapV, kind: m.kind };
  });
  console.log('huella ' + JSON.stringify(r));
}

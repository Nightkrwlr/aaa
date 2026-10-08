// Puzles (D7) · el mundo NO cambia: huella (FNV-1a) del mapa del mundo abierto + comprobaciones de que las funciones de mazmorra envueltas
// producen el mismo mapa que las originales salvo el acertijo, y de que la colocación no consume el RNG del juego.
//   node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/puzles-map.mjs --size 640x360 --seed 1   (build SIN puzles: solo la huella)
//   node tools/shot.mjs --html dist/dev.html   --scenario tools/scenarios/puzles-map.mjs --size 640x360 --seed 1   (build con puzles: huella + mazmorras)
// Las dos líneas «huella» (base y nueva) deben ser idénticas. Con EXPECT='{…}' (la línea de la base) el guion lo compara solo.
export default async function ({ boot, newGame, ev }) {
  await boot(); await newGame();
  const r = await ev(() => {
    const G = window.__G, m = G.map;
    const fnv = (h, n) => { h ^= n & 0xffffffff; return Math.imul(h, 16777619) >>> 0; };
    const arr = (a) => { let h = 2166136261; for (let i = 0; i < a.length; i++) h = fnv(h, a[i]); return h.toString(16); };
    let he = 2166136261, ne = 0;
    for (const e of (m.ents || [])) {
      if (e.k === 'lore') continue; // los nodos del Archivo dependen de la semilla de la partida (S.lore.seed), no del mapa
      he = fnv(he, Math.round((e.x || 0) * 100)); he = fnv(he, Math.round((e.z || 0) * 100));
      const k = String(e.k) + String(e.id || '') + String(e.eff || '') + String(e.tier ?? '') + String(e.enc || '');
      for (let i = 0; i < k.length; i++) he = fnv(he, k.charCodeAt(i));
      ne++;
    }
    let hp = 2166136261;
    for (const p of m.props || []) { hp = fnv(hp, Math.round(p.x * 100)); hp = fnv(hp, Math.round(p.z * 100)); hp = fnv(hp, String(p.t).length); }
    let hd = 2166136261;
    for (const p of m.decor || []) { hd = fnv(hd, Math.round(p.x * 100)); hd = fnv(hd, Math.round(p.z * 100)); }
    return { celdas: m.ter.length, ter: arr(m.ter), reg: arr(m.reg), blk: arr(m.blk), wh: arr(m.wh), ents: ne, entsHash: he.toString(16), props: (m.props || []).length, propsHash: hp.toString(16), decor: (m.decor || []).length, decorHash: hd.toString(16), mapV: G.S.mapV, kind: m.kind };
  });
  console.log('huella ' + JSON.stringify(r));
  if (process.env.EXPECT) {
    const exp = JSON.parse(process.env.EXPECT);
    const same = JSON.stringify(exp) === JSON.stringify(r);
    console.log(same ? 'PASS el mapa del mundo es idéntico al de la build base (terreno, regiones, bloqueos, props, decorado, entidades) y mapV no cambia' : 'FAIL el mapa del mundo cambió: esperado ' + JSON.stringify(exp));
    if (!same) process.exitCode = 1;
  }
  const hasP = await ev(() => !!window.__puzzles);
  if (!hasP) return;
  // mazmorras: la función envuelta devuelve el mapa de la original más (como mucho) el acertijo
  const d = await ev(() => {
    const P = window.__puzzles, G = window.__G, R = P.pure.rng(2024);
    const fnv = (h, n) => { h ^= n & 0xffffffff; return Math.imul(h, 16777619) >>> 0; };
    const arr = (a) => { let h = 2166136261; for (let i = 0; i < a.length; i++) h = fnv(h, a[i]); return h; };
    const entsH = (m, skip) => { let h = 2166136261; for (const e of m.ents) { if (skip(e)) continue; h = fnv(h, Math.round(e.x * 100)); h = fnv(h, Math.round(e.z * 100)); const k = e.k + (e.id || '') + (e.enc || ''); for (let i = 0; i < k.length; i++) h = fnv(h, k.charCodeAt(i)); } return h; };
    const stairs = G.world.map.ents.filter((e) => e.k === 'stairs');
    const out = { n: 0, conAcertijo: 0, terIguales: 0, regIguales: 0, entsIguales: 0, rngIgual: 0, propsSoloEnRect: 0, blkSoloEnRect: 0, malos: [] };
    for (let i = 0; i < 160; i++) {
      const isOp = i % 3 === 2;
      let n;
      if (!isOp) { const e = R.pick(stairs), reg = e.reg | 0, t = window.__De[reg]; n = { sub: true, ent: e, enc: e.enc, reg, lvl: 10, mods: [], theme: null, obj: 'sub', pool: t, seed: R.int(1, 1e9) }; }
      else { const reg = R.int(0, 8), t = window.__De[reg]; n = { seed: R.int(1, 1e9), theme: R.pick(['ruinas', 'bunker', 'laboratorio', 'fabrica', 'caverna', 'magma', 'colmena']), lvl: 12, obj: 'data', mods: [], reg, pool: t, boss: 'garra', nestSpawn: 'rastrero' }; }
      window.__seedRng(1000 + i); const a0 = [P.probe(), P.probe(), P.probe()];
      const m0 = isOp ? P.rawOp(n) : P.rawSub(n);
      window.__seedRng(1000 + i); const m1 = isOp ? P.wrapOp(n) : P.wrapSub(n); const a1 = [P.probe(), P.probe(), P.probe()];
      out.n++;
      const pz = m1.ents.find((e) => e.k === 'puzzle');
      pz && out.conAcertijo++;
      if (arr(m0.ter) === arr(m1.ter)) out.terIguales++; else out.malos.push('ter ' + i);
      if (arr(m0.reg) === arr(m1.reg) && arr(m0.dark) === arr(m1.dark) && arr(m0.wh) === arr(m1.wh)) out.regIguales++; else out.malos.push('reg ' + i);
      const skip0 = () => false, skip1 = (e) => e.k === 'puzzle' || (e.id && String(e.id).endsWith('_l') && String(e.id).startsWith('pz_'));
      if (entsH(m0, skip0) === entsH(m1, skip1)) out.entsIguales++; else out.malos.push('ents ' + i);
      if (JSON.stringify(a0) === JSON.stringify(a1)) out.rngIgual++; else out.malos.push('rng ' + i);
      if (!pz) { if (arr(m0.blk) === arr(m1.blk) && m0.props.length === m1.props.length && m0.decor.length === m1.decor.length) { out.propsSoloEnRect++; out.blkSoloEnRect++; } else out.malos.push('sinpz-dif ' + i); continue; }
      // con acertijo: las únicas diferencias de props/blk/decorado están dentro de su rectángulo (+ anillo)
      const d = pz.pz, inR = (x, z) => x >= d.x0 - 1 && x < d.x0 + d.W + 1 && z >= d.z0 - 1 && z < d.z0 + d.H + 1;
      const sig = (p) => Math.round(p.x * 100) + ',' + Math.round(p.z * 100) + ',' + p.t;
      const s1 = new Set(m1.props.map(sig)); let okP = true;
      for (const p of m0.props) if (!s1.has(sig(p)) && !inR(Math.floor(p.x), Math.floor(p.z))) okP = false;
      if (m1.props.length > m0.props.length) okP = false;
      okP ? out.propsSoloEnRect++ : out.malos.push('props ' + i);
      let okB = true; for (let k = 0; k < m0.blk.length; k++) if (m0.blk[k] !== m1.blk[k] && !inR(k % m0.w, (k / m0.w) | 0)) { okB = false; break; }
      okB ? out.blkSoloEnRect++ : out.malos.push('blk ' + i);
    }
    out.malos = out.malos.slice(0, 10);
    return out;
  });
  console.log('mazmorras ' + JSON.stringify(d));
  const ok = d.n === d.terIguales && d.n === d.regIguales && d.n === d.entsIguales && d.n === d.rngIgual && d.n === d.propsSoloEnRect && d.n === d.blkSoloEnRect && d.conAcertijo > 0;
  console.log(ok ? `PASS ${d.n} mazmorras (${d.conAcertijo} con acertijo): terreno, regiones, entidades y RNG idénticos; atrezo y bloqueos solo cambian dentro del rectángulo del acertijo` : 'FAIL las mazmorras envueltas difieren de las originales');
  if (!ok) process.exitCode = 1;
}

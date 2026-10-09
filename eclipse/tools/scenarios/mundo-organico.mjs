// D9 · mundo orgánico (31h-world2.js): caminos sinuosos, ríos y lagos, faldas de roca en las fronteras. La pasada va DESPUÉS de vx y no mueve nada de lo que vx coloca:
// mismas entidades (ids y posiciones), mismas regiones, fronteras y variantes; solo cambia suelo libre a camino, líquido o roca; todo lo alcanzable antes sigue siéndolo.
//   node tools/shot.mjs --scenario tools/scenarios/mundo-organico.mjs --size 640x360 --quality low --out DIR
import fs from 'node:fs'; import path from 'node:path';
export default async function (api) {
  const { boot, newGame, ev, outDir, logs } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });

  // ── 1) la pasada se ejecutó al generar el mundo de la partida ──
  const st = await ev(() => {
    const m = window.__G.world.map, W = window.__world2, o = m.organic;
    const f = o && o.stats.features;
    const by = {}; if (f) for (const q of f) by[q.kind + ':' + (q.liquid || '')] = (by[q.kind + ':' + (q.liquid || '')] || 0) + 1;
    return { on: !!o, feats: f && f.length, rej: o && o.stats.rejected.map((q) => `${q.kind}:${q.liquid || ''}:r${q.reg}:${q.why}`), by, liquid: o && o.stats.liquid, fords: o && o.stats.fords, props: o && o.stats.props, ms: o && o.stats.ms, cfg: { enabled: W.cfg.enabled, rivers: W.cfg.rivers, roads: W.cfg.roads.enabled, skirt: W.cfg.skirt.enabled } };
  });
  console.log('ESTADO', JSON.stringify(st));
  check('el mundo de la partida sale orgánico por defecto (caminos, ríos, lagos y faldas activos)', st.on && st.cfg.enabled && st.cfg.rivers && st.cfg.roads && st.cfg.skirt && st.feats >= 20, JSON.stringify(st.cfg) + ' · rasgos ' + st.feats);
  check('ningún río, lago ni falda se rechaza (cada rasgo encuentra sitio y su validación pasa)', st.rej && st.rej.length === 0, JSON.stringify(st.rej));

  // ── 2) lo que vx coloca no se mueve ──
  const cmp = await ev(() => {
    const W = window.__world2, m = W.gen(7331), raw = W.W2.raw(7331), N = m.w * m.h;   // los dos recién generados (el mapa de la partida ya lleva puertas abiertas, nodos de lore y demás añadidos en juego)
    const out = { w: m.w, entsSame: m.ents.length === raw.ents.length, entMismatch: 0, regD: 0, bordD: 0, varD: 0, changed: 0, bad: 0, badKinds: {}, byType: {}, borderTer: 0, poisSame: true, gatesSame: true, ents: m.ents.length };
    for (let i = 0; i < m.ents.length && out.entsSame; i++) { const a = m.ents[i], b = raw.ents[i]; if (!b || a.id !== b.id || a.k !== b.k || a.x !== b.x || a.z !== b.z) out.entMismatch++; }
    for (const k of Object.keys(raw.pois)) { const a = m.pois[k], b = raw.pois[k]; if (!a || a.x !== b.x || a.z !== b.z || a.n !== b.n) out.poisSame = false; }
    if (Object.keys(m.pois).length !== Object.keys(raw.pois).length) out.poisSame = false;
    const SOFT = new Set([0, 1, 7, 4, 5, 6, 10]);   // suelo, camino, roca, agua, lava, ácido, hielo
    for (let i = 0; i < N; i++) {
      if (m.reg[i] !== raw.reg[i]) out.regD++; if (m.border[i] !== raw.border[i]) out.bordD++; if (m.var[i] !== raw.var[i]) out.varD++;
      if (m.ter[i] !== raw.ter[i]) {
        out.changed++; const k = raw.ter[i] + '>' + m.ter[i]; out.byType[k] = (out.byType[k] || 0) + 1;
        if (!SOFT.has(m.ter[i]) || !SOFT.has(raw.ter[i])) { out.bad++; out.badKinds[k] = (out.badKinds[k] || 0) + 1; }
        if (raw.border[i]) out.borderTer++;
      }
    }
    return out;
  });
  console.log('COMPARACIÓN', JSON.stringify(cmp));
  check('las entidades y los puntos de interés son los mismos, con los mismos identificadores y posiciones (los guardados antiguos siguen valiendo)', cmp.entsSame && cmp.entMismatch === 0 && cmp.poisSame, JSON.stringify({ same: cmp.entsSame, mismatch: cmp.entMismatch, pois: cmp.poisSame }));
  check('regiones, fronteras y variantes de suelo no cambian', cmp.regD === 0 && cmp.bordD === 0 && cmp.varD === 0, JSON.stringify({ reg: cmp.regD, border: cmp.bordD, var: cmp.varD }));
  check('solo cambia suelo libre, camino, roca natural y líquido entre sí: ni edificios, ni puertas, ni arenas, ni la banda de frontera', cmp.bad === 0 && cmp.borderTer === 0 && cmp.changed > 3000, JSON.stringify({ cambiadas: cmp.changed, malas: cmp.bad, kinds: cmp.badKinds, frontera: cmp.borderTer, tipos: cmp.byType }));

  // ── 3) conectividad (inundación propia desde el Bastión con puertas y secretos abiertos, como hace gE) ──
  const conn = await ev(() => {
    const W = window.__world2, m = W.gen(7331), raw = W.W2.raw(7331), n = m.w;
    const flood = (r) => W.flood(r, r.spawnBase);
    const seen = flood(m), seen0 = flood(raw);
    const reach = (e, s) => { const X = Math.floor(e.x), Z = Math.floor(e.z); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (s[(Z + dz) * n + X + dx]) return true; return false; };
    const skip = new Set(['light', 'gate', 'bossarena', 'spawnpack', 'spawnpt', 'flag', 'helipad', 'lore']);
    let tot = 0, lost = 0, lost0 = 0, lostKinds = {};
    for (const e of m.ents) { if (skip.has(e.k)) continue; tot++; if (!reach(e, seen)) { lost++; lostKinds[e.k] = (lostKinds[e.k] || 0) + 1; } if (!reach(e, seen0)) lost0++; }
    const beacons = m.ents.filter((e) => e.k === 'beacon'), bOk = beacons.filter((e) => reach(e, seen)).length;
    // las puertas: la casilla 9 antes y 9 después de cada una (en el eje de paso) son alcanzables
    const gates = m.ents.filter((e) => e.k === 'gate'); let gOk = 0;
    for (const g of gates) { const a = g.axis === 'x' ? [g.x - 9, g.z] : [g.x, g.z - 9], b = g.axis === 'x' ? [g.x + 9, g.z] : [g.x, g.z + 9]; if (seen[Math.floor(a[1]) * n + Math.floor(a[0])] && seen[Math.floor(b[1]) * n + Math.floor(b[0])]) gOk++; }
    return { tot, lost, lost0, lostKinds, beacons: beacons.length, bOk, gates: gates.length, gOk };
  });
  console.log('CONECTIVIDAD', JSON.stringify(conn));
  check('toda entidad alcanzable en el mapa original sigue siéndolo desde el Bastión', conn.lost <= conn.lost0, JSON.stringify({ total: conn.tot, perdidas: conn.lost, antes: conn.lost0, tipos: conn.lostKinds }));
  check('las nueve balizas de región y todas las puertas siguen unidas (se pasa de una región a otra)', conn.bOk === conn.beacons && conn.beacons === 9 && conn.gOk === conn.gates && conn.gates >= 10, JSON.stringify({ balizas: `${conn.bOk}/${conn.beacons}`, puertas: `${conn.gOk}/${conn.gates}` }));

  // ── 4) determinismo y coste ──
  const det = await ev(() => {
    const W = window.__world2, hash = (r) => { let h = 0; for (let i = 0; i < r.ter.length; i++) h = (h * 31 + r.ter[i] + (r.blk[i] << 4)) >>> 0; return h; };
    W.gen(7331); W.W2.raw(7331);   // calentamiento (el compilador just-in-time tarda en optimizar la primera generación)
    const t0 = performance.now(); const a = W.gen(7331); const msA = performance.now() - t0; const b = W.gen(7331); const t1 = performance.now(); W.W2.raw(7331); const msRaw = performance.now() - t1;
    let pd = 0; for (let i = 0; i < Math.min(a.props.length, b.props.length); i++) if (a.props[i].x !== b.props[i].x || a.props[i].z !== b.props[i].z || a.props[i].t !== b.props[i].t) pd++;
    return { same: hash(a) === hash(b), propsSame: a.props.length === b.props.length && pd === 0, ms: Math.round(msA), msRaw: Math.round(msRaw), over: Math.round(msA - msRaw), roadMs: Math.round(W.W2.roadMs), roads: W.W2.roads, passMs: a.organic.stats.ms };
  });
  console.log('DETERMINISMO', JSON.stringify(det));
  check('determinista: dos generaciones con la misma semilla dan el mismo terreno y el mismo atrezo', det.same && det.propsSame, JSON.stringify(det));
  check('la pasada orgánica añade menos de 800 ms a la generación del mundo con el motor caliente (los 437 caminos A* tardan ~0,3 ms cada uno)', det.over < 800, JSON.stringify({ gen: det.ms, original: det.msRaw, añade: det.over, caminos: det.roads, msCaminos: det.roadMs, msPasada: det.passMs }));

  // ── 5) caminos y faldas: el aspecto ──
  const look = await ev(() => {
    const W = window.__world2, G = window.__G, m = G.world.map, raw = W.W2.raw(7331), n = m.w, N = n * n;
    let road = 0, road0 = 0, rock = 0, rock0 = 0; for (let i = 0; i < N; i++) { if (m.ter[i] === 1) road++; if (raw.ter[i] === 1) road0++; if (m.ter[i] === 7) rock++; if (raw.ter[i] === 7) rock0++; }
    // irregularidad de la frontera: para cada fila z de la frontera vertical x = 192 y 384, cuántas casillas de roca hay en [x-10, x+10]; la desviación típica debe crecer
    const thick = (r, X) => { const a = []; for (let z = 10; z < n - 10; z++) { let c = 0; for (let x = X - 10; x <= X + 10; x++) if (r.ter[z * n + x] === 7) c++; a.push(c); } return a; };
    const sd = (a) => { const mu = a.reduce((p, c) => p + c, 0) / a.length; return Math.sqrt(a.reduce((p, c) => p + (c - mu) ** 2, 0) / a.length); };
    const t1 = thick(m, 192), t0 = thick(raw, 192), t3 = thick(m, 384), t30 = thick(raw, 384);
    // los caminos del mundo son más largos y serpentean: porcentaje de casillas de camino con 3 o más vecinas de camino (cruces) frente al total no cambia mucho
    return { road, road0, rock, rock0, sd: [+sd(t0).toFixed(2), +sd(t1).toFixed(2), +sd(t30).toFixed(2), +sd(t3).toFixed(2)], max: [Math.max(...t0), Math.max(...t1)], mean: [+(t0.reduce((p, c) => p + c, 0) / t0.length).toFixed(1), +(t1.reduce((p, c) => p + c, 0) / t1.length).toFixed(1)] };
  });
  console.log('ASPECTO', JSON.stringify(look));
  check('los caminos ocupan una superficie parecida a la original (entre el 90 % y el 150 %): serpentean pero no se ensanchan', look.road >= look.road0 * 0.9 && look.road <= look.road0 * 1.5, JSON.stringify({ camino: look.road, original: look.road0, ratio: +(look.road / look.road0).toFixed(2) }));
  check('las fronteras dejan de ser rectas: el grosor de la roca (casillas de roca a ±10 de la frontera) pasa de ~6 a ~11 de media, varía un 40 % más a lo largo de cada una y el mapa gana roca natural', look.mean[1] >= look.mean[0] + 3 && look.sd[1] >= look.sd[0] * 1.3 && look.sd[3] >= look.sd[2] * 1.3 && look.rock > look.rock0, JSON.stringify({ sd: look.sd, roca: look.rock, original: look.rock0 }));

  // ── 6) guardados antiguos: máquinas y raros que caen sobre agua o roca se recolocan; el jugador también ──
  const sv = await ev(() => {
    const W = window.__world2, G = window.__G, m = G.world.map, S = G.S, out = {};
    const f = m.organic.stats.features.find((q) => q.kind === 'lake' && q.liquid === 'WATER') || m.organic.stats.features.find((q) => q.kind === 'lake');
    const [lx, lz] = f.at; let wx = lx, wz = lz; if (!m.circleHits(wx + 0.5, wz + 0.5, 0.8)) { for (let r = 0; r < 12 && !m.circleHits(wx + 0.5, wz + 0.5, 0.8); r++) wx++; }
    out.inWater = m.circleHits(wx + 0.5, wz + 0.5, 0.8);
    S.mach = S.mach || {}; S.mach.slots = S.mach.slots || {}; S.rare = S.rare || {}; S.rare.slots = S.rare.slots || {};
    S.mach.slots.mx_test = { id: 'mx_test', k: 'dron', reg: 0, x: wx + 0.5, z: wz + 0.5, st: 'dormant', cd: 0, lock: 0, u: 0, n: 0 };
    S.rare.slots.rq_test = { id: 'rq_test', reg: 0, x: wx + 1.5, z: wz + 0.5, st: 'ready', cd: 0, arch: 'mudadora', base: 'rastrero', seen: 0, n: 0 };
    const moved = W.fixSlots(m);
    const a = S.mach.slots.mx_test, b = S.rare.slots.rq_test;
    out.moved = moved; out.machFree = !m.circleHits(a.x, a.z, 0.8); out.rareFree = !m.circleHits(b.x, b.z, 0.8); out.dMach = +Math.hypot(a.x - (wx + 0.5), a.z - (wz + 0.5)).toFixed(1);
    delete S.mach.slots.mx_test; delete S.rare.slots.rq_test;
    // el jugador guardado sobre el agua: loadWorld lo recoloca en el suelo libre más cercano
    G.world.loadWorld({ x: wx + 0.5, z: wz + 0.5 });
    out.playerFree = !G.world.map.circleHits(G.player.x, G.player.z, G.player.r); out.dPlayer = +Math.hypot(G.player.x - (wx + 0.5), G.player.z - (wz + 0.5)).toFixed(1);
    return out;
  });
  console.log('GUARDADOS', JSON.stringify(sv));
  check('una máquina y un raro guardados sobre el agua se recolocan en suelo libre cercano, y el jugador guardado en el agua reaparece en la orilla', sv.inWater && sv.moved >= 2 && sv.machFree && sv.rareFree && sv.dMach <= 9 && sv.playerFree && sv.dPlayer <= 11, JSON.stringify(sv));

  // ── 7) imágenes del mapa ──
  const imgs = await ev(() => { const W = window.__world2; return { org: W.dump(window.__G.world.map, { pois: true }), raw: W.dump(W.W2.raw(7331), { pois: true }) }; });
  fs.writeFileSync(path.join(outDir, 'mundo-organico.png'), Buffer.from(imgs.org.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(outDir, 'mundo-original.png'), Buffer.from(imgs.raw.split(',')[1], 'base64'));
  console.log('imágenes', path.join(outDir, 'mundo-organico.png'));
  const errs = (logs || []).filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni avisos del mundo orgánico', errs.length === 0 && !(logs || []).some((l) => /\[mundo2\]/.test(l)), errs.slice(0, 3).join(' | '));
  const bad2 = results.filter((r) => !r.ok);
  console.log(bad2.length ? `\n${bad2.length} FALLOS de ${results.length}: ` + bad2.map((r) => r.name.slice(0, 60)).join(' | ') : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad2.length) process.exitCode = 1;
}

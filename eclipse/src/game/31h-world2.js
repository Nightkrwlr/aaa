// 31h-world2.js — Mundo orgánico (D9)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// El mundo dejaba de ser un tablero: 3×3 regiones cuadradas de 192 casillas separadas por rectas de roca. Este frente le da forma de verdad
// SIN tocar el generador original (17-worldgen.js, `vx`): se ejecuta DESPUÉS de él, como un repaso, con su propio ruido y su propio RNG sembrados
// con la semilla del mapa (no consume el RNG del juego ni el del mundo). Todo lo que `vx` coloca (edificios, entidades, caminos, fronteras, puertas,
// cofres, nidos…) queda EXACTAMENTE donde estaba y con los mismos identificadores: los guardados antiguos siguen valiendo y `mapV` no cambia.
//
//   · ríos, canales y lagos de cada región con su propio líquido (agua, ácido, hielo, lava), de trazado sinuoso (A* con ruido) que rodea todo lo construido;
//   · barrancos y acantilados con pasos; fronteras rotas (afloramientos de roca contra el muro recto entre regiones);
//   · caminos serpenteantes entre los puntos de interés, bosques con claros y bosquetes;
//   · lugares con historia (gasolinera, motel, escuela, iglesia…), cada uno un punto de interés con nombre, botín y hallazgo.
//
// Cada rasgo se aplica con un DIARIO de cambios y se VALIDA con una inundación desde el Bastión (las entidades alcanzables antes siguen siéndolo; si un
// rasgo corta el camino se tiende un VADO o PUENTE por donde cuesta menos y, si aun así no sirve, se deshace entero). Como el mapa es el mismo para todos
// los jugadores (semilla 7331), el resultado es determinista. Ajustes en x.cfg.world2; pruebas en window.__world2.

x.cfg.world2 = {
  v: 1,
  enabled: true, // interruptor general de la pasada orgánica (con false el mundo sale exactamente como lo deja 17-worldgen)
  rivers: true, // ríos y lagos de `plan`
  salt: 9101, // se suma a la semilla del mapa para el ruido y el RNG de este frente
  margin: 3, // los rasgos no se acercan a menos de 3 casillas del borde de su región (la frontera de roca y sus puertas quedan intactas)
  gateClear: [14, 6], // corredor de cada puerta que no se toca: casillas a lo largo del eje y a cada lado
  baseClear: 26, // radio alrededor del Bastión que no se toca
  // radio que se respeta alrededor de cada entidad (el resto de entidades usa `def`); los puntos de interés (campamentos, asentamientos, guaridas…)
  // se respetan enteros más `poiClear` casillas
  entClear: { def: 2.6, light: 0.9, nest: 2.2, crystal: 2, crate: 1.8, datapad: 1.8, shrine: 2.2, spawnpt: 1.2, spawnpack: 1.8, chest: 2.2, lockbox: 2.2, terminal: 2.8, stairs: 3, breach: 3.5, campfire: 3.5, beacon: 4.5, gate: 0, bossarena: 0 },
  poiClear: 1.5,
  // caminos sinuosos: sustituyen a los caminos rectos con un solo quiebro de 17-worldgen (mE). Buscan su trazado con A* sobre un coste con ruido: rodean lagos, rocas y edificios,
  // aprovechan los caminos que ya hay y serpentean. Siempre unen los mismos extremos (el resto del mundo no se mueve)
  roads: { enabled: true, margin: 26, amp: 2.4, noiseK: 0.05, hw: 1.15, smooth: 3, rad: [1.05, 1.5], cost: { ground: 1, road: 0.35, rock: 14, liquid: 11, ice: 2, blk: 30, other: 40, wall: 200 } },
  // faldas de las fronteras: la roca natural crece junto a la banda de frontera hasta `max` casillas, con un alcance que varía con el ruido (lóbulos y bahías): la frontera deja de ser una recta
  skirt: { enabled: true, max: 7, k: 0.045, pow: 1.4, jag: 0.9 },
  // plan de rasgos (se aplica en este orden): reg = región, kind = river | lake, liquid = tipo de casilla, n = cuántos
  // (los líquidos ACID y ICE se pueden caminar; WATER y LAVA no: ahí el trazado y el vado importan)
  plan: [
    { reg: 0, kind: "river", liquid: "WATER", n: 1, width: [2.2, 3.6] },
    { reg: 0, kind: "lake", liquid: "WATER", n: 3, rad: [4, 8] },
    { reg: 1, kind: "river", liquid: "WATER", n: 1, width: [2, 3] },
    { reg: 1, kind: "lake", liquid: "WATER", n: 1, rad: [4, 6] },
    { reg: 2, kind: "lake", liquid: "WATER", n: 1, rad: [3, 5] },
    { reg: 3, kind: "river", liquid: "ACID", n: 2, width: [2, 3.4] },
    { reg: 3, kind: "lake", liquid: "ACID", n: 3, rad: [4, 8] },
    { reg: 4, kind: "river", liquid: "ICE", n: 1, width: [2.4, 3.6] },
    { reg: 4, kind: "lake", liquid: "ICE", n: 2, rad: [4, 8] },
    { reg: 5, kind: "lake", liquid: "ACID", n: 1, rad: [3, 5] },
    { reg: 6, kind: "river", liquid: "LAVA", n: 2, width: [2, 3] },
    { reg: 6, kind: "lake", liquid: "LAVA", n: 2, rad: [4, 7] },
    { reg: 7, kind: "lake", liquid: "ACID", n: 2, rad: [3, 6] },
    { reg: 8, kind: "river", liquid: "ACID", n: 1, width: [2, 3] },
    { reg: 8, kind: "lake", liquid: "ACID", n: 2, rad: [3, 6] },
    { reg: -1, kind: "skirt", n: 1 }, // faldas de las fronteras (al final: sobre lo que ya hay)
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 1 · Contexto: ruido, RNG propio, máscaras de «no tocar» y utilidades
// ═══════════════════════════════════════════════════════════════════════════════════════════
const W2 = { last: null, ms: 0, roadMs: 0, roads: 0 }; // última generación (estadísticas para las pruebas)
const W2_N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const W2_N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function w2Disc(n, mask, cx, cz, rad, v = 1) {
  const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(n - 1, Math.ceil(cx + rad)), z0 = Math.max(0, Math.floor(cz - rad)), z1 = Math.min(n - 1, Math.ceil(cz + rad));
  const r2 = rad * rad;
  for (let z = z0; z <= z1; z++) for (let X = x0; X <= x1; X++) if ((X + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= r2) mask[z * n + X] = v;
}

// ¿se puede cruzar esa casilla andando? (la misma regla que usa gE de 17-worldgen: las puertas y los secretos cuentan como abiertos)
const w2Pass = (r, i) => (!Ua[r.ter[i]] || r.ter[i] === F.GATE || r.ter[i] === F.SECRET) && !r.blk[i];

function w2Ctx(r, seed) {
  const C = x.cfg.world2, n = r.w, N = n * n, s = (seed ^ (C.salt * 2654435761)) >>> 0;
  const ctx = {
    r, n, N, C, seed,
    noise: Ii(s + 11), noise2: Ii(s + 29),
    rng: pi(s + 7),
    forb: new Uint8Array(N), // 1 = no se puede pintar ni atravesar con un rasgo
    bridge: new Uint8Array(N), // 1 = camino o puerta: el trazado puede cruzarlo, pero no se pinta (queda como puente)
    dist: null, // distancia a lo prohibido (para los lagos)
    journal: null,
    stats: { features: [], rejected: [], liquid: 0, rock: 0, road: 0, props: 0, fords: 0 },
    crit: [],
  };
  const forb = ctx.forb, bridge = ctx.bridge;
  // 1) lo construido (suelos, muros, puertas, arenas, cuevas…) y su halo de 1 casilla; los caminos y puertas se pueden cruzar (puente); los líquidos que ya hay se funden
  const halo = (i, rad) => { const X = i % n, z = (i / n) | 0; for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) { const qx = X + dx, qz = z + dz; if (qx >= 0 && qx < n && qz >= 0 && qz < n) forb[qz * n + qx] = 1; } };
  for (let i = 0; i < N; i++) {
    const t = r.ter[i];
    if (t === F.GROUND) continue;
    if (t === F.ROAD || t === F.GATE) bridge[i] = 1;
    else if (t === F.WATER || t === F.LAVA || t === F.ACID || t === F.ICE) continue;
    else if (t === F.ROCK) { if (!r.border[i]) forb[i] = 1; } // la roca natural se rodea; la frontera lleva su colchón más abajo (las faldas de las fronteras sí pueden pisarlo)
    else halo(i, 1);
  }
  // 2) atrezo de estructura (el que `vx` coloca a propósito, justo en el centro de la casilla, o los prefabricados `big`): ellos y un halo.
  //    Los árboles, rocas y arbustos del reparto natural NO prohíben nada: se quitan bajo lo que se pinte.
  for (const p of r.props) {
    if (!p.blk) continue;
    if (p.big) { const d = fE[p.t] || [4, 4]; w2Disc(n, forb, p.x, p.z, Math.max(d[0], d[1]) / 2 + 1.5); continue; }
    if (Math.abs(p.x - Math.floor(p.x) - 0.5) < 1e-6 && Math.abs(p.z - Math.floor(p.z) - 0.5) < 1e-6) w2Disc(n, forb, p.x, p.z, 1.6);
  }
  // 3) entidades, puntos de interés, Bastión
  for (const e of r.ents) { const rad = C.entClear[e.k] ?? C.entClear.def; rad > 0 && w2Disc(n, forb, e.x, e.z, rad); }
  for (const k in r.pois) { const p = r.pois[k]; w2Disc(n, forb, p.x, p.z, (p.r || 4) + C.poiClear); }
  const b = r.pois.base; b && w2Disc(n, forb, b.x, b.z, C.baseClear);
  // 4) colchón de la frontera (arriba) y de las puertas; márgenes de región; corredores de las puertas
  for (const g of r.ents) if (g.k === "gate") {
    const along = C.gateClear[0], side = C.gateClear[1];
    for (let a = -along; a <= along; a++) for (let q = -side; q <= side; q++) {
      const X = Math.floor(g.axis === "x" ? g.x + a : g.x + q), z = Math.floor(g.axis === "x" ? g.z + q : g.z + a);
      X >= 0 && X < n && z >= 0 && z < n && (forb[z * n + X] = 1);
    }
  }
  // las faldas de las fronteras (roca que crece junto a la banda de frontera) respetan todo lo anterior pero no el colchón de la frontera ni los márgenes de región
  ctx.fsk = forb.slice();
  for (let i = 0; i < N; i++) if (r.border[i] && r.ter[i] === F.ROCK) halo(i, 2); // colchón de 2 casillas alrededor de la frontera para ríos y lagos
  for (const reg of De) { // margen interior de cada región
    const x0 = reg.gx * qt, z0 = reg.gz * qt, m = C.margin;
    for (let z = z0; z < z0 + qt; z++) for (let X = x0; X < x0 + qt; X++) if (X < x0 + m || X >= x0 + qt - m || z < z0 + m || z >= z0 + qt - m) forb[z * n + X] = 1;
  }
  // 5) puntos críticos: lo que tiene que seguir siendo alcanzable desde el Bastión (todas las entidades menos las que `gE` ya ignora)
  for (const e of r.ents) if (!["light", "gate", "bossarena", "spawnpack", "spawnpt", "flag", "helipad", "lore"].includes(e.k)) ctx.crit.push([e.x, e.z]);
  return ctx;
}

// distancia (en casillas, tope 26) de cada casilla a la más cercana prohibida (BFS multi-origen)
function w2DistField(ctx) {
  if (ctx.dist) return ctx.dist;
  const { n, N, forb } = ctx, d = new Uint8Array(N).fill(255), q = new Int32Array(N);
  let h = 0, t = 0;
  for (let i = 0; i < N; i++) if (forb[i]) { d[i] = 0; q[t++] = i; }
  while (h < t) {
    const i = q[h++], X = i % n, z = (i / n) | 0, nd = d[i] + 1;
    if (nd > 26) continue;
    for (const [dx, dz] of W2_N4) { const qx = X + dx, qz = z + dz; if (qx < 0 || qx >= n || qz < 0 || qz >= n) continue; const j = qz * n + qx; if (d[j] > nd) { d[j] = nd; q[t++] = j; } }
  }
  return (ctx.dist = d);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2 · Diario de cambios (para deshacer un rasgo entero) y pintura
// ═══════════════════════════════════════════════════════════════════════════════════════════
function w2Begin(ctx) { ctx.journal = { idx: [], old: [], oblk: [], props: null, decor: null }; return ctx.journal; }
// pinta una casilla de suelo libre (o ya líquida) con `t`; las prohibidas y los puentes no se tocan
function w2Paint(ctx, i, t, mask) {
  if ((mask || ctx.forb)[i] || ctx.bridge[i]) return false;
  const cur = ctx.r.ter[i];
  if (cur === t) return false;
  if (cur !== F.GROUND && cur !== F.WATER && cur !== F.ACID && cur !== F.LAVA && cur !== F.ICE) return false;
  const j = ctx.journal;
  j.idx.push(i); j.old.push(cur); j.oblk.push(ctx.r.blk[i]);
  ctx.r.ter[i] = t; ctx.r.blk[i] = 0; // el árbol o la roca que hubiera ahí se quita (w2CleanProps)
  return true;
}
function w2Rollback(ctx, j) {
  for (let k = j.idx.length - 1; k >= 0; k--) { ctx.r.ter[j.idx[k]] = j.old[k]; ctx.r.blk[j.idx[k]] = j.oblk[k]; }
  if (j.props) ctx.r.props = j.props;
  if (j.decor) ctx.r.decor = j.decor;
}
// quita el atrezo (árboles, hierba, rocas…) que quedó bajo lo recién pintado (se guardan las listas originales por si hay que deshacer)
function w2CleanProps(ctx, j) {
  const r = ctx.r, n = ctx.n;
  if (!j.idx.length) return 0;
  const hit = (p) => { const t = r.ter[Math.floor(p.z) * n + Math.floor(p.x)]; return t === F.WATER || t === F.LAVA || t === F.ROCK || t === F.ACID || t === F.ICE; };
  const painted = new Set(j.idx);
  const on = (p) => painted.has(Math.floor(p.z) * n + Math.floor(p.x));
  j.props = r.props; j.decor = r.decor;
  const np = r.props.filter((p) => !(on(p) && hit(p))), nd = r.decor.filter((p) => !(on(p) && hit(p)));
  const removed = r.props.length - np.length + (r.decor.length - nd.length);
  r.props = np; r.decor = nd;
  return removed;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 3 · Validación: inundación desde el Bastión y vados
// ═══════════════════════════════════════════════════════════════════════════════════════════
function w2Flood(r, from) {
  const n = r.w, N = n * r.h, seen = new Uint8Array(N), q = new Int32Array(N);
  let h = 0, t = 0;
  const s0 = Math.floor(from[1]) * n + Math.floor(from[0]);
  seen[s0] = 1; q[t++] = s0;
  while (h < t) {
    const i = q[h++], X = i % n;
    if (X > 0 && !seen[i - 1] && w2Pass(r, i - 1)) { seen[i - 1] = 1; q[t++] = i - 1; }
    if (X < n - 1 && !seen[i + 1] && w2Pass(r, i + 1)) { seen[i + 1] = 1; q[t++] = i + 1; }
    if (i >= n && !seen[i - n] && w2Pass(r, i - n)) { seen[i - n] = 1; q[t++] = i - n; }
    if (i < N - n && !seen[i + n] && w2Pass(r, i + n)) { seen[i + n] = 1; q[t++] = i + n; }
  }
  return seen;
}
// ¿es alcanzable la entidad? (alguna de las 3×3 casillas de alrededor lo es, igual que en gE)
function w2Reachable(r, seen, px, pz) {
  const X = Math.floor(px), z = Math.floor(pz);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (r.inb(X + dx, z + dz) && seen[(z + dz) * r.w + X + dx]) return true;
  return false;
}
function w2Unreachable(ctx, seen) {
  const out = [];
  for (let k = 0; k < ctx.crit.length; k++) { const c = ctx.crit[k]; w2Reachable(ctx.r, seen, c[0], c[1]) || out.push(k); }
  return out;
}
// tiende un vado/puente (casillas de ROAD) entre lo alcanzable y la entidad k por donde menos casillas pintadas hay que cruzar (0-1 BFS)
function w2Ford(ctx, j, seen, k) {
  const r = ctx.r, n = ctx.n, N = ctx.N, paintedSet = ctx.paintedSet || (ctx.paintedSet = new Set(j.idx));
  const dist = new Int16Array(N).fill(32000), prev = new Int32Array(N).fill(-1), dq = new Int32Array(N * 2 + 4);
  let hd = N, tl = N;
  const c = ctx.crit[k], s0 = Math.floor(c[1]) * n + Math.floor(c[0]);
  dist[s0] = 0; dq[tl++] = s0;
  let goal = -1;
  while (hd < tl) {
    const i = dq[hd++];
    if (seen[i] && i !== s0) { goal = i; break; }
    const X = i % n, z = (i / n) | 0, d0 = dist[i];
    for (const [dx, dz] of W2_N4) {
      const qx = X + dx, qz = z + dz;
      if (qx < 1 || qx >= n - 1 || qz < 1 || qz >= n - 1) continue;
      const q = qz * n + qx;
      if (r.border[q]) continue;
      const t = r.ter[q];
      // se cruza lo líquido pintado por este rasgo (coste 1); lo demás solo si ya se puede andar (coste 0)
      const painted = paintedSet.has(q);
      const walk = w2Pass(r, q);
      if (!walk && !painted) continue;
      const w = painted && !walk ? 1 : 0, nd = d0 + w;
      if (nd < dist[q]) { dist[q] = nd; prev[q] = i; w ? (dq[--hd] = q) : (dq[tl++] = q); }
    }
  }
  if (goal < 0) return false;
  let i = goal, made = 0;
  for (; i !== -1 && i !== s0; i = prev[i]) if (!w2Pass(r, i) && paintedSet.has(i)) { j.idx.push(i); j.old.push(r.ter[i]); j.oblk.push(r.blk[i]); r.ter[i] = F.ROAD; ctx.bridge[i] = 1; paintedSet.delete(i); made++; }
  ctx.stats.fords += made;
  return made > 0 || true;
}
// valida el rasgo en curso: las entidades alcanzables antes siguen siéndolo (se tienden vados si hace falta). true = se queda
function w2Validate(ctx, j, base0) {
  ctx.paintedSet = new Set(j.idx);
  for (let pass = 0; pass < 6; pass++) {
    const seen = w2Flood(ctx.r, ctx.start);
    const bad = w2Unreachable(ctx, seen).filter((k) => !base0.has(k));
    if (!bad.length) { ctx.paintedSet = null; return true; }
    let any = false;
    for (const k of bad.slice(0, 40)) any = w2Ford(ctx, j, seen, k) || any;
    if (!any) break;
  }
  ctx.paintedSet = null;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 4 · Trazado: A* con ruido (ríos y caminos sinuosos)
// ═══════════════════════════════════════════════════════════════════════════════════════════
// A* de 8 vecinos en la ventana `win` = [x0, z0, x1, z1] con búferes reutilizados (sin asignaciones por búsqueda: se llama ~100 veces al generar el mundo).
// `cost(i)` (i = z·ancho + x del mapa) ≥ 0,2 o Infinity; `hw` pondera la heurística (1 = óptimo, > 1 más rápido y casi igual de bueno). Devuelve una lista de casillas [x, z] o null.
const W2B = { N: 0, g: null, from: null, st: null, cl: null, stamp: 0, hk: null, hf: null };
const W2_DX = [1, -1, 0, 0, 1, -1, 1, -1],
  W2_DZ = [0, 0, 1, -1, 1, -1, -1, 1];
function w2Route(ctx, a, b, win, cost, hw = 1) {
  const n = ctx.n, x0 = win[0], z0 = win[1], x1 = win[2], z1 = win[3], W = x1 - x0 + 1, M = W * (z1 - z0 + 1);
  if (W2B.N < M) {
    W2B.N = M;
    W2B.g = new Float32Array(M);
    W2B.from = new Int32Array(M);
    W2B.st = new Uint32Array(M);
    W2B.cl = new Uint32Array(M);
    W2B.stamp = 0;
  }
  const cap = M * 8 + 16;
  if (!W2B.hk || W2B.hk.length < cap) {
    W2B.hk = new Int32Array(cap);
    W2B.hf = new Float32Array(cap);
  }
  const g = W2B.g, from = W2B.from, st = W2B.st, cl = W2B.cl, hk = W2B.hk, hf = W2B.hf, stamp = ++W2B.stamp;
  let hn = 0;
  const push = (k, f) => {
    let i = hn++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      hk[i] = hk[p];
      hf[i] = hf[p];
      i = p;
    }
    hk[i] = k;
    hf[i] = f;
  };
  const pop = () => {
    const top = hk[0];
    hn--;
    if (hn > 0) {
      const kl = hk[hn], fl = hf[hn];
      let i = 0;
      for (;;) {
        let l = 2 * i + 1;
        if (l >= hn) break;
        if (l + 1 < hn && hf[l + 1] < hf[l]) l++;
        if (hf[l] >= fl) break;
        hk[i] = hk[l];
        hf[i] = hf[l];
        i = l;
      }
      hk[i] = kl;
      hf[i] = fl;
    }
    return top;
  };
  const s0 = (a[1] - z0) * W + (a[0] - x0), e0 = (b[1] - z0) * W + (b[0] - x0), bx = b[0], bz = b[1];
  st[s0] = stamp;
  g[s0] = 0;
  from[s0] = -1;
  push(s0, 0);
  let found = false;
  while (hn > 0) {
    const k = pop();
    if (cl[k] === stamp) continue;
    cl[k] = stamp;
    if (k === e0) {
      found = true;
      break;
    }
    const X = x0 + (k % W), Z = z0 + ((k / W) | 0), gk = g[k];
    for (let d = 0; d < 8; d++) {
      const qx = X + W2_DX[d], qz = Z + W2_DZ[d];
      if (qx < x0 || qx > x1 || qz < z0 || qz > z1) continue;
      const q = (qz - z0) * W + (qx - x0);
      if (cl[q] === stamp) continue;
      const c = cost(qz * n + qx);
      if (c === Infinity) continue;
      const ng = gk + (d < 4 ? c : c * 1.414);
      if (st[q] !== stamp || ng < g[q]) {
        st[q] = stamp;
        g[q] = ng;
        from[q] = k;
        const ddx = Math.abs(qx - bx), ddz = Math.abs(qz - bz);
        push(q, ng + hw * (ddx + ddz - 0.586 * Math.min(ddx, ddz)));
      }
    }
  }
  if (!found) return null;
  const path = [];
  for (let k = e0; k !== -1; k = from[k]) path.push([x0 + (k % W), z0 + ((k / W) | 0)]);
  return path.reverse();
}
// suaviza una línea de casillas (media móvil que conserva los extremos) y la devuelve densificada cada ~0,4 casillas
function w2Smooth(path, passes = 3) {
  let p = path.map((q) => [q[0] + 0.5, q[1] + 0.5]);
  for (let it = 0; it < passes; it++) { const o = [p[0]]; for (let i = 1; i < p.length - 1; i++) o.push([(p[i - 1][0] + 2 * p[i][0] + p[i + 1][0]) / 4, (p[i - 1][1] + 2 * p[i][1] + p[i + 1][1]) / 4]); o.push(p[p.length - 1]); p = o; }
  const out = [];
  for (let i = 0; i < p.length - 1; i++) { const d = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]), m = Math.max(1, Math.ceil(d / 0.4)); for (let k = 0; k < m; k++) out.push([p[i][0] + ((p[i + 1][0] - p[i][0]) * k) / m, p[i][1] + ((p[i + 1][1] - p[i][1]) * k) / m]); }
  out.push(p[p.length - 1]);
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 5 · Rasgos: ríos y lagos
// ═══════════════════════════════════════════════════════════════════════════════════════════
const w2Liq = (name) => F[name];

// extremo de un río: una casilla libre y sin prohibiciones cerca del borde `side` (0 O, 1 E, 2 N, 3 S) de la región, a una posición `t` (0-1) a lo largo
function w2Endpoint(ctx, reg, side, t) {
  const R = De[reg], n = ctx.n, x0 = R.gx * qt, z0 = R.gz * qt, m = ctx.C.margin + 1;
  for (let off = 0; off < 40; off++) for (const dt of [0, 8, -8, 16, -16, 24, -24]) {
    const u = Math.round(m + 12 + (qt - 2 * (m + 12)) * Math.min(0.95, Math.max(0.05, t)) + dt);
    const X = side === 0 ? x0 + m + off : side === 1 ? x0 + qt - 1 - m - off : x0 + u, z = side === 2 ? z0 + m + off : side === 3 ? z0 + qt - 1 - m - off : z0 + u;
    if (X < x0 + m || X >= x0 + qt - m || z < z0 + m || z >= z0 + qt - m) continue;
    const i = z * n + X;
    if (!ctx.forb[i] && !ctx.bridge[i]) return [X, z];
  }
  return null;
}
function w2River(ctx, spec) {
  const { n, r, rng, noise } = ctx, R = De[spec.reg], liq = w2Liq(spec.liquid), j = ctx.journal;
  const x0 = R.gx * qt, z0 = R.gz * qt, win = [x0 + 1, z0 + 1, x0 + qt - 2, z0 + qt - 2];
  const sides = [[0, 1], [2, 3], [1, 0], [3, 2]][rng.int(0, 3)];
  const a = w2Endpoint(ctx, spec.reg, sides[0], rng()), b = w2Endpoint(ctx, spec.reg, sides[1], rng());
  if (!a || !b) return false;
  const amp = 7;
  const path = w2Route(ctx, a, b, win, (i) => {
    if (ctx.forb[i]) return Infinity;
    const X = i % n, z = (i / n) | 0;
    const t = r.ter[i];
    if (t === F.ROCK) return Infinity;
    return 1 + amp * (noise.fbm(X * 0.045, z * 0.045, 3) + 0.5) ** 2 + (ctx.bridge[i] ? 0.2 : 0);
  });
  if (!path || path.length < 30) return false;
  const line = w2Smooth(path), wmin = spec.width[0], wmax = spec.width[1];
  let painted = 0;
  for (let k = 0; k < line.length; k++) {
    const [px, pz] = line[k];
    const w = wmin + (wmax - wmin) * (noise(k * 0.02, 3.3) + 0.5), rad = w / 2;
    for (let dz = -Math.ceil(rad); dz <= Math.ceil(rad); dz++) for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) {
      const X = Math.floor(px) + dx, z = Math.floor(pz) + dz;
      if (X < 0 || X >= n || z < 0 || z >= n) continue;
      if ((X + 0.5 - px) ** 2 + (z + 0.5 - pz) ** 2 <= rad * rad && w2Paint(ctx, z * n + X, liq)) painted++;
    }
  }
  const mid = line[line.length >> 1];
  return painted > 20 ? { length: line.length, painted, at: [Math.round(mid[0]), Math.round(mid[1])] } : false;
}
function w2Lake(ctx, spec) {
  const { n, r, rng, noise } = ctx, R = De[spec.reg], liq = w2Liq(spec.liquid), d = w2DistField(ctx);
  const x0 = R.gx * qt, z0 = R.gz * qt, rad = spec.rad[0] + rng() * (spec.rad[1] - spec.rad[0]);
  for (let tries = 0; tries < 400; tries++) {
    const cx = x0 + rng.int(12, qt - 13), cz = z0 + rng.int(12, qt - 13), i = cz * n + cx;
    if (ctx.forb[i] || d[i] < rad + 4) continue;
    let painted = 0;
    for (let dz = -Math.ceil(rad * 1.5); dz <= Math.ceil(rad * 1.5); dz++) for (let dx = -Math.ceil(rad * 1.5); dx <= Math.ceil(rad * 1.5); dx++) {
      const X = cx + dx, z = cz + dz;
      if (X < 0 || X >= n || z < 0 || z >= n) continue;
      const rr = rad * (0.8 + 0.7 * (noise.fbm(X * 0.16, z * 0.16, 2) + 0.5) - 0.2);
      if (Math.hypot(dx, dz) <= rr && w2Paint(ctx, z * n + X, liq)) painted++;
    }
    if (painted > 12) return { cx, cz, rad: +rad.toFixed(1), painted, at: [cx, cz] };
  }
  return false;
}
// distancia (casillas, tope `max`) a la banda de frontera por 4 vecinos
function w2BorderDist(ctx, max) {
  const { n, N, r } = ctx, d = new Uint8Array(N).fill(255), q = new Int32Array(N);
  let h = 0, t = 0;
  for (let i = 0; i < N; i++) if (r.border[i]) { d[i] = 0; q[t++] = i; }
  while (h < t) {
    const i = q[h++], X = i % n, nd = d[i] + 1;
    if (nd > max) continue;
    if (X > 0 && d[i - 1] > nd) { d[i - 1] = nd; q[t++] = i - 1; }
    if (X < n - 1 && d[i + 1] > nd) { d[i + 1] = nd; q[t++] = i + 1; }
    if (i >= n && d[i - n] > nd) { d[i - n] = nd; q[t++] = i - n; }
    if (i < N - n && d[i + n] > nd) { d[i + n] = nd; q[t++] = i + n; }
  }
  return d;
}
function w2Skirt(ctx, spec) {
  const { n, N, r, noise, noise2 } = ctx, S = ctx.C.skirt, d = w2BorderDist(ctx, S.max);
  let painted = 0;
  for (let i = 0; i < N; i++) {
    const di = d[i];
    if (di === 0 || di > S.max || r.ter[i] !== F.GROUND) continue;
    const X = i % n, Z = (i / n) | 0;
    // alcance de la falda en este punto: lóbulos (ruido lento) y bordes picados (ruido rápido)
    const reach = S.max * Math.pow(Math.max(0, noise.fbm(X * S.k, Z * S.k, 2) + 0.5), S.pow) + noise2(X * 0.31, Z * 0.31) * S.jag;
    if (di <= reach && w2Paint(ctx, i, F.ROCK, ctx.fsk)) painted++;
  }
  return painted > 50 ? { painted } : false;
}
const W2_KINDS = { river: w2River, lake: w2Lake, skirt: w2Skirt };

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 6 · Pasada principal
// ═══════════════════════════════════════════════════════════════════════════════════════════
function w2Organic(r, seed) {
  const t0 = performance.now(), ctx = w2Ctx(r, seed), C = ctx.C;
  ctx.start = r.spawnBase || [r.pois.base.x, r.pois.base.z + 3];
  // las entidades que no se alcanzan ya en el mapa original no cuentan (se compara contra esa línea base)
  const base0 = new Set(w2Unreachable(ctx, w2Flood(r, ctx.start)));
  ctx.stats.base0 = base0.size;
  for (const spec of C.plan) for (let n = 0; n < spec.n; n++) {
    if (spec.kind === "skirt" ? !C.skirt.enabled : C.rivers === false) continue;
    const f = { kind: spec.kind, reg: spec.reg, liquid: spec.liquid, n };
    const j = w2Begin(ctx);
    let info = false;
    try { info = W2_KINDS[spec.kind](ctx, spec); } catch (err) { console.warn("[mundo2]", spec.kind, err); }
    if (!info || !j.idx.length) { w2Rollback(ctx, j); ctx.stats.rejected.push({ ...f, why: info ? "vacío" : "sin sitio" }); continue; }
    const forks0 = ctx.stats.fords;
    if (!w2Validate(ctx, j, base0)) { w2Rollback(ctx, j); ctx.stats.rejected.push({ ...f, why: "cortaba el camino" }); ctx.stats.fords = forks0; continue; }
    const rm = w2CleanProps(ctx, j);
    ctx.stats.props += rm;
    ctx.stats.liquid += j.idx.length;
    ctx.stats.features.push({ ...f, tiles: j.idx.length, props: rm, ...info });
  }
  ctx.stats.ms = Math.round(performance.now() - t0);
  W2.last = ctx.stats; W2.ctx = null;
  r.organic = { v: 1, stats: ctx.stats };
  return r;
}
// ══════════════════════════════════════════════════════════════════════════════════
// 6 · Caminos sinuosos
// ══════════════════════════════════════════════════════════════════════════════════
// mE(mapa, A, B, rng, s) dibuja un camino entre dos puntos con una polilínea de dos tramos y 2 casillas de ancho. Se envuelve: se consumen las MISMAS dos tiradas del RNG de vx
// (así todo lo que se coloca después, entidades y atrezo, queda exactamente donde estaba) y el trazado sale de un A* con ruido. Si algo falla se pinta el camino original
// reproduciendo esas dos tiradas.
function w2DrawRoad(r, A, B, s0) {
  const C = x.cfg.world2, R = C.roads, K = R.cost, n = r.w;
  const noise = r.__w2n || (r.__w2n = Ii(r.seed + C.salt + 3));
  const ax = Math.floor(A[0]), az = Math.floor(A[1]), bx = Math.floor(B[0]), bz = Math.floor(B[1]);
  const m = R.margin, win = [Math.max(1, Math.min(ax, bx) - m), Math.max(1, Math.min(az, bz) - m), Math.min(n - 2, Math.max(ax, bx) + m), Math.min(n - 2, Math.max(az, bz) + m)];
  const ter = r.ter, blk = r.blk, border = r.border, kk = R.noiseK, amp = R.amp;
  const cost = (i) => {
    if (border[i]) return Infinity;
    const t = ter[i];
    let c;
    if (t === F.GROUND) c = blk[i] ? K.blk : K.ground;
    else if (t === F.ROAD || t === F.GATE) c = K.road;
    else if (t === F.ROCK) c = K.rock;
    else if (t === F.WATER || t === F.LAVA || t === F.ACID) c = K.liquid;
    else if (t === F.ICE) c = K.ice;
    else if (t === F.WALL) c = K.wall;
    else c = K.other;
    const X = i % n, Z = (i / n) | 0, q = noise.fbm(X * kk, Z * kk, 2) + 0.5;
    return c * (1 + amp * q * q);
  };
  const path = w2Route({ n }, [ax, az], [bx, bz], win, cost, R.hw);
  if (!path || path.length < 2) return false;
  const line = w2Smooth(path, R.smooth);
  line[0] = [A[0], A[1]];
  line[line.length - 1] = [B[0], B[1]];
  for (let k = 0; k < line.length; k++) {
    const px = line[k][0], pz = line[k][1], rad = R.rad[0] + (R.rad[1] - R.rad[0]) * (noise(k * 0.04, 7.7) + 0.5), c = Math.ceil(rad);
    for (let dz = -c; dz <= c; dz++)
      for (let dx = -c; dx <= c; dx++) {
        const X = Math.floor(px) + dx, Z = Math.floor(pz) + dz;
        if (X < 0 || X >= n || Z < 0 || Z >= n || (X + 0.5 - px) ** 2 + (Z + 0.5 - pz) ** 2 > rad * rad) continue;
        const i = Z * n + X;
        if (border[i]) continue;
        const t = ter[i];
        if (t === F.GROUND || t === F.ROCK || t === F.WATER || t === F.ACID || t === F.LAVA || t === F.ICE) {
          ter[i] = F.ROAD;
          blk[i] = 0;
        } else if (t === F.ROAD) blk[i] = 0;
      }
  }
  return true;
}
{
  const _mE = mE;
  mE = function (n, e, t, i, s) {
    const C = x.cfg.world2;
    if (!C || C.enabled === false || !C.roads || !C.roads.enabled) return _mE.apply(this, arguments);
    const d = [i(), i()],
      t0 = performance.now();
    let k = 0;
    try {
      if (w2DrawRoad(n, e, t, s)) {
        W2.roadMs += performance.now() - t0;
        W2.roads++;
        return;
      }
    } catch (err) {
      console.warn("[mundo2] camino sinuoso fallido; se usa el original", err);
    }
    return _mE(n, e, t, () => d[k++], s);
  };
}

{
  const _vx = vx;
  vx = function (n) {
    W2.roadMs = 0;
    W2.roads = 0;
    const r = _vx.apply(this, arguments);
    if (x.cfg.world2.enabled === false) return r;
    try { w2Organic(r, r.seed); } catch (err) { console.warn("[mundo2] la pasada orgánica falló; se usa el mapa original", err); }
    return r;
  };
  // el mapa tal y como lo deja 17-worldgen, sin ningún cambio de este frente (para comparar en las pruebas)
  W2.raw = (n = 7331) => {
    const R = x.cfg.world2.roads,
      e0 = R.enabled;
    R.enabled = false;
    try {
      return _vx(n);
    } finally {
      R.enabled = e0;
    }
  };
}

// ── volcado a imagen (pruebas y revisión visual) ─────────────────────────────────────────────────────────────────────────────
const W2_COL = {
  [F.GROUND]: [58, 74, 48], [F.ROAD]: [186, 160, 112], [F.FLOOR]: [150, 150, 150], [F.WALL]: [60, 60, 66], [F.WATER]: [40, 100, 190], [F.LAVA]: [230, 90, 20],
  [F.ACID]: [110, 200, 40], [F.ROCK]: [110, 104, 100], [F.GATE]: [255, 220, 80], [F.SECRET]: [140, 60, 140], [F.ICE]: [170, 225, 245], [F.VOID]: [0, 0, 0],
  [F.ARENA]: [160, 90, 90], [F.BASE]: [235, 235, 235], [F.DOOR]: [200, 120, 60], [F.CAVE]: [70, 50, 40],
};
W2.dump = function (map, opts = {}) {
  const r = map || (x.world && x.world.map), n = r.w, cv = document.createElement("canvas");
  cv.width = n; cv.height = n;
  const cx = cv.getContext("2d"), im = cx.createImageData(n, n), d = im.data;
  for (let i = 0; i < n * n; i++) {
    let c = W2_COL[r.ter[i]] || [255, 0, 255];
    if (r.ter[i] === F.GROUND) { const v = r.var[i] * 6 - 8; c = [c[0] + v, c[1] + v, c[2] + v]; }
    if (r.blk[i] && r.ter[i] === F.GROUND) c = [c[0] - 18, c[1] - 18, c[2] - 18];
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
  }
  cx.putImageData(im, 0, 0);
  if (opts.ents !== false) { cx.fillStyle = "#ff3050"; for (const e of r.ents) if (e.k !== "light" && e.k !== "lore") cx.fillRect(Math.floor(e.x) - 1, Math.floor(e.z) - 1, 3, 3); }
  if (opts.pois) { cx.fillStyle = "#ffffff"; for (const k in r.pois) { const p = r.pois[k]; cx.fillRect(Math.floor(p.x) - 2, Math.floor(p.z) - 2, 5, 5); } }
  return cv.toDataURL("image/png");
};
// Los guardados anteriores tienen máquinas y raros colocados sobre el mapa de antes: si ahora caen sobre agua o roca se mueven al suelo libre más cercano (el mapa nunca
// depende del guardado: la semilla y los ajustes lo deciden todo, así que el mundo es el mismo en cada sesión)
function w2FixSlots(m) {
  if (!m || m.kind !== "world" || !m.organic || !x.S) return 0;
  let n = 0;
  for (const key of ["mach", "rare"]) {
    const S = x.S[key];
    if (!S || !S.slots) continue;
    for (const id in S.slots) {
      const q = S.slots[id];
      if (!q || typeof q.x !== "number" || typeof q.z !== "number" || !m.circleHits(q.x, q.z, 0.8)) continue;
      const f = m.findFree(q.x, q.z, 8, 0.8);
      q.x = f[0];
      q.z = f[1];
      n++;
    }
  }
  W2.moved = n;
  return n;
}
{
  const _load = ih.prototype.loadWorld;
  ih.prototype.loadWorld = function () {
    const r = _load.apply(this, arguments);
    try {
      w2FixSlots(x.map);
    } catch (err) {
      console.warn("[mundo2] no se pudieron recolocar las máquinas y raros guardados", err);
    }
    return r;
  };
}
// regenera el mundo de la partida con los ajustes actuales (pruebas y exploración): borra la caché del mapa y recarga la posición del jugador
W2.reload = () => {
  Po = null;
  const p = x.player;
  x.world.loadWorld(p ? { x: p.x, z: p.z } : null);
  return x.map;
};
window.__world2 = { cfg: x.cfg.world2, W2, fixSlots: w2FixSlots, organic: (r, seed) => w2Organic(r, seed ?? r.seed), gen: (n) => vx(n), dump: W2.dump, flood: w2Flood, unreachable: (r) => { const c = w2Ctx(r, r.seed); return w2Unreachable(c, w2Flood(r, r.spawnBase)).length; }, ctx: (r) => w2Ctx(r, r.seed) };

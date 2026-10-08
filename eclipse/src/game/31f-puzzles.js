// 31f-puzzles.js — Puzles variados (D7)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Todo lo nuevo vive aquí. Ficheros antiguos: ninguno se edita (los ganchos se envuelven desde este fragmento:
// _x → pzWrapDungeon, ih.prototype.{createMesh,removeMesh,updatePrompt,interact}, Ni.finish). Nombres propios: prefijo pz / PZ.
//
// Resumen de piezas:
//   1. Datos           x.cfg.puzzles (tamaños por nivel, reparto, premios, tiempos)
//   2. Utilidades      RNG sembrado propio (no toca el del mundo), rejillas, BFS
//   3. Generadores     8 nuevos, cada uno con make(seed, nivel) + validate(spec) (prueba de que se puede resolver):
//                      espejos, cajas, placas con cronómetro, runas (orden dictado por pistas), corriente, láseres,
//                      suelo de memoria y válvulas; más los dos clásicos (switch, sequence) registrados con su validate
//   4. Registro y API  x.puzzleApi = { register, kinds, validateAll, make, validate, … } · evento 'puzzleSolved'
//   5. Guardado        S.puzzles = {id: {t, k, tier}} + S.puzzleStats + S.puzzleV (migración idempotente)
//   6. Colocación      pzWrapDungeon(_x): sala de acertijo en las mazmorras (RNG propio por hash de la semilla de la mazmorra)
//   7. Gráficos        mallas instanciadas compartidas (≤ 1 llamada de dibujo por forma y material, nunca por baldosa)
//   8. Ejecución       montaje/desmontaje por distancia, interacción (E / USAR), HUD con Reiniciar·Deshacer·Pista, premio por tier
//   9. Pruebas         window.__puzzles

// ═══ 1. DATOS ═══════════════════════════════════════════════════════════════════════════════════════
x.cfg.puzzles = {
  version: 1,
  pool: 40, // semillas distintas por tipo y nivel: validateAll() las recorre TODAS (lo que se juega sale de ahí)
  chance: 0.55, // probabilidad de sala de acertijo en una mazmorra (que no tenga ya su «cámara sellada»)
  respawnMin: 120, // minutos hasta que un acertijo resuelto vuelve a dar premio (igual que los cofres)
  tierByLvl: [
    [0, 1],
    [10, 2],
    [22, 3],
  ], // nivel mínimo de la mazmorra → nivel del acertijo (± 1 por azar)
  reach: 1.75, // alcance de interacción (celdas)
  // reparto de tipos (peso) por tema de mazmorra: los tipos «de movimiento» van a las naves y túneles, la lógica a los búnkeres
  weights: {
    default: { mirrors: 1, boxes: 1, timed: 1, runes: 1, circuit: 1, lasers: 1, memory: 1, valves: 1 },
    sotano: { mirrors: 1, boxes: 1.2, timed: 1, runes: 0.8, circuit: 1.3, lasers: 1.2, memory: 0.8, valves: 1 },
    planta: { mirrors: 1.3, boxes: 0.8, timed: 1, runes: 1, circuit: 1.2, lasers: 1.3, memory: 1, valves: 0.8 },
    gruta: { mirrors: 0.9, boxes: 1.3, timed: 1.2, runes: 1.3, circuit: 0.6, lasers: 0.6, memory: 1.2, valves: 1.1 },
    colmena: { mirrors: 0.8, boxes: 1, timed: 1.2, runes: 1.2, circuit: 0.7, lasers: 0.6, memory: 1.4, valves: 1.4 },
    alcantarilla: { mirrors: 0.8, boxes: 1, timed: 1, runes: 0.7, circuit: 1, lasers: 0.9, memory: 1, valves: 1.8 },
  },
  // premio: XP (fracción de la barra), créditos (× mt.credits(nivel)) y cofre (tier 1-3 del sistema de ECONOMÍA)
  reward: { xp: { 1: 0.05, 2: 0.08, 3: 0.12 }, credits: { 1: 3, 2: 6, 3: 10 }, perfectXp: 0.04, perfectCredits: 0.5 },
  respawnPenalty: 0.1, // fracción de vida que quita un error (descarga) cuando el puzle castiga
  hud: { hintAfterErrors: 3 },
};
var PZ_CFG = x.cfg.puzzles;

// ═══ 2. UTILIDADES ══════════════════════════════════════════════════════════════════════════════════
// ▼▼ PURO ▼▼ (todo lo que hay entre estas marcas se prueba también en Node: sin Three, sin DOM, solo `x`)
var PZ_DX = [1, 0, -1, 0],
  PZ_DZ = [0, 1, 0, -1]; // 0 = este (+x), 1 = sur (+z), 2 = oeste, 3 = norte

// Generador propio (mulberry32): los puzles no consumen el RNG del juego ni el del mundo.
function pzRng(seed) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = (a) => a[Math.floor(r() * a.length)];
  r.shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1)),
        t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };
  return r;
}
function pzMix() {
  let h = 0x811c9dc5;
  for (let i = 0; i < arguments.length; i++) {
    let v = arguments[i];
    if (typeof v === "string") {
      let k = 0;
      for (let j = 0; j < v.length; j++) k = (Math.imul(k, 31) + v.charCodeAt(j)) | 0;
      v = k;
    }
    h ^= v | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}
// Vecinos 4-conexos dentro de una rejilla w×h (para BFS): rellena `out` (reutilizable) y devuelve cuántos
function pzNeigh(w, h, i, out) {
  const cx = i % w,
    cz = (i / w) | 0;
  let n = 0;
  if (cx + 1 < w) out[n++] = i + 1;
  if (cz + 1 < h) out[n++] = i + w;
  if (cx > 0) out[n++] = i - 1;
  if (cz > 0) out[n++] = i - w;
  return n;
}
// Distancias BFS (8-conexo sin cortar esquinas, coste 1 / √2) desde una celda; las celdas bloqueadas valen Infinity
function pzDist8(w, h, blocked, from) {
  const D = new Float64Array(w * h).fill(Infinity),
    Q = [from];
  D[from] = 0;
  // Dijkstra sencillo (rejillas ≤ 64 celdas)
  const done = new Uint8Array(w * h);
  for (;;) {
    let b = -1,
      bd = Infinity;
    for (let i = 0; i < w * h; i++) if (!done[i] && D[i] < bd) ((bd = D[i]), (b = i));
    if (b < 0) break;
    done[b] = 1;
    const bx = b % w,
      bz = (b / w) | 0;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = bx + dx,
          nz = bz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h || blocked[nz * w + nx]) continue;
        if (dx && dz && (blocked[bz * w + nx] || blocked[nz * w + bx])) continue; // sin cortar esquinas
        const c = bd + (dx && dz ? Math.SQRT2 : 1);
        if (c < D[nz * w + nx]) D[nz * w + nx] = c;
      }
  }
  return D;
}
// Estado inicial de los contadores de un puzle (comunes a todos los tipos)
function pzBaseState(spec) {
  return { rev: 1, t: 0, done: false, errors: 0, moves: 0, hints: 0, tween: 0 };
}

// ═══ 3. GENERADORES ═════════════════════════════════════════════════════════════════════════════════
// Interfaz de un generador (todo puro salvo draw, que solo emite primitivas):
//   id, n (nombre), d (qué hay que hacer), icon, dims {nivel: [w, h]} (celdas de 1 m), lv {nivel: parámetros}
//   make(seed, nivel) → spec (JSON)          validate(spec) → {ok, why, …cifras}   (prueba determinista de que se puede resolver)
//   init(spec) → st                          solved(spec, st)                      st.rev sube con cada cambio visible
//   pick(spec, st, px, pz) → id | -1         label(spec, st, id)                   interacción (E / USAR) cerca de un objeto
//   act(spec, st, id, ctx)                   step(spec, st, dt, ctx)               acciones y tiempo (ctx = servicios del motor)
//   solid(spec, st, cx, cz) → bool           celdas que bloquean el paso (cajas, espejos, pilares…)
//   status(spec, st) → [líneas]              hint(spec, st, ctx) · reset(spec, st) · undo(spec, st) (opcionales)
//   draw(spec, st, g, t)                     g.box/cyl/sph/cone/oct/ring (coordenadas de celda; el centro de la celda i es i + 0.5)
//   bot(spec, st) → [acciones]               plan para las pruebas automáticas (opcional)
var PZ_GENS = {};
function pzPop(n) {
  let c = 0;
  while (n) ((c += n & 1), (n >>>= 1));
  return c;
}

// ───────── 3.1 ESPEJOS Y HAZ DE ENERGÍA ─────────
// Emisores de colores lanzan un haz; los espejos (se giran con E) lo desvían entre «/» y «\»; cada receptor solo acepta su color.
var PZ_REF = [
  [3, 2, 1, 0], // «/»: este→norte, sur→oeste, oeste→sur, norte→este
  [1, 0, 3, 2], // «\»: este→sur, sur→este, oeste→norte, norte→oeste
];
var PZ_BEAM_COL = [0x4fe0ff, 0xffb347, 0xff6bd5, 0x8dff6b];
function mirIndex(spec) {
  const n = spec.w * spec.h,
    ct = new Uint8Array(n), // 0 libre, 1 pilar, 2 emisor, 3 receptor, 4 espejo
    cr = new Int8Array(n).fill(-1);
  for (const q of spec.walls) ct[q] = 1;
  spec.em.forEach((e, i) => ((ct[e.z * spec.w + e.x] = 2), (cr[e.z * spec.w + e.x] = i)));
  spec.tg.forEach((e, i) => ((ct[e.z * spec.w + e.x] = 3), (cr[e.z * spec.w + e.x] = i)));
  spec.mir.forEach((e, i) => ((ct[e.z * spec.w + e.x] = 4), (cr[e.z * spec.w + e.x] = i)));
  return { ct, cr };
}
// Traza todos los haces. lit[t] = 1 si el receptor t recibe su color. segs (opcional) = [x0,z0,x1,z1,haz, …] en coordenadas de celda.
function mirTrace(spec, ix, ori, lit, segs) {
  const w = spec.w,
    h = spec.h;
  let nlit = 0;
  lit.fill(0);
  if (segs) segs.length = 0;
  for (let e = 0; e < spec.em.length; e++) {
    const em = spec.em[e];
    let cx = em.x,
      cz = em.z,
      d = em.d,
      sx = cx + 0.5,
      sz = cz + 0.5;
    for (let step = 0; step < 120; step++) {
      const nx = cx + PZ_DX[d],
        nz = cz + PZ_DZ[d];
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) {
        segs && segs.push(sx, sz, cx + 0.5 + PZ_DX[d] * 0.5, cz + 0.5 + PZ_DZ[d] * 0.5, e);
        break;
      }
      const k = nz * w + nx,
        t = ix.ct[k];
      cx = nx;
      cz = nz;
      if (t === 0) continue;
      if (t === 4) {
        segs && segs.push(sx, sz, cx + 0.5, cz + 0.5, e);
        sx = cx + 0.5;
        sz = cz + 0.5;
        d = PZ_REF[ori[ix.cr[k]]][d];
        continue;
      }
      // pilar, emisor o receptor: el haz termina (en el centro si es un receptor, en el borde si no)
      const f = t === 3 ? 0 : 0.5;
      segs && segs.push(sx, sz, cx + 0.5 - PZ_DX[d] * f, cz + 0.5 - PZ_DZ[d] * f, e);
      if (t === 3) {
        const ti = ix.cr[k];
        if (spec.tg[ti].c === e && !lit[ti]) ((lit[ti] = 1), nlit++);
      }
      break;
    }
  }
  return nlit;
}
// Tramo de un haz: avanza desde (ex,ez) con rumbo d0 colocando espejos en los giros y el receptor al final. Marca `used`.
function mirPath(r, w, h, used, ex, ez, d0, turns, out) {
  const nT = r.int(turns[0], turns[1]);
  let cx = ex,
    cz = ez,
    d = d0;
  used[ez * w + ex] = 2;
  for (let s = 0; s <= nT; s++) {
    let lmax = 0,
      x = cx,
      z = cz;
    for (;;) {
      x += PZ_DX[d];
      z += PZ_DZ[d];
      if (x < 0 || z < 0 || x >= w || z >= h || used[z * w + x] === 2) break;
      lmax++;
    }
    while (lmax > 0 && used[(cz + PZ_DZ[d] * lmax) * w + cx + PZ_DX[d] * lmax] !== 0) lmax--; // el final del tramo ha de estar libre
    if (lmax < 1) return false;
    const last = s === nT,
      L = last ? r.int(Math.min(lmax, 2), lmax) : r.int(1, lmax);
    for (let i = 1; i < L; i++) {
      const k = (cz + PZ_DZ[d] * i) * w + cx + PZ_DX[d] * i;
      if (used[k] === 0) used[k] = 1;
    }
    cx += PZ_DX[d] * L;
    cz += PZ_DZ[d] * L;
    used[cz * w + cx] = 2;
    if (last) {
      out.target = { x: cx, z: cz };
      return true;
    }
    // giro a izquierda o derecha: debe quedar al menos una celda libre detrás
    const opts = r.shuffle([(d + 1) & 3, (d + 3) & 3]);
    let nd = -1;
    for (const o of opts) {
      const nx = cx + PZ_DX[o],
        nz = cz + PZ_DZ[o];
      if (nx >= 0 && nz >= 0 && nx < w && nz < h && used[nz * w + nx] !== 2) {
        nd = o;
        break;
      }
    }
    if (nd < 0) return false;
    out.mirrors.push({ x: cx, z: cz, o: PZ_REF[0][d] === nd ? 0 : 1, p: 1 });
    d = nd;
  }
  return false;
}
PZ_GENS.mirrors = {
  id: "mirrors",
  n: "Espejos y haz de energía",
  d: "Gira los espejos para que cada haz llegue a su receptor del mismo color.",
  icon: "◢",
  dims: { 1: [5, 5], 2: [6, 5], 3: [7, 6] },
  lv: {
    1: { beams: 1, turns: [2, 3], decoys: 1, walls: 1, minFlip: 2 },
    2: { beams: 2, turns: [2, 2], decoys: 2, walls: 2, minFlip: 3 },
    3: { beams: 3, turns: [2, 3], decoys: 3, walls: 3, minFlip: 4 },
  },
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier];
    let best = null;
    for (let att = 0; att < 120; att++) {
      const r = pzRng(pzMix(seed, tier, 0x4d49, att)),
        used = new Uint8Array(w * h),
        em = [],
        tg = [],
        mir = [];
      let ok = true;
      for (let b = 0; b < P.beams && ok; b++) {
        let placed = false;
        for (let tries = 0; tries < 40 && !placed; tries++) {
          const side = r.int(0, 3);
          const ex = side === 0 ? 0 : side === 2 ? w - 1 : r.int(0, w - 1),
            ez = side === 1 ? 0 : side === 3 ? h - 1 : r.int(0, h - 1);
          if (used[ez * w + ex]) continue;
          const snap = used.slice(),
            out = { mirrors: [], target: null };
          if (mirPath(r, w, h, used, ex, ez, side, P.turns, out)) {
            em.push({ x: ex, z: ez, d: side });
            tg.push({ x: out.target.x, z: out.target.z, c: b });
            for (const m of out.mirrors) mir.push(m);
            placed = true;
          } else used.set(snap);
        }
        if (!placed) ok = false;
      }
      if (!ok) continue;
      // señuelos y pilares en celdas que ningún haz de la solución toca
      const freeCells = [];
      for (let i = 0; i < w * h; i++) if (!used[i]) freeCells.push(i);
      r.shuffle(freeCells);
      const nd = Math.min(P.decoys, freeCells.length),
        nw = Math.min(P.walls, freeCells.length - nd);
      for (let i = 0; i < nd; i++) mir.push({ x: freeCells[i] % w, z: (freeCells[i] / w) | 0, o: r.int(0, 1), p: 0 });
      const walls = [];
      for (let i = 0; i < nw; i++) walls.push(freeCells[nd + i]);
      const sol = mir.map((m) => m.o),
        pathIdx = mir.map((m, i) => (m.p ? i : -1)).filter((i) => i >= 0);
      // orientación inicial: al menos minFlip espejos del camino en la posición equivocada
      const ori0 = sol.slice();
      const wrong = r.shuffle(pathIdx.slice()).slice(0, Math.min(pathIdx.length, Math.max(P.minFlip, r.int(P.minFlip, pathIdx.length))));
      for (const i of wrong) ori0[i] ^= 1;
      for (let i = 0; i < mir.length; i++) if (!mir[i].p) ori0[i] = r.int(0, 1);
      mir.forEach((m, i) => (m.o = ori0[i]));
      const spec = { kind: "mirrors", seed, tier, w, h, em, tg, mir, walls, sol };
      const ix = mirIndex(spec),
        lit = new Uint8Array(tg.length);
      if (mirTrace(spec, ix, sol, lit) !== tg.length) continue; // la solución guardada ha de funcionar
      if (mirTrace(spec, ix, ori0, lit) === tg.length) continue; // y el estado inicial no puede estar resuelto
      if (!best || mir.length > best.mir.length) best = spec;
      if (wrong.length >= P.minFlip) return spec;
    }
    return best;
  },
  validate(spec) {
    const ix = mirIndex(spec),
      M = spec.mir.length,
      lit = new Uint8Array(spec.tg.length),
      T = spec.tg.length;
    if (M > 14) return { ok: false, why: "demasiados espejos para enumerar" };
    const o0 = spec.mir.map((m) => m.o),
      sol = spec.sol;
    let m0 = 0;
    o0.forEach((o, i) => (m0 |= o << i));
    const ori = new Uint8Array(M);
    let nsol = 0,
      best = 99;
    for (let m = 0; m < 1 << M; m++) {
      for (let i = 0; i < M; i++) ori[i] = (m >> i) & 1;
      if (mirTrace(spec, ix, ori, lit) === T) {
        nsol++;
        best = Math.min(best, pzPop(m ^ m0));
      }
    }
    const solved0 = mirTrace(spec, ix, o0, lit) === T,
      solOk = mirTrace(spec, ix, sol, lit) === T;
    const ok = nsol > 0 && solOk && !solved0 && T === spec.em.length;
    return { ok, why: ok ? "" : !nsol ? "sin solución" : solved0 ? "ya resuelto al empezar" : "solución guardada inválida", nsol, minFlips: best, space: 1 << M };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.ix = mirIndex(spec);
    st.ori = spec.mir.map((m) => m.o);
    st.lit = new Uint8Array(spec.tg.length);
    st.segs = [];
    st.nlit = mirTrace(spec, st.ix, st.ori, st.lit, st.segs);
    return st;
  },
  reset(spec, st) {
    st.ori = spec.mir.map((m) => m.o);
    st.nlit = mirTrace(spec, st.ix, st.ori, st.lit, st.segs);
    st.rev++;
  },
  solved(spec, st) {
    return st.nlit === spec.tg.length;
  },
  solid(spec, st, cx, cz) {
    return st.ix.ct[cz * spec.w + cx] !== 0;
  },
  pick(spec, st, px, pz) {
    let b = -1,
      bd = PZ_CFG.reach * PZ_CFG.reach;
    for (let i = 0; i < spec.mir.length; i++) {
      const m = spec.mir[i],
        d = (m.x + 0.5 - px) ** 2 + (m.z + 0.5 - pz) ** 2;
      if (d < bd) ((bd = d), (b = i));
    }
    return b;
  },
  label() {
    return "Girar espejo";
  },
  act(spec, st, id, ctx) {
    st.ori[id] ^= 1;
    st.moves++;
    st.nlit = mirTrace(spec, st.ix, st.ori, st.lit, st.segs);
    st.rev++;
    ctx.snd("beep", { p: 0.9 + st.nlit * 0.12 });
  },
  status(spec, st) {
    return [`Receptores encendidos: ${st.nlit}/${spec.tg.length}`, `Giros: ${st.moves}`];
  },
  hint(spec, st) {
    // un espejo del camino que está mal puesto
    for (let i = 0; i < spec.mir.length; i++) if (spec.mir[i].p && st.ori[i] !== spec.sol[i]) return { id: i, text: "Pista: ese espejo no está bien orientado." };
    return null;
  },
  bot(spec, st) {
    // espejos del camino que difieren de la solución guardada
    const acts = [];
    spec.mir.forEach((m, i) => {
      if (m.p && st.ori[i] !== spec.sol[i]) acts.push({ id: i, at: [m.x + 0.5, m.z + 0.5] });
    });
    return acts;
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h;
    for (let z = 0; z < h; z++) for (let xx = 0; xx < w; xx++) g.box(xx + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, (xx + z) & 1 ? 0x1b2a33 : 0x16222a);
    for (const q of spec.walls) g.box((q % w) + 0.5, ((q / w) | 0) + 0.5, 0.45, 0.8, 0.9, 0.8, 0x3b4650);
    spec.em.forEach((e, i) => {
      g.box(e.x + 0.5, e.z + 0.5, 0.25, 0.7, 0.5, 0.7, 0x2c3944);
      g.sph(e.x + 0.5 + PZ_DX[e.d] * 0.18, e.z + 0.5 + PZ_DZ[e.d] * 0.18, 0.55, 0.2, PZ_BEAM_COL[i], 1.6);
    });
    spec.tg.forEach((q, i) => {
      const c = PZ_BEAM_COL[q.c],
        on = st.lit[i];
      g.box(q.x + 0.5, q.z + 0.5, 0.12, 0.8, 0.24, 0.8, 0x2c3944);
      g.ring(q.x + 0.5, q.z + 0.5, 0.3, 0.34, c, on ? 1.6 : 0.45);
      g.sph(q.x + 0.5, q.z + 0.5, 0.42, on ? 0.2 + Math.sin(t * 6) * 0.03 : 0.12, c, on ? 2 : 0.4);
    });
    spec.mir.forEach((m, i) => {
      g.cyl(m.x + 0.5, m.z + 0.5, 0.18, 0.2, 0.36, 0x3b4650);
      g.box(m.x + 0.5, m.z + 0.5, 0.62, 0.86, 0.6, 0.07, 0xbfeaff, 0, st.ori[i] === 0 ? Math.PI / 4 : -Math.PI / 4);
    });
    const s = st.segs;
    for (let i = 0; i < s.length; i += 5) {
      const dx = s[i + 2] - s[i],
        dz = s[i + 3] - s[i + 1];
      if (Math.abs(dx) + Math.abs(dz) < 0.01) continue;
      g.box((s[i] + s[i + 2]) / 2, (s[i + 1] + s[i + 3]) / 2, 0.62, Math.abs(dx) + 0.08, 0.08, Math.abs(dz) + 0.08, PZ_BEAM_COL[s[i + 4]], 2);
    }
  },
};

// ───────── 3.2 CAJAS EMPUJABLES SOBRE PLACAS (tipo Sokoban) ─────────
// E empuja la caja que tienes al lado (en la dirección que va de ti a ella). Reiniciar y Deshacer siempre disponibles.
// Generación por «tirones» desde la solución (siempre resoluble) y prueba con un BFS exacto del estado (cajas + región del jugador).
function sokFlood(w, h, blk, p, reach, qa) {
  reach.fill(0);
  let qh = 0,
    qt = 0,
    rep = p;
  qa[qt++] = p;
  reach[p] = 1;
  while (qh < qt) {
    const c = qa[qh++],
      cx = c % w;
    if (c < rep) rep = c;
    if (cx + 1 < w && !blk[c + 1] && !reach[c + 1]) ((reach[c + 1] = 1), (qa[qt++] = c + 1));
    if (cx > 0 && !blk[c - 1] && !reach[c - 1]) ((reach[c - 1] = 1), (qa[qt++] = c - 1));
    if (c + w < w * h && !blk[c + w] && !reach[c + w]) ((reach[c + w] = 1), (qa[qt++] = c + w));
    if (c >= w && !blk[c - w] && !reach[c - w]) ((reach[c - w] = 1), (qa[qt++] = c - w));
  }
  return rep;
}
// BFS sobre estados {cajas ordenadas, región del jugador}. Devuelve {ok, pushes, sol:[[caja, dir]…], states}
function sokSolve(spec, cap, boxes0, p0) {
  const w = spec.w,
    h = spec.h,
    n = w * h,
    nb = spec.goals.length,
    wall = new Uint8Array(n),
    goal = new Uint8Array(n),
    reach = new Uint8Array(n),
    blk = new Uint8Array(n),
    qa = new Int32Array(n);
  for (const q of spec.walls) wall[q] = 1;
  for (const q of spec.goals) goal[q] = 1;
  const flood = (boxes, p) => {
    blk.set(wall);
    for (const b of boxes) blk[b] = 1;
    return sokFlood(w, h, blk, p, reach, qa);
  };
  const keyOf = (boxes, rep) => {
    let k = 0;
    for (const b of boxes) k = k * 64 + b;
    return k * 64 + rep;
  };
  const isGoal = (boxes) => {
    for (const b of boxes) if (!goal[b]) return false;
    return true;
  };
  const start = (boxes0 || spec.boxes).slice().sort((a, b) => a - b);
  if (isGoal(start)) return { ok: true, pushes: 0, sol: [], states: 1 };
  const rep0 = flood(start, p0 === undefined ? spec.player : p0);
  const seen = new Map(),
    nodes = [{ boxes: start, rep: rep0, par: -1, act: null }];
  seen.set(keyOf(start, rep0), 0);
  for (let qi = 0; qi < nodes.length; qi++) {
    if (nodes.length > cap) return { ok: false, why: "demasiados estados", states: nodes.length };
    const nd = nodes[qi];
    flood(nd.boxes, nd.rep);
    const regionCopy = reach.slice();
    for (let bi = 0; bi < nb; bi++) {
      const c = nd.boxes[bi],
        cx = c % w,
        cz = (c / w) | 0;
      for (let d = 0; d < 4; d++) {
        const px = cx - PZ_DX[d],
          pz = cz - PZ_DZ[d],
          tx = cx + PZ_DX[d],
          tz = cz + PZ_DZ[d];
        if (px < 0 || pz < 0 || px >= w || pz >= h || tx < 0 || tz < 0 || tx >= w || tz >= h) continue;
        if (!regionCopy[pz * w + px]) continue;
        const t = tz * w + tx;
        if (wall[t] || nd.boxes.indexOf(t) >= 0) continue;
        const nbx = nd.boxes.slice();
        nbx[bi] = t;
        nbx.sort((a, b) => a - b);
        const rep = flood(nbx, c),
          k = keyOf(nbx, rep);
        if (seen.has(k)) continue;
        seen.set(k, nodes.length);
        nodes.push({ boxes: nbx, rep, par: qi, act: [c, d] });
        if (isGoal(nbx)) {
          const sol = [];
          for (let j = nodes.length - 1; j > 0; j = nodes[j].par) sol.push(nodes[j].act);
          sol.reverse();
          return { ok: true, pushes: sol.length, sol, states: nodes.length };
        }
      }
    }
  }
  return { ok: false, why: "sin solución", states: nodes.length };
}
PZ_GENS.boxes = {
  id: "boxes",
  n: "Cajas sobre placas",
  d: "Empuja las cajas hasta las placas del suelo. Si te atascas, reinicia o deshaz.",
  icon: "▣",
  dims: { 1: [5, 5], 2: [6, 5], 3: [7, 6] },
  lv: {
    1: { boxes: 1, walls: 3, pulls: 18, minPush: 4, tries: 20 },
    2: { boxes: 2, walls: 4, pulls: 34, minPush: 9, tries: 14 },
    3: { boxes: 3, walls: 5, pulls: 44, minPush: 13, tries: 8 },
  },
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier],
      n = w * h;
    let best = null;
    const reach = new Uint8Array(n),
      blk = new Uint8Array(n),
      qa = new Int32Array(n);
    const cands = [];
    for (let att = 0; att < 200 && cands.length < P.tries; att++) {
      const r = pzRng(pzMix(seed, tier, 0x534b, att)),
        wall = new Uint8Array(n),
        walls = [];
      for (let i = 0; i < P.walls; i++) {
        const c = r.int(0, n - 1);
        if (!wall[c]) ((wall[c] = 1), walls.push(c));
      }
      const free = [];
      for (let i = 0; i < n; i++) if (!wall[i]) free.push(i);
      // la parte libre ha de ser una sola región
      sokFlood(w, h, wall, free[0], reach, qa);
      if (free.some((c) => !reach[c])) continue;
      r.shuffle(free);
      const goals = free.slice(0, P.boxes).sort((a, b) => a - b),
        boxes = goals.slice();
      let player = free[P.boxes];
      let got = 0;
      for (let i = 0; i < P.pulls * 6 && got < P.pulls; i++) {
        const bi = r.int(0, P.boxes - 1),
          d = r.int(0, 3),
          q = boxes[bi],
          qx = q % w,
          qz = (q / w) | 0,
          px = qx - PZ_DX[d],
          pz = qz - PZ_DZ[d],
          ax = qx - 2 * PZ_DX[d],
          az = qz - 2 * PZ_DZ[d];
        if (px < 0 || pz < 0 || ax < 0 || az < 0 || px >= w || pz >= h || ax >= w || az >= h) continue;
        const p = pz * w + px,
          a = az * w + ax;
        if (wall[p] || wall[a] || boxes.indexOf(p) >= 0 || boxes.indexOf(a) >= 0) continue;
        blk.set(wall);
        for (const b of boxes) blk[b] = 1;
        sokFlood(w, h, blk, player, reach, qa);
        if (!reach[p]) continue;
        boxes[bi] = p;
        player = a;
        got++;
      }
      const spec = { kind: "boxes", seed, tier, w, h, walls, goals, boxes: boxes.slice().sort((a, b) => a - b), player };
      if (spec.boxes.every((b) => goals.indexOf(b) >= 0)) continue;
      // puntuación barata (cuánto están de lejos las cajas de sus placas): solo se resuelven los mejores candidatos
      let score = 0;
      for (const b of spec.boxes) {
        let m = 99;
        for (const g of goals) m = Math.min(m, Math.abs((b % w) - (g % w)) + Math.abs(((b / w) | 0) - ((g / w) | 0)));
        score += m;
      }
      cands.push({ spec, score });
    }
    cands.sort((a, b) => b.score - a.score);
    for (const c of cands.slice(0, 3)) {
      const s = sokSolve(c.spec, 60000);
      if (!s.ok || s.pushes < 1) continue;
      c.spec.sol = s.sol;
      if (!best || s.pushes > best.sol.length) best = c.spec;
      if (s.pushes >= P.minPush * 0.7) break;
    }
    return best;
  },
  validate(spec) {
    const s = sokSolve(spec, 250000);
    const ok = s.ok && s.pushes >= 1 && spec.boxes.length === spec.goals.length;
    return { ok, why: ok ? "" : s.why || "sin solución", pushes: s.pushes || 0, states: s.states || 0 };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.boxes = spec.boxes.slice();
    st.hist = [];
    st.wall = new Uint8Array(spec.w * spec.h);
    for (const q of spec.walls) st.wall[q] = 1;
    st.goal = new Uint8Array(spec.w * spec.h);
    for (const q of spec.goals) st.goal[q] = 1;
    st.tw = { i: -1, from: 0, t: 1 };
    return st;
  },
  reset(spec, st) {
    st.boxes = spec.boxes.slice();
    st.hist.length = 0;
    st.tw.i = -1;
    st.tween = 0;
    st.rev++;
  },
  undo(spec, st) {
    if (!st.hist.length || st.done) return false;
    st.boxes = st.hist.pop();
    st.tw.i = -1;
    st.tween = 0;
    st.moves++;
    st.rev++;
    return true;
  },
  solved(spec, st) {
    for (const b of st.boxes) if (!st.goal[b]) return false;
    return true;
  },
  solid(spec, st, cx, cz) {
    const c = cz * spec.w + cx;
    return st.wall[c] === 1 || st.boxes.indexOf(c) >= 0;
  },
  pick(spec, st, px, pz) {
    for (let i = 0; i < st.boxes.length; i++) {
      const b = st.boxes[i],
        dx = (b % spec.w) + 0.5 - px,
        dz = ((b / spec.w) | 0) + 0.5 - pz;
      if (Math.abs(dx) <= 1.6 && Math.abs(dz) <= 0.65 && Math.abs(dx) > Math.abs(dz)) return i * 4 + (dx > 0 ? 0 : 2);
      if (Math.abs(dz) <= 1.6 && Math.abs(dx) <= 0.65 && Math.abs(dz) >= Math.abs(dx)) return i * 4 + (dz > 0 ? 1 : 3);
    }
    return -1;
  },
  label(spec, st, id) {
    return this.canPush(spec, st, id >> 2, id & 3) ? "Empujar caja" : "Caja bloqueada";
  },
  canPush(spec, st, i, d) {
    const b = st.boxes[i],
      tx = (b % spec.w) + PZ_DX[d],
      tz = ((b / spec.w) | 0) + PZ_DZ[d];
    if (tx < 0 || tz < 0 || tx >= spec.w || tz >= spec.h) return false;
    const t = tz * spec.w + tx;
    return !st.wall[t] && st.boxes.indexOf(t) < 0;
  },
  act(spec, st, id, ctx) {
    const i = id >> 2,
      d = id & 3;
    if (!this.canPush(spec, st, i, d)) return ctx.snd("err");
    st.hist.push(st.boxes.slice());
    const b = st.boxes[i];
    st.boxes[i] = b + PZ_DX[d] + PZ_DZ[d] * spec.w;
    st.tw.i = i;
    st.tw.from = b;
    st.tween = 0.16;
    st.moves++;
    st.rev++;
    ctx.snd("metal", { p: 0.5 });
  },
  step(spec, st, dt) {
    if (st.tween > 0) {
      st.tween -= dt;
      st.tween <= 0 && ((st.tween = 0), (st.tw.i = -1), st.rev++);
    }
  },
  status(spec, st) {
    let on = 0;
    for (const b of st.boxes) st.goal[b] && on++;
    return [`Cajas en su placa: ${on}/${st.boxes.length}`, `Empujes: ${st.moves}`];
  },
  hint(spec, st, ctx) {
    const s = sokSolve(spec, 80000, st.boxes, ctx && ctx.cell !== undefined ? ctx.cell : spec.player);
    if (!s.ok || !s.sol.length) return { text: "Pista: esta posición no tiene salida; usa «Deshacer» o «Reiniciar»." };
    const [c, d] = s.sol[0];
    const dir = ["derecha", "abajo", "izquierda", "arriba"][d];
    return { id: st.boxes.indexOf(c) * 4 + d, text: `Pista: empuja la caja marcada hacia ${dir}.` };
  },
  bot(spec, st, px, pz) {
    const cell = Math.max(0, Math.min(spec.h - 1, Math.floor(pz))) * spec.w + Math.max(0, Math.min(spec.w - 1, Math.floor(px)));
    const s = sokSolve(spec, 250000, st.boxes, cell);
    if (!s.ok) return null;
    // cada acción: ponte en la celda de detrás de la caja y pulsa
    return s.sol.map(([c, d]) => ({ id: st.boxes.indexOf(c) * 4 + d, box: c, dir: d, at: [(c % spec.w) + 0.5 - PZ_DX[d], ((c / spec.w) | 0) + 0.5 - PZ_DZ[d]] }));
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h;
    for (let z = 0; z < h; z++) for (let xx = 0; xx < w; xx++) g.box(xx + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, (xx + z) & 1 ? 0x2a2620 : 0x241f1a);
    for (const q of spec.walls) g.box((q % w) + 0.5, ((q / w) | 0) + 0.5, 0.55, 0.92, 1.1, 0.92, 0x4a4f55);
    for (const q of spec.goals) {
      const on = st.boxes.indexOf(q) >= 0;
      g.box((q % w) + 0.5, ((q / w) | 0) + 0.5, 0.06, 0.78, 0.04, 0.78, on ? 0x3cff8a : 0xffc24a, on ? 1.5 : 0.7);
    }
    for (let i = 0; i < st.boxes.length; i++) {
      let b = st.boxes[i],
        cx = (b % w) + 0.5,
        cz = ((b / w) | 0) + 0.5;
      if (st.tw.i === i && st.tween > 0) {
        const f = st.tween / 0.16,
          fx = (st.tw.from % w) + 0.5,
          fz = ((st.tw.from / w) | 0) + 0.5;
        cx += (fx - cx) * f;
        cz += (fz - cz) * f;
      }
      const on = st.goal[b];
      g.box(cx, cz, 0.38, 0.8, 0.76, 0.8, on ? 0x6fcf8f : 0xb08a4a);
      g.box(cx, cz, 0.78, 0.86, 0.06, 0.86, on ? 0x9dffbf : 0xd9b46a);
      g.box(cx, cz, 0.38, 0.84, 0.1, 0.84, 0x6a4f26);
    }
  },
};

// ───────── 3.3 PLACAS CON CRONÓMETRO ─────────
// Pisar una placa la enciende unos segundos; hay que tener TODAS encendidas a la vez. Se trata de planear el recorrido más corto
// entre las placas esquivando los pilares. validate() prueba, con todos los órdenes posibles, que existe un recorrido que llega a tiempo.
var PZ_SPEED = 4.2; // m/s de referencia (el jugador corre a 5,2: queda margen para las esquinas)
var PZ_STEP_OVERHEAD = 0.18; // s por placa (reacción y giro)
function pzPerms(n, cb) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  const rec = (k) => {
    if (k === n) return cb(a);
    for (let i = k; i < n; i++) {
      let t = a[k];
      a[k] = a[i];
      a[i] = t;
      rec(k + 1);
      t = a[k];
      a[k] = a[i];
      a[i] = t;
    }
  };
  rec(0);
}
function tmTimes(spec) {
  // matriz de tiempos de viaje entre placas (s)
  const { w, h } = spec,
    wall = new Uint8Array(w * h);
  for (const q of spec.walls) wall[q] = 1;
  const n = spec.plates.length,
    D = [];
  for (let i = 0; i < n; i++) {
    const di = pzDist8(w, h, wall, spec.plates[i].z * w + spec.plates[i].x);
    D.push(spec.plates.map((q, j) => (i === j ? 0 : di[q.z * w + q.x] / PZ_SPEED + PZ_STEP_OVERHEAD)));
  }
  return D;
}
PZ_GENS.timed = {
  id: "timed",
  n: "Placas con cronómetro",
  d: "Pisa cada placa: se apaga a los pocos segundos. Enciende todas a la vez.",
  icon: "◷",
  dims: { 1: [6, 5], 2: [7, 5], 3: [7, 6] },
  lv: {
    1: { n: 3, walls: 3, slack: 1.2, add: 0.35, sep: 3, maxValid: 4 },
    2: { n: 4, walls: 4, slack: 1.1, add: 0.3, sep: 3, maxValid: 4 },
    3: { n: 5, walls: 5, slack: 1.06, add: 0.25, sep: 3, maxValid: 4 },
  },
  animated: true,
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier],
      N = w * h,
      reach = new Uint8Array(N),
      qa = new Int32Array(N);
    let best = null;
    for (let att = 0; att < 200; att++) {
      const r = pzRng(pzMix(seed, tier, 0x544d, att)),
        wall = new Uint8Array(N),
        walls = [];
      for (let i = 0; i < P.walls; i++) {
        const c = r.int(0, N - 1);
        if (!wall[c]) ((wall[c] = 1), walls.push(c));
      }
      const free = [];
      for (let i = 0; i < N; i++) if (!wall[i]) free.push(i);
      sokFlood(w, h, wall, free[0], reach, qa);
      if (free.some((c) => !reach[c])) continue;
      r.shuffle(free);
      const pl = [];
      for (const c of free) {
        if (pl.length >= P.n) break;
        if (pl.every((q) => Math.max(Math.abs((q % w) - (c % w)), Math.abs(((q / w) | 0) - ((c / w) | 0))) >= (att < 120 ? P.sep : 2))) pl.push(c);
      }
      if (pl.length < P.n) continue;
      const plates = pl.map((c) => ({ x: c % w, z: (c / w) | 0 })),
        spec = { kind: "timed", seed, tier, w, h, walls, plates, dur: 0, sol: [] };
      const D = tmTimes(spec);
      if (D.some((row) => row.some((v) => !isFinite(v)))) continue;
      let bestSpan = Infinity,
        bestOrd = null;
      const spans = [];
      pzPerms(P.n, (o) => {
        let s = 0;
        for (let i = 0; i + 1 < o.length; i++) s += D[o[i]][o[i + 1]];
        spans.push(s);
        if (s < bestSpan) ((bestSpan = s), (bestOrd = o.slice()));
      });
      spec.dur = Math.ceil((bestSpan * P.slack + P.add) * 4) / 4;
      spec.sol = bestOrd;
      const nvalid = spans.filter((s) => s <= spec.dur).length;
      spec.nvalid = nvalid;
      if (!best || nvalid < best.nvalid) best = spec;
      if (nvalid <= P.maxValid) return spec;
    }
    return best;
  },
  validate(spec) {
    const D = tmTimes(spec),
      n = spec.plates.length;
    if (D.some((row) => row.some((v) => !isFinite(v)))) return { ok: false, why: "placa inalcanzable" };
    let nvalid = 0,
      bestSpan = Infinity;
    pzPerms(n, (o) => {
      let s = 0;
      for (let i = 0; i + 1 < o.length; i++) s += D[o[i]][o[i + 1]];
      bestSpan = Math.min(bestSpan, s);
      if (s <= spec.dur) nvalid++;
    });
    const ok = nvalid > 0 && spec.dur >= 2.5;
    return { ok, why: ok ? "" : "ningún recorrido llega a tiempo", nvalid, orders: pzFact(n), best: +bestSpan.toFixed(2), dur: spec.dur, margin: +(spec.dur - bestSpan).toFixed(2) };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.lit = spec.plates.map(() => 0);
    st.wall = new Uint8Array(spec.w * spec.h);
    for (const q of spec.walls) st.wall[q] = 1;
    st.live = false;
    return st;
  },
  reset(spec, st) {
    st.lit.fill(0);
    st.live = false;
    st.rev++;
  },
  solved(spec, st) {
    for (const v of st.lit) if (v <= 0) return false;
    return true;
  },
  solid(spec, st, cx, cz) {
    return st.wall[cz * spec.w + cx] === 1;
  },
  pick() {
    return -1;
  },
  step(spec, st, dt, ctx) {
    const cx = Math.floor(ctx.px),
      cz = Math.floor(ctx.pz);
    let live = false;
    for (let i = 0; i < spec.plates.length; i++) {
      const p = spec.plates[i];
      if (ctx.inside && cx === p.x && cz === p.z) {
        if (st.lit[i] <= 0) {
          ctx.snd("beep", { p: 0.75 + i * 0.14 });
          st.rev++;
        }
        st.lit[i] = spec.dur;
      } else if (st.lit[i] > 0) {
        st.lit[i] -= dt;
        if (st.lit[i] <= 0) ((st.lit[i] = 0), st.rev++);
      }
      if (st.lit[i] > 0) live = true;
    }
    st.live = live;
  },
  status(spec, st) {
    let n = 0;
    for (const v of st.lit) v > 0 && n++;
    return [`Placas encendidas: ${n}/${spec.plates.length}`, `Cada placa dura ${spec.dur} s`];
  },
  hint(spec, st) {
    const o = spec.sol;
    return { id: o[0], text: `Pista: empieza por la placa marcada y sigue el camino más corto.` };
  },
  bot(spec) {
    const D = tmTimes(spec),
      o = spec.sol,
      acts = [];
    let t = 0;
    for (let i = 0; i < o.length; i++) {
      if (i) t += D[o[i - 1]][o[i]];
      acts.push({ at: [spec.plates[o[i]].x + 0.5, spec.plates[o[i]].z + 0.5], t });
    }
    return acts;
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h;
    for (let z = 0; z < h; z++) for (let xx = 0; xx < w; xx++) g.box(xx + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, (xx + z) & 1 ? 0x232a33 : 0x1d242c);
    for (const q of spec.walls) g.box((q % w) + 0.5, ((q / w) | 0) + 0.5, 0.55, 0.9, 1.1, 0.9, 0x474f58);
    for (let i = 0; i < spec.plates.length; i++) {
      const p = spec.plates[i],
        f = Math.max(0, st.lit[i] / spec.dur),
        on = f > 0,
        col = f > 0.5 ? 0x4cff8f : f > 0.22 ? 0xffd04a : 0xff5a3c;
      g.box(p.x + 0.5, p.z + 0.5, 0.06, 0.8, 0.08, 0.8, on ? col : 0x3a4350, on ? 1.2 : 0);
      g.ring(p.x + 0.5, p.z + 0.5, 0.11, 0.36, on ? col : 0x6a7684, on ? 1.8 : 0.5);
      if (on) g.cyl(p.x + 0.5, p.z + 0.5, 0.15 + f * 0.55, 0.1, f * 1.1, col, 1.8);
    }
  },
};
function pzFact(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// ───────── 3.4 RUNAS EN EL ORDEN QUE DICTA LA INSCRIPCIÓN ─────────
// Las runas se activan en un orden único que se deduce de las pistas de la inscripción (y, si el Archivo tiene algo, de una nota extra).
// validate() enumera TODAS las permutaciones: exactamente una cumple las pistas y es la guardada.
var PZ_RUNES = [
  { n: "Sol", g: "●", col: 0xffc94a, sh: "sph" },
  { n: "Luna", g: "○", col: 0xbcd6ff, sh: "ring" },
  { n: "Marea", g: "◆", col: 0x4fe0ff, sh: "oct" },
  { n: "Ceniza", g: "▲", col: 0xb8a89a, sh: "cone" },
  { n: "Hueso", g: "■", col: 0xf2efe6, sh: "box" },
  { n: "Raíz", g: "✚", col: 0x6fdc6a, sh: "cross" },
  { n: "Brasa", g: "▼", col: 0xff5a3c, sh: "cone2" },
  { n: "Eco", g: "◉", col: 0xc58bff, sh: "cyl" },
];
var PZ_ORD = ["", "", "segunda", "tercera", "cuarta", "quinta", "sexta", "séptima"];
// Pistas: [tipo, a, b] con a, b = índices de runa. tipos: 0 antes · 1 justo después · 2 primera · 3 última · 4 no primera · 5 no última · 6 n-ésima (b = posición) · 7 no seguidas
function rnOk(c, pos, n) {
  const t = c[0],
    a = pos[c[1]],
    b = pos[c[2]];
  return t === 0 ? a < b : t === 1 ? a === b + 1 : t === 2 ? a === 0 : t === 3 ? a === n - 1 : t === 4 ? a !== 0 : t === 5 ? a !== n - 1 : t === 6 ? a === c[2] : Math.abs(a - b) !== 1;
}
function rnCount(clues, n, cap) {
  let cnt = 0,
    first = null;
  const pos = new Array(n);
  pzPerms(n, (o) => {
    for (let i = 0; i < n; i++) pos[o[i]] = i; // o[i] = runa que va en la posición i
    for (const c of clues) if (!rnOk(c, pos, n)) return;
    cnt++;
    if (!first) first = o.slice();
  });
  return { cnt, first };
}
function rnText(c, names) {
  const A = names[c[1]],
    B = names[c[2]];
  return c[0] === 0
    ? `${A} despierta antes que ${B}.`
    : c[0] === 1
      ? `${A} responde justo después de ${B}.`
      : c[0] === 2
        ? `${A} abre el rito.`
        : c[0] === 3
          ? `${A} lo cierra.`
          : c[0] === 4
            ? `${A} nunca va la primera.`
            : c[0] === 5
              ? `${A} nunca va la última.`
              : c[0] === 6
                ? `${A} es la ${PZ_ORD[c[2] + 1]} en despertar.`
                : `${A} y ${B} no despiertan seguidas.`;
}
PZ_GENS.runes = {
  id: "runes",
  n: "Runas en orden",
  d: "Activa las runas en el orden que dicta la inscripción.",
  icon: "ᚱ",
  dims: { 1: [6, 5], 2: [6, 6], 3: [7, 6] },
  lv: { 1: { n: 4 }, 2: { n: 5 }, 3: { n: 6 } },
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      n = this.lv[tier].n,
      r = pzRng(pzMix(seed, tier, 0x5255));
    const ids = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, n); // qué runas intervienen
    const order = r.shuffle([...Array(n).keys()]); // order[i] = runa (índice local) que va en la posición i
    const pos = new Array(n);
    order.forEach((q, i) => (pos[q] = i));
    // pistas verdaderas candidatas
    const cand = [];
    for (let a = 0; a < n; a++) {
      cand.push([6, a, pos[a]]);
      pos[a] === 0 ? cand.push([2, a, 0]) : cand.push([4, a, 0]);
      pos[a] === n - 1 ? cand.push([3, a, 0]) : cand.push([5, a, 0]);
      for (let b = 0; b < n; b++) {
        if (a === b) continue;
        pos[a] < pos[b] && cand.push([0, a, b]);
        pos[a] === pos[b] + 1 && cand.push([1, a, b]);
        a < b && Math.abs(pos[a] - pos[b]) !== 1 && cand.push([7, a, b]);
      }
    }
    // las absolutas de posición (tipo 6) solo valen para posiciones 1..n-2 (las extremas tienen su propia redacción)
    const pool = r.shuffle(cand.filter((c) => c[0] !== 6 || (c[2] > 0 && c[2] < n - 1)));
    let clues = [],
      cnt = rnCount(clues, n).cnt;
    for (const c of pool) {
      const k = rnCount(clues.concat([c]), n).cnt;
      if (k < cnt) {
        clues.push(c);
        cnt = k;
        if (cnt === 1) break;
      }
    }
    // poda: quita las pistas redundantes
    for (let i = clues.length - 1; i >= 0; i--) {
      const t = clues.slice();
      t.splice(i, 1);
      if (rnCount(t, n).cnt === 1) clues = t;
    }
    // disposición en el suelo: runas en una elipse; la estela de la inscripción, en el centro
    const cells = [],
      used = new Set([Math.floor(h / 2) * w + Math.floor(w / 2)]);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2,
        cx = Math.floor((w - 1) / 2 + 0.5 + Math.cos(a) * ((w - 1) / 2 - 0.2)),
        cz = Math.floor((h - 1) / 2 + 0.5 + Math.sin(a) * ((h - 1) / 2 - 0.2));
      let c = Math.max(0, Math.min(h - 1, cz)) * w + Math.max(0, Math.min(w - 1, cx));
      for (let k = 0; used.has(c) && k < 40; k++) c = r.int(0, w * h - 1);
      used.add(c);
      cells.push(c);
    }
    const names = ids.map((q) => PZ_RUNES[q].g + " " + PZ_RUNES[q].n.toUpperCase());
    return { kind: "runes", seed, tier, w, h, n, ids, cells, order, clues, text: clues.map((c) => rnText(c, names)), stele: Math.floor(h / 2) * w + Math.floor(w / 2) };
  },
  validate(spec) {
    const n = spec.n,
      s = rnCount(spec.clues, n);
    const same = s.first && s.first.every((q, i) => q === spec.order[i]);
    const ok = s.cnt === 1 && same && spec.clues.length >= 2 && new Set(spec.cells).size === n && !spec.cells.includes(spec.stele);
    return { ok, why: ok ? "" : s.cnt !== 1 ? `${s.cnt} órdenes cumplen las pistas` : "la solución guardada no cumple", clues: spec.clues.length, perms: pzFact(n) };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.k = 0;
    st.lit = new Uint8Array(spec.n);
    st.flash = 0;
    st.live = false;
    st.cellSet = new Set(spec.cells);
    return st;
  },
  reset(spec, st) {
    st.k = 0;
    st.lit.fill(0);
    st.rev++;
  },
  solved(spec, st) {
    return st.k >= spec.n;
  },
  solid(spec, st, cx, cz) {
    const c = cz * spec.w + cx;
    return st.cellSet.has(c) || c === spec.stele;
  },
  pick(spec, st, px, pz) {
    let b = -1,
      bd = PZ_CFG.reach * PZ_CFG.reach;
    for (let i = 0; i < spec.n; i++) {
      const c = spec.cells[i],
        d = ((c % spec.w) + 0.5 - px) ** 2 + (((c / spec.w) | 0) + 0.5 - pz) ** 2;
      if (d < bd) ((bd = d), (b = i));
    }
    return b;
  },
  label(spec, st, id) {
    return `Activar runa ${PZ_RUNES[spec.ids[id]].g} ${PZ_RUNES[spec.ids[id]].n}`;
  },
  act(spec, st, id, ctx) {
    if (st.lit[id]) return;
    if (spec.order[st.k] === id) {
      st.lit[id] = 1;
      st.k++;
      st.moves++;
      st.rev++;
      ctx.snd("beep", { p: 0.7 + st.k * 0.12 });
    } else {
      st.errors++;
      st.flash = 0.9;
      st.k = 0;
      st.lit.fill(0);
      st.rev++;
      ctx.snd("alarm");
      ctx.hurt(PZ_CFG.respawnPenalty * 0.5);
      ctx.toast("Orden equivocado: las runas se apagan.", "bad");
    }
  },
  step(spec, st, dt) {
    if (st.flash > 0) {
      st.flash -= dt;
      st.live = st.flash > 0;
      st.flash <= 0 && ((st.flash = 0), st.rev++);
    }
  },
  status(spec, st) {
    return [`Runas activadas: ${st.k}/${spec.n}`, ...(st.errors ? [`Errores: ${st.errors}`] : [])];
  },
  clueLines(spec) {
    return spec.text;
  },
  hint(spec, st) {
    const next = spec.order[st.k];
    return next === undefined ? null : { id: next, text: `Pista: la siguiente es ${PZ_RUNES[spec.ids[next]].g} ${PZ_RUNES[spec.ids[next]].n}.` };
  },
  bot(spec, st) {
    return spec.order.slice(st.k).map((id) => ({ id, at: [(spec.cells[id] % spec.w) + 0.5, ((spec.cells[id] / spec.w) | 0) + 0.5] }));
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h;
    for (let z = 0; z < h; z++) for (let xx = 0; xx < w; xx++) g.box(xx + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, (xx + z) & 1 ? 0x2a2733 : 0x24212d);
    const sx = (spec.stele % w) + 0.5,
      sz = ((spec.stele / w) | 0) + 0.5;
    g.box(sx, sz, 0.55, 0.5, 1.1, 0.22, 0x59606b);
    g.box(sx, sz, 1.0, 0.36, 0.06, 0.26, 0xc9d3e0, 0.5);
    const flash = st.flash > 0 ? (Math.sin(t * 30) > 0 ? 1 : 0.4) : 0;
    for (let i = 0; i < spec.n; i++) {
      const R = PZ_RUNES[spec.ids[i]],
        cx = (spec.cells[i] % w) + 0.5,
        cz = ((spec.cells[i] / w) | 0) + 0.5,
        on = st.lit[i],
        col = flash ? 0xff3b3b : R.col,
        gl = on ? 2 : flash ? 1.4 : 0.55;
      g.cyl(cx, cz, 0.3, 0.3, 0.6, 0x3d4350);
      g.box(cx, cz, 0.62, 0.62, 0.05, 0.62, 0x505868);
      const y = 0.98 + (on ? Math.sin(t * 3 + i) * 0.05 : 0);
      switch (R.sh) {
        case "sph": g.sph(cx, cz, y, 0.22, col, gl); break;
        case "ring": g.ring(cx, cz, y, 0.2, col, gl, true); break;
        case "oct": g.oct(cx, cz, y, 0.26, col, gl); break;
        case "cone": g.cone(cx, cz, y, 0.24, 0.4, col, gl); break;
        case "cone2": g.cone(cx, cz, y, 0.24, 0.4, col, gl, true); break;
        case "box": g.box(cx, cz, y, 0.3, 0.3, 0.3, col, gl, t * 0.6); break;
        case "cross": g.box(cx, cz, y, 0.42, 0.12, 0.12, col, gl); g.box(cx, cz, y, 0.12, 0.42, 0.12, col, gl); break;
        default: g.cyl(cx, cz, y, 0.16, 0.34, col, gl);
      }
    }
  },
  glyphs(spec) {
    // etiquetas flotantes (la ejecución las pinta con sprites compartidos)
    return spec.cells.map((c, i) => ({ cx: (c % spec.w) + 0.5, cz: ((c / spec.w) | 0) + 0.5, y: 1.55, t: PZ_RUNES[spec.ids[i]].g, col: PZ_RUNES[spec.ids[i]].col }));
  },
};

// ───────── 3.5 ENRUTADO DE CORRIENTE ─────────
// Baldosas de conducto (extremo, recta, curva, T) que se giran con E hasta que la corriente de la fuente llegue a todas las lámparas.
// La red es un árbol que cubre toda la rejilla: resuelto ⇔ todas las baldosas reciben corriente. validate() resuelve la rejilla
// con un buscador independiente de la generación (no usa las máscaras guardadas, solo los tipos de baldosa).
function ciRot(m) {
  return ((m << 1) | (m >> 3)) & 15; // giro horario: E→S→O→N
}
function ciRots(m) {
  const out = [m];
  for (let k = 0, c = m; k < 3; k++) {
    c = ciRot(c);
    if (out.indexOf(c) < 0) out.push(c);
  }
  return out;
}
// Reparte la corriente desde la fuente: pw[i] = 1 si la baldosa i está alimentada. Devuelve cuántas.
function ciPower(spec, mask, pw) {
  const w = spec.w,
    h = spec.h;
  pw.fill(0);
  const q = [spec.src];
  pw[spec.src] = 1;
  let n = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi],
      cx = c % w,
      cz = (c / w) | 0;
    for (let d = 0; d < 4; d++) {
      if (!(mask[c] & (1 << d))) continue;
      const nx = cx + PZ_DX[d],
        nz = cz + PZ_DZ[d];
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const k = nz * w + nx;
      if (pw[k] || !(mask[k] & (1 << ((d + 2) & 3)))) continue;
      pw[k] = 1;
      n++;
      q.push(k);
    }
  }
  return n;
}
// Cuenta soluciones (tope `limit`) de la rejilla dados solo los tipos de baldosa (máscara en la orientación de referencia)
function ciSolve(spec, limit) {
  const w = spec.w,
    h = spec.h,
    n = w * h,
    opts = spec.tiles.map(ciRots),
    cur = new Uint8Array(n),
    pw = new Uint8Array(n);
  let found = 0,
    nodes = 0,
    first = null;
  const rec = (i) => {
    if (found >= limit || nodes > 3e6) return;
    nodes++;
    if (i === n) {
      if (ciPower(spec, cur, pw) === n) {
        found++;
        first || (first = cur.slice());
      }
      return;
    }
    const cx = i % w,
      cz = (i / w) | 0;
    for (const m of opts[i]) {
      if (cx === w - 1 && m & 1) continue;
      if (cz === h - 1 && m & 2) continue;
      if (cx === 0 && m & 4) continue;
      if (cz === 0 && m & 8) continue;
      if (cx > 0 && !!(cur[i - 1] & 1) !== !!(m & 4)) continue;
      if (cz > 0 && !!(cur[i - w] & 2) !== !!(m & 8)) continue;
      cur[i] = m;
      rec(i + 1);
    }
    cur[i] = 0;
  };
  rec(0);
  return { found, first, nodes };
}
PZ_GENS.circuit = {
  id: "circuit",
  n: "Enrutado de corriente",
  d: "Gira los conductos para que la corriente de la fuente alimente todas las baldosas.",
  icon: "⌁",
  dims: { 1: [4, 4], 2: [5, 5], 3: [6, 5] },
  lv: { 1: {}, 2: {}, 3: {} },
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      n = w * h;
    for (let att = 0; att < 100; att++) {
      const r = pzRng(pzMix(seed, tier, 0x4349, att)),
        adj = new Uint8Array(n),
        seen = new Uint8Array(n),
        src = r.int(0, n - 1);
      seen[src] = 1;
      const stack = [src];
      while (stack.length) {
        const c = stack[stack.length - 1],
          cx = c % w,
          cz = (c / w) | 0,
          opts = [];
        for (let d = 0; d < 4; d++) {
          const nx = cx + PZ_DX[d],
            nz = cz + PZ_DZ[d];
          if (nx >= 0 && nz >= 0 && nx < w && nz < h && !seen[nz * w + nx]) opts.push(d);
        }
        if (!opts.length || pzPop(adj[c]) >= 3) {
          stack.pop();
          continue;
        }
        const d = r.pick(opts),
          k = (cz + PZ_DZ[d]) * w + cx + PZ_DX[d];
        adj[c] |= 1 << d;
        adj[k] |= 1 << ((d + 2) & 3);
        seen[k] = 1;
        stack.push(k);
      }
      // celdas que el DFS dejó sueltas: se enganchan a un vecino con hueco
      for (let pass = 0, prog = true; prog && pass < 12; pass++) {
        prog = false;
        for (let c = 0; c < n; c++) {
          if (seen[c]) continue;
          const cx = c % w,
            cz = (c / w) | 0;
          for (const d of r.shuffle([0, 1, 2, 3])) {
            const nx = cx + PZ_DX[d],
              nz = cz + PZ_DZ[d];
            if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
            const k = nz * w + nx;
            if (!seen[k] || pzPop(adj[k]) >= 3) continue;
            adj[c] |= 1 << d;
            adj[k] |= 1 << ((d + 2) & 3);
            seen[c] = 1;
            prog = true;
            break;
          }
        }
      }
      if (seen.some((v) => !v)) continue;
      const lamps = [];
      for (let c = 0; c < n; c++) if (c !== src && pzPop(adj[c]) === 1) lamps.push(c);
      if (lamps.length < 2) continue;
      // giro inicial de cada baldosa (los giros no cambian el tipo)
      const rot0 = [];
      for (let c = 0; c < n; c++) rot0.push(r.int(0, 3));
      const cur = new Uint8Array(n),
        pw = new Uint8Array(n);
      for (let c = 0; c < n; c++) {
        let m = adj[c];
        for (let k = 0; k < rot0[c]; k++) m = ciRot(m);
        cur[c] = m;
      }
      const spec = { kind: "circuit", seed, tier, w, h, src, lamps, tiles: Array.from(adj), rot0 };
      if (ciPower(spec, cur, pw) === n) continue; // ya resuelto: se descarta
      // al menos 1/3 de las baldosas deben estar mal puestas
      let off = 0;
      for (let c = 0; c < n; c++) if (cur[c] !== adj[c]) off++;
      if (off < n / 3) continue;
      spec.sol = Array.from(adj);
      return spec;
    }
    return null;
  },
  validate(spec) {
    const n = spec.w * spec.h;
    if (spec.tiles.length !== n) return { ok: false, why: "rejilla incompleta" };
    const s = ciSolve(spec, 3);
    const cur = new Uint8Array(n),
      pw = new Uint8Array(n);
    for (let c = 0; c < n; c++) {
      let m = spec.tiles[c];
      for (let k = 0; k < spec.rot0[c]; k++) m = ciRot(m);
      cur[c] = m;
    }
    const solved0 = ciPower(spec, cur, pw) === n,
      solOk = ciPower(spec, Uint8Array.from(spec.sol), pw) === n;
    const ok = s.found >= 1 && !solved0 && solOk;
    return { ok, why: ok ? "" : !s.found ? "el buscador no encuentra solución" : solved0 ? "ya resuelto al empezar" : "solución guardada inválida", solutions: s.found, lamps: spec.lamps.length, nodes: s.nodes };
  },
  init(spec) {
    const st = pzBaseState(spec),
      n = spec.w * spec.h;
    st.mask = new Uint8Array(n);
    for (let c = 0; c < n; c++) {
      let m = spec.tiles[c];
      for (let k = 0; k < spec.rot0[c]; k++) m = ciRot(m);
      st.mask[c] = m;
    }
    st.pw = new Uint8Array(n);
    st.npw = ciPower(spec, st.mask, st.pw);
    st.live = false;
    return st;
  },
  reset(spec, st) {
    const n = spec.w * spec.h;
    for (let c = 0; c < n; c++) {
      let m = spec.tiles[c];
      for (let k = 0; k < spec.rot0[c]; k++) m = ciRot(m);
      st.mask[c] = m;
    }
    st.npw = ciPower(spec, st.mask, st.pw);
    st.rev++;
  },
  solved(spec, st) {
    return st.npw === spec.w * spec.h;
  },
  solid() {
    return false;
  },
  pick(spec, st, px, pz) {
    const cx = Math.floor(px),
      cz = Math.floor(pz);
    if (cx >= 0 && cz >= 0 && cx < spec.w && cz < spec.h) return cz * spec.w + cx;
    // fuera de la rejilla: la baldosa más cercana a 1,4 m
    let b = -1,
      bd = 1.4 * 1.4;
    for (let c = 0; c < spec.w * spec.h; c++) {
      const d = ((c % spec.w) + 0.5 - px) ** 2 + (((c / spec.w) | 0) + 0.5 - pz) ** 2;
      if (d < bd) ((bd = d), (b = c));
    }
    return b;
  },
  label() {
    return "Girar conducto";
  },
  act(spec, st, id, ctx) {
    st.mask[id] = ciRot(st.mask[id]);
    st.moves++;
    st.npw = ciPower(spec, st.mask, st.pw);
    st.rev++;
    ctx.snd("metal", { p: 0.9 + (st.npw / (spec.w * spec.h)) * 0.5 });
  },
  status(spec, st) {
    return [`Baldosas con corriente: ${st.npw}/${spec.w * spec.h}`, `Giros: ${st.moves}`];
  },
  hint(spec, st) {
    // una baldosa mal puesta, vista contra la solución guardada (alguna orientación equivalente cuenta como buena)
    for (let c = 0; c < spec.w * spec.h; c++) if (st.mask[c] !== spec.sol[c]) return { id: c, text: "Pista: esa baldosa no está en su posición." };
    return null;
  },
  bot(spec, st) {
    const acts = [];
    for (let c = 0; c < spec.w * spec.h; c++) {
      let m = st.mask[c],
        k = 0;
      while (m !== spec.sol[c] && k < 4) ((m = ciRot(m)), k++);
      for (let i = 0; i < k; i++) acts.push({ id: c, at: [(c % spec.w) + 0.5, ((c / spec.w) | 0) + 0.5] });
    }
    return acts;
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h;
    for (let c = 0; c < w * h; c++) {
      const cx = (c % w) + 0.5,
        cz = ((c / w) | 0) + 0.5,
        m = st.mask[c],
        on = st.pw[c];
      g.box(cx, cz, 0.025, 0.94, 0.05, 0.94, on ? 0x1d3a44 : 0x1a2128);
      const col = on ? 0x4fe0ff : 0x5b6672;
      for (let d = 0; d < 4; d++)
        if (m & (1 << d)) g.box(cx + PZ_DX[d] * 0.25, cz + PZ_DZ[d] * 0.25, 0.09, d & 1 ? 0.14 : 0.52, 0.08, d & 1 ? 0.52 : 0.14, col, on ? 1.5 : 0);
      g.cyl(cx, cz, 0.1, 0.12, 0.1, col, on ? 1.6 : 0);
    }
    for (const c of spec.lamps) {
      const on = st.pw[c];
      g.sph((c % w) + 0.5, ((c / w) | 0) + 0.5, 0.3, on ? 0.2 : 0.14, on ? 0xffe27a : 0x6a6540, on ? 2 : 0.3);
    }
    const sx = (spec.src % w) + 0.5,
      sz = ((spec.src / w) | 0) + 0.5;
    g.cyl(sx, sz, 0.24, 0.26, 0.4, 0x3b4650);
    g.sph(sx, sz, 0.5, 0.18 + Math.sin(t * 5) * 0.02, 0x7affc8, 2);
  },
};

// ───────── 3.6 PASILLO LÁSER ─────────
// Un pasillo de rejas láser con huecos que se desplazan. Cada fase (0,55 s) los huecos cambian; los que van a cerrarse parpadean.
// validate() explora TODOS los estados (columna, fila, fase) con la regla conservadora «moverse una celda por fase» y exige un camino.
var PZ_LASER_DT = 0.55;
function lsBlocked(spec, x, z, k) {
  const g = spec.gateAt[x];
  return g !== undefined && g >= 0 && !((spec.gates[g].open[k % spec.P] >> z) & 1);
}
PZ_GENS.lasers = {
  id: "lasers",
  n: "Pasillo láser",
  d: "Cruza las rejas láser por los huecos cuando se abran. Un toque te devuelve al principio.",
  icon: "⫼",
  dims: { 1: [7, 3], 2: [7, 4], 3: [7, 5] },
  lv: {
    1: { cols: [2, 4], P: 8 },
    2: { cols: [1, 3, 4], P: 8 },
    3: { cols: [1, 2, 4, 5], P: 10 },
  },
  animated: true,
  rotate: true, // se puede colocar girado 90° (corredor vertical)
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier];
    for (let att = 0; att < 100; att++) {
      const r = pzRng(pzMix(seed, tier, 0x4c53, att)),
        gates = P.cols.map((x) => {
          // hueco que se desplaza una fila cada DOS fases (así una celda abierta lo está al menos dos fases seguidas y se puede cruzar);
          // en el nivel 3 hay un segundo hueco desfasado
          let q = r.int(0, h - 1);
          const open = [],
            off = tier === 3 ? Math.ceil(h / 2) : 0;
          for (let j = 0; j < P.P / 2; j++) {
            let m = 1 << q;
            if (off) m |= 1 << ((q + off) % h);
            open.push(m, m);
            const s = r.pick([-1, 1]);
            q = q + s < 0 || q + s >= h ? q - s : q + s;
          }
          // las rejas contiguas se desfasan una fase: si no, nunca habría una celda abierta que enlace con la siguiente
          if (x & 1) open.push(open.shift());
          return { x, open };
        });
      const gateAt = new Int8Array(w).fill(-1);
      gates.forEach((g, i) => (gateAt[g.x] = i));
      const spec = { kind: "lasers", seed, tier, w, h, P: P.P, gates, gateAt: Array.from(gateAt) };
      const v = this.validate(spec);
      if (v.ok && v.steps >= 4 + tier && v.steps <= P.P * 2.2) return spec;
      if (att > 60 && v.ok) return spec;
    }
    return null;
  },
  validate(spec) {
    const { w, h, P } = spec;
    // BFS de estados (x, z, fase); se parte de la columna 0 en cualquier fase (se puede esperar fuera del pasillo)
    const idx = (x, z, k) => (x * h + z) * P + k,
      dist = new Int32Array(w * h * P).fill(-1),
      q = [];
    for (let z = 0; z < h; z++)
      for (let k = 0; k < P; k++) {
        dist[idx(0, z, k)] = 0;
        q.push(idx(0, z, k));
      }
    let steps = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const s = q[qi],
        k = s % P,
        z = ((s / P) | 0) % h,
        x = ((s / P / h) | 0);
      if (x === w - 1) {
        steps = dist[s];
        break;
      }
      for (let d = -1; d < 4; d++) {
        const nx = d < 0 ? x : x + PZ_DX[d],
          nz = d < 0 ? z : z + PZ_DZ[d];
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        // durante la fase k estás en (x,z) y llegas a (nx,nz): ambas deben ser seguras en k; en k+1 debe serlo (nx,nz)
        if (lsBlocked(spec, x, z, k) || lsBlocked(spec, nx, nz, k) || lsBlocked(spec, nx, nz, k + 1)) continue;
        const ns = idx(nx, nz, (k + 1) % P);
        if (dist[ns] >= 0) continue;
        dist[ns] = dist[s] + 1;
        q.push(ns);
      }
    }
    // cuántas fases de entrada permiten llegar al otro lado en ≤ 3 periodos (robustez: no depende de entrar en un instante exacto)
    let okStarts = 0;
    for (let k = 0; k < P; k++) {
      // alcanzabilidad desde (0, cualquier fila, k)
      const seen = new Uint8Array(w * h);
      let cur = [];
      for (let z = 0; z < h; z++) if (!lsBlocked(spec, 0, z, k)) ((seen[z] = 1), cur.push(z * 1)); // celda (0,z) = índice x*h+z
      let reached = false;
      for (let t = 0; t < P * 3 && !reached; t++) {
        const kk = (k + t) % P,
          nxt = new Set();
        for (const c of cur) {
          const x = (c / h) | 0,
            z = c % h;
          nxt.add(c); // esperar
          for (let d = 0; d < 4; d++) {
            const nx = x + PZ_DX[d],
              nz = z + PZ_DZ[d];
            if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
            if (lsBlocked(spec, x, z, kk) || lsBlocked(spec, nx, nz, kk) || lsBlocked(spec, nx, nz, kk + 1)) continue;
            nxt.add(nx * h + nz);
          }
        }
        cur = [...nxt].filter((c) => !lsBlocked(spec, (c / h) | 0, c % h, kk + 1));
        if (cur.some((c) => ((c / h) | 0) === w - 1)) reached = true;
      }
      if (reached) okStarts++;
    }
    const ok = steps >= 0 && okStarts === P;
    return { ok, why: ok ? "" : steps < 0 ? "no hay camino" : "hay fases de entrada sin salida", steps, startsOk: okStarts, gates: spec.gates.length };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.k = 0;
    st.ph = 0;
    st.hits = 0;
    st.inv = 0;
    st.maxX = 0;
    st.live = true;
    return st;
  },
  reset(spec, st) {
    st.maxX = 0;
    st.rev++;
  },
  solved(spec, st) {
    return st.reached === true;
  },
  solid() {
    return false;
  },
  pick() {
    return -1;
  },
  step(spec, st, dt, ctx) {
    st.t += dt;
    const k = Math.floor(st.t / PZ_LASER_DT) % spec.P;
    if (k !== st.k) {
      st.k = k;
      st.rev++;
    }
    st.ph = (st.t % PZ_LASER_DT) / PZ_LASER_DT;
    if (st.inv > 0) st.inv -= dt;
    if (!ctx.inside) return;
    const cx = Math.floor(ctx.px),
      cz = Math.floor(ctx.pz),
      fx = ctx.px - cx,
      fz = ctx.pz - cz;
    if (cx < 0 || cz < 0 || cx >= spec.w || cz >= spec.h) return;
    if (cx <= st.maxX + 2) st.maxX = Math.max(st.maxX, cx);
    if (cx === spec.w - 1 && st.maxX >= spec.w - 2) {
      st.reached = true;
      return;
    }
    // un hueco de 0,12 m a cada lado de la celda perdona el roce con la reja
    if (lsBlocked(spec, cx, cz, k) && fx > 0.12 && fx < 0.88 && fz > 0.12 && fz < 0.88 && st.inv <= 0) {
      st.hits++;
      st.errors++;
      st.inv = 1.3;
      st.maxX = 0;
      ctx.snd("zap");
      ctx.hurt(PZ_CFG.respawnPenalty);
      ctx.teleport(0.5, cz + 0.5);
      st.rev++;
    }
  },
  status(spec, st) {
    return [`Cruza el pasillo hasta la salida`, ...(st.hits ? [`Descargas recibidas: ${st.hits}`] : [])];
  },
  hint() {
    return { text: "Pista: los hilos amarillos son rejas que se cierran en el siguiente instante; avanza una celda por parpadeo." };
  },
  bot(spec, st) {
    // camino por tiempo: simulación del BFS en fase: lista de (celda, tiempo)
    const { w, h, P } = spec,
      idx = (x, z, k) => (x * h + z) * P + k,
      par = new Int32Array(w * h * P).fill(-2),
      q = [];
    for (let z = 0; z < h; z++) for (let k = 0; k < P; k++) if (!lsBlocked(spec, 0, z, k)) ((par[idx(0, z, k)] = -1), q.push(idx(0, z, k)));
    let goal = -1;
    for (let qi = 0; qi < q.length && goal < 0; qi++) {
      const s = q[qi],
        k = s % P,
        z = ((s / P) | 0) % h,
        x = (s / P / h) | 0;
      if (x === w - 1) {
        goal = s;
        break;
      }
      for (let d = -1; d < 4; d++) {
        const nx = d < 0 ? x : x + PZ_DX[d],
          nz = d < 0 ? z : z + PZ_DZ[d];
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        if (lsBlocked(spec, x, z, k) || lsBlocked(spec, nx, nz, k) || lsBlocked(spec, nx, nz, k + 1)) continue;
        const ns = idx(nx, nz, (k + 1) % P);
        if (par[ns] !== -2) continue;
        par[ns] = s;
        q.push(ns);
      }
    }
    if (goal < 0) return null;
    const path = [];
    for (let s = goal; s >= 0; s = par[s]) path.push({ x: (s / P / h) | 0, z: ((s / P) | 0) % h, k: s % P });
    path.reverse();
    return path; // cada paso dura una fase; empieza en la fase path[0].k
  },
  draw(spec, st, g, t) {
    const { w, h, P } = spec,
      k = st.k;
    for (let z = 0; z < h; z++)
      for (let x = 0; x < w; x++) g.box(x + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, x === 0 ? 0x2f4a36 : x === w - 1 ? 0x2a4a5a : (x + z) & 1 ? 0x2a2326 : 0x241e21);
    for (const gt of spec.gates) {
      // postes en los dos extremos de cada reja
      g.cyl(gt.x + 0.5, -0.3, 0.5, 0.14, 1, 0x5a6068);
      g.cyl(gt.x + 0.5, h + 0.3, 0.5, 0.14, 1, 0x5a6068);
      for (let z = 0; z < h; z++) {
        const blockedNow = !((gt.open[k] >> z) & 1),
          blockedNext = !((gt.open[(k + 1) % P] >> z) & 1);
        if (blockedNow) g.box(gt.x + 0.5, z + 0.5, 0.5, 0.9, 1, 0.9, 0xff2a3a, 1.7);
        else if (blockedNext) g.box(gt.x + 0.5, z + 0.5, 0.14, 0.8, 0.05, 0.8, Math.sin(t * 18) > 0 ? 0xffd04a : 0x6a5a20, 1.3);
      }
    }
  },
};

// ───────── 3.7 SUELO DE MEMORIA ─────────
// El suelo muestra unos segundos el camino seguro (de la fila de entrada a la de salida); luego se apaga. Pisar una baldosa
// falsa descarga y te devuelve al principio (y vuelve a mostrar el camino). validate(): el camino conecta y no tiene atajos.
PZ_GENS.memory = {
  id: "memory",
  n: "Suelo de memoria",
  d: "Memoriza el camino que se ilumina y recórrelo sin pisar las baldosas falsas.",
  icon: "▦",
  dims: { 1: [5, 5], 2: [6, 5], 3: [7, 6] },
  lv: { 1: { len: [5, 7] }, 2: { len: [7, 9] }, 3: { len: [9, 12] } },
  animated: true,
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      L = this.lv[tier].len;
    let best = null;
    for (let att = 0; att < 60; att++) {
      const r = pzRng(pzMix(seed, tier, 0x4d45, att)),
        path = [],
        inPath = new Uint8Array(w * h);
      let nodes = 0,
        found = null;
      const rec = (c) => {
        if (found || nodes++ > 6000) return;
        path.push(c);
        inPath[c] = 1;
        const cx = c % w,
          cz = (c / w) | 0;
        if (cz === h - 2 && path.length >= L[0]) {
          found = path.slice();
        } else if (path.length < L[1]) {
          for (const d of r.shuffle([0, 1, 2, 3])) {
            const nx = cx + PZ_DX[d],
              nz = cz + PZ_DZ[d];
            if (nx < 0 || nx >= w || nz < 1 || nz > h - 2) continue;
            const k = nz * w + nx;
            if (inPath[k]) continue;
            // sin atajos: la celda nueva solo puede tocar (por un lado) a la actual
            let touch = 0;
            for (let e = 0; e < 4; e++) {
              const ax = nx + PZ_DX[e],
                az = nz + PZ_DZ[e];
              if (ax >= 0 && ax < w && az >= 0 && az < h && inPath[az * w + ax]) touch++;
            }
            if (touch !== 1) continue;
            rec(k);
            if (found) break;
          }
        }
        if (!found) {
          path.pop();
          inPath[c] = 0;
        }
      };
      rec(1 * w + r.int(0, w - 1));
      if (found) return { kind: "memory", seed, tier, w, h, path: found, show: Math.round((2.4 + 0.3 * found.length) * 10) / 10 };
      if (!best && path.length) best = null;
    }
    return best;
  },
  validate(spec) {
    const { w, h, path } = spec,
      n = w * h;
    const L = this.lv[spec.tier].len;
    let ok = path.length >= 3 && path.length >= L[0] && path.length <= L[1] && new Set(path).size === path.length;
    if (ok) ok = path[0] >= w && path[0] < 2 * w && ((path[path.length - 1] / w) | 0) === h - 2;
    for (let i = 0; ok && i + 1 < path.length; i++) {
      const a = path[i],
        b = path[i + 1];
      if (Math.abs((a % w) - (b % w)) + Math.abs(((a / w) | 0) - ((b / w) | 0)) !== 1) ok = false;
    }
    // sin atajos: el BFS por celdas seguras da exactamente path.length - 1 pasos
    let steps = -1;
    if (ok) {
      const safe = new Uint8Array(n);
      for (const c of path) safe[c] = 1;
      const D = new Int16Array(n).fill(-1),
        q = [path[0]],
        nb = [0, 0, 0, 0];
      D[path[0]] = 0;
      for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi],
          m = pzNeigh(w, h, c, nb);
        for (let i = 0; i < m; i++) if (safe[nb[i]] && D[nb[i]] < 0) ((D[nb[i]] = D[c] + 1), q.push(nb[i]));
      }
      steps = D[path[path.length - 1]];
      ok = steps === path.length - 1;
    }
    return { ok, why: ok ? "" : "camino inválido", len: path.length, steps, show: spec.show };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.prog = -1;
    st.show = 0;
    st.seen = false;
    st.bad = -1;
    st.badT = 0;
    st.live = true;
    st.at = new Int16Array(spec.w * spec.h).fill(-1);
    spec.path.forEach((c, i) => (st.at[c] = i));
    return st;
  },
  reset(spec, st) {
    st.prog = -1;
    st.show = spec.show * 0.6;
    st.rev++;
  },
  solved(spec, st) {
    return st.reached === true;
  },
  solid() {
    return false;
  },
  pick(spec, st, px, pz) {
    return ctxInRect(spec, px, pz) && Math.floor(pz) === 0 ? 0 : -1;
  },
  label() {
    return "Memorizar el camino";
  },
  act(spec, st, id, ctx) {
    st.show = spec.show;
    st.live = true;
    ctx.snd("beep", { p: 1.1 });
    st.rev++;
  },
  step(spec, st, dt, ctx) {
    st.t += dt;
    if (st.show > 0) st.show -= dt;
    if (st.badT > 0) st.badT -= dt;
    if (!ctx.inside) return;
    const cx = Math.floor(ctx.px),
      cz = Math.floor(ctx.pz),
      fx = ctx.px - cx,
      fz = ctx.pz - cz;
    if (cx < 0 || cz < 0 || cx >= spec.w || cz >= spec.h) return;
    if (cz === 0) {
      // la fila de entrada: primera vez, enseña el camino solo
      if (!st.seen) {
        st.seen = true;
        st.show = spec.show;
        ctx.toast("Memoriza el camino iluminado.", "quest");
      }
      st.prog = -1;
      return;
    }
    if (cz === spec.h - 1) {
      if (st.prog === spec.path.length - 1) st.reached = true;
      return;
    }
    // solo se juzga cuando estás bien dentro de la baldosa (el roce de una esquina no castiga)
    if (fx < 0.2 || fx > 0.8 || fz < 0.2 || fz > 0.8) return;
    const k = st.at[cz * spec.w + cx];
    if (k >= 0) {
      if (k === st.prog + 1) {
        st.prog = k;
        st.rev++;
        ctx.snd("beep", { p: 0.8 + k * 0.05 });
      }
    } else if (st.show <= 0 || true) {
      st.errors++;
      st.bad = cz * spec.w + cx;
      st.badT = 0.9;
      st.prog = -1;
      st.show = spec.show * 0.8;
      ctx.snd("zap");
      ctx.hurt(PZ_CFG.respawnPenalty * 0.8);
      ctx.teleport(cx + 0.5, 0.5);
      st.rev++;
    }
  },
  status(spec, st) {
    return [st.show > 0 ? "Memoriza el camino…" : `Camino recorrido: ${Math.max(0, st.prog + 1)}/${spec.path.length}`, ...(st.errors ? [`Descargas: ${st.errors}`] : [])];
  },
  hint(spec, st) {
    return { text: "Pista: vuelve a la fila de entrada y pulsa USAR para ver el camino otra vez." };
  },
  bot(spec) {
    return spec.path.map((c) => ({ at: [(c % spec.w) + 0.5, ((c / spec.w) | 0) + 0.5] })).concat([{ at: [(spec.path[spec.path.length - 1] % spec.w) + 0.5, spec.h - 0.5] }]);
  },
  draw(spec, st, g, t) {
    const { w, h } = spec,
      showing = st.show > 0;
    for (let z = 0; z < h; z++)
      for (let x = 0; x < w; x++) {
        const c = z * w + x,
          k = st.at[c];
        let col = z === 0 ? 0x4a4224 : z === h - 1 ? 0x1f4a52 : (x + z) & 1 ? 0x252a31 : 0x20252c,
          gl = 0;
        if (z > 0 && z < h - 1) {
          if (showing && k >= 0) {
            col = 0x3cff8a;
            gl = 1.1 + Math.sin(t * 8 - k * 0.7) * 0.4;
          } else if (k >= 0 && k <= st.prog) {
            col = 0x2f7a4c;
            gl = 0.3;
          }
          if (c === st.bad && st.badT > 0) {
            col = 0xff3b3b;
            gl = 1.6;
          }
        }
        g.box(x + 0.5, z + 0.5, 0.03, 0.92, 0.06, 0.92, col, gl);
      }
  },
};
// ¿La posición (en celdas) está dentro del rectángulo de la cámara? (para pick() de generadores sin objetos)
function ctxInRect(spec, px, pz) {
  return px >= 0 && pz >= 0 && px < spec.w && pz < spec.h;
}

// ───────── 3.8 VÁLVULAS DE INUNDACIÓN / ÁCIDO ─────────
// Cada carril lleva un líquido distinto de izquierda a derecha; las válvulas (consolas, E) cruzan dos carriles contiguos.
// Hay que dejar cada líquido en su depósito. En el nivel 3 hay válvulas enlazadas (al girar una gira su pareja).
var PZ_LIQ = [
  { n: "Ácido", col: 0x6bff4a },
  { n: "Agua", col: 0x3f8cff },
  { n: "Refrigerante", col: 0x4fe0ff },
  { n: "Lodo", col: 0xb5733a },
  { n: "Plasma", col: 0xff4fd8 },
];
function vaRun(spec, mask, cols) {
  // cols[s][i] = líquido del carril i antes de la etapa s (cols[3] = salida)
  let cur = [];
  for (let i = 0; i < spec.h; i++) cur.push(i);
  if (cols) cols[0] = cur.slice();
  for (let s = 0; s < 3; s++) {
    cur = cur.slice();
    spec.valves.forEach((v, vi) => {
      if (v.s === s && (mask >> vi) & 1) {
        const t = cur[v.i];
        cur[v.i] = cur[v.i + 1];
        cur[v.i + 1] = t;
      }
    });
    if (cols) cols[s + 1] = cur.slice();
  }
  return cur;
}
function vaEq(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function vaControls(spec) {
  const used = new Set(),
    ctl = [];
  for (const [a, b] of spec.links) {
    ctl.push((1 << a) | (1 << b));
    used.add(a);
    used.add(b);
  }
  for (let v = 0; v < spec.valves.length; v++) if (!used.has(v)) ctl.push(1 << v);
  return ctl;
}
PZ_GENS.valves = {
  id: "valves",
  n: "Válvulas de inundación",
  d: "Cruza los carriles con las válvulas para que cada líquido llegue a su depósito.",
  icon: "⛭",
  dims: { 1: [7, 3], 2: [7, 4], 3: [7, 5] },
  lv: { 1: { links: 0, minTog: 2 }, 2: { links: 0, minTog: 2 }, 3: { links: 1, minTog: 3 } },
  rotate: true,
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier];
    const valves = [];
    for (let s = 0; s < 3; s++) for (let i = s % 2; i + 1 < h; i += 2) valves.push({ s, i, x: 1 + 2 * s });
    for (let att = 0; att < 200; att++) {
      const r = pzRng(pzMix(seed, tier, 0x5641, att)),
        V = valves.length,
        links = [];
      if (P.links) {
        const a = r.int(0, V - 1),
          cand = [];
        for (let b = 0; b < V; b++) if (b !== a && valves[b].s !== valves[a].s) cand.push(b);
        cand.length && links.push([a, r.pick(cand)]);
      }
      const spec = { kind: "valves", seed, tier, w, h, valves, links, init: 0, target: [], sol: 0 };
      const ctl = vaControls(spec);
      let init = 0;
      for (let v = 0; v < V; v++) if (r() < 0.4) init |= 1 << v;
      // la solución: un subconjunto de mandos (≥ minTog) aplicado al estado inicial
      const pick = r.shuffle(ctl.slice()).slice(0, Math.min(ctl.length, r.int(P.minTog, Math.max(P.minTog, ctl.length - 1))));
      let solMask = init;
      for (const c of pick) solMask ^= c;
      const target = vaRun(spec, solMask, null);
      if (vaEq(target, vaRun(spec, init, null))) continue;
      if (target.every((c, i) => c === i) && r() < 0.8) continue; // la identidad (todo recto) es demasiado fácil
      spec.init = init;
      spec.target = target;
      spec.sol = solMask;
      return spec;
    }
    return null;
  },
  validate(spec) {
    const ctl = vaControls(spec),
      C = ctl.length;
    let nsol = 0,
      minTog = 99;
    for (let m = 0; m < 1 << C; m++) {
      let mask = spec.init;
      for (let i = 0; i < C; i++) if ((m >> i) & 1) mask ^= ctl[i];
      if (vaEq(vaRun(spec, mask, null), spec.target)) {
        nsol++;
        minTog = Math.min(minTog, pzPop(m));
      }
    }
    const solved0 = vaEq(vaRun(spec, spec.init, null), spec.target),
      solOk = vaEq(vaRun(spec, spec.sol, null), spec.target);
    const ok = nsol > 0 && !solved0 && solOk;
    return { ok, why: ok ? "" : !nsol ? "sin solución" : solved0 ? "ya resuelto al empezar" : "solución guardada inválida", nsol, minTog, controls: C, valves: spec.valves.length };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.mask = spec.init;
    st.cols = [[], [], [], []];
    st.out = vaRun(spec, st.mask, st.cols);
    st.live = true;
    st.cellSet = new Set(spec.valves.map((v) => v.i * spec.w + v.x));
    return st;
  },
  reset(spec, st) {
    st.mask = spec.init;
    st.out = vaRun(spec, st.mask, st.cols);
    st.rev++;
  },
  solved(spec, st) {
    return vaEq(st.out, spec.target);
  },
  solid(spec, st, cx, cz) {
    return st.cellSet.has(cz * spec.w + cx);
  },
  pick(spec, st, px, pz) {
    let b = -1,
      bd = PZ_CFG.reach * PZ_CFG.reach;
    for (let i = 0; i < spec.valves.length; i++) {
      const v = spec.valves[i],
        d = (v.x + 0.5 - px) ** 2 + (v.i + 0.5 - pz) ** 2;
      if (d < bd) ((bd = d), (b = i));
    }
    return b;
  },
  label() {
    return "Girar válvula";
  },
  act(spec, st, id, ctx) {
    st.mask ^= 1 << id;
    for (const [a, b] of spec.links) {
      if (a === id) st.mask ^= 1 << b;
      else if (b === id) st.mask ^= 1 << a;
    }
    st.moves++;
    st.out = vaRun(spec, st.mask, st.cols);
    st.rev++;
    ctx.snd("metal", { p: 0.7 });
  },
  status(spec, st) {
    let ok = 0;
    st.out.forEach((c, i) => c === spec.target[i] && ok++);
    return [`Depósitos correctos: ${ok}/${spec.h}`, `Giros: ${st.moves}`];
  },
  hint(spec, st) {
    // una válvula que hay que cambiar para acercarse a la solución más próxima
    const ctl = vaControls(spec);
    let bestM = -1,
      bestD = 99;
    for (let m = 0; m < 1 << ctl.length; m++) {
      let mask = spec.init;
      for (let i = 0; i < ctl.length; i++) if ((m >> i) & 1) mask ^= ctl[i];
      if (!vaEq(vaRun(spec, mask, null), spec.target)) continue;
      const d = pzPop(mask ^ st.mask);
      if (d < bestD) ((bestD = d), (bestM = mask));
    }
    if (bestM < 0) return null;
    const diff = bestM ^ st.mask;
    for (let v = 0; v < spec.valves.length; v++) if ((diff >> v) & 1) return { id: v, text: "Pista: esa válvula está mal puesta." };
    return null;
  },
  bot(spec, st) {
    const ctl = vaControls(spec);
    let best = null;
    for (let m = 0; m < 1 << ctl.length; m++) {
      let mask = spec.init;
      for (let i = 0; i < ctl.length; i++) if ((m >> i) & 1) mask ^= ctl[i];
      if (!vaEq(vaRun(spec, mask, null), spec.target)) continue;
      // controles a pulsar desde el estado actual: los que difieren (una válvula por mando)
      const diff = mask ^ st.mask;
      let n = 0;
      const acts = [];
      for (let i = 0; i < ctl.length; i++) {
        // el mando i está «activo» si cambia respecto al actual: se pulsa la primera válvula del mando
        const bits = ctl[i];
        if ((diff & bits) !== 0) {
          const v = Math.log2(bits & -bits);
          acts.push({ id: v, at: [spec.valves[v].x + 0.5, spec.valves[v].i + 0.5] });
          n++;
        }
      }
      if (!best || n < best.length) best = acts;
    }
    return best;
  },
  draw(spec, st, g, t) {
    const { w, h } = spec,
      cols = st.cols;
    const colAt = (i, x) => cols[x <= 1 ? 0 : x <= 3 ? 1 : x <= 5 ? 2 : 3][i];
    // el valor en la columna de la válvula: antes de la etapa s a la izquierda y después a la derecha
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        g.box(x + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, (x + z) & 1 ? 0x212b2e : 0x1b2427);
        const L = x === 0 ? cols[0][z] : x === w - 1 ? cols[3][z] : x === 2 ? cols[1][z] : x === 4 ? cols[2][z] : colAt(z, x);
        const col = PZ_LIQ[L].col;
        g.box(x + 0.5, z + 0.5, 0.1, 1, 0.1, 0.34, col, 1.1 + Math.sin(t * 4 + x * 0.8) * 0.15);
      }
    }
    for (const v of spec.valves) {
      const on = (st.mask >> spec.valves.indexOf(v)) & 1,
        cx = v.x + 0.5,
        cz = v.i + 0.5;
      g.cyl(cx, cz, 0.3, 0.3, 0.6, 0x3b4650);
      g.ring(cx, cz, 0.68, 0.24, on ? 0xffc24a : 0x7a8591, on ? 1.5 : 0.2);
      g.box(cx, cz, 0.68, 0.5, 0.06, 0.06, on ? 0xffc24a : 0x7a8591, on ? 1.4 : 0, t * (on ? 2 : 0));
      if (on) {
        // cruce abierto: dos tubos en diagonal que unen los dos carriles
        const lA = PZ_LIQ[st.cols[v.s][v.i]].col,
          lB = PZ_LIQ[st.cols[v.s][v.i + 1]].col,
          a = Math.atan2(1, 0.8);
        g.box(cx, cz + 0.5, 0.2, 1.3, 0.1, 0.12, lA, 1.6, a);
        g.box(cx, cz + 0.5, 0.22, 1.3, 0.1, 0.12, lB, 1.6, -a);
      }
    }
    for (let i = 0; i < h; i++) {
      const ok = st.out[i] === spec.target[i];
      g.cyl(0.5, i + 0.5, 0.3, 0.32, 0.6, 0x3b4650);
      g.cyl(0.5, i + 0.5, 0.64, 0.24, 0.1, PZ_LIQ[i].col, 1.4);
      g.cyl(w - 0.5, i + 0.5, 0.3, 0.32, 0.6, 0x3b4650);
      g.ring(w - 0.5, i + 0.5, 0.64, 0.26, PZ_LIQ[spec.target[i]].col, ok ? 2 : 0.7);
      g.sph(w - 0.5, i + 0.5, 0.74, ok ? 0.16 : 0.1, PZ_LIQ[st.out[i]].col, ok ? 2 : 0.6);
    }
  },
};

// ───────── 3.9 LOS CLÁSICOS: «switch» y «sequence» (los juega 22-quests.js; aquí quedan registrados y con validate) ─────────
PZ_GENS.switch = {
  id: "switch",
  n: "Placas encadenadas",
  d: "Cada placa alterna su estado y el de sus vecinas. Enciéndelas todas. (Cámara sellada)",
  legacy: true,
  dims: {},
  lv: {},
  make(seed, tier) {
    const r = pzRng(pzMix(seed, tier, 0x5357)),
      n = 6,
      st = new Array(n).fill(1),
      tog = (i) => [i - 1, i, i + 1].forEach((j) => (st[(j + n) % n] ^= 1)),
      k = 3 + (tier >= 3 ? 1 : 0),
      pick = new Set();
    while (pick.size < k) pick.add(r.int(0, n - 1));
    for (const i of pick) tog(i);
    if (st.every((v) => v)) tog(0);
    return { kind: "switch", seed, tier, n, init: st.slice() };
  },
  validate(spec) {
    const n = spec.n,
      seen = new Map(),
      start = spec.init.reduce((a, v, i) => a | (v << i), 0),
      goal = (1 << n) - 1;
    const q = [start];
    seen.set(start, 0);
    for (let qi = 0; qi < q.length; qi++) {
      const s = q[qi];
      if (s === goal) break;
      for (let i = 0; i < n; i++) {
        let m = s;
        for (const j of [i - 1, i, i + 1]) m ^= 1 << ((j + n) % n);
        if (!seen.has(m)) (seen.set(m, seen.get(s) + 1), q.push(m));
      }
    }
    const ok = seen.has(goal) && start !== goal;
    return { ok, why: ok ? "" : "no se puede encender todo", presses: ok ? seen.get(goal) : -1 };
  },
};
PZ_GENS.sequence = {
  id: "sequence",
  n: "Secuencia del pilar",
  d: "Repite el orden en que el pilar ilumina las placas. (Cámara sellada)",
  legacy: true,
  dims: {},
  lv: {},
  make(seed, tier) {
    const r = pzRng(pzMix(seed, tier, 0x5345)),
      n = 5,
      len = tier === 1 ? 3 : tier === 2 ? 4 : 5 + (r() < 0.5 ? 1 : 0),
      seq = [];
    let prev = -1;
    for (let i = 0; i < len; i++) {
      let o;
      do o = r.int(0, n - 1);
      while (o === prev);
      seq.push(o);
      prev = o;
    }
    return { kind: "sequence", seed, tier, n, seq };
  },
  validate(spec) {
    const ok = spec.seq.length >= 3 && spec.seq.length <= 6 && spec.seq.every((v, i) => v >= 0 && v < spec.n && (i === 0 || v !== spec.seq[i - 1]));
    return { ok, why: ok ? "" : "secuencia inválida", len: spec.seq.length };
  },
};
// ▲▲ PURO ▲▲
// @@FIN@@

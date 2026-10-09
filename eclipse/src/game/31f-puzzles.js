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
  chance: 0.55, // probabilidad de sala de acertijo en un subterráneo de edificio o cueva (estable por escalera; no si ya tiene su «cámara sellada»)
  chanceOp: 0.6, // ... y en una operación
  loreChance: 0.7, // en el Desierto y la Colmena, probabilidad de que el acertijo sea el de runas dictado por el Archivo
  nearM: 1.8, // m al borde del puzle a partir de los cuales aparece su tarjeta y se puede usar
  parSlack: 1.75, // «perfecto» exige no pasarse de este múltiplo de los movimientos de referencia (+2)
  respawnMin: 120, // minutos hasta que un acertijo resuelto vuelve a dar premio (igual que los cofres)
  tierByLvl: [
    [0, 1],
    [10, 2],
    [22, 3],
  ], // nivel mínimo de la mazmorra → nivel del acertijo (± 1 por azar)
  reach: 1.75, // alcance de interacción (celdas)
  // reparto de tipos (peso) por tema de mazmorra: los tipos «de movimiento» van a las naves y túneles, la lógica a los búnkeres
  weights: {
    default: { mirrors: 1, boxes: 1, timed: 1, runes: 1, circuit: 1, lasers: 1, memory: 1, valves: 1, sink: 1, ice: 1, lock: 1 },
    sotano: { mirrors: 1, boxes: 1.2, timed: 1, runes: 0.8, circuit: 1.3, lasers: 1.2, memory: 0.8, valves: 1, sink: 1.2, ice: 0.6, lock: 1.2 },
    planta: { mirrors: 1.3, boxes: 0.8, timed: 1, runes: 1, circuit: 1.2, lasers: 1.3, memory: 1, valves: 0.8, sink: 1, ice: 0.7, lock: 1.4 },
    gruta: { mirrors: 0.9, boxes: 1.3, timed: 1.2, runes: 1.3, circuit: 0.6, lasers: 0.6, memory: 1.2, valves: 1.1, sink: 1.3, ice: 1.5, lock: 0.8 },
    colmena: { mirrors: 0.8, boxes: 1, timed: 1.2, runes: 1.2, circuit: 0.7, lasers: 0.6, memory: 1.4, valves: 1.4, sink: 1.3, ice: 0.9, lock: 0.9 },
    alcantarilla: { mirrors: 0.8, boxes: 1, timed: 1, runes: 0.7, circuit: 1, lasers: 0.9, memory: 1, valves: 1.8, sink: 1.1, ice: 1.2, lock: 0.7 },
  },
  // premio: XP (fracción de la barra), créditos (× mt.credits(nivel)) y cofre (tier 1-3 del sistema de ECONOMÍA)
  // (el cofre de tier N sale del sistema de botín de ECONOMÍA, con sus tablas de rareza; aquí solo lo que añade el acertijo)
  reward: { xp: { 1: 0.05, 2: 0.08, 3: 0.12 }, credits: { 1: 6, 2: 10, 3: 16 }, perfectXp: 0.04, perfectCredits: 0.5, hackMul: 0.6, lore: { 1: 0.1, 2: 0.2, 3: 0.35 } },
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
// Listas derivadas del spec que se piden en cada fotograma (celdas de los objetos, etiquetas…): se calculan una vez por spec
var PZ_MEMO = new WeakMap();
function pzMemo(spec, key, build) {
  let m = PZ_MEMO.get(spec);
  if (!m) PZ_MEMO.set(spec, (m = {}));
  return m[key] || (m[key] = build());
}
// Objeto más cercano (celdas [cx, cz]) dentro del alcance; a igualdad de distancia gana el que tienes delante (fx, fz = hacia dónde miras).
// La mirada es solo un desempate suave (con ratón es el puntero; en táctil, tu último movimiento o el enemigo al que apunta el arma).
function pzNearest(cells, px, pz, fx, fz) {
  let best = -1,
    bs = PZ_CFG.reach + 1;
  for (let i = 0; i < cells.length; i++) {
    const dx = cells[i][0] + 0.5 - px,
      dz = cells[i][1] + 0.5 - pz,
      d = Math.hypot(dx, dz);
    if (d > PZ_CFG.reach) continue;
    const sc = d - (fx !== undefined && d > 1e-6 ? 0.35 * ((dx * fx + dz * fz) / d) : 0);
    if (sc < bs) ((bs = sc), (best = i));
  }
  return best;
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
      if (!pzAccess(this, spec).ok) continue; // ningún espejo puede quedar encerrado entre pilares
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
  pick(spec, st, px, pz, fx, fz) {
    return pzNearest(pzMemo(spec, "mc", () => spec.mir.map((m) => [m.x, m.z])), px, pz, fx, fz);
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
  hackable: true,
  spots(spec) {
    return spec.mir.map((m) => [m.x, m.z]);
  },
  focus(spec, st, id) {
    const m = spec.mir[id];
    return m ? [m.x, m.z] : null;
  },
  par(spec) {
    return this.bot(spec, this.init(spec)).length;
  },
  solve(spec, st) {
    st.ori = spec.sol.slice();
    st.nlit = mirTrace(spec, st.ix, st.ori, st.lit, st.segs);
    st.rev++;
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
    for (let i = 0; i < spec.em.length; i++) {
      const e = spec.em[i];
      g.box(e.x + 0.5, e.z + 0.5, 0.25, 0.7, 0.5, 0.7, 0x2c3944);
      g.sph(e.x + 0.5 + PZ_DX[e.d] * 0.18, e.z + 0.5 + PZ_DZ[e.d] * 0.18, 0.55, 0.2, PZ_BEAM_COL[i], 1.6);
    }
    for (let i = 0; i < spec.tg.length; i++) {
      const q = spec.tg[i],
        c = PZ_BEAM_COL[q.c],
        on = st.lit[i];
      g.box(q.x + 0.5, q.z + 0.5, 0.12, 0.8, 0.24, 0.8, 0x2c3944);
      g.ring(q.x + 0.5, q.z + 0.5, 0.3, 0.34, c, on ? 1.6 : 0.45);
      g.sph(q.x + 0.5, q.z + 0.5, 0.42, on ? 0.2 + Math.sin(t * 6) * 0.03 : 0.12, c, on ? 2 : 0.4);
    }
    for (let i = 0; i < spec.mir.length; i++) {
      const m = spec.mir[i];
      g.cyl(m.x + 0.5, m.z + 0.5, 0.18, 0.2, 0.36, 0x3b4650);
      g.box(m.x + 0.5, m.z + 0.5, 0.62, 0.86, 0.6, 0.07, 0xbfeaff, 0, st.ori[i] === 0 ? Math.PI / 4 : -Math.PI / 4);
    }
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
// La rejilla se amplía con un anillo exterior libre (el jugador entra por cualquier borde libre y puede salir y volver a entrar):
// así la prueba modela lo que pasa de verdad al jugar. p0 = celda del puzle donde está el jugador (-1 o sin dato: fuera).
function sokSolve(spec, cap, boxes0, p0) {
  const w0 = spec.w,
    h0 = spec.h,
    w = w0 + 2,
    h = h0 + 2,
    n = w * h,
    nb = spec.goals.length,
    wall = new Uint8Array(n),
    goal = new Uint8Array(n),
    reach = new Uint8Array(n),
    blk = new Uint8Array(n),
    qa = new Int32Array(n);
  const E = (c) => (((c / w0) | 0) + 1) * w + (c % w0) + 1, // celda del puzle → celda ampliada
    U = (c) => ((c / w) | 0) * w0 - w0 + (c % w) - 1; // y al revés
  for (const q of spec.walls) wall[E(q)] = 1;
  for (const q of spec.goals) goal[E(q)] = 1;
  const flood = (boxes, p) => {
    blk.set(wall);
    for (const b of boxes) blk[b] = 1;
    return sokFlood(w, h, blk, p, reach, qa);
  };
  const keyOf = (boxes, rep) => {
    let k = 0;
    for (const b of boxes) k = k * 128 + b;
    return k * 128 + rep;
  };
  const isGoal = (boxes) => {
    for (const b of boxes) if (!goal[b]) return false;
    return true;
  };
  const start = (boxes0 || spec.boxes).map(E).sort((a, b) => a - b);
  if (isGoal(start)) return { ok: true, pushes: 0, sol: [], states: 1 };
  const rep0 = flood(start, p0 === undefined || p0 < 0 ? 0 : E(p0));
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
        // la caja solo se mueve dentro del puzle (no sobre el anillo exterior)
        if (px < 0 || pz < 0 || px >= w || pz >= h || tx < 1 || tz < 1 || tx > w0 || tz > h0) continue;
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
        nodes.push({ boxes: nbx, rep, par: qi, act: [U(c), d] });
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
  // Empuja la caja que tienes al lado, en la dirección jugador → caja. Si hay dos a tiro, manda hacia dónde miras (fx, fz).
  pick(spec, st, px, pz, fx, fz) {
    let best = -1,
      bs = 9;
    for (let i = 0; i < st.boxes.length; i++) {
      const b = st.boxes[i],
        dx = (b % spec.w) + 0.5 - px,
        dz = ((b / spec.w) | 0) + 0.5 - pz;
      let d = -1;
      if (Math.abs(dx) <= 1.6 && Math.abs(dz) <= 0.65 && Math.abs(dx) > Math.abs(dz)) d = dx > 0 ? 0 : 2;
      else if (Math.abs(dz) <= 1.6 && Math.abs(dx) <= 0.65 && Math.abs(dz) >= Math.abs(dx)) d = dz > 0 ? 1 : 3;
      if (d < 0) continue;
      const sc = Math.hypot(dx, dz) - (fx !== undefined ? 0.45 * (PZ_DX[d] * fx + PZ_DZ[d] * fz) : 0);
      if (sc < bs) ((bs = sc), (best = i * 4 + d));
    }
    return best;
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
    // nadie (tú incluido) puede estar en la celda de destino
    const bb = st.boxes[i];
    if (ctx.occupied && ctx.occupied((bb % spec.w) + PZ_DX[d], ((bb / spec.w) | 0) + PZ_DZ[d])) return ctx.snd("err");
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
    const s = sokSolve(spec, 80000, st.boxes, ctx && ctx.cell !== undefined ? ctx.cell : -1);
    if (!s.ok || !s.sol.length) return { text: "Pista: esta posición no tiene salida; usa «Deshacer» o «Reiniciar»." };
    const [c, d] = s.sol[0];
    const dir = ["derecha", "abajo", "izquierda", "arriba"][d];
    return { id: st.boxes.indexOf(c) * 4 + d, text: `Pista: empuja la caja marcada hacia ${dir}.` };
  },
  focus(spec, st, id) {
    const b = st.boxes[id >> 2];
    return b === undefined ? null : [b % spec.w, (b / spec.w) | 0];
  },
  par(spec) {
    return sokSolve(spec, 250000).pushes;
  },
  solve(spec, st) {
    st.boxes = spec.goals.slice();
    st.hist.length = 0;
    st.tw.i = -1;
    st.tween = 0;
    st.rev++;
  },
  bot(spec, st, px, pz) {
    const cell = px === undefined ? -1 : Math.max(0, Math.min(spec.h - 1, Math.floor(pz))) * spec.w + Math.max(0, Math.min(spec.w - 1, Math.floor(px)));
    const s = sokSolve(spec, 250000, st.boxes, cell);
    if (!s.ok) return null;
    // cada acción: ponte en la celda de detrás de la caja y pulsa (el índice de la caja se resuelve al ejecutar: las cajas cambian de sitio)
    return s.sol.map(([c, d]) => ({ dyn: (st2) => st2.boxes.indexOf(c) * 4 + d, at: [(c % spec.w) + 0.5 - PZ_DX[d], ((c / spec.w) | 0) + 0.5 - PZ_DZ[d]], face: [PZ_DX[d], PZ_DZ[d]] }));
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

// ───────── 3.3 PLACAS DE PRESIÓN ─────────
// Una cámara cerrada con una sola entrada. Cada placa se enciende al pisarla y se apaga a los segundos que lleva marcados (cada una dura lo suyo).
// Hay que tenerlas TODAS encendidas a la vez. Las baldosas rojas descargan y lo apagan todo; las rejas de color solo se abren mientras esté
// encendida la placa de su mismo color. Se trata de decidir el orden y el camino: las de poca duración van tarde, la que abre una reja va antes
// de usarla y las rojas obligan a rodear. validate() calcula los tiempos de viaje reales (Dijkstra sobre la cámara, con las rejas abiertas según lo
// ya pisado), prueba con todos los órdenes posibles que existe alguno que llega a tiempo y cuenta cuántos hay. make() descarta las cámaras que se
// resuelven con una regla tonta (la de más duración primero, el vecino más cercano, el recorrido más corto…).
var PZ_SPEED = 4.2; // m/s de referencia (el jugador corre a 5,2: queda margen para las esquinas)
var PZ_STEP_OVERHEAD = 0.18; // s por placa (reacción y giro)
var PZ_TM_COLS = [0x4fe0ff, 0xff6bd5]; // un color por reja: la placa que la abre lo lleva también
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
// Rejillas derivadas del spec (una vez por spec): muros, baldosas rojas y celda de cada reja
function tmGrid(spec) {
  return pzMemo(spec, "grid", () => {
    const N = spec.w * spec.h,
      wall = new Uint8Array(N),
      hot = new Uint8Array(N),
      gate = new Int8Array(N).fill(-1);
    for (const q of spec.walls) wall[q] = 1;
    for (const q of spec.hot) hot[q] = 1;
    spec.gates.forEach((g, i) => (gate[g.c] = i));
    return { wall, hot, gate };
  });
}
// Tiempos de viaje (s) entre placas y desde la entrada, para cada conjunto de rejas abiertas (máscara de bits sobre spec.gates).
// Las baldosas rojas cuentan como muro: nadie las pisa a propósito.
function tmMats(spec) {
  return pzMemo(spec, "mats", () => {
    const { w, h } = spec,
      G = tmGrid(spec),
      nG = spec.gates.length,
      n = spec.plates.length,
      out = [];
    for (let mask = 0; mask < 1 << nG; mask++) {
      const blk = new Uint8Array(w * h);
      for (let c = 0; c < w * h; c++) blk[c] = G.wall[c] || G.hot[c] ? 1 : 0;
      for (let g = 0; g < nG; g++) blk[spec.gates[g].c] = (mask >> g) & 1 ? 0 : 1;
      const de = pzDist8(w, h, blk, spec.gap),
        E = spec.plates.map((q) => de[q.z * w + q.x] / PZ_SPEED),
        D = [];
      for (let i = 0; i < n; i++) {
        const di = pzDist8(w, h, blk, spec.plates[i].z * w + spec.plates[i].x);
        D.push(spec.plates.map((q, j) => (i === j ? 0 : di[q.z * w + q.x] / PZ_SPEED + PZ_STEP_OVERHEAD)));
      }
      out.push({ D, E });
    }
    return out;
  });
}
// Instantes (s, desde la primera pulsación) en que se pisa cada placa siguiendo el orden `o`; null si algún tramo es imposible.
// Una reja está abierta mientras esté encendida su placa; en un orden válido todas las ya pisadas siguen encendidas hasta el final.
function tmTimesOf(spec, M, o) {
  const n = o.length,
    nG = spec.gates.length;
  if (!isFinite(M[0].E[o[0]])) return null;
  const ts = [0];
  let t = 0,
    pressed = 1 << o[0];
  for (let k = 1; k < n; k++) {
    let mask = 0;
    for (let g = 0; g < nG; g++) if ((pressed >> spec.gates[g].by) & 1) mask |= 1 << g;
    const leg = M[mask].D[o[k - 1]][o[k]];
    if (!isFinite(leg)) return null;
    t += leg;
    ts.push(t);
    pressed |= 1 << o[k];
  }
  return ts;
}
// Holgura (s) del orden: lo que le sobra a la placa que más justa llega al instante final (< 0: alguna se apaga antes)
function tmMargin(spec, o, ts) {
  const tF = ts[ts.length - 1];
  let m = Infinity;
  for (let k = 0; k < o.length - 1; k++) m = Math.min(m, spec.plates[o[k]].d - (tF - ts[k]));
  return m;
}
// Todos los órdenes: cuántos llegan a tiempo, el de más holgura y el recorrido más corto
function tmEnum(spec) {
  const M = tmMats(spec),
    n = spec.plates.length;
  let nvalid = 0,
    feasible = 0,
    best = null,
    bestSpan = Infinity;
  pzPerms(n, (o) => {
    const ts = tmTimesOf(spec, M, o);
    if (!ts) return;
    feasible++;
    bestSpan = Math.min(bestSpan, ts[n - 1]);
    const m = tmMargin(spec, o, ts);
    if (m >= 0) {
      nvalid++;
      if (!best || m > best.margin) best = { o: o.slice(), margin: m, span: ts[n - 1], ts };
    }
  });
  return { nvalid, feasible, best, bestSpan };
}
// Cámara cerrada: perímetro de muros con un hueco (la entrada), tabiques con un paso cada uno, pilares sueltos y, de esos pasos, unos cuantos son rejas
function tmLayout(r, w, h, P) {
  const N = w * h,
    wall = new Uint8Array(N);
  for (let x = 0; x < w; x++) wall[x] = wall[(h - 1) * w + x] = 1;
  for (let z = 0; z < h; z++) wall[z * w] = wall[z * w + w - 1] = 1;
  const side = r.int(0, 3),
    gx = side === 3 ? 0 : side === 1 ? w - 1 : r.int(1, w - 2),
    gz = side === 0 ? 0 : side === 2 ? h - 1 : r.int(1, h - 2),
    gap = gz * w + gx;
  wall[gap] = 0;
  const inner = gap + (side === 3 ? 1 : side === 1 ? -1 : side === 0 ? w : -w); // la celda de dentro, junto a la entrada
  const rooms = [[1, 1, w - 2, h - 2]],
    openings = [];
  for (let k = 0; k < P.parts; k++) {
    let bi = -1,
      ba = 0;
    rooms.forEach((q, i) => {
      const cw = q[2] - q[0] + 1,
        ch = q[3] - q[1] + 1;
      if (Math.max(cw, ch) >= 4 && cw * ch > ba) ((ba = cw * ch), (bi = i));
    });
    if (bi < 0) break;
    const [x0, z0, x1, z1] = rooms[bi],
      cw = x1 - x0 + 1,
      ch = z1 - z0 + 1,
      vert = cw > ch ? true : cw < ch ? false : r() < 0.5;
    if (vert) {
      const mid = Math.round((x0 + x1) / 2),
        lx = Math.max(x0 + 1, Math.min(x1 - 1, mid + r.int(-1, 1))),
        g = r.int(z0, z1);
      for (let z = z0; z <= z1; z++) if (z !== g) wall[z * w + lx] = 1;
      openings.push(g * w + lx);
      rooms.splice(bi, 1, [x0, z0, lx - 1, z1], [lx + 1, z0, x1, z1]);
    } else {
      const mid = Math.round((z0 + z1) / 2),
        lz = Math.max(z0 + 1, Math.min(z1 - 1, mid + r.int(-1, 1))),
        g = r.int(x0, x1);
      for (let xx = x0; xx <= x1; xx++) if (xx !== g) wall[lz * w + xx] = 1;
      openings.push(lz * w + g);
      rooms.splice(bi, 1, [x0, z0, x1, lz - 1], [x0, lz + 1, x1, z1]);
    }
  }
  if (wall[inner]) return null;
  // pilares: lejos de los pasos y de la entrada
  const near = new Uint8Array(N);
  for (const c of openings.concat([inner]))
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) (dx === 0 || dz === 0) && ((near[c + dz * w + dx] = 1), (near[c] = 1));
  const cand = [];
  for (let z = 1; z < h - 1; z++) for (let xx = 1; xx < w - 1; xx++) if (!wall[z * w + xx] && !near[z * w + xx]) cand.push(z * w + xx);
  r.shuffle(cand);
  for (let i = 0; i < P.pillars && i < cand.length; i++) wall[cand[i]] = 1;
  return { wall, gap, inner, openings, rooms };
}
// Celdas alcanzables (4 vecinos) desde `from` sin cruzar los marcados en `blk`; devuelve el nº de alcanzadas y rellena `seen`
function tmFlood(w, h, blk, from, seen) {
  seen.fill(0);
  const q = [from];
  seen[from] = 1;
  for (let i = 0; i < q.length; i++) {
    const c = q[i],
      cx = c % w;
    if (cx + 1 < w && !blk[c + 1] && !seen[c + 1]) ((seen[c + 1] = 1), q.push(c + 1));
    if (cx > 0 && !blk[c - 1] && !seen[c - 1]) ((seen[c - 1] = 1), q.push(c - 1));
    if (c + w < w * h && !blk[c + w] && !seen[c + w]) ((seen[c + w] = 1), q.push(c + w));
    if (c >= w && !blk[c - w] && !seen[c - w]) ((seen[c - w] = 1), q.push(c - w));
  }
  return q.length;
}
PZ_GENS.timed = {
  id: "timed",
  n: "Placas de presión",
  d: "Cada placa se apaga a los segundos que marca. Enciéndelas todas a la vez: planea el orden y el camino.",
  icon: "◷",
  dims: { 1: [7, 6], 2: [8, 6], 3: [8, 7] },
  lv: {
    1: { n: 4, parts: 1, pillars: 1, hot: 1, gates: 0, slack: 1.1, add: 0.3, minSpan: 3.2, maxValid: 3, naive: 1, minMargin: 0.35 },
    2: { n: 4, parts: 2, pillars: 1, hot: 2, gates: 1, slack: 1.1, add: 0.3, minSpan: 5, maxValid: 2, naive: 2, minMargin: 0.35 },
    3: { n: 5, parts: 2, pillars: 2, hot: 3, gates: 2, slack: 1.08, add: 0.25, minSpan: 7, maxValid: 2, naive: 3, minMargin: 0.3 },
  },
  animated: true,
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier],
      N = w * h,
      seen = new Uint8Array(N),
      n = P.n;
    let best = null,
      bestScore = -1e9,
      bestFooled = 9;
    for (let att = 0; att < 320; att++) {
      // pasado un buen rato, se da por bueno el mejor candidato que no caiga en más reglas tontas de las permitidas
      if (att === 120 && best && bestFooled === 0) return best;
      const r = pzRng(pzMix(seed, tier, 0x544d, att)),
        L = tmLayout(r, w, h, P);
      if (!L) continue;
      const wall = L.wall,
        opening = new Uint8Array(N);
      for (const c of L.openings) opening[c] = 1;
      // todo lo libre se alcanza desde la entrada (con las rejas abiertas)
      let freeN = 0;
      for (let c = 0; c < N; c++) if (!wall[c]) freeN++;
      if (tmFlood(w, h, wall, L.gap, seen) !== freeN) continue;
      // rejas: algunos pasos
      const gateCells = L.openings.slice();
      r.shuffle(gateCells);
      const gates = gateCells.slice(0, P.gates).map((c) => ({ c, by: -1 }));
      if (gates.length < P.gates) continue;
      // baldosas rojas y placas en celdas libres, sin tapar pasos ni la entrada
      const hotSet = new Uint8Array(N),
        free = [];
      for (let z = 1; z < h - 1; z++)
        for (let xx = 1; xx < w - 1; xx++) {
          const c = z * w + xx;
          if (!wall[c] && !opening[c] && c !== L.inner && Math.abs(xx - ((L.inner % w) | 0)) + Math.abs(z - ((L.inner / w) | 0)) > 1) free.push(c);
        }
      r.shuffle(free);
      const hot = [];
      for (const c of free) {
        if (hot.length >= P.hot) break;
        hotSet[c] = 1;
        const blk = new Uint8Array(wall);
        for (const q of hot) blk[q] = 1;
        blk[c] = 1;
        // las rojas no parten la cámara
        if (tmFlood(w, h, blk, L.gap, seen) === freeN - hot.length - 1) hot.push(c);
        else hotSet[c] = 0;
      }
      if (hot.length < P.hot) continue;
      const rest = free.filter((c) => !hotSet[c]),
        pl = [],
        chamberOf = (c) => L.rooms.findIndex((q) => (c % w) >= q[0] && (c % w) <= q[2] && ((c / w) | 0) >= q[1] && ((c / w) | 0) <= q[3]);
      for (const c of rest) {
        if (pl.length >= n) break;
        if (pl.every((q) => Math.max(Math.abs((q % w) - (c % w)), Math.abs(((q / w) | 0) - ((c / w) | 0))) >= 2)) pl.push(c);
      }
      if (pl.length < n) continue;
      const used = new Set(pl.map(chamberOf));
      if (used.size < Math.min(L.rooms.length, tier === 3 ? 3 : 2)) continue;
      const plates = pl.map((c) => ({ x: c % w, z: (c / w) | 0, d: 0 }));
      // quién abre cada reja: una placa de la parte a la que se llega con esa reja cerrada y las demás abiertas
      let okG = true;
      gates.forEach((g, gi) => {
        const blk = new Uint8Array(wall);
        blk[g.c] = 1;
        tmFlood(w, h, blk, L.gap, seen);
        const cands = [];
        plates.forEach((q, i) => seen[q.z * w + q.x] && !gates.some((o) => o.by === i) && cands.push(i));
        if (!cands.length) okG = false;
        else g.by = r.pick(cands);
      });
      if (!okG) continue;
      const spec = { kind: "timed", seed, tier, w, h, walls: [], gap: L.gap, plates, hot, gates, sol: [], span: 0, nvalid: 0, margin: 0 };
      for (let c = 0; c < N; c++) if (wall[c]) spec.walls.push(c);
      const M = tmMats(spec);
      // todas las placas se alcanzan con todo abierto y alguna desde la entrada con todo cerrado
      const full = M[(1 << gates.length) - 1];
      if (full.D.some((row) => row.some((v) => !isFinite(v)))) continue;
      const orders = [];
      pzPerms(n, (o) => {
        const ts = tmTimesOf(spec, M, o);
        if (ts && ts[n - 1] >= P.minSpan) orders.push({ o: o.slice(), ts });
      });
      if (orders.length < 2) continue;
      // varios intentos de duraciones sobre la misma cámara
      for (let k = 0; k < 7; k++) {
        const pick = r.pick(orders),
          o = pick.o,
          ts = pick.ts,
          tF = ts[n - 1];
        for (let j = 0; j < n; j++) {
          const q = plates[o[j]];
          let d = j === n - 1 ? r.pick([2.5, 3, 3.5, 4, 5]) : (tF - ts[j]) * P.slack + P.add;
          if (j < n - 1 && r() < 0.4) d += r.pick([0.75, 1.5, 2.25, 3]); // alguna sobra: la duración sola no delata el orden
          q.d = Math.min(14, Math.max(2.5, Math.ceil(d * 4) / 4));
        }
        spec.span = tF;
        const E = tmEnum(spec);
        if (!E.best || E.nvalid > P.maxValid || E.best.margin < P.minMargin) continue;
        let spread = 0;
        {
          let lo = 99,
            hi = 0;
          for (const q of plates) ((lo = Math.min(lo, q.d)), (hi = Math.max(hi, q.d)));
          spread = hi - lo;
        }
        if (spread < 2) continue;
        // reglas tontas: ninguna debe resolverla
        const idx = plates.map((_, i) => i),
          naive = [],
          valid = (o2) => {
            const t2 = tmTimesOf(spec, M, o2);
            return !!t2 && tmMargin(spec, o2, t2) >= 0;
          };
        naive.push(idx.slice().sort((a, b) => plates[b].d - plates[a].d || a - b)); // la que más dura, primero
        {
          // vecino más cercano desde la entrada
          const left = new Set(idx),
            o2 = [];
          let pressed = 0;
          while (left.size) {
            let bj = -1,
              bt = Infinity;
            for (const j of left) {
              let t2;
              if (!o2.length) t2 = M[0].E[j];
              else {
                let mask = 0;
                for (let g = 0; g < gates.length; g++) if ((pressed >> gates[g].by) & 1) mask |= 1 << g;
                t2 = M[mask].D[o2[o2.length - 1]][j];
              }
              if (t2 < bt) ((bt = t2), (bj = j));
            }
            if (bj < 0) break;
            o2.push(bj);
            left.delete(bj);
            pressed |= 1 << bj;
          }
          naive.push(o2);
        }
        naive.push(idx.slice().sort((a, b) => M[0].E[a] - M[0].E[b] || a - b)); // la más cercana a la entrada, primero
        {
          // el recorrido más corto (si no es la solución)
          let bs = Infinity,
            bo = null;
          pzPerms(n, (o2) => {
            const t2 = tmTimesOf(spec, M, o2);
            if (t2 && t2[n - 1] < bs) ((bs = t2[n - 1]), (bo = o2.slice()));
          });
          bo && naive.push(bo);
        }
        let fooled = 0;
        for (const q of naive.slice(0, P.naive)) if (q.length === n && valid(q)) fooled++;
        // las rojas y las rejas pintan algo: las rojas alargan algún tramo de la solución y cada reja se usa de verdad
        const sol = E.best.o,
          tsS = E.best.ts;
        let hotImpact = 0,
          gatesUsed = 0;
        if (P.hot) {
          const noHot = Object.assign({}, spec, { hot: [] });
          const Mh = tmMats(noHot);
          let pressedH = 1 << sol[0];
          for (let kk = 1; kk < n; kk++) {
            let mask = 0;
            for (let g = 0; g < gates.length; g++) if ((pressedH >> gates[g].by) & 1) mask |= 1 << g;
            hotImpact += M[mask].D[sol[kk - 1]][sol[kk]] - Mh[mask].D[sol[kk - 1]][sol[kk]];
            pressedH |= 1 << sol[kk];
          }
        }
        if (gates.length) {
          let pressedG = 1 << sol[0];
          const used = new Set();
          for (let kk = 1; kk < n; kk++) {
            let mask = 0;
            for (let g = 0; g < gates.length; g++) if ((pressedG >> gates[g].by) & 1) mask |= 1 << g;
            // ¿ese tramo es más corto gracias a una reja abierta?
            for (let g = 0; g < gates.length; g++) if ((mask >> g) & 1 && M[mask & ~(1 << g)].D[sol[kk - 1]][sol[kk]] > M[mask].D[sol[kk - 1]][sol[kk]] + 0.2) used.add(g);
            pressedG |= 1 << sol[kk];
          }
          gatesUsed = used.size;
        }
        const score = -fooled * 10 + (P.hot && hotImpact < 0.25 ? -3 : 0) + (gatesUsed < gates.length ? -4 : 0) - E.nvalid + Math.min(spread, 6) * 0.1;
        if (score > bestScore) {
          bestScore = score;
          bestFooled = fooled;
          best = JSON.parse(JSON.stringify(spec));
          best.sol = sol.slice();
          best.span = Math.round(tsS[n - 1] * 100) / 100;
          best.nvalid = E.nvalid;
          best.margin = Math.round(E.best.margin * 100) / 100;
        }
        if (fooled === 0 && (!P.hot || hotImpact >= 0.25) && gatesUsed >= gates.length) return best;
      }
    }
    return best;
  },
  validate(spec) {
    const n = spec.plates.length,
      nG = spec.gates.length;
    const G = tmGrid(spec);
    for (const q of spec.plates) {
      const c = q.z * spec.w + q.x;
      if (G.wall[c] || G.hot[c] || G.gate[c] >= 0 || !(q.d >= 2.5)) return { ok: false, why: "placa mal colocada" };
    }
    for (const g of spec.gates) if (g.by < 0 || g.by >= n) return { ok: false, why: "reja sin placa" };
    const M = tmMats(spec),
      full = M[(1 << nG) - 1];
    if (full.D.some((row) => row.some((v) => !isFinite(v)))) return { ok: false, why: "placa inalcanzable" };
    const E = tmEnum(spec);
    const ok = E.nvalid > 0 && E.best.margin >= 0.2;
    let lo = 99,
      hi = 0;
    for (const q of spec.plates) ((lo = Math.min(lo, q.d)), (hi = Math.max(hi, q.d)));
    return {
      ok,
      why: ok ? "" : "ningún recorrido llega a tiempo",
      nvalid: E.nvalid,
      orders: pzFact(n),
      feasible: E.feasible,
      best: +E.bestSpan.toFixed(2),
      span: E.best ? +E.best.span.toFixed(2) : 0,
      margin: E.best ? +E.best.margin.toFixed(2) : 0,
      dmin: lo,
      dmax: hi,
      hot: spec.hot.length,
      gates: nG,
    };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.lit = spec.plates.map(() => 0);
    st.gopen = spec.gates.map(() => false);
    st.inv = 0;
    st.live = false;
    return st;
  },
  reset(spec, st) {
    st.lit.fill(0);
    st.gopen.fill(false);
    st.inv = 0;
    st.live = false;
    st.rev++;
  },
  solved(spec, st) {
    for (const v of st.lit) if (v <= 0) return false;
    return true;
  },
  solid(spec, st, cx, cz) {
    const G = tmGrid(spec),
      c = cz * spec.w + cx;
    return G.wall[c] === 1 || (G.gate[c] >= 0 && !st.gopen[G.gate[c]]);
  },
  pick() {
    return -1;
  },
  step(spec, st, dt, ctx) {
    const G = tmGrid(spec),
      w = spec.w,
      cx = Math.floor(ctx.px),
      cz = Math.floor(ctx.pz);
    if (st.inv > 0) st.inv -= dt;
    const here = ctx.inside && cx >= 0 && cz >= 0 && cx < w && cz < spec.h ? cz * w + cx : -1;
    // baldosa roja: descarga y apaga todo (un roce con el borde de la celda se perdona)
    if (here >= 0 && G.hot[here] && st.inv <= 0) {
      const fx = ctx.px - cx,
        fz = ctx.pz - cz;
      if (fx > 0.14 && fx < 0.86 && fz > 0.14 && fz < 0.86) {
        let any = false;
        for (let i = 0; i < st.lit.length; i++) if (st.lit[i] > 0) ((st.lit[i] = 0), (any = true));
        st.errors++;
        st.inv = 1.1;
        st.rev++;
        ctx.snd("zap");
        ctx.hurt(PZ_CFG.respawnPenalty * 0.5);
        ctx.toast(any ? "¡Descarga! Se han apagado todas las placas." : "¡Descarga! Esa baldosa no se pisa.", "warn");
      }
    }
    let live = false;
    for (let i = 0; i < spec.plates.length; i++) {
      const p = spec.plates[i];
      if (here >= 0 && cx === p.x && cz === p.z) {
        if (st.lit[i] <= 0) {
          ctx.snd("beep", { p: 0.75 + i * 0.14 });
          st.rev++;
        }
        st.lit[i] = p.d;
      } else if (st.lit[i] > 0) {
        st.lit[i] -= dt;
        if (st.lit[i] <= 0) ((st.lit[i] = 0), st.rev++);
      }
      if (st.lit[i] > 0) live = true;
    }
    // reja abierta mientras su placa esté encendida (y mientras alguien la cruza: no se cierra sobre el jugador)
    for (let g = 0; g < spec.gates.length; g++) {
      const gt = spec.gates[g],
        open = st.lit[gt.by] > 0 || here === gt.c;
      if (open !== st.gopen[g]) {
        st.gopen[g] = open;
        st.rev++;
        ctx.snd(open ? "open" : "close", { v: 0.5 });
      }
    }
    st.live = live;
  },
  status(spec, st) {
    let n = 0,
      go = 0;
    for (const v of st.lit) v > 0 && n++;
    for (const o of st.gopen) o && go++;
    const out = [`Placas encendidas: ${n}/${spec.plates.length}`];
    if (spec.hot.length) out.push("Las baldosas rojas apagan todas las placas");
    if (spec.gates.length) out.push(`Rejas abiertas: ${go}/${spec.gates.length} (cada una con la placa de su color)`);
    if (st.errors) out.push(`Descargas: ${st.errors}`);
    return out;
  },
  hint(spec, st) {
    // la primera placa del orden de la solución que no esté encendida
    for (const i of spec.sol) if (st.lit[i] <= 0) return { id: i, text: st.lit.some((v) => v > 0) ? "Pista: sigue por la placa marcada." : "Pista: empieza por la placa marcada." };
    return null;
  },
  solve(spec, st) {
    for (let i = 0; i < st.lit.length; i++) st.lit[i] = spec.plates[i].d;
    st.gopen.fill(true);
    st.rev++;
  },
  hackable: true,
  focus(spec, st, id) {
    const q = spec.plates[id];
    return q ? [q.x, q.z] : null;
  },
  glyphs(spec) {
    return pzMemo(spec, "glyphs", () => {
      const out = spec.plates.map((q, i) => {
        const g = spec.gates.findIndex((o) => o.by === i);
        return { t: q.d + " s", n: "", col: g >= 0 ? PZ_TM_COLS[g] : 0xe8eef5, cx: q.x + 0.5, cz: q.z + 0.5, y: 0.95 };
      });
      return out;
    });
  },
  botMode: "walk",
  bot(spec) {
    const M = tmMats(spec),
      o = spec.sol,
      ts = tmTimesOf(spec, M, o),
      acts = [];
    if (!ts) return null;
    for (let i = 0; i < o.length; i++) acts.push({ at: [spec.plates[o[i]].x + 0.5, spec.plates[o[i]].z + 0.5], t: ts[i] });
    return acts;
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h,
      G = tmGrid(spec),
      done = st.done;
    for (let z = 0; z < h; z++)
      for (let xx = 0; xx < w; xx++) {
        const c = z * w + xx;
        if (G.wall[c]) {
          const edge = xx === 0 || z === 0 || xx === w - 1 || z === h - 1;
          g.box(xx + 0.5, z + 0.5, edge ? 0.5 : 0.55, 0.96, edge ? 1 : 1.1, 0.96, edge ? 0x2f363e : 0x474f58);
        } else g.box(xx + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, (xx + z) & 1 ? 0x232a33 : 0x1d242c);
      }
    // la entrada, marcada en el suelo
    g.box((spec.gap % w) + 0.5, ((spec.gap / w) | 0) + 0.5, 0.05, 0.86, 0.04, 0.86, 0x2f6a7a, 0.7);
    for (const c of spec.hot) {
      const hx = (c % w) + 0.5,
        hz = ((c / w) | 0) + 0.5,
        f = 1 + Math.sin(t * 5 + c) * 0.25;
      g.box(hx, hz, 0.05, 0.9, 0.06, 0.9, 0xc2281c, 1.1 * f);
      g.box(hx, hz, 0.1, 0.96, 0.03, 0.12, 0x2a0806, 0, Math.PI / 4);
      g.box(hx, hz, 0.1, 0.96, 0.03, 0.12, 0x2a0806, 0, -Math.PI / 4);
    }
    for (let gi = 0; gi < spec.gates.length; gi++) {
      const q = spec.gates[gi],
        gx = (q.c % w) + 0.5,
        gz = ((q.c / w) | 0) + 0.5,
        col = PZ_TM_COLS[gi],
        open = st.gopen[gi];
      if (open) g.box(gx, gz, 0.05, 0.9, 0.06, 0.9, col, 0.5);
      else {
        g.box(gx, gz, 0.55, 0.9, 1.1, 0.9, col, 0.9);
        g.box(gx, gz, 0.55, 0.96, 1.16, 0.2, 0x1a1f26, 0);
      }
    }
    for (let i = 0; i < spec.plates.length; i++) {
      const p = spec.plates[i],
        f = Math.max(0, st.lit[i] / p.d),
        on = f > 0,
        col = done ? 0x4cff8f : f > 0.5 ? 0x4cff8f : f > 0.22 ? 0xffd04a : 0xff5a3c,
        gi = spec.gates.findIndex((o) => o.by === i);
      g.box(p.x + 0.5, p.z + 0.5, 0.06, 0.8, 0.08, 0.8, on ? col : 0x3a4350, on ? 1.2 : 0);
      g.ring(p.x + 0.5, p.z + 0.5, 0.11, 0.36, on ? col : 0x6a7684, on ? 1.8 : 0.5);
      if (on) g.cyl(p.x + 0.5, p.z + 0.5, 0.15 + f * 0.55, 0.1, f * 1.1, col, 1.8);
      if (gi >= 0) {
        // el mástil del color de la reja que abre
        g.cyl(p.x + 0.5 + 0.33, p.z + 0.5 - 0.33, 0.28, 0.06, 0.56, 0x2c3944);
        g.sph(p.x + 0.5 + 0.33, p.z + 0.5 - 0.33, 0.62, 0.11, PZ_TM_COLS[gi], 1.8);
      }
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
// Los mismos ocho glifos que el vocabulario del Archivo (LORE_GLYPHS): así el orden que dicta un documento se traduce 1:1 a runas
var PZ_RUNES = [
  { n: "Sol", g: "●", col: 0xffc94a, sh: "sph" },
  { n: "Luna", g: "◑", col: 0xbcd6ff, sh: "ring" },
  { n: "Serpiente", g: "≈", col: 0x6fdc6a, sh: "cyl" },
  { n: "Ojo", g: "◉", col: 0xf2efe6, sh: "box" },
  { n: "Cristal", g: "◆", col: 0x4fe0ff, sh: "oct" },
  { n: "Raíz", g: "✚", col: 0xc58a4a, sh: "cross" },
  { n: "Llama", g: "▲", col: 0xff5a3c, sh: "cone" },
  { n: "Onda", g: "≋", col: 0xc58bff, sh: "cone2" },
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
// Disposición en el suelo: runas en una elipse alrededor de la estela (que ocupa el centro)
function rnLayout(w, h, n, r) {
  const cells = [],
    stele = Math.floor(h / 2) * w + Math.floor(w / 2),
    used = new Set([stele]);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2,
      cx = Math.floor((w - 1) / 2 + 0.5 + Math.cos(a) * ((w - 1) / 2 - 0.2)),
      cz = Math.floor((h - 1) / 2 + 0.5 + Math.sin(a) * ((h - 1) / 2 - 0.2));
    let c = Math.max(0, Math.min(h - 1, cz)) * w + Math.max(0, Math.min(w - 1, cx));
    for (let k = 0; used.has(c) && k < 60; k++) c = r.int(0, w * h - 1);
    used.add(c);
    cells.push(c);
  }
  return { cells, stele };
}
PZ_GENS.runes = {
  id: "runes",
  n: "Runas en orden",
  d: "Activa las runas en el orden que dicta la inscripción.",
  icon: "ᚱ",
  dims: { 1: [6, 5], 2: [6, 6], 3: [7, 6] },
  lv: { 1: { n: 4 }, 2: { n: 5 }, 3: { n: 6 } },
  hackable: false,
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
    const { cells, stele } = rnLayout(w, h, n, r);
    const names = ids.map((q) => PZ_RUNES[q].g + " " + PZ_RUNES[q].n.toUpperCase());
    return { kind: "runes", mode: "clues", seed, tier, w, h, n, len: n, ids, cells, order, clues, text: clues.map((c) => rnText(c, names)), stele };
  },
  // Variante dictada por el Archivo: `seq` = glifos (índices 0..7) en el orden en que hay que activarlos, más señuelos que NO hay que tocar.
  makeLore(seed, tier, seq, key) {
    const [w, h] = this.dims[tier],
      len = seq.length,
      n = Math.min(w * h - 4, len + 2),
      r = pzRng(pzMix(seed, tier, 0x4c52));
    const decoys = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7].filter((q) => seq.indexOf(q) < 0)).slice(0, n - len);
    const ids = seq.concat(decoys),
      order = [...Array(len).keys()],
      { cells, stele } = rnLayout(w, h, n, r);
    r.shuffle(cells); // dónde está cada runa no revela el orden
    return { kind: "runes", mode: "lore", key, seed, tier, w, h, n, len, ids, cells, order, clues: [], text: [], stele };
  },
  // dos variantes de Archivo por semilla (las que juega el desierto, 4 glifos, y la colmena, 5): validateAll() también las recorre
  variants(seed, tier) {
    if (tier < 2) return [];
    const r = pzRng(pzMix(seed, tier, 0x5656)),
      len = tier === 2 ? 4 : 5;
    return [this.makeLore(seed, tier, r.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, len), "prueba." + len)];
  },
  validate(spec) {
    const n = spec.n,
      len = spec.order.length;
    const distinct = new Set(spec.cells).size === n && !spec.cells.includes(spec.stele) && new Set(spec.ids).size === n && spec.ids.every((q) => q >= 0 && q < PZ_RUNES.length);
    if (spec.mode === "lore") {
      const ok = distinct && len === spec.len && len >= 3 && len < n && spec.order.every((q, i) => q === i && q < n);
      return { ok, why: ok ? "" : "variante de Archivo mal formada", decoys: n - len, perms: pzFact(n) };
    }
    const s = rnCount(spec.clues, n);
    const same = s.first && s.first.every((q, i) => q === spec.order[i]);
    const ok = s.cnt === 1 && same && spec.clues.length >= 2 && distinct;
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
    return st.k >= spec.order.length;
  },
  solid(spec, st, cx, cz) {
    const c = cz * spec.w + cx;
    return st.cellSet.has(c) || c === spec.stele;
  },
  pick(spec, st, px, pz, fx, fz) {
    return pzNearest(pzMemo(spec, "rc", () => spec.cells.map((c) => [c % spec.w, (c / spec.w) | 0])), px, pz, fx, fz);
  },
  focus(spec, st, id) {
    const c = spec.cells[id];
    return c === undefined ? null : [c % spec.w, (c / spec.w) | 0];
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
    return [`Runas activadas: ${st.k}/${spec.order.length}`, ...(st.errors ? [`Errores: ${st.errors}`] : [])];
  },
  // texto de la inscripción: pistas lógicas, o (variante del Archivo) lo que el jugador ya sabe del documento que dicta el orden
  clueLines(spec) {
    if (spec.mode !== "lore") return spec.text;
    let h = null;
    try {
      h = x.loreApi && x.loreApi.hintFor(spec.key);
    } catch (err) {
      h = null;
    }
    if (h && h.known) return ["La inscripción coincide con lo que anotaste en el Archivo:", h.display + "."];
    return ["La inscripción es ilegible: los glifos están erosionados.", "El orden aparece en los registros de esta región" + (h && h.what ? " (" + h.what + ")" : "") + ". Consulta el Archivo."];
  },
  hintLore(spec) {
    try {
      spec.mode === "lore" && x.loreApi && x.loreApi.reveal(spec.key);
    } catch (err) {
      /* sin Archivo */
    }
  },
  spots(spec) {
    return spec.cells.map((c) => [c % spec.w, (c / spec.w) | 0]);
  },
  solve(spec, st) {
    st.k = spec.order.length;
    for (const q of spec.order) st.lit[q] = 1;
    st.rev++;
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
    // etiquetas flotantes (la ejecución las pinta como texto del DOM, sin mallas); se calculan una vez por spec
    return pzMemo(spec, "gl", () => this._glyphs(spec));
  },
  _glyphs(spec) {
    return spec.cells.map((c, i) => ({ cx: (c % spec.w) + 0.5, cz: ((c / spec.w) | 0) + 0.5, y: 1.55, t: PZ_RUNES[spec.ids[i]].g, n: PZ_RUNES[spec.ids[i]].n, col: PZ_RUNES[spec.ids[i]].col }));
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
  hackable: true,
  focus(spec, st, id) {
    return id >= 0 ? [id % spec.w, (id / spec.w) | 0] : null;
  },
  par(spec) {
    return this.bot(spec, this.init(spec)).length;
  },
  solve(spec, st) {
    st.mask.set(spec.sol);
    st.npw = ciPower(spec, st.mask, st.pw);
    st.rev++;
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
  solve(spec, st) {
    st.reached = true;
    st.rev++;
  },
  botMode: "phase",
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
  solve(spec, st) {
    st.reached = true;
    st.prog = spec.path.length - 1;
    st.show = 0;
    st.rev++;
  },
  botMode: "walk",
  bot(spec) {
    const c0 = spec.path[0];
    return [{ at: [(c0 % spec.w) + 0.5, 0.5] }]
      .concat(spec.path.map((c) => ({ at: [(c % spec.w) + 0.5, ((c / spec.w) | 0) + 0.5] })))
      .concat([{ at: [(spec.path[spec.path.length - 1] % spec.w) + 0.5, spec.h - 0.5] }]);
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
  pick(spec, st, px, pz, fx, fz) {
    return pzNearest(pzMemo(spec, "vc", () => spec.valves.map((v) => [v.x, v.i])), px, pz, fx, fz);
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
  hackable: true,
  focus(spec, st, id) {
    const v = spec.valves[id];
    return v ? [v.x, v.i] : null;
  },
  par(spec) {
    return this.bot(spec, this.init(spec)).length;
  },
  spots(spec) {
    return spec.valves.map((v) => [v.x, v.i]);
  },
  solve(spec, st) {
    st.mask = spec.sol;
    st.out = vaRun(spec, st.mask, st.cols);
    st.rev++;
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
// ───────── 3.10 LOSAS DE UN SOLO PASO ─────────
// Una cámara cerrada de losas: cada losa solo se pisa una vez, porque al dejarla se cierra tras de ti (se alza como un bloque). Las losas con
// diamante hay que pisarlas todas; con la última, la salida se abre. Hay que llegar a ella sin cerrarte el paso ni dejarte una losa clave atrás.
// validate() hace una búsqueda exhaustiva de caminos que pisan cada losa a lo sumo una vez, cuenta las soluciones y mide lo ramificado que es.
function skGrid(spec) {
  return pzMemo(spec, "grid", () => {
    const w = spec.w,
      h = spec.h,
      N = w * h,
      wall = new Uint8Array(N),
      key = new Uint8Array(N),
      frag = new Uint8Array(N);
    for (const q of spec.walls) wall[q] = 1;
    for (const q of spec.keys) key[q] = 1;
    for (let z = 1; z < h - 1; z++) for (let xx = 1; xx < w - 1; xx++) if (!wall[z * w + xx]) frag[z * w + xx] = 1;
    const inner = (gap) => (gap % w === 0 ? gap + 1 : gap % w === w - 1 ? gap - 1 : gap < w ? gap + w : gap - w);
    return { wall, key, frag, s0: inner(spec.entry), sx: inner(spec.exit) };
  });
}
// Búsqueda exhaustiva. from = losa donde estás (ya pisada); sunk = losas cerradas (o null); lit = diamantes ya pisados (o null).
// Cuenta caminos (hasta cap) que pisan todos los diamantes pendientes y acaban en la losa de la salida; nodeCap acota el trabajo.
function skSolve(spec, cap, nodeCap, from, sunk, lit) {
  const G = skGrid(spec),
    w = spec.w,
    h = spec.h,
    N = w * h,
    sx = G.sx,
    vis = new Uint8Array(N),
    need = new Uint8Array(N),
    seen = new Uint8Array(N),
    q = new Int32Array(N),
    path = [from],
    OFF = [1, w, -1, -w];
  let rem = 0;
  for (let c = 0; c < N; c++) {
    vis[c] = G.frag[c] && !(sunk && sunk[c]) ? 0 : 1;
    if (G.key[c] && !(lit && lit[c])) need[c] = 1;
  }
  vis[from] = 1;
  need[from] = 0;
  for (let c = 0; c < N; c++) if (need[c]) rem++;
  let count = 0,
    nodes = 0,
    capped = false,
    first = null;
  // ¿se llega a todos los diamantes pendientes y a la losa de la salida sin pasar por ella?
  const feasible = (cur, rm) => {
    seen.fill(0);
    let qh = 0,
      qt = 0,
      got = 0,
      ex = cur === sx;
    q[qt++] = cur;
    seen[cur] = 1;
    while (qh < qt) {
      const c = q[qh++];
      if (c === sx && c !== cur) continue; // la salida solo se pisa al final
      const cx = c % w;
      for (let d = 0; d < 4; d++) {
        if ((d === 0 && cx + 1 >= w) || (d === 2 && cx === 0)) continue;
        const nb = c + OFF[d];
        if (nb < 0 || nb >= N || vis[nb] || seen[nb]) continue;
        seen[nb] = 1;
        if (nb === sx) ex = true;
        if (need[nb]) got++;
        q[qt++] = nb;
      }
    }
    return ex && got >= rm;
  };
  const rec = (cur, rm) => {
    if (capped) return;
    if (++nodes > nodeCap) {
      capped = true;
      return;
    }
    if (cur === sx) {
      if (rm === 0) {
        count++;
        if (!first) first = path.slice();
        if (count >= cap) capped = true;
      }
      return;
    }
    if (!feasible(cur, rm)) return;
    const cx = cur % w;
    for (let d = 0; d < 4; d++) {
      if ((d === 0 && cx + 1 >= w) || (d === 2 && cx === 0)) continue;
      const nb = cur + OFF[d];
      if (nb < 0 || nb >= N || vis[nb]) continue;
      vis[nb] = 1;
      path.push(nb);
      const nk = need[nb];
      if (nk) need[nb] = 0;
      rec(nb, rm - nk);
      if (nk) need[nb] = 1;
      path.pop();
      vis[nb] = 0;
      if (capped) return;
    }
  };
  if (from === sx) return { count: rem === 0 ? 1 : 0, first: [from], nodes: 1, capped: false };
  rec(from, rem);
  return { count, first, nodes, capped };
}
// Un camino aleatorio sin repetir losas de `s0` a `sx` con una longitud (en losas) entre lo y hi
function skPath(r, w, h, wall, s0, sx, lo, hi) {
  const N = w * h,
    vis = new Uint8Array(N),
    OFF = [1, w, -1, -w],
    path = [s0];
  let nodes = 0;
  vis[s0] = 1;
  const free = (c) => c >= 0 && c < N && !wall[c] && !vis[c];
  const rec = (cur) => {
    if (++nodes > 6000) return false;
    if (cur === sx) return path.length >= lo;
    if (path.length >= hi) return false;
    const cx = cur % w,
      nbs = [];
    for (let d = 0; d < 4; d++) {
      if ((d === 0 && cx + 1 >= w) || (d === 2 && cx === 0)) continue;
      const nb = cur + OFF[d];
      if (!free(nb) || (nb === sx && path.length + 1 < lo)) continue;
      // las que dejan menos salidas, antes (caminos sinuosos que llenan la cámara)
      let deg = 0;
      for (let e = 0; e < 4; e++) {
        const n2 = nb + OFF[e];
        if (free(n2) && !(e === 0 && nb % w + 1 >= w) && !(e === 2 && nb % w === 0)) deg++;
      }
      nbs.push([deg + r() * 1.6, nb]);
    }
    nbs.sort((a, b) => a[0] - b[0]);
    for (const [, nb] of nbs) {
      vis[nb] = 1;
      path.push(nb);
      if (rec(nb)) return true;
      path.pop();
      vis[nb] = 0;
    }
    return false;
  };
  return rec(s0) ? path.slice() : null;
}
PZ_GENS.sink = {
  id: "sink",
  n: "Losas de un solo paso",
  d: "Cada losa solo se pisa una vez: al dejarla se cierra tras de ti. Pisa todas las losas con diamante y la salida se abrirá.",
  icon: "▤",
  dims: { 1: [6, 5], 2: [7, 6], 3: [8, 7] },
  lv: {
    1: { walls: 1, keys: 3, len: [7, 9], maxSol: 3, minDecoy: 2, minNodes: 14 },
    2: { walls: 2, keys: 5, len: [11, 14], maxSol: 2, minDecoy: 3, minNodes: 60 },
    3: { walls: 3, keys: 8, len: [17, 21], maxSol: 2, minDecoy: 4, minNodes: 260 },
  },
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier],
      N = w * h;
    let best = null;
    for (let att = 0; att < 400; att++) {
      const r = pzRng(pzMix(seed, tier, 0x534b, att)),
        wall = new Uint8Array(N);
      for (let x = 0; x < w; x++) wall[x] = wall[(h - 1) * w + x] = 1;
      for (let z = 0; z < h; z++) wall[z * w] = wall[z * w + w - 1] = 1;
      // entrada y salida en lados distintos (casi siempre opuestos), lejos de las esquinas
      const sideE = r.int(0, 3),
        sideX = r() < 0.75 ? (sideE + 2) & 3 : (sideE + (r() < 0.5 ? 1 : 3)) & 3,
        gapOf = (side) => {
          const gx = side === 3 ? 0 : side === 1 ? w - 1 : r.int(1, w - 2),
            gz = side === 0 ? 0 : side === 2 ? h - 1 : r.int(1, h - 2);
          return gz * w + gx;
        },
        entry = gapOf(sideE),
        exit = gapOf(sideX);
      wall[entry] = wall[exit] = 0;
      const inner = (gap) => (gap % w === 0 ? gap + 1 : gap % w === w - 1 ? gap - 1 : gap < w ? gap + w : gap - w),
        s0 = inner(entry),
        sx = inner(exit);
      if (s0 === sx) continue;
      // pilares
      const cand = [];
      for (let z = 1; z < h - 1; z++) for (let xx = 1; xx < w - 1; xx++) if (z * w + xx !== s0 && z * w + xx !== sx) cand.push(z * w + xx);
      r.shuffle(cand);
      for (let i = 0; i < P.walls; i++) wall[cand[i]] = 1;
      const path = skPath(r, w, h, wall, s0, sx, P.len[0], P.len[1]);
      if (!path) continue;
      // diamantes a lo largo del camino (separados), nunca en la losa de entrada ni en la de salida
      const idx = [];
      for (let i = 1; i < path.length - 1; i++) idx.push(i);
      r.shuffle(idx);
      const keys = [];
      for (const i of idx) {
        if (keys.length >= P.keys) break;
        if (keys.every((k) => Math.abs(k - i) >= 2)) keys.push(i);
      }
      if (keys.length < Math.min(P.keys, 3)) continue;
      const keyCells = keys.map((i) => path[i]).sort((a, b) => a - b);
      // se cierran losas que no son del camino hasta que queden pocas soluciones, dejando señuelos
      const onPath = new Set(path),
        off = [];
      for (let z = 1; z < h - 1; z++) for (let xx = 1; xx < w - 1; xx++) if (!wall[z * w + xx] && !onPath.has(z * w + xx)) off.push(z * w + xx);
      r.shuffle(off);
      const spec = { kind: "sink", seed, tier, w, h, walls: [], entry, exit, keys: keyCells, sol: path.slice(), sols: 0, nodes: 0 };
      let decoys = off.length,
        res = null;
      for (let step = 0; step <= off.length; step++) {
        spec.walls = [];
        for (let c = 0; c < N; c++) if (wall[c]) spec.walls.push(c);
        pzMemoDrop(spec);
        res = skSolve(spec, P.maxSol + 1, 400000, s0, null, null);
        if (res.count >= 1 && res.count <= P.maxSol && !res.capped) break;
        if (decoys <= P.minDecoy) {
          res = null;
          break;
        }
        // cierra el señuelo que más ramas corte: el primero de la lista basta (ya está barajada)
        wall[off.pop()] = 1;
        decoys--;
      }
      if (!res || res.count < 1 || res.count > P.maxSol || res.capped || res.nodes < P.minNodes) {
        if (res && res.count >= 1 && res.count <= P.maxSol && !res.capped && (!best || res.nodes > best.nodes)) {
          spec.sols = res.count;
          spec.nodes = res.nodes;
          spec.sol = res.first;
          best = JSON.parse(JSON.stringify(spec));
        }
        continue;
      }
      spec.sols = res.count;
      spec.nodes = res.nodes;
      spec.sol = res.first;
      return JSON.parse(JSON.stringify(spec));
    }
    return best;
  },
  validate(spec) {
    const G = skGrid(spec);
    if (!G.frag[G.s0] || !G.frag[G.sx] || G.s0 === G.sx) return { ok: false, why: "entrada o salida bloqueadas" };
    for (const k of spec.keys) if (!G.frag[k] || k === G.s0 || k === G.sx) return { ok: false, why: "diamante mal colocado" };
    const res = skSolve(spec, 8, 600000, G.s0, null, null);
    // la solución guardada es un camino válido y sin repetir losas
    const sol = spec.sol,
      seen = new Set();
    let okSol = sol.length > 1 && sol[0] === G.s0 && sol[sol.length - 1] === G.sx;
    for (let i = 0; i < sol.length && okSol; i++) {
      if (!G.frag[sol[i]] || seen.has(sol[i])) okSol = false;
      seen.add(sol[i]);
      if (i && Math.abs(sol[i] - sol[i - 1]) !== 1 && Math.abs(sol[i] - sol[i - 1]) !== spec.w) okSol = false;
      if (i && Math.abs(sol[i] - sol[i - 1]) === 1 && Math.floor(sol[i] / spec.w) !== Math.floor(sol[i - 1] / spec.w)) okSol = false;
    }
    for (const k of spec.keys) if (!seen.has(k)) okSol = false;
    const ok = okSol && res.count >= 1 && !res.capped;
    let free = 0;
    for (let c = 0; c < G.frag.length; c++) free += G.frag[c];
    return { ok, why: ok ? "" : !okSol ? "la solución guardada no vale" : res.capped ? "demasiadas soluciones" : "sin solución", sols: res.count, nodes: res.nodes, len: sol.length, keys: spec.keys.length, free };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.state = new Uint8Array(spec.w * spec.h); // 0 intacta · 1 pisada (aún no cerrada) · 2 cerrada
    st.lit = new Uint8Array(spec.w * spec.h);
    st.nlit = 0;
    st.cur = -1;
    st.pend = [];
    st.open = false;
    st.reached = false;
    st.stuck = false;
    st.dirty = true; // al montarlo (o volver a él) se comprueba si queda camino
    return st;
  },
  reset(spec, st, ctx) {
    st.state.fill(0);
    st.lit.fill(0);
    st.nlit = 0;
    st.cur = -1;
    st.pend.length = 0;
    st.open = false;
    st.stuck = false;
    st.dirty = false;
    st.rev++;
    // vuelta a la entrada (si estás dentro)
    if (ctx && ctx.teleport) {
      const e = spec.entry;
      ctx.teleport((e % spec.w) + 0.5, Math.floor(e / spec.w) + 0.5);
    }
  },
  solved(spec, st) {
    return st.reached === true;
  },
  solid(spec, st, cx, cz) {
    const G = skGrid(spec),
      c = cz * spec.w + cx;
    return G.wall[c] === 1 || st.state[c] === 2 || (c === spec.exit && !st.open);
  },
  pick() {
    return -1;
  },
  step(spec, st, dt, ctx) {
    const G = skGrid(spec),
      w = spec.w,
      h = spec.h,
      cx = Math.floor(ctx.px),
      cz = Math.floor(ctx.pz),
      fx = ctx.px - cx,
      fz = ctx.pz - cz;
    // dónde estás: -1 fuera de la cámara · -2 en la franja entre dos losas (no cuenta: se conserva la anterior) · si no, la celda
    let here = -1;
    if (ctx.inside && cx >= 0 && cz >= 0 && cx < w && cz < h) {
      const c0 = cz * w + cx;
      here = fx >= 0.12 && fx <= 0.88 && fz >= 0.12 && fz <= 0.88 ? c0 : c0 === st.cur ? c0 : -2;
    }
    st.t += dt;
    const closeTile = (c) => {
      st.state[c] = 2;
      st.rev++;
      st.dirty = true;
      ctx.snd("metal", { p: 0.4, v: 0.5 });
    };
    const stepOn = (c) => {
      if (!G.frag[c] || st.state[c] !== 0) return;
      st.state[c] = 1;
      st.pend.indexOf(c) < 0 && c !== here && st.pend.push(c);
      if (G.key[c] && !st.lit[c]) {
        st.lit[c] = 1;
        st.nlit++;
        ctx.snd("beep", { p: 0.8 + st.nlit * 0.12 });
      }
      st.rev++;
      st.dirty = true;
    };
    if (here !== -2 && here !== st.cur) {
      const prev = st.cur;
      if (here >= 0 && G.frag[here] && st.state[here] !== 2) {
        // pasar en diagonal por una esquina también pisa las dos losas de los lados
        if (prev >= 0) {
          const dx = (here % w) - (prev % w),
            dz = Math.floor(here / w) - Math.floor(prev / w);
          if (Math.abs(dx) === 1 && Math.abs(dz) === 1) {
            stepOn(prev + dx);
            stepOn(prev + dz * w);
          }
        }
        const k = st.pend.indexOf(here);
        k >= 0 && st.pend.splice(k, 1);
        if (prev >= 0 && st.state[prev] === 1 && st.pend.indexOf(prev) < 0) st.pend.push(prev);
        stepOn(here);
        st.cur = here;
      } else {
        if (prev >= 0 && st.state[prev] === 1 && st.pend.indexOf(prev) < 0) st.pend.push(prev);
        st.cur = -1;
      }
    }
    // las losas dejadas se cierran cuando ya no hay nadie sobre ellas (a 0,3 m del borde)
    for (let i = st.pend.length - 1; i >= 0; i--) {
      const c = st.pend[i],
        qx = (c % w) + 0.5,
        qz = Math.floor(c / w) + 0.5,
        dd = Math.hypot(Math.max(0, Math.abs(ctx.px - qx) - 0.5), Math.max(0, Math.abs(ctx.pz - qz) - 0.5));
      if (c === st.cur) st.pend.splice(i, 1);
      else if (!ctx.inside || dd >= 0.3) {
        st.pend.splice(i, 1);
        closeTile(c);
      }
    }
    if (!st.open && st.nlit >= spec.keys.length) {
      st.open = true;
      st.rev++;
      ctx.snd("door");
      ctx.toast("¡La salida se ha abierto!", "quest");
    }
    if (st.open && here === spec.exit) st.reached = true;
    // ¿sigue habiendo camino? (solo cuando algo ha cambiado)
    if (st.dirty) {
      st.dirty = false;
      const stuck = !st.reached && skStuck(spec, st);
      if (stuck !== st.stuck) {
        st.stuck = stuck;
        st.rev++;
        stuck && ctx.toast("Ya no hay camino: pulsa Reiniciar.", "warn");
      }
    }
  },
  status(spec, st) {
    const out = [`Diamantes pisados: ${st.nlit}/${spec.keys.length}`, st.open ? "Salida abierta: ve a ella" : "Salida cerrada"];
    if (st.stuck) out.push("Sin camino desde aquí: reinicia");
    return out;
  },
  hint(spec, st) {
    const G = skGrid(spec),
      sunk = new Uint8Array(st.state.length);
    for (let c = 0; c < sunk.length; c++) sunk[c] = st.state[c] === 2 ? 1 : 0;
    const from = st.cur >= 0 ? st.cur : G.s0;
    if (st.cur < 0 && st.state[G.s0] === 0) return { id: G.s0, text: "Pista: entra por la losa marcada." };
    const res = skSolve(spec, 1, 200000, from, sunk, st.lit);
    if (!res.first || res.first.length < 2) return { text: "Pista: ya no hay camino desde aquí; pulsa Reiniciar." };
    return { id: res.first[1], text: "Pista: la siguiente losa es la marcada." };
  },
  focus(spec, st, id) {
    return id >= 0 ? [id % spec.w, Math.floor(id / spec.w)] : null;
  },
  solve(spec, st) {
    for (const k of spec.keys) st.lit[k] = 1;
    st.nlit = spec.keys.length;
    st.open = true;
    st.reached = true;
    st.rev++;
  },
  hackable: true,
  botMode: "walk",
  bot(spec) {
    const c = (q) => ({ at: [(q % spec.w) + 0.5, Math.floor(q / spec.w) + 0.5] });
    return [c(spec.entry), ...spec.sol.map(c), c(spec.exit)];
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h,
      G = skGrid(spec),
      done = st.done;
    for (let z = 0; z < h; z++)
      for (let xx = 0; xx < w; xx++) {
        const c = z * w + xx,
          px = xx + 0.5,
          pz = z + 0.5;
        if (G.wall[c]) {
          const edge = xx === 0 || z === 0 || xx === w - 1 || z === h - 1;
          g.box(px, pz, edge ? 0.5 : 0.55, 0.96, edge ? 1 : 1.1, 0.96, edge ? 0x2f363e : 0x474f58);
        } else if (c === spec.entry) g.box(px, pz, 0.04, 0.9, 0.05, 0.9, 0x2f6a7a, 0.7);
        else if (c === spec.exit) {
          if (st.open || done) g.box(px, pz, 0.05, 0.9, 0.06, 0.9, 0x4cff8f, 1.4 + Math.sin(t * 5) * 0.3);
          else {
            g.box(px, pz, 0.55, 0.9, 1.1, 0.9, 0xff8a3c, 0.9);
            g.box(px, pz, 0.55, 0.96, 1.16, 0.2, 0x1a1f26, 0);
          }
        } else if (G.frag[c]) {
          const s = st.state[c];
          if (s === 2) {
            g.box(px, pz, 0.2, 0.96, 0.4, 0.96, 0x4a2c22);
            g.box(px, pz, 0.41, 0.82, 0.03, 0.82, G.key[c] ? 0x4cff8f : 0xff6a3c, G.key[c] ? 1.1 : 0.8);
          } else if (s === 1) g.box(px, pz, 0.05, 0.9, 0.08, 0.9, 0xffc24a, 1.1);
          else g.box(px, pz, 0.04, 0.9, 0.07, 0.9, (xx + z) & 1 ? 0x2a4a63 : 0x244058, 0.25);
          if (G.key[c] && s !== 2) {
            g.oct(px, pz, 0.46 + Math.sin(t * 3 + c) * 0.05, 0.22, s === 1 ? 0x4cff8f : 0x7fe4ff, s === 1 ? 2 : 1.6);
            g.ring(px, pz, 0.1, 0.34, s === 1 ? 0x4cff8f : 0x7fe4ff, 1.2);
          }
        }
      }
  },
};
// ¿Quedan sin alcanzar diamantes o la salida desde donde estás? (necesario, no suficiente: aviso rápido de que te has encerrado)
function skStuck(spec, st) {
  const G = skGrid(spec),
    w = spec.w,
    N = w * spec.h,
    from = st.cur >= 0 ? st.cur : st.state[G.s0] === 0 ? G.s0 : -1;
  if (from < 0) return true; // la losa de entrada ya está cerrada y no estás sobre ninguna: no hay forma de entrar
  const seen = new Uint8Array(N),
    q = [from],
    OFF = [1, w, -1, -w];
  seen[from] = 1;
  for (let i = 0; i < q.length; i++) {
    const c = q[i],
      cx = c % w;
    if (c === G.sx && c !== from) continue;
    for (let d = 0; d < 4; d++) {
      if ((d === 0 && cx + 1 >= w) || (d === 2 && cx === 0)) continue;
      const nb = c + OFF[d];
      if (nb < 0 || nb >= N || seen[nb] || !G.frag[nb] || st.state[nb] !== 0) continue;
      seen[nb] = 1;
      q.push(nb);
    }
  }
  for (const k of spec.keys) if (!st.lit[k] && !seen[k]) return true;
  return !(seen[G.sx] || from === G.sx);
}
function pzMemoDrop(spec) {
  PZ_MEMO.delete(spec);
}

// ───────── 3.11 BLOQUES SOBRE HIELO ─────────
// Como las cajas sobre placas, pero el suelo es hielo: al empujar un bloque, resbala hasta chocar con un muro, otro bloque o el borde de la cámara.
// Hay que dejar un bloque parado en cada placa, así que hay que buscar con qué frenarlos. Mismo BFS de estados que sokSolve (bloques + zona del jugador).
function iceSolve(spec, cap, boxes0, p0) {
  const w0 = spec.w,
    h0 = spec.h,
    w = w0 + 2,
    h = h0 + 2,
    n = w * h,
    nb = spec.goals.length,
    wall = new Uint8Array(n),
    goal = new Uint8Array(n),
    reach = new Uint8Array(n),
    blk = new Uint8Array(n),
    qa = new Int32Array(n);
  const E = (c) => (((c / w0) | 0) + 1) * w + (c % w0) + 1,
    U = (c) => ((c / w) | 0) * w0 - w0 + (c % w) - 1;
  for (const q of spec.walls) wall[E(q)] = 1;
  for (const q of spec.goals) goal[E(q)] = 1;
  const flood = (boxes, p) => {
    blk.set(wall);
    for (const b of boxes) blk[b] = 1;
    return sokFlood(w, h, blk, p, reach, qa);
  };
  const keyOf = (boxes, rep) => {
    let k = 0;
    for (const b of boxes) k = k * 128 + b;
    return k * 128 + rep;
  };
  const isGoal = (boxes) => {
    for (const b of boxes) if (!goal[b]) return false;
    return true;
  };
  const start = (boxes0 || spec.boxes).map(E).sort((a, b) => a - b);
  if (isGoal(start)) return { ok: true, pushes: 0, sol: [], states: 1 };
  const rep0 = flood(start, p0 === undefined || p0 < 0 ? 0 : E(p0));
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
          pz = cz - PZ_DZ[d];
        if (px < 0 || pz < 0 || px >= w || pz >= h || !regionCopy[pz * w + px]) continue;
        // resbala hasta chocar
        let tx = cx,
          tz = cz;
        for (;;) {
          const nx = tx + PZ_DX[d],
            nz = tz + PZ_DZ[d];
          if (nx < 1 || nz < 1 || nx > w0 || nz > h0) break;
          const t = nz * w + nx;
          if (wall[t] || nd.boxes.indexOf(t) >= 0) break;
          tx = nx;
          tz = nz;
        }
        if (tx === cx && tz === cz) continue;
        const nbx = nd.boxes.slice();
        nbx[bi] = tz * w + tx;
        nbx.sort((a, b) => a - b);
        const rep = flood(nbx, c),
          k = keyOf(nbx, rep);
        if (seen.has(k)) continue;
        seen.set(k, nodes.length);
        nodes.push({ boxes: nbx, rep, par: qi, act: [U(c), d] });
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
// Dónde acaba un bloque empujado desde la celda c en la dirección d (celdas del puzle)
function iceSlide(spec, boxes, wall, c, d) {
  const w = spec.w,
    h = spec.h;
  let tx = c % w,
    tz = (c / w) | 0;
  for (;;) {
    const nx = tx + PZ_DX[d],
      nz = tz + PZ_DZ[d];
    if (nx < 0 || nz < 0 || nx >= w || nz >= h) break;
    const t = nz * w + nx;
    if (wall[t] || boxes.indexOf(t) >= 0) break;
    tx = nx;
    tz = nz;
  }
  return tz * w + tx;
}
PZ_GENS.ice = {
  id: "ice",
  n: "Bloques sobre hielo",
  d: "El suelo es hielo: los bloques resbalan hasta chocar. Deja uno parado en cada placa. Si te atascas, reinicia o deshaz.",
  icon: "❄",
  dims: { 1: [5, 5], 2: [6, 5], 3: [7, 6] },
  lv: {
    1: { boxes: 1, walls: [2, 4], minPush: 3, maxPush: 8, tries: 400, cap: 4000 },
    2: { boxes: 2, walls: [3, 5], minPush: 6, maxPush: 16, tries: 400, cap: 30000 },
    3: { boxes: 2, walls: [5, 8], minPush: 9, maxPush: 22, tries: 500, cap: 20000 },
  },
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier],
      n = w * h;
    let best = null;
    for (let att = 0; att < P.tries; att++) {
      const r = pzRng(pzMix(seed, tier, 0x4943, att)),
        wall = new Uint8Array(n),
        walls = [],
        nW = r.int(P.walls[0], P.walls[1]);
      for (let i = 0; i < nW; i++) {
        const c = r.int(0, n - 1);
        if (!wall[c]) ((wall[c] = 1), walls.push(c));
      }
      const free = [];
      for (let i = 0; i < n; i++) if (!wall[i]) free.push(i);
      r.shuffle(free);
      const goals = free.slice(0, P.boxes).sort((a, b) => a - b),
        boxes = free.slice(P.boxes, P.boxes * 2).sort((a, b) => a - b);
      // los bloques no empiezan ya en una placa ni pegados al muro de forma que no se puedan empujar de ninguna manera
      if (boxes.some((b) => goals.indexOf(b) >= 0)) continue;
      const spec = { kind: "ice", seed, tier, w, h, walls: walls.slice().sort((a, b) => a - b), goals, boxes };
      const sv = iceSolve(spec, P.cap);
      if (!sv.ok || sv.pushes < P.minPush) {
        if (sv.ok && sv.pushes >= 1 && (!best || sv.pushes > best.sol.length)) {
          spec.sol = sv.sol;
          best = spec;
        }
        continue;
      }
      if (sv.pushes > P.maxPush) continue;
      spec.sol = sv.sol;
      return spec;
    }
    return best;
  },
  validate(spec) {
    const s = iceSolve(spec, 250000),
      ok = s.ok && s.pushes >= 1 && spec.boxes.length === spec.goals.length;
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
    st.tweenMax = 0.16;
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
  pick(spec, st, px, pz, fx, fz) {
    return PZ_GENS.boxes.pick(spec, st, px, pz, fx, fz);
  },
  label(spec, st, id) {
    return this.canPush(spec, st, id >> 2, id & 3) ? "Empujar bloque (resbala)" : "Bloque bloqueado";
  },
  canPush(spec, st, i, d) {
    return iceSlide(spec, st.boxes, st.wall, st.boxes[i], d) !== st.boxes[i];
  },
  act(spec, st, id, ctx) {
    const i = id >> 2,
      d = id & 3,
      b = st.boxes[i];
    if (!this.canPush(spec, st, i, d)) return ctx.snd("err");
    // si el jugador (u otro) está en el camino, el bloque se para antes
    let t = iceSlide(spec, st.boxes, st.wall, b, d);
    if (ctx.occupied) {
      let c = b;
      for (;;) {
        const nx = (c % spec.w) + PZ_DX[d],
          nz = ((c / spec.w) | 0) + PZ_DZ[d];
        if (nx < 0 || nz < 0 || nx >= spec.w || nz >= spec.h) break;
        if (ctx.occupied(nx, nz)) {
          t = c;
          break;
        }
        c = nz * spec.w + nx;
        if (c === t) break;
      }
    }
    if (t === b) return ctx.snd("err");
    st.hist.push(st.boxes.slice());
    st.boxes[i] = t;
    const cells = Math.max(Math.abs((t % spec.w) - (b % spec.w)), Math.abs(((t / spec.w) | 0) - ((b / spec.w) | 0)));
    st.tw.i = i;
    st.tw.from = b;
    st.tweenMax = Math.min(0.55, 0.07 * cells + 0.05);
    st.tween = st.tweenMax;
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
    return [`Bloques en su placa: ${on}/${st.boxes.length}`, `Empujes: ${st.moves}`];
  },
  hint(spec, st, ctx) {
    const s = iceSolve(spec, 120000, st.boxes, ctx && ctx.cell !== undefined ? ctx.cell : -1);
    if (!s.ok || !s.sol.length) return { text: "Pista: esta posición no tiene salida; usa «Deshacer» o «Reiniciar»." };
    const [c, d] = s.sol[0];
    const dir = ["derecha", "abajo", "izquierda", "arriba"][d];
    return { id: st.boxes.indexOf(c) * 4 + d, text: `Pista: empuja el bloque marcado hacia ${dir}.` };
  },
  focus(spec, st, id) {
    const b = st.boxes[id >> 2];
    return b === undefined ? null : [b % spec.w, (b / spec.w) | 0];
  },
  par(spec) {
    return iceSolve(spec, 250000).pushes;
  },
  solve(spec, st) {
    st.boxes = spec.goals.slice();
    st.hist.length = 0;
    st.tw.i = -1;
    st.tween = 0;
    st.rev++;
  },
  hackable: true,
  bot(spec, st, px, pz) {
    const cell = px === undefined ? -1 : Math.max(0, Math.min(spec.h - 1, Math.floor(pz))) * spec.w + Math.max(0, Math.min(spec.w - 1, Math.floor(px)));
    const s = iceSolve(spec, 250000, st.boxes, cell);
    if (!s.ok) return null;
    return s.sol.map(([c, d]) => ({ dyn: (st2) => st2.boxes.indexOf(c) * 4 + d, at: [(c % spec.w) + 0.5 - PZ_DX[d], ((c / spec.w) | 0) + 0.5 - PZ_DZ[d]], face: [PZ_DX[d], PZ_DZ[d]] }));
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h;
    for (let z = 0; z < h; z++) for (let xx = 0; xx < w; xx++) g.box(xx + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, (xx + z) & 1 ? 0x2b5266 : 0x244a5e, 0.15);
    // el borde de la cámara: un bordillo bajo (los bloques se paran en él)
    for (let xx = 0; xx < w; xx++) {
      g.box(xx + 0.5, -0.06, 0.1, 1, 0.2, 0.12, 0x6f8fa3);
      g.box(xx + 0.5, h + 0.06, 0.1, 1, 0.2, 0.12, 0x6f8fa3);
    }
    for (let z = 0; z < h; z++) {
      g.box(-0.06, z + 0.5, 0.1, 0.12, 0.2, 1, 0x6f8fa3);
      g.box(w + 0.06, z + 0.5, 0.1, 0.12, 0.2, 1, 0x6f8fa3);
    }
    for (const q of spec.walls) g.box((q % w) + 0.5, ((q / w) | 0) + 0.5, 0.55, 0.92, 1.1, 0.92, 0x55687a);
    for (const q of spec.goals) {
      const on = st.boxes.indexOf(q) >= 0;
      g.box((q % w) + 0.5, ((q / w) | 0) + 0.5, 0.06, 0.78, 0.04, 0.78, on ? 0x3cff8a : 0xffc24a, on ? 1.5 : 0.7);
    }
    for (let i = 0; i < st.boxes.length; i++) {
      let b = st.boxes[i],
        cx = (b % w) + 0.5,
        cz = ((b / w) | 0) + 0.5;
      if (st.tw.i === i && st.tween > 0) {
        const f = st.tween / (st.tweenMax || 0.16),
          fx = (st.tw.from % w) + 0.5,
          fz = ((st.tw.from / w) | 0) + 0.5;
        cx += (fx - cx) * f;
        cz += (fz - cz) * f;
      }
      const on = st.goal[b];
      g.box(cx, cz, 0.4, 0.82, 0.8, 0.82, on ? 0x7fffc0 : 0x9fd8f0, on ? 0.6 : 0.2);
      g.box(cx, cz, 0.82, 0.74, 0.06, 0.74, on ? 0xd8fff0 : 0xe6f8ff, 0.3);
    }
  },
};

// ───────── 3.12 CERRADURA DE SÍMBOLOS ─────────
// Una cerradura con L ranuras que giran entre K símbolos (los del Archivo). El código es una combinación de símbolos distintos. «Probar» compara tu
// combinación con la buena: cuántos símbolos están en su sitio (✔) y cuántos están pero en otra ranura (◐). Los intentos son limitados; si se agotan,
// la cerradura cambia de código. validate() simula a un jugador metódico (prueba siempre una combinación coherente con todo lo visto) sobre los
// códigos de las primeras rondas y exige que le sobren intentos.
var LK_CANDS = new Map();
function lkCands(L, K) {
  const key = L * 16 + K;
  let out = LK_CANDS.get(key);
  if (out) return out;
  out = [];
  const used = new Array(K).fill(false),
    cur = [];
  (function rec() {
    if (cur.length === L) return out.push(cur.slice());
    for (let s = 0; s < K; s++) {
      if (used[s]) continue;
      used[s] = true;
      cur.push(s);
      rec();
      cur.pop();
      used[s] = false;
    }
  })();
  LK_CANDS.set(key, out);
  return out;
}
var LK_CS = new Int8Array(16),
  LK_CG = new Int8Array(16);
// 10·(en su sitio) + (en otra ranura); el código es de símbolos distintos, la combinación puede repetir
function lkScore(sec, g, L, K) {
  LK_CS.fill(0);
  LK_CG.fill(0);
  let ex = 0;
  for (let i = 0; i < L; i++) {
    if (sec[i] === g[i]) ex++;
    else {
      LK_CS[sec[i]]++;
      LK_CG[g[i]]++;
    }
  }
  let ne = 0;
  for (let k = 0; k < K; k++) ne += LK_CS[k] < LK_CG[k] ? LK_CS[k] : LK_CG[k];
  return ex * 10 + ne;
}
function lkSecret(spec, round) {
  // el código de cada ronda sale de la semilla; se descartan los que ya empiezan puestos y los que se abren a la primera o a la segunda
  return pzMemo(spec, "sec" + (round | 0), () => {
    let sec = null;
    for (let salt = 0; salt < 40; salt++) {
      const r = pzRng(pzMix(spec.seed, spec.tier, 0x4c4b, round | 0, salt)),
        a = [];
      for (let k = 0; k < spec.K; k++) a.push(k);
      r.shuffle(a);
      sec = a.slice(0, spec.L);
      if (sec.every((v, i) => v === i)) continue;
      const gs = lkSolve(spec, sec);
      if (gs && gs.length >= 3) break;
    }
    return sec;
  });
}
// Las combinaciones que probaría un jugador metódico contra un código (siempre la primera coherente con lo visto)
function lkSolve(spec, secret) {
  const { L, K } = spec,
    guesses = [];
  let c = lkCands(L, K),
    g = [];
  for (let i = 0; i < L; i++) g.push(i);
  for (let n = 0; n < 40; n++) {
    guesses.push(g.slice());
    const f = lkScore(secret, g, L, K);
    if (f === L * 10) return guesses;
    const gg = g;
    c = c.filter((x) => lkScore(x, gg, L, K) === f);
    if (!c.length) return null;
    g = c[0];
  }
  return null;
}
// forma de cada símbolo, con las mismas primitivas que las runas
function lkShape(g, R, cx, cz, y, col, gl, t, sc) {
  switch (R.sh) {
    case "sph": g.sph(cx, cz, y, 0.22 * sc, col, gl); break;
    case "ring": g.ring(cx, cz, y, 0.2 * sc, col, gl, true); break;
    case "oct": g.oct(cx, cz, y, 0.26 * sc, col, gl); break;
    case "cone": g.cone(cx, cz, y, 0.24 * sc, 0.4 * sc, col, gl); break;
    case "cone2": g.cone(cx, cz, y, 0.24 * sc, 0.4 * sc, col, gl, true); break;
    case "box": g.box(cx, cz, y, 0.3 * sc, 0.3 * sc, 0.3 * sc, col, gl, t * 0.6); break;
    case "cross": g.box(cx, cz, y, 0.42 * sc, 0.12 * sc, 0.12 * sc, col, gl); g.box(cx, cz, y, 0.12 * sc, 0.42 * sc, 0.12 * sc, col, gl); break;
    default: g.cyl(cx, cz, y, 0.16 * sc, 0.34 * sc, col, gl);
  }
}
PZ_GENS.lock = {
  id: "lock",
  n: "Cerradura de símbolos",
  d: "Gira las ranuras hasta formar el código. Al probar, ✔ cuenta los símbolos en su sitio y ◐ los que están en otra ranura. Los intentos son limitados.",
  icon: "⌘",
  dims: { 1: [5, 4], 2: [6, 4], 3: [7, 4] },
  lv: {
    1: { L: 3, K: 5, tries: 8 },
    2: { L: 4, K: 6, tries: 9 },
    3: { L: 5, K: 6, tries: 9 },
  },
  make(seed, tier) {
    const [w, h] = this.dims[tier],
      P = this.lv[tier],
      r = pzRng(pzMix(seed, tier, 0x4c4f)),
      ids = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, P.K);
    return { kind: "lock", seed, tier, w, h, L: P.L, K: P.K, tries: P.tries, ids };
  },
  validate(spec) {
    const { L, K, tries } = spec;
    if (!spec.ids || spec.ids.length !== K || new Set(spec.ids).size !== K || spec.ids.some((v) => v < 0 || v >= PZ_RUNES.length)) return { ok: false, why: "símbolos mal elegidos" };
    if (spec.w < L + 2 || spec.h < 4) return { ok: false, why: "la cerradura no cabe" };
    let worst = 0,
      first = 0;
    for (let round = 0; round < 3; round++) {
      const sec = lkSecret(spec, round),
        gs = lkSolve(spec, sec);
      if (!gs) return { ok: false, why: "el jugador metódico no la abre" };
      worst = Math.max(worst, gs.length);
      if (!round) first = gs.length;
    }
    const ok = worst <= tries - 2;
    return { ok, why: ok ? "" : "no sobran intentos", guesses: first, worst, tries, codes: lkCands(L, K).length, L, K };
  },
  init(spec) {
    const st = pzBaseState(spec);
    st.cur = [];
    for (let i = 0; i < spec.L; i++) st.cur.push(i);
    st.hist = [];
    st.round = 0;
    st.fails = 0;
    st.open = false;
    st.flash = 0;
    return st;
  },
  reset(spec, st) {
    for (let i = 0; i < spec.L; i++) st.cur[i] = i;
    st.hist.length = 0;
    st.rev++;
  },
  solved(spec, st) {
    return st.open === true;
  },
  // pedestales de las ranuras (fila de atrás) y consola de «Probar» (fila de delante)
  cells(spec) {
    return pzMemo(spec, "cells", () => {
      const x0 = Math.floor((spec.w - spec.L) / 2),
        out = [];
      for (let i = 0; i < spec.L; i++) out.push([x0 + i, 0]);
      out.push([Math.floor(spec.w / 2), spec.h - 1]);
      return out;
    });
  },
  solid(spec, st, cx, cz) {
    const cs = this.cells(spec);
    for (let i = 0; i < cs.length; i++) if (cs[i][0] === cx && cs[i][1] === cz) return true;
    return false;
  },
  spots(spec) {
    return this.cells(spec);
  },
  pick(spec, st, px, pz, fx, fz) {
    return pzNearest(this.cells(spec), px, pz, fx, fz);
  },
  label(spec, st, id) {
    if (id < spec.L) return `Girar ranura ${id + 1} · ${PZ_RUNES[spec.ids[st.cur[id]]].g} ${PZ_RUNES[spec.ids[st.cur[id]]].n}`;
    return `Probar la combinación (intento ${st.hist.length + 1} de ${spec.tries})`;
  },
  focus(spec, st, id) {
    return this.cells(spec)[id] || null;
  },
  act(spec, st, id, ctx) {
    if (st.open) return;
    const { L, K } = spec;
    if (id < L) {
      st.cur[id] = (st.cur[id] + 1) % K;
      st.rev++;
      ctx.snd("beep", { p: 0.7 + st.cur[id] * 0.09 });
      return;
    }
    const sec = lkSecret(spec, st.round),
      f = lkScore(sec, st.cur, L, K),
      ex = (f / 10) | 0,
      ne = f % 10;
    st.hist.push({ g: st.cur.slice(), ex, ne });
    st.moves++;
    st.rev++;
    if (ex === L) {
      st.open = true;
      ctx.snd("success");
      return;
    }
    if (st.hist.length >= spec.tries) {
      st.errors++;
      st.fails++;
      st.round++;
      st.hist.length = 0;
      ctx.snd("zap");
      ctx.hurt(PZ_CFG.respawnPenalty * 0.4);
      ctx.toast("Intentos agotados: la cerradura cambia de código.", "warn");
      return;
    }
    ctx.snd(ex || ne ? "beep" : "err", { p: 0.9 + ex * 0.2 });
  },
  step() {},
  status(spec, st) {
    const out = [`Intentos: ${st.hist.length}/${spec.tries}`];
    if (st.fails) out.push(`Códigos cambiados: ${st.fails}`);
    return out;
  },
  clueLines(spec, st) {
    const n = st.hist.length,
      from = Math.max(0, n - 6),
      out = [];
    for (let i = from; i < n; i++) {
      const q = st.hist[i];
      out.push(`${i + 1}) ${q.g.map((k) => PZ_RUNES[spec.ids[k]].g).join(" ")}   ✔${q.ex}  ◐${q.ne}`);
    }
    return out;
  },
  hint(spec, st) {
    const { L, K } = spec;
    let c = lkCands(L, K);
    for (const q of st.hist) c = c.filter((x) => lkScore(x, q.g, L, K) === q.ex * 10 + q.ne);
    // con el historial actual solo valen los códigos coherentes; se propone la primera ranura que difiere
    const sec = lkSecret(spec, st.round),
      want = c.length && c.some((x) => x.every((v, i) => v === sec[i])) ? sec : c[0];
    if (!want) return null;
    for (let i = 0; i < L; i++) if (st.cur[i] !== want[i]) return { id: i, text: `Pista: en la ranura ${i + 1} va ${PZ_RUNES[spec.ids[want[i]]].g} ${PZ_RUNES[spec.ids[want[i]]].n}.` };
    return { id: L, text: "Pista: esa combinación es coherente con todo lo visto; pruébala." };
  },
  par(spec) {
    return lkSolve(spec, lkSecret(spec, 0)).length;
  },
  solve(spec, st) {
    const sec = lkSecret(spec, st.round);
    for (let i = 0; i < spec.L; i++) st.cur[i] = sec[i];
    st.open = true;
    st.rev++;
  },
  hackable: true,
  glyphs(spec, st) {
    // una etiqueta por ranura, con el símbolo que tiene ahora (se actualizan en su sitio cuando cambian)
    const list = pzMemo(spec, "gl", () => this.cells(spec).slice(0, spec.L).map((c) => ({ cx: c[0] + 0.5, cz: c[1] + 0.5, y: 1.55, t: "", n: "", col: 0xffffff, k: -1 })));
    for (let i = 0; i < spec.L; i++) {
      const q = list[i],
        v = st && st.cur ? st.cur[i] : 0;
      if (q.k !== v) {
        const R = PZ_RUNES[spec.ids[v]];
        q.k = v;
        q.t = R.g;
        q.n = "";
        q.col = R.col;
      }
    }
    return list;
  },
  bot(spec) {
    const { L, K } = spec,
      cs = this.cells(spec),
      gs = lkSolve(spec, lkSecret(spec, 0)),
      acts = [],
      cur = [];
    for (let i = 0; i < L; i++) cur.push(i);
    if (!gs) return null;
    for (const g of gs) {
      for (let i = 0; i < L; i++) {
        const n = (g[i] - cur[i] + K) % K;
        for (let k = 0; k < n; k++) acts.push({ id: i, at: [cs[i][0] + 0.5, 1.5] });
        cur[i] = g[i];
      }
      acts.push({ id: L, at: [cs[L][0] + 0.5, spec.h - 1.5] });
    }
    return acts;
  },
  draw(spec, st, g, t) {
    const w = spec.w,
      h = spec.h,
      cs = this.cells(spec),
      open = st.open;
    for (let z = 0; z < h; z++) for (let xx = 0; xx < w; xx++) g.box(xx + 0.5, z + 0.5, 0.025, 0.94, 0.05, 0.94, (xx + z) & 1 ? 0x2a2733 : 0x24212d);
    for (let i = 0; i < spec.L; i++) {
      const R = PZ_RUNES[spec.ids[st.cur[i]]],
        cx = cs[i][0] + 0.5,
        cz = cs[i][1] + 0.5,
        col = open ? 0x4cff8f : R.col;
      g.cyl(cx, cz, 0.3, 0.3, 0.6, 0x3d4350);
      g.box(cx, cz, 0.62, 0.62, 0.05, 0.62, 0x505868);
      g.ring(cx, cz, 0.66, 0.3, col, 1.2);
      lkShape(g, R, cx, cz, 1.0 + Math.sin(t * 2.4 + i) * 0.04, col, open ? 2 : 1.3, t, 1);
    }
    // consola de «Probar» con las luces del último intento
    const c = cs[spec.L],
      cx = c[0] + 0.5,
      cz = c[1] + 0.5;
    g.box(cx, cz, 0.3, 0.8, 0.6, 0.55, 0x3b4452);
    g.box(cx, cz, 0.64, 0.56, 0.06, 0.36, open ? 0x4cff8f : 0xffb347, 1.2 + Math.sin(t * 4) * 0.3);
    const last = st.hist.length ? st.hist[st.hist.length - 1] : null;
    for (let i = 0; i < spec.L; i++) {
      const on = last && i < last.ex + last.ne,
        col = !last ? 0x555e6a : i < last.ex ? 0x4cff8f : i < last.ex + last.ne ? 0xffd04a : 0x555e6a;
      g.sph(cx - (spec.L - 1) * 0.16 + i * 0.32, cz, 0.95, 0.09, open ? 0x4cff8f : col, on || open ? 1.8 : 0.2);
    }
  },
};

// ═══ 4. REGISTRO, API Y PRUEBAS ═════════════════════════════════════════════════════════════════════════
// Un generador nuevo (de este u otro frente) se añade con x.puzzleApi.register(tipo, generador). Contrato mínimo: make(seed, tier) → spec
// (JSON puro) y validate(spec) → {ok, why}. Para poder jugarlo en el mundo también necesita init/solved/pick/label/act/draw (ver arriba).
var PZ_CACHE = new Map();
function pzValidGen(g) {
  return !!g && typeof g.make === "function" && typeof g.validate === "function";
}
function pzPlayable(g) {
  return !!g && typeof g.init === "function" && typeof g.solved === "function" && typeof g.draw === "function";
}
function pzRegister(kind, gen) {
  if (typeof kind !== "string" || !/^[a-z][\w-]*$/i.test(kind) || !pzValidGen(gen)) return false;
  gen.id = kind;
  if (!gen.dims) gen.dims = {};
  if (!gen.lv) gen.lv = {};
  PZ_GENS[kind] = gen;
  for (const k of Array.from(PZ_CACHE.keys())) if (k.indexOf(kind + "|") === 0) PZ_CACHE.delete(k);
  x.puzzleApi && x.puzzleApi.kinds && x.puzzleApi.kinds.indexOf(kind) < 0 && x.puzzleApi.kinds.push(kind);
  return true;
}
// spec de (tipo, índice de semilla, nivel), con memoria: lo que se juega siempre sale de aquí (y validateAll() recorre todo ese universo)
function pzSpec(kind, idx, tier) {
  const key = kind + "|" + idx + "|" + tier;
  let sp = PZ_CACHE.get(key);
  if (sp === undefined) {
    const g = PZ_GENS[kind];
    sp = g ? g.make(idx, tier) : null;
    PZ_CACHE.set(key, sp);
  }
  return sp;
}
function pzTierOf(lvl) {
  let t = 1;
  for (const [m, tt] of PZ_CFG.tierByLvl) if (lvl >= m) t = tt;
  return t;
}
// Elige tipo (por peso del tema), nivel (±1 por azar) e índice de semilla a partir de un hash. Puro y determinista.
function pzChoose(hash, theme, lvl, only) {
  const r = pzRng(pzMix(hash, 0x4348)),
    W = PZ_CFG.weights[theme] || PZ_CFG.weights.default,
    kinds = (only || Object.keys(PZ_GENS)).filter((k) => !PZ_GENS[k].legacy && pzPlayable(PZ_GENS[k]) && (W[k] === undefined ? 1 : W[k]) > 0);
  let tot = 0;
  for (const k of kinds) tot += W[k] === undefined ? 1 : W[k];
  let q = r() * tot,
    kind = kinds[kinds.length - 1];
  for (const k of kinds) {
    q -= W[k] === undefined ? 1 : W[k];
    if (q <= 0) {
      kind = k;
      break;
    }
  }
  let tier = pzTierOf(lvl);
  const j = r();
  tier = Math.max(1, Math.min(3, tier + (j < 0.2 ? -1 : j > 0.85 ? 1 : 0)));
  return { kind, tier, idx: Math.floor(r() * PZ_CFG.pool) };
}

// ¿Se llega a cada objeto desde fuera? Rejilla ampliada con un anillo libre; solo cuentan las celdas sólidas del estado inicial.
function pzAccess(gen, spec) {
  if (!gen.spots || !gen.solid) return { ok: true };
  const st = gen.init(spec),
    w = spec.w,
    h = spec.h,
    W = w + 2,
    H = h + 2,
    blk = new Uint8Array(W * H),
    reach = new Uint8Array(W * H),
    qa = new Int32Array(W * H);
  for (let z = 0; z < h; z++) for (let xx = 0; xx < w; xx++) if (gen.solid(spec, st, xx, z)) blk[(z + 1) * W + xx + 1] = 1;
  sokFlood(W, H, blk, 0, reach, qa);
  for (const [cx, cz] of gen.spots(spec)) {
    let ok = false;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const ex = cx + dx + 1,
          ez = cz + dz + 1;
        if (ex >= 0 && ez >= 0 && ex < W && ez < H && reach[ez * W + ex]) ok = true;
      }
    if (!ok) return { ok: false, why: `objeto inalcanzable en ${cx},${cz}` };
  }
  return { ok: true };
}

// Ejecuta el bot del generador sobre su mecánica REAL (init/pick/act/step), sin gráficos ni jugador: prueba que se puede ganar jugando,
// no solo que el spec es resoluble. Modos: acciones (por defecto), «walk» (puntos de paso y relojes) y «phase» (pasillo láser).
function pzBotRun(gen, spec) {
  const st = gen.init(spec),
    log = { hurt: 0, tele: 0, snd: 0 },
    ctx = {
      px: -9,
      pz: -9,
      inside: false,
      cell: -1,
      snd() {
        log.snd++;
      },
      toast() {},
      hurt(f) {
        log.hurt += f;
      },
      teleport() {
        log.tele++;
      },
    },
    DT = 1 / 30;
  if (gen.solved(spec, st)) return { ok: false, why: "ya resuelto al empezar" };
  const plan = gen.bot ? gen.bot(spec, st) : null;
  if (!plan || !plan.length) return { ok: false, why: "el bot no encuentra plan" };
  let frames = 0;
  const stepN = (n) => {
    for (let i = 0; i < n; i++) {
      gen.step && gen.step(spec, st, DT, ctx);
      frames++;
    }
  };
  if (gen.botMode === "phase") {
    for (const p of plan) {
      st.t = p.k * PZ_LASER_DT + 0.02;
      ctx.px = p.x + 0.5;
      ctx.pz = p.z + 0.5;
      ctx.inside = true;
      stepN(1);
      if (st.reached) break;
    }
  } else if (gen.botMode === "walk") {
    let clock = 0;
    for (const a of plan) {
      if (a.t !== undefined && a.t > clock) {
        ctx.inside = false; // de camino: nadie pisa nada mientras tanto
        stepN(Math.round((a.t - clock) / DT));
        clock = a.t;
      }
      ctx.px = a.at[0];
      ctx.pz = a.at[1];
      ctx.inside = true;
      stepN(2);
      clock += 2 * DT;
    }
  } else {
    for (const a of plan) {
      const id = a.dyn ? a.dyn(st) : a.id;
      ctx.px = a.at[0];
      ctx.pz = a.at[1];
      ctx.inside = true;
      const pk = gen.pick ? gen.pick(spec, st, ctx.px, ctx.pz, a.face && a.face[0], a.face && a.face[1]) : id;
      if (pk !== id) return { ok: false, why: `el jugador en ${a.at.map((v) => v.toFixed(1))} no apunta al objeto ${id} sino al ${pk}` };
      if (!gen.act) return { ok: false, why: "el generador no tiene act" };
      gen.act(spec, st, id, ctx);
      stepN(1);
    }
  }
  const ok = !!gen.solved(spec, st) && st.errors === 0 && log.tele === 0;
  return { ok, why: ok ? "" : st.errors ? "el bot cometió errores" : log.tele ? "el bot fue teletransportado" : "el bot no resolvió", acts: plan.length, frames, moves: st.moves | 0 };
}

// Comprobaciones de UN puzle: spec JSON puro · validate() · tamaño declarado · alcance de cada objeto · el bot lo resuelve jugando de verdad
function pzCheckSpec(g, kind, tier, sp, opts, bk) {
  const js = JSON.stringify(sp);
  if (JSON.parse(js).kind !== kind) return "el spec no lleva su tipo";
  const v = g.validate(JSON.parse(js));
  if (!v || !v.ok) return "validate: " + ((v && v.why) || "falla");
  for (const f in v) {
    const n = v[f];
    if (typeof n !== "number" || !isFinite(n)) continue;
    const a = bk.stat[f] || (bk.stat[f] = { min: n, max: n, sum: 0, n: 0 });
    a.min = Math.min(a.min, n);
    a.max = Math.max(a.max, n);
    a.sum += n;
    a.n++;
  }
  if (pzPlayable(g)) {
    if (g.dims && g.dims[tier] && (sp.w !== g.dims[tier][0] || sp.h !== g.dims[tier][1])) return "tamaño distinto del declarado";
    const a = pzAccess(g, sp);
    if (!a.ok) return a.why;
    if (!opts.noBot) {
      const b = pzBotRun(g, sp);
      if (!b.ok) return "bot: " + b.why;
      for (const f of ["acts", "frames", "moves"]) {
        const a2 = bk.stat["bot_" + f] || (bk.stat["bot_" + f] = { min: b[f], max: b[f], sum: 0, n: 0 });
        a2.min = Math.min(a2.min, b[f]);
        a2.max = Math.max(a2.max, b[f]);
        a2.sum += b[f];
        a2.n++;
      }
    }
  }
  return "";
}
// Recorre TODAS las semillas y tamaños que el juego puede usar (pool × niveles × tipos, más las variantes de cada generador) y comprueba,
// para cada puzle: que make es determinista (mismo JSON dos veces) y lo anterior. Devuelve {total, ok, fails, failures[], byKind, ms, sum}.
function pzValidateAll(opts) {
  opts = opts || {};
  const t0 = Date.now(),
    pool = opts.pool || PZ_CFG.pool,
    out = { total: 0, ok: 0, fails: 0, failures: [], byKind: {}, ms: 0, sum: "" };
  let sum = 0x811c9dc5;
  for (const kind of opts.kinds || Object.keys(PZ_GENS)) {
    const g = PZ_GENS[kind];
    if (!g) continue;
    const bk = (out.byKind[kind] = { total: 0, ok: 0, fails: 0, ms: 0, stat: {} }),
      tk = Date.now();
    for (const tier of opts.tiers || g.tiers || [1, 2, 3]) {
      for (let idx = 0; idx < pool; idx++) {
        let sp = null,
          list = [];
        try {
          sp = pzSpec(kind, idx, tier);
          list.push(["", sp]);
          if (sp && g.variants) for (const v of g.variants(idx, tier)) list.push(["variante: ", v]);
        } catch (err) {
          list = [["", null]];
        }
        for (const [tag, s] of list) {
          out.total++;
          bk.total++;
          let why = "";
          try {
            if (!s || typeof s !== "object") why = "make no devuelve un puzle";
            else {
              const js = JSON.stringify(s);
              if (!opts.fast && !tag && JSON.stringify(g.make(idx, tier)) !== js) why = "make no es determinista";
              if (!why) why = pzCheckSpec(g, kind, tier, s, opts, bk);
              for (let i = 0; i < js.length; i++) sum = Math.imul(sum ^ js.charCodeAt(i), 16777619);
            }
          } catch (err) {
            why = "excepción: " + (err && err.message ? err.message : err);
          }
          if (why) {
            out.fails++;
            bk.fails++;
            out.failures.length < 60 && out.failures.push({ kind, tier, seed: idx, why: tag + why });
          } else {
            out.ok++;
            bk.ok++;
          }
        }
      }
    }
    bk.ms = Date.now() - tk;
  }
  out.ms = Date.now() - t0;
  out.sum = (sum >>> 0).toString(16);
  return out;
}

x.puzzleApi = {
  version: 1,
  gens: PZ_GENS,
  kinds: Object.keys(PZ_GENS),
  register: pzRegister,
  make: (kind, seed, tier) => (PZ_GENS[kind] ? PZ_GENS[kind].make(seed, tier) : null),
  validate: (spec) => (spec && PZ_GENS[spec.kind] ? PZ_GENS[spec.kind].validate(spec) : { ok: false, why: "tipo desconocido" }),
  validateAll: pzValidateAll,
  spec: pzSpec,
  choose: pzChoose,
  botRun: (spec) => (spec && PZ_GENS[spec.kind] ? pzBotRun(PZ_GENS[spec.kind], spec) : { ok: false, why: "tipo desconocido" }),
  cfg: PZ_CFG,
};
// ▲▲ PURO ▲▲

// ═══ 5. GUARDADO ════════════════════════════════════════════════════════════════════════════════════════
// S.puzzles = {id: {t, k, tier, p}}  puzles resueltos y cuándo (t en ms); el id es «sub:<id de la escalera>» (se repueblan a los 120 min,
//                                    como los cofres) o «leg:<id>» (la cámara sellada clásica). Las operaciones no se guardan (son únicas).
// S.puzzleStats = {n, perfect, hints, errors, hack, byKind:{tipo: n}}      S.puzzleV = 1
function pzMigrate(S) {
  if (!S || typeof S !== "object") return;
  if (!S.puzzles || typeof S.puzzles !== "object" || Array.isArray(S.puzzles)) S.puzzles = {};
  const now = Date.now(),
    keep = PZ_CFG.respawnMin * 6e4 * 6;
  for (const id of Object.keys(S.puzzles)) {
    const p = S.puzzles[id];
    if (!p || typeof p !== "object" || !isFinite(p.t) || p.t > now + 864e5 || now - p.t > keep) delete S.puzzles[id];
    else {
      p.k = String(p.k || "");
      p.tier = Math.max(1, Math.min(3, p.tier | 0 || 1));
    }
  }
  const T = S.puzzleStats;
  if (!T || typeof T !== "object" || Array.isArray(T)) S.puzzleStats = { n: 0, perfect: 0, hints: 0, errors: 0, hack: 0, byKind: {} };
  else {
    for (const f of ["n", "perfect", "hints", "errors", "hack"]) T[f] = Math.max(0, T[f] | 0);
    if (!T.byKind || typeof T.byKind !== "object" || Array.isArray(T.byKind)) T.byKind = {};
  }
  S.puzzleV = 1;
}
x.migrations.push(pzMigrate);
function pzS() {
  const S = x.S;
  if (!S) return null;
  if (S.puzzleV !== 1 || !S.puzzles || !S.puzzleStats) pzMigrate(S);
  return S;
}
// ¿Resuelto hace menos de respawnMin minutos? (sid = id guardado, o null si no se guarda)
function pzDoneRecently(sid) {
  const S = pzS(),
    p = S && sid ? S.puzzles[sid] : null;
  return !!p && Date.now() - p.t < PZ_CFG.respawnMin * 6e4;
}

// ═══ 6. COLOCACIÓN EN MAZMORRAS ═════════════════════════════════════════════════════════════════════════
// Las dos funciones de mazmorra del mundo (_x: subterráneos de edificios y cuevas · yx: operaciones) se envuelven: al terminar el mapa, y
// SIN llamar a su generador aleatorio (el RNG del mundo no se toca), se busca un hueco en una sala y se añade UNA entidad «puzzle».
// El azar de aquí es propio: el tipo, el nivel y la semilla del puzle salen de un hash del id de la escalera (siempre el mismo acertijo en la
// misma escalera) o, en las operaciones, de la semilla de la operación; la sala y la posición, de un RNG sembrado con la semilla del mapa.
var PZ_THEME_OP = { ruinas: "sotano", bunker: "sotano", laboratorio: "planta", fabrica: "planta", caverna: "gruta", magma: "gruta", colmena: "colmena" };
var PZ_LORE_KEYS = { desierto: "desierto.runas", colmena: "colmena.canto" }; // pistas del Archivo (31d) que dictan el orden de las runas
function pzTransform(d) {
  const lw = d.lw,
    lh = d.lh,
    x0 = d.x0,
    z0 = d.z0;
  switch (d.rot & 3) {
    case 0:
      return { m00: 1, m01: 0, m10: 0, m11: 1, tx: x0, tz: z0, ang: 0 };
    case 1:
      return { m00: 0, m01: 1, m10: -1, m11: 0, tx: x0, tz: z0 + lw, ang: Math.PI / 2 };
    case 2:
      return { m00: -1, m01: 0, m10: 0, m11: -1, tx: x0 + lw, tz: z0 + lh, ang: Math.PI };
    default:
      return { m00: 0, m01: -1, m10: 1, m11: 0, tx: x0 + lh, tz: z0, ang: -Math.PI / 2 };
  }
}
// Busca un rectángulo (W×H, con las 4 rotaciones) de suelo libre rodeado de un anillo también libre, dentro de una sala.
// `near` (opcional) = {x, z, r}: solo posiciones a menos de r metros (pruebas). Devuelve {x0, z0, rot, room} o null.
function pzFindSite(map, rooms, skip, dims, r, near, props) {
  const w = map.w,
    fl = map.floorT;
  // celdas ocupadas por entidades físicas (cofres, escaleras, paquetes de aparición…): el puzle no se les pone encima
  const busy = new Uint8Array(w * map.h);
  const mark = (px, pz, rad) => {
    for (let dz = -rad; dz <= rad; dz++)
      for (let dx = -rad; dx <= rad; dx++) {
        const cx = Math.floor(px) + dx,
          cz = Math.floor(pz) + dz;
        if (map.inb(cx, cz)) busy[cz * w + cx] = 1;
      }
  };
  // los puntos de aparición de enemigos no son obstáculos (los guardianes pueden salir dentro del acertijo)
  for (const en of map.ents) if (en.k !== "light" && en.k !== "encounter" && en.k !== "vault" && en.k !== "spawnpack" && en.k !== "spawnpt") mark(en.x, en.z, 1);
  if (map.spawnBase) mark(map.spawnBase[0], map.spawnBase[1], 2);
  // atrezo de la sala (cajas, taquillas…): estorba pero se puede quitar; solo en mazmorras (props = true)
  const propAt = props ? new Uint8Array(w * map.h) : null;
  if (props) for (const p of map.props) if (p.blk) propAt[Math.floor(p.z) * w + Math.floor(p.x)] = 1;
  // suelo válido: en mazmorras, exactamente el suelo de la mazmorra (floorT); en el mundo abierto (solo pruebas), cualquier suelo seco
  const okTer = fl !== undefined ? (t) => t === fl : (t) => !Ua[t] && t !== F.WATER && t !== F.LAVA && t !== F.ACID;
  const free = (cx, cz) => {
    if (!map.inb(cx, cz)) return false;
    const i = cz * w + cx;
    return okTer(map.ter[i]) && (!map.blk[i] || (propAt && propAt[i])) && !busy[i];
  };
  const rs = (rooms || []).filter((rm) => rm && !(skip && skip.has(rm)));
  for (const rm of r.shuffle(rs.slice())) {
    for (const rot of r.shuffle([0, 1, 2, 3])) {
      const Wr = rot & 1 ? dims[1] : dims[0],
        Hr = rot & 1 ? dims[0] : dims[1];
      if (Wr + 2 > rm.w || Hr + 2 > rm.h) continue;
      const found = [];
      for (let z0 = rm.z0 + 1; z0 + Hr <= rm.z1; z0++)
        for (let x0 = rm.x0 + 1; x0 + Wr <= rm.x1; x0++) {
          if (near && Math.hypot(x0 + Wr / 2 - near.x, z0 + Hr / 2 - near.z) > near.r) continue;
          let ok = true;
          for (let cz = z0 - 1; cz <= z0 + Hr && ok; cz++)
            for (let cx = x0 - 1; cx <= x0 + Wr; cx++)
              if (!free(cx, cz) || (rm.tiles && !rm.tiles.has(cz * w + cx))) {
                ok = false;
                break;
              }
          if (ok) found.push([x0, z0]);
        }
      if (found.length) {
        const [x0, z0] = r.pick(found);
        return { x0, z0, rot, room: rm };
      }
    }
  }
  return null;
}
// Quita el atrezo (props y decorado) que cae dentro del rectángulo del puzle más su anillo, y libera las celdas que bloqueaban
function pzClearSite(map, site, dims) {
  const W = site.rot & 1 ? dims[1] : dims[0],
    H = site.rot & 1 ? dims[0] : dims[1],
    w = map.w;
  const inside = (px, pz) => px >= site.x0 - 1 && px < site.x0 + W + 1 && pz >= site.z0 - 1 && pz < site.z0 + H + 1;
  map.props = map.props.filter((p) => {
    if (!inside(Math.floor(p.x), Math.floor(p.z))) return true;
    if (p.blk) map.blk[Math.floor(p.z) * w + Math.floor(p.x)] = 0;
    return false;
  });
  map.decor = map.decor.filter((d) => !inside(Math.floor(d.x), Math.floor(d.z)));
}
// Construye la entidad del puzle y la añade al mapa. Devuelve la entidad o null.
function pzAddEnt(map, id, kind, tier, idx, site, extra) {
  const g = PZ_GENS[kind],
    dims = extra && extra.dims ? extra.dims : g.dims[tier];
  const lw = dims[0],
    lh = dims[1],
    W = site.rot & 1 ? lh : lw,
    H = site.rot & 1 ? lw : lh;
  const ent = {
    k: "puzzle",
    id,
    x: site.x0 + W / 2,
    z: site.z0 + H / 2,
    pz: Object.assign({ kind, tier, idx, rot: site.rot, x0: site.x0, z0: site.z0, lw, lh, W, H }, extra || {}),
  };
  map.ents.push(ent);
  // una luz propia: el acertijo se ve aunque la sala esté a oscuras (usa el grupo de luces cercanas del director del mundo)
  map.ents.push({ k: "light", id: id + "_l", x: ent.x, z: ent.z, c: 0xbfe6ff, model: "none" });
  return ent;
}
function pzPlace(map, n) {
  if (!map || !map.ents || !map.rooms || !n) return null;
  const sub = !!n.sub,
    sid = sub && n.ent && n.ent.id ? "sub:" + n.ent.id : null;
  if (sub && n.enc === "puzzle") return null; // la «cámara sellada» ya es un acertijo
  const theme = sub ? vE[n.ent.kind] || "sotano" : PZ_THEME_OP[n.theme] || "sotano",
    base = sid ? pzMix(sid, 0x50) : pzMix(n.seed | 0, 0x4f50),
    rc = pzRng(pzMix(base, 0x43)); // ¿hay acertijo aquí? (estable por escalera)
  if (rc() >= (sub ? PZ_CFG.chance : PZ_CFG.chanceOp)) return null;
  const lvl = n.lvl | 0 || 1,
    reg = De[n.reg] ? n.reg : 0,
    regKey = De[reg].key;
  let ch = pzChoose(base, theme, lvl),
    lore = null;
  // regiones con una pista de runas en el Archivo: el acertijo de runas lo dicta el documento (si el Archivo existe)
  if (x.loreApi && PZ_LORE_KEYS[regKey] && pzRng(pzMix(base, 0x4c))() < PZ_CFG.loreChance) {
    try {
      const h = x.loreApi.hintFor(PZ_LORE_KEYS[regKey]);
      if (h && h.seq && h.seq.length >= 3 && h.seq.length <= 5) {
        lore = { key: PZ_LORE_KEYS[regKey], len: h.seq.length };
        ch = { kind: "runes", tier: h.seq.length >= 5 ? 3 : 2, idx: pzMix(base, 0x4d) % PZ_CFG.pool };
      }
    } catch (err) {
      lore = null;
    }
  }
  const r = pzRng(pzMix(n.seed | 0, base, 0x53)); // sala y posición: dependen del mapa (que en las escaleras cambia en cada visita)
  const skip = new Set();
  if (sub) {
    if (map.encRoom) skip.add(map.encRoom);
    if (map.rooms[0]) skip.add(map.rooms[0]); // sala de entrada
  } else {
    if (map.rooms[0]) skip.add(map.rooms[0]);
    if (n.obj === "boss") for (const rm of map.rooms) if (rm.w >= 13 && rm.h >= 13 && map.ents.some((en) => en.k === "bossarena" && Math.abs(en.x - rm.cx) < 1 && Math.abs(en.z - rm.cz) < 1)) skip.add(rm);
  }
  // si no hay hueco para el tipo elegido, se prueba con los demás y con tamaños menores (tipo y nivel siguen siendo deterministas)
  const tries = [[ch.kind, ch.tier, ch.idx]];
  if (!lore) {
    // primero se encoge el mismo tipo (el tipo de una escalera no cambia aunque cambie su mapa); luego los demás, en un orden fijo por escalera
    for (let t = ch.tier - 1; t >= 1; t--) tries.push([ch.kind, t, ch.idx]);
    const others = pzRng(pzMix(base, 0x46)).shuffle(Object.keys(PZ_GENS).filter((q) => q !== ch.kind && !PZ_GENS[q].legacy && pzPlayable(PZ_GENS[q])));
    for (let t = ch.tier; t >= 1; t--) for (const k of others) tries.push([k, t, pzMix(base, k, t) % PZ_CFG.pool]);
  }
  for (const [kind, tier, idx] of tries) {
    const g = PZ_GENS[kind],
      dims = lore && kind === "runes" ? g.dims[tier] : g.dims[tier];
    if (!g || !dims) continue;
    const site = pzFindSite(map, map.rooms, skip, dims, r, null, true);
    if (!site) continue;
    pzClearSite(map, site, dims);
    const ent = pzAddEnt(map, "pz_" + (sub ? "s" : "o"), kind, tier, idx, site, { sid, theme, lvl, reg, lore });
    if (ent) {
      x.puzzleApi.last = ent;
      return ent;
    }
  }
  return null;
}
var PZ_RAW = { sub: _x, op: yx }; // las originales, para pruebas
(function () {
  const _sub = _x,
    _op = yx;
  _x = function (n) {
    const m = _sub.apply(this, arguments);
    try {
      pzPlace(m, n);
    } catch (err) {
      console.warn("[puzles] colocación", err);
    }
    return m;
  };
  yx = function (n) {
    const m = _op.apply(this, arguments);
    try {
      pzPlace(m, n);
    } catch (err) {
      console.warn("[puzles] colocación", err);
    }
    return m;
  };
})();

// ═══ 7. GRÁFICOS ════════════════════════════════════════════════════════════════════════════════════════
// Todos los puzles montados comparten 16 mallas instanciadas (8 formas × {mate, brillo}), con geometrías y materiales que viven toda la sesión:
// montar y desmontar solo cambia cuántas instancias se pintan (nada se crea ni se libera, así no hay fugas) y el coste es de ≤ 16 llamadas de
// dibujo por pantalla, nunca por baldosa. Los generadores dibujan con `g.box/cyl/sph/cone/oct/ring` en coordenadas de celda del puzle; aquí
// se transforman a coordenadas del mundo según la rotación con la que se colocó (PZG.T).
var PZ_KINDS = ["box", "cyl", "sph", "cone", "cone2", "oct", "ringH", "ringV"];
var PZ_CAP = { box: [1000, 600], cyl: [240, 140], sph: [100, 260], cone: [70, 70], cone2: [50, 50], oct: [50, 50], ringH: [70, 140], ringV: [24, 24] }; // [mate, brillo]
var PZR = { ready: false, b: {}, shown: false, drawn: 0 };
var pzM = new at(),
  pzQ = new Bn(),
  pzP = new U(),
  pzSc = new U(),
  pzCol = new Ee(),
  pzAxisY = new U(0, 1, 0),
  pzColCache = new Map();
// Color.setHex hace conversión de espacio de color con Math.pow en cada llamada: con ~200 instancias por fotograma se cachea el valor lineal por hex
function pzSetHex(c, hex) {
  let v = pzColCache.get(hex);
  if (!v) {
    c.setHex(hex);
    v = [c.r, c.g, c.b];
    pzColCache.set(hex, v);
  }
  c.r = v[0];
  c.g = v[1];
  c.b = v[2];
}
function pzGfxInit() {
  if (PZR.ready) return true;
  if (!x.R || !x.R.scene) return false;
  try {
    const rh = new Yi(1, 0.085, 6, 24);
    rh.rotateX(Math.PI / 2);
    const ci = new oo(1, 1, 12);
    ci.rotateX(Math.PI);
    const G = { box: new kn(1, 1, 1), cyl: new ni(1, 1, 1, 12), sph: new rr(1, 12, 8), cone: new oo(1, 1, 12), cone2: ci, oct: new _a(1, 0), ringH: rh, ringV: new Yi(1, 0.085, 6, 24) };
    const lit = new Xt({ color: 0xffffff, roughness: 0.55, metalness: 0.2, flatShading: true }),
      glow = new vt({ color: 0xffffff, toneMapped: false });
    for (const k of PZ_KINDS) {
      const a = new cs(x.R.scene, G[k], lit, PZ_CAP[k][0]),
        b = new cs(x.R.scene, G[k], glow, PZ_CAP[k][1]);
      a.mesh.name = "puzzle-" + k;
      b.mesh.name = "puzzle-" + k + "-glow";
      a.mesh.receiveShadow = true;
      a.mesh.visible = b.mesh.visible = false;
      PZR.b[k] = [a, b];
    }
    PZR.ready = true;
  } catch (err) {
    console.warn("[puzles] sin mallas instanciadas", err);
  }
  return PZR.ready;
}
var PZG = {
  T: null,
  _p(k, cx, cz, y, sx, sy, sz, col, gl, ry) {
    const T = this.T,
      B = PZR.b[k][gl > 0 ? 1 : 0];
    pzQ.setFromAxisAngle(pzAxisY, T.ang + (ry || 0));
    pzP.set(T.tx + T.m00 * cx + T.m01 * cz, y, T.tz + T.m10 * cx + T.m11 * cz);
    pzSc.set(sx, sy, sz);
    pzM.compose(pzP, pzQ, pzSc);
    pzSetHex(pzCol, col);
    gl > 0 && pzCol.multiplyScalar(0.55 + gl * 0.55); // el brillo se pinta por encima de 1 (HDR): alimenta el bloom
    B.push(pzM, pzCol);
  },
  box(cx, cz, y, sx, sy, sz, col, gl, ry) {
    this._p("box", cx, cz, y, sx, sy, sz, col, gl || 0, ry);
  },
  cyl(cx, cz, y, r, h, col, gl) {
    this._p("cyl", cx, cz, y, r, h, r, col, gl || 0, 0);
  },
  sph(cx, cz, y, r, col, gl) {
    this._p("sph", cx, cz, y, r, r, r, col, gl || 0, 0);
  },
  cone(cx, cz, y, r, h, col, gl, inv) {
    this._p(inv ? "cone2" : "cone", cx, cz, y, r, h, r, col, gl || 0, 0);
  },
  oct(cx, cz, y, r, col, gl) {
    this._p("oct", cx, cz, y, r, r, r, col, gl || 0, 0);
  },
  ring(cx, cz, y, r, col, gl, vertical) {
    this._p(vertical ? "ringV" : "ringH", cx, cz, y, r, r, r, col, gl || 0, vertical ? Math.PI / 4 : 0);
  },
};
// Pinta todos los puzles montados (una vez por fotograma de simulación)
function pzDrawAll(t) {
  if (!PZ.mounted.size) {
    if (PZR.shown) {
      for (const k of PZ_KINDS) PZR.b[k][0].mesh.visible = PZR.b[k][1].mesh.visible = false;
      PZR.shown = false;
    }
    return;
  }
  if (!pzGfxInit()) return;
  for (const k of PZ_KINDS) {
    PZR.b[k][0].begin();
    PZR.b[k][1].begin();
  }
  for (const rt of PZ.mounted) {
    const z = rt.pz;
    PZG.T = z.T;
    try {
      z.gen.draw(z.spec, z.st, PZG, t);
      // anillo de foco sobre el objeto que se usaría con USAR
      if (PZ.focus && PZ.focus.rt === rt) PZG.ring(PZ.focus.cx, PZ.focus.cz, 0.07, 0.62 + Math.sin(t * 7) * 0.04, 0xffe27a, 1.5);
      if (z.hintFocus) PZG.ring(z.hintFocus.cx, z.hintFocus.cz, 0.09, 0.78 + Math.sin(t * 9) * 0.06, 0x5dff9a, 2);
    } catch (err) {
      if (!z.drawErr) {
        z.drawErr = true;
        console.warn("[puzles] dibujo", z.d.kind, err);
      }
    }
  }
  let n = 0;
  for (const k of PZ_KINDS)
    for (let j = 0; j < 2; j++) {
      const b = PZR.b[k][j];
      b.end();
      b.mesh.visible = b.n > 0;
      n += b.n > 0 ? 1 : 0;
    }
  PZR.drawn = n;
  PZR.shown = true;
}

// ═══ 8. EJECUCIÓN ═══════════════════════════════════════════════════════════════════════════════════════
// Estado de ejecución: puzles montados (los que están a < 42 m: lo decide el director del mundo al crear/quitar «mallas» de sus entidades),
// el activo (el que tienes encima o al lado), el objeto que apuntarías con USAR y el HUD.
var PZ = { mounted: new Set(), active: null, pickId: -1, pickRt: null, pickText: "", focus: null, hud: null, lab: null, stats: { mounts: 0, unmounts: 0, solved: 0 } };
var PZ_FOCUS = { rt: null, cx: 0, cz: 0 };
var PZ_TOKEN = { userData: {}, isPuzzle: true }; // «malla» de mentira: el director solo necesita que exista y tenga userData
var PZ_CTX = {
  rt: null,
  px: 0,
  pz: 0,
  fx: 0,
  fz: 0,
  inside: false,
  cell: -1,
  snd(name, o) {
    ae.play(name, o);
  },
  toast(m, t) {
    // dentro de la tarjeta del acertijo (los avisos flotantes caen justo debajo de ella en pantallas bajas)
    const z = this.rt && this.rt.pz;
    if (z) z.msg = { text: m, type: t || "quest", t: 4.5 };
    else ee("toast", m, t || "quest");
  },
  hurt(f) {
    const p = x.player;
    if (!p || p.dead) return;
    // un fallo de acertijo duele pero nunca mata
    const d = Math.min(p.hp - 1, p.maxHp * f);
    if (d > 0.5) {
      p.hp -= d;
      p.hurtFlash = Math.min(1, (p.hurtFlash || 0) + 0.4);
      x.R.addShake(0.15);
      x.fx.text(p.x, 1.9, p.z, "-" + Math.round(d), "#ff6b6b", 13);
    }
  },
  teleport(lx, lz) {
    const z = this.rt && this.rt.pz,
      p = x.player;
    if (!z || !p) return;
    const T = z.T;
    p.x = T.tx + T.m00 * lx + T.m01 * lz;
    p.z = T.tz + T.m10 * lx + T.m11 * lz;
    p.vx = p.vz = 0;
    x.fx.burst(p.x, 0.8, p.z, 14, { color: 0xffd04a, speed: 3, life: 0.5, size: 0.2, up: 1 });
  },
  occupied(cx, cz) {
    return Math.floor(this.px) === cx && Math.floor(this.pz) === cz;
  },
};
function pzLevel(rt) {
  return rt.pz && rt.pz.d.lvl ? rt.pz.d.lvl : x.S.lvl;
}
// Variante «dictada por el Archivo» del puzle de runas: el orden sale de la pista del documento (x.loreApi.hintFor), el resto son señuelos
function pzLoreSpec(gen, d) {
  try {
    const h = x.loreApi && x.loreApi.hintFor(d.lore.key);
    if (!h || !h.seq || !gen.makeLore) return null;
    // los ocho glifos del Archivo coinciden, en orden, con las ocho runas del puzle (se comprueba por nombre)
    const gl = x.loreApi.vocab && x.loreApi.vocab.glyphs;
    if (gl && gl.some((n, i) => PZ_RUNES[i] && PZ_RUNES[i].n !== n)) return null;
    return gen.makeLore(d.idx, d.tier, h.seq.slice(), d.lore.key);
  } catch (err) {
    return null;
  }
}
function pzMount(rt) {
  const d = rt.e.pz,
    gen = PZ_GENS[d.kind];
  if (!gen || !pzPlayable(gen) || !x.map) return false;
  const keep = rt.pzKeep;
  let spec = keep ? keep.spec : d.lore ? pzLoreSpec(gen, d) : pzSpec(d.kind, d.idx, d.tier);
  if (!spec && d.lore) spec = pzSpec(d.kind, d.idx, d.tier); // sin Archivo: el puzle de runas con pistas de la inscripción
  if (!spec) return false;
  const st = keep ? keep.st : gen.init(spec);
  if (!keep) {
    rt.pzKeep = { spec, st };
    if ((d.sid && pzDoneRecently(d.sid)) || rt.pzDone) {
      rt.pzDone = true;
      gen.solve && gen.solve(spec, st);
    }
  }
  const z = (rt.pz = { d, gen, spec, st, T: pzTransform(d), map: x.map, blk: new Uint8Array(d.lw * d.lh), rev: -1, lx: -9, lz: -9, inside: false, near: false, drawErr: false });
  PZ.mounted.add(rt);
  PZ.stats.mounts++;
  pzApplyBlk(rt);
  z.rev = st.rev;
  return true;
}
function pzUnmount(rt) {
  const z = rt.pz;
  if (!z) return;
  if (x.map === z.map) {
    const w = z.map.w,
      T = z.T,
      d = z.d;
    for (let cz = 0; cz < d.lh; cz++)
      for (let cx = 0; cx < d.lw; cx++)
        if (z.blk[cz * d.lw + cx]) z.map.blk[Math.floor(T.tz + T.m10 * (cx + 0.5) + T.m11 * (cz + 0.5)) * w + Math.floor(T.tx + T.m00 * (cx + 0.5) + T.m01 * (cz + 0.5))] = 0;
  }
  PZ.mounted.delete(rt);
  PZ.stats.unmounts++;
  PZ.mounted.size || pzDrawAll(x.time); // el último puzle se va: las mallas compartidas se ocultan ya, no al siguiente fotograma
  if (PZ.active === rt) {
    PZ.active = null;
    PZ.pickId = -1;
    PZ.pickRt = null;
    PZ.focus = null;
  }
  rt.pz = null;
}
// Las celdas sólidas del puzle (cajas, espejos, muros…) bloquean al jugador y a los enemigos: se reflejan en map.blk
function pzApplyBlk(rt) {
  const z = rt.pz,
    map = z.map,
    d = z.d,
    T = z.T,
    w = map.w;
  for (let cz = 0; cz < d.lh; cz++)
    for (let cx = 0; cx < d.lw; cx++) {
      const v = z.gen.solid(z.spec, z.st, cx, cz) ? 1 : 0,
        k = cz * d.lw + cx;
      if (z.blk[k] === v) continue;
      z.blk[k] = v;
      map.blk[Math.floor(T.tz + T.m10 * (cx + 0.5) + T.m11 * (cz + 0.5)) * w + Math.floor(T.tx + T.m00 * (cx + 0.5) + T.m01 * (cz + 0.5))] = v;
    }
  z.rev = z.st.rev;
  // si algo sólido aparece bajo los pies del jugador, se le saca (no debería: las acciones lo evitan)
  const p = x.player;
  if (p && map.circleHits(p.x, p.z, p.r * 0.6)) {
    const [fx, fz] = map.findFree(p.x, p.z, 3, p.r);
    p.x = fx;
    p.z = fz;
  }
}
function pzToLocal(z, wx, wz, out) {
  const T = z.T,
    dx = wx - T.tx,
    dz = wz - T.tz;
  out.x = T.m00 * dx + T.m10 * dz;
  out.z = T.m01 * dx + T.m11 * dz;
  return out;
}
var pzTmp = { x: 0, z: 0 };
function pzTick(dt) {
  const p = x.player;
  if (!PZ.mounted.size || !p) {
    PZ.active = null;
    PZ.pickId = -1;
    PZ.pickRt = null;
    PZ.focus = null;
    pzHud(null);
    pzDrawAll(x.time);
    return;
  }
  let best = null,
    bd = 1e9;
  for (const rt of PZ.mounted) {
    const z = rt.pz,
      d = z.d;
    pzToLocal(z, p.x, p.z, pzTmp);
    z.lx = pzTmp.x;
    z.lz = pzTmp.z;
    z.inside = z.lx >= 0 && z.lz >= 0 && z.lx < d.lw && z.lz < d.lh;
    // distancia del jugador al rectángulo (0 si está dentro)
    const dx = Math.max(0, -z.lx, z.lx - d.lw),
      dz = Math.max(0, -z.lz, z.lz - d.lh),
      dist = Math.hypot(dx, dz);
    z.near = dist < PZ_CFG.nearM;
    if (z.near && dist < bd) {
      bd = dist;
      best = rt;
    }
    // el tiempo de cada puzle corre (placas, láseres…) mientras está montado; el jugador solo cuenta si no está muerto
    PZ_CTX.rt = rt;
    PZ_CTX.px = z.lx;
    PZ_CTX.pz = z.lz;
    PZ_CTX.inside = z.inside && !p.dead && !rt.pzDone;
    PZ_CTX.cell = z.inside ? Math.floor(z.lz) * d.lw + Math.floor(z.lx) : -1;
    if (!rt.pzDone && z.gen.step) {
      try {
        z.gen.step(z.spec, z.st, dt, PZ_CTX);
      } catch (err) {
        console.warn("[puzles] step", d.kind, err);
      }
    }
    if (z.st.rev !== z.rev) pzApplyBlk(rt);
    if (!rt.pzDone && z.gen.solved(z.spec, z.st)) pzSolve(rt, "play");
    if (z.hintFocus && (z.hintFocus.t -= dt) <= 0) z.hintFocus = null;
    if (z.msg && (z.msg.t -= dt) <= 0) z.msg = null;
    if (z.introT > 0) z.introT -= dt;
  }
  if (PZ.active !== best) {
    PZ.active = best;
    best && !best.pzIntro && pzIntro(best);
  }
  // objeto al que apuntaría USAR
  PZ.pickId = -1;
  PZ.pickRt = null;
  PZ.focus = null;
  const rt = PZ.active;
  if (rt && !rt.pzDone && !p.dead) {
    const z = rt.pz,
      T = z.T;
    // hacia dónde mira el jugador, en coordenadas del puzle
    const sx = Math.sin(p.face),
      sz = Math.cos(p.face);
    PZ_CTX.fx = T.m00 * sx + T.m10 * sz;
    PZ_CTX.fz = T.m01 * sx + T.m11 * sz;
    const id = z.gen.pick ? z.gen.pick(z.spec, z.st, z.lx, z.lz, PZ_CTX.fx, PZ_CTX.fz) : -1;
    if (id >= 0) {
      // texto y foco solo se recalculan si cambia el objeto o el estado del puzle (nada de cadenas ni arrays nuevos por fotograma)
      if (z.pid !== id || z.prev !== z.st.rev) {
        z.pid = id;
        z.prev = z.st.rev;
        z.ptext = z.gen.label(z.spec, z.st, id);
        const f = z.gen.focus ? z.gen.focus(z.spec, z.st, id) : null;
        z.pfx = f ? f[0] + 0.5 : -1;
        z.pfz = f ? f[1] + 0.5 : -1;
      }
      PZ.pickId = id;
      PZ.pickRt = rt;
      PZ.pickText = z.ptext;
      if (z.pfx >= 0) {
        PZ_FOCUS.rt = rt;
        PZ_FOCUS.cx = z.pfx;
        PZ_FOCUS.cz = z.pfz;
        PZ.focus = PZ_FOCUS;
      }
    } else z.pid = -2;
    // atajos de teclado (en táctil están los botones del panel)
    if (Tt.hit("pzUndo")) pzAction(rt, "undo");
    if (Tt.hit("pzReset")) pzAction(rt, "reset");
    if (Tt.hit("pzHint")) pzAction(rt, "hint");
  }
  pzHud(PZ.active);
  pzDrawAll(x.time);
}
x.tick.push(pzTick);
// Teclas de acertijo (solo hacen algo cuando hay uno activo; U, Y y N estaban libres)
yw.KeyU = "pzUndo";
yw.KeyY = "pzReset";
yw.KeyN = "pzHint";
// Introducción (una vez por montaje): qué es y cómo se maneja, según el dispositivo
function pzIntro(rt) {
  rt.pzIntro = true;
  if (!rt.pzDone) rt.pz.introT = 9; // la tarjeta enseña la descripción unos segundos (en móvil apaisado va oculta el resto del tiempo)
}
function pzMsg(rt, text, type) {
  rt.pz.msg = { text, type: type || "quest", t: 4.5 };
}
// Acciones del panel: reiniciar · deshacer · pista · hackear
function pzAction(rt, what) {
  const z = rt && rt.pz;
  if (!z || rt.pzDone) return;
  PZ_CTX.rt = rt;
  PZ_CTX.px = z.lx;
  PZ_CTX.pz = z.lz;
  PZ_CTX.cell = z.inside ? Math.floor(z.lz) * z.d.lw + Math.floor(z.lx) : -1;
  const g = z.gen,
    st = z.st;
  if (what === "reset" && g.reset) {
    g.reset(z.spec, st, PZ_CTX);
    st.resets = (st.resets | 0) + 1;
    ae.play("close");
    pzMsg(rt, "Acertijo reiniciado");
  } else if (what === "undo" && g.undo) {
    if (g.undo(z.spec, st)) ae.play("close");
    else pzMsg(rt, "No hay nada que deshacer", "warn");
  } else if (what === "hint" && g.hint) {
    const h = g.hint(z.spec, st, PZ_CTX);
    if (h) {
      st.hints++;
      z.hinted = true;
      pzMsg(rt, h.text);
      if (h.id !== undefined && g.focus) {
        const f = g.focus(z.spec, st, h.id);
        f && (z.hintFocus = { cx: f[0] + 0.5, cz: f[1] + 0.5, t: 4 });
      }
      ae.play("beep", { p: 1.4 });
      z.gen.hintLore && z.gen.hintLore(z.spec, st);
    } else pzMsg(rt, "No hay pista que dar ahora", "warn");
  } else if (what === "hack") pzHack(rt);
  else return;
  if (st.rev !== z.rev) pzApplyBlk(rt);
}
// Atajo electrónico: un hackeo de una capa abre el panel (arriesgado: la traza puede dar la alarma). Sin premio de «perfecto».
function pzHack(rt) {
  const z = rt.pz;
  if (!x.hackApi || !x.hackApi.run || !z.gen.hackable) return;
  try {
    const s = x.hackApi.run(
      { title: "Panel del acertijo", sub: z.gen.n, objetivo: "personalizado", diff: Math.min(4, z.d.tier + 1), layers: 1, noPre: true, risk: 1, loot: false, at: { x: rt.e.x, z: rt.e.z }, seed: 1 + z.d.idx },
      (res) => {
        if (!rt.pz || rt.pzDone) return;
        if (res && res.ok) pzSolve(rt, "hack");
        else pzMsg(rt, "El panel sigue bloqueado. Puedes resolverlo a mano.", "warn");
      },
    );
    if (!s) pzMsg(rt, "No se puede hackear ahora mismo", "warn");
  } catch (err) {
    console.warn("[puzles] hackeo", err);
  }
}
// USAR sobre el objeto apuntado
function pzInteract(rt) {
  const z = rt && rt.pz;
  if (!z || rt.pzDone || PZ.pickRt !== rt || PZ.pickId < 0) return;
  PZ_CTX.rt = rt;
  PZ_CTX.px = z.lx;
  PZ_CTX.pz = z.lz;
  try {
    z.gen.act(z.spec, z.st, PZ.pickId, PZ_CTX);
  } catch (err) {
    console.warn("[puzles] act", z.d.kind, err);
  }
  if (z.st.rev !== z.rev) pzApplyBlk(rt);
  if (!rt.pzDone && z.gen.solved(z.spec, z.st)) pzSolve(rt, "play");
}
// ── Premio ──
function pzTierStars(t) {
  return "★".repeat(t) + "☆".repeat(3 - t);
}
function pzTierHtml(t) {
  return `<span aria-label="Nivel ${t} de 3">${"★".repeat(t)}<span style="opacity:.28">${"★".repeat(3 - t)}</span></span>`;
}
function pzPar(z) {
  // movimientos de referencia: lo que tarda el bot (solo en los que el nº de acciones es significativo)
  if (!z.gen.par) return null;
  try {
    return z.gen.par(z.spec);
  } catch (err) {
    return null;
  }
}
function pzSolve(rt, how) {
  const z = rt.pz;
  if (!z || rt.pzDone) return;
  rt.pzDone = true;
  z.st.done = true;
  const S = pzS(),
    d = z.d,
    st = z.st,
    lvl = d.lvl || S.lvl,
    hack = how === "hack",
    par = pzPar(z),
    perfect = !hack && !z.hinted && st.errors === 0 && (par == null || st.moves <= Math.ceil(par * PZ_CFG.parSlack) + 2);
  const p = { id: d.sid || rt.e.id, kind: d.kind, tier: d.tier, perfect, errors: st.errors | 0, moves: st.moves | 0, hints: st.hints | 0, resets: st.resets | 0, time: Math.round(st.t * 10) / 10, how, lvl, reg: d.reg | 0, x: rt.e.x, z: rt.e.z, legacy: false };
  const T = S.puzzleStats;
  T.n++;
  perfect && T.perfect++;
  T.hints += p.hints;
  T.errors += p.errors;
  hack && T.hack++;
  T.byKind[d.kind] = (T.byKind[d.kind] | 0) + 1;
  if (d.sid) S.puzzles[d.sid] = { t: Date.now(), k: d.kind, tier: d.tier, p: perfect ? 1 : 0 };
  PZ.stats.solved++;
  // efectos
  const [px, pzz] = x.map.findFree(rt.e.x, rt.e.z, 4, 0.5);
  ae.play("success");
  ae.play("legend", { v: 0.35 });
  x.fx.ring(px, pzz, 3.2, 0x9ad8ff, 0.7);
  x.fx.burst(px, 1.1, pzz, 36, { color: 0x9ad8ff, speed: 4.5, life: 0.9, size: 0.28, up: 1.2 });
  x.R.addShake(0.2);
  ee("banner", "ACERTIJO RESUELTO", `${z.gen.n} · nivel ${["I", "II", "III"][d.tier - 1]}${perfect ? " · PERFECTO" : ""}`, perfect ? "#ffd447" : "#9ad8ff");
  // botín por tier con el sistema de ECONOMÍA (cofre de nivel d.tier) + extras
  const R = PZ_CFG.reward;
  const n0 = x.pickups.length;
  try {
    Co(px, pzz + 0.4, d.tier, lvl, { src: "chest" + d.tier });
    if (perfect) Co(px, pzz - 0.4, 1, lvl, { src: "chest1" }); // bonus por resolverlo limpio
  } catch (err) {
    console.warn("[puzles] botín", err);
  }
  p.drops = x.pickups.length - n0;
  const xpf = (R.xp[d.tier] + (perfect ? R.perfectXp : 0)) * (hack ? R.hackMul : 1);
  if (typeof ecoGrantXp === "function") ecoGrantXp(xpf, "acertijo");
  else if (x.player && mt.xpToNext) x.player.addXp(xpf * mt.xpToNext(S.lvl));
  const cr = Math.round(R.credits[d.tier] * mt.credits(lvl) * (perfect ? 1 + R.perfectCredits : 1) * (1 + (x.player.st.credits || 0)));
  S.credits += cr;
  x.fx.text(px, 2.2, pzz, "+" + cr + " ¤", "#ffd447", 13, { life: 1.4 });
  // el Archivo: a veces el acertijo esconde un documento de la región
  if (x.loreApi && !hack && pzRng(pzMix(d.idx, st.moves, 0x4c4f))() < R.lore[d.tier]) {
    try {
      const id = x.loreApi.next(d.tier >= 3 ? "chip" : "libro", d.reg) || x.loreApi.next(null, d.reg);
      if (id && x.loreApi.grant(id, { quiet: true, src: "puzzle" })) ee("toast", "El mecanismo guardaba un documento: " + ((x.loreApi.get(id) || {}).t || "Archivo"), "quest");
    } catch (err) {
      /* sin Archivo: nada */
    }
  }
  ee("puzzleSolved", p);
  ee("save");
  return p;
}
// La cámara sellada clásica (switch / sequence, 22-quests) también cuenta como acertijo resuelto
function pzLegacySolved(st) {
  const S = pzS(),
    sid = "leg:" + (st.op && st.op.ent ? st.op.ent.id : "op"),
    tier = pzTierOf(st.lvl | 0);
  S.puzzles[sid] = { t: Date.now(), k: st.mode, tier, p: 0 };
  S.puzzleStats.n++;
  S.puzzleStats.byKind[st.mode] = (S.puzzleStats.byKind[st.mode] | 0) + 1;
  ee("puzzleSolved", { id: sid, kind: st.mode, tier, perfect: false, errors: 0, moves: st.presses | 0, hints: 0, how: "play", lvl: st.lvl, reg: st.op ? st.op.reg | 0 : 0, legacy: true });
}
(function () {
  const _fin = Ni.finish;
  Ni.finish = function (ok) {
    const st = this.st,
      was = !!(st && !st.done && !st.failed && st.enc === "puzzle");
    const r = _fin.apply(this, arguments);
    if (ok && was && st.done)
      try {
        pzLegacySolved(st);
      } catch (err) {
        console.warn("[puzles] cámara sellada", err);
      }
    return r;
  };
})();

// ═══ 9. HUD, ETIQUETAS Y ENGANCHES ══════════════════════════════════════════════════════════════════════
// Tarjeta no modal con lo que hace falta mientras se está en el acertijo: nombre, estado, inscripción y botones (≥ 44 px, sin teclas fijas en táctil).
function pzCss() {
  if (document.getElementById("pzCss")) return;
  const st = document.createElement("style");
  st.id = "pzCss";
  st.textContent = `
#pzHud{position:fixed;left:calc(354px + (100vw - 354px - 196px) / 2);top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);width:min(400px,calc(100vw - 354px - 196px));z-index:21;display:none;pointer-events:none;font-family:var(--f-disp,sans-serif);color:#dfe9ee}
#pzHud .pzcard{background:linear-gradient(180deg,rgba(10,14,16,.9),rgba(10,14,16,.74));border:1px solid var(--line2,#2a3a40);border-left:3px solid #9ad8ff;padding:7px 10px 8px;backdrop-filter:blur(3px)}
#pzHud .pzh{display:flex;align-items:center;gap:8px;font:700 14px var(--f-disp,sans-serif);letter-spacing:.04em}
#pzHud .pzh i{font-style:normal;font-size:18px;color:#9ad8ff}
#pzHud .pzh em{margin-left:auto;font-style:normal;color:#ffd447;font-size:13px;letter-spacing:.1em}
#pzHud .pzd{font-size:12px;color:#9fb1b8;margin:2px 0 4px;line-height:1.25}
#pzHud .pzm{margin:2px 0 3px;padding:3px 6px;font:600 12.5px var(--f-disp,sans-serif);background:rgba(154,216,255,.14);border-left:2px solid #9ad8ff;color:#e8f6ff}
#pzHud .pzm.bad{background:rgba(255,80,80,.16);border-left-color:#ff5a5a;color:#ffd7d7}#pzHud .pzm.warn{background:rgba(255,207,64,.14);border-left-color:#ffcf40}
#pzHud .pzs{font:600 13px var(--f-disp,sans-serif);color:#e8f4f8;line-height:1.35}
#pzHud .pzc{margin:5px 0 0;padding:5px 0 0 16px;border-top:1px solid rgba(255,255,255,.1);font-size:12.5px;line-height:1.3;color:#d6e6ec}
#pzHud .pzc li{margin:1px 0}
#pzHud .pzk{font-size:11px;color:#7f939b;margin-top:4px}
#pzHud .pzb{display:flex;gap:6px;margin-top:6px;pointer-events:auto}
#pzHud .pzb button{flex:1;min-height:44px;min-width:44px;padding:4px 6px;background:#16262c;color:#dff3fb;border:1px solid #3a5560;font:700 13px var(--f-disp,sans-serif);touch-action:manipulation;cursor:pointer}
#pzHud .pzb button:active{background:#244a58}
#pzHud .pzb button.hk{color:#9affc8;border-color:#3f7a5c}
#pzHud.done .pzcard{border-left-color:#5fd35a}
#pzLab{position:fixed;inset:0;pointer-events:none;z-index:19;overflow:hidden}
#pzLab b{position:absolute;left:0;top:0;font:700 11px var(--f-disp,sans-serif);padding:1px 5px;background:rgba(8,12,14,.78);border:1px solid currentColor;white-space:nowrap;will-change:transform}
body.touch #pzHud .pzb button .ic{font-size:17px}
body.touch #pzHud .pzd{display:none}body.touch #pzHud .pzcard.intro .pzd{display:block}
body.touch #pzHud .pzcard{position:relative;min-height:54px}
body.touch #pzHud .pzh{padding-right:150px}body.touch #pzHud .pzh em{display:none}
body.touch #pzHud .pzb{position:absolute;top:5px;right:6px;margin:0;gap:4px}
body.touch #pzHud .pzb button{flex:none;width:46px;padding:0}body.touch #pzHud .pzb .l{display:none}
body.touch #pzHud .pzs,body.touch #pzHud .pzm,body.touch #pzHud .pzd,body.touch #pzHud .pzc{margin-right:150px}
@media (max-width:960px) and (orientation:landscape){#pzHud .pzd{display:none}#pzHud .pzcard.intro .pzd{display:block}#pzHud .pzcard{padding:5px 8px 6px}#pzHud .pzb{margin-top:4px}}
@media (orientation:landscape) and (max-height:520px){
body.touch #pzHud{left:calc(min(230px,30vw) + 22px + env(safe-area-inset-left));top:calc(48px + env(safe-area-inset-top));transform:none;width:min(380px,calc(100vw - min(230px,30vw) - 22px - 104px))}
}
@media (max-width:760px) and (orientation:landscape) and (min-height:521px){#pzHud{left:50%;top:auto;bottom:calc(86px + env(safe-area-inset-bottom));width:min(430px,calc(100vw - 24px))}}
@media (orientation:portrait){#pzHud{left:50%;top:auto;bottom:calc(250px + env(safe-area-inset-bottom));width:min(400px,calc(100vw - 20px))}body.touch #pzHud .pzb{top:auto;bottom:5px}}
`;
  document.head.appendChild(st);
}
function pzEsc(s) {
  return typeof ke === "function" ? ke(String(s)) : String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}
function pzHudBuild() {
  if (PZ.hud) return PZ.hud;
  pzCss();
  const el = document.createElement("div");
  el.id = "pzHud";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  document.body.appendChild(el);
  el.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("button[data-pz]");
    if (!b || !PZ.active) return;
    ev.preventDefault();
    pzAction(PZ.active, b.dataset.pz);
  });
  el.addEventListener("touchstart", (ev) => ev.stopPropagation(), { passive: true });
  const lab = document.createElement("div");
  lab.id = "pzLab";
  document.body.appendChild(lab);
  PZ.hud = el;
  PZ.lab = lab;
  return el;
}
function pzHud(rt) {
  if (!rt && !PZ.hud) return;
  const el = pzHudBuild();
  if (!rt || x.uiOpen || !x.started) {
    if (el._v) {
      el.style.display = "none";
      el._v = false;
    }
    pzLabels(null);
    return;
  }
  const z = rt.pz,
    g = z.gen,
    st = z.st,
    touch = Tt.touchMode;
  // La estructura (botones) solo se rebuelve cuando cambia de verdad: reconstruir el DOM entre el toque y el soltar perdería el clic.
  const hk = !!x.hackApi;
  if (el._rt !== rt || el._done !== !!rt.pzDone || el._touch !== touch || el._hk !== hk) {
    el._rt = rt;
    el._done = !!rt.pzDone;
    el._touch = touch;
    el._hk = hk;
    let h = "";
    if (rt.pzDone) {
      h = `<div class="pzcard"><div class="pzh"><i>${g.icon || "◈"}</i><b>${pzEsc(g.n)}</b><em>✔ Resuelto</em></div></div>`;
      el.className = "done";
    } else {
      h = `<div class="pzcard"><div class="pzh"><i>${g.icon || "◈"}</i><b>${pzEsc(g.n)}</b><em>${pzTierHtml(z.d.tier)}</em></div>`;
      h += `<div class="pzd">${pzEsc(g.d)}</div><div class="pzm"></div><div class="pzs"></div><ol class="pzc"></ol><div class="pzb">`;
      if (g.reset) h += `<button type="button" data-pz="reset" aria-label="Reiniciar el acertijo"><span class="ic">↺</span><span class="l"> Reiniciar</span></button>`;
      if (g.undo) h += `<button type="button" data-pz="undo" aria-label="Deshacer el último movimiento"><span class="ic">↶</span><span class="l"> Deshacer</span></button>`;
      if (g.hint) h += `<button type="button" data-pz="hint" aria-label="Pedir una pista"><span class="ic">?</span><span class="l"> Pista</span></button>`;
      if (g.hackable && x.hackApi) h += `<button type="button" class="hk" data-pz="hack" aria-label="Hackear el panel"><span class="ic">⌁</span><span class="l"> Hackear</span></button>`;
      h += `</div>`;
      if (!touch) h += `<div class="pzk">E usar · U deshacer · Y reiniciar · N pista</div>`;
      h += `</div>`;
      el.className = "";
    }
    el.innerHTML = h;
    el._cr = -1;
  }
  if (!rt.pzDone) {
    // el contenido (estado e inscripción) se actualiza en su sitio, solo si cambia
    const tick = g.animated ? Math.floor(x.time * 4) : 0,
      msg = z.msg ? z.msg.text : "",
      intro = z.introT > 0;
    if (el._cr !== st.rev || el._ce !== st.errors || el._ch !== st.hints || el._ct !== tick || el._cm !== msg || el._ci !== intro) {
      el._cr = st.rev;
      el._ce = st.errors;
      el._ch = st.hints;
      el._ct = tick;
      el._cm = msg;
      el._ci = intro;
      const lines = g.status ? g.status(z.spec, st) : [],
        clues = g.clueLines ? g.clueLines(z.spec, st) : null,
        sEl = el.querySelector(".pzs"),
        cEl = el.querySelector(".pzc");
      const card = el.firstChild,
        mEl = el.querySelector(".pzm");
      card && card.classList.toggle("intro", z.introT > 0);
      if (mEl) {
        mEl.textContent = z.msg ? z.msg.text : "";
        mEl.className = "pzm" + (z.msg ? " " + z.msg.type : "");
        mEl.style.display = z.msg ? "" : "none";
      }
      const sh = lines.map(pzEsc).join("<br>");
      if (sEl && sEl._h !== sh) ((sEl._h = sh), (sEl.innerHTML = sh));
      const ch = clues && clues.length ? clues.map((c) => `<li>${pzEsc(c)}</li>`).join("") : "";
      if (cEl && cEl._h !== ch) {
        cEl._h = ch;
        cEl.innerHTML = ch;
        cEl.style.display = ch ? "" : "none";
      }
    }
  }
  if (!el._v) {
    el.style.display = "block";
    el._v = true;
  }
  pzLabels(rt);
}
// Etiquetas flotantes (glifo + nombre de cada runa): texto del DOM, sin mallas ni texturas
function pzLabels(rt) {
  const lab = PZ.lab;
  if (!lab) return;
  const z = rt && rt.pz,
    g = z && z.gen,
    list = g && g.glyphs && !rt.pzDone ? g.glyphs(z.spec, z.st) : null;
  if (!list) {
    if (lab._n) {
      lab.textContent = "";
      lab._n = 0;
    }
    return;
  }
  if (lab._n !== list.length || lab._rt !== rt) {
    lab._rt = rt;
    lab._n = list.length;
    lab.textContent = "";
    for (const q of list) {
      const b = document.createElement("b");
      b.textContent = q.t + " " + (q.n || "");
      b.style.color = "#" + q.col.toString(16).padStart(6, "0");
      b._k = q.k;
      lab.appendChild(b);
    }
  }
  const T = z.T;
  for (let i = 0; i < list.length; i++) {
    const q = list[i],
      b = lab.children[i];
    if (q.k !== b._k) {
      // etiqueta dinámica (la cerradura): el texto cambia con su versión k
      b._k = q.k;
      b.textContent = q.t + " " + (q.n || "");
      b.style.color = "#" + q.col.toString(16).padStart(6, "0");
    }
    x.R.project(T.tx + T.m00 * q.cx + T.m01 * q.cz, q.y, T.tz + T.m10 * q.cx + T.m11 * q.cz, pzScr);
    const sx = pzScr.vis ? Math.round(pzScr.x) : -999,
      sy = pzScr.vis ? Math.round(pzScr.y) : -999;
    if (b._x !== sx || b._y !== sy) {
      b._x = sx;
      b._y = sy;
      b.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)`;
    }
  }
}
var pzScr = { x: 0, y: 0, vis: false };
if (typeof document !== "undefined") {
  const initHud = () => {
    try {
      pzHudBuild();
    } catch (err) {
      /* el DOM aún no está: se crea al primer uso */
    }
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initHud) : initHud();
}

// Marca en el minimapa los acertijos sin resolver a menos de 60 m (se encadena tras la de LORE y la de ECONOMÍA)
if (typeof ecoMinimapPings === "function") {
  const _emp = ecoMinimapPings;
  ecoMinimapPings = function (c, size, s) {
    _emp(c, size, s);
    if (!x.world || !x.player) return;
    const p = x.player,
      ph = (x.time * 0.8) % 1;
    for (const r of x.world.rt.values()) {
      const o = r.e;
      if (o.k !== "puzzle" || r.pzDone || (o.pz.sid && pzDoneRecently(o.pz.sid)) || Math.hypot(o.x - p.x, o.z - p.z) > 60) continue;
      c.save();
      c.strokeStyle = c.fillStyle = "#9ad8ff";
      c.lineWidth = 1 / s;
      c.globalAlpha = 1 - ph;
      c.strokeRect(o.x - 1.4 - ph * 3, o.z - 1.4 - ph * 3, 2.8 + ph * 6, 2.8 + ph * 6);
      c.globalAlpha = 1;
      c.fillRect(o.x - 1.4, o.z - 1.4, 2.8, 2.8);
      c.restore();
    }
  };
}
// ── Enganches en el director del mundo (26-spawner): por envoltorio de métodos, sin tocar el fichero ──
(function () {
  const P = ih.prototype;
  const _create = P.createMesh,
    _remove = P.removeMesh,
    _prompt = P.updatePrompt,
    _interact = P.interact;
  P.createMesh = function (r) {
    if (r.e.k === "puzzle") {
      // el puzle se monta cuando su entidad entra en el radio de creación de mallas y se desmonta al salir
      if (pzMount(r)) r.mesh = PZ_TOKEN;
      return;
    }
    return _create.apply(this, arguments);
  };
  P.removeMesh = function (r) {
    if (r && r.e && r.e.k === "puzzle") {
      pzUnmount(r);
      r.mesh = null;
      return;
    }
    return _remove.apply(this, arguments);
  };
  P.updatePrompt = function () {
    const r = _prompt.apply(this, arguments);
    // el objeto de acertijo que apuntas pasa por delante de cualquier otro aviso
    if (PZ.pickRt && PZ.pickRt.pz && PZ.pickId >= 0 && !x.uiOpen) x.prompt = { r: PZ.pickRt, text: PZ.pickText };
    return r;
  };
  P.interact = function () {
    const p = x.prompt;
    if (p && p.r && p.r.e && p.r.e.k === "puzzle") return pzInteract(p.r);
    return _interact.apply(this, arguments);
  };
})();

// ═══ 10. PRUEBAS Y API EN EJECUCIÓN ════════════════════════════════════════════════════════════════════
// Pone un puzle junto al jugador (para escenarios y simulaciones; también funciona en el mundo abierto) y lo monta.
function pzSpawn(kind, tier, idx, o) {
  o = o || {};
  const g = PZ_GENS[kind],
    map = x.map,
    p = x.player;
  if (!g || !pzPlayable(g) || !map || !p) return null;
  tier = tier || 1;
  const dims = g.dims[tier];
  if (!dims) return null;
  const R = o.radius || 14,
    room = { x0: Math.max(1, Math.floor(p.x - R)), z0: Math.max(1, Math.floor(p.z - R)), x1: Math.min(map.w - 2, Math.floor(p.x + R)), z1: Math.min(map.h - 2, Math.floor(p.z + R)), tiles: null };
  room.w = room.x1 - room.x0 + 1;
  room.h = room.z1 - room.z0 + 1;
  const site = pzFindSite(map, [room], null, dims, pzRng(pzMix(idx | 0, tier, o.rot === undefined ? 0x5350 : o.rot)), { x: p.x + (o.dx || 0), z: p.z + (o.dz || 0), r: R });
  if (!site) return null;
  if (o.rot !== undefined) site.rot = o.rot & 3;
  const id = o.id || "pz_t" + (pzSpawn.n = (pzSpawn.n | 0) + 1);
  const ent = pzAddEnt(map, id, kind, tier, idx | 0, site, { sid: o.sid || null, theme: "sotano", lvl: o.lvl || x.S.lvl, reg: o.reg | 0, lore: o.lore || null });
  x.world.check(true);
  return x.world.rt.get(id) || null;
}
function pzRemove(id) {
  const w = x.world,
    rt = w.rt.get(id),
    map = x.map;
  if (rt) {
    w.removeMesh(rt);
    w.rt.delete(id);
  }
  for (const k of [id, id + "_l"]) {
    const i = map.ents.findIndex((e) => e.id === k);
    i >= 0 && map.ents.splice(i, 1);
  }
}
// Dónde plantarse para usar un objeto (para que el bot de pruebas no se meta dentro de una caja): se prueban posiciones sueltas (cada 0,25 m)
// alrededor, que quepan según el mapa real, desde las que el aviso apuntaría al objeto pedido mirándolo; gana la más cercana a él.
function pzStandAt(z, a, id) {
  const g = z.gen,
    d = z.d,
    p = x.player;
  const f = g.focus ? g.focus(z.spec, z.st, id) : null,
    tx = f ? f[0] + 0.5 : a.at[0],
    tz = f ? f[1] + 0.5 : a.at[1];
  let best = null,
    bd = 1e9;
  for (let sz = tz - 2; sz <= tz + 2; sz += 0.25)
    for (let sx = tx - 2; sx <= tx + 2; sx += 0.25) {
      if (sx < -1 || sz < -1 || sx > d.lw + 1 || sz > d.lh + 1) continue;
      const [wx, wz] = pzLocalToWorld(z, sx, sz);
      if (x.map.circleHits(wx, wz, p.r)) continue;
      const l = Math.hypot(tx - sx, tz - sz) || 1,
        fc = a.face || [(tx - sx) / l, (tz - sz) / l];
      if (g.pick(z.spec, z.st, sx, sz, fc[0], fc[1]) !== id) continue;
      const dd = Math.hypot(tx - sx, tz - sz);
      if (dd < bd) ((bd = dd), (best = { at: [sx, sz], face: fc }));
    }
  return best || { at: a.at, face: a.face || null };
}
function pzLocalToWorld(z, lx, lz) {
  const T = z.T;
  return [T.tx + T.m00 * lx + T.m01 * lz, T.tz + T.m10 * lx + T.m11 * lz];
}
// Resuelve un puzle montado como lo haría el jugador: se coloca, mira, ve el aviso y pulsa USAR (o espera, o cruza), con el bucle real
function pzBotLive(rt, o) {
  o = o || {};
  const z = rt.pz,
    g = z.gen,
    p = x.player,
    DT = 1 / 30,
    S = x.S,
    aim0 = S.settings.aim;
  const stepN = (n) => window.__step(n, DT);
  S.settings.aim = "auto"; // con el ratón, la mirada la manda el puntero y el bot no la controla
  // sin arma no hay objetivo automático: un enemigo cercano (del mundo o del subterráneo) no le giraría la mirada a mitad de un movimiento
  const ws0 = p.ws;
  p.ws = [null, null];
  const put = (lx, lz) => {
    const [wx, wz] = pzLocalToWorld(z, lx, lz);
    p.x = wx;
    p.z = wz;
    p.vx = p.vz = 0;
  };
  const faceTo = (fl) => {
    // fl = vector de mirada en coordenadas del puzle → ángulo del mundo
    const [fx, fz] = pzLocalToWorld(z, 0, 0),
      [gx, gz] = pzLocalToWorld(z, fl[0], fl[1]);
    p.face = Math.atan2(gx - fx, gz - fz);
  };
  p.inv = 9999; // el bot no muere por el camino
  p.hp = p.maxHp;
  let acted = 0,
    fail = "";
  const plan = g.bot(z.spec, z.st, undefined, undefined);
  if (!plan) {
    S.settings.aim = aim0;
    p.ws = ws0;
    return { ok: false, why: "sin plan" };
  }
  if (g.botMode === "phase") {
    // pasillo láser: se avanza una celda por fase real del reloj del puzle; el jugador ya está en su celda cuando la fase empieza
    for (const q of plan) {
      let guard = 0;
      while (Math.floor((z.st.t + DT * 1.01) / PZ_LASER_DT) % z.spec.P !== q.k && guard++ < 600) {
        if (guard === 1) put(-3, -3); // esperando fuera del pasillo (la primera vez); después se queda donde está
        stepN(1);
      }
      put(q.x + 0.5, q.z + 0.5);
      stepN(1);
      acted++;
      if (rt.pzDone) break;
    }
  } else if (g.botMode === "walk") {
    let clock = 0;
    for (const a of plan) {
      if (a.t !== undefined && a.t > clock) {
        put(-3, -3); // de camino
        stepN(Math.round((a.t - clock) / DT));
        clock = a.t;
      }
      put(a.at[0], a.at[1]);
      stepN(2);
      clock += 2 * DT;
      acted++;
    }
    stepN(2);
  } else {
    for (const a0 of plan) {
      const id = a0.dyn ? a0.dyn(z.st) : a0.id,
        a = pzStandAt(z, a0, id);
      put(a.at[0], a.at[1]);
      a.face && faceTo(a.face);
      stepN(1);
      if (PZ.pickId !== id || PZ.pickRt !== rt) {
        fail = `en ${a.at[0].toFixed(1)},${a.at[1].toFixed(1)} el aviso apunta a ${PZ.pickId} y se esperaba ${id}`;
        break;
      }
      x.world.updatePrompt();
      if (!x.prompt || !x.prompt.r || x.prompt.r !== rt) {
        fail = "no hay aviso de USAR";
        break;
      }
      if (o.key) Tt.press("interact");
      else x.world.interact();
      stepN(2);
      acted++;
      if (rt.pzDone) break;
    }
  }
  S.settings.aim = aim0;
    p.ws = ws0;
  return { ok: rt.pzDone === true && !fail, why: fail || (rt.pzDone ? "" : "no resuelto"), acted, errors: z.st.errors, moves: z.st.moves };
}

// ── Simulación de colocación: genera mazmorras con las funciones reales del mundo y mide dónde caen los puzles ──
// Comprueba además que el puzle cabe de verdad (suelo libre + anillo), que no pisa ninguna entidad y que, con TODAS sus celdas sólidas
// iniciales ya aplicadas, siguen siendo alcanzables todas las entidades que lo eran antes (la mazmorra no se parte en dos).
function pzFlood(map, from, extra) {
  const w = map.w,
    seen = new Uint8Array(w * map.h),
    q = [from];
  seen[from] = 1;
  for (let i = 0; i < q.length; i++) {
    const c = q[i],
      cx = c % w,
      cz = (c / w) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx,
        nz = cz + dz;
      if (!map.inb(nx, nz) || map.solidAt(nx, nz)) continue;
      const k = nz * w + nx;
      if (seen[k] || (extra && extra[k])) continue;
      seen[k] = 1;
      q.push(k);
    }
  }
  return seen;
}
function pzVerifyPlacement(map, ent) {
  const d = ent.pz,
    g = PZ_GENS[d.kind],
    w = map.w,
    out = { ok: true, why: "" };
  const spec = pzSpec(d.kind, d.idx, d.tier);
  if (!spec) return { ok: false, why: "sin spec" };
  const T = pzTransform(d),
    st = g.init(spec),
    extra = new Uint8Array(w * map.h);
  for (let z = -1; z <= d.H; z++)
    for (let xx = -1; xx <= d.W; xx++) {
      const cx = d.x0 + xx,
        cz = d.z0 + z,
        ring = xx < 0 || z < 0 || xx >= d.W || z >= d.H;
      if (!map.inb(cx, cz) || map.ter[cz * w + cx] !== map.floorT || map.blk[cz * w + cx]) return { ok: false, why: ring ? "anillo ocupado" : "suelo ocupado" };
    }
  for (let cz = 0; cz < d.lh; cz++)
    for (let cx = 0; cx < d.lw; cx++)
      if (g.solid(spec, st, cx, cz)) extra[Math.floor(T.tz + T.m10 * (cx + 0.5) + T.m11 * (cz + 0.5)) * w + Math.floor(T.tx + T.m00 * (cx + 0.5) + T.m01 * (cz + 0.5))] = 1;
  // entidades físicas dentro del rectángulo
  for (const en of map.ents) {
    if (en.k === "light" || en.k === "encounter" || en.k === "vault" || en.k === "spawnpack" || en.k === "spawnpt" || en === ent) continue;
    if (en.x > d.x0 - 0.5 && en.x < d.x0 + d.W + 0.5 && en.z > d.z0 - 0.5 && en.z < d.z0 + d.H + 0.5) return { ok: false, why: "entidad " + en.k + " dentro" };
  }
  const s0 = map.spawnBase ? Math.floor(map.spawnBase[1]) * w + Math.floor(map.spawnBase[0]) : -1;
  if (s0 < 0) return out;
  const a = pzFlood(map, s0, null),
    b = pzFlood(map, s0, extra);
  for (const en of map.ents) {
    if (en.k === "light" || en === ent || en.k === "encounter" || en.k === "vault" || en.k === "spawnpack" || en.k === "spawnpt") continue;
    const i = Math.floor(en.z) * w + Math.floor(en.x);
    // una entidad se considera alcanzable si ella o una vecina lo es
    const reach = (S) => S[i] || S[i + 1] || S[i - 1] || S[i + w] || S[i - w];
    if (reach(a) && !reach(b)) return { ok: false, why: "la mazmorra se parte: " + en.k + " queda inalcanzable" };
  }
  return out;
}
function pzSimDungeons(N, o) {
  o = o || {};
  const stairs = (x.mode === "world" ? x.map : window.__G.world.map).ents.filter((e) => e.k === "stairs");
  const t0 = performance.now(),
    R = pzRng(o.seed || 12345),
    out = { n: 0, placed: 0, none: 0, nosite: 0, bad: [], byKind: {}, byTier: {}, byTheme: {}, byRot: {}, sub: { n: 0, placed: 0 }, op: { n: 0, placed: 0 }, ms: 0, loreMode: 0, stairs: stairs.length, stairsEnc: {} };
  for (const e of stairs) out.stairsEnc[e.enc] = (out.stairsEnc[e.enc] | 0) + 1;
  const themes = Object.keys(PZ_THEME_OP);
  for (let i = 0; i < N; i++) {
    const isOp = o.ops ? R() < 0.5 : false;
    let n, m;
    if (!isOp) {
      const e = R.pick(stairs),
        reg = e.reg | 0,
        t = De[reg] || De[0];
      n = { sub: true, ent: e, enc: e.enc, reg, lvl: qe(10 + reg * 4 + R.int(-1, 3), t.lvl[0], t.lvl[1] + 1), mods: [], theme: null, obj: "sub", pool: t, seed: R.int(1, 1e9) };
      if (o.noPuzzleEnc && n.enc === "puzzle") continue;
      m = _x(n);
    } else {
      const reg = R.int(0, 8),
        t = De[reg];
      n = { seed: R.int(1, 1e9), theme: R.pick(themes), lvl: qe(R.int(3, 40), t.lvl[0], t.lvl[1] + 2), obj: R.pick(["boss", "data", "rescue", "nests", "exterminate"]), mods: [], reg, pool: t, boss: "garra", nestSpawn: "rastrero" };
      m = yx(n);
    }
    out.n++;
    const bucket = isOp ? out.op : out.sub;
    bucket.n++;
    const ent = m.ents.find((e) => e.k === "puzzle");
    if (!ent) {
      const sid = !isOp && n.ent && n.ent.id ? "sub:" + n.ent.id : null,
        base = sid ? pzMix(sid, 0x50) : pzMix(n.seed | 0, 0x4f50);
      if (!isOp && n.enc === "puzzle") out.noneEnc = (out.noneEnc | 0) + 1;
      else if (pzRng(pzMix(base, 0x43))() >= (isOp ? PZ_CFG.chanceOp : PZ_CFG.chance)) out.none++;
      else {
        out.nosite++;
        (isOp ? (out.nositeOp = (out.nositeOp | 0) + 1) : (out.nositeSub = (out.nositeSub | 0) + 1));
      }
      continue;
    }
    out.placed++;
    bucket.placed++;
    const d = ent.pz;
    out.byKind[d.kind] = (out.byKind[d.kind] | 0) + 1;
    out.byTier[d.tier] = (out.byTier[d.tier] | 0) + 1;
    out.byTheme[d.theme] = (out.byTheme[d.theme] | 0) + 1;
    out.byRot[d.rot] = (out.byRot[d.rot] | 0) + 1;
    d.lore && out.loreMode++;
    const v = pzVerifyPlacement(m, ent);
    if (!v.ok && out.bad.length < 20) out.bad.push({ why: v.why, kind: d.kind, op: isOp, seed: n.seed });
    else if (!v.ok) out.bad.push(null);
  }
  out.bad = out.bad.filter(Boolean);
  out.ms = Math.round(performance.now() - t0);
  return out;
}
// ¿Esta escalera (subterráneo) esconde un acertijo? Es estable: depende solo del id de la escalera y de la configuración.
function pzStairsHave(e) {
  if (!e || e.enc === "puzzle") return false;
  return pzRng(pzMix(pzMix("sub:" + e.id, 0x50), 0x43))() < PZ_CFG.chance;
}
Object.assign(x.puzzleApi, {
  place: pzPlace,
  stairsHave: pzStairsHave,
  doneRecently: pzDoneRecently,
  solveNow: (rt) => {
    const z = rt && rt.pz;
    if (!z || rt.pzDone) return null;
    z.gen.solve && z.gen.solve(z.spec, z.st);
    return pzSolve(rt, "play");
  },
  mounted: () => Array.from(PZ.mounted).map((rt) => ({ id: rt.e.id, kind: rt.pz.d.kind, tier: rt.pz.d.tier, done: !!rt.pzDone, x: rt.e.x, z: rt.e.z, rot: rt.pz.d.rot })),
  stats: () => (pzS() ? pzS().puzzleStats : null),
});
PZ.events = [];
It("puzzleSolved", (p) => {
  PZ.events.push(p);
  PZ.events.length > 64 && PZ.events.shift();
});
window.__puzzles = {
  Ni,
  api: x.puzzleApi,
  PZ,
  PZR,
  cfg: PZ_CFG,
  gens: PZ_GENS,
  spawn: pzSpawn,
  remove: pzRemove,
  bot: pzBotLive,
  solved: pzSolve,
  mount: pzMount,
  unmount: pzUnmount,
  action: pzAction,
  tick: pzTick,
  place: pzPlace,
  migrate: pzMigrate,
  findSite: pzFindSite,
  transform: pzTransform,
  pure: { rng: pzRng, mix: pzMix, spec: pzSpec, choose: pzChoose, botRun: pzBotRun, access: pzAccess },
  rt: (id) => x.world.rt.get(id),
  toWorld: (rt, lx, lz) => pzLocalToWorld(rt.pz, lx, lz),
  gfx() {
    let inst = 0,
      meshes = 0;
    for (const k of PZ_KINDS) {
      if (!PZR.b[k]) continue;
      for (const b of PZR.b[k]) {
        inst += b.n;
        b.n > 0 && meshes++;
      }
    }
    return { ready: PZR.ready, instances: inst, drawn: meshes, total: PZR.ready ? PZ_KINDS.length * 2 : 0 };
  },
  // huella del renderer (geometrías y texturas vivas): para comprobar que montar y desmontar no deja restos
  rawSub: (n) => PZ_RAW.sub(n),
  rawOp: (n) => PZ_RAW.op(n),
  wrapSub: (n) => _x(n),
  wrapOp: (n) => yx(n),
  probe: () => Q(), // siguiente valor del RNG de ejecución del juego (para probar que la colocación no lo consume)
  simDungeons: pzSimDungeons,
  verify: pzVerifyPlacement,
  mem() {
    const i = x.R.r.info;
    let pm = 0;
    for (const c of x.R.scene.children) /^puzzle-/.test(c.name) && pm++;
    return { geometries: i.memory.geometries, textures: i.memory.textures, children: x.R.scene.children.length, puzzleMeshes: pm };
  },
};

// @@FIN@@

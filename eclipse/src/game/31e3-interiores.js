// 31e3-interiores.js — Interiores orgánicos con tamaños variados (D12)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// Petición del jugador: «que las mazmorras, sótanos y en general las zonas en las que puedo entrar no fueran habitaciones rectas con ángulos sin más…
// rutas con giros naturales, formas más redondas… de tamaños más variados: pequeñas, medianas, grandes, enormes (siempre procedurales)».
//
//   1. Formas: las salas dejan de ser rectángulos. Hay círculos con ruido, blobs de cueva, rectángulos de esquinas redondeadas («squircles»), octógonos
//      suaves, cruces redondeadas, salas de dos o tres lóbulos, cacahuetes y anillos con una isla central. El recipiente de toolkit `sp` (17-worldgen.js)
//      se envuelve: las salas «rect», «cross» y «octo» de las operaciones (yx) también salen redondeadas y los pasillos en L pasan a ser curvas.
//   2. Pasillos con giros: curvas de Bézier con ruido entre salas (túneles de cueva en grutas y colmenas), más anchos o estrechos a lo largo del trayecto.
//   3. Tamaños: cada subterráneo (_x: sótanos, plantas, grutas, colmenas, búnkeres y alcantarillas) sale pequeño, mediano, grande o enorme según el tipo de
//      escalera y la semilla: de 48×48 con 4 salas a 116×116 con 15-20. La entrada, la sala del encuentro, las manadas, el botín y los acertijos se reparten
//      con las mismas reglas de siempre (entidades, sellos del encuentro, cámara sellada, atrezo), escaladas por el tamaño.
//   4. Comprobaciones: conectividad total desde la entrada, entidades siempre sobre suelo y, si algo falla, se vuelve al generador antiguo (_x original).
// Contrato con el resto del juego: el mapa devuelto es el mismo de siempre (Fa con ter/wh/dark/var, ents, rooms [entrada, cadena, arena, laterales],
// encRoom, floorT, spawnBase, totalPacks) y se le aplica ME (giro/espejo). Los envoltorios de 31f (acertijos) y 31g (guaridas) se apoyan en él sin cambios.
// Pruebas: window.__zg.

x.cfg.zg = {
  v: 1,
  enabled: true,
  // D = lado del mapa; rooms = salas extra (sin contar entrada y arena); rad = radio de las salas; gap = hueco mínimo entre salas; loops = bucles extra
  // (fracción de salas); arena = escala de la sala del encuentro; packs/loot = multiplicadores de manadas y botín; curve = curvatura de los pasillos
  classes: {
    small: { n: "pequeña", D: 48, rooms: [1, 2], rad: [4.2, 6.2], gap: 4.5, loops: 0.15, arena: 0.88, packs: 0.9, loot: 1, curve: 0.22, halls: 0 },
    medium: { n: "mediana", D: 64, rooms: [3, 5], rad: [4.6, 7.4], gap: 5, loops: 0.25, arena: 1, packs: 1, loot: 1, curve: 0.26, halls: 1 },
    large: { n: "grande", D: 88, rooms: [6, 9], rad: [5, 8.6], gap: 5.5, loops: 0.3, arena: 1.08, packs: 1.15, loot: 2, curve: 0.3, halls: 2 },
    huge: { n: "enorme", D: 116, rooms: [10, 15], rad: [5.2, 9.6], gap: 6, loops: 0.35, arena: 1.16, packs: 1.3, loot: 3, curve: 0.32, halls: 3 },
  },
  // probabilidades [pequeña, mediana, grande, enorme] por tipo de escalera
  odds: {
    basement: [0.38, 0.42, 0.17, 0.03],
    upper: [0.34, 0.46, 0.2, 0],
    cave: [0.2, 0.35, 0.3, 0.15],
    hive: [0.1, 0.3, 0.4, 0.2],
    hatch: [0.2, 0.4, 0.3, 0.1],
    sewer: [0.15, 0.35, 0.35, 0.15],
    lair: [0, 0.4, 0.45, 0.15], // las guaridas de jefe (31g) nunca salen pequeñas: antesala, sala media y arena piden sitio
  },
  // formas de las salas (peso) por tema; la arena usa solo las que tienen el centro libre
  shapes: {
    gruta: { blob: 5, lobed: 2.5, peanut: 1.5, round: 1 },
    colmena: { blob: 4, lobed: 3, peanut: 1.5, round: 1.5 },
    sotano: { squircle: 4, round: 2, octo: 1.5, cross: 1.5, peanut: 1, ring: 0.8 },
    planta: { squircle: 4.5, round: 2, cross: 1.5, octo: 1, peanut: 1, ring: 0.5 },
    alcantarilla: { peanut: 3.5, round: 2, squircle: 2, lobed: 1.5, blob: 1, ring: 0.6 },
  },
  puzzleMedium: true, // una escalera con acertijo (31f: pzWants) nunca sale pequeña: las zonas medianas o mayores traen un salón donde cabe cualquier acertijo
  tryMax: 6, // intentos de generación por mapa antes de volver al generador antiguo
};
const ZGC = x.cfg.zg;

// ═══ 1. FORMAS ════════════════════════════════════════════════════════════════════════════════════
// Cada forma devuelve inside(u, v) con u, v = desplazamiento / radio (el borde está en torno a 1). Todo con el RNG `e` del mapa.
const ZG_SHAPES = {
  round(e) {
    const f = e() * 6.28,
      g = e() * 6.28;
    return (u, v) => Math.hypot(u, v) < 0.97 * (1 + 0.05 * Math.sin(3 * Math.atan2(v, u) + f) + 0.035 * Math.sin(5 * Math.atan2(v, u) + g));
  },
  blob(e) {
    const f = e() * 6.28,
      g = e() * 6.28,
      h = e() * 6.28;
    return (u, v) => {
      const a = Math.atan2(v, u);
      return Math.hypot(u, v) < 0.95 * (1 + 0.14 * Math.sin(3 * a + f) + 0.09 * Math.sin(5 * a + g) + 0.06 * Math.sin(2 * a + h));
    };
  },
  squircle(e) {
    const p = 2.7 + e() * 1.1;
    return (u, v) => Math.pow(Math.abs(u), p) + Math.pow(Math.abs(v), p) < 0.96;
  },
  octo(e) {
    const rot = e() < 0.5 ? 0 : Math.PI / 8,
      c = Math.cos(rot),
      s = Math.sin(rot);
    return (u, v) => {
      const a = Math.abs(u * c - v * s),
        b = Math.abs(u * s + v * c);
      return Math.max(a, b, (a + b) / 1.38) < 0.94 && Math.hypot(u, v) < 1.02;
    };
  },
  cross(e) {
    const w = 0.5 + e() * 0.1,
      p = 3;
    return (u, v) => {
      const a = Math.pow(Math.abs(u), p) + Math.pow(Math.abs(v / w), p) < 0.9,
        b = Math.pow(Math.abs(u / w), p) + Math.pow(Math.abs(v), p) < 0.9;
      return a || b;
    };
  },
  lobed(e) {
    const k = 2 + (e() < 0.55 ? 1 : 0),
      a0 = e() * 6.28,
      lobes = [];
    for (let i = 0; i < k; i++) {
      const a = a0 + (i / k) * 6.28 + (e() - 0.5) * 0.5;
      lobes.push([Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.58 + e() * 0.14]);
    }
    return (u, v) => {
      if (Math.hypot(u, v) < 0.5) return true;
      for (const [cx, cz, r] of lobes) if (Math.hypot(u - cx, v - cz) < r) return true;
      return false;
    };
  },
  peanut(e) {
    const vert = e() < 0.5,
      d = 0.36 + e() * 0.1;
    return (u, v) => (vert ? Math.hypot(u, v - d) < 0.66 || Math.hypot(u, v + d) < 0.66 : Math.hypot(u - d, v) < 0.66 || Math.hypot(u + d, v) < 0.66);
  },
  ring(e) {
    const r = 0.26 + e() * 0.08,
      f = e() * 6.28;
    return (u, v) => Math.hypot(u, v) < 0.97 * (1 + 0.04 * Math.sin(3 * Math.atan2(v, u) + f)) && Math.hypot(u, v) > r;
  },
};
// formas con el centro siempre libre (las que sirven de arena y de sala de entrada)
const ZG_CENTER_OK = ["round", "blob", "squircle", "octo", "cross", "lobed", "peanut"];
function zgPickShape(e, theme, onlyCenter) {
  const W = ZGC.shapes[theme] || ZGC.shapes.sotano;
  let list = Object.keys(W);
  if (onlyCenter) list = list.filter((k) => ZG_CENTER_OK.includes(k));
  let tot = 0;
  for (const k of list) tot += W[k];
  let q = e() * tot;
  for (const k of list) {
    q -= W[k];
    if (q <= 0) return k;
  }
  return list[0];
}
// sala orgánica: centro (cx, cz) y semiejes (rx, rz); devuelve el mismo objeto que sp().room (x0..z1, cx, cz, w, h, shape, dark, tiles)
function zgRoom(S, e, cx, cz, rx, rz, kind, dark, shapeName) {
  const inside = ZG_SHAPES[kind](e),
    h = S.h,
    tiles = new Set();
  let x0 = 1e9,
    x1 = -1e9,
    z0 = 1e9,
    z1 = -1e9;
  for (let p = Math.floor(cz - rz - 1); p <= Math.ceil(cz + rz + 1); p++)
    for (let m = Math.floor(cx - rx - 1); m <= Math.ceil(cx + rx + 1); m++) {
      if (m < 1 || p < 1 || m >= h.w - 1 || p >= h.h - 1) continue;
      if (!inside((m + 0.5 - cx) / rx, (p + 0.5 - cz) / rz)) continue;
      S.floor(m, p, dark);
      tiles.add(h.idx(m, p));
      if (m < x0) x0 = m;
      if (m > x1) x1 = m;
      if (p < z0) z0 = p;
      if (p > z1) z1 = p;
    }
  if (!tiles.size) return null;
  return { x0, z0, x1, z1, cx, cz, w: x1 - x0 + 1, h: z1 - z0 + 1, shape: shapeName || kind, kind, rx, rz, dark: !!dark, tiles };
}

// ═══ 2. PASILLOS CON GIROS ════════════════════════════════════════════════════════════════════════
// la baldosa de una sala más adelantada hacia `dir` (donde nace un pasillo hacia otra sala)
function zgEdgePoint(h, a, dx, dz) {
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;
  let best = null,
    bd = -1e9;
  const W = h.w;
  for (const t of a.tiles) {
    const px = (t % W) + 0.5,
      pz = Math.floor(t / W) + 0.5,
      d = (px - a.cx) * dx + (pz - a.cz) * dz;
    if (d > bd) {
      bd = d;
      best = [px, pz];
    }
  }
  return best || [a.cx, a.cz];
}
// pasillo entre dos salas: Bézier cúbica con las dos asas desplazadas hacia los lados (curva en S o en C) y ancho que respira
function zgTunnel(S, e, a, b, width, curve, dark, wild) {
  const h = S.h,
    p0 = zgEdgePoint(h, a, b.cx - a.cx, b.cz - a.cz),
    p3 = zgEdgePoint(h, b, a.cx - b.cx, a.cz - b.cz),
    dx = p3[0] - p0[0],
    dz = p3[1] - p0[1],
    L = Math.hypot(dx, dz) || 1,
    nx = -dz / L,
    nz = dx / L,
    s1 = (e() < 0.5 ? -1 : 1) * (0.4 + e() * 0.6),
    s2 = (e() < 0.35 ? -s1 : s1) * (0.4 + e() * 0.6),
    c1 = [p0[0] + dx * 0.33 + nx * L * curve * s1, p0[1] + dz * 0.33 + nz * L * curve * s1],
    c2 = [p0[0] + dx * 0.67 + nx * L * curve * s2, p0[1] + dz * 0.67 + nz * L * curve * s2],
    steps = Math.max(8, Math.ceil(L * 1.4)),
    ph = e() * 6.28,
    wob = wild ? 0.38 : 0.12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      u = 1 - t,
      x0 = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
      z0 = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
      r = (width / 2) * (1 + wob * Math.sin(t * 9 + ph)) + (wild ? (e() - 0.5) * 0.5 : 0);
    const R = Math.max(1.05, r);
    for (let q = -Math.ceil(R); q <= Math.ceil(R); q++)
      for (let m = -Math.ceil(R); m <= Math.ceil(R); m++)
        if (m * m + q * q <= R * R) {
          const X = Math.floor(x0 + m),
            Z = Math.floor(z0 + q);
          if (h.inb(X, Z) && h.ter[h.idx(X, Z)] !== S.t) S.floor(X, Z, dark);
        }
  }
}

// ═══ 3. COMPOSICIÓN DEL MAPA ═════════════════════════════════════════════════════════════════════
function zgClass(n, rng) {
  const kind = n.ent && n.ent.kind,
    odds = n.lair ? ZGC.odds.lair : ZGC.odds[kind] || ZGC.odds.basement,
    names = ["small", "medium", "large", "huge"];
  let q = rng(),
    k = 0;
  for (; k < 3; k++) {
    q -= odds[k];
    if (q <= 0) break;
  }
  return names[k];
}
function zgHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
// el mapa: devuelve null si no se pudo cumplir alguna comprobación (el llamante reintenta con otra sal)
function zgFail(c) {
  zgFail.last = c;
  return null;
}
function zgBuild(n, cname, salt) {
  const e = pi((n.seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0),
    C = ZGC.classes[cname],
    t = n.ent,
    kind = t.kind,
    theme = vE[kind] || "sotano",
    reg = De[n.reg] || De[0],
    enc = n.enc;
  let T = { ...Zi[theme] };
  theme === "gruta" &&
    ((T.floor = [tt(reg.rock, 0, 0.25), tt(reg.rock, 0, 0.15), tt(reg.rock, 0, 0.35)]),
    (T.wall = reg.rock),
    (T.props = reg.props.filter((K) => K[2]).map((K) => K[0]).slice(0, 4)),
    (T.liquid = reg.liquid === "ice" ? "ice" : reg.liquid || null),
    (T.decor = reg.decor.map((K) => K[0]).slice(0, 2)));
  const cave = kind === "cave" || kind === "hive",
    D = C.D,
    h = new Fa(D, D);
  h.kind = "op";
  h.theme = theme;
  h.themeObj = T;
  h.op = n;
  h.rk = reg.key;
  h.sub = true;
  h.ter.fill(cave ? F.ROCK : F.VOID);
  h.var.fill(kind === "upper" && t.bstyle != null ? t.bstyle : (yE[theme] ?? 0));
  const f = cave ? F.CAVE : F.FLOOR,
    S = sp(h, e, f, cave ? F.ROCK : F.WALL),
    ri = (a, b) => a + Math.floor(e() * (b - a + 1)),
    rf = (a, b) => a + e() * (b - a),
    darkRoll = () => e() < T.dark;
  S.h = h;
  S.t = f;
  // ── salas ──
  const rooms = [],
    near = (cx, cz, rb) => rooms.every((r) => Math.hypot(cx - r.cx, cz - r.cz) >= rb + Math.max(r.rx, r.rz) * 1.08 + C.gap);
  const [aw, ah] = ({ miniboss: [21, 19], waves: [20, 18], defend_civ: [18, 18], defend_eq: [18, 18], puzzle: [18, 15] })[enc] || [18, 16];
  const arx = ((aw + ri(-2, 1)) / 2) * C.arena,
    arz = ((ah + ri(-1, 0)) / 2) * C.arena;
  // entrada: abajo, pequeña, redonda o cuadrada con esquinas redondeadas
  const erx = rf(4.2, 5.4),
    erz = rf(3.8, 4.8),
    ecx = D / 2 + (e() - 0.5) * D * 0.22,
    ecz = D - erz - 3.5;
  const ent = zgRoom(S, e, ecx, ecz, erx, erz, e() < 0.5 ? "round" : "squircle", false, "rect");
  if (!ent) return zgFail(1);
  rooms.push(ent);
  // arena: arriba y lejos de la entrada; en el acertijo hace falta sitio encima para la cámara sellada
  const topMin = (enc === "puzzle" ? 11 : 4) + arz,
    shapePool = enc === "puzzle" ? ["squircle"] : cave ? ["blob", "round", "lobed"] : ["round", "octo", "cross", "squircle", "blob"],
    ak = enc === "miniboss" && !cave && e() < 0.6 ? "octo" : shapePool[ri(0, shapePool.length - 1)];
  let arena = null;
  for (let tries = 0; tries < 80 && !arena; tries++) {
    const cx = rf(arx + 3, D - arx - 3),
      cz = rf(topMin, Math.max(topMin + 1, topMin + D * 0.22));
    if (Math.hypot(cx - ecx, cz - ecz) < D * 0.4 || !near(cx, cz, Math.max(arx, arz))) continue;
    arena = zgRoom(S, e, cx, cz, arx, arz, ak, false, enc === "puzzle" || (!cave && ak === "squircle") ? "rect" : ak);
  }
  if (!arena) return zgFail(2);
  // resto de salas en huecos libres; las que no caben se descartan (el mínimo lo garantizan las clases). Las primeras son «salones» de 14×12
  // (esquinas redondeadas) donde caben los acertijos con su anillo libre
  const want = ri(C.rooms[0], C.rooms[1]),
    extra = [];
  for (let k = 0; k < want; k++) {
    const hall = k < C.halls,
      rr0 = hall ? rf(7.2, 8.4) : rf(C.rad[0], C.rad[1]),
      asp = hall ? rf(1.1, 1.2) : rf(0.8, 1.3);
    // crecimiento: de varios sitios libres se elige el más cercano a una distancia aleatoria de la estructura (zonas compactas con pasillos que serpentean);
    // si no cabe, la sala se prueba más pequeña (los salones no: solo se descartan)
    let r = null;
    for (let shrink = 1; shrink >= (hall ? 1 : 0.7) && !r; shrink -= 0.15) {
      const rx = rr0 * asp * shrink,
        rz = (hall ? (rr0 / asp) * 0.92 : rr0 / asp) * shrink;
      let best = null,
        bScore = 1e9;
      const target = C.gap + rf(1.5, 9),
        all = [...rooms, arena];
      for (let tries = 0; tries < 160; tries++) {
        const cx = rf(rx + 3, D - rx - 3),
          cz = rf(rz + 3, D - rz - 3);
        if (!near(cx, cz, Math.max(rx, rz))) continue;
        if (Math.hypot(cx - arena.cx, cz - arena.cz) < Math.max(arx, arz) + Math.max(rx, rz) + C.gap) continue;
        let dmin = 1e9;
        for (const o of all) dmin = Math.min(dmin, Math.hypot(cx - o.cx, cz - o.cz) - Math.max(rx, rz) - Math.max(o.rx, o.rz));
        const sc = Math.abs(dmin - target);
        if (sc < bScore) ((bScore = sc), (best = [cx, cz]));
      }
      if (best) r = zgRoom(S, e, best[0], best[1], rx, rz, hall ? "squircle" : zgPickShape(e, theme, false), darkRoll());
    }
    if (r) (rooms.push(r), extra.push(r));
  }
  if (extra.length < Math.max(1, Math.ceil(C.rooms[0] * 0.7))) return zgFail(3);
  rooms.push(arena);
  // ── grafo: árbol de expansión mínima entre entrada y salas, la arena cuelga de la sala más lejana ──
  const nodes = [ent, ...extra],
    dist = (a, b) => Math.hypot(a.cx - b.cx, a.cz - b.cz),
    inTree = new Set([ent]),
    edges = [],
    par = new Map();
  while (inTree.size < nodes.length) {
    let bd = 1e9,
      ba = null,
      bb = null;
    for (const a of inTree) for (const b of nodes) if (!inTree.has(b) && dist(a, b) < bd) ((bd = dist(a, b)), (ba = a), (bb = b));
    if (!bb) break;
    inTree.add(bb);
    edges.push([ba, bb]);
    par.set(bb, ba);
  }
  const depth = (r) => {
    let d = 0;
    for (let q = r; par.get(q); q = par.get(q)) d++;
    return d;
  };
  // la sala más lejana (en saltos y en distancia) a la entrada: de ahí cuelga la arena
  let far = ent;
  for (const r of nodes) if (depth(r) > depth(far) || (depth(r) === depth(far) && dist(r, arena) < dist(far, arena))) far = r;
  edges.push([far, arena]);
  par.set(arena, far);
  const chain = [];
  for (let q = arena; q; q = par.get(q)) chain.unshift(q);
  // bucles: pares cercanos que no están unidos (nunca con la entrada ni con la arena salvo un segundo acceso a la arena a veces)
  const has = (a, b) => edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a)),
    loopCount = Math.round(extra.length * C.loops + (extra.length > 2 ? 0.5 : 0));
  const pairs = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (!has(nodes[i], nodes[j]) && dist(nodes[i], nodes[j]) < D * 0.5) pairs.push([nodes[i], nodes[j]]);
  pairs.sort((p, q) => dist(p[0], p[1]) - dist(q[0], q[1]));
  for (let k = 0; k < loopCount && k < pairs.length; k++) edges.push(pairs[k]);
  if (e() < 0.3 && extra.length > 1) {
    const cand = extra.filter((r) => r !== far && !has(r, arena)).sort((a, b) => dist(a, arena) - dist(b, arena))[0];
    cand && dist(cand, arena) < D * 0.45 && edges.push([cand, arena]);
  }
  // pasillos: anchos de edificio (3-4) o túneles de cueva (más anchos y rugosos)
  for (const [a, b] of edges) {
    const dk = (a.dark && b.dark) || T.dark > 0.6;
    zgTunnel(S, e, a, b, cave ? rf(2.6, 3.8) : e() < 0.7 ? 3 : 4, C.curve * (cave ? 1.1 : 1), dk, cave);
  }
  // cámara sellada del acertijo: pequeña y recta, justo encima de la arena (como siempre)
  let G = null;
  if (enc === "puzzle") {
    const K = Math.floor(arena.cx);
    G = { x0: K - 3, z0: arena.z0 - 6, x1: K + 2, z1: arena.z0 - 2, cx: K, cz: arena.z0 - 4, w: 6, h: 5, shape: "rect", dark: true, tiles: new Set() };
    for (let p = G.z0; p <= G.z1; p++)
      for (let m = G.x0; m <= G.x1; m++) {
        S.floor(m, p, true);
        G.tiles.add(h.idx(m, p));
      }
    // el techo de la arena en esas dos columnas debe ser suelo
    for (const m of [K - 1, K]) if (!arena.tiles.has(h.idx(m, arena.z0))) return zgFail(4);
  }
  // ── limpieza de bordes: quita casillas sueltas y rellena huecos de una casilla ──
  zgSmooth(h, f, [...rooms, G].filter(Boolean));
  // ── paredes: toda casilla vacía junto al suelo (8 vecinos) es muro ──
  if (!cave)
    for (let Z = 1; Z < D - 1; Z++)
      for (let X = 1; X < D - 1; X++) {
        const i = h.idx(X, Z);
        if (h.ter[i] !== F.VOID) continue;
        let w = false;
        for (let b = -1; b <= 1 && !w; b++) for (let a = -1; a <= 1; a++) if (h.ter[h.idx(X + a, Z + b)] === f) { w = true; break; }
        if (w) {
          h.ter[i] = F.WALL;
          h.wh[i] = kind === "upper" ? 17 : 15;
        }
      }
  // ── entidades ──
  let L = 0;
  const B = (k, x1, z1, extra2 = {}) => {
      const W = { k, id: `${k}_sub_${L++}`, x: x1, z: z1, ...extra2 };
      return (h.ents.push(W), W);
    },
    N = new Set(),
    free = (X, Z) => h.inb(X, Z) && h.ter[h.idx(X, Z)] === f,
    // un punto de suelo de la sala con margen: todas las casillas a `clear` casillas son suelo
    pickIn = (room, clear = 1) => {
      const arr = [...room.tiles];
      for (let k = 0; k < 120; k++) {
        const i = arr[Math.floor(e() * arr.length)],
          X = i % D,
          Z = Math.floor(i / D);
        if (h.ter[i] !== f || h.blk[i] || N.has(i)) continue;
        let ok = true;
        for (let b = -clear; b <= clear && ok; b++) for (let a = -clear; a <= clear; a++) if (!free(X + a, Z + b)) { ok = false; break; }
        if (ok) return (N.add(i), [X + 0.5, Z + 0.5]);
      }
      return null;
    },
    V = (X, Z, r = 1) => {
      for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) N.add(h.idx(Math.floor(X) + a, Math.floor(Z) + b));
    };
  const firstFloorDown = (X, Z0) => {
    for (let Z = Z0; Z < D - 1; Z++) if (free(X, Z)) return Z;
    return -1;
  };
  // salida y punto de partida en la sala de entrada
  const ex = Math.floor(ent.cx),
    ez = firstFloorDown(ex, Math.floor(ent.cz - ent.rz) - 1);
  if (ez < 0) return zgFail(6);
  h.spawnBase = [ent.cx, ent.cz + 1];
  if (!free(Math.floor(ent.cx), Math.floor(ent.cz + 1))) return zgFail(7);
  B("exit", ex + 0.5, ez + 1.5 > ent.cz ? ent.cz - 1.2 : ez + 1.5, { id: "exit" });
  V(ex, ez + 1, 1);
  V(ent.cx, ent.cz + 1, 1);
  B("light", ent.cx, ent.cz, { c: 12574975, model: "none" });
  // encuentro: suelos vecinos de la arena que no son de la arena son los accesos que se sellan
  const M = [];
  for (const K of arena.tiles) {
    const X = K % D,
      Z = Math.floor(K / D);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = h.idx(X + a, Z + b);
      !arena.tiles.has(q) && h.ter[q] === f && !M.includes(q) && M.push(q);
    }
  }
  const J = { x0: arena.x0, z0: arena.z0, x1: arena.x1, z1: arena.z1, cx: arena.cx, cz: arena.cz };
  const he = B("encounter", arena.cx, arena.cz, { id: "enc", enc, room: J, seal: M, tiles: [...arena.tiles] });
  if (!free(Math.floor(arena.cx), Math.floor(arena.cz))) return zgFail(8);
  if (enc === "miniboss") S.pillars(arena, cave ? F.ROCK : F.WALL, cave ? 0 : 22, 5);
  if (enc === "waves" || enc === "defend_eq" || enc === "defend_civ") S.cover(arena, 3 + Math.floor(e() * 2), cave ? F.ROCK : F.WALL);
  // la cámara y el cofre del acertijo
  if (G) {
    const K = Math.floor(arena.cx),
      I = [];
    for (const m of [K - 1, K]) {
      const q = h.idx(m, arena.z0 - 1);
      h.ter[q] = F.SECRET;
      h.wh[q] = 0;
      I.push(q);
    }
    B("vault", K, arena.z0 - 1, { id: "vault", tiles: I });
    B("chest", K, G.cz, { id: "vault_chest", tier: 3, locked: true });
    h.blk[h.idx(K, Math.floor(G.cz))] = 1;
  }
  V(arena.cx, arena.cz, 2);
  if (enc === "defend_civ")
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * 6.283 + 0.4;
      B("civilian", arena.cx + Math.cos(a) * 1.4, arena.cz + Math.sin(a) * 1.4, { id: "civ_" + k, n: k });
    }
  if (enc === "defend_eq") {
    B("device", arena.cx, arena.cz, { id: "device" });
    h.blk[h.idx(Math.floor(arena.cx), Math.floor(arena.cz))] = 1;
  }
  if (enc === "puzzle") {
    const mode = e() < 0.5 ? "switch" : "sequence",
      count = mode === "switch" ? 6 : 5;
    he.mode = mode;
    const rr = Math.min(arena.w, arena.h) / 2 - 3.2;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * 6.283 - Math.PI / 2;
      let X = Math.floor(arena.cx + Math.cos(a) * rr) + 0.5,
        Z = Math.floor(arena.cz + Math.sin(a) * rr) + 0.5;
      if (!free(Math.floor(X), Math.floor(Z))) {
        // la forma redondeada se queda corta en los lados: se acerca al centro hasta encontrar suelo
        for (let s = 0.9; s > 0.3 && !free(Math.floor(X), Math.floor(Z)); s -= 0.1) {
          X = Math.floor(arena.cx + Math.cos(a) * rr * s) + 0.5;
          Z = Math.floor(arena.cz + Math.sin(a) * rr * s) + 0.5;
        }
      }
      B("plate", X, Z, { id: "plate_" + k, n: k });
      V(X, Z, 1);
    }
    mode === "sequence" && (B("pylon", arena.cx, arena.cz, { id: "pylon" }), (h.blk[h.idx(Math.floor(arena.cx), Math.floor(arena.cz))] = 1));
  }
  // manadas: una por sala (dos si es grande), más en zonas grandes
  const chainMid = chain.filter((r) => r !== ent && r !== arena),
    sides = extra.filter((r) => !chain.includes(r));
  let packN = 0;
  for (const r of [...chainMid, ...sides]) {
    const cnt = Math.max(1, Math.min(3, Math.round((r.tiles.size / 150) * C.packs)));
    for (let k = 0; k < cnt; k++) {
      const p = pickIn(r, 2) || pickIn(r, 1);
      p && (B("spawnpack", p[0], p[1], { size: 3 + Math.floor(e() * 2), dark: r.dark, op: true }), packN++);
    }
  }
  // nunca menos de dos manadas (una zona pequeña con una sola sala intermedia): se reparte el resto en las salas que haya
  for (let k = 0; packN < 2 && k < 6; k++) {
    const r = [...chainMid, ...sides][k % Math.max(1, chainMid.length + sides.length)];
    const p = r && (pickIn(r, 2) || pickIn(r, 1));
    p && (B("spawnpack", p[0], p[1], { size: 3 + Math.floor(e() * 2), dark: r.dark, op: true }), packN++);
  }
  // botín: cajas, datáfono, santuario y cofre en las salas laterales (o en la cadena si no hay); más en zonas grandes
  const lootRooms = sides.length ? sides : chainMid.length ? chainMid : [arena],
    shuffled = [...lootRooms].sort(() => e() - 0.5);
  const loot = Math.max(1, Math.min(shuffled.length, C.loot));
  for (let k = 0; k < loot; k++) {
    const r = shuffled[k % shuffled.length];
    if (e() < 0.6) {
      const p = pickIn(r, 1);
      p && (B("crate", p[0], p[1], {}), (h.blk[h.idx(Math.floor(p[0]), Math.floor(p[1]))] = 1));
    }
    const q = e();
    const p = pickIn(r, 1);
    if (p) {
      if (q < 0.35) B("datapad", p[0], p[1], { opdp: true });
      else if (q < 0.6) (B("shrine", p[0], p[1], {}), (h.blk[h.idx(Math.floor(p[0]), Math.floor(p[1]))] = 1));
      else if (q < 0.8) (B("chest", p[0], p[1], { tier: 1 }), (h.blk[h.idx(Math.floor(p[0]), Math.floor(p[1]))] = 1));
    }
  }
  // los pasillos y sus bocas (2 casillas alrededor) quedan libres de atrezo: nada tapa el paso
  {
    const inRoom = new Uint8Array(D * D);
    for (const r of rooms) for (const i of r.tiles) inRoom[i] = 1;
    if (G) for (const i of G.tiles) inRoom[i] = 1;
    for (let Z = 1; Z < D - 1; Z++)
      for (let X = 1; X < D - 1; X++) {
        const i = Z * D + X;
        if (h.ter[i] !== f || inRoom[i]) continue;
        for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) N.add(h.idx(X + a, Z + b));
      }
  }
  // atrezo y luces (todas las salas menos la arena)
  const decorRooms = [...rooms.filter((r) => r !== arena), ...(G ? [G] : [])];
  ap(h, decorRooms, T, theme, f, N, e, B, 0.09);
  B("light", arena.cx - arena.w * 0.25, arena.cz - arena.h * 0.25, { c: kind === "hive" ? 13656319 : 16773328, model: "none" });
  B("light", arena.cx + arena.w * 0.25, arena.cz + arena.h * 0.25, { c: kind === "hive" ? 13656319 : 16773328, model: "none" });
  for (const K of arena.tiles) h.dark[K] = 0;
  // ── orden de salas que esperan los demás fragmentos: entrada, cadena, arena, laterales (+ cámara sellada) ──
  const ordered = [ent, ...chainMid, arena, ...sides];
  G && ordered.push(G);
  // ── conectividad: toda sala alcanzable desde la entrada ──
  const reach = Ud(h, ent.cx, ent.cz + 1, (K) => K === f || K === F.ACID || K === F.ICE);
  for (const r of ordered) {
    if (r === G) continue;
    let ok = false;
    for (const tl of r.tiles) if (reach[tl] >= 0) { ok = true; break; }
    if (!ok) return zgFail(9);
  }
  // todas las entidades con posición sobre suelo alcanzable
  for (const q of h.ents) {
    if (q.k === "light" || q.k === "vault") continue;
    const X = Math.floor(q.x),
      Z = Math.floor(q.z);
    if (!h.inb(X, Z) || (h.ter[h.idx(X, Z)] !== f && h.ter[h.idx(X, Z)] !== F.SECRET)) return ((zgFail.ent = q.k), zgFail(10));
  }
  // el jugador (radio 0,36) cabe por todas partes: se recorre la zona en una retícula de 0,5 m desde la entrada y se llega a toda sala y a toda entidad
  zgBuild.why = null;
  if (!zgWalk(h, ordered.filter((r) => r !== G), 0.4)) {
    zgBuild.why = zgWalk.why;
    zgFail.last = 11;
    if (!ZGC.debug) return null;
    h.zgBad = zgWalk.why; // solo en pruebas: devuelve el mapa para poder verlo
  }
  h.rooms = ordered;
  h.floorT = f;
  h.encRoom = arena;
  h.totalPacks = h.ents.filter((q) => q.k === "spawnpack").length;
  h.zg = { cls: cname, name: C.n, D, rooms: ordered.length, shapes: ordered.map((r) => r.kind || r.shape), edges: edges.length };
  ME(h, Math.floor(e() * 8));
  // ME gira rooms y ents pero no la copia del rectángulo que lleva el encuentro: se sincroniza
  Object.assign(J, { x0: arena.x0, z0: arena.z0, x1: arena.x1, z1: arena.z1, cx: arena.cx, cz: arena.cz });
  return h;
}
// BFS en retícula de 0,5 m con el radio del jugador: ¿se llega a cada sala (alguna baldosa) y a cada entidad con posición?
function zgWalk(h, rooms, r) {
  const SS = 2,
    w = h.w * SS,
    hh = h.h * SS,
    N = w * hh,
    ok = new Uint8Array(N).fill(2),
    seen = new Uint8Array(N),
    clear = (i) => {
      if (ok[i] !== 2) return ok[i] === 1;
      return (ok[i] = h.circleHits(((i % w) + 0.5) / SS, (Math.floor(i / w) + 0.5) / SS, r) ? 0 : 1) === 1;
    },
    sb = h.spawnBase,
    start = Math.floor(sb[1] * SS) * w + Math.floor(sb[0] * SS);
  if (!clear(start)) return ((zgWalk.why = "arranque bloqueado"), false);
  const q = [start];
  seen[start] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k],
      X = i % w,
      Z = Math.floor(i / w);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = X + a,
        nz = Z + b;
      if (nx < 0 || nz < 0 || nx >= w || nz >= hh) continue;
      const j = nz * w + nx;
      if (seen[j] || !clear(j)) continue;
      // un paso en diagonal solo cuenta si el punto medio también cabe (el jugador se mueve de forma continua)
      if (a && b && h.circleHits(((X + nx) / 2 + 0.5) / SS, ((Z + nz) / 2 + 0.5) / SS, r)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  zgWalk.seen = seen;
  const at = (x1, z1) => {
    const X0 = Math.floor(x1 * SS),
      Z0 = Math.floor(z1 * SS);
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) if (seen[(Z0 + b) * w + X0 + a]) return true;
    return false;
  };
  for (const rm of rooms) if (rm.kind !== undefined || rm.shape) if (!at(rm.cx, rm.cz) && ![...rm.tiles].some((t) => at((t % h.w) + 0.5, Math.floor(t / h.w) + 0.5))) return ((zgWalk.why = "sala " + (rm.kind || rm.shape) + " " + rm.cx.toFixed(0) + "," + rm.cz.toFixed(0)), false);
  for (const e of h.ents) if (e.k !== "light" && e.k !== "vault" && e.k !== "chest" && !at(e.x, e.z)) return ((zgWalk.why = "entidad " + e.k + " " + e.x.toFixed(1) + "," + e.z.toFixed(1)), false);
  zgWalk.seen = seen;
  return true;
}
// quita casillas de suelo con ≤ 2 vecinas de suelo (8 vecinos) y rellena los huecos rodeados; nada dentro de las salas se toca más que el borde
function zgSmooth(h, f, rooms) {
  const W = h.w,
    del = [],
    add = [];
  for (let Z = 2; Z < h.h - 2; Z++)
    for (let X = 2; X < W - 2; X++) {
      const i = Z * W + X;
      let cnt = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if ((a || b) && h.ter[(Z + b) * W + X + a] === f) cnt++;
      if (h.ter[i] === f && cnt <= 2) del.push(i);
      else if (h.ter[i] !== f && h.ter[i] !== F.SECRET && cnt >= 6) add.push(i);
    }
  const fl = f === F.CAVE ? F.ROCK : F.VOID;
  for (const i of del) {
    h.ter[i] = fl;
    h.dark[i] = 0;
    for (const r of rooms) r.tiles.delete(i);
  }
  for (const i of add) {
    h.ter[i] = f;
    h.wh[i] = 0;
    h.dark[i] = 0;
  }
}

// ═══ 4. ENVOLTORIOS ══════════════════════════════════════════════════════════════════════════════
const _x_zg = _x;
// el TAMAÑO de una escalera es fijo (sale de su identificador: «esta cueva es grande»); el trazado cambia en cada visita, como siempre. Sin identificador (pruebas
// o mapas sueltos) manda la semilla
const zgKey = (n) => (n.ent && n.ent.id != null ? "id:" + n.ent.id : "seed:" + (n.seed >>> 0)) + ":" + (n.ent && n.ent.kind);
function zgGenerate(n) {
  const rng = pi(zgHash("zg" + zgKey(n)));
  let cname = n.zgClass || zgClass(n, rng);
  // una escalera con acertijo (31f: pzWants) nunca sale pequeña: las zonas medianas o mayores traen un salón donde cabe cualquier acertijo
  if (ZGC.puzzleMedium && cname === "small" && typeof pzWants === "function" && pzWants(n)) cname = "medium";
  for (let k = 0; k < ZGC.tryMax; k++) {
    // si una clase grande no sale en varios intentos, se baja una (siempre sale una zona)
    const cn = k < 3 ? cname : k < 5 ? "medium" : "small";
    try {
      const m = zgBuild(n, cn, k);
      if (m) return m;
    } catch (err) {
      if (typeof console !== "undefined" && k === ZGC.tryMax - 1) console.warn("[interiores]", err);
    }
  }
  return null;
}
_x = function (n) {
  if (!ZGC.enabled) return _x_zg(n);
  const m = zgGenerate(n);
  if (m) return m;
  return _x_zg(n); // generador antiguo: la partida nunca se queda sin mapa
};

// El toolkit de las operaciones (yx) y del generador antiguo: salas «rect», «cross» y «octo» redondeadas y pasillos en curva
const _sp_zg = sp;
sp = function (n, e, t, i) {
  const s = _sp_zg(n, e, t, i);
  if (!ZGC.enabled || n.w < 90 || n.sub) return s; // los subterráneos (_x) ya no pasan por aquí; los de operaciones (98/104) sí
  const room0 = s.room.bind(s),
    corr0 = s.corridor.bind(s);
  s.room = function (a, r, o, l, c, d) {
    if (c === "blob" || c === "plaza") return room0(a, r, o, l, c, d);
    const kinds = c === "cross" ? ["cross"] : c === "octo" ? ["octo", "round"] : ["squircle", "squircle", "round", "octo", "cross"];
    let kind = kinds[Math.floor(e() * kinds.length)];
    if (o < 12 || l < 12) kind = "squircle";
    const S = { h: n, t, floor: (m, p, dk) => s.floor(m, p, dk) },
      room = zgRoom(S, e, a + o / 2, r + l / 2, o / 2, l / 2, kind, d, c);
    return room || room0(a, r, o, l, c, d);
  };
  s.corridor = function (a, r, o, l) {
    const S = { h: n, t, floor: (m, p, dk) => s.floor(m, p, dk) };
    zgTunnel(S, e, a, r, o, 0.2, l, false);
  };
  return s;
};

// aviso del tamaño al entrar (junto al cartel de siempre)
{
  const _load = ih.prototype.loadOp;
  ih.prototype.loadOp = function (e) {
    const r = _load.apply(this, arguments);
    try {
      const m = x.map;
      if (m && m.zg && e && e.sub) ee("toast", `Zona ${m.zg.name} · ${m.zg.rooms} ${m.zg.rooms === 1 ? "sala" : "salas"}`, "quest");
    } catch (err) {
      /* sin aviso */
    }
    return r;
  };
}

window.__zg = {
  cfg: ZGC,
  build: zgBuild,
  generate: zgGenerate,
  pickClass: (n) => zgClass(n, pi(zgHash("zg" + zgKey(n)))),
  hash: zgHash,
  walkSeen: () => zgWalk.seen,
  lastFail: () => (zgFail.last === 10 ? "10:" + zgFail.ent : zgBuild.why ? "walk:" + zgBuild.why.split(" ")[0] + (zgBuild.why.split(" ")[1] || "") : zgFail.last),
  cls: zgClass,
  key: zgKey,
  wants: (n) => typeof pzWants === "function" && pzWants(n),
  shapes: ZG_SHAPES,
  old: _x_zg,
};

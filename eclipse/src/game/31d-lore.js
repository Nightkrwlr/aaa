// 31d-lore.js — Lore coleccionable: libros, chips cifrados y grabaciones con voz (D5)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Todo lo nuevo vive aquí y en src/engine/lore-data.js (contenido y funciones puras, importado en _prelude.lore.js). Los ficheros
// antiguos no se tocan salvo una línea de cirugía en 32-boot.js (ver docs/frente-lore.md). Los nombres propios llevan prefijo lore / LR.
//
// Resumen de piezas:
//   1. Datos            x.cfg.lore (afinados con tools/sim/lore.mjs) + contenido en lore-data.js (70 entradas, 11 colecciones)
//   2. Guardado         S.lore = {pads, f, r, d, tr, h, c, pm, seed, o} + S.loreV (migración idempotente; conserva los registros antiguos)
//   3. API              x.loreApi = {entries, get, has, grant, decrypt, hintFor, …} + eventos 'lore', 'loreCollection', 'loreDecrypted'
//   4. Colocación       generador propio sembrado por partida (NO usa Lt/Q/Rt ni toca el RNG del mundo): anclas = props que ya existen
//   5. Nodos y mallas   estanterías, cadáveres, equipos de radio y libros sueltos (2 llamadas de dibujo por nodo cercano)
//   6. Recompensas      colecciones → punto de talento, plano de gadget, mapa revelado, botín, XP
//   7. Voz y subtítulos síntesis formántica de «radio de campaña» (WebAudio, sin red) + subtítulos sincronizados
//   8. Archivo (L)      panel con Libros / Chips / Grabaciones / Colecciones / Hitos, descifrado de chips, estilos móviles
//   9. Pruebas          window.__lore
//
// Sinergias opcionales (todas defensivas): x.hackApi (descifrado), gadgetPlanDrop / ecoGrantXp / ecoChestLoot / ecoHitosHtml,
// S.talentFx.chestSense (Instinto: pulso y puntos en el minimapa sobre los nodos), evento 'loreCollection' (TALENTOS).

// ═══ 1. DATOS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
x.cfg.lore = {
  version: 1,
  spacing: 26, // m mínimos entre nodos de una misma región (se relaja si no hay sitio)
  minGap: 6, // m que nunca se rebajan entre dos nodos de una región
  baseClear: 8, // m extra alrededor de la zona segura de la base donde no se colocan nodos
  padClear: 6, // m mínimos a un registro de datos antiguo
  anchorTries: 16, // candidatos que se miden por entrada (el más lejano de los ya colocados gana)
  safeRead: 16, // m sin enemigos vivos para abrir el lector solo al recoger un libro
  partialPerFail: 0.15, // calidad parcial que gana un chip por cada intento fallido de descifrado
  ping: { range: 13, every: 2.8, vol: 0.2 }, // «latido» de los nodos cercanos sin recoger
  opMinDist: 12, // tiles mínimos desde la entrada de una operación hasta su nodo de lore
  voice: { vol: 0.85, gap: 0.42, unit: 0.088 }, // volumen, pausa entre líneas y duración base de una vocal (s)
  kinds: {
    libro: { n: "Libro", pl: "Libros", col: 0xffb340, css: "#ffb340", ic: "▤" },
    chip: { n: "Chip de datos", pl: "Chips", col: 0x46e4ff, css: "#46e4ff", ic: "◈" },
    grab: { n: "Grabación", pl: "Grabaciones", col: 0x5dff9a, css: "#5dff9a", ic: "◉" },
  },
  where: {
    shelf: "Estantería o mobiliario de un edificio",
    body: "Restos de un caído, junto a barricadas, vehículos o huesos",
    rec: "Equipo de radio, junto a antenas, generadores o cajas",
    term: "Terminal hackeable (el aviso lleva ◈)",
    lair: "Cerca de un nido",
    op: "Dentro de una operación o mazmorra de la región",
    boss: "Se recupera al derrotar al jefe",
  },
};
const LORE_CFG = x.cfg.lore;
const LR = {
  idx: new Map(LoreEntries.map((e) => [e.id, e])),
  cur: [], // nodos de lore del mapa actual (entidades k:"lore")
  termLore: Object.create(null), // id de terminal → id de entrada
  hintCache: new Map(),
  tick: { ping: 0, sense: 0, scan: 0, badge: 0 },
  ui: { tab: "libros", sel: null },
  voice: null,
  plan: null, // última colocación (para pruebas e informes)
  log: [], // eventos emitidos (los últimos 200; solo para pruebas)
};
const loreKind = (e) => LORE_CFG.kinds[e.k || e];
const loreRegName = (r) => (typeof De !== "undefined" && De[r] ? De[r].n : LoreRegNames[r] || "");

// ═══ 2. GUARDADO ════════════════════════════════════════════════════════════════════════════════════════════════════
// S.lore pasa de ser una lista de índices (registros de datos de 16-story.js) a un objeto. Para que el código antiguo
// (takeDatapad, pestaña «Registros» del Archivo) siga funcionando sin tocarlo, el objeto lleva length / includes / push /
// indexOf NO enumerables (no viajan en el JSON) que apuntan a la lista antigua S.lore.pads.
function loreShim(L) {
  const def = (k, d) => Object.defineProperty(L, k, Object.assign({ enumerable: false, configurable: true }, d));
  def("length", { get() { return this.pads.length; } });
  def("includes", { value(v) { return this.pads.includes(v); }, writable: true });
  def("push", { value(...a) { return this.pads.push(...a); }, writable: true });
  def("indexOf", { value(v) { return this.pads.indexOf(v); }, writable: true });
}
function loreMigrate(S) {
  let L = S.lore;
  if (Array.isArray(L)) L = { pads: L.slice() };
  else if (!L || typeof L !== "object") L = { pads: [] };
  if (!Array.isArray(L.pads)) L.pads = [];
  for (const k of ["f", "r", "d", "tr", "h", "c", "pm"]) if (!L[k] || typeof L[k] !== "object" || Array.isArray(L[k])) L[k] = {};
  L.o = Object.assign({ voice: "radio", subs: true, auto: true }, L.o && typeof L.o === "object" ? L.o : {});
  if (!(L.seed >>> 0)) L.seed = LoreHash(String(S.created || 0) + "|" + String(S.name || "") + "|lore");
  loreShim(L);
  S.lore = L;
  S.loreV = 1;
}
x.migrations.push(loreMigrate);
/** S.lore garantizado (la partida de arranque de uS() nace con kp() sin pasar por la migración) */
function loreS() {
  const S = x.S;
  if (!S) return null;
  const L = S.lore;
  if (!L || typeof L.includes !== "function" || Array.isArray(L) || S.loreV !== 1) loreMigrate(S);
  return S.lore;
}

// ═══ 3. ESTADO DE LAS ENTRADAS Y API ═══════════════════════════════════════════════════════════════════════════════
const loreFound = (id) => !!loreS().f[id];
const loreQ = (id) => loreS().d[id] || 0;
/** ¿se puede leer/escuchar completa? (los chips piden calidad 1) */
function loreReadable(id) {
  const e = LR.idx.get(id), L = loreS();
  return !!(e && L && L.f[id] && (e.k !== "chip" || (L.d[id] || 0) >= 1));
}
function loreHintFor(clave, opts) {
  const L = loreS(), seed = L ? L.seed : 0;
  const reg = LoreHints[clave];
  const spec = reg || (opts && (opts.kind || opts.len) ? { kind: opts.kind, len: opts.len } : null);
  const key = seed + "|" + clave + "|" + (spec ? spec.kind + "," + spec.len : "");
  let h = LR.hintCache.get(key);
  if (!h) LR.hintCache.set(key, (h = LoreHintValue(seed, clave, spec)));
  const entry = reg ? reg.entry : null;
  const known = !!(L && (L.h[clave] || (entry && loreReadable(entry))));
  return Object.assign({}, h, { entry, known, what: reg ? reg.what : "", text: "Anotado: " + h.display });
}
/** Anota una pista en el Archivo (idempotente). Devuelve la pista. */
function loreRevealHint(clave, quiet) {
  const L = loreS(), h = loreHintFor(clave);
  if (L && !L.h[clave]) {
    L.h[clave] = 1;
    quiet || ee("toast", `Pista anotada${h.what ? " · " + h.what : ""}: ${h.display}`, "quest");
    ee("save");
  }
  return h;
}
const loreText = (e) => LoreFill(e.txt || "", (k) => loreHintFor(k).display);
const loreLines = (e) => (e.lines || []).map(([who, t]) => [who, LoreFill(t, (k) => loreHintFor(k).display)]);
/** Anota las pistas de puzle citadas por una entrada legible */
function loreNoteHints(e) {
  for (const k of LoreHintKeys(LoreEntryText(e))) loreRevealHint(k);
}
function loreGet(id) {
  const e = LR.idx.get(id), L = loreS();
  if (!e || !L) return null;
  const readable = loreReadable(id);
  return {
    id, k: e.k, reg: e.reg, t: e.t, a: e.a, w: e.w, th: e.th || null, boss: e.boss || null, secret: !!e.secret, d: e.d || 0,
    found: !!L.f[id], read: !!L.r[id], q: L.d[id] || 0, readable,
    text: readable && e.k !== "grab" ? loreText(e) : null, lines: readable && e.k === "grab" ? loreLines(e) : null,
  };
}
/** Marca una entrada como hallada y la presenta (evento «lore»). Devuelve false si ya la tenías. */
function loreGrant(id, o = {}) {
  const e = LR.idx.get(id), L = loreS();
  if (!e || !L || L.f[id]) return false;
  L.f[id] = Math.max(1, Math.round((x.S.playTime || 0) / 60));
  loreDropNode(id);
  ee("lore", { lid: id, t: e.t, a: e.a, txt: "", reg: e.reg, k: e.k, quiet: !!o.quiet, src: o.src || "api" }, true);
  loreCheckCols();
  loreBadge();
  ee("save");
  return true;
}
/** Descifra un chip. calidad: true/1 completo, 0..1 parcial, false/0 fallo. Idempotente (gana la mejor calidad). */
function loreDecrypt(id, calidad) {
  const e = LR.idx.get(id), L = loreS();
  if (!e || !L) return { ok: false, q: 0, entry: null };
  if (e.k !== "chip") return { ok: true, q: 1, entry: loreGet(id) };
  let q = calidad === undefined || calidad === true ? 1 : calidad === false || calidad == null ? 0 : +calidad;
  q = q >= 0 ? Math.min(1, q) : 0;
  if (!L.f[id]) loreGrant(id, { quiet: true, src: "decrypt" });
  const prev = L.d[id] || 0;
  if (q < 0.995) L.tr[id] = (L.tr[id] | 0) + 1;
  if (q > prev) L.d[id] = q >= 0.995 ? 1 : q;
  const now = L.d[id] || 0;
  if (now > prev) {
    ee("loreDecrypted", id, now);
    if (now >= 1) { ee("toast", `Chip descifrado · ${e.t}`, "good"); ae.play("success"); }
  }
  if (now >= 1) loreCheckCols();
  loreBadge();
  ee("save");
  return { ok: now >= 1, q: now, entry: loreGet(id) };
}
function loreMarkRead(id) {
  const e = LR.idx.get(id), L = loreS();
  if (!e || !L || !L.f[id]) return;
  if (loreReadable(id)) loreNoteHints(e);
  if (!L.r[id] && loreReadable(id)) { L.r[id] = 1; loreBadge(); ee("save"); }
}
const loreUnread = () => {
  const L = loreS();
  let n = 0;
  if (L) for (const id in L.f) if (!L.r[id] && loreReadable(id)) n++; // un chip cifrado no cuenta como novedad hasta descifrarlo
  return n;
};
function loreProgress(colId) {
  const c = LoreCols.find((k) => k.id === colId);
  if (!c) return null;
  const m = LoreMembers(c), have = m.filter((e) => loreReadable(e.id)).length;
  return { id: c.id, n: c.n, have, total: m.length, done: !!loreS().c[c.id], members: m.map((e) => e.id) };
}
/** Siguiente entrada sin hallar (opcionalmente de un tipo y una región): para recompensas de hackeo y puzles */
function loreNext(kind, reg) {
  const L = loreS(), e = LoreEntries.find((en) => (!kind || en.k === kind) && (reg == null || en.reg === reg) && !L.f[en.id] && en.w !== "boss");
  return e ? e.id : null;
}
x.loreApi = {
  version: 1,
  entries: LoreEntries,
  collections: LoreCols,
  vocab: { glyphs: LoreGlyphs, colors: LoreColors, dirs: LoreDirs, words: LoreWords }, // nombres de las secuencias que devuelve hintFor
  next: loreNext,
  pendingChips: () => LoreEntries.filter((e) => e.k === "chip" && loreFound(e.id) && !loreReadable(e.id)).map((e) => e.id),
  get: loreGet,
  has: (id) => loreFound(id),
  readable: loreReadable,
  grant: (id, o) => loreGrant(id, o),
  decrypt: loreDecrypt,
  hintFor: loreHintFor,
  reveal: (clave) => loreRevealHint(clave),
  progress: loreProgress,
  open: (tab, id) => loreOpenArchive(tab, id),
  play: (id) => loreVoicePlay(id),
  stop: () => loreVoiceStop(),
  speak: (t, who, o) => ae.speak(t, who, o), // voz sintetizada para cualquier frase (hablantes en .voices)
  voices: LoreVoices,
};

// ═══ 4. RECOMPENSAS DE COLECCIÓN ═══════════════════════════════════════════════════════════════════════════════════
function loreLvl() {
  try {
    return x.mode === "op" && x.op ? x.op.lvl : x.world.lvlAt(x.player.x, x.player.z);
  } catch (e) {
    return x.S.lvl || 1;
  }
}
/** Revela el mapa de una región (reg) o de todo el mundo ('all'). En una operación queda pendiente hasta volver al mundo. */
function loreRevealMap(which) {
  const w = x.world, L = loreS();
  if (x.mode !== "world" || !w || !w.fogBits || !x.map) {
    L.pm[which] = 1;
    return false;
  }
  const m = x.map, fw = w.fogW;
  for (let cz = 0; cz < fw; cz++)
    for (let cx = 0; cx < fw; cx++) {
      if (which !== "all" && m.regAt(cx * 2 + 1, cz * 2 + 1) !== which) continue;
      const i = cz * fw + cx;
      w.fogBits[i >> 3] |= 1 << (i & 7);
    }
  delete L.pm[which];
  return true;
}
function loreGiveGadgetPlan(tier) {
  if (typeof gadgetPlanDrop !== "function") return null;
  const gp = x.cfg.gadgets && x.cfg.gadgets.plan;
  if (!gp) return null;
  const key = "lore" + tier;
  if (!gp[key]) gp[key] = { p: 1, tier };
  const plan = gadgetPlanDrop(key);
  if (plan) {
    ee("gadgetPlanDrop", plan, { x: x.player.x, z: x.player.z }, "lore");
    ee("toast", `Plano de gadget obtenido · ${plan.name || plan.gadget}`, "quest");
  }
  return plan;
}
function loreReward(c) {
  const R = c.rew || {}, p = x.player, lvl = loreLvl(), out = [];
  if (R.tp) { ee("loreCollection", c.id, c.n); out.push("punto de talento"); }
  if (R.plan) {
    const plan = loreGiveGadgetPlan(R.plan);
    if (plan) out.push("plano de gadget");
    else {
      // sin frente de gadgets (o todos aprendidos): créditos equivalentes
      Nt("cr", p.x, p.z, { val: Math.round(60 * (1 + lvl * 0.3) * R.plan) });
      out.push("créditos");
    }
  }
  if (R.map != null) { loreRevealMap(R.map === "reg" ? c.rule.reg : "all"); out.push(R.map === "all" ? "mapa completo" : "mapa de la región"); }
  if (R.loot) {
    typeof ecoChestLoot === "function" ? ecoChestLoot(p.x, p.z, R.loot, lvl, { src: "secret" }) : Co(p.x, p.z, R.loot, lvl);
    out.push("botín");
  }
  if (R.mats) {
    const S = x.S;
    for (const k in R.mats) S.mats[k] = (S.mats[k] || 0) + R.mats[k];
    out.push("materiales");
    ee("res");
  }
  if (R.xp) typeof ecoGrantXp === "function" ? ecoGrantXp(R.xp, "colección") : p.addXp(R.xp * mt.xpToNext(x.S.lvl));
  oa("Colección completada", c.n, "#ffd447");
  la(`Colección «${c.n}»: ${out.join(", ")}`, "quest");
  ae.play("legend");
  x.fx.ring(p.x, p.z, 4, 16766023, 0.9);
  ee("save", true);
}
function loreCheckCols() {
  const L = loreS();
  if (!L) return;
  for (const c of LoreCols) {
    if (L.c[c.id]) continue;
    if (LoreMembers(c).every((e) => loreReadable(e.id))) {
      L.c[c.id] = 1;
      loreReward(c);
    }
  }
}

// ═══ 5. COLOCACIÓN EN EL MUNDO ═════════════════════════════════════════════════════════════════════════════════════
// Las anclas son props que YA existen en el mapa (mesas, camas, taquillas, antenas, sacos de arena, huesos…). Un generador propio
// (LoreRng, mismo algoritmo que pi() pero con su propia semilla) reparte las entradas por esas anclas: nunca llama a Lt/Q/Rt/Yt
// ni modifica terreno, props ni el resto de entidades. Misma partida (S.lore.seed) → mismas posiciones.
const LORE_CLS = {
  table: ["shelf"], bed: ["shelf"], locker: ["shelf", "body"], computer: ["shelf", "rec"], jar: ["shelf"], paper: ["shelf"],
  tent: ["body", "shelf"], sandbags: ["body"], car: ["body"], tank_wreck: ["body"], bones: ["body"], skull: ["body"],
  rubble: ["body"], barrel: ["body"], egg: ["body"], pod: ["body"],
  antenna: ["rec"], generator: ["rec"], radar: ["rec"], tower: ["rec"], crates: ["rec", "body"], crate: ["rec"], container: ["rec"],
};
/** Casillas alcanzables desde el punto de partida (las puertas de región cuentan como abiertas; el agua, la lava y la roca no) */
function loreReach(map) {
  if (map._loreReach) return map._loreReach;
  const w = map.w, n = w * map.h, seen = new Uint8Array(n), q = new Int32Array(n);
  const pass = (i) => {
    const t = map.ter[i];
    return t === F.GATE || (Ua[t] !== 1 && map.blk[i] !== 1);
  };
  const s0 = Math.floor(map.spawnBase[1]) * w + Math.floor(map.spawnBase[0]);
  let h = 0, t = 0;
  seen[s0] = 1;
  q[t++] = s0;
  while (h < t) {
    const i = q[h++], cx = i % w;
    if (cx > 0 && !seen[i - 1] && pass(i - 1)) { seen[i - 1] = 1; q[t++] = i - 1; }
    if (cx < w - 1 && !seen[i + 1] && pass(i + 1)) { seen[i + 1] = 1; q[t++] = i + 1; }
    if (i >= w && !seen[i - w] && pass(i - w)) { seen[i - w] = 1; q[t++] = i - w; }
    if (i < n - w && !seen[i + w] && pass(i + w)) { seen[i + w] = 1; q[t++] = i + w; }
  }
  return (map._loreReach = seen);
}
function loreScanAnchors(map) {
  if (map._loreAnch) return map._loreAnch;
  const A = { shelf: [], body: [], rec: [], lair: [], term: [], any: [] };
  for (const k in A) for (let r = 0; r < 9; r++) A[k][r] = [];
  loreReach(map);
  for (const list of [map.props, map.decor])
    for (const p of list) {
      const cls = LORE_CLS[p.t];
      if (!cls) continue;
      const r = map.regAt(p.x, p.z);
      if (r < 0 || r > 8) continue;
      const a = { x: p.x, z: p.z, t: p.t };
      for (const c of cls) A[c][r].push(a);
      A.any[r].push(a);
    }
  for (const e of map.ents) {
    const r = map.regAt(e.x, e.z);
    if (r < 0 || r > 8) continue;
    if (e.k === "nest") A.lair[r].push({ x: e.x, z: e.z, t: "nest" });
    else if (e.k === "terminal" && (e.eff === "secret" || e.eff === "relay" || e.eff === "cache")) A.term[r].push({ x: e.x, z: e.z, t: "terminal", ent: e });
  }
  return (map._loreAnch = A);
}
/** Busca un hueco libre y alcanzable cerca de (ax,az). Las estanterías necesitan una pared a la espalda; si no la hay → libro suelto. */
function loreSpot(map, ax, az, form, rng, reg, radOverride) {
  const reach = loreReach(map), w = map.w;
  const shelf = form === "shelf", rad = radOverride || (shelf ? 1.9 : form === "body" ? 1.5 : 1.2);
  let loose = null;
  for (let k = 0; k < (shelf ? 40 : 18); k++) {
    const a = rng() * 6.2832, r = rad * (0.4 + 1.1 * rng());
    let px = ax + Math.cos(a) * r, pz = az + Math.sin(a) * r;
    if (map.regAt(px, pz) !== reg) continue;
    if (map.circleHits(px, pz, shelf ? 0.62 : 0.45)) continue;
    if (reach[Math.floor(pz) * w + Math.floor(px)] !== 1) continue;
    const ang = rng() * 6.2832;
    if (!shelf) return { x: px, z: pz, ang, form };
    // estantería: necesita una pared a la espalda; el primer hueco sin pared queda de respaldo como libro suelto
    let wall = -1;
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let d = 0; d < 4; d++) if (map.solidAt(Math.floor(px + D[d][0] * 0.95), Math.floor(pz + D[d][1] * 0.95))) { wall = d; break; }
    if (wall < 0) { loose || (loose = { x: px, z: pz, ang, form: "book" }); continue; }
    const sx = px + D[wall][0] * 0.24, sz = pz + D[wall][1] * 0.24;
    if (map.circleHits(sx, sz, 0.5)) { loose || (loose = { x: px, z: pz, ang, form: "book" }); continue; }
    return { x: sx, z: sz, ang: Math.atan2(-D[wall][0], -D[wall][1]), form: "shelf" };
  }
  return loose;
}
function loreRandomSpot(map, reg, rng, form) {
  const reach = loreReach(map), w = map.w;
  for (let k = 0; k < 400; k++) {
    const px = 2 + rng() * (w - 4), pz = 2 + rng() * (map.h - 4);
    if (map.regAt(px, pz) !== reg || reach[Math.floor(pz) * w + Math.floor(px)] !== 1 || map.circleHits(px, pz, 0.5)) continue;
    const b = map.pois.base;
    if (b && Math.hypot(px - b.x, pz - b.z) < b.r + LORE_CFG.baseClear) continue;
    return { x: px, z: pz, ang: rng() * 6.2832, form: form === "shelf" ? "book" : form };
  }
  return null;
}
const loreFormOf = (e, w) => (w === "shelf" ? "shelf" : w === "rec" ? "rec" : "body");
function loreNodeEnt(e, s) {
  return { k: "lore", id: "lo:" + e.id, x: s.x, z: s.z, ang: s.ang, form: s.form, lid: e.id, kind: e.k, reg: e.reg };
}
/** Quita de map.ents los nodos de lore anteriores y devuelve cuántos había */
function loreClearNodes(map) {
  let n = 0;
  for (let i = map.ents.length - 1; i >= 0; i--) if (map.ents[i].k === "lore") { map.ents.splice(i, 1); n++; }
  return n;
}
/**
 * Coloca TODAS las entradas de mundo (también las ya halladas, para que las demás no cambien de sitio) y crea el nodo de las que faltan.
 * Devuelve el informe de colocación (nodos, anclas usadas por clase, entradas que han caído al respaldo aleatorio).
 */
function loreBuildWorld(map) {
  const L = loreS(), cfg = LORE_CFG, seed = L.seed;
  loreClearNodes(map);
  LR.termLore = Object.create(null);
  const A = loreScanAnchors(map), used = new Set(), report = { placed: [], fallback: [], byForm: {}, seed };
  const pads = map.ents.filter((e) => e.k === "datapad");
  const base = map.pois.base;
  const okAnchor = (a, placed, spacing) => {
    if (base && Math.hypot(a.x - base.x, a.z - base.z) < base.r + cfg.baseClear) return -1;
    for (const p of pads) if (Math.abs(p.x - a.x) < cfg.padClear && Math.abs(p.z - a.z) < cfg.padClear && Math.hypot(p.x - a.x, p.z - a.z) < cfg.padClear) return -1;
    let d = 1e9;
    for (const p of placed) { const dd = Math.hypot(p.x - a.x, p.z - a.z); if (dd < d) d = dd; }
    return d < spacing ? -1 : d;
  };
  for (let reg = 0; reg < 9; reg++) {
    const placed = [];
    const list = LoreEntries.filter((e) => e.reg === reg && e.w !== "op" && e.w !== "boss").sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const e of list) {
      const rng = LoreRng(LoreHash(seed + "|" + e.id));
      let spot = null, cls = e.w, tent = null;
      // terminal → si no quedan, cae a equipo de radio
      if (cls === "term") {
        // la terminal elegida respeta la separación con lo ya colocado (se relaja si no hay otra)
        let pool = [];
        for (const spacing of [cfg.spacing, cfg.spacing * 0.5, cfg.minGap]) {
          pool = A.term[reg].filter((a) => !used.has(a) && okAnchor(a, placed, spacing) >= 0);
          if (pool.length) break;
        }
        if (pool.length) {
          const a = pool[Math.floor(rng() * pool.length)];
          used.add(a);
          LR.termLore[a.ent.id] = e.id;
          placed.push(a);
          report.placed.push({ id: e.id, w: "term", x: a.x, z: a.z, reg, ent: a.ent.id });
          report.byForm.term = (report.byForm.term || 0) + 1;
          continue;
        }
        cls = "rec";
      }
      const order = cls === "lair" ? ["lair", "body", "any"] : cls === "shelf" ? ["shelf", "any"] : cls === "body" ? ["body", "any"] : ["rec", "shelf", "body", "any"];
      for (const c of order) {
        for (const spacing of [cfg.spacing, cfg.spacing * 0.5, cfg.minGap]) {
          let best = null, bd = -1;
          const arr = A[c][reg];
          for (let k = 0; k < cfg.anchorTries && arr.length; k++) {
            const a = arr[Math.floor(rng() * arr.length)];
            if (used.has(a)) continue;
            const d = okAnchor(a, placed, spacing);
            if (d > bd) { bd = d; best = a; }
          }
          if (best) {
            const s = loreSpot(map, best.x, best.z, e.w === "lair" ? "body" : loreFormOf(e, e.w), rng, reg, best.t === "nest" ? 4.6 : 0);
            // el sitio final (desplazado respecto al ancla) también guarda la distancia mínima con lo colocado
            if (s && placed.every((p) => Math.hypot(p.x - s.x, p.z - s.z) >= cfg.minGap)) { spot = s; tent = best; used.add(best); break; }
            used.add(best);
          }
        }
        if (spot) break;
      }
      if (!spot) {
        spot = loreRandomSpot(map, reg, rng, loreFormOf(e, e.w));
        report.fallback.push(e.id);
      }
      if (!spot) continue;
      placed.push(spot);
      report.byForm[spot.form] = (report.byForm[spot.form] || 0) + 1;
      report.placed.push({ id: e.id, w: spot.form, x: +spot.x.toFixed(1), z: +spot.z.toFixed(1), reg, anchor: tent ? tent.t : "azar" });
      if (!L.f[e.id]) map.ents.push(loreNodeEnt(e, spot));
    }
  }
  LR.cur = map.ents.filter((e) => e.k === "lore");
  LR.plan = report;
  return report;
}
/** Una operación o mazmorra recién generada: un nodo de lore (si queda alguna entrada sin hallar para esa región y ese tema) */
function loreBuildOp(map) {
  const L = loreS(), op = map.op;
  if (!L || !op || map.kind !== "op") return null;
  const reg = op.reg ?? 0, theme = map.theme;
  const e = LoreEntries.find((en) => en.w === "op" && en.reg === reg && !L.f[en.id] && en.themes.includes(theme));
  loreClearNodes(map);
  LR.cur = [];
  if (!e) return null;
  // casillas a distancia razonable de la entrada, por BFS sobre suelo
  const w = map.w, n = w * map.h, dist = new Int16Array(n).fill(-1), q = new Int32Array(n);
  const s0 = Math.floor(map.spawnBase[1]) * w + Math.floor(map.spawnBase[0]);
  let h = 0, t = 0;
  dist[s0] = 0;
  q[t++] = s0;
  const cand = [];
  while (h < t) {
    const i = q[h++], cx = i % w, d = dist[i];
    if (d >= LORE_CFG.opMinDist && d <= 70 && (cx & 1) === 0 && (((i / w) | 0) & 1) === 0) cand.push(i);
    for (const j of [i - 1, i + 1, i - w, i + w]) {
      if (j < 0 || j >= n || dist[j] >= 0) continue;
      if ((j === i - 1 && cx === 0) || (j === i + 1 && cx === w - 1)) continue;
      if (map.ter[j] === undefined || Ua[map.ter[j]] === 1 || map.blk[j] === 1) continue;
      dist[j] = d + 1;
      q[t++] = j;
    }
  }
  if (!cand.length) return null;
  const rng = LoreRng(LoreHash(L.seed + "|op|" + op.seed + "|" + e.id));
  for (let k = 0; k < 40; k++) {
    const i = cand[Math.floor(rng() * cand.length)], px = (i % w) + 0.5, pz = ((i / w) | 0) + 0.5;
    if (map.circleHits(px, pz, 0.5)) continue;
    const form = e.k === "libro" ? "book" : e.k === "grab" ? "rec" : "body";
    const ent = loreNodeEnt(e, { x: px, z: pz, ang: rng() * 6.2832, form });
    ent.op = true;
    map.ents.push(ent);
    LR.cur = [ent];
    return ent;
  }
  return null;
}
function loreDropNode(id) {
  const w = x.world;
  for (let i = LR.cur.length - 1; i >= 0; i--) {
    const en = LR.cur[i];
    if (en.lid !== id) continue;
    LR.cur.splice(i, 1);
    if (x.map) { const j = x.map.ents.indexOf(en); j >= 0 && x.map.ents.splice(j, 1); }
    if (w && w.rt) {
      const r = w.rt.get(en.id);
      if (r) { w.removeMesh(r); w.rt.delete(en.id); }
    }
  }
}

// ═══ 6. MALLAS DE LOS NODOS ═════════════════════════════════════════════════════════════════════════════════════════
// Una geometría fusionada con color de vértice por forma (estantería, libro, radio, caído por región) y un haz aditivo del color del
// tipo: 2 llamadas de dibujo por nodo dentro del radio de creación (42 m), sin luces ni sombras propias.
const LORE_MAT = new Xt({ vertexColors: true, roughness: 0.86, metalness: 0.04, flatShading: true });
const loreGeoCache = new Map();
function loreBoxG(w, h, d, px, py, pz, col, rot) {
  const g = new kn(w, h, d);
  if (rot) { rot[0] && g.rotateX(rot[0]); rot[1] && g.rotateY(rot[1]); rot[2] && g.rotateZ(rot[2]); }
  g.translate(px, py, pz);
  const c = new Ee(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new St(a, 3));
  return g;
}
function loreShelfG() {
  const P = [], wood = 0x6a4a2e, dark = 0x4a3220, rng = LoreRng(1717);
  const pal = [0x8a2a2a, 0x2a4a7a, 0x3a6a3a, 0xc9a040, 0x5a3a6a, 0xb06a3a, 0x2f2f38, 0x9aa0a8, 0x7a5a3a];
  P.push(loreBoxG(1.0, 1.7, 0.04, 0, 0.85, -0.17, dark), loreBoxG(0.05, 1.7, 0.38, -0.475, 0.85, 0, wood), loreBoxG(0.05, 1.7, 0.38, 0.475, 0.85, 0, wood));
  for (const y of [0.03, 0.42, 0.81, 1.2, 1.68]) P.push(loreBoxG(0.95, 0.04, 0.36, 0, y, 0, wood));
  for (const y0 of [0.05, 0.44, 0.83, 1.22]) {
    let xx = -0.42;
    while (xx < 0.4) {
      const bw = 0.04 + rng() * 0.04, bh = 0.24 + rng() * 0.1, lean = rng() < 0.12 ? 0.25 : 0;
      P.push(loreBoxG(bw, bh, 0.24 + rng() * 0.06, xx + bw / 2, y0 + bh / 2 + 0.02, 0.02, pal[Math.floor(rng() * pal.length)], lean ? [0, 0, lean] : null));
      xx += bw + 0.004 + (rng() < 0.1 ? 0.06 : 0);
    }
  }
  return Ld(P);
}
function loreBookG() {
  return Ld([
    loreBoxG(0.3, 0.05, 0.22, 0, 0.025, 0, 0x8a2a2a, [0, 0.2, 0]),
    loreBoxG(0.26, 0.045, 0.2, 0.01, 0.07, 0.01, 0x2a4a7a, [0, -0.3, 0]),
    loreBoxG(0.22, 0.04, 0.17, -0.01, 0.113, 0, 0xc9a040, [0, 0.5, 0]),
    loreBoxG(0.26, 0.015, 0.34, 0.36, 0.01, 0.1, 0xe8e0c8, [0, 0.4, 0]),
    loreBoxG(0.2, 0.004, 0.015, 0.36, 0.02, 0.1, 0x403828, [0, 0.4, 0]),
  ]);
}
function loreRecG() {
  return Ld([
    loreBoxG(0.62, 0.14, 0.42, 0, 0.07, 0, 0x6a5a3a), // caja que hace de mesa
    loreBoxG(0.5, 0.24, 0.3, 0, 0.26, 0, 0x4a5a3a), // radio
    loreBoxG(0.46, 0.2, 0.02, 0, 0.26, 0.155, 0x22281c),
    loreBoxG(0.07, 0.07, 0.03, -0.14, 0.29, 0.17, 0xd8d0b0),
    loreBoxG(0.07, 0.07, 0.03, 0.0, 0.29, 0.17, 0xd8d0b0),
    loreBoxG(0.14, 0.012, 0.02, 0.15, 0.31, 0.17, 0x14180f),
    loreBoxG(0.14, 0.012, 0.02, 0.15, 0.27, 0.17, 0x14180f),
    loreBoxG(0.14, 0.012, 0.02, 0.15, 0.23, 0.17, 0x14180f),
    loreBoxG(0.3, 0.02, 0.04, 0, 0.4, 0, 0x2a2e22),
    loreBoxG(0.012, 0.8, 0.012, -0.2, 0.78, -0.08, 0x9aa0a8, [0, 0, 0.12]),
    loreBoxG(0.1, 0.012, 0.16, 0.24, 0.145, 0.1, 0xe8e0c8, [0, 0.3, 0]),
  ]);
}
const LORE_BODY_PAL = [
  [0x56603c, 0x3c4630], [0x2a3550, 0x20283c], [0x9a8a5e, 0x7a6c48], [0x4a5a3a, 0x3a4a2e], [0xdfe4e8, 0xb8c0c8],
  [0x5a6068, 0x40464e], [0xc0602a, 0x903f1c], [0xb0a640, 0x8c8430], [0x6a7a62, 0x50604a],
];
function loreBodyG(reg) {
  const [suit, hel] = LORE_BODY_PAL[reg] || LORE_BODY_PAL[0], skin = 0xb89c86, boot = 0x2a2a2a;
  return Ld([
    loreBoxG(0.52, 0.004, 0.62, 0, 0.003, 0.05, 0x3a1210), // mancha
    loreBoxG(0.36, 0.18, 0.5, 0, 0.1, 0, suit),
    loreBoxG(0.38, 0.05, 0.14, 0, 0.11, -0.1, 0x2a2a22),
    loreBoxG(0.2, 0.17, 0.22, 0.02, 0.1, 0.38, skin),
    loreBoxG(0.25, 0.1, 0.27, 0.02, 0.2, 0.39, hel),
    loreBoxG(0.14, 0.13, 0.55, -0.1, 0.07, -0.52, suit, [0, 0.08, 0]),
    loreBoxG(0.14, 0.13, 0.55, 0.12, 0.07, -0.5, suit, [0, -0.12, 0]),
    loreBoxG(0.15, 0.11, 0.2, -0.11, 0.06, -0.86, boot, [0, 0.08, 0]),
    loreBoxG(0.15, 0.11, 0.2, 0.15, 0.06, -0.84, boot, [0, -0.12, 0]),
    loreBoxG(0.1, 0.1, 0.42, -0.3, 0.08, 0.18, suit, [0, 0.35, 0]),
    loreBoxG(0.1, 0.1, 0.4, 0.3, 0.08, 0.05, suit, [0, -0.5, 0]),
    loreBoxG(0.06, 0.06, 0.95, 0.48, 0.04, 0.05, 0x2a2a30, [0, 0.15, 0]),
  ]);
}
function loreFormGeo(form, reg) {
  const key = form === "body" ? "body" + reg : form;
  let g = loreGeoCache.get(key);
  if (!g) {
    g = form === "shelf" ? loreShelfG() : form === "book" ? loreBookG() : form === "rec" ? loreRecG() : loreBodyG(reg);
    loreGeoCache.set(key, g);
  }
  return g;
}
const LORE_BEAM = { shelf: 2.7, book: 2.3, rec: 2.5, body: 2.1 };
function loreCreateMesh(world, r) {
  const ent = r.e;
  if (r.mesh || loreFound(ent.lid)) return;
  const grp = new Ve(), body = new Ge(loreFormGeo(ent.form, ent.reg), LORE_MAT), col = LORE_CFG.kinds[ent.kind].col, bh = LORE_BEAM[ent.form] || 2.3;
  body.castShadow = false;
  body.receiveShadow = false;
  grp.add(body);
  const beam = new Ge(je(0.085, 0.085, bh, 8), Me(col, 0.26, true));
  beam.position.y = bh / 2 + 0.1;
  grp.add(beam);
  const spark = { color: col, speed: 0.35, life: 1.3, size: 0.1, up: 0.55 }, ph = (ent.x * 7 + ent.z * 13) % 6.28;
  grp.userData = {
    k: "lore",
    anim: [
      (t) => {
        const s = 0.85 + 0.3 * Math.sin(t * 2.2 + ph);
        beam.scale.set(s, 1, s);
        Math.random() < 0.025 && x.fx.burst(ent.x, 0.3 + Math.random() * bh * 0.7, ent.z, 1, spark);
      },
    ],
  };
  grp.position.set(ent.x, 0, ent.z);
  grp.rotation.y = ent.ang || 0;
  ent.form !== "shelf" && grp.scale.setScalar(1.18); // los objetos pequeños se leen mejor con la cámara alejada y en pantallas pequeñas
  r.mesh = grp;
  x.R.scene.add(grp);
}
function lorePrompt(ent) {
  if (loreFound(ent.lid)) return null;
  switch (ent.form) {
    case "shelf": return "Hojear la estantería";
    case "book": return ent.kind === "libro" ? "Recoger libro" : "Recoger documento";
    case "rec": return ent.kind === "grab" ? "Escuchar la grabación" : "Recoger el equipo de radio";
    default: return "Registrar al caído";
  }
}
function lorePickNode(world, r) {
  const ent = r.e;
  if (loreFound(ent.lid)) return;
  const k = LORE_CFG.kinds[ent.kind];
  x.fx.burst(ent.x, 0.7, ent.z, 16, { color: k.col, speed: 3.2, life: 0.7, size: 0.2, up: 1 });
  x.fx.ring(ent.x, ent.z, 1.8, k.col, 0.7);
  ae.play("item");
  loreGrant(ent.lid, { src: "world" });
}

// ═══ 7. ENGANCHES EN EL DIRECTOR DEL MUNDO (26-spawner) Y EN EL BUCLE ═══════════════════════════════════════════════
// Todo por envoltorio de métodos del prototipo: ningún fichero antiguo cambia.
(function () {
  const P = ih.prototype;
  const _create = P.createMesh, _prompt = P.promptFor, _interact = P.interact, _hack = P.hackResult, _loadW = P.loadWorld, _loadO = P.loadOp;
  P.createMesh = function (r) {
    return r.e.k === "lore" ? loreCreateMesh(this, r) : _create.apply(this, arguments);
  };
  P.promptFor = function (e, t) {
    if (e.k === "lore") return lorePrompt(e);
    const s = _prompt.apply(this, arguments);
    // terminal con un archivo guardado: «◈» al final del aviso
    return s && e.k === "terminal" && LR.termLore[e.id] && !loreFound(LR.termLore[e.id]) ? s + " ◈" : s;
  };
  P.interact = function () {
    const p = x.prompt;
    if (p && p.r && p.r.e && p.r.e.k === "lore") return lorePickNode(this, p.r);
    return _interact.apply(this, arguments);
  };
  P.hackResult = function (e, t, ok) {
    const r = _hack.apply(this, arguments);
    const id = ok && x.mode === "world" ? LR.termLore[e.id] : null;
    if (id && !loreFound(id)) loreGrant(id, { src: "term" });
    return r;
  };
  P.loadWorld = function () {
    try {
      Po || (Po = vx());
      const L = loreS();
      if (Po._loreOwner !== x.S || Po._loreSeed !== L.seed) {
        loreBuildWorld(Po);
        Po._loreOwner = x.S;
        Po._loreSeed = L.seed;
      } else LR.cur = Po.ents.filter((en) => en.k === "lore");
    } catch (err) {
      LR.cur = [];
      console.warn("[lore] colocación", err);
    }
    const r = _loadW.apply(this, arguments);
    lorePendingMaps();
    return r;
  };
  P.loadOp = function () {
    const r = _loadO.apply(this, arguments);
    try {
      loreBuildOp(x.map);
    } catch (err) {
      LR.cur = [];
      console.warn("[lore] operación", err);
    }
    return r;
  };
})();
function lorePendingMaps() {
  const L = loreS();
  if (!L) return;
  for (const k in L.pm) loreRevealMap(k === "all" ? "all" : +k);
}
// Expedientes de jefe: «quién fue». Se recuperan al abatir al jefe (principal o secreto), no a los minijefes ni a los de operación.
It("bossKilled", (b) => {
  if (!b || b.mini || (b.arena && b.arena.op)) return;
  const e = LoreEntries.find((en) => en.boss === b.id);
  if (!e || loreFound(e.id)) return;
  loreGrant(e.id, { src: "boss" });
});
// Latido de los nodos cercanos, puntos en el minimapa con Instinto y marca de novedades en el botón ARCH.
function loreScan() {
  const T = LR.tick, p = x.player, L = loreS();
  if (!p || !L) return;
  let near = 1e9;
  const R2 = LORE_CFG.ping.range * LORE_CFG.ping.range;
  for (let i = 0; i < LR.cur.length; i++) {
    const o = LR.cur[i], dx = o.x - p.x, dz = o.z - p.z, d2 = dx * dx + dz * dz;
    if (d2 < near) near = d2;
  }
  LR.near = near < R2 ? Math.sqrt(near) : null;
  const fx = x.S.talentFx;
  if (fx && fx.chestSense > 0) {
    T.sense -= 0.35;
    if (T.sense <= 0) {
      T.sense = 2.2;
      const s2 = fx.chestSense * fx.chestSense;
      for (let i = 0; i < LR.cur.length; i++) {
        const o = LR.cur[i], dx = o.x - p.x, dz = o.z - p.z;
        dx * dx + dz * dz < s2 && x.fx.ring(o.x, o.z, 1.6, LORE_CFG.kinds[o.kind].col, 1.1);
      }
    }
  }
}
x.tick.push((dt) => {
  if (!x.started || !x.player || x.mode === "menu") return;
  const T = LR.tick;
  T.scan -= dt;
  if (T.scan <= 0) {
    T.scan = 0.35;
    loreScan();
    T.ping -= 0.35;
    if (LR.near != null && T.ping <= 0) {
      const c = LORE_CFG.ping, k = LR.near / c.range;
      T.ping = c.every * (0.45 + 0.55 * k);
      ae.play("beep", { p: 1.7 + (1 - k) * 1.1, v: c.vol, gap: 0.25 });
    }
  }
  T.badge -= dt;
  if (T.badge <= 0) {
    T.badge = 1;
    loreBadge();
  }
});
let loreBadgeEl = null;
function loreBadge() {
  if (!loreBadgeEl || !loreBadgeEl.isConnected) loreBadgeEl = document.querySelector('#tmenu [data-a="archive"]');
  loreBadgeEl && loreBadgeEl.classList.toggle("lo-unread", loreUnread() > 0);
}
if (typeof ecoMinimapPings === "function") {
  const _emp = ecoMinimapPings;
  ecoMinimapPings = function (c, size, s) {
    _emp(c, size, s);
    const fx = x.S && x.S.talentFx, p = x.player;
    if (!fx || !(fx.chestSense > 0) || !p || !LR.cur.length) return;
    const r2 = fx.chestSense * fx.chestSense;
    for (let i = 0; i < LR.cur.length; i++) {
      const o = LR.cur[i], dx = o.x - p.x, dz = o.z - p.z;
      if (dx * dx + dz * dz > r2) continue;
      c.fillStyle = LORE_CFG.kinds[o.kind].css;
      c.beginPath();
      c.arc(o.x, o.z, 1, 0, 6.283);
      c.fill();
    }
  };
}

// ═══ 8. VOZ SINTETIZADA Y SUBTÍTULOS ════════════════════════════════════════════════════════════════════════════════
// Síntesis formántica en paralelo (WebAudio, sin red ni muestras): una fuente glotal (diente de sierra con la curva de tono de la
// frase) pasa por tres filtros de banda en las frecuencias de cada vocal; las fricativas y las oclusivas salen de ruido filtrado.
// La señal pasa por una cadena de «radio de campaña» (paso de banda 260-3300 Hz, saturación suave, estática y chasquidos). No imita un
// idioma: dibuja el ritmo silábico del texto en castellano (acentos, comas, preguntas) para dar presencia a cada voz. Cada línea usa
// la voz de su hablante (tono, velocidad, formantes, aspereza); ARGOS es monótona y metálica.
// La distribución temporal (loreLayout) es independiente del audio: los subtítulos y las pruebas fuera de línea la usan igual.
const LV_FORM = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010], o: [570, 840, 2410], u: [300, 870, 2240] };
const LV_NUM = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const LV_CONS = {
  // clase: 'f' fricativa, 's' oclusiva sorda, 'b' sonora oclusiva, 'n' nasal, 'l' líquida. d = duración (s), cf = centro del ruido (Hz)
  s: { c: "f", d: 0.075, cf: 5200, a: 0.5 }, f: { c: "f", d: 0.06, cf: 3600, a: 0.3 }, x: { c: "f", d: 0.07, cf: 2300, a: 0.42 },
  C: { c: "f", d: 0.08, cf: 3400, a: 0.5 },
  p: { c: "s", d: 0.04, cf: 700, a: 0.5 }, t: { c: "s", d: 0.04, cf: 3800, a: 0.5 }, k: { c: "s", d: 0.045, cf: 1900, a: 0.5 },
  b: { c: "b", d: 0.045, cf: 500, a: 0.34, fr: [220, 1000, 2300] }, d: { c: "b", d: 0.045, cf: 3000, a: 0.34, fr: [250, 1700, 2600] },
  g: { c: "b", d: 0.05, cf: 1500, a: 0.34, fr: [260, 1300, 2300] },
  m: { c: "n", d: 0.065, a: 0.42, fr: [250, 1100, 2200] }, n: { c: "n", d: 0.06, a: 0.42, fr: [260, 1500, 2500] }, N: { c: "n", d: 0.07, a: 0.42, fr: [260, 1900, 2700] },
  l: { c: "l", d: 0.055, a: 0.55, fr: [360, 1300, 2500] }, r: { c: "l", d: 0.035, a: 0.5, fr: [400, 1200, 1900] },
  R: { c: "l", d: 0.075, a: 0.5, fr: [420, 1100, 1800] }, Y: { c: "l", d: 0.05, a: 0.55, fr: [270, 2200, 3000] },
};
const loreSpeakable = (t) =>
  String(t).toLowerCase().replace(/(\d)\s*[.,]\s*(\d)/g, "$1 punto $2").replace(/\d/g, (d) => " " + LV_NUM[+d] + " ")
    .replace(/[·→]/g, ", ").replace(/[«»"“”()[\]]/g, " ").replace(/\s+/g, " ").trim();
/** Palabra → lista de fonemas simplificados [{ch, stress}] (ortografía castellana, seseo) */
function loreWordPhones(w) {
  let s = w
    .replace(/qu(?=[eiéí])/g, "k").replace(/gu(?=[eiéí])/g, "G").replace(/ü/g, "u").replace(/ll/g, "Y").replace(/rr/g, "R")
    .replace(/ch/g, "C").replace(/ñ/g, "N").replace(/c(?=[eiéí])/g, "s").replace(/g(?=[eiéí])/g, "x").replace(/z/g, "s")
    .replace(/c/g, "k").replace(/j/g, "x").replace(/h/g, "").replace(/v/g, "b").replace(/w/g, "u").replace(/y$/, "i")
    .replace(/^y(?![aeiouáéíóú])/, "i").replace(/y/g, "Y").replace(/G/g, "g");
  const ph = [];
  const nuclei = [];
  for (const ch of s) {
    const base = ch.normalize("NFD").charAt(0);
    if ("aeiou".includes(base)) {
      nuclei.push(ph.length);
      ph.push({ ch: base, v: 1, acc: ch !== base });
    } else if (LV_CONS[ch]) ph.push({ ch, v: 0 });
  }
  // sílaba tónica: la acentuada; si no, llanas (acaban en vocal, n o s) → penúltima, agudas → última
  let st = nuclei.findIndex((i) => ph[i].acc);
  if (st < 0) {
    const last = s.charAt(s.length - 1), n = nuclei.length;
    st = n === 1 ? 0 : "aeiounsáéíóú".includes(last) ? n - 2 : n - 1;
  }
  nuclei.forEach((i, k) => (ph[i].stress = k === st ? 1 : 0));
  return ph;
}
/** Distribución temporal de una línea: unidades (vocales y consonantes), palabras de subtítulo y final */
function loreLineUnits(text, V, t0, rng) {
  const out = { units: [], end: t0, words: [] };
  const toks = loreSpeakable(text).split(" ").filter(Boolean), rate = Math.max(0.5, V.rate), u = LORE_CFG.voice.unit / rate;
  const isQ = /\?\s*$/.test(text), isEx = /!\s*$/.test(text);
  let t = t0 + 0.04, pit = 1.07, wi = 0;
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k], core = tok.replace(/[^a-záéíóúüñ]/g, ""), pun = (tok.match(/[.,;:!?…—-]+$/) || [""])[0];
    const last = k === toks.length - 1;
    if (core) {
      const ph = loreWordPhones(core);
      for (let i = 0; i < ph.length; i++) {
        const p = ph[i];
        let f0 = V.f0 * (V.robot ? 1 : pit) * (1 + (V.robot ? 0 : (rng() - 0.5) * 0.03 + 0.045 * (p.stress || 0)));
        if (last && (isQ || isEx) && p.v && p.stress) f0 *= isQ ? 1.22 : 1.1;
        if (p.v) {
          const prevV = i > 0 && ph[i - 1].v, d = u * (p.stress ? 1.28 : 0.86) * (prevV ? 0.72 : 1) * (i === ph.length - 1 && !pun ? 1.1 : 1);
          const F = LV_FORM[p.ch];
          out.units.push({ t, d, c: "v", f0, a: p.stress ? 0.95 : 0.78, fr: [F[0] * V.form, F[1] * V.form, F[2] * V.form] });
          t += d;
        } else {
          const C = LV_CONS[p.ch], d = C.d / rate;
          if (C.c === "f" || C.c === "s") out.units.push({ t: C.c === "s" ? t + 0.02 / rate : t, d: C.c === "s" ? d - 0.02 / rate : d, c: C.c, cf: C.cf * (0.9 + 0.2 * V.form), a: C.a, f0 });
          else out.units.push({ t, d, c: C.c, f0: f0 * 0.97, a: C.a, fr: C.fr.map((q) => q * V.form), cf: C.cf, ...(C.c === "b" ? { burst: 1 } : {}) });
          t += d;
        }
      }
    }
    t += (0.045 + (pun ? (/[.…!?]/.test(pun) ? 0.34 : 0.18) : 0)) / (pun ? 1 : rate);
    pit = pun && /[.!?…]/.test(pun) ? 1.07 : Math.max(0.9, pit - 0.012);
    wi++;
  }
  out.end = t;
  // palabras del subtítulo: reparto proporcional a los caracteres de la línea original
  const ws = String(text).split(/\s+/).filter(Boolean), tot = ws.reduce((a, w) => a + w.length + 1, 0);
  let c = 0;
  for (const w of ws) {
    out.words.push({ w, t: t0 + ((t - t0) * c) / tot });
    c += w.length + 1;
  }
  return out;
}
/** Distribución completa de una grabación: [[hablante, texto], …] → {lines, units, dur} */
function loreLayout(lines) {
  const out = { lines: [], units: [], dur: 0 };
  let t = 0;
  lines.forEach(([who, text], li) => {
    const V = LoreVoices[who] || LoreVoices.reyes, rng = LoreRng(LoreHash(who + text));
    const r = loreLineUnits(text, V, t, rng);
    for (const un of r.units) { un.who = who; un.rob = V.robot; un.br = V.breath; un.rough = V.rough; out.units.push(un); }
    out.lines.push({ who, name: V.n, text, t0: t, t1: r.end, words: r.words });
    t = r.end + LORE_CFG.voice.gap;
  });
  out.dur = Math.max(0, t - LORE_CFG.voice.gap);
  return out;
}
const loreNoise = new WeakMap();
function loreNoiseBuf(ctx) {
  let b = loreNoise.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.6), ctx.sampleRate);
    const d = b.getChannelData(0), rng = LoreRng(9091);
    for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
    loreNoise.set(ctx, b);
  }
  return b;
}
const loreCurve = (() => {
  let c = null;
  return () => {
    if (!c) {
      c = new Float32Array(257);
      for (let i = 0; i < 257; i++) { const v = (i / 128 - 1) * 1.6; c[i] = Math.tanh(v) / Math.tanh(1.6); }
    }
    return c;
  };
})();
/**
 * Programa la síntesis de `lay` en un AudioContext (en directo o fuera de línea) a partir de t0. Devuelve {stop(), end}.
 * No usa Math.random: la estática y los chasquidos salen de un generador sembrado por la propia grabación.
 */
function loreSynth(ctx, dest, t0, lay, opt = {}) {
  const vol = (opt.vol ?? LORE_CFG.voice.vol) * LORE_CFG.voice.makeup, rng = LoreRng(LoreHash("static" + lay.dur));
  const robot = lay.units.length && lay.units[0].rob;
  const osc = ctx.createOscillator(), vg = ctx.createGain(), sum = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 120;
  vg.gain.value = 0;
  osc.connect(vg);
  const FB = [0, 1, 2].map((i) => {
    const b = ctx.createBiquadFilter(), g = ctx.createGain();
    b.type = "bandpass";
    b.Q.value = [6, 9, 11][i];
    g.gain.value = [1, 0.7, 0.4][i];
    vg.connect(b);
    b.connect(g);
    g.connect(sum);
    return b;
  });
  const ns = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  ns.buffer = loreNoiseBuf(ctx);
  ns.loop = true;
  nf.type = "bandpass";
  nf.Q.value = 0.9;
  nf.frequency.value = 3000;
  ng.gain.value = 0;
  ns.connect(nf);
  nf.connect(ng);
  ng.connect(sum);
  const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), ws = ctx.createWaveShaper(), out = ctx.createGain();
  hp.type = "highpass";
  hp.frequency.value = 260;
  hp.Q.value = 0.7;
  lp.type = "lowpass";
  lp.frequency.value = 3300;
  lp.Q.value = 0.8;
  ws.curve = loreCurve();
  out.gain.value = 0;
  sum.connect(hp);
  hp.connect(ws);
  ws.connect(lp);
  const extra = [];
  if (robot) {
    // peine metálico: eco corto realimentado
    const dl = ctx.createDelay(0.05), fb = ctx.createGain();
    dl.delayTime.value = 0.0042;
    fb.gain.value = 0.55;
    ws.connect(dl);
    dl.connect(fb);
    fb.connect(dl);
    dl.connect(lp);
    extra.push(dl, fb);
  }
  lp.connect(out);
  out.connect(dest);
  // estática de fondo y chasquidos de la grabación
  const ns2 = ctx.createBufferSource(), sb = ctx.createBiquadFilter(), sg = ctx.createGain();
  ns2.buffer = loreNoiseBuf(ctx);
  ns2.loop = true;
  sb.type = "bandpass";
  sb.frequency.value = 1700;
  sb.Q.value = 0.6;
  sg.gain.value = 0;
  ns2.connect(sb);
  sb.connect(sg);
  sg.connect(hp);
  const T0 = t0, end = t0 + lay.dur + 0.35;
  out.gain.setValueAtTime(0, T0 - 0.02);
  out.gain.linearRampToValueAtTime(vol, T0 + 0.05);
  out.gain.setValueAtTime(vol, end - 0.15);
  out.gain.linearRampToValueAtTime(0, end);
  if (!robot) {
    sg.gain.setValueAtTime(0.009 * LORE_CFG.voice.makeup, T0);
    for (let c = T0 + 0.2 + rng() * 0.4; c < end; c += 0.25 + rng() * 0.7) {
      sg.gain.setValueAtTime(0.009 * LORE_CFG.voice.makeup, c);
      sg.gain.linearRampToValueAtTime((0.05 + rng() * 0.07) * LORE_CFG.voice.makeup, c + 0.004);
      sg.gain.linearRampToValueAtTime(0.009 * LORE_CFG.voice.makeup, c + 0.012 + rng() * 0.02);
    }
  }
  osc.start(T0);
  ns.start(T0);
  ns2.start(T0);
  // eventos por unidad
  for (const u of lay.units) {
    const T = T0 + u.t, E = T + u.d;
    if (u.c === "v" || u.c === "b" || u.c === "n" || u.c === "l") {
      const f0 = robot ? u.f0 * 0.985 : u.f0 * (1 + (rng() - 0.5) * 0.08 * (u.rough || 0));
      osc.frequency.setTargetAtTime(f0, T, 0.018);
      FB[0].frequency.setTargetAtTime(u.fr[0], T, 0.02);
      FB[1].frequency.setTargetAtTime(u.fr[1], T, 0.02);
      FB[2].frequency.setTargetAtTime(u.fr[2], T, 0.02);
      vg.gain.setTargetAtTime(u.a, T, 0.012);
      vg.gain.setTargetAtTime(0.0001, Math.max(T + 0.01, E - 0.022), 0.012);
      ng.gain.setTargetAtTime((u.br || 0) * 0.22, T, 0.02);
      if (u.burst) {
        nf.frequency.setValueAtTime(u.cf, T);
        ng.gain.setValueAtTime(0.16, T);
        ng.gain.setTargetAtTime((u.br || 0) * 0.22, T + 0.012, 0.01);
      }
    } else {
      nf.frequency.setValueAtTime(u.cf, T);
      nf.Q.setValueAtTime(u.c === "f" ? 1.4 : 0.8, T);
      ng.gain.setValueAtTime(0.0001, T);
      ng.gain.linearRampToValueAtTime(u.a * 0.65 * (u.c === "s" ? 1.1 : 1), T + (u.c === "s" ? 0.004 : 0.012));
      ng.gain.setValueAtTime(u.a * 0.58, Math.max(T + 0.006, E - 0.014));
      ng.gain.linearRampToValueAtTime((u.br || 0) * 0.22, E);
      vg.gain.setTargetAtTime(0.0001, T, 0.01);
    }
  }
  osc.stop(end + 0.1);
  ns.stop(end + 0.1);
  ns2.stop(end + 0.1);
  const all = [osc, vg, sum, ns, nf, ng, hp, lp, ws, out, ns2, sb, sg, ...FB, ...extra];
  return {
    end,
    stop() {
      try {
        const n = ctx.currentTime;
        out.gain.cancelScheduledValues(n);
        out.gain.setValueAtTime(out.gain.value, n);
        out.gain.linearRampToValueAtTime(0, n + 0.06);
        osc.stop(n + 0.08);
        ns.stop(n + 0.08);
        ns2.stop(n + 0.08);
        setTimeout(() => all.forEach((q) => { try { q.disconnect(); } catch (e) {} }), 200);
      } catch (e) {}
    },
  };
}
LORE_CFG.voice.makeup = 1.2; // ganancia de compensación (la salida formántica es baja; se ajusta con tools/sim/lore.mjs)

// — Voz del sistema (opcional): speechSynthesis solo con voces españolas LOCALES, para no tocar la red —
function loreSysVoice() {
  try {
    const vs = window.speechSynthesis && speechSynthesis.getVoices();
    return vs && vs.find((v) => /^es/i.test(v.lang) && v.localService);
  } catch (e) {
    return null;
  }
}

// — Reproducción —
function loreVoicePlay(id, o = {}) {
  const e = LR.idx.get(id);
  if (!e || e.k !== "grab" || !loreReadable(id)) return false;
  loreVoiceStop(true);
  const L = loreS(), lay = loreLayout(loreLines(e)), V = { id, lay, start: performance.now() + 120, nodes: null, timer: 0, panel: !!o.panel, wi: -1 };
  LR.voice = V;
  const sys = L.o.voice === "sys" && loreSysVoice();
  if (sys) {
    let k = 0;
    const next = () => {
      if (LR.voice !== V || k >= lay.lines.length) return;
      const ln = lay.lines[k++], u = new SpeechSynthesisUtterance(ln.text.replace(/\s+/g, " "));
      u.voice = sys;
      u.lang = sys.lang;
      u.rate = Math.max(0.7, Math.min(1.3, (LoreVoices[ln.who] || {}).rate || 1));
      u.pitch = Math.max(0.4, Math.min(1.6, ((LoreVoices[ln.who] || {}).f0 || 130) / 150));
      u.onstart = () => { V.sysLine = k - 1; };
      u.onend = next;
      speechSynthesis.speak(u);
    };
    V.sys = true;
    next();
  } else {
    ae.init();
    if (Ot && Ot.state !== "closed") V.nodes = loreSynth(Ot, dr, Ot.currentTime + 0.12, lay);
  }
  V.timer = setInterval(loreVoiceTick, 70);
  ee("loreVoice", id);
  loreSubUpdate();
  loreArchiveVoiceUi();
  return true;
}
function loreVoiceStop(silent) {
  const V = LR.voice;
  if (!V) return;
  LR.voice = null;
  clearInterval(V.timer);
  V.nodes && V.nodes.stop();
  try { V.sys && speechSynthesis.cancel(); } catch (e) {}
  loreSubHide();
  silent || loreArchiveVoiceUi();
}
/** Utilidad para otros frentes: pronuncia un texto con la voz de un hablante de LoreVoices (p. ej. «argos»). Devuelve {stop(), dur} o null sin audio. */
ae.speak = function (text, who, o) {
  ae.init();
  if (!Ot || Ot.state === "closed") return null;
  const lay = loreLayout([[LoreVoices[who] ? who : "argos", String(text)]]);
  const h = loreSynth(Ot, dr, Ot.currentTime + 0.05, lay, o);
  return { stop: h.stop, dur: lay.dur };
};
/** línea y palabra que toca ahora (sin asignar: devuelve índices) */
function loreVoiceAt(V) {
  const t = V.sys && V.sysLine != null ? V.lay.lines[V.sysLine].t0 + 0.01 : (performance.now() - V.start) / 1000;
  let li = -1;
  for (let i = 0; i < V.lay.lines.length; i++) if (t >= V.lay.lines[i].t0) li = i;
  let wi = -1;
  if (li >= 0) { const ws = V.lay.lines[li].words; for (let i = 0; i < ws.length; i++) if (t >= ws[i].t) wi = i; }
  return { t, li, wi };
}
function loreVoiceTick() {
  const V = LR.voice;
  if (!V) return;
  const a = loreVoiceAt(V);
  if (V.sys ? !speechSynthesis.speaking && V.sysLine != null && a.t > 0 && performance.now() - V.start > 600 && !speechSynthesis.pending : a.t > V.lay.dur + 0.55) {
    const id = V.id;
    loreVoiceStop();
    ee("loreVoiceEnd", id);
    return;
  }
  if (a.li !== V.li || a.wi !== V.wi) { V.li = a.li; V.wi = a.wi; loreSubUpdate(); loreArchiveVoiceUi(); }
}
// — Subtítulos en pantalla (no modales: el juego sigue) —
let loreSubEl = null;
function loreSubBox() {
  if (loreSubEl && loreSubEl.isConnected) return loreSubEl;
  loreCss();
  loreSubEl = document.createElement("div");
  loreSubEl.id = "loreSub";
  loreSubEl.innerHTML = '<b class="who"></b><span class="on"></span><span class="off"></span><i class="stop" aria-label="Detener">■</i>';
  loreSubEl.addEventListener("click", () => loreVoiceStop());
  document.body.appendChild(loreSubEl);
  return loreSubEl;
}
function loreSubHide() {
  loreSubEl && (loreSubEl.style.display = "none");
}
function loreSubUpdate() {
  const V = LR.voice, L = loreS();
  if (!V || !L || !L.o.subs || (x.uiOpen === "archive" && V.panel)) return loreSubHide();
  const a = loreVoiceAt(V);
  if (a.li < 0) return loreSubHide();
  const ln = V.lay.lines[a.li], el = loreSubBox(), ws = ln.words;
  const on = ws.slice(0, a.wi + 1).map((w) => w.w).join(" "), off = ws.slice(a.wi + 1).map((w) => w.w).join(" ");
  el.querySelector(".who").textContent = ln.name;
  el.querySelector(".on").textContent = on + (off ? " " : "");
  el.querySelector(".off").textContent = off;
  el.style.display = "block";
}

// ═══ 9. ARCHIVO (L) ═════════════════════════════════════════════════════════════════════════════════════════════════
// Panel propio (Ze.open("archive")): pestañas Libros · Chips · Grabaciones · Colecciones · Hitos · Diario ▸ (el Archivo antiguo con crónica,
// bestiario, regiones y personajes). Móvil primero: tarjetas táctiles de ≥ 44 px, lista ↔ lector en la misma ventana, sin hover.
let loreCssDone = false;
function loreCss() {
  if (loreCssDone) return;
  loreCssDone = true;
  const st = document.createElement("style");
  st.id = "lore-css";
  st.textContent = `
#loreSub{position:fixed;left:50%;bottom:170px;transform:translateX(-50%);z-index:36;max-width:min(700px,84vw);background:rgba(8,12,14,.92);border:1px solid var(--line);border-left:3px solid #5dff9a;padding:6px 34px 7px 12px;font:600 15px/1.35 var(--f-body);color:#e6ebee;display:none;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent}
#loreSub .who{display:block;font:700 11px var(--f-disp);letter-spacing:.14em;text-transform:uppercase;color:#5dff9a;margin-bottom:2px}
#loreSub .on{color:#fff}#loreSub .off{color:#7d8a91}
#loreSub .stop{position:absolute;right:8px;top:6px;font-style:normal;font-size:12px;color:#8b989f}
body.touch #loreSub{bottom:calc(8px + env(safe-area-inset-bottom,0px));max-width:42vw;font-size:13px;padding:4px 26px 5px 9px}
@media (orientation:portrait){body.touch #loreSub{bottom:auto;top:calc(214px + env(safe-area-inset-top,0px));max-width:88vw}}
#tmenu button{position:relative}
.lo-unread::after{content:"";position:absolute;top:3px;right:3px;width:8px;height:8px;border-radius:50%;background:var(--amber);box-shadow:0 0 6px var(--amber)}
.lo-win .tabs{flex:1 1 100%;order:3}
.lo-win .tab{min-height:34px}
.lo-tag{display:inline-block;font:700 10px var(--f-disp);letter-spacing:.1em;padding:1px 6px;border:1px solid currentColor;margin-left:6px;vertical-align:middle}
.lo-sec{display:flex;justify-content:space-between;align-items:baseline;font:700 12px var(--f-disp);letter-spacing:.16em;text-transform:uppercase;color:var(--amber);margin:12px 0 6px;padding-bottom:3px;border-bottom:1px solid var(--line2)}
.lo-sec b{color:var(--muted);font-weight:600}
.lo-card{display:flex;align-items:center;gap:10px;min-height:48px;padding:7px 10px;margin-bottom:6px;background:rgba(0,0,0,.3);border:1px solid var(--line2);border-left:3px solid var(--kc,var(--amber));cursor:pointer;-webkit-tap-highlight-color:transparent}
.lo-card:active{background:rgba(255,179,64,.12)}
.lo-card.lock{opacity:.5;cursor:default;border-left-color:var(--line2)}
.lo-card .ic{font:700 20px var(--f-disp);width:26px;text-align:center;color:var(--kc,var(--amber));flex:none}
.lo-card .mid{flex:1;min-width:0}
.lo-card h4{margin:0;font:600 15px/1.2 var(--f-disp);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lo-card .muted{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lo-card .st{font:700 10px var(--f-disp);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);flex:none;text-align:right}
.lo-card .st.new{color:var(--amber)}.lo-card .st.ok{color:var(--good)}.lo-card .st.enc{color:var(--cyan)}
.lo-nav{margin-bottom:8px}.lo-nav .grow{flex:1}
.lo-nav .btn{min-height:40px;min-width:44px}
.lo-t{margin:4px 0 2px;font-size:20px}.lo-m{font-size:13px;margin-bottom:10px}
.lo-txt{white-space:pre-line;font-size:16px;line-height:1.6;border-left:2px solid var(--kc,var(--amber));padding:8px 14px;background:rgba(0,0,0,.25);max-width:68ch}
.lo-garb{font-family:monospace;letter-spacing:.04em;color:#6aa9b8;overflow-wrap:anywhere}
.lo-rec .btn{min-height:44px}
.lo-prog{height:6px;background:rgba(255,255,255,.08);margin:10px 0}.lo-prog i{display:block;height:100%;width:0;background:#5dff9a}
.lo-line{margin:6px 0;padding:6px 10px;border-left:2px solid var(--line2);font-size:15px;line-height:1.45;color:#8b989f}
.lo-line.cur{color:#fff;border-left-color:#5dff9a;background:rgba(93,255,154,.07)}
.lo-line b{display:block;font:700 11px var(--f-disp);letter-spacing:.12em;text-transform:uppercase;color:#5dff9a}
.lo-opt{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.lo-opt .btn{min-height:38px;font-size:13px}.lo-opt .btn.on{border-color:var(--amber);color:var(--amber2)}
.lo-col{padding:9px 12px;margin-bottom:8px;background:rgba(0,0,0,.28);border:1px solid var(--line2);border-left:3px solid var(--line2)}
.lo-col.done{border-left-color:var(--good)}
.lo-col h4{margin:0;font:600 16px var(--f-disp)}.lo-col .row{justify-content:space-between;flex-wrap:nowrap}
.lo-pct{font:700 13px var(--f-disp);color:var(--amber2);flex:none}
.lo-bar{height:5px;background:rgba(255,255,255,.08);margin:6px 0}.lo-bar i{display:block;height:100%;background:var(--amber)}
.lo-col.done .lo-bar i{background:var(--good)}
.lo-mem{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:12.5px;color:var(--muted)}
.lo-mem span.ok{color:var(--text)}.lo-mem span.part{color:var(--cyan)}
.lo-rw{font-size:12.5px;margin-top:5px}
.lo-hint{margin-top:10px;font-size:13px;color:var(--cyan);border:1px dashed rgba(70,228,255,.4);padding:6px 10px}
@media (max-width:760px){.lo-t{font-size:18px}.lo-txt{font-size:15px;padding:6px 10px}.lo-win .tab{padding:5px 8px;font-size:12px}}
`;
  document.head.appendChild(st);
}
const LORE_SHORT = { shelf: "estantería", body: "caído", rec: "radio", term: "terminal ◈", lair: "nido", op: "operación", boss: "jefe" };
function loreCounts() {
  const L = loreS(), c = { libro: [0, 0], chip: [0, 0], grab: [0, 0] };
  for (const e of LoreEntries) { c[e.k][1]++; L.f[e.id] && c[e.k][0]++; }
  return c;
}
function loreRewardText(c) {
  const R = c.rew || {}, o = [];
  R.tp && o.push("1 punto de talento");
  R.plan && o.push(`plano de gadget (nivel ${R.plan})`);
  R.map && o.push(R.map === "all" ? "mapa completo" : "mapa de la región");
  R.loot && o.push("botín de cofre " + R.loot);
  R.mats && o.push("materiales");
  R.xp && o.push(`${Math.round(R.xp * 100)} % de una barra de XP`);
  return o.join(" · ");
}
const loreOrdered = (kind) => LoreEntries.filter((e) => e.k === kind);
function loreListHtml(kind) {
  const L = loreS(), K = LORE_CFG.kinds[kind];
  let h = "";
  if (kind === "grab") {
    h += `<div class="lo-opt"><button class="btn ${L.o.subs ? "on" : ""}" data-lo="subs">Subtítulos ${L.o.subs ? "sí" : "no"}</button><button class="btn ${L.o.auto ? "on" : ""}" data-lo="auto">Reproducir al hallar: ${L.o.auto ? "sí" : "no"}</button>${loreSysVoice() ? `<button class="btn ${L.o.voice === "sys" ? "on" : ""}" data-lo="voice">Voz: ${L.o.voice === "sys" ? "del sistema" : "de radio"}</button>` : ""}</div>`;
  }
  if (kind === "chip") h += `<p class="muted" style="margin:0 0 8px;font-size:13px">Los chips de datos llegan cifrados. Descífralos con el minijuego de hackeo para leerlos; las colecciones los cuentan una vez descifrados.</p>`;
  for (let r = 0; r < 9; r++) {
    const list = loreOrdered(kind).filter((e) => e.reg === r);
    if (!list.length) continue;
    const got = list.filter((e) => L.f[e.id]).length;
    h += `<div class="lo-sec"><span>${ke(loreRegName(r))}</span><b>${got}/${list.length}</b></div>`;
    for (const e of list) {
      if (L.f[e.id]) {
        const q = L.d[e.id] || 0, enc = e.k === "chip" && q < 1;
        const st = !L.r[e.id] && !enc ? '<span class="st new">Nuevo</span>' : enc ? `<span class="st enc">${q > 0 ? Math.round(q * 100) + " %" : "Cifrado"}</span>` : '<span class="st ok">✓</span>';
        h += `<div class="lo-card" style="--kc:${K.css}" data-id="${e.id}" role="button" tabindex="0"><span class="ic">${K.ic}</span><span class="mid"><h4>${ke(e.t)}</h4><div class="muted">${ke(e.a)}${e.th ? " · ECLIPSE" : ""}</div></span>${st}</div>`;
      } else {
        const w = e.w === "boss" ? (e.secret ? "Se recupera de un jefe secreto" : "Se recupera al derrotar a " + ke(En[e.boss] ? En[e.boss].n : "su jefe")) : LORE_CFG.where[e.w] + (e.w === "op" ? " (" + e.themes.join(", ") + ")" : "");
        h += `<div class="lo-card lock" style="--kc:${K.css}"><span class="ic">${K.ic}</span><span class="mid"><h4>???</h4><div class="muted">${w}</div></span></div>`;
      }
    }
  }
  return h;
}
function loreColsHtml() {
  const L = loreS();
  let h = "";
  for (const c of LoreCols) {
    const m = LoreMembers(c), have = m.filter((e) => loreReadable(e.id)).length, done = !!L.c[c.id];
    h += `<div class="lo-col ${done ? "done" : ""}"><div class="row"><h4>${ke(c.n)}${c.meta ? ' <span class="lo-tag" style="color:var(--amber2)">GRAN COLECCIÓN</span>' : ""}</h4><span class="lo-pct">${have}/${m.length}${done ? " ✓" : ""}</span></div><div class="lo-bar"><i style="width:${(100 * have) / m.length}%"></i></div><div class="lo-mem">`;
    for (const e of m) {
      const K = LORE_CFG.kinds[e.k], f = !!L.f[e.id], ok = loreReadable(e.id);
      h += `<span class="${ok ? "ok" : f ? "part" : ""}" style="${ok || f ? "" : "opacity:.7"}"><b style="color:${K.css}">${K.ic}</b> ${f ? ke(e.t) + (ok ? "" : " (cifrado)") : "??? · " + LORE_SHORT[e.w]}</span>`;
    }
    h += `</div><div class="muted lo-rw">Recompensa: ${loreRewardText(c)}${done ? " · cobrada" : ""}</div></div>`;
  }
  const hs = Object.keys(L.h);
  h += `<div class="lo-sec"><span>Pistas anotadas</span><b>${hs.length}/${Object.keys(LoreHints).length}</b></div>`;
  h += hs.length
    ? hs.map((k) => { const p = loreHintFor(k); return `<div class="lo-card" style="--kc:var(--cyan);cursor:default"><span class="ic">✎</span><span class="mid"><h4>${ke(p.display)}</h4><div class="muted">${ke(p.what || k)}</div></span></div>`; }).join("")
    : '<p class="muted" style="font-size:13px;margin:0">Algunos libros y grabaciones citan códigos, secuencias y frecuencias. Al leerlos quedan aquí anotados; sirven en puzles y terminales.</p>';
  return h;
}
function loreDetailHtml(id) {
  const e = LR.idx.get(id), L = loreS(), K = LORE_CFG.kinds[e.k], q = L.d[id] || 0, reg = loreRegName(e.reg);
  const sib = loreOrdered(e.k).filter((en) => L.f[en.id]), at = sib.findIndex((en) => en.id === id);
  let h = `<div class="row lo-nav"><button class="btn" data-lo="back">← Lista</button><span class="grow"></span><button class="btn" data-lo="prev" aria-label="Anterior" ${sib.length < 2 ? "disabled" : ""}>‹</button><button class="btn" data-lo="next" aria-label="Siguiente" ${sib.length < 2 ? "disabled" : ""}>›</button></div>`;
  h += `<h3 class="disp lo-t" style="color:${K.css}">${ke(e.t)}</h3><div class="muted lo-m">${K.n} · ${ke(e.a)} · ${ke(reg)}${at >= 0 ? ` · ${at + 1}/${sib.length}` : ""}</div>`;
  if (e.k === "grab") {
    h += `<div class="lo-rec" style="--kc:${K.css}"><button class="btn pri lo-play" data-lo="play">▶ Reproducir</button><div class="lo-prog"><i id="loProg"></i></div>`;
    h += loreLines(e).map(([w, t], i) => `<div class="lo-line" data-li="${i}"><b>${ke((LoreVoices[w] || {}).n || w)}</b>${ke(t)}</div>`).join("");
    h += `</div>`;
  } else if (e.k === "chip" && q < 1) {
    h += `<div class="lo-txt lo-garb" style="--kc:${K.css}">${ke(LoreGarble(loreText(e), q, L.seed + id))}</div>`;
    h += `<div class="row" style="margin-top:12px"><button class="btn pri" data-lo="decrypt" style="min-height:46px">${q > 0 ? "Seguir descifrando" : "Descifrar chip"}</button><span class="muted" style="font-size:13px">${q > 0 ? `Legible al ${Math.round(q * 100)} %. ` : ""}Dificultad ${"▮".repeat(e.d || 2)}${"▯".repeat(4 - (e.d || 2))}${L.tr[id] ? " · intentos: " + L.tr[id] : ""}</span></div>`;
  } else h += `<div class="lo-txt" style="--kc:${K.css}">${ke(loreText(e))}</div>`;
  const hk = LoreHintKeys(LoreEntryText(e)).filter(() => loreReadable(id));
  hk.length && (h += hk.map((k) => `<div class="lo-hint">Pista anotada en el Archivo: ${ke(loreHintFor(k).what)} → <b>${ke(loreHintFor(k).display)}</b></div>`).join(""));
  const c = LoreCols.find((k) => k.rule.reg === e.reg);
  if (c) { const p = loreProgress(c.id); h += `<p class="muted" style="font-size:12.5px;margin-top:12px">Colección «${ke(c.n)}»: ${p.have}/${p.total}${p.done ? " · completada" : ""}</p>`; }
  return h;
}
function loreRenderArchive() {
  loreCss();
  const U = LR.ui, L = loreS(), c = loreCounts();
  const doneCols = LoreCols.filter((k) => L.c[k.id]).length;
  const tabs = [["libros", `Libros ${c.libro[0]}/${c.libro[1]}`], ["chips", `Chips ${c.chip[0]}/${c.chip[1]}`], ["grab", `Grab. ${c.grab[0]}/${c.grab[1]}`], ["cols", `Colec. ${doneCols}/${LoreCols.length}`], ["hitos", `Hitos ${(x.S.hitos || []).length}`], ["diario", "Diario ▸"]]
    .map(([k, n]) => `<button class="tab ${U.tab === k ? "on" : ""}" data-lt="${k}">${n}</button>`).join("");
  let body;
  if (U.sel && LR.idx.get(U.sel) && L.f[U.sel]) body = loreDetailHtml(U.sel);
  else {
    U.sel = null;
    body = U.tab === "libros" ? loreListHtml("libro") : U.tab === "chips" ? loreListHtml("chip") : U.tab === "grab" ? loreListHtml("grab") : U.tab === "cols" ? loreColsHtml()
      : typeof ecoHitosHtml === "function" ? ecoHitosHtml() : '<p class="muted">Aún no hay hitos.</p>';
  }
  const old = document.querySelector("#panel .wbody"), keep = old && LR.ui.keep === U.tab + "|" + U.sel ? old.scrollTop : 0;
  Ze.open("archive", `<div class="win lo-win" style="width:min(900px,100%)">${Ze.head("Archivo", `<div class="tabs">${tabs}</div>`)}<div class="wbody">${body}</div></div>`, { silent: x.uiOpen === "archive" });
  const win = document.querySelector("#panel .win");
  win.addEventListener("click", loreClick);
  win.addEventListener("keydown", (ev) => { (ev.key === "Enter" || ev.key === " ") && ev.target.dataset && ev.target.dataset.id && loreClick(ev); });
  const wb = win.querySelector(".wbody");
  wb.scrollTop = keep;
  LR.ui.keep = U.tab + "|" + U.sel;
  loreArchiveVoiceUi();
}
function loreOpenArchive(tab, sel) {
  const U = LR.ui;
  if (tab) { U.tab = tab === "grabaciones" ? "grab" : tab; U.sel = sel || null; }
  else if (sel !== undefined) U.sel = sel || null;
  if (U.sel) { const e = LR.idx.get(U.sel); e && (U.tab = e.k === "libro" ? "libros" : e.k === "chip" ? "chips" : "grab"); loreMarkRead(U.sel); }
  loreRenderArchive();
}
function loreStep(d) {
  const U = LR.ui, e = LR.idx.get(U.sel), L = loreS();
  if (!e) return;
  const sib = loreOrdered(e.k).filter((en) => L.f[en.id]), i = sib.findIndex((en) => en.id === U.sel);
  if (sib.length < 2) return;
  U.sel = sib[(i + d + sib.length) % sib.length].id;
  loreMarkRead(U.sel);
}
function loreClick(ev) {
  const t = ev.target.closest("[data-lt],[data-lo],[data-id]"), U = LR.ui, L = loreS();
  if (!t) return;
  if (t.dataset.lt) {
    if (t.dataset.lt === "diario") return No("chron");
    U.tab = t.dataset.lt;
    U.sel = null;
    ae.play("ui");
    return loreRenderArchive();
  }
  if (t.dataset.id) {
    U.sel = t.dataset.id;
    loreMarkRead(U.sel);
    ae.play("ui");
    return loreRenderArchive();
  }
  const a = t.dataset.lo;
  if (a === "back") { U.sel = null; return loreRenderArchive(); }
  if (a === "prev" || a === "next") { loreStep(a === "next" ? 1 : -1); return loreRenderArchive(); }
  if (a === "decrypt") return loreDecryptUi(U.sel);
  if (a === "play") {
    if (LR.voice && LR.voice.id === U.sel) loreVoiceStop();
    else { loreVoicePlay(U.sel, { panel: true }); loreMarkRead(U.sel); }
    return;
  }
  if (a === "subs") { L.o.subs = !L.o.subs; return loreRenderArchive(); }
  if (a === "auto") { L.o.auto = !L.o.auto; return loreRenderArchive(); }
  if (a === "voice") { L.o.voice = L.o.voice === "sys" ? "radio" : "sys"; return loreRenderArchive(); }
}
/** Refresca el botón, las líneas resaltadas y la barra de progreso de la grabación abierta (sin reconstruir el panel) */
function loreArchiveVoiceUi() {
  if (x.uiOpen !== "archive") return;
  const root = document.querySelector("#panel .lo-rec");
  if (!root) return;
  const V = LR.voice, on = V && V.id === LR.ui.sel;
  const b = root.querySelector(".lo-play");
  b && (b.textContent = on ? "■ Detener" : "▶ Reproducir");
  root.querySelectorAll(".lo-line").forEach((el, i) => el.classList.toggle("cur", !!on && V.li === i));
  const p = root.querySelector("#loProg");
  p && (p.style.width = on ? Math.min(100, (100 * Math.max(0, (performance.now() - V.start) / 1000)) / Math.max(0.1, V.lay.dur)) + "%" : "0%");
}
It("uiClosed", (k) => {
  if (k === "archive" && LR.voice && LR.voice.panel) loreVoiceStop(true);
});
for (const ev of ["playerDied", "toMenu", "respawn"]) It(ev, () => loreVoiceStop(true));
// — Descifrado de chips: hackApi (frente HACKEO) si existe; si no, un minijuego de terminal del juego base —
function loreDecryptUi(id) {
  const e = LR.idx.get(id), L = loreS();
  if (!e) return;
  const tier = Math.max(1, Math.min(4, e.d || 2));
  const done = (res) => {
    const ok = res === true || !!(res && (res.ok || res.success));
    const prev = L.d[id] || 0, rq = res && typeof res === "object" ? (res.q ?? res.quality) : null;
    let q = ok ? 1 : rq != null ? +rq || 0 : Math.min(0.85, prev + LORE_CFG.partialPerFail);
    if (ok && rq != null) q = Math.max(+rq || 0, 0.999);
    const r = loreDecrypt(id, q);
    r.ok || la(`Descifrado fallido · el chip ya es legible al ${Math.round(r.q * 100)} %`, "warn");
    loreOpenArchive("chips", id);
  };
  if (x.hackApi && typeof x.hackApi.run === "function") {
    try {
      x.hackApi.run({ kind: "chip", id, name: e.t, tier, diff: tier, lore: true }, done);
      return;
    } catch (err) {
      console.warn("[lore] hackApi.run", err);
    }
  }
  if (typeof db !== "function" || !Array.isArray(ob)) {
    // sin minijuegos en esta build: el chip se abre sin más (nunca debe quedar bloqueado)
    loreDecrypt(id, 1);
    return loreOpenArchive("chips", id);
  }
  const kind = ob[LoreHash(id) % ob.length];
  Ze.open(
    "lorehack",
    `<div class="win" style="width:min(620px,100%)">${Ze.head("Descifrando · " + QE[kind], `<span class="tag" style="color:var(--cyan)">Dificultad ${"▮".repeat(tier)}${"▯".repeat(4 - tier)}</span>`)}<div class="wbody"><p class="muted" style="margin:0 0 8px">${ke(e.t)}</p><div id="pzRoot"></div><div class="row" style="margin-top:10px"><button class="btn" id="loAbort">Cancelar</button></div></div></div>`,
    { modal: true },
  );
  wr = db(document.querySelector("#pzRoot"), kind, tier, (ok) => {
    Ze.close();
    done(ok);
  });
  document.querySelector("#loAbort").addEventListener("click", () => {
    Ze.close();
    loreOpenArchive("chips", id);
  });
}

// ═══ 10. PRESENTACIÓN AL HALLAR, TECLA L Y ENGANCHES DE PANEL ═══════════════════════════════════════════════════════
function loreSafe() {
  const p = x.player, R2 = LORE_CFG.safeRead * LORE_CFG.safeRead;
  for (let i = 0; i < x.enemies.length; i++) {
    const en = x.enemies[i];
    if (en.dead) continue;
    const dx = en.x - p.x, dz = en.z - p.z;
    if (dx * dx + dz * dz < R2) return false;
  }
  return true;
}
/** Evento «lore» de una entrada nueva (llega por Rb): aviso, progreso de la región y apertura/reproducción automática */
function loreAnnounce(n) {
  const e = LR.idx.get(n.lid), L = loreS();
  if (!e || !L) return;
  const K = LORE_CFG.kinds[e.k], col = LoreCols.find((c) => c.rule.reg === e.reg && !c.meta);
  const found = col ? LoreMembers(col).filter((m) => L.f[m.id]).length : 0, tot = col ? LoreMembers(col).length : 0;
  la(`${K.ic} ${K.n}: «${e.t}»${col ? ` · ${loreRegName(e.reg)} ${found}/${tot}` : ""}`, "quest");
  if (Object.keys(L.f).length === 1 && !n.quiet) la(`Tus hallazgos quedan en el Archivo (${Tt.touchMode ? "botón ARCH." : "tecla L"}): libros, chips cifrados y grabaciones.`, "");
  if (e.boss) la(`Expediente recuperado: quién fue ${En[e.boss] ? En[e.boss].n : "el jefe"}. Descífralo en el Archivo (${Tt.touchMode ? "ARCH." : "L"}).`, "quest");
  if (n.quiet || x.mode === "menu") return;
  if (e.k === "grab" && L.o.auto) loreVoicePlay(e.id);
  else if (e.k === "libro" && L.o.auto && loreSafe() && !x.uiOpen) loreOpenArchive("libros", e.id);
  else if (e.k === "chip" && !e.boss) la(`Chip cifrado: descífralo en el Archivo (${Tt.touchMode ? "ARCH." : "L"})`, "warn");
}
(function () {
  const _Rb = Rb, _Nb = Nb, _No = No, _Er = Er;
  Rb = function (n) {
    return n && n.lid ? loreAnnounce(n) : _Rb.apply(this, arguments);
  };
  // la pestaña «Archivo (L)» del Diario de operaciones abre el Archivo de lore
  Er = function (n) {
    return n === "lore" ? loreOpenArchive(undefined, null) : _Er.apply(this, arguments);
  };
  // L / botón ARCH.: abre el Archivo de lore (la tecla ya estaba en yw y el botón táctil en #tmenu)
  Nb = function () {
    if (x.started && x.player && !x.player.dead && Tt.hit("archive")) {
      const n = x.uiOpen;
      if (n === "archive") Ze.close();
      else if (!n || ["inv", "map", "quests", "pause"].includes(n)) loreOpenArchive(undefined, null);
    }
    return _Nb.apply(this, arguments);
  };
  // El Archivo antiguo (crónica, bestiario…) gana una pestaña para volver al de lore
  No = function () {
    const r = _No.apply(this, arguments);
    try {
      const t = document.querySelector("#panel .tabs");
      if (t && !t.querySelector("[data-lore]")) {
        const b = document.createElement("button");
        b.className = "tab";
        b.dataset.lore = "1";
        b.textContent = "◂ Libros, chips y voces";
        b.addEventListener("click", () => loreOpenArchive(undefined, null));
        t.insertBefore(b, t.firstChild);
      }
    } catch (err) {}
    return r;
  };
})();

// ═══ 11. PRUEBAS (window.__lore) ════════════════════════════════════════════════════════════════════════════════════
/** Renderiza una grabación fuera de línea y devuelve estadísticas de la señal (sin sonido real) */
async function loreRenderOffline(id, o = {}) {
  const e = LR.idx.get(id);
  if (!e || e.k !== "grab") return null;
  const lay = loreLayout(loreLines(e)), rate = o.rate || 22050, dur = lay.dur + 0.7;
  const oc = new OfflineAudioContext(1, Math.ceil(dur * rate), rate), g = oc.createGain();
  g.gain.value = 1;
  g.connect(oc.destination);
  loreSynth(oc, g, 0.05, lay, { vol: o.vol });
  const buf = await oc.startRendering(), d = buf.getChannelData(0), n = d.length;
  let s2 = 0, pk = 0, bad = 0;
  for (let i = 0; i < n; i++) { const v = d[i]; if (v !== v || Math.abs(v) === Infinity) bad++; else { s2 += v * v; Math.abs(v) > pk && (pk = Math.abs(v)); } }
  // actividad por ventanas de 25 ms y modulación silábica (cruces de la envolvente por su media)
  const w = Math.floor(rate * 0.025), env = [];
  for (let i = 0; i + w <= n; i += w) { let q = 0; for (let j = 0; j < w; j++) q += d[i + j] * d[i + j]; env.push(Math.sqrt(q / w)); }
  const m = env.reduce((a, b) => a + b, 0) / env.length;
  let cross = 0;
  for (let i = 1; i < env.length; i++) if ((env[i - 1] - m) * (env[i] - m) < 0) cross++;
  // energía por bandas con Goertzel sobre toda la señal (muestras decimadas a ventanas de 2048)
  const bands = {};
  for (const f of [150, 400, 800, 1500, 2500, 3500, 5000]) {
    let acc = 0, cnt = 0;
    for (let i = 0; i + 2048 <= n; i += 4096) {
      const k = (2 * Math.cos((2 * Math.PI * f) / rate)); let s1 = 0, s0 = 0;
      for (let j = 0; j < 2048; j++) { const s = d[i + j] + k * s1 - s0; s0 = s1; s1 = s; }
      acc += Math.sqrt(Math.max(0, s1 * s1 + s0 * s0 - k * s1 * s0)) / 2048; cnt++;
    }
    bands[f] = +(acc / Math.max(1, cnt)).toExponential(2);
  }
  const out = { id, dur: +dur.toFixed(2), layoutDur: +lay.dur.toFixed(2), units: lay.units.length, rms: +Math.sqrt(s2 / n).toFixed(4), peak: +pk.toFixed(3), nan: bad, active: +(env.filter((v) => v > m * 0.4).length / env.length).toFixed(2), modHz: +(cross / 2 / dur).toFixed(2), bands };
  if (o.wav) {
    const i16 = new Int16Array(n);
    for (let i = 0; i < n; i++) i16[i] = Math.max(-1, Math.min(1, d[i] * (o.gain || 4))) * 32767;
    let bin = "";
    const u8 = new Uint8Array(i16.buffer);
    for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    out.pcm = btoa(bin);
    out.rate = rate;
  }
  return out;
}
for (const ev of ["lore", "loreCollection", "loreDecrypted", "loreVoice", "loreVoiceEnd"])
  It(ev, (a, b) => { LR.log.push([ev, a && a.lid ? a.lid : a, b]); LR.log.length > 200 && LR.log.shift(); });
window.__lore = {
  api: x.loreApi,
  emit: (...a) => ee(...a),
  migrate: loreMigrate,
  LR,
  cfg: LORE_CFG,
  plan: () => LR.plan,
  state: () => x.S.lore,
  nodes: () => LR.cur,
  open: loreOpenArchive,
  layout: (id) => loreLayout(loreLines(LR.idx.get(id))),
  render: loreRenderOffline,
  grant: (id, o) => loreGrant(id, o),
  grantAll: (kinds) => LoreEntries.forEach((e) => (!kinds || kinds.includes(e.k)) && loreGrant(e.id, { quiet: true, src: "debug" })),
  decryptAll: () => LoreEntries.forEach((e) => e.k === "chip" && loreS().f[e.id] && loreDecrypt(e.id, 1)),
  tp: (id) => {
    const n = LR.cur.find((en) => en.lid === id);
    if (!n) return false;
    x.world.loadWorld({ x: n.x + 1.8, z: n.z + 2.2 });
    return true;
  },
  /** recoloca todo el mundo con otra semilla (simulaciones); devuelve el informe. Con restore=true deja la semilla original. */
  rebuild: (seed, restore) => {
    const L = loreS(), old = L.seed, m = x.map && x.map.kind !== "op" ? x.map : Po;
    seed != null && (L.seed = seed >>> 0);
    const r = loreBuildWorld(m);
    m._loreOwner = x.S;
    m._loreSeed = L.seed;
    if (restore) { L.seed = old; loreBuildWorld(m); m._loreSeed = old; }
    return r;
  },
  /** coste de la colocación (ms por llamada, media de n) y del barrido por fotograma (µs) */
  cost: (n = 20) => {
    const m = x.map && x.map.kind !== "op" ? x.map : Po;
    let t0 = performance.now();
    for (let i = 0; i < n; i++) loreBuildWorld(m);
    const build = (performance.now() - t0) / n;
    t0 = performance.now();
    for (let i = 0; i < 20000; i++) loreScan();
    return { buildMs: +build.toFixed(2), scanUs: +(((performance.now() - t0) / 20000) * 1000).toFixed(3), nodes: LR.cur.length };
  },
  /** entra en una operación (reg, tema) o en una mazmorra de escaleras (kind) y devuelve los ids de lore del mapa; leave() vuelve al mundo */
  enterOp: (reg, theme) => { x.world.loadOp(Lp({ reg, theme })); return LR.cur.map((e) => e.lid); },
  enterSub: (kind, reg) => {
    const s = (Po || x.map).ents.find((e) => e.k === "stairs" && e.kind === kind && (reg == null || e.reg === reg));
    if (!s) return null;
    x.world.enterSub(s);
    return LR.cur.map((e) => e.lid);
  },
  leave: () => (x.mode === "op" ? (x.op.sub ? x.world.leaveSub() : x.world.abortOp()) : null),
  hint: loreHintFor,
  colProgress: loreProgress,
  announce: loreAnnounce,
  voiceAt: () => (LR.voice ? loreVoiceAt(LR.voice) : null),
};

// 31e-hacking.js — Hackeo profundo (D6)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Todo lo nuevo vive aquí; los ficheros antiguos solo llaman a hackOpenTerminal (29-panels.js, función jp) y a una línea de
// 31c-gadgets.js (texto del Módulo Hacker). Los nombres propios llevan prefijo hk / HK.
//
// Resumen de piezas:
//   1. Datos           x.cfg.hack (niveles, riesgo, traza, minijuegos, programas, objetivos, recompensas)
//   2. Guardado        S.hack = {lvl, xp, tools, loadout, heat, stats} + S.hackV (migración idempotente en x.migrations)
//   3. Utilidades      RNG sembrado, nivel y XP de hackeo, estadísticas derivadas (nivel + S.talentFx)
//   4. Estilos/sonido  CSS inyectado (no toca la plantilla) y sonidos nuevos
//   5. Minijuegos      5 nuevos (cortafuegos, cifrado, enrutado, sintonía, fuerza bruta) + los 5 antiguos de 28-hack.js
//                      cada uno con gen() determinista, validate() y un bot que lo resuelve (pruebas)
//   6. Sesión          capas apilables (2-3), traza compartida, programas, bucle, pantallas previa / en curso / resultado
//   7. Objetivos       terminales (con cámaras acorazadas multicapa), torretas y drones enemigos controlables,
//                      mecánicos desactivables, chips de lore (x.loreApi), módulo «Hacker» de los gadgets
//   8. Recompensas     por riesgo y número de capas; planos de gadget (gadgetPlanDrop), XP de hackeo, programas
//   9. API y pruebas   x.hackApi, evento hackDone, window.__hack
//
// Sinergias (leídas de S.talentFx; 0 si no existe): hackSpeed, hackTraceCut, hackTools, intruder, turretDmg, turretTime.
// Contratos con otros frentes (todo opcional y defensivo): x.loreApi (chips, pistas), gadgetPlanDrop / gadgetLearn (31c),
// ecoGrantXp / Co (31a / 20-pickups). Emite: hackDone(resultado), hackLevel(nivel).

// ═══ 1. DATOS ═══════════════════════════════════════════════════════════════════════════════════════
x.cfg.hack = {
  version: 1,
  // Nivel de hackeo: XP para subir de n a n+1 = round(xpA · n^xpP). Sale de terminales, torretas, mecánicos y chips.
  maxLevel: 20,
  xpA: 16,
  xpP: 1.55,
  retroXp: 22, // XP por cada terminal ya hackeada en un guardado antiguo (migración, una sola vez)
  // Efecto de cada nivel por encima del 1
  lvl: {
    traceCut: 0.016, // −1,6 % de traza por nivel (nivel 20: −30 %; el multiplicador total nunca baja de 0,2)
    time: 0.02, // +2 % de tiempo / tolerancia por nivel (nivel 20: +38 %)
    baseSlots: 2, // programas que se pueden cargar a la vez
    slotEvery: 6, // +1 cada 6 niveles
    maxSlots: 6,
  },
  // Modo de riesgo elegido en la pantalla previa. rate = traza por segundo, fail = traza por capa fallida,
  // time = tiempo disponible, rew = botín y créditos, xp = XP de hackeo, extra = capas añadidas (tope 3)
  risk: [
    { id: 0, n: "Cauto", ic: "◔", rate: 0.7, fail: 0.8, time: 1.15, rew: 0.8, xp: 0.85, extra: 0, minLvl: 1, d: "Más tiempo y menos traza, pero el botín baja un 20 %." },
    { id: 1, n: "Estándar", ic: "◑", rate: 1, fail: 1, time: 1, rew: 1, xp: 1, extra: 0, minLvl: 1, d: "El equilibrio normal." },
    { id: 2, n: "Agresivo", ic: "◕", rate: 1.5, fail: 1.35, time: 0.85, rew: 1.8, xp: 1.7, extra: 1, minLvl: 3, d: "Una capa más, más traza y menos tiempo; el botín casi se duplica." },
  ],
  // Traza: 0-100 %. Sube con el tiempo (por dificultad 1-5, % por segundo) y con cada capa fallida o error grave.
  trace: {
    rate: [0, 0.35, 0.45, 0.55, 0.65, 0.75],
    fail: [0, 14, 16, 18, 21, 24],
    warn: 40, // «ICE detectada»: el sistema acelera (+10 % de ritmo)
    danger: 70, // «contraataque inminente»: otro +15 %
    heatPerHack: 5, // el calor del sistema sube con cada intento y se disipa con el tiempo
    heatFail: 8,
    heatMax: 30,
    heatDecay: 0.04, // puntos por segundo de juego
    heatCarry: 0.5, // fracción del calor que se hereda como traza inicial
    shortfall: { rate: 0.18, time: 0.06, max: 5 }, // por nivel que falta respecto al recomendado: traza más rápida y menos tiempo
    shock: 0.12, // contraataque: descarga (fracción de la vida máxima; nunca letal)
  },
  needByDiff: [1, 1, 4, 8, 12], // nivel de hackeo recomendado por dificultad del objetivo (índice 0 sin uso)
  // Cortafuegos (breakout) por dificultad 1-5: filas, probabilidad de bloque, filas de doble vida, velocidad (px/s), ancho de pala, vidas
  fw: { rows: [2, 3, 3, 3, 4], fill: [0.92, 0.88, 0.85, 0.8, 0.78], hp2: [0, 0, 0, 1, 1], speed: [260, 275, 290, 305, 320], padW: [90, 82, 74, 68, 62], lives: [3, 3, 3, 2, 2], speedUp: 0.012 },
  // Sintonía por dificultad: amplitud de deriva de frecuencia (af, Hz) y amplitud (aa), velocidades angulares, tolerancia relativa y tiempo de enganche (s)
  tune: { af: [0.4, 0.5, 0.65, 0.75, 0.85], wf: [0.25, 0.36, 0.43, 0.56, 0.7], aa: [0.09, 0.12, 0.15, 0.18, 0.2], wa: [0.35, 0.45, 0.55, 0.65, 0.7], ap: [0, 0, 0.8, 1.1, 1.3], wp: [0, 0, 0.3, 0.4, 0.5], k: [1.2, 1, 0.95, 0.9, 0.85], hold: [2, 2.5, 3, 3.5, 4] },
  // Fuerza bruta: notas, hueco mínimo entre notas (s), tiempo de caída (s), fallos permitidos, ventana buena y perfecta (s)
  brute: { n: [12, 15, 18, 21, 24], gap: [0.64, 0.58, 0.52, 0.46, 0.4], fall: [2, 1.8, 1.6, 1.45, 1.3], miss: [7, 7, 6, 6, 5], good: 0.2, perfect: 0.09 },
  // Minijuegos: n nombre, ic icono, time segundos por dificultad 1-5 (0 = lo gestiona el propio juego), w peso al elegir capas
  games: {
    fw: { n: "Cortafuegos", ic: "▦", nw: 1, time: [60, 65, 70, 75, 85], w: 2 },
    cipher: { n: "Cifrado por sustitución", ic: "⌗", nw: 1, time: [100, 110, 120, 130, 140], w: 2 },
    route: { n: "Enrutado de nodos", ic: "⬡", nw: 1, time: [60, 70, 80, 85, 90], w: 2 },
    tune: { n: "Sintonía de frecuencia", ic: "∿", nw: 1, time: [30, 32, 34, 36, 40], w: 2 },
    brute: { n: "Fuerza bruta a ritmo", ic: "♪", nw: 1, time: [0, 0, 0, 0, 0], w: 2 },
    seq: { n: "Secuencia de memoria", ic: "▤", nw: 0, time: [0, 0, 0, 0, 0], w: 1 },
    pipe: { n: "Enrutado de energía", ic: "⌁", nw: 0, time: [0, 0, 0, 0, 0], w: 1 },
    code: { n: "Descifrado de código", ic: "#", nw: 0, time: [0, 0, 0, 0, 0], w: 1 },
    sync: { n: "Sincronización de pulso", ic: "◉", nw: 0, time: [0, 0, 0, 0, 0], w: 1 },
    lights: { n: "Matriz de interruptores", ic: "▣", nw: 0, time: [0, 0, 0, 0, 0], w: 1 },
  },
  // Por tipo de terminal (ent.eff): capas base, +1 capa si la dificultad ≥ plusAt, XP base, texto del efecto
  eff: {
    relay: { n: "Relé de datos", layers: 1, plusAt: 3, xp: 14, d: "Descarga de datos (reutilizable)" },
    opdata: { n: "Datos de la operación", layers: 1, plusAt: 3, xp: 14, d: "Recupera datos de la operación" },
    cache: { n: "Cámara acorazada", layers: 2, plusAt: 4, xp: 26, vault: true, d: "Abre un contenedor de suministros" },
    secret: { n: "Cámara oculta", layers: 2, plusAt: 4, xp: 34, vault: true, d: "Desbloquea un acceso oculto" },
    boss: { n: "Baliza de desafío", layers: 3, plusAt: 9, xp: 48, vault: true, d: "⚠ Activa la baliza de desafío: invoca a un enemigo legendario" },
  },
  layerXp: [0, 1, 1.7, 2.6], // multiplicador de XP según capas
  // Hackeo de enemigos mecánicos. control = lo tomas (dispara a los demás); off = lo apagas unos segundos
  enemy: {
    range: 6, // m para ver el marcador
    rangeIntruder: 14, // con el talento «Intruso» (torretas y drones) y línea de visión
    scan: 0.2, // s entre barridos
    // dpsMul = daño por segundo del arma activa del jugador que añade la unidad controlada (así escala con el nivel y el equipo);
    // cd = segundos entre disparos
    control: {
      torreta: { n: "Torreta centinela", dpsMul: 2.2, cd: 0.3, xp: 16 },
      pilon: { n: "Pilón tesla", dpsMul: 1.8, cd: 0.35, xp: 16 },
      dron: { n: "Dron de combate", dpsMul: 1.2, cd: 0.5, xp: 12 },
      fisionador: { n: "Fisionador", dpsMul: 1.2, cd: 0.5, xp: 14 },
    },
    off: {
      mech: { n: "Mech de asalto", xp: 26 },
      centinela: { n: "Centinela láser", xp: 20 },
      mortero: { n: "Unidad de mortero", xp: 20 },
      tanquemec: { n: "Tanque araña", xp: 30 },
      minador: { n: "Minador", xp: 18 },
      escudero: { n: "Coloso escudado", xp: 22 },
      aranamec: { n: "Araña bomba", xp: 10 },
      reparador: { n: "Dron reparador", xp: 12 },
    },
    time: { control: 14, off: 9, perLvl: 0.8, max: 32 }, // segundos de control / apagado (+ perLvl por nivel, × talentFx.turretTime)
    overcharge: { dmg: 1.6, boom: 3.2, boomMul: 4.5 }, // modo Agresivo: más daño y explosión al terminar
    failFrenzy: 1.3, // el enemigo al que fallas el hackeo golpea un 30 % más fuerte
    needControl: 2,
    needOff: 3,
  },
  // Programas (consumibles). cost: materiales fijos y créditos × mt.credits(nivel); min = nivel de hackeo para compilarlo
  toolMax: 9,
  programs: {
    disipador: { n: "Disipador", ic: "❄", min: 1, cost: { data: 2, credits: 25 }, d: "Reduce la traza 30 puntos al instante." },
    ralentizador: { n: "Ralentizador", ic: "⏱", min: 2, cost: { data: 2, battery: 1, credits: 35 }, d: "Ralentiza el minijuego al 55 % durante 14 s." },
    oraculo: { n: "Oráculo", ic: "◉", min: 3, cost: { data: 3, crystal: 1, credits: 45 }, d: "Ayuda en la capa actual: revela letras, ensancha márgenes o resalta la ruta." },
    fantasma: { n: "Fantasma", ic: "☾", min: 5, cost: { data: 3, core: 1, credits: 60 }, d: "Durante esta capa la traza sube a la mitad y los fallos menores no suman." },
    rompehielo: { n: "Rompehielo", ic: "⚡", min: 7, cost: { data: 4, core: 1, battery: 1, credits: 90 }, d: "Supera la capa actual (dificultad ≤ 3) a cambio de 12 de traza." },
  },
  start: { tools: { disipador: 2, ralentizador: 1 } },
  // Recompensas (se multiplican por rew del riesgo y por las capas)
  reward: {
    credits: 22, // × mt.credits(nivel) × capas
    data: [1, 2, 3, 4], // material «datos» por capas (0 índice sin uso)
    programChance: [0.2, 0.35, 0.6], // por riesgo, × capas/2
    lootTier: { 2: 1, 3: 2 }, // cofre de botín (Co) a partir de 2 capas; el tier sube con riesgo agresivo
    planChance: 1, // veces que se llama a gadgetPlanDrop("hack") en hackeos de 2+ capas o agresivos
    chipXp: 0.05, // fracción de la barra de nivel que da descifrar un chip
    chipChance: [0.08, 0.14, 0.25], // por riesgo (× capas/2): una cámara acorazada con Archivo puede guardar un chip cifrado sin hallar
  },
  // Módulo «Hacker» de los gadgets (un 13.º gadget: dispositivo temporal que hackea solo)
  gadget: {
    id: "hacker",
    r: 7, // m de alcance
    life: 30, // s
    pulse: 1.2, // s entre barridos
    offSecs: 3.2, // s de apagado a mecánicos terrestres por barrido
    ctlSecs: 10, // s de control a una torreta o dron
    maxCtl: 2,
  },
  // Frases del cifrado: clave (la palabra que da la pista de archivo) y texto en claro (A-Z y espacios)
  phrases: [
    { k: "ECLIPSE", t: "LA SENAL DE ECLIPSE DESPIERTA A LA MENTE" },
    { k: "PROMETEO", t: "PROMETEO LO SABIA TODO DESDE EL PRIMER DIA" },
    { k: "ARGOS", t: "ARGOS OCULTO LA VERDAD A TODOS LOS OPERADORES" },
    { k: "CALDERA", t: "BAJO LA CALDERA DUERME UN CORAZON DE ACERO" },
    { k: "ENJAMBRE", t: "EL ENJAMBRE TIENE NOMBRE Y TIENE MEMORIA" },
    { k: "BUNKER", t: "ABRE EL BUNKER ANTES DEL AMANECER ROJO" },
    { k: "REINA", t: "LA REINA RESPONDE A UNA FRECUENCIA ANTIGUA" },
    { k: "NUCLEO", t: "DESTRUYE EL NUCLEO Y CORTA LA SENAL" },
    { k: "LABORATORIO", t: "EL LABORATORIO EMITIA UNA ORDEN CADA NOCHE" },
    { k: "COMPLEJO", t: "NADIE SALIO VIVO DEL COMPLEJO NORTE" },
    { k: "OPERADOR", t: "OPERADOR ESTE MENSAJE SE BORRARA SOLO" },
    { k: "CRATER", t: "EL CRATER GUARDA LO QUE NO DEBIO DESPERTAR" },
    { k: "MUESTRA", t: "LA MUESTRA CERO SIGUE VIVA EN EL SOTANO" },
    { k: "TRAMPA", t: "ES UNA TRAMPA LA EVACUACION NO EXISTE" },
    { k: "COLMENA", t: "LA COLMENA ESCUCHA CADA PALABRA QUE DICES" },
    { k: "ANTENA", t: "SUBE A LA ANTENA Y APAGA EL EMISOR" },
    { k: "CLAVE", t: "LA CLAVE ESTA ESCRITA EN LA ULTIMA PAGINA" },
    { k: "SOMBRA", t: "UNA SOMBRA CAMINA POR LOS PASILLOS SELLADOS" },
    { k: "REACTOR", t: "NO TOQUES EL REACTOR SIN LA TARJETA NEGRA" },
    { k: "PROYECTO", t: "EL PROYECTO NUNCA FUE UN EXPERIMENTO FUE UNA PUERTA" },
    { k: "CAMPANA", t: "CUANDO SUENE LA CAMPANA YA SERA TARDE" },
    { k: "FRECUENCIA", t: "CAMBIA LA FRECUENCIA Y ELLOS DEJARAN DE VERTE" },
  ],
};
var HK_CFG = x.cfg.hack;
var HK_NEW = ["fw", "cipher", "route", "tune", "brute"];
var HK_OLD = ["seq", "pipe", "code", "sync", "lights"];
var HK_PROG = Object.keys(HK_CFG.programs);
HK_PROG.forEach((id) => (HK_CFG.programs[id].id = id));

// ═══ 2. ESTADO Y GUARDADO ═══════════════════════════════════════════════════════════════════════════
// S.hack = {lvl, xp, tools:{programa:n}, loadout:[ids], heat, stats:{runs, ok, fail, layers, ctl, off, chips, maxRisk, byKind}}
function hkXpToNext(n) {
  return Math.round(HK_CFG.xpA * Math.pow(Math.max(1, n), HK_CFG.xpP));
}
function hkInt(v, lo, hi, d) {
  v = Number(v);
  if (!isFinite(v)) return d;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}
function hkMigrate(S) {
  const c = HK_CFG,
    first = S.hackV !== 1;
  let H = S.hack;
  if (!H || typeof H !== "object" || Array.isArray(H)) H = S.hack = {};
  H.lvl = hkInt(H.lvl, 1, c.maxLevel, 1);
  H.xp = Math.max(0, Number(H.xp) || 0);
  if (!H.tools || typeof H.tools !== "object" || Array.isArray(H.tools)) H.tools = {};
  for (const id of Object.keys(H.tools)) {
    if (!c.programs[id]) delete H.tools[id];
    else H.tools[id] = hkInt(H.tools[id], 0, c.toolMax, 0);
  }
  if (first && !Object.keys(H.tools).length) for (const id in c.start.tools) H.tools[id] = c.start.tools[id];
  H.loadout = Array.isArray(H.loadout) ? H.loadout.filter((id, i, a) => c.programs[id] && a.indexOf(id) === i).slice(0, c.lvl.maxSlots) : [];
  H.heat = Math.max(0, Math.min(c.trace.heatMax, Number(H.heat) || 0));
  H.risk = hkInt(H.risk, 0, c.risk.length - 1, 1);
  const st = H.stats && typeof H.stats === "object" && !Array.isArray(H.stats) ? H.stats : (H.stats = {});
  for (const k of ["runs", "ok", "fail", "layers", "ctl", "off", "chips", "maxRisk"]) st[k] = Math.max(0, Number(st[k]) || 0);
  if (!st.byKind || typeof st.byKind !== "object") st.byKind = {};
  if (first) {
    // guardado anterior a esta ampliación: las terminales ya hackeadas dan nivel retroactivo (una sola vez)
    const done = Math.max(0, (S.stats && S.stats.terminals) | 0);
    if (done > 0 && H.xp === 0 && H.lvl === 1) {
      H.xp = done * c.retroXp;
      st.ok = Math.max(st.ok, done);
      hkLevelFromXp(H, true);
    }
  }
  // primera vez: el kit inicial ya viene cargado (si no, el jugador no sabría que existe la pantalla de programas); tras el nivel retroactivo
  if (first && !H.loadout.length) H.loadout = Object.keys(H.tools).filter((id) => H.tools[id] > 0 && c.programs[id].min <= H.lvl).slice(0, c.lvl.baseSlots + Math.floor((H.lvl - 1) / c.lvl.slotEvery));
  S.hackV = 1;
}
x.migrations.push(hkMigrate);
// Sube de nivel mientras haya XP de sobra; quiet = sin avisos (migración)
function hkLevelFromXp(H, quiet) {
  let up = 0;
  while (H.lvl < HK_CFG.maxLevel && H.xp >= hkXpToNext(H.lvl)) {
    H.xp -= hkXpToNext(H.lvl);
    H.lvl++;
    up++;
  }
  if (H.lvl >= HK_CFG.maxLevel) H.xp = Math.min(H.xp, hkXpToNext(HK_CFG.maxLevel));
  if (up && !quiet) {
    ae.play("levelup", { v: 0.5 });
    ee("toast", `Hackeo nivel ${H.lvl}`, "good");
    ee("hackLevel", H.lvl);
  }
  return up;
}
function hkState() {
  const S = x.S;
  if (!S) return null;
  if (!S.hack || typeof S.hack !== "object" || S.hackV !== 1) hkMigrate(S);
  return S.hack;
}
function hkAddXp(n) {
  const H = hkState();
  if (!H || !(n > 0)) return 0;
  H.xp += n;
  hkLevelFromXp(H, false);
  return n;
}
function hkFx(name) {
  const f = x.S && x.S.talentFx;
  const v = f && f[name];
  return typeof v === "number" && isFinite(v) ? v : 0;
}

// ═══ 3. UTILIDADES ══════════════════════════════════════════════════════════════════════════════════
// RNG propio sembrado (el del mundo y el de Math.random no se tocan): pi() es el mulberry del juego
function hkRng(seed) {
  return pi(seed >>> 0 || 1);
}
function hkHash(str) {
  let h = 2166136261;
  str = String(str);
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
// Estadísticas derivadas del nivel de hackeo y de los talentos de Ingeniería
function hkMods() {
  const H = hkState(),
    c = HK_CFG,
    lvl = H ? H.lvl : 1;
  const speed = 1 + Math.max(-0.5, hkFx("hackSpeed")) + c.lvl.time * (lvl - 1);
  const trace = Math.max(0.2, 1 - c.lvl.traceCut * (lvl - 1) - hkFx("hackTraceCut")); // hackTraceCut negativo = más traza
  const slots = Math.min(c.lvl.maxSlots, c.lvl.baseSlots + Math.floor((lvl - 1) / c.lvl.slotEvery) + Math.max(0, hkFx("hackTools") | 0));
  return { lvl, speed, trace, slots };
}
function hkToolCount(id) {
  const H = hkState();
  return H ? H.tools[id] | 0 : 0;
}
function hkGiveTool(id, n) {
  const H = hkState();
  if (!H || !HK_CFG.programs[id]) return 0;
  const before = H.tools[id] | 0;
  H.tools[id] = Math.min(HK_CFG.toolMax, before + (n || 1));
  return H.tools[id] - before;
}
function hkTouch() {
  // táctil: el juego ya detectó un toque, o el dispositivo tiene puntero grueso (móvil/tableta)
  if (typeof Tt !== "undefined" && Tt.touchMode) return true;
  try {
    return document.body.classList.contains("touch") || !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  } catch (e) {
    return false;
  }
}
// Coste de compilar un programa (créditos × curva del juego)
function hkProgCost(id) {
  const p = HK_CFG.programs[id],
    mc = mt.credits(x.S.lvl),
    out = {};
  for (const k in p.cost) out[k] = Math.max(1, Math.round(k === "credits" ? p.cost[k] * mc : p.cost[k]));
  return out;
}
function hkCompile(id) {
  const H = hkState(),
    p = HK_CFG.programs[id];
  if (!H || !p || H.lvl < p.min || (H.tools[id] | 0) >= HK_CFG.toolMax) return false;
  const cost = hkProgCost(id);
  if (!ca(cost)) return false;
  wb(cost);
  H.tools[id] = (H.tools[id] | 0) + 1;
  ae.play("reload");
  ee("save");
  return true;
}
// calor del sistema: sube con cada intento y se disipa con el tiempo de juego
x.tick.push((dt) => {
  const H = x.S && x.S.hack;
  if (H && H.heat > 0) H.heat = Math.max(0, H.heat - HK_CFG.trace.heatDecay * dt);
});

// ═══ 4. ESTILOS Y SONIDO ════════════════════════════════════════════════════════════════════════════
// CSS inyectado (no toca la plantilla). Móvil primero: zonas táctiles grandes y diseño en dos columnas en apaisado.
(function hkCss() {
  const st = document.createElement("style");
  st.id = "hkCss";
  st.textContent = `
.hk .wbody{display:flex;flex-direction:column;gap:10px;padding:10px 12px}
.hk-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hk-trace{flex:1 1 200px;min-width:150px}
.hk-trace .lb{display:flex;justify-content:space-between;font:700 11px var(--f-disp);letter-spacing:.14em;color:var(--muted);margin-bottom:2px}
.hk-trace .lb b{color:var(--cyan)}
.hk-trace .bar{position:relative;height:16px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.12);overflow:hidden}
.hk-trace .bar i{position:absolute;left:0;top:0;bottom:0;display:block;background:linear-gradient(90deg,#1d8aa6,#46e4ff);transition:width .15s linear}
.hk-trace .bar u{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.45)}
.hk-trace.w .bar i{background:linear-gradient(90deg,#b8862a,#ffb340)} .hk-trace.w .lb b{color:var(--amber)}
.hk-trace.d .bar i{background:linear-gradient(90deg,#a01626,#ff3d4f);animation:hkPulse .7s ease-in-out infinite alternate} .hk-trace.d .lb b{color:var(--bad)}
@keyframes hkPulse{from{filter:brightness(.8)}to{filter:brightness(1.4)}}
.hk-layers{display:flex;gap:6px}
.hk-layers b{width:28px;height:28px;display:grid;place-items:center;border:1px solid var(--line2);font:700 12px var(--f-disp);color:var(--muted);background:rgba(0,0,0,.35)}
.hk-layers b.on{border-color:var(--cyan);color:var(--cyan)} .hk-layers b.ok{border-color:var(--good);background:rgba(95,211,90,.2);color:var(--good)}
.hk-time{font:700 22px var(--f-disp);color:var(--cyan);min-width:54px;text-align:right;font-variant-numeric:tabular-nums}
.hk-time.lo{color:var(--bad)}
.hk-info{font:600 13px var(--f-disp);color:var(--muted);letter-spacing:.05em;text-align:center;min-height:18px;line-height:1.3}
.hk-game{position:relative;flex:1 1 auto;height:clamp(250px,52vh,470px);min-height:200px;display:flex;align-items:center;justify-content:center;touch-action:none;overflow:hidden}
.hk-game.dom{align-items:flex-start;overflow:auto;touch-action:pan-y}
.hk-cv{display:block;background:#04090c;border:1px solid rgba(70,228,255,.32);touch-action:none;-webkit-user-select:none;user-select:none;box-shadow:0 0 24px rgba(70,228,255,.08)}
.hk-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.hk-tool{min-width:78px;min-height:50px;padding:4px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:#10191d;color:var(--text);border:1px solid rgba(70,228,255,.35);font:700 11px var(--f-disp);letter-spacing:.04em;touch-action:manipulation}
.hk-tool b{font-size:18px;line-height:1;color:var(--cyan)} .hk-tool i{font-style:normal;color:var(--amber);font-size:11px}
.hk-tool:disabled{opacity:.35}
.hk-foot{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.hk-msg{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;pointer-events:none;font:700 clamp(20px,5vw,34px) var(--f-disp);letter-spacing:.14em;text-shadow:0 0 22px currentColor,0 2px 0 #000;animation:hkMsg .9s ease both}
@keyframes hkMsg{0%{opacity:0;transform:translateY(-30%) scale(.9)}15%{opacity:1;transform:translateY(-50%) scale(1)}80%{opacity:1}100%{opacity:0}}
.hk-card{border:1px solid var(--line2);background:var(--panel2);padding:10px 12px}
.hk-card h3{margin:0 0 4px;font:700 14px var(--f-disp);letter-spacing:.1em;text-transform:uppercase;color:var(--amber)}
.hk-pre{display:flex;flex-direction:column;gap:10px}
.hk-lay{display:flex;flex-wrap:wrap;gap:6px}
.hk-lay span{display:inline-flex;gap:6px;align-items:center;border:1px solid rgba(70,228,255,.3);padding:5px 9px;font:600 13px var(--f-disp);background:rgba(0,0,0,.3)}
.hk-lay span b{color:var(--cyan)}
.hk-risk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.hk-risk button{min-height:64px;padding:6px;border:1px solid var(--line2);background:#10191d;color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:700 13px var(--f-disp);touch-action:manipulation}
.hk-risk button b{font-size:20px;color:var(--cyan)} .hk-risk button small{font:500 11px var(--f-body);color:var(--muted);text-align:center;line-height:1.2}
.hk-risk button.on{border-color:var(--amber);background:rgba(255,179,64,.14)} .hk-risk button.on b{color:var(--amber)}
.hk-risk button:disabled{opacity:.4}
.hk-progs{display:flex;flex-wrap:wrap;gap:8px}
.hk-pg{flex:1 1 150px;min-height:58px;display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--line2);background:#10191d;color:var(--text);text-align:left;touch-action:manipulation}
.hk-pg b{font-size:22px;color:var(--cyan);width:26px;text-align:center;flex:none} .hk-pg span{flex:1;min-width:0;font:600 13px var(--f-disp)} .hk-pg span small{display:block;font:500 11px var(--f-body);color:var(--muted);line-height:1.2}
.hk-pg i{font:700 14px var(--f-disp);font-style:normal;color:var(--amber)}
.hk-pg.on{border-color:var(--cyan);background:rgba(70,228,255,.12)} .hk-pg:disabled{opacity:.4}
.hk-kv{display:flex;flex-wrap:wrap;gap:4px 16px;font:600 13px var(--f-disp);color:var(--muted)} .hk-kv b{color:var(--text)}
.hk-big{min-height:52px;font-size:17px !important;letter-spacing:.12em}
.hk-res{display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center;padding:6px 0}
.hk-res h2{margin:0;font:700 clamp(24px,5vw,38px) var(--f-disp);letter-spacing:.16em;text-transform:uppercase}
.hk-res ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px;font:600 14px var(--f-disp)}
.hk-res li b{color:var(--amber2)}
.hk-xp{width:min(320px,80%);height:8px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.12);overflow:hidden}
.hk-xp i{display:block;height:100%;background:var(--xp)}
/* cifrado */
.cp{display:flex;flex-direction:column;gap:10px;align-items:center;width:100%;padding:2px 0}
.cp-txt{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:center;max-width:100%}
.cp-w{display:flex;gap:3px}
.cp-l{width:28px;height:50px;padding:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:#0b1418;border:1px solid rgba(255,179,64,.3);color:var(--amber);font:700 17px var(--f-disp);touch-action:manipulation}
.cp-l span{display:block;width:100%;line-height:24px;height:24px}
.cp-l .g{color:var(--cyan);border-top:1px solid rgba(255,255,255,.1);background:rgba(70,228,255,.06)}
.cp-l.sel{border-color:var(--cyan);box-shadow:0 0 0 2px rgba(70,228,255,.5),0 0 14px rgba(70,228,255,.4)}
.cp-l.fix .g{color:var(--good);background:rgba(95,211,90,.1)}
.cp-l.bad{border-color:var(--bad)} .cp-l.crib{border-bottom:3px solid var(--amber)}
.cp-keys{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px;width:min(100%,520px)}
.cp-k{min-height:42px;padding:0;background:#10191d;color:var(--text);border:1px solid rgba(70,228,255,.28);font:700 17px var(--f-disp);touch-action:manipulation}
.cp-k.used{color:var(--dim);border-color:rgba(255,255,255,.08)} .cp-k.ok{background:var(--cyan);color:#041014}
.cp-k.wide{grid-column:span 2}
.cp-hint{font:600 13px var(--f-disp);color:var(--amber2);text-align:center;line-height:1.35;max-width:560px}
.cp-hint em{font-style:normal;color:var(--cyan)}
.cp-act{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
/* enrutado de nodos */
.rt{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;height:100%;justify-content:center}
.rt svg{display:block;touch-action:manipulation;max-width:100%;max-height:calc(100% - 44px);aspect-ratio:1;width:min(100%,520px);height:auto;background:#04090c;border:1px solid rgba(70,228,255,.32)}
.rt-bar{display:flex;gap:10px;align-items:center;font:700 13px var(--f-disp);color:var(--muted);flex-wrap:wrap;justify-content:center}
.rt-bar b{color:var(--cyan)} .rt-bar .over{color:var(--bad)}
.rt-node{cursor:pointer}
/* sintonía */
.tn{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%;height:100%;min-height:0}
.tn canvas{width:min(100%,520px);flex:1.1 1 70px;min-height:60px;height:0}
.tn-pad{position:relative;width:min(100%,520px);flex:1 1 90px;min-height:72px;max-height:190px;background:linear-gradient(180deg,#0a141a,#05090c);border:1px solid rgba(255,179,64,.45);touch-action:none}
.tn-pad i{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:2px solid var(--amber);background:rgba(255,179,64,.25);box-shadow:0 0 14px var(--amber);pointer-events:none}
.tn-pad span,.tn-sl span{position:absolute;left:6px;top:3px;font:600 10px var(--f-disp);letter-spacing:.14em;color:var(--dim);pointer-events:none}
.tn-sl{position:relative;width:min(100%,520px);height:46px;background:#070d10;border:1px solid rgba(255,179,64,.45);touch-action:none;flex:none}
.tn-sl i{position:absolute;top:5px;width:30px;height:34px;margin-left:-15px;background:rgba(255,179,64,.25);border:2px solid var(--amber);pointer-events:none}
/* fuerza bruta */
.bf{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;height:100%;justify-content:center}
.bf-pw{font:700 clamp(16px,4.6vw,24px) 'Courier New',monospace;letter-spacing:.18em;color:var(--good);text-shadow:0 0 10px rgba(95,211,90,.5)}
@media (orientation:landscape) and (max-height:520px){
  .hk .wbody.run{display:grid;grid-template-columns:minmax(0,1fr) minmax(190px,250px);grid-template-areas:"game bar" "game info" "game tools" "game foot";grid-template-rows:auto auto 1fr auto;gap:6px 12px;padding:6px 10px}
  .wbody.run .hk-bar{grid-area:bar;flex-direction:column;align-items:stretch;gap:6px} .wbody.run .hk-trace{flex:none} .wbody.run .hk-time{text-align:left}
  .wbody.run .hk-info{grid-area:info;font-size:12px} .wbody.run .hk-game{grid-area:game;height:auto;min-height:0;align-self:stretch} .wbody.run .hk-tools{grid-area:tools;align-content:flex-start} .wbody.run .hk-foot{grid-area:foot}
  .hk-tool{min-width:70px;min-height:46px}
  .cp-l{width:26px;height:44px;font-size:15px} .cp-l span{line-height:21px;height:21px} .cp-k{min-height:38px} .cp{gap:6px} .cp-hint{font-size:12px}
  .hk-pre{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 12px} .hk-pre>.full{grid-column:1/-1}
}
.hk-pre .hk-foot{position:sticky;bottom:-8px;z-index:3;padding:8px 0 6px;background:linear-gradient(180deg,rgba(13,18,21,0),var(--panel) 28%)}
@media (max-width:760px),(max-height:520px){
  .hk-game{height:auto;flex:1 1 0;min-height:150px} .hk-big{min-height:56px}
}
@media (max-width:420px){ .cp-l{width:24px;height:46px;font-size:15px} .cp-w{gap:2px} }
body.hkhit #hurt{box-shadow:inset 0 0 160px rgba(255,0,40,.55) !important}
.hk-mark{position:fixed;z-index:21;left:0;top:0;transform:translate(-50%,-100%);pointer-events:auto;display:none;touch-action:manipulation}
.hk-mark button{display:flex;align-items:center;gap:6px;min-height:44px;padding:4px 12px 4px 8px;background:rgba(6,16,20,.88);border:1px solid var(--cyan);color:var(--cyan);font:700 13px var(--f-disp);letter-spacing:.08em;box-shadow:0 0 16px rgba(70,228,255,.35);touch-action:manipulation}
.hk-mark button b{font-size:20px;line-height:1} .hk-mark button small{display:block;font:500 10px var(--f-body);color:var(--muted);letter-spacing:.02em}
.hk-mark button kbd{font:700 11px var(--f-disp);color:#041014;background:var(--cyan);padding:0 5px;margin-left:2px}
.hk-mark.low button{border-color:var(--amber);color:var(--amber)}
.hk-mark::after{content:"";position:absolute;left:50%;bottom:-7px;width:2px;height:7px;background:var(--cyan)}
body:has(#panel:not([hidden])) .hk-mark{display:none !important}
`;
  document.head.appendChild(st);
})();

// Sonidos nuevos (se añaden a la tabla del juego)
_w.hkIce = (n, e) => {
  $e(n, "sawtooth", 190, 80, 0.3, 0.1 * e);
  Dt(n, 0.25, 0.14 * e, "bandpass", 600, 2, 180);
};
_w.hkLock = (n, e) => {
  [880, 1320, 1760].forEach((f, i) => $e(n + i * 0.07, "square", f, f, 0.1, 0.05 * e));
  $e(n + 0.3, "sine", 440, 880, 0.3, 0.08 * e);
};
_w.hkTick = (n, e, t) => {
  $e(n, "square", 1500 * t, 1500 * t, 0.025, 0.04 * e);
};
_w.hkCtl = (n, e) => {
  $e(n, "sine", 200, 900, 0.35, 0.12 * e);
  [660, 990].forEach((f, i) => $e(n + 0.2 + i * 0.08, "triangle", f, f, 0.2, 0.08 * e));
};
_w.hkOff = (n, e) => {
  $e(n, "sawtooth", 600, 60, 0.5, 0.12 * e);
  Dt(n, 0.3, 0.2 * e, "lowpass", 2400, 1, 120);
};
function hkSfx(name, opts) {
  try {
    ae.play(name, opts);
  } catch (e) {
    /* sin audio: no es crítico */
  }
}

// ═══ 5. MINIJUEGOS ══════════════════════════════════════════════════════════════════════════════════
// Interfaz común. HK_GAMES[kind] = { gen(seed, diff), validate(seed, diff), mount(root, ctx) → juego }.
//   ctx = { diff, seed, spd (≥ 1: más tiempo / más margen por nivel y talentos), touch, win(), fail(motivo), err(puntos, motivo),
//           info(texto), sfx(nombre, opts), tick() }
//   juego = { step(dt), destroy(), assist() → bool (el Oráculo), bot?(dt) (solo para pruebas) }
// Todos se juegan con un dedo (eventos de puntero, zonas grandes) y tienen alternativa de teclado en escritorio.
var HK_GAMES = {};

function hkShuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1)),
      t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
// Lienzo con tamaño lógico fijo (W × H) que se adapta al contenedor; pos() convierte un evento de puntero a coordenadas lógicas
function hkMakeCanvas(root, W, H) {
  const cv = document.createElement("canvas"),
    dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.className = "hk-cv";
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  root.appendChild(cv);
  const fit = () => {
    const rw = root.clientWidth || W,
      rh = root.clientHeight || H;
    const k = Math.max(0.3, Math.min(rw / W, rh / H, 2.4));
    cv.style.width = Math.floor(W * k) + "px";
    cv.style.height = Math.floor(H * k) + "px";
  };
  fit();
  window.addEventListener("resize", fit);
  const pos = (ev) => {
    const r = cv.getBoundingClientRect();
    return [((ev.clientX - r.left) / (r.width || 1)) * W, ((ev.clientY - r.top) / (r.height || 1)) * H];
  };
  return { cv, g, W, H, fit, pos, dispose: () => window.removeEventListener("resize", fit) };
}

// ── 5.1 Cortafuegos (tipo breakout) ──────────────────────────────────────────────────────────────────
// La defensa del sistema son bloques; tu cortafuegos devuelve el paquete. Arrastra en cualquier parte para mover la pala.
var HK_FW = { W: 300, H: 380, cols: 7, bw: 38, bh: 15, gap: 3, left: 8, top: 34 };
function hkFwGen(seed, diff) {
  const r = hkRng(seed ^ 0x51ed),
    F = HK_FW,
    C = HK_CFG.fw,
    d = diff - 1;
  const rows = C.rows[d],
    fill = C.fill[d],
    bricks = [];
  for (let rr = 0; rr < rows; rr++)
    for (let c = 0; c < F.cols; c++) {
      if (rr > 0 && r() > fill) continue;
      bricks.push({ c, r: rr, hp: rr < C.hp2[d] ? 2 : 1 });
    }
  return { bricks, padW: C.padW[d], speed: C.speed[d], lives: C.lives[d], ang: (r() - 0.5) * 0.7, seed };
}
class HkFwSim {
  constructor(L, mul) {
    const F = HK_FW;
    this.L = L;
    this.bricks = L.bricks.map((b) => ({ x: F.left + b.c * (F.bw + F.gap), y: F.top + b.r * (F.bh + F.gap), hp: b.hp, hp0: b.hp, r: b.r }));
    this.alive = this.bricks.length;
    this.padW = L.padW;
    this.padH = 8;
    this.padY = F.H - 26;
    this.padX = F.W / 2;
    this.padTo = this.padX;
    this.sp = L.speed / Math.max(1, 1 + (mul - 1) * 0.6);
    this.lives = L.lives;
    this.t = 0;
    this.stuckT = 0;
    this.over = 0; // 0 en juego, 1 victoria, -1 derrota
    this.destroyed = 0;
    this.rng = hkRng(L.seed ^ 0x77);
    this.ev = [];
    this.ball = { x: this.padX, y: this.padY - this.padH / 2 - 5, vx: 0, vy: 0, r: 5, stuck: true };
  }
  launch() {
    const b = this.ball;
    if (!b.stuck) return;
    b.stuck = false;
    b.vx = Math.sin(this.L.ang) * this.sp;
    b.vy = -Math.cos(this.L.ang) * this.sp;
  }
  assist() {
    this.padW = Math.min(150, this.padW * 1.6);
    this.sp *= 0.85;
  }
  step(dt) {
    if (this.over) return;
    const F = HK_FW,
      b = this.ball;
    this.t += dt;
    const d = this.padTo - this.padX,
      mx = 950 * dt;
    this.padX += Math.abs(d) <= mx ? d : Math.sign(d) * mx;
    this.padX = Math.max(this.padW / 2, Math.min(F.W - this.padW / 2, this.padX));
    if (b.stuck) {
      b.x = this.padX;
      b.y = this.padY - this.padH / 2 - b.r;
      this.stuckT += dt;
      if (this.stuckT > 1.4) this.launch();
      return;
    }
    const sp = this.sp * (1 + Math.min(0.35, this.destroyed * HK_CFG.fw.speedUp)),
      n = Math.max(1, Math.ceil((sp * dt) / 3)),
      h = dt / n;
    for (let i = 0; i < n && !this.over && !b.stuck; i++) this.sub(h, sp);
  }
  sub(h, sp) {
    const F = HK_FW,
      b = this.ball;
    const k = sp / (Math.hypot(b.vx, b.vy) || 1);
    b.vx *= k;
    b.vy *= k;
    const px = b.x,
      py = b.y;
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.x < b.r) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
      this.ev.push("wall");
    } else if (b.x > F.W - b.r) {
      b.x = F.W - b.r;
      b.vx = -Math.abs(b.vx);
      this.ev.push("wall");
    }
    if (b.y < b.r) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
      this.ev.push("wall");
    }
    const pt = this.padY - this.padH / 2;
    if (b.vy > 0 && b.y + b.r >= pt && py + b.r <= pt + 4 && Math.abs(b.x - this.padX) <= this.padW / 2 + b.r) {
      const a = Math.max(-1, Math.min(1, (b.x - this.padX) / (this.padW / 2))) * 1.0 + (this.rng() - 0.5) * 0.08;
      b.vx = Math.sin(a) * sp;
      b.vy = -Math.cos(a) * sp;
      b.y = pt - b.r;
      this.ev.push("pad");
    }
    if (b.y - b.r > F.H) {
      this.lives--;
      this.ev.push("lost");
      if (this.lives <= 0) this.over = -1;
      else {
        b.stuck = true;
        this.stuckT = 0;
      }
      return;
    }
    for (let i = 0; i < this.bricks.length; i++) {
      const q = this.bricks[i];
      if (q.hp <= 0) continue;
      const nx = Math.max(q.x, Math.min(q.x + F.bw, b.x)),
        ny = Math.max(q.y, Math.min(q.y + F.bh, b.y));
      const dx = b.x - nx,
        dy = b.y - ny;
      if (dx * dx + dy * dy > b.r * b.r) continue;
      if (px >= q.x && px <= q.x + F.bw) b.vy = -b.vy;
      else b.vx = -b.vx;
      // vuelve a la posición previa (que no solapaba) para no quedar incrustada
      b.x = px;
      b.y = py;
      if (Math.abs(b.vy) < 0.28 * sp) b.vy = (b.vy < 0 ? -1 : 1) * 0.28 * sp;
      q.hp--;
      if (q.hp <= 0) {
        this.alive--;
        this.destroyed++;
        this.ev.push("brick");
        if (this.alive <= 0) this.over = 1;
      } else this.ev.push("hit");
      break;
    }
  }
  // Bot: apunta la bola hacia el bloque vivo más bajo. err = error de puntería en radianes (humano ≈ 0,15).
  // casual = solo devuelve la bola (golpe aleatorio con la pala): el jugador que no apunta
  bot(err, casual, noise) {
    const F = HK_FW,
      b = this.ball,
      pt = this.padY - this.padH / 2;
    // el error de posición de la pala cambia en cada rebote (noise = píxeles máximos), como el pulso de un jugador real
    if (noise && this._lvy <= 0 && b.vy > 0) this._bias = (this.rng() - 0.5) * 2 * noise;
    this._lvy = b.vy;
    if (b.stuck) {
      this.padTo = this.padX;
      this.launch();
      return;
    }
    if (b.vy <= 0) {
      this.padTo = b.x;
      return;
    }
    const t = (pt - b.y) / b.vy,
      W = F.W - 2 * b.r;
    let lx = ((((b.x - b.r + b.vx * t) % (2 * W)) + 2 * W) % (2 * W));
    if (lx > W) lx = 2 * W - lx;
    lx += b.r;
    // objetivo: el bloque vivo más bajo y más cercano a la bola
    let tgt = null;
    if (!casual) for (const q of this.bricks) if (q.hp > 0 && (!tgt || q.y > tgt.y || (q.y === tgt.y && Math.abs(q.x - lx) < Math.abs(tgt.x - lx)))) tgt = q;
    let off = casual ? (this.rng() - 0.5) * 1.7 : 0;
    if (tgt) {
      const a = Math.atan2(tgt.x + F.bw / 2 - lx, pt - (tgt.y + F.bh));
      off = Math.max(-0.9, Math.min(0.9, a)) + (this.rng() - 0.5) * 2 * err;
      off = Math.max(-1, Math.min(1, off));
    }
    this.padTo = lx - off * (this.padW / 2) + (this._bias || 0);
  }
}
HK_GAMES.fw = {
  gen: hkFwGen,
  validate(seed, diff) {
    const L = hkFwGen(seed, diff),
      sim = new HkFwSim(L, 1);
    let guard = 0;
    while (!sim.over && sim.t < 160 && guard++ < 40000) {
      sim.bot(0.12);
      sim.step(1 / 120);
    }
    return { ok: sim.over === 1, t: +sim.t.toFixed(1), bricks: L.bricks.length, lives: sim.lives };
  },
  mount(root, ctx) {
    const F = HK_FW,
      L = hkFwGen(ctx.seed, ctx.diff),
      sim = new HkFwSim(L, ctx.spd);
    const C = hkMakeCanvas(root, F.W, F.H),
      g = C.g;
    const keys = { l: 0, r: 0 };
    let grab = null,
      dead = false;
    const down = (e) => {
      e.preventDefault();
      try {
        C.cv.setPointerCapture(e.pointerId);
      } catch (_) {
        /* sin captura */
      }
      const [lx] = C.pos(e);
      grab = lx - sim.padTo;
      if (sim.ball.stuck) sim.launch();
    };
    const move = (e) => {
      const [lx] = C.pos(e);
      if (grab !== null) sim.padTo = lx - grab;
      else if (e.pointerType === "mouse") sim.padTo = lx;
    };
    const up = () => (grab = null);
    C.cv.addEventListener("pointerdown", down);
    C.cv.addEventListener("pointermove", move);
    C.cv.addEventListener("pointerup", up);
    C.cv.addEventListener("pointercancel", up);
    const kd = (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.l = 1;
      else if (e.code === "ArrowRight" || e.code === "KeyD") keys.r = 1;
      else if (e.code === "Space" || e.code === "Enter") sim.launch();
      else return;
      e.preventDefault();
    };
    const ku = (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.l = 0;
      else if (e.code === "ArrowRight" || e.code === "KeyD") keys.r = 0;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    ctx.info(hkTouch() ? "ARRASTRA PARA MOVER EL CORTAFUEGOS · TOCA PARA LANZAR" : "RATÓN O ←/→ PARA MOVER · CLIC O ESPACIO PARA LANZAR");
    const hue = (r) => 190 + r * 24;
    const draw = () => {
      g.clearRect(0, 0, F.W, F.H);
      g.fillStyle = "#04090c";
      g.fillRect(0, 0, F.W, F.H);
      g.strokeStyle = "rgba(70,228,255,.06)";
      g.lineWidth = 1;
      for (let i = 0; i <= F.W; i += 30) {
        g.beginPath();
        g.moveTo(i + 0.5, 0);
        g.lineTo(i + 0.5, F.H);
        g.stroke();
      }
      for (let j = 0; j <= F.H; j += 30) {
        g.beginPath();
        g.moveTo(0, j + 0.5);
        g.lineTo(F.W, j + 0.5);
        g.stroke();
      }
      for (const q of sim.bricks) {
        if (q.hp <= 0) continue;
        g.fillStyle = `hsl(${hue(q.r)} 80% ${q.hp > 1 ? 62 : 44}%)`;
        g.shadowColor = g.fillStyle;
        g.shadowBlur = 6;
        g.fillRect(q.x, q.y, F.bw, F.bh);
        g.shadowBlur = 0;
        if (q.hp > 1) {
          g.strokeStyle = "#fff";
          g.lineWidth = 1.5;
          g.strokeRect(q.x + 1, q.y + 1, F.bw - 2, F.bh - 2);
        }
      }
      const pt = sim.padY - sim.padH / 2;
      g.fillStyle = "#ffb340";
      g.shadowColor = "#ffb340";
      g.shadowBlur = 10;
      g.fillRect(sim.padX - sim.padW / 2, pt, sim.padW, sim.padH);
      g.shadowBlur = 0;
      const b = sim.ball;
      g.fillStyle = "#fff";
      g.shadowColor = "#46e4ff";
      g.shadowBlur = 12;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, 6.2832);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#46e4ff";
      for (let i = 0; i < sim.lives; i++) g.fillRect(8 + i * 14, F.H - 12, 10, 5);
      g.fillStyle = "rgba(255,255,255,.55)";
      g.font = '700 10px "Chakra Petch", sans-serif';
      g.textAlign = "right";
      g.fillText(`BLOQUES ${sim.alive}`, F.W - 8, F.H - 7);
      g.textAlign = "left";
    };
    draw();
    return {
      step(dt) {
        if (dead) return;
        if (keys.l || keys.r) sim.padTo += (keys.r - keys.l) * 440 * dt;
        sim.step(dt);
        for (const e of sim.ev) {
          if (e === "brick") ctx.sfx("beep", { p: 1.3 + sim.destroyed * 0.01, gap: 0.02 });
          else if (e === "hit") ctx.sfx("metal", { v: 0.3, gap: 0.04 });
          else if (e === "pad") ctx.sfx("beep", { p: 0.8, gap: 0.03 });
          else if (e === "lost") {
            ctx.sfx("err");
            ctx.err(4, "bola perdida");
          }
        }
        sim.ev.length = 0;
        draw();
        if (sim.over === 1) {
          dead = true;
          ctx.win();
        } else if (sim.over === -1) {
          dead = true;
          ctx.fail("sin vidas");
        }
      },
      destroy() {
        dead = true;
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        C.dispose();
      },
      assist() {
        sim.assist();
        return true;
      },
      bot() {
        sim.bot(0.1);
      },
      sim,
    };
  },
};

// ── 5.2 Cifrado por sustitución con pista del archivo ───────────────────────────────────────────────
// Cada letra del mensaje está cambiada por otra. Toca una letra cifrada y luego la que crees que es. La pista sale del
// archivo de lore: la palabra clave (si has leído lo suficiente, o x.loreApi.hintFor la ofrece) o su forma.
function hkLoreBonus() {
  const S = x.S,
    A = x.loreApi;
  let n = S && Array.isArray(S.lore) ? S.lore.length : 0,
    word = null;
  try {
    if (A) {
      // entradas halladas en el Archivo (libros, chips y grabaciones): cuanto más has leído, más letras te regala el cifrado
      if (Array.isArray(A.entries) && typeof A.has === "function") {
        let k = 0;
        for (const e of A.entries) if (A.has(e.id)) k++;
        n = Math.max(n, k);
      }
      // la clave de supervisión de ARGOS: solo ayuda si ya la has leído (known); si no, el cifrado no la menciona
      const h = typeof A.hintFor === "function" ? A.hintFor("complejo.clave") : null;
      if (h && h.known && h.kind === "word" && /^[A-Z]{3,12}$/.test(String(h.value))) word = String(h.value);
    }
  } catch (e) {
    word = null;
  }
  return { letters: Math.min(3, Math.floor(n / 5)), word, read: n };
}
function hkCipherGen(seed, diff) {
  const r = hkRng(seed ^ 0xc1f3),
    P = HK_CFG.phrases[Math.floor(r() * HK_CFG.phrases.length)];
  const lb = hkLoreBonus();
  // con la clave de ARGOS en el Archivo, el mensaje termina con ella (y sus letras vienen puestas)
  const plain = lb.word ? P.t + " CLAVE " + lb.word : P.t,
    used = [...new Set(plain.replace(/ /g, "").split(""))];
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  let perm = null;
  for (let k = 0; k < 60 && !perm; k++) {
    const q = hkShuffle(A.slice(), r);
    if (A.every((ch, i) => q[i] !== ch)) perm = q;
  }
  if (!perm) perm = A.map((_, i) => A[(i + 7) % 26]);
  const map = {},
    inv = {};
  A.forEach((ch, i) => (map[ch] = perm[i]));
  for (const ch of used) inv[map[ch]] = ch;
  const cipher = plain
    .split("")
    .map((ch) => (ch === " " ? " " : map[ch]))
    .join("");
  const frac = [0.45, 0.38, 0.3, 0.22, 0.15][diff - 1];
  const wordL = lb.word ? [...new Set(lb.word.split(""))] : [];
  const cribL = [...new Set(P.k.split(""))];
  const order = wordL.concat(
    hkShuffle(
      cribL.filter((c) => !wordL.includes(c)),
      r,
    ),
    hkShuffle(
      used.filter((c) => !cribL.includes(c) && !wordL.includes(c)),
      r,
    ),
  );
  const nRev = Math.min(used.length - 3, Math.max(Math.max(2, Math.round(used.length * frac)) + lb.letters, wordL.length));
  const reveal = order.slice(0, nRev).map((ch) => map[ch]);
  const knows = diff <= 2 || lb.letters >= 1;
  let hint = knows
    ? `Pista del archivo: el mensaje contiene la palabra «${P.k}».`
    : `Pista del archivo: hay una palabra de ${P.k.length} letras que empieza por «${P.k[0]}».`;
  if (lb.word) hint += ` Termina con la clave de supervisión de ARGOS que anotaste: «${lb.word}».`;
  return { plain, cipher, map, inv, used, crib: P.k, reveal, hint, word: lb.word, seed };
}
HK_GAMES.cipher = {
  gen: hkCipherGen,
  validate(seed, diff) {
    const G = hkCipherGen(seed, diff);
    const bij = new Set(Object.values(G.map)).size === 26;
    const rt = G.cipher
      .split("")
      .map((c) => (c === " " ? " " : G.inv[c]))
      .join("");
    const okPlain = rt === G.plain && G.plain.includes(G.crib);
    const okRev = G.reveal.every((c) => G.inv[c]) && G.reveal.length >= 2 && G.reveal.length < G.used.length;
    const noSelf = G.used.every((ch) => G.map[ch] !== ch);
    return { ok: bij && okPlain && okRev && noSelf, letters: G.used.length, revealed: G.reveal.length };
  },
  mount(root, ctx) {
    const G = hkCipherGen(ctx.seed, ctx.diff);
    root.classList.add("dom");
    const guess = {},
      fixed = {};
    for (const c of G.reveal) {
      guess[c] = G.inv[c];
      fixed[c] = 1;
    }
    const cl = [...new Set(G.cipher.replace(/ /g, "").split(""))]; // letras cifradas en orden de lectura
    const el = document.createElement("div");
    el.className = "cp";
    const words = G.cipher.split(" "),
      pw = G.plain.split(" ");
    // la palabra clave de la pista va subrayada: dónde está, no qué letras la forman
    const wordHtml = words
      .map((w, i) => {
        const inCrib = pw[i] === G.crib;
        return `<div class="cp-w">${w
          .split("")
          .map((c) => `<button class="cp-l${inCrib ? " crib" : ""}" data-c="${c}" aria-label="Letra cifrada ${c}"><span>${c}</span><span class="g"></span></button>`)
          .join("")}</div>`;
      })
      .join("");
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    el.innerHTML = `<div class="cp-hint">${ke(G.hint)}</div><div class="cp-txt">${wordHtml}</div><div class="cp-keys">${A.map((a) => `<button class="cp-k" data-k="${a}">${a}</button>`).join("")}<button class="cp-k" data-k="-" aria-label="Borrar">⌫</button></div>`;
    root.appendChild(el);
    let sel = null,
      bad = 0,
      dead = false;
    const tiles = [...el.querySelectorAll(".cp-l")],
      keysEl = [...el.querySelectorAll(".cp-k")];
    const nextOpen = (from) => {
      const i0 = from ? cl.indexOf(from) : -1;
      for (let k = 1; k <= cl.length; k++) {
        const c = cl[(i0 + k + cl.length) % cl.length];
        if (!guess[c]) return c;
      }
      return null;
    };
    const paint = () => {
      for (const t of tiles) {
        const c = t.dataset.c;
        t.querySelector(".g").textContent = guess[c] || "";
        t.classList.toggle("sel", c === sel);
        t.classList.toggle("fix", !!fixed[c]);
      }
      const used = new Set(Object.values(guess));
      for (const k of keysEl) k.classList.toggle("used", used.has(k.dataset.k));
    };
    const total = () => cl.length;
    const check = () => {
      if (Object.keys(guess).length < total()) return;
      let wrong = 0;
      for (const c of cl) if (guess[c] !== G.inv[c]) wrong++;
      if (!wrong) {
        dead = true;
        ctx.win();
        return;
      }
      bad++;
      ctx.sfx("err");
      ctx.err(5, "verificación fallida");
      ctx.info(`${wrong} LETRA${wrong > 1 ? "S" : ""} INCORRECTA${wrong > 1 ? "S" : ""} · VERIFICACIONES FALLIDAS ${bad}/4`);
      if (bad >= 4) {
        dead = true;
        ctx.fail("demasiados intentos");
      }
    };
    const assign = (ch) => {
      if (dead || !sel || fixed[sel]) return;
      if (ch === "-") {
        delete guess[sel];
        ctx.sfx("hkTick", { p: 0.7, gap: 0.01 });
        paint();
        return;
      }
      for (const c in guess) if (guess[c] === ch) {
        if (fixed[c]) {
          ctx.sfx("err", { v: 0.4 });
          return;
        }
        delete guess[c];
      }
      guess[sel] = ch;
      ctx.sfx("hkTick", { gap: 0.01 });
      sel = nextOpen(sel);
      paint();
      check();
    };
    tiles.forEach((t) =>
      t.addEventListener("click", () => {
        if (dead) return;
        sel = t.dataset.c;
        ctx.sfx("hkTick", { p: 1.4, gap: 0.01 });
        paint();
      }),
    );
    keysEl.forEach((k) => k.addEventListener("click", () => assign(k.dataset.k)));
    const kd = (e) => {
      if (dead || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^Key[A-Z]$/.test(e.code)) {
        assign(e.code[3]);
        e.preventDefault();
      } else if (e.code === "Backspace" || e.code === "Delete") {
        assign("-");
        e.preventDefault();
      } else if (e.code === "Tab" || e.code === "ArrowRight") {
        sel = nextOpen(sel) || sel;
        paint();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", kd);
    sel = nextOpen(null);
    paint();
    ctx.info(hkTouch() ? "TOCA UNA LETRA CIFRADA Y LUEGO SU SUSTITUTA" : "ELIGE UNA LETRA CIFRADA Y ESCRIBE SU SUSTITUTA · ⌫ BORRA");
    return {
      step() {},
      destroy() {
        dead = true;
        window.removeEventListener("keydown", kd);
      },
      assist() {
        // revela las dos letras cifradas más frecuentes que aún no están puestas
        const cnt = {};
        for (const ch of G.cipher) if (ch !== " ") cnt[ch] = (cnt[ch] || 0) + 1;
        const open = cl.filter((c) => !guess[c] || guess[c] !== G.inv[c]).sort((a, b) => cnt[b] - cnt[a]);
        let n = 0;
        for (const c of open) {
          if (n >= 2) break;
          for (const k in guess) if (guess[k] === G.inv[c] && k !== c) delete guess[k];
          guess[c] = G.inv[c];
          fixed[c] = 1;
          n++;
        }
        sel = nextOpen(null);
        paint();
        check();
        return n > 0;
      },
      bot() {
        if (dead) return;
        for (const c of cl) if (guess[c] !== G.inv[c]) {
          sel = c;
          for (const k in guess) if (guess[k] === G.inv[c]) delete guess[k];
          guess[c] = G.inv[c];
        }
        check();
      },
      G,
    };
  },
};

// ── 5.3 Enrutado de nodos (grafo) ───────────────────────────────────────────────────────────────────
// Lleva el paquete de S a T pasando por todos los nodos de control (◆), sin tocar el ICE (✕) y sin pasarte de la latencia.
// Toca los nodos vecinos en orden; tocar un nodo anterior del camino lo recorta.
function hkRouteGen(seed, diff) {
  const r = hkRng(seed ^ 0x707e),
    N = 7 + diff;
  const pts = [];
  let minD = 64 - diff * 2;
  for (let tries = 0; pts.length < N && tries < 4000; tries++) {
    const p = [22 + r() * 256, 22 + r() * 256];
    if (pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= minD)) pts.push(p);
    if (tries % 500 === 499) minD *= 0.9;
  }
  for (let i = 0; pts.length < N; i++) pts.push([30 + (i % 4) * 80, 30 + Math.floor(i / 4) * 80]);
  pts.sort((a, b) => a[0] - b[0]);
  const dist = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
  const adj = Array.from({ length: N }, () => ({}));
  const addE = (i, j) => {
    if (i === j || adj[i][j]) return;
    adj[i][j] = adj[j][i] = 1 + Math.floor(dist(i, j) / 55);
  };
  const inT = new Set([0]);
  while (inT.size < N) {
    let bi = -1,
      bj = -1,
      bd = 1e9;
    for (const i of inT) for (let j = 0; j < N; j++) if (!inT.has(j) && dist(i, j) < bd) ((bd = dist(i, j)), (bi = i), (bj = j));
    addE(bi, bj);
    inT.add(bj);
  }
  for (let i = 0; i < N; i++) {
    const near = [];
    for (let j = 0; j < N; j++) if (j !== i) near.push(j);
    near.sort((a, b) => dist(i, a) - dist(i, b));
    near.slice(0, diff >= 4 ? 3 : 2).forEach((j) => addE(i, j));
  }
  const S = 0,
    T = N - 1,
    K0 = diff >= 5 ? 3 : diff >= 3 ? 2 : 1;
  const G = { N, pts, adj, S, T, mids: [], ice: {}, budget: 0, best: null, seed };
  const costOf = (p) => p.reduce((a, v, i) => a + (i ? adj[p[i - 1]][v] : 0), 0);
  // elige los nodos de control hasta que exista una ruta simple que pase por todos; si el grafo no lo permite, uno menos
  for (let K = K0; K >= 1 && !G.best; K--)
    for (let tries = 0; tries < 60 && !G.best; tries++) {
      G.mids = hkShuffle(
        Array.from({ length: N - 2 }, (_, i) => i + 1),
        r,
      )
        .slice(0, K)
        .sort((a, b) => a - b);
      const sol = hkRouteSolve(G, [S], Infinity);
      if (sol) G.best = sol;
    }
  const onPath = new Set(G.best ? G.best.path : [S, T]);
  const free = [];
  for (let i = 0; i < N; i++) if (!onPath.has(i) && !G.mids.includes(i)) free.push(i);
  hkShuffle(free, r)
    .slice(0, Math.min(diff, free.length))
    .forEach((i) => (G.ice[i] = 1));
  // con el ICE puesto la ruta óptima puede cambiar: se recalcula (la planteada sigue siendo válida porque evita el ICE)
  G.best = hkRouteSolve(G, [S], Infinity) || G.best;
  G.slack = [5, 4, 3, 2, 1][diff - 1];
  G.budget = (G.best ? G.best.cost : costOf([S, T])) + G.slack;
  return G;
}
// Mejor ruta completa (coste mínimo) que respete: simple, sin ICE, con todos los nodos de control, coste ≤ budget.
function hkRouteSolve(G, prefix, budget) {
  const vis = new Set(prefix);
  let cost0 = 0;
  for (let i = 1; i < prefix.length; i++) cost0 += G.adj[prefix[i - 1]][prefix[i]] || 0;
  let best = null,
    bestC = Infinity;
  const dfs = (u, cost, p) => {
    if (cost > budget || cost >= bestC) return;
    if (u === G.T) {
      if (G.mids.every((m) => vis.has(m))) {
        best = p.slice();
        bestC = cost;
      }
      return;
    }
    for (const k in G.adj[u]) {
      const v = +k;
      if (vis.has(v) || G.ice[v]) continue;
      vis.add(v);
      p.push(v);
      dfs(v, cost + G.adj[u][v], p);
      p.pop();
      vis.delete(v);
    }
  };
  dfs(prefix[prefix.length - 1], cost0, prefix.slice());
  return best ? { path: best, cost: bestC } : null;
}
HK_GAMES.route = {
  gen: hkRouteGen,
  validate(seed, diff) {
    const G = hkRouteGen(seed, diff);
    const sol = hkRouteSolve(G, [G.S], G.budget);
    const iceOk = sol && sol.path.every((v) => !G.ice[v]);
    const ends = G.S !== G.T && G.mids.length >= 1 && !G.mids.includes(G.S) && !G.mids.includes(G.T);
    return { ok: !!(sol && iceOk && ends && sol.cost <= G.budget), nodes: G.N, ice: Object.keys(G.ice).length, mids: G.mids.length, best: G.best && G.best.cost, budget: G.budget };
  },
  mount(root, ctx) {
    const G = hkRouteGen(ctx.seed, ctx.diff),
      budget = G.budget + Math.floor((ctx.spd - 1) * 4);
    let path = [G.S],
      cost = 0,
      dead = false,
      hintNode = -1,
      hintT = 0,
      flash = -1,
      flashT = 0;
    const wrap = document.createElement("div");
    wrap.className = "rt";
    root.appendChild(wrap);
    const render = () => {
      const on = new Set(path);
      let s = `<svg viewBox="0 0 300 300" role="img" aria-label="Red de nodos">`;
      for (let i = 0; i < G.N; i++)
        for (const k in G.adj[i]) {
          const j = +k;
          if (j < i) continue;
          const A = G.pts[i],
            B = G.pts[j];
          const used = path.some((v, q) => q && ((path[q - 1] === i && v === j) || (path[q - 1] === j && v === i)));
          s += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${used ? "#46e4ff" : "rgba(160,190,200,.28)"}" stroke-width="${used ? 4 : 1.6}" stroke-linecap="round"/>`;
          s += `<text x="${(A[0] + B[0]) / 2}" y="${(A[1] + B[1]) / 2 + 3}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${used ? "#bff7ff" : "#a3b2b9"}" stroke="#04090c" stroke-width="3" paint-order="stroke" font-family="Chakra Petch,sans-serif">${G.adj[i][j]}</text>`;
        }
      for (let i = 0; i < G.N; i++) {
        const [px, py] = G.pts[i],
          vis = on.has(i),
          end = path[path.length - 1] === i;
        let fill = "#0b1418",
          stroke = "rgba(160,190,200,.6)",
          label = "",
          lc = "#cfd8dc";
        if (i === G.S) ((stroke = "#5fd35a"), (label = "S"), (lc = "#8dffa0"));
        else if (i === G.T) ((stroke = "#ffb340"), (label = "T"), (lc = "#ffd27a"));
        else if (G.mids.includes(i)) ((stroke = "#b56bff"), (label = "◆"), (lc = vis ? "#04090c" : "#d9b3ff"), vis && (fill = "#b56bff"));
        else if (G.ice[i]) ((stroke = "#ff4f5e"), (label = "✕"), (lc = "#ff8d97"));
        if (vis && !G.mids.includes(i)) fill = "rgba(70,228,255,.22)";
        const hl = i === hintNode && hintT > 0;
        s += `<g class="rt-node" data-n="${i}"><circle cx="${px}" cy="${py}" r="23" fill="transparent"/>`;
        if (end) s += `<circle cx="${px}" cy="${py}" r="19" fill="none" stroke="#46e4ff" stroke-width="2" opacity=".7"/>`;
        if (hl) s += `<circle cx="${px}" cy="${py}" r="21" fill="none" stroke="#ffd447" stroke-width="3"><animate attributeName="r" values="17;24;17" dur=".7s" repeatCount="indefinite"/></circle>`;
        if (flash === i && flashT > 0) s += `<circle cx="${px}" cy="${py}" r="20" fill="rgba(255,60,80,.45)"/>`;
        s += `<circle cx="${px}" cy="${py}" r="14" fill="${fill}" stroke="${stroke}" stroke-width="2.4"/><text x="${px}" y="${py + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${lc}" font-family="Chakra Petch,sans-serif" pointer-events="none">${label}</text></g>`;
      }
      s += `</svg><div class="rt-bar"><span>LATENCIA <b class="${cost > budget ? "over" : ""}">${cost}</b> / ${budget}</span><span>CONTROL <b>${G.mids.filter((m) => on.has(m)).length}/${G.mids.length}</b></span><button class="btn" data-undo>↶ Deshacer</button></div>`;
      wrap.innerHTML = s;
      sizeSvg();
    };
    // el SVG es cuadrado y ocupa lo que cabe (ancho, alto menos la barra de latencia, tope 520 px)
    const sizeSvg = () => {
      const sv = wrap.querySelector("svg");
      if (!sv) return;
      const side = Math.max(150, Math.min(520, root.clientWidth || 300, (root.clientHeight || 340) - 52));
      sv.style.width = sv.style.height = side + "px";
    };
    window.addEventListener("resize", sizeSvg);
    const tap = (id) => {
      if (dead) return;
      const k = path.indexOf(id),
        end = path[path.length - 1];
      if (k >= 0) {
        if (k === path.length - 1 && path.length === 1) return;
        path.length = k === path.length - 1 ? path.length - 1 : k + 1;
      } else {
        if (!G.adj[end][id]) {
          ctx.sfx("err", { v: 0.4 });
          ctx.info("ESE NODO NO ESTÁ CONECTADO AL EXTREMO DE TU RUTA");
          return;
        }
        if (G.ice[id]) {
          flash = id;
          flashT = 0.5;
          ctx.sfx("hkIce");
          ctx.err(6, "ICE");
          ctx.info("¡ICE! LA TRAZA SUBE · ELIGE OTRO NODO");
          render();
          return;
        }
        path.push(id);
        ctx.sfx("hkTick", { p: 1 + path.length * 0.06, gap: 0.01 });
      }
      cost = 0;
      for (let i = 1; i < path.length; i++) cost += G.adj[path[i - 1]][path[i]];
      hintNode = -1;
      const on = new Set(path);
      if (path[path.length - 1] === G.T) {
        if (!G.mids.every((m) => on.has(m))) ctx.info("FALTAN NODOS DE CONTROL ◆ · DESHAZ Y RODEA");
        else if (cost > budget) ctx.info("LATENCIA EXCEDIDA · BUSCA UNA RUTA MÁS CORTA");
        else {
          dead = true;
          render();
          ctx.win();
          return;
        }
      } else ctx.info("LLEGA A T PASANDO POR TODOS LOS ◆ · EVITA EL ✕");
      render();
    };
    wrap.addEventListener("pointerdown", (e) => {
      const undo = e.target.closest && e.target.closest("[data-undo]");
      if (undo) {
        e.preventDefault();
        if (path.length > 1 && !dead) {
          path.pop();
          cost = 0;
          for (let i = 1; i < path.length; i++) cost += G.adj[path[i - 1]][path[i]];
          ctx.sfx("hkTick", { p: 0.7, gap: 0.01 });
          render();
        }
        return;
      }
      const n = e.target.closest && e.target.closest("[data-n]");
      if (n) {
        e.preventDefault();
        tap(+n.dataset.n);
      }
    });
    render();
    ctx.info("LLEGA A T PASANDO POR TODOS LOS ◆ · EVITA EL ✕ · LOS NÚMEROS SON LATENCIA");
    return {
      step(dt) {
        if (dead) return;
        if (flashT > 0) {
          flashT -= dt;
          if (flashT <= 0) render();
        }
        if (hintT > 0) {
          hintT -= dt;
          if (hintT <= 0) {
            hintNode = -1;
            render();
          }
        }
      },
      destroy() {
        dead = true;
        window.removeEventListener("resize", sizeSvg);
      },
      assist() {
        const sol = hkRouteSolve(G, path, Infinity) || hkRouteSolve(G, [G.S], Infinity);
        if (!sol) return false;
        const cur = sol.path.slice(0, path.length).join() === path.join() ? path.length : 1;
        if (cur === 1 && path.length > 1) path = [G.S];
        hintNode = sol.path[Math.min(sol.path.length - 1, cur)];
        hintT = 6;
        render();
        return true;
      },
      bot() {
        if (dead) return;
        const sol = hkRouteSolve(G, [G.S], budget);
        if (!sol) return;
        path = [G.S];
        for (const v of sol.path.slice(1)) tap(v);
      },
      G,
    };
  },
};

// ── 5.4 Sintonía de frecuencia ──────────────────────────────────────────────────────────────────────
// La señal del sistema deriva. Mueve el dedo por la pantalla (frecuencia ↔, amplitud ↕) y la fase (deslizador) para clavarla y
// mantenerla unos segundos. La zona se ve y se oye: cuanto más cerca, más agudo el pitido.
var HK_TUNE = { W: 320, H: 150, fMin: 1, fMax: 6, aMin: 0.15, aMax: 1 };
function hkTuneGen(seed, diff) {
  const r = hkRng(seed ^ 0x7a9e),
    d = diff - 1,
    C = HK_CFG.tune;
  const k = C.k[d],
    af = C.af[d],
    aa = C.aa[d],
    ap = C.ap[d];
  // el centro de cada parámetro deja margen para que la deriva nunca se salga del rango que controla el jugador
  const fm = 0.25 + af * 1.3,
    am = 0.05 + aa;
  return {
    f0: HK_TUNE.fMin + fm + r() * (HK_TUNE.fMax - HK_TUNE.fMin - 2 * fm),
    af,
    wf: C.wf[d],
    a0: HK_TUNE.aMin + am + r() * (HK_TUNE.aMax - HK_TUNE.aMin - 2 * am),
    aa,
    wa: C.wa[d],
    p0: 0.3 + ap + r() * (5.6 - 2 * ap),
    ap,
    wp: C.wp[d],
    ph1: r() * 6.283,
    ph2: r() * 6.283,
    ph3: r() * 6.283,
    usePhase: diff >= 3,
    tol: { f: 0.3 * k, a: 0.12 * k, p: 0.55 * k },
    hold: C.hold[d],
    seed,
  };
}
function hkTuneTarget(P, t, out) {
  out.f = P.f0 + P.af * Math.sin(P.wf * t + P.ph1) + 0.3 * P.af * Math.sin(2.3 * P.wf * t + P.ph2);
  out.a = P.a0 + P.aa * Math.sin(P.wa * t + P.ph2);
  out.p = P.p0 + P.ap * Math.sin(P.wp * t + P.ph3);
  return out;
}
// Error normalizado (≤ 1 = dentro de tolerancia)
function hkTuneErr(P, tg, f, a, p, tolMul) {
  const m = tolMul || 1;
  let e = Math.pow((f - tg.f) / (P.tol.f * m), 2) + Math.pow((a - tg.a) / (P.tol.a * m), 2);
  if (P.usePhase) e += Math.pow((p - tg.p) / (P.tol.p * m), 2);
  return Math.sqrt(e);
}
HK_GAMES.tune = {
  gen: hkTuneGen,
  validate(seed, diff) {
    const P = hkTuneGen(seed, diff),
      T = HK_TUNE,
      tg = {};
    // 1) la señal objetivo nunca sale del rango que el jugador puede alcanzar, y su ritmo máximo es seguible
    let fmin = 1e9,
      fmax = -1e9,
      amin = 1e9,
      amax = -1e9,
      pmin = 1e9,
      pmax = -1e9,
      rate = 0,
      prev = null;
    for (let t = 0; t <= 80; t += 0.05) {
      hkTuneTarget(P, t, tg);
      fmin = Math.min(fmin, tg.f);
      fmax = Math.max(fmax, tg.f);
      amin = Math.min(amin, tg.a);
      amax = Math.max(amax, tg.a);
      pmin = Math.min(pmin, tg.p);
      pmax = Math.max(pmax, tg.p);
      if (prev) rate = Math.max(rate, Math.abs(tg.f - prev.f) / 0.05 / (T.fMax - T.fMin), Math.abs(tg.a - prev.a) / 0.05 / (T.aMax - T.aMin));
      prev = { f: tg.f, a: tg.a };
    }
    const inRange = fmin >= T.fMin + 0.2 && fmax <= T.fMax - 0.2 && amin >= T.aMin + 0.05 && amax <= T.aMax - 0.02 && pmin >= 0.2 && pmax <= 6.0;
    // 2) un seguidor humano (retardo de primer orden de 0,3 s) engancha la señal dentro del tiempo
    let f = (T.fMin + T.fMax) / 2,
      a = 0.6,
      p = Math.PI,
      lock = 0,
      tl = Infinity;
    const lim = HK_CFG.games.tune.time[diff - 1];
    for (let t = 0; t < lim; t += 1 / 60) {
      hkTuneTarget(P, t, tg);
      const k = 1 - Math.exp(-1 / 60 / 0.3);
      f += (tg.f - f) * k;
      a += (tg.a - a) * k;
      p += (tg.p - p) * k;
      if (hkTuneErr(P, tg, f, a, p) <= 1) {
        lock += 1 / 60;
        if (lock >= P.hold) {
          tl = t;
          break;
        }
      } else lock = Math.max(0, lock - (1 / 60) * 0.5);
    }
    return { ok: inRange && tl < lim * 0.8 && rate < 0.45, rate: +rate.toFixed(3), tLock: +tl.toFixed(1), inRange };
  },
  mount(root, ctx) {
    const T = HK_TUNE,
      P = hkTuneGen(ctx.seed, ctx.diff);
    const tolMul = ctx.spd;
    root.insertAdjacentHTML(
      "beforeend",
      `<div class="tn"><canvas class="hk-cv"></canvas><div class="tn-pad"><span>FRECUENCIA ↔ · AMPLITUD ↕</span><i></i></div>${P.usePhase ? '<div class="tn-sl"><span>FASE</span><i></i></div>' : ""}</div>`,
    );
    const wrap = root.querySelector(".tn"),
      cv = wrap.querySelector("canvas"),
      pad = wrap.querySelector(".tn-pad"),
      knob = pad.querySelector("i"),
      sl = wrap.querySelector(".tn-sl"),
      sk = sl && sl.querySelector("i");
    const g = cv.getContext("2d"),
      dpr = Math.min(2, window.devicePixelRatio || 1);
    // el lienzo ocupa el hueco que dejan el panel y el deslizador: su tamaño lógico (cw × ch) sigue al del elemento
    const view = { w: T.W, h: T.H };
    const fitCv = () => {
      const w = Math.max(60, cv.clientWidth | 0),
        h = Math.max(40, cv.clientHeight | 0);
      if (w === view.w && h === view.h && cv.width === Math.round(w * dpr)) return;
      view.w = w;
      view.h = h;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener("resize", fitCv);
    // posición del jugador en [0,1]
    const pl = { x: 0.5, y: 0.5, s: 0.5 };
    const fOf = () => T.fMin + pl.x * (T.fMax - T.fMin),
      aOf = () => T.aMin + (1 - pl.y) * (T.aMax - T.aMin),
      pOf = () => pl.s * 6.283;
    const layout = () => {
      knob.style.left = pl.x * 100 + "%";
      knob.style.top = pl.y * 100 + "%";
      if (sk) sk.style.left = pl.s * 100 + "%";
    };
    layout();
    const bindDrag = (el, fn) => {
      let id = null;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        id = e.pointerId;
        try {
          el.setPointerCapture(id);
        } catch (_) {
          /* sin captura */
        }
        fn(e);
      });
      el.addEventListener("pointermove", (e) => id === e.pointerId && fn(e));
      const up = (e) => id === e.pointerId && (id = null);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    };
    bindDrag(pad, (e) => {
      const r = pad.getBoundingClientRect();
      pl.x = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
      pl.y = Math.max(0, Math.min(1, (e.clientY - r.top) / (r.height || 1)));
      layout();
    });
    if (sl)
      bindDrag(sl, (e) => {
        const r = sl.getBoundingClientRect();
        pl.s = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
        layout();
      });
    const keys = {};
    const kd = (e) => {
      const m = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", KeyQ: "q", KeyE: "e", KeyA: "l", KeyD: "r", KeyW: "u", KeyS: "d" }[e.code];
      if (m) {
        keys[m] = 1;
        e.preventDefault();
      }
    };
    const ku = (e) => {
      const m = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", KeyQ: "q", KeyE: "e", KeyA: "l", KeyD: "r", KeyW: "u", KeyS: "d" }[e.code];
      if (m) keys[m] = 0;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    let t = 0,
      lock = 0,
      dead = false,
      assistT = 0,
      beepT = 0;
    const tg = {};
    ctx.info(hkTouch() ? "ARRASTRA EL DEDO POR EL PANEL HASTA SUPERPONER LAS ONDAS" + (P.usePhase ? " · AJUSTA LA FASE ABAJO" : "") : "RATÓN O FLECHAS PARA SINTONIZAR" + (P.usePhase ? " · Q/E AJUSTAN LA FASE" : ""));
    const wave = (f, a, p, col, lw, glow) => {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.shadowColor = col;
      g.shadowBlur = glow;
      g.beginPath();
      for (let i = 0; i <= view.w; i += 2) {
        const y = view.h / 2 - a * (view.h * 0.42) * Math.sin((i / view.w) * Math.PI * 2 * f + p);
        i ? g.lineTo(i, y) : g.moveTo(i, y);
      }
      g.stroke();
      g.shadowBlur = 0;
    };
    const draw = (e) => {
      fitCv();
      g.fillStyle = "#04090c";
      g.fillRect(0, 0, view.w, view.h);
      g.strokeStyle = "rgba(70,228,255,.07)";
      g.lineWidth = 1;
      for (let i = 0; i <= view.w; i += 32) {
        g.beginPath();
        g.moveTo(i + 0.5, 0);
        g.lineTo(i + 0.5, view.h);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(0, view.h / 2 + 0.5);
      g.lineTo(view.w, view.h / 2 + 0.5);
      g.stroke();
      const inSync = e <= 1;
      wave(tg.f, tg.a, P.usePhase ? tg.p : pOf(), "rgba(70,228,255,.9)", 3, 8);
      wave(fOf(), aOf(), pOf(), inSync ? "#5fd35a" : "#ffb340", 2.4, inSync ? 12 : 6);
      // medidor de sintonía y progreso de enganche
      const q = Math.max(0, Math.min(1, 1 - (e - 1) / 3));
      g.fillStyle = "rgba(0,0,0,.6)";
      g.fillRect(8, 8, 100, 8);
      g.fillStyle = inSync ? "#5fd35a" : q > 0.5 ? "#ffb340" : "#ff4f5e";
      g.fillRect(8, 8, 100 * (inSync ? 1 : q), 8);
      g.fillStyle = "rgba(255,255,255,.65)";
      g.font = '700 9px "Chakra Petch",sans-serif';
      g.fillText("SINTONÍA", 8, 28);
      g.fillStyle = "rgba(0,0,0,.6)";
      g.fillRect(view.w - 108, 8, 100, 8);
      g.fillStyle = "#46e4ff";
      g.fillRect(view.w - 108, 8, 100 * Math.min(1, lock / P.hold), 8);
      g.fillStyle = "rgba(255,255,255,.65)";
      g.textAlign = "right";
      g.fillText("ENGANCHE", view.w - 8, 28);
      g.textAlign = "left";
    };
    const evalErr = () => {
      hkTuneTarget(P, t, tg);
      return hkTuneErr(P, tg, fOf(), aOf(), P.usePhase ? pOf() : tg.p, tolMul * (assistT > 0 ? 1.7 : 1));
    };
    draw(evalErr());
    return {
      step(dt) {
        if (dead) return;
        t += dt;
        if (assistT > 0) assistT -= dt;
        const s = dt * 0.55;
        if (keys.l || keys.r || keys.u || keys.d || keys.q || keys.e) {
          pl.x = Math.max(0, Math.min(1, pl.x + (keys.r - keys.l) * s));
          pl.y = Math.max(0, Math.min(1, pl.y + (keys.d - keys.u) * s));
          pl.s = Math.max(0, Math.min(1, pl.s + (keys.e - keys.q) * s));
          layout();
        }
        const e = evalErr();
        if (e <= 1) lock += dt;
        else lock = Math.max(0, lock - dt * 0.5);
        beepT -= dt;
        if (beepT <= 0) {
          beepT = e <= 1 ? 0.25 : Math.min(0.9, 0.25 + e * 0.12);
          ctx.sfx("hkTick", { p: e <= 1 ? 1.8 : 0.9 + Math.max(0, 1 - e / 4) * 0.7, v: 0.4, gap: 0.02 });
        }
        draw(e);
        if (lock >= P.hold) {
          dead = true;
          ctx.win();
        }
      },
      destroy() {
        dead = true;
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        window.removeEventListener("resize", fitCv);
      },
      assist() {
        assistT = 12;
        return true;
      },
      bot(dt) {
        // sigue la señal con un retardo humano
        hkTuneTarget(P, t, tg);
        const k = 1 - Math.exp(-(dt || 1 / 60) / 0.25);
        pl.x += ((tg.f - T.fMin) / (T.fMax - T.fMin) - pl.x) * k;
        pl.y += (1 - (tg.a - T.aMin) / (T.aMax - T.aMin) - pl.y) * k;
        pl.s += (tg.p / 6.283 - pl.s) * k;
        layout();
      },
      P,
    };
  },
};

// ── 5.5 Fuerza bruta a ritmo ────────────────────────────────────────────────────────────────────────
// El programa prueba claves a ritmo: cada carácter que cae hay que «teclearlo» en su carril cuando cruza la línea. Un fallo
// o un toque en falso deja pasar una clave mala; con demasiados la defensa se reinicia.
var HK_BF = { W: 300, H: 400, line: 330, lanes: 4 };
function hkBruteGen(seed, diff) {
  const r = hkRng(seed ^ 0xb1f7),
    d = diff - 1,
    C = HK_CFG.brute;
  const N = C.n[d],
    gapMin = C.gap[d],
    fall = C.fall[d];
  const notes = [];
  let t = fall + 0.5,
    last = -1,
    gap = 0.7;
  const hex = "0123456789ABCDEF";
  for (let i = 0; i < N; i++) {
    let lane = Math.floor(r() * 4);
    if (lane === last && gap < 0.55) lane = (lane + 1 + Math.floor(r() * 3)) % 4;
    notes.push({ t, lane, ch: hex[Math.floor(r() * 16)] });
    last = lane;
    gap = gapMin + r() * 0.45;
    t += gap;
  }
  return { notes, fall, miss: C.miss[d], good: C.good, perfect: C.perfect, len: t, seed };
}
class HkBruteSim {
  constructor(L, mul) {
    this.L = L;
    this.notes = L.notes.map((n) => ({ t: n.t, lane: n.lane, ch: n.ch, st: 0 })); // st: 0 pendiente, 1 acierto, 2 fallo
    this.clock = 0;
    this.win = Math.max(1, mul);
    this.fall = L.fall * (1 + (mul - 1) * 0.5);
    this.hits = 0;
    this.miss = 0;
    this.perfect = 0;
    this.allowed = L.miss;
    this.over = 0;
    this.ev = [];
    this.flash = [0, 0, 0, 0];
  }
  assist() {
    this.win *= 1.6;
    this.allowed += 2;
  }
  press(lane) {
    if (this.over) return;
    const g = this.L.good * this.win;
    let best = null;
    for (const n of this.notes) if (n.st === 0 && n.lane === lane && Math.abs(n.t - this.clock) <= g && (!best || n.t < best.t)) best = n;
    this.flash[lane] = 0.18;
    if (best) {
      best.st = 1;
      this.hits++;
      const per = Math.abs(best.t - this.clock) <= this.L.perfect * this.win;
      if (per) this.perfect++;
      this.ev.push(per ? "perfect" : "hit");
      this.check();
    } else {
      this.miss++;
      this.ev.push("stray");
      this.check();
    }
  }
  step(dt) {
    if (this.over) return;
    this.clock += dt;
    for (let i = 0; i < 4; i++) if (this.flash[i] > 0) this.flash[i] -= dt;
    const g = this.L.good * this.win;
    for (const n of this.notes)
      if (n.st === 0 && this.clock > n.t + g) {
        n.st = 2;
        this.miss++;
        this.ev.push("miss");
      }
    this.check();
  }
  check() {
    if (this.over) return;
    if (this.miss > this.allowed) this.over = -1;
    else if (this.notes.every((n) => n.st !== 0)) this.over = 1;
  }
}
HK_GAMES.brute = {
  gen: hkBruteGen,
  time(diff, seed) {
    return Math.ceil(hkBruteGen(seed || 1, diff).len + 8);
  },
  // tiempo mínimo jugable: lo que dura la pista más un margen para la última nota (ver hkLayerLimit)
  minTime(diff, seed) {
    return Math.ceil(hkBruteGen(seed || 1, diff).len + 2);
  },
  validate(seed, diff) {
    const L = hkBruteGen(seed, diff);
    // huecos entre notas del mismo carril ≥ 2 ventanas buenas, y un jugador casi perfecto (σ = 0,05 s) gana
    let gapOk = true;
    for (let i = 0; i < L.notes.length; i++)
      for (let j = i + 1; j < L.notes.length; j++)
        if (L.notes[j].lane === L.notes[i].lane && L.notes[j].t - L.notes[i].t < L.good * 2.2) gapOk = false;
    const run = (sigma, mul) => {
      const sim = new HkBruteSim(L, mul),
        r = hkRng(seed ^ 0x9);
      const gauss = () => (r() + r() + r() + r() - 2) * 1.7;
      const plan = L.notes.map((n) => ({ t: n.t + gauss() * sigma, lane: n.lane })).sort((a, b) => a.t - b.t);
      let k = 0;
      while (!sim.over && sim.clock < L.len + 5) {
        sim.step(1 / 120);
        while (k < plan.length && plan[k].t <= sim.clock) sim.press(plan[k++].lane);
      }
      return sim.over === 1;
    };
    return { ok: gapOk && run(0.05, 1), notes: L.notes.length, human: run(0.09, 1), sloppy: run(0.2, 1), gapOk };
  },
  mount(root, ctx) {
    const B = HK_BF,
      L = hkBruteGen(ctx.seed, ctx.diff),
      sim = new HkBruteSim(L, ctx.spd);
    const wrap = document.createElement("div");
    wrap.className = "bf";
    root.appendChild(wrap);
    const C = hkMakeCanvas(wrap, B.W, B.H),
      g = C.g;
    const lw = B.W / B.lanes;
    const cols = ["#46e4ff", "#b56bff", "#ffb340", "#5fd35a"];
    const labels = hkTouch() ? ["", "", "", ""] : ["D", "F", "J", "K"];
    const kmap = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
    let dead = false;
    const kd = (e) => {
      if (e.repeat || !(e.code in kmap)) return;
      e.preventDefault();
      sim.press(kmap[e.code]);
    };
    window.addEventListener("keydown", kd);
    C.cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const [lx] = C.pos(e);
      sim.press(Math.max(0, Math.min(3, Math.floor(lx / lw))));
    });
    const pwTxt = () => {
      let s = "";
      L.notes.forEach((n, i) => {
        s += (sim.notes[i].st === 1 ? n.ch : "·") + (i % 4 === 3 && i < L.notes.length - 1 ? "-" : "");
      });
      return s;
    };
    const draw = () => {
      g.fillStyle = "#04090c";
      g.fillRect(0, 0, B.W, B.H);
      for (let i = 0; i < 4; i++) {
        const f = Math.max(0, sim.flash[i]) / 0.18;
        g.fillStyle = i % 2 ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.05)";
        g.fillRect(i * lw, 0, lw, B.H);
        if (f > 0) {
          g.fillStyle = cols[i];
          g.globalAlpha = f * 0.35;
          g.fillRect(i * lw, B.line - 40, lw, B.H - B.line + 40);
          g.globalAlpha = 1;
        }
        g.fillStyle = cols[i];
        g.globalAlpha = 0.9;
        g.fillRect(i * lw + 6, B.line - 2, lw - 12, 4);
        g.globalAlpha = 1;
        if (labels[i]) {
          g.fillStyle = "rgba(255,255,255,.55)";
          g.font = '700 14px "Chakra Petch",sans-serif';
          g.textAlign = "center";
          g.fillText(labels[i], i * lw + lw / 2, B.H - 14);
        }
      }
      g.textAlign = "center";
      g.font = '700 15px "Courier New",monospace';
      const span = B.line + 14;
      for (const n of sim.notes) {
        if (n.st !== 0) continue;
        const y = B.line - ((n.t - sim.clock) / sim.fall) * span;
        if (y < -20 || y > B.H + 20) continue;
        g.fillStyle = cols[n.lane];
        g.shadowColor = cols[n.lane];
        g.shadowBlur = 8;
        g.fillRect(n.lane * lw + 8, y - 14, lw - 16, 28);
        g.shadowBlur = 0;
        g.fillStyle = "#04090c";
        g.fillText(n.ch, n.lane * lw + lw / 2, y + 5);
      }
      g.textAlign = "left";
      g.fillStyle = "rgba(0,0,0,.65)";
      g.fillRect(0, 0, B.W, 26);
      g.fillStyle = "#5fd35a";
      g.font = '700 12px "Courier New",monospace';
      g.fillText("CLAVE " + pwTxt().slice(0, 36), 6, 17);
      g.textAlign = "right";
      g.fillStyle = sim.miss > sim.allowed - 2 ? "#ff4f5e" : "#ffd27a";
      g.font = '700 11px "Chakra Petch",sans-serif';
      g.fillText(`FALLOS ${sim.miss}/${sim.allowed}`, B.W - 6, B.H - 34);
      g.textAlign = "left";
    };
    draw();
    ctx.info(hkTouch() ? "TOCA EL CARRIL CUANDO EL CARÁCTER CRUCE LA LÍNEA" : "PULSA D F J K (O 1-4) CUANDO EL CARÁCTER CRUCE LA LÍNEA · TAMBIÉN CLIC");
    return {
      step(dt) {
        if (dead) return;
        sim.step(dt);
        for (const e of sim.ev) {
          if (e === "perfect") ctx.sfx("beep", { p: 1.6, gap: 0.01 });
          else if (e === "hit") ctx.sfx("beep", { p: 1.2, gap: 0.01 });
          else {
            ctx.sfx("hkIce", { v: 0.5, gap: 0.05 });
            ctx.err(1.2, "clave mala");
          }
        }
        sim.ev.length = 0;
        draw();
        if (sim.over === 1) {
          dead = true;
          ctx.win();
        } else if (sim.over === -1) {
          dead = true;
          ctx.fail("defensa reiniciada");
        }
      },
      destroy() {
        dead = true;
        window.removeEventListener("keydown", kd);
        C.dispose();
      },
      assist() {
        sim.assist();
        return true;
      },
      bot() {
        // pulsa cada nota al llegar su hora
        for (const n of sim.notes) if (n.st === 0 && n.t <= sim.clock + 0.01) sim.press(n.lane);
      },
      sim,
    };
  },
};

// ── 5.6 Los cinco minijuegos antiguos (28-hack.js) como capas ───────────────────────────────────────
function hkOldGame(kind) {
  return {
    gen: () => null,
    validate: () => ({ ok: typeof db === "function" }),
    mount(root, ctx) {
      let dead = false;
      const clean = db(root, kind, Math.max(1, Math.min(4, ctx.diff)), (ok) => {
        if (dead) return;
        dead = true;
        ok ? ctx.win() : ctx.fail("fallo");
      });
      ctx.info("");
      // los juegos antiguos tienen tamaño fijo: se escalan para caber en el área (los toques siguen cayendo bien bajo transform)
      const pz = root.firstElementChild;
      root.style.alignItems = "flex-start";
      const fit = () => {
        if (!pz || dead) return;
        pz.style.transform = "";
        pz.style.transformOrigin = "top center";
        const h = pz.offsetHeight || 1,
          w = pz.offsetWidth || 1,
          k = Math.min(1, (root.clientHeight || h) / h, (root.clientWidth || w) / w);
        pz.style.transform = k < 0.995 ? `scale(${k.toFixed(3)})` : "";
      };
      let ro = null;
      if (pz && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(fit);
        ro.observe(pz);
      }
      window.addEventListener("resize", fit);
      fit();
      return {
        step() {},
        destroy() {
          dead = true;
          window.removeEventListener("resize", fit);
          ro && ro.disconnect();
          try {
            clean && clean();
          } catch (e) {
            /* ya limpio */
          }
        },
        assist: () => false,
        bot() {
          if (!dead) {
            dead = true;
            ctx.win();
          }
        },
      };
    },
  };
}
for (const k of HK_OLD) HK_GAMES[k] = hkOldGame(k);

// ═══ 6. SESIÓN: capas apilables, traza compartida y programas ═════════════════════════════════════════
// Una sesión = pantalla previa (riesgo, programas) → 1-3 capas (cada una un minijuego distinto) con una TRAZA común → resultado.
// Una capa fallida suma traza y se reintenta con otra variante; si la traza llega a 100 salta la alarma y el contraataque.
var HK = {
  s: null, // sesión activa
  rng: hkRng((Date.now() ^ ((Math.random() * 1e9) | 0)) >>> 0), // azar de recompensas (no toca el RNG del mundo)
  mark: null, // marcador táctil «HACKEAR»
  cand: null, // enemigo hackeable más cercano
  ctl: [], // enemigos bajo control o apagados
  scanT: 0,
  markT: 0,
  tmp: [],
  pt: { x: 0, y: 0, vis: true },
  last: null, // último resultado
};

function hkTraceCfg() {
  return HK_CFG.trace;
}
function hkLayerName(kind) {
  return HK_CFG.games[kind] ? HK_CFG.games[kind].n : kind;
}
// Capas de la sesión según el riesgo: kinds fijos (spec.kinds) + resto elegido con pesos a partir de la semilla
function hkPlanLayers(s) {
  const sp = s.spec,
    risk = HK_CFG.risk[s.risk];
  let n = Math.max(sp.kinds ? sp.kinds.length : 0, sp.layers || 1);
  n = Math.max(1, Math.min(3, n + (sp.noExtra ? 0 : risk.extra)));
  const r = hkRng((sp.seed ^ 0x1abe) >>> 0),
    list = sp.kinds ? sp.kinds.slice(0, n) : [];
  const pool = (sp.pool || Object.keys(HK_CFG.games)).filter((k) => HK_GAMES[k]);
  while (list.length < n) {
    const cand = pool.filter((k) => !list.includes(k));
    const from = cand.length ? cand : pool;
    let tot = 0;
    from.forEach((k) => (tot += HK_CFG.games[k].w));
    let q = r() * tot,
      pick = from[from.length - 1];
    for (const k of from) {
      q -= HK_CFG.games[k].w;
      if (q <= 0) {
        pick = k;
        break;
      }
    }
    list.push(pick);
  }
  return list.map((kind, i) => ({ kind, diff: Math.max(1, Math.min(5, Math.round(sp.diff) + (i >= 2 ? 1 : 0) + (s.risk === 2 ? 1 : 0))), seed: (sp.seed + i * 7919) >>> 0 }));
}
function hkShortfall(s) {
  const need = s.spec.need || 1;
  return Math.max(0, Math.min(HK_CFG.trace.shortfall.max, need - s.mods.lvl));
}
function hkStartTrace(s) {
  const H = hkState();
  return Math.min(60, (H ? H.heat : 0) * HK_CFG.trace.heatCarry * s.mods.trace);
}
function hkLayerLimit(s, L, seed) {
  const G = HK_GAMES[L.kind],
    cfg = HK_CFG.games[L.kind];
  const sd = seed == null ? L.seed : seed;
  const base = G.time ? G.time(L.diff, sd) : cfg.time[L.diff - 1];
  if (!base) return 0;
  const lim = base * s.mods.speed * HK_CFG.risk[s.risk].time * (1 - HK_CFG.trace.shortfall.time * hkShortfall(s));
  // los modificadores (Agresivo, falta de nivel) recortan el tiempo, pero nunca por debajo de lo que dura el propio patrón:
  // sin este suelo la fuerza bruta era imposible de ganar con Agresivo y 5 niveles de déficit (límite < duración de la pista)
  return G.minTime ? Math.max(lim, G.minTime(L.diff, sd)) : lim;
}
// ¿Hay una sesión abierta?
function hkBusy() {
  return !!HK.s;
}

// Abre una sesión. spec = {target, objetivo, title, sub, diff, layers | kinds, pool, seed, need, xp, at, onDone(res)→líneas, risk?, noPre?}
function hkOpen(spec, cb) {
  const H = hkState();
  if (HK.s && (HK.s.ended || x.uiOpen !== "hack")) hkCleanup(HK.s); // sesión huérfana (cambio de panel o de zona)
  if (!H || !x.started || !x.player || HK.s) return null;
  const mods = hkMods();
  const s = {
    spec,
    cb,
    mods,
    // el riesgo elegido se recuerda para terminales; en combate (enemigos) se parte siempre del estándar
    risk: Math.max(0, Math.min(HK_CFG.risk.length - 1, spec.risk != null ? spec.risk : spec.target === "enemy" ? 1 : H.risk)),
    loadout: H.loadout.filter((id) => HK_CFG.programs[id] && H.lvl >= HK_CFG.programs[id].min).slice(0, mods.slots),
    state: "pre",
    ended: false,
    manual: false,
    trace: 0,
    idx: -1,
    layers: [],
    fails: 0,
    errors: 0,
    used: {},
    slow: 0,
    ghost: false,
    between: 0,
    raf: 0,
    hudT: 0,
    t0: 0,
    tRun: 0,
    kindsDone: [],
    toolsUsed: 0,
  };
  if (HK_CFG.risk[s.risk].minLvl > H.lvl) s.risk = 1;
  if (spec.risk != null) s.fixedRisk = true;
  s.trace = hkStartTrace(s);
  HK.s = s;
  // Esc desconecta (sin penalización); el resto de teclas del juego no abren nada encima de este panel
  s.onKey = (ev) => {
    if (ev.code === "Escape" && HK.s === s) {
      ev.preventDefault();
      Ze.close();
      Tt.pressed.delete("pause"); // el mismo Esc ya está en cola para el juego: sin esto abriría el menú de pausa justo después
    }
  };
  window.addEventListener("keydown", s.onKey);
  Ze.open("hack", `<div class="win hk" style="width:min(760px,100%)">${Ze.head(ke(spec.title), "")}<div class="wbody" id="hkBody"></div></div>`, { modal: true });
  wr = () => hkAbort(s);
  s.body = document.getElementById("hkBody");
  if (spec.noPre) hkStartRun(s);
  else hkRenderPre(s);
  return s;
}

// ── Pantalla previa ──────────────────────────────────────────────────────────────────────────────────
function hkCostLine(cost) {
  return Object.keys(cost)
    .map((k) => `${yt(cost[k])} ${k === "credits" ? "¤" : (_b(k) && _b(k).n ? _b(k).n.toLowerCase() : k)}`)
    .join(" · ");
}
function hkRenderPre(s) {
  const H = hkState(),
    m = s.mods,
    sp = s.spec,
    R = HK_CFG.risk[s.risk];
  s.plan = hkPlanLayers(s);
  const short = hkShortfall(s),
    need = sp.need || 1;
  const startT = Math.round(s.trace);
  const lay = s.plan.map((L, i) => `<span><b>${i + 1}</b> ${ke(hkLayerName(L.kind))} <small class="muted">nv ${L.diff}</small></span>`).join("");
  const risk = HK_CFG.risk
    .map((r) => {
      const lock = r.minLvl > H.lvl,
        on = r.id === s.risk;
      return `<button data-risk="${r.id}" class="${on ? "on" : ""}" ${lock || s.fixedRisk ? "disabled" : ""}><b>${r.ic}</b>${r.n}<small>${lock ? "Hackeo nv " + r.minLvl : "Botín ×" + r.rew.toFixed(1).replace(".", ",") + (r.extra ? " · +1 capa" : "")}</small></button>`;
    })
    .join("");
  const progs = HK_PROG.map((id) => {
    const p = HK_CFG.programs[id],
      n = H.tools[id] | 0,
      locked = H.lvl < p.min,
      on = s.loadout.includes(id);
    return `<button class="hk-pg${on ? " on" : ""}" data-load="${id}" ${locked || (!n && !on) ? "disabled" : ""} title="${ke(p.d)}"><b>${p.ic}</b><span>${p.n}<small>${locked ? "Hackeo nv " + p.min : ke(p.d)}</small></span><i>×${n}</i></button>`;
  }).join("");
  const comp = HK_PROG.map((id) => {
    const p = HK_CFG.programs[id],
      c = hkProgCost(id),
      ok = H.lvl >= p.min && (H.tools[id] | 0) < HK_CFG.toolMax && ca(c);
    return `<div class="hk-pg" style="cursor:default"><b>${p.ic}</b><span>${p.n}<small>${H.lvl < p.min ? "Hackeo nv " + p.min : hkCostLine(c)}</small></span><button class="btn${ok ? " pri" : ""}" data-comp="${id}" ${ok ? "" : "disabled"}>Compilar</button></div>`;
  }).join("");
  const xpPct = Math.min(100, Math.round((H.xp / hkXpToNext(H.lvl)) * 100));
  s.body.className = "wbody";
  s.body.innerHTML = `<div class="hk-pre">
    <div class="hk-card"><h3>${ke(sp.sub || "Objetivo")}</h3>
      <div class="hk-kv"><span>Dificultad <b style="color:var(--cyan)">${"▮".repeat(Math.min(4, Math.round(sp.diff)))}${"▯".repeat(Math.max(0, 4 - Math.round(sp.diff)))}</b></span><span>Tu hackeo <b>nv ${H.lvl}</b></span><span>Recomendado <b style="color:${short ? "var(--bad)" : "var(--good)"}">nv ${need}</b></span><span>Traza inicial <b>${startT} %</b></span></div>
      <div class="hk-xp" style="margin-top:6px" title="XP de hackeo"><i style="width:${xpPct}%"></i></div>
      ${short ? `<div class="muted" style="font-size:12px;margin-top:5px;color:var(--amber2)">Te faltan ${short} nivel${short > 1 ? "es" : ""}: la traza sube un ${Math.round(short * HK_CFG.trace.shortfall.rate * 100)} % más rápido y tienes menos tiempo.</div>` : ""}
      <div class="muted" style="font-size:12px;margin-top:5px">Un fallo suma traza y repite la capa. Con la traza al 100 % salta la alarma. ${hkTouch() ? "" : "Esc o «Desconectar» salen sin penalización."}</div></div>
    <div class="hk-card"><h3>Capas (${s.plan.length})</h3><div class="hk-lay">${lay}</div></div>
    <div class="hk-card full"><h3>Riesgo · ${R.n}</h3><div class="hk-risk">${risk}</div><div class="muted" style="font-size:12px;margin-top:5px">${ke(R.d)}</div></div>
    <div class="hk-card full"><h3>Programas cargados (${s.loadout.length}/${m.slots})</h3><div class="hk-progs">${progs}</div>
      <details style="margin-top:8px" ${s.compOpen ? "open" : ""}><summary style="cursor:pointer;min-height:36px;display:flex;align-items:center;font:700 13px var(--f-disp);color:var(--amber2)">Compilar programas (usa datos y créditos)</summary><div class="hk-progs" style="margin-top:6px">${comp}</div></details></div>
    <div class="hk-foot full"><button class="btn pri hk-big" id="hkGo" style="min-width:min(260px,70%)">CONECTAR</button><button class="btn hk-big" id="hkNo">Desconectar</button></div>
  </div>`;
  s.body.querySelectorAll("[data-risk]").forEach((b) =>
    b.addEventListener("click", () => {
      s.risk = +b.dataset.risk;
      if (sp.target !== "enemy") H.risk = s.risk;
      ae.play("ui");
      hkRenderPre(s);
    }),
  );
  s.body.querySelectorAll("[data-load]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.load,
        i = s.loadout.indexOf(id);
      if (i >= 0) s.loadout.splice(i, 1);
      else if (s.loadout.length < m.slots) s.loadout.push(id);
      else ee("toast", `Solo ${m.slots} huecos de programa (más con el nivel de hackeo y talentos de Ingeniería).`, "warn");
      H.loadout = s.loadout.slice();
      ae.play("ui");
      hkRenderPre(s);
    }),
  );
  s.body.querySelectorAll("[data-comp]").forEach((b) =>
    b.addEventListener("click", () => {
      if (hkCompile(b.dataset.comp)) hkRenderPre(s);
    }),
  );
  const det = s.body.querySelector("details");
  det && det.addEventListener("toggle", () => (s.compOpen = det.open));
  s.body.querySelector("#hkGo").addEventListener("click", () => hkStartRun(s));
  s.body.querySelector("#hkNo").addEventListener("click", () => Ze.close());
}

// ── Ejecución ────────────────────────────────────────────────────────────────────────────────────────
function hkStartRun(s) {
  if (s.state !== "pre") return;
  const H = hkState();
  s.state = "run";
  s.plan = hkPlanLayers(s);
  s.layers = s.plan;
  s.loadout = s.loadout.slice(0, s.mods.slots);
  H.loadout = s.loadout.slice();
  s.t0 = performance.now();
  s.body.className = "wbody run";
  s.body.innerHTML = `<div class="hk-bar"><div class="hk-trace" id="hkTr"><div class="lb"><span>TRAZA</span><b id="hkTv">0 %</b></div><div class="bar"><i id="hkTb"></i><u style="left:${HK_CFG.trace.warn}%"></u><u style="left:${HK_CFG.trace.danger}%"></u></div></div><div class="hk-layers" id="hkLy"></div><div class="hk-time" id="hkTm"></div></div><div class="hk-info" id="hkInfo"></div><div class="hk-game" id="hkGame"></div><div class="hk-tools" id="hkTools"></div><div class="hk-foot"><button class="btn" id="hkAb">Desconectar (sin penalización)</button></div>`;
  s.el = {
    tr: s.body.querySelector("#hkTr"),
    tv: s.body.querySelector("#hkTv"),
    tb: s.body.querySelector("#hkTb"),
    ly: s.body.querySelector("#hkLy"),
    tm: s.body.querySelector("#hkTm"),
    info: s.body.querySelector("#hkInfo"),
    game: s.body.querySelector("#hkGame"),
    tools: s.body.querySelector("#hkTools"),
  };
  s.body.querySelector("#hkAb").addEventListener("click", () => Ze.close());
  s.el.tools.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-tool]");
    if (b) hkUseTool(s, b.dataset.tool);
  });
  hkSfx("hkLock");
  s.warnedW = s.trace >= HK_CFG.trace.warn;
  s.warnedD = s.trace >= HK_CFG.trace.danger;
  hkMountLayer(s, 0);
  hkLoop(s);
}
function hkLoop(s) {
  s.last = performance.now();
  const tick = () => {
    s.raf = 0;
    if (HK.s !== s || s.ended) return;
    const now = performance.now(),
      dt = (now - s.last) / 1000;
    s.last = now;
    if (!s.manual) hkStep(s, Math.min(0.05, dt));
    if (HK.s === s && !s.ended) s.raf = window.requestAnimationFrame(tick);
  };
  s.raf = window.requestAnimationFrame(tick);
}
function hkSetInfo(s, txt) {
  if (s.el && s.el.info) s.el.info.textContent = txt || "";
}
function hkMountLayer(s, idx) {
  s.idx = idx;
  const L = s.layers[idx],
    G = HK_GAMES[L.kind],
    el = s.el.game;
  if (s.game) {
    try {
      s.game.destroy();
    } catch (e) {
      /* ya destruido */
    }
    s.game = null;
  }
  el.className = "hk-game";
  el.innerHTML = "";
  s.used = {};
  s.ghost = false;
  s.layerSeed = (L.seed + s.fails * 104729) >>> 0; // otra variante tras cada fallo
  s.limit = hkLayerLimit(s, L, s.layerSeed);
  s.tLeft = s.limit;
  const ctx = {
    diff: L.diff,
    seed: s.layerSeed,
    spd: Math.max(1, s.mods.speed * (1 - 0.05 * hkShortfall(s))),
    touch: hkTouch(),
    win: () => hkLayerWin(s),
    fail: (why) => hkLayerFail(s, why),
    err: (pts, why) => hkAddTrace(s, pts, why),
    info: (t) => hkSetInfo(s, t),
    sfx: hkSfx,
  };
  hkSetInfo(s, "");
  try {
    s.game = G.mount(el, ctx);
  } catch (err) {
    console.warn("hackeo: no se pudo montar", L.kind, err);
    s.game = null;
    return hkLayerWin(s, true);
  }
  hkHud(s, true);
}
// Traza por error (el multiplicador del riesgo y del nivel ya van dentro; «Fantasma» la anula)
function hkAddTrace(s, pts, why) {
  if (s.ended || s.between > 0) return;
  s.errors++;
  if (s.ghost) return;
  s.trace = Math.min(100, s.trace + pts * s.mods.trace * HK_CFG.risk[s.risk].fail);
  hkTraceChecks(s);
}
function hkTraceChecks(s) {
  const T = HK_CFG.trace;
  if (!s.warnedW && s.trace >= T.warn) {
    s.warnedW = true;
    hkSfx("hkIce");
    hkSetInfo(s, "ICE DETECTADA · EL SISTEMA ACELERA");
  }
  if (!s.warnedD && s.trace >= T.danger) {
    s.warnedD = true;
    hkSfx("alarm", { v: 0.5 });
    hkSetInfo(s, "¡CONTRAATAQUE INMINENTE! · DESCONECTA O TERMINA YA");
  }
  if (s.trace >= 100) hkFinish(s, false);
}
function hkStep(s, dt) {
  if (HK.s !== s || s.ended || s.state !== "run") return;
  if (s.between > 0) {
    s.between -= dt;
    if (s.between <= 0) {
      s.between = 0;
      if (s.advance) {
        s.advance = false;
        if (s.idx + 1 >= s.layers.length) return hkFinish(s, true);
        hkMountLayer(s, s.idx + 1);
      } else hkMountLayer(s, s.idx); // reintento de la misma capa con otra variante
    }
    hkHud(s);
    return;
  }
  if (!s.game) return;
  const slowed = s.slow > 0;
  const gdt = dt * (slowed ? 0.55 : 1);
  if (slowed) s.slow = Math.max(0, s.slow - dt);
  s.tRun += dt;
  s.game.step(gdt);
  if (s.ended || s.between > 0) return hkHud(s);
  const L = s.layers[s.idx],
    T = HK_CFG.trace,
    R = HK_CFG.risk[s.risk];
  if (s.limit > 0) s.tLeft -= gdt;
  let rate = T.rate[L.diff] * R.rate * s.mods.trace * (1 + HK_CFG.trace.shortfall.rate * hkShortfall(s));
  rate *= s.trace >= T.danger ? 1.25 : s.trace >= T.warn ? 1.1 : 1;
  if (s.ghost) rate *= 0.5;
  s.trace = Math.min(100, s.trace + rate * dt);
  hkTraceChecks(s);
  if (s.ended) return;
  if (s.limit > 0 && s.tLeft <= 0) return hkLayerFail(s, "tiempo");
  hkHud(s);
}
function hkMsg(s, txt, col) {
  const d = document.createElement("div");
  d.className = "hk-msg";
  d.style.color = col;
  d.textContent = txt;
  s.el.game.appendChild(d);
}
function hkLayerWin(s, silent) {
  if (s.ended || s.between > 0) return;
  const L = s.layers[s.idx];
  s.kindsDone.push(L.kind);
  s.advance = true;
  s.between = silent ? 0.05 : 0.85;
  if (!silent) {
    hkSfx("success", { v: 0.6 });
    hkMsg(s, s.idx + 1 >= s.layers.length ? "ACCESO" : "CAPA SUPERADA", "#5fd35a");
  }
  hkHud(s, true);
}
function hkLayerFail(s, why) {
  if (s.ended || s.between > 0) return;
  const L = s.layers[s.idx],
    T = HK_CFG.trace;
  s.fails++;
  if (!s.ghost) s.trace = Math.min(100, s.trace + T.fail[L.diff] * HK_CFG.risk[s.risk].fail * s.mods.trace);
  s.advance = false;
  s.between = 1;
  hkSfx("err");
  hkMsg(s, why === "tiempo" ? "TIEMPO AGOTADO" : "CAPA FALLIDA", "#ff4f5e");
  hkSetInfo(s, "LA TRAZA SUBE · REINTENTO CON OTRA VARIANTE");
  hkTraceChecks(s);
  hkHud(s, true);
}
function hkHud(s, force) {
  if (!s.el) return;
  s.hudT -= 1;
  if (!force && s.hudT > 0) return;
  s.hudT = 3;
  const T = HK_CFG.trace,
    tr = Math.round(s.trace);
  if (s.el.tv._v !== tr) {
    s.el.tv._v = tr;
    s.el.tv.textContent = tr + " %";
    s.el.tb.style.width = Math.min(100, s.trace) + "%";
    s.el.tr.className = "hk-trace" + (s.trace >= T.danger ? " d" : s.trace >= T.warn ? " w" : "");
  }
  const key = s.idx + "|" + s.layers.length + "|" + (s.between > 0 && s.advance ? 1 : 0);
  if (s.el.ly._k !== key) {
    s.el.ly._k = key;
    s.el.ly.innerHTML = s.layers.map((_, i) => `<b class="${i < s.idx || (i === s.idx && s.between > 0 && s.advance) ? "ok" : i === s.idx ? "on" : ""}">${i + 1}</b>`).join("");
  }
  const tm = s.limit > 0 ? Math.max(0, Math.ceil(s.tLeft)) + " s" : "";
  if (s.el.tm._v !== tm) {
    s.el.tm._v = tm;
    s.el.tm.textContent = tm;
    s.el.tm.classList.toggle("lo", s.limit > 0 && s.tLeft < 8);
  }
  hkToolsHud(s);
}
function hkToolsHud(s) {
  const H = hkState();
  const key = s.loadout.map((id) => id + (H.tools[id] | 0) + (s.used[id] ? "u" : "")).join() + (s.between > 0 ? "b" : "");
  if (s.el.tools._k === key) return;
  s.el.tools._k = key;
  s.el.tools.innerHTML = s.loadout
    .map((id) => {
      const p = HK_CFG.programs[id],
        n = H.tools[id] | 0;
      return `<button class="hk-tool" data-tool="${id}" ${!n || s.used[id] || s.between > 0 ? "disabled" : ""} title="${ke(p.d)}"><b>${p.ic}</b>${p.n}<i>×${n}</i></button>`;
    })
    .join("");
}
// Programas durante la capa
function hkUseTool(s, id) {
  const H = hkState(),
    p = HK_CFG.programs[id];
  if (!p || s.ended || s.between > 0 || s.used[id] || (H.tools[id] | 0) <= 0 || !s.game) return false;
  const L = s.layers[s.idx];
  let ok = true;
  switch (id) {
    case "disipador":
      s.trace = Math.max(0, s.trace - 30);
      s.warnedW = s.trace >= HK_CFG.trace.warn;
      s.warnedD = s.trace >= HK_CFG.trace.danger;
      hkSetInfo(s, "TRAZA REDUCIDA");
      break;
    case "ralentizador":
      s.slow = 14;
      hkSetInfo(s, "TIEMPO RALENTIZADO AL 55 %");
      break;
    case "oraculo":
      ok = !!(s.game.assist && s.game.assist());
      if (!ok) ee("toast", "Este minijuego no admite ayuda del Oráculo.", "warn");
      else hkSetInfo(s, "ORÁCULO ACTIVO");
      break;
    case "fantasma":
      s.ghost = true;
      hkSetInfo(s, "FANTASMA: LA TRAZA SUBE LA MITAD Y LOS FALLOS MENORES NO SUMAN");
      break;
    case "rompehielo":
      if (L.diff > 3) {
        ok = false;
        ee("toast", "El Rompehielo solo vale hasta dificultad 3.", "warn");
      } else {
        s.trace = Math.min(100, s.trace + 12 * s.mods.trace);
        s.used[id] = true;
        H.tools[id]--;
        s.toolsUsed++;
        hkSfx("hkLock");
        hkLayerWin(s);
        hkToolsHud(s);
        hkTraceChecks(s);
        return true;
      }
      break;
  }
  if (!ok) return false;
  s.used[id] = true;
  H.tools[id]--;
  s.toolsUsed++;
  hkSfx("buff");
  hkHud(s, true);
  return true;
}

// ── Fin de la sesión ─────────────────────────────────────────────────────────────────────────────────
function hkCleanup(s) {
  if (s.onKey) {
    window.removeEventListener("keydown", s.onKey);
    s.onKey = null;
  }
  if (s.raf) {
    window.cancelAnimationFrame(s.raf);
    s.raf = 0;
  }
  if (s.game) {
    try {
      s.game.destroy();
    } catch (e) {
      /* ya destruido */
    }
    s.game = null;
  }
  if (HK.s === s) HK.s = null;
}
// Cierre sin resultado (✕, «Desconectar» o cambio de panel): sin penalización
// El callback del llamador se entrega DESPUÉS de cerrar el panel (nunca dentro del cierre: si abriera otro panel, Ze.close lo cerraría)
function hkDeliver(s) {
  const cb = s.cb,
    res = s.cbRes;
  s.cb = null;
  s.cbRes = null;
  if (!cb || !res) return;
  try {
    cb(res);
  } catch (err) {
    console.warn("hackeo: callback", err);
  }
}
function hkAbort(s) {
  const was = s.ended;
  s.ended = true;
  hkCleanup(s);
  if (was) {
    if (s.cb && s.cbRes) setTimeout(() => hkDeliver(s), 0); // cierre con ✕ o Esc tras el resultado
    return;
  }
  const res = hkResult(s, false);
  res.abortado = true;
  HK.last = res;
  if (s.spec.onAbort) {
    try {
      s.spec.onAbort(res);
    } catch (e) {
      console.warn("hackeo: onAbort", e);
    }
  }
  if (s.cb) {
    s.cbRes = res;
    setTimeout(() => hkDeliver(s), 0); // tras el cierre del panel que provoca quien nos aborta
  }
}
function hkResult(s, ok) {
  const done = s.kindsDone.length;
  return {
    ok: !!ok,
    capas: s.layers.length,
    capasOk: done,
    riesgo: s.risk,
    objetivo: s.spec.objetivo || "personalizado",
    traza: Math.round(s.trace),
    tiempo: +(s.tRun || 0).toFixed(1),
    fallos: s.fails,
    errores: s.errors,
    programas: s.toolsUsed,
    kinds: s.layers.map((L) => L.kind),
    id: s.spec.id || null,
    nivel: s.mods.lvl,
  };
}
function hkFinish(s, ok) {
  if (s.ended) return;
  s.ended = true;
  s.state = "end";
  if (s.raf) {
    window.cancelAnimationFrame(s.raf);
    s.raf = 0;
  }
  if (s.game) {
    try {
      s.game.destroy();
    } catch (e) {
      /* ya destruido */
    }
    s.game = null;
  }
  const H = hkState(),
    res = hkResult(s, ok),
    R = HK_CFG.risk[s.risk],
    T = HK_CFG.trace;
  const lines = [];
  // estadísticas
  const st = H.stats;
  st.runs++;
  ok ? st.ok++ : st.fail++;
  st.layers += res.capasOk;
  st.maxRisk = Math.max(st.maxRisk, ok ? s.risk : 0);
  for (const k of s.kindsDone) st.byKind[k] = (st.byKind[k] | 0) + 1;
  H.heat = Math.min(T.heatMax, H.heat + (ok ? T.heatPerHack : T.heatFail));
  // XP de hackeo: lo que valga el objetivo × capas × riesgo (si fallas, un 15 % por capa superada)
  const base = (s.spec.xp || 14) * (HK_CFG.layerXp[Math.min(3, s.layers.length)] || 1) * R.xp * (1 + 0.12 * (Math.round(s.spec.diff) - 1));
  const xp = Math.round(ok ? base : base * 0.15 * (res.capasOk / Math.max(1, s.layers.length)));
  res.xp = xp;
  const lvl0 = H.lvl;
  if (xp > 0) hkAddXp(xp);
  res.nivelNuevo = H.lvl > lvl0 ? H.lvl : 0;
  // efectos en el mundo y recompensas
  try {
    if (s.spec.onDone) {
      const l = s.spec.onDone(res, s);
      if (Array.isArray(l)) lines.push(...l);
    }
    if (ok && !s.spec.noRewards) hkRewards(s, res, lines);
  } catch (err) {
    console.warn("hackeo: efectos", err);
  }
  HK.last = res;
  ee("hackDone", res);
  s.cbRes = res; // el callback del llamador espera a que el jugador vea y cierre el resultado
  ee("save");
  hkSfx(ok ? "success" : "alarm");
  hkShowResult(s, res, lines);
}
function hkShowResult(s, res, lines) {
  if (!s.body || !s.body.isConnected) return hkDeliver(s);
  const H = hkState(),
    R = HK_CFG.risk[s.risk];
  const xpPct = Math.min(100, Math.round((H.xp / hkXpToNext(H.lvl)) * 100));
  s.body.className = "wbody";
  s.body.innerHTML = `<div class="hk-res"><h2 style="color:${res.ok ? "var(--good)" : "var(--bad)"}">${res.ok ? "Acceso concedido" : s.trace >= 100 ? (s.spec.target === "chip" ? "Traza completa · conexión cortada" : "Traza completa · alarma") : "Conexión perdida"}</h2>
    <div class="hk-kv" style="justify-content:center"><span>Capas <b>${res.capasOk}/${res.capas}</b></span><span>Traza <b>${res.traza} %</b></span><span>Tiempo <b>${Math.round(res.tiempo)} s</b></span><span>Riesgo <b>${R.n}</b></span></div>
    <ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
    <div class="hk-kv" style="justify-content:center"><span>Hackeo <b>nv ${H.lvl}</b>${res.nivelNuevo ? ' <b style="color:var(--good)">¡sube!</b>' : ""} · +${res.xp} XP</span></div>
    <div class="hk-xp"><i style="width:${xpPct}%"></i></div>
    <button class="btn pri hk-big" id="hkOk" style="min-width:min(260px,70%)">Continuar</button></div>`;
  s.body.querySelector("#hkOk").addEventListener("click", () => {
    Ze.close();
    hkDeliver(s);
  });
}

// ═══ 7. OBJETIVOS ═══════════════════════════════════════════════════════════════════════════════════
// Nivel de zona para escalar el botín
function hkAreaLevel(at) {
  try {
    if (x.mode === "op" && x.op) return x.op.lvl;
    if (x.world && x.world.lvlAt && at) return x.world.lvlAt(at.x, at.z);
  } catch (e) {
    /* sin nivel de zona */
  }
  return x.S ? x.S.lvl : 1;
}
// Descarga de contraataque: nunca letal (deja al menos el 10 % de vida)
function hkShock(frac) {
  const p = x.player;
  if (!p || p.dead || !(frac > 0)) return 0;
  const dmg = Math.min(p.maxHp * frac, Math.max(0, p.hp - Math.max(5, p.maxHp * 0.1)));
  if (dmg <= 0) return 0;
  p.hurt(dmg, { elem: "shock" });
  try {
    x.fx.zap(p.x - 1, p.z - 1, p.x + 1, p.z + 1, 0x46e4ff, 1.4);
  } catch (e) {
    /* sin efecto */
  }
  return dmg;
}

// ── 7.1 Terminales y cámaras acorazadas ──────────────────────────────────────────────────────────────
function hkTerminalSpec(ent, rt) {
  const E = HK_CFG.eff[ent.eff] || HK_CFG.eff.relay;
  const diff = Math.max(1, Math.min(4, ent.diff || 1));
  const layers = Math.min(3, E.layers + (diff >= E.plusAt ? 1 : 0));
  const id = ent.id || `t${Math.floor(ent.x)}_${Math.floor(ent.z)}`;
  const seed = hkHash(id + (x.mode === "op" && x.op ? x.op.seed : ""));
  return {
    target: "terminal",
    objetivo: ent.eff === "boss" ? "baliza" : E.vault ? "camara" : "terminal",
    id,
    title: "Terminal · " + E.n,
    sub: E.d,
    diff,
    layers,
    seed,
    need: HK_CFG.needByDiff[diff] || 1,
    xp: E.xp,
    at: { x: ent.x, z: ent.z },
    ent,
    rt,
    onDone(res) {
      const lines = [];
      const W = x.world;
      if (res.ok) {
        W.hackResult(ent, rt, true);
        lines.push(`${ke(E.d)}`);
      } else {
        W.hackResult(ent, rt, false);
        if (rt) rt.lockUntil = x.time + 20 + 10 * res.riesgo;
        const dmg = hkShock(HK_CFG.trace.shock * (res.traza >= 100 ? 1 : 0.4));
        lines.push("<b>¡ALARMA!</b> Hostiles en camino", dmg > 0 ? `Descarga de contraataque: −${Math.round(dmg)} vida` : "El sistema se bloquea unos segundos");
      }
      return lines;
    },
  };
}
// Lo llama jp (29-panels.js) al interactuar con una terminal. Devuelve true si el hackeo nuevo se ha hecho cargo.
function hackOpenTerminal(ent, rt) {
  try {
    if (!ent || !x.started || !x.S) return false;
    if (HK.s && (HK.s.ended || x.uiOpen !== "hack")) hkCleanup(HK.s);
    return !!hkOpen(hkTerminalSpec(ent, rt), null);
  } catch (err) {
    console.warn("hackeo: terminal", err);
    return false;
  }
}

// ── 7.2 Torretas y drones controlables, mecánicos desactivables ──────────────────────────────────────
var HK_FAST = ["fw", "tune", "brute", "sync", "route"]; // capas ágiles para el combate
function hkEnemyKind(e) {
  if (!e || e.dead || e.boss || e.mini || e.burrowed) return null;
  const E = HK_CFG.enemy;
  if (E.control[e.id]) return "control";
  if (E.off[e.id]) return "off";
  return null;
}
function hkEnemySpec(e) {
  const E = HK_CFG.enemy,
    kind = hkEnemyKind(e),
    info = kind === "control" ? E.control[e.id] : E.off[e.id];
  const diff = Math.max(1, Math.min(4, 1 + Math.floor((e.lvl || 1) / 14) + (e.elite ? 1 : 0)));
  const H = hkState();
  return {
    target: "enemy",
    objetivo: kind === "control" ? (e.fly ? "dron" : "torreta") : "mecanico",
    id: e.id,
    title: (kind === "control" ? "Intrusión · " : "Apagado · ") + info.n,
    sub: kind === "control" ? "Toma el control y úsalo contra sus aliados" : "Apaga la unidad unos segundos",
    diff,
    layers: 1,
    pool: HK_FAST,
    seed: hkHash(e.id + ":" + (e.uid || 0) + ":" + Math.floor(x.S.playTime || 0)),
    need: (kind === "control" ? E.needControl : E.needOff) + 2 * (diff - 1),
    xp: info.xp,
    at: { x: e.x, z: e.z },
    enemy: e,
    rewMul: 0.5,
    onDone(res) {
      const lines = [];
      if (e.dead) return ["El objetivo ya estaba destruido."];
      if (res.ok) {
        const lvl = H.lvl,
          over = res.riesgo === 2;
        let secs = E.time[kind] + E.time.perLvl * (lvl - 1);
        if (kind === "control") secs *= 1 + hkFx("turretTime");
        secs = Math.min(E.time.max, secs);
        if (kind === "control") {
          hkApplyControl(e, secs, over);
          H.stats.ctl++;
          lines.push(`Control de ${ke(info.n)} durante <b>${Math.round(secs)} s</b>${over ? " · sobrecarga: más daño y explotará al terminar" : ""}`);
        } else {
          hkApplyOff(e, secs);
          H.stats.off++;
          lines.push(`${ke(info.n)} apagado durante <b>${Math.round(secs)} s</b>`);
        }
      } else {
        e.alerted = true;
        e.aggroT = 5;
        if (!e.hkFz) {
          e.hkFz = 1;
          e.dmg *= E.failFrenzy;
        }
        const dmg = hkShock(HK_CFG.trace.shock * (res.traza >= 100 ? 0.8 : 0.35));
        lines.push("<b>Contramedida activada</b>: la unidad golpea un 30 % más fuerte", dmg > 0 ? `Descarga: −${Math.round(dmg)} vida` : "");
      }
      return lines.filter(Boolean);
    },
  };
}
function hkStartEnemy(e) {
  if (!e || e.dead || x.uiOpen || x.paused || !x.started || (x.player && x.player.dead)) return false;
  if (!hkEnemyKind(e)) return false;
  if (HK.s && (HK.s.ended || x.uiOpen !== "hack")) hkCleanup(HK.s);
  return !!hkOpen(hkEnemySpec(e), null);
}
// DPS del arma activa del jugador (lo que añade una unidad controlada es un múltiplo de esto, no un número fijo)
function hkPlayerDps() {
  try {
    const S = x.S,
      p = x.player,
      it = S.eq[S.activeW === 0 ? "w1" : "w2"];
    if (it) {
      const o = Mo(it),
        d = o.dmg * (o.pellets || 1) * o.rate * (p && p.dyn ? p.dyn().dmg : 1);
      if (d > 0 && isFinite(d)) return d;
    }
  } catch (err) {
    /* sin arma equipada: cae al valor de referencia de los gadgets */
  }
  return typeof gdG === "function" ? gdG() * 0.4 : 20;
}
function hkApplyControl(e, secs, over) {
  if (!e || e.dead) return;
  if (e.hk) hkRelease(e, true);
  e.hk = { mode: "control", t: secs, max: secs, over: !!over, cd: 0.35, scan: 0, fxT: 0, a: HK.rng() * 6.28, prevInv: !!e.invuln, tgt: null, dps: hkPlayerDps() };
  e.invuln = true; // no recibe daño ni entra en la mira del jugador mientras es aliado
  if (HK.ctl.indexOf(e) < 0) HK.ctl.push(e);
  try {
    x.fx.ring(e.x, e.z, 2.6, 0x46e4ff, 0.7, 2);
    x.fx.burst(e.x, 1, e.z, 18, { color: 0x46e4ff, speed: 4, life: 0.5, size: 0.18, up: 1 });
    x.fx.text(e.x, 2.3, e.z, "CONTROLADO", "#46e4ff", 14, { life: 1.2 });
  } catch (err) {
    /* sin efecto */
  }
  hkSfx("hkCtl");
}
function hkApplyOff(e, secs, quiet) {
  if (!e || e.dead) return;
  if (e.hk && e.hk.mode === "off") {
    e.hk.t = Math.max(e.hk.t, secs);
    return;
  }
  if (e.hk) return;
  e.hk = { mode: "off", t: secs, max: secs, fxT: 0, over: false, prevInv: !!e.invuln };
  if (HK.ctl.indexOf(e) < 0) HK.ctl.push(e);
  try {
    x.fx.burst(e.x, 1, e.z, 14, { color: 0xffd447, speed: 3, life: 0.4, size: 0.16, up: 1 });
    if (!quiet) x.fx.text(e.x, 2.3, e.z, "APAGADO", "#ffd447", 14, { life: 1.2 });
  } catch (err) {
    /* sin efecto */
  }
  if (!quiet) hkSfx("hkOff");
}
function hkRelease(e, silent) {
  const h = e.hk;
  if (!h) return;
  e.hk = null;
  e.invuln = h.prevInv;
  const i = HK.ctl.indexOf(e);
  if (i >= 0) HK.ctl.splice(i, 1);
  if (e.dead || silent) return;
  if (h.over && h.mode === "control") {
    // sobrecarga: detona en área contra los demás y se destruye (el botín es tuyo)
    const O = HK_CFG.enemy.overcharge;
    try {
      x.fx.explosion(e.x, e.z, O.boom, 0x46e4ff);
      hkSfx("boom", { v: 0.8 });
    } catch (err) {
      /* sin efecto */
    }
    dn(e.x, e.z, O.boom, e.dmg * O.boomMul * (1 + hkFx("turretDmg")), { owner: "p", color: 0x46e4ff, kb: 6 });
    if (!e.dead) e.kill({});
    return;
  }
  e.alerted = true;
  e.aggroT = 4;
  try {
    x.fx.ring(e.x, e.z, 2, 0xff4f5e, 0.6, 2);
    x.fx.text(e.x, 2.3, e.z, "REINICIADO", "#ff8d97", 13, { life: 1 });
  } catch (err) {
    /* sin efecto */
  }
}
// Se llama desde gadgetEnemyTick (envuelto más abajo) para los enemigos con e.hk. Devuelve true = se salta la IA normal.
function hkEnemyTick(e, dt) {
  const h = e.hk;
  if (e.dead) {
    hkRelease(e, true);
    return false;
  }
  h.t -= dt;
  if (h.t <= 0) {
    hkRelease(e, false);
    return false;
  }
  e.vx *= 0.82;
  e.vz *= 0.82;
  h.fxT -= dt;
  if (h.fxT <= 0) {
    h.fxT = h.mode === "off" ? 0.35 : 0.6;
    if (h.mode === "off") x.fx.zap(e.x, e.z, e.x + (HK.rng() - 0.5) * 1.6, e.z + (HK.rng() - 0.5) * 1.6, 0xffd447, 0.6 + HK.rng());
    else x.fx.ring(e.x, e.z, 1.2, h.over ? 0xffb340 : 0x46e4ff, 0.5, 2);
  }
  if (h.mode === "off") return true;
  // control: busca el enemigo más cercano a la vista y le dispara; los drones flotan junto al jugador
  const E = HK_CFG.enemy,
    info = E.control[e.id] || { dpsMul: 1, cd: 0.4 },
    p = x.player,
    atk = e.def.atk || {};
  const range = (atk.range || 10) + 2;
  h.scan -= dt;
  if (h.scan <= 0) {
    h.scan = 0.12;
    let best = null,
      bd = range;
    const list = rn(e.x, e.z, range, HK.tmp);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === e || o.hk || !o.targetable()) continue;
      const d = Le(o.x, o.z, e.x, e.z);
      if (d < bd && x.map.los(e.x, e.z, o.x, o.z)) {
        bd = d;
        best = o;
      }
    }
    h.tgt = best;
  }
  if (e.fly && p && !p.dead) {
    h.a += dt * 0.9;
    e.steer(p.x + Math.cos(h.a) * 3.2, p.z + Math.sin(h.a) * 3.2, e.spd * 1.3, dt);
  }
  const t = h.tgt;
  if (t && !t.dead) {
    const a = Math.atan2(t.x - e.x, t.z - e.z);
    e.face += fi(e.face, a) * Math.min(1, dt * 12);
    h.cd -= dt;
    if (h.cd <= 0) {
      h.cd = info.cd;
      const sp = 34,
        ox = e.x + Math.sin(a) * 0.8,
        oz = e.z + Math.cos(a) * 0.8,
        dist = Le(t.x, t.z, e.x, e.z);
      x.projs.push({
        owner: "p",
        kind: "bullet",
        x: ox,
        y: e.fly ? 1.4 : 1.0,
        z: oz,
        vx: Math.sin(a) * sp,
        vz: Math.cos(a) * sp,
        dmg: h.dps * info.dpsMul * info.cd * (1 + hkFx("turretDmg")) * (h.over ? E.overcharge.dmg : 1),
        life: (dist + 1.5) / sp,
        pierce: 0,
        rico: 0,
        hit: new Set([e]),
        color: h.over ? 0xffb340 : 0x46e4ff,
        w: 0.06,
        len: 1,
      });
      x.fx.muzzle(ox, e.fly ? 1.4 : 1.0, oz, a, h.over ? 0xffb340 : 0x46e4ff, 0.9);
      hkSfx("laser", { gap: 0.06, v: 0.3, p: 1.4 });
    }
  }
  return true;
}
// Envoltorio de la IA de enemigos (21-enemies.js llama a gadgetEnemyTick): los hackeados se saltan la IA normal
(function hkWrapEnemyTick() {
  const prev = gadgetEnemyTick;
  gadgetEnemyTick = function (e, dt, dist) {
    if (e.hk && hkEnemyTick(e, dt)) return true;
    return prev(e, dt, dist);
  };
})();

// ── 7.3 Marcador táctil «HACKEAR», tecla V y barrido ─────────────────────────────────────────────────
yw.KeyV = "hack";
function hkBuildMark() {
  if (HK.mark) return HK.mark;
  const host = document.getElementById("app") || document.body;
  const el = document.createElement("div");
  el.className = "hk-mark";
  el.innerHTML = '<button type="button" aria-label="Hackear"><b>⌗</b><span class="t">HACKEAR<small></small></span><kbd>V</kbd></button>';
  host.appendChild(el);
  const go = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    Tt.touchMode = ev.pointerType === "touch" || Tt.touchMode;
    if (HK.cand) hkStartEnemy(HK.cand);
  };
  el.addEventListener("pointerdown", go);
  el.addEventListener("touchstart", (ev) => ev.preventDefault(), { passive: false });
  el.addEventListener("contextmenu", (ev) => ev.preventDefault());
  HK.mark = { el, sub: el.querySelector("small"), kbd: el.querySelector("kbd"), id: null, shown: false, px: -1, py: -1 };
  return HK.mark;
}
function hkScan() {
  const p = x.player,
    E = HK_CFG.enemy,
    intr = hkFx("intruder") > 0;
  let best = null,
    bd = 1e9;
  const list = rn(p.x, p.z, intr ? E.rangeIntruder : E.range, HK.tmp);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.hk) continue;
    const k = hkEnemyKind(e);
    if (!k || !e.rig || !e.rig.root.visible) continue;
    const d = Le(e.x, e.z, p.x, p.z),
      reach = k === "control" && intr ? E.rangeIntruder : E.range;
    if (d > reach || (d > 3.5 && !x.map.los(p.x, p.z, e.x, e.z))) continue;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  HK.cand = best;
}
function hkMarkUpdate() {
  const m = HK.mark,
    e = HK.cand;
  if (!m) return;
  if (!e || e.dead || x.uiOpen || x.paused || !x.player || x.player.dead) {
    if (m.shown) {
      m.el.style.display = "none";
      m.shown = false;
    }
    return;
  }
  const o = HK.pt;
  x.R.project(e.x, 1.25 * (e.scale || 1) + 0.9, e.z, o);
  if (!o.vis || o.x < -40 || o.y < 0 || o.x > x.R.w + 40 || o.y > x.R.h + 40) {
    if (m.shown) {
      m.el.style.display = "none";
      m.shown = false;
    }
    return;
  }
  if (m.id !== e.uid) {
    m.id = e.uid;
    const k = hkEnemyKind(e),
      E = HK_CFG.enemy,
      info = k === "control" ? E.control[e.id] : E.off[e.id];
    const need = (k === "control" ? E.needControl : E.needOff) + 2 * (Math.max(1, Math.min(4, 1 + Math.floor((e.lvl || 1) / 14) + (e.elite ? 1 : 0))) - 1);
    m.sub.textContent = `${info.n} · ${k === "control" ? "controlar" : "apagar"}`;
    m.el.classList.toggle("low", (hkState() ? hkState().lvl : 1) < need);
    m.kbd.style.display = hkTouch() ? "none" : "";
  }
  if (!m.shown) {
    m.el.style.display = "block";
    m.shown = true;
  }
  const px = Math.round(o.x),
    py = Math.round(o.y);
  if (px !== m.px || py !== m.py) {
    m.px = px;
    m.py = py;
    m.el.style.transform = `translate(${px}px,${py}px) translate(-50%,-100%)`;
  }
}

// ── 7.4 Módulo «Hacker» (gadget) ─────────────────────────────────────────────────────────────────────
(function hkRegisterGadget() {
  const GC = x.cfg.gadgets;
  if (!GC || !GC.types || typeof GD_ORDER === "undefined") return;
  const G = HK_CFG.gadget;
  GC.types[G.id] = {
    id: G.id,
    n: "Módulo Hacker",
    s: "HACK",
    cat: "device",
    kind: "hacker",
    shape: "coil",
    col: 0x46e4ff,
    tier: 3,
    scale: 1.15,
    d: "Un dispositivo que hackea solo: apaga a los mecánicos cercanos y toma el control de torretas y drones enemigos durante unos segundos.",
    cost: { data: 3, battery: 2, credits: 70 },
    trof: 3,
    arm: 1,
    life: G.life,
    r: G.r,
    statText: `Alcance ${G.r} m · ${G.life} s · apaga mecánicos y controla hasta ${G.maxCtl} torretas o drones`,
  };
  if (GD_ORDER.indexOf(G.id) < 0) GD_ORDER.push(G.id);
  if (typeof GD_ICONS !== "undefined")
    GD_ICONS[G.id] =
      '<path d="M4 8h16v9H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 4v4M12 4v4M16 4v4M8 17v3M12 17v3M16 17v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 12.5l2-2 1.5 1.5 3-3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
})();
function hkGadgetPulse(g) {
  const G = HK_CFG.gadget,
    r = typeof gdRad === "function" ? gdRad(G.r) : G.r;
  const list = rn(g.x, g.z, r, HK.tmp);
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i],
      k = hkEnemyKind(e);
    if (!k) continue;
    if (k === "off") {
      if (!e.hk || e.hk.mode === "off") {
        hkApplyOff(e, G.offSecs, true);
        x.fx.zap(g.x, g.z, e.x, e.z, 0x46e4ff, 0.8);
        n++;
      }
    } else if (!e.hk && (g.hkCtl | 0) < G.maxCtl) {
      hkApplyControl(e, G.ctlSecs * (1 + hkFx("turretTime")), false);
      g.hkCtl = (g.hkCtl | 0) + 1;
      x.fx.zap(g.x, g.z, e.x, e.z, 0x46e4ff, 1.2);
      n++;
    }
  }
  if (n) {
    HK.gadgetHits = (HK.gadgetHits | 0) + n;
    if (typeof gdTriggered === "function") gdTriggered(g, n);
  }
  x.fx.ring(g.x, g.z, Math.min(r, 6), 0x46e4ff, 0.7, 2);
}
It("gadgetPlaced", (g) => {
  if (g && g.id === HK_CFG.gadget.id) {
    g.hkCtl = 0;
    g.hkT = 0.2;
    ee("toast", "Módulo Hacker en marcha: apaga mecánicos y controla torretas y drones.", "good");
  }
});

// ── 7.5 Bucle por fotograma ──────────────────────────────────────────────────────────────────────────
// El bucle de abajo no corre con un panel abierto ni en el menú principal: si el marcador «HACKEAR» estaba a la vista al pausar y salir al
// menú, su display en línea (que el CSS solo tapa mientras haya panel) reaparecería flotando sobre el menú. Se oculta al volver a él.
It("toMenu", () => {
  HK.cand = null;
  if (HK.mark && HK.mark.shown) {
    HK.mark.el.style.display = "none";
    HK.mark.shown = false;
  }
});
x.tick.push((dt) => {
  if (!x.S || !x.started || !x.player) return;
  // tecla V (escritorio): hackea el objetivo marcado
  if (Tt.hit("hack") && !x.uiOpen && HK.cand) hkStartEnemy(HK.cand);
  HK.scanT -= dt;
  if (HK.scanT <= 0) {
    HK.scanT = HK_CFG.enemy.scan;
    if (!x.uiOpen && !x.player.dead && (x.mode === "world" || x.mode === "op")) {
      hkScan();
      if (HK.cand && !HK.mark) hkBuildMark();
      if (HK.cand) {
        const S = x.S;
        if (!S.seenTips) S.seenTips = {};
        if (!S.seenTips.hackEnemy) {
          S.seenTips.hackEnemy = 1;
          ee("toast", Tt.touchMode ? "Hay una unidad hackeable: toca el marcador HACKEAR." : "Hay una unidad hackeable: pulsa V para hackearla.", "quest");
        }
      }
    } else HK.cand = null;
    // los enemigos bajo control que ya no existen (cambio de zona)
    for (let i = HK.ctl.length - 1; i >= 0; i--) {
      const e = HK.ctl[i];
      if (!e.hk || e.dead || x.enemies.indexOf(e) < 0) {
        if (e.hk) {
          e.invuln = e.hk.prevInv;
          e.hk = null;
        }
        HK.ctl.splice(i, 1);
      }
    }
  }
  hkMarkUpdate();
  // módulos Hacker desplegados
  if (typeof GD !== "undefined" && GD.list.length) {
    for (let i = 0; i < GD.list.length; i++) {
      const g = GD.list[i];
      if (g.id !== HK_CFG.gadget.id || g.st !== "on") continue;
      g.hkT = (g.hkT === undefined ? 0 : g.hkT) - dt;
      if (g.hkT <= 0) {
        g.hkT = HK_CFG.gadget.pulse;
        hkGadgetPulse(g);
      }
    }
  }
});

// ── 7.6 Chips de lore (x.loreApi) ────────────────────────────────────────────────────────────────────
// Descifra un chip: dos capas (la primera, un cifrado con la pista del archivo). Éxito → calidad completa (q = 1); si fallas,
// q es parcial según las capas superadas (el Archivo lo acumula, tope 0,85). opts.lore = lo lanza el propio Archivo (31d-lore.js)
// con su callback: entonces NO se llama a decrypt desde aquí (lo hace el Archivo con res.q) para no contar dos veces el intento.
function hkDecryptChip(id, cb, opts) {
  opts = opts || {};
  const L = x.loreApi;
  const spec = {
    target: "chip",
    objetivo: "chip",
    id: String(id),
    title: "Chip cifrado",
    sub: opts.name ? `Descifra «${opts.name}»` : opts.sub || "Descifra el contenido del chip",
    diff: Math.max(1, Math.min(4, +opts.diff || 2)),
    kinds: ["cipher"],
    layers: opts.layers || 2,
    pool: ["code", "route", "fw", "seq", "sync", "lights"],
    seed: hkHash("chip:" + id),
    need: opts.need || 2,
    xp: 24,
    loot: false,
    rewMul: 0.6,
    lore: !!opts.lore,
    onAbort(res) {
      res.chip = String(id);
      res.q = 0;
    },
    onDone(res) {
      const lines = [];
      // limpieza del hackeo (traza baja y riesgo alto): solo informativa, el Archivo no distingue calidades por encima de «completo»
      const clean = Math.max(0.4, Math.min(1, 1 - res.traza / 200 + res.riesgo * 0.1));
      res.calidad = +clean.toFixed(2);
      res.chip = String(id);
      res.q = res.ok ? 1 : Math.min(0.85, +((0.7 * res.capasOk) / Math.max(1, res.capas)).toFixed(2));
      let granted = false;
      if (!spec.lore) {
        try {
          const r = L && typeof L.decrypt === "function" ? L.decrypt(id, res.q) : null;
          granted = r === true || !!(r && r.ok);
          if (r && typeof r.q === "number" && !r.ok) res.q = r.q;
        } catch (e) {
          console.warn("hackeo: loreApi.decrypt", e);
        }
      }
      // con lore:true es el Archivo quien decide la calidad final (cada fallo lo deja algo más legible): aquí no se promete un porcentaje
      if (!res.ok) return [spec.lore ? "El chip resiste, pero el Archivo lo deja algo más legible: puedes intentarlo de nuevo." : res.q > 0 ? `El chip resiste, pero queda legible al <b>${Math.round(res.q * 100)} %</b>: vuelve a intentarlo.` : "El chip resiste: puedes intentarlo de nuevo."];
      const H = hkState();
      H.stats.chips++;
      if (typeof ecoGrantXp === "function") ecoGrantXp(HK_CFG.reward.chipXp, "chip");
      lines.push(granted || spec.lore ? `Chip descifrado · limpieza <b>${Math.round(clean * 100)} %</b>` : `Chip abierto · limpieza ${Math.round(clean * 100)} %`);
      return lines;
    },
  };
  return hkOpen(spec, cb);
}

// Resumen para el panel Personaje (29-panels · oS)
function hackSummaryText() {
  const H = hkState();
  if (!H) return "—";
  return `nv ${H.lvl}${H.lvl < HK_CFG.maxLevel ? ` (${yt(H.xp)}/${yt(hkXpToNext(H.lvl))})` : " · máx."} · ${H.stats.ok} intrusiones`;
}

// ═══ 8. RECOMPENSAS ═════════════════════════════════════════════════════════════════════════════════
// Por riesgo y capas: créditos, datos, botín de cofre (2+ capas), programas y planos de gadget (hackeos profundos)
function hkPickProgram(H) {
  const ids = HK_PROG.filter((id) => H.lvl >= HK_CFG.programs[id].min);
  const w = ids.map((id) => 1 / (1 + HK_PROG.indexOf(id) * 0.7));
  let t = w.reduce((a, b) => a + b, 0),
    q = HK.rng() * t;
  for (let i = 0; i < ids.length; i++) {
    q -= w[i];
    if (q <= 0) return ids[i];
  }
  return ids[0];
}
function hkRewards(s, res, lines) {
  const R = HK_CFG.reward,
    risk = HK_CFG.risk[s.risk],
    n = res.capas,
    sp = s.spec,
    p = x.player;
  const at = sp.at || { x: p.x, z: p.z },
    lvl = hkAreaLevel(at),
    k = risk.rew * (sp.rewMul == null ? 1 : sp.rewMul),
    H = hkState();
  const cr = Math.round(R.credits * mt.credits(lvl) * n * k);
  if (cr > 0) {
    Nt("cr", at.x, at.z, { val: cr });
    lines.push(`<b>+${yt(cr)} ¤</b> créditos`);
  }
  const dt = Math.max(1, Math.round((R.data[Math.min(3, n)] || 1) * k));
  Nt("mat", at.x, at.z, { mat: "data", val: dt });
  lines.push(`<b>+${dt}</b> datos`);
  let tier = n >= 3 ? 2 : n >= 2 ? 1 : 0;
  if (s.risk === 2 && tier > 0) tier++;
  tier = Math.min(3, tier);
  if (tier > 0 && sp.loot !== false) {
    Co(at.x, at.z + 0.9, tier, lvl);
    lines.push(`Botín de cofre <b>nivel ${tier}</b>`);
  }
  const pc = R.programChance[s.risk] * Math.min(1.5, n / 2) * (sp.rewMul == null ? 1 : Math.max(0.5, sp.rewMul));
  if (HK.rng() < pc) {
    const id = hkPickProgram(H),
      got = hkGiveTool(id, s.risk === 2 && n >= 3 ? 2 : 1);
    if (got) lines.push(`Programa: <b>${HK_CFG.programs[id].n}</b> ×${got}`);
  }
  if ((n >= 2 || s.risk === 2) && typeof gadgetPlanDrop === "function" && sp.target !== "chip") {
    const plan = gadgetPlanDrop("hack", true);
    if (plan) {
      ee("gadgetPlanDrop", plan, at, "hack");
      lines.push(`<b>${ke(plan.name)}</b>`);
    }
  }
  // una cámara acorazada (cofre, oculta, baliza) puede esconder un chip del Archivo (el frente LORE lo presenta; se descifra hackeándolo)
  let chip = null;
  const A = x.loreApi;
  if (A && typeof A.next === "function" && typeof A.grant === "function" && sp.target === "terminal" && sp.ent && HK_CFG.eff[sp.ent.eff] && HK_CFG.eff[sp.ent.eff].vault) {
    if (HK.rng() < R.chipChance[s.risk] * Math.min(1.5, n / 2)) {
      try {
        const id = A.next("chip", sp.ent.reg);
        if (id && A.grant(id)) {
          chip = id;
          lines.push("Chip cifrado hallado: descífralo en el Archivo");
        }
      } catch (err) {
        console.warn("hackeo: chip de lore", err);
      }
    }
  }
  res.recompensas = { creditos: cr, datos: dt, cofre: tier, programa: lines.some((l) => l.indexOf("Programa:") === 0), chip };
}

// ═══ 9. API Y PRUEBAS ═══════════════════════════════════════════════════════════════════════════════
// spec público: {title, sub, objetivo, diff (1-4), layers (1-3) | kinds:[…], pool, seed, need, xp, risk (0-2, fija el riesgo), noPre, at:{x,z}}
function hkRun(spec, cb) {
  // contrato con el Archivo (31d-lore.js): run({kind:"chip", id, name, tier|diff, lore:true}, cb) → cb(res) con res.ok y res.q
  if (spec && spec.kind === "chip" && spec.id != null) {
    if (HK.s && (HK.s.ended || x.uiOpen !== "hack")) hkCleanup(HK.s);
    const sc = hkDecryptChip(spec.id, cb, { name: spec.name, diff: spec.diff || spec.tier, lore: !!spec.lore, layers: spec.layers });
    return sc ? { session: sc, abort: () => Ze.close() } : null;
  }
  spec = Object.assign({ title: "Intrusión", diff: 1, layers: 1, objetivo: "personalizado", need: 1, xp: 12 }, spec || {});
  spec.diff = Math.max(1, Math.min(4, +spec.diff || 1));
  if (!spec.seed) spec.seed = hkHash(spec.title + ":" + Math.floor(performance.now()));
  if (HK.s && (HK.s.ended || x.uiOpen !== "hack")) hkCleanup(HK.s);
  const s = hkOpen(spec, cb);
  return s ? { session: s, abort: () => Ze.close() } : null;
}
x.hackApi = {
  version: 1,
  level: () => {
    const H = hkState();
    return H ? H.lvl : 1;
  },
  xp: () => {
    const H = hkState();
    return H ? { xp: H.xp, next: hkXpToNext(H.lvl), lvl: H.lvl } : null;
  },
  addXp: hkAddXp,
  run: hkRun,
  open: hackOpenTerminal,
  decryptChip: hkDecryptChip,
  active: () => !!HK.s && !HK.s.ended,
  last: () => HK.last,
  kinds: Object.keys(HK_GAMES),
  mods: hkMods,
  hackable: hkEnemyKind,
  control: (e, secs, over) => hkApplyControl(e, secs || HK_CFG.enemy.time.control, over),
  disable: (e, secs) => hkApplyOff(e, secs || HK_CFG.enemy.time.off),
  release: hkRelease,
  trace: {
    get: () => (HK.s ? Math.round(HK.s.trace) : 0),
    add: (n) => HK.s && hkAddTrace(HK.s, n),
    heat: () => {
      const H = hkState();
      return H ? Math.round(H.heat) : 0;
    },
    cfg: HK_CFG.trace,
  },
  programs: {
    defs: HK_CFG.programs,
    count: hkToolCount,
    give: hkGiveTool,
    compile: hkCompile,
    cost: hkProgCost,
    spend(id) {
      const H = hkState();
      if (!H || !(H.tools[id] > 0)) return false;
      H.tools[id]--;
      return true;
    },
  },
};
// Pruebas (escenarios y simulaciones)
window.__hack = {
  cfg: HK_CFG,
  games: HK_GAMES,
  api: x.hackApi,
  get s() {
    return HK.s;
  },
  HK,
  state: hkState,
  mods: hkMods,
  open: hkOpen,
  terminalSpec: hkTerminalSpec,
  enemySpec: hkEnemySpec,
  startEnemy: hkStartEnemy,
  enemyKind: hkEnemyKind,
  applyControl: hkApplyControl,
  applyOff: hkApplyOff,
  scan: hkScan,
  rewards: hkRewards,
  addXp: hkAddXp,
  xpToNext: hkXpToNext,
  migrate: hkMigrate,
  planLayers: hkPlanLayers,
  sims: { HkFwSim, HkBruteSim, hkFwGen, hkBruteGen, hkTuneGen, hkTuneTarget, hkTuneErr, hkRouteGen, hkRouteSolve, hkCipherGen, hkLayerLimit, hkShortfall },
  gadgetPulse: hkGadgetPulse,
  playerDps: hkPlayerDps,
  rng: (s) => (HK.rng = hkRng(s)),
  // avanza la sesión activa n pasos de dt (modo manual: apaga el bucle en tiempo real); bot = el juego se resuelve solo
  step(n, dt, bot) {
    const s = HK.s;
    if (!s || s.ended) return false;
    s.manual = true;
    for (let i = 0; i < n && !s.ended; i++) {
      if (bot && s.game && s.game.bot && s.between <= 0) s.game.bot(dt || 1 / 60);
      hkStep(s, dt || 1 / 60);
    }
    return !s.ended;
  },
  // juega la sesión entera con los bots (hasta maxSec simulados); si toca la pantalla previa, pulsa CONECTAR
  autoplay(maxSec) {
    const s = HK.s;
    if (!s) return null;
    s.manual = true;
    if (s.state === "pre") hkStartRun(s);
    s.manual = true;
    const dt = 1 / 60;
    for (let t = 0; t < (maxSec || 240) && !s.ended; t += dt) {
      if (s.game && s.game.bot && s.between <= 0) s.game.bot(dt);
      hkStep(s, dt);
    }
    return HK.last;
  },
  // valida todas las capas nuevas: n semillas por dificultad
  validateAll(n) {
    const out = {};
    for (const k of HK_NEW) {
      out[k] = { total: 0, ok: 0, fails: [] };
      for (let d = 1; d <= 5; d++)
        for (let i = 0; i < (n || 20); i++) {
          const seed = hkHash(k + ":" + d + ":" + i);
          const v = HK_GAMES[k].validate(seed, d);
          out[k].total++;
          if (v.ok) out[k].ok++;
          else if (out[k].fails.length < 5) out[k].fails.push({ d, seed, v });
        }
    }
    return out;
  },
};

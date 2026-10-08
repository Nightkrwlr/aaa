// 31c-gadgets.js — Trampas, minas y desplegables (D3)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Todo lo nuevo vive aquí; los ficheros antiguos solo llaman a gadgetEnemyTick (21-enemies.js) y a las
// funciones de la pestaña del Taller (29-panels.js). Los nombres propios llevan prefijo gd / GD.
//
// Resumen de piezas:
//   1. Datos           x.cfg.gadgets (catálogo de 12 gadgets, costes, límites, probabilidades de plano)
//   2. Guardado        S.gadgets = {inv, sel, known} + S.gadgetsV (migración idempotente en x.migrations)
//   3. Gráficos        una malla instanciada por familia de forma (≤ 7 llamadas de dibujo, sin luces)
//   4. Simulación      despliegue, armado, disparo, efectos, zonas persistentes, torreta, señuelo, barrera
//   5. Enemigos        gadgetEnemyTick(e, dt, dist): estados, detección/rodeo/desarme, señuelo, barrera
//   6. Entrada y HUD   X (tocar = desplegar, mantener = detonar), Z (siguiente), botón táctil GADGET
//   7. Planos y Taller gadgetPlanDrop(src), gadgetLearn(id), pestaña «Gadgets» del banco de trabajo
//   8. Pruebas         window.__gadgets (para escenarios y simulaciones)
//
// Sinergias (leídas de S.talentFx; 0 si no existe): gadgetDmg, gadgetRadius, gadgetSlots, gadgetLife,
// gadgetCost (descuento, tope 40 %), gadgetChain (saltos extra del rayo), gadgetSave (prob. de no gastar carga).

// ═══ 1. DATOS ═══════════════════════════════════════════════════════════════════════════════════════
// Los daños van en múltiplos de «G»: el daño de una granada de fragmentación del jugador
// (arma activa × 9, igual que throwGrenade), de modo que escalan solos con el nivel y el arma.
// Costes: materiales fijos (≈ 1-1,8 min de farmeo de ese material) + créditos × mt.credits(nivel)
// (≈ 1-1,5 min de créditos) + trofeos (cualquiera). La tabla de minutos se imprime en tools/sim/gadgets.mjs.
x.cfg.gadgets = {
  version: 1,
  maxCharges: 12, // cargas máximas por tipo
  baseSlots: 3, // desplegados a la vez (+ talentFx.gadgetSlots)
  maxSlots: 8,
  mineLife: 240, // s que persisten minas y trampas (4 min)
  holdSec: 0.45, // mantener X / el botón este tiempo = detonar
  swipePx: 26, // deslizar hacia arriba este tamaño = cambiar de gadget
  placeDist: 1.7, // m por delante del jugador
  placeCd: 0.35, // s mínimos entre dos despliegues
  detonateGap: 0.09, // s entre minas al detonar en cadena
  maxDiscount: 0.4,
  start: { known: ["proximity", "cluster"], inv: { proximity: 3 }, sel: "proximity" },
  // probabilidad de plano por fuente y nivel máximo de plano que puede dar (ver gadgetPlanDrop)
  plan: {
    normal: { p: 0.0006, tier: 1 },
    elite: { p: 0.06, tier: 2 },
    champion: { p: 0.22, tier: 3 },
    chest1: { p: 0.03, tier: 1 },
    chest2: { p: 0.1, tier: 2 },
    chest3: { p: 0.25, tier: 3 },
    secret: { p: 0.3, tier: 4 },
    boss: { p: 0.4, tier: 4 },
    mission: { p: 0.5, tier: 3 },
    hack: { p: 0.2, tier: 3 },
  },
  // el Taller vende planos de nivel 1-2 (caros): créditos × mt.credits(nivel)
  planPrice: { 1: 420, 2: 950 },
  // quién detecta y cómo reacciona (por id de enemigo o familia): avoid = rodea, disarm = acude y desarma
  detect: {
    byId: { mantis: "avoid", corredor: "avoid", cazador: "avoid", rabioso: "avoid" },
    mech: "disarm", // familia mecánica terrestre (no torretas ni voladores ni bombas con patas)
    skipIds: { aranamec: 1 },
    chance: 0.7, // probabilidad de detectar una trampa concreta (se tira una vez por par enemigo-gadget)
    eliteBonus: 0.2,
    range: 6, // m a los que empieza a fijarse
    disarmSec: 1.1, // s de trabajo continuo para desarmar
    disarmFail: 0.25, // prob. de que el desarme falle y la mina explote
  },
  types: {
    proximity: {
      n: "Mina de proximidad", s: "PROX.", cat: "mine", kind: "mine", shape: "mine", col: 0xff5a3c, tier: 1,
      d: "Explota cuando un enemigo terrestre pisa su radio. Se puede detonar a distancia.",
      cost: { scrap: 3, bio: 1, credits: 28 }, trof: 2,
      dmg: 1.5, r: 3.2, trig: 1.7, arm: 0.8, fuse: 0.3, kb: 5, remote: true,
    },
    cluster: {
      n: "Mina de racimo", s: "RACIMO", cat: "mine", kind: "mine", shape: "mine", col: 0xffb040, tier: 1, scale: 1.12,
      d: "Una carga principal y seis submuniciones que se esparcen y explotan una a una.",
      cost: { scrap: 3, bio: 2, credits: 36 }, trof: 2,
      dmg: 0.7, r: 2.4, trig: 1.7, arm: 0.8, fuse: 0.3, kb: 3, remote: true,
      bomblets: 6, bDmg: 0.8, bR: 1.7, spread: 5, bDelay: [0.12, 0.6],
    },
    incendiary: {
      n: "Mina incendiaria", s: "FUEGO", cat: "mine", kind: "mine", shape: "mine", col: 0xff7a1a, tier: 2,
      d: "Explosión que prende a los enemigos y deja un charco de fuego unos segundos.",
      cost: { bio: 2, scrap: 2, credits: 38 }, trof: 2,
      dmg: 0.5, r: 2.8, trig: 1.7, arm: 0.8, fuse: 0.3, kb: 2, remote: true,
      zoneR: 3.0, zoneT: 5, zoneDps: 0.1,
    },
    cryo: {
      n: "Mina criogénica", s: "HIELO", cat: "mine", kind: "mine", shape: "crystal", col: 0x7fd8ff, tier: 2,
      d: "Congela a quien alcanza y deja una escarcha que ralentiza. Los jefes solo se ralentizan.",
      cost: { battery: 1, scrap: 2, bio: 1, credits: 40 }, trof: 2,
      dmg: 0.7, r: 3.8, trig: 1.7, arm: 0.8, fuse: 0.3, kb: 0, remote: true,
      freeze: 1.6, zoneR: 3.8, zoneT: 4, slowMul: 0.45,
    },
    emp: {
      n: "Mina EMP", s: "EMP", cat: "mine", kind: "mine", shape: "coil", col: 0x8f86ff, tier: 3,
      d: "Pulso electromagnético: aturde a los mecánicos (drones incluidos) y les hace mucho más daño. Ellos no la detectan.",
      cost: { battery: 1, scrap: 3, credits: 45 }, trof: 3,
      dmg: 0.3, r: 4.6, trig: 1.7, arm: 0.8, fuse: 0.3, kb: 0, remote: true,
      stun: 3.5, mechMul: 2.6, slowOther: 1.5, slowMul: 0.5, hidden: true,
    },
    net: {
      n: "Trampa de red", s: "RED", cat: "trap", kind: "trap", shape: "plate", col: 0x9be37a, tier: 1,
      d: "Una red que ralentiza un 70 % a los enemigos de la zona durante unos segundos.",
      cost: { bio: 2, scrap: 1, credits: 24 }, trof: 2,
      dmg: 0.25, r: 3.4, trig: 1.6, arm: 0.8, fuse: 0.1, uses: 1, cd: 0, zoneT: 3.2, slowMul: 0.3,
    },
    blades: {
      n: "Trampa de cuchillas", s: "CUCH.", cat: "trap", kind: "trap", shape: "plate", col: 0xd5dde6, tier: 2, scale: 0.95,
      d: "Cuchillas giratorias que causan sangrado a quien pase. Aguanta dos activaciones.",
      cost: { scrap: 3, credits: 34 }, trof: 3,
      dmg: 0.3, r: 2.3, trig: 1.5, arm: 0.8, fuse: 0.1, uses: 2, cd: 3, zoneT: 4.5, zoneDps: 0.22, bleed: 0.15,
    },
    shock: {
      n: "Trampa de descarga", s: "RAYO", cat: "trap", kind: "trap", shape: "plate", col: 0xa8c8ff, tier: 3,
      d: "Un rayo que salta de enemigo en enemigo. Aguanta dos activaciones.",
      cost: { battery: 1, scrap: 3, credits: 42 }, trof: 3,
      dmg: 0.8, r: 6.5, trig: 1.5, arm: 0.8, fuse: 0.1, uses: 2, cd: 1.6, jumps: 5, falloff: 0.85,
    },
    gravity: {
      n: "Campo gravitatorio", s: "GRAV.", cat: "mine", kind: "field", shape: "coil", col: 0xb06bff, tier: 3, scale: 1.3,
      d: "Atrae y retiene a los enemigos en su centro y colapsa al terminar. Detonable a distancia.",
      cost: { battery: 1, scrap: 3, credits: 55 }, trof: 3,
      dmg: 0.45, r: 3.5, trig: 4.5, arm: 0.6, fuse: 0.1, remote: true, fieldR: 6, fieldT: 5.5, pull: 14, fieldDps: 0.035, slowMul: 0.35,
    },
    sentinel: {
      n: "Torreta centinela", s: "TORRETA", cat: "device", kind: "turret", shape: "tower", col: 0x40e0ff, tier: 3,
      d: "Dispara al enemigo más cercano durante 25 s.",
      cost: { battery: 1, scrap: 4, credits: 60 }, trof: 4,
      dmg: 0.11, range: 11, rate: 4, arm: 0.8, life: 25,
    },
    decoy: {
      n: "Baliza señuelo", s: "SEÑUELO", cat: "device", kind: "decoy", shape: "pylon", col: 0xffd447, tier: 2,
      d: "Provoca a los enemigos cercanos: la atacan a ella en vez de a ti durante 12 s.",
      cost: { bio: 2, battery: 1, credits: 30 }, trof: 3,
      range: 12, hpMul: 1.5, arm: 0.5, life: 12,
    },
    barrier: {
      n: "Barrera de energía", s: "BARRERA", cat: "device", kind: "barrier", shape: "post", col: 0x4fc3ff, tier: 2,
      d: "Un muro de energía de 5 m que detiene los proyectiles enemigos y empuja a los que se acercan. Dura 8 s.",
      cost: { battery: 1, scrap: 3, credits: 40 }, trof: 3,
      width: 5.2, dist: 2.6, arm: 0.4, life: 8,
    },
  },
};

var GD_CFG = x.cfg.gadgets;
var GD_ORDER = Object.keys(GD_CFG.types);
GD_ORDER.forEach((id) => (GD_CFG.types[id].id = id));

// Iconos (viewBox 24, relleno currentColor): para el botón táctil, el HUD de escritorio y el Taller.
var GD_ICONS = {
  proximity: '<circle cx="12" cy="14" r="6.5"/><path d="M12 3.5v3M5.5 7.5l2 2M18.5 7.5l-2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="12" cy="14" r="2.2" fill="#000" fill-opacity=".45"/>',
  cluster: '<circle cx="7.5" cy="16" r="4"/><circle cx="16.5" cy="16" r="4"/><circle cx="12" cy="8" r="3.8"/>',
  incendiary: '<path d="M12 2.5c.8 4.2 5.5 6.2 5.5 11.5a5.5 5.5 0 0 1-11 0c0-2.2 1-3.6 2.4-4.8.1 2 .9 3.2 2 3.6C10.2 8.4 10.6 5.6 12 2.5z"/>',
  cryo: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5L4.2 16.5M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  emp: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13.2 4.5L7.5 13h4l-1 6.5L16.5 11h-4z"/>',
  net: '<path d="M4 4h16v16H4zM4 12h16M12 4v16M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  blades: '<circle cx="12" cy="12" r="3"/><path d="M12 2l2.2 5.5h-4.4zM12 22l-2.2-5.5h4.4zM2 12l5.5-2.2v4.4zM22 12l-5.5 2.2V9.8zM4.9 4.9l5.6 2-2.2 2.2zM19.1 19.1l-5.6-2 2.2-2.2zM19.1 4.9l-2 5.6-2.2-2.2zM4.9 19.1l2-5.6 2.2 2.2z"/>',
  shock: '<path d="M2.5 12.5h4l2.5-6 3.5 11 2.5-5.5h6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  gravity: '<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 3"/><path d="M12 2.5v4.5M12 21.5V17M2.5 12H7M21.5 12H17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  sentinel: '<rect x="6.5" y="14" width="11" height="6.5" rx="1.2"/><rect x="9" y="8.5" width="6.5" height="5.5" rx="1.2"/><rect x="14.5" y="9.8" width="8" height="2.2" rx=".6"/>',
  decoy: '<path d="M12 4.5l5 15.5H7z"/><circle cx="12" cy="3.6" r="1.6"/><path d="M5.5 8.5a8 8 0 0 0 0 6.5M18.5 8.5a8 8 0 0 1 0 6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  barrier: '<rect x="2.5" y="5.5" width="3" height="13" rx="1"/><rect x="18.5" y="5.5" width="3" height="13" rx="1"/><path d="M6.5 8h11M6.5 12h11M6.5 16h11" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2.6 1.6" fill="none"/>',
};
function gdIcon(id, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${GD_ICONS[id] || ""}</svg>`;
}

// ═══ 2. ESTADO Y GUARDADO ═══════════════════════════════════════════════════════════════════════════
var GD = {
  list: [], // gadgets desplegados
  zones: [], // zonas temporales (fuego, red, hielo, cuchillas, campo)
  blasts: [], // explosiones diferidas (submuniciones del racimo)
  bars: [], // barreras activas (subconjunto de list, para el bucle de proyectiles)
  decoy: null, // señuelo activo (su objeto siege compartido)
  uid: 1,
  seed: 0x9e3779b9,
  S: null,
  map: null,
  key: "",
  gfx: null,
  ui: null,
  placeCd: 0,
  hold: { down: false, t0: 0, ticks: 0, fired: false, swiped: false, src: "" },
  uiT: 0,
  planT: 0,
  tipT: 0,
  ext: false, // alguien externo (ECONOMÍA) llama a gadgetPlanDrop: entonces no soltamos planos por nuestra cuenta
  stats: { placed: 0, triggered: 0, kills: 0, blocked: 0, provoked: 0 },
};
var gdTmpA = [],
  gdTmpB = [],
  gdTmpC = [],
  gdHitSet = new Set(),
  gdHotC = [0, 0, 0];

// Generador propio (xorshift32): los gadgets no tocan el RNG del juego ni el del mundo.
function gdRand() {
  let s = GD.seed;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  GD.seed = s >>> 0;
  return GD.seed / 4294967296;
}
function gdFx(name) {
  const f = x.S && x.S.talentFx;
  const v = f && f[name];
  return typeof v === "number" && isFinite(v) ? v : 0;
}
function gdState() {
  const S = x.S;
  if (!S) return null;
  if (!S.gadgets || typeof S.gadgets !== "object") gdMigrate(S);
  return S.gadgets;
}
function gdMigrate(S) {
  const c = GD_CFG;
  let G = S.gadgets;
  if (!G || typeof G !== "object") {
    G = S.gadgets = { inv: {}, sel: c.start.sel, known: {} };
    for (const id of c.start.known) G.known[id] = 1;
    for (const id in c.start.inv) G.inv[id] = c.start.inv[id];
  }
  if (!G.inv || typeof G.inv !== "object") G.inv = {};
  if (!G.known || typeof G.known !== "object") G.known = {};
  // limpia tipos desconocidos y recorta cargas (idempotente)
  for (const id of Object.keys(G.inv)) {
    if (!c.types[id]) delete G.inv[id];
    else G.inv[id] = Math.max(0, Math.min(c.maxCharges, G.inv[id] | 0));
  }
  for (const id of Object.keys(G.known)) if (!c.types[id]) delete G.known[id];
  for (const id of Object.keys(G.inv)) if (G.inv[id] > 0) G.known[id] = 1; // quien tiene cargas ya conoce el plano
  if (!G.sel || !c.types[G.sel] || !G.known[G.sel]) G.sel = Object.keys(G.known)[0] || c.start.sel;
  S.gadgetsV = 1;
}
x.migrations.push(gdMigrate);

function gdMaxSlots() {
  return Math.min(GD_CFG.maxSlots, GD_CFG.baseSlots + Math.max(0, gdFx("gadgetSlots") | 0));
}
function gdCharges(id) {
  const G = gdState();
  return G ? G.inv[id] | 0 : 0;
}
function gdKnown(id) {
  const G = gdState();
  return !!(G && G.known[id]);
}
// Daño de referencia G (ver arriba). Sin arma equipada, el mismo valor que usa la granada.
function gdG() {
  const p = x.player,
    w = p && p.ws && p.ws[x.S.activeW];
  const base = w ? (w.base.dmg * (1 + (w.dmg || 0))) / Math.max(0.6, Math.sqrt(w.base.rate)) : 20;
  return base * 9 * (p && p.dyn ? p.dyn().dmg : 1);
}
function gdDmg(mult) {
  return mult * gdG() * (1 + gdFx("gadgetDmg"));
}
function gdRad(r) {
  return r * (1 + gdFx("gadgetRadius"));
}

// ═══ 3. GRÁFICOS ════════════════════════════════════════════════════════════════════════════════════
// Una malla instanciada por familia de forma (geometría fusionada con color por vértice: oscuro = chasis,
// 1 = zona que toma el color del tipo). El LED parpadeante se pinta con los orbes del FX (sin luces).
var gdM = new at(),
  gdQ = new Bn(),
  gdP = new U(),
  gdS = new U(),
  gdC = new Ee(),
  gdAxisY = new U(0, 1, 0);

function gdPart(geo, y, v, ax = 0, ay = 0, az = 0) {
  if (ax) geo.rotateX(ax);
  if (ay) geo.rotateY(ay);
  if (az) geo.rotateZ(az);
  geo.translate(0, y, 0);
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = v;
    col[i * 3 + 1] = v;
    col[i * 3 + 2] = v;
  }
  g.setAttribute("color", new St(col, 3));
  g.deleteAttribute("uv");
  return g;
}
function gdShift(geo, px, pz) {
  geo.translate(px, 0, pz);
  return geo;
}
function gdBuildGeometries() {
  const D = 0.22,
    M = 0.42,
    A = 1;
  const tw = Math.PI * 2;
  const geos = {};
  geos.mine = Ld([
    gdPart(new ni(0.48, 0.52, 0.12, 14), 0.06, D),
    gdPart(new rr(0.34, 12, 6, 0, tw, 0, Math.PI / 2), 0.12, M),
    gdPart(new Yi(0.37, 0.035, 6, 18), 0.15, A, Math.PI / 2),
    gdPart(new ni(0.07, 0.09, 0.14, 8), 0.47, A),
    ...[0, 1, 2].map((k) => gdShift(gdPart(new oo(0.09, 0.2, 5), 0.1, D), Math.cos((k * tw) / 3) * 0.44, Math.sin((k * tw) / 3) * 0.44)),
  ]);
  geos.plate = Ld([
    gdPart(new kn(1.15, 0.07, 1.15), 0.035, D),
    gdPart(new ni(0.32, 0.36, 0.07, 14), 0.1, A),
    gdPart(new ni(0.14, 0.14, 0.08, 10), 0.16, D),
    ...[
      [-0.48, -0.48],
      [0.48, -0.48],
      [-0.48, 0.48],
      [0.48, 0.48],
    ].map(([px, pz]) => gdShift(gdPart(new oo(0.1, 0.34, 5), 0.24, M), px, pz)),
  ]);
  geos.coil = Ld([
    gdPart(new ni(0.45, 0.5, 0.14, 12), 0.07, D),
    gdPart(new ni(0.12, 0.16, 0.5, 8), 0.39, M),
    gdPart(new Yi(0.3, 0.04, 6, 16), 0.26, A, Math.PI / 2),
    gdPart(new Yi(0.22, 0.04, 6, 16), 0.46, A, Math.PI / 2),
    gdPart(new rr(0.13, 10, 6), 0.7, A),
  ]);
  geos.crystal = Ld([
    gdPart(new ni(0.46, 0.5, 0.12, 10), 0.06, D),
    gdShift(gdPart(new _a(0.3), 0.58, A), 0, 0),
    gdShift(gdPart(new _a(0.15), 0.28, M), 0.3, 0.12),
    gdShift(gdPart(new _a(0.13), 0.24, M), -0.28, -0.14),
  ]);
  geos.tower = Ld([
    gdPart(new ni(0.42, 0.48, 0.14, 12), 0.07, D),
    gdPart(new ni(0.15, 0.2, 0.7, 8), 0.49, M),
    gdPart(new kn(0.52, 0.3, 0.52), 1.0, D),
    gdShift(gdPart(new kn(0.12, 0.12, 0.62), 1.02, A), 0, 0.46),
    gdPart(new rr(0.1, 8, 6), 1.22, A),
  ]);
  geos.pylon = Ld([
    gdPart(new ni(0.38, 0.44, 0.1, 10), 0.05, D),
    gdPart(new oo(0.3, 1.2, 8), 0.7, M),
    gdPart(new Yi(0.2, 0.035, 6, 14), 0.5, A, Math.PI / 2),
    gdPart(new rr(0.14, 10, 8), 1.38, A),
  ]);
  geos.post = Ld([
    gdPart(new ni(0.2, 0.26, 0.16, 8), 0.08, D),
    gdPart(new ni(0.08, 0.1, 1.5, 8), 0.82, M),
    gdPart(new Yi(0.13, 0.03, 6, 12), 1.2, A, Math.PI / 2),
    gdPart(new rr(0.12, 10, 8), 1.6, A),
  ]);
  return geos;
}
function gdInitGfx() {
  if (GD.gfx || !x.R || !x.fx) return;
  try {
    const mat = new Xt({ color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0.55, flatShading: true });
    const geos = gdBuildGeometries();
    const gfx = {};
    for (const k in geos) {
      gfx[k] = new cs(x.R.scene, geos[k], mat, 160);
      gfx[k].mesh.visible = false;
      gfx[k].mesh.name = "gadget-" + k;
    }
    GD.gfx = gfx;
  } catch (err) {
    console.warn("gadgets: sin malla instanciada", err);
    GD.gfx = {};
  }
}
function gdDrawBodies(t) {
  const gfx = GD.gfx;
  if (!gfx) return;
  for (const k in gfx) gfx[k].begin();
  const cam = x.R.camera;
  for (const g of GD.list) {
    const d = g.def,
      b = gfx[d.shape];
    if (!b) continue;
    const sc = (d.scale || 1) * 1.15 * (g.st === "arm" ? 0.7 + 0.3 * Math.min(1, g.age / 0.35) : 1) * (g.pop > 0 ? 1 + g.pop : 1);
    gdQ.setFromAxisAngle(gdAxisY, g.yaw);
    gdP.set(g.x, d.kind === "turret" ? Math.sin(t * 2 + g.ph) * 0.02 : 0, g.z);
    gdS.set(sc, sc, sc);
    // brillo del color según el estado: apagado mientras se arma, vivo cuando está listo
    const k = g.st === "arm" ? 0.45 : g.st === "fuse" ? 1.25 : 0.9;
    gdC.setHex(d.col).multiplyScalar(k);
    if (d.kind === "barrier") {
      // dos postes en los extremos del muro
      for (let s = -1; s <= 1; s += 2) {
        gdP.set(g.x + g.dx * g.hw * s, 0, g.z + g.dz * g.hw * s);
        gdM.compose(gdP, gdQ, gdS);
        b.push(gdM, gdC);
      }
    } else {
      gdM.compose(gdP, gdQ, gdS);
      b.push(gdM, gdC);
    }
  }
  for (const k in gfx) {
    gfx[k].end();
    gfx[k].mesh.visible = gfx[k].n > 0;
  }
}
// LED y brillos: orbes del FX (una sola llamada de dibujo compartida con el resto del juego)
function gdDrawLeds(t) {
  const fx = x.fx,
    low = x.R.quality === "low";
  for (const g of GD.list) {
    const d = g.def;
    let on;
    if (g.st === "arm") on = Math.floor((t + g.ph) * 9) % 2 === 0;
    else if (g.st === "fuse") on = Math.floor((t + g.ph) * 22) % 2 === 0;
    else if (d.kind === "turret" || d.kind === "decoy" || d.kind === "barrier") on = true;
    else {
      // doble destello cada 1,2 s
      const ph = (t + g.ph) % 1.2;
      on = ph < 0.1 || (ph > 0.22 && ph < 0.3);
    }
    const top = d.kind === "turret" ? 1.25 : d.kind === "decoy" ? 1.4 : d.kind === "barrier" ? 1.6 : d.shape === "crystal" ? 0.9 : d.shape === "coil" ? 0.75 : 0.5;
    if (d.kind === "barrier") {
      for (let s = -1; s <= 1; s += 2) fx.drawOrb(g.x + g.dx * g.hw * s, top, g.z + g.dz * g.hw * s, 0.07, d.col);
    } else if (on) fx.drawOrb(g.x, top, g.z, d.kind === "turret" ? 0.06 : 0.075, d.col);
    if (!low && (g.st === "ready" || g.st === "on") && d.kind !== "barrier") fx.drawGlow(g.x, 0.1, g.z, d.kind === "turret" ? 1.3 : 0.9, d.col);
  }
}
function gdDrawBarriers(t) {
  const fx = x.fx;
  for (const g of GD.bars) {
    if (g.st === "arm") continue;
    const fade = Math.min(1, g.life / 1.2, g.age / 0.3);
    const c = CkHot(g.def.col, 1.5, gdHotC);
    for (let row = 0; row < 3; row++) {
      const y = 0.35 + row * 0.55 + Math.sin(t * 5 + row * 2 + g.ph) * 0.03;
      fx.streaks.push(g.x, y, g.z, g.dx, 0, g.dz, g.hw * 2, 0.34, c[0] * fade, c[1] * fade, c[2] * fade, 0.8 * fade);
    }
  }
}

// ═══ 4. SIMULACIÓN ══════════════════════════════════════════════════════════════════════════════════
function gdLifeOf(d) {
  return (d.life ?? GD_CFG.mineLife) * (1 + gdFx("gadgetLife"));
}
function gdMake(id, px, pz, yaw) {
  const d = GD_CFG.types[id];
  const g = {
    uid: GD.uid++,
    id,
    def: d,
    x: px,
    z: pz,
    yaw: yaw || 0,
    st: "arm", // arm → ready (minas y trampas) | on (dispositivos) → fuse → (explota / efecto)
    arm: d.arm,
    age: 0,
    life: gdLifeOf(d),
    scan: gdRand() * 0.1,
    ph: gdRand() * 6,
    pop: 0.35, // pequeño rebote al colocarla
    uses: d.uses || 1,
    cd: 0,
    fuse: 0,
    dis: 0, // progreso de desarme
    disT: -9,
    trigR: gdRad(d.trig || 0),
    region: x.regionId,
    dx: 0,
    dz: 0,
    hw: 0,
    shot: 0.2,
  };
  if (d.kind === "barrier") {
    // el muro es perpendicular a la dirección de despliegue
    g.dx = Math.cos(g.yaw);
    g.dz = -Math.sin(g.yaw);
    g.hw = gdRad(d.width) / 2;
  }
  if (d.kind === "decoy") {
    g.tgt = { x: px, z: pz, hp: x.player.maxHp * d.hpMul, hp0: x.player.maxHp * d.hpMul, r: 0.7, hitT: 0, deco: true };
    g.siege = { targets: [g.tgt], deco: true };
  }
  return g;
}
function gdAdd(g) {
  GD.list.push(g);
  if (g.def.kind === "barrier") GD.bars.push(g);
  GD.stats.placed++;
  ee("gadgetPlaced", g);
}
function gdRemove(g, why) {
  const i = GD.list.indexOf(g);
  if (i >= 0) GD.list.splice(i, 1);
  const j = GD.bars.indexOf(g);
  if (j >= 0) GD.bars.splice(j, 1);
  g.st = "dead";
  if (g.siege) {
    for (const e of x.enemies) if (e.siege === g.siege) e.siege = null;
    if (GD.decoy === g.siege) {
      const o = GD.list.find((q) => q.siege && q.st === "on");
      GD.decoy = o ? o.siege : null;
    }
  }
  if (why === "fade" && x.fx) x.fx.burst(g.x, 0.4, g.z, 6, { color: g.def.col, speed: 1.5, life: 0.4, size: 0.18 });
}
function gdClearAll() {
  while (GD.list.length) gdRemove(GD.list[GD.list.length - 1], "");
  GD.zones.length = 0;
  GD.blasts.length = 0;
  GD.bars.length = 0;
  for (const e of x.enemies) {
    if (e.siege && e.siege.deco) e.siege = null;
    if (e.gx) {
      e.gStun = 0;
      e.gSlowT = 0;
      e.slowMul = undefined;
      e.gBleedT = 0;
      e.gx = false;
    }
  }
}

function gdSay(msg, kind) {
  ee("toast", msg, kind || "");
}
// Despliega el gadget (por defecto el seleccionado). Devuelve el gadget creado o null.
function gadgetDeploy(id, opts) {
  opts = opts || {};
  const G = gdState();
  if (!G || !x.started || !x.player || x.player.dead) return null;
  id = id || G.sel;
  const d = GD_CFG.types[id];
  if (!d) return null;
  if (!opts.force) {
    if (x.uiOpen) return null;
    if (GD.placeCd > 0) return null;
    if (x.inSafe || (x.world && x.world.inBase && x.world.inBase())) {
      ae.play("err");
      gdSay("No puedes desplegar gadgets en la zona segura.", "warn");
      return null;
    }
    if ((G.inv[id] | 0) <= 0) {
      ae.play("err");
      gdSay(`Sin cargas de ${d.n}. Fabrícalas en el Taller (pestaña Gadgets).`, "warn");
      return null;
    }
    if (GD.list.length >= gdMaxSlots()) {
      ae.play("err");
      gdSay(`Límite de gadgets desplegados (${gdMaxSlots()}). Espera a que caduquen o detónalos.`, "warn");
      return null;
    }
  }
  const p = x.player;
  const dist = d.kind === "barrier" ? d.dist : GD_CFG.placeDist;
  let px = opts.x ?? p.x + Math.sin(p.face) * dist,
    pz = opts.z ?? p.z + Math.cos(p.face) * dist;
  if (opts.x === undefined && x.map.circleHits(px, pz, 0.4)) {
    const f = x.map.findFree(px, pz, 3, 0.4);
    px = f[0];
    pz = f[1];
  }
  const g = gdMake(id, px, pz, opts.yaw ?? p.face);
  gdAdd(g);
  if (!opts.force) {
    if (gdRand() >= gdFx("gadgetSave")) G.inv[id] = Math.max(0, (G.inv[id] | 0) - 1);
    GD.placeCd = GD_CFG.placeCd;
    ee("cons");
  }
  ae.play("metal", { gap: 0.05, v: 0.5 });
  x.fx.burst(px, 0.15, pz, 6, { color: d.col, speed: 1.6, life: 0.3, size: 0.14, up: 0.6 });
  return g;
}
// Cambia el gadget seleccionado: dir = +1 siguiente, -1 anterior. Solo los conocidos y con cargas (o el actual).
function gadgetNext(dir) {
  const G = gdState();
  if (!G) return;
  const ids = GD_ORDER.filter((id) => G.known[id] && ((G.inv[id] | 0) > 0 || id === G.sel));
  if (ids.length < 2) {
    ae.play("err");
    if (ids.length <= 1) gdSay("No tienes otro gadget con cargas.", "");
    return;
  }
  let i = ids.indexOf(G.sel);
  i = (i + (dir || 1) + ids.length) % ids.length;
  G.sel = ids[i];
  ae.play("ui");
  const d = GD_CFG.types[G.sel];
  gdSay(`${d.n} · ${G.inv[G.sel] | 0} ${(G.inv[G.sel] | 0) === 1 ? "carga" : "cargas"}`, "");
  gdRefreshUi(true);
}
// Detona a distancia las minas armadas (en cadena, con una pausa corta entre cada una).
function gadgetDetonateAll() {
  let n = 0;
  for (const g of GD.list) {
    if (!g.def.remote || (g.st !== "ready" && g.st !== "on")) continue;
    if (g.def.kind === "field" && g.st === "on") continue;
    g.st = "fuse";
    g.fuse = 0.05 + n * GD_CFG.detonateGap;
    g.remote = true;
    n++;
  }
  if (n) {
    ae.play("beep", { p: 2.4 });
    return n;
  }
  ae.play("err");
  gdSay("No hay minas armadas que detonar.", "");
  return 0;
}

// Daño y estados en área. o: {col, kb, burn, shock, elem, freeze, slow, slowMul, stun, mechMul, fx}
function gdStatusSlow(e, secs, mul) {
  e.st.slow = Math.max(e.st.slow || 0, secs);
  e.slowMul = e.boss ? Math.max(mul, 0.6) : mul;
  e.gSlowT = Math.max(e.gSlowT || 0, secs);
  e.gx = true;
}
function gdStatusStun(e, secs) {
  if (e.boss) return;
  e.gStun = Math.max(e.gStun || 0, secs);
  e.gx = true;
}
function gdHit(e, dmg, o, px, pz) {
  if (e.dead) return;
  const mech = e.fam === "mech";
  hs(e, dmg * (mech && o.mechMul ? o.mechMul : 1), { burn: o.burn, shock: o.shock, elem: o.elem });
  if (e.dead) return;
  if (o.freeze && !e.boss) {
    e.st.frozen = Math.max(e.st.frozen || 0, o.freeze);
    e.st.slow = Math.max(e.st.slow || 0, o.freeze + 0.5);
  }
  if (o.slow) gdStatusSlow(e, o.slow, o.slowMul || 0.5);
  if (o.stun && mech) gdStatusStun(e, o.stun);
  if (o.kb && px !== undefined) {
    const a = Math.atan2(e.x - px, e.z - pz);
    e.kbx += (Math.sin(a) * o.kb) / Math.max(1, e.mass);
    e.kbz += (Math.cos(a) * o.kb) / Math.max(1, e.mass);
  }
}
function gdBlast(px, pz, r, dmg, o) {
  const fx = x.fx;
  if (o.fx !== "none") {
    fx.explosion(px, pz, o.small ? r * 0.6 : r, o.col);
    ae.play("boom", { gap: 0.06, v: o.small ? 0.4 : 1 });
    if (!o.small && x.R.addShake) x.R.addShake(0.12);
  }
  const list = rn(px, pz, r, gdTmpB);
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const dd = Le(e.x, e.z, px, pz);
    gdHit(e, dmg * (1 - 0.45 * qe(dd / r, 0, 1)), o, px, pz);
    n++;
  }
  return n;
}
function gdZone(k, px, pz, r, t, o) {
  GD.zones.push(Object.assign({ k, x: px, z: pz, r, t, max: t, tick: 0, col: 0xffffff }, o));
}
function gdTriggered(g, n) {
  GD.stats.triggered++;
  ee("gadgetTriggered", g, n);
}

// Efectos al activarse, por tipo
var GD_FX = {
  proximity(g, d) {
    const r = gdRad(d.r);
    const n = gdBlast(g.x, g.z, r, gdDmg(d.dmg), { col: d.col, kb: d.kb });
    gdTriggered(g, n);
  },
  cluster(g, d) {
    const r = gdRad(d.r);
    const n = gdBlast(g.x, g.z, r, gdDmg(d.dmg), { col: d.col, kb: d.kb });
    for (let i = 0; i < d.bomblets; i++) {
      const a = gdRand() * 6.283,
        rr2 = (0.35 + gdRand() * 0.65) * gdRad(d.spread);
      let bx = g.x + Math.cos(a) * rr2,
        bz = g.z + Math.sin(a) * rr2;
      if (x.map.circleHits(bx, bz, 0.2)) {
        bx = g.x;
        bz = g.z;
      }
      const t = d.bDelay[0] + gdRand() * (d.bDelay[1] - d.bDelay[0]);
      GD.blasts.push({ t, x: bx, z: bz, r: gdRad(d.bR), dmg: gdDmg(d.bDmg), col: d.col, kb: 2.5 });
      x.fx.burst(g.x, 0.5, g.z, 1, { color: d.col, speed: 3, life: 0.3, size: 0.16 });
    }
    gdTriggered(g, n);
  },
  incendiary(g, d) {
    const r = gdRad(d.r);
    const n = gdBlast(g.x, g.z, r, gdDmg(d.dmg), { col: d.col, kb: d.kb, burn: true, elem: "fire" });
    gdZone("fire", g.x, g.z, gdRad(d.zoneR), d.zoneT, { dps: gdDmg(d.zoneDps), col: d.col });
    gdTriggered(g, n);
  },
  cryo(g, d) {
    const r = gdRad(d.r);
    const n = gdBlast(g.x, g.z, r, gdDmg(d.dmg), { col: d.col, elem: "ice", freeze: d.freeze, slow: d.zoneT, slowMul: d.slowMul });
    x.fx.ring(g.x, g.z, r, d.col, 0.5);
    gdZone("frost", g.x, g.z, gdRad(d.zoneR), d.zoneT, { slowMul: d.slowMul, col: d.col });
    gdTriggered(g, n);
  },
  emp(g, d) {
    const r = gdRad(d.r);
    const n = gdBlast(g.x, g.z, r, gdDmg(d.dmg), {
      col: d.col, elem: "shock", shock: true, stun: d.stun, mechMul: d.mechMul, slow: d.slowOther, slowMul: d.slowMul,
    });
    x.fx.ring(g.x, g.z, r, d.col, 0.5);
    ae.play("zap", { gap: 0.05 });
    gdTriggered(g, n);
  },
  net(g, d) {
    const r = gdRad(d.r);
    const n = gdBlast(g.x, g.z, r, gdDmg(d.dmg), { col: d.col, fx: "none", slow: d.zoneT, slowMul: d.slowMul });
    x.fx.ring(g.x, g.z, r, d.col, 0.45);
    x.fx.burst(g.x, 0.6, g.z, 12, { color: d.col, speed: 5, life: 0.5, size: 0.16, up: 0.3 });
    ae.play("bow", { gap: 0.1 });
    gdZone("net", g.x, g.z, r, d.zoneT, { slowMul: d.slowMul, col: d.col });
    gdTriggered(g, n);
  },
  blades(g, d) {
    const r = gdRad(d.r);
    ae.play("metal", { gap: 0.05 });
    x.fx.ring(g.x, g.z, r, d.col, 0.4);
    gdZone("blades", g.x, g.z, r, d.zoneT, { dps: gdDmg(d.zoneDps), bleed: gdDmg(d.bleed), col: d.col });
    gdTriggered(g, 0);
  },
  shock(g, d, first) {
    // rayo en cadena a partir del enemigo que la pisó
    let cur = first;
    if (!cur) {
      const l = rn(g.x, g.z, g.trigR + 1, gdTmpC);
      cur = l[0];
    }
    if (!cur) return gdTriggered(g, 0);
    const range = gdRad(d.r),
      jumps = d.jumps + Math.max(0, gdFx("gadgetChain") | 0);
    let dmg = gdDmg(d.dmg),
      ax = g.x,
      az = g.z,
      n = 0;
    gdHitSet.clear();
    for (let j = 0; j < jumps && cur; j++) {
      x.fx.zap(ax, az, cur.x, cur.z, d.col, 0.9);
      gdHit(cur, dmg, { shock: true, elem: "shock" });
      gdHitSet.add(cur);
      n++;
      ax = cur.x;
      az = cur.z;
      dmg *= d.falloff;
      let best = null,
        bd = range;
      const l = rn(ax, az, range, gdTmpC);
      for (let i = 0; i < l.length; i++) {
        const e = l[i];
        if (gdHitSet.has(e) || !e.targetable()) continue;
        const dd = Le(e.x, e.z, ax, az);
        if (dd < bd) {
          bd = dd;
          best = e;
        }
      }
      cur = best;
    }
    ae.play("zap", { gap: 0.05 });
    gdTriggered(g, n);
  },
  gravity(g, d) {
    // empieza el campo: durante fieldT atrae y retiene; al terminar colapsa (ver gdUpdateZone)
    g.st = "on";
    g.life = Math.min(g.life, d.fieldT + 0.5);
    gdZone("grav", g.x, g.z, gdRad(d.fieldR), d.fieldT, { pull: d.pull, dps: gdDmg(d.fieldDps), slowMul: d.slowMul, col: d.col, g, implode: gdDmg(d.dmg), ir: gdRad(d.r) });
    ae.play("void", { gap: 0.1 });
    x.fx.ring(g.x, g.z, gdRad(d.fieldR), d.col, 0.5);
    gdTriggered(g, 0);
  },
};

// Detonación / activación al cumplirse la mecha
function gdActivate(g, first) {
  const d = g.def;
  GD_FX[g.id](g, d, first);
  if (d.kind === "mine") return gdRemove(g, "");
  if (d.kind === "field") return; // sigue activo mientras dura el campo
  // trampa: gasta un uso y entra en enfriamiento
  g.uses--;
  if (g.uses <= 0) return gdRemove(g, "");
  g.st = "ready";
  g.cd = d.cd;
  g.pop = 0.2;
}
function gdScan(g, dt) {
  g.scan -= dt;
  if (g.scan > 0) return null;
  g.scan = 0.08;
  const list = rn(g.x, g.z, g.trigR, gdTmpA);
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.static || e.fly || e.burrowed) continue;
    if (e._gTgt === g && e._gMode === "disarm" && e._gOk) continue; // el mecánico que viene a desarmarla no la dispara
    return e;
  }
  return null;
}
function gdUpdateGadget(g, dt, t) {
  const d = g.def;
  g.age += dt;
  g.life -= dt;
  if (g.pop > 0) g.pop = Math.max(0, g.pop - dt * 2.2);
  if (g.life <= 0) {
    gdRemove(g, "fade");
    return;
  }
  if (g.region !== x.regionId) {
    // salir de la región las retira (persisten «hasta salir de la región»)
    gdRemove(g, "fade");
    return;
  }
  if (g.st === "arm") {
    g.arm -= dt;
    if (g.arm <= 0) {
      g.st = d.kind === "mine" || d.kind === "trap" || d.kind === "field" ? "ready" : "on";
      if (d.kind === "decoy") GD.decoy = g.siege;
      ae.play("beep", { v: 0.5, p: 1.6, gap: 0.05 });
    }
    return;
  }
  if (g.st === "fuse") {
    g.fuse -= dt;
    if (g.fuse <= 0) gdActivate(g, g.first && !g.first.dead ? g.first : null);
    return;
  }
  if (g.st === "ready") {
    if (g.cd > 0) {
      g.cd -= dt;
      return;
    }
    // desarme en curso: se enfría si nadie sigue trabajando
    if (g.dis > 0 && t - g.disT > 0.25) g.dis = Math.max(0, g.dis - dt * 0.6);
    if (g.dis >= GD_CFG.detect.disarmSec) return gdDisarmed(g);
    const e = gdScan(g, dt);
    if (e) {
      g.st = "fuse";
      g.fuse = d.fuse;
      g.first = e;
      g.remote = false;
      x.fx.telegraph(g.x, g.z, 1.6, d.fuse + 0.05, d.col);
      ae.play("beep", { p: 2.2, gap: 0.05 });
    }
    return;
  }
  // dispositivos activos
  if (d.kind === "turret") return gdUpdateTurret(g, dt);
  if (d.kind === "decoy") {
    g.tgt.hitT = Math.max(0, g.tgt.hitT - dt);
    if (g.tgt.hp <= 0) {
      x.fx.explosion(g.x, g.z, 1.2, d.col);
      return gdRemove(g, "");
    }
    g.pulse = (g.pulse || 0) - dt;
    if (g.pulse <= 0) {
      g.pulse = 1;
      x.fx.ring(g.x, g.z, 2.5, d.col, 0.8, 2);
    }
    return;
  }
  if (d.kind === "barrier") return;
}
function gdDisarmed(g) {
  const d = GD_CFG.detect;
  if (gdRand() < d.disarmFail) {
    x.fx.text(g.x, 1.4, g.z, "¡Falla!", "#ff7a4a", 14, { life: 0.8 });
    g.st = "fuse";
    g.fuse = 0.05;
    return;
  }
  x.fx.text(g.x, 1.4, g.z, "Desarmada", "#9fb0b8", 13, { life: 1 });
  x.fx.burst(g.x, 0.3, g.z, 10, { color: 0xb8c0c8, speed: 3, life: 0.4, size: 0.12, grav: 8, up: 1 });
  ae.play("metal", { gap: 0.05 });
  gdRemove(g, "");
}
function gdUpdateTurret(g, dt) {
  const d = g.def;
  g.shot -= dt;
  let best = g.tgt2;
  if (best && (best.dead || !best.targetable() || Le(best.x, best.z, g.x, g.z) > gdRad(d.range) + 1)) best = null;
  if (g.shot <= 0) {
    const range = gdRad(d.range);
    let bd = range;
    best = null;
    const l = rn(g.x, g.z, range, gdTmpA);
    for (let i = 0; i < l.length; i++) {
      const e = l[i];
      if (!e.targetable()) continue;
      const dd = Le(e.x, e.z, g.x, g.z);
      if (dd < bd && x.map.los(g.x, g.z, e.x, e.z)) {
        bd = dd;
        best = e;
      }
    }
    g.tgt2 = best;
    if (best) {
      g.shot = 1 / d.rate;
      const a = Math.atan2(best.x - g.x, best.z - g.z);
      g.yaw = a;
      const ox = g.x + Math.sin(a) * 0.55,
        oz = g.z + Math.cos(a) * 0.55,
        sp = 36;
      x.projs.push({
        owner: "p", kind: "bullet", x: ox, y: 1.05, z: oz,
        vx: Math.sin(a) * sp, vz: Math.cos(a) * sp,
        dmg: gdDmg(d.dmg), life: (bd + 1.5) / sp, pierce: 0, rico: 0, hit: new Set(), color: d.col, w: 0.06, len: 1,
      });
      x.fx.muzzle(ox, 1.05, oz, a, d.col, 1);
      ae.play("laser", { gap: 0.06, v: 0.35, p: 1.3 });
    } else g.shot = 0.15;
  }
  if (best) g.yaw += fi(g.yaw, Math.atan2(best.x - g.x, best.z - g.z)) * Math.min(1, dt * 14);
  else g.yaw += dt * 0.8; // rastrea despacio cuando no hay objetivo
}
function gdUpdateBlasts(dt) {
  for (let i = GD.blasts.length - 1; i >= 0; i--) {
    const b = GD.blasts[i];
    b.t -= dt;
    if (b.t > 0) continue;
    gdBlast(b.x, b.z, b.r, b.dmg, { col: b.col, kb: b.kb, small: true });
    GD.blasts[i] = GD.blasts[GD.blasts.length - 1];
    GD.blasts.pop();
  }
}
// Zonas temporales
function gdUpdateZone(z, dt) {
  z.t -= dt;
  z.tick -= dt;
  const fx = x.fx;
  if (z.k === "fire") {
    if (gdRand() < dt * 14) fx.fire(z.x + (gdRand() - 0.5) * z.r * 1.4, 0.15, z.z + (gdRand() - 0.5) * z.r * 1.4, 1, 0.3);
    fx.drawGlow(z.x, 0.12, z.z, z.r * 2.1, 0x7a2c08);
    if (z.tick <= 0) {
      z.tick = 0.4;
      const l = rn(z.x, z.z, z.r, gdTmpB);
      for (let i = 0; i < l.length; i++) {
        const e = l[i];
        e.st.burn = Math.max(e.st.burn || 0, 1.5);
        e.st.burnDps = Math.max(e.st.burnDps || 0, z.dps * 0.4);
        hs(e, z.dps * 0.4, { elem: "fire", burnTick: true });
      }
    }
  } else if (z.k === "frost" || z.k === "net") {
    fx.drawGlow(z.x, 0.1, z.z, z.r * 1.8, z.k === "net" ? 0x2c4a1f : 0x2c5a70);
    if (gdRand() < dt * 6) fx.burst(z.x + (gdRand() - 0.5) * z.r * 1.6, 0.1, z.z + (gdRand() - 0.5) * z.r * 1.6, 1, { color: z.col, speed: 0.4, life: 0.6, size: 0.2, up: 1 });
    if (z.tick <= 0) {
      z.tick = 0.2;
      const l = rn(z.x, z.z, z.r, gdTmpB);
      for (let i = 0; i < l.length; i++) if (!l[i].static) gdStatusSlow(l[i], 0.5, z.slowMul);
    }
  } else if (z.k === "blades") {
    // cuchillas giratorias: destellos que giran por el borde + sangrado
    const a = x.time * 9;
    for (let k = 0; k < 3; k++) {
      const ang = a + k * 2.094;
      fx.drawDisc(z.x + Math.cos(ang) * z.r * 0.55, 0.4, z.z + Math.sin(ang) * z.r * 0.55, 0.45, x.time * 30, 0xd5dde6);
    }
    if (z.tick <= 0) {
      z.tick = 0.3;
      const l = rn(z.x, z.z, z.r, gdTmpB);
      for (let i = 0; i < l.length; i++) {
        const e = l[i];
        if (e.static) continue;
        hs(e, z.dps * 0.3, { elem: "none" });
        if (!e.dead) {
          e.gBleedT = Math.max(e.gBleedT || 0, 2.5);
          e.gBleedDps = Math.max(e.gBleedDps || 0, z.bleed);
          e.gx = true;
        }
      }
      ae.play("metal", { gap: 0.2, v: 0.25, p: 1.6 });
    }
  } else if (z.k === "grav") {
    const g = z.g;
    fx.drawOrb(z.x, 0.8, z.z, 0.32 + Math.sin(x.time * 18) * 0.04, 0x1a0f30);
    fx.drawGlow(z.x, 0.8, z.z, z.r * 1.4, z.col);
    if (gdRand() < dt * 25) {
      const a = gdRand() * 6.283;
      fx.burst(z.x + Math.cos(a) * z.r, 0.6, z.z + Math.sin(a) * z.r, 1, { color: z.col, speed: 0.2, life: 0.5, size: 0.22 });
    }
    if (z.tick <= 0) {
      z.tick = 0.05;
      const l = rn(z.x, z.z, z.r, gdTmpB);
      for (let i = 0; i < l.length; i++) {
        const e = l[i];
        if (e.static) continue;
        const a = Math.atan2(z.x - e.x, z.z - e.z),
          k = z.pull * 0.05 * 3 * (e.boss ? 0.4 : 1);
        e.kbx += Math.sin(a) * k;
        e.kbz += Math.cos(a) * k;
        gdStatusSlow(e, 0.3, z.slowMul);
        z.dmgT = (z.dmgT || 0) + 0.05;
        if (z.dmgT >= 0.5) {
          z.dmgT = 0;
          hs(e, z.dps, { elem: "energy" });
        }
      }
    }
    if (z.t <= 0) {
      gdBlast(z.x, z.z, z.ir, z.implode, { col: z.col, elem: "energy", kb: -6 });
      if (g && g.st !== "dead") gdRemove(g, "");
    }
  }
}

// Mantenimiento por fotograma: región/mundo, caducidades, zonas
function gdSync() {
  const S = x.S;
  if (GD.S !== S || GD.map !== x.map) {
    // partida o mundo nuevos: no heredamos nada (los gadgets desplegados no se guardan)
    GD.S = S;
    GD.map = x.map;
    gdClearAll();
    GD.tipT = 0;
  }
}

function gdTick(dt) {
  if (!x.S || !x.started || !x.player) return;
  gdSync();
  const G = gdState();
  if (!G) return;
  gdInitGfx();
  if (!GD.ui) gdBuildUi();
  GD.placeCd -= dt;
  const t = x.time;
  gdInput(dt);
  // planos recibidos como objeto de inventario → se aprenden solos
  GD.planT -= dt;
  if (GD.planT <= 0) {
    GD.planT = 1;
    gdAbsorbPlans();
  }
  GD.uiT -= dt;
  if (GD.uiT <= 0) {
    GD.uiT = 0.2;
    gdRefreshUi();
  }
  gdTip(dt);
  if (GD.list.length || GD.zones.length || GD.blasts.length) {
    for (let i = GD.list.length - 1; i >= 0; i--) gdUpdateGadget(GD.list[i], dt, t);
    for (let i = GD.zones.length - 1; i >= 0; i--) {
      const z = GD.zones[i];
      gdUpdateZone(z, dt);
      if (z.t <= 0) {
        GD.zones[i] = GD.zones[GD.zones.length - 1];
        GD.zones.pop();
      }
    }
    gdUpdateBlasts(dt);
    if (GD.bars.length) gdBlockProjectiles(dt);
  }
  if (GD.gfx && (GD.list.length || GD.hadBodies)) {
    gdDrawBodies(t);
    GD.hadBodies = GD.list.length > 0;
  }
  if (GD.list.length) {
    gdDrawLeds(t);
    if (GD.bars.length) gdDrawBarriers(t);
  }
}
x.tick.push(gdTick);

// La barrera detiene los proyectiles enemigos que la cruzan (cruce de segmentos: no depende del dt)
function gdBlockProjectiles(dt) {
  const ps = x.projs;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.owner === "p" || p.life <= 0 || p.kind === "lob") continue;
    if (p.vx === undefined) continue;
    const x1 = p.x,
      z1 = p.z,
      x0 = p.x - p.vx * dt,
      z0 = p.z - p.vz * dt;
    for (let j = 0; j < GD.bars.length; j++) {
      const b = GD.bars[j];
      if (b.st === "arm") continue;
      const ax = b.x - b.dx * b.hw,
        az = b.z - b.dz * b.hw,
        ex = b.dx * b.hw * 2,
        ez = b.dz * b.hw * 2;
      const s0 = ex * (z0 - az) - ez * (x0 - ax),
        s1 = ex * (z1 - az) - ez * (x1 - ax);
      if (s0 * s1 > 0) continue;
      const den = s0 - s1;
      const u = den === 0 ? 0 : s0 / den;
      const hx = x0 + (x1 - x0) * u,
        hz = z0 + (z1 - z0) * u;
      const along = ((hx - ax) * ex + (hz - az) * ez) / (ex * ex + ez * ez);
      if (along < -0.02 || along > 1.02) continue;
      p.life = 0;
      GD.stats.blocked++;
      x.fx.hit(hx, 1, hz, b.def.col, Math.atan2(p.vx, p.vz));
      ae.play("metal", { gap: 0.08, v: 0.3, p: 2 });
      break;
    }
  }
}

// ═══ 5. ENEMIGOS ════════════════════════════════════════════════════════════════════════════════════
// Una única función que consulta vp.update (21-enemies.js) antes de la IA. Devuelve true si el enemigo
// está aturdido (la IA se salta). Sale al instante si no hay nada que hacer: coste ≈ 0 sin gadgets.
function gdProfile(e) {
  const c = GD_CFG.detect;
  if (e.boss || e.static || c.skipIds[e.id]) return null;
  if (c.byId[e.id]) return c.byId[e.id];
  if (e.fam === "mech" && !e.fly) return c.mech;
  return null;
}
function gadgetEnemyTick(e, dt, dist) {
  if (!e.gx && !GD.list.length) return false;
  // — estados propios —
  if (e.gx) {
    if (e.gSlowT > 0) {
      e.gSlowT -= dt;
      if (e.gSlowT <= 0) e.slowMul = undefined;
    }
    if (e.gBleedT > 0) {
      e.gBleedT -= dt;
      e.gBleedA = (e.gBleedA || 0) - dt;
      if (e.gBleedA <= 0) {
        e.gBleedA = 0.5;
        hs(e, e.gBleedDps * 0.5, { elem: "none", noText: false });
        x.fx.blood(e.x, e.z, e.bloodCol, 2);
        if (e.dead) return false;
      }
    }
    if (e.gStun > 0) {
      e.gStun -= dt;
      e.vx *= 0.8;
      e.vz *= 0.8;
      if (gdRand() < dt * 8) x.fx.zap(e.x, e.z, e.x + (gdRand() - 0.5) * 1.6, e.z + (gdRand() - 0.5) * 1.6, 0x8f86ff, 0.4 + gdRand() * 1.2);
      if (e.gStun <= 0) e.gStun = 0;
    }
    if (!(e.gSlowT > 0) && !(e.gBleedT > 0) && !(e.gStun > 0)) e.gx = false;
  }
  if (!GD.list.length) return e.gStun > 0;
  // — señuelo: los enemigos alertados cercanos lo atacan a él (mecanismo de asedio existente) —
  if (GD.decoy && e.alerted && !e.boss && !e.static && (!e.siege || e.siege.deco)) {
    const t = GD.decoy.targets[0];
    if (e.siege !== GD.decoy) {
      if (t.hp > 0 && Le(e.x, e.z, t.x, t.z) < GD_CFG.types.decoy.range) {
        e.siege = GD.decoy;
        GD.stats.provoked++;
      }
    } else if (t.hp <= 0) e.siege = null;
    else e.aggroT = Math.min(e.aggroT, 0); // seguir al señuelo aunque lo hieran (el asedio normal se apaga 5 s al recibir daño)
  }
  // — barreras: empujan a los enemigos que se acercan al muro —
  for (let i = 0; i < GD.bars.length; i++) {
    const b = GD.bars[i];
    if (b.st === "arm") continue;
    const px = e.x - b.x,
      pz = e.z - b.z;
    const along = qe(px * b.dx + pz * b.dz, -b.hw, b.hw);
    const nx = px - b.dx * along,
      nz = pz - b.dz * along;
    const dd = Math.hypot(nx, nz);
    const lim = e.rad + 0.45;
    if (dd < lim && dd > 0.001) {
      const k = (lim - dd) * 28 * dt;
      e.kbx += (nx / dd) * k;
      e.kbz += (nz / dd) * k;
    }
  }
  // — detección: rodear o desarmar minas y trampas —
  const prof = gdProfile(e);
  if (!prof) return e.gStun > 0;
  const cfg = GD_CFG.detect;
  e._gScan = (e._gScan === undefined ? (e.uid % 10) * 0.02 : e._gScan) - dt;
  if (e._gScan <= 0) {
    e._gScan = 0.2;
    let best = null,
      bd = cfg.range;
    for (let i = 0; i < GD.list.length; i++) {
      const g = GD.list[i];
      if ((g.def.kind !== "mine" && g.def.kind !== "trap" && g.def.kind !== "field") || g.st !== "ready") continue;
      if (g.def.hidden && prof === "disarm") continue; // la mina EMP es invisible para los mecánicos

      const dd = Le(e.x, e.z, g.x, g.z);
      if (dd < bd) {
        bd = dd;
        best = g;
      }
    }
    if (best) {
      if (e._gSeen !== best.uid) {
        e._gSeen = best.uid;
        e._gOk = gdRand() < cfg.chance + (e.elite ? cfg.eliteBonus : 0);
      }
      e._gTgt = e._gOk ? best : null;
      e._gMode = prof;
    } else e._gTgt = null;
  }
  const g = e._gTgt;
  if (g && g.st === "ready") {
    const dd = Le(e.x, e.z, g.x, g.z);
    const dx = (g.x - e.x) / (dd || 1),
      dz = (g.z - e.z) / (dd || 1);
    if (e._gMode === "avoid") {
      // rodea la mina: desvío directo de posición (los embestidores ignoran los empujones suaves) hacia el lado que
      // mira al jugador, sin entrar en el radio de disparo; se frena si el desvío choca con un muro
      const lim = g.trigR + 1.6;
      if (dd < lim) {
        const side = dx * (x.player.z - e.z) - dz * (x.player.x - e.x) > 0 ? 1 : -1;
        const sp = Math.max(4, Math.hypot(e.vx, e.vz)) * dt * (1.2 + 1.6 * (1 - dd / lim));
        const mx = (-dx * 0.75 - dz * side) * sp,
          mz = (-dz * 0.75 + dx * side) * sp;
        if (!x.map.circleHits(e.x + mx, e.z + mz, e.rad * 0.8)) {
          e.x += mx;
          e.z += mz;
        }
      }
    } else if (e._gMode === "disarm") {
      if (dd > 1.0) {
        const k = 20 * dt;
        e.kbx += dx * k;
        e.kbz += dz * k;
      } else {
        g.dis += dt;
        g.disT = x.time;
        e.st.slow = Math.max(e.st.slow || 0, 0.2); // se detiene a trabajar
        if (gdRand() < dt * 8) x.fx.burst(g.x, 0.4, g.z, 1, { color: 0xffd447, speed: 2, life: 0.25, size: 0.1, up: 1 });
      }
    }
  }
  return e.gStun > 0;
}

// ═══ 6. ENTRADA Y HUD ═══════════════════════════════════════════════════════════════════════════════
// Teclado: X (pulsar = desplegar al soltar, mantener = detonar) y Z (siguiente). Táctil: botón GADGET.
function gdPressStart(src) {
  const h = GD.hold;
  if (h.down || x.uiOpen || !x.started) return;
  h.down = true;
  h.t0 = performance.now();
  h.ticks = 0;
  h.fired = false;
  h.swiped = false;
  h.src = src;
}
function gdPressEnd(src) {
  const h = GD.hold;
  if (!h.down || h.src !== src) return;
  h.down = false;
  if (!h.fired && !h.swiped && !x.uiOpen && x.started) gadgetDeploy();
  gdProgress(0);
}
function gdProgress(p) {
  const u = GD.ui;
  if (u && u.btn) {
    u.btn.style.setProperty("--p", Math.round(p * 100));
    u.btn.style.setProperty("--po", p > 0 ? 1 : 0);
  }
}
function gdInput(dt) {
  const h = GD.hold;
  if (Tt.hit("gadgetNext") && !x.uiOpen) gadgetNext(1);
  if (!h.down) return;
  const held = (performance.now() - h.t0) / 1000;
  h.ticks++;
  if (!h.fired && !h.swiped) {
    gdProgress(Math.min(1, held / GD_CFG.holdSec));
    // al menos 4 fotogramas de pulsación: un toque rápido nunca cuenta como «mantener» aunque el dispositivo se atasque
    if (held >= GD_CFG.holdSec && h.ticks >= 4) {
      h.fired = true;
      gdProgress(0);
      gadgetDetonateAll();
    }
  }
}
addEventListener("keydown", (ev) => {
  if (ev.code !== "KeyX" || ev.repeat) return;
  const tg = ev.target;
  if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
  gdPressStart("key");
});
addEventListener("keyup", (ev) => {
  if (ev.code === "KeyX") gdPressEnd("key");
});
addEventListener("blur", () => {
  GD.hold.down = false;
  gdProgress(0);
});

function gdBuildUi() {
  const hb = document.querySelector("#hB"),
    tc = document.querySelector("#touch");
  if (!hb || !tc) return;
  const ui = (GD.ui = {});
  // escritorio: casilla junto a las de consumibles (se oculta en táctil por CSS)
  const chip = document.createElement("div");
  chip.className = "cbtn";
  chip.id = "gdgChip";
  chip.innerHTML = '<span class="k">X</span><span class="gi"></span><b class="gn">0</b><small class="gs"></small>';
  chip.title = "Gadgets · X: desplegar · mantener X: detonar · Z: siguiente";
  hb.appendChild(chip);
  ui.chip = chip;
  // táctil: toque = desplegar, mantener = detonar, deslizar hacia arriba = cambiar
  const btn = document.createElement("button");
  btn.className = "tb gd";
  btn.id = "tbGdg";
  btn.type = "button";
  btn.setAttribute("aria-label", "Gadget: tocar para desplegar, mantener para detonar, deslizar hacia arriba para cambiar");
  btn.innerHTML = '<span class="gi"></span><span class="gl">GADGET</span><i class="gn">0</i>';
  tc.appendChild(btn);
  ui.btn = btn;
  const st = { id: null, y0: 0 };
  btn.addEventListener("touchstart", (ev) => ev.preventDefault(), { passive: false });
  btn.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    Tt.touchMode = true;
    st.id = ev.pointerId;
    st.y0 = ev.clientY;
    try { btn.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura: sigue funcionando */ }
    gdPressStart("touch");
  });
  btn.addEventListener("pointermove", (ev) => {
    if (ev.pointerId !== st.id || !GD.hold.down || GD.hold.swiped || GD.hold.src !== "touch") return;
    if (st.y0 - ev.clientY > GD_CFG.swipePx) {
      GD.hold.swiped = true;
      gdProgress(0);
      gadgetNext(1);
    }
  });
  const up = (ev) => {
    if (ev.pointerId !== st.id) return;
    st.id = null;
    if (ev.type === "pointercancel") GD.hold.swiped = true; // un cancelado nunca despliega
    gdPressEnd("touch");
  };
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("contextmenu", (ev) => ev.preventDefault());
  gdRefreshUi(true);
}
function gdRefreshUi(force) {
  const u = GD.ui,
    G = gdState();
  if (!u || !G) return;
  const d = GD_CFG.types[G.sel] || GD_CFG.types.proximity;
  const n = G.inv[G.sel] | 0,
    dep = GD.list.length,
    max = gdMaxSlots();
  const key = G.sel + "|" + n + "|" + dep + "|" + max;
  if (!force && u.key === key) return;
  u.key = key;
  for (const el of [u.chip, u.btn]) {
    const gi = el.querySelector(".gi");
    if (gi._id !== G.sel) {
      gi._id = G.sel;
      gi.innerHTML = gdIcon(G.sel, el === u.btn ? 26 : 22);
      gi.style.color = "#" + d.col.toString(16).padStart(6, "0");
    }
    el.querySelector(".gn").textContent = n;
    el.classList.toggle("empty", n <= 0);
  }
  u.chip.querySelector(".gs").textContent = `${dep}/${max}`;
  u.btn.querySelector(".gl").textContent = d.s;
  u.chip.title = `${d.n} · ${n} cargas · desplegados ${dep}/${max}\nX: desplegar · mantener X: detonar · Z: siguiente`;
}
// Aviso de aprendizaje (una vez por partida) con la tecla o el gesto que toca
function gdTip(dt) {
  const S = x.S;
  if (!S || (S.seenTips && S.seenTips.gadgets)) return;
  GD.tipT += dt;
  if (GD.tipT < 10) return;
  if (!S.seenTips) S.seenTips = {};
  S.seenTips.gadgets = 1;
  gdSay(
    Tt.touchMode
      ? "Gadgets: toca GADGET para colocar una mina, mantén para detonar y desliza hacia arriba para cambiar de gadget."
      : "Gadgets: X coloca una mina, mantén X para detonarlas y Z cambia de gadget.",
    "quest",
  );
}

// ═══ 7. PLANOS Y TALLER ═════════════════════════════════════════════════════════════════════════════
function gdUnknownIds(maxTier) {
  const G = gdState();
  return GD_ORDER.filter((id) => !G.known[id] && GD_CFG.types[id].tier <= maxTier);
}
// ECONOMÍA la llama (si existe) al tirar el botín de una fuente: devuelve un objeto de inventario o null.
// src: normal | elite | champion | chest1-3 | secret | boss | mission | hack. El objeto se aprende solo al llegar al inventario.
function gadgetPlanDrop(src, internal) {
  if (!internal) GD.ext = true;
  const G = gdState();
  if (!G) return null;
  const c = GD_CFG.plan[src] || GD_CFG.plan[String(src).replace(/\d+$/, "")];
  if (!c) return null;
  if (gdRand() >= c.p) return null;
  const ids = gdUnknownIds(c.tier);
  if (!ids.length) return null;
  // favorece los planos más sencillos (peso 1/tier)
  let tot = 0;
  const w = ids.map((id) => (tot += 1 / GD_CFG.types[id].tier));
  let r = gdRand() * tot,
    k = 0;
  while (k < ids.length - 1 && r > w[k]) k++;
  const id = ids[k],
    d = GD_CFG.types[id];
  return {
    id: "gp_" + id + "_" + GD.uid++,
    type: "gadgetPlan",
    gadget: id,
    name: "Plano: " + d.n,
    r: Math.min(5, d.tier + 1), // rareza visual: 1 poco común … 4 épico
    ilvl: 1,
    isNew: true,
  };
}
// Aprende un gadget (plano). bonus = cargas de regalo para probarlo.
function gadgetLearn(id, bonus) {
  const G = gdState(),
    d = GD_CFG.types[id];
  if (!G || !d) return false;
  if (G.known[id]) return false;
  G.known[id] = 1;
  const n = bonus === undefined ? 2 : bonus;
  if (n > 0) G.inv[id] = Math.min(GD_CFG.maxCharges, (G.inv[id] | 0) + n);
  ae.play("levelup", { v: 0.5 });
  ee("toast", `Plano aprendido: ${d.n}${n > 0 ? ` (+${n} cargas)` : ""}. Fabrícalo en el Taller.`, "good");
  ee("save");
  gdRefreshUi(true);
  return true;
}
function gdAbsorbPlans() {
  const S = x.S;
  if (!S || !S.inv) return;
  for (let i = S.inv.length - 1; i >= 0; i--) {
    const it = S.inv[i];
    if (it && it.type === "gadgetPlan") {
      S.inv.splice(i, 1);
      if (!gadgetLearn(it.gadget)) ee("toast", "Ya conocías ese plano: lo desguazas por piezas.", "");
    }
  }
}
function gdSelfDrop(src, at) {
  if (GD.ext) return; // ECONOMÍA ya nos llama desde su tabla de botín
  const it = gadgetPlanDrop(src, true);
  if (!it) return;
  gadgetLearn(it.gadget);
  if (at) x.fx.text(at.x, 2.2, at.z, "PLANO", "#ffd447", 15, { life: 1.4 });
}
// ECONOMÍA nos pasa el plano que ha salido en su tabla de botín (no hay recogida en el suelo): se aprende al instante
It("gadgetPlanDrop", (plan, at) => {
  if (!plan || !plan.gadget) return;
  gadgetLearn(plan.gadget);
  at && x.fx.text(at.x, 2.2, at.z, "PLANO", "#ffd447", 15, { life: 1.4 });
});
It("kill", (e) => {
  if (e.boss) return gdSelfDrop("boss", e);
  if (e.champion) return gdSelfDrop("champion", e);
  if (e.elite) return gdSelfDrop("elite", e);
  gdSelfDrop("normal", e);
});
It("chestOpen", (chest) => gdSelfDrop("chest" + Math.max(1, Math.min(3, (chest && chest.tier) | 0 || 1)), x.player));

// — Costes y fabricación —
function gdTrophyList() {
  const j = (x.S && x.S.junk) || null;
  if (!j || typeof j !== "object") return null; // sin economía de trofeos: solo materiales
  const out = [];
  for (const id in j) {
    const n = typeof j[id] === "number" ? j[id] : (j[id] && j[id].n) | 0;
    if (n > 0) out.push([id, n]);
  }
  return out;
}
function gdTrophyCount() {
  const l = gdTrophyList();
  return l ? l.reduce((a, [, n]) => a + n, 0) : 0;
}
function gdCostOf(id, qty = 1) {
  const d = GD_CFG.types[id];
  const disc = 1 - Math.min(GD_CFG.maxDiscount, gdFx("gadgetCost"));
  const mc = mt.credits(x.S.lvl);
  const c = {};
  for (const k in d.cost) {
    const base = k === "credits" ? d.cost[k] * mc : d.cost[k];
    c[k] = Math.max(1, Math.round(base * disc * qty));
  }
  return c;
}
function gdTrofCost(id, qty = 1) {
  return gdTrophyList() ? Math.max(1, Math.round(GD_CFG.types[id].trof * qty)) : 0;
}
function gdCanCraft(id, qty = 1) {
  const G = gdState();
  if (!G.known[id]) return false;
  if ((G.inv[id] | 0) + qty > GD_CFG.maxCharges) return false;
  return ca(gdCostOf(id, qty)) && gdTrophyCount() >= gdTrofCost(id, qty);
}
function gdPayTrophies(n) {
  const l = gdTrophyList();
  if (!l || n <= 0) return;
  l.sort((a, b) => b[1] - a[1]); // gasta primero las más abundantes
  const j = x.S.junk;
  for (const [id, have] of l) {
    if (n <= 0) break;
    const take = Math.min(n, have);
    if (typeof j[id] === "number") j[id] -= take;
    else j[id].n -= take;
    if ((typeof j[id] === "number" ? j[id] : j[id].n) <= 0) delete j[id];
    n -= take;
  }
}
function gadgetCraft(id, qty = 1) {
  const G = gdState();
  if (!gdCanCraft(id, qty)) return false;
  wb(gdCostOf(id, qty));
  gdPayTrophies(gdTrofCost(id, qty));
  G.inv[id] = (G.inv[id] | 0) + qty;
  ae.play("reload");
  ee("cons");
  ee("save");
  gdRefreshUi(true);
  return true;
}
function gdPlanPrice(id) {
  const t = GD_CFG.types[id].tier;
  const b = GD_CFG.planPrice[t];
  return b ? Math.round(b * mt.credits(x.S.lvl)) : 0;
}
function gdStatLine(d) {
  if (d.statText) return d.statText; // gadgets añadidos por otros frentes (p. ej. el Módulo Hacker de 31e-hacking.js)
  const f = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
  const p = [];
  if (d.kind === "turret") {
    p.push(`Daño ×${f(d.dmg)} por disparo`, `${f(d.rate)} disparos/s`, `alcance ${f(d.range)} m`, `${f(d.life)} s`);
  } else if (d.kind === "decoy") {
    p.push(`Radio de provocación ${f(d.range)} m`, `${f(d.life)} s`, `aguanta ${f(d.hpMul)}× tu vida`);
  } else if (d.kind === "barrier") {
    p.push(`${f(d.width)} m de ancho`, `${f(d.life)} s`);
  } else {
    p.push(`Daño ×${f(d.dmg)}`, `radio ${f(d.r)} m`);
    if (d.uses > 1) p.push(`${d.uses} usos`);
    if (d.remote) p.push("detonable a distancia");
    p.push(`armado ${f(d.arm)} s`);
  }
  return p.join(" · ");
}
function gdCatName(d) {
  return d.cat === "mine" ? "Mina" : d.cat === "trap" ? "Trampa" : "Dispositivo";
}
function gdTrofLine(need) {
  const have = gdTrophyCount(),
    ok = have >= need;
  return `<div class="ln ${ok ? "ok" : "no"}" style="--c:#c9d1d6"><span class="ic">✦</span><span class="nm">Trofeos (cualquiera)</span><span class="qty"><b>${yt(Math.min(have, need))}</b>/${yt(need)}${ok ? " ✓" : ""}</span><span class="bar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></span>${ok ? "" : `<span class="miss">Faltan ${yt(need - have)} \xB7 los sueltan los enemigos</span>`}</div>`;
}
// Contenido de la pestaña «Gadgets» (columna izquierda: estado; derecha: tarjetas)
function gdPanelInfo() {
  const G = gdState();
  const tro = gdTrophyList() ? `<div class="muted" style="font-size:13px;margin-top:8px">Trofeos en tu mochila: <b>${yt(gdTrophyCount())}</b></div>` : "";
  const touch = Tt.touchMode;
  return `<div class="card" style="margin-top:8px"><b>Tus gadgets</b><div class="muted" style="font-size:13px;margin-top:4px">Desplegados ahora: ${GD.list.length}/${gdMaxSlots()} \xB7 m\xE1ximo ${GD_CFG.maxCharges} cargas por tipo.</div>${tro}<div class="muted" style="font-size:13px;margin-top:8px">${touch ? "Bot\xF3n GADGET: toca para colocar, mant\xE9n para detonar, desliza hacia arriba para cambiar." : "X: colocar \xB7 mantener X: detonar \xB7 Z: cambiar de gadget."}</div></div>`;
}
function gadgetsPanelHtml() {
  const G = gdState();
  let cards = "";
  for (const id of GD_ORDER) {
    const d = GD_CFG.types[id],
      col = "#" + d.col.toString(16).padStart(6, "0");
    const known = !!G.known[id],
      n = G.inv[id] | 0;
    let body;
    if (known) {
      const c1 = gdCostOf(id, 1),
        c5 = gdCostOf(id, 5);
      const need = gdTrofCost(id, 1);
      const room = GD_CFG.maxCharges - n;
      const ok1 = gdCanCraft(id, 1),
        ok5 = room >= 5 && gdCanCraft(id, 5);
      body = `<div class="cost">${Do(c1)}${need ? `<div class="need">${gdTrofLine(need)}</div>` : ""}</div><div class="row" style="margin-top:6px;gap:6px"><button class="btn${ok1 ? " pri" : ""}" data-gfab="${id}" data-q="1" ${ok1 ? "" : "disabled"}>${room <= 0 ? "Cargas al m\xE1ximo" : "Fabricar"}</button><button class="btn" data-gfab="${id}" data-q="5" ${ok5 ? "" : "disabled"}>\xD75</button></div>`;
    } else {
      const price = gdPlanPrice(id);
      body = `<div class="muted" style="font-size:13px">Sin plano. ${d.tier >= 3 ? "Los planos de nivel " + d.tier + " caen de \xE9lites, campeones, cofres, jefes y secretos." : "Cae de \xE9lites y cofres o se compra aqu\xED."}</div>${price ? `<div class="cost" style="margin-top:6px">${Do({ credits: price })}</div><button class="btn${ca({ credits: price }) ? " pri" : ""}" style="margin-top:6px" data-gplan="${id}" ${ca({ credits: price }) ? "" : "disabled"}>Comprar plano</button>` : ""}`;
    }
    cards += `<div class="card gdcard${known ? "" : " locked"}" style="--gc:${col}"><div class="gdh"><span class="gdi" style="color:${col}">${gdIcon(id, 30)}</span><div style="min-width:0;flex:1"><b>${ke(d.n)}</b> <span class="tag" style="color:${col}">${gdCatName(d)} \xB7 plano ${d.tier}</span></div>${known ? `<span class="gdn${n <= 0 ? " zero" : ""}" title="Cargas">${n}<small>/${GD_CFG.maxCharges}</small></span>` : ""}</div><div class="muted" style="font-size:13px;margin:4px 0">${ke(d.d)}</div><div class="gdst">${ke(gdStatLine(d))}</div>${body}</div>`;
  }
  return `<div class="gdgrid">${cards}</div>`;
}
function gadgetsPanelBind(root, redraw) {
  // en móvil estrecho las pestañas se desplazan: que la activa quede a la vista
  try {
    root.querySelector(".whead .tab.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  } catch (e) {
    /* sin desplazamiento: no es crítico */
  }
  root.querySelectorAll("[data-gfab]").forEach((b) =>
    b.addEventListener("click", () => {
      if (gadgetCraft(b.dataset.gfab, +b.dataset.q || 1)) redraw();
    }),
  );
  root.querySelectorAll("[data-gplan]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.gplan,
        price = gdPlanPrice(id);
      if (price && ca({ credits: price })) {
        wb({ credits: price });
        gadgetLearn(id, 0);
        redraw();
      }
    }),
  );
}
function gadgetsPanelInfo() {
  return gdPanelInfo();
}

// ═══ 8. PRUEBAS ═════════════════════════════════════════════════════════════════════════════════════
window.__gadgets = {
  cfg: GD_CFG,
  state: GD,
  deploy: gadgetDeploy,
  next: gadgetNext,
  detonate: gadgetDetonateAll,
  craft: gadgetCraft,
  learn: gadgetLearn,
  planDrop: gadgetPlanDrop,
  costOf: gdCostOf,
  G: gdG,
  clear: gdClearAll,
  seed: (s) => (GD.seed = s >>> 0 || 1),
  maxSlots: gdMaxSlots,
};

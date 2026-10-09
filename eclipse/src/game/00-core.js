// 00-core.js — Ayudantes de esbuild, estado global x, bus de eventos, rejilla espacial

// ════════ [0] VariableDeclaration qb (29 bytes) ════════
var qb = Object.defineProperty;


// ════════ [1] VariableDeclaration r0 (64 bytes) ════════
var r0 = (n, e) => {
  for (var t in e) qb(n, t, { get: e[t], enumerable: !0 });
};


// ════════ [2] VariableDeclaration x (283 bytes) ════════
var x = {
  R: null,
  fx: null,
  map: null,
  mesh: null,
  world: null,
  worldMesh: null,
  player: null,
  enemies: [],
  projs: [],
  pickups: [],
  allies: [],
  hazards: [],
  S: null,
  time: 0,
  dt: 0,
  paused: !1,
  uiOpen: null,
  mode: "world",
  op: null,
  grid: null,
  events: {},
  regionId: 0,
  inDark: !1,
  night: 0,
  bossActive: null,
  combatHeat: 0,
  started: !1,
  // ── ganchos de extensión (ampliación de profundidad) ──
  tick: [], //  funciones (dt) que se ejecutan cada fotograma de simulación, tras world.update (no pausado)
  migrations: [], //  funciones (S) idempotentes que completan/migran el guardado (se llaman desde fS)
  cfg: {}, //  configuración por sistema (x.cfg.loot, x.cfg.xp…): datos, no lógica
};


// ════════ [3] FunctionDeclaration It (60 bytes) ════════
function It(n, e) {
  var t;
  ((t = x.events)[n] || (t[n] = [])).push(e);
}


// ════════ [4] FunctionDeclaration ee (66 bytes) ════════
function ee(n, ...e) {
  let t = x.events[n];
  if (t)
    for (let i of t)
      try {
        i(...e);
      } catch (err) {
        console.error(`[evento ${n}]`, err);
      }
}


// ════════ [5] VariableDeclaration Kl (537 bytes) ════════
var Kl = class {
  constructor(e, t, i = 3) {
    ((this.cell = i), (this.cw = Math.ceil(e / i)), (this.ch = Math.ceil(t / i)), (this.cells = new Map()));
  }
  clear() {
    this.cells.clear();
  }
  insert(e) {
    let t = Math.floor(e.x / this.cell) + Math.floor(e.z / this.cell) * 1e4,
      i = this.cells.get(t);
    (i || ((i = []), this.cells.set(t, i)), i.push(e));
  }
  query(e, t, i, s = []) {
    s.length = 0;
    let a = Math.floor((e - i) / this.cell),
      r = Math.floor((e + i) / this.cell),
      o = Math.floor((t - i) / this.cell),
      l = Math.floor((t + i) / this.cell);
    for (let c = o; c <= l; c++)
      for (let d = a; d <= r; d++) {
        let h = this.cells.get(d + c * 1e4);
        if (h) for (let f of h) s.push(f);
      }
    return s;
  }
};


// ════════ Reloj del mundo ════════
// Los enfriamientos del mundo (manadas, nidos, cofres, santuarios, jefes, zonas, guaridas…) comparan marcas de tiempo REAL guardadas en la partida. Con el juego en pausa, en el menú
// o con la pestaña oculta ese reloj seguía corriendo y, al volver, todo se había «repoblado» de golpe (y las manadas despejadas hacía ≥ 15 min reaparecían sin parar). `gnow()` es la
// hora real MENOS el tiempo en que el juego no ha corrido (lo suma el bucle principal): conserva la escala de Date.now(), así que las marcas de partidas antiguas siguen valiendo.
var GN = { lost: 0 };
function gnow() {
  return Date.now() - GN.lost;
}

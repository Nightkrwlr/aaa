// 31j-machines.js — Máquinas hackeables (D11)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// Los enemigos ya no se hackean a mano (31e-hacking.js: x.cfg.hack.enemy.manual = false; el módulo Hacker de los gadgets sigue funcionando solo).
// En su lugar hay MÁQUINAS DORMIDAS repartidas por el mundo, caídas y apagadas, que se REACTIVAN con el hackeo de siempre (tecla V / botón HACKEAR):
//
//   · reutilizables — torreta ametralladora, dron de combate, robot guardián y dron médico. Te ayudan unos minutos (batería: depende del tipo, del
//     nivel de hackeo y del talento «Duración de torretas»), disparan con un múltiplo del DPS de TU arma y luego se apagan y quedan como carcasa. Tras un
//     tiempo de reutilización vuelven a aparecer, dormidas, en OTRO lugar al azar de su región;
//   · únicas (una vez por partida y lugar) — DRON EXPLORADOR: te guía paso a paso hasta una pista o un secreto sin descubrir (lore, cámara oculta,
//     cámara acorazada, datáfono); BALIZA DE SUMINISTROS: pide una cápsula del cielo con equipo o un documento de lore; ASCENSOR DE CARGA: sube un
//     palé con dos o tres objetos (equipo, módulos, materiales) de las profundidades.
//
// Las máquinas aliadas NO son enemigos (no cuentan para nada del spawner, no se pueden herir ni matar, no dan botín): son cuerpos propios con modelo
// de los enemigos mecánicos, que disparan proyectiles del jugador. Los reutilizables nacen al azar (semilla guardada) la primera vez que se pisa el
// mundo; todo el estado va en S.mach (guardado v1, migración idempotente). Pruebas: window.__mach.

x.cfg.mach = {
  v: 1,
  perRegion: 4, // máquinas reutilizables dormidas por región
  weights: { ametralladora: 3, dron: 3, robot: 2, medico: 1 }, // reparto al colocarlas
  loadR: 46, // se montan cuando el jugador está más cerca que esto…
  unloadR: 60, // …y se desmontan más allá
  maxActive: 3, // aliadas a la vez (al activar otra, la que menos batería tiene se apaga)
  cooldown: [660, 1080], // s de juego hasta que una máquina agotada reaparece (dormida) en otro lugar de su región
  huskS: 20, // s que queda la carcasa apagada antes de disolverse
  lockS: 25, // s de bloqueo de una máquina tras un hackeo fallido
  minFromBase: 42, // distancia mínima al Bastión
  minApart: 28, // distancia mínima entre dos máquinas
  hideR: 52, // al reaparecer, lejos del jugador (no se ve cómo se coloca)
  nearBase: [58, 95], // la primera de la región 0 aparece a esta distancia del Bastión (para que se encuentre pronto)
  lowS: 15, // aviso de batería baja
  // tipos reutilizables. battery = s base (+ perLvl por nivel de hackeo, tope max, × talento); dpsMul × DPS del arma activa × cd = daño por disparo
  kinds: {
    ametralladora: {
      n: "Torreta ametralladora", ic: "▲", model: "Mech_BarbaraTheBee", h: 1.15, scale: 1.3, rad: 0.8, ai: "turret", col: 0x2aa8d8,
      battery: 150, perLvl: 6, max: 300, range: 15, cd: 0.13, dpsMul: 0.9, spread: 0.06, xp: 14, diff: 1, need: 1,
      d: "Dispara sin parar a todo lo que se acerque. Se queda donde la reactivas.",
    },
    dron: {
      n: "Dron de combate", ic: "✦", model: "Enemy_Flying", h: 1.15, scale: 1.0, rad: 0.5, ai: "drone", col: 0x2aa8d8, fly: 1.55,
      battery: 170, perLvl: 6, max: 320, range: 14, cd: 0.4, dpsMul: 0.85, spread: 0.04, xp: 12, diff: 1, need: 1,
      d: "Te acompaña y dispara a todo lo que te ataque.",
    },
    robot: {
      n: "Robot guardián", ic: "◆", model: "Mech_FinnTheFrog", h: 1.15, scale: 1.5, rad: 0.9, ai: "robot", col: 0x2a7fd8, speed: 4.4,
      battery: 130, perLvl: 6, max: 260, range: 11, cd: 0.28, dpsMul: 1.0, spread: 0.05, xp: 18, diff: 2, need: 3,
      d: "Te sigue a pie y cubre tu avance con fuego constante.",
    },
    medico: {
      n: "Dron médico", ic: "✚", model: "Enemy_Flying", h: 1.15, scale: 0.95, rad: 0.5, ai: "medic", col: 0x3fe08a, fly: 1.6,
      battery: 100, perLvl: 4, max: 200, heal: 0.012, healBelow: 0.95, xp: 12, diff: 1, need: 1,
      d: "Te acompaña y te cura (1,2 % de vida por segundo) mientras dure la batería.",
    },
  },
  // máquinas únicas: una de cada por región (la baliza y el dron son de un solo uso; el ascensor, también)
  single: {
    guia: {
      n: "Dron explorador", ic: "⌖", model: "Enemy_Flying", h: 1.15, scale: 1.1, rad: 0.5, ai: "guide", col: 0xffd447, fly: 1.7,
      xp: 30, diff: 2, need: 4, layers: 2, speed: 4.8, lead: 15, waitS: 360, doneR: 5, maxDist: 190,
      d: "Un explorador autónomo: te lleva hasta una pista o un secreto que aún no has descubierto.",
    },
    baliza: {
      n: "Baliza de suministros", ic: "◉", mesh: "beacon", scale: 1.5, rad: 0.7, ai: "beacon", col: 0x46e4ff,
      xp: 34, diff: 2, need: 5, layers: 2, dropS: 4.5, equipP: 0.62, loreP: 0.34, epicP: 0.12, minR: 2,
      d: "Pide una cápsula de suministros: equipo del almacén central o un documento de lore.",
    },
    ascensor: {
      n: "Ascensor de carga", ic: "▤", mesh: "lift", scale: 1.7, rad: 1.5, ai: "lift", col: 0xffb340,
      xp: 40, diff: 3, need: 6, layers: 2, riseS: 4, items: [2, 3], epicP: 0.22, minR: 2, chipP: 0.4, loreP: 0.3,
      d: "Sube un palé de carga de las profundidades: equipo, módulos y materiales.",
    },
  },
  tagH: 2.4, // altura (m) de la etiqueta de batería sobre las aliadas
};
const MXC = x.cfg.mach;

// ═══ 1. ESTADO ═════════════════════════════════════════════════════════════════════════════════════
// S.mach = { v, seed, init, slots:{id:{id,k,reg,x,z,st,cd,lock,u,n}}, n, stats:{act,fail,guia,baliza,ascensor} }
//   st: dormant (esperando) | active (aliada) | cool (agotada, vuelve cuando pase cd) | used (única gastada: no vuelve)
function mxMigrate(S) {
  if (!S) return;
  const M = S.mach && typeof S.mach === "object" ? S.mach : (S.mach = {});
  M.v = 1;
  M.seed = Number.isFinite(M.seed) && M.seed > 0 ? M.seed >>> 0 : ((Math.random() * 4294967295) >>> 0) || 1;
  if (!M.slots || typeof M.slots !== "object" || Array.isArray(M.slots)) M.slots = {};
  M.n = Number.isFinite(M.n) ? M.n | 0 : 0;
  M.init = !!M.init;
  if (!M.stats || typeof M.stats !== "object") M.stats = {};
  for (const k of ["act", "fail", "guia", "baliza", "ascensor"]) M.stats[k] = Number.isFinite(M.stats[k]) ? Math.max(0, M.stats[k] | 0) : 0;
  for (const id of Object.keys(M.slots)) {
    const s = M.slots[id];
    const known = s && (MXC.kinds[s.k] || MXC.single[s.k]);
    if (!known || !Number.isFinite(s.x) || !Number.isFinite(s.z)) {
      delete M.slots[id];
      continue;
    }
    s.id = id;
    s.u = MXC.single[s.k] ? 1 : 0;
    s.reg = Number.isFinite(s.reg) ? s.reg | 0 : 0;
    s.cd = Number.isFinite(s.cd) ? s.cd : 0;
    s.lock = 0; // el reloj de partida (x.time) vuelve a 0 al cargar: sin bloqueos viejos
    s.n = Number.isFinite(s.n) ? s.n | 0 : 0;
    // las aliadas no sobreviven a un guardado (su cuerpo no existe al cargar): vuelven a dormir donde estaban
    if (s.st === "active" || s.st === "guide") s.st = "dormant";
    if (!["dormant", "cool", "used"].includes(s.st)) s.st = "dormant";
  }
  return M;
}
x.migrations.push(mxMigrate);
function mxS() {
  const S = x.S;
  return S ? S.mach || mxMigrate(S) : null;
}

const MX = {
  body: new Map(), // id de casilla → cuerpo montado
  act: [], // cuerpos aliados activos (reutilizables)
  fxs: [], // efectos con vida propia (cápsulas, palés, rastros)
  tags: new Map(),
  map: null,
  uid: 1000,
  t: 0,
  scanT: 0,
  tmp: [],
  pt: { x: 0, y: 0, vis: false },
  tip: false,
  rng: pi(12345),
  last: null,
  lastGuide: null,
};
const mxMap = () => (typeof Po !== "undefined" && Po) || (x.map && x.map.kind !== "op" ? x.map : null);
const mxDef = (k) => MXC.kinds[k] || MXC.single[k];
const mxClock = () => (x.S ? x.S.playTime : 0);

// ═══ 2. COLOCACIÓN ═════════════════════════════════════════════════════════════════════════════════
// ¿se puede dejar una máquina en esa casilla? suelo o camino, sin atrezo sólido y con la 3×3 de alrededor libre
function mxFree(map, X, Z) {
  const t0 = map.t(X, Z);
  if (t0 !== F.GROUND && t0 !== F.ROAD) return false;
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const q = map.t(X + dx, Z + dz);
      if (Ua[q] || q === F.WALL || q === F.DOOR || q === F.CAVE) return false;
      if (map.blk[map.idx(X + dx, Z + dz)]) return false;
    }
  return true;
}
function mxNearRoad(map, X, Z, r) {
  for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) if (map.t(X + dx, Z + dz) === F.ROAD) return true;
  return false;
}
// busca un lugar para una máquina de la región reg. opt: near [dmin,dmax] respecto al Bastión · stairs (cerca de una escalera) · farFrom {x,z,r}
function mxSpot(reg, rng, opt = {}) {
  const map = mxMap();
  if (!map) return null;
  const R = De[reg] || De[0],
    x0 = R.gx * qt,
    z0 = R.gz * qt,
    m = 14;
  const S = mxS(),
    base = map.pois && map.pois.base ? map.pois.base : { x: qt * 1.5, z: qt * 1.5 };
  const others = Object.values(S.slots).filter((s) => s.st !== "used");
  const stairs = opt.stairs ? map.ents.filter((e) => e.k === "stairs" && e.reg === reg) : null;
  let best = null,
    bs = -1;
  for (let tries = 0; tries < 160; tries++) {
    let X, Z;
    if (stairs && stairs.length) {
      const e = stairs[rng.int(0, stairs.length - 1)],
        a = rng() * 6.283,
        d = 8 + rng() * 14;
      X = Math.floor(e.x + Math.cos(a) * d);
      Z = Math.floor(e.z + Math.sin(a) * d);
    } else {
      X = x0 + m + rng.int(0, qt - 2 * m - 1);
      Z = z0 + m + rng.int(0, qt - 2 * m - 1);
    }
    if (X < x0 + m || X >= x0 + qt - m || Z < z0 + m || Z >= z0 + qt - m) continue;
    if (!mxFree(map, X, Z)) continue;
    const cx = X + 0.5,
      cz = Z + 0.5,
      db = Math.hypot(cx - base.x, cz - base.z);
    if (db < MXC.minFromBase) continue;
    if (opt.near && (db < opt.near[0] || db > opt.near[1])) continue;
    if (opt.farFrom && Math.hypot(cx - opt.farFrom.x, cz - opt.farFrom.z) < opt.farFrom.r) continue;
    if (x.world && x.world.safeAt(cx, cz)) continue;
    let ok = true;
    for (const o of others) if (Math.hypot(o.x - cx, o.z - cz) < MXC.minApart) ok = false;
    if (!ok) continue;
    // lejos de lo que ya hay: entidades del mapa (cofres, escaleras, nidos…) a más de 3 casillas
    for (const e of map.ents) {
      if (e.k === "light") continue;
      if (Math.abs(e.x - cx) < 3 && Math.abs(e.z - cz) < 3) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const sc = 1 + (mxNearRoad(map, X, Z, 9) ? 2 : 0) + rng();
    if (sc > bs) {
      bs = sc;
      best = { x: cx, z: cz };
      if (sc > 3) break;
    }
  }
  return best;
}
function mxNewSlot(k, reg, spot, extra) {
  const S = mxS(),
    id = "mx_" + ++S.n;
  return (S.slots[id] = { id, k, reg, x: spot.x, z: spot.z, st: "dormant", cd: 0, lock: 0, u: MXC.single[k] ? 1 : 0, n: 0, ...extra });
}
function mxWeighted(rng) {
  const w = MXC.weights,
    ks = Object.keys(w);
  let t = ks.reduce((a, k) => a + w[k], 0),
    q = rng() * t;
  for (const k of ks) {
    q -= w[k];
    if (q <= 0) return k;
  }
  return ks[0];
}
// primera vez en el mundo: reparte las máquinas de cada región con la semilla de la partida
function mxInitSlots() {
  const S = mxS();
  if (!S || S.init || !mxMap()) return false;
  const rng = pi((S.seed ^ 0x6d78) >>> 0);
  for (let reg = 0; reg < De.length; reg++) {
    for (let i = 0; i < MXC.perRegion; i++) {
      const k = mxWeighted(rng),
        spot = mxSpot(reg, rng, reg === 0 && i === 0 ? { near: MXC.nearBase } : {});
      spot && mxNewSlot(k, reg, spot);
    }
    for (const k of Object.keys(MXC.single)) {
      const spot = mxSpot(reg, rng, k === "ascensor" ? { stairs: true } : {});
      spot && mxNewSlot(k, reg, spot);
    }
  }
  S.init = true;
  return true;
}
// la máquina agotada reaparece, dormida, en otro sitio de su región (lejos del jugador)
function mxRelocate(s) {
  const S = mxS(),
    rng = pi((S.seed ^ (s.n * 7919 + s.id.length * 131 + 0x51)) >>> 0),
    p = x.player;
  const here = { x: s.x, z: s.z };
  let spot = null;
  for (let t = 0; t < 4 && !spot; t++) spot = mxSpot(s.reg, rng, p ? { farFrom: { x: p.x, z: p.z, r: MXC.hideR } } : {});
  if (!spot) spot = mxSpot(s.reg, rng, {}) || here;
  s.x = spot.x;
  s.z = spot.z;
  s.st = "dormant";
  s.lock = 0;
  s.n++;
  // el kind puede cambiar: así el mundo no se llena de lo mismo
  if (!s.u) s.k = mxWeighted(rng);
}

// ═══ 3. CUERPOS ════════════════════════════════════════════════════════════════════════════════════
const MX_REC_DORMANT = { hue: 0, sat: 0.2, val: 0.6 }; // gris azulado apagado
function mxMakeModel(def, active, k) {
  const name = def.model;
  if (!name || !Ln.has(name)) return null;
  const col = def.col;
  return new Da(
    name,
    def.h,
    active
      ? { recolor: To(name, col), emissive: col, rim: 0x8ff0ff, rimK: 0.7, aura: col, auraK: 0.14, eyes: 1.8 }
      : { recolor: k === "guia" ? { hue: 0, sat: 0.3, val: 0.7 } : MX_REC_DORMANT, rim: 0x6a7080, rimK: 0.25, eyes: 0 },
  );
}
// modelo «caído»: reproduce la animación de muerte hasta el final (pose apagada, sin coste por fotograma)
function mxPoseDown(model) {
  model.play("death");
  model.mixer.update(6);
  model.fx.tick(0.016);
}
function mxProcBeacon(active) {
  const g = new Ve(),
    dark = de(0x2b3038, { k: "metal" }),
    lamp = Me(active ? 0x46e4ff : 0xff3030, active ? 1 : 0.8);
  const base = new Ge(Ye(0.5, 0.68, 0.36, 8), dark);
  base.position.y = 0.18;
  const mast = new Ge(Ye(0.06, 0.09, 2.1, 6), de(0x5a626e, { k: "metal" }));
  mast.position.y = 1.4;
  const dish = new Ge(_n(0.44, 10, 6), de(0x8a929e, { k: "metal" }));
  dish.scale.set(1, 0.32, 1);
  dish.position.set(0, 2.3, 0.1);
  dish.rotation.x = -0.7;
  const l = new Ge(_n(0.1, 8, 6), lamp);
  l.position.y = 2.52;
  const ring = new Ge(Mp(0.62, 0.025, 4, 18), Me(active ? 0x46e4ff : 0x553030, active ? 0.95 : 0.6, true));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.07;
  g.add(base, mast, dish, l, ring);
  g.userData = { lamp: l, ring, dish, active };
  g.rotation.z = active ? 0 : 0.0;
  if (!active) g.rotation.x = 0.1; // ladeada: apagada
  return g;
}
function mxProcLift(active) {
  const g = new Ve(),
    dark = de(0x30343c, { k: "metal" }),
    amb = Me(active ? 0xffb340 : 0x6b4a18, active ? 1 : 0.75, true);
  // escotilla de dos hojas al ras del suelo
  const hl = new Ge(Je(1.45, 0.2, 2.9), dark),
    hr = new Ge(Je(1.45, 0.2, 2.9), dark);
  hl.position.set(-0.725, 0, 0);
  hr.position.set(0.725, 0, 0);
  const frame = [];
  for (const [sx, sz, w, d] of [[0, -1.42, 2.9, 0.1], [0, 1.42, 2.9, 0.1], [-1.42, 0, 0.1, 2.9], [1.42, 0, 0.1, 2.9]]) {
    const f = new Ge(Je(w, 0.06, d), amb);
    f.position.set(sx, 0.12, sz);
    frame.push(f);
    g.add(f);
  }
  const ped = new Ge(Je(0.5, 1.15, 0.5), de(0x474d58, { k: "metal" }));
  ped.position.set(-2.0, 0.55, 1.6);
  const scr = new Ge(Je(0.34, 0.22, 0.04), Me(active ? 0x46e4ff : 0xff4040, 0.95));
  scr.position.set(-2.0, 0.95, 1.36);
  // palé que sube de las profundidades
  const car = new Ve();
  car.add(new Ge(Je(2.6, 0.2, 2.6), dark));
  for (const [cx, cz, sz, c] of [[-0.55, -0.4, 0.8, 0x6b5a3a], [0.55, -0.35, 0.7, 0x58506a], [0.05, 0.6, 0.62, 0x3f6a58]]) {
    const cr = new Ge(Je(sz, sz * 0.8, sz), de(c, { k: "paint" }));
    cr.position.set(cx, 0.1 + sz * 0.4, cz);
    car.add(cr);
  }
  car.position.y = -2.8;
  car.visible = false;
  g.add(hl, hr, ped, scr, car);
  g.userData = { hl, hr, frame, scr, car, active };
  return g;
}
function mxBuildBody(slot) {
  const def = mxDef(slot.k),
    S = mxS();
  const b = {
    uid: MX.uid++,
    slot,
    def,
    k: slot.k,
    u: slot.u,
    mx: true,
    mode: "dormant",
    x: slot.x,
    z: slot.z,
    y: 0,
    face: ((slot.x * 12.9898 + slot.z * 78.233) % 6.283) || 0.5,
    scale: def.scale,
    rad: def.rad,
    t: 0,
    tMax: 0,
    cd: 0,
    scan: 0,
    tgt: null,
    dps: 20,
    dpsT: 0,
    orbit: Math.random() * 6.28,
    stuck: 0,
    fxT: 0,
    model: null,
    mesh: null,
    root: null,
    anim: "",
    step: 0,
  };
  if (def.mesh) {
    b.mesh = def.mesh === "beacon" ? mxProcBeacon(false) : mxProcLift(false);
    b.root = b.mesh;
  } else {
    b.model = mxMakeModel(def, false, slot.k);
    if (b.model) {
      b.root = b.model.root;
      mxPoseDown(b.model);
      const sh = Ei(0.55, 0.5);
      b.root.add(sh);
    } else {
      // sin modelos 3D (compilación sin GLB): una caja apagada con el color del tipo
      b.mesh = new Ve();
      b.mesh.add(new Ge(Je(0.9, 0.7, 0.9), de(0x404650, { k: "metal" })));
      b.root = b.mesh;
    }
  }
  b.root.scale.setScalar(def.mesh ? def.scale * 0.7 : def.scale);
  b.root.position.set(b.x, 0, b.z);
  b.root.rotation.y = b.face;
  // haz de luz tenue: se ve desde lejos (ámbar las reutilizables, dorado las únicas)
  try {
    b.beam = ckLootBeam(slot.u ? 0xffd447 : 0xffb340, 3.4 / (b.root.scale.x || 1), 0.13 / (b.root.scale.x || 1));
    b.root.add(b.beam);
  } catch (e) {
    b.beam = null;
  }
  x.R.scene.add(b.root);
  MX.body.set(slot.id, b);
  void S;
  return b;
}
// las mallas procedurales crean su geometría al montarse (los materiales sí son compartidos): se libera al quitarlas
function mxFreeMesh(g) {
  g &&
    g.traverse((o) => {
      o.geometry && o.geometry !== ckBeamGeo && o.geometry.dispose();
    });
}
// los modelos de enemigos (Da) clonan sus materiales: se liberan con el cuerpo
function mxFreeModel(m) {
  if (!m) return;
  try {
    m.dispose();
    for (const q of m.mats || []) q.dispose && q.dispose();
  } catch (e) {
    /* ya liberado */
  }
}
function mxDispose(b) {
  if (!b) return;
  try {
    b.root && x.R.scene.remove(b.root);
    mxFreeModel(b.model);
    b.mesh && mxFreeMesh(b.mesh);
  } catch (e) {
    /* ya descargado */
  }
  const t = MX.tags.get(b.uid);
  if (t) {
    t.el.remove();
    MX.tags.delete(b.uid);
  }
  MX.body.delete(b.slot.id);
  const i = MX.act.indexOf(b);
  i >= 0 && MX.act.splice(i, 1);
  b.dead = true;
}
// cambia el modelo de un cuerpo (apagado ↔ encendido) conservando posición y orientación
function mxSwapModel(b, active) {
  if (!b.def.model) return;
  const old = b.model,
    oldRoot = b.root;
  const m = mxMakeModel(b.def, active, b.k);
  if (!m) return;
  m.root.scale.setScalar(b.def.scale);
  m.root.position.set(b.x, b.y, b.z);
  m.root.rotation.y = b.face;
  m.root.add(Ei(0.55, 0.5));
  x.R.scene.add(m.root);
  if (active) {
    m.play("idle");
    m.update(0, b.face, "idle");
  } else mxPoseDown(m);
  b.model = m;
  b.root = m.root;
  oldRoot && x.R.scene.remove(oldRoot);
  mxFreeModel(old);
  b.beam = null;
}

// ═══ 4. HACKEO, REACTIVACIÓN Y APAGADO ═════════════════════════════════════════════════════════════
function mxHackable(b) {
  return !!b && b.mx && !b.dead && b.mode === "dormant" && b.slot.lock <= x.time && x.mode === "world" && !!b.root && b.root.visible;
}
// la máquina dormida hackeable más cercana al jugador dentro del alcance (la usa hkScan de 31e-hacking.js)
function mxScan(p, range) {
  let best = null,
    bd = 1e9;
  for (const b of MX.body.values()) {
    if (!mxHackable(b)) continue;
    const d = Le(b.x, b.z, p.x, p.z);
    if (d > range + (b.def.mesh ? 1.2 : 0) || (d > 3.5 && !x.map.los(p.x, p.z, b.x, b.z))) continue;
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best ? { b: best, d: bd } : null;
}
// texto del marcador HACKEAR y nivel recomendado (hkMarkUpdate)
function mxMarkInfo(b) {
  return { n: b.def.n, act: b.u ? "sistema" : "reactivar", need: b.def.need || 1 };
}
function mxSpec(b) {
  const def = b.def,
    s = b.slot,
    lvl = x.world.lvlAt(b.x, b.z);
  const diff = Math.max(1, Math.min(4, (def.diff || 1) + Math.floor(lvl / 18)));
  s.tries = (s.tries | 0) + 1;
  return {
    target: "machine",
    objetivo: b.u ? "unica" : "maquina",
    id: s.id,
    title: (b.u ? "Sistema · " : "Reactivar · ") + def.n,
    sub: def.d,
    diff,
    layers: def.layers || 1,
    pool: b.u ? undefined : ["fw", "route", "tune", "sync", "seq", "lights", "pipe"],
    seed: hkHash(s.id + ":" + s.n + ":" + s.tries + ":" + mxS().seed),
    need: (def.need || 1) + 2 * (diff - 1) * 0,
    xp: def.xp,
    at: { x: b.x, z: b.z },
    noRewards: true,
    rewMul: 0.5,
    machine: b,
    onDone(res) {
      return mxHackDone(b, res);
    },
  };
}
function mxHackDone(b, res) {
  const lines = [],
    s = b.slot,
    S = mxS(),
    def = b.def;
  if (b.dead || s.st !== "dormant" || b.mode !== "dormant") return ["La máquina ya no responde."];
  if (!res.ok) {
    S.stats.fail++;
    s.lock = x.time + MXC.lockS;
    const dmg = hkShock(HK_CFG.trace.shock * (res.traza >= 100 ? 0.6 : 0.25));
    lines.push(`<b>Sistema bloqueado</b>: ${ke(def.n)} no responde durante ${MXC.lockS} s`, dmg > 0 ? `Descarga: −${Math.round(dmg)} vida` : "");
    try {
      x.fx.zap(b.x, b.z, b.x + (Q() - 0.5) * 2, b.z + (Q() - 0.5) * 2, 0xff4f5e, 1.2);
      x.fx.text(b.x, 2.2, b.z, "BLOQUEADA", "#ff8d97", 13, { life: 1.2 });
    } catch (e) {
      /* sin efecto */
    }
    return lines.filter(Boolean);
  }
  S.stats.act++;
  if (def.ai === "guide") mxGuideStart(b, lines, res);
  else if (def.ai === "beacon") mxBeaconStart(b, lines, res);
  else if (def.ai === "lift") mxLiftStart(b, lines, res);
  else mxActivate(b, res, lines);
  return lines.filter(Boolean);
}
function mxActivate(b, res, lines) {
  const def = b.def,
    s = b.slot,
    H = hkState();
  while (MX.act.length >= MXC.maxActive) {
    const w = MX.act.reduce((a, c) => (c.t < a.t ? c : a));
    mxShutdown(w, "relevo");
  }
  let secs = Math.min(def.max, def.battery + def.perLvl * (H.lvl - 1)) * (1 + hkFx("turretTime"));
  if (res.riesgo === 2) secs *= 1.2;
  b.mode = "active";
  s.st = "active";
  b.t = b.tMax = secs;
  b.dps = hkPlayerDps();
  b.dpsT = 8;
  b.cd = 0.3;
  b.over = res.riesgo === 2;
  mxSwapModel(b, true);
  if (def.fly) b.y = def.fly;
  MX.act.push(b);
  H.stats.ctl++;
  lines.push(`${ke(def.n)} reactivada durante <b>${Math.round(secs)} s</b>${b.over ? " · modo agresivo: +20 % de batería" : ""}`);
  try {
    x.fx.ring(b.x, b.z, 3, 0x46e4ff, 0.8, 2);
    x.fx.burst(b.x, 1, b.z, 22, { color: 0x46e4ff, speed: 4, life: 0.6, size: 0.18, up: 1 });
    x.fx.text(b.x, 2.4, b.z, "REACTIVADA", "#46e4ff", 14, { life: 1.4 });
  } catch (e) {
    /* sin efecto */
  }
  hkSfx("hkCtl");
  ee("machineOn", def.n);
}
function mxShutdown(b, why) {
  if (!b || b.mode !== "active") return;
  const s = b.slot,
    S = mxS();
  b.mode = "husk";
  b.huskT = MXC.huskS;
  b.fall = 2.2;
  b.tgt = null;
  s.st = "cool";
  s.cd = mxClock() + MXC.cooldown[0] + Q() * (MXC.cooldown[1] - MXC.cooldown[0]);
  const i = MX.act.indexOf(b);
  i >= 0 && MX.act.splice(i, 1);
  const t = MX.tags.get(b.uid);
  if (t) {
    t.el.remove();
    MX.tags.delete(b.uid);
  }
  try {
    if (b.model) {
      b.model.play("death");
      b.model.fx.setAura && b.model.fx.setAura(0, 0);
    }
    x.fx.smoke(b.x, 0.8, b.z, 5, 0x3a3f4a, 0.7);
    x.fx.burst(b.x, 1, b.z, 14, { color: 0xffb340, speed: 3, life: 0.5, size: 0.14, up: 1 });
    x.fx.text(b.x, 2.4, b.z, why === "bateria" ? "BATERÍA AGOTADA" : why === "muerte" ? "SIN ENLACE" : "APAGADA", "#ffb340", 13, { life: 1.6 });
  } catch (e) {
    /* sin efecto */
  }
  hkSfx("hkOff");
  S.stats.off = (S.stats.off | 0) + 1;
  ee("machineOff", b.def.n, why);
}

// ═══ 5. IA DE LAS ALIADAS ══════════════════════════════════════════════════════════════════════════
function mxAcquire(b, range) {
  const list = rn(b.x, b.z, range, MX.tmp);
  let best = null,
    bd = 1e9;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o.dead || !o.targetable() || o.mx) continue;
    const d = Le(o.x, o.z, b.x, b.z);
    if (d < bd && x.map.los(b.x, b.z, o.x, o.z)) {
      bd = d;
      best = o;
    }
  }
  return best;
}
function mxShoot(b, t) {
  const def = b.def,
    a = Math.atan2(t.x - b.x, t.z - b.z) + (Q() - 0.5) * (def.spread || 0),
    y = def.fly ? b.y + 0.1 : 1.0,
    sp = 34,
    ox = b.x + Math.sin(a) * 0.8,
    oz = b.z + Math.cos(a) * 0.8,
    dist = Le(t.x, t.z, b.x, b.z);
  x.projs.push({
    owner: "p",
    kind: "bullet",
    x: ox,
    y,
    z: oz,
    vx: Math.sin(a) * sp,
    vz: Math.cos(a) * sp,
    dmg: b.dps * def.dpsMul * def.cd * (1 + hkFx("turretDmg")) * (b.over ? 1.2 : 1),
    life: (dist + 1.5) / sp,
    pierce: 0,
    rico: 0,
    hit: new Set(),
    color: b.over ? 0xffb340 : 0x46e4ff,
    w: 0.06,
    len: 1,
  });
  x.fx.muzzle(ox, y, oz, a, b.over ? 0xffb340 : 0x46e4ff, 0.9);
  hkSfx("laser", { gap: 0.08, v: 0.16, p: 1.7 });
}
function mxTurnTo(b, a, dt, k = 10) {
  b.face += fi(b.face, a) * Math.min(1, dt * k);
}
function mxTagFor(b) {
  let t = MX.tags.get(b.uid);
  if (t) return t;
  const el = document.createElement("div");
  el.className = "mx-tag";
  el.innerHTML = `<span>${ke(b.def.n)}</span><i></i>`;
  (document.getElementById("app") || document.body).appendChild(el);
  t = { el, bar: el.querySelector("i"), p: -1, cls: "", px: -1, py: -1, vis: true };
  MX.tags.set(b.uid, t);
  return t;
}
function mxTagUpdate(b) {
  const t = mxTagFor(b),
    f = Math.max(0, Math.min(1, b.t / b.tMax)),
    cls = b.t < MXC.lowS * 0.5 ? "crit" : b.t < MXC.lowS ? "low" : "";
  const pct = Math.round(f * 100);
  if (t.p !== pct) {
    t.p = pct;
    t.bar.style.setProperty("--p", pct + "%");
  }
  if (t.cls !== cls) {
    t.cls = cls;
    t.el.className = "mx-tag" + (cls ? " " + cls : "");
  }
  const o = MX.pt;
  x.R.project(b.x, (b.def.fly ? b.y : 0) + MXC.tagH * (b.def.fly ? 0.45 : 0.6) + 0.5, b.z, o);
  const show = o.vis && o.x > -40 && o.y > 0 && o.x < x.R.w + 40 && o.y < x.R.h + 40 && !x.uiOpen;
  if (show !== t.vis) {
    t.vis = show;
    t.el.style.display = show ? "block" : "none";
  }
  if (show) {
    const px = Math.round(o.x),
      py = Math.round(o.y);
    if (px !== t.px || py !== t.py) {
      t.px = px;
      t.py = py;
      t.el.style.transform = `translate(${px}px,${py}px) translate(-50%,-100%)`;
    }
  }
}
function mxStepActive(b, dt) {
  const def = b.def,
    p = x.player;
  b.t -= dt;
  if (b.t <= 0) return mxShutdown(b, "bateria");
  if (p.dead) return mxShutdown(b, "muerte");
  b.dpsT -= dt;
  if (b.dpsT <= 0) {
    b.dpsT = 8;
    b.dps = hkPlayerDps();
  }
  // batería baja: parpadeo y aviso
  if (b.t < MXC.lowS && !b.lowWarn) {
    b.lowWarn = true;
    x.fx.text(b.x, 2.6, b.z, "BATERÍA BAJA", "#ffb340", 12, { life: 1.4 });
    hkSfx("alarm", { v: 0.25 });
  }
  const toP = Le(b.x, b.z, p.x, p.z);
  let anim = "idle",
    rate = 1,
    firing = false;
  if (def.ai === "turret" || def.ai === "robot") {
    b.scan -= dt;
    if (b.scan <= 0) {
      b.scan = 0.12;
      b.tgt = mxAcquire(b, def.range);
    }
  } else if (def.ai === "drone") {
    b.scan -= dt;
    if (b.scan <= 0) {
      b.scan = 0.14;
      b.tgt = mxAcquire(b, def.range);
    }
  }
  if (b.tgt && (b.tgt.dead || !b.tgt.targetable())) b.tgt = null;
  if (def.ai === "drone" || def.ai === "medic") {
    b.orbit += dt * (def.ai === "medic" ? 0.6 : 0.9);
    const tx = p.x + Math.cos(b.orbit) * (def.ai === "medic" ? 1.9 : 2.5),
      tz = p.z + Math.sin(b.orbit) * (def.ai === "medic" ? 1.9 : 2.5),
      k = toP > 30 ? 1 : Math.min(1, dt * 3.4);
    b.x += (tx - b.x) * k;
    b.z += (tz - b.z) * k;
    b.y = def.fly + Math.sin(x.time * 3 + b.uid) * 0.12;
    if (def.ai === "medic") {
      mxTurnTo(b, Math.atan2(p.x - b.x, p.z - b.z), dt);
      b.fxT -= dt;
      if (p.hp < p.maxHp * def.healBelow) {
        p.heal(p.maxHp * def.heal * dt, true);
        if (b.fxT <= 0) {
          b.fxT = 0.45;
          x.fx.zap(b.x, b.z, p.x, p.z, 0x3fe08a, 0.9);
        }
      }
    }
  } else if (def.ai === "robot") {
    const want = 3.2;
    const far = b.tgt ? Le(b.tgt.x, b.tgt.z, b.x, b.z) : 0;
    if (toP > want + 1.4 || (toP > want && !b.tgt)) {
      const a = Math.atan2(p.x - b.x, p.z - b.z),
        spd = def.speed * (toP > 9 ? 1.4 : 1),
        px = b.x,
        pz = b.z;
      const [nx, nz] = x.map.move(b.x, b.z, def.rad * 0.8, Math.sin(a) * spd * dt, Math.cos(a) * spd * dt, false);
      b.x = nx;
      b.z = nz;
      const moved = Math.hypot(nx - px, nz - pz);
      b.stuck = moved < spd * dt * 0.35 ? b.stuck + dt : 0;
      if ((b.stuck > 1.2 && toP > 6) || toP > 28) {
        // atascado o muy lejos: se recoloca junto al jugador
        const [fx, fz] = x.map.findFree(p.x + Math.sin(b.orbit) * 2.2, p.z + Math.cos(b.orbit) * 2.2, 4, def.rad);
        x.fx.burst(b.x, 1, b.z, 8, { color: 0x46e4ff, speed: 3, life: 0.35, size: 0.12, up: 1 });
        b.x = fx;
        b.z = fz;
        b.stuck = 0;
      }
      anim = "walk";
      rate = Math.min(1.8, Math.max(0.8, spd / 3.2));
      mxTurnTo(b, a, dt, 8);
    }
    void far;
  }
  if (b.tgt && def.range) {
    const a = Math.atan2(b.tgt.x - b.x, b.tgt.z - b.z);
    if (def.ai !== "robot" || anim !== "walk") mxTurnTo(b, a, dt, def.ai === "turret" ? 12 : 9);
    b.cd -= dt;
    if (b.cd <= 0 && Math.abs(fi(b.face, a)) < 0.5) {
      b.cd = def.cd;
      mxShoot(b, b.tgt);
    }
    firing = true;
  }
  if (firing) anim = anim === "walk" ? "walk" : "attack";
  // el modelo
  const m = b.model;
  if (m) {
    m.root.position.set(b.x, b.y || 0, b.z);
    m.update(dt, b.face, anim, rate);
    // parpadeo con poca batería
    if (b.t < MXC.lowS) m.root.visible = Math.sin(x.time * (b.t < MXC.lowS * 0.5 ? 22 : 11)) > -0.35;
  } else if (b.root) b.root.position.set(b.x, b.y || 0, b.z);
  mxTagUpdate(b);
}
// pose y aspecto de las carcasas: la animación de caída corre ~2 s y luego se queda congelada; después se disuelve
function mxStepHusk(b, dt) {
  b.huskT -= dt;
  if (b.fall > 0 && b.model) {
    b.fall -= dt;
    b.model.update(dt, b.face, null);
    if (b.fall <= 0 && !b.grey) {
      b.grey = true;
      mxSwapModel(b, false); // ya en el suelo: se apaga el brillo (pose caída, tono gris)
    }
  }
  b.fxT -= dt;
  if (b.fxT <= 0) {
    b.fxT = 0.5 + Q() * 0.5;
    b.huskT > 3 && x.fx.zap(b.x, b.z, b.x + (Q() - 0.5) * 1.8, b.z + (Q() - 0.5) * 1.8, 0xffb340, 0.5 + Q());
    x.fx.smoke(b.x, 0.7, b.z, 1, 0x30343c, 0.5);
  }
  if (b.huskT < 1.2 && b.model) b.model.dissolve(Math.min(1, 1 - b.huskT / 1.2), 0x46e4ff);
  if (b.huskT <= 0) mxDispose(b);
}

// ═══ 6. MÁQUINAS ÚNICAS ════════════════════════════════════════════════════════════════════════════
// ── recompensas ──
function mxGiveEquip(at, lvl, minR, epicP, ox = 0) {
  const R = Q() < epicP ? Math.max(3, minR) : minR;
  const piece = us(Math.max(1, lvl + 1), { minR: R, luck: 0 });
  Nt("item", at.x + ox, at.z + 0.6, { item: piece, life: 900 });
  return piece;
}
function mxGiveLore(reg) {
  const A = x.loreApi;
  if (!A || typeof A.next !== "function") return null;
  try {
    const id = A.next(undefined, reg) || A.next();
    // en silencio: el lector no se abre en mitad de un tiroteo; el documento queda en el Archivo (L)
    if (id && A.grant(id, { src: "maquina", quiet: true })) {
      const e = typeof A.get === "function" ? A.get(id) : null;
      ee("toast", `Archivo: documento recuperado${e && e.t ? ` · «${e.t}»` : ""} (tecla L)`, "good");
      return id;
    }
  } catch (err) {
    console.warn("máquinas: lore", err);
  }
  return null;
}
function mxGiveChip(at, lvl) {
  try {
    const chip = xi(Math.max(1, lvl + 1), { minT: 3 });
    Ts(chip, { silent: false });
    return chip;
  } catch (err) {
    return null;
  }
}
function mxGiveMats(at, lvl, rich) {
  Nt("mat", at.x - 0.6, at.z - 0.4, { mat: "data", val: rich ? 4 : 2 });
  Nt("mat", at.x + 0.6, at.z - 0.4, { mat: Q() < 0.5 ? "core" : "battery", val: rich ? 2 : 1 });
  Nt("cr", at.x, at.z - 0.9, { val: Math.round((rich ? 40 : 24) * mt.credits(lvl)) });
}
function mxLootBeacon(pod) {
  const def = pod.def,
    r = Q(),
    lvl = pod.lvl,
    out = [];
  if (r < def.equipP) out.push(mxGiveEquip(pod, lvl, def.minR, def.epicP));
  else if (r < def.equipP + def.loreP) {
    const id = mxGiveLore(pod.reg);
    id ? out.push("lore") : out.push(mxGiveEquip(pod, lvl, def.minR, def.epicP));
  } else {
    out.push(mxGiveEquip(pod, lvl, def.minR, def.epicP, -0.6));
    mxGiveChip(pod, lvl) && out.push("módulo");
  }
  mxGiveMats(pod, lvl, false);
  ee("toast", "Cápsula de suministros abierta: recoge lo que ha dejado.", "good");
  return out;
}
function mxLootLift(b) {
  const def = b.def,
    lvl = x.world.lvlAt(b.x, b.z),
    n = def.items[0] + (Q() < 0.5 ? 1 : 0),
    at = { x: b.x, z: b.z + 0.4 },
    out = [];
  for (let i = 0; i < n; i++) out.push(mxGiveEquip(at, lvl, def.minR, def.epicP, (i - (n - 1) / 2) * 0.9));
  Q() < def.chipP && mxGiveChip(at, lvl);
  Q() < def.loreP && mxGiveLore(b.slot.reg);
  mxGiveMats(at, lvl, true);
  ee("toast", "El palé de carga ha llegado: recoge el contenido.", "good");
  return out;
}
// ── dron explorador ──
function mxPath(ax, az, bx, bz) {
  const map = mxMap();
  if (!map) return null;
  const n = map.w,
    N = n * n,
    sx = Math.floor(ax),
    sz = Math.floor(az),
    tx = Math.floor(bx),
    tz = Math.floor(bz);
  const prev = new Int32Array(N).fill(-2),
    q = new Int32Array(N);
  const x0 = Math.max(1, Math.min(sx, tx) - 55),
    x1 = Math.min(n - 2, Math.max(sx, tx) + 55),
    z0 = Math.max(1, Math.min(sz, tz) - 55),
    z1 = Math.min(n - 2, Math.max(sz, tz) + 55);
  let h = 0,
    t = 0,
    goal = -1;
  const s0 = sz * n + sx;
  prev[s0] = -1;
  q[t++] = s0;
  const ok = (i) => !Ua[map.ter[i]] && !map.blk[i];
  while (h < t) {
    const i = q[h++],
      X = i % n,
      Z = (i / n) | 0;
    if (Math.abs(X - tx) <= 1 && Math.abs(Z - tz) <= 1) {
      goal = i;
      break;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const qx = X + dx,
        qz = Z + dz;
      if (qx < x0 || qx > x1 || qz < z0 || qz > z1) continue;
      const j = qz * n + qx;
      if (prev[j] !== -2 || !ok(j)) continue;
      prev[j] = i;
      q[t++] = j;
    }
  }
  if (goal < 0) return null;
  const tiles = [];
  for (let i = goal; i !== -1; i = prev[i]) tiles.push([(i % n) + 0.5, ((i / n) | 0) + 0.5]);
  tiles.reverse();
  // se aligera: un punto cada 4 casillas y se tira de la cuerda mientras haya línea de visión
  const thin = tiles.filter((_, k) => k % 4 === 0 || k === tiles.length - 1);
  const out = [thin[0]];
  let k = 0;
  while (k < thin.length - 1) {
    let j = thin.length - 1;
    while (j > k + 1 && !map.los(thin[k][0], thin[k][1], thin[j][0], thin[j][1])) j--;
    out.push(thin[j]);
    k = j;
  }
  return out;
}
function mxGuideTarget(b) {
  const map = mxMap(),
    S = x.S,
    reg = b.slot.reg,
    W = S.world,
    out = [];
  for (const e of map.ents) {
    let w = 0,
      what = "";
    if (e.k === "lore") {
      if (x.loreApi && e.lid && !x.loreApi.has(e.lid)) {
        w = 2.5;
        what = "un documento sin recuperar";
      }
    } else if (e.k === "terminal" && e.eff === "secret") {
      if (!W.secrets[e.id]) {
        w = 3;
        what = "una cámara oculta";
      }
    } else if (e.k === "terminal" && e.eff === "cache") {
      if (!x.world.termDone(e)) {
        w = 2;
        what = "una cámara acorazada";
      }
    } else if (e.k === "datapad") {
      if (!x.world.dpTaken(e)) {
        w = 1;
        what = "un datáfono abandonado";
      }
    }
    if (!w || map.regAt(e.x, e.z) !== reg) continue;
    const d = Le(e.x, e.z, b.x, b.z);
    if (d < 12 || d > MXC.single.guia.maxDist) continue;
    out.push({ e, w, what, d, score: w / (40 + d) });
  }
  if (!out.length) return null;
  out.sort((a, c) => c.score - a.score);
  const pick = out[Math.min(out.length - 1, MX.rng.int(0, 2))];
  return { id: pick.e.id, x: pick.e.x, z: pick.e.z, what: pick.what, k: pick.e.k, ent: pick.e };
}
function mxGuideStart(b, lines, res) {
  const def = b.def,
    s = b.slot,
    S = mxS(),
    g = mxGuideTarget(b);
  if (!g) {
    // sin pistas que enseñar: no se gasta
    s.lock = x.time + 90;
    lines.push("El dron escanea el sector y <b>no encuentra pistas nuevas</b> por aquí. Vuelve cuando hayas avanzado.");
    return false;
  }
  let path = mxPath(b.x, b.z, g.x, g.z);
  path = path && path.length > 1 ? path : [[b.x, b.z], [g.x, g.z]];
  s.st = "used";
  S.stats.guia++;
  b.mode = "guide";
  b.guide = { tgt: g, path, i: 1, T: 0, wait: 0, arrived: false, doneT: 0 };
  mxSwapModel(b, true);
  b.y = def.fly;
  lines.push(`El dron explorador despega: sígueme hasta <b>${ke(g.what)}</b> (≈ ${Math.round(g.ent ? Le(g.x, g.z, b.x, b.z) : 0)} m)`);
  ee("toast", "El dron explorador te guía: no te alejes demasiado de él.", "quest");
  hkSfx("hkCtl");
  MX.lastGuide = { id: s.id, tgt: g, path };
  return true;
}
function mxGuideEnd(b, ok) {
  if (b.mode === "gone") return;
  b.mode = "gone";
  try {
    x.fx.burst(b.x, b.y || 1, b.z, 16, { color: 0xffd447, speed: 3, life: 0.5, size: 0.16, up: 1 });
    x.fx.text(b.x, (b.y || 1) + 1, b.z, ok ? "MISIÓN CUMPLIDA" : "BATERÍA AGOTADA", "#ffd447", 13, { life: 1.6 });
  } catch (e) {
    /* sin efecto */
  }
  if (!ok) ee("toast", "El dron explorador se ha quedado sin batería.", "warn");
  b.huskT = 0.5;
  b.model && b.model.dissolve && b.model.dissolve(0.6, b.def.col);
}
function mxGuideReveal(g) {
  const S = mxS();
  (S.rev || (S.rev = {}))[g.id] = { x: g.x, z: g.z, k: g.k };
}
function mxStepGuide(b, dt) {
  const g = b.guide,
    def = b.def,
    p = x.player;
  g.T += dt;
  const dp = Le(b.x, b.z, p.x, p.z);
  if (dp > def.maxDist || g.T > def.waitS + g.path.length * 3) return mxGuideEnd(b, false);
  let moving = false;
  if (!g.arrived) {
    const wp = g.path[Math.min(g.i, g.path.length - 1)],
      dw = Le(b.x, b.z, wp[0], wp[1]);
    if (dp <= def.lead) {
      if (dw < 0.7) {
        g.i++;
        if (g.i >= g.path.length) g.arrived = true;
      } else {
        const a = Math.atan2(wp[0] - b.x, wp[1] - b.z),
          spd = def.speed * (dp < 5 ? 0.75 : 1);
        b.x += Math.sin(a) * spd * dt;
        b.z += Math.cos(a) * spd * dt;
        mxTurnTo(b, a, dt, 6);
        moving = true;
      }
    } else {
      g.wait += dt;
      b.fxT -= dt;
      if (b.fxT <= 0) {
        b.fxT = 1.2;
        x.fx.ring(b.x, b.z, 1.5, def.col, 0.6, 2);
      }
    }
  } else {
    // en destino: espera a que el jugador llegue
    const dt2 = Le(p.x, p.z, g.tgt.x, g.tgt.z);
    b.fxT -= dt;
    if (b.fxT <= 0) {
      b.fxT = 1;
      x.fx.ring(g.tgt.x, g.tgt.z, 2.2, def.col, 0.9, 2);
    }
    if (dt2 < def.doneR + 3 && !g.shown) {
      g.shown = true;
      mxGuideReveal(g.tgt);
      x.fx.ring(g.tgt.x, g.tgt.z, 5, def.col, 1.4, 3);
      x.fx.text(g.tgt.x, 2.6, g.tgt.z, "AQUÍ", "#ffd447", 18, { life: 2 });
      ae.play("success");
      ee("toast", `Dron explorador: ${g.tgt.what} aquí cerca. Busca a tu alrededor.`, "good");
    }
    if (g.shown) {
      g.doneT += dt;
      if (g.doneT > 9) return mxGuideEnd(b, true);
    }
  }
  b.y = def.fly + Math.sin(x.time * 3 + b.uid) * 0.14;
  if (moving) {
    b.fxT -= dt;
    if (b.fxT <= 0) {
      b.fxT = 0.22;
      x.fx.burst(b.x, b.y - 0.2, b.z, 2, { color: def.col, speed: 0.4, life: 0.9, size: 0.12, up: 0.1 });
    }
  }
  if (b.model) {
    b.model.root.position.set(b.x, b.y, b.z);
    b.model.update(dt, b.face, moving ? "walk" : "idle", 1);
  }
}
// ── baliza de suministros ──
function mxProcPod() {
  const g = new Ve();
  const body = new Ge(Ye(0.55, 0.55, 1.5, 8), de(0x3c4350, { k: "metal" })),
    nose = new Ge(Wn(0.55, 0.7, 8), de(0x5a6270, { k: "metal" })),
    band = new Ge(Ye(0.57, 0.57, 0.16, 8), Me(0x46e4ff, 0.95, true)),
    lid = new Ge(Je(0.7, 0.08, 0.7), de(0x6a7380, { k: "metal" }));
  body.position.y = 0.75;
  nose.position.y = 1.85;
  nose.rotation.x = 0;
  band.position.y = 1.0;
  lid.position.y = 1.52;
  g.add(body, nose, band, lid);
  g.userData = { lid, nose };
  return g;
}
function mxBeaconStart(b, lines) {
  const def = b.def,
    s = b.slot,
    S = mxS();
  s.st = "used";
  S.stats.baliza++;
  b.mode = "beacon";
  b.t = def.dropS;
  b.fxT = 0;
  const old = b.root;
  b.mesh = mxProcBeacon(true);
  b.root = b.mesh;
  b.root.scale.setScalar(def.scale * 0.7);
  b.root.position.set(b.x, 0, b.z);
  b.root.rotation.y = b.face;
  x.R.scene.add(b.root);
  old && (x.R.scene.remove(old), mxFreeMesh(old));
  lines.push(`Señal enviada: la cápsula de suministros llega en <b>${def.dropS} s</b>. No te alejes.`);
  hkSfx("hkCtl");
  x.fx.ring(b.x, b.z, 3, def.col, 1.2, 3);
}
function mxDropPod(b) {
  const def = b.def,
    a = Q() * 6.28;
  const [px, pz] = x.map.findFree(b.x + Math.cos(a) * 4, b.z + Math.sin(a) * 4, 5, 0.9);
  const pod = { k: "pod", x: px, z: pz, y: 36, vy: -6, t: 0, st: "fall", def, lvl: x.world.lvlAt(b.x, b.z), reg: b.slot.reg, mesh: mxProcPod(), rest: 0 };
  pod.mesh.position.set(px, pod.y, pz);
  x.R.scene.add(pod.mesh);
  MX.fxs.push(pod);
  x.fx.telegraph(px, pz, 2.4, 1.8, 0x46e4ff);
  ee("toast", "¡Cápsula en descenso!", "quest");
}
function mxStepPod(pod, dt) {
  pod.t += dt;
  if (pod.st === "fall") {
    pod.vy -= 38 * dt;
    pod.y += pod.vy * dt;
    x.fx.burst(pod.x, pod.y + 1.8, pod.z, 1, { color: 0xffb340, speed: 0.6, life: 0.5, size: 0.3, up: 0.2 });
    if (pod.y <= 0) {
      pod.y = 0;
      pod.st = "open";
      pod.rest = 0;
      x.fx.explosion(pod.x, pod.z, 2.6, 0x46e4ff);
      x.fx.smoke(pod.x, 0.6, pod.z, 6, 0x6a7380, 0.8);
      ae.play("metal", { gap: 0.05 });
    }
    pod.mesh.position.y = pod.y;
  } else if (pod.st === "open") {
    pod.rest += dt;
    pod.mesh.userData.lid.position.y = 1.52 + Math.min(1.1, pod.rest * 1.6);
    pod.mesh.userData.lid.rotation.z = Math.min(1.2, pod.rest * 1.7);
    if (pod.rest > 0.8) {
      pod.st = "rest";
      pod.rest = 0;
      mxLootBeacon(pod);
    }
  } else {
    pod.rest += dt;
    pod.rest > 16 && ((pod.st = "gone"), x.R.scene.remove(pod.mesh), mxFreeMesh(pod.mesh));
  }
}
function mxStepBeacon(b, dt) {
  const def = b.def;
  if (b.mode === "beacon") {
    b.t -= dt;
    b.fxT -= dt;
    if (b.fxT <= 0) {
      b.fxT = 0.55;
      x.fx.ring(b.x, b.z, 2.6 + (1 - b.t / def.dropS) * 4, def.col, 0.55, 2);
    }
    if (b.t <= 0) {
      mxDropPod(b);
      b.mode = "spent";
      b.huskT = 45;
    }
  }
}
// ── ascensor de carga ──
function mxLiftStart(b, lines) {
  const def = b.def,
    s = b.slot,
    S = mxS();
  s.st = "used";
  S.stats.ascensor++;
  b.mode = "lift";
  b.t = def.riseS;
  b.opened = false;
  const old = b.root;
  b.mesh = mxProcLift(true);
  b.root = b.mesh;
  b.root.scale.setScalar(def.scale * 0.7);
  b.root.position.set(b.x, 0, b.z);
  b.root.rotation.y = b.face;
  x.R.scene.add(b.root);
  old && (x.R.scene.remove(old), mxFreeMesh(old));
  lines.push(`El ascensor de carga se pone en marcha: el palé sube en <b>${def.riseS} s</b>.`);
  hkSfx("hkCtl");
}
function mxStepLift(b, dt) {
  const def = b.def,
    U = b.mesh.userData;
  if (b.mode !== "lift") return;
  b.t -= dt;
  const f = Math.max(0, Math.min(1, 1 - b.t / def.riseS)),
    open = Math.max(0, Math.min(1, f / 0.25)),
    up = Math.max(0, Math.min(1, (f - 0.2) / 0.8)),
    e = 1 - (1 - up) * (1 - up);
  U.hl.position.x = -0.725 - open * 1.5;
  U.hr.position.x = 0.725 + open * 1.5;
  U.car.visible = f > 0.2;
  U.car.position.y = -2.8 + e * 2.95;
  b.fxT -= dt;
  if (b.fxT <= 0) {
    b.fxT = 0.18;
    const a = Q() * 6.28;
    x.fx.burst(b.x + Math.cos(a) * 2, 0.3, b.z + Math.sin(a) * 2, 2, { color: 0x8a7a5a, speed: 1, life: 0.7, size: 0.35, up: 0.4 });
  }
  if (b.t <= 0 && !b.opened) {
    b.opened = true;
    mxLootLift(b);
    x.fx.ring(b.x, b.z, 4, def.col, 1, 3);
    ae.play("success");
    b.mode = "spent";
    b.huskT = 60;
  }
}
function mxStepSpent(b, dt) {
  b.huskT -= dt;
  b.huskT <= 0 && mxDispose(b);
}

// ═══ 7. BUCLE: CARGA, ACTUALIZACIÓN Y RELEVO ═══════════════════════════════════════════════════════
{
  const st = document.createElement("style");
  st.textContent = `.mx-tag{position:absolute;left:0;top:0;pointer-events:none;z-index:6;font:700 10px var(--f-disp);letter-spacing:.09em;text-transform:uppercase;color:#c4f7ff;text-shadow:0 0 7px rgba(70,228,255,.75),0 1px 2px #000;white-space:nowrap;text-align:center}
.mx-tag i{display:block;width:46px;height:4px;margin:2px auto 0;background:rgba(0,0,0,.6);border:1px solid rgba(70,228,255,.65);position:relative;overflow:hidden}
.mx-tag i::after{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--p,100%);background:#46e4ff;box-shadow:0 0 6px #46e4ff}
.mx-tag.low{color:#ffe3b0}.mx-tag.low i::after{background:#ffb340;box-shadow:0 0 6px #ffb340}
.mx-tag.crit{color:#ffc0c6;animation:mxBlink .5s steps(2) infinite}.mx-tag.crit i::after{background:#ff4f5e;box-shadow:0 0 6px #ff4f5e}
@keyframes mxBlink{50%{opacity:.35}}
body.touch .mx-tag{font-size:9px}`;
  document.head.appendChild(st);
}
// ¿está ese hueco lo bastante cerca como para montarlo?
function mxLoadStep() {
  const p = x.player,
    S = mxS(),
    clock = mxClock();
  for (const s of Object.values(S.slots)) {
    // relevo: la máquina agotada reaparece dormida en otro sitio
    if (s.st === "cool" && clock >= s.cd) {
      const old = MX.body.get(s.id);
      old && old.mode === "husk" && mxDispose(old);
      mxRelocate(s);
    }
    const b = MX.body.get(s.id);
    if (s.st === "used" || s.st === "cool") continue;
    if (x.mode !== "world") continue;
    const d = Le(s.x, s.z, p.x, p.z);
    if (!b && s.st === "dormant" && d < MXC.loadR) {
      // la casilla puede haber cambiado (otra generación del mundo): si ya no es válida, se recoloca
      const map = mxMap();
      if (map && !mxFree(map, Math.floor(s.x), Math.floor(s.z))) {
        mxRelocate(s);
        continue;
      }
      mxBuildBody(s);
    } else if (b && b.mode === "dormant" && d > MXC.unloadR) mxDispose(b);
  }
}
// al cambiar de mapa (mundo ↔ zona): las aliadas móviles te siguen; el resto se esconde hasta que vuelvas
function mxBlink(b) {
  const p = x.player,
    [fx, fz] = x.map.findFree(p.x + Math.cos(b.orbit) * 2.2, p.z + Math.sin(b.orbit) * 2.2, 5, b.def.rad || 0.5);
  b.x = fx;
  b.z = fz;
  b.root && b.root.position.set(b.x, b.y || 0, b.z);
}
function mxMapChanged() {
  const world = x.mode === "world";
  for (const b of MX.body.values()) {
    if (!b.root) continue;
    if (world) b.root.visible = true;
    else if (b.mode === "active" && b.def.ai !== "turret") {
      b.root.visible = true;
      mxBlink(b);
    } else b.root.visible = false;
    if (b.mode === "dormant" && !world) b.root.visible = false;
  }
}
function mxTipTick() {
  if (MX.tip) return;
  const S = x.S;
  if (!S) return;
  S.seenTips || (S.seenTips = {});
  if (S.seenTips.machine) return (MX.tip = true);
  for (const b of MX.body.values()) {
    if (b.mode === "dormant" && Le(b.x, b.z, x.player.x, x.player.z) < 20) {
      S.seenTips.machine = 1;
      MX.tip = true;
      ee("toast", Tt.touchMode ? "Máquina inactiva: acércate y toca HACKEAR para reactivarla." : "Máquina inactiva: acércate y pulsa V para hackearla y que te ayude unos minutos.", "quest");
      return;
    }
  }
}
function mxFxStep(dt) {
  for (let i = MX.fxs.length - 1; i >= 0; i--) {
    const f = MX.fxs[i];
    if (f.k === "pod") mxStepPod(f, dt);
    if (f.st === "gone") MX.fxs.splice(i, 1);
  }
}
x.tick.push((dt) => {
  if (!x.S || !x.started || !x.player) return;
  const S = mxS();
  if (!S) return;
  if (MX.map !== x.map) {
    MX.map = x.map;
    mxMapChanged();
  }
  if (!S.init && x.mode === "world" && mxInitSlots()) ee("save");
  MX.t -= dt;
  if (MX.t <= 0) {
    MX.t = 0.4;
    if (S.init) {
      mxLoadStep();
      mxTipTick();
      mxRevCheck();
    }
  }
  for (const b of [...MX.body.values()]) {
    if (b.dead) continue;
    if (b.mode === "active") mxStepActive(b, dt);
    else if (b.mode === "husk") mxStepHusk(b, dt);
    else if (b.mode === "guide") mxStepGuide(b, dt);
    else if (b.mode === "beacon") mxStepBeacon(b, dt);
    else if (b.mode === "lift") mxStepLift(b, dt);
    else if (b.mode === "spent" || b.mode === "gone") mxStepSpent(b, dt);
    else if (b.mode === "dormant" && x.mode === "world") mxStepDormant(b, dt);
  }
  mxFxStep(dt);
});
// una máquina dormida chisporrotea de vez en cuando y deja un halo ámbar en el suelo (se ve desde lejos)
function mxStepDormant(b, dt) {
  const d = Le(b.x, b.z, x.player.x, x.player.z);
  if (d > 36) return;
  x.fx.halo && x.fx.halo(b.x, b.z, b.u ? 1.4 : 1.0, b.u ? 0xffd447 : 0xffb340, 0.22 + 0.1 * Math.sin(x.time * 2 + b.uid), 2);
  b.fxT -= dt;
  if (b.fxT <= 0) {
    b.fxT = 1.4 + Q() * 2.4;
    x.fx.zap(b.x, b.z, b.x + (Q() - 0.5) * 1.6, b.z + (Q() - 0.5) * 1.6, b.u ? 0xffd447 : 0xffb340, 0.5 + Q() * 0.6);
  }
}
// las pistas reveladas por el dron explorador se borran al resolverse
function mxRevCheck() {
  const S = mxS(),
    W = x.S.world;
  if (!S.rev) return;
  for (const id of Object.keys(S.rev)) {
    const r = S.rev[id];
    let done = false;
    if (r.k === "terminal") done = !!W.secrets[id] || !!W.term[id];
    else if (r.k === "lore") done = !!(x.loreApi && x.loreApi.has(id)) || (x.world && x.world.map && !x.world.map.ents.some((e) => e.id === id && e.k === "lore"));
    else if (r.k === "datapad") done = !!(x.world && x.world.dpTaken && x.world.map.ents.some((e) => e.id === id && x.world.dpTaken(e)));
    if (done) delete S.rev[id];
  }
}
It("toMenu", () => {
  for (const b of [...MX.body.values()]) mxDispose(b);
  for (const f of MX.fxs) f.mesh && (x.R.scene.remove(f.mesh), mxFreeMesh(f.mesh));
  MX.fxs.length = 0;
  MX.act.length = 0;
  MX.map = null;
  MX.tip = false;
});
It("playerDied", () => {
  for (const b of [...MX.act]) mxShutdown(b, "muerte");
});

// ═══ 8. MINIMAPA, DIARIO Y PRUEBAS ═════════════════════════════════════════════════════════════════
function mxPing(c, size, s, px, pz, col, big, ring) {
  const pl = x.player,
    R = size / 2 / s - 3,
    dx = px - pl.x,
    dz = pz - pl.z,
    d = Math.hypot(dx, dz),
    ph = (x.time * 0.9) % 1;
  let X = px,
    Z = pz;
  if (d > R) {
    X = pl.x + (dx / d) * R;
    Z = pl.z + (dz / d) * R;
  }
  c.save();
  c.fillStyle = col;
  c.strokeStyle = col;
  c.lineWidth = 1.2 / s;
  if (ring) {
    c.globalAlpha = 1 - ph;
    c.beginPath();
    c.arc(X, Z, 1.6 + ph * 5, 0, 6.283);
    c.stroke();
    c.globalAlpha = 1;
  }
  const r = big ? 2 : 1.5;
  c.beginPath();
  c.moveTo(X, Z - r);
  c.lineTo(X + r, Z);
  c.lineTo(X, Z + r);
  c.lineTo(X - r, Z);
  c.closePath();
  c.fill();
  c.restore();
}
if (typeof ecoMinimapPings === "function") {
  const _emp = ecoMinimapPings;
  ecoMinimapPings = function (c, size, s) {
    _emp(c, size, s);
    if (x.mode !== "world" || !x.S || !x.S.mach || !x.player) return;
    const S = x.S.mach,
      p = x.player;
    for (const sl of Object.values(S.slots)) {
      if (sl.st !== "dormant" || Le(sl.x, sl.z, p.x, p.z) > 62) continue;
      mxPing(c, size, s, sl.x, sl.z, sl.u ? "#ffd447" : "#46e4ff", !!sl.u, false);
    }
    for (const b of MX.act) mxPing(c, size, s, b.x, b.z, "#8ff0ff", false, false);
    if (S.rev) for (const id of Object.keys(S.rev)) mxPing(c, size, s, S.rev[id].x, S.rev[id].z, "#ffd447", true, true);
  };
}
if (typeof ecoHitosHtml === "function") {
  const _hh = ecoHitosHtml;
  ecoHitosHtml = function () {
    const M = mxS();
    if (!M || !M.init) return _hh();
    const st = M.stats,
      used = Object.values(M.slots).filter((s) => s.u && s.st === "used").length,
      all = Object.values(M.slots).filter((s) => s.u).length;
    return `<div class="eco-sum"><span><b style="color:#46e4ff">${st.act | 0}</b> máquinas reactivadas · <b>${st.guia | 0}</b> drones exploradores · <b>${st.baliza | 0}</b> balizas · <b>${st.ascensor | 0}</b> ascensores · <b style="color:#ffd447">${used}</b> de ${all} sistemas únicos usados</span></div>` + _hh();
  };
}
window.__mach = {
  cfg: MXC,
  MX,
  state: mxS,
  slots: () => Object.values(mxS().slots),
  init: mxInitSlots,
  spot: mxSpot,
  build: (slot) => mxBuildBody(typeof slot === "string" ? mxS().slots[slot] : slot),
  body: (id) => MX.body.get(id),
  bodies: () => [...MX.body.values()],
  spec: mxSpec,
  hackDone: mxHackDone,
  activate: (b, res) => {
    const lines = [];
    mxActivate(b, res || { riesgo: 1, traza: 0 }, lines);
    return lines;
  },
  shutdown: mxShutdown,
  scan: mxScan,
  path: mxPath,
  guideTarget: mxGuideTarget,
  relocate: mxRelocate,
  newSlot: (k, reg, x0, z0) => mxNewSlot(k, reg, { x: x0, z: z0 }),
  dispose: mxDispose,
  migrate: mxMigrate,
  tagUpdate: mxTagUpdate,
};

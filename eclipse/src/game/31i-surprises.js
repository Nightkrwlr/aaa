// 31i-surprises.js — Sorpresas: Eclipses, Némesis, pactos, asedio del Bastión y contratos dinámicos (D10)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// El mundo deja de ser predecible. Cinco sorpresas que rompen la rutina de «ir de zona en zona matando»:
//
//   A. ECLIPSES — de vez en cuando (la primera a los ~25 min de juego, luego cada 50-80 min) el cielo se apaga. Hay un PRESAGIO de 40 s
//      (el cielo se oscurece y ARGOS avisa), y después el ECLIPSE (170 s): llegan élites «eclipsadas» (una mecánica propia: pulsos de sombra),
//      más botín, y un HERALDO DEL ECLIPSE (campeón). Matarlo rompe el Eclipse y suelta un Fragmento de Eclipse, el material que exige
//      ascender una pieza Épica a Legendaria (31a-economy.js: ecoGrantFragment). Las élites corrientes sueltan un Fragmento con poca
//      probabilidad. Mientras dura, los jefes sueltan más botín (reliquias ×1,5 en 31g-bosses.js y una tirada extra).
//   B. NÉMESIS — el enemigo que te mata «asciende»: recibe nombre, rango y modificadores y se lleva lo que perdiste en el traslado
//      (créditos) y una parte de tus materiales. Tras unos minutos te encuentra y te caza. Si lo abates lo recuperas con intereses; si
//      te mata otra vez, sube de rango y se lleva más. Hasta tres Némesis a la vez.
//   C. SANTUARIOS DE PACTO — uno de los tres santuarios «xeno» de cada región es un santuario de pacto: ofrece tres tratos (poder a
//      cambio de una maldición) que duran un rato y se rehacen cada media hora de juego.
//   D. ASEDIO DEL BASTIÓN — cada cierto tiempo, una horda ataca el Bastión (avisa antes). Las torretas y los muros se defienden solos
//      un poco, pero las trampas y las minas (gadgets) y tú marcáis la diferencia. Se gana botín y «medallas» del Bastión, y las mejoras
//      de la base (torretas, muros, taller, enfermería…) se pagan con trofeos.
//   E. CONTRATOS DINÁMICOS — el Tablón ofrece contratos que dependen de lo que pasa en el mundo (Némesis vivos, Eclipse próximo, asedio…).
//
// Contrato con el resto del juego (todo son envoltorios; no cambia la generación del mundo ni consume su RNG):
//   · Guardado: S.sx = { v: 1, ecl, nem, pact, siege, base, con } (migración idempotente en x.migrations).
//   · Eventos nuevos: ee('eclipse', fase), ee('nemesis', 'rise'|'hunt'|'slain', nem), ee('pact', 'sealed'|'ended', pacto), ee('siege', fase).
//   · Datos: x.cfg.eclipse, x.cfg.nemesis, x.cfg.pact, x.cfg.siege, x.cfg.baseUp, x.cfg.contracts. Pruebas: window.__sx.

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 0 · Datos, estado e infraestructura común
// ═══════════════════════════════════════════════════════════════════════════════════════════

x.cfg.eclipse = {
  firstS: 1500, // el primer Eclipse llega a los 25 min de juego…
  gapS: [3000, 4800], // …y los siguientes cada 50-80 min
  retryS: 12, // si toca pero no se puede empezar (refugio, jefe, interior…) lo reintenta cada tanto
  minLvl: 6,
  omenS: 40, // presagio: el cielo se oscurece
  durS: 170, // duración del Eclipse
  endS: 8, // el cielo se despeja
  maxAlive: 6, // élites eclipsadas vivas a la vez
  spawnS: [4.5, 7.5], // segundos entre apariciones
  ring: [14, 25], // distancia al jugador a la que aparecen
  lvlPlus: 1, // nivel del enemigo = nivel del mundo + esto
  hpMul: 1.25,
  dmgMul: 1.15,
  spdMul: 1.08,
  pulse: { every: [5.5, 8], r: 3.2, warn: 0.9, dmg: 0.7, col: 0x7a3cc8 }, // «pulso de sombra» de las élites eclipsadas
  heraldo: { atS: 7, hpMul: 1, dmgMul: 1.2, lvlPlus: 2, frag: 1, xp: 0.1, name: "Heraldo del Eclipse" },
  fragP: 0.05, // probabilidad de que una élite corriente suelte un Fragmento (como mucho `fragCap` por Eclipse)
  fragCap: 1,
  bossLootMul: 1.5, // reliquias de jefe ×1,5 mientras dura
  bossExtra: 1, // tiradas extra de la tabla de campeón al abatir un jefe en Eclipse
  sky: { fog: 0x2a0a30, sun: 0xd04c7c, hemi: 0x7a52a8, top: 0x14062a, glow: 0xff5a1a },
  // cuánto pesa el Eclipse en cada capa del aspecto: niebla/fondo, luz del sol (negativo = más luz que la luna), luz de hemisferio, saturación y velo de pantalla.
  // Medido contra la noche normal con capturas de `sorpresas-look`: se ve lo mismo que de noche, con la luz violeta-magenta en vez de azul
  look: { fog: 0.45, sun: -0.4, hemi: -0.05, sat: 0.08, veil: 0.3 },
};

x.cfg.nemesis = {
  minLvl: 4,
  listMax: 3, // Némesis vivos a la vez
  ranksMax: 5,
  delayS: [150, 240], // tiempo de juego (en el mundo) hasta que te encuentra tras reaparecer
  retryS: 90, // si le pierdes el rastro o se aleja, vuelve a buscarte pasado este tiempo
  leashR: 100, // más lejos que esto se queda atrás
  hpMul: [1.6, 2.0, 2.4, 2.8, 3.3],
  dmgMul: [1.15, 1.25, 1.35, 1.45, 1.6],
  spdMul: 1.05,
  mods: [1, 1, 2, 2, 3], // modificadores de élite por rango
  cut: { credits: 0.1, mats: 0.06, matsCap: 30 }, // créditos: los mismos que se pierden en el traslado; materiales: 6 % de cada tipo (tope)
  back: 1.25, // lo recuperado al abatirlo ×1,25
  xp: [0.05, 0.07, 0.09, 0.12, 0.16], // fracción de la barra de XP por rango
  names: [
    "Garra Negra", "El Destripador", "Viejo Tuerto", "Colmillo de Acero", "La Viuda", "Carroñero Rey", "Ojo Rojo", "El Silencioso",
    "Mandíbula", "Sangre Fría", "Cuervo", "Quebrantahuesos", "Hiel", "La Sombra Gris", "Cicatriz", "Nudillos", "Penumbra", "El Pariente",
  ],
  hearWindow: 8, // el último golpe recibido cuenta como «asesino» hasta 8 s antes de morir
  minLifeS: 90, // hay que haber vivido ≥ 90 s desde la última reaparición para que la muerte cree un Némesis (sin farmeo)
  riseCdS: 240, // y no se encadenan ascensos: como mucho uno cada 4 min de juego
};

// ── estado guardado ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// Todo el tiempo que se guarda es S.playTime (segundos de juego activo): no avanza en pausa y es monótono.
function sxFresh(S) {
  const t = (S && S.playTime) || 0,
    sg = x.cfg.siege;
  return {
    v: 1,
    ecl: { n: 0, heralds: 0, next: t + x.cfg.eclipse.firstS, st: "idle", t: 0, dur: 0, kills: 0, frag: 0, hera: 0 },
    nem: { list: [], seq: 0, slain: 0, deaths: 0 },
    pact: { act: [], used: {}, n: 0 },
    siege: { n: 0, won: 0, lost: 0, next: t + (sg ? sg.firstS : 2400), st: "idle", t: 0, wave: 0 },
    base: { lv: {}, spent: 0 },
    con: { seen: {} },
  };
}
function sxMigrate(S) {
  if (!S.sx || S.sx.v !== 1) S.sx = sxFresh(S);
  const q = S.sx,
    f = sxFresh(S);
  // por si el guardado quedó a medias (una clave nueva en una versión posterior): se completa sin tocar lo existente
  for (const k in f) if (!q[k]) q[k] = f[k];
  for (const k in f.ecl) if (q.ecl[k] === undefined) q.ecl[k] = f.ecl[k];
  for (const k in f.nem) if (q.nem[k] === undefined) q.nem[k] = f.nem[k];
  for (const k in f.pact) if (q.pact[k] === undefined) q.pact[k] = f.pact[k];
  for (const k in f.siege) if (q.siege[k] === undefined) q.siege[k] = f.siege[k];
  for (const k in f.base) if (q.base[k] === undefined) q.base[k] = f.base[k];
  for (const k in f.con) if (q.con[k] === undefined) q.con[k] = f.con[k];
}
x.migrations.push(sxMigrate);
function sxS() {
  const S = x.S;
  if (!S.sx || S.sx.v !== 1) sxMigrate(S);
  return S.sx;
}

// ── estado de ejecución (no se guarda) ───────────────────────────────────────────────────────────────────────────────────────
const SXR = {
  ui: null, // contenedor de las etiquetas del HUD
  veil: null, // velo oscuro de pantalla (Eclipse)
  pill: {},
  hudT: 0,
  k: 0, // fuerza del Eclipse en el cielo, 0..1
  hooked: false,
  ecl: { live: new Set(), heraldo: null, spawnT: 0, heraldoT: 0, pulses: [] },
};

const sxMs = (s) => {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
// ¿sigue ese enemigo en la partida? (al cambiar de mapa o reaparecer, la lista de enemigos se vacía sin avisar a quien lo guardó)
const sxAlive = (e) => !!e && !e.dead && x.enemies.includes(e);

// HUD: una columna de etiquetas bajo el reloj (dentro de #hTC, así las reglas táctiles de ese contenedor se aplican solas)
{
  const st = document.createElement("style");
  st.textContent = `#sxBar{display:flex;flex-direction:column;gap:3px;align-items:center;margin-top:4px;pointer-events:none;width:100%}
#sxBar .sxl{display:none;font:700 12px var(--f-disp);letter-spacing:.1em;text-transform:uppercase;padding:3px 10px;border:1px solid rgba(190,140,255,.55);background:rgba(18,6,34,.74);color:#e6d3ff;text-shadow:0 0 10px rgba(170,90,255,.6);max-width:100%;box-sizing:border-box;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sxBar .sxl.on{border-color:#c9a0ff;box-shadow:0 0 14px rgba(170,90,255,.45);animation:sxPulse 1.6s ease-in-out infinite}
#sxBar .sxl.bad{border-color:#ff6070;color:#ffd6da;background:rgba(40,6,12,.78);text-shadow:0 0 10px rgba(255,60,80,.6)}
#sxBar .sxl.good{border-color:#5dff9a;color:#d4ffe4;background:rgba(6,32,18,.78);text-shadow:none}
#sxBar .sxl.warn{border-color:#ffb340;color:#ffe9c0;background:rgba(40,26,6,.78);text-shadow:none}
@keyframes sxPulse{50%{box-shadow:0 0 24px rgba(190,110,255,.8)}}
#sxVeil{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 50% 46%,rgba(40,8,70,0) 28%,rgba(16,0,36,.5) 74%,rgba(4,0,12,.8) 100%)}
body.touch #sxBar{align-items:flex-start}
body.touch #sxBar .sxl{font-size:10px;padding:2px 6px;letter-spacing:.06em}
#sxBar .sxl .s{display:none}
@media (orientation:landscape) and (max-width:760px) and (max-height:520px){body.touch #sxBar .sxl .l{display:none}body.touch #sxBar .sxl .s{display:inline}}`;
  document.head.appendChild(st);
}
function sxUi() {
  if (SXR.ui) return SXR.ui;
  const tc = document.getElementById("hTC");
  if (!tc) return null;
  const bar = document.createElement("div");
  bar.id = "sxBar";
  const bb = document.getElementById("bossbar");
  bb ? tc.insertBefore(bar, bb) : tc.appendChild(bar);
  const hud = document.getElementById("hud");
  if (hud && hud.parentNode && !SXR.veil) {
    const v = document.createElement("div");
    v.id = "sxVeil";
    hud.parentNode.insertBefore(v, hud);
    SXR.veil = v;
  }
  return (SXR.ui = bar);
}
// etiqueta del HUD: `text` es el texto completo y `short` el que se ve en pantallas táctiles apaisadas muy estrechas (icono y cuenta)
function sxPill(key, text, cls, short) {
  const ui = SXR.ui;
  if (!ui) return;
  let el = SXR.pill[key];
  if (!el) {
    el = SXR.pill[key] = document.createElement("div");
    el.className = "sxl " + key;
    el.innerHTML = '<span class="l"></span><span class="s"></span>';
    el._l = el.firstChild;
    el._s = el.lastChild;
    ui.appendChild(el);
  }
  const c = text ? cls || "" : "";
  if (el._t !== text || el._c !== c || el._u !== short) {
    el._t = text;
    el._c = c;
    el._u = short;
    el.className = "sxl " + key + (c ? " " + c : "");
    el._l.textContent = text || "";
    el._s.textContent = (text && short) || text || "";
    el.style.display = text ? "block" : "none";
  }
}

// marca pulsante en el minimapa (con tope en el borde, igual que los hitos de 31a-economy.js)
function sxPing(c, size, s, px, pz, col, big) {
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
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineWidth = 1.2 / s;
  c.globalAlpha = 1 - ph;
  c.beginPath();
  c.arc(X, Z, 1.4 + ph * (big ? 6 : 4), 0, 6.283);
  c.stroke();
  c.globalAlpha = 1;
  c.beginPath();
  c.arc(X, Z, d > R ? 1.9 : 1.5, 0, 6.283);
  c.fill();
  c.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// A · ECLIPSES
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Fases: idle → omen (presagio) → on (Eclipse) → end (el cielo se despeja) → idle. El reloj del Eclipse solo corre en el mundo
// abierto (bajo tierra se congela). Las criaturas eclipsadas llevan el modificador «eclipsado» (violeta, no enumerable en Bd para que
// aa() no lo reparta entre las élites normales) y lanzan «pulsos de sombra» sobre tu posición.

Object.defineProperty(Bd, "eclipsado", { value: { n: "Eclipsado", c: 0xb86cff }, enumerable: false });
const SX_NOSPAWN = new Set(["nido", "torreta", "cristalino"]);

// El Eclipse pesa en las tablas de botín: una fuente propia entre la élite y el campeón
x.cfg.econ.rar.eclipse = [30, 40, 23, 6.7, 0.3, 0];
x.cfg.econ.drop.eclipse = { cr: [1, 7], mat: 4, tro: 1, perf: 0.1, mod: 0.35, plan: 0.05, hp: 0.2, gren: 0.12, med: 0.1, cap: 0.6 };
{
  const _src = ecoSrcOf;
  ecoSrcOf = function (n) {
    return n.eclE && !n.champion && !n.boss ? "eclipse" : _src(n);
  };
  Gp.fragmento = "Eclipses: lo suelta el Heraldo del Eclipse (y, rara vez, sus élites eclipsadas)";
}

function sxEclActive() {
  const q = x.S && x.S.sx;
  return !!q && q.ecl.st === "on";
}
// multiplicador de reliquias de jefe (lo lee 31g-bosses.js)
function sxBossMul() {
  return sxEclActive() ? x.cfg.eclipse.bossLootMul : 1;
}

function sxEclCanStart() {
  const S = x.S,
    pl = x.player;
  return x.mode === "world" && !pl.dead && S.lvl >= x.cfg.eclipse.minLvl && !x.bossActive && !x.inSafe && !x.inDark && !x.world.inBase() && !sxSiegeBusy();
}
function sxEclOmen() {
  const E = sxS().ecl,
    C = x.cfg.eclipse;
  Object.assign(E, { st: "omen", t: C.omenS, dur: C.omenS, kills: 0, frag: 0, hera: 0 });
  ee("banner", "EL CIELO SE APAGA", `ARGOS: alineamiento solar anómalo · Eclipse en ${C.omenS} s`, "#c9a0ff");
  ee("toast", "ARGOS: la señal bajo la Caldera se intensifica. Un Eclipse es inminente: prepárate o busca refugio.", "warn");
  ae.play("alarm");
  ee("eclipse", "omen");
}
function sxEclBegin() {
  const E = sxS().ecl,
    C = x.cfg.eclipse,
    R = SXR.ecl;
  Object.assign(E, { st: "on", t: C.durS, dur: C.durS });
  R.spawnT = 2;
  R.heraldoT = C.heraldo.atS;
  R.heraldo = null;
  R.pulses.length = 0;
  ee("banner", "ECLIPSE", "Abate al Heraldo para romper el Eclipse", "#c9a0ff");
  ae.play("roar");
  x.R.addShake(0.5);
  ee("eclipse", "on");
}
// fin del Eclipse: why = 'heraldo' | 'time' | 'dead' | 'debug'
function sxEclEnd(why) {
  const S = x.S,
    E = sxS().ecl,
    C = x.cfg.eclipse,
    R = SXR.ecl;
  if (E.st !== "on" && E.st !== "omen") return;
  const was = E.st;
  // las criaturas que quedan se desvanecen con la luz (sin botín ni XP)
  for (const e of R.live)
    if (!e.dead) {
      e.dead = true;
      e.deadT = 0.35;
      e.hp = 0;
      e.parent && e.parent.children--;
      x.fx.burst(e.x, 0.8, e.z, 10, { color: 0xb06cff, speed: 3, life: 0.5, size: 0.2, up: 1 });
    }
  R.live.clear();
  R.heraldo = null;
  R.pulses.length = 0;
  Object.assign(E, { st: "end", t: C.endS });
  if (was === "on") E.n++;
  E.next = S.playTime + C.gapS[0] + Q() * (C.gapS[1] - C.gapS[0]);
  const msg =
    why === "heraldo"
      ? `Eclipse roto · ${E.kills} criaturas abatidas${E.frag ? " · " + E.frag + (E.frag > 1 ? " Fragmentos" : " Fragmento") + " de Eclipse" : ""}`
      : why === "dead"
        ? "El Eclipse pasa sobre tu cuerpo… el cielo se despeja"
        : was === "omen"
          ? "El cielo vuelve a la normalidad"
          : `El Eclipse pasa · ${E.kills} criaturas abatidas · el Heraldo escapa`;
  ee("toast", msg, why === "heraldo" ? "good" : "warn");
  ee("eclipse", "end", why);
}

// punto libre en un anillo alrededor del jugador (misma región, fuera de refugios y zonas oscuras)
function sxSpot(r0, r1, tries = 14) {
  const pl = x.player,
    m = x.map,
    w = x.world;
  for (let i = 0; i < tries; i++) {
    const a = Q() * 6.2832,
      r = r0 + Q() * (r1 - r0),
      px = pl.x + Math.cos(a) * r,
      pz = pl.z + Math.sin(a) * r;
    if (m.circleHits(px, pz, 0.7) || w.safeAt(px, pz) || m.darkAt(px, pz) || m.regAt(px, pz) !== x.regionId) continue;
    return [px, pz];
  }
  return null;
}
// enemigos de la región que pueden aparecer sueltos (sin nidos, torretas ni sombras, que de noche no se ven)
function sxPool(reg, lvl) {
  const out = [];
  for (const e of (De[reg] || De[0]).enemies) {
    const d = gn[e[0]];
    if (!d || (e[2] || 0) > lvl || SX_NOSPAWN.has(e[0]) || d.ai === "spawner" || d.ai === "turret" || d.ai === "shadow") continue;
    out.push({ id: e[0], w: e[1] });
  }
  return out;
}

function sxEclSpawn(heraldo) {
  const C = x.cfg.eclipse,
    R = SXR.ecl,
    spot = sxSpot(heraldo ? C.ring[1] - 3 : C.ring[0], heraldo ? C.ring[1] + 5 : C.ring[1]);
  if (!spot) return null;
  const lvl = qe(x.world.lvlAt(spot[0], spot[1]) + (heraldo ? C.heraldo.lvlPlus : C.lvlPlus), 1, 62),
    pool = sxPool(x.regionId, lvl);
  if (!pool.length) return null;
  let id;
  if (heraldo) {
    const big = pool.filter((p) => !gn[p.id].fly).sort((a, b) => gn[b.id].hp - gn[a.id].hp);
    id = (big[0] || pool[0]).id;
  } else id = ii(pool).id;
  const [px, pz] = x.map.findFree(spot[0], spot[1], 3, 0.5),
    mods = heraldo
      ? ["eclipsado", "gigante"].concat(aa(lvl + 12, 1).filter((q) => q !== "gigante")).slice(0, 3)
      : ["eclipsado"].concat(aa(lvl, 0.45)).slice(0, 2),
    e = In(id, lvl, px, pz, {
      mods,
      alerted: true,
      persist: true,
      champion: !!heraldo,
      hpMul: heraldo ? C.heraldo.hpMul : C.hpMul,
      name: heraldo ? C.heraldo.name : undefined,
    });
  e.dmg *= heraldo ? C.heraldo.dmgMul : C.dmgMul;
  e.spd *= C.spdMul;
  e.eclE = true;
  if (heraldo) {
    e.eclHera = true;
    R.heraldo = e;
  }
  R.live.add(e);
  x.fx.burst(px, 0.6, pz, 14, { color: 0xb06cff, speed: 4, life: 0.6, size: 0.25, up: 1 });
  return e;
}

function sxEclTick(dt) {
  const S = x.S,
    E = sxS().ecl,
    C = x.cfg.eclipse,
    R = SXR.ecl,
    pl = x.player;
  if (x.mode !== "world") return; // bajo tierra el reloj se congela
  if (E.st === "idle") {
    if (S.playTime >= E.next) sxEclCanStart() ? sxEclOmen() : (E.next = S.playTime + C.retryS);
    return;
  }
  if (E.st === "end") {
    if ((E.t -= dt) <= 0) E.st = "idle";
    return;
  }
  if (pl.dead) return void sxEclEnd("dead");
  E.t -= dt;
  if (E.st === "omen") {
    if (E.t <= 0) sxEclBegin();
    return;
  }
  // E.st === "on"
  if (E.t <= 0) return void sxEclEnd("time");
  // los refugios (Bastión, campamentos) no se tocan: ahí no aparece nadie
  const open = !x.inSafe && !x.world.inBase() && !x.inDark;
  // las criaturas que ya no están en el mundo (cambio de mapa, reaparición, guardado cargado) se descartan; si el Heraldo se perdió así, vuelve a salir
  for (const e of R.live) sxAlive(e) || R.live.delete(e);
  if (E.hera === 1 && !sxAlive(R.heraldo)) {
    E.hera = 0;
    R.heraldo = null;
    R.heraldoT = 3;
  }
  if (open) {
    if (E.hera === 0 && (R.heraldoT -= dt) <= 0 && sxEclSpawn(true)) {
      E.hera = 1;
      ee("banner", "HERALDO DEL ECLIPSE", "Una presencia enorme se acerca", "#ff8aa8");
      ae.play("roar");
    }
    if ((R.spawnT -= dt) <= 0) {
      R.spawnT = C.spawnS[0] + Q() * (C.spawnS[1] - C.spawnS[0]);
      let alive = 0;
      for (const e of R.live) e.dead || e.eclHera || alive++;
      if (alive < C.maxAlive) sxEclSpawn(false);
    }
  }
  // pulsos de sombra
  for (const e of R.live) {
    if (e.dead) {
      R.live.delete(e);
      continue;
    }
    if ((e._sxP = (e._sxP ?? C.pulse.every[0] + Q() * 3) - dt) > 0) continue;
    const hv = !!e.eclHera;
    e._sxP = (C.pulse.every[0] + Q() * (C.pulse.every[1] - C.pulse.every[0])) * (hv ? 0.6 : 1);
    if (e.alerted && Le(e.x, e.z, pl.x, pl.z) < 16) {
      const r = C.pulse.r * (hv ? 1.5 : 1),
        px = pl.x + (pl.vx || 0) * 0.3,
        pz = pl.z + (pl.vz || 0) * 0.3;
      x.fx.telegraph(px, pz, r, C.pulse.warn, C.pulse.col);
      R.pulses.push({ x: px, z: pz, t: C.pulse.warn, r, dmg: e.dmg * C.pulse.dmg });
    }
  }
  for (let i = R.pulses.length - 1; i >= 0; i--) {
    const p = R.pulses[i];
    if ((p.t -= dt) > 0) continue;
    dn(p.x, p.z, p.r, p.dmg, { owner: "e", color: C.pulse.col, small: true });
    R.pulses[i] = R.pulses[R.pulses.length - 1];
    R.pulses.pop();
  }
}

// cielo: x.night / x.sunEl / x.twi los fija World.update; aquí se empujan hacia la noche (el renderer los lee después de los ticks)
// y, tras el update del renderer, se tiñen niebla, fondo, luces y cielo
const SX_COL = {};
function sxSkyInit() {
  const s = x.cfg.eclipse.sky;
  for (const k in s) SX_COL[k] = new Ee(s[k]);
}
function sxSkyApply(R, k) {
  const C = SX_COL,
    L = x.cfg.eclipse.look,
    u = R.sky.material.uniforms;
  R.scene.fog.color.lerp(C.fog, L.fog * k);
  R.scene.background.lerp(C.fog, L.fog * k);
  R.sun.color.lerp(C.sun, k);
  R.sun.intensity *= 1 - L.sun * k;
  R.hemi.color.lerp(C.hemi, 0.7 * k);
  R.hemi.intensity *= 1 - L.hemi * k;
  u.uTop.value.lerp(C.top, k);
  u.uGlow.value = Math.max(u.uGlow.value, 0.9 * k);
  u.uGlowCol.value.lerp(C.glow, k);
  u.uStar.value = Math.max(u.uStar.value, 0.9 * k);
  R.post.uniforms.uSat.value *= 1 - L.sat * k;
}
function sxHookRenderer() {
  const R = x.R;
  if (SXR.hooked || !R || !R.update || !R.sky) return;
  SXR.hooked = true;
  sxSkyInit();
  const upd = R.update;
  R.update = function (e, t, i, s, a) {
    const r = upd.call(this, e, t, i, s, a);
    if (SXR.k > 0.004) sxSkyApply(this, SXR.k);
    return r;
  };
}
function sxEclSky(dt) {
  const E = sxS().ecl,
    C = x.cfg.eclipse;
  let tgt = 0;
  if (x.mode === "world") {
    if (E.st === "omen") {
      const p = qe(1 - E.t / C.omenS, 0, 1);
      tgt = 0.4 * p * p * (3 - 2 * p);
    } else if (E.st === "on") tgt = 1;
  }
  SXR.k += (tgt - SXR.k) * Math.min(1, dt * (E.st === "on" ? 0.9 : 0.6));
  if (Math.abs(tgt - SXR.k) < 0.002) SXR.k = tgt;
  const k = SXR.k;
  if (k > 0.004 && x.mode === "world") {
    x.night = Math.max(x.night, Math.min(1, k * 1.2));
    x.sunEl = x.sunEl * (1 - k) - 0.2 * k;
    x.twi *= 1 - k;
  }
  if (SXR.veil) {
    const o = (x.cfg.eclipse.look.veil * k).toFixed(2);
    if (SXR.veil._o !== o) {
      SXR.veil._o = o;
      SXR.veil.style.opacity = o;
    }
  }
}

// hitos del Eclipse: élites corrientes (Fragmento raro, contratos) y Heraldo (Fragmento seguro, fin del Eclipse)
It("kill", (e) => {
  if (!e.eclE) return;
  const E = sxS().ecl,
    C = x.cfg.eclipse;
  SXR.ecl.live.delete(e);
  if (e.eclHera) {
    E.hera = 2;
    E.heralds = (E.heralds | 0) + 1;
    E.frag += C.heraldo.frag;
    ecoGrantFragment(C.heraldo.frag);
    ecoGrantXp(C.heraldo.xp, "Heraldo");
    for (const d of rollLoot("champion", e.lvl, { e })) ecoSpawn(d, { x: e.x, z: e.z, spd: 5 }, e.lvl, "champion");
    ee("banner", "HERALDO ABATIDO", "El Eclipse se rompe", "#c9a0ff");
    ae.play("legend");
    sxEclEnd("heraldo");
    return;
  }
  E.kills++;
  ht.bump((o) => o.t === "sx" && o.k === "eclipse");
  if (E.frag < C.fragCap && Q() < C.fragP) {
    E.frag++;
    ecoGrantFragment(1);
  }
});
It("bossKilled", (b) => {
  if (b.mini || !sxEclActive()) return;
  const C = x.cfg.eclipse;
  for (let i = 0; i < C.bossExtra; i++) for (const d of rollLoot("champion", b.lvl, { e: b })) ecoSpawn(d, { x: b.x, z: b.z, spd: 5 }, b.lvl, "champion");
  ee("toast", "Eclipse: el jefe suelta botín extra", "good");
});
It("playerDied", () => {
  const E = x.S && x.S.sx && x.S.sx.ecl;
  E && (E.st === "on" || E.st === "omen") && sxEclEnd("dead");
});

// HUD
function sxEclHud() {
  const E = sxS().ecl;
  if (x.mode !== "world") sxPill("ecl", "");
  else if (E.st === "omen") sxPill("ecl", `◐ Eclipse en ${sxMs(E.t)}`, "on", `◐ ${sxMs(E.t)}`);
  else if (E.st === "on") {
    const h = SXR.ecl.heraldo;
    sxPill("ecl", `◐ ECLIPSE · ${sxMs(E.t)} · ${E.hera === 2 ? "Heraldo abatido" : E.hera === 1 && h ? "Heraldo " + Math.max(0, Math.round((h.hp / h.maxHp) * 100)) + " %" : "Algo se acerca…"}`, "on", `◐ ${sxMs(E.t)}${E.hera === 1 && h ? " " + Math.max(0, Math.round((h.hp / h.maxHp) * 100)) + "%" : ""}`);
  }
  else if (E.st === "end") sxPill("ecl", "◐ El cielo se despeja", "", "◐ ✓");
  else sxPill("ecl", "");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// B · NÉMESIS
// ═══════════════════════════════════════════════════════════════════════════════════════════
// El enemigo (no jefe) que mata al jugador «asciende»: rango 1-5, nombre propio, modificadores de élite, y se queda con los créditos que
// se pierden en el traslado (más un 6 % de cada material al reaparecer). Pasados unos minutos de juego en el mundo abierto aparece y te
// caza (no se rinde hasta `leashR` metros). Si lo abates recuperas lo robado con un 25 % de intereses y botín extra; si te mata otra vez
// sube de rango y se lleva más. Hasta tres a la vez. Lo vivo se guarda en S.sx.nem.list; el cuerpo en el mundo se recrea al cazarte.

Object.defineProperty(Bd, "nemesis", { value: { n: "Némesis", c: 0xff3050 }, enumerable: false });

const SXN = {
  hit: null, // último enemigo que le hizo daño al jugador
  hitT: -99,
  projSrc: null, // enemigo dueño del proyectil que se está procesando
  live: new Map(), // uid → enemigo vivo en el mundo
  born: 0, // x.time en que reapareció el jugador por última vez
  last: null, // Némesis creado o ascendido por la última muerte (para el texto del panel de muerte)
  riseT: -9999, // S.playTime del último ascenso
};

// ¿quién me ha matado? El golpe cuenta si es de un enemigo (cuerpo a cuerpo con src, o proyectil con srcE); si no se sabe, el más cercano
{
  const _hurt = Pl.prototype.hurt;
  Pl.prototype.hurt = function (e, t) {
    const s = t && !t.dot ? t.src || SXN.projSrc : null;
    if (s && !s.dead) {
      SXN.hit = s;
      SXN.hitT = x.time;
    }
    return _hurt.apply(this, arguments);
  };
  const _iE = iE;
  iE = function (n, e, t) {
    SXN.projSrc = n.srcE || null;
    const r = _iE(n, e, t);
    SXN.projSrc = null;
    return r;
  };
  const _Na = Na;
  Na = function (n, e, t, i, s, a) {
    const r = _Na(n, e, t, i, s, a),
      pr = x.projs[x.projs.length - 1];
    if (pr && pr.owner === "e" && !pr.srcE) pr.srcE = n;
    return r;
  };
}
function sxNemKiller() {
  const C = x.cfg.nemesis,
    pl = x.player;
  let k = SXN.hit;
  if (!k || k.dead || x.time - SXN.hitT > C.hearWindow) {
    k = null;
    let best = 14;
    for (const e of x.enemies) {
      if (e.dead || e.static || !e.alerted) continue;
      const d = Le(e.x, e.z, pl.x, pl.z);
      if (d < best) {
        best = d;
        k = e;
      }
    }
  }
  return k;
}

// el asesino asciende (o, si ya era un Némesis, sube de rango)
function sxNemRise(k) {
  const S = x.S,
    N = sxS().nem,
    C = x.cfg.nemesis;
  let n = k.nemUid ? N.list.find((q) => q.uid === k.nemUid) : null;
  const lost = Math.floor(S.credits * C.cut.credits);
  if (n) {
    n.rank = Math.min(C.ranksMax, n.rank + 1);
    n.deaths++;
  } else {
    if (N.list.length >= C.listMax) {
      // el más flojo (y más viejo) cede su puesto
      N.list.sort((a, b) => a.rank - b.rank || a.born - b.born);
      N.list.shift();
    }
    const used = new Set(N.list.map((q) => q.name)),
      free = C.names.filter((q) => !used.has(q));
    n = { uid: ++N.seq, id: k.id, name: free.length ? Yt(free) : "Némesis " + N.seq, lvl: k.lvl, rank: 1, mods: [], loot: { cr: 0, mats: {} }, due: 0, state: "wait", reg: x.regionId, born: S.playTime, deaths: 1 };
    N.list.push(n);
  }
  n.lvl = qe(Math.max(n.lvl, k.lvl, Math.floor(S.lvl * 0.8)) + (n.rank > 1 ? 1 : 0), 1, 62);
  // modificadores: «némesis» (aura roja), los que ya tuviera el asesino y los que pida el rango
  const want = C.mods[n.rank - 1] + 1,
    have = ["nemesis"].concat(n.mods.filter((m) => m !== "nemesis"), k.mods.filter((m) => m !== "nemesis" && m !== "eclipsado" && !n.mods.includes(m)));
  const extra = bd(Object.keys(Bd)).filter((m) => !have.includes(m));
  n.mods = have.concat(extra).slice(0, want);
  n.loot.cr += lost;
  n.due = S.playTime + C.delayS[0] + Q() * (C.delayS[1] - C.delayS[0]);
  n.state = "wait";
  SXN.last = n;
  SXN.riseT = S.playTime;
  SXN.live.delete(n.uid);
  x.fx.text(x.player.x, 2.4, x.player.z, "☠ " + n.name, "#ff8aa8", 16, { life: 2.2 });
  ee("nemesis", "rise", n);
  return n;
}

It("playerDied", () => {
  const S = x.S,
    N = sxS().nem,
    C = x.cfg.nemesis;
  N.deaths++;
  SXN.last = null;
  const k = sxNemKiller();
  if (!k || k.boss || k.static || k.eclHera || !k.def || S.lvl < C.minLvl) return;
  // sin farmeo: hay que haber vivido un rato desde la última reaparición, y no se encadenan ascensos
  const known = k.nemUid && N.list.some((q) => q.uid === k.nemUid);
  if (!known && (x.time - SXN.born < C.minLifeS || S.playTime - SXN.riseT < C.riseCdS)) return;
  sxNemRise(k);
});
// al reaparecer se paga el resto del tributo (materiales); el reloj de «vida» vuelve a cero
It("respawn", () => {
  SXN.born = x.time;
  SXN.hit = null;
  const n = SXN.last;
  if (!n) return;
  const S = x.S,
    C = x.cfg.nemesis;
  for (const m of ["scrap", "bio", "crystal", "battery", "core", "data"]) {
    const have = S.mats[m] | 0,
      take = Math.min(C.cut.matsCap, Math.floor(have * C.cut.mats));
    if (take > 0) {
      S.mats[m] = have - take;
      n.loot.mats[m] = (n.loot.mats[m] || 0) + take;
    }
  }
  ee("res");
  SXN.last = null;
});
// el panel de muerte cuenta quién te ha derrotado
{
  const _p = $p;
  $p = function () {
    _p();
    const n = SXN.last;
    if (!n) return;
    const el = document.querySelector("#panel .wbody p.muted");
    el &&
      el.insertAdjacentHTML(
        "afterend",
        `<p style="color:#ff8aa8;margin:8px 0">☠ «${ke(n.name)}» (${ke(gn[n.id].n.toLowerCase())}) te ha derrotado${n.rank > 1 ? " otra vez" : ""} y asciende a rango ${n.rank}. Se queda con ${yt(n.loot.cr)} ¤ de tu botín y volverá a buscarte. Abátelo para recuperarlo.</p>`,
      );
  };
}

function sxNemSpawn(n) {
  const C = x.cfg.nemesis,
    spot = sxSpot(20, 32);
  if (!spot) return null;
  const [px, pz] = x.map.findFree(spot[0], spot[1], 3, 0.5),
    r = n.rank - 1,
    e = In(n.id, n.lvl, px, pz, { mods: n.mods.slice(), alerted: true, persist: true, champion: false, hpMul: C.hpMul[r], name: n.name });
  e.dmg *= C.dmgMul[r];
  e.spd *= C.spdMul;
  e.nemUid = n.uid;
  n.state = "hunt";
  SXN.live.set(n.uid, e);
  x.fx.burst(px, 0.6, pz, 16, { color: 0xff3050, speed: 4, life: 0.7, size: 0.28, up: 1 });
  ee("banner", "NÉMESIS", `${n.name} · ${gn[n.id].n} · rango ${n.rank}`, "#ff5060");
  ee("toast", `«${n.name}» te ha encontrado. Lleva ${yt(n.loot.cr)} ¤ tuyos.`, "bad");
  ae.play("roar");
  ee("nemesis", "hunt", n);
  return e;
}
function sxNemFade(e) {
  if (e.dead) return;
  e.dead = true;
  e.deadT = 0.35;
  e.hp = 0;
  e.parent && e.parent.children--;
  x.fx.burst(e.x, 0.8, e.z, 10, { color: 0xff3050, speed: 3, life: 0.5, size: 0.2, up: 1 });
}
function sxNemTick(dt) {
  const S = x.S,
    N = sxS().nem,
    C = x.cfg.nemesis,
    pl = x.player;
  if (x.mode !== "world") {
    // bajo tierra no hay caza; los que estaban en el mundo se reprograman
    if (SXN.live.size) {
      for (const [uid] of SXN.live) {
        const n = N.list.find((q) => q.uid === uid);
        n && ((n.state = "wait"), (n.due = Math.max(n.due, S.playTime + 20)));
      }
      SXN.live.clear();
    }
    return;
  }
  for (const [uid, e] of SXN.live) {
    const n = N.list.find((q) => q.uid === uid);
    if (!n) {
      sxNemFade(e);
      SXN.live.delete(uid);
    } else if (e.dead || !x.enemies.includes(e)) {
      // desaparecido sin que lo matara el jugador (cambio de mapa, reaparición…): vuelve a buscarte más tarde
      SXN.live.delete(uid);
      n.state = "wait";
      n.due = Math.max(n.due, S.playTime + C.retryS);
    } else if (pl.dead) {
      continue;
    } else if (Le(e.x, e.z, pl.x, pl.z) > C.leashR) {
      sxNemFade(e);
      SXN.live.delete(uid);
      n.state = "wait";
      n.due = S.playTime + C.retryS;
    }
  }
  if (pl.dead) return;
  for (const n of N.list) {
    if (SXN.live.has(n.uid) || S.playTime < n.due) continue;
    if (x.inSafe || x.inDark || x.bossActive || x.world.inBase() || sxEclActive()) {
      n.due = S.playTime + 10;
      continue;
    }
    sxNemSpawn(n) || (n.due = S.playTime + 6);
  }
}

// abatir a un Némesis: lo robado vuelve con intereses, XP y botín de élite superior
It("kill", (e) => {
  if (!e.nemUid) return;
  const N = sxS().nem,
    C = x.cfg.nemesis,
    n = N.list.find((q) => q.uid === e.nemUid);
  SXN.live.delete(e.nemUid);
  if (!n) return;
  const at = { x: e.x, z: e.z, spd: 4 },
    back = C.back;
  for (let i = 0; i < 4; i++) ecoSpawn({ k: "cr", val: (n.loot.cr * back) / 4 }, at, e.lvl, "champion");
  for (const m in n.loot.mats) n.loot.mats[m] > 0 && ecoSpawn({ k: "mat", mat: m, val: Math.ceil(n.loot.mats[m] * back) }, at, e.lvl, "champion");
  const src = n.rank >= 4 ? "champion" : n.rank >= 2 ? "eclipse" : "elite";
  for (let i = 0; i < (n.rank >= 3 ? 2 : 1); i++) for (const d of rollLoot(src, e.lvl, { e })) ecoSpawn(d, at, e.lvl, src);
  ecoGrantXp(C.xp[n.rank - 1], "Némesis");
  N.list = N.list.filter((q) => q.uid !== n.uid);
  N.slain++;
  ht.bump((o) => o.t === "sx" && o.k === "nemesis" && (o.uid === undefined || o.uid === n.uid));
  ee("banner", "NÉMESIS ABATIDO", `${n.name} · recuperas ${yt(Math.round(n.loot.cr * back))} ¤`, "#5dff9a");
  ae.play("legend");
  ee("nemesis", "slain", n);
});
// etiqueta del HUD: el Némesis que te caza (con la distancia) o un aviso cuando está a punto de encontrarte
function sxNemHud() {
  if (x.mode !== "world") return sxPill("nem", "");
  const live = [...SXN.live.values()].filter((e) => !e.dead);
  if (live.length) {
    const e = live[0],
      n = sxS().nem.list.find((q) => q.uid === e.nemUid);
    return sxPill("nem", `☠ Némesis · ${n ? n.name : "?"} · rango ${n ? n.rank : "?"} · ${Math.round(Le(e.x, e.z, x.player.x, x.player.z))} m · ${Math.max(0, Math.round((e.hp / e.maxHp) * 100))} %`, "bad", `☠ ${Math.round(Le(e.x, e.z, x.player.x, x.player.z))} m`);
  }
  const soon = sxS().nem.list.some((n) => n.due - x.S.playTime < 25 && n.due - x.S.playTime > 0);
  sxPill("nem", soon ? "☠ Algo te sigue el rastro…" : "", "warn", "☠ …");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// C · SANTUARIOS DE PACTO
// ═══════════════════════════════════════════════════════════════════════════════════════════
// De los tres santuarios «xeno» de cada región (los que daban una reliquia con un buff de 45 s), el tercero (shrine_<región>_2) es un
// santuario de PACTO: ofrece tres tratos (un PODER a cambio de una MALDICIÓN) que duran 20 min de juego. Las ofertas salen de un hash
// del santuario y del ciclo (cada 30 min de juego), así que son las mismas hasta que el ciclo cambia. Como mucho dos pactos a la vez
// (sellar un tercero rompe el más antiguo). Las estadísticas entran por el mismo camino que los talentos (envoltorio de tlApply);
// las maldiciones «de sistema» (enemigos más duros, más élites) se aplican a los enemigos nuevos (envoltorio de In / spawnPack).

x.cfg.pact = {
  cycleS: 1800, // las ofertas se rehacen cada 30 min de juego (y cada santuario se usa una vez por ciclo)
  durS: 1200, // duración de un pacto: 20 min de juego
  maxActive: 2,
  offers: 3,
  shrineIdx: 2, // el santuario nº 2 de cada región (shrine_<región>_2) es de pacto
  boons: [
    { id: "furia", n: "Furia sombría", fam: "dmg", st: { dmg: 0.25 } },
    { id: "ojo", n: "Ojo del cazador", fam: "crit", st: { critChance: 0.14, critDmg: 0.35 } },
    { id: "viento", n: "Pies de viento", fam: "move", st: { moveSpeed: 0.18, fireRate: 0.12 } },
    { id: "piedra", n: "Piel de piedra", fam: "def", st: { dmgRed: 0.16 } },
    { id: "oro", n: "Mano de oro", fam: "loot", st: { luck: 0.45, credits: 0.3 } },
    { id: "saber", n: "Sed de saber", fam: "xp", st: { xpGain: 0.4 } },
    { id: "sangre", n: "Sangre ajena", fam: "heal", st: { lifesteal: 0.035 } },
    { id: "mirada", n: "Mirada lejana", fam: "range", st: { range: 0.25, projSpeed: 0.2 } },
  ],
  curses: [
    { id: "fragil", n: "Fragilidad", fam: "hp", st: { maxHpPct: -0.22 } },
    { id: "plomo", n: "Pies de plomo", fam: "move", st: { moveSpeed: -0.12 } },
    { id: "noche", n: "Noche cerrada", fam: "range", st: { lightRange: -0.4, range: -0.1 } },
    { id: "herida", n: "Herida que no cierra", fam: "heal", st: { healBonus: -0.6 } },
    { id: "torpe", n: "Manos torpes", fam: "move", st: { fireRate: -0.15, reload: -0.15 } },
    { id: "avaro", n: "Maldición del avaro", fam: "loot", st: { credits: -0.35 } },
    { id: "manada", n: "Rastro de sangre", fam: "foe", sys: { foeHp: 0.2 }, d: "Los enemigos nuevos tienen un 20 % más de vida" },
    { id: "contagio", n: "Furia contagiosa", fam: "foe", sys: { foeDmg: 0.15 }, d: "Los enemigos nuevos hacen un 15 % más de daño" },
    { id: "marcado", n: "Marcado", fam: "foe", sys: { eliteMul: 2 }, d: "Las manadas llevan élites el doble de veces" },
  ],
};
const SXP = { byB: {}, byC: {} };
for (const b of x.cfg.pact.boons) SXP.byB[b.id] = b;
for (const c of x.cfg.pact.curses) SXP.byC[c.id] = c;

const sxPactCycle = () => Math.floor(x.S.playTime / x.cfg.pact.cycleS);
const sxIsPactShrine = (e) => e && e.k === "shrine" && x.mode === "world" && new RegExp("^shrine_\\d+_" + x.cfg.pact.shrineIdx + "$").test(e.id);

// ofertas deterministas de un santuario en un ciclo
function sxPactOffers(shrineId, cycle) {
  const C = x.cfg.pact;
  let h = 2166136261;
  for (const ch of shrineId + "|" + cycle) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const r = pi(h),
    boons = bd(C.boons.slice(), r),
    out = [];
  for (let i = 0; i < C.offers && i < boons.length; i++) {
    const b = boons[i],
      ok = C.curses.filter((c) => c.fam !== b.fam && !(b.fam === "move" && c.fam === "move") && !(b.id === "viento" && c.id === "torpe")),
      c = r.pick(ok);
    out.push({ b: b.id, c: c.id });
  }
  return out;
}
function sxPactReady(e) {
  const P = sxS().pact;
  return P.used[e.id] !== sxPactCycle();
}
function sxPactMin(e) {
  const C = x.cfg.pact;
  return Math.max(1, Math.ceil(((sxPactCycle() + 1) * C.cycleS - x.S.playTime) / 60));
}

// efecto de las maldiciones de sistema
function sxPactSys(key) {
  const q = x.S && x.S.sx;
  if (!q || !q.pact.act.length) return key === "eliteMul" ? 1 : 0;
  let v = key === "eliteMul" ? 1 : 0;
  for (const a of q.pact.act) {
    const c = SXP.byC[a.c];
    if (c && c.sys && c.sys[key] !== undefined) v = key === "eliteMul" ? Math.max(v, c.sys[key]) : v + c.sys[key];
  }
  return v;
}
{
  const _tl = tlApply;
  tlApply = function (S, t, add, powers) {
    _tl(S, t, add, powers);
    const q = S.sx;
    if (!q || !q.pact || !q.pact.act.length) return;
    for (const a of q.pact.act) {
      const b = SXP.byB[a.b],
        c = SXP.byC[a.c];
      if (b) for (const k in b.st) add(k, b.st[k]);
      if (c && c.st) for (const k in c.st) add(k, c.st[k]);
    }
  };
  const _In = In;
  In = function (n, e, t, i, s) {
    const en = _In(n, e, t, i, s),
      hp = sxPactSys("foeHp"),
      dm = sxPactSys("foeDmg");
    if (!en.boss) {
      if (hp) {
        en.maxHp *= 1 + hp;
        en.hp = en.maxHp;
      }
      if (dm) en.dmg *= 1 + dm;
    }
    return en;
  };
  const _sp = xn.spawnPack;
  xn.spawnPack = function (n, e, t) {
    const m = sxPactSys("eliteMul");
    if (m > 1) t = Object.assign({}, t, { elite: ((t && t.elite) || 0) + x.cfg.econ.diff.eliteWorld * (m - 1) });
    return _sp.call(this, n, e, t);
  };
}

// texto de las dos mitades de un trato
function sxPactLines(item) {
  const lines = [];
  if (item.st) for (const k in item.st) lines.push(Ks(k, item.st[k]));
  if (item.d) lines.push(item.d);
  return lines;
}
function sxPactSeal(shrine, offer) {
  const S = x.S,
    P = sxS().pact,
    C = x.cfg.pact,
    b = SXP.byB[offer.b],
    c = SXP.byC[offer.c];
  if (!b || !c) return false;
  if (P.used[shrine.id] === sxPactCycle()) return false;
  P.used[shrine.id] = sxPactCycle();
  let broke = null;
  while (P.act.length >= C.maxActive) broke = P.act.shift();
  const a = { b: b.id, c: c.id, until: S.playTime + C.durS, from: shrine.id };
  P.act.push(a);
  P.n++;
  x.player.recalc();
  x.fx.ring(shrine.x, shrine.z, 4, 0xb06cff, 0.8);
  x.fx.burst(shrine.x, 1.4, shrine.z, 30, { color: 0xb06cff, speed: 4, life: 0.9, size: 0.25 });
  ae.play("buff");
  ee("toast", `Pacto sellado: ${b.n} ⇄ ${c.n} (${Math.round(C.durS / 60)} min)${broke ? " · se rompe «" + SXP.byB[broke.b].n + "»" : ""}`, "quest");
  ht.bump((o) => o.t === "sx" && o.k === "pact");
  ee("pact", "sealed", a);
  return a;
}
function sxPactBreak(i, why) {
  const P = sxS().pact,
    a = P.act[i];
  if (!a) return;
  P.act.splice(i, 1);
  x.player.recalc();
  ee("toast", why === "time" ? `El pacto «${SXP.byB[a.b].n}» se acaba y su maldición con él` : `Pacto roto: «${SXP.byB[a.b].n}»`, why === "time" ? "warn" : "info");
  ee("pact", "ended", a);
}
function sxPactTick() {
  const P = sxS().pact,
    t = x.S.playTime;
  for (let i = P.act.length - 1; i >= 0; i--) if (P.act[i].until <= t) sxPactBreak(i, "time");
}

function sxPactOpen(shrine) {
  const S = x.S,
    P = sxS().pact,
    C = x.cfg.pact,
    ready = sxPactReady(shrine),
    offers = sxPactOffers(shrine.id, sxPactCycle());
  const card = (o, i) => {
    const b = SXP.byB[o.b],
      c = SXP.byC[o.c];
    return `<div class="card"><div class="sec" style="margin-top:0;color:#5dff9a">Poder · ${ke(b.n)}</div>${sxPactLines(b).map((l) => `<div style="font-size:14px;color:#9ef7bd">${ke(l)}</div>`).join("")}<div class="sec" style="color:#ff6a7a">Maldición · ${ke(c.n)}</div>${sxPactLines(c).map((l) => `<div style="font-size:14px;color:#ff9aa4">${ke(l)}</div>`).join("")}<div class="muted" style="font-size:12px;margin:6px 0">Dura ${Math.round(C.durS / 60)} min de juego${P.act.length >= C.maxActive ? " · rompe tu pacto más antiguo" : ""}</div><button class="btn pri" data-seal="${i}" ${ready ? "" : "disabled"}>Sellar pacto</button></div>`;
  };
  const act = P.act
    .map((a, i) => `<div class="q"><b>${ke(SXP.byB[a.b].n)}</b> ⇄ <b>${ke(SXP.byC[a.c].n)}</b> <span class="muted">· quedan ${sxMs(a.until - S.playTime)}</span> <button class="btn bad" style="margin-left:8px" data-brk="${i}">Romper</button></div>`)
    .join("");
  Ze.open(
    "pact",
    `<div class="win" style="width:min(720px,100%)">${Ze.head("Santuario de pacto", "")}<div class="wbody"><p class="muted" style="margin-top:0">Un obelisco antiguo late bajo tus manos. <i>«Todo poder tiene su precio»</i>, susurra ARGOS desde algún sitio.${ready ? "" : ` El santuario guarda silencio: volverá a hablar en ${sxPactMin(shrine)} min.`}</p>${act ? `<div class="sec" style="margin-top:0">Pactos activos (${P.act.length}/${C.maxActive})</div>${act}` : ""}<div class="sec">Tratos de este ciclo</div><div class="cards">${offers.map(card).join("")}</div><div class="row" style="margin-top:10px"><button class="btn" data-close>Cerrar</button></div></div></div>`,
    { silent: x.uiOpen === "pact", keep: true },
  );
  const root = _t("#panel");
  root.querySelectorAll("[data-seal]").forEach((b) =>
    b.addEventListener("click", () => {
      if (sxPactSeal(shrine, offers[+b.dataset.seal])) Ze.close();
    }),
  );
  root.querySelectorAll("[data-brk]").forEach((b) =>
    b.addEventListener("click", () => {
      sxPactBreak(+b.dataset.brk, "manual");
      sxPactOpen(shrine);
    }),
  );
}

// el santuario en el mundo: aspecto violeta, aviso al acercarse y panel en lugar del buff de 45 s
{
  const P = ih.prototype,
    _create = P.createMesh,
    _prompt = P.promptFor,
    _ready = P.shrineReady,
    _use = P.useShrine;
  P.createMesh = function (r) {
    const had = r.mesh,
      out = _create.apply(this, arguments);
    if (!had && r.mesh && sxIsPactShrine(r.e)) {
      const u = r.mesh.userData;
      if (u && u.relic && u.halo) {
        u.relic.material = Me(0xb06cff);
        u.halo.material = Me(0xb06cff, 0.7, true);
      }
    }
    return out;
  };
  P.shrineReady = function (e) {
    return sxIsPactShrine(e) ? sxPactReady(e) : _ready.apply(this, arguments);
  };
  P.promptFor = function (e, t) {
    if (sxIsPactShrine(e)) return sxPactReady(e) ? `Hacer un pacto · ${De[e.reg] ? De[e.reg].n : "santuario"}` : `El santuario guarda silencio · vuelve en ${sxPactMin(e)} min`;
    return _prompt.apply(this, arguments);
  };
  P.useShrine = function (e, t) {
    if (!sxIsPactShrine(e)) return _use.apply(this, arguments);
    if (x.uiOpen) return;
    sxPactReady(e) ? sxPactOpen(e) : (ae.play("err"), ee("toast", `El santuario guarda silencio. Vuelve en ${sxPactMin(e)} min`, "warn"));
  };
}
function sxPactHud() {
  const P = sxS().pact;
  for (let i = 0; i < x.cfg.pact.maxActive; i++) {
    const a = P.act[i];
    sxPill("pact" + i, a ? `☽ ${SXP.byB[a.b].n} ⇄ ${SXP.byC[a.c].n} · ${sxMs(a.until - x.S.playTime)}` : "", "warn", a ? `☽ ${sxMs(a.until - x.S.playTime)}` : "");
  }
}
// minimapa: los santuarios de pacto cercanos (azul-violeta) y los que están listos
function sxPactPings(c, size, s) {
  if (!x.world) return;
  for (const r of x.world.rt.values()) {
    const e = r.e;
    if (!sxIsPactShrine(e) || Le(e.x, e.z, x.player.x, x.player.z) > 45) continue;
    c.fillStyle = sxPactReady(e) ? "#b06cff" : "#5a4a78";
    c.beginPath();
    c.arc(e.x, e.z, 1.6, 0, 6.283);
    c.fill();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// D · ASEDIO DEL BASTIÓN Y MEJORAS DE LA BASE
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Cada 55-85 min de juego (el primero a los 40 y con nivel ≥ 8) una horda ataca el Bastión. Hay un AVISO de 75 s (despliega trampas y
// minas en las cuatro entradas) y después varias OLEADAS por los cuatro lados. Los asaltantes atacan las cuatro torretas aliadas y el
// NÚCLEO del Bastión (la baliza central; si cae, el asedio se pierde) y solo te atacan a ti si estás cerca o los hieres; las torretas
// disparan solas (con las mejoras, más y más lejos). Si no estás cerca cuando empieza, tienes un margen para volver; si no, el Bastión
// se defiende solo (sin botín). Victoria: cofre del Bastión, créditos, trofeos y XP; derrota: un pequeño saqueo.
// Las mejoras de la base (torretas, muros, taller de minas, enfermería) se pagan con TROFEOS en el Tablón de contratos.

x.cfg.siege = {
  firstS: 2400, // primer asedio a los 40 min de juego…
  gapS: [3300, 5100], // …y los siguientes cada 55-85 min
  retryS: 20,
  minLvl: 8,
  warnS: 75,
  graceS: 150, // margen para volver si no estabas cerca cuando empezó
  engageR: 60, // «estás cerca» = a menos de 60 m del centro
  leaveR: 78, // más lejos que esto las oleadas se detienen hasta que vuelvas
  waveGapS: 40, // la oleada siguiente llega cuando queda poca vida o pasado este tiempo
  waveClear: 0.25,
  waves: { base: 3, at: [20, 35] }, // 3 oleadas (+1 desde el nivel 20, +1 desde el 35)
  size: { base: 10, perWave: 4, perLvl: 10 }, // 10 + 4·oleada + nivel/10
  maxAlive: 24,
  eliteP: 0.08, // probabilidad de élite por asaltante (+5 % por oleada)
  strongP: 0.18, // probabilidad de que el asaltante sea de los tres más duros del grupo
  ring: [26, 32], // distancia al centro del Bastión a la que aparecen, sobre el eje de una de las cuatro puertas…
  lateral: 2, // …con un desvío lateral de como mucho 2 m (las puertas miden 3 m: la línea recta al núcleo las cruza)
  mopN: 3, // cuando la última oleada ya salió y quedan ≤ 3 asaltantes…
  mopS: 30, // …durante 30 s (rezagados atascados o escondidos), se retiran y el asedio se da por ganado
  maxS: 480, // un asedio no dura más de 8 min: pasado ese tiempo los supervivientes se retiran (gana quien tenga el núcleo en pie)
  hpMul: 1.15,
  dmgMul: 1,
  turret: { range: 17.5, cd: 0.36 }, // «protocolo de defensa»: durante el asedio las torretas alcanzan 17,5 m (cubren todo el recinto, no solo las puertas) pero disparan la mitad de rápido
  turretLives: 4, // vida de una torreta = 4 × la vida del jugador de ese nivel
  coreLives: 12, // y la del núcleo, 12 ×
  wallHp: 0.3, // +30 % de vida de torretas y núcleo por nivel de «Muros y blindaje»
  lossCut: 0.05, // si cae el núcleo: se pierde un 5 % de los créditos
  reward: { crUnits: 28, xp: 0.12, trophies: [3, 5] },
  absent: { win: 0.35, perTurret: 0.15, perWall: 0.1, cap: 0.9, cr: 6, penalty: 0.03 }, // el Bastión se defiende solo
};
x.cfg.baseUp = {
  payMul: 1.5, // los trofeos valen ×1,5 al pagar mejoras
  list: [
    { id: "turret", n: "Torretas reforzadas", d: "Por nivel: +20 % de daño y +1,5 m de alcance de las torretas aliadas", max: 3, cost: [120, 360, 960] },
    { id: "wall", n: "Muros y blindaje", d: "Por nivel: +30 % de resistencia de las torretas y del núcleo durante un asedio", max: 3, cost: [120, 360, 960] },
    { id: "mines", n: "Taller de minas", d: "Por nivel: al sonar la alarma del asedio recibes 2 minas de proximidad y 1 de racimo", max: 3, cost: [150, 420, 1100] },
    { id: "medbay", n: "Enfermería de campaña", d: "Por nivel: +1 botiquín máximo y el refugio cura un 30 % más rápido", max: 3, cost: [100, 300, 800] },
  ],
};
const SXU = {};
for (const u of x.cfg.baseUp.list) SXU[u.id] = u;
const SX_TMP = [];
SXR.sg = { T: null, core: null, live: new Set(), queue: [], spawnT: 0, waveT: 0, lastN: 0, W: 3, side: 0, chkT: 0, inT: 0, t: 0 };

const sxBaseLv = (id) => (sxS().base.lv[id] | 0);
const sxBase = () => (x.map && x.map.pois && x.map.pois.base) || null;
const sxEclBusy = () => {
  const q = x.S.sx.ecl;
  return q.st === "omen" || q.st === "on";
};
const sxSiegeBusy = () => {
  const q = x.S.sx.siege;
  return q.st !== "idle" && q.st !== "end";
};

// ── mejoras: efectos ─────────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const _tl = tlApply;
  tlApply = function (S, t, add, powers) {
    _tl(S, t, add, powers);
    const lv = S.sx && S.sx.base && S.sx.base.lv.medbay | 0;
    if (lv) add("medkitMax", lv);
  };
}
// las torretas aliadas del Bastión: con mejoras disparan más y más lejos, y una torreta derribada en el asedio calla hasta que acaba
{
  const P = ih.prototype;
  P.turretUpdate = function (e, t) {
    const i = e.e;
    if (i._sxDown) return;
    const lv = sxBaseLv("turret"),
      sg = x.S.sx.siege.st === "on" && SXR.sg.T,
      R = (sg ? x.cfg.siege.turret.range : 13) + 1.5 * lv,
      mul = 1 + 0.2 * lv;
    e.cd = (e.cd || 0) - t;
    let s = null,
      a = R;
    for (const l of rn(i.x, i.z, R, SX_TMP)) {
      const c = Le(l.x, l.z, i.x, i.z);
      c < a && l.targetable() && this.map.los(i.x, i.z, l.x, l.z) && ((a = c), (s = l));
    }
    if (!s) return;
    const r = Math.atan2(s.x - i.x, s.z - i.z),
      o = e.mesh.userData.head;
    if ((o && (o.rotation.y = o.rotation.y + fi(o.rotation.y, r) * Math.min(1, t * 8)), e.cd <= 0)) {
      e.cd = sg ? x.cfg.siege.turret.cd : 0.18;
      const l = 30;
      x.projs.push({
        owner: "p",
        kind: "bullet",
        x: i.x + Math.sin(r) * 0.8,
        y: 0.85,
        z: i.z + Math.cos(r) * 0.8,
        vx: Math.sin(r) * l,
        vz: Math.cos(r) * l,
        dmg: (s.maxHp * 0.12 + 5) * mul,
        life: 0.6 + 0.05 * lv,
        pierce: 0,
        hit: new Set(),
        color: 4251903,
        w: 0.07,
        len: 1,
      });
      x.fx.muzzle(i.x + Math.sin(r) * 0.9, 0.85, i.z + Math.cos(r) * 0.9, r, 4251903, 0.8);
      ae.play("smg", { gap: 0.1, v: 0.3 });
    }
  };
}
// la enfermería cura más deprisa dentro del refugio
function sxMedbayTick(dt) {
  const lv = sxBaseLv("medbay"),
    p = x.player;
  if (lv && x.inSafe && !p.dead && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.08 * 0.3 * lv * dt);
}

// ── pagar con trofeos ───────────────────────────────────────────────────────────────────────────────────────────────────────
function sxBaseCost(id) {
  const u = SXU[id],
    lv = sxBaseLv(id);
  return lv >= u.max ? null : Math.round(u.cost[lv] * mt.credits(qe(x.S.lvl, 5, 60)));
}
// valor «efectivo» de los trofeos gastables (sin ingredientes), ya con el ×1,5
function sxTrophyPower() {
  return ecoJunkTotals(true).v * x.cfg.baseUp.payMul;
}
function sxPayTrophies(cost) {
  const C = x.cfg.baseUp,
    j = ecoJunk(),
    tbl = ecoTroTable();
  if (sxTrophyPower() + 1e-6 < cost) return false;
  const keys = Object.keys(j)
    .filter((k) => j[k] > 0 && !(tbl[k.endsWith(":p") ? k.slice(0, -2) : k] || {}).ing)
    .sort((a, b) => (a.endsWith(":p") ? 1 : 0) - (b.endsWith(":p") ? 1 : 0) || ecoTroValue(a) - ecoTroValue(b));
  let rest = cost / C.payMul;
  for (const k of keys) {
    const v = ecoTroValue(k);
    while (j[k] > 0 && rest > 0) {
      j[k]--;
      rest -= v;
    }
    j[k] <= 0 && delete j[k];
    if (rest <= 0) break;
  }
  if (rest < 0) x.S.credits += Math.floor(-rest); // lo que sobra de la última pieza vuelve en créditos
  ee("junk");
  ee("res");
  return true;
}
function sxBaseBuy(id) {
  const u = SXU[id],
    q = sxS().base,
    cost = sxBaseCost(id);
  if (!u || cost === null) return false;
  if (!sxPayTrophies(cost)) {
    ae.play("err");
    ee("toast", "No tienes trofeos suficientes", "warn");
    return false;
  }
  q.lv[id] = (q.lv[id] | 0) + 1;
  q.spent += cost;
  x.player.recalc();
  ae.play("levelup");
  ee("toast", `Bastión mejorado: ${u.n} (nivel ${q.lv[id]}/${u.max})`, "good");
  ee("base", id, q.lv[id]);
  return true;
}

// ── el asedio ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function sxSiegeWaves() {
  const W = x.cfg.siege.waves,
    L = x.S.lvl;
  return W.base + (L >= W.at[0] ? 1 : 0) + (L >= W.at[1] ? 1 : 0);
}
function sxSiegePool(lvl) {
  const top = Math.min(De.length - 1, Jd() + 1),
    acc = new Map();
  for (let r = 0; r <= top; r++)
    for (const e of De[r].enemies) {
      const d = gn[e[0]];
      if (!d || (e[2] || 0) > lvl || SX_NOSPAWN.has(e[0]) || d.ai === "spawner" || d.ai === "turret" || d.ai === "shadow") continue;
      acc.set(e[0], (acc.get(e[0]) || 0) + e[1] * (r === 0 ? 1 : 0.7));
    }
  return [...acc].map(([id, w]) => ({ id, w }));
}
function sxSiegeTargets() {
  const S = x.S,
    C = x.cfg.siege,
    wall = 1 + C.wallHp * sxBaseLv("wall"),
    life = mt.playerHp(S.lvl),
    out = [];
  for (const e of x.map.ents) {
    if (e.k === "allyturret") out.push({ kind: "turret", name: "Torreta", x: e.x, z: e.z, r: 0.9, hp: life * C.turretLives * wall, ent: e, hitT: 0, down: false });
    else if (e.k === "beacon" && e.id === "beacon_0") out.push({ kind: "core", name: "Núcleo del Bastión", x: e.x, z: e.z, r: 1.5, hp: life * C.coreLives * wall, ent: e, hitT: 0, down: false });
  }
  for (const t of out) t.maxHp = t.hp;
  return out;
}
const sxSiegePresent = () => {
  const b = sxBase();
  return !!b && x.mode === "world" && Le(b.x, b.z, x.player.x, x.player.z) <= x.cfg.siege.engageR;
};

function sxSiegeWarn() {
  const S = x.S,
    Q_ = sxS().siege,
    C = x.cfg.siege;
  Object.assign(Q_, { st: "warn", t: C.warnS, wave: 0 });
  ee("banner", "ALERTA · BASTIÓN BAJO ATAQUE", `Una horda llega en ${C.warnS} s · despliega trampas y minas en las entradas`, "#ffb340");
  ee("toast", "ARGOS: movimiento masivo hacia el Bastión. Defiende el núcleo y las torretas; las trampas y minas serán decisivas.", "warn");
  ae.play("alarm");
  // el Taller de minas reparte existencias
  const mines = sxBaseLv("mines");
  if (mines) {
    const inv = (gdState() || {}).inv;
    if (inv) {
      inv.proximity = Math.min(x.cfg.gadgets.maxCharges, (inv.proximity | 0) + 2 * mines);
      inv.cluster = Math.min(x.cfg.gadgets.maxCharges, (inv.cluster | 0) + mines);
      ee("toast", `Taller de minas: +${2 * mines} minas de proximidad y +${mines} de racimo`, "good");
    }
  }
  ee("siege", "warn");
}
function sxSiegeBegin() {
  const Q_ = sxS().siege,
    R = SXR.sg,
    C = x.cfg.siege;
  R.T = sxSiegeTargets();
  R.core = R.T.filter((t) => t.kind === "core");
  R.t = 0;
  R.inT = 0;
  R.mopT = 0;
  R.live.clear();
  R.queue.length = 0;
  R.spawnT = 2;
  R.waveT = 0;
  R.lastN = 0;
  R.W = sxSiegeWaves();
  R.chkT = 0;
  R.stats = { killed: 0, hits: 0 };
  Object.assign(Q_, { st: "on", t: 0, wave: 0 });
  ee("banner", "EL ASEDIO COMIENZA", `${R.W} oleadas · defiende el núcleo`, "#ff6a6a");
  ae.play("roar");
  ee("siege", "on");
  sxSiegeNext();
}
function sxSiegeNext() {
  const Q_ = sxS().siege,
    R = SXR.sg,
    C = x.cfg.siege,
    lvl = qe(x.S.lvl, 1, 62);
  Q_.wave++;
  R.waveT = 0;
  const n = C.size.base + C.size.perWave * Q_.wave + Math.floor(lvl / C.size.perLvl),
    pool = sxSiegePool(lvl);
  if (!pool.length) return;
  const strong = [...pool].sort((a, b) => gn[b.id].hp - gn[a.id].hp).slice(0, 3),
    sides = [0, 1, 2, 3];
  bd(sides);
  const nSides = Q_.wave === R.W ? 4 : Math.min(3, Q_.wave);
  R.queue.length = 0;
  for (let i = 0; i < n; i++)
    R.queue.push({ id: (Q() < C.strongP ? Yt(strong) : ii(pool)).id, elite: Q() < C.eliteP + 0.05 * Q_.wave, side: sides[i % nSides] });
  if (Q_.wave === R.W) R.queue.push({ id: strong[0].id, boss: true, side: sides[0] });
  R.lastN = R.queue.length;
  ee("banner", `OLEADA ${Q_.wave}/${R.W}`, Q_.wave === R.W ? "Última oleada · llega un Coloso" : `${nSides} ${nSides > 1 ? "frentes" : "frente"}`, "#ffb340");
  ae.play("alarm");
}
// punto de aparición sobre el eje de una de las cuatro puertas del Bastión (lado 0-3), a 26-32 m del centro y casi alineado con ella
function sxSiegeSpot(side) {
  const b = sxBase(),
    C = x.cfg.siege,
    a = (side * Math.PI) / 2,
    ca = Math.cos(a),
    sa = Math.sin(a);
  for (let i = 0; i < 10; i++) {
    const d = C.ring[0] + Q() * (C.ring[1] - C.ring[0]),
      l = (Q() - 0.5) * 2 * C.lateral,
      px = b.x + ca * d - sa * l,
      pz = b.z + sa * d + ca * l;
    if (!x.map.circleHits(px, pz, 0.8)) return [px, pz];
  }
  return null;
}
function sxSiegeSpawn(job) {
  const C = x.cfg.siege,
    R = SXR.sg,
    spot = sxSiegeSpot(job.side);
  if (!spot) return null;
  const lvl = qe(x.S.lvl + (job.boss ? 2 : 0), 1, 62),
    e = In(job.id, lvl, spot[0], spot[1], {
      mods: job.boss ? ["gigante"].concat(aa(lvl + 10, 1).filter((q) => q !== "gigante")).slice(0, 3) : job.elite ? aa(lvl, 1) : [],
      alerted: true,
      persist: true,
      champion: !!job.boss,
      hpMul: C.hpMul,
      name: job.boss ? "Coloso del asedio" : undefined,
      siege: { targets: R.core },
    });
  e.dmg *= C.dmgMul;
  e.siegeE = true;
  e._sxA = (job.side * Math.PI) / 2;
  R.live.add(e);
  x.fx.burst(spot[0], 0.6, spot[1], 8, { color: 0xff6a3c, speed: 3, life: 0.5, size: 0.22, up: 1 });
  return e;
}
// fin del asedio: why = 'win' | 'lose' | 'auto' | 'debug'
function sxSiegeEnd(why) {
  const S = x.S,
    Q_ = sxS().siege,
    C = x.cfg.siege,
    R = SXR.sg,
    b = sxBase();
  if (Q_.st === "idle" || Q_.st === "end") return;
  const T = R.T || [],
    alive = T.filter((t) => t.hp > 0),
    core = T.find((t) => t.kind === "core"),
    turretsLeft = T.filter((t) => t.kind === "turret" && t.hp > 0).length,
    turretsAll = T.filter((t) => t.kind === "turret").length,
    coreFrac = core ? Math.max(0, core.hp) / core.maxHp : 1,
    lvl = qe(S.lvl, 1, 62);
  // los asaltantes que quedan huyen; las torretas se reparan solas
  for (const e of R.live) {
    if (!e.dead) {
      e.dead = true;
      e.deadT = 0.35;
      e.hp = 0;
      e.parent && e.parent.children--;
      x.fx.burst(e.x, 0.8, e.z, 8, { color: 0xff6a3c, speed: 3, life: 0.5, size: 0.2, up: 1 });
    }
  }
  R.live.clear();
  R.queue.length = 0;
  for (const t of T) t.ent && (t.ent._sxDown = false);
  R.T = null;
  Q_.n++;
  Q_.next = S.playTime + C.gapS[0] + Q() * (C.gapS[1] - C.gapS[0]);
  Q_.st = "end";
  Q_.t = 8;
  if (why === "win") {
    Q_.won++;
    const perfect = turretsLeft === turretsAll && coreFrac > 0.6,
      tier = perfect ? 3 : 2,
      at = { x: b.x, z: b.z + 3, spd: 3 };
    Co(at.x, at.z, tier, lvl, { src: tier === 3 ? "chest3" : "chest2" });
    for (let i = 0; i < 4; i++) ecoSpawn({ k: "cr", val: (mt.credits(lvl) * C.reward.crUnits * (0.6 + 0.4 * coreFrac)) / 4 }, at, lvl, "event");
    const pool = sxSiegePool(lvl).filter((p) => ecoTrophyNames[p.id]);
    for (let i = Rt(C.reward.trophies[0], C.reward.trophies[1]); i > 0 && pool.length; i--) ecoSpawn({ k: "trophy", id: ii(pool).id, perfect: Q() < 0.06 }, at, lvl, "event");
    ecoGrantXp(C.reward.xp, "Asedio");
    ee("banner", "BASTIÓN A SALVO", perfect ? "Defensa perfecta · cofre del Bastión" : "El Bastión resiste · cofre del Bastión", "#5dff9a");
    ae.play("legend");
    ht.bump((o) => o.t === "sx" && o.k === "siege");
  } else if (why === "lose") {
    Q_.lost++;
    const cut = Math.floor(S.credits * C.lossCut);
    S.credits -= cut;
    ee("banner", "EL BASTIÓN HA CAÍDO", `Saqueo: −${yt(cut)} ¤ · se repara solo`, "#ff6a6a");
    ee("res");
  }
  ee("siege", "end", why);
}
// el Bastión se defiende solo (el jugador no estaba): sin botín
function sxSiegeAuto() {
  const S = x.S,
    Q_ = sxS().siege,
    C = x.cfg.siege,
    A = C.absent,
    p = qe(A.win + A.perTurret * sxBaseLv("turret") + A.perWall * sxBaseLv("wall"), 0, A.cap),
    win = Q() < p;
  Q_.n++;
  Q_.next = S.playTime + C.gapS[0] + Q() * (C.gapS[1] - C.gapS[0]);
  Q_.st = "end";
  Q_.t = 8;
  if (win) {
    Q_.won++;
    const cr = Math.round(mt.credits(qe(S.lvl, 1, 62)) * A.cr);
    S.credits += cr;
    ee("toast", `El Bastión repele el asedio sin ti (+${yt(cr)} ¤ de lo que dejaron atrás)`, "good");
  } else {
    Q_.lost++;
    const cut = Math.floor(S.credits * A.penalty);
    S.credits -= cut;
    ee("toast", `El Bastión cayó sin ti: reparaciones −${yt(cut)} ¤. Mejora sus defensas con trofeos en el Tablón.`, "bad");
  }
  ee("res");
  ee("siege", "end", "auto");
}

function sxSiegeTick(dt) {
  const S = x.S,
    Q_ = sxS().siege,
    C = x.cfg.siege,
    R = SXR.sg,
    pl = x.player;
  if (x.mode !== "world" || !sxBase()) return;
  if (Q_.st === "idle") {
    if (S.playTime >= Q_.next) S.lvl >= C.minLvl && !pl.dead && !x.bossActive && !sxEclBusy() ? sxSiegeWarn() : (Q_.next = S.playTime + C.retryS);
    return;
  }
  if (Q_.st === "end") {
    if ((Q_.t -= dt) <= 0) Q_.st = "idle";
    return;
  }
  if (Q_.st === "warn") {
    if ((Q_.t -= dt) > 0) return;
    if (sxSiegePresent()) return void sxSiegeBegin();
    Object.assign(Q_, { st: "grace", t: C.graceS });
    ee("toast", "El Bastión resiste… ¡vuelve cuanto antes!", "warn");
    return;
  }
  if (Q_.st === "grace") {
    if (sxSiegePresent()) return void sxSiegeBegin();
    if ((Q_.t -= dt) <= 0) sxSiegeAuto();
    return;
  }
  // Q_.st === "on"
  if (!R.T) {
    // guardado cargado en mitad de un asedio: no hay enemigos ni objetivos; se retoma al volver
    Object.assign(Q_, { st: "grace", t: C.graceS });
    return;
  }
  const b = sxBase(),
    away = Le(b.x, b.z, pl.x, pl.z) > C.leaveR;
  // objetivos: daño visible, derribo y derrota
  for (const t of R.T) {
    if (t.hitT > 0) t.hitT -= dt;
    if (t.hp <= 0 && !t.down) {
      t.down = true;
      x.fx.explosion(t.x, t.z, 2, 0xff6a3c);
      ae.play("boom");
      if (t.ent) t.ent._sxDown = true;
      ee("toast", t.kind === "core" ? "¡EL NÚCLEO HA CAÍDO!" : "Una torreta ha caído", "bad");
    } else if (t.hp > 0 && t.hp < t.maxHp * 0.4 && Q() < dt * 3) x.fx.smoke(t.x, 1.2, t.z, 1, 0x333333, 0.5);
  }
  const core = R.T.find((t) => t.kind === "core");
  if (core && core.hp <= 0) return void sxSiegeEnd("lose");
  // los asaltantes que desaparecen sin que los abata nadie (al reaparecer el jugador se vacía la lista de enemigos) vuelven a la cola
  for (const e of R.live)
    if (!sxAlive(e)) {
      R.live.delete(e);
      if (!e.dead) R.queue.push({ id: e.id, elite: e.mods.length > 0, boss: !!e.champion, side: Rt(0, 3) });
    }
  let alive = R.live.size;
  // aparición escalonada
  if (!away && R.queue.length && (R.spawnT -= dt) <= 0) {
    R.spawnT = 0.35;
    for (let i = 0; i < 2 && R.queue.length && alive < C.maxAlive; i++) {
      sxSiegeSpawn(R.queue.shift());
      alive++;
    }
  }
  if (!R.queue.length) {
    if (Q_.wave < R.W) {
      if (!away && ((R.waveT += dt) >= C.waveGapS || alive <= Math.ceil(R.lastN * C.waveClear))) sxSiegeNext();
    } else if (alive === 0) return void sxSiegeEnd("win");
    else if (alive <= C.mopN) {
      if ((R.mopT += dt) >= C.mopS) return void sxSiegeEnd("win");
    } else R.mopT = 0;
  }
  // asaltantes atascados contra un muro (el campo de rutas sigue al jugador, no a las torretas): se sueltan para que vayan a por él
  // aproximación: apuntan al núcleo (la línea recta cruza la puerta); dentro del recinto atacan lo más cercano
  if ((R.inT -= dt) <= 0) {
    R.inT = 0.25;
    for (const e of R.live) if (e.siege && e.siege.targets === R.core && Math.abs(e.x - b.x) < 11 && Math.abs(e.z - b.z) < 11) e.siege = { targets: R.T };
  }
  // tope de duración: los supervivientes se retiran y gana quien conserve el núcleo
  if ((R.t += dt) > C.maxS) return void sxSiegeEnd(core && core.hp > 0 ? "win" : "lose");
  // asaltantes atascados (un atrezo junto a la puerta, otro enemigo…): a los 6 s se sueltan para ir a por el jugador y, si a los 12 s siguen
  // sin moverse, se cuelan por la puerta de su lado (un salto corto, con destello) para que el asedio no se eternice
  if ((R.chkT -= dt) <= 0) {
    R.chkT = 6;
    for (const e of R.live) {
      if (e._sxX !== undefined && Math.hypot(e.x - e._sxX, e.z - e._sxZ) < 1 && !e.boss) {
        let near = false;
        for (const t of R.T) if (t.hp > 0 && Le(e.x, e.z, t.x, t.z) < 7) near = true;
        if (!near) {
          e._sxS = (e._sxS | 0) + 1;
          if (e._sxS >= 2 && e._sxA !== undefined && !(Math.abs(e.x - b.x) < 12 && Math.abs(e.z - b.z) < 12)) {
            const [gx, gz] = x.map.findFree(b.x + Math.cos(e._sxA) * 10, b.z + Math.sin(e._sxA) * 10, 3, e.rad);
            x.fx.burst(e.x, 0.6, e.z, 8, { color: 0xff6a3c, speed: 3, life: 0.4, size: 0.2, up: 1 });
            e.x = gx;
            e.z = gz;
            e.siege = { targets: R.T };
            e._sxS = 0;
          } else if (e.siege) e.siege = null;
        } else e._sxS = 0;
      } else e._sxS = 0;
      e._sxX = e.x;
      e._sxZ = e.z;
    }
  }
}
It("kill", (e) => {
  if (!e.siegeE) return;
  SXR.sg.live.delete(e);
  SXR.sg.stats && SXR.sg.stats.killed++;
});

function sxSiegeHud() {
  const Q_ = sxS().siege,
    R = SXR.sg;
  if (x.mode !== "world") return sxPill("sg", "");
  if (Q_.st === "warn") return sxPill("sg", `⚔ Asedio del Bastión en ${sxMs(Q_.t)} · prepara trampas y minas`, "bad", `⚔ ${sxMs(Q_.t)}`);
  if (Q_.st === "grace") return sxPill("sg", `⚔ El Bastión resiste… vuelve (${sxMs(Q_.t)})`, "bad", `⚔ ${sxMs(Q_.t)}`);
  if (Q_.st === "on" && R.T) {
    const core = R.T.find((t) => t.kind === "core"),
      tur = R.T.filter((t) => t.kind === "turret"),
      b = sxBase(),
      away = Le(b.x, b.z, x.player.x, x.player.z) > x.cfg.siege.leaveR;
    const pc = Math.max(0, Math.round((core.hp / core.maxHp) * 100));
    return sxPill(
      "sg",
      away
        ? "⚔ Vuelve al Bastión: las oleadas esperan"
        : `⚔ Asedio ${Q_.wave}/${R.W} · núcleo ${pc}% · torretas ${tur.filter((t) => t.hp > 0).length}/${tur.length} · ${R.live.size + R.queue.length} enemigos`,
      "bad",
      away ? "⚔ vuelve" : `⚔ ${Q_.wave}/${R.W} ${pc}%`,
    );
  }
  sxPill("sg", Q_.st === "end" ? "⚔ El asedio ha terminado" : "", "good", "⚔ ✓");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// E · CONTRATOS DINÁMICOS Y PANEL DE LA BASE (Tablón de contratos)
// ═══════════════════════════════════════════════════════════════════════════════════════════
// El Tablón (estación «board» del Bastión) ya ofrecía 4 contratos aleatorios cada 30 min (ht.board). Aquí se le añaden contratos que
// dependen de lo que pasa en el mundo: un Némesis vivo, un Eclipse a menos de 30 min, un asedio en camino y un pacto. Son contratos
// normales del Tablón (misma estructura que ht.genRepeat) con un objetivo nuevo {t:"sx", k, n} que avanzan los sistemas de arriba.
// El panel del Tablón también muestra las MEJORAS DEL BASTIÓN (se pagan con trofeos).

x.cfg.contracts = {
  eclipseNear: 1800, // el contrato de Eclipse aparece cuando faltan menos de 30 min (o está en curso)
  siegeNear: 1500, // y el del asedio, cuando faltan menos de 25 min
  rewardMul: { nemesis: 1.4, eclipse: 1.2, siege: 1.3, pact: 0.7 }, // × 60 · créditos(nivel)
  seenMax: 60, // identificadores ya aceptados que se recuerdan para no repetirlos
};

function sxContract(key, o) {
  return { id: "sx_" + key, giver: "morales", n: o.n, lvl: o.lvl, xpf: 0.6, intro: o.intro, done: "Buen trabajo. El Tablón te lo agradece.", obj: [o.obj], rew: { credits: o.cr, item: o.item ? 1 : 0, mats: null }, repeat: true, board: true, reg: o.reg, sx: true };
}
// qué contratos deberían estar en el Tablón ahora mismo (sin consultar nada más que el estado)
function sxContractsWanted() {
  const S = x.S,
    q = sxS(),
    C = x.cfg.contracts,
    L = qe(S.lvl, 1, 62),
    reg = Math.min(Jd(), De.length - 1),
    cr = (m) => Math.round(60 * mt.credits(L) * m),
    want = [];
  for (const n of q.nem.list)
    want.push(
      sxContract("nem" + n.uid, {
        n: `Cazar a «${n.name}»`,
        lvl: n.lvl,
        reg,
        cr: cr(C.rewardMul.nemesis * (1 + 0.25 * n.rank)),
        item: n.rank >= 2,
        intro: `Un ${gn[n.id].n.toLowerCase()} de rango ${n.rank} te tiene fichado y se lleva ${yt(n.loot.cr)} ¤ tuyos. Abátelo y recupéralos.`,
        obj: { t: "sx", k: "nemesis", uid: n.uid, n: 1 },
      }),
    );
  const E = q.ecl;
  if (E.st === "omen" || E.st === "on" || (E.st === "idle" && E.next - S.playTime < C.eclipseNear))
    want.push(sxContract("ecl" + E.n, { n: "Contrato de Eclipse", lvl: L, reg, cr: cr(C.rewardMul.eclipse), item: true, intro: "ARGOS prevé un Eclipse. Abate 6 criaturas eclipsadas mientras dure (cuentan solo durante el Eclipse).", obj: { t: "sx", k: "eclipse", n: 6 } }));
  const G = q.siege;
  if (G.st === "warn" || G.st === "grace" || G.st === "on" || (G.st === "idle" && G.next - S.playTime < C.siegeNear))
    want.push(sxContract("sg" + G.n, { n: "Defensa del Bastión", lvl: L, reg: 0, cr: cr(C.rewardMul.siege), item: true, intro: "Se espera un asedio. Resiste todas las oleadas con el núcleo en pie.", obj: { t: "sx", k: "siege", n: 1 } }));
  want.push(sxContract("pact" + sxPactCycle(), { n: "Un trato con la oscuridad", lvl: L, reg, cr: cr(C.rewardMul.pact), item: false, intro: "Los santuarios de pacto susurran. Sella un pacto en cualquiera de ellos.", obj: { t: "sx", k: "pact", n: 1 } }));
  return want;
}
function sxContractsSync(board) {
  const S = x.S,
    q = sxS(),
    want = sxContractsWanted(),
    seen = q.con.seen || (q.con.seen = {}),
    keep = board.list.filter((c) => !c.sx || want.some((w) => w.id === c.id));
  for (const w of want) if (!keep.some((c) => c.id === w.id) && !S.quests.active[w.id] && !seen[w.id]) keep.push(w);
  board.list = keep;
}
{
  const _board = ht.board,
    _accept = ht.accept,
    _ot = ht.objText,
    _tg = ht.target;
  ht.board = function () {
    const b = _board.call(this);
    try {
      sxContractsSync(b);
    } catch (err) {
      console.warn("[sorpresas] contratos", err);
    }
    return b;
  };
  // un contrato aceptado no se vuelve a ofrecer (los identificadores llevan contador, así que no hay colisiones)
  ht.accept = function (n, e) {
    const r = _accept.call(this, n, e);
    if (typeof n === "string" && n.startsWith("sx_") && x.S.quests.active[n]) {
      const seen = sxS().con.seen || (sxS().con.seen = {}),
        keys = Object.keys(seen);
      seen[n] = 1;
      keys.length >= x.cfg.contracts.seenMax && delete seen[keys[0]];
    }
    return r;
  };
  ht.objText = function (n, e) {
    if (!n || n.t !== "sx") return _ot.call(this, n, e);
    const i = `${Math.min(e || 0, n.n)}/${n.n}`;
    return n.k === "eclipse" ? `Criaturas eclipsadas abatidas (durante un Eclipse): ${i}` : n.k === "nemesis" ? `Némesis abatido: ${i}` : n.k === "siege" ? `Asedios del Bastión resistidos: ${i}` : n.k === "pact" ? `Pactos sellados: ${i}` : "";
  };
  ht.target = function (n, e) {
    const s = ri(n, e);
    if (s && s.sx && !this.complete(n, e)) {
      const o = s.obj[0];
      if (o.k === "nemesis") {
        const en = SXN.live.get(o.uid);
        if (en && !en.dead) return { x: en.x, z: en.z, n: en.name };
      } else if (o.k === "siege") {
        const b = sxBase();
        if (b) return { x: b.x, z: b.z, n: "Bastión" };
      }
      return null;
    }
    return _tg.call(this, n, e);
  };
}

// ── panel del Tablón: mejoras del Bastión ────────────────────────────────────────────────────────────────────────────────────
function sxBaseHtml() {
  const q = sxS(),
    C = x.cfg.baseUp,
    pw = sxTrophyPower(),
    row = (u) => {
      const lv = sxBaseLv(u.id),
        cost = sxBaseCost(u.id);
      return `<div class="card"><b>${ke(u.n)}</b> <span class="tag" style="color:var(--amber2)">${"●".repeat(lv)}${"○".repeat(u.max - lv)}</span><p style="font-size:13px;margin:4px 0">${ke(u.d)}</p>${cost === null ? '<div class="muted" style="font-size:13px">Nivel máximo</div>' : `<div class="cost">Coste: ${yt(cost)} ¤ en trofeos</div><button class="btn" style="margin-top:6px" data-sxup="${u.id}" ${pw >= cost ? "" : "disabled"}>Mejorar</button>`}</div>`;
    };
  return `<div class="sec">Mejoras del Bastión</div><p class="muted" style="font-size:13px;margin:0 0 6px">Se pagan con trofeos de enemigos (valen ×${String(C.payMul).replace(".", ",")}). Tienes ${yt(Math.floor(pw))} ¤ en trofeos · asedios resistidos: ${q.siege.won} de ${q.siege.n}</p><div class="cards">${C.list.map(row).join("")}</div>`;
}
function sxBoardExtra() {
  const root = document.querySelector("#panel .wbody");
  if (!root || root.querySelector("[data-sxup]") || x.uiOpen !== "board") return;
  root.insertAdjacentHTML("beforeend", sxBaseHtml());
  root.querySelectorAll("[data-sxup]").forEach((b) =>
    b.addEventListener("click", () => {
      sxBaseBuy(b.dataset.sxup) && Vl();
    }),
  );
}
{
  const _Vl = Vl;
  Vl = function () {
    _Vl();
    try {
      sxBoardExtra();
    } catch (err) {
      console.warn("[sorpresas] panel", err);
    }
  };
}

// Archivo · pestaña de hitos: el resumen de las sorpresas
{
  const _hh = ecoHitosHtml;
  ecoHitosHtml = function () {
    const q = sxS(),
      f = x.S.eclipseFrag | 0;
    return `<div class="eco-sum"><span><b style="color:#c9a0ff">${q.ecl.n}</b> Eclipses · <b style="color:#c9a0ff">${q.ecl.heralds | 0}</b> Heraldos abatidos · <b style="color:#ff8aa8">${q.nem.slain}</b> Némesis abatidos · <b>${q.pact.n}</b> pactos sellados · <b style="color:#ffb340">${q.siege.won}</b> de ${q.siege.n} asedios resistidos</span><span class="muted">${f} Fragmento${f === 1 ? "" : "s"} de Eclipse en tu poder</span></div>` + _hh();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// TICK GENERAL, minimapa y API de pruebas  (las partes nuevas se insertan ANTES de esta cabecera)
// ═══════════════════════════════════════════════════════════════════════════════════════════
const SX_TICKS = [sxEclTick, sxNemTick, sxPactTick, sxSiegeTick, sxMedbayTick];
{
  const _pings = ecoMinimapPings;
  ecoMinimapPings = function (c, size, s) {
    _pings(c, size, s);
    if (x.mode !== "world" || !x.S.sx) return;
    const R = SXR.ecl;
    if (R.heraldo && !R.heraldo.dead) sxPing(c, size, s, R.heraldo.x, R.heraldo.z, "#ff8aa8", true);
    for (const e of SXN.live.values()) e.dead || sxPing(c, size, s, e.x, e.z, "#ff3050", true);
    const q = x.S.sx.siege,
      b = sxBase();
    if (b && (q.st === "warn" || q.st === "grace" || q.st === "on")) sxPing(c, size, s, b.x, b.z, "#ffb340", true);
    sxPactPings(c, size, s);
  };
}
x.tick.push((dt) => {
  if (!x.started || !x.S || !x.player) return;
  sxHookRenderer();
  if (!sxUi()) return;
  sxS(); // crea S.sx si falta (partida cargada antes de existir este fragmento)
  for (const f of SX_TICKS) f(dt);
  sxEclSky(dt);
  if ((SXR.hudT -= dt) <= 0) {
    SXR.hudT = 0.25;
    sxEclHud();
    sxNemHud();
    sxPactHud();
    sxSiegeHud();
  }
});

window.__sx = {
  cfg: { eclipse: x.cfg.eclipse, nemesis: x.cfg.nemesis, pact: x.cfg.pact, siege: x.cfg.siege, baseUp: x.cfg.baseUp, contracts: x.cfg.contracts },
  state: sxS,
  R: SXR,
  N: SXN,
  ecl: { omen: sxEclOmen, begin: sxEclBegin, end: sxEclEnd, spawn: sxEclSpawn, active: sxEclActive, bossMul: sxBossMul, spot: sxSpot, pool: sxPool },
  nem: { rise: sxNemRise, spawn: sxNemSpawn, killer: sxNemKiller, tick: sxNemTick },
  pact: { offers: sxPactOffers, seal: sxPactSeal, brk: sxPactBreak, open: sxPactOpen, ready: sxPactReady, isShrine: sxIsPactShrine, cycle: sxPactCycle, sys: sxPactSys, byB: SXP.byB, byC: SXP.byC },
  siege: { warn: sxSiegeWarn, begin: sxSiegeBegin, next: sxSiegeNext, end: sxSiegeEnd, auto: sxSiegeAuto, targets: sxSiegeTargets, pool: sxSiegePool, waves: sxSiegeWaves, present: sxSiegePresent },
  base: { lv: sxBaseLv, cost: sxBaseCost, buy: sxBaseBuy, power: sxTrophyPower, pay: sxPayTrophies },
  contracts: { wanted: sxContractsWanted, sync: sxContractsSync },
  skyInit: sxSkyInit,
  srcOf: (e) => ecoSrcOf(e),
};

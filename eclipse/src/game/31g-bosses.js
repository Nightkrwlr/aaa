// 31g-bosses.js — Jefes exclusivos y guaridas (D8)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// ── PRIMERA PIEZA DE D8: SELLO DE LA GUARIDA ─────────────────────────────────────────────────────────────────────────────────
// Antes, el jefe de cada región salía en cuanto el jugador pisaba su arena y, al abatirlo, se abría el paso a la zona siguiente:
// avanzar de zona era demasiado fácil. Ahora, mientras el jefe de una región no haya caído la primera vez, su guarida está
// SELLADA y el jefe no aparece hasta cumplir tres requisitos (se ven en la misión del jefe y en un aviso al acercarse a la arena):
//   1) MISIÓN: tener aceptada (o completada) la misión principal que pide abatirlo. Esa misión solo la ofrece su contacto cuando se
//      ha terminado la anterior, así que obliga a hacer antes la cadena de misiones de la zona.
//   2) NIVEL: el de esa misión menos una pequeña holgura.
//   3) SELLOS: «fragmentos de sello» que se ganan jugando la región (élites, nidos, terminales hackeadas, registros del Archivo,
//      encargos secundarios, puzles y operaciones). Cada fuente da como mucho `caps[fuente]` por región, para que no baste una sola.
// Tras la primera muerte del jefe la arena vuelve a funcionar como siempre (reaparece a los 30 min para farmear). Los jefes de
// operaciones y los secretos (altar) no se tocan. Todo son datos en x.cfg.bossGate.
//
// Contrato con el resto del juego:
//   · 26-spawner.js (arenaCheck) llama a bossGateArena(arena, distancia) antes de invocar al jefe.
//   · 22-quests.js (objText «boss») añade bossGateText(idJefe) a la línea de la misión.
//   · Guardado: S.bossGate = { v: 1, r: { [región]: { n: { [fuente]: cuenta }, ids: [claves ya contadas] } } }.
//   · Otros frentes pueden sumar sellos con bossGateAdd(región, fuente, clave) (p. ej. PUZLES emite 'puzzleSolved').

x.cfg.bossGate = {
  seals: [3, 3, 4, 4, 5, 5, 6, 6, 7], // fragmentos necesarios por región (índice = región)
  lvlSlack: 1, // nivel mínimo = nivel de la misión del jefe − holgura
  caps: { elite: 3, nido: 2, terminal: 2, lore: 2, encargo: 2, puzle: 2, operacion: 2 }, // máximo por fuente y región
  names: {
    elite: "élite abatida",
    nido: "nido destruido",
    terminal: "terminal hackeada",
    lore: "registro del Archivo",
    encargo: "encargo cumplido",
    puzle: "puzle resuelto",
    operacion: "operación completada",
  },
  hintEvery: 20, // segundos entre avisos al acercarse a una guarida sellada
  hintRadius: 9, // metros más allá del borde de la arena en los que avisa
};

// misión principal cuyo objetivo es abatir al jefe de la región (cacheada)
const bgQuestCache = new Map();
function bgQuestFor(reg) {
  if (bgQuestCache.has(reg)) return bgQuestCache.get(reg);
  const id = De[reg] && De[reg].boss;
  let found = null;
  if (id) for (const k in gi) if (gi[k].main && gi[k].obj.some((o) => o.t === "boss" && o.b === id)) found = k;
  bgQuestCache.set(reg, found);
  return found;
}

// fragmentos de sello conseguidos en una región (cada fuente cuenta hasta su tope)
function bossGateSeals(reg) {
  const R = x.S && x.S.bossGate && x.S.bossGate.r[reg];
  if (!R) return 0;
  let n = 0;
  for (const k in x.cfg.bossGate.caps) n += Math.min(x.cfg.bossGate.caps[k], R.n[k] || 0);
  return n;
}

// estado de los tres requisitos de la guarida de una región
function bossGateStatus(reg) {
  const S = x.S,
    C = x.cfg.bossGate,
    d = De[reg];
  const killed = !!S.world.bosses["reg" + reg];
  const qid = bgQuestFor(reg),
    q = qid ? gi[qid] : null;
  const questOk = !qid || !!(S.quests.active[qid] || S.quests.done[qid]);
  const minLvl = q ? Math.max(1, q.lvl - C.lvlSlack) : Math.max(1, d.lvl[1] - 2);
  const lvlOk = S.lvl >= minLvl;
  const have = bossGateSeals(reg),
    need = C.seals[reg] != null ? C.seals[reg] : 3;
  const sealOk = have >= need;
  const falta = [],
    corto = [];
  if (!questOk) falta.push(`misión «${q.n}» (${(zt[q.giver] && zt[q.giver].n) || "tu contacto"})`);
  if (!lvlOk) (falta.push(`nivel ${minLvl} (tienes ${S.lvl})`), corto.push(`nivel ${minLvl}`));
  if (!sealOk) (falta.push(`sellos ${have}/${need}`), corto.push(`sellos ${have}/${need}`));
  return { reg, killed, ok: killed || falta.length === 0, quest: qid, questOk, minLvl, lvlOk, have, need, sealOk, falta, corto };
}

// texto que se añade a la línea «Derrota a X» de la misión del jefe (vacío si la guarida ya está abierta)
function bossGateText(bossId) {
  if (!x.S || !x.S.bossGate) return "";
  const reg = De.findIndex((d) => d.boss === bossId);
  if (reg < 0) return "";
  const st = bossGateStatus(reg);
  return st.ok || !st.corto.length ? "" : ` · guarida sellada (${st.corto.join(" · ")})`;
}

// ¿puede aparecer el jefe de esta arena? Si no, avisa (con enfriamiento) de lo que falta cuando el jugador se acerca.
let bgHintT = -999;
function bossGateArena(arena, dist) {
  const reg = arena.reg;
  if (arena.op || arena.secret || !(reg >= 0) || !De[reg] || !x.S || !x.S.bossGate) return true;
  const st = bossGateStatus(reg);
  if (st.ok) return true;
  const C = x.cfg.bossGate;
  if (dist < arena.rad + C.hintRadius && x.time - bgHintT > C.hintEvery) {
    bgHintT = x.time;
    ee("toast", `Guarida de ${En[De[reg].boss].n} sellada · falta: ${st.falta.join(" · ")}`, "warn");
    ae.play("err");
  }
  return false;
}

// suma un fragmento de sello en una región. `clave` evita contar dos veces lo mismo (terminal, registro, encargo…)
function bossGateAdd(reg, fuente, clave) {
  const S = x.S,
    C = x.cfg.bossGate;
  if (!S || !S.bossGate || !(reg >= 0) || !De[reg] || !(fuente in C.caps)) return false;
  if (S.world.bosses["reg" + reg]) return false; // jefe ya abatido: el sello ya no hace falta
  const R = S.bossGate.r[reg] || (S.bossGate.r[reg] = { n: {}, ids: [] });
  if (clave != null) {
    const k = fuente + ":" + clave;
    if (R.ids.includes(k)) return false;
    R.ids.push(k);
    if (R.ids.length > 80) R.ids.shift();
  }
  if ((R.n[fuente] || 0) >= C.caps[fuente]) return false;
  const antes = bossGateSeals(reg);
  R.n[fuente] = (R.n[fuente] || 0) + 1;
  const have = bossGateSeals(reg),
    need = C.seals[reg] != null ? C.seals[reg] : 3;
  if (have > antes && antes < need) {
    ee("toast", `Fragmento de sello · ${De[reg].n}: ${Math.min(have, need)}/${need} (${C.names[fuente]})`, "good");
    have >= need && ee("toast", `Sello completo: la guarida de ${En[De[reg].boss].n} puede abrirse`, "good");
  }
  return true;
}

// ── fuentes de sellos ────────────────────────────────────────────────────────────────────────────────────────────────────────
function bgRegAt(e) {
  if (x.mode === "op") return x.op ? x.op.reg : -1;
  return x.map && x.map.regAt && e ? x.map.regAt(e.x, e.z) : x.regionId;
}
It("kill", (e) => {
  if (!e || e.boss || e.mini) return;
  if (e.ent && e.ent.k === "nest") bossGateAdd(bgRegAt(e), "nido", e.ent.id);
  else if (e.elite || e.champion) bossGateAdd(bgRegAt(e), "elite");
});
It("lore", (n) => {
  if (!n) return;
  bossGateAdd(n.reg != null ? n.reg : x.regionId, "lore", n.lid || n.id || n.t);
});
It("questDone", (q) => {
  if (!q || q.main) return;
  const reg = q.reg != null ? q.reg : zt[q.giver] ? zt[q.giver].reg : x.regionId;
  bossGateAdd(reg, "encargo", q.n);
});
It("puzzleSolved", (p) => {
  bossGateAdd(p && p.reg != null ? p.reg : x.regionId, "puzle", p && (p.id || p.key));
});
It("opReward", () => {
  bossGateAdd(x.op ? x.op.reg : x.regionId, "operacion", x.op && x.op.id);
});
// terminales hackeadas con éxito: el gestor de misiones las recibe en onHack (también en operaciones)
{
  const onHackPrev = ht.onHack;
  ht.onHack = function (n) {
    try {
      bossGateAdd(x.mode === "op" ? (x.op ? x.op.reg : -1) : n && n.reg, "terminal", n && n.id);
    } catch (err) {
      console.warn("sello: terminal", err);
    }
    return onHackPrev.call(this, n);
  };
}

// ── guardado ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
x.migrations.push((S) => {
  if (S.bossGate && S.bossGate.v === 1) return;
  S.bossGate = { v: 1, r: {} };
  // partidas anteriores: las terminales ya hackeadas de cada región cuentan como sellos
  const term = (S.world && S.world.term) || {};
  for (const id in term) {
    const m = /^term_(\d+)_/.exec(id);
    if (!m) continue;
    const R = S.bossGate.r[m[1]] || (S.bossGate.r[m[1]] = { n: {}, ids: [] });
    R.n.terminal = Math.min(x.cfg.bossGate.caps.terminal, (R.n.terminal || 0) + 1);
    R.ids.push("terminal:" + id);
  }
});

// ganchos de prueba (escenarios jefes-*.mjs)
window.__bossGate = { status: bossGateStatus, add: bossGateAdd, seals: bossGateSeals, text: bossGateText, cfg: x.cfg.bossGate, emit: ee };

// ── D8b · COMBATES DE JEFE EN TRES FASES ─────────────────────────────────────────────────────────────────────────────────────
// Hoy el combate es genérico: una lista de movimientos y UNA transición al 50 % de vida («FURIA»). Ahora cada jefe de región y cada jefe
// secreto tiene tres fases (100 → 66 → 33 % de vida), cada una con su aviso, un tramo corto de invulnerabilidad en el que ruge, más
// daño y velocidad, movimientos nuevos y UNA MECÁNICA PROPIA que cambia cómo se pelea:
//   · escudo_cria  el jefe recibe un 65 % menos de daño mientras vivan sus crías: hay que matarlas para romper el escudo
//   · pilares      generadores (torretas / centinelas) lo hacen invulnerable hasta destruirlos; al caer el último queda aturdido y recibe +50 %
//   · zonas        círculos de daño telegrafiados sobre el jugador (uno en su posición y otros alrededor) que estallan a los pocos segundos
//   · vacio        atrae al jugador hacia el jefe y detona al terminar: se evita esprintando (ESPACIO / ESPRINT) o saliendo del radio
//   · ventisca     el frío ralentiza al jugador cuando se aleja del jefe (obliga a pelear a media distancia)
// Además hay un TEMPORIZADOR DE FURIA: si el combate se alarga, el jefe se enfurece (más daño, más velocidad, menos pausas). No corre
// mientras el jefe está invulnerable. Todo son datos en x.cfg.bossSig; los jefes «Vástago» de las operaciones conservan su fase única.

const BG_ACID = 0x88ff44,
  BG_FIRE = 0xff7a30,
  BG_ICE = 0x9ad8ff,
  BG_ELEC = 0xffe27a,
  BG_SAND = 0xe0b060,
  BG_RAD = 0xb0ff60,
  BG_BLOOD = 0xff4a4a,
  BG_VOID = 0x9a6bff;
x.cfg.bossSig = {
  phaseAt: [0.66, 0.33], // fracción de vida que abre la fase 2 y la 3
  lockT: 1.6, // s de invulnerabilidad al cambiar de fase
  dmgPerPhase: 1.1, // el daño sube un 10 % por fase
  spdPerPhase: 1.08,
  gap: [2.3, 1.7, 1.25], // s entre movimientos en cada fase (+ 0-0,8 al azar, como antes)
  shieldMul: 0.35, // daño recibido con el escudo de crías
  stunT: 3, // s de aturdimiento al caer el último generador
  stunMul: 1.5, // daño recibido mientras está aturdido
  fury: { base: 210, perRegion: 14, secret: 300, avatar: 360, warn: 60, dmg: 1.35, spd: 1.15, gap: 0.75 }, // s hasta la furia
  default: { n2: "Furia", n3: "Frenesí", p2: {}, p3: {} },
  boss: {
    reina: {
      n2: "Cría protectora",
      n3: "Nidada frenética",
      p2: { moves: ["summon:rastrero:4"], mech: { escudo_cria: true } },
      p3: { moves: ["fan:acid:7", "charge"], mech: { escudo_cria: true, zonas: { every: 7, n: 2, r: 2.2, dmg: 0.9, delay: 1.2, color: BG_ACID, elem: "toxic" } } },
    },
    demoledor: {
      n2: "Derrumbe",
      n3: "Terremoto",
      p2: { moves: ["meteor:4"], mech: { zonas: { every: 6.5, n: 3, r: 2.4, dmg: 1.1, delay: 1.2, color: BG_FIRE } } },
      p3: { moves: ["slam", "charge"], mech: { zonas: { every: 5, n: 4, r: 2.6, dmg: 1.1, delay: 1.1, color: BG_FIRE } } },
    },
    kharsa: {
      n2: "Arenas movedizas",
      n3: "Tormenta de aguijones",
      p2: { moves: ["burrow"], mech: { zonas: { every: 6, n: 3, r: 2.0, dmg: 1.0, delay: 0.9, color: BG_SAND } } },
      p3: { moves: ["radial:orb:22", "fan:orb:9"], mech: { zonas: { every: 5, n: 4, r: 2.2, dmg: 1.0, delay: 0.9, color: BG_SAND } } },
    },
    madre: {
      n2: "Esporas protectoras",
      n3: "Podredumbre",
      p2: { moves: ["pool:6"], mech: { escudo_cria: true } },
      p3: { moves: ["spiral:acid"], mech: { escudo_cria: true, zonas: { every: 6, n: 3, r: 2.6, dmg: 0.9, delay: 1.2, color: BG_ACID, elem: "toxic" } } },
    },
    wendigo: {
      n2: "Ventisca",
      n3: "Cacería",
      p2: { moves: ["leap"], mech: { ventisca: { r: 9 } } },
      p3: { moves: ["fan:shard:11"], mech: { ventisca: { r: 9 }, zonas: { every: 6.5, n: 3, r: 2.3, dmg: 1.0, delay: 1.1, color: BG_ICE, elem: "ice", slow: true } } },
    },
    omega: {
      n2: "Generadores de escudo",
      n3: "Sobrecarga",
      p2: { moves: ["missiles:8"], mech: { pilares: { n: 2, kind: "torreta", hp: 1.6, name: "Generador de escudo" } } },
      p3: { moves: ["laser"], mech: { pilares: { n: 3, kind: "torreta", hp: 1.6, name: "Generador de escudo" }, zonas: { every: 6.5, n: 3, r: 2.2, dmg: 1.0, delay: 1.1, color: BG_ELEC } } },
    },
    ifrit: {
      n2: "Anillo de fuego",
      n3: "Erupción",
      p2: { moves: ["pool:5"], mech: { zonas: { every: 5.5, n: 4, r: 2.4, dmg: 1.0, delay: 1.1, color: BG_FIRE } } },
      p3: { moves: ["meteor:8", "nova"], mech: { zonas: { every: 4, n: 5, r: 2.4, dmg: 1.0, delay: 1.0, color: BG_FIRE } } },
    },
    horror: {
      n2: "Gravedad",
      n3: "Masa crítica",
      p2: { moves: ["nova"], mech: { vacio: { every: 11, dur: 2.2, pull: 4.5, r: 3.2, dmg: 2.2 } } },
      p3: { moves: ["radial:orb:30"], mech: { vacio: { every: 8, dur: 2.2, pull: 5, r: 3.4, dmg: 2.4 }, zonas: { every: 6.5, n: 3, r: 2.6, dmg: 1.0, delay: 1.2, color: BG_RAD, elem: "toxic" } } },
    },
    mente: {
      n2: "Voluntad colectiva",
      n3: "Eclipse mental",
      p2: { moves: ["teleport"], mech: { escudo_cria: true } },
      p3: { moves: ["laser"], mech: { pilares: { n: 3, kind: "cristalino", hp: 1.4, name: "Nodo de la Mente" }, vacio: { every: 10, dur: 2, pull: 4, r: 3, dmg: 2 }, zonas: { every: 6, n: 3, r: 2.4, dmg: 1.0, delay: 1.1, color: BG_VOID } } },
    },
    carnicero: {
      n2: "Carnicería",
      n3: "Matadero",
      p2: { moves: [], mech: { zonas: { every: 6, n: 3, r: 2.2, dmg: 1.0, delay: 1.0, color: BG_BLOOD } } },
      p3: { moves: ["charge", "slam"], mech: { zonas: { every: 4.5, n: 4, r: 2.4, dmg: 1.0, delay: 1.0, color: BG_BLOOD } } },
    },
    antiguo: {
      n2: "Resonancia",
      n3: "Coro cristalino",
      p2: { moves: ["laser"], mech: { pilares: { n: 2, kind: "cristalino", hp: 1.4, name: "Cristal resonante" } } },
      p3: { moves: ["radial:shard:30"], mech: { pilares: { n: 3, kind: "cristalino", hp: 1.4, name: "Cristal resonante" }, zonas: { every: 6, n: 3, r: 2.3, dmg: 1.0, delay: 1.1, color: BG_ICE } } },
    },
    leviatan: {
      n2: "Remolino",
      n3: "Abismo",
      p2: { moves: ["burrow"], mech: { vacio: { every: 11, dur: 2.2, pull: 4.5, r: 3.2, dmg: 2.2 } } },
      p3: { moves: ["fan:acid:9"], mech: { vacio: { every: 8, dur: 2.2, pull: 5, r: 3.4, dmg: 2.4 }, zonas: { every: 6, n: 3, r: 2.4, dmg: 1.0, delay: 1.1, color: BG_ACID, elem: "toxic" } } },
    },
    titan: {
      n2: "Núcleos de energía",
      n3: "Fusión",
      p2: { moves: ["missiles:12"], mech: { pilares: { n: 2, kind: "torreta", hp: 1.8, name: "Núcleo de energía" } } },
      p3: { moves: ["slam"], mech: { pilares: { n: 3, kind: "torreta", hp: 1.8, name: "Núcleo de energía" }, zonas: { every: 6, n: 3, r: 2.4, dmg: 1.0, delay: 1.1, color: BG_ELEC } } },
    },
    avatar: {
      n2: "Marea del Vacío",
      n3: "Fin de la luz",
      p2: { moves: ["nova"], mech: { vacio: { every: 10, dur: 2.2, pull: 5, r: 3.4, dmg: 2.4 }, zonas: { every: 6.5, n: 3, r: 2.4, dmg: 1.0, delay: 1.1, color: BG_VOID } } },
      p3: { moves: ["radial:orb:32", "laser"], mech: { pilares: { n: 3, kind: "cristalino", hp: 1.6, name: "Fragmento del Vacío" }, vacio: { every: 8, dur: 2.2, pull: 5.5, r: 3.6, dmg: 2.6 }, zonas: { every: 5, n: 4, r: 2.4, dmg: 1.0, delay: 1.0, color: BG_VOID } } },
    },
  },
};

const BG = { live: new Set() }; // jefes con estado de fases (para limpiar generadores si el jefe muere o se retira)
function bgSpec(b) {
  return x.cfg.bossSig.boss[b.id] || x.cfg.bossSig.default;
}
function bgInit(b) {
  const F = x.cfg.bossSig.fury,
    reg = De.findIndex((d) => d.boss === b.id),
    fury = b.def.secret ? (b.id === "avatar" ? F.avatar : F.secret) : F.base + F.perRegion * Math.max(0, reg);
  BG.live.add(b);
  return (b.sig = { lock: 0, stun: 0, fury, furyMax: fury, enraged: false, shieldOn: false, zones: [], pylons: [], zT: null, vT: null, vac: null, linkT: 0, adsT: 0, said: {} });
}
const bgRoman = (n) => (n === 2 ? "II" : n === 3 ? "III" : "I");

// una sola vez por jefe y tipo de aviso (no repetir el mismo consejo cada pocos segundos)
function bgSay(b, key, txt, kind = "warn") {
  if (b.sig.said[key]) return;
  b.sig.said[key] = 1;
  ee("toast", txt, kind);
}

// fases: se llama cada fotograma antes de la IA del jefe
function bgPhase(b) {
  const S = b.sig,
    C = x.cfg.bossSig;
  if (S.lock > 0 || S.pylons.length || b.phase >= 3) return;
  if (b.hp < b.maxHp * C.phaseAt[b.phase - 1]) bgEnterPhase(b, b.phase + 1);
}
function bgEnterPhase(b, n) {
  const S = b.sig,
    C = x.cfg.bossSig,
    spec = bgSpec(b),
    ph = spec["p" + n] || {};
  b.phase = n;
  S.lock = C.lockT;
  S.stun = 0; // el rugido de la nueva fase corta el aturdimiento
  S.zT = null;
  S.vT = null;
  S.vac = null;
  b.dmg *= C.dmgPerPhase;
  b.spd *= C.spdPerPhase;
  for (const m of ph.moves || []) b.moves.push(m);
  // lo que estuviera haciendo (cavar, saltar…) se corta como cuando termina un movimiento
  b.act = null;
  b.burrowed = false;
  b.leapY = 0;
  b.rig.root.visible = true;
  b.moveT = C.lockT + 0.8;
  ae.play("roar");
  x.R.addShake(0.7);
  x.fx.ring(b.x, b.z, 9, b.def.m.e, 0.9);
  ee("banner", "FASE " + bgRoman(n), spec["n" + n] || "", "#ff6a6a");
  const sm = b.def.moves.find((r) => r.startsWith("summon"));
  if (sm) {
    const [, r, o] = sm.split(":");
    b.summon(r, Math.ceil(+o * (n === 2 ? 1.2 : 1.5)));
  }
  if (ph.mech && ph.mech.pilares) bgSpawnPylons(b, ph.mech.pilares);
}

// generadores: enemigos estáticos que sostienen el escudo del jefe
function bgSpawnPylons(b, cfg) {
  const S = b.sig;
  const a0 = Q() * 6.283;
  for (let i = 0; i < cfg.n; i++) {
    const a = a0 + (i / cfg.n) * 6.283,
      [px, pz] = x.map.findFree(b.x + Math.cos(a) * 7, b.z + Math.sin(a) * 7, 4, 0.8),
      e = In(cfg.kind, b.lvl, px, pz, { alerted: true, hpMul: cfg.hp, name: cfg.name });
    e.pylonOf = b;
    S.pylons.push(e);
    x.fx.burst(px, 0.4, pz, 14, { color: b.def.m.e, speed: 3, life: 0.7, size: 0.3, up: 1 });
  }
  b.invuln = true;
  ee("toast", `¡Escudo activo! Destruye los generadores (${cfg.n}) para poder dañarlo`, "warn");
}
function bgPylonsDown(b) {
  const S = b.sig;
  b.invuln = false;
  S.stun = x.cfg.bossSig.stunT;
  b.act = null;
  b.burrowed = false;
  b.leapY = 0;
  b.rig.root.visible = true;
  ae.play("success");
  x.R.addShake(0.5);
  x.fx.ring(b.x, b.z, 7, 0x9ad8ff, 0.8);
  ee("banner", "ESCUDO ROTO", "¡Aturdido! Recibe más daño", "#9ad8ff");
}
function bgKillPylons(b) {
  for (const e of b.sig.pylons) if (!e.dead) ((e.dead = true), (e.deadT = 0));
  b.sig.pylons.length = 0;
}

// zonas telegrafiadas
function bgZones(b, S, cfg, dt) {
  const p = x.player;
  if ((S.zT = (S.zT ?? cfg.every * 0.6) - dt) <= 0 && !S.lock) {
    S.zT = cfg.every * (0.85 + Q() * 0.3);
    for (let i = 0; i < cfg.n; i++) {
      const ang = Q() * 6.283,
        d = i === 0 ? 0 : 1.5 + Q() * 4.5,
        zx = p.x + (i === 0 ? p.vx * 0.35 : 0) + Math.cos(ang) * d,
        zz = p.z + (i === 0 ? p.vz * 0.35 : 0) + Math.sin(ang) * d;
      x.fx.telegraph(zx, zz, cfg.r, cfg.delay, cfg.color);
      S.zones.push({ t: cfg.delay, x: zx, z: zz, r: cfg.r, dmg: b.dmg * cfg.dmg, color: cfg.color, elem: cfg.elem, slow: cfg.slow });
    }
  }
}
function bgZonesRun(b, S, dt) {
  for (let i = S.zones.length - 1; i >= 0; i--) {
    const z = S.zones[i];
    if ((z.t -= dt) > 0) continue;
    S.zones.splice(i, 1);
    dn(z.x, z.z, z.r, z.dmg, { owner: "e", color: z.color, elem: z.elem });
    if (z.slow && Le(x.player.x, x.player.z, z.x, z.z) < z.r + x.player.r) x.player.slowT = Math.max(x.player.slowT, 2.2);
  }
}

// vacío: atrae al jugador y detona
function bgVacio(b, S, cfg, dt) {
  const p = x.player;
  if (S.vac) {
    const v = S.vac;
    if (!(p.dashT > 0) && !p.dead) {
      const dx = b.x - p.x,
        dz = b.z - p.z,
        d = Math.hypot(dx, dz) || 1;
      if (d > b.rad + 1.2) {
        const st = Math.min(cfg.pull * dt, d - b.rad - 1);
        const [nx, nz] = x.map.slideMove(p.x, p.z, p.r, (dx / d) * st, (dz / d) * st);
        p.x = nx;
        p.z = nz;
      }
    }
    if ((v.t -= dt) <= 0) {
      S.vac = null;
      dn(b.x, b.z, cfg.r + b.rad, b.dmg * cfg.dmg, { owner: "e", color: BG_VOID });
      x.R.addShake(0.5);
    } else if ((v.fx -= dt) <= 0) {
      v.fx = 0.3;
      x.fx.ring(b.x, b.z, cfg.r + b.rad + 2, BG_VOID, 0.3);
    }
  } else if ((S.vT = (S.vT ?? cfg.every * 0.7) - dt) <= 0 && !S.lock) {
    S.vT = cfg.every;
    S.vac = { t: cfg.dur, fx: 0 };
    x.fx.telegraph(b.x, b.z, cfg.r + b.rad, cfg.dur, BG_VOID);
    ae.play("roar", { v: 0.4 });
    bgSay(b, "vacio", `¡Gravedad! Te arrastra hacia el jefe: esprinta (${Tt.touchMode ? "ESPRINT" : "ESPACIO"}) o aléjate antes de que detone`);
  }
}

function bgFury(b, S) {
  const F = x.cfg.bossSig.fury;
  S.enraged = true;
  b.dmg *= F.dmg;
  b.spd *= F.spd;
  ae.play("roar");
  x.R.addShake(0.8);
  x.fx.ring(b.x, b.z, 10, 0xff3030, 1);
  ee("banner", "¡FURIA!", "El jefe pierde la paciencia", "#ff3030");
}

// por fotograma, tras la IA del jefe
function bgBossTick(b, dt, dist) {
  const S = b.sig,
    C = x.cfg.bossSig,
    spec = bgSpec(b),
    ph = spec["p" + b.phase],
    mech = (ph && ph.mech) || {},
    p = x.player;
  // generadores caídos
  if (S.pylons.length) {
    S.pylons = S.pylons.filter((e) => !e.dead);
    if (!S.pylons.length) bgPylonsDown(b);
    else if ((S.linkT -= dt) <= 0) {
      S.linkT = 0.4;
      for (const e of S.pylons) x.fx.zap(e.x, e.z, b.x, b.z, 0x9ad8ff, 0.8);
    }
  }
  // invulnerabilidad: transición de fase o generadores en pie (se vuelve a fijar cada fotograma: la IA la limpia al acabar un movimiento)
  S.lock = Math.max(0, S.lock - dt);
  b.invuln = S.lock > 0 || S.pylons.length > 0;
  if (b.invuln && (S.adsT -= dt) <= 0) {
    S.adsT = 1.1;
    x.fx.ring(b.x, b.z, b.rad + 1.2, 0x9ad8ff, 0.35);
  }
  // escudo de crías (cada 0,25 s se cuentan las vivas: no depende del contador de invocaciones)
  if (mech.escudo_cria) {
    if ((S.adsT2 = (S.adsT2 ?? 0) - dt) <= 0) {
      S.adsT2 = 0.25;
      let n = 0;
      for (const e of x.enemies) if (e.parent === b && !e.dead) n++;
      S.shieldOn = n > 0;
      S.adds = n;
    }
    if (S.shieldOn) bgSay(b, "escudo", "El jefe está protegido por sus crías: mátalas para romper el escudo");
  } else S.shieldOn = false;
  // furia: no corre con el jefe invulnerable
  if (!S.enraged && !b.invuln && (S.fury -= dt) <= 0) bgFury(b, S);
  if (!S.lock) {
    if (mech.zonas) bgZones(b, S, mech.zonas, dt);
    if (mech.vacio) bgVacio(b, S, mech.vacio, dt);
    if (mech.ventisca && dist > mech.ventisca.r + b.rad && !p.dead) {
      p.slowT = Math.max(p.slowT, 0.5);
      bgSay(b, "ventisca", "La ventisca te ralentiza lejos del jefe: acércate o ataca a media distancia");
    }
  }
  if (S.zones.length) bgZonesRun(b, S, dt);
}

// «Vástago» (jefes de operación): conservan la transición única de siempre al 50 %
function bgLegacyPhase(b) {
  if (b.phase !== 1 || b.hp >= b.maxHp * 0.5) return;
  b.phase = 2;
  b.spd *= 1.25;
  ae.play("roar");
  x.R.addShake(0.6);
  x.fx.ring(b.x, b.z, 8, b.def.m.e, 0.8);
  b.moveT = 0.5;
  const a = b.def.moves.find((r) => r.startsWith("summon"));
  if (a) {
    const [, r, o] = a.split(":");
    b.summon(r, Math.ceil(+o * 1.5));
  }
}

// ganchos en la clase de enemigo (vp)
{
  const upd = vp.prototype.updateBoss,
    mul = vp.prototype.dmgTakenMul;
  vp.prototype.updateBoss = function (dt, dist) {
    if (this.mini || !this.alerted) {
      this.mini && this.alerted && bgLegacyPhase(this);
      return upd.call(this, dt, dist);
    }
    const S = this.sig || bgInit(this);
    bgPhase(this);
    if (S.stun > 0) {
      // aturdido tras romper el escudo: no actúa (sigue de pie, vulnerable)
      S.stun = Math.max(0, S.stun - dt);
      this.invuln = false;
      return 0;
    }
    const r = upd.call(this, dt, dist);
    bgBossTick(this, dt, dist);
    return r;
  };
  vp.prototype.dmgTakenMul = function () {
    let m = mul.call(this);
    const S = this.sig;
    if (S) {
      if (S.shieldOn) m *= x.cfg.bossSig.shieldMul;
      if (S.stun > 0) m *= x.cfg.bossSig.stunMul;
    }
    return m;
  };
}
// pausa entre movimientos según la fase (21-enemies.js) y etiqueta de la barra de jefe (27-hud.js)
function bossMoveGap(b) {
  if (!b.sig) return b.phase === 2 ? 1.5 : 2.3;
  const C = x.cfg.bossSig;
  return C.gap[Math.min(2, b.phase - 1)] * (b.sig.enraged ? C.fury.gap : 1);
}
function bossHudTag(g) {
  const S = g.sig;
  if (!S) return g.phase === 2 ? " · FURIA" : "";
  const C = x.cfg.bossSig,
    spec = bgSpec(g);
  let t = g.phase > 1 ? ` · FASE ${bgRoman(g.phase)}${spec["n" + g.phase] ? " · " + spec["n" + g.phase] : ""}` : "";
  if (S.pylons.length) t += ` · GENERADORES ${S.pylons.length}`;
  else if (S.stun > 0) t += " · ATURDIDO";
  else if (S.shieldOn) t += ` · ESCUDO (crías ${S.adds || 0})`;
  if (S.enraged) t += " · ¡FURIA!";
  else if (!g.invuln && S.fury < C.fury.warn) t += ` · FURIA ${Math.floor(S.fury / 60)}:${String(Math.max(0, Math.ceil(S.fury) % 60)).padStart(2, "0")}`;
  return t;
}

// limpieza: al morir o retirarse el jefe no deben quedar generadores sueltos ni zonas
x.tick.push(() => {
  for (const b of BG.live)
    if (b.dead) {
      bgKillPylons(b);
      BG.live.delete(b);
    }
});

// marcas de fase (33 % y 66 %) en la barra de vida del jefe y título que se ajusta (muchas etiquetas)
{
  const st = document.createElement("style");
  st.textContent = `#bossbar .bar::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:3;background:linear-gradient(90deg,transparent calc(33% - 1px),rgba(255,255,255,.5) calc(33% - 1px),rgba(255,255,255,.5) calc(33% + 1px),transparent calc(33% + 1px),transparent calc(66% - 1px),rgba(255,255,255,.5) calc(66% - 1px),rgba(255,255,255,.5) calc(66% + 1px),transparent calc(66% + 1px))}
#bossbar .bt{white-space:normal;line-height:1.15}
body.touch #bossbar .bt{font-size:9.5px}`;
  document.head.appendChild(st);
}

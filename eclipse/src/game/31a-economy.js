// 31a-economy.js — Botín con hitos, rarezas, curva de XP, dificultad, trofeos y venta (D1+D4)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// Contenido (en este orden):
//   1. Datos           x.cfg.econ (rarezas por fuente, tasas de botín, XP, dificultad, tienda, ascenso)
//   2. Rarezas         ecoRoll() · rollLoot(src, lvl, ctx): API única de botín (descriptores, sin efectos)
//   3. Aparición       ecoKillLoot() · ecoChestLoot() (las llaman Tx y Co en 20-pickups.js)
//   4. Trofeos         tabla por enemigo, S.junk, ejemplar perfecto, venta y colecciones
//   5. Hitos           evento 'milestone': destello, ralentización, banner, pilar, ping en el minimapa, Registro
//   6. XP              curva derivada de tiempos objetivo + XP que no viene de matar
//   7. Ascenso         Sigilos de jefe y Fragmentos de Eclipse (S.sig, S.eclipseFrag)
//   8. Tienda y venta  stock limitado, precios, pestaña Vender, Comprador de curiosidades
//   9. Pestaña Botín   interfaz del inventario
//  10. Migración y depuración


// ════════════════════════════════════════════════════════════════════════
// 1. DATOS
// ════════════════════════════════════════════════════════════════════════
// Todo número de equilibrio vive aquí y se justifica con tools/sim/loot.mjs y tools/sim/xp.mjs.
x.cfg.econ = {
  // Rarezas (porcentaje; el orden es el de Ct: Común, Poco común, Raro, Épico, Legendario, Mítico).
  // Tabla del contrato (DEPTH_DESIGN §2.2). La suerte solo multiplica los tramos ≥ Raro que la fuente ya permite.
  rar: {
    normal: [72, 23, 5, 0, 0, 0],
    elite: [50, 33, 14, 3, 0, 0],
    champion: [28, 40, 25, 6.8, 0.2, 0],
    // cofre de tier 2 (no está en el contrato): a medio camino entre «normal» y «élite»
    chest2: [62, 29, 8, 1, 0, 0],
    boss: [0, 30, 50, 17, 3, 0],
    bossSecret: [0, 20, 50, 25, 4.6, 0.4],
    bossFinal: [0, 0, 40, 40, 18, 2],
    // la tienda nunca vende Raro ni superior: lo bueno hay que ganarlo
    shop: [70, 30, 0, 0, 0, 0],
  },
  // alias de fuentes → tabla de rarezas
  srcRar: { chest1: "normal", chest3: "champion", secret: "champion", miniboss: "champion", event: "elite", quest: "elite", op: "elite" },
  luckCap: 2, // la suerte (Ex()) se acota a ×1…×2

  // Qué suelta cada fuente. Probabilidades por muerte (o por cofre/evento). `mod`/`plan` pueden ser > 1 (esperanza de piezas).
  //  cr: [prob, multiplicador de cuantía]   mat: multiplicador de las probabilidades por familia
  //  tro: prob. de trofeo (null = la propia del enemigo)   perf: prob. de «ejemplar perfecto»
  drop: {
    normal: { cr: [0.2, 1], mat: 1, tro: null, perf: 0.015, mod: 0.005, plan: 0.0015, hp: 0.022, gren: 0.009, med: 0.005, cap: 0.005 },
    elite: { cr: [1, 5], mat: 3, tro: 0.7, perf: 0.06, mod: 0.03, plan: 0.008, hp: 0.06, gren: 0.05, med: 0.04, cap: 0.25 },
    champion: { cr: [1, 12], mat: 6, tro: 1, perf: 0.15, mod: 0.6, plan: 0.2, hp: 0.3, gren: 0.2, med: 0.2, cap: 1 },
    miniboss: { cr: [1, 14], mat: 6, tro: 1, perf: 0.2, mod: 0.8, plan: 0.3, hp: 0.3, gren: 0.2, med: 0.2, cap: 1 },
    // jefes: UNA pieza «firma» (plano) con la tabla del jefe; los módulos salen de otra tabla (modSrc, suelo modFloor).
    // Con 3 tiradas por la tabla del jefe el primer Épico llegaría en la primera hora, no a las 3-4 h del contrato.
    boss: { cr: [1, 40], mat: 0, tro: 1, perf: 0, mod: 2, modSrc: "normal", modFloor: 1, plan: 1, hp: 1, gren: 0.5, med: 0.5, cap: 1 },
    bossSecret: { cr: [1, 60], mat: 0, tro: 1, perf: 0, mod: 2, modSrc: "champion", modFloor: 1, plan: 2, hp: 1, gren: 0.5, med: 0.5, cap: 1 },
    bossFinal: { cr: [1, 90], mat: 0, tro: 1, perf: 0, mod: 3, modSrc: "champion", modFloor: 1, plan: 2, hp: 1, gren: 0.5, med: 0.5, cap: 1 },
  },
  // materiales por familia: [material, probabilidad base, cantidad mín, máx]. Menos recogidas, más cuantía.
  mats: {
    insect: [["bio", 0.08, 1, 2], ["scrap", 0.02, 1, 2]],
    mutant: [["bio", 0.08, 1, 2], ["scrap", 0.02, 1, 2]],
    mech: [["scrap", 0.1, 1, 3], ["core", 0.006, 1, 1], ["battery", 0.02, 1, 1]],
    xeno: [["crystal", 0.035, 1, 1], ["bio", 0.04, 1, 2]],
    any: [["scrap", 0.02, 1, 1], ["battery", 0.015, 1, 1]],
    crystalAt8: 0.008, // cristal genérico a partir del nivel 8
  },
  // cofres (tier 1-3): número de módulos, probabilidad de plano, orbes de crédito
  chest: {
    modules: { 1: 0.4, 2: 0.8, 3: 1.4 },
    plan: { 1: 0.03, 2: 0.08, 3: 0.3 },
    credits: [10, 15], // base + rango (× nivel × (1+tier))
  },
  // trofeos
  trophy: {
    pBase: 0.24, // enemigo de 2 xp (el contrato dice 18-30 %; con ≈ 30 recogidas por 100 muertes hace falta 24-36 %)
    pMax: 0.36, // enemigo duro
    pPerXp: 0.012, // +1,2 % por punto de xp del enemigo
    perfectMult: 8, // valor del «ejemplar perfecto»
    kv: 2.1, // valor de venta = kv · créditos(nivel de referencia) · √xp  (calibrado con tools/sim/loot.mjs)
    collectionMult: 1.5, // Comprador de curiosidades
    life: 150, // segundos en el suelo
  },
  // XP: tiempos objetivo acumulados (minutos de juego activo para ALCANZAR cada nivel) y supuestos de la curva
  xp: {
    minutesTo: { 2: 1, 5: 10, 10: 45, 20: 240, 30: 600, 40: 1200, 48: 1800, 60: 3600 },
    killsPerMin: 20, // ritmo de combate activo (contrato: 15-20 muertes/min + misiones)
    killShare: 0.7, // el resto (≈30 %) llega por misiones, descubrimientos, lore y primeras muertes de jefe
    eliteShare: 0.04, // fracción de muertes que son élites (cuentan ×5 XP)
    levelCap: 44, // la penalización por nivel superior se mide contra min(nivel, 44): el techo del mundo es 46
    // XP de descubrimiento, como fracción de la barra del nivel actual
    firstRegion: 0.12,
    bestiary: 0.012,
    lore: 0.03,
    firstBoss: 0.3,
    firstSecretBoss: 0.5,
  },
  // dificultad
  diff: {
    earlyDmg: 1.4, // multiplicador de daño enemigo en el nivel 1…
    earlyUntil: 15, // …que se diluye linealmente hasta ×1,0 en este nivel
    eliteWorld: 0.1, // probabilidad de que una manada del mundo lleve un élite (antes 0,045)
    eliteOp: 0.12, // en operaciones (antes 0,07-0,08 en el mundo)
    eventT: [150, 120], // emboscadas: base + rango en segundos (antes 200 + 160)
    medkitPrice: 0.75, // botiquines más baratos para compensar las curaciones escasas del suelo
  },
  // tienda
  shop: {
    priceMult: 2.5, // precios ×2,5 sobre el valor anterior
    plans: 2,
    modules: 3,
    rotationMin: 45,
    moduleT2: 0.25, // probabilidad de que un módulo sea T2 (nunca más)
  },
  // ruta de ascenso a Legendario (Épico → Legendario)
  ascend: { sigils: 3, fragments: 1, creditMult: 3, crystal: 14, core: 10, data: 8 },
  // hitos: duración del banner (s), ralentización (s, escala)
  milestone: { banner: { 3: 4.2, 4: 7, 5: 9 }, slow: { 3: [0.35, 0.3], 4: [0.5, 0.22], 5: [0.7, 0.18] } },
};
var ecoCfg = x.cfg.econ;

// Bosses principales (los que dan Sigilo en su primera muerte). Los secretos tienen `secret` en su definición.
var ecoMainBosses = ["reina", "demoledor", "kharsa", "madre", "wendigo", "omega", "ifrit", "horror", "mente"];

// RNG de botín: el global del juego (Lt). En simulaciones se puede sustituir (ecoRnd.fn) para reproducir resultados.
var ecoRnd = { fn: null };
function ecoQ() {
  return ecoRnd.fn ? ecoRnd.fn() : Q();
}
function ecoInt(a, b) {
  return a + Math.floor(ecoQ() * (b - a + 1));
}
function ecoPick(arr) {
  return arr[Math.floor(ecoQ() * arr.length)];
}


// ════════════════════════════════════════════════════════════════════════
// 2. RAREZAS Y rollLoot
// ════════════════════════════════════════════════════════════════════════
// Rareza (índice de Ct) para una fuente. `luck` es un multiplicador (1 = sin suerte) acotado a ×1…×luckCap y aplicado
// solo a los tramos ≥ Raro que la tabla ya permite: la suerte nunca crea una rareza que la fuente no concede.
// `minR` es un suelo que imponen algunos llamadores (recompensas de operación…).
function ecoRoll(src, luck = 1, minR = 0) {
  let tbl = ecoCfg.rar[ecoCfg.srcRar[src] || src] || ecoCfg.rar.normal,
    L = qe(luck, 1, ecoCfg.luckCap),
    tot = 0,
    w = tbl.map((p, i) => {
      let v = i < minR ? 0 : i >= 2 ? p * L : p;
      return ((tot += v), v);
    });
  if (tot <= 0) return minR;
  let s = ecoQ() * tot;
  for (let i = 0; i < w.length; i++) if (((s -= w[i]), s < 0)) return i;
  return w.length - 1;
}

// Factor de suerte actual del jugador (cuenta botín del equipo, Fortuna, Estrella de la suerte y dificultad), acotado.
function ecoLuck() {
  return x.player ? qe(Ex(), 1, ecoCfg.luckCap) : 1;
}

// Multiplicador de créditos del jugador (Sx: talentos, Fortuna…)
function ecoCredMul() {
  return x.player ? Sx() : 1;
}

// Módulo de arma/equipo para una rareza dada: los Épicos son T3, los Legendarios y Míticos son módulos de poder.
function ecoModDesc(r) {
  return r >= 4 ? { k: "mod", r, pow: true } : { k: "mod", r, tier: qe(r, 1, 5) };
}

// Cuántas piezas caen con "esperanza" e (parte entera segura + resto por azar)
function ecoCount(e) {
  return Math.floor(e) + (ecoQ() < e - Math.floor(e) ? 1 : 0);
}

// Probabilidad de trofeo del enemigo (18-30 % según su dureza)
function ecoTrophyChance(def) {
  let t = ecoCfg.trophy;
  return qe(t.pBase + t.pPerXp * (Math.min(12, def.xp || 2) - 2), t.pBase, t.pMax);
}

// API ÚNICA DE BOTÍN. Devuelve una lista de descriptores {k, …} sin crear nada en el mundo:
//   {k:'xp',val} {k:'cr',val} {k:'mat',mat,val} {k:'hp',val} {k:'cons',cons} {k:'cap',buff}
//   {k:'plan',r} {k:'mod',r,tier|pow} {k:'trophy',id,perfect}
// src: normal · elite · champion · miniboss · boss · bossSecret · bossFinal · chest1-3 · secret · event · quest · op
// ctx: { e: enemigo (familia, definición, id), luck: multiplicador (por defecto el del jugador), tier: tier de cofre }
function rollLoot(src, lvl, ctx = {}) {
  let out = [],
    cfg = ecoCfg,
    isChest = src.startsWith("chest") || src === "secret",
    luck = ctx.luck ?? ecoLuck(),
    rsrc = cfg.srcRar[src] || src;
  if (isChest) return ecoChestRolls(src, lvl, ctx, luck);
  let d = cfg.drop[src] || cfg.drop[rsrc] || cfg.drop.normal,
    e = ctx.e,
    cr = mt.credits(lvl) * (ctx.cred ?? ecoCredMul());
  // créditos: menos recogidas, más cuantía (el doble por recogida con la mitad de probabilidad)
  if (ecoQ() < d.cr[0]) {
    let v = (4 + ecoQ() * 6) * cr * d.cr[1],
      n = src.startsWith("boss") ? 8 : src === "elite" || src === "champion" ? 3 : 1;
    for (let i = 0; i < n; i++) out.push({ k: "cr", val: v / n });
  }
  // materiales por familia
  if (e && d.mat > 0) {
    let fam = cfg.mats[e.fam] || [];
    for (let [m, p, a, b] of [...fam, ...cfg.mats.any]) if (ecoQ() < p * d.mat) out.push({ k: "mat", mat: m, val: ecoInt(a, b) });
    if (lvl >= 8 && ecoQ() < cfg.mats.crystalAt8 * d.mat) out.push({ k: "mat", mat: "crystal", val: 1 });
  }
  if (src.startsWith("boss")) {
    out.push({ k: "mat", mat: "core", val: ecoInt(2, 4) }, { k: "mat", mat: "data", val: ecoInt(1, 3) });
  }
  // consumibles y curación (escasos)
  ecoQ() < d.hp && out.push({ k: "hp", val: 0.12 });
  ecoQ() < d.gren && out.push({ k: "cons", cons: "grenade" });
  ecoQ() < d.med && out.push({ k: "cons", cons: "medkit" });
  ecoQ() < d.cap && out.push({ k: "cap" });
  // trofeo
  if (e && e.def && ecoTrophyNames[e.id]) {
    let p = d.tro ?? ecoTrophyChance(e.def);
    if (ecoQ() < p) out.push({ k: "trophy", id: e.id, perfect: ecoQ() < d.perf });
  }
  // módulos y planos con la tabla de rarezas de la fuente
  for (let i = ecoCount(d.mod); i > 0; i--) out.push(ecoModDesc(ecoRoll(d.modSrc || src, luck, d.modFloor || 0)));
  // los planos de rareza ≥ Raro no caen de enemigos normales (solo de élites, cofres, jefes y misiones)
  for (let i = ecoCount(d.plan); i > 0; i--) out.push({ k: "plan", r: src === "normal" ? Math.min(1, ecoRoll(src, luck)) : ecoRoll(src, luck), fresh: src.startsWith("boss") });
  ecoGadgetPlan(out, src, lvl);
  return out;
}

// Gancho con el frente de gadgets (DEPTH_DESIGN §4): si existe gadgetPlanDrop(src, lvl) y devuelve un plano, se añade al botín
// como {k:'gplan', plan}; al aparecer se emite 'gadgetPlanDrop'(plan, {x, z}) para que ese frente lo materialice.
function ecoGadgetPlan(out, src, lvl) {
  if (typeof gadgetPlanDrop !== "function") return;
  let p = gadgetPlanDrop(src, lvl);
  p && out.push({ k: "gplan", plan: p });
}

// Cofres: pocas recogidas pero con peso (créditos en 2 orbes, materiales una vez por tipo)
function ecoChestRolls(src, lvl, ctx, luck) {
  let c = ecoCfg.chest,
    t = ctx.tier ?? (src === "chest3" || src === "secret" ? 3 : src === "chest2" ? 2 : 1),
    out = [],
    mods = ecoCount(c.modules[t] ?? 1);
  for (let i = 0; i < mods; i++) out.push(ecoModDesc(ecoRoll(src, luck, t >= 3 ? 1 : 0)));
  ecoQ() < (c.plan[t] ?? 0.05) && out.push({ k: "plan", r: ecoRoll(src, luck, t >= 3 ? 1 : 0) });
  let cr = (c.credits[0] + ecoQ() * c.credits[1]) * mt.credits(lvl) * (1 + t) * (ctx.cred ?? ecoCredMul());
  out.push({ k: "cr", val: cr / 2 }, { k: "cr", val: cr / 2 });
  let pool = ["scrap", "bio", "crystal", "battery"],
    got = {};
  for (let i = 0; i < t + 1; i++) {
    let m = ecoPick(pool);
    got[m] = (got[m] || 0) + (m === "crystal" ? 1 : ecoInt(2, 4));
  }
  for (let m in got) out.push({ k: "mat", mat: m, val: got[m] });
  t >= 2 && out.push({ k: "mat", mat: "core", val: t >= 3 ? ecoInt(1, 2) : 1 });
  t >= 2 && ecoQ() < 0.5 && out.push({ k: "mat", mat: "data", val: 1 });
  ecoQ() < 0.5 && out.push({ k: "cons", cons: ecoPick(["grenade", "medkit", "stim"]) });
  ecoQ() < 0.25 + t * 0.1 && out.push({ k: "cap", life: 40 });
  ecoGadgetPlan(out, src, lvl);
  return out;
}

// Fuente de rarezas de un enemigo
function ecoSrcOf(n) {
  if (n.boss && n.mini) return "miniboss";
  if (n.boss) return n.id === "mente" ? "bossFinal" : n.def && n.def.secret ? "bossSecret" : "boss";
  if (n.champion) return "champion";
  return n.elite ? "elite" : "normal";
}


// ════════════════════════════════════════════════════════════════════════
// 3. APARICIÓN EN EL MUNDO
// ════════════════════════════════════════════════════════════════════════
// Orbes de XP fundidas: una por ráfaga (0,6 s y 12 m; la XP se atrae desde 22 m, así que dónde cae importa poco); el suelo no se llena de bolitas.
var ecoOrb = { p: null, t: -9 };
function ecoXpOrb(n, xpVal, boss) {
  let o = ecoOrb;
  if (!boss && o.p && x.time - o.t < 0.6 && x.pickups.includes(o.p) && !o.p.mag && Le(o.p.x, o.p.z, n.x, n.z) < 12) {
    o.p.val += xpVal;
    return;
  }
  let orbs = boss ? 3 : 1;
  for (let i = 0; i < orbs; i++) {
    let p = Nt("xp", n.x, n.z, { val: xpVal / orbs, spd: boss ? 5 : 2.5 });
    if (!boss) ((o.p = p), (o.t = x.time));
  }
}

// Convierte un descriptor en objeto del mundo. `at` = {x, z}. Devuelve el pickup o el objeto creado.
function ecoSpawn(d, at, lvl, src) {
  let p;
  switch (d.k) {
    case "cr":
      return Nt("cr", at.x, at.z, { val: d.val, spd: at.spd });
    case "mat":
      return Nt("mat", at.x, at.z, { mat: d.mat, val: d.val, spd: at.spd });
    case "hp":
      return Nt("hp", at.x, at.z, { val: d.val, spd: at.spd });
    case "cons":
      return Nt("cons", at.x, at.z, { cons: d.cons, val: 1, spd: at.spd });
    case "cap":
      return Nt("cap", at.x, at.z, { buff: Yt(wo), life: d.life || 25, spd: at.spd });
    case "trophy":
      return ecoDropTrophy(d.id, d.perfect, at);
    case "gplan":
      return (ee("gadgetPlanDrop", d.plan, { x: at.x, z: at.z }, src), d.plan);
    case "plan": {
      let it = us(lvl, { rarity: d.r, newChance: d.fresh ? 0.9 : 0.75, luck: 0 });
      d.r >= 4 && ecoMakeUnique(it);
      p = Nt("item", at.x, at.z, { item: it, life: 300, spd: at.spd });
      ecoDropped(p, it, src);
      return p;
    }
    case "mod": {
      let ch = d.pow ? xi(lvl, { pow: true }) : xi(lvl, { tier: d.tier });
      p = Nt("chip", at.x, at.z, { chip: ch, life: 300, spd: at.spd });
      ecoDropped(p, ch, src);
      return p;
    }
  }
}

// Botín de una muerte (lo llama Tx). `n` es el enemigo.
function ecoKillLoot(n) {
  let e = x.S,
    src = ecoSrcOf(n),
    s = n.xpVal || 1,
    over = Math.min(e.lvl, ecoCfg.xp.levelCap) - n.lvl;
  // un enemigo muy por debajo de tu nivel da menos XP (el tope evita castigar el final del mundo, nivel 46)
  over > 2 && !n.boss && (s *= Math.max(0.1, 1 - 0.18 * (over - 2)));
  ecoXpOrb(n, s, n.boss);
  for (let d of rollLoot(src, n.lvl, { e: n })) ecoSpawn(d, { x: n.x, z: n.z, spd: n.boss ? 5 : undefined }, n.lvl, src);
}

// Botín de cofre / evento (lo llama Co). tier 1-3
function ecoChestLoot(px, pz, tier, lvl, opt = {}) {
  let src = opt.src || (tier >= 3 ? "chest3" : tier === 2 ? "chest2" : "chest1");
  for (let d of rollLoot(src, lvl, { tier })) ecoSpawn(d, { x: px, z: pz, spd: 3 }, lvl, src);
  ae.play("chest");
}

// Eventos del juego tras cada soltada de objeto
function ecoDropped(p, item, src) {
  ee("drop", item, src);
  let r = ecoRarityOf(item);
  if (r >= 3) {
    p.mile = r;
    // pilar de luz alto, visible desde lejos (el haz propio de la pieza mide < 8 m)
    p.mesh && p.mesh.add(ckLootBeam(Ct[Math.min(5, r)].c, 22 + r * 3, 0.5 + r * 0.08));
    ee("milestone", item, src, p);
  }
}

// Rareza "efectiva" de un objeto o módulo (los módulos de poder cuentan como Legendarios)
function ecoRarityOf(it) {
  return it.type ? it.r : it.pow ? Math.max(4, it.t || 4) : it.t || 1;
}


// ════════════════════════════════════════════════════════════════════════
// 4. TROFEOS (S.junk) — la «basura» característica de cada enemigo
// ════════════════════════════════════════════════════════════════════════
// [nombre, ingrediente?]. Ingrediente = se reserva para gadgets/planos del Taller y no entra en «Vender todo».
var ecoTrophyNames = {
  rastrero: ["Mandíbula de rastrero"], escupidor: ["Glándula ácida", 1], acorazado: ["Élitro acorazado"],
  saltador: ["Pata de saltamontes"], avispa: ["Aguijón de avispa"], nido: ["Saco de huevos del nido"],
  mantis: ["Guadaña de mantis"], escorpion: ["Aguijón de ceniza"], gusano: ["Diente de gusano"],
  arana: ["Glándula de seda", 1], larva: ["Cápsula de larva"], infectado: ["Jirón infectado"],
  corredor: ["Tendón de corredor"], bruto: ["Colmillo de bruto"], vomitador: ["Bolsa de bilis", 1],
  hinchado: ["Vejiga hinchada"], abominacion: ["Corazón de abominación"], yeti: ["Garra de yeti"],
  necrofago: ["Hueso radiactivo"], sanguijuela: ["Ventosa de sanguijuela"], dron: ["Rotor de dron"],
  torreta: ["Servo de torreta"], aranamec: ["Carcasa de araña bomba", 1], mech: ["Blindaje de mech"],
  centinela: ["Lente láser"], mortero: ["Percutor de mortero"], reparador: ["Módulo reparador"],
  tanquemec: ["Oruga de tanque"], espectro: ["Fragmento espectral"], sombra: ["Jirón de sombra"],
  psionico: ["Cristal psiónico"], tejedor: ["Hilo de escudo"], golem: ["Núcleo de magma", 1],
  elhielo: ["Esquirla de hielo", 1], cazador: ["Garra de cazador xeno"], guardian: ["Placa de guardián"],
  salamandra: ["Escama ígnea", 1], hongo: ["Sombrero de hongo"], cristalino: ["Facetas cristalinas"],
  fisionador: ["Núcleo fisionable"], fisionado: ["Resto de fisión"], minador: ["Espoleta de minador", 1],
  acechador: ["Ojo de acechador"], bombardero: ["Saco de bombas"], escudero: ["Placa de coloso"],
  matriarca: ["Huevo de matriarca"], rabioso: ["Colmillo rabioso"], pilon: ["Bobina tesla", 1],
  parasito: ["Parásito conservado"],
  // jefes: una pieza única por jefe, de gran valor
  reina: ["Corona de la Reina"], demoledor: ["Puño del Demoledor"], kharsa: ["Aguijón real de Kharsa"],
  madre: ["Espora madre"], wendigo: ["Cornamenta de Wendigo"], omega: ["Núcleo del OMEGA"], ifrit: ["Brasa de Ifrit"],
  horror: ["Isótopo del Horror"], mente: ["Ganglio de la Mente"], carnicero: ["Gancho del Carnicero"],
  antiguo: ["Sello del Centinela Antiguo"], leviatan: ["Escama de Leviatán"], titan: ["Placa del Titán"],
  avatar: ["Esquirla del Vacío"],
};

// Región "de origen" de cada tipo de enemigo (la primera que lo lista) y su nivel de referencia, para el valor y las colecciones
var ecoTroInfo = null;
function ecoTroTable() {
  if (ecoTroInfo) return ecoTroInfo;
  let info = {},
    t = ecoCfg.trophy;
  for (let id in ecoTrophyNames) {
    let boss = !!En[id],
      def = boss ? En[id] : gn[id];
    if (!def) continue;
    let reg = -1;
    if (boss) reg = De.findIndex((r) => r.boss === id);
    else reg = De.findIndex((r) => r.enemies.some((q) => q[0] === id));
    let lref = reg >= 0 ? (De[reg].lvl[0] + De[reg].lvl[1]) / 2 : boss ? 45 : Math.min(40, 2 + (def.xp || 2) * 1.2);
    // el valor crece con la dureza del enemigo (√xp) y con el nivel de su región; los jefes valen ×12
    let v = Math.max(1, Math.round(t.kv * mt.credits(lref) * Math.sqrt(Math.min(boss ? 40 : 12, def.xp || 2)) * (boss ? 3 : 1)));
    info[id] = { id, n: ecoTrophyNames[id][0], ing: !!ecoTrophyNames[id][1], reg, boss, v, fam: def.fam, enemy: def.n };
  }
  return (ecoTroInfo = info);
}
function ecoJunk() {
  return x.S.junk || (x.S.junk = {});
}
function ecoTroValue(key) {
  let perfect = key.endsWith(":p"),
    t = ecoTroTable()[perfect ? key.slice(0, -2) : key];
  return t ? t.v * (perfect ? ecoCfg.trophy.perfectMult : 1) : 0;
}

// Trofeo en el suelo (lista propia: no ensucia x.pickups ni añade llamadas de dibujo, usa los orbes instanciados de x.fx)
var ecoGround = [],
  ecoGroundKey = null;
function ecoDropTrophy(id, perfect, at) {
  let a = ecoQ() * 6.28,
    sp = at.spd ?? 1.5 + ecoQ() * 2.5,
    p = { id, perfect: !!perfect, x: at.x, z: at.z, y: 0.6, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 3 + ecoQ() * 2, t: 0, life: ecoCfg.trophy.life };
  if (ecoGround.length > 80) ecoGround.shift();
  ecoGround.push(p);
  return p;
}
var ecoFamCol = { insect: 0xc4a43c, mutant: 0x8fbf50, mech: 0xe0a860, xeno: 0xc46bff };
function ecoUpdateTrophies(dt) {
  // al cambiar de mundo/operación, lo que quedaba en el suelo se pierde igual que el resto de pickups
  let key = (x.map && x.map.__ecoId) || (x.map ? (x.map.__ecoId = ++ecoMapSeq) : 0);
  if (key !== ecoGroundKey) ((ecoGroundKey = key), (ecoGround.length = 0));
  if (!ecoGround.length) return;
  let pl = x.player,
    i = x.fx,
    tbl = ecoTroTable();
  for (let k = ecoGround.length - 1; k >= 0; k--) {
    let p = ecoGround[k];
    p.t += dt;
    p.life -= dt;
    if (p.vy !== 0 || p.y > 0.35) {
      p.vy -= 14 * dt;
      p.y += p.vy * dt;
      p.y <= 0.35 && ((p.y = 0.35), (p.vy = 0));
      let [nx, nz] = x.map.move(p.x, p.z, 0.15, p.vx * dt, p.vz * dt, true);
      ((p.x = nx), (p.z = nz), (p.vx *= 0.92), (p.vz *= 0.92));
    }
    let d = Le(p.x, p.z, pl.x, pl.z);
    // el imán trabaja igual que con los créditos: a distancia si llevan un rato en el suelo
    if (!pl.dead && p.t > 0.5 && (d < pl.pickR * (pl.buffs.magnet ? 5 : 1) || (d < 22 && p.t > 0.7) || p.mag)) {
      p.mag = true;
      let sp = Math.min(26, 10 + p.t * 4) * dt;
      if (sp >= d) ((p.x = pl.x), (p.z = pl.z));
      else {
        let m = Math.atan2(pl.x - p.x, pl.z - p.z);
        ((p.x += Math.sin(m) * sp), (p.z += Math.cos(m) * sp));
      }
      p.y += (1 - p.y) * dt * 5;
    }
    if (!pl.dead && Le(p.x, p.z, pl.x, pl.z) < 0.6 && p.t > 0.4) {
      ecoAddTrophy(p.id, p.perfect, true);
      ecoGround[k] = ecoGround[ecoGround.length - 1];
      ecoGround.pop();
      continue;
    }
    if (p.life <= 0) {
      ecoGround[k] = ecoGround[ecoGround.length - 1];
      ecoGround.pop();
      continue;
    }
    let bob = Math.sin(p.t * 3 + k) * 0.08,
      info = tbl[p.id],
      col = p.perfect ? 0xffd447 : ecoFamCol[info ? info.fam : "mech"];
    i.drawOrb(p.x, p.y + bob, p.z, p.perfect ? 0.17 : info && info.boss ? 0.2 : 0.12, col);
    p.perfect && i.halo(p.x, p.z, 0.7, 0xffd447, 0.5, 2);
  }
}
var ecoMapSeq = 0;

// Añade un trofeo al inventario de botín; `fx` = mostrar texto y sonido
function ecoAddTrophy(id, perfect, fx) {
  let j = ecoJunk(),
    key = perfect ? id + ":p" : id,
    info = ecoTroTable()[id];
  if (!info) return;
  j[key] = (j[key] || 0) + 1;
  let ec = ecoEnsure();
  ec.picked++;
  if (fx) {
    let pl = x.player;
    ae.play("pick", { p: perfect ? 1.9 : 1.15, gap: 0.04 });
    x.fx.text(pl.x, 2.15, pl.z, (perfect ? "✦ " : "") + info.n, perfect ? "#ffd447" : "#b8c4cc", perfect ? 13 : 11, { life: perfect ? 1.2 : 0.8 });
    perfect && ee("toast", `Ejemplar perfecto: ${info.n} (vale ×${ecoCfg.trophy.perfectMult})`, "quest");
    ecoCheckCollections(info.reg);
    ee("junk");
  }
}

// Valor total y número de piezas del botín
function ecoJunkTotals(skipIng) {
  let j = ecoJunk(),
    tbl = ecoTroTable(),
    v = 0,
    n = 0,
    kinds = 0;
  for (let k in j) {
    if (!j[k]) continue;
    let id = k.endsWith(":p") ? k.slice(0, -2) : k;
    if (skipIng && tbl[id] && tbl[id].ing) continue;
    v += ecoTroValue(k) * j[k];
    n += j[k];
    kinds++;
  }
  return { v, n, kinds };
}

// ¿Hay un vendedor al alcance? (Gi = tienda abierta; o un PNJ con servicio "shop" a menos de 7 m)
function ecoVendorNear() {
  let pl = x.player,
    m = x.map;
  if (!pl || !m) return null;
  for (let e of m.ents)
    if (e.k === "npc" && zt[e.npc] && zt[e.npc].svc && zt[e.npc].svc.includes("shop") && Le(e.x, e.z, pl.x, pl.z) < 7) return e.npc;
  return null;
}
function ecoCanSell() {
  return !!(Gi || ecoVendorNear());
}

// Vender: key = id o id:p; n = unidades (por defecto todas)
function ecoSellTrophy(key, n) {
  let j = ecoJunk(),
    have = j[key] || 0;
  n = Math.min(n ?? have, have);
  if (n <= 0) return 0;
  let cr = Math.round(ecoTroValue(key) * n);
  ((j[key] = have - n), j[key] <= 0 && delete j[key]);
  x.S.credits += cr;
  ecoEnsure().soldCr += cr;
  ae.play("coin");
  ee("res");
  return cr;
}
// Vender todo el botín (menos ingredientes reservados)
function ecoSellAllJunk() {
  let j = ecoJunk(),
    tbl = ecoTroTable(),
    tot = 0,
    pieces = 0;
  for (let k of Object.keys(j)) {
    let id = k.endsWith(":p") ? k.slice(0, -2) : k;
    if (tbl[id] && tbl[id].ing) continue;
    pieces += j[k];
    tot += ecoSellTrophy(k);
  }
  if (pieces) ee("toast", `${pieces} trofeos vendidos por ${yt(tot)} ¤`, "good");
  ee("save");
  return tot;
}
// Gasto de trofeos como ingredientes (para el Taller / gadgets): devuelve true si había suficientes
function ecoJunkSpend(id, n = 1) {
  let j = ecoJunk();
  if ((j[id] || 0) < n) return false;
  ((j[id] -= n), j[id] <= 0 && delete j[id]);
  ee("junk");
  return true;
}

// Colecciones por región: un trofeo de cada tipo nativo de la región. Pagan ×1,5 al Comprador de curiosidades.
function ecoCollection(reg) {
  let ids = Object.values(ecoTroTable())
    .filter((t) => t.reg === reg && !t.boss)
    .map((t) => t.id);
  let j = ecoJunk(),
    have = ids.filter((id) => (j[id] || 0) + (j[id + ":p"] || 0) > 0);
  return { ids, have, complete: ids.length > 0 && have.length === ids.length };
}
function ecoCollectionValue(reg) {
  let c = ecoCollection(reg),
    tbl = ecoTroTable();
  return Math.round(c.ids.reduce((s, id) => s + tbl[id].v, 0) * ecoCfg.trophy.collectionMult);
}
function ecoCheckCollections(reg) {
  if (reg == null || reg < 0) return;
  let ec = ecoEnsure();
  if (ecoCollection(reg).complete && !ec.sets[reg]) {
    ec.sets[reg] = 1;
    ee("toast", `Colección completa: ${De[reg].n}. El Comprador de curiosidades la paga ×${ecoCfg.trophy.collectionMult}`, "quest");
    ecoGrantXp(0.15, "colección");
  }
}
// Vender la colección: gasta un ejemplar de cada tipo (usa primero los normales)
function ecoSellCollection(reg) {
  let c = ecoCollection(reg);
  if (!c.complete) return 0;
  let j = ecoJunk(),
    cr = ecoCollectionValue(reg);
  for (let id of c.ids) {
    let k = j[id] ? id : id + ":p";
    j[k]--;
    j[k] <= 0 && delete j[k];
  }
  x.S.credits += cr;
  ecoEnsure().soldCr += cr;
  ecoEnsure().setsSold++;
  ae.play("coin");
  ee("res");
  ee("toast", `Colección vendida: ${De[reg].n} · +${yt(cr)} ¤`, "good");
  ee("save");
  return cr;
}

// Estado de economía persistente (S.econ)
function ecoEnsure() {
  let S = x.S;
  return S.econ || (S.econ = { v: 1, picked: 0, soldCr: 0, setsSold: 0, sets: {}, found: [0, 0, 0, 0, 0, 0] });
}


// ════════════════════════════════════════════════════════════════════════
// 5. HITOS — todo drop ≥ Épico se celebra sin cortar el combate (nada de modales)
// ════════════════════════════════════════════════════════════════════════
// Nombres únicos y frases para los Legendarios (y Míticos). Combinan 30 × 30 nombres; se evitan repetidos.
var ecoNameA = [
  "Aliento", "Susurro", "Juicio", "Lamento", "Promesa", "Ceniza", "Sentencia", "Vigilia", "Réquiem", "Último Aviso",
  "Veredicto", "Eco", "Rescoldo", "Condena", "Alba", "Epitafio", "Silencio", "Cicatriz", "Centella", "Colmillo",
  "Ancla", "Umbral", "Presagio", "Canto", "Herencia", "Deuda", "Tormenta", "Voto", "Resplandor", "Espina",
];
var ecoNameB = [
  "del Cartógrafo Ciego", "de la Última Guardia", "del Alba Rota", "de la Colmena Muda", "del Superviviente",
  "de Nueva Esperanza", "del Ingeniero Caído", "del Eclipse", "de la Noche Larga", "del Desertor",
  "de las Cenizas", "del Comandante Vega", "del Valle Esmeralda", "de la Estación Muerta", "del Vigía",
  "de los Sin Nombre", "del Viejo Mundo", "de la Reina Caída", "del Centinela", "del Último Aliento",
  "de la Bruma", "del Cuervo", "del Cráter", "de la Tregua", "de los Mil Cortes",
  "del Pozo", "del Faro Apagado", "de la Frontera", "del Insomne", "del Coronel",
];
var ecoLore = [
  "Perteneció a alguien que no volvió a la base.",
  "Aún guarda el calor de la última mano que la empuñó.",
  "Los supervivientes cuentan que nunca falla dos veces seguidas.",
  "Grabado a mano en el costado: «Para cuando se apague la luz».",
  "Se la vio en la Ciudad Caída, antes de que cayera.",
  "El Enjambre la huele y se aparta.",
  "Quien la dejó atrás sabía que no iba a necesitarla.",
  "Pesa más de lo que debería. Pesa lo que cuesta.",
  "Dicen que ARGOS la tiene catalogada como «irrecuperable».",
  "Fue de un operador que contó las bajas hasta el final.",
  "Fría al tacto, incluso a mediodía en el desierto.",
  "Alguien la limpió con cuidado antes de morir.",
  "Tiene una muesca por cada nido que ardió.",
  "Un arma así no se encuentra: te encuentra.",
  "Lleva escrito un nombre que ya nadie recuerda.",
  "La historia de esta pieza empieza donde acaba la tuya.",
];
var ecoLoreMyth = [
  "No debería existir. El Enjambre tampoco, y aquí estáis los dos.",
  "Una pieza de antes del Eclipse. Antes de todo.",
  "Los registros de Prometeo la dan por destruida. Mienten.",
  "Cuando la sostienes, el silencio se hace más hondo.",
];
function ecoMakeUnique(it) {
  let used = new Set((x.S.hitos || []).map((h) => h.n)),
    n;
  for (let i = 0; i < 12; i++) {
    n = ecoPick(ecoNameA) + " " + ecoPick(ecoNameB);
    if (!used.has(n)) break;
  }
  it.uname = n;
  it.lore = ecoPick(it.r >= 5 ? ecoLoreMyth : ecoLore);
  it.name = Ol(it);
  return it;
}
// Línea de ambientación en la ficha del objeto (la usa ql en 29-panels.js)
function ecoLoreHtml(it) {
  return it && it.lore ? `<div class="ecolore">“${ke(it.lore)}”</div>` : "";
}

// ── CSS de la celebración y de las pantallas de economía (inyectado: no toca la plantilla)
(function ecoCss() {
  let st = document.createElement("style");
  st.id = "ecoCss";
  st.textContent = `
#ecoFlash{position:fixed;inset:0;z-index:27;pointer-events:none;opacity:0;mix-blend-mode:screen}
#ecoFlash.on{animation:ecoFl var(--d,.7s) ease-out}
@keyframes ecoFl{0%{opacity:0}12%{opacity:var(--a,.7)}100%{opacity:0}}
#ecoMile{position:fixed;left:0;right:0;top:13%;z-index:26;pointer-events:none;text-align:center;padding:0 16px}
#ecoMile .em{display:inline-block;max-width:min(680px,92vw);padding:12px 26px 14px;background:linear-gradient(90deg,transparent,rgba(5,8,10,.82) 18%,rgba(5,8,10,.82) 82%,transparent);animation:ecoIn var(--d,4s) ease both}
@keyframes ecoIn{0%{opacity:0;transform:translateY(-10px) scale(.96)}8%{opacity:1;transform:none}86%{opacity:1}100%{opacity:0}}
#ecoMile .k{font:700 12px var(--f-disp);letter-spacing:.42em;text-transform:uppercase;color:var(--c)}
#ecoMile .n{font:700 clamp(22px,4.6vw,42px) var(--f-disp);letter-spacing:.06em;color:var(--c);text-shadow:0 0 26px var(--c),0 2px 0 #000;line-height:1.1;margin:3px 0}
#ecoMile .q{font:italic 500 clamp(13px,1.9vw,17px) var(--f-body);color:#e6ebee;opacity:.92;text-shadow:0 2px 6px #000}
#ecoMile .s{font:600 11px var(--f-disp);letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:6px}
#ecoMile .rule{height:1px;width:min(420px,60vw);margin:6px auto;background:linear-gradient(90deg,transparent,var(--c),transparent)}
.ecolore{font:italic 500 13px var(--f-body);color:var(--amber2);margin:2px 0 8px;line-height:1.35}
body.touch #ecoMile{top:10%}
body:has(#panel:not([hidden])) #ecoMile,body:has(#panel:not([hidden])) #ecoFlash{display:none}  /* nunca por detrás de un panel */
.eco-tabs{margin-bottom:10px}
.eco-row{display:flex;align-items:center;gap:10px;min-height:44px;padding:5px 8px;border:1px solid var(--line2);background:var(--panel2);margin-bottom:4px}
.eco-row .ic{width:26px;text-align:center;font-size:18px;flex:none}
.eco-row .nm{flex:1;min-width:0;font:600 14px var(--f-disp);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eco-row .nm small{display:block;font:500 11px var(--f-body);color:var(--muted);white-space:normal}
.eco-row .ct{font:700 15px var(--f-disp);min-width:34px;text-align:right}
.eco-row .vl{font:600 12px var(--f-disp);color:var(--amber2);min-width:54px;text-align:right}
.eco-row.perf{border-color:rgba(255,212,71,.55);background:linear-gradient(90deg,rgba(255,212,71,.12),var(--panel2))}
.eco-row .btn{padding:5px 10px;font-size:12px;min-height:34px}
.eco-reg{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:12px 0 5px}
.eco-reg b{font:700 12px var(--f-disp);letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.eco-reg span{font:600 11px var(--f-disp);color:var(--muted)}
.eco-reg .ok{color:var(--good)}
.eco-sum{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--line);background:var(--panel2);margin-bottom:8px}
.eco-hit{border-left:3px solid var(--c);padding:7px 10px;margin-bottom:6px;background:var(--panel2)}
.eco-hit b{color:var(--c);font:700 15px var(--f-disp)}
.eco-hit small{display:block;color:var(--muted);font:500 12px var(--f-body)}
.eco-hit i{display:block;color:var(--amber2);font:italic 500 13px var(--f-body);margin-top:2px}
@media (max-width:640px){.eco-row{gap:6px;padding:4px 6px}.eco-row .vl{min-width:44px}.eco-row .btn{padding:4px 8px}}
`;
  document.head.appendChild(st);
})();

// ── Ralentización breve: se escala el reloj que recibe el bucle principal (requestAnimationFrame), así afecta a todo el
// mundo a la vez sin tocar 32-boot.js. El audio no se ralentiza. Con la simulación en pausa no hace nada.
var ecoSlowSt = { t: 0, scale: 1, lost: 0, last: 0, total: 0 };
(function ecoWrapRaf() {
  let raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    raf((ts) => {
      let s = ecoSlowSt,
        dt = Math.min(100, Math.max(0, ts - s.last));
      s.last = ts;
      if (s.t > 0) {
        // entra en la ralentización de golpe y vuelve a la velocidad normal con una rampa suave
        let k = s.t / s.total,
          sc = k > 0.35 ? s.scale : s.scale + (1 - s.scale) * (1 - k / 0.35);
        s.lost += dt * (1 - sc);
        s.t -= dt / 1000;
      }
      cb(ts - s.lost);
    });
})();
function ecoSlowMo(sec, scale) {
  if (x.paused || (x.S.settings && x.S.settings.reduceMotion)) return;
  ecoSlowSt.t = ecoSlowSt.total = sec;
  ecoSlowSt.scale = scale;
}

// ── Sonidos del hito (se añaden a la tabla de sonidos del juego)
_w.hito3 = (n, e) => {
  // golpe grave + acorde menor-mayor corto
  $e(n, "sine", 90, 38, 0.55, 0.42 * e);
  Dt(n, 0.5, 0.35 * e, "lowpass", 700, 0.7, 120);
  [330, 415, 494, 659].forEach((f, i) => $e(n + 0.1 + i * 0.06, "triangle", f, f, 0.5, 0.11 * e));
};
_w.hito4 = (n, e) => {
  // retumbar largo, acorde abierto y destello agudo: dura ≈ 2,5 s
  $e(n, "sine", 70, 28, 1.1, 0.55 * e);
  Dt(n, 1.2, 0.5 * e, "lowpass", 900, 0.7, 90);
  [196, 294, 392, 494, 587, 784].forEach((f, i) => $e(n + 0.15 + i * 0.09, "triangle", f, f, 1.4, 0.12 * e));
  [1175, 1568, 2093].forEach((f, i) => $e(n + 0.7 + i * 0.1, "sine", f, f * 1.01, 1.2, 0.05 * e));
  Dt(n + 0.5, 1.6, 0.12 * e, "highpass", 5500);
};
_w.hito5 = (n, e) => {
  // lo mismo, más grave y más largo, con un intervalo inquietante
  $e(n, "sine", 55, 22, 1.8, 0.6 * e);
  Dt(n, 2, 0.55 * e, "lowpass", 600, 0.7, 70);
  [147, 220, 311, 392, 466, 622, 784].forEach((f, i) => $e(n + 0.2 + i * 0.12, "triangle", f, f, 2, 0.11 * e));
  [1568, 2349, 3136].forEach((f, i) => $e(n + 1.1 + i * 0.14, "sine", f, f * 1.005, 1.8, 0.05 * e));
  Dt(n + 0.8, 2.4, 0.14 * e, "highpass", 4500);
};

// Etiqueta legible de un objeto/módulo para el banner y el Registro
function ecoItemInfo(it) {
  if (it.type) {
    let base = it.type === "weapon" ? Hn[it.base].n : ai[it.base].n,
      kind = it.type === "weapon" ? "Arma" : Cd[it.slot];
    return { name: it.name, sub: `${kind} · ${base} · Nivel ${it.ilvl}`, kind: it.type === "weapon" ? "w" : "g" };
  }
  return { name: ts(it), sub: `${it.kind === "w" ? "Para armas" : "Para equipo"} · ${it.pow ? "Poder legendario" : "T" + it.t}`, kind: "m" };
}
var ecoRarLabel = ["", "", "", "ÉPICO", "LEGENDARIO", "MÍTICO"];
var ecoSrcLabel = {
  normal: "Enemigo", elite: "Élite", champion: "Campeón", miniboss: "Minijefe", boss: "Jefe", bossSecret: "Jefe secreto",
  bossFinal: "La Mente Colmena", chest1: "Cofre", chest2: "Cofre", chest3: "Cofre mayor", secret: "Alijo secreto",
  event: "Evento", quest: "Misión", op: "Operación",
};
var ecoMileTimer = 0;
function ecoCelebrate(it, src) {
  let r = Math.min(5, ecoRarityOf(it)),
    col = Ct[r].css,
    info = ecoItemInfo(it),
    S = x.S,
    ec = ecoEnsure(),
    m = ecoCfg.milestone;
  // Registro de hitos (Archivo)
  S.hitos || (S.hitos = []);
  S.hitos.push({ t: Math.round(S.playTime), r, n: info.name, s: info.sub, q: it.lore || null, src, lvl: it.ilvl || S.lvl });
  S.hitos.length > 200 && S.hitos.shift();
  ec.found[r]++;
  // destello
  let fl = document.getElementById("ecoFlash") || Object.assign(document.body.appendChild(document.createElement("div")), { id: "ecoFlash" });
  fl.style.background = `radial-gradient(circle at 50% 45%, ${col}cc, ${col}33 45%, transparent 75%)`;
  fl.style.setProperty("--a", r >= 4 ? "0.8" : "0.55");
  fl.style.setProperty("--d", r >= 5 ? "1.4s" : r >= 4 ? "1s" : "0.7s");
  fl.classList.remove("on");
  void fl.offsetWidth; // fuerza el reflujo para reiniciar la animación
  fl.classList.add("on");
  // ralentización, sonido, cámara
  ecoSlowMo(...m.slow[r]);
  ae.play("hito" + r, { gap: 0 });
  x.R.addShake(r >= 4 ? 0.35 : 0.2);
  // banner no modal
  let box = document.getElementById("ecoMile") || Object.assign(document.body.appendChild(document.createElement("div")), { id: "ecoMile" }),
    dur = m.banner[r];
  box.style.setProperty("--c", col);
  box.innerHTML = `<div class="em" style="--d:${dur}s"><div class="k">${ecoRarLabel[r]}${r >= 4 ? " · " + (r === 5 ? "ÚNICO EN EL MUNDO" : "HITO") : ""}</div><div class="n">${ke(info.name)}</div>${it.lore ? `<div class="rule"></div><div class="q">“${ke(it.lore)}”</div>` : ""}<div class="s">${ke(info.sub)} · ${ke(ecoSrcLabel[src] || src)}</div></div>`;
  clearTimeout(ecoMileTimer);
  ecoMileTimer = setTimeout(() => (box.innerHTML = ""), dur * 1000 + 100);
  // eco en el minimapa y en el feed de botín
  eb((r === 5 ? "✦✦ " : "✦ ") + info.name + " · " + ecoRarLabel[r].toLowerCase(), col);
  r >= 4 && x.fx.ring(x.player.x, x.player.z, 6, Ct[r].c, 1.2);
  ee("save");
}
It("milestone", (it, src) => ecoCelebrate(it, src));

// Ping en el minimapa de cada hito que sigue en el suelo (se llama desde ZE en 27-hud.js dentro de la transformación
// del minimapa: coordenadas de mundo, escala s px/m). Fuera del radio visible se dibuja una flecha en el borde.
function ecoMinimapPings(c, size, s) {
  let pl = x.player,
    t = x.time,
    R = size / 2 / s - 3;
  for (let p of x.pickups) {
    if (!p.mile) continue;
    let dx = p.x - pl.x,
      dz = p.z - pl.z,
      d = Math.hypot(dx, dz),
      col = Ct[Math.min(5, p.mile)].css,
      ph = (t * 0.9) % 1;
    let px = p.x,
      pz = p.z;
    if (d > R) ((px = pl.x + (dx / d) * R), (pz = pl.z + (dz / d) * R));
    c.save();
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = 1.2 / s;
    c.globalAlpha = 1 - ph;
    c.beginPath();
    c.arc(px, pz, 1.2 + ph * 5, 0, 6.283);
    c.stroke();
    c.globalAlpha = 1;
    c.beginPath();
    c.arc(px, pz, d > R ? 1.5 : 1.1, 0, 6.283);
    c.fill();
    c.restore();
  }
}

// Registro de hitos (pestaña del Archivo)
function ecoHitosHtml() {
  let S = x.S,
    list = (S.hitos || []).slice().reverse(),
    ec = ecoEnsure(),
    tm = (t) => (t >= 3600 ? Math.floor(t / 3600) + " h " + Math.floor((t % 3600) / 60) + " min" : Math.floor(t / 60) + " min");
  let head = `<div class="eco-sum"><span>${[3, 4, 5].map((r) => `<b style="color:${Ct[r].css}">${ec.found[r]}</b> ${Ct[r].n.toLowerCase()}${ec.found[r] === 1 ? "" : "s"}`).join(" · ")}</span><span class="muted" style="font-size:12px">Cada pieza Épica o superior queda anotada aquí.</span></div>`;
  if (!list.length)
    return head + '<div class="arch lockd"><h4>Aún no hay hitos</h4><p class="muted">Cuando caiga una pieza Épica, Legendaria o Mítica quedará registrada con su nombre, su origen y el momento exacto. Se consiguen de élites, campeones, cofres mayores y jefes.</p></div>';
  return (
    head +
    list
      .map(
        (h) =>
          `<div class="eco-hit" style="--c:${Ct[h.r].css}"><b>${"◆".repeat(h.r - 2)} ${ke(h.n)}</b><small>${ke(Ct[h.r].n)} · ${ke(h.s)} · ${ke(ecoSrcLabel[h.src] || h.src)} · a las ${tm(h.t)} de juego</small>${h.q ? `<i>“${ke(h.q)}”</i>` : ""}</div>`,
      )
      .join("")
  );
}


// ════════════════════════════════════════════════════════════════════════
// 6. XP — curva derivada de tiempos objetivo, y XP que no viene de matar
// ════════════════════════════════════════════════════════════════════════
// Tiempo acumulado objetivo (min) para ALCANZAR el nivel L: interpolación cúbica monótona (Fritsch-Carlson) del logaritmo
// del tiempo entre los puntos de cfg.xp.minutesTo. Así el tiempo por nivel crece sin escalones en los puntos de anclaje.
var ecoTpts = null;
function ecoMinutesTo(L) {
  if (L <= 1) return 0;
  if (!ecoTpts) {
    let P = Object.entries(ecoCfg.xp.minutesTo)
        .map(([k, v]) => [+k, Math.log(v)])
        .sort((a, b) => a[0] - b[0]),
      n = P.length,
      d = [],
      m = [];
    for (let i = 0; i < n - 1; i++) d[i] = (P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) m[i] = m[i + 1] = 0;
      else {
        let a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
        if (h > 9) { let t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
      }
    }
    ecoTpts = { P, m };
  }
  let { P, m } = ecoTpts,
    n = P.length;
  if (L <= P[0][0]) return Math.exp(P[0][1]) * ((L - 1) / (P[0][0] - 1));
  if (L >= P[n - 1][0]) return Math.exp(P[n - 1][1] + m[n - 1] * (L - P[n - 1][0]));
  let i = 0;
  while (L > P[i + 1][0]) i++;
  let h = P[i + 1][0] - P[i][0],
    t = (L - P[i][0]) / h,
    t2 = t * t,
    t3 = t2 * t;
  return Math.exp(
    (2 * t3 - 3 * t2 + 1) * P[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * P[i + 1][1] + (t3 - t2) * h * m[i + 1],
  );
}
// Región donde se combate a nivel L (la última cuya puerta ya está abierta: lvl ≥ lvl[0]-1) y nivel de sus enemigos
function ecoFarmRegion(L) {
  let r = 0;
  for (let i = 0; i < De.length; i++) De[i].lvl[0] - 1 <= L && (r = i);
  return { r, eLvl: qe(L, De[r].lvl[0], De[r].lvl[1]) };
}
// XP medio por muerte a nivel L en su región de combate: media de xp de definición ponderada por la tabla de aparición,
// por el XP de enemigo del nivel, con las élites (×5) según su frecuencia, y por el multiplicador de dificultad (Soldado = 1)
function ecoAvgKillXpRaw(L) {
  let { r, eLvl } = ecoFarmRegion(L),
    pool = De[r].enemies.filter((q) => (q[2] || 0) <= eLvl),
    w = pool.reduce((s, q) => s + q[1], 0),
    avg = pool.reduce((s, q) => s + (q[1] / w) * gn[q[0]].xp, 0);
  return avg * mt.enemyXp(eLvl) * (1 + ecoCfg.xp.eliteShare * 4);
}
// Suavizado (media geométrica en ±3 niveles): al cambiar de región el XP por muerte salta, pero la barra no debe dar saltos
function ecoAvgKillXp(L) {
  let s = 0,
    w = Math.min(3, L - 1, 60 - L); // la ventana se estrecha en los extremos (el primer nivel usa su valor exacto)
  for (let k = -w; k <= w; k++) s += Math.log(ecoAvgKillXpRaw(L + k));
  return Math.exp(s / (2 * w + 1));
}
var ecoXpTab = null;
function ecoXpTable() {
  if (ecoXpTab) return ecoXpTab;
  let c = ecoCfg.xp,
    t = [0];
  for (let L = 1; L < 60; L++) {
    let min = ecoMinutesTo(L + 1) - ecoMinutesTo(L),
      raw = (min * c.killsPerMin * ecoAvgKillXp(L)) / c.killShare, // las muertes aportan killShare de la barra
      mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2)); // 3 cifras significativas
    // la barra nunca baja de un nivel al siguiente (+2 % como mínimo)
    t[L] = Math.max(10, Math.round(raw / mag) * mag, Math.round((t[L - 1] || 0) * 1.02));
  }
  t[60] = t[59];
  return (ecoXpTab = t);
}
function ecoXpToNext(n) {
  return ecoXpTable()[qe(Math.round(n), 1, 60)];
}
// XP de descubrimiento: fracción de la barra del nivel actual (equivale a «X % de un nivel»)
function ecoGrantXp(frac, why) {
  let S = x.S;
  if (!S || S.lvl >= mt.maxLevel || !x.player || x.player.dead) return;
  let v = frac * mt.xpToNext(S.lvl);
  x.player.addXp(v);
  x.fx.text(x.player.x, 2.6, x.player.z, "+" + Math.round(v * (1 + (x.player.st.xpGain || 0))) + " XP" + (why ? " · " + why : ""), "#5dff9a", 12, { life: 1.2 });
}
It("archive", (msg) => {
  let c = ecoCfg.xp;
  if (typeof msg !== "string") return;
  msg.startsWith("Bestiario") && ecoGrantXp(c.bestiary);
  msg.startsWith("Región") && ecoGrantXp(c.firstRegion, "descubrimiento");
});
It("lore", () => ecoGrantXp(ecoCfg.xp.lore));


// ════════════════════════════════════════════════════════════════════════
// 7. ASCENSO A LEGENDARIO — Sigilos de jefe (S.sig) y Fragmentos de Eclipse (S.eclipseFrag)
// ════════════════════════════════════════════════════════════════════════
// Ambos se exponen como materiales «virtuales» (S.mats.sigilo / S.mats.fragmento, no enumerables): así el Taller, el pago
// de costes (op/lp, Do/ca/wb) y la barra de recursos funcionan sin tocar su código. Los datos reales son S.sig y S.eclipseFrag.
mn.sigilo = { n: "Sigilo de jefe", c: "#ff8a3c", icon: "✦" };
mn.fragmento = { n: "Fragmento de Eclipse", c: "#c9a0ff", icon: "◐" };
Gp.sigilo = "Primera muerte de cada jefe principal (uno por jefe)";
Gp.fragmento = "Eclipses (próximamente): caen de las élites desatadas";
function ecoSigCount() {
  let s = x.S && x.S.sig;
  return s ? Object.values(s).reduce((a, b) => a + (b | 0), 0) : 0;
}
function ecoSigSet(v) {
  let S = x.S,
    sig = S.sig || (S.sig = {}),
    cur = ecoSigCount();
  v = Math.max(0, v | 0);
  if (v >= cur) {
    sig._ = (sig._ || 0) + (v - cur); // Sigilos sueltos (depuración, recompensas futuras)
    return;
  }
  // gasto: se consumen primero los sueltos y luego los de los jefes con más existencias
  let n = cur - v;
  for (let k of Object.keys(sig).sort((a, b) => (a === "_" ? -1 : b === "_" ? 1 : sig[b] - sig[a]))) {
    let t = Math.min(n, sig[k]);
    sig[k] -= t;
    n -= t;
    sig[k] <= 0 && delete sig[k];
    if (!n) break;
  }
}
function ecoVirtualMats(S) {
  let def = (k, g, s) => {
    try {
      Object.defineProperty(S.mats, k, { enumerable: false, configurable: true, get: g, set: s });
    } catch {}
  };
  def("sigilo", () => ecoSigCount(), (v) => ecoSigSet(v));
  def("fragmento", () => S.eclipseFrag | 0, (v) => (S.eclipseFrag = Math.max(0, v | 0)));
}
// Concede un Sigilo de jefe (primera muerte de cada jefe principal). API para los frentes de jefes/guaridas.
function ecoGrantSigil(bossId) {
  let S = x.S;
  S.sigSeen || (S.sigSeen = {});
  if (bossId && S.sigSeen[bossId]) return false;
  bossId && (S.sigSeen[bossId] = 1);
  S.sig || (S.sig = {});
  S.sig[bossId || "_"] = (S.sig[bossId || "_"] || 0) + 1;
  ee("toast", `Sigilo de jefe obtenido${bossId && En[bossId] ? " · " + En[bossId].n : ""} (${ecoSigCount()}/${ecoCfg.ascend.sigils})`, "quest");
  ee("res");
  return true;
}
function ecoGrantFragment(n = 1) {
  x.S.eclipseFrag = (x.S.eclipseFrag | 0) + n;
  ee("toast", `Fragmento de Eclipse obtenido (${x.S.eclipseFrag}/${ecoCfg.ascend.fragments})`, "quest");
  ee("res");
}
// Coste de ascender una pieza a la rareza siguiente (lo llama qd en 19-arsenal.js). Épico → Legendario es la ruta larga.
function ecoAscendCost(n, base) {
  if (n.r !== 3) return base;
  let a = ecoCfg.ascend;
  base.credits = Math.round(base.credits * a.creditMult);
  Object.assign(base, { crystal: a.crystal, core: a.core, data: a.data, sigilo: a.sigils, fragmento: a.fragments });
  return base;
}
It("bossKilled", (b) => {
  if (b.mini) return;
  let ec = ecoEnsure(),
    id = b.id;
  ec.bossXp || (ec.bossXp = {});
  if (ec.bossXp[id]) return;
  ec.bossXp[id] = 1;
  ecoGrantXp(b.def.secret ? ecoCfg.xp.firstSecretBoss : ecoCfg.xp.firstBoss, "jefe");
  ecoMainBosses.includes(id) && ecoGrantSigil(id);
});


// ════════════════════════════════════════════════════════════════════════
// 8. TIENDA Y VENTA
// ════════════════════════════════════════════════════════════════════════
// Stock de un vendedor: 2 planos + 3 módulos, rotación a los 45 min reales, jamás Raro ni superior en planos ni T3+ en módulos.
function ecoShopStock(n) {
  let e = x.S;
  e.shop || (e.shop = {});
  let t = Date.now(),
    i = e.shop[n],
    c = ecoCfg.shop;
  if (!i || t > i.until || i.lvl !== e.lvl || !i.v3) {
    let s = zt[n],
      a = s.reg >= 0 ? qe(e.lvl, De[Math.max(0, s.reg)].lvl[0], De[Math.max(0, s.reg)].lvl[1] + 4) : e.lvl,
      r = [],
      o = [];
    for (let l = 0; l < c.plans; l++)
      r.push(us(a, { rarity: ecoRoll("shop"), newChance: 0.9, weaponChance: n === "vega" ? 0.6 : 0.4 }));
    for (let l = 0; l < c.modules; l++) o.push(xi(a, { tier: ecoQ() < c.moduleT2 ? 2 : 1, kind: l % 2 ? "g" : "w" }));
    e.shop[n] = { until: t + c.rotationMin * 6e4, items: r, chips: o, lvl: e.lvl, v3: 1, clvl: a };
  }
  return e.shop[n];
}
function ecoPlanPrice(it) {
  return Math.round(ka(it) * 3 * ecoCfg.shop.priceMult);
}
function ecoModPrice(ch, clvl) {
  return Math.round(gb(ch, clvl) * ecoCfg.shop.priceMult);
}
function ecoConsPrice(id) {
  let p = Math.round(Tl[id].price * (1 + x.S.lvl * 0.12));
  return id === "medkit" ? Math.round(p * ecoCfg.diff.medkitPrice) : p;
}

var ecoShopSt = { npc: null, tab: "buy", sel: null, csel: null, rows: new Set() };
// Sustituye al antiguo Oo(): la tienda con tres pestañas
function ecoShopOpen(n, tab) {
  let e = x.S,
    st = ecoShopSt;
  if (st.npc !== n) ((st.npc = n), (st.sel = st.csel = null), st.rows.clear());
  tab && (st.tab = tab);
  // Gi = tienda abierta: hace que el inventario muestre los botones de vender
  Gi = { npc: n, selling: true };
  let t = ecoShopStock(n),
    body = "",
    tabs = `<div class="tabs eco-tabs">${[["buy", "Comprar"], ["sell", "Vender"], ["cur", "Curiosidades"]]
      .map(([k, l]) => `<button class="tab ${st.tab === k ? "on" : ""}" data-et="${k}">${l}</button>`)
      .join("")}</div>`;
  if (st.tab === "buy") body = ecoShopBuyHtml(n, t);
  else if (st.tab === "sell") body = ecoShopSellHtml();
  else body = ecoShopCuriosHtml();
  let scroll = (x.uiOpen === "shop" && document.querySelector("#panel .wbody")?.scrollTop) || 0;
  Ze.open(
    "shop",
    `<div class="win">${Ze.head(zt[n].n + " · Comercio", `<span class="tag" style="color:#ffd447">¤ ${yt(e.credits)}</span>`)}<div class="wbody">${tabs}${body}</div></div>`,
    { silent: x.uiOpen === "shop" },
  );
  let wb2 = document.querySelector("#panel .wbody");
  wb2 && (wb2.scrollTop = scroll);
  let root = _t("#panel"),
    again = () => ecoShopOpen(n);
  root.querySelectorAll("[data-et]").forEach((b) => b.addEventListener("click", () => ecoShopOpen(n, b.dataset.et)));
  if (st.tab === "buy") ecoShopBuyBind(root, n, t);
  else if (st.tab === "sell") ecoShopSellBind(root, n);
  else
    root.querySelectorAll("[data-sc]").forEach((b) =>
      b.addEventListener("click", () => {
        ecoSellCollection(+b.dataset.sc);
        again();
      }),
    );
}

function ecoShopBuyHtml(n, t) {
  let e = x.S,
    st = ecoShopSt,
    r = x.player,
    i = st.sel,
    s = st.csel,
    o = '<div class="card muted">Selecciona un artículo. Los planos que ya tienes se convierten en mejoras de tu pieza. Aquí no hay nada de rango Épico o superior: eso hay que ganárselo.</div>';
  if (i) {
    let f = Dl(i.base),
      u = ecoPlanPrice(i);
    o =
      ql(i, f || Hd(i)) +
      `<div class="row" style="margin-top:8px"><button class="btn pri" id="sBuy" ${e.credits < u ? "disabled" : ""}>Comprar plano por ${yt(u)} ¤</button>${f ? '<span class="muted" style="font-size:13px">Ya la tienes: mejorará la tuya.</span>' : '<span style="color:var(--good);font-size:13px">Pieza nueva</span>'}</div>`;
  } else if (s) {
    let f = ecoModPrice(s, t.clvl || e.lvl);
    o = lh(s) + `<div class="row" style="margin-top:8px"><button class="btn pri" id="sBuyC" ${e.credits < f ? "disabled" : ""}>Comprar por ${yt(f)} ¤</button></div>`;
  }
  let cons = Object.entries(Tl)
    .map(([f, u]) => {
      let p = f === "grenade" ? r.grenadeMax : f === "medkit" ? r.medkitMax : 5,
        pr = ecoConsPrice(f);
      return `<div class="row" style="justify-content:space-between;margin-bottom:6px"><span><b>${u.n}</b> <span class="muted">(${e.cons[f]}/${p})</span><br><span class="muted" style="font-size:13px">${u.desc}</span></span><button class="btn" data-cons="${f}" ${e.credits < pr || e.cons[f] >= p ? "disabled" : ""}>${pr} ¤</button></div>`;
    })
    .join("");
  return `<div class="grid2"><div><div class="sec">Suministros</div>${cons}<p class="muted" style="font-size:13px">Existencias limitadas. El género se renueva en ${Xs((t.until - Date.now()) / 1e3)}.</p></div>
    <div style="min-width:0"><div class="sec">Planos · ${t.items.length}</div><div class="inv">${t.items.map((f, u) => Vp(f, i === f, u)).join("") || '<span class="muted">Agotado</span>'}</div><div class="sec">Módulos · ${t.chips.length}</div><div class="inv">${t.chips.map((f, u) => qp(f, s === f, u)).join("") || '<span class="muted">Agotado</span>'}</div><div style="margin-top:10px">${o}</div></div></div>`;
}
function ecoShopBuyBind(root, n, t) {
  let e = x.S,
    st = ecoShopSt,
    again = () => ecoShopOpen(n);
  root.querySelectorAll(".cell[data-i]").forEach((f) =>
    f.addEventListener("click", () => {
      ((st.sel = t.items[+f.dataset.i]), (st.csel = null), again());
    }),
  );
  root.querySelectorAll(".cell[data-c]").forEach((f) =>
    f.addEventListener("click", () => {
      ((st.csel = t.chips[+f.dataset.c]), (st.sel = null), again());
    }),
  );
  root.querySelectorAll("[data-cons]").forEach((f) =>
    f.addEventListener("click", () => {
      let u = f.dataset.cons;
      ((e.credits -= ecoConsPrice(u)), e.cons[u]++, ae.play("coin"), ee("cons"), again());
    }),
  );
  let d = _t("#sBuy");
  d &&
    d.addEventListener("click", () => {
      let i = st.sel,
        f = ecoPlanPrice(i);
      e.credits < f ||
        ((e.credits -= f), t.items.splice(t.items.indexOf(i), 1), Ss(i), ae.play("coin"), (st.sel = null), ee("res"), ee("save"), again());
    });
  let h = _t("#sBuyC");
  h &&
    h.addEventListener("click", () => {
      let s = st.csel,
        f = ecoModPrice(s, t.clvl || e.lvl);
      e.credits < f ||
        ((e.credits -= f), t.chips.splice(t.chips.indexOf(s), 1), Ts(s), ae.play("coin"), (st.csel = null), ee("res"), ee("save"), again());
    });
}

// Vender: equipo sin usar (selección múltiple, nada de lo bloqueado ★) y todo el botín
function ecoShopSellHtml() {
  let e = x.S,
    st = ecoShopSt,
    list = e.inv.map((p, i) => ({ p, i }));
  for (let p of [...st.rows]) e.inv.includes(p) || st.rows.delete(p);
  let sel = [...st.rows],
    total = sel.reduce((s, p) => s + ka(p), 0),
    risky = sel.some((p) => p.r >= 3),
    tot = ecoJunkTotals(true),
    chips = [0, 1, 2]
      .map((r) => {
        let a = list.filter(({ p }) => p.r === r && !p.fav);
        return `<button class="rchip ${a.length && a.every(({ p }) => st.rows.has(p)) ? "on" : ""}" data-sr="${r}" style="--c:${Ct[r].css}" ${a.length ? "" : "disabled"}>${Ct[r].n} <small>${a.length}</small></button>`;
      })
      .join("");
  return `<div class="eco-sum"><span><b>Botín de trofeos</b> · ${tot.n} piezas · <span style="color:#ffd447">${yt(tot.v)} ¤</span></span><button class="btn pri" id="eSellAll" ${tot.n ? "" : "disabled"}>Vender todo el botín</button></div>
  <div class="sec">Equipo sin usar</div>
  <div class="row" style="margin-bottom:6px"><span class="muted" style="font-size:13px">Marcar:</span>${chips}<button class="rchip" data-sr="none">Ninguno</button></div>
  ${list.length ? `<div class="inv">${list.map(({ p, i }) => Vp(p, false, i, st.rows.has(p))).join("")}</div>` : '<div class="card muted">No llevas equipo de sobra. Lo que recojas en el campo aparecerá aquí para venderlo.</div>'}
  <div class="row" style="margin-top:10px"><button class="btn pri" id="eSellSel" ${sel.length ? "" : "disabled"}>${st.confirm && risky ? "Confirmar: hay piezas Épicas o mejores" : "Vender selección"} (${sel.length}) · ${yt(total)} ¤</button><span class="muted" style="font-size:13px">Las piezas bloqueadas ★ no se pueden marcar. Lo que no vendas, puedes desguazarlo en el inventario.</span></div>`;
}
function ecoShopSellBind(root, n) {
  let e = x.S,
    st = ecoShopSt,
    again = () => ecoShopOpen(n);
  root.querySelectorAll(".cell[data-i]").forEach((c) =>
    c.addEventListener("click", () => {
      let p = e.inv[+c.dataset.i];
      p && !p.fav && (st.rows.has(p) ? st.rows.delete(p) : st.rows.add(p));
      ((st.confirm = false), ae.play("ui"), again());
    }),
  );
  root.querySelectorAll("[data-sr]").forEach((c) =>
    c.addEventListener("click", () => {
      let k = c.dataset.sr;
      if (k === "none") st.rows.clear();
      else {
        let a = e.inv.filter((p) => p.r === +k && !p.fav),
          all = a.every((p) => st.rows.has(p));
        a.forEach((p) => (all ? st.rows.delete(p) : st.rows.add(p)));
      }
      ((st.confirm = false), ae.play("ui"), again());
    }),
  );
  let a = _t("#eSellAll");
  a &&
    a.addEventListener("click", () => {
      ecoSellAllJunk();
      again();
    });
  let b = _t("#eSellSel");
  b &&
    b.addEventListener("click", () => {
      let sel = [...st.rows].filter((p) => e.inv.includes(p));
      if (sel.some((p) => p.r >= 3) && !st.confirm) return ((st.confirm = true), again());
      let tot = sel.reduce((s, p) => s + ka(p), 0);
      for (let p of sel) e.inv.splice(e.inv.indexOf(p), 1);
      ((e.credits += tot), st.rows.clear(), (st.confirm = false), ae.play("coin"), ee("res"), ee("inv"));
      ee("toast", `${sel.length} piezas vendidas por ${yt(tot)} ¤`, "good");
      ee("save");
      again();
    });
}

// Comprador de curiosidades: paga ×1,5 por colecciones completas de trofeos de una región
function ecoShopCuriosHtml() {
  let tbl = ecoTroTable(),
    mult = ecoCfg.trophy.collectionMult;
  return (
    `<p class="muted" style="margin-top:0">Reúne un trofeo de cada tipo de una región y véndelos juntos: el Comprador de curiosidades paga ×${mult} el valor de la colección (se gasta un ejemplar de cada).</p>` +
    De.map((reg, i) => {
      let c = ecoCollection(i);
      if (!c.ids.length) return "";
      let v = ecoCollectionValue(i),
        missing = c.ids.filter((id) => !c.have.includes(id)).map((id) => tbl[id].n);
      return `<div class="eco-row ${c.complete ? "perf" : ""}"><span class="ic">${c.complete ? "★" : "☆"}</span><span class="nm">${ke(reg.n)}<small>${c.have.length}/${c.ids.length} tipos${c.complete ? " · colección completa" : " · faltan: " + ke(missing.slice(0, 3).join(", ") + (missing.length > 3 ? "…" : ""))}</small></span><span class="vl">${yt(v)} ¤</span><button class="btn pri" data-sc="${i}" ${c.complete ? "" : "disabled"}>Vender</button></div>`;
    }).join("")
  );
}


// ════════════════════════════════════════════════════════════════════════
// 9. PESTAÑA BOTÍN DEL INVENTARIO
// ════════════════════════════════════════════════════════════════════════
function ecoJunkTabBtn(cur) {
  let t = ecoJunkTotals();
  return `<button class="tab ${cur === "junk" ? "on" : ""}" data-t="junk">Botín ${t.n}</button>`;
}
var ecoFamIcon = { insect: "🪲", mutant: "☣", mech: "⚙", xeno: "◈" };
function ecoJunkHtml() {
  let j = ecoJunk(),
    tbl = ecoTroTable(),
    tot = ecoJunkTotals(true),
    all = ecoJunkTotals(),
    can = ecoCanSell(),
    vend = can ? "" : "Necesitas un vendedor cerca (Bastión, campamentos, mercaderes) para vender.",
    keys = Object.keys(j).filter((k) => j[k] > 0),
    groups = {};
  for (let k of keys) {
    let id = k.endsWith(":p") ? k.slice(0, -2) : k,
      info = tbl[id];
    if (!info) continue;
    let g = info.boss ? "boss" : info.reg >= 0 ? info.reg : "other";
    (groups[g] || (groups[g] = [])).push({ k, id, info, perfect: k.endsWith(":p"), n: j[k] });
  }
  let head = `<div class="eco-sum"><span><b>${all.n}</b> trofeos · <b>${all.kinds}</b> tipos · valen <span style="color:#ffd447">${yt(all.v)} ¤</span>${all.v !== tot.v ? ` <span class="muted" style="font-size:12px">(${yt(tot.v)} ¤ sin ingredientes)</span>` : ""}</span><span class="row"><button class="btn pri" data-jv="all" ${can && tot.n ? "" : "disabled"}>Vender todo (${yt(tot.v)} ¤)</button></span></div>${vend ? `<p class="muted" style="font-size:13px;margin:0 0 6px">${vend}</p>` : ""}`;
  if (!keys.length)
    return head + '<div class="card muted">Aún no has recogido trofeos. Cada enemigo deja a veces una pieza característica: una mandíbula, una glándula, una lente… No sirven para el combate, pero se venden, y reunir una colección completa de una región paga ×' + ecoCfg.trophy.collectionMult + '.</div>';
  let order = [...De.map((_, i) => i), "boss", "other"],
    out = "";
  for (let g of order) {
    let rows = (groups[g] || []).sort((a, b) => b.info.v - a.info.v || (a.perfect ? -1 : 1));
    if (!rows.length) continue;
    let name = g === "boss" ? "Jefes" : g === "other" ? "Otros" : De[g].n,
      col = typeof g === "number" ? ecoCollection(g) : null;
    out += `<div class="eco-reg"><b>${ke(name)}</b>${col ? `<span class="${col.complete ? "ok" : ""}">${col.have.length}/${col.ids.length}${col.complete ? " · colección completa ★" : ""}</span>` : ""}</div>`;
    for (let r of rows) {
      let v = ecoTroValue(r.k);
      out += `<div class="eco-row ${r.perfect ? "perf" : ""}"><span class="ic" style="color:${r.perfect ? "#ffd447" : "#" + ecoFamCol[r.info.fam].toString(16).padStart(6, "0")}">${r.perfect ? "✦" : r.info.boss ? "♛" : ecoFamIcon[r.info.fam] || "◆"}</span><span class="nm">${ke(r.info.n)}${r.perfect ? " · ejemplar perfecto" : ""}<small>${ke(r.info.enemy)}${r.info.ing ? " · ingrediente del Taller (no entra en «Vender todo»)" : ""}</small></span><span class="ct">×${r.n}</span><span class="vl">${yt(v)} ¤</span><button class="btn" data-j1="${r.k}" ${can ? "" : "disabled"}>Vender</button></div>`;
    }
  }
  return head + out;
}
function ecoJunkBind(root, refresh) {
  root.querySelectorAll("[data-j1]").forEach((b) =>
    b.addEventListener("click", () => {
      let k = b.dataset.j1;
      ecoSellTrophy(k);
      refresh();
    }),
  );
  root.querySelectorAll("[data-jv]").forEach((b) =>
    b.addEventListener("click", () => {
      ecoSellAllJunk();
      refresh();
    }),
  );
}


// ════════════════════════════════════════════════════════════════════════
// 10. DIFICULTAD, MIGRACIÓN, BUCLE Y DEPURACIÓN
// ════════════════════════════════════════════════════════════════════════
// Daño enemigo: arranque exigente (×1,4) que se diluye linealmente hasta ×1,0 en el nivel 15 (lo usa mt.enemyDmg)
function ecoEarlyDmg(n) {
  let d = ecoCfg.diff;
  return 1 + (d.earlyDmg - 1) * qe((d.earlyUntil - n) / (d.earlyUntil - 1), 0, 1);
}

x.migrations.push((S) => {
  if (!S.junk) S.junk = {};
  if (!S.sig) S.sig = {};
  if (S.eclipseFrag == null) S.eclipseFrag = 0;
  if (!S.hitos) S.hitos = [];
  if (!S.sigSeen) {
    // partidas anteriores: los jefes principales ya abatidos cuentan como primera muerte (sin retroactivo de Sigilos: se ganan de nuevo en la guarida)
    S.sigSeen = {};
  }
  S.econ || (S.econ = { v: 1, picked: 0, soldCr: 0, setsSold: 0, sets: {}, found: [0, 0, 0, 0, 0, 0] });
  S.econ.bossXp || (S.econ.bossXp = {});
  if (!S.econV) {
    S.econV = 1;
    // las tiendas guardadas tenían otro stock/precios: se regeneran
    S.shop = null;
  }
  ecoVirtualMats(S);
});

x.tick.push((dt) => ecoUpdateTrophies(dt));

// Depuración y simulación (window.__dbg lo crea 32-boot después: se engancha con un setter)
(function ecoDebugHooks() {
  const extra = {
    // dbg.give('sigilo'|'fragmento'|'trofeos'|'creditos')
    give(what, n = 1) {
      if (what === "sigilo") {
        for (let i = 0; i < n; i++) {
          let id = ecoMainBosses.find((b) => !x.S.sigSeen[b] && !x.S.sig[b]);
          id ? ecoGrantSigil(id) : (ecoSigSet(ecoSigCount() + 1), ee("res"));
        }
      } else if (what === "fragmento") ecoGrantFragment(n);
      else if (what === "trofeos") {
        let ids = Object.keys(ecoTroTable()).filter((i) => !En[i]);
        for (let i = 0; i < n; i++) ecoAddTrophy(ecoPick(ids), ecoQ() < 0.05, false);
        ee("junk");
      } else if (what === "creditos") ((x.S.credits += n * 1000), ee("res"));
    },
    // dbg.drop('plan'|'modulo', rareza, ?fuente): suelta una pieza concreta junto al jugador (para ver el hito)
    drop(kind, r, src = "boss") {
      let p = x.player,
        d = kind === "modulo" ? ecoModDesc(r) : { k: "plan", r };
      return ecoSpawn(d, { x: p.x + 1.5, z: p.z + 1.5 }, x.S.lvl + 1, src);
    },
    openBotin: () => Ai("junk"),
    openShop: (npc = "vega") => ecoShopOpen(npc),
    openHitos: () => No("hitos"),
  };
  let cur;
  Object.defineProperty(window, "__dbg", {
    configurable: true,
    get: () => cur,
    set(v) {
      cur = v;
      v && typeof v === "object" && Object.assign(v, extra);
    },
  });
  // utilidades para las simulaciones (tools/sim/*.mjs): sin efectos en el juego
  window.__eco = { cfg: ecoCfg, rollLoot, ecoRoll, ecoSrcOf, ecoXpTable, ecoMinutesTo, ecoAvgKillXp, ecoFarmRegion, ecoTroTable, ecoTrophyChance, ecoRnd, mt, Ct, De, gn, En, ecoCount, gi, na, ecoEarlyDmg, Di, qd, cp, Ss, us, ecoShopStock, ecoSellAllJunk, ecoTroValue, ecoJunkTotals, ecoCanSell, ecoVendorNear, ecoSigCount,
    get ground() { return ecoGround; } };
})();

// Campo `trophy` en las definiciones de enemigos y jefes ({id, n, v}): se asigna al arrancar a partir de la tabla de
// trofeos, para que cualquier otro sistema (Taller, bestiario, contratos) lo lea de la propia definicion.
for (const t of Object.values(ecoTroTable())) (En[t.id] || gn[t.id]).trophy = { id: t.id, n: t.n, v: t.v };

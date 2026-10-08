// 31b-talents.js — Árbol de talentos (D2)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// Sustituye los 41 perks aleatorios (Al / pb / Wa / S.pendingPerks) por un árbol de seis ramas.
//  · Estado en el guardado: S.perks[id] = rango (mismo mapa que Pl.recalc ya suma vía fx[id].st / .pow),
//    S.talentPts = puntos libres, S.talentEarned = puntos totales ganados, S.talentGrants = concesiones únicas
//    (jefes, colecciones), S.talentFx = efectos ya sumados para otros frentes (ver abajo), S.talentsV = 1.
//  · API pública: grantTalentPoint(motivo, clave), openTalents(), window.__talents.
//  · S.talentFx (recalculado en Pl.recalc; los frentes GADGETS, HACKEO y ECONOMÍA lo LEEN, nunca lo escriben):
//      gadgetSlots   (int)   gadgets desplegados máximos extra
//      gadgetDmg     (frac)  +% daño de gadgets
//      gadgetRadius  (frac)  +% radio de gadgets
//      gadgetCdr     (frac)  −% tiempo de armado/recarga de gadgets (negativo = más lento)
//      gadgetCostCut (frac)  −% coste de fabricación de gadgets
//      hackSpeed     (frac)  +% velocidad de hackeo
//      hackTraceCut  (frac)  −% traza generada al hackear (negativo = más traza)
//      hackTools     (int)   herramientas de hackeo extra que se pueden llevar
//      turretDmg     (frac)  +% daño de torretas aliadas
//      turretTime    (frac)  +% duración de torretas temporales
//      chainDet      (0/1)   «Detonación en cadena»: al detonar un gadget detonan los vecinos en su radio
//      intruder      (0/1)   «Intruso»: permite hackear torretas enemigas a distancia
//      trophyChance  (frac)  +% (aditivo sobre la base) a la probabilidad de soltar trofeo
//      trophyValue   (frac)  +% al valor de venta de los trofeos
//      chestSense    (m)     radio de detección de cofres/lore (lo dibuja este mismo fragmento)
//    Todas las claves existen siempre (0 si no hay inversión) y se redondean a 3 decimales.

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 1 · Datos: ramas, nodos, maestrías y parámetros (x.cfg.talents)
// ═══════════════════════════════════════════════════════════════════════════════════════════

// Etiquetas de los efectos «de sistema» (no pasan por Sl): se muestran igual que las estadísticas.
var TL_FXL = {
  gadgetSlots: { n: "Gadgets desplegados a la vez", fmt: "flat" },
  gadgetDmg: { n: "Daño de gadgets", fmt: "pct" },
  gadgetRadius: { n: "Radio de gadgets", fmt: "pct" },
  gadgetCdr: { n: "Menos tiempo de armado y recarga de gadgets", fmt: "pct" },
  gadgetCostCut: { n: "Menor coste de fabricación de gadgets", fmt: "pct" },
  hackSpeed: { n: "Velocidad de hackeo", fmt: "pct" },
  hackTraceCut: { n: "Menos traza al hackear", fmt: "pct" },
  hackTools: { n: "Herramientas de hackeo extra", fmt: "flat" },
  turretDmg: { n: "Daño de torretas", fmt: "pct" },
  turretTime: { n: "Duración de torretas", fmt: "pct" },
  chainDet: { n: "Los gadgets detonan en cadena", fmt: "flag" },
  intruder: { n: "Hackeo remoto de torretas enemigas", fmt: "flag" },
  trophyChance: { n: "Probabilidad de trofeo", fmt: "pct" },
  trophyValue: { n: "Valor de los trofeos", fmt: "pct" },
  chestSense: { n: "m de detección de cofres y lore", fmt: "flat" },
};

// Ejes de las ramas en grados (0 = arriba, sentido horario). Cada rama usa tres carriles (A, B, C) separados LANE_DEG.
var TL_GEO = { r0: 128, dr: 80, laneDeg: 19, nodeSize: 46, keySize: 60 };

// Glifos por defecto según la estadística principal del nodo (los nodos clave llevan el suyo).
var TL_GLYPH = {
  maxHpPct: "✚", maxHp: "✚", hpRegen: "♥", regenPct: "♥", armor: "⛨", dmgRed: "⛨",
  shield: "⬡", shieldPct: "⬡", dmg: "✸", fireRate: "≫", moveSpeed: "➤", critChance: "◎",
  critDmg: "✦", range: "⟶", projSpeed: "⟶", reload: "↻", magSize: "▤", pickup: "⊛",
  lifesteal: "❤", dodge: "⤳", xpGain: "★", luck: "♣", credits: "\xA4", dashCd: "⇛",
  multishot: "⋔", pierce: "⇶", ricochet: "⤨", explodeChance: "✺", burnChance: "♨",
  freezeChance: "❄", shockChance: "ϟ", poisonChance: "☣", elemDmg: "⚗", aoe: "◌",
  thorns: "✴", grenadeDmg: "●", grenadeMax: "●", healBonus: "✚", lightRange: "☀",
  resHeat: "⛨", resCold: "⛨", resElec: "⛨", resToxic: "⛨", vsInsect: "♛", vsMutant: "♛",
  vsMech: "♛", vsXeno: "♛", vsElite: "♛", vsBoss: "♛",
  gadgetSlots: "⚙", gadgetDmg: "⚙", gadgetRadius: "⚙", gadgetCdr: "⚙", gadgetCostCut: "⚙",
  hackSpeed: "⌗", hackTraceCut: "⌗", hackTools: "⌗", turretDmg: "⌖", turretTime: "⌖",
  trophyChance: "☠", trophyValue: "☠", chestSense: "◈",
};

// Glifos de los poderes heredados de los perks antiguos.
var TL_PGLYPH = {
  phoenix: "\u2668", berserker: "\u2694", dashNova: "\u25CE", adrenaline: "\u26A1", drone: "\u2708",
  burnAura: "\u2600", orbitals: "\u2609", magnetLord: "\u2295",
};

// Parámetros de las mecánicas de los nodos clave y de los poderes propios. Justificación de los números:
// cada clave cuesta 3 puntos y exige 15 en la rama, y siempre lleva una contrapartida en estadísticas.
var TL_PARAMS = {
  keyMinPts: 15, // puntos gastados en la rama para desbloquear un nodo clave (≈ 20 % de los ~75 puntos totales)
  keyCost: 3, powerCost: 2,
  reprisalCd: 0.3, reprisalR: 3.2, reprisalReflect: 0.6, reprisalThornsMul: 3, reprisalThornsBase: 0.6,
  lastBreathCd: 300, lastBreathHp: 0.25, lastBreathInv: 2.5, // «1 vez cada 5 min»
  executeNormal: 0.15, executeElite: 0.08, // el original ejecuta al 10 % solo a normales
  ghostInv: 0.65, decoyR: 9, decoyDelay: 1.3, // invulnerabilidad total del esprint y señuelo
  kineticStill: -0.15, kineticGain: 0.45, kineticCap: 1.5, // daño ×(0,85 quieto … ×1,30 corriendo … ×1,52 a toda velocidad)
  doubleDashGap: 0.35, // retardo entre el primer y el segundo esprint
  conductN: 3, conductR: 7, conductDmg: 0.6, // descarga que salta entre ralentizados/congelados
  pyroR: 2.6, pyroDmg: 1.2, plagueR: 6, plagueMul: 1.25,
  senseEvery: 2.2, // segundos entre pulsos de «Instinto»
};

// Maestrías: bonificación extra al gastar 8/16/24 puntos en una rama. Premian la especialización
// (un build disperso nunca las alcanza) sin que el árbol dependa de ellas.
var TL_MASTERY_AT = [8, 16, 24];

// Definición compacta. Fila: [nombre, st, rangos, extra]. extra: { fx, pow, cost, d, con, ic }.
// Carriles A/B/C (tiers 1‥6) + 3 nodos clave (tier 7) + 3 puentes entre carriles + raíz = 25 nodos por rama.
var TL_SPEC = [
  {
    id: "bas", n: "Bastión", sub: "Tanque", col: "#5aa9ff", ax: 0,
    d: "Aguanta lo que sea: vida, blindaje, escudo, regeneración y represalia.",
    mast: [{ st: { dmgRed: 0.03 } }, { st: { maxHpPct: 0.1 } }, { st: { dmgRed: 0.04, shieldPct: 0.1 } }],
    root: ["Entrenamiento de resistencia", { maxHpPct: 0.04 }, 3],
    A: [
      ["Placas de cerámica", { dmgRed: 0.015 }, 5],
      ["Blindaje reactivo", { armor: 15 }, 4],
      ["Placas dobles", { dmgRed: 0.02 }, 4],
      ["Aislamiento ambiental", { resHeat: 0.08, resCold: 0.08, resToxic: 0.08, resRad: 0.08, resElec: 0.08 }, 3],
      ["Piel de acero", { dmgRed: 0.025 }, 3],
      ["Fortaleza", { armor: 30, dmgRed: 0.02 }, 3],
    ],
    B: [
      ["Constitución", { maxHpPct: 0.05 }, 5],
      ["Corazón reforzado", { maxHpPct: 0.06 }, 4],
      ["Cicatrización", { healBonus: 0.1 }, 4],
      ["Metabolismo acelerado", { regenPct: 0.002 }, 5],
      ["Fénix", {}, 1, { pow: "phoenix", d: "Al caer, revives con el 50 % de vida (una vez cada 3 minutos)." }],
      ["Reserva vital", { maxHpPct: 0.08 }, 3],
    ],
    C: [
      ["Condensador de escudo", { shieldPct: 0.06 }, 5],
      ["Generador de barrera", { shield: 30 }, 3],
      ["Amortiguadores", { dodge: 0.02 }, 3],
      ["Matriz de escudo", { shieldPct: 0.08 }, 4],
      ["Núcleo regenerativo", { hpRegen: 1.2 }, 4],
      ["Sobrecarga defensiva", { shieldPct: 0.1 }, 3],
    ],
    K: [
      ["Represalia", { moveSpeed: -0.1 }, 1, {
        pow: "reprisal", ic: "⚔",
        d: "Tus espinas se triplican y cada golpe que recibes libera una onda que devuelve el 60 % del daño a los enemigos a 3 m.",
        con: "Plantado en el sitio: −10 % de velocidad de movimiento.",
      }],
      ["Muro viviente", { maxHpPct: 0.7, moveSpeed: -0.15 }, 1, {
        ic: "▣", d: "Tu cuerpo es una fortaleza: +70 % de vida máxima.",
        con: "Pesas como una roca: −15 % de velocidad de movimiento.",
      }],
      ["Último aliento", { healBonus: -0.25 }, 1, {
        pow: "lastBreath", ic: "♨",
        d: "Sobrevives al golpe letal con el 25 % de vida y 2,5 s de invulnerabilidad. Se recarga cada 5 minutos.",
        con: "Heridas que no cierran: −25 % de curación recibida.",
      }],
    ],
    X: [
      ["Disciplina de combate", { dmgRed: 0.01, maxHpPct: 0.02 }, 3, 2.5, -0.5, ["a2", "b2"]],
      ["Soldado curtido", { lifesteal: 0.005, maxHpPct: 0.02 }, 3, 3.5, 0.5, ["b3", "c3"]],
      ["Cuerpo a cuerpo", { thorns: 0.25 }, 4, 4.5, -0.5, ["a4", "b4"]],
    ],
  },
  {
    id: "art", n: "Artillería", sub: "Daño", col: "#ff6a4a", ax: 60,
    d: "Más daño, más cadencia y críticos devastadores: la vía directa.",
    mast: [{ st: { dmg: 0.05 } }, { st: { critChance: 0.05 } }, { st: { dmg: 0.1, fireRate: 0.08 } }],
    root: ["Instrucción de tiro", { dmg: 0.03 }, 3],
    A: [
      ["Gatillo ligero", { fireRate: 0.04 }, 5],
      ["Cargadores ampliados", { magSize: 0.1 }, 4],
      ["Recarga táctica", { reload: 0.08 }, 4],
      ["Cadencia sostenida", { fireRate: 0.05 }, 4],
      ["Berserker", {}, 1, { pow: "berserker", d: "Cada baja concede +2 % de cadencia (máx. +40 %)." }],
      ["Furia de plomo", { fireRate: 0.06 }, 3],
    ],
    B: [
      ["Munición de punta hueca", { dmg: 0.04 }, 5],
      ["Calibre pesado", { dmg: 0.05 }, 4],
      ["Proyectil acelerado", { projSpeed: 0.1 }, 4],
      ["Balística de precisión", { dmg: 0.06 }, 3],
      ["Potencia de fuego", { dmg: 0.07 }, 3],
      ["Artillero maestro", { dmg: 0.08 }, 3],
    ],
    C: [
      ["Ojo de halcón", { critChance: 0.02 }, 5],
      ["Puntos vitales", { critDmg: 0.12 }, 5],
      ["Munición perforante", { pierce: 1 }, 2],
      ["Cañón estriado", { range: 0.06 }, 4],
      ["Rebote", { ricochet: 1 }, 2],
      ["Francotirador", { critChance: 0.03, critDmg: 0.15 }, 3],
    ],
    K: [
      ["Tormenta de plomo", { multishot: 2, dmg: -0.25 }, 1, {
        ic: "⋔", d: "Disparas 2 proyectiles extra por ráfaga.",
        con: "Cada proyectil pega menos: −25 % de daño.",
      }],
      ["Cañón de cristal", { dmg: 0.55, maxHpPct: -0.35 }, 1, {
        ic: "✷", d: "Concentras toda tu potencia en el arma: +55 % de daño.",
        con: "Eres frágil: −35 % de vida máxima.",
      }],
      ["Ejecutor", { fireRate: -0.12 }, 1, {
        pow: "executor", ic: "☠",
        d: "Ejecutas a los enemigos con menos del 15 % de vida (élites: 8 %). Los jefes no se ejecutan.",
        con: "Disparas con calma: −12 % de cadencia.",
      }],
    ],
    X: [
      ["Pulso firme", { dmg: 0.02, reload: 0.03 }, 3, 2.5, -0.5, ["a2", "b2"]],
      ["Estudio de anatomía", { vsInsect: 0.05, vsMutant: 0.05 }, 3, 3.5, 0.5, ["b3", "c3"]],
      ["Armamento antiblindaje", { vsMech: 0.06, vsXeno: 0.06 }, 3, 4.5, -0.5, ["a4", "b4"]],
    ],
  },
  {
    id: "esp", n: "Espectro", sub: "Velocidad", col: "#3fe0c0", ax: 120,
    d: "Muévete, esquiva y recarga antes de que te toquen.",
    mast: [{ st: { moveSpeed: 0.04 } }, { st: { dodge: 0.04 } }, { st: { dashCd: 0.15, moveSpeed: 0.05 } }],
    root: ["Pies ligeros", { moveSpeed: 0.03 }, 3],
    A: [
      ["Esprint ágil", { dashCd: 0.08 }, 4],
      ["Impulso", { moveSpeed: 0.03 }, 3],
      ["Onda de choque", {}, 1, { pow: "dashNova", d: "El esprint libera una onda que daña y empuja." }],
      ["Sombra veloz", { dodge: 0.015 }, 4],
      ["Viento en popa", { moveSpeed: 0.03 }, 3],
      ["Resorte", { dashCd: 0.1 }, 3],
    ],
    B: [
      ["Reflejos felinos", { dodge: 0.02 }, 5],
      ["Zancada larga", { moveSpeed: 0.04 }, 4],
      ["Paso de sombra", { dodge: 0.015 }, 4],
      ["Adrenalina", {}, 1, { pow: "adrenaline", d: "Con menos del 35 % de vida: +50 % de daño y +30 % de velocidad." }],
      ["Reflejos de combate", { dodge: 0.02 }, 3],
      ["Velocidad pura", { moveSpeed: 0.05 }, 3],
    ],
    C: [
      ["Manos rápidas", { reload: 0.08 }, 5],
      ["Cinturón de munición", { magSize: 0.1 }, 4],
      ["Recarga instintiva", { reload: 0.08 }, 4],
      ["Disparo en carrera", { fireRate: 0.05 }, 4],
      ["Subidón", { moveSpeed: 0.02, fireRate: 0.03 }, 3],
      ["Ritmo frenético", { reload: 0.1 }, 3],
    ],
    K: [
      ["Fantasma", { dmg: -0.1 }, 1, {
        pow: "ghost", ic: "❂",
        d: "El esprint deja un señuelo que desorienta a los enemigos cercanos (retrasa sus ataques) y concede 0,65 s de invulnerabilidad.",
        con: "Menos presencia en el combate: −10 % de daño.",
      }],
      ["Cinética", {}, 1, {
        pow: "kinetic", ic: "⌁",
        d: "Tu daño crece con la velocidad: ×1,30 corriendo, hasta ×1,52 a toda velocidad.",
        con: "Quieto pierdes pegada: ×0,85 de daño.",
      }],
      ["Doble esprint", { maxHpPct: -0.08 }, 1, {
        pow: "doubleDash", ic: "⇛⇛",
        d: "Puedes encadenar dos esprints seguidos antes de que empiece la recarga.",
        con: "Cuerpo de corredor: −8 % de vida máxima.",
      }],
    ],
    X: [
      ["Visión nocturna", { lightRange: 0.2 }, 3, 2.5, -0.5, ["a2", "b2"]],
      ["Cosecha al vuelo", { pickup: 0.15 }, 3, 3.5, 0.5, ["b3", "c3"]],
      ["Instinto de huida", { dodge: 0.01, dmgRed: 0.01 }, 3, 4.5, -0.5, ["a4", "b4"]],
    ],
  },
  {
    id: "ing", n: "Ingeniería", sub: "Utilidad", col: "#ffb340", ax: 180,
    d: "Gadgets, hackeo, torretas y drones: el campo de batalla es tu taller.",
    mast: [
      { fx: { gadgetDmg: 0.1, hackSpeed: 0.1 } },
      { fx: { gadgetSlots: 1 } },
      { fx: { gadgetCdr: 0.15, hackTraceCut: 0.15 } },
    ],
    root: ["Formación técnica", {}, 3, { fx: { hackSpeed: 0.05 } }],
    A: [
      ["Explosivos reforzados", {}, 5, { fx: { gadgetDmg: 0.08 } }],
      ["Radio ampliado", {}, 4, { fx: { gadgetRadius: 0.08 } }],
      ["Armado rápido", {}, 4, { fx: { gadgetCdr: 0.08 } }],
      ["Fabricación eficiente", {}, 4, { fx: { gadgetCostCut: 0.06 } }],
      ["Carga hueca", {}, 3, { fx: { gadgetDmg: 0.1 } }],
      ["Ranura adicional", {}, 2, { fx: { gadgetSlots: 1 } }],
    ],
    B: [
      ["Ganzúa digital", {}, 5, { fx: { hackSpeed: 0.08 } }],
      ["Cortafuegos propio", {}, 4, { fx: { hackTraceCut: 0.08 } }],
      ["Procesador sobrealimentado", {}, 4, { fx: { hackSpeed: 0.1 } }],
      ["Biblioteca de exploits", {}, 2, { fx: { hackTools: 1 } }],
      ["Rastro fantasma", {}, 3, { fx: { hackTraceCut: 0.1 } }],
      ["Mente de máquina", {}, 3, { fx: { hackSpeed: 0.12 } }],
    ],
    C: [
      ["Torreta de campaña", {}, 5, { fx: { turretDmg: 0.1 } }],
      ["Baterías de larga duración", {}, 4, { fx: { turretTime: 0.12 } }],
      ["Granadero", { grenadeDmg: 0.15 }, 4],
      ["Munición de torreta", {}, 4, { fx: { turretDmg: 0.12 } }],
      ["Dron escolta", {}, 1, { pow: "drone", d: "Un dron te acompaña y dispara con el 35 % de tu daño." }],
      ["Artillería de apoyo", { grenadeDmg: 0.2 }, 3],
    ],
    K: [
      ["Detonación en cadena", {}, 1, {
        fx: { chainDet: 1, gadgetCdr: -0.25 }, ic: "✷",
        d: "Al detonar un gadget, los gadgets que estén en su radio detonan también.",
        con: "Mecanismos delicados: −25 % de velocidad de armado y recarga.",
      }],
      ["Maestro de obras", { dmg: -0.12 }, 1, {
        fx: { gadgetSlots: 2, gadgetRadius: 0.25 }, ic: "⚒",
        d: "+2 gadgets desplegados a la vez y +25 % de radio.",
        con: "Siempre ocupado: −12 % de daño con armas.",
      }],
      ["Intruso", {}, 1, {
        fx: { intruder: 1, hackTraceCut: -0.2 }, ic: "⌘",
        d: "Hackea torretas enemigas a distancia y vuélvelas en su contra durante unos segundos.",
        con: "Entradas ruidosas: +20 % de traza al hackear.",
      }],
    ],
    X: [
      ["Almacén de campaña", { grenadeMax: 1, medkitMax: 1 }, 2, 2.5, -0.5, ["a2", "b2"]],
      ["Sensores de campo", { lightRange: 0.1, pickup: 0.1 }, 3, 3.5, 0.5, ["b3", "c3"]],
      ["Reciclaje", { credits: 0.04 }, 3, { fx: { gadgetCostCut: 0.05 } }, 4.5, -0.5, ["a4", "b4"]],
    ],
  },
  {
    id: "ele", n: "Elemental", sub: "Estados", col: "#b484ff", ax: 240,
    d: "Fuego, hielo, descarga y veneno: estados alterados y combos.",
    mast: [{ st: { elemDmg: 0.1 } }, { st: { burnChance: 0.03, freezeChance: 0.03, shockChance: 0.03, poisonChance: 0.03 } }, { st: { elemDmg: 0.2 } }],
    root: ["Catalizador básico", { elemDmg: 0.06 }, 3],
    A: [
      ["Munición incendiaria", { burnChance: 0.06 }, 5],
      ["Combustión", { elemDmg: 0.06 }, 4],
      ["Aliento de dragón", { burnChance: 0.06 }, 4],
      ["Brasas persistentes", { elemDmg: 0.08 }, 3],
      ["Aura ígnea", {}, 1, { pow: "burnAura", d: "Quemas continuamente a los enemigos cercanos." }],
      ["Infierno", { burnChance: 0.08 }, 3],
    ],
    B: [
      ["Munición criogénica", { freezeChance: 0.05 }, 5],
      ["Carga de pulso", { shockChance: 0.06 }, 5],
      ["Escarcha profunda", { freezeChance: 0.05 }, 4],
      ["Sobretensión", { shockChance: 0.06 }, 4],
      ["Catalizador mejorado", { elemDmg: 0.08 }, 3],
      ["Tormenta polar", { freezeChance: 0.05, shockChance: 0.05 }, 3],
    ],
    C: [
      ["Puntas envenenadas", { poisonChance: 0.07 }, 5],
      ["Toxina potenciada", { elemDmg: 0.07 }, 4],
      ["Carga ampliada", { aoe: 0.1 }, 4],
      ["Orbitales", {}, 1, { pow: "orbitals", d: "Tres orbes de energía giran a tu alrededor dañando a los enemigos." }],
      ["Balas explosivas", { explodeChance: 0.04 }, 4],
      ["Pandemia", { poisonChance: 0.08, resToxic: 0.1 }, 3],
    ],
    K: [
      ["Pirómano", { maxHpPct: -0.1 }, 1, {
        pow: "pyro", ic: "♨",
        d: "Los enemigos que mueren ardiendo explotan (120 % del daño de tu arma en 2,6 m) y prenden a los que los rodean.",
        con: "Juegas con fuego: −10 % de vida máxima.",
      }],
      ["Conductor", { dmg: -0.12 }, 1, {
        pow: "conductor", ic: "ϟ",
        d: "Tus descargas saltan entre enemigos ralentizados o congelados (hasta 3 objetivos a 7 m, con el 60 % del daño).",
        con: "Energía desviada: −12 % de daño directo.",
      }],
      ["Plaga", { healBonus: -0.25 }, 1, {
        pow: "plague", ic: "☣",
        d: "El veneno salta de los enemigos que mueren envenenados a todos los que tienen a 6 m, con un 25 % más de daño.",
        con: "Eres portador: −25 % de curación recibida.",
      }],
    ],
    X: [
      ["Combinación elemental", { elemDmg: 0.04, critChance: 0.01 }, 3, 2.5, -0.5, ["a2", "b2"]],
      ["Resistencia térmica", { resHeat: 0.08, resCold: 0.08 }, 3, 3.5, 0.5, ["b3", "c3"]],
      ["Aislante", { resElec: 0.1, resToxic: 0.1 }, 3, 4.5, -0.5, ["a4", "b4"]],
    ],
  },
  {
    id: "caz", n: "Cazador", sub: "Suerte y exploración", col: "#a6e04a", ax: 300,
    d: "Botín, experiencia y daño contra la presa adecuada.",
    mast: [{ st: { luck: 0.08 } }, { st: { xpGain: 0.08, credits: 0.08 } }, { st: { vsElite: 0.1, vsBoss: 0.1 } }],
    root: ["Instinto de rastreo", { luck: 0.06 }, 3],
    A: [
      ["Saqueador", { luck: 0.06 }, 5],
      ["Negociante", { credits: 0.08 }, 5],
      ["Bolsillos magnéticos", { pickup: 0.2 }, 4],
      ["Olfato de chatarrero", { luck: 0.06 }, 4],
      ["Señor del magnetismo", {}, 1, { pow: "magnetLord", d: "Recogida ×2 y los orbes de experiencia te curan." }],
      ["Fortuna", { luck: 0.08 }, 3],
    ],
    B: [
      ["Veteranía", { xpGain: 0.05 }, 5],
      ["Linterna potente", { lightRange: 0.12 }, 3],
      ["Estudioso", { xpGain: 0.05 }, 4],
      ["Ojo clínico", {}, 4, { fx: { trophyChance: 0.06 } }],
      ["Experto", { xpGain: 0.06 }, 3],
      ["Maestría", { xpGain: 0.08 }, 3],
    ],
    C: [
      ["Cazador de insectos", { vsInsect: 0.08 }, 4],
      ["Cazador de mutantes", { vsMutant: 0.08 }, 4],
      ["Cazador de mecánicos", { vsMech: 0.08 }, 4],
      ["Cazador de xenoformas", { vsXeno: 0.08 }, 4],
      ["Cazador de élites", { vsElite: 0.08 }, 4],
      ["Cazador de jefes", { vsBoss: 0.1 }, 3],
    ],
    K: [
      ["Cazarrecompensas", { vsElite: 0.3, vsBoss: 0.3, credits: 0.25, fireRate: -0.1 }, 1, {
        ic: "⌖", d: "+30 % de daño contra élites y jefes y +25 % de créditos.",
        con: "Disparos medidos: −10 % de cadencia.",
      }],
      ["Instinto", { maxHpPct: -0.08 }, 1, {
        fx: { chestSense: 30 }, ic: "◈",
        d: "Cada pocos segundos un pulso dorado marca los cofres y datos sin recoger a 30 m, incluso tras los muros.",
        con: "Sentidos saturados: −8 % de vida máxima.",
      }],
      ["Carroñero", { dmg: -0.08 }, 1, {
        fx: { trophyChance: 0.35, trophyValue: 0.25 }, ic: "☠",
        d: "Los enemigos sueltan más trofeos (+35 puntos de probabilidad) y valen un 25 % más.",
        con: "La mirada en el suelo: −8 % de daño.",
      }],
    ],
    X: [
      ["Cazador de rarezas", { luck: 0.05, xpGain: 0.03 }, 3, 2.5, -0.5, ["a2", "b2"]],
      ["Coleccionista", {}, 3, { fx: { trophyValue: 0.08 } }, 3.5, 0.5, ["b3", "c3"]],
      ["Botín de élite", { vsElite: 0.06, credits: 0.04 }, 3, 4.5, -0.5, ["a4", "b4"]],
    ],
  },
];

// Formato de un valor de estadística o efecto de sistema («+8% Daño», «+2 Gadgets…»).
function tlFmt(k, v) {
  const f = TL_FXL[k];
  if (!f) return Ks(k, v);
  if (f.fmt === "flag") return f.n;
  if (f.fmt === "pct") {
    const s = v * 100;
    return `${s >= 0 ? "+" : "−"}${Math.abs(s) < 10 ? Math.abs(s).toFixed(1).replace(".0", "") : Math.round(Math.abs(s))}% ${f.n}`;
  }
  return `${v >= 0 ? "+" : "−"}${Math.abs(v)} ${f.n}`;
}
function tlStatLabel(k) {
  return (Sl[k] && Sl[k].n) || (TL_FXL[k] && TL_FXL[k].n) || k;
}

// Construye ramas y nodos (posición radial determinista) y los registra en x.cfg.talents.
function tlBuildCfg() {
  const G = TL_GEO, P = TL_PARAMS, nodes = [], branches = [];
  const pos = (ax, t, l) => {
    const R = G.r0 + G.dr * t;
    const a = ((ax + l * G.laneDeg) * Math.PI) / 180;
    return [Math.round(R * Math.sin(a)), Math.round(-R * Math.cos(a))];
  };
  for (const b of TL_SPEC) {
    branches.push({ id: b.id, n: b.n, sub: b.sub, col: b.col, ax: b.ax, d: b.d, mastery: b.mast });
    const mk = (suf, row, t, l, req, o) => {
      const ex = (row[3] && typeof row[3] === "object" && !Array.isArray(row[3]) ? row[3] : {}) || {};
      const st = row[1] || {};
      const key = !!o.key;
      const first = Object.keys(st)[0] || Object.keys(ex.fx || {})[0];
      const node = {
        id: `t_${b.id}_${suf}`, br: b.id, n: row[0], st, max: row[2] || 1, req, at: pos(b.ax, t, l),
        t, l, cost: ex.cost || (key ? P.keyCost : ex.pow ? P.powerCost : 1),
        ic: ex.ic || TL_PGLYPH[ex.pow] || TL_GLYPH[first] || "◆",
      };
      if (ex.fx) node.fx = ex.fx;
      if (ex.pow) node.pow = ex.pow;
      if (ex.d) node.d = ex.d;
      if (ex.con) node.con = ex.con;
      if (key) { node.key = 1; node.minPts = P.keyMinPts; }
      if (ex.pow && !key) node.power = 1;
      nodes.push(node);
      return node;
    };
    mk("root", b.root, 0, 0, [], {});
    const lane = { A: -1, B: 0, C: 1 };
    for (const L of ["A", "B", "C"]) {
      b[L].forEach((row, i) => mk(L.toLowerCase() + (i + 1), row, i + 1, lane[L], [i ? `t_${b.id}_${L.toLowerCase()}${i}` : `t_${b.id}_root`], {}));
    }
    ["A", "B", "C"].forEach((L, i) =>
      mk("k" + L.toLowerCase(), b.K[i], 7, lane[L], [`t_${b.id}_${L.toLowerCase()}6`], { key: 1 }));
    b.X.forEach((row, i) => {
      // Fila puente: [nombre, st, rangos, (extra,)? t, l, req] con «extra» opcional en la posición 3.
      const hasEx = typeof row[3] === "object";
      const o = hasEx ? 4 : 3;
      mk("x" + (i + 1), [row[0], row[1], row[2], hasEx ? row[3] : {}], row[o], row[o + 1], row[o + 2].map((s) => `t_${b.id}_${s}`), {});
    });
  }
  return { branches, nodes };
}

x.cfg.talents = (() => {
  const { branches, nodes } = tlBuildCfg();
  const byId = {};
  for (const n of nodes) byId[n.id] = n;
  return {
    branches, nodes, byId, params: TL_PARAMS, geo: TL_GEO, masteryAt: TL_MASTERY_AT,
    respec: { freeUntilLvl: 10, perLevel: 150 }, // reasignación gratis hasta el nivel 10, luego 150·nivel créditos
    fxLabels: TL_FXL,
  };
})();

// Los nodos se registran en `fx` (mapa que Pl.recalc consulta con S.perks) para reutilizar su suma de `st` y `pow`.
Object.assign(fx, x.cfg.talents.byId);

// Poderes propios: entran en Gn (sin «t», así nunca se sortean como poder de objeto) para que el panel
// Personaje los pueda nombrar como el resto de poderes.
(function () {
  for (const n of x.cfg.talents.nodes)
    if (n.pow && !Gn[n.pow]) Gn[n.pow] = { n: n.n, d: n.d || "", names: [n.n], talent: 1 };
})();

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2 · Estado, puntos y compra
// ═══════════════════════════════════════════════════════════════════════════════════════════

function tlEnsure(S) {
  if (!S) return S;
  if (!S.perks) S.perks = {};
  if (typeof S.talentPts !== "number") S.talentPts = 0;
  if (typeof S.talentEarned !== "number") S.talentEarned = 0;
  if (!S.talentGrants) S.talentGrants = {};
  return S;
}
const tlCfg = () => x.cfg.talents;
const tlRank = (id) => (x.S && x.S.perks && x.S.perks[id]) || 0;
// Puntos gastados en una rama (rango × coste de cada nodo).
function tlSpent(br) {
  let s = 0;
  const per = x.S && x.S.perks;
  if (!per) return 0;
  for (const n of tlCfg().nodes) if ((!br || n.br === br) && per[n.id]) s += per[n.id] * n.cost;
  return s;
}

// Concede un punto de talento. `clave` evita concesiones repetidas (p. ej. el id del jefe o de la colección de lore).
// motivo: "level" | "boss" | "lore" | cualquier texto. Devuelve true si se concedió.
function grantTalentPoint(motivo, clave, nombre) {
  const S = tlEnsure(x.S);
  if (!S) return false;
  if (clave != null) {
    const k = motivo + ":" + clave;
    if (S.talentGrants[k]) return false;
    S.talentGrants[k] = 1;
  }
  S.talentEarned++;
  S.talentPts++;
  if (motivo !== "level") {
    const why = motivo === "boss" ? `primera victoria sobre ${nombre || clave}` : motivo === "lore" ? `colección completada${nombre ? ": " + nombre : ""}` : String(motivo);
    ee("toast", `Punto de talento · ${why}`, "quest");
    try { ae.play("levelup"); } catch (e) {}
  }
  ee("talentChanged");
  tlUiRefresh();
  return true;
}

// ¿Se puede comprar un rango de este nodo? { ok, why }
function tlCanBuy(n) {
  const S = x.S, per = S.perks;
  const r = per[n.id] || 0;
  if (r >= n.max) return { ok: false, why: "Rango máximo" };
  if (n.req.length && !n.req.some((q) => per[q] > 0)) {
    const names = n.req.map((q) => tlCfg().byId[q].n);
    return { ok: false, why: `Necesitas un nodo adyacente: ${names.join(" o ")}` };
  }
  if (n.minPts && tlSpent(n.br) < n.minPts) {
    const b = tlCfg().branches.find((q) => q.id === n.br);
    return { ok: false, why: `Gasta ${n.minPts} puntos en ${b.n} (llevas ${tlSpent(n.br)})` };
  }
  if (S.talentPts < n.cost) return { ok: false, why: `Cuesta ${n.cost} punto${n.cost > 1 ? "s" : ""} y tienes ${S.talentPts}`, soft: true };
  return { ok: true };
}
function tlBuy(id) {
  const n = tlCfg().byId[id];
  if (!n || !x.S) return false;
  tlEnsure(x.S);
  const c = tlCanBuy(n);
  if (!c.ok) return false;
  x.S.perks[id] = (x.S.perks[id] || 0) + 1;
  x.S.talentPts -= n.cost;
  x.player.recalc();
  ee("talentChanged");
  ee("save");
  return true;
}
// Precio de reasignar: gratis hasta el nivel 10, después 150·nivel créditos.
function tlRespecCost() {
  const R = tlCfg().respec, l = x.S.lvl;
  return l <= R.freeUntilLvl ? 0 : R.perLevel * l;
}
function tlRespec() {
  const S = tlEnsure(x.S), cost = tlRespecCost();
  const spent = tlSpent();
  if (!spent) return { ok: false, why: "No hay talentos que reasignar." };
  if (S.credits < cost) return { ok: false, why: "Créditos insuficientes." };
  S.credits -= cost;
  // Los nodos de otros sistemas que pudieran vivir en S.perks se conservan; aquí solo hay talentos.
  for (const n of tlCfg().nodes) delete S.perks[n.id];
  S.talentPts = S.talentEarned;
  x.player.recalc();
  ee("talentChanged");
  ee("save");
  return { ok: true, cost };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 3 · Efectos sobre el jugador (enganche en Pl.recalc) y mecánicas de los nodos clave
// ═══════════════════════════════════════════════════════════════════════════════════════════

// Llamada desde Pl.recalc tras sumar S.perks: maestrías, efectos de sistema y ajustes de nodos clave.
// `t` = estadísticas acumuladas, `add(stat, v)` suma, `powers` = Set de poderes.
function tlApply(S, t, add, powers) {
  const fxs = {};
  for (const k in TL_FXL) fxs[k] = 0;
  const per = S.perks || {};
  for (const n of tlCfg().nodes) {
    const r = per[n.id];
    if (r && n.fx) for (const k in n.fx) fxs[k] += n.fx[k] * r;
  }
  for (const b of tlCfg().branches) {
    const sp = tlSpent(b.id);
    TL_MASTERY_AT.forEach((th, i) => {
      if (sp < th) return;
      const m = b.mastery[i];
      if (m.st) for (const k in m.st) add(k, m.st[k]);
      if (m.fx) for (const k in m.fx) fxs[k] += m.fx[k];
    });
  }
  for (const k in fxs) fxs[k] = Math.round(fxs[k] * 1000) / 1000;
  fxs.hackTraceCut = Math.min(fxs.hackTraceCut, 0.75);
  fxs.gadgetCdr = Math.min(fxs.gadgetCdr, 0.7);
  fxs.gadgetCostCut = Math.min(fxs.gadgetCostCut, 0.6);
  fxs.chainDet = fxs.chainDet > 0 ? 1 : 0;
  fxs.intruder = fxs.intruder > 0 ? 1 : 0;
  S.talentFx = fxs;
  // Represalia: las espinas se triplican (sobre lo acumulado hasta aquí) más una base.
  if (powers.has("reprisal")) t.thorns = (t.thorns || 0) * TL_PARAMS.reprisalThornsMul + TL_PARAMS.reprisalThornsBase;
}

// Estado auxiliar de los poderes (no se guarda).
const tlRt = { lbCd: 0, spare: 1, prevDash: 0, sense: 0, pyroDepth: 0, repT: 0 };
const tlTmp = [];

// Último aliento y Fantasma/Doble esprint viven en x.tick; los envoltorios cubren los puntos sin enganche propio.
(function () {
  const P = TL_PARAMS;
  const _die = Pl.prototype.die;
  Pl.prototype.die = function () {
    if (this.powers.has("lastBreath") && tlRt.lbCd <= 0) {
      tlRt.lbCd = P.lastBreathCd;
      this.hp = Math.max(1, this.maxHp * P.lastBreathHp);
      this.inv = Math.max(this.inv, P.lastBreathInv);
      x.fx.explosion(this.x, this.z, 3, 6160282);
      x.fx.text(this.x, 2.2, this.z, "¡ÚLTIMO ALIENTO!", "#5dff9a", 20, { life: 1.5 });
      ae.play("levelup");
      return;
    }
    return _die.call(this);
  };

  const _dyn = Pl.prototype.dyn;
  Pl.prototype.dyn = function () {
    const r = _dyn.call(this);
    if (this.powers.has("kinetic")) {
      const v = Math.hypot(this.vx, this.vz) / 5.2;
      r.dmg *= 1 + P.kineticStill + P.kineticGain * Math.min(P.kineticCap, v);
    }
    return r;
  };

  const _hurt = Pl.prototype.hurt;
  Pl.prototype.hurt = function (e, t) {
    const r = _hurt.call(this, e, t);
    if (r > 0 && this.powers.has("reprisal") && !(t && t.dot) && x.time >= tlRt.repT) {
      tlRt.repT = x.time + P.reprisalCd;
      const near = rn(this.x, this.z, P.reprisalR, tlTmp);
      if (near.length) {
        x.fx.ring(this.x, this.z, P.reprisalR, 5942015, 0.35);
        for (let i = 0; i < near.length; i++) hs(near[i], r * P.reprisalReflect, { thorns: true, kb: 2.5 });
      }
    }
    return r;
  };

  // Ejecutor y Conductor envuelven el daño a enemigos (hs es una declaración: el enlace es reasignable).
  const _hs = hs;
  hs = function (n, e, t) {
    const p = x.player;
    if (n && !n.dead && p && p.powers) {
      if (p.powers.has("executor") && !n.boss && !(t && t.thorns)) {
        const mul = n.dmgTakenMul() || 1;
        if (n.hp > 0 && n.hp - e * mul < n.maxHp * (n.elite ? P.executeElite : P.executeNormal)) e = n.hp / mul + 1;
      }
    }
    const r = _hs(n, e, t);
    if (p && p.powers && t && t.shock && !t.conduct && p.powers.has("conductor") && n.st && (n.st.frozen > 0 || n.st.slow > 0)) {
      const near = rn(n.x, n.z, P.conductR, []);
      let c = 0;
      for (let i = 0; i < near.length && c < P.conductN; i++) {
        const q = near[i];
        if (q === n || q.dead || !q.st || !(q.st.frozen > 0 || q.st.slow > 0)) continue;
        c++;
        x.fx.zap(n.x, n.z, q.x, q.z, 9426175, 0.9);
        _hs(q, e * P.conductDmg, { elem: "shock", shock: true, conduct: true });
      }
    }
    return r;
  };
})();

// Bajas: Pirómano (explosión de los que mueren ardiendo) y Plaga (el veneno salta).
It("kill", (en) => {
  const p = x.player;
  if (!p || !p.powers || !en || !en.st) return;
  const P = TL_PARAMS, w = p.ws[x.S.activeW], base = w ? w.dmgBase : 20;
  if (p.powers.has("pyro") && en.st.burn > 0 && tlRt.pyroDepth < 3) {
    tlRt.pyroDepth++;
    try {
      dn(en.x, en.z, P.pyroR, base * P.pyroDmg * (1 + (p.st.elemDmg || 0)), { owner: "p", color: 16742944, small: true });
      for (const q of rn(en.x, en.z, P.pyroR + 0.8, [])) {
        if (q.dead || !q.st) continue;
        q.st.burn = Math.max(q.st.burn || 0, 3);
        q.st.burnDps = Math.max(q.st.burnDps || 0, base * 0.35);
      }
    } finally { tlRt.pyroDepth--; }
  }
  if (p.powers.has("plague") && en.st.poison > 0) {
    const dps = (en.st.poisonDps || base * 0.22) * P.plagueMul;
    let any = false;
    for (const q of rn(en.x, en.z, P.plagueR, [])) {
      if (q.dead || !q.st) continue;
      q.st.poison = Math.max(q.st.poison || 0, 5);
      q.st.poisonDps = Math.max(q.st.poisonDps || 0, dps);
      any = true;
    }
    any && x.fx.burst(en.x, 0.8, en.z, 12, { color: 10354506, speed: 3, life: 0.5, size: 0.22, up: 1 });
  }
});

x.tick.push((dt) => {
  const p = x.player;
  if (!p || p.dead || !x.S) return;
  const P = TL_PARAMS, pw = p.powers;
  tlRt.lbCd = Math.max(0, tlRt.lbCd - dt);
  if (tlRt.welcome && (tlRt.welcome.t -= dt) <= 0) {
    ee("toast", tlRt.welcome.text, "quest");
    window.__talents.lastWelcome = tlRt.welcome.text;
    tlRt.welcome = null;
  }
  // Detección del inicio de un esprint: la recarga salta de ≤0 a ~2 s en el mismo fotograma.
  const dc = p.dashCd;
  if (dc > tlRt.prevDash + 0.5) {
    if (pw.has("ghost")) {
      p.inv = Math.max(p.inv, P.ghostInv);
      x.fx.ring(p.x, p.z, 2.2, 8442111, 0.7);
      x.fx.burst(p.x, 0.9, p.z, 18, { color: 8442111, speed: 2, life: 0.6, size: 0.4, size1: 0.1, up: 0.4 });
      const en = x.enemies;
      for (let i = 0; i < en.length; i++) {
        const q = en[i];
        if (q.dead || !q.alerted || !q.st || Math.hypot(q.x - p.x, q.z - p.z) > P.decoyR) continue;
        q.atkCd = Math.max(q.atkCd || 0, P.decoyDelay);
        q.st.slow = Math.max(q.st.slow || 0, P.decoyDelay);
      }
    }
    if (pw.has("doubleDash") && tlRt.spare > 0) {
      tlRt.spare--;
      p.dashCd = P.doubleDashGap;
    }
  }
  if (p.dashCd <= 0 && tlRt.spare < 1) tlRt.spare = 1;
  tlRt.prevDash = p.dashCd;
  // Instinto: pulso dorado sobre cofres/datos sin recoger (visible tras los muros).
  const fxs = x.S.talentFx;
  if (fxs && fxs.chestSense > 0 && x.world && x.world.rt && x.mode !== "menu") {
    tlRt.sense -= dt;
    if (tlRt.sense <= 0) {
      tlRt.sense = P.senseEvery;
      const R2 = fxs.chestSense * fxs.chestSense;
      for (const r of x.world.rt.values()) {
        const o = r.e;
        if (!o || (o.k !== "chest" && o.k !== "datapad" && o.k !== "lockbox")) continue;
        const dx = o.x - p.x, dz = o.z - p.z;
        if (dx * dx + dz * dz > R2) continue;
        if (o.k === "datapad" ? x.world.dpTaken(o) : x.world.isConsumed(o)) continue;
        x.fx.ring(o.x, o.z, 1.6, o.k === "datapad" ? 16777215 : 16766816, 1.1);
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 4 · Migración, eventos y entrada
// ═══════════════════════════════════════════════════════════════════════════════════════════

const tlMainBosses = () => new Set(De.map((r) => r && r.boss).filter(Boolean));

x.migrations.push((S) => {
  if (S.talentsV === 1) { tlEnsure(S); return; }
  const oldRanks = Object.values(S.perks || {}).reduce((a, b) => a + (+b || 0), 0);
  const pending = S.pendingPerks || 0;
  const hadOld = oldRanks > 0 || pending > 0;
  tlEnsure(S);
  // Nivel: 1 punto por nivel desde L2 (o los puntos que el jugador ya había ganado, si fueran más).
  const levelPts = Math.max((S.lvl || 1) - 1, oldRanks + pending);
  S.perks = {};
  S.pendingPerks = 0;
  S.talentEarned = levelPts;
  // Jefes principales ya derrotados cuentan como primera muerte.
  let bossPts = 0;
  for (let i = 0; i < De.length; i++)
    if (De[i] && De[i].boss && S.world && S.world.bosses && S.world.bosses["reg" + i]) {
      S.talentGrants["boss:" + De[i].boss] = 1;
      bossPts++;
    }
  S.talentEarned += bossPts;
  S.talentPts = S.talentEarned;
  S.talentsV = 1;
  // El aviso se emite desde x.tick una vez empieza la partida (un setTimeout se perdería si el jugador está en el menú).
  if (hadOld || S.lvl > 1)
    tlRt.welcome = { t: 2.5, text: `Árbol de talentos: tus ${S.talentEarned} puntos (mejoras antiguas y jefes derrotados) están listos para repartir. Pulsa ${Tt.touchMode ? "TALENTO" : "T"}.` };
});

It("bossKilled", (b) => {
  if (!b || b.mini || (b.arena && b.arena.op) || !tlMainBosses().has(b.id)) return;
  grantTalentPoint("boss", b.id, b.name || (b.def && b.def.n));
});
It("levelUp", () => {
  const S = x.S;
  S && S.talentPts > 0 && ee("toast", `Punto de talento disponible · ${Tt.touchMode ? "toca TALENTO" : "pulsa T"} para gastarlo`, "quest");
});

// Tecla T (y botón táctil «TAL.»): se atiende desde el bucle de entrada Nb sin tocar 32-boot.
(function () {
  const _Nb = Nb;
  Nb = function () {
    if (x.started && Tt.hit("talents") && x.player && !x.player.dead) {
      const n = x.uiOpen;
      if (n === "talents") Ze.close();
      else if (!n || ["inv", "map", "quests", "pause", "archive"].includes(n)) openTalents();
    }
    return _Nb.apply(this, arguments);
  };
})();

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 5 · Panel del árbol (lienzo con arrastre y zoom, pointer events)
// ═══════════════════════════════════════════════════════════════════════════════════════════

const tlUi = { s: 0.6, ox: 0, oy: 0, sel: null, hi: "", conf: 0, W: 0, init: false, els: {}, edges: [], lastBr: null };

function tlBranchOf(id) { return tlCfg().branches.find((b) => b.id === id); }
function tlNodeState(n) {
  const r = tlRank(n.id);
  if (r >= n.max) return "max";
  if (r > 0) return "own";
  const reqOk = !n.req.length || n.req.some((q) => tlRank(q) > 0);
  const keyOk = !n.minPts || tlSpent(n.br) >= n.minPts;
  return reqOk && keyOk ? (x.S.talentPts >= n.cost ? "avail" : "avail poor") : "lock";
}

function tlEffectLines(n, times) {
  const out = [];
  const k = times || 1;
  if (n.st) for (const s in n.st) out.push(tlFmt(s, n.st[s] * k));
  if (n.fx) for (const s in n.fx) out.push(tlFmt(s, n.fx[s] * k));
  return out;
}

function tlNodeHTML(n) {
  const b = tlBranchOf(n.br);
  const cls = ["tn", n.key ? "key" : "", n.power ? "pw" : ""].filter(Boolean).join(" ");
  const sz = n.key ? TL_GEO.keySize : TL_GEO.nodeSize;
  const W = tlUi.W / 2;
  return `<button class="${cls}" data-n="${n.id}" style="--bc:${b.col};left:${W + n.at[0] - sz / 2}px;top:${W + n.at[1] - sz / 2}px;width:${sz}px;height:${sz}px" aria-label="${ke(n.n)}"><span class="tg">${n.ic}</span><span class="rk"></span><span class="nm">${ke(n.n)}</span></button>`;
}

function tlSvg() {
  const C = tlCfg(), W = tlUi.W, h = W / 2;
  let s = `<svg class="tle" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}" aria-hidden="true">`;
  s += `<circle cx="${h}" cy="${h}" r="${TL_GEO.r0 * 0.62}" class="hub"/><circle cx="${h}" cy="${h}" r="${TL_GEO.r0 * 0.38}" class="hub2"/>`;
  for (const b of C.branches) {
    const a = (b.ax * Math.PI) / 180, R = TL_GEO.r0 + TL_GEO.dr * 7.6;
    s += `<text x="${h + Math.sin(a) * R}" y="${h - Math.cos(a) * R}" fill="${b.col}" class="bl" text-anchor="middle">${ke(b.n.toUpperCase())}</text>`;
  }
  tlUi.edges = [];
  for (const n of C.nodes)
    for (const q of n.req) {
      const m = C.byId[q];
      s += `<line data-e="${q}|${n.id}" x1="${h + m.at[0]}" y1="${h + m.at[1]}" x2="${h + n.at[0]}" y2="${h + n.at[1]}" stroke="${tlBranchOf(n.br).col}" class="te"/>`;
    }
  return s + "</svg>";
}

function tlApplyView() {
  const w = _t("#tlWorld");
  if (!w) return;
  w.style.transform = `translate(${tlUi.ox}px,${tlUi.oy}px) scale(${tlUi.s})`;
  const v = _t("#tlView");
  v && v.classList.toggle("zs", tlUi.s < 0.72);
}
function tlViewSize() {
  const v = _t("#tlView");
  return v ? [v.clientWidth, v.clientHeight] : [800, 500];
}
function tlZoomAt(cx, cy, f) {
  const s0 = tlUi.s, s1 = Math.min(1.9, Math.max(0.28, s0 * f));
  tlUi.ox = cx - ((cx - tlUi.ox) / s0) * s1;
  tlUi.oy = cy - ((cy - tlUi.oy) / s0) * s1;
  tlUi.s = s1;
  tlApplyView();
}
// Centra el lienzo en un punto del mundo (coordenadas relativas al centro del árbol).
function tlCenterOn(wx, wy, s) {
  const [vw, vh] = tlViewSize();
  tlUi.s = s || tlUi.s;
  tlUi.ox = vw / 2 - (tlUi.W / 2 + wx) * tlUi.s;
  tlUi.oy = vh / 2 - (tlUi.W / 2 + wy) * tlUi.s;
  tlApplyView();
}
function tlFocusBranch(id) {
  const b = tlBranchOf(id);
  const a = (b.ax * Math.PI) / 180, R = TL_GEO.r0 + TL_GEO.dr * 3.2;
  const [vw, vh] = tlViewSize();
  tlUi.lastBr = id;
  tlCenterOn(Math.sin(a) * R, -Math.cos(a) * R, Math.min(0.85, Math.max(0.5, Math.min(vw, vh) / 560)));
  tlUiRefresh();
}

// Actualiza clases, rangos, contador y ficha. Es barato: solo toca texto/clases.
function tlUiRefresh() {
  if (x.uiOpen !== "talents" || !tlUi.els.nodes) return;
  const S = x.S, C = tlCfg();
  for (const n of C.nodes) {
    const el = tlUi.els.nodes[n.id];
    if (!el) continue;
    const st = tlNodeState(n), r = tlRank(n.id);
    const hl = tlUi.hi ? !!((n.st && n.st[tlUi.hi] !== undefined) || (n.fx && n.fx[tlUi.hi] !== undefined)) : null;
    el.className = `tn ${n.key ? "key" : ""} ${n.power ? "pw" : ""} ${st} ${tlUi.sel === n.id ? "sel" : ""} ${hl === true ? "hl" : hl === false ? "dim" : ""}`;
    const rk = el.querySelector(".rk");
    const t = n.max > 1 ? `${r}/${n.max}` : r ? "✓" : "";
    rk.textContent !== t && (rk.textContent = t);
  }
  for (const e of tlUi.els.edges) {
    const [a, b] = e.dataset.e.split("|");
    e.setAttribute("class", "te" + (tlRank(a) > 0 && tlRank(b) > 0 ? " on" : tlRank(a) > 0 ? " half" : ""));
  }
  const pts = _t("#tlPts");
  if (pts) {
    pts.innerHTML = `<b>${S.talentPts}</b> <span>punto${S.talentPts === 1 ? "" : "s"} libre${S.talentPts === 1 ? "" : "s"}</span>`;
    pts.classList.toggle("has", S.talentPts > 0);
  }
  const rs = _t("#tlRespec");
  if (rs) {
    const c = tlRespecCost();
    rs.textContent = tlUi.conf ? "¿Seguro? Toca otra vez" : c ? `Reasignar · ${c} ¤` : "Reasignar · gratis";
    rs.classList.toggle("bad", !!tlUi.conf);
  }
  for (const b of C.branches) {
    const el = _t(`[data-br="${b.id}"] i`);
    el && (el.textContent = tlSpent(b.id));
  }
  tlInfoRender();
}

function tlInfoRender() {
  const box = _t("#tlInfo");
  if (!box) return;
  const C = tlCfg(), S = x.S;
  const n = tlUi.sel ? C.byId[tlUi.sel] : null;
  if (!n) {
    const bid = tlUi.lastBr || "bas", b = tlBranchOf(bid), sp = tlSpent(bid);
    const ms = b.mastery.map((m, i) => {
      const on = sp >= TL_MASTERY_AT[i];
      const ln = [];
      if (m.st) for (const k in m.st) ln.push(tlFmt(k, m.st[k]));
      if (m.fx) for (const k in m.fx) ln.push(tlFmt(k, m.fx[k]));
      return `<li class="${on ? "on" : ""}"><b>${TL_MASTERY_AT[i]} pts</b> ${ln.join(" · ")}</li>`;
    }).join("");
    box.innerHTML = `<div class="tli-h" style="--bc:${b.col}"><span class="tli-ic">◆</span><div><b>${ke(b.n)}</b><small>${ke(b.sub)} · ${sp} puntos gastados</small></div></div>
      <p class="tli-d">${ke(b.d)}</p>
      <div class="sec" style="margin:6px 0 4px">Maestrías de la rama</div><ul class="tli-m">${ms}</ul>
      <p class="muted tli-hint">${Tt.touchMode ? "Arrastra para moverte, pellizca para ampliar y toca un nodo para ver su ficha." : "Arrastra para moverte, rueda del ratón para ampliar y haz clic en un nodo para ver su ficha."} Los nodos clave exigen ${TL_PARAMS.keyMinPts} puntos en su rama.</p>`;
    return;
  }
  const b = tlBranchOf(n.br), r = tlRank(n.id), c = tlCanBuy(n);
  const eff = tlEffectLines(n, 1).map((l) => `<li>${ke(l)}</li>`).join("");
  const now = r > 0 && n.max > 1 ? tlEffectLines(n, r).map(ke).join(" · ") : "";
  const kind = n.key ? "Nodo clave" : n.power ? "Poder" : "Talento";
  const reqs = [];
  if (n.req.length) reqs.push(`<li class="${n.req.some((q) => tlRank(q) > 0) ? "ok" : "no"}">Nodo adyacente: ${n.req.map((q) => ke(C.byId[q].n)).join(" o ")}</li>`);
  if (n.minPts) reqs.push(`<li class="${tlSpent(n.br) >= n.minPts ? "ok" : "no"}">${n.minPts} puntos gastados en ${ke(b.n)} (${tlSpent(n.br)})</li>`);
  const label = r >= n.max ? "Rango máximo" : c.ok ? `Comprar · ${n.cost} pt${n.cost > 1 ? "s" : ""}` : "No disponible";
  box.innerHTML = `<div class="tli-h" style="--bc:${b.col}"><span class="tli-ic">${n.ic}</span><div><b>${ke(n.n)}</b><small>${ke(b.n)} · ${kind}${n.max > 1 ? ` · rango ${r}/${n.max}` : r ? " · comprado" : ""}</small></div></div>
    ${n.d ? `<p class="tli-d">${ke(n.d)}</p>` : ""}
    ${eff && !n.key ? `<ul class="tli-ef">${eff}</ul>` : ""}
    ${n.key && eff ? `<ul class="tli-ef">${tlEffectLines(n, 1).map((l, i) => `<li>${ke(l)}</li>`).join("")}</ul>` : ""}
    ${now ? `<div class="tli-now">Ahora: ${now}</div>` : ""}
    ${n.con ? `<div class="tli-con"><b>Contrapartida</b> ${ke(n.con)}</div>` : ""}
    ${reqs.length ? `<ul class="tli-rq">${reqs.join("")}</ul>` : ""}
    <div class="tli-cost muted">Coste: ${n.cost} punto${n.cost > 1 ? "s" : ""}${n.max > 1 ? " por rango" : ""}</div>
    <button class="btn pri" id="tlBuy" ${c.ok ? "" : "disabled"}>${label}</button>
    ${!c.ok && r < n.max ? `<div class="muted tli-why">${ke(c.why)}</div>` : ""}`;
  const bb = _t("#tlBuy");
  bb && (bb.onclick = () => tlDoBuy(n.id));
}

function tlDoBuy(id) {
  const n = tlCfg().byId[id], had = tlRank(id);
  if (!tlBuy(id)) { ae.play("err"); return; }
  ae.play(n.key ? "legend" : "buff");
  const el = tlUi.els.nodes && tlUi.els.nodes[id];
  if (el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
  if (n.key && !had) ee("toast", `Nodo clave: ${n.n}`, "good");
  tlUiRefresh();
}

function tlSelect(id) {
  tlUi.sel = id;
  if (id) tlUi.lastBr = tlCfg().byId[id].br;
  tlUiRefresh();
}

function openTalents() {
  const S = tlEnsure(x.S);
  if (!S) return;
  const C = tlCfg();
  tlUi.W = Math.ceil((TL_GEO.r0 + TL_GEO.dr * 8.6) * 2);
  tlUi.conf = 0;
  const stats = [...new Set(C.nodes.flatMap((n) => [...Object.keys(n.st || {}), ...Object.keys(n.fx || {})]))]
    .sort((a, b) => tlStatLabel(a).localeCompare(tlStatLabel(b), "es"));
  const opts = stats.map((k) => `<option value="${k}" ${tlUi.hi === k ? "selected" : ""}>${ke(tlStatLabel(k))}</option>`).join("");
  const chips = C.branches.map((b) => `<button class="tlchip" data-br="${b.id}" style="--bc:${b.col}"><span>${ke(b.n)}</span><i>0</i></button>`).join("");
  const html = `<div class="win tlwin" style="width:min(1180px,100%)">${Ze.head("Árbol de talentos",
    `<div class="tlbar"><span id="tlPts" class="tlpts"></span><select id="tlHi" class="tlsel" aria-label="Resaltar estadística"><option value="">Resaltar estadística…</option>${opts}</select><button class="btn" id="tlRespec"></button></div>`)}
    <div class="wbody tlbody"><div class="tlmain">
      <div class="tlcol"><div class="tlchips">${chips}</div>
        <div class="tlview" id="tlView"><div class="tlworld" id="tlWorld" style="width:${tlUi.W}px;height:${tlUi.W}px">${tlSvg()}${C.nodes.map(tlNodeHTML).join("")}</div>
          <div class="tlzoom"><button data-z="1" aria-label="Acercar">+</button><button data-z="-1" aria-label="Alejar">−</button><button data-z="0" aria-label="Centrar">⌖</button></div></div></div>
      <div class="tlinfo" id="tlInfo"></div></div></div></div>`;
  Ze.open("talents", html, { silent: x.uiOpen === "talents" });
  tlUi.els = {
    nodes: Object.fromEntries([..._t("#tlWorld").querySelectorAll(".tn")].map((e) => [e.dataset.n, e])),
    edges: [..._t("#tlWorld").querySelectorAll(".te")],
  };
  // Vista inicial: la rama donde más has invertido (o Bastión) o, sin inversión, el centro del árbol.
  const best = C.branches.map((b) => [b, tlSpent(b.id)]).sort((a, b) => b[1] - a[1])[0];
  tlUi.sel = null;
  requestAnimationFrame(() => {
    const [vw, vh] = tlViewSize();
    const s0 = Math.min(0.8, Math.max(0.42, Math.min(vw, vh) / 700));
    if (best[1] > 0) tlFocusBranch(best[0].id);
    else { tlUi.lastBr = null; tlCenterOn(0, 0, s0); tlUiRefresh(); }
  });
  tlBind();
  tlUiRefresh();
}

function tlBind() {
  const view = _t("#tlView");
  if (!view) return;
  const ptr = new Map();
  let drag = null, pinch = null;
  const nodeOf = (el) => (el && el.closest ? el.closest(".tn") : null);
  view.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest(".tlzoom")) return;
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { view.setPointerCapture(e.pointerId); } catch (_) {}
    if (ptr.size === 1) {
      const nd = nodeOf(e.target);
      drag = { x: e.clientX, y: e.clientY, ox: tlUi.ox, oy: tlUi.oy, moved: false, node: nd ? nd.dataset.n : null };
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: tlUi.s };
      drag && (drag.moved = true);
    }
  });
  view.addEventListener("pointermove", (e) => {
    const p = ptr.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (ptr.size === 2 && pinch) {
      const [a, b] = [...ptr.values()], r = view.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      tlZoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.s * d) / pinch.d / tlUi.s);
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) { tlUi.ox = drag.ox + dx; tlUi.oy = drag.oy + dy; tlApplyView(); }
    }
  });
  const end = (e) => {
    if (!ptr.has(e.pointerId)) return;
    ptr.delete(e.pointerId);
    if (ptr.size === 0 && drag && !drag.moved && e.type === "pointerup") {
      ae.play("ui");
      tlSelect(drag.node);
    }
    if (ptr.size < 2) pinch = null;
    if (ptr.size === 0) drag = null;
    else if (ptr.size === 1) { const q = [...ptr.values()][0]; drag = { x: q.x, y: q.y, ox: tlUi.ox, oy: tlUi.oy, moved: true, node: null }; }
  };
  view.addEventListener("pointerup", end);
  view.addEventListener("pointercancel", end);
  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect();
    tlZoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.14 : 1 / 1.14);
  }, { passive: false });
  _t(".tlzoom").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const [vw, vh] = tlViewSize(), z = +b.dataset.z;
    if (z === 0) { tlUi.sel = null; tlCenterOn(0, 0, Math.min(0.8, Math.max(0.42, Math.min(vw, vh) / 700))); tlUiRefresh(); }
    else tlZoomAt(vw / 2, vh / 2, z > 0 ? 1.25 : 0.8);
  });
  _t(".tlchips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-br]");
    if (b) { ae.play("ui"); tlUi.sel = null; tlFocusBranch(b.dataset.br); }
  });
  _t("#tlHi").addEventListener("change", (e) => { tlUi.hi = e.target.value; tlUiRefresh(); });
  _t("#tlRespec").addEventListener("click", () => {
    if (!tlSpent()) { ee("toast", "No hay talentos que reasignar", ""); return; }
    if (!tlUi.conf) {
      tlUi.conf = 1;
      clearTimeout(tlUi.confT);
      tlUi.confT = setTimeout(() => { tlUi.conf = 0; tlUiRefresh(); }, 4500);
      tlUiRefresh();
      return;
    }
    tlUi.conf = 0;
    const r = tlRespec();
    if (!r.ok) { ae.play("err"); ee("toast", r.why, "bad"); }
    else { ae.play("success"); ee("toast", r.cost ? `Talentos reasignados (−${r.cost} ¤)` : "Talentos reasignados: reparte tus puntos de nuevo", "good"); }
    tlUiRefresh();
  });
  _t("#panel").onkeydown = null;
}

// Resumen para el panel Personaje (29-panels · oS): puntos libres, puntos por rama, nodos clave y maestrías.
function tlSummaryHTML() {
  const S = tlEnsure(x.S), C = tlCfg();
  const rows = C.branches.map((b) => {
    const sp = tlSpent(b.id), m = TL_MASTERY_AT.filter((t) => sp >= t).length;
    const keys = C.nodes.filter((n) => n.br === b.id && n.key && tlRank(n.id) > 0).map((n) => ke(n.n));
    const pw = C.nodes.filter((n) => n.br === b.id && n.power && tlRank(n.id) > 0).map((n) => ke(n.n));
    return `<div class="tls" style="--bc:${b.col}"><div class="tls-h"><b>${ke(b.n)}</b><span>${sp} pts${m ? ` · maestría ${"◆".repeat(m)}` : ""}</span></div><div class="tls-bar"><i style="width:${Math.min(100, (sp / 30) * 100)}%"></i></div>${keys.length || pw.length ? `<div class="tls-k muted">${[...keys.map((k) => "★ " + k), ...pw].join(" · ")}</div>` : ""}</div>`;
  }).join("");
  const free = S.talentPts;
  return `<div class="tls-top"><span>${free > 0 ? `<b style="color:var(--xp)">${free}</b> punto${free === 1 ? "" : "s"} de talento sin gastar` : "Sin puntos de talento pendientes"}</span><button class="btn pri" onclick="window.__talents.open()">${Tt.touchMode ? "Talentos" : "Talentos (T)"}</button></div>${rows}`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 6 · API de pruebas y simulaciones
// ═══════════════════════════════════════════════════════════════════════════════════════════
window.__talents = {
  cfg: () => x.cfg.talents,
  open: openTalents,
  // Centra el lienzo en un nodo y lo selecciona (pruebas y futuros enlaces desde otros paneles).
  focus(id) { const n = tlCfg().byId[id]; if (!n || x.uiOpen !== "talents") return; tlCenterOn(n.at[0], n.at[1], Math.max(tlUi.s, 0.8)); tlSelect(id); },
  grant: grantTalentPoint,
  buy: tlBuy,
  canBuy: (id) => tlCanBuy(tlCfg().byId[id]),
  respec: tlRespec,
  spent: tlSpent,
  fx: () => x.S.talentFx,
  // Ganchos de simulación (tools/sim/talents.mjs): equipo fijo y total de los perks antiguos al máximo.
  simGear(lvl, rarity) {
    const wk = Object.keys(Hn).find((k) => Hn[k].kind === "bullet" && Hn[k].minLvl <= 10) || Object.keys(Hn)[0];
    return { w1: Ca(lvl, rarity, wk), suit: Js(lvl, rarity, "s_bdu"), helmet: Js(lvl, rarity, "h_tac") };
  },
  oldPerksMax() {
    const o = {};
    for (const a of Al) for (const k in a.st) o[k] = (o[k] || 0) + a.st[k] * a.max;
    return o;
  },
  // Instala un build (ids → rangos) sin pasar por la compra; para simulaciones. Devuelve los puntos usados.
  setBuild(build) {
    const S = tlEnsure(x.S);
    for (const n of tlCfg().nodes) delete S.perks[n.id];
    let used = 0;
    for (const [id, r] of Object.entries(build)) {
      const n = tlCfg().byId[id];
      if (!n) continue;
      S.perks[id] = Math.min(r, n.max);
      used += S.perks[id] * n.cost;
    }
    S.talentPts = Math.max(0, S.talentEarned - used);
    x.player.recalc();
    return used;
  },
};

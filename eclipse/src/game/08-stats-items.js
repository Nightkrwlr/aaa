// 08-stats-items.js — Estadísticas, objetos, rarezas, mejoras, investigación

// ════════ [331] VariableDeclaration Sl (2308 bytes) ════════
var Sl = {
  maxHp: { n: "Vida m\xE1xima", fmt: "flat" },
  maxHpPct: { n: "Vida m\xE1xima", fmt: "pct" },
  hpRegen: { n: "Regeneraci\xF3n", fmt: "flat", suf: "/s" },
  armor: { n: "Blindaje", fmt: "flat" },
  shield: { n: "Escudo de energ\xEDa", fmt: "flat" },
  dmg: { n: "Da\xF1o", fmt: "pct" },
  fireRate: { n: "Cadencia de disparo", fmt: "pct" },
  moveSpeed: { n: "Velocidad de movimiento", fmt: "pct" },
  critChance: { n: "Prob. de cr\xEDtico", fmt: "pct" },
  critDmg: { n: "Da\xF1o cr\xEDtico", fmt: "pct" },
  range: { n: "Alcance", fmt: "pct" },
  projSpeed: { n: "Velocidad de proyectil", fmt: "pct" },
  reload: { n: "Velocidad de recarga", fmt: "pct" },
  magSize: { n: "Capacidad de cargador", fmt: "pct" },
  pickup: { n: "Radio de recogida", fmt: "pct" },
  lifesteal: { n: "Robo de vida", fmt: "pct" },
  dodge: { n: "Esquiva", fmt: "pct" },
  xpGain: { n: "Experiencia obtenida", fmt: "pct" },
  luck: { n: "Suerte (bot\xEDn)", fmt: "pct" },
  credits: { n: "Cr\xE9ditos obtenidos", fmt: "pct" },
  dashCd: { n: "Recarga de esprint", fmt: "pct" },
  multishot: { n: "Proyectiles extra", fmt: "flat" },
  pierce: { n: "Perforaci\xF3n", fmt: "flat" },
  ricochet: { n: "Rebotes", fmt: "flat" },
  explodeChance: { n: "Prob. de explosi\xF3n", fmt: "pct" },
  burnChance: { n: "Prob. de quemar", fmt: "pct" },
  freezeChance: { n: "Prob. de congelar", fmt: "pct" },
  shockChance: { n: "Prob. de electrocutar", fmt: "pct" },
  poisonChance: { n: "Prob. de envenenar", fmt: "pct" },
  elemDmg: { n: "Da\xF1o elemental", fmt: "pct" },
  aoe: { n: "\xC1rea de efecto", fmt: "pct" },
  thorns: { n: "Da\xF1o de espinas", fmt: "pct" },
  grenadeDmg: { n: "Da\xF1o de granadas", fmt: "pct" },
  healBonus: { n: "Curaci\xF3n recibida", fmt: "pct" },
  lightRange: { n: "Alcance de linterna", fmt: "pct" },
  resHeat: { n: "Resistencia al calor", fmt: "pct" },
  resCold: { n: "Resistencia al fr\xEDo", fmt: "pct" },
  resToxic: { n: "Resistencia t\xF3xica", fmt: "pct" },
  resRad: { n: "Resistencia a radiaci\xF3n", fmt: "pct" },
  resElec: { n: "Resistencia el\xE9ctrica", fmt: "pct" },
  vsInsect: { n: "Da\xF1o vs insectoides", fmt: "pct" },
  vsMutant: { n: "Da\xF1o vs mutantes", fmt: "pct" },
  vsMech: { n: "Da\xF1o vs mec\xE1nicos", fmt: "pct" },
  vsXeno: { n: "Da\xF1o vs xenoformas", fmt: "pct" },
  vsBoss: { n: "Da\xF1o vs jefes", fmt: "pct" },
  vsElite: { n: "Da\xF1o vs \xE9lites", fmt: "pct" },
  dmgRed: { n: "Reducci\xF3n de da\xF1o", fmt: "pct" },
  execute: { n: "Ejecuta enemigos con menos del 10% de vida", fmt: "flag" },
  regenPct: { n: "de vida por segundo", fmt: "pct" },
  shieldPct: { n: "Escudo (% de vida)", fmt: "pct" },
  grenadeMax: { n: "Granadas m\xE1ximas", fmt: "flat" },
  medkitMax: { n: "Botiquines m\xE1ximos", fmt: "flat" },
};


// ════════ [332] FunctionDeclaration Ks (303 bytes) ════════
function Ks(n, e) {
  let t = Sl[n];
  if (!t) return `${n} ${e}`;
  if (t.fmt === "flag") return t.n;
  if (t.fmt === "pct") {
    let s = e * 100;
    return `${s >= 0 ? "+" : ""}${Math.abs(s) < 10 ? s.toFixed(1).replace(".0", "") : Math.round(s)}% ${t.n}`;
  }
  let i = Math.abs(e) < 10 && e % 1 ? e.toFixed(1) : Math.round(e);
  return `${e >= 0 ? "+" : ""}${i}${t.suf || ""} ${t.n}`;
}


// ════════ [333] VariableDeclaration mt,Di,Sg,vo (956 bytes) ════════
var mt = {
    maxLevel: 60,
    xpToNext: (n) => Math.round(40 * Math.pow(n, 1.75) + 40),
    power: (n) => Math.pow(1.12, n - 1) * (1 + 0.05 * (n - 1)),
    enemyHp: (n) => mt.power(n) * Math.pow(1.036, n - 1),
    enemyDmg: (n) => Math.pow(1.085, n - 1),
    playerHp: (n) => 100 * Math.pow(1.075, n - 1),
    gearScale: (n) => Math.pow(1.075, n - 1),
    enemyXp: (n) => 1.5 * (1 + 0.32 * (n - 1)),
    credits: (n) => 1 + 0.25 * (n - 1),
    armorK: (n) => 60 * Math.pow(1.075, n - 1),
  },
  Di = {
    recluta: {
      n: "Recluta",
      hp: 0.7,
      dmg: 0.55,
      loot: 0.9,
      xp: 1,
      desc: "Para disfrutar de la historia y la exploraci\xF3n.",
    },
    soldado: { n: "Soldado", hp: 1, dmg: 1, loot: 1, xp: 1, desc: "La experiencia equilibrada. Recomendada." },
    veterano: { n: "Veterano", hp: 1.35, dmg: 1.4, loot: 1.3, xp: 1.15, desc: "Enemigos duros. Mejor bot\xEDn." },
    pesadilla: { n: "Pesadilla", hp: 1.8, dmg: 1.9, loot: 1.7, xp: 1.3, desc: "Solo para operadores de \xE9lite." },
  },
  Sg = [
    "Soldado",
    "Cabo",
    "Cabo Primero",
    "Sargento",
    "Sargento Primero",
    "Brigada",
    "Subteniente",
    "Alf\xE9rez",
    "Teniente",
    "Capit\xE1n",
    "Comandante",
    "Teniente Coronel",
    "Coronel",
  ],
  vo = (n) => Sg[Math.min(Sg.length - 1, Math.floor(n / 5))];


// ════════ [334] VariableDeclaration xf (10 bytes) ════════
var xf = {};


// ════════ [335] ExpressionStatement ExpressionStatement (443 bytes) ════════
r0(xf, {
  BUFFS: () => Oi,
  CAPSULE_BUFFS: () => wo,
  CONSUMABLES: () => Tl,
  GEAR: () => ai,
  GEAR_SLOTS: () => Mw,
  MATERIALS: () => mn,
  MAX_UPG: () => Sw,
  MOD_SLOTS: () => ur,
  POWERS: () => Gn,
  RARITY: () => Ct,
  SLOT_NAMES: () => Cd,
  WEAPONS: () => Hn,
  gearImplicits: () => _o,
  genGear: () => Js,
  genItem: () => Rg,
  genMod: () => pf,
  genPowChip: () => mf,
  genWeapon: () => Ca,
  itemName: () => ff,
  itemValue: () => ka,
  powSlots: () => Zs,
  rollRarity: () => yo,
  rollTier: () => gf,
  salvageYield: () => hr,
  upgradeCost: () => Ew,
  weaponStats: () => Mo,
});


// ════════ [336] VariableDeclaration Ct,mn,Tl,Hn,Mw,Cd,ai,Tg,Ag,Gn,ww (14356 bytes) ════════
var Ct = [
    { n: "Com\xFAn", c: 13226454, css: "#c9d1d6", aff: 0, mult: 1, w: 62 },
    { n: "Poco com\xFAn", c: 6280026, css: "#5fd35a", aff: 1, mult: 1.08, w: 27 },
    { n: "Raro", c: 4161535, css: "#3f7fff", aff: 2, mult: 1.18, w: 8.5 },
    { n: "\xC9pico", c: 16769082, css: "#ffe03a", aff: 3, mult: 1.3, w: 1.3 },
    { n: "Legendario", c: 16738832, css: "#ff6a10", aff: 3, mult: 1.45, w: 0.18 },
    { n: "M\xEDtico", c: 16732120, css: "#ff4fd8", aff: 4, mult: 1.65, w: 0.02 },
  ],
  mn = {
    scrap: { n: "Chatarra", c: "#b8c0c8", icon: "\u2699" },
    bio: { n: "Biomasa", c: "#7ed957", icon: "\u2766" },
    crystal: { n: "Cristal xeno", c: "#c06bff", icon: "\u25C6" },
    core: { n: "N\xFAcleo de energ\xEDa", c: "#40e0ff", icon: "\u25C9" },
    data: { n: "Datos cifrados", c: "#ffd447", icon: "\u25A3" },
    battery: { n: "Bater\xEDa", c: "#ffe08a", icon: "\u25AE" },
  },
  Tl = {
    medkit: { n: "Botiqu\xEDn", key: "1", desc: "Restaura el 45% de la vida en 2 s.", price: 60 },
    stim: { n: "Estimulante de combate", key: "2", desc: "+35% da\xF1o y cadencia durante 30 s.", price: 120 },
    grenade: { n: "Granada de fragmentaci\xF3n", key: "G", desc: "Gran da\xF1o en \xE1rea.", price: 45 },
  },
  Hn = {
    pistol: {
      n: "Pistola t\xE1ctica",
      kind: "bullet",
      dmg: 10,
      rate: 3.2,
      mag: 12,
      reload: 1,
      range: 13,
      speed: 34,
      spread: 0.03,
      minLvl: 1,
      w: 10,
      col: 3817284,
      len: 0.35,
      sfx: "pistol",
      tracer: 16771496,
    },
    revolver: {
      n: "Rev\xF3lver pesado",
      kind: "bullet",
      dmg: 27,
      rate: 1.4,
      mag: 6,
      reload: 1.6,
      range: 15,
      speed: 40,
      spread: 0.01,
      crit: 0.1,
      minLvl: 2,
      w: 7,
      col: 7035466,
      len: 0.42,
      sfx: "revolver",
      tracer: 16765562,
    },
    smg: {
      n: "Subfusil",
      kind: "bullet",
      dmg: 4.6,
      rate: 9.5,
      mag: 32,
      reload: 1.4,
      range: 10.5,
      speed: 34,
      spread: 0.12,
      minLvl: 1,
      w: 9,
      col: 2961974,
      len: 0.5,
      sfx: "smg",
      tracer: 16771496,
    },
    rifle: {
      n: "Fusil de asalto",
      kind: "bullet",
      dmg: 8.8,
      rate: 6.2,
      mag: 30,
      reload: 1.6,
      range: 15,
      speed: 40,
      spread: 0.05,
      minLvl: 2,
      w: 9,
      col: 3883572,
      len: 0.75,
      sfx: "rifle",
      tracer: 16769162,
    },
    shotgun: {
      n: "Escopeta t\xE1ctica",
      kind: "pellet",
      dmg: 6.5,
      pellets: 7,
      rate: 1.3,
      mag: 6,
      reload: 1.9,
      range: 8.5,
      speed: 30,
      spread: 0.42,
      minLvl: 3,
      w: 8,
      col: 4864556,
      len: 0.7,
      sfx: "shotgun",
      tracer: 16760944,
    },
    sniper: {
      n: "Fusil de precisi\xF3n",
      kind: "bullet",
      dmg: 64,
      rate: 0.85,
      mag: 5,
      reload: 2,
      range: 23,
      speed: 70,
      spread: 0,
      pierce: 3,
      crit: 0.15,
      minLvl: 5,
      w: 6,
      col: 3095087,
      len: 1,
      sfx: "sniper",
      tracer: 12577023,
    },
    minigun: {
      n: "Ametralladora rotativa",
      kind: "bullet",
      dmg: 3.4,
      rate: 17,
      mag: 160,
      reload: 3,
      range: 12.5,
      speed: 38,
      spread: 0.15,
      spin: !0,
      minLvl: 8,
      w: 5,
      col: 4540749,
      len: 0.85,
      sfx: "smg",
      tracer: 16765562,
    },
    flamer: {
      n: "Lanzallamas",
      kind: "flame",
      dmg: 2.5,
      rate: 18,
      mag: 110,
      reload: 2.2,
      range: 6.5,
      speed: 12,
      spread: 0.28,
      pierce: 99,
      elem: "fire",
      burn: 0.3,
      minLvl: 4,
      w: 6,
      col: 8006170,
      len: 0.75,
      sfx: "flame",
    },
    glauncher: {
      n: "Lanzagranadas",
      kind: "grenade",
      dmg: 36,
      aoe: 2.7,
      rate: 1.15,
      mag: 6,
      reload: 2.2,
      range: 13,
      speed: 14,
      spread: 0.04,
      minLvl: 6,
      w: 5,
      col: 4082227,
      len: 0.7,
      sfx: "thump",
    },
    rocket: {
      n: "Lanzacohetes",
      kind: "rocket",
      dmg: 78,
      aoe: 3.3,
      rate: 0.6,
      mag: 4,
      reload: 2.6,
      range: 19,
      speed: 18,
      spread: 0.02,
      minLvl: 10,
      w: 4,
      col: 4938298,
      len: 1.05,
      sfx: "rocket",
    },
    laser: {
      n: "Rifle l\xE1ser",
      kind: "beam",
      dmg: 3.4,
      rate: 14,
      mag: 80,
      reload: 2,
      range: 14,
      speed: 0,
      spread: 0,
      pierce: 1,
      elem: "energy",
      minLvl: 7,
      w: 5,
      col: 14279658,
      len: 0.8,
      sfx: "laser",
      tracer: 16724821,
    },
    rail: {
      n: "Ca\xF1\xF3n de riel",
      kind: "rail",
      dmg: 100,
      rate: 0.55,
      mag: 4,
      reload: 2.4,
      range: 30,
      speed: 0,
      spread: 0,
      pierce: 99,
      elem: "shock",
      shock: 0.3,
      minLvl: 14,
      w: 3,
      col: 3159613,
      len: 1.1,
      sfx: "rail",
      tracer: 6742271,
    },
    tesla: {
      n: "Arco tesla",
      kind: "chain",
      dmg: 10,
      rate: 3,
      chains: 3,
      mag: 24,
      reload: 1.8,
      range: 9.5,
      speed: 0,
      elem: "shock",
      shock: 0.25,
      minLvl: 9,
      w: 5,
      col: 2766160,
      len: 0.6,
      sfx: "zap",
      tracer: 9426175,
    },
    cryo: {
      n: "Crioproyector",
      kind: "flame",
      dmg: 3,
      rate: 12,
      mag: 90,
      reload: 2,
      range: 8,
      speed: 13,
      spread: 0.2,
      pierce: 99,
      elem: "ice",
      freeze: 0.1,
      minLvl: 11,
      w: 4,
      col: 10475775,
      len: 0.7,
      sfx: "cryo",
    },
    plasma: {
      n: "Ca\xF1\xF3n de plasma",
      kind: "orb",
      dmg: 34,
      aoe: 1.9,
      rate: 1.5,
      mag: 10,
      reload: 2,
      range: 14,
      speed: 15,
      spread: 0.02,
      elem: "energy",
      minLvl: 12,
      w: 4,
      col: 3426654,
      len: 0.75,
      sfx: "plasma",
      tracer: 8060884,
    },
    disc: {
      n: "Lanzadiscos",
      kind: "disc",
      dmg: 23,
      rate: 2,
      mag: 8,
      reload: 1.6,
      range: 12,
      speed: 20,
      spread: 0,
      pierce: 2,
      ricochet: 3,
      minLvl: 7,
      w: 4,
      col: 9080724,
      len: 0.6,
      sfx: "disc",
      tracer: 13693183,
    },
    swarm: {
      n: "Lanzador de enjambre",
      kind: "swarm",
      dmg: 12,
      pellets: 3,
      rate: 1.25,
      mag: 9,
      reload: 2,
      range: 17,
      speed: 14,
      spread: 0.6,
      minLvl: 16,
      w: 3,
      col: 3948330,
      len: 0.8,
      sfx: "swarm",
      tracer: 16757596,
    },
    acid: {
      n: "Escupe\xE1cido xeno",
      kind: "acid",
      dmg: 11,
      aoe: 1.6,
      rate: 2,
      mag: 14,
      reload: 1.7,
      range: 10,
      speed: 13,
      spread: 0.05,
      elem: "toxic",
      poison: 0.5,
      minLvl: 13,
      w: 4,
      col: 5008170,
      len: 0.65,
      sfx: "spit",
      tracer: 10354506,
    },
    crossbow: {
      n: "Ballesta de asalto",
      kind: "bolt",
      dmg: 46,
      rate: 1.1,
      mag: 6,
      reload: 1.7,
      range: 17,
      speed: 48,
      spread: 0,
      pierce: 2,
      aoe: 1.2,
      minLvl: 6,
      w: 4,
      col: 5916210,
      len: 0.7,
      sfx: "bow",
      tracer: 16773312,
    },
    void: {
      n: "Proyector de singularidad",
      kind: "void",
      dmg: 9,
      rate: 0.55,
      mag: 4,
      reload: 2.6,
      range: 12,
      speed: 8,
      aoe: 3.2,
      elem: "energy",
      minLvl: 20,
      w: 1.2,
      col: 1774896,
      len: 0.85,
      sfx: "void",
      tracer: 11889663,
      minRarity: 3,
    },
  },
  Mw = ["helmet", "suit", "gloves", "boots", "implant", "module"],
  Cd = {
    weapon: "Arma",
    helmet: "Casco",
    suit: "Traje",
    gloves: "Guantes",
    boots: "Botas",
    implant: "Implante",
    module: "M\xF3dulo",
  },
  ai = {
    h_tac: { slot: "helmet", n: "Casco t\xE1ctico", imp: [["armor", 6, 1]], minLvl: 1, col: 4872762, model: "tac" },
    h_nv: {
      slot: "helmet",
      n: "Casco de visi\xF3n nocturna",
      imp: [
        ["armor", 3, 1],
        ["lightRange", 0.35],
        ["critChance", 0.03],
      ],
      minLvl: 3,
      col: 3029546,
      model: "nv",
    },
    h_therm: {
      slot: "helmet",
      n: "Pasamonta\xF1as t\xE9rmico",
      imp: [
        ["resCold", 0.18],
        ["maxHp", 8, 1],
      ],
      minLvl: 15,
      col: 6978186,
      model: "balaclava",
    },
    h_nbq: {
      slot: "helmet",
      n: "M\xE1scara NBQ",
      imp: [
        ["resToxic", 0.18],
        ["resRad", 0.12],
      ],
      minLvl: 10,
      col: 4016698,
      model: "gas",
    },
    h_assault: {
      slot: "helmet",
      n: "Casco de asalto pesado",
      imp: [
        ["armor", 11, 1],
        ["moveSpeed", -0.03],
      ],
      minLvl: 8,
      col: 2895926,
      model: "heavy",
    },
    h_neural: {
      slot: "helmet",
      n: "Casco neural",
      imp: [
        ["xpGain", 0.1],
        ["dashCd", 0.08],
      ],
      minLvl: 18,
      col: 2766160,
      model: "neural",
    },
    h_ref: {
      slot: "helmet",
      n: "Visor refractario",
      imp: [
        ["resHeat", 0.18],
        ["armor", 4, 1],
      ],
      minLvl: 10,
      col: 9067050,
      model: "visor",
    },
    s_bdu: {
      slot: "suit",
      n: "Uniforme de campa\xF1a",
      imp: [["maxHp", 20, 1]],
      minLvl: 1,
      col: 5200444,
      model: "bdu",
    },
    s_vest: {
      slot: "suit",
      n: "Chaleco antibalas",
      imp: [
        ["armor", 10, 1],
        ["maxHp", 8, 1],
      ],
      minLvl: 2,
      col: 3949622,
      model: "vest",
    },
    s_cool: {
      slot: "suit",
      n: "Traje refrigerado",
      imp: [
        ["resHeat", 0.3],
        ["maxHp", 10, 1],
      ],
      minLvl: 8,
      col: 12098154,
      model: "cool",
    },
    s_nbq: {
      slot: "suit",
      n: "Traje NBQ",
      imp: [
        ["resToxic", 0.3],
        ["resRad", 0.15],
      ],
      minLvl: 12,
      col: 5925418,
      model: "nbq",
    },
    s_arctic: {
      slot: "suit",
      n: "Traje \xE1rtico",
      imp: [
        ["resCold", 0.35],
        ["maxHp", 12, 1],
      ],
      minLvl: 16,
      col: 14673644,
      model: "arctic",
    },
    s_lead: {
      slot: "suit",
      n: "Traje forrado de plomo",
      imp: [
        ["resRad", 0.35],
        ["armor", 6, 1],
        ["moveSpeed", -0.04],
      ],
      minLvl: 28,
      col: 6974042,
      model: "lead",
    },
    s_fire: {
      slot: "suit",
      n: "Traje ign\xEDfugo",
      imp: [
        ["resHeat", 0.45],
        ["resElec", 0.1],
      ],
      minLvl: 24,
      col: 10115626,
      model: "fire",
    },
    s_exo: {
      slot: "suit",
      n: "Exotraje militar",
      imp: [
        ["armor", 12, 1],
        ["dmg", 0.06],
      ],
      minLvl: 14,
      col: 2764598,
      model: "exo",
    },
    s_stealth: {
      slot: "suit",
      n: "Traje de sigilo",
      imp: [
        ["dodge", 0.08],
        ["moveSpeed", 0.04],
      ],
      minLvl: 10,
      col: 1843238,
      model: "stealth",
    },
    s_bio: {
      slot: "suit",
      n: "Bioarmadura xeno",
      imp: [
        ["hpRegen", 0.8, 1],
        ["resToxic", 0.25],
        ["vsXeno", 0.08],
      ],
      minLvl: 36,
      col: 5909098,
      model: "bio",
    },
    g_tac: { slot: "gloves", n: "Guantes t\xE1cticos", imp: [["fireRate", 0.05]], minLvl: 1, col: 3026474 },
    g_marks: { slot: "gloves", n: "Guantes de tirador", imp: [["critChance", 0.05]], minLvl: 3, col: 3812900 },
    g_reload: { slot: "gloves", n: "Guantes de recarga r\xE1pida", imp: [["reload", 0.12]], minLvl: 5, col: 2764854 },
    g_gaunt: {
      slot: "gloves",
      n: "Guanteletes blindados",
      imp: [
        ["armor", 5, 1],
        ["grenadeDmg", 0.15],
      ],
      minLvl: 7,
      col: 4540749,
    },
    g_ins: {
      slot: "gloves",
      n: "Guantes diel\xE9ctricos",
      imp: [
        ["resElec", 0.2],
        ["shockChance", 0.05],
      ],
      minLvl: 12,
      col: 5921306,
    },
    b_cbt: { slot: "boots", n: "Botas de combate", imp: [["moveSpeed", 0.05]], minLvl: 1, col: 2762272 },
    b_asl: {
      slot: "boots",
      n: "Botas de asalto",
      imp: [
        ["dashCd", 0.12],
        ["moveSpeed", 0.03],
      ],
      minLvl: 4,
      col: 3158060,
    },
    b_snow: {
      slot: "boots",
      n: "Botas de nieve",
      imp: [
        ["resCold", 0.12],
        ["moveSpeed", 0.03],
      ],
      minLvl: 15,
      col: 9080724,
    },
    b_jump: {
      slot: "boots",
      n: "Botas de salto",
      imp: [
        ["dodge", 0.05],
        ["moveSpeed", 0.06],
      ],
      minLvl: 9,
      col: 3820122,
    },
    b_mag: {
      slot: "boots",
      n: "Botas magn\xE9ticas",
      imp: [
        ["pickup", 0.3],
        ["armor", 3, 1],
      ],
      minLvl: 6,
      col: 4869973,
    },
    i_heart: { slot: "implant", n: "Implante card\xEDaco", imp: [["hpRegen", 0.6, 1]], minLvl: 2, col: 16728160 },
    i_optic: { slot: "implant", n: "Implante \xF3ptico", imp: [["critDmg", 0.2]], minLvl: 4, col: 4243711 },
    i_reflex: {
      slot: "implant",
      n: "Implante de reflejos",
      imp: [
        ["dodge", 0.06],
        ["fireRate", 0.04],
      ],
      minLvl: 8,
      col: 16764992,
    },
    i_meta: {
      slot: "implant",
      n: "Implante metab\xF3lico",
      imp: [
        ["healBonus", 0.2],
        ["lifesteal", 0.01],
      ],
      minLvl: 11,
      col: 6356880,
    },
    i_detox: {
      slot: "implant",
      n: "Filtro hep\xE1tico",
      imp: [
        ["resToxic", 0.15],
        ["resRad", 0.1],
      ],
      minLvl: 13,
      col: 9502528,
    },
    m_shield: { slot: "module", n: "Generador de escudo", imp: [["shield", 20, 1]], minLvl: 3, col: 4251903 },
    m_luck: { slot: "module", n: "Amuleto de la suerte", imp: [["luck", 0.15]], minLvl: 1, col: 16766023 },
    m_tags: { slot: "module", n: "Placas de identificaci\xF3n", imp: [["xpGain", 0.1]], minLvl: 1, col: 12634320 },
    m_magnet: { slot: "module", n: "Im\xE1n gravitatorio", imp: [["pickup", 0.5]], minLvl: 2, col: 10514687 },
    m_battery: {
      slot: "module",
      n: "Bater\xEDa t\xE1ctica",
      imp: [
        ["lightRange", 0.4],
        ["shield", 8, 1],
      ],
      minLvl: 5,
      col: 16769162,
    },
    m_xeno: {
      slot: "module",
      n: "Detector xeno",
      imp: [
        ["vsXeno", 0.15],
        ["vsInsect", 0.1],
      ],
      minLvl: 10,
      col: 12610559,
    },
    m_aim: {
      slot: "module",
      n: "Chip de punter\xEDa",
      imp: [
        ["critChance", 0.05],
        ["range", 0.08],
      ],
      minLvl: 6,
      col: 16736320,
    },
    m_cool: {
      slot: "module",
      n: "Disipador t\xE9rmico",
      imp: [
        ["resHeat", 0.15],
        ["resElec", 0.1],
      ],
      minLvl: 9,
      col: 16747072,
    },
  },
  Tg = [
    ["dmg", 0.06, 0.16, 0, 10],
    ["fireRate", 0.05, 0.13, 0, 8],
    ["critChance", 0.03, 0.08, 0, 7],
    ["critDmg", 0.15, 0.4, 0, 6],
    ["multishot", 1, 1, 0, 1.6],
    ["pierce", 1, 2, 0, 3],
    ["ricochet", 1, 2, 0, 2.5],
    ["explodeChance", 0.05, 0.12, 0, 2.5],
    ["burnChance", 0.08, 0.2, 0, 3],
    ["freezeChance", 0.06, 0.15, 0, 3],
    ["shockChance", 0.08, 0.2, 0, 3],
    ["poisonChance", 0.1, 0.25, 0, 3],
    ["projSpeed", 0.1, 0.25, 0, 3],
    ["range", 0.06, 0.15, 0, 4],
    ["magSize", 0.15, 0.4, 0, 5],
    ["reload", 0.1, 0.25, 0, 5],
    ["lifesteal", 0.008, 0.02, 0, 2.5],
    ["vsInsect", 0.1, 0.25, 0, 2.5],
    ["vsMutant", 0.1, 0.25, 0, 2.5],
    ["vsMech", 0.1, 0.25, 0, 2.5],
    ["vsXeno", 0.1, 0.25, 0, 2.5],
    ["vsBoss", 0.1, 0.22, 0, 2],
    ["vsElite", 0.1, 0.22, 0, 2],
    ["elemDmg", 0.12, 0.3, 0, 3],
    ["aoe", 0.1, 0.25, 0, 2.5],
    ["execute", 1, 1, 0, 0.7],
  ],
  Ag = [
    ["maxHp", 10, 22, 1, 10],
    ["maxHpPct", 0.04, 0.1, 0, 5],
    ["hpRegen", 0.3, 0.9, 1, 6],
    ["armor", 4, 10, 1, 8],
    ["shield", 8, 20, 1, 4],
    ["moveSpeed", 0.03, 0.07, 0, 6],
    ["dodge", 0.02, 0.05, 0, 4],
    ["resHeat", 0.06, 0.15, 0, 4],
    ["resCold", 0.06, 0.15, 0, 4],
    ["resToxic", 0.06, 0.15, 0, 4],
    ["resRad", 0.06, 0.15, 0, 4],
    ["resElec", 0.06, 0.15, 0, 3],
    ["pickup", 0.1, 0.3, 0, 4],
    ["xpGain", 0.04, 0.1, 0, 4],
    ["luck", 0.05, 0.15, 0, 4],
    ["credits", 0.06, 0.15, 0, 3],
    ["dashCd", 0.05, 0.12, 0, 3],
    ["critChance", 0.02, 0.05, 0, 4],
    ["critDmg", 0.08, 0.2, 0, 3],
    ["dmg", 0.03, 0.08, 0, 5],
    ["fireRate", 0.03, 0.07, 0, 4],
    ["thorns", 0.2, 0.6, 0, 2],
    ["grenadeDmg", 0.1, 0.3, 0, 2],
    ["healBonus", 0.08, 0.2, 0, 3],
    ["lightRange", 0.15, 0.35, 0, 2],
    ["dmgRed", 0.02, 0.05, 0, 2.5],
    ["lifesteal", 0.005, 0.012, 0, 1.5],
    ["vsInsect", 0.06, 0.14, 0, 1.5],
    ["vsMutant", 0.06, 0.14, 0, 1.5],
    ["vsMech", 0.06, 0.14, 0, 1.5],
    ["vsXeno", 0.06, 0.14, 0, 1.5],
  ],
  Gn = {
    split: {
      t: "weapon",
      n: "Fragmentaci\xF3n",
      d: "Los proyectiles se dividen en 3 fragmentos al impactar.",
      names: ["Hidra", "Racimo de Ares", "La Metralla"],
    },
    chainCrit: {
      t: "weapon",
      n: "Tormenta cr\xEDtica",
      d: "Los cr\xEDticos liberan un rayo que salta a 3 enemigos.",
      names: ["Juicio de Zeus", "Tempestad", "Voltio Cero"],
    },
    explodeKill: {
      t: "weapon",
      n: "Detonador",
      d: "Los enemigos abatidos explotan y da\xF1an a los cercanos.",
      names: ["Reacci\xF3n en Cadena", "Big Bang", "La Mecha"],
    },
    homing: {
      t: "weapon",
      n: "Buscador",
      d: "Los proyectiles persiguen a sus objetivos.",
      names: ["Halc\xF3n", "Ojo de Horus", "Rastreador"],
    },
    frostNova: {
      t: "weapon",
      n: "Nova g\xE9lida",
      d: "Al recargar liberas una onda que congela a tu alrededor.",
      names: ["Invierno Eterno", "Escarcha", "B\xF3reas"],
    },
    lastShot: {
      t: "weapon",
      n: "\xDAltimo aliento",
      d: "Las 3 \xFAltimas balas del cargador hacen triple da\xF1o.",
      names: ["Requiem", "La Despedida", "Remate"],
    },
    vampire: {
      t: "weapon",
      n: "Sed de sangre",
      d: "+3% robo de vida. Cada baja cura un 2% de vida.",
      names: ["Dr\xE1cula", "Sanguinaria", "Colmillo"],
    },
    ricochetAll: {
      t: "weapon",
      n: "Pinball",
      d: "+3 rebotes en todos los proyectiles.",
      names: ["Carambola", "Bumer\xE1n", "Caos Cin\xE9tico"],
    },
    drone: {
      t: "weapon",
      n: "Dron escolta",
      d: "Un dron te acompa\xF1a y dispara con el 35% de tu da\xF1o.",
      names: ["Halc\xF3n Mec\xE1nico", "\xC1ngel Guardi\xE1n", "Centinela"],
    },
    blackhole: {
      t: "weapon",
      n: "Microsingularidad",
      d: "Un 8% de los impactos crea un peque\xF1o agujero negro.",
      names: ["Horizonte de Sucesos", "Abismo", "Gravit\xF3n"],
    },
    overheat: {
      t: "weapon",
      n: "Sobrecalentamiento",
      d: "Nunca recarga. +3% de da\xF1o por segundo disparando (m\xE1x. +75%).",
      names: ["Forja Infernal", "Hefesto", "Magma"],
    },
    bigBullets: {
      t: "weapon",
      n: "Calibre tit\xE1n",
      d: "Proyectiles enormes: +40% da\xF1o y +2 perforaci\xF3n.",
      names: ["Goliat", "Martillo de Thor", "Tit\xE1n"],
    },
    phoenix: {
      t: "gear",
      n: "F\xE9nix",
      d: "Al caer, revives con el 50% de vida (una vez cada 3 min).",
      names: ["Plumas de F\xE9nix", "Segunda Oportunidad"],
    },
    burnAura: {
      t: "gear",
      n: "Aura \xEDgnea",
      d: "Quemas continuamente a los enemigos cercanos.",
      names: ["Corona de Fuego", "Infierno Port\xE1til"],
    },
    dashNova: {
      t: "gear",
      n: "Onda de choque",
      d: "El esprint libera una onda que da\xF1a y empuja.",
      names: ["Estampida", "Carga de Rinoceronte"],
    },
    orbitals: {
      t: "gear",
      n: "Orbitales",
      d: "Tres orbes de energ\xEDa giran a tu alrededor da\xF1ando.",
      names: ["Anillos de Saturno", "Sistema Solar"],
    },
    adrenaline: {
      t: "gear",
      n: "Adrenalina",
      d: "Con menos del 35% de vida: +50% da\xF1o y +30% velocidad.",
      names: ["\xDAltimo Recurso", "Instinto Animal"],
    },
    magnetLord: {
      t: "gear",
      n: "Se\xF1or del magnetismo",
      d: "Recogida \xD72 y los orbes de experiencia curan.",
      names: ["Polo Norte", "Atractor"],
    },
    nightStalker: {
      t: "gear",
      n: "Acechador nocturno",
      d: "En la oscuridad: +30% da\xF1o y +15% cr\xEDtico.",
      names: ["Ojos de B\xFAho", "Depredador Nocturno"],
    },
    berserker: {
      t: "gear",
      n: "Berserker",
      d: "Cada baja +2% cadencia (m\xE1x. +40%), se disipa con el tiempo.",
      names: ["Furia Vikinga", "Frenes\xED"],
    },
    luckyStar: {
      t: "gear",
      n: "Estrella de la suerte",
      d: "+50% suerte y +50% cr\xE9ditos.",
      names: ["Tr\xE9bol de Cuatro Hojas", "Fortuna"],
    },
    shieldBurst: {
      t: "gear",
      n: "Ruptura de escudo",
      d: "Al romperse tu escudo, explotas y repeles a los enemigos.",
      names: ["\xC9gida", "Basti\xF3n"],
    },
  },
  ww = {
    dmg: ["Devastador", "Brutal", "Feroz"],
    fireRate: ["Fren\xE9tico", "\xC1gil", "Veloz"],
    critChance: ["Certero", "Letal", "Preciso"],
    critDmg: ["Despiadado", "Cruel"],
    multishot: ["M\xFAltiple", "Doble"],
    pierce: ["Perforante", "Penetrante"],
    ricochet: ["Rebotador", "Saltar\xEDn"],
    explodeChance: ["Explosivo", "Vol\xE1til"],
    burnChance: ["\xCDgneo", "Abrasador"],
    freezeChance: ["G\xE9lido", "Glacial"],
    shockChance: ["El\xE9ctrico", "Voltaico"],
    poisonChance: ["T\xF3xico", "Venenoso"],
    maxHp: ["Robusto", "Resistente"],
    armor: ["Blindado", "Acorazado"],
    moveSpeed: ["Ligero", "Raudo"],
    resHeat: ["Ign\xEDfugo"],
    resCold: ["T\xE9rmico"],
    resToxic: ["Herm\xE9tico"],
    resRad: ["Aislado"],
    luck: ["Afortunado"],
    xpGain: ["Sabio"],
    lifesteal: ["Vamp\xEDrico"],
    hpRegen: ["Regenerativo"],
    shield: ["Cargado"],
    dodge: ["Esquivo"],
  };


// ════════ [337] FunctionDeclaration yo (115 bytes) ════════
function yo(n = 0, e = 0, t = 0) {
  let i = Ct.map((a, r) => ({ i: r, w: r === 0 ? a.w : a.w * (1 + n) * (1 + t * r) })),
    s = ii(i).i;
  return Math.max(e, s);
}


// ════════ [338] FunctionDeclaration uf (309 bytes) ════════
function uf(n, e, t, i) {
  let s = n.filter((o) => !e.has(o[0])),
    a = ii(s.map((o) => ({ x: o, w: o[4] }))).x;
  e.add(a[0]);
  let r = a[1] + Lt() * (a[2] - a[1]);
  return (
    a[3] && (r *= mt.gearScale(t)),
    (r *= 1 + i * 0.1),
    (a[0] === "multishot" || a[0] === "pierce" || a[0] === "ricochet" || a[0] === "execute") &&
      (r = Math.round(a[1] + Lt() * (a[2] - a[1]))),
    { s: a[0], v: +r.toFixed(4) }
  );
}


// ════════ [339] FunctionDeclaration Ca (714 bytes) ════════
function Ca(n, e = null, t = null, i = {}) {
  n = qe(Math.round(n), 1, 70);
  let s = e ?? yo(i.luck || 0, i.minR || 0);
  if (!t) {
    let c = Object.entries(Hn)
      .filter(([d, h]) => h.minLvl <= n + 2 && (!h.minRarity || s >= h.minRarity))
      .map(([d, h]) => ({ k: d, w: h.w }));
    t = ii(c).k;
  }
  let a = Hn[t];
  a.minRarity && s < a.minRarity && (s = a.minRarity);
  let r = new Set(),
    o = [];
  for (let c = 0; c < Ct[s].aff; c++) o.push(uf(Tg, r, n, s));
  let l = { id: mi(), type: "weapon", slot: "weapon", base: t, r: s, ilvl: n, aff: o, upg: 0, isNew: !0 };
  if (s >= 4) {
    let c = Object.entries(Gn).filter(([h, f]) => f.t === "weapon" && !(h === "overheat" && a.kind === "beam")),
      [d] = c[Math.floor(Lt() * c.length)];
    l.pow = d;
  }
  if (s === 5) {
    let c = Object.entries(Gn).filter(([d, h]) => h.t === "weapon" && d !== l.pow);
    l.pow2 = c[Math.floor(Lt() * c.length)][0];
  }
  return ((l.name = ff(l)), l);
}


// ════════ [340] FunctionDeclaration Js (508 bytes) ════════
function Js(n, e = null, t = null, i = {}) {
  n = qe(Math.round(n), 1, 70);
  let s = e ?? yo(i.luck || 0, i.minR || 0);
  if (!t) {
    let c = Object.entries(ai)
      .filter(([d, h]) => h.minLvl <= n + 2 && (!i.slot || h.slot === i.slot))
      .map(([d]) => ({ k: d, w: 1 }));
    t = ii(c).k;
  }
  let a = ai[t],
    r = new Set(a.imp.map((c) => c[0])),
    o = [];
  for (let c = 0; c < Ct[s].aff; c++) o.push(uf(Ag, r, n, s));
  let l = { id: mi(), type: "gear", slot: a.slot, base: t, r: s, ilvl: n, aff: o, upg: 0, isNew: !0 };
  if (s >= 4) {
    let c = Object.keys(Gn).filter((d) => Gn[d].t === "gear");
    l.pow = c[Math.floor(Lt() * c.length)];
  }
  return ((l.name = ff(l)), l);
}


// ════════ [341] FunctionDeclaration Rg (110 bytes) ════════
function Rg(n, e = {}) {
  return Lt() < (e.weaponChance ?? 0.45) ? Ca(n, e.rarity ?? null, null, e) : Js(n, e.rarity ?? null, null, e);
}


// ════════ [342] FunctionDeclaration ff (279 bytes) ════════
function ff(n) {
  let e = n.type === "weapon" ? Hn[n.base].n : ai[n.base].n;
  if (n.pow) {
    let t = Gn[n.pow];
    return `\xAB${t.names[Math.floor(Lt() * t.names.length)]}\xBB ${e}`;
  }
  if (n.aff.length && n.r >= 1) {
    let t = n.aff[0].s,
      i = ww[t];
    if (i) return `${e} ${i[Math.floor(Lt() * i.length)].toLowerCase()}`;
  }
  return e;
}


// ════════ [343] FunctionDeclaration _o (146 bytes) ════════
function _o(n) {
  let e = ai[n.base],
    t = 1 + 0.1 * (n.upg || 0);
  return e.imp.map(([i, s, a]) => ({
    s: i,
    v: +(s * (a ? mt.gearScale(n.ilvl) : 1) * (1 + n.r * 0.08) * t).toFixed(4),
  }));
}


// ════════ [344] FunctionDeclaration Mo (346 bytes) ════════
function Mo(n) {
  let e = Hn[n.base],
    t = 1 + 0.09 * (n.upg || 0);
  return {
    dmg: e.dmg * mt.power(n.ilvl) * Ct[n.r].mult * t,
    rate: e.rate * (1 + 0.012 * (n.upg || 0)),
    mag: e.mag,
    reload: e.reload,
    range: e.range,
    speed: e.speed,
    spread: e.spread || 0,
    pellets: e.pellets || 1,
    pierce: e.pierce || 0,
    ricochet: e.ricochet || 0,
    aoe: e.aoe || 0,
    chains: e.chains || 0,
    crit: e.crit || 0,
    elem: e.elem || null,
    kind: e.kind,
  };
}


// ════════ [345] FunctionDeclaration ka (94 bytes) ════════
function ka(n) {
  return Math.round(8 * Math.pow(1 + n.r, 2.1) * mt.credits(n.ilvl) * (1 + 0.15 * (n.upg || 0)));
}


// ════════ [346] FunctionDeclaration hr (154 bytes) ════════
function hr(n) {
  let e = { scrap: Math.round((2 + n.r * 3) * (1 + n.ilvl / 15)) };
  return (n.r >= 2 && (e.crystal = n.r - 1), n.r >= 3 && (e.core = n.r - 2), n.type === "gear" && (e.bio = 1 + n.r), e);
}


// ════════ [347] FunctionDeclaration Ew (201 bytes) ════════
function Ew(n) {
  let e = n.upg || 0;
  return {
    credits: Math.round(40 * Math.pow(1.55, e) * mt.credits(n.ilvl) * (1 + n.r * 0.3)),
    scrap: Math.round(6 + e * 5 + n.ilvl * 0.6),
    crystal: e >= 3 ? Math.ceil((e - 2) * (1 + n.r * 0.5)) : 0,
    core: e >= 7 ? e - 6 : 0,
  };
}


// ════════ [348] VariableDeclaration Sw,Oi,wo,ur,Zs,Tw (1264 bytes) ════════
var Sw = 10,
  Oi = {
    fury: { n: "Furia", c: "#ff4040", d: "+100% da\xF1o", dur: 15 },
    hyper: { n: "Hipercarga", c: "#ffd447", d: "+80% cadencia", dur: 15 },
    plasma: { n: "Escudo de plasma", c: "#40e0ff", d: "Escudo del 60% de tu vida", dur: 20 },
    haste: { n: "Velocidad", c: "#5fd35a", d: "+50% velocidad", dur: 15 },
    magnet: { n: "Im\xE1n", c: "#b45cff", d: "Recogida \xD75", dur: 20 },
    wisdom: { n: "Sabidur\xEDa", c: "#3fa3ff", d: "+100% experiencia", dur: 60 },
    ghost: { n: "Fantasma", c: "#ffffff", d: "Invulnerable", dur: 6 },
    boom: { n: "Munici\xF3n explosiva", c: "#ff9a1f", d: "Los disparos explotan", dur: 15 },
    multi: { n: "Multidisparo", c: "#ff7ad9", d: "+2 proyectiles", dur: 15 },
    vamp: { n: "Vampirismo", c: "#c01040", d: "8% robo de vida", dur: 20 },
    frost: { n: "Munici\xF3n criog\xE9nica", c: "#9fd8ff", d: "Los disparos congelan", dur: 15 },
    fortune: { n: "Fortuna", c: "#ffcc33", d: "+100% bot\xEDn y cr\xE9ditos", dur: 60 },
    stim: { n: "Estimulante", c: "#ff6a3d", d: "+35% da\xF1o y cadencia", dur: 30 },
    frenzy: { n: "Frenes\xED", c: "#ff5070", d: "+30% cadencia y velocidad", dur: 10 },
    unstoppable: { n: "Imparable", c: "#ffffff", d: "+60% da\xF1o, inmune a ralentizaci\xF3n", dur: 12 },
  },
  wo = ["fury", "hyper", "plasma", "haste", "magnet", "wisdom", "ghost", "boom", "multi", "vamp", "frost", "fortune"],
  ur = [1, 2, 3, 3, 4, 4],
  Zs = (n) => (n.r >= 5 && n.type === "weapon" ? 2 : n.r >= 4 ? 1 : 0),
  Tw = new Set(["multishot", "pierce", "ricochet", "execute"]);


// ════════ [349] FunctionDeclaration pf (198 bytes) ════════
function pf(n, e, t = 1, i = new Set()) {
  let s = uf(n === "w" ? Tg : Ag, i, e, 0);
  return (
    Tw.has(s.s)
      ? s.s !== "execute" && s.s !== "multishot" && t >= 4 && (s.v += 1)
      : (s.v = +(s.v * (1 + (t - 1) * 0.22)).toFixed(4)),
    { id: mi(), kind: n, s: s.s, v: s.v, t }
  );
}


// ════════ [350] FunctionDeclaration mf (144 bytes) ════════
function mf(n) {
  let e = Object.keys(Gn).filter((t) => Gn[t].t === (n === "w" ? "weapon" : "gear"));
  return { id: mi(), kind: n, pow: e[Math.floor(Lt() * e.length)], t: 5 };
}


// ════════ [351] FunctionDeclaration gf (44 bytes) ════════
function gf(n = 0, e = 1) {
  return qe(yo(n, e), 1, 5);
}


// ════════ [352] VariableDeclaration Al (4526 bytes) ════════
var Al = [
  { id: "dmg", n: "Munici\xF3n de punta hueca", d: "+8% de da\xF1o", st: { dmg: 0.08 }, max: 15, r: 0, ic: "\u2738" },
  {
    id: "rate",
    n: "Gatillo ligero",
    d: "+7% de cadencia de disparo",
    st: { fireRate: 0.07 },
    max: 12,
    r: 0,
    ic: "\u226B",
  },
  {
    id: "hp",
    n: "Constituci\xF3n de hierro",
    d: "+10% de vida m\xE1xima",
    st: { maxHpPct: 0.1 },
    max: 12,
    r: 0,
    ic: "\u271A",
  },
  {
    id: "spd",
    n: "Piernas de corredor",
    d: "+5% de velocidad de movimiento",
    st: { moveSpeed: 0.05 },
    max: 6,
    r: 0,
    ic: "\u27A4",
  },
  {
    id: "crit",
    n: "Ojo de halc\xF3n",
    d: "+3% de probabilidad de cr\xEDtico",
    st: { critChance: 0.03 },
    max: 10,
    r: 0,
    ic: "\u25CE",
  },
  {
    id: "critd",
    n: "Puntos vitales",
    d: "+18% de da\xF1o cr\xEDtico",
    st: { critDmg: 0.18 },
    max: 10,
    r: 0,
    ic: "\u2726",
  },
  {
    id: "regen",
    n: "Nanobots m\xE9dicos",
    d: "+0,25% de vida por segundo",
    st: { regenPct: 0.0025 },
    max: 8,
    r: 0,
    ic: "\u2665",
  },
  {
    id: "pick",
    n: "Bolsillos magn\xE9ticos",
    d: "+25% de radio de recogida",
    st: { pickup: 0.25 },
    max: 6,
    r: 0,
    ic: "\u229B",
  },
  {
    id: "arm",
    n: "Placas cer\xE1micas",
    d: "+3% de reducci\xF3n de da\xF1o",
    st: { dmgRed: 0.03 },
    max: 8,
    r: 0,
    ic: "\u26E8",
  },
  {
    id: "rel",
    n: "Recarga t\xE1ctica",
    d: "+12% de velocidad de recarga",
    st: { reload: 0.12 },
    max: 6,
    r: 0,
    ic: "\u21BB",
  },
  {
    id: "mag",
    n: "Cargadores ampliados",
    d: "+18% de capacidad de cargador",
    st: { magSize: 0.18 },
    max: 6,
    r: 0,
    ic: "\u25A4",
  },
  { id: "rng", n: "Ca\xF1\xF3n estriado", d: "+8% de alcance", st: { range: 0.08 }, max: 5, r: 0, ic: "\u27F6" },
  { id: "xp", n: "Veteran\xEDa", d: "+10% de experiencia", st: { xpGain: 0.1 }, max: 6, r: 0, ic: "\u2605" },
  { id: "luck", n: "Saqueador", d: "+10% de suerte en el bot\xEDn", st: { luck: 0.1 }, max: 8, r: 0, ic: "\u2663" },
  { id: "dodge", n: "Reflejos felinos", d: "+3% de esquiva", st: { dodge: 0.03 }, max: 6, r: 0, ic: "\u2933" },
  {
    id: "shield",
    n: "Escudo personal",
    d: "Escudo de energ\xEDa del +8% de tu vida",
    st: { shieldPct: 0.08 },
    max: 8,
    r: 0,
    ic: "\u2B21",
  },
  { id: "cred", n: "Negociante", d: "+12% de cr\xE9ditos", st: { credits: 0.12 }, max: 5, r: 0, ic: "\xA4" },
  {
    id: "multi",
    n: "Doble ca\xF1\xF3n",
    d: "+1 proyectil por disparo",
    st: { multishot: 1 },
    max: 3,
    r: 1,
    ic: "\u22D4",
  },
  { id: "pierce", n: "Munici\xF3n perforante", d: "+1 perforaci\xF3n", st: { pierce: 1 }, max: 3, r: 1, ic: "\u21F6" },
  { id: "rico", n: "Rebote", d: "+1 rebote entre enemigos", st: { ricochet: 1 }, max: 3, r: 1, ic: "\u2928" },
  { id: "leech", n: "Sanguijuela", d: "+1,5% de robo de vida", st: { lifesteal: 0.015 }, max: 5, r: 1, ic: "\u2764" },
  {
    id: "boom",
    n: "Balas explosivas",
    d: "+6% de probabilidad de explosi\xF3n",
    st: { explodeChance: 0.06 },
    max: 5,
    r: 1,
    ic: "\u273A",
  },
  {
    id: "burn",
    n: "Munici\xF3n incendiaria",
    d: "+10% de probabilidad de quemar",
    st: { burnChance: 0.1 },
    max: 5,
    r: 1,
    ic: "\u{1F525}",
  },
  {
    id: "frz",
    n: "Munici\xF3n criog\xE9nica",
    d: "+8% de probabilidad de congelar",
    st: { freezeChance: 0.08 },
    max: 5,
    r: 1,
    ic: "\u2744",
  },
  {
    id: "shk",
    n: "Munici\xF3n de pulso",
    d: "+10% de probabilidad de electrocutar",
    st: { shockChance: 0.1 },
    max: 5,
    r: 1,
    ic: "\u03DF",
  },
  {
    id: "psn",
    n: "Puntas envenenadas",
    d: "+12% de probabilidad de envenenar",
    st: { poisonChance: 0.12 },
    max: 5,
    r: 1,
    ic: "\u2623",
  },
  { id: "elem", n: "Catalizador", d: "+18% de da\xF1o elemental", st: { elemDmg: 0.18 }, max: 5, r: 1, ic: "\u2697" },
  {
    id: "gren",
    n: "Demoledor",
    d: "+30% de da\xF1o de granadas y +1 granada",
    st: { grenadeDmg: 0.3, grenadeMax: 1 },
    max: 4,
    r: 1,
    ic: "\u25CF",
  },
  {
    id: "thorn",
    n: "Espinas",
    d: "Devuelves el 40% del da\xF1o cuerpo a cuerpo",
    st: { thorns: 0.4 },
    max: 4,
    r: 1,
    ic: "\u2734",
  },
  {
    id: "elite",
    n: "Cazador de \xE9lites",
    d: "+15% de da\xF1o contra \xE9lites y jefes",
    st: { vsElite: 0.15, vsBoss: 0.15 },
    max: 5,
    r: 1,
    ic: "\u265B",
  },
  { id: "dash", n: "Espr\xEDnter", d: "-12% de recarga de esprint", st: { dashCd: 0.12 }, max: 4, r: 1, ic: "\u21DB" },
  { id: "aoe", n: "Carga ampliada", d: "+18% de \xE1rea de efecto", st: { aoe: 0.18 }, max: 4, r: 1, ic: "\u25CC" },
  {
    id: "exec",
    n: "Verdugo",
    d: "Ejecuta a los enemigos normales con menos del 10% de vida",
    st: { execute: 1 },
    max: 1,
    r: 1,
    ic: "\u2620",
  },
  {
    id: "p_orb",
    n: "Orbitales",
    d: "Tres orbes de energ\xEDa giran a tu alrededor da\xF1ando a los enemigos.",
    pow: "orbitals",
    max: 1,
    r: 2,
    ic: "\u2609",
  },
  {
    id: "p_nova",
    n: "Onda de choque",
    d: "El esprint libera una onda que da\xF1a y empuja.",
    pow: "dashNova",
    max: 1,
    r: 2,
    ic: "\u25CE",
  },
  {
    id: "p_bers",
    n: "Berserker",
    d: "Cada baja +2% de cadencia (m\xE1x. +40%).",
    pow: "berserker",
    max: 1,
    r: 2,
    ic: "\u2694",
  },
  {
    id: "p_adr",
    n: "Adrenalina",
    d: "Con menos del 35% de vida: +50% da\xF1o y +30% velocidad.",
    pow: "adrenaline",
    max: 1,
    r: 2,
    ic: "\u26A1",
  },
  {
    id: "p_phx",
    n: "F\xE9nix",
    d: "Al caer, revives con el 50% de vida (cada 3 minutos).",
    pow: "phoenix",
    max: 1,
    r: 2,
    ic: "\u2668",
  },
  {
    id: "p_drone",
    n: "Dron escolta",
    d: "Un dron te acompa\xF1a y dispara con el 35% de tu da\xF1o.",
    pow: "drone",
    max: 1,
    r: 2,
    ic: "\u2708",
  },
  {
    id: "p_aura",
    n: "Aura \xEDgnea",
    d: "Quemas continuamente a los enemigos cercanos.",
    pow: "burnAura",
    max: 1,
    r: 2,
    ic: "\u2600",
  },
  {
    id: "p_mag",
    n: "Se\xF1or del magnetismo",
    d: "Recogida \xD72 y los orbes de experiencia curan.",
    pow: "magnetLord",
    max: 1,
    r: 2,
    ic: "\u2295",
  },
];


// ════════ [353] VariableDeclaration Rl (2072 bytes) ════════
var Rl = [
  {
    id: "vit",
    n: "Vitalidad reforzada",
    d: "+6% vida m\xE1xima",
    st: { maxHpPct: 0.06 },
    max: 10,
    cost: { bio: 6, credits: 80 },
  },
  {
    id: "pow",
    n: "Potencia muscular",
    d: "+5% da\xF1o",
    st: { dmg: 0.05 },
    max: 10,
    cost: { bio: 6, scrap: 6, credits: 90 },
  },
  {
    id: "ref",
    n: "Reflejos sint\xE9ticos",
    d: "+4% cadencia",
    st: { fireRate: 0.04 },
    max: 10,
    cost: { bio: 5, crystal: 1, credits: 100 },
  },
  {
    id: "cel",
    n: "Regeneraci\xF3n celular",
    d: "+0,3% de vida por segundo",
    st: { regenPct: 0.003 },
    max: 5,
    cost: { bio: 10, crystal: 1, credits: 120 },
  },
  {
    id: "arm",
    n: "Placas subd\xE9rmicas",
    d: "+3% reducci\xF3n de da\xF1o",
    st: { dmgRed: 0.03 },
    max: 5,
    cost: { scrap: 12, core: 1, credits: 150 },
  },
  {
    id: "crit",
    n: "Bal\xEDstica avanzada",
    d: "+2% cr\xEDtico y +8% da\xF1o cr\xEDtico",
    st: { critChance: 0.02, critDmg: 0.08 },
    max: 8,
    cost: { scrap: 8, data: 1, credits: 120 },
  },
  {
    id: "spd",
    n: "Fibras r\xE1pidas",
    d: "+3% velocidad de movimiento",
    st: { moveSpeed: 0.03 },
    max: 5,
    cost: { bio: 8, credits: 90 },
  },
  {
    id: "thm",
    n: "Adaptaci\xF3n t\xE9rmica",
    d: "+4% resistencia al calor y al fr\xEDo",
    st: { resHeat: 0.04, resCold: 0.04 },
    max: 5,
    cost: { bio: 8, crystal: 2, credits: 150 },
  },
  {
    id: "imm",
    n: "Inmunolog\xEDa xeno",
    d: "+4% resistencia t\xF3xica y a radiaci\xF3n",
    st: { resToxic: 0.04, resRad: 0.04 },
    max: 5,
    cost: { bio: 10, crystal: 2, credits: 150 },
  },
  {
    id: "luck",
    n: "An\xE1lisis de bot\xEDn",
    d: "+6% suerte",
    st: { luck: 0.06 },
    max: 8,
    cost: { data: 1, crystal: 1, credits: 120 },
  },
  {
    id: "xp",
    n: "Aprendizaje acelerado",
    d: "+5% experiencia",
    st: { xpGain: 0.05 },
    max: 8,
    cost: { data: 1, bio: 4, credits: 100 },
  },
  {
    id: "mag",
    n: "Campo magn\xE9tico",
    d: "+12% radio de recogida y +5% cr\xE9ditos",
    st: { pickup: 0.12, credits: 0.05 },
    max: 5,
    cost: { scrap: 10, core: 1, credits: 90 },
  },
  {
    id: "gren",
    n: "Munici\xF3n pesada",
    d: "+1 granada m\xE1xima y +12% da\xF1o de granadas",
    st: { grenadeMax: 1, grenadeDmg: 0.12 },
    max: 5,
    cost: { scrap: 10, credits: 110 },
  },
  {
    id: "med",
    n: "Medicina de campa\xF1a",
    d: "+1 botiqu\xEDn m\xE1ximo y +10% curaci\xF3n",
    st: { medkitMax: 1, healBonus: 0.1 },
    max: 5,
    cost: { bio: 10, credits: 110 },
  },
  {
    id: "dash",
    n: "Servomotores",
    d: "-7% recarga de esprint",
    st: { dashCd: 0.07 },
    max: 5,
    cost: { scrap: 8, core: 1, credits: 100 },
  },
  {
    id: "lamp",
    n: "\xD3ptica de linterna",
    d: "+12% alcance de linterna",
    st: { lightRange: 0.12 },
    max: 5,
    cost: { scrap: 6, battery: 2, credits: 80 },
  },
];


// ════════ [354] FunctionDeclaration bf (123 bytes) ════════
function bf(n, e) {
  let t = Math.pow(1.6, e),
    i = {};
  for (let s in n.cost) i[s] = Math.ceil(n.cost[s] * t * (s === "credits" ? 1.2 : 1));
  return i;
}


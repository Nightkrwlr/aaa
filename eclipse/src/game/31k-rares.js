// 31k-rares.js — Raros del mundo (D13): colocación, aparición, mecánicas exclusivas
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// Criaturas ÚNICAS y excepcionales que merodean el mundo abierto, de una en una, con un nombre propio y una mecánica que no tiene ningún
// otro enemigo. No son una manada con más vida: cada una pide algo distinto al jugador (romper una línea de visión, destruir pilones,
// esquivar una embestida para que se estrelle contra un muro, encontrar a la real entre sus espejismos…).
//
//   · Cada región tiene 2 casillas de raro. Al repartirlas (primera vez que se pisa el mundo, con la semilla de la partida) el 75 % ya está
//     ocupado; el resto aparece pasados unos minutos. Una criatura solo existe como cuerpo mientras el jugador está cerca (se monta a 66 m y
//     se desmonta a 90 m: si huyes se reinicia).
//   · Al caer, la casilla entra en un enfriamiento LARGO (25-40 min de juego) y al terminar reaparece en OTRO sitio de su región y con otra
//     criatura al azar. A veces (24 %) la que aparece es una ÚNICA con historia: nace una sola vez por partida, siempre suelta un OBJETO
//     ESPECIAL que inicia una misión propia y, una vez abatida, no vuelve.
//   · Botín mejor, no excesivo (31k2-rares-loot.js): una pieza de equipo ≥ Raro garantizada, un trofeo vendible de gran valor, materiales
//     y las tiradas de la tabla «raro» (entre el campeón y el jefe). Los objetos especiales también salen, con poca probabilidad, de los
//     raros corrientes.
//
// Contrato con el resto del juego (todo son envoltorios; no cambia la generación del mundo ni consume su RNG):
//   · Guardado: S.rare = { v:1, seed, init, slots:{id:{…}}, n, uniq:{id:1}, items:[…], stats:{…} } (migración idempotente en x.migrations).
//   · Enemigos: son enemigos de verdad (In/vp) con `e.rq = {slot, arch, uniq, …}`, el modificador «raro» (anillo dorado, no enumerable en Bd
//     para que aa() no lo reparta entre las élites normales) y `champion:true` (vida ×6 de campeón × x.cfg.rare.hpMul).
//   · Mecánicas: se ejecutan desde un envoltorio de gadgetEnemyTick (que el motor consulta antes de la IA); devolver true congela la IA.
//   · Eventos nuevos: ee('rare', 'seen'|'slain'|'item', datos). Datos: x.cfg.rare. Pruebas: window.__rare.

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 0 · Datos
// ═══════════════════════════════════════════════════════════════════════════════════════════
Object.defineProperty(Bd, "raro", { value: { n: "Raro", c: 0xffd34d }, enumerable: false });

x.cfg.rare = {
  v: 1,
  enabled: true,
  perRegion: 2, // casillas de raro por región
  occupied: 0.75, // fracción de casillas ocupadas al empezar
  waitS: [240, 900], // espera (s de juego) de las casillas que empiezan vacías
  loadR: 66, // se monta a menos de esto…
  unloadR: 90, // …y se desmonta a más
  seeR: 30, // distancia a la que se «descubre» (aviso y marca permanente en el minimapa)
  pingR: 85, // distancia a la que aparece en el minimapa aunque no se haya visto
  minFromBase: 56, // distancia mínima al Bastión
  minApart: 60, // distancia mínima entre dos casillas
  nearBase: [62, 104], // la primera de la región 0 se encuentra pronto
  hideR: 58, // al reaparecer, lejos del jugador (no se ve cómo se coloca)
  roomR: 4, // radio libre exigido alrededor (hace falta sitio para embestir, esquivar y maniobrar)
  roomMin: 0.72, // fracción mínima de casillas libres dentro de ese radio
  respawnS: [1500, 2400], // enfriamiento tras caer: 25-40 min de juego
  uniqueP: 0.24, // probabilidad de que la criatura que reaparece sea una única de la región (si queda alguna)
  lvlPlus: 1,
  // La vida y el daño NO dependen de la criatura que lo encarna (un Yeti, un Gólem o una Abominación tienen 10× la vida de una larva): se normalizan a la
  // MEDIANA de los enemigos de línea de su región, como si fuera un campeón corriente de esa región, y encima:
  hpMul: 1.5, // × la vida de campeón (×6): tarda ≈ 1,5× lo que un campeón corriente de su región
  dmgMul: 1.12,
  normHp: [0.1, 4], // cuánto puede corregirse la vida / el daño de la criatura base para llegar a la mediana (mín, máx)
  normDmg: [0.4, 2.5],
  scaleMul: 1.2,
  rage: { at: 0.3, cdMul: 0.72, spdMul: 1.12, dmgMul: 1.08 }, // «se enfurece» al bajar de este % de vida: mecánicas más seguidas y más rápido
  glintS: [1.2, 2.4], // destello dorado cuando está tranquilo (se ve desde lejos)
  teleCol: 0xff4a30, // color de TODOS los avisos de daño (rojo, como los de los jefes): con colores claros el relleno aditivo se quema con el bloom
  flowCol: { pylon: 0x58b8ff, link: 0xff3050, hook: 0xc04060 }, // charcos de luz que fluyen entre dos puntos (enlaces); los haces del motor (fx.beam) llevan un núcleo casi blanco y, repetidos cada fotograma, el bloom deja una neblina enorme
  // — arquetipos: parámetros de cada mecánica (números de equilibrio aquí; ver las funciones RQM más abajo) —
  mudadora: { at: [0.7, 0.4, 0.15], r: 4.4, warn: 1.0, holdS: 2.2, dmg: 1.1, kids: 2, spdUp: 1.1, dmgUp: 1.06, heal: 0.04, kid: { insect: "rastrero", mutant: "infectado", xeno: "larva", mech: "aranamec" } },
  estampida: { firstS: 1.5, gapS: [5.5, 7.5], minD: 2.5, maxD: 18, windS: 1.0, lockS: 0.3, len: 15, width: 2.2, dashMul: 4.6, maxDashS: 1.5, dmg: 1.3, push: 15, stunS: 3.2, vuln: 1.35 },
  pararrayos: { pylons: [2, 3], ring: [5, 8], armor: 0.28, firstS: 4, gapS: [5.5, 7.5], r: 2.4, warn: 1.0, dmg: 1.0, exposedS: 4, vuln: 1.3 },
  coraza: { closedS: 5, openS: 3.2, armor: 0.2, novaR: 5.2, warn: 1.1, dmg: 1.1, vuln: 1.5, regen: 0.012 },
  pozo: { firstS: 3, gapS: [9, 12], maxD: 22, r: 7.5, warn: 1.4, pullS: 1.8, pull: 4.6, boomR: 2.8, dmg: 1.3 },
  chupasangre: { firstS: 1.5, gapS: [7, 9], minD: 0, maxD: 11, windS: 0.8, holdS: 6, breakD: 13, loseS: 0.35, tickS: 0.5, dmg: 0.3, heal: 0.9, recoilS: 1.4 },
  acechador: { decoys: 2, ringMin: 4, ringMax: 8, gapS: 9, hpMul: 0.04 },
  aura: { firstS: 4, gapS: [8, 11], pools: 3, offset: 2.8, r: 2.0, warn: 1.0, holdS: 5, dps: 0.45, maxD: 20 },
};
const RQC = x.cfg.rare;

// Cada arquetipo: nombre, regiones en las que sale (con la criatura que lo encarna en cada una), pista de una línea y nombres propios.
const RQA = {
  mudadora: {
    n: "Mudadora", ic: "◐", w: 3, hint: "Muda al perder vida: queda invulnerable un momento y suelta crías",
    bases: { 0: "acorazado", 1: "rabioso", 3: "abominacion", 7: "abominacion", 8: "matriarca" },
    names: ["La Descamada", "Madre de Crisálidas", "Piel Vieja", "Reina de Mudas", "Carcasa Viva", "La Hilandera Hueca"],
    trophy: "Muda de crisálida",
  },
  estampida: {
    n: "Embestidora", ic: "▶", w: 3, hint: "Embiste en línea recta: haz que se estrelle contra un muro y quedará aturdida",
    bases: { 0: "mantis", 1: "bruto", 2: "acorazado", 4: "yeti", 5: "escudero", 6: "golem", 7: "bruto", 8: "guardian" },
    names: ["Cuerno Roto", "El Derribamuros", "Pezuña de Hierro", "Gran Embestidor", "Terremoto", "Mole Ciega"],
    trophy: "Colmillo de embestida",
  },
  pararrayos: {
    n: "Pararrayos", ic: "ϟ", w: 2, hint: "La protegen pilones tesla: destrúyelos primero para dejarla expuesta",
    bases: { 5: "mech", 6: "escudero", 7: "mortero" },
    names: ["El Conductor", "Bobina Madre", "Tormenta Cautiva", "Faro Eléctrico", "Centella Mayor", "Pararrayos"],
    trophy: "Bobina de pararrayos",
  },
  coraza: {
    n: "Acorazada", ic: "▣", w: 2, hint: "Casi invulnerable con la coraza cerrada: tras su descarga se abre unos segundos",
    bases: { 5: "tanquemec", 6: "escudero" },
    names: ["Casco Duro", "Bastión Errante", "El Acorazado", "Placa Madre", "Muro Andante", "Coraza Viuda"],
    trophy: "Placa de coraza",
  },
  pozo: {
    n: "Atractor", ic: "◉", w: 2, hint: "Crea un pozo gravitatorio que te arrastra: sal del radio o te aplastará",
    bases: { 3: "matriarca", 4: "espectro", 6: "espectro", 8: "psionico" },
    names: ["Ojo del Abismo", "El Tragaluz", "Pozo Errante", "Lente Negra", "Atractor", "Eclipse Menor"],
    trophy: "Lente gravitatoria",
  },
  chupasangre: {
    n: "Chupasangre", ic: "♥", w: 2, hint: "Se engancha a ti y te drena: rompe la línea de visión para soltarte",
    bases: { 1: "vomitador", 2: "escorpion", 3: "sanguijuela", 7: "necrofago", 8: "parasito" },
    names: ["Sanguijuela Reina", "El Sediento", "Garganta Roja", "Madre Sanguínea", "Vena Abierta", "Beso Frío"],
    trophy: "Aguijón de chupasangre",
  },
  acechador: {
    n: "Espejismo", ic: "◇", w: 2, hint: "Se rodea de copias sin daño: la real lleva un anillo dorado",
    bases: { 2: "acechador", 4: "acechador", 8: "acechador" },
    names: ["Espejismo", "El Doble", "Sombra Plateada", "Mil Caras", "Reflejo Hambriento", "La Voz sin Cuerpo"],
    trophy: "Manto de espejismo",
  },
  aura: {
    n: "Aura", ic: "☼", w: 2, hint: "Planta charcos de fuego (o hielo) bajo tus pies: no te quedes quieto",
    bases: { 2: "salamandra", 4: "elhielo", 6: "golem" },
    mods: { 2: ["igneo"], 4: ["gelido"], 6: ["igneo"] },
    names: ["Ascua Viva", "Rey de Brasas", "Horno Andante", "Cenicienta", "Llama Ciega", "Pavesa Mayor"],
    namesIce: ["Ventisca Viva", "Reina de Escarcha", "Aliento Blanco", "Glaciar Errante", "Cristal Hambriento", "Nevisca Mayor"],
    trophy: "Brasa viva",
    trophyIce: "Esquirla de ventisca",
  },
};

// Únicas con historia: nacen una sola vez por partida (la región las ofrece al reaparecer una casilla), siempre sueltan su objeto especial y no vuelven.
// quest.kind: «deliver» (llevar el objeto a un personaje) · «rastro» (ir a un lugar marcado y luego hablar con alguien) · «hallazgo» (ir a un lugar marcado: allí hay un alijo)
const RQU = [
  {
    id: "u_hueco", reg: 0, name: "Sargento Hueco", arch: "mudadora", base: "infectado",
    item: { n: "Placa de identificación calcinada", d: "Una placa militar medio fundida. Aún se lee: «HERVÁS · 2.º Pelotón · Bastión»." },
    quest: { kind: "deliver", npc: "reyes", title: "Nombre y apellido", r: 2,
      intro: "El Sargento Hueco llevaba una placa de nuestro pelotón. Hervás era de los nuestros. Llévasela al Comandante Reyes: merece saber qué fue de él.",
      done: "Reyes guarda la placa en silencio. «Hervás cubrió mi retirada el primer día. Gracias por traerlo de vuelta, aunque sea así.»" },
  },
  {
    id: "u_locutora", reg: 1, name: "La Locutora", arch: "chupasangre", base: "vomitador",
    item: { n: "Cinta de emisión interrumpida", d: "Una cinta magnética. Una voz repite una y otra vez: «Aquí Radio Libre… ¿hay alguien ahí?»." },
    quest: { kind: "deliver", npc: "lucia", title: "La otra voz", r: 2,
      intro: "La Locutora conservaba una cinta de Radio Libre. Esa voz no es de Lucía. Llévasela: quizá sepa de quién es.",
      done: "Lucía escucha la cinta con los ojos cerrados. «Es Marta, la locutora de antes de que yo llegara. Pensé que se había ido… Esta noche la emitiré entera.»" },
  },
  {
    id: "u_espejismo", reg: 2, name: "Espejismo Dorado", arch: "acechador", base: "acechador",
    item: { n: "Brújula de la caravana perdida", d: "Una brújula de latón. La aguja no apunta al norte: tiembla hacia un lugar concreto del desierto." },
    quest: { kind: "hallazgo", title: "El alijo de la caravana", r: 2, reachR: 4.5, xpf: 1.5,
      intro: "La aguja de la brújula tiembla hacia un punto del desierto. La caravana que se perdió escondió algo allí. Sigue el rumbo (está marcado en el mapa).",
      done: "Entre dos rocas, un cajón de metal enterrado en la arena. Dentro, lo que la caravana no pudo llevarse." },
  },
  {
    id: "u_hongo", reg: 3, name: "El Hongo Viejo", arch: "mudadora", base: "abominacion",
    item: { n: "Frasco de esporas ámbar", d: "Un frasco sellado con cera. Las esporas brillan con un ámbar tenue, como si respiraran." },
    quest: { kind: "deliver", npc: "ignacio", title: "Cura de la marisma", r: 3,
      intro: "El Hongo Viejo llevaba un frasco de esporas ámbar, intacto. El ermitaño de la marisma sabrá qué hacer con él.",
      done: "Ignacio huele el frasco y sonríe por primera vez. «Llevo veinte años buscando esto. Con ello puedo hacer algo que cure, no que mate. Toma, te lo has ganado.»" },
  },
  {
    id: "u_colmillo", reg: 4, name: "Colmillo Blanco", arch: "estampida", base: "yeti",
    item: { n: "Trampa dentada, vieja", d: "Una trampa de oso oxidada con unas iniciales grabadas: «N. V.». Lleva años clavada en la pata de algo enorme." },
    quest: { kind: "deliver", npc: "nadia", title: "Una trampa vieja", r: 3,
      intro: "Colmillo Blanco arrastraba una trampa con unas iniciales grabadas. Nadia, la trampera, sabrá de quién era.",
      done: "Nadia sostiene la trampa con las dos manos. «Era de mi padre. Llevo años buscando a ese yeti… y resulta que lo único que quería era librarse de ella. Gracias.»" },
  },
  {
    id: "u_prom", reg: 5, name: "Unidad PROM-7", arch: "coraza", base: "tanquemec",
    item: { n: "Núcleo de memoria PROM-7", d: "Un módulo de memoria militar chamuscado. Todavía conserva un último registro sin descifrar." },
    quest: { kind: "deliver", npc: "argos", title: "Memoria de máquina", r: 3,
      intro: "PROM-7 llevaba un núcleo de memoria con un registro sin descifrar. ARGOS puede leerlo mejor que nadie.",
      done: "ARGOS: «Registro recuperado. PROM-7 era una unidad de contención de Prometeo. Su último informe dice: ‘no abatir a nadie que corra hacia el norte’. Lo he archivado. Gracias, operador.»" },
  },
  {
    id: "u_rey", reg: 6, name: "Rey de Ceniza", arch: "aura", base: "golem",
    item: { n: "Veta de obsidiana tallada", d: "Una losa de obsidiana con unas marcas talladas: parece un plano de la caldera, con una equis." },
    quest: { kind: "hallazgo", title: "El plano de la obsidiana", r: 3, reachR: 4.5, xpf: 1.5,
      intro: "La obsidiana del Rey de Ceniza es un plano con una equis marcada. Allí, en la caldera, alguien enterró algo (está marcado en el mapa).",
      done: "Bajo una losa de obsidiana, un hueco con el contenido intacto. Quien lo escondió sabía que la ceniza lo conservaría." },
  },
  {
    id: "u_eco", reg: 7, name: "Eco Mudo", arch: "pararrayos", base: "mortero",
    item: { n: "Dosímetro con un nombre grabado", d: "Un dosímetro de explorador con un nombre grabado en la tapa: «V. ROSALES». Lleva una nota doblada dentro." },
    quest: { kind: "rastro", npc: "viktor", title: "Rastro del explorador", r: 3, reachR: 4.5, xpf: 1.6,
      intro: "El dosímetro es de un explorador, V. Rosales. La nota da unas coordenadas (marcadas en el mapa). Ve allí y luego cuéntaselo a Viktor, que conoce el yermo.",
      done: "Viktor lee la nota dos veces. «Rosales era mi compañero de ruta. Si hubo un alijo, el yermo ya se lo ha llevado, pero tú has cerrado una historia. Toma esto.»" },
  },
  {
    id: "u_cantora", reg: 8, name: "La Cantora", arch: "pozo", base: "psionico",
    item: { n: "Fragmento de partitura viva", d: "Un cristal con vetas que vibran al tacto, como notas de una melodía que no termina." },
    quest: { kind: "deliver", npc: "eco", title: "Coro roto", r: 3,
      intro: "La Cantora cantaba una melodía imposible, y de su cuerpo salió un cristal que vibra. La científica de la Colmena querrá estudiarlo.",
      done: "Eco acerca el cristal al oído. «Es una frase del canto de la Mente… pero incompleta. Si la completan, quizá puedan callarla. Gracias.»" },
  },
];

// Objetos especiales genéricos (los dejan los raros corrientes con poca probabilidad): por familia del enemigo. Cada uno inicia un «Encargo especial»
const RQI = {
  insect: [["Huevo ambarino", "Un huevo translúcido con algo vivo dentro. Late despacio."], ["Mandíbula de reina menor", "Una mandíbula enorme, con marcas de uso. No es de un enemigo corriente."]],
  mutant: [["Insignia ensangrentada", "Una insignia con un nombre ilegible. Alguien la llevó hasta el final."], ["Collar con un nombre grabado", "Un collar de chapa. Todavía se lee un nombre de pila."]],
  mech: [["Placa de serie borrada", "La placa de serie de una máquina, rascada a propósito. Alguien no quería que se supiera de dónde vino."], ["Módulo de memoria quemado", "Un módulo de memoria chamuscado. Quizá aún quede algo recuperable."]],
  xeno: [["Cristal que susurra", "Un cristal que murmura cuando lo acercas al oído. No se entiende nada, pero insiste."], ["Esquirla de sueño", "Una esquirla opaca. Al mirarla se te olvida lo que estabas pensando."]],
};
const RQN = { 0: ["tomas", "kai"], 1: ["lucia", "bruno"], 2: ["zahra"], 3: ["ignacio"], 4: ["nadia"], 5: ["argos"], 6: ["rocco"], 7: ["viktor"], 8: ["eco"] };
const RQN_DONE = {
  insect: "examina el hallazgo con cuidado. «Esto no sale de un bicho cualquiera. Buen trabajo; con esto puedo hacer algo útil.»",
  mutant: "guarda el objeto en silencio. «Alguien lo estaba esperando, aunque no lo sepa. Gracias por no dejarlo tirado.»",
  mech: "da vueltas al objeto entre los dedos. «Máquinas con secretos… Me lo quedo yo. Tu esfuerzo no queda sin pagar.»",
  xeno: "aparta el objeto un instante. «Mejor que no esté cerca de ti. Gracias; me ocupo yo.»",
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 1 · Estado guardado
// ═══════════════════════════════════════════════════════════════════════════════════════════
// S.rare = { v, seed, init, slots:{id:{id,reg,x,z,st,cd,arch,base,uniq,name,ice,seen,n}}, n, uniq:{id:1}, items:[{id,n,d,from,reg,fam,uniq,q,t}], stats:{…} }
//   st: ready (existe y se monta al acercarse) | wait (enfriamiento hasta cd, en s de juego S.playTime)
function rqFresh() {
  return { v: 1, seed: ((Math.random() * 4294967295) >>> 0) || 1, init: false, slots: {}, n: 0, uniq: {}, items: [], seq: 0, tip: 0, stats: { kills: 0, uniq: 0, items: 0, byArch: {} } };
}
function rqMigrate(S) {
  if (!S) return;
  const f = rqFresh(),
    R = S.rare && typeof S.rare === "object" && !Array.isArray(S.rare) ? S.rare : (S.rare = f);
  R.v = 1;
  R.seed = Number.isFinite(R.seed) && R.seed > 0 ? R.seed >>> 0 : f.seed;
  R.init = !!R.init;
  R.n = Number.isFinite(R.n) ? R.n | 0 : 0;
  R.seq = Number.isFinite(R.seq) ? R.seq | 0 : 0;
  R.tip = R.tip ? 1 : 0;
  if (!R.slots || typeof R.slots !== "object" || Array.isArray(R.slots)) R.slots = {};
  if (!R.uniq || typeof R.uniq !== "object" || Array.isArray(R.uniq)) R.uniq = {};
  if (!Array.isArray(R.items)) R.items = [];
  if (!R.stats || typeof R.stats !== "object" || Array.isArray(R.stats)) R.stats = f.stats;
  for (const k of ["kills", "uniq", "items"]) R.stats[k] = Number.isFinite(R.stats[k]) ? Math.max(0, R.stats[k] | 0) : 0;
  if (!R.stats.byArch || typeof R.stats.byArch !== "object" || Array.isArray(R.stats.byArch)) R.stats.byArch = {};
  for (const id of Object.keys(R.uniq)) if (!RQU.some((u) => u.id === id)) delete R.uniq[id];
  for (const id of Object.keys(R.slots)) {
    const s = R.slots[id];
    if (!s || !RQA[s.arch] || !Number.isFinite(s.x) || !Number.isFinite(s.z) || !gn[s.base]) {
      delete R.slots[id];
      continue;
    }
    s.id = id;
    s.reg = Number.isFinite(s.reg) ? Math.max(0, Math.min(De.length - 1, s.reg | 0)) : 0;
    s.cd = Number.isFinite(s.cd) ? s.cd : 0;
    s.n = Number.isFinite(s.n) ? s.n | 0 : 0;
    s.seen = s.seen ? 1 : 0;
    s.ice = s.ice ? 1 : 0;
    s.uniq = s.uniq && RQU.some((u) => u.id === s.uniq) ? s.uniq : null;
    if (s.st !== "ready" && s.st !== "wait") s.st = "ready";
    s.name = String(s.name || RQA[s.arch].n);
  }
  // objetos especiales: sanea la lista (sin duplicados ni huecos)
  const seen = new Set();
  R.items = R.items.filter((it) => {
    if (!it || typeof it !== "object" || !it.id || seen.has(it.id)) return false;
    seen.add(it.id);
    it.n = String(it.n || "Objeto especial");
    it.d = String(it.d || "");
    it.from = String(it.from || "");
    it.q = it.q ? String(it.q) : null;
    it.reg = Number.isFinite(it.reg) ? it.reg | 0 : 0;
    it.fam = RQI[it.fam] ? it.fam : "mutant";
    return true;
  });
  return R;
}
x.migrations.push(rqMigrate);
function rqS() {
  const S = x.S;
  return S ? (S.rare && S.rare.v === 1 ? S.rare : rqMigrate(S)) : null;
}

// estado de ejecución (no se guarda)
const RQ = {
  live: new Map(), // id de casilla → enemigo montado
  map: null,
  t: 0, // reloj del barrido
  glint: 0,
  hud: null,
  bar: null,
  pools: [], // charcos propios (para ralentizar con hielo)
  bolts: [], // descargas pendientes
  log: [], // últimos eventos (para las pruebas)
  hudT: 0,
};
const rqMap = () => (typeof Po !== "undefined" && Po) || (x.map && x.map.kind !== "op" ? x.map : null);
const rqClock = () => (x.S ? x.S.playTime : 0);
const rqAlive = (e) => !!e && !e.dead && x.enemies.includes(e);
const rqFam = (id) => (gn[id] ? gn[id].fam : "mutant");

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2 · Colocación
// ═══════════════════════════════════════════════════════════════════════════════════════════
// sitio con espacio de sobra: suelo o camino y, alrededor, casi todo transitable (hace falta sitio para embestir, esquivar y maniobrar)
function rqRoomOk(map, X, Z) {
  if (!mxFree(map, X, Z)) return false;
  const R = RQC.roomR;
  let ok = 0,
    n = 0;
  for (let dz = -R; dz <= R; dz++)
    for (let dx = -R; dx <= R; dx++) {
      n++;
      const q = map.t(X + dx, Z + dz);
      if (!Ua[q] && q !== F.WALL && q !== F.DOOR && !map.blk[map.idx(X + dx, Z + dz)]) ok++;
    }
  return ok / n >= RQC.roomMin;
}
function rqSpot(reg, rng, opt = {}) {
  const map = rqMap();
  if (!map) return null;
  const R = De[reg] || De[0],
    x0 = R.gx * qt,
    z0 = R.gz * qt,
    m = 18,
    S = rqS(),
    base = map.pois && map.pois.base ? map.pois.base : { x: qt * 1.5, z: qt * 1.5 },
    others = Object.values(S.slots).filter((s) => !opt.except || s.id !== opt.except);
  for (let tries = 0; tries < 220; tries++) {
    const X = x0 + m + rng.int(0, qt - 2 * m - 1),
      Z = z0 + m + rng.int(0, qt - 2 * m - 1),
      cx = X + 0.5,
      cz = Z + 0.5;
    if (!rqRoomOk(map, X, Z)) continue;
    const db = Math.hypot(cx - base.x, cz - base.z);
    if (db < RQC.minFromBase) continue;
    if (opt.near && (db < opt.near[0] || db > opt.near[1])) continue;
    if (opt.farFrom && Math.hypot(cx - opt.farFrom.x, cz - opt.farFrom.z) < opt.farFrom.r) continue;
    if (x.world && x.world.safeAt(cx, cz)) continue;
    let ok = true;
    for (const o of others) if (o.reg === reg && Math.hypot(o.x - cx, o.z - cz) < RQC.minApart) ok = false;
    if (!ok) continue;
    for (const e of map.ents) {
      if (e.k === "light") continue;
      if (Math.abs(e.x - cx) < 4 && Math.abs(e.z - cz) < 4) {
        ok = false;
        break;
      }
    }
    if (ok) return { x: cx, z: cz };
  }
  return null;
}
// qué criatura va en una casilla: una única de la región (si toca y queda alguna sin nacer) o un arquetipo al azar con su criatura de la región
function rqUniqAvail(reg) {
  const S = rqS(),
    taken = new Set(Object.values(S.slots).map((s) => s.uniq));
  return RQU.filter((u) => u.reg === reg && !S.uniq[u.id] && !taken.has(u.id));
}
function rqRoll(reg, rng, opt = {}) {
  const S = rqS(),
    here = Object.values(S.slots).filter((s) => s.reg === reg && s.id !== opt.except);
  const uq = opt.first ? [] : rqUniqAvail(reg);
  if (uq.length && rng() < RQC.uniqueP) {
    const u = rng.pick(uq);
    return { arch: u.arch, base: u.base, uniq: u.id, name: u.name, ice: reg === 4 ? 1 : 0 };
  }
  const pool = Object.keys(RQA).filter((a) => RQA[a].bases[reg] && !(opt.first && (a === "pararrayos" || a === "coraza")));
  // evita repetir el arquetipo que ya hay en la otra casilla de la región
  const alt = pool.filter((a) => !here.some((s) => s.arch === a));
  const list = alt.length ? alt : pool;
  let q = rng() * list.reduce((t, a) => t + RQA[a].w, 0),
    arch = list[0];
  for (const a of list) {
    q -= RQA[a].w;
    if (q <= 0) {
      arch = a;
      break;
    }
  }
  const A = RQA[arch],
    ice = arch === "aura" && reg === 4 ? 1 : 0,
    names = ice ? A.namesIce : A.names,
    used = new Set(Object.values(S.slots).map((s) => s.name)),
    free = names.filter((n) => !used.has(n));
  return { arch, base: A.bases[reg], uniq: null, name: rng.pick(free.length ? free : names), ice };
}
function rqNewSlot(reg, spot, def, st, cd) {
  const S = rqS(),
    id = "rq_" + ++S.n;
  return (S.slots[id] = { id, reg, x: spot.x, z: spot.z, st: st || "ready", cd: cd || 0, arch: def.arch, base: def.base, uniq: def.uniq || null, name: def.name, ice: def.ice ? 1 : 0, seen: 0, n: 0 });
}
function rqInitSlots() {
  const S = rqS();
  if (!S || S.init || !rqMap()) return false;
  const rng = pi((S.seed ^ 0x7271) >>> 0),
    t = rqClock();
  for (let reg = 0; reg < De.length; reg++)
    for (let i = 0; i < RQC.perRegion; i++) {
      const first = reg === 0 && i === 0,
        spot = rqSpot(reg, rng, first ? { near: RQC.nearBase } : {});
      if (!spot) continue;
      const def = rqRoll(reg, rng, { first }),
        occ = first || rng() < RQC.occupied;
      rqNewSlot(reg, spot, def, occ ? "ready" : "wait", occ ? 0 : t + RQC.waitS[0] + rng() * (RQC.waitS[1] - RQC.waitS[0]));
    }
  S.init = true;
  return true;
}
// el enfriamiento terminó: otra criatura, en otro sitio de la región, lejos del jugador
function rqReborn(s) {
  const S = rqS(),
    rng = pi((S.seed ^ (s.n * 7919 + s.id.length * 131 + 0x52)) >>> 0),
    p = x.player;
  let spot = null;
  for (let t = 0; t < 4 && !spot; t++) spot = rqSpot(s.reg, rng, { except: s.id, farFrom: p ? { x: p.x, z: p.z, r: RQC.hideR } : null });
  if (!spot) spot = rqSpot(s.reg, rng, { except: s.id });
  if (!spot) return false;
  const def = rqRoll(s.reg, rng, { except: s.id });
  Object.assign(s, { x: spot.x, z: spot.z, st: "ready", cd: 0, arch: def.arch, base: def.base, uniq: def.uniq, name: def.name, ice: def.ice, seen: 0 });
  s.n++;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 3 · Montaje del cuerpo
// ═══════════════════════════════════════════════════════════════════════════════════════════
function rqRegAt(px, pz) {
  const m = x.map;
  return m && m.regAt ? m.regAt(px, pz) : x.regionId;
}
// nivel de la criatura: el de la región en ese punto (más alto lejos de la baliza de entrada, como lvlAt) + lvlPlus, SIN el +1 al azar de lvlAt
// (un mismo raro tiene siempre el mismo nivel aunque se desmonte y se vuelva a montar)
function rqLvl(s) {
  const R = De[s.reg] || De[0],
    map = x.map,
    bc = map && map.ents ? map.ents.find((o) => o.k === "beacon" && o.reg === s.reg) : null,
    r = bc ? Le(bc.x, bc.z, s.x, s.z) : 30;
  return qe(Math.round(R.lvl[0] + (R.lvl[1] - R.lvl[0]) * qe(r / (qt * 0.45), 0, 1)) + RQC.lvlPlus, 1, 62);
}
// vida y daño «de línea» de una región: la mediana de los enemigos que pueden salir sueltos (sin nidos, torretas ni sombras ni los que no hacen daño)
const RQREF = new Map();
function rqRef(reg) {
  if (RQREF.has(reg)) return RQREF.get(reg);
  const med = (v) => {
      v = v.slice().sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : 1;
    },
    ds = (De[reg] || De[0]).enemies.map((q) => gn[q[0]]).filter((d) => d && d.ai !== "spawner" && d.ai !== "turret" && d.ai !== "shadow"),
    r = { hp: med(ds.map((d) => d.hp)), dmg: med(ds.filter((d) => d.dmg > 0).map((d) => d.dmg)) };
  RQREF.set(reg, r);
  return r;
}
function rqMount(s) {
  const map = x.map,
    d = gn[s.base];
  if (!map || !d || x.mode !== "world") return null;
  const lvl = rqLvl(s),
    [px, pz] = map.findFree(s.x, s.z, 3, 0.7),
    A = RQA[s.arch],
    mods = ["raro"].concat((A.mods && A.mods[s.reg]) || []),
    ref = rqRef(s.reg),
    hpK = qe(ref.hp / d.hp, RQC.normHp[0], RQC.normHp[1]),
    dmgK = qe(ref.dmg / (d.dmg || ref.dmg), RQC.normDmg[0], RQC.normDmg[1]),
    e = In(s.base, lvl, px, pz, { mods, persist: true, champion: true, hpMul: RQC.hpMul * hpK, name: s.name });
  e.dmg *= RQC.dmgMul * dmgK;
  e.scale *= RQC.scaleMul;
  e.rad *= RQC.scaleMul;
  e.mass = Math.max(e.mass, 6);
  e.rq = { slot: s.id, arch: s.arch, uniq: s.uniq, name: s.name, ice: s.ice, t: 0, status: "", act: null, stun: 0, vuln: 0, armor: 1, rage: false, cdMul: 1, kids: [], bornAt: x.time };
  e.home = { x: px, z: pz };
  RQ.live.set(s.id, e);
  return e;
}
// desmonta sin botín ni XP (la criatura se queda dormida donde estaba y se reinicia cuando vuelvas)
function rqDispose(e) {
  if (!e) return;
  const R = e.rq;
  if (R) for (const k of R.kids) if (k && !k.dead) rqVanish(k);
  rqVanish(e);
}
function rqVanish(e) {
  if (!e || e.dead) return;
  e.dead = true;
  e.deadT = 0;
  e.hp = 0;
  e.parent && e.parent.children--;
}
function rqUnmountAll() {
  for (const e of [...RQ.live.values()]) rqDispose(e);
  RQ.live.clear();
}

// barrido (cada 0.5 s): enfriamientos, montaje y desmontaje por distancia, descubrimiento
function rqSweep() {
  const S = rqS(),
    pl = x.player,
    t = rqClock();
  if (!S || !S.init || !pl) return;
  for (const s of Object.values(S.slots)) {
    if (s.st === "wait") {
      if (t >= s.cd && Math.hypot(s.x - pl.x, s.z - pl.z) > RQC.hideR * 0.6) rqReborn(s) && ee("save");
      continue;
    }
    const e = RQ.live.get(s.id),
      d = Math.hypot(s.x - pl.x, s.z - pl.z);
    if (e && !rqAlive(e)) RQ.live.delete(s.id);
    const live = RQ.live.get(s.id);
    if (!live) {
      if (d < RQC.loadR && !pl.dead && !x.inSafe) rqMount(s);
    } else if (d > RQC.unloadR && !live.alerted) {
      rqDispose(live);
      RQ.live.delete(s.id);
    } else if (d > RQC.unloadR * 1.35) {
      // huir lo reinicia aunque estuviera alertado
      rqDispose(live);
      RQ.live.delete(s.id);
    }
    // descubrimiento: a menos de seeR y con línea de vista (o muy cerca)
    const lv = RQ.live.get(s.id);
    if (lv && !s.seen) {
      const dd = Le(lv.x, lv.z, pl.x, pl.z);
      if (dd < 9 || (dd < RQC.seeR && x.map.los(lv.x, lv.z, pl.x, pl.z))) rqSeen(s, lv);
    }
  }
}
function rqSeen(s, e) {
  s.seen = 1;
  const A = RQA[s.arch],
    u = s.uniq ? RQU.find((q) => q.id === s.uniq) : null;
  ee("banner", `★ ${s.uniq ? "ÚNICO" : "RARO"} · ${s.name}`, A.hint, "#ffd34d");
  ee("toast", `${A.n}: ${A.hint[0].toLowerCase() + A.hint.slice(1)}.${u ? " Lleva algo encima." : ""}`, "quest");
  ae.play("roar", { v: 0.6 });
  x.R.addShake(0.25);
  ee("rare", "seen", s);
  ee("save");
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 4 · Mecánicas exclusivas
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Cada arquetipo es una función (e, R, dt, dist, pl) que devuelve true si congela la IA base este fotograma (está ejecutando un acto con
// aviso, embestida, canalización…) y false si la IA normal sigue (perseguir, atacar). `R` = e.rq. Los actos son objetos {t, max, upd, end}.
const rqRand = (a) => a[0] + Q() * (a[1] - a[0]);
function rqAct(R, max, upd, end) {
  R.act = { t: 0, max, upd, end };
}
function rqRunAct(e, R, dt) {
  const a = R.act;
  if (!a) return false;
  a.t += dt;
  const r = a.upd(dt, a);
  if (r === "done" || a.t >= a.max) {
    R.act = null;
    a.end && a.end(a);
    e.wind = 0;
    if (e.state === "wind" || e.state === "charge") e.state = "chase"; // la IA base no debe encontrarse a medias un estado suyo
    return false;
  }
  return true;
}
function rqFace(e, pl) {
  e.face = Math.atan2(pl.x - e.x, pl.z - e.z);
}
// enlace entre dos puntos (pilones → raro, jugador → chupasangre…): hilera de charcos de luz en el suelo que avanza hacia B. Es de dibujo inmediato (hay que llamarla
// cada fotograma). Los haces del motor (fx.beam) llevan siempre un núcleo casi blanco que, repetido cada fotograma, el bloom expande hasta tapar media pantalla.
function rqFlow(ax, az, bx, bz, col, a = 1) {
  const dx = bx - ax,
    dz = bz - az,
    d = Math.hypot(dx, dz) || 1,
    k = Math.max(3, Math.round(d / 1.25)),
    ph = (x.time * 1.8) % 1;
  for (let i = 0; i < k; i++) {
    const t = (i + ph) / k;
    x.fx.halo(ax + dx * t, az + dz * t, 0.5, col, a * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t))), 2);
  }
}
// carril de aviso de la embestida: hilera de círculos de aviso en el suelo (el relleno crece hasta el impacto, como los avisos de los jefes). La primera llamada los crea;
// las siguientes los recolocan mientras la criatura sigue apuntando (hasta que se bloquea)
function rqLane(a, e, ang, len, width, warn) {
  const sx = Math.sin(ang),
    sz = Math.cos(ang),
    r = width / 2,
    n = Math.max(3, Math.ceil(len / (r * 2.1))); // círculos casi tangentes: si se solapan, el relleno aditivo se suma y el bloom lo quema
  if (!a.lane) a.lane = [];
  for (let i = 0; i < n; i++) {
    const d = r + i * r * 2.1,
      px = e.x + sx * d,
      pz = e.z + sz * d;
    let t = a.lane[i];
    if (!t) a.lane[i] = x.fx.telegraph(px, pz, r, warn, RQC.teleCol);
    else {
      t.x = px;
      t.z = pz;
    }
  }
}
// distancia del jugador a un segmento (para saber si una línea de aviso lo alcanza)
function rqSegDist(ax, az, bx, bz, px, pz) {
  const dx = bx - ax,
    dz = bz - az,
    l2 = dx * dx + dz * dz || 1;
  const t = qe(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
const RQM = {
  // ── Mudadora: al perder vida muda (invulnerable un momento) y suelta crías; cada muda la deja más rápida ──
  mudadora(e, R, dt, dist, pl) {
    const C = RQC.mudadora;
    if (R.act) return rqRunAct(e, R, dt);
    R.molts = R.molts | 0;
    const hpf = e.hp / e.maxHp;
    R.status = R.molts < C.at.length ? `MUDAS ${R.molts}/${C.at.length}` : "ÚLTIMA MUDA HECHA";
    if (R.molts < C.at.length && hpf <= C.at[R.molts]) {
      const n = ++R.molts;
      x.fx.telegraph(e.x, e.z, C.r, C.warn, RQC.teleCol);
      e.invuln = true;
      e.shielded = C.warn + C.holdS;
      e.vx = e.vz = 0;
      ae.play("roar");
      rqAct(
        R,
        C.warn + C.holdS,
        (d, a) => {
          R.status = "MUDANDO · INVULNERABLE";
          e.vx = e.vz = 0;
          e.wind = 1;
          if (!a.boom && a.t >= C.warn) {
            a.boom = true;
            e.wind = 0;
            dn(e.x, e.z, C.r, e.dmg * C.dmg, { owner: "e", color: 0xffd34d });
            x.fx.ring(e.x, e.z, C.r * 1.4, 0xffd34d, 0.6);
            const kid = C.kid[e.fam] || "rastrero",
              before = x.enemies.length;
            e.summon(kid, C.kids + n - 1, Math.max(1, e.lvl - 3));
            for (let i = before; i < x.enemies.length; i++) R.kids.push(x.enemies[i]);
          }
        },
        () => {
          e.invuln = false;
          e.shielded = 0;
          e.spd *= C.spdUp;
          e.dmg *= C.dmgUp;
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * C.heal);
          x.fx.burst(e.x, 0.8, e.z, 18, { color: 0xffd34d, speed: 4, life: 0.5, size: 0.3, up: 1 });
        },
      );
      return true;
    }
    return false;
  },

  // ── Embestidora: embiste en línea recta tras un aviso largo; si se estrella contra un muro queda aturdida y vulnerable ──
  estampida(e, R, dt, dist, pl) {
    const C = RQC.estampida;
    if (R.act) return rqRunAct(e, R, dt);
    R.cd = (R.cd ?? C.firstS) - dt / R.cdMul;
    R.status = R.vuln > 0 ? "ATURDIDA · ¡ATACA!" : R.cd < 1.5 && R.cd > 0 ? "¡VA A EMBESTIR!" : "EMBESTIDA: que se estrelle contra un muro";
    if (R.cd <= 0 && dist > C.minD && dist < C.maxD && x.map.los(e.x, e.z, pl.x, pl.z)) {
      R.cd = rqRand(C.gapS);
      let ang = Math.atan2(pl.x - e.x, pl.z - e.z);
      ae.play("roar", { v: 0.5 });
      rqAct(
        R,
        C.windS + C.maxDashS + 0.6,
        (d, a) => {
          if (!a.ph) {
            R.status = "¡VA A EMBESTIR!";
            e.vx = e.vz = 0;
            e.state = "wind";
            if (a.t < C.windS - C.lockS) ang = Math.atan2(pl.x - e.x, pl.z - e.z);
            e.face = ang;
            e.wind = 1;
            if (a.t < C.windS - C.lockS || !a.lane) rqLane(a, e, ang, C.len, C.width, C.windS); // sigue apuntando hasta bloquearse (lockS antes de embestir)
            if (a.t >= C.windS) {
              a.ph = 1;
              a.dashT = 0;
              e.wind = 0;
              x.R.addShake(0.2);
            }
            return;
          }
          e.state = "charge";
          a.dashT += d;
          const sp = e.spd * C.dashMul,
            [nx, nz] = x.map.move(e.x, e.z, e.rad * 0.8, Math.sin(ang) * sp * d, Math.cos(ang) * sp * d),
            moved = Math.hypot(nx - e.x, nz - e.z);
          e.x = nx;
          e.z = nz;
          e.face = ang;
          e.vx = Math.sin(ang) * sp;
          e.vz = Math.cos(ang) * sp;
          if (Q() < d * 30) x.fx.burst(e.x, 0.3, e.z, 2, { color: 0xb0a090, add: false, speed: 2, life: 0.5, size: 0.4 });
          if (!a.hit && Le(e.x, e.z, pl.x, pl.z) < e.rad + pl.r + 0.3) {
            a.hit = true;
            pl.hurt(e.dmg * C.dmg, { src: e, melee: true });
            pl.vx += Math.sin(ang) * C.push;
            pl.vz += Math.cos(ang) * C.push;
          }
          if (a.dashT > 0.18 && moved < sp * d * 0.3) {
            R.stun = C.stunS;
            R.vuln = C.stunS;
            e.vx = e.vz = 0;
            x.R.addShake(0.5);
            x.fx.burst(e.x, 0.6, e.z, 24, { color: 0xffd34d, speed: 6, life: 0.6, size: 0.35, up: 1 });
            x.fx.ring(e.x, e.z, 3.2, 0xffd34d, 0.5);
            ae.play("boom", { v: 0.6 });
            return "done";
          }
          if (a.dashT >= C.maxDashS) {
            R.stun = 0.7;
            return "done";
          }
        },
        null,
      );
      return true;
    }
    return false;
  },

  // ── Pararrayos: la protegen pilones tesla (daño ×0,28 mientras vivan); sin ellos queda expuesta y desatada. Cae un rayo sobre ti cada pocos segundos ──
  pararrayos(e, R, dt, dist, pl) {
    const C = RQC.pararrayos;
    if (!R.pylonsInit) {
      R.pylonsInit = true;
      const n = e.lvl > 25 ? C.pylons[1] : C.pylons[0],
        a0 = Q() * 6.283;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * 6.283,
          r = C.ring[0] + Q() * (C.ring[1] - C.ring[0]),
          [px, pz] = x.map.findFree(e.x + Math.cos(a) * r, e.z + Math.sin(a) * r, 4, 0.7),
          p = In("pilon", Math.max(1, e.lvl - 1), px, pz, { alerted: true, persist: true, parent: e });
        p.rqPylon = e;
        p.name = "Pilón";
        e.children++;
        R.kids.push(p);
        x.fx.burst(px, 0.4, pz, 10, { color: 0x8fdcff, speed: 3, life: 0.5, size: 0.3, up: 1 });
      }
    }
    // pilones vivos
    let alive = 0;
    for (const p of R.kids) if (p && !p.dead && p.rqPylon === e) alive++;
    R.pylonN = alive;
    const was = R.armor < 1;
    R.armor = alive > 0 ? C.armor : 1;
    if (alive > 0) {
      R.status = `PROTEGIDA · PILONES ${alive}`;
      for (const p of R.kids) p && !p.dead && p.rqPylon === e && rqFlow(p.x, p.z, e.x, e.z, RQC.flowCol.pylon); // dibujo inmediato: cada fotograma
    } else if (was) {
      // los pilones cayeron: sobrecarga
      R.stun = C.exposedS;
      R.vuln = C.exposedS;
      R.unshielded = true;
      x.fx.ring(e.x, e.z, 5, 0x8fdcff, 0.6);
      x.fx.burst(e.x, 1, e.z, 30, { color: 0x8fdcff, speed: 7, life: 0.6, size: 0.35, up: 1 });
      ee("toast", "¡Los pilones han caído! Está expuesta.", "good");
      ae.play("boom", { v: 0.6 });
    }
    if (R.stun > 0) return false; // lo gestiona rqTick
    if (!alive) R.status = "EXPUESTA";
    // rayos sobre tu posición (con aviso)
    R.cd = (R.cd ?? C.firstS) - dt / R.cdMul / (alive ? 1 : 1.6);
    if (R.cd <= 0 && dist < 22 && !pl.dead) {
      R.cd = rqRand(C.gapS);
      const bx = pl.x + (pl.vx || 0) * 0.35,
        bz = pl.z + (pl.vz || 0) * 0.35;
      x.fx.telegraph(bx, bz, C.r, C.warn, RQC.teleCol);
      RQ.bolts.push({ x: bx, z: bz, t: C.warn, r: C.r, dmg: e.dmg * C.dmg, from: e });
    }
    return false;
  },

  // ── Acorazada: con la coraza cerrada casi no recibe daño; tras cada descarga se abre unos segundos ──
  coraza(e, R, dt, dist, pl) {
    const C = RQC.coraza;
    if (R.act) return rqRunAct(e, R, dt);
    R.open = R.open || 0; // s que le quedan abierta
    if (R.open > 0) {
      R.open -= dt;
      R.armor = 1;
      R.vuln = Math.max(R.vuln, 0.1);
      R.status = "ABIERTA · ¡ATACA!";
      if (Q() < dt * 12) x.fx.burst(e.x + (Q() - 0.5) * 1.4, 1.1, e.z + (Q() - 0.5) * 1.4, 1, { color: 0xffa040, speed: 1.5, life: 0.5, size: 0.3, up: 1.4 });
      if (R.open <= 0) {
        R.closedAt = x.time;
        x.fx.ring(e.x, e.z, 2.4, 0x8ea0b8, 0.4);
      }
      return false;
    }
    R.armor = C.armor;
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * C.regen * dt);
    R.status = "BLINDADA · espera su descarga";
    R.cd = (R.cd ?? C.closedS) - dt / R.cdMul;
    if (R.cd <= 0 && dist < 16) {
      R.cd = C.closedS;
      x.fx.telegraph(e.x, e.z, C.novaR, C.warn, RQC.teleCol);
      ae.play("alarm", { v: 0.5 });
      rqAct(
        R,
        C.warn + 0.4,
        (d, a) => {
          R.status = "DESCARGA";
          e.vx = e.vz = 0;
          e.wind = 1;
          if (!a.boom && a.t >= C.warn) {
            a.boom = true;
            e.wind = 0;
            dn(e.x, e.z, C.novaR, e.dmg * C.dmg, { owner: "e", color: 0xffa040 });
            x.fx.ring(e.x, e.z, C.novaR * 1.3, 0xffa040, 0.6);
            R.open = C.openS;
            R.armor = 1;
            x.R.addShake(0.35);
            return "done";
          }
        },
        null,
      );
      return true;
    }
    return false;
  },

  // ── Atractor: un pozo gravitatorio te arrastra hacia él y estalla al final (sal del radio) ──
  pozo(e, R, dt, dist, pl) {
    const C = RQC.pozo;
    if (R.act) return rqRunAct(e, R, dt);
    R.cd = (R.cd ?? C.firstS) - dt / R.cdMul;
    R.status = R.cd < 1.6 && R.cd > 0 ? "¡POZO GRAVITATORIO!" : "ATRACTOR: sal del radio cuando se cierre";
    if (R.cd <= 0 && dist < C.maxD && !pl.dead) {
      R.cd = rqRand(C.gapS);
      const cx = e.x,
        cz = e.z;
      x.fx.telegraph(cx, cz, C.r, C.warn, RQC.teleCol);
      ae.play("alarm", { v: 0.5 });
      rqAct(
        R,
        C.warn + C.pullS + 0.5,
        (d, a) => {
          e.vx = e.vz = 0;
          e.wind = 1;
          if (a.t < C.warn) {
            R.status = "¡POZO GRAVITATORIO!";
            if ((a.rt = (a.rt || 0) - d) <= 0) {
              a.rt = 0.3;
              x.fx.ring(cx, cz, C.r * (1 - a.t / C.warn) + 1, 0x9a6bff, 0.35, 0);
            }
            return;
          }
          if (a.t < C.warn + C.pullS) {
            R.status = "ARRASTRANDO · ¡CORRE!";
            const dd = Le(cx, cz, pl.x, pl.z);
            if (dd < C.r && dd > 0.7 && !pl.dead) {
              const k = C.pull * d,
                [nx, nz] = x.map.move(pl.x, pl.z, pl.r, ((cx - pl.x) / dd) * k, ((cz - pl.z) / dd) * k);
              pl.x = nx;
              pl.z = nz;
            }
            if ((a.rt = (a.rt || 0) - d) <= 0) {
              a.rt = 0.25;
              x.fx.ring(cx, cz, C.r * (1 - (a.t - C.warn) / C.pullS) + 1, 0x9a6bff, 0.3, 0);
            }
            return;
          }
          if (!a.boom) {
            a.boom = true;
            e.wind = 0;
            dn(cx, cz, C.boomR, e.dmg * C.dmg, { owner: "e", color: 0x9a6bff });
            x.fx.ring(cx, cz, C.boomR * 1.8, 0x9a6bff, 0.6);
            x.fx.burst(cx, 0.8, cz, 28, { color: 0x9a6bff, speed: 8, life: 0.5, size: 0.35, up: 0.5 });
            x.R.addShake(0.35);
            return "done";
          }
        },
        null,
      );
      return true;
    }
    return false;
  },

  // ── Chupasangre: se engancha y te drena mientras haya línea de vista; cúbrete tras un muro y la rompes ──
  chupasangre(e, R, dt, dist, pl) {
    const C = RQC.chupasangre;
    if (R.link) {
      const L = R.link;
      L.t += dt;
      const los = x.map.los(e.x, e.z, pl.x, pl.z);
      L.lost = los ? 0 : L.lost + dt;
      e.vx = e.vz = 0;
      e.face = Math.atan2(pl.x - e.x, pl.z - e.z);
      rqFlow(pl.x, pl.z, e.x, e.z, RQC.flowCol.link); // la sangre fluye hacia ella
      R.status = "ENLACE · rompe la línea de visión";
      if ((L.tick -= dt) <= 0) {
        L.tick = C.tickS;
        const got = pl.hurt(e.dmg * C.dmg, { src: e, dot: true, elem: "toxic" }) || 0;
        e.hp = Math.min(e.maxHp, e.hp + got * C.heal);
        x.fx.burst(e.x, 1.1, e.z, 3, { color: 0xff3050, speed: 2, life: 0.4, size: 0.2, up: 1 });
      }
      if (L.lost > C.loseS || dist > C.breakD || L.t > C.holdS || pl.dead) {
        const broke = L.lost > C.loseS || dist > C.breakD;
        R.link = null;
        R.stun = broke ? C.recoilS : 0;
        R.vuln = broke ? C.recoilS : 0;
        if (broke) {
          x.fx.ring(e.x, e.z, 2.6, 0xff3050, 0.4);
          x.fx.text(e.x, 2.4, e.z, "ENLACE ROTO", "#ffd34d", 14, { life: 1 });
        }
        R.cd = rqRand(C.gapS);
      }
      return true;
    }
    if (R.act) return rqRunAct(e, R, dt);
    R.cd = (R.cd ?? C.firstS) - dt / R.cdMul;
    R.status = "CHUPASANGRE: se engancha a ti";
    if (R.cd <= 0 && dist >= C.minD && dist < C.maxD && x.map.los(e.x, e.z, pl.x, pl.z) && !pl.dead) {
      R.cd = rqRand(C.gapS);
      ae.play("beep", { p: 1.4 });
      rqAct(
        R,
        C.windS + 0.2,
        (d, a) => {
          e.vx = e.vz = 0;
          e.face = Math.atan2(pl.x - e.x, pl.z - e.z);
          e.wind = 1;
          R.status = "ENGANCHANDO…";
          rqFlow(e.x, e.z, pl.x, pl.z, RQC.flowCol.hook, 0.5);
          if (a.t >= C.windS) {
            R.link = { t: 0, lost: 0, tick: C.tickS * 0.6 };
            return "done";
          }
        },
        null,
      );
      return true;
    }
    return false;
  },

  // ── Espejismo: una acechadora que se rodea de copias sin daño; la real lleva el anillo dorado ──
  acechador(e, R, dt, dist, pl) {
    const C = RQC.acechador;
    R.status = "ESPEJISMOS: la real lleva el anillo dorado";
    R.decoyT = (R.decoyT ?? 0) - dt;
    if (R.decoyT <= 0) {
      R.decoyT = C.gapS;
      R.kids = R.kids.filter((k) => k && !k.dead);
      for (let i = R.kids.length; i < C.decoys; i++) {
        const a = Q() * 6.283,
          r = C.ringMin + Q() * (C.ringMax - C.ringMin),
          [px, pz] = x.map.findFree(pl.x + Math.cos(a) * r, pl.z + Math.sin(a) * r, 3, 0.5),
          d = In(e.id, e.lvl, px, pz, { alerted: true, persist: true, parent: e, hpMul: C.hpMul });
        d.rqDecoy = e;
        d.dmg = 0;
        d.scale = e.scale; // del mismo tamaño que la real: solo el anillo dorado y el nombre la delatan
        d.rad = e.rad;
        d.updateAI = function (dt2, t2) {
          this.cloaked = t2 > 3.5; // se camuflan igual que la real
          if (t2 < 2.4) return 0;
          return this.steer(x.player.x, x.player.z, this.spd * 0.85, dt2);
        };
        e.children++;
        R.kids.push(d);
        x.fx.burst(px, 0.8, pz, 10, { color: 0xbfe6ff, speed: 3, life: 0.4, size: 0.25, up: 1 });
      }
    }
    return false;
  },

  // ── Aura: planta charcos de fuego (o de hielo) escalonados bajo tus pies; hay que moverse ──
  aura(e, R, dt, dist, pl) {
    const C = RQC.aura;
    if (R.act) {
      rqRunAct(e, R, dt); // planta los charcos mientras sigue persiguiendo
      return false;
    }
    R.cd = (R.cd ?? C.firstS) - dt / R.cdMul;
    const ice = !!R.ice,
      col = ice ? 0x8fd8ff : 0xff7a30;
    R.status = ice ? "AURA GÉLIDA: no te quedes quieto" : "AURA ARDIENTE: no te quedes quieto";
    if (R.cd <= 0 && dist < C.maxD && !pl.dead) {
      R.cd = rqRand(C.gapS);
      const pts = [],
        bx = pl.x + (pl.vx || 0) * 0.4,
        bz = pl.z + (pl.vz || 0) * 0.4;
      pts.push([bx, bz]);
      for (let i = 1; i < C.pools; i++) {
        const a = Q() * 6.283 + i * 2.1;
        pts.push([bx + Math.cos(a) * C.offset, bz + Math.sin(a) * C.offset]);
      }
      pts.forEach((p, i) => {
        x.fx.telegraph(p[0], p[1], C.r, C.warn + i * 0.25, RQC.teleCol);
        p[2] = C.warn + i * 0.25;
      });
      ae.play("alarm", { v: 0.4 });
      rqAct(
        R,
        C.warn + C.pools * 0.25 + 0.2,
        (d, a) => {
          for (const p of pts)
            if (!p[3] && a.t >= p[2]) {
              p[3] = 1;
              const h = { x: p[0], z: p[1], r: C.r, t: C.holdS, dps: e.dmg * C.dps, owner: "e", kind: "fire", color: col, elem: ice ? "ice" : "fire", rq: true, ice };
              Oa(h);
              RQ.pools.push(h);
            }
          if (pts.every((p) => p[3])) return "done";
        },
        null,
      );
    }
    return false;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 5 · Ejecución de las mecánicas (gancho en gadgetEnemyTick, que el motor consulta antes de la IA de cada enemigo)
// ═══════════════════════════════════════════════════════════════════════════════════════════
function rqTick(e, dt, dist) {
  const R = e.rq,
    pl = x.player;
  R.t += dt;
  if (R.vuln > 0) R.vuln -= dt;
  // furia: por debajo del umbral, más rápida y con las mecánicas más seguidas
  if (!R.rage && e.hp < e.maxHp * RQC.rage.at && e.alerted) {
    R.rage = true;
    R.cdMul = RQC.rage.cdMul;
    e.spd *= RQC.rage.spdMul;
    e.dmg *= RQC.rage.dmgMul;
    x.fx.text(e.x, 2.6 * e.scale, e.z, "¡SE ENFURECE!", "#ff5040", 16, { life: 1.2 });
    x.fx.ring(e.x, e.z, 3.4, 0xff5040, 0.5);
    ae.play("roar", { v: 0.7 });
  }
  if (R.stun > 0) {
    R.stun -= dt;
    e.vx *= 0.7;
    e.vz *= 0.7;
    e.state = "stun";
    R.status = R.arch === "pararrayos" ? "EXPUESTA · ¡ATACA!" : R.arch === "chupasangre" ? "ENLACE ROTO · ¡ATACA!" : "ATURDIDA · ¡ATACA!";
    if (Q() < dt * 10) x.fx.zap(e.x, e.z, e.x + (Q() - 0.5) * 1.6, e.z + (Q() - 0.5) * 1.6, 0xffd34d, 0.5 + Q() * 0.8);
    if (R.stun <= 0) e.state = "chase";
    return true;
  }
  if (!e.alerted || pl.dead) {
    // tranquila: destello dorado para que se vea desde lejos
    if ((R.glint = (R.glint ?? Q() * 2) - dt) <= 0) {
      R.glint = rqRand(RQC.glintS);
      x.fx.burst(e.x, 1.2 * e.scale, e.z, 2, { color: 0xffd34d, speed: 1.2, life: 0.9, size: 0.22, up: 1.4 });
    }
    return false;
  }
  const M = RQM[R.arch];
  return M ? !!M(e, R, dt, dist, pl) : false;
}
{
  const _g = gadgetEnemyTick;
  gadgetEnemyTick = function (e, dt, dist) {
    if (e.rq && !(e.gStun > 0)) { // un aturdimiento de gadget (señuelo, bobina…) pausa sus mecánicas
      try {
        if (rqTick(e, dt, dist)) return true;
      } catch (err) {
        console.warn("[raros] mecánica", err);
      }
    }
    return _g(e, dt, dist);
  };
}
// el daño que recibe: coraza cerrada / pilones (armor < 1) y vulnerabilidad tras un aturdimiento (vuln > 0)
{
  const _dm = vp.prototype.dmgTakenMul;
  vp.prototype.dmgTakenMul = function () {
    let m = _dm.call(this);
    const R = this.rq;
    if (R) {
      if (R.armor < 1) m *= R.armor;
      if (R.vuln > 0) m *= RQC[R.arch] && RQC[R.arch].vuln ? RQC[R.arch].vuln : 1.3;
    }
    return m;
  };
}
// descargas del Pararrayos y charcos de hielo (que ralentizan): se resuelven aquí, con el reloj del juego
function rqEffects(dt) {
  const pl = x.player;
  for (let i = RQ.bolts.length - 1; i >= 0; i--) {
    const b = RQ.bolts[i];
    if ((b.t -= dt) > 0) continue;
    RQ.bolts[i] = RQ.bolts[RQ.bolts.length - 1];
    RQ.bolts.pop();
    if (b.from && b.from.dead) continue;
    x.fx.zap(b.x, b.z, b.x + (Q() - 0.5) * 0.4, b.z + (Q() - 0.5) * 0.4, 0x8fdcff, 6);
    dn(b.x, b.z, b.r, b.dmg, { owner: "e", color: 0x8fdcff, elem: "shock", small: true });
  }
  for (let i = RQ.pools.length - 1; i >= 0; i--) {
    const h = RQ.pools[i];
    if (h.t <= 0 || !x.hazards.includes(h)) {
      RQ.pools[i] = RQ.pools[RQ.pools.length - 1];
      RQ.pools.pop();
      continue;
    }
    if (h.ice && !pl.dead && Le(pl.x, pl.z, h.x, h.z) < h.r) pl.slowT = Math.max(pl.slowT || 0, 1.2);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 6 · Bucle general
// ═══════════════════════════════════════════════════════════════════════════════════════════
function rqMapChanged() {
  // al cambiar de mapa (subterráneo, operación, menú) los enemigos del mundo se descartan solos: se olvida lo montado
  RQ.live.clear();
  RQ.bolts.length = 0;
  RQ.pools.length = 0;
}
x.tick.push((dt) => {
  if (!x.S || !x.started || !x.player || !RQC.enabled) return;
  const S = rqS();
  if (!S) return;
  if (RQ.map !== x.map) {
    RQ.map = x.map;
    rqMapChanged();
  }
  if (x.mode !== "world") return;
  if (!S.init && rqInitSlots()) ee("save");
  RQ.t -= dt;
  if (RQ.t <= 0) {
    RQ.t = 0.5;
    rqSweep();
  }
  rqEffects(dt);
});
It("toMenu", () => {
  rqUnmountAll();
  RQ.map = null;
  RQ.bolts.length = 0;
  RQ.pools.length = 0;
});
// un raro no se convierte en Némesis cuando te mata (ya tiene su propia historia)
{
  const _nk = typeof sxNemKiller === "function" ? sxNemKiller : null;
  if (_nk)
    sxNemKiller = function () {
      const k = _nk();
      return k && (k.rq || k.rqDecoy || k.rqPylon) ? null : k;
    };
}

It("rare", (what, d) => {
  RQ.log.push([what, d && (d.name || d.n || d.id) ? String(d.name || d.n || d.id) : ""]);
  RQ.log.length > 60 && RQ.log.shift();
});
// prueba: crea un raro suelto (con su casilla) en una posición y lo deja alertado
function rqSpawn(arch, reg, px, pz, o = {}) {
  const A = RQA[arch],
    base = o.base || A.bases[reg] || Object.values(A.bases)[0],
    S = rqS(),
    s = rqNewSlot(reg, { x: px, z: pz }, { arch, base, uniq: o.uniq || null, name: o.name || A.names[0], ice: o.ice || 0 }, "ready");
  if (o.uniq) S.slots[s.id].uniq = o.uniq;
  const e = rqMount(s);
  if (e && o.alert !== false) e.alerted = true;
  return e;
}

window.__rare = {
  cfg: RQC,
  flow: rqFlow,
  lane: rqLane,
  spawn: rqSpawn,
  RQA,
  RQU,
  RQM,
  RQ,
  state: rqS,
  slots: () => Object.values(rqS().slots),
  init: rqInitSlots,
  spot: rqSpot,
  roll: rqRoll,
  reborn: rqReborn,
  newSlot: rqNewSlot,
  mount: rqMount,
  lvl: rqLvl,
  ref: rqRef,
  sweep: rqSweep,
  dispose: rqDispose,
  live: () => [...RQ.live.values()],
  migrate: rqMigrate,
  seen: rqSeen,
  tick: rqTick,
};

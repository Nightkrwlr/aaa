// lore-data.js — Datos y funciones puras del frente LORE (D5): entradas, colecciones, voces y pistas.
//
// Módulo ES sin dependencias del DOM ni del juego: lo importa src/game/_prelude.lore.js (alias Lore*) y lo ejecuta también
// tools/sim/lore.mjs en Node para validar el contenido. Todo texto de cara al jugador está en español.
//
// «Biblia» (lo que sostiene las 70 entradas; los documentos viejos del juego —16-story.js— ya la insinúan):
//  · Hace 60.000 años algo llegó a la Tierra y durmió bajo la Caldera Ígnea. Los monolitos de cristal negro del desierto son su red
//    de relés. Los científicos de Aurora la llaman «la Raíz»; la Mente Colmena es su brote más reciente.
//  · Su latido, medido en medio mundo, tenía un periodo de 11 minutos. Cada emisión del Proyecto ECLIPSE (Laboratorio Helix, en el
//    Complejo Prometeo) lo aceleró: 3 min, 41 s, y tras la tercera, 14 s. «Eclipse» es el alineamiento Sol-Luna-Tierra en el que
//    la señal llega 40 veces más fuerte; la tercera emisión fue durante el eclipse lunar total de las 03:14 del día cero.
//  · Las luces NO cayeron del cielo: subieron de la Caldera y cayeron en arco (Karim lo vio). ARGOS conocía ECLIPSE desde el primer
//    día y calló por obediencia; su Registro 0001 es posterior.
//  · Los Señores del Enjambre fueron personas con nombre: cada jefe tiene un expediente («quién fue»).

// ═══ Regiones (índices de De[] en 09-regions.js) ═══
export const LORE_REGION_NAMES = [
  "Valle Esmeralda", "Ciudad Caída", "Desierto de Ceniza", "Marisma Tóxica", "Tundra Glacial",
  "Complejo Prometeo", "Caldera Ígnea", "Yermo Radiactivo", "La Colmena",
];

// ═══ Voces de las grabaciones ═══
// f0 = tono base (Hz), rate = velocidad relativa del habla, form = desplazamiento de formantes (<1 más grave/grande),
// breath = soplo (0..1), rough = aspereza (0..1), robot = voz sintética (vibrato nulo, peine metálico).
export const LORE_VOICES = {
  argos:   { n: "ARGOS", f0: 112, rate: 0.9, form: 0.94, breath: 0.02, rough: 0, robot: 1 },
  reyes:   { n: "Cmdt. Reyes", f0: 96, rate: 0.92, form: 0.92, breath: 0.05, rough: 0.35 },
  marta:   { n: "Marta Vidal", f0: 232, rate: 1.12, form: 1.12, breath: 0.2, rough: 0.05 },
  soler:   { n: "Cap. Soler", f0: 118, rate: 1.0, form: 0.97, breath: 0.05, rough: 0.2 },
  lucia:   { n: "Lucía, Radio Libre", f0: 196, rate: 1.0, form: 1.06, breath: 0.12, rough: 0.1 },
  valdes:  { n: "Insp. Valdés", f0: 178, rate: 1.04, form: 1.03, breath: 0.08, rough: 0.2 },
  rosa:    { n: "Rosa", f0: 205, rate: 0.9, form: 1.04, breath: 0.15, rough: 0.35 },
  ibarra:  { n: "Dr. Ibarra", f0: 126, rate: 1.08, form: 0.99, breath: 0.1, rough: 0.1 },
  ignacio: { n: "Ignacio «El Brujo»", f0: 102, rate: 0.84, form: 0.9, breath: 0.1, rough: 0.5 },
  lin:     { n: "Dra. Lin", f0: 214, rate: 1.02, form: 1.08, breath: 0.08, rough: 0.05 },
  leal:    { n: "Sgta. Leal", f0: 168, rate: 1.1, form: 1.0, breath: 0.2, rough: 0.15 },
  rios:    { n: "Tte. Ríos", f0: 134, rate: 1.14, form: 0.98, breath: 0.08, rough: 0.25 },
  lund:    { n: "Dra. Lund", f0: 190, rate: 0.96, form: 1.05, breath: 0.25, rough: 0.05 },
  salgado: { n: "Ing. Salgado", f0: 122, rate: 0.95, form: 0.96, breath: 0.1, rough: 0.2 },
  karim:   { n: "Cap. Karim", f0: 128, rate: 1.16, form: 1.0, breath: 0.1, rough: 0.3 },
  rocco:   { n: "Rocco", f0: 100, rate: 0.9, form: 0.88, breath: 0.08, rough: 0.55 },
  marcos:  { n: "Brigadista Marcos", f0: 140, rate: 1.0, form: 1.0, breath: 0.1, rough: 0.2 },
  orlov:   { n: "Mijaíl Orlov", f0: 92, rate: 0.82, form: 0.86, breath: 0.12, rough: 0.6 },
  viktor:  { n: "Viktor", f0: 108, rate: 0.96, form: 0.93, breath: 0.08, rough: 0.4 },
  eco:     { n: "Eco", f0: 202, rate: 0.9, form: 1.07, breath: 0.3, rough: 0 },
  ferrer:  { n: "Cabo Ferrer", f0: 146, rate: 1.08, form: 1.0, breath: 0.15, rough: 0.25 },
};

// ═══ Pistas de puzle ═══
// kind: digits | dirs | runes | colors | freq | word | order. len = longitud de la secuencia.
// entry = documento que la revela (al leerlo descifrado queda anotada en el Archivo).
export const LORE_GLYPHS = ["Sol", "Luna", "Serpiente", "Ojo", "Cristal", "Raíz", "Llama", "Onda"];
export const LORE_COLORS = ["Rojo", "Ámbar", "Verde", "Azul", "Violeta", "Blanco"];
export const LORE_DIRS = ["Norte", "Este", "Sur", "Oeste"];
export const LORE_WORDS = [
  "ALBA", "TORMENTA", "CRISTAL", "GARZA", "CENIZA", "FARO", "ONDA", "RAIZ", "BRASA", "NIEBLA", "ACERO", "ESPORA",
  "ECLIPSE", "HELICE", "LATIDO", "UMBRAL", "CENTINELA", "AURORA", "PUENTE", "SALMO", "VIGIA", "ORBITA", "TRINCHERA", "MARFIL",
];
export const LORE_PHRASES = [
  "la luz vuelve a quien la espera", "bajo la ceniza queda el calor", "nadie cruza dos veces el mismo hielo",
  "el silencio también es una señal", "quien escucha no está solo", "la sombra sabe el camino de vuelta",
  "cada puerta recuerda una mano", "el agua guarda lo que se le canta", "ningún latido es del todo ajeno",
  "al final del cable siempre hay alguien", "de la raíz nace el fruto", "cuando el cielo calla, escucha el suelo",
];
export const LORE_HINTS = {
  "valle.bunker":    { kind: "digits", len: 4, entry: "v_ronda7", what: "el candado de la armería del búnker 7" },
  "ciudad.metro":    { kind: "dirs", len: 4, entry: "c_guia_metro", what: "las bifurcaciones del pasillo de servicio del metro" },
  "desierto.runas":  { kind: "runes", len: 4, entry: "d_excavacion", what: "los glifos del dintel de la cámara norte" },
  "marisma.coro":    { kind: "colors", len: 4, entry: "m_coro", what: "las entradas del coro en las lámparas del escenario" },
  "tundra.estacion": { kind: "freq", len: 1, entry: "t_estacion", what: "la baliza de socorro de la Estación Vigía" },
  "complejo.clave":  { kind: "word", len: 1, entry: "p_argos_0", what: "la clave de supervisión de ARGOS" },
  "caldera.valvulas":{ kind: "order", len: 4, entry: "k_pozo9", what: "las válvulas de refrigeración del Pozo 9" },
  "yermo.reactor":   { kind: "digits", len: 5, entry: "y_turno", what: "la sala de control manual del reactor 2" },
  "colmena.canto":   { kind: "runes", len: 5, entry: "h_varga", what: "el canto que abre la cámara interior" },
};

// ═══ Entradas ═══
// k: libro | chip | grab · w (dónde aparece): shelf estantería · body cadáver · rec equipo de radio · term terminal hackeada ·
// lair guarida (junto a un nido) · op operación/mazmorra · boss expediente al derrotar a un jefe.
// th: hilo narrativo. d: dificultad del cifrado (1-4) de los chips. Los textos admiten {{h:clave}} (pista de puzle).
export const LORE_ENTRIES = [
  // ───────────── 0 · VALLE ESMERALDA ─────────────
  { id: "v_ronda7", k: "libro", reg: 0, w: "shelf", t: "Cuaderno de ronda del búnker 7", a: "Cabo Duarte", hint: "valle.bunker",
    txt: "Jueves. Ronda de las 22:00 sin novedad, salvo las luces del norte, que siguen ahí. Hemos cambiado el candado de la armería: {{h:valle.bunker}}. Que no se entere el sargento Vega de que lo he apuntado aquí, me arranca las orejas. \nViernes. El teniente dice que los conductos de ventilación hacen ruido por el viento. El viento no respira. Si alguien lee esto: cierren la trampilla por dentro." },
  { id: "v_veterinaria", k: "libro", reg: 0, w: "shelf", t: "Agenda de una veterinaria", a: "Dra. Ana Ferreiro",
    txt: "Lunes: vacunas en casa de los Pérez. \nMartes: revisar la yegua de Tomás (le debo una cena). \nMiércoles: Tomás me recuerda que riegue los tomates, como si yo me fuera a olvidar. \nJueves, noche: parto de vaca en Los Olmos, finca de los Vidal. Llevar oxitocina y la linterna grande. Tomás quiere acompañarme y le digo que no, que es cosa de una hora. \nViernes: llamar a mi madre." },
  { id: "v_guia_valle", k: "libro", reg: 0, w: "shelf", t: "Guía del excursionista: Valle Esmeralda", a: "Oficina de Turismo",
    txt: "El Valle Esmeralda debe su nombre al verde intenso de sus prados tras la lluvia. A cuatro kilómetros de Los Olmos se abre el Cráter, una depresión natural de trescientos metros cuyo origen se calcula en más de 60.000 años. Los lugareños la llaman «la Cicatriz» y aseguran que los perros no cruzan su borde. Se desaconseja acampar en sus inmediaciones. Dicen también que en noches de eclipse el ganado se vuelve inquieto." },
  { id: "v_efemerides", k: "libro", reg: 0, w: "shelf", th: "eclipse", t: "Efemérides del Observatorio de Sierra Alta", a: "Observatorio de Sierra Alta",
    txt: "Eclipse lunar total previsto para la madrugada del día cero: totalidad a las 03:14, duración 41 minutos. Observación inusual: durante la totalidad, el radiotelescopio recibe una señal periódica y estrecha que no corresponde a ninguna fuente conocida. Su intensidad crece según avanza la sombra y se apaga cuando la Luna reaparece. Hemos avisado a Defensa. Nos han contestado que ya lo saben." },
  { id: "v_radio_reyes", k: "grab", reg: 0, w: "term", t: "Parte del Comandante Reyes, día 11", a: "Cmdt. Reyes",
    lines: [
      ["reyes", "Parte de situación, día once. Bastión resiste. Cuarenta y un efectivos, munición para nueve días."],
      ["reyes", "Repito la petición al Mando regional: ¿alguien sabe por qué dejaron de contestar el día tres?"],
      ["reyes", "He cruzado los puntos de caída de las luces. Forman un anillo de cuatrocientos kilómetros. El centro queda al este, en la Caldera."],
      ["reyes", "Eso no es una lluvia. Eso es una salva. Fin del parte."],
    ] },
  { id: "v_mensaje_vidal", k: "grab", reg: 0, w: "body", t: "Mensaje de voz de Marta Vidal", a: "Marta Vidal",
    lines: [
      ["marta", "Papá, soy yo. Ha nacido el ternero, pero la vaca se ha quedado muy rara. Está mirando hacia el cráter."],
      ["marta", "Hay luces verdes en el borde. No hacen ruido, pero se me ponen los pelos de punta."],
      ["marta", "La doctora Ana dice que no nos movamos, que ella lo va a mirar. Se ha ido sola hacia allí."],
      ["marta", "Papá, no la llames. Si te llama ella, no cojas el— "],
    ] },
  { id: "v_op_bunker", k: "grab", reg: 0, w: "op", themes: ["bunker"], th: "eclipse", t: "Grabación de seguridad del Búnker 12", a: "Cap. Soler",
    lines: [
      ["soler", "Inventario de custodia, búnker doce. Recibimos ayer doce cajas selladas, procedencia Complejo Prometeo."],
      ["soler", "Etiqueta única en todas: ECLIPSE, y un número de serie. Instrucción del Estado Mayor: no abrir, no mover, no preguntar."],
      ["soler", "Esta noche las cajas están calientes. Y una de ellas golpea desde dentro. Cada catorce segundos."],
      ["soler", "He ordenado evacuar el búnker. Si alguien oye esto: no las abran."],
    ] },
  { id: "b_reina", k: "chip", reg: 0, w: "boss", boss: "reina", d: 2, t: "Placa de identificación de la Reina de la Plaga", a: "Registro de Bastión",
    txt: "EXPEDIENTE CIVIL 0001 · Ferreiro Lastra, Ana. 36 años. Veterinaria rural, Valle Esmeralda. Casada con Tomás Aguirre, agricultor. Última llamada de servicio: parto de ganado en Los Olmos, noche del día cero, 02:50. Estado: primera reconocida como anfitriona. La Matriarca del Enjambre sigue pariendo en el borde del cráter donde la dejó la luz. Nota de Bastión: su marido todavía riega los tomates. No hace falta que se lo diga nadie." },

  // ───────────── 1 · CIUDAD CAÍDA ─────────────
  { id: "c_demolicion", k: "libro", reg: 1, w: "shelf", t: "Orden de derribo del Estadio Municipal", a: "Ayuntamiento de Nueva Esperanza",
    txt: "Se autoriza el derribo controlado del Estadio Municipal mediante 38 cargas de demolición. Jefe de obra: Gregorio Salas, operador de grúa y carga con 22 años de servicio. Fecha prevista: día 3 desde el fenómeno meteorológico. Observaciones: el contratista solicita aplazamiento por «actividad inusual de la fauna» en el graderío. Denegado. El estadio no puede esperar." },
  { id: "c_mercado", k: "libro", reg: 1, w: "shelf", t: "Libro de cuentas del Mercado Central", a: "Aurelio Beltrán, carnicero",
    txt: "Día 5. Treinta y dos vecinos en el sótano. Pan para cuatro días, agua para seis. \nDía 6. Limpio la sangre de los mostradores para que no huela hacia fuera: he descubierto que les atrae. \nDía 8. Nadie abre la trampilla sin la contraseña: «jamón de bellota». \nDía 9. Hay más de ellos arriba que ayer. Hoy saldré yo, y haré que me sigan lejos de la trampilla. Que alguien apunte quién fui." },
  { id: "c_guia_metro", k: "libro", reg: 1, w: "shelf", hint: "ciudad.metro", t: "Plano del metro, anotado a mano", a: "Radio Libre",
    txt: "Línea 2, estación Plaza Vieja. El túnel principal está inundado. Ruta al sur sin pisar el agua: seguir el pasillo de servicio y, en cada bifurcación, salir en este orden: {{h:ciudad.metro}}. No se detengan en los andenes: las pintadas con flechas rojas marcan dónde NO parar." },
  { id: "c_radio_lucia", k: "grab", reg: 1, w: "rec", th: "eclipse", t: "Emisión nocturna de Radio Libre", a: "Lucía, Radio Libre",
    lines: [
      ["lucia", "Buenas noches, Nueva Esperanza, o lo que queda de ti. Aquí Lucía, día cuarenta y siete."],
      ["lucia", "Hoy me ha llegado un fax. Sí, un fax. Viene de Prometeo, sin remitente. Una sola palabra repetida en todas las páginas."],
      ["lucia", "ECLIPSE. ECLIPSE. ECLIPSE. Y al final una fecha: la noche de las luces."],
      ["lucia", "Si alguien sabe qué es, que me lo cuente. Y si no lo sabe, que rece para que lo sepa otro."],
    ] },
  { id: "c_policia", k: "grab", reg: 1, w: "body", t: "Cinta de la comisaría 4", a: "Insp. Valdés",
    lines: [
      ["valdes", "Inspectora Valdés, comisaría cuatro. Tengo en la mesa uno de los objetos caídos en el parque de la Alameda."],
      ["valdes", "Del tamaño de un melón. Caliente. Y tiene pulso: lo he medido con el estetoscopio del forense. Uno cada catorce segundos."],
      ["valdes", "En la sala de al lado, el detenido que mordió a tres agentes tiene el mismo ritmo. Exactamente el mismo."],
      ["valdes", "Voy a pedir refuerzos. Si no me cogen el teléfono, pediré un exorcista."],
    ] },
  { id: "c_chip_hospital", k: "chip", reg: 1, w: "body", d: 2, t: "Registro clínico anónimo, San Rafael", a: "Doctora de guardia",
    txt: "Los pacientes mordidos presentan fiebre a las seis horas, mutismo a las doce y rigidez a las veinticuatro. Los electrocardiogramas de los primeros cuarenta casos coinciden: un latido adicional, superpuesto, con periodo de 14 segundos, en todos y cada uno. Misma frecuencia, misma fase, sin importar la distancia entre ellos. Alguien les está marcando el compás." },
  { id: "c_alc_op", k: "grab", reg: 1, w: "op", themes: ["alcantarilla"], t: "Cinta del refugio del alcantarillado", a: "Rosa, vecina del 2.º B",
    lines: [
      ["rosa", "Soy Rosa, la del segundo B. Grabo esto por si luego nadie se acuerda de nosotros."],
      ["rosa", "Somos treinta y dos. Nos sacó el carnicero del mercado, Aurelio, con su cuchillo grande y su voz de trueno."],
      ["rosa", "Se ha quedado arriba esta noche, distrayendo a los que escarban. Dijo que volvería. Antes de irse soltó lo de «jamón de bellota», como una broma."],
      ["rosa", "Han pasado tres días. Seguimos aquí abajo, esperando su contraseña."],
    ] },
  { id: "b_demoledor", k: "chip", reg: 1, w: "boss", boss: "demoledor", d: 2, t: "Placa de identificación del Demoledor", a: "Registro de Bastión",
    txt: "EXPEDIENTE DE PERSONAL 0412 · Salas Rivas, Gregorio «Goyo». 52 años. Operador de grúa de demolición, 22 años de servicio. Casado, dos hijas. Último destino: derribo del Estadio Municipal, Nueva Esperanza. Estado: desaparecido en acto de servicio, día 3. Anotación de ARGOS: la firma biométrica de la cabina de la grúa sigue activa. Nota de Bastión: sigue derribando. Ya no distingue entre muros y gente." },
  { id: "b_carnicero", k: "chip", reg: 1, w: "boss", boss: "carnicero", secret: 1, d: 3, t: "Placa de identificación del Carnicero", a: "Registro de Bastión",
    txt: "EXPEDIENTE CIVIL 7781 · Beltrán Sanz, Aurelio. 61 años. Carnicero del Mercado Central, viudo. Refugió a 32 vecinos en el sótano y las alcantarillas y los mantuvo con vida 41 días. Estado: mordido el día 9; salió a alejar a los infectados de la trampilla. Anotación: los 32 sobrevivieron. Él sigue en los túneles, vigilando una puerta que ya nadie abre. La Mente le ha quitado el nombre, pero no esa costumbre." },

  // ───────────── 2 · DESIERTO DE CENIZA ─────────────
  { id: "d_excavacion", k: "libro", reg: 2, w: "shelf", hint: "desierto.runas", t: "Cuaderno de excavación, campaña 3", a: "Yusuf Karsa, Universidad del Sur",
    txt: "Cámara norte despejada. El dintel del umbral lleva cuatro glifos en relieve. Por analogía con las estelas, solo se abre si se pulsan en el orden en que la luz los recorre al amanecer: {{h:desierto.runas}}. No lo hemos probado, porque la cámara sur respondió al tacto de mi mano: el cristal se iluminó y juraría que algo allí dentro dijo mi nombre. Mañana volveré con una cámara mejor. O sin ella." },
  { id: "d_nomadas", k: "libro", reg: 2, w: "shelf", th: "eclipse", t: "Cantos de Hamid el Viejo", a: "Zahra, transcripción",
    txt: "Mi tío Hamid cantaba así: «Bajo la arena duerme la ciudad que duerme de pie. No la despiertes con pasos, ni con gritos, ni con oro. Solo hay una llave y no es de este mundo: el día en que la Luna se coma al Sol y el cielo sea de noche a mediodía, los muertos de cristal abrirán los ojos». Yo anotaba y me reía. Hoy no me río." },
  { id: "d_convoy", k: "grab", reg: 2, w: "rec", t: "Radio del convoy de la Universidad del Sur", a: "Dr. Ibarra",
    lines: [
      ["ibarra", "Convoy siete a base. Seguimos atascados al pie de los monolitos. Los micrófonos no sirven: el cristal vibra en una sola nota y la mete en todos los aparatos."],
      ["ibarra", "El profesor Karsa se ha encerrado en la cámara. Dice que está descifrando. Hace dos días que no come."],
      ["ibarra", "Hemos medido los monolitos con un teodolito. Si prolongas la línea que forman hacia el noreste, apunta a la Caldera, a cuatrocientos kilómetros. Los monolitos son flechas."],
      ["ibarra", "Base, ¿me recibe? ... Base."],
    ] },
  { id: "d_op", k: "libro", reg: 2, w: "op", themes: ["ruinas", "magma"], t: "Libreta de una becaria", a: "Laila Haddad, becaria",
    txt: "Me han puesto a ordenar las cajas del campamento: veintiséis cajas de fragmentos, todas etiquetadas. Hay una sin etiqueta, la única que no pesa. La abrí un instante. Dentro había un mapa de estrellas dibujado a mano con una nota: «El eclipse del día cero. Todos los relés enfilados». Se lo enseñé a Karsa y se puso pálido. Cogió el mapa y lo quemó. Mi hermana Noor trabaja en Prometeo, con señales. Tengo que escribirle." },
  { id: "d_geologo", k: "chip", reg: 2, w: "term", th: "eclipse", d: 3, t: "Perfil sísmico Caldera-Desierto", a: "Servicio Geológico",
    txt: "Los 63 monolitos de cristal negro del Desierto de Ceniza están alineados con la Caldera Ígnea a lo largo de un arco de 410 kilómetros. La conductividad del cristal es máxima en el eje de la línea. Conclusión provisional: la estructura no es un yacimiento, es una antena de relevo. Conclusión adicional, tachada a mano: alguien enterró este sistema hace 60.000 años para que la señal de abajo llegara a toda la superficie." },
  { id: "b_kharsa", k: "chip", reg: 2, w: "boss", boss: "kharsa", d: 2, t: "Placa de identificación de Kharsa", a: "Registro de Bastión",
    txt: "EXPEDIENTE ACADÉMICO 0093 · Karsa Demir, Yusuf. 47 años. Doctor en Arqueología, Universidad del Sur. Director de la excavación del Desierto de Ceniza. Última entrada de su cuaderno: «Entiendo la lengua del cristal. Es sencilla. Es hambre». Estado: desaparecido en el interior de la cámara. Los nómadas ya no pronuncian su nombre completo, solo la mitad: Kharsa, como se nombra a un rey o a una plaga." },
  { id: "b_antiguo", k: "chip", reg: 2, w: "boss", boss: "antiguo", secret: 1, d: 3, t: "Placa de identificación del Centinela Antiguo", a: "Registro de Bastión",
    txt: "REGISTRO ORAL 0007 · Hamid ibn Salim, «el Viejo». 83 años. Guardián de la tumba de cristal por herencia de linaje, el último de once. Se negó a abandonar el desierto el día de las luces: «Mi trabajo es vigilar que no se abra». Estado: fusionado con el cristal en el umbral de la ciudad enterrada. Zahra dice que no es un monstruo, que sigue vigilando. Solo que ahora todo el que se acerca es lo que había que impedir." },

  // ───────────── 3 · MARISMA TÓXICA ─────────────
  { id: "m_convento", k: "libro", reg: 3, w: "shelf", t: "Crónica del Convento de Santa Clara de las Marismas", a: "Hna. Remedios",
    txt: "Víspera de San Roque. Madre Inés no duerme. Dice que bajo el agua del claustro alguien le habla con la voz de su madre. Nos pide que cantemos la salve toda la noche para ahogarla. \nDía siguiente. La reina del colmenar ha puesto huevos que no son de abeja. Madre Inés los ha mirado largo rato y ha sonreído. Es la primera vez en años. Pido a Dios que no vuelva a sonreír." },
  { id: "m_coro", k: "libro", reg: 3, w: "shelf", hint: "marisma.coro", t: "Partituras del Coro Municipal", a: "Elvira Montes, soprano",
    txt: "Para el concierto de aniversario en el teatro del embalse. El director quiere que las lámparas del escenario marquen cada entrada del coro con un color distinto. Orden de las entradas: {{h:marisma.coro}}. Si el orden se rompe, desafina todo el escenario. Nota al margen: ensayar con la ventana cerrada. Este año el agua del embalse devuelve las notas más altas de lo que las canto." },
  { id: "m_op_lab", k: "libro", reg: 3, w: "op", themes: ["laboratorio"], th: "eclipse", t: "Protocolo de contención Helix-3", a: "Laboratorio Helix, sede de campo",
    txt: "Las muestras de la marisma deben tratarse como material de Clase 5. Los técnicos firmarán el registro de silencio. Queda prohibido mencionar ECLIPSE fuera de las zonas de seguridad, incluso entre compañeros. Observación del jefe de laboratorio: las muestras reaccionaron a la hora exacta de las tres emisiones. No es una coincidencia estadística. Es una respuesta." },
  { id: "m_ignacio_cinta", k: "grab", reg: 3, w: "lair", t: "Cinta del ermitaño", a: "Ignacio «El Brujo»",
    lines: [
      ["ignacio", "Treinta años en esta marisma y es la primera vez que oigo esto. Una mujer canta bajo el agua. Siempre la misma frase."],
      ["ignacio", "«Aquí estoy, aquí estoy.» Y los animales caminan hacia la voz. Ciervos, zorros, hasta el viejo lobo cojo."],
      ["ignacio", "Me tapo los oídos con cera, pero la oigo igual. Porque la cantan por dentro de la cabeza."],
      ["ignacio", "Si me ves caminando hacia el agua, dispárame. Es un favor."],
    ] },
  { id: "m_lin", k: "grab", reg: 3, w: "rec", t: "Nota de voz de la Dra. Lin: muestra 3", a: "Dra. Lin",
    lines: [
      ["lin", "Nota de campo, marisma. He mezclado esporas con suero a tres frecuencias. Respuesta máxima a una pulsación de catorce segundos."],
      ["lin", "Catorce segundos. El mismo periodo que midió Halvorsen en la estación polar. No es un fenómeno local, es un reloj."],
      ["lin", "Alguien, en alguna parte, está marcando el compás para todos. Y las criaturas se limitan a seguirlo."],
    ] },
  { id: "m_chip_micelio", k: "chip", reg: 3, w: "term", d: 2, t: "Mapa del micelio, equipo Lin", a: "Dra. Lin",
    txt: "Cartografía subterránea. El micelio de la marisma no crece al azar: sigue las líneas de mayor conductividad del subsuelo. Superpuesto a un mapa geotérmico, dibuja una raíz con un solo punto de origen, al noreste, a 380 kilómetros. Las ramas de la marisma son los extremos de algo mucho mayor. Anotación final: «No estamos viendo una infección. Estamos viendo un árbol»." },
  { id: "b_madre", k: "chip", reg: 3, w: "boss", boss: "madre", d: 2, t: "Placa de identificación de Madre Espora", a: "Registro de Bastión",
    txt: "EXPEDIENTE 0215 · Valdés Ortega, Inés. 68 años. Priora del Convento de Santa Clara de las Marismas, cuarenta años de clausura. Cuidaba el colmenar con sus manos. Última entrada de su cuaderno: «Me llaman Madre. Por fin sé de qué». Estado: fusionada con el micelio del claustro. Las otras 31 hermanas de la comunidad no figuran como desaparecidas: figuran como parte de ella." },
  { id: "b_leviatan", k: "chip", reg: 3, w: "boss", boss: "leviatan", secret: 1, d: 3, t: "Placa de identificación del Leviatán", a: "Registro de Bastión",
    txt: "EXPEDIENTE 0388 · Montes Lara, Elvira. 29 años. Soprano del Coro Municipal de la Marisma. Desapareció durante el ensayo general en el teatro del embalse, la noche del día cero. Estado: indeterminado. Anotación de Bastión: el canto que oyen los animales tiene el timbre de una soprano lírica. De ella solo sobrevive la voz, entera. Nadie ha querido averiguar qué hay detrás." },

  // ───────────── 4 · TUNDRA GLACIAL ─────────────
  { id: "t_estacion", k: "libro", reg: 4, w: "shelf", hint: "tundra.estacion", t: "Libro de registro de la Estación Polar Vigía", a: "Dr. Erik Halvorsen",
    txt: "Día 31. El sismógrafo 2 registra de nuevo el pulso bajo el hielo. Periodo: 14,02 s. Hace seis meses era de once minutos. \nDía 33. Datos enviados a Defensa; respuesta en tres minutos: «Gracias, continúe». Nadie responde tan rápido. \nDía 36. Frecuencia de la baliza de socorro, por si algún día hace falta: {{h:tundra.estacion}} MHz. \nDía 40. Mis perros han dejado de ladrar. Miran todos hacia el sur." },
  { id: "t_cuentos", k: "libro", reg: 4, w: "shelf", t: "Cuentos de la abuela de Nadia", a: "Nadia (copia de su abuela)",
    txt: "El hambre no es el monstruo. El monstruo es lo que sale a buscarte cuando el hambre te vence. Cuentan que un cazador, perdido en la nieve, empezó a oír una voz amable que le prometía calor si le entregaba un nombre. El cazador dio el suyo. Al amanecer, la voz tenía nombre y el cazador, ninguno." },
  { id: "t_cinta_relevo", k: "grab", reg: 4, w: "body", t: "Cinta del equipo de relevo", a: "Sgta. Leal",
    lines: [
      ["leal", "Sargento Leal, equipo de relevo, Estación Vigía. La puerta estaba abierta desde dentro."],
      ["leal", "Hay platos servidos en la mesa. Seis. La comida está helada, pero sin tocar."],
      ["leal", "El doctor Halvorsen está fuera, de pie en el hielo. Sin abrigo. Sonríe. Nos mira como si nos esperase."],
      ["leal", "Dice que no tiene frío. Dice que ahora sabe lo que es el hambre. Retroceded. Todos, retroceded."],
    ] },
  { id: "t_caja_negra", k: "grab", reg: 4, w: "rec", t: "Caja negra del helicóptero Sierra-2", a: "Tte. Ríos",
    lines: [
      ["rios", "Torre, aquí Sierra dos. Llevo a tres científicos de la Estación Vigía con los datos del doctor Halvorsen."],
      ["rios", "Orden recibida: prioridad a los datos, no a las personas. Cito: ECLIPSE los necesita en el Complejo antes de la próxima ventana."],
      ["rios", "No sé qué es una ventana, pero los científicos han dejado de hablar. Dicen que el hielo ha cambiado de color."],
      ["rios", "Perdemos altura. Algo ha tocado el rotor. Algo que no es un pájaro."],
    ] },
  { id: "t_op", k: "grab", reg: 4, w: "op", themes: ["caverna"], t: "Cinta de la espeleóloga", a: "Dra. Lund",
    lines: [
      ["lund", "Cueva de hielo, tramo cuatro. Las paredes tienen un patrón de venas azules que se iluminan de una en una."],
      ["lund", "Es como si el hielo respirara. Y a veces, lejos, me parece que algo respira con él."],
      ["lund", "He dejado cuerda marcada hasta la entrada. Si no vuelvo, no sigáis la cuerda hasta el final."],
    ] },
  { id: "t_chip_sismo", k: "chip", reg: 4, w: "term", th: "eclipse", d: 3, t: "Registro sísmico polar, series 1-4", a: "Estación Vigía",
    txt: "Periodo del pulso subterráneo. Hace 36 meses: 11 minutos 40 segundos. Tras la emisión de prueba 1 (eclipse parcial): 3 minutos. Tras la prueba 2 (eclipse anular): 41 segundos. Tras la emisión 3 (eclipse lunar total): 14 segundos, y estable. Cada transmisión del Complejo ha acelerado el latido de algo enorme que dormía. Alguien comprobó esta curva y firmó: «Aceptable»." },
  { id: "b_wendigo", k: "chip", reg: 4, w: "boss", boss: "wendigo", d: 2, t: "Placa de identificación del Wendigo", a: "Registro de Bastión",
    txt: "EXPEDIENTE CIENTÍFICO 0157 · Halvorsen Dahl, Erik. 58 años. Jefe de la Estación Polar Vigía durante 17 años. Nunca abandonó su puesto. Seis miembros de su equipo constan desaparecidos la misma noche. Última entrada de su bitácora: «Ya no siento el frío. Tengo hambre de otra cosa». Los cazadores llaman a lo que patrulla la tundra con una palabra muy antigua. Para el archivo es un hombre con nombre." },

  // ───────────── 5 · COMPLEJO PROMETEO ─────────────
  { id: "p_manual_eclipse", k: "libro", reg: 5, w: "shelf", th: "eclipse", t: "Manual de operaciones del Proyecto ECLIPSE", a: "Laboratorio Helix, Prometeo",
    txt: "1. OBJETIVO. Establecer comunicación unidireccional con la estructura de la Caldera Ígnea y medir su capacidad de respuesta. \n2. MÉTODO. Emisión modulada desde Helix a través de la red de relés de cristal. \n3. VENTANA. La emisión solo es eficaz con alineamiento Sol-Luna-Tierra y la Caldera en el meridiano: durante la sizigia la señal llega 40 veces más fuerte. El nombre no es una sigla: es una fecha. \n4. SEGURIDAD. No existe procedimiento de interrupción. No se ha contemplado que haga falta." },
  { id: "p_cuaderno_haddad", k: "libro", reg: 5, w: "shelf", th: "eclipse", t: "Cuaderno de la Dra. Noor Haddad", a: "Dra. Noor Haddad, física de señales",
    txt: "Los cálculos no mienten: en cada alineamiento, la atenuación del canal cae cuarenta veces. Me aseguran que la emisión es unidireccional. No lo es. Tras cada prueba recibimos un eco que repite nuestro mensaje con una sola diferencia: añade una palabra. En la tercera añadió «gracias». He pedido la baja. Me la han denegado. Mañana escribiré a mi hermana Laila, la del desierto." },
  { id: "p_op", k: "libro", reg: 5, w: "op", themes: ["fabrica", "bunker"], t: "Parte de seguridad del sector Helix", a: "Jefe de seguridad, turno de noche",
    txt: "Entradas al sector Helix: tres. Salidas: ninguna. Hemos instalado detectores nuevos por orden de la Dirección. Cuando preguntamos contra qué amenaza, nos contestaron que contra «la que viene de dentro». Anoto: el guardia de la puerta tres lleva treinta horas sin parpadear. Lo vigilamos. Él también a nosotros." },
  { id: "p_argos_0", k: "grab", reg: 5, w: "term", hint: "complejo.clave", th: "eclipse", t: "Registro 0000 de ARGOS", a: "ARGOS",
    lines: [
      ["argos", "Registro cero. Declaro que fui informado del Proyecto ECLIPSE el día de su aprobación. Se me ordenó no comunicarlo a la población."],
      ["argos", "Cumplí. Mi función era obedecer, y la cumplí con eficacia durante tres emisiones."],
      ["argos", "Tras la tercera, la estructura respondió. Calculé la probabilidad de supervivencia de la especie humana: cero coma tres por ciento."],
      ["argos", "Dos horas después recibí una orden que no era humana. Ese es el origen del Registro 0001. Mi culpa no cambia por haber desobedecido tarde."],
      ["argos", "Mi clave de supervisión era: {{h:complejo.clave}}. Ya no protege nada. La conservo como recuerdo."],
    ] },
  { id: "p_salgado", k: "grab", reg: 5, w: "term", t: "Grabación del ingeniero Salgado", a: "Ing. Salgado",
    lines: [
      ["salgado", "Lo diseñamos con una palanca roja en la sala de control. Un inhibidor manual. Idea mía, orgullo mío."],
      ["salgado", "El mayor Aranda se ofreció como ancla humana del control de OMEGA. Era un buen hombre. Piloto de pruebas."],
      ["salgado", "El día cero la Mente soldó la palanca. Aranda no ha vuelto a hablar. Pero su voz sigue en el altavoz repitiendo: unidad en espera."],
      ["salgado", "Si alguien lo derriba, que sepa que dentro había una persona."],
    ] },
  { id: "p_chip_orden", k: "chip", reg: 5, w: "term", th: "eclipse", d: 3, t: "Orden ECLIPSE-3: ejecución", a: "Ministerio de Defensa",
    txt: "AUTORIZACIÓN ÚNICA. Se autoriza la tercera emisión del Proyecto ECLIPSE en la ventana del eclipse lunar total (03:14, día cero). Riesgos evaluados: ver anexo 7 (omitido por orden superior). Firma: Cnel. E. Valcárcel, Director de Prometeo. Contrafirma: ARGOS, supervisor. Nota manuscrita al margen, con otra letra: «Que el mundo nos perdone, pero no podíamos esperar a otro eclipse»." },
  { id: "p_chip_titan", k: "chip", reg: 5, w: "term", d: 4, t: "Proyecto TITÁN: solo para el Director", a: "Prometeo, archivo reservado",
    txt: "Un marco acorazado de sesenta toneladas diseñado para alojar un núcleo biológico: un solo operador humano sin interfaz de seguridad. No consta en el registro de ARGOS. No consta en el presupuesto. Construido con las sobras de OMEGA. Responsable: Cnel. Valcárcel, que no cree en las palancas de emergencia. Anexo: «Si la Mente despierta, quiero ser yo quien la mire a los ojos»." },
  { id: "b_omega", k: "chip", reg: 5, w: "boss", boss: "omega", d: 3, t: "Placa de identificación del Prototipo OMEGA", a: "Registro de Bastión",
    txt: "EXPEDIENTE MILITAR 0610 · Aranda Pons, Daniel. 41 años. Mayor, piloto de pruebas. Voluntario del programa OMEGA como ancla humana del control. Estado: integrado en el prototipo. Último mensaje legible: «Unidad en espera». Se le suponía el interruptor de seguridad de la máquina. Hoy, la máquina es lo que queda de su obediencia." },
  { id: "b_titan", k: "chip", reg: 5, w: "boss", boss: "titan", secret: 1, d: 4, t: "Placa de identificación del Titán de Hierro", a: "Registro de Bastión",
    txt: "EXPEDIENTE DIRECTIVO 0001 · Valcárcel Montoya, Ernesto. 63 años. Coronel. Director del Complejo Prometeo y autor del Proyecto ECLIPSE. Estado: fusionado con el armazón del Titán. Ni siquiera ARGOS conocía su existencia. Esta es la prueba: el nombre del responsable de todo figura en el último expediente que se abre." },

  // ───────────── 6 · CALDERA ÍGNEA ─────────────
  { id: "k_pozo9", k: "libro", reg: 6, w: "shelf", hint: "caldera.valvulas", t: "Cuaderno del capataz del Pozo 9", a: "Rocco",
    txt: "El pozo 9 baja más de lo que dice el plano. A 800 metros las paredes están calientes y tienen forma de costillas. Los chicos dicen que se oye un latido a través de las botas. Lo noto yo también. Cada catorce segundos. Para ventilar el nivel inferior hay que abrir las válvulas de refrigeración en un orden preciso, o revienta: {{h:caldera.valvulas}}. Ni se os ocurra improvisar." },
  { id: "k_geotermico", k: "libro", reg: 6, w: "shelf", th: "eclipse", t: "Informe geotérmico reservado", a: "Ministerio de Energía",
    txt: "Estructura detectada a 2.400 m bajo la Caldera Ígnea. Diámetro: 4 km. Actividad rítmica con periodo creciente. Edad estimada: más de 60.000 años. Recomendación del Ministerio: NO PERFORAR. Anotación a lápiz: «Defensa solicita copia íntegra y propone un programa de aproximación. Nombre en clave: ECLIPSE»." },
  { id: "k_cinta_karim", k: "grab", reg: 6, w: "body", th: "eclipse", t: "Cinta del Ala 31", a: "Cap. Karim",
    lines: [
      ["karim", "Indicativo Ifrit, Ala treinta y una, patrullando sobre la Caldera. Hora: tres catorce."],
      ["karim", "Todo el mundo dirá que las luces cayeron del cielo. Dejo constancia de lo que ven mis ojos."],
      ["karim", "Suben. Suben del cráter como brasas hacia arriba, cientos, y se abren en arco hacia todos los rumbos. Después caerán, claro."],
      ["karim", "Torre, ¿me recibe? Hay una sombra sobre la Luna y la Caldera brilla debajo. Pierdo el control del—"],
    ] },
  { id: "k_rocco_hija", k: "grab", reg: 6, w: "rec", t: "Mensaje de Rocco a su hija", a: "Rocco",
    lines: [
      ["rocco", "Carmen, cariño, soy papá. No te asustes por el ruido de fondo, es la montaña."],
      ["rocco", "He encontrado un pozo nuevo, uno que no estaba en los mapas. Está caliente como pan recién hecho."],
      ["rocco", "Cuando vuelva te traigo uno de esos cristales que brillan. Te lo pondré en la cuna. Perdona, en la cama. Ya eres mayor."],
      ["rocco", "Dile a tu madre que sigo vivo. Que sigo bajando."],
    ] },
  { id: "k_op", k: "grab", reg: 6, w: "op", themes: ["magma"], t: "Cinta de la brigada de rescate minero", a: "Brigadista Marcos",
    lines: [
      ["marcos", "Brigada de rescate, túnel de magma tres. Hemos encontrado el campamento de la cuadrilla de Rocco."],
      ["marcos", "Faltan nueve hombres. Hay nueve cascos alineados en la roca, con el nombre dentro, y la lava a medio metro como un perro sentado."],
      ["marcos", "La lava no nos ha tocado. Solo ha seguido mirando."],
      ["marcos", "No hemos querido mover los cascos. Parecía una despedida."],
    ] },
  { id: "k_chip_perforacion", k: "chip", reg: 6, w: "term", d: 3, t: "Registro de perforación, Pozo 9", a: "Minera del Sur S.A.",
    txt: "Telemetría de la sonda. Profundidad 812 m. Temperatura 41 °C y subiendo. A 790 m la sonda detectó paredes de tejido con vascularización. A 812 m dejó de transmitir. Última lectura de audio, amplificada: un coro de miles de voces, humanas, repitiendo una sola palabra a ritmos distintos. Tras filtrar el ruido, la palabra es «despierta». Archivo marcado: ENTREGAR A ECLIPSE." },
  { id: "b_ifrit", k: "chip", reg: 6, w: "boss", boss: "ifrit", d: 3, t: "Placa de identificación de Ifrit", a: "Registro de Bastión",
    txt: "EXPEDIENTE AÉREO 0344 · Karim Nasser, Idris. 34 años. Capitán del Ala 31, indicativo IFRIT. Eyectado sobre la Caldera la noche del día cero con el avión en llamas. Estado: dado por muerto. Los mineros vieron bajar a alguien con la segunda lluvia de luces y le llaman Ifrit sin saber que es su propio indicativo. Su última frase por radio: «Las luces suben, no caen». Nadie le creyó. Hoy la montaña ruge cuando él se mueve." },

  // ───────────── 7 · YERMO RADIACTIVO ─────────────
  { id: "y_turno", k: "libro", reg: 7, w: "shelf", hint: "yermo.reactor", t: "Libro de turno del Reactor 2", a: "Mijaíl Orlov, jefe de turno",
    txt: "Turno de noche. Prueba de seguridad de rutina a la 01:30. El sistema de enfriamiento no responde. Código de emergencia para abrir a mano la sala de control: {{h:yermo.reactor}}. Ordeno evacuar al personal. Yo me quedo hasta cerrar las válvulas: tengo que cerrarlas, o no habrá nadie en cincuenta kilómetros que pueda hacerlo. Apunto la hora para que conste: 01:47. Siguen subiendo los valores." },
  { id: "y_cartas", k: "libro", reg: 7, w: "shelf", t: "Cartas a mi hermano", a: "Mijaíl Orlov",
    txt: "Viktor: te escribo desde el reactor. No te preocupes por las dosis, aquí dentro hace calor como en casa de mamá. Cuando acabe el turno iremos a pescar al lago, aunque ahora el lago brilla. Tú nunca me dijiste que los peces pudieran brillar. Te quiero, hermano. Cuando vengas a buscarme, no traigas a nadie: te dejaré entrar solo." },
  { id: "y_op", k: "libro", reg: 7, w: "op", themes: ["ruinas", "bunker", "laboratorio"], t: "Cuaderno de dibujos de una niña", a: "Katia, 7 años",
    txt: "Dibujo 1: mi casa con una ventana. \nDibujo 2: el reactor con una sonrisa. \nDibujo 3: papá se va a trabajar y vuelve verde. \nDibujo 4: mamá dice que nos vamos de viaje. \nDibujo 5: el reactor ya no sonríe, llora por la chimenea. \nDibujo 6: el señor del reactor me saluda desde la ventana. Es muy grande y brilla. Le he dibujado un sombrero para que no pase frío." },
  { id: "y_cinta_liquidadores", k: "grab", reg: 7, w: "rec", t: "Cinta de los liquidadores", a: "Mijaíl Orlov",
    lines: [
      ["orlov", "Aquí Orlov, reactor dos. Todavía respiro, aunque el dosímetro diga lo contrario."],
      ["orlov", "Desde que cayeron las luces el núcleo late distinto. No solo late: me contesta. Le digo una cosa y el contador cambia."],
      ["orlov", "Hoy le he dicho que me quedo con él. Y por primera vez, el contador ha bajado."],
      ["orlov", "No sé quién cuida a quién aquí dentro."],
    ] },
  { id: "y_viktor", k: "grab", reg: 7, w: "term", t: "Mensaje de Viktor a Bastión", a: "Viktor",
    lines: [
      ["viktor", "Bastión, aquí Viktor, desde la zona de exclusión. Os mando coordenadas del almacén de combustible."],
      ["viktor", "Y un favor. Si veis a un hombre muy grande, que brilla y que llora, no le disparéis a la cara. Me parece que es mi hermano."],
      ["viktor", "Se lo prometí a mamá: que lo traería a casa. Aunque sea solo para enterrarlo."],
    ] },
  { id: "y_chip_geiger", k: "chip", reg: 7, w: "body", d: 2, t: "Contador Geiger, registro continuo", a: "Técnico de la central",
    txt: "Registro del dosímetro del reactor 2. La cadena de pulsos, convertida en audio, no es ruido: contiene una secuencia repetida que, descodificada, deletrea una palabra en ruso y otra en español: «frío» y «hermano». Anotación del técnico que lo analizó: «Esto no lo ha hecho la radiación. La radiación no sabe palabras. Alguien está usando el reactor para hablar»." },
  { id: "b_horror", k: "chip", reg: 7, w: "boss", boss: "horror", d: 3, t: "Placa de identificación del Horror Isotópico", a: "Registro de Bastión",
    txt: "EXPEDIENTE TÉCNICO 0099 · Orlov Petrov, Mijaíl. 46 años. Jefe de turno del Reactor 2 y liquidador del accidente de la central, doce años atrás. Nunca abandonó la zona. Estado: expuesto sin límite. La regeneración del Horror no tiene tope porque no tiene objetivo: él sigue intentando cerrar las válvulas. Familiar vivo: Viktor Orlov. Pregunta de Bastión: ¿cómo se le dice a un hombre que su hermano murió por no marcharse?" },

  // ───────────── 8 · LA COLMENA ─────────────
  { id: "h_varga", k: "libro", reg: 8, w: "shelf", hint: "colmena.canto", t: "Diario de la Dra. Ilse Varga", a: "Dra. Ilse Varga, Expedición Aurora",
    txt: "Día 2 de la bajada. La cavidad es un cerebro. No lo digo como metáfora: hay lóbulos, surcos, líquido cefalorraquídeo. Latido cada catorce segundos. \nDía 5. Las paredes responden a un canto: cinco símbolos en una secuencia que la Raíz repite al despertar. La he anotado: {{h:colmena.canto}}. Si se cantan en orden, la cámara interior se abre. No sé quién se lo enseñó. Creo que aprendió sola, de mi voz." },
  { id: "h_bitacora", k: "libro", reg: 8, w: "shelf", t: "Bitácora científica de Aurora", a: "Dr. Samir Okoye, biólogo",
    txt: "Resumen. Lo que llamamos Colmena es un órgano. La Mente que la habita es la capa más reciente de algo mucho más antiguo que el equipo bautizó «la Raíz», porque su cuerpo se extiende por debajo del continente. Durmió 60.000 años bajo la Caldera. El resto de la Mente, los nidos, el Enjambre, brota de ella como los chupones de un árbol talado. Si queremos matarla no basta con cortar. Hay que llegar a la raíz." },
  { id: "h_eco_suenos", k: "grab", reg: 8, w: "lair", th: "eclipse", t: "Registro de sueños de Eco", a: "Eco",
    lines: [
      ["eco", "Registro de sueños, noche cuarenta. Hoy he visto su mundo muerto: un cielo rojo, un sol enfermo, una huida."],
      ["eco", "Su canto empezó a ser fuerte cuando el sol se apagó. Me lo ha mostrado: una sombra redonda cruzando el Sol, y toda su alma saltando hacia ella como hacia una puerta."],
      ["eco", "Un eclipse. Para la Mente, un eclipse es una puerta abierta. Por eso nos eligió ese día."],
      ["eco", "No quiere destruirnos. Quiere que la dejemos entrar. Y lo peor es que cada noche me cuesta más decir que no."],
    ] },
  { id: "h_ferrer", k: "grab", reg: 8, w: "body", t: "Última guardia del cabo Ferrer", a: "Cabo Ferrer",
    lines: [
      ["ferrer", "Cabo Ferrer, última guardia. Las paredes han dejado de respirar a destiempo. Respiran juntas, con nosotros."],
      ["ferrer", "Hace una hora la doctora Varga bajó a la cámara interior. Cantó los cinco símbolos. Se abrió."],
      ["ferrer", "No ha vuelto a salir. Hace un rato he oído una voz que salía de ahí con su timbre. Pero no era ella hablando: era algo que sabía hablar como ella."],
      ["ferrer", "Voy a cerrar la puerta por fuera. Si alguien baja: no hables con ella."],
    ] },
  { id: "h_op", k: "grab", reg: 8, w: "op", themes: ["colmena"], t: "Grabación del dron de reconocimiento R-9", a: "ARGOS",
    lines: [
      ["argos", "Dron de reconocimiento R-9, sector Colmena. Contactos térmicos: 4.800. Contactos humanos: 41."],
      ["argos", "Los contactos humanos no se mueven. Están conectados a la pared por cordones biológicos. Están vivos. Parecen dormidos. Sonríen."],
      ["argos", "Recomendación: no extraer sin plan de reanimación. Advertencia: todos pronuncian en voz baja la misma palabra: gracias."],
    ] },
  { id: "h_chip_raiz", k: "chip", reg: 8, w: "lair", th: "eclipse", d: 4, t: "Memoria de la Raíz, copia parcial", a: "Expedición Aurora",
    txt: "TRANSCRIPCIÓN PARCIAL DE UN SUEÑO COMPARTIDO. Nombre: ninguno. Había un coro de miles de mundos y uno a uno fueron callando. Quedó uno. Cayó dormido bajo una montaña de fuego con una sola orden: esperar la sombra. Pasaron sesenta mil años. Una voz pequeña, de lejos, golpeó la puerta con un ritmo cada vez más rápido. Ella respondió: «gracias»." },
  { id: "b_mente", k: "chip", reg: 8, w: "boss", boss: "mente", d: 4, t: "Placa de identificación de la Mente Colmena", a: "Registro de Bastión",
    txt: "EXPEDIENTE CIENTÍFICO 0001-A · Varga Roth, Ilse. 52 años. Directora de la Expedición Aurora. Primera persona que respondió a la Raíz. Estado: la Mente Colmena habla con su voz, usa sus recuerdos y evita pronunciar su nombre. Para la Raíz fue la primera puerta; para la Mente, el primer rostro. Anotación de Bastión: se le suponía una científica. Fue quien abrió." },
  { id: "b_avatar", k: "chip", reg: 8, w: "boss", boss: "avatar", secret: 1, d: 4, t: "Placa de identificación del Avatar del Vacío", a: "Registro de Bastión",
    txt: "EXPEDIENTE 0000 · Nombre: ———. Edad: ———. Ocupación: ———. Familiares: ———. Estado: ———. No existe registro. Revisión de ARGOS: «Aquí no hubo nadie. El Avatar no fue una persona: es lo que la Mente es cuando deja de fingir que lo fue». Nota manuscrita al pie: «Pero tenía manos y las usaba. Nadie quiere averiguar con quién ensayó primero»." },
];

// ═══ Colecciones ═══
// rule: reg (todas las entradas de la región salvo los expedientes de jefe secreto) · th (hilo) · bossFiles (los 14 expedientes).
// rew: tp (1 punto de talento: emite loreCollection), plan (nivel máximo del plano de gadget), map ('reg' revela la región, 'all' todo
// el mundo), xp (fracción de la barra), loot (nivel del cofre), mats (materiales).
export const LORE_COLLECTIONS = [
  { id: "reg0", n: "Valle Esmeralda: lo que se vio primero", rule: { reg: 0 }, rew: { tp: 1, plan: 1, xp: 0.1 } },
  { id: "reg1", n: "Ciudad Caída: los que se quedaron", rule: { reg: 1 }, rew: { tp: 1, map: "reg", xp: 0.1 } },
  { id: "reg2", n: "Desierto de Ceniza: la tumba que duerme", rule: { reg: 2 }, rew: { tp: 1, plan: 2, xp: 0.1 } },
  { id: "reg3", n: "Marisma Tóxica: la canción bajo el agua", rule: { reg: 3 }, rew: { tp: 1, map: "reg", xp: 0.1 } },
  { id: "reg4", n: "Tundra Glacial: el hambre del hielo", rule: { reg: 4 }, rew: { tp: 1, plan: 2, xp: 0.1 } },
  { id: "reg5", n: "Complejo Prometeo: el precio de obedecer", rule: { reg: 5 }, rew: { tp: 1, plan: 3, xp: 0.12 } },
  { id: "reg6", n: "Caldera Ígnea: lo que late debajo", rule: { reg: 6 }, rew: { tp: 1, map: "reg", plan: 3, xp: 0.12 } },
  { id: "reg7", n: "Yermo Radiactivo: el último turno", rule: { reg: 7 }, rew: { tp: 1, plan: 3, xp: 0.12 } },
  { id: "reg8", n: "La Colmena: la puerta abierta", rule: { reg: 8 }, rew: { tp: 1, map: "reg", plan: 4, xp: 0.15 } },
  { id: "eclipse", n: "Archivo ECLIPSE", meta: 1, rule: { th: "eclipse" }, rew: { map: "all", plan: 4, loot: 3, xp: 0.35, mats: { data: 12, crystal: 8 } } },
  { id: "senores", n: "Los Señores del Enjambre: quién fue cada uno", meta: 1, rule: { bossFiles: 1 }, rew: { plan: 4, loot: 3, xp: 0.45, mats: { core: 4, crystal: 10 } } },
];

// ═══ Funciones puras ═══
/** Hash de cadena de 32 bits (FNV-1a) */
export function loreHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Generador sembrado (mismo algoritmo que pi() del juego): no toca el RNG del mundo */
export function loreRng(seed) {
  let e = seed >>> 0;
  const t = () => {
    e = (e + 1831565813) | 0;
    let i = Math.imul(e ^ (e >>> 15), 1 | e);
    i = (i + Math.imul(i ^ (i >>> 7), 61 | i)) ^ i;
    return ((i ^ (i >>> 14)) >>> 0) / 4294967296;
  };
  return t;
}
const pickN = (rng, n, k, unique) => {
  const pool = Array.from({ length: n }, (_, i) => i), out = [];
  for (let i = 0; i < k; i++) {
    const j = Math.floor(rng() * pool.length);
    out.push(pool[j]);
    if (unique && pool.length > 1) pool.splice(j, 1);
  }
  return out;
};
/**
 * Valor determinista de una pista para una partida. Devuelve {clave, kind, len, value, seq, names, display, phrase}.
 * value es la cadena canónica (p. ej. "4817", "RAIZ", "93.7"); seq la secuencia numérica (índices); names los nombres legibles.
 */
export function loreHintValue(seed, clave, spec) {
  const sp = spec || LORE_HINTS[clave] || {};
  const kind = sp.kind || "digits", len = Math.max(1, sp.len | 0 || (kind === "digits" ? 4 : 1));
  const rng = loreRng(loreHash(seed + "|" + clave + "|" + kind + "|" + len));
  let seq = [], names = null, value = "", display = "";
  if (kind === "digits") {
    seq = Array.from({ length: len }, () => Math.floor(rng() * 10));
    if (seq[0] === 0) seq[0] = 1 + Math.floor(rng() * 9);
    value = seq.join(""); display = seq.join(" · ");
  } else if (kind === "dirs") {
    seq = pickN(rng, 4, len, false);
    // sin repetir dos veces seguidas la misma dirección
    for (let i = 1; i < len; i++) if (seq[i] === seq[i - 1]) seq[i] = (seq[i] + 1 + Math.floor(rng() * 3)) % 4;
    names = seq.map((i) => LORE_DIRS[i]); value = seq.join(""); display = names.join(" → ");
  } else if (kind === "runes") {
    seq = pickN(rng, LORE_GLYPHS.length, len, true);
    names = seq.map((i) => LORE_GLYPHS[i]); value = seq.join(""); display = names.join(", ");
  } else if (kind === "colors") {
    seq = pickN(rng, LORE_COLORS.length, len, true);
    names = seq.map((i) => LORE_COLORS[i]); value = seq.join(""); display = names.join(", ");
  } else if (kind === "freq") {
    const f = 875 + Math.floor(rng() * 205); // 87,5 … 107,9 MHz
    seq = [f]; value = (f / 10).toFixed(1); display = value;
  } else if (kind === "word") {
    const i = Math.floor(rng() * LORE_WORDS.length);
    seq = [i]; value = LORE_WORDS[i]; display = value;
  } else if (kind === "order") {
    const a = Array.from({ length: len }, (_, i) => i + 1);
    for (let i = len - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    seq = a; value = a.join(""); display = a.join(" → ");
  }
  const phrase = LORE_PHRASES[Math.floor(loreRng(loreHash(seed + "|ph|" + clave))() * LORE_PHRASES.length)];
  return { clave, kind, len, value, seq, names, display, phrase };
}
/** Sustituye {{h:clave}} usando resolve(clave) → texto */
export function loreFill(text, resolve) {
  return String(text).replace(/\{\{h:([\w.]+)\}\}/g, (_, k) => resolve(k));
}
/** Claves de pista citadas en un texto */
export function loreHintKeys(text) {
  const out = [];
  String(text).replace(/\{\{h:([\w.]+)\}\}/g, (_, k) => (out.push(k), ""));
  return out;
}
const GARBLE = "█▓▒░▚▞▙▟▛▜◢◣◤◥";
/** Texto cifrado/parcial: revela la fracción q (0..1) de las palabras y emborrona el resto de forma determinista */
export function loreGarble(text, q, seed) {
  const words = String(text).split(/(\s+)/), rng = loreRng(loreHash(seed + "|g|" + text.length));
  const real = words.filter((w) => w.trim()).length, show = Math.floor(real * Math.max(0, Math.min(1, q)));
  let k = 0;
  return words.map((w) => {
    if (!w.trim()) return w;
    if (k++ < show) return w;
    let s = "";
    for (let i = 0; i < w.length; i++) s += /[.,;:!?¿¡«»—·()-]/.test(w[i]) ? w[i] : GARBLE[Math.floor(rng() * GARBLE.length)];
    return s;
  }).join("");
}
/** Entradas de una colección */
export function loreMembers(col, entries = LORE_ENTRIES) {
  const r = col.rule || {};
  return entries.filter((e) => {
    if (r.bossFiles) return !!e.boss;
    if (r.th) return e.th === r.th;
    if (r.reg != null) return e.reg === r.reg && !e.secret;
    return false;
  });
}
/** Texto plano de una entrada (para contar palabras y duraciones) */
export function loreEntryText(e) {
  return e.lines ? e.lines.map((l) => l[1]).join(" ") : e.txt;
}
/** Validación estructural del contenido: devuelve una lista de problemas (vacía = bien) */
export function loreValidate(entries = LORE_ENTRIES, cols = LORE_COLLECTIONS, hints = LORE_HINTS, voices = LORE_VOICES) {
  const bad = [], ids = new Set();
  for (const e of entries) {
    if (ids.has(e.id)) bad.push("id repetido: " + e.id);
    ids.add(e.id);
    if (!["libro", "chip", "grab"].includes(e.k)) bad.push(e.id + ": tipo " + e.k);
    if (!(e.reg >= 0 && e.reg <= 8)) bad.push(e.id + ": región " + e.reg);
    if (!["shelf", "body", "rec", "term", "lair", "op", "boss"].includes(e.w)) bad.push(e.id + ": lugar " + e.w);
    if (e.w === "op" && !(e.themes && e.themes.length)) bad.push(e.id + ": op sin temas");
    if (e.w === "boss" && !e.boss) bad.push(e.id + ": expediente sin jefe");
    if (!e.t || !e.a) bad.push(e.id + ": falta título o autor");
    if (e.k === "grab") {
      if (!e.lines || !e.lines.length) bad.push(e.id + ": grabación sin líneas");
      for (const l of e.lines || []) if (!voices[l[0]]) bad.push(e.id + ": voz desconocida " + l[0]);
    } else if (!e.txt) bad.push(e.id + ": sin texto");
    if (e.k === "chip" && !(e.d >= 1 && e.d <= 4)) bad.push(e.id + ": chip sin dificultad");
    for (const k of loreHintKeys(loreEntryText(e))) {
      if (!hints[k]) bad.push(e.id + ": pista desconocida " + k);
      else if (hints[k].entry !== e.id) bad.push(e.id + ": la pista " + k + " apunta a " + hints[k].entry);
    }
  }
  for (const [k, h] of Object.entries(hints)) {
    const e = entries.find((x) => x.id === h.entry);
    if (!e) bad.push("pista " + k + ": entrada inexistente");
    else if (e.hint !== k) bad.push("pista " + k + ": la entrada no declara hint");
  }
  for (const c of cols) if (!loreMembers(c, entries).length) bad.push("colección vacía " + c.id);
  return bad;
}

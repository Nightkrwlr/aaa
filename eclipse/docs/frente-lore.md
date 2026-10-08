# Frente LORE (D5): libros, chips cifrados y grabaciones con voz

Fragmento: `src/game/31d-lore.js` (motor, UI, voz) · contenido y funciones puras: `src/engine/lore-data.js` (importado por `src/game/_prelude.lore.js`).
Pruebas: `tools/scenarios/lore-demo.mjs`, `lore-ui.mjs`, `lore-migrate.mjs`, `lore-mapa.mjs`, `lore-perf.mjs`, `lore-ops.mjs` (las 13 combinaciones región/tema de operación), `lore-hackeo-integracion.mjs` (Archivo + HACKEO reales, ratón o toques) y `tools/sim/lore.mjs`.

## Estado

**Hecho**
- **70 entradas nuevas en español** (25 libros, 22 grabaciones, 23 chips; ≈ 4 600 palabras) más los 45 registros de datos antiguos de `16-story.js`, que siguen funcionando.
  Tono de ciencia ficción militar sobrio; la «biblia» está al principio de `lore-data.js`:
  - Hace 60.000 años algo durmió bajo la Caldera Ígnea («la Raíz»; la Mente Colmena es su brote). Los monolitos de cristal negro del desierto son su red de relés.
  - **Proyecto ECLIPSE** (Laboratorio Helix, Complejo Prometeo): emisiones durante los eclipses (la señal llega ×40 más fuerte con el alineamiento Sol-Luna-Tierra). Cada una aceleró el latido
    de la Raíz (11 min → 3 min → 41 s → 14 s). La tercera fue el eclipse lunar de las 03:14 del día cero. **ARGOS lo sabía desde el primer día** y calló por obediencia (Registro 0000).
  - Las luces **subieron** de la Caldera y cayeron en arco (grabación del capitán Karim); el centro del anillo de caída es la Caldera (parte de Reyes).
  - **Los Señores del Enjambre fueron personas con nombre:** cada uno de los 14 jefes (9 principales + 5 secretos) tiene su expediente «quién fue» (Ana Ferreiro, Gregorio Salas, Yusuf Karsa, Inés Valdés,
    Erik Halvorsen, Daniel Aranda, Idris Karim, Mijaíl Orlov, Ilse Varga; Aurelio Beltrán, Hamid ibn Salim, Elvira Montes, Ernesto Valcárcel; y el Avatar, «sin nombre»). Se recuperan al abatir al jefe, cifrados.
  - 15 documentos forman el hilo ECLIPSE (colección «Archivo ECLIPSE»).
- **Dónde aparecen** (generador propio sembrado por partida, `S.lore.seed`; no usa `Lt/Q/Rt/Yt` ni toca terreno, props o entidades del mundo):
  estanterías contra la pared (junto a mesas, camas, taquillas y ordenadores), cadáveres (junto a sacos de arena, coches, huesos…), equipos de radio (junto a antenas, generadores, cajas), guaridas (junto a un nido),
  terminales hackeables (el aviso lleva «◈» y el archivo cae al hackearla bien) y operaciones/mazmorras (un documento por mapa generado, según región y tema: búnker, laboratorio Helix, alcantarillado, caverna, magma, colmena…).
- **Chips cifrados:** se recogen cifrados y se descifran con hackeo: `x.hackApi.run({kind:'chip',…}, cb)` si existe el frente de HACKEO; si no, con un minijuego de terminal del juego base
  (`db`, dificultad 1-4 según el chip). Cada fallo deja el chip un 15 % más legible (nunca se bloquea). Los expedientes de jefe son chips.
- **Grabaciones con voz sintetizada y subtítulos:** síntesis formántica de «radio de campaña» en WebAudio (sin red, sin muestras), una voz por hablante (21 voces: tono, velocidad, formantes, aspereza; ARGOS monótona y metálica).
  Subtítulos no modales (el juego sigue), palabra a palabra; tocar el subtítulo la detiene. Opción de voz del sistema (`speechSynthesis`, solo voces españolas locales). `ae.speak(texto, hablante)` queda disponible para otros frentes.
- **Archivo (tecla `L`, botón táctil `ARCH.` con punto de novedades, pestaña «Archivo (L)» del Diario):** panel propio con **Libros · Chips · Grabaciones · Colecciones · Hitos · Diario ▸** (el Archivo antiguo:
  crónica, bestiario, regiones, personajes, registros; gana una pestaña para volver). Lista por región con huecos «???» que dicen dónde buscar, lector con ‹ ›, grabación con reproducción y línea resaltada,
  chip emborronado según su legibilidad, pistas anotadas.
- **Colecciones (11):** una por región (6-8 entradas; los expedientes de jefes secretos no cuentan) con recompensa **1 punto de talento** (`ee('loreCollection', id, nombre)`, que ya espera TALENTOS) más
  **plano de gadget** (`gadgetPlanDrop('loreN')`) y/o **mapa de la región revelado**; y dos grandes: «Archivo ECLIPSE» (15) y «Los Señores del Enjambre» (14 expedientes), con mapa completo, planos nivel 4, cofre de nivel 3, materiales y XP.
  Los chips cuentan al descifrarlos.
- **Pistas de puzle:** `x.loreApi.hintFor(clave)` devuelve valores deterministas por partida (dígitos, direcciones, glifos, colores, frecuencias, palabras, órdenes). 9 pistas ya están escritas dentro de libros y grabaciones
  (`{{h:clave}}` se sustituye al leer) y quedan anotadas en el Archivo al leerlas.
- **Instinto (Cazador):** con `S.talentFx.chestSense > 0` los nodos pulsan en el mundo y salen como puntos en el minimapa. Sin talento, un «latido» suave avisa a ≤ 13 m.

**Guardado** (`S.lore`, `S.loreV = 1`, migración idempotente en `x.migrations`): `{pads, f, r, d, tr, h, c, pm, seed, o}` = registros antiguos · hallados · leídos · calidad de descifrado · intentos · pistas anotadas ·
colecciones cobradas · mapas pendientes · semilla · opciones. `S.lore` antes era una lista de índices: el objeto lleva `length/includes/push/indexOf` **no enumerables** que apuntan a `S.lore.pads`, de modo que
`takeDatapad` (26-spawner) y la pestaña «Registros» (29-panels) funcionan sin cambios y el JSON no los lleva.

## Números medidos

Todo medido en esta máquina (GL por software, compartida con otros agentes) con `tools/sim/lore.mjs` y los escenarios. Nada de lo de abajo está estimado.

| qué | cifra |
|---|---|
| Contenido | 70 entradas: 25 libros · 23 chips · 22 grabaciones; 4 599 palabras (libros 1 625 · chips 1 470 · grabaciones 1 504); por región 8·9·7·8·7·9·7·7·8 |
| Tiempo de consumo | leer libros y chips a 200 palabras/min ≈ 15,5 min; escuchar las 22 grabaciones ≈ 11,2 min (media 30,4 s; de 22,5 a 48,5 s) |
| Reparto | 47 entradas de mundo por partida (37 nodos + 10 en terminales) + 9 de operación/mazmorra + 14 expedientes de jefe = 70. En 60 semillas: 0 caídas al respaldo aleatorio, 0 inalcanzables, 0 fuera de su región |
| Distancias | separación mínima entre nodos de una región 26,1 m (vecino más cercano de media 70,5 m); mínimo a la base 30,2 m; con otra semilla el 96 % de las entradas se mueve > 6 m |
| Ruta | recorrido voraz por las 9 regiones ≈ 3,60 km ≈ 11,5 min andando a 5,2 m/s, sin combate |
| Pistas | 9 claves deterministas; valores distintos en 200 semillas: 196 · 88 · 186 · 156 · 138 · 24 · 24 · 200 · 195 (el 24 de `complejo.clave` es el tamaño de su lista de palabras; el de `caldera.valvulas`, 4! = 24, el máximo posible) |
| Voz (render fuera de línea, 22 050 Hz) | rms 0,096-0,138 · pico máximo 0,96 (ARGOS; el bus `dr`/compresor del juego deja margen) · modulación silábica 4,6-5,7 Hz · 0 muestras no finitas |
| XP | las 70 entradas valen 1,63 % del XP de los niveles 1-60 y las recompensas de colección 2,16 %: 3,78 % en total (los 45 registros antiguos, 0,84 %); la curva de ECONOMÍA reserva ≈ 25-35 % a todo lo que no es matar, así que el lore no la desequilibra |
| Recompensas | 11 colecciones: 9 puntos de talento (TALENTOS esperaba ≈ 8) · 9 planos de gadget · 5 mapas revelados |
| CPU | colocación completa del mundo 0,77 ms (solo al cargar la partida); barrido por fotograma 0,2 µs; cada nodo cercano son 2 llamadas de dibujo (el escenario lo mide con la escena congelada) |
| Render | tour-lite con `api.perf()` en 9 paradas: 3 135 llamadas de dibujo sin lore frente a 3 124 con lore (ruido de animación; sin regresión), 3,05 M frente a 3,00 M triángulos |
| Mapa | hash de terreno, regiones, bloqueos, props, decorado, entidades (sin nodos de lore) y POIs **idéntico** al de la build anterior; `mapV` sigue en 3 |
| Tamaño | artefacto minificado 12,52 MB → 12,61 MB (+≈ 90 KB, todo texto y código; ningún recurso binario) |

Escenarios que pasan (todos con la build final, salvo lo indicado): `lore-demo` 29 comprobaciones · `lore-ui` 17 comprobaciones en Pixel 7 apaisado y otras 17 en vertical · `lore-migrate` 6 · `lore-mapa` (mapa idéntico) ·
humo 13/13 con la build minificada · `tools/sim/lore.mjs` todas. Regresión de otros frentes contra la build nueva: `economia-escenas` 16/16, `economia-migracion` 6/6, `talents-revision`, `gadgets-migrate`,
`talents-ui` 17/17 y `gadgets-demo` 15/16.

## Pendiente / no probado (honestidad)

- **La voz no se ha escuchado.** El entorno no tiene audio: la síntesis se valida con métricas de señal (finita, nivel, ritmo silábico, sin saturación) y con los `.wav` que escribe la simulación, no de oído. Es una voz de
  «radio de campaña» que dibuja el ritmo del castellano, no habla inteligible: el sentido lo dan los subtítulos. La opción «voz del sistema» (`speechSynthesis`, solo voces locales en español) no se ha podido probar
  en este entorno: el código la ofrece solo si el navegador trae una voz local española y, si no, usa la voz de radio.
- **`x.hackApi` real:** ya probado con el frente HACKEO fusionado (ver «Revisión integrada» más abajo). El Archivo entiende `cb(res)` con `res = {ok, q, abortado?, …}`; con la build sin HACKEO sigue el minijuego de reserva del juego base (`db`).
- **Jefes:** los expedientes se prueban emitiendo `bossKilled` (el evento real que emite el juego), no abatiendo jefes de verdad.
- **Instinto:** probado el dibujo de puntos en el minimapa con un contexto 2D falso; no se ha visto el pulso de anillos en el mundo con el talento comprado de verdad.
- **Dispositivos:** solo Pixel 7 (apaisado y vertical) y escritorio; no se han probado iPhone ni tableta, ni toques reales sobre el lector con inercia.
- **Operaciones:** las 13 combinaciones región/tema se recorren de verdad con `lore-ops.mjs` (una semilla de mapa por combinación; nodo único, dentro del mapa, libre, alcanzable por BFS desde la entrada, recogible y sin restos al volver).
- **Problemas ajenos encontrados** (hallados en la revisión): `tools/scenarios/talents-ui.mjs` no compilaba en el commit base (un comentario `//` se comía el final de la línea 19); arreglado en la revisión integrada.
  `gadgets-demo` falla «la explosión no daña al jugador» con la build base (`enemies: 3` tras 70 pasos: spawn del mundo, no daño): ver el resultado de la revisión.

## Contratos (API pública para otros frentes)

`x.loreApi` (siempre presente; los demás frentes lo usan con `if (x.loreApi) …`):

| llamada | qué hace |
|---|---|
| `entries` · `collections` · `vocab` | datos estáticos (70 entradas, 11 colecciones, nombres de glifos/colores/direcciones/palabras de `hintFor`) |
| `get(id)` | `{id,k,reg,t,a,w,th,boss,secret,d,found,read,q,readable,text,lines}` (`k`: `libro`/`chip`/`grab`) |
| `has(id)` · `readable(id)` | hallada · legible entera (los chips piden descifrado completo) |
| `grant(id, {quiet?, src?})` | marca como hallada y la presenta; emite `'lore'`. `false` si ya la tenías. `quiet` evita abrir el lector o reproducir |
| `decrypt(id, calidad)` | `true`/`1` completo, `0..1` parcial, `false`/`0` intento fallido; idempotente (gana la mejor calidad); concede el chip si no lo tenías → `{ok, q, entry}` |
| `hintFor(clave, {kind?, len?})` | `{clave, kind, len, value, seq, names, display, phrase, entry, known, what, text}`; mismo valor para la misma partida y clave |
| `reveal(clave)` | anota la pista en el Archivo (toast) aunque el jugador no haya leído el documento |
| `progress(colId)` · `next(kind?, reg?)` · `pendingChips()` | progreso de una colección · siguiente entrada sin hallar (recompensas de hackeo/puzles) · chips hallados sin descifrar |
| `open(tab?, id?)` · `play(id)` · `stop()` | abre el Archivo (`libros|chips|grab|cols|hitos`) · reproduce una grabación · la detiene |
| `speak(texto, hablante, {vol?})` · `voices` | voz sintetizada para cualquier frase → `{stop(), dur}`; hablantes en `voices` (`argos`, `reyes`, `lucia`…) |

Pistas existentes (`clave` → tipo): `valle.bunker` dígitos×4 · `ciudad.metro` direcciones×4 · `desierto.runas` glifos×4 · `marisma.coro` colores×4 · `tundra.estacion` frecuencia (MHz) ·
`complejo.clave` palabra (para cifrado por sustitución; `phrase` da un texto en claro) · `caldera.valvulas` orden×4 · `yermo.reactor` dígitos×5 · `colmena.canto` glifos×5.
Una clave nueva (`hintFor('mi.puzle', {kind:'runes', len:5})`) también da un valor determinista; sin documento que la cite (`entry: null`) el puzle debe mostrarla él mismo o llamar a `reveal`.
`value` es la cadena canónica (`"4817"`, `"RAIZ"`, `"93.7"`; para glifos/colores/direcciones, los índices concatenados en `seq`/`names`).

**Eventos emitidos:** `'lore'({lid,t,a,txt,reg,k,quiet,src}, true)` al hallar una entrada nueva (ECONOMÍA da XP; el lector antiguo `Rb` se desvía al Archivo) · `'loreCollection'(id, nombre)` al completar una colección regional
(TALENTOS concede el punto) · `'loreDecrypted'(id, q)` · `'loreVoice'(id)` · `'loreVoiceEnd'(id)`.
**Eventos consumidos:** `bossKilled` (expediente del jefe), `uiClosed`, `playerDied`, `toMenu`, `respawn`.

**HACKEO:** un objetivo de tipo chip puede llamar a `x.loreApi.decrypt(id, calidad)` (con `next('chip', reg)` + `grant` para dar uno nuevo). El Archivo usa `x.hackApi.run(spec, cb)` con
`spec = {kind:'chip', id, name, tier, diff, lore:true}`. `cb(res)` llega **después** de cerrar el panel de hackeo y el Archivo lo interpreta así: `res.abortado` (✕, Esc, «Desconectar» o abrirse otro panel encima) no cuenta como intento
ni cambia la legibilidad; `res.ok === true` (o `cb(true)`) descifra al 100 %; un fallo anota un intento y deja el chip `max(res.q, legibilidad + 15 %)` legible (tope 85 %). Si `run()` devuelve `null` (sin partida o sin estado de hackeo) cae al minijuego de reserva.
El Archivo solo se reabre si no hay otro panel encima (muerte, pausa) y la partida sigue en curso. **PUZLES:** `hintFor`/`vocab`; las recompensas de puzle pueden pedir pistas de lore.
**GADGETS:** las colecciones piden planos con `gadgetPlanDrop('lore1'…'lore4')` (se añaden `x.cfg.gadgets.plan.loreN = {p:1, tier:N}` en tiempo de carga) y emiten `'gadgetPlanDrop'`.
**ECONOMÍA:** `ecoGrantXp`, `ecoChestLoot(…, {src:'secret'})` y `ecoHitosHtml()` si existen.

## Ficheros y cirugía en ficheros ajenos

Nuevos: `src/game/31d-lore.js`, `src/game/_prelude.lore.js`, `src/engine/lore-data.js`, `docs/frente-lore.md`, `tools/scenarios/lore-{demo,ui,migrate,mapa,perf}.mjs`, `tools/sim/lore.mjs`.
**Cirugía: ninguna en los ficheros antiguos.** Todo por envoltorios de métodos/funciones desde 31d (como ya hace 31b con `Nb`):
`ih.prototype.{createMesh, promptFor, interact, hackResult, loadWorld, loadOp}`, `Rb` (lector antiguo), `Nb` (tecla L), `No` (pestaña de vuelta), `Er` (pestaña «Archivo (L)»), `ecoMinimapPings` (puntos con Instinto).
`_order.json`, `_prelude.js`, `mapV`, `25-save.js` y el guardado antiguo no se tocan.

## Pruebas

```bash
cd eclipse && node tools/build.mjs --dev --out dist/dev.html
node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/lore-demo.mjs --size 640x360          # 20+ comprobaciones de punta a punta
node tools/shot.mjs --html dist/dev.html --device pixel7 --scenario tools/scenarios/lore-ui.mjs          # móvil apaisado (añade --portrait para vertical)
node tools/sim/lore.mjs --html dist/dev.html                                                              # cifras: colocación (60 semillas), voz, pistas, XP, CPU; escribe 3 .wav de muestra
# el mapa no cambia: con la build base y con la nueva (EXPECT_MAP = salida MAPHASH de la base)
node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/lore-mapa.mjs
EXPECT_MAP='{…}' node tools/shot.mjs --scenario tools/scenarios/lore-mapa.mjs
# migración: DUMP con la build base, LOAD con la nueva
DUMP=/tmp/s.json node tools/shot.mjs --html /ruta/base.html --scenario tools/scenarios/lore-migrate.mjs
LOAD=/tmp/s.json node tools/shot.mjs --scenario tools/scenarios/lore-migrate.mjs
```
Depuración en la página: `window.__lore` (`plan()`, `nodes()`, `tp(id)`, `grantAll()`, `open(tab, id)`, `render(id)`, `rebuild(semilla)`, `enterOp(reg, tema)`, `enterSub(tipo)`, `leave()`, `emit(evento, …)`).

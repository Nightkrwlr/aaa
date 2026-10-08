# Frente LORE (D5): libros, chips cifrados y grabaciones con voz

Fragmento: `src/game/31d-lore.js` (motor, UI, voz) · contenido y funciones puras: `src/engine/lore-data.js` (importado por `src/game/_prelude.lore.js`).
Pruebas: `tools/scenarios/lore-demo.mjs`, `lore-ui.mjs`, `lore-migrate.mjs`, `lore-mapa.mjs`, `lore-perf.mjs` y `tools/sim/lore.mjs`.

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

NUMEROS_AQUI

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
`spec = {kind:'chip', id, name, tier, diff, lore:true}` y entiende `cb(true|false)` o `cb({ok, q|quality})`. **PUZLES:** `hintFor`/`vocab`; las recompensas de puzle pueden pedir pistas de lore.
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

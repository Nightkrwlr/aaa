# Frente PUZLES (D7) — acertijos variados con prueba de que se pueden resolver

Fragmento: `src/game/31f-puzzles.js` (el único fichero de juego que toca; los ganchos se envuelven desde él). Escenarios: `tools/scenarios/puzles-*.mjs`.
Ajustes: `x.cfg.puzzles`. API: `x.puzzleApi`. Evento: `puzzleSolved`. Pruebas en la página: `window.__puzzles`.

## Estado

**Hecho.** Trece tipos registrados: once jugables (los ocho de D7 y los tres de PUZLES v2, ver abajo) y los dos clásicos (`switch` = «Placas encadenadas»,
`sequence` = «Secuencia del pilar»), todos con `make(semilla, nivel)` y `validate(spec)`:

| Tipo | Nombre | Qué hay que hacer |
|---|---|---|
| `mirrors` | Espejos y haz de energía | girar los espejos para que cada haz llegue a su receptor del mismo color |
| `boxes` | Cajas sobre placas | empujar las cajas hasta las placas del suelo (Reiniciar / Deshacer / Pista) |
| `timed` | Placas de presión (v2) | cámara cerrada: cada placa se apaga a los segundos que marca, hay baldosas rojas que lo apagan todo y rejas que abre la placa de su color; hay que tenerlas todas encendidas a la vez |
| `runes` | Runas en orden | activar las runas en el orden que dicta la inscripción (las pistas salen del Archivo, `x.loreApi.hintFor`) |
| `circuit` | Enrutado de corriente | girar los conductos para que la corriente de la fuente alimente todas las baldosas |
| `lasers` | Pasillo láser | cruzar las rejas láser por los huecos cuando se abren (se desplazan cada 0,55 s; un toque devuelve al principio) |
| `memory` | Suelo de memoria | memorizar el camino que se ilumina unos segundos y recorrerlo sin pisar baldosas falsas (descargan y lo vuelven a mostrar) |
| `valves` | Válvulas de inundación | cruzar los carriles con las válvulas para que cada líquido llegue a su depósito |
| `sink` | Losas de un solo paso (v2) | cámara de losas que se cierran al dejarlas: pisar todas las que llevan diamante sin encerrarse y llegar a la salida |
| `ice` | Bloques sobre hielo (v2) | los bloques resbalan hasta chocar: dejar uno parado en cada placa (Reiniciar / Deshacer / Pista) |
| `lock` | Cerradura de símbolos (v2) | deducir un código de símbolos del Archivo con las pistas ✔ (en su sitio) y ◐ (en otra ranura) y un número limitado de intentos |

* **Se pueden resolver, probado:** `x.puzzleApi.validateAll()` recorre TODAS las semillas que puede generar el juego y resuelve cada puzle con un bot.
* **Colocación:** sala de acertijo en subterráneos de edificio y cueva (`chance` 0,55) y en operaciones (`chanceOp` 0,6), con RNG propio sembrado por hash de la
  semilla de la mazmorra (no consume el RNG del juego ni el del mundo). En el Desierto y la Colmena, el acertijo es el de runas dictado por el Archivo con probabilidad
  `loreChance` 0,7. Es estable por escalera aunque el mapa cambie, y un acertijo resuelto vuelve a dar premio a los 120 min (como los cofres).
* **Nivel del acertijo (1-3):** según el nivel de la mazmorra (`tierByLvl`: 0→1, 10→2, 22→3, ± 1 por azar).
* **Premio:** cofre del sistema de ECONOMÍA del tier del acertijo (`Co(..., {src: "chest"+tier})`) + XP (fracción de la barra) + créditos; «perfecto» (sin errores, sin pistas,
  dentro del par de movimientos × `parSlack`) añade un cofre de tier 1 y más XP y créditos. Si se resuelve hackeando el panel (`x.hackApi.run`), la XP es × `hackMul` 0,6.
  A veces el mecanismo guarda un documento del Archivo (`x.loreApi.next` / `grant`).
* **Interfaz:** tarjeta compacta junto al puzle con estado y botones Reiniciar / Deshacer / Pista de 44 px; USAR por teclado (E) y por toque; probada con toques
  reales (CDP) en Pixel 7 apaisado y vertical.
* **Gráficos:** mallas instanciadas compartidas (16 en total para los 8 tipos, nunca una por baldosa); los puzles lejanos se desmontan.
* **Guardado:** `S.puzzles = {id: {t, k, tier, p}}`, `S.puzzleStats` y `S.puzzleV = 1`, con migración idempotente.
* **Sellos de guarida (D8):** cada `puzzleSolved` suma un fragmento de sello en su región (hasta 2 por región), ver `docs/frente-jefes.md`.

## PUZLES v2 (feedback del jugador: «las placas de presión son muy fáciles: dale otra vuelta y añade puzles más interesantes»)

Lo demás (espejos, cajas, runas, corriente, láseres, memoria, válvulas) se queda como estaba: el jugador dijo que estaba bien.

**Placas de presión (`timed`, rehecho).** Antes: 3-5 placas con la misma duración en una sala abierta, y bastaba con recorrerlas deprisa en un orden razonable.
Ahora es una **cámara cerrada** (perímetro de muros con una sola entrada, dentro 1-2 tabiques con un paso cada uno y pilares):

* **Cada placa dura lo suyo** (2,5-10 s, el número flota sobre ella): la que dura poco va tarde y la que dura mucho, pronto. La duración **no delata el orden**: a
  algunas placas se les da de más a propósito.
* **Baldosas rojas** (1 / 2 / 3 por nivel): pisarlas apaga todas las placas, cuenta un error y descarga (5 % de vida, nunca letal); un roce con el borde de la celda
  (0,14 m) se perdona. Obligan a rodear.
* **Rejas de color** (0 / 1 / 2 por nivel): un paso del tabique que está cerrado (sólido en `map.blk`) salvo mientras esté encendida la placa del mismo color (mástil
  de color sobre la placa). No se cierra sobre quien la está cruzando.
* **Tamaños:** 7×6 (4 placas, 1 tabique, 1 roja) · 8×6 (4 placas, 2 tabiques, 1 reja, 2 rojas) · 8×7 (5 placas, 2 tabiques, 2 rejas, 3 rojas).
* **`validate()` es exacto:** tiempos de viaje reales (Dijkstra sobre la cámara a 4,2 m/s, el jugador corre a 5,2; las rojas y las rejas cerradas cuentan como muro, y la
  reja de una placa ya pisada, como paso), **todas las permutaciones de placas** y, para cada una, si cada placa sigue encendida cuando se pisa la última. `make()` solo
  acepta cámaras con una o dos soluciones, holgura ≥ 0,3-0,35 s, duraciones repartidas (≥ 2 s de rango), las rojas y las rejas **de verdad usadas** por la solución y
  sin que la resuelva ninguna **regla tonta** (la que más dura primero, el vecino más cercano, la más cercana a la entrada, el recorrido más corto).

**Losas de un solo paso (`sink`).** Una cámara de losas: la que dejas atrás se **cierra** (se alza como bloque sólido) cuando ya estás a 0,3 m de su borde, así que cada
losa se pisa una vez. Hay que pisar todas las que llevan diamante; al pisar el último se abre la salida. Pasar en diagonal por una esquina pisa también las dos de los
lados (no se puede recortar); la franja de 0,12 m entre losas no cuenta (no se pisa lo que se roza). El panel avisa en cuanto la cámara se queda sin camino («Sin camino
desde aquí: reinicia») y Reiniciar te devuelve a la entrada. `validate()` hace una **búsqueda exhaustiva** de caminos sin repetir losa (con poda: diamantes y salida
alcanzables), cuenta soluciones (≤ 3 / 2 / 2) y mide el árbol de búsqueda (señuelos que llevan a callejones sin salida).

**Bloques sobre hielo (`ice`).** Como las cajas pero el suelo es hielo: el empujón hace resbalar el bloque hasta un muro, otro bloque o el borde de la cámara (bordillo
visible). El BFS exacto de estados (bloques + zona del jugador, anillo exterior transitable) da las soluciones mínimas y la pista.

**Cerradura de símbolos (`lock`).** 3 / 4 / 5 ranuras que giran con USAR entre 5 / 6 / 6 símbolos del Archivo (los de las runas); consola para «Probar». El código es de
símbolos distintos; cada intento devuelve ✔ (en su sitio) y ◐ (está pero en otra ranura); el historial va en el panel. Intentos limitados (8 / 9 / 9): si se agotan, la
cerradura cambia de código (un error). `validate()` simula a un jugador metódico (siempre prueba una combinación coherente con todo lo visto) sobre los códigos de las tres
primeras rondas y exige que le sobren al menos dos intentos. Los códigos se eligen para que no empiecen puestos ni se abran a la primera o a la segunda.

**Colocación:** el tipo de una escalera no cambia aunque cambie su mapa: si no cabe el tipo elegido, primero se encoge **el mismo tipo** (niveles menores) y luego se
prueban los demás en un orden fijo por escalera (antes era aleatorio por mapa). Los tipos nuevos entran en `x.cfg.puzzles.weights` por tema (losas en sótanos y colmena,
hielo en grutas, cerradura en plantas y sótanos).

## Números medidos de PUZLES v2 (Node, `validateAll(pool 40)`: 1640 puzles, 0 fallos; en el navegador, `puzles-v2`)

| Tipo / nivel | Soluciones (media) | Esfuerzo | Notas |
|---|---|---|---|
| placas 1 · 2 · 3 | 2,4 · 1,8 · 1,7 de 24 · 24 · 120 órdenes | tramo total 4,1 · 5,2 · 7,6 s; holgura 0,7 · 0,8 · 0,7 s | «más dura primero» resuelve 0/40 · 0/40 · 0/40; «recorrido más corto» 14/40 · 10/40 · 4/40; solución única 3 · 7 · 11 de 40 |
| losas 1 · 2 · 3 | 2,1 · 1,8 · 1,6 | camino 8,6 · 12,6 · 19,4 losas de 10,9 · 17,1 · 25,4 libres | árbol de búsqueda 32 · 96 · 455 nodos |
| hielo 1 · 2 · 3 | — | 3,7 · 8,5 · 11,9 empujes mínimos | 9 · 131 · 227 estados |
| cerradura 1 · 2 · 3 | 60 · 360 · 720 códigos | método: 3,7 · 4,1 · 4,8 intentos (peor 4 · 4,8 · 5,8) de 8 · 9 · 9 | |

Tiempo de `make` medio (peor caso): placas 45 (123) · 18 (75) · 23 (99) ms; losas 0,1 · 1,3 · 21 ms; hielo 2 · 14 · 52 (182) ms; cerradura < 1 ms.

**En el juego real** (`puzles-v2`, 35/35): el jugador **camina de verdad** (joystick virtual y bucle del juego, con colisiones) las placas en el orden de la solución
(3 semillas × 3 niveles, 0 errores) y las losas (3 × 3, se cierran las que deja atrás); las rejas son sólidas en `map.blk` hasta encender su placa, se abren y se cierran
al apagarse; la baldosa roja apaga todo, cuenta un error y duele; las etiquetas flotantes llevan la duración; la losa cerrada, el reinicio, el aviso «sin camino», el
deslizamiento del hielo y Deshacer, la cerradura (giro con etiqueta dinámica, intentos, cambio de código), pista y botones del panel, y ≤ 16 mallas instanciadas por tipo.

## Contratos nuevos del motor de puzles

* `gen.reset(spec, st, ctx)` recibe el contexto del motor (antes solo `spec, st`): las losas lo usan para devolver al jugador a la entrada (`ctx.teleport`).
* `gen.glyphs(spec, st)` (etiquetas flotantes del DOM) recibe también el estado; cada etiqueta puede llevar una versión `k`: el texto y el color solo se reescriben cuando
  `k` cambia (la cerradura cambia el símbolo de cada ranura sin recrear nada). Sin `k`, la etiqueta es estática como antes.
* `gen.clueLines(spec, st)` (lista bajo el estado en la tarjeta) ya existía; la cerradura la usa para el historial de intentos (los seis últimos).
* `window.__puzzles.toWorld(rt, lx, lz)`: coordenadas de la celda del puzle al mundo (para pruebas que caminan).
* `PZ.events` guarda ahora los 64 últimos `puzzleSolved` (antes 30).

## Números medidos (build 202610090022, GL por software; salvo que se diga, de los escenarios de `tools/scenarios/`)

* **`validateAll(pool 40)`:** 1280 puzles, 0 fallos, 16,4 s. Diez tipos registrados.
* **Jugados de verdad por el bucle real** (bot que se mueve, apunta y pulsa USAR), 8 tipos × 3 niveles = 24/24 resueltos y «perfectos», 0 errores, todos con botín de
  ECONOMÍA y créditos. Acciones (pulsaciones) por nivel 1 / 2 / 3: espejos 2 / 4 / 8 · cajas 5 / 7 / 12 · placas con cronómetro 3 / 4 / 5 · runas 4 / 5 / 6 ·
  corriente 23 / 35 / 38 · láseres 9 / 9 / 9 · memoria 9 / 10 / 12 · válvulas 2 / 3 / 4.
* **Mazmorras:** 160 revisadas (71 con acertijo): terreno, regiones, entidades y RNG idénticos; el atrezo y los bloqueos solo cambian dentro del rectángulo del
  acertijo. La huella del mundo abierto es idéntica a la de la build publicada antes de PUZLES (`mapV` 3).
* **Dibujo:** cada puzle añade entre +1 y +14 llamadas de dibujo medidas en el mismo sitio con y sin puzle (peor caso +14 de 298); ≤ 16 mallas; al quitar el puzle no queda
  ninguna visible; 6 ciclos de montar/dibujar/desmontar los 8 tipos y 5 entradas y salidas de subterráneos con acertijo dejan constantes geometrías y texturas y nada montado.
* **CPU y memoria:** `pzTick` con dos puzles montados (211 instancias): 38 µs por fotograma. Asignaciones: 264 B en 1500 fotogramas (control de 316 500 `Matrix4.compose`
  sin puzle: 508 B). *Antes de cachear el color lineal por hex eran 28,5 KB y 72-85 µs: `Color.setHex` hacía conversión de espacio de color con `Math.pow` por instancia y fotograma.*
* **Migración:** un guardado creado con la build publicada se carga con «Continuar» en la nueva sin perder nada (`puzles-migrate`, 8/8).
* **Escenarios:** `puzles-core` 43/43 · `puzles-ui` 14/14 apaisado y 14/14 vertical · `puzles-lore` 20/20 (runas dictadas por el Archivo, documentos como premio, atajo electrónico por
  hackeo, botín de ECONOMÍA) · `puzles-map` (huella y 160 mazmorras) · `puzles-perf` 9/9.

## Contratos

* `x.puzzleApi = { version, gens, kinds, register(tipo, generador), make, validate, validateAll, spec, choose, botRun, cfg }`. Un generador trae `make`, `validate`, `solved`, `draw`
  (y opcionalmente `step`, `hackable`); `register` rechaza los que no pasan `pzValidGen`.
* `ee("puzzleSolved", p)` con `p = { id, kind, tier, perfect, errors, moves, hints, resets, time, how: "play"|"hack", lvl, reg, drops }`.
* Lee de forma opcional `x.loreApi` (`hintFor`, `next`, `grant`) y `x.hackApi.run`; sin ellos, los puzles funcionan igual.

## Pendiente

* Los puzles no se colocan todavía en el mundo abierto (solo en subterráneos y operaciones) ni se generan nuevos ejemplos en las guaridas de jefe (D8).
* La dificultad por nivel (tamaños y tiempos) sale de `x.cfg.puzzles` y del generador; no hay datos de jugadores reales, solo de bots: si resultan fáciles o difíciles, se
  ajusta ahí. El bot no mide frustración ni legibilidad: eso hay que probarlo en un móvil.
* `tools/sim/puzzles.mjs` (simulación de reparto) no existe: las cifras de reparto salen de `puzles-core` y `puzles-map`.

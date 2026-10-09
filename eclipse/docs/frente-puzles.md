# Frente PUZLES (D7) — acertijos variados con prueba de que se pueden resolver

Fragmento: `src/game/31f-puzzles.js` (el único fichero de juego que toca; los ganchos se envuelven desde él). Escenarios: `tools/scenarios/puzles-*.mjs`.
Ajustes: `x.cfg.puzzles`. API: `x.puzzleApi`. Evento: `puzzleSolved`. Pruebas en la página: `window.__puzzles`.

## Estado

**Hecho.** Diez tipos registrados, ocho nuevos y los dos clásicos (`switch` = «Placas encadenadas», `sequence` = «Secuencia del pilar»), todos con
`make(semilla, nivel)` y `validate(spec)`:

| Tipo | Nombre | Qué hay que hacer |
|---|---|---|
| `mirrors` | Espejos y haz de energía | girar los espejos para que cada haz llegue a su receptor del mismo color |
| `boxes` | Cajas sobre placas | empujar las cajas hasta las placas del suelo (Reiniciar / Deshacer / Pista) |
| `timed` | Placas con cronómetro | cada placa se apaga a los pocos segundos: hay que encenderlas todas a la vez |
| `runes` | Runas en orden | activar las runas en el orden que dicta la inscripción (las pistas salen del Archivo, `x.loreApi.hintFor`) |
| `circuit` | Enrutado de corriente | girar los conductos para que la corriente de la fuente alimente todas las baldosas |
| `lasers` | Pasillo láser | cruzar las rejas láser por los huecos cuando se abren (se desplazan cada 0,55 s; un toque devuelve al principio) |
| `memory` | Suelo de memoria | memorizar el camino que se ilumina unos segundos y recorrerlo sin pisar baldosas falsas (descargan y lo vuelven a mostrar) |
| `valves` | Válvulas de inundación | cruzar los carriles con las válvulas para que cada líquido llegue a su depósito |

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

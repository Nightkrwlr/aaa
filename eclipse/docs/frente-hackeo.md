# Frente HACKEO (D6) — hackeo profundo

Todo el código nuevo vive en `src/game/31e-hacking.js` (≈ 3 300 líneas, 9 secciones numeradas al principio del fichero). Datos en `x.cfg.hack`
(niveles, riesgo, traza, minijuegos, programas, objetivos, recompensas). Pruebas: `window.__hack`.

## Estado

**Qué hace**
- **Nivel de hackeo** (`S.hack.lvl`, 1-20, XP `round(16·n^1,55)`): sube con terminales, torretas, mecánicos y chips. Cada nivel da −1,6 % de traza y +2 % de
  tiempo/tolerancia, y +1 hueco de programa cada 6 niveles (base 2, tope 6). Lee `S.talentFx` (los nodos de Ingeniería ya los escribe el frente TALENTOS):
  `hackSpeed`, `hackTraceCut` (negativo = más traza, «Intruso»), `hackTools` (huecos extra), `intruder` (hackear torretas a 14 m con línea de visión),
  `turretDmg`, `turretTime`.
- **Sesión apilable** (2-3 capas, una traza común): pantalla previa (riesgo, programas, compilador) → capas → resultado. Un fallo de capa o el tiempo agotado suman
  traza y repiten la capa con **otra variante** (otra semilla); un error dentro del minijuego suma traza; la traza sube sola con el tiempo (más rápido por
  dificultad, +10 % a partir del 40 %, +25 % a partir del 70 %). Al 100 %: **alarma + contraataque** (en terminales: `hackResult(false)` del juego —5-6 hostiles—,
  bloqueo 20-40 s y una descarga nunca letal; en enemigos: la unidad queda furiosa, daño ×1,3, y descarga). El «calor» del sistema (`S.hack.heat`, +5 por
  intento, +8 al fallar, se disipa con el tiempo de juego) se hereda a medias como traza inicial: encadenar hackeos cuesta.
- **5 minijuegos nuevos**, todos jugables con un dedo (zonas ≥ 36 px, `pointer events`, sin teclado obligatorio; teclado opcional en escritorio), cada uno con
  `gen(semilla, dificultad)` determinista, `validate()` que prueba que se puede ganar y un bot de pruebas:
  1. **Cortafuegos** (breakout): arrastra para mover la pala; la bola acelera; bloques de doble vida en dificultad ≥ 4.
  2. **Cifrado por sustitución**: mensaje cifrado con un alfabeto sin letras fijas, teclado en pantalla, letras reveladas según dificultad y **pista del
     archivo** (la palabra clave; con la clave de ARGOS leída en el Archivo el mensaje termina con ella y sus letras vienen puestas).
  3. **Enrutado de nodos** (grafo): llega de S a T pasando por todos los ◆ sin tocar el ✕ y sin pasarte de la latencia; el óptimo se calcula con DFS y garantiza
     una solución dentro del presupuesto.
  4. **Sintonía de frecuencia**: un panel táctil (frecuencia ↔, amplitud ↕) y un deslizador de fase hasta superponer la onda y mantenerla; la señal deriva.
  5. **Fuerza bruta a ritmo**: cuatro carriles, toca el carril cuando el carácter cruza la línea; fallos y toques en falso suman traza y «clave mala».
  Los cinco minijuegos antiguos de `28-hack.js` siguen como capas (sin tocarlos; `hkOldGame`) con peso la mitad al sortear.
- **Programas** (consumibles, `S.hack.tools`, máx. 9 cada uno, se compilan con datos/materiales + créditos): Disipador (−30 traza), Ralentizador (55 % de
  velocidad 14 s), Oráculo (ayuda propia por minijuego: letras, margen, ruta resaltada, pala ancha, ventana mayor), Fantasma (traza a la mitad en la capa y los
  fallos menores no suman), Rompehielo (supera una capa de dificultad ≤ 3 por 12 de traza). Kit inicial: 2 Disipadores + 1 Ralentizador (cargados al empezar).
- **Objetivos**
  - **Terminales** (`jp` de 29-panels llama a `hackOpenTerminal`): relés 1 capa, cámaras acorazadas (cofre y oculta) 2 capas, balizas de desafío 3; +1 capa en
    dificultad alta; el efecto del juego (`hackResult`) no cambia.
  - **Torretas y drones enemigos** (`torreta, pilon, dron, fisionador`): se **toman** 14 s (+0,8 s por nivel, tope 32 s, × `turretTime`): invulnerables, fuera de
    la mira, disparan a los demás con un múltiplo del DPS de **tu arma activa** (así escala con nivel y equipo). Riesgo Agresivo: sobrecarga (+60 % de daño y
    explosión al terminar).
  - **Mecánicos** (`mech, centinela, mortero, tanquemec, minador, escudero, aranamec, reparador`): se **apagan** 9 s (+0,8 s/nivel). Jefes y minijefes no.
  - **Marcador táctil «HACKEAR»** sobre la unidad hackeable más cercana (≥ 44 px, 6 m; 14 m con «Intruso»), tecla **V** en escritorio, un consejo la primera vez.
  - **Chips de lore**: `hackApi.decryptChip(id)` o `hackApi.run({kind:"chip", id, …})`: dos capas, la primera un cifrado con la pista del Archivo. Las cámaras
    acorazadas pueden guardar un chip sin hallar (`loreApi.next("chip", región)` + `grant`).
- **Módulo «Hacker»** (13.º gadget, plano nivel 3, `kind:"hacker"`): pulso cada 1,2 s en 7 m durante 30 s; apaga mecánicos (3,2 s por pulso) y toma hasta 2
  torretas/drones (10 s). Emite `gadgetPlaced` / `gadgetTriggered`. Un hackeo de 2+ capas o agresivo tira `gadgetPlanDrop("hack")` (20 %).
- **Recompensas por riesgo y capas** (`hkRewards`): créditos × `mt.credits(nivel)` × capas × riesgo, datos, cofre de botín (2 capas → tier 1, 3 → tier 2, +1 si Agresivo),
  programa (20/35/60 % × capas/2), plano de gadget, XP de hackeo ×1/1,7/2,6 por capas y ×0,85/1/1,7 por riesgo. Riesgos: Cauto (botín ×0,8, traza ×0,7, tiempo ×1,15),
  Estándar, Agresivo (nv 3; +1 capa, botín ×1,8, traza ×1,5, tiempo ×0,85). En combate (enemigos) el riesgo siempre empieza en Estándar y no se recuerda.
- **Guardado:** `S.hack = {lvl, xp, tools, loadout, heat, risk, stats}` y `S.hackV = 1`; migración idempotente en `x.migrations`: un guardado antiguo recibe el kit inicial
  y un nivel retroactivo (22 XP por terminal ya hackeada). Probado con un guardado real de la build anterior (ver `hackeo-migrate`).

**Cirugía en ficheros antiguos** (todas mínimas): `29-panels.js` (1 línea en `jp`: `if (hackOpenTerminal(n, e)) return;`; en el panel Personaje el resumen
`hackSummaryText()`; una frase de la ayuda), `31c-gadgets.js` (1 línea en `gdStatLine`: texto propio del módulo). `32-boot.js`, `_order.json`, `_prelude.js` y `28-hack.js`
no se tocan. La tecla V se añade al mapa `yw` desde 31e. Hay un envoltorio de `gadgetEnemyTick` (31c) para saltarse la IA de las unidades hackeadas.

## Números medidos
(ver abajo: salida de `tools/sim/hackeo.mjs`)

## Pendiente / limitaciones
- **Los cinco minijuegos antiguos** (`seq pipe code sync lights`) se montan tal cual (28-hack.js no se toca) y por eso **no tienen `validate()` propio ni bot que
  los juegue**: en las pruebas se resuelven con un atajo y sus números de tiempo/éxito en `tools/sim/hackeo.mjs` son un **modelo declarado**, no una medición.
  Tampoco los pueden ayudar el Oráculo (avisa con un toque) ni el modo Ralentizador salvo por su propio reloj interno.
- **Cifrado y enrutado**: `validate()` prueba que se pueden ganar (cifrado: biyección y reconstrucción; enrutado: DFS con presupuesto), pero **no hay un bot
  humano que mida su dificultad real**; los números de tiempo y éxito de la simulación para ellos son un modelo (hay que ajustarlos con jugadores reales).
- **Probado solo con GL por software y emulación táctil de Playwright** (toques CDP reales en `pixel7` vertical y apaisado), no en un teléfono físico:
  la sensación de arrastre del cortafuegos y de la sintonía y el timing del ritmo en un dispositivo real puede pedir ajustes (`cfg.fw.speed`, `cfg.brute.good`).
- **Sonido:** cinco efectos sintéticos nuevos (`hkIce`, `hkLock`, `hkTick`, `hkCtl`, `hkOff`) más los existentes; sin música de minijuego ni voz.
- **Controlar enemigos:** la unidad controlada dispara con un proyectil propio (no usa su IA de combate) y busca el objetivo cada 0,12 s a un alcance de su arma +2 m;
  no hay control manual. Un enemigo de élite no se puede tomar si es jefe/minijefe; las torretas aliadas del Bastión no son hackeables.
- Los **chips de lore** se descifran desde el Archivo (frente LORE) o con `decryptChip`; en el mundo no hay todavía terminales «de chip» propias del hackeo:
  el único origen es el Archivo y el botín de cámara acorazada (`loreApi.next("chip", región)`).
- Sin integración con PUZLES (aún no existe `x.puzzleApi`): un puzle puede lanzar `hackApi.run({...})` y escuchar `hackDone`; un sello de guarida «de hackeo»
  queda para el frente de jefes.
- El **nivel de zona** del botín sale de `x.world.lvlAt` (o `x.op.lvl`): si en una zona nueva falta ese método el botín cae al nivel del jugador.
- Equilibrio fino de Ingeniería (`hackSpeed`, `hackTraceCut`…) y de `needByDiff` solo con simulación y bots; ver «Números medidos».

## Contratos (API pública para otros frentes)

`x.hackApi` (versión 1; todo opcional para quien lo use: `if (x.hackApi) …`):

| miembro | qué hace |
|---|---|
| `level()` / `xp()` / `addXp(n)` | nivel de hackeo (1-20), `{xp, next, lvl}` y suma de XP (sube nivel y emite `hackLevel`) |
| `run(spec, cb)` | abre una sesión de intrusión y devuelve `{session, abort()}` (o `null` si ya hay una sesión o el juego no ha empezado) |
| `decryptChip(id, cb, opts)` | atajo: dos capas, la primera un cifrado con la pista del Archivo; al ganar llama a `x.loreApi.decrypt(id, 1)` |
| `open(ent, rt)` | abre la terminal de una entidad del mapa (lo que hace `jp` en 29-panels) |
| `active()`, `last()`, `kinds` | ¿hay sesión?, último resultado, ids de los 10 minijuegos |
| `control(e, secs, sobrecarga)`, `disable(e, secs)`, `release(e)`, `hackable(e)` | tomar el control de una torreta/dron, apagar un mecánico, soltar y ¿se puede hackear? (`"control"`, `"off"` o `null`) |
| `trace.get() / add(n) / heat() / cfg` | traza de la sesión activa, sumar traza, calor del sistema y su configuración |
| `programs.defs / count(id) / give(id, n) / compile(id) / cost(id) / spend(id)` | programas consumibles (para recompensas de otros frentes: `give`) |
| `mods()` | `{lvl, speed, trace, slots}` ya con los talentos aplicados |

**`spec` de `run`:** `{title, sub, objetivo, diff (1-4), layers (1-3) | kinds:[ids], pool:[ids], seed, need (nivel recomendado), xp, risk (0-2: fija el riesgo), noPre
(salta la pantalla previa), noRewards, loot:false, rewMul, at:{x,z}, onDone(res)→[líneas HTML], onAbort(res)}`. La traza, los tiempos, los programas, el riesgo y la
XP de hackeo son siempre los de la sesión real. **`cb(res)` se entrega cuando el jugador cierra el panel de resultado** (nunca dentro del cierre: puede abrir otro panel);
`hackDone` se emite al terminar, antes.

**Resultado `res`** (también en el evento `hackDone(res)`): `{ok, capas, capasOk, riesgo (0 cauto, 1 estándar, 2 agresivo), objetivo ("terminal" | "camara" | "baliza" |
"torreta" | "dron" | "mecanico" | "chip" | "personalizado"), traza, tiempo, fallos, errores, programas, kinds, id, nivel, xp, nivelNuevo, recompensas?, abortado?}`.
Un cierre voluntario (✕, Esc, «Desconectar») entrega `{ok:false, abortado:true}` y no cuenta como fallo ni da XP.

**Lore.** `run({kind:"chip", id, name, tier|diff, lore:true}, cb)` es la llamada que hace `31d-lore.js` desde el Archivo: el resultado lleva `q` (1 si se supera;
parcial 0-0,85 según las capas superadas si falla; 0 si desconecta) y el Archivo hace él mismo `loreApi.decrypt(id, q)` (con `lore:true` hackeo **no** llama a
`decrypt` para no contar dos intentos). Sin `lore:true`, o con `decryptChip`, es hackeo quien llama a `decrypt(id, q)`. El cifrado usa `loreApi.hintFor("complejo.clave")`
(solo si `known` y `kind === "word"`) y el número de entradas halladas (`entries` + `has`). Una cámara acorazada llama a `loreApi.next("chip", reg)` y `grant(id)`.

**Gadgets.** Registra `x.cfg.gadgets.types.hacker` (tier 3). `31c-gadgets.js` solo necesita que exista `d.statText` (1 línea ya añadida). La IA de las unidades
hackeadas se corta envolviendo `gadgetEnemyTick`: otros frentes que envuelvan esa función deben llamar al envoltorio anterior.

**Talentos (lectura de `S.talentFx`).** `hackSpeed`, `hackTraceCut`, `hackTools`, `intruder`, `turretDmg`, `turretTime` (todos opcionales; 0 si faltan).

**Eventos emitidos:** `hackDone(res)`, `hackLevel(nivel)`; usa además `gadgetPlaced`, `gadgetTriggered`, `gadgetPlanDrop` y `toast`. **Pruebas:** `window.__hack`
(`validateAll(n)`, `autoplay()`, `step()`, `sims`, `state()`, `migrate(S)`).

**Para el frente de PUZLES:** `hackApi.run({kinds:["route"], diff:3, noPre:true, risk:1, onDone})` abre un enrutado suelto; `hackDone` con `objetivo` propio
sirve para recompensas encadenadas. Recompensas de hackeo: `hackApi.programs.give(id, n)` y `gadgetPlanDrop("hack", true)`.

**Pruebas del frente:** `tools/scenarios/hackeo-core.mjs` (núcleo), `hackeo-lore.mjs` (contratos con LORE y teclado), `hackeo-ui.mjs` (interfaz y toques; `--device pixel7`
con y sin `--portrait`), `hackeo-migrate.mjs` (guardado antiguo), `hackeo-map.mjs` (el mapa no cambia), `hackeo-perf.mjs` (llamadas de dibujo) y la simulación
`tools/sim/hackeo.mjs`.

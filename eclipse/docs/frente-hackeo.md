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
  fallos menores no suman), Rompehielo (supera una capa de dificultad ≤ 3 por 12 de traza). Kit inicial: 2 Disipadores + 1 Ralentizador (el Disipador ya viene cargado; el Ralentizador se usa desde el nv 2). Programas por nivel de hackeo: Disipador 1, Ralentizador 2, Oráculo 3, Fantasma 5, Rompehielo 7.
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

Todo sale de `tools/sim/hackeo.mjs` (corre el código real de la sesión dentro de Chromium; nada depende de la GPU) salvo donde se indica. Comando:
`node tools/shot.mjs --scenario tools/sim/hackeo.mjs --size 640x360 --out DIR` (variables `N`, `CAMP`, `SECTIONS=1,2,3,4,5`, `SEED`).
**Honestidad:** cortafuegos, sintonía y fuerza bruta se simulan con **bots de tres niveles de habilidad** sobre el simulador real del minijuego (error de
puntería, retardo de seguimiento, σ de pulsación); cifrado, enrutado y los cinco minijuegos antiguos **no** tienen bot que dependa de la habilidad: su tiempo y su
tasa de éxito son un **modelo declarado** en el script (`MODEL`), no una medición. Las filas «intrusiones» mezclan ambos. Nadie ha jugado esto en un teléfono real.

**1. Minijuegos** (bots: novato / medio / experto; éxito dentro del límite de tiempo · tiempo mediano; dificultad 1 … 5; 30 semillas por celda)

| minijuego | habilidad | d1 | d2 | d3 | d4 | d5 | límites |
|---|---|---|---|---|---|---|---|
| cortafuegos | novato | 100 % 35,7 s | 97 % 44 s | 100 % 37 s | 100 % 47 s | 87 % 52 s | 60 / 65 / 70 / 75 / 85 s |
| | medio | 97 % 36 s | 100 % 44 s | 100 % 38 s | 100 % 49 s | 100 % 54 s | |
| | experto | 100 % 28 s | 100 % 36 s | 100 % 33 s | 100 % 45 s | 100 % 47 s | |
| sintonía | novato | 100 % 2,7 s | 100 % 3,2 s | 100 % 4,2 s | 100 % 7,6 s | **3 %** 24 s | 30 / 32 / 34 / 36 / 40 s |
| | medio | 100 % 2,5 s | 100 % 3 s | 100 % 3,7 s | 100 % 4,8 s | 100 % 8,8 s | |
| | experto | 100 % 2,2 s | 100 % 2,8 s | 100 % 3,4 s | 100 % 3,8 s | 100 % 4,3 s | |
| fuerza bruta | novato | 80 % 12 s | 73 % 13 s | 60 % 15 s | 33 % 16 s | **3 %** 16 s | 22 / 23 / 24 / 25 / 26 s |
| | medio | 100 % 12 s | 100 % 13 s | 100 % 15 s | 100 % 16 s | 97 % 16 s | |
| | experto | 100 % 12 s | 100 % 13 s | 100 % 15 s | 100 % 16 s | 100 % 16 s | |

Lectura: la sintonía es **muy fácil para un jugador medio** (3-9 s) y casi imposible a dificultad 5 para quien siga la señal con 0,7 s de retraso; la fuerza bruta separa
bien por habilidad desde la dificultad 3. Ambas se pueden endurecer o ablandar con `cfg.tune` y `cfg.brute` sin tocar código. `validate()` (determinista) pasa en
**120/120** semillas × dificultades de cada uno de los cinco minijuegos nuevos (`hackeo-core`), y en 100/100 del cifrado con el Archivo activo (`hackeo-lore`).

**2. Intrusiones completas** (Monte Carlo sobre la sesión real, N = 100 por celda; jugador estocástico; **riesgo Estándar**; éxito % / traza final media % / duración media s)

| objetivo (capas · nivel recomendado) | habilidad | hack nv 1 | nv 4 | nv 8 | nv 12 | nv 20 |
|---|---|---|---|---|---|---|
| relé d1 (1 · nv 1) | novato | 99 / 22 / 48 | 99 / 21 / 47 | 99 / 19 / 45 | 97 / 20 / 52 | 99 / 16 / 53 |
| | medio | 100 / 10 / 26 | 99 / 11 / 28 | 99 / 9 / 27 | 100 / 9 / 27 | 100 / 7 / 28 |
| | experto | 100 / 7 / 19 | 100 / 6 / 18 | 100 / 5 / 17 | 100 / 5 / 18 | 100 / 5 / 19 |
| relé d3 (2 · nv 8) | novato | 25 / 91 / 74 | 37 / 89 / 79 | 62 / 69 / 101 | 68 / 65 / 108 | 77 / 57 / 110 |
| | medio | 65 / 75 / 65 | 83 / 62 / 63 | 96 / 36 / 68 | 98 / 34 / 70 | 99 / 29 / 71 |
| | experto | 91 / 55 / 50 | 98 / 41 / 44 | 100 / 22 / 44 | 100 / 20 / 45 | 100 / 18 / 47 |
| cámara acorazada d2 (2 · nv 4) | novato | 55 / 75 / 90 | 80 / 53 / 95 | 82 / 52 / 100 | 80 / 50 / 104 | 88 / 43 / 107 |
| | medio | 89 / 52 / 69 | 98 / 31 / 64 | 97 / 28 / 64 | 100 / 25 / 63 | 100 / 22 / 66 |
| | experto | 99 / 33 / 47 | 100 / 18 / 42 | 100 / 16 / 41 | 100 / 15 / 41 | 100 / 14 / 43 |
| cámara oculta d4 (3 · nv 12) | novato | 0 / 100 / 67 | 0 / 100 / 68 | 2 / 99 / 79 | 12 / 95 / 130 | 32 / 90 / 145 |
| | medio | 6 / 99 / 70 | 14 / 97 / 71 | 21 / 95 / 83 | 72 / 72 / 116 | 93 / 60 / 116 |
| | experto | 28 / 94 / 67 | 36 / 89 / 66 | 63 / 83 / 74 | 99 / 47 / 81 | 99 / 40 / 82 |
| baliza de desafío d3 (3 · nv 8) | novato | 3 / 100 / 80 | 5 / 100 / 87 | 32 / 90 / 130 | 35 / 89 / 141 | 49 / 79 / 147 |
| | medio | 23 / 95 / 79 | 37 / 90 / 85 | 84 / 61 / 106 | 90 / 57 / 109 | 95 / 45 / 105 |
| | experto | 56 / 83 / 69 | 82 / 72 / 70 | 100 / 38 / 72 | 100 / 36 / 73 | 100 / 30 / 73 |

Los otros dos riesgos para el jugador medio con hackeo nv 8: **Cauto** relé d3 100 % (27 % de traza), cámara d2 100 %, baliza d3 99 %; **Agresivo** (una capa más y +1 de
dificultad) relé d3 31 %, cámara d2 56 %, baliza d3 31 %; hasta el nv 12-20 no deja de ser una apuesta. Con hackeo nv 1-2 el riesgo Agresivo no está disponible (exige nv 3):
en la simulación se salta ese filtro y esa columna equivale a Estándar. Lectura: el nivel recomendado se nota (un jugador medio con el nivel recomendado gana el 72-98 % —la cámara oculta es lo más duro—;
sin él cae a 6-83 %); el relé de dificultad 1 es un regalo (> 97 % para todos) y dura 17-52 s; las cámaras ocultas y las balizas son contenido de nivel alto.

**3. Nivel de hackeo en la campaña** (jugador medio, riesgo Estándar, 60 campañas simuladas; por región: 3 relés + cámara + relé de estación + cámara oculta + baliza + 6
torretas o mecánicos): nivel al entrar en cada región 1,0 · 5,0 · 6,8 · 7,9 · 8,9 · 9,7 · 10,0 · 11,0 · 11,9; **al terminar las 9 regiones nv 12 (mín. 12, máx. 13)** con **117
hackeos** y **≈ 139 min** hackeando (≈ 2,3 h de una partida de decenas de horas) y 97 % de éxito. XP por nivel `round(16·n^1,55)`: acumulado L4 151 · L8 1 066 · L12 3 176 ·
L16 6 802 · L20 12 217; llegar al 20 exige repetir contenido (≈ 3 campañas de hackeos), que es lo previsto.

**4. Recompensas por riesgo** (esperanza por intrusión con éxito en una zona de nivel 10; créditos con `mt.credits` = 1 + 0,25·(nivel − 1) = 3,25)

| capas base · riesgo | capas reales | créditos | datos | cofre (tier) | prob. programa | plano de gadget | XP de hackeo |
|---|---|---|---|---|---|---|---|
| 1 · Cauto | 1 | 57 | 2 | — | 0,10 | — | 22 |
| 1 · Estándar | 1 | 72 | 2 | — | 0,17 | — | 26 |
| 1 · Agresivo | 2 | 257 | 5 | 2 | 0,60 | 20 % | 75 |
| 2 · Cauto | 2 | 114 | 2 | 1 | 0,20 | 20 % | 38 |
| 2 · Estándar | 2 | 143 | 3 | 1 | 0,35 | 20 % | 44 |
| 2 · Agresivo | 3 | 386 | 7 | 3 | 0,90 | 20 % | 115 |
| 3 · Cauto | 3 | 172 | 3 | 2 | 0,30 | 20 % | 57 |
| 3 · Estándar | 3 | 215 | 4 | 2 | 0,52 | 20 % | 68 |
| 3 · Agresivo | 3 | 386 | 7 | 3 | 0,90 | 20 % | 115 |

(El cofre de recompensa se **suma** al efecto propio del objetivo —p. ej. el contenedor de una «cámara acorazada», que sigue dando su tier 2— y sale del sistema de botín de ECONOMÍA
(`Co` → `ecoChestLoot`, tablas de `chest1-3`): un hackeo agresivo de 3 capas llega a tier 3, por eso solo es alcanzable con hackeo alto; el programa y el plano son el otro atractivo de la apuesta.)
Un chip cifrado de Archivo en una cámara acorazada: ≈ 14 % (estándar, 2 capas), ≈ 38 % (agresivo, 3 capas): 51/400 y 134/400 en `hackeo-lore`.

**5. Torreta controlada** (3 mechs inmóviles a 7 m; vida quitada en 14 s con la simulación real; la sim equipa un conjunto Raro del nivel de la prueba con el generador de la sim de talentos)
| nivel de los mechs | DPS del arma (conjunto Raro) | torreta controlada | con sobrecarga (Agresivo) | el jugador solo | torreta centinela (gadget) |
|---|---|---|---|---|---|
| 5 | 71 | 65 % | 100 % (3 muertos) | 33 % | 31 % |
| 15 | 314 | 53 % | 82 % (1 muerto) | 25 % | 22 % |
| 30 | 2 475 | 34 % | 52 % (0 muertos) | 29 % | 16 % |

La torreta controlada rinde ≈ 2× lo que hace el jugador solo a nv 5-15 (porque dispara sin recargar ni apuntar) y ≈ 1,2× a nv 30, y ≈ 2-2,2× la torreta centinela del gadget: una apuesta que
merece la pena sin sustituir al arma. Su daño sale de `hkPlayerDps()` (arma activa), así que escala con el equipo; en una primera medición con el arma inicial en todos los niveles
la torreta no araña a un mech de nivel 30 (0 %), por eso la sim equipa un conjunto del nivel de la prueba. Límite del modelo: el DPS «teórico» del arma sobrestima el real (munición, objetivo,
dispersión), de ahí que la proporción a nv 30 sea menor.

**6. Otras mediciones**
- **Presupuesto de render** (`hackeo-perf`, 960×540 medio, build minificada, antes → después; llamadas de dibujo): Bastión 533 → 531 · valle 525 → 525 · ciudad 294 → 293.
  Con un Módulo Hacker desplegado, una torreta enemiga y el marcador «HACKEAR» en pantalla: 297 (la ciudad sin ellos 293; el aumento incluye la malla de la torreta enemiga
  y la del módulo; el marcador es DOM y no dibuja nada). Sin asignaciones por fotograma: el barrido usa un vector reutilizado cada 0,2 s y el marcador solo toca el DOM cuando cambia de píxel.
- **Tamaño del artefacto**: 12,52 MB antes → 12,60 MB ahora (+≈ 80 KB de JS; límite 16 MB).
- **Migración**: guardado de la build anterior (nivel 9, 14 terminales hackeadas) → nivel de hackeo 5 retroactivo (14 × 22 XP), kit inicial (2 Disipadores + 1 Ralentizador, el Disipador
  ya cargado), `hackV = 1`, idempotente, JSON limpio y sin tocar créditos ni nivel (`hackeo-migrate`).
- **Móvil emulado** (`hackeo-ui`, Chromium con `--device pixel7`, toques CDP reales): apaisado 915×412 y vertical 412×915, **todas las comprobaciones pasan** (sin desbordes ni
  zonas táctiles < 36 px; zona de juego 633×347 apaisado y 388×644 vertical; nodo de enrutado 45 px / 59 px; marcador HACKEAR 178×44 px dentro de pantalla).
- **Regresión de los demás frentes** (build con el hackeo): humo 13/13 (dev y minificada), `gadgets-demo` 16/16 en escritorio (el Taller muestra ya 13 tarjetas: el guion se ajustó a «una
  por gadget»), `economia-escenas` 16/16, `talents-revision` TODO OK, `mobile-smoke` (pixel7) 8/8. No se ejecutaron en este frente `economia-hito/ui/migracion`, `talents-ui/oldsave`, `gadgets-layout/migrate`
  ni las sims de otros frentes (no tocamos su código; sí comparten `x.migrations`, comprobado con `hackeo-migrate`).
- **Mapa**: `hackeo-map` (huella FNV-1a del terreno y de las entidades, misma `--seed`): build antigua y nueva dan **idéntico** resultado —331 776 celdas `fcd6e89a`, 1 146 entidades
  `63ac1b1c`, `mapV` 3 sin tocar—. El frente no llama a `Lt()`/`e()` de la generación del mundo (su azar es `pi(semilla)` propio de `hkRng`).
- **Robustez** (`hackeo-stress`): 160 sesiones al azar (✕, Esc, Desconectar, otra sesión encima, resueltas con bots, tiempo agotado, con y sin pantalla previa) sin errores, sin sesión ni panel
  huérfanos, **0 escuchas de teclado/resize colgadas** y **0 temporizadores vivos** al terminar.
- **Integración con el Archivo real** (`hackeo-lore-real`, build combinada de este árbol + `31d-lore.js` del frente LORE en un directorio temporal): «Descifrar chip» en el Archivo abre el hackeo con
  el nombre real del chip, al cerrar el resultado el chip queda `q = 1` y legible, un chip fallido anota un intento sin darlo por descifrado, y la pista `complejo.clave` (una palabra de ejemplo en la
  partida de prueba) entra en el cifrado cuando el jugador la ha anotado.

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
  no hay control manual. Jefes y minijefes no se pueden hackear (ni tomar ni apagar) y las torretas aliadas del Bastión tampoco (no son enemigos).
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

**Resultado de las pruebas con el código final:** `hackeo-core` 46/46 (build de desarrollo), `hackeo-lore` 12/12 (minificada y desarrollo), `hackeo-lore-real` 7/7 (build combinada con el
Archivo real), `hackeo-ui` 22/22 en `pixel7` apaisado y 22/22 en vertical, `hackeo-stress` 5/5 (minificada), `hackeo-migrate` PASS, `hackeo-map` idéntico, humo 13/13 (minificada).

**Pruebas del frente:** `tools/scenarios/hackeo-core.mjs` (núcleo), `hackeo-lore.mjs` (contratos con LORE y teclado), `hackeo-ui.mjs` (interfaz y toques; `--device pixel7`
con y sin `--portrait`), `hackeo-migrate.mjs` (guardado antiguo), `hackeo-map.mjs` (el mapa no cambia), `hackeo-perf.mjs` (llamadas de dibujo), `hackeo-stress.mjs` (fugas), `hackeo-lore-real.mjs` (Archivo real) y la simulación
`tools/sim/hackeo.mjs`.

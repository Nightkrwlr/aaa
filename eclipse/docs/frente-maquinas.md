# Frente MÁQUINAS (D11) — máquinas hackeables que ayudan en combate y máquinas de un solo uso

Fragmento: `src/game/31j-machines.js` (≈ 1 000 líneas). Ajustes: `x.cfg.mach`. Estado guardado: `S.mach`. Pruebas en la página: `window.__mach`. Escenario:
`tools/scenarios/maquinas-core.mjs` (19 comprobaciones). Se apoya en el motor de hackeo (`docs/frente-hackeo.md`) sin cambiar su interfaz.

## Por qué

Feedback del jugador: «se supone que hay enemigos que puedo hackear, en lugar de hacerlo así, ya que no funciona bien y además los suelo matar primero, deberían haber
máquinas, drones, ametralladoras por ahí repartidas que estuvieran desactivadas y pudiera hackear para que me ayudaran en combate durante unos minutos y luego se
rompiesen o desactivaran o se quedasen sin batería y respawnearan aleatoriamente (con tiempo de reutilización). También estaría bien tener drones o máquinas exclusivas
de un solo uso que al hackearlas me guiaran hacia alguna pista o secreto, o quizá elevadores, ascensores, balizas que al hackear me trajeran objetos, podrían ser de Lore
o armas/equipo».

## Estado

**Los enemigos ya no se hackean a mano** (`x.cfg.hack.enemy.manual = false`): el marcador HACKEAR, la tecla V y el talento «Intruso» (que sube el alcance a 14 m) actúan sobre
**máquinas dormidas**; el módulo Hacker de los gadgets conserva su pulso sobre enemigos (`hkGadgetKind`).

**Reutilizables** (4 por región, 36 en el mundo, repartidas con la semilla de la partida la primera vez que se pisa el mundo): caídas y apagadas, a ≥ 28 m unas de otras y a ≥ 42 m
del Bastión (la primera de la región 0 aparece a 58-95 m para que se encuentre pronto). Se montan a menos de 46 m y se desmontan a más de 60.

| Tipo | Qué hace | Batería base (+6 s por nivel de hackeo) | DPS (× el de TU arma activa) | Alcance | Dificultad / capas |
|---|---|---|---|---|---|
| Torreta ametralladora | dispara sin parar; se queda donde la reactivas | 150 s (tope 300) | 0,9 (cadencia 0,13 s) | 15 m | 1 / 1 |
| Dron de combate | te acompaña en órbita (2,5 m) y dispara | 170 s (tope 320) | 0,85 (0,4 s) | 14 m | 1 / 1 |
| Robot guardián | te sigue a pie (4,4 m/s, se recoloca si se atasca) y cubre tu avance | 130 s (tope 260) | 1,0 (0,28 s) | 11 m | 2 / 1 |
| Dron médico | te acompaña (1,9 m) y te cura el 1,2 % de vida por segundo mientras estés por debajo del 95 % | 100 s (+4 s por nivel, tope 200) | — | — | 1 / 1 |

La batería se multiplica por el talento «Duración de torretas» (`turretTime`) y ×1,2 con el riesgo Agresivo (que además da ×1,2 de daño). Como máximo **3 aliadas a la vez**: al
reactivar una cuarta se apaga la de menos batería. A los 15 s de batería parpadea el aviso «BATERÍA BAJA»; al agotarse la máquina se apaga, queda la carcasa 20 s y se disuelve; la
casilla pasa a **enfriamiento de 11-18 minutos** de juego y reaparece **dormida en otro sitio al azar de su región** (lejos del jugador, a ≥ 52 m, para que no se vea cómo se coloca).
Las aliadas **no son enemigos**: no cuentan para el spawner, no se pueden herir ni matar y no dan botín; disparan proyectiles del jugador (con su DPS, su daño de torretas por talento y
el calor del hackeo) y llevan una etiqueta con la batería. Un hackeo fallido las bloquea 25 s y descarga al jugador (sin matarlo).

**Únicas** (una de cada por región, 27 en el mundo; se gastan para siempre en esa partida):

* **Dron explorador:** elige una pista o secreto de su región que el jugador **aún no ha descubierto** (documento del Archivo, cámara oculta, cámara acorazada, datáfono), calcula un
  camino (BFS sobre el mapa de suelo y tirar de la cuerda), te guía a 4,8 m/s esperándote si te quedas atrás (≥ 15 m) y, al llegar, **revela** el sitio (marca en el minimapa y en Hitos).
* **Baliza de suministros:** pide una cápsula del cielo que cae, se abre y deja **equipo del almacén central** (62 %, rareza ≥ Raro, Épico 12 %) o un **documento de lore** (34 %), más materiales.
* **Ascensor de carga:** abre la escotilla y sube un palé con **2-3 objetos** (equipo, módulos, materiales; chip de lore 40 %, documento 30 %, Épico 22 %) de las profundidades.

**Interfaz:** etiqueta de batería sobre cada aliada, marcador HACKEAR con el nombre y el nivel recomendado, aviso en el minimapa de las máquinas dormidas a menos de 62 m (y de lo que revela el dron explorador), línea de Hitos
(máquinas reactivadas, guías, balizas, ascensores) y consejo la primera vez. Todo el texto está en español.

**Guardado:** `S.mach = {v, seed, init, slots:{id:{id, k, reg, x, z, st, cd, lock, u, n}}, n, stats}`; `st` ∈ `dormant | active | cool | used`; las aliadas **no sobreviven a un guardado**
(su cuerpo no existe al cargar: vuelven a dormir donde estaban); migración idempotente que sanea huecos inválidos y estados sucios.

## Números medidos (`maquinas-core`, 19/19)

Medidos en la build de publicación `202610091242-3ae654f` (640×360, calidad baja):

| Qué | Resultado |
|---|---|
| Reparto con la semilla de la partida | **63 máquinas** (36 reutilizables + 27 únicas), 7 por región × 9 regiones, 0 errores de colocación; determinista (misma semilla → mismo reparto) |
| Por tipo | dron 16 · robot 7 · ametralladora 7 · médico 6 · guía 9 · baliza 9 · ascensor 9 |
| Separación | mínima entre reutilizables 30,3 casillas (límite 28); la primera de la región 0 sale a 91,5 m del Bastión (ventana 58-95) |
| Montaje | la máquina dormida existe como cuerpo solo cerca (< 46 m) y es candidata del marcador HACKEAR (`kind: machine`) |
| Torreta | batería 150 s, hiere a un enemigo: 60 de daño en 3 s frente a 86 teóricos (70 %, el resto es cadencia y puntería); no aparece en `enemies` |
| Seguimiento | dron a 2,4 m, robot a 3 m, médico a 1,9 m tras alejarse 14 m; la torreta se queda (a 17 m) |
| Médico | de 50 % a 56 % de vida en la ventana de prueba, solo mientras se está por debajo del 95 % |
| Fin de batería | pasa a `cool` con 774 s de espera (11-18 min), la etiqueta desaparece, la carcasa se disuelve y reaparece dormida a **65,6 m** de donde estaba, en su región y sobre suelo libre |
| Hackeo fallido | bloquea 25 s, descarga sin matar y vuelve a ser hackeable después |
| Límite de aliadas | 3 a la vez; la cuarta apaga la de menos batería |
| Dron explorador | elige «una cámara oculta» a 102 m, camino de 3 tramos, te espera, llega en 11 iteraciones, revela y queda gastado |
| Baliza | 1 cápsula (cae → reposa), 1 objeto de rareza Raro + 57 materiales |
| Ascensor | el palé sube de −2,8 a +0,15 m, 3 objetos de rareza Raro + 86 materiales |
| Guardado | `S.mach` es JSON puro, migración idempotente, estado sucio saneado |

Consola: sin `console.error` nuevos (el único `ERR_FAILED` es la hoja de tipografías de Google, inaccesible desde el entorno de pruebas y presente también en el smoke).

## Contratos

* `x.cfg.mach` (ver el fichero: tipos, baterías, enfriamiento, radios, límites). `x.cfg.hack.enemy.manual` (false) y `hkEnemyKind` / `hkGadgetKind` en `31e-hacking.js`.
* `hkScan` incluye `mxScan(p, rango)` (la máquina dormida hackeable más cercana con línea de vista); `hkStartEnemy` abre la sesión con `mxSpec(cuerpo)` (`target:"machine"`,
  `objetivo:"maquina" | "unica"`, `noRewards`, `onDone → mxHackDone`).
* Eventos: `ee("machineOn", nombre)`, `ee("machineOff", nombre, motivo)` (`bateria | relevo | muerte | apagada`); `window.__mach` (estado, cuerpos, `activate`, `shutdown`, `scan`,
  `path`, `guideTarget`, `relocate`, `newSlot`, `migrate`…).
* Las envolturas: minimapa (`ecoMinimapPings`) y Hitos (`ecoHitosHtml`); `It("toMenu")` y `It("playerDied")` (las aliadas se apagan al morir el jugador o volver al menú).

## Pendiente

* Las máquinas solo viven en el mundo abierto (no en subterráneos ni operaciones).
* Con el hackeo manual desactivado por defecto, los escenarios `hackeo-*` lo reactivan (`window.__hack.cfg.enemy.manual = true`) para seguir probando el motor de la sesión con enemigos.

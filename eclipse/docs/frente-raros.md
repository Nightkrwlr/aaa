# Frente RAROS (D13) — élites y raros del mundo, con mecánicas exclusivas, botín mejor y objetos especiales con misión

Fragmentos: `src/game/31k-rares.js` (colocación, aparición, 8 mecánicas) y `src/game/31k2-rares-loot.js` (botín, trofeos, objetos especiales, misiones, HUD, minimapa, diario).
Ajustes: `x.cfg.rare`. Estado guardado: `S.rare`. Pruebas en la página: `window.__rare`. Escenarios: `tools/scenarios/rares-core.mjs` (45 comprobaciones),
`rares-sim.mjs` (calibración de vida y daño), `rares-look.mjs` (capturas).

## Por qué

Feedback del jugador: «deberían existir enemigos élite o raros con mecánicas exclusivas, recompensas mejores (sin pasarse: equipo o material vendible), objetos especiales que inicien
misiones marcados como raros o especiales, respawn largo, y que a veces sean aleatorios y a veces únicos».

## Estado

Cada región tiene **2 casillas de raro** (18 en el mundo), repartidas con la semilla de la partida la primera vez que se pisa el mundo (≥ 56 m del Bastión, ≥ 60 m entre las de una
región, con un claro libre de radio 4; la primera de la región 0 sale a 62-104 m para encontrarla pronto). El 75 % empieza ocupado; el resto aparece pasados 4-15 min de juego.
La criatura solo existe como cuerpo mientras el jugador está cerca (se monta a 66 m, se desmonta a 90 m sin alertar y se reinicia si huyes a más de 121 m).

Son enemigos de verdad (`In`/`vp`): campeones con el modificador «raro» (anillo dorado, no enumerable en `Bd` para que `aa()` no lo reparta), nombre propio y nivel = nivel de la región
en ese punto + 1 (estable, sin el +1 al azar de `lvlAt`). **Su vida y su daño no dependen de la criatura que los encarna** (un Yeti o una Abominación tienen 10× la vida de una larva):
se normalizan a la mediana de los enemigos de línea de su región (`rqRef`), como si fueran un campeón corriente de esa región, ×1,5 de vida y ×1,12 de daño.

### Las 8 mecánicas

Cada arquetipo es una función `(e, R, dt, dist, pl)` que se ejecuta desde un envoltorio de `gadgetEnemyTick` (el motor lo consulta antes de la IA); devolver `true` congela la IA ese
fotograma (está en un acto con aviso). Todos los daños llevan **aviso rojo de peligro** en el suelo (los colores claros se quemaban con el bloom). Por debajo del 30 % de vida se
enfurecen (+12 % de velocidad, mecánicas un 28 % más seguidas).

| Arquetipo | Qué pide | Detalles (valores de `x.cfg.rare`) |
|---|---|---|
| **Mudadora** (insecto/mutante) | matar crías y esperar | muda a 70/40/15 % de vida: aviso 1 s, estallido de 4,4 m, **invulnerable 2,2 s** y suelta 2-4 crías; cada muda +10 % de velocidad y +6 % de daño y cura un 4 % |
| **Embestidora** (bruto/yeti/gólem…) | que se estrelle contra un muro | carril de aviso de 15 × 2,2 m (hilera de círculos rojos en el suelo cuyo relleno crece durante 1 s; sigue tu posición y se bloquea 0,3 s antes), embiste a ×4,6 de velocidad; si choca con un muro queda **aturdida 3,2 s y recibe ×1,35 de daño** |
| **Pararrayos** (mecánico) | destruir los pilones | 2 pilones tesla (3 desde el nivel 26) a 5-8 m: mientras vivan recibe **×0,28 de daño** (puntos de luz azules avanzan de los pilones hacia ella); lanza rayos con aviso de 1 s sobre tu posición; al caer los pilones queda **expuesta 4 s** |
| **Acorazada** (mecánico) | castigar tras su descarga | cerrada recibe **×0,2** y se regenera; cada 5 s descarga en un radio de 5,2 m (aviso 1,1 s) y **se abre 3,2 s: ×1,5** (5-8 veces más daño que cerrada) |
| **Atractor** (espectro/psiónico) | salir del radio | pozo gravitatorio de 7,5 m: aviso 1,4 s, **te arrastra a 4,6 m/s durante 1,8 s** y estalla en el centro (2,8 m); la criatura se queda quieta |
| **Chupasangre** (sanguijuela…) | romper la línea de visión | se engancha (aviso 0,8 s) y te drena (30 % del daño cada 0,5 s) curándose el 90 % de lo drenado; **sin línea de vista 0,35 s o a > 13 m el enlace se rompe** y queda aturdida 1,4 s |
| **Espejismo** (acechador) | encontrar a la real | 2 copias del mismo tamaño que no hacen daño, con el 4 % de la vida de la criatura base y sin anillo (la real lleva el anillo dorado y el nombre); se reponen cada 9 s; no dan botín ni cuentan para misiones |
| **Aura** (salamandra/gólem/elemental de hielo) | no quedarse quieto | cada 8-11 s planta 3 charcos escalonados (aviso 1 s, duran 5 s) bajo tus pies; fuego quema, **el hielo ralentiza** |

Una **barra del raro** bajo el reloj muestra `★ Raro · nombre · arquetipo`, su vida (azul cuando es invulnerable o está blindada) y el estado de la mecánica
(«¡VA A EMBESTIR!», «PROTEGIDA · PILONES 2», «ABIERTA · ¡ATACA!», «ENLACE · rompe la línea de visión»…). En el minimapa, estrella dorada (tenue hasta que lo ves, a 85 m).

### Reaparición

Al caer, la casilla entra en un enfriamiento **largo (25-40 min de juego)** y reaparece **en otro sitio de su región, lejos del jugador, con otra criatura al azar** (se evita repetir el
arquetipo que ya hay en la otra casilla de la región). Con un 24 % de probabilidad la criatura que sale es una **única** de su región, si queda alguna sin nacer.

### Únicas (9, una por región; nacen una sola vez por partida y no vuelven)

Siempre sueltan su **objeto especial ★** (con historia), que inicia una misión propia (la de una única Rara/Épica por región: R0-R2 Raro, R3-R8 Épico):

| Región | Única (arquetipo) | Objeto especial | Misión |
|---|---|---|---|
| Valle Esmeralda | Sargento Hueco (Mudadora) | Placa de identificación calcinada | «Nombre y apellido»: llevarla a Reyes |
| Ciudad Caída | La Locutora (Chupasangre) | Cinta de emisión interrumpida | «La otra voz»: llevarla a Lucía |
| Desierto de Ceniza | Espejismo Dorado (Espejismo) | Brújula de la caravana perdida | «El alijo de la caravana»: **hallazgo** (ir al lugar marcado; allí hay un alijo de nivel 3) |
| Marisma Tóxica | El Hongo Viejo (Mudadora) | Frasco de esporas ámbar | «Cura de la marisma»: llevarlo a Ignacio |
| Tundra Glacial | Colmillo Blanco (Embestidora) | Trampa dentada, vieja | «Una trampa vieja»: llevarla a Nadia |
| Complejo Prometeo | Unidad PROM-7 (Acorazada) | Núcleo de memoria PROM-7 | «Memoria de máquina»: llevarlo a ARGOS |
| Caldera Ígnea | Rey de Ceniza (Aura) | Veta de obsidiana tallada | «El plano de la obsidiana»: **hallazgo** |
| Yermo Radiactivo | Eco Mudo (Pararrayos) | Dosímetro con un nombre grabado | «Rastro del explorador»: **rastro** (ir al lugar marcado y luego contárselo a Viktor) |
| La Colmena | La Cantora (Atractor) | Fragmento de partitura viva | «Coro roto»: llevarlo a Eco |

Los **raros corrientes** sueltan con un 12 % un objeto genérico por familia (8 posibles) que inicia un «Encargo especial» (llevarlo al superviviente de la región); como mucho 2 sin entregar.
Los objetos se guardan en `S.rare.items`, inician su misión al instante si hay hueco entre los encargos (si no, quedan pendientes y se asignan solos, sin avisar cada vez),
**no se pueden abandonar** y se listan en Archivo → Hitos con su estado.

### Botín (mejor, no excesivo)

* **Pieza de equipo garantizada, nunca por debajo de Raro:** Raro 89 %, Épico 10 %, Legendario 0,9 %, Mítico 0,1 % (la suerte solo multiplica los tramos ≥ Raro).
* **Trofeo vendible propio** (`rq_<arquetipo>_<región>`; las únicas, uno propio): vale ≈ 2,4× el mejor trofeo corriente de su región (las únicas ≈ 4,2×; un jefe, ≈ 5,5×), cuenta para las mejoras del
  Bastión y aparece en la pestaña Botín como «Jefes y raros».
* Núcleos (1-2), datos (0-2) y las tiradas de la tabla `rare` (créditos ×16, módulos 0,8 y planos 0,15 de esperanza; gadgets: 30 % de plano hasta nivel 4). La XP es la de un campeón (×12 de la base).
* Ritmo: un jugador que se queda en una región ve ≈ 4 raros/hora → ≈ 0,5 piezas Épicas o mejores por hora (del equipo garantizado) además del resto del botín.

## Números medidos

**Colocación y montaje** (`rares-core`, 45/45): 18 casillas de raro (2 por región) con 71,4 m de separación mínima (≥ 60), la primera de la región 0 a 85,4 m del Bastión (62-104) y 12 de 18 ocupadas al empezar (75 %);
el reparto es determinista con la semilla de la partida y las tiradas dan los 8 arquetipos y las 9 únicas. El cuerpo no existe a 130 m, se monta a 30 m sin duplicarse, se descubre a < 30 m con línea de vista (o a 9 m) con
marca, aviso y evento una sola vez, y lejos y sin alertar se desmonta sin botín (la casilla sigue lista). Nivel = región + 1 (estable) y vida ×1,5 respecto a un campeón de la mediana de su región.

**Mecánicas** (cada una con su prueba): Mudadora, mudas a 70/40/15 % (3, ni una más), invulnerable durante la muda, 2 crías y +10 % de velocidad / +6 % de daño por muda · Embestidora, aviso de 1 s, embestida que golpea (48 de daño)
y empuja, aturdida 3,2 s con ×1,35 de daño al estrellarse · Pararrayos, 3 pilones a 5,2-7,7 m con la protección ×0,28 (×0,21 de daño efectivo); rayos con aviso de 1 s; al caer los pilones queda expuesta 3,9 s (daño ×4,6 respecto a protegida)
· Acorazada, cerrada ×0,2, abierta 3,2 s con ×1,5 (7,5 veces más daño abierta que cerrada) · Atractor, pozo con aviso que arrastra a 4,4 m/s hasta el centro (mínimo 0,6 m) y estalla; fuera del radio de 14 m, ni arrastre ni daño
· Chupasangre, enlace con aviso, drena 82 y se cura 54 en la prueba; sin línea de vista el enlace se rompe (retroceso de 1,3 s) · Espejismo, 2 copias sin daño con el 4 % de la vida de la criatura base (≈ 0,4 % de la del raro),
sin botín ni progreso de misión · Aura, 3 charcos escalonados (120 de daño en la prueba) o, en el hielo, ralentización · Furia, por debajo del 30 % de vida +12 % de velocidad y mecánicas un 28 % más seguidas.

**Botín** (`rares-core`): pieza de equipo nunca por debajo de Raro con el reparto medido [Raro 89,1 · Épico 9,8 · Legendario 0,9 · Mítico 0,1 %]; trofeo vendible de 50 ¤ frente a 21 del mejor trofeo corriente de la región (×2,4), 88 el de una única (×4,2) y 115 el de un jefe;
objeto especial ★ de la única siempre, y de los corrientes con un 12 % y como mucho 2 pendientes; las misiones se pagan (132 ¤ y una pieza Rara en la prueba de «Nombre y apellido»). Núcleos 1, datos 1 y materiales en cada abate.

**Reaparición:** 26,6 min de juego en la prueba (rango 25-40), en otro sitio de la región (138,8 m de desplazamiento) y con otra criatura; con la probabilidad al máximo sale la única de la región.

**Calibración** (`rares-sim`, el nivel medio de cada región con el equipo que se espera en él, DPS real del motor): tiempo para abatir sin contar las fases de protección o invulnerabilidad de la mecánica,

| Región | Nivel del raro | DPS del jugador | Vida del jugador | Tiempo de abate | Golpe base del raro (% de tu vida) |
|---|---|---|---|---|---|
| 0 Valle Esmeralda | 5 | 56 | 151 | 15,5 s | 35 (23 %) |
| 1 Ciudad Caída | 11 | 131 | 220 | 24,9 s | 59 (27 %) |
| 2 Desierto de Ceniza | 17 | 272 | 315 | 58,5 s | 102 (32 %) |
| 3 Marisma Tóxica | 21 | 480 | 421 | 43-50 s | 100-137 (24-32 %) |
| 4 Tundra Glacial | 26 | 921 | 878 | 82,3 s | 212 (24 %) |
| 5 Complejo Prometeo | 31 | 1 822 | 1 022 | 125,1 s | 500 (49 %) |
| 6 Caldera Ígnea | 36 | 3 970 | 1 403 | 103,3 s | 547 (39 %) |
| 7 Yermo Radiactivo | 41 | 7 683 | 2 182 | 122,5 s | 1 027 (47 %) |
| 8 La Colmena | 47 | 16 789 | 2 636 | 150,4 s | 1 006 (38 %) |

(mínimo 15,5 s · mediana 103,3 s · máximo 150,4 s). Dentro de una misma región todos los arquetipos tienen la misma vida y el mismo daño: la dificultad la ponen las mecánicas, no el cuerpo que las lleva (un Yeti o una Abominación valen lo mismo que una larva).
Como referencia, un campeón corriente de la mediana de la región tarda 2/3 de eso.

**Nota de efectos:** los haces del motor (`x.fx.beam`) llevan siempre un núcleo casi blanco que el bloom expande; repetidos cada fotograma (un enlace) dejaban una neblina que tapaba media pantalla (se midió quitando los haces, con la misma escena, y la neblina desapareció).
Los enlaces se dibujan por eso con una hilera de charcos de luz del suelo que avanza hacia el destino (`rqFlow`, dibujo inmediato) y los carriles con círculos de aviso (`rqLane`); todos los avisos de daño son rojos (`x.cfg.rare.teleCol`).

## Contratos

* `x.cfg.rare` (ver el fichero: colocación, radios, enfriamiento, normalización, parámetros de cada mecánica, `itemP`, `itemMaxHeld`, `quest`). Tablas de botín: `x.cfg.econ.rar.rare`, `x.cfg.econ.rar.rareGear`, `x.cfg.econ.drop.rare`, `GD_CFG.plan.rare`.
* Enemigo: `e.rq = {slot, arch, uniq, name, ice, t, status, act, stun, vuln, armor, rage, cdMul, kids}`; los pilones llevan `rqPylon` y las copias `rqDecoy`.
* Eventos: `ee('rare', 'seen'|'slain'|'item', datos)`. Estado: `S.rare = {v:1, seed, init, slots:{id:{id,reg,x,z,st,cd,arch,base,uniq,name,ice,seen,n}}, n, uniq:{id:1}, items:[…], seq, tip, stats:{kills, uniq, items, byArch}}`
  (migración idempotente que saca huecos inválidos, únicas fantasma y objetos duplicados).
* Objetivo de misión nuevo `{t:"rq", k:"reach", x, z, r, n, label}` con `ht.objText` y `ht.target` envueltos (marca en el mapa y en la brújula). `ht.abandon` ignora las misiones con `def.rq`; `ht.onKill` ignora las copias.
* `sxNemKiller` envuelto: un raro (o sus pilones y copias) no se convierte en Némesis al matar al jugador.
* `window.__rare = { cfg, RQA, RQU, RQM, RQ, state, slots, init, spot, roll, reborn, newSlot, mount, spawn, lvl, ref, sweep, dispose, live, migrate, seen, tick, loot, hud, pings, hitos, nemKiller, hs }`.

## Pendiente

* Contratos de cacería en el Tablón para los raros ya vistos (como los del Némesis) y una pista de rumores en los diálogos de los supervivientes.
* Modelos propios: hoy se usan los modelos de los enemigos base con anillo dorado y tamaño ×1,2-1,4.
* Más arquetipos (reflejo de daño, marca de la presa) y únicas con cadenas de dos pasos.

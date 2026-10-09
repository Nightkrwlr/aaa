# Frente JEFES Y GUARIDAS (D8)

Fragmento: `src/game/31g-bosses.js` (todo el frente vive ahí salvo cuatro cambios mínimos en ficheros antiguos, listados al final).
Escenarios: `tools/scenarios/jefes-sello.mjs` (26), `jefes-fases.mjs` (24), `jefes-botin.mjs` (18), `jefes-guarida.mjs` (17).
Ajustes (todo son datos): `x.cfg.bossGate`, `x.cfg.bossSig`, `x.cfg.bossLoot`, `x.cfg.lair`.

## Estado

**Hecho: las tres piezas de D8.** El jefe de región ya no sale en un claro al acercarse: hay que ganárselo, vive en una guarida, se
pelea en tres fases y suelta reliquias muy raras.

### 1. Sello de la guarida (requisitos)

Mientras el jefe de una región no ha caído, su guarida está *sellada* y exige tres cosas:

| Requisito | Regla | Dónde se ve |
|---|---|---|
| **Misión** | Tener aceptada (o completada) la misión principal que pide abatirlo (`m4`, `m7`, `m10`, `m12`, `m14`, `m16`, `m18`, `m20`, `m22`). Su contacto solo la ofrece al terminar la anterior: obliga a hacer antes la cadena de misiones de la zona. | Aviso al acercarse a la arena |
| **Nivel** | Nivel de esa misión − `lvlSlack` (1): 4, 9, 14, 19, 24, 29, 34, 39, 45. | Línea de la misión y aviso |
| **Sellos** | «Fragmentos de sello»: 3, 3, 4, 4, 5, 5, 6, 6, 7 por región. Se ganan jugando la región; cada fuente da como mucho `caps[fuente]` (élites 3, nidos 2, terminales 2, registros del Archivo 2, encargos secundarios 2, puzles 2, operaciones 2) y lo mismo no cuenta dos veces. | Aviso al ganar uno (`x/y`), línea de la misión y aviso en la arena |

La línea de la misión del jefe dice, por ejemplo: `Derrota a Reina de la Plaga: 0/1 · guarida sellada (nivel 4 · sellos 1/3)`.
Los jefes de operaciones y los secretos (altar) no se tocan. En partidas anteriores, las terminales ya hackeadas cuentan como sellos
(migración idempotente); quien ya abatió un jefe no necesita sellos.

### 2. Guaridas

Con la guarida abierta, el centro de la arena de la superficie es un **altar** (anillo y haz de luz: rojo apagado si está sellada, cian
si está abierta). «USAR» (o el botón táctil) baja a una mazmorra propia por región, generada con el mismo generador de mazmorras que los
subterráneos (diseño «minijefe»: sala grande con pilares) y el tema de su zona:

| Región | Guarida | Generador |
|---|---|---|
| Valle | Nido de la Matriarca | gruta |
| Ciudad | Metro derrumbado | alcantarilla |
| Desierto | Templo enterrado | gruta |
| Marisma | Cueva de esporas | gruta |
| Tundra | Caverna de hielo | gruta |
| Complejo | Núcleo del laboratorio | búnker |
| Caldera | Tubo de lava | gruta |
| Yermo | Necrópolis del cráter | búnker |
| Colmena | Cámara de la Mente | colmena |

1. **Antesala:** las manadas de guardianes de siempre (≥ 2 en las 54 guaridas generadas en las pruebas) y, a veces, un acertijo (D7).
2. **Sala media:** un **guardián** (versión reducida del jefe, 30 % de su vida, sin alertar) tiene cerrada la puerta de la arena. El marcador de
   objetivo señala dónde está. Al caer, la puerta se abre.
3. **Arena:** al entrar se cierra la puerta a la espalda y, a los 1,4 s, aparece el **jefe de verdad** (nivel de su región, tres fases).

Al vencerlo cuenta como primera muerte (abre el paso a la zona siguiente, Sigilo, expediente de lore, avance de la misión) y el cofre es de
nivel 3. La guarida se puede repetir a los **45 min** (`cooldownMin`). El claro de la superficie **ya no invoca al jefe** (ni la primera vez ni
al repetir); para quien ya los había abatido, el altar se activa igual sin pedir sellos.

### 3. Combates en tres fases

Los 9 jefes de región y los 5 secretos pasan de una transición única al 50 % a tres fases (100 → 66 → 33 % de vida): aviso, invulnerabilidad
de 1,6 s al rugir, +10 % de daño y +8 % de velocidad por fase, movimientos nuevos y **una mecánica propia**:

| Mecánica | Qué hace |
|---|---|
| `escudo_cria` | −65 % de daño recibido mientras vivan sus crías (se cuentan las vivas cada 0,25 s) |
| `pilares` | generadores (torretas o centinelas) lo hacen **invulnerable** hasta destruirlos; al caer el último queda aturdido 3 s y recibe +50 % |
| `zonas` | círculos de daño telegrafiados sobre el jugador (uno en su posición prevista y otros alrededor) que estallan a 0,9-1,2 s |
| `vacio` | te arrastra hacia el jefe y detona al terminar; se evita esprintando o saliendo del radio |
| `ventisca` | el frío ralentiza al jugador lejos del jefe (obliga a pelear cerca o a media distancia) |

| Jefe | Fase 2 | Fase 3 |
|---|---|---|
| Reina de la Plaga | Cría protectora (escudo de crías) | Nidada frenética (escudo + zonas de ácido) |
| El Demoledor | Derrumbe (zonas) | Terremoto (más zonas) |
| Kharsa | Arenas movedizas (zonas) | Tormenta de aguijones |
| Madre Espora | Esporas protectoras (escudo) | Podredumbre (escudo + zonas tóxicas) |
| Wendigo | Ventisca | Cacería (ventisca + zonas de hielo) |
| Prototipo OMEGA | Generadores de escudo (2) | Sobrecarga (3 generadores + zonas) |
| Ifrit | Anillo de fuego (zonas) | Erupción |
| Horror Isotópico | Gravedad (vacío) | Masa crítica (vacío + zonas) |
| La Mente Colmena | Voluntad colectiva (escudo de crías) | Eclipse mental (3 nodos + vacío + zonas) |
| Carnicero, Centinela Antiguo, Leviatán, Titán de Hierro, Avatar del Vacío | una mecánica cada uno (zonas / generadores / vacío) | más intensa; el Avatar las combina todas |

**Temporizador de furia:** si el combate se alarga, el jefe se enfurece (daño ×1,35, velocidad ×1,15, pausas ×0,75). Dura 210 s + 14 s por región
(300 s los secretos, 360 s el Avatar) y **no corre con el jefe invulnerable**. La barra de jefe tiene marcas en el 33 % y el 66 % y enseña la fase,
la mecánica, los generadores restantes y la cuenta atrás de la furia. Los «Vástago» de las operaciones conservan su fase única.

### 4. Reliquias de jefe (D8c)

30 planos con nombre propio, base y poder fijos: 2 por jefe de región y secreto, 3 la Mente y 3 el Avatar (dos de ellos Míticos con dos poderes:
«Eclipse» y «Fin de la Luz»). Lo más raro del juego a propósito (ECONOMÍA fija el primer Legendario en ~20-30 h):

| Jefe | Prob. por muerte | Garantía | Muertes hasta la primera (simulado, 400 pruebas) | Hasta las dos o tres |
|---|---|---|---|---|
| región | 2 % | a las 40 | 27,8 de media (máx. 40) | 55 |
| secreto | 4 % | a las 25 | 15,9 (máx. 25) | 31 |
| Mente / Avatar | 6 % | a las 15 | 9,8-10,1 (máx. 15) | 30-31 |

En la guarida la probabilidad es ×3 y la garantía llega antes (÷3: a las 14 muertes en vez de 40). Nunca se repite una reliquia conseguida. Si ya
tienes esa base, el plano pasa a ser la reliquia (nombre, poder y rango) y además suelta módulos y materiales como un plano repetido. Los
«Vástago» y los jefes de operaciones normales no sueltan reliquias. Registro en la pestaña de hitos del Archivo («2 / 30 reliquias de jefe»,
las no conseguidas ocultas como «???»).

## Números medidos (build 202610090548, GL por software)

* **Fases (`jefes-fases`, 24/24):** los 14 jefes pasan por las 3 fases, con bloqueo breve, +10 % de daño por fase y movimientos nuevos; generadores,
  aturdimiento (+50 %), escudo de crías (×0,35), zonas (el jugador parado recibe el golpe sin morir), vacío (acerca al jugador de 17,9 m a 8,1 m),
  ventisca, furia (×1,35 / ×1,15, el reloj se detiene con generadores) y limpieza de generadores al morir el jefe.
* **Guaridas (`jefes-guarida`, 17/17):** 54 mazmorras generadas (9 regiones × 6 semillas) sin una sola excepción: encuentro, puerta, salida, arena grande,
  sala media y arena alcanzables desde la entrada y guardián sobre suelo. Flujo completo en la región 0: altar → descenso → guardián → puerta → jefe real
  (nivel 7, fase 2 al bajar del 66 %) → primera muerte (jefe abatido, cooldown, cofre de nivel 3, Sigilo, misión «Regicidio» 1/1) → salida → altar «en calma»
  → a los 45 min vuelve a estar abierto. La superficie no invoca al jefe ni pasados 30 min.
* **Reliquias (`jefes-botin`, 18/18):** tabla válida (30, bases únicas y existentes, poderes del tipo correcto, Míticas con dos poderes), objetos
  con estadísticas finitas, simulación de probabilidad y garantía (tabla de arriba), caída con pilar de luz y hito, recogida, conversión del plano, registro y migración.
* **Sellos (`jefes-sello`, 26/26).**

## Contratos

* `x.cfg.bossGate`, `bossGateAdd(región, fuente, clave)` para sumar sellos desde otros frentes; `window.__bossGate = { status, add, seals, text, cfg, emit }`.
* `window.__lair = { cfg, status, enter, op, ready, map, bfs, gateKind }`; el encuentro es `enc: "lair"` en el gestor de encuentros (`Ni`).
* `window.__bossLoot = { cfg, byId, state, roll, drop, item }`; `S.relics = { v, own, pity }`, `S.bossGate`, `S.world.lair` (todos con migración idempotente).
* Evento nuevo: `ee("relic", id)` al recoger una reliquia.

## Cirugía en ficheros antiguos

* `21-enemies.js`: se quita la transición única al 50 % (la sustituyen las fases), `this.phase >= 2` en `startMove` y `bossMoveGap` en la pausa entre movimientos.
* `27-hud.js`: la etiqueta de la barra de jefe es `bossHudTag(g)`.
* `22-quests.js`: la línea «Derrota a X» añade `bossGateText`.
* `26-spawner.js`: `arenaCheck` llama a `bossGateArena` antes de invocar al jefe de la superficie.

Todo lo demás son envoltorios desde `31g-bosses.js` (`vp.prototype.updateBoss`/`dmgTakenMul`, `ih.prototype.createMesh`/`promptFor`/`interact`, `_x`, `Ni.*`, `Ss`, `ecoHitosHtml`).

## Pendiente

* **Equilibrio con jugadores reales:** los umbrales de sellos y niveles, la vida del guardián (30 %), el tiempo de furia y las probabilidades de reliquia son una
  propuesta mía comprobada con simulaciones y bots; no hay datos de jugadores. Se ajustan en `x.cfg.*` sin tocar lógica.
* **Presencia visual de las guaridas:** el altar es un anillo y un haz de luz; no hay modelo propio de entrada ni arte de cada guarida más allá del tema del generador.
* Los jefes secretos (altar) siguen en la superficie con sus fases; no tienen guarida propia.
* Ver `DEPTH_DESIGN.md` §5 para D9 (mundo orgánico) y D10 (sorpresas).

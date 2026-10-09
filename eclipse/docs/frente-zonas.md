# Frente ZONAS (D12) — salidas tranquilas e interiores orgánicos de cuatro tamaños

Fragmentos: `src/game/31e2-zonas.js` (salida tranquila) y `src/game/31e3-interiores.js` (generador de interiores). Ajustes: `x.cfg.zonas` y `x.cfg.zg`. Pruebas en la página:
`window.__zonas` y `window.__zg`. Escenarios: `tools/scenarios/zonas-salida.mjs` (11 comprobaciones) e `interiores-core.mjs` (52).

## Por qué

Feedback del jugador: (1) «al salir de una zona me esperan enemigos pegados a la salida»; (2) «las mazmorras, sótanos y zonas en las que puedo entrar no deberían ser habitaciones rectas con
ángulos: rutas con giros naturales, formas más redondas, de tamaños variados (pequeñas, medianas, grandes, enormes), siempre procedurales».

## 1 · Salida tranquila (`31e2-zonas.js`)

Antes, al salir de un sótano o de una operación se regeneraba todo el exterior de golpe: las manadas del edificio (su estado se perdía al descargar el mundo) y las del spawner ambiental
aparecían junto a la salida. Ahora:

* **Gracia de 30 s** (`exit.graceS`) tras las tres salidas hacia el mundo (`leaveSub`, `extract`, `abortOp`; la gracia empieza *antes* de recargar el mundo porque `loadWorld` ya hace una comprobación inmediata de
  manadas): las manadas del lugar a menos de 24 casillas esperan (`held`) y el spawner ambiental no actúa.
* Pasada la gracia, una manada retenida solo aparece si el jugador está al menos a **11 casillas** de ella (`minSpawn`); el spawner ambiental espera 9 s más.
* Las **manadas despejadas se guardan** en `S.world.packs` (marca de tiempo real) y no reaparecen al volver de una zona ni al recargar la partida (hasta que pasa el enfriamiento de manadas `Fi.pack`).
  Migración idempotente para partidas antiguas.

Medido (`zonas-salida`, 11/11): con la gracia a 0 aparecen 5 enemigos junto a la salida; con la gracia, **0 enemigos a 24 casillas durante los primeros 24 s** (168 manadas retenidas en el barrido), 0 a menos de
11 casillas al terminar, y la manada aparece con normalidad (3 enemigos) al alejarse a 17; despejada, no reaparece al volver ni tras descartar el estado del mundo.

## 2 · Interiores orgánicos (`31e3-interiores.js`)

Sustituye al generador de subterráneos `_x` (sótanos, plantas, grutas, colmenas, búnkeres y alcantarillas) y envuelve el toolkit `sp` de las operaciones (`yx`) para que también salgan redondeadas.

* **Formas de sala** (no más rectángulos): círculos con ruido, blobs de cueva, «squircles» (rectángulos de esquinas redondeadas), octógonos suaves, cruces redondeadas, salas de 2-3 lóbulos, cacahuetes y anillos con
  isla central; los pesos dependen del tema (`x.cfg.zg.shapes`: gruta/colmena orgánicas, sótano/planta más ortogonales, alcantarilla alargada). La arena del encuentro usa solo formas de centro libre.
* **Pasillos con giros:** curvas de Bézier con ruido entre salas (túneles de cueva en grutas y colmenas), de anchura variable a lo largo del trayecto; bucles extra (`loops`) para que haya más de una ruta.
* **Cuatro tamaños** (procedurales: salas, forma y trazado salen de la semilla de la escalera; el tamaño, de las probabilidades por tipo de escalera):

| Tamaño | Lado | Salas extra | Radio de sala | Manadas | Botín | Probabilidad (sótano / planta / cueva / colmena / gruta / alcantarilla) |
|---|---|---|---|---|---|---|
| Pequeña | 48 | 1-2 | 4,2-6,2 | ×0,9 | ×1 | 38 / 34 / 20 / 10 / 20 / 15 % |
| Mediana | 64 | 3-5 | 4,6-7,4 | ×1 | ×1 | 42 / 46 / 35 / 30 / 40 / 35 % |
| Grande | 88 | 6-9 | 5-8,6 | ×1,15 | ×2 | 17 / 20 / 30 / 40 / 30 / 35 % |
| Enorme | 116 | 10-15 | 5,2-9,6 | ×1,3 | ×3 | 3 / 0 / 15 / 20 / 10 / 15 % |

  Al entrar, un aviso dice «Zona mediana · 6 salas». La entrada, la sala del encuentro (escalada por el tamaño), las manadas, el botín, los sellos, la cámara sellada, el atrezo y los acertijos de 31f se reparten
  con las mismas reglas de siempre. Los envoltorios de 31f (acertijos) y 31g (guaridas de jefe) se apoyan en el mapa devuelto sin cambios.

  **El tamaño es fijo por escalera** (sale del identificador de la escalera: «esta cueva es grande» en todas las visitas); lo que cambia en cada visita es el trazado. Dos reglas lo acompañan:
  una escalera con acertijo (`pzWants`, la misma tirada estable de 31f) **nunca sale pequeña** (`x.cfg.zg.puzzleMedium`): las zonas medianas o mayores traen un salón donde cabe cualquier acertijo
  (el mayor mide 8×7) y así su tipo y su nivel no dependen de la forma del mapa de cada visita; y las **guaridas de jefe** (31g usa este mismo generador con el encuentro de minijefe) salen
  siempre medianas, grandes o enormes (40 / 45 / 15 %, `odds.lair`); el guardián, la puerta y el jefe los pone 31g sobre el mapa devuelto.
* **Garantías:** conectividad total desde la entrada, todas las entidades sobre suelo libre, un hueco de acertijo de 9×7 en toda zona mediana o mayor, **nunca menos de dos manadas** y, si algo falla, **hasta
  6 intentos** (bajando de tamaño tras el tercero) y, como último recurso, el generador antiguo (la partida nunca se queda sin mapa).

## Números medidos

* **Generador en Node** (864 mapas: 4 tamaños × 6 tipos de escalera × 36 semillas): 0 fallos de conectividad o de colocación, 0 vueltas al generador antiguo; salas por zona (media): pequeña 3,7 · mediana 6 · grande 9,4 · enorme 14,5;
  el acertijo 9×7 cabe en el 100 % de las medianas o mayores.
* **En el juego** (`interiores-core`, 52 comprobaciones): las 12 combinaciones tamaño × tipo (sótano, cueva, alcantarilla) se generan con el lado pedido, el jugador aparece sobre suelo libre y **llega andando de verdad
  (joystick virtual y colisiones) desde la entrada hasta la arena**: pequeña en 234-282 fotogramas (≈ 8-9 s), mediana 282-448, grande 456-551, enorme 613-1 000; el encuentro arranca al entrar en la arena (salvo acertijo y
  defensa del equipo) y la salida devuelve al mundo sin nada colgado. Reparto de tamaños sin forzar: sótano 44 % pequeña · 36 % mediana · 18 % grande · 3 % enorme; colmena 10 · 26 · 50 · 15 %.
* **Operaciones** (`yx`, mapas de 98-104): con el generador antiguo había 11, 11, 1 y 13 salas grandes perfectamente rectangulares (de 15-16); **ahora 0 en las cuatro**, con la misma superficie de suelo (±15 %) y todas las
  entidades alcanzables.

## Contratos

* `x.cfg.zonas` (ver el fichero), `x.cfg.zg` (clases, probabilidades por tipo de escalera y `lair`, formas, `puzzleMedium`, `tryMax`, `enabled`: con `false` vuelve el generador antiguo, también en las operaciones).
* El mapa que devuelve es el de siempre (`Fa`: `ter/wh/dark/var`, `ents`, `rooms` [entrada, cadena, arena, laterales], `encRoom`, `floorT`, `spawnBase`, `totalPacks`) más `m.zg = {name, cls, rooms, edges}`; se le aplica `ME` (giro/espejo).
* `window.__zonas = { cfg, ZN, grace, start, save }` y `window.__zg = { cfg, build, generate, pickClass, hash, walkSeen, lastFail, cls, key, wants, shapes, old }`.

## Pendiente

* Una pista visual en el minimapa de las zonas enormes (las salas lejanas se descubren a medida que se visitan).

# Frente MUNDO ORGÁNICO (D9) — caminos que serpentean, ríos y lagos, fronteras rotas

Fragmento: `src/game/31h-world2.js`. Ajustes: `x.cfg.world2`. Pruebas en la página: `window.__world2`. Escenario: `tools/scenarios/mundo-organico.mjs` (13 comprobaciones).

## Por qué

Feedback del jugador: «el mundo exterior se siente como un tablero: regiones cuadradas, rectas de roca entre ellas, caminos rectos». El mundo son 576×576 casillas en 3×3 regiones cuadradas de 192
(`vx(7331)` en `17-worldgen.js`); la generación original ya tenía lagos por ruido y caminos de dos tramos con un quiebro, pero las fronteras eran bandas rectas de 2-3 casillas y los
caminos, líneas casi rectas.

## Principio de diseño

La pasada se ejecuta **después** de `vx` (y envuelve `mE`, que dibuja los caminos), con su propio ruido y su propio RNG sembrados con la semilla del mapa: no consume el RNG de `vx` ni el del juego.
**Todo lo que `vx` coloca queda exactamente donde estaba y con los mismos identificadores** (entidades, puntos de interés, regiones, fronteras, variantes de suelo, puertas, edificios): los guardados
antiguos siguen valiendo, `mapV` no cambia y el mundo es el mismo para todos los jugadores. Cada rasgo se aplica con un **diario de cambios** y se **valida con una inundación desde el Bastión**: si
algo que era alcanzable deja de serlo se tiende un **vado** (casillas de camino) por donde menos casillas pintadas hay que cruzar y, si aun así no sirve, el rasgo se deshace entero.

## Estado (qué hace hoy)

* **Caminos sinuosos.** `mE` se envuelve: se consumen las **mismas dos tiradas** del RNG de `vx` (todo lo que se coloca después, atrezo incluido, queda como estaba) y el trazado sale de un A* de 8
  vecinos sobre un coste con ruido (`roads.amp`): rodea lagos, rocas y edificios, aprovecha los caminos que ya hay (coste 0,35) y serpentea. Une los mismos extremos que antes; si algo fallara se pinta
  el camino original reproduciendo las dos tiradas. Ancho 2-3 casillas (`roads.rad`). El A* usa búferes reutilizados (437 caminos en ≈ 0,3 ms cada uno).
* **Ríos y lagos de cada región** con su propio líquido (agua, ácido, hielo, lava; `plan`): trazado A* con ruido que rodea todo lo construido, suavizado y de ancho variable. Los caminos que
  cruzan un río se quedan como camino (vado natural); el resto de cruces los tiende la validación. En la Tundra el río es de hielo y se puede pisar; en la Caldera es de lava y solo se cruza por vados.
* **Faldas de frontera.** La roca natural crece junto a la banda de frontera con un alcance que varía con el ruido (hasta 7 casillas: lóbulos y bahías), sin tocar la banda, los corredores de las puertas,
  los edificios ni las entidades: la frontera deja de ser una recta.
* **Guardados antiguos.** Las máquinas y los raros ya guardados que caigan sobre agua o roca se mueven al suelo libre más cercano al cargar el mundo (`w2FixSlots`); el jugador guardado en un río o una roca
  reaparece en la orilla (lo hacía ya `loadWorld`). El mapa **nunca** depende del guardado.

## Números medidos (`mundo-organico`, 13/13; motor por software)

* **Rasgos:** 26 (2 ríos de agua, 5 lagos de agua, 3 ríos y 8 lagos de ácido, 1 río y 2 lagos de hielo, 2 ríos y 2 lagos de lava y las faldas), **0 rechazados**, 11 vados tendidos, 18 467 casillas de líquido.
* **Invariantes frente al mapa de `vx`:** 0 diferencias en entidades (todas: mismos ids, tipos y posiciones), puntos de interés, regiones, fronteras y variantes; 40 810 casillas
  cambian y **todas** son suelo libre, camino, roca natural o líquido entre sí (ningún edificio, puerta, arena ni la banda de frontera). Entidades alcanzables: 664 de 664 (igual que antes); 9 de 9 balizas y 11 de 11 puertas unidas.
* **Superficie:** caminos 23 320 casillas frente a 17 032 (×1,37: más largos y con más giros, no más anchos); roca natural 53 485 frente a 40 065; grosor de la roca a ±10 casillas de las fronteras 11,1 de media
  frente a 6,1 y desviación típica ×1,5 (4,3 frente a 2,8).
* **Coste:** la generación del mundo pasa de 893 ms a 1 248 ms (**+354 ms** con el motor caliente): caminos 111 ms, pasada orgánica 446 ms (la mayor parte son las inundaciones de validación).
* **Determinismo:** dos generaciones con la misma semilla dan el mismo terreno y el mismo atrezo.

## Regresión del hito 1 (lote 3)

Sobre la compilación del lote (motor por software, 640×360 salvo indicación): humo 13/13, `mundo-organico` 13/13, `zonas-salida` 11/11, `pausa-horda` 8/8, `jefes-guarida` 17/17, `jefes-sello` 26/26,
`jefes-botin` 18/18, `jefes-fases` 24/24, `maquinas-core` 19/19, `interiores-core` 54/54, `puzles-core` 52/52, `hackeo-core` 46/46, `lore-demo` 29/29, `misiones-principales` 7/7,
`sorpresas-eclipse` 25/25, `-nemesis` 16/16, `-pacto` 16/16, `-asedio` 26/26, `economia-escenas` 16/16, `mobile-smoke` 8/8 y `rares-core` 45/45 (en la primera pasada falló una comprobación de
la barra del raro que dependía del ritmo del reloj; ahora fuerza la actualización y no depende de él). Los escenarios de capturas (`terreno-escenas`, `lore-escenas`, `lore-mapa`, `hackeo-map`,
`puzles-map`) terminan sin errores de página.

## Contratos

* `x.cfg.world2`: `enabled` (con `false` el mundo sale exactamente como lo deja `17-worldgen`), `rivers`, `roads`, `skirt`, `plan` (rasgos por región), `entClear`, `margin`, `gateClear`, `baseClear`.
* `window.__world2 = { cfg, W2, organic(r, seed), gen(n), dump(map, opts), flood, unreachable, ctx, fixSlots, reload }`; `W2.raw(n)` da el mapa de `vx` sin ningún cambio de este frente, `W2.last` las estadísticas de la
  última pasada (`features`, `rejected`, `liquid`, `fords`, `ms`), `W2.reload()` regenera el mundo de la partida con los ajustes actuales.
* El mapa lleva `organic = { v: 1, stats }`. Los rasgos usan `ctx.forb` (nada se pinta sobre edificios, entidades, puntos de interés, el Bastión a menos de 26 casillas, las puertas ni a menos de 3 casillas del borde de
  la región) y `ctx.fsk` (como `forb` pero sin el colchón de la frontera: lo usan las faldas).

## Pendiente

* Bosques con claros y senderos, lugares con historia (gasolinera, motel, escuela, hospital, iglesia, granja con silo, cantera, radar, presa, puerto, patio ferroviario, centro comercial, cementerio…) y barrancos
  o acantilados con pasos (ver el plan en `DEPTH_DESIGN.md`, §5).
* Un puente con barandillas en los vados (hoy son casillas de camino a ras de suelo entre dos orillas más bajas).

# Arreglos urgentes (registro)

Cada entrada: qué veía el jugador, la causa real, el arreglo y cómo se comprueba.

## 2026-10-09 · Con el juego en pausa se acumulaban enemigos hasta formar una horda enorme

**Lo que se veía:** al dejar el juego en pausa (o en otra pestaña) y volver, había una horda gigante alrededor, y seguía creciendo.

**Causa (dos fallos que se sumaban; ya estaban en el juego original):**

1. **Bucle sin fin de manadas.** Cuando una manada del mundo se despeja se anota la hora (`clearedAt`). Pasados 15 min (`Fi.pack`) el barrido del mundo (`check()` en `26-spawner.js`) la
   vuelve a soltar, pero **nunca borraba esa marca**: en la pasada siguiente veía «despejada hace más de 15 min» y la soltaba otra vez, y otra, y otra (3-5 enemigos por manada y pasada;
   ≈ 25-35 enemigos por segundo con tres manadas a tiro). Se medió una subida de 3 → 197 enemigos en 8 s.
2. **Relojes que no se paraban.** Los enfriamientos del mundo (manadas, nidos, cofres, santuarios, jefes, zonas, guaridas…) usan la hora real (`Date.now()`), que sigue corriendo con el juego en
   pausa, en el menú o con la pestaña oculta. Dejar el juego pausado 15 min al lado de manadas despejadas bastaba para disparar el fallo 1 nada más volver.

**Arreglo:**

* `26-spawner.js`: pasado el enfriamiento la manada vuelve **una sola vez** (se borra también `clearedAt`).
* `00-core.js` / `32-boot.js`: nuevo reloj del mundo `gnow()` = hora real **menos** el tiempo en que el juego no ha corrido (pausa, menú principal, pestaña oculta o un cuadro larguísimo; lo suma el
  bucle principal en `GN.lost`). Conserva la escala de `Date.now()`, así que las marcas de las partidas guardadas siguen valiendo. Se usa en todos los enfriamientos del mundo
  (`26-spawner.js`, marcas de zonas en `22-quests.js`, jefes y guaridas en `31g-bosses.js`, manadas guardadas en `31e2-zonas.js`).
* `31e2-zonas.js`: **tope de seguridad** (`x.cfg.zonas.exit.cap`, 40): con tantos enemigos vivos no se suelta ninguna manada del mundo más; esperan a que baje la cuenta.

**Comprobación:** `tools/scenarios/pausa-horda.mjs` (8 comprobaciones): con el enfriamiento cumplido la cuenta se queda plana (de 3 → 197 a 17 → 16 en 10 s); 7 s de pausa real se descuentan del reloj
(«perdidos» ≥ 6 s) y no repueblan nada; pasado el enfriamiento de juego vuelven las manadas una vez; la pestaña oculta pausa y se descuenta; el tope frena la suelta de manadas.

**Publicado:** build `202610091658-09dc2bb` en `operacion-eclipse-remaster` (la copia en vivo es idéntica a la compilada, mismo sha256). Puerta de regresión sobre esa compilación: pausa-horda 8/8, humo 13/13,
zonas-salida 11/11, jefes-guarida 17/17, misiones-principales 7/7, jefes-sello 26/26, jefes-botin 18/18, sorpresas-eclipse 25/25, sorpresas-asedio 26/26 y maquinas-core 18/19 (el fallo no toca
este arreglo: un dron aliado no hirió a un blanco quieto a 6 m en una pasada; se investiga y corrige en el lote 2).

**Nota para las pruebas:** `gnow()` va por detrás de la hora real tanto como tiempo haya pasado en pausa o con cuadros largos (el motor por software va a trompicones), así que un escenario que falsee
marcas con `Date.now()` debe tener en cuenta `window.__GN.lost`.

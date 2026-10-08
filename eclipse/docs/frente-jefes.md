# Frente JEFES Y GUARIDAS (D8) — sello de la guarida

Fragmento: `src/game/31g-bosses.js`. Escenario: `tools/scenarios/jefes-sello.mjs` (26 comprobaciones). Ajustes: `x.cfg.bossGate`.

## Estado

**Hecho (primera pieza de D8): el jefe de cada región ya no sale al pisar su arena.**
Antes, bastaba con acercarse a la arena para que apareciera el jefe y, al abatirlo, se abría el paso a la zona siguiente
(`gateStatus`: jefe de la región + nivel). Avanzar de zona era demasiado fácil. Ahora, mientras el jefe de una región no haya
caído **la primera vez**, su guarida está *sellada* y el jefe no aparece hasta cumplir tres requisitos:

| Requisito | Regla | Dónde se ve |
|---|---|---|
| **Misión** | Tener aceptada (o completada) la misión principal que pide abatirlo (`m4`, `m7`, `m10`, `m12`, `m14`, `m16`, `m18`, `m20`, `m22`). Su contacto solo la ofrece al terminar la anterior, así que obliga a hacer antes la cadena de misiones de la zona. | Aviso al acercarse a la arena |
| **Nivel** | Nivel de esa misión − `lvlSlack` (1). Regiones 0-8: 4, 9, 14, 19, 24, 29, 34, 39, 45. | Línea de la misión y aviso |
| **Sellos** | «Fragmentos de sello»: `seals[región]` = 3, 3, 4, 4, 5, 5, 6, 6, 7. Se ganan jugando la región; cada fuente da como mucho `caps[fuente]` (élites 3, nidos 2, terminales 2, registros del Archivo 2, encargos secundarios 2, puzles 2, operaciones 2), y lo mismo no se cuenta dos veces. | Aviso al ganar uno (`x/y`), línea de la misión y aviso en la arena |

* La línea de la misión del jefe pasa a decir, por ejemplo: `Derrota a Reina de la Plaga: 0/1 · guarida sellada (nivel 4 · sellos 1/3)`.
* Al acercarse (arena + 9 m) a una guarida sellada sale un aviso con lo que falta (como mucho cada 20 s).
* Tras la primera muerte del jefe la arena vuelve a funcionar como siempre (reaparece a los 30 min para farmear) y no se exige nada.
* No se tocan los jefes de operaciones (`arena.op`) ni los secretos (`arena.secret`, se abren hackeando el altar).
* **Guardado:** `S.bossGate = { v: 1, r: { [región]: { n: { [fuente]: cuenta }, ids: [claves ya contadas] } } }`, con migración idempotente. En
  partidas anteriores, las terminales ya hackeadas de cada región (`S.world.term`) cuentan como sellos. Quien ya abatió un jefe no se ve afectado.
* **Fuentes (eventos del bus):** `kill` (élite/campeón y nidos; los jefes no cuentan), `ht.onHack` (terminal hackeada con éxito),
  `lore`, `questDone` (solo no principales), `puzzleSolved` (lo emite el frente PUZLES) y `opReward`.

## Contratos

* `26-spawner.js` → `arenaCheck` llama a `bossGateArena(arena, distancia)` antes de invocar al jefe (única cirugía: una línea).
* `22-quests.js` → `objText` («boss») añade `bossGateText(idJefe)`.
* Otros frentes pueden sumar sellos con `bossGateAdd(región, fuente, clave)`; las fuentes nuevas se declaran en `x.cfg.bossGate.caps`/`names`.
* Ganchos de prueba: `window.__bossGate = { status, add, seals, text, cfg, emit }`.

## Números y criterio

Los umbrales son una propuesta para frenar el avance sin convertirlo en un trámite: la cadena de misiones de cada zona ya exige 2-3
misiones (hablar, hackear, explorar) antes de la del jefe y los sellos suelen salir solos al hacerlas (una terminal hackeada, élites de
paso, registros del Archivo). Si el avance sigue siendo demasiado rápido o demasiado lento, se ajusta en `x.cfg.bossGate` sin tocar lógica.

## Pendiente (resto de D8)

Guaridas propias (mazmorra `lair` con antesala, sala media y arena), entrada oculta que se abre con fragmentos de sello o un ritual,
combates de 3 fases con temporizador de furia, botín único por jefe (2-3 legendarios con nombre) y Sigilo. Ver `DEPTH_DESIGN.md` §5.

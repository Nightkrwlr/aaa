# ARCHITECTURE

> Principio rector: **la simulación es un programa puro, determinista y sin DOM**; el cliente es un traductor entre dispositivos/pantalla y esa simulación. Todo el contenido es **datos** validados.

## 1. Capas

```
┌───────────────────────────── navegador ─────────────────────────────┐
│ src/client   Game (frame loop) · Input · Scene3D/Vfx/Views · HUD/UI · Audio │
└───────────────▲──────────────────────────────────────┬──────────────┘
                │ eventos (session.events, world.events) │ comandos (player.cmd, session.interact…)
┌───────────────┴──────────────────────────────────────▼──────────────┐
│ src/sim   GameSession ─ owns ─ GameState · Character · Quests · Dialogue · Gates · Codex · Shop │
│           ├─ overworld ctx: World + Zone + LootSystem + Weather + Director + EventSystem        │
│           └─ dungeon ctx : World + DungeonRuntime (generado) + PuzzleHost                        │
│           World.step(1/60): controller → elites → AI → listen → abilities → proyectiles/zonas → estados → recursos │
└───────────────▲──────────────────────────────────────────────────────┘
                │ lee (inmutable)
┌───────────────┴──────────────────────────────────────────────────────┐
│ data/**/*.json  →  Registry (ids permanentes, congelados)   locales/{es,en}/*.json │
└──────────────────────────────────────────────────────────────────────┘
src/core: Rng (sfc32 sembrado) · EventBus · Registry · i18n · logger · math
```

Reglas de dependencia (se comprueban por convención y por los tests headless):
- `src/sim/**` **no importa** `src/client/**`, `three`, ni toca `document/window`. Se ejecuta tal cual en Node (tests, simuladores, fuzzers).
- `src/client/**` nunca muta reglas: llama a la sesión y dibuja eventos.
- Ningún `Math.random()` en `src/sim` (solo en VFX cosméticos del cliente): toda aleatoriedad sale de `Rng` con semilla por contexto.
- El texto visible **nunca** vive en código o datos: claves de localización (`<id>.name`, `<id>.desc`…).

## 2. Bucle y determinismo
- `World.update(dt)` acumula tiempo real y ejecuta pasos fijos de **1/60 s** (`World.step`). La misma semilla + los mismos comandos ⇒ el mismo resultado (tests `tests/combat.test.js`, `tests/session.test.js`).
- Orden de un paso (importa para la legibilidad): comandos del jugador → módulo élite → IA → Escucha → lanzamiento/movimiento → proyectiles y zonas → estados → recursos/regeneración → limpieza.
- Hit-stop y cámara viven en el cliente (reducen `dt` de simulación, no la cambian).
- `?fixed=1` en la URL hace que el cliente avance 1/30 s **por fotograma** (E2E reproducible en GL por software).

## 3. Módulos de la simulación (qué hace cada uno y quién lo usa)
| Módulo | Responsabilidad |
|---|---|
| `stats.js` | `StatBlock`: `(base + flat) × (1 + Σ inc) × Π(1 + min(cap, Σ more_grupo))` con condiciones por etiqueta/flag y `explain()` para tooltips |
| `balance.js` | Modelo central: curva de poder `P(L)`, HP de enemigo = DPS esperado × TTK(tier), daño enemigo = % de vida esperada, XP, economía, caps |
| `damage.js` | Pipeline de daño documentado (tirada → crítico → resistencias/armadura → vulnerabilidad → puerta de daño → escudo) |
| `abilities.js` | Intérprete de habilidades **100 % datos**: efectos (`area`, `projectile`, `dash`, `blink`, `zone`, `summon`, `buff`…), parches de talentos/únicos, canalizados, cargas, voces |
| `cadence.js` · `listen.js` · `listen`/`echoes` | Las tres mecánicas diferenciadoras |
| `ai/*` | FSM compartida + *brains* (melee, flanker, charger, kiter, artillery, swarm, ambusher, support, summoner, turret, boss…), LOD por distancia, percepción FOV/LOS/oído |
| `director/*` | Compositor de encuentros con presupuesto, módulos élite con exclusiones, Director de Experiencia (ritmo, máx. 10 empujones/hora) |
| `items/*` | Generador con presupuesto de poder, inventario, loot (`rollDrops` puro), filtro de botín, crafteo con Estabilidad, comparador consciente de build |
| `character.js` | Estado persistente del héroe y **único** sitio donde equipo+talentos+voces se aplican a la entidad viva |
| `world/*` | Zona (terreno, nav, props), interactuables, puertas por objetivos (`gates.js`), clima, eventos dinámicos, secretos |
| `dungeon/*` | Grafo de misión → rejilla → rasterizado → contenido → validación → semillas con reintento. `runtime.js` instancia en un `World` |
| `puzzles/*` | Generadores con **solución verificada** + estado + pistas por capas (`host.js`) |
| `session.js` | Orquestador: contextos, eventos mundo→historia, muerte/reaparición, viaje, descanso, mazmorras, interacciones |
| `save.js` | Guardado versionado, checksum, escritura atómica, copias rotativas, migraciones, import/export |

## 4. Flujo de un golpe (ejemplo)
`player.cmd.attackTarget` → `PlayerController` → `AbilityRuntime.tryCast` (coste/CD/recurso) → fases windup/impact → `EFFECTS.area` → `applyHit` → `World.hit` → `DamageModel.roll` → `#apply` (invulnerabilidad, esquiva perfecta, `damageGate`, reflejo) → evento `damage` → **cliente**: números, partículas, hit-stop, sonido; **sesión**: XP/botín/códice/misiones al `entity:died`.

## 5. Contextos y cambio overworld ↔ mazmorra
`GameSession.ctx` apunta al contexto vivo (`overworld` o `dungeon`). Al entrar en una mazmorra se **conserva** el `World` del exterior (los packs y bosses no se reinician) y se crea otro `World` con su `DungeonRuntime`; el `Character` es el mismo (se re-aplica con `recompute`). El cliente reconstruye la escena tras un fundido (`Game.#buildContext`). Guardar dentro de una mazmorra guarda la posición del portal (las mazmorras son efímeras por diseño).

## 6. Eventos
Dos buses: `world.events` (combate, VFX, audio) y `session.events` (historia/UI: `kill`, `boss`, `quest:*`, `ui:open`, `toast`, `area`, `dungeon:*`, `autosave`…). Las misiones, diálogos y puertas solo hablan por `session.events` + `checkCond` (condiciones declarativas: `flag`, `quest`, `item`, `killed`, `secret`, `weather`, `mode`…).

## 7. Renderizado (cliente)
Three.js 0.186. Arte **importado y pintado**: personajes/props glTF de KayKit (CC0, `public/assets/**`) + arquitectura y terreno pintados por código. Cada pieza vive en `src/client/render/`:
| Módulo | Qué hace |
|---|---|
| `scene3d.js` | compositor: luces, atmósfera, presupuesto de luces puntuales, carga de zona/mazmorra, `PostFx` |
| `post.js` | postproceso propio: escena → objetivo HDR (MSAA) → bloom/AO opcionales → gradación fílmica (viñeta, grano, filtros de Escucha/daño); degrada a LDR si el móvil no soporta HDR |
| `atmosphere.js` | atmósferas como datos (alba/mediodía/ocaso/noche/niebla/lluvia), niebla exponencial **con altura** y dispersión del sol, uniformes compartidos (viento, sombras de nubes, brillo) |
| `paint.js` + `worldMaterials.js` | constructor de mallas "pintadas": cada parte elige una muestra de la paleta (degradado claro→oscuro) y un patrón analítico (sillería, teja, tablón, yeso, roca, estratos) que el *shader* dibuja nítido a cualquier distancia; colores de vértice opcionales para luz horneada |
| `worldAssets.js` | piezas KayKit horneadas como geometrías instanciables + variantes de atlas recoloreadas (pino verde, caliza cálida) |
| `terrainMesh.js` · `foliage.js` · `props.js` · `structures.js` · `dressing.js` | exterior: terreno por *heightfield* con detalle, vegetación con viento, props instanciados, edificios y ambientación por zona |
| `dungeonMesh.js` | mazmorras: suelo, muros (zócalo, cornisa, roca que se desvanece), puertas y props en *chunks* de 16×16 casillas; **luz horneada** en color de vértice (AO + charcos de antorchas/cristales/lámparas), llamas instanciadas + halos aditivos, motas de polvo; ver [ART_BIBLE.md](ART_BIBLE.md) §7 |
| `charFactory.js` · `charAnim.js` · `charProps.js` · `creatures.js` · `stylekit.js` · `entityViews.js` · `mergeStatic.js` | personajes KayKit con rig compartido, máquina de animación sincronizada con la fase de lanzamiento de la sim, armas, bestias/constructos propios y vistas de entidad (barras, estados, reacciones); `mergeStatic` funde las mallas inmóviles de cada modelo para ahorrar llamadas de dibujo |
| `vfx.js` · `groundFx.js` · `particles.js` | números de daño fusionados, golpes, botín con rareza, pilar de subida de nivel; telégrafos como decals por forma |
| `quality.js` | presets low / medium / high / ultra (sombras, resolución, MSAA, bloom, AO, partículas, luces, distancia de dibujo) |
Capa móvil: `src/client/mobile/*` (ver [MOBILE.md](MOBILE.md)), con un gobernador de rendimiento que sube/baja la calidad solo. **Desvanecimiento por oclusión** (dither cámara→jugador) en todos los materiales del mundo. Presupuestos medibles con `tools/perf-probe.mjs`.

## 8. Extensibilidad (cómo crecer sin tocar el núcleo)
- Nueva habilidad/enemigo/objeto/quest/región = **archivos de datos** + claves de texto (ver [CONTENT_GUIDE.md](CONTENT_GUIDE.md)).
- Nueva mecánica = nuevo `op` en `abilities.js` (`EFFECTS`), nuevo *brain* en `ai/brains.js`, nuevo tipo de puzle en `puzzles/` (`generate/solve/State`), nueva condición en `state.js:checkCond`, nuevo efecto narrativo en `effects.js`.
- Nueva clase = `data/classes/*.json` + árbol de talentos + habilidades + modelo; el resto del sistema es genérico (recurso configurable por datos).
- Arte: un modelo glTF nuevo se añade al pipeline `tools/assets/build-assets.mjs` (→ `manifest.json`), se registra su licencia en `ASSET_LICENSES.md` y se referencia por `grupo/id` desde `charFactory.js` / `worldAssets.js` (`KIT_LIST`). Las criaturas propias viven en `creatures.js`.

## 9. Qué se probó y cómo
Ver [QA_CHECKLIST.md](QA_CHECKLIST.md) y [TDD.md](TDD.md). Resumen: 90 tests de node (combate, estadísticas, IA, jefes, ítems, personajes, puzles, zona, sesión, historia completa, guardado, maquetación móvil, fusión de mallas, navegación en mazmorras), fuzz de mazmorras (750 semillas válidas), validador de datos (referencias cruzadas + paridad ES/EN), simuladores de balance y de ritmo, sonda de presupuesto de render, y E2E con navegador real, de escritorio y de móvil emulado (`tools/e2e/*.mjs`).

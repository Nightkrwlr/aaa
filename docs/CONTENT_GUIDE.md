# CONTENT GUIDE — cómo añadir contenido sin tocar el motor

Regla de oro: **si hace falta editar `src/sim` para añadir un enemigo, un objeto, una misión o una zona, el diseño del motor ha fallado.** Todo se hace con JSON + claves de texto, y `npm run validate` te dice si algo está mal.

Ciclo de trabajo para cualquier contenido:
1. Crea/edita el JSON en `data/…` (IDs nuevos, permanentes, `prefijo.snake_case`).
2. Añade las claves de texto en `locales/es/*.json` **y** `locales/en/*.json` (`<id>.name`, `<id>.desc`…).
3. `npm run validate` (referencias, esquemas, paridad ES/EN) → `npm test` → prueba en `npm run dev` con el panel de desarrollo (`` ` ``).
4. Si toca números de poder: `npm run balance -- --quick` ([BALANCE.md](BALANCE.md)).

## 1. Nuevo enemigo (3 minutos)
```jsonc
// data/enemies/mi_zona.json  { "kind": "enemy", "items": [ … ] }
{ "id": "enm.dune_howler", "family": "fam.discordant", "tier": "standard", "role": ["kiter"],
  "model": "mdl.cliff_stalker", "radius": 0.6, "height": 1.1, "speed": 4.6, "hpMult": 0.9,
  "ai": { "brain": "kiter", "aggroRange": 16, "minRange": 6, "maxRange": 11, "retreatHp": 0.25, "leash": 40 },
  "abilities": ["abl.enm.howler_shriek"],
  "drops": { "materials": [{ "id": "mat.stalker_sinew", "chance": 0.2 }] },
  "voice": "voc.stalker_leap",                      // opcional: Voz capturable
  "bestiary": { "weak": ["frost"], "resist": [], "tip": "close_in" } }
```
- `tier` fija la **vida** (por tiempo de muerte) y el botín: **no pongas HP a mano**; usa `hpMult` para matizar.
- Habilidades enemigas: `data/abilities/enemies_*.json`, daño con `"scaling": "pct", "pct": 0.06` (7,5 % de la vida esperada = golpe base). **Todo ataque peligroso necesita `telegraph`** (`{shape, radius, angle…}`; `windup` ≥ 0,5 s para golpes fuertes). Los telégrafos son la regla de legibilidad.
- Texto: `enm.dune_howler.name`, `enm.dune_howler.desc` (+ opcional `.tip`).
- Para que aparezca: añádelo a un `encounter` (`data/encounters.json`) o a los `spawns` de la zona.

## 2. Nueva habilidad
Archivo `data/abilities/<clase>.json`. Compón efectos existentes (`area`, `projectile`, `zone`, `dash`, `blink`, `summon`, `buff`, `heal`, `shield`, `status`, `knockback`, `pull`…). Declara **tono** (`low|mid|high`) si participa en la Cadencia. Añádela a `unlocks` de la clase (nivel) y al árbol si hay nodos que la modifican. Una mecánica realmente nueva = una función en `EFFECTS` (`src/sim/abilities.js`) + test.

## 3. Nuevo objeto
- **Afijo** (`data/items/affixes.json`): `type`, `group` (no se repite en un objeto), `slots`, `mods` con `range` y `scale:'pct'` (escala con el nivel), `cost` (presupuesto de poder). Mantén el valor máximo dentro de los topes de [BALANCE.md](BALANCE.md).
- **Base** (`itemBase`): arma/armadura con `implicit`; el generador hace el resto.
- **Único** (`unique`): lo que lo hace único debe ser **una regla**, no solo números: `patches` (cambia cómo funciona una habilidad), `triggers` (con `icd`), `flags`. Un único que solo da «+X daño» está mal diseñado.
- **Receta** (`recipe`): `inputs{mat: n}`, `chimes`, `output`.

## 4. Nueva misión con NPC
1. `data/world/npcs.json`: `{ "id":"npc.mi_npc", "model":"mdl.npc_x", "role":"…", "faction":"…" }` + modelo.
2. Colócalo en la zona (`npcs: [{ "id":"npc.mi_npc", "pos":[x,z], "cond":{…} }]`) — con `cond` aparece solo si se cumple (memoria del mundo).
3. `data/story/quests.json`: etapas con objetivos `reach/discover/talk/defeatBoss/solvePuzzle/completeDungeon/collect/haveItem/flag`. Los objetivos son **por nivel** (consultan el estado), así que el orden de juego nunca bloquea la misión.
4. `data/story/dialogues.json`: `roots` ordenadas por prioridad con `cond`, `nodes` con `choices`, `effects` (`setFlag`, `startQuest`, `giveItem`…). **Consecuencias**: cada decisión relevante fija un flag y otros diálogos/tiendas/zonas leen ese flag.
5. Textos: `<quest>.summary`, `<quest>.<stage>.title|desc|o<N>`, líneas de diálogo por clave.
6. Tests: copia el patrón de `tests/story.test.js` (la sesión headless juega la misión).

## 5. Nueva mazmorra (familia)
`data/dungeons/families.json`: copia una familia y cambia `theme`, `palette`, `light`, `pools` de encuentros, `puzzles`, `modifiers` y `boss`. Añade un jefe en `data/enemies/guardians.json` (fases) y su modelo. Comprueba con `npm run fuzz:dungeons -- 100`: **cada semilla debe validar** (conectividad, llaves, jefe alcanzable, puzles con solución verificada). Si falla, el fuzz imprime semilla y causa.
Mazmorras de historia: `dungeonSpec` en `data/dungeons/story.json` (semilla fija + `narrative`/`boss`/`storyNpc`).

## 6. Nuevo puzle
Módulo en `src/sim/puzzles/` con `generate(seed, difficulty)` (devuelve instancia **y solución**), `solve()` (resolvedor propio: el generador rechaza instancias sin solución o triviales) y una clase `State` (`apply(action)`, `solved`). Regístralo en `puzzles/index.js`. Las pistas (`clues.js`) se muestran por **capas** (observación → pista → solución) según la opción de ayuda.

## 7. Nueva región (II y III)
Las regiones II y III existen como **diseño + gates + definición** (`data/world/regions.json`, `gates.json`). Para producirlas:
1. `data/world/zone_<id>.json` (copia `zone_calvarre_lower.json`): `terrain`, `areas`, `props`, `spawns`, `bosses`, `resources`, `events`, `structures`, `interactables`, `gates`.
2. Mecánica ambiental de la región: nuevo *brain*/zona de peligro/estado (p. ej. *Compases*: plataformas con ritmo = `abl.env.*` + `hazard`).
3. Enemigos de las familias de la región; jefe regional; 1 asentamiento con NPC, 3–4 refugios (`waypoints`), mazmorras, eventos, secretos, códice, misiones.
4. `npm run validate` comprueba que la zona carga y que sus áreas clave son alcanzables.
Tabla de producción por región: ver [GDD.md](GDD.md) §5.

## 8. Nueva clase
`data/classes/<id>.json` (recurso con `thresholds`, `profile` con `dmg` ← **se calibra con `npm run balance`**, `loadout`, `unlocks`), `data/abilities/<id>.json`, un árbol en `data/talents.json`, un modelo y los textos. El resto del sistema (recursos, UI, guardado, simulador) es genérico: el recurso se define por datos (`id`, `max`, `onHit/onHurt/onKill`, `decay`, `maxStacks`).

## 9. Textos y localización
- Claves planas por archivo temático en `locales/<lang>/` (el cargador fusiona todos los `*.json`).
- Interpolación `{nombre}`; plurales `clave#one` / `clave#other`.
- `npm run validate` → paridad ES/EN y claves requeridas por contenido; `node tools/check-ui-keys.mjs` → claves usadas en código.
- Para añadir un idioma: copia `locales/en/` a `locales/<xx>/`, traduce y añade el código en el selector de idioma de *Opciones* (`src/client/ui/panels/settings.js`).

## 10. Lista de comprobación antes de integrar
- [ ] IDs nuevos con prefijo correcto, sin reutilizar ninguno retirado.
- [ ] Texto en ES **y** EN.
- [ ] `npm run validate` sin errores ni avisos nuevos.
- [ ] Ataques peligrosos con telégrafo; ningún HP/daño «a mano» fuera del modelo.
- [ ] Test (o ampliación de uno existente) si hay lógica nueva.
- [ ] `npm test` y `npx vite build` en verde; capturas con `tools/shot.mjs` si hay arte nuevo.
- [ ] Guardado: ¿añadiste estado persistente? → default en `fromJSON` + migración + test.

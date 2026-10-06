# DATA SCHEMA

Todo el contenido del juego son archivos JSON bajo `data/`. El motor no contiene números de diseño ni texto visible.

## 1. Convenciones
- **Contenedor**: `{ "kind": "<tipo>", "items": [ { "id": "...", ... } ] }`. Un archivo = un `kind`. Se cargan todos los `*.json` de `data/` (en navegador vía `src/client/dataBundle.js`, en Node vía `src/core/nodeLoader.js`).
- **IDs permanentes y con espacio de nombres**: `prefijo.nombre_en_snake_case` (`abl.belfry.clapper`, `enm.cliff_stalker`, `qst.first_echo`). **Un ID jamás se reutiliza ni se renombra** (los guardados y los flags lo referencian); para retirar contenido se marca `"deprecated": true`.
- **Registro** (`src/core/registry.js`): detecta duplicados, rechaza archivos mal formados y **congela** (`Object.freeze`) cada entrada: el contenido es inmutable en ejecución.
- **Texto**: nunca en los datos. Cada entidad con nombre usa las claves `<id>.name` y `<id>.desc` en `locales/{es,en}/*.json` (planos `clave → texto`; ES y EN deben tener las mismas claves, lo comprueba `tools/validate-data.mjs`).
- **Referencias cruzadas**: cualquier cadena con forma `prefijo.id` de los prefijos registrados (`abl enm unq mat con gem rcp st rx elm enc dfm obj mod nar boss voc qst dlg gate evt sec cdx mdl npc cls zone rgn shp prop`) **debe** resolver a una entrada existente: lo verifica el validador.
- **Semillas**: aleatoriedad siempre vía `Rng(seed)`. Las semillas son cadenas o enteros; los generadores combinan semilla de mundo + ID de contenido.

## 2. Tipos (`kind`) y archivos
| kind | archivos | descripción |
|---|---|---|
| `balance` | `data/balance/balance.json` | modelo numérico central (ver [BALANCE.md](BALANCE.md)) |
| `statDef` | `data/balance/stats.json` | definición de estadísticas: base, min/max, formato, etiquetas |
| `class` | `data/classes/*.json` | recurso propio, perfil de multiplicadores, desbloqueos por nivel, árbol, arma inicial |
| `ability` | `data/abilities/*.json` | habilidades de clases, enemigos, jefes, entorno, consumibles, Voces, parches de talentos/únicos |
| `talentTree` | `data/talents.json` | grafo de nodos (`start/minor/notable/transform/keystone`), enlaces, mods, parches |
| `status` | `data/statuses*.json` | estados (DoT, control, buffs) con apilado y duración |
| `reaction` | `data/reactions.json` | combinaciones de estados (`rx.*`) |
| `family` / `enemy` | `data/enemies/*.json` | familias de enemigos, arquetipos de enemigo/jefe + modelo + IA |
| `eliteMod` | `data/elites.json` | modificadores de élite con exclusiones y ganchos de habilidad |
| `encounter` | `data/encounters.json` | composición con presupuesto y formación |
| `itemBase` / `affix` / `unique` / `material` / `consumable` / `gem` / `recipe` | `data/items/*.json` | bases, afijos con rangos, únicos con parches, materiales, consumibles, gemas, recetas |
| `voice` | `data/voices.json` | Voces capturables (habilidad + enemigo fuente) |
| `zone` | `data/world/zone_*.json` | zona exterior: terreno, áreas, props, POIs, spawns, jefes, recursos, eventos, estructuras, interactuables, puertas |
| `region` / `npc` / `shop` / `gate` / `event` / `secret` / `worldPuzzle` / `codex` / `prop` | `data/world/*.json` | mundo y metajuego |
| `quest` / `dialogue` | `data/story/*.json` | misiones por etapas y diálogos con condiciones |
| `dungeonFamily` / `dungeonObjective` / `dungeonModifier` / `narrative` / `dungeonSpec` | `data/dungeons/*.json` | familias generativas, finales, modificadores, relatos y mazmorras de historia |
| `model` | `data/models/models.json` | plantilla procedural + parámetros (la «ficha» sustituible por glTF) |

## 3. Esquemas por tipo (campos esenciales)
### 3.1 `ability`
```jsonc
{ "id": "abl.belfry.clapper", "owner": "cls.belfry", "slotType": "primary",   // primary | s1.. | dodge | voice | enemy …
  "tags": ["attack","melee","area","sonic","basic"],                          // las etiquetas son el sistema de modificadores
  "tone": "low",                                                              // Cadencia: low | mid | high (opcional)
  "aim": "direction", "range": 3.2,
  "cast": { "windup": 0.17, "recover": 0.26, "cancelAt": 0.45, "moveFactor": 0.15 },
  "cost": { "resource": 12 }, "cooldown": 6, "charges": { "max": 2, "recharge": 8 },
  "effects": [ { "op": "area", "shape": "arc", "radius": 3.1, "angle": 120, "origin": "self",
                 "hit": [ { "op": "damage", "type": "sonic", "coef": 1.0, "scaling": "weapon" },
                          { "op": "knockback", "force": 0.7 } ] } ],
  "fx": { "hitstop": 40, "shake": 0.12, "vfx": "arc_sonic", "sfx": "bell_low", "anim": "swing_h" } }
```
**Ops de efecto** (`EFFECTS` en `src/sim/abilities.js`; añadir uno = una función): `area`, `projectile`, `zone`, `dash`, `blink`, `summon`, `buff`, `status`, `damage`, `knockback`, `pull`, `heal`, `shield`, `cleanse`, `taunt`, `resource`, `suicide`. `scaling`: `weapon` | `spell` | `pct` | `flat` | `lifeMax`. **Enemigos**: `scaling: "pct"` (porcentaje de la vida esperada del jugador al nivel del enemigo → el daño enemigo siempre se mantiene proporcionado).

### 3.2 `enemy`
`family`, `tier` (`minion|standard|tough|elite|miniboss|boss`), `role[]`, `model`, `radius/height/speed`, `hpMult`, `armor`, `ai{brain, aggroRange, leash, …}`, `abilities[]`, `drops{materials[], uniques[]}`, `voice`, `bestiary{weak, resist, tip}`. **Brains**: `melee flanker charger kiter artillery swarm ambusher support summoner guard exploder turret trapper hazard controller assassin` (+ `boss` con fases en `src/sim/ai/boss.js`). Jefes: `boss:true`, `phases[]` con umbral de vida, habilidades y comportamiento.

### 3.3 `affix`
`type` (`prefix|suffix`), `group` (un solo afijo por grupo en un objeto), `slots[]`, `tags`, `minIlvl`, `weight`, `mods[{stat, op: flat|inc|more, range:[min,max], scale:'pct'|'flat', tags?}]`, `cost` (coste en **presupuesto de poder** del objeto: los afijos fuertes consumen más). Las tiradas se interpolan entre `rollFloor` de la rareza y 1.

### 3.4 `unique`
`slot`, `base`, `minIlvl`, `source` (`drop`/`quest`/`puzzle`/`boss`), `mods` (con rango), `patches[]` (cambian una habilidad: `{ability, add/replace…}`), `flags[]` (reglas activas que otras partes consultan), `triggers[{on, chance, icd, ability}]`, `classes`.

### 3.5 `talentTree`
Nodos `{id, kind, branch, ring, lane, links[], cost, mods[], pos:[x,y]}` y, en los transformadores, `patch`/`grants`. El árbol se generó con un script offline a partir de plantillas (`tmpl`) y se mantiene a mano; `tests/character.test.js` comprueba conectividad (solo se asigna lo alcanzable), exclusividad y desasignación segura (nunca queda un nodo huérfano).

### 3.6 `quest` y `dialogue`
```jsonc
{ "id":"qst.first_echo", "category":"main", "region":"rgn.calvarre",
  "stages":[ { "id":"wake", "objectives":[{"type":"discover","id":"cdx.cylinder_awakening"}],
               "onEnter":[{"op":"subtitle","key":"sub.first_wake"}] }, … { "id":"report","end":true } ],
  "rewards":{ "xp":220, "chimes":25, "items":[{"rarity":"fine","slot":"weapon"}] }, "next":["qst.empty_choir"] }
```
**Tipos de objetivo** (se evalúan **por nivel**: comprueban el estado, no el orden en que ocurrió, de modo que ninguna misión se bloquea): `discover`, `reach`, `talk`, `defeatBoss`, `solvePuzzle`, `completeDungeon`, `collect`, `haveItem`, `flag`.
Diálogos: `roots[{id, cond, priority}]` (se elige la raíz de mayor prioridad cuyo `cond` se cumple) y `nodes{ id: {speaker?, say, next?, choices[{text, cond?, effects?, next?}], effects?} }`. La **memoria de NPC** son flags + `npcMemory`.

**Condiciones** (`checkCond`, declarativas y componibles): `all` `any` `not` `flag` `noFlag` `flagEq` `quest` (`state`: `active|done|stage:<id>`) `item` `killed` `discovered` `secret` `waypoint` `level` `rep` `met` `notMet` `memory` `weather` `mode` `count` `every`.
**Efectos** (`applyEffects`): `setFlag clearFlag startQuest advanceQuest completeQuest failQuest giveItem giveKeyItem takeKeyItem giveConsumable giveMaterial chimes xp talentPoints rep discover unlockWaypoint openGate revealEcho spawnEnemy refillPotions rest recompute npcMemory toast subtitle music openUi`.

### 3.7 `gate` (objetivos, nunca «nivel N»)
```jsonc
{ "id":"gate.choir_door", "region":"rgn.calvarre",
  "requirements":[ {"id":"r1","cond":{"killed":"boss.brannoch"},"textKey":"gate.choir_door.r1"},
                   {"id":"r2","cond":{"item":"key.resonant_core"},"textKey":"…r2"},
                   {"id":"r3","cond":{"discovered":"cdx.choir_lament"},"textKey":"…r3","optional":true} ] }
```
Una puerta puede ser una **cortina de resonancia** física: la zona declara una elipse de celdas de navegación bloqueadas que se retiran al `openGate`. La UI lista cada requisito con su estado (cumplido/pendiente).

### 3.8 `zone`
`size, origin, cell, seed, levelRange, terrain{heightmap params}, areas[{id, c, r, kind}], props[], pois[], landmarks[], npcs[{id, pos, cond?}], spawns[], bosses[], resources[], events[], weather, structures[], interactables[], gates[]`. El validador comprueba que las áreas clave son alcanzables por *pathfinding* desde la aparición.

### 3.9 `dungeonFamily`
`embedder` (`grid`/…), `theme`, `cell`, `sizes{small|medium|large:{crit, branches, loops, secrets, locks}}`, `rules{corridorWidth, roomShapes[], …}`, `beats{mid[], branch[]}`, `pools{easy,mid,hard:[encounter ids]}`, `puzzles[]`, `light`, `palette`, `modifiers[]`, `boss`. Pipeline: **grafo de misión → rejilla → rasterizado → contenido → validación** con reintento de semilla (`src/sim/dungeon/index.js`). Validación: conectividad, llaves antes de cerraduras, alcance de jefe, solución de puzles verificada, presupuesto de encuentros. 750 semillas válidas en el fuzz.

### 3.10 `model`
`{ "id":"mdl.x", "tpl":"<plantilla>", "p":{params} }`. La plantilla (en `src/client/render/models.js`) construye una malla por primitivas con **roles de articulación** (`body`, `head`, `armL/R`, `legL/R`, `weapon`, `fx`…). Sustituir por arte real = proporcionar un glTF que respete esos nombres (ver [ART_BIBLE.md](ART_BIBLE.md)).

## 4. Guardado (versión 3)
Sobre `{ magic:"SDCH", version, build, savedAt, meta, checksum, payload }` (el `payload` es una cadena JSON; el checksum FNV-1a cubre el texto):
```
payload = { seed, settings, state, character, stash, weather, pos:{x,z,hpRatio}, zone, ctxKind }
state   = { flags, quests, killed, discovered, waypoints, gates, secrets, cleared, depleted, checkpoint,
            shop, restCount, puzzlesRead, fog, dungeons:{done, bySeed, specs}, counters… }
```
Migraciones `v1→v2→v3` en `MIGRATIONS` (`src/sim/save.js`); una versión **futura** se rechaza, nunca se adivina. Reglas: añadir campo = default en `fromJSON` + (si cambia el significado) nueva migración + test en `tests/save.test.js`.

## 5. Localización
`locales/<lang>/*.json`: mapas planos. Claves por convención: `<id>.name`, `<id>.desc`, `dlg.<npc>.<nodo>`, `ui.*`, `toast.*`, `sub.*` (subtítulos), `gate.<id>.r<n>`. Interpolación `{nombre}`. Plurales con `clave#one` / `clave#other` cuando se pasa `count`. El idioma por defecto es ES; EN completo. `tools/check-ui-keys.mjs` verifica que **toda** `t('…')` del código existe en ambos idiomas.

## 6. Validación automática
`npm run validate` (= `node tools/validate-data.mjs`): errores de registro, referencias rotas, esquemas mínimos por tipo, coherencia de misiones/diálogos, cobertura de locales ES/EN, alcance de zona y generación de mazmorras de muestra. **Cualquier error bloquea la integración** (`--strict` convierte avisos en errores).

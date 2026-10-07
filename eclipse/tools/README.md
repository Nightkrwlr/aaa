# Herramientas de Operación Eclipse

Todo se ejecuta desde `eclipse/`. Requisitos: `npm install` (three@0.160.1 + esbuild) y Playwright (se resuelve desde el `node_modules` de la raíz del repo; Chromium con GL por software SwiftShader).

## Construir
```bash
node tools/build.mjs                       # dist/eclipse.html (minificado) + dist/eclipse.artifact.html (fragmento para Artifact)
node tools/build.mjs --dev --out dist/dev.html   # sin minificar: errores con nombres legibles
node tools/build.mjs --host --out dist/host/index.html --title "Operación Eclipse Remasterizada"   # edición para alojar: index.html + manifiesto + iconos (public/)
node tools/make-icons.mjs                  # rasteriza public/icon.svg → icon-512/192, apple-touch-icon, favicon-32 (solo si cambia el SVG)
```
Los fragmentos de `src/game/*.js` se concatenan **en el orden de `_order.json`** dentro de un único ámbito (no son módulos). Los módulos de `src/engine/*.js` sí son ES y se importan desde el `_prelude.js` o desde un fragmento con `import … from '../engine/…'` colocado en `_prelude.js`.

## Capturas y guiones (`tools/shot.mjs`)
```bash
node tools/shot.mjs --scenario tools/scenarios/tour.mjs --out /ruta --tag antes
node tools/shot.mjs --html dist/eclipse.html --device pixel7 --portrait --dpr 1 --scenario …
```
Opciones: `--html`, `--scenario`, `--out`, `--tag`, `--device desktop|pixel7|iphone14|se|tablet`, `--portrait`, `--dpr`, `--size 960x540` (más rápido), `--quality low|medium|high`, `--seed N` (Math.random con semilla: capturas comparables).

Un guion es `export default async (api) => {…}` y recibe `api`:

| API | Qué hace |
|---|---|
| `boot()` / `newGame()` | carga la página (espera a `#loading`) y empieza una partida nueva con el menú real |
| `region(key)` | teletransporta al centro de la región (`valle ciudad desierto marisma tundra complejo caldera yermo colmena`) |
| `teleport(x,z)` | `world.loadWorld({x,z})` |
| `setTime(t)` | hora del día 0‥1 (la noche es 0,6‥0,97) |
| `hideUi(bool)` | oculta/muestra HUD y overlay (para mirar solo el mundo) |
| `god()` | invulnerable (para auditar regiones de nivel alto sin morir) |
| `freeze(bool)` / `still(name,{ui})` | congela la simulación / captura estática sin HUD (o con él) y descongela |
| `spawn(kind,x,z,lvl,opts)` | `window.__spawn` (enemigos) |
| `step(n,dt)` | simula n pasos de `dt` sin render (`window.__step`) |
| `wait(frames)` | espera fotogramas de `requestAnimationFrame` |
| `shot(name)` | `${out}/${tag}-${name}.png` |
| `perf()` | presupuesto de UN fotograma completo (llamadas, triángulos, programas, texturas) sumando todas las pasadas |
| `ev(fn,arg)` / `page` / `logs` | evaluar en la página / Playwright / avisos y errores de consola |

Estado del juego en la página: `window.__G` (= `x`: `R` renderer rig, `player`, `world`, `map`, `S` guardado, `fx`, `enemies`, …), `window.__De` (regiones), `window.__dbg.*` (abrir paneles), `window.__spawn`, `window.__step`, `window.__fps()`.

Guiones incluidos: `tour.mjs` (base + cada región de día + noche), `smoke.mjs` (humo: arranque, movimiento, combate, paneles, sin errores).

> Rendimiento: GL por software es lento (un fotograma ≈ 0,3-1 s). Usa guiones **cortos** (una región, una hora) y no lances dos navegadores a la vez en máquinas de 4 núcleos.

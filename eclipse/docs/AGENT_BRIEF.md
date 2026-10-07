# Briefing común — mejora gráfica de Operación Eclipse

## Contexto
Operación Eclipse es un shooter isométrico 3D de exploración (operador de fuerzas especiales contra el Enjambre alienígena, 9 biomas, mazmorras «operaciones», misiones, botín). El usuario quiere que **parezca un juego de tienda** y que se pueda jugar bien **desde el móvil**. El código del juego es el de un artefacto publicado, reconstruido en `eclipse/` (ver `eclipse/README.md`). Se mejora con el motor gráfico de SUNDERCHOIR (`/repo/src/client/render/*.js`, escrito para three 0.186; aquí es **three r160**).

Lee primero: `eclipse/README.md`, `eclipse/docs/ART_DIRECTION.md` (pilares + rúbrica), `eclipse/tools/README.md` (herramientas), `eclipse/src/game/README.md` (qué hay en cada fragmento).

## Estructura
- `eclipse/src/game/*.js` — el juego, en **fragmentos que comparten ámbito** (se concatenan en el orden de `_order.json`; NO son módulos ES: lo declarado en un fragmento se ve en los demás). Los identificadores son los minificados del original (`x` estado global, `x.R` renderer rig `vd`, `Ul` chunk de mundo, `Ie.*` props, `Ln` modelos GLB, `Rd` FX…). Cada sentencia lleva un comentario `// ═══ [índice] …`.
- `eclipse/src/engine/*.js` — módulos ES nuevos del motor (portados/adaptados de SUNDERCHOIR). Se importan con alias `@engine/…` desde un **prelude propio de tu frente**: crea `eclipse/src/game/_prelude.<frente>.js` (el build lo incluye solo, tras `_prelude.js`; no edites `_prelude.js` ni `_order.json` para no pisarte con otros agentes).
- `eclipse/assets/*.json` — sprites y modelos GLB en base64 (no tocar).
- `eclipse/tools/` — `build.mjs`, `shot.mjs` (capturas con guiones), `montage.mjs` (hoja antes|después), `scenarios/`.

## Cómo trabajar
```bash
cd eclipse && npm install                      # solo en un worktree nuevo (three@0.160.1 + esbuild)
ln -s /home/user/aaa/node_modules ../node_modules 2>/dev/null   # Playwright en un worktree (si no existe ../node_modules)
node tools/build.mjs --out dist/eclipse.html   # build minificado   (--dev: sin minificar, errores legibles)
node tools/shot.mjs --scenario tools/scenarios/<guion>.mjs --out <dir> --tag <etiqueta> [--seed 1] [--dpr 1] [--quality high|medium|low]
node tools/montage.mjs --dir <dir> --a antes --b despues --names n1,n2
```
- **Capturas y salidas fuera del repo**: guárdalas en `/tmp/claude-0/-home-user-aaa/3b641f7c-91e0-5f65-bdba-08dc578ec535/scratchpad/eclipse/shots/<frente>/` (nunca las incluyas en un commit; `dist/` y `.build/` ya están ignorados). Para iterar rápido: `--quality medium --size 960x540` (MSAA 2×); la comprobación final, en `high` y 1280x720.
- **Baseline** (el aspecto original, para comparar): `/tmp/claude-0/-home-user-aaa/3b641f7c-91e0-5f65-bdba-08dc578ec535/scratchpad/eclipse/baseline/eclipse.baseline.html`. Capturas del original por región en `…/scratchpad/eclipse/audit/orig-v-*.png`.
- GL por **software** (SwiftShader, sin GPU): un fotograma tarda ≈ 0,3-1 s. **Un solo navegador a la vez**, guiones cortos (una región, una hora), `timeout` en cada ejecución (≤ 280 s en primer plano; lo largo, en segundo plano). Máquina de 4 núcleos compartida con otros agentes.
- **Ahorra contexto**: mira como mucho ~12-15 imágenes en total; usa `montage.mjs` (antes | después en una sola imagen) y recortes en lugar de capturas sueltas; no vuelques logs enormes.
- Las capturas se **miran con ojos críticos** (herramienta Read sobre el PNG) y se juzgan con la rúbrica de `ART_DIRECTION.md`. No basta con que compile: el cambio debe verse mejor y **no empeorar** nada.
- Ganchos de depuración en la página: `window.__G` (estado), `__De` (regiones), `__spawn(kind,x,z,lvl,opts)`, `__step(n,dt)`, `__dbg.*` (paneles), `__fps()`. El guion recibe `api` (ver `tools/README.md`: `region(key)`, `setTime(t)`, `hideUi`, `perf()`, `spawn`, `step`…).

## Reglas duras
1. **Edita solo los ficheros que te asignan** (más ficheros nuevos en `src/engine/`). Si necesitas tocar algo ajeno, hazlo mínimo y dilo en el informe.
2. **Un único Three (r160)**. Nada de copias, nada de red en tiempo de ejecución, **sin recursos binarios nuevos** (texturas y ruido se generan por código). El artefacto final debe seguir ≤ 16 MB (hoy ≈ 12,9 MB).
3. **No cambies la jugabilidad ni el guardado.** Conserva la API del renderer rig y de los demás objetos que usa el resto del juego (`x.R.{r,scene,camera,target,env,bloom,finalPass,post,setQuality,setZoom,setRegionEnv,addShake,flashLight,update,adapt,render,project,unproject,resize,flash,pLight}`).
4. **Todo degrada con elegancia**: `low` (teléfonos) conserva la dirección de arte con las capas caras apagadas. Presupuesto: no subir las llamadas de dibujo ni los triángulos por escena más de un ~15 % sin justificarlo; mide con `api.perf()` antes y después.
5. Móvil: sin trabajo por fotograma que escale con el mapa; sin asignaciones por fotograma en bucles calientes (reutiliza vectores/arrays).
6. Código: comentarios en **español**, breves, que expliquen el *por qué*. Funciones nuevas con nombres legibles; no renombres en masa los identificadores minificados existentes.
7. `node tools/build.mjs` y el humo (`node tools/shot.mjs --scenario tools/scenarios/smoke.mjs`) deben seguir pasando sin errores de consola.
8. **Nunca `git add -A`** (arrastraría enlaces simbólicos y capturas): añade solo tus ficheros (`git add eclipse/src eclipse/tools/scenarios/<tuyos> …`). Commits en tu rama (el worktree ya está en una): mensaje en español, descriptivo, terminado con estas dos líneas exactas:
```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DF6dV4pEcgw6Ze1HF6yf9s
```
   No hagas push ni PR.

## Informe final (lo que devuelves)
Objeto JSON con: `summary` (qué hiciste y por qué se ve mejor), `files` (cambiados), `screens` (rutas de PNG antes/después), `perf` (antes/después de `api.perf()` en las escenas que midas), `risks` (lo que podría romperse o quedó flojo, con honestidad), `commit` (hash).

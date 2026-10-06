# TDD — Technical Design Document

> Complementa a [ARCHITECTURE.md](ARCHITECTURE.md) (qué módulos hay y cómo se conectan). Aquí: **decisiones técnicas, por qué, presupuestos, riesgos y estrategia de pruebas.**

## 1. Decisiones fundamentales
| Decisión | Elección | Motivo |
|---|---|---|
| Plataforma | Navegador (WebGL2) + empaquetable | cero fricción para jugar y probar; la misma base sirve a Tauri/Electron/PWA |
| Lenguaje | JavaScript ESM sin transpilar (ES2022) | se ejecuta idéntico en Node (tests/simuladores) y navegador; sin paso de build para la simulación |
| Render | Three.js 0.186 (WebGL2) | maduro, control total del pipeline, sin motor monolítico; permite sustituir modelos por glTF |
| Bundler | Vite | HMR para iterar contenido/shaders, build estático |
| Simulación | Paso fijo 1/60 s, determinista, sin DOM | reproducibilidad (tests, replays, bugs), balance por simulación, posible multijugador futuro |
| Datos | JSON + Registry congelado | diseñadores crean contenido sin tocar código; validación estática |
| Texto | Claves de localización | i18n desde el día 1; ES/EN con paridad comprobada |
| Assets | 100 % procedurales | sin problemas de licencia; arte sustituible por contrato de articulaciones |
| Pruebas | `node:test` + validadores + simuladores + E2E Playwright | feedback rápido en Node; navegador real para lo visual |

## 2. Determinismo (contrato)
- `Rng` = sfc32 sembrado; `fork(name)` crea flujos independientes por subsistema (loot, IA, clima, mazmorras) para que añadir una llamada en uno **no desplaza** a los demás.
- Orden de actualización fijo y documentado (ver ARCHITECTURE §2). Las colecciones se iteran por orden de inserción; no se usa `Map` con claves no deterministas ni `Date.now()` dentro de `src/sim` (el tiempo es `world.time`).
- Mazmorras: `(familia, tamaño, objetivo, modificadores, semilla)` → mismo mapa, siempre. El **código de semilla** del Gráfico de Resonancia (UI) es exactamente esa tupla, copiable y compartible.
- Un test (`combat.test.js`: *damage numbers are deterministic for equal seeds*) y los de sesión/guardado (`session.test.js`, `story.test.js`) rompen si algo se desvía.

## 3. Bucle del cliente
`requestAnimationFrame` → `dt` real acotado (≤ 0,1 s) → `world.update(dt)` ejecuta *n* pasos fijos → render interpolado/con *frame*-independencia en cámara y VFX. Hit-stop reduce `dt` de simulación (no cambia reglas). Excepciones en un fotograma se capturan y registran (`frame failed`), el bucle continúa. Pausa: cualquier panel «bloqueante» detiene la simulación.

## 4. Rendimiento: presupuestos y técnicas
| Área | Técnica |
|---|---|
| Terreno | heightfield en chunks, normales precalculadas, un material |
| Props | `InstancedMesh` por tipo (viento por *vertex shader*, sin CPU) |
| Mazmorras | suelo **fusionado**, muros/adornos instanciados, luces limitadas por calidad |
| Oclusión | *dither* cámara→jugador en shader (muros no «desaparecen»: se perforan) |
| Entidades | modelos por primitivas con geometrías/materiales **compartidos** (`kit.js`), `disposeTree` respeta la caché |
| IA | LOD por distancia (los lejanos piensan a menor frecuencia), percepción FOV/LOS/oído, un solo *token* de ataque cuerpo a cuerpo por objetivo |
| Navegación | A* sobre rejilla con suavizado de camino; los enemigos **reutilizan** su camino y solo recalculan si el objetivo se movió, pasó 1,5 s o cambió la rejilla, con un **presupuesto de caminos por fotograma** (`pathBudget`) |
| Partículas/VFX | grupos reutilizados (pool), tope por preset de calidad |
| Luces | presupuesto de luces dinámicas por calidad; emisores baratos para el resto |
| Audio | síntesis WebAudio con bus de compresión; voces limitadas, sin samples |
Presets `low/medium/high/ultra` cambian sombras, resolución, bloom, partículas y luces — **nunca** reglas. Medidas: A* 200 caminos en 160×160 < 1,5 s (test `nav.test.js`); generación de mazmorra: **media 137 ms por semilla** (750 semillas, ≈ 19,8 salas, 1,83 intentos de media; `npm run fuzz:dungeons -- 250`) — se genera una vez al entrar, no por fotograma.

## 5. Pipeline de datos
`data/**/*.json` → `Registry` (ids únicos, congelado) → `validate-data` (referencias, esquemas mínimos, locales ES/EN, zona alcanzable, mazmorras de muestra) → runtime. `dataBundle.js` empaqueta los JSON en el cliente con `import.meta.glob`; `nodeLoader.js` los lee del disco en Node. No hay *parsers* distintos: ambos entregan el mismo `Registry`.

## 6. Pipeline de renderizado
Escena → pase principal → `UnrealBloomPass` + gradación de color + shader de **Escucha** (desatura/tiñe el mundo y revela ecos) → pantalla. La **cortina de resonancia** (puertas) y el **clima** (niebla, rayas de lluvia/viento) son efectos de espacio-mundo coordinados con la sim (`WeatherFx`, `GateCurtain`). Los **telégrafos** son *decals* de suelo por forma (círculo/arco/línea/anillo) con relleno progresivo; el color indica familia de peligro y siempre existe una variante accesible (patrón + forma) para daltonismo.

## 7. Audio procedural
`AudioEngine` (WebAudio): buses `sfx/ui/music/ambient` con volúmenes persistentes, reverb convolucional generada, SFX sintetizados (campanas, filos, impactos, UI) con variación por semilla, **música adaptativa** (generativa) que cambia por modo (exploración/combate/jefe/mazmorra/silencio) e intensidad (más capas con más amenaza), viento reactivo al clima y pasos por superficie. Hook de QA: `engine.level()` (RMS) para verificar en E2E que sale señal.

## 8. Guardado
Sobre de versión + checksum + escritura atómica + copias rotativas + migraciones (ver DATA_SCHEMA §4 y `tests/save.test.js`). Diseño para **no perder nunca progreso**: se escribe `.tmp`, se **relee y verifica**, se rota `bak1..N` y solo entonces se promueve. En lectura se prueba principal → `.tmp` → copias, marcando `recovered`.

## 9. Accesibilidad e input (decisiones técnicas)
- Todos los esquemas escriben el mismo `player.cmd`; la simulación no conoce dispositivos.
- Remapeo completo, esquema WASD/clic, mando con asistencia de apuntado, táctil con joystick virtual.
- Escala de UI, modo alto contraste, reducción de sacudidas/destellos, subtítulos para eventos sonoros, indicadores para daltonismo en telégrafos y rarezas (forma + color), tiempo de pulsación configurable, árbol de talentos con **vista de lista accesible** además del lienzo.

## 10. Estrategia de pruebas
| Capa | Herramienta | Qué demuestra |
|---|---|---|
| Unitarias/sistema | `npm test` (72 tests Node) | stats, daño, estados, IA, jefes, ítems, personaje, puzles, zona, sesión, historia completa, guardado |
| Contenido | `npm run validate` | toda referencia resuelve, esquemas, ES/EN en paridad (0 errores/0 avisos) |
| UI/i18n | `tools/check-ui-keys.mjs` | cada clave `t('…')` del cliente existe |
| Generación | `npm run fuzz:dungeons` | 750 semillas (3 familias × tamaños × objetivos) generan mazmorras **válidas** |
| Equilibrio | `npm run balance` | DPS/TTK/botín por clase y nivel; guardia de regresión (código de salida ≠ 0) |
| E2E real | `npm run e2e` | navegador Chromium: arranque, input real, combate, botín, paneles, diálogo, portal, audio, guardar/cargar |
| Bots | `src/sim/bot.js` | un jugador automático competente vence a Brannoch; uno pasivo recibe los golpes (equidad de telégrafos) |
Cada bug encontrado en el desarrollo terminó en un test o en un chequeo del validador (p. ej. recursión de misiones, `boss:defeated` sin jefe en IA, desfase de IDs de diálogo).

## 11. Riesgos conocidos y mitigación
| Riesgo | Mitigación |
|---|---|
| Número de enemigos/luces en GPU modesta | LOD de IA, instanciación, presets; el juego sigue siendo jugable en `low` |
| Dependencia de Three.js | la sim es independiente; el cliente se puede reescribir sin tocar reglas |
| Calidad percibida del arte procedural | contrato de sustitución por glTF (roles de articulación) + [ART_BIBLE.md](ART_BIBLE.md) |
| Explosión de contenido y deuda de equilibrio | modelo central + simulador + validador + topes anti-ruptura |
| Guardados antiguos tras cambios | migraciones versionadas + rechazo explícito de versiones futuras |

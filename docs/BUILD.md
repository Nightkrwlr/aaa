# BUILD — compilar, ejecutar, probar, depurar

## Requisitos
- Node.js ≥ 20 (probado con 22) y npm.
- Navegador con WebGL2 (Chrome/Edge/Firefox/Safari recientes). Para E2E: Playwright + Chromium (`npx playwright install chromium`; en este entorno ya viene preinstalado).
- **Sin assets externos**: modelos, texturas, sonido y música son procedurales; no hay descargas ni licencias que gestionar (ver [ASSET_LICENSES.md](ASSET_LICENSES.md)).

## Comandos
| Comando | Qué hace |
|---|---|
| `npm install` | instala `three`, `vite`, `playwright` |
| `npm run dev` | servidor de desarrollo en `http://localhost:5173` (HMR, **herramientas de desarrollo activas**) |
| `npm run build` | build de producción en `dist/` (herramientas de desarrollo **excluidas**, sin sourcemaps) |
| `npm run build:dev` | build con herramientas de desarrollo y sourcemaps |
| `npm run preview` | sirve `dist/` |
| `npm test` | 72 tests de simulación (Node, sin navegador) |
| `npm run validate` | validador de datos (referencias, esquemas, locales ES/EN, zona, mazmorras de muestra) |
| `node tools/check-ui-keys.mjs` | toda clave `t('…')` del cliente existe en ES y EN |
| `npm run fuzz:dungeons -- 250` | generación masiva de mazmorras: 250 semillas × 3 familias (= 750), tamaños y objetivos rotados; cada semilla debe validar (`--ascii` dibuja el mapa) |
| `npm run balance` | simulador de equilibrio (`-- --quick` para humo; ver [BALANCE.md](BALANCE.md)) |
| `npm run e2e` | E2E con navegador real: `-- --suite play|panels|dungeon|tour|combat|all` |
| `node tools/shot.mjs out.png [--script f.mjs] [--query "e2e=1&autostart=belfry"]` | captura de pantalla / script de Playwright contra el juego |

Cadena de integración recomendada antes de cada commit:
```
npm run validate && node tools/check-ui-keys.mjs && npm test && npx vite build
```

## Ejecutar el juego
`npm run dev` → abre la URL → **Nueva partida** → elige clase (Campanario / Prismante / Rondador), nombre y semilla. **Continuar** carga el último guardado (autoguardado + 3 ranuras manuales, con copias de seguridad rotativas).
Controles por defecto (todos remapeables en *Opciones*): clic izquierdo mover/atacar/interactuar · clic derecho habilidad secundaria · `1–4` y `Q` habilidades · `Espacio` esquiva · `F` Escucha · `R` Voz · `E` interactuar · `Z` poción · `Mayús` fijar posición · `Alt` mostrar todo el botín · `I` inventario · `T` talentos · `V` habilidades y Voces · `J` misiones · `M` mapa · `C` códice · `G` forja · `Esc` pausa. Esquema alternativo WASD. Mando y táctil se detectan automáticamente.

## Parámetros de URL (QA/depuración)
| Parámetro | Efecto |
|---|---|
| `?debug` | logs en nivel `debug` |
| `?e2e=1` | expone `window.__game` (también en builds de desarrollo) |
| `?autostart=belfry\|prismatist\|skirmisher&seed=XYZ` | salta el menú y crea partida |
| `?fixed=1` | avanza 1/30 s **por fotograma** (E2E reproducible en GL por software) |
| `?quality=low\|medium\|high\|ultra` | preset gráfico |
| `?lang=es\|en` | idioma |

## Builds de desarrollo vs. producción
`__DEV_TOOLS__` (definido en `vite.config.js`) es `true` solo fuera de `production`. En desarrollo la tecla `` ` `` (Backquote) abre el **panel de desarrollo** con pestañas: *Cheats* (inmortalidad, nivel, objetos, fichas, talentos), *Spawn* (enemigos/élites), *World* (tiempo, clima, teletransporte, revelar mapa), *Story* (banderas, misiones, puertas), *Dungeon* (semilla/familia/tamaño/objetivo/modificadores, validar), *Perf/debug* (FPS, llamadas de dibujo, triángulos, entidades, logs). En producción ese código **no se incluye**.

## Logs y diagnóstico
`src/core/logger.js`: logger por módulo (`logger('save')`) con niveles `error|warn|info|debug` y buffer circular de 300 entradas (`recentLogs()`). Los errores de fotograma no tumban el bucle: se registran y el juego sigue. Guardado: cada fallo de verificación o de checksum se anota con su causa y el sistema recupera de la copia más reciente válida.

## Telemetría (opt-in)
Desactivada por defecto. Con `settings.telemetry = true` la sesión acumula **localmente** eventos anónimos (`level`, `boss`, `death`, `dungeon_enter`, `dungeon_done` con área/modo/familia/tiempo). **No se envía nada a ningún sitio**: es un buffer en memoria que se descarga como JSON desde *Opciones → Jugabilidad → Descargar telemetría* (`session.telemetry`) para analizar fricción de diseño (dónde se muere, cuánto tarda un jefe).

## Estructura del repositorio
```
data/        contenido JSON (ver DATA_SCHEMA.md)          locales/{es,en}/   textos
src/core/    Rng, EventBus, Registry, i18n, logger        src/sim/           simulación pura (Node-safe)
src/client/  render, UI, input, audio, bucle              tests/             node:test (72)
tools/       validate, balance, fuzz, e2e, shot           docs/              documentación
public/      (vacío: sin assets)                          artifacts/         (git-ignored) capturas E2E
```

## Empaquetado de escritorio / móvil
El build es estático (`base: './'`) y funciona desde cualquier hosting o carpeta local. Para escritorio, Tauri/Electron pueden cargar `dist/index.html`; la capa `LocalStorageAdapter` del guardado se sustituye por un adaptador de fichero (`saveFs.js` ya implementa `fsAdapter` para Node/Electron). No hay dependencias nativas.

## Rendimiento (presets)
`low` (sin sombras, 1× píxel, ≤ 4 luces dinámicas) · `medium` · `high` · `ultra` (sombras suaves, bloom completo, más partículas). La simulación es independiente del render: bajar la calidad no cambia el juego. Sobre GL por software (SwiftShader, sin GPU) el juego corre a pocos fps pero **igual de determinista** gracias a `?fixed=1`.

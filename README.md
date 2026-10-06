# SUNDERCHOIR — El Coro Quebrado

ARPG 3D isométrico (estilo Diablo / Path of Exile) en el navegador, con un universo original: **Oravel**, un mundo que fue afinado como un instrumento y se quedó en silencio. Tú eres el **Reposo** — la única nota que el Coro nunca incluyó — y por eso puedes *escuchar* lo que los demás ya no oyen.

Este repositorio es un **vertical slice jugable y ampliable**: núcleo de simulación completo y probado, cliente 3D, contenido representativo y una arquitectura *data-driven* para crecer sin tocar el motor.

## Jugar
```bash
npm install
npm run dev          # http://localhost:5173
```
**Nueva partida** → clase (Campanario, Prismante, Rondador) → juega. Clic para mover/atacar, `1–4 Q` habilidades, `Espacio` esquiva, **`F` mantenida = Escucha**, `E` interactuar, `I` inventario, `T` talentos, `M` mapa, `J` misiones, `C` códice, `Esc` pausa. WASD, mando y táctil disponibles. Todo es remapeable.

## Tres mecánicas que no son adorno
1. **Cadencia** — el orden de tus habilidades forma *acordes* (Tríada / Unísono / Reprise) con efectos reales; un jefe (Ildra) solo se rompe con una Tríada.
2. **Escucha** — mantén `F` y el mundo revela secretos, botín oculto, pistas de puzles y amplía los telégrafos enemigos. Es la herramienta de exploración y de puzles.
3. **Voces Prestadas** — élites y jefes dejan *Ecos*; si los escuchas, capturas su habilidad y la usas tú.

## Qué hay dentro
- **Combate legible**: telégrafos por forma, i-frames, esquiva perfecta, estados con reacciones, topes anti-ruptura, cada habilidad es JSON.
- **16 comportamientos de IA**, élites con módulos, director de encuentros y de experiencia; 2 jefes de historia + 4 guardianes de mazmorra con fases.
- **Botín con afijos**: la rareza no es poder; únicos que cambian reglas; comparador consciente de tu build; crafteo con riesgo (Estabilidad).
- **Mazmorras procedurales** (3 familias) con grafo de misión, validación automática y semillas compartibles; **puzles** con solución verificada y pistas por capas.
- **Historia con consecuencias**: misiones por objetivos, diálogos con memoria, puertas físicas que se abren por objetivos (nunca «necesitas nivel N»), cadena de secretos.
- **Guardado versionado**: checksum, escritura atómica, copias rotativas, migraciones, exportar/importar.
- **100 % procedural**: sin assets externos (modelos, sonido y música se generan por código).
- ES/EN completos (1.818 claves), accesibilidad (escalas, alto contraste, subtítulos, remapeo, lista de talentos), 4 presets de calidad.

## Comprobar que todo funciona
```bash
npm run validate && node tools/check-ui-keys.mjs && npm test && npx vite build
npm run fuzz:dungeons -- 250    # 750 mazmorras válidas
npm run balance                 # simulador de equilibrio
npm run e2e                     # navegador real (Chromium + Playwright)
```

## Documentación
| Documento | Contenido |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | **Qué está hecho y qué no (leer primero)** |
| [docs/GDD.md](docs/GDD.md) | Diseño del juego: pilares, mecánicas, mundo, clases, progresión |
| [docs/NARRATIVE_BIBLE.md](docs/NARRATIVE_BIBLE.md) | Lore por capas, facciones, personajes, misterios |
| [docs/ART_BIBLE.md](docs/ART_BIBLE.md) | Dirección de arte, paleta, contrato de modelos |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/TDD.md](docs/TDD.md) | Arquitectura y decisiones técnicas |
| [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) | Formato de datos, IDs, guardado, localización |
| [docs/BALANCE.md](docs/BALANCE.md) | Modelo numérico, topes, resultados del simulador |
| [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) | Cómo añadir enemigos, objetos, misiones, mazmorras, regiones, clases |
| [docs/BUILD.md](docs/BUILD.md) · [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md) | Compilar/depurar y plan de pruebas |
| [docs/ASSET_LICENSES.md](docs/ASSET_LICENSES.md) | Licencias (no hay assets de terceros) |

## Estructura
```
data/ locales/      contenido JSON y textos          src/sim/    simulación pura (Node-safe, determinista)
src/client/         render 3D, UI, input, audio      src/core/   Rng, eventos, registro, i18n, logger
tests/ tools/       70 tests, validador, balance, fuzz, E2E        docs/  documentación
```

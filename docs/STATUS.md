# STATUS — qué existe de verdad (y qué no)

> Este documento es deliberadamente honesto: separa lo **construido y probado**, lo **construido pero solo revisado a ojo**, lo **solo diseñado** y lo **no hecho**. Si un sistema no figura aquí como «construido», no lo está.

Versión: 0.2.0 (vertical slice con arte real y capa móvil) · Rama de trabajo: `claude/affectionate-rubin-573u6r`

## 1. Tamaño actual
| | |
|---|---|
| Simulación (`src/sim`) | ≈ 8.150 líneas · headless, determinista |
| Cliente (`src/client`, JS + CSS) | ≈ 13.000 líneas |
| Núcleo (`src/core`) | ≈ 390 líneas |
| Pruebas | **90 tests Node** + 14 guiones E2E de navegador (escritorio y móvil emulado) + simuladores de balance y de ritmo + fuzz de mazmorras + sonda de presupuesto de render |
| Contenido | **623 entradas** en 37 tipos · **1.921 claves de texto** en ES y EN (paridad exacta) |
| Arte | 327 modelos glTF KayKit (CC0, ≈ 13 MB) + arquitectura/terreno pintados por código |
| Documentación | 14 documentos (`docs/`) |

## 2. Construido y verificado automáticamente ✅
| Sistema | Evidencia |
|---|---|
| Estadísticas con orden flat→inc→more, grupos con tope, condiciones por etiqueta | `stats.test.js` |
| Pipeline de daño único, armadura/resistencias, críticos, escudos, DoT, control con DR, reacciones | `combat.test.js` |
| Habilidades 100 % datos, canalizados, cargas, parches de talentos/únicos | `combat/character/items.test.js` |
| **Cadencia**, **Escucha**, **Voces Prestadas** | `bosses.test.js`, `character.test.js`, sesión |
| IA: 16 *brains* + jefe de fases, LOD, percepción, token de ataque | `enemies.test.js` |
| Director de encuentros y de experiencia | `director.test.js` |
| 2 jefes de historia artesanales + 4 guardianes/jefes de mazmorra | `bosses.test.js`, `story.test.js` |
| Loot con afijos y presupuesto de poder, rarezas, únicos, comparador, filtro, **garantía de botín temprano** | `items.test.js`, `session.test.js` |
| Crafteo con Estabilidad, desmontar, mejoras con fallo, consumibles | `items.test.js` |
| Personaje, 3 árboles de talentos, respec con coste, **kit inicial de 2 habilidades y curva de XP rápida al inicio** | `character.test.js` |
| Terraza Baja: terreno, navegación, POIs, spawns alcanzables | `zone.test.js`, `nav.test.js` |
| Mazmorras procedurales: 3 familias, 750 semillas válidas; **los props sólidos bloquean el paso y nunca cortan el camino a nada importante** | `fuzz:dungeons`, `dungeonNav.test.js` |
| Puzles con solución verificada y pistas por capas | `puzzles.test.js` |
| Misiones, diálogos con memoria, puertas por objetivos, secretos, eventos dinámicos, códice | `story.test.js`, `session.test.js` |
| Guardado versionado con checksum, copias rotativas, migraciones, import/export | `save.test.js` |
| Integridad de datos y localización ES/EN | `validate-data` (0 errores, 0 avisos), `check-ui-keys` |
| Equilibrio | `npm run balance` → `BALANCE GUARD: OK` |
| **Ritmo de los primeros diez minutos**, coste de cada manada y probabilidad de ganar al primer jefe, medidos con un bot | `tools/pacing-sim.mjs`, `tools/pack-sim.mjs`, `tools/boss-sim.mjs` (ver BALANCE §9) |
| Maquetación táctil en 9 tamaños de pantalla × zurdo/diestro | `mobile.test.js` |
| Fusión de mallas estáticas (llamadas de dibujo) | `mergeStatic.test.js` |

## 3. Construido y verificado en navegador (E2E + capturas) 🖥
- **Escritorio**: arranque, menú, nueva partida/continuar, HUD, combate con telégrafos, clic para mover/atacar, WASD, interacción, diálogos, tienda, inventario, forja, talentos, habilidades, misiones, mapa, códice, ajustes, pausa, mazmorras de las 3 familias, jefes, audio con señal real, exteriores (asentamiento, bosque, cantera), personajes y animación, botín con rareza y números fusionados, subida de nivel, tutorial invisible, portada.
- **Móvil emulado** (Chromium con UA, DPR, `hasTouch` y áreas seguras; **toques reales multitáctiles por CDP**): 39 comprobaciones de controles en Pixel 7 (stick, ataque mantenido, habilidades con apuntado y cancelación, esquiva, toque en enemigos, pellizco, interacción, menú, autoguardado/pausa en segundo plano, botón atrás, pérdida de contexto WebGL), los primeros cinco minutos de un jugador nuevo en 4 dispositivos, paneles (8) y lienzos (15) con toques, PWA con modo sin conexión.
- **Presupuesto de render** (`tools/perf-probe.mjs`): llamadas de dibujo, triángulos, programas y texturas por preset y escenario (asentamiento, campo, horda, mazmorra).
- Las capturas se generan en `artifacts/shots/` y **se revisan con ojos**, no solo con aserciones (regla en [QA_CHECKLIST.md](QA_CHECKLIST.md) §11).

## 4. Construido pero solo comprobado a ojo / con pruebas ligeras 👁
- **Calidad visual**: estilizado de buena factura (kit KayKit + arquitectura pintada + luz horneada + postproceso HDR). El techo realista es «buen juego indie estilizado», no fotorrealismo AAA.
- **Rendimiento**: medido solo en GL **por software** (SwiftShader) y con *proxies* independientes de la GPU (llamadas, triángulos, programas). **No hay medida en GPU real ni en un teléfono real.** El gobernador adaptativo existe precisamente por eso.
- **Móvil**: emulación fiel de eventos y tamaños, pero sin dispositivo real: ergonomía del pulgar, Safari iOS (barras dinámicas, `pagehide`, audio), notch/isla dinámica y vibración (no existe en iOS) quedan sin probar. Lista de 5 minutos para un teléfono real en [MOBILE.md](MOBILE.md).
- Música y SFX procedurales: funcionan y tienen señal, pero la mezcla final requiere oído humano.
- Accesibilidad: escala UI/texto/HUD, alto contraste, reducción de destellos, subtítulos, sacudida, vibración y paleta para daltonismo existen; verificadas con las paletas, no con usuarios.
- Mando: implementado (`input.js`), sin dispositivo para probarlo.

## 5. Solo diseñado (datos + documentos, sin producción de contenido) 📐
- **Regiones II (Mecanismo de Vesper) y III (Las Mareas Mudas)**: identidad, mecánica ambiental, familias de enemigos, puertas de acceso con requisitos por objetivos (`data/world/regions.json`, `gates.json`) y guía de producción. **No hay zonas jugables ni enemigos propios** más allá de las familias reutilizadas.
- Clases **Corista** y **Ensalmador**: diseño de recurso/fantasía en el GDD; sin datos.
- Dificultades/modos extra (Maestro sí existe; no hay modo endgame/mapas de fin de juego).

## 6. Deuda y límites conocidos (priorizados)
| # | Asunto | Impacto | Plan |
|---|---|---|---|
| 1 | **Validación en dispositivo real** (GPU, iOS, ergonomía) | alto | lista de 5 minutos en MOBILE.md; ajustar el gobernador con datos reales |
| 2 | **Cantidad de contenido**: 26 arquetipos de enemigo, 12 únicos, 3 familias de mazmorra, 5 misiones, 1 zona | medio | la producción masiva está habilitada por datos ([CONTENT_GUIDE.md](CONTENT_GUIDE.md)) |
| 3 | Árboles de talentos de 69 nodos comprables por clase (objetivo del brief: «grandes») | medio | alas exteriores y ramas de especialización |
| 4 | Balance: el bot no flanquea y no kitea de verdad (el Prismante-bot muere ante lanzadores y escudos en la apertura: 3 muertes en 10 min; Campanario y Rondador 0-1); el Rondador nivel 4 no puede con el primer jefe (compuerta suave) | bajo/medio | ver BALANCE §7 y §9: bot con kiteo y flanqueo |
| 5 | Móvil en vertical: algunos solapes entre botones en pantallas estrechas (la matriz de dispositivos los lista); el modo apaisado es el recomendado | medio | reubicar la pastilla de interacción y los botones pequeños en vertical |
| 6 | Hordas en preset `low`: ≈ 475 llamadas de dibujo con 16 enemigos (el tope del preset es 220) | medio | LOD de enemigos y fusión por tipo |
| 7 | Profesiones sin árbol propio; telemetría no persistente entre partidas | bajo | ver CONTENT_GUIDE |
| 8 | Sin multijugador/replays (la sim determinista lo permite) | n/a | fuera de alcance |

## 7. Decisiones de diseño que se mantienen
FUN > cantidad · legibilidad > espectáculo · modularidad > velocidad. Las tres mecánicas diferenciadoras (**Cadencia, Escucha, Voces Prestadas**) están integradas en combate, exploración, puzles, jefes (Ildra exige una Tríada) y botín (Ecos), no son adornos.
**Regla de entrega**: nada se da por bueno solo porque los tests estén en verde; el arte, la luz y la UI se aceptan mirando capturas con ojos críticos y diciendo honestamente lo que falla.

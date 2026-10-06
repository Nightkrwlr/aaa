# STATUS — qué existe de verdad (y qué no)

> Este documento es deliberadamente honesto: separa lo **construido y probado**, lo **construido pero solo revisado a ojo**, lo **solo diseñado** y lo **no hecho**. Si un sistema no figura aquí como «construido», no lo está.

Versión: 0.1.0 (vertical slice) · Rama de trabajo: `claude/affectionate-rubin-573u6r`

## 1. Tamaño actual
| | |
|---|---|
| Simulación (`src/sim`) | ≈ 8.100 líneas · headless, determinista |
| Cliente (`src/client`) | ≈ 5.400 líneas (líneas densas) |
| Núcleo (`src/core`) | ≈ 390 líneas |
| Pruebas | 72 tests Node (≈ 1.290 líneas) + 5 escenarios E2E de navegador + simulador de balance + fuzz de mazmorras |
| Contenido | **623 entradas** en 37 tipos (≈ 390 KB de JSON) · **1.818 claves de texto** en ES y en EN (paridad exacta) |
| Documentación | 11 documentos (`docs/`) |

## 2. Construido y verificado automáticamente ✅
| Sistema | Evidencia |
|---|---|
| Estadísticas con orden flat→inc→more, grupos con tope, condiciones por etiqueta | `stats.test.js` (5) |
| Pipeline de daño único, armadura/resistencias, críticos, escudos, DoT, control con DR, reacciones, daño plano sin doble escalado | `combat.test.js` (9) |
| Habilidades 100 % datos (17 ops de efecto), canalizados, cargas, parches de talentos/únicos | `combat/character/items.test.js` |
| **Cadencia** (Tríada/Unísono/Reprise), **Escucha**, **Voces Prestadas** | `bosses.test.js`, `character.test.js`, sesión |
| IA: 16 *brains* distintos + jefe de fases, LOD, percepción, token de ataque | `enemies.test.js` (3): todos atacan, roles distintos, telégrafos justos |
| Director de encuentros (presupuesto, plantillas, élites con exclusiones), Director de Experiencia | `director.test.js` (2) |
| 2 jefes de historia artesanales (Brannoch, Ildra) + 4 guardianes/jefes de mazmorra | `bosses.test.js` (5) + `story.test.js` |
| Loot con afijos y presupuesto de poder, rarezas, uniques con reglas, comparador consciente de build, filtro | `items.test.js` (6) |
| Crafteo con Estabilidad, desmontar, mejoras con fallo, recetas, consumibles/pociones con eficiencia decreciente | `items.test.js` |
| Personaje, 3 árboles de 70 nodos (69 comprables) con transformadores y presupuesto de puntos menor que el árbol, respec con coste | `character.test.js` (10) |
| Terraza Baja: terreno, navegación, POIs, spawns alcanzables | `zone.test.js`, `nav.test.js` (7) |
| Mazmorras procedurales: 3 familias, grafo→rejilla→validación, 750 semillas válidas | `fuzz:dungeons` (0 fallos; 137 ms/semilla de media) |
| 3 tipos de puzle con solución verificada y pistas por capas | `puzzles.test.js` (4) |
| Misiones por objetivos, diálogos con memoria, puertas por objetivos, secretos, eventos dinámicos, códice | `story.test.js` (7), `session.test.js` (6) |
| Guardado versionado con checksum, copias rotativas, recuperación, migraciones, import/export | `save.test.js` (8) |
| Integridad de datos y localización ES/EN | `validate-data` (0 errores, 0 avisos), `check-ui-keys` |
| Equilibrio: modelo central + simulador (mediana de 5 equipos, dispersión entre clases) + guardia | `npm run balance` → `BALANCE GUARD: OK` (ver BALANCE §5 y §7) |

## 3. Construido y verificado en navegador (E2E + capturas) 🖥
Arranque, menú, nueva partida/continuar, HUD, combate con telégrafos y números de daño, clic para mover/atacar, WASD, interacción con E y por clic, diálogos, tienda, inventario, forja, alijo, talentos (lienzo con zoom/arrastre + lista accesible), habilidades/Voces, misiones, mapa con niebla de guerra, códice, ajustes (remapeo), pausa, Gráfico de Resonancia (mazmorras por código de semilla), portal ↔ mazmorra de las 3 familias, jefes con barra, audio con señal real. Las capturas se generan con `npm run e2e` (`artifacts/shots/`).

## 4. Construido pero solo comprobado a ojo / con pruebas ligeras 👁
- Calidad visual: los modelos son procedurales (legibles, con silueta propia por clase/familia), **no arte final**. Se sustituyen por glTF respetando el contrato de articulaciones.
- Música y SFX procedurales: funcionan y tienen señal, pero la mezcla final requiere oído humano.
- Mando y táctil: implementados (`input.js`), sin dispositivo real para probarlos en este entorno.
- Rendimiento: medido en GL **por software** (≈ 8–15 fps, SwiftShader); en GPU real se espera 60 fps, pero **no está medido**.
- Ajustes de accesibilidad: escala UI/texto/HUD, alto contraste, reducción de destellos, subtítulos, sacudida, vibración existen; la **paleta para daltonismo** (protanopia / deuteranopia / tritanopia, basada en Okabe–Ito) cambia los telégrafos del suelo, las rarezas y los colores de peligro/beneficio del HUD; está aplicada pero solo verificada con las paletas, no con usuarios daltónicos.

## 5. Solo diseñado (datos + documentos, sin producción de contenido) 📐
- **Regiones II (Mecanismo de Vesper) y III (Las Mareas Mudas)**: identidad, mecánica ambiental, familias de enemigos, puertas de acceso con requisitos por objetivos (`data/world/regions.json`, `gates.json`) y guía de producción. **No hay zonas jugables ni enemigos propios** más allá de las familias reutilizadas.
- Clases **Corista** y **Ensalmador**: diseño de recurso/fantasía en el GDD; sin datos.
- Dificultades/modos extra (Maestro sí existe; no hay modo endgame/mapas de fin de juego).

## 6. Deuda y límites conocidos (priorizados)
| # | Asunto | Impacto | Plan |
|---|---|---|---|
| 1 | **Cantidad de contenido**: 26 arquetipos de enemigo jugables (objetivo del brief: 40–60), 12 únicos, 3 familias de mazmorra, 5 misiones, 1 zona | medio | la producción masiva está habilitada por datos ([CONTENT_GUIDE.md](CONTENT_GUIDE.md)); priorizado tras validar el *feel* |
| 2 | Árboles de talentos de 69 nodos comprables por clase (objetivo del brief: «grandes», p. ej. 150+); el presupuesto (44 puntos a L60) ya obliga a elegir | medio | añadir alas exteriores y ramas de especialización (misma técnica: nodos `tmpl` + notables con texto) |
| 3 | Balance: guardia en verde, pero el bot no flanquea (tough alto para Prismante/Rondador), la dispersión entre clases a L10 está en el límite (2,37× de 2,4×) y no se mide AoE multiobjetivo | bajo/medio | ver BALANCE §7: bot con flanqueo y escenarios multiobjetivo |
| 4 | Profesiones: recolección + recetas + alquimia funcionan; **sin árbol de profesión propio** (solo `minProf`) | bajo | añadir progresión de profesión |
| 5 | Telemetría: buffer local opt-in con descarga JSON desde Opciones; **solo vive durante la sesión** (no se persiste entre partidas) | bajo | persistir en `localStorage` con tope |
| 6 | Sin multijugador/replays (la sim determinista lo permite) | n/a | fuera de alcance |
| 7 | Arte: procedural; animación por *rig* simple (balanceos, golpes) | alto en percepción | sustitución por glTF + animaciones |

## 7. Decisiones de diseño que se mantienen
FUN > cantidad · legibilidad > espectáculo · modularidad > velocidad. Las tres mecánicas diferenciadoras (**Cadencia, Escucha, Voces Prestadas**) están integradas en combate, exploración, puzles, jefes (Ildra exige una Tríada) y botín (Ecos), no son adornos.

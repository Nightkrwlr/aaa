# Fragmentos del juego

Se concatenan **en este orden** dentro de un único ámbito (igual que en el bundle original): no son módulos ES, comparten ámbito. `_prelude.js` aporta los imports.

| Fragmento | Contenido |
|---|---|
| `00-core.js` | Ayudantes de esbuild, estado global x, bus de eventos, rejilla espacial (6 sentencias) |
| `01-util.js` | Matemáticas, RNG, formateo, mezcla de colores (12 sentencias) |
| `02-darkmask.js` | Parche de ShaderChunk: máscara de oscuridad (interiores) y su textura (5 sentencias) |
| `03-renderer.js` | Renderer rig (vd): WebGLRenderer, luces, composer, grade final, cámara isométrica (1 sentencias) |
| `04-canvas-tex.js` | Texturas generadas con canvas (glow, anillos, ruido) (7 sentencias) |
| `05-particles.js` | Sistema de partículas / FX instanciado (1 sentencias) |
| `06-input.js` | Mapa de teclas y entrada (1 sentencias) |
| `07-audio.js` | Audio sintetizado (5 sentencias) |
| `08-stats-items.js` | Estadísticas, objetos, rarezas, mejoras, investigación (24 sentencias) |
| `09-regions.js` | Regiones y biomas (datos) (1 sentencias) |
| `10-meshkit.js` | Materiales cacheados (de, Me) y ayudantes de malla (7 sentencias) |
| `11-models.js` | Modelos procedurales: armas, jugador, enemigos, objetivos, botín (16 sentencias) |
| `12-art.js` | Cargador de arte (sprites, texturas, iconos) y clase Pa (10 sentencias) |
| `13-gltf.js` | Carga de modelos GLB, teñido por tipo, tablas de modelos del mundo (12 sentencias) |
| `14-combat.js` | Combate: consultas espaciales, daño, explosiones, peligros, proyectiles (22 sentencias) |
| `15-map.js` | Tipos de casilla, mapa (Fa), investigación (6 sentencias) |
| `16-story.js` | Diálogos y PNJs (2 sentencias) |
| `17-worldgen.js` | Generación procedural del mundo, estructuras y mazmorras (20 sentencias) |
| `18-enemy-defs.js` | Definiciones de enemigos y jefes (1 sentencias) |
| `19-arsenal.js` | Arsenal: módulos, mejoras, desguace (33 sentencias) |
| `20-pickups.js` | Botín en el suelo y recogida (10 sentencias) |
| `21-enemies.js` | Clase de enemigo (vp), IA, mallado de enemigos (8 sentencias) |
| `22-quests.js` | Misiones y encuentros (8 sentencias) |
| `23-propkit.js` | Kit de props procedurales (Ie.*) y geometría fusionada (75 sentencias) |
| `24-chunks.js` | Parche de balanceo del viento y clase de chunk de mundo (Ul) (7 sentencias) |
| `25-save.js` | Guardado local/nube (16 sentencias) |
| `26-spawner.js` | Director de aparición (3 sentencias) |
| `27-hud.js` | HUD, minimapa, tracker (24 sentencias) |
| `28-hack.js` | Mini-juegos de hackeo (4 sentencias) |
| `29-panels.js` | Paneles: inventario, taller, tienda, misiones, mapa, ajustes, muerte, victoria (53 sentencias) |
| `30-menu.js` | Menú principal (3 sentencias) |
| `31-texgen.js` | Texturas de suelo procedurales (Lb) (14 sentencias) |
| `32-boot.js` | Arranque, bucle principal y ganchos de depuración window.__* (24 sentencias) |

## Preludes por frente
`_prelude.js` (generado en la migración) trae los alias de Three y los imports del motor base. Cada frente de trabajo puede añadir **su propio** `_prelude.<frente>.js` con los `import … from '@engine/…'` que necesite: `tools/build.mjs` los incluye automáticamente tras `_prelude.js` (orden alfabético), así que no hace falta tocar `_order.json`.

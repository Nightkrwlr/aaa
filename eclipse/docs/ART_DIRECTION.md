# Dirección de arte — Operación Eclipse (edición «motor nuevo»)

Objetivo: que el juego parezca un título de tienda, no una demo. **Estilizado, legible, con atmósfera**; nunca fotorrealista (techo realista de este motor: «buen indie estilizado»).

## Pilares
1. **Legibilidad primero**: el jugador, los enemigos, los proyectiles y los objetos interactivos se leen al instante sobre cualquier bioma. Contraste de valor antes que de color; siluetas limpias; los peligros (rojo/naranja) y lo interactivo (ámbar/cian) son los únicos acentos saturados.
2. **Profundidad sin ruido**: luz direccional cálida + relleno frío, sombras suaves con contacto, oclusión ambiental horneada en vértices (esquinas, bases de muros, pies de árboles y rocas), niebla de altura que separa planos, viñeta suave. Nada de ruido de alta frecuencia.
3. **Un tono por bioma**: cada región tiene su paleta (valle verde esmeralda, ciudad gris-verdosa lluviosa, desierto ocre, marisma turquesa turbia, tundra azul-blanca, complejo industrial frío, caldera roja, yermo gris-marrón, colmena violeta orgánica). El grade (sombras frías / luces cálidas) es coherente entre biomas; cambia el color, no el lenguaje.
4. **Material, no plástico**: superficies con variación a macroescala (parches de color, suciedad, desgaste), rugosidad variable, bordes más claros y bases más oscuras. Nada plano de un solo color.
5. **Luz que cuenta cosas**: lo emisivo (farolas, ventanas, cristales, lava, armas, ojos de alienígena) brilla de verdad (HDR + bloom) y deja charcos de luz; de noche manda la luz artificial.
6. **Movimiento con intención**: viento en vegetación, partículas ambientales por bioma (polen, polvo, ceniza, nieve, luciérnagas), agua con vida, FX de combate con anticipación y rastro (fogonazo → trazador → impacto → chispas).

## Rúbrica de aceptación (puntúa 1-5; mínimo 4 para aceptar un cambio)
| Criterio | Qué se mira |
|---|---|
| Legibilidad | ¿Se distingue jugador/enemigos/proyectiles/objetos a simple vista, de día y de noche, en cada bioma? |
| Cohesión | ¿Paleta, luz y grade coherentes entre biomas y entre terreno/props/personajes? |
| Profundidad | ¿Hay AO, sombras con contacto, niebla de altura, gradientes de valor? |
| Pulido de bordes | Sin escaleras en los bordes de terreno, sin dientes de sierra (MSAA), sin costuras visibles entre losetas |
| Atmósfera | ¿Se siente el bioma (clima, partículas, luz)? |
| Combate | ¿Fogonazo, trazador, impacto, explosión y daño se leen y dan satisfacción? |
| Rendimiento | Presupuesto de render por escenario, ver `PERFORMANCE.md`. Sin tirones al entrar en una región |
| Móvil | Se ve bien y corre en teléfono (preset `low`/`medium` + resolución dinámica) |

## Reglas técnicas
- **Un único Three** (r160, paquete oficial). Nada de copias.
- Sin dependencias de red en tiempo de ejecución (el artefacto se sirve aislado): las fuentes de Google son opcionales.
- Tamaño final del artefacto ≤ 16 MB (hoy ≈ 12,9 MB: no se añaden recursos binarios nuevos salvo necesidad clara; texturas y ruido se generan por código).
- Toda mejora tiene que degradar con elegancia: `low` (teléfonos) conserva la dirección de arte con las capas caras apagadas.
- No se cambia la jugabilidad ni el guardado (clave `opeclipse_save_v1`).

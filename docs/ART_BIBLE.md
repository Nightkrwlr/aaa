# SUNDERCHOIR — Art Bible

## 1. Dirección
**«Caliza y latón bajo luz de cuarzo»**: formas limpias, siluetas fuertes, materiales con identidad (piedra clara, latón envejecido, cristal resonante), iluminación dramática y color de acento para el gameplay. Estilizado *low‑poly con acabado pintado* (vertex colors, sombreado suave, bloom), pensado para envejecer bien y leerse desde 45°.

## 2. Paleta base
| Uso | Hex | Notas |
|---|---|---|
| Caliza clara (suelo/arquitectura serrana) | `#cfc3a8` | Dominante en R1 |
| Latón envejecido | `#a87a3a` | Tecnología serrana, campanas |
| Sombra azul fría | `#2a3350` | Sombras, niebla |
| Cielo cálido | `#f2c88a → #7aa6c9` | Gradiente alba‑niebla |
| Verde líquen | `#7e9a5a` | Vegetación |
| **Cuarzo resonante** (acento) | `#7fe3ff` | Lo «escuchable»: ecos, secretos |
| Hueco (violeta pálido) | `#b79cff` | Todo lo Hueco y el Silencio |
| Peligro enemigo | `#ff4a3a` | **Solo** telegráficos enemigos |
| Ayuda/beneficio | `#6dff9a` | **Solo** áreas beneficiosas |

## 3. Códigos visuales (consistencia obligatoria)
| Concepto | Código |
|---|---|
| Ataque enemigo peligroso | Área **roja** rellena que se «llena» hasta el impacto + borde brillante |
| Zona de daño persistente | Roja con patrón pulsante |
| Área beneficiosa (curación/buff) | **Verde** suave con partículas ascendentes |
| Área perjudicial ambiental/Silencio | **Violeta** con ondulación |
| Interactivo | Halo **dorado** pulsante en el suelo |
| Eco/secreto (solo Escucha) | **Cian** con anillos concéntricos |
| Botín | Haz vertical por rareza (Fino azul, Afinado dorado, Reliquia naranja) + **forma** del icono distinta (accesibilidad) |
| Estados | Icono + color + partículas propias (quemadura = brasas, hielo = cristales, veneno = burbujas, hemorragia = gotas…) |

## 4. Reglas por cultura
- **Serrana**: simetría, arcos de medio punto, anillos concéntricos, latón + caliza, glifos circulares con «muesca» del Reposo. Iluminación cian.
- **Aldren**: madera, cuerda, tela remendada, formas asimétricas, braseros anaranjados.
- **Taciturna**: blanco/gris, sin ornamento, telas lisas, un solo pigmento azul por prenda.
- **Hueca**: violeta pálido, grietas luminosas en el pecho, bocas selladas, posturas colgantes.
- **Discordante (fauna)**: silueta animal reconocible + «desafine»: partes duplicadas, vibración visual, venas cian‑violeta.

## 5. Siluetas (lectura isométrica)
Cada arquetipo se identifica por silueta a 45°:
| Tipo | Silueta |
|---|---|
| Cuadrúpedo (Acechador, Pellejo) | Horizontal, bajo, cola/cuernos |
| Volador (Zumbrón) | Pequeño, alas semitransparentes, nube |
| Insectoide / Araña de cuerda | Patas radiales |
| Constructo (Centinela, Segador) | Bloque ancho, hombros, rectangular |
| Flotante (Aullador, Cantor) | Vertical con halo, sin pies |
| Subterráneo (Gusano de Eco) | Anillo de tierra + aguijón |
| Humanoide hueco | Alargado, hombros caídos, boca/pecho luminoso |
| Grande (Brannoch) | ×2 altura, masa en un solo lado (martillo/cadena) |
Todos mantienen un único **color de acento** por rol (tanque = latón, artillero = violeta, soporte = verde pálido, asesino = rojo oscuro, controlador = cian).

## 6. Modelos: especificación de reemplazo (placeholders de calidad)
Los modelos del slice son **procedurales** (`data/models/*.json` → `src/client/render/modelBuilder.js`). Para sustituirlos por glTF/GLB:
- **Escala**: 1 unidad = 1 m. Jugador ≈ 1,75 m; enemigo pequeño 0,5–1 m; grande 3–4 m.
- **Origen/pivote**: en los pies, centrado, +Z al frente.
- **Jerarquía de huesos/nodos obligatoria**: `root`, `body`, `head`, `armL`, `armR`, `legL`, `legR`, `weapon` (socket mano), `fxMuzzle` (socket de proyectil), `fxChest`, `fxHead` (aura), `fxGround`.
- **Clips**: `idle, walk, run, attack1..3, cast, hit, death, dodge, interact, special1..3`.
- **Nomenclatura**: `chr_<class>_<variant>.glb`, `enm_<id>.glb`, `prp_<id>.glb`, `tile_<family>_<id>.glb`.
- **Triángulos**: héroe ≤ 12 k, enemigo común ≤ 4 k, jefe ≤ 25 k, prop ≤ 1,5 k (instanciable).
Registro de procedencia: `ASSET_LICENSES.md`.

## 7. Iluminación
Una luz direccional baja y cálida (alba) + hemisférica fría; **puntos de interés iluminados** (braseros, cuarzos) con luz dinámica limitada (≤6 simultáneas) y *emissive* falso para el resto. Las zonas importantes se señalan por **contraste de luz y color**, nunca con flechas.

## 8. Capas del entorno
Foreground (arbustos altos semitransparentes que se difuminan), zona jugable (suelo claro y legible), background (acantilados, acueductos), distancia (silueta del **Cántico Roto**, landmark visible desde casi toda la Terraza), clima (niebla/vendavales con partículas), fauna ambiental (aves de piedra, polillas de cuarzo).

## 9. VFX
Paleta limitada, formas geométricas (anillos, arcos, ondas) coherentes con la temática musical. Hit‑stop 30–70 ms según golpe; screen‑shake opcional y reducible; flashes reducibles. Prioridad de lectura: **telegráfico enemigo > habilidades del jugador > ambiente**.

## 10. UI
Mármol oscuro + latón + cian. Tipografía: sistema serif/humanista (sin dependencias externas). Iconos: **glifos serranos** generados proceduralmente (`src/client/ui/iconGen.js`) con forma = tono/tipo y color = elemento. Contraste AA mínimo; modos daltonismo (protanopia/deuteranopia/tritanopia) por remapeo de paleta + formas.

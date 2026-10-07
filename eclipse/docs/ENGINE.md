# Motor gráfico de Operación Eclipse (`src/engine/`)

Módulos ES portados/adaptados del motor de SUNDERCHOIR (`/src/client/render/*`, three 0.186) a **three r160**. Se importan desde `src/game/_prelude.js` con el alias `@engine/…` y se enganchan en los fragmentos del juego.

## Tubería de fotograma
```
escena ──► destino HDR half-float (MSAA 4× / 2× / 0 según calidad y dispositivo)
        ──► bloom (UnrealBloomPass, parámetros por región)
        ──► pasada final: exposición → mapeo tonal (mezcla Neutral/ACES, UNA vez) → sRGB →
            grade partido (sombras frías / luces cálidas) → saturación/contraste → viñeta →
            daño → tramado triangular + grano
```
- `post.js` → `PostFx` (`configure({samples,bloom})`, `setSize`, `render`, `uniforms`, `bloom`). Detecta GPUs sin `EXT_color_buffer_float` y cae a un destino de 8 bits sin MSAA.
- El renderer rig `vd` (`src/game/03-renderer.js`) conserva su API (`x.R.*`): `finalPass.uniforms` apunta a los uniformes de `PostFx` (el HUD escribe `uHurt`), `bloom` es el `UnrealBloomPass`.

## Atmósfera
- `atmosphere.js` → `WorldFog` + `installWorldFog()`: sustituye los chunks de niebla de three por **niebla exponencial de altura** con velo cálido hacia el sol; la usan todos los materiales con niebla sin tocarlos uno a uno. Los valores viajan en los uniformes estándar (`fogNear` = densidad, `fogFar` = caída con la altura).
- `REGION_LOOK` / `lookFor(key)` → «mirada» por bioma (densidad, grade, bloom, exposición, viñeta). El renderer la mezcla con suavidad al cruzar de región.

## Cómo añadir un módulo
1. Crea `src/engine/<modulo>.js` (ES, importa solo de `three` y `three/examples/jsm/*`).
2. Añade su `import` a `src/game/_prelude.js`.
3. Engánchalo desde el fragmento que corresponda (con un comentario que diga qué cambia respecto al original).
4. Documenta aquí lo que expone.

> Una sola copia de three: el build resuelve `three` desde `eclipse/node_modules` (0.160.1). Los módulos de SUNDERCHOIR se **portan** (no se importan desde `/src`), porque usan APIs de 0.186.

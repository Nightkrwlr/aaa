# Operación Eclipse — proyecto reconstruido

Shooter isométrico 3D de exploración (operador de fuerzas especiales contra una invasión alienígena). Este directorio contiene el juego **reconstruido a partir del artefacto publicado**, para poder mejorarlo con el motor gráfico de SUNDERCHOIR.

## Qué es y de dónde sale

El artefacto original era un único HTML de ≈12,9 MB: dos blobs JSON (sprites WebP y modelos GLB en base64) y un bundle esbuild minificado que mezclaba **Three.js r160**, los addons oficiales y ≈480 sentencias de juego. No se conservaba el código fuente.

La migración (`legacy/` guarda el bundle original comprimido) hizo lo siguiente, sin cambiar el comportamiento:

1. Separó las sentencias de nivel superior del bundle y clasificó cuáles son **librería** (Three core + addons) y cuáles **juego** (cierre por dependencias: la librería nunca referencia al juego).
2. Mapeó los 78 símbolos de librería que usa el juego a los nombres reales de `three@0.160.1` por firma de métodos (36 clases por firma exacta; el resto, por tipo/constante) → `src/game/_prelude.js`.
3. Dejó el juego en `src/game/*.js` como **fragmentos que comparten ámbito** y se concatenan en orden (`_order.json`), igual que en el bundle original. No son módulos ES: así se conserva el orden de evaluación exacto.
4. `tools/build.mjs` los empaqueta con esbuild junto a Three oficial y los blobs de `assets/`.

> Los identificadores del juego siguen siendo los minificados (`x`, `Ul`, `vd`…); cada fragmento lleva un comentario por sentencia con su índice original y `src/game/README.md` resume qué contiene cada fichero.

## Uso

```bash
cd eclipse && npm install
npm run build        # dist/eclipse.html (documento completo) + dist/eclipse.artifact.html (fragmento para publicar como Artifact)
npm run build:dev    # sin minificar
```

## Motor gráfico

`src/engine/` contiene los módulos portados/adaptados del motor de SUNDERCHOIR (post-proceso HDR, atmósfera, materiales pintados, luz horneada, FX) y su enganche en el juego. Ver `docs/ENGINE.md` cuando exista.

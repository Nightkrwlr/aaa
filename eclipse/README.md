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
npm run build:host   # edición para alojamiento propio (Hostinger…): dist/host/index.html + manifiesto e iconos (ver «Alojamiento»)
```

## Motor gráfico

`src/engine/` contiene los módulos portados/adaptados del motor de SUNDERCHOIR (post-proceso HDR, atmósfera, materiales pintados, luz horneada, FX) y su enganche en el juego. Ver `docs/ENGINE.md` cuando exista.

## Alojamiento propio (Hostinger u otro hosting estático)

`npm run build:host` (o `node tools/build.mjs --host --out dist/host/index.html --title "Operación Eclipse Remasterizada"`) deja en `dist/host/`
todo lo que hay que subir, sin dependencias de servidor:

| fichero | para qué |
|---|---|
| `index.html` | el juego completo en un único documento (≈ 13 MB; el hosting lo comprime ≈ 3:1 al servirlo) |
| `manifest.webmanifest` | permite instalarlo como app: pantalla completa y en horizontal |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32.png` | iconos (se rasterizan de `public/icon.svg` con `node tools/make-icons.mjs`) |

Esta edición añade al `<head>` los metadatos de app móvil (`theme-color`, `apple-mobile-web-app-*`), enlaza el manifiesto y los iconos y marca la página
`noindex`. El guardado usa `localStorage` (la capa de `window.claude` del Artifact solo se activa dentro de claude.ai). Se aloja en cualquier carpeta:
las rutas son relativas.


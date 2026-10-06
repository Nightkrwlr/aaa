# ASSET LICENSES

**Este proyecto no incluye ningún asset de terceros con licencia dudosa. De hecho no incluye assets binarios de arte ni audio.**

| Tipo | Origen | Licencia |
|---|---|---|
| Modelos 3D (héroes, enemigos, jefes, NPC, props, estructuras) | generados por código a partir de primitivas (`src/client/render/models.js`, `structures.js`, `kit.js`) con parámetros en `data/models/models.json` | propia del proyecto |
| Texturas / materiales | procedurales (shaders y *vertex colors*); sin imágenes | propia del proyecto |
| Iconos y glifos de UI | dibujados por código en canvas/SVG (`src/client/ui/`, `glyphs.js`) | propia del proyecto |
| Efectos visuales | partículas y *decals* procedurales (`vfx.js`) | propia del proyecto |
| Efectos de sonido | síntesis WebAudio en tiempo real (`src/client/audio.js`) | propia del proyecto |
| Música | generativa en tiempo real (mismo motor; sin samples ni MIDI de terceros) | propia del proyecto |
| Tipografías | pila de fuentes del sistema (`ui.css`); no se incrusta ninguna fuente | n/a |
| Texto, lore, nombres, mundo (SUNDERCHOIR, Oravel, el Coro Quebrado…) | creados para este proyecto; **ninguna IP existente** | propia del proyecto |

## Dependencias de código
| Paquete | Uso | Licencia |
|---|---|---|
| `three` | render WebGL | MIT |
| `vite` | bundler/dev server (dev) | MIT |
| `playwright` | E2E (dev, no se distribuye) | Apache-2.0 |
Comprobable con `npm ls` / `package-lock.json`.

## Regla para contribuciones
1. **Preferir siempre procedural.** Un asset nuevo se genera por código o se encarga a un artista con cesión de derechos escrita.
2. Si se incorpora un asset externo (CC0/CC-BY/comercial) debe registrarse **aquí** con: archivo, autor, URL de origen, licencia, fecha, y requisitos de atribución. Sin entrada en esta tabla, el asset no se integra.
3. Prohibido: assets extraídos de otros juegos, modelos «de estilo» de franquicias, tipografías sin licencia, música/SFX de bancos sin licencia comercial, texto o nombres de IP ajenas.
4. Los modelos de sustitución (glTF) deben respetar el contrato de articulaciones de [ART_BIBLE.md](ART_BIBLE.md) y se licencian como el resto del repositorio o con la licencia declarada aquí.

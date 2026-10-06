# ASSET LICENSES

**Todo el arte de terceros que incluye este proyecto es CC0 1.0 (dominio público): uso comercial y sin atribución obligatoria.**
Aun así se acredita aquí y en la pantalla «Acerca de».

## Arte de terceros (CC0)
Autor: **Kay Lousberg — KayKit** (https://kaylousberg.com). Descargado de los repositorios oficiales (`git clone --depth 1`) y procesado con `tools/assets/build-assets.mjs` (se descartan clips de animación no usados, se cuantizan y comprimen las mallas con meshopt; la geometría y las texturas no se modifican).

| Pack | Repositorio | Licencia | Uso en el juego | Salida |
|---|---|---|---|---|
| KayKit Character Pack: Adventurers 1.0 | `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0` | CC0 1.0 | clases jugables y PNJ (Knight, Barbarian, Mage, Rogue, Rogue_Hooded), armas y escudos | `public/assets/models/chars`, `weapons` |
| KayKit Character Pack: Skeletons 1.0 | `KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0` | CC0 1.0 | enemigos humanoides (Warrior, Mage, Rogue, Minion) y sus armas | `chars`, `weapons_skeleton` |
| KayKit Dungeon Remastered 1.0 | `KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0` | CC0 1.0 | mazmorras: muros, suelos, puertas, columnas, antorchas, cofres, mobiliario | `dungeon` |
| KayKit Halloween Bits 1.0 | `KayKit-Game-Assets/KayKit-Halloween-Bits-1.0` | CC0 1.0 | exterior: árboles, lápidas, cripta, vallas, farolas, caminos | `graveyard` |

Las animaciones (75 clips; el juego conserva ~70) vienen de los propios packs y se comparten entre todos los personajes (mismo esqueleto de 41 huesos) en `public/assets/models/anims/Rig_Medium.glb`.
`public/assets/manifest.json` lista cada modelo con su tamaño y caja envolvente.

## Procedural (propio del proyecto)
Todo lo demás se genera por código: terreno, rocas y vegetación del exterior, estructuras singulares (cilindros de voz, campanas, la cortina de resonancia), efectos visuales, iconos, **sonido y música** (WebAudio, sin samples) y el texto/lore/nombres (SUNDERCHOIR, Oravel, el Coro Quebrado… ninguna IP existente).

## Dependencias de código
| Paquete | Uso | Licencia |
|---|---|---|
| `three` | render WebGL | MIT |
| `vite` | bundler/dev server (dev) | MIT |
| `playwright` | E2E (dev, no se distribuye) | Apache-2.0 |
| `@gltf-transform/*`, `meshoptimizer` | optimización de assets (dev) | MIT |
Comprobable con `npm ls` / `package-lock.json`.

## Regla para contribuciones
1. **Preferir siempre procedural.** Un asset nuevo se genera por código o se encarga a un artista con cesión de derechos escrita.
2. Si se incorpora un asset externo (CC0/CC-BY/comercial) debe registrarse **aquí** con: archivo, autor, URL de origen, licencia, fecha, y requisitos de atribución. Sin entrada en esta tabla, el asset no se integra.
3. Prohibido: assets extraídos de otros juegos, modelos «de estilo» de franquicias, tipografías sin licencia, música/SFX de bancos sin licencia comercial, texto o nombres de IP ajenas.
4. Los modelos de sustitución (glTF) deben respetar el contrato de articulaciones de [ART_BIBLE.md](ART_BIBLE.md) y se licencian como el resto del repositorio o con la licencia declarada aquí.

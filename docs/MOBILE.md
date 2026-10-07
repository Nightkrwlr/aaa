# MÓVIL — jugar SUNDERCHOIR desde el teléfono

> Requisito de producto: **el juego tiene que poder jugarse perfectamente desde un móvil**, no «verse en un móvil». Esta página explica cómo se juega, cómo está construido, cómo se prueba y **qué no se puede garantizar sin un dispositivo real**.

## 1. Principios
1. **Dos pulgares, cero precisión**: moverse y atacar nunca exigen apuntar con exactitud. El punto de mira lo pone el juego (enemigo más cercano) y el jugador solo corrige cuando quiere.
2. **Todo es alcanzable con el pulgar** y nada que se use en combate está por debajo de 44 css px (los botones principales miden 54–86 px según la pantalla).
3. **Sin cosas de ratón**: ningún flujo depende de hover, clic derecho ni arrastrar con precisión. Hay equivalentes táctiles (pulsación larga, doble toque, arrastrar tras mantener).
4. **El móvil no es un PC pequeño**: la aplicación sobrevive a llamadas, cambios de app, rotaciones, bloqueo de pantalla y pérdida de la GPU sin perder la partida.
5. **Rendimiento adaptativo**: el juego mide su propio rendimiento y baja/sube calidad solo; el jugador nunca debería tener que abrir Ajustes para que vaya fluido.

## 2. Controles táctiles (por defecto)
| Gesto / botón | Efecto |
|---|---|
| **Pulgar izquierdo, abajo-izquierda** | **Joystick flotante**: aparece donde apoyas el dedo; si te sales del radio, la base te sigue. Un toque rápido es un toque en el mundo. |
| **Botón grande (abajo-derecha)** | **Ataque**: mantener = auto-ataque al enemigo más cercano; arrastrar mientras se mantiene = apuntar a mano |
| **Botones en arco** | **Habilidades y esquiva**. Toque = lanzar al enemigo más cercano. Mantener y arrastrar = apuntar (se dibuja la línea) y soltar = lanzar; arrastrar de vuelta al botón = **cancelar**. Las de uso propio (escudos, nova) se lanzan al pulsar; las canalizadas (rayos) canalizan mientras se mantienen y el arrastre las orienta. |
| **Esquiva** | hacia donde empujas el joystick; si estás quieto, **retrocede** alejándote del enemigo más cercano |
| **Poción / Escucha / Voz** | botones pequeños. **Escucha**: toque para activar/desactivar (o mantener, en Ajustes) |
| **Pastilla dorada (abajo-centro)** | **Interactuar / Recoger** (aparece sola junto a un PNJ, objeto o botín) |
| **Tocar un enemigo / botín / PNJ** | atacarlo / recogerlo / hablar con él (áreas de toque generosas) |
| **Dos dedos** | zoom de cámara |
| **☰ (arriba-derecha)** | menú: mochila, habilidades, talentos, misiones, mapa, códice, forja, ajustes, pausa, controles táctiles, pantalla completa |
| **Botón «atrás» del sistema** | abre la pausa (no te saca del juego) |
| **Pulsación larga / doble toque / mantener y arrastrar en paneles** | clic derecho / doble clic / arrastrar y soltar (inventario, equipo…) |

### Paneles en el teléfono
Los paneles de escritorio no se encogen: en teléfono tienen **su propia maquetación** (`src/client/mobile/panels.css`, acotada por `html.phone`):
- **Mochila** (apaisado): tres columnas que se desplazan por separado — equipo · mochila (casillas de 46 px que rellenan la columna) · detalle del objeto con sus acciones (≥ 44 px). El *tooltip* flotante no existe en táctil: el detalle del objeto seleccionado ocupa su lugar.
- **Talentos**: el lienzo con zoom/arrastre sigue disponible (arrastre con un dedo, pellizco con dos, **doble toque para confirmar** un talento), pero en teléfono se abre por defecto la **lista accesible** (buscable), que es lo cómodo con el pulgar.
- Pestañas con desplazamiento horizontal, controles ≥ 40 px, columnas con `overscroll-behavior: contain`, nada de foco visible sin teclado.
- Los textos de ayuda cambian de vocabulario (dedo / teclado): ver `locales/*/hints.json`.

### Tutorial invisible
`src/client/hints.js` (≈ 100 líneas): ocho pistas de una sola vez («mueve el stick», «mantén el botón de ataque», «arrastra una habilidad para apuntar»…) que aparecen **cuando surge la situación** (primer enemigo cerca, primer botín en el suelo, primer nivel…), con el vocabulario táctil o de teclado según el dispositivo, y desaparecen solas o en cuanto el jugador hace lo que se le pide. No bloquean la entrada, no se repiten (se recuerdan en `localStorage`) y nunca hay dos a la vez.

Ajustes (☰ → *Controles táctiles*): mostrar controles (auto/siempre/nunca), esquema (joystick o tocar para moverse), tamaño y opacidad de los botones, **modo zurdo**, Escucha por toque o mantenida, línea de apuntado, vibración, modo de rendimiento (automático / ahorro de batería 30 fps / fluido 60 fps) y resolución de render.

Dispositivos híbridos (portátil táctil): los controles táctiles aparecen cuando se toca la pantalla y se ocultan cuando se vuelve a mover un ratón.

## 3. Instalar como app (recomendado)
- **Android (Chrome)**: menú ⋮ → *Instalar app* (el juego lo propone solo tras unos minutos de juego). Se abre a pantalla completa, sin barra del navegador, y funciona **sin conexión** después de la primera carga.
- **iPhone/iPad (Safari)**: Compartir → *Añadir a pantalla de inicio*. En iOS es **importante**: Safari borra los datos de los sitios web que no se usan durante ~7 días, **excepto las apps instaladas**. Si no instalas el juego, exporta tu partida de vez en cuando (menú principal → Importar/Exportar).
- Se pide almacenamiento persistente (`navigator.storage.persist`) y el juego mantiene la pantalla encendida mientras se juega (Wake Lock).

## 4. Rendimiento
- **Preset inicial por dispositivo** (`perfClass`): móviles de gama media/alta → `medium`, el resto → `low`.
- **Gobernador adaptativo** (`src/client/mobile/perf.js`): mide los fotogramas reales y recorre una escalera 0‥6 (escala de render ×0,85 → preset inferior → ×0,7 → preset mínimo → ×0,55 → tope de 30 fps); sube con prudencia y con periodo de prueba. Nunca sobrescribe lo que eligió el jugador.
- **Ahorro de batería**: tope de 30 fps (`fpsCap`).
- Presupuestos: la simulación es independiente del render; las luces dinámicas, sombras, partículas y post-proceso dependen del preset.

## 5. Ciclo de vida (`src/client/mobile/lifecycle.js`)
| Situación | Qué hace el juego |
|---|---|
| Pasas a otra app / bloqueas / llamada | **autoguarda** (`visibilitychange`/`pagehide`, el único evento fiable en iOS) |
| Vuelves tras >1,2 s | abre la **pausa** (no mueres mientras mirabas el móvil) |
| Se pierde el contexto WebGL | pausa + aviso «Recuperando los gráficos…»; three.js recupera los recursos y el juego continúa |
| Primer toque | desbloquea el audio (iOS exige un gesto `touchend`) y fija la sesión de audio a *playback* (suena aunque el interruptor de silencio esté activado, iOS 17+) |
| Rotar el móvil | re-maquetación completa (controles, HUD, paneles) |
| Gestos del navegador | desactivados: zoom por pellizco, doble toque, pull-to-refresh, menú contextual, selección de texto |
| Botón/gesto «atrás» | abre la pausa |

## 6. Arquitectura
```
src/client/mobile/
  device.js        detección (táctil/ratón, phone/tablet, iOS/Android, standalone) + clases html + cambio dinámico táctil⇄ratón
  layout.js        reparto de botones en anillos alrededor del pulgar + relajación anti-solape (funciones puras, con tests)
  touchControls.js joystick, botones, apuntado por arrastre, toques en el mundo, pellizco, interacción contextual, vitales, vibración
  mobileMenu.js    paneles ☰ y «Controles táctiles»
  panelTouch.js    pulsación larga → contextmenu · doble toque → dblclick · drag&drop táctil para los paneles de escritorio
  lifecycle.js     guardado/pausa, audio, wake lock, botón atrás, pérdida de GPU, instalación, avisos
  perf.js          gobernador de rendimiento y valores iniciales por dispositivo
  mobile.css       todo lo táctil, acotado por clases de <html> (el escritorio no cambia)
public/manifest.webmanifest · public/sw.js · public/icons/*  → PWA (service worker generado por vite.config.js)
```
Contrato con el resto del juego: los controles solo escriben en `Input.touch` (stick), `Input.virtual` (ataque/apuntado) y llaman a `Input.hooks.onAction/onMouse` — **la simulación no sabe que hay un dedo**. En `game.js` solo hay cuatro puntos de contacto: `touchAim()` (punto de mira táctil), ataque mantenido, ignorar toques en suelo desnudo con joystick y el tope de fps.

Añadir un botón: añade su `id` a `SLOTS` en `layout.js` (anillo/ángulo preferido) y su comportamiento en `touchControls.js` (`#btnStart/#btnEnd`).

## 7. Cómo se prueba
- `node tools/mobile-shot.mjs [--device pixel7|iphone14|se|small|tablet] [--portrait]`: abre el juego en un Chromium **emulando móvil** (UA, DPR, `hasTouch`, áreas seguras) y lo maneja con **eventos táctiles reales multitáctiles** (CDP). Comprueba: modo táctil, auditoría de botones (tamaño ≥ 40 px, dentro de pantalla, sin solapes), joystick, ataque mantenido con auto-apuntado, toque/arrastre/cancelación de habilidades, esquiva, toque en enemigos, pellizco, botón de interacción, menú y paneles dentro de la pantalla, autoguardado y pausa al pasar a segundo plano, botón atrás, pérdida y recuperación de contexto WebGL.
- `node tools/mobile-shot.mjs tools/e2e/mobile-menus.mjs --device pixel7 --query "e2e=1&fixed=1&quality=low"`: **los primeros cinco minutos de alguien que no conoce el juego**: título → nueva partida → clase → comenzar → jugando → ☰ → pausa, todo con toques reales (nada de teclado ni ratón). Comprueba que cada botón cabe en pantalla (o se alcanza deslizando el dedo), mide ≥ 44 px y que no hay scroll horizontal.
- `--dpr 1` en cualquiera de los anteriores: la maquetación es en px CSS, así que una pasada a DPR 1 comprueba lo mismo con ~7× menos relleno de píxeles en el renderizador por software (imprescindible en una máquina con pocos núcleos).
- `tools/e2e/mobile-panels.mjs`, `mobile-canvas.mjs`, `mobile-looks.mjs`: los paneles con toques reales (mochila, talentos con lienzo y lista, tooltips, doble toque), el puente táctil→ratón de los lienzos y una galería de capturas de todos los paneles en teléfono (`artifacts/shots/look_*.png`, para mirarlas con ojos, no solo con aserciones).
- `node --test tests/mobile.test.js`: la maquetación de botones en 9 tamaños de pantalla (apaisado, vertical, tablet) × zurdo/diestro.
- `node tools/perf-probe.mjs --preset low,medium,high [--strict]`: **presupuesto de render** por preset y escenario (asentamiento tranquilo · campo abierto · campo con 16 enemigos): llamadas de dibujo, triángulos, programas, texturas, mallas con esqueleto, luces y casters de sombra. Son proxies independientes de la GPU de lo que paga un móvil; `--strict` falla si un preset supera su tope (`low` ≤ 220 llamadas y 260 k triángulos). Los `ms` salen del renderizador por software: solo sirven para comparar dos ejecuciones entre sí.

### Lo que la emulación NO puede garantizar (hay que probarlo en un teléfono real)
1. **Rendimiento real de la GPU** (se prueba con renderizado por software). El gobernador existe precisamente por esto.
2. Comportamiento exacto de **Safari iOS** (barras dinámicas, `pagehide`, audio y silenciador, vibración no disponible en iOS).
3. Ergonomía real del pulgar en tu mano y tu pantalla (por eso hay tamaño, opacidad y modo zurdo).
4. Notch/isla dinámica y barras del sistema (se emulan las áreas seguras, no el aspecto).

### Lista de comprobación en dispositivo real (5 minutos)
- [ ] Abrir la URL; «Añadir a pantalla de inicio»; abrir desde el icono → pantalla completa.
- [ ] Mover con el joystick; atacar manteniendo; lanzar 3 habilidades; esquivar; usar poción.
- [ ] Arrastrar una habilidad para apuntar y cancelar arrastrando de vuelta.
- [ ] Tocar a un PNJ → diálogo; tocar botín → recoger; botón de interacción.
- [ ] ☰ → mochila: tocar, mantener (menú), doble toque (equipar), arrastrar a un hueco.
- [ ] Rotar a vertical y a horizontal; pellizcar para hacer zoom.
- [ ] Cambiar de app 10 s y volver (debe aparecer la pausa y la partida seguir intacta).
- [ ] Jugar 10 min en una zona con muchos enemigos: ¿tirones? ¿calienta? Probar «Ahorro de batería».

## 8. Limitaciones conocidas
- La vibración no existe en iOS (Safari no implementa `navigator.vibrate`).
- Los paneles pequeños (misiones, códice, ajustes…) son los de escritorio a pantalla completa con controles de 40 px; mochila y talentos tienen maquetación propia. El mapa sigue siendo un lienzo que se maneja con arrastre/pellizco.
- El modo vertical es jugable pero **el horizontal es el recomendado** (el juego lo sugiere una vez).

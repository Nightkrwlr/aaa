# Operación Eclipse — Ampliación de profundidad (diseño)

Contrato de diseño para los agentes. Parte de lo que el juego YA hace (mapeado del código, oct 2026) y fija objetivos medibles.
Cada frente lee este documento, `docs/AGENT_BRIEF.md` y `src/game/README.md`, y se queda en sus ficheros.

## 0. Principios

1. **Lo bueno es un hito.** Escasez + celebración. Si algo cae cada minuto, no emociona. Si cae una vez cada varias horas, se recuerda.
2. **Elecciones con coste.** Se acabaron las mejoras aleatorias: el jugador construye un personaje (tanque, daño, velocidad, utilidad…).
3. **Nada es trivial de conseguir.** Armas, equipo y módulos exigen explorar, resolver, hackear o derrotar algo.
4. **El mundo cuenta cosas.** Lugares con sentido (no cuadrados vacíos), lore que sirve para algo (códigos, pistas de puzles, planos).
5. **Móvil primero en la UI nueva** (pulgar, `pointer events`, sin hover obligatorio) y presupuesto de render intacto (sin más llamadas de dibujo por enemigo).
6. **Datos antes que lógica:** tablas en `x.cfg.<sistema>`; los números se ajustan con simulaciones, no a ojo.
7. **Ninguna partida se rompe:** todo campo nuevo del guardado se añade con una migración idempotente.

## 1. Infraestructura ya creada (úsala, no la reinventes)

- Fragmentos reservados, evaluados antes de `32-boot.js`: `31a-economy`, `31b-talents`, `31c-gadgets`, `31d-lore`, `31e-hacking`, `31f-puzzles`, `31g-bosses`, `31h-world2`, `31i-surprises`. Cada frente escribe **sobre todo en el suyo**; en los ficheros antiguos solo cirugía mínima (una línea que llame a tu función) para no colisionar al fusionar.
- Ganchos en `x`: `x.tick.push((dt) => …)` (cada fotograma de simulación, no pausado, también en `__step`), `x.migrations.push((S) => …)` (idempotente; se llama desde `fS` al cargar y en partida nueva), `x.cfg.<sistema> = {…}` (datos).
- Bus de eventos `It(nombre, fn)` / `ee(nombre, …args)`: ahora cada manejador va en `try/catch` (un fallo ya no aborta al emisor). Eventos existentes: `kill(e)`, `bossKilled`, `levelUp(n)`, `save`, `hack`, `lore`, `toast`, `openLevelUp`. Eventos nuevos que debes emitir si tu frente los origina: `chestOpen(chest, items)`, `milestone(item, src)`, `drop(item, src)`, `gadgetPlaced(g)`, `gadgetTriggered(g, enemies)`, `talentChanged()`, `hackDone(result)`, `puzzleSolved(p)`, `bossEngaged(b)`.
- Teclas ya mapeadas en `yw` (06-input.js): `T` → `talents`, `X` → `gadget` (pulsar: desplegar; mantener: detonar), `Z` → `gadgetNext`. Se consumen con `Tt.hit("talents")`. Para táctil, botones `data-a` en 27-hud.js (+ CSS en `html/template.head.html`).
- Paneles: `Ze.open(clave, html, {modal, silent, noPause})` / `Ze.close()` (29-panels.js). Un panel nuevo = una clave y su propio estado (no uses `Bl`, `Gi`, `Dn`, `Mr`).
- Guardado: JSON único `S` (`kp` crea la partida, `fS` migra). Solo JSON, nada de referencias compartidas. Cada frente fija su bandera `S.<frente>V = 1`.
- **Cuidado conocido:** `__spawn(tipo, NIVEL, x, z, opts)` (el nivel va antes de x,z). Añadir llamadas a `Lt()`/`e()` en la generación del mundo desplaza el RNG y cambia el mapa (solo el frente de mundo puede hacerlo y debe subir `mapV`).

## 2. Frente ECONOMÍA — botín, XP, dificultad, trofeos, venta (D1 + D4)

### 2.1 Hoy (hechos medidos)
Normal: XP 1-3 orbes, créditos 40 %, chatarra 28 %, materiales por familia, vida 4,5 %, granada 1,8 %, botiquín 1,2 %, módulo 1,2 %, plano 0,35 %. Élite ×4-6. Jefe: 14 orbes, créditos ×40, 2 módulos, 30 % módulo legendario, plano ≥ Raro. Rarezas (peso, luck 0): Común 62, Poco común 27, Raro 8,5, Épico 1,3, Legendario 0,18, Mítico 0,02 (`Ct`, `yo()` en 08-stats-items). Cofres: tiers 1-3, reaparecen a 120 min. Curva: `xpToNext = 40·n^1.75+40` (≈24 muertes L1→2, ≈100 en L10, ≈160 en L30). **La venta está rota**: `data-act sell` (29-panels ~321) exige `Gi`, que solo existe dentro de la tienda y `uiClosed` lo anula. Tienda: 4 planos + 5 módulos por PNJ, rota cada 15 min.

### 2.2 Objetivos de diseño
- **Menos cosas, más peso.** Por cada 100 muertes normales: ≈ 20 recogidas de créditos, ≈ 15 de materiales, ≈ 30 de trofeos (§2.5), ≤ 5 consumibles, ≈ 0,5 módulos, ≈ 0,15 planos. Las orbes de XP se funden en una por ráfaga (0,4 s) o se ingresan directo con «+xp» flotante: el suelo no debe quedar sembrado.
- **Rarezas por fuente (API única `rollLoot(src, lvl, ctx)`)**, porcentaje sobre equipo/arma/módulo (luck 0; la suerte ×1…×2 solo en los tramos altos, nunca crea una rareza que la fuente no permita):

  | fuente | Común | Poco c. | Raro | Épico | Legendario | Mítico |
  |---|---|---|---|---|---|---|
  | normal | 72 | 23 | 5 | 0 (cap) | 0 | 0 |
  | élite | 50 | 33 | 14 | 3 | 0 | 0 |
  | campeón / cofre t3 / secreto | 28 | 40 | 25 | 6,8 | 0,2 | 0 |
  | jefe principal | 0 | 30 | 50 | 17 | 3 | 0 |
  | jefe secreto / guarida | 0 | 20 | 50 | 25 | 4,6 | 0,4 |
  | jefe final (Mente) | 0 | 0 | 40 | 40 | 18 | 2 |

  Meta: primer Raro ≈ 25-40 min, primer Épico ≈ 3-4 h, primer Legendario ≈ 20-30 h de juego (si llega), Mítico ≈ 100 h+. Verifícalo con una simulación (`tools/sim/loot.mjs`) y publica la tabla de esperanza (muertes/horas por rareza).
- **Ruta determinista y larguísima a Legendario** (además del azar): *Ascender* (`cp/qd`, 19-arsenal) de Épico a Legendario exige 3 **Sigilos de jefe** (uno por cada jefe principal distinto, primera muerte de cada uno) + 1 **Fragmento de Eclipse** (§9) + créditos/núcleos muy altos. Mítico: no se asciende, solo cae.
- **Obtener equipo no es trivial:** precios de la tienda ×2,5; stock 3 módulos + 2 planos por PNJ, rotación 45 min reales; la tienda nunca vende Épico+; los planos de rareza ≥ Raro solo vienen de élites/cofres/jefes/misiones. El desguace devuelve menos. Los módulos T ≥ 3 solo de élite en adelante.
- **Hito (feedback):** todo drop ≥ Épico (`milestone`): destello + ralentización 0,4 s, sonido grave + acorde, banner con el nombre, pilar de luz visible desde lejos, ping en el minimapa, anotación en un **Registro de hitos** (Archivo). Legendario: fanfarria más larga y la pieza lleva un nombre único + frase de ambientación. No debe ser una modal que corte el combate.
- **Curva de XP natural** (rápida al inicio, cada vez más lenta). Nuevo `mt.xpToNext` calibrado para (juego activo, ~15-20 muertes/min más misiones y descubrimientos): L2 ≈ 1 min, L5 ≈ 10 min, L10 ≈ 45 min, L20 ≈ 4 h, L30 ≈ 10 h, L40 ≈ 20 h, L48 ≈ 30 h, L60 ≈ 60 h (±30 %). Fuentes de XP no-muerte (primera visita a un lugar, lore, puzle, primera muerte de jefe, contrato) aportan ≈ 25-35 % del total. Mantén `maxLevel` 60 y la puerta `lvl ≥ lvl[0]-1`. Entrega una tabla muertes/nivel y tiempo acumulado (`tools/sim/xp.mjs`).
- **Dificultad:** el inicio hoy es fácil. Los primeros 10 minutos deben poder matar a quien se descuide (daño enemigo temprano ×1,4 que se diluye hasta ×1,0 hacia el nivel 15); recompensas de curación más escasas (vida 4,5 % → 2,5 %, más botiquines comprables); «Soldado» pasa a ser el reto que hoy es «Veterano» y los demás se reescalan (Recluta sigue siendo el modo cómodo). Élites y emboscadas más frecuentes; sin romper `Di` ni el guardado (`S.diff` son ids).
- **Trofeos (la «basura» característica, D4):** cada enemigo (≈ 60 tipos; agrupa por familia si hace falta) suelta, con 18-30 %, su **trofeo** (`{id, n, v}`: «Mandíbula de rastrero», «Glándula ácida»…). Valor de venta pequeño: calibra para que vender trofeos aporte ≈ 25-35 % de los créditos del jugador (nunca más que los créditos directos). Variante rara «ejemplar perfecto» 1,5 % ×8 de valor. Algunos trofeos son ingredientes de planos/gadgets. Se guardan en `S.junk = {id: n}` y se ven en una pestaña **Botín** del inventario (apilados, «Vender todo»).
- **Arreglar la venta:** vender trofeos y equipo desde cualquier vendedor o desde el mercader del Bastión, sin depender de `Gi`.
- Tienda: añade «Comprador de curiosidades» que paga ×1,5 por colecciones completas de trofeos de una región (recompensa de ser coleccionista).

### 2.3 Ficheros
Posee `31a-economy.js` (todo lo nuevo), y cirugía en: `20-pickups.js` (`Tx`, `Co`, `Ex`, `Sx`: delega en `rollLoot`), `08-stats-items.js` (`mt`, `Ct`, `Di`; el resto no), `18-enemy-defs.js` (campo `trophy`), `29-panels.js` (SOLO tienda, pestaña Botín y venta). Sin tocar talentos ni gadgets.

## 3. Frente TALENTOS (D2)

Sustituye los 41 perks aleatorios (`Al`, `Wa`, `pb`, `S.pendingPerks`) por un **árbol de talentos**.
- **Puntos:** 1 por nivel (desde L2) + 1 por primera muerte de cada jefe principal (9) + 1 por colección de lore completada (≈ 8). Total ≈ 75 de los ≈ 150 nodos: hay que elegir.
- **Seis ramas** (radiales o en columnas, nodos con prerrequisitos y rangos 1-5), ≈ 25 nodos cada una, con 2-3 **nodos clave** que cambian el juego y llevan un coste (se exige haber gastado ≥ 15 puntos en la rama para desbloquearlos):
  1. **Bastión (tanque):** vida, blindaje, escudo, regeneración, reducción de daño, espinas. Claves: *Muro viviente* (+70 % vida, −15 % velocidad), *Represalia* (espinas ×3 y devuelve parte del daño), *Último aliento* (sobrevives al golpe letal 1 vez / 5 min).
  2. **Artillería (daño):** daño, cadencia, crítico, perforación, multidisparo, alcance. Claves: *Cañón de cristal* (+55 % daño, −35 % vida), *Tormenta de plomo* (+2 proyectiles, −25 % daño c/u), *Ejecutor* (ejecuta < 15 %).
  3. **Espectro (velocidad/movilidad):** velocidad, esprint, esquiva, recarga, cargador. Claves: *Fantasma* (el esprint deja un señuelo y da invulnerabilidad extra), *Cinética* (daño crece con la velocidad), *Doble esprint*.
  4. **Ingeniería (utilidad):** gadgets (ranuras, daño, radio, recarga, coste), hackeo (velocidad, trazas, herramientas), torretas, drones. Claves: *Maestro de obras*, *Detonación en cadena*, *Intruso* (hackeo remoto de torretas enemigas).
  5. **Elemental:** probabilidades y daño de fuego/hielo/descarga/veneno, combos. Claves: *Conductor* (descarga encadena entre congelados), *Pirómano*, *Plaga*.
  6. **Cazador (suerte/exploración):** suerte, créditos, XP, radio de recogida, detección de cofres/lore, daño vs tipos y vs élites/jefes, valor de trofeos. Claves: *Cazarrecompensas*, *Instinto* (ves los cofres cercanos), *Carroñero* (+trofeos).
- **Datos:** `x.cfg.talents = { branches:[…], nodes:[{id, br, n, d, st:{stat:valor}, max, req:[ids], at:[x,y], key?, minLvl?, power?, cost:1}] }` usando los mismos `st` que `Sl` (Pl.recalc ya suma `S.perks` con `.st`; reutiliza esa vía: `S.perks[id]` = rango, `S.talentPts` = puntos libres). Nodos que concedan `powers` (hoy 8 perks los dan) los conservan.
- **UI (tecla `T`, botón táctil «TALENTOS»):** lienzo con arrastre/zoom (ratón y táctil), nodos con tres estados (bloqueado/disponible/comprado), tooltip al tocar (no hover), contador de puntos, botón «Reasignar» (gratis hasta el nivel 10; después `150·nivel` créditos, devuelve todo), búsqueda/resaltado por estadística. Subir de nivel NO abre ningún modal: toast «Punto de talento» + el botón existente `#hPerk`.
- **Migración:** `S.talentsV`; los rangos de perks antiguos se reembolsan como puntos y `S.perks = {}`; `S.pendingPerks` → puntos. Mensaje de bienvenida al árbol.
- **Equilibrio:** el poder total del árbol completo ≈ el de los antiguos perks al máximo, pero repartido: un build especializado (30 puntos en una rama) debe ser claramente mejor en su tarea que uno disperso; mide con una simulación de bot (`tools/sim/talents.mjs`: supervivencia/DPS por build).

Ficheros: `31b-talents.js` (todo), cirugía en `29-panels.js` (reemplazar `Wa` y el listado de perks del panel Personaje), `15-map.js` (`Pl.recalc` si hace falta), `27-hud.js`/`html/template.head.html` (botón), `25-save.js` (`kp`).

## 4. Frente GADGETS (D3): trampas, minas y desplegables

- **Hoy:** no hay nada del jugador. Existen minas enemigas (hazard `mine`, 14-combat ~384), torretas aliadas fijas (`allyturret`), pozos persistentes `Oa`, y `x.allies` sin usar. Granada: `throwGrenade` (15-map ~689), botón `#tbGren`.
- **Catálogo (mínimo 12):** Mina de proximidad · Mina de racimo · Mina incendiaria (charco de fuego) · Mina criogénica · Mina EMP (aturde mecánicos, apaga drones) · Trampa de red (ralentiza 70 % 3 s) · Trampa de cuchillas (sangrado) · Trampa de descarga (rayo en cadena) · Campo gravitatorio (atrae y retiene) · Torreta centinela (temporal 25 s) · Baliza señuelo (provoca) · Barrera de energía (bloquea proyectiles 8 s).
- **Mecánica:** se llevan *cargas* por tipo (`S.gadgets = {inv:{tipo:n}, sel:tipo, known:{tipo:1}}`); `X` despliega en el suelo delante del jugador (armado en 0,8 s, luz parpadeante del color del tipo), mantener `X` detona las minas remotas, `Z` cambia de gadget. Máximo desplegados 3 (+1 por cada 2 puntos de Ingeniería, tope 8). Las minas **no dañan al jugador** (equipo `player`); persisten 4 min o hasta salir de la región. Algunos enemigos (mantis, perros de caza, mecánicos) las **detectan y las rodean o desarman**: no es un truco infalible.
- **Obtención:** se desbloquean con **planos de gadget** (cofres, élites, tienda cara, misiones, trofeos/hackeo); se fabrican en el Taller con materiales y trofeos (precio ≈ 1-2 min de farmeo cada uno: son consumibles, no un tesoro). Nunca más de 12 cargas por tipo.
- **Sinergias:** talentos de Ingeniería, elementos, el módulo «Hacker» (más adelante), y el asedio de la base (§9).
- **Táctil:** botón «GADGET» (icono del seleccionado, toque = desplegar, mantener = detonar, deslizar hacia arriba = cambiar) sin quitar espacio a los existentes (reubica con cuidado; prueba en `pixel7`/`iphone14`/`se`).
- **Rendimiento:** malla instanciada o fusionada (un draw call por tipo), sin asignaciones por fotograma, desactiva las luces a calidad `low`.

Ficheros: `31c-gadgets.js` (todo), cirugía en `14-combat.js` (hazards con `team`), `06-input`/`27-hud.js`/`template.head.html` (botón), `29-panels.js` (SOLO la pestaña Gadgets del Taller), `20-pickups.js` (planos de gadget en `rollLoot`: coordina con ECONOMÍA devolviendo `{type:"gadgetPlan"}` desde una función tuya `gadgetPlanDrop(src)` que ECONOMÍA llamará si existe).

### 4.1 Estado (frente GADGETS, entregado)

**Hecho** (todo en `31c-gadgets.js`; cirugía mínima en `21-enemies.js` —una llamada `gadgetEnemyTick(this, dt, dist)` y `slowMul` en la velocidad—, `29-panels.js` —pestaña «Gadgets» del Taller— y `template.head.html` —botón y estilos—; no se tocó `14-combat`, `27-hud` ni `20-pickups`):
- 12 gadgets en `x.cfg.gadgets.types` (daño ×G, radio, armado, duración, usos, coste, trofeos, nivel de plano): proximidad, racimo, incendiaria, criogénica, EMP, red, cuchillas, descarga, campo gravitatorio, torreta centinela, baliza señuelo y barrera de energía. *G* = daño de la granada de fragmentación del jugador (arma activa × 9), así que todo escala solo con el arma y el nivel.
- `S.gadgets = {inv, sel, known}` + `S.gadgetsV = 1` (migración idempotente en `x.migrations`; probada con un guardado de la build anterior: se completa con 2 minas conocidas y 3 cargas de proximidad). Máx. 12 cargas por tipo. Los gadgets desplegados no se guardan.
- Entrada: **X** (tocar = desplegar al soltar, mantener 0,45 s = detonar las minas remotas en cadena; la pulsación necesita ≥ 4 fotogramas para no confundir un toque con «mantener» si el dispositivo se atasca) y **Z** (siguiente). Táctil: botón **GADGET** (icono y carga del seleccionado, anillo de progreso al mantener; deslizar ≥ 26 px hacia arriba = cambiar). Casilla `X` en el HUD de escritorio. Aviso de aprendizaje con la tecla o el gesto que toca (una vez, a los 10 s).
- Desplegados: 3 + `talentFx.gadgetSlots` (tope 8). Minas y trampas persisten 240 s o hasta salir de la región; no dañan al jugador (no son hazards: solo consultan enemigos). Armado 0,8 s con LED parpadeante. **Gráficos:** 7 mallas instanciadas (una por forma), sin luces; el LED y el brillo son orbes del FX compartido (el brillo de suelo se apaga a calidad `low`).
- IA: mantis, corredor, cazador xeno y rabioso **rodean** la mina (desvío de posición, 70 % de acierto por par enemigo-gadget, +20 % élites); los mecánicos terrestres la **desarman** (1,1 s, 25 % de fallo = explota); la mina EMP es invisible para los mecánicos. No se tocó el código de las IAs.
- Obtención: `gadgetPlanDrop(src)` (ECONOMÍA la llamará con `normal|elite|champion|chest1-3|secret|boss|mission|hack`; devuelve `{type:"gadgetPlan", gadget, …}` y el plano se aprende solo al llegar al inventario). Mientras nadie la llame, el frente suelta planos por su cuenta al matar (`kill`) y abrir cofres (`chestOpen`). Taller → **Gadgets**: planos de nivel 1-2 comprables, fabricación ×1 / ×5 con materiales + créditos×`mt.credits(nivel)` + trofeos (`S.junk` si existe; si no, solo materiales).
- Eventos: `gadgetPlaced(g)`, `gadgetTriggered(g, n)`. Pruebas: `window.__gadgets`.

**Números reales** (`tools/sim/gadgets.mjs`, manada mixta de 16 de nivel 4 —seis rastreros, tres infectados, dos escupidores, dos mantis, dos corredores y un coloso mecánico—, 22 s, media de 3 pruebas, daño de referencia G = 50,3):

| gadget | % vida de la manada | bajas | activaciones | coste hoy / con ECONOMÍA §2.2 |
|---|---|---|---|---|
| proximidad | 42 % (29 % detonando a mano con ≥ 3 cerca) | 6,7 | 1 | 1,8 / 3,2 min |
| racimo | 30 % | 3,7 | 1 | 1,8 / 3,2 |
| incendiaria | 37 % | 5 | 1 | 1,6 / 2,1 |
| criogénica | 27 % + congela / ralentiza | 0 | 1 | 2,0 / 3,5 |
| EMP | 13 % (el valor es el aturdimiento de 3,5 s a mecánicos) | 0 | 1 | 2,0 / 3,5 |
| red | 7 % (ralentiza al 30 % durante 3,2 s) | 0 | 1 | 1,2 / 2,1 |
| cuchillas | 40 % (2 usos) | 4 | 1 | 1,8 / 3,2 |
| descarga | 23 % (2 usos, 5 saltos) | 0 | 2 | 2,0 / 3,5 |
| campo gravitatorio | 43 % | 2,7 | 1 | 2,3 / 3,5 |
| torreta centinela (25 s) | 25 % | 0,7 | — | 2,5 / 4,2 |
| baliza señuelo (12 s) | provoca a 16 de 16 | — | — | 2,0 / 3,5 |
| barrera (8 s) | frena 6 proyectiles de escupidores | — | — | 2,0 / 3,5 |

Una mina de 1,8 min de farmeo ahorra ≈ 15 s de combate contra una manada de 16 (la pistola inicial tarda ≈ 34 s en acabar con esa manada): consumible útil, no un tesoro. Detección (20 minas por tipo): rastrero 20/20 estallan; mantis, corredor, cazador y rabioso 18/20 la rodean; coloso escudado 14/20 desarmada, 6/20 estalla; mech 14/20 desarmada. **Rendimiento:** 100 gadgets a la vez cuestan +0,4 ms de simulación por fotograma y +19 llamadas de dibujo (de 161; el caso realista de 3-8 desplegados es ≈ +3), 7 mallas en la escena en ambos casos, y 6 ciclos de 60 desplegar + detonar + limpiar no dejan restos (mallas, geometrías ni texturas del renderer idénticas).

**Pruebas:** `tools/scenarios/gadgets-demo.mjs` (16 comprobaciones funcionales por teclado en escritorio y por toques reales CDP en móvil, más capturas del Taller y de la escena; pasa en escritorio, `pixel7` y `iphone14 --portrait`), `tools/scenarios/gadgets-layout.mjs` (el botón no se solapa con nada en 915×412, 844×390, 667×375, 740×360, 390×844, 375×667 y 360×640), `tools/scenarios/gadgets-migrate.mjs` (guardado antiguo → nuevo), `tools/sim/gadgets.mjs` (arriba). Humo 13/13.

**Pendiente / decisiones para otros frentes**
- ECONOMÍA: llamar a `gadgetPlanDrop(src)` desde `rollLoot` (hoy el frente suelta planos por su cuenta: `normal` 0,06 %, `elite` 6 %, `champion` 22 %, `boss` 40 %, cofres 3/10/25 %; al llamarla, `GD.ext` apaga esa vía) y devolver trofeos en `S.junk`. Los costes están en `x.cfg.gadgets.types[id].cost/trof`; si los materiales bajan a ≈ 15 por 100 muertes (§2.2), los gadgets cuestan ≈ 3-4 min: revisar con la columna «con ECONOMÍA».
- TALENTOS: leer `S.talentFx.{gadgetDmg, gadgetRadius, gadgetSlots, gadgetLife, gadgetCost, gadgetChain, gadgetSave}` (todos opcionales, 0 por defecto; `gadgetCost` con tope 40 %). §4 hablaba de «+1 hueco por 2 puntos de Ingeniería»: el talento solo debe dar `gadgetSlots`.
- No hay «perros de caza» en el juego: se tratan como tales cazador xeno, corredor y rabioso (más la mantis). Cambiar en `cfg.detect.byId`.
- El Taller vende solo planos de nivel 1-2; los de nivel 3-4 solo caen. La tienda de PNJ no los ofrece todavía.
- Sinergias de elementos (fuego + gasolina, etc.), el módulo «Hacker» y el asedio de la base (§9) no se han cableado: los gadgets desplegados son consultables en `window.__gadgets.state.list` y emiten `gadgetPlaced`/`gadgetTriggered`.

## 5. Frentes de la ola siguiente (resumen; se detallan al empezarlos)

- **LORE (D5):** libros, chips y grabaciones (≈ 70 entradas nuevas en español, tono ciencia-ficción militar sobrio) repartidos por estanterías, cadáveres, terminales y guaridas; **chips** cifrados que se descifran con hackeo; **grabaciones** con subtítulos y voz sintetizada (`07-audio.js`); colecciones por región con recompensa (talento, plano, revelar mapa). Archivo (`L`) con pestañas Libros/Chips/Grabaciones/Hitos. *Biblia:* ARGOS sabía lo del **Proyecto ECLIPSE** (el laboratorio del Complejo emitía una señal para despertar a la Mente latente bajo la caldera); los Señores del Enjambre fueron personas con nombre (cada jefe tiene un registro de «quién fue»); «eclipse» es también el alineamiento en el que la señal es más fuerte (§9). Las pistas de lore alimentan códigos de puzles.
- **HACKEO (D6):** nivel de hackeo (`S.hack`), programas/herramientas consumibles, **traza** (alarma + contraataque), objetivos nuevos (cámaras acorazadas multi-capa, torretas y drones enemigos controlables unos segundos, mecánicos desactivables, chips), 4-5 minijuegos nuevos (cortafuegos tipo breakout, cifrado por sustitución con pista del lore, enrutado en grafo, sintonía de frecuencia, fuerza bruta a ritmo) apilables en 2-3 capas; recompensas por riesgo.
- **PUZLES (D7):** además de `switch` y `sequence`: espejos y haz de energía, cajas empujables sobre placas, placas con cronómetro, runas en orden dictado por el lore, enrutado de corriente, pasillo láser, suelo de memoria, válvulas de inundación/ácido. Cada generador con `validate()` que prueba que es resoluble (test determinista) y recompensa por tier.
- **JEFES Y GUARIDAS (D8):** los jefes **no aparecen al entrar en la zona**. Cada región tiene una **guarida** (mazmorra `op` de tipo `lair`, tema del escenario y del monstruo: nido bajo el bosque, metro derrumbado, templo enterrado, cueva ahogada de esporas, caverna de hielo, núcleo del laboratorio, tubo de lava, necrópolis del cráter, cámara de la Mente) con antesala (guardianes + puzle), sala media (minijefe) y arena. Entrada oculta/sellada: se abre juntando **fragmentos de sello** (puzle + hackeo + minijefe) o con un ritual en un altar. Combates de 3 fases con mecánicas propias y temporizador de furia, mucha más dificultad (hoy: una sola transición al 50 %), botín único por jefe (2-3 legendarios con nombre) y un **Sigilo** (§2.2).
- **MUNDO ORGÁNICO (D9):** hoy: 576×576, 3×3 regiones cuadradas (192 casillas) generadas con `vx(7331)`. Objetivo: fronteras irregulares (ruido de dominio) con ecotonos, caminos que serpentean entre puntos de interés, ríos/lagos/barrancos/acantilados, bosques con claros, y **lugares con historia** (gasolinera, motel, escuela, hospital, iglesia, granja con silo, cantera, estación de radar, presa, puerto, patio ferroviario, centro comercial, cementerio, nave estrellada, búnker). Los puertos entre regiones pasan a ser desfiladeros/puentes/barricadas, no rectas. Validar conectividad con flood-fill; subir `mapV`.
- **SORPRESAS (D10):** **Eclipses** periódicos (el nombre del juego): el cielo se apaga, las élites se desatan, caen **Fragmentos de Eclipse** (necesarios para Legendario) y los jefes tienen más botín; **Némesis** (el enemigo que te mata asciende, lleva parte de tu botín y te caza); **Santuarios de pacto** (maldición a cambio de poder); **Asedio del Bastión** (oleadas contra las que se usan trampas y minas) y mejoras de la base financiadas con trofeos; contratos dinámicos en el Tablón.

## 6. Reglas de calidad (todos los frentes)

- Antes de entregar: `node tools/build.mjs`, `tools/scenarios/smoke.mjs` (13/13), tu escenario propio (`tools/scenarios/<frente>-*.mjs`), una simulación de datos (`tools/sim/<frente>.mjs` con números), y la prueba en móvil emulado (`--device pixel7`, vertical y apaisado) si tocas UI.
- Sin `console.error` nuevos, sin asignaciones por fotograma en bucles calientes, sin regresión de `perf()` (llamadas de dibujo) en `tour-lite`.
- Todo texto de cara al jugador en español, claro y sin teclas fijas en táctil (usa `Tt.touchMode`).
- Documenta en este fichero (sección de tu frente, «Estado») lo hecho, los números reales medidos y lo que queda.

# Frente SORPRESAS (D10): Eclipses, Némesis, pactos, asedio del Bastión y contratos dinámicos

Fragmento: `src/game/31i-surprises.js` (todo el frente vive ahí, más tres cambios mínimos en ficheros anteriores, listados al final).
Escenarios: `tools/scenarios/sorpresas-eclipse.mjs` (25), `sorpresas-nemesis.mjs` (16), `sorpresas-pacto.mjs` (16), `sorpresas-asedio.mjs` (26),
`sorpresas-asedio-sim.mjs` (calibración con el motor real), `sorpresas-ui.mjs` (solapes del HUD táctil) y `sorpresas-look.mjs` (capturas limpias).
Ajustes (todo son datos): `x.cfg.eclipse`, `x.cfg.nemesis`, `x.cfg.pact`, `x.cfg.siege`, `x.cfg.baseUp`, `x.cfg.contracts`.

## Estado

**Hecho: las cinco sorpresas.** Ninguna toca la generación del mundo ni consume su RNG (`mapV` no cambia); todas son envoltorios y estado guardado
(`S.sx = { v: 1, ecl, nem, pact, siege, base, con }`, migración idempotente). El tiempo de todas las cuentas atrás es `S.playTime` (segundos de juego
activo: no avanza en pausa) y solo corre en el mundo abierto: bajo tierra se congela.

### A. Eclipses (el nombre del juego)

La primera a los 25 min de juego y luego cada 50-80 min (con nivel ≥ 6 y fuera de refugios, zonas oscuras y combates de jefe; si toca y no se puede, reintenta cada 12 s).

| Fase | Duración | Qué pasa |
|---|---|---|
| **Presagio** | 40 s | El cielo se oscurece (hasta un 40 % de la fuerza final, sin llegar a noche cerrada), banner «EL CIELO SE APAGA» y aviso de ARGOS (la señal bajo la Caldera, ver la biblia de LORE). Etiqueta «◐ Eclipse en m:ss». |
| **Eclipse** | 170 s | Noche cerrada a mediodía (sol bajo el horizonte, niebla y luces violetas, estrellas, velo de pantalla), `x.night = 1`. Cada 4,5-7,5 s aparece una **élite eclipsada** (hasta 6 vivas) a 14-25 m del jugador, en su región, nunca en refugios: vida ×1,25, daño ×1,15, velocidad ×1,08, aura violeta (modificador `eclipsado`, no enumerable en `Bd` para que `aa()` no lo reparta entre las élites normales) y **pulsos de sombra** (círculo de 3,2 m telegrafiado 0,9 s sobre tu posición, esquivable). A los 7 s sale el **Heraldo del Eclipse**: campeón gigante eclipsado (nivel +2, tabla de botín de campeón, pulsos más anchos y frecuentes), marcado en el minimapa. |
| **Fin** | 8 s | Se acaba el tiempo (el Heraldo escapa), mueres (el Eclipse pasa sobre tu cuerpo) o **abates al Heraldo** (el Eclipse se rompe). Las criaturas que quedan se desvanecen sin botín. Siguiente Eclipse en 50-80 min. |

* **Fragmentos de Eclipse** (`ecoGrantFragment`, el material que exige ascender una pieza Épica a Legendaria): 1 seguro al abatir al Heraldo y, como mucho 1 por Eclipse, un 5 % por élite corriente.
  Ya no hace falta la regla provisional de ECONOMÍA (jefes secretos y la Mente dan un Fragmento la primera vez), que se mantiene sin cambios.
* **Botín:** las élites eclipsadas usan una fuente propia `eclipse` en ECONOMÍA (`x.cfg.econ.drop.eclipse`, rarezas 30/40/23/6,7/0,3/0, módulos 0,35, planos 0,05, trofeo seguro): entre la élite y el campeón. El Heraldo usa la de campeón y suelta una tirada extra.
  Mientras dura el Eclipse **los jefes sueltan más**: reliquias de jefe ×1,5 (`sxBossMul()`, lo lee `31g-bosses.js`) y una tirada extra de la tabla de campeón.
* **Interfaz:** etiqueta del HUD bajo el reloj (`#sxBar`, dentro de `#hTC`, así las reglas táctiles de ese contenedor se aplican solas), banner, marca pulsante del Heraldo en el minimapa, velo oscuro de pantalla y, tras el `update` del
  renderer, niebla/fondo/luces/cielo teñidos (un envoltorio de `R.update`, sin tocar `03-renderer.js`).

### B. Némesis

El enemigo **no jefe** que mata al jugador **asciende**: rango 1-5, nombre propio (18 nombres), aura roja (modificador `nemesis`) y los modificadores de élite que ya tuviera más los que pida el rango (1, 1, 2, 2, 3 + el suyo).
Se lleva **los créditos que se pierden en el traslado** (el 10 %, los mismos: no hay castigo nuevo) y, al reaparecer, un 6 % de cada material (tope 30). El panel de muerte lo cuenta («☠ «La Viuda» te ha derrotado… Abátelo para recuperarlo»).

* **La caza:** a los 150-240 s de juego en el mundo abierto aparece a 20-32 m (banner + aviso), con vida ×1,6…×3,3 y daño ×1,15…×1,6 según el rango, y no te suelta hasta 100 m; si lo dejas atrás vuelve a buscarte a los 90 s. No te caza en refugios, zonas oscuras, combates de jefe ni Eclipses.
* **Si te mata otra vez** sube de rango (nivel +1, más modificadores) y suma el nuevo tributo. Hasta tres a la vez (cede el más flojo y viejo).
* **Si lo abates:** recuperas lo robado ×1,25 (4 orbes de créditos y los materiales), XP (5-16 % de la barra según rango) y botín extra (élite en rango 1, `eclipse` en 2-3, campeón en 4-5; dos tiradas desde el rango 3).
* **Sin farmeo:** hay que haber vivido ≥ 90 s desde la última reaparición y no se encadenan ascensos (≥ 240 s entre uno y otro); los jefes, las torretas y los enemigos estáticos no ascienden.
* El asesino se identifica por el golpe mortal (cuerpo a cuerpo `src`, o proyectil: se envuelven `Na` e `iE`) y, si no se sabe, por el enemigo alerta más cercano a ≤ 14 m. Marca roja en el minimapa y etiqueta «☠ Némesis · nombre · rango · distancia».

### C. Santuarios de pacto

De los tres santuarios «xeno» de cada región (los que daban una reliquia con un buff de 45 s), el **tercero** (`shrine_<región>_2`; 9 en el mundo) es de **pacto**: aspecto violeta, aviso «Hacer un pacto» y un panel con **tres tratos** (un poder a cambio de una maldición) que duran **20 min de juego**.
Las ofertas salen de un hash del santuario y del ciclo (cada 30 min de juego, y cada santuario se usa una vez por ciclo), con la garantía de que ninguna maldición anula su poder. Como mucho **dos pactos a la vez** (sellar un tercero rompe el más antiguo); se pueden romper desde el panel. Los pactos sobreviven a la muerte.

| Poder | Efecto | | Maldición | Efecto |
|---|---|---|---|---|
| Furia sombría | +25 % daño | | Fragilidad | −22 % vida máxima |
| Ojo del cazador | +14 % crítico, +35 % daño crítico | | Pies de plomo | −12 % velocidad |
| Pies de viento | +18 % velocidad, +12 % cadencia | | Noche cerrada | −40 % alcance de linterna, −10 % alcance |
| Piel de piedra | +16 % reducción de daño | | Herida que no cierra | −60 % curación recibida |
| Mano de oro | +45 % suerte, +30 % créditos | | Manos torpes | −15 % cadencia, −15 % recarga |
| Sed de saber | +40 % experiencia | | Maldición del avaro | −35 % créditos |
| Sangre ajena | +3,5 % robo de vida | | Rastro de sangre | los enemigos **nuevos** tienen +20 % de vida (no los jefes) |
| Mirada lejana | +25 % alcance, +20 % velocidad de proyectil | | Furia contagiosa | los enemigos nuevos hacen +15 % de daño |
| | | | Marcado | las manadas llevan élites el doble de veces |

Las estadísticas entran por el mismo camino que los talentos (envoltorio de `tlApply`); las maldiciones de sistema, por envoltorios de `In` y `xn.spawnPack`. Minimapa: los santuarios cercanos (violeta si están listos).

### D. Asedio del Bastión y mejoras de la base

Cada 55-85 min de juego (el primero a los 40 min y con nivel ≥ 8; no durante un Eclipse) una horda ataca el Bastión.

1. **Aviso de 75 s** (banner, etiqueta, marca en el minimapa): hay que desplegar trampas y minas (D3) en las **cuatro puertas**. Si el Taller de minas está mejorado, la alarma reparte minas.
2. **Oleadas** (3; +1 desde nivel 20 y otra desde 35) de `10 + 4·oleada + nivel/10` asaltantes, por 1, 2, 3 y (la última, con un **Coloso**) los 4 lados. Nacen a 26-32 m del centro, sobre el eje de una puerta, y apuntan al **núcleo** (la baliza central); al cruzar la puerta atacan lo más cercano: las **cuatro torretas aliadas** o el núcleo, y solo te atacan a ti si estás a < 4,5 m o los hieres (reutiliza el mecanismo `siege` de las operaciones). Enemigos de las regiones ya alcanzadas (+1) y del nivel del jugador; 18 % de los más duros del grupo y 8 % de élites. Si te alejas más de 78 m las oleadas esperan.
3. **Protocolo de defensa:** durante el asedio las torretas alcanzan 17,5 m (cubren todo el recinto: el núcleo está a 17 m de cada esquina, fuera de su alcance normal de 13 m) pero disparan la mitad de rápido.
4. **Fin:** gana quien tenga el núcleo en pie al acabar las oleadas (los rezagados que no llegan, ≤ 3 durante 30 s, se retiran; los atascados se cuelan por la puerta; tope de 8 min). **Victoria:** cofre del Bastión (tier 3 si ninguna torreta cayó y el núcleo conserva > 60 %, si no tier 2), créditos, 3-5 trofeos y XP. **Derrota** (cae el núcleo): −5 % de créditos y todo se repara solo.
5. **Si no estás cerca** (a < 60 m) cuando acaba el aviso tienes 150 s para volver; si no, **el Bastión se defiende solo**: un 35 % de victorias sin mejoras (+15 % por nivel de torretas, +10 % por nivel de muros, tope 90 %), sin botín.

**Mejoras del Bastión** (en el Tablón de contratos, se pagan con **trofeos**: valen ×1,5, los ingredientes reservados no cuentan, los ejemplares perfectos se gastan los últimos y la última pieza devuelve el sobrante en créditos):

| Mejora | Por nivel (máx. 3) | Coste (unidades de crédito del nivel × nivel de la mejora: 1 / 2 / 3) |
|---|---|---|
| Torretas reforzadas | +20 % de daño y +1,5 m de alcance de las torretas aliadas (también fuera de los asedios) | 120 / 360 / 960 |
| Muros y blindaje | +30 % de vida de torretas y núcleo en el asedio | 120 / 360 / 960 |
| Taller de minas | al sonar la alarma: +2 minas de proximidad y +1 de racimo | 150 / 420 / 1100 |
| Enfermería de campaña | +1 botiquín máximo y el refugio cura un 30 % más rápido | 100 / 300 / 800 |

### E. Contratos dinámicos

El Tablón (`ht.board`, estación del Bastión) ya ofrecía 4 contratos aleatorios cada 30 min. Ahora añade, según lo que pasa en el mundo, contratos normales con un objetivo nuevo `{t:"sx", k, n}`:
**«Cazar a «nombre»»** (uno por Némesis vivo; paga ×1,4 +25 % por rango y objeto desde el rango 2), **«Contrato de Eclipse»** (abate 6 criaturas eclipsadas durante el Eclipse; aparece cuando faltan < 30 min o está en curso),
**«Defensa del Bastión»** (resiste un asedio; aparece cuando faltan < 25 min o está en curso) y **«Un trato con la oscuridad»** (sella un pacto; uno por ciclo). Se aceptan, se siguen y se cobran como cualquier contrato; el seguimiento apunta al Némesis o al Bastión.
La pestaña de hitos del Archivo suma una línea de resumen (Eclipses, Heraldos, Némesis, pactos, asedios).

## Números medidos (build 202610090644, GL por software; salvo que se diga, de los escenarios de `tools/scenarios/`)

* **Eclipse (`sorpresas-eclipse`, 25/25):** presagio con `k` 0,21 a los 20 s y noche < 0,5; Eclipse con `k` 1, noche 1, sol −0,2 y velo 0,78; hasta 6 élites vivas, todas eclipsadas, de la región, nunca en refugio; Heraldo campeón gigante con tabla de campeón; pulsos telegrafiados (daño 57 a un jugador quieto, 0 si se aparta);
  Fragmento por élite con tope 1 y Fragmento seguro del Heraldo; fin limpio (cielo y estado vuelven, nada queda vivo); siguiente Eclipse a 3 688 s (50-80 min); jefe en Eclipse: 27 pickups frente a 19.
* **Némesis (`sorpresas-nemesis`, 16/16):** ascenso con el 10 % exacto de créditos; −6 % de materiales; aparición a 27 m con vida ×1,6; rango 2 al volver a morir (lvl +1, tributo acumulado 500 → 950); abatirlo devuelve ×1,25; reglas sin farmeo, jefes y torretas; tope 3; contrato del Tablón.
* **Pactos (`sorpresas-pacto`, 16/16):** 9 santuarios de pacto (uno por región); 900 ofertas revisadas sin ninguna incoherente; deltas de estadísticas exactos; 1 200 s de duración; ciclo de 30 min; tope de 2; caducidad; `Rastro de sangre` ×1,2 de vida (jefes intactos), `Furia contagiosa` ×1,15 de daño,
  `Marcado`: de 44 a 76 manadas con élite de 400.
* **Asedio y mejoras (`sorpresas-asedio`):** ver abajo la calibración. Mejoras: coste del nivel 1 de torretas 480 ¤ a nivel 12; torretas ×1,6 de daño (3 niveles) y +4,5 m de alcance; enfermería +30 % de curación por nivel y +1 botiquín.
* **Calibración del asedio (`sorpresas-asedio-sim`, nivel 12, asedios completos de 3 oleadas con el motor real y 3 semillas por condición):**

  | Condición | Victorias | Duración mediana | Vida mínima del núcleo (media) | Enemigos abatidos |
  |---|---|---|---|---|
  | Jugador sin armas, sin mejoras | 2 de 3 | 153 s | 7 % | 42 |
  | Jugador armado | 3 de 3 | 94 s | 29 % | 53 |
  | Jugador armado con ×5 de daño | 3 de 3 | 82 s | 81 % | 53 |
  | Mejoras de la base (torretas y muros a nivel 3), sin armas | 3 de 3 | 70 s | 74 % | 50 |
  | Mejoras de la base y jugador armado ×5 | 3 de 3 | 85 s | 89 % | 54 |

  Sin ti el Bastión se defiende con muchos apuros (una derrota y dos victorias con el núcleo al 19 % y al 3 %); con la base mejorada o el jugador armado el asedio se gana con margen y las cuatro torretas siguen en pie en todas las partidas.

## Contratos de código

* `window.__sx = { cfg, state, R, N, ecl, nem, pact, siege, base, contracts, srcOf }` (pruebas y escenarios).
* Eventos nuevos: `ee('eclipse', 'omen'|'on'|'end', why)`, `ee('nemesis', 'rise'|'hunt'|'slain', nem)`, `ee('pact', 'sealed'|'ended', pacto)`, `ee('siege', 'warn'|'on'|'end', why)`, `ee('base', id, nivel)`.
* Funciones expuestas a otros frentes (declaraciones del ámbito común): `sxEclActive()`, `sxBossMul()`, `sxS()` (estado guardado), `sxPactSys(clave)`.
* `S.sx = { v: 1, ecl: {n, heralds, next, st, t, dur, kills, frag, hera}, nem: {list: [{uid, id, name, lvl, rank, mods, loot: {cr, mats}, due, state, reg, born, deaths}], seq, slain, deaths}, pact: {act: [{b, c, until, from}], used: {santuario: ciclo}, n}, siege: {n, won, lost, next, st, t, wave}, base: {lv: {mejora: nivel}, spent}, con: {seq, done, seen} }`.

## Cirugía en ficheros antiguos

* `31g-bosses.js` (`blRoll`): la probabilidad de reliquia se multiplica por `sxBossMul()` (×1,5 en Eclipse).
* `31f-puzzles.js` (`pzBotLive`): el bot de pruebas se desarma mientras actúa (un enemigo cercano le giraba la mirada con la puntería automática y hacía fallar `puzles-core` de forma intermitente).
* El resto son envoltorios: `Pl.prototype.hurt`, `iE` y `Na` (asesino), `$p` (panel de muerte), `tlApply` (pactos y enfermería), `In` y `xn.spawnPack` (maldiciones de sistema), `ecoSrcOf`, `ecoMinimapPings`, `ecoHitosHtml`, `ih.prototype.createMesh/promptFor/shrineReady/useShrine/turretUpdate`,
  `Vl` (Tablón), `ht.board/accept/objText/target` y `R.update` del renderer.

## Pendiente

* **Equilibrio con jugadores reales:** todos los números (frecuencias, vida y daño de las élites, probabilidad de Fragmento, tributo del Némesis, fuerza de pactos, tamaño de oleadas) son una propuesta mía comprobada con bots y simulaciones; se ajustan en `x.cfg.*` sin tocar lógica.
* **Sonido y arte propios:** el Eclipse reutiliza sonidos existentes (`alarm`, `roar`, `legend`) y el Némesis y el Heraldo son los modelos normales con aura; no hay un modelo ni una música propios.
* **El asedio no es sensible al terreno exterior:** los asaltantes nacen sobre el eje de las puertas (el Bastión es un recinto cuadrado con cuatro puertas) y los atascados se cuelan por ellas; si D9 cambia el entorno del Bastión hay que revisar `sxSiegeSpot`.
* Los jefes secretos no tienen contratos propios y las mejoras de la base no tienen modelos (solo efectos y avisos).

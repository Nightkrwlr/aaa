# SUNDERCHOIR — Game Design Document (preproducción + vertical slice)

> Nombre provisional: **SUNDERCHOIR — El Coro Quebrado**. Mundo: **Oravel**.
> Género: ARPG 3D, cámara isométrica (tres cuartos, 42–50°). Plataforma objetivo: navegador (WebGL2) → empaquetable (Electron/Tauri/PWA).
> Estado de sistemas: ver [STATUS.md](STATUS.md).

## 1. Visión creativa en una frase
Un mundo que fue afinado como un instrumento y se quedó en silencio: tú eres el **Reposo** (*el Mudo*), la única nota que el Coro nunca incluyó, y por eso puedes **escuchar** lo que los demás ya no oyen.

## 2. Pilares (orden de prioridad)
1. **Combate legible y táctil** — cada golpe tiene feedback proporcionado; todo ataque peligroso se lee antes de impactar.
2. **Exploración que escucha** — el descubrimiento es una mecánica (Escucha), no un marcador.
3. **Builds con decisiones reales** — nodos transformadores, acordes, objetos únicos que cambian cómo funciona una habilidad.
4. **Mundo denso, no grande** — cada minuto de desplazamiento contiene algo (combate, recurso, evento, secreto, historia).
5. **Misterio con foreshadowing** — la verdad se reconstruye desde el entorno.

Regla: FUN > cantidad · LEGIBILIDAD > espectáculo · DISEÑO > grind · MODULARIDAD > rapidez.

## 3. Las tres mecánicas diferenciadoras (afectan al gameplay real)
### 3.1 Cadencia — *Acordes de habilidad*
Cada habilidad activa tiene un **Tono**: `grave` (low), `medio` (mid), `agudo` (high). El jugador mantiene una **Frase** de los últimos 3 lanzamientos (ventana de 4,0 s entre casts).
| Acorde | Condición | Efecto base (afinable por talentos) |
|---|---|---|
| **Tríada** | 3 tonos distintos | *Acorde Pleno*: +25 % de daño «cadencia» durante 4 s, devuelve 12 % del recurso y 1 carga de Voz |
| **Unísono** | 3 tonos iguales | El 3.º lanzamiento es *Resonante*: +40 % de área y +30 % de daño, pero el tono queda en enfriamiento de acorde 5 s |
| **Reprise** | A‑B‑A | Reduce 1,5 s los enfriamientos del tono A |
Rompe jefes concretos (Ildra: su escudo solo cae con una Tríada). El orden de las habilidades importa y las builds se diferencian por qué acordes persiguen. Cap anti‑abuso: la categoría `cadence` es un único grupo *more* con tope y un enfriamiento interno por acorde.

### 3.2 Escucha — *Resonant Sense*
Mantén **F**: gastas **Aliento** (6 s, regenera en 5 s); te mueves al 60 %. El mundo se atenúa y aparecen **ecos**: puertas secretas, botín oculto, vetas, pistas de puzles, emboscadores enterrados, y los **telégrafos** enemigos se amplían. Cada región tiene su «frecuencia» de secretos: algunos solo se oyen en tormenta, otros al mediodía de marea. El alcance es un stat (`listenRange`). Es *la* herramienta de exploración y de puzles, y se enseña en los primeros 10 minutos.

### 3.3 Voces Prestadas — *Ecos capturados*
Élites, minijefes y jefes sueltan un **Eco**. Si lo *escuchas* (Escucha dentro de 8 s, radio 4 m) lo capturas: ganas una **Voz** (una habilidad del enemigo) en tu **Biblioteca de Voces**. Equipas 1 Voz (2 con talento) en la ranura `R`. Las Voces tienen cargas limitadas que se recargan con Tríadas y kills de élite. Es la vía de *fantasía de build inesperada* (usar el salto del Acechador, el terremoto de Brannoch…).

## 4. Loop principal
**Explorar → Encontrar (enemigo/evento/secreto/mazmorra) → Combatir con cadencia → Botín + Eco → Decidir (equipo/talento/crafteo/Voz) → Escuchar de nuevo (más secretos) → …**
Loop corto (min): combate, loot, Escucha. Medio (30–60 min): quest, mazmorra, jefe. Largo (horas): gate regional, cadenas de secretos.

## 5. Estructura del mundo (3 regiones, hechas para ampliar)
| Región | Identidad | Mecánica ambiental | Familias | Estado |
|---|---|---|---|---|
| **I — Terrazas de Calvarre** | Vertical: mesetas de caliza, arpas de viento serranas, acueductos, niebla | *Vendavales*: el viento empuja proyectiles, dispara materiales y revela secretos con la Escucha | Discordantes (fauna), Huecos (coristas vaciados) | **Slice jugable (Terraza Baja)** |
| **II — Mecanismo de Vesper** | Cañones de engranajes colosales, vapor, relojería serrana aún en marcha | *Compases*: plataformas, cuchillas y compuertas con ritmo; la Cadencia las sincroniza | Constructos serranos, Huecos mecánicos | Diseñada + datos de gate |
| **III — Las Mareas Mudas** | Costa de fenómenos extraños: gravedad de marea, bosque bioluminiscente, campos de Silencio | *Marea*: ciclo que inunda/levanta zonas; *Campos de Silencio* anulan habilidades | Hijos del Subcanto, Taciturnos | Diseñada + datos de gate |
Cada región: 1 asentamiento mayor, 3–4 refugios, 4–7 subregiones, cuevas, mazmorras (procedurales + artesanales), eventos, minijefes, jefe, secretos.

### Gates (sin «nivel 20»)
- **I → II (Pasaje del Eco Perdido)**: (1) descubrir la ruta oculta (cadena de secretos), (2) reunir 3 *Piezas de Llave Armónica* (jefe + mazmorra + secreto), (3) derrotar al **Guardián del Puente**, (4) reparar el Puente de Resonancia (crafteo). Implementado en `data/world/gates.json` + `src/sim/world/gates.js`.
- **II → III (Costa Muda)**: misterio regional resuelto (3 testimonios contradictorios → verdad), fabricar el **Diapasón de Marea**, completar el Laboratorio de Vesper (misión crítica), derrotar al **Segador del Compás**.
Imposible entrar antes: el gate verifica flags; el pathfinding bloquea el paso físicamente.

## 6. Clases (3 en slice + 2 diseñadas)
| Clase | Fantasía | Recurso (modifica el juego) | Estado |
|---|---|---|---|
| **Campanario** | Portador de campana: aguanta, golpea en área, devuelve el castigo | **Tañido** 0–100: sube al golpear/recibir; gasta en *Repiques*; ≥80 = Resonando (velocidad); decae fuera de combate | Slice |
| **Prismante** | Prismas y haces: control de área y daño sostenido | **Fulgor** 0–100: lanzar sube; ≥60 Incandescente (+daño); 100 = Deslumbre (aturdimiento propio + explosión) | Slice |
| **Rondador** | Movilidad, burst y hemorragia | **Ritmo** 0–10 cargas: moverse/esquivar/golpear; cada carga +4 % velocidad; se pierde al ser golpeado/parado | Slice |
| **Corista** | Invocaciones de ecos | **Voces** (cupos de invocación) | Diseñada |
| **Ensalmador** | Alquimista de estados | **Humores** (mezcla de 3 reservas) | Diseñada |
Cada árbol: nodos menores, notables, **transformadores**, keystones, y ramas de especialización (ver [BALANCE.md](BALANCE.md)).

## 7. Progresión
Nivel máx 60 (I: 1–18 · II: 18–38 · III: 38–58 · epílogo 60). 1 punto de talento por nivel + puntos de secretos/quests. Redistribución con **Sil la Taciturna** (coste progresivo con tope y descuento primeras 3 veces: nunca hay que rehacer personaje).
Objetos: ilvl = nivel de zona; rarezas **Común / Fino / Afinado / Reliquia** (+ *Forjado*). Artículos únicos (Reliquias) transforman habilidades.

## 8. Vertical slice (lo que existe hoy)
Terraza Baja (exterior 3D) · Escalón de Orrel (asentamiento con NPC) · 3 subregiones · minijefe Brannoch · generador de mazmorras con 3 familias + validación · puzles (lógica tonal y haces de luz) · cadena de secretos · botín/afijos/únicos · crafteo (desmontar, reforjar con *Estabilidad*, inserción, consumibles) · talentos de 3 clases · jefe **Ildra, la Chantre Vaciada** · guardado versionado con respaldo · UI/HUD/mapa/códice/opciones/accesibilidad · audio procedural adaptativo · herramientas de desarrollo.

## 9. Control (esquemas)
- **Ratón + teclado (por defecto)**: clic izq mover/atacar (mantener); clic der habilidad secundaria; `1–4`, `Q`, `E` habilidades; `Espacio` esquiva; `F` Escucha; `R` Voz; `Shift` fijar posición; `I` inventario; `T` talentos; `M` mapa; `J` misiones; `C` códice; `G` crafteo; `Esc` pausa.
- **WASD**: movimiento directo, apuntado con el ratón (alternable).
- **Mando**: stick izq mover, stick der apuntar, A esquiva, X/Y/B/RB habilidades, LT Escucha.
- **Táctil**: joystick virtual + botones (activación automática en dispositivos táctiles).
Todos remapeables.

## 10. Alcance honesto del slice
Este repositorio implementa el *núcleo completo y probado* (arquitectura, combate, habilidades, estados, IA, loot, talentos, crafteo, mazmorras, puzles, guardado, UI, audio) y contenido representativo. Las regiones II y III existen como datos de diseño, gates y definición de contenido; su producción masiva sigue la guía en [CONTENT_GUIDE.md](CONTENT_GUIDE.md). Los modelos son *procedurales de alta calidad* con especificación de sustitución (sockets/pivotes) en el [ART_BIBLE.md](ART_BIBLE.md).

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


## Clima, luz y ciclo día/noche (frente «clima»)
Ficheros: `src/engine/atmosphere.js` (mirada, ciclo, fondo), `src/engine/weather.js` (clima por GPU, niebla de suelo, cono de linterna, suelo mojado), `src/game/_prelude.clima.js` (imports, alias `Cl*`), `src/game/03-renderer.js` (todo se orquesta en `vd.update`). La API `x.R.*` no cambia; se **añaden** campos: `x.R.env.{twi,sunEl,wet,rain}`, `x.R.wx` (WeatherFx), `x.R.sky`, `x.R.mist`, `x.R.cone`, `x.R.regionKey`.

### Ciclo día/noche
- `x.night` sigue siendo el interruptor de jugabilidad (misma fórmula, rampas 0,60‥0,66 y 0,92‥0,97 del reloj `S.time`). Además `World.update` publica, solo para el render: `x.sunEl` (seno de la elevación del sol: 1 mediodía, 0 horizonte, −1 medianoche), `x.twi` (luz rasante/arrebol 0‥1, ≈30 s de juego a cada lado del horizonte), `x.sunU` (recorrido del sol 0‥1) y `x.moonQ`. Salen de `dayState(t)` (atmosphere.js). El horizonte cae a mitad de cada rampa, así que **las farolas y ventanas (`propFx.uGlow`, que lee `R.env.night`) se encienden con el atardecer**.
- Una sola luz direccional con sombras hace de sol y de luna. De día baja a 20° con el reloj (sombras ≈2,7× más largas al amanecer/atardecer), vira a naranja (`warm`) y barre ±31° de azimut; de noche pasa a luna azulada desde el otro lado (el salto de dirección ocurre con intensidad ≈0 y se suaviza). Hemisferio: cielo melocotón y suelo malva en el arrebol, azul de noche.
- Niebla y fondo: naranja con el sol rasante, azul de noche, teñida por el clima. Grade: sombras malva/luces ámbar en el arrebol, sombras azules de noche; bloom y exposición se compensan para que la noche siga siendo legible.
- `SkyBackdrop` (una malla a pantalla completa, sin textura): horizonte = niebla, cielo arriba, resplandor del sol bajo, estrellas con parpadeo y luna. Solo asoma donde no hay terreno (bordes del mapa, vacío de las operaciones). `scene.background` sigue siendo un `Color` (lo usa el resto).

### Clima por región (`De[i].weather`) y por tema de operación (`THEME_WEATHER`)
| clima | visual | efecto en la escena |
|---|---|---|
| rain | rayas inclinadas por el viento + salpicaduras (anillos y gota) en el suelo | niebla más densa y gris, sol atenuado, **suelo mojado** (oscurece y pierde rugosidad en superficies horizontales, con charcos por ruido), relámpagos raros (no en `low`) |
| dust | motas finas y bloques difusos que viajan con el viento; **rachas** (la velocidad integra la ráfaga) | niebla ocre que sube con la ráfaga |
| snow | copos con vaivén y destellos HDR que el bloom recoge | velo blanco-azulado |
| embers | brasas ascendentes que pasan de amarillo (HDR) a rojo y se apagan | luz de suelo anaranjada que parpadea, bloom extra |
| ash | copos que caen y vuelcan (alfa oscilante) | velo grisáceo |
| spores | esporas que laten; casi invisibles de día, luminosas de noche (verde-turquesa; violeta en colmena/gruta) | bloom extra de noche |
- Qué clima lleva cada región: el dato `De[i].weather` manda (ciudad lluvia, desierto polvo, marisma y colmena esporas, tundra nieve), salvo donde `REGION_WEATHER` (atmosphere.js) lo amplía para la dirección de arte: **caldera = brasas + ceniza**, **yermo = ceniza + polvo fino**, **complejo = chispas + polvo**. `WeatherFx.setTarget` acepta un nombre o un mapa `{tipo: intensidad}`; el tinte de niebla lo pone el clima más intenso.
- Todo es GPU: cada tipo es **un** `Points`/`LineSegments` (la lluvia suma un quad instanciado para las salpicaduras) cuya posición sale del tiempo en el vertex shader. La caja de partículas está alineada con la cámara (ancho × fondo × alto de la vista) y envuelve en torno al objetivo, así que casi todo cae dentro de pantalla y queda anclado al mundo. El tamaño de punto se calcula en px de dispositivo a partir de `pxPerUnit` (cámara ortográfica).
- Cada tipo mezcla su intensidad a ~0,55/s (cruzar de región no da saltos); los teletransportes la fijan al instante. Densidad por calidad: `high` 100 %, `medium` 62 %, `low` 34 % (las partículas se recortan por rango, sin huecos). Las mallas se crean al primer uso.
- Las partículas por CPU de `World.update` (polen, luciérnagas) solo quedan en regiones sin clima (valle, complejo).

### Suelo mojado
`installWetness()` añade al final de `lights_physical_fragment` y `lights_lambert_fragment` un bloque que, con `uDarkInfo.w > 0`, oscurece el albedo y baja la rugosidad de las superficies cuya normal mira hacia arriba (con ruido de charcos en espacio mundo). Reutiliza el uniforme global de la máscara de oscuridad (`02-darkmask.js`): su cuarto componente estaba libre, así que **no hace falta tocar ningún material ni añadir uniformes**; si el parche de la máscara no está, no se instala.

### Niebla de suelo y linterna
- `GroundMist` (solo `high`): un plano a 0,55 m con ruido de valor en el shader; cantidad por región (`REGION_LOOK.mist`), sube con el arrebol y la lluvia.
- `FlashCone`: cono aditivo (borde difuso por Fresnel, polvo en suspensión) de la lente al punto de mira, tomado de `R.flash`; se nota más de noche o en zonas oscuras. No añade luces.

### Zonas oscuras y operaciones
`setRegionEnv` identifica el tema de la operación por identidad en `Zi` y aplica `THEME_LOOK` (grade, niebla, bloom por tema) y `THEME_WEATHER` (polvo en búnker/fábrica/ruinas, esporas en gruta/colmena/alcantarilla, brasas en magma, cristales en caverna). La luz ambiente sigue siendo el hemisferio (enmascarado por `uDarkMap`), no una `AmbientLight`, para no romper las zonas oscuras.

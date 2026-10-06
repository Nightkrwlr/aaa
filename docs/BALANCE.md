# BALANCE

> Principio: **un solo modelo numérico central** (`data/balance/balance.json` + `src/sim/balance.js`). Ningún sistema inventa números propios: le pregunta al modelo. Cambiar el equilibrio nunca exige tocar lógica.

## 1. Curva de poder
`P(L) = 1 + 0,16·(L−1) + 0,0028·(L−1)²`   (L = 1…60)

| Nivel | 1 | 5 | 10 | 20 | 30 | 45 | 60 |
|---|---|---|---|---|---|---|---|
| P(L) | 1,00 | 1,68 | 2,67 | 5,05 | 7,99 | 13,46 | 20,19 *(L60 = 1 + 9,44 + 9,75)* |
| Vida esperada | 250 | 421 | 667 | 1.263 | 1.999 | 3.365 | 5.047 |
| DPS esperado | 45 | 75,8 | 120 | 227 | 360 | 606 | 908 |

Derivados (todos escalan con `P`):
- **Vida esperada** del jugador = 250 · P(L)
- **DPS esperado** del jugador = 45 · P(L)
- **Armadura**: reducción = `a / (a + 120·P(L))`, tope 85 %
- **Golpe de arma** (`weaponHit`) = DPS esperado × 0,34 (el daño base de una habilidad con coef 1,0)
- **XP por estándar** = `8 · L^1,15`; kills por nivel = `14 + 1,6·L`; penalización por diferencia de nivel desde ±4 (−12 %/nivel, mín. 10 %)

## 2. Los enemigos NO son esponjas: la vida sigue al «tiempo de muerte»
`HP enemigo = DPS_esperado(L) × TTK(tier) × hpMult × dificultadHp`

| Tier | TTK objetivo | XP | Fichas (chimes) | Prob. de botín |
|---|---|---|---|---|
| minion | 0,9 s | 0,35 | 0,4 | 2,5 % |
| standard | 1,9 s | 1,0 | 1,0 | 7 % |
| tough | 3,6 s | 1,8 | 1,8 | 12 % |
| elite | 12 s | 5,5 | 5 | 100 % (1–2) |
| miniboss | 48 s | 18 | 16 | 100 % (2–3) |
| boss | 130 s | 55 | 45 | 100 % (3–5) |

El **daño enemigo** también es relativo: `golpe = vida_esperada(L) × %vida × difficultyDamage` (`pctLifePerHitBase` 7,5 %). Así subir de nivel o equipo no rompe el reto: el modelo lo reescala todo.

Dificultades (`difficulty`): *Errante* (daño ×0,8, vida ×0,85, IA ×0,8) · *Buscador* (1/1/1) · *Corista* (×1,25 / ×1,1 / ×1,15, +10 % botín) · *Maestro* (×1,55 / ×1,2 / ×1,3, +25 % botín).

## 3. Cómo se calcula el daño (un único pipeline)
Implementado en `src/sim/damage.js` (el cálculo lo usan jugador, enemigos, DoT y reacciones):

```
base      = golpeDeArma(L) × coef (+ daño plano × min(1,coef) × P/4)
saliente  = base × daño(tags)          daño = (1 + Σ inc) × Π_grupo(1 + more_grupo)
crítico   = × critMult                 P(crit) = crit(tags) + bono + critTomado(objetivo)   [tope 75 %]
mitigado  = saliente × (1 − armadura)  físico  |  × (1 − clamp(res − pen, −1, 75 %))  elemental
          × dañoRecibido(objetivo)     (vulnerable/ward, suelo 0,2)
final     = max(1, round(·)) → escudo primero, luego vida
```

### Anti-ruptura (topes en `balance.json › caps`)
| Cap | Valor | Razón |
|---|---|---|
| `increasedDamage` (Σ inc) | **+400 %** | el aditivo no puede dominar |
| `moreGroupCap` (cada grupo *more*) | +150 % | cada grupo es un multiplicador independiente con tope |
| `actionSpeed`, `cooldownRate` | **×1,75** | sin «ráfagas infinitas» |
| `moveSpeed` | ×1,6 | legibilidad de telégrafos |
| `critChance` / `critMult` | 75 % / ×4,0 | |
| `resist` / `armorReduction` | 75 % / 85 % | siempre hay riesgo |
| `lifeRegenPctPerSec`, `leechPct` | 4 % / 5 % | sin inmortalidad |
| `damageTakenMin` | 0,2 | nunca invulnerable por stats |
| `penetration` | 50 % | |

Los grupos *more* son nombrados (`class`, `cadence`, `gear`, `talent`, `unique`, `voice`…) y cada uno tiene su tope; los únicos pueden romper reglas, pero **solo** de la forma que declaran (parches de habilidad, `flags`) — nunca multiplicando a mano.

## 4. Factor de poder por clase
Las clases tienen recursos y mecánicas distintas; el simulador (`tools/balance-sim.mjs`) mide el kit **sin equipo ni talentos** para que el diseño no dependa de que el jugador acierte con el equipo:

| Clase | `profile.dmg` | Por qué |
|---|---|---|
| Campanario | 1,20 | su fuerza es aguantar y devolver; necesita multiplicador para igualar DPS |
| Prismante | 0,55 | haces/áreas con alcance y control; el DPS sostenido lo da la propia habilidad |
| Rondador | 0,58 | movilidad + sangrado (DoT) aportan mucho DPS efectivo; se compensa aquí |

Medición (kit inicial, sin gear): relación DPS/DPS esperado

| | L1 | L5 | L10 |
|---|---|---|---|
| Campanario | 1,00× | 2,08× | 1,32× |
| Prismante | 1,33× | 1,29× | 1,47× |
| Rondador | 1,36× | 1,52× | 1,41× |

Banda objetivo del kit puro: **0,6–1,8× del DPS esperado**. El único valor fuera de banda es Campanario L5 (2,08×), que coincide con el primer pico de desbloqueos (Carga de hierro + Cadena). Está marcado en el simulador y es una advertencia conocida (§7).

## 5. Resultados del simulador de equilibrio (`npm run balance`)
Salida completa en cada ejecución. Equipo curado «razonable» por nivel (sin BiS) y los talentos del árbol:

| clase | nivel | DPS | esperado | ratio | TTK std | TTK grp×4 | TTK tough | TTK élite |
|---|---|---|---|---|---|---|---|---|
| Campanario | 1 | 63,4 | 45 | 1,41 | 1,4 s | 3,4 s | 5,2 s | 28,2 s |
| Campanario | 10 | 201,9 | 120 | 1,68 | 1,4 | 3,4 | 8,0 | 10,6 |
| Campanario | 30 | 976 | 360 | 2,71 | 1,2 | 2,7 | 3,8 | 11,1 |
| Campanario | 60 | 5.493 | 908 | 6,05 | 1,1 | 2,5 | 3,0 | 6,3 |
| Prismante | 1 | 34,2 | 45 | 0,76 | 2,8 | 9,5 | 45 | 15,5 |
| Prismante | 10 | 116 | 120 | 0,97 | 2,2 | 4,8 | 28 | ∞ (*) |
| Prismante | 30 | 677,5 | 360 | 1,88 | 1,8 | 3,7 | 14,1 | 10,3 |
| Prismante | 60 | 1.870,8 | 908 | 2,06 | 1,8 | 4,1 | 16,1 | ∞ (*) |
| Rondador | 1 | 84,1 | 45 | 1,87 | 2,2 | 5,2 | 22 | 7,2 |
| Rondador | 10 | 342 | 120 | 2,85 | 0,8 | 4,5 | 12,9 | 1,9 |
| Rondador | 30 | 1.181 | 360 | 3,28 | 0,7 | 2,7 | 17,2 | 3,4 |
| Rondador | 60 | 8.998 | 908 | 9,91 | 0,4 | 2,3 | 3,3 | 2,1 |

(*) El simulador solo usa una rotación genérica automática, sin esquivar, sin posicionarse y sin Cadencia consciente. «∞» = no mató al élite en 90 s con esa rotación; en el juego real el Prismante dispone de haces canalizados, Voces y la Tríada.

Otras salidas:
- **Muertes** del bot en todos los escenarios estándar: **0** (el simulador ni siquiera se acerca a morir con el daño enemigo escalado por vida).
- **Botín**: 63–79 objetos por 1.000 muertes; 4–72 «chimes» por muerte según nivel; ≈ 6–11 % de los drops son *Afinados* y ≈ 25–31 % *Finos* con la configuración actual.
- **Coste de redistribución** (respec): primera vez 0 (3 gratis); a partir de la 6.ª: L1 88 · L10 218 · L30 598 · L60 1.403 fichas — con tope (`cap 14`) para que nunca haya que rehacer el personaje.

## 6. Economía y sumideros
- Unidad de ficha: `5,2 · L^0,92`. Venta a mercader = 18 % del valor.
- **Sumideros**: reforja (`6 · (1 + 0,6·n_afijos)`), mejora (`8 + 1·n`), redistribución, descanso/pociones, inserción de gemas, muerte (**−8 % de fichas**, nunca objetos), compras de mercaderes (3 tiendas con inventario sembrado por «semilla de descanso»).
- Valor por rareza: Común 1 · Fino 3 · Afinado 9 · Reliquia 24 · Forjado 6.
- **Estabilidad (crafteo)**: Común 4 · Fino 5 · Afinado 6 · Reliquia 3. Cada reforja consume 1; en 0 el objeto se **fractura**: el riesgo es explícito en el tooltip.
- La **rareza no es poder**: Afinado = más afijos pero con tiradas más bajas (`rollFloor` 0,25) y peor estabilidad; Fino tiene suelo de tirada alto (0,55). Un Fino bien rodado puede superar a un Afinado mediocre; el comparador del tooltip lo muestra con el impacto real en *tu* build.

## 7. Qué dice el simulador y cómo se lee
`node tools/balance-sim.mjs` termina con código ≠ 0 si hay avisos («BALANCE GUARD»). Estado actual: **7 avisos conocidos**:

| Aviso | Causa | Plan |
|---|---|---|
| Campanario L5 kit ×2,08 | pico de desbloqueos | bajar `profile.dmg` en L≤5 con una rampa (pendiente) |
| Campanario L45/L60, Rondador L45/L60 ratio > 3,5 | el equipo curado del simulador usa *todas* las ranuras con afijos de daño alto; en juego real las tiradas son aleatorias y escasas | tope duro de afijos de daño por pieza y *soft cap* de inc (decidido: `increasedDamage` 4,0) — vigilar tras ampliar uniques |
| Prismante L10/L60: élite no muerto en 90 s | rotación genérica del simulador | añadir rotación consciente de la Tríada al bot |

Estos avisos no son bugs ocultos: son **deuda de equilibrio documentada** con número, causa y plan.

## 8. Reglas para tocar el equilibrio
1. Edita **solo** `data/balance/balance.json`, `data/classes/*.json` (`profile.dmg`) o los coeficientes de `data/abilities/*.json`.
2. Ejecuta `npm run balance` (completo ≈ 4–5 min; `--quick` para humo) y `npm test`.
3. Nunca subas un tope sin anotar aquí por qué. Los topes existen para que **ninguna combinación de afijos/únicos/talentos rompa el juego**.
4. Los jefes artesanales se ajustan con `hpMult`/`damage` de su definición, **no** con tiers: el tier `boss` ya fija 130 s de TTK.

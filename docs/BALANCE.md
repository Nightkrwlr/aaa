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
Las clases tienen recursos y mecánicas distintas; el simulador (`tools/balance-sim.mjs`) mide el kit **sin equipo ni talentos** para que el diseño no dependa de que el jugador acierte con el equipo. `profile.dmg` (en `data/classes/*.json`) es un multiplicador *more* de grupo `class` que calibra la escala de cada kit:

| Clase | `profile.dmg` | Por qué |
|---|---|---|
| Campanario | 1,00 | golpes lentos y pesados; su fuerza es aguantar y devolver |
| Prismante | 0,65 | haces/áreas con alcance y control; buena parte del daño llega por estados |
| Rondador | 0,42 | ataque rápido (2 arcos por lanzamiento) + sangrado + cargas de Ritmo: mucho DPS efectivo que se compensa aquí |

Kit inicial (sin gear ni talentos), DPS / DPS esperado — **banda objetivo 0,6–1,8×**:

| | L1 | L5 | L10 |
|---|---|---|---|
| Campanario | 0,82× | 1,74× | 1,10× |
| Prismante | 1,58× | 1,52× | 1,73× |
| Rondador | 0,92× | 1,04× | 0,97× |

## 5. Resultados del simulador de equilibrio (`npm run balance`)
Equipo «curado» (la mejor de 10 tiradas por ranura), **todos** los puntos de talento gastados, rotación perfecta contra un muñeco inmóvil, **mediana de 5 equipos distintos** por celda (una tirada de arma afortunada no mueve el veredicto). Es una build fuerte: se espera 2–4× el modelo medio; 5× sería una rotura.

| clase | nivel | DPS | esperado | ratio | TTK std | grp×4 | tough | élite |
|---|---|---|---|---|---|---|---|---|
| Campanario | 1 | 82,9 | 45 | 1,84 | 1,4 s | 3,4 | 6,2 | 33,2 |
| Campanario | 10 | 162 | 120 | 1,35 | 1,7 | 4,3 | 8,4 | 39,8 |
| Campanario | 30 | 708 | 360 | 1,97 | 1,2 | 2,8 | 4,6 | 22,5 |
| Campanario | 60 | 3.296 | 908 | 3,63 | 1,1 | 2,8 | 3,1 | 7,1 |
| Prismante | 1 | 42,4 | 45 | 0,94 | 2,7 | 8,6 | 41,5 | 12,2 |
| Prismante | 10 | 137 | 120 | 1,14 | 2,1 | 5,3 | 19,1 | 10,1 |
| Prismante | 30 | 957 | 360 | 2,66 | 1,8 | 3,7 | 12,1 | 29,3 |
| Prismante | 60 | 3.383 | 908 | 3,72 | 1,3 | 2,7 | 9,1 | 9,0 |
| Rondador | 1 | 74,1 | 45 | 1,65 | 2,4 | 7,0 | 23,6 | 10,1 |
| Rondador | 10 | 324 | 120 | 2,70 | 0,8 | 4,6 | 18,0 | 4,9 |
| Rondador | 30 | 1.111 | 360 | 3,09 | 0,8 | 3,3 | 21,9 | 3,8 |
| Rondador | 60 | 2.788 | 908 | 3,07 | 0,4 | 3,3 | 11,8 | 2,8 |

Lectura:
- **A nivel 60 las tres clases quedan en 3,1–3,7×** (dispersión 1,2×). Entre L1 y L30 la dispersión máxima es **2,4×** (L10: Rondador 2,70× vs Prismante 1,14×) y es el límite del guardia.
- **«tough»** (escudero con escudo frontal) tarda 9–40 s para Prismante/Rondador porque el bot **no flanquea ni rodea**; no es un déficit de la clase. Un jugador humano rompe el escudo con área, Voces o flanqueo. Se mantiene como deuda de **bot**, no de datos.
- **Muertes** del bot en escenarios estándar: **0** en todas las celdas.
- **Botín**: 63–79 objetos por 1.000 muertes; 4–72 fichas por muerte según nivel; ≈ 5–11 % *Afinados* y ≈ 21–31 % *Finos*.
- **Coste de redistribución** (respec): primera vez 0 (3 gratis); a partir de la 6.ª: L1 88 · L10 218 · L30 598 · L60 1.403 fichas, con tope (`cap 14`) para que nunca haya que rehacer el personaje.

### Errores reales que encontró el simulador (y se corrigieron)
1. **Doble escalado del daño plano**: el afijo «daño plano» ya se escala por nivel al tirarse (`affixFlatScale = P(ilvl)`), y `damage.js` lo volvía a multiplicar por `P/4`. A nivel 60 un solo arma con +5,5 base aportaba **×2,8** al golpe. Ahora se suma una sola vez (test `combat.test.js`).
2. **Ritmo por encima del máximo** por afijos planos de `resourceMax` (escala distinta) → afijos en `inc` + `maxStacks`.
3. **Rondador 2,4–5× el kit de otras clases** → factor `profile.dmg`, sangrado y garra reducidos, topes de velocidad.
4. **Árboles de talento más pequeños que el presupuesto**: a nivel 60 cada clase podía asignar **48 de 51** nodos → todas las builds terminaban idénticas. Ahora hay 69 nodos por clase y el presupuesto es 1 punto/nivel hasta L30 y 0,5/nivel después (44 puntos a L60 + 2 de misiones): ≈ 70 % del árbol, con elecciones reales (test `character.test.js`).

## 6. Economía y sumideros
- Unidad de ficha: `5,2 · L^0,92`. Venta a mercader = 18 % del valor.
- **Sumideros**: reforja (`6 · (1 + 0,6·n_afijos)`), mejora (`8 + 1·n`), redistribución, descanso/pociones, inserción de gemas, muerte (**−8 % de fichas**, nunca objetos), compras de mercaderes (3 tiendas con inventario sembrado por «semilla de descanso»).
- Valor por rareza: Común 1 · Fino 3 · Afinado 9 · Reliquia 24 · Forjado 6.
- **Estabilidad (crafteo)**: Común 4 · Fino 5 · Afinado 6 · Reliquia 3. Cada reforja consume 1; en 0 el objeto se **fractura**: el riesgo es explícito en el tooltip.
- La **rareza no es poder**: Afinado = más afijos pero con tiradas más bajas (`rollFloor` 0,25) y peor estabilidad; Fino tiene suelo de tirada alto (0,55). Un Fino bien rodado puede superar a un Afinado mediocre; el comparador del tooltip lo muestra con el impacto real en *tu* build.

## 7. Qué dice el simulador y cómo se lee
`node tools/balance-sim.mjs` termina con código ≠ 0 si hay avisos («BALANCE GUARD»). Comprobaciones:
1. **Kit sin equipo** dentro de 0,6–1,8× del DPS esperado (L1/L5/L10, por clase).
2. **Build curada** dentro de 0,55–5,0× del modelo (mediana de 5 equipos).
3. **Dispersión entre clases** al mismo nivel ≤ 2,4×.
4. TTK de enemigo estándar en banda; el bot nunca muere contra un estándar; tough/élite deben poder matarse (mejor de 3 disposiciones).

**Estado actual: `BALANCE GUARD: OK` (0 avisos).** Deuda conocida y deliberada: el bot no flanquea (tough alto), la dispersión L10 está en el límite (2,37×), y el simulador no mide AoE multi-objetivo (ventaja real del Prismante) ni utilidad/control.

## 8. Reglas para tocar el equilibrio
1. Edita **solo** `data/balance/balance.json`, `data/classes/*.json` (`profile.dmg`) o los coeficientes de `data/abilities/*.json`.
2. Ejecuta `npm run balance` (completo ≈ 15 s; `--quick` para humo) y `npm test`.
3. Nunca subas un tope sin anotar aquí por qué. Los topes existen para que **ninguna combinación de afijos/únicos/talentos rompa el juego**.
4. Los jefes artesanales se ajustan con `hpMult`/`damage` de su definición, **no** con tiers: el tier `boss` ya fija 130 s de TTK.

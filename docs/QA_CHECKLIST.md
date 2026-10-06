# QA CHECKLIST

Cómo se prueba este juego, qué está automatizado y qué requiere ojos humanos. Marca ✅ = cubierto por una prueba automática que se ejecuta con un comando; 👁 = revisión manual obligatoria.

## 0. Antes de cada commit (≈ 1 min, automático)
```
npm run validate && node tools/check-ui-keys.mjs && npm test && npx vite build
```
Antes de cada entrega/versión además: `npm run fuzz:dungeons -- 250`, `npm run balance`, `npm run e2e -- --suite all`.

## 1. Arranque y ciclo de vida
- ✅ El juego arranca sin errores de consola (E2E `play`).
- ✅ Nueva partida crea sesión determinista; la primera misión empieza (`session.test.js`).
- ✅ Guardar / continuar restaura personaje, inventario, alijo, misiones, flags y posición (`save.test.js`, E2E).
- ✅ Guardado corrupto/truncado → se usa la copia anterior; pérdida total se informa sin crash (`save.test.js`).
- ✅ Guardado de versión futura se rechaza; versión antigua migra (`save.test.js`).
- 👁 Cerrar la pestaña en mitad de una escritura de guardado y reabrir.

## 2. Combate y legibilidad
- ✅ Daño determinista, armadura/resistencias, esquiva con i-frames, esquiva perfecta, aturdimiento/silencio, DR de control, congelación/*shatter*, DoT (`combat.test.js`).
- ✅ Todo arquetipo de enemigo ataca a un jugador pasivo (no hay cerebros muertos) y roles distintos se comportan distinto (`enemies.test.js`).
- ✅ Equidad de telégrafos: un bot competente esquiva la mayoría de golpes fuertes (`enemies.test.js`, `bosses.test.js`).
- 👁 Cada ataque nuevo: ¿se lee el peligro ≥ 0,5 s antes? ¿el tamaño del telégrafo es el real? ¿el sonido de aviso es distinto del de impacto?
- 👁 *Hit-stop*, sacudida, números de daño: proporcionados al golpe, desactivables.

## 3. Jefes y élites
- ✅ Ildra: escudo solo cae con Tríada; fases; reinicio al morir el jugador (`bosses.test.js`).
- ✅ Brannoch: carga contra pilar lo aturde; fase 2 invoca; vencible por bot competente.
- ✅ Élites: exclusiones de modificadores, presupuesto de peligro, ganchos funcionales (`director.test.js`).
- 👁 Dificultad real contra jugadores humanos (¿frustrante o justa?) en las 4 dificultades.

## 4. Progresión y objetos
- ✅ XP → nivel → desbloqueos/puntos; talentos con conectividad y desasignación segura; respec con coste y reembolso (`character.test.js`).
- ✅ Transformadores cambian cómo funciona la habilidad.
- ✅ Generación determinista; recuento de afijos por rareza; reglas de ranura; **rareza ≠ poder** (`items.test.js`).
- ✅ Únicos: parches/triggers con ICD; restricción de clase.
- ✅ Crafteo: desmontar, reforjar con Estabilidad, mejoras con fallo, costes.
- ✅ Equipar/desequipar nunca pierde objetos.
- 👁 Tooltips: comparación con el equipado, texto sin desbordes en ES y EN, rarezas distinguibles sin color.

## 5. Mundo, misiones, secretos
- ✅ La zona se construye y **todo POI/NPC/spawn es alcanzable**; acantilados bloqueados, rampas transitables (`zone.test.js`, `nav.test.js`).
- ✅ Cadena principal completa jugada en headless: Orrel → Brannoch → cripta (Tarn) → Puerta de la Campana → Ildra → final (`story.test.js`).
- ✅ Objetivos por nivel: matar al jefe *antes* de que la misión llegue a esa etapa también cuenta.
- ✅ Puerta física (cortina de resonancia) cerrada hasta cumplir objetivos; sin «nivel N».
- ✅ Memoria de NPC y consecuencias (Tarn rescatado/abandonado, Orrel confrontado).
- ✅ Secretos de Escucha (clima), cachés ocultos, cadena de glifos → puerta → cámara Desafine → jefe opcional.
- 👁 Ningún *soft-lock* al guardar/cargar en mitad de una etapa (probar con el panel dev: `Story`).

## 6. Mazmorras y puzles
- ✅ 750 semillas × 3 familias × tamaños × objetivos generan mazmorras válidas (`fuzz:dungeons`): conectividad, llaves antes de cerraduras, jefe alcanzable, puzles con solución verificada.
- ✅ Puzles: solución única/mínima de pistas (tono), siempre resolubles y no triviales (haces), solucionables con información de fuera (glifos), pistas por capas (`puzzles.test.js`).
- ✅ Entrar/salir de una mazmorra preserva el mundo exterior (E2E `play`, `session.test.js`).
- 👁 Cada familia nueva: ¿se orienta el jugador sin minimapa? ¿las salas tienen identidad? Capturas con `npm run e2e -- --suite dungeon`.

## 7. UI / UX
- ✅ Todas las claves de texto usadas en código existen en ES y EN (`check-ui-keys`).
- ✅ Los 15 paneles se abren con datos reales sin error de consola (E2E `panels`).
- 👁 Navegar *solo con teclado* y *solo con mando*; foco visible; Esc siempre cierra el panel superior.
- 👁 Escala de UI 80–150 %, texto 80–160 %, alto contraste, reducción de destellos, subtítulos.
- 👁 Resoluciones 1280×720, 1920×1080, 2560×1440, móvil vertical/horizontal.

## 8. Rendimiento y estabilidad
- ✅ Presets `low…ultra` arrancan; el E2E corre en GL por software.
- 👁 60 fps en un portátil de gama media con `high` en la Terraza Baja y en combate de grupo con 3 élites.
- 👁 Sesión de 60 min: sin fugas (memoria estable en el panel *Perf*, `renderer.info.memory`), sin degradación de fps.
- ✅ Los errores de un fotograma no detienen el bucle (se registran como `frame failed`).

## 9. Audio
- ✅ El motor produce señal (RMS > 0 en E2E) y no falla sin interacción previa del usuario.
- 👁 Mezcla: voz/jefe/avisos por encima de la música; música no «pisa» los telégrafos; volúmenes por bus recordados.

## 10. Equilibrio
- ✅ `npm run balance`: bandas de DPS del kit, TTK por tier, rendimiento de botín, **guardia con código de salida** (estado y avisos conocidos: [BALANCE.md](BALANCE.md) §7).
- 👁 Playtest de 10 min por clase: ¿hay una build trivialmente superior? ¿una habilidad que nadie usa?

## 11. Plantilla de informe de bug
```
Título corto · Versión/commit · Navegador/GPU · Semilla (nueva partida / código de mazmorra)
Pasos exactos · Esperado · Observado · Captura/vídeo · Guardado adjunto (menú principal → Importar/Exportar)
```
Los guardados se pueden **exportar** como texto (menú principal → Importar/Exportar), así que un bug se reproduce con el estado exacto.

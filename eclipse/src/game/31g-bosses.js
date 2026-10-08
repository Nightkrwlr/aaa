// 31g-bosses.js — Jefes exclusivos y guaridas (D8)
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js.
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// ── PRIMERA PIEZA DE D8: SELLO DE LA GUARIDA ─────────────────────────────────────────────────────────────────────────────────
// Antes, el jefe de cada región salía en cuanto el jugador pisaba su arena y, al abatirlo, se abría el paso a la zona siguiente:
// avanzar de zona era demasiado fácil. Ahora, mientras el jefe de una región no haya caído la primera vez, su guarida está
// SELLADA y el jefe no aparece hasta cumplir tres requisitos (se ven en la misión del jefe y en un aviso al acercarse a la arena):
//   1) MISIÓN: tener aceptada (o completada) la misión principal que pide abatirlo. Esa misión solo la ofrece su contacto cuando se
//      ha terminado la anterior, así que obliga a hacer antes la cadena de misiones de la zona.
//   2) NIVEL: el de esa misión menos una pequeña holgura.
//   3) SELLOS: «fragmentos de sello» que se ganan jugando la región (élites, nidos, terminales hackeadas, registros del Archivo,
//      encargos secundarios, puzles y operaciones). Cada fuente da como mucho `caps[fuente]` por región, para que no baste una sola.
// Tras la primera muerte del jefe la arena vuelve a funcionar como siempre (reaparece a los 30 min para farmear). Los jefes de
// operaciones y los secretos (altar) no se tocan. Todo son datos en x.cfg.bossGate.
//
// Contrato con el resto del juego:
//   · 26-spawner.js (arenaCheck) llama a bossGateArena(arena, distancia) antes de invocar al jefe.
//   · 22-quests.js (objText «boss») añade bossGateText(idJefe) a la línea de la misión.
//   · Guardado: S.bossGate = { v: 1, r: { [región]: { n: { [fuente]: cuenta }, ids: [claves ya contadas] } } }.
//   · Otros frentes pueden sumar sellos con bossGateAdd(región, fuente, clave) (p. ej. PUZLES emite 'puzzleSolved').

x.cfg.bossGate = {
  seals: [3, 3, 4, 4, 5, 5, 6, 6, 7], // fragmentos necesarios por región (índice = región)
  lvlSlack: 1, // nivel mínimo = nivel de la misión del jefe − holgura
  caps: { elite: 3, nido: 2, terminal: 2, lore: 2, encargo: 2, puzle: 2, operacion: 2 }, // máximo por fuente y región
  names: {
    elite: "élite abatida",
    nido: "nido destruido",
    terminal: "terminal hackeada",
    lore: "registro del Archivo",
    encargo: "encargo cumplido",
    puzle: "puzle resuelto",
    operacion: "operación completada",
  },
  hintEvery: 20, // segundos entre avisos al acercarse a una guarida sellada
  hintRadius: 9, // metros más allá del borde de la arena en los que avisa
};

// misión principal cuyo objetivo es abatir al jefe de la región (cacheada)
const bgQuestCache = new Map();
function bgQuestFor(reg) {
  if (bgQuestCache.has(reg)) return bgQuestCache.get(reg);
  const id = De[reg] && De[reg].boss;
  let found = null;
  if (id) for (const k in gi) if (gi[k].main && gi[k].obj.some((o) => o.t === "boss" && o.b === id)) found = k;
  bgQuestCache.set(reg, found);
  return found;
}

// fragmentos de sello conseguidos en una región (cada fuente cuenta hasta su tope)
function bossGateSeals(reg) {
  const R = x.S && x.S.bossGate && x.S.bossGate.r[reg];
  if (!R) return 0;
  let n = 0;
  for (const k in x.cfg.bossGate.caps) n += Math.min(x.cfg.bossGate.caps[k], R.n[k] || 0);
  return n;
}

// estado de los tres requisitos de la guarida de una región
function bossGateStatus(reg) {
  const S = x.S,
    C = x.cfg.bossGate,
    d = De[reg];
  const killed = !!S.world.bosses["reg" + reg];
  const qid = bgQuestFor(reg),
    q = qid ? gi[qid] : null;
  const questOk = !qid || !!(S.quests.active[qid] || S.quests.done[qid]);
  const minLvl = q ? Math.max(1, q.lvl - C.lvlSlack) : Math.max(1, d.lvl[1] - 2);
  const lvlOk = S.lvl >= minLvl;
  const have = bossGateSeals(reg),
    need = C.seals[reg] != null ? C.seals[reg] : 3;
  const sealOk = have >= need;
  const falta = [],
    corto = [];
  if (!questOk) falta.push(`misión «${q.n}» (${(zt[q.giver] && zt[q.giver].n) || "tu contacto"})`);
  if (!lvlOk) (falta.push(`nivel ${minLvl} (tienes ${S.lvl})`), corto.push(`nivel ${minLvl}`));
  if (!sealOk) (falta.push(`sellos ${have}/${need}`), corto.push(`sellos ${have}/${need}`));
  return { reg, killed, ok: killed || falta.length === 0, quest: qid, questOk, minLvl, lvlOk, have, need, sealOk, falta, corto };
}

// texto que se añade a la línea «Derrota a X» de la misión del jefe (vacío si la guarida ya está abierta)
function bossGateText(bossId) {
  if (!x.S || !x.S.bossGate) return "";
  const reg = De.findIndex((d) => d.boss === bossId);
  if (reg < 0) return "";
  const st = bossGateStatus(reg);
  return st.ok || !st.corto.length ? "" : ` · guarida sellada (${st.corto.join(" · ")})`;
}

// ¿puede aparecer el jefe de esta arena? Si no, avisa (con enfriamiento) de lo que falta cuando el jugador se acerca.
let bgHintT = -999;
function bossGateArena(arena, dist) {
  const reg = arena.reg;
  if (arena.op || arena.secret || !(reg >= 0) || !De[reg] || !x.S || !x.S.bossGate) return true;
  const st = bossGateStatus(reg);
  if (st.ok) return true;
  const C = x.cfg.bossGate;
  if (dist < arena.rad + C.hintRadius && x.time - bgHintT > C.hintEvery) {
    bgHintT = x.time;
    ee("toast", `Guarida de ${En[De[reg].boss].n} sellada · falta: ${st.falta.join(" · ")}`, "warn");
    ae.play("err");
  }
  return false;
}

// suma un fragmento de sello en una región. `clave` evita contar dos veces lo mismo (terminal, registro, encargo…)
function bossGateAdd(reg, fuente, clave) {
  const S = x.S,
    C = x.cfg.bossGate;
  if (!S || !S.bossGate || !(reg >= 0) || !De[reg] || !(fuente in C.caps)) return false;
  if (S.world.bosses["reg" + reg]) return false; // jefe ya abatido: el sello ya no hace falta
  const R = S.bossGate.r[reg] || (S.bossGate.r[reg] = { n: {}, ids: [] });
  if (clave != null) {
    const k = fuente + ":" + clave;
    if (R.ids.includes(k)) return false;
    R.ids.push(k);
    if (R.ids.length > 80) R.ids.shift();
  }
  if ((R.n[fuente] || 0) >= C.caps[fuente]) return false;
  const antes = bossGateSeals(reg);
  R.n[fuente] = (R.n[fuente] || 0) + 1;
  const have = bossGateSeals(reg),
    need = C.seals[reg] != null ? C.seals[reg] : 3;
  if (have > antes && antes < need) {
    ee("toast", `Fragmento de sello · ${De[reg].n}: ${Math.min(have, need)}/${need} (${C.names[fuente]})`, "good");
    have >= need && ee("toast", `Sello completo: la guarida de ${En[De[reg].boss].n} puede abrirse`, "good");
  }
  return true;
}

// ── fuentes de sellos ────────────────────────────────────────────────────────────────────────────────────────────────────────
function bgRegAt(e) {
  if (x.mode === "op") return x.op ? x.op.reg : -1;
  return x.map && x.map.regAt && e ? x.map.regAt(e.x, e.z) : x.regionId;
}
It("kill", (e) => {
  if (!e || e.boss || e.mini) return;
  if (e.ent && e.ent.k === "nest") bossGateAdd(bgRegAt(e), "nido", e.ent.id);
  else if (e.elite || e.champion) bossGateAdd(bgRegAt(e), "elite");
});
It("lore", (n) => {
  if (!n) return;
  bossGateAdd(n.reg != null ? n.reg : x.regionId, "lore", n.lid || n.id || n.t);
});
It("questDone", (q) => {
  if (!q || q.main) return;
  const reg = q.reg != null ? q.reg : zt[q.giver] ? zt[q.giver].reg : x.regionId;
  bossGateAdd(reg, "encargo", q.n);
});
It("puzzleSolved", (p) => {
  bossGateAdd(p && p.reg != null ? p.reg : x.regionId, "puzle", p && (p.id || p.key));
});
It("opReward", () => {
  bossGateAdd(x.op ? x.op.reg : x.regionId, "operacion", x.op && x.op.id);
});
// terminales hackeadas con éxito: el gestor de misiones las recibe en onHack (también en operaciones)
{
  const onHackPrev = ht.onHack;
  ht.onHack = function (n) {
    try {
      bossGateAdd(x.mode === "op" ? (x.op ? x.op.reg : -1) : n && n.reg, "terminal", n && n.id);
    } catch (err) {
      console.warn("sello: terminal", err);
    }
    return onHackPrev.call(this, n);
  };
}

// ── guardado ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
x.migrations.push((S) => {
  if (S.bossGate && S.bossGate.v === 1) return;
  S.bossGate = { v: 1, r: {} };
  // partidas anteriores: las terminales ya hackeadas de cada región cuentan como sellos
  const term = (S.world && S.world.term) || {};
  for (const id in term) {
    const m = /^term_(\d+)_/.exec(id);
    if (!m) continue;
    const R = S.bossGate.r[m[1]] || (S.bossGate.r[m[1]] = { n: {}, ids: [] });
    R.n.terminal = Math.min(x.cfg.bossGate.caps.terminal, (R.n.terminal || 0) + 1);
    R.ids.push("terminal:" + id);
  }
});

// ganchos de prueba (escenarios jefes-*.mjs)
window.__bossGate = { status: bossGateStatus, add: bossGateAdd, seals: bossGateSeals, text: bossGateText, cfg: x.cfg.bossGate, emit: ee };

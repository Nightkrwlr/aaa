// 31k2-rares-loot.js — Raros del mundo (D13): botín, trofeos, objetos especiales con misión, HUD, minimapa y diario
// Fragmento reservado: comparte ámbito con el resto del juego (ver README.md). Se evalúa ANTES de 32-boot.js (y después de 31k-rares.js).
// Ganchos disponibles: x.tick.push((dt)=>…), x.migrations.push((S)=>…), x.cfg.<sistema>, It('evento', fn) / ee('evento', …).
//
// Recompensas «mejores, no excesivas» (el contrato de la economía, DEPTH_DESIGN §2.2, pone el techo):
//   · tabla de rarezas «raro» (entre el campeón y el jefe) con 1 pieza de equipo ≥ Raro GARANTIZADA (Épico ~10 %, Legendario o más ~1 %);
//   · un TROFEO VENDIBLE propio (vale ~2,4× el de un enemigo corriente de su región; las únicas ~4,2×) que cuenta para las mejoras del Bastión;
//   · materiales (núcleos y datos) y las tiradas de su tabla de botín (créditos ×16, módulos 0,8 y planos 0,15 de esperanza).
// Objetos especiales marcados con ★: las únicas siempre sueltan el suyo (con historia y misión propia) y los raros corrientes, con poca
// probabilidad, uno genérico. Se guardan en S.rare.items, inician una misión al instante (si hay hueco entre los encargos) y no se pueden abandonar.

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 1 · Tablas de botín y trofeos
// ═══════════════════════════════════════════════════════════════════════════════════════════
Object.assign(x.cfg.rare, {
  trophyMul: 2.4, // valor del trofeo de un raro corriente (× el de un enemigo duro de su región)
  trophyUniq: 4.2, // el de una única
  coreN: [1, 2], // núcleos y datos que suelta
  dataN: [0, 2],
  itemP: 0.12, // probabilidad de que un raro corriente suelte un objeto especial genérico (las únicas siempre sueltan el suyo)
  itemMaxHeld: 2, // como mucho 2 objetos genéricos sin entregar a la vez
  quest: { credits: 2.2, creditsRastro: 3, creditsHallazgo: 1.2, xpf: 1.3, reachR: 4.5, farMin: 70, farMax: 150 },
});
// rarezas: la fuente «raro» (cae en las tiradas de módulos y planos) y la pieza garantizada («rareGear»: nunca por debajo de Raro)
x.cfg.econ.rar.rare = [0, 30, 48, 18, 3.6, 0.4];
x.cfg.econ.rar.rareGear = [0, 0, 89, 10, 0.9, 0.1];
x.cfg.econ.drop.rare = { cr: [1, 16], mat: 8, tro: 0, perf: 0, mod: 0.8, plan: 0.15, hp: 0.5, gren: 0.35, med: 0.3, cap: 1 };
GD_CFG.plan.rare = { p: 0.3, tier: 4 }; // planos de gadget: entre el campeón (22 %, nivel 3) y el jefe (40 %, nivel 4)
{
  const _src = ecoSrcOf;
  ecoSrcOf = function (n) {
    return n.rq ? "rare" : _src(n);
  };
}

// trofeos de los raros: uno por arquetipo y región (su valor sube con el nivel de la región) y uno propio por cada única
const RQU_TROPHY = {
  u_hueco: "Casco del Sargento Hueco", u_locutora: "Cuerdas vocales de La Locutora", u_espejismo: "Pliegue del Espejismo Dorado", u_hongo: "Sombrero del Hongo Viejo",
  u_colmillo: "Colmillo de Colmillo Blanco", u_prom: "Placa matrícula de PROM-7", u_rey: "Corona del Rey de Ceniza", u_eco: "Garganta del Eco Mudo", u_cantora: "Cristal de La Cantora",
};
function rqTrophyKey(arch, reg, uniq) {
  return uniq ? "rq_" + uniq : `rq_${arch}_${reg}`;
}
function rqAddTrophies(info) {
  const t = ecoCfg.trophy,
    val = (reg, mul) => Math.max(2, Math.round(t.kv * mt.credits((De[reg].lvl[0] + De[reg].lvl[1]) / 2) * Math.sqrt(12) * mul));
  for (const a of Object.keys(RQA))
    for (const reg of Object.keys(RQA[a].bases).map(Number)) {
      const A = RQA[a],
        id = rqTrophyKey(a, reg),
        ice = a === "aura" && reg === 4;
      info[id] = { id, n: ice ? A.trophyIce : A.trophy, ing: false, reg: -1, boss: true, v: val(reg, x.cfg.rare.trophyMul), fam: rqFam(A.bases[reg]), enemy: `Raro · ${A.n} · ${De[reg].n}`, rq: true };
    }
  for (const u of RQU) {
    const id = rqTrophyKey(u.arch, u.reg, u.id);
    info[id] = { id, n: RQU_TROPHY[u.id] || u.name, ing: false, reg: -1, boss: true, v: val(u.reg, x.cfg.rare.trophyUniq), fam: rqFam(u.base), enemy: `Única · ${u.name} · ${De[u.reg].n}`, rq: true };
  }
}
{
  const _tt = ecoTroTable;
  ecoTroTable = function () {
    const info = _tt();
    if (!info.__rq) {
      rqAddTrophies(info);
      Object.defineProperty(info, "__rq", { value: 1, enumerable: false });
    }
    return info;
  };
  // los raros se agrupan con los jefes en la pestaña Botín
  const _jh = ecoJunkHtml;
  ecoJunkHtml = function () {
    return _jh().replace("<b>Jefes</b>", "<b>Jefes y raros</b>");
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 2 · Muerte de un raro: botín, objeto especial y reaparición
// ═══════════════════════════════════════════════════════════════════════════════════════════
function rqOnSlain(n) {
  const S = rqS(),
    R = n.rq,
    s = S.slots[R.slot],
    at = { x: n.x, z: n.z, spd: 4 },
    lvl = n.lvl,
    reg = s ? s.reg : x.regionId;
  // — botín —
  // pieza de equipo garantizada (nunca por debajo de Raro) y el trofeo vendible
  ecoSpawn({ k: "plan", r: ecoRoll("rareGear", ecoLuck()), fresh: false }, at, lvl, "rare");
  ecoSpawn({ k: "trophy", id: rqTrophyKey(R.arch, reg, R.uniq), perfect: false }, at, lvl, "rare");
  const C = x.cfg.rare;
  ecoSpawn({ k: "mat", mat: "core", val: Rt(C.coreN[0], C.coreN[1]) }, at, lvl, "rare");
  const dn2 = Rt(C.dataN[0], C.dataN[1]);
  dn2 > 0 && ecoSpawn({ k: "mat", mat: "data", val: dn2 }, at, lvl, "rare");
  // — objeto especial —
  const it = rqItemFor(n, s);
  it && rqGrantItem(it);
  // — contabilidad y reaparición —
  S.stats.kills++;
  S.stats.byArch[R.arch] = (S.stats.byArch[R.arch] | 0) + 1;
  if (R.uniq) {
    S.uniq[R.uniq] = 1;
    S.stats.uniq++;
  }
  if (s) {
    s.st = "wait";
    s.cd = rqClock() + C.respawnS[0] + Q() * (C.respawnS[1] - C.respawnS[0]);
    s.seen = 0;
    s.n++;
  }
  RQ.live.delete(R.slot);
  for (const k of R.kids) k && !k.dead && (k.rqDecoy || k.rqPylon) && rqVanish(k); // señuelos y pilones se desvanecen con ella
  ee("banner", `★ ${R.uniq ? "ÚNICO" : "RARO"} ABATIDO`, R.name, "#ffd34d");
  ee("rare", "slain", n);
  ee("save");
}
{
  const _kl = ecoKillLoot;
  ecoKillLoot = function (n) {
    if (n.rqDecoy) return; // las copias de un Espejismo no dan nada
    _kl(n);
    if (n.rq) {
      try {
        rqOnSlain(n);
      } catch (err) {
        console.warn("[raros] botín", err);
      }
    }
  };
  // las copias no cuentan para las misiones de «abatir»
  const _ok = ht.onKill;
  ht.onKill = function (n) {
    if (n && n.rqDecoy) return;
    return _ok.call(this, n);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 3 · Objetos especiales y su misión
// ═══════════════════════════════════════════════════════════════════════════════════════════
function rqItemFor(n, s) {
  const S = rqS(),
    R = n.rq,
    C = x.cfg.rare;
  if (R.uniq) {
    const u = RQU.find((q) => q.id === R.uniq);
    if (u && !S.items.some((i) => i.uniq === u.id)) return { id: "it_" + ++S.seq, n: u.item.n, d: u.item.d, from: u.name, reg: u.reg, fam: rqFam(u.base), uniq: u.id, q: null, t: rqClock() };
    return null;
  }
  const open = S.items.filter((i) => !i.uniq && !i.done).length;
  if (open >= C.itemMaxHeld || Q() >= C.itemP) return null;
  const fam = rqFam(n.id),
    [name, d] = Yt(RQI[fam]);
  return { id: "it_" + ++S.seq, n: name, d, from: R.name, reg: s ? s.reg : 0, fam, uniq: null, q: null, t: rqClock() };
}
// un punto lejano del jugador, dentro de la región, sobre suelo libre y fuera de refugios (para las misiones de «ir a un lugar»)
function rqFarSpot(reg, minD, maxD) {
  const map = rqMap(),
    pl = x.player;
  if (!map) return null;
  const R = De[reg] || De[0],
    x0 = R.gx * qt,
    z0 = R.gz * qt,
    m = 16;
  for (let tries = 0; tries < 300; tries++) {
    const X = x0 + m + Rt(0, qt - 2 * m - 1),
      Z = z0 + m + Rt(0, qt - 2 * m - 1);
    if (!mxFree(map, X, Z)) continue;
    const d = Math.hypot(X + 0.5 - pl.x, Z + 0.5 - pl.z);
    if (d < minD || d > maxD || (x.world && x.world.safeAt(X + 0.5, Z + 0.5))) continue;
    return { x: X + 0.5, z: Z + 0.5 };
  }
  return null;
}
function rqQuestDef(it) {
  const Cq = x.cfg.rare.quest,
    L = qe(Math.round(x.S.lvl), 1, 62),
    cr = (k) => Math.round(60 * mt.credits(L) * k);
  const u = it.uniq ? RQU.find((q) => q.id === it.uniq) : null;
  const id = "rq_" + it.id.slice(3) + "_" + Math.floor(it.t).toString(36);
  if (u) {
    const Q0 = u.quest,
      def = { id, giver: Q0.npc || "morales", n: Q0.title, lvl: Math.max(1, L), xpf: Q0.xpf || Cq.xpf, intro: Q0.intro, done: Q0.done, obj: [], rew: { credits: 0, items: [{ k: "gear", r: Q0.r }] }, rq: 1, special: 1, item: it.id, reg: u.reg };
    if (Q0.kind === "deliver") {
      def.obj = [{ t: "talk", npc: Q0.npc, n: 1 }];
      def.rew.credits = cr(Cq.credits);
    } else {
      const sp = rqFarSpot(u.reg, Cq.farMin, Cq.farMax) || rqFarSpot(u.reg, 30, 260) || rqFarSpot(u.reg, 12, 420);
      if (!sp) return null;
      def.obj = [{ t: "rq", k: "reach", x: sp.x, z: sp.z, r: Q0.reachR || Cq.reachR, n: 1, label: Q0.kind === "hallazgo" ? "el alijo" : "el lugar marcado" }];
      if (Q0.kind === "hallazgo") {
        def.auto = 1;
        def.rew.credits = cr(Cq.creditsHallazgo);
        def.rew.items = []; // el premio es el alijo (cofre de nivel 3) que hay allí
      } else {
        def.rew.credits = cr(Cq.creditsRastro);
      }
    }
    return def;
  }
  // genérico: llevar el objeto al superviviente de la región (o, si no hay, al intendente del Bastión)
  const npcs = RQN[it.reg] || ["morales"],
    npc = npcs[Math.floor(Q() * npcs.length)],
    nm = zt[npc] ? zt[npc].n : "el intendente";
  return {
    id, giver: npc, n: `Encargo especial: ${it.n}`, lvl: Math.max(1, L), xpf: 0.9,
    intro: `Has encontrado algo que no es de aquí: «${it.n}». ${it.d} ${nm} sabrá qué hacer con ello.`,
    done: `${nm} ${RQN_DONE[it.fam]}`,
    obj: [{ t: "talk", npc, n: 1 }],
    rew: { credits: cr(Cq.credits * 0.8), item: Q() < 0.5 ? 1 : 0, items: [] },
    rq: 1, special: 1, item: it.id, reg: it.reg,
  };
}
function rqStartQuest(it) {
  const S = rqS();
  if (it.q && S.items.includes(it) && x.S.quests.active[it.q]) return true;
  const def = it.pend || rqQuestDef(it);
  if (!def) return false;
  it.q = def.id;
  // sin hueco entre los encargos secundarios (límite kx): se queda pendiente sin molestar con un aviso en cada reintento
  if (ht.sideCount() >= kx) {
    it.pend = def;
    return false;
  }
  ht.accept(def.id, def);
  if (x.S.quests.active[def.id]) {
    delete it.pend;
    return true;
  }
  it.pend = def; // sin hueco entre los encargos (límite de secundarios): se reintenta cada pocos segundos
  return false;
}
function rqGrantItem(it) {
  const S = rqS();
  S.items.push(it);
  S.stats.items++;
  // los últimos 30 objetos entregados se recuerdan; los más viejos se descartan
  const done = S.items.filter((i) => i.done);
  if (done.length > 30) S.items.splice(S.items.indexOf(done[0]), 1);
  const started = rqStartQuest(it);
  ee("banner", "★ OBJETO ESPECIAL", it.n, "#ffd34d");
  ee("toast", started ? `Objeto especial: ${it.n}. Nueva misión en tu diario.` : `Objeto especial: ${it.n}. Se te asignará la misión cuando tengas hueco entre los encargos.`, "quest");
  ae.play("success");
  x.fx.text(x.player.x, 2.6, x.player.z, "★ " + it.n, "#ffd34d", 15, { life: 2 });
  ee("rare", "item", it);
  ee("save");
}
// una misión del objeto que se completa: el objeto queda como entregado
It("questDone", (q) => {
  if (!q || !q.rq) return;
  const S = rqS(),
    it = S.items.find((i) => i.id === q.item);
  if (it) {
    it.done = 1;
    it.q = null;
  }
  ee("banner", "★ " + q.n, q.done.length > 90 ? q.done.slice(0, q.done.indexOf(".", 40) + 1 || 90) : q.done, "#ffd34d");
  q.done && ee("toast", q.done, "quest");
});
// los encargos de un objeto especial no se abandonan (el objeto sigue en tu poder y la misión no se puede reabrir)
{
  const _ab = ht.abandon;
  ht.abandon = function (n) {
    const a = x.S.quests.active[n],
      d = a && ri(n, a);
    if (d && d.rq) {
      ee("toast", "Este encargo viene de un objeto especial: no se puede abandonar.", "warn");
      return;
    }
    return _ab.call(this, n);
  };
}
// objetivo propio: «llegar a un lugar» (con su marca en el mapa)
{
  const _ot = ht.objText,
    _tg = ht.target;
  ht.objText = function (n, e) {
    if (!n || n.t !== "rq") return _ot.call(this, n, e);
    const pl = x.player,
      d = pl ? Math.round(Le(pl.x, pl.z, n.x, n.z)) : 0,
      to = (l) => (/^el /.test(l) ? "al " + l.slice(3) : "a " + l); // «a el alijo» → «al alijo»
    return (e || 0) >= n.n ? `Has llegado ${to(n.label || "el lugar")}` : `Ve ${to(n.label || "el lugar marcado")} (a ${d} m)`;
  };
  ht.target = function (id, e) {
    const s = ri(id, e);
    if (s && s.rq && !this.complete(id, e)) {
      const i = s.obj.findIndex((o, k) => (e.prog[k] || 0) < o.n),
        o = s.obj[i];
      if (o && o.t === "rq") return { x: o.x, z: o.z, n: o.label || "Lugar marcado" };
    }
    return _tg.call(this, id, e);
  };
}
// llegada al lugar marcado + reintento de misiones pendientes
const RQT = { t: 0, pend: 0 };
function rqQuestTick(dt) {
  const S = rqS(),
    pl = x.player;
  if (!S || !S.items.length) return;
  if ((RQT.pend -= dt) <= 0) {
    RQT.pend = 3;
    for (const it of S.items) if (!it.done && (it.pend || !it.q) && !(it.q && x.S.quests.active[it.q])) rqStartQuest(it);
  }
  if (x.mode !== "world" || pl.dead) return;
  for (const [id, st] of Object.entries(x.S.quests.active)) {
    const d = ri(id, st);
    if (!d || !d.rq) continue;
    d.obj.forEach((o, k) => {
      if (o.t !== "rq" || (st.prog[k] || 0) >= o.n) return;
      if (Le(pl.x, pl.z, o.x, o.z) > o.r) return;
      st.prog[k] = o.n;
      ee("quests");
      x.fx.ring(o.x, o.z, 4, 0xffd34d, 0.8);
      x.fx.burst(o.x, 0.6, o.z, 24, { color: 0xffd34d, speed: 5, life: 0.7, size: 0.3, up: 1 });
      if (d.auto) {
        // hallazgo: el alijo está aquí
        ecoChestLoot(o.x, o.z, 3, Math.max(1, Math.round(x.world.lvlAt(o.x, o.z))), { src: "chest3" });
        ht.turnIn(id);
      } else ee("toast", `Lugar alcanzado. Cuéntaselo a ${zt[d.giver] ? zt[d.giver].n : "su dueño"}.`, "quest");
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// 4 · HUD: barra del raro, minimapa y diario
// ═══════════════════════════════════════════════════════════════════════════════════════════
{
  const st = document.createElement("style");
  st.textContent = `#rqBar{display:none;flex-direction:column;align-items:center;gap:2px;margin-top:4px;pointer-events:none;width:100%}
#rqBar.on{display:flex}
#rqBar .nm{font:700 13px var(--f-disp);letter-spacing:.1em;text-transform:uppercase;color:#ffe9a8;text-shadow:0 0 10px rgba(255,200,60,.6),0 1px 2px #000;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rqBar .hp{width:min(300px,86%);height:7px;background:rgba(0,0,0,.6);border:1px solid rgba(255,211,77,.7);box-sizing:border-box}
#rqBar .hp i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ffb340,#ffd34d)}
#rqBar .hp.inv i{background:linear-gradient(90deg,#9ad0ff,#e3f2ff)}
#rqBar .stt{font:600 11px var(--f-disp);letter-spacing:.08em;text-transform:uppercase;color:#cfe3ff;text-shadow:0 1px 2px #000;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rqBar .stt.hot{color:#ffd34d}
body.touch #rqBar .nm{font-size:11px}
body.touch #rqBar .stt{font-size:9.5px}
body.touch #rqBar{align-items:flex-start}
@media (orientation:landscape) and (max-height:520px){body.touch #rqBar{padding-right:28px;box-sizing:border-box}}
@media (max-width:1100px){body:not(.touch) #rqBar .nm{white-space:normal;max-width:min(270px,100%);line-height:1.15;font-size:12px}}
@media (max-width:1000px){body:not(.touch) #rqBar{padding-left:170px;box-sizing:border-box}}`; // escritorio estrecho: el bloque central de 60vw llega hasta la tarjeta del jugador; la barra se corre a la derecha de ella // móvil apaisado: el bloque central (34vw) llega al borde del minimapa; el texto largo no debe pisarlo
  document.head.appendChild(st);
}
function rqBar() {
  if (RQ.bar) return RQ.bar;
  const tc = document.getElementById("hTC");
  if (!tc) return null;
  const b = document.createElement("div");
  b.id = "rqBar";
  b.innerHTML = '<div class="nm"></div><div class="hp"><i></i></div><div class="stt"></div>';
  b._nm = b.firstChild;
  b._hp = b.children[1];
  b._i = b._hp.firstChild;
  b._st = b.lastChild;
  const bb = document.getElementById("bossbar"),
    sb = document.getElementById("sxBar");
  bb ? tc.insertBefore(b, bb) : sb && sb.nextSibling ? tc.insertBefore(b, sb.nextSibling) : tc.appendChild(b);
  return (RQ.bar = b);
}
// el raro «en combate» más cercano (alertado y a menos de 40 m)
function rqFocus() {
  const pl = x.player;
  let best = null,
    bd = 40;
  for (const e of RQ.live.values()) {
    if (!rqAlive(e) || !e.alerted) continue;
    const d = Le(e.x, e.z, pl.x, pl.z);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}
function rqHud(dt) {
  if ((RQ.hudT -= dt) > 0) return;
  RQ.hudT = 0.1;
  const b = rqBar();
  if (!b) return;
  const e = x.mode === "world" ? rqFocus() : null;
  if (!e) {
    if (b._on) {
      b._on = false;
      b.classList.remove("on");
    }
    return;
  }
  const R = e.rq,
    A = RQA[R.arch],
    txt = `★ ${R.uniq ? "Única" : "Raro"} · ${R.name} · ${A.n}`,
    pct = Math.round(qe(e.hp / e.maxHp, 0, 1) * 100),
    inv = e.invuln || R.armor < 0.6,
    stt = R.status || A.hint;
  if (!b._on) {
    b._on = true;
    b.classList.add("on");
  }
  if (b._nm._t !== txt) ((b._nm._t = txt), (b._nm.textContent = txt));
  if (b._i._p !== pct) ((b._i._p = pct), (b._i.style.width = pct + "%"));
  if (b._hp._v !== inv) ((b._hp._v = inv), b._hp.classList.toggle("inv", inv));
  if (b._st._t !== stt) ((b._st._t = stt), (b._st.textContent = stt), b._st.classList.toggle("hot", /VA A|ATURD|EXPUEST|ABIERT|ROTO|ATACA/.test(stt)));
}
x.tick.push((dt) => {
  if (!x.S || !x.started || !x.player) return;
  rqS();
  rqHud(dt);
  rqQuestTick(dt);
});
// marca en el minimapa: estrella dorada
function rqPing(c, size, s, px, pz, big, faint) {
  const pl = x.player,
    R = size / 2 / s - 3,
    dx = px - pl.x,
    dz = pz - pl.z,
    d = Math.hypot(dx, dz),
    ph = (x.time * 0.8) % 1;
  let X = px,
    Z = pz;
  if (d > R) {
    X = pl.x + (dx / d) * R;
    Z = pl.z + (dz / d) * R;
  }
  c.save();
  c.strokeStyle = c.fillStyle = "#ffd34d";
  c.lineWidth = 1.2 / s;
  c.globalAlpha = faint ? 0.55 : 1;
  c.beginPath();
  c.arc(X, Z, 1.6 + ph * (big ? 6 : 4), 0, 6.283);
  c.globalAlpha = (faint ? 0.55 : 1) * (1 - ph);
  c.stroke();
  c.globalAlpha = faint ? 0.7 : 1;
  const r = big ? 2.6 : 2;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -1.5708 + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.45 : r;
    c.lineTo(X + Math.cos(a) * rr, Z + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
  c.restore();
}
{
  const _mp = ecoMinimapPings;
  ecoMinimapPings = function (c, size, s) {
    _mp(c, size, s);
    if (x.mode !== "world" || !x.S || !x.S.rare || !x.player) return;
    const pl = x.player,
      C = x.cfg.rare;
    for (const sl of Object.values(x.S.rare.slots)) {
      if (sl.st !== "ready" || sl.reg !== x.regionId) continue;
      const d = Math.hypot(sl.x - pl.x, sl.z - pl.z);
      if (sl.seen || d < C.pingR) rqPing(c, size, s, sl.x, sl.z, !!sl.uniq, !sl.seen);
    }
    // lugares marcados por las misiones de los objetos especiales
    for (const [id, st] of Object.entries(x.S.quests.active)) {
      const d = ri(id, st);
      if (!d || !d.rq) continue;
      d.obj.forEach((o, k) => o.t === "rq" && (st.prog[k] || 0) < o.n && rqPing(c, size, s, o.x, o.z, true, false));
    }
  };
}
// diario (Archivo → Hitos): resumen de los raros y de los objetos especiales
{
  const _hh = ecoHitosHtml;
  ecoHitosHtml = function () {
    const R = x.S && x.S.rare;
    if (!R || !R.init) return _hh();
    const st = R.stats,
      uq = RQU.length,
      got = Object.keys(R.uniq).length,
      names = Object.entries(RQA)
        .filter(([a]) => st.byArch[a])
        .map(([a, A]) => `${A.ic} ${A.n} ×${st.byArch[a]}`)
        .join(" · ");
    let items = "";
    if (R.items.length) {
      items =
        '<div class="sec">Objetos especiales</div><div class="cards">' +
        R.items
          .slice()
          .reverse()
          .map((it) => {
            const q = it.q && x.S.quests.active[it.q] ? ri(it.q, x.S.quests.active[it.q]) : null,
              state = it.done ? "Entregado" : q ? `Misión en curso: ${ke(q.n)}` : it.pend ? "Esperando hueco entre los encargos" : "Sin misión";
            return `<div class="card"><b style="color:#ffd34d">★ ${ke(it.n)}</b> <span class="tag">${ke(it.from)} · ${ke(De[it.reg] ? De[it.reg].n : "")}</span><p style="font-size:13px;margin:4px 0">${ke(it.d)}</p><div class="muted" style="font-size:12px">${state}</div></div>`;
          })
          .join("") +
        "</div>";
    }
    return (
      `<div class="eco-sum"><span><b style="color:#ffd34d">${st.kills}</b> raros abatidos · <b style="color:#ffd34d">${got}</b> de ${uq} únicas · <b>${st.items}</b> objetos especiales${names ? `<br><span class="muted" style="font-size:12px">${names}</span>` : ""}</span></div>` +
      items +
      _hh()
    );
  };
}
// consejo la primera vez que se ve uno (solo una vez por partida)
It("rare", (what) => {
  if (what !== "seen") return;
  const S = rqS();
  if (!S || S.tip) return;
  S.tip = 1;
  ee("toast", "Los raros no vuelven pronto: cada uno tiene una mecánica propia y suelta equipo, un trofeo muy valioso y, a veces, un objeto especial ★ con misión.", "quest");
});

Object.assign(window.__rare, {
  loot: { slain: rqOnSlain, itemFor: rqItemFor, grant: rqGrantItem, questDef: rqQuestDef, startQuest: rqStartQuest, trophyKey: rqTrophyKey, addTrophies: rqAddTrophies, farSpot: rqFarSpot },
  hud: { focus: rqFocus, tick: rqHud, bar: rqBar },
  questTick: rqQuestTick,
  pings: (c, size, s) => ecoMinimapPings(c, size, s), // la cadena completa de envoltorios (la usa el minimapa de verdad)
  hitos: () => ecoHitosHtml(),
  junkHtml: () => ecoJunkHtml(),
  nemKiller: () => (typeof sxNemKiller === "function" ? sxNemKiller() : null), // el vigente (con el envoltorio de arriba), no el que capturó window.__sx
  hs: (n, d, o) => hs(n, d, o),
  RQI,
  RQN,
});

// 22-quests.js — Misiones y encuentros

// ════════ [524] VariableDeclaration LE,Cx,kx (32 bytes) ════════
var LE = 1800 * 1e3,
  Cx = 720 * 1e3,
  kx = 4;


// ════════ [525] FunctionDeclaration ri (40 bytes) ════════
function ri(n, e) {
  return (e && e.def) || gi[n];
}


// ════════ [526] VariableDeclaration zx (10 bytes) ════════
var zx = {};


// ════════ [527] ForOfStatement ForOfStatement (57 bytes) ════════
for (let [n, e] of Object.entries(gi)) e.next && (zx[e.next] = n);


// ════════ [528] VariableDeclaration ht (9396 bytes) ════════
var ht = {
  available(n) {
    let e = x.S,
      t = [];
    for (let [a, r] of Object.entries(gi)) {
      if (r.giver !== n || e.quests.done[a] || e.quests.active[a]) continue;
      let o = zx[a];
      (o && !e.quests.done[o]) ||
        (a === "s_lin2" && !e.flags.research) ||
        (!r.main && e.lvl < r.lvl - 1) ||
        t.push({ id: a, def: r, locked: e.lvl < r.lvl - (r.main ? 3 : 1) });
    }
    let i = t.filter((a) => a.def.main),
      s = t
        .filter((a) => !a.def.main)
        .sort((a, r) => a.def.lvl - r.def.lvl)
        .slice(0, 1);
    return i.concat(s);
  },
  repeatOffer(n) {
    let e = x.S,
      t = zt[n];
    if (
      !t ||
      t.reg < 0 ||
      ["reyes", "vega", "chispas", "sosa", "navarro", "morales", "lin"].includes(n) ||
      this.available(n).some((s) => !s.locked)
    )
      return null;
    let i = e.quests.rep[n];
    return i && i.active
      ? null
      : i && i.until > Date.now()
        ? { cooldown: i.until - Date.now() }
        : ((!i || !i.def) && (e.quests.rep[n] = { def: this.genRepeat(n, t.reg), until: 0 }),
          { def: e.quests.rep[n].def });
  },
  board() {
    let n = x.S;
    if (!n.quests.board || Date.now() - n.quests.board.gen > LE) {
      let e = Jd(),
        t = [];
      for (let i = 0; i < 4; i++) {
        let s = Rt(Math.max(0, e - 2), e);
        t.push(this.genRepeat("morales", s, !0));
      }
      n.quests.board = { gen: Date.now(), list: t };
    }
    return n.quests.board;
  },
  genRepeat(n, e, t = !1) {
    let i = De[e],
      s = qe(Math.max(i.lvl[0], Math.min(i.lvl[1], x.S.lvl)), i.lvl[0], i.lvl[1]),
      a = ii(xx),
      r = i.enemies.filter((u) => (u[2] || 0) <= s + 2),
      o = (u) => Rt(u[0], u[1]),
      l,
      c,
      d,
      h = ` en ${i.n}`;
    switch (a.t) {
      case "kill_e": {
        let u = ii(r.map((m) => ({ id: m[0], w: m[1] }))).id,
          p = o(a.n);
        ((l = [{ t: "kill", e: u, reg: e, n: p }]),
          (c = a.title(gn[u].n)),
          (d = `Necesito que abatas ${p} ejemplares de ${gn[u].n.toLowerCase()}${h}.`));
        break;
      }
      case "kill_fam": {
        let u = [...new Set(r.map((g) => gn[g[0]].fam))],
          p = Yt(u),
          m = o(a.n);
        ((l = [{ t: "kill", fam: p, reg: e, n: m }]),
          (c = a.title(vr[p].toLowerCase() + "s")),
          (d = `Elimina ${m} enemigos de tipo ${vr[p].toLowerCase()}${h}.`));
        break;
      }
      case "elite": {
        let u = o(a.n);
        ((l = [{ t: "kill", any: !0, elite: !0, n: u }]),
          (c = a.title()),
          (d = `Los \xE9lites est\xE1n organizando a los dem\xE1s. Elimina ${u}.`));
        break;
      }
      case "nest": {
        let u = o(a.n);
        ((l = [{ t: "nest", reg: e, n: u }]), (c = a.title()), (d = `Destruye ${u} nidos${h}.`));
        break;
      }
      case "gather": {
        let u = ["bio", "scrap", "bio", "bio", "crystal", "scrap", "crystal", "scrap", "crystal"][e],
          p = u === "crystal" ? Rt(3, 6) : Rt(12, 25);
        ((l = [{ t: "gather", mat: u, n: p }]),
          (c = a.title(mn[u].n.toLowerCase())),
          (d = `Nos faltan suministros. Tr\xE1eme ${p} de ${mn[u].n.toLowerCase()}.`));
        break;
      }
      case "collect": {
        let u = ii(r.map((g) => ({ id: g[0], w: g[1] }))).id,
          p = Yt(gx),
          m = o(a.n);
        ((l = [{ t: "collect", item: p, from: u, ch: 0.35, n: m }]),
          (c = a.title(p)),
          (d = `Los ${gn[u].n.toLowerCase()}s llevan ${p.toLowerCase()}. Recupera ${m}.`));
        break;
      }
      case "op": {
        ((l = [{ t: "op", n: 1 }]),
          (c = a.title()),
          (d = "Completa una operaci\xF3n especial (brecha o terminal de despliegue)."));
        break;
      }
      case "event": {
        let u = o(a.n);
        ((l = [{ t: "event", n: u }]),
          (c = a.title()),
          (d = `Responde a ${u} incidente(s): lanzamientos de suministros, hordas, cazas o zonas interiores (s\xF3tanos, grutas, escotillas...).`));
        break;
      }
      default: {
        let u = o(a.n);
        ((l = [{ t: "hack", reg: e, n: u }]), (c = a.title()), (d = `Hackea ${u} terminal(es)${h}.`));
      }
    }
    let f = Math.round(60 * mt.credits(s) * (1 + e * 0.3) * (t ? 1.2 : 1));
    return {
      id: `r_${n}_${Date.now().toString(36)}_${Rt(0, 9999)}`,
      giver: n,
      n: c,
      lvl: s,
      xpf: t ? 0.55 : 0.45,
      intro: d,
      done: "\xA1Buen trabajo! Aqu\xED tienes tu pago.",
      obj: l,
      rew: {
        credits: f,
        item: Lt() < (t ? 0.6 : 0.4) ? 1 : 0,
        mats: Lt() < 0.5 ? { [Yt(["scrap", "bio", "crystal", "data"])]: Rt(1, 4) } : null,
      },
      repeat: !0,
      board: t,
      reg: e,
    };
  },
  sideCount() {
    return Object.entries(x.S.quests.active).filter(([n, e]) => !ri(n, e).main).length;
  },
  accept(n, e) {
    let t = x.S;
    if (t.quests.active[n]) return;
    let i = e || gi[n];
    // una misión que no es repetible y ya está entregada no se puede volver a aceptar (ni por un diálogo viejo ni por un guardado raro)
    if (i && !i.repeat && t.quests.done[n]) return !1;
    if (!i.main && this.sideCount() >= kx)
      return (ee("toast", `Ya llevas ${kx} encargos secundarios. Completa o abandona alguno.`, "warn"), !1);
    let s = { prog: i.obj.map(() => 0), t: Date.now(), tracked: !0 };
    (i.obj.forEach((r, o) => {
      if (r.t === "datapad" && x.world?.map && x.mode === "world") {
        let l = x.world.map.ents.filter((c) => c.k === "datapad" && c.reg === r.reg && !t.world.dp[c.id]).length;
        s.prog[o] = Math.min(r.n - 1, Math.max(0, r.n - l));
      }
    }),
      i.obj.forEach((r) => {
        if (r.t === "boss") {
          let o = De.findIndex((l) => l.boss === r.b);
          o >= 0 && delete t.world.bosses["reg" + o + "_t"];
        }
      }),
      gi[n] || (s.def = i));
    let a = Object.values(t.quests.active).filter((r) => r.tracked);
    (a.length >= 3 && (a[0].tracked = !1),
      (t.quests.active[n] = s),
      i.repeat && !i.board && (t.quests.rep[i.giver] = { def: i, active: !0, until: 0 }),
      i.board && (t.quests.board.list = t.quests.board.list.filter((r) => r.id !== n)),
      ae.play("open"),
      ee("toast", `Misi\xF3n aceptada: ${i.n}`, "quest"),
      this.refreshGather(),
      ee("quests"));
  },
  abandon(n) {
    let e = x.S,
      t = e.quests.active[n];
    if (!t) return;
    let i = ri(n, t);
    i.main ||
      (delete e.quests.active[n],
      i.repeat && !i.board && (e.quests.rep[i.giver] = { def: null, until: Date.now() + Cx }),
      ee("quests"));
  },
  complete(n, e) {
    return ri(n, e).obj.every((i, s) => (e.prog[s] || 0) >= i.n && (i.t !== "gather" || (x.S.mats[i.mat] || 0) >= i.n));
  },
  turnIn(n) {
    let e = x.S,
      t = x.player,
      i = e.quests.active[n];
    if (!i) return !1;
    let s = ri(n, i);
    if ((this.refreshGather(), !this.complete(n, i))) return !1;
    (s.obj.forEach((c) => {
      c.t === "gather" && (e.mats[c.mat] = Math.max(0, e.mats[c.mat] - c.n));
    }),
      delete e.quests.active[n],
      s.repeat || (e.quests.done[n] = Date.now()),
      s.main && ee("archive", "Cr\xF3nica: " + s.n),
      s.repeat && !s.board && (e.quests.rep[s.giver] = { def: null, until: Date.now() + Cx }));
    let a = s.rew || {},
      r =
        mt.xpToNext(Math.max(1, Math.min(e.lvl, s.lvl + 2))) * (s.main ? 0.25 : s.repeat ? 0.12 : 0.16) * (s.xpf || 1);
    if ((t.addXp(r), a.credits && (e.credits += Math.round(a.credits)), a.mats))
      for (let c in a.mats) e.mats[c] += a.mats[c];
    if (a.cons) for (let c in a.cons) e.cons[c] += a.cons[c];
    let o = Math.max(s.lvl, Math.min(e.lvl, s.lvl + 3)),
      l = [];
    for (let c of a.items || []) {
      let d = c.base
        ? c.k === "weapon"
          ? Ca(o, c.r, c.base)
          : Js(o, c.r, c.base)
        : us(o, { type: c.k === "weapon" ? "weapon" : "gear", rarity: c.r, newChance: 0.95 });
      (Ss(d), l.push(d));
    }
    if (a.item)
      if (Lt() < 0.5) {
        let c = us(o, { minR: 1 + (Lt() < 0.3 ? 1 : 0) });
        (Ss(c), l.push(c));
      } else Ts(xi(o, { minT: 2 }));
    if (
      (a.flag && (e.flags[a.flag] = 1),
      ae.play("success"),
      ee("questDone", s, { xp: Math.round(r), credits: a.credits, items: l }),
      s.next)
    ) {
      let c = gi[s.next];
      c && (c.giver, s.giver);
    }
    return (x.player.recalc(), ee("quests"), ee("res"), !0);
  },
  bump(n, e = 1) {
    let t = x.S,
      i = !1;
    for (let [s, a] of Object.entries(t.quests.active)) {
      let r = ri(s, a);
      r.obj.forEach((o, l) => {
        (a.prog[l] || 0) >= o.n ||
          (n(o, r) &&
            ((a.prog[l] = Math.min(o.n, (a.prog[l] || 0) + e)),
            (i = !0),
            a.prog[l] >= o.n && ee("toast", `Objetivo completado: ${r.n}`, "quest")));
      });
    }
    i && ee("quests");
  },
  onKill(n) {
    let e = x.mode === "op" ? (x.op?.reg ?? -1) : x.map.regAt(n.x, n.z);
    (this.bump(
      (t) =>
        t.t === "kill" &&
        (t.reg === void 0 || t.reg === null || t.reg === e) &&
        (t.any ? !0 : t.e ? t.e === n.id : t.fam ? t.fam === n.fam : !1) &&
        (!t.elite || n.elite),
    ),
      n.ent && n.ent.k === "nest" && this.bump((t) => t.t === "nest" && (t.reg === void 0 || t.reg === n.ent.reg)),
      n.boss && !n.mini && !(n.arena && n.arena.op) && this.bump((t) => t.t === "boss" && t.b === n.id));
  },
  onQuestItem(n) {
    let e = x.S.quests.active[n.qid];
    if (!e) return;
    let t = ri(n.qid, e),
      i = t.obj[n.oi];
    i &&
      ((e.prog[n.oi] = Math.min(i.n, (e.prog[n.oi] || 0) + 1)),
      e.prog[n.oi] >= i.n && ee("toast", `Objetivo completado: ${t.n}`, "quest"),
      ee("quests"));
  },
  onHack(n) {
    let e = x.mode === "op" ? (x.op?.reg ?? -1) : n.reg;
    this.bump((t) => t.t === "hack" && (t.reg === void 0 || t.reg === e));
  },
  onOp() {
    this.bump((n) => n.t === "op");
  },
  onEvent() {
    this.bump((n) => n.t === "event");
  },
  onDatapad(n) {
    this.bump((e) => e.t === "datapad" && (e.reg === void 0 || e.reg === n));
  },
  onReach(n) {
    this.bump((e) => e.t === "reach" && e.poi === n);
  },
  onTalk(n) {
    let e = x.S,
      t = [];
    for (let [i, s] of Object.entries(e.quests.active)) {
      let a = ri(i, s);
      a.obj.forEach((r, o) => {
        r.t === "talk" && r.npc === n && (s.prog[o] || 0) < r.n && ((s.prog[o] = r.n), a.obj.length === 1 && t.push(i));
      });
    }
    for (let i of t) this.turnIn(i);
    return (this.refreshGather(), ee("quests"), t.length > 0);
  },
  refreshGather() {},
  onGather(n, e) {
    this.bump((t) => t.t === "gather" && t.mat === n, e);
  },
  readyAt(n) {
    let e = x.S;
    return Object.entries(e.quests.active)
      .filter(([t, i]) => ri(t, i).giver === n && this.complete(t, i))
      .map(([t]) => t);
  },
  objText(n, e) {
    let t = n.n,
      i = `${Math.min(e || 0, t)}/${t}`;
    switch (n.t) {
      case "kill":
        return `${n.any ? (n.elite ? "\xC9lites" : "Enemigos") : n.e ? gn[n.e].n : vr[n.fam] + "s"} abatidos${n.reg !== void 0 ? " (" + De[n.reg].n + ")" : ""}: ${i}`;
      case "boss":
        return `Derrota a ${En[n.b].n}: ${i}${bossGateText(n.b)}`; // 31g-bosses.js: requisitos de la guarida sellada
      case "collect":
        return `${n.item}: ${i}`;
      case "gather":
        return `${mn[n.mat].n}: ${i}`;
      case "reach":
        return `Llega a ${x.world?.map?.pois[n.poi]?.n || "la ubicaci\xF3n"}`;
      case "talk":
        return `Habla con ${zt[n.npc].n}`;
      case "hack":
        return `Terminales hackeadas${n.reg !== void 0 ? " (" + De[n.reg].n + ")" : ""}: ${i}`;
      case "nest":
        return `Nidos destruidos${n.reg !== void 0 ? " (" + De[n.reg].n + ")" : ""}: ${i}`;
      case "op":
        return `Operaciones completadas: ${i}`;
      case "event":
        return `Incidentes resueltos: ${i}`;
      case "datapad":
        return `Registros de datos (${De[n.reg].n}): ${i}`;
    }
    return "";
  },
  target(n, e) {
    let t = x.S,
      i = x.world;
    if (!i) return null;
    let s = ri(n, e);
    if (this.complete(n, e)) {
      let d = i.npcEnt(s.giver);
      return d ? { x: d.x, z: d.z, n: zt[s.giver].n } : null;
    }
    let a = s.obj.findIndex((d, h) => (e.prog[h] || 0) < d.n),
      r = s.obj[a];
    if (!r) return null;
    let o = i.map;
    if (r.t === "talk") {
      let d = i.npcEnt(r.npc);
      return d && { x: d.x, z: d.z, n: zt[r.npc].n };
    }
    if (r.t === "reach") {
      let d = o.pois[r.poi];
      return d && { x: d.x, z: d.z, n: d.n };
    }
    if (r.t === "boss") {
      let d = o.ents.find((h) => h.k === "bossarena" && h.boss === r.b);
      return d && { x: d.x, z: d.z, n: En[r.b].n };
    }
    let l = x.player,
      c = (d) => {
        let h = null,
          f = 1e9;
        for (let u of o.ents) {
          if (!d(u)) continue;
          let p = Le(u.x, u.z, l.x, l.z);
          p < f && ((f = p), (h = u));
        }
        return h;
      };
    if (r.t === "hack") {
      let d = c(
        (h) => h.k === "terminal" && (r.reg === void 0 || h.reg === r.reg) && !i.termDone(h) && i.unlockedReg(h.reg),
      );
      return d && { x: d.x, z: d.z, n: "Terminal" };
    }
    if (r.t === "datapad") {
      let d = c((h) => h.k === "datapad" && h.reg === r.reg && !t.world.dp[h.id]);
      return d && { x: d.x, z: d.z, n: "Registro de datos" };
    }
    if (r.t === "nest") {
      let d = c((h) => h.k === "nest" && (r.reg === void 0 || h.reg === r.reg) && !i.nestDead(h));
      return d && { x: d.x, z: d.z, n: "Nido" };
    }
    if (r.t === "op") {
      let d = c((h) => h.k === "breach" && i.unlockedReg(h.reg));
      return d && { x: d.x, z: d.z, n: "Brecha" };
    }
    if ((r.t === "kill" || r.t === "collect") && r.reg !== void 0 && r.reg !== x.regionId) {
      let d = o.ents.find((h) => h.k === "beacon" && h.reg === r.reg);
      return d && { x: d.x, z: d.z, n: De[r.reg].n };
    }
    return null;
  },
};


// ════════ [529] FunctionDeclaration Jd (100 bytes) ════════
function Jd() {
  let n = x.S,
    e = 0;
  for (let t = 1; t < De.length; t++) n.world.bosses["reg" + (t - 1)] && (e = t);
  return e;
}


// ════════ [530] ExpressionStatement ExpressionStatement (38 bytes) ════════
It("matGain", (n, e) => ht.onGather(n, e));


// ════════ [531] VariableDeclaration IE,Px,Lx,Ix,Zd,DE,OE,Ni (11881 bytes) ════════
var IE = [
    "\xABEl Carcelero\xBB",
    "\xABMadre de la Prole\xBB",
    "\xABRompehuesos\xBB",
    "\xABEl Vig\xEDa\xBB",
    "\xABQuijada\xBB",
    "\xABLa Plaga Gris\xBB",
    "\xABEl Topo\xBB",
    "\xABColmillo Viejo\xBB",
  ],
  Px = 5909034,
  Lx = 4646143,
  Ix = 16766023,
  Zd = 6280026,
  DE = 16724016,
  OE = 90 * 6e4,
  Ni = {
    st: null,
    clear() {
      (this.st && this.st.barrier && x.R.scene.remove(this.st.barrier), (this.st = null));
    },
    init(n, e) {
      this.clear();
      let t = e.ents.find((s) => s.k === "encounter");
      if (!t) return;
      let i = (this.st = {
        op: n,
        m: e,
        e: t,
        enc: t.enc,
        state: "idle",
        t: 0,
        lvl: n.lvl,
        tiles: new Set(t.tiles),
        pend: [],
        mine: [],
        targets: [],
        wave: 0,
        waves: 0,
        waveT: 0,
        plates: [],
        onPlate: -1,
        presses: 0,
        seq: [],
        seqI: 0,
        showT: 0,
        showI: 0,
        done: !1,
        failed: !1,
      });
      if (i.enc === "defend_civ") {
        let s = mt.enemyDmg(i.lvl) * 120;
        for (let a of e.ents.filter((r) => r.k === "civilian"))
          i.targets.push({ x: a.x, z: a.z, r: 0.45, hp: s, maxHp: s, ent: a, n: "Civil" });
        i.waves = 3 + (i.lvl >= 20 ? 1 : 0);
      } else if (i.enc === "defend_eq") {
        let s = e.ents.find((r) => r.k === "device"),
          a = mt.enemyDmg(i.lvl) * 260;
        (i.targets.push({ x: s.x, z: s.z, r: 0.9, hp: a, maxHp: a, ent: s, n: "Enlace" }),
          (i.dur = 75),
          (i.left = 75),
          (i.spawnT = 2));
      } else if (i.enc === "waves") i.waves = 3 + (i.lvl >= 15 ? 1 : 0) + (i.lvl >= 30 ? 1 : 0);
      else if (i.enc === "puzzle")
        if (
          ((i.mode = t.mode || "switch"),
          (i.plates = e.ents
            .filter((s) => s.k === "plate")
            .sort((s, a) => s.n - a.n)
            .map((s) => ({ e: s, on: !1, flash: 0, fc: 0 }))),
          i.mode === "switch")
        ) {
          for (let r of i.plates) r.on = !0;
          let s = 3 + (i.lvl > 20 ? 1 : 0),
            a = new Set();
          for (; a.size < s;) a.add(Rt(0, i.plates.length - 1));
          for (let r of a) this.toggle(r, !0);
          i.plates.every((r) => r.on) && this.toggle(0, !0);
        } else {
          let s = qe(3 + Math.floor(i.lvl / 12), 3, 6),
            a = -1;
          for (let r = 0; r < s; r++) {
            let o;
            do o = Rt(0, i.plates.length - 1);
            while (o === a);
            (i.seq.push(o), (a = o));
          }
        }
    },
    roomHas(n, e) {
      let t = this.st;
      return t && t.tiles.has(Math.floor(e) * t.m.w + Math.floor(n));
    },
    active() {
      return this.st && this.st.state === "active";
    },
    seal(n) {
      let e = this.st,
        t = e.m;
      if (n) {
        let i = new Ve();
        for (let s of e.e.seal) {
          t.ter[s] = F.GATE;
          let a = s % t.w,
            r = (s / t.w) | 0,
            o = new Ge(new kn(0.98, 1.8, 0.98), Me(16726586, 0.12, !0));
          (o.position.set(a + 0.5, 0.9, r + 0.5), i.add(o));
          for (let c = 0; c < 3; c++) {
            let d = new Ge(new kn(1, 0.04, 1), Me(16738906, 0.6, !0));
            (d.position.set(a + 0.5, 0.45 + c * 0.55, r + 0.5), i.add(d));
          }
          let l = new Ge(new kn(1.02, 0.06, 1.02), Me(16734810));
          (l.position.set(a + 0.5, 0.05, r + 0.5), i.add(l));
        }
        (x.R.scene.add(i), (e.barrier = i), ae.play("door"), x.R.addShake(0.25));
      } else {
        for (let i of e.e.seal) t.ter[i] === F.GATE && (t.ter[i] = t.floorT);
        (e.barrier && (x.R.scene.remove(e.barrier), (e.barrier = null)), ae.play("door"));
      }
      t._imgDirty = !0;
    },
    pool() {
      let n = this.st;
      return (De[n.op.reg] || De[0]).enemies
        .filter(
          (t) =>
            (t[2] || 0) <= n.lvl && !["nido", "torreta", "cristalino"].includes(t[0]) && gn[t[0]]?.ai !== "spawner",
        )
        .map((t) => ({ id: t[0], w: t[1] }));
    },
    spawnSpot(n = 6) {
      let e = this.st,
        t = x.player,
        i = e.e.tiles;
      for (let s = 0; s < 40; s++) {
        let a = i[Math.floor(Q() * i.length)],
          r = (a % e.m.w) + 0.5,
          o = ((a / e.m.w) | 0) + 0.5;
        if (
          !(Le(r, o, t.x, t.z) < n || e.m.circleHits(r, o, 0.6)) &&
          !e.targets.some((l) => l.hp > 0 && Le(r, o, l.x, l.z) < 5)
        )
          return [r, o];
      }
      return null;
    },
    queue(n, e = {}) {
      let t = this.st,
        i = this.pool();
      if (!i.length) return;
      let s = Math.min(n, 2 + Math.floor(Q() * 2));
      for (let a = 0; a < s; a++) {
        let r = this.spawnSpot(e.minD ?? 6);
        if (!r) continue;
        (x.fx.telegraph(r[0], r[1], 1.6, 1.1, 16728096),
          x.fx.burst(r[0], 0.3, r[1], 12, { color: 16736304, speed: 2, life: 0.8, size: 0.3, up: 1 }));
        let o = Math.ceil(n / s) - (a === s - 1 ? s * Math.ceil(n / s) - n : 0);
        for (let l = 0; l < o; l++)
          t.pend.push({ t: 1.1, x: r[0], z: r[1], id: ii(i).id, elite: e.elite && a === 0 && l === 0 });
      }
    },
    flushPend(n) {
      let e = this.st;
      for (let t = e.pend.length - 1; t >= 0; t--) {
        let i = e.pend[t];
        if (((i.t -= n), i.t > 0)) continue;
        if ((e.pend.splice(t, 1), i.boss)) {
          let o = In(i.boss, e.lvl + 1, i.x, i.z, {
            boss: !0,
            mini: !0,
            hpMul: 0.22,
            alerted: !0,
            name: "V\xE1stago: " + En[i.boss].n,
          });
          ((o.title = "Minijefe"), (e.boss = o), x.fx.explosion(i.x, i.z, 2.5, 16728096), x.R.addShake(0.5));
          continue;
        }
        if (i.champ) {
          let o = In(e.champ.id, e.lvl + 1, i.x, i.z, {
            mods: aa(e.lvl + 20, 1)
              .concat(["gigante"])
              .slice(0, 3),
            champion: !0,
            name: e.champ.name,
            persist: !0,
            alerted: !0,
          });
          ((e.boss = o),
            x.fx.explosion(i.x, i.z, 2.5, 16728096),
            x.R.addShake(0.5),
            this.queue(2 + (e.lvl > 20 ? 1 : 0), { minD: 3 }));
          continue;
        }
        let [s, a] = e.m.findFree(i.x + (Q() - 0.5) * 2, i.z + (Q() - 0.5) * 2, 3, 0.4),
          r = In(i.id, e.lvl, s, a, {
            alerted: !0,
            persist: !0,
            mods: i.elite ? aa(e.lvl, 1) : [],
            siege: e.targets.length ? { targets: e.targets } : null,
          });
        ((r.encE = !0), e.mine.push(r));
      }
    },
    aliveMine() {
      let n = 0;
      for (let e of this.st.mine) e.dead || n++;
      return n + this.st.pend.length;
    },
    update(n) {
      let e = this.st;
      if (!e) return;
      let t = x.player;
      ((e.t += n), this.flushPend(n));
      for (let s of e.targets) s.hitT > 0 && (s.hitT -= n);
      if ((this.updatePlates(n), e.state === "idle")) {
        this.roomHas(t.x, t.z) &&
          !e.e.seal.some((s) => Le((s % e.m.w) + 0.5, ((s / e.m.w) | 0) + 0.5, t.x, t.z) < 2.2) &&
          this.start();
        return;
      }
      if (e.state !== "active") return;
      let i = e.enc;
      if (i === "miniboss") {
        if (e.boss && e.boss.dead) this.finish(!0);
        else if (e.boss && !this.roomHas(e.boss.x, e.boss.z)) {
          let [s, a] = e.m.findFree(e.e.x, e.e.z, 4, e.boss.rad);
          ((e.boss.x = s), (e.boss.z = a));
        }
      } else if (i === "waves" || i === "defend_civ") {
        e.waveT += n;
        let s = this.aliveMine();
        if ((i === "defend_civ" && this.checkTargets(), e.failed)) return;
        e.wave < e.waves && (e.wave === 0 ? e.waveT > 1.5 : (s <= 1 && e.waveT > 4) || (e.waveT > 32 && s < 6))
          ? this.nextWave()
          : e.wave >= e.waves && s === 0 && e.pend.length === 0 && this.finish(!0);
      } else if (i === "defend_eq") {
        if ((this.checkTargets(), e.failed)) return;
        ((e.left -= n),
          (e.spawnT -= n),
          e.spawnT <= 0 &&
            e.left > 6 &&
            ((e.spawnT = 6.5 - Math.min(2.5, (e.dur - e.left) / 30)),
            this.aliveMine() < 12 && this.queue(Rt(2, 4) + (e.lvl > 25 ? 1 : 0), { elite: Q() < 0.15 })));
        let s = e.targets[0];
        if (
          (s && Q() < n * 6 && x.fx.burst(s.x, 2.2, s.z, 1, { color: 4646143, speed: 1, life: 0.6, size: 0.18, up: 1 }),
          e.left <= 0)
        ) {
          for (let a of e.mine) a.siege = null;
          this.finish(!0);
        }
      } else i === "puzzle" && e.mode === "sequence" && this.updateSequence(n);
    },
    start() {
      let n = this.st;
      ((n.state = "active"), (n.t = 0));
      let e = Ha[n.enc];
      if ((ee("banner", e.n.toUpperCase(), e.d), n.enc !== "puzzle" && this.seal(!0), n.enc === "miniboss"))
        if (Q() < 0.6) {
          let i = Object.entries(En)
              .filter(([a, r]) => !r.secret && a !== "mente")
              .map(([a]) => a),
            s = i[qe(Math.floor(n.lvl / 6) + Rt(-1, 0), 0, i.length - 1)];
          (ee("bossIntro", { ...En[s], id: s, n: "V\xE1stago: " + En[s].n, title: "Minijefe" }),
            ae.play("roar"),
            n.pend.push({ t: 1.4, x: n.e.x, z: n.e.z, boss: s }));
        } else {
          let i = this.pool()
              .filter((r) => !gn[r.id].fly)
              .sort((r, o) => gn[o.id].hp - gn[r.id].hp),
            s = (i[Math.floor(Q() * Math.min(3, i.length))] || { id: "bruto" }).id,
            a = Yt(IE);
          ((n.champ = { id: s, name: a }),
            ee("banner", a, `${gn[s].n} campe\xF3n`, "#ff7a50"),
            ae.play("roar"),
            n.pend.push({ t: 1.2, x: n.e.x, z: n.e.z, champ: !0 }));
        }
      else
        n.enc === "waves"
          ? ee("toast", `Resiste ${n.waves} oleadas`, "warn")
          : n.enc === "defend_civ"
            ? ee("toast", "Los hostiles van a por los civiles: \xA1que no caigan!", "warn")
            : n.enc === "defend_eq"
              ? (ee("toast", "Enlace activado: defi\xE9ndelo hasta completar la transmisi\xF3n", "warn"),
                ae.play("beep", { p: 0.7 }))
              : n.enc === "puzzle" &&
                (ee(
                  "toast",
                  n.mode === "switch"
                    ? "Pisa las placas: cada una alterna su estado y el de sus vecinas. Enci\xE9ndelas todas."
                    : "Observa la secuencia del pilar y pisa las placas en el mismo orden.",
                  "quest",
                ),
                this.queue(2 + (n.lvl > 15 ? 1 : 0), { minD: 7 }),
                n.mode === "sequence" && ((n.phase = "show"), (n.showT = 1.6), (n.showI = 0)));
    },
    nextWave() {
      let n = this.st;
      (n.wave++, (n.waveT = 0));
      let e = Math.min(12, 3 + n.wave * 2 + (n.lvl > 25 ? 1 : 0));
      (this.queue(e, { elite: n.wave === n.waves || (n.wave > 1 && Q() < 0.3) }),
        ee("banner", `OLEADA ${n.wave}/${n.waves}`, n.wave === n.waves ? "\xDAltima oleada" : "", "#ffb340"),
        ae.play("alarm"));
    },
    checkTargets() {
      let n = this.st;
      for (let e of n.targets)
        if (e.hp <= 0 && !e.down) {
          ((e.down = !0), x.fx.explosion(e.x, e.z, 1.2, 16728096));
          let t = x.world.rt.get(e.ent.id);
          (t && x.world.removeMesh(t),
            ee("toast", n.enc === "defend_civ" ? "Un civil ha ca\xEDdo" : "El enlace ha sido destruido", "bad"),
            ae.play("err"));
        }
      if (n.targets.every((e) => e.hp <= 0)) {
        for (let e of n.mine) e.siege = null;
        this.finish(!1);
      }
    },
    toggle(n, e) {
      let t = this.st,
        i = t.plates.length;
      for (let s of [n - 1, n, n + 1]) {
        let a = t.plates[(s + i) % i];
        ((a.on = !a.on), e || ((a.flash = 0.25), (a.fc = a.on ? Lx : Px)));
      }
    },
    updatePlates(n) {
      let e = this.st;
      if (!e.plates.length) return;
      let t = x.player,
        i = -1;
      e.plates.forEach((a, r) => {
        Le(a.e.x, a.e.z, t.x, t.z) < 0.75 && (i = r);
      });
      let s = i >= 0 && i !== e.onPlate ? i : -1;
      if (((e.onPlate = i), s >= 0 && e.state === "active" && !e.done)) {
        if ((ae.play("beep", { p: 0.8 + s * 0.1 }), e.mode === "switch"))
          (this.toggle(s),
            e.presses++,
            e.plates.every((a) => a.on)
              ? this.finish(!0)
              : e.presses % 9 === 0 &&
                (this.queue(2 + (e.lvl > 15 ? 1 : 0), { minD: 6 }),
                ee("toast", "El mecanismo despierta a los guardianes", "warn")));
        else if (e.phase === "input")
          if (s === e.seq[e.seqI]) {
            let a = e.plates[s];
            ((a.flash = 0.4), (a.fc = Zd), e.seqI++, e.seqI >= e.seq.length && this.finish(!0));
          } else {
            for (let a of e.plates) ((a.flash = 0.8), (a.fc = DE));
            (ae.play("alarm"),
              ee("toast", "Secuencia incorrecta: el pilar convoca guardianes", "bad"),
              this.queue(3 + (e.lvl > 20 ? 1 : 0), { minD: 5 }),
              (e.phase = "show"),
              (e.showT = 3.5),
              (e.showI = 0),
              (e.seqI = 0));
          }
      }
      for (let a of e.plates) {
        a.flash > 0 && (a.flash -= n);
        let o = x.world.rt.get(a.e.id)?.mesh?.userData;
        if (!o || !o.top) continue;
        let l = e.mode === "switch" ? (a.on ? Lx : Px) : e.done ? Zd : 2767434;
        (a.flash > 0 && (l = a.fc),
          o._c !== l && ((o._c = l), (o.top.material = Me(l)), o.ring.material.color.setHex(l)),
          (o.ring.material.opacity = a.flash > 0 ? 0.9 : e.mode === "switch" && a.on ? 0.55 : 0.15));
      }
    },
    updateSequence(n) {
      let e = this.st,
        i = x.world.rt.get("pylon")?.mesh?.userData;
      if (e.phase === "show") {
        if (((e.showT -= n), i && (i.core.material = Me(16766023)), e.showT <= 0))
          if (e.showI < e.seq.length) {
            let s = e.plates[e.seq[e.showI]];
            ((s.flash = 0.55),
              (s.fc = Ix),
              ae.play("beep", { p: 0.8 + e.seq[e.showI] * 0.1 }),
              x.fx.beam(e.e.x, 2.9, e.e.z, s.e.x, 0.2, s.e.z, Ix, 0.08, 0.35),
              e.showI++,
              (e.showT = 0.8));
          } else ((e.phase = "input"), (e.seqI = 0), ee("toast", "Tu turno: repite la secuencia", "quest"));
      } else i && (i.core.material = Me(e.done ? Zd : 9075455));
    },
    finish(n) {
      let e = this.st;
      if (e.done || e.failed) return;
      let t = x.S,
        i = x.player,
        s = x.world,
        a = e.m;
      if ((e.enc !== "puzzle" && this.seal(!1), !n)) {
        ((e.failed = !0),
          (e.state = "over"),
          (t.world.subs[e.op.ent.id] = gnow() - OE + 5 * 6e4),
          ee("banner", "MISI\xD3N FALLIDA", "Vuelve a intentarlo m\xE1s tarde", "#ff4f5e"),
          ee("save", !0));
        return;
      }
      ((e.done = !0), (e.state = "over"), (t.world.subs[e.op.ent.id] = gnow()), ae.play("success"));
      let r = e.targets.filter((d) => d.hp > 0).length,
        o =
          {
            miniboss: 3,
            waves: e.waves >= 5 ? 3 : 2,
            defend_civ: r >= 3 ? 3 : 2,
            defend_eq: (e.targets[0]?.hp || 0) > e.targets[0]?.maxHp * 0.5 ? 3 : 2,
            puzzle: 3,
          }[e.enc] || 2;
      if (e.enc === "puzzle") {
        let d = a.ents.find((h) => h.k === "vault");
        if (d) {
          for (let h of d.tiles) a.ter[h] = a.floorT;
          (s.mesh.openSecret(d.id), (a._imgDirty = !0));
        }
        for (let h of e.plates) ((h.flash = 1.2), (h.fc = Zd));
      } else {
        let [d, h] = a.findFree(e.e.x, e.e.z + 1.5, 4, 0.6),
          f = { k: "chest", id: "enc_chest", x: d, z: h, tier: o, temp: !0 };
        (a.ents.push(f),
          (a.blk[a.idx(Math.floor(d), Math.floor(h))] = 1),
          s.check(!0),
          x.fx.ring(d, h, 3, 16766023, 0.7),
          x.fx.burst(d, 1, h, 30, { color: 16766023, speed: 4, life: 0.8, size: 0.25, up: 1 }));
      }
      let l = Math.round(mt.xpToNext(t.lvl) * (e.enc === "miniboss" ? 0.12 : 0.09)),
        c = Math.round(35 * (1 + e.lvl * 0.3) * (1 + (i.st.credits || 0)));
      (i.addXp(l), (t.credits += c), (t.mats.core = (t.mats.core || 0) + (e.enc === "miniboss" ? 2 : 1)));
      {
        let [d, h] = a.findFree(e.e.x - 1.5, e.e.z + 1.5, 4, 0.4);
        Nt("chip", d, h, { chip: xi(e.lvl, { minT: e.enc === "miniboss" ? 2 : 1 }), life: 300 });
      }
      (ee("toast", `Zona despejada \xB7 +${l} XP \xB7 +${c} \xA4`, "good"),
        ee(
          "banner",
          "ZONA DESPEJADA",
          e.enc === "puzzle" ? "La c\xE1mara se ha abierto" : "Recoge la recompensa y vuelve a la superficie",
          "#5fd35a",
        ),
        ht.onEvent(),
        ee("save", !0));
    },
    status() {
      let n = this.st;
      if (!n) return null;
      let e = Ha[n.enc],
        t = [];
      return (
        n.done
          ? t.push({ t: "Completado \xB7 vuelve a las escaleras", ok: !0 })
          : n.failed
            ? t.push({ t: "Fallido", bad: !0 })
            : n.state === "idle"
              ? t.push({ t: "Explora y entra en la sala principal" })
              : n.enc === "miniboss"
                ? t.push({ t: n.boss ? `Abate a ${n.boss.name || n.boss.def.n}` : "Algo se acerca\u2026" })
                : n.enc === "waves"
                  ? t.push({ t: `Oleada ${n.wave}/${n.waves} \xB7 hostiles: ${this.aliveMine()}` })
                  : n.enc === "defend_civ"
                    ? (t.push({ t: `Oleada ${n.wave}/${n.waves}` }),
                      t.push({ t: `Civiles a salvo: ${n.targets.filter((i) => i.hp > 0).length}/${n.targets.length}` }))
                    : n.enc === "defend_eq"
                      ? (t.push({ t: `Transmisi\xF3n: ${Math.round((1 - n.left / n.dur) * 100)} %` }),
                        t.push({
                          t: `Integridad del enlace: ${Math.max(0, Math.round((n.targets[0].hp / n.targets[0].maxHp) * 100))} %`,
                        }))
                      : n.enc === "puzzle" &&
                        t.push({
                          t:
                            n.mode === "switch"
                              ? `Enciende todas las placas (${n.plates.filter((i) => i.on).length}/${n.plates.length})`
                              : n.phase === "show"
                                ? "Observa la secuencia del pilar\u2026"
                                : `Repite la secuencia (${n.seqI}/${n.seq.length})`,
                        }),
        { title: `${Fd[n.op.ent.kind] || "Zona"} \xB7 ${e.n}`, c: e.c, lines: t }
      );
    },
    target() {
      let n = this.st;
      if (!n) return null;
      if (n.done || n.failed) {
        let e = n.m.ents.find((t) => t.k === "exit");
        return e && { x: e.x, z: e.z, n: "Salida", c: "#5fd35a" };
      }
      return n.state === "idle" ? { x: n.e.x, z: n.e.z, n: Ha[n.enc].n, c: Ha[n.enc].c } : null;
    },
  };


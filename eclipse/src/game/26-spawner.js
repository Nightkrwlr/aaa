// 26-spawner.js — Director de aparición

// ════════ [630] VariableDeclaration HE,GE,xn (6137 bytes) ════════
var HE = {
    swarm: [4, 7],
    chase: [3, 5],
    ranged: [2, 3],
    charger: [1, 2],
    leaper: [2, 4],
    exploder: [2, 4],
    flyer: [3, 5],
    phaser: [2, 3],
    burrower: [1, 3],
    shadow: [2, 3],
    healer: [1, 1],
    sniper: [1, 2],
    mortar: [1, 2],
    shielder: [1, 1],
  },
  GE = [
    "Garra Negra",
    "El Destripador",
    "Viejo Tuerto",
    "Colmillo de Acero",
    "La Viuda",
    "Carro\xF1ero Rey",
    "Ojo Rojo",
    "El Silencioso",
    "Mand\xEDbula",
    "Sangre Fr\xEDa",
  ],
  xn = {
    t: 1,
    evT: 150,
    event: null,
    depl: new Map(),
    reset() {
      ((this.t = 1), (this.event = null), (this.evT = 120 + Q() * 120), this.depl.clear());
    },
    cellOf(n, e) {
      return Math.floor(n / 24) + Math.floor(e / 24) * 1e3;
    },
    update(n) {
      if (x.mode !== "world") return;
      let e = x.player,
        t = x.world;
      for (let i of x.enemies)
        !i.dead &&
          !i.persist &&
          !i.boss &&
          !i.eventE &&
          Le(i.x, i.z, e.x, e.z) > 46 &&
          ((i.dead = !0), (i.deadT = 0), i.parent && i.parent.children--);
      if (((this.t -= n), this.t <= 0)) {
        ((this.t = 1.1), (this.packCd = (this.packCd || 0) - 1.1));
        for (let [i, s] of this.depl) {
          let a = s - 0.03666666666666667;
          a <= 0 ? this.depl.delete(i) : this.depl.set(i, a);
        }
        if (!x.inSafe && !t.inBase()) {
          let i = x.regionId,
            s = 0;
          for (let r of x.enemies) !r.dead && !r.static && Le(r.x, r.z, e.x, e.z) < 48 && s++;
          let a = Math.round(BE[i] * (1 + x.night * 0.3) * (this.event ? 0.5 : 1));
          s < a && this.packCd <= 0 && Jx() < Kx - 4 && this.spawnPack(i).length && (this.packCd = 6 + Q() * 4);
        }
      }
      this.updateEvents(n);
    },
    spawnPack(n, e, t = {}) {
      let i = x.player,
        s = x.world,
        a = x.map,
        r = De[n];
      for (let o = 0; o < 10; o++) {
        let l = Q() * 6.28,
          c = e ? 2 + Q() * 4 : 17 + Q() * 8,
          d = (e ? e.x : i.x) + Math.cos(l) * c,
          h = (e ? e.z : i.z) + Math.sin(l) * c;
        if (a.circleHits(d, h, 0.6) || a.regAt(d, h) !== n || s.safeAt(d, h) || (!e && a.darkAt(d, h) && Q() < 0.7))
          continue;
        let f = !e && !t.event;
        if (f && (this.depl.get(this.cellOf(d, h)) || 0) >= 8) continue;
        let u = t.lvl ?? s.lvlAt(d, h),
          p = r.enemies.filter((S) => (S[2] || 0) <= u).map((S) => ({ id: S[0], w: S[1] }));
        x.night > 0.5 && u >= 8 && p.push({ id: "sombra", w: 2 });
        let m = ii(p).id,
          g = gn[m],
          [b, y] = HE[g.ai] || [2, 4],
          v = Math.round(Rt(b, y) * (t.mul || 1)),
          _ = x.cfg.econ.diff.eliteWorld + x.night * 0.03 + (t.elite || 0),
          A = Q() < _ ? 0 : -1,
          T = [];
        for (let S = 0; S < v; S++) {
          let [k, w] = a.findFree(d + (Q() - 0.5) * 2.5, h + (Q() - 0.5) * 2.5, 3, 0.4),
            E = In(m, u, k, w, { mods: S === A ? aa(u, 1) : [], alerted: !!t.alerted });
          (t.event && (E.eventE = !0), T.push(E));
        }
        if (!t.noMix && Q() < 0.3 && p.length > 1) {
          let S = ii(p).id,
            k = gn[S];
          for (let w = 0; w < Rt(1, 2); w++) {
            let [E, H] = a.findFree(d + (Q() - 0.5) * 3, h + (Q() - 0.5) * 3, 3, 0.4),
              Z = In(S, u, E, H, { alerted: !!t.alerted });
            (t.event && (Z.eventE = !0), T.push(Z));
          }
        }
        if (f) {
          let S = this.cellOf(d, h);
          this.depl.set(S, (this.depl.get(S) || 0) + T.length);
        }
        return T;
      }
      return [];
    },
    updateEvents(n) {
      let e = x.player,
        t = x.world;
      if (this.event) {
        let s = this.event;
        if (((s.t -= n), s.type === "horde")) {
          s.spawnT -= n;
          let a = x.enemies.filter((r) => r.eventE && !r.dead).length;
          if (
            (s.t > 0 &&
              s.spawnT <= 0 &&
              (s.waves || 0) < 5 &&
              a < 12 &&
              Jx() < Kx &&
              ((s.spawnT = 8),
              (s.waves = (s.waves || 0) + 1),
              this.spawnPack(x.regionId, null, { alerted: !0, event: !0 })),
            s.t <= 0)
          )
            if (x.enemies.some((o) => o.eventE && !o.dead)) {
              if (s.t < -40) {
                this.finishEvent(!1);
                return;
              }
            } else {
              this.finishEvent(!0);
              return;
            }
          if (Le(e.x, e.z, s.x, s.z) > 40) {
            this.finishEvent(!1);
            return;
          }
        } else if (s.type === "supply") {
          let a = t.rt.get(s.ent.id);
          (a && a.used ? this.finishEvent(!0) : s.t <= 0 && this.finishEvent(!1),
            !s.guarded &&
              Le(e.x, e.z, s.x, s.z) < 14 &&
              ((s.guarded = !0),
              this.spawnPack(x.map.regAt(s.x, s.z), { x: s.x, z: s.z }, { alerted: !0, event: !0, elite: 0.5 })));
        } else if (s.type === "hunt")
          s.target.dead
            ? this.finishEvent(!0)
            : s.t <= 0 || Le(e.x, e.z, s.target.x, s.target.z) > 70
              ? ((s.target.dead = !0), (s.target.deadT = 0), this.finishEvent(!1))
              : ((s.x = s.target.x), (s.z = s.target.z));
        else if (s.type === "meteor")
          if (!s.landed) ((s.fall -= n), s.fall <= 0 && this.meteorLand(s));
          else {
            let a = t.rt.get(s.ent.id);
            ((a && a.used) || s.t <= 0) && this.finishEvent(!!(a && a.used));
          }
        return;
      }
      if (x.inSafe || t.inBase() || x.bossActive || ((this.evT -= n), this.evT > 0)) return;
      this.evT = x.cfg.econ.diff.eventT[0] + Q() * x.cfg.econ.diff.eventT[1];
      let i = Yt(["supply", "horde", "hunt", "meteor"]);
      this.startEvent(i);
    },
    findSpot(n, e) {
      let t = x.player,
        i = x.map,
        s = x.world;
      for (let a = 0; a < 30; a++) {
        let r = Q() * 6.28,
          o = n + Q() * (e - n),
          l = t.x + Math.cos(r) * o,
          c = t.z + Math.sin(r) * o;
        if (!(i.circleHits(l, c, 1.2) || i.regAt(l, c) !== x.regionId || s.safeAt(l, c) || i.darkAt(l, c)))
          return [l, c];
      }
      return null;
    },
    startEvent(n) {
      let e = x.player,
        t = x.world,
        i = x.map;
      if (n === "horde")
        ((this.event = {
          type: n,
          t: 40,
          spawnT: 0,
          waves: 0,
          x: e.x,
          z: e.z,
          n: "\xA1Horda entrante!",
          d: "Sobrevive 45 segundos y acaba con todos",
        }),
          ae.play("alarm"),
          ee("banner", "\xA1HORDA ENTRANTE!", "Sobrevive y elimina a todos los hostiles"));
      else if (n === "supply") {
        let s = this.findSpot(18, 30);
        if (!s) return;
        let a = { k: "supply", id: "ev_supply_" + Date.now(), x: s[0], z: s[1], temp: !0, tier: 2 };
        (i.ents.push(a),
          t.check(!0),
          (this.event = {
            type: n,
            t: 150,
            x: s[0],
            z: s[1],
            ent: a,
            n: "Lanzamiento de suministros",
            d: "Recupera la caja antes de que la tomen",
          }),
          x.fx.telegraph(s[0], s[1], 2, 2, 4259712),
          setTimeout(() => {
            x.fx.explosion(s[0], s[1], 1.5, 8454064);
          }, 1200),
          ee("banner", "LANZAMIENTO DE SUMINISTROS", "Marcado en tu mapa"));
      } else if (n === "hunt") {
        let s = this.findSpot(24, 34);
        if (!s) return;
        let a = Math.min(De[x.regionId].lvl[1] + 2, t.lvlAt(s[0], s[1]) + 2),
          r = De[x.regionId].enemies.filter((c) => (c[2] || 0) <= a && !["avispa", "larva", "rastrero"].includes(c[0])),
          o = Yt(r)[0],
          l = In(o, a, s[0], s[1], {
            mods: aa(a + 20, 1)
              .concat(["gigante"])
              .slice(0, 3),
            champion: !0,
            name: `\xAB${Yt(GE)}\xBB`,
            persist: !0,
          });
        ((l.eventE = !0),
          (this.event = {
            type: n,
            t: 240,
            x: s[0],
            z: s[1],
            target: l,
            n: "Objetivo prioritario",
            d: `Abate a ${l.name}`,
          }),
          ee("banner", "OBJETIVO PRIORITARIO", `${l.name} ha sido avistado`));
      } else if (n === "meteor") {
        let s = this.findSpot(16, 26);
        if (!s) return;
        ((this.event = {
          type: n,
          t: 120,
          x: s[0],
          z: s[1],
          fall: 3,
          landed: !1,
          n: "Impacto de meteorito",
          d: "Extrae los cristales xeno",
        }),
          x.fx.telegraph(s[0], s[1], 4, 3, 12610559),
          ee("banner", "IMPACTO INMINENTE", "Un meteorito xeno est\xE1 cayendo"));
      }
    },
    meteorLand(n) {
      let e = x.world,
        t = x.map;
      ((n.landed = !0), x.fx.explosion(n.x, n.z, 4, 12610559), x.R.addShake(0.8), ae.play("boom"));
      let i = x.player;
      Le(i.x, i.z, n.x, n.z) < 4 && i.hurt(i.maxHp * 0.25);
      let s = { k: "crystal", id: "ev_cry_" + Date.now(), x: n.x, z: n.z, temp: !0, reg: x.regionId };
      (t.ents.push(s),
        e.check(!0),
        (n.ent = s),
        this.spawnPack(t.regAt(n.x, n.z), { x: n.x, z: n.z }, { alerted: !0, event: !0, elite: 0.6, mul: 1.3 }));
    },
    finishEvent(n) {
      let e = this.event;
      this.event = null;
      let t = x.world,
        i = x.map;
      if (e.ent) {
        let s = i.ents.indexOf(e.ent);
        s >= 0 && i.ents.splice(s, 1);
        let a = t.rt.get(e.ent.id);
        a && (t.removeMesh(a), t.rt.delete(e.ent.id));
      }
      for (let s of x.enemies) s.eventE && !n && !s.dead && (s.eventE = !1);
      n &&
        (ee("toast", `Evento completado: ${e.n}`, "good"),
        e.type !== "supply" && ht.onEvent(),
        (e.type === "horde" || e.type === "hunt") &&
          Co(x.player.x, x.player.z + 1, 2, t.lvlAt(x.player.x, x.player.z)));
    },
    clearEvent() {
      this.event && this.finishEvent(!1);
    },
  };


// ════════ [631] VariableDeclaration VE,qE,Fi,yr,Zx,Po,ih (28691 bytes) ════════
var VE = 42,
  qE = 52,
  Fi = {
    crate: 60 * 6e4,
    crystal: 75 * 6e4,
    nest: 35 * 6e4,
    shrine: 25 * 6e4,
    boss: 30 * 6e4,
    chest: 120 * 6e4,
    lock: 120 * 6e4,
    relay: 45 * 6e4,
    pack: 15 * 6e4,
    sub: 90 * 6e4,
  },
  yr = null,
  Zx = null,
  Po = null,
  ih = class {
    constructor() {
      ((this.rt = new Map()), (this.checkT = 0), (this.fogT = 0), (this.lights = []));
      for (let e = 0; e < 4; e++) {
        let t = new $s(16769200, 0, 12, 1.6);
        (x.R.scene.add(t), this.lights.push(t));
      }
      this.alarmT = 0;
    }
    loadWorld(e) {
      Po || (Po = vx());
      let t = Po;
      (this.unload(), (x.mode = "world"), (x.op = null), (x.map = t), (this.map = t));
      let i = x.S;
      for (let r of t.gates) for (let o of r.tiles) t.ter[o] = i.world.gates[r.id] ? F.ROAD : F.GATE;
      for (let r of t.ents)
        if (r.k === "terminal" && r.eff === "secret")
          for (let o of r.tiles) t.ter[o] = i.world.secrets[r.id] ? F.FLOOR : F.SECRET;
      (yr && Zx === i && yr.map === t
        ? (this.mesh = yr)
        : (yr && yr.dispose(), (this.mesh = yr = new Ul(t, x.R)), (Zx = i)),
        cf(t));
      for (let r of t.ents)
        r.k === "terminal" && r.eff === "secret" && i.world.secrets[r.id] && this.mesh.setSecretOpen(r.id);
      (x.R.scene.add(this.mesh.group), (x.mesh = this.mesh), (this.gateMeshes = new Map()));
      for (let r of t.gates) {
        if (i.world.gates[r.id]) continue;
        let o = Hg(r, t);
        (x.R.scene.add(o), this.gateMeshes.set(r.id, o));
      }
      ((this.fogW = Math.ceil(t.w / 2)),
        (this.fogOwner = i),
        (this.fogBits = i.fog
          ? Yx(i.fog, Math.ceil((this.fogW * this.fogW) / 8))
          : new Uint8Array(Math.ceil((this.fogW * this.fogW) / 8))));
      let s = x.player,
        a = e || i.pos;
      if ((a || (a = { x: t.spawnBase[0], z: t.spawnBase[1] }), t.circleHits(a.x, a.z, s.r))) {
        let r = t.findFree(a.x, a.z, 10, s.r);
        a = { x: r[0], z: r[1] };
      }
      ((s.x = a.x),
        (s.z = a.z),
        (s.vx = s.vz = 0),
        x.R.target.set(s.x, 0, s.z),
        (this.regionCur = -1),
        this.updateRegion(!0),
        this.check(!0));
    }
    loadOp(e) {
      let t = x.S;
      ((t.pos = { x: x.player.x, z: x.player.z }), (this.returnPos = { x: x.player.x, z: x.player.z }), this.unload());
      let i = e.sub ? _x(e) : yx(e);
      ((x.mode = "op"),
        (x.op = e),
        (e.kills = 0),
        (e.hacked = 0),
        (e.freed = 0),
        (e.done = !1),
        (e.spawnedTotal = 0),
        (e.t = 0),
        (e.nestsLeft = i.ents.filter((r) => r.k === "nest").length),
        (e.totalEnemies = i.ents.filter((r) => r.k === "spawnpack").reduce((r, o) => r + (o.size || 3), 0)),
        (e.killGoal = Math.min(45, Math.ceil(e.totalEnemies * 0.7))),
        (x.map = i),
        (this.map = i),
        (this.mesh = new Ul(i, x.R)),
        cf(i),
        x.R.scene.add(this.mesh.group),
        (x.mesh = this.mesh),
        (this.gateMeshes = new Map()));
      let s = x.player;
      ((s.x = i.spawnBase[0]), (s.z = i.spawnBase[1]), (s.vx = s.vz = 0), x.R.target.set(s.x, 0, s.z));
      let a = i.themeObj || Zi[e.theme];
      (x.R.setRegionEnv(
        {
          sky: a.outdoor ? a.sky : tt(a.sky, 9082532, 0.3),
          hemiG: a.fog,
          sun: 16773344,
          fog: a.fog,
          sunI: a.outdoor ? 1.6 : e.sub ? (e.ent.kind === "upper" ? 1.2 : 0.9) : 0.85,
        },
        !0,
      ),
        bo.setKey("op"),
        (x.regionId = e.reg ?? 0),
        e.sub && Ni.init(e, i),
        this.check(!0),
        e.sub
          ? ee("banner", Fd[e.ent.kind] || a.n, `${Ha[e.enc].n} \xB7 Nivel ${e.lvl}`)
          : ee("banner", Zi[e.theme].n, `${pr[e.obj].n} \xB7 Nivel ${e.lvl}`));
    }
    unload() {
      (x.mode === "world" && this.fogBits && this.fogOwner === x.S && (x.S.fog = Pp(this.fogBits)),
        xn.clearEvent(),
        Ni.clear(),
        Rx(),
        Ax(),
        (x.projs.length = 0),
        (x.hazards.length = 0),
        x.fx.clear());
      for (let e of this.rt.values()) this.removeMesh(e);
      if (
        (this.rt.clear(),
        this.mesh && (x.R.scene.remove(this.mesh.group), this.mesh !== yr && this.mesh.dispose()),
        this.gateMeshes)
      )
        for (let e of this.gateMeshes.values()) x.R.scene.remove(e);
      this.mesh = null;
    }
    unlockedReg(e) {
      return e === void 0 || e === 0 ? !0 : !!x.S.world.gates[`gate_${e - 1}_${e}`];
    }
    termDone(e) {
      let i = x.S.world.term[e.id];
      return x.mode === "op"
        ? !!this.rt.get(e.id)?.done
        : i
          ? e.eff === "relay"
            ? gnow() - i < Fi.relay
            : e.eff === "boss"
              ? gnow() - i < 30 * 6e4
              : e.eff === "cache"
                ? gnow() - i < Fi.lock
                : !0
          : !1;
    }
    nestDead(e) {
      if (x.mode === "op") return !!this.rt.get(e.id)?.dead;
      let t = x.S.world.nests[e.id];
      return t && gnow() - t < Fi.nest;
    }
    npcEnt(e) {
      return this.map.ents.find((t) => t.k === "npc" && t.npc === e) || (x.mode === "op" && Po, null);
    }
    bossDown(e) {
      return !!x.S.world.bosses["reg" + e];
    }
    lvlAt(e, t) {
      let i = this.map.regAt(e, t),
        s = De[i],
        a = this.map.ents.find((o) => o.k === "beacon" && o.reg === i),
        r = a ? Le(a.x, a.z, e, t) : 30;
      return qe(
        Math.round(s.lvl[0] + (s.lvl[1] - s.lvl[0]) * qe(r / (qt * 0.45), 0, 1) + (Q() < 0.3 ? 1 : 0)),
        s.lvl[0],
        s.lvl[1],
      );
    }
    updateRegion(e) {
      var s;
      if (x.mode !== "world") return;
      let t = x.player,
        i = this.map.regAt(t.x, t.z);
      if (((x.regionId = i), i !== this.regionCur)) {
        ((this.regionCur = i),
          (s = x.S).visited || (s.visited = {}),
          x.S.visited[i] || ((x.S.visited[i] = 1), (!e || i === 0) && ee("archive", "Regi\xF3n: " + De[i].n)));
        let a = De[i];
        (x.R.setRegionEnv(a, e),
          bo.setKey(i === 0 && this.inBase() ? "base" : a.key),
          e || ee("banner", a.n, a.sub + ` \xB7 Nivel ${a.lvl[0]}\u2013${a.lvl[1]}`),
          ee("region", i));
      }
    }
    inBase() {
      let e = this.map.pois.base;
      return e && Le(x.player.x, x.player.z, e.x, e.z) < 15;
    }
    safeAt(e, t) {
      if (x.mode !== "world") return !1;
      let i = this.map.pois.base;
      if (i && Math.abs(e - i.x) < 15 && Math.abs(t - i.z) < 15) return !0;
      for (let s in this.map.pois)
        if (s.startsWith("camp_")) {
          let a = this.map.pois[s];
          if (Le(e, t, a.x, a.z) < 7.5) return !0;
        }
      return !1;
    }
    update(e) {
      let t = x.player,
        i = x.S;
      if (x.mode === "world") {
        i.time = (i.time + e / 960) % 1;
        let r = i.time;
        x.night = r > 0.6 && r < 0.97 ? qe(Math.min((r - 0.6) / 0.06, (0.97 - r) / 0.05), 0, 1) : 0;
        // ciclo visual (no afecta a la jugabilidad): elevación del sol, arrebol y recorrido de sol/luna para el renderer
        let ds = ClDay(r, x.dayState || (x.dayState = {}));
        ((x.sunEl = ds.el), (x.twi = ds.twi), (x.sunU = ds.u), (x.moonQ = ds.q));
      } else ((x.night = 0), (x.sunEl = 1), (x.twi = 0), (x.sunU = 0.5), (x.moonQ = 0));
      if (x.mode === "world" && !x.inDark) {
        let r = De[x.regionId]?.key,
          o = r === "valle";
        // partículas ambientales por CPU solo donde la región no tiene clima propio (valle: polen y luciérnagas; complejo: polvo);
        // el resto (lluvia, polvo, nieve, brasas, ceniza, esporas) las pinta la GPU en WeatherFx, sin coste por partícula
        if (!De[x.regionId]?.weather && Q() < e * (o ? 7 : 2.5)) {
          let l = Q() * 6.28,
            c = 3 + Q() * 12,
            d = t.x + Math.cos(l) * c,
            h = t.z + Math.sin(l) * c;
          x.night > 0.5 && o
            ? x.fx.burst(d, 0.5 + Q() * 1.5, h, 1, {
                color: r === "colmena" ? 13660415 : 13172576,
                speed: 0.35,
                life: 2.5 + Q() * 2,
                size: 0.16,
                size1: 0.12,
                up: 0.15,
                drag: 0.4,
              })
            : x.fx.burst(d, 0.4 + Q() * 2, h, 1, {
                color:
                  r === "caldera"
                    ? 16747056
                    : r === "tundra"
                      ? 15267071
                      : r === "desierto" || r === "yermo"
                        ? 15259816
                        : 16774864,
                speed: 0.25,
                life: 3 + Q() * 2,
                size: 0.07,
                size1: 0.06,
                up: 0.12,
                drag: 0.4,
              });
        }
      }
      ((x.inSafe = this.safeAt(t.x, t.z)),
        (x.inDark = !!this.map.darkAt(t.x, t.z) || (x.op && x.op.mods.includes("dark") && !this.nearLight(t.x, t.z))),
        x.inDark &&
          !this._wasDark &&
          (i.flags.flashlight
            ? t.flashOn || ee("toast", "Zona oscura \xB7 pulsa F para encender la linterna", "warn")
            : (!this._darkWarnT || x.time - this._darkWarnT > 90) &&
              ((this._darkWarnT = x.time),
              ee(
                "toast",
                "Zona oscura: sin linterna apenas ves a los enemigos. Cons\xEDguela con la misi\xF3n \xABOjos en la oscuridad\xBB.",
                "warn",
              ))),
        (this._wasDark = x.inDark),
        (this.checkT -= e),
        this.checkT <= 0 && ((this.checkT = 0.4), this.check(!1)),
        (this.fogT -= e),
        this.fogT <= 0 && ((this.fogT = 0.25), this.revealFog(), this.updateRegion(!1), this.checkReach()),
        this.mesh.update(e, x.time));
      let s = 0,
        a = [];
      for (let r of this.rt.values()) {
        let o = r.e;
        if (r.mesh) {
          let l = r.mesh.userData;
          if (l.anim) for (let c of l.anim) c(x.time + (r.ph || 0));
          if (r.model) {
            let c = Le(o.x, o.z, t.x, t.z),
              d = c < 6 ? Math.atan2(t.x - o.x, t.z - o.z) : r.baseRot,
              h = r.mesh.rotation.y,
              f = h + fi(h, d) * (1 - Math.exp(-e * 4)),
              u = "calm";
            (c < 4 && !r.waved && ((r.waved = !0), (u = "wave")), c > 9 && (r.waved = !1), r.model.update(e, f, u));
          } else if (r.actor) {
            let c = Le(o.x, o.z, t.x, t.z);
            r.actor.update(e, c < 6 ? Math.atan2(t.x - o.x, t.z - o.z) : r.baseRot, "idle");
          } else if (r.rig) {
            Og(r.rig, e);
            let d = Le(o.x, o.z, t.x, t.z) < 6 ? Math.atan2(t.x - o.x, t.z - o.z) : r.baseRot,
              h = r.rig.root.rotation.y;
            r.rig.root.rotation.y = h + fi(h, d) * (1 - Math.exp(-e * 4));
          }
          if (
            (o.k === "allyturret" && this.turretUpdate(r, e),
            l.sprite &&
              (o.k === "campfire" && Q() < e * 8 && x.fx.fire(o.x, 0.4, o.z, 1, 0.35),
              o.k === "beacon" && this.entSprite(r, i.world.beacons[o.id] ? "beacon_on" : "beacon_off"),
              o.k === "chest" && this.isConsumed(o) && this.entSprite(r, "chest_open"),
              o.k === "lockbox" && this.isConsumed(o) && this.entSprite(r, "lockbox_open")),
            !l.sprite && o.k === "beacon")
          ) {
            let c = !!i.world.beacons[o.id];
            ((l.beam.visible = c),
              (l.core.material = Me(c ? 4251903 : 8400944)),
              (l.ring.material = Me(c ? 4251903 : 8400944)));
          }
          if (!l.sprite && o.k === "terminal") {
            let c = this.termDone(o),
              h = r.lockUntil > x.time ? 16724e3 : c ? 16766023 : 3203232;
            r._c !== h && ((r._c = h), (l.screen.material = Me(h)), (l.holo.material = Me(h, 0.8, !0)));
          }
          if (!l.sprite && o.k === "shrine") {
            let c = this.shrineReady(o);
            ((l.relic.visible = c), (l.halo.visible = c));
          }
          (l.sprite ||
            (o.k === "extract" &&
              ((l.beam.visible = !!(x.op && x.op.done)),
              l.pad.material.color.setHex(x.op && x.op.done ? 5308304 : 3166272))),
            l.sprite || (o.k === "campfire" && Q() < e * 8 && x.fx.fire(o.x, 0.4, o.z, 1, 0.35)),
            o.k === "stairs" && l.mark && (l.mark.visible = this.subReady(o)),
            o.k === "breach" &&
              Q() < e * 10 &&
              x.fx.burst(o.x + (Q() - 0.5) * 2, 1.5 + (Q() - 0.5) * 2, o.z, 1, {
                color: 11889663,
                speed: 0.5,
                life: 0.8,
                size: 0.2,
              }));
        }
        if ((o.k === "light" || o.k === "campfire") && !r.off) {
          let l = Le(o.x, o.z, t.x, t.z);
          l < 22 && a.push([l, o]);
        }
      }
      a.sort((r, o) => r[0] - o[0]);
      for (let r = 0; r < this.lights.length; r++) {
        let o = this.lights[r],
          l = a[r];
        if (!l) {
          o.intensity = 0;
          continue;
        }
        let c = l[1];
        (o.position.set(c.x, c.model === "lamp" ? 2.4 : c.model === "emergency" ? 1.3 : 1.6, c.z),
          o.color.setHex(c.c ?? 16751168));
        let d = c.model === "emergency" ? 3 : c.k === "campfire" ? 4 : 5;
        ((o.distance = c.model === "emergency" ? 7 : 11),
          (o.intensity =
            d *
            (c.flicker
              ? c.model === "emergency"
                ? Math.sin(x.time * 6) > -0.3
                  ? 1
                  : 0.1
                : 0.8 + Math.sin(x.time * 13 + c.x) * 0.15 + Math.sin(x.time * 7.3) * 0.1
              : 1) *
            (x.mode === "world" ? 0.35 + x.night * 0.65 + (this.map.darkAt(c.x, c.z) ? 0.65 : 0) : 1)));
      }
      (this.updatePrompt(), this.alarmT > 0 && (this.alarmT -= e), x.op && this.updateOp(e));
    }
    nearLight(e, t) {
      for (let i of this.rt.values())
        if (i.e.k === "light" && i.e.model === "none" && Le(i.e.x, i.e.z, e, t) < 5) return !0;
      return !1;
    }
    check(e) {
      let t = x.player,
        i = x.S,
        s = this.map;
      for (let a of s.ents) {
        let r = Le(a.x, a.z, t.x, t.z),
          o = this.rt.get(a.id);
        if (
          (o || ((o = { e: a, mesh: null, ph: Q() * 10 }), this.rt.set(a.id, o)),
          r < VE && !o.mesh ? this.createMesh(o) : r > qE && o.mesh && this.removeMesh(o),
          a.k === "nest" && r < 30 && !o.enemy && !this.nestDead(a))
        ) {
          let l = x.mode === "op" ? x.op.lvl : this.lvlAt(a.x, a.z);
          ((o.enemy = In("nido", l, a.x, a.z, { ent: a, persist: !0 })),
            a.spawn && (o.enemy.def = { ...o.enemy.def, spawn: a.spawn }));
        }
        if (
          (o.enemy &&
            o.enemy.dead &&
            !o.deadMarked &&
            ((o.deadMarked = !0),
            a.k === "nest"
              ? x.mode === "op"
                ? ((o.dead = !0), x.op.nestsLeft--)
                : (i.world.nests[a.id] = gnow())
              : ((o.killedAt = gnow()), a.k === "spawnpt" && (o.enemy = null))),
          o.enemy && !o.enemy.dead && r > 60 && ((o.enemy.dead = !0), (o.enemy.deadT = 0), (o.enemy = null)),
          o.enemy &&
            o.enemy.dead &&
            !this.nestDead(a) &&
            a.k === "nest" &&
            x.mode === "world" &&
            ((o.enemy = null), (o.deadMarked = !1)),
          a.k === "spawnpt" &&
            r < 28 &&
            !o.enemy &&
            (!o.killedAt || gnow() - o.killedAt > 10 * 6e4) &&
            ((o.enemy = In(a.e, this.lvlAt(a.x, a.z), a.x, a.z, { persist: !0 })), (o.deadMarked = !1)),
          a.k === "spawnpack" &&
            r < (a.op ? 20 : 24) &&
            !o.spawned &&
            (!o.clearedAt || gnow() - o.clearedAt > Fi.pack) &&
            this.spawnPack(o),
          a.k === "spawnpack" &&
            o.spawned &&
            o.pack &&
            o.pack.every((l) => l.dead) &&
            !o.clearedAt &&
            (o.clearedAt = gnow()),
          a.k === "spawnpack" && !a.op && o.spawned && o.pack && !o.clearedAt && r > 60)
        ) {
          for (let l of o.pack) l.dead || ((l.dead = !0), (l.deadT = 0));
          ((o.spawned = !1), (o.pack = null));
        }
        // terminado el enfriamiento la manada vuelve UNA vez: hay que borrar también la marca de «despejada» (si no, cada pasada del barrido la volvía a soltar: una horda sin fin)
        (a.k === "spawnpack" &&
          o.spawned &&
          o.clearedAt &&
          !a.op &&
          gnow() - o.clearedAt > Fi.pack &&
          ((o.spawned = !1), (o.pack = null), (o.clearedAt = null)),
          a.k === "bossarena" && this.arenaCheck(o, r),
          a.k === "beacon" &&
            r < 6 &&
            !i.world.beacons[a.id] &&
            x.mode === "world" &&
            ((i.world.beacons[a.id] = 1),
            ee("toast", `Baliza activada: ${a.n}`, "good"),
            ae.play("success"),
            ee("save")),
          a.k === "datapad" && r < 1.2 && !this.dpTaken(a) && this.takeDatapad(a, o));
      }
    }
    spawnPack(e) {
      let t = e.e;
      ((e.spawned = !0), (e.pack = []));
      let i = x.mode === "op" ? x.op.lvl : this.lvlAt(t.x, t.z),
        a = (x.mode === "op" ? x.op.pool : De[this.map.regAt(t.x, t.z)]).enemies.filter(
          (l) => (l[2] || 0) <= i && !["nido"].includes(l[0]),
        ),
        r = t.size || (t.big ? Rt(5, 7) : Rt(3, 5)),
        o = x.mode === "op" ? (x.op.mods.includes("elites") ? 0.35 : x.cfg.econ.diff.eliteOp) : x.cfg.econ.diff.eliteOp;
      for (let l = 0; l < r; l++) {
        let c = a.length ? a[Math.floor(Q() * a.length)][0] : "rastrero";
        t.dark && i >= 8 && Q() < 0.3 && (c = "sombra");
        let [d, h] = this.map.findFree(t.x + (Q() - 0.5) * 3, t.z + (Q() - 0.5) * 3, 4, 0.4),
          f = In(c, i, d, h, { mods: l === 0 ? aa(i, o) : [], persist: !0 });
        ((f.opPack = !!t.op), e.pack.push(f));
      }
      x.op && (x.op.spawnedTotal += r);
    }
    arenaCheck(e, t) {
      let i = e.e,
        s = x.S,
        a = x.player;
      if (i.secret) {
        e.enemy &&
          e.enemy.dead &&
          !e.done &&
          ((e.done = !0), (s.world.bosses["secret_" + i.reg] = gnow()), ee("save"));
        return;
      }
      let r = i.op ? null : "reg" + i.reg;
      e.enemy &&
        e.enemy.dead &&
        !e.done &&
        ((e.done = !0),
        (e.enemy = null),
        r &&
          ((s.world.bosses[r] = s.world.bosses[r] || gnow()),
          (s.world.bosses[r + "_t"] = gnow()),
          this.checkGatesUnlock(),
          ee("save", !0)),
        i.op && x.op && x.op.obj === "boss" && this.opComplete());
      let o = r ? s.world.bosses[r + "_t"] : null,
        l = e.enemy && !e.enemy.dead;
      (!l &&
        !e.pending &&
        t < i.rad + 1.5 &&
        (i.op ? !e.done : !o || gnow() - o > Fi.boss) &&
        bossGateArena(i, t) && // 31g-bosses.js: la guarida sigue sellada hasta cumplir misión, nivel y sellos
        ((e.pending = 1.2),
        (e.done = !1),
        ee("bossIntro", { ...En[i.boss], id: i.boss }),
        ae.play("roar"),
        setTimeout(() => {
          if (((e.pending = 0), this.rt.get(i.id) !== e || x.map !== this.map)) return;
          let c = In(i.boss, i.lvl, i.x, i.z, { boss: !0, hpMul: i.op ? 0.6 : 1, alerted: !0 });
          ((c.arena = i), (e.enemy = c));
        }, 1200)),
        l &&
          t > i.rad + 22 &&
          ((e.enemy.dead = !0),
          (e.enemy.deadT = 0),
          (e.enemy = null),
          ee("toast", "El jefe ha vuelto a su guarida", "warn")));
    }
    createMesh(e) {
      let t = e.e;
      if (
        ["spawnpack", "spawnpt", "bossarena", "gate", "nest", "encounter", "vault"].includes(t.k) ||
        (t.k === "light" && t.model === "none")
      )
        return;
      if (t.k === "npc" && Et.hasActor(t.npc)) {
        let r = new Pa(t.npc, 1.75);
        (r.root.add(Ei(0.42)),
          r.root.position.set(t.x, 0, t.z),
          (r.root.userData = { anim: [] }),
          (e.baseRot = Math.atan2(Si - t.x, Si - t.z)),
          (e.actor = r),
          (e.mesh = r.root),
          x.R.scene.add(r.root));
        return;
      }
      if (t.k === "npc" && Ln.has(br[0])) {
        let r = 0;
        for (let u of t.npc) r = (r * 31 + u.charCodeAt(0)) >>> 0;
        let o = zt[t.npc].robot,
          l = o ? "Mech_FernandoTheFlamingo" : br[r % br.length],
          c = zt[t.npc].look || {},
          d = new Ee();
        d.setHex(c.suit ?? 9079424);
        let h = new Da(l, o ? 1.9 : 1.6, { recolor: o ? null : { suit: d.getHex() }, set: o ? "mech" : "astro" });
        ((h.set = { ...h.set, idle: ["Idle"], calm: ["Idle"] }),
          h.root.add(Ei(0.42)),
          h.root.position.set(t.x, 0, t.z),
          (h.root.userData = { anim: [] }));
        let f = this.map.pois["camp_" + zt[t.npc].reg];
        ((e.baseRot = zt[t.npc].at === "camp" && f ? Math.atan2(f.x - t.x, f.z - t.z) : Math.atan2(Si - t.x, Si - t.z)),
          (h.root.rotation.y = e.baseRot),
          (e.model = h),
          (e.mesh = h.root),
          (e.waveT = 0),
          x.R.scene.add(h.root));
        return;
      }
      let i = this.modelFor(t);
      if (i) {
        (i.position.set(t.x, 0, t.z), (e.mesh = i), x.R.scene.add(i));
        return;
      }
      let s = this.spriteKeyFor(t);
      if (s && !(["crate", "crystal", "datapad"].includes(t.k) && this.isConsumed(t))) {
        let r = new Ve();
        r.position.set(t.x, 0, t.z);
        let o = yf(s[0], s[1]);
        (r.add(o),
          r.add(Ei(Math.max(0.4, s[1] * 0.3), 0.4)),
          (r.userData = { k: t.k, anim: [], sprite: !0, bb: o, cur: s[0], h: s[1] }),
          (e.mesh = r),
          x.R.scene.add(r));
        return;
      }
      if (t.k === "npc") {
        let r = { ...zt[t.npc], id: t.npc },
          o = Dg(r);
        if (
          (o.root.position.set(t.x, 0, t.z),
          (e.baseRot = Math.atan2(
            this.map.pois.base ? this.map.pois.base.x - t.x : 0,
            this.map.pois.base ? this.map.pois.base.z - t.z : 1,
          )),
          this.map.pois["camp_" + zt[t.npc].reg] && zt[t.npc].at === "camp")
        ) {
          let l = this.map.pois["camp_" + zt[t.npc].reg];
          e.baseRot = Math.atan2(l.x - t.x, l.z - t.z);
        }
        ((o.root.rotation.y = e.baseRot),
          (o.root.userData = { anim: [] }),
          (e.rig = o),
          (e.mesh = o.root),
          x.R.scene.add(o.root));
        return;
      }
      if (this.isConsumed(t) && (t.k === "crate" || t.k === "crystal" || t.k === "datapad")) return;
      let a = Bg(t);
      (a.position.set(t.x, 0, t.z),
        t.k === "terminal" && (a.rotation.y = this.faceOpen(t)),
        t.k === "station" && (a.rotation.y = this.faceOpen(t)),
        t.k === "chest" && this.isConsumed(t) && (a.userData.lid.rotation.x = -1.9),
        t.k === "lockbox" && this.isConsumed(t) && (a.userData.latch.material = Me(4259680)),
        t.k === "breach" && (a.rotation.y = Math.PI / 4),
        (t.k === "stairs" || t.k === "exit") && (a.rotation.y = this.faceOpen(t)),
        (e.mesh = a),
        x.R.scene.add(a));
    }
    modelFor(e) {
      let t = (s, a, r = 0, o = 99) => {
          let l = Ln.staticGeo(s);
          if (!l) return null;
          let c = new Ve(),
            d = Math.min(a / Math.max(0.05, l.h), o / Math.max(0.05, l.w));
          for (let h of l.parts) {
            let f = new Ge(h.geo, h.mat);
            (f.scale.setScalar(d), (f.rotation.y = r), (f.castShadow = !0), (f.receiveShadow = !0), c.add(f));
          }
          return c;
        },
        i = null;
      if ((e.k === "chest" || e.k === "crate" || e.k === "supply") && Ln.has("Pickup_Crate")) {
        if (
          (e.k === "crate" && this.isConsumed(e)) ||
          ((i = t("Pickup_Crate", e.k === "chest" ? 0.95 : e.k === "supply" ? 1.3 : 0.8, Q() * 6)), !i)
        )
          return null;
        if (e.k === "chest" || e.k === "supply") {
          let s = [13226454, 6280026, 4161535, 16769082][e.tier ?? 2],
            a = new Ge(new Yi(0.7, 0.03, 4, 24), Me(s, 0.8, !0));
          ((a.rotation.x = Math.PI / 2),
            (a.position.y = 0.05),
            i.add(a),
            (i.userData = {
              k: e.k,
              anim: [
                (r) => {
                  ((a.visible = !this.isConsumed(e)), (a.rotation.z = r));
                },
              ],
              halo: a,
            }));
        } else i.userData = { k: e.k, anim: [] };
        if (e.k === "supply") {
          let s = new Ge(new ni(0.15, 0.15, 10, 8), Me(4259712, 0.18, !0));
          ((s.position.y = 5), i.add(s));
        }
      } else if (e.k === "datapad" && Ln.has("Pickup_KeyCard")) {
        let s = t("Pickup_KeyCard", 0.35);
        if (!s) return null;
        ((i = new Ve()), i.add(s));
        let a = new Ge(new ni(0.12, 0.12, 2.5, 8), Me(16766023, 0.15, !0));
        ((a.position.y = 1.4),
          i.add(a),
          (i.userData = {
            k: e.k,
            anim: [
              (r) => {
                ((s.rotation.y = r), (s.position.y = 0.3 + Math.sin(r * 2) * 0.08));
              },
            ],
          }));
      } else if (e.k === "helipad" && Ln.has("Spaceship_RaeTheRedPanda")) {
        i = new Ve();
        let s = new Ge(new _s(2.4, 28), new Xt({ color: 3817026, roughness: 0.8 }));
        ((s.rotation.x = -Math.PI / 2), (s.position.y = 0.02), (s.receiveShadow = !0), i.add(s));
        let a = new Ge(new Yi(2.2, 0.06, 4, 32), Me(16766023));
        ((a.rotation.x = Math.PI / 2), (a.position.y = 0.04), i.add(a));
        let r = t("Spaceship_RaeTheRedPanda", 1.6, 0.6, 4.2);
        ((r.position.y = 0.25),
          i.add(r),
          (i.userData = {
            k: e.k,
            anim: [
              (o) => {
                r.position.y = 0.25 + Math.sin(o * 1.2) * 0.06;
              },
            ],
          }));
      }
      return i;
    }
    spriteKeyFor(e) {
      let t = {
          terminal: 1.7,
          beacon: 3.6,
          chest: 0.9,
          lockbox: 1.1,
          crate: 0.9,
          crystal: 1.3,
          shrine: 2,
          datapad: 0.45,
          breach: 3.4,
          extract: 0.5,
          campfire: 0.7,
          allyturret: 1.6,
          helipad: 3.2,
          flag: 4.2,
          supply: 1.6,
        },
        i = {
          shop: "station_armory",
          workbench: "station_workbench",
          lab: "station_lab",
          board: "station_board",
          deploy: "station_ops",
          table: "station_ops",
          medbay: "station_medbay",
        },
        s = {
          terminal: "terminal",
          beacon: x.S.world.beacons[e.id] ? "beacon_on" : "beacon_off",
          chest: this.isConsumed(e) ? "chest_open" : "chest_closed",
          lockbox: this.isConsumed(e) ? "lockbox_open" : "lockbox_locked",
          crate: "crate",
          crystal: "crystal",
          shrine: "shrine",
          datapad: "datapad",
          breach: "breach_portal",
          extract: "extract_pad",
          campfire: "campfire",
          allyturret: "ally_turret",
          helipad: "helicopter",
          flag: "flag",
          supply: "supply_drop",
        }[e.k];
      return (
        e.k === "station" && (s = i[e.st]),
        e.k === "light" && e.model === "lamp" && (s = "lamp"),
        !s || !Et.has(s) ? null : [s, e.k === "station" ? 1.6 : e.k === "light" ? 2.8 : t[e.k] || 1.2]
      );
    }
    entSprite(e, t) {
      let i = e.mesh.userData;
      i.cur === t || !Et.has(t) || ((i.cur = t), e.mesh.remove(i.bb), (i.bb = yf(t, i.h)), e.mesh.add(i.bb));
    }
    faceOpen(e) {
      let t = 0,
        i = -1;
      for (let s = 0; s < 8; s++) {
        let a = (s / 8) * 6.283,
          r = 0;
        for (let o = 1; o <= 3; o++) this.map.solidW(e.x + Math.sin(a) * o, e.z + Math.cos(a) * o) || r++;
        r > i && ((i = r), (t = a));
      }
      return t;
    }
    removeMesh(e) {
      e.mesh && (x.R.scene.remove(e.mesh), (e.mesh = null), (e.rig = null));
    }
    isConsumed(e) {
      let t = x.S.world,
        i = gnow();
      return x.mode === "op" || e.temp
        ? !!this.rt.get(e.id)?.used
        : e.k === "chest"
          ? t.chests[e.id] && i - t.chests[e.id] < Fi.chest
          : e.k === "crate"
            ? t.crates[e.id] && i - t.crates[e.id] < Fi.crate
            : e.k === "crystal"
              ? t.crystals[e.id] && i - t.crystals[e.id] < Fi.crystal
              : e.k === "lockbox"
                ? t.lock[e.id] && i - t.lock[e.id] < Fi.lock
                : e.k === "datapad"
                  ? !!t.dp[e.id]
                  : !1;
    }
    dpTaken(e) {
      return x.mode === "op" ? !!this.rt.get(e.id)?.used : !!x.S.world.dp[e.id];
    }
    shrineReady(e) {
      let t = x.mode === "op" ? this.rt.get(e.id)?.usedAt : x.S.world.shrines[e.id];
      return !t || gnow() - t > Fi.shrine;
    }
    revealFog() {
      if (x.mode !== "world") return;
      let e = x.player,
        t = this.fogW,
        i = 9,
        s = Math.floor(e.x / 2),
        a = Math.floor(e.z / 2);
      for (let r = a - i; r <= a + i; r++)
        for (let o = s - i; o <= s + i; o++) {
          if (o < 0 || r < 0 || o >= t || r >= t || (o - s) ** 2 + (r - a) ** 2 > i * i) continue;
          let l = r * t + o;
          this.fogBits[l >> 3] |= 1 << (l & 7);
        }
    }
    fogAt(e, t) {
      let i = e >> 1,
        a = (t >> 1) * this.fogW + i;
      return (this.fogBits[a >> 3] >> (a & 7)) & 1;
    }
    checkReach() {
      let e = x.player;
      for (let [t, i] of Object.entries(this.map.pois)) Le(e.x, e.z, i.x, i.z) < i.r && ht.onReach(t);
    }
    gateStatus(e) {
      let t = x.S;
      if (t.world.gates[e.id]) return { open: !0 };
      if (e.shortcut) {
        let r = this.bossDown(e.b);
        return { open: !1, can: r, why: r ? "" : `Atajo sellado. Se abre al derrotar al jefe de ${De[e.b].n}.` };
      }
      let i = this.bossDown(e.a),
        s = t.lvl >= De[e.b].lvl[0] - 1,
        a = [];
      return (
        i || a.push(`derrota a ${En[De[e.a].boss].n}`),
        s || a.push(`alcanza el nivel ${De[e.b].lvl[0] - 1}`),
        { open: !1, can: i && s, why: a.length ? `Acceso a ${De[e.b].n} bloqueado: ${a.join(" y ")}.` : "" }
      );
    }
    checkGatesUnlock() {
      for (let e of this.map.gates || []) {
        let t = this.gateStatus(e);
        !t.open && t.can && ee("toast", `Nueva zona accesible: ${De[e.b].n}`, "good");
      }
    }
    openGate(e) {
      let t = x.S;
      t.world.gates[e.id] = 1;
      for (let s of e.tiles) this.map.ter[s] = F.ROAD;
      this.map._imgDirty = !0;
      let i = this.gateMeshes.get(e.id);
      if (i) {
        let s = x.time;
        ((i.userData.anim = (a) => {
          let r = (a - s) / 1.2;
          if (((i.position.y = -r * 3.5), r >= 1)) return (x.R.scene.remove(i), this.gateMeshes.delete(e.id), !0);
        }),
          this.animGates || (this.animGates = []),
          this.animGates.push(i));
      }
      (ae.play("door"), x.R.addShake(0.3), ee("toast", `Acceso abierto: ${De[e.b].n}`, "good"), ee("save", !0));
    }
    updatePrompt() {
      let e = x.player,
        t = null,
        i = 2.4,
        s = "";
      this.animGates && (this.animGates = this.animGates.filter((a) => !a.userData.anim(x.time)));
      for (let a of this.rt.values()) {
        let r = a.e,
          o = Le(r.x, r.z, e.x, e.z);
        if (
          o > (r.k === "gate" ? 6 : r.k === "breach" ? 3 : r.k === "beacon" || r.k === "extract" ? 2.8 : 2.4) ||
          (r.k !== "gate" && !this.reachable(e.x, e.z, r))
        )
          continue;
        let l = this.promptFor(r, a);
        l && o < i + (r.k === "gate" ? 3.6 : 0.6) && ((i = o), (t = a), (s = l));
      }
      x.prompt = t ? { r: t, text: s } : null;
    }
    reachable(e, t, i) {
      let s = this.map;
      if (s.los(e, t, i.x, i.z)) return !0;
      let a = Math.floor(i.x),
        r = Math.floor(i.z);
      for (let [o, l] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        let c = a + o,
          d = r + l;
        if (!s.solidAt(c, d) && Le(e, t, c + 0.5, d + 0.5) < 1.6 && s.los(e, t, c + 0.5, d + 0.5)) return !0;
      }
      return !1;
    }
    promptFor(e, t) {
      let i = x.S;
      switch (e.k) {
        case "npc":
          return `Hablar con ${zt[e.npc].n}`;
        case "station":
          return null;
        case "terminal":
          return t.lockUntil > x.time
            ? `Terminal bloqueada (${Math.ceil(t.lockUntil - x.time)} s)`
            : this.termDone(e)
              ? null
              : "Hackear terminal";
        case "beacon":
          return x.mode === "world" ? "Usar baliza (viaje r\xE1pido)" : null;
        case "chest":
          return this.isConsumed(e) ? null : "Abrir cofre";
        case "lockbox":
          return this.isConsumed(e) ? null : "Contenedor sellado (requiere terminal)";
        case "crate":
          return this.isConsumed(e) ? null : "Romper caja de suministros";
        case "crystal":
          return this.isConsumed(e) ? null : "Extraer cristal xeno";
        case "shrine":
          return this.shrineReady(e) ? "Activar reliquia xeno" : null;
        case "datapad":
          return this.dpTaken(e) ? null : "Leer registro";
        case "breach":
          return "Entrar en la brecha (operaci\xF3n)";
        case "stairs": {
          let s =
            {
              upper: "Subir",
              basement: "Bajar al s\xF3tano",
              cave: "Entrar en la gruta",
              hive: "Descender a la c\xE1mara",
              hatch: "Bajar por la escotilla",
              sewer: "Bajar a las alcantarillas",
            }[e.kind] || "Entrar";
          return this.subReady(e)
            ? `${s} \xB7 ${Ha[e.enc].n}`
            : `Zona despejada \xB7 se repuebla en ${Math.ceil((Fi.sub - (gnow() - x.S.world.subs[e.id])) / 6e4)} min`;
        }
        case "exit":
          return "Volver a la superficie";
        case "extract":
          return x.op && x.op.done ? "Extracci\xF3n" : "Punto de extracci\xF3n (completa el objetivo)";
        case "prisoner":
          return t.used ? null : "Liberar prisionero";
        case "gate": {
          let s = this.gateStatus(e);
          return s.open ? null : s.can ? "Abrir acceso" : s.why;
        }
        case "supply":
          return t.used ? null : "Abrir lanzamiento de suministros";
      }
      return null;
    }
    interact() {
      let e = x.prompt;
      if (!e) return;
      let t = e.r,
        i = t.e,
        s = x.S,
        a = x.player;
      switch (i.k) {
        case "npc":
          ee("talk", i.npc, i);
          break;
        case "terminal":
          !(t.lockUntil > x.time) && !this.termDone(i) && ee("hack", i, t);
          break;
        case "beacon":
          x.mode === "world" && ee("openMap", !0);
          break;
        case "chest":
          this.isConsumed(i) ||
            (this.consume(i, t),
            t.mesh && t.mesh.userData.lid && (t.mesh.userData.lid.rotation.x = -1.9),
            Co(i.x, i.z + 0.6, i.tier || 1, x.mode === "op" ? x.op.lvl : this.lvlAt(i.x, i.z)));
          break;
        case "lockbox":
          (ae.play("err"), ee("toast", "Hackea la terminal cercana para abrirlo", "warn"));
          break;
        case "crate":
          if (!this.consume(i, t)) break;
          (x.fx.burst(i.x, 0.5, i.z, 16, {
            color: 8018488,
            add: !1,
            speed: 4,
            life: 0.6,
            size: 0.25,
            grav: 10,
            up: 1.2,
          }),
            ae.play("metal", { p: 0.6 }),
            this.crateLoot(i),
            this.removeMesh(t));
          break;
        case "crystal":
          if (!this.consume(i, t)) break;
          (x.fx.burst(i.x, 0.6, i.z, 24, { color: 12610559, speed: 5, life: 0.6, size: 0.2, up: 1 }),
            ae.play("legend", { v: 0.4 }),
            Nt("mat", i.x, i.z, { mat: "crystal", val: Rt(1, 3) }),
            Q() < 0.5 && Nt("mat", i.x, i.z, { mat: "scrap", val: Rt(1, 3) }),
            this.removeMesh(t));
          break;
        case "shrine":
          this.useShrine(i, t);
          break;
        case "datapad":
          this.takeDatapad(i, t);
          break;
        case "breach":
          ee("openDeploy", { reg: i.reg, breach: i });
          break;
        case "stairs":
          this.subReady(i)
            ? this.enterSub(i)
            : (ae.play("err"), ee("toast", "Ya has despejado esta zona. Vuelve m\xE1s tarde.", "warn"));
          break;
        case "exit":
          this.leaveSub();
          break;
        case "extract":
          x.op && x.op.done ? this.extract() : ae.play("err");
          break;
        case "prisoner":
          t.used ||
            ((t.used = !0),
            x.op.freed++,
            this.removeMesh(t),
            x.fx.burst(i.x, 1, i.z, 20, { color: 5308304, speed: 3, life: 0.6, size: 0.25 }),
            ae.play("success"),
            ee("toast", `Prisionero liberado (${x.op.freed}/2)`, "good"),
            x.op.obj === "rescue" && x.op.freed >= 2 && this.opComplete());
          break;
        case "gate": {
          let r = this.gateStatus(i);
          r.can ? this.openGate(i) : (ae.play("err"), ee("toast", r.why, "warn"));
          break;
        }
        case "supply":
          t.used ||
            ((t.used = !0),
            Co(i.x, i.z + 0.8, 2, this.lvlAt(i.x, i.z)),
            this.removeMesh(t),
            ht.onEvent(),
            ee("toast", "Suministros recuperados", "good"));
          break;
      }
    }
    consume(e, t) {
      let i = x.S.world,
        s = gnow();
      return this.isConsumed(e)
        ? !1
        : x.mode === "op" || e.temp
          ? ((t.used = !0), !0)
          : (e.k === "chest"
              ? (i.chests[e.id] = s)
              : e.k === "crate"
                ? (i.crates[e.id] = s)
                : e.k === "crystal"
                  ? (i.crystals[e.id] = s)
                  : e.k === "lockbox" && (i.lock[e.id] = s),
            !0);
    }
    crateLoot(e) {
      let t = x.mode === "op" ? x.op.lvl : this.lvlAt(e.x, e.z);
      for (let i = 0; i < Rt(1, 3); i++) {
        let s = Yt(["cr", "cr", "mat", "cons", "hp"]);
        Nt(s, e.x, e.z, {
          val: s === "cr" ? 5 * (1 + t * 0.3) : s === "mat" ? Rt(2, 4) : s === "hp" ? 0.12 : 1,
          mat: Yt(["scrap", "scrap", "bio", "battery"]),
          cons: Yt(["grenade", "medkit"]),
        });
      }
      Q() < 0.06 && Nt("chip", e.x, e.z, { chip: xi(t, {}), life: 300 });
    }
    useShrine(e, t) {
      if (!this.shrineReady(e)) return;
      x.mode === "op" ? (t.usedAt = gnow()) : (x.S.world.shrines[e.id] = gnow());
      let i = Yt(wo);
      (x.player.addBuff(i, 45),
        x.fx.ring(e.x, e.z, 4, 16766023, 0.7),
        x.fx.burst(e.x, 1.4, e.z, 30, { color: 16766023, speed: 4, life: 0.8, size: 0.25 }),
        ae.play("buff"),
        ee("toast", `Reliquia xeno: ${Oi[i].n} (45 s)`, "good"));
    }
    takeDatapad(e, t) {
      if (this.dpTaken(e)) return;
      (x.mode === "op" ? (t.used = !0) : (x.S.world.dp[e.id] = 1), this.removeMesh(t));
      let i = x.S,
        s = x.mode === "op" ? (x.op?.reg ?? -1) : e.reg,
        a = na.map((c, d) => d).filter((c) => !i.lore.includes(c)),
        r = a.filter((c) => na[c].reg === s),
        o = r.length ? r[0] : a.length ? a[0] : Rt(0, na.length - 1),
        l = !i.lore.includes(o);
      (l && i.lore.push(o),
        ae.play("item"),
        Nt("mat", e.x, e.z, { mat: "data", val: 1 }),
        ee("lore", na[o], l),
        ht.onDatapad(x.mode === "op" ? (x.op?.reg ?? -1) : e.reg));
    }
    hackResult(e, t, i) {
      let s = x.S,
        a = x.player;
      if (!i) {
        ((t.lockUntil = x.time + 20), ae.play("alarm"), ee("toast", "\xA1ALARMA! Hostiles en camino", "bad"));
        let r = x.mode === "op" ? x.op.lvl : this.lvlAt(e.x, e.z),
          l = (x.mode === "op" ? x.op.pool : De[this.map.regAt(e.x, e.z)]).enemies.filter((c) => (c[2] || 0) <= r);
        for (let c = 0; c < 5 + Math.floor(r / 10); c++) {
          let d = Q() * 6.28,
            [h, f] = this.map.findFree(e.x + Math.cos(d) * 9, e.z + Math.sin(d) * 9, 6, 0.4);
          In(Yt(l)[0], r, h, f, { alerted: !0, mods: c === 0 ? aa(r, 0.5) : [] });
        }
        return;
      }
      switch (
        (s.stats.terminals++,
        x.mode === "op" ? (t.done = !0) : (s.world.term[e.id] = gnow()),
        ae.play("success"),
        ht.onHack(e),
        e.eff)
      ) {
        case "secret": {
          for (let r of e.tiles) this.map.ter[r] = this.map.kind === "op" ? this.map.floorT : F.FLOOR;
          (this.mesh.openSecret(e.id),
            (this.map._imgDirty = !0),
            x.mode === "world" && (s.world.secrets[e.id] = 1),
            ae.play("door"),
            ee("toast", "Se ha abierto una c\xE1mara secreta", "good"));
          break;
        }
        case "relay": {
          let r = this.lvlAt(e.x, e.z);
          (Nt("mat", e.x, e.z, { mat: "data", val: Rt(1, 2) }),
            Nt("cr", e.x, e.z, { val: 20 * (1 + r * 0.3) }),
            ee("toast", "Rel\xE9 hackeado: datos descargados", "good"));
          break;
        }
        case "cache": {
          let r = this.map.ents.find((o) => o.k === "lockbox" && o.reg === e.reg && Le(o.x, o.z, e.x, e.z) < 4);
          if (r && !this.isConsumed(r)) {
            let o = this.rt.get(r.id);
            (this.consume(r, o),
              o?.mesh?.userData.latch && (o.mesh.userData.latch.material = Me(4259680)),
              Co(r.x, r.z + 0.9, 2, this.lvlAt(r.x, r.z)));
          }
          ee("toast", "Contenedor desbloqueado", "good");
          break;
        }
        case "boss": {
          let r = this.map.ents.find((l) => l.k === "bossarena" && l.secret && l.reg === e.reg),
            o = this.rt.get(r.id);
          (ee("bossIntro", { ...En[e.boss], id: e.boss }),
            ae.play("roar"),
            x.R.addShake(0.5),
            setTimeout(() => {
              let l = In(e.boss, e.lvl, r.x, r.z, { boss: !0, alerted: !0 });
              ((o.enemy = l), (o.done = !1));
            }, 1500));
          break;
        }
        case "opdata":
          (x.op.hacked++,
            ee("toast", `Datos recuperados (${x.op.hacked}/3)`, "good"),
            x.op.obj === "data" && x.op.hacked >= 3 && this.opComplete());
          break;
      }
      ee("save");
    }
    turretUpdate(e, t) {
      let i = e.e;
      e.cd = (e.cd || 0) - t;
      let s = null,
        a = 13;
      for (let l of rn(i.x, i.z, 13)) {
        let c = Le(l.x, l.z, i.x, i.z);
        c < a && l.targetable() && this.map.los(i.x, i.z, l.x, l.z) && ((a = c), (s = l));
      }
      if (!s) return;
      let r = Math.atan2(s.x - i.x, s.z - i.z),
        o = e.mesh.userData.head;
      if ((o && (o.rotation.y = o.rotation.y + fi(o.rotation.y, r) * Math.min(1, t * 8)), e.cd <= 0)) {
        e.cd = 0.18;
        let l = 30;
        (x.projs.push({
          owner: "p",
          kind: "bullet",
          x: i.x + Math.sin(r) * 0.8,
          y: 0.85,
          z: i.z + Math.cos(r) * 0.8,
          vx: Math.sin(r) * l,
          vz: Math.cos(r) * l,
          dmg: s.maxHp * 0.12 + 5,
          life: 0.6,
          pierce: 0,
          hit: new Set(),
          color: 4251903,
          w: 0.07,
          len: 1,
        }),
          x.fx.muzzle(i.x + Math.sin(r) * 0.9, 0.85, i.z + Math.cos(r) * 0.9, r, 4251903, 0.8),
          ae.play("smg", { gap: 0.1, v: 0.3 }));
      }
    }
    subReady(e) {
      let t = x.S.world.subs?.[e.id];
      return !t || gnow() - t > Fi.sub;
    }
    enterSub(e) {
      let t = De[e.reg] || De[0],
        i = qe(this.lvlAt(e.x, e.z) + 1, t.lvl[0], t.lvl[1] + 1),
        s = 0;
      for (let r of e.id) s = (s * 31 + r.charCodeAt(0)) >>> 0;
      let a = {
        sub: !0,
        ent: e,
        enc: e.enc,
        reg: e.reg,
        lvl: i,
        mods: [],
        theme: null,
        obj: "sub",
        pool: t,
        seed: (s ^ Math.floor(Math.random() * 4294967296)) >>> 0,
      };
      (ae.play("door"),
        x.fx.clear(),
        this.loadOp(a),
        (this.returnPos = this.returnSpot(e)),
        (x.player.inv = Math.max(x.player.inv, 1.5)));
    }
    returnSpot(e) {
      let t = Po,
        i = x.player.r;
      for (let s of [1.3, 1.7, 2.2, 2.8])
        for (let a = 0; a < 16; a++) {
          let r = (a / 16) * 6.283 + Math.PI,
            o = e.x + Math.sin(r) * s,
            l = e.z + Math.cos(r) * s;
          if (!t.circleHits(o, l, i) && t.los(e.x, e.z, o, l)) return { x: o, z: l };
        }
      return { x: e.x, z: e.z + 1.6 };
    }
    faceOpenAt(e) {
      let t = this.map;
      this.map = Po;
      let i = this.faceOpen(e);
      return ((this.map = t), i);
    }
    leaveSub() {
      let e = Ni.st;
      (e &&
        e.state === "active" &&
        !e.done &&
        ee("toast", "Has abandonado la zona: podr\xE1s volver a intentarlo", "warn"),
        ae.play("door"),
        this.loadWorld(this.returnPos),
        (x.player.inv = Math.max(x.player.inv, 1)),
        ee("save", !0));
    }
    updateOp(e) {
      let t = x.op;
      if (((t.t += e), t.sub)) {
        Ni.update(e);
        return;
      }
      t.done ||
        (t.obj === "nests" && t.nestsLeft <= 0 && this.opComplete(),
        t.obj === "exterminate" && t.kills >= t.killGoal && this.opComplete());
    }
    opComplete() {
      let e = x.op;
      !e ||
        e.done ||
        ((e.done = !0), ae.play("success"), ee("banner", "OBJETIVO CUMPLIDO", "Dir\xEDgete al punto de extracci\xF3n"));
    }
    extract() {
      let e = x.op,
        t = x.S,
        i = x.player;
      (t.stats.ops++, ht.onOp());
      let s = 1 + e.mods.reduce((c, d) => c + (mr[d].rew || 0), 0),
        a = {
          credits: Math.round(80 * (1 + e.lvl * 0.3) * s * (1 + (i.st.credits || 0))),
          data: Rt(2, 4) + (e.obj === "data" ? 3 : 0),
          xp: 0,
          items: [],
        };
      ((t.credits += a.credits), (t.mats.data += a.data));
      let r = 0.25 * (1 + e.lvl * 0.02) * s;
      ((a.xp = Math.round(r * 0.7 * mt.xpToNext(t.lvl))), i.addXp(a.xp));
      let o = 1 + (Q() < 0.5 * s ? 1 : 0);
      {
        let c = us(e.lvl + 1, { minR: 2, luck: s - 1 }),
          d = Ss(c, { silent: !0 });
        a.items.push(d.piece);
      }
      a.chips = [];
      for (let c = 0; c < o; c++) {
        let d = xi(e.lvl + 1, { minT: 2, luck: s - 1 });
        (Ts(d, { silent: !0 }), a.chips.push(d));
      }
      ((t.mats.core += 1), ee("opReward", e, a), ee("inv"));
      let l = this.returnPos;
      (this.loadWorld(l), ee("save", !0));
    }
    abortOp() {
      let e = this.returnPos;
      (this.loadWorld(e), ee("toast", "Operaci\xF3n abortada", "warn"));
    }
  };


// ════════ [632] FunctionDeclaration Lp (1159 bytes) ════════
function Lp(n) {
  let e = x.S,
    t = n.reg ?? 0,
    i = De[t],
    s = [
      ["ruinas", "bunker"],
      ["ruinas", "bunker", "laboratorio"],
      ["ruinas", "magma"],
      ["laboratorio", "bunker"],
      ["caverna"],
      ["fabrica", "bunker"],
      ["magma"],
      ["bunker", "laboratorio", "ruinas"],
      ["colmena"],
    ],
    a = n.theme || Yt(s[t]),
    r = n.lvl ?? qe(e.lvl, i.lvl[0], i.lvl[1] + 2),
    o = n.obj || Yt(Object.keys(pr)),
    l = r < 6 ? 0 : Q() < 0.5 ? 1 : 2,
    c = [],
    d = Object.keys(mr);
  for (; c.length < l;) {
    let g = Yt(d);
    c.includes(g) || c.push(g);
  }
  a === "bunker" && c.includes("dark");
  let h = De[0];
  for (let g of De) r >= g.lvl[0] && (h = g);
  let f = De[Math.max(0, h.id - 1)],
    u = { enemies: [...h.enemies, ...f.enemies.map((g) => [g[0], g[1] * 0.4, g[2]])].filter((g) => g[0] !== "nido") };
  ((a === "fabrica" || a === "bunker") && u.enemies.push(["dron", 3], ["aranamec", 3, 3], ["torreta", 0.8, 5]),
    a === "colmena" && u.enemies.push(["larva", 4], ["espectro", 2, 10]),
    a === "laboratorio" && u.enemies.push(["infectado", 3], ["hinchado", 2, 3], ["psionico", 1, 14]));
  let p = Object.entries(En)
      .filter(([g, b]) => !b.secret && g !== "mente")
      .map(([g]) => g),
    m = qe(Math.floor(r / 6), 0, p.length - 1);
  return {
    seed: Rt(1, 1e9),
    theme: a,
    lvl: r,
    obj: o,
    mods: c,
    reg: t,
    pool: u,
    boss: p[qe(m + Rt(-1, 0), 0, p.length - 1)],
    nestSpawn: a === "colmena" ? "larva" : a === "fabrica" ? "aranamec" : Yt(["rastrero", "corredor"]),
  };
}


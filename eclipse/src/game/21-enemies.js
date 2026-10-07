// 21-enemies.js — Clase de enemigo (vp), IA, mallado de enemigos

// ════════ [516] VariableDeclaration RE,CE,xp,vp (29554 bytes) ════════
// luz de borde por familia (se lee sobre cualquier bioma) y color de disolución al morir
var CkOutFam = { insect: 8934162, mutant: 4487232, mech: 2851918, xeno: 6824056 },
  CkRimFam = { insect: 16761466, mutant: 11993994, mech: 8376575, xeno: 14196991 },
  CkDisFam = { insect: 16743184, mutant: 10092336, mech: 8376575, xeno: 14196991 };
var RE = { insect: 11587648, mutant: 9048080, mech: 16752704, xeno: 12607743 },
  CE = 1,
  xp = [],
  vp = class {
    constructor(e, t, i, s, a = {}) {
      let r = a.boss ? En[e] : gn[e];
      ((this.uid = CE++),
        (this.def = r),
        (this.id = e),
        (this.lvl = t),
        (this.boss = !!a.boss),
        (this.mods = a.mods || []),
        (this.elite = this.mods.length ? Bd[this.mods[0]].c : 0),
        (this.champion = !!a.champion),
        (this.name = a.name || null));
      let o = Di[x.S.diff] || Di.soldado,
        l = x.op ? x.op.mods : [],
        c = r.hp * mt.enemyHp(t) * o.hp;
      (this.elite && (c *= this.champion ? 6 : 3.2),
        this.mods.includes("gigante") && (c *= 2),
        l.includes("tough") && (c *= 1.4),
        a.hpMul && (c *= a.hpMul),
        (this.maxHp = c),
        (this.hp = c),
        (this.dmg = r.dmg * mt.enemyDmg(t) * o.dmg * (this.elite ? 1.3 : 1)),
        (this.spd =
          r.spd * (this.mods.includes("veloz") ? 1.5 : 1) * (l.includes("fast") ? 1.3 : 1) * (0.92 + Q() * 0.16)));
      let d = this.mods.includes("gigante") ? 1.4 : 1;
      if (
        ((this.scale = r.m.s * (this.elite ? 1.18 : 1) * d),
        (this.rad = r.r * (this.elite ? 1.15 : 1) * d),
        (this.mini = !!a.mini),
        this.mini && ((this.scale *= 0.72), (this.rad *= 0.72), (this.dmg *= 0.7)),
        (this.siege = a.siege || null),
        (this.aggroT = 0),
        (this.mass = this.boss ? 30 : Math.max(0.6, this.rad * this.rad * 5)),
        (this.fam = r.fam),
        (this.ai = this.boss ? "boss" : r.ai),
        (this.fly = !!r.fly),
        (this.x = i),
        (this.z = s),
        (this.face = Q() * 6.28),
        (this.vx = 0),
        (this.vz = 0),
        (this.kbx = 0),
        (this.kbz = 0),
        (this.st = {}),
        (this.state = "idle"),
        (this.t = 0),
        (this.atkCd = 0.5 + Q() * 1.5),
        (this.wind = 0),
        (this.alerted = !!a.alerted),
        (this.home = { x: i, z: s }),
        (this.ent = a.ent || null),
        (this.persist = !!a.persist),
        (this.hitFlash = 0),
        (this.dead = !1),
        (this.deadT = 0),
        (this.shieldHp = 0),
        (this.shielded = 0),
        (this.children = 0),
        (this.parent = a.parent || null),
        (this.bloodCol = RE[this.fam]),
        (this.stuckT = 0),
        (this.sideT = 0),
        (this.sideA = 0),
        this.mods.includes("escudado") && (this.shieldHp = this.maxHp * 0.4),
        Et.hasActor(e))
      ) {
        let h = new Pa(e, 1.35),
          f = Ei(0.55, 0.5);
        if (
          (h.root.add(f),
          h.style(CkRimFam[r.fam] ?? 10409215, this.boss || this.elite ? 0.8 : 0.6, this.elite || (this.boss ? r.m.e : CkOutFam[r.fam] ?? 0), this.elite || this.boss ? 1.25 : 0.9, this.elite || this.boss ? 0.55 : 0.3, 0.7),
          (this.rig = { root: h.root, actor: h, meshes: [], shadow: f, parts: [], legs: [], type: "sprite", t: 0 }),
          this.elite)
        ) {
          let u = new Ge(
            new Pi(1, 1),
            new vt({
              map: Ys(),
              color: this.elite,
              transparent: !0,
              opacity: 0.85,
              blending: en,
              depthWrite: !1,
              toneMapped: !1,
            }),
          );
          ((u.rotation.x = -Math.PI / 2),
            (u.position.y = 0.05),
            u.scale.set(1.6, 1.6, 1),
            h.root.add(u),
            (this.rig.ring = u));
        }
        h.root.scale.setScalar(this.scale);
      } else if (Od[e] && Ln.has(Od[e][0]) && r.ai !== "spawner") {
        let [h, f] = Od[e],
          u = new Da(h, h.startsWith("Mech") ? 1.15 : h === "Enemy_Large" ? 1.3 : 1.15, {
            recolor: f != null ? To(h, f) : null,
            emissive: this.elite || (this.boss ? r.m.e : 0),
            rim: CkRimFam[r.fam] ?? 10409215,
            rimK: this.boss || this.elite ? 0.7 : 0.55,
            aura: this.elite || (this.boss ? r.m.e : 0),
            auraK: this.boss ? 0.5 : 0.6,
            eyes: 1.5,
          }),
          p = Ei(0.55, 0.5);
        if (
          (u.root.add(p),
          (this.rig = { root: u.root, model: u, meshes: [], shadow: p, parts: [], legs: [], type: "model", t: 0 }),
          this.elite)
        ) {
          let m = new Ge(
            new Pi(1, 1),
            new vt({
              map: Ys(),
              color: this.elite,
              transparent: !0,
              opacity: 0.85,
              blending: en,
              depthWrite: !1,
              toneMapped: !1,
            }),
          );
          ((m.rotation.x = -Math.PI / 2),
            (m.position.y = 0.05),
            m.scale.set(1.6, 1.6, 1),
            u.root.add(m),
            (this.rig.ring = m));
        }
        (u.root.scale.setScalar(this.scale), u.play("idle"));
      } else this.rig = Ng(r, this.elite);
      (this.boss || this.champion
        ? this.rig.root.traverse((h) => {
            h.isMesh && (h.castShadow = !0);
          })
        : this.rig.root.traverse((h) => {
            h.isMesh && h !== this.rig.shadow && (h.castShadow = x.R.quality === "high" && this.rad > 0.6);
          }),
        this.rig.root.position.set(i, 0, s),
        x.R.scene.add(this.rig.root),
        this.boss &&
          ((this.moves = r.moves.slice()),
          (this.moveI = 0),
          (this.moveT = 2.5),
          (this.phase = 1),
          (this.act = null),
          (this.title = r.title)),
        this.ai === "burrower" && ((this.burrowed = !0), (this.rig.root.visible = !1)),
        (this.ai === "spawner" || this.ai === "turret") && (this.static = !0),
        (this.lightCheck = 0),
        (this.visibleShadow = !0));
    }
    get displayName() {
      if (this.name) return this.name;
      let e = this.def.n;
      return this.mods.length ? e + " " + this.mods.map((t) => Bd[t].n.toLowerCase()).join(" ") : e;
    }
    targetable() {
      return (
        !this.dead && !this.burrowed && !this.invuln && !this.cloaked && (this.ai !== "shadow" || this.visibleShadow)
      );
    }
    dmgTakenMul() {
      let e = 1 - (this.def.armor || 0);
      if (
        (this.mods.includes("blindado") && (e *= 0.55),
        this.st.shock > 0 && (e *= 1.15),
        this.shielded > 0 && (e *= 0.5),
        this.st.frozen > 0 && (e *= 1.2),
        this.def.frontShield && this.state !== "stun")
      ) {
        let t = x.player,
          i = Math.atan2(t.x - this.x, t.z - this.z);
        Math.abs(fi(this.face, i)) < 1.1 &&
          ((e *= 1 - this.def.frontShield),
          (this._shT = (this._shT || 0) - 0.016) <= 0 &&
            ((this._shT = 0.25),
            x.fx.burst(this.x + Math.sin(i) * 0.8, 1, this.z + Math.cos(i) * 0.8, 3, {
              color: 6342911,
              speed: 3,
              life: 0.2,
              size: 0.15,
            })));
      }
      return e;
    }
    alert(e) {
      if ((e && (this.aggroT = 5), !this.alerted && ((this.alerted = !0), e)))
        for (let t of rn(this.x, this.z, 8, xp)) t.alerted = !0;
    }
    kill(e = {}) {
      if (this.dead) return;
      ((this.dead = !0), (this.deadT = 0.35), (this.hp = 0));
      let t = x.player,
        i = x.S,
        s = x.fx;
      if (
        (this.fam === "mech"
          ? (s.burst(this.x, 0.8, this.z, 16, { color: 16752704, speed: 6, life: 0.4, size: 0.15, grav: 10, up: 1 }),
            s.smoke(this.x, 0.8, this.z, 4, 3815994, 0.6),
            ae.play("metal", { gap: 0.05 }))
          : (s.blood(this.x, this.z, this.bloodCol, 10 + Math.round(this.rad * 8)),
            ae.play("squish", { gap: 0.04, p: 1.5 - Math.min(0.8, this.rad) })),
        s.decal(this.x, this.z, 0.6 + this.rad, this.fam === "mech" ? 1381653 : this.bloodCol, 0.6),
        (this.boss || this.elite) && s.explosion(this.x, this.z, this.boss ? 4 : 1.5, this.bloodCol),
        this.mods.includes("explosivo"))
      ) {
        s.telegraph(this.x, this.z, 2.6, 0.5, 16747040);
        let r = this.x,
          o = this.z,
          l = this.dmg * 2;
        setTimeout(() => dn(r, o, 2.6, l, { owner: "e" }), 500);
      }
      if (
        (this.def.cloud &&
          Oa({
            x: this.x,
            z: this.z,
            r: 2.2,
            t: 4,
            dps: this.dmg * 0.8,
            owner: "e",
            kind: "acid",
            color: 12648256,
            elem: "toxic",
          }),
        this.ai === "exploder" && this.exploded,
        this.def.split && !e.noSplit)
      ) {
        let r = this.def.split;
        for (let o = 0; o < r.n; o++) {
          let l = Q() * 6.28,
            [c, d] = x.map.findFree(this.x + Math.cos(l) * 0.8, this.z + Math.sin(l) * 0.8, 3, 0.3),
            h = In(r.id, this.lvl, c, d, { alerted: !0 });
          ((h.kbx = Math.cos(l) * 4), (h.kbz = Math.sin(l) * 4));
        }
      }
      let a = this.def.xp * mt.enemyXp(this.lvl) * (this.elite ? (this.champion ? 12 : 5) : 1) * (this.mini ? 0.3 : 1);
      if (((this.xpVal = a), t && !t.dead)) {
        (t.combo++,
          (t.comboT = 3.5),
          t.combo === 25 && t.addBuff("frenzy"),
          t.combo === 50 && t.addBuff(Yt(["fury", "hyper", "boom", "multi", "vamp"])),
          t.combo === 100 && t.addBuff("unstoppable"),
          t.powers.has("berserker") && (t.berserk = Math.min(20, t.berserk + 1)));
        let r = t.ws[i.activeW];
        (r && r.pw.has("vampire") && t.heal(t.maxHp * 0.02, !0),
          r &&
            r.pw.has("explodeKill") &&
            !e.fromKillExplode &&
            dn(this.x, this.z, 2.4, Math.min(this.maxHp * 0.3, r.dmgBase * 6), {
              owner: "p",
              color: 16736304,
              ws: null,
              fromKillExplode: !0,
            }));
      }
      (i.stats.kills++,
        this.elite && i.stats.elites++,
        this.boss && i.stats.bosses++,
        i.best || (i.best = {}),
        i.best[this.id] || ee("archive", "Bestiario: " + (this.def.n || this.id)),
        (i.best[this.id] = (i.best[this.id] || 0) + 1),
        Tx(this),
        this.parent && this.parent.children--,
        ee("kill", this),
        this.boss && ee("bossKilled", this));
    }
    update(e) {
      let t = x.player,
        i = x.map;
      if (this.dead && this.rig.model && this.deadT > 0)
        return (
          this._dplay ||
            ((this._dplay = !0),
            (this.deadT = Math.max(this.deadT, 1.5)),
            this.rig.model.flash(!1),
            this.rig.model.play("death")),
          (this.deadT -= e),
          this.rig.model.update(e, this.face, null),
          // cae con la animación y se disuelve en brasas del color de la familia (el borde incandescente brilla en HDR)
          this.rig.model.dissolve(Math.min(1, Math.max(0, (1.1 - this.deadT) / 0.95)), CkDisFam[this.fam]),
          this.deadT > 0
        );
      if (this.dead && this.rig.actor) {
        // sprites: caen un poco y se disuelven en brasas del color de la familia
        this._dplay || ((this._dplay = !0), (this.deadT = Math.max(this.deadT, 0.6)), this.rig.actor.flash(!1));
        this.deadT -= e;
        let h = Math.min(1, Math.max(0, 1 - this.deadT / 0.55));
        return (
          this.rig.actor.update(e, this.face, "idle"),
          this.rig.actor.dissolve(h, CkDisFam[this.fam]),
          this.rig.root.scale.setScalar(this.scale * (1 - 0.12 * h)),
          this.deadT > 0
        );
      }
      if (this.dead) {
        this.deadT -= e;
        let h = Math.max(0, this.deadT / 0.35);
        return (
          this.rig.root.scale.setScalar(this.scale * (0.4 + 0.6 * h)),
          (this.rig.root.position.y = -(1 - h) * 0.4),
          this.deadT > 0
        );
      }
      this.t += e;
      let s = this.st;
      if (s.burn > 0) {
        if (
          ((s.burn -= e),
          (s.bt = (s.bt || 0) - e),
          Q() < e * 10 && x.fx.fire(this.x, 0.6 * this.scale + 0.2, this.z, 1, 0.3 * this.scale),
          s.bt <= 0 && ((s.bt = 0.5), hs(this, s.burnDps * 0.5, { burnTick: !0 }), this.dead))
        )
          return !0;
      } else s.burnDps = 0;
      if (s.poison > 0) {
        if (
          ((s.poison -= e),
          (s.pt = (s.pt || 0) - e),
          Q() < e * 6 &&
            x.fx.burst(this.x, 0.8 * this.scale, this.z, 1, {
              color: 10354506,
              speed: 0.5,
              life: 0.6,
              size: 0.18,
              up: 1,
            }),
          s.pt <= 0 && ((s.pt = 0.5), hs(this, s.poisonDps * 0.5, { poisonTick: !0 }), this.dead))
        )
          return !0;
      } else s.poisonDps = 0;
      (s.shock > 0 && (s.shock -= e),
        s.slow > 0 && (s.slow -= e),
        s.frozen > 0 && (s.frozen -= e),
        this.shielded > 0 && (this.shielded -= e),
        this.mods.includes("regenerador") && (this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02 * e)),
        this.mods.includes("escudado") &&
          this.hitFlash <= 0 &&
          (this._noHit = (this._noHit || 0) + e) > 4 &&
          (this.shieldHp = Math.min(this.maxHp * 0.4, this.shieldHp + this.maxHp * 0.1 * e)),
        this.hitFlash > 0 && (this._noHit = 0));
      let a = Le(this.x, this.z, t.x, t.z);
      if (!this.alerted) {
        let h = x.inDark ? 9 : 13;
        a < h && (a < 4 || i.los(this.x, this.z, t.x, t.z)) && this.alert(!1);
      }
      if (this.ai === "shadow") {
        let h =
          (!x.inDark && x.night < 0.5 && !i.darkAt(this.x, this.z)) ||
          a < 2.6 ||
          (t.flashOn &&
            x.S.flags.flashlight &&
            a < t.lightRange &&
            Math.abs(fi(t.face, Math.atan2(this.x - t.x, this.z - t.z))) < 0.55);
        ((this.visibleShadow = h), (this.rig.root.visible = h || Math.sin(this.t * 10) > 0.85));
      }
      let r = 0;
      if (
        (s.frozen > 0 ||
          (this.boss
            ? (r = this.updateBoss(e, a))
            : this.siege && (this.aggroT -= e) <= 0 && a > 4.5 && !this.static && this.siegeTarget()
              ? (r = this.updateSiege(e))
              : this.alerted && !t.dead
                ? (r = this.updateAI(e, a))
                : this.static || (r = this.wander(e))),
        Math.abs(this.kbx) + Math.abs(this.kbz) > 0.01)
      ) {
        let [h, f] = i.move(this.x, this.z, this.rad * 0.8, this.kbx * e, this.kbz * e, this.fly);
        ((this.x = h), (this.z = f));
        let u = Math.exp(-e * 8);
        ((this.kbx *= u), (this.kbz *= u));
      }
      (this.mods.includes("igneo") &&
        r > 0.5 &&
        (this._trail = (this._trail || 0) - e) <= 0 &&
        ((this._trail = 0.5),
        Oa({
          x: this.x,
          z: this.z,
          r: 0.9,
          t: 2.5,
          dps: this.dmg * 0.5,
          owner: "e",
          kind: "fire",
          color: 16734736,
          elem: "fire",
        })),
        this.mods.includes("gelido") &&
          Q() < e * 5 &&
          x.fx.burst(this.x, 0.5, this.z, 1, { color: 12577023, speed: 1, life: 0.5, size: 0.2 }),
        this.mods.includes("teleporter") &&
          this.alerted &&
          (this._tp = (this._tp ?? 3 + Q() * 2) - e) <= 0 &&
          ((this._tp = 4), this.blinkNear(4, 7)));
      let o = this.def;
      if (
        (o.summon &&
          this.alerted &&
          (this._dsum = (this._dsum ?? 3) - e) <= 0 &&
          ((this._dsum = o.summon.cd),
          this.children < o.summon.max &&
            (this.summon(o.summon.id, o.summon.n), x.fx.ring(this.x, this.z, 2, o.m.e, 0.4))),
        o.mines &&
          this.alerted &&
          (this._mine = (this._mine ?? 2) - e) <= 0 &&
          ((this._mine = o.mines.cd),
          (this._mines = (this._mines || []).filter((h) => h.t > 0)),
          this._mines.length < o.mines.max))
      ) {
        let h = {
          x: this.x,
          z: this.z,
          r: 1.3,
          t: 18,
          dps: this.dmg,
          owner: "e",
          kind: "mine",
          color: 16756768,
          arm: 0.9,
        };
        (Oa(h), this._mines.push(h));
      }
      (o.enrage &&
        !this.enraged &&
        this.hp < this.maxHp * o.enrage &&
        ((this.enraged = !0),
        (this.spd *= 1.7),
        (this.dmg *= 1.4),
        (this.baseEmissive = 16719888),
        this.rig.model && ((this.rig.model.baseEm = 16719888), this.rig.model.flash(!1)),
        x.fx.text(this.x, 2.2, this.z, "\xA1FURIA!", "#ff4020", 15, { life: 1 }),
        x.fx.ring(this.x, this.z, 2, 16723984, 0.4)),
        this.mods.includes("invocador") &&
          this.alerted &&
          (this._sum = (this._sum ?? 4) - e) <= 0 &&
          ((this._sum = 6),
          this.children < 6 &&
            (this.summoned || 0) < 8 &&
            this.summon({ insect: "rastrero", mutant: "infectado", mech: "aranamec", xeno: "larva" }[this.fam], 2)));
      let l = this.rig;
      (this.ai === "stalker" &&
        (l.root.visible =
          !this.cloaked || Math.sin(this.t * 23) > 0.92 || Le(this.x, this.z, x.player.x, x.player.z) < 2.2),
        (l.root.position.x = this.x),
        (l.root.position.z = this.z),
        this.burrowed || (l.root.position.y = this.leapY || 0));
      let c = l.root.rotation.y;
      if (
        (this.ai !== "turret"
          ? (l.root.rotation.y = c + fi(c, this.face) * (1 - Math.exp(-e * 10)))
          : l.head &&
            (l.head.rotation.y = l.head.rotation.y + fi(l.head.rotation.y, this.face) * (1 - Math.exp(-e * 8))),
        l.model)
      ) {
        let h =
          this.state === "wind" ||
          this.state === "attack" ||
          this.state === "fuse" ||
          this.state === "charge" ||
          (this.act && this.act.t < 0.6);
        (l.model.setStates(s.burn > 0, s.poison > 0, this.shielded > 0 || this.shieldHp > 0),
          l.model.update(
          s.frozen > 0 ? 0 : e * (s.slow > 0 ? 0.5 : 1),
          l.root.rotation.y,
          h ? "attack" : r > 0.2 ? "walk" : "idle",
          r > 0.2 ? Math.min(1.8, Math.max(0.7, r / 3)) : 1,
        ),
          l.ring && (l.ring.rotation.z += e * 2));
      } else
        l.actor
          ? ((l.root.rotation.y = 0),
            l.actor.setStates(s.burn > 0, s.poison > 0, this.shielded > 0 || this.shieldHp > 0),
            l.actor.update(
              s.frozen > 0 ? 0 : e * (s.slow > 0 ? 0.5 : 1),
              this.face,
              this.state === "wind" || this.state === "attack" || this.state === "fuse" || (this.act && this.act.t < 1)
                ? "attack"
                : r > 0.2
                  ? "walk"
                  : "idle",
            ),
            l.ring && (l.ring.rotation.z += e * 2))
          : Fg(
              l,
              s.frozen > 0 ? 0 : e * (s.slow > 0 ? 0.5 : 1),
              r,
              this.state === "wind" || this.state === "attack" ? "attack" : "",
            );
      if (this.wind > 0) {
        let h = this.scale * (1 + Math.sin(this.t * 40) * 0.04);
        l.root.scale.setScalar(h);
      } else l.root.scale.setScalar(this.scale);
      let d = this.hitFlash > 0 ? Pg : s.frozen > 0 ? kd : null;
      return (
        d !== this._mat &&
          ((this._mat = d),
          l.model
            ? l.model.flash(!!d, d === kd ? 4231423 : 16777215)
            : l.actor
              ? l.actor.flash(!!d, d === kd ? 4231423 : 16777215)
              : Ug(l, d)),
        (this.hitFlash -= e),
        this.shielded > 0 &&
          Q() < e * 6 &&
          x.fx.burst(this.x, 1, this.z, 1, { color: 4243711, speed: 0.5, life: 0.4, size: 0.5 }),
        !0
      );
    }
    steer(e, t, i, s, a = !1) {
      let r = x.map,
        o = e - this.x,
        l = t - this.z,
        c = Math.hypot(o, l) || 1;
      if (((o /= c), (l /= c), a)) ((o = -o), (l = -l));
      else if (!this.fly && x.flow && !r.los(this.x, this.z, e, t)) {
        let y = PE(this.x, this.z);
        y && ((o = y[0]), (l = y[1]));
      }
      for (let y of rn(this.x, this.z, this.rad + 0.6, xp)) {
        if (y === this) continue;
        let v = this.x - y.x,
          _ = this.z - y.z,
          A = Math.hypot(v, _) || 0.01,
          T = this.rad + y.rad;
        A < T && ((o += (v / A) * (T - A) * 2.2), (l += (_ / A) * (T - A) * 2.2));
      }
      this.sideT > 0 && ((this.sideT -= s), (o += Math.cos(this.sideA)), (l += Math.sin(this.sideA)));
      let d = Math.hypot(o, l) || 1,
        h = i * (this.st.slow > 0 ? 0.5 : 1),
        f = 1 - Math.exp(-s * 10);
      ((this.vx += ((o / d) * h - this.vx) * f), (this.vz += ((l / d) * h - this.vz) * f));
      let u = this.x,
        p = this.z,
        [m, g] = r.move(this.x, this.z, this.rad * 0.8, this.vx * s, this.vz * s, this.fly);
      ((this.x = m), (this.z = g));
      let b = Math.hypot(m - u, g - p);
      return (
        b < h * s * 0.25 && h > 0.5
          ? ((this.stuckT += s),
            this.stuckT > 0.4 && ((this.stuckT = 0), (this.sideT = 0.6), (this.sideA = Q() * 6.28)))
          : (this.stuckT = 0),
        a || (this.face = Math.atan2(this.vx, this.vz)),
        b / s
      );
    }
    wander(e) {
      return (
        this.fly && this.ai,
        (this.wT = (this.wT ?? Q() * 3) - e),
        this.wT <= 0 &&
          ((this.wT = 2 + Q() * 4),
          (this.wTarget = Q() < 0.5 ? null : [this.home.x + (Q() - 0.5) * 8, this.home.z + (Q() - 0.5) * 8])),
        this.wTarget
          ? Le(this.x, this.z, this.wTarget[0], this.wTarget[1]) < 0.5
            ? ((this.wTarget = null), 0)
            : this.steer(this.wTarget[0], this.wTarget[1], this.spd * 0.35, e)
          : ((this.vx *= 0.9), (this.vz *= 0.9), 0)
      );
    }
    blinkNear(e, t) {
      let i = x.player;
      for (let s = 0; s < 10; s++) {
        let a = Q() * 6.28,
          r = e + Q() * (t - e),
          o = i.x + Math.cos(a) * r,
          l = i.z + Math.sin(a) * r;
        if (!x.map.circleHits(o, l, this.rad, this.fly)) {
          (x.fx.burst(this.x, 1, this.z, 14, { color: this.def.m.e, speed: 3, life: 0.4, size: 0.3 }),
            (this.x = o),
            (this.z = l),
            x.fx.burst(o, 1, l, 14, { color: this.def.m.e, speed: 3, life: 0.4, size: 0.3 }),
            ae.play("portal", { gap: 0.3, v: 0.4 }));
          return;
        }
      }
    }
    summon(e, t, i) {
      for (
        let s = 0;
        s < t && !(this.children >= 8 || x.enemies.filter((d) => !d.dead && !d.static && !d.boss).length >= 30);
        s++
      ) {
        let a = Q() * 6.28,
          r = this.rad + 1 + Q() * 1.5,
          [o, l] = x.map.findFree(this.x + Math.cos(a) * r, this.z + Math.sin(a) * r, 4, 0.4),
          c = In(e, i ?? Math.max(1, this.lvl - (this.boss ? 2 : 0)), o, l, { alerted: !0, parent: this });
        (this.children++,
          (this.summoned = (this.summoned || 0) + 1),
          x.fx.burst(o, 0.3, l, 10, {
            color: this.bloodCol,
            speed: 3,
            life: 0.5,
            size: 0.25,
            add: !1,
            grav: 6,
            up: 1,
          }));
      }
    }
    meleeHit(e = 1, t = 0.5) {
      let i = x.player;
      if (Le(this.x, this.z, i.x, i.z) < this.rad + i.r + t) {
        let s = i.hurt(this.dmg * e, { src: this, melee: !0, elem: this.def.elem });
        return (
          s > 0 &&
            (this.mods.includes("vampirico") && (this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.06)),
            this.def.leech && ((this.hp = Math.min(this.maxHp, this.hp + s)), (i.slowT = 1.2)),
            (this.mods.includes("gelido") || this.def.elem === "ice") && (i.slowT = 1.5),
            this.def.drain && (this.hp = Math.min(this.maxHp, this.hp + s)),
            this.def.elem === "fire" && ((i.burnT = 2), (i.dotDps = this.dmg * 0.1))),
          !0
        );
      }
      return !1;
    }
    siegeTarget() {
      let e = this.siege;
      if (!e) return null;
      if (this._st && this._st.hp > 0 && (this._stT = (this._stT || 0) - x.dt) > 0) return this._st;
      let t = null,
        i = 1e9;
      for (let s of e.targets) {
        if (s.hp <= 0) continue;
        let a = Le(this.x, this.z, s.x, s.z);
        a < i && ((i = a), (t = s));
      }
      return ((this._st = t), (this._stT = 1.5), t);
    }
    updateSiege(e) {
      let t = this._st,
        i = this.def.atk || {},
        s = Le(this.x, this.z, t.x, t.z);
      this.atkCd -= e;
      let a = !!i.range && this.ai !== "exploder",
        r = a ? Math.min(i.range, 7) : this.rad + t.r + 0.35;
      if (s <= r && (!a || x.map.los(this.x, this.z, t.x, t.z))) {
        if (((this.face = Math.atan2(t.x - this.x, t.z - this.z)), this.ai === "exploder"))
          return (
            dn(this.x, this.z, 2.3, this.dmg, { owner: "e", color: 16747040 }),
            (t.hp -= this.dmg),
            (this.exploded = !0),
            this.kill({}),
            0
          );
        if (this.atkCd <= 0) {
          this.atkCd = a ? i.cd || 2 : 1.1;
          let o = this.dmg * (a ? 0.8 : 1);
          ((t.hp -= o),
            (t.hitT = 0.25),
            a && x.fx.beam(this.x, 1, this.z, t.x, 0.8, t.z, this.def.m.e || 16728096, 0.06, 0.12),
            x.fx.burst(t.x, 0.8, t.z, 5, { color: 16752704, speed: 3, life: 0.3, size: 0.15 }),
            (this.state = "attack"),
            (this._atkT = 0.25));
        }
        return 0;
      }
      return this.state === "attack" && (this._atkT -= e) > 0
        ? 0
        : ((this.state = "chase"), this.steer(t.x, t.z, this.spd, e));
    }
    updateAI(e, t) {
      let i = x.player,
        s = x.map,
        a = this.ai,
        r = this.def.atk || {};
      this.atkCd -= e;
      let o = this.rad + i.r + 0.3,
        l = () => {
          this.face = Math.atan2(i.x - this.x, i.z - this.z);
        };
      switch (
        ((this.def.aura === "rad" || this.def.aura === "fire") &&
          (t < 2.5 &&
            (this._aura = (this._aura || 0) - e) <= 0 &&
            ((this._aura = 0.5),
            i.hurt(this.dmg * 0.25, { dot: !0, elem: this.def.aura === "fire" ? "fire" : "toxic" })),
          Q() < e * 6 &&
            x.fx.burst(this.x + (Q() - 0.5) * 2, 0.3, this.z + (Q() - 0.5) * 2, 1, {
              color: this.def.aura === "fire" ? 16738832 : 13172512,
              speed: 0.4,
              life: 0.6,
              size: 0.25,
              up: 1,
            })),
        a)
      ) {
        case "chase":
        case "swarm":
        case "shadow": {
          if (this.state === "wind")
            return (
              (this.wind -= e),
              l(),
              this.wind <= 0 &&
                ((this.state = "attack"),
                this.meleeHit(1, 0.6),
                (this.atkCd = a === "swarm" ? 0.8 : 1.1),
                (this.wind = 0),
                (this._atkT = 0.25)),
              0
            );
          if (this.state === "attack") return ((this._atkT -= e), this._atkT <= 0 && (this.state = "chase"), 0);
          if (t < o + 0.15 && this.atkCd <= 0)
            return ((this.state = "wind"), (this.wind = a === "swarm" ? 0.18 : 0.3), 0);
          let c = i.x,
            d = i.z;
          if (a === "swarm") {
            let h = Math.sin(this.t * 3 + this.uid) * 0.8;
            ((c += Math.cos(this.t + this.uid) * h), (d += Math.sin(this.t + this.uid) * h));
          }
          return t < o ? (l(), 0) : this.steer(c, d, this.spd, e);
        }
        case "ranged":
        case "healer":
        case "shielder":
        case "sniper":
        case "mortar":
        case "phaser": {
          let c = r.range || 8,
            d = r.minR ?? 3;
          if (a === "healer" || a === "shielder") {
            if ((this._sup = (this._sup ?? 1.5) - e) <= 0) {
              this._sup = a === "healer" ? 2 : 3;
              let m = 0;
              for (let g of rn(this.x, this.z, 7, xp))
                if (
                  !(g === this || g.dead) &&
                  (a === "healer" &&
                    g.hp < g.maxHp &&
                    ((g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.15)),
                    x.fx.beam(this.x, 1, this.z, g.x, 1, g.z, 4259712, 0.08, 0.3),
                    m++),
                  a === "shielder" &&
                    ((g.shielded = 4), x.fx.beam(this.x, 1.2, this.z, g.x, 1, g.z, 4243711, 0.08, 0.3), m++),
                  m >= 3)
                )
                  break;
            }
            return t < 6 ? this.steer(i.x, i.z, this.spd, e, !0) : t > 9 ? this.steer(i.x, i.z, this.spd, e) : (l(), 0);
          }
          a === "phaser" && (this._ph = (this._ph ?? 3) - e) <= 0 && ((this._ph = 3.5 + Q() * 2), this.blinkNear(5, 8));
          let h = s.los(this.x, this.z, i.x, i.z);
          if (this.state === "wind") {
            if (((this.wind -= e), l(), a === "sniper")) {
              let m = this.face;
              x.fx.beam(
                this.x,
                1.1,
                this.z,
                this.x + Math.sin(m) * c,
                1.1,
                this.z + Math.cos(m) * c,
                16719904,
                0.03,
                0.04,
              );
            }
            return (this.wind <= 0 && ((this.state = "chase"), this.fire(t)), 0);
          }
          if (this.burstLeft > 0)
            return (
              (this.bT -= e),
              l(),
              this.bT <= 0 && ((this.bT = r.bcd ?? r.cd ?? 0.15), this.burstLeft--, this.shootOnce()),
              0
            );
          if (t <= c && h && this.atkCd <= 0)
            return (
              (this.state = "wind"),
              (this.wind = a === "sniper" ? 1 : a === "mortar" ? 0.5 : 0.35),
              (this.atkCd = r.cd || 2),
              0
            );
          if (t > c * 0.9 || !h) return this.steer(i.x, i.z, this.spd, e);
          if (t < d) return this.steer(i.x, i.z, this.spd * 0.9, e, !0);
          let f = Math.sin(this.t * 0.7 + this.uid) > 0 ? 1 : -1,
            u = Math.atan2(i.x - this.x, i.z - this.z) + (f * Math.PI) / 2,
            p = this.steer(this.x + Math.sin(u) * 2, this.z + Math.cos(u) * 2, this.spd * 0.45, e);
          return (l(), p);
        }
        case "stalker": {
          let c = this.state;
          if (c === "wind")
            return (
              (this.wind -= e),
              l(),
              (this.cloaked = !1),
              this.wind <= 0 &&
                (this.meleeHit(1.3, 0.7), (this.state = "retreat"), (this.retT = 1.4), (this.atkCd = 3.5)),
              0
            );
          if (c === "retreat")
            return (
              (this.retT -= e),
              this.retT <= 0 && (this.state = "chase"),
              this.steer(i.x, i.z, this.spd * 1.1, e, !0)
            );
          if (
            ((this.cloaked = t > 3.5 && this.atkCd <= 1.5 ? !0 : this.atkCd > 1.5 ? !1 : this.cloaked),
            t < 5 && this.atkCd <= 0)
          ) {
            let d = Math.atan2(i.vx, i.vz) + Math.PI,
              h = i.x + Math.sin(d) * 1.4,
              f = i.z + Math.cos(d) * 1.4;
            return (
              s.circleHits(h, f, this.rad) ||
                (x.fx.burst(this.x, 1, this.z, 10, { color: 6353151, speed: 3, life: 0.3, size: 0.25 }),
                (this.x = h),
                (this.z = f)),
              (this.cloaked = !1),
              (this.state = "wind"),
              (this.wind = 0.4),
              x.fx.telegraph(this.x, this.z, 1.5, 0.4, 6353151),
              ae.play("beep", { p: 2 }),
              0
            );
          }
          return this.steer(i.x, i.z, this.spd, e);
        }
        case "charger": {
          if (this.state === "wind")
            return (
              (this.wind -= e),
              l(),
              Q() < 0.5 &&
                x.fx.burst(this.x, 0.3, this.z, 1, { color: 11178096, speed: 2, life: 0.4, size: 0.3, add: !1 }),
              this.wind <= 0 &&
                ((this.state = "charge"),
                (this.chT = 0.65),
                (this.chA = this.face),
                (this.hitP = !1),
                ae.play("roar", { gap: 1, v: 0.25 })),
              0
            );
          if (this.state === "charge") {
            this.chT -= e;
            let c = this.spd * 3.6,
              d = this.x,
              h = this.z,
              [f, u] = s.move(this.x, this.z, this.rad * 0.8, Math.sin(this.chA) * c * e, Math.cos(this.chA) * c * e);
            return (
              (this.x = f),
              (this.z = u),
              (this.face = this.chA),
              !this.hitP &&
                this.meleeHit(1.5, 0.3) &&
                ((this.hitP = !0), (i.vx += Math.sin(this.chA) * 14), (i.vz += Math.cos(this.chA) * 14)),
              Math.hypot(f - d, u - h) < c * e * 0.3 &&
                ((this.state = "stun"),
                (this.stunT = 1),
                x.R.addShake(0.1),
                x.fx.burst(this.x, 0.5, this.z, 10, { color: 11178096, add: !1, speed: 3, life: 0.5, size: 0.3 })),
              this.chT <= 0 && ((this.state = "stun"), (this.stunT = 0.5)),
              c
            );
          }
          return this.state === "stun"
            ? ((this.stunT -= e), this.stunT <= 0 && ((this.state = "chase"), (this.atkCd = 2 + Q())), 0)
            : t < 7.5 && t > 2 && this.atkCd <= 0 && s.los(this.x, this.z, i.x, i.z)
              ? ((this.state = "wind"), (this.wind = 0.65), 0)
              : t < o + 0.1
                ? (this.atkCd <= -0.5 && (this.meleeHit(1, 0.5), (this.atkCd = 0.4)), l(), 0)
                : this.steer(i.x, i.z, this.spd, e);
        }
        case "leaper": {
          if (this.state === "wind")
            return (
              (this.wind -= e),
              l(),
              this.wind <= 0 &&
                ((this.state = "leap"),
                (this.lT = 0),
                (this.lDur = 0.5),
                (this.lsx = this.x),
                (this.lsz = this.z),
                (this.ltx = i.x),
                (this.ltz = i.z),
                x.fx.telegraph(i.x, i.z, 1.3, 0.5, 16736288)),
              0
            );
          if (this.state === "leap") {
            this.lT += e;
            let c = Math.min(1, this.lT / this.lDur),
              d = this.lsx + (this.ltx - this.lsx) * c,
              h = this.lsz + (this.ltz - this.lsz) * c;
            return (
              s.solidW(d, h) || ((this.x = d), (this.z = h)),
              (this.leapY = Math.sin(c * Math.PI) * 1.8),
              c >= 1 &&
                ((this.leapY = 0),
                (this.state = "chase"),
                (this.atkCd = 2.2 + Q()),
                x.fx.burst(this.x, 0.2, this.z, 10, { color: 9075290, add: !1, speed: 3, life: 0.4, size: 0.3 }),
                Le(this.x, this.z, i.x, i.z) < 1.3 + i.r && i.hurt(this.dmg * 1.3, { src: this, melee: !0 })),
              6
            );
          }
          return t > 2.5 && t < 8 && this.atkCd <= 0 && s.los(this.x, this.z, i.x, i.z)
            ? ((this.state = "wind"), (this.wind = 0.35), 0)
            : t < o + 0.1
              ? (this.atkCd <= 0 && (this.meleeHit(1, 0.5), (this.atkCd = 1)), l(), 0)
              : this.steer(i.x, i.z, this.spd, e);
        }
        case "exploder":
          return this.state === "fuse"
            ? ((this.wind -= e),
              this.rig.root.scale.setScalar(this.scale * (1 + (0.45 - this.wind) * 0.6)),
              Math.floor(this.wind * 16) % 2 === 0 && (this.hitFlash = 0.05),
              this.wind <= 0 &&
                ((this.exploded = !0),
                dn(this.x, this.z, 2.3, this.dmg, { owner: "e", color: this.def.cloud ? 12648256 : 16747040 }),
                this.kill({})),
              0)
            : t < 1.4 + this.rad
              ? ((this.state = "fuse"),
                (this.wind = 0.45),
                ae.play("beep", { p: 1.5 }),
                x.fx.telegraph(this.x, this.z, 2.3, 0.45, 16736288),
                0)
              : this.steer(i.x, i.z, this.spd, e);
        case "spawner":
          return (
            l(),
            (this._sp = (this._sp ?? 1) - e) <= 0 &&
              ((this._sp = 4.5),
              this.children < 5 &&
                t < 20 &&
                (this.summoned || 0) < 12 &&
                this.summon(this.ent?.spawn || this.def.spawn || "rastrero", 1, this.lvl)),
            0
          );
        case "turret": {
          let c = s.los(this.x, this.z, i.x, i.z);
          return (
            l(),
            this.burstLeft > 0
              ? ((this.bT -= e), this.bT <= 0 && ((this.bT = r.cd || 0.25), this.burstLeft--, this.shootOnce()), 0)
              : (t < (r.range || 10) && c && this.atkCd <= 0 && ((this.atkCd = r.rest || r.cd || 2), this.fire(t)), 0)
          );
        }
        case "flyer": {
          if (this.def.melee) {
            if (this.state === "dive") {
              this.dT -= e;
              let f = this.steer(i.x, i.z, this.spd * 1.8, e);
              return (
                t < o + 0.2 && (this.meleeHit(1, 0.4), (this.state = "orbit"), (this.atkCd = 1.6 + Q())),
                this.dT <= 0 && (this.state = "orbit"),
                f
              );
            }
            this.atkCd <= 0 && ((this.state = "dive"), (this.dT = 1.2));
          } else
            this.atkCd <= 0 &&
              t < (r.range || 9) &&
              s.los(this.x, this.z, i.x, i.z) &&
              ((this.atkCd = r.cd || 1.5), this.fire(t));
          let c = this.t * (0.6 + (this.uid % 3) * 0.15) + this.uid,
            d = this.def.melee ? 3.5 : 5.5,
            h = this.steer(i.x + Math.cos(c) * d, i.z + Math.sin(c) * d, this.spd, e);
          return (this.def.melee || l(), h);
        }
        case "burrower":
          return this.burrowed
            ? (Q() < e * 12 &&
                x.fx.burst(this.x, 0.1, this.z, 1, {
                  color: 11571296,
                  add: !1,
                  speed: 1.5,
                  life: 0.5,
                  size: 0.35,
                  up: 1,
                  grav: 5,
                }),
              t < 1.6 && this.atkCd <= 0
                ? ((this.state = "emerge"),
                  (this.burrowed = !1),
                  (this.wind = 0.45),
                  x.fx.telegraph(this.x, this.z, 1.6, 0.45, 16736288),
                  (this.rig.root.visible = !0),
                  (this.leapY = -1),
                  0)
                : this.steer(i.x, i.z, this.spd * 1.25, e))
            : this.state === "emerge"
              ? ((this.wind -= e),
                (this.leapY = -this.wind * 2),
                this.wind <= 0 &&
                  ((this.leapY = 0),
                  (this.state = "up"),
                  (this.upT = 2.6),
                  x.fx.burst(this.x, 0.2, this.z, 18, {
                    color: 11571296,
                    add: !1,
                    speed: 4,
                    life: 0.6,
                    size: 0.35,
                    up: 1.5,
                    grav: 8,
                  }),
                  Le(this.x, this.z, i.x, i.z) < 1.6 + i.r && i.hurt(this.dmg * 1.4, { src: this, melee: !0 })),
                0)
              : ((this.upT -= e),
                this.upT <= 0
                  ? ((this.burrowed = !0), (this.rig.root.visible = !1), (this.atkCd = 1.5), (this.state = "chase"), 0)
                  : t < o + 0.1
                    ? (this.atkCd <= 0 && (this.meleeHit(1, 0.5), (this.atkCd = 1)), l(), 0)
                    : this.steer(i.x, i.z, this.spd * 0.8, e));
      }
      return 0;
    }
    fire(e) {
      let t = this.def.atk || {};
      if (t.burst) {
        ((this.burstLeft = t.burst), (this.bT = 0));
        return;
      }
      this.shootOnce();
    }
    shootOnce() {
      let e = x.player,
        t = this.def.atk || {},
        i = t.pspd ? (Le(this.x, this.z, e.x, e.z) / t.pspd) * 0.5 : 0,
        s = e.x + e.vx * i,
        a = e.z + e.vz * i,
        r = Math.atan2(s - this.x, a - this.z),
        o = t.proj;
      if (o === "zap") {
        Le(this.x, this.z, e.x, e.z) <= (t.range || 7) &&
          x.map.los(this.x, this.z, e.x, e.z) &&
          (x.fx.zap(this.x, this.z, e.x, e.z, 9426175, 1.4),
          e.hurt(this.dmg, { elem: "shock" }),
          ae.play("zap", { gap: 0.1, v: 0.6 }));
        return;
      }
      if (o === "laser") {
        let c = t.range || 16,
          d = Math.sin(this.face),
          h = Math.cos(this.face),
          f = c;
        for (let g = 0.5; g < c; g += 0.3)
          if (x.map.opaqueAt(Math.floor(this.x + d * g), Math.floor(this.z + h * g))) {
            f = g;
            break;
          }
        x.fx.beam(this.x, 1.1, this.z, this.x + d * f, 1.1, this.z + h * f, 16724016, 0.18, 0.25);
        let u = e.x - this.x,
          p = e.z - this.z,
          m = u * d + p * h;
        (m > 0 && m < f && Math.hypot(u - d * m, p - h * m) < 0.6 && e.hurt(this.dmg, { elem: "energy" }),
          ae.play("laser", { gap: 0.1, v: 0.6 }));
        return;
      }
      if (o === "shell" || o === "acidlob") {
        (ep(this, e.x + e.vx * 0.6, e.z + e.vz * 0.6, this.dmg, {
          aoe: o === "shell" ? 2 : 1.8,
          color: o === "shell" ? 16752704 : 10354506,
          elem: o === "acidlob" ? "toxic" : null,
          pool: o === "acidlob",
        }),
          ae.play("thump", { gap: 0.1, v: 0.5 }));
        return;
      }
      let l = t.fan || 1;
      for (let c = 0; c < l; c++)
        Na(this, o, r + (c - (l - 1) / 2) * 0.22, t.pspd || 10, this.dmg, { slow: t.slow, elem: t.elem });
      ae.play(o === "bullet" ? "enemyshot" : "orbshot", { gap: 0.05, v: 0.6 });
    }
    updateBoss(e, t) {
      let i = x.player;
      if (!this.alerted) return 0;
      if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
        ((this.phase = 2),
          (this.spd *= 1.25),
          ae.play("roar"),
          x.R.addShake(0.6),
          x.fx.ring(this.x, this.z, 8, this.def.m.e, 0.8),
          (this.moveT = 0.5));
        let a = this.def.moves.find((r) => r.startsWith("summon"));
        if (a) {
          let [, r, o] = a.split(":");
          this.summon(r, Math.ceil(+o * 1.5));
        }
      }
      if (this.act) {
        let a = this.act;
        return (
          (a.t += e),
          (a.upd(e, a) === "done" || a.t > (a.max || 8)) &&
            ((this.act = null),
            (this.invuln = !1),
            (this.burrowed = !1),
            (this.rig.root.visible = !0),
            (this.leapY = 0)),
          a.spd || 0
        );
      }
      if (
        ((this.moveT -= e),
        t < this.rad + i.r + 0.2 &&
          (this._ct = (this._ct || 0) - e) <= 0 &&
          ((this._ct = 0.7), i.hurt(this.dmg * 0.6, { src: this, melee: !0 })),
        this.moveT <= 0)
      ) {
        let a = this.moves[this.moveI % this.moves.length];
        return (
          this.moveI++,
          this.moveI % this.moves.length === 0 && bd(this.moves),
          (this.moveT = (this.phase === 2 ? 1.5 : 2.3) + Q() * 0.8),
          this.startMove(a),
          0
        );
      }
      let s = this.static ? 0 : t > 6 ? 1 : t < 3.5 ? -1 : 0;
      if (s === 0) {
        this.face = Math.atan2(i.x - this.x, i.z - this.z);
        let a = this.face + Math.PI / 2;
        return this.steer(this.x + Math.sin(a) * 2, this.z + Math.cos(a) * 2, this.spd * 0.4, e);
      }
      return this.steer(i.x, i.z, this.spd * (s > 0 ? 1 : 0.6), e, s < 0);
    }
    startMove(e) {
      let t = x.player,
        i = this,
        [s, a, r] = e.split(":"),
        o = +(r ?? a) || 6,
        l = this.phase === 2,
        c = () => {
          i.face = Math.atan2(t.x - i.x, t.z - i.z);
        },
        d = this.def.m.e,
        h = (f) =>
          f === "bullet" ? "bullet" : f === "shard" ? "shard" : f === "fire" ? "fire" : f === "acid" ? "acid" : "orb";
      if (s === "summon")
        ((this.act = {
          t: 0,
          max: 0.8,
          upd: (f, u) => {
            if ((c(), u.t > 0.6)) return (i.summon(a, Math.ceil(o * (l ? 1.3 : 1))), "done");
          },
        }),
          x.fx.ring(i.x, i.z, 3, d, 0.6),
          ae.play("roar", { v: 0.5 }));
      else if (s === "fan") {
        let f = l ? 3 : 2;
        this.act = {
          t: 0,
          max: 3,
          cd: 0.4,
          upd: (u, p) => {
            if ((c(), (p.cd -= u), p.cd <= 0)) {
              ((p.cd = 0.45), f--);
              let m = i.face;
              for (let g = 0; g < +r; g++) Na(i, h(a), m + (g - (+r - 1) / 2) * 0.16, 10, i.dmg * 0.7);
              if ((ae.play("orbshot"), f <= 0)) return "done";
            }
          },
        };
      } else if (s === "radial") {
        let f = l ? 3 : 2;
        this.act = {
          t: 0,
          max: 3,
          cd: 0.5,
          upd: (u, p) => {
            if (((p.cd -= u), p.cd <= 0)) {
              ((p.cd = 0.6), f--);
              let m = Q() * 6.28;
              for (let g = 0; g < o; g++) Na(i, h(a), m + (g / o) * 6.283, 7.5, i.dmg * 0.6, { life: 4 });
              if ((ae.play("orbshot"), f <= 0)) return "done";
            }
          },
        };
      } else if (s === "spiral")
        this.act = {
          t: 0,
          max: 3.2,
          cd: 0,
          ang: Q() * 6.28,
          upd: (f, u) => {
            if (((u.cd -= f), u.cd <= 0)) {
              ((u.cd = l ? 0.07 : 0.1), (u.ang += 0.32));
              for (let p = 0; p < (l ? 3 : 2); p++)
                Na(i, h(a), u.ang + p * (6.283 / (l ? 3 : 2)), 7, i.dmg * 0.5, { life: 4 });
            }
            if (u.t > 3) return "done";
          },
        };
      else if (s === "charge")
        this.act = {
          t: 0,
          max: 2.5,
          phase: 0,
          upd: (f, u) => {
            if (u.phase === 0) {
              (c(),
                (i.wind = 1),
                u.t > 0.8 &&
                  ((u.phase = 1), (u.ang = i.face), (u.hit = !1), (i.wind = 0), ae.play("roar", { v: 0.6 })));
              return;
            }
            let p = i.spd * 4.2;
            u.spd = p;
            let m = i.x,
              g = i.z,
              [b, y] = x.map.move(i.x, i.z, i.rad * 0.7, Math.sin(u.ang) * p * f, Math.cos(u.ang) * p * f);
            if (
              ((i.x = b),
              (i.z = y),
              !u.hit &&
                Le(i.x, i.z, t.x, t.z) < i.rad + t.r + 0.3 &&
                ((u.hit = !0),
                t.hurt(i.dmg * 1.6, { src: i, melee: !0 }),
                (t.vx += Math.sin(u.ang) * 16),
                (t.vz += Math.cos(u.ang) * 16)),
              Math.hypot(b - m, y - g) < p * f * 0.3 || u.t > 1.9)
            )
              return (
                x.R.addShake(0.4),
                x.fx.burst(i.x, 0.5, i.z, 20, { color: 9075290, add: !1, speed: 5, life: 0.6, size: 0.4 }),
                "done"
              );
          },
        };
      else if (s === "slam")
        (x.fx.telegraph(i.x, i.z, 4.6, 1, 16719904),
          (this.act = {
            t: 0,
            max: 1.2,
            upd: (u, p) => {
              if (((i.wind = 1), p.t > 1))
                return (
                  (i.wind = 0),
                  dn(i.x, i.z, 4.6, i.dmg * 1.6, { owner: "e", color: 16752736 }),
                  x.fx.ring(i.x, i.z, 4.6 * 1.5, 16752736, 0.5),
                  "done"
                );
            },
          }));
      else if (s === "meteor") {
        let f = Math.round(o * (l ? 1.5 : 1)),
          u = [];
        for (let p = 0; p < f; p++) {
          let m = Q() * 6.28,
            g = p === 0 ? 0 : 1.5 + Q() * 5,
            b = t.x + Math.cos(m) * g + t.vx * 0.5,
            y = t.z + Math.sin(m) * g + t.vz * 0.5;
          (u.push([b, y, 1.1 + p * 0.12]), x.fx.telegraph(b, y, 1.8, 1.1 + p * 0.12, 16728080));
        }
        this.act = {
          t: 0,
          max: 3,
          upd: (p, m) => {
            for (let g of u)
              !g[3] &&
                m.t >= g[2] &&
                ((g[3] = 1),
                dn(g[0], g[1], 1.8, i.dmg * 1.2, {
                  owner: "e",
                  color: i.def.elem === "fire" ? 16732176 : 16752704,
                  elem: i.def.elem,
                }));
            if (u.every((g) => g[3])) return "done";
          },
        };
      } else if (s === "burrow")
        this.act = {
          t: 0,
          max: 3.5,
          upd: (f, u) => {
            if (!(u.t < 0.4)) {
              if (
                (u.under ||
                  ((u.under = !0),
                  (i.invuln = !0),
                  (i.burrowed = !0),
                  (i.rig.root.visible = !1),
                  x.fx.burst(i.x, 0.2, i.z, 30, {
                    color: 11571296,
                    add: !1,
                    speed: 5,
                    life: 0.7,
                    size: 0.5,
                    up: 1.4,
                    grav: 8,
                  })),
                u.t < 1.8)
              ) {
                let p = i.steer(t.x, t.z, i.spd * 2.2, f);
                (Q() < 0.6 &&
                  x.fx.burst(i.x, 0.1, i.z, 1, {
                    color: 11571296,
                    add: !1,
                    speed: 2,
                    life: 0.5,
                    size: 0.5,
                    up: 1,
                    grav: 5,
                  }),
                  (u.spd = p));
                return;
              }
              if ((u.tele || ((u.tele = !0), x.fx.telegraph(i.x, i.z, 3, 0.6, 16719904)), u.t > 2.4)) {
                ((i.invuln = !1),
                  (i.burrowed = !1),
                  (i.rig.root.visible = !0),
                  dn(i.x, i.z, 3, i.dmg * 1.5, { owner: "e", color: 11571296 }));
                for (let p = 0; p < 12; p++) Na(i, "orb", (p / 12) * 6.283, 7, i.dmg * 0.5);
                return "done";
              }
            }
          },
        };
      else if (s === "pool")
        this.act = {
          t: 0,
          max: 1.5,
          cd: 0,
          left: o,
          upd: (f, u) => {
            if (((u.cd -= f), u.cd <= 0)) {
              ((u.cd = 0.2), u.left--);
              let p = Q() * 6.28,
                m = Q() * 4;
              if (
                (ep(i, t.x + Math.cos(p) * m, t.z + Math.sin(p) * m, i.dmg * 0.8, {
                  aoe: 2,
                  color: i.def.elem === "fire" ? 16732176 : 10354506,
                  pool: !0,
                  elem: i.def.elem === "fire" ? "fire" : "toxic",
                }),
                u.left <= 0)
              )
                return "done";
            }
          },
        };
      else if (s === "nova")
        (x.fx.telegraph(i.x, i.z, 6.5, 1.1, d),
          (this.act = {
            t: 0,
            max: 1.4,
            upd: (u, p) => {
              if (((i.wind = 1), p.t > 1.1))
                return (
                  (i.wind = 0),
                  x.fx.ring(i.x, i.z, 6.5, d, 0.6),
                  x.fx.burst(i.x, 0.6, i.z, 40, { color: d, speed: 12, life: 0.5, size: 0.4, up: 0.1 }),
                  Le(i.x, i.z, t.x, t.z) < 6.5 && t.hurt(i.dmg * 1.4, { elem: i.def.elem }),
                  i.def.elem === "ice" && Le(i.x, i.z, t.x, t.z) < 6.5 && (t.slowT = 2.5),
                  x.R.addShake(0.3),
                  "done"
                );
            },
          }));
      else if (s === "leap") {
        let f = t.x,
          u = t.z;
        (x.fx.telegraph(f, u, 3, 1, 16719904),
          (this.act = {
            t: 0,
            max: 1.4,
            sx: i.x,
            sz: i.z,
            upd: (p, m) => {
              let g = Math.min(1, m.t / 1),
                b = m.sx + (f - m.sx) * g,
                y = m.sz + (u - m.sz) * g;
              if ((x.map.solidW(b, y) || ((i.x = b), (i.z = y)), (i.leapY = Math.sin(g * Math.PI) * 4), g >= 1))
                return (
                  (i.leapY = 0),
                  dn(i.x, i.z, 3, i.dmg * 1.5, { owner: "e", color: 12577023, elem: i.def.elem }),
                  x.R.addShake(0.5),
                  "done"
                );
            },
          }));
      } else
        s === "missiles"
          ? (this.act = {
              t: 0,
              max: 2.5,
              cd: 0,
              left: o,
              upd: (f, u) => {
                if (((u.cd -= f), u.cd <= 0)) {
                  ((u.cd = 0.15), u.left--);
                  let p = i.face + (Q() - 0.5) * 2.4;
                  if (
                    (x.projs.push({
                      owner: "e",
                      kind: "missile",
                      x: i.x,
                      y: 1.6,
                      z: i.z,
                      vx: Math.sin(p) * 8,
                      vz: Math.cos(p) * 8,
                      dmg: i.dmg * 0.8,
                      life: 4,
                      homing: 1.9,
                      size: 0.2,
                      color: 16732192,
                    }),
                    ae.play("rocket", { gap: 0.08, v: 0.4 }),
                    u.left <= 0)
                  )
                    return "done";
                }
              },
            })
          : s === "laser"
            ? (this.act = {
                t: 0,
                max: 3.5,
                n: l ? 3 : 2,
                cd: 0,
                upd: (f, u) => {
                  if (((u.cd -= f), !u.aim && u.cd <= 0 && ((u.aim = !0), (u.at = 0), c()), u.aim))
                    if (((u.at += f), u.at < 0.8)) {
                      c();
                      let p = 22;
                      x.fx.beam(
                        i.x,
                        1.3,
                        i.z,
                        i.x + Math.sin(i.face) * p,
                        1.3,
                        i.z + Math.cos(i.face) * p,
                        16719904,
                        0.04,
                        0.04,
                      );
                    } else {
                      let m = Math.sin(i.face),
                        g = Math.cos(i.face);
                      x.fx.beam(i.x, 1.3, i.z, i.x + m * 22, 1.3, i.z + g * 22, d, 0.6, 0.35);
                      let b = t.x - i.x,
                        y = t.z - i.z,
                        v = b * m + y * g;
                      if (
                        (v > 0 && Math.hypot(b - m * v, y - g * v) < 0.9 && t.hurt(i.dmg * 1.3, { elem: "energy" }),
                        ae.play("rail", { v: 0.6 }),
                        x.R.addShake(0.2),
                        (u.aim = !1),
                        (u.cd = 0.3),
                        u.n--,
                        u.n <= 0)
                      )
                        return "done";
                    }
                },
              })
            : s === "homing"
              ? (this.act = {
                  t: 0,
                  max: 2,
                  cd: 0,
                  left: o,
                  upd: (f, u) => {
                    if (((u.cd -= f), u.cd <= 0)) {
                      ((u.cd = 0.12), u.left--);
                      let p = Q() * 6.28;
                      if ((Na(i, "homing", p, 5.5, i.dmg * 0.6, { life: 5, color: d }), u.left <= 0)) return "done";
                    }
                  },
                })
              : s === "teleport"
                ? (this.act = {
                    t: 0,
                    max: 1,
                    upd: (f, u) => {
                      if (u.t > 0.3) {
                        i.blinkNear(5, 8);
                        for (let p = 0; p < 16; p++) Na(i, "orb", (p / 16) * 6.283, 6.5, i.dmg * 0.5, { color: d });
                        return "done";
                      }
                    },
                  })
                : (this.act = null);
    }
    remove() {
      x.R.scene.remove(this.rig.root);
    }
  };


// ════════ [517] FunctionDeclaration In (77 bytes) ════════
function In(n, e, t, i, s = {}) {
  let a = new vp(n, e, t, i, s);
  return (x.enemies.push(a), a);
}


// ════════ [518] FunctionDeclaration aa (147 bytes) ════════
function aa(n, e) {
  if (Q() >= e) return [];
  let t = Object.keys(Bd),
    i = n > 25 ? (Q() < 0.4 ? 2 : 1) + (n > 40 && Q() < 0.3 ? 1 : 0) : n > 10 && Q() < 0.25 ? 2 : 1;
  return bd(t.slice()).slice(0, i);
}


// ════════ [519] VariableDeclaration qn,kE,As,Yd,Kd,bp (75 bytes) ════════
var qn = 72,
  kE = new Int32Array(qn * qn),
  As = new Int16Array(qn * qn),
  Yd = 0,
  Kd = 0,
  bp = 0;


// ════════ [520] FunctionDeclaration zE (447 bytes) ════════
function zE(n) {
  if (((bp -= n), bp > 0)) return;
  bp = 0.3;
  let e = x.player,
    t = x.map,
    i = Math.floor(e.x),
    s = Math.floor(e.z);
  ((Yd = i - qn / 2), (Kd = s - qn / 2), As.fill(-1));
  let a = kE,
    r = 0,
    o = 0,
    l = (s - Kd) * qn + (i - Yd);
  for (As[l] = 0, a[o++] = l; r < o;) {
    let c = a[r++],
      d = c % qn,
      h = (c / qn) | 0,
      f = As[c];
    for (let u = 0; u < 4; u++) {
      let p = d + (u === 0 ? 1 : u === 1 ? -1 : 0),
        m = h + (u === 2 ? 1 : u === 3 ? -1 : 0);
      if (p < 0 || m < 0 || p >= qn || m >= qn) continue;
      let g = m * qn + p;
      if (!(As[g] >= 0)) {
        if (t.solidAt(p + Yd, m + Kd)) {
          As[g] = 3e4;
          continue;
        }
        ((As[g] = f + 1), (a[o++] = g));
      }
    }
  }
  x.flow = !0;
}


// ════════ [521] FunctionDeclaration PE (478 bytes) ════════
function PE(n, e) {
  let t = Math.floor(n) - Yd,
    i = Math.floor(e) - Kd;
  if (t < 1 || i < 1 || t >= qn - 1 || i >= qn - 1) return null;
  let s = As[i * qn + t];
  if (s < 0 || s >= 3e4) return null;
  let a = s,
    r = 0,
    o = 0;
  for (let h = -1; h <= 1; h++)
    for (let f = -1; f <= 1; f++) {
      if (!f && !h) continue;
      let u = As[(i + h) * qn + t + f];
      if (!(u < 0 || u >= 3e4)) {
        if (f && h) {
          let p = As[i * qn + t + f],
            m = As[(i + h) * qn + t];
          if (p < 0 || p >= 3e4 || m < 0 || m >= 3e4) continue;
        }
        u < a && ((a = u), (r = f), (o = h));
      }
    }
  if (!r && !o) return null;
  let l = Math.floor(n) + r + 0.5 - n,
    c = Math.floor(e) + o + 0.5 - e,
    d = Math.hypot(l, c) || 1;
  return [l / d, c / d];
}


// ════════ [522] FunctionDeclaration yp (476 bytes) ════════
function yp(n) {
  ((!x.grid || x.grid._w !== x.map.w) && ((x.grid = new Kl(x.map.w, x.map.h, 3)), (x.grid._w = x.map.w)),
    x.grid.clear());
  for (let s of x.enemies) s.dead || x.grid.insert(s);
  zE(n);
  let e = null,
    t = 0,
    i = x.player;
  for (let s = x.enemies.length - 1; s >= 0; s--) {
    let a = x.enemies[s];
    if (!a.update(n)) {
      (a.remove(), (x.enemies[s] = x.enemies[x.enemies.length - 1]), x.enemies.pop());
      continue;
    }
    (!a.dead && a.boss && a.alerted && (e = a), !a.dead && a.alerted && vl(a.x, a.z, i.x, i.z) < 400 && t++);
  }
  ((x.bossActive = e), (x.combatHeat = Math.min(1, t / 8)));
}


// ════════ [523] FunctionDeclaration Rx (67 bytes) ════════
function Rx() {
  for (let n of x.enemies) n.remove();
  x.enemies.length = 0;
}


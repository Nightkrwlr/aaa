// 15-map.js — Tipos de casilla, mapa (Fa), investigación

// ════════ [444] VariableDeclaration F,Ua (154 bytes) ════════
var F = {
    GROUND: 0,
    ROAD: 1,
    FLOOR: 2,
    WALL: 3,
    WATER: 4,
    LAVA: 5,
    ACID: 6,
    ROCK: 7,
    GATE: 8,
    SECRET: 9,
    ICE: 10,
    VOID: 11,
    ARENA: 12,
    BASE: 13,
    DOOR: 14,
    CAVE: 15,
  },
  Ua = new Uint8Array(32);


// ════════ [445] ExpressionStatement ExpressionStatement (74 bytes) ════════
[F.WALL, F.WATER, F.LAVA, F.ROCK, F.GATE, F.SECRET, F.VOID].forEach((n) => (Ua[n] = 1));


// ════════ [446] VariableDeclaration tp (26 bytes) ════════
var tp = new Uint8Array(32);


// ════════ [447] ExpressionStatement ExpressionStatement (59 bytes) ════════
[F.WALL, F.ROCK, F.GATE, F.SECRET, F.VOID].forEach((n) => (tp[n] = 1));


// ════════ [448] VariableDeclaration Fa (2575 bytes) ════════
var Fa = class {
  constructor(e, t) {
    ((this.w = e), (this.h = t));
    let i = e * t;
    ((this.ter = new Uint8Array(i)),
      (this.reg = new Uint8Array(i)),
      (this.dark = new Uint8Array(i)),
      (this.blk = new Uint8Array(i)),
      (this.var = new Uint8Array(i)),
      (this.wh = new Uint8Array(i)),
      (this.props = []),
      (this.decor = []),
      (this.ents = []),
      (this.pois = {}));
  }
  idx(e, t) {
    return t * this.w + e;
  }
  inb(e, t) {
    return e >= 0 && t >= 0 && e < this.w && t < this.h;
  }
  t(e, t) {
    return this.inb(e, t) ? this.ter[t * this.w + e] : F.ROCK;
  }
  set(e, t, i) {
    this.inb(e, t) && (this.ter[t * this.w + e] = i);
  }
  solidAt(e, t) {
    if (!this.inb(e, t)) return !0;
    let i = t * this.w + e;
    return Ua[this.ter[i]] === 1 || this.blk[i] === 1;
  }
  solidW(e, t) {
    return this.solidAt(Math.floor(e), Math.floor(t));
  }
  opaqueAt(e, t) {
    return this.inb(e, t) ? tp[this.ter[t * this.w + e]] === 1 : !0;
  }
  darkAt(e, t) {
    let i = Math.floor(e),
      s = Math.floor(t);
    return this.inb(i, s) ? this.dark[s * this.w + i] : 0;
  }
  regAt(e, t) {
    let i = Math.floor(e),
      s = Math.floor(t);
    return this.inb(i, s) ? this.reg[s * this.w + i] : 0;
  }
  terAt(e, t) {
    return this.t(Math.floor(e), Math.floor(t));
  }
  walkable(e, t) {
    return !this.solidAt(e, t);
  }
  move(e, t, i, s, a, r = !1) {
    let o = e + s;
    if (this.circleHits(o, t, i, r)) {
      o = e;
      let c = Math.sign(s) * Math.min(Math.abs(s), 0.02);
      for (; c && !this.circleHits(o + c, t, i, r) && Math.abs(o - e) < Math.abs(s);) o += c;
    }
    let l = t + a;
    if (this.circleHits(o, l, i, r)) {
      l = t;
      let c = Math.sign(a) * Math.min(Math.abs(a), 0.02);
      for (; c && !this.circleHits(o, l + c, i, r) && Math.abs(l - t) < Math.abs(a);) l += c;
    }
    return [o, l];
  }
  slideMove(e, t, i, s, a) {
    let r = s * s + a * a,
      [o, l] = this.move(e, t, i, s, a);
    if (r < 1e-8) return [o, l];
    let c = ((o - e) * s + (l - t) * a) / r;
    if (c > 0.7) return [o, l];
    let d = [o, l],
      h = c;
    for (let f of [0.45, -0.45, 0.9, -0.9]) {
      let u = Math.cos(f),
        p = Math.sin(f),
        m = (s * u - a * p) * 0.9,
        g = (s * p + a * u) * 0.9,
        [b, y] = this.move(e, t, i, m, g),
        v = ((b - e) * s + (y - t) * a) / r;
      v > h + 0.05 && ((h = v), (d = [b, y]));
    }
    return d;
  }
  circleHits(e, t, i, s = !1) {
    let a = Math.floor(e - i),
      r = Math.floor(e + i),
      o = Math.floor(t - i),
      l = Math.floor(t + i);
    for (let c = o; c <= l; c++)
      for (let d = a; d <= r; d++) {
        if (!this.inb(d, c)) return !0;
        let h = c * this.w + d,
          f = this.ter[h],
          u = s ? tp[f] === 1 : Ua[f] === 1,
          p = !s && !u && this.blk[h] === 1;
        if (!u && !p) continue;
        let m = p ? 0.2 : 0,
          g = Math.max(d + m, Math.min(e, d + 1 - m)),
          b = Math.max(c + m, Math.min(t, c + 1 - m)),
          y = e - g,
          v = t - b;
        if (y * y + v * v < i * i) return !0;
      }
    return !1;
  }
  los(e, t, i, s) {
    let a = Math.floor(e),
      r = Math.floor(t),
      o = Math.floor(i),
      l = Math.floor(s),
      c = i - e,
      d = s - t,
      h = Math.sign(c),
      f = Math.sign(d),
      u = c !== 0 ? Math.abs(1 / c) : 1 / 0,
      p = d !== 0 ? Math.abs(1 / d) : 1 / 0,
      m = c !== 0 ? (h > 0 ? a + 1 - e : e - a) * u : 1 / 0,
      g = d !== 0 ? (f > 0 ? r + 1 - t : t - r) * p : 1 / 0,
      b = 0;
    for (; (a !== o || r !== l) && b++ < 200;)
      if ((m < g ? ((m += u), (a += h)) : ((g += p), (r += f)), this.opaqueAt(a, r))) return !1;
    return !0;
  }
  findFree(e, t, i = 8, s = 0.4) {
    if (!this.circleHits(e, t, s)) return [e, t];
    for (let a = 1; a <= i; a++)
      for (let r = 0; r < 12; r++) {
        let o = (r / 12) * Math.PI * 2,
          l = e + Math.cos(o) * a,
          c = t + Math.sin(o) * a;
        if (!this.circleHits(l, c, s)) return [l, c];
      }
    return [e, t];
  }
};


// ════════ [449] VariableDeclaration fx,Pl (15179 bytes) ════════
var fx = Object.fromEntries(Al.map((n) => [n.id, n])),
  Pl = class {
    constructor() {
      ((this.x = 0),
        (this.z = 0),
        (this.r = 0.36),
        (this.face = 0),
        (this.vx = 0),
        (this.vz = 0),
        (this.hp = 100),
        (this.shield = 0),
        (this.shieldDelay = 0),
        (this.dashT = 0),
        (this.dashCd = 0),
        (this.dashDir = [0, 1]),
        (this.inv = 0),
        (this.ammo = [void 0, void 0]),
        (this.reloadT = [0, 0]),
        (this.fireT = 0),
        (this.spin = 0),
        (this.heat = 0),
        (this.beamT = 0),
        (this.buffs = {}),
        (this.combo = 0),
        (this.comboT = 0),
        (this.berserk = 0),
        (this.phoenixCd = 0),
        (this.target = null),
        (this.flashOn = !0),
        (this.slowT = 0),
        (this.burnT = 0),
        (this.poisonT = 0),
        (this.dotDps = 0),
        (this.hazardT = 0),
        (this.dead = !1),
        (this.healT = 0),
        (this.healAmt = 0),
        (this.orbAng = 0),
        (this.droneT = 0),
        (this.droneAng = 0),
        (this.rig = Eo({})),
        this.rig.root.traverse((e) => {
          e.isMesh && (e.castShadow = !0);
        }),
        (this.hurtFlash = 0),
        (this.stepT = 0),
        (this.aimX = 0),
        (this.aimZ = 0),
        (this.manualAim = !1),
        (this.st = {}),
        (this.ws = [{}, {}]),
        (this.powers = new Set()),
        x.R.scene.add(this.rig.root));
    }
    get S() {
      return x.S;
    }
    get weapon() {
      let e = x.S;
      return e.activeW === 0 ? e.eq.w1 : e.eq.w2;
    }
    recalc() {
      let e = x.S,
        t = {},
        i = (r, o) => {
          t[r] = (t[r] || 0) + o;
        };
      for (let [r, o] of Object.entries(e.perks)) {
        let l = fx[r];
        if (l && l.st) for (let c in l.st) i(c, l.st[c] * o);
      }
      for (let r of Rl) {
        let o = e.research[r.id] || 0;
        if (o) for (let l in r.st) i(l, r.st[l] * o);
      }
      this.powers = new Set();
      for (let [r, o] of Object.entries(e.perks)) {
        let l = fx[r];
        l && l.pow && o && this.powers.add(l.pow);
      }
      tlApply(e, t, i, this.powers); // árbol de talentos (31b): maestrías, efectos de sistema y nodos clave
      for (let r of ["helmet", "suit", "gloves", "boots", "implant", "module"]) {
        let o = e.eq[r];
        if (o) {
          for (let l of _o(o)) i(l.s, l.v);
          for (let l of o.aff) i(l.s, l.v * (1 + 0.1 * (o.upg || 0)));
          o.pow && this.powers.add(o.pow);
        }
      }
      this.st = t;
      let s = e.lvl;
      ((this.maxHp = (mt.playerHp(s) + (t.maxHp || 0)) * (1 + (t.maxHpPct || 0))),
        (this.maxShield = (t.shield || 0) + (t.shieldPct || 0) * this.maxHp));
      let a = (t.armor || 0) / ((t.armor || 0) + mt.armorK(s));
      ((this.dmgRed = qe(1 - (1 - a) * (1 - qe(t.dmgRed || 0, 0, 0.5)), 0, 0.8)),
        (this.regen = (t.hpRegen || 0) + (t.regenPct || 0) * this.maxHp),
        (this.speed = 5.2 * (1 + qe(t.moveSpeed || 0, -0.3, 0.8))),
        (this.pickR = 2 * (1 + (t.pickup || 0)) * (this.powers.has("magnetLord") ? 2 : 1)),
        (this.res = {
          heat: qe(t.resHeat || 0, 0, 0.85),
          cold: qe(t.resCold || 0, 0, 0.85),
          toxic: qe(t.resToxic || 0, 0, 0.85),
          rad: qe(t.resRad || 0, 0, 0.85),
          elec: qe(t.resElec || 0, 0, 0.85),
        }),
        (this.dodge = qe(t.dodge || 0, 0, 0.5)),
        (this.lightRange = 15 * (1 + (t.lightRange || 0))),
        (this.grenadeMax = 3 + (t.grenadeMax || 0)),
        (this.medkitMax = 3 + (t.medkitMax || 0)));
      for (let r = 0; r < 2; r++) {
        let o = r === 0 ? e.eq.w1 : e.eq.w2;
        if (!o) {
          this.ws[r] = null;
          continue;
        }
        let l = Mo(o),
          c = { ...t };
        for (let h of o.aff) c[h.s] = (c[h.s] || 0) + h.v;
        let d = new Set();
        (o.pow && d.add(o.pow),
          o.pow2 && d.add(o.pow2),
          (c.base = l),
          (c.item = o),
          (c.pw = d),
          (c.def = Hn[o.base]),
          (c.mag = Math.max(1, Math.round(l.mag * (1 + (c.magSize || 0))))),
          (c.reloadTime = l.reload / (1 + (c.reload || 0))),
          (c.rate = l.rate * (1 + (c.fireRate || 0))),
          (c.range = l.range * (1 + (c.range || 0))),
          (c.critC = qe(0.05 + l.crit + (c.critChance || 0), 0, 0.9)),
          (c.critM = 1.5 + (c.critDmg || 0)),
          (c.pierceN = l.pierce + (c.pierce || 0) + (d.has("bigBullets") ? 2 : 0)),
          (c.ricoN = l.ricochet + (c.ricochet || 0) + (d.has("ricochetAll") ? 3 : 0)),
          (c.multi = Math.round(c.multishot || 0)),
          (c.aoeR = l.aoe * (1 + (c.aoe || 0))),
          (c.dmgBase = l.dmg * (1 + (c.dmg || 0)) * (d.has("bigBullets") ? 1.4 : 1)),
          (this.ws[r] = c),
          (this.ammo[r] > c.mag || this.ammo[r] === void 0) && (this.ammo[r] = c.mag));
      }
      ((this.hp = Math.min(this.hp, this.maxHp)),
        (this.shield = Math.min(this.shield, this.maxShield)),
        this.refreshLook(),
        ee("stats"));
    }
    refreshLook() {
      let e = x.S,
        t = e.eq.suit ? ai[e.eq.suit.base] : null,
        i = e.eq.helmet ? ai[e.eq.helmet.base] : null,
        s =
          (e.char || "") +
          (e.eq.suit?.base || "") +
          (e.eq.helmet?.base || "") +
          (e.eq.helmet?.r ?? "") +
          (e.eq.gloves?.base || "");
      if (this._look !== s) {
        this._look = s;
        let o = this.rig.root,
          l = { 0: 4251903, 1: 6280026, 2: 4161535, 3: 16769082, 4: 16738832, 5: 16732120 },
          c =
            e.eq.suit && Et.hasActor("suit_" + e.eq.suit.base)
              ? "suit_" + e.eq.suit.base
              : Et.hasActor("player")
                ? "player"
                : null;
        if (c) {
          let d = new Pa(c, 1.75),
            h = Ei(0.42);
          // sin contorno ni luz de borde permanentes: solo se ve su silueta cuando un muro u obstáculo lo tapa
          (d.fx.setAura(0, 0).setRim(0, 0), d.addSilhouette());
          (d.root.add(h), (this.rig = { root: d.root, actor: d, recoil: 0, shadow: h }));
        } else if (Ln.has(e.char || br[0])) {
          let d = t ? t.col : 5200444,
            h = new Da(e.char || br[0], 1.6, { recolor: { suit: d } });
          h.addSilhouette();
          let f = Ei(0.42);
          (h.root.add(f), (this.rig = { root: h.root, model: h, recoil: 0, shadow: f }));
        } else
          this.rig = Eo({
            suit: t ? t.col : 5200444,
            hat: i ? i.model : "tac",
            hatC: i ? i.col : void 0,
            visorC: l[e.eq.helmet?.r ?? 0],
            glove: e.eq.gloves ? ai[e.eq.gloves.base].col : void 0,
            visor: !0,
          });
        (this.rig.root.position.copy(o.position),
          this.rig.root.rotation.copy(o.rotation),
          x.R.scene.remove(o),
          x.R.scene.add(this.rig.root),
          (this._wkey = null));
      }
      let a = this.weapon,
        r = a ? a.id : "none";
      this._wkey !== r &&
        !this.rig.actor &&
        !this.rig.model &&
        ((this._wkey = r), Lg(this.rig, a ? a.base : null, a ? a.r : 0));
    }
    dyn() {
      let e = this.buffs,
        t = this.hp < this.maxHp * 0.35,
        i = 1,
        s = 1,
        a = 1;
      (e.fury && (i *= 2),
        e.hyper && (s *= 1.8),
        e.haste && (a *= 1.5),
        e.stim && ((i *= 1.35), (s *= 1.35)),
        e.frenzy && ((s *= 1.3), (a *= 1.3)),
        e.unstoppable && (i *= 1.6),
        this.powers.has("adrenaline") && t && ((i *= 1.5), (a *= 1.3)),
        this.powers.has("berserker") && (s *= 1 + this.berserk * 0.02),
        this.powers.has("nightStalker") && x.inDark && (i *= 1.3),
        this.slowT > 0 && !e.unstoppable && (a *= 0.6),
        this.hazSlow && (a *= 1 - this.hazSlow));
      let r = Di[x.S.diff] || Di.soldado;
      return { dmg: i, rate: s, spd: a, diff: r };
    }
    addBuff(e, t) {
      let i = t ?? Oi[e].dur;
      ((this.buffs[e] = Math.max(this.buffs[e] || 0, i)),
        e === "plasma" && (this.shield = Math.max(this.shield, this.maxHp * 0.6)),
        ee("buff", e));
    }
    heal(e, t) {
      let i = e * (1 + (this.st.healBonus || 0)),
        s = this.hp;
      ((this.hp = Math.min(this.maxHp, this.hp + i)),
        !t && this.hp - s > 1 && x.fx.text(this.x, 1.8, this.z, "+" + Math.round(this.hp - s), "#6dff8a", 13));
    }
    hurt(e, t = {}) {
      if (this.dead || x.uiBlockDamage || this.inv > 0 || this.buffs.ghost) return 0;
      if (!t.dot && Q() < this.dodge) return (x.fx.text(this.x, 1.9, this.z, "ESQUIVA", "#bfe8ff", 12), 0);
      let i = e * (1 - this.dmgRed),
        s = t.elem;
      if (
        (s === "fire"
          ? (i *= 1 - this.res.heat * 0.6)
          : s === "ice"
            ? (i *= 1 - this.res.cold * 0.6)
            : s === "toxic"
              ? (i *= 1 - this.res.toxic * 0.6)
              : s === "shock" && (i *= 1 - this.res.elec * 0.6),
        this.shield > 0)
      ) {
        let a = Math.min(this.shield, i);
        ((this.shield -= a),
          (i -= a),
          this.shield <= 0.01 &&
            (ae.play("shieldbreak"),
            this.powers.has("shieldBurst") &&
              dn(this.x, this.z, 4.5, this.ws[x.S.activeW]?.dmgBase * 4 || 50, { owner: "p", color: 4251903, kb: 6 })));
      }
      return (
        (this.shieldDelay = 3.5),
        i <= 0
          ? 0
          : ((this.hp -= i),
            t.dot ||
              ((this.hurtFlash = Math.min(1, this.hurtFlash + 0.35 + i / this.maxHp)),
              ae.play("hurt", { gap: 0.12 }),
              x.R.addShake(0.08 + Math.min(0.3, i / this.maxHp))),
            t.src && t.melee && this.st.thorns && hs(t.src, e * this.st.thorns, { thorns: !0 }),
            this.hp <= 0 && this.die(),
            i)
      );
    }
    die() {
      if (this.powers.has("phoenix") && this.phoenixCd <= 0) {
        ((this.hp = this.maxHp * 0.5),
          (this.phoenixCd = 180),
          (this.inv = 2.5),
          x.fx.explosion(this.x, this.z, 3, 16747040),
          x.fx.text(this.x, 2.2, this.z, "\xA1F\xC9NIX!", "#ff9a1f", 20, { life: 1.5 }),
          dn(this.x, this.z, 5, this.ws[x.S.activeW]?.dmgBase * 6 || 80, { owner: "p", color: 16747040, kb: 8 }));
        return;
      }
      ((this.hp = 0), (this.dead = !0), ee("playerDied"));
    }
    update(e) {
      let t = x.S,
        i = x.map;
      if (this.dead) {
        if (this.rig.model) {
          this.rig.model.update(e, this.face, "death");
          return;
        }
        this.rig.actor
          ? this.rig.actor.update(e, this.face, "death")
          : (this.rig.root.rotation.z = Math.min(Math.PI / 2, this.rig.root.rotation.z + e * 4));
        return;
      }
      let s = this.dyn();
      for (let m in this.buffs) ((this.buffs[m] -= e), this.buffs[m] <= 0 && (delete this.buffs[m], ee("buff", m)));
      if (
        ((this.comboT -= e),
        this.comboT <= 0 && (this.combo = 0),
        this.berserk > 0 && (this.berserk = Math.max(0, this.berserk - e * 0.5)),
        (this.phoenixCd -= e),
        (this.inv -= e),
        (this.slowT -= e),
        (this.hurtFlash = Math.max(0, this.hurtFlash - e * 1.8)),
        !(x.op && x.op.mods.includes("noregen")) &&
          this.regen > 0 &&
          this.hp < this.maxHp &&
          (this.hp = Math.min(this.maxHp, this.hp + this.regen * e * (1 + (this.st.healBonus || 0)))),
        x.inSafe && this.hp < this.maxHp && (this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.08 * e)),
        this.healT > 0)
      ) {
        let m = Math.min(e, this.healT);
        ((this.healT -= e), this.heal((this.healAmt * m) / 2, !0));
      }
      ((this.shieldDelay -= e),
        this.shieldDelay <= 0 &&
          this.shield < this.maxShield &&
          (this.shield = Math.min(this.maxShield, this.shield + this.maxShield * 0.25 * e)),
        (this.burnT > 0 || this.poisonT > 0) &&
          ((this.burnT -= e),
          (this.poisonT -= e),
          this.hurt(this.dotDps * e, { dot: !0 }),
          Q() < e * 8 &&
            x.fx.burst(this.x, 1, this.z, 1, {
              color: this.burnT > 0 ? 16742944 : 10354506,
              speed: 1,
              life: 0.5,
              size: 0.2,
              up: 1.5,
            })),
        this.updateHazards(e));
      let [r, o] = Tt.moveVec();
      x.uiOpen && ((r = 0), (o = 0));
      let l = this.speed * s.spd;
      if (this.dashT > 0)
        ((this.dashT -= e),
          (this.vx = this.dashDir[0] * 17),
          (this.vz = this.dashDir[1] * 17),
          Q() < 0.8 &&
            x.fx.burst(this.x, 0.6, this.z, 1, { color: 8442111, speed: 0.5, life: 0.35, size: 0.5, size1: 0.1 }));
      else {
        let m = r * l,
          g = o * l,
          b = 1 - Math.exp(-e * 14);
        ((this.vx += (m - this.vx) * b), (this.vz += (g - this.vz) * b));
      }
      if (((this.dashCd -= e), Tt.hit("dash") && this.dashCd <= 0 && !x.uiOpen)) {
        let m = Math.hypot(r, o);
        ((this.dashDir = m > 0.1 ? [r / m, o / m] : [Math.sin(this.face), Math.cos(this.face)]),
          (this.dashT = 0.2),
          (this.inv = Math.max(this.inv, 0.25)),
          (this.dashCd = 2.2 * (1 - qe(this.st.dashCd || 0, 0, 0.6))),
          ae.play("dash"),
          this.powers.has("dashNova") &&
            dn(this.x, this.z, 3.5, (this.ws[t.activeW]?.dmgBase || 20) * 3, { owner: "p", color: 8442111, kb: 9 }));
      }
      let [c, d] = i.slideMove(this.x, this.z, this.r, this.vx * e, this.vz * e),
        h = Math.hypot(c - this.x, d - this.z);
      ((t.stats.dist += h), (this.x = c), (this.z = d));
      let f = h > 0.002;
      (f && ((this.stepT -= h), this.stepT <= 0 && ((this.stepT = 1.1), ae.play("step", { gap: 0.2 }))),
        this.updateAim(e, r, o),
        Tt.hit("swap") && !x.uiOpen && this.swapWeapon(),
        Tt.hit("reload") && !x.uiOpen && this.startReload(),
        Tt.hit("medkit") && !x.uiOpen && this.useMedkit(),
        Tt.hit("stim") && !x.uiOpen && this.useStim(),
        Tt.hit("grenade") && !x.uiOpen && this.throwGrenade(),
        Tt.hit("flash") && !x.uiOpen && t.flags.flashlight && ((this.flashOn = !this.flashOn), ae.play("ui")),
        this.updatePowers(e));
      let u = this.rig;
      u.root.position.set(this.x, 0, this.z);
      let p = u.root.rotation.y;
      if (((u.root.rotation.y = p + fi(p, this.face) * (1 - Math.exp(-e * 18))), u.model)) {
        let m = Math.hypot(this.vx, this.vz);
        u.model.update(
          e,
          u.root.rotation.y,
          this.dashT > 0 ? "dash" : f ? (this.firingNow ? "walkshoot" : "walk") : this.firingNow ? "shoot" : "idle",
          f ? Math.max(0.7, m / 5.2) * (this.dashT > 0 ? 1.8 : 1) : 1,
        );
      } else
        u.actor
          ? ((u.root.rotation.y = 0),
            (u.recoil = Math.max(0, (u.recoil || 0) - e * 6)),
            u.actor.update(
              e,
              this.face,
              this.dashT > 0 ? "dash" : f ? "walk" : u.recoil > 0.05 ? "shoot" : "idle",
              f ? Math.max(0.7, Math.hypot(this.vx, this.vz) / 5.2) : 1,
            ))
          : Ig(u, e, Math.hypot(this.vx, this.vz), f, this.dashT > 0);
      u.root.visible = !(this.inv > 0 && this.dashT <= 0 && Math.floor(x.time * 20) % 2 === 0 && this.inv < 2);
    }
    updateAim(e, t, i) {
      let s = x.S,
        a = this.ws[s.activeW],
        r = s.settings.aim === "mouse" && !Tt.touchMode,
        o = !1;
      if (r && !x.uiOpen) {
        let c = x.R.unproject(Tt.mouse.x, Tt.mouse.y);
        if (
          ((this.aimX = c.x),
          (this.aimZ = c.z),
          (this.face = Math.atan2(c.x - this.x, c.z - this.z)),
          (o = Tt.mouse.down),
          (this.target = null),
          o)
        ) {
          let d = null,
            h = 2.2;
          for (let f of rn(c.x, c.z, 2.2)) {
            let u = Le(f.x, f.z, c.x, c.z);
            u < h && f.targetable() && ((h = u), (d = f));
          }
          this.target = d;
        }
      } else if (a) {
        let c = Math.max(a.range, 17),
          d = this.target;
        if (
          (d &&
            (d.dead ||
              !d.targetable() ||
              Le(d.x, d.z, this.x, this.z) > c * 1.05 ||
              !x.map.los(this.x, this.z, d.x, d.z)) &&
            (d = null),
          !d || ((x.time * 10) | 0) % 3 === 0)
        ) {
          let h = d,
            f = d ? Le(d.x, d.z, this.x, this.z) * 0.85 : c;
          for (let u of rn(this.x, this.z, c)) {
            if (u.dead || !u.targetable()) continue;
            let p = Le(u.x, u.z, this.x, this.z);
            (u.boss && (p *= 0.9), p < f && x.map.los(this.x, this.z, u.x, u.z) && ((f = p), (h = u)));
          }
          d = h;
        }
        ((this.target = d),
          d
            ? ((this.face = Math.atan2(d.x - this.x, d.z - this.z)), (this.aimX = d.x), (this.aimZ = d.z), (o = !0))
            : Math.hypot(t, i) > 0.1 && (this.face = Math.atan2(t, i)));
      }
      if (
        (x.uiOpen && (o = !1),
        o ? (this.idleT = 0) : (this.idleT = (this.idleT || 0) + e),
        (this.firingNow = o && !!a),
        !a)
      )
        return;
      let l = s.activeW;
      if (
        (this.reloadT[l] > 0 &&
          ((this.reloadT[l] -= e), this.reloadT[l] <= 0 && ((this.ammo[l] = a.mag), ae.play("reload"))),
        !o && this.idleT > 1.2 && this.reloadT[l] <= 0 && this.ammo[l] < a.mag && this.startReload(),
        (this.fireT -= e),
        (a.base.kind === "beam" || a.def.spin) &&
          (this.spin = o ? Math.min(1, this.spin + e * (a.def.spin ? 1.2 : 6)) : Math.max(0, this.spin - e * 2)),
        a.pw.has("overheat") && (this.heat = o ? Math.min(25, this.heat + e) : Math.max(0, this.heat - e * 3)),
        o && this.reloadT[l] <= 0 && this.fireT <= 0)
      ) {
        let c = this.dyn(),
          d = a.rate * c.rate * (a.def.spin ? 0.35 + this.spin * 0.65 : 1);
        ((this.fireT += 1 / d), this.fireT < -0.05 && (this.fireT = 0));
        let h = this.ammo[l] <= 3 && a.pw.has("lastShot");
        (ux(this, a, c.dmg * (h ? 3 : 1) * (a.pw.has("overheat") ? 1 + Math.min(0.75, this.heat * 0.03) : 1)),
          (this.rig.recoil = 1),
          a.pw.has("overheat") || (this.ammo[l]--, this.ammo[l] <= 0 && this.startReload()));
      } else this.fireT < 0 && (this.fireT = 0);
    }
    startReload() {
      let e = x.S.activeW,
        t = this.ws[e];
      if (
        !(!t || this.reloadT[e] > 0 || this.ammo[e] >= t.mag) &&
        ((this.reloadT[e] = t.reloadTime), t.pw.has("frostNova"))
      ) {
        (x.fx.ring(this.x, this.z, 5, 10475775, 0.5),
          x.fx.burst(this.x, 0.5, this.z, 30, { color: 12577023, speed: 9, life: 0.5, size: 0.3, up: 0.1 }));
        for (let i of rn(this.x, this.z, 5)) hs(i, t.dmgBase * 2, { freeze: 3 });
      }
    }
    swapWeapon() {
      let e = x.S;
      (e.activeW === 0 ? e.eq.w2 : e.eq.w1) &&
        ((e.activeW = 1 - e.activeW),
        (this.fireT = 0.15),
        (this.spin = 0),
        this.refreshLook(),
        ae.play("reload"),
        ee("stats"));
    }
    useMedkit() {
      let e = x.S;
      if (e.cons.medkit <= 0) {
        ae.play("err");
        return;
      }
      this.hp >= this.maxHp ||
        (e.cons.medkit--,
        (this.healT = 2),
        (this.healAmt = this.maxHp * 0.45),
        ae.play("heal"),
        x.fx.burst(this.x, 1, this.z, 16, { color: 7208842, speed: 2, life: 0.8, size: 0.25, up: 1.2 }),
        ee("cons"));
    }
    useStim() {
      let e = x.S;
      if (e.cons.stim <= 0) {
        ae.play("err");
        return;
      }
      (e.cons.stim--, this.addBuff("stim"), ae.play("buff"), ee("cons"));
    }
    throwGrenade() {
      let e = x.S;
      if (e.cons.grenade <= 0) {
        ae.play("err");
        return;
      }
      (e.cons.grenade--, ee("cons"));
      let t, i;
      this.target
        ? ((t = this.target.x), (i = this.target.z))
        : e.settings.aim === "mouse" && !Tt.touchMode
          ? ((t = this.aimX), (i = this.aimZ))
          : ((t = this.x + Math.sin(this.face) * 7), (i = this.z + Math.cos(this.face) * 7));
      let s = Math.min(10, Le(t, i, this.x, this.z)),
        a = Math.atan2(t - this.x, i - this.z);
      ((t = this.x + Math.sin(a) * s), (i = this.z + Math.cos(a) * s));
      let r = this.ws[e.activeW],
        o = (r ? (r.base.dmg * (1 + (r.dmg || 0))) / Math.max(0.6, Math.sqrt(r.base.rate)) : 20) * 9;
      (x.projs.push({
        owner: "p",
        kind: "grenade",
        x: this.x,
        y: 1.2,
        z: this.z,
        sx: this.x,
        sz: this.z,
        tx: t,
        tz: i,
        t: 0,
        dur: 0.75,
        dmg: o * (1 + (this.st.grenadeDmg || 0)) * this.dyn().dmg,
        aoe: 3.4 * (1 + (this.st.aoe || 0)),
        color: 3820084,
        life: 2,
        hand: !0,
      }),
        ae.play("bow"));
    }
    updatePowers(e) {
      let t = x.S,
        i = this.ws[t.activeW],
        s = i ? i.dmgBase * this.dyn().dmg : 10;
      if (this.powers.has("orbitals")) {
        this.orbAng += e * 3;
        for (let a = 0; a < 3; a++) {
          let r = this.orbAng + a * 2.094,
            o = this.x + Math.cos(r) * 2.2,
            l = this.z + Math.sin(r) * 2.2;
          x.fx.drawOrb(o, 0.9, l, 0.12, 1731200);
          for (let c of rn(o, l, 0.7))
            (c._orbT || 0) < x.time &&
              ((c._orbT = x.time + 0.35), hs(c, s * 0.8 * Math.max(1, i ? i.base.rate / 3 : 1), { elem: "energy" }));
        }
      }
      if (
        this.powers.has("burnAura") &&
        (Q() < e * 4 && x.fx.fire(this.x + (Q() - 0.5) * 4, 0.3, this.z + (Q() - 0.5) * 4, 1, 0.2),
        (this._auraT = (this._auraT || 0) - e),
        this._auraT <= 0)
      ) {
        this._auraT = 0.5;
        for (let a of rn(this.x, this.z, 3)) hs(a, s * 0.3, { burn: !0, noText: !1 });
      }
      if (this.powers.has("drone") || (i && i.pw.has("drone"))) {
        this.droneAng += e * 1.2;
        let a = this.x + Math.cos(this.droneAng) * 1.4,
          r = this.z + Math.sin(this.droneAng) * 1.4;
        if ((x.fx.drawOrb(a, 2, r, 0.11, 8415776), (this.droneT -= e), this.droneT <= 0)) {
          let o = null,
            l = 12;
          for (let c of rn(a, r, 12)) {
            let d = Le(c.x, c.z, a, r);
            d < l && c.targetable() && x.map.los(a, r, c.x, c.z) && ((l = d), (o = c));
          }
          if (o) {
            this.droneT = 0.4;
            let c = Math.atan2(o.x - a, o.z - r);
            x.projs.push({
              owner: "p",
              kind: "bullet",
              x: a,
              y: 1.6,
              z: r,
              vx: Math.sin(c) * 30,
              vz: Math.cos(c) * 30,
              dmg: s * 0.35 * Math.max(1, i ? i.base.rate / 3 : 1),
              life: 0.5,
              pierce: 0,
              color: 16766023,
              hit: new Set(),
              w: 0.06,
              len: 0.8,
            });
          }
        }
      }
    }
    updateHazards(e) {
      let t = x.S;
      if (((this.hazSlow = 0), (x.hazard = null), x.map.terAt(this.x, this.z) === F.ACID)) {
        let o = 1 - this.res.toxic;
        (this.hurt(this.maxHp * 0.05 * o * e, { dot: !0 }),
          Q() < e * 6 &&
            x.fx.burst(this.x, 0.2, this.z, 1, { color: 10354506, speed: 1, life: 0.5, size: 0.25, up: 1 }));
      }
      if (x.mode !== "world" || x.inSafe) return;
      let s = De[x.regionId];
      if (!s || !s.hz) return;
      let a = this.res[s.hz.t],
        r = qe((s.hz.req - a) / s.hz.req, 0, 1);
      if (((x.hazard = { t: s.hz.t, deficit: r, req: s.hz.req, res: a }), r > 0)) {
        let o = x.night > 0.5 && s.hz.t === "cold" ? 1.4 : 1;
        (this.hurt(this.maxHp * 0.03 * r * o * e, { dot: !0 }),
          s.hz.t === "cold" && (this.hazSlow = 0.3 * r),
          Q() < e * 3 * r &&
            x.fx.burst(this.x, 1.2, this.z, 1, {
              color:
                fr[s.hz.t].c === "#7fd0ff"
                  ? 12577023
                  : s.hz.t === "heat"
                    ? 16747072
                    : s.hz.t === "rad"
                      ? 15269696
                      : 10354506,
              speed: 0.8,
              life: 0.6,
              size: 0.18,
              up: 1,
            }));
      }
    }
    addXp(e) {
      let t = x.S,
        i = this.dyn(),
        s = (1 + (this.st.xpGain || 0)) * (this.buffs.wisdom ? 2 : 1) * i.diff.xp;
      if (!(t.lvl >= mt.maxLevel))
        for (t.xp += e * s; t.xp >= mt.xpToNext(t.lvl) && t.lvl < mt.maxLevel;) {
          ((t.xp -= mt.xpToNext(t.lvl)), t.lvl++, grantTalentPoint("level", t.lvl));
          let a = this.maxHp;
          (this.recalc(),
            (this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - a) + this.maxHp * 0.3)),
            ee("levelUp", t.lvl));
        }
    }
  };


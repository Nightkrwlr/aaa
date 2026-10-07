// 14-combat.js — Combate: consultas espaciales, daño, explosiones, peligros, proyectiles

// ════════ [422] VariableDeclaration cx (10 bytes) ════════
var cx = [];


// ════════ [423] FunctionDeclaration rn (173 bytes) ════════
function rn(n, e, t, i = []) {
  if (((i.length = 0), !x.grid)) return i;
  x.grid.query(n, e, t + 1.5, cx);
  for (let s of cx) {
    if (s.dead) continue;
    let a = t + s.rad;
    vl(s.x, s.z, n, e) <= a * a && i.push(s);
  }
  return i;
}


// ════════ [424] VariableDeclaration Ao (10 bytes) ════════
var Ao = [];


// ════════ [425] FunctionDeclaration ux (2744 bytes) ════════
function ux(n, e, t) {
  let i = e.base,
    s = e.def,
    a = i.kind,
    r = n.face,
    o = n.x + Math.sin(r) * 0.3 + Math.cos(r) * 0.1,
    l = n.z + Math.cos(r) * 0.3 - Math.sin(r) * 0.1,
    c = 1.05,
    d = n.target ? Le(n.target.x, n.target.z, n.x, n.z) + 0.8 : 0,
    h = a === "flame" ? e.range : Math.max(e.range, d),
    f = a !== "flame" && d > e.range + 0.8,
    u = e.dmgBase * t * (f ? 0.7 : 1),
    p = Math.max(1, i.pellets + e.multi + (n.buffs.multi ? 2 : 0)),
    m = (i.speed || 30) * (1 + (e.projSpeed || 0)),
    g = h / Math.max(1, m),
    b = s.tracer || 16771496,
    y = e.pierceN,
    v = e.ricoN,
    _ = e.pw.has("homing");
  ae.play(s.sfx, { gap: a === "flame" || a === "beam" ? 0.09 : 0.03, v: 0.8 });
  let A = (T) => (p > 1 ? (T - (p - 1) / 2) * (a === "pellet" ? 0 : 0.09) : 0);
  if (a === "bullet" || a === "pellet" || a === "bolt") {
    for (let T = 0; T < p; T++) {
      let S = r + A(T) + (Q() - 0.5) * i.spread * 1;
      x.projs.push({
        owner: "p",
        kind: "bullet",
        x: o,
        y: c,
        z: l,
        vx: Math.sin(S) * m,
        vz: Math.cos(S) * m,
        dmg: u,
        life: g * (a === "pellet" ? 0.8 + Q() * 0.3 : 1),
        pierce: y,
        rico: v,
        hit: new Set(),
        color: b,
        ws: e,
        w: a === "bolt" ? 0.08 : e.pw.has("bigBullets") ? 0.14 : 0.055,
        len: a === "bolt" ? 0.8 : i.speed > 50 ? 1.6 : 0.9,
        homing: _,
        aoe: a === "bolt" ? e.aoeR : 0,
        split: e.pw.has("split"),
      });
    }
    x.fx.muzzle(o, c, l, r, b, a === "pellet" ? 1.6 : 1);
  } else if (a === "flame")
    for (let T = 0; T < p; T++) {
      let S = r + (Q() - 0.5) * i.spread + A(T);
      x.projs.push({
        owner: "p",
        kind: "flame",
        x: o,
        y: c - 0.1,
        z: l,
        vx: Math.sin(S) * m,
        vz: Math.cos(S) * m,
        dmg: u,
        life: g,
        pierce: 99,
        hit: new Set(),
        ws: e,
        elemCol: i.elem === "ice" ? 0 : 1,
        r0: 0.25,
        t: 0,
      });
    }
  else if (a === "grenade" || a === "acid") {
    for (let T = 0; T < p; T++) {
      let S = n.target ? n.target.x : n.x + Math.sin(r) * e.range * 0.7,
        k = n.target ? n.target.z : n.z + Math.cos(r) * e.range * 0.7,
        w = (T - (p - 1) / 2) * 1.2,
        E = S + Math.cos(r) * w,
        H = k - Math.sin(r) * w,
        Z = Le(E, H, o, l);
      x.projs.push({
        owner: "p",
        kind: a === "acid" ? "acidlob" : "grenade",
        x: o,
        y: c,
        z: l,
        sx: o,
        sz: l,
        tx: E,
        tz: H,
        t: 0,
        dur: qe(Z / m, 0.25, 1.2),
        dmg: u,
        aoe: e.aoeR,
        ws: e,
        color: a === "acid" ? 10354506 : 3820084,
        life: 3,
      });
    }
    x.fx.muzzle(o, c, l, r, 16760944, 1.2);
  } else if (a === "rocket" || a === "orb" || a === "swarm" || a === "void" || a === "disc") {
    for (let T = 0; T < p; T++) {
      let S = r + A(T) * (a === "swarm" ? 4 : 1) + (Q() - 0.5) * i.spread;
      x.projs.push({
        owner: "p",
        kind: a,
        x: o,
        y: c,
        z: l,
        vx: Math.sin(S) * m,
        vz: Math.cos(S) * m,
        dmg: u,
        life: a === "disc" ? g * 1.6 : a === "swarm" ? g * 1.5 : g,
        pierce: a === "disc" ? y : 0,
        rico: a === "disc" ? v : 0,
        hit: new Set(),
        ws: e,
        aoe: e.aoeR || (a === "swarm" ? 1.2 : 0),
        color: b,
        homing: _ || a === "swarm" || a === "rocket",
        turn: a === "swarm" ? 7 : a === "rocket" ? 1.5 : 4,
        t: 0,
        size: a === "orb" ? 0.32 : a === "void" ? 0.45 : 0.12,
      });
    }
    x.fx.muzzle(o, c, l, r, b, 1.3);
  } else if (a === "beam" || a === "rail") {
    for (let T = 0; T < p; T++) {
      let S = r + A(T) * 0.6;
      Jw(n, o, c, l, S, h, u, a === "rail" ? 99 : 1 + y, e, b, a === "rail" ? 0.35 : 0.12);
    }
    a === "rail" ? (x.R.addShake(0.15), x.fx.muzzle(o, c, l, r, b, 2)) : x.R.flashLight(o, c + 0.2, l, b, 1.4, 4, 0.06);
  } else if (a === "chain")
    for (let T = 0; T < p; T++) {
      let S = n.target && !n.target.dead ? n.target : null;
      if (T > 0 || !S) {
        let k = rn(n.x, n.z, e.range, Ao).filter(
          (w) => w.targetable() && Math.abs(fi(r, Math.atan2(w.x - n.x, w.z - n.z))) < 0.8,
        );
        S = k[Math.floor(Q() * k.length)] || S;
      }
      if (!S) {
        x.fx.zap(o, l, o + Math.sin(r) * 4, l + Math.cos(r) * 4, b, c);
        continue;
      }
      Kw(o, l, S, u, i.chains + v, e, b, c);
    }
}


// ════════ [426] FunctionDeclaration Kw (305 bytes) ════════
function Kw(n, e, t, i, s, a, r, o = 1) {
  let l = new Set(),
    c = t,
    d = n,
    h = e;
  for (let f = 0; f <= s && c; f++) {
    (x.fx.zap(d, h, c.x, c.z, r, f === 0 ? o : 0.9),
      l.add(c),
      Ro(c, i * Math.pow(0.85, f), a, { elem: "shock" }),
      (d = c.x),
      (h = c.z));
    let u = null,
      p = 5.5;
    for (let m of rn(d, h, 5.5, Ao)) {
      if (l.has(m) || !m.targetable()) continue;
      let g = Le(m.x, m.z, d, h);
      g < p && ((p = g), (u = m));
    }
    c = u;
  }
}


// ════════ [427] FunctionDeclaration Jw (548 bytes) ════════
function Jw(n, e, t, i, s, a, r, o, l, c, d) {
  let h = Math.sin(s),
    f = Math.cos(s),
    u = a;
  for (let g = 0.3; g < a; g += 0.25)
    if (x.map.opaqueAt(Math.floor(e + h * g), Math.floor(i + f * g))) {
      u = g;
      break;
    }
  let p = [];
  for (let g of rn(e + (h * u) / 2, i + (f * u) / 2, u / 2 + 1, Ao)) {
    if (!g.targetable()) continue;
    let b = g.x - e,
      y = g.z - i,
      v = b * h + y * f;
    if (v < 0 || v > u) continue;
    let _ = b - h * v,
      A = y - f * v;
    _ * _ + A * A < (g.rad + d) * (g.rad + d) && p.push([v, g]);
  }
  p.sort((g, b) => g[0] - b[0]);
  let m = u;
  for (let g = 0; g < p.length && g < o; g++) (Ro(p[g][1], r, l, {}), g === o - 1 && (m = p[g][0]));
  (x.fx.beam(e, t, i, e + h * m, t, i + f * m, c, d, d > 0.2 ? 0.25 : 0.08),
    (m < u || m < a) && x.fx.hit(e + h * m, t, i + f * m, c, s));
}


// ════════ [428] FunctionDeclaration Ro (1222 bytes) ════════
function Ro(n, e, t, i = {}) {
  if (n.dead) return;
  let s = x.player,
    a = !1,
    r = e;
  if (t) {
    Q() < t.critC + (s.powers.has("nightStalker") && x.inDark ? 0.15 : 0) && ((a = !0), (r *= t.critM));
    let c = { insect: "vsInsect", mutant: "vsMutant", mech: "vsMech", xeno: "vsXeno" }[n.fam];
    r *= 1 + (t[c] || 0) + ((n.elite && t.vsElite) || 0) + ((n.boss && t.vsBoss) || 0);
  }
  let o = i.elem || (t && t.base.elem);
  o && t && (r *= 1 + (t.elemDmg || 0));
  let l = { crit: a, elem: o, ws: t };
  if (t) {
    let c = t.base;
    (Q() < (t.burnChance || 0) + (t.def.burn || 0) + (s.buffs.boom, 0) && (l.burn = !0),
      Q() < (t.freezeChance || 0) + (t.def.freeze || 0) + (s.buffs.frost ? 0.35 : 0) && (l.freeze = 1),
      Q() < (t.shockChance || 0) + (t.def.shock || 0) && (l.shock = !0),
      Q() < (t.poisonChance || 0) + (t.def.poison || 0) && (l.poison = !0));
  }
  if ((hs(n, r, l), t)) {
    let c = (t.lifesteal || 0) + (t.pw.has("vampire") ? 0.03 : 0) + (s.buffs.vamp ? 0.08 : 0);
    if ((c > 0 && s.heal(Math.min(r * c, s.maxHp * 0.04), !0), a && t.pw.has("chainCrit") && !i.noChain)) {
      let d = null,
        h = 6;
      for (let f of rn(n.x, n.z, 6, [])) {
        if (f === n || !f.targetable()) continue;
        let u = Le(f.x, f.z, n.x, n.z);
        u < h && ((h = u), (d = f));
      }
      d && Zw(n, d, r * 0.5, t);
    }
    ((Q() < (t.explodeChance || 0) || s.buffs.boom) &&
      !i.noExplode &&
      dn(n.x, n.z, 1.8 * (1 + (t.aoe || 0)), e * 0.6, { owner: "p", color: 16747040, ws: t, small: !0 }),
      t.pw.has("blackhole") &&
        Q() < 0.08 &&
        !i.noExplode &&
        Oa({ x: n.x, z: n.z, r: 2.6, t: 1.8, dps: e * 0.8, owner: "p", kind: "void", pull: 6, color: 9060607 }));
  }
}


// ════════ [429] FunctionDeclaration Zw (107 bytes) ════════
function Zw(n, e, t, i) {
  (x.fx.zap(n.x, n.z, e.x, e.z, 9426175, 0.9), Ro(e, t, i, { elem: "shock", noChain: !0, noExplode: !0 }));
}


// ════════ [430] FunctionDeclaration hs (1625 bytes) ════════
function hs(n, e, t = {}) {
  if (!n || n.dead || n.invuln) return 0;
  let i = e * n.dmgTakenMul();
  if ((t.thorns && (i = e), n.shieldHp > 0)) {
    let a = Math.min(n.shieldHp, i);
    ((n.shieldHp -= a),
      (i -= a),
      n.shieldHp <= 0 && x.fx.burst(n.x, 1, n.z, 14, { color: 4251903, speed: 5, life: 0.4, size: 0.2 }));
  }
  if (
    ((n.hp -= i), (n._flashCd || 0) <= x.time && ((n.hitFlash = 0.07), (n._flashCd = x.time + 0.22)), n.alert(!0), t.kb)
  ) {
    let a = t.kbA ?? Math.atan2(n.x - x.player.x, n.z - x.player.z);
    ((n.kbx += (Math.sin(a) * t.kb) / Math.max(1, n.mass)), (n.kbz += (Math.cos(a) * t.kb) / Math.max(1, n.mass)));
  }
  if (
    (t.burn && ((n.st.burn = 3), (n.st.burnDps = Math.max(n.st.burnDps || 0, e * 0.35))),
    t.poison && ((n.st.poison = 5), (n.st.poisonDps = Math.max(n.st.poisonDps || 0, e * 0.22))),
    t.shock &&
      ((n.st.shock = 3), Q() < 0.5 && x.fx.burst(n.x, 1, n.z, 4, { color: 9426175, speed: 4, life: 0.2, size: 0.12 })),
    t.freeze &&
      ((n.st.slow = Math.max(n.st.slow || 0, 2)),
      (n.st.frz = (n.st.frz || 0) + t.freeze),
      n.st.frz >= 3 &&
        !n.boss &&
        ((n.st.frozen = 1.6),
        (n.st.frz = 0),
        x.fx.burst(n.x, 1, n.z, 10, { color: 12577023, speed: 3, life: 0.4, size: 0.2 }))),
    x.S.settings.dmgNums !== !1 && !t.noText && i > 0)
  ) {
    let a = t.crit,
      r = t.crit
        ? "#ffd447"
        : t.elem === "fire" || t.burnTick
          ? "#ff9a3c"
          : t.elem === "toxic" || t.poisonTick
            ? "#9dff4a"
            : t.elem === "ice"
              ? "#9fd8ff"
              : t.elem === "shock"
                ? "#a8c8ff"
                : t.elem === "energy"
                  ? "#c8a0ff"
                  : "#ffffff";
    a
      ? x.fx.text(n.x, 1.6 * n.scale + 0.4, n.z, dx(i) + "!", r, 25, { crit: !0, life: 1.1, vy: 2.2 })
      : ((n._dmgAcc = (n._dmgAcc || 0) + i),
        (x.time - (n._dmgT || -9) >= 0.22 || n.hp <= 0) &&
          (x.fx.text(n.x, 1.6 * n.scale + 0.4, n.z, dx(n._dmgAcc), r, t.burnTick || t.poisonTick ? 12 : 15, {
            crit: !1,
          }),
          (n._dmgAcc = 0),
          (n._dmgT = x.time)));
  }
  !t.burnTick && !t.poisonTick && ae.play(t.crit ? "crit" : "hit", { gap: 0.04, p: n.fam === "mech" ? 1.4 : 0.8 });
  let s = x.player;
  return (
    n.hp > 0 && !n.boss && !n.elite && s && (t.ws?.execute || s.st.execute) && n.hp < n.maxHp * 0.1 && (n.hp = 0),
    n.hp <= 0 && n.kill(t),
    i
  );
}


// ════════ [431] FunctionDeclaration dx (102 bytes) ════════
function dx(n) {
  return n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + "k" : n >= 100 || n >= 10 ? Math.round(n) : n.toFixed(1);
}


// ════════ [432] FunctionDeclaration dn (498 bytes) ════════
function dn(n, e, t, i, s = {}) {
  if (
    (x.fx.explosion(n, e, s.small ? t * 0.6 : t, s.color ?? 16747040),
    ae.play("boom", { gap: 0.06, v: s.small ? 0.4 : 1 }),
    s.owner === "e")
  ) {
    let a = x.player,
      r = Le(a.x, a.z, n, e);
    r < t + a.r && a.hurt(i * (1 - (0.4 * r) / t), { elem: s.elem });
    return;
  }
  for (let a of rn(n, e, t, [])) {
    let r = Le(a.x, a.z, n, e),
      o = 1 - 0.45 * qe(r / t, 0, 1);
    if (
      (s.ws
        ? Ro(a, i * o, s.ws, { noExplode: !0, noChain: !0 })
        : hs(a, i * o, { burn: s.burn, fromKillExplode: s.fromKillExplode }),
      s.kb)
    ) {
      let l = Math.atan2(a.x - n, a.z - e);
      ((a.kbx += (Math.sin(l) * s.kb) / a.mass), (a.kbz += (Math.cos(l) * s.kb) / a.mass));
    }
  }
}


// ════════ [433] FunctionDeclaration Oa (52 bytes) ════════
function Oa(n) {
  ((n.tick = 0), (n.max = n.t), x.hazards.push(n));
}


// ════════ [434] FunctionDeclaration Qw (1558 bytes) ════════
function Qw(n) {
  let e = x.player;
  for (let t = x.hazards.length - 1; t >= 0; t--) {
    let i = x.hazards[t];
    if (((i.t -= n), (i.tick -= n), i.kind === "mine")) {
      let s = Math.sin(x.time * (i.trig ? 30 : 6)) > 0;
      if ((x.fx.drawOrb(i.x, 0.18, i.z, 0.16, s ? 16732192 : 3811856), i.arm > 0)) {
        i.arm -= n;
        continue;
      }
      (!i.trig &&
        Le(e.x, e.z, i.x, i.z) < i.r &&
        ((i.trig = 0.35), x.fx.telegraph(i.x, i.z, 1.8, 0.35, 16732192), ae.play("beep", { p: 2.2 })),
        i.trig &&
          ((i.trig -= n), i.trig <= 0 && (dn(i.x, i.z, 1.8, i.dps, { owner: "e", color: 16752704 }), (i.t = 0))),
        i.t <= 0 && x.hazards.splice(t, 1));
      continue;
    }
    if (i.t <= 0) {
      (i.kind === "void" && dn(i.x, i.z, i.r, i.dps * 1.5, { owner: i.owner, color: 9060607 }), x.hazards.splice(t, 1));
      continue;
    }
    if (Q() < n * (i.kind === "void" ? 30 : 8)) {
      let s = Q() * 6.28,
        a = Q() * i.r;
      i.kind === "void"
        ? x.fx.burst(i.x + Math.cos(s) * i.r, 0.6, i.z + Math.sin(s) * i.r, 1, {
            color: i.color,
            speed: 0.1,
            life: 0.4,
            size: 0.25,
          })
        : x.fx.burst(i.x + Math.cos(s) * a, 0.1, i.z + Math.sin(s) * a, 1, {
            color: i.color,
            speed: 0.6,
            life: 0.6,
            size: 0.3,
            up: 1.5,
          });
    }
    if (
      (i.kind === "void"
        ? (x.fx.drawOrb(i.x, 0.8, i.z, 0.4 + Math.sin(x.time * 20) * 0.05, 1706032),
          x.fx.drawGlow(i.x, 0.8, i.z, i.r * 1.4, 6299840))
        : x.fx.drawGlow(i.x, 0.12, i.z, i.r * 2.2, i.color === 10354506 ? 2777104 : 4200968),
      i.owner === "p")
    ) {
      if (i.pull)
        for (let s of rn(i.x, i.z, i.r * 1.6, [])) {
          if (s.boss) continue;
          let a = Math.atan2(i.x - s.x, i.z - s.z);
          ((s.kbx += Math.sin(a) * i.pull * n * 3), (s.kbz += Math.cos(a) * i.pull * n * 3));
        }
      if (i.tick <= 0) {
        i.tick = 0.4;
        for (let s of rn(i.x, i.z, i.r, []))
          hs(s, i.dps * 0.4, {
            poison: i.kind === "acid",
            poisonTick: i.kind === "acid",
            elem: i.kind === "void" ? "energy" : "toxic",
          });
      }
    } else
      i.tick <= 0 &&
        ((i.tick = 0.4),
        Le(e.x, e.z, i.x, i.z) < i.r + e.r * 0.5 &&
          (e.hurt(i.dps * 0.4, { dot: !0, elem: i.elem || "toxic" }),
          i.elem === "fire" && ((e.burnT = 2), (e.dotDps = i.dps * 0.1))));
  }
}


// ════════ [435] FunctionDeclaration Qf (478 bytes) ════════
function Qf(n) {
  let e = x.player,
    t = x.map,
    i = x.fx;
  Qw(n);
  let s = x.projs;
  for (let a = s.length - 1; a >= 0; a--) {
    let r = s[a];
    r.life -= n;
    let o = r.life <= 0;
    (r.owner === "p" ? (o = tE(r, n) || o) : (o = iE(r, n, e) || o),
      o &&
        (r.owner === "p" &&
          r.kind === "void" &&
          !r.done &&
          Oa({ x: r.x, z: r.z, r: r.aoe, t: 2, dps: r.dmg * 2.2, owner: "p", kind: "void", pull: 7, color: 9060607 }),
        r.owner === "p" &&
          (r.kind === "rocket" || r.kind === "orb" || r.kind === "swarm") &&
          !r.done &&
          dn(r.x, r.z, r.aoe || 1.5, r.dmg, { owner: "p", ws: r.ws, color: r.color }),
        (s[a] = s[s.length - 1]),
        s.pop()));
  }
}


// ════════ [436] FunctionDeclaration eE (297 bytes) ════════
function eE(n, e, t, i = 10) {
  let s = null,
    a = i;
  for (let d of rn(n.x, n.z, i, Ao)) {
    if (!d.targetable()) continue;
    let h = Le(d.x, d.z, n.x, n.z);
    h < a && ((a = h), (s = d));
  }
  if (!s) return;
  let r = Math.hypot(n.vx, n.vz),
    o = Math.atan2(n.vx, n.vz),
    l = Math.atan2(s.x - n.x, s.z - n.z),
    c = o + qe(fi(o, l), -t * e, t * e);
  ((n.vx = Math.sin(c) * r), (n.vz = Math.cos(c) * r));
}


// ════════ [437] FunctionDeclaration tE (1167 bytes) ════════
function tE(n, e) {
  let t = x.map,
    i = x.fx;
  if (n.kind === "grenade" || n.kind === "acidlob") {
    n.t += e;
    let o = Math.min(1, n.t / n.dur);
    return (
      (n.x = n.sx + (n.tx - n.sx) * o),
      (n.z = n.sz + (n.tz - n.sz) * o),
      (n.y = 1 + Math.sin(o * Math.PI) * (1.2 + n.dur * 2)),
      n.kind === "grenade"
        ? (i.drawRocket(n.x, n.y, n.z, 0, 1, n.hand ? 3820084 : 4872762, 0.09),
          Q() < 0.5 && i.smoke(n.x, n.y, n.z, 1, 8026736, 0.15))
        : i.drawOrb(n.x, n.y, n.z, 0.2, 10354506),
      o >= 1
        ? (n.kind === "grenade"
            ? dn(n.x, n.z, n.aoe || 2.5, n.dmg, { owner: "p", ws: n.ws, color: 16747040, kb: 4 })
            : (dn(n.x, n.z, n.aoe * 0.8, n.dmg, { owner: "p", ws: n.ws, color: 10354506, small: !0 }),
              Oa({ x: n.x, z: n.z, r: n.aoe, t: 3, dps: n.dmg * 0.9, owner: "p", kind: "acid", color: 10354506 })),
          (n.done = !0),
          !0)
        : !1
    );
  }
  if ((n.homing && eE(n, e, n.turn || 4), n.kind === "flame")) {
    ((n.x += n.vx * e), (n.z += n.vz * e), (n.t += e));
    let o = n.r0 + n.t * 2.2;
    if (
      (Q() < 0.3 &&
        (n.elemCol
          ? i.flame(n.x, n.y, n.z, Math.min(1, o), n.t)
          : i.burst(n.x, n.y, n.z, 1, {
              color: 4876928,
              speed: 0.6,
              life: 0.3,
              size: Math.min(1, o) * 0.9,
              size1: 0.05,
            })),
      t.opaqueAt(Math.floor(n.x), Math.floor(n.z)))
    )
      return !0;
    for (let l of rn(n.x, n.z, o, Ao)) n.hit.has(l) || !l.targetable() || (n.hit.add(l), Ro(l, n.dmg, n.ws, {}));
    return !1;
  }
  let s = Math.hypot(n.vx, n.vz) * e,
    a = Math.max(1, Math.ceil(s / 0.3)),
    r = e / a;
  for (let o = 0; o < a; o++) if (nE(n, r)) return (hx(n, e), !0);
  return (hx(n, e), !1);
}


// ════════ [438] FunctionDeclaration hx (600 bytes) ════════
function hx(n, e) {
  let t = x.fx;
  n.kind === "bullet"
    ? t.drawTracer(n.x, n.y, n.z, n.vx, n.vz, n.len || 0.9, n.w || 0.06, n.color)
    : n.kind === "orb"
      ? (t.drawOrb(n.x, n.y, n.z, n.size, n.color),
        Q() < 0.5 && t.burst(n.x, n.y, n.z, 1, { color: n.color, speed: 0.4, life: 0.3, size: 0.3 }))
      : n.kind === "void"
        ? (t.drawOrb(n.x, n.y, n.z, n.size, 1706032), t.drawGlow(n.x, n.y, n.z, 2.2, 9060607))
        : n.kind === "rocket" || n.kind === "swarm"
          ? (t.drawRocket(n.x, n.y, n.z, n.vx, n.vz, 5925450, n.kind === "swarm" ? 0.07 : 0.11),
            t.drawGlow(n.x - n.vx * 0.02, n.y, n.z - n.vz * 0.02, 0.6, 16752704),
            Q() < 0.8 && t.smoke(n.x, n.y, n.z, 1, 9077880, 0.2))
          : n.kind === "disc" && ((n.t += e), t.drawDisc(n.x, n.y, n.z, 0.35, n.t * 25, n.color));
}


// ════════ [439] FunctionDeclaration nE (1503 bytes) ════════
function nE(n, e) {
  let t = x.map,
    i = x.fx,
    s = n.x,
    a = n.z;
  if (((n.x += n.vx * e), (n.z += n.vz * e), t.opaqueAt(Math.floor(n.x), Math.floor(n.z)))) {
    if (n.kind === "disc" && n.rico > 0) {
      n.rico--;
      let o = t.opaqueAt(Math.floor(n.x), Math.floor(a)),
        l = t.opaqueAt(Math.floor(s), Math.floor(n.z));
      return (
        o && (n.vx = -n.vx),
        l && (n.vz = -n.vz),
        !o && !l && ((n.vx = -n.vx), (n.vz = -n.vz)),
        (n.x = s),
        (n.z = a),
        n.hit.clear(),
        ae.play("metal", { gap: 0.08, v: 0.4 }),
        !1
      );
    }
    return (i.hit(s, n.y, a, n.color, Math.atan2(n.vx, n.vz)), !0);
  }
  let r = n.kind === "orb" ? n.size + 0.15 : n.kind === "disc" ? 0.35 : 0.12;
  for (let o of rn(n.x, n.z, r, Ao))
    if (!(n.hit.has(o) || !o.targetable())) {
      if ((n.hit.add(o), n.kind === "rocket" || n.kind === "orb" || n.kind === "swarm" || n.kind === "void"))
        return ((n.life = 0), !0);
      if (
        (Ro(o, n.dmg, n.ws, {}),
        i.hit(n.x, n.y, n.z, o.bloodCol, Math.atan2(n.vx, n.vz)),
        n.aoe && dn(n.x, n.z, n.aoe, n.dmg * 0.5, { owner: "p", ws: n.ws, small: !0 }),
        n.split)
      ) {
        n.split = !1;
        for (let l = -1; l <= 1; l++) {
          let c = Math.atan2(n.vx, n.vz) + l * 0.6;
          x.projs.push({
            owner: "p",
            kind: "bullet",
            x: n.x,
            y: n.y,
            z: n.z,
            vx: Math.sin(c) * 25,
            vz: Math.cos(c) * 25,
            dmg: n.dmg * 0.4,
            life: 0.35,
            pierce: 0,
            rico: 0,
            hit: new Set([o]),
            color: n.color,
            ws: n.ws,
            w: 0.04,
            len: 0.5,
          });
        }
      }
      if (n.rico > 0 && n.kind !== "disc") {
        n.rico--;
        let l = null,
          c = 8;
        for (let d of rn(o.x, o.z, 8, [])) {
          if (n.hit.has(d) || !d.targetable()) continue;
          let h = Le(d.x, d.z, o.x, o.z);
          h < c && ((c = h), (l = d));
        }
        if (l) {
          let d = Math.atan2(l.x - n.x, l.z - n.z),
            h = Math.hypot(n.vx, n.vz);
          ((n.vx = Math.sin(d) * h), (n.vz = Math.cos(d) * h), (n.life = Math.max(n.life, c / h + 0.1)));
          continue;
        }
      }
      if (n.pierce > 0) {
        n.pierce--;
        continue;
      }
      return n.kind === "disc" ? ((n.vx = -n.vx * 0.9), (n.vz = -n.vz * 0.9), n.hit.delete(o), n.rico-- <= 0) : !0;
    }
  return !1;
}


// ════════ [440] FunctionDeclaration iE (1402 bytes) ════════
function iE(n, e, t) {
  let i = x.fx,
    s = x.map;
  if (n.kind === "lob") {
    n.t += e;
    let l = Math.min(1, n.t / n.dur);
    return (
      (n.x = n.sx + (n.tx - n.sx) * l),
      (n.z = n.sz + (n.tz - n.sz) * l),
      (n.y = 0.8 + Math.sin(l * Math.PI) * (2 + n.dur * 2)),
      i.drawOrb(n.x, n.y, n.z, 0.22, n.color),
      l >= 1
        ? (dn(n.x, n.z, n.aoe, n.dmg, { owner: "e", color: n.color, elem: n.elem, small: !0 }),
          n.pool &&
            Oa({
              x: n.x,
              z: n.z,
              r: n.aoe * 0.9,
              t: 4,
              dps: n.dmg * 0.6,
              owner: "e",
              kind: "acid",
              color: n.color,
              elem: n.elem,
            }),
          !0)
        : !1
    );
  }
  if (n.homing) {
    let l = Math.hypot(n.vx, n.vz),
      c = Math.atan2(n.vx, n.vz),
      d = Math.atan2(t.x - n.x, t.z - n.z),
      h = c + qe(fi(c, d), -n.homing * e, n.homing * e);
    ((n.vx = Math.sin(h) * l), (n.vz = Math.cos(h) * l));
  }
  let a = n.x,
    r = n.z;
  if (
    ((n.x += n.vx * e),
    (n.z += n.vz * e),
    n.kind === "bullet" || n.kind === "shard"
      ? i.drawTracer(
          n.x,
          n.y,
          n.z,
          n.vx,
          n.vz,
          n.kind === "shard" ? 0.6 : 0.7,
          n.kind === "shard" ? 0.1 : 0.09,
          n.color,
        )
      : n.kind === "missile"
        ? (i.drawRocket(n.x, n.y, n.z, n.vx, n.vz, 3817284, 0.12),
          i.drawGlow(n.x, n.y, n.z, 0.7, 16732192),
          Q() < 0.6 && i.smoke(n.x, n.y, n.z, 1, 6974058, 0.2))
        : i.drawOrb(n.x, n.y, n.z, n.size || 0.2, n.color),
    s.opaqueAt(Math.floor(n.x), Math.floor(n.z)))
  )
    return (
      n.kind === "missile" ? dn(n.x, n.z, 2, n.dmg, { owner: "e", small: !0 }) : i.hit(n.x, n.y, n.z, n.color),
      !0
    );
  let o = (n.size || 0.15) + t.r;
  return !t.dead && sE(a, r, n.x, n.z, t.x, t.z) < o * o
    ? n.kind === "missile"
      ? (dn(n.x, n.z, 2.2, n.dmg, { owner: "e", small: !0 }), !0)
      : (t.hurt(n.dmg, { elem: n.elem }) > 0 &&
          (n.slow && (t.slowT = 1.6),
          n.elem === "fire" && ((t.burnT = 2.5), (t.dotDps = n.dmg * 0.12)),
          n.elem === "toxic" && ((t.poisonT = 3), (t.dotDps = n.dmg * 0.08))),
        i.hit(n.x, n.y, n.z, n.color),
        !0)
    : !1;
}


// ════════ [441] FunctionDeclaration Na (565 bytes) ════════
function Na(n, e, t, i, s, a = {}) {
  let r = {
    bullet: 16732208,
    orb: n.def.m.e,
    acid: 10354506,
    web: 15658751,
    shard: 10475775,
    fire: 16747040,
    homing: 13664511,
  };
  x.projs.push({
    owner: "e",
    kind: e === "acid" || e === "web" || e === "fire" || e === "homing" ? "orb" : e,
    x: n.x + Math.sin(t) * n.rad,
    y: 1 * Math.min(1.4, n.scale),
    z: n.z + Math.cos(t) * n.rad,
    vx: Math.sin(t) * i,
    vz: Math.cos(t) * i,
    dmg: s,
    life: a.life ?? 3.5,
    color: a.color ?? r[e] ?? 16728128,
    size: a.size ?? (e === "bullet" ? 0.1 : 0.22),
    elem: a.elem ?? (e === "acid" ? "toxic" : e === "fire" ? "fire" : e === "shard" ? "ice" : null),
    slow: e === "web" || e === "shard" || a.slow,
    homing: e === "homing" ? 1.6 : a.homing,
  });
}


// ════════ [442] FunctionDeclaration ep (280 bytes) ════════
function ep(n, e, t, i, s = {}) {
  let a = Le(n.x, n.z, e, t),
    r = qe(a / 9, 0.6, 1.5);
  (x.fx.telegraph(e, t, s.aoe ?? 1.8, r, s.color ?? 16724e3),
    x.projs.push({
      owner: "e",
      kind: "lob",
      x: n.x,
      y: 1,
      z: n.z,
      sx: n.x,
      sz: n.z,
      tx: e,
      tz: t,
      t: 0,
      dur: r,
      dmg: i,
      aoe: s.aoe ?? 1.8,
      color: s.color ?? 16752704,
      elem: s.elem,
      pool: s.pool,
      life: r + 1,
    }));
}


// ════════ [443] FunctionDeclaration sE (134 bytes) ════════
function sE(n, e, t, i, s, a) {
  let r = t - n,
    o = i - e,
    l = r * r + o * o,
    c = l > 0 ? ((s - n) * r + (a - e) * o) / l : 0;
  c = c < 0 ? 0 : c > 1 ? 1 : c;
  let d = n + r * c - s,
    h = e + o * c - a;
  return d * d + h * h;
}


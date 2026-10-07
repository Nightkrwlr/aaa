// 11-models.js — Modelos procedurales: armas, jugador, enemigos, objetivos, botín

// ════════ [363] FunctionDeclaration vf (1389 bytes) ════════
function vf(n, e = 0) {
  let t = Hn[n] || Hn.pistol,
    i = new Ve(),
    s = t.len,
    a = t.col,
    r = de(1974822, { m: 0.5, r: 0.45 }),
    o = de(a, { m: 0.35, r: 0.5 }),
    l = e >= 2 ? Me(Ct[e].c) : null;
  if (
    (i.add(D(ue(0.08, 0.1, s * 0.55), o, 0, 0, s * 0.05)),
    i.add(D(je(0.025, 0.025, s * 0.5, 6), r, 0, 0.02, s * 0.5, { rx: Math.PI / 2 })),
    [
      "rifle",
      "smg",
      "sniper",
      "minigun",
      "shotgun",
      "crossbow",
      "laser",
      "rail",
      "plasma",
      "acid",
      "cryo",
      "flamer",
    ].includes(n) && i.add(D(ue(0.06, 0.09, s * 0.3), r, 0, -0.02, -s * 0.3)),
    ["rifle", "smg", "pistol", "sniper", "revolver"].includes(n) &&
      i.add(D(ue(0.05, 0.14, 0.06), r, 0, -0.1, s * 0.08, { rx: 0.2 })),
    n === "sniper" && i.add(D(je(0.03, 0.03, 0.25, 6), r, 0, 0.09, s * 0.1, { rx: Math.PI / 2 })),
    n === "minigun")
  )
    for (let c = 0; c < 4; c++)
      i.add(
        D(je(0.015, 0.015, s * 0.6, 4), r, Math.cos(c * 1.57) * 0.04, Math.sin(c * 1.57) * 0.04, s * 0.5, {
          rx: Math.PI / 2,
        }),
      );
  return (
    n === "shotgun" && i.add(D(je(0.03, 0.03, s * 0.45, 6), de(6965802), 0, -0.04, s * 0.35, { rx: Math.PI / 2 })),
    (n === "rocket" || n === "glauncher") &&
      i.add(D(je(0.07, 0.07, s * 0.8, 8), o, 0, 0.04, s * 0.3, { rx: Math.PI / 2 })),
    (n === "flamer" || n === "cryo") &&
      i.add(D(je(0.06, 0.06, 0.28, 8), de(n === "cryo" ? 9093344 : 11546656), 0, -0.1, 0, {})),
    ["laser", "rail", "plasma", "tesla", "void", "acid", "cryo"].includes(n) &&
      i.add(D(ue(0.085, 0.03, s * 0.4), Me(t.tracer || 4251903), 0, 0.06, s * 0.15)),
    n === "tesla" && i.add(D(wi(0.06, 0.015, 4, 10), Me(9426175), 0, 0.02, s * 0.6)),
    n === "disc" && i.add(D(je(0.12, 0.12, 0.02, 12), Me(13693183), 0, 0.03, s * 0.2, { rx: 0 })),
    n === "crossbow" && i.add(D(ue(0.5, 0.03, 0.04), r, 0, 0.02, s * 0.45)),
    l && i.add(D(ue(0.085, 0.02, s * 0.2), l, 0, -0.03, s * 0.1)),
    (i.userData.muzzle = new U(0, 0.02, s * 0.78)),
    i
  );
}


// ════════ [364] VariableDeclaration Aw (105 bytes) ════════
var Aw = {
  tac: 4872762,
  nv: 3029546,
  balaclava: 6978186,
  gas: 4016698,
  heavy: 2895926,
  neural: 2766160,
  visor: 9067050,
};


// ════════ [365] FunctionDeclaration Eo (3458 bytes) ════════
function Eo(n = {}) {
  let e = new Ve(),
    t = new Ve();
  e.add(t);
  let i = n.suit ?? 5200444,
    s = n.vest ?? tt(i, 0, 0.3),
    a = n.skin ?? 13146744,
    r = de(i),
    o = de(s),
    l = de(2237738),
    c = de(a),
    d = de(1973274),
    h = !!n.fem,
    f = h ? 0.9 : 1,
    u = [];
  for (let w of [-1, 1]) {
    let E = new Ve();
    (E.position.set(w * 0.11 * f, 0.72, 0),
      E.add(D(ue(0.17, 0.42, 0.19), r, 0, -0.2, 0)),
      E.add(D(ue(0.155, 0.36, 0.17), r, 0, -0.52, 0)),
      E.add(D(ue(0.16, 0.1, 0.1), o, 0, -0.38, 0.09)),
      E.add(D(ue(0.17, 0.13, 0.28), d, 0, -0.66, 0.04)),
      t.add(E),
      u.push(E));
  }
  t.add(D(ue(0.38 * f, 0.12, 0.24), l, 0, 0.74, 0));
  let p = new Ve();
  if (((p.position.y = 0.78), t.add(p), p.add(D(ue(0.44 * f, 0.5, 0.26), r, 0, 0.24, 0)), !n.civ)) {
    p.add(D(ue(0.48 * f, 0.4, 0.32), o, 0, 0.26, 0.01));
    for (let w of [-0.13, 0, 0.13]) p.add(D(ue(0.11, 0.12, 0.07), de(tt(s, 0, 0.15)), w * f, 0.14, 0.18));
    (p.add(D(ue(0.36, 0.42, 0.18), de(tt(i, 0, 0.35)), 0, 0.28, -0.22)),
      n.antenna !== !1 && p.add(D(je(0.008, 0.008, 0.5, 3), l, 0.12, 0.7, -0.26)));
    for (let w of [-1, 1]) p.add(D(ue(0.14, 0.1, 0.2), o, w * 0.27 * f, 0.47, 0));
  }
  let m = new Ve();
  ((m.position.y = 0.58),
    p.add(m),
    m.add(D(ue(0.08, 0.06, 0.08), c, 0, -0.02, 0)),
    m.add(D(wt(0.13, 8, 6), c, 0, 0.1, 0)));
  let g = n.hat || "tac",
    b = n.hatC ?? Aw[g] ?? 4872762;
  (["tac", "nv", "heavy", "neural", "visor", "balaclava", "gas"].includes(g) &&
    (m.add(D(Cl(0.165), de(b, { r: 0.6 }), 0, 0.13, -0.01, { s: [1, 0.95, 1.05] })),
    m.add(D(ue(0.34, 0.03, 0.34), de(tt(b, 0, 0.2)), 0, 0.13, -0.01))),
    g === "heavy" && m.add(D(ue(0.28, 0.12, 0.05), de(1974822, { m: 0.4 }), 0, 0.06, 0.15)),
    g === "nv" &&
      (m.add(D(je(0.03, 0.03, 0.08, 6), l, -0.05, 0.25, 0.12, { rx: 1.2 })),
      m.add(D(je(0.03, 0.03, 0.08, 6), l, 0.05, 0.25, 0.12, { rx: 1.2 }))),
    g === "gas" &&
      (m.add(D(je(0.07, 0.06, 0.1, 8), l, 0, 0.04, 0.16, { rx: 1.4 })),
      m.add(D(je(0.05, 0.05, 0.08, 8), de(3820074), 0, 0, 0.22, { rx: 1.4 }))),
    g === "balaclava" && m.add(D(wt(0.135, 8, 6), de(b), 0, 0.09, 0, { s: [1.02, 1, 1.02] })),
    g === "beret" && m.add(D(je(0.15, 0.15, 0.05, 10), de(b), 0.02, 0.22, 0, { rz: 0.25 })),
    g === "cap" && (m.add(D(Cl(0.14), de(b), 0, 0.15, 0)), m.add(D(ue(0.16, 0.02, 0.12), de(b), 0, 0.16, 0.12))),
    g === "goggles" &&
      (m.add(D(wi(0.13, 0.02, 4, 12), de(2763306), 0, 0.15, 0, { rx: Math.PI / 2 })),
      m.add(D(je(0.035, 0.035, 0.04, 8), Me(16752704), -0.05, 0.17, 0.12, { rx: 1.3 })),
      m.add(D(je(0.035, 0.035, 0.04, 8), Me(16752704), 0.05, 0.17, 0.12, { rx: 1.3 }))),
    g === "straw" &&
      (m.add(D(je(0.28, 0.28, 0.02, 12), de(b), 0, 0.2, 0)), m.add(D(je(0.12, 0.14, 0.1, 10), de(b), 0, 0.25, 0))),
    g === "hood" && m.add(D(wt(0.17, 8, 6), de(b), 0, 0.12, -0.03, { s: [1, 1.05, 1.1] })),
    g === "headset" &&
      (m.add(D(wi(0.14, 0.015, 4, 12, Math.PI), de(2236962), 0, 0.12, 0, { rz: 0 })),
      m.add(D(je(0.05, 0.05, 0.04, 8), l, 0.13, 0.08, 0, { rz: Math.PI / 2 }))),
    g === "fur" && m.add(D(je(0.16, 0.17, 0.14, 10), de(b), 0, 0.2, 0)),
    g === "miner" &&
      (m.add(D(Cl(0.16), de(b, { m: 0.3 }), 0, 0.13, 0)),
      m.add(D(je(0.035, 0.035, 0.05, 8), Me(16773312), 0, 0.2, 0.15, { rx: 1.3 }))),
    n.hair != null &&
      !["hood", "fur", "tac", "nv", "heavy"].includes(g) &&
      m.add(D(wt(0.14, 8, 6), de(n.hair), 0, 0.13, -0.03, { s: [1, 0.9, 1] })),
    h && n.hair != null && m.add(D(ue(0.12, 0.22, 0.06), de(n.hair), 0, -0.02, -0.12)));
  let y = null;
  !["beret", "cap", "straw", "hood", "headset", "fur", "miner", "none", "goggles"].includes(g) || n.visor
    ? ((y = D(ue(0.2, 0.045, 0.04), Me(n.visorC ?? 4251903), 0, 0.12, 0.125, { shadow: !1 })), m.add(y))
    : (m.add(D(ue(0.03, 0.02, 0.01), de(1118481), -0.045, 0.12, 0.128, { shadow: !1 })),
      m.add(D(ue(0.03, 0.02, 0.01), de(1118481), 0.045, 0.12, 0.128, { shadow: !1 })));
  let v = new Ve();
  (v.position.set(0, 0.42, 0), p.add(v));
  let _ = new Ve();
  (_.position.set(0.27 * f, 0, 0), v.add(_));
  let A = new Ve();
  (A.position.set(-0.27 * f, 0, 0), v.add(A));
  for (let w of [_, A]) {
    w.add(D(ue(0.13, 0.3, 0.14), r, 0, -0.13, 0));
    let E = new Ve();
    ((E.position.y = -0.27),
      w.add(E),
      E.add(D(ue(0.12, 0.28, 0.13), r, 0, -0.12, 0)),
      E.add(D(ue(0.12, 0.1, 0.12), de(n.glove ?? 2763302), 0, -0.29, 0)),
      (w.userData.fore = E));
  }
  let T = new Ve();
  (T.position.set(0.1, 0.2, 0.28), p.add(T));
  let S = Ei(0.42);
  e.add(S);
  let k = {
    root: e,
    body: t,
    torso: p,
    head: m,
    legs: u,
    armR: _,
    armL: A,
    weaponMount: T,
    visor: y,
    weapon: null,
    shadow: S,
    t: Math.random() * 10,
    recoil: 0,
    armed: !n.unarmed,
  };
  return (Rw(k, k.armed), k);
}


// ════════ [366] FunctionDeclaration Rw (238 bytes) ════════
function Rw(n, e) {
  e
    ? (n.armR.rotation.set(-1.05, 0, 0.12),
      n.armR.userData.fore.rotation.set(-0.45, 0, 0),
      n.armL.rotation.set(-1.25, 0, -0.55),
      n.armL.userData.fore.rotation.set(-0.35, 0, 0.3))
    : (n.armR.rotation.set(0, 0, 0.08), n.armL.rotation.set(0, 0, -0.08));
}


// ════════ [367] FunctionDeclaration Lg (122 bytes) ════════
function Lg(n, e, t) {
  (n.weapon && n.weaponMount.remove(n.weapon),
    (n.weapon = e ? vf(e, t) : null),
    n.weapon && n.weaponMount.add(n.weapon));
}


// ════════ [368] FunctionDeclaration Ig (400 bytes) ════════
function Ig(n, e, t, i, s) {
  n.t += e * (i ? 9 * Math.max(0.6, t / 5) : 2);
  let a = i ? Math.sin(n.t) : 0;
  ((n.legs[0].rotation.x = a * 0.7),
    (n.legs[1].rotation.x = -a * 0.7),
    (n.body.position.y = i ? Math.abs(Math.cos(n.t)) * 0.05 : Math.sin(n.t) * 0.008),
    (n.torso.rotation.x = s ? 0.45 : i ? 0.08 : 0),
    (n.recoil = Math.max(0, n.recoil - e * 10)),
    (n.weaponMount.position.z = 0.28 - n.recoil * 0.08),
    (n.torso.rotation.y = -n.recoil * 0.05),
    n.armed || ((n.armR.rotation.x = -a * 0.5), (n.armL.rotation.x = a * 0.5)));
}


// ════════ [369] FunctionDeclaration Dg (638 bytes) ════════
function Dg(n) {
  if (n.robot) {
    let i = new Ve(),
      s = new Ve();
    return (
      i.add(s),
      s.add(D(je(0.3, 0.38, 0.9, 8), de(3817544, { m: 0.6, r: 0.4 }), 0, 0.6, 0)),
      s.add(D(ue(0.5, 0.36, 0.42), de(4870232, { m: 0.6, r: 0.4 }), 0, 1.25, 0)),
      s.add(D(ue(0.36, 0.08, 0.05), Me(4251903), 0, 1.28, 0.22)),
      s.add(D(je(0.01, 0.01, 0.4, 3), de(2236962), 0.15, 1.6, 0)),
      s.add(D(wt(0.04, 6, 4), Me(16724e3), 0.15, 1.8, 0)),
      s.add(D(wi(0.42, 0.03, 4, 16), Me(4251903, 0.8), 0, 0.3, 0, { rx: Math.PI / 2 })),
      i.add(Ei(0.45)),
      { root: i, body: s, robot: !0, t: 0 }
    );
  }
  let e = n.look || {};
  return Eo({
    suit: e.suit,
    vest: tt(e.suit ?? 4868666, 0, 0.25),
    skin: e.skin,
    hat: e.hat,
    hatC: e.hatC,
    hair: e.hair,
    fem: e.fem,
    unarmed: !0,
    civ: !["vega", "reyes", "navarro", "morales"].includes(n.id),
    antenna: !1,
  });
}


// ════════ [370] FunctionDeclaration Og (240 bytes) ════════
function Og(n, e) {
  if (((n.t += e), n.robot)) {
    n.body.position.y = Math.sin(n.t * 2) * 0.05;
    return;
  }
  ((n.body.position.y = Math.sin(n.t * 1.6) * 0.01),
    (n.torso.rotation.y = Math.sin(n.t * 0.5) * 0.08),
    (n.head.rotation.y = Math.sin(n.t * 0.7) * 0.25),
    (n.armR.rotation.x = Math.sin(n.t * 1.1) * 0.08));
}


// ════════ [371] FunctionDeclaration Ng (7493 bytes) ════════
function Ng(n, e) {
  let t = n.m,
    i = t.s,
    s = new Ve(),
    a = new Ve();
  s.add(a);
  let r = de(t.c, { r: 0.65 }),
    o = de(t.c2, { r: 0.55 }),
    l = Me(t.e),
    c = { root: s, body: a, legs: [], parts: [], t: Math.random() * 10, type: t.t, s: i, meshes: [] },
    d = (u, p) => (u.add(p), c.meshes.push(p), p),
    h = t.t;
  if (h === "bug" || h === "mantis" || h === "scorpion" || h === "spider") {
    let u = t.legs ?? (h === "spider" ? 8 : 6);
    (d(a, D(wt(0.32, 8, 6), r, 0, 0.35, -0.18, { s: [1, 0.75, 1.35] })),
      t.shell && d(a, D(wt(0.36, 8, 5), o, 0, 0.45, -0.15, { s: [1.05, 0.6, 1.3] })),
      t.sac && d(a, D(wt(0.22, 7, 5), Me(t.c2, 0.85), 0, 0.5, -0.45)));
    let p = d(a, D(wt(0.18, 7, 5), o, 0, 0.36, 0.22, { s: [1, 0.85, 1.1] }));
    (d(a, D(wt(0.04, 5, 4), l, -0.08, 0.42, 0.36, { shadow: !1 })),
      d(a, D(wt(0.04, 5, 4), l, 0.08, 0.42, 0.36, { shadow: !1 })),
      h !== "spider" &&
        (d(a, D(Xn(0.03, 0.18, 4), o, -0.07, 0.3, 0.42, { rx: 1.8 })),
        d(a, D(Xn(0.03, 0.18, 4), o, 0.07, 0.3, 0.42, { rx: 1.8 }))));
    for (let m = 0; m < u; m++) {
      let g = m % 2 ? 1 : -1,
        b = Math.floor(m / 2),
        y = new Ve();
      (y.position.set(g * 0.2, 0.32, 0.12 - b * (0.6 / Math.max(1, u / 2 - 0.5))),
        d(y, D(je(0.025, 0.03, t.long ? 0.6 : 0.42, 4), o, g * 0.18, 0.02, 0, { rz: g * 1.1 })),
        d(y, D(je(0.02, 0.025, t.long ? 0.55 : 0.4, 4), r, g * 0.4, -0.15, 0, { rz: g * -0.35 })),
        (y.userData.side = g),
        (y.userData.ph = m * 1.3),
        a.add(y),
        c.legs.push(y));
    }
    if (h === "mantis")
      for (let m of [-1, 1]) {
        let g = new Ve();
        (g.position.set(m * 0.15, 0.5, 0.3),
          d(g, D(ue(0.05, 0.05, 0.4), o, 0, 0.1, 0.15, { rx: -0.6 })),
          d(g, D(Xn(0.04, 0.45, 4), de(13689024), 0, 0.15, 0.4, { rx: 1.1 })),
          a.add(g),
          c.parts.push(g));
      }
    if (h === "scorpion") {
      let m = new Ve();
      m.position.set(0, 0.45, -0.55);
      for (let g = 0; g < 4; g++) d(m, D(wt(0.1 - g * 0.012, 6, 4), r, 0, g * 0.16, -g * 0.08));
      (d(m, D(Xn(0.06, 0.2, 5), l, 0, 0.66, 0.05, { rx: 2.2 })), a.add(m), c.parts.push(m));
      for (let g of [-1, 1]) d(a, D(ue(0.14, 0.08, 0.22), o, g * 0.25, 0.3, 0.42));
    }
    if (t.crown)
      for (let m = 0; m < 5; m++) d(a, D(Xn(0.04, 0.22, 4), l, (m - 2) * 0.06, 0.55, 0.2, { rz: (m - 2) * 0.2 }));
  } else if (h === "wasp") {
    (d(a, D(wt(0.16, 7, 5), r, 0, 0.9, 0.05)),
      d(a, D(wt(0.2, 7, 5), de(t.c2), 0, 0.85, -0.25, { s: [1, 0.9, 1.4] })),
      d(a, D(Xn(0.04, 0.2, 4), r, 0, 0.8, -0.55, { rx: -1.6 })),
      d(a, D(wt(0.035, 5, 4), l, -0.06, 0.95, 0.18)),
      d(a, D(wt(0.035, 5, 4), l, 0.06, 0.95, 0.18)));
    for (let u of [-1, 1]) {
      let p = d(a, D(ea(0.5, 0.18), Me(13691135, 0.35), u * 0.28, 1, -0.05, { rx: -Math.PI / 2, shadow: !1 }));
      (c.parts.push(p), (p.userData.side = u));
    }
  } else if (h === "humanoid" || h === "brute") {
    let u = h === "brute",
      p = t.hunch ?? (u ? 0.35 : 0.2),
      m = new Ve();
    if (
      ((m.position.y = u ? 0.75 : 0.7),
      (m.rotation.x = p),
      a.add(m),
      d(m, D(ue(u ? 0.7 : 0.4, u ? 0.6 : 0.5, u ? 0.45 : 0.25), r, 0, u ? 0.35 : 0.25, 0)),
      t.belly && d(m, D(wt(0.32, 8, 6), Me(t.c2, 0.9), 0, 0.2, 0.18, { s: [1, 0.9, 0.8] })),
      t.fur && d(m, D(gr(u ? 0.48 : 0.3, 0), de(tt(t.c, 16777215, 0.2)), 0, 0.55, -0.05, { s: [1.1, 0.6, 1] })),
      t.spikes)
    )
      for (let b = 0; b < 4; b++) d(m, D(Xn(0.06, 0.3, 4), o, (b - 1.5) * 0.15, 0.7, -0.15, { rx: -0.5 }));
    let g = d(
      m,
      D(t.bighead ? wt(0.24, 8, 6) : ue(u ? 0.28 : 0.2, u ? 0.24 : 0.22, 0.22), o, 0, u ? 0.75 : 0.62, 0.08),
    );
    (d(m, D(ue(0.05, 0.04, 0.02), l, -0.05, u ? 0.77 : 0.64, 0.2, { shadow: !1 })),
      d(m, D(ue(0.05, 0.04, 0.02), l, 0.05, u ? 0.77 : 0.64, 0.2, { shadow: !1 })),
      t.glow && d(m, D(wt(0.12, 6, 4), Me(t.glow), 0, 0.3, 0.13)));
    for (let b of [-1, 1]) {
      let y = new Ve();
      (y.position.set(b * (u ? 0.45 : 0.27), u ? 0.55 : 0.42, 0),
        m.add(y),
        d(y, D(ue(u ? 0.22 : 0.11, u ? 0.7 : 0.55, u ? 0.24 : 0.12), r, 0, u ? -0.3 : -0.25, 0)),
        d(y, D(ue(u ? 0.26 : 0.12, u ? 0.2 : 0.1, u ? 0.26 : 0.13), o, 0, u ? -0.7 : -0.55, 0.02)),
        (y.userData.side = b),
        c.parts.push(y));
    }
    for (let b of [-1, 1]) {
      let y = new Ve();
      (y.position.set(b * (u ? 0.2 : 0.11), u ? 0.75 : 0.7, 0),
        a.add(y),
        d(y, D(ue(u ? 0.24 : 0.14, u ? 0.75 : 0.68, u ? 0.26 : 0.15), de(tt(t.c, 0, 0.25)), 0, u ? -0.37 : -0.34, 0)),
        c.legs.push(y),
        (y.userData.side = b));
    }
    c.torso = m;
  } else if (h === "drone") {
    let u = d(a, D(wt(0.25, 10, 8), de(t.c, { m: 0.6, r: 0.35 }), 0, 1, 0));
    d(a, D(wt(0.1, 8, 6), l, 0, 1, 0.2));
    let p = d(a, D(wi(0.38, 0.04, 4, 16), de(2764598, { m: 0.6 }), 0, 1, 0, { rx: Math.PI / 2 }));
    for (let m = 0; m < 4; m++) {
      let g = (m * Math.PI) / 2 + Math.PI / 4,
        b = d(
          a,
          D(je(0.14, 0.14, 0.02, 10), Me(t.c2, 0.5), Math.cos(g) * 0.38, 1.08, Math.sin(g) * 0.38, { shadow: !1 }),
        );
      c.parts.push(b);
    }
    (t.c2 !== 4259712 && d(a, D(je(0.03, 0.03, 0.3, 6), de(1974822), 0, 0.85, 0.2, { rx: Math.PI / 2 })),
      (c.hover = !0));
  } else if (h === "turret" || h === "tank") {
    if ((d(a, D(je(0.45, 0.55, 0.35, 8), de(t.c, { m: 0.5 }), 0, 0.18, 0)), h === "tank")) {
      d(a, D(ue(1, 0.3, 1.2), de(t.c, { m: 0.4 }), 0, 0.2, 0));
      for (let p of [-1, 1]) d(a, D(ue(0.22, 0.28, 1.3), de(1974822), p * 0.55, 0.14, 0));
    }
    let u = new Ve();
    ((u.position.y = h === "tank" ? 0.55 : 0.5),
      a.add(u),
      d(u, D(ue(0.55, 0.32, 0.55), de(tt(t.c, 16777215, 0.1), { m: 0.5 }), 0, 0.1, 0)),
      d(u, D(je(0.05, 0.05, 0.6, 6), de(1974822), 0.1, 0.12, 0.45, { rx: Math.PI / 2 })),
      d(u, D(je(0.05, 0.05, 0.6, 6), de(1974822), -0.1, 0.12, 0.45, { rx: Math.PI / 2 })),
      d(u, D(ue(0.3, 0.06, 0.02), l, 0, 0.18, 0.28)),
      d(u, D(ue(0.56, 0.06, 0.56), Me(t.c2, 0.9), 0, -0.04, 0)),
      (c.head = u));
  } else if (h === "mech") {
    let u = t.slim,
      p = new Ve();
    ((p.position.y = 1),
      a.add(p),
      d(p, D(ue(u ? 0.5 : 0.8, u ? 0.5 : 0.6, 0.6), de(t.c, { m: 0.55, r: 0.4 }), 0, 0.2, 0)),
      d(p, D(ue(u ? 0.3 : 0.5, 0.12, 0.05), l, 0, 0.3, 0.31)),
      d(p, D(ue(0.25, 0.12, 0.62), Me(t.c2, 0.9), 0, 0.02, 0)));
    for (let m of [-1, 1])
      (d(p, D(ue(0.18, 0.18, 0.7), de(2764598, { m: 0.5 }), m * (u ? 0.35 : 0.52), 0.2, 0.15)),
        d(p, D(je(0.05, 0.05, 0.25, 6), de(1974822), m * (u ? 0.35 : 0.52), 0.2, 0.6, { rx: Math.PI / 2 })));
    u || d(p, D(ue(0.5, 0.3, 0.4), de(3817544, { m: 0.5 }), 0, 0.55, -0.15));
    for (let m of [-1, 1]) {
      let g = new Ve();
      (g.position.set(m * 0.25, 0.95, 0),
        a.add(g),
        d(g, D(ue(0.18, 0.5, 0.2), de(t.c, { m: 0.5 }), 0, -0.25, 0)),
        d(g, D(ue(0.16, 0.48, 0.18), de(2764598, { m: 0.5 }), 0, -0.68, 0.05)),
        d(g, D(ue(0.25, 0.08, 0.35), de(1974822), 0, -0.92, 0.08)),
        c.legs.push(g),
        (g.userData.side = m));
    }
    c.torso = p;
  } else if (h === "blob" || h === "mushroom") {
    if (h === "blob") {
      (d(a, D(gr(0.45, 1), r, 0, 0.42, 0, { s: [1, 0.9, 1] })), d(a, D(gr(0.25, 1), Me(t.c2, 0.9), 0, 0.5, 0.2)));
      for (let u = 0; u < 5; u++)
        d(
          a,
          D(
            wt(0.1, 6, 4),
            de(tt(t.c, 16777215, 0.2)),
            Math.cos(u * 1.3) * 0.35,
            0.3 + (u % 2) * 0.3,
            Math.sin(u * 1.3) * 0.35,
          ),
        );
      (d(a, D(wt(0.05, 5, 4), l, -0.12, 0.6, 0.38)), d(a, D(wt(0.05, 5, 4), l, 0.12, 0.6, 0.38)));
    } else {
      (d(a, D(je(0.18, 0.25, 0.6, 8), de(t.c), 0, 0.3, 0)),
        d(a, D(wt(0.5, 10, 5), Me(t.c2, 0.92), 0, 0.7, 0, { s: [1, 0.55, 1] })));
      for (let u = 0; u < 6; u++) d(a, D(wt(0.06, 5, 4), Me(t.e), Math.cos(u) * 0.35, 0.85, Math.sin(u) * 0.35));
      (d(a, D(wt(0.04, 5, 4), l, -0.08, 0.45, 0.2)), d(a, D(wt(0.04, 5, 4), l, 0.08, 0.45, 0.2)));
    }
    c.squish = !0;
  } else if (h === "spectre") {
    let u = t.dark ? 1 : 0.9;
    (d(
      a,
      D(Xn(0.38, 1.2, 7), de(t.c, { e: t.dark ? 0 : t.c2, ei: 0.35, t: u < 1 ? u : 0 }), 0, 0.85, 0, { rx: Math.PI }),
    ),
      d(a, D(wt(0.22, 8, 6), de(tt(t.c, 0, 0.2)), 0, 1.45, 0)),
      d(a, D(ue(0.07, 0.04, 0.03), l, -0.07, 1.48, 0.19, { shadow: !1 })),
      d(a, D(ue(0.07, 0.04, 0.03), l, 0.07, 1.48, 0.19, { shadow: !1 })));
    for (let p of [-1, 1]) {
      let m = new Ve();
      (m.position.set(p * 0.3, 1.2, 0),
        d(m, D(Xn(0.06, 0.6, 4), de(t.c), 0, -0.25, 0.1, { rx: Math.PI + 0.4 })),
        a.add(m),
        (m.userData.side = p),
        c.parts.push(m));
    }
    if ((t.dark || d(a, D(wi(0.3, 0.02, 4, 14), Me(t.c2, 0.8), 0, 0.4, 0, { rx: Math.PI / 2 })), t.crown))
      for (let p = 0; p < 7; p++)
        d(a, D(Xn(0.04, 0.25, 4), l, Math.cos(p * 0.9) * 0.18, 1.7, Math.sin(p * 0.9) * 0.18));
    c.hover = !0;
  } else if (h === "golem" || h === "crystal") {
    let u = h === "crystal" || t.ice,
      p = de(t.c, { r: u ? 0.25 : 0.85, m: u ? 0.2 : 0 });
    if (
      (d(a, D(za(0.45), p, 0, 0.95, 0, { s: [1.1, 1, 0.9] })),
      d(a, D(za(0.25), p, 0, 1.5, 0.05)),
      d(a, D(ue(0.18, 0.06, 0.04), l, 0, 1.52, 0.24)),
      d(a, D(Qs(0.18), Me(t.c2, 0.9), 0, 0.95, 0.35)),
      h === "golem")
    )
      for (let m of [-1, 1]) {
        let g = new Ve();
        (g.position.set(m * 0.55, 1.15, 0),
          d(g, D(za(0.22), p, 0, -0.2, 0)),
          d(g, D(za(0.26), p, 0, -0.6, 0.05)),
          a.add(g),
          (g.userData.side = m),
          c.parts.push(g));
      }
    if (h === "golem")
      for (let m of [-1, 1]) {
        let g = new Ve();
        (g.position.set(m * 0.25, 0.5, 0),
          d(g, D(za(0.22), p, 0, -0.25, 0)),
          a.add(g),
          c.legs.push(g),
          (g.userData.side = m));
      }
    else {
      for (let m = 0; m < 5; m++)
        d(a, D(Qs(0.18), Me(t.c2, 0.85), Math.cos(m * 1.25) * 0.5, 0.4, Math.sin(m * 1.25) * 0.5, { s: [1, 2.2, 1] }));
      a.position.y = -0.3;
    }
    if (t.crown)
      for (let m = 0; m < 5; m++) d(a, D(Xn(0.05, 0.3, 4), Me(t.c2), (m - 2) * 0.1, 1.8, 0, { rz: (m - 2) * 0.25 }));
  } else if (h === "worm") {
    for (let p = 0; p < 6; p++) {
      let m = d(a, D(wt(0.22 - p * 0.02, 8, 6), p === 0 ? o : r, 0, 0.22, -p * 0.28));
      c.parts.push(m);
    }
    (d(a, D(wt(0.04, 5, 4), l, -0.08, 0.32, 0.18)),
      d(a, D(wt(0.04, 5, 4), l, 0.08, 0.32, 0.18)),
      d(a, D(Xn(0.04, 0.12, 4), de(15261896), -0.07, 0.15, 0.24, { rx: 2.2 })),
      d(a, D(Xn(0.04, 0.12, 4), de(15261896), 0.07, 0.15, 0.24, { rx: 2.2 })),
      (c.worm = !0));
  } else if (h === "nest") {
    d(a, D(gr(0.9, 1), r, 0, 0.3, 0, { s: [1.2, 0.7, 1.2] }));
    for (let u = 0; u < 6; u++) {
      let p = d(
        a,
        D(wt(0.22, 7, 5), Me(t.c2, 0.9), Math.cos(u * 1.05) * 0.65, 0.45 + (u % 2) * 0.2, Math.sin(u * 1.05) * 0.65),
      );
      c.parts.push(p);
    }
    (d(a, D(Xn(0.3, 0.8, 6), de(tt(t.c, 0, 0.3)), 0, 0.9, 0)), (c.nest = !0));
  }
  let f = i * (e ? 1.18 : 1);
  if ((s.scale.setScalar(f), (c.shadow = Ei(0.55, 0.5)), s.add(c.shadow), e)) {
    let u = new Ge(
      ea(1, 1),
      new vt({ map: Ys(), color: e, transparent: !0, opacity: 0.85, blending: en, depthWrite: !1, toneMapped: !1 }),
    );
    ((u.rotation.x = -Math.PI / 2), (u.position.y = 0.05), u.scale.set(1.6, 1.6, 1), s.add(u), (c.ring = u));
  }
  for (let u of c.meshes) u.userData.mat = u.material;
  return c;
}


// ════════ [372] FunctionDeclaration Ug (68 bytes) ════════
function Ug(n, e) {
  for (let t of n.meshes) t.material = e || t.userData.mat;
}


// ════════ [373] FunctionDeclaration Fg (1195 bytes) ════════
function Fg(n, e, t, i) {
  n.t += e * (2 + t * 2.2);
  let s = n.t,
    a = t > 0.1;
  for (let r of n.legs) {
    let o = r.userData.ph ?? (r.userData.side > 0 ? 0 : Math.PI);
    n.type === "bug" || n.type === "spider" || n.type === "scorpion" || n.type === "mantis"
      ? ((r.rotation.y = a ? Math.sin(s * 1.4 + o) * 0.35 : 0),
        (r.rotation.z = a ? Math.max(0, Math.sin(s * 1.4 + o)) * 0.25 * r.userData.side : 0))
      : (r.rotation.x = a ? Math.sin(s + o) * 0.65 : 0);
  }
  if (n.type === "wasp") {
    for (let r of n.parts) r.rotation.z = Math.sin(s * 8) * 0.6 * r.userData.side;
    n.body.position.y = Math.sin(s * 0.8) * 0.1;
  } else if (n.hover) {
    if (((n.body.position.y = Math.sin(s * 0.6) * 0.12), n.type === "drone"))
      for (let r of n.parts) r.rotation.y += e * 20;
  } else if (n.squish) {
    let r = 1 + Math.sin(s * 1.2) * 0.07;
    n.body.scale.set(r, 2 - r, r);
  } else
    n.worm
      ? n.parts.forEach((r, o) => {
          ((r.position.x = Math.sin(s * 0.8 - o * 0.8) * 0.12),
            (r.position.y = 0.22 + Math.max(0, Math.sin(s * 0.8 - o * 0.8)) * 0.08));
        })
      : n.nest
        ? n.parts.forEach((r, o) => r.scale.setScalar(1 + Math.sin(s * 0.7 + o) * 0.15))
        : a && (n.body.position.y = Math.abs(Math.sin(s)) * 0.04);
  if (n.type === "humanoid" || n.type === "brute" || n.type === "golem" || n.type === "spectre")
    for (let r of n.parts)
      r.rotation.x = i === "attack" ? -1.4 : a ? -Math.sin(s + (r.userData.side > 0 ? 0 : Math.PI)) * 0.5 - 0.3 : -0.1;
  if (n.type === "mantis" && i === "attack") for (let r of n.parts) r.rotation.x = -0.9;
  n.ring && (n.ring.rotation.z += e * 2);
}


// ════════ [374] FunctionDeclaration Bg (10230 bytes) ════════
function Bg(n) {
  let e = new Ve(),
    t = n.k,
    i = de(3817544, { m: 0.6, r: 0.4 }),
    s = de(1974822, { m: 0.4 }),
    a = (e.userData = { k: t, anim: [] });
  if (t === "terminal") {
    (e.add(D(ue(0.6, 0.9, 0.45), i, 0, 0.45, 0)), e.add(D(ue(0.62, 0.08, 0.5), de(16756768), 0, 0.05, 0)));
    let r = D(ue(0.5, 0.36, 0.04), Me(3203232), 0, 0.95, 0.12, { rx: -0.5 });
    (e.add(r), (a.screen = r));
    let o = D(Qs(0.13), Me(3203232, 0.8, !0), 0, 1.5, 0);
    (e.add(o),
      (a.holo = o),
      a.anim.push((l) => {
        ((o.rotation.y = l * 2), (o.position.y = 1.5 + Math.sin(l * 2) * 0.06));
      }));
  } else if (t === "beacon") {
    (e.add(D(je(0.7, 0.9, 0.3, 8), i, 0, 0.15, 0)),
      e.add(D(je(0.12, 0.22, 2.2, 6), de(4870232, { m: 0.6 }), 0, 1.3, 0)));
    let r = D(wi(0.45, 0.05, 4, 18), Me(4251903), 0, 1.8, 0, { rx: Math.PI / 2 });
    (e.add(r), (a.ring = r));
    let o = D(Qs(0.18), Me(4251903), 0, 2.55, 0);
    (e.add(o), (a.core = o));
    let l = D(je(0.25, 0.25, 12, 10, !0), Me(4251903, 0.12, !0), 0, 8, 0, { shadow: !1 });
    (e.add(l),
      (a.beam = l),
      a.anim.push((c) => {
        ((r.rotation.z = c), (r.position.y = 1.6 + Math.sin(c * 1.5) * 0.25), (o.rotation.y = c * 2));
      }));
  } else if (t === "chest") {
    let r = [13226454, 6280026, 4161535, 16769082][n.tier ?? 1];
    e.add(D(ue(0.9, 0.45, 0.55), de(3820084, { m: 0.3 }), 0, 0.22, 0));
    let o = new Ve();
    (o.position.set(0, 0.45, -0.27),
      e.add(o),
      o.add(D(ue(0.92, 0.14, 0.57), de(4479548, { m: 0.3 }), 0, 0.07, 0.27)),
      o.add(D(ue(0.94, 0.04, 0.1), de(1974822), 0, 0.07, 0.27)));
    let l = D(ue(0.16, 0.12, 0.04), Me(r), 0, 0.38, 0.29);
    (e.add(l), (a.lid = o), (a.latch = l));
  } else if (t === "lockbox") {
    (e.add(D(ue(1, 0.75, 0.75), de(2764854, { m: 0.6, r: 0.4 }), 0, 0.37, 0)),
      e.add(D(ue(1.02, 0.08, 0.77), de(16756768), 0, 0.6, 0)));
    let r = D(ue(0.18, 0.18, 0.04), Me(16724e3), 0, 0.37, 0.39);
    (e.add(r), (a.latch = r));
  } else if (t === "crate")
    (e.add(D(ue(0.75, 0.75, 0.75), de(8018488), 0, 0.375, 0)),
      e.add(D(ue(0.78, 0.08, 0.78), de(5914664), 0, 0.72, 0)),
      e.add(D(ue(0.06, 0.78, 0.78), de(5914664), 0, 0.375, 0)),
      e.add(D(ue(0.3, 0.2, 0.01), de(16766023), 0, 0.45, 0.38)));
  else if (t === "crystal") {
    e.add(D(za(0.35), de(2759216), 0, 0.12, 0, { s: [1, 0.5, 1] }));
    for (let r = 0; r < 5; r++)
      e.add(
        D(
          Qs(0.22),
          Me(r % 2 ? 12610559 : 14721279),
          Math.cos(r * 1.3) * 0.25,
          0.45 + (r % 3) * 0.1,
          Math.sin(r * 1.3) * 0.25,
          { s: [1, 2.4, 1], rz: (r - 2) * 0.25 },
        ),
      );
  } else if (t === "shrine") {
    (e.add(D(je(0.6, 0.75, 0.35, 6), de(3421247), 0, 0.17, 0)),
      e.add(D(je(0.35, 0.45, 0.5, 6), de(2763316), 0, 0.6, 0)));
    for (let l = 0; l < 3; l++)
      e.add(
        D(ue(0.1, 0.9, 0.1), de(2763316), Math.cos(l * 2.09) * 0.55, 0.6, Math.sin(l * 2.09) * 0.55, {
          rz: Math.cos(l * 2.09) * 0.2,
        }),
      );
    let r = D(Qs(0.22), Me(16766023), 0, 1.35, 0);
    (e.add(r), (a.relic = r));
    let o = D(wi(0.35, 0.025, 4, 18), Me(16766023, 0.7, !0), 0, 1.35, 0, { rx: Math.PI / 2 });
    (e.add(o),
      (a.halo = o),
      a.anim.push((l) => {
        ((r.rotation.y = l * 1.5), (r.position.y = 1.35 + Math.sin(l * 2) * 0.1), (o.rotation.z = -l));
      }));
  } else if (t === "datapad") {
    let r = D(ue(0.3, 0.03, 0.22), de(1974822), 0, 0.3, 0);
    e.add(r);
    let o = D(ue(0.26, 0.01, 0.18), Me(16766023), 0, 0.32, 0);
    e.add(o);
    let l = D(je(0.12, 0.12, 2.5, 8, !0), Me(16766023, 0.15, !0), 0, 1.4, 0, { shadow: !1 });
    (e.add(l),
      a.anim.push((c) => {
        ((r.rotation.y = o.rotation.y = c),
          (r.position.y = 0.3 + Math.sin(c * 2) * 0.08),
          (o.position.y = r.position.y + 0.02));
      }));
  } else if (t === "breach") {
    let r = D(wi(1.3, 0.12, 6, 28), de(2759226, { m: 0.5, e: 6299840, ei: 0.8 }), 0, 1.5, 0);
    e.add(r);
    let o = new Ge(
      new _s(1.25, 32),
      new vt({
        map: Ed(),
        color: 11889663,
        transparent: !0,
        opacity: 0.9,
        blending: en,
        side: pn,
        depthWrite: !1,
        toneMapped: !1,
      }),
    );
    ((o.position.y = 1.5), e.add(o));
    let l = new Ge(new _s(1.2, 32), new vt({ color: 1706032, transparent: !0, opacity: 0.85, side: pn }));
    ((l.position.y = 1.5), (l.position.z = -0.01), e.add(l));
    let c = new Ge(
      new _s(1.8, 32),
      new vt({
        map: Ed(),
        color: 9060607,
        transparent: !0,
        opacity: 0.6,
        blending: en,
        depthWrite: !1,
        toneMapped: !1,
      }),
    );
    ((c.rotation.x = -Math.PI / 2),
      (c.position.y = 0.03),
      e.add(c),
      a.anim.push((d) => {
        ((o.rotation.z = d * 0.8), (c.rotation.z = -d * 0.3), (r.rotation.z = d * 0.2));
      }),
      (a.face = [o, l, r]));
  } else if (t === "extract") {
    let r = new Ge(
      new _s(1.5, 24),
      new vt({
        map: Ys(),
        color: 5308304,
        transparent: !0,
        opacity: 0.8,
        blending: en,
        depthWrite: !1,
        toneMapped: !1,
      }),
    );
    ((r.rotation.x = -Math.PI / 2), (r.position.y = 0.04), e.add(r), (a.pad = r));
    let o = D(je(0.9, 0.9, 14, 16, !0), Me(5308304, 0.12, !0), 0, 7, 0, { shadow: !1 });
    (e.add(o),
      (a.beam = o),
      (o.visible = !1),
      a.anim.push((l) => {
        r.rotation.z = l;
      }));
  } else if (t === "campfire") {
    for (let l = 0; l < 4; l++)
      e.add(D(je(0.06, 0.06, 0.7, 5), de(4861984), 0, 0.1, 0, { rz: Math.PI / 2, ry: l * 0.8 }));
    for (let l = 0; l < 8; l++)
      e.add(D(za(0.1), de(5921368), Math.cos(l * 0.8) * 0.45, 0.06, Math.sin(l * 0.8) * 0.45));
    let r = D(Xn(0.2, 0.55, 6), Me(16747040, 0.9), 0, 0.35, 0, { shadow: !1 });
    e.add(r);
    let o = D(Xn(0.12, 0.4, 6), Me(16769120), 0, 0.3, 0, { shadow: !1 });
    (e.add(o),
      a.anim.push((l) => {
        (r.scale.set(1, 1 + Math.sin(l * 13) * 0.15, 1),
          o.scale.set(1, 1 + Math.sin(l * 17 + 1) * 0.2, 1),
          (r.rotation.y = l * 3));
      }));
  } else if (t === "light") {
    if (n.model === "lamp")
      (e.add(D(je(0.05, 0.08, 2.6, 6), s, 0, 1.3, 0)),
        e.add(D(ue(0.3, 0.12, 0.3), s, 0, 2.6, 0)),
        e.add(D(ue(0.24, 0.04, 0.24), Me(n.c ?? 16769200), 0, 2.53, 0)));
    else if (n.model === "emergency") {
      let r = D(ue(0.18, 0.12, 0.18), Me(16719888), 0, 1.25, 0, { shadow: !1 });
      (e.add(r),
        a.anim.push((o) => {
          r.visible = Math.sin(o * 6) > -0.3;
        }));
    }
  } else if (t === "allyturret") {
    e.add(D(je(0.5, 0.6, 0.5, 8), i, 0, 0.25, 0));
    let r = new Ve();
    ((r.position.y = 0.65),
      e.add(r),
      r.add(D(ue(0.6, 0.35, 0.6), de(4872762, { m: 0.4 }), 0, 0.1, 0)),
      r.add(D(je(0.05, 0.05, 0.7, 6), s, 0.1, 0.12, 0.5, { rx: Math.PI / 2 })),
      r.add(D(je(0.05, 0.05, 0.7, 6), s, -0.1, 0.12, 0.5, { rx: Math.PI / 2 })),
      r.add(D(ue(0.3, 0.05, 0.02), Me(4251903), 0, 0.2, 0.31)),
      (a.head = r));
  } else if (t === "station") {
    let r = n.st;
    if (r === "shop") {
      e.add(D(ue(1.6, 1.4, 0.3), de(4864554), 0, 0.7, -0.2));
      for (let o = 0; o < 3; o++) {
        let l = vf(["rifle", "shotgun", "sniper"][o], 2);
        ((l.rotation.y = Math.PI / 2),
          (l.rotation.z = 0),
          l.position.set(-0.5 + o * 0.5, 0.8, -0),
          (l.rotation.x = Math.PI / 2),
          e.add(l));
      }
      e.add(D(ue(1.6, 0.8, 0.6), de(5916210), 0, 0.4, 0.4));
    }
    if (r === "workbench") {
      e.add(D(ue(1.6, 0.12, 0.8), de(6969920), 0, 0.85, 0));
      for (let [l, c] of [
        [-0.7, -0.3],
        [0.7, -0.3],
        [-0.7, 0.3],
        [0.7, 0.3],
      ])
        e.add(D(ue(0.08, 0.85, 0.08), s, l, 0.42, c));
      (e.add(D(ue(0.3, 0.25, 0.2), i, -0.5, 1.03, 0)),
        e.add(D(je(0.08, 0.08, 0.3, 8), de(11546656), 0.4, 1.05, 0.1, { rz: Math.PI / 2 })));
      let o = D(wt(0.05, 5, 4), Me(16752704), 0, 1, 0);
      (e.add(o),
        a.anim.push((l) => {
          o.visible = Math.sin(l * 9) > 0.6;
        }));
    }
    if (r === "lab")
      for (let o = 0; o < 2; o++)
        (e.add(D(je(0.3, 0.3, 0.15, 10), i, o * 0.8 - 0.4, 0.07, 0)),
          e.add(D(je(0.26, 0.26, 1.3, 10), Me(o ? 10354506 : 4251903, 0.55), o * 0.8 - 0.4, 0.8, 0)),
          e.add(D(je(0.3, 0.3, 0.12, 10), i, o * 0.8 - 0.4, 1.5, 0)));
    if (r === "board") {
      (e.add(D(ue(1.4, 1, 0.08), de(9071178), 0, 1.2, 0)),
        e.add(D(ue(0.08, 1.7, 0.08), s, -0.65, 0.85, -0.05)),
        e.add(D(ue(0.08, 1.7, 0.08), s, 0.65, 0.85, -0.05)));
      for (let o = 0; o < 6; o++)
        e.add(
          D(
            ue(0.3, 0.22, 0.01),
            de([15788240, 16769152, 13691135][o % 3]),
            -0.45 + (o % 3) * 0.45,
            1.05 + Math.floor(o / 3) * 0.32,
            0.05,
            { rz: (o - 3) * 0.05 },
          ),
        );
    }
    if (r === "deploy" || r === "table") {
      e.add(D(ue(1.6, 0.8, 1), i, 0, 0.4, 0));
      let o = D(ue(1.4, 0.02, 0.85), Me(r === "deploy" ? 4251903 : 16756768, 0.75, !0), 0, 0.82, 0);
      if ((e.add(o), r === "deploy")) {
        let l = D(gr(0.2, 0), Me(4251903, 0.8, !0), 0, 1.3, 0);
        (e.add(l),
          a.anim.push((c) => {
            ((l.rotation.y = c), (l.rotation.x = c * 0.5));
          }));
      }
    }
    r === "medbay" &&
      (e.add(D(ue(0.7, 0.4, 1.6), de(14673644), 0, 0.45, 0)),
      e.add(D(ue(0.06, 0.45, 1.5), s, 0, 0.2, 0)),
      e.add(D(ue(0.3, 0.08, 0.08), Me(16724032), 0, 0.9, 0)),
      e.add(D(ue(0.08, 0.08, 0.3), Me(16724032), 0, 0.9, 0)));
  } else if (t === "helipad") {
    let r = new Ge(new _s(2.2, 24), de(3817026));
    ((r.rotation.x = -Math.PI / 2),
      (r.position.y = 0.02),
      e.add(r),
      e.add(D(ue(0.2, 0.01, 1.4), de(16766023), -0.45, 0.03, 0)),
      e.add(D(ue(0.2, 0.01, 1.4), de(16766023), 0.45, 0.03, 0)),
      e.add(D(ue(0.9, 0.01, 0.2), de(16766023), 0, 0.03, 0)));
    let o = new Ve();
    ((o.position.y = 0.1),
      (o.rotation.y = 0.6),
      e.add(o),
      o.add(D(wt(0.75, 10, 8), de(3820084, { m: 0.3 }), 0, 0.8, 0.3, { s: [0.9, 0.8, 1.4] })),
      o.add(D(ue(0.25, 0.25, 2.2), de(3820084), 0, 0.95, -1.4)),
      o.add(D(ue(0.06, 0.6, 0.35), de(3820084), 0, 1.2, -2.4)),
      o.add(D(wt(0.45, 8, 6), de(1714736, { m: 0.8, r: 0.1 }), 0, 0.95, 0.85, { s: [1, 0.7, 0.8] })));
    for (let c of [-1, 1]) o.add(D(ue(0.06, 0.06, 1.8), s, c * 0.55, 0.1, 0.2));
    let l = new Ve();
    ((l.position.y = 1.55),
      o.add(l),
      l.add(D(ue(4.4, 0.03, 0.18), s, 0, 0, 0)),
      l.add(D(ue(0.18, 0.03, 4.4), s, 0, 0, 0)),
      a.anim.push((c) => {
        l.rotation.y = c * 0.6;
      }));
  } else if (t === "flag") {
    e.add(D(je(0.04, 0.05, 4, 6), de(9080724, { m: 0.6 }), 0, 2, 0));
    let r = D(ea(1.4, 0.9), new Xt({ color: 2767402, side: pn, roughness: 0.9 }), 0.72, 3.5, 0);
    e.add(r);
    let o = D(
      ea(0.5, 0.5),
      new vt({ map: Ed(), color: 16756768, transparent: !0, side: pn, toneMapped: !1 }),
      0.72,
      3.5,
      0.01,
    );
    (e.add(o),
      a.anim.push((l) => {
        ((r.rotation.y = Math.sin(l * 2) * 0.15), (o.rotation.y = r.rotation.y));
      }));
  } else if (t === "prisoner") {
    let r = Eo({ suit: 6974042, hat: "none", civ: !0, unarmed: !0, skin: 12619888 });
    (r.legs.forEach((l) => (l.rotation.x = -1.4)),
      (r.body.position.y = -0.38),
      r.armR.rotation.set(0.4, 0, 0.5),
      r.armL.rotation.set(0.4, 0, -0.5),
      e.add(r.root));
    let o = D(Qs(0.15), Me(5308304), 0, 1.6, 0);
    (e.add(o),
      a.anim.push((l) => {
        ((o.rotation.y = l * 2), (o.position.y = 1.6 + Math.sin(l * 3) * 0.1));
      }),
      (a.marker = o));
  } else if (t === "supply") {
    (e.add(D(ue(1.1, 0.8, 1.1), de(3820084, { m: 0.3 }), 0, 0.4, 0)),
      e.add(D(ue(1.14, 0.1, 1.14), de(2765860), 0, 0.82, 0)),
      e.add(D(ue(0.5, 0.3, 0.02), Me(4259712), 0, 0.5, 0.56)));
    let r = D(wt(1.2, 10, 5), de(13682864, { r: 0.9 }), 0.9, 0.25, -0.6, { s: [1, 0.35, 1], rz: 1.2 });
    e.add(r);
    let o = D(je(0.15, 0.15, 10, 8), Me(4259712, 0.18, !0), 0, 5, 0, { shadow: !1 });
    (e.add(o),
      a.anim.push((l) => {
        Math.random() < 0.3;
      }));
  } else if (t === "stairs" || t === "exit") kw(e, n, a);
  else if (t === "plate") {
    e.add(D(je(0.62, 0.7, 0.08, 16), de(2764598, { m: 0.6, r: 0.4 }), 0, 0.04, 0, { shadow: !1 }));
    let r = D(je(0.5, 0.5, 0.04, 16), Me(2771546), 0, 0.1, 0, { shadow: !1 });
    (e.add(r), (a.top = r));
    let o = new Ge(
      ea(1, 1),
      new vt({ map: Ys(), color: 4646143, transparent: !0, opacity: 0, blending: en, depthWrite: !1, toneMapped: !1 }),
    );
    ((o.rotation.x = -Math.PI / 2), (o.position.y = 0.13), o.scale.set(1.9, 1.9, 1), e.add(o), (a.ring = o));
    for (let l = 0; l < 4; l++)
      e.add(
        D(ue(0.08, 0.05, 0.3), de(16756768), Math.cos(l * 1.571) * 0.6, 0.07, Math.sin(l * 1.571) * 0.6, {
          ry: -l * 1.571,
          shadow: !1,
        }),
      );
    a.anim.push((l) => {
      o.rotation.z = l * 0.8;
    });
  } else if (t === "pylon") {
    (e.add(D(je(0.7, 0.85, 0.35, 6), de(2763316), 0, 0.17, 0)),
      e.add(D(je(0.18, 0.32, 2.2, 6), de(3421247, { m: 0.4 }), 0, 1.4, 0)));
    for (let l = 0; l < 3; l++)
      e.add(
        D(ue(0.08, 1.6, 0.08), de(2236970), Math.cos(l * 2.09) * 0.45, 1, Math.sin(l * 2.09) * 0.45, {
          rz: Math.cos(l * 2.09) * 0.15,
          rx: Math.sin(l * 2.09) * 0.15,
        }),
      );
    let r = D(Qs(0.32), Me(9075455), 0, 2.9, 0);
    (e.add(r), (a.core = r));
    let o = D(wi(0.5, 0.03, 4, 20), Me(9075455, 0.7, !0), 0, 2.9, 0, { rx: Math.PI / 2 });
    (e.add(o),
      (a.halo = o),
      a.anim.push((l) => {
        ((r.rotation.y = l * 1.6), (r.position.y = 2.9 + Math.sin(l * 2) * 0.1), (o.rotation.z = -l));
      }));
  } else if (t === "civilian") {
    let o = Eo({
      suit: [9071178, 4872826, 8014426][(n.n || 0) % 3],
      hat: "none",
      civ: !0,
      unarmed: !0,
      skin: [12619888, 9068608, 14725264][(n.n || 0) % 3],
      fem: (n.n || 0) === 1,
    });
    (o.legs.forEach((c) => (c.rotation.x = -1.2)),
      (o.body.position.y = -0.32),
      o.armR.rotation.set(-2.2, 0, 0.3),
      o.armL.rotation.set(-2.2, 0, -0.3),
      e.add(o.root),
      (a.rig = o),
      e.add(Ei(0.4)));
    let l = D(Qs(0.13), Me(6280026), 0, 1.55, 0, { shadow: !1 });
    (e.add(l),
      (a.marker = l),
      a.anim.push((c) => {
        ((l.rotation.y = c * 2),
          (l.position.y = 1.55 + Math.sin(c * 3) * 0.08),
          (o.root.position.y = Math.abs(Math.sin(c * 9 + (n.n || 0))) * 0.02));
      }));
  } else if (t === "device") {
    (e.add(D(ue(1.3, 0.5, 1.3), de(3817544, { m: 0.6, r: 0.4 }), 0, 0.25, 0)),
      e.add(D(ue(1.34, 0.08, 1.34), de(16756768), 0, 0.52, 0)),
      e.add(D(je(0.12, 0.18, 1.6, 6), s, 0, 1.3, 0)));
    let r = new Ve();
    ((r.position.y = 2.1),
      e.add(r),
      r.add(D(Cl(0.6), de(13159632, { m: 0.4, r: 0.4 }), 0, 0, 0.1, { rx: -Math.PI / 2 - 0.5 })),
      r.add(D(je(0.03, 0.03, 0.6, 5), s, 0, 0.15, 0.35, { rx: 0.9 })));
    let o = D(gr(0.16, 0), Me(4646143), 0, 0.85, 0.66);
    (e.add(o), (a.core = o));
    for (let l = 0; l < 4; l++)
      e.add(
        D(
          ue(0.3, 0.2, 0.02),
          Me(l % 2 ? 4646143 : 6280026),
          Math.cos(l * 1.571) * 0.66,
          0.3,
          Math.sin(l * 1.571) * 0.66,
          { ry: -l * 1.571 + Math.PI / 2, shadow: !1 },
        ),
      );
    ((a.dish = r),
      a.anim.push((l) => {
        ((r.rotation.y = l * 0.7), (o.rotation.y = l * 3));
      }));
  }
  return e;
}


// ════════ [375] VariableDeclaration Cw (95 bytes) ════════
var Cw = { miniboss: 16734810, waves: 16757568, defend_civ: 6280026, defend_eq: 4646143, puzzle: 12946431 };


// ════════ [376] FunctionDeclaration kw (2325 bytes) ════════
function kw(n, e, t) {
  let i = e.k === "exit" ? "exit" : e.kind,
    s = de(3817544, { m: 0.6, r: 0.4 }),
    a = de(1974822, { m: 0.4 }),
    r = new vt({ color: 131587 }),
    o = e.k === "exit" ? 6280026 : (Cw[e.enc] ?? 16757568);
  if (i === "upper" || i === "exit") {
    for (let f = 0; f < 6; f++)
      n.add(D(ue(1.1, 0.22 * (f + 1), 0.28), de(f % 2 ? 6974056 : 6184540), 0, 0.11 * (f + 1), 0.6 - f * 0.28));
    for (let f of [-1, 1]) {
      n.add(D(ue(0.06, 0.06, 1.8), a, f * 0.58, 1.2, 0, { rx: 0.62 }));
      for (let u = 0; u < 3; u++) n.add(D(ue(0.05, 0.6, 0.05), a, f * 0.58, 0.55 + u * 0.32, 0.55 - u * 0.55));
    }
    (n.add(D(ue(1.3, 0.08, 0.6), s, 0, 1.36, -1.25)), (t.face = !0));
  } else if (i === "basement") {
    let f = new Ge(ea(1, 1.6), r);
    ((f.rotation.x = -Math.PI / 2), (f.position.y = 0.012), n.add(f));
    for (let u = 0; u < 5; u++) {
      let p = 0.55 - u * 0.12;
      n.add(
        D(ue(0.96, 0.02, 0.28), de(new Ee(p * 0.6, p * 0.6, p * 0.58).getHex()), 0, 0.02, 0.62 - u * 0.3, {
          shadow: !1,
        }),
      );
    }
    for (let u of [-1, 1])
      (n.add(D(ue(0.08, 0.9, 0.08), a, u * 0.55, 0.45, 0.75)),
        n.add(D(ue(0.06, 0.06, 1.7), a, u * 0.55, 0.88, 0)),
        n.add(D(ue(0.08, 0.9, 0.08), a, u * 0.55, 0.45, -0.75)));
    n.add(D(ue(1.2, 0.05, 0.1), de(16756768), 0, 0.03, 0.84, { shadow: !1 }));
  } else if (i === "hatch") {
    n.add(D(je(0.75, 0.82, 0.25, 12), s, 0, 0.12, 0));
    let f = D(je(0.58, 0.58, 0.02, 12), r, 0, 0.26, 0, { shadow: !1 });
    n.add(f);
    let u = new Ve();
    (u.position.set(0, 0.28, -0.6),
      (u.rotation.x = -1.2),
      n.add(u),
      u.add(D(je(0.6, 0.6, 0.1, 12), de(4872762, { m: 0.5 }), 0, 0, 0.6, { rx: 0 })),
      u.add(D(wi(0.25, 0.03, 4, 10), de(16756768), 0, 0.07, 0.6, { rx: Math.PI / 2 })));
    for (let p = 0; p < 3; p++)
      n.add(D(ue(0.5, 0.03, 0.04), de(9080724, { m: 0.6 }), 0, 0.27, -0.25 + p * 0.2, { shadow: !1 }));
  } else if (i === "sewer") {
    let f = D(je(0.55, 0.55, 0.02, 14), r, 0, 0.02, 0, { shadow: !1 });
    (n.add(f),
      n.add(D(wi(0.58, 0.06, 4, 16), de(3815992, { m: 0.5 }), 0, 0.03, 0, { rx: Math.PI / 2 })),
      n.add(D(je(0.55, 0.55, 0.06, 14), de(3815992, { m: 0.6, r: 0.5 }), 0.95, 0.05, 0.35, { rz: 0.15 })));
  } else {
    let f = new Ge(ea(1.8, 2.2), new vt({ color: 0, transparent: !0, opacity: 0.85, depthWrite: !1 }));
    ((f.rotation.x = -Math.PI / 2), (f.position.y = 0.02), n.add(f));
    let u = i === "hive" ? de(5909082, { e: 6299808, ei: 0.4 }) : de(4867136);
    for (let p = 0; p < 7; p++) {
      let m = -Math.PI * 0.95 + p * ((Math.PI * 0.95) / 3);
      n.add(D(za(0.35 + (p % 2) * 0.12), u, Math.cos(m) * 1, 0.25, Math.sin(m) * 1.15 - 0.2));
    }
  }
  let l = new Ve();
  ((l.position.y = i === "upper" || i === "exit" ? 2.4 : 1.7), n.add(l));
  let c = D(Xn(0.18, 0.32, 4), Me(o), 0, 0, 0, { rx: i === "upper" || i === "exit" ? 0 : Math.PI, shadow: !1 });
  l.add(c);
  let d = D(wi(0.3, 0.025, 4, 18), Me(o, 0.7, !0), 0, 0, 0, { rx: Math.PI / 2, shadow: !1 });
  l.add(d);
  let h = D(je(0.1, 0.1, 3, 8), Me(o, 0.13, !0), 0, 1.5, 0, { shadow: !1 });
  (l.add(h),
    (t.mark = l),
    (t.markCol = o),
    t.anim.push((f) => {
      ((c.rotation.y = f * 2),
        (l.position.y = (i === "upper" || i === "exit" ? 2.4 : 1.7) + Math.sin(f * 2.5) * 0.12),
        d.scale.setScalar(1 + Math.sin(f * 3) * 0.1));
    }));
}


// ════════ [377] FunctionDeclaration Hg (971 bytes) ════════
function Hg(n, e) {
  let t = new Ve(),
    i = n.tiles.map((y) => [y % e.w, Math.floor(y / e.w)]);
  if (!i.length) return t;
  let s = i.map((y) => y[0]),
    a = i.map((y) => y[1]),
    r = Math.min(...s),
    o = Math.max(...s) + 1,
    l = Math.min(...a),
    c = Math.max(...a) + 1,
    d = (r + o) / 2,
    h = (l + c) / 2,
    f = n.axis === "z",
    u = f ? o - r : c - l,
    p = f ? c - l : o - r,
    m = [],
    g = n.shortcut ? 16756768 : 16726586,
    b = 2;
  for (let y = 0; y < b; y++) {
    let v = (y / (b - 1) - 0.5) * (p - 0.6),
      _ = new Ge(
        ea(u, 2.4),
        new vt({ color: g, transparent: !0, opacity: 0.35, blending: en, side: pn, depthWrite: !1, toneMapped: !1 }),
      );
    (_.position.set(d + (f ? 0 : v), 1.2, h + (f ? v : 0)), f || (_.rotation.y = Math.PI / 2), t.add(_), m.push(_));
    for (let A = 0; A < 4; A++) {
      let T = new Ge(ue(f ? u : 0.05, 0.05, f ? 0.05 : u), Me(g));
      (T.position.set(_.position.x, 0.3 + A * 0.6, _.position.z), t.add(T), m.push(T));
    }
  }
  for (let y of [-1, 1]) {
    let v = f ? d + y * (u / 2 + 0.2) : d,
      _ = f ? h : h + y * (u / 2 + 0.2),
      A = new Ge(ue(0.7, 3.2, 0.7), de(2764598, { m: 0.6, r: 0.4 }));
    (A.position.set(v, 1.6, _), (A.castShadow = !0), t.add(A));
    let T = new Ge(ue(0.72, 0.15, 0.72), Me(g));
    (T.position.set(v, 2.9, _), t.add(T), m.push(T));
  }
  return ((t.userData = { field: m, cx: d, cz: h, col: g }), t);
}


// ════════ [378] FunctionDeclaration Gg (740 bytes) ════════
function Gg(n) {
  let e = new Ve(),
    t = Ct[n.r].c;
  if (n.type === "weapon") {
    let i = vf(n.base, n.r);
    ((i.rotation.y = Math.PI / 2), i.scale.setScalar(1.4), e.add(i));
  } else {
    let i = ai[n.base],
      s = de(i.col, { m: 0.3 });
    n.slot === "helmet"
      ? (e.add(D(Cl(0.22), s, 0, -0.05, 0)), e.add(D(ue(0.26, 0.05, 0.04), Me(t), 0, 0, 0.18)))
      : n.slot === "suit"
        ? (e.add(D(ue(0.42, 0.42, 0.22), s)), e.add(D(ue(0.44, 0.08, 0.24), de(2237738), 0, -0.12, 0)))
        : n.slot === "gloves"
          ? (e.add(D(ue(0.16, 0.2, 0.1), s, -0.1, 0, 0)), e.add(D(ue(0.16, 0.2, 0.1), s, 0.1, 0, 0)))
          : n.slot === "boots"
            ? (e.add(D(ue(0.14, 0.25, 0.3), s, -0.1, 0, 0)), e.add(D(ue(0.14, 0.25, 0.3), s, 0.1, 0, 0)))
            : n.slot === "implant"
              ? (e.add(D(ue(0.25, 0.04, 0.25), de(1974822))), e.add(D(ue(0.15, 0.06, 0.15), Me(i.col))))
              : (e.add(D(gr(0.18, 0), Me(i.col))),
                e.add(D(wi(0.26, 0.025, 4, 14), de(9080724, { m: 0.7 }), 0, 0, 0, { rx: Math.PI / 2 })));
  }
  return e;
}


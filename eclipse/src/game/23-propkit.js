// 23-propkit.js — Kit de props procedurales (Ie.*) y geometría fusionada

// ════════ [532] VariableDeclaration Qd,Dx,Ox,Nx,Ux,Fx (62 bytes) ════════
var Qd = new Ee(),
  Dx = new at(),
  Ox = new Bn(),
  Nx = new va(),
  Ux = new U(),
  Fx = new U();


// ════════ [533] FunctionDeclaration J (993 bytes) ════════
function J(n, e, t = {}) {
  let i = n.index ? n.toNonIndexed() : n;
  if (
    (i.deleteAttribute("uv"),
    Nx.set(t.rx || 0, t.ry || 0, t.rz || 0),
    Ox.setFromEuler(Nx),
    Ux.set(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1),
    Fx.set(t.x || 0, t.y || 0, t.z || 0),
    Dx.compose(Fx, Ox, Ux),
    i.applyMatrix4(Dx),
    t.jit)
  ) {
    let o = i.attributes.position,
      l = pi(t.seed || 7),
      c = new Map();
    for (let d = 0; d < o.count; d++) {
      let h = `${o.getX(d).toFixed(3)},${o.getY(d).toFixed(3)},${o.getZ(d).toFixed(3)}`,
        f = c.get(h);
      (f || ((f = [(l() - 0.5) * t.jit, (l() - 0.5) * t.jit * (t.jitY ?? 1), (l() - 0.5) * t.jit]), c.set(h, f)),
        o.setXYZ(d, o.getX(d) + f[0], o.getY(d) + f[1], o.getZ(d) + f[2]));
    }
  }
  i.computeVertexNormals();
  let s = i.attributes.position.count,
    a = new Float32Array(s * 3),
    r = pi((t.seed || 3) * 31 + s);
  for (let o = 0; o < s; o += 3) {
    let l = e;
    if (t.grad) {
      let d = i.attributes.position.getY(o);
      l = tt(e, t.grad[0], Math.max(0, Math.min(1, (d - t.grad[1]) / (t.grad[2] - t.grad[1]))));
    }
    Qd.setHex(l);
    let c = t.vary ? 1 + (r() - 0.5) * t.vary : 1;
    for (let d = 0; d < 3; d++)
      ((a[(o + d) * 3] = Qd.r * c), (a[(o + d) * 3 + 1] = Qd.g * c), (a[(o + d) * 3 + 2] = Qd.b * c));
  }
  return (i.setAttribute("color", new St(a, 3)), i);
}


// ════════ [534] VariableDeclaration eh,Je,Ye,_n,Wn,ko,Yn,Mp,ra,Ie (250 bytes) ════════
var eh = (n) => (n.length ? Ld(n, !1) : null),
  Je = (n, e, t) => new kn(n, e, t),
  Ye = (n, e, t, i = 7) => new ni(n, e, t, i),
  _n = (n, e = 7, t = 5) => new rr(n, e, t),
  Wn = (n, e, t = 6) => new oo(n, e, t),
  ko = (n, e = 0) => new ya(n, e),
  Yn = (n) => new lo(n, 0),
  Mp = (n, e, t = 5, i = 10) => new Yi(n, e, t, i),
  ra = (n) => new _a(n, 0),
  Ie = {};


// ════════ [535] ExpressionStatement ExpressionStatement (282 bytes) ════════
Ie.pine = (n, e) => ({
  g: [
    J(Ye(0.09, 0.13, 0.7, 5), 4863012, { y: 0.35 }),
    J(Wn(0.75, 1.1, 7), n.leaf || 3103274, { y: 1.05, vary: 0.15, seed: e, jit: 0.08 }),
    J(Wn(0.58, 0.95, 7), tt(n.leaf || 3103274, 16777215, 0.08), { y: 1.55, vary: 0.15, seed: e + 1, jit: 0.07 }),
    J(Wn(0.38, 0.8, 7), tt(n.leaf || 3103274, 16777215, 0.15), { y: 2, seed: e + 2, jit: 0.05 }),
  ],
});


// ════════ [536] ExpressionStatement ExpressionStatement (257 bytes) ════════
Ie.pine_snow = (n, e) => ({
  g: [
    J(Ye(0.09, 0.13, 0.7, 5), 4863012, { y: 0.35 }),
    J(Wn(0.75, 1.1, 7), 2771514, { y: 1.05, jit: 0.08, seed: e }),
    J(Wn(0.6, 0.5, 7), 15791871, { y: 1.35, jit: 0.05, seed: e + 3 }),
    J(Wn(0.55, 0.95, 7), 3035198, { y: 1.6, jit: 0.07, seed: e + 1 }),
    J(Wn(0.38, 0.75, 7), 16054527, { y: 2.05, seed: e + 2 }),
  ],
});


// ════════ [537] ExpressionStatement ExpressionStatement (281 bytes) ════════
Ie.oak = (n, e) => ({
  g: [
    J(Ye(0.12, 0.18, 0.9, 6), 5914672, { y: 0.45 }),
    J(ko(0.75, 0), n.leaf2 || 4880946, { y: 1.45, jit: 0.25, seed: e, vary: 0.2 }),
    J(ko(0.5, 0), tt(n.leaf2 || 4880946, 16777088, 0.12), { x: 0.35, y: 1.75, z: 0.2, jit: 0.15, seed: e + 1 }),
    J(ko(0.45, 0), tt(n.leaf2 || 4880946, 0, 0.12), { x: -0.35, y: 1.3, z: -0.2, jit: 0.15, seed: e + 2 }),
  ],
});


// ════════ [538] ExpressionStatement ExpressionStatement (164 bytes) ════════
Ie.bush = (n, e) => ({
  g: [
    J(ko(0.42, 0), n.leaf2 || 4880946, { y: 0.3, sy: 0.7, jit: 0.15, seed: e, vary: 0.2 }),
    J(ko(0.3, 0), tt(n.leaf2 || 4880946, 16777215, 0.1), { x: 0.25, y: 0.35, jit: 0.1, seed: e + 1 }),
  ],
});


// ════════ [539] ExpressionStatement ExpressionStatement (80 bytes) ════════
Ie.rock = (n, e) => ({ g: [J(Yn(0.45), n.rock, { y: 0.22, sy: 0.65, jit: 0.18, seed: e, vary: 0.15 })] });


// ════════ [540] ExpressionStatement ExpressionStatement (151 bytes) ════════
Ie.rock_big = (n, e) => ({
  g: [
    J(Yn(0.8), n.rock, { y: 0.4, sy: 0.75, jit: 0.3, seed: e, vary: 0.12 }),
    J(Yn(0.45), tt(n.rock, 16777215, 0.08), { x: 0.5, y: 0.25, z: 0.3, jit: 0.15, seed: e + 1 }),
  ],
});


// ════════ [541] ExpressionStatement ExpressionStatement (163 bytes) ════════
Ie.rock_desert = (n, e) => ({
  g: [
    J(Je(0.9, 0.7, 0.8), 11567194, { y: 0.35, jit: 0.25, seed: e, vary: 0.1, grad: [14198904, 0, 0.7] }),
    J(Je(0.6, 0.35, 0.6), 13144160, { y: 0.85, x: 0.1, jit: 0.15, seed: e + 1 }),
  ],
});


// ════════ [542] ExpressionStatement ExpressionStatement (104 bytes) ════════
Ie.mesa = (n, e) => ({
  g: [J(Ye(0.9, 1.1, 1.6, 7), 11037250, { y: 0.8, jit: 0.2, seed: e, grad: [14195298, 0, 1.6], vary: 0.06 })],
});


// ════════ [543] ExpressionStatement ExpressionStatement (126 bytes) ════════
Ie.boulder_snow = (n, e) => ({
  g: [
    J(Yn(0.6), 8030872, { y: 0.3, sy: 0.7, jit: 0.2, seed: e }),
    J(Yn(0.5), 15922938, { y: 0.5, sy: 0.35, jit: 0.15, seed: e + 1 }),
  ],
});


// ════════ [544] ExpressionStatement ExpressionStatement (144 bytes) ════════
Ie.log = (n, e) => ({
  g: [
    J(Ye(0.16, 0.16, 1.4, 6), 5914672, { y: 0.16, rz: Math.PI / 2, vary: 0.1, seed: e }),
    J(Ye(0.14, 0.14, 0.02, 6), 11571296, { x: 0.71, y: 0.16, rz: Math.PI / 2 }),
  ],
});


// ════════ [545] ExpressionStatement ExpressionStatement (97 bytes) ════════
Ie.stump = (n, e) => ({
  g: [J(Ye(0.22, 0.28, 0.4, 7), 5914672, { y: 0.2 }), J(Ye(0.22, 0.22, 0.02, 7), 11571296, { y: 0.41 })],
});


// ════════ [546] ExpressionStatement ExpressionStatement (225 bytes) ════════
Ie.dead_tree = (n, e) => ({
  g: [
    J(Ye(0.06, 0.13, 1.8, 5), 4864560, { y: 0.9, jit: 0.05, seed: e }),
    J(Ye(0.03, 0.06, 0.8, 4), 4864560, { x: 0.25, y: 1.4, rz: -0.8 }),
    J(Ye(0.03, 0.05, 0.7, 4), 4864560, { x: -0.2, y: 1.2, rz: 0.9 }),
    J(Ye(0.02, 0.04, 0.5, 4), 4864560, { z: 0.15, y: 1.75, rx: 0.7 }),
  ],
});


// ════════ [547] ExpressionStatement ExpressionStatement (230 bytes) ════════
Ie.swamp_tree = (n, e) => ({
  g: [
    J(Ye(0.1, 0.25, 1.6, 6), 3815978, { y: 0.8, jit: 0.08, seed: e }),
    J(ko(0.6, 0), 4872746, { y: 1.8, sy: 0.6, jit: 0.25, seed: e, vary: 0.25 }),
    J(Ye(0.015, 0.015, 0.8, 3), 5925434, { x: 0.4, y: 1.3 }),
    J(Ye(0.015, 0.015, 0.7, 3), 5925434, { x: -0.3, y: 1.35, z: 0.2 }),
  ],
});


// ════════ [548] ExpressionStatement ExpressionStatement (152 bytes) ════════
Ie.mushroom = (n, e) => ({
  g: [J(Ye(0.12, 0.18, 1, 6), 14209208, { y: 0.5 })],
  e: [J(_n(0.55, 8, 4), 10305791, { y: 1.05, sy: 0.45, seed: e }), J(_n(0.08, 4, 3), 13696864, { y: 1.25, x: 0.25 })],
});


// ════════ [549] ExpressionStatement ExpressionStatement (153 bytes) ════════
Ie.reeds = (n, e) => ({
  g: Array.from({ length: 5 }, (t, i) =>
    J(Ye(0.015, 0.025, 0.8 + (i % 3) * 0.15, 3), 6978106, {
      x: Math.cos(i * 1.3) * 0.2,
      z: Math.sin(i * 1.3) * 0.2,
      y: 0.42,
      rz: (i - 2) * 0.08,
    }),
  ),
});


// ════════ [550] ExpressionStatement ExpressionStatement (269 bytes) ════════
Ie.cactus = (n, e) => ({
  g: [
    J(Ye(0.16, 0.18, 1.3, 7), 4880954, { y: 0.65, vary: 0.1, seed: e }),
    J(Ye(0.1, 0.1, 0.5, 6), 4880954, { x: 0.25, y: 0.8, rz: -Math.PI / 2 }),
    J(Ye(0.1, 0.1, 0.45, 6), 4880954, { x: 0.38, y: 1 }),
    J(Ye(0.09, 0.09, 0.3, 6), 4880954, { x: -0.22, y: 0.55, rz: Math.PI / 2 }),
    J(Ye(0.09, 0.09, 0.35, 6), 4880954, { x: -0.34, y: 0.72 }),
  ],
});


// ════════ [551] ExpressionStatement ExpressionStatement (179 bytes) ════════
Ie.bones = (n, e) => ({
  g: [
    J(Ye(0.04, 0.04, 0.8, 4), 15261896, { y: 0.05, rz: Math.PI / 2, ry: 0.4 }),
    J(Ye(0.04, 0.04, 0.6, 4), 15261896, { y: 0.05, rz: Math.PI / 2, ry: -0.6, z: 0.2 }),
    J(_n(0.14, 5, 4), 15261896, { x: 0.35, y: 0.1 }),
  ],
});


// ════════ [552] ExpressionStatement ExpressionStatement (185 bytes) ════════
Ie.skull = (n, e) => ({
  g: [
    J(_n(0.5, 7, 5), 14735552, { y: 0.4, sy: 0.8 }),
    J(Je(0.5, 0.25, 0.4), 13682864, { y: 0.12, z: 0.25 }),
    J(_n(0.12, 5, 4), 2103312, { y: 0.45, z: 0.4, x: 0.17 }),
    J(_n(0.12, 5, 4), 2103312, { y: 0.45, z: 0.4, x: -0.17 }),
  ],
});


// ════════ [553] ExpressionStatement ExpressionStatement (336 bytes) ════════
Ie.car = (n, e) => {
  let t = [8010282, 3820122, 5921354, 6974058][e % 4];
  return {
    g: [
      J(Je(1.7, 0.45, 0.85), t, { y: 0.38, vary: 0.1, seed: e }),
      J(Je(0.95, 0.35, 0.78), tt(t, 0, 0.2), { y: 0.78, x: -0.1 }),
      J(Je(0.7, 0.3, 0.8), 1712680, { y: 0.78, x: -0.12, sx: 1.02, sz: 0.98 }),
      ...[
        [0.55, 0.42],
        [-0.55, 0.42],
        [0.55, -0.42],
        [-0.55, -0.42],
      ].map(([i, s]) => J(Ye(0.18, 0.18, 0.12, 7), 1710618, { x: i, z: s, y: 0.18, rx: Math.PI / 2 })),
    ],
  };
};


// ════════ [554] ExpressionStatement ExpressionStatement (257 bytes) ════════
Ie.tank_wreck = (n, e) => ({
  g: [
    J(Je(2.2, 0.6, 1.3), 4868666, { y: 0.4, jit: 0.05, seed: e }),
    J(Je(1.1, 0.45, 0.9), 5921352, { y: 0.9, ry: 0.3 }),
    J(Ye(0.07, 0.07, 1.4, 6), 3815984, { y: 0.95, x: 0.8, rz: Math.PI / 2 - 0.2, ry: 0.3 }),
    J(Je(2.3, 0.35, 0.3), 2763300, { y: 0.2, z: 0.6 }),
    J(Je(2.3, 0.35, 0.3), 2763300, { y: 0.2, z: -0.6 }),
  ],
});


// ════════ [555] ExpressionStatement ExpressionStatement (215 bytes) ════════
Ie.rubble = (n, e) => ({
  g: [
    J(Je(0.7, 0.35, 0.6), n.wall || 8025194, { y: 0.17, ry: 0.4, jit: 0.15, seed: e }),
    J(Je(0.5, 0.25, 0.4), tt(n.wall || 8025194, 0, 0.2), { x: 0.4, y: 0.12, z: 0.2, ry: 1.2, jit: 0.1, seed: e + 1 }),
    J(Je(0.25, 0.7, 0.2), 5913130, { x: -0.3, y: 0.35, rz: 0.5 }),
  ],
});


// ════════ [556] ExpressionStatement ExpressionStatement (89 bytes) ════════
Ie.rubble_s = (n, e) => ({ g: [J(Je(0.5, 0.25, 0.5), n.wall || 8025194, { y: 0.12, ry: 0.4, jit: 0.15, seed: e })] });


// ════════ [557] ExpressionStatement ExpressionStatement (148 bytes) ════════
Ie.lamp = (n, e) => ({
  g: [J(Ye(0.05, 0.07, 2.4, 6), 3817028, { y: 1.2 }), J(Je(0.55, 0.06, 0.12), 3817028, { y: 2.35, x: 0.25 })],
  e: [J(Je(0.22, 0.05, 0.12), 16769184, { y: 2.3, x: 0.45 })],
});


// ════════ [558] ExpressionStatement ExpressionStatement (175 bytes) ════════
Ie.barrel = (n, e) => ({
  g: [
    J(Ye(0.24, 0.24, 0.68, 9), [9058858, 3824250, 5925434][e % 3], { y: 0.34, vary: 0.08, seed: e }),
    J(Ye(0.25, 0.25, 0.04, 9), 2763306, { y: 0.22 }),
    J(Ye(0.25, 0.25, 0.04, 9), 2763306, { y: 0.48 }),
  ],
});


// ════════ [559] ExpressionStatement ExpressionStatement (161 bytes) ════════
Ie.barrel_toxic = (n, e) => ({
  g: [
    J(Ye(0.24, 0.24, 0.68, 9), 13148192, { y: 0.34, vary: 0.06, seed: e }),
    J(Ye(0.25, 0.25, 0.05, 9), 2763306, { y: 0.5 }),
  ],
  e: [J(Ye(0.2, 0.2, 0.02, 9), 10354506, { y: 0.69 })],
});


// ════════ [560] ExpressionStatement ExpressionStatement (175 bytes) ════════
Ie.barrel_rad = (n, e) => ({
  g: [J(Ye(0.24, 0.24, 0.68, 9), 3815984, { y: 0.34, rz: e % 2 ? 0.2 : 0 })],
  e: [
    J(Ye(0.245, 0.245, 0.12, 9), 13172512, { y: 0.34 }),
    J(_n(0.25, 6, 3), 10354464, { y: 0.03, sy: 0.15, sx: 1.6, sz: 1.3 }),
  ],
});


// ════════ [561] ExpressionStatement ExpressionStatement (145 bytes) ════════
Ie.crate = (n, e) => ({
  g: [
    J(Je(0.75, 0.75, 0.75), 8018488, { y: 0.375, vary: 0.1, seed: e }),
    J(Je(0.78, 0.08, 0.78), 5914664, { y: 0.72 }),
    J(Je(0.78, 0.08, 0.78), 5914664, { y: 0.04 }),
  ],
});


// ════════ [562] ExpressionStatement ExpressionStatement (171 bytes) ════════
Ie.crates = (n, e) => ({
  g: [
    J(Je(0.75, 0.75, 0.75), 6969914, { y: 0.375, x: -0.2, vary: 0.1 }),
    J(Je(0.6, 0.6, 0.6), 5925434, { y: 0.3, x: 0.45, z: 0.3, ry: 0.3 }),
    J(Je(0.55, 0.55, 0.55), 8018488, { y: 1.02, x: -0.2, ry: 0.2 }),
  ],
});


// ════════ [563] ExpressionStatement ExpressionStatement (69 bytes) ════════
Ie.tire = (n, e) => ({ g: [J(Mp(0.25, 0.1, 5, 9), 1973790, { y: 0.1, rx: Math.PI / 2 })] });


// ════════ [564] ExpressionStatement ExpressionStatement (147 bytes) ════════
Ie.hydrant = (n, e) => ({
  g: [
    J(Ye(0.12, 0.14, 0.55, 7), 11546656, { y: 0.27 }),
    J(_n(0.13, 6, 4), 11546656, { y: 0.56 }),
    J(Ye(0.05, 0.05, 0.36, 5), 10496024, { y: 0.35, rz: Math.PI / 2 }),
  ],
});


// ════════ [565] ExpressionStatement ExpressionStatement (199 bytes) ════════
Ie.ice_spike = (n, e) => ({
  g: [],
  e: [
    J(Wn(0.25, 1.4, 5), 10475775, { y: 0.7, jit: 0.08, seed: e, rz: 0.1 }),
    J(Wn(0.16, 0.9, 5), 12642559, { x: 0.25, y: 0.45, rz: -0.3, seed: e + 1 }),
    J(Wn(0.14, 0.7, 5), 8440063, { x: -0.2, y: 0.35, rz: 0.4, z: 0.1 }),
  ],
  dim: 0.45,
});


// ════════ [566] ExpressionStatement ExpressionStatement (157 bytes) ════════
Ie.crystal_ice = (n, e) => ({
  g: [J(Yn(0.3), 9083560, { y: 0.1, sy: 0.5 })],
  e: [J(ra(0.3), 8444159, { y: 0.6, sy: 1.8, seed: e }), J(ra(0.2), 11069695, { x: 0.25, y: 0.4, sy: 1.6, rz: -0.4 })],
  dim: 0.6,
});


// ════════ [567] ExpressionStatement ExpressionStatement (201 bytes) ════════
Ie.container = (n, e) => {
  let t = [9058858, 2775674, 4876858, 10517034][e % 4];
  return {
    g: [
      J(Je(2.2, 1.1, 0.95), t, { y: 0.55, vary: 0.05 }),
      ...Array.from({ length: 7 }, (i, s) => J(Je(0.04, 1, 0.98), tt(t, 0, 0.25), { x: -0.95 + s * 0.32, y: 0.55 })),
    ],
  };
};


// ════════ [568] ExpressionStatement ExpressionStatement (201 bytes) ════════
Ie.pipe = (n, e) => ({
  g: [
    J(Ye(0.22, 0.22, 2, 8), 6975608, { y: 0.45, rz: Math.PI / 2 }),
    J(Je(0.15, 0.45, 0.4), 4870232, { x: -0.7, y: 0.22 }),
    J(Je(0.15, 0.45, 0.4), 4870232, { x: 0.7, y: 0.22 }),
    J(Ye(0.26, 0.26, 0.08, 8), 11567136, { y: 0.45, rz: Math.PI / 2 }),
  ],
});


// ════════ [569] ExpressionStatement ExpressionStatement (188 bytes) ════════
Ie.generator = (n, e) => ({
  g: [
    J(Je(1, 0.7, 0.7), 5925434, { y: 0.35 }),
    J(Ye(0.08, 0.08, 0.5, 6), 2763306, { y: 0.9, x: 0.3 }),
    J(Je(0.3, 0.3, 0.72), 2763306, { y: 0.4, x: -0.35 }),
  ],
  e: [J(Je(0.15, 0.08, 0.02), 4259680, { y: 0.55, z: 0.36, x: 0.2 })],
});


// ════════ [570] ExpressionStatement ExpressionStatement (167 bytes) ════════
Ie.antenna = (n, e) => ({
  g: [
    J(Ye(0.04, 0.08, 3.2, 5), 9080724, { y: 1.6 }),
    J(Je(0.6, 0.04, 0.04), 9080724, { y: 2.6 }),
    J(Je(0.4, 0.04, 0.04), 9080724, { y: 2.9 }),
  ],
  e: [J(_n(0.07, 5, 4), 16724e3, { y: 3.22 })],
});


// ════════ [571] ExpressionStatement ExpressionStatement (104 bytes) ════════
Ie.radar = (n, e) => ({
  g: [J(Ye(0.15, 0.25, 0.9, 7), 5922920, { y: 0.45 }), J(_n(0.7, 9, 5), 13159632, { y: 1.3, sy: 0.35, rx: 0.6 })],
});


// ════════ [572] ExpressionStatement ExpressionStatement (195 bytes) ════════
Ie.obsidian = (n, e) => ({
  g: [
    J(Wn(0.4, 2, 5), 1709080, { y: 1, jit: 0.15, seed: e, rz: 0.12 }),
    J(Wn(0.28, 1.3, 5), 2366496, { x: 0.35, y: 0.65, rz: -0.25, seed: e + 1, jit: 0.1 }),
  ],
  e: [J(Wn(0.1, 0.6, 4), 16734736, { y: 0.3, x: -0.25, rz: 0.3 })],
  dim: 0.6,
});


// ════════ [573] ExpressionStatement ExpressionStatement (131 bytes) ════════
Ie.rock_lava = (n, e) => ({
  g: [J(Yn(0.55), 2761252, { y: 0.28, sy: 0.65, jit: 0.2, seed: e })],
  e: [J(Yn(0.3), 16738832, { y: 0.1, sy: 0.3, x: 0.3, seed: e })],
  dim: 0.4,
});


// ════════ [574] ExpressionStatement ExpressionStatement (113 bytes) ════════
Ie.vent = (n, e) => ({
  g: [J(Ye(0.35, 0.6, 0.6, 7), 2761252, { y: 0.3, jit: 0.1, seed: e })],
  e: [J(Ye(0.22, 0.22, 0.02, 7), 16740384, { y: 0.61 })],
});


// ════════ [575] ExpressionStatement ExpressionStatement (163 bytes) ════════
Ie.crystal_fire = (n, e) => ({
  g: [J(Yn(0.3), 2761252, { y: 0.1, sy: 0.5 })],
  e: [
    J(ra(0.28), 16747040, { y: 0.55, sy: 1.8, seed: e }),
    J(ra(0.18), 16760896, { x: 0.22, y: 0.35, sy: 1.6, rz: -0.4 }),
  ],
  dim: 0.7,
});


// ════════ [576] ExpressionStatement ExpressionStatement (176 bytes) ════════
Ie.tower = (n, e) => ({
  g: [
    J(Ye(0.06, 0.6, 4.5, 4), 6973008, { y: 2.25 }),
    J(Je(0.9, 0.06, 0.9), 5920324, { y: 3.6 }),
    J(Je(0.06, 4.4, 0.06), 5920324, { y: 2.2, x: 0.3, rz: 0.1 }),
  ],
  e: [J(_n(0.08, 5, 4), 16724e3, { y: 4.55 })],
});


// ════════ [577] ExpressionStatement ExpressionStatement (199 bytes) ════════
Ie.tendril = (n, e) => ({
  g: [
    J(Ye(0.06, 0.2, 1.8, 6), 5909082, { y: 0.9, jit: 0.12, seed: e, rz: 0.25, vary: 0.2 }),
    J(Ye(0.04, 0.14, 1.3, 6), 6959216, { x: 0.3, y: 0.65, rz: -0.35, jit: 0.1, seed: e + 1 }),
  ],
  e: [J(_n(0.09, 5, 4), 16736511, { y: 1.8, x: 0.22 })],
});


// ════════ [578] ExpressionStatement ExpressionStatement (117 bytes) ════════
Ie.pod = (n, e) => ({
  g: [J(_n(0.3, 7, 5), 4856394, { y: 0.15, sy: 0.6 })],
  e: [J(_n(0.38, 8, 6), 12599551, { y: 0.55, sy: 1.25, seed: e })],
  dim: 0.55,
});


// ════════ [579] ExpressionStatement ExpressionStatement (16 bytes) ════════
Ie.pod_s = Ie.pod;


// ════════ [580] ExpressionStatement ExpressionStatement (210 bytes) ════════
Ie.xeno_spire = (n, e) => ({
  g: [
    J(Wn(0.45, 2.6, 6), 3807808, { y: 1.3, jit: 0.15, seed: e, rz: 0.08 }),
    J(Mp(0.4, 0.07, 4, 8), 6957674, { y: 0.8, rx: Math.PI / 2 }),
    J(Mp(0.3, 0.06, 4, 8), 6957674, { y: 1.5, rx: Math.PI / 2 }),
  ],
  e: [J(ra(0.12), 16736511, { y: 2.65 })],
});


// ════════ [581] ExpressionStatement ExpressionStatement (199 bytes) ════════
Ie.crystal = (n, e) => ({
  g: [J(Yn(0.35), 2759216, { y: 0.1, sy: 0.4 })],
  e: [
    J(ra(0.3), 12610559, { y: 0.6, sy: 2, seed: e }),
    J(ra(0.2), 14721279, { x: 0.25, y: 0.4, sy: 1.8, rz: -0.5 }),
    J(ra(0.16), 9453823, { x: -0.2, y: 0.35, sy: 1.6, rz: 0.5 }),
  ],
  dim: 0.7,
});


// ════════ [582] ExpressionStatement ExpressionStatement (165 bytes) ════════
Ie.egg = (n, e) => ({
  g: [
    J(_n(0.32, 8, 6), 6965850, { y: 0.4, sy: 1.3, vary: 0.1, seed: e }),
    J(_n(0.2, 6, 4), 5913162, { x: 0.35, y: 0.22, sy: 1.2 }),
  ],
  e: [J(_n(0.1, 5, 4), 16744640, { y: 0.55, z: 0.25 })],
  dim: 0.6,
});


// ════════ [583] ExpressionStatement ExpressionStatement (173 bytes) ════════
Ie.pillar = (n, e) => ({
  g: [
    J(Je(0.8, 0.3, 0.8), tt(n.rock, 16777215, 0.1), { y: 0.15 }),
    J(Ye(0.28, 0.32, 2.6, 6), n.rock, { y: 1.5, jit: 0.04, seed: e }),
    J(Je(0.75, 0.25, 0.75), tt(n.rock, 16777215, 0.1), { y: 2.9 }),
  ],
});


// ════════ [584] ExpressionStatement ExpressionStatement (220 bytes) ════════
Ie.obelisk = (n, e) => ({
  g: [
    J(Je(0.9, 0.4, 0.9), 2763316, { y: 0.2 }),
    J(Je(0.5, 2.6, 0.5), 3421247, { y: 1.6, sx: 1, sz: 1 }),
    J(Wn(0.36, 0.5, 4), 3421247, { y: 3.15, ry: Math.PI / 4 }),
  ],
  e: [J(Je(0.52, 0.08, 0.52), 6349055, { y: 1.2 }), J(Je(0.52, 0.08, 0.52), 6349055, { y: 2.2 })],
});


// ════════ [585] ExpressionStatement ExpressionStatement (123 bytes) ════════
Ie.tent = (n, e) => ({
  g: [
    J(Wn(1.2, 1.3, 4), 5925442, { y: 0.65, ry: Math.PI / 4, sz: 0.8, vary: 0.05 }),
    J(Je(0.5, 0.7, 0.05), 2763296, { y: 0.35, z: 0.66 }),
  ],
});


// ════════ [586] ExpressionStatement ExpressionStatement (174 bytes) ════════
Ie.sandbags = (n, e) => ({
  g: Array.from({ length: 5 }, (t, i) =>
    J(Ye(0.18, 0.18, 0.55, 6), 10521184, {
      x: (i % 3) * 0.5 - 0.5 + (i >= 3 ? 0.25 : 0),
      y: i >= 3 ? 0.42 : 0.15,
      rz: Math.PI / 2,
      sx: 1,
      sy: 1,
      sz: 0.65,
      vary: 0.1,
      seed: e + i,
    }),
  ),
});


// ════════ [587] ExpressionStatement ExpressionStatement (108 bytes) ════════
Ie.locker = (n, e) => ({
  g: [J(Je(0.7, 1.4, 0.45), 4872794, { y: 0.7, vary: 0.06, seed: e }), J(Je(0.02, 1.3, 0.47), 2767418, { y: 0.7 })],
});


// ════════ [588] ExpressionStatement ExpressionStatement (162 bytes) ════════
Ie.table = (n, e) => ({
  g: [
    J(Je(1, 0.06, 0.6), 6965808, { y: 0.55 }),
    ...[
      [0.45, 0.25],
      [-0.45, 0.25],
      [0.45, -0.25],
      [-0.45, -0.25],
    ].map(([t, i]) => J(Je(0.06, 0.55, 0.06), 4863008, { x: t, z: i, y: 0.27 })),
  ],
});


// ════════ [589] ExpressionStatement ExpressionStatement (97 bytes) ════════
Ie.jar = (n, e) => ({
  g: [J(_n(0.28, 7, 5), 11563082, { y: 0.3, sy: 1.2 }), J(Ye(0.1, 0.12, 0.15, 6), 10510394, { y: 0.65 })],
});


// ════════ [590] ExpressionStatement ExpressionStatement (130 bytes) ════════
Ie.bed = (n, e) => ({
  g: [
    J(Je(0.8, 0.3, 1.6), 5921354, { y: 0.15 }),
    J(Je(0.75, 0.12, 1.5), 9079418, { y: 0.36 }),
    J(Je(0.6, 0.1, 0.3), 13684928, { y: 0.45, z: -0.55 }),
  ],
});


// ════════ [591] ExpressionStatement ExpressionStatement (158 bytes) ════════
Ie.computer = (n, e) => ({
  g: [J(Je(0.9, 0.7, 0.5), 3817028, { y: 0.35 }), J(Je(0.7, 0.45, 0.06), 2764340, { y: 0.95, z: -0.1, rx: -0.1 })],
  e: [J(Je(0.6, 0.36, 0.02), 4251808, { y: 0.95, z: -0.06, rx: -0.1 })],
});


// ════════ [592] ExpressionStatement ExpressionStatement (149 bytes) ════════
Ie.tank_lab = (n, e) => ({
  g: [J(Ye(0.38, 0.38, 0.2, 10), 5922920, { y: 0.1 }), J(Ye(0.38, 0.38, 0.2, 10), 5922920, { y: 1.7 })],
  e: [J(Ye(0.32, 0.32, 1.4, 10), 4259744, { y: 0.9 })],
  dim: 0.35,
});


// ════════ [593] ExpressionStatement ExpressionStatement (20 bytes) ════════
Ie.skull_s = Ie.skull;


// ════════ [594] ExpressionStatement ExpressionStatement (173 bytes) ════════
Ie.grass = (n, e) => ({
  g: Array.from({ length: 4 }, (t, i) =>
    J(Wn(0.04, 0.32, 3), tt(n.grass || 5933626, 12640352, (i % 2) * 0.15), {
      x: Math.cos(i * 1.7) * 0.08,
      z: Math.sin(i * 1.7) * 0.08,
      y: 0.15,
      rz: (i - 1.5) * 0.2,
    }),
  ),
});


// ════════ [595] ExpressionStatement ExpressionStatement (148 bytes) ════════
Ie.dry_grass = (n, e) => ({
  g: Array.from({ length: 4 }, (t, i) =>
    J(Wn(0.035, 0.3, 3), 11047e3, {
      x: Math.cos(i * 1.7) * 0.08,
      z: Math.sin(i * 1.7) * 0.08,
      y: 0.14,
      rz: (i - 1.5) * 0.25,
    }),
  ),
});


// ════════ [596] ExpressionStatement ExpressionStatement (135 bytes) ════════
Ie.flower = (n, e) => ({
  g: [J(Ye(0.01, 0.01, 0.25, 3), 3828266, { y: 0.12 })],
  e: [J(ra(0.06), [16734842, 16766023, 10514687, 16777215][e % 4], { y: 0.27 })],
  dim: 0.2,
});


// ════════ [597] ExpressionStatement ExpressionStatement (125 bytes) ════════
Ie.pebble = (n, e) => ({
  g: [
    J(Yn(0.1), n.rock, { y: 0.03, sy: 0.5, jit: 0.04, seed: e }),
    J(Yn(0.07), tt(n.rock, 16777215, 0.1), { x: 0.15, y: 0.02, sy: 0.5 }),
  ],
});


// ════════ [598] ExpressionStatement ExpressionStatement (111 bytes) ════════
Ie.debris = (n, e) => ({
  g: [
    J(Je(0.25, 0.06, 0.18), 5921368, { y: 0.03, ry: e }),
    J(Je(0.12, 0.05, 0.3), 3815992, { x: 0.2, y: 0.03, ry: e + 1 }),
  ],
});


// ════════ [599] ExpressionStatement ExpressionStatement (64 bytes) ════════
Ie.paper = (n, e) => ({ g: [J(Je(0.2, 0.01, 0.28), 14210248, { y: 0.01, ry: e })] });


// ════════ [600] ExpressionStatement ExpressionStatement (119 bytes) ════════
Ie.reed_small = (n, e) => ({
  g: Array.from({ length: 3 }, (t, i) =>
    J(Ye(0.01, 0.015, 0.5, 3), 8030778, { x: (i - 1) * 0.06, y: 0.25, rz: (i - 1) * 0.15 }),
  ),
});


// ════════ [601] ExpressionStatement ExpressionStatement (140 bytes) ════════
Ie.shroom_small = (n, e) => ({
  g: [J(Ye(0.03, 0.04, 0.18, 4), 14209208, { y: 0.09 })],
  e: [J(_n(0.1, 6, 3), [10305791, 13696832, 4251903][e % 3], { y: 0.2, sy: 0.5 })],
  dim: 0.5,
});


// ════════ [602] ExpressionStatement ExpressionStatement (82 bytes) ════════
Ie.snow_tuft = (n, e) => ({ g: [J(_n(0.18, 6, 3), 16054527, { y: 0.02, sy: 0.35, jit: 0.05, seed: e })] });


// ════════ [603] ExpressionStatement ExpressionStatement (118 bytes) ════════
Ie.bolt = (n, e) => ({
  g: [
    J(Ye(0.04, 0.04, 0.12, 6), 9080724, { y: 0.02, rz: Math.PI / 2 }),
    J(Je(0.3, 0.02, 0.06), 6975090, { x: 0.15, y: 0.01, ry: e }),
  ],
});


// ════════ [604] ExpressionStatement ExpressionStatement (113 bytes) ════════
Ie.ember_rock = (n, e) => ({
  g: [J(Yn(0.12), 1709078, { y: 0.04, sy: 0.6, seed: e })],
  e: [J(Yn(0.05), 16734736, { x: 0.1, y: 0.03 })],
  dim: 0.6,
});


// ════════ [605] ExpressionStatement ExpressionStatement (125 bytes) ════════
Ie.vein = (n, e) => ({
  g: [J(Ye(0.03, 0.03, 0.9, 4), 6957658, { y: 0.02, rz: Math.PI / 2, ry: e })],
  e: [J(_n(0.05, 4, 3), 16728256, { x: 0.3, y: 0.04 })],
  dim: 0.4,
});


// ════════ [606] VariableDeclaration Bx,_p (151 bytes) ════════
var Bx = new Set([
    "grass",
    "dry_grass",
    "flower",
    "pebble",
    "debris",
    "paper",
    "reed_small",
    "shroom_small",
    "snow_tuft",
    "bolt",
    "ember_rock",
    "vein",
  ]),
  _p = new Map();


// 23-propkit.js — Kit de props procedurales (Ie.*) con pintura horneada en vértices y su construcción por chunk.
//
// Frente «props, vegetación y decorado». Todo el carácter va en color de vértice y en el atributo aMat (rugosidad, metal, capa
// superior del bioma): una pieza fusionada (g) + una emisiva HDR (e) por tipo, instanciadas. Los extras (sombra de contacto,
// charco de luz, halo) son UNA malla instanciada por chunk y tipo de acento (src/engine/props.js).

// ════════ [532] VariableDeclaration Qd,Dx,Ox,Nx,Ux,Fx (62 bytes) ════════
var Qd = new Ee(),
  Dx = new at(),
  Ox = new Bn(),
  Nx = new va(),
  Ux = new U(),
  Fx = new U();


// ════════ [533] FunctionDeclaration J (pintura horneada) ════════
// J(geometría, color, opciones): transforma la pieza al espacio del prop, la deforma (jit) y hornea color de vértice + aMat.
//  transformación: x y z rx ry rz sx sy sz s · forma: jit jitY seed · pintura: vary grad[hex,y0,y1] ao aoH sky tg tgPow strata strataF
//  moss[hex,amt] speck shade · material: rough metal tc (capa superior del bioma, 0..1)
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
  // fondos que tocan el suelo y miran abajo: nunca se ven (cámara desde arriba); fuera triángulos
  if (!t.keep) {
    let a = i.attributes.position, nn = i.attributes.normal, keep = [];
    for (let v = 0; v < a.count; v += 3)
      (nn.getY(v) < -0.9 && a.getY(v) < 0.06 && a.getY(v + 1) < 0.06 && a.getY(v + 2) < 0.06) || keep.push(v, v + 1, v + 2);
    if (keep.length < a.count) {
      let pa = new Float32Array(keep.length * 3), na = new Float32Array(keep.length * 3);
      keep.forEach((v, k) => { pa[k * 3] = a.getX(v); pa[k * 3 + 1] = a.getY(v); pa[k * 3 + 2] = a.getZ(v); na[k * 3] = nn.getX(v); na[k * 3 + 1] = nn.getY(v); na[k * 3 + 2] = nn.getZ(v); });
      i.setAttribute("position", new ft(pa, 3));
      i.setAttribute("normal", new ft(na, 3));
    }
  }
  return PkPaint(i, e, t);
}


// ════════ [534] VariableDeclaration eh,Je,Ye,_n,Wn,ko,Yn,Mp,ra,Ie ════════
var eh = (n) => (n.length ? Ld(n, !1) : null),
  Je = (n, e, t) => new kn(n, e, t),
  Ye = (n, e, t, i = 7) => new ni(n, e, t, i),
  _n = (n, e = 7, t = 5) => new rr(n, e, t),
  Wn = (n, e, t = 6) => new oo(n, e, t, 1, !0), // sin tapa: la base no se ve desde arriba
  ko = (n, e = 0) => new ya(n, e),
  Yn = (n) => new lo(n, 0),
  Mp = (n, e, t = 5, i = 10) => new Yi(n, e, t, i),
  ra = (n) => new _a(n, 0),
  // arco de toro (costillas, asas): radio, grosor, ángulo
  PkArc = (n, e, t) => new Yi(n, e, 4, 8, t),
  Ie = {};

// presets de material (rugosidad, metalicidad) para las piezas
var PkMetal = { rough: 0.38, metal: 0.62 },
  PkPaintM = { rough: 0.5, metal: 0.3 },
  PkRubber = { rough: 0.95, metal: 0 },
  PkGlass = { rough: 0.08, metal: 0.7 };


// ═════════════════════════ VEGETACIÓN ═════════════════════════

Ie.pine = (n, e) => {
  let L = n.leaf || 3103274;
  return {
    g: [
      J(Ye(0.1, 0.17, 0.85, 6), 4863012, { y: 0.42, tg: 0.1, ao: 0.6, aoH: 0.7, vary: 0.1, seed: e, rough: 0.92 }),
      J(Wn(0.3, 0.26, 6), 4073502, { y: 0.1, ao: 0.4, rough: 0.92 }),
      J(Wn(0.84, 1.1, 8), tt(L, 0, 0.16), { y: 1.05, vary: 0.14, seed: e, jit: 0.09, tg: 0.5, ao: 0.5, aoH: 1.3, rough: 0.9, speck: 0.12 }),
      J(Wn(0.64, 0.95, 8), tt(L, 0, 0.02), { y: 1.55, vary: 0.14, seed: e + 1, jit: 0.07, tg: 0.45, ao: 0, rough: 0.9 }),
      J(Wn(0.42, 0.82, 7), tt(L, 16777215, 0.12), { y: 2.05, seed: e + 2, jit: 0.05, tg: 0.45, ao: 0, rough: 0.9 }),
    ],
  };
};

Ie.pine_snow = (n, e) => ({
  g: [
    J(Ye(0.1, 0.17, 0.85, 6), 4863012, { y: 0.42, tg: 0.1, ao: 0.6, aoH: 0.7, rough: 0.92 }),
    J(Wn(0.84, 1.1, 8), 2771514, { y: 1.05, jit: 0.09, seed: e, tg: 0.4, ao: 0.5, aoH: 1.3, vary: 0.1, rough: 0.9 }),
    J(Wn(0.7, 0.5, 8), 15857151, { y: 1.38, jit: 0.05, seed: e + 3, tg: 0.2, ao: 0, rough: 0.95 }),
    J(Wn(0.58, 0.95, 8), 3035198, { y: 1.62, jit: 0.07, seed: e + 1, tg: 0.4, ao: 0, vary: 0.1, rough: 0.9 }),
    J(Wn(0.5, 0.42, 7), 15988991, { y: 1.9, jit: 0.04, seed: e + 4, tg: 0.2, ao: 0, rough: 0.95 }),
    J(Wn(0.38, 0.78, 7), 16316671, { y: 2.08, seed: e + 2, jit: 0.04, tg: 0.3, ao: 0, rough: 0.95 }),
  ],
});

Ie.oak = (n, e) => {
  let L = n.leaf2 || 4880946;
  return {
    g: [
      J(Ye(0.12, 0.2, 0.95, 6), 5914672, { y: 0.47, tg: 0.1, ao: 0.6, aoH: 0.8, vary: 0.1, seed: e, rough: 0.92 }),
      J(Wn(0.3, 0.3, 6), 4863012, { y: 0.12, ao: 0.4, rough: 0.92 }),
      J(ko(0.78, 0), tt(L, 0, 0.14), { y: 1.5, jit: 0.25, seed: e, vary: 0.2, tg: 0.5, ao: 0, aoH: 1, sky: 0.34, rough: 0.9, speck: 0.12 }),
      J(ko(0.52, 0), tt(L, 16777088, 0.14), { x: 0.4, y: 1.8, z: 0.22, jit: 0.15, seed: e + 1, tg: 0.4, ao: 0, sky: 0.3, rough: 0.9 }),
      J(ko(0.46, 0), tt(L, 0, 0.1), { x: -0.38, y: 1.32, z: -0.2, jit: 0.15, seed: e + 2, tg: 0.4, ao: 0, sky: 0.3, rough: 0.9 }),
    ],
  };
};

Ie.bush = (n, e) => {
  let L = n.leaf2 || 4880946;
  return {
    g: [
      J(ko(0.44, 0), tt(L, 0, 0.1), { y: 0.3, sy: 0.7, jit: 0.15, seed: e, vary: 0.2, tg: 0.5, ao: 0.5, aoH: 0.4, sky: 0.3, rough: 0.9 }),
      J(ko(0.3, 0), tt(L, 16777215, 0.14), { x: 0.28, y: 0.34, jit: 0.1, seed: e + 1, tg: 0.4, ao: 0.3, aoH: 0.3, sky: 0.3, rough: 0.9 }),
    ],
  };
};

Ie.dead_tree = (n, e) => ({
  g: [
    J(Ye(0.06, 0.15, 1.8, 5), 4864560, { y: 0.9, jit: 0.05, seed: e, grad: [9079400, 0.4, 1.8], tg: 0.12, ao: 0.6, aoH: 0.7, rough: 0.95, speck: 0.2 }),
    J(Wn(0.3, 0.3, 5), 3815992, { y: 0.1, ao: 0.4, rough: 0.95 }),
    J(Ye(0.025, 0.06, 0.85, 4), 5256528, { x: 0.28, y: 1.4, rz: -0.85, ao: 0.1, grad: [10132336, 1.0, 1.9], rough: 0.95 }),
    J(Ye(0.025, 0.05, 0.75, 4), 5256528, { x: -0.22, y: 1.2, rz: 0.95, ao: 0.1, grad: [10132336, 0.8, 1.7], rough: 0.95 }),
    J(Ye(0.02, 0.04, 0.55, 4), 5256528, { z: 0.16, y: 1.78, rx: 0.7, ao: 0, grad: [11184800, 1.5, 2.2], rough: 0.95 }),
    J(Ye(0.015, 0.03, 0.4, 3), 5256528, { x: 0.45, y: 1.68, rz: -1.2, ao: 0, rough: 0.95 }),
  ],
});

Ie.swamp_tree = (n, e) => ({
  g: [
    J(Ye(0.11, 0.3, 1.6, 6), 3815978, { y: 0.8, jit: 0.08, seed: e, tg: 0.12, ao: 0.65, aoH: 1, rough: 0.95, speck: 0.2 }),
    J(Wn(0.4, 0.36, 5), 3355440, { y: 0.1, x: 0.18, ao: 0.4, rough: 0.95 }),
    J(Wn(0.34, 0.3, 5), 3355440, { y: 0.08, x: -0.2, z: 0.1, ao: 0.4, rough: 0.95 }),
    J(ko(0.62, 0), 4872746, { y: 1.8, sy: 0.6, jit: 0.25, seed: e, vary: 0.25, tg: 0.45, ao: 0, sky: 0.34, rough: 0.9 }),
    J(ko(0.38, 0), 5529682, { x: 0.4, y: 1.95, jit: 0.15, seed: e + 1, tg: 0.35, ao: 0, rough: 0.9 }),
    // musgo colgante: tiras finas bajo la copa
    ...[
      [0.42, 1.5, 0.1],
      [-0.4, 1.55, -0.2],
      [0.05, 1.45, 0.42],
      [-0.2, 1.5, 0.3],
    ].map(([a, b, c]) => J(Wn(0.035, 0.65, 3), 7046512, { x: a, y: b - 0.2, z: c, rx: Math.PI, ao: 0, tg: 0.5, rough: 0.95 })),
  ],
});

Ie.mushroom = (n, e) => ({
  g: [
    J(Ye(0.12, 0.2, 1, 6), 14209208, { y: 0.5, tg: 0.1, ao: 0.5, aoH: 0.6, rough: 0.8 }),
    J(Ye(0.05, 0.07, 0.3, 5), 13419462, { x: 0.4, y: 0.15, ao: 0.4, rough: 0.8 }),
  ],
  e: [
    J(_n(0.58, 9, 4), 10305791, { y: 1.05, sy: 0.45, seed: e, tg: 0.5, ao: 0 }),
    J(_n(0.09, 4, 3), 14610160, { y: 1.3, x: 0.26, ao: 0 }),
    J(_n(0.07, 4, 3), 14610160, { y: 1.27, x: -0.2, z: 0.22, ao: 0 }),
    J(_n(0.2, 6, 3), 8421631, { x: 0.4, y: 0.34, sy: 0.5, ao: 0 }),
  ],
  dim: 0.62,
});

Ie.reeds = (n, e) => ({
  g: [
    ...Array.from({ length: 7 }, (t, i) =>
      J(Ye(0.012, 0.028, 0.85 + (i % 3) * 0.18, 3), tt(6978106, 10526880, (i % 3) * 0.2), {
        x: Math.cos(i * 1.1) * 0.22,
        z: Math.sin(i * 1.1) * 0.22,
        y: 0.44 + (i % 3) * 0.09,
        rz: (i - 3) * 0.06,
        rx: Math.sin(i) * 0.08,
        tg: 0.55,
        ao: 0.5,
        aoH: 0.4,
        rough: 0.85,
      }),
    ),
    // espigas pardas
    J(Ye(0.032, 0.032, 0.2, 5), 6959392, { x: 0.22, y: 1.08, rz: -0.03, ao: 0, rough: 0.9 }),
    J(Ye(0.03, 0.03, 0.18, 5), 6959392, { x: -0.2, z: 0.1, y: 1.0, rz: 0.1, ao: 0, rough: 0.9 }),
  ],
});

Ie.cactus = (n, e) => {
  let C = 4880954;
  return {
    g: [
      J(Ye(0.16, 0.19, 1.3, 6), C, { y: 0.65, vary: 0.1, seed: e, tg: 0.3, ao: 0.55, aoH: 0.6, rough: 0.85, speck: 0.15 }),
      J(_n(0.16, 6, 3), tt(C, 16777215, 0.1), { y: 1.3, sy: 0.55, ao: 0, rough: 0.85 }),
      J(Ye(0.1, 0.1, 0.5, 5), C, { x: 0.25, y: 0.8, rz: -Math.PI / 2, tg: 0.1, ao: 0.2, rough: 0.85 }),
      J(Ye(0.1, 0.1, 0.45, 5), tt(C, 16777215, 0.06), { x: 0.4, y: 1.02, tg: 0.3, ao: 0.1, rough: 0.85 }),
      J(Ye(0.09, 0.09, 0.3, 5), C, { x: -0.22, y: 0.55, rz: Math.PI / 2, ao: 0.2, rough: 0.85 }),
      J(Ye(0.09, 0.09, 0.35, 5), tt(C, 16777215, 0.06), { x: -0.34, y: 0.74, tg: 0.3, ao: 0.1, rough: 0.85 }),
      // flor rosada en la cima
      J(_n(0.07, 4, 3), 16734842, { y: 1.42, x: 0.04, ao: 0, rough: 0.7 }),
    ],
  };
};

Ie.grass = (n, e) => ({
  g: Array.from({ length: 6 }, (t, i) =>
    J(Wn(0.045, 0.34 + (i % 3) * 0.06, 3), tt(n.grass || 5933626, 12640352, (i % 2) * 0.15), {
      x: Math.cos(i * 1.7) * 0.09,
      z: Math.sin(i * 1.7) * 0.09,
      y: 0.16 + (i % 3) * 0.03,
      rz: (i - 2.5) * 0.18,
      tg: 0.65,
      ao: 0.6,
      aoH: 0.22,
      sky: 0.1,
      rough: 0.85,
    }),
  ),
});

Ie.dry_grass = (n, e) => ({
  g: Array.from({ length: 6 }, (t, i) =>
    J(Wn(0.04, 0.32 + (i % 3) * 0.06, 3), tt(11047e3, 14802072, (i % 2) * 0.3), {
      x: Math.cos(i * 1.7) * 0.09,
      z: Math.sin(i * 1.7) * 0.09,
      y: 0.15 + (i % 3) * 0.03,
      rz: (i - 2.5) * 0.22,
      tg: 0.6,
      ao: 0.55,
      aoH: 0.22,
      sky: 0.1,
      rough: 0.9,
    }),
  ),
});

Ie.flower = (n, e) => ({
  g: [
    J(Ye(0.01, 0.014, 0.27, 3), 3828266, { y: 0.13, ao: 0.5, aoH: 0.2, tg: 0.3, rough: 0.8 }),
    J(Wn(0.07, 0.12, 3), 4880954, { x: 0.05, y: 0.08, rz: -1.1, ao: 0.4, rough: 0.8 }),
  ],
  e: [J(ra(0.065), [16734842, 16766023, 10514687, 16777215][e % 4], { y: 0.29, sy: 0.8, ao: 0 })],
  dim: 0.38,
  pulse: 0,
});

Ie.reed_small = (n, e) => ({
  g: Array.from({ length: 4 }, (t, i) =>
    J(Wn(0.022, 0.55, 3), tt(8030778, 11193440, 0.2), { x: (i - 1.5) * 0.06, y: 0.27, rz: (i - 1.5) * 0.14, tg: 0.5, ao: 0.5, aoH: 0.25, rough: 0.85 }),
  ),
});

Ie.shroom_small = (n, e) => ({
  g: [J(Ye(0.03, 0.045, 0.18, 4), 14209208, { y: 0.09, ao: 0.4, rough: 0.8 })],
  e: [J(_n(0.11, 6, 3), [10305791, 13696832, 4251903][e % 3], { y: 0.2, sy: 0.5, tg: 0.5, ao: 0 })],
  dim: 0.45,
});

Ie.snow_tuft = (n, e) => ({
  g: [
    J(_n(0.19, 6, 3), 16054527, { y: 0.02, sy: 0.35, jit: 0.05, seed: e, tg: 0.3, ao: 0.3, aoH: 0.08, rough: 0.9 }),
  ],
});


// ═════════════════════════ ROCAS Y TERRENO ═════════════════════════
// Estratos horneados + peso de capa superior (tc): el bioma pone musgo, arena, nieve o ceniza en las caras que miran arriba.

Ie.rock = (n, e) => ({
  g: [
    J(Yn(0.46), n.rock, { y: 0.22, sy: 0.66, jit: 0.2, seed: e, vary: 0.14, strata: 0.16, strataF: 14, tc: 1, ao: 0.55, aoH: 0.28, tg: 0.24, rough: 0.95, speck: 0.12 }),
  ],
});

Ie.rock_big = (n, e) => ({
  g: [
    J(Yn(0.8), n.rock, { y: 0.4, sy: 0.75, jit: 0.3, seed: e, vary: 0.12, strata: 0.18, strataF: 9, tc: 1, ao: 0.6, aoH: 0.5, tg: 0.26, rough: 0.95, speck: 0.14 }),
    J(Yn(0.46), tt(n.rock, 16777215, 0.08), { x: 0.52, y: 0.25, z: 0.3, jit: 0.15, seed: e + 1, strata: 0.14, strataF: 13, tc: 1, ao: 0.5, aoH: 0.3, rough: 0.95 }),
  ],
});

Ie.cliffrock = (n, e) => ({
  g: [
    J(Yn(0.75), n.rock, { y: 0.4, sy: 1.3, jit: 0.35, seed: 3, vary: 0.15, strata: 0.2, strataF: 7, tc: 1, ao: 0.6, aoH: 0.6, tg: 0.3, rough: 0.96, speck: 0.12 }),
    J(Yn(0.45), tt(n.rock, 16777215, 0.1), { x: 0.4, y: 0.2, jit: 0.2, seed: 4, strata: 0.15, strataF: 11, tc: 1, ao: 0.5, aoH: 0.3, rough: 0.96 }),
  ],
});

Ie.rock_desert = (n, e) => ({
  g: [
    J(Je(0.9, 0.7, 0.8), 11567194, { y: 0.35, jit: 0.25, seed: e, vary: 0.1, grad: [14198904, 0, 0.75], strata: 0.22, strataF: 22, tc: 1, ao: 0.55, aoH: 0.4, rough: 0.95, speck: 0.1 }),
    J(Je(0.6, 0.35, 0.6), 13144160, { y: 0.88, x: 0.1, jit: 0.15, seed: e + 1, strata: 0.2, strataF: 26, tc: 1, ao: 0.3, aoH: 0.2, rough: 0.95 }),
  ],
});

Ie.mesa = (n, e) => ({
  g: [
    J(Ye(1.08, 1.22, 0.7, 7), 9070634, { y: 0.35, jit: 0.16, seed: e, tg: 0.2, ao: 0.6, aoH: 0.5, strata: 0.1, strataF: 30, rough: 0.96 }),
    J(Ye(0.98, 1.08, 0.55, 7), 12426344, { y: 0.97, jit: 0.14, seed: e + 1, tg: 0.2, ao: 0.2, aoH: 1.1, strata: 0.12, strataF: 30, rough: 0.96 }),
    J(Ye(0.92, 0.98, 0.5, 7), 13601658, { y: 1.5, jit: 0.12, seed: e + 2, tg: 0.2, ao: 0, strata: 0.1, strataF: 30, rough: 0.96 }),
    J(Ye(0.9, 0.9, 0.1, 7), 14854300, { y: 1.8, jit: 0.1, seed: e + 3, tc: 1, ao: 0, rough: 0.96 }),
  ],
});

Ie.boulder_snow = (n, e) => ({
  g: [
    J(Yn(0.62), 8030872, { y: 0.3, sy: 0.7, jit: 0.2, seed: e, vary: 0.1, strata: 0.14, strataF: 12, tg: 0.2, ao: 0.55, aoH: 0.3, rough: 0.95 }),
    J(Yn(0.52), 16054527, { y: 0.52, sy: 0.34, jit: 0.15, seed: e + 1, tg: 0.2, ao: 0, rough: 0.92 }),
  ],
});

Ie.pebble = (n, e) => ({
  g: [
    J(Yn(0.1), n.rock, { y: 0.03, sy: 0.5, jit: 0.04, seed: e, ao: 0.5, aoH: 0.06, rough: 0.95 }),
    J(Yn(0.07), tt(n.rock, 16777215, 0.1), { x: 0.15, y: 0.02, sy: 0.5, ao: 0.4, aoH: 0.05, rough: 0.95 }),
    J(Yn(0.05), tt(n.rock, 0, 0.12), { x: -0.1, z: 0.12, y: 0.015, sy: 0.5, ao: 0.4, aoH: 0.04, rough: 0.95 }),
  ],
});

Ie.log = (n, e) => ({
  g: [
    J(Ye(0.17, 0.17, 1.4, 6), 5914672, { y: 0.17, rz: Math.PI / 2, vary: 0.1, seed: e, grad: [4208672, 0.17, 0.35], tg: 0.2, ao: 0.5, aoH: 0.2, rough: 0.95, speck: 0.15 }),
    J(Ye(0.145, 0.145, 0.02, 6), 12623744, { x: 0.71, y: 0.17, rz: Math.PI / 2, ao: 0, rough: 0.8 }),
    J(Ye(0.07, 0.07, 0.025, 5), 10518864, { x: 0.715, y: 0.17, rz: Math.PI / 2, ao: 0, rough: 0.8 }),
    J(Ye(0.05, 0.06, 0.2, 5), 5914672, { x: -0.2, y: 0.3, z: 0.1, rx: 0.9, ao: 0.3, rough: 0.95 }),
    J(_n(0.09, 5, 3), 12098634, { x: 0.1, y: 0.33, z: 0.08, sy: 0.4, sx: 1.4, ao: 0, rough: 0.85 }),
  ],
});

Ie.stump = (n, e) => ({
  g: [
    J(Ye(0.22, 0.3, 0.4, 6), 5914672, { y: 0.2, tg: 0.15, ao: 0.6, aoH: 0.3, rough: 0.95, speck: 0.15 }),
    ...[0, 2.1, 4.2].map((a) => J(Wn(0.12, 0.3, 4), 4863012, { x: Math.cos(a) * 0.27, z: Math.sin(a) * 0.27, y: 0.06, rz: Math.cos(a) * 0.7, rx: -Math.sin(a) * 0.7, ao: 0.4, rough: 0.95 })),
    J(Ye(0.22, 0.22, 0.02, 6), 12623744, { y: 0.41, ao: 0, rough: 0.8 }),
    J(Ye(0.1, 0.1, 0.025, 5), 10518864, { y: 0.415, ao: 0, rough: 0.8 }),
  ],
});

Ie.bones = (n, e) => ({
  g: [
    J(Ye(0.04, 0.045, 0.8, 5), 15261896, { y: 0.05, rz: Math.PI / 2, ry: 0.4, tg: 0.1, ao: 0.4, aoH: 0.08, rough: 0.8 }),
    J(Ye(0.04, 0.04, 0.6, 5), 14472120, { y: 0.05, rz: Math.PI / 2, ry: -0.6, z: 0.2, ao: 0.4, aoH: 0.08, rough: 0.8 }),
    J(_n(0.14, 6, 4), 15261896, { x: 0.35, y: 0.1, ao: 0.4, aoH: 0.12, rough: 0.8 }),
    J(PkArc(0.2, 0.025, Math.PI), 14735552, { x: -0.1, z: -0.2, y: 0.02, ry: 0.5, ao: 0.4, aoH: 0.1, rough: 0.8 }),
    J(PkArc(0.17, 0.022, Math.PI), 14735552, { x: -0.25, z: -0.15, y: 0.02, ry: 0.5, ao: 0.4, aoH: 0.1, rough: 0.8 }),
  ],
});

Ie.skull = (n, e) => ({
  g: [
    J(_n(0.5, 8, 5), 14735552, { y: 0.4, sy: 0.8, tg: 0.2, ao: 0.5, aoH: 0.3, rough: 0.8, speck: 0.12 }),
    J(Je(0.5, 0.25, 0.4), 13682864, { y: 0.12, z: 0.25, ao: 0.5, aoH: 0.2, rough: 0.8 }),
    J(_n(0.13, 5, 4), 1710618, { y: 0.45, z: 0.4, x: 0.17, ao: 0, rough: 0.9 }),
    J(_n(0.13, 5, 4), 1710618, { y: 0.45, z: 0.4, x: -0.17, ao: 0, rough: 0.9 }),
    J(Wn(0.06, 0.12, 3), 1710618, { y: 0.34, z: 0.46, rx: Math.PI, ao: 0, rough: 0.9 }),
  ],
});
Ie.skull_s = Ie.skull;

Ie.rubble = (n, e) => ({
  g: [
    J(Je(0.7, 0.35, 0.6), n.wall || 8025194, { y: 0.17, ry: 0.4, jit: 0.15, seed: e, tg: 0.2, ao: 0.55, aoH: 0.25, speck: 0.2, rough: 0.95 }),
    J(Je(0.5, 0.25, 0.4), tt(n.wall || 8025194, 0, 0.2), { x: 0.4, y: 0.12, z: 0.2, ry: 1.2, jit: 0.1, seed: e + 1, ao: 0.5, aoH: 0.2, speck: 0.2, rough: 0.95 }),
    J(Je(0.3, 0.45, 0.28), tt(n.wall || 8025194, 16777215, 0.1), { x: -0.36, y: 0.22, z: -0.1, ry: -0.5, rz: 0.12, jit: 0.1, seed: e + 2, ao: 0.5, aoH: 0.3, speck: 0.2, rough: 0.95 }),
    // armadura vista: varillas oxidadas
    J(Ye(0.018, 0.018, 0.75, 4), 8014384, { x: -0.3, y: 0.55, z: 0.1, rz: 0.5, ao: 0, ...PkMetal, rough: 0.7 }),
    J(Ye(0.018, 0.018, 0.55, 4), 8014384, { x: 0.1, y: 0.45, z: -0.2, rz: -0.7, rx: 0.3, ao: 0, ...PkMetal, rough: 0.7 }),
  ],
});
Ie.rubble_s = (n, e) => ({
  g: [
    J(Je(0.5, 0.25, 0.5), n.wall || 8025194, { y: 0.12, ry: 0.4, jit: 0.15, seed: e, tg: 0.2, ao: 0.55, aoH: 0.18, speck: 0.2, rough: 0.95 }),
    J(Je(0.25, 0.16, 0.22), tt(n.wall || 8025194, 0, 0.18), { x: 0.3, y: 0.08, z: 0.15, ry: 0.9, jit: 0.06, seed: e + 1, ao: 0.5, aoH: 0.12, rough: 0.95 }),
  ],
});


// ═════════════════════════ URBANO E INDUSTRIAL ═════════════════════════

Ie.car = (n, e) => {
  let t = [8010282, 3820122, 5921354, 6974058][e % 4],
    P = PkPaintM;
  return {
    g: [
      J(Je(1.75, 0.42, 0.88), t, { y: 0.36, vary: 0.05, seed: e, tg: 0.22, ao: 0.5, aoH: 0.3, speck: 0.2, ...P }),
      J(Je(0.98, 0.34, 0.8), tt(t, 16777215, 0.08), { y: 0.74, x: -0.1, tg: 0.2, ao: 0, speck: 0.15, ...P }),
      // cristales: oscuros y especulares
      J(Je(0.72, 0.26, 0.82), 1456168, { y: 0.76, x: -0.12, sx: 1.02, sz: 0.98, ao: 0, ...PkGlass }),
      J(Je(1.78, 0.06, 0.9), 2763306, { y: 0.17, ao: 0.3, rough: 0.8, metal: 0.2 }),
      ...[[0.56, 0.45], [-0.56, 0.45], [0.56, -0.45], [-0.56, -0.45]].flatMap(([i, s]) => [
        J(Ye(0.19, 0.19, 0.14, 7), 1710618, { x: i, z: s, y: 0.19, rx: Math.PI / 2, ao: 0.2, ...PkRubber }),
        J(Ye(0.09, 0.09, 0.16, 4), 11184810, { x: i, z: s * 1.02, y: 0.19, rx: Math.PI / 2, ao: 0, ...PkMetal }),
      ]),
    ],
    e: [
      J(Je(0.03, 0.08, 0.2), 16774608, { x: 0.88, y: 0.38, z: 0.28, ao: 0 }),
      J(Je(0.03, 0.08, 0.2), 16774608, { x: 0.88, y: 0.38, z: -0.28, ao: 0 }),
      J(Je(0.03, 0.07, 0.18), 16720416, { x: -0.88, y: 0.4, z: 0.28, ao: 0 }),
      J(Je(0.03, 0.07, 0.18), 16720416, { x: -0.88, y: 0.4, z: -0.28, ao: 0 }),
    ],
    dim: 0.55,
    pulse: 0,
  };
};

Ie.tank_wreck = (n, e) => ({
  g: [
    J(Je(2.2, 0.6, 1.3), 4868666, { y: 0.4, jit: 0.05, seed: e, tg: 0.2, ao: 0.5, aoH: 0.4, speck: 0.3, ...PkPaintM }),
    J(Je(1.1, 0.45, 0.9), 5921352, { y: 0.9, ry: 0.3, tg: 0.2, ao: 0.2, aoH: 0.4, speck: 0.25, ...PkPaintM }),
    J(Ye(0.07, 0.07, 1.4, 6), 3815984, { y: 0.95, x: 0.8, rz: Math.PI / 2 - 0.2, ry: 0.3, ao: 0, ...PkMetal }),
    J(Je(2.3, 0.35, 0.3), 2763300, { y: 0.2, z: 0.6, ao: 0.4, aoH: 0.3, ...PkRubber }),
    J(Je(2.3, 0.35, 0.3), 2763300, { y: 0.2, z: -0.6, ao: 0.4, aoH: 0.3, ...PkRubber }),
    J(Ye(0.3, 0.3, 0.08, 7), 4864560, { y: 1.15, x: -0.05, ry: 0.3, ao: 0, ...PkMetal }),
  ],
});

Ie.lamp = (n, e) => ({
  g: [
    J(Ye(0.13, 0.16, 0.14, 6), 2763312, { y: 0.07, ao: 0.4, aoH: 0.1, ...PkMetal }),
    J(Ye(0.045, 0.075, 2.4, 6), 3817028, { y: 1.2, tg: 0.2, ao: 0.4, aoH: 0.4, ...PkMetal }),
    J(Ye(0.06, 0.06, 0.1, 6), 5921370, { y: 0.55, ao: 0, ...PkMetal }),
    J(Je(0.55, 0.06, 0.12), 3817028, { y: 2.38, x: 0.25, ao: 0, ...PkMetal }),
    // pantalla de la luminaria
    J(Je(0.34, 0.08, 0.2), 2763312, { y: 2.43, x: 0.46, ao: 0, ...PkMetal }),
  ],
  e: [J(Je(0.26, 0.05, 0.15), 16769184, { y: 2.33, x: 0.46, ao: 0, tg: 0 })],
  dim: 1.25,
  pulse: 0.03,
});

Ie.hydrant = (n, e) => ({
  g: [
    J(Ye(0.13, 0.16, 0.12, 8), 8398880, { y: 0.06, ao: 0.4, aoH: 0.1, ...PkPaintM }),
    J(Ye(0.12, 0.14, 0.45, 8), 11546656, { y: 0.32, tg: 0.2, ao: 0.4, aoH: 0.3, speck: 0.15, ...PkPaintM }),
    J(_n(0.135, 8, 4), 12598816, { y: 0.56, sy: 0.9, ao: 0, ...PkPaintM }),
    J(Ye(0.05, 0.05, 0.38, 6), 12696408, { y: 0.4, rz: Math.PI / 2, ao: 0, ...PkMetal }),
    J(Ye(0.06, 0.06, 0.06, 4), 14395240, { y: 0.4, x: 0.2, rz: Math.PI / 2, ao: 0, ...PkMetal }),
    J(Ye(0.06, 0.06, 0.06, 4), 14395240, { y: 0.4, x: -0.2, rz: Math.PI / 2, ao: 0, ...PkMetal }),
    J(Ye(0.04, 0.04, 0.05, 6), 14395240, { y: 0.69, ao: 0, ...PkMetal }),
  ],
});

Ie.tire = (n, e) => ({
  g: [
    J(Mp(0.25, 0.1, 4, 9), 1973790, { y: 0.1, rx: Math.PI / 2, ao: 0.4, aoH: 0.1, ...PkRubber }),
    J(Mp(0.2, 0.08, 4, 8), 2565934, { y: 0.28, x: 0.04, rx: Math.PI / 2 - 0.1, ao: 0.4, aoH: 0.1, ...PkRubber }),
  ],
});

Ie.barrel = (n, e) => {
  let c = [9058858, 3824250, 5925434][e % 3];
  return {
    g: [
      J(Ye(0.24, 0.24, 0.68, 8), c, { y: 0.34, vary: 0.06, seed: e, tg: 0.18, ao: 0.5, aoH: 0.25, speck: 0.28, ...PkPaintM }),
      J(Ye(0.255, 0.255, 0.04, 8), 2763306, { y: 0.2, ao: 0.4, aoH: 0.3, ...PkMetal }),
      J(Ye(0.255, 0.255, 0.04, 8), 2763306, { y: 0.5, ao: 0, ...PkMetal }),
      J(Ye(0.22, 0.22, 0.03, 8), 4605510, { y: 0.69, ao: 0, ...PkMetal }),
      J(Ye(0.045, 0.045, 0.04, 6), 1710618, { y: 0.715, x: 0.1, z: 0.05, ao: 0, ...PkMetal }),
    ],
  };
};

Ie.barrel_toxic = (n, e) => ({
  g: [
    J(Ye(0.24, 0.24, 0.68, 8), 13148192, { y: 0.34, vary: 0.05, seed: e, tg: 0.16, ao: 0.5, aoH: 0.25, speck: 0.3, ...PkPaintM }),
    J(Ye(0.255, 0.255, 0.05, 10), 2763306, { y: 0.5, ao: 0, ...PkMetal }),
    J(Ye(0.255, 0.255, 0.05, 10), 2763306, { y: 0.2, ao: 0.4, aoH: 0.3, ...PkMetal }),
    J(Ye(0.248, 0.248, 0.09, 8), 1974800, { y: 0.35, ao: 0, ...PkPaintM }),
  ],
  e: [J(Ye(0.19, 0.19, 0.03, 10), 10354506, { y: 0.7, ao: 0, tg: 0 }), J(_n(0.07, 5, 3), 12582730, { y: 0.72, x: 0.05, sy: 0.4, ao: 0 })],
  dim: 0.95,
  pulse: 0.1,
});

Ie.barrel_rad = (n, e) => ({
  g: [
    J(Ye(0.24, 0.24, 0.68, 8), 3815984, { y: 0.34, rz: e % 2 ? 0.2 : 0, tg: 0.16, ao: 0.5, aoH: 0.25, speck: 0.25, ...PkPaintM }),
    J(Ye(0.255, 0.255, 0.04, 8), 2368552, { y: 0.66, rz: e % 2 ? 0.2 : 0, ao: 0, ...PkMetal }),
  ],
  e: [
    J(Ye(0.248, 0.248, 0.12, 10), 13172512, { y: 0.34, rz: e % 2 ? 0.2 : 0, ao: 0, tg: 0 }),
    J(_n(0.25, 8, 3), 10354464, { y: 0.03, sy: 0.15, sx: 1.6, sz: 1.3, ao: 0 }),
  ],
  dim: 0.9,
  pulse: 0.1,
});

Ie.crate = (n, e) => ({
  g: [
    J(Je(0.75, 0.75, 0.75), 8018488, { y: 0.375, vary: 0.1, seed: e, tg: 0.16, ao: 0.5, aoH: 0.3, speck: 0.2, rough: 0.85 }),
    J(Je(0.78, 0.08, 0.78), 5914664, { y: 0.72, ao: 0, rough: 0.85 }),
    J(Je(0.78, 0.08, 0.78), 5914664, { y: 0.04, ao: 0.3, aoH: 0.1, rough: 0.85 }),
    J(Je(0.08, 0.75, 0.78), 5914664, { y: 0.375, x: 0.34, ao: 0.2, aoH: 0.3, rough: 0.85 }),
    J(Je(0.08, 0.75, 0.78), 5914664, { y: 0.375, x: -0.34, ao: 0.2, aoH: 0.3, rough: 0.85 }),
  ],
});

Ie.crates = (n, e) => ({
  g: [
    J(Je(0.75, 0.75, 0.75), 6969914, { y: 0.375, x: -0.2, vary: 0.1, seed: e, tg: 0.16, ao: 0.5, aoH: 0.3, speck: 0.2, rough: 0.85 }),
    J(Je(0.6, 0.6, 0.6), 5925434, { y: 0.3, x: 0.45, z: 0.3, ry: 0.3, tg: 0.16, ao: 0.5, aoH: 0.3, speck: 0.2, rough: 0.85 }),
    J(Je(0.55, 0.55, 0.55), 8018488, { y: 1.02, x: -0.2, ry: 0.2, tg: 0.16, ao: 0, speck: 0.2, rough: 0.85 }),
  ],
});

Ie.container = (n, e) => {
  let t = [9058858, 2775674, 4876858, 10517034][e % 4];
  return {
    g: [
      J(Je(2.2, 1.1, 0.95), t, { y: 0.55, vary: 0.04, seed: e, tg: 0.2, ao: 0.55, aoH: 0.4, speck: 0.35, ...PkPaintM }),
      ...Array.from({ length: 5 }, (i, s) => J(Je(0.04, 1, 0.98), tt(t, 0, 0.25), { x: -0.9 + s * 0.45, y: 0.55, ao: 0.3, aoH: 0.3, ...PkPaintM })),
      // marco superior/inferior y esquineros
      J(Je(2.24, 0.06, 1.0), tt(t, 0, 0.4), { y: 1.1, ao: 0, ...PkMetal }),
      J(Je(2.24, 0.06, 1.0), tt(t, 0, 0.4), { y: 0.03, ao: 0.4, aoH: 0.1, ...PkMetal }),
      ...[[1.09, 0.47], [-1.09, 0.47], [1.09, -0.47], [-1.09, -0.47]].map(([a, b]) => J(Je(0.08, 1.12, 0.08), tt(t, 0, 0.45), { x: a, z: b, y: 0.56, ao: 0.2, aoH: 0.4, ...PkMetal })),
      // barras de la puerta
      J(Ye(0.015, 0.015, 0.9, 5), 11184810, { x: 1.115, y: 0.55, z: 0.1, ao: 0, ...PkMetal }),
      J(Ye(0.015, 0.015, 0.9, 5), 11184810, { x: 1.115, y: 0.55, z: -0.1, ao: 0, ...PkMetal }),
    ],
  };
};

Ie.pipe = (n, e) => ({
  g: [
    J(Ye(0.22, 0.22, 2, 10), 6975608, { y: 0.45, rz: Math.PI / 2, tg: 0.2, ao: 0.4, aoH: 0.2, speck: 0.3, ...PkMetal }),
    J(Je(0.15, 0.45, 0.4), 4870232, { x: -0.7, y: 0.22, ao: 0.5, aoH: 0.3, ...PkPaintM }),
    J(Je(0.15, 0.45, 0.4), 4870232, { x: 0.7, y: 0.22, ao: 0.5, aoH: 0.3, ...PkPaintM }),
    J(Ye(0.26, 0.26, 0.08, 10), 11567136, { y: 0.45, rz: Math.PI / 2, ao: 0, ...PkMetal }),
    J(Ye(0.26, 0.26, 0.08, 10), 11567136, { x: 0.6, y: 0.45, rz: Math.PI / 2, ao: 0, ...PkMetal }),
    J(Ye(0.26, 0.26, 0.08, 10), 11567136, { x: -0.6, y: 0.45, rz: Math.PI / 2, ao: 0, ...PkMetal }),
  ],
});

Ie.generator = (n, e) => ({
  g: [
    J(Je(1, 0.7, 0.7), 5925434, { y: 0.35, tg: 0.2, ao: 0.5, aoH: 0.3, speck: 0.25, ...PkPaintM }),
    J(Ye(0.08, 0.08, 0.5, 6), 2763306, { y: 0.95, x: 0.3, ao: 0, ...PkMetal }),
    J(Je(0.3, 0.3, 0.72), 2763306, { y: 0.4, x: -0.35, ao: 0.3, aoH: 0.3, ...PkPaintM }),
    J(Je(0.5, 0.04, 0.6), 3815994, { y: 0.71, x: 0.1, ao: 0, ...PkMetal }),
  ],
  e: [J(Je(0.15, 0.08, 0.02), 4259680, { y: 0.55, z: 0.36, x: 0.2, ao: 0, tg: 0 }), J(_n(0.03, 4, 3), 16724800, { y: 0.62, z: 0.37, x: -0.1, ao: 0, tg: 0 })],
  dim: 1,
  pulse: 0.15,
});

Ie.antenna = (n, e) => ({
  g: [
    J(Ye(0.04, 0.09, 3.2, 6), 9080724, { y: 1.6, tg: 0.2, ao: 0.4, aoH: 0.6, ...PkMetal }),
    J(Je(0.6, 0.04, 0.04), 9080724, { y: 2.6, ao: 0, ...PkMetal }),
    J(Je(0.4, 0.04, 0.04), 9080724, { y: 2.9, ao: 0, ...PkMetal }),
    J(Je(0.28, 0.04, 0.04), 9080724, { y: 3.1, ao: 0, ...PkMetal }),
    J(Je(0.3, 0.3, 0.3), 5921370, { y: 0.15, ao: 0.4, aoH: 0.2, ...PkPaintM }),
  ],
  e: [J(_n(0.08, 6, 4), 16724e3, { y: 3.27, ao: 0, tg: 0 })],
  dim: 1.4,
  pulse: 0.5,
});

Ie.radar = (n, e) => ({
  g: [
    J(Ye(0.15, 0.25, 0.9, 8), 5922920, { y: 0.45, tg: 0.2, ao: 0.5, aoH: 0.3, ...PkMetal }),
    J(_n(0.7, 10, 5), 13159632, { y: 1.3, sy: 0.35, rx: 0.6, tg: 0.3, ao: 0, ...PkPaintM }),
    J(Ye(0.025, 0.025, 0.6, 4), 5922920, { y: 1.5, z: 0.25, rx: 0.6, ao: 0, ...PkMetal }),
  ],
});

Ie.tower = (n, e) => ({
  g: [
    J(Ye(0.06, 0.6, 4.5, 5), 6973008, { y: 2.25, tg: 0.2, ao: 0.45, aoH: 1, ...PkMetal }),
    J(Je(0.9, 0.06, 0.9), 5920324, { y: 3.6, ao: 0, ...PkMetal }),
    J(Je(0.06, 4.4, 0.06), 5920324, { y: 2.2, x: 0.3, rz: 0.1, ao: 0.2, aoH: 1, ...PkMetal }),
    J(Je(0.06, 4.4, 0.06), 5920324, { y: 2.2, x: -0.3, rz: -0.1, ao: 0.2, aoH: 1, ...PkMetal }),
  ],
  e: [J(_n(0.09, 6, 4), 16724e3, { y: 4.58, ao: 0, tg: 0 })],
  dim: 1.4,
  pulse: 0.5,
});

Ie.sandbags = (n, e) => ({
  g: Array.from({ length: 6 }, (t, i) =>
    J(Ye(0.18, 0.18, 0.55, 7), [10521184, 9470048][i % 2], {
      x: (i % 3) * 0.5 - 0.5 + (i >= 3 ? 0.25 : 0),
      y: i >= 3 ? 0.42 : 0.15,
      rz: Math.PI / 2,
      sx: 1,
      sy: 1,
      sz: 0.65,
      vary: 0.1,
      seed: e + i,
      tg: 0.2,
      ao: 0.5,
      aoH: 0.3,
      speck: 0.25,
      rough: 0.95,
    }),
  ),
});

Ie.locker = (n, e) => ({
  g: [
    J(Je(0.7, 1.4, 0.45), 4872794, { y: 0.7, vary: 0.06, seed: e, tg: 0.18, ao: 0.5, aoH: 0.4, speck: 0.3, ...PkPaintM }),
    J(Je(0.02, 1.3, 0.47), 2767418, { y: 0.7, ao: 0, ...PkMetal }),
    J(Je(0.06, 0.2, 0.01), 2368552, { y: 1.05, x: 0.15, z: 0.23, ao: 0, ...PkMetal }),
    J(Je(0.06, 0.2, 0.01), 2368552, { y: 1.05, x: -0.15, z: 0.23, ao: 0, ...PkMetal }),
    J(Je(0.03, 0.12, 0.03), 11184810, { y: 0.8, x: 0.05, z: 0.24, ao: 0, ...PkMetal }),
    J(Je(0.03, 0.12, 0.03), 11184810, { y: 0.8, x: -0.05, z: 0.24, ao: 0, ...PkMetal }),
  ],
});

Ie.table = (n, e) => ({
  g: [
    J(Je(1, 0.06, 0.6), 6965808, { y: 0.55, tg: 0.1, ao: 0, speck: 0.2, rough: 0.8 }),
    ...[[0.45, 0.25], [-0.45, 0.25], [0.45, -0.25], [-0.45, -0.25]].map(([t, i]) => J(Je(0.06, 0.55, 0.06), 4863008, { x: t, z: i, y: 0.27, ao: 0.5, aoH: 0.3, rough: 0.85 })),
    J(Je(0.12, 0.03, 0.18), 10518864, { x: -0.25, y: 0.595, z: 0.05, ao: 0, rough: 0.8 }),
    J(Ye(0.05, 0.045, 0.08, 6), 13682864, { x: 0.28, y: 0.62, z: -0.1, ao: 0, rough: 0.5 }),
  ],
});

Ie.jar = (n, e) => ({
  g: [
    J(_n(0.28, 8, 5), 11563082, { y: 0.3, sy: 1.2, tg: 0.3, ao: 0.5, aoH: 0.3, rough: 0.5, metal: 0.1 }),
    J(Ye(0.1, 0.12, 0.15, 7), 10510394, { y: 0.67, ao: 0, rough: 0.6, metal: 0.1 }),
  ],
});

Ie.bed = (n, e) => ({
  g: [
    J(Je(0.8, 0.3, 1.6), 5921354, { y: 0.15, ao: 0.5, aoH: 0.25, ...PkPaintM }),
    J(Je(0.75, 0.12, 1.5), 9079418, { y: 0.36, tg: 0.1, ao: 0, rough: 0.9 }),
    J(Je(0.6, 0.1, 0.3), 13684928, { y: 0.45, z: -0.55, ao: 0, rough: 0.9 }),
    J(Je(0.78, 0.1, 0.8), 4552848, { y: 0.44, z: 0.28, ao: 0, rough: 0.9 }),
  ],
});

Ie.computer = (n, e) => ({
  g: [
    J(Je(0.9, 0.7, 0.5), 3817028, { y: 0.35, tg: 0.2, ao: 0.5, aoH: 0.3, ...PkPaintM }),
    J(Je(0.7, 0.45, 0.06), 2764340, { y: 0.95, z: -0.1, rx: -0.1, ao: 0, ...PkPaintM }),
    J(Je(0.7, 0.04, 0.22), 5921370, { y: 0.71, z: 0.16, ao: 0, ...PkPaintM }),
  ],
  e: [
    J(Je(0.6, 0.36, 0.02), 4251808, { y: 0.95, z: -0.06, rx: -0.1, ao: 0, tg: 0.3 }),
    J(Je(0.05, 0.03, 0.01), 4259680, { y: 0.55, z: 0.26, x: 0.3, ao: 0, tg: 0 }),
    J(Je(0.05, 0.03, 0.01), 16744256, { y: 0.55, z: 0.26, x: 0.2, ao: 0, tg: 0 }),
  ],
  dim: 1.1,
  pulse: 0.05,
});

Ie.tank_lab = (n, e) => ({
  g: [
    J(Ye(0.4, 0.42, 0.2, 12), 5922920, { y: 0.1, ao: 0.4, aoH: 0.15, ...PkMetal }),
    J(Ye(0.4, 0.4, 0.2, 12), 5922920, { y: 1.7, ao: 0, ...PkMetal }),
    ...[0, 2.1, 4.2].map((a) => J(Ye(0.025, 0.025, 1.5, 5), 8026760, { x: Math.cos(a) * 0.37, z: Math.sin(a) * 0.37, y: 0.9, ao: 0, ...PkMetal })),
  ],
  e: [J(Ye(0.32, 0.32, 1.4, 12), 4259744, { y: 0.9, tg: 0.5, ao: 0 }), J(_n(0.05, 4, 3), 11796416, { y: 1.2, x: 0.1, ao: 0, tg: 0 }), J(_n(0.04, 4, 3), 11796416, { y: 0.7, x: -0.12, z: 0.1, ao: 0, tg: 0 })],
  dim: 0.55,
  pulse: 0.1,
});

Ie.debris = (n, e) => ({
  g: [
    J(Je(0.25, 0.06, 0.18), 5921368, { y: 0.03, ry: e, ao: 0.4, aoH: 0.05, speck: 0.2, ...PkMetal, rough: 0.7 }),
    J(Je(0.12, 0.05, 0.3), 3815992, { x: 0.2, y: 0.03, ry: e + 1, ao: 0.4, aoH: 0.05, speck: 0.2, ...PkMetal, rough: 0.7 }),
  ],
});
Ie.paper = (n, e) => ({ g: [J(Je(0.2, 0.01, 0.28), 14210248, { y: 0.01, ry: e, ao: 0, rough: 0.9 })] });
Ie.bolt = (n, e) => ({
  g: [
    J(Ye(0.04, 0.04, 0.12, 6), 9080724, { y: 0.02, rz: Math.PI / 2, ao: 0.3, aoH: 0.04, ...PkMetal }),
    J(Je(0.3, 0.02, 0.06), 6975090, { x: 0.15, y: 0.01, ry: e, ao: 0.2, aoH: 0.03, ...PkMetal }),
  ],
});


// ═════════════════════ FUEGO, CRISTAL, LAVA Y XENO (emisivos HDR) ═════════════════════

Ie.ice_spike = (n, e) => ({
  g: [],
  e: [
    J(Wn(0.26, 1.4, 5), 10475775, { y: 0.7, jit: 0.08, seed: e, rz: 0.1, tg: 0.7, tgPow: 1.2, ao: 0.3, aoH: 0.4 }),
    J(Wn(0.17, 0.9, 5), 12642559, { x: 0.26, y: 0.45, rz: -0.3, seed: e + 1, tg: 0.7, ao: 0.3, aoH: 0.3 }),
    J(Wn(0.14, 0.7, 5), 8440063, { x: -0.2, y: 0.35, rz: 0.4, z: 0.1, tg: 0.7, ao: 0.3, aoH: 0.3 }),
  ],
  dim: 0.7,
  pulse: 0.04,
});

Ie.crystal_ice = (n, e) => ({
  g: [J(Yn(0.3), 9083560, { y: 0.1, sy: 0.5, tg: 0.2, ao: 0.4, aoH: 0.15, rough: 0.9 })],
  e: [
    J(ra(0.3), 8444159, { y: 0.6, sy: 1.8, seed: e, tg: 0.7, ao: 0.2, aoH: 0.4 }),
    J(ra(0.2), 11069695, { x: 0.25, y: 0.4, sy: 1.6, rz: -0.4, tg: 0.7, ao: 0.2, aoH: 0.3 }),
    J(ra(0.14), 9757695, { x: -0.22, y: 0.3, sy: 1.5, rz: 0.4, tg: 0.7, ao: 0.2, aoH: 0.3 }),
  ],
  dim: 0.9,
  pulse: 0.06,
});

Ie.obsidian = (n, e) => ({
  g: [
    J(Wn(0.4, 2, 5), 1709080, { y: 1, jit: 0.15, seed: e, rz: 0.12, tg: 0.3, ao: 0.4, aoH: 0.8, rough: 0.2, metal: 0.55 }),
    J(Wn(0.28, 1.3, 5), 2366496, { x: 0.35, y: 0.65, rz: -0.25, seed: e + 1, jit: 0.1, tg: 0.3, ao: 0.4, aoH: 0.5, rough: 0.2, metal: 0.55 }),
  ],
  e: [J(Wn(0.1, 0.6, 4), 16734736, { y: 0.3, x: -0.25, rz: 0.3, tg: 0.6, ao: 0 }), J(Je(0.03, 0.9, 0.03), 16734736, { y: 0.55, x: 0.05, z: 0.18, rz: 0.12, ao: 0, tg: 0.6 })],
  dim: 0.8,
  pulse: 0.1,
});

Ie.rock_lava = (n, e) => ({
  g: [J(Yn(0.55), 2761252, { y: 0.28, sy: 0.65, jit: 0.2, seed: e, tg: 0.2, ao: 0.5, aoH: 0.3, strata: 0.1, rough: 0.9 })],
  e: [J(Yn(0.3), 16738832, { y: 0.1, sy: 0.3, x: 0.3, seed: e, tg: 0.5, ao: 0 }), J(Je(0.5, 0.03, 0.04), 16745504, { y: 0.52, x: 0.0, z: 0.1, ry: 0.5, ao: 0, tg: 0 })],
  dim: 0.65,
  pulse: 0.12,
});

Ie.vent = (n, e) => ({
  g: [
    J(Ye(0.35, 0.6, 0.6, 8), 2761252, { y: 0.3, jit: 0.1, seed: e, tg: 0.2, ao: 0.5, aoH: 0.3, rough: 0.9 }),
    J(Ye(0.3, 0.34, 0.08, 8), 1905432, { y: 0.62, ao: 0, rough: 0.9 }),
  ],
  e: [J(Ye(0.22, 0.22, 0.02, 8), 16740384, { y: 0.66, ao: 0, tg: 0 })],
  dim: 1,
  pulse: 0.18,
});

Ie.crystal_fire = (n, e) => ({
  g: [J(Yn(0.3), 2761252, { y: 0.1, sy: 0.5, tg: 0.2, ao: 0.4, aoH: 0.15, rough: 0.9 })],
  e: [
    J(ra(0.28), 16747040, { y: 0.55, sy: 1.8, seed: e, tg: 0.7, ao: 0.2, aoH: 0.4 }),
    J(ra(0.18), 16760896, { x: 0.22, y: 0.35, sy: 1.6, rz: -0.4, tg: 0.7, ao: 0.2, aoH: 0.3 }),
    J(ra(0.13), 16729112, { x: -0.2, y: 0.28, sy: 1.5, rz: 0.4, tg: 0.7, ao: 0.2, aoH: 0.3 }),
  ],
  dim: 1,
  pulse: 0.12,
});

Ie.ember_rock = (n, e) => ({
  g: [J(Yn(0.12), 1709078, { y: 0.04, sy: 0.6, seed: e, ao: 0.4, aoH: 0.06, rough: 0.9 })],
  e: [J(Yn(0.05), 16734736, { x: 0.1, y: 0.03, ao: 0, tg: 0 })],
  dim: 0.9,
  pulse: 0.15,
});

Ie.vein = (n, e) => ({
  g: [J(Ye(0.03, 0.03, 0.9, 4), 6957658, { y: 0.02, rz: Math.PI / 2, ry: e, ao: 0.3, aoH: 0.03, rough: 0.8 })],
  e: [J(_n(0.05, 4, 3), 16728256, { x: 0.3, y: 0.04, ao: 0, tg: 0 })],
  dim: 0.7,
  pulse: 0.15,
});

Ie.crystal = (n, e) => ({
  g: [J(Yn(0.35), 2759216, { y: 0.1, sy: 0.4, tg: 0.2, ao: 0.4, aoH: 0.15, rough: 0.9 })],
  e: [
    J(ra(0.3), 12610559, { y: 0.6, sy: 2, seed: e, tg: 0.75, ao: 0.2, aoH: 0.4 }),
    J(ra(0.2), 14721279, { x: 0.25, y: 0.4, sy: 1.8, rz: -0.5, tg: 0.75, ao: 0.2, aoH: 0.3 }),
    J(ra(0.16), 9453823, { x: -0.2, y: 0.35, sy: 1.6, rz: 0.5, tg: 0.75, ao: 0.2, aoH: 0.3 }),
  ],
  dim: 1,
  pulse: 0.08,
});

Ie.tendril = (n, e) => ({
  g: [
    J(Ye(0.06, 0.2, 1.8, 6), 5909082, { y: 0.9, jit: 0.12, seed: e, rz: 0.25, vary: 0.2, tg: 0.3, ao: 0.5, aoH: 0.6, rough: 0.6 }),
    J(Ye(0.04, 0.14, 1.3, 6), 6959216, { x: 0.3, y: 0.65, rz: -0.35, jit: 0.1, seed: e + 1, tg: 0.3, ao: 0.4, aoH: 0.5, rough: 0.6 }),
  ],
  e: [J(_n(0.1, 6, 4), 16736511, { y: 1.8, x: 0.22, ao: 0, tg: 0 }), J(_n(0.06, 5, 3), 16736511, { y: 1.35, x: 0.55, ao: 0, tg: 0 })],
  dim: 1,
  pulse: 0.15,
});

Ie.pod = (n, e) => ({
  g: [J(_n(0.3, 8, 5), 4856394, { y: 0.15, sy: 0.6, tg: 0.2, ao: 0.4, aoH: 0.2, rough: 0.55 })],
  e: [J(_n(0.38, 9, 6), 12599551, { y: 0.55, sy: 1.25, seed: e, tg: 0.5, ao: 0.2, aoH: 0.4 })],
  dim: 0.75,
  pulse: 0.1,
});
Ie.pod_s = Ie.pod;

Ie.xeno_spire = (n, e) => ({
  g: [
    J(Wn(0.45, 2.6, 6), 3807808, { y: 1.3, jit: 0.15, seed: e, rz: 0.08, tg: 0.3, ao: 0.5, aoH: 0.8, rough: 0.55 }),
    J(Mp(0.4, 0.07, 4, 8), 6957674, { y: 0.8, rx: Math.PI / 2, ao: 0.3, rough: 0.55 }),
    J(Mp(0.3, 0.06, 4, 8), 6957674, { y: 1.5, rx: Math.PI / 2, ao: 0, rough: 0.55 }),
  ],
  e: [J(ra(0.13), 16736511, { y: 2.68, ao: 0, tg: 0 }), J(Mp(0.34, 0.025, 4, 10), 16736511, { y: 1.1, rx: Math.PI / 2, ao: 0, tg: 0 })],
  dim: 1.2,
  pulse: 0.15,
});

Ie.egg = (n, e) => ({
  g: [
    J(_n(0.33, 9, 6), 6965850, { y: 0.4, sy: 1.3, vary: 0.1, seed: e, tg: 0.3, ao: 0.5, aoH: 0.3, rough: 0.45, metal: 0.05, speck: 0.15 }),
    J(_n(0.2, 6, 4), 5913162, { x: 0.36, y: 0.22, sy: 1.2, tg: 0.2, ao: 0.4, aoH: 0.2, rough: 0.5 }),
    J(_n(0.14, 6, 4), 5913162, { x: -0.3, z: 0.18, y: 0.14, sy: 1.1, ao: 0.4, aoH: 0.15, rough: 0.5 }),
  ],
  // el «ojo» del nido: rendija vertical que brilla
  e: [J(_n(0.1, 6, 4), 16744640, { y: 0.58, z: 0.27, sy: 1.6, sz: 0.4, ao: 0, tg: 0 })],
  dim: 1.2,
  pulse: 0.2,
});

Ie.pillar = (n, e) => ({
  g: [
    J(Je(0.8, 0.3, 0.8), tt(n.rock, 16777215, 0.1), { y: 0.15, tg: 0.2, ao: 0.55, aoH: 0.3, strata: 0.1, strataF: 18, tc: 1, rough: 0.92, speck: 0.15 }),
    J(Ye(0.28, 0.32, 2.6, 8), n.rock, { y: 1.5, jit: 0.04, seed: e, tg: 0.25, ao: 0.4, aoH: 1.2, strata: 0.12, strataF: 10, rough: 0.92, speck: 0.15 }),
    J(Ye(0.34, 0.3, 0.08, 8), tt(n.rock, 0, 0.1), { y: 1.0, ao: 0, rough: 0.92 }),
    J(Je(0.75, 0.25, 0.75), tt(n.rock, 16777215, 0.1), { y: 2.9, tg: 0.2, tc: 1, ao: 0, rough: 0.92 }),
  ],
});

Ie.obelisk = (n, e) => ({
  g: [
    J(Je(0.9, 0.4, 0.9), 2763316, { y: 0.2, tg: 0.2, ao: 0.55, aoH: 0.3, rough: 0.7, metal: 0.2 }),
    J(Je(0.5, 2.6, 0.5), 3421247, { y: 1.6, tg: 0.3, ao: 0.4, aoH: 1.5, speck: 0.12, rough: 0.55, metal: 0.3 }),
    J(Wn(0.36, 0.5, 4), 3421247, { y: 3.15, ry: Math.PI / 4, tg: 0.3, ao: 0, rough: 0.5, metal: 0.3 }),
  ],
  e: [
    J(Je(0.52, 0.08, 0.52), 6349055, { y: 1.2, ao: 0, tg: 0 }),
    J(Je(0.52, 0.08, 0.52), 6349055, { y: 2.2, ao: 0, tg: 0 }),
    J(Je(0.05, 1.0, 0.52), 6349055, { y: 1.7, x: 0, ao: 0, tg: 0.4 }),
    J(Je(0.52, 1.0, 0.05), 6349055, { y: 1.7, ao: 0, tg: 0.4 }),
  ],
  dim: 0.9,
  pulse: 0.1,
});

Ie.tent = (n, e) => ({
  g: [
    J(Wn(1.2, 1.3, 4), 5925442, { y: 0.65, ry: Math.PI / 4, sz: 0.8, vary: 0.05, seed: e, tg: 0.25, ao: 0.5, aoH: 0.4, speck: 0.2, rough: 0.95 }),
    J(Je(0.5, 0.7, 0.05), 2763296, { y: 0.35, z: 0.66, ao: 0.3, aoH: 0.3, rough: 0.95 }),
    J(Ye(0.025, 0.025, 0.4, 4), 9079434, { y: 1.5, ao: 0, ...PkMetal }),
  ],
});


// ════════ [606] VariableDeclaration Bx,_p ════════
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


// ═══════════════════════════════════════════════════════════════════════════════════════════
// CONSTRUCCIÓN POR CHUNK (la llama Ul.buildProps): materiales, variación por instancia, matas y acentos de luz
// ═══════════════════════════════════════════════════════════════════════════════════════════

var PkInited = !1;
// enlaza el viento (uTime de Ep) y la fuente de «luz artificial» (noche / interior) del motor de props
function PkInit() {
  PkInited ||
    ((PkInited = !0),
    (PkFx.time = zo.uTime),
    (PkFx.source = () => ({ night: x.R.env.night, dark: x.R.env.dark, quality: x.R.quality })));
}

// viento por tipo: fracción de la altura que oscila en la punta (el mismo Ep para todo lo vegetal)
var PkWindAmp = {
    oak: 0.05, pine: 0.05, pine_snow: 0.04, bush: 0.07, dead_tree: 0.02, swamp_tree: 0.05, tendril: 0.07, reeds: 0.1,
    cactus: 0.012, grass: 0.14, dry_grass: 0.14, flower: 0.15, reed_small: 0.14, shroom_small: 0.04, mushroom: 0.03, xeno_spire: 0.03,
  },
  // clase de variación de color por instancia
  PkClass = {
    oak: "tree", pine: "tree", pine_snow: "tree", bush: "tree", swamp_tree: "tree", dead_tree: "tree", tendril: "tree", cactus: "tree",
    rock: "rock", rock_big: "rock", rock_desert: "rock", boulder_snow: "rock", cliffrock: "rock", rock_lava: "rock", pebble: "rock", mesa: "rock",
    grass: "grass", dry_grass: "grass", reeds: "grass", reed_small: "grass", flower: "flower", shroom_small: "flower",
  },
  // decorado que nace en matas (claros + manchas densas)
  PkClumps = new Set(["grass", "dry_grass", "flower", "reed_small", "shroom_small", "snow_tuft"]),
  // sombra de contacto: radio por unidad de escala
  PkBlob = {
    oak: 0.95, pine: 0.8, pine_snow: 0.8, swamp_tree: 0.85, dead_tree: 0.45, bush: 0.6, cactus: 0.38, rock: 0.55, rock_big: 1, rock_desert: 0.85,
    boulder_snow: 0.75, rock_lava: 0.65, cliffrock: 0.8, mesa: 1.25, stump: 0.4, car: 1.15, tank_wreck: 1.55, container: 1.35, barrel: 0.4,
    barrel_toxic: 0.4, barrel_rad: 0.42, crate: 0.55, crates: 0.95, lamp: 0.34, hydrant: 0.3, tire: 0.36, generator: 0.7, antenna: 0.4, radar: 0.5,
    tower: 0.55, pillar: 0.6, obelisk: 0.65, tent: 1.3, sandbags: 0.75, locker: 0.55, table: 0.65, bed: 0.75, computer: 0.55, tank_lab: 0.5,
    pipe: 0.6, rubble: 0.6, rubble_s: 0.4, crystal: 0.5, crystal_ice: 0.45, crystal_fire: 0.5, obsidian: 0.55, egg: 0.45, pod: 0.45, pod_s: 0.35,
    xeno_spire: 0.55, tendril: 0.4, mushroom: 0.45, jar: 0.3, skull: 0.3, log: 0.5,
  },
  // luces artificiales: c color · r radio del charco · i intensidad · hy/hs/hi altura, tamaño e intensidad del halo · ox desplazamiento lateral
  PkLight = {
    lamp: { c: 16767104, r: 3.8, i: 0.7, hy: 2.33, hs: 1.7, hi: 1.1, ox: 0.46 },
    antenna: { c: 16724e3, r: 0, hy: 3.02, hs: 0.75, hi: 1.5 },
    tower: { c: 16724e3, r: 0, hy: 4.22, hs: 0.8, hi: 1.5 },
    barrel_toxic: { c: 10354506, r: 1.5, i: 0.8, hy: 0.72, hs: 0.5, hi: 0.6 },
    barrel_rad: { c: 13172512, r: 1.7, i: 0.85, hy: 0.4, hs: 0.5, hi: 0.5 },
    computer: { c: 4251903, r: 1.4, i: 0.55, hy: 0.95, hs: 0.7, hi: 0.5 },
    tank_lab: { c: 4259744, r: 1.8, i: 0.65, hy: 0.9, hs: 1, hi: 0.5 },
    crystal: { c: 9453823, r: 2.4, i: 0.9, hy: 0.8, hs: 1.3, hi: 0.9 },
    crystal_ice: { c: 8444159, r: 2.2, i: 0.8, hy: 0.7, hs: 1.1, hi: 0.8 },
    crystal_fire: { c: 16747040, r: 2.6, i: 1, hy: 0.7, hs: 1.2, hi: 1 },
    ice_spike: { c: 10475775, r: 1.8, i: 0.5, hy: 0.7, hs: 0.8, hi: 0.5 },
    obsidian: { c: 16734736, r: 1.9, i: 0.7, hy: 0.3, hs: 0.6, hi: 0.6 },
    rock_lava: { c: 16738832, r: 2.2, i: 0.8, hy: 0.2, hs: 0.7, hi: 0.5 },
    vent: { c: 16740384, r: 2.6, i: 0.9, hy: 0.66, hs: 1, hi: 0.8 },
    ember_rock: { c: 16734736, r: 0.9, i: 0.6, hy: 0.05, hs: 0.3, hi: 0.4 },
    vein: { c: 16728256, r: 0.9, i: 0.45 },
    egg: { c: 16744640, r: 1.7, i: 0.7, hy: 0.58, hs: 0.8, hi: 0.9 },
    pod: { c: 12599551, r: 2, i: 0.7, hy: 0.6, hs: 0.9, hi: 0.7 },
    pod_s: { c: 12599551, r: 1.5, i: 0.6, hy: 0.6, hs: 0.8, hi: 0.6 },
    tendril: { c: 16736511, r: 1.7, i: 0.55, hy: 1.8, hs: 0.8, hi: 0.8, ox: 0.22 },
    xeno_spire: { c: 16736511, r: 2.2, i: 0.75, hy: 2.68, hs: 1.1, hi: 1 },
    mushroom: { c: 10305791, r: 1.8, i: 0.6, hy: 1.1, hs: 1, hi: 0.7 },
    shroom_small: { c: 10305791, r: 0.9, i: 0.4 },
    obelisk: { c: 6349055, r: 2.2, i: 0.7, hy: 1.7, hs: 1, hi: 0.5 },
  },
  // capa superior por bioma: [color, peso] — musgo, arena, nieve, ceniza… sobre las caras altas de rocas y suelo duro
  PkTop = {
    valle: [0x41632a, 0.8], ciudad: [6978128, 0.55], desierto: [14924158, 0.85], marisma: [0x3b5a3a, 0.8], tundra: [15922943, 1],
    complejo: [7101000, 0.35], caldera: [4866108, 0.7], yermo: [10120310, 0.65], colmena: [8540303, 0.85],
  };

var PkCol = new Ee();

// variación de color por instancia (se multiplica por el color horneado vía instanceColor, sin coste de dibujo):
// manchas de «lozano / seco» coherentes en el espacio + azar por instancia; las flores cambian de tono
function PkVary(k, px, pz, r, out) {
  let a = PkNoise(px * 0.08 + 3.7, pz * 0.08 - 1.3),
    v = 1 + (r - 0.5) * 0.3;
  if (k === "tree") out.setRGB(ls(1.1, 0.93, a) * v, ls(0.99, 1.07, a) * v, ls(0.8, 0.92, a) * v);
  else if (k === "grass") {
    let b = PkNoise(px * 0.13 - 8.1, pz * 0.13 + 4.4);
    v = 1 + (r - 0.5) * 0.4;
    out.setRGB(ls(1.2, 0.92, b) * v, ls(1.03, 1.1, b) * v, ls(0.68, 0.86, b) * v);
  } else if (k === "flower") out.setRGB(0.8 + r * 0.45, 0.78 + PkHash(r * 91, px) * 0.45, 0.8 + PkHash(pz, r * 57) * 0.5);
  else if (k === "rock") ((v = 1 + (r - 0.5) * 0.4), out.setRGB(ls(1.08, 0.93, a) * v, ls(1, 0.99, a) * v, ls(0.92, 1.07, a) * v));
  else out.setRGB(v, v, v);
  return out;
}

// matas: el decorado uniforme se agrupa — claros donde el ruido es bajo, hermanos extra donde es alto (misma casilla)
function PkClump(ch, d) {
  let list = d.list;
  if (!PkClumps.has(d.t)) return list;
  let e = ch.map,
    r = pi(list.length * 7 + (e.seed || 11) + 3),
    out = [];
  for (let f of list) {
    let n = PkNoise(f.x * 0.11 + 5.3, f.z * 0.11 - 2.1);
    if (n < 0.4 && r() < 0.78) continue;
    out.push(f);
    if (n > 0.6) {
      let src = e.ter[(f.z | 0) * e.w + (f.x | 0)];
      for (let k = r() < 0.25 ? 2 : r() < 0.6 ? 1 : 0; k > 0; k--) {
        let a = r() * 6.283,
          dd = 0.22 + r() * 0.34,
          nx = f.x + Math.cos(a) * dd,
          nz = f.z + Math.sin(a) * dd;
        e.ter[(nz | 0) * e.w + (nx | 0)] === src && out.push({ ...f, x: nx, z: nz, s: (f.s || 1) * (0.7 + r() * 0.55), r: r() * 6.283 });
      }
    }
  }
  return out;
}

// materiales de props procedurales: vertexColors + Ep (viento) + parche de props (borde, reflejo, capa superior)
var PkMats = new Map();
function PkPropMat(key, wh, amp) {
  let k = key + "|" + (wh ? wh.toFixed(1) + "|" + amp : 0),
    m = PkMats.get(k);
  if (!m) {
    m = new Xt({ vertexColors: !0, roughness: 0.85, metalness: 0.05, flatShading: !0 });
    wh && Ep(m, wh, amp);
    let top = PkTop[key] || [16777215, 0];
    PkPatch(m, { rim: 0.4, env: 0.8, top: top[0], topAmt: top[1] });
    PkMats.set(k, m);
  }
  return m;
}

// malla instanciada con color por instancia (variación) y bounding sphere
function PkInstances(ch, geo, mat, list, kind, o, place, cast, recv) {
  let n = list.length,
    v = new ys(geo, mat, n);
  for (let i = 0; i < n; i++) {
    let it = list[i];
    (place(it, o), o.updateMatrix(), v.setMatrixAt(i, o.matrix));
    kind && v.setColorAt(i, PkVary(kind, it.x, it.z, PkHash(it.x * 1.7 + 3, it.z * 2.3 + 1), PkCol));
  }
  ((v.instanceMatrix.needsUpdate = !0), v.instanceColor && (v.instanceColor.needsUpdate = !0), v.computeBoundingSphere());
  ((v.castShadow = cast), (v.receiveShadow = recv), ch.group.add(v));
  return v;
}

// sombras de contacto y luces: se acumulan por chunk y se dibujan en 3 mallas instanciadas en total
function PkGather(acc, d, list, yOf) {
  let B = PkBlob[d.t],
    L = PkLight[d.t];
  if (!B && !L) return;
  for (let v of list) {
    let s = v.s || 1,
      y = yOf(v),
      c = Math.cos(v.r || 0),
      sn = Math.sin(v.r || 0);
    B && !d.decor && acc.blobs.push([v.x, v.z, B * s, y]);
    if (L) {
      let ox = (L.ox || 0) * s,
        wx = v.x + ox * c,
        wz = v.z - ox * sn;
      L.r && acc.pools.push([wx, wz, L.r * s, L.c, L.i, y]);
      L.hs && acc.halos.push([wx, y + L.hy * s, wz, L.hs * s, L.c, L.hi]);
    }
  }
}

// props procedurales (kit Ie.*): una malla fusionada g + una emisiva e por tipo y chunk
function PkProcedural(ch, d, o, acc) {
  let u = Hx(d.t, d.pal, d.key),
    list = PkClump(ch, d);
  if (!list.length) return;
  let place = (it, ob) => (ob.position.set(it.x, it.y || 0, it.z), ob.rotation.set(0, it.r || 0, 0), ob.scale.setScalar(it.s || 1)),
    kind = PkClass[d.t] || "misc";
  if (u.g) {
    let mat;
    if (wp.has(d.t)) {
      u.g.boundingBox || u.g.computeBoundingBox();
      mat = PkPropMat(d.key, u.g.boundingBox.max.y, PkWindAmp[d.t] ?? (d.decor ? 0.12 : 0.05));
    } else mat = PkPropMat(d.key);
    PkInstances(ch, u.g, mat, list, kind, o, place, !d.decor, !d.decor);
  }
  u.e && PkInstances(ch, u.e, PkGlow(1.6 * (u.dim ?? 1), u.pulse ?? 0.07), list, null, o, place, !1, !1);
  PkGather(acc, d, list, (v) => v.y || 0);
}

// clave de región/tema del grupo (igual que el modelProps original)
function PkRegionKey(ch, e) {
  return ch.map.kind === "op"
    ? ch.map.rk ||
        { ruinas: "ciudad", bunker: "complejo", laboratorio: "complejo", fabrica: "complejo", caverna: "tundra", magma: "caldera", colmena: "colmena" }[ch.map.theme] ||
        "valle"
    : De[e.list[0].reg ?? ch.map.regAt(e.list[0].x, e.list[0].z)].key;
}

// materiales de modelos GLB (atlas): copia del original + color de vértice + recoloreo por bioma (Jf) + viento (Ep) + parche de props
var PkModelMats = new Map();
function PkModelMat(name, p, st, l, wind, rkey, hh) {
  let k = name + "|" + p.mat.uuid + "|" + (l ?? "") + "|" + (wind || 0) + "|" + rkey,
    m = PkModelMats.get(k);
  if (!m) {
    m = p.mat.clone();
    m.vertexColors = !0;
    l != null && Jf(m, To(name, l, 1));
    wind && Ep(m, hh, wind);
    let top = PkTop[rkey] || [16777215, 0],
      rim = { leaf: 0.55, grass: 0.5, wood: 0.3, rock: 0.14, metal: 0.18, building: 0.12, prop: 0.2 }[st.kind] ?? 0.2;
    PkPatch(m, { rim, env: st.env ? 0.9 : 0, win: st.win ? 1 : 0, top: top[0], topAmt: st.tc ? top[1] : 0 });
    PkModelMats.set(k, m);
  }
  return m;
}

// props con modelo GLB (árboles, rocas, vehículos, hierba…): como Ul.modelProps pero pintados, con variación y matas
function PkModels(ch, e, t, i, acc) {
  let s = t[0].filter((c) => Ln.has(c)),
    a = s.map(() => []),
    list = PkClump(ch, e);
  if (!list.length) return;
  list.forEach((c) => a[((Math.floor(c.x * 7) + Math.floor(c.z * 13)) >>> 0) % s.length].push(c));
  let r = PkRegionKey(ch, e),
    o = lx[e.t],
    l = o ? ox[r]?.[o] : null,
    kind = PkClass[e.t] || "misc";
  s.forEach((c, d) => {
    let h = a[d];
    if (!h.length) return;
    let f = Ln.staticGeo(c);
    if (!f) return;
    let u = t[3] ?? Math.min(t[1] / Math.max(0.05, f.h), (t[2] ?? 1.7) / Math.max(0.05, f.w)),
      st = PkStyle(c),
      wind = wp.has(e.t) ? (PkWindAmp[e.t] ?? (e.t === "cactus" ? 0.015 : 0.045)) : 0,
      place = (v, ob) => (ob.position.set(v.x, v.y ? v.y * 0.4 : 0, v.z), ob.rotation.set(0, v.r || 0, 0), ob.scale.setScalar(u * (v.s || 1)));
    for (let p of f.parts) {
      p.geo.attributes.aMat || PkModel(p.geo, c, f.h, c.length * 7 + 1);
      PkInstances(ch, p.geo, PkModelMat(c, p, st, l, wind, r, f.h), h, kind, i, place, !e.decor, !0);
    }
    PkGather(acc, { t: e.t, decor: e.decor }, h, (v) => (v.y ? v.y * 0.4 : 0));
  });
}

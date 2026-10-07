// 17-worldgen.js — Generación procedural del mundo, estructuras y mazmorras

// ════════ [452] VariableDeclaration qt,Si,np,aE,rE,Vn,oE,lE,cE (1079 bytes) ════════
var qt = 192,
  Si = qt + qt / 2 + 0.5,
  np = qt * 3,
  aE = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
  ],
  rE = [
    [0, 3],
    [0, 5],
    [0, 7],
  ],
  Vn = {
    military: 0,
    ruin: 1,
    adobe: 2,
    shack: 3,
    cabin: 4,
    factory: 5,
    obsidian: 6,
    organic: 7,
    bunker: 8,
    cave: 9,
    base: 10,
    brick: 14,
    plaster: 15,
    rusted: 16,
    sandstone: 17,
    prefab: 18,
    concrete: 19,
    painted: 20,
    redbrick: 21,
    clinic: 22,
    olive: 23,
    hazard: 24,
    darkmetal: 25,
    terracotta: 26,
    barn: 27,
  },
  oE = [
    ["military", "cabin", "brick", "prefab", "olive", "barn", "clinic"],
    ["ruin", "brick", "plaster", "concrete", "redbrick", "painted", "clinic"],
    ["adobe", "sandstone", "prefab", "plaster", "terracotta"],
    ["shack", "rusted", "cabin", "barn", "olive"],
    ["cabin", "prefab", "military", "painted", "darkmetal"],
    ["factory", "military", "prefab", "concrete", "hazard", "darkmetal"],
    ["obsidian", "rusted", "factory", "darkmetal", "hazard"],
    ["ruin", "rusted", "concrete", "brick", "redbrick", "hazard"],
    ["organic", "obsidian", "darkmetal"],
  ],
  lE = {
    ruin: 0.5,
    adobe: 0.4,
    plaster: 0.35,
    sandstone: 0.4,
    cabin: 0.6,
    brick: 0.6,
    painted: 0.4,
    clinic: 0.3,
    terracotta: 0.4,
    barn: 0.5,
    redbrick: 0.55,
  },
  cE = ["rastrero", "corredor", "rastrero", "sanguijuela", "corredor", "aranamec", "avispa", "necrofago", "larva"];


// ════════ [453] FunctionDeclaration vx (17677 bytes) ════════
function vx(n = 7331) {
  let e = pi(n),
    t = Ii(n),
    i = Ii(n + 7),
    s = Ii(n + 13),
    a = Ii(n + 21),
    r = new Fa(np, np);
  ((r.kind = "world"), (r.seed = n));
  let o = np,
    l = {};
  for (let I of De) l[I.gx + "," + I.gz] = I.id;
  let c = [],
    d = (I, M, z, O, N = 2) => c.push([I - N, M - N, z + N, O + N]),
    h = (I, M, z, O) => c.some((N) => !(z < N[0] || I > N[2] || O < N[1] || M > N[3])),
    f = (I, M) => c.some((z) => I >= z[0] && I <= z[2] && M >= z[1] && M <= z[3]),
    u = 0,
    p = (I, M, z, O = {}) => {
      let N = { k: I, id: O.id || `${I}_${u++}`, x: M, z, ...O };
      return (r.ents.push(N), N);
    };
  for (let I = 0; I < o; I++)
    for (let M = 0; M < o; M++) {
      let z = I * o + M,
        O = l[Math.floor(M / qt) + "," + Math.floor(I / qt)];
      r.reg[z] = O;
      let N = t.fbm(M * 0.09, I * 0.09, 3);
      ((r.var[z] = Math.max(0, Math.min(3, Math.floor((N + 0.35) * 5)))), (r.ter[z] = F.GROUND));
      let Y = 1.6 + (i(M * 0.13, I * 0.13) + 0.5) * 1.8,
        V = !1;
      for (let he of [qt, qt * 2]) (Math.abs(M + 0.5 - he) < Y || Math.abs(I + 0.5 - he) < Y) && (V = !0);
      let j = 2.5 + (i(M * 0.11 + 50, I * 0.11) + 0.5) * 2;
      ((M < j || I < j || M > o - 1 - j || I > o - 1 - j) && (V = !0), V && (r.ter[z] = F.ROCK));
    }
  r.border = new Uint8Array(o * o);
  for (let I = 0; I < o * o; I++) r.ter[I] === F.ROCK && (r.border[I] = 1);
  let m = new Float32Array(o * o),
    g = new Float32Array(o * o),
    b = De.map(() => ({ l: [], r: [] }));
  for (let I = 0; I < o; I++)
    for (let M = 0; M < o; M++) {
      let z = I * o + M;
      ((m[z] = s.fbm(M * 0.05, I * 0.05, 4)),
        (g[z] = a.fbm(M * 0.075, I * 0.075, 3)),
        (M + I) % 3 === 0 && (b[r.reg[z]].l.push(m[z]), b[r.reg[z]].r.push(g[z])));
    }
  let y = b.map((I, M) => {
    (I.l.sort((O, N) => O - N), I.r.sort((O, N) => O - N));
    let z = De[M];
    return { l: z.liquid ? I.l[Math.floor(I.l.length * (1 - z.liqAmt))] : 9, r: I.r[Math.floor(I.r.length * 0.93)] };
  });
  for (let I = 0; I < o; I++)
    for (let M = 0; M < o; M++) {
      let z = I * o + M;
      if (r.ter[z] !== F.GROUND) continue;
      let O = De[r.reg[z]],
        N = y[r.reg[z]];
      if (O.liquid && m[z] > N.l) {
        r.ter[z] = O.liquid === "water" ? F.WATER : O.liquid === "lava" ? F.LAVA : O.liquid === "acid" ? F.ACID : F.ICE;
        continue;
      }
      g[z] > N.r && (r.ter[z] = F.ROCK);
    }
  let v = (I) => {
      let M = De[I];
      return [M.gx * qt, M.gz * qt, M.gx * qt + qt - 1, M.gz * qt + qt - 1];
    },
    _ = (I, M, z, O, N = F.GROUND) => {
      for (let Y = M; Y <= O; Y++) for (let V = I; V <= z; V++) !r.inb(V, Y) || r.border[r.idx(V, Y)] || r.set(V, Y, N);
    },
    A = (I, M, z, O = F.GROUND) => {
      for (let N = Math.floor(M - z); N <= M + z; N++)
        for (let Y = Math.floor(I - z); Y <= I + z; Y++)
          !r.inb(Y, N) || r.border[r.idx(Y, N)] || ((Y + 0.5 - I) ** 2 + (N + 0.5 - M) ** 2 <= z * z && r.set(Y, N, O));
    },
    T = (I, M, z, O = 300, N = null, Y = 7) => {
      let [V, j, he, be] = v(I),
        ye = null,
        K = -1 / 0;
      for (let le = 0; le < O; le++) {
        let ve = e.int(V + Y, he - Y - M),
          we = e.int(j + Y, be - Y - z);
        if (h(ve, we, ve + M - 1, we + z - 1)) continue;
        if (!N) return [ve, we];
        let W = N(ve + M / 2, we + z / 2);
        W > K && ((K = W), (ye = [ve, we]));
      }
      return ye;
    };
  r.gates = [];
  let S = (I, M, z) => {
    let O = De[I],
      N = De[M],
      Y,
      V,
      j;
    O.gz === N.gz
      ? ((Y = "x"), (V = Math.max(O.gx, N.gx) * qt), (j = O.gz * qt + qt / 2 + e.int(-24, 24)))
      : ((Y = "z"), (j = Math.max(O.gz, N.gz) * qt), (V = O.gx * qt + qt / 2 + e.int(-24, 24)));
    let he = [];
    for (let W = -9; W <= 8; W++)
      for (let Ue = -2; Ue <= 1; Ue++) {
        let X = Y === "x" ? V + W : V + Ue,
          q = Y === "x" ? j + Ue : j + W,
          ie = r.idx(X, q);
        r.border[ie] ? ((r.ter[ie] = F.GATE), he.push(ie), (r.border[ie] = 0)) : (r.ter[ie] = F.ROAD);
      }
    for (let W = -9; W <= 8; W++)
      for (let Ue of [-3, 2]) {
        let X = Y === "x" ? V + W : V + Ue,
          q = Y === "x" ? j + Ue : j + W,
          ie = r.idx(X, q);
        r.ter[ie] === F.GATE || he.includes(ie) || (Math.abs(W) < 4 && ((r.ter[ie] = F.ROCK), (r.border[ie] = 1)));
      }
    let be = V,
      ye = j,
      K = 7,
      le = Y === "x" ? [V + (O.gx < N.gx ? -K : K), j] : [V, j + (O.gz < N.gz ? -K : K)],
      ve = Y === "x" ? [V + (O.gx < N.gx ? K : -K), j] : [V, j + (O.gz < N.gz ? K : -K)];
    (A(le[0], le[1], 4),
      A(ve[0], ve[1], 4),
      d(le[0] - 4, le[1] - 4, le[0] + 4, le[1] + 4, 1),
      d(ve[0] - 4, ve[1] - 4, ve[0] + 4, ve[1] + 4, 1));
    let we = p("gate", be, ye, {
      id: `gate_${I}_${M}`,
      a: I,
      b: M,
      axis: Y,
      tiles: he,
      shortcut: !!z,
      sideA: le,
      sideB: ve,
    });
    return (r.gates.push(we), we);
  };
  for (let [I, M] of aE) S(I, M, !1);
  for (let [I, M] of rE) S(I, M, !0);
  let k = qt + qt / 2;
  A(k, k, 24);
  let w = k - 13,
    E = k + 13;
  d(w, w, E, E, 4);
  for (let I = w; I <= E; I++)
    for (let M = w; M <= E; M++) {
      let z = M === w || M === E || I === w || I === E,
        O = (Math.abs(M - k) <= 1 && (I === w || I === E)) || (Math.abs(I - k) <= 1 && (M === w || M === E));
      (r.set(M, I, z && !O ? F.WALL : F.BASE), (r.var[r.idx(M, I)] = Vn.base));
    }
  r.pois.base = { x: k + 0.5, z: k + 0.5, r: 16, n: "Basti\xF3n" };
  let H = {
    base_cmd: [k, k - 8],
    base_shop: [k - 8, k - 3],
    base_work: [k + 8, k - 3],
    base_lab: [k + 8, k + 6],
    base_med: [k - 8, k + 6],
    base_board: [k - 3, k + 2],
    base_ops: [k + 3, k + 9],
  };
  for (let [I, M] of Object.entries(zt))
    if (M.at.startsWith("base_")) {
      let [z, O] = H[M.at];
      p("npc", z + 0.5, O + 0.5, { id: "npc_" + I, npc: I });
    }
  (p("beacon", k + 0.5, k + 0.5, { id: "beacon_0", reg: 0, hub: !0, n: "Basti\xF3n" }),
    p("station", k - 8 + 0.5, k - 4.6, { st: "shop", npc: "vega" }),
    p("station", k + 8 + 0.5, k - 4.6, { st: "workbench", npc: "chispas" }),
    p("station", k + 9.8, k + 6.5, { st: "lab", npc: "lin" }),
    p("station", k - 3 + 0.5, k + 0.6, { st: "board", npc: "morales" }),
    p("station", k + 5.2, k + 9.5, { st: "deploy", npc: "navarro" }),
    p("station", k - 9.8, k + 6.5, { st: "medbay", npc: "sosa" }),
    p("station", k - 0.5, k - 9.6, { st: "table", npc: "reyes" }),
    p("helipad", k + 7.5, k + 11, {}),
    p("flag", k + 0.5, k - 4.5, {}));
  for (let [I, M] of [
    [w + 1, w + 1],
    [E - 1, w + 1],
    [w + 1, E - 1],
    [E - 1, E - 1],
  ])
    (p("allyturret", I + 0.5, M + 0.5, {}), (r.blk[r.idx(I, M)] = 1));
  for (let [I, M] of [
    [k - 5, k - 5],
    [k + 5, k - 5],
    [k - 5, k + 5],
    [k + 5, k + 5],
    [k, w + 2],
    [k, E - 2],
    [w + 2, k],
    [E - 2, k],
  ])
    p("light", I + 0.5, M + 0.5, { c: 16767136, model: "lamp" });
  let Z = [
    ["tent", k - 9, k - 9, 0],
    ["tent", k + 9, k - 9, 0],
    ["tent", k - 10, k + 10, 1],
    ["crates", k - 11, k - 1, 0],
    ["crates", k + 11, k - 1, 0],
    ["sandbags", k - 2, w - 1, 0],
    ["sandbags", k + 2, w - 1, 0],
    ["sandbags", k - 2, E + 1, 0],
    ["sandbags", k + 2, E + 1, 0],
    ["sandbags", w - 1, k - 2, 1],
    ["sandbags", w - 1, k + 2, 1],
    ["sandbags", E + 1, k - 2, 1],
    ["sandbags", E + 1, k + 2, 1],
    ["antenna", k - 11, k - 11, 0],
    ["generator", k + 11, k + 3, 0],
    ["barrel", k - 11, k + 3, 0],
    ["barrel", k - 11, k + 4, 0],
    ["crate", k + 11, k + 1, 0],
    ["radar", k + 11, k - 11, 0],
  ];
  for (let [I, M, z, O] of Z)
    (r.props.push({ t: I, x: M + 0.5, z: z + 0.5, s: 1, r: (O * Math.PI) / 2, blk: !0 }),
      r.inb(M, z) && (r.blk[r.idx(M, z)] = 1));
  let me = [],
    G = [];
  for (let I of De) {
    let M = I.id,
      [z, O, N, Y] = v(M),
      V = { r: M, buildings: [], hub: null };
    G.push(V);
    let j;
    if (M === 0) j = [k + 0.5, k + 16.5];
    else {
      let X = r.gates.find((ie) => !ie.shortcut && ie.b === M),
        q = X.sideB;
      ((j = [q[0] + (q[0] - X.x) * 0.9, q[1] + (q[1] - X.z) * 0.9]),
        (j = [Math.max(z + 8, Math.min(N - 8, j[0])), Math.max(O + 8, Math.min(Y - 8, j[1]))]),
        A(j[0], j[1], 4),
        d(j[0] - 3, j[1] - 3, j[0] + 3, j[1] + 3),
        p("beacon", j[0], j[1], { id: "beacon_" + M, reg: M, n: I.n }));
    }
    V.hub = j;
    let he = (X, q) => Math.hypot(X - j[0], q - j[1]);
    for (let X of r.gates) (X.a === M || X.b === M) && me.push([j, X.a === M ? X.sideA : X.sideB, M]);
    let be = T(M, 21, 21, 400, (X, q) => he(X, q) + e() * 5, 6);
    if (be) {
      let X = be[0] + 10.5,
        q = be[1] + 10.5;
      (d(be[0], be[1], be[0] + 20, be[1] + 20, 1), A(X, q, 10.5), A(X, q, 8.5, F.ARENA));
      for (let ie = 0; ie < 16; ie++) {
        if (ie % 4 === 0) continue;
        let Te = (ie / 16) * Math.PI * 2,
          pe = X + Math.cos(Te) * 9.6,
          C = q + Math.sin(Te) * 9.6;
        (r.props.push({ t: "pillar", x: Math.floor(pe) + 0.5, z: Math.floor(C) + 0.5, s: 1, r: Te, blk: !0, reg: M }),
          (r.blk[r.idx(Math.floor(pe), Math.floor(C))] = 1));
      }
      (p("bossarena", X, q, { id: "arena_" + M, reg: M, boss: I.boss, lvl: I.bossLvl, rad: 8.5 }),
        (r.pois["arena_" + M] = { x: X, z: q, r: 9, n: "Guarida: " + I.n }),
        me.push([j, [X + 10.5 * Math.sign(j[0] - X || 1), q], M]));
    }
    let ye = Object.entries(zt).filter(([X, q]) => q.reg === M && q.at === "camp");
    if (ye.length) {
      let X = T(M, 11, 11, 300, (q, ie) => -Math.abs(he(q, ie) - 22) + e() * 4);
      if (X) {
        let q = X[0] + 5.5,
          ie = X[1] + 5.5;
        (d(X[0], X[1], X[0] + 10, X[1] + 10, 1),
          A(q, ie, 6.5),
          p("campfire", q, ie, { reg: M }),
          (r.blk[r.idx(Math.floor(q), Math.floor(ie))] = 1),
          p("light", q, ie + 0.01, { c: 16751168, model: "none", flicker: !0 }),
          ye.forEach(([pe], C) => {
            let R = (C / ye.length) * Math.PI * 2 + 0.6;
            p("npc", q + Math.cos(R) * 2.6, ie + Math.sin(R) * 2.6, { id: "npc_" + pe, npc: pe });
          }));
        let Te = [
          [-4, -4],
          [4, -4],
          [-4, 4],
        ];
        for (let [pe, C] of Te)
          (r.props.push({
            t: "tent",
            x: Math.floor(q + pe) + 0.5,
            z: Math.floor(ie + C) + 0.5,
            s: 0.85,
            r: e() * 6,
            blk: !0,
          }),
            (r.blk[r.idx(Math.floor(q + pe), Math.floor(ie + C))] = 1));
        (r.props.push({ t: "crates", x: Math.floor(q + 4) + 0.5, z: Math.floor(ie + 4) + 0.5, s: 1, r: 0, blk: !0 }),
          (r.blk[r.idx(Math.floor(q + 4), Math.floor(ie + 4))] = 1),
          (r.pois["camp_" + M] = { x: q, z: ie, r: 7, n: "Campamento" }),
          me.push([j, [q, ie + 6], M]));
      }
    }
    for (let X = 0; X < ([0, 2, 4, 6, 7].includes(M) ? 2 : [3, 1, 5].includes(M) ? 1 : 0); X++) {
      let q = T(M, 22, 22, 200, (ie, Te) => e() + he(ie, Te) / 40);
      if (q) {
        let ie = pE(r, q[0], q[1], 22, e, M);
        (d(q[0], q[1], q[0] + 21, q[1] + 21, 0), me.push([j, ie.entrance, M]));
        for (let Te of ie.ents) p(Te.k, Te.x, Te.z, { ...Te, id: `${Te.k}_${M}_cave${X || ""}_${Te.n ?? 0}`, reg: M });
        r.pois["cave_" + M + (X ? "_" + X : "")] = { x: q[0] + 11, z: q[1] + 11, r: 10, n: "Cueva" };
      }
    }
    let K = oE[M] || [I.build],
      le = M === 1 ? 21 : M === 5 ? 18 : M === 8 ? 12 : 15;
    for (let X = 0; X < le; X++) {
      let q = e(),
        ie = q < 0.3,
        Te = !ie && q > 0.8,
        pe = ie ? e.int(14, 22) : Te ? e.int(6, 8) : e.int(8, 13),
        C = ie ? e.int(12, 18) : Te ? e.int(6, 8) : e.int(7, 12),
        R = T(M, pe + 8, C + 8, 200, (Fe, rt) => e() + (he(Fe, rt) > 14 ? 1 : 0));
      if (!R) continue;
      let ne = R[0] + 4,
        re = R[1] + 4,
        fe = M === 0 && X === 0,
        ge = fe ? "bunker" : X === 0 ? I.build : K[Math.floor(e() * K.length)],
        Pe = e(),
        Ce = Te
          ? Pe < 0.5
            ? "tower"
            : "rect"
          : pe >= 12 && C >= 12 && Pe < 0.14
            ? "court"
            : pe >= 11 && Pe < 0.26
              ? "U"
              : pe >= 11 && C >= 9 && Pe < 0.36
                ? "T"
                : pe >= 12 && C >= 12 && Pe < 0.46
                  ? "cross"
                  : pe >= 10 && C >= 10 && Pe < 0.56
                    ? "octo"
                    : pe >= 13 && Pe < 0.64
                      ? "twin"
                      : ie &&
                          Pe < 0.74 &&
                          [
                            "factory",
                            "military",
                            "concrete",
                            "prefab",
                            "hazard",
                            "darkmetal",
                            "olive",
                            "barn",
                          ].includes(ge)
                        ? "hangar"
                        : Pe < 0.84
                          ? "L"
                          : "rect",
        ze = dE(
          r,
          ne,
          re,
          pe,
          C,
          ge,
          e,
          X === 1 || fe || (X === 2 && M >= 4) || (X === 5 && M >= 2),
          M,
          fe ? "bunker7" : null,
          Ce,
        );
      (d(R[0], R[1], R[0] + pe + 7, R[1] + C + 7, 0), V.buildings.push(ze));
      for (let Fe of ze.doors) me.push([j, Fe.out, M]);
      if (!fe && X > 0 && ze.inner.length && e() < (Te ? 0.8 : 0.5)) {
        let Fe = hE(r, ze, e);
        if (Fe) {
          let rt = Ce === "tower" || (e() < 0.4 && !["shack", "organic", "obsidian"].includes(ge));
          (ze.ents.push({
            k: "stairs",
            x: Fe[0] + 0.5,
            z: Fe[1] + 0.5,
            n: "st",
            kind: rt ? "upper" : "basement",
            bstyle: Vn[ge] ?? 0,
            enc: ip(rt ? "upper" : "basement", e),
          }),
            (r.blk[r.idx(Fe[0], Fe[1])] = 1));
        }
      }
      for (let Fe of ze.ents) p(Fe.k, Fe.x, Fe.z, { ...Fe, id: `${Fe.k}_${M}_b${X}_${Fe.n ?? 0}`, reg: M });
      fe && (r.pois.bunker7 = { x: ne + pe / 2, z: re + C / 2, r: Math.max(pe, C) / 2, n: "B\xFAnker 7" });
    }
    if (
      ([
        ["village", "outpost", "station", "junkyard", "village"],
        ["village", "outpost", "junkyard", "village", "station"],
        ["station", "village", "wreck", "outpost", "village"],
        ["village", "junkyard", "wreck", "outpost", "station"],
        ["station", "outpost", "wreck", "village", "junkyard"],
        ["station", "outpost", "junkyard", "station", "wreck"],
        ["outpost", "junkyard", "wreck", "station", "wreck"],
        ["junkyard", "wreck", "station", "outpost", "village"],
        ["wreck", "station", "wreck", "outpost", "wreck"],
      ][M].forEach((X, q) => {
        let ie = X === "village" ? 26 : 22,
          Te = T(M, ie, ie, 250, (re, fe) => -Math.abs(he(re, fe) - (30 + q * 24)) + e() * 14, 8);
        if (!Te) return;
        let pe = Te[0] + ie / 2,
          C = Te[1] + ie / 2;
        (d(Te[0], Te[1], Te[0] + ie - 1, Te[1] + ie - 1, 1), A(pe, C, ie / 2 - 0.5));
        let R = (re, fe, ge, Pe = !0, Ce = 1) => {
            let ze = Math.floor(fe),
              Fe = Math.floor(ge);
            !r.inb(ze, Fe) ||
              Ua[r.ter[r.idx(ze, Fe)]] ||
              r.blk[r.idx(ze, Fe)] ||
              (r.props.push({ t: re, x: ze + 0.5, z: Fe + 0.5, s: Ce, r: e() * 6.28, blk: Pe, reg: M }),
              Pe && (r.blk[r.idx(ze, Fe)] = 1));
          },
          ne = {
            village: "Asentamiento",
            outpost: "Puesto avanzado",
            station: "Estaci\xF3n de investigaci\xF3n",
            junkyard: "Desguace",
            wreck: "Nave estrellada",
          };
        if (X === "village") {
          A(pe, C, 4.5, F.ROAD);
          let re = ["st_house", "st_house2", "st_long", "st_cyl", "st_house"],
            fe = e.int(4, 6);
          for (let ge = 0; ge < fe; ge++) {
            let Pe = (ge / fe) * Math.PI * 2 + e() * 0.3,
              Ce = re[Math.floor(e() * re.length)],
              ze = 9 + e() * 1.5;
            Ba(r, Ce, pe + Math.cos(Pe) * ze, C + Math.sin(Pe) * ze, Math.round((Pe + Math.PI) / (Math.PI / 2)) % 4, M);
          }
          for (let ge = 0; ge < 4; ge++)
            p("light", pe + (ge % 2 ? 3.5 : -3.5), C + (ge < 2 ? 3.5 : -3.5), { c: 16767136, model: "lamp" });
          (R("crates", pe + 2, C - 5),
            R("barrel", pe - 5, C + 2),
            R("barrel", pe - 5, C + 3),
            p("chest", pe, C + 1.5, { id: `chest_${M}_set${q}`, tier: 1 + (e() < 0.3 ? 1 : 0) }),
            p("spawnpack", pe + 1, C - 1, { id: `sp_${M}_set${q}`, size: 4 }));
        } else if (X === "station") {
          Ba(r, e() < 0.5 ? "st_dome" : "st_base", pe - 3, C - 2, 0, M);
          for (let re = 0; re < 3; re++) Ba(r, "st_solar", pe + 6, C - 6 + re * 4.2, 0, M);
          for (let re = 0; re < 4; re++) Ba(r, "st_panel", pe - 7 + re * 2, C + 7, 0, M);
          (R("antenna", pe - 8, C - 8),
            R("radar", pe + 2, C + 6),
            R("generator", pe - 1, C + 4),
            Ba(r, "st_rover", pe + 1, C + 9, 1, M),
            p("terminal", pe + 2, C + 2.5, {
              id: `term_${M}_st${q}`,
              reg: M,
              eff: "relay",
              diff: Math.min(3, 1 + Math.floor(M / 3)),
            }),
            p("light", pe + 2, C + 1, { c: 10543359, model: "none" }),
            p("spawnpack", pe - 4, C + 5, { id: `sp_${M}_set${q}`, size: 4 }),
            p("chest", pe - 2, C + 6, { id: `chest_${M}_set${q}`, tier: 2 }));
        } else if (X === "wreck") {
          for (let re = Math.floor(C - 9); re <= C + 9; re++)
            for (let fe = Math.floor(pe - 9); fe <= pe + 9; fe++) {
              let ge = Math.hypot(fe + 0.5 - pe, re + 0.5 - C);
              ge > 7.5 &&
                ge < 9 &&
                e() < 0.45 &&
                r.inb(fe, re) &&
                !r.border[r.idx(fe, re)] &&
                (r.ter[r.idx(fe, re)] = F.ROCK);
            }
          Ba(r, "st_ship", pe, C, e() < 0.5 ? 0 : 1, M);
          for (let re = 0; re < 6; re++) {
            let fe = e() * 6.28,
              ge = 4 + e() * 3;
            R(e() < 0.5 ? "rubble_s" : "crate", pe + Math.cos(fe) * ge, C + Math.sin(fe) * ge, e() < 0.5);
          }
          for (let re = 0; re < 2; re++)
            p("light", pe + (re ? 3 : -3), C + 3, { c: 16742960, model: "none", flicker: !0 });
          (p("chest", pe + 4, C - 4, { id: `chest_${M}_set${q}`, tier: 2 }),
            p("spawnpack", pe - 3, C + 4, { id: `sp_${M}_set${q}`, big: !0 }),
            p("datapad", pe + 5, C + 1, { id: `dp_${M}_w${q}`, reg: M }));
        } else if (X === "outpost") {
          Ba(r, "st_lbld", pe - 2, C - 2, Math.floor(e() * 4), M);
          for (let re = 0; re < 14; re++) {
            let fe = (re / 14) * Math.PI * 2;
            re % 5 !== 0 && R("sandbags", pe + Math.cos(fe) * 9.5, C + Math.sin(fe) * 9.5);
          }
          (R("tent", pe + 6, C + 4),
            R("generator", pe + 5, C - 5),
            R("crates", pe - 6, C + 5),
            R("antenna", pe + 7, C - 1),
            p("light", pe + 3, C + 3, { c: 16767136, model: "lamp" }),
            p("spawnpack", pe + 3, C + 6, { id: `sp_${M}_set${q}`, size: 5 }),
            p("chest", pe - 5, C + 6, { id: `chest_${M}_set${q}`, tier: 1 }));
        } else {
          for (let re = 0; re < 7; re++) {
            let fe = e() * 6.28,
              ge = 2 + e() * 7,
              Pe = e() < 0.35 ? "st_rover" : null;
            Pe
              ? Ba(r, Pe, pe + Math.cos(fe) * ge, C + Math.sin(fe) * ge, Math.floor(e() * 4), M)
              : R(e() < 0.5 ? "car" : "tank_wreck", pe + Math.cos(fe) * ge, C + Math.sin(fe) * ge);
          }
          for (let re = 0; re < 6; re++) {
            let fe = e() * 6.28,
              ge = 3 + e() * 6;
            R(e() < 0.5 ? "barrel" : "barrel_toxic", pe + Math.cos(fe) * ge, C + Math.sin(fe) * ge);
          }
          (p("spawnpack", pe, C, { id: `sp_${M}_set${q}`, size: 5 }),
            p("chest", pe + 1, C + 2, { id: `chest_${M}_set${q}`, tier: 1 }));
        }
        ((r.pois[`set_${M}_${q}`] = { x: pe, z: C, r: ie / 2, n: ne[X] }), me.push([j, [pe, C + ie / 2 - 1], M]));
      }),
      I.secret)
    ) {
      let X = T(M, 15, 15, 300, (q, ie) => he(q, ie) * 0.6 + e() * 10);
      if (X) {
        let q = X[0] + 7.5,
          ie = X[1] + 7.5;
        (d(X[0], X[1], X[0] + 14, X[1] + 14, 1), A(q, ie, 7), A(q, ie, 5.5, F.ARENA));
        for (let Te = 0; Te < 6; Te++) {
          let pe = (Te / 6) * Math.PI * 2,
            C = Math.floor(q + Math.cos(pe) * 6.2),
            R = Math.floor(ie + Math.sin(pe) * 6.2);
          (r.props.push({ t: "obelisk", x: C + 0.5, z: R + 0.5, s: 1, r: pe, blk: !0, reg: M }),
            (r.blk[r.idx(C, R)] = 1));
        }
        (p("terminal", q, ie - 3.5, {
          id: `term_${M}_boss`,
          reg: M,
          eff: "boss",
          boss: I.secret,
          lvl: I.bossLvl + 3,
          diff: 3,
        }),
          p("bossarena", q, ie + 0.5, {
            id: "secret_" + M,
            reg: M,
            boss: I.secret,
            lvl: I.bossLvl + 3,
            rad: 5.5,
            secret: !0,
          }),
          (r.pois["altar_" + M] = { x: q, z: ie, r: 7, n: "Altar antiguo" }),
          me.push([j, [q, ie + 7.5], M]));
      }
    }
    let we = T(M, 7, 7, 200, (X, q) => -Math.abs(he(X, q) - 26) + e() * 6);
    if (we) {
      let X = we[0] + 3.5,
        q = we[1] + 3.5;
      (A(X, q, 3.5),
        d(we[0], we[1], we[0] + 6, we[1] + 6, 1),
        p("breach", X, q, { id: "breach_" + M, reg: M }),
        me.push([j, [X, q + 3], M]));
    }
    for (let X = 0; X < 3; X++) {
      let q = T(M, 5, 5, 200);
      if (!q) continue;
      let ie = q[0] + 2.5,
        Te = q[1] + 2.5;
      (A(ie, Te, 2.5),
        d(q[0], q[1], q[0] + 4, q[1] + 4, 1),
        X !== 2
          ? p("terminal", ie, Te, {
              id: `term_${M}_relay${X}`,
              reg: M,
              eff: "relay",
              diff: Math.min(3, 1 + Math.floor(M / 3)),
            })
          : (p("terminal", ie, Te - 1, {
              id: `term_${M}_cache`,
              reg: M,
              eff: "cache",
              diff: Math.min(3, 1 + Math.floor(M / 3)),
            }),
            p("lockbox", ie, Te + 1.2, { id: `lock_${M}`, reg: M }),
            (r.blk[r.idx(Math.floor(ie), Math.floor(Te + 1.2))] = 1)),
        me.push([j, [ie, Te], M]));
    }
    for (let X = 0; X < 3; X++) {
      let q = T(M, 11, 11, 200, (C, R) => e() * 4 + (he(C, R) > 25 ? 3 : 0));
      if (!q) continue;
      let ie = q[0] + 5.5,
        Te = q[1] + 5.5;
      d(q[0], q[1], q[0] + 10, q[1] + 10, 0);
      let pe = uE(r, ie, Te, e);
      (p("stairs", pe.x, pe.z, {
        id: `stairs_${M}_cave${X}`,
        reg: M,
        kind: M === 8 ? "hive" : "cave",
        enc: ip("cave", e),
      }),
        me.push([j, pe.door, M]),
        (r.pois[`cavem_${M}_${X}`] = { x: ie, z: Te, r: 5, n: "Gruta" }));
    }
    for (let X = 0; X < 2; X++) {
      let q = T(M, 7, 7, 200, (C, R) => e() * 4 + (he(C, R) > 20 ? 2 : 0));
      if (!q) continue;
      let ie = q[0] + 3.5,
        Te = q[1] + 3.5;
      (d(q[0], q[1], q[0] + 6, q[1] + 6, 0), A(ie, Te, 3));
      let pe = [1, 7, 3].includes(M) && X === 0;
      if (!pe)
        for (let C = 0; C < 10; C++) {
          if (C === 2 || C === 7) continue;
          let R = (C / 10) * 6.283,
            ne = Math.floor(ie + Math.cos(R) * 2.6),
            re = Math.floor(Te + Math.sin(R) * 2.6);
          r.blk[r.idx(ne, re)] ||
            (r.props.push({ t: "sandbags", x: ne + 0.5, z: re + 0.5, s: 0.8, r: R + Math.PI / 2, blk: !0, reg: M }),
            (r.blk[r.idx(ne, re)] = 1));
        }
      (p("stairs", Math.floor(ie) + 0.5, Math.floor(Te) + 0.5, {
        id: `stairs_${M}_hatch${X}`,
        reg: M,
        kind: pe ? "sewer" : "hatch",
        enc: ip(pe ? "sewer" : "hatch", e),
      }),
        (r.blk[r.idx(Math.floor(ie), Math.floor(Te))] = 1),
        me.push([j, [ie, Te + 3], M]));
    }
    let W = (X = 2, q = 10) => {
      for (let ie = 0; ie < 200; ie++) {
        let Te = e.int(z + 6, N - 6),
          pe = e.int(O + 6, Y - 6);
        if (he(Te, pe) < q || (M === 0 && Math.hypot(Te - k, pe - k) < 30) || f(Te, pe)) continue;
        let C = !0;
        for (let R = -X; R <= X && C; R++)
          for (let ne = -X; ne <= X; ne++) {
            let re = r.t(Te + ne, pe + R);
            if (re !== F.GROUND && re !== F.ROAD) {
              C = !1;
              break;
            }
          }
        if (C) return [Te, pe];
      }
      return null;
    };
    for (let X = 0; X < 8; X++) {
      let q = W(2, 18);
      q &&
        (p("nest", q[0] + 0.5, q[1] + 0.5, { id: `nest_${M}_${X}`, reg: M, spawn: cE[M] }),
        d(q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2, 0));
    }
    for (let X = 0; X < 3; X++) {
      let q = W(1, 12);
      q &&
        (p("shrine", q[0] + 0.5, q[1] + 0.5, { id: `shrine_${M}_${X}`, reg: M }),
        (r.blk[r.idx(q[0], q[1])] = 1),
        d(q[0] - 1, q[1] - 1, q[0] + 1, q[1] + 1, 0));
    }
    let Ue = 0;
    for (let X of V.buildings) {
      if (Ue >= 2) break;
      let q = X.inner[Math.floor(e() * X.inner.length)];
      q && (p("datapad", q[0] + 0.5, q[1] + 0.5, { id: `dp_${M}_${Ue}`, reg: M }), Ue++);
    }
    for (; Ue < 3;) {
      let X = W(0, 8);
      if (!X) break;
      (p("datapad", X[0] + 0.5, X[1] + 0.5, { id: `dp_${M}_${Ue}`, reg: M }), d(X[0], X[1], X[0], X[1], 0), Ue++);
    }
    for (let X = 0; X < 6; X++) {
      let q = W(1, 10);
      q &&
        (p("crystal", q[0] + 0.5, q[1] + 0.5, { id: `cry_${M}_${X}`, reg: M }),
        (r.blk[r.idx(q[0], q[1])] = 1),
        d(q[0], q[1], q[0], q[1], 0));
    }
    for (let X = 0; X < 9; X++) {
      let q = W(1, 6);
      q && (p("crate", q[0] + 0.5, q[1] + 0.5, { id: `crate_${M}_${X}`, reg: M }), (r.blk[r.idx(q[0], q[1])] = 1));
    }
    if (M === 5)
      for (let X = 0; X < 9; X++) {
        let q = W(1, 14);
        q && p("spawnpt", q[0] + 0.5, q[1] + 0.5, { e: "torreta", reg: M });
      }
    if (M === 8)
      for (let X = 0; X < 9; X++) {
        let q = W(1, 14);
        q && p("spawnpt", q[0] + 0.5, q[1] + 0.5, { e: "cristalino", reg: M });
      }
    if (M === 1)
      for (let X = 0; X < 5; X++) {
        let q = W(1, 14);
        q && p("spawnpt", q[0] + 0.5, q[1] + 0.5, { e: "torreta", reg: M });
      }
  }
  (me.push([[k + 0.5, k + 14.5], [k + 0.5, k + 16.5], 0]),
    me.push([[k + 0.5, w - 1], [k + 0.5, w - 6], 0]),
    me.push([[w - 1, k + 0.5], [w - 6, k + 0.5], 0]),
    me.push([[E + 1, k + 0.5], [E + 6, k + 0.5], 0]));
  let L = {};
  for (let [I, M, z] of me) (L[z] || (L[z] = { hub: I, pts: [] })).pts.push(M);
  for (let I in L) {
    let { hub: M, pts: z } = L[I],
      O = [M, ...z],
      N = [0],
      Y = O.map((V, j) => j).slice(1);
    for (; Y.length;) {
      let V = -1,
        j = -1,
        he = 1 / 0;
      for (let be of N)
        for (let ye of Y) {
          let K = Math.hypot(O[be][0] - O[ye][0], O[be][1] - O[ye][1]);
          K < he && ((he = K), (V = be), (j = ye));
        }
      (mE(r, O[V], O[j], e, (he > 25, 1)), N.push(j), Y.splice(Y.indexOf(j), 1));
    }
  }
  gE(r, k, k + 15);
  let B = Ii(n + 99);
  for (let I = 1; I < o - 1; I++)
    for (let M = 1; M < o - 1; M++) {
      let z = I * o + M;
      if (r.ter[z] !== F.GROUND || r.blk[z] || f(M, I)) continue;
      let O = !1;
      for (let he = -1; he <= 1 && !O; he++)
        for (let be = -1; be <= 1; be++) {
          let ye = r.t(M + be, I + he);
          if (ye === F.ROAD || ye === F.GATE || ye === F.DOOR) {
            O = !0;
            break;
          }
        }
      let N = De[r.reg[z]],
        Y = B.fbm(M * 0.045, I * 0.045, 3),
        V = 0.02 + Math.max(0, Y) * 0.5,
        j = !1;
      for (let he = -1; he <= 1 && !j; he++)
        for (let be = -1; be <= 1; be++)
          if (r.blk[z + he * o + be]) {
            j = !0;
            break;
          }
      if (!O && !j && e() < V) {
        let he = N.props.reduce((K, le) => K + le[1], 0),
          be = e() * he,
          ye = N.props[0];
        for (let K of N.props)
          if (((be -= K[1]), be <= 0)) {
            ye = K;
            break;
          }
        (r.props.push({
          t: ye[0],
          x: M + 0.3 + e() * 0.4,
          z: I + 0.3 + e() * 0.4,
          s: 0.8 + e() * 0.5,
          r: e() * Math.PI * 2,
          blk: !!ye[2],
          reg: N.id,
        }),
          ye[2] && (r.blk[z] = 1));
      } else if (
        e() < (N.key === "valle" || N.key === "marisma" ? 0.32 : N.key === "colmena" || N.key === "tundra" ? 0.2 : 0.14)
      ) {
        let he = N.decor.reduce((K, le) => K + le[1], 0),
          be = e() * he,
          ye = N.decor[0];
        for (let K of N.decor)
          if (((be -= K[1]), be <= 0)) {
            ye = K;
            break;
          }
        r.decor.push({ t: ye[0], x: M + e(), z: I + e(), s: 0.7 + e() * 0.6, r: e() * 6.28, reg: N.id });
      }
    }
  return ((r.spawnBase = [k + 0.5, k + 3.5]), r);
}


// ════════ [454] FunctionDeclaration dE (8414 bytes) ════════
function dE(n, e, t, i, s, a, r, o, l, c, d = "rect") {
  let h = Vn[a] ?? 0,
    f = e + i - 1,
    u = t + s - 1,
    p = a === "bunker" || r() < (lE[a] ?? 0.85),
    m = { x0: e, z0: t, x1: f, z1: u, doors: [], ents: [], inner: [] };
  o && (d = "rect");
  let g = (M, z) => {
      if (M < e || M > f || z < t || z > u) return !1;
      let O = M - e,
        N = z - t;
      if (d === "L") return !(O >= Math.floor(i * 0.55) && N >= Math.floor(s * 0.55));
      if (d === "court") return !(O >= 4 && O <= i - 1 - 4 && N >= 4 && N <= s - 1 - 4);
      if (d === "U") return !(O >= 4 && O <= i - 5 && N >= Math.floor(s * 0.45));
      if (d === "T")
        return N < Math.max(5, Math.floor(s * 0.48)) || Math.abs(O - (i - 1) / 2) <= Math.max(2.5, Math.floor(i * 0.2));
      if (d === "cross")
        return (
          Math.abs(O - (i - 1) / 2) <= Math.max(2.5, Math.floor(i * 0.22)) ||
          Math.abs(N - (s - 1) / 2) <= Math.max(2.5, Math.floor(s * 0.22))
        );
      if (d === "octo") {
        let Y = Math.floor(Math.min(i, s) * 0.3);
        return !(O + N < Y || i - 1 - O + N < Y || O + (s - 1 - N) < Y || i - 1 - O + (s - 1 - N) < Y);
      }
      if (d === "twin") {
        let Y = Math.floor(i * 0.38),
          V = i - 1 - Y;
        return O <= Y || O >= V || Math.abs(N + 0.5 - s / 2) <= 2;
      }
      return !0;
    },
    b =
      {
        painted: 1.5,
        redbrick: 1.8,
        clinic: 1.4,
        olive: 1.5,
        hazard: 2.2,
        darkmetal: 2,
        terracotta: 1.3,
        barn: 1.6,
        factory: 2.4,
        military: 1.6,
        concrete: 2,
        prefab: 1.2,
        cabin: 1.1,
        shack: 0.9,
        adobe: 1.2,
        sandstone: 1.5,
        brick: 1.7,
        plaster: 1.4,
        rusted: 1.3,
        obsidian: 2.2,
        organic: 1.8,
        bunker: 1.4,
        ruin: 1.5,
      }[a] ?? 1.3,
    y = Math.max(0.8, b * (0.85 + r() * 0.35)) * (d === "tower" ? 1.9 : d === "hangar" ? 1.3 : 1),
    v = a === "ruin" || a === "obsidian" || (a === "brick" && l === 7);
  for (let M = t; M <= u; M++)
    for (let z = e; z <= f; z++) {
      if (!g(z, M)) continue;
      let O = n.idx(z, M),
        N = !1;
      for (let Y = -1; Y <= 1 && !N; Y++)
        for (let V = -1; V <= 1; V++)
          if (!g(z + V, M + Y)) {
            N = !0;
            break;
          }
      ((n.ter[O] = N ? F.WALL : F.FLOOR),
        (n.var[O] = h),
        (n.blk[O] = 0),
        (n.wh[O] = N ? Math.round((v ? y * (0.35 + r() * 0.75) : y) * 10) : 0),
        p && (n.dark[O] = 1));
    }
  for (let M = t - 2; M <= u + 2; M++)
    for (let z = e - 2; z <= f + 2; z++) {
      if (g(z, M)) continue;
      let O = n.idx(z, M);
      !n.inb(z, M) || n.border[O] || (n.ter[O] !== F.ROAD && (n.ter[O] = F.GROUND), (n.blk[O] = 0), (n.dark[O] = 0));
    }
  let _ = [];
  for (let M = t; M <= u; M++)
    for (let z = e; z <= f; z++) {
      let O = n.idx(z, M);
      if (n.ter[O] === F.WALL)
        for (let [N, Y, V] of [
          [0, -1, "n"],
          [0, 1, "s"],
          [-1, 0, "w"],
          [1, 0, "e"],
        ]) {
          if (g(z + N, M + Y) || !g(z - N, M - Y) || n.ter[n.idx(z - N, M - Y)] !== F.FLOOR) continue;
          let j = Y !== 0 ? 1 : 0,
            he = N !== 0 ? 1 : 0,
            be = z + j,
            ye = M + he;
          if (n.ter[n.idx(be, ye)] !== F.WALL || g(be + N, ye + Y) || n.ter[n.idx(be - N, ye - Y)] !== F.FLOOR)
            continue;
          let K = (V === "n" && M === t) || (V === "s" && M === u) || (V === "w" && z === e) || (V === "e" && z === f);
          _.push({ s: V, x: z, z: M, x2: be, z2: ye, dx: N, dz: Y, outer: K });
        }
    }
  let A = d === "court" ? 3 : d === "rect" && r() < 0.5 ? 1 : 2,
    T = [];
  for (let M = 0; M < A && _.length; M++) {
    let z = _.filter((Y) => Y.outer && !T.some((V) => V.s === Y.s)),
      O = z.length ? z : _.filter((Y) => !T.includes(Y));
    if (!O.length) break;
    let N = O[Math.floor(r() * O.length)];
    T.push(N);
    for (let [Y, V] of [
      [N.x, N.z],
      [N.x2, N.z2],
    ]) {
      let j = n.idx(Y, V);
      ((n.ter[j] = F.DOOR), (n.var[j] = h), (n.wh[j] = 0));
    }
    m.doors.push({
      s: N.s,
      x: N.x,
      z: N.z,
      out: [N.x + N.dx * 2 + (N.dz !== 0 ? 0.5 : 0), N.z + N.dz * 2 + (N.dx !== 0 ? 0.5 : 0)],
    });
  }
  if (d === "court") {
    let M = _.filter((z) => !z.outer);
    if (M.length) {
      let z = M[Math.floor(r() * M.length)];
      for (let [O, N] of [
        [z.x, z.z],
        [z.x2, z.z2],
      ])
        ((n.ter[n.idx(O, N)] = F.DOOR), (n.wh[n.idx(O, N)] = 0));
    }
  }
  let S = m.doors.map((M) => M.s),
    k = ["n", "s", "w", "e"];
  if (v)
    for (let M = t; M <= u; M++)
      for (let z = e; z <= f; z++) {
        let O = n.idx(z, M);
        n.ter[O] === F.WALL &&
          r() < 0.1 &&
          !((z === e || z === f) && (M === t || M === u)) &&
          ((n.ter[O] = F.FLOOR), (n.wh[O] = 0));
      }
  let w = (M, z) => {
      for (let O = -1; O <= 1; O++)
        for (let N = -1; N <= 1; N++) {
          let Y = n.t(M + N, z + O);
          if (Y === F.DOOR || Y === F.SECRET) return !0;
        }
      return !1;
    },
    E = (M, z) => {
      let O = n.idx(M, z);
      ((n.ter[O] = F.WALL), (n.wh[O] = Math.round(y * 10)));
    },
    H = (M, z, O, N, Y) => {
      let V = O - M + 1,
        j = N - z + 1;
      if (Y > 3) return;
      let he = V >= 10,
        be = j >= 10;
      if ((!he && !be) || (Y > 0 && V * j < 110 && r() < 0.5)) return;
      let ye = he && (!be || V > j || (V === j && r() < 0.5)),
        K = (le, ve, we, W) => {
          let Ue = [],
            X = () => {
              if (Ue.length) {
                let q = Ue.length >= 4 ? Ue[1 + Math.floor(r() * (Ue.length - 3))] : Ue[0];
                for (let ie of Ue) ie !== q && ie !== q + 1 && (W ? E(le, ie) : E(ie, le));
                Ue = [];
              }
            };
          for (let q = ve; q <= we; q++) {
            let ie = W ? le : q,
              Te = W ? q : le;
            n.ter[n.idx(ie, Te)] === F.FLOOR && !w(ie, Te) ? Ue.push(q) : X();
          }
          X();
        };
      if (ye) {
        let le = M + 4 + Math.floor(r() * Math.max(1, V - 8));
        (K(le, z, N, !0), H(M, z, le - 1, N, Y + 1), H(le + 1, z, O, N, Y + 1));
      } else {
        let le = z + 4 + Math.floor(r() * Math.max(1, j - 8));
        (K(le, M, O, !1), H(M, z, O, le - 1, Y + 1), H(M, le + 1, O, N, Y + 1));
      }
    };
  if (d === "hangar") {
    for (let M = t + 3; M <= u - 3; M += 4)
      for (let z = e + 3; z <= f - 3; z += 4)
        if (n.ter[n.idx(z, M)] === F.FLOOR && !w(z, M)) {
          let O = n.idx(z, M);
          ((n.ter[O] = F.WALL), (n.wh[O] = Math.round(y * 10)));
        }
  } else if (d === "twin") {
    let M = Math.floor(i * 0.38);
    (H(e + 1, t + 1, e + M - 1, u - 1, 1), H(f - M + 1, t + 1, f - 1, u - 1, 1));
  } else d !== "court" && d !== "tower" && r() < 0.85 && H(e + 1, t + 1, f - 1, u - 1, 0);
  let Z = null;
  if (o) {
    let M = k.filter((W) => !S.includes(W));
    Z = M[Math.floor(r() * M.length)] || "n";
    let z,
      O,
      N,
      Y,
      V,
      j,
      he,
      be = 6;
    Z === "n"
      ? ((z = e + Math.floor(i / 2) - 3),
        (N = z + be - 1),
        (Y = t),
        (O = t - 5),
        (V = e + Math.floor(i / 2) - 1),
        (j = t),
        (he = !0))
      : Z === "s"
        ? ((z = e + Math.floor(i / 2) - 3),
          (N = z + be - 1),
          (O = u),
          (Y = u + 5),
          (V = e + Math.floor(i / 2) - 1),
          (j = u),
          (he = !0))
        : Z === "w"
          ? ((O = t + Math.floor(s / 2) - 3),
            (Y = O + be - 1),
            (N = e),
            (z = e - 5),
            (V = e),
            (j = t + Math.floor(s / 2) - 1),
            (he = !1))
          : ((O = t + Math.floor(s / 2) - 3),
            (Y = O + be - 1),
            (z = f),
            (N = f + 5),
            (V = f),
            (j = t + Math.floor(s / 2) - 1),
            (he = !1));
    let ye = [];
    for (let W = O; W <= Y; W++)
      for (let Ue = z; Ue <= N; Ue++) {
        if (!n.inb(Ue, W) || n.border[n.idx(Ue, W)]) continue;
        let X = n.idx(Ue, W);
        if (Ue >= e && Ue <= f && W >= t && W <= u) continue;
        let ie = Ue === z || Ue === N || W === O || W === Y;
        ((n.ter[X] = ie ? F.WALL : F.FLOOR),
          (n.var[X] = h),
          (n.dark[X] = 1),
          (n.blk[X] = 0),
          (n.wh[X] = ie ? Math.round(y * 10) : 0));
      }
    for (let W of [0, 1]) {
      let Ue = he ? V + W : V,
        X = he ? j : j + W;
      ((n.ter[n.idx(Ue, X)] = F.SECRET), ye.push(n.idx(Ue, X)));
    }
    let K = (z + N) / 2 + 0.5,
      le = (O + Y) / 2 + 0.5;
    m.ents.push({ k: "chest", x: K, z: le, tier: 3, n: "s" });
    let ve = he ? V + 3 : Z === "w" ? e + 1.5 : f - 0.5,
      we = he ? (Z === "n" ? t + 1.5 : u - 0.5) : j + 3;
    (m.ents.push({
      k: "terminal",
      x: ve,
      z: we,
      eff: "secret",
      tiles: ye,
      diff: Math.min(4, 1 + Math.floor(l / 2)),
      n: "t",
      poi: c,
    }),
      (m.secret = { tiles: ye }));
  }
  let me = [];
  for (let M = t + 1; M < u; M++) for (let z = e + 1; z < f; z++) n.ter[n.idx(z, M)] === F.FLOOR && me.push([z, M]);
  let L = {
    painted: ["table", "bed", "locker", "computer"],
    redbrick: ["table", "crate", "bed", "barrel"],
    clinic: ["bed", "computer", "locker", "table"],
    olive: ["locker", "crate", "bed", "table"],
    hazard: ["barrel", "barrel_toxic", "crate", "computer"],
    darkmetal: ["computer", "locker", "crate"],
    terracotta: ["jar", "table", "crate"],
    barn: ["crate", "barrel", "table"],
    military: ["crate", "locker", "table", "barrel"],
    ruin: ["rubble_s", "crate", "table", "barrel"],
    adobe: ["crate", "jar", "table"],
    shack: ["crate", "barrel", "table"],
    cabin: ["table", "crate", "bed"],
    factory: ["crate", "locker", "barrel", "computer"],
    obsidian: ["crystal_fire", "rubble_s"],
    organic: ["egg", "pod_s"],
    bunker: ["locker", "crate", "computer", "bed"],
    brick: ["table", "crate", "bed", "locker"],
    plaster: ["table", "bed", "jar"],
    rusted: ["barrel", "crate", "barrel_toxic"],
    sandstone: ["jar", "crate", "table"],
    prefab: ["computer", "locker", "bed", "table"],
    concrete: ["crate", "locker", "computer", "rubble_s"],
  }[a] || ["crate"];
  for (let [M, z] of me) {
    let O = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([V, j]) => n.ter[n.idx(M + V, z + j)] === F.WALL),
      N = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ].some(([V, j]) => n.t(M + V, z + j) === F.DOOR || n.t(M + V, z + j) === F.SECRET),
      Y = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([V, j]) => n.blk[n.idx(M + V, z + j)]);
    O && !N && !Y && r() < 0.14
      ? (n.props.push({
          t: L[Math.floor(r() * L.length)],
          x: M + 0.5,
          z: z + 0.5,
          s: 1,
          r: (Math.floor(r() * 4) * Math.PI) / 2,
          blk: !0,
          reg: l,
        }),
        (n.blk[n.idx(M, z)] = 1))
      : n.blk[n.idx(M, z)] || m.inner.push([M, z]);
  }
  let B = {
    military: ["sandbags", "crates", "antenna", "generator"],
    olive: ["sandbags", "tent", "crates"],
    factory: ["barrel", "generator", "crates"],
    hazard: ["barrel", "barrel_toxic", "generator"],
    darkmetal: ["generator", "antenna", "crates"],
    prefab: ["generator", "antenna", "crate"],
    barn: ["crate", "barrel", "log"],
    cabin: ["log", "crate", "barrel"],
    rusted: ["barrel", "barrel_toxic", "tire"],
    concrete: ["barrel", "crates", "tire"],
    redbrick: ["barrel", "crate"],
    brick: ["barrel", "crate"],
    clinic: ["crates", "generator"],
  }[a];
  if (B) {
    let M = [];
    for (let z = t - 1; z <= u + 1; z++)
      for (let O = e - 1; O <= f + 1; O++) {
        if (g(O, z) || !n.inb(O, z)) continue;
        let N = n.idx(O, z);
        if (n.ter[N] !== F.GROUND || n.blk[N]) continue;
        let Y = !1;
        for (let [j, he] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          n.t(O + j, z + he) === F.WALL && (Y = !0);
        if (!Y) continue;
        let V = !1;
        for (let j = -3; j <= 3 && !V; j++)
          for (let he = -3; he <= 3; he++)
            if (n.t(O + he, z + j) === F.DOOR) {
              V = !0;
              break;
            }
        V || M.push([O, z]);
      }
    for (let z = 0; z < 2 + Math.floor(r() * 3) && M.length; z++) {
      let [O, N] = M.splice(Math.floor(r() * M.length), 1)[0];
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([Y, V]) => n.blk[n.idx(O + Y, N + V)]) ||
        (n.props.push({
          t: B[Math.floor(r() * B.length)],
          x: O + 0.5,
          z: N + 0.5,
          s: 0.9,
          r: (Math.floor(r() * 4) * Math.PI) / 2,
          blk: !0,
          reg: l,
        }),
        (n.blk[n.idx(O, N)] = 1));
    }
  }
  if (r() < 0.35 && m.inner.length) {
    let M = m.inner.splice(Math.floor(r() * m.inner.length), 1)[0];
    (m.ents.push({ k: "chest", x: M[0] + 0.5, z: M[1] + 0.5, tier: a === "bunker" ? 2 : 1, n: "c" }),
      (n.blk[n.idx(M[0], M[1])] = 1));
  }
  if (m.inner.length) {
    let M = m.inner[Math.floor(r() * m.inner.length)];
    m.ents.push({ k: "spawnpack", x: M[0] + 0.5, z: M[1] + 0.5, n: "p", dark: n.dark[n.idx(M[0], M[1])] });
  }
  let I = m.inner[Math.floor(r() * m.inner.length)] || [e + 1, t + 1];
  return (
    p
      ? m.ents.push({ k: "light", x: I[0] + 0.5, z: I[1] + 0.5, c: 16724e3, model: "emergency", flicker: !0, n: "l" })
      : m.ents.push({ k: "light", x: I[0] + 0.5, z: I[1] + 0.5, c: 16769200, model: "none", n: "l" }),
    m
  );
}


// ════════ [455] FunctionDeclaration hE (556 bytes) ════════
function hE(n, e, t) {
  let i = e.inner.filter(([a, r]) => {
    if (
      ![
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([o, l]) => n.t(a + o, r + l) === F.WALL)
    )
      return !1;
    for (let o = -2; o <= 2; o++)
      for (let l = -2; l <= 2; l++) {
        let c = n.t(a + l, r + o);
        if (c === F.DOOR || c === F.SECRET) return !1;
      }
    for (let [o, l] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ])
      if (n.blk[n.idx(a + o, r + l)]) return !1;
    return (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([o, l]) => n.t(a + o, r + l) === F.FLOOR).length >= 2
    );
  });
  if (!i.length) return null;
  let s = i[Math.floor(t() * i.length)];
  return ((e.inner = e.inner.filter((a) => Math.abs(a[0] - s[0]) + Math.abs(a[1] - s[1]) > 1)), s);
}


// ════════ [456] VariableDeclaration bx (312 bytes) ════════
var bx = {
  basement: ["puzzle", "miniboss", "waves", "defend_eq", "defend_civ", "puzzle"],
  upper: ["defend_civ", "puzzle", "waves", "miniboss", "defend_civ"],
  cave: ["miniboss", "waves", "puzzle", "defend_civ", "miniboss"],
  hatch: ["defend_eq", "waves", "puzzle", "miniboss", "defend_eq"],
  sewer: ["miniboss", "waves", "defend_civ", "puzzle"],
};


// ════════ [457] FunctionDeclaration ip (77 bytes) ════════
function ip(n, e) {
  let t = bx[n] || bx.basement;
  return t[Math.floor(e() * t.length)];
}


// ════════ [458] FunctionDeclaration uE (581 bytes) ════════
function uE(n, e, t, i) {
  let s = i() * 6.28;
  for (let o = Math.floor(t - 6); o <= t + 6; o++)
    for (let l = Math.floor(e - 6); l <= e + 6; l++) {
      if (!n.inb(l, o)) continue;
      let c = n.idx(l, o);
      if (n.border[c]) continue;
      let d = Math.atan2(o + 0.5 - t, l + 0.5 - e),
        h = Math.hypot(l + 0.5 - e, o + 0.5 - t),
        f = 4.3 + Math.sin(d * 3 + s) * 0.6;
      h < f
        ? ((n.ter[c] = F.ROCK), (n.blk[c] = 0))
        : h < f + 1.4 && (Ua[n.ter[c]] && (n.ter[c] = F.GROUND), (n.blk[c] = 0));
    }
  let a = Math.floor(e),
    r = Math.floor(t);
  for (let o = r - 1; o <= r + 6; o++)
    for (let l of [a - 1, a]) {
      let c = n.idx(l, o);
      n.border[c] ||
        ((n.ter[c] === F.ROCK || o <= r + 3) &&
          ((n.ter[c] = F.CAVE), (n.dark[c] = 1), (n.var[c] = Vn.cave), (n.blk[c] = 0)));
    }
  return { x: a, z: r - 0.2, door: [a, r + 7] };
}


// ════════ [459] VariableDeclaration fE (223 bytes) ════════
var fE = {
  st_house: [3.6, 3.4],
  st_house2: [3.6, 3.3],
  st_long: [3.6, 7],
  st_cyl: [5, 5],
  st_lbld: [7, 7],
  st_base: [7.7, 7.7],
  st_dome: [7.7, 7.7],
  st_solar: [3.6, 3.6],
  st_panel: [1.2, 1.5],
  st_ship: [10.5, 3.7],
  st_rover: [2.7, 3.1],
  st_support: [0.4, 5.4],
};


// ════════ [460] FunctionDeclaration Ba (396 bytes) ════════
function Ba(n, e, t, i, s, a) {
  let [r, o] = fE[e],
    l = s % 2 ? o : r,
    c = s % 2 ? r : o,
    d = Math.floor(t - l / 2 + 0.3),
    h = Math.floor(t + l / 2 - 0.3),
    f = Math.floor(i - c / 2 + 0.3),
    u = Math.floor(i + c / 2 - 0.3);
  for (let p = f; p <= u; p++)
    for (let m = d; m <= h; m++) {
      if (!n.inb(m, p)) continue;
      let g = n.idx(m, p);
      n.border[g] || (n.ter[g] !== F.ROAD && (n.ter[g] = F.GROUND), (n.blk[g] = 1));
    }
  return (
    n.props.push({ t: e, x: t, z: i, s: 1, r: (s * Math.PI) / 2, blk: !0, reg: a, big: !0 }),
    { x0: d, z0: f, x1: h, z1: u }
  );
}


// ════════ [461] FunctionDeclaration pE (1153 bytes) ════════
function pE(n, e, t, i, s, a) {
  let r = e + i / 2,
    o = t + i / 2,
    l = { ents: [], entrance: null };
  for (let u = t; u < t + i; u++)
    for (let p = e; p < e + i; p++)
      if (Math.hypot(p + 0.5 - r, u + 0.5 - o) < i / 2 - 0.5) {
        let g = n.idx(p, u);
        if (n.border[g]) continue;
        ((n.ter[g] = F.ROCK), (n.blk[g] = 0));
      }
  let c = r,
    d = o,
    h = (u, p) => {
      for (let m = -1; m <= 1; m++)
        for (let g = -1; g <= 1; g++) {
          let b = Math.floor(u + g),
            y = Math.floor(p + m);
          if (Math.hypot(b + 0.5 - r, y + 0.5 - o) > i / 2 - 2) continue;
          let v = n.idx(b, y);
          ((n.ter[v] = F.CAVE), (n.dark[v] = 1), (n.var[v] = Vn.cave));
        }
    };
  for (let u = 0; u < 4; u++) {
    ((c = r), (d = o));
    let p = s() * 6.28;
    for (let m = 0; m < 40; m++) (h(c, d), (p += (s() - 0.5) * 1.2), (c += Math.cos(p)), (d += Math.sin(p)));
  }
  for (let u = -3; u <= 3; u++)
    for (let p = -3; p <= 3; p++)
      if (p * p + u * u <= 10) {
        let m = n.idx(Math.floor(r + p), Math.floor(o + u));
        ((n.ter[m] = F.CAVE), (n.dark[m] = 1), (n.var[m] = Vn.cave));
      }
  let f = Math.floor(r);
  for (let u = Math.floor(o); u < t + i + 1; u++)
    for (let p of [0, 1]) {
      let m = n.idx(f + p, u);
      n.border[m] || ((n.ter[m] = F.CAVE), (n.dark[m] = 1), (n.var[m] = Vn.cave));
    }
  return (
    (l.entrance = [f + 1, t + i + 2]),
    l.ents.push({ k: "chest", x: r + 0.5, z: o - 1.5, tier: 2, n: "c" }),
    l.ents.push({ k: "spawnpack", x: r + 0.5, z: o + 1.5, n: "p", dark: 1, big: !0 }),
    l.ents.push({ k: "datapad", x: r - 1.5, z: o + 0.5, n: "d" }),
    l.ents.push({ k: "crystal", x: r + 2.5, z: o + 0.5, n: "k" }),
    (n.blk[n.idx(Math.floor(r + 2.5), Math.floor(o + 0.5))] = 1),
    l
  );
}


// ════════ [462] FunctionDeclaration mE (602 bytes) ════════
function mE(n, e, t, i, s = 1) {
  let a = [e],
    r = Math.hypot(t[0] - e[0], t[1] - e[1]),
    o = (e[0] + t[0]) / 2 + (i() - 0.5) * r * 0.25,
    l = (e[1] + t[1]) / 2 + (i() - 0.5) * r * 0.25;
  a.push([o, l], t);
  for (let c = 0; c < a.length - 1; c++) {
    let [d, h] = a[c],
      [f, u] = a[c + 1],
      p = Math.ceil(Math.hypot(f - d, u - h) * 2);
    for (let m = 0; m <= p; m++) {
      let g = d + (f - d) * (m / p),
        b = h + (u - h) * (m / p);
      for (let y = -s; y <= s - 1; y++)
        for (let v = -s; v <= s - 1; v++) {
          let _ = Math.floor(g + v + 0.5),
            A = Math.floor(b + y + 0.5);
          if (!n.inb(_, A)) continue;
          let T = n.idx(_, A);
          if (n.border[T]) continue;
          let S = n.ter[T];
          S === F.GROUND || S === F.ROCK || S === F.WATER || S === F.ACID || S === F.LAVA || S === F.ICE
            ? ((n.ter[T] = F.ROAD), (n.blk[T] = 0))
            : S === F.ROAD && (n.blk[T] = 0);
        }
    }
  }
}


// ════════ [463] FunctionDeclaration gE (1441 bytes) ════════
function gE(n, e, t) {
  let i = n.w,
    s = n.h,
    a = (c) => {
      let d = n.ter[c];
      return (!Ua[d] || d === F.GATE || d === F.SECRET) && !n.blk[c];
    },
    r = new Uint8Array(i * s),
    o = [n.idx(e, t)];
  for (r[o[0]] = 1; o.length;) {
    let c = o.pop(),
      d = c % i,
      h = (c / i) | 0;
    for (let [f, u] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      let p = d + f,
        m = h + u;
      if (p < 0 || m < 0 || p >= i || m >= s) continue;
      let g = m * i + p;
      r[g] || !a(g) || ((r[g] = 1), o.push(g));
    }
  }
  n.reach = r;
  let l = 0;
  for (let c of n.ents) {
    if (["light", "gate", "bossarena", "spawnpack", "spawnpt", "flag", "helipad"].includes(c.k)) continue;
    let d = Math.floor(c.x),
      h = Math.floor(c.z),
      f = !1;
    for (let m = -1; m <= 1 && !f; m++)
      for (let g = -1; g <= 1; g++)
        if (n.inb(d + g, h + m) && r[n.idx(d + g, h + m)]) {
          f = !0;
          break;
        }
    if (f) continue;
    let u = null,
      p = 1e9;
    for (let m = 1; m < 40 && !u; m++)
      for (let g = -m; g <= m; g++)
        for (let b = -m; b <= m; b++) {
          if (Math.abs(b) !== m && Math.abs(g) !== m) continue;
          let y = d + b,
            v = h + g;
          if (n.inb(y, v) && r[n.idx(y, v)] && n.reg[n.idx(y, v)] === n.reg[n.idx(d, h)]) {
            let _ = b * b + g * g;
            _ < p && ((p = _), (u = [y, v]));
          }
        }
    if (u) {
      let m = Math.ceil(Math.sqrt(p) * 2);
      for (let g = 1; g <= m; g++) {
        let b = Math.floor(d + ((u[0] - d) * g) / m + 0.5),
          y = Math.floor(h + ((u[1] - h) * g) / m + 0.5),
          v = n.idx(b, y);
        if (n.border[v]) continue;
        let _ = n.ter[v];
        if (_ === F.WALL) {
          n.ter[v] = F.DOOR;
          continue;
        }
        (Ua[_] && _ !== F.GATE && _ !== F.SECRET && (n.ter[v] = n.dark[v] ? F.CAVE : F.ROAD), (n.blk[v] = 0));
      }
      l++;
    }
  }
  if (l) {
    let c = new Uint8Array(i * s),
      d = [n.idx(e, t)];
    for (c[d[0]] = 1; d.length;) {
      let h = d.pop(),
        f = h % i,
        u = (h / i) | 0;
      for (let [p, m] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        let g = f + p,
          b = u + m;
        if (g < 0 || b < 0 || g >= i || b >= s) continue;
        let y = b * i + g;
        c[y] || !a(y) || ((c[y] = 1), d.push(y));
      }
    }
    n.reach = c;
  }
  n.fixedConn = l;
}


// ════════ [464] VariableDeclaration xE,bE (221 bytes) ════════
var xE = {
    ruinas: Vn.ruin,
    bunker: Vn.bunker,
    laboratorio: 11,
    fabrica: Vn.factory,
    caverna: 12,
    magma: 13,
    colmena: Vn.organic,
    sotano: Vn.bunker,
    alcantarilla: 19,
    gruta: Vn.cave,
    planta: 15,
  },
  bE = new Set(["caverna", "magma", "colmena", "gruta"]);


// ════════ [465] FunctionDeclaration sp (2769 bytes) ════════
function sp(n, e, t, i) {
  let s = {
    floor(a, r, o) {
      if (!n.inb(a, r) || a < 1 || r < 1 || a >= n.w - 1 || r >= n.h - 1) return;
      let l = n.idx(a, r);
      ((n.ter[l] = t), (n.wh[l] = 0), (n.dark[l] = o ? 1 : 0));
    },
    isFloor(a, r) {
      return n.inb(a, r) && n.ter[n.idx(a, r)] === t;
    },
    room(a, r, o, l, c, d) {
      let h = {
          x0: a,
          z0: r,
          x1: a + o - 1,
          z1: r + l - 1,
          cx: a + o / 2,
          cz: r + l / 2,
          w: o,
          h: l,
          shape: c,
          dark: d,
          tiles: new Set(),
        },
        f = e() * 6.28,
        u = e() * 6.28;
      for (let p = r; p <= h.z1; p++)
        for (let m = a; m <= h.x1; m++) {
          let g = m + 0.5 - h.cx,
            b = p + 0.5 - h.cz,
            y = !0;
          if (c === "blob" || c === "plaza") {
            let v = Math.atan2(b, g),
              _ = c === "plaza" ? 1 : 1 + 0.13 * Math.sin(3 * v + f) + 0.08 * Math.sin(5 * v + u);
            y = Math.hypot(g / (o / 2), b / (l / 2)) < 0.97 * _;
          } else if (c === "cross") {
            let v = Math.max(5, Math.floor(o * 0.42)),
              _ = Math.max(5, Math.floor(l * 0.42));
            y = Math.abs(g) <= v / 2 || Math.abs(b) <= _ / 2;
          } else if (c === "octo") {
            let v = Math.min(o, l) * 0.28;
            y = Math.abs(g) + Math.abs(b) <= o / 2 + l / 2 - v * 1.4;
          }
          y && (s.floor(m, p, d), h.tiles.add(n.idx(m, p)));
        }
      return h;
    },
    corridor(a, r, o, l, c) {
      let d = Math.floor(a.cx),
        h = Math.floor(a.cz),
        f = Math.floor(r.cx),
        u = Math.floor(r.cz),
        p = Math.floor((o - 1) / 2),
        m = (g, b) => {
          for (let y = -p; y < o - p; y++)
            for (let v = -p; v < o - p; v++) {
              let _ = n.idx(g + v, b + y);
              n.ter[_] !== t &&
                n.ter[_] !== F.WATER &&
                n.ter[_] !== F.LAVA &&
                n.ter[_] !== F.ACID &&
                s.floor(g + v, b + y, l);
            }
        };
      if (c ?? e() < 0.5) {
        for (; d !== f;) (m(d, h), (d += Math.sign(f - d)));
        for (; h !== u;) (m(d, h), (h += Math.sign(u - h)));
      } else {
        for (; h !== u;) (m(d, h), (h += Math.sign(u - h)));
        for (; d !== f;) (m(d, h), (d += Math.sign(f - d)));
      }
      m(d, h);
    },
    tunnel(a, r, o, l) {
      let c = a.cx,
        d = a.cz,
        h = 0;
      for (; Math.hypot(r.cx - c, r.cz - d) > 1 && h++ < 600;) {
        let f = Math.atan2(r.cz - d, r.cx - c) + (e() - 0.5) * 1.3;
        ((c += Math.cos(f) * 0.8), (d += Math.sin(f) * 0.8));
        let u = o + (e() - 0.5) * 0.8;
        for (let p = -Math.ceil(u); p <= Math.ceil(u); p++)
          for (let m = -Math.ceil(u); m <= Math.ceil(u); m++)
            if (m * m + p * p <= u * u) {
              let g = Math.floor(c + m),
                b = Math.floor(d + p);
              n.inb(g, b) && n.ter[n.idx(g, b)] !== t && s.floor(g, b, l);
            }
      }
    },
    pillars(a, r, o, l = 4) {
      if (!(a.w < 11 || a.h < 11))
        for (let c = a.z0 + 3; c <= a.z1 - 3; c += l)
          for (let d = a.x0 + 3; d <= a.x1 - 3; d += l) {
            if (Math.abs(d + 0.5 - a.cx) < 2 || Math.abs(c + 0.5 - a.cz) < 2 || !s.isFloor(d, c)) continue;
            let h = n.idx(d, c);
            ((n.ter[h] = r), (n.wh[h] = o));
          }
    },
    cover(a, r, o) {
      let l = [];
      for (let c = 0; c < r * 4 && l.length < r; c++) {
        let d = e() < 0.5,
          h = 2 + Math.floor(e() * 3),
          f = a.x0 + 3 + Math.floor(e() * Math.max(1, a.w - 6 - (d ? h : 0))),
          u = a.z0 + 3 + Math.floor(e() * Math.max(1, a.h - 6 - (d ? 0 : h))),
          p = [],
          m = !0;
        for (let g = 0; g < h; g++) {
          let b = f + (d ? g : 0),
            y = u + (d ? 0 : g);
          if (Math.abs(b + 0.5 - a.cx) < 1.6 || Math.abs(y + 0.5 - a.cz) < 1.6) {
            m = !1;
            break;
          }
          for (let v = -1; v <= 1 && m; v++)
            for (let _ = -1; _ <= 1; _++)
              if (!s.isFloor(b + _, y + v)) {
                m = !1;
                break;
              }
          p.push(n.idx(b, y));
        }
        if (m) {
          for (let g of p) ((n.ter[g] = o), (n.wh[g] = 6 + Math.floor(e() * 3)));
          l.push(p);
        }
      }
      return l.flat();
    },
    pit(a, r) {
      if (a.w < 14 || a.h < 14) return !1;
      let o = r === "lava" ? F.LAVA : r === "acid" ? F.ACID : r === "water" ? F.WATER : null;
      if (o == null) return !1;
      let l = a.x0 + 4,
        c = a.x1 - 4,
        d = a.z0 + 4,
        h = a.z1 - 4;
      for (let f = d; f <= h; f++)
        for (let u = l; u <= c; u++)
          Math.abs(u + 0.5 - a.cx) < 1.6 ||
            Math.abs(f + 0.5 - a.cz) < 1.6 ||
            (s.isFloor(u, f) && ((n.ter[n.idx(u, f)] = o), (a.pitTiles || (a.pitTiles = [])).push(n.idx(u, f))));
      return ((a.pit = !0), !0);
    },
  };
  return s;
}


// ════════ [466] FunctionDeclaration Ud (327 bytes) ════════
function Ud(n, e, t, i) {
  let s = n.w,
    a = new Int32Array(n.w * n.h).fill(-1),
    r = [n.idx(Math.floor(e), Math.floor(t))];
  a[r[0]] = 0;
  for (let o = 0; o < r.length; o++) {
    let l = r[o],
      c = l % s,
      d = (l / s) | 0;
    for (let [h, f] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      let u = c + h,
        p = d + f;
      if (!n.inb(u, p)) continue;
      let m = n.idx(u, p);
      a[m] >= 0 || !i(n.ter[m], m) || ((a[m] = a[l] + 1), r.push(m));
    }
  }
  return a;
}


// ════════ [467] FunctionDeclaration yx (5799 bytes) ════════
function yx(n) {
  let e = pi(n.seed),
    t = Zi[n.theme],
    i = bE.has(n.theme),
    s = i ? 104 : 98,
    a = new Fa(s, s);
  ((a.kind = "op"), (a.theme = n.theme), (a.op = n));
  let r = !!t.outdoor || i,
    o = xE[n.theme] ?? 0;
  (a.ter.fill(r ? F.ROCK : F.VOID), a.var.fill(o));
  let l = i ? F.CAVE : t.outdoor ? F.GROUND : F.FLOOR,
    c = r ? F.ROCK : F.WALL,
    d = sp(a, e, l, c),
    h = [],
    f = (L, B, I, M, z) => {
      if ((I < 34 && M < 34) || z > 5) {
        h.push([L, B, I, M]);
        return;
      }
      if (I > M ? !0 : M > I ? !1 : e() < 0.5) {
        let N = Math.floor(I * (0.4 + e() * 0.2));
        (f(L, B, N, M, z + 1), f(L + N, B, I - N, M, z + 1));
      } else {
        let N = Math.floor(M * (0.4 + e() * 0.2));
        (f(L, B, I, N, z + 1), f(L, B + N, I, M - N, z + 1));
      }
    };
  f(2, 2, s - 4, s - 4, 0);
  let u = [];
  h.forEach(([L, B, I, M], z) => {
    let O = z > 0 && e() < 0.3,
      N = O ? 0.45 + e() * 0.15 : 0.7 + e() * 0.2,
      Y = Math.max(8, Math.floor(I * N)),
      V = Math.max(8, Math.floor(M * (O ? 0.45 + e() * 0.15 : 0.7 + e() * 0.2))),
      j = L + 1 + Math.floor(e() * Math.max(1, I - Y - 1)),
      he = B + 1 + Math.floor(e() * Math.max(1, M - V - 1)),
      be = e(),
      ye;
    i
      ? (ye = "blob")
      : t.outdoor
        ? (ye = be < 0.3 ? "plaza" : be < 0.45 ? "cross" : "rect")
        : (ye = Y >= 14 && V >= 14 ? (be < 0.22 ? "cross" : be < 0.38 ? "octo" : "rect") : "rect");
    let K = n.mods.includes("dark") || e() < t.dark,
      le = d.room(j, he, Y, V, z === 0 ? "rect" : ye, K);
    if ((u.push(le), t.outdoor && !i))
      for (let ve = he - 1; ve <= le.z1 + 1; ve++)
        for (let we = j - 1; we <= le.x1 + 1; we++)
          (we === j - 1 || we === le.x1 + 1 || ve === he - 1 || ve === le.z1 + 1) && e() < 0.25 && d.floor(we, ve, K);
  });
  let p = (L, B) => {
    let I = (L.dark && B.dark) || t.dark > 0.6;
    i ? d.tunnel(L, B, 1.7 + e() * 0.8, I) : d.corridor(L, B, e() < 0.7 ? 3 : 4, I);
  };
  for (let L = 0; L < u.length - 1; L++) p(u[L], u[L + 1]);
  for (let L = 0; L < 3; L++) {
    let B = u[Math.floor(e() * u.length)],
      I = u[Math.floor(e() * u.length)];
    B !== I && p(B, I);
  }
  if (!r)
    for (let L = 1; L < s - 1; L++)
      for (let B = 1; B < s - 1; B++) {
        let I = a.idx(B, L);
        if (a.ter[I] !== F.VOID) continue;
        let M = !1;
        for (let z = -1; z <= 1 && !M; z++)
          for (let O = -1; O <= 1; O++)
            if (a.ter[a.idx(B + O, L + z)] === l) {
              M = !0;
              break;
            }
        M &&
          ((a.ter[I] = F.WALL),
          (a.dark[I] = 0),
          (a.wh[I] = n.theme === "fabrica" ? 24 : n.theme === "laboratorio" ? 18 : 15));
      }
  let m = u[0],
    g = [];
  for (let L of u) {
    if (L === m) continue;
    let B = L.w >= 14 && L.h >= 14;
    if (i) {
      (B && e() < 0.45 && d.pillars(L, F.ROCK, 0, 5), t.liquid && B && e() < 0.3 && d.pit(L, t.liquid));
      continue;
    }
    (L.shape === "rect" && B && e() < 0.45 && (d.pillars(L, F.WALL, 22), (L.hall = !0)),
      B && t.liquid && !L.hall && e() < 0.25 && d.pit(L, t.liquid),
      B && !L.pit && g.push(...d.cover(L, 2 + Math.floor(e() * 3), F.WALL)));
  }
  let b = (L) => L === l || L === F.ACID || L === F.ICE,
    y = Ud(a, m.cx, m.cz, b);
  if (u.some((L) => y[a.idx(Math.floor(L.cx), Math.floor(L.cz))] < 0)) {
    for (let L of g) ((a.ter[L] = l), (a.wh[L] = 0));
    for (let L of u)
      if (L.pitTiles) {
        for (let B of L.pitTiles) a.ter[B] = l;
        L.pit = !1;
      }
    y = Ud(a, m.cx, m.cz, b);
  }
  for (let L of u) L.d = y[a.idx(Math.floor(L.cx), Math.floor(L.cz))];
  let v = u.filter((L) => L.d >= 0),
    _ = [...v].sort((L, B) => B.d - L.d),
    A = _.find((L) => L.w >= 13 && L.h >= 13 && L !== m) || _[0];
  m.dark = !1;
  for (let L = m.z0; L <= m.z1; L++) for (let B = m.x0; B <= m.x1; B++) a.dark[a.idx(B, L)] = 0;
  let T = 0,
    S = (L, B, I, M = {}) => {
      let z = { k: L, id: `${L}_op_${T++}`, x: B, z: I, ...M };
      return (a.ents.push(z), z);
    },
    k = new Set(),
    w = (L, B = 1) => {
      for (let I = 0; I < 80; I++) {
        let M = L.x0 + B + Math.floor(e() * Math.max(1, L.x1 - L.x0 - B * 2 + 1)),
          z = L.z0 + B + Math.floor(e() * Math.max(1, L.z1 - L.z0 - B * 2 + 1)),
          O = a.idx(M, z);
        if (!(a.ter[O] !== l || a.blk[O] || k.has(O) || y[O] < 0)) return (k.add(O), [M + 0.5, z + 0.5]);
      }
      return [L.cx, L.cz];
    };
  ((a.spawnBase = [m.cx, m.cz]),
    k.add(a.idx(Math.floor(m.cx), Math.floor(m.cz))),
    S("extract", m.cx + 0.5, m.cz - 1.5, { id: "extract" }),
    S("light", m.cx, m.cz, { c: 12574975, model: "none" }));
  let E = v.filter((L) => L !== m && L !== A),
    H = () => (E.length ? E[Math.floor(e() * E.length)] : A);
  if (
    (n.obj === "boss" &&
      S("bossarena", A.cx, A.cz, {
        id: "opboss",
        boss: n.boss,
        lvl: n.lvl + 2,
        rad: Math.min(A.x1 - A.x0, A.z1 - A.z0) / 2,
        op: !0,
      }),
    n.obj === "data")
  ) {
    let L = [...E].sort(() => e() - 0.5).slice(0, 3);
    for (; L.length < 3;) L.push(A);
    L.forEach((B, I) => {
      let M = w(B);
      S("terminal", M[0], M[1], { id: "opterm_" + I, eff: "opdata", diff: Math.min(4, 1 + Math.floor(n.lvl / 12)) });
    });
  }
  (n.obj === "rescue" &&
    [A, H()].forEach((B, I) => {
      let M = w(B);
      S("prisoner", M[0], M[1], { id: "pris_" + I });
    }),
    n.obj === "nests" &&
      [A, ...[...E].sort(() => e() - 0.5).slice(0, 4)].forEach((B, I) => {
        let M = w(B, 2);
        S("nest", M[0], M[1], { id: "opnest_" + I, spawn: n.nestSpawn });
      }));
  let Z = n.mods.includes("swarm") ? 1.5 : 1;
  for (let L of v) {
    if (L === m) continue;
    let B = L.w * L.h,
      I = Math.max(1, Math.min(3, Math.round((B / 210) * Z)));
    for (let M = 0; M < I; M++) {
      let z = w(L, 2);
      S("spawnpack", z[0], z[1], { size: 3 + Math.floor(e() * 3), dark: L.dark, op: !0 });
    }
  }
  let me = 1 + Math.floor(e() * 2) + (n.mods.includes("loot") ? 3 : 0);
  for (let L = 0; L < me; L++) {
    let B = H(),
      I = w(B);
    (S("chest", I[0], I[1], { tier: 2 }), (a.blk[a.idx(Math.floor(I[0]), Math.floor(I[1]))] = 1));
  }
  for (let L = 0; L < 3; L++) {
    let B = H(),
      I = w(B);
    (S("crate", I[0], I[1], {}), (a.blk[a.idx(Math.floor(I[0]), Math.floor(I[1]))] = 1));
  }
  if (e() < 0.5) {
    let L = H(),
      B = w(L);
    (S("shrine", B[0], B[1], {}), (a.blk[a.idx(Math.floor(B[0]), Math.floor(B[1]))] = 1));
  }
  if (e() < 0.35) {
    let L = H(),
      B = w(L);
    (S("npc", B[0], B[1], { npc: "mercader", id: "npc_mercader" }), (L.safe = !0));
  }
  if (e() < 0.5) {
    let L = H(),
      B = w(L);
    S("datapad", B[0], B[1], { opdp: !0 });
  }
  let G = E.find((L) => L.x0 > 9 && L.shape === "rect");
  if (G && !r) {
    let L = G.x0 - 2,
      B = L - 4,
      I = Math.floor(G.cz) - 2,
      M = I + 4,
      z = B > 1;
    for (let O = I - 1; O <= M + 1 && z; O++)
      for (let N = B - 1; N <= L + 1; N++) {
        let Y = a.t(N, O);
        if (Y !== F.VOID && Y !== F.WALL) {
          z = !1;
          break;
        }
      }
    for (let O of [Math.floor(G.cz), Math.floor(G.cz) + 1]) a.t(G.x0, O) !== l && (z = !1);
    if (z) {
      for (let N = I - 1; N <= M + 1; N++)
        for (let Y = B - 1; Y <= L + 1; Y++) {
          let V = a.idx(Y, N),
            j = Y === B - 1 || Y === L + 1 || N === I - 1 || N === M + 1;
          ((a.ter[V] = j ? F.WALL : l), (a.dark[V] = 1), (a.wh[V] = j ? 15 : 0));
        }
      let O = [];
      for (let N of [Math.floor(G.cz), Math.floor(G.cz) + 1]) {
        let Y = a.idx(G.x0 - 1, N),
          V = a.idx(L + 1, N);
        ((a.ter[Y] = F.SECRET), (a.ter[V] = F.SECRET), O.push(Y, V));
      }
      (S("chest", (B + L) / 2 + 0.5, (I + M) / 2 + 0.5, { tier: 3 }),
        S("terminal", G.x0 + 1.5, G.cz - 1.5, {
          eff: "secret",
          tiles: O,
          diff: Math.min(4, 2 + Math.floor(n.lvl / 15)),
        }));
    }
  }
  if ((ap(a, v, t, n.theme, l, k, e, S), t.liquid))
    for (let L = 0; L < 3; L++) {
      let B = H();
      if (B.pit) continue;
      let I = B.x0 + 3 + e() * Math.max(1, B.w - 6),
        M = B.z0 + 3 + e() * Math.max(1, B.h - 6),
        z = 1.1 + e() * 1.2;
      for (let O = Math.floor(M - z); O <= M + z; O++)
        for (let N = Math.floor(I - z); N <= I + z; N++) {
          let Y = a.idx(N, O);
          a.ter[Y] !== l ||
            a.blk[Y] ||
            k.has(Y) ||
            (N + 0.5 - I) ** 2 + (O + 0.5 - M) ** 2 > z * z ||
            Math.abs(N + 0.5 - B.cx) < 1.6 ||
            Math.abs(O + 0.5 - B.cz) < 1.6 ||
            (t.liquid === "acid"
              ? (a.ter[Y] = F.ACID)
              : t.liquid === "ice"
                ? (a.ter[Y] = F.ICE)
                : t.liquid === "lava"
                  ? (a.ter[Y] = F.LAVA)
                  : t.liquid === "water" && (a.ter[Y] = F.WATER));
        }
    }
  return ((a.rooms = v), (a.floorT = l), (a.totalPacks = a.ents.filter((L) => L.k === "spawnpack").length), a);
}


// ════════ [468] FunctionDeclaration ap (1031 bytes) ════════
function ap(n, e, t, i, s, a, r, o, l = 0.1) {
  let c = t.props;
  for (let d of e) {
    let h = i === "magma" ? 16740400 : i === "colmena" ? 13656319 : i === "gruta" ? 16756848 : 16773328;
    d.dark
      ? r() < 0.5 && o("light", d.x0 + 1.5, d.z0 + 1.5, { c: 16719888, model: "emergency", flicker: !0 })
      : (o("light", d.cx, d.cz, { c: h, model: "none" }),
        d.w * d.h > 300 &&
          (o("light", d.x0 + 3, d.z0 + 3, { c: h, model: "none" }),
          o("light", d.x1 - 2, d.z1 - 2, { c: h, model: "none" })));
    for (let f = d.z0; f <= d.z1; f++)
      for (let u = d.x0; u <= d.x1; u++) {
        let p = n.idx(u, f);
        if (n.ter[p] !== s || n.blk[p] || a.has(p)) continue;
        let m = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([y, v]) => {
            let _ = n.t(u + y, f + v);
            return _ === F.WALL || _ === F.ROCK;
          }),
          g = [
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([y, v]) => {
            let _ = u + y,
              A = f + v;
            return (_ < d.x0 || _ > d.x1 || A < d.z0 || A > d.z1) && n.t(_, A) === s;
          }),
          b = Math.abs(u + 0.5 - d.cx) < 1.6 || Math.abs(f + 0.5 - d.cz) < 1.6;
        m && !g && !b && r() < l
          ? (n.props.push({
              t: c[Math.floor(r() * c.length)],
              x: u + 0.5,
              z: f + 0.5,
              s: 0.9 + r() * 0.3,
              r: (Math.floor(r() * 4) * Math.PI) / 2,
              blk: !0,
            }),
            (n.blk[p] = 1))
          : r() < 0.1 &&
            n.decor.push({
              t: t.decor[Math.floor(r() * t.decor.length)],
              x: u + r(),
              z: f + r(),
              s: 0.7 + r() * 0.6,
              r: r() * 6.28,
            });
      }
  }
}


// ════════ [469] VariableDeclaration vE,Fd,Ha,yE,_E (821 bytes) ════════
var vE = {
    basement: "sotano",
    upper: "planta",
    cave: "gruta",
    hive: "colmena",
    hatch: "sotano",
    sewer: "alcantarilla",
  },
  Fd = {
    basement: "S\xF3tano",
    upper: "Planta superior",
    cave: "Gruta",
    hive: "C\xE1mara de la colmena",
    hatch: "B\xFAnker subterr\xE1neo",
    sewer: "Alcantarillado",
  },
  Ha = {
    miniboss: { n: "Guarida", d: "Un enemigo poderoso acecha aqu\xED abajo", c: "#ff5a5a" },
    waves: { n: "Oleadas", d: "Resiste las oleadas de hostiles", c: "#ffb340" },
    defend_civ: { n: "Rescate", d: "Protege a los civiles atrapados", c: "#5fd35a" },
    defend_eq: { n: "Defensa", d: "Protege el equipo mientras transmite", c: "#46e4ff" },
    puzzle: { n: "C\xE1mara sellada", d: "Resuelve el mecanismo para abrir la c\xE1mara", c: "#c58bff" },
  },
  yE = { sotano: Vn.bunker, alcantarilla: 19, gruta: Vn.cave, colmena: Vn.organic, planta: 15 },
  _E = { miniboss: [21, 19], waves: [20, 18], defend_civ: [18, 18], defend_eq: [18, 18], puzzle: [18, 15] };


// ════════ [470] FunctionDeclaration _x (5874 bytes) ════════
function _x(n) {
  let e = pi(n.seed),
    t = n.ent,
    i = t.kind,
    s = n.enc,
    a = vE[i] || "sotano",
    r = De[n.reg] || De[0],
    l = { ...Zi[a] };
  a === "gruta" &&
    ((l.floor = [tt(r.rock, 0, 0.25), tt(r.rock, 0, 0.15), tt(r.rock, 0, 0.35)]),
    (l.wall = r.rock),
    (l.props = r.props
      .filter((K) => K[2])
      .map((K) => K[0])
      .slice(0, 4)),
    (l.liquid = r.liquid === "ice" ? "ice" : r.liquid || null),
    (l.decor = r.decor.map((K) => K[0]).slice(0, 2)));
  let c = i === "cave" || i === "hive",
    d = 60,
    h = new Fa(d, d);
  ((h.kind = "op"),
    (h.theme = a),
    (h.themeObj = l),
    (h.op = n),
    (h.rk = r.key),
    (h.sub = !0),
    h.ter.fill(c ? F.ROCK : F.VOID),
    h.var.fill(i === "upper" && t.bstyle != null ? t.bstyle : (yE[a] ?? 0)));
  let f = c ? F.CAVE : F.FLOOR,
    u = sp(h, e, f, c ? F.ROCK : F.WALL),
    p = (K) => Math.floor((e() - 0.5) * 2 * K),
    [m, g] = _E[s] || [18, 16],
    b = m + p(2),
    y = g + p(1),
    v = s === "puzzle" ? "rect" : c ? "blob" : s === "miniboss" && e() < 0.6 ? "octo" : e() < 0.25 ? "cross" : "rect",
    _ = () => (c ? "blob" : e() < 0.15 ? "octo" : "rect"),
    A = () => e() < l.dark,
    T = ["linear", "zigzag", "loop", "hub"][Math.floor(e() * 4)],
    S = [],
    k = [],
    w,
    E,
    H = (K, le, ve = 3, we) => {
      c ? u.tunnel(K, le, 1.6, K.dark && le.dark) : u.corridor(K, le, ve, K.dark && le.dark, we);
    },
    Z = Math.max(15, Math.min(44 - b, Math.floor(30 - b / 2) + p(6))),
    me = s === "puzzle" ? 10 : 6 + Math.max(0, p(2));
  if (T === "linear") {
    ((w = u.room(25 + p(4), 47 + Math.max(0, p(2)), 9 + p(1), 8, "rect", !1)), (E = u.room(Z, me, b, y, v, !1)));
    let K = u.room(23 + p(4), 31 + p(1), 11 + p(2), 8 + p(1), _(), A());
    (S.push(u.room(3 + p(1), 27 + p(3), 10 + p(2), 9 + p(1), _(), A())),
      e() < 0.6 && S.push(u.room(46 + p(1), 27 + p(3), 10 + p(1), 9 + p(1), _(), A())),
      k.push(K),
      H(w, K),
      H(K, E));
    for (let le of S) H(K, le, 3, !0);
  } else if (T === "zigzag") {
    let K = e() < 0.5;
    ((w = u.room(K ? 4 + p(2) : 46 + p(2), 48, 9, 8, "rect", !1)), (E = u.room(Z, me, b, y, v, !1)));
    let le = u.room(K ? 42 + p(2) : 6 + p(2), 40 + p(1), 11, 8, _(), A()),
      ve = u.room(K ? 4 + p(2) : 44 + p(2), 28 + p(1), 11 + p(1), 8, _(), A());
    if ((k.push(le, ve), H(w, le, 3, !0), H(le, ve, 3, !0), H(ve, E, 3, !0), e() < 0.6)) {
      let we = u.room(24 + p(3), 47 + p(1), 9, 8, _(), A());
      (S.push(we), H(w, we, 3, !0));
    }
  } else if (T === "loop") {
    ((w = u.room(25 + p(3), 48, 10, 8, "rect", !1)), (E = u.room(Z, me, b, y, v, !1)));
    let K = u.room(4 + p(2), 30 + p(3), 11, 9 + p(1), _(), A()),
      le = u.room(45 + p(2), 30 + p(3), 11, 9 + p(1), _(), A());
    (S.push(K, le), H(w, K, 3, !0), H(w, le, 3, !0), H(K, E, 3, !1), H(le, E, 3, !1));
  } else {
    ((w = u.room(4 + p(2), 47 + Math.max(0, p(2)), 9, 8, "rect", !1)), (E = u.room(Z, me, b, y, v, !1)));
    let K = u.room(22 + p(3), 33 + p(2), 15 + p(2), 10, _(), A());
    (S.push(u.room(45 + p(2), 46 + p(2), 10, 9, _(), A()), u.room(3 + p(1), 28 + p(2), 10, 9, _(), A())),
      e() < 0.5 && S.push(u.room(46 + p(1), 32 + p(1), 10, 9, _(), A())),
      k.push(K),
      H(w, K, 3, !0),
      H(K, E));
    for (let le of S) H(K, le, 3, !0);
  }
  let G = null;
  if (s === "puzzle") {
    let K = Math.floor(E.cx);
    G = u.room(K - 3, E.z0 - 6, 6, 5, "rect", !0);
  }
  if (!c)
    for (let K = 1; K < d - 1; K++)
      for (let le = 1; le < d - 1; le++) {
        let ve = h.idx(le, K);
        if (h.ter[ve] !== F.VOID) continue;
        let we = !1;
        for (let W = -1; W <= 1 && !we; W++)
          for (let Ue = -1; Ue <= 1; Ue++)
            if (h.ter[h.idx(le + Ue, K + W)] === f) {
              we = !0;
              break;
            }
        we && ((h.ter[ve] = F.WALL), (h.wh[ve] = i === "upper" ? 17 : 15));
      }
  let L = 0,
    B = (K, le, ve, we = {}) => {
      let W = { k: K, id: `${K}_sub_${L++}`, x: le, z: ve, ...we };
      return (h.ents.push(W), W);
    },
    I = [];
  if (G) {
    let K = Math.floor(E.cx);
    for (let le of [K - 1, K]) {
      let ve = h.idx(le, E.z0 - 1);
      ((h.ter[ve] = F.SECRET), (h.wh[ve] = 0), I.push(ve));
    }
    (B("vault", K, E.z0 - 1, { id: "vault", tiles: I }),
      B("chest", K, G.cz, { id: "vault_chest", tier: 3, locked: !0 }),
      (h.blk[h.idx(K, Math.floor(G.cz))] = 1));
  }
  (s === "miniboss" && u.pillars(E, c ? F.ROCK : F.WALL, c ? 0 : 22, 5),
    (s === "waves" || s === "defend_eq" || s === "defend_civ") &&
      u.cover(E, 3 + Math.floor(e() * 2), c ? F.ROCK : F.WALL));
  let M = [];
  for (let K of E.tiles) {
    let le = K % d,
      ve = (K / d) | 0;
    for (let [we, W] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      let Ue = h.idx(le + we, ve + W);
      !E.tiles.has(Ue) && h.ter[Ue] === f && !M.includes(Ue) && M.push(Ue);
    }
  }
  let z = (K) => K === f || K === F.ACID || K === F.ICE,
    O = Ud(h, w.cx, w.cz, z);
  if (
    O[h.idx(Math.floor(E.cx), Math.floor(E.cz))] < 0 ||
    [...S, ...k].some((K) => O[h.idx(Math.floor(K.cx), Math.floor(K.cz))] < 0)
  )
    for (let K of E.tiles) (h.ter[K] === F.WALL || h.ter[K] === F.ROCK) && ((h.ter[K] = f), (h.wh[K] = 0));
  let N = new Set(),
    Y = (K, le = 1) => {
      for (let ve = 0; ve < 80; ve++) {
        let we = K.x0 + le + Math.floor(e() * Math.max(1, K.w - le * 2)),
          W = K.z0 + le + Math.floor(e() * Math.max(1, K.h - le * 2)),
          Ue = h.idx(we, W);
        if (!(h.ter[Ue] !== f || h.blk[Ue] || N.has(Ue) || !K.tiles.has(Ue))) return (N.add(Ue), [we + 0.5, W + 0.5]);
      }
      return [K.cx, K.cz];
    },
    V = (K, le, ve = 1) => {
      for (let we = -ve; we <= ve; we++)
        for (let W = -ve; W <= ve; W++) N.add(h.idx(Math.floor(K) + W, Math.floor(le) + we));
    };
  ((h.spawnBase = [w.cx, w.cz + 1]),
    B("exit", Math.floor(w.cx) + 0.5, w.z0 + 1.5, { id: "exit" }),
    V(w.cx, w.z0 + 1.5, 1),
    V(w.cx, w.cz + 1, 1),
    B("light", w.cx, w.cz, { c: 12574975, model: "none" }));
  let j = { x0: E.x0, z0: E.z0, x1: E.x1, z1: E.z1, cx: E.cx, cz: E.cz },
    he = B("encounter", E.cx, E.cz, { id: "enc", enc: s, room: j, seal: M, tiles: [...E.tiles] });
  if ((V(E.cx, E.cz, 2), s === "defend_civ"))
    for (let K = 0; K < 3; K++) {
      let le = (K / 3) * 6.283 + 0.4;
      B("civilian", E.cx + Math.cos(le) * 1.4, E.cz + Math.sin(le) * 1.4, { id: "civ_" + K, n: K });
    }
  if (
    (s === "defend_eq" &&
      (B("device", E.cx, E.cz, { id: "device" }), (h.blk[h.idx(Math.floor(E.cx), Math.floor(E.cz))] = 1)),
    s === "puzzle")
  ) {
    let K = e() < 0.5 ? "switch" : "sequence";
    he.mode = K;
    let le = K === "switch" ? 6 : 5,
      ve = Math.min(E.w, E.h) / 2 - 3.2;
    for (let we = 0; we < le; we++) {
      let W = (we / le) * 6.283 - Math.PI / 2,
        Ue = Math.floor(E.cx + Math.cos(W) * ve) + 0.5,
        X = Math.floor(E.cz + Math.sin(W) * ve) + 0.5;
      (B("plate", Ue, X, { id: "plate_" + we, n: we }), V(Ue, X, 1));
    }
    K === "sequence" &&
      (B("pylon", E.cx, E.cz, { id: "pylon" }), (h.blk[h.idx(Math.floor(E.cx), Math.floor(E.cz))] = 1));
  }
  for (let K of k) {
    let le = Y(K, 2);
    B("spawnpack", le[0], le[1], { size: 3 + Math.floor(e() * 2), dark: K.dark, op: !0 });
  }
  for (let K of S) {
    let le = Y(K, 2);
    B("spawnpack", le[0], le[1], { size: 3 + Math.floor(e() * 2), dark: K.dark, op: !0 });
  }
  let be = S.length ? S : k;
  {
    let K = be[0],
      le = Y(K, 1);
    e() < 0.6 && (B("crate", le[0], le[1], {}), (h.blk[h.idx(Math.floor(le[0]), Math.floor(le[1]))] = 1));
  }
  if (be[1]) {
    let K = Y(be[1], 1),
      le = e();
    le < 0.35
      ? B("datapad", K[0], K[1], { opdp: !0 })
      : le < 0.6
        ? (B("shrine", K[0], K[1], {}), (h.blk[h.idx(Math.floor(K[0]), Math.floor(K[1]))] = 1))
        : le < 0.8 && (B("chest", K[0], K[1], { tier: 1 }), (h.blk[h.idx(Math.floor(K[0]), Math.floor(K[1]))] = 1));
  }
  let ye = [w, ...k, E, ...S];
  (G && ye.push(G),
    ap(
      h,
      ye.filter((K) => K !== E),
      l,
      a,
      f,
      N,
      e,
      B,
      0.09,
    ),
    B("light", E.cx - E.w * 0.25, E.cz - E.h * 0.25, { c: i === "hive" ? 13656319 : 16773328, model: "none" }),
    B("light", E.cx + E.w * 0.25, E.cz + E.h * 0.25, { c: i === "hive" ? 13656319 : 16773328, model: "none" }));
  for (let K of E.tiles) h.dark[K] = 0;
  return (
    (h.rooms = ye),
    (h.floorT = f),
    (h.encRoom = E),
    (h.totalPacks = h.ents.filter((K) => K.k === "spawnpack").length),
    ME(h, Math.floor(e() * 8)),
    h
  );
}


// ════════ [471] FunctionDeclaration ME (852 bytes) ════════
function ME(n, e) {
  if (!e) return;
  let t = n.w,
    i = e & 4,
    s = e & 1,
    a = e & 2,
    r = (f, u) => {
      let p = s ? t - 1 - f : f,
        m = a ? t - 1 - u : u;
      return (i && ([p, m] = [m, p]), m * t + p);
    },
    o = (f, u) => {
      let p = s ? t - f : f,
        m = a ? t - u : u;
      return (i && ([p, m] = [m, p]), [p, m]);
    },
    l = (f) => r(f % t, (f / t) | 0);
  for (let f of ["ter", "reg", "dark", "blk", "var", "wh"]) {
    let u = n[f],
      p = new u.constructor(u.length);
    for (let m = 0; m < u.length; m++) p[l(m)] = u[m];
    n[f] = p;
  }
  let c = (f) => {
    let [u, p] = o(f.x, f.z);
    ((f.x = u), (f.z = p));
  };
  for (let f of n.ents) {
    c(f);
    for (let u of ["tiles", "seal"]) Array.isArray(f[u]) && (f[u] = f[u].map(l));
  }
  for (let f of n.props) (c(f), i && (f.r = Math.PI / 2 - (f.r || 0)));
  for (let f of n.decor) c(f);
  let [d, h] = o(n.spawnBase[0], n.spawnBase[1]);
  n.spawnBase = [d, h];
  for (let f of n.rooms || []) {
    let [u, p] = o(f.x0, f.z0),
      [m, g] = o(f.x1 + 1, f.z1 + 1);
    ((f.x0 = Math.min(u, m)), (f.x1 = Math.max(u, m) - 1), (f.z0 = Math.min(p, g)), (f.z1 = Math.max(p, g) - 1));
    let [b, y] = o(f.cx, f.cz);
    ((f.cx = b), (f.cz = y), (f.tiles = new Set([...f.tiles].map(l))));
  }
}


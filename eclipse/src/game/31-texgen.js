// 31-texgen.js — Texturas de suelo procedurales (Lb)

// ════════ [717] VariableDeclaration Be (11 bytes) ════════
var Be = 256;


// ════════ [718] FunctionDeclaration cS (343 bytes) ════════
function cS(n, e) {
  let t = new Float32Array(e * e),
    i = n >>> 0;
  for (let s = 0; s < t.length; s++) ((i = (i * 1664525 + 1013904223) >>> 0), (t[s] = i / 4294967296));
  return (s, a) => {
    let r = Math.floor(s),
      o = Math.floor(a),
      l = s - r,
      c = a - o,
      d = ((r % e) + e) % e,
      h = ((o % e) + e) % e,
      f = (d + 1) % e,
      u = (h + 1) % e,
      p = l * l * (3 - 2 * l),
      m = c * c * (3 - 2 * c),
      g = t[h * e + d],
      b = t[h * e + f],
      y = t[u * e + d],
      v = t[u * e + f];
    return g + (b - g) * p + (y - g) * m + (g - b - y + v) * p * m;
  };
}


// ════════ [719] FunctionDeclaration ja (186 bytes) ════════
function ja(n, e, t = 4) {
  let i = [];
  for (let s = 0; s < t; s++) i.push(cS(n + s * 101, e << s));
  return (s, a) => {
    let r = 0,
      o = 0.5,
      l = 0;
    for (let c = 0; c < t; c++) {
      let d = e << c;
      ((r += i[c]((s / Be) * d, (a / Be) * d) * o), (l += o), (o *= 0.5));
    }
    return r / l;
  };
}


// ════════ [720] FunctionDeclaration $l (79 bytes) ════════
function $l(n) {
  let e = n >>> 0;
  return () => ((e = (e * 1664525 + 1013904223) >>> 0), e / 4294967296);
}


// ════════ [721] VariableDeclaration Xp (24 bytes) ════════
var Xp = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);


// ════════ [722] FunctionDeclaration dS (71 bytes) ════════
function dS(n) {
  let e = new Float32Array(Be * Be * 3).fill(0.85);
  return (n(e), e);
}


// ════════ [723] VariableDeclaration hS,ln (207 bytes) ════════
var hS = (n, e, t, i, s = i, a = i) => {
    ((e = ((e % Be) + Be) % Be), (t = ((t % Be) + Be) % Be));
    let r = (t * Be + e) * 3;
    ((n[r] = i), (n[r + 1] = s), (n[r + 2] = a));
  },
  ln = (n, e, t, i, s = i, a = i) => {
    ((e = (((e | 0) % Be) + Be) % Be), (t = (((t | 0) % Be) + Be) % Be));
    let r = (t * Be + e) * 3;
    ((n[r] *= i), (n[r + 1] *= s), (n[r + 2] *= a));
  };


// ════════ [724] FunctionDeclaration Ht (149 bytes) ════════
function Ht(n, e, t, i, s, a = 4, r = [1, 1, 1]) {
  let o = ja(e, t, a);
  for (let l = 0; l < Be; l++)
    for (let c = 0; c < Be; c++) {
      let d = i + (s - i) * o(c, l);
      hS(n, c, l, d * r[0], d * r[1], d * r[2]);
    }
}


// ════════ [725] FunctionDeclaration hn (153 bytes) ════════
function hn(n, e, t, i, s, a = 1) {
  let r = $l(e);
  for (let o = 0; o < t; o++) {
    let l = r() * Be,
      c = r() * Be,
      d = i + r() * (s - i);
    for (let h = 0; h < a; h++) for (let f = 0; f < a; f++) ln(n, l + h, c + f, d);
  }
}


// ════════ [726] FunctionDeclaration Uo (210 bytes) ════════
function Uo(n, e, t, i, s, a, r = null, o = 0.6) {
  let l = $l(e);
  for (let c = 0; c < t; c++) {
    let d = l() * Be,
      h = l() * Be,
      f = (r ?? l() * 6.283) + (l() - 0.5) * o,
      u = i * (0.5 + l()),
      p = s + l() * (a - s);
    for (let m = 0; m < u; m++) (ln(n, d, h, p), (d += Math.cos(f)), (h += Math.sin(f)));
  }
}


// ════════ [727] FunctionDeclaration Cs (229 bytes) ════════
function Cs(n, e, t, i, s) {
  let a = $l(e);
  for (let r = 0; r < t; r++) {
    let o = a() * Be,
      l = a() * Be,
      c = a() * 6.283;
    for (let d = 0; d < i; d++)
      (ln(n, o, l, s),
        a() < 0.3 && ln(n, o + 1, l, (1 + s) / 2),
        (c += (a() - 0.5) * 0.9),
        (o += Math.cos(c)),
        (l += Math.sin(c)),
        a() < 0.015 && (c += (a() < 0.5 ? 1 : -1) * 1.2));
  }
}


// ════════ [728] FunctionDeclaration ks (334 bytes) ════════
function ks(n, e, t, i, s, a, r = 0.08, o = !1) {
  let l = $l(a),
    c = Math.ceil(Be / t),
    d = Math.ceil(Be / e),
    h = [];
  for (let f = 0; f < c * d; f++) h.push(1 - r / 2 + l() * r);
  for (let f = 0; f < Be; f++)
    for (let u = 0; u < Be; u++) {
      let p = Math.floor(f / t),
        m = o && p % 2 ? e / 2 : 0,
        g = (u + m) % Be,
        b = Math.floor(g / e) % d,
        y = g % e,
        v = f % t,
        _ = h[(p % c) * d + b];
      y < i || v < i ? ln(n, u, f, s) : (ln(n, u, f, _), (y === i || v === i) && ln(n, u, f, 1.08));
    }
}


// ════════ [729] VariableDeclaration Lb,Pb,hh (4668 bytes) ════════
var Lb = {
    grass(n) {
      (Ht(n, 11, 6, 0.74, 0.98, 4),
        Uo(n, 12, 7e3, 6, 0.62, 0.82, -1.4, 1),
        Uo(n, 13, 2500, 5, 1.1, 1.25, -1.5, 0.9),
        hn(n, 14, 500, 0.7, 0.85, 3));
    },
    city(n) {
      (Ht(n, 21, 6, 0.74, 0.95, 4), hn(n, 22, 5e3, 0.85, 1.1), Cs(n, 23, 9, 70, 0.62), hn(n, 24, 60, 0.7, 0.85, 3));
    },
    sand(n) {
      Ht(n, 31, 3, 0.8, 0.97, 3);
      let e = ja(32, 4, 2);
      for (let t = 0; t < Be; t++)
        for (let i = 0; i < Be; i++) {
          let s = Math.sin((t + e(i, t) * 60) * 0.18) * 0.04;
          ln(n, i, t, 1 + s);
        }
      hn(n, 33, 9e3, 0.9, 1.08);
    },
    swamp(n) {
      (Ht(n, 41, 4, 0.66, 0.96, 4), Uo(n, 42, 1500, 4, 0.75, 0.9, -1.4, 1.2));
      let e = ja(43, 3, 3);
      for (let t = 0; t < Be; t++) for (let i = 0; i < Be; i++) e(i, t) > 0.62 && ln(n, i, t, 0.82, 0.86, 0.8);
    },
    snow(n) {
      (Ht(n, 51, 3, 0.86, 1, 3), hn(n, 52, 700, 1.05, 1.12), hn(n, 53, 220, 0.88, 0.95, 2));
    },
    plates(n) {
      (Ht(n, 61, 6, 0.78, 0.96, 3), ks(n, 64, 64, 2, 0.7, 62, 0.1), hn(n, 63, 4e3, 0.9, 1.06));
      for (let e = 6; e < Be; e += 64)
        for (let t = 6; t < Be; t += 64)
          for (let [i, s] of [
            [0, 0],
            [52, 0],
            [0, 52],
            [52, 52],
          ])
            (ln(n, t + i, e + s, 0.6), ln(n, t + i + 1, e + s, 0.7));
    },
    ash(n) {
      (Ht(n, 71, 5, 0.68, 0.95, 4), hn(n, 72, 6e3, 0.82, 1.1), Cs(n, 73, 14, 60, 0.6));
    },
    waste(n) {
      Ht(n, 81, 4, 0.74, 0.96, 4);
      let e = $l(82),
        t = 6,
        i = Be / t,
        s = [];
      for (let a = 0; a < t * t; a++)
        s.push([((a % t) + 0.15 + e() * 0.7) * i, (Math.floor(a / t) + 0.15 + e() * 0.7) * i]);
      for (let a = 0; a < Be; a++)
        for (let r = 0; r < Be; r++) {
          let o = 1e9,
            l = 1e9,
            c = Math.floor(r / i),
            d = Math.floor(a / i);
          for (let h = -1; h <= 1; h++)
            for (let f = -1; f <= 1; f++) {
              let u = (c + f + t) % t,
                p = (d + h + t) % t,
                [m, g] = s[p * t + u];
              ((m += (c + f - u) * i), (g += (d + h - p) * i));
              let b = r - m,
                y = a - g,
                v = b * b + y * y;
              v < o ? ((l = o), (o = v)) : v < l && (l = v);
            }
          Math.sqrt(l) - Math.sqrt(o) < 1.6 && ln(n, r, a, 0.62);
        }
    },
    hive(n) {
      (Ht(n, 91, 4, 0.7, 0.98, 4), Uo(n, 92, 120, 40, 0.78, 0.86, null, 0.5), hn(n, 93, 300, 1.08, 1.16, 2));
    },
    dirt(n) {
      (Ht(n, 101, 5, 0.74, 0.95, 4), hn(n, 102, 2400, 0.8, 1.12, 2), hn(n, 103, 120, 0.7, 0.85, 3));
    },
    asphalt(n) {
      (Ht(n, 111, 6, 0.8, 0.94, 3), hn(n, 112, 12e3, 0.86, 1.12), Cs(n, 113, 8, 80, 0.66));
    },
    concrete(n) {
      (Ht(n, 121, 5, 0.8, 0.96, 4),
        ks(n, 128, 128, 2, 0.72, 122, 0.06),
        hn(n, 123, 3e3, 0.9, 1.06),
        Cs(n, 124, 3, 40, 0.75));
    },
    tiles(n) {
      (Ht(n, 131, 6, 0.86, 0.98, 2), ks(n, 32, 32, 2, 0.66, 132, 0.12), hn(n, 133, 400, 0.85, 0.95, 2));
    },
    wood(n) {
      Ht(n, 141, 3, 0.8, 0.95, 2);
      let e = ja(142, 2, 3);
      for (let t = 0; t < Be; t++)
        for (let i = 0; i < Be; i++) {
          let s = Math.sin((t * 0.6 + e(i, t) * 30) * 0.9) * 0.05;
          ln(n, i, t, 1 + s);
        }
      ks(n, 256, 32, 2, 0.6, 143, 0.14);
      for (let t = 0; t < 8; t++) {
        let i = (t * 97) % Be;
        for (let s = t * 32; s < t * 32 + 32; s++) ln(n, i, s, 0.62);
      }
    },
    metal(n) {
      Ht(n, 151, 4, 0.82, 0.96, 3);
      for (let e = 0; e < Be; e++)
        for (let t = 0; t < Be; t++) {
          let i = (t + e) % 16,
            s = (t - e + Be * 4) % 16;
          ((i < 2 && e % 32 < 16) || (s < 2 && e % 32 >= 16)) && ln(n, t, e, 1.12);
        }
      ks(n, 128, 128, 3, 0.65, 152, 0.05);
    },
    adobe(n) {
      (Ht(n, 161, 4, 0.76, 0.97, 4), hn(n, 162, 1500, 0.86, 1.08, 2), Cs(n, 163, 6, 35, 0.72));
    },
    cave(n) {
      (Ht(n, 171, 5, 0.62, 0.98, 5), hn(n, 172, 900, 0.75, 0.9, 3), Cs(n, 173, 10, 50, 0.65));
    },
    organic(n) {
      (Ht(n, 181, 4, 0.66, 0.98, 4), Uo(n, 182, 160, 50, 0.72, 0.85, null, 0.4), hn(n, 183, 500, 1.06, 1.15, 3));
    },
    basefloor(n) {
      (Ht(n, 191, 6, 0.84, 0.96, 2), ks(n, 64, 64, 3, 0.64, 192, 0.07));
      for (let e = 0; e < Be; e += 64)
        for (let t = 0; t < Be; t += 64) for (let i = 0; i < 64; i++) ln(n, t + 31, e + i, 0.92);
    },
    ice(n) {
      (Ht(n, 201, 3, 0.88, 1, 3), Cs(n, 202, 12, 60, 0.82), hn(n, 203, 500, 1.05, 1.1));
    },
    arena(n) {
      (Ht(n, 211, 4, 0.74, 0.96, 4), ks(n, 48, 48, 3, 0.6, 212, 0.16, !0), hn(n, 213, 2e3, 0.85, 1.05));
    },
    w_concrete(n) {
      (Ht(n, 221, 5, 0.8, 0.96, 3), ks(n, 128, 85, 2, 0.74, 222, 0.06), hn(n, 223, 2500, 0.88, 1.06));
      for (let e = 20; e < Be; e += 64) for (let t = 0; t < Be; t += 85) (ln(n, e, t + 20, 0.6), ln(n, e, t + 60, 0.6));
    },
    w_brick(n) {
      (Ht(n, 231, 5, 0.78, 0.96, 3), ks(n, 32, 14, 2, 0.62, 232, 0.18, !0), hn(n, 233, 2500, 0.85, 1.05));
    },
    w_plaster(n) {
      (Ht(n, 241, 3, 0.82, 0.98, 4), hn(n, 242, 2e3, 0.9, 1.05), Cs(n, 243, 5, 45, 0.74));
      let e = ja(244, 3, 3);
      for (let t = 0; t < Be; t++) for (let i = 0; i < Be; i++) e(i, t) > 0.66 && ln(n, i, t, 0.88);
    },
    w_wood(n) {
      (Ht(n, 251, 3, 0.78, 0.94, 2), ks(n, 21, 256, 2, 0.58, 252, 0.16));
      let e = ja(253, 2, 3);
      for (let t = 0; t < Be; t++)
        for (let i = 0; i < Be; i++) ln(n, i, t, 1 + Math.sin((i * 0.7 + e(i, t) * 20) * 1.3) * 0.04);
    },
    w_log(n) {
      Ht(n, 261, 3, 0.8, 0.95, 2);
      for (let e = 0; e < Be; e++) {
        let t = e % 32,
          i = 0.7 + Math.sin((t / 32) * Math.PI) * 0.35;
        for (let s = 0; s < Be; s++) ln(n, s, e, i);
      }
      Uo(n, 262, 400, 30, 0.88, 0.95, 0, 0.05);
    },
    w_metal(n) {
      Ht(n, 271, 4, 0.82, 0.96, 3);
      for (let t = 0; t < Be; t++) {
        let i = 0.86 + Math.abs(Math.sin((t / 16) * Math.PI)) * 0.2;
        for (let s = 0; s < Be; s++) ln(n, t, s, i);
      }
      hn(n, 272, 200, 0.7, 0.85, 3);
      let e = ja(273, 4, 3);
      for (let t = 0; t < Be; t++) for (let i = 0; i < Be; i++) e(i, t) > 0.68 && ln(n, i, t, 0.92, 0.82, 0.72);
    },
    w_obsidian(n) {
      (Ht(n, 281, 5, 0.6, 0.98, 4), Cs(n, 282, 18, 50, 1.25));
    },
    w_organic(n) {
      Lb.organic(n);
    },
    cliff(n) {
      Ht(n, 291, 4, 0.7, 0.96, 4);
      let e = ja(292, 2, 3);
      for (let t = 0; t < Be; t++)
        for (let i = 0; i < Be; i++) {
          let s = Math.sin((t + e(i, t) * 50) * 0.25);
          ln(n, i, t, 1 + s * 0.06 + (s > 0.92 ? -0.15 : 0));
        }
      Cs(n, 293, 14, 60, 0.66);
    },
  },
  Pb = {
    ground_valle_a: "grass",
    ground_ciudad_a: "city",
    ground_desierto_a: "sand",
    ground_marisma_a: "swamp",
    ground_tundra_a: "snow",
    ground_complejo_a: "plates",
    ground_caldera_a: "ash",
    ground_yermo_a: "waste",
    ground_colmena_a: "hive",
    road_dirt: "dirt",
    road_asphalt: "asphalt",
    floor_concrete: "concrete",
    floor_tiles: "tiles",
    floor_wood: "wood",
    floor_metal: "metal",
    floor_adobe: "adobe",
    cave_floor: "cave",
    floor_organic: "organic",
    base_floor: "basefloor",
    ice: "ice",
    arena_floor: "arena",
    wall_military: "w_concrete",
    wall_ruin: "w_brick",
    wall_adobe: "w_plaster",
    wall_wood: "w_wood",
    wall_log: "w_log",
    wall_metal: "w_metal",
    wall_obsidian: "w_obsidian",
    wall_organic: "w_organic",
    cliff_valle: "cliff",
  },
  hh = new Uint8Array(4096);


// ════════ [730] ForStatement ForStatement (68 bytes) ════════
for (let n = 0; n < 4096; n++) hh[n] = Math.round(Math.pow(n / 4095, 1 / 2.2) * 255);


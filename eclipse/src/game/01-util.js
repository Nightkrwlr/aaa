// 01-util.js — Matemáticas, RNG, formateo, mezcla de colores

// ════════ [299] VariableDeclaration qe,ls,vl,Le,fi (226 bytes) ════════
var qe = (n, e, t) => (n < e ? e : n > t ? t : n),
  ls = (n, e, t) => n + (e - n) * t,
  vl = (n, e, t, i) => {
    let s = n - t,
      a = e - i;
    return s * s + a * a;
  },
  Le = (n, e, t, i) => Math.sqrt(vl(n, e, t, i)),
  fi = (n, e) => {
    let t = e - n;
    for (; t > Math.PI;) t -= Math.PI * 2;
    for (; t < -Math.PI;) t += Math.PI * 2;
    return t;
  };


// ════════ [300] FunctionDeclaration pi (283 bytes) ════════
function pi(n) {
  let e = n >>> 0,
    t = () => {
      ((e |= 0), (e = (e + 1831565813) | 0));
      let i = Math.imul(e ^ (e >>> 15), 1 | e);
      return ((i = (i + Math.imul(i ^ (i >>> 7), 61 | i)) ^ i), ((i ^ (i >>> 14)) >>> 0) / 4294967296);
    };
  return (
    (t.int = (i, s) => i + Math.floor(t() * (s - i + 1))),
    (t.range = (i, s) => i + t() * (s - i)),
    (t.pick = (i) => i[Math.floor(t() * i.length)]),
    (t.chance = (i) => t() < i),
    t
  );
}


// ════════ [301] VariableDeclaration Lt,Q,Rt (79 bytes) ════════
// la semilla puede fijarse desde fuera (window.__SEED) para capturas y pruebas reproducibles
var Lt = pi(window.__SEED != null ? window.__SEED >>> 0 : (Date.now() ^ (Math.random() * 1e9)) >>> 0),
  Q = () => Lt(),
  Rt = (n, e) => Lt.int(n, e);


// ════════ [302] VariableDeclaration Yt (39 bytes) ════════
var Yt = (n) => n[Math.floor(Lt() * n.length)];


// ════════ [303] FunctionDeclaration ii (130 bytes) ════════
function ii(n, e = "w", t = Lt) {
  let i = 0;
  for (let a of n) i += a[e];
  let s = t() * i;
  for (let a of n) if (((s -= a[e]), s <= 0)) return a;
  return n[n.length - 1];
}


// ════════ [304] FunctionDeclaration bd (111 bytes) ════════
function bd(n, e = Lt) {
  for (let t = n.length - 1; t > 0; t--) {
    let i = Math.floor(e() * (t + 1));
    [n[t], n[i]] = [n[i], n[t]];
  }
  return n;
}


// ════════ [305] FunctionDeclaration Ii (567 bytes) ════════
function Ii(n) {
  let e = new Uint8Array(512),
    t = pi(n),
    i = Array.from({ length: 256 }, (o, l) => l);
  bd(i, t);
  for (let o = 0; o < 512; o++) e[o] = i[o & 255];
  let s = (o, l, c) => {
      let d = o & 7,
        h = d < 4 ? l : c,
        f = d < 4 ? c : l;
      return (d & 1 ? -h : h) + (d & 2 ? -2 * f : 2 * f);
    },
    a = (o) => o * o * o * (o * (o * 6 - 15) + 10);
  function r(o, l) {
    let c = Math.floor(o) & 255,
      d = Math.floor(l) & 255;
    ((o -= Math.floor(o)), (l -= Math.floor(l)));
    let h = a(o),
      f = a(l),
      u = e[c] + d,
      p = e[c + 1] + d;
    return (
      ls(ls(s(e[u], o, l), s(e[p], o - 1, l), h), ls(s(e[u + 1], o, l - 1), s(e[p + 1], o - 1, l - 1), h), f) * 0.9
    );
  }
  return (
    (r.fbm = (o, l, c = 4) => {
      let d = 0,
        h = 0.5,
        f = 1,
        u = 0;
      for (let p = 0; p < c; p++) ((d += h * r(o * f, l * f)), (u += h), (h *= 0.5), (f *= 2));
      return d / u;
    }),
    r
  );
}


// ════════ [306] VariableDeclaration pw,mi (70 bytes) ════════
var pw = 1,
  mi = () => (pw++).toString(36) + Math.floor(Lt() * 1e6).toString(36);


// ════════ [307] FunctionDeclaration yt (184 bytes) ════════
function yt(n) {
  n = Math.round(n);
  let e = Math.abs(n);
  return e >= 1e9
    ? (n / 1e9).toFixed(e >= 1e10 ? 0 : 1) + "B"
    : e >= 1e6
      ? (n / 1e6).toFixed(e >= 1e7 ? 0 : 1) + "M"
      : e >= 1e4
        ? (n / 1e3).toFixed(e >= 1e5 ? 0 : 1) + "k"
        : String(n);
}


// ════════ [308] VariableDeclaration Xs (124 bytes) ════════
var Xs = (n) => {
  n = Math.max(0, Math.ceil(n));
  let e = Math.floor(n / 60),
    t = n % 60;
  return e > 0 ? `${e}:${String(t).padStart(2, "0")}` : `${t}s`;
};


// ════════ [309] FunctionDeclaration tt (165 bytes) ════════
function tt(n, e, t) {
  let i = (n >> 16) & 255,
    s = (n >> 8) & 255,
    a = n & 255,
    r = (e >> 16) & 255,
    o = (e >> 8) & 255,
    l = e & 255;
  return (Math.round(ls(i, r, t)) << 16) | (Math.round(ls(s, o, t)) << 8) | Math.round(ls(a, l, t));
}


// ════════ [310] FunctionDeclaration ke (121 bytes) ════════
function ke(n) {
  return String(n).replace(
    /[&<>"']/g,
    (e) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[e],
  );
}


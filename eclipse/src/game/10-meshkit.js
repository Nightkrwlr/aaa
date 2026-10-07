// 10-meshkit.js — Materiales cacheados (de, Me) y ayudantes de malla

// ════════ [356] VariableDeclaration Cg (15 bytes) ════════
var Cg = new Map();


// ════════ [357] FunctionDeclaration de (293 bytes) ════════
// Materiales por tipo (opción k): rugosidad/metalicidad típicas. r y m explícitos mandan sobre el tipo.
//   metal: acero pulido · paint: pintura brillante · rubber/cloth/stone: mates · glass: cristal oscuro y especular · emit: pantalla/luz
var DeKinds = {
  metal: { r: 0.36, m: 0.7 },
  paint: { r: 0.48, m: 0.3 },
  rubber: { r: 0.95, m: 0 },
  cloth: { r: 0.92, m: 0 },
  stone: { r: 0.9, m: 0.02 },
  glass: { r: 0.08, m: 0.65 },
  emit: { r: 0.5, m: 0 },
};
function de(n, e = {}) {
  let k = DeKinds[e.k] || {},
    r = e.r ?? k.r ?? 0.75,
    m = e.m ?? k.m ?? 0.1,
    t = n + "|" + (e.e ?? "") + "|" + r + "|" + m + "|" + (e.t ?? "") + "|" + (e.flat ?? 1) + "|" + (e.ei ?? ""),
    i = Cg.get(t);
  return (
    i ||
      ((i = new Xt({
        color: n,
        roughness: r,
        metalness: m,
        flatShading: e.flat !== 0,
        emissive: e.e ?? 0,
        emissiveIntensity: e.ei ?? 1,
        transparent: !!e.t,
        opacity: e.t ?? 1,
      })),
      // brillo especular donde toca: metal y superficies lisas reflejan un entorno falso (cielo/suelo) sin mapas de entorno;
      // un emisivo HDR (ei > 1) deja de apagarse con la luz y alimenta el bloom
      (m >= 0.25 || r <= 0.3) && PkGloss(i, { env: Math.min(1.2, 0.35 + m * 0.9 + (0.3 - Math.min(0.3, r))), rim: 0.12 }),
      Cg.set(t, i)),
    i
  );
}


// ════════ [358] VariableDeclaration kg (15 bytes) ════════
var kg = new Map();


// ════════ [359] FunctionDeclaration Me (182 bytes) ════════
function Me(n, e = 1, t = !1) {
  let i = n + "|" + e + "|" + t,
    s = kg.get(i);
  return (
    s ||
      ((s = new vt({
        color: n,
        toneMapped: !1,
        transparent: e < 1 || t,
        opacity: e,
        blending: t ? en : Wi,
        depthWrite: !t && e >= 1,
      })),
      kg.set(i, s)),
    s
  );
}


// ════════ [360] VariableDeclaration Pg,kd,zg,Es,ue,je,wt,Cl,Xn,gr,Qs,wi,za,ea (719 bytes) ════════
var Pg = new vt({ color: 16777215, toneMapped: !1 }),
  kd = new Xt({ color: 11067647, emissive: 3178688, emissiveIntensity: 0.8, roughness: 0.2, flatShading: !0 }),
  zg = new Map(),
  Es = (n, e) => {
    let t = zg.get(n);
    return (t || ((t = e()), zg.set(n, t)), t);
  },
  ue = (n, e, t) => Es(`b${n},${e},${t}`, () => new kn(n, e, t)),
  je = (n, e, t, i = 8) => Es(`c${n},${e},${t},${i}`, () => new ni(n, e, t, i)),
  wt = (n, e = 8, t = 6) => Es(`s${n},${e},${t}`, () => new rr(n, e, t)),
  Cl = (n) => Es(`h${n}`, () => new rr(n, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)),
  Xn = (n, e, t = 6) => Es(`k${n},${e},${t}`, () => new oo(n, e, t)),
  gr = (n, e = 0) => Es(`i${n},${e}`, () => new ya(n, e)),
  Qs = (n) => Es(`o${n}`, () => new _a(n, 0)),
  wi = (n, e, t = 6, i = 14) => Es(`t${n},${e},${t},${i}`, () => new Yi(n, e, t, i)),
  za = (n) => Es(`d${n}`, () => new lo(n, 0)),
  ea = (n, e) => Es(`p${n},${e}`, () => new Pi(n, e));


// ════════ [361] FunctionDeclaration D (244 bytes) ════════
function D(n, e, t = 0, i = 0, s = 0, a = {}) {
  let r = new Ge(n, e);
  return (
    r.position.set(t, i, s),
    a.rx && (r.rotation.x = a.rx),
    a.ry && (r.rotation.y = a.ry),
    a.rz && (r.rotation.z = a.rz),
    a.s && r.scale.set(...(Array.isArray(a.s) ? a.s : [a.s, a.s, a.s])),
    (r.castShadow = a.shadow ?? !0),
    r
  );
}


// ════════ [362] FunctionDeclaration Ei (205 bytes) ════════
function Ei(n = 0.5, e = 0.45) {
  let t = new Ge(ea(1, 1), new vt({ map: cr(), color: 0, transparent: !0, opacity: e, depthWrite: !1 }));
  return (
    (t.rotation.x = -Math.PI / 2),
    (t.position.y = 0.02),
    t.scale.set(n * 2.4, n * 2.4, 1),
    (t.renderOrder = 1),
    t
  );
}


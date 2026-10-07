// 25-save.js — Guardado local/nube

// ════════ [614] VariableDeclaration Vx,Rp,Cp,th,Gx,Tp (60 bytes) ════════
var Vx = "opeclipse_save_v1",
  Rp = null,
  Cp = null,
  th = !1,
  Gx = 0,
  Tp = !1;


// ════════ [615] FunctionDeclaration kp (793 bytes) ════════
function kp(n, e) {
  return {
    v: 1,
    name: n || "Espectro",
    diff: e || "soldado",
    created: Date.now(),
    t: Date.now(),
    playTime: 0,
    lvl: 1,
    xp: 0,
    perks: {},
    research: {},
    pendingPerks: 0,
    credits: 50,
    mats: { scrap: 0, bio: 0, crystal: 0, core: 0, data: 0, battery: 0 },
    cons: { medkit: 2, stim: 0, grenade: 3 },
    inv: [],
    eq: { w1: null, w2: null, helmet: null, suit: null, gloves: null, boots: null, implant: null, module: null },
    activeW: 0,
    flags: {},
    quests: { active: {}, done: {}, rep: {}, board: null, qitems: {} },
    world: {
      term: {},
      chests: {},
      dp: {},
      beacons: { beacon_0: 1 },
      gates: {},
      bosses: {},
      nests: {},
      shrines: {},
      crystals: {},
      crates: {},
      lock: {},
      secrets: {},
    },
    fog: null,
    pos: null,
    lastBeacon: "beacon_0",
    time: 0.3,
    stats: { kills: 0, deaths: 0, bosses: 0, ops: 0, elites: 0, terminals: 0, dist: 0 },
    shop: null,
    lore: [],
    seenTips: {},
    settings: { quality: "high", aim: "auto", sfx: 0.7, music: 0.45, zoom: 23, autoSalvage: 0, dmgNums: !0 },
  };
}


// ════════ [616] FunctionDeclaration qx (238 bytes) ════════
async function qx() {
  try {
    if (!window.claude || !window.claude.use) return !1;
    let [n, e] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!n || !e) return !1;
    let t = await e.id();
    return t ? ((Rp = n), (Cp = t), (th = !0), !0) : !1;
  } catch {
    return !1;
  }
}


// ════════ [617] VariableDeclaration nh (14 bytes) ════════
var nh = () => th;


// ════════ [618] FunctionDeclaration Wx (96 bytes) ════════
function Wx() {
  try {
    let n = localStorage.getItem(Vx);
    return n ? JSON.parse(n) : null;
  } catch {
    return null;
  }
}


// ════════ [619] FunctionDeclaration FE (210 bytes) ════════
async function FE() {
  if (!th) return null;
  try {
    let n = await Rp.doc(`data/users/${Cp}/save`).get(),
      e = n && n.exists ? n.data() : null;
    if (e && e.json) return JSON.parse(e.json);
  } catch (n) {
    console.warn("cloud read", n);
  }
  return null;
}


// ════════ [620] FunctionDeclaration zp (83 bytes) ════════
async function zp() {
  let n = Wx(),
    e = await FE();
  return n && e ? ((e.t || 0) > (n.t || 0) ? e : n) : e || n;
}


// ════════ [621] FunctionDeclaration jx (27 bytes) ════════
function jx() {
  return !!Wx();
}


// ════════ [622] VariableDeclaration Ap (10 bytes) ════════
var Ap = !1;


// ════════ [623] FunctionDeclaration Ui (489 bytes) ════════
function Ui(n = !1) {
  let e = x.S;
  if (!e) return;
  ((e.t = Date.now()),
    x.player && x.mode === "world" && (e.pos = { x: +x.player.x.toFixed(2), z: +x.player.z.toFixed(2) }),
    x.world && x.world.fogBits && (e.fog = Pp(x.world.fogBits)));
  let t = JSON.stringify(e);
  try {
    localStorage.setItem(Vx, t);
  } catch {}
  let i = Date.now();
  if (th && (n || i - Gx > 4e4)) {
    if (Tp) {
      n && (Ap = !0);
      return;
    }
    ((Gx = i),
      (Tp = !0),
      Rp.doc(`data/users/${Cp}/save`)
        .set({ json: t, t: e.t, lvl: e.lvl, name: e.name })
        .catch((s) => console.warn("cloud save", s))
        .finally(() => {
          ((Tp = !1), Ap && ((Ap = !1), Ui(!0)));
        }));
  }
}


// ════════ [624] FunctionDeclaration $x (97 bytes) ════════
function $x() {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(x.S))));
  } catch {
    return "";
  }
}


// ════════ [625] FunctionDeclaration Xx (125 bytes) ════════
function Xx(n) {
  try {
    let e = JSON.parse(decodeURIComponent(escape(atob(n.trim()))));
    if (e && e.v && e.lvl) return e;
  } catch {}
  return null;
}


// ════════ [626] FunctionDeclaration Pp (128 bytes) ════════
function Pp(n) {
  let e = "";
  for (let i = 0; i < n.length; i += 32768) e += String.fromCharCode.apply(null, n.subarray(i, i + 32768));
  return btoa(e);
}


// ════════ [627] FunctionDeclaration Yx (135 bytes) ════════
function Yx(n, e) {
  let t = new Uint8Array(e);
  try {
    let i = atob(n);
    for (let s = 0; s < Math.min(e, i.length); s++) t[s] = i.charCodeAt(s);
  } catch {}
  return t;
}


// ════════ [628] VariableDeclaration BE,Kx (33 bytes) ════════
var BE = [6, 7, 7, 8, 8, 8, 8, 9, 9],
  Kx = 26;


// ════════ [629] FunctionDeclaration Jx (87 bytes) ════════
function Jx() {
  let n = 0;
  for (let e of x.enemies) !e.dead && !e.static && !e.boss && n++;
  return n;
}


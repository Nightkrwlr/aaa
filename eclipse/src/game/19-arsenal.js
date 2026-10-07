// 19-arsenal.js — Arsenal: módulos, mejoras, desguace

// ════════ [473] VariableDeclaration mp (10 bytes) ════════
var mp = {};


// ════════ [474] ExpressionStatement ExpressionStatement (475 bytes) ════════
r0(mp, {
  acquire: () => Ss,
  addChip: () => Ts,
  ascend: () => cp,
  ascendCost: () => qd,
  baseName: () => Ol,
  canLevel: () => Vd,
  canPay: () => op,
  chipCss: () => sa,
  chipDesc: () => rp,
  chipName: () => ts,
  chipSalvage: () => Xd,
  compatible: () => jd,
  equippedRef: () => Hd,
  fuse: () => up,
  fuseGroups: () => $d,
  genBlueprint: () => us,
  genChip: () => xi,
  itemPower: () => es,
  kindOf: () => ia,
  levelCost: () => Gd,
  levelUp: () => Wd,
  migrateArsenal: () => pp,
  modSlots: () => Ga,
  ownedOf: () => Dl,
  pay: () => lp,
  pieces: () => Mx,
  salvageChip: () => fp,
  socket: () => dp,
  unsocket: () => hp,
});


// ════════ [475] VariableDeclaration Il (71 bytes) ════════
var Il = ["w1", "w2", "helmet", "suit", "gloves", "boots", "implant", "module"];


// ════════ [476] FunctionDeclaration es (167 bytes) ════════
function es(n) {
  if (!n) return 0;
  let e = n.ilvl * 10 * Ct[n.r].mult * (1 + 0.06 * (n.upg || 0));
  for (let t of n.aff || []) e += 6 * (t.t || 1);
  return (n.pow && (e += 35), n.pow2 && (e += 35), Math.round(e));
}


// ════════ [477] FunctionDeclaration Hd (188 bytes) ════════
function Hd(n) {
  let e = x.S;
  if (n.type === "weapon") {
    let t = [e.eq.w1, e.eq.w2].filter((i) => i && i !== n);
    return t.length ? t.reduce((i, s) => (es(i) <= es(s) ? i : s)) : null;
  }
  return e.eq[n.slot] !== n ? e.eq[n.slot] : null;
}


// ════════ [478] VariableDeclaration ia (36 bytes) ════════
var ia = (n) => (n.type === "weapon" ? "w" : "g");


// ════════ [479] FunctionDeclaration Mx (79 bytes) ════════
function Mx() {
  let n = x.S;
  return [...Il.map((e) => n.eq[e]).filter(Boolean), ...n.inv];
}


// ════════ [480] FunctionDeclaration Dl (53 bytes) ════════
function Dl(n) {
  return Mx().find((e) => e.base === n) || null;
}


// ════════ [481] FunctionDeclaration Ga (33 bytes) ════════
function Ga(n) {
  return ur[n.r] ?? 1;
}


// ════════ [482] FunctionDeclaration ts (115 bytes) ════════
function ts(n) {
  return n.pow ? `M\xF3dulo legendario \xB7 ${Gn[n.pow].n}` : `M\xF3dulo ${Sl[n.s]?.n || n.s} \xB7 T${n.t}`;
}


// ════════ [483] FunctionDeclaration rp (52 bytes) ════════
function rp(n) {
  return n.pow ? Gn[n.pow].d : Ks(n.s, n.v);
}


// ════════ [484] VariableDeclaration sa (33 bytes) ════════
var sa = (n) => Ct[qe(n.t || 1, 1, 5)].css;


// ════════ [485] FunctionDeclaration us (359 bytes) ════════
function us(n, e = {}) {
  let t = x.S,
    i = e.type ? e.type === "weapon" : Lt() < (e.weaponChance ?? 0.45),
    s = qe(Math.round(n), 1, 70),
    r = Object.entries(i ? Hn : ai).filter(([h, f]) => f.minLvl <= s + 2 && (!e.slot || f.slot === e.slot)),
    o = r.filter(([h]) => !Dl(h)),
    l = o.length && Lt() < (e.newChance ?? 0.75) ? o : r,
    c = l[Math.floor(Lt() * l.length)][0],
    d = e.rarity ?? yo(e.luck || 0, e.minR || 0);
  return i ? Ca(s, d, c) : Js(s, d, c);
}


// ════════ [486] FunctionDeclaration xi (127 bytes) ════════
function xi(n, e = {}) {
  return e.pow
    ? mf(e.kind || (Lt() < 0.5 ? "w" : "g"))
    : pf(e.kind || (Lt() < 0.5 ? "w" : "g"), n, e.tier ?? gf(e.luck || 0, e.minT || 1));
}


// ════════ [487] FunctionDeclaration wE (138 bytes) ════════
function wE(n) {
  return (
    (n.aff = (n.aff || []).map((e) => ({ id: e.id || mi(), kind: ia(n), s: e.s, v: e.v, t: e.t || qe(n.r, 1, 5) }))),
    (n.upg = n.upg || 0),
    (n.name = Ol(n)),
    n
  );
}


// ════════ [488] FunctionDeclaration Ol (117 bytes) ════════
function Ol(n) {
  let e = n.type === "weapon" ? Hn[n.base].n : ai[n.base].n;
  return n.pow ? `\xAB${Gn[n.pow].names[0]}\xBB ${e}` : e;
}


// ════════ [489] FunctionDeclaration Ss (871 bytes) ════════
function Ss(n, e = {}) {
  let t = x.S;
  t.chips || (t.chips = []);
  let i = Dl(n.base);
  if (!i)
    return (
      wE(n),
      (n.isNew = !0),
      t.inv.push(n),
      e.silent || ee("toast", `Nuevo plano: ${n.name}`, "good"),
      ee("inv"),
      { kind: "new", piece: n }
    );
  let s = [];
  (n.r > i.r && ((i.r = n.r), s.push(`rango ${Ct[n.r].n}`)),
    n.ilvl > i.ilvl && ((i.ilvl = Math.min(n.ilvl, Math.max(t.lvl, i.ilvl))), s.push(`nivel ${i.ilvl}`)));
  let a = n.aff || [];
  if (a.length) {
    let o = a[Math.floor(Lt() * a.length)];
    (t.chips.push({ id: mi(), kind: ia(n), s: o.s, v: o.v, t: qe(n.r, 1, 5) }), s.push("1 m\xF3dulo"));
  }
  for (let o of [n.pow, n.pow2])
    o && (t.chips.push({ id: mi(), kind: ia(n), pow: o, t: 5 }), s.push("m\xF3dulo legendario"));
  let r = hr(n);
  for (let o in r) {
    let l = Math.max(1, Math.round(r[o] * 0.5));
    t.mats[o] = (t.mats[o] || 0) + l;
  }
  return (
    s.push("materiales"),
    e.silent || ee("toast", `Plano repetido (${i.name}) \u2192 ${s.join(", ")}`, "quest"),
    x.player?.recalc(),
    ee("inv"),
    ee("res"),
    { kind: "dup", piece: i, gains: s }
  );
}


// ════════ [490] FunctionDeclaration Ts (129 bytes) ════════
function Ts(n, e = {}) {
  let t = x.S;
  (t.chips || (t.chips = []),
    t.chips.push(n),
    e.silent || ee("loot", { name: ts(n), r: qe(n.t || 1, 1, 5) }),
    ee("inv"));
}


// ════════ [491] FunctionDeclaration Gd (202 bytes) ════════
function Gd(n) {
  let e = n.ilvl,
    t = { credits: Math.round(18 * mt.credits(e) * (1 + n.r * 0.15)) };
  return (
    n.type === "weapon" ? (t.scrap = 3 + Math.floor(e * 0.45)) : (t.bio = 3 + Math.floor(e * 0.45)),
    e % 5 === 4 && (t.crystal = 1 + Math.floor(e / 12)),
    t
  );
}


// ════════ [492] VariableDeclaration Vd,EE (153 bytes) ════════
var Vd = (n) => n.ilvl < Math.min(70, x.S.lvl),
  EE = [
    null,
    { crystal: 2 },
    { crystal: 4, core: 1 },
    { crystal: 7, core: 3 },
    { crystal: 10, core: 6, data: 4 },
    { crystal: 15, core: 10, data: 8 },
  ];


// ════════ [493] FunctionDeclaration qd (120 bytes) ════════
function qd(n) {
  if (n.r >= 5) return null;
  let e = { ...EE[n.r + 1] };
  return ((e.credits = Math.round(120 * mt.credits(n.ilvl) * (n.r + 1))), e);
}


// ════════ [494] FunctionDeclaration op (108 bytes) ════════
function op(n) {
  let e = x.S;
  return Object.entries(n).every(([t, i]) => (t === "credits" ? e.credits : e.mats[t] || 0) >= i);
}


// ════════ [495] FunctionDeclaration lp (108 bytes) ════════
function lp(n) {
  let e = x.S;
  for (let [t, i] of Object.entries(n)) t === "credits" ? (e.credits -= i) : (e.mats[t] -= i);
  ee("res");
}


// ════════ [496] FunctionDeclaration Wd (122 bytes) ════════
function Wd(n, e = 1) {
  let t = 0;
  for (; t < e && Vd(n);) {
    let i = Gd(n);
    if (!op(i)) break;
    (lp(i), n.ilvl++, t++);
  }
  return (t && x.player.recalc(), t);
}


// ════════ [497] FunctionDeclaration cp (82 bytes) ════════
function cp(n) {
  let e = qd(n);
  return !e || !op(e) ? !1 : (lp(e), n.r++, x.player.recalc(), !0);
}


// ════════ [498] FunctionDeclaration jd (155 bytes) ════════
function jd(n, e) {
  return e.kind !== ia(n)
    ? !1
    : e.pow
      ? e.pow === "overheat" && Hn[n.base]?.kind === "beam"
        ? !1
        : ![n.pow, n.pow2].includes(e.pow)
      : !n.aff.some((t) => t.s === e.s);
}


// ════════ [499] FunctionDeclaration dp (521 bytes) ════════
function dp(n, e) {
  let t = x.S;
  if (!jd(n, e)) return "Ya tiene un m\xF3dulo de ese tipo";
  if (e.pow) {
    let i = Zs(n);
    if (!i) return "Asciende la pieza a Legendario para instalar m\xF3dulos legendarios";
    if (!n.pow) n.pow = e.pow;
    else if (i > 1 && !n.pow2) n.pow2 = e.pow;
    else return "Ranuras de poder ocupadas";
  } else {
    if (n.aff.length >= Ga(n)) return "No quedan ranuras libres (asciende la pieza para tener m\xE1s)";
    n.aff.push({ id: e.id, kind: e.kind, s: e.s, v: e.v, t: e.t });
  }
  return (t.chips.splice(t.chips.indexOf(e), 1), (n.name = Ol(n)), x.player.recalc(), ee("inv"), null);
}


// ════════ [500] FunctionDeclaration hp (348 bytes) ════════
function hp(n, e) {
  let t = x.S;
  if ((t.chips || (t.chips = []), e === "pow" || e === "pow2")) {
    let i = n[e];
    if (!i) return;
    (t.chips.push({ id: mi(), kind: ia(n), pow: i, t: 5 }),
      (n[e] = null),
      e === "pow" && n.pow2 && ((n.pow = n.pow2), (n.pow2 = null)));
  } else {
    let i = n.aff.splice(e, 1)[0];
    if (!i) return;
    t.chips.push({ id: i.id || mi(), kind: ia(n), s: i.s, v: i.v, t: i.t || 1 });
  }
  ((n.name = Ol(n)), x.player.recalc(), ee("inv"));
}


// ════════ [501] FunctionDeclaration $d (183 bytes) ════════
function $d() {
  let n = x.S,
    e = {};
  for (let t of n.chips || []) {
    if (t.pow || t.t >= 5) continue;
    let i = t.kind + "|" + t.s + "|" + t.t;
    (e[i] || (e[i] = [])).push(t);
  }
  return Object.values(e).filter((t) => t.length >= 3);
}


// ════════ [502] FunctionDeclaration up (317 bytes) ════════
function up(n) {
  let e = x.S,
    t = n.slice(0, 3);
  for (let a of t) e.chips.splice(e.chips.indexOf(a), 1);
  let i = Math.max(...t.map((a) => a.v)),
    s = { id: mi(), kind: t[0].kind, s: t[0].s, t: t[0].t + 1, v: i };
  return (
    typeof i == "number" &&
      !["multishot", "pierce", "ricochet", "execute"].includes(s.s) &&
      (s.v = +(i * 1.2).toFixed(4)),
    e.chips.push(s),
    ee("inv"),
    s
  );
}


// ════════ [503] FunctionDeclaration Xd (93 bytes) ════════
function Xd(n) {
  return n.pow ? { core: 3, crystal: 4 } : { crystal: n.t >= 3 ? n.t - 1 : 0, data: n.t, scrap: 2 * n.t };
}


// ════════ [504] FunctionDeclaration fp (152 bytes) ════════
function fp(n) {
  let e = x.S,
    t = Xd(n);
  for (let i in t) t[i] && (e.mats[i] = (e.mats[i] || 0) + t[i]);
  return (e.chips.splice(e.chips.indexOf(n), 1), ee("res"), ee("inv"), t);
}


// ════════ [505] FunctionDeclaration pp (1128 bytes) ════════
function pp(n) {
  if (n.arsenalV) return null;
  ((n.arsenalV = 1), n.chips || (n.chips = []));
  let e = (o) => o.r * 1e3 + o.ilvl * 10 + (o.upg || 0),
    t = new Map();
  for (let o of [...Il.map((l) => n.eq[l]).filter(Boolean), ...n.inv]) {
    let l = t.get(o.base);
    (!l || e(o) > e(l)) && t.set(o.base, o);
  }
  let i = new Set(t.values());
  for (let o of Il) {
    let l = n.eq[o];
    if (!l) continue;
    let c = t.get(l.base);
    c !== l && !Il.some((d) => n.eq[d] === c)
      ? ((n.inv = n.inv.filter((d) => d !== c)), n.inv.push(l), (n.eq[o] = c))
      : i.add(l);
  }
  let s = 0,
    a = {},
    r = [];
  for (let o of n.inv) {
    if (i.has(o)) {
      r.push(o);
      continue;
    }
    s++;
    let l = hr(o);
    for (let c in l) a[c] = (a[c] || 0) + l[c];
    if (o.r >= 2 && o.aff?.length) {
      let c = o.aff.reduce((d, h) => (h.v > (d?.v ?? -1) ? h : d), null);
      n.chips.push({ id: mi(), kind: o.type === "weapon" ? "w" : "g", s: c.s, v: c.v, t: qe(o.r, 1, 5) });
    }
    for (let c of [o.pow, o.pow2]) c && n.chips.push({ id: mi(), kind: o.type === "weapon" ? "w" : "g", pow: c, t: 5 });
  }
  n.inv = r;
  for (let o in a) n.mats[o] = (n.mats[o] || 0) + a[o];
  for (let o of [...Il.map((l) => n.eq[l]).filter(Boolean), ...n.inv]) {
    for (
      o.aff = (o.aff || []).map((l) => ({
        id: l.id || mi(),
        kind: o.type === "weapon" ? "w" : "g",
        s: l.s,
        v: l.v,
        t: l.t || qe(o.r, 1, 5),
      }));
      o.aff.length > (ur[o.r] ?? 1);
    ) {
      let l = o.aff.pop();
      n.chips.push({ ...l });
    }
    o.name = Ol(o);
  }
  return { conv: s, mats: a };
}


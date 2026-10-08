// 20-pickups.js — Botín en el suelo y recogida

// ════════ [506] VariableDeclaration wx,SE (103 bytes) ════════
var wx = 60,
  SE = { scrap: 12107976, bio: 8313175, crystal: 12610559, core: 4251903, data: 16766023, battery: 16769162 };


// ════════ [507] FunctionDeclaration Ex (143 bytes) ════════
function Ex() {
  let n = x.player,
    e = Di[x.S.diff] || Di.soldado;
  return (1 + (n.st.luck || 0) + (n.buffs.fortune ? 1 : 0) + (n.powers.has("luckyStar") ? 0.5 : 0)) * e.loot;
}


// ════════ [508] FunctionDeclaration Sx (111 bytes) ════════
function Sx() {
  let n = x.player;
  return 1 + (n.st.credits || 0) + (n.buffs.fortune ? 1 : 0) + (n.powers.has("luckyStar") ? 0.5 : 0);
}


// Haz de luz del botín: geometría compartida y un material por color (degradado vertical + borde suave en el shader, HDR)
var ckBeamGeo = null,
  ckBeamMats = new Map();
function ckLootBeam(color, height, radius) {
  ckBeamGeo || ((ckBeamGeo = new ni(0.3, 1, 1, 14, 1, !0)), ckBeamGeo.translate(0, 0.5, 0));
  let m = ckBeamMats.get(color);
  m ||
    ((m = new wn({
      uniforms: { uCol: { value: new Ee(color).multiplyScalar(2.1) }, uT: CkFxTime },
      vertexShader: `varying vec2 vUv; varying float vE; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vE = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uT; varying vec2 vUv; varying float vE;
        void main(){ float y = vUv.y; float a = pow(max(1.0 - y, 0.0), 1.7) * smoothstep(0.0, 0.06, y) * pow(max(vE, 0.0), 1.4);
          a *= 0.8 + 0.2 * sin(y * 16.0 - uT * 2.6); gl_FragColor = vec4(uCol * (0.6 + 0.8 * (1.0 - y)), a * 0.62); }`,
      transparent: !0,
      blending: en,
      depthWrite: !1,
      toneMapped: !1,
      fog: !1,
    })),
    ckBeamMats.set(color, m));
  let t = new Ge(ckBeamGeo, m);
  return (t.scale.set(radius, height, radius), (t.renderOrder = 6), (t.frustumCulled = !1), t);
}


// ════════ [509] FunctionDeclaration Nt (1113 bytes) ════════
function Nt(n, e, t, i = {}) {
  let s = Q() * 6.28,
    a = i.spd ?? 1.5 + Q() * 3,
    r = {
      k: n,
      x: e,
      z: t,
      y: 0.6,
      vx: Math.cos(s) * a,
      vz: Math.sin(s) * a,
      vy: 3 + Q() * 2,
      t: 0,
      life: i.life ?? 90,
      ...i,
    };
  if (n === "item" || n === "cap" || n === "qi" || n === "chip") {
    let o = new Ve(),
      l;
    if (n === "item") (o.add(Gg(r.item)), (l = Ct[r.item.r].c));
    else if (n === "chip") {
      l = Ct[Math.min(5, r.chip.t || 1)].c;
      let u = new Ge(new ni(0.17, 0.17, 0.06, 6), Me(l));
      ((u.rotation.x = Math.PI / 2), o.add(u));
      let p = new Ge(new kn(0.12, 0.12, 0.08), Me(659218));
      if ((o.add(p), r.chip.pow)) {
        let m = new Ge(new Yi(0.26, 0.025, 4, 18), Me(16777215));
        o.add(m);
      }
    } else if (n === "cap") {
      l = parseInt(Oi[r.buff].c.slice(1), 16);
      let u = new Ge(new Qc(0.13, 0.25, 4, 8), Me(l));
      ((u.rotation.z = Math.PI / 2), o.add(u));
      let p = new Ge(new Yi(0.28, 0.02, 4, 16), Me(16777215));
      o.add(p);
    } else {
      l = 16766023;
      let u = new Ge(new _a(0.16), Me(l));
      o.add(u);
    }
    let c = n === "item" ? r.item.r : n === "chip" ? r.chip.t || 1 : 0,
      d = n === "item" || n === "chip" ? 1.5 + c * 1.2 : 1.6,
      h = ckLootBeam(l, d, 0.16 + c * 0.025);
    let f = new Ve();
    ((r.rar = n === "item" || n === "chip" ? c : n === "qi" ? 3 : 2),
      f.add(o),
      f.add(h),
      f.position.set(e, 0, t),
      (r.mesh = f),
      (r.model = o),
      (r.col = l),
      x.R.scene.add(f));
  }
  return (x.pickups.push(r), r);
}


// ════════ [510] FunctionDeclaration Tx (1701 bytes) ════════
function Tx(n) {
  let e = x.S,
    t = x.player,
    i = Ex(),
    s = n.xpVal || 1,
    a = e.lvl - n.lvl;
  a > 2 && !n.boss && (s *= Math.max(0.1, 1 - 0.18 * (a - 2)));
  let r = n.boss ? 14 : n.elite ? 6 : s > 20 ? 3 : s > 6 ? 2 : 1;
  for (let f = 0; f < r; f++) Nt("xp", n.x, n.z, { val: s / r, spd: n.boss ? 5 : 2.5 });
  if (Q() < (n.boss || n.elite ? 1 : 0.4)) {
    let f = (2 + Q() * 3) * mt.credits(n.lvl) * (n.boss ? 40 : n.elite ? 6 : 1) * Sx(),
      u = n.boss ? 8 : n.elite ? 3 : 1;
    for (let p = 0; p < u; p++) Nt("cr", n.x, n.z, { val: f / u });
  }
  let o = (f, u, p = 1) => {
    Q() < u * (n.elite ? 4 : 1) * (n.boss ? 20 : 1) &&
      Nt("mat", n.x, n.z, { mat: f, val: p * (n.boss ? Rt(2, 4) : 1) });
  };
  ((n.fam === "insect" || n.fam === "mutant") && o("bio", 0.13),
    n.fam === "mech" && (o("scrap", 0.28, Rt(1, 2)), o("core", 0.012)),
    n.fam === "xeno" && (o("crystal", 0.04), o("bio", 0.08)),
    o("scrap", 0.05),
    o("battery", 0.03),
    n.lvl >= 8 && o("crystal", 0.012),
    n.boss &&
      (Nt("mat", n.x, n.z, { mat: "core", val: Rt(2, 4) }), Nt("mat", n.x, n.z, { mat: "data", val: Rt(1, 3) })),
    Q() < 0.045 && Nt("hp", n.x, n.z, { val: 0.12 }),
    Q() < 0.018 && Nt("cons", n.x, n.z, { cons: "grenade", val: 1 }),
    Q() < 0.012 && Nt("cons", n.x, n.z, { cons: "medkit", val: 1 }),
    Q() < (n.boss ? 1 : n.elite ? 0.25 : 0.012) && Nt("cap", n.x, n.z, { buff: Yt(wo), life: 25 }));
  let l = n.lvl,
    c = i - 1,
    d = (f) => Nt("item", n.x, n.z, { item: us(l, { luck: c, ...f }), life: 300 }),
    h = (f) => Nt("chip", n.x, n.z, { chip: xi(l, { luck: c, ...f }), life: 300 });
  n.boss && n.mini
    ? (h({ minT: 2 }), Q() < 0.35 && d({ minR: 1 }))
    : n.boss
      ? (d({ minR: 2, newChance: 0.9 }),
        h({ minT: 2 }),
        h({ minT: 2 }),
        Q() < (n.def.secret ? 1 : 0.3) && h({ pow: !0 }))
      : n.champion
        ? (h({ minT: 2 }), h({}), Q() < 0.3 && d({ minR: 1 }))
        : n.elite
          ? (Q() < 0.3 * i && h({}), Q() < 0.04 * i && d({}))
          : (Q() < 0.012 * i && h({}), Q() < 0.0035 * i && d({}));
  for (let [f, u] of Object.entries(e.quests.active)) {
    let p = u.def || gi[f];
    p &&
      p.obj.forEach((m, g) => {
        if (m.t !== "collect" || u.prog[g] >= m.n) return;
        (m.any ? !m.elite || n.elite : m.from ? m.from === n.id : m.fam && m.fam === n.fam) &&
          Q() < (m.ch || 0.3) &&
          Nt("qi", n.x, n.z, { qid: f, oi: g, name: m.item, life: 120 });
      });
  }
}


// ════════ [511] FunctionDeclaration Co (718 bytes) ════════
function Co(n, e, t, i, s = {}) {
  let a = Ex(),
    r = t >= 3 ? 2 : t === 2 ? Rt(1, 2) : Q() < 0.6 ? 1 : 0;
  for (let c = 0; c < r; c++)
    Nt("chip", n, e, { chip: xi(i, { luck: a - 1, minT: t >= 3 ? 2 : 1 }), life: 300, spd: 3 });
  (Q() < (t >= 3 ? 0.45 : t === 2 ? 0.15 : 0.05) &&
    Nt("item", n, e, { item: us(i, { luck: a - 1, minR: t >= 3 ? 2 : t === 2 ? 1 : 0 }), life: 300, spd: 3 }),
    t >= 2 && Nt("mat", n, e, { mat: "core", val: t >= 3 ? Rt(1, 2) : 1 }));
  let o = (10 + Q() * 15) * mt.credits(i) * (1 + t) * Sx();
  for (let c = 0; c < 4; c++) Nt("cr", n, e, { val: o / 4, spd: 3 });
  let l = ["scrap", "bio", "crystal", "battery"];
  for (let c = 0; c < t + 1; c++) {
    let d = Yt(l);
    Nt("mat", n, e, { mat: d, val: d === "crystal" ? 1 : Rt(2, 4) });
  }
  (t >= 2 && Q() < 0.5 && Nt("mat", n, e, { mat: "data", val: 1 }),
    Q() < 0.5 && Nt("cons", n, e, { cons: Yt(["grenade", "medkit", "stim"]), val: 1 }),
    Q() < 0.25 + t * 0.1 && Nt("cap", n, e, { buff: Yt(wo), life: 40 }),
    ae.play("chest"));
}


// ════════ [512] FunctionDeclaration TE (68 bytes) ════════
function TE(n, e) {
  return Ss(n, { silent: e }).kind === "dup" ? "salvaged" : !0;
}


// ════════ [513] FunctionDeclaration gp (1471 bytes) ════════
function gp(n) {
  let e = x.player,
    t = x.S,
    i = x.fx,
    s = e.pickR * (e.buffs.magnet ? 5 : 1);
  for (let a = x.pickups.length - 1; a >= 0; a--) {
    let r = x.pickups[a];
    if (((r.t += n), (r.life -= n), r.vy !== 0 || r.y > 0.35)) {
      ((r.vy -= 14 * n), (r.y += r.vy * n), r.y <= 0.35 && ((r.y = 0.35), (r.vy = 0)));
      let [u, p] = x.map.move(r.x, r.z, 0.15, r.vx * n, r.vz * n, !0);
      ((r.x = u), (r.z = p), (r.vx *= 0.92), (r.vz *= 0.92));
    }
    let o = Le(r.x, r.z, e.x, e.z),
      l =
        r.k === "xp" ||
        r.k === "cr" ||
        r.k === "mat" ||
        r.k === "hp" ||
        r.k === "cons" ||
        r.k === "qi" ||
        r.k === "cap",
      c = (r.k === "xp" || r.k === "cr" || r.k === "mat") && o < 22 && r.t > 0.6;
    if ((r.rest > 0 && (r.rest -= n), l && !e.dead && !(r.rest > 0) && (r.mag || o < s || c) && r.t > 0.35)) {
      r.mag = !0;
      let u = Math.min(26, 10 + r.t * 4),
        p = u * n;
      if (p >= o) ((r.x = e.x), (r.z = e.z));
      else {
        let m = Math.atan2(e.x - r.x, e.z - r.z);
        ((r.x += Math.sin(m) * p), (r.z += Math.cos(m) * p));
      }
      r.y += (1 - r.y) * n * 5;
    }
    let d = !1,
      h = Le(r.x, r.z, e.x, e.z);
    if (
      !e.dead &&
      h < (r.k === "item" || r.k === "chip" ? 0.9 : 0.6) &&
      r.t > 0.3 &&
      !(r.retry > x.time) &&
      ((d = AE(r)), !d && ((r.retry = x.time + 2), r.mag))
    ) {
      ((r.mag = !1), (r.rest = 1e9));
      let u = Q() * 6.28;
      ((r.x += Math.sin(u) * 1.2), (r.z += Math.cos(u) * 1.2));
    }
    if (d || r.life <= 0) {
      (r.mesh && x.R.scene.remove(r.mesh), (x.pickups[a] = x.pickups[x.pickups.length - 1]), x.pickups.pop());
      continue;
    }
    let f = Math.sin(r.t * 3 + a) * 0.1;
    if (r.mesh) {
      // levitación y giro suaves; halo en el suelo del color de la rareza, con pulsos y destellos en las altas
      (r.mesh.position.set(r.x, 0, r.z), (r.model.position.y = r.y + 0.32 + f), (r.model.rotation.y += n * 1.3));
      let u = r.rar || 0,
        p = 0.82 + 0.18 * Math.sin(r.t * 3 + a);
      (i.halo(r.x, r.z, 0.55 + u * 0.1, r.col, (0.42 + u * 0.09) * p, 2),
        u >= 2 && r.t > 0.4 && i.pulse(r.x, r.z, 0.7 + u * 0.12, r.col, 0.55, (r.t * 0.6 + a * 0.37) % 1),
        u >= 3 && Q() < n * 4 && i.burst(r.x + (Q() - 0.5) * 0.5, r.y + 0.1, r.z + (Q() - 0.5) * 0.5, 1, { color: r.col, speed: 0.3, life: 1, size: 0.12, size1: 0.02, up: 1, upMin: 0.6, drag: 1.2, jit: 0.05 }));
    } else if (r.k === "xp") {
      let u = r.val > 30;
      i.drawOrb(r.x, r.y + f, r.z, u ? 0.17 : 0.11, u ? 4251903 : 5308304);
    } else
      r.k === "cr"
        ? i.drawOrb(r.x, r.y + f, r.z, 0.12, 16766023)
        : r.k === "mat"
          ? i.drawOrb(r.x, r.y + f, r.z, 0.13, SE[r.mat])
          : r.k === "hp"
            ? i.drawOrb(r.x, r.y + f, r.z, 0.13, 13639744)
            : r.k === "cons" && i.drawOrb(r.x, r.y + f, r.z, 0.13, 13668384);
  }
}


// ════════ [514] FunctionDeclaration AE (1514 bytes) ════════
function AE(n) {
  let e = x.player,
    t = x.S,
    i = x.fx;
  switch (n.k) {
    case "xp":
      return (
        e.addXp(n.val),
        ae.play("pick", { gap: 0.03, p: 1 + Math.min(1, e.combo / 60) }),
        e.powers.has("magnetLord") && e.heal(e.maxHp * 0.004, !0),
        !0
      );
    case "cr": {
      let s = Math.max(1, Math.round(n.val));
      return (
        (t.credits += s),
        ae.play("coin", { gap: 0.05 }),
        i.text(e.x, 2, e.z, "+" + s + " \xA4", "#ffd447", 11, { life: 0.6 }),
        ee("res"),
        !0
      );
    }
    case "mat":
      return (
        (t.mats[n.mat] += n.val),
        ee("matGain", n.mat, n.val),
        ae.play("pick", { p: 1.3 }),
        i.text(e.x, 2.1, e.z, `+${n.val} ${mn[n.mat].n}`, mn[n.mat].c, 11, { life: 0.8 }),
        ee("res"),
        !0
      );
    case "hp":
      return (e.heal(e.maxHp * n.val), ae.play("heal", { gap: 0.2 }), !0);
    case "cons": {
      let s = n.cons === "grenade" ? e.grenadeMax : n.cons === "medkit" ? e.medkitMax : 5;
      return t.cons[n.cons] >= s
        ? !1
        : (t.cons[n.cons]++,
          ae.play("pick", { p: 0.8 }),
          i.text(
            e.x,
            2.1,
            e.z,
            "+1 " + { grenade: "Granada", medkit: "Botiqu\xEDn", stim: "Estimulante" }[n.cons],
            "#ffffff",
            11,
          ),
          ee("cons"),
          !0);
    }
    case "cap":
      return (
        e.addBuff(n.buff),
        ae.play("buff"),
        i.text(e.x, 2.3, e.z, Oi[n.buff].n.toUpperCase(), Oi[n.buff].c, 17, { life: 1.3 }),
        i.ring(e.x, e.z, 2.5, parseInt(Oi[n.buff].c.slice(1), 16), 0.5),
        !0
      );
    case "qi":
      return (ee("questItem", n), ae.play("item"), i.text(e.x, 2.2, e.z, n.name, "#ffd447", 13), !0);
    case "chip":
      return (
        Ts(n.chip),
        ae.play(n.chip.pow ? "legend" : "item"),
        i.text(e.x, 2.2, e.z, ts(n.chip), sa(n.chip), 12, { life: 1.2 }),
        !0
      );
    case "item": {
      let s = TE(n.item);
      return s === !1
        ? ((!n._warned || x.time - n._warned > 4) && ((n._warned = x.time), ee("toast", "Inventario lleno", "warn")),
          !1)
        : s === "salvaged"
          ? (ae.play("pick"), !0)
          : (ae.play(n.item.r >= 4 ? "legend" : "item"), ee("loot", n.item), !0);
    }
  }
  return !1;
}


// ════════ [515] FunctionDeclaration Ax (89 bytes) ════════
function Ax() {
  for (let n of x.pickups) n.mesh && x.R.scene.remove(n.mesh);
  x.pickups.length = 0;
}


// Gancho de depuración (capturas de botín): generar objetos y chips con rareza elegida.
window.__loot = { Nt, us, xi, Rg, pf, mf, Oi };

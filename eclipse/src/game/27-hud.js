// 27-hud.js — HUD, minimapa, tracker

// ════════ [633] VariableDeclaration Tn,ah,xe,Io,Ut,Ip,Lo,Dp,Op,Np,Xe,rh,Sn,ib (4393 bytes) ════════
var Tn = (n) => document.querySelector(n),
  ah,
  xe,
  Io,
  Ut,
  Ip = null,
  Lo = null,
  Dp = 0,
  Op = 0,
  Np = 0,
  Xe = { x: 0, y: 0, vis: !0 },
  rh = {
    weapon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 10h14l2-2h4v4h-3l-1 2h-5l-1 4H8l1-4H2z"/></svg>',
    helmet: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 15a9 9 0 0 1 18 0v2H3zm2 3h14v2H5z"/></svg>',
    suit: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 3l5 2 5-2 4 4-3 3v11H6V10L3 7z"/></svg>',
    gloves:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 21v-8L5 9l2-1 2 3V4h2v7h1V3h2v8h1V5h2v9l-2 7z"/></svg>',
    boots: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 3h6v10l7 3v4H5z"/></svg>',
    implant:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 7h10v10H7zM9 2h2v4H9zm4 0h2v4h-2zM9 18h2v4H9zm4 0h2v4h-2zM2 9h4v2H2zm0 4h4v2H2zm16-4h4v2h-4zm0 4h4v2h-4z"/></svg>',
    module:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l9 5v10l-9 5-9-5V7zm0 4l-5 3v6l5 3 5-3V9z"/></svg>',
  },
  Sn = (n) => `<svg viewBox="0 0 24 24"><g fill="currentColor">${n}</g></svg>`,
  ib = {
    pistol: Sn('<path d="M3 8h13v4H9l-1 6H4l1-6H3z"/><rect x="16" y="9" width="3" height="2"/>'),
    revolver: Sn(
      '<path d="M2 8h9v3H6l-1 7H2l1-7H2z"/><circle cx="12.5" cy="10.5" r="3"/><rect x="15" y="9" width="7" height="2.5"/>',
    ),
    smg: Sn(
      '<path d="M2 9h16v4h-5v6h-3v-6H7l-1 4H3l1-4H2z"/><rect x="18" y="10" width="4" height="2"/><rect x="11" y="6" width="3" height="3"/>',
    ),
    rifle: Sn('<path d="M1 10l4-1h17v3H13v3l-2 4H8l1-4H6l-5 1z"/><rect x="12" y="7" width="6" height="2"/>'),
    shotgun: Sn('<path d="M1 11l5-2h17v2.5H8v1.5H6l-5 2z"/><rect x="11" y="12.5" width="8" height="2.5" rx="1"/>'),
    sniper: Sn(
      '<path d="M1 12l5-1h18v2H9l-2 4H5l1-3H1z"/><rect x="9" y="7" width="8" height="3" rx="1.5"/><rect x="12" y="10" width="1.5" height="1"/>',
    ),
    minigun: Sn(
      '<rect x="8" y="7" width="15" height="2"/><rect x="8" y="10" width="15" height="2"/><rect x="8" y="13" width="15" height="2"/><rect x="2" y="6" width="7" height="10" rx="2"/><rect x="3" y="16" width="3" height="4"/>',
    ),
    flamer: Sn(
      '<rect x="2" y="9" width="12" height="5" rx="1"/><rect x="3" y="14" width="5" height="6" rx="2"/><path d="M14 10h3l2-2 3 3.5-3 3.5-2-2h-3z"/>',
    ),
    glauncher: Sn(
      '<rect x="2" y="8" width="14" height="6" rx="1"/><circle cx="9" cy="11" r="2" fill="#000" fill-opacity=".45"/><rect x="16" y="9" width="6" height="4"/><rect x="5" y="14" width="3" height="5"/>',
    ),
    rocket: Sn(
      '<rect x="1" y="8" width="17" height="5" rx="2"/><path d="M18 7l5 3.5L18 14z"/><rect x="6" y="13" width="3" height="5"/><rect x="11" y="13" width="2" height="3"/>',
    ),
    laser: Sn(
      '<path d="M2 9h12l3 2-3 2H8l-1 5H4l1-5H2z"/><rect x="17" y="10.2" width="6" height="1.6"/><circle cx="20" cy="11" r="1.6" fill-opacity=".6"/>',
    ),
    rail: Sn(
      '<rect x="2" y="7" width="20" height="2"/><rect x="2" y="13" width="20" height="2"/><rect x="3" y="9" width="9" height="4"/><rect x="4" y="15" width="3" height="5"/><circle cx="18" cy="11" r="1.4"/>',
    ),
    tesla: Sn(
      '<rect x="2" y="9" width="10" height="5" rx="1"/><rect x="3" y="14" width="3" height="5"/><path d="M12 6l5 4-3 1 6 5-8-4 3-1-4-3z"/>',
    ),
    cryo: Sn(
      '<rect x="2" y="9" width="11" height="5" rx="2"/><rect x="4" y="14" width="3" height="5"/><path d="M18 5v13M13.5 8l9 7M22.5 8l-9 7" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    ),
    plasma: Sn(
      '<rect x="2" y="9" width="11" height="5" rx="2"/><rect x="4" y="14" width="3" height="5"/><circle cx="17.5" cy="11.5" r="4.5"/><circle cx="17.5" cy="11.5" r="2" fill="#000" fill-opacity=".4"/>',
    ),
    disc: Sn(
      '<rect x="2" y="10" width="8" height="4" rx="1"/><rect x="3" y="14" width="3" height="5"/><circle cx="16" cy="12" r="6"/><circle cx="16" cy="12" r="2" fill="#000" fill-opacity=".45"/>',
    ),
    swarm: Sn(
      '<rect x="2" y="9" width="10" height="7" rx="1"/><path d="M13 5l4 2-4 2zM14 11l5 2-5 2zM13 17l4 2-4 2z"/><path d="M19 6l3 1-3 1zM20 12l3 1-3 1z"/>',
    ),
    acid: Sn(
      '<rect x="2" y="10" width="13" height="4" rx="1"/><rect x="4" y="14" width="3" height="5"/><path d="M19 4c2 3 3 4.5 3 6a3 3 0 0 1-6 0c0-1.5 1-3 3-6z"/><rect x="8" y="5" width="4" height="5" rx="1"/>',
    ),
    crossbow: Sn(
      '<rect x="2" y="11" width="18" height="2"/><path d="M14 4c3 2 4 5 4 8s-1 6-4 8l-1-1c2-2 3-4 3-7s-1-5-3-7z"/><rect x="4" y="13" width="3" height="5"/><path d="M20 10l3 2-3 2z"/>',
    ),
    void: Sn(
      '<rect x="2" y="9" width="9" height="5" rx="2"/><rect x="4" y="14" width="3" height="5"/><circle cx="17" cy="11.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="11.5" r="2.2"/>',
    ),
  };


// ════════ [634] FunctionDeclaration sb (3539 bytes) ════════
function sb() {
  ((ah = Tn("#ov")), (xe = ah.getContext("2d")));
  let n = Tn("#hud");
  ((n.innerHTML = `
  <div id="hTL">
    <div class="hpanel">
      <div class="who"><div class="badge" id="hLvl">1</div><div style="min-width:0;flex:1"><div class="nm" id="hName"></div><div class="rk" id="hRank"></div></div></div>
      <div class="bar" style="margin-top:7px"><i class="hpl" id="hHpl"></i><i class="hp" id="hHp"></i><i class="sh" id="hSh"></i><b id="hHpT"></b></div>
      <div class="bar xpbar" style="margin-top:4px"><i id="hXp"></i></div>
    </div>
    <div id="buffs"></div>
    <button id="hPerk" aria-label="Punto de talento disponible" title="Punto de talento disponible">\u25B2<b></b></button>
  </div>
  <div id="hTC"><div id="clock"></div><div id="bossbar"><div class="bn" id="bName"></div><div class="bt" id="bTitle"></div><div class="bar"><i id="bHp"></i><b id="bHpT"></b></div></div></div>
  <div id="hTR"><canvas id="mini" width="176" height="176"></canvas><div id="res"></div></div>
  <div id="tracker"></div>
  <div id="combo"></div>
  <div id="hazard"></div>
  <div id="lootfeed"></div>
  <div id="prompt"></div>
  <div id="hB">
    <div class="cons">
      <div class="cbtn" id="cMed"><span class="k">1</span><span id="cMedN">0</span><small>BOTIQU\xCDN</small></div>
      <div class="cbtn" id="cStim"><span class="k">2</span><span id="cStimN">0</span><small>ESTIM.</small></div>
    </div>
    <div class="wslot" id="w0"><span class="key">Q</span><div class="wn"></div><div class="wa"><span class="am"></span><span class="rl"></span></div><div class="bar"><i></i></div></div>
    <div class="wslot" id="w1"><span class="key">Q</span><div class="wn"></div><div class="wa"><span class="am"></span><span class="rl"></span></div><div class="bar"><i></i></div></div>
    <div class="cons">
      <div class="cbtn" id="cGren"><span class="k">G</span><span id="cGrenN">0</span><small>GRANADA</small></div>
      <div class="cbtn" id="cDash"><span class="k">ESP</span><span>\u27A4</span><small>ESPRINT</small><div class="cd" id="cDashCd"></div></div>
    </div>
  </div>`),
    (Io = Tn("#mini")),
    (Ut = Io.getContext("2d")),
    Tn("#hPerk").addEventListener("click", () => ee("openLevelUp")),
    Tn("#hPerk").addEventListener(
      "touchstart",
      (t) => {
        (t.preventDefault(), ee("openLevelUp"));
      },
      { passive: !1 },
    ),
    (Io.style.pointerEvents = "auto"),
    (Io.style.cursor = "pointer"),
    Io.addEventListener("click", () => ee("openMap", !1)),
    It("quests", () => (sh = !0)),
    It("loot", (t) => eb((t.r > 0 ? "\u25C6".repeat(t.r) + " " : "") + t.name, Ct[t.r].css)),
    It("questItem", (t) => eb(t.name, "#ffd447")),
    It("toast", la),
    It("banner", oa),
    It("bossIntro", (t) => oa(t.n, t.title, "#ff6a6a", t.id)),
    Qx(),
    addEventListener("resize", Qx));
  let e = Tn("#touch");
  ((e.innerHTML = `<button class="tb big" id="tbDash" data-a="dash">ESPRINT</button>
  <button class="tb" id="tbUse" data-a="interact">USAR</button>
  <button class="tb" id="tbGren" data-a="grenade">GRAN.<i id="tbGrenN">0</i></button>
  <button class="tb" id="tbSwap" data-a="swap">ARMA</button>
  <button class="tb" id="tbMed" data-a="medkit">CURA<i id="tbMedN">0</i></button>
  <button class="tb sm" id="tbStim" data-a="stim">ESTIM<i id="tbStimN">0</i></button>
  <div id="tmenu"><button data-a="inv">INV</button><button data-a="map">MAPA</button><button data-a="quests">MIS.</button><button data-a="archive">ARCH.</button><button data-a="talents" id="tbTal">TAL.</button><button data-a="flash">LUZ</button><button data-a="pause">\u275A\u275A</button></div>`),
    ["#w0", "#w1"].forEach((t) =>
      Tn(t).addEventListener(
        "touchstart",
        (i) => {
          (i.preventDefault(), Tt.press("swap"));
        },
        { passive: !1 },
      ),
    ),
    e.querySelectorAll("[data-a]").forEach((t) =>
      t.addEventListener(
        "touchstart",
        (i) => {
          (i.preventDefault(), i.stopPropagation(), Tt.press(t.dataset.a));
        },
        { passive: !1 },
      ),
    ));
}


// ════════ [635] FunctionDeclaration Qx (127 bytes) ════════
function Qx() {
  let n = Math.min(2, devicePixelRatio || 1);
  ((ah.width = innerWidth * n), (ah.height = innerHeight * n), xe.setTransform(n, 0, 0, n, 0, 0));
}


// ════════ [636] VariableDeclaration sh (10 bytes) ════════
var sh = !0;


// ════════ [637] FunctionDeclaration la (286 bytes) ════════
function la(n, e = "") {
  let t = document.createElement("div");
  ((t.className = "toast " + e), (t.textContent = n));
  let i = Tn("#toasts");
  for (i.appendChild(t); i.children.length > 5;) i.firstChild.remove();
  setTimeout(() => {
    ((t.style.transition = "opacity .4s"), (t.style.opacity = "0"), setTimeout(() => t.remove(), 400));
  }, 3800);
}


// ════════ [638] FunctionDeclaration oa (415 bytes) ════════
function oa(n, e, t, i) {
  let s = Tn("#banner"),
    a = i ? Et.image(i + "_portrait") : null;
  s.innerHTML = `<div class="bIn">${a ? `<img src="${a}" alt="" style="width:min(220px,40vw);aspect-ratio:1;object-fit:cover;border:1px solid rgba(255,80,80,0.5);margin-bottom:8px;box-shadow:0 0 40px rgba(255,0,0,0.3)">` : ""}<div class="b1" style="color:${t || "#fff"}">${ke(n)}</div><div class="rule"></div><div class="b2">${ke(e || "")}</div></div>`;
}


// ════════ [639] FunctionDeclaration eb (215 bytes) ════════
function eb(n, e) {
  let t = Tn("#lootfeed"),
    i = document.createElement("div");
  for (i.className = "lf", i.style.color = e, i.textContent = n, t.appendChild(i); t.children.length > 6;)
    t.firstChild.remove();
  setTimeout(() => i.remove(), 5e3);
}


// ════════ [640] VariableDeclaration tb,Fp (57 bytes) ════════
var tb = {},
  Fp = (n) => tb[n] || (tb[n] = document.querySelector(n));


// ════════ [641] FunctionDeclaration Bi (76 bytes) ════════
function Bi(n, e) {
  let t = Fp(n);
  ((e = String(e)), t._t !== e && ((t._t = e), (t.textContent = e)));
}


// ════════ [642] FunctionDeclaration Fl (112 bytes) ════════
function Fl(n, e) {
  let t = Fp(n);
  ((e = typeof e == "number" ? e.toFixed(1) + "%" : String(e)), t._w !== e && ((t._w = e), (t.style.width = e)));
}


// ════════ [643] FunctionDeclaration WE (115 bytes) ════════
function WE(n, e) {
  let t = Fp(n);
  ((e = typeof e == "number" ? e.toFixed(1) + "%" : String(e)), t._hg !== e && ((t._hg = e), (t.style.height = e)));
}


// ════════ [644] FunctionDeclaration ab (3384 bytes) ════════
function ab(n) {
  let e = x.S,
    t = x.player;
  if (!e || !t) return;
  if (((Op -= n), Op <= 0)) {
    ((Op = 0.1), Bi("#hLvl", e.lvl));
    {
      let g = Tn("#hPerk"),
        b = e.talentPts > 0 && !x.uiOpen;
      g._s !== b && ((g._s = b), (g.style.display = b ? "block" : "none"), Tn("#tbTal")?.classList.toggle("has", b));
      // puntos libres dentro de la pastilla (solo si hay más de uno: con uno basta la flecha)
      b && g._n !== e.talentPts && ((g._n = e.talentPts), (g.lastChild.textContent = e.talentPts > 1 ? e.talentPts : ""));
    }
    (Bi("#hName", e.name), Bi("#hRank", `${vo(e.lvl)} \xB7 ${De[x.regionId]?.n || ""}`));
    let s = qe(t.hp / t.maxHp, 0, 1) * 100;
    (Fl("#hHp", s + "%"),
      Fl("#hHpl", s + "%"),
      Fl("#hSh", (t.maxShield > 0 ? qe(t.shield / t.maxHp, 0, 1) * 100 : 0) + "%"),
      Bi("#hHpT", `${yt(Math.max(0, t.hp))} / ${yt(t.maxHp)}${t.shield > 1 ? "  \u2B21 " + yt(t.shield) : ""}`),
      Fl("#hXp", (e.lvl >= mt.maxLevel ? 100 : (e.xp / mt.xpToNext(e.lvl)) * 100) + "%"));
    let a = Object.entries(t.buffs)
        .map(([g, b]) => `<span class="buff" style="color:${Oi[g].c}">${Oi[g].n} ${Math.ceil(b)}s</span>`)
        .join(""),
      r = Tn("#buffs");
    r._h !== a && ((r._h = a), (r.innerHTML = a));
    for (let g = 0; g < 2; g++) {
      let b = g === 0 ? e.eq.w1 : e.eq.w2,
        y = Tn("#w" + g),
        v = t.ws[g];
      if (
        (y.classList.toggle("on", e.activeW === g),
        (y.querySelector(".wn").textContent = b ? b.name : "\u2014 vac\xEDo \u2014"),
        (y.querySelector(".wn").style.color = b ? Ct[b.r].css : "var(--dim)"),
        v)
      ) {
        let _ = t.reloadT[g] > 0;
        ((y.querySelector(".am").textContent = v.pw.has("overheat")
          ? `\u221E  calor ${Math.round(Math.min(75, t.heat * 3))}%`
          : `${t.ammo[g]} / ${v.mag}`),
          (y.querySelector(".rl").textContent = _ ? "RECARGANDO" : `\u26A1 ${es(b)}`),
          (y.querySelector(".bar i").style.width =
            (_ ? (1 - t.reloadT[g] / v.reloadTime) * 100 : (t.ammo[g] / v.mag) * 100) + "%"));
      } else
        ((y.querySelector(".am").textContent = ""),
          (y.querySelector(".rl").textContent = ""),
          (y.querySelector(".bar i").style.width = "0"));
    }
    (Bi("#cMedN", e.cons.medkit), Bi("#cStimN", e.cons.stim), Bi("#cGrenN", e.cons.grenade));
    let o = Tn("#tbMedN");
    (o && ((o.textContent = e.cons.medkit), Bi("#tbGrenN", e.cons.grenade), Bi("#tbStimN", e.cons.stim)),
      WE("#cDashCd", (t.dashCd > 0 ? (t.dashCd / 2.2) * 100 : 0) + "%"));
    let l =
        `<span style="color:#ffd447">\xA4 ${yt(e.credits)}</span>` +
        ["scrap", "bio", "crystal", "core", "data"]
          .map((g) => `<span style="color:${mn[g].c}" title="${mn[g].n}">${mn[g].icon} ${yt(e.mats[g])}</span>`)
          .join(""),
      c = Tn("#res");
    c._h !== l && ((c._h = l), (c.innerHTML = l));
    let d = Math.floor(e.time * 24),
      h = Math.floor((e.time * 24 * 60) % 60);
    Bi(
      "#clock",
      x.mode === "op"
        ? `${x.op && x.op.sub ? "ZONA INTERIOR" : "OPERACI\xD3N"} \xB7 ${x.op ? Xs(x.op.t) : ""}`
        : `${String(d).padStart(2, "0")}:${String(h).padStart(2, "0")} ${x.night > 0.5 ? "\xB7 NOCHE" : ""}${xn.event ? " \xB7 " + xn.event.n.toUpperCase() : ""}`,
    );
    let f = Tn("#bossbar");
    if (x.bossActive) {
      let g = x.bossActive;
      ((f.style.display = "block"),
        Bi("#bName", g.name || g.def.n),
        Bi("#bTitle", `${g.title || ""} \xB7 Nivel ${g.lvl}${bossHudTag(g)}`),
        Fl("#bHp", qe(g.hp / g.maxHp, 0, 1) * 100 + "%"),
        Bi("#bHpT", `${yt(g.hp)} / ${yt(g.maxHp)}`));
    } else f.style.display = "none";
    let u = Tn("#hazard");
    if (x.hazard && x.hazard.deficit > 0) {
      let g = fr[x.hazard.t];
      ((u.style.display = "block"),
        (u.style.color = g.c),
        (u.textContent = `${g.icon} ${g.n.toUpperCase()} \xB7 ${Math.round(x.hazard.res * 100)}% / ${Math.round(x.hazard.req * 100)}% RESISTENCIA`));
    } else u.style.display = "none";
    let p = Tn("#combo");
    t.combo >= 5
      ? ((p.style.display = "block"),
        p._c !== t.combo && ((p._c = t.combo), (p.innerHTML = `${t.combo}<small>RACHA</small>`)))
      : (p.style.display = "none");
    let m = Tn("#prompt");
    if (x.prompt && !x.uiOpen) {
      m.style.display = "block";
      let b = `<kbd>${Tt.touchMode ? "USAR" : "E"}</kbd>${ke(x.prompt.text)}`;
      m._h !== b && ((m._h = b), (m.innerHTML = b));
    } else m.style.display = "none";
    (sh && ((sh = !1), jE()), (nb -= 0.1) <= 0 && ((nb = 1), (sh = !0)));
  }
  let i = x.R;
  ((i.finalPass.uniforms.uHurt.value = Math.max(
    t.hurtFlash * 0.7,
    t.hp < t.maxHp * 0.3 ? (0.3 - t.hp / t.maxHp) * 1.6 * (0.7 + Math.sin(x.time * 6) * 0.3) : 0,
  )),
    XE(n),
    (Np -= n),
    Np <= 0 && ((Np = 0.1), ZE()));
}


// ════════ [645] VariableDeclaration nb (9 bytes) ════════
var nb = 1;


// ════════ [646] FunctionDeclaration jE (1509 bytes) ════════
function jE() {
  let n = x.S,
    e = Tn("#tracker"),
    t = Object.entries(n.quests.active)
      .filter(([, s]) => s.tracked)
      .slice(0, 3),
    i = "";
  for (let [s, a] of t) {
    let r = ri(s, a),
      o = ht.complete(s, a);
    ((i += `<div class="trk"><div class="tt ${r.main ? "main" : ""}">${r.main ? "\u25C6 " : ""}${ke(r.n)}</div>`),
      o
        ? (i += `<div class="ob" style="color:var(--good)">Vuelve con ${ke(zt[r.giver]?.n || "el contacto")}</div>`)
        : r.obj.forEach((l, c) => {
            i += `<div class="ob ${(a.prog[c] || 0) >= l.n ? "done" : ""}">${ke(ht.objText(l, a.prog[c]))}</div>`;
          }),
      (i += "</div>"));
  }
  if (
    (xn.event &&
      (i += `<div class="trk" style="border-right-color:#5fd35a"><div class="tt" style="color:#8dffa0">\u2691 ${ke(xn.event.n)}</div><div class="ob">${ke(xn.event.d)}${xn.event.t > 0 ? " \xB7 " + Xs(xn.event.t) : ""}</div></div>`),
    x.op && x.op.sub)
  ) {
    let s = Ni.status();
    s &&
      (i =
        `<div class="trk" style="border-right-color:${s.c}"><div class="tt" style="color:${s.c}">${ke(s.title.toUpperCase())}</div>${s.lines.map((a) => `<div class="ob ${a.ok ? "done" : ""}" ${a.bad ? 'style="color:var(--bad)"' : ""}>${ke(a.t)}</div>`).join("")}</div>` +
        i);
  } else if (x.op) {
    let s = x.op,
      a =
        s.obj === "data"
          ? ` (${s.hacked}/3)`
          : s.obj === "rescue"
            ? ` (${s.freed}/2)`
            : s.obj === "nests"
              ? ` (quedan ${s.nestsLeft})`
              : s.obj === "exterminate"
                ? ` (${s.kills}/${s.killGoal})`
                : "";
    i =
      `<div class="trk" style="border-right-color:#46e4ff"><div class="tt" style="color:#9fefff">OPERACI\xD3N</div><div class="ob ${s.done ? "done" : ""}">${ke($E(s))}${a}</div>${s.done ? '<div class="ob" style="color:#5fd35a">Ve al punto de extracci\xF3n</div>' : ""}</div>` +
      i;
  }
  e._h !== i && ((e._h = i), (e.innerHTML = i));
}


// ════════ [647] FunctionDeclaration $E (183 bytes) ════════
function $E(n) {
  return {
    boss: "Elimina al objetivo",
    data: "Recupera los datos",
    rescue: "Libera a los prisioneros",
    nests: "Destruye los nidos",
    exterminate: "Extermina a los hostiles",
  }[n.obj];
}


// ════════ [648] FunctionDeclaration XE (4435 bytes) ════════
function XE(n) {
  let e = x.R,
    t = x.player,
    i = x.S,
    s = innerWidth,
    a = innerHeight;
  if ((xe.clearRect(0, 0, s, a), x.uiOpen === "menu")) return;
  xe.textAlign = "center";
  for (let o of x.enemies) {
    if (
      o.dead ||
      o.boss ||
      !o.rig.root.visible ||
      o.burrowed ||
      !(o.hp < o.maxHp || o.elite) ||
      Le(o.x, o.z, t.x, t.z) > 26
    )
      continue;
    e.project(o.x, 1.25 * o.scale + 0.55, o.z, Xe);
    let c = o.elite ? 64 : 34;
    if (
      ((xe.fillStyle = "rgba(0,0,0,0.65)"),
      xe.fillRect(Xe.x - c / 2 - 1, Xe.y - 1, c + 2, 5),
      (xe.fillStyle = o.elite ? "#ffb340" : "#ff4a5a"),
      xe.fillRect(Xe.x - c / 2, Xe.y, c * qe(o.hp / o.maxHp, 0, 1), 3),
      o.shieldHp > 0 &&
        ((xe.fillStyle = "#46e4ff"),
        xe.fillRect(Xe.x - c / 2, Xe.y - 3, c * qe(o.shieldHp / (o.maxHp * 0.4), 0, 1), 2)),
      o.elite)
    ) {
      ((xe.font = '600 12px "Chakra Petch", sans-serif'),
        (xe.fillStyle = o.champion ? "#ff7a50" : "#ffd27a"),
        (xe.strokeStyle = "rgba(0,0,0,0.8)"),
        (xe.lineWidth = 3));
      let d = o.displayName + ` \xB7 ${o.lvl}`;
      (xe.strokeText(d, Xe.x, Xe.y - 6), xe.fillText(d, Xe.x, Xe.y - 6));
    }
  }
  {
    let o = i.activeW,
      l = t.ws[o];
    if (l && t.reloadT[o] > 0 && !t.dead) {
      e.project(t.x, 2.3, t.z, Xe);
      let c = qe(1 - t.reloadT[o] / l.reloadTime, 0, 1);
      ((xe.lineWidth = 4),
        (xe.strokeStyle = "rgba(0,0,0,0.6)"),
        xe.beginPath(),
        xe.arc(Xe.x, Xe.y, 11, 0, 6.283),
        xe.stroke(),
        (xe.lineWidth = 3),
        (xe.strokeStyle = "#ffd447"),
        xe.beginPath(),
        xe.arc(Xe.x, Xe.y, 11, -1.571, -1.571 + c * 6.283),
        xe.stroke(),
        (xe.font = '700 11px "Chakra Petch", sans-serif'),
        (xe.fillStyle = "#ffd447"),
        (xe.strokeStyle = "rgba(0,0,0,0.85)"),
        (xe.lineWidth = 3),
        xe.strokeText("RECARGANDO", Xe.x, Xe.y - 17),
        xe.fillText("RECARGANDO", Xe.x, Xe.y - 17));
    }
  }
  if (x.world)
    for (let o of x.world.rt.values()) {
      let l = o.e;
      if (l.k === "npc" && o.mesh) {
        if (Le(l.x, l.z, t.x, t.z) > 30) continue;
        let c = ht.readyAt(l.npc).length > 0,
          d = ht.available(l.npc).some((h) => !h.locked) || !!ht.repeatOffer(l.npc)?.def;
        if ((e.project(l.x, 2.25, l.z, Xe), (xe.font = '700 22px "Chakra Petch", sans-serif'), c || d)) {
          ((xe.fillStyle = c ? "#5fd35a" : "#ffd447"), (xe.strokeStyle = "#000"), (xe.lineWidth = 4));
          let h = c ? "?" : "!",
            f = Xe.y + Math.sin(x.time * 4) * 3;
          (xe.strokeText(h, Xe.x, f), xe.fillText(h, Xe.x, f));
        }
        if (Le(l.x, l.z, t.x, t.z) < 8) {
          ((xe.font = '600 12px "Chakra Petch", sans-serif'),
            (xe.fillStyle = "#e6ebee"),
            (xe.strokeStyle = "rgba(0,0,0,0.8)"),
            (xe.lineWidth = 3));
          let h = zt[l.npc].n;
          (xe.strokeText(h, Xe.x, Xe.y + 16),
            xe.fillText(h, Xe.x, Xe.y + 16),
            (xe.fillStyle = "#8b989f"),
            xe.strokeText(zt[l.npc].role, Xe.x, Xe.y + 29),
            xe.fillText(zt[l.npc].role, Xe.x, Xe.y + 29));
        }
      }
    }
  for (let o of x.pickups) {
    if ((o.k !== "item" && o.k !== "chip") || Le(o.x, o.z, t.x, t.z) > 9) continue;
    if (o.k === "chip") {
      e.project(o.x, 0.15, o.z, Xe);
      let c = "\u25C6".repeat(Math.min(5, o.chip.t || 1)) + " " + ts(o.chip);
      ((xe.font = '600 12px "Chakra Petch", sans-serif'),
        (xe.strokeStyle = "rgba(0,0,0,0.85)"),
        (xe.lineWidth = 3),
        (xe.fillStyle = sa(o.chip)),
        xe.strokeText(c, Xe.x, Xe.y + 14),
        xe.fillText(c, Xe.x, Xe.y + 14));
      continue;
    }
    (e.project(o.x, 0.15, o.z, Xe),
      (xe.font = '600 12px "Chakra Petch", sans-serif'),
      (xe.strokeStyle = "rgba(0,0,0,0.85)"),
      (xe.lineWidth = 3),
      (xe.fillStyle = Ct[o.item.r].css));
    let l = (o.item.r > 0 ? "\u25C6".repeat(o.item.r) + " " : "") + o.item.name + " \xB7 \u26A1" + es(o.item);
    (xe.strokeText(l, Xe.x, Xe.y + 14), xe.fillText(l, Xe.x, Xe.y + 14));
  }
  if (Ni.st && Ni.st.targets.length)
    for (let o of Ni.st.targets) {
      if (o.hp <= 0) continue;
      e.project(o.x, o.n === "Enlace" ? 2.9 : 1.9, o.z, Xe);
      let l = o.n === "Enlace" ? 70 : 44,
        c = qe(o.hp / o.maxHp, 0, 1);
      ((xe.fillStyle = "rgba(0,0,0,0.7)"),
        xe.fillRect(Xe.x - l / 2 - 1, Xe.y - 1, l + 2, 6),
        (xe.fillStyle = o.hitT > 0 ? "#ffffff" : c > 0.5 ? "#5fd35a" : c > 0.25 ? "#ffb340" : "#ff4a5a"),
        xe.fillRect(Xe.x - l / 2, Xe.y, l * c, 4),
        (xe.font = '600 11px "Chakra Petch", sans-serif'),
        (xe.fillStyle = "#d8f8d8"),
        (xe.strokeStyle = "rgba(0,0,0,0.85)"),
        (xe.lineWidth = 3),
        xe.strokeText(o.n, Xe.x, Xe.y - 5),
        xe.fillText(o.n, Xe.x, Xe.y - 5));
    }
  for (let o of x.fx.texts) {
    e.project(o.x, o.y, o.z, Xe);
    let l = o.life / o.max;
    xe.globalAlpha = Math.min(1, l * 2.2);
    let c = o.size * (o.crit ? 1 + Math.max(0, l - 0.75) * 2.5 : 1);
    ((xe.font = `700 ${c}px "Chakra Petch", sans-serif`),
      (xe.lineWidth = 3),
      (xe.strokeStyle = "rgba(0,0,0,0.85)"),
      (xe.fillStyle = o.color),
      // crítico con peso: halo del color del daño y trazo más grueso
      o.crit && ((xe.lineWidth = 4), (xe.shadowColor = o.color), (xe.shadowBlur = 12)),
      xe.strokeText(o.txt, Xe.x, Xe.y),
      xe.fillText(o.txt, Xe.x, Xe.y),
      (xe.shadowBlur = 0));
  }
  xe.globalAlpha = 1;
  let r = [];
  for (let [o, l] of Object.entries(i.quests.active)) {
    if (!l.tracked) continue;
    let c = ht.target(o, l);
    c && r.push({ ...c, c: ri(o, l).main ? "#ffd447" : "#ffb340" });
  }
  if ((xn.event && r.push({ x: xn.event.x, z: xn.event.z, n: xn.event.n, c: "#5fd35a" }), x.op && x.op.sub)) {
    let o = Ni.target();
    o && r.push(o);
  } else if (x.op && x.op.done) {
    let o = x.map.ents.find((l) => l.k === "extract");
    o && r.push({ x: o.x, z: o.z, n: "Extracci\xF3n", c: "#5fd35a" });
  }
  for (let o of r) YE(o, s, a);
  if (Tt.joy.active) {
    let o = Tt.joy;
    ((xe.lineWidth = 2),
      (xe.strokeStyle = "rgba(255,179,64,0.45)"),
      (xe.fillStyle = "rgba(10,14,16,0.25)"),
      xe.beginPath(),
      xe.arc(o.ox, o.oy, 55, 0, 6.283),
      xe.fill(),
      xe.stroke(),
      (xe.fillStyle = "rgba(255,179,64,0.55)"),
      xe.beginPath(),
      xe.arc(o.ox + o.x * 55, o.oy + o.y * 55, 20, 0, 6.283),
      xe.fill());
  }
}


// ════════ [649] FunctionDeclaration YE (993 bytes) ════════
function YE(n, e, t) {
  let i = x.player,
    s = Le(n.x, n.z, i.x, i.z);
  if (s < 2.5) return;
  x.R.project(n.x, 1.6, n.z, Xe);
  let a = 40,
    r = Xe.x,
    o = Xe.y,
    l = r > a && o > a && r < e - a && o < t - a;
  if (((xe.font = '600 11px "Chakra Petch", sans-serif'), l)) {
    ((xe.fillStyle = n.c),
      xe.save(),
      xe.translate(r, o - 6 + Math.sin(x.time * 3) * 3),
      xe.rotate(Math.PI / 4),
      xe.fillRect(-5, -5, 10, 10),
      xe.restore(),
      (xe.strokeStyle = "rgba(0,0,0,0.8)"),
      (xe.lineWidth = 3));
    let c = `${Math.round(s)} m`;
    (xe.strokeText(c, r, o + 14), xe.fillText(c, r, o + 14));
  } else {
    let c = e / 2,
      d = t / 2,
      h = Math.atan2(o - d, r - c),
      f = Math.min((e / 2 - a) / Math.abs(Math.cos(h)), (t / 2 - a) / Math.abs(Math.sin(h)));
    ((r = c + Math.cos(h) * f),
      (o = d + Math.sin(h) * f),
      xe.save(),
      xe.translate(r, o),
      xe.rotate(h),
      (xe.fillStyle = n.c),
      xe.beginPath(),
      xe.moveTo(12, 0),
      xe.lineTo(-6, -8),
      xe.lineTo(-2, 0),
      xe.lineTo(-6, 8),
      xe.closePath(),
      xe.fill(),
      xe.restore(),
      (xe.fillStyle = n.c),
      (xe.strokeStyle = "rgba(0,0,0,0.85)"),
      (xe.lineWidth = 3));
    let u = `${n.n ? n.n + " \xB7 " : ""}${Math.round(s)} m`,
      p = qe(r - Math.cos(h) * 26, 60, e - 60),
      m = qe(o - Math.sin(h) * 18, 20, t - 20);
    (xe.strokeText(u, p, m), xe.fillText(u, p, m));
  }
}


// ════════ [650] FunctionDeclaration KE (796 bytes) ════════
function KE(n, e) {
  let t = n.ter[e];
  if (n.kind === "op")
    return t === F.VOID
      ? [5, 7, 8]
      : t === F.WALL || t === F.ROCK
        ? [70, 74, 78]
        : t === F.ACID
          ? [90, 200, 40]
          : t === F.LAVA
            ? [230, 90, 20]
            : t === F.WATER
              ? [40, 90, 150]
              : n.dark[e]
                ? [36, 40, 44]
                : [60, 66, 70];
  let i = De[n.reg[e]],
    s = (a) => [(a >> 16) & 255, (a >> 8) & 255, a & 255];
  switch (t) {
    case F.GROUND:
      return s(i.ground[1]).map((r) => r * 0.8);
    case F.ROAD:
      return s(i.road).map((a) => Math.min(255, a * 1.15));
    case F.FLOOR:
    case F.DOOR:
      return n.dark[e] ? [58, 58, 58] : [110, 108, 100];
    case F.WALL:
    case F.SECRET:
      return [190, 186, 170];
    case F.ROCK:
      return s(i.rock).map((a) => a * 0.45);
    case F.WATER:
      return [40, 100, 170];
    case F.LAVA:
      return [255, 100, 20];
    case F.ACID:
      return [110, 220, 40];
    case F.ICE:
      return [190, 225, 245];
    case F.GATE:
      return [255, 60, 60];
    case F.ARENA:
      return [120, 40, 40];
    case F.BASE:
      return [170, 170, 150];
    case F.CAVE:
      return [40, 36, 44];
  }
  return [0, 0, 0];
}


// ════════ [651] FunctionDeclaration JE (274 bytes) ════════
function JE(n) {
  let e = document.createElement("canvas");
  ((e.width = n.w), (e.height = n.h));
  let t = e.getContext("2d"),
    i = t.createImageData(n.w, n.h);
  for (let s = 0; s < n.w * n.h; s++) {
    let [a, r, o] = KE(n, s);
    ((i.data[s * 4] = a), (i.data[s * 4 + 1] = r), (i.data[s * 4 + 2] = o), (i.data[s * 4 + 3] = 255));
  }
  return (t.putImageData(i, 0, 0), e);
}


// ════════ [652] FunctionDeclaration Bp (288 bytes) ════════
function Bp(n) {
  let e = n.fogW,
    t = document.createElement("canvas");
  ((t.width = e), (t.height = e));
  let i = t.getContext("2d"),
    s = i.createImageData(e, e);
  for (let a = 0; a < e * e; a++) {
    let r = (n.fogBits[a >> 3] >> (a & 7)) & 1;
    ((s.data[a * 4 + 3] = r ? 0 : 255), (s.data[a * 4] = 6), (s.data[a * 4 + 1] = 9), (s.data[a * 4 + 2] = 11));
  }
  return (i.putImageData(s, 0, 0), t);
}


// ════════ [653] VariableDeclaration Up (12 bytes) ════════
var Up = null;


// ════════ [654] FunctionDeclaration Hp (94 bytes) ════════
function Hp() {
  let n = x.map;
  return ((!Ip || Up !== n || n._imgDirty) && ((Ip = JE(n)), (Up = n), (n._imgDirty = !1)), Ip);
}


// ════════ [655] FunctionDeclaration rb (22 bytes) ════════
function rb() {
  Up = null;
}


// ════════ [656] FunctionDeclaration ZE (1610 bytes) ════════
function ZE() {
  let n = x.map,
    e = x.player;
  if (!n) return;
  let t = Hp();
  ((Dp -= 0.1), x.mode === "world" && (Dp <= 0 || !Lo) && ((Dp = 1.5), (Lo = Bp(x.world))));
  let i = Io.width,
    s = i / 64;
  (Ut.save(),
    (Ut.fillStyle = "#050708"),
    Ut.fillRect(0, 0, i, i),
    Ut.translate(i / 2, i / 2),
    Ut.rotate(Math.PI / 4),
    Ut.scale(s, s),
    Ut.translate(-e.x, -e.z),
    (Ut.imageSmoothingEnabled = !1),
    Ut.drawImage(t, 0, 0),
    x.mode === "world" && Lo && Ut.drawImage(Lo, 0, 0, Lo.width * 2, Lo.height * 2));
  let a = (r, o, l, c = 1.2) => {
    ((Ut.fillStyle = l), Ut.beginPath(), Ut.arc(r, o, c, 0, 6.283), Ut.fill());
  };
  for (let r of x.enemies)
    !r.dead &&
      Le(r.x, r.z, e.x, e.z) < 40 &&
      (r.ai !== "shadow" || r.visibleShadow) &&
      a(r.x, r.z, r.boss ? "#ff2040" : r.elite ? "#ffb340" : "#ff5060", r.boss ? 2.4 : r.elite ? 1.4 : 0.9);
  if (x.world)
    for (let r of x.world.rt.values()) {
      let o = r.e;
      Le(o.x, o.z, e.x, e.z) > 45 ||
        (o.k === "npc"
          ? a(o.x, o.z, "#ffd447", 1.3)
          : o.k === "beacon"
            ? a(o.x, o.z, x.S.world.beacons[o.id] ? "#46e4ff" : "#506870", 1.6)
            : o.k === "terminal" && !x.world.termDone(o)
              ? a(o.x, o.z, "#30e0a0", 1.1)
              : o.k === "breach"
                ? a(o.x, o.z, "#b56bff", 1.8)
                : o.k === "extract" || o.k === "exit"
                  ? a(o.x, o.z, "#50ff90", 1.8)
                  : o.k === "stairs"
                    ? a(o.x, o.z, x.world.subReady(o) ? "#ff9a3c" : "#6a5a4a", 1.5)
                    : o.k === "civilian" || o.k === "device"
                      ? a(o.x, o.z, "#5fd35a", 1.3)
                      : o.k === "chest" && !x.world.isConsumed(o)
                        ? a(o.x, o.z, "#ffcf60", 0.9)
                        : o.k === "datapad" && !x.world.dpTaken(o) && a(o.x, o.z, "#ffffff", 0.8));
    }
  for (let r of x.pickups) r.k === "item" && a(r.x, r.z, Ct[r.item.r].css, 0.8);
  ecoMinimapPings(Ut, i, s); // ping de los hitos (Épico o superior) que siguen en el suelo
  (Ut.restore(),
    Ut.save(),
    Ut.translate(i / 2, i / 2),
    Ut.rotate(-e.face + Math.PI / 4 + Math.PI),
    (Ut.fillStyle = "#fff"),
    Ut.beginPath(),
    Ut.moveTo(0, -7),
    Ut.lineTo(5, 5),
    Ut.lineTo(0, 2),
    Ut.lineTo(-5, 5),
    Ut.closePath(),
    Ut.fill(),
    Ut.restore(),
    (Ut.strokeStyle = "rgba(255,179,64,0.35)"),
    Ut.strokeRect(0.5, 0.5, i - 1, i - 1));
}


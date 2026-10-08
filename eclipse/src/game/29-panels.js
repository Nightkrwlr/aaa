// 29-panels.js — Paneles: inventario, taller, tienda, misiones, mapa, ajustes, muerte, victoria

// ════════ [661] VariableDeclaration _t,wr,vb,Ze (691 bytes) ════════
var _t = (n) => document.querySelector(n),
  wr = null,
  vb = ["w1", "w2", "helmet", "suit", "gloves", "boots", "implant", "module"],
  Ze = {
    open(n, e, t = {}) {
      wr && (wr(), (wr = null));
      let i = _t("#panel");
      ((i.hidden = !1),
        (i.innerHTML = e),
        (x.uiOpen = n),
        (x.paused = !t.noPause),
        (i.onclick = (s) => {
          s.target === i && !t.modal && this.close();
        }),
        i.querySelectorAll("[data-close]").forEach((s) => s.addEventListener("click", () => this.close())),
        t.silent || ae.play("open"));
    },
    close() {
      wr && (wr(), (wr = null));
      let n = _t("#panel");
      ((n.hidden = !0), (n.innerHTML = ""));
      let e = x.uiOpen;
      ((x.uiOpen = null), (x.paused = !1), e && ae.play("close"), ee("uiClosed", e));
    },
    head(n, e = "", t = "") {
      return `<div class="whead"><h2>${ke(n)}</h2>${e}${t}<button class="x" data-close aria-label="Cerrar">\u2715</button></div>`;
    },
  };


// ════════ [662] FunctionDeclaration yb (216 bytes) ════════
function yb(n) {
  let e = Et.icon(n.type === "weapon" ? "weapon_" + n.base : "gear_" + n.base);
  return e
    ? `<img src="${e}" alt="" style="width:100%;height:100%;object-fit:contain">`
    : n.type === "weapon"
      ? ib[n.base] || rh.weapon
      : rh[n.slot];
}


// ════════ [663] FunctionDeclaration ql (2512 bytes) ════════
function ql(n, e) {
  let t = Ct[n.r],
    i = `<div class="item" style="border-color:${t.css}55"><h3 style="color:${t.css}">${ke(n.name)}${n.upg ? ` <span style="color:var(--amber2)">+${n.upg}</span>` : ""}</h3>`,
    s = es(n),
    a = e || null,
    r = a ? es(a) : null;
  if (
    ((i += ecoLoreHtml(n)),
    (i += `<div class="pwr"><b>\u26A1 ${s}</b><span>PODER</span>${r != null && r !== s ? `<em class="${s > r ? "up" : "dn"}">${s > r ? "\u25B2 +" : "\u25BC "}${s - r} frente al equipado</em>` : ""}</div>`),
    (i += `<div class="ty">${t.n} \xB7 ${n.type === "weapon" ? "Arma \xB7 " + Hn[n.base].n : Cd[n.slot] + " \xB7 " + ai[n.base].n} \xB7 Nivel ${n.ilvl}</div><ul>`),
    n.type === "weapon")
  ) {
    let o = Mo(n),
      l = Hn[n.base],
      c = o.dmg * o.pellets * o.rate * (l.kind === "chain" ? 1 + o.chains * 0.5 : 1),
      d = null;
    if (e && e.type === "weapon") {
      let h = Mo(e),
        f = Hn[e.base];
      d = h.dmg * h.pellets * h.rate * (f.kind === "chain" ? 1 + h.chains * 0.5 : 1);
    }
    ((i += `<li class="imp"><b style="font-family:var(--f-disp);font-size:20px">${yt(c)}</b> da\xF1o por segundo ${d != null ? eS(c, d) : ""}</li>`),
      (i += `<li class="imp">${yt(o.dmg)}${o.pellets > 1 ? " \xD7" + o.pellets : ""} da\xF1o \xB7 ${o.rate.toFixed(1)} disp/s \xB7 cargador ${o.mag} \xB7 recarga ${o.reload.toFixed(1)} s</li>`),
      (i += `<li class="imp">Alcance ${o.range} m${o.pierce && o.pierce < 99 ? ` \xB7 perfora ${o.pierce}` : o.pierce >= 99 ? " \xB7 perfora todo" : ""}${o.aoe ? ` \xB7 \xE1rea ${o.aoe} m` : ""}${o.chains ? ` \xB7 encadena ${o.chains}` : ""}${o.crit ? ` \xB7 +${Math.round(o.crit * 100)}% cr\xEDtico` : ""}${o.elem ? ` \xB7 ${{ fire: "fuego", ice: "hielo", shock: "el\xE9ctrico", toxic: "t\xF3xico", energy: "energ\xEDa" }[o.elem]}` : ""}</li>`));
  } else for (let o of _o(n)) i += `<li class="imp">${Ks(o.s, o.v)}</li>`;
  i += `<li class="muted" style="font-size:12px;margin-top:4px">M\xD3DULOS ${n.aff.length}/${Ga(n)}${Zs(n) ? ` \xB7 LEGENDARIOS ${[n.pow, n.pow2].filter(Boolean).length}/${Zs(n)}` : ""}</li>`;
  for (let o of n.aff)
    i += `<li class="aff">\u2B22 ${Ks(o.s, o.v * (n.type === "gear" ? 1 + 0.1 * (n.upg || 0) : 1))}${o.t ? ` <span style="color:${Ct[Math.min(5, o.t)].css};font-size:11px">T${o.t}</span>` : ""}</li>`;
  for (let o of [n.pow, n.pow2]) o && (i += `<li class="pow">\u2605 <b>${Gn[o].n}:</b> ${Gn[o].d}</li>`);
  if (e && n.type === "gear" && e.slot === n.slot) {
    let o = (f) => {
        let u = {};
        for (let p of _o(f)) u[p.s] = (u[p.s] || 0) + p.v;
        for (let p of f.aff) u[p.s] = (u[p.s] || 0) + p.v;
        return u;
      },
      l = o(n),
      c = o(e),
      h = [...new Set([...Object.keys(l), ...Object.keys(c)])]
        .map((f) => [f, (l[f] || 0) - (c[f] || 0)])
        .filter(([, f]) => Math.abs(f) > 1e-4);
    h.length &&
      (i += `<li style="margin-top:6px;font-size:12px;color:var(--muted)">Frente al equipado: ${h.map(([f, u]) => `<span class="cmp ${u > 0 ? "up" : "dn"}">${Ks(f, u)}</span>`).join(" \xB7 ")}</li>`);
  }
  return ((i += "</ul></div>"), i);
}


// ════════ [664] FunctionDeclaration eS (171 bytes) ════════
function eS(n, e) {
  let t = (n - e) / Math.max(1, e);
  return Math.abs(t) < 0.005
    ? ""
    : `<span class="cmp ${t > 0 ? "up" : "dn"}">${t > 0 ? "\u25B2" : "\u25BC"} ${Math.abs(Math.round(t * 100))}%</span>`;
}


// ════════ [665] FunctionDeclaration tS (93 bytes) ════════
function tS(n) {
  let e = x.S;
  return n.type === "weapon" ? (e.activeW === 0 ? e.eq.w1 : e.eq.w2) : e.eq[n.slot];
}


// ════════ [666] FunctionDeclaration nS (105 bytes) ════════
function nS(n) {
  let e = x.S;
  if (Object.values(e.eq).includes(n)) return !1;
  let t = Hd(n);
  return t ? es(n) > es(t) : !0;
}


// ════════ [667] FunctionDeclaration Vp (735 bytes) ════════
function Vp(n, e, t, i) {
  let s = Ct[n.r];
  return `<div class="cell ${e ? "sel" : ""} ${n.fav ? "lock" : ""} ${i ? "msel" : ""}" data-i="${t}" style="border-color:${s.css}88;color:${s.css};background:linear-gradient(160deg, ${s.css}22, rgba(0,0,0,0.5))" title="${ke(n.name)}"><div class="ic" style="width:${Et.icon(n.type === "weapon" ? "weapon_" + n.base : "gear_" + n.base) ? "90%" : "30px"};height:${Et.icon(n.type === "weapon" ? "weapon_" + n.base : "gear_" + n.base) ? "80%" : "30px"}">${yb(n)}</div>${n.isNew ? '<span class="nw"></span>' : ""}${n.upg ? `<span class="up">+${n.upg}</span>` : ""}${n.r > 0 ? `<span class="rp">${"\u25C6".repeat(n.r)}</span>` : ""}<span class="lv">\u26A1${es(n)}</span>${nS(n) ? '<span class="bt">\u25B2</span>' : ""}${i ? '<span class="chk">\u2713</span>' : ""}</div>`;
}


// ════════ [668] FunctionDeclaration qp (405 bytes) ════════
function qp(n, e, t, i = "data-c") {
  let s = sa(n);
  return `<div class="cell ${e ? "sel" : ""}" ${i}="${t}" style="border-color:${s}88;color:${s};background:linear-gradient(160deg, ${s}22, rgba(0,0,0,0.5))" title="${ke(ts(n))}"><div class="ic" style="font-size:26px">${n.pow ? "\u2605" : "\u2B22"}</div><span class="rp">${"\u25C6".repeat(Math.min(5, n.t || 1))}</span><span class="lv">${n.kind === "w" ? "ARMA" : "EQ"}</span></div>`;
}


// ════════ [669] FunctionDeclaration lh (328 bytes) ════════
function lh(n) {
  let e = sa(n);
  return `<div class="item" style="border-color:${e}55"><h3 style="color:${e}">${ke(ts(n))}</h3><div class="ty">${n.kind === "w" ? "Para armas" : "Para equipo"}${n.pow ? " \xB7 requiere rango Legendario" : ` \xB7 Nivel de m\xF3dulo T${n.t}`}</div><ul><li class="${n.pow ? "pow" : "aff"}">${ke(rp(n))}</li></ul></div>`;
}


// ════════ [670] VariableDeclaration Gp,_b,Mb (511 bytes) ════════
var Gp = {
    scrap: "Enemigos mec\xE1nicos, cajas y desguazar equipo",
    bio: "Insectos y mutantes, cajas, desguazar armaduras",
    crystal: "Cristales morados del mapa, xenos, desguazar objetos raros",
    core: "Jefes; mec\xE1nicos (poco frecuente); desguazar \xE9picos",
    data: "Datapads, rel\xE9s hackeados, terminales y jefes",
    battery: "Cajas y enemigos (poco frecuente)",
    credits: "Enemigos, misiones y contratos",
  },
  _b = (n) => (n === "credits" ? { n: "Cr\xE9ditos", c: "#ffd447", icon: "\xA4" } : mn[n]),
  Mb = (n) => (n === "credits" ? x.S.credits : x.S.mats[n]) || 0;


// ════════ [671] FunctionDeclaration Do (534 bytes) ════════
function Do(n) {
  return `<div class="need">${Object.entries(n)
    .filter(([, e]) => e > 0)
    .map(([e, t]) => {
      let i = _b(e),
        s = Mb(e),
        a = s >= t;
      return `<div class="ln ${a ? "ok" : "no"}" style="--c:${i.c}" title="${ke(i.n)}: ${ke(Gp[e] || "")}"><span class="ic">${i.icon}</span><span class="nm">${ke(i.n)}</span><span class="qty"><b>${yt(Math.min(s, t))}</b>/${yt(t)}${a ? " \u2713" : ""}</span><span class="bar"><i style="width:${Math.min(100, (s / t) * 100)}%"></i></span>${a ? "" : `<span class="miss">Faltan ${yt(t - s)} \xB7 ${ke(Gp[e] || "")}</span>`}</div>`;
    })
    .join("")}</div>`;
}


// ════════ [672] FunctionDeclaration oh (279 bytes) ════════
function oh() {
  return `<div class="matsbar">${[...Object.keys(mn), "credits"]
    .map((n) => {
      let e = _b(n);
      return `<div class="mb" style="--c:${e.c}" title="${ke(Gp[n] || "")}"><span class="ic">${e.icon}</span><span><small>${ke(e.n)}</small><b>${yt(Mb(n))}</b></span></div>`;
    })
    .join("")}</div>`;
}


// ════════ [673] FunctionDeclaration ca (105 bytes) ════════
function ca(n) {
  let e = x.S;
  return Object.entries(n).every(([t, i]) => (t === "credits" ? e.credits : e.mats[t]) >= i);
}


// ════════ [674] FunctionDeclaration wb (108 bytes) ════════
function wb(n) {
  let e = x.S;
  for (let [t, i] of Object.entries(n)) t === "credits" ? (e.credits -= i) : (e.mats[t] -= i);
  ee("res");
}


// ════════ [675] FunctionDeclaration hb (426 bytes) ════════
function hb(n, e) {
  let t = x.S,
    i = x.player,
    s = t.inv.indexOf(n);
  if (s < 0) return;
  let a = n.type === "weapon" ? e || (t.activeW === 0 ? "w1" : "w2") : n.slot;
  n.type === "weapon" && !e && (t.eq.w1 ? t.eq.w2 || (a = "w2") : (a = "w1"));
  let r = t.eq[a];
  (t.inv.splice(s, 1),
    r && t.inv.splice(s, 0, r),
    (t.eq[a] = n),
    (n.isNew = !1),
    a === "w1" && (i.ammo[0] = 0),
    a === "w2" && (i.ammo[1] = 0),
    i.recalc(),
    a === "w1" && (i.ammo[0] = i.ws[0].mag),
    a === "w2" && (i.ammo[1] = i.ws[1].mag),
    (i.reloadT = [0, 0]),
    ae.play("reload"));
}


// ════════ [676] FunctionDeclaration iS (340 bytes) ════════
function iS(n) {
  let e = x.S,
    t = e.eq[n];
  if (t) {
    if (e.inv.length >= wx) {
      ee("toast", "Inventario lleno", "warn");
      return;
    }
    if ((n === "w1" || n === "w2") && !(n === "w1" ? e.eq.w2 : e.eq.w1)) {
      ee("toast", "Necesitas al menos un arma", "warn");
      return;
    }
    ((e.eq[n] = null),
      e.inv.push(t),
      n === "w1" && e.activeW === 0 && (e.activeW = 1),
      n === "w2" && e.activeW === 1 && (e.activeW = 0),
      x.player.recalc());
  }
}


// ════════ [677] FunctionDeclaration ub (162 bytes) ════════
function ub(n) {
  let e = x.S,
    t = e.inv.indexOf(n);
  if (t < 0) return;
  e.inv.splice(t, 1);
  let i = hr(n);
  for (let s in i) e.mats[s] += i[s];
  return (ae.play("metal", { p: 0.8 }), ee("res"), i);
}


// ════════ [678] VariableDeclaration on,sS,qa,Gi,Hi,On,Rs (61 bytes) ════════
var on = null,
  sS = "inv",
  qa = "all",
  Gi = null,
  Hi = !1,
  On = new Set(),
  Rs = !1;


// ════════ [679] FunctionDeclaration Ai (8110 bytes) ════════
function Ai(n = "inv") {
  sS = n;
  let e = x.S,
    t = x.player;
  e.chips || (e.chips = []);
  let i = `<div class="tabs"><button class="tab ${n === "inv" ? "on" : ""}" data-t="inv">Arsenal</button><button class="tab ${n === "mods" ? "on" : ""}" data-t="mods">M\xF3dulos ${e.chips.length}</button>${ecoJunkTabBtn(n)}<button class="tab ${n === "char" ? "on" : ""}" data-t="char">Ficha</button></div>`,
    s = "";
  if (n === "inv") {
    let l = vb
        .map((p) => {
          let m = e.eq[p],
            g = p === "w1" ? "Arma principal" : p === "w2" ? "Arma secundaria" : Cd[p],
            b = (p === "w1" && e.activeW === 0) || (p === "w2" && e.activeW === 1);
          return `<div class="slot ${on && on.eq === p ? "sel" : ""} ${m ? "" : "empty"}" data-eq="${p}" style="--rc:${m ? Ct[m.r].css : "rgba(255,255,255,0.12)"}"><div class="sic" style="color:${m ? Ct[m.r].css : "var(--dim)"}">${m ? yb(m) : rh[p === "w1" || p === "w2" ? "weapon" : p]}${m && m.upg ? `<span class="up">+${m.upg}</span>` : ""}${b ? '<span class="act">\u25CF</span>' : ""}</div><div class="stx"><div class="sl"><span class="lg">${g}${b ? " \xB7 activa" : ""}</span><span class="shn">${{ w1: "Principal", w2: "Secundaria", helmet: "Casco", suit: "Traje", gloves: "Guantes", boots: "Botas", implant: "Implante", module: "M\xF3dulo" }[p]}</span></div><div class="si" style="color:${m ? Ct[m.r].css : "var(--dim)"}">${m ? ke(m.name) : "\u2014 vac\xEDo \u2014"}</div></div></div>`;
        })
        .join(""),
      c = e.inv
        .map((p, m) => ({ it: p, i: m }))
        .filter(({ it: p }) => qa === "all" || (qa === "w" ? p.type === "weapon" : p.type === "gear"));
    for (let p of [...On]) e.inv.includes(p) || On.delete(p);
    let d = c.map(({ it: p, i: m }) => Vp(p, !Hi && on && on.inv === p, m, Hi && On.has(p))).join(""),
      h = "";
    if (Hi) {
      let p = [...On],
        m = p.reduce((_, A) => _ + ka(A), 0),
        g = {};
      for (let _ of p) {
        let A = hr(_);
        for (let T in A) g[T] = (g[T] || 0) + A[T];
      }
      let b = Object.entries(g)
          .map(([_, A]) => `<span style="color:${mn[_].c}">${mn[_].icon} ${A} ${mn[_].n}</span>`)
          .join(" \xB7 "),
        y = p.some((_) => _.r >= 3);
      h = `<div class="mbar">
        <div class="mrow"><span class="muted">Seleccionar:</span>${[...new Set(c.map(({ it: _ }) => _.r))]
          .sort()
          .map((_) => {
            let A = c.filter(({ it: S }) => S.r === _ && !S.fav);
            return `<button class="rchip ${A.length && A.every(({ it: S }) => On.has(S)) ? "on" : ""}" data-mr="${_}" style="--c:${Ct[_].css}">${Ct[_].n} <small>${A.length}</small></button>`;
          })
          .join(
            "",
          )}<button class="rchip" data-mr="all">Todo</button><button class="rchip" data-mr="none">Ninguno</button></div>
        <div class="mrow"><b>${p.length} seleccionados</b>${p.length ? `<span class="muted" style="font-size:13px">Desguazar da: ${b}</span>` : '<span class="muted" style="font-size:13px">Pulsa los objetos para marcarlos. Los bloqueados \u2605 no se marcan con los botones de rareza.</span>'}</div>
        <div class="mrow">${ecoCanSell() ? `<button class="btn pri" data-act="msell" ${p.length ? "" : "disabled"}>${Rs === "sell" ? "Confirmar venta" : "Vender"} (${yt(m)} \xA4)</button>` : ""}<button class="btn bad" data-act="msalv" ${p.length ? "" : "disabled"}>${Rs === "salv" ? "Confirmar desguace" : "Desguazar"} ${p.length || ""}</button>${y && Rs ? '<span style="color:#ff9aa5;font-size:13px">Hay objetos \xE9picos o mejores en la selecci\xF3n.</span>' : ""}</div></div>`;
    }
    let f = on ? on.inv || e.eq[on.eq] : null,
      u =
        '<div class="card muted" style="min-height:120px">Selecciona un objeto para ver sus detalles y compararlo con tu equipo.</div>';
    if (f) {
      let p = on.inv ? tS(f) : null;
      ((u = ql(f, p !== f ? p : null)),
        (u += '<div class="row" style="margin-top:8px">'),
        (u += '<button class="btn pri" data-act="mods">\u2B22 M\xF3dulos</button>'),
        on.inv
          ? (f.type === "weapon"
              ? (u +=
                  '<button class="btn pri" data-act="eq1">Equipar (principal)</button><button class="btn" data-act="eq2">Equipar (secundaria)</button>')
              : (u += '<button class="btn pri" data-act="eq">Equipar</button>'),
            ecoCanSell() && (u += `<button class="btn" data-act="sell">Vender (${yt(ka(f))} \xA4)</button>`),
            (u += `<button class="btn ${f.fav ? "" : "bad"}" data-act="salv" ${f.fav ? "disabled" : ""}>Desguazar (pierdes el plano)</button><button class="btn" data-act="fav">${f.fav ? "Desbloquear" : "Bloquear \u2605"}</button>`))
          : (u += '<button class="btn" data-act="uneq">Quitar</button>'),
        (u += "</div>"));
    }
    ((u = `<div class="invdet ${f ? "open" : ""}">${f ? '<button class="x invdx" data-act="desel" aria-label="Cerrar detalle">\u2715</button>' : ""}${u}</div>`),
      (s = `<div class="grid2"><div><div class="sec">Equipado</div><div class="eq">${l}</div>
      <div class="deskonly"><div class="sec">Resumen</div><div class="stats">${Eb()}</div>
      <div class="sec">Recursos</div><div class="stats">${Object.entries(mn)
        .map(([p, m]) => `<span style="color:${m.c}">${m.icon} ${m.n}</span><span class="v">${yt(e.mats[p])}</span>`)
        .join(
          "",
        )}<span style="color:#ffd447">\xA4 Cr\xE9ditos</span><span class="v">${yt(e.credits)}</span></div></div></div>
      <div style="min-width:0"><div class="row" style="justify-content:space-between"><div class="sec">Arsenal sin equipar ${e.inv.length}</div><button class="btn ${Hi ? "pri" : ""}" data-act="multi" style="padding:4px 10px;font-size:12px">${Hi ? "\u2713 Selecci\xF3n m\xFAltiple" : "Selecci\xF3n m\xFAltiple"}</button><div class="tabs"><button class="tab ${qa === "all" ? "on" : ""}" data-f="all">Todo</button><button class="tab ${qa === "w" ? "on" : ""}" data-f="w">Armas</button><button class="tab ${qa === "g" ? "on" : ""}" data-f="g">Equipo</button></div></div>
      ${h}<div class="inv">${d || '<div class="muted">La mochila est\xE1 vac\xEDa.</div>'}</div>
      ${Hi ? "" : `<div class="row" style="margin-top:8px"><span class="muted" style="font-size:13px">Consejo: Ctrl/May\xFAs + clic para seleccionar varios. Los objetos bloqueados \u2605 est\xE1n protegidos.</span></div><div style="margin-top:10px">${u}</div>`}</div></div>`));
  } else n === "mods" ? (s = aS()) : n === "junk" ? (s = ecoJunkHtml()) : (s = oS());
  let a = (x.uiOpen === "inv" && document.querySelector("#panel .wbody")?.scrollTop) || 0;
  Ze.open(
    "inv",
    `<div class="win">${Ze.head(ecoCanSell() ? "Inventario \xB7 vender" : "Inventario", i)}<div class="wbody">${s}</div></div>`,
    { silent: !!x.uiOpen },
  );
  {
    let l = document.querySelector("#panel .wbody");
    l && (l.scrollTop = a);
  }
  let r = _t("#panel");
  (r.querySelectorAll("[data-t]").forEach((l) => l.addEventListener("click", () => Ai(l.dataset.t))),
    r.querySelectorAll("[data-f]").forEach((l) =>
      l.addEventListener("click", () => {
        ((qa = l.dataset.f), Ai("inv"));
      }),
    ),
    r.querySelectorAll(".cell").forEach((l) =>
      l.addEventListener("click", (c) => {
        let d = e.inv[+l.dataset.i];
        ((d.isNew = !1),
          !Hi && (c.ctrlKey || c.metaKey || c.shiftKey) && ((Hi = !0), On.clear(), on?.inv && On.add(on.inv)),
          Hi ? (On.has(d) ? On.delete(d) : On.add(d), (Rs = !1)) : (on = { inv: d }),
          ae.play("ui"),
          Ai("inv"));
      }),
    ),
    r.querySelectorAll(".cell").forEach((l) =>
      l.addEventListener("dblclick", () => {
        if (Hi) return;
        let c = e.inv[+l.dataset.i];
        (hb(c), (on = null), Ai("inv"));
      }),
    ),
    r.querySelectorAll("[data-mr]").forEach((l) =>
      l.addEventListener("click", () => {
        let c = l.dataset.mr;
        Rs = !1;
        let d = e.inv.filter((h) => qa === "all" || (qa === "w" ? h.type === "weapon" : h.type === "gear"));
        if (c === "none") On.clear();
        else if (c === "all")
          d.forEach((h) => {
            h.fav || On.add(h);
          });
        else {
          let h = +c,
            f = d.filter((p) => p.r === h && !p.fav),
            u = f.every((p) => On.has(p));
          f.forEach((p) => (u ? On.delete(p) : On.add(p)));
        }
        (ae.play("ui"), Ai("inv"));
      }),
    ),
    r.querySelectorAll("[data-eq]").forEach((l) =>
      l.addEventListener("click", () => {
        e.eq[l.dataset.eq] && ((on = { eq: l.dataset.eq }), ae.play("ui"), Ai("inv"));
      }),
    ));
  let o = (l) => {
    let c = on?.inv;
    if (
      ((l === "eq" || l === "eq1" || l === "eq2") &&
        (hb(c, l === "eq1" ? "w1" : l === "eq2" ? "w2" : null), (on = null)),
      l === "uneq" && (iS(on.eq), (on = null)),
      l === "salv" && c)
    ) {
      let d = ub(c);
      (ee(
        "toast",
        "Desguazado: " +
          Object.entries(d)
            .map(([h, f]) => `${f} ${mn[h].n}`)
            .join(", "),
        "",
      ),
        (on = null));
    }
    if ((l === "fav" && c && (c.fav = !c.fav), l === "sell" && c)) {
      let d = e.inv.indexOf(c);
      (e.inv.splice(d, 1), (e.credits += ka(c)), ae.play("coin"), (on = null), ee("res"));
    }
    if ((l === "desel" && (on = null), l === "mods")) {
      let d = on.inv || e.eq[on.eq];
      return Gl(d, () => Ai("inv"));
    }
    if ((l === "multi" && ((Hi = !Hi), On.clear(), (Rs = !1), (on = null)), l === "msalv" || l === "msell")) {
      let d = l === "msalv" ? "salv" : "sell",
        h = [...On].filter((u) => e.inv.includes(u));
      if ((h.some((u) => u.r >= 3 || u.fav) || h.length >= 10) && Rs !== d) {
        ((Rs = d), Ai("inv"));
        return;
      }
      if (((Rs = !1), d === "salv")) {
        let u = {};
        for (let p of h) {
          let m = ub(p);
          for (let g in m) u[g] = (u[g] || 0) + m[g];
        }
        ee(
          "toast",
          `${h.length} desguazados: ` +
            Object.entries(u)
              .map(([p, m]) => `${m} ${mn[p].n}`)
              .join(", "),
          "good",
        );
      } else {
        let u = 0;
        for (let p of h) {
          let m = e.inv.indexOf(p);
          m >= 0 && (e.inv.splice(m, 1), (u += ka(p)));
        }
        ((e.credits += u), ae.play("coin"), ee("res"), ee("toast", `${h.length} vendidos por ${yt(u)} \xA4`, "good"));
      }
      (On.clear(), ee("save"));
    }
    Ai("inv");
  };
  (r.querySelectorAll("[data-act]").forEach((l) => l.addEventListener("click", () => o(l.dataset.act))),
    n === "mods" && rS(r, () => Ai("mods")),
    n === "junk" && ecoJunkBind(r, () => Ai("junk")));
}


// ════════ [680] VariableDeclaration ns (12 bytes) ════════
var ns = null;


// ════════ [681] FunctionDeclaration aS (1415 bytes) ════════
function aS() {
  let e = x.S.chips || [];
  ns && !e.includes(ns) && (ns = null);
  let t = $d(),
    i = t.length
      ? t
          .map(
            (r, o) =>
              `<div class="row" style="justify-content:space-between;margin-bottom:6px"><span style="color:${sa(r[0])}">3\xD7 ${ke(ts(r[0]))} \u2192 <b style="color:${Ct[Math.min(5, r[0].t + 1)].css}">T${r[0].t + 1}</b></span><button class="btn" data-fuse="${o}">Fusionar</button></div>`,
          )
          .join("")
      : '<p class="muted" style="font-size:13px">Junta 3 m\xF3dulos iguales (mismo efecto y nivel T) para fusionarlos en uno de nivel superior.</p>',
    s = e.map((r, o) => ({ c: r, i: o })).sort((r, o) => (o.c.pow ? 9 : o.c.t) - (r.c.pow ? 9 : r.c.t)),
    a =
      '<div class="card muted">Toca un m\xF3dulo para verlo. Se instalan desde el detalle de cada arma o pieza de equipo (bot\xF3n \xABM\xF3dulos\xBB).</div>';
  if (ns) {
    let r = Xd(ns);
    a =
      lh(ns) +
      `<div class="row" style="margin-top:8px"><button class="btn bad" data-csalv="1">Desguazar (${Object.entries(r)
        .filter(([, o]) => o)
        .map(([o, l]) => `${l} ${mn[o].n}`)
        .join(", ")})</button></div>`;
  }
  return `<div class="grid2"><div style="min-width:0"><div class="sec" style="margin-top:0">Fusi\xF3n</div>${i}<div class="sec">Detalle</div>${a}</div><div style="min-width:0"><div class="sec" style="margin-top:0">M\xF3dulos guardados (${e.length})</div><div class="inv">${s.map(({ c: r, i: o }) => qp(r, ns === r, o)).join("") || '<div class="muted">A\xFAn no tienes m\xF3dulos. Caen de \xE9lites, jefes, cofres y zonas interiores.</div>'}</div></div></div>`;
}


// ════════ [682] FunctionDeclaration rS (496 bytes) ════════
function rS(n, e) {
  let t = x.S;
  (n.querySelectorAll("[data-c]").forEach((i) =>
    i.addEventListener("click", () => {
      ((ns = t.chips[+i.dataset.c]), ae.play("ui"), e());
    }),
  ),
    n.querySelectorAll("[data-fuse]").forEach((i) =>
      i.addEventListener("click", () => {
        let s = $d()[+i.dataset.fuse];
        if (!s) return;
        let a = up(s);
        ((ns = a), ae.play("legend", { v: 0.5 }), ee("toast", `Fusionado: ${ts(a)}`, "good"), ee("save"), e());
      }),
    ),
    n.querySelectorAll("[data-csalv]").forEach((i) =>
      i.addEventListener("click", () => {
        ns && (fp(ns), (ns = null), ae.play("metal", { p: 0.8 }), e());
      }),
    ));
}


// ════════ [683] VariableDeclaration Ti (12 bytes) ════════
var Ti = null;


// ════════ [684] FunctionDeclaration Gl (3251 bytes) ════════
function Gl(n, e) {
  let t = x.S;
  (t.chips || (t.chips = []), Ti && !t.chips.includes(Ti) && (Ti = null));
  let i = [];
  for (let h = 0; h < Ga(n); h++) {
    let f = n.aff[h];
    i.push(
      f
        ? `<div class="row" style="justify-content:space-between;margin-bottom:5px"><span class="aff" style="color:${Ct[Math.min(5, f.t || 1)].css}">\u2B22 ${Ks(f.s, f.v)} <small>T${f.t || 1}</small></span><button class="btn" data-un="${h}">Quitar</button></div>`
        : '<div class="muted" style="margin-bottom:5px">\u2B21 Ranura libre</div>',
    );
  }
  for (let h = Ga(n); h < n.aff.length; h++)
    i.push(
      `<div class="row" style="justify-content:space-between"><span>${Ks(n.aff[h].s, n.aff[h].v)}</span><button class="btn" data-un="${h}">Quitar</button></div>`,
    );
  let s = Zs(n),
    a = ["pow", "pow2"]
      .slice(0, Math.max(1, s))
      .map((h, f) =>
        f < s
          ? n[h]
            ? `<div class="row" style="justify-content:space-between;margin-bottom:5px"><span class="pow">\u2605 ${ke(Gn[n[h]].n)}</span><button class="btn" data-un="${h}">Quitar</button></div>`
            : '<div class="muted" style="margin-bottom:5px">\u2606 Ranura legendaria libre</div>'
          : '<div class="muted" style="font-size:13px">\u2606 Ranura legendaria: se desbloquea al ascender a Legendario.</div>',
      )
      .join(""),
    r = t.chips
      .map((h, f) => ({ c: h, i: f }))
      .filter(({ c: h }) => h.kind === ia(n))
      .sort((h, f) => (f.c.pow ? 9 : f.c.t) - (h.c.pow ? 9 : h.c.t)),
    o = r.length
      ? '<div class="card muted">Toca un m\xF3dulo para instalarlo.</div>'
      : `<div class="card muted">No tienes m\xF3dulos para ${n.type === "weapon" ? "armas" : "equipo"}.</div>`;
  if (Ti) {
    let h = "";
    (jd(n, Ti)
      ? Ti.pow && !Zs(n)
        ? (h = "Necesita rango Legendario (asci\xE9ndela en el banco de trabajo).")
        : Ti.pow && [n.pow, n.pow2].filter(Boolean).length >= Zs(n)
          ? (h = "Ranura legendaria ocupada: quita el actual primero.")
          : !Ti.pow && n.aff.length >= Ga(n) && (h = "Sin ranuras libres: quita un m\xF3dulo o asciende la pieza.")
      : (h = "Ya tiene un m\xF3dulo de ese tipo."),
      (o =
        lh(Ti) +
        `<div class="row" style="margin-top:8px"><button class="btn pri" id="mInst" ${h ? "disabled" : ""}>Instalar</button>${h ? `<span class="muted" style="font-size:13px">${h}</span>` : ""}</div>`));
  }
  let l = `<div class="win">${Ze.head("M\xF3dulos \xB7 " + n.name, "")}<div class="wbody"><div class="grid2"><div style="min-width:0">${ql(n)}<div class="sec">Ranuras (${n.aff.length}/${Ga(n)})</div>${i.join("")}<div class="sec">Legendario</div>${a}<p class="muted" style="font-size:12px">Quitar un m\xF3dulo es gratis: vuelve a tu almac\xE9n. M\xE1s ranuras al ascender de rango en el banco de trabajo.</p><button class="btn" id="mBack">\u2190 Volver</button></div>
    <div style="min-width:0"><div class="sec" style="margin-top:0">Compatibles (${r.length})</div><div class="inv">${r.map(({ c: h, i: f }) => qp(h, Ti === h, f, "data-mc")).join("")}</div><div style="margin-top:10px">${o}</div></div></div></div></div>`;
  Ze.open("mods", l, { silent: !!x.uiOpen });
  let c = _t("#panel");
  (c.querySelectorAll("[data-mc]").forEach((h) =>
    h.addEventListener("click", () => {
      ((Ti = t.chips[+h.dataset.mc]), ae.play("ui"), Gl(n, e));
    }),
  ),
    c.querySelectorAll("[data-un]").forEach((h) =>
      h.addEventListener("click", () => {
        let f = h.dataset.un;
        (hp(n, f === "pow" || f === "pow2" ? f : +f), ae.play("reload"), ee("save"), Gl(n, e));
      }),
    ));
  let d = _t("#mInst");
  (d &&
    d.addEventListener("click", () => {
      let h = dp(n, Ti);
      (h ? (ae.play("err"), ee("toast", h, "warn")) : (ae.play("legend", { v: 0.5 }), (Ti = null), ee("save")),
        Gl(n, e));
    }),
    _t("#mBack").addEventListener("click", () => {
      ((Ti = null), e ? e() : Ze.close());
    }));
}


// ════════ [685] FunctionDeclaration Eb (619 bytes) ════════
function Eb() {
  let n = x.player,
    e = x.S,
    t = n.ws[e.activeW],
    i = [
      ["Vida", yt(n.maxHp)],
      ["Escudo", yt(n.maxShield)],
      ["Reducci\xF3n de da\xF1o", Math.round(n.dmgRed * 100) + "%"],
      ["Velocidad", n.speed.toFixed(1) + " m/s"],
    ];
  return (
    t &&
      i.push(
        ["Da\xF1o del arma", yt(t.dmgBase)],
        ["Cadencia", t.rate.toFixed(1) + "/s"],
        ["Cr\xEDtico", Math.round(t.critC * 100) + "% \xD7" + t.critM.toFixed(2)],
      ),
    i.push(
      ["Calor / Fr\xEDo", `${Math.round(n.res.heat * 100)}% / ${Math.round(n.res.cold * 100)}%`],
      ["T\xF3xico / Radiaci\xF3n", `${Math.round(n.res.toxic * 100)}% / ${Math.round(n.res.rad * 100)}%`],
    ),
    i.map(([s, a]) => `<span>${s}</span><span class="v">${a}</span>`).join("")
  );
}


// ════════ [686] FunctionDeclaration oS (2032 bytes) ════════
function oS() {
  let n = x.S,
    e = x.player,
    t = e.st,
    i = Object.keys(Sl).filter((o) => t[o]),
    s = tlSummaryHTML(),
    a = [...e.powers]
      .map(
        (o) =>
          `<div class="card"><b style="color:var(--amber2)">\u2605 ${Gn[o].n}</b><div class="muted" style="font-size:13px">${Gn[o].d}</div></div>`,
      )
      .join(""),
    r = Di[n.diff];
  return `<div class="grid2"><div><div class="sec">${ke(n.name)} \xB7 ${vo(n.lvl)}</div><div class="stats">
    <span>Nivel</span><span class="v">${n.lvl}</span><span>Experiencia</span><span class="v">${yt(n.xp)} / ${yt(mt.xpToNext(n.lvl))}</span><span>Dificultad</span><span class="v">${r.n}</span>
    <span>Tiempo de juego</span><span class="v">${Xs(n.playTime)}</span><span>Bajas</span><span class="v">${yt(n.stats.kills)}</span><span>\xC9lites abatidos</span><span class="v">${yt(n.stats.elites)}</span><span>Jefes abatidos</span><span class="v">${n.stats.bosses}</span><span>Operaciones</span><span class="v">${n.stats.ops}</span><span>Terminales</span><span class="v">${n.stats.terminals}</span><span>Hackeo</span><span class="v">${hackSummaryText()}</span><span>Distancia</span><span class="v">${yt(n.stats.dist)} m</span><span>Ca\xEDdas</span><span class="v">${n.stats.deaths}</span></div>
    <div class="sec">Combate</div><div class="stats">${Eb()}</div>
    <div class="sec">Recursos</div>${oh()}
    <div class="sec">Bonificaciones totales</div><div style="font-size:14px;line-height:1.5">${i.map((o) => `<div>${Ks(o, t[o])}</div>`).join("") || '<span class="muted">Ninguna todav\xEDa.</span>'}</div></div>
    <div style="min-width:0"><div class="sec">Poderes activos</div><div class="cards">${a || '<span class="muted">Consigue objetos legendarios o talentos de poder para desbloquearlos.</span>'}</div><div class="sec">\xC1rbol de talentos</div><div class="tlsum">${s}</div></div></div>`;
}


// ════════ [687] VariableDeclaration Bl,_r,Hl,fb (29 bytes) ════════
var Bl = null,
  _r = -1,
  Hl = 1,
  fb = -1;


// ════════ [688-689] pb / Wa — sustituidas por el árbol de talentos (31b-talents.js) ════════
// Las mejoras aleatorias con modal ya no existen: Wa() abre el árbol (compatibilidad con 32-boot y __dbg.openLevelUp).
function pb() {
  return [];
}
function Wa() {
  openTalents();
}


// ════════ [690] FunctionDeclaration Sr (2284 bytes) ════════
function Sr(n) {
  let e = x.S,
    t = zt[n];
  (e.met || (e.met = {}), !e.met[n] && Ll[n] && ((e.met[n] = 1), ee("archive", "Personaje: " + t.n)));
  let i = ht.onTalk(n),
    s = ht.readyAt(n),
    a = ht.available(n),
    r = ht.repeatOffer(n),
    o = t.greet[Math.floor(Lt() * t.greet.length)],
    l = "";
  for (let f of s) {
    let u = ri(f, e.quests.active[f]);
    l += `<button class="opt r" data-turn="${f}"><span class="ic">\u2714</span>Entregar: ${ke(u.n)}</button>`;
  }
  for (let f of a)
    l += `<button class="opt q" data-quest="${f.id}" ${f.locked ? 'disabled style="opacity:.5"' : ""}><span class="ic">${f.def.main ? "\u25C6" : "!"}</span>${ke(f.def.n)}${f.locked ? ` \xB7 requiere nivel ${f.def.lvl - (f.def.main ? 3 : 2)}` : ""}</button>`;
  r && r.def
    ? (l += `<button class="opt q" data-rep="1"><span class="ic">\u21BB</span>Encargo: ${ke(r.def.n)}</button>`)
    : r &&
      r.cooldown &&
      (l += `<div class="muted" style="font-size:13px;padding:4px 2px">Nuevo encargo disponible en ${Xs(r.cooldown / 1e3)}.</div>`);
  let c = {
    shop: "Comerciar",
    workbench: "Banco de trabajo",
    research: "Laboratorio de investigaci\xF3n",
    contracts: "Tabl\xF3n de contratos",
    deploy: "Operaciones especiales",
    medic: "Atenci\xF3n m\xE9dica",
  };
  for (let f of t.svc)
    (f === "research" && !e.flags.research) ||
      (l += `<button class="opt" data-svc="${f}"><span class="ic">\u25B8</span>${c[f]}</button>`);
  l += '<button class="opt" data-close><span class="ic">\u2715</span>Hasta luego</button>';
  let d = Et.image(n + "_portrait");
  Ze.open(
    "dialog",
    `<div class="win dlg">${Ze.head(t.n, `<span class="tag" style="color:var(--muted)">${ke(t.role)}</span>`)}<div class="wbody">${d ? `<img src="${d}" alt="" style="float:left;width:120px;height:120px;object-fit:cover;margin:0 14px 8px 0;border:1px solid var(--line)">` : ""}<div class="say">\u201C${ke(i ? "Ya era hora de que llegaras. Te estaba esperando." : o)}\u201D</div><div class="opts">${l}</div></div></div>`,
  );
  let h = _t("#panel");
  (h
    .querySelectorAll("[data-quest]")
    .forEach((f) => f.addEventListener("click", () => mb(n, f.dataset.quest, gi[f.dataset.quest]))),
    h.querySelectorAll("[data-rep]").forEach((f) => f.addEventListener("click", () => mb(n, r.def.id, r.def))),
    h.querySelectorAll("[data-turn]").forEach((f) =>
      f.addEventListener("click", () => {
        let u = f.dataset.turn,
          p = ri(u, e.quests.active[u]);
        ht.turnIn(u) && Sb(n, p.done || "\xA1Buen trabajo!", () => Sr(n));
      }),
    ),
    h.querySelectorAll("[data-svc]").forEach((f) => f.addEventListener("click", () => Wp(f.dataset.svc, n))));
}


// ════════ [691] FunctionDeclaration Sb (320 bytes) ════════
function Sb(n, e, t) {
  let i = zt[n];
  (Ze.open(
    "dialog",
    `<div class="win dlg">${Ze.head(i.n)}<div class="wbody"><div class="say">\u201C${ke(e)}\u201D</div><div class="opts"><button class="opt" id="dlNext"><span class="ic">\u25B8</span>Continuar</button></div></div></div>`,
    { silent: !0 },
  ),
    _t("#dlNext").addEventListener("click", t));
}


// ════════ [692] FunctionDeclaration mb (1081 bytes) ════════
function mb(n, e, t) {
  let i = zt[n],
    s = t.rew || {},
    a = [
      s.credits ? `${yt(s.credits)} \xA4` : "",
      s.items?.length ? `${s.items.length} objeto(s)` : "",
      s.item ? "objeto aleatorio" : "",
      s.flag === "flashlight" ? "Linterna t\xE1ctica" : "",
      s.flag === "research" ? "Acceso al laboratorio" : "",
      "experiencia",
    ]
      .filter(Boolean)
      .join(" \xB7 ");
  (Ze.open(
    "dialog",
    `<div class="win dlg">${Ze.head(t.n, t.main ? '<span class="tag" style="color:#ffd447">Historia</span>' : t.repeat ? '<span class="tag" style="color:var(--muted)">Repetible</span>' : "")}<div class="wbody"><div class="say">\u201C${ke(t.intro)}\u201D</div>
    <div class="q"><div class="sec" style="margin-top:0">Objetivos</div>${t.obj.map((r) => `<p>\u2022 ${ke(ht.objText(r, 0))}</p>`).join("")}<div class="sec">Recompensa</div><p>${ke(a)}</p></div>
    <div class="row"><button class="btn pri" id="qAcc">Aceptar misi\xF3n</button><button class="btn" id="qBack">Volver</button></div></div></div>`,
    { silent: !0 },
  ),
    _t("#qAcc").addEventListener("click", () => {
      (ht.accept(e, t), t.obj.every((r) => r.t === "gather") && ht.refreshGather(), Sr(n));
    }),
    _t("#qBack").addEventListener("click", () => Sr(n)));
}


// ════════ [693] FunctionDeclaration Wp (341 bytes) ════════
function Wp(n, e) {
  if (n === "shop") Oo(e);
  else if (n === "workbench") fs();
  else if (n === "research") ch();
  else if (n === "contracts") Vl();
  else if (n === "deploy") Wl({ reg: Jd(), base: !0 });
  else if (n === "medic") {
    let t = x.player;
    ((t.hp = t.maxHp),
      (t.shield = t.maxShield),
      ae.play("heal"),
      Sb(e, "Listo. Como nuevo. Intenta que no te vuelvan a agujerear tan pronto.", () => Sr(e)));
  }
}


// ════════ [694] VariableDeclaration gb (74 bytes) ════════
var gb = (n, e) => Math.round((n.pow ? 2500 : 45 * Math.pow(n.t, 1.7)) * mt.credits(e));


// ════════ [695-696] lS (stock de un vendedor) y Oo (tienda) ════════
// La tienda (Comprar · Vender · Curiosidades), su stock limitado y los precios viven en 31a-economy.js.
function lS(n) {
  return ecoShopStock(n);
}
function Oo(n) {
  ecoShopOpen(n);
}


// ════════ [697] ExpressionStatement ExpressionStatement (117 bytes) ════════
It("uiClosed", (n) => {
  (n === "inv" && ((Hi = !1), On.clear(), (Rs = !1)),
    (n === "inv" || n === "shop") && (n === "inv" && Gi && Gi.selling, (Gi = null)));
});


// ════════ [698] VariableDeclaration Dn,xb (21 bytes) ════════
var Dn = null,
  xb = "lvl";


// ════════ [699] FunctionDeclaration fs (5227 bytes) ════════
function fs(n = xb) {
  ((n === "upg" || n === "reforge") && (n = "lvl"), (xb = n));
  let e = x.S,
    t = [...vb.map((u) => e.eq[u]).filter(Boolean), ...e.inv];
  Dn && !t.includes(Dn) && (Dn = null);
  let i = `<div class="tabs">${[
      ["lvl", "Mejorar"],
      ["mods", "M\xF3dulos"],
      ["craft", "Fabricar"],
      ["gadgets", "Gadgets"],
    ]
      .map(([u, p]) => `<button class="tab ${n === u ? "on" : ""}" data-t="${u}">${p}</button>`)
      .join("")}</div>`,
    s = "";
  if (n === "gadgets") s = gadgetsPanelHtml(); // 31c-gadgets.js
  else if (n === "craft")
    s =
      [
        ["grenade", { scrap: 4, credits: 20 }],
        ["medkit", { bio: 4, credits: 25 }],
        ["stim", { bio: 3, crystal: 1, credits: 40 }],
      ]
        .map(
          ([p, m]) =>
            `<div class="card" style="margin-bottom:8px"><b>${Tl[p].n}</b> <span class="muted">(tienes ${e.cons[p]})</span><div class="cost">${Do(m)}</div><button class="btn" style="margin-top:6px" data-craft="${p}" ${ca(m) ? "" : "disabled"}>Fabricar</button></div>`,
        )
        .join("") +
      `<div class="card" style="margin-bottom:8px"><b>Convertir chatarra en cristal</b><div class="cost">${Do({ scrap: 25, credits: 100 })}</div><button class="btn" style="margin-top:6px" data-craft="conv" ${ca({ scrap: 25, credits: 100 }) ? "" : "disabled"}>Convertir</button></div><div class="card"><b>Fabricar m\xF3dulo aleatorio</b><div class="muted" style="font-size:13px">Un m\xF3dulo T1\u2013T3 para armas o equipo.</div><div class="cost">${Do({ crystal: 3, data: 2, credits: 150 })}</div><button class="btn" style="margin-top:6px" data-craft="chip" ${ca({ crystal: 3, data: 2, credits: 150 }) ? "" : "disabled"}>Fabricar</button></div>`;
  else if (Dn)
    if (((s = ql(Dn)), n === "lvl")) {
      let u = Dn;
      if (!Vd(u))
        s += `<div class="card" style="margin-top:8px"><b>Nivel ${u.ilvl}</b><div class="muted" style="font-size:13px">${u.ilvl >= 70 ? "Nivel m\xE1ximo." : "No puede superar tu nivel de operador (" + e.lvl + "). Sube de nivel para seguir mejor\xE1ndola."}</div></div>`;
      else {
        let m = Gd(u);
        s += `<div class="card" style="margin-top:8px"><b>Subir a nivel ${u.ilvl + 1}</b><div class="muted" style="font-size:13px">${u.type === "weapon" ? "M\xE1s da\xF1o" : "M\xE1s vida, blindaje y resistencias"} en cada nivel (m\xE1ximo: tu nivel, ${e.lvl}).</div><div class="cost">${Do(m)}</div><div class="row" style="margin-top:6px"><button class="btn pri" id="wbLv" ${ca(m) ? "" : "disabled"}>Mejorar</button><button class="btn" id="wbLvMax" ${ca(m) ? "" : "disabled"}>Mejorar al m\xE1ximo posible</button></div></div>`;
      }
      let p = qd(u);
      if (!p)
        s +=
          '<div class="card" style="margin-top:8px"><b>Rango m\xE1ximo</b><div class="muted" style="font-size:13px">${u.r >= 5 ? "Rango M\xEDtico alcanzado." : "El rango M\xEDtico no se consigue ascendiendo: solo cae de los jefes m\xE1s dif\xEDciles."}</div></div>';
      else {
        let m = u.r + 1;
        s += `<div class="card" style="margin-top:8px"><b>Ascender a <span style="color:${Ct[m].css}">${Ct[m].n}</span></b><div class="muted" style="font-size:13px">M\xE1s poder base y ${ur[m] > ur[u.r] ? "+1 ranura de m\xF3dulo" : "misma cantidad de ranuras"}${m === 4 ? " y una ranura legendaria" : m === 5 && u.type === "weapon" ? " y una segunda ranura legendaria" : ""}. Los n\xFAcleos \u25C9 salen de jefes, cofres buenos, operaciones y zonas interiores.</div><div class="cost">${Do(p)}</div><button class="btn pri" style="margin-top:6px" id="wbAsc" ${ca(p) ? "" : "disabled"}>Ascender</button></div>`;
      }
    } else
      s +=
        '<button class="btn pri" style="margin-top:8px" id="wbMods">\u2B22 Gestionar m\xF3dulos de esta pieza</button>';
  else s = '<div class="card muted">Elige un arma o pieza de tu arsenal.</div>';
  let a =
    n === "craft" || n === "gadgets"
      ? oh() + (n === "gadgets" ? gadgetsPanelInfo() : "")
      : `<p class="muted" style="margin:0 0 8px;font-size:13px">${n === "lvl" ? "Toca una pieza para subirle el nivel o ascender su rango." : "Toca una pieza para cambiar sus m\xF3dulos."}</p>${oh()}<div class="inv">${t.map((u, p) => Vp(u, Dn === u, p)).join("")}</div>`;
  n !== "craft" &&
    n !== "gadgets" &&
    (s = `<div class="invdet ${Dn ? "open" : ""} wbdet">${Dn ? '<button class="x invdx" id="wbX" aria-label="Cerrar detalle">\u2715</button>' : ""}${s}</div>`);
  let r = (x.uiOpen === "workbench" && document.querySelector("#panel .wbody")?.scrollTop) || 0;
  Ze.open(
    "workbench",
    `<div class="win">${Ze.head("Banco de trabajo", i)}<div class="wbody"><div class="grid2"><div style="min-width:0">${a}</div><div style="min-width:0">${s}</div></div></div></div>`,
    { silent: x.uiOpen === "workbench" },
  );
  {
    let u = document.querySelector("#panel .wbody");
    u && (u.scrollTop = r);
  }
  let o = _t("#wbX");
  o &&
    (o.onclick = () => {
      ((Dn = null), fs());
    });
  let l = _t("#panel");
  (n === "gadgets" && gadgetsPanelBind(l, () => fs("gadgets")),
    l.querySelectorAll("[data-t]").forEach((u) => u.addEventListener("click", () => fs(u.dataset.t))),
    l.querySelectorAll(".cell").forEach((u) =>
      u.addEventListener("click", () => {
        ((Dn = t[+u.dataset.i]), fs());
      }),
    ));
  let c = _t("#wbLv");
  c &&
    c.addEventListener("click", () => {
      (Wd(Dn, 1) && (ae.play("legend", { v: 0.5 }), ee("save")), fs());
    });
  let d = _t("#wbLvMax");
  d &&
    d.addEventListener("click", () => {
      let u = Wd(Dn, 99);
      (u &&
        (ae.play("legend", { v: 0.6 }),
        ee("toast", `+${u} niveles \xB7 ${Dn.name} nivel ${Dn.ilvl}`, "good"),
        ee("save")),
        fs());
    });
  let h = _t("#wbAsc");
  h &&
    h.addEventListener("click", () => {
      (cp(Dn) && (ae.play("levelup"), ee("toast", `${Dn.name} asciende a ${Ct[Dn.r].n}`, "good"), ee("save")), fs());
    });
  let f = _t("#wbMods");
  (f && f.addEventListener("click", () => Gl(Dn, () => fs("mods"))),
    l.querySelectorAll("[data-craft]").forEach((u) =>
      u.addEventListener("click", () => {
        let p = u.dataset.craft,
          m = {
            grenade: { scrap: 4, credits: 20 },
            medkit: { bio: 4, credits: 25 },
            stim: { bio: 3, crystal: 1, credits: 40 },
            conv: { scrap: 25, credits: 100 },
            chip: { crystal: 3, data: 2, credits: 150 },
          }[p];
        if (ca(m)) {
          if ((wb(m), p === "conv")) e.mats.crystal++;
          else if (p === "chip") {
            let g = xi(e.lvl, { tier: 1 + Math.floor(Lt() * 3) });
            (Ts(g, { silent: !0 }), ee("toast", `Fabricado: ${ts(g)}`, "good"));
          } else e.cons[p]++;
          (ae.play("reload"), ee("cons"), ee("save"), fs("craft"));
        }
      }),
    ));
}


// ════════ [700] FunctionDeclaration ch (1336 bytes) ════════
function ch() {
  let n = x.S,
    e = `<div class="win">${Ze.head("Laboratorio xenobiol\xF3gico", "")}<div class="wbody"><p class="muted" style="margin-top:0">Mejoras permanentes basadas en el estudio del Enjambre. Pasa el rat\xF3n por un material para ver d\xF3nde conseguirlo.</p><div class="sec" style="margin-top:0">Tus materiales</div>${oh()}<div class="sec">Investigaciones</div><div class="cards">${Rl.map(
      (t) => {
        let i = n.research[t.id] || 0,
          s = i >= t.max,
          a = bf(t, i),
          r = !s && ca(a);
        return `<div class="card${r ? " can" : ""}"><b>${ke(t.n)}</b> <span class="tag" style="color:var(--amber)">Nivel ${i}/${t.max}</span><div class="muted" style="font-size:13px;margin:4px 0">${ke(t.d)}</div>${s ? '<div class="cost" style="color:var(--good,#7ed957)">\u2713 Completado</div>' : `<div class="muted" style="font-size:11px;letter-spacing:.12em;margin-top:6px">NECESITAS</div>${Do(a)}<button class="btn${r ? " pri" : ""}" style="margin-top:8px;width:100%" data-r="${t.id}" ${r ? "" : "disabled"}>${r ? "Investigar" : "Faltan materiales"}</button>`}</div>`;
      },
    ).join("")}</div></div></div>`;
  (Ze.open("research", e, { silent: x.uiOpen === "research" }),
    _t("#panel")
      .querySelectorAll("[data-r]")
      .forEach((t) =>
        t.addEventListener("click", () => {
          let i = Rl.find((r) => r.id === t.dataset.r),
            s = n.research[i.id] || 0,
            a = bf(i, s);
          ca(a) && (wb(a), (n.research[i.id] = s + 1), ae.play("levelup"), x.player.recalc(), ee("save"), ch());
        }),
      ));
}


// ════════ [701] FunctionDeclaration Vl (1533 bytes) ════════
function Vl() {
  let n = x.S,
    e = ht.board(),
    t = Object.entries(n.quests.active).filter(([a, r]) => r.def && r.def.board),
    i = `<div class="win">${Ze.head("Tabl\xF3n de contratos", `<span class="tag" style="color:var(--muted)">Nuevos contratos en ${Xs((e.gen + 30 * 6e4 - Date.now()) / 1e3)}</span>`)}<div class="wbody">
    ${
      t.length
        ? `<div class="sec" style="margin-top:0">En curso</div>${t
            .map(([a, r]) => {
              let o = r.def,
                l = ht.complete(a, r);
              return `<div class="q"><h4>${ke(o.n)} <span class="tag" style="color:var(--muted)">${De[o.reg].n}</span></h4>${o.obj.map((c, d) => `<p>${ke(ht.objText(c, r.prog[d]))}</p>`).join("")}${l ? `<button class="btn pri" data-turn="${a}">Cobrar ${yt(o.rew.credits)} \xA4</button>` : ""}</div>`;
            })
            .join("")}`
        : ""
    }
    <div class="sec">Disponibles</div><div class="cards">${e.list.map((a, r) => `<div class="card"><b>${ke(a.n)}</b><div class="muted" style="font-size:13px">${De[a.reg].n} \xB7 Nivel ${a.lvl}</div><p style="font-size:14px;margin:6px 0">${ke(a.intro)}</p><div class="cost">Pago: ${yt(a.rew.credits)} \xA4${a.rew.item ? " + objeto" : ""}</div><button class="btn" style="margin-top:6px" data-acc="${r}">Aceptar</button></div>`).join("") || '<span class="muted">No quedan contratos. Vuelve m\xE1s tarde.</span>'}</div></div></div>`;
  Ze.open("board", i, { silent: x.uiOpen === "board" });
  let s = _t("#panel");
  (s.querySelectorAll("[data-acc]").forEach((a) =>
    a.addEventListener("click", () => {
      let r = e.list[+a.dataset.acc];
      (ht.accept(r.id, r), Vl());
    }),
  ),
    s.querySelectorAll("[data-turn]").forEach((a) =>
      a.addEventListener("click", () => {
        (ht.turnIn(a.dataset.turn), Vl());
      }),
    ));
}


// ════════ [702] VariableDeclaration Mr,bb (18 bytes) ════════
var Mr = null,
  bb = "";


// ════════ [703] FunctionDeclaration Wl (1827 bytes) ════════
function Wl(n) {
  let e = x.S,
    t = (n.breach ? n.breach.id : "base") + "|" + e.lvl;
  if (!Mr || bb !== t || n.reroll)
    if (((bb = t), (Mr = []), n.breach)) for (let r = 0; r < 3; r++) Mr.push(Lp({ reg: n.reg }));
    else {
      let r = Jd();
      for (let o = 0; o < 3; o++) {
        let l = qe(r - o, 0, 8),
          c = De[l];
        Mr.push(Lp({ reg: l, lvl: qe(e.lvl + (o - 1), c.lvl[0], Math.max(c.lvl[1] + 2, e.flags.victory ? 60 : 0)) }));
      }
    }
  let i = `<div class="win">${Ze.head(n.breach ? "Brecha dimensional" : "Mesa de operaciones", "")}<div class="wbody"><p class="muted" style="margin-top:0">Las operaciones generan instalaciones nuevas cada vez. Completa el objetivo y vuelve al punto de extracci\xF3n para cobrar.</p>
    <div class="cards">${Mr.map((r, o) => {
      let l = 1 + r.mods.reduce((d, h) => d + (mr[h].rew || 0), 0),
        c = r.lvl > e.lvl + 2;
      return `<div class="card"><div class="sec" style="margin-top:0">${Zi[r.theme].n}</div><b style="font-size:17px">${pr[r.obj].n}</b><div class="muted" style="font-size:13px">${pr[r.obj].d}</div><p style="margin:6px 0;font-size:14px">Nivel de amenaza: <b style="color:${c ? "var(--bad)" : "var(--text)"}">${r.lvl}</b></p>${r.mods.map((d) => `<div style="font-size:13px"><span style="color:var(--amber2)">${mr[d].n}:</span> ${mr[d].d}</div>`).join("") || '<div class="muted" style="font-size:13px">Sin modificadores</div>'}<div class="cost" style="margin-top:6px">Bot\xEDn \xD7${l.toFixed(2)}</div><button class="btn pri" style="margin-top:8px" data-go="${o}">Desplegar</button></div>`;
    }).join("")}</div>
    ${n.breach ? "" : '<div class="row" style="margin-top:10px"><button class="btn" id="dReroll">Buscar otras operaciones</button></div>'}</div></div>`;
  (Ze.open("deploy", i, { silent: x.uiOpen === "deploy" }),
    _t("#panel")
      .querySelectorAll("[data-go]")
      .forEach((r) =>
        r.addEventListener("click", () => {
          let o = Mr[+r.dataset.go];
          ((Mr = null), Ze.close(), ae.play("portal"), x.world.loadOp(o));
        }),
      ));
  let a = _t("#dReroll");
  a && a.addEventListener("click", () => Wl({ ...n, reroll: !0 }));
}


// ════════ [704] FunctionDeclaration jp (986 bytes) ════════
function jp(n, e) {
  if (hackOpenTerminal(n, e)) return; // hackeo profundo (31e-hacking.js): capas, traza y programas; si no puede, el antiguo
  let t = lb(n.id + (x.mode === "op" ? x.op.seed : "")),
    i = qe(n.diff || 1, 1, 4),
    s =
      {
        secret: "Desbloquea un acceso oculto",
        relay: "Descarga de datos (reutilizable)",
        cache: "Abre un contenedor de suministros",
        boss: "\u26A0 Activa la baliza de desaf\xEDo: invoca a un enemigo legendario",
        opdata: "Recupera datos de la operaci\xF3n",
      }[n.eff] || "";
  Ze.open(
    "hack",
    `<div class="win" style="width:min(620px,100%)">${Ze.head("Terminal \xB7 " + cb[t], `<span class="tag" style="color:var(--cyan)">Dificultad ${"\u25AE".repeat(i)}${"\u25AF".repeat(4 - i)}</span>`)}<div class="wbody"><p class="muted" style="margin-top:0;text-align:center">${ke(s)}. Un fallo activar\xE1 la alarma.</p><div id="pzRoot"></div><div class="row" style="justify-content:center;margin-top:8px"><button class="btn" id="pzAbort">Desconectar (sin penalizaci\xF3n)</button></div></div></div>`,
    { modal: !0 },
  );
  let a = _t("#pzRoot");
  ((wr = db(a, t, i, (r) => {
    (Ze.close(), x.world.hackResult(n, e, r));
  })),
    _t("#pzAbort").addEventListener("click", () => Ze.close()));
}


// ════════ [705] FunctionDeclaration dh (3740 bytes) ════════
function dh(n = !1) {
  let e = x.S,
    t = x.world,
    i = x.map,
    s = x.mode === "world" && (n || t.inBase()),
    a =
      x.mode === "world"
        ? De.map((g) => {
            let b = t.unlockedReg(g.id),
              y = t.bossDown(g.id);
            return `<div style="font-size:13px;margin-bottom:4px;${b ? "" : "opacity:.5"}"><b>${ke(g.n)}</b> <span class="muted">Nv ${g.lvl[0]}\u2013${g.lvl[1]}</span>${g.hz ? ` <span style="color:${fr[g.hz.t].c}">${fr[g.hz.t].icon} ${Math.round(g.hz.req * 100)}%</span>` : ""}${y ? ' <span style="color:var(--good)">\u2714</span>' : ""}</div>`;
          }).join("")
        : `<p class="muted">${x.op && x.op.sub ? "Plano de la zona interior." : "Mapa de la operaci\xF3n actual."}</p>`;
  Ze.open(
    "map",
    `<div class="win">${Ze.head(x.mode === "world" ? "Mapa t\xE1ctico" : "Plano de la instalaci\xF3n", s ? '<span class="tag" style="color:var(--cyan)">Pulsa una baliza activa para viajar</span>' : "")}<div class="wbody"><div class="mapwrap"><canvas id="mapc" width="760" height="760"></canvas><div><div class="sec" style="margin-top:0">Regiones</div>${a}<div class="sec">Leyenda</div><div style="font-size:13px;line-height:1.7"><span style="color:#46e4ff">\u25CF</span> Baliza \xB7 <span style="color:#ffd447">\u25CF</span> Aliado \xB7 <span style="color:#ff4060">\u25CF</span> Guarida \xB7 <span style="color:#b56bff">\u25CF</span> Brecha \xB7 <span style="color:#30e0a0">\u25CF</span> Terminal \xB7 <span style="color:#ff9a3c">\u25C6</span> Acceso interior \xB7 <span style="color:#ffb340">\u25C6</span> Misi\xF3n</div>${x.mode === "op" ? '<div class="row" style="margin-top:12px"><button class="btn bad" id="mAbort">' + (x.op && x.op.sub ? "Salir a la superficie" : "Abortar operaci\xF3n") + "</button></div>" : ""}</div></div></div></div>`,
  );
  let r = _t("#mapc"),
    o = r.getContext("2d"),
    l = Hp(),
    c = x.mode === "world" ? Bp(t) : null,
    d = i.w,
    h = r.width,
    f = h / (d * Math.SQRT2),
    u = (g, b) => {
      let y = g - d / 2,
        v = b - d / 2,
        _ = (y - v) * Math.SQRT1_2,
        A = (y + v) * Math.SQRT1_2;
      return [h / 2 + _ * f, h / 2 + A * f];
    };
  ((() => {
    ((o.fillStyle = "#050708"),
      o.fillRect(0, 0, h, h),
      o.save(),
      o.translate(h / 2, h / 2),
      o.scale(f, f),
      o.rotate(Math.PI / 4),
      o.translate(-d / 2, -d / 2),
      (o.imageSmoothingEnabled = !1),
      o.drawImage(l, 0, 0),
      c && o.drawImage(c, 0, 0, c.width * 2, c.height * 2),
      o.restore());
    let g = (v, _, A, T = 4, S) => {
        let [k, w] = u(v, _);
        ((o.fillStyle = A),
          o.beginPath(),
          S === "d"
            ? (o.moveTo(k, w - T), o.lineTo(k + T, w), o.lineTo(k, w + T), o.lineTo(k - T, w))
            : o.arc(k, w, T, 0, 6.283),
          o.fill());
      },
      b = (v) => x.mode !== "world" || t.fogAt(Math.floor(v.x), Math.floor(v.z));
    for (let v of i.ents)
      b(v) &&
        (v.k === "beacon"
          ? g(v.x, v.z, e.world.beacons[v.id] ? "#46e4ff" : "#3a5058", 6)
          : v.k === "npc"
            ? g(v.x, v.z, "#ffd447", 3.5)
            : v.k === "bossarena" && !v.secret
              ? g(v.x, v.z, t.bossDown(v.reg) ? "#6a3038" : "#ff4060", 6)
              : v.k === "breach"
                ? g(v.x, v.z, "#b56bff", 5)
                : v.k === "terminal" && !t.termDone(v)
                  ? g(v.x, v.z, "#30e0a0", 3)
                  : v.k === "extract" || v.k === "exit"
                    ? g(v.x, v.z, "#50ff90", 6)
                    : v.k === "stairs"
                      ? g(v.x, v.z, t.subReady(v) ? "#ff9a3c" : "#5a4a3a", 3.5, "d")
                      : v.k === "encounter" && g(v.x, v.z, "#c58bff", 5, "d"));
    if (x.mode === "world")
      for (let v of De) {
        let [_, A] = u(v.gx * qt + qt / 2, v.gz * qt + qt / 2);
        ((o.font = '600 13px "Chakra Petch", sans-serif'),
          (o.textAlign = "center"),
          (o.fillStyle = "rgba(230,235,238,0.75)"),
          o.fillText(v.n.toUpperCase(), _, A));
      }
    for (let [v, _] of Object.entries(e.quests.active)) {
      if (!_.tracked) continue;
      let A = ht.target(v, _);
      A && g(A.x, A.z, "#ffb340", 7, "d");
    }
    let y = x.player;
    g(y.x, y.z, "#ffffff", 5);
  })(),
    s &&
      r.addEventListener("click", (g) => {
        let b = r.getBoundingClientRect(),
          y = (g.clientX - b.left) * (r.width / b.width),
          v = (g.clientY - b.top) * (r.height / b.height),
          _ = null,
          A = 16;
        for (let T of i.ents)
          if (T.k === "beacon" && e.world.beacons[T.id]) {
            let [S, k] = u(T.x, T.z),
              w = Math.hypot(S - y, k - v);
            w < A && ((A = w), (_ = T));
          }
        _ &&
          (Ze.close(),
          ae.play("portal"),
          x.fx.burst(x.player.x, 1, x.player.z, 30, { color: 4646143, speed: 4, life: 0.6, size: 0.3 }),
          x.world.loadWorld({ x: _.x, z: _.z + 2 }),
          ee("toast", `Viaje r\xE1pido: ${_.n}`, "good"));
      }));
  let m = _t("#mAbort");
  m &&
    m.addEventListener("click", () => {
      (Ze.close(), x.op && x.op.sub ? x.world.leaveSub() : x.world.abortOp());
    });
}


// ════════ [706] FunctionDeclaration Er (1947 bytes) ════════
function Er(n = "act") {
  let e = x.S,
    t = `<div class="tabs"><button class="tab ${n === "act" ? "on" : ""}" data-t="act">Activas</button><button class="tab ${n === "lore" ? "on" : ""}" data-t="lore">Archivo (L)</button><button class="tab ${n === "help" ? "on" : ""}" data-t="help">Manual</button></div>`,
    i = "";
  if (n === "act") {
    let a = Object.entries(e.quests.active);
    ((i = a.length
      ? a
          .map(([r, o]) => {
            let l = ri(r, o),
              c = ht.complete(r, o);
            return `<div class="q"><div class="row" style="justify-content:space-between"><h4 style="color:${l.main ? "#ffd447" : "var(--text)"}">${l.main ? "\u25C6 " : ""}${ke(l.n)}</h4><span class="muted" style="font-size:12px">${ke(zt[l.giver]?.n || "")}</span></div><p>${ke(l.intro)}</p>${l.obj.map((d, h) => `<p style="color:${(o.prog[h] || 0) >= d.n ? "var(--good)" : "#cfd8dc"}">\u2022 ${ke(ht.objText(d, o.prog[h]))}</p>`).join("")}${c ? `<p style="color:var(--good)">Completada: vuelve con ${ke(zt[l.giver]?.n)}.</p>` : ""}<div class="row"><button class="btn" data-tr="${r}">${o.tracked ? "Dejar de seguir" : "Seguir"}</button>${l.main ? "" : `<button class="btn bad" data-ab="${r}">Abandonar</button>`}</div></div>`;
          })
          .join("")
      : '<p class="muted">No tienes misiones activas. Habla con los personajes marcados con \xAB!\xBB.</p>'),
      (i += `<p class="muted" style="font-size:13px">Encargos secundarios activos: ${ht.sideCount()}/4 \xB7 Misiones completadas: ${Object.keys(e.quests.done).length}</p>`));
  } else if (n === "lore") {
    No("pads");
    return;
  } else i = Tb();
  Ze.open(
    "quests",
    `<div class="win" style="width:min(820px,100%)">${Ze.head("Diario de operaciones", t)}<div class="wbody">${i}</div></div>`,
    { silent: x.uiOpen === "quests" },
  );
  let s = _t("#panel");
  (s.querySelectorAll("[data-t]").forEach((a) => a.addEventListener("click", () => Er(a.dataset.t))),
    s.querySelectorAll("[data-tr]").forEach((a) =>
      a.addEventListener("click", () => {
        let r = e.quests.active[a.dataset.tr];
        ((r.tracked = !r.tracked), ee("quests"), Er("act"));
      }),
    ),
    s.querySelectorAll("[data-ab]").forEach((a) =>
      a.addEventListener("click", () => {
        (ht.abandon(a.dataset.ab), Er("act"));
      }),
    ));
}


// ════════ [707] FunctionDeclaration Tb (2082 bytes) ════════
function Tb() {
  return `<div class="grid2"><div><div class="sec" style="margin-top:0">Controles</div><div class="stats">
  <span>Moverse</span><span class="v">WASD / flechas</span><span>Archivo (lore, bestiario)</span><span class="v">L</span><span>Disparar</span><span class="v">Autom\xE1tico (o rat\xF3n en Ajustes)</span><span>Esprint (invulnerable)</span><span class="v">Espacio</span><span>Interactuar</span><span class="v">E</span><span>Cambiar arma</span><span class="v">Q</span><span>Recargar</span><span class="v">R</span><span>Granada</span><span class="v">G</span><span>Botiqu\xEDn / Estimulante</span><span class="v">1 / 2</span><span>Linterna</span><span class="v">F</span><span>Inventario / Ficha</span><span class="v">I \xB7 Tab / C</span><span>Mapa</span><span class="v">M</span><span>Misiones</span><span class="v">J</span><span>Zoom</span><span class="v">Rueda del rat\xF3n</span><span>Pausa</span><span class="v">Esc</span></div></div>
  <div style="min-width:0"><div class="sec" style="margin-top:0">Consejos</div><div style="font-size:14px;line-height:1.55">
  <p>\u2022 Tu arma dispara sola al enemigo visible m\xE1s cercano. Conc\xE9ntrate en moverte y esquivar.</p>
  <p>\u2022 Cada regi\xF3n se abre al derrotar al jefe de la anterior y alcanzar el nivel indicado. Algunas regiones exigen resistencias (calor, fr\xEDo, t\xF3xico, radiaci\xF3n): revisa tu ficha.</p>
  <p>\u2022 Las terminales abren c\xE1maras secretas, contenedores y desaf\xEDos. Cada hackeo apila capas con una traza com\xFAn: si se llena, suena la alarma. Sube tu nivel de hackeo, compila programas y hackea tambi\xE9n torretas, drones y mec\xE1nicos (${Tt.touchMode ? "marcador HACKEAR" : "tecla V"}).</p>
  <p>\u2022 Los edificios y cuevas est\xE1n a oscuras: consigue la linterna. Las Sombras solo se ven con luz.</p>
  <p>\u2022 Las reliquias xeno, las c\xE1psulas y las rachas de bajas dan potenciadores temporales.</p>
  <p>\u2022 Las brechas y la mesa de operaciones de Basti\xF3n llevan a misiones procedurales siempre distintas.</p>
  <p>\u2022 Desguaza lo que no uses y mejora tu equipo en el banco de trabajo. La Dra. Lin investiga mejoras permanentes.</p>
  <p>\u2022 De noche hay m\xE1s enemigos y peligros, pero tambi\xE9n m\xE1s \xE9lites.</p></div></div></div>`;
}


// ════════ [708] FunctionDeclaration jl (3936 bytes) ════════
function jl(n = "main") {
  let e = x.S,
    t = e.settings,
    i = `<div class="tabs"><button class="tab ${n === "main" ? "on" : ""}" data-t="main">Pausa</button><button class="tab ${n === "set" ? "on" : ""}" data-t="set">Ajustes</button><button class="tab ${n === "data" ? "on" : ""}" data-t="data">Partida</button><button class="tab ${n === "help" ? "on" : ""}" data-t="help">Controles</button></div>`,
    s = "";
  (n === "main"
    ? (s = `<div class="mbtns" style="max-width:360px"><button class="btn pri" data-close>Continuar</button><button class="btn" id="pArch">Archivo (L)</button><button class="btn" id="pSave">Guardar ahora</button><button class="btn" id="pMenu">Salir al men\xFA principal</button></div><p class="muted" style="font-size:13px;margin-top:12px">La partida se guarda sola cada poco tiempo${nh() ? " y en tu cuenta" : " en este navegador"}.</p>`)
    : n === "set"
      ? (s = `<div class="stats" style="max-width:560px;gap:10px 16px;align-items:center">
    <span>Operador</span><select id="sChar"><option value="Astronaut_FinnTheFrog">Finn</option><option value="Astronaut_RaeTheRedPanda">Rae</option><option value="Astronaut_BarbaraTheBee">Barbara</option><option value="Astronaut_FernandoTheFlamingo">Fernando</option></select>
    <span>Calidad gr\xE1fica</span><select id="sQ"><option value="high">Alta (sombras, bloom)</option><option value="medium">Media</option><option value="low">Baja (m\xE1ximo rendimiento)</option></select>
    <span>Postproceso</span><select id="sPost"><option value="full">Completo (bloom y suavizado)</option><option value="nobloom">Sin bloom (m\xE1s ligero)</option><option value="safe">Seguro (sin postproceso)</option></select>
    <span>Apuntado</span><select id="sAim"><option value="auto">Autom\xE1tico</option><option value="mouse">Rat\xF3n (clic para disparar)</option></select>
    <span>Efectos de sonido</span><input type="range" id="sSfx" min="0" max="1" step="0.05">
    <span>M\xFAsica</span><input type="range" id="sMus" min="0" max="1" step="0.05">
    <span>Zoom de c\xE1mara</span><input type="range" id="sZoom" min="15" max="34" step="1">
    <span>N\xFAmeros de da\xF1o</span><select id="sDmg"><option value="1">S\xED</option><option value="0">No</option></select></div>`)
      : n === "data"
        ? (s =
            '<p style="max-width:65ch">Exporta tu partida como c\xF3digo para guardarla aparte o pasarla a otro dispositivo.</p><textarea id="pCode" readonly></textarea><div class="row" style="margin-top:6px"><button class="btn" id="pExp">Generar y copiar c\xF3digo</button></div><div class="sec">Importar</div><textarea id="pImp" placeholder="Pega aqu\xED un c\xF3digo de partida"></textarea><div class="row" style="margin-top:6px"><button class="btn bad" id="pImpB">Cargar c\xF3digo (sustituye la partida actual)</button></div>')
        : (s = Tb()),
    Ze.open(
      "pause",
      `<div class="win" style="width:min(820px,100%)">${Ze.head("Operaci\xF3n Eclipse", i)}<div class="wbody">${s}</div></div>`,
      { silent: x.uiOpen === "pause" },
    ),
    _t("#panel")
      .querySelectorAll("[data-t]")
      .forEach((o) => o.addEventListener("click", () => jl(o.dataset.t))));
  let r = (o) => _t(o);
  (n === "set" &&
    ((r("#sChar").value = e.char || "Astronaut_FinnTheFrog"),
    (r("#sChar").onchange = (o) => {
      ((e.char = o.target.value), (x.player._look = null), x.player.refreshLook());
    }),
    (r("#sQ").value = t.quality),
    (r("#sPost").value = t.post || (x.R.touch ? "nobloom" : "full")),
    (r("#sPost").onchange = (o) => {
      ((t.post = o.target.value), x.R.post.setMode(t.post));
    }),
    (r("#sAim").value = t.aim),
    (r("#sSfx").value = t.sfx),
    (r("#sMus").value = t.music),
    (r("#sZoom").value = t.zoom),
    (r("#sDmg").value = t.dmgNums === !1 ? "0" : "1"),
    (r("#sQ").onchange = (o) => {
      ((t.quality = o.target.value), x.R.setQuality(t.quality));
    }),
    (r("#sAim").onchange = (o) => (t.aim = o.target.value)),
    (r("#sSfx").oninput = (o) => {
      ((t.sfx = +o.target.value), ee("vol"));
    }),
    (r("#sMus").oninput = (o) => {
      ((t.music = +o.target.value), ee("vol"));
    }),
    (r("#sZoom").oninput = (o) => {
      ((t.zoom = +o.target.value), x.R.setZoom(t.zoom));
    }),
    (r("#sDmg").onchange = (o) => (t.dmgNums = o.target.value === "1"))),
    n === "main" &&
      ((r("#pArch").onclick = () => No("chron")),
      (r("#pSave").onclick = () => {
        (Ui(!0), ee("toast", "Partida guardada", "good"));
      }),
      (r("#pMenu").onclick = () => {
        (Ui(!0), Ze.close(), ee("toMenu"));
      })),
    n === "data" &&
      ((r("#pExp").onclick = () => {
        let o = $x();
        ((r("#pCode").value = o), r("#pCode").select());
        try {
          navigator.clipboard.writeText(o).then(
            () => ee("toast", "C\xF3digo copiado", "good"),
            () => {},
          );
        } catch {}
      }),
      (r("#pImpB").onclick = () => {
        let o = Xx(r("#pImp").value);
        if (!o) return ee("toast", "C\xF3digo no v\xE1lido", "bad");
        (ee("importSave", o), Ze.close());
      })));
}


// ════════ [709] FunctionDeclaration $p (651 bytes) ════════
function $p() {
  let n = x.S,
    e = Math.floor(n.credits * 0.1);
  (Ze.open(
    "death",
    `<div class="win" style="width:min(520px,100%);text-align:center"><div class="wbody" style="padding:28px"><div class="logo" style="font-size:40px;color:var(--bad)">Ca\xEDdo en combate</div><p class="muted">El equipo de recuperaci\xF3n te lleva de vuelta. Pierdes ${yt(e)} \xA4 en el traslado.</p><button class="btn pri" id="dRes">${x.mode === "op" ? (x.op && x.op.sub ? "Volver a la superficie" : "Volver a Basti\xF3n (operaci\xF3n fallida)") : "Reaparecer en la \xFAltima baliza"}</button></div></div>`,
    { modal: !0 },
  ),
    _t("#dRes").addEventListener("click", () => {
      ((n.credits -= e), Ze.close(), ee("respawn"));
    }));
}


// ════════ [710] FunctionDeclaration Ab (860 bytes) ════════
function Ab(n, e) {
  Ze.open(
    "opreward",
    `<div class="win" style="width:min(620px,100%)">${Ze.head("Operaci\xF3n completada")}<div class="wbody"><p><b>${Zi[n.theme].n}</b> \xB7 ${pr[n.obj].n} \xB7 Nivel ${n.lvl}</p><div class="stats"><span>Experiencia</span><span class="v">+${yt(e.xp)}</span><span>Cr\xE9ditos</span><span class="v">+${yt(e.credits)} \xA4</span><span>Datos cifrados</span><span class="v">+${e.data}</span><span>Tiempo</span><span class="v">${Xs(n.t)}</span></div><div class="sec">Bot\xEDn de la operaci\xF3n</div>${e.items.map((t) => ql(t)).join('<div style="height:6px"></div>')}${(e.chips || []).map((t) => '<div style="height:6px"></div>' + lh(t)).join("")}<p class="muted" style="font-size:13px">+1 n\xFAcleo \u25C9 para ascender piezas.</p><div class="row" style="margin-top:10px"><button class="btn pri" data-close>Continuar</button></div></div></div>`,
  );
}


// ════════ [711] FunctionDeclaration Rb (613 bytes) ════════
function Rb(n) {
  let e = n.reg >= 0 && De[n.reg] ? De[n.reg].n : "";
  (Ze.open(
    "lore",
    `<div class="win" style="width:min(620px,100%)">${Ze.head("Registro de datos")}<div class="wbody"><h3 class="disp" style="margin:0 0 2px">${ke(n.t)}</h3><div class="muted" style="font-size:13px;margin-bottom:10px">${ke(n.a)}${e ? " \xB7 " + ke(e) : ""}</div><div class="lore">${ke(n.txt)}</div><p class="muted" style="font-size:13px">Guardado en el Archivo (tecla L).</p><div class="row"><button class="btn" id="lArch">Abrir Archivo</button><button class="btn pri" data-close>Cerrar</button></div></div></div>`,
  ),
    (_t("#lArch").onclick = () => No("pads")));
}


// ════════ [712] FunctionDeclaration No (3284 bytes) ════════
function No(n = "chron") {
  let e = x.S;
  (e.best || (e.best = {}), e.visited || (e.visited = {}), e.met || (e.met = {}));
  let t = e.quests.done || {},
    i = Object.keys(gi).filter((p) => gi[p].main),
    s = [["_start", Nd._start], ...i.filter((p) => t[p] && Nd[p]).map((p) => [p, Nd[p]])],
    a = [...Object.keys(gn), ...Object.keys(En)],
    r = a.filter((p) => e.best[p]).length,
    o = De.filter((p, m) => e.visited[m]).length,
    l = Object.keys(Ll).filter((p) => e.met[p]).length,
    d = `<div class="tabs">${[
      ["chron", `Cr\xF3nica ${s.length}/${i.length + 1}`],
      ["pads", `Registros ${e.lore.length}/${na.length}`],
      ["best", `Bestiario ${r}/${a.length}`],
      ["reg", `Regiones ${o}/${De.length}`],
      ["npc", `Personajes ${l}/${Object.keys(Ll).length}`],
      ["hitos", `Hitos ${(e.hitos || []).length}`],
    ]
      .map(([p, m]) => `<button class="tab ${n === p ? "on" : ""}" data-t="${p}">${m}</button>`)
      .join("")}</div>`,
    h = "",
    f = (p, m, g, b) =>
      `<div class="arch"><h4 style="${b ? "color:" + b : ""}">${ke(p)}</h4>${m ? `<div class="muted" style="font-size:12px">${m}</div>` : ""}<p>${ke(g)}</p></div>`,
    u = (p, m) => `<div class="arch lockd"><h4>${ke(p)}</h4><p class="muted">${ke(m)}</p></div>`;
  if (n === "chron")
    ((h = s
      .map(([p, m], g) => f((g ? "Cap\xEDtulo " + g + " \xB7 " : "") + m.t, "", m.txt, g ? null : "#ffd447"))
      .join("")),
      s.length <= i.length &&
        (h += u("Cap\xEDtulo " + s.length, "Completa la siguiente misi\xF3n principal para continuar la cr\xF3nica.")));
  else if (n === "pads")
    h =
      '<p class="muted" style="margin-top:0">Los registros de datos (iconos de tarjeta en el suelo) est\xE1n repartidos por todas las regiones y operaciones.</p>' +
      De.map((m, g) => {
        let b = na.map((v, _) => ({ d: v, i: _ })).filter(({ d: v }) => v.reg === g),
          y = b.filter(({ i: v }) => e.lore.includes(v));
        return { R: m, all: b, got: y };
      })
        .map(
          ({ R: m, all: g, got: b }) =>
            `<div class="sec">${ke(m.n)} \xB7 ${b.length}/${g.length}</div>${b.length ? b.map(({ d: y }) => f(y.t, ke(y.a), y.txt)).join("") : '<p class="muted" style="font-size:13px">A\xFAn no has encontrado registros en esta regi\xF3n.</p>'}`,
        )
        .join("");
  else if (n === "best") {
    let p = Object.entries(vr),
      m = (g, b) => {
        let y = b ? En[g] : gn[g],
          v = e.best[g];
        return v
          ? `<div class="arch"><h4 style="color:${b ? "#ff9a1f" : "var(--text)"}">${ke(y.n)}</h4><div class="muted" style="font-size:12px">${b ? ke(y.title || "Jefe") : ke(vr[y.fam] || "")} \xB7 Abatidos: ${yt(v)}</div><p>${ke(px[g] || "")}</p></div>`
          : u(
              "???",
              b ? (y.secret ? "Jefe secreto sin descubrir." : "Jefe sin abatir.") : "Abate uno para registrarlo.",
            );
      };
    h =
      `<div class="sec" style="margin-top:0">Jefes</div><div class="cards">${Object.keys(En)
        .map((g) => m(g, !0))
        .join("")}</div>` +
      p
        .map(
          ([g, b]) =>
            `<div class="sec">${ke(b)}</div><div class="cards">${Object.keys(gn)
              .filter((y) => gn[y].fam === g)
              .map((y) => m(y, !1))
              .join("")}</div>`,
        )
        .join("");
  } else if (n === "hitos") h = ecoHitosHtml();
  else
    n === "reg"
      ? (h = De.map((p, m) =>
          e.visited[m]
            ? f(
                p.n,
                `${ke(p.sub)} \xB7 Nivel ${p.lvl[0]}\u2013${p.lvl[1]} \xB7 Jefe: ${e.world.bosses["reg" + m] ? ke(En[p.boss].n) : "???"}`,
                mx[m] || "",
              )
            : u("Regi\xF3n desconocida", "Explora para descubrirla."),
        ).join(""))
      : (h = `<div class="cards">${Object.entries(Ll)
          .map(([p, m]) =>
            e.met[p]
              ? `<div class="arch"><h4>${ke(zt[p]?.n || p)}</h4><div class="muted" style="font-size:12px">${ke(zt[p]?.role || "")}</div><p>${ke(m)}</p></div>`
              : u("Desconocido", "Habla con esta persona para conocerla."),
          )
          .join("")}</div>`);
  (Ze.open(
    "archive",
    `<div class="win" style="width:min(900px,100%)">${Ze.head("Archivo", d)}<div class="wbody">${h}</div></div>`,
    { silent: x.uiOpen === "archive" },
  ),
    _t("#panel")
      .querySelectorAll("[data-t]")
      .forEach((p) => p.addEventListener("click", () => No(p.dataset.t))));
}


// ════════ [713] FunctionDeclaration Cb (550 bytes) ════════
function Cb() {
  Ze.open(
    "victory",
    '<div class="win" style="width:min(640px,100%);text-align:center"><div class="wbody" style="padding:30px"><div class="logo"><span>Operaci\xF3n</span>Eclipse<br>completada</div><p class="tagline" style="margin:14px auto">La Mente Colmena ha ca\xEDdo. El Enjambre se desmorona por todo el continente. Basti\xF3n celebra, pero a\xFAn quedan nidos y brechas activas: las operaciones especiales siguen abiertas con niveles de amenaza superiores.</p><button class="btn pri" data-close>Seguir luchando</button></div></div>',
  );
}


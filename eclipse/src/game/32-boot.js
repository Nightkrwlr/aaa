// 32-boot.js — Arranque, bucle principal y ganchos de depuración window.__*

// ════════ [731] FunctionDeclaration Ib (863 bytes) ════════
function Ib(n) {
  if (n.groundArray) return;
  let e = performance.now(),
    t = Object.keys(Pb),
    i = new Uint8Array(Be * Be * 4 * t.length);
  n.layer = n.layer || {};
  let s = {};
  t.forEach((r, o) => {
    let l = performance.now(),
      c = dS(Lb[Pb[r]]);
    s[r] = Math.round(performance.now() - l);
    let d = r.startsWith("ground_") || r.startsWith("road_") ? 2.1 : 1.7,
      h = 0;
    for (let u = 0; u < c.length; u++) h += c[u];
    h /= c.length;
    for (let u = 0; u < c.length; u++) c[u] = 0.85 + (c[u] - h) * d;
    let f = o * Be * Be * 4;
    for (let u = 0, p = 0; u < Be * Be; u++, p += 3) {
      let m = f + u * 4;
      ((i[m] = hh[(Xp(c[p]) * 4095) | 0]),
        (i[m + 1] = hh[(Xp(c[p + 1]) * 4095) | 0]),
        (i[m + 2] = hh[(Xp(c[p + 2]) * 4095) | 0]),
        (i[m + 3] = 255));
    }
    n.layer[r] = o;
  });
  let a = new ba(i, Be, Be, t.length);
  ((a.format = Qn),
    (a.colorSpace = Pt),
    (a.wrapS = a.wrapT = ei),
    (a.magFilter = Qt),
    (a.minFilter = ji),
    (a.generateMipmaps = !0),
    (a.anisotropy = 4),
    (a.needsUpdate = !0),
    (n.groundArray = a),
    (n.procTex = !0),
    console.info("texturas procedurales", t.length, Math.round(performance.now() - e) + " ms", JSON.stringify(s)));
}


// ════════ [732] VariableDeclaration Tr,Db,Yp,Fo,Kp (74 bytes) ════════
var Tr = (n) => document.querySelector(n),
  Db = performance.now(),
  Yp = 30,
  Fo = !0,
  Kp = 0;


// ════════ [733] FunctionDeclaration uS (559 bytes) ════════
async function uS() {
  let n = Tr("#gl");
  ((x.R = new vd(n)), Wg(x.R.camera.quaternion), await Et.load(), Ib(Et));
  let e = Tr("#loading");
  await Ln.load((i) => {
    e && (e.textContent = `CARGANDO MODELOS ${Math.round(i * 100)}%`);
  });
  let t = Et.image("key_art");
  (t && document.documentElement.style.setProperty("--keyart", `url("${t}")`),
    (x.fx = new Rd(x.R.scene, x.R)),
    Tt.init(n),
    sb(),
    (x.S = kp("Espectro", "soldado")),
    (x.player = new Pl()),
    (x.player.rig.root.visible = !1),
    (x.world = new ih()),
    x.player.recalc(),
    x.world.loadWorld({ x: Si, z: Si + 5.5 }),
    x.R.setZoom(26),
    Tr("#loading").remove(),
    pS(),
    requestAnimationFrame(Ub),
    Ob());
}


// ════════ [734] FunctionDeclaration Ob (357 bytes) ════════
async function Ob() {
  ((Fo = !0), (x.started = !1), (x.uiOpen = "menu"), (Tr("#hud").hidden = !0), (Tr("#touch").hidden = !0));
  let n = jx(),
    e = (i, s) => kb({ save: i, cloud: s, onContinue: () => Qp(i), onNew: (a, r, o) => Qp(null, a, r, o) }),
    t = null;
  try {
    t = await Promise.race([zp(), new Promise((i) => setTimeout(() => i(null), 1500))]);
  } catch {
    t = null;
  }
  (e(t, nh()),
    qx().then(async (i) => {
      if (i && Fo) {
        let s = await zp();
        e(s, !0);
      }
    }));
}


// ════════ [735] FunctionDeclaration Qp (1390 bytes) ════════
function Qp(n, e, t, i) {
  zb();
  let s = n || kp(e, t);
  if (!n) {
    ((s.eq.w1 = Ca(1, 0, "pistol")), (s.eq.suit = Js(1, 0, "s_bdu")), (s.eq.helmet = Js(1, 0, "h_tac")));
    for (let r of [s.eq.w1, s.eq.suit, s.eq.helmet]) r.isNew = !1;
    ((s.pos = { x: Si, z: Si - 3 }), (s.char = i || "Astronaut_FinnTheFrog"));
  }
  (fS(s),
    !n && ("ontouchstart" in window || matchMedia("(pointer: coarse)").matches) && (s.settings.quality = "medium"),
    (x.S = s),
    x.R.setQuality(s.settings.quality),
    x.R.post.setMode(s.settings.post || (x.R.touch ? "nobloom" : "full")),
    x.R.setZoom(s.settings.zoom),
    ae.setVol("sfx", s.settings.sfx),
    ae.setVol("music", s.settings.music),
    x.player && x.R.scene.remove(x.player.rig.root),
    (x.player = new Pl()),
    x.player.recalc(),
    (x.player.hp = x.player.maxHp),
    (x.player.shield = x.player.maxShield),
    (x.player.ammo = [x.player.ws[0]?.mag || 0, x.player.ws[1]?.mag || 0]),
    x.world.loadWorld(s.pos),
    rb(),
    xn.reset(),
    (Fo = !1),
    (x.started = !0),
    (x.uiOpen = null),
    (x.paused = !1));
  let a = "ontouchstart" in window || matchMedia("(pointer: coarse)").matches;
  ((Tr("#hud").hidden = !1),
    (Tr("#touch").hidden = !a),
    document.body.classList.toggle("touch", a),
    a && (Tt.touchMode = !0),
    x.R.resize());
  try {
    x.R.r.compile(x.R.scene, x.R.camera);
  } catch {}
  (ae.init(),
    n
      ? oa(De[x.regionId].n, `Bienvenido de nuevo, ${s.name}`, "#ffb340")
      : (oa("Basti\xF3n", "Habla con el Comandante Reyes", "#ffb340"),
        setTimeout(() => la(`Pulsa ${Tt.touchMode ? "USAR" : "E"} junto a los personajes marcados con \xAB!\xBB para hablar.`, "quest"), 2500),
        setTimeout(() => la(Tt.touchMode ? "Tu arma dispara sola. Mu\xE9vete arrastrando el dedo y esquiva con ESPRINT." : "Tu arma dispara sola. Mu\xE9vete con WASD y esquiva con Espacio.", ""), 6500)),
    Ui(!0));
}


// ════════ [736] FunctionDeclaration fS (1015 bytes) ════════
function fS(n) {
  var e, t, i;
  (n.settings || (n.settings = {}), n.world || (n.world = {}));
  for (let s of [
    "term",
    "chests",
    "dp",
    "beacons",
    "gates",
    "bosses",
    "nests",
    "shrines",
    "crystals",
    "crates",
    "lock",
    "secrets",
    "subs",
  ])
    (e = n.world)[s] || (e[s] = {});
  if (
    ((n.world.beacons.beacon_0 = 1),
    n.quests || (n.quests = { active: {}, done: {}, rep: {} }),
    (t = n.quests).rep || (t.rep = {}),
    n.mapV !== 3)
  ) {
    ((n.mapV = 3), (n.pos = null), (n.fog = null));
    for (let s of ["term", "chests", "dp", "nests", "shrines", "crystals", "crates", "lock", "secrets"])
      n.world[s] = {};
  }
  if (!n.gatherV2) {
    n.gatherV2 = 1;
    for (let [s, a] of Object.entries(n.quests?.active || {}))
      (a.def || gi[s])?.obj.forEach((o, l) => {
        o.t === "gather" && (a.prog[l] = 0);
      });
  }
  if (((i = n.mats).battery ?? (i.battery = 0), n.chips || (n.chips = []), !n.arsenalV)) {
    let s = pp(n);
    s &&
      s.conv &&
      setTimeout(
        () =>
          la(`Nuevo sistema de arsenal: ${s.conv} objetos repetidos convertidos en materiales y m\xF3dulos`, "quest"),
        4e3,
      );
  }
  (n.lore || (n.lore = []),
    n.best || (n.best = {}),
    n.visited || (n.visited = {}),
    n.met || (n.met = {}),
    n.stats || (n.stats = { kills: 0, deaths: 0, bosses: 0, ops: 0, elites: 0, terminals: 0, dist: 0 }));
  for (const m of x.migrations)
    try {
      m(n);
    } catch (err) {
      console.error('[migraci\xF3n]', err);
    }
}


// ════════ [737] FunctionDeclaration pS (2524 bytes) ════════
function pS() {
  (It("talk", (n) => Sr(n)),
    It("hack", (n, e) => jp(n, e)),
    It("openMap", (n) => dh(n)),
    It("openDeploy", (n) => Wl(n)),
    It("lore", (n) => Rb(n)),
    It("archive", (n) => ee("toast", `Nueva entrada en el Archivo \xB7 ${n} (L)`, "quest")),
    It("opReward", (n, e) => setTimeout(() => Ab(n, e), 300)),
    It("save", (n) => Ui(!!n)),
    It("openLevelUp", () => {
      x.uiOpen || Wa();
    }),
    It("vol", () => {
      (ae.setVol("sfx", x.S.settings.sfx), ae.setVol("music", x.S.settings.music));
    }),
    It("levelUp", (n) => {
      (oa(`Nivel ${n}`, "Ascenso conseguido", "#5dff9a"),
        x.fx.ring(x.player.x, x.player.z, 4, 6160282, 0.8),
        x.fx.burst(x.player.x, 1, x.player.z, 40, { color: 6160282, speed: 5, life: 0.8, size: 0.3, up: 1 }));
      // Sin modal: el aviso de «punto de talento» lo emite 31b-talents.js y el botón #hPerk abre el árbol.
      x.world.checkGatesUnlock();
    }),
    It("kill", (n) => {
      (ht.onKill(n), x.op && n.opPack && x.op.kills++);
    }),
    It("questItem", (n) => ht.onQuestItem(n)),
    It("questDone", (n, e) => {
      la(`Misi\xF3n completada: ${n.n} \xB7 +${e.xp} XP${e.credits ? " \xB7 +" + e.credits + " \xA4" : ""}`, "quest");
      for (let t of e.items) ee("loot", t);
      (n.rew?.flag === "flashlight" &&
        (oa("Linterna t\xE1ctica", `Pulsa ${Tt.touchMode ? "LUZ" : "F"} para encenderla`, "#ffd27a"), (x.player.flashOn = !0)),
        n.rew?.flag === "research" && la("Laboratorio de la Dra. Lin disponible", "good"),
        n.main && x.world.checkGatesUnlock(),
        Ui(!0));
    }),
    It("bossKilled", (n) => {
      (oa(n.name || n.def.n, n.mini ? "Minijefe abatido" : "Jefe derrotado", "#5fd35a"),
        n.id === "mente" && !x.S.flags.victory && ((x.S.flags.victory = 1), setTimeout(Cb, 3500)),
        Ui(!0));
    }),
    It("playerDied", () => {
      (x.S.stats.deaths++, oa("Ca\xEDdo", "", "#ff4f5e"), setTimeout($p, 1600));
    }),
    It("respawn", () => {
      let n = x.player,
        e = x.S;
      if (
        ((n.dead = !1),
        (n.rig.root.rotation.z = 0),
        (n.rig.root.position.y = 0),
        (n.hp = n.maxHp),
        (n.shield = n.maxShield),
        (n.buffs = {}),
        (n.inv = 3),
        (n.burnT = n.poisonT = 0),
        (n.vx = n.vz = 0),
        (n.dashT = 0),
        (n.slowT = 0),
        (n.healT = 0),
        (n.combo = 0),
        (n.target = null),
        (n.hurtFlash = 0),
        n.rig.model && n.rig.model.revive(),
        n.rig.actor && n.rig.actor.reset && n.rig.actor.reset(),
        xn.clearEvent(),
        x.mode === "op")
      )
        x.world.loadWorld(x.world.returnPos);
      else {
        let t = x.map,
          i = null,
          s = 1e9;
        for (let a of t.ents)
          if (a.k === "beacon" && e.world.beacons[a.id]) {
            let r = Le(a.x, a.z, n.x, n.z);
            r < s && ((s = r), (i = a));
          }
        x.world.loadWorld(i ? { x: i.x, z: i.z + 2 } : null);
      }
      Ui(!0);
    }),
    It("toMenu", () => {
      (xn.clearEvent(), x.world.loadWorld({ x: Si, z: Si + 5.5 }), (x.player.rig.root.visible = !1), Ob());
    }),
    It("importSave", (n) => {
      (Qp(n), la("Partida importada", "good"));
    }),
    addEventListener("beforeunload", () => {
      x.started && Ui(!1);
    }),
    document.addEventListener("visibilitychange", () => {
      document.hidden && x.started && (Ui(!0), x.uiOpen || jl());
    }));
}


// ════════ [738] FunctionDeclaration Nb (633 bytes) ════════
function Nb() {
  if (!x.started) return;
  let n = x.uiOpen,
    e = (t, i) => {
      n === t ? Ze.close() : (!n || ["inv", "map", "quests", "pause", "archive"].includes(n)) && i();
    };
  (Tt.hit("pause") && (n && n !== "levelup" && n !== "death" && n !== "hack" ? Ze.close() : n || jl()),
    !x.player.dead &&
      (Tt.hit("inv") && e("inv", () => Ai("inv")),
      Tt.hit("char") && e("inv", () => Ai("char")),
      Tt.hit("map") && e("map", () => dh(!1)),
      Tt.hit("quests") && e("quests", () => Er("act")),
      Tt.hit("archive") && e("archive", () => No("chron")),
      Tt.hit("help") && e("quests", () => Er("help")),
      !n && Tt.hit("interact") && x.world.interact(),
      Tt.wheel &&
        !n &&
        ((x.S.settings.zoom = qe(x.S.settings.zoom + Tt.wheel, 15, 34)), x.R.setZoom(x.S.settings.zoom))));
}


// ════════ [739] VariableDeclaration Jp,Zp (14 bytes) ════════
var Jp = 0,
  Zp = 0;


// ════════ [740] FunctionDeclaration mS (734 bytes) ════════
function mS() {
  let n = x.R,
    e = x.player,
    t = x.S,
    i = x.dt || 0.016,
    s = Math.sin(e.face),
    a = Math.cos(e.face);
  Jp += ((x.inDark ? 1 : 0) - Jp) * (1 - Math.exp(-i * 4));
  let r = x.map ? Math.max(x.map.darkAt(e.x + s * 3, e.z + a * 3), x.map.darkAt(e.x + s * 6, e.z + a * 6)) : 0;
  Zp += (r - Zp) * (1 - Math.exp(-i * 4));
  let o = Math.max(Jp, Zp * 0.8, n.env.night * 0.85),
    l = !!t.flags.flashlight && e.flashOn && x.started && !e.dead;
  (n.flash.position.set(e.x + s * 0.3, 2, e.z + a * 0.3),
    n.flash.target.position.set(e.x + s * 8, 0, e.z + a * 8),
    (n.flash.distance = e.lightRange),
    (n.flash.intensity = l ? 10 + o * 50 : 0),
    (n.flash.shadow.autoUpdate = l && n.flash.castShadow),
    l || (n.flash.shadow.needsUpdate = !1),
    (n.flash.decay = 0.7),
    (n.flash.angle = 0.62),
    (n.flash.penumbra = 0.45),
    n.pLight.position.set(e.x, 2.2, e.z),
    (n.pLight.intensity = x.started ? (l ? 2.5 : 6) * o : 0),
    (n.pLight.distance = l ? 7 : 9));
}


// ════════ [741] FunctionDeclaration Ub (722 bytes) ════════
function Ub(n) {
  requestAnimationFrame(Ub);
  let e = (n - Db) / 1e3;
  if (((Db = n), e > 0.05 && (e = 0.05), e <= 0)) return;
  ((x.dt = e), (zo.uTime.value = (zo.uTime.value + e) % 3600));
  let t = x.R,
    i = x.player;
  if ((x.fx.beginFrame(), Fo)) {
    ((Kp += e * 0.05), (x.time += e));
    let s = Si + Math.cos(Kp) * 14,
      a = Si + Math.sin(Kp) * 14;
    (x.world.update(e), t.update(e, s, a, 0, 0.15));
  } else {
    (Nb(),
      x.paused
        ? x.fx.update(0)
        : ((x.time += e),
          (x.S.playTime += e),
          i.update(e),
          yp(e),
          Qf(e),
          gp(e),
          x.world.update(e),
          xn.update(e),
          x.tick.length && x.tick.forEach((f) => f(e)),
          x.fx.update(e),
          (Yp -= e),
          Yp <= 0 && ((Yp = 30), Ui(!1)),
          bo.update(e, x.combatHeat, !!x.bossActive)),
      mS());
    let s = x.mode === "op" && x.op && x.op.mods.includes("dark");
    t.update(
      x.paused ? 1e-4 : e,
      i.x + Math.sin(i.face) * 0.8,
      i.z + Math.cos(i.face) * 0.8,
      x.inDark ? (s ? 1 : 0.2) : 0,
      x.night,
    );
  }
  (Fo && x.fx.update(e), t.adapt(e), t.render(), Fo || ab(e), Tt.endFrame());
}


// ════════ [742] ExpressionStatement ExpressionStatement (13 bytes) ════════
window.__G = x;


// ════════ [743] ExpressionStatement ExpressionStatement (15 bytes) ════════
window.__M3 = Ln;


// ════════ [744] ExpressionStatement ExpressionStatement (38 bytes) ════════
window.__m3x = { avgColor: Zf, shiftTo: To };


// ════════ [745] ExpressionStatement ExpressionStatement (16 bytes) ════════
window.__ars = mp;


// ════════ [746] ExpressionStatement ExpressionStatement (18 bytes) ════════
window.__items = xf;


// ════════ [747] ExpressionStatement ExpressionStatement (16 bytes) ════════
window.__Enc = Ni;


// ════════ [748] ExpressionStatement ExpressionStatement (18 bytes) ════════
window.__Input = Tt;


// ════════ [749] ExpressionStatement ExpressionStatement (20 bytes) ════════
window.__Spawner = xn;


// ════════ [750] ExpressionStatement ExpressionStatement (46 bytes) ════════
window.__spawn = (n, e, t, i, s) => In(n, e, t, i, s || {});
// prueba: reinicia el RNG del juego (simulaciones deterministas)
window.__seedRng = (n) => {
  Lt = pi(n >>> 0);
};
// prueba: silencia los efectos de sonido (su temporizador usa el reloj de audio real y consume Math.random de forma no determinista)
window.__silence = (on) => {
  if (on) ae.__play = ae.__play || ae.play;
  ae.play = on ? () => {} : ae.__play || ae.play;
};


// ════════ [751] ExpressionStatement ExpressionStatement (215 bytes) ════════
window.__step = (n, e = 1 / 30) => {
  let t = x.player;
  for (let i = 0; i < n && (x.fx.beginFrame(), Nb(), !x.paused); i++)
    ((x.time += e),
      (x.S.playTime += e),
      t.update(e),
      yp(e),
      Qf(e),
      gp(e),
      x.world.update(e),
      xn.update(e),
      x.tick.length && x.tick.forEach((f) => f(e)),
      x.fx.update(e),
      Tt.endFrame());
};


// ════════ [752] ExpressionStatement ExpressionStatement (156 bytes) ════════
window.__fps = () =>
  new Promise((n) => {
    let e = 0,
      t = performance.now(),
      i = () => {
        (e++, performance.now() - t < 2e3 ? requestAnimationFrame(i) : n(e / 2));
      };
    requestAnimationFrame(i);
  });


// ════════ [753] ExpressionStatement ExpressionStatement (226 bytes) ════════
window.__dbg = {
  Quests: ht,
  UI: Ze,
  openDialog: Sr,
  openInventory: Ai,
  openMap: dh,
  openWorkbench: fs,
  openResearch: ch,
  openBoard: Vl,
  openService: Wp,
  openLevelUp: Wa,
  openDeploy: Wl,
  openHack: jp,
  openPause: jl,
  openQuests: Er,
  openDeath: $p,
  Spawner: xn,
};


// ════════ ganchos añadidos por el proyecto (no estaban en el original) ════════
window.__De = De;
window.__regionCenter = (key) => {
  const r = De.find((q) => q.key === key);
  return r ? { x: (r.gx + 0.5) * qt, z: (r.gz + 0.5) * qt, id: r.id } : null;
};

// ════════ [754] ExpressionStatement ExpressionStatement (5 bytes) ════════
uS();


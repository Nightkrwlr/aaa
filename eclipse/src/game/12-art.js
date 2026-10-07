// 12-art.js — Cargador de arte (sprites, texturas, iconos) y clase Pa

// ════════ [379] VariableDeclaration zw,Vg,Et,Pw,qg,Lw,Pd (1787 bytes) ════════
var zw = new Sa(),
  Vg = new Map(),
  Et = {
    m: { sprites: {}, textures: {}, icons: {}, images: {} },
    ready: !1,
    async load() {
      try {
        let n = document.getElementById("artmanifest");
        if (n && n.textContent.trim().length > 2)
          this.m = { sprites: {}, textures: {}, icons: {}, images: {}, ...JSON.parse(n.textContent) };
        else {
          let e = await fetch("art/manifest.json", { cache: "no-cache" });
          if (e.ok) {
            let t = await e.json();
            this.m = { sprites: {}, textures: {}, icons: {}, images: {}, ...t };
          }
        }
      } catch {}
      ((this.prefixes = new Set(Object.keys(this.m.sprites).map((n) => n.split("_")[0]))),
        await this.loadGroundArray(),
        (this.ready = !0));
    },
    sprite(n) {
      return this.m.sprites[n];
    },
    has(n) {
      return !!this.m.sprites[n];
    },
    hasActor(n) {
      let e = this.m.sprites;
      return !!(e[n + "_idle_SE"] || e[n + "_walk_SE"] || e[n + "_idle_S"] || e[n + "_walk_S"]);
    },
    icon(n) {
      let e = this.m.icons[n];
      return e ? e.f : null;
    },
    image(n) {
      let e = this.m.images[n];
      return e ? e.f : null;
    },
    tex(n) {
      let e = Vg.get(n);
      return (e || ((e = zw.load(n)), (e.colorSpace = Pt), (e.anisotropy = 4), Vg.set(n, e)), e);
    },
    async loadGroundArray() {
      let n = Object.keys(this.m.textures);
      if (((this.layer = {}), !n.length)) return;
      let e = 256,
        t = new Uint8Array(e * e * 4 * n.length),
        i = document.createElement("canvas");
      i.width = i.height = e;
      let s = i.getContext("2d", { willReadFrequently: !0 }),
        a = 0;
      for (let o of n)
        try {
          let l = await new Promise((c, d) => {
            let h = new Image();
            ((h.onload = () => c(h)), (h.onerror = d), (h.src = this.m.textures[o].f));
          });
          (s.clearRect(0, 0, e, e),
            s.drawImage(l, 0, 0, e, e),
            t.set(s.getImageData(0, 0, e, e).data, a * e * e * 4),
            (this.layer[o] = a++));
        } catch {}
      if (!a) return;
      let r = new ba(t.subarray(0, a * e * e * 4), e, e, a);
      ((r.format = Qn),
        (r.colorSpace = Pt),
        (r.wrapS = r.wrapT = ei),
        (r.magFilter = Qt),
        (r.minFilter = ji),
        (r.generateMipmaps = !0),
        (r.needsUpdate = !0),
        (this.groundArray = r));
    },
    layerOf(n) {
      return this.layer && n in this.layer ? this.layer[n] : -1;
    },
  },
  Pw = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"],
  qg = { NW: "NE", W: "E", SW: "SE" },
  Lw = { idle: 5, walk: 11, shoot: 14, attack: 10, dash: 16, death: 9 },
  Pd = new Pi(1, 1);


// ════════ [380] ExpressionStatement ExpressionStatement (21 bytes) ════════
Pd.translate(0, 0.5, 0);


// ════════ [381] VariableDeclaration kl (12 bytes) ════════
var kl = null;


// ════════ [382] FunctionDeclaration Wg (20 bytes) ════════
function Wg(n) {
  kl = n;
}


// ════════ [383] VariableDeclaration Pa (1349 bytes) ════════
var Pa = class {
  constructor(e, t) {
    ((this.prefix = e),
      (this.h = t),
      (this.root = new Ve()),
      (this.mat = new Xt({ alphaTest: 0.45, roughness: 0.85, metalness: 0, side: pn, emissive: 0 })),
      (this.mesh = new Ge(Pd, this.mat)),
      (this.mesh.castShadow = !1),
      this.root.add(this.mesh),
      (this.anim = "idle"),
      (this.t = 0),
      (this.cur = null),
      (this.lock = 0));
  }
  pick(e, t) {
    let i = Et.m.sprites,
      s = this.prefix,
      a = !!qg[t],
      r = qg[t] || t,
      o = [
        r,
        ...(r === "S" ? ["SE"] : r === "N" ? ["NE"] : r === "E" ? ["SE", "NE"] : []),
        r.includes("N") ? "NE" : "SE",
        "SE",
        "S",
        "NE",
        "E",
        "N",
      ];
    for (let l of [e, e === "shoot" || e === "attack" ? "idle" : "walk", "walk", "idle"])
      for (let c of o) {
        let d = `${s}_${l}_${c}`;
        if (i[d]) return { k: d, sp: i[d], flip: a };
      }
    return null;
  }
  update(e, t, i, s = 1) {
    (i !== this.anim && ((this.anim = i), (this.t = 0)), (this.t += e * s));
    let a = Math.round((t - Math.PI / 4) / (Math.PI / 4));
    a = ((a % 8) + 8) % 8;
    let r = this.pick(i, Pw[a]);
    if (!r) return;
    if (this.cur !== r.k) {
      this.cur = r.k;
      let f = Et.tex(r.sp.f).clone();
      ((f.needsUpdate = !0),
        f.repeat.set(1 / r.sp.n, 1),
        (this.mat.map = f),
        (this.mat.needsUpdate = !0),
        (this.aspect = r.sp.w / r.sp.h));
    }
    let o = r.sp,
      l = Lw[i] || 8,
      c = Math.floor(this.t * l);
    c = i === "death" ? Math.min(o.n - 1, c) : c % o.n;
    let d = this.mat.map;
    r.flip ? ((d.repeat.x = -1 / o.n), (d.offset.x = (c + 1) / o.n)) : ((d.repeat.x = 1 / o.n), (d.offset.x = c / o.n));
    let h = this.h * (o.hs || 1);
    (this.mesh.scale.set(h * this.aspect, h, 1),
      kl && this.mesh.quaternion.copy(this.root.quaternion).invert().multiply(kl));
  }
  flash(e, t = 16777215) {
    (this.mat.emissive.setHex(e ? t : 0), (this.mat.emissiveIntensity = e ? 0.9 : 0));
  }
};


// ════════ [384] FunctionDeclaration yf (317 bytes) ════════
function yf(n, e) {
  let t = Et.sprite(n);
  if (!t) return null;
  let i = new Xt({ map: Et.tex(t.f), alphaTest: 0.45, roughness: 0.85, side: pn });
  t.n > 1 && ((i.map = i.map.clone()), i.map.repeat.set(1 / t.n, 1), (i.map.needsUpdate = !0));
  let s = new Ge(Pd, i),
    a = e * (t.hs || 1);
  return (s.scale.set((a * t.w) / t.h, a, 1), kl && s.quaternion.copy(kl), (s.userData.billboard = !0), s);
}


// ════════ [385] VariableDeclaration zd (12 bytes) ════════
var zd = null;


// ════════ [386] FunctionDeclaration jg (133 bytes) ════════
function jg() {
  if (zd) return zd;
  let n = new $i();
  return (n.position.set(ws.x * 70, ws.y * 70, ws.z * 70), n.lookAt(0, 0, 0), (zd = n.quaternion.clone()), zd);
}


// ════════ [387] VariableDeclaration $g,Xg,Iw (967 bytes) ════════
var $g = Pd,
  Xg = {
    pine: 3.2,
    pine_snow: 3.2,
    oak: 3,
    bush: 0.9,
    rock: 0.8,
    rock_big: 1.5,
    log: 0.6,
    stump: 0.6,
    dead_tree: 2.6,
    car: 1.2,
    rubble: 1,
    lamp: 2.8,
    barrel: 0.9,
    crate: 0.9,
    crates: 1.4,
    tire: 0.4,
    hydrant: 0.7,
    cactus: 1.8,
    rock_desert: 1.2,
    bones: 0.6,
    skull: 1.3,
    mesa: 2.2,
    swamp_tree: 2.8,
    mushroom: 1.8,
    reeds: 1,
    barrel_toxic: 0.9,
    ice_spike: 1.6,
    boulder_snow: 1.1,
    crystal_ice: 1.3,
    container: 1.5,
    pipe: 1,
    generator: 1,
    antenna: 3.5,
    obsidian: 2.4,
    rock_lava: 0.9,
    vent: 0.8,
    crystal_fire: 1.3,
    barrel_rad: 0.9,
    tank_wreck: 1.6,
    tower: 4.5,
    tendril: 2.2,
    pod: 1.2,
    xeno_spire: 3,
    crystal: 1.4,
    egg: 1,
    pillar: 3.2,
    obelisk: 3.4,
    tent: 1.6,
    sandbags: 0.9,
    locker: 1.5,
    table: 0.9,
    jar: 0.8,
    bed: 0.6,
    computer: 1.2,
    tank_lab: 1.9,
    radar: 2,
    rubble_s: 0.6,
    pod_s: 1.2,
    grass: 0.35,
    dry_grass: 0.35,
    flower: 0.35,
    pebble: 0.2,
    debris: 0.25,
    paper: 0.1,
    reed_small: 0.5,
    shroom_small: 0.3,
    snow_tuft: 0.25,
    bolt: 0.1,
    ember_rock: 0.25,
    vein: 0.15,
  },
  Iw = {
    crates: "crate",
    rubble_s: "rubble",
    pod_s: "pod",
    grass: "grass_tuft",
    dry_grass: "grass_tuft",
    flower: "flowers",
    pebble: "pebbles",
    reed_small: "reeds",
    paper: "debris",
    bolt: "debris",
  };


// ════════ [388] FunctionDeclaration Yg (108 bytes) ════════
function Yg(n) {
  let e = Iw[n] || n,
    t = [];
  for (let i of [e, e + "_a", e + "_b", e + "_c"]) Et.m.sprites[i] && t.push(i);
  return t;
}


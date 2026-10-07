// 13-gltf.js — Carga de modelos GLB, teñido por tipo, tablas de modelos del mundo

// ════════ [410] VariableDeclaration Kf (14 bytes) ════════
var Kf = new Id();


// ════════ [411] ExpressionStatement ExpressionStatement (25 bytes) ════════
Kf.setMeshoptDecoder(nx);


// ════════ [412] ExpressionStatement ExpressionStatement (82 bytes) ════════
Kf.register((n) => ((n.textureLoader = new Sa(n.options.manager)), { name: "img_data_uri" }));


// ════════ [413] FunctionDeclaration jw (128 bytes) ════════
function jw(n) {
  let e = "";
  for (let t = 0; t < n.length; t += 32768) e += String.fromCharCode.apply(null, n.subarray(t, t + 32768));
  return btoa(e);
}


// ════════ [414] FunctionDeclaration $w (966 bytes) ════════
function $w(n) {
  let e = new DataView(n.buffer, n.byteOffset, n.byteLength);
  if (e.getUint32(0, !0) !== 1179937895) return n;
  let t = e.getUint32(12, !0),
    i = JSON.parse(new TextDecoder().decode(n.subarray(20, 20 + t)));
  if (!i.images || !i.images.some((f) => f.bufferView != null)) return n;
  let s = 20 + t + 8,
    a = e.getUint32(20 + t, !0),
    r = n.subarray(s, s + a);
  for (let f of i.images)
    if (f.bufferView != null) {
      let u = i.bufferViews[f.bufferView],
        p = u.byteOffset || 0;
      ((f.uri = "data:" + (f.mimeType || "image/png") + ";base64," + jw(r.subarray(p, p + u.byteLength))),
        delete f.bufferView,
        delete f.mimeType);
    }
  let o = new TextEncoder().encode(JSON.stringify(i)),
    l = (4 - (o.length % 4)) % 4,
    c = new Uint8Array(o.length + l);
  (c.set(o), c.fill(32, o.length));
  let d = new Uint8Array(20 + c.length + 8 + a),
    h = new DataView(d.buffer);
  return (
    h.setUint32(0, 1179937895, !0),
    h.setUint32(4, 2, !0),
    h.setUint32(8, d.length, !0),
    h.setUint32(12, c.length, !0),
    h.setUint32(16, 1313821514, !0),
    d.set(c, 20),
    h.setUint32(20 + c.length, a, !0),
    h.setUint32(24 + c.length, 5130562, !0),
    d.set(r, 28 + c.length),
    d
  );
}


// ════════ [415] VariableDeclaration ta,LT,Ln,Xw,Yw,Da (5215 bytes) ════════
var ta = new _i(),
  LT = new U(),
  Ln = {
    g: {},
    ready: !1,
    async load(n) {
      let e = document.getElementById("models3d");
      if (!e) {
        this.ready = !0;
        return;
      }
      let t;
      try {
        t = JSON.parse(e.textContent);
      } catch {
        this.ready = !0;
        return;
      }
      let i = Object.keys(t),
        s = 0;
      for (let a of i) {
        try {
          let r = atob(t[a]),
            o = new Uint8Array(r.length);
          for (let h = 0; h < r.length; h++) o[h] = r.charCodeAt(h);
          let l = $w(o),
            c = await Kf.parseAsync(l.buffer.slice(l.byteOffset, l.byteOffset + l.byteLength), "");
          c.scene.updateMatrixWorld(!0);
          let d = [];
          (c.scene.traverse((h) => {
            if ((h.isSkinnedMesh && d.push(h), h.isMesh)) {
              ((h.castShadow = !0), (h.receiveShadow = !0));
              let f = h.material.map;
              (f && ((f.generateMipmaps = !1), (f.minFilter = Qt), (f.magFilter = Qt), (f.needsUpdate = !0)),
                (h.material.roughness = Math.max(0.6, h.material.roughness ?? 1)),
                (h.material.metalness = Math.min(0.2, h.material.metalness ?? 0)));
            }
          }),
            (this.g[a] = { scene: c.scene, anims: c.animations, skinned: d.length > 0 }));
        } catch (r) {
          console.warn("modelo", a, r);
        }
        (s++, n && n(s / i.length));
      }
      (e.remove(), (this.ready = !0));
    },
    has(n) {
      return !!this.g[n];
    },
    staticGeo(n) {
      let e = this.g[n];
      if (!e) return null;
      if (e.sg) return e.sg;
      let t = new Map();
      (e.scene.updateMatrixWorld(!0),
        e.scene.traverse((r) => {
          if (!r.isMesh) return;
          let o = r.geometry.clone();
          for (let c of Object.keys(o.attributes)) ["position", "normal", "uv"].includes(c) || o.deleteAttribute(c);
          o.attributes.uv || o.setAttribute("uv", new ft(new Float32Array(o.attributes.position.count * 2), 2));
          for (let c of ["position", "normal", "uv"]) {
            let d = o.attributes[c];
            if (d && (d.normalized || !(d.array instanceof Float32Array))) {
              let h = new Float32Array(d.count * d.itemSize);
              for (let f = 0; f < d.count; f++)
                for (let u = 0; u < d.itemSize; u++)
                  h[f * d.itemSize + u] = u === 0 ? d.getX(f) : u === 1 ? d.getY(f) : u === 2 ? d.getZ(f) : d.getW(f);
              o.setAttribute(c, new St(h, d.itemSize));
            }
          }
          (o.applyMatrix4(r.matrixWorld), o.index && (o = o.toNonIndexed()));
          let l = r.material;
          (t.has(l) || t.set(l, []), t.get(l).push(o));
        }));
      let i = [];
      for (let [r, o] of t) i.push({ geo: Ld(o, !1), mat: r });
      ta.makeEmpty();
      for (let r of i) (r.geo.computeBoundingBox(), ta.union(r.geo.boundingBox));
      let s = ta.getCenter(new U());
      for (let r of i) (r.geo.translate(-s.x, -ta.min.y, -s.z), r.geo.computeBoundingSphere());
      let a = ta.getSize(new U());
      return ((e.sg = { parts: i, h: a.y, w: Math.max(a.x, a.z) }), e.sg);
    },
  },
  Xw = {
    astro: {
      idle: ["Idle_Gun", "Idle"],
      walk: ["Run_Gun", "Run"],
      shoot: ["Run_Gun_Shoot", "Idle_Gun"],
      walkshoot: ["Run_Gun_Shoot", "Run_Gun"],
      dash: ["Run", "Run_Gun"],
      death: ["Death"],
      hit: ["HitReact"],
      wave: ["Wave"],
      calm: ["Idle"],
      attack: ["Punch"],
    },
    blob: {
      idle: ["Flying_Idle", "Idle"],
      walk: ["Fast_Flying", "Run", "Walk"],
      attack: ["Headbutt", "Punch"],
      death: ["Death"],
      hit: ["HitReact"],
    },
    large: { idle: ["Idle"], walk: ["Run", "Walk"], attack: ["Punch", "Weapon"], death: ["Death"], hit: ["HitReact"] },
    mech: {
      idle: ["Idle"],
      walk: ["Walk", "Run"],
      attack: ["Shoot_Small", "Shoot_Big", "Kick"],
      big: ["Shoot_Big"],
      death: ["Death"],
      hit: ["HitRecieve_1"],
    },
  },
  Yw = new Set(["death", "hit", "attack", "wave", "big"]),
  Da = class {
    constructor(e, t, i = {}) {
      let s = Ln.g[e];
      ((this.root = new Ve()),
        (this.obj = ix(s.scene)),
        this.root.add(this.obj),
        (this.set =
          Xw[
            i.set ||
              (e.startsWith("Astronaut")
                ? "astro"
                : e.startsWith("Mech")
                  ? "mech"
                  : e === "Enemy_Large"
                    ? "large"
                    : "blob")
          ]),
        this.obj.updateMatrixWorld(!0),
        ta.setFromObject(this.obj, !0));
      let a = Math.max(0.1, ta.max.y - Math.min(0, ta.min.y)),
        r = t / a;
      (this.obj.scale.setScalar(r),
        (this.obj.position.y = -Math.min(0, ta.min.y) * r),
        (this.mats = []),
        this.obj.traverse((o) => {
          o.isMesh &&
            ((o.material = o.material.clone()),
            i.recolor && Jf(o.material, i.recolor),
            i.tint != null && o.material.color.setHex(i.tint),
            (o.material.emissive = new Ee(i.emissive ?? 0)),
            (o.material.emissiveIntensity = i.emissive ? 0.12 : 0),
            (o.castShadow = !0),
            (o.frustumCulled = !1),
            this.mats.push(o.material));
        }),
        (this.baseEm = i.emissive ?? 0),
        (this.mixer = new ld(this.obj)),
        (this.clips = {}));
      for (let o of s.anims) this.clips[o.name] = o;
      ((this.cur = null),
        (this.curKey = ""),
        (this.lock = 0),
        this.mixer.addEventListener("finished", () => {
          this.lock = 0;
        }));
    }
    clipFor(e) {
      for (let t of this.set[e] || []) if (this.clips[t]) return this.clips[t];
      return null;
    }
    play(e, t = 1) {
      if (this.dead || (this.lock > 0 && e !== "death" && e !== "hit")) return;
      let i = this.clipFor(e) || this.clipFor("idle");
      if (!i) return;
      if (this.curKey === e && this.cur) {
        this.cur.timeScale = t;
        return;
      }
      let s = this.mixer.clipAction(i);
      (s.reset(),
        (s.timeScale = t),
        (s.enabled = !0),
        Yw.has(e)
          ? (s.setLoop(Ku, 1), (s.clampWhenFinished = !0), (this.lock = e === "death" ? 99 : i.duration / t))
          : s.setLoop(Ju),
        this.cur && this.cur !== s && this.cur.crossFadeTo(s, e === "death" ? 0.1 : 0.18, !1),
        s.play(),
        (this.cur = s),
        (this.curKey = e),
        e === "death" && (this.dead = !0));
    }
    update(e, t, i, s = 1) {
      ((this.root.rotation.y = t),
        this.lock > 0 && this.lock < 99 && (this.lock -= e),
        i && this.play(i, s),
        this.mixer.update(e));
    }
    addSilhouette(e = 3121087) {
      let t = new vt({ color: e, depthWrite: !1, depthFunc: Hu, toneMapped: !1, fog: !1 }),
        i = [];
      this.obj.traverse((s) => {
        s.isMesh && !s.userData.sil && i.push(s);
      });
      for (let s of i) {
        let a;
        (s.isSkinnedMesh
          ? ((a = new so(s.geometry, t)), a.bind(s.skeleton, s.bindMatrix))
          : (a = new Ge(s.geometry, t)),
          a.position.copy(s.position),
          a.quaternion.copy(s.quaternion),
          a.scale.copy(s.scale),
          (s.renderOrder = 2),
          (a.userData.sil = !0),
          (a.renderOrder = 1),
          (a.frustumCulled = !1),
          (a.castShadow = !1),
          (a.receiveShadow = !1),
          s.parent.add(a));
      }
    }
    revive() {
      ((this.dead = !1),
        (this.lock = 0),
        this.mixer.stopAllAction(),
        (this.cur = null),
        (this.curKey = ""),
        this.play("idle"),
        this.mixer.update(0));
    }
    flash(e, t = 16777215) {
      for (let i of this.mats)
        e
          ? (i.emissive.setHex(t === 16777215 ? 16767168 : t), (i.emissiveIntensity = 0.16))
          : (i.emissive.setHex(this.baseEm), (i.emissiveIntensity = this.baseEm ? 0.12 : 0));
    }
    dispose() {
      this.mixer.stopAllAction();
    }
  };


// ════════ [416] FunctionDeclaration Jf (1392 bytes) ════════
function Jf(n, e) {
  return (
    (n.userData.rc = e),
    (n.onBeforeCompile = (t) => {
      (xo(t),
        (t.uniforms.uHue = { value: e.hue || 0 }),
        (t.uniforms.uSat = { value: e.sat ?? 1 }),
        (t.uniforms.uVal = { value: e.val ?? 1 }),
        (t.uniforms.uSuit = { value: new Ee(e.suit ?? 16777215) }),
        (t.uniforms.uSuitOn = { value: e.suit != null ? 1 : 0 }),
        (t.fragmentShader = t.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
uniform float uHue; uniform float uSat; uniform float uVal; uniform vec3 uSuit; uniform float uSuitOn;`,
          )
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
        { vec3 c = diffuseColor.rgb;
          float Y = dot(c, vec3(0.299, 0.587, 0.114)); float I = dot(c, vec3(0.596, -0.274, -0.322)); float Q = dot(c, vec3(0.211, -0.523, 0.312));
          float h = atan(Q, I) + uHue; float ch = sqrt(I * I + Q * Q) * uSat; Y *= uVal; I = ch * cos(h); Q = ch * sin(h);
          diffuseColor.rgb = max(vec3(0.0), vec3(Y + 0.956 * I + 0.621 * Q, Y - 0.272 * I - 0.647 * Q, Y - 1.106 * I + 1.703 * Q));
          vec3 d = diffuseColor.rgb; vec3 g = sqrt(d); float mx = max(g.r, max(g.g, g.b)), mn = min(g.r, min(g.g, g.b)); float sa = mx > 0.001 ? (mx - mn) / mx : 0.0; float lu = dot(g, vec3(0.299, 0.587, 0.114));
          float k = (1.0 - smoothstep(0.10, 0.20, sa)) * smoothstep(0.40, 0.52, lu) * uSuitOn;
          diffuseColor.rgb = mix(d, uSuit * (lu / 0.6) * (lu / 0.6) * 1.15, k); }`,
          )));
    }),
    (n.customProgramCacheKey = () => "rc2"),
    (n.needsUpdate = !0),
    n
  );
}


// ════════ [417] FunctionDeclaration ax (167 bytes) ════════
function ax(n) {
  let e = new Ee(n),
    t = 0.299 * e.r + 0.587 * e.g + 0.114 * e.b,
    i = 0.596 * e.r - 0.274 * e.g - 0.322 * e.b,
    s = 0.211 * e.r - 0.523 * e.g + 0.312 * e.b;
  return { Y: t, h: Math.atan2(s, i), ch: Math.hypot(i, s) };
}


// ════════ [418] FunctionDeclaration Zf (789 bytes) ════════
function Zf(n) {
  let e = Ln.g[n];
  if (!e) return 8421504;
  if (e.avg != null) return e.avg;
  let t = 8421504;
  try {
    let i = null,
      s = [];
    e.scene.traverse((m) => {
      if (m.isMesh && m.material.map) {
        i = i || m.material.map;
        let g = m.geometry.attributes.uv;
        if (g) for (let b = 0; b < g.count; b += 3) s.push([g.getX(b), g.getY(b)]);
      }
    });
    let a = i.image,
      r = 128,
      o = document.createElement("canvas");
    o.width = o.height = r;
    let l = o.getContext("2d", { willReadFrequently: !0 });
    l.drawImage(a, 0, 0, r, r);
    let c = l.getImageData(0, 0, r, r).data,
      d = i.flipY,
      h = 0,
      f = 0,
      u = 0,
      p = 0;
    for (let [m, g] of s) {
      let b = Math.min(r - 1, Math.max(0, Math.floor(m * r))),
        v = (Math.min(r - 1, Math.max(0, Math.floor((d ? 1 - g : g) * r))) * r + b) * 4,
        _ = c[v],
        A = c[v + 1],
        T = c[v + 2],
        k = 0.2 + (Math.max(_, A, T) - Math.min(_, A, T));
      ((h += _ * k), (f += A * k), (u += T * k), (p += k));
    }
    p > 0 && (t = (Math.round(h / p) << 16) | (Math.round(f / p) << 8) | Math.round(u / p));
  } catch {}
  return ((e.avg = t), t);
}


// ════════ [419] FunctionDeclaration To (189 bytes) ════════
function To(n, e, t = 1) {
  let i = ax(Zf(n)),
    s = ax(e);
  return {
    hue: (s.h - i.h) * t,
    sat: Math.max(0.15, Math.min(1.6, s.ch / Math.max(0.02, i.ch))),
    val: Math.max(0.55, Math.min(1.5, (s.Y + 0.08) / Math.max(0.05, i.Y + 0.08))),
  };
}


// ════════ [420] VariableDeclaration Od,br (2238 bytes) ════════
var Od = {
    rastrero: ["Enemy_ExtraSmall", 10119738],
    escupidor: ["Enemy_Small", 9097280],
    acorazado: ["Enemy_Large", 4876954],
    saltador: ["Enemy_ExtraSmall", 11583552],
    avispa: ["Enemy_Flying", 14196768],
    mantis: ["Enemy_Small", 3836474],
    escorpion: ["Enemy_Large", 11565632],
    gusano: ["Enemy_ExtraSmall", 11571312],
    arana: ["Enemy_Small", 6957706],
    larva: ["Enemy_ExtraSmall", 14721224],
    infectado: ["Enemy_Small", 6978138],
    corredor: ["Enemy_ExtraSmall", 10508874],
    bruto: ["Enemy_Large", 10111546],
    vomitador: ["Enemy_Large", 8034874],
    hinchado: ["Enemy_Small", 13668416],
    abominacion: ["Enemy_Large", 10107482],
    yeti: ["Enemy_Large", 14214380],
    necrofago: ["Enemy_Small", 10530864],
    sanguijuela: ["Enemy_ExtraSmall", 8006186],
    dron: ["Enemy_Flying", 6975608],
    reparador: ["Enemy_Flying", 13162696],
    espectro: ["Enemy_Flying", 8018624],
    sombra: ["Enemy_Flying", 1381660],
    tejedor: ["Enemy_Flying", 3836624],
    psionico: ["Enemy_Small", 9063104],
    golem: ["Enemy_Large", 4860448],
    elhielo: ["Enemy_Large", 9488624],
    cazador: ["Enemy_Small", 3807818],
    guardian: ["Enemy_Large", 5909114],
    salamandra: ["Enemy_Small", 12601872],
    hongo: ["Enemy_Small", 10510544],
    aranamec: ["Mech_RaeTheRedPanda", null],
    mech: ["Mech_FinnTheFrog", null],
    centinela: ["Mech_FernandoTheFlamingo", 4235456],
    mortero: ["Mech_BarbaraTheBee", null],
    tanquemec: ["Mech_RaeTheRedPanda", 5921370],
    torreta: ["Mech_BarbaraTheBee", 6974058],
    fisionador: ["Enemy_Large", 4889194],
    fisionado: ["Enemy_ExtraSmall", 6996096],
    minador: ["Enemy_Flying", 11569712],
    acechador: ["Enemy_Small", 2111560],
    bombardero: ["Enemy_Flying", 9089072],
    escudero: ["Mech_FernandoTheFlamingo", 3824266],
    matriarca: ["Enemy_Large", 11553424],
    rabioso: ["Enemy_Large", 11550768],
    pilon: ["Mech_BarbaraTheBee", 3828400],
    parasito: ["Enemy_ExtraSmall", 10494016],
    reina: ["Enemy_Large", 6957642],
    demoledor: ["Enemy_Large", 9067066],
    kharsa: ["Enemy_Large", 11563040],
    madre: ["Enemy_Small", 10113216],
    wendigo: ["Enemy_Large", 15266040],
    omega: ["Mech_BarbaraTheBee", 13144096],
    ifrit: ["Enemy_Large", 13647888],
    horror: ["Enemy_Small", 10137632],
    mente: ["Enemy_Flying", 12599551],
    carnicero: ["Enemy_Large", 10493984],
    antiguo: ["Enemy_Flying", 3834064],
    leviatan: ["Enemy_Small", 2775594],
    titan: ["Mech_FinnTheFrog", 3816e3],
    avatar: ["Enemy_Flying", 657940],
  },
  br = [
    "Astronaut_FinnTheFrog",
    "Astronaut_RaeTheRedPanda",
    "Astronaut_BarbaraTheBee",
    "Astronaut_FernandoTheFlamingo",
  ];


// ════════ [421] VariableDeclaration rx,ox,lx (3032 bytes) ════════
var rx = {
    oak: [["N_Oak_0", "N_Oak_1", "N_Oak_2"], 3.1, 2.7],
    pine: [["N_Pine_0", "N_Pine_1", "N_Pine_2"], 3.4, 2.4],
    bush: [["N_Bush_0", "N_Bush_1", "N_Bush_2"], 0.95],
    cliffrock: [["N_Cliff_0", "N_Cliff_1", "N_Cliff_2"], 1.25, 1.5],
    rock: [["N_Rock_0", "N_Rock_1", "N_Rock_2", "N_Rock_3"], 0.75, 1.3],
    rock_big: [["N_RockL_0", "N_RockL_1", "N_RockL_2"], 1.6, 2.4],
    rock_desert: [["N_Rock_1", "N_Rock_3", "N_RockL_1"], 1.2, 2],
    boulder_snow: [["N_RockL_0", "N_Rock_2"], 1.1, 1.9],
    rock_lava: [["N_Rock_0", "N_Rock_2"], 0.9, 1.5],
    dead_tree: [["N_Dead_0", "N_Dead_1", "N_Dead_2"], 2.6, 2.4],
    swamp_tree: [["N_Willow_0", "N_Willow_1"], 2.9, 2.8],
    pine_snow: [["N_PineSnow_0", "N_PineSnow_1"], 3.2, 2.3],
    ice_spike: [["Tree_Spikes_1", "Tree_Spikes_2"], 1.8],
    crystal_ice: [["Tree_Spikes_2"], 1.4],
    tendril: [["Tree_Swirl_1", "Tree_Swirl_2"], 2.4],
    xeno_spire: [["Tree_Light_1", "Tree_Light_2"], 3],
    obsidian: [["Tree_Lava_1", "Tree_Lava_2", "Tree_Lava_3"], 2.6],
    reeds: [["N_Reeds_0", "N_Reeds_1"], 1.15],
    cactus: [["N_Cactus_0"], 1.7],
    car: [["Rover_1", "Rover_2", "Rover_Round"], 1.4, 2.2],
    tank_wreck: [["Rover_1"], 1.7, 2.6],
    antenna: [["Roof_Antenna"], 3],
    radar: [["Roof_Radar"], 2.2],
    generator: [["Roof_VentL", "Roof_VentR"], 1],
    crate: [["Pickup_Crate"], 0.9],
    crates: [["Pickup_Crate"], 1],
    // barriles: ahora los dibuja el kit procedural (Ie.barrel*): bandas, tapas y fugas emisivas que el modelo «tarro» no tenía
    tent: [["House_Cylinder"], 2.2, 2.4],
    pipe: [["MetalSupport", "Connector"], 1.4],
    tower: [["Roof_Antenna"], 4.2],
    st_house: [["House_Single"], 99, 99, 0.9],
    st_house2: [["House_Open", "House_OpenBack"], 99, 99, 0.9],
    st_long: [["House_Long"], 99, 99, 0.9],
    st_cyl: [["House_Cylinder"], 99, 99, 0.9],
    st_lbld: [["Building_L"], 99, 99, 0.9],
    st_base: [["Base_Large"], 99, 99, 0.9],
    st_dome: [["GeodesicDome"], 99, 99, 0.9],
    st_solar: [["SolarPanel_Structure"], 99, 99, 0.9],
    st_panel: [["SolarPanel_Ground"], 99, 99, 0.9],
    st_ship: [
      ["Spaceship_FinnTheFrog", "Spaceship_RaeTheRedPanda", "Spaceship_BarbaraTheBee", "Spaceship_FernandoTheFlamingo"],
      99,
      99,
      0.9,
    ],
    st_rover: [["Rover_1", "Rover_2", "Rover_Round"], 99, 99, 0.6],
    st_support: [["MetalSupport"], 99, 99, 0.9],
    grass: [
      ["N_Grass_0", "N_Grass_1", "N_Grass_2", "N_Fern_0", "N_Grass_0", "N_Grass_1", "N_Grass_2", "N_Fern_1"],
      0.5,
    ],
    dry_grass: [["N_GrassDry_0", "N_GrassDry_1"], 0.45],
    reed_small: [["N_Reeds_1"], 0.6],
    flower: [["N_Flower_0", "N_Flower_1", "N_Flower_2"], 0.5],
    shroom_small: [["N_Shroom_0", "N_Shroom_1"], 0.42],
  },
  ox = {
    valle: { tree: 4885050, rock: 9079428, grass: 6987840 },
    ciudad: { tree: 5929530, rock: 8026744, grass: 6982208 },
    desierto: { tree: 9083456, rock: 12618320, grass: 12623968 },
    marisma: { tree: 4876842, rock: 5922896, grass: 6978106 },
    tundra: { tree: 10146032, rock: 13161692, grass: 14741238 },
    complejo: { tree: 5925434, rock: 6975090, grass: 6978122 },
    caldera: { tree: 13651984, rock: 3812906, grass: 6961696 },
    yermo: { tree: 10132032, rock: 10130536, grass: 11051088 },
    colmena: { tree: 10502336, rock: 4860496, grass: 9058954 },
  },
  lx = {
    oak: "tree",
    pine: "tree",
    bush: "tree",
    dead_tree: null,
    swamp_tree: "tree",
    tendril: "tree",
    xeno_spire: null,
    obsidian: null,
    pine_snow: null,
    ice_spike: null,
    crystal_ice: null,
    rock: "rock",
    cliffrock: "rock",
    rock_big: "rock",
    rock_desert: "rock",
    boulder_snow: "rock",
    rock_lava: "rock",
    grass: "grass",
    dry_grass: "grass",
    reed_small: "grass",
    reeds: "grass",
    cactus: "tree",
  };


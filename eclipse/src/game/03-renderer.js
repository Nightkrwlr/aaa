// 03-renderer.js — Renderer rig (vd): WebGLRenderer, luces, cámara isométrica y tubería de post-proceso.
//
// Reescrito sobre el motor de SUNDERCHOIR (src/engine/post.js + atmosphere.js):
//   · escena → destino HDR half-float con MSAA → bloom → pasada final (mapeo tonal filmic + grade + viñeta + grano)
//   · niebla de ALTURA con velo cálido (en vez de niebla lineal) y «mirada» (grade/niebla/bloom) por región
// Frente «clima y luz»: ciclo día/noche rico (sol rasante y cálido al amanecer/atardecer, luna azulada, farolas que se encienden con
// el atardecer), clima por GPU por región (lluvia, polvo, nieve, brasas, ceniza, esporas), fondo degradado, niebla de suelo (high),
// cono visible de la linterna y «mirada» por tema en las operaciones. Todo cuelga de este rig; x.R.* no cambia.
// La API pública que usa el resto del juego se conserva: x.R.{r, scene, camera, target, env, bloom, finalPass.uniforms,
// setQuality, setZoom, setRegionEnv, addShake, flashLight, update, adapt, render, project, unproject, resize, flash, pLight}.

var ws = new U(1, 1.32, 1).normalize(),
  yl = 70,
  vd = class {
    constructor(e) {
      ((this.canvas = e), (this.quality = "high"), (this.dynScale = 1), (this._ft = 1 / 60), (this._dynT = 0));
      // MSAA lo da el destino HDR de PostFx; el canvas no necesita antialias propio
      let t = (this.r = new al({ canvas: e, antialias: !1, powerPreference: "high-performance" }));
      ((t.outputColorSpace = Pt),
        (t.toneMapping = 0), // el mapeo tonal lo hace la pasada final, una sola vez
        (t.toneMappingExposure = 1),
        (t.shadowMap.enabled = !0),
        (t.shadowMap.type = Bu),
        installWorldFog(),
        (this.scene = new qc()),
        (this.scene.fog = new WorldFog(10469320, 0.01, 0.05)),
        ClWet(), // suelo mojado (lluvia): parche de chunks de luz, antes de compilar ningún material
        (this.sky = new ClSky()),
        this.scene.add(this.sky.mesh),
        (this.wx = new ClWeather(this.scene)),
        (this.mist = new ClMist(this.scene)),
        (this.cone = new ClCone(this.scene)),
        (this.viewH = 23),
        (this.camera = new $i(-10, 10, 10, -10, 1, 220)),
        (this.target = new U()),
        (this.shake = 0),
        (this.shakeT = 0),
        (this.hemi = new sd(12574975, 4872746, 1.1)),
        this.scene.add(this.hemi),
        (this.sun = new uo(16773848, 2.4)),
        (this.sun.castShadow = !0));
      let i = this.sun.shadow.camera;
      ((i.left = -26),
        (i.right = 26),
        (i.top = 26),
        (i.bottom = -26),
        (i.near = 1),
        (i.far = 120),
        this.sun.shadow.mapSize.set(2048, 2048),
        (this.sun.shadow.bias = -6e-4),
        (this.sun.shadow.normalBias = 0.03),
        this.scene.add(this.sun, this.sun.target),
        (this.amb = new ad(16777215, 0)),
        this.scene.add(this.amb),
        (this.flash = new ho(16774368, 0, 15, 0.5, 0.45, 1.2)),
        (this.flash.castShadow = !0),
        this.flash.shadow.mapSize.set(1024, 1024),
        (this.flash.shadow.bias = -0.002),
        (this.flash.shadow.camera.near = 0.3),
        this.scene.add(this.flash, this.flash.target),
        (this.pLight = new $s(16771272, 0, 6, 1.6)),
        this.scene.add(this.pLight),
        (this.pool = []));
      for (let s = 0; s < 5; s++) {
        let a = new $s(16777215, 0, 8, 1.8);
        ((a.userData = { life: 0, max: 0, base: 0 }), this.scene.add(a), this.pool.push(a));
      }
      // post-proceso (motor): HDR + MSAA + bloom + grade final. `finalPass` y `bloom` conservan el nombre que usa el juego.
      ((this.post = new PostFx(t, this.scene, this.camera)),
        (this.bloom = this.post.bloom),
        (this.finalPass = { uniforms: this.post.uniforms }),
        (this.look = lookFor("valle")),
        (this.lookTgt = lookFor("valle")),
        (this.env = { hemiI: 1.1, sunI: 2.4, dark: 0, night: 0, twi: 0, sunEl: 1, wet: 0, rain: 0 }),
        (this.regionKey = "valle"),
        (this.themeOutdoor = !0),
        (this.sunDir = new U(-0.46, 0.85, -0.25).normalize()),
        (this.lightDir = new U().copy(this.sunDir)),
        (this._tmpDir = new U()),
        (this._c1 = new Ee()),
        (this._c2 = new Ee()),
        (this._wind2 = new Se(0.8, 0.5)),
        (this.envCur = { sky: new Ee(12574975), gnd: new Ee(4872746), sun: new Ee(16773848), fog: new Ee(10469320) }),
        (this.envTgt = { sky: new Ee(), gnd: new Ee(), sun: new Ee(), fog: new Ee(), sunI: 2.4 }),
        this.setQuality("high"),
        addEventListener("resize", () => this.resize()));
    }
    // true en móviles/tabletas: el MSAA y la resolución se recortan para no ahogar la GPU
    get touch() {
      return "ontouchstart" in window || matchMedia("(pointer: coarse)").matches;
    }
    setQuality(e) {
      this.quality = e;
      let t = e === "high",
        i = e === "low";
      ((this.r.shadowMap.enabled = !i),
        (this.sun.castShadow = !i),
        (this.flash.castShadow = t),
        this.sun.shadow.mapSize.set(t ? 2048 : 1024, t ? 2048 : 1024),
        this.sun.shadow.map && (this.sun.shadow.map.dispose(), (this.sun.shadow.map = null)),
        this.post.configure({ samples: i ? 0 : t ? 4 : this.touch ? 0 : 2, bloom: !i }),
        this.wx.setQuality(e),
        this.scene.traverse((s) => {
          s.material && (Array.isArray(s.material) ? s.material : [s.material]).forEach((a) => (a.needsUpdate = !0));
        }),
        this.resize());
    }
    resize() {
      let e = this.canvas.clientWidth || innerWidth,
        t = this.canvas.clientHeight || innerHeight,
        i = Math.max(
          1,
          Math.min(devicePixelRatio || 1, this.quality === "high" ? 2 : this.quality === "medium" ? 1.5 : 1) *
            (this.dynScale || 1),
        );
      (this.r.setPixelRatio(i), this.r.setSize(e, t, !1), this.post.setSize(e, t), (this.w = e), (this.h = t));
      let s = e / t,
        a = document.body.classList.contains("touch"),
        r = s < 0.8 ? this.viewH * (a ? 1.05 : 1.25) : a && t < 560 ? this.viewH * 0.72 : this.viewH;
      ((this.camera.left = (-r * s) / 2),
        (this.camera.right = (r * s) / 2),
        (this.camera.top = r / 2),
        (this.camera.bottom = -r / 2),
        this.camera.updateProjectionMatrix(),
        (this.pxPerUnit = t / r));
    }
    setZoom(e) {
      ((this.viewH = qe(e, 15, 34)), this.resize());
    }
    // clave del tema de la operación en curso (interiores): se busca por identidad en Zi, que vive en 09-regions
    themeKey() {
      let m = x.map;
      if (!m || !m.themeObj && !m.theme) return null;
      // el mapa de la operación guarda la clave del tema (h.theme); la identidad de themeObj es el plan B
      if (m.theme && Zi[m.theme]) return m.theme;
      for (let k in Zi) if (Zi[k] === m.themeObj) return k;
      return null;
    }
    setRegionEnv(e, t = !1) {
      let th = e.key ? null : this.themeKey(),
        key = e.key || th || "valle";
      (this.envTgt.sky.setHex(e.sky),
        this.envTgt.gnd.setHex(e.hemiG),
        this.envTgt.sun.setHex(e.sun),
        this.envTgt.fog.setHex(e.fog),
        (this.envTgt.sunI = e.sunI),
        (this.regionKey = key),
        (this.themeOutdoor = th ? !!(x.map.themeObj && x.map.themeObj.outdoor) : !0),
        (this.lookTgt = th ? ClThemeLook(th) : lookFor(e.key)),
        t &&
          (this.envCur.sky.copy(this.envTgt.sky),
          this.envCur.gnd.copy(this.envTgt.gnd),
          this.envCur.sun.copy(this.envTgt.sun),
          this.envCur.fog.copy(this.envTgt.fog),
          (this.look = th ? ClThemeLook(th) : lookFor(e.key))));
      // clima de la región (De[i].weather) o, en interiores, el del tema; cruza con suavidad salvo en teletransportes
      let w = (e.key && ClRegWx[e.key]) || e.weather || null,
        k = 1;
      th && ClThemeWx[th] && ((w = ClThemeWx[th][0]), (k = ClThemeWx[th][1]));
      this.wx.setTarget(w, k, t);
    }
    addShake(e) {
      this.shake = Math.min(1.2, this.shake + e);
    }
    flashLight(e, t, i, s, a, r, o) {
      let l =
        this.pool.find((c) => c.userData.life <= 0) ||
        this.pool.reduce((c, d) => (c.userData.life < d.userData.life ? c : d));
      (l.position.set(e, t, i),
        l.color.setHex(s),
        (l.distance = r),
        (l.userData.life = o),
        (l.userData.max = o),
        (l.userData.base = a),
        (l.intensity = a));
    }
    update(e, t, i, s, a) {
      ((this.target.x = ls(this.target.x, t, 1 - Math.exp(-e * 8))),
        (this.target.z = ls(this.target.z, i, 1 - Math.exp(-e * 8))),
        (this.shake = Math.max(0, this.shake - e * 2.2)),
        (this.shakeT += e * 60));
      let r = (Math.sin(this.shakeT * 1.7) + Math.sin(this.shakeT * 2.9)) * this.shake * 0.18,
        o = (Math.cos(this.shakeT * 2.3) + Math.sin(this.shakeT * 1.3)) * this.shake * 0.18;
      (this.camera.position.set(this.target.x + ws.x * yl + r, ws.y * yl, this.target.z + ws.z * yl + o),
        this.camera.lookAt(this.target.x + r, 0, this.target.z + o));
      let l = 1 - Math.exp(-e * 1.5);
      (this.envCur.sky.lerp(this.envTgt.sky, l),
        this.envCur.gnd.lerp(this.envTgt.gnd, l),
        this.envCur.sun.lerp(this.envTgt.sun, l),
        this.envCur.fog.lerp(this.envTgt.fog, l),
        (this.env.dark = ls(this.env.dark, s, 1 - Math.exp(-e * 3))),
        (this.env.night = ls(this.env.night, a, 1 - Math.exp(-e * 0.8))));
      // ── ciclo día/noche: x.sunEl / x.twi / x.sunU los calcula World.update; en interiores el sol no pinta nada ──
      let world = x.mode === "world",
        sunEl = world ? (x.sunEl ?? 1) : 1,
        twiT = world ? (x.twi ?? 0) : 0,
        en = this.env;
      ((en.sunEl = sunEl), (en.twi = ls(en.twi, twiT, 1 - Math.exp(-e * 1.4))));
      let c = en.dark,
        d = en.night,
        tw = en.twi * (1 - c),
        h = (1 - c) * (1 - d * 0.6),
        wo = this.wx.out,
        c1 = this._c1,
        c2 = this._c2;
      // luz de hemisferio: cielo azulado de noche, melocotón en el arrebol; el suelo devuelve un violeta cálido al atardecer
      (this.hemi.color.copy(this.envCur.sky).lerp(xw, d * 0.7).lerp(Cl_DUSK_SKY, tw * 0.42),
        this.hemi.groundColor.copy(this.envCur.gnd).lerp(Cl_NIGHT_GND, d * 0.5).lerp(Cl_DUSK_GND, tw * 0.4));
      wo.warm > 0.01 &&
        this.hemi.groundColor.lerp(Cl_EMBER, wo.warm * (0.32 + 0.1 * Math.sin(this.post.uniforms.uTime.value * 7.3 + Math.sin(this.post.uniforms.uTime.value * 2.1) * 3)));
      this.hemi.intensity = 0.04 + 1.05 * h + d * (1 - c) * 0.15 + this.wx.bolt * 1.5;
      // sol (día) y luna (noche) comparten UNA luz con sombras: el sol baja, se enrojece y alarga las sombras; la luna entra por
      // el otro lado cuando el sol ya no aporta (el salto de dirección ocurre con la intensidad casi a cero y se suaviza)
      let up = Cl_smooth(0, 0.2, sunEl) * (0.55 + 0.45 * Cl_smooth(0.1, 0.6, sunEl)),
        sunI = this.envTgt.sunI * (1 - c) * up * wo.sunMul,
        moonI = 0.56 * d * (1 - c),
        warm = tw * Cl_smooth(-0.25, 0.08, sunEl),
        elev = ((20 + 38 * Math.pow(Math.max(sunEl, 0), 0.75)) * Math.PI) / 180,
        az = -2.45 + ((world ? (x.sunU ?? 0.5) : 0.5) - 0.5) * 1.1;
      this._tmpDir.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev));
      if (moonI > sunI) {
        let ma = -1.31 + (x.moonQ ?? 0.5) * 0.5 - 0.25;
        this._tmpDir.set(Math.cos(ma) * 0.67, 0.74, Math.sin(ma) * 0.67);
      }
      (this.lightDir.lerp(this._tmpDir, 1 - Math.exp(-e * 3)).normalize(),
        this.sun.color.copy(this.envCur.sun).lerp(Cl_WARM_SUN, warm).lerp(Cl_MOON, moonI / (sunI + moonI + 1e-3)),
        (this.sun.intensity = sunI + moonI),
        this.sun.position.set(
          this.target.x + this.lightDir.x * 56.1,
          this.lightDir.y * 56.1,
          this.target.z + this.lightDir.z * 56.1,
        ),
        this.sun.target.position.set(this.target.x, 0, this.target.z));
      // niebla / fondo: color base del bioma con la luz del momento, azul de noche, naranja en el arrebol y teñida por el clima
      c1.copy(this.envCur.fog).multiplyScalar(Math.max(0.03, h * 1 + 0.04));
      c1.r *= 1 - d * 0.5;
      c1.g *= 1 - d * 0.28;
      c1.b *= 1 + d * 0.45;
      let lum = c1.r * 0.3 + c1.g * 0.55 + c1.b * 0.15;
      (tw > 0.01 && c1.lerp(c2.setRGB(1.0, 0.5, 0.26).multiplyScalar(Math.max(lum, 0.05) * 1.5), tw * 0.62),
        wo.tintAmt > 0.01 && c1.lerp(wo.tint, wo.tintAmt),
        this.scene.fog.color.copy(c1),
        (!this.scene.background || !this.scene.background.isColor) && (this.scene.background = new Ee()),
        this.scene.background.copy(c1));
      // «mirada» de la región: grade, niebla y bloom se acercan a la meta con suavidad (cruzar de bioma no da un salto)
      let m = this.look,
        g = this.lookTgt,
        b = this.post.uniforms;
      for (let y of ["density", "falloff", "sat", "contrast", "exposure", "vig", "lift", "tone", "mist"]) m[y] = ls(m[y], g[y], l);
      for (let y of ["shadow", "high", "bloom"]) for (let v = 0; v < 3; v++) m[y][v] = ls(m[y][v], g[y][v], l);
      let n = d * 0.65,
        rn = wo.rain;
      (b.uSat.value = m.sat * (1 - d * 0.1 + tw * 0.18 - rn * 0.1)),
        (b.uTone.value = m.tone),
        (b.uContrast.value = m.contrast),
        (b.uLift.value = m.lift),
        // sombras frías y luces cálidas; de noche todo vira al azul y en el arrebol las sombras se vuelven malva y las luces ámbar
        b.uShadowTint.value
          .set(m.shadow[0], m.shadow[1], m.shadow[2])
          .lerp(Cl_NIGHT_SH, n)
          .lerp(Cl_DUSK_SH, tw * 0.55),
        b.uHighTint.value
          .set(m.high[0], m.high[1], m.high[2])
          .lerp(Cl_NIGHT_HI, d * 0.55)
          .lerp(Cl_DUSK_HI, tw * 0.85),
        (b.uExposure.value = m.exposure * (1.15 + c * 0.25) * (1 + d * 0.14) * (1 - 0.06 * rn) * (1 + this.wx.bolt * 0.3)),
        (b.uVig.value = m.vig + c * 0.5 + d * 0.25),
        (this.scene.fog.density = m.density * (1 + c * 0.6 + d * 0.3 + tw * 0.35) * wo.fogMul),
        (this.scene.fog.falloff = m.falloff),
        (this.bloom.strength = m.bloom[0] * (1 + d * 0.5 + tw * 0.3 + wo.warm * 0.4)),
        (this.bloom.radius = m.bloom[1]),
        (this.bloom.threshold = m.bloom[2]);
      b.uTime.value = (b.uTime.value + e) % 100;
      // suelo mojado: la lluvia lo oscurece y lo pule en todos los materiales con luces (uDarkInfo.w, ver weather.js)
      (go.uDarkInfo.value.w = ls(go.uDarkInfo.value.w, wo.wet, 1 - Math.exp(-e * 0.6))), (en.wet = go.uDarkInfo.value.w), (en.rain = rn);
      // clima por GPU alrededor del objetivo
      let pr = this.r.getPixelRatio();
      (this.wx.update(e, {
        x: this.target.x,
        z: this.target.z,
        camera: this.camera,
        pxPerUnit: (this.pxPerUnit || 20) * pr,
        night: d,
        dark: c,
        fog: c1,
        sun: this.sun.color,
        light: 0.2 + 0.8 * (1 - d * 0.75) * (1 - c),
        sporeColor: this.regionKey === "colmena" || this.regionKey === "gruta" ? Cl_SPORE_V : Cl_SPORE_T,
      }),
        (this.mist.update(
          this.wx.time,
          this.target.x,
          this.target.z,
          this.quality === "high" ? Math.min(0.5, m.mist * (1 + tw * 1.2) * (1 - c * 0.6) * (1 + wo.rain * 0.5)) : 0,
          c2.copy(c1).lerp(Cl_WHITE, 0.3).multiplyScalar(1.15),
          this.wx.uni.uWind.value,
        )));
      // fondo degradado: horizonte = niebla, cielo arriba; arrebol, estrellas y luna de noche (solo asoma fuera del terreno)
      let sk = this.sky.material.uniforms;
      (sk.uFog.value.copy(c1),
        sk.uTop.value
          .copy(this.themeOutdoor ? this.envCur.sky : c1)
          .multiplyScalar(this.themeOutdoor ? Math.max(0.05, h * 0.62 + 0.03) : 0.45)
          .lerp(Cl_NIGHT_TOP, d * 0.8 * (this.themeOutdoor ? 1 : 0.3))
          .lerp(Cl_DUSK_TOP, tw * 0.5),
        (sk.uGlow.value = tw * 0.7 * (1 - c)),
        (sk.uStar.value = this.themeOutdoor ? d * (1 - c) * (1 - rn * 0.8) : 0),
        (sk.uTime.value = b.uTime.value),
        (sk.uAspect.value = (this.w || 16) / (this.h || 9)),
        sk.uGlowCol.value.copy(Cl_WARM_SUN));
      for (let f of this.pool)
        f.userData.life > 0 &&
          ((f.userData.life -= e),
          (f.intensity = f.userData.life > 0 ? f.userData.base * (f.userData.life / f.userData.max) : 0));
      // cono visible de la linterna (los datos de la luz los fija mS() en 32-boot antes de cada update)
      let fl = this.flash;
      this.cone.update(e, b.uTime.value, fl.position, fl.target.position, fl.intensity > 0.5, Math.min(1, Math.max(d * 0.9, c)), fl.distance * 0.6);
    }
    adapt(e) {
      if (((this._ft += (e - this._ft) * 0.05), (this._dynT += e), this._dynT < 2.5 || (devicePixelRatio || 1) <= 1))
        return;
      let t = this.dynScale;
      (this._ft > 1 / 48 && t > 0.65
        ? (t = Math.max(0.65, t - 0.1))
        : this._ft < 1 / 58 && t < 1 && (t = Math.min(1, t + 0.05)),
        t !== this.dynScale && ((this.dynScale = t), (this._dynT = 0), this.resize()));
    }
    render() {
      this.post.render();
    }
    project(e, t, i, s) {
      let a = vg.set(e, t, i).project(this.camera);
      return ((s.x = (a.x * 0.5 + 0.5) * this.w), (s.y = (-a.y * 0.5 + 0.5) * this.h), (s.vis = a.z < 1), s);
    }
    unproject(e, t) {
      let i = vg.set((e / this.w) * 2 - 1, -(t / this.h) * 2 + 1, 0).unproject(this.camera),
        s = gw.set(-ws.x, -ws.y, -ws.z),
        a = -i.y / s.y;
      return { x: i.x + s.x * a, z: i.z + s.z * a };
    }
  },
  vg = new U(),
  gw = new U(),
  xw = new Ee(3162218),
  bw = new Ee(7377104),
  Cl_smooth = (n, e, t) => ((t = Math.min(1, Math.max(0, (t - n) / (e - n)))), t * t * (3 - 2 * t)),
  Cl_DUSK_SKY = new Ee(1.0, 0.62, 0.5),
  Cl_DUSK_GND = new Ee(0.34, 0.18, 0.26),
  Cl_NIGHT_GND = new Ee(0.03, 0.05, 0.11),
  Cl_DUSK_TOP = new Ee(0.3, 0.12, 0.28),
  Cl_NIGHT_TOP = new Ee(0.008, 0.02, 0.07),
  Cl_WARM_SUN = new Ee(1.0, 0.42, 0.12),
  Cl_MOON = new Ee(0.46, 0.6, 1.0),
  Cl_EMBER = new Ee(0.9, 0.3, 0.06),
  Cl_WHITE = new Ee(1, 1, 1),
  Cl_NIGHT_SH = new U(0.78, 0.92, 1.3),
  Cl_NIGHT_HI = new U(0.86, 0.98, 1.2),
  Cl_DUSK_SH = new U(0.94, 0.86, 1.18),
  Cl_DUSK_HI = new U(1.22, 0.95, 0.74),
  Cl_SPORE_T = new Ee(0.35, 1.0, 0.72),
  Cl_SPORE_V = new Ee(0.85, 0.42, 1.0);

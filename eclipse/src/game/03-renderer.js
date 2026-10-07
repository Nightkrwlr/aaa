// 03-renderer.js — Renderer rig (vd): WebGLRenderer, luces, cámara isométrica y tubería de post-proceso.
//
// Reescrito sobre el motor de SUNDERCHOIR (src/engine/post.js + atmosphere.js):
//   · escena → destino HDR half-float con MSAA → bloom → pasada final (mapeo tonal filmic + grade + viñeta + grano)
//   · niebla de ALTURA con velo cálido (en vez de niebla lineal) y «mirada» (grade/niebla/bloom) por región
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
        (this.env = { hemiI: 1.1, sunI: 2.4, dark: 0, night: 0 }),
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
    setRegionEnv(e, t = !1) {
      (this.envTgt.sky.setHex(e.sky),
        this.envTgt.gnd.setHex(e.hemiG),
        this.envTgt.sun.setHex(e.sun),
        this.envTgt.fog.setHex(e.fog),
        (this.envTgt.sunI = e.sunI),
        (this.lookTgt = lookFor(e.key)),
        t &&
          (this.envCur.sky.copy(this.envTgt.sky),
          this.envCur.gnd.copy(this.envTgt.gnd),
          this.envCur.sun.copy(this.envTgt.sun),
          this.envCur.fog.copy(this.envTgt.fog),
          (this.look = lookFor(e.key))));
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
      let c = this.env.dark,
        d = this.env.night,
        h = (1 - c) * (1 - d * 0.6);
      (this.hemi.color.copy(this.envCur.sky).lerp(xw, d * 0.7),
        this.hemi.groundColor.copy(this.envCur.gnd),
        (this.hemi.intensity = 0.04 + 1.05 * h + d * (1 - c) * 0.1),
        this.sun.color.copy(this.envCur.sun).lerp(bw, d),
        (this.sun.intensity = this.envTgt.sunI * (1 - c) * (1 - d * 0.7)),
        this.sun.position.set(this.target.x - 26, 48, this.target.z - 14),
        this.sun.target.position.set(this.target.x, 0, this.target.z),
        this.scene.fog.color.copy(this.envCur.fog).multiplyScalar(Math.max(0.03, h * 1 + 0.04)),
        (!this.scene.background || !this.scene.background.isColor) && (this.scene.background = new Ee()),
        this.scene.background.copy(this.scene.fog.color));
      // «mirada» de la región: grade, niebla y bloom se acercan a la meta con suavidad (cruzar de bioma no da un salto)
      let m = this.look,
        g = this.lookTgt,
        b = this.post.uniforms;
      for (let y of ["density", "falloff", "sat", "contrast", "exposure", "vig", "lift", "tone"]) m[y] = ls(m[y], g[y], l);
      for (let y of ["shadow", "high", "bloom"]) for (let v = 0; v < 3; v++) m[y][v] = ls(m[y][v], g[y][v], l);
      (b.uSat.value = m.sat),
        (b.uTone.value = m.tone),
        (b.uContrast.value = m.contrast),
        (b.uLift.value = m.lift),
        b.uShadowTint.value.set(m.shadow[0], m.shadow[1], m.shadow[2]),
        b.uHighTint.value.set(m.high[0], m.high[1], m.high[2]),
        (b.uExposure.value = m.exposure * (1.15 + c * 0.25)),
        (b.uVig.value = m.vig + c * 0.5 + d * 0.25),
        (this.scene.fog.density = m.density * (1 + c * 0.6 + d * 0.3)),
        (this.scene.fog.falloff = m.falloff),
        (this.bloom.strength = m.bloom[0] * (1 + d * 0.5)),
        (this.bloom.radius = m.bloom[1]),
        (this.bloom.threshold = m.bloom[2]);
      for (let f of this.pool)
        f.userData.life > 0 &&
          ((f.userData.life -= e),
          (f.intensity = f.userData.life > 0 ? f.userData.base * (f.userData.life / f.userData.max) : 0));
      b.uTime.value = (b.uTime.value + e) % 100;
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
  bw = new Ee(7377104);

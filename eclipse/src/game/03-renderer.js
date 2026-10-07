// 03-renderer.js — Renderer rig (vd): WebGLRenderer, luces, composer, grade final, cámara isométrica

// ════════ [316] VariableDeclaration ws,yl,mw,vd,vg,gw,xw,bw (7281 bytes) ════════
var ws = new U(1, 1.32, 1).normalize(),
  yl = 70,
  mw = {
    uniforms: {
      tDiffuse: { value: null },
      uVig: { value: 0.35 },
      uHurt: { value: 0 },
      uTint: { value: new Ee(0, 0, 0) },
      uTintA: { value: 0 },
      uTime: { value: 0 },
      uGrain: { value: 0.035 },
    },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uHurt; uniform vec3 uTint; uniform float uTintA; uniform float uTime; uniform float uGrain; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  void main(){ vec2 c=vUv-0.5; float d=length(c);
    float ab = 0.0015 + uHurt*0.006;
    vec3 col; col.r = texture2D(tDiffuse, vUv + c*ab).r; col.g = texture2D(tDiffuse, vUv).g; col.b = texture2D(tDiffuse, vUv - c*ab).b;
    col = mix(col, col*uTint*1.6 + uTint*0.05, uTintA);
    float v = smoothstep(0.85, 0.25, d*(1.0+uVig));
    // gradaci\xF3n de color: un poco m\xE1s de contraste y saturaci\xF3n
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, 1.12);
    col = (col - 0.5) * 1.06 + 0.5;
    col = max(col, vec3(0.0));
    col *= mix(1.0, v, 0.9);
    col = mix(col, vec3(0.55,0.0,0.02), uHurt * smoothstep(0.25,0.75,d));
    col += (h(vUv*1000.0 + uTime) - 0.5) * uGrain;
    gl_FragColor = vec4(col, 1.0); }`,
  },
  vd = class {
    constructor(e) {
      ((this.canvas = e), (this.quality = "high"), (this.dynScale = 1), (this._ft = 1 / 60), (this._dynT = 0));
      let t = (this.r = new al({ canvas: e, antialias: !1, powerPreference: "high-performance" }));
      ((t.outputColorSpace = Pt),
        (t.toneMapping = gl),
        (t.toneMappingExposure = 1.15),
        (t.shadowMap.enabled = !0),
        (t.shadowMap.type = Bu),
        (this.scene = new qc()),
        (this.scene.fog = new Vc(10469320, yl + 6, yl + 48)),
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
      ((this.composer = new md(t)),
        (this.renderPass = new gd(this.scene, this.camera)),
        (this.bloom = new mo(new Se(512, 512), 0.75, 0.55, 0.82)),
        (this.finalPass = new po(mw)),
        this.composer.addPass(this.renderPass),
        this.composer.addPass(this.bloom),
        this.composer.addPass(new xd()),
        this.composer.addPass(this.finalPass),
        (this.env = { hemiI: 1.1, sunI: 2.4, dark: 0, night: 0 }),
        (this.envCur = { sky: new Ee(12574975), gnd: new Ee(4872746), sun: new Ee(16773848), fog: new Ee(10469320) }),
        (this.envTgt = { sky: new Ee(), gnd: new Ee(), sun: new Ee(), fog: new Ee(), sunI: 2.4 }),
        this.resize(),
        addEventListener("resize", () => this.resize()));
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
        (this.bloom.enabled = !i),
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
      (this.r.setPixelRatio(i),
        this.r.setSize(e, t, !1),
        this.composer.setPixelRatio(i),
        this.composer.setSize(e, t),
        this.bloom.resolution.set(e / 2, t / 2),
        (this.w = e),
        (this.h = t));
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
        t &&
          (this.envCur.sky.copy(this.envTgt.sky),
          this.envCur.gnd.copy(this.envTgt.gnd),
          this.envCur.sun.copy(this.envTgt.sun),
          this.envCur.fog.copy(this.envTgt.fog)));
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
        this.scene.background.copy(this.scene.fog.color),
        (this.r.toneMappingExposure = 1.15 + c * 0.25));
      for (let f of this.pool)
        f.userData.life > 0 &&
          ((f.userData.life -= e),
          (f.intensity = f.userData.life > 0 ? f.userData.base * (f.userData.life / f.userData.max) : 0));
      ((this.finalPass.uniforms.uTime.value = (this.finalPass.uniforms.uTime.value + e) % 100),
        (this.finalPass.uniforms.uVig.value = 0.35 + c * 0.5 + d * 0.25));
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
      this.quality === "low" && !this.bloom.enabled ? this.composer.render() : this.composer.render();
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


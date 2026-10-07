// 05-particles.js — Sistema de partículas / FX instanciado

// ════════ [324] VariableDeclaration Ad,cs,sn,vn,yn,an,si,Sd,vw,Td,Rd (10379 bytes) ════════
var Ad = class {
    constructor(e, t, i) {
      ((this.cap = t), (this.n = 0));
      let s = new $t();
      ((this.pos = new Float32Array(t * 3)),
        (this.col = new Float32Array(t * 3)),
        (this.size = new Float32Array(t)),
        (this.alpha = new Float32Array(t)),
        s.setAttribute("position", new St(this.pos, 3).setUsage(lr)),
        s.setAttribute("color", new St(this.col, 3).setUsage(lr)),
        s.setAttribute("size", new St(this.size, 1).setUsage(lr)),
        s.setAttribute("alpha", new St(this.alpha, 1).setUsage(lr)),
        (this.vel = new Float32Array(t * 3)),
        (this.life = new Float32Array(t)),
        (this.max = new Float32Array(t)),
        (this.grav = new Float32Array(t)),
        (this.drag = new Float32Array(t)),
        (this.s0 = new Float32Array(t)),
        (this.s1 = new Float32Array(t)),
        (this.c0 = new Float32Array(t * 3)),
        // color final: la partícula pasa de c0 a c1 durante su vida (bola de fuego blanco-amarilla → rojo oscuro)
        (this.c1 = new Float32Array(t * 3)),
        (this.mat = new wn({
          uniforms: { map: { value: cr() }, uScale: { value: 30 } },
          vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale; gl_Position=projectionMatrix*mv; }`,
          fragmentShader:
            "uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA); }",
          transparent: !0,
          depthWrite: !1,
          blending: i ? en : Wi,
          toneMapped: !1,
        })),
        (this.points = new ro(s, this.mat)),
        (this.points.frustumCulled = !1),
        (this.points.renderOrder = i ? 5 : 4),
        (this.geo = s),
        e.add(this.points));
    }
    add(e, t, i, s, a, r, o, l, c, d, h, f, u = 0, p = 0, d1 = d, h1 = h, f1 = f) {
      if (this.n >= this.cap) return;
      let m = this.n++;
      ((this.pos[m * 3] = e),
        (this.pos[m * 3 + 1] = t),
        (this.pos[m * 3 + 2] = i),
        (this.vel[m * 3] = s),
        (this.vel[m * 3 + 1] = a),
        (this.vel[m * 3 + 2] = r),
        (this.life[m] = o),
        (this.max[m] = o),
        (this.s0[m] = l),
        (this.s1[m] = c),
        (this.c0[m * 3] = d),
        (this.c0[m * 3 + 1] = h),
        (this.c0[m * 3 + 2] = f),
        (this.c1[m * 3] = d1),
        (this.c1[m * 3 + 1] = h1),
        (this.c1[m * 3 + 2] = f1),
        (this.grav[m] = u),
        (this.drag[m] = p));
    }
    update(e) {
      let t = 0;
      for (; t < this.n;) {
        if (((this.life[t] -= e), this.life[t] <= 0)) {
          this.swap(t, --this.n);
          continue;
        }
        let i = 1 - this.life[t] / this.max[t],
          s = Math.max(0, 1 - this.drag[t] * e);
        ((this.vel[t * 3] *= s),
          (this.vel[t * 3 + 2] *= s),
          (this.vel[t * 3 + 1] = this.vel[t * 3 + 1] * s - this.grav[t] * e),
          (this.pos[t * 3] += this.vel[t * 3] * e),
          (this.pos[t * 3 + 1] += this.vel[t * 3 + 1] * e),
          (this.pos[t * 3 + 2] += this.vel[t * 3 + 2] * e),
          this.pos[t * 3 + 1] < 0.02 &&
            this.grav[t] > 0 &&
            ((this.pos[t * 3 + 1] = 0.02),
            (this.vel[t * 3 + 1] *= -0.3),
            (this.vel[t * 3] *= 0.6),
            (this.vel[t * 3 + 2] *= 0.6)),
          (this.size[t] = this.s0[t] + (this.s1[t] - this.s0[t]) * i),
          (this.alpha[t] = Math.min(1, (1 - i) * 1.6)),
          (this.col[t * 3] = this.c0[t * 3] + (this.c1[t * 3] - this.c0[t * 3]) * i),
          (this.col[t * 3 + 1] = this.c0[t * 3 + 1] + (this.c1[t * 3 + 1] - this.c0[t * 3 + 1]) * i),
          (this.col[t * 3 + 2] = this.c0[t * 3 + 2] + (this.c1[t * 3 + 2] - this.c0[t * 3 + 2]) * i),
          t++);
      }
      if ((this.geo.setDrawRange(0, this.n), !(this.n === 0 && this._lastN === 0))) {
        this._lastN = this.n;
        for (let i of ["position", "color", "size", "alpha"]) {
          let s = this.geo.attributes[i];
          (s.clearUpdateRanges(), s.addUpdateRange(0, Math.max(1, this.n) * s.itemSize), (s.needsUpdate = !0));
        }
      }
    }
    swap(e, t) {
      if (e !== t) {
        for (let i of [this.pos, this.vel, this.c0, this.c1]) for (let s = 0; s < 3; s++) i[e * 3 + s] = i[t * 3 + s];
        for (let i of [this.life, this.max, this.s0, this.s1, this.grav, this.drag]) i[e] = i[t];
      }
    }
  },
  cs = class {
    constructor(e, t, i, s) {
      ((this.mesh = new ys(t, i, s)),
        this.mesh.instanceMatrix.setUsage(lr),
        (this.mesh.instanceColor = new Vs(new Float32Array(s * 3), 3).setUsage(lr)),
        (this.mesh.frustumCulled = !1),
        (this.mesh.count = 0),
        (this.cap = s),
        (this.n = 0),
        e.add(this.mesh));
    }
    begin() {
      this.n = 0;
    }
    push(e, t) {
      this.n >= this.cap ||
        (this.mesh.setMatrixAt(this.n, e), this.mesh.instanceColor.setXYZ(this.n, t.r, t.g, t.b), this.n++);
    }
    end() {
      ((this.mesh.count = this.n),
        (this.mesh.instanceMatrix.needsUpdate = !0),
        this.mesh.instanceColor && (this.mesh.instanceColor.needsUpdate = !0));
    }
  },
  sn = new at(),
  vn = new Bn(),
  yn = new U(),
  an = new U(),
  si = new Ee(),
  Sd = new va(),
  vw = new U(0, 1, 0),
  Td = new U(),
  Sw = new Ee(16777215),
  Rd = class {
    constructor(e, t) {
      ((this.scene = e), (this.R = t), (this.add = new Ad(e, 6e3, !0)), (this.norm = new Ad(e, 2500, !1)));
      let i = (r = {}) => new vt({ toneMapped: !1, ...r }),
        s = new kn(1, 1, 1);
      ((this.tracer = new cs(e, s, i(), 1200)),
        (this.orb = new cs(e, new ya(0.5, 1), i(), 800)),
        (this.orbGlow = new cs(e, new Pi(1, 1), i({ map: cr(), transparent: !0, blending: en, depthWrite: !1 }), 800)),
        (this.dark = new cs(
          e,
          new ni(0.5, 0.5, 1, 6),
          new Xt({ color: 16777215, roughness: 0.5, metalness: 0.4 }),
          200,
        )),
        (this.disc = new cs(e, new ni(0.5, 0.5, 0.08, 12), i(), 200)),
        (this.beamP = new cs(e, s, i({ transparent: !0, blending: en, depthWrite: !1 }), 800)));
      let a = new Pi(1, 1);
      (a.rotateX(-Math.PI / 2),
        (this.tele = new cs(e, a, i({ map: Ys(), transparent: !0, blending: en, depthWrite: !1 }), 200)),
        (this.teleFill = new cs(
          e,
          a,
          i({ map: cr(), transparent: !0, blending: en, depthWrite: !1, opacity: 0.5 }),
          200,
        )),
        (this.decalP = new cs(e, a, new td({ map: cr(), transparent: !0, depthWrite: !1, opacity: 0.7 }), 260)),
        (this.orbGlow.mesh.renderOrder = 6),
        (this.beamP.mesh.renderOrder = 6),
        // capas nuevas (engine/fx.js): una llamada de dibujo para todas las cintas y otra para todo lo pintado en el suelo
        (this.streaks = new CkStreakBatch(e, 2600)),
        (this.ground = new CkGroundBatch(e, 320)),
        (this.sparks = new CkSparkPool(this.streaks)),
        (this._c = [0, 0, 0]),
        (this._frozen = !1),
        (this.beams = []),
        (this.teles = []),
        (this.decals = []),
        (this.texts = []),
        (this.rings = []),
        (this.ringMesh = []));
    }
    burst(e, t, i, s, a = {}) {
      let r = a.add === !1 ? this.norm : this.add;
      si.setHex(a.color ?? 16777215);
      let o = a.speed ?? 4,
        l = a.life ?? 0.5,
        c = a.size ?? 0.25;
      for (let d = 0; d < s; d++) {
        let h = Q() * Math.PI * 2,
          f = a.up ?? 0.5,
          u = o * (0.3 + Q() * 0.7),
          p = Math.cos(h) * u,
          m = Math.sin(h) * u,
          g = (Q() * f + (a.upMin ?? 0)) * o;
        if (a.dir) {
          let v = a.dir + (Q() - 0.5) * (a.spread ?? 0.8);
          ((p = Math.cos(v) * u), (m = Math.sin(v) * u));
        }
        let b = a.vary ?? 0.15,
          y = 1 + (Q() - 0.5) * b;
        r.add(
          e + (Q() - 0.5) * (a.jit ?? 0.1),
          t,
          i + (Q() - 0.5) * (a.jit ?? 0.1),
          p,
          g,
          m,
          l * (0.6 + Q() * 0.6),
          c,
          a.size1 ?? c * 0.2,
          si.r * y,
          si.g * y,
          si.b * y,
          a.grav ?? 0,
          a.drag ?? 2,
        );
      }
    }
    // quality low: menos chispas y sin capas caras
    get lowQ() {
      return this.R.quality === "low";
    }
    hit(e, t, i, s, a) {
      // chispas estiradas que rebotan contra la dirección del disparo + destello breve en el punto de impacto
      let r = CkHot(s, 2.2, this._c),
        o = this.lowQ ? 3 : 6,
        l = a !== void 0 ? a + Math.PI : 0;
      for (let c = 0; c < o; c++) {
        let d = a !== void 0 ? l + (Q() - 0.5) * 2.2 : Q() * 6.283,
          h = 4 + Q() * 8;
        this.sparks.spark(e, t, i, Math.sin(d) * h, 1 + Q() * 3.5, Math.cos(d) * h, 0.16 + Q() * 0.16, 0.55, 0.032, r[0], r[1], r[2], 16, 1.1);
      }
      (this.add.add(e, t, i, 0, 0, 0, 0.07, 0.42, 0.1, 0.5 + r[0] * 0.5, 0.5 + r[1] * 0.5, 0.5 + r[2] * 0.5, 0, 0),
        this.burst(e, t, i, 2, { color: s, speed: 2.5, life: 0.2, size: 0.16, dir: a !== void 0 ? l : void 0, spread: 1.4, up: 0.3 }));
    }
    blood(e, t, i, s = 8) {
      this.burst(e, 0.6, t, s, { color: i, add: !1, speed: 3.5, life: 0.6, size: 0.2, grav: 9, up: 1.2, drag: 1 });
    }
    explosion(e, t, i, s = 16747040) {
      // capas: destello blanco → bola de fuego con degradado (crece mientras se enfría) → onda de choque + charco de luz → chispas → brasas → humo
      // las partículas aditivas se apilan: cada una lleva poca intensidad y el núcleo es pequeño, o el bloom lo quema todo
      let a = Math.sqrt(i),
        r = this.lowQ,
        o = CkHot(s, 1.35, this._c),
        l = o[0],
        c = o[1],
        d = o[2];
      this.add.add(e, 0.7, t, 0, 0, 0, 0.1, 0.8 * a, 1.9 * a, 2.6, 2.2, 1.6, 0, 0);
      let h = Math.round((r ? 10 : 16) + i * (r ? 3 : 6));
      for (let f = 0; f < h; f++) {
        let u = Q() * 6.283,
          p = 6 * i * (0.2 + Q() * 0.8),
          m = (0.15 + Q() * 0.5) * 6 * a;
        this.add.add(e + (Q() - 0.5) * 0.3, 0.4 + Q() * 0.5, t + (Q() - 0.5) * 0.3, Math.cos(u) * p, m, Math.sin(u) * p, 0.5 + Q() * 0.4, (0.5 + Q() * 0.3) * a, (1.1 + Q() * 0.6) * a, l, c, d, 0, 3.2, l * 0.2, c * 0.04, d * 0.015);
      }
      for (let f = 0, u = r ? 3 : 6; f < u; f++) {
        let p = Q() * 6.283,
          m = 2 * i * Q();
        this.add.add(e, 0.6, t, Math.cos(p) * m, 2 + Q() * 2, Math.sin(p) * m, 0.28 + Q() * 0.12, 0.6 * a, 1.2 * a, 1.9, 1.5, 0.8, 0, 4, 0.9, 0.3, 0.07);
      }
      this.ring(e, t, i * 1.5, s, 0.5, 1);
      r || this.ring(e, t, i * 2, s, 0.5, 2);
      for (let f = 0, u = (r ? 8 : 14) + Math.round(i * 5); f < u; f++) {
        let p = Q() * 6.283,
          m = (6 + Q() * 10) * a;
        this.sparks.spark(e, 0.5, t, Math.cos(p) * m, 3 + Q() * 9, Math.sin(p) * m, 0.5 + Q() * 0.5, 0.65, 0.035, 2.6, 1.6, 0.5, 15, 0.7);
      }
      for (let f = 0, u = r ? 3 : 7; f < u; f++) {
        let p = Q() * 6.283,
          m = 1.5 + Q() * 2.5 * i;
        this.add.add(e, 0.5, t, Math.cos(p) * m, 1.5 + Q() * 2.5, Math.sin(p) * m, 0.9 + Q() * 0.7, 0.14, 0.03, 2.4, 0.9, 0.2, -0.6, 1.2);
      }
      for (let f = 0, u = Math.round((r ? 4 : 9) + i * 4); f < u; f++) {
        let p = Q() * 6.283,
          m = 2.2 * i * (0.3 + Q() * 0.7);
        this.norm.add(e + (Q() - 0.5) * 0.4, 0.5, t + (Q() - 0.5) * 0.4, Math.cos(p) * m, 1.2 + Q() * 1.6, Math.sin(p) * m, 1.1 + Q() * 0.8, (0.8 + Q() * 0.4) * a, 1.9 * a, 0.2, 0.18, 0.17, -0.4, 1.6, 0.05, 0.05, 0.055);
      }
      (this.decal(e, t, i * 0.9, 1118481, 0.7),
        this.R.flashLight(e, 1.3, t, s, 6 * a, 3 + i * 1.3, 0.28),
        this.R.addShake(0.1 + i * 0.08));
    }
    muzzle(e, t, i, s, a = 16765562, r = 1) {
      // fogonazo con forma: aguja central + dos laterales (estrella), destello esférico, chispas expulsadas y luz breve
      let o = CkHot(a, 3.6, this._c),
        l = Math.sin(s),
        c = Math.cos(s);
      (this.sparks.spike(e, t, i, l, 0, c, 0.075, 1.15 * r, 0.17 * r, o[0], o[1], o[2]),
        this.sparks.spike(e, t, i, Math.sin(s + 0.5), 0, Math.cos(s + 0.5), 0.06, 0.62 * r, 0.1 * r, o[0] * 0.8, o[1] * 0.8, o[2] * 0.8),
        this.sparks.spike(e, t, i, Math.sin(s - 0.5), 0, Math.cos(s - 0.5), 0.06, 0.62 * r, 0.1 * r, o[0] * 0.8, o[1] * 0.8, o[2] * 0.8),
        this.add.add(e + l * 0.12, t, i + c * 0.12, 0, 0, 0, 0.06, 0.95 * r, 0.3 * r, 3.4, 2.9, 2.1, 0, 0));
      for (let d = 0, h = this.lowQ ? 1 : 3; d < h; d++) {
        let f = s + (Q() - 0.5) * 0.9,
          u = 7 + Q() * 7;
        this.sparks.spark(e, t, i, Math.sin(f) * u, Q() * 2.5, Math.cos(f) * u, 0.16 + Q() * 0.1, 0.4, 0.028, o[0], o[1], o[2], 10, 1.6);
      }
      this.R.flashLight(e, t + 0.3, i, a, 1.6 * r, 4.5, 0.06);
    }
    smoke(e, t, i, s = 1, a = 5591112, r = 0.4) {
      this.burst(e, t, i, s, { color: a, add: !1, speed: 0.5, life: 0.9, size: r, size1: r * 2.2, up: 1, drag: 1.5 });
    }
    flame(e, t, i, s, a) {
      let r = a < 0.12;
      (this.burst(e, t, i, 1, {
        color: r ? 12085802 : Q() < 0.5 ? 9057552 : 10504724,
        speed: 0.6,
        life: 0.32,
        size: s * 0.8,
        size1: 0.05,
        up: 1.2,
        upMin: 0.3,
        drag: 1.5,
        jit: s * 0.3,
      }),
        a > 0.18 &&
          Q() < 0.35 &&
          this.burst(e, t + 0.2, i, 1, {
            add: !1,
            color: 2761760,
            speed: 0.4,
            life: 0.6,
            size: s * 0.9,
            size1: s * 1.4,
            up: 2,
            upMin: 0.8,
            drag: 1,
          }));
    }
    fire(e, t, i, s = 1, a = 0.35) {
      this.burst(e, t, i, s, {
        color: Q() < 0.5 ? 16742944 : 16760896,
        speed: 0.8,
        life: 0.45,
        size: a,
        size1: 0.05,
        up: 2,
        upMin: 0.6,
        drag: 1,
      });
    }
    // kind 0 anillo clásico (se pinta como onda de choque) · 1 onda de choque · 2 charco de luz
    ring(e, t, i, s, a = 0.4, r = 1) {
      this.rings.length > 80 && this.rings.shift();
      this.rings.push({ x: e, z: t, r: i, color: s, life: a, max: a, kind: r });
    }
    // halo fijo en el suelo (botín): se vuelve a emitir cada fotograma
    halo(e, t, i, s, a = 1, r = 2) {
      let o = CkHot(s, 1.4, this._c);
      this.ground.push(r, e, 0.05, t, i, o[0], o[1], o[2], a, 0);
    }
    // pulso que sale del centro (botín raro): p = 0..1
    pulse(e, t, i, s, a, r) {
      let o = CkHot(s, 1.2, this._c);
      this.ground.push(1, e, 0.05, t, i, o[0], o[1], o[2], a, r, 0.7);
    }
    decal(e, t, i, s, a = 0.7) {
      (this.decals.length > 240 && this.decals.shift(),
        this.decals.push({ x: e, z: t, r: i, color: s, life: 22, rot: Q() * 6 }));
    }
    beam(e, t, i, s, a, r, o, l = 0.12, c = 0.1) {
      this.beams.push({ x1: e, y1: t, z1: i, x2: s, y2: a, z2: r, color: o, w: l, life: c, max: c });
    }
    zap(e, t, i, s, a = 9426175, r = 1) {
      // rayo con ramas: camino quebrado + bifurcaciones finas, chispas en el extremo y luz breve
      let o = e,
        l = t,
        c = r,
        d = this.lowQ ? 5 : 8,
        h = i - e,
        f = s - t,
        u = Math.hypot(h, f) || 1,
        p = -f / u,
        m = h / u,
        g = Math.min(0.9, 0.3 + u * 0.06);
      for (let b = 1; b <= d; b++) {
        let y = b / d,
          v = e + h * y,
          _ = t + f * y,
          A = r + (Q() - 0.5) * 0.3;
        if (b < d) {
          let T = (Q() - 0.5) * g * 2;
          ((v += p * T), (_ += m * T));
        }
        if ((this.beam(o, c, l, v, A, _, a, 0.075, 0.15), b < d && !this.lowQ && Q() < 0.5)) {
          let T = Math.atan2(f, h) + (Q() - 0.5) * 2.4,
            S = 0.7 + Q() * 1.1;
          this.beam(v, A, _, v + Math.cos(T) * S, A + (Q() - 0.5) * 0.3, _ + Math.sin(T) * S, a, 0.04, 0.11);
        }
        ((o = v), (c = A), (l = _));
      }
      let w = CkHot(a, 2.6, this._c);
      for (let b = 0, y = this.lowQ ? 2 : 4; b < y; b++) {
        let v = Q() * 6.283,
          _ = 3 + Q() * 5;
        this.sparks.spark(i, r, s, Math.cos(v) * _, 1 + Q() * 3, Math.sin(v) * _, 0.14 + Q() * 0.12, 0.4, 0.026, w[0], w[1], w[2], 12, 1.4);
      }
      (this.add.add(i, r, s, 0, 0, 0, 0.1, 0.9, 0.25, w[0] * 1.2, w[1] * 1.2, w[2] * 1.2, 0, 0),
        this.R.flashLight((e + i) / 2, r + 0.4, (t + s) / 2, a, 2.4, 6.5, 0.1));
    }
    telegraph(e, t, i, s, a = 16719904) {
      let r = { x: e, z: t, r: i, life: s, max: s, color: a };
      return (this.teles.push(r), r);
    }
    text(e, t, i, s, a = "#fff", r = 14, o = {}) {
      (this.texts.length > 120 && this.texts.shift(),
        this.texts.push({
          x: e + (Q() - 0.5) * 0.4,
          y: t,
          z: i + (Q() - 0.5) * 0.4,
          txt: s,
          color: a,
          size: r,
          life: o.life ?? 0.9,
          max: o.life ?? 0.9,
          vy: o.vy ?? 1.6,
          crit: !!o.crit,
        }));
    }
    beginFrame() {
      // en pausa se conservan cintas y formas del suelo del último fotograma (nadie las vuelve a emitir)
      ((this._frozen = !!x.paused), this._frozen || ((this.streaks.n = 0), this.ground.begin()));
      this._frozen || (this.tracer.begin(), this.orb.begin(), this.orbGlow.begin(), this.dark.begin(), this.disc.begin());
    }
    drawTracer(e, t, i, s, a, r, o, l) {
      // trazador: cabeza casi blanca (HDR) y cola degradada con el color del proyectil; los gruesos llevan un halo
      let c = Math.hypot(s, a) || 1,
        d = s / c,
        h = a / c,
        f = CkHot(l, 1.9, this._c);
      (this.streaks.push(e + d * r * 0.5, t, i + h * r * 0.5, d, 0, h, r * 2.2, Math.max(0.05, o * 1.3), f[0], f[1], f[2], 1),
        o >= 0.075 && this.drawGlow(e + d * r * 0.5, t, i + h * r * 0.5, 0.7 + o * 3, l));
    }
    drawOrb(e, t, i, s, a) {
      (vn.identity(),
        yn.set(e, t, i),
        an.set(s, s, s),
        sn.compose(yn, vn, an),
        this.orb.push(sn, si.setHex(a).multiplyScalar(1.4)),
        vn.copy(this.R.camera.quaternion),
        an.set(s * 4.4, s * 4.4, 1),
        sn.compose(yn, vn, an),
        this.orbGlow.push(sn, si.setHex(a).multiplyScalar(0.4)));
    }
    drawGlow(e, t, i, s, a) {
      (vn.copy(this.R.camera.quaternion),
        yn.set(e, t, i),
        an.set(s, s, 1),
        sn.compose(yn, vn, an),
        this.orbGlow.push(sn, si.setHex(a).multiplyScalar(1)));
    }
    drawRocket(e, t, i, s, a, r, o = 0.12) {
      let l = Math.atan2(s, a);
      if (
        (vn.setFromEuler(Sd.set(Math.PI / 2, l, 0, "YXZ")),
        yn.set(e, t, i),
        an.set(o * 1.6, o * 5, o * 1.6),
        sn.compose(yn, vn, an),
        this.dark.push(sn, si.setHex(r)),
        !(s === 0 && a === 1))
      ) {
        // estela de cohete: llama naranja larga con núcleo caliente + chispas de escape (las granadas no llevan: su dirección es fija)
        let c = Math.sin(l),
          d = Math.cos(l);
        (this.streaks.push(e - c * o * 2, t, i - d * o * 2, c, 0, d, 1.3 + o * 6, o * 1.1, 3.2, 1.35, 0.3, 0.95),
          this.streaks.push(e - c * o * 2, t, i - d * o * 2, c, 0, d, 0.5 + o * 2, o * 0.55, 4, 3.4, 2.4, 1),
          Q() < 0.6 &&
            this.sparks.spark(e - c * o * 3, t, i - d * o * 3, -c * 3 + (Q() - 0.5) * 2, Q() * 1.5, -d * 3 + (Q() - 0.5) * 2, 0.3, 0.3, 0.025, 3, 1.3, 0.3, 2, 1.5));
      }
    }
    drawDisc(e, t, i, s, a, r) {
      (vn.setFromEuler(Sd.set(0, a, 0)),
        yn.set(e, t, i),
        an.set(s, 1, s),
        sn.compose(yn, vn, an),
        this.disc.push(sn, si.setHex(r)));
    }
    update(e) {
      ((CkFxTime.value = (CkFxTime.value + e) % 1e3), (CkClock.value = (CkClock.value + e) % 1e3));
      this._frozen || this.sparks.update(e);
      (this.add.update(e), this.norm.update(e));
      let t = this.R.pxPerUnit * this.R.r.getPixelRatio();
      ((this.add.mat.uniforms.uScale.value = t),
        (this.norm.mat.uniforms.uScale.value = t),
        this.tracer.end(),
        this.orb.end(),
        this.orbGlow.end(),
        this.dark.end(),
        this.disc.end(),
        this.beamP.begin());
      for (let i = this.beams.length - 1; i >= 0; i--) {
        let s = this.beams[i];
        if (((s.life -= e), s.life <= 0)) {
          this.beams.splice(i, 1);
          continue;
        }
        let a = s.life / s.max;
        Td.set(s.x2 - s.x1, s.y2 - s.y1, s.z2 - s.z1);
        let r = Td.length();
        (Td.normalize(),
          vn.setFromUnitVectors(vw, Td),
          yn.set((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, (s.z1 + s.z2) / 2),
          an.set(s.w * (0.4 + a * 0.6), r, s.w * (0.4 + a * 0.6)),
          sn.compose(yn, vn, an),
          this.beamP.push(sn, si.setHex(s.color).multiplyScalar(1.4 + a * 2)),
          an.set(s.w * 0.34 * (0.5 + a), r, s.w * 0.34 * (0.5 + a)),
          sn.compose(yn, vn, an),
          this.beamP.push(sn, si.setHex(s.color).lerp(Sw, 0.7).multiplyScalar(0.4 + a * 2.4)),
          an.set(s.w * 3.4 * a, r, s.w * 3.4 * a),
          sn.compose(yn, vn, an),
          this.beamP.push(sn, si.setHex(s.color).multiplyScalar(0.4 * a)));
      }
      (this.beamP.end(), this.tele.begin(), this.teleFill.begin(), vn.identity());
      let gp = !this._frozen;
      for (let i = this.teles.length - 1; i >= 0; i--) {
        let s = this.teles[i];
        if (((s.life -= e), s.life <= 0)) {
          this.teles.splice(i, 1);
          continue;
        }
        // telegrafo en el suelo con shader: borde nítido, relleno que crece hasta el impacto y rayas de peligro
        if (gp) {
          let a = CkHot(s.color, 1.1, this._c);
          this.ground.push(0, s.x, 0.06, s.z, s.r, a[0], a[1], a[2], 1, 1 - s.life / s.max);
        }
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        let s = this.rings[i];
        if (((s.life -= e), s.life <= 0)) {
          this.rings.splice(i, 1);
          continue;
        }
        if (gp) {
          let a = CkHot(s.color, 1.2, this._c);
          this.ground.push(s.kind === 2 ? 2 : 1, s.x, 0.08, s.z, s.r, a[0], a[1], a[2], 1, 1 - s.life / s.max, 1);
        }
      }
      (this.tele.end(), this.teleFill.end(), gp && (this.ground.end(), this.streaks.flush()), this.decalP.begin());
      for (let i = this.decals.length - 1; i >= 0; i--) {
        let s = this.decals[i];
        if (((s.life -= e), s.life <= 0)) {
          this.decals.splice(i, 1);
          continue;
        }
        let a = Math.min(1, s.life / 3);
        (vn.setFromEuler(Sd.set(0, s.rot, 0)),
          yn.set(s.x, 0.025 + (i % 10) * 5e-4, s.z),
          an.set(s.r * 2 * a, 1, s.r * 2 * a),
          sn.compose(yn, vn, an),
          this.decalP.push(sn, si.setHex(s.color)));
      }
      this.decalP.end();
      for (let i = this.texts.length - 1; i >= 0; i--) {
        let s = this.texts[i];
        ((s.life -= e), (s.y += s.vy * e), (s.vy *= 0.95), s.life <= 0 && this.texts.splice(i, 1));
      }
    }
    clear() {
      ((this.add.n = 0),
        (this.norm.n = 0),
        (this.beams.length = 0),
        (this.teles.length = 0),
        (this.decals.length = 0),
        (this.texts.length = 0),
        (this.rings.length = 0),
        (this.tracer.n = this.orb.n = this.orbGlow.n = this.dark.n = this.disc.n = 0),
        this.sparks.clear(),
        (this.streaks.n = 0),
        this.streaks.flush(),
        this.ground.begin(),
        this.ground.end());
    }
  };


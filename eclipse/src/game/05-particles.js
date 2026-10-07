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
        (this.beamP = new cs(e, s, i({ transparent: !0, blending: en, depthWrite: !1 }), 400)));
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
    hit(e, t, i, s, a) {
      this.burst(e, t, i, 6, {
        color: s,
        speed: 6,
        life: 0.25,
        size: 0.18,
        dir: a !== void 0 ? a + Math.PI : void 0,
        spread: 1.6,
        up: 0.4,
      });
    }
    blood(e, t, i, s = 8) {
      this.burst(e, 0.6, t, s, { color: i, add: !1, speed: 3.5, life: 0.6, size: 0.2, grav: 9, up: 1.2, drag: 1 });
    }
    explosion(e, t, i, s = 16747040) {
      (this.burst(e, 0.5, t, Math.round(28 + i * 10), {
        color: s,
        speed: 7 * i,
        life: 0.55,
        size: 0.9 * Math.sqrt(i),
        size1: 0.1,
        up: 0.6,
        drag: 3.5,
      }),
        this.burst(e, 0.5, t, Math.round(10 + i * 4), {
          color: 16769184,
          speed: 4 * i,
          life: 0.3,
          size: 1.1 * Math.sqrt(i),
          size1: 0.2,
          up: 0.4,
          drag: 4,
        }),
        this.burst(e, 0.6, t, Math.round(10 + i * 5), {
          color: 2762276,
          add: !1,
          speed: 2.5 * i,
          life: 1.4,
          size: 0.9 * Math.sqrt(i),
          size1: 1.6 * Math.sqrt(i),
          up: 0.5,
          upMin: 0.2,
          drag: 2,
        }),
        this.burst(e, 0.3, t, 12, {
          color: 16760928,
          speed: 10,
          life: 0.6,
          size: 0.08,
          size1: 0.05,
          grav: 14,
          up: 1.5,
          drag: 0.5,
        }),
        this.ring(e, t, i * 1.1, s, 0.35),
        this.decal(e, t, i * 0.9, 1118481, 0.7),
        this.R.flashLight(e, 1.5, t, s, 6 * Math.sqrt(i), 4 + i * 2.5, 0.25),
        this.R.addShake(0.12 + i * 0.06));
    }
    muzzle(e, t, i, s, a = 16765562, r = 1) {
      (this.burst(e, t, i, 3, {
        color: a,
        speed: 5,
        life: 0.07,
        size: 0.35 * r,
        size1: 0.05,
        dir: s,
        spread: 0.6,
        up: 0.1,
      }),
        this.R.flashLight(e, t + 0.3, i, a, 2.2 * r, 4.5, 0.05));
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
    ring(e, t, i, s, a = 0.4) {
      this.rings.push({ x: e, z: t, r: i, color: s, life: a, max: a });
    }
    decal(e, t, i, s, a = 0.7) {
      (this.decals.length > 240 && this.decals.shift(),
        this.decals.push({ x: e, z: t, r: i, color: s, life: 22, rot: Q() * 6 }));
    }
    beam(e, t, i, s, a, r, o, l = 0.12, c = 0.1) {
      this.beams.push({ x1: e, y1: t, z1: i, x2: s, y2: a, z2: r, color: o, w: l, life: c, max: c });
    }
    zap(e, t, i, s, a = 9426175, r = 1) {
      let l = e,
        c = t;
      for (let d = 1; d <= 5; d++) {
        let h = d / 5,
          f = e + (i - e) * h,
          u = t + (s - t) * h;
        (d < 5 && ((f += (Q() - 0.5) * 0.6), (u += (Q() - 0.5) * 0.6)),
          this.beam(l, r + (Q() - 0.5) * 0.2, c, f, r + (Q() - 0.5) * 0.2, u, a, 0.07, 0.12),
          (l = f),
          (c = u));
      }
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
      (this.tracer.begin(), this.orb.begin(), this.orbGlow.begin(), this.dark.begin(), this.disc.begin());
    }
    drawTracer(e, t, i, s, a, r, o, l) {
      let c = Math.atan2(s, a);
      (vn.setFromEuler(Sd.set(0, c, 0)),
        yn.set(e - Math.sin(c) * r * 0.5, t, i - Math.cos(c) * r * 0.5),
        an.set(o, o, r),
        sn.compose(yn, vn, an),
        this.tracer.push(sn, si.setHex(l)));
    }
    drawOrb(e, t, i, s, a) {
      (vn.identity(),
        yn.set(e, t, i),
        an.set(s, s, s),
        sn.compose(yn, vn, an),
        this.orb.push(sn, si.setHex(a)),
        vn.copy(this.R.camera.quaternion),
        an.set(s * 4, s * 4, 1),
        sn.compose(yn, vn, an),
        this.orbGlow.push(sn, si.setHex(a).multiplyScalar(0.3)));
    }
    drawGlow(e, t, i, s, a) {
      (vn.copy(this.R.camera.quaternion),
        yn.set(e, t, i),
        an.set(s, s, 1),
        sn.compose(yn, vn, an),
        this.orbGlow.push(sn, si.setHex(a).multiplyScalar(0.6)));
    }
    drawRocket(e, t, i, s, a, r, o = 0.12) {
      let l = Math.atan2(s, a);
      (vn.setFromEuler(Sd.set(Math.PI / 2, l, 0, "YXZ")),
        yn.set(e, t, i),
        an.set(o * 1.6, o * 5, o * 1.6),
        sn.compose(yn, vn, an),
        this.dark.push(sn, si.setHex(r)));
    }
    drawDisc(e, t, i, s, a, r) {
      (vn.setFromEuler(Sd.set(0, a, 0)),
        yn.set(e, t, i),
        an.set(s, 1, s),
        sn.compose(yn, vn, an),
        this.disc.push(sn, si.setHex(r)));
    }
    update(e) {
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
          this.beamP.push(sn, si.setHex(s.color).multiplyScalar(0.5 + a)),
          an.set(s.w * 3 * a, r, s.w * 3 * a),
          sn.compose(yn, vn, an),
          this.beamP.push(sn, si.setHex(s.color).multiplyScalar(0.25 * a)));
      }
      (this.beamP.end(), this.tele.begin(), this.teleFill.begin(), vn.identity());
      for (let i = this.teles.length - 1; i >= 0; i--) {
        let s = this.teles[i];
        if (((s.life -= e), s.life <= 0)) {
          this.teles.splice(i, 1);
          continue;
        }
        let a = 1 - s.life / s.max;
        (yn.set(s.x, 0.06, s.z),
          an.set(s.r * 2, 1, s.r * 2),
          sn.compose(yn, vn, an),
          this.tele.push(sn, si.setHex(s.color).multiplyScalar(0.8)),
          an.set(s.r * 2 * a, 1, s.r * 2 * a),
          sn.compose(yn, vn, an),
          this.teleFill.push(sn, si.setHex(s.color).multiplyScalar(0.5 + a * 0.5)));
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        let s = this.rings[i];
        if (((s.life -= e), s.life <= 0)) {
          this.rings.splice(i, 1);
          continue;
        }
        let a = 1 - s.life / s.max;
        (yn.set(s.x, 0.1, s.z),
          an.set(s.r * 2 * (0.3 + a * 0.9), 1, s.r * 2 * (0.3 + a * 0.9)),
          sn.compose(yn, vn, an),
          this.tele.push(sn, si.setHex(s.color).multiplyScalar(1 - a)));
      }
      (this.tele.end(), this.teleFill.end(), this.decalP.begin());
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
        (this.rings.length = 0));
    }
  };


/**
 * World-level visual systems:
 *   GateCurtain  the shimmering resonance veil that seals the Empty Choir until its gate opens (and the gate leaves that slide)
 *   WeatherFx    weather → fog density/tint, wind strength, windstorm dust, rain streaks, wet ground
 *   AmbientFx    drifting pollen / fireflies, god-ray shafts, resonance beams, ground mist banks (all GPU-animated, quality gated)
 */
import * as THREE from 'three';
import { WORLD } from './atmosphere.js';
import { getNoiseTexture } from './noiseTex.js';

const TAU = Math.PI * 2;

// ───────────────────────────────────────────────────────── gate curtain
/** a wall of resonance that seals the Empty Choir until its gate opens */
export class GateCurtain {
  constructor(scene3d, zone, session) {
    this.s3 = scene3d; this.zone = zone; this.session = session; this.items = [];
    scene3d.session = session;                                   // lets world structures (waystones…) read story state
    for (const g of zone.def.gates ?? []) {
      const [cx, cz] = g.ellipse.c, [rx, rz] = g.ellipse.r, N = 240, pos = [], idx = [], uv = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TAU, x = cx + Math.sin(a) * rx, z = cz + Math.cos(a) * rz, y = zone.heightAt(x, z);
        pos.push(x, y - 0.8, z, x, y + 9.0, z); uv.push(i / N * 60, 0, i / N * 60, 1);
        if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uA: { value: new THREE.Color('#5fd8ff') }, uB: { value: new THREE.Color('#a98cff') }, uNoise: { value: getNoiseTexture() } },
        vertexShader: 'varying vec2 vUv; varying float vH; void main(){ vUv = uv; vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; varying float vH; uniform float uTime, uOpen; uniform vec3 uA, uB; uniform sampler2D uNoise;
          void main(){
            float h = vH;
            float flow = texture2D(uNoise, vec2(vUv.x * 0.22 + uTime * 0.015, h * 0.7 - uTime * 0.07)).r;
            float flow2 = texture2D(uNoise, vec2(vUv.x * 0.51 - uTime * 0.02, h * 1.3 - uTime * 0.11)).g;
            float harmonic = 0.5 + 0.5 * sin(vUv.x * 6.2831 * 1.0 + sin(h * 7.0 - uTime * 1.6) * 1.2 + uTime * 0.8);
            float strands = smoothstep(0.82, 1.0, sin(vUv.x * 6.2831 * 4.0 + flow * 5.0));
            float base = exp(-h * 13.0);                       // glow where the veil meets the ground
            float top = smoothstep(0.55, 1.0, h);
            float body = (0.05 + 0.2 * flow * flow2 + 0.07 * harmonic) * (1.0 - top);
            vec3 c = mix(uA, uB, harmonic * 0.8 + flow * 0.3);
            float a = (body + strands * 0.2 * (1.0 - top) + base * 0.55) * (1.0 - uOpen);
            if (a < 0.004) discard;
            gl_FragColor = vec4(c * (0.9 + base * 1.4), a); }`,
      });
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 15;
      scene3d.content.add(mesh);
      this.items.push({ id: g.id, mesh, mat, open: session.barrierOpen(g.id) ? 1 : 0 });
    }
  }
  update(dt, t) {
    for (const it of this.items) {
      it.mat.uniforms.uTime.value = t;
      const target = this.session.barrierOpen(it.id) ? 1 : 0;
      it.open += (target - it.open) * Math.min(1, dt * 1.6);
      it.mat.uniforms.uOpen.value = it.open;
      it.mesh.visible = it.open < 0.99;
    }
    // the Bell Gate's bronze leaves follow the barrier
    const open = this.items[0]?.open ?? 0;
    for (const s of this.s3.structures ?? []) if (s.userData.kind === 'gate_door') s.userData.setOpen?.(open);
  }
}

// ───────────────────────────────────────────────────────── rain
class RainFx {
  constructor(scene3d, count = 1400) {
    this.s3 = scene3d;
    const pos = new Float32Array(count * 6), seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      pos.set([x, y, z, x, y, z], i * 6); seed[i * 2] = seed[i * 2 + 1] = i;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array(count * 2).map((_, i) => i % 2), 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: WORLD.uTime, uFocus: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uWind: WORLD.uWind },
      vertexShader: `attribute float aEnd; uniform float uTime; uniform vec3 uFocus; uniform vec4 uWind; varying float vA;
        void main(){
          vec3 box = vec3(46.0, 26.0, 46.0);
          float speed = 24.0 + position.x * 6.0;
          float py = fract(position.y - uTime * speed / box.y);
          vec3 slant = vec3(uWind.x, 0.0, uWind.y) * (0.22 + 0.1 * uWind.z);
          vec3 w;
          w.x = mod(position.x * box.x + slant.x * (py - 0.5) * box.y * 0.3 - uFocus.x + box.x * 0.5, box.x) - box.x * 0.5 + uFocus.x;
          w.z = mod(position.z * box.z + slant.z * (py - 0.5) * box.y * 0.3 - uFocus.z + box.z * 0.5, box.z) - box.z * 0.5 + uFocus.z;
          w.y = uFocus.y - 4.0 + py * box.y;
          vec3 dir = normalize(vec3(-slant.x * 0.9, -1.0, -slant.z * 0.9));
          w += (-dir) * aEnd * 1.15;
          vA = (1.0 - aEnd * 0.8) * smoothstep(0.0, 0.08, py) * smoothstep(1.0, 0.85, py);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: 'varying float vA; uniform float uAmt; void main(){ gl_FragColor = vec4(vec3(0.72, 0.8, 0.9), vA * 0.42 * uAmt); }',
    });
    this.mesh = new THREE.LineSegments(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 12; this.mesh.visible = false;
    scene3d.scene.add(this.mesh);
    this.amt = 0;
  }
  update(dt, on, focus) {
    this.amt += ((on ? 1 : 0) - this.amt) * Math.min(1, dt * 1.6);
    this.mesh.visible = this.amt > 0.02;
    this.mat.uniforms.uAmt.value = this.amt;
    this.mat.uniforms.uFocus.value.set(focus.x, focus.y, focus.z);
    if (!this.mesh.parent) this.s3.scene.add(this.mesh);
  }
}

const FOG = {
  calm: { k: 1, tint: null, wind: 0.8, wet: 0 },
  mist: { k: 2.3, tint: '#d8e2ea', wind: 0.5, wet: 0.1 },
  windstorm: { k: 1.3, tint: '#c8b89c', wind: 2.4, wet: 0 },
  rain: { k: 1.9, tint: '#9aa7b4', wind: 1.4, wet: 1 },
};

/** fog density/colour, wind and wetness follow the weather; windstorms add dust streaks, rain adds streaks + darker ground */
export class WeatherFx {
  constructor(scene3d, particles) { this.s3 = scene3d; this.p = particles; this.k = 1; this.tint = new THREE.Color(); this.tintAmt = 0; this.acc = 0; this.type = 'calm'; this.dir = 0.7; this.wind = 0.8; this.wet = 0; this.force = null; this.rain = null; }
  update(dt, weather, focus) {
    const s3 = this.s3;
    if (!s3.baseFog || !s3.scene.fog) return;
    this.type = this.force ?? weather?.current ?? 'calm'; this.dir = weather?.dir ?? this.dir;
    const fx = FOG[this.type] ?? FOG.calm;
    const kk = Math.min(1, dt * 0.5);
    this.k += (fx.k - this.k) * kk;
    this.tintAmt += ((fx.tint ? 0.45 : 0) - this.tintAmt) * kk;
    if (fx.tint) this.tint.set(fx.tint);
    this.wind += (fx.wind - this.wind) * Math.min(1, dt * 0.6); this.wet += (fx.wet - this.wet) * Math.min(1, dt * 0.35);
    const f = s3.scene.fog, base = s3.baseFog;
    f.density = base.density * this.k;
    f.color.copy(base.color).lerp(this.tint, this.tintAmt);
    s3.scene.background?.copy?.(f.color); s3.renderer.setClearColor(f.color);
    s3.sky?.userData.setFog?.(f.color);
    WORLD.uWind.value.set(Math.sin(this.dir), Math.cos(this.dir), this.wind, this.type === 'windstorm' ? 0.35 : 0);
    WORLD.uWet.value = this.wet;
    if (this.type === 'rain' || this.rain) { this.rain ??= new RainFx(s3, s3.q.name === 'low' ? 500 : 1400); this.rain.update(dt, this.type === 'rain', focus); }
    if (this.type === 'windstorm' && this.p) {
      this.acc += dt * 38;
      while (this.acc >= 1) {
        this.acc -= 1;
        const a = Math.random() * TAU, r = 6 + Math.random() * 20;
        this.p.emit({ x: focus.x + Math.sin(a) * r, y: focus.y + 0.5 + Math.random() * 5, z: focus.z + Math.cos(a) * r, count: 1, color: '#e8dcc0', dirX: Math.sin(this.dir), dirZ: Math.cos(this.dir), cone: 0.25, speed: 16, up: 0.2, life: 0.8, size: 0.16, gravity: 0, drag: 0.2, alpha: 0.5, jitter: 0.1 });
      }
    }
  }
}

// ───────────────────────────────────────────────────────── ambient atmosphere
const MOTE_VERT = `attribute vec4 aSeed; uniform float uTime; uniform vec3 uFocus; uniform vec3 uBox; uniform float uSize, uSpeed, uRise, uScale; uniform vec4 uWind; varying float vA;
  void main(){
    vec3 s = aSeed.xyz; float k = aSeed.w;
    vec3 p = fract(s + vec3(uWind.x * 0.015, uRise, uWind.y * 0.015) * uTime * uSpeed * (0.5 + k)) ;
    p.x += sin(uTime * 0.6 + k * 20.0) * 0.015; p.z += cos(uTime * 0.5 + k * 17.0) * 0.015;
    vec3 w = uFocus + (fract(p + 0.5 - uFocus / uBox) - 0.5) * uBox;
    float edge = 1.0; vec3 q = (w - uFocus) / uBox; edge = (1.0 - smoothstep(0.3, 0.5, abs(q.x))) * (1.0 - smoothstep(0.3, 0.5, abs(q.z))) * (1.0 - smoothstep(0.35, 0.5, abs(q.y)));
    vA = edge * (0.55 + 0.45 * sin(uTime * (1.5 + k * 2.0) + k * 40.0));
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_PointSize = uSize * (0.6 + k) * uScale / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv; }`;
const MOTE_FRAG = 'varying float vA; uniform vec3 uColor; uniform float uAmt; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float a = pow(1.0 - d * 2.0, 1.6); gl_FragColor = vec4(uColor * (1.0 + a), a * vA * uAmt); }';

const SHAFT_VERT = 'varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vH = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
const SHAFT_FRAG = `varying vec3 vN; varying vec3 vV; varying float vH; uniform vec3 uColor; uniform float uAmt, uTime, uPhase; uniform sampler2D uNoise;
  void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.7);
    float streak = texture2D(uNoise, vec2(vH * 0.35 + uPhase, uTime * 0.02 + uPhase)).r;
    float fade = smoothstep(0.0, 0.18, vH) * (1.0 - smoothstep(0.55, 1.0, vH));
    float a = f * fade * (0.5 + 0.7 * streak) * uAmt;
    gl_FragColor = vec4(uColor * a, 1.0); }`;

const MIST_FRAG = `varying vec2 vUv; uniform vec3 uColor; uniform float uAmt, uTime, uSeed; uniform sampler2D uNoise;
  void main(){ vec2 c = vUv * 2.0 - 1.0; float d = length(c); if (d > 1.0) discard;
    float n = texture2D(uNoise, vUv * 1.1 + vec2(uTime * 0.006 * (1.0 + uSeed), uSeed)).r * 0.6 + texture2D(uNoise, vUv * 2.7 - vec2(uTime * 0.01, uSeed * 3.0)).g * 0.4;
    float a = smoothstep(0.36, 0.78, n) * pow(1.0 - d, 1.4) * uAmt;
    gl_FragColor = vec4(uColor, a); }`;

export class AmbientFx {
  /** @param {import('./scene3d.js').Scene3D} s3 */
  constructor(s3, zone) {
    this.s3 = s3; this.zone = zone; this.q = s3.q;
    this.root = new THREE.Group(); this.root.name = 'ambientFx'; s3.content.add(this.root);
    this.tex = getNoiseTexture();
    this.motes = null; this.shafts = []; this.mists = []; this.beams = [];
    const q = this.q;
    if (q.motes > 0) this.#motes(q.motes);
    if (q.shafts) this.#shafts();
    if (q.mist) this.#mist();
  }

  #motes(n) {
    const seed = new Float32Array(n * 4); for (let i = 0; i < n; i++) seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
      uniforms: { uTime: WORLD.uTime, uWind: WORLD.uWind, uFocus: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(42, 14, 42) }, uSize: { value: 0.09 }, uScale: { value: 1300 }, uSpeed: { value: 1 }, uRise: { value: 0.012 }, uColor: { value: new THREE.Color('#ffe2a8') }, uAmt: { value: 0.8 } } });
    this.motes = new THREE.Points(g, m); this.motes.frustumCulled = false; this.motes.renderOrder = 11; this.root.add(this.motes);
  }

  #shaft(color, len, r0, r1, phase) {
    const g = new THREE.CylinderGeometry(r1, r0, len, 14, 1, true); g.translate(0, len / 2, 0);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
      uniforms: { uColor: { value: new THREE.Color(color) }, uAmt: { value: 0.3 }, uTime: WORLD.uTime, uPhase: { value: phase }, uNoise: { value: this.tex } } });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5; this.root.add(mesh);
    return mesh;
  }

  #shafts() {
    const zone = this.zone, Hf = zone.heightAt;
    // sun shafts slanting through gaps over the settlement and the trailhead; cyan resonance beams above the Choir's pipes
    const sunSpots = [[-9, -37], [11, -33], [-22, -33], [4, -43], [-52, 44], [-30, 18], [42, -52], [52, 2]];
    sunSpots.forEach(([x, z], i) => { const m = this.#shaft('#ffd9a0', 20, 1.0, 3.2, i * 0.37); m.position.set(x, Hf(x, z), z); m.userData.kind = 'sun'; this.shafts.push(m); });
    for (const p of zone.props) if (p.kind === 'pillar' && p.area === 'area.empty_choir') { const m = this.#shaft('#7fe3ff', 13, 0.5, 0.9, p.x * 0.1); m.position.set(p.x, p.y + 3.0, p.z); m.userData.kind = 'beam'; this.shafts.push(m); }
    this.#orient();
  }
  #orient() {
    const d = this.s3.sunDir ?? new THREE.Vector3(-0.6, 0.5, 0.3);
    for (const m of this.shafts) if (m.userData.kind === 'sun') m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  }

  #mist() {
    const spots = [[50, 4, 17], [5, 60, 15], [-46, -38, 13], [-58, 46, 11], [45, -58, 12], [0, -8, 13], [-28, 20, 13], [28, -44, 11], [-44, -12, 11]];
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    spots.forEach(([x, z, r], i) => {
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: MIST_FRAG,
        uniforms: { uColor: { value: new THREE.Color('#c8d4e0') }, uAmt: { value: 0.16 }, uTime: WORLD.uTime, uSeed: { value: i * 0.31 }, uNoise: { value: this.tex } } });
      const mesh = new THREE.Mesh(geo, m); mesh.scale.set(r * 2, 1, r * 2); mesh.position.set(x, this.zone.heightAt(x, z) + 0.7, z); mesh.rotation.y = i; mesh.renderOrder = 3; mesh.frustumCulled = true; this.root.add(mesh); this.mists.push(mesh);
    });
  }

  update(t, focus, atm) {
    if (!atm) return;
    if (this.motes) {
      const u = this.motes.material.uniforms;
      u.uFocus.value.set(focus.x, focus.y + 4.0, focus.z); u.uScale.value = (this.s3.size.h * this.s3.renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(this.s3.camera.fov) / 2));
      const night = THREE.MathUtils.smoothstep(atm.glow, 1.1, 1.8);
      u.uColor.value.copy(atm.sun).lerp(new THREE.Color('#8fe8ff'), night); u.uAmt.value = 0.55 + 0.5 * night;
    }
    for (const m of this.shafts) {
      const u = m.material.uniforms;
      if (m.userData.kind === 'sun') { u.uAmt.value = atm.shafts * 0.2; u.uColor.value.copy(atm.sun); }
      else u.uAmt.value = 0.15 + 0.1 * Math.sin(t * 1.3 + m.position.x) + 0.12 * Math.min(1.5, atm.glow);
    }
    for (const m of this.mists) { m.material.uniforms.uColor.value.copy(atm.fog).lerp(new THREE.Color('#ffffff'), 0.35); m.material.uniforms.uAmt.value = 0.14 + 0.1 * (atm.density / 0.024); }
  }
  refresh() { this.#orient(); }
  dispose() { this.root.removeFromParent(); this.root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
}

/** World-level visual systems: the Bell Gate resonance curtain and weather (fog, wind streaks, mist). */
import * as THREE from 'three';

/** a shimmering wall of resonance that seals the Empty Choir until its gate opens */
export class GateCurtain {
  constructor(scene3d, zone, session) {
    this.s3 = scene3d; this.zone = zone; this.session = session; this.items = [];
    for (const g of zone.def.gates ?? []) {
      const [cx, cz] = g.ellipse.c, [rx, rz] = g.ellipse.r, N = 220, pos = [], idx = [], uv = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2, x = cx + Math.sin(a) * rx, z = cz + Math.cos(a) * rz, y = zone.heightAt(x, z);
        pos.push(x, y - 0.6, z, x, y + 7.5, z); uv.push(i / N * 40, 0, i / N * 40, 1);
        if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uA: { value: new THREE.Color('#7fe3ff') }, uB: { value: new THREE.Color('#b79cff') } },
        vertexShader: 'varying vec2 vUv; varying float vH; void main(){ vUv = uv; vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; varying float vH; uniform float uTime,uOpen; uniform vec3 uA,uB;
          void main(){ float bands = 0.5 + 0.5 * sin(vUv.x * 6.2831 * 3.0 + uTime * 1.4 + sin(vUv.y * 9.0 - uTime * 2.0) * 1.3);
            float rings = smoothstep(0.78, 1.0, sin(vUv.y * 40.0 - uTime * 3.0));
            float edge = smoothstep(0.0, 0.12, vH) * (1.0 - smoothstep(0.78, 1.0, vH));
            vec3 c = mix(uA, uB, bands) * (0.35 + 0.65 * bands) + rings * 0.35;
            float a = (0.16 + 0.28 * bands + rings * 0.25) * edge * (1.0 - uOpen);
            if (a < 0.01) discard; gl_FragColor = vec4(c, a); }`,
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
  }
}

const FOG = { calm: { k: 1, tint: null }, mist: { k: 2.4, tint: '#d8e2ea' }, windstorm: { k: 1.3, tint: '#c8b89c' } };

/** fog density/colour follow the weather; windstorms add horizontal dust streaks around the player */
export class WeatherFx {
  constructor(scene3d, particles) { this.s3 = scene3d; this.p = particles; this.k = 1; this.tint = new THREE.Color(); this.tintAmt = 0; this.acc = 0; this.type = 'calm'; this.dir = 0; }
  update(dt, weather, focus) {
    if (!this.s3.baseFog || !this.s3.scene.fog) return;
    const fx = FOG[weather?.current ?? 'calm'] ?? FOG.calm;
    this.type = weather?.current ?? 'calm'; this.dir = weather?.dir ?? 0;
    this.k += (fx.k - this.k) * Math.min(1, dt * 0.5);
    const want = fx.tint ? 0.45 : 0; this.tintAmt += (want - this.tintAmt) * Math.min(1, dt * 0.5);
    if (fx.tint) this.tint.set(fx.tint);
    const f = this.s3.scene.fog, base = this.s3.baseFog;
    f.density = base.density * this.k;
    f.color.copy(base.color).lerp(this.tint, this.tintAmt);
    this.s3.scene.background?.copy?.(f.color);
    if (this.type === 'windstorm' && this.p) {
      this.acc += dt * 38;
      while (this.acc >= 1) {
        this.acc -= 1;
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 20;
        this.p.emit({ x: focus.x + Math.sin(a) * r, y: focus.y + 0.5 + Math.random() * 5, z: focus.z + Math.cos(a) * r, count: 1, color: '#e8dcc0', dirX: Math.sin(this.dir), dirZ: Math.cos(this.dir), cone: 0.25, speed: 16, up: 0.2, life: 0.8, size: 0.16, gravity: 0, drag: 0.2, alpha: 0.5, jitter: 0.1 });
      }
    }
  }
}

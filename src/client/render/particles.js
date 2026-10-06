import * as THREE from 'three';

/** GPU points particle system with CPU simulation. Additive, soft-edged, pooled (no allocation per emit). */
export class Particles {
  constructor(scene, max = 3500) {
    this.max = max; this.n = 0; this.cursor = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.grow = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute vec4 aColor; attribute float aSize; varying vec4 vC; uniform float uScale;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    scene.add(this.points);
    this.tmp = new THREE.Color();
    this.density = 1;
  }

  setViewport(h, fov) { this.mat.uniforms.uScale.value = (h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2))); }

  /** @param {{x:number,y:number,z:number,count?:number,color?:string,speed?:number,spread?:number,up?:number,life?:number,size?:number,gravity?:number,drag?:number,grow?:number,alpha?:number,dirX?:number,dirZ?:number,cone?:number}} o */
  emit(o) {
    const count = Math.max(1, Math.round((o.count ?? 8) * this.density));
    this.tmp.set(o.color ?? '#ffffff');
    for (let i = 0; i < count; i++) {
      const k = this.cursor; this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      let vx, vz;
      if (o.dirX !== undefined) { const base = Math.atan2(o.dirX, o.dirZ) + (Math.random() - 0.5) * (o.cone ?? 1.2); vx = Math.sin(base) * sp; vz = Math.cos(base) * sp; }
      else { vx = Math.sin(a) * sp * (o.spread ?? 1); vz = Math.cos(a) * sp * (o.spread ?? 1); }
      this.pos[k * 3] = o.x + (Math.random() - 0.5) * (o.jitter ?? 0.2); this.pos[k * 3 + 1] = o.y + (Math.random() - 0.5) * (o.jitter ?? 0.2); this.pos[k * 3 + 2] = o.z + (Math.random() - 0.5) * (o.jitter ?? 0.2);
      this.vel[k * 3] = vx; this.vel[k * 3 + 1] = (o.up ?? 2) * (0.4 + Math.random() * 0.9); this.vel[k * 3 + 2] = vz;
      this.col[k * 4] = this.tmp.r; this.col[k * 4 + 1] = this.tmp.g; this.col[k * 4 + 2] = this.tmp.b; this.col[k * 4 + 3] = o.alpha ?? 1;
      this.size[k] = (o.size ?? 0.25) * (0.7 + Math.random() * 0.6);
      this.life[k] = this.maxLife[k] = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      this.grav[k] = o.gravity ?? 6; this.drag[k] = o.drag ?? 1.5; this.grow[k] = o.grow ?? 0;
    }
  }

  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; this.size[i] = 0; continue; }
      alive++;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.col[i * 4 + 3] = Math.min(1, k * 1.6);
      if (this.grow[i]) this.size[i] += this.grow[i] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.alive = alive;
  }
}

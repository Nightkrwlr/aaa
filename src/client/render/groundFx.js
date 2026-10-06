import * as THREE from 'three';

/**
 * Ground decals drawn with one shader: telegraphs (danger fills up to the impact), benign areas, zones,
 * ring flashes. Shapes: 0 circle · 1 arc · 2 line · 3 ring. Colour language (Art Bible §3):
 * danger red · benefit green · silence violet · interactive gold · echo cyan.
 */
export const FX_COLORS = { danger: '#ff4a3a', benign: '#6dff9a', hush: '#b79cff', gold: '#ffd27a', echo: '#7fe3ff', sonic: '#7fe3ff', fire: '#ff8a3a', frost: '#9fe8ff', toxic: '#9ad13a', physical: '#e8dcc0', shock: '#ffe34a' };
const KIND = { circle: 0, arc: 1, line: 2, ring: 3, ringarc: 4 };

const VERT = `varying vec2 vP; uniform float uExtent;
void main(){ vP = position.xy * uExtent; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; }`;
const FRAG = `varying vec2 vP; uniform vec3 uColor; uniform float uKind,uR,uAng,uW,uL,uInner,uProg,uAlpha,uTime,uPulse;
float sdf(vec2 p, out float fill){
  fill = 0.0;
  if (uKind < 0.5) { float d = length(p); fill = d / uR; return d - uR; }
  if (uKind < 1.5) { float d = length(p); float a = abs(atan(p.x, p.y)); float inside = step(a, uAng*0.5); fill = d / uR; float e = max(d - uR, (a - uAng*0.5) * d * 0.9); return e; }
  if (uKind < 2.5) { fill = p.y / uL; float ex = abs(p.x) - uW*0.5; float ey = max(-p.y, p.y - uL); return max(ex, ey); }
  float d = length(p); fill = (d - uInner) / max(uR - uInner, 0.001); float e = max(d - uR, uInner - d);
  if (uKind > 3.5) { float a = abs(atan(p.x, p.y)); e = max(e, (a - uAng*0.5) * d * 0.9); }
  return e;
}
void main(){
  float fill; float e = sdf(vP, fill);
  if (e > 0.06) discard;
  float inside = smoothstep(0.06, -0.02, e);
  float edge = smoothstep(0.16, 0.0, abs(e)) ;
  float filled = step(fill, uProg);
  float a = inside * (0.16 + 0.30 * filled) + edge * 0.85;
  a *= uAlpha * (1.0 + uPulse * 0.25 * sin(uTime * 14.0));
  vec3 c = uColor * (0.8 + 0.5 * filled + edge * 0.6);
  gl_FragColor = vec4(c, a);
}`;

export class GroundFx {
  constructor(scene, max = 48) {
    this.items = [];
    this.free = [];
    this.scene = scene;
    this.geo = new THREE.PlaneGeometry(2, 2);
    this.geo.rotateX(-Math.PI / 2);
    // geometry is on XZ; the shader reads xz → we map via position.xz
    this.geo2 = new THREE.PlaneGeometry(2, 2);
    for (let i = 0; i < max; i++) this.free.push(this.#make());
  }

  #make() {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uColor: { value: new THREE.Color('#ff4a3a') }, uKind: { value: 0 }, uR: { value: 1 }, uAng: { value: 1 }, uW: { value: 1 }, uL: { value: 1 }, uInner: { value: 0 }, uProg: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uPulse: { value: 0 }, uExtent: { value: 1 } },
      vertexShader: `varying vec2 vP; uniform float uExtent; void main(){ vP = position.xz * uExtent; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: FRAG,
    });
    const mesh = new THREE.Mesh(this.geo, m);
    mesh.visible = false; mesh.renderOrder = 8; mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { mesh, m, busy: false };
  }

  /**
   * @param {{kind:string,x:number,y:number,z:number,yaw:number,radius:number,angle?:number,width?:number,length?:number,inner?:number,color?:string,life?:number,mode?:'fill'|'flash'|'zone',prog?:number,alpha?:number,pulse?:number}} o
   * returns handle {update(o), release()}
   */
  spawn(o) {
    const it = this.free.pop() ?? this.#make();
    it.busy = true;
    it.t = 0; it.life = o.life ?? 0.4; it.mode = o.mode ?? 'flash'; it.o = o;
    this.items.push(it);
    this.#apply(it, o, 0);
    return it;
  }

  #apply(it, o, prog) {
    const u = it.m.uniforms, kind = KIND[o.kind] ?? 0;
    const ext = o.kind === 'line' ? Math.max(o.length ?? 1, o.width ?? 1) : (o.radius ?? 1);
    const extent = Math.max(0.5, ext) + 0.5;
    u.uExtent.value = extent;
    u.uKind.value = kind; u.uR.value = o.radius ?? 1; u.uAng.value = o.angle ?? Math.PI * 2; u.uW.value = o.width ?? 1; u.uL.value = o.length ?? 1; u.uInner.value = o.inner ?? 0;
    u.uColor.value.set(FX_COLORS[o.color] ?? o.color ?? '#ff4a3a');
    u.uProg.value = prog; u.uPulse.value = o.pulse ?? 0; u.uAlpha.value = o.alpha ?? 1;
    const mesh = it.mesh;
    mesh.visible = true;
    mesh.scale.set(extent, 1, extent);
    mesh.position.set(o.x, o.y + 0.16, o.z);
    mesh.rotation.y = o.yaw;
    // lines are drawn from origin along +z (local), so offset the quad by half extents
    if (o.kind === 'line') { mesh.scale.set(extent, 1, extent); }
  }

  release(it) { it.mesh.visible = false; it.busy = false; const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); this.free.push(it); }

  update(dt, t) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const u = it.m.uniforms;
      u.uTime.value = t;
      if (it.mode === 'flash') {
        const k = it.t / it.life;
        if (k >= 1) { this.release(it); continue; }
        const o = it.o;
        u.uAlpha.value = (1 - k) * (o.alpha ?? 1);
        u.uProg.value = 1;
        if (o.kind === 'ring' || o.expand) { u.uR.value = o.radius * (0.25 + 0.75 * Math.sqrt(k)); u.uInner.value = Math.max(0, u.uR.value - (o.band ?? 0.8)); }
      } else if (it.mode === 'zone' && it.until && it.t > it.until) this.release(it);
    }
  }
  setProgress(it, p) { it.m.uniforms.uProg.value = p; }
  move(it, o) { this.#apply(it, o, it.m.uniforms.uProg.value); }
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Efectos de combate: chispas y trazadores estirados (cinta orientada a cámara), formas en el suelo con shader
// (telegrafos, ondas de choque) y composición de capas. Adaptado de vfx.js / groundFx.js de SUNDERCHOIR a r160.
//
// Presupuesto: UNA llamada de dibujo para todas las cintas (chispas + trazadores + estelas) y UNA para todo lo
// pintado en el suelo; sin asignaciones por fotograma (todo vive en Float32Array reutilizados).
// ───────────────────────────────────────────────────────────────────────────────────────────────
import {
  InstancedBufferGeometry, InstancedBufferAttribute, PlaneGeometry, ShaderMaterial, Mesh, AdditiveBlending, DynamicDrawUsage,
  Color,
} from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** tiempo de los shaders de FX (uniforme compartido) */
export const fxTime = { value: 0 };

// ─── cintas (chispas, trazadores, estelas) ────────────────────────────────────────────────────
const STREAK_VS = /* glsl */`
attribute vec4 iA; attribute vec4 iB; attribute vec4 iC;
varying vec2 vUv; varying vec4 vC;
void main(){
  vUv = uv; vC = iC;
  vec3 mv = (modelViewMatrix * vec4(iA.xyz, 1.0)).xyz;
  vec3 dv = normalize((modelViewMatrix * vec4(iB.xyz, 0.0)).xyz + vec3(0.0, 1e-6, 0.0));
  vec3 side = normalize(vec3(-dv.y, dv.x, 0.0) + vec3(1e-5, 0.0, 0.0));
  // uv.y = 1 en la cabeza: la cola se extiende hacia atrás
  vec3 p = mv - dv * ((1.0 - uv.y) * iB.w) + side * ((uv.x - 0.5) * 2.0 * iA.w);
  gl_Position = projectionMatrix * vec4(p, 1.0);
}`;
const STREAK_FS = /* glsl */`
varying vec2 vUv; varying vec4 vC;
void main(){
  float t = vUv.y, across = abs(vUv.x * 2.0 - 1.0);
  float body = pow(t, 1.5) * smoothstep(1.0, 0.1, across);
  float head = smoothstep(0.78, 1.0, t) * (1.0 - across * 0.8);
  // cabeza casi blanca y muy brillante (HDR), cola con el color del proyectil que se desvanece
  vec3 col = mix(vC.rgb, vec3(1.0, 0.96, 0.88) * (1.0 + length(vC.rgb) * 0.6), head);
  col *= 1.0 + head * 1.4;
  gl_FragColor = vec4(col, body * vC.a);
}`;

export class StreakBatch {
  constructor(scene, cap) {
    this.cap = cap; this.n = 0;
    const g = new InstancedBufferGeometry();
    const base = new PlaneGeometry(1, 1);
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    this.a = new Float32Array(cap * 4); this.b = new Float32Array(cap * 4); this.c = new Float32Array(cap * 4);
    this.attrs = [['iA', this.a], ['iB', this.b], ['iC', this.c]].map(([k, arr]) => {
      const at = new InstancedBufferAttribute(arr, 4).setUsage(DynamicDrawUsage); g.setAttribute(k, at); return at;
    });
    g.instanceCount = 0;
    this.geo = g;
    this.mesh = new Mesh(g, new ShaderMaterial({
      vertexShader: STREAK_VS, fragmentShader: STREAK_FS, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 7;
    scene.add(this.mesh);
  }
  /** x,y,z = cabeza · d = dirección unitaria · len = largo de cola · w = semiancho · rgb en HDR · al = alfa */
  push(x, y, z, dx, dy, dz, len, w, r, g, b, al = 1) {
    if (this.n >= this.cap) return;
    const i = this.n++ * 4, a = this.a, bb = this.b, c = this.c;
    a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = w;
    bb[i] = dx; bb[i + 1] = dy; bb[i + 2] = dz; bb[i + 3] = len;
    c[i] = r; c[i + 1] = g; c[i + 2] = b; c[i + 3] = al;
  }
  flush() {
    this.geo.instanceCount = this.n;
    for (const at of this.attrs) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, this.n) * 4); at.needsUpdate = true; }
  }
}

// ─── formas en el suelo (telegrafos, ondas de choque, charcos de luz) ─────────────────────────
const GROUND_VS = /* glsl */`
attribute vec4 gA; attribute vec4 gB; attribute vec4 gC;
varying vec2 vUv; varying vec4 vB; varying vec4 vK; varying float vR;
void main(){
  float S = 1.18;                               // el quad sobrepasa el radio para dejar sitio al resplandor
  vUv = position.xz * S; vB = gB; vK = gC; vR = gA.w;
  vec3 wp = vec3(gA.x + position.x * gA.w * S, gA.y, gA.z + position.z * gA.w * S);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const GROUND_FS = /* glsl */`
uniform float uTime;
varying vec2 vUv; varying vec4 vB; varying vec4 vK; varying float vR;
void main(){
  float r = length(vUv), px = fwidth(r), p = vK.y, a = 0.0; vec3 col = vB.rgb;
  if (vK.x < 0.5) {
    // telegrafo: disco con borde nítido, relleno que crece hasta el impacto y rayas de peligro (legible sin color)
    float inside = smoothstep(1.0 + px, 1.0 - px, r);
    float rimW = max(0.05, px * 2.4);
    float rim = smoothstep(rimW, 0.0, abs(r - 1.0));
    float fr = pow(clamp(p, 0.0, 1.0), 0.78);
    float fill = smoothstep(fr, fr - 0.07, r) * inside;
    float lead = smoothstep(0.08, 0.0, abs(r - fr)) * step(0.03, p) * inside;
    float stripes = step(0.5, fract((vUv.x + vUv.y) * vR * 0.95)) * (1.0 - fill) * inside;
    float pulse = step(0.72, p) * (0.5 + 0.5 * sin(uTime * 28.0));
    float outer = smoothstep(rimW * 5.0, 0.0, abs(r - 1.0 - rimW * 2.0)) * (1.0 - inside) * 0.35;
    a = inside * 0.1 + stripes * 0.07 + fill * (0.2 + 0.26 * p) + lead * 0.75 + rim * (0.7 + 0.3 * p + pulse * 0.3) + outer + pulse * inside * 0.22;
    col = mix(col, vec3(1.0, 0.92, 0.8), clamp(p * p * 0.55 + pulse * 0.35, 0.0, 0.8)) * (1.35 + rim * 1.2 + lead * 0.9);
  } else if (vK.x < 1.5) {
    // onda de choque: anillo que se afina al expandirse, estela interior y calor al nacer
    float e = 1.0 - pow(1.0 - p, 2.3), rr = 0.1 + 0.9 * e;
    float th = mix(0.22, 0.045, p) * vK.w;
    float d = r - rr;
    float ring = smoothstep(th, 0.0, abs(d));
    float tail = smoothstep(-th * 4.0, 0.0, d) * step(d, 0.0);
    float core = smoothstep(rr, 0.0, r) * pow(1.0 - p, 3.0);
    float fade = pow(1.0 - p, 1.3);
    a = (ring * 0.95 + tail * 0.4 + core * 0.5) * fade;
    col = col * (1.5 + ring * 1.6 + core * 1.5) + vec3(ring * 0.45);
  } else {
    // charco de luz: resplandor suave sobre el suelo (destello de explosión, brasas)
    float g = smoothstep(1.0, 0.0, r); a = g * g * pow(1.0 - p, 1.5); col *= 1.6;
  }
  a *= vB.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;

export class GroundBatch {
  constructor(scene, cap) {
    this.cap = cap; this.n = 0;
    const g = new InstancedBufferGeometry();
    const base = new PlaneGeometry(2, 2); base.rotateX(-Math.PI / 2);
    g.index = base.index; g.attributes.position = base.attributes.position;
    this.a = new Float32Array(cap * 4); this.b = new Float32Array(cap * 4); this.c = new Float32Array(cap * 4);
    this.attrs = [['gA', this.a], ['gB', this.b], ['gC', this.c]].map(([k, arr]) => {
      const at = new InstancedBufferAttribute(arr, 4).setUsage(DynamicDrawUsage); g.setAttribute(k, at); return at;
    });
    g.instanceCount = 0; this.geo = g;
    this.mesh = new Mesh(g, new ShaderMaterial({
      uniforms: { uTime: fxTime }, vertexShader: GROUND_VS, fragmentShader: GROUND_FS, transparent: true, depthWrite: false,
      blending: AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  /** kind 0 telegrafo · 1 onda · 2 charco de luz; p = progreso 0..1; aux = grosor relativo (onda) */
  push(kind, x, y, z, radius, r, g, b, alpha, p, aux = 1) {
    if (this.n >= this.cap) return;
    const i = this.n++ * 4;
    this.a[i] = x; this.a[i + 1] = y; this.a[i + 2] = z; this.a[i + 3] = radius;
    this.b[i] = r; this.b[i + 1] = g; this.b[i + 2] = b; this.b[i + 3] = alpha;
    this.c[i] = kind; this.c[i + 1] = p; this.c[i + 2] = 0; this.c[i + 3] = aux;
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const at of this.attrs) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, this.n) * 4); at.needsUpdate = true; }
  }
}

// ─── chispas / agujas (reserva con simulación en CPU) ─────────────────────────────────────────
const SPARK_CAP = 900;
const tmpCol = new Color();

export class SparkPool {
  constructor(batch) {
    this.b = batch; this.n = 0;
    const N = SPARK_CAP;
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3); this.d = new Float32Array(N * 3);
    this.life = new Float32Array(N); this.max = new Float32Array(N); this.grav = new Float32Array(N); this.drag = new Float32Array(N);
    this.w0 = new Float32Array(N); this.w1 = new Float32Array(N); this.l0 = new Float32Array(N); this.l1 = new Float32Array(N);
    this.col = new Float32Array(N * 3); this.mode = new Uint8Array(N);
  }
  /** chispa que sigue su velocidad (se estira en la dirección del movimiento) */
  spark(x, y, z, vx, vy, vz, life, len, w, r, g, b, grav = 14, drag = 1.2) {
    if (this.n >= SPARK_CAP) return;
    const k = this.n++, i = k * 3;
    this.p[i] = x; this.p[i + 1] = y; this.p[i + 2] = z; this.v[i] = vx; this.v[i + 1] = vy; this.v[i + 2] = vz;
    this.life[k] = this.max[k] = life; this.grav[k] = grav; this.drag[k] = drag;
    this.l0[k] = len; this.l1[k] = len * 0.35; this.w0[k] = w; this.w1[k] = w * 0.3;
    this.col[i] = r; this.col[i + 1] = g; this.col[i + 2] = b; this.mode[k] = 0;
  }
  /** aguja fija: nace en (x,y,z) y se alarga hacia (dx,dy,dz) con la luz más intensa en el origen */
  spike(x, y, z, dx, dy, dz, life, len, w, r, g, b) {
    if (this.n >= SPARK_CAP) return;
    const k = this.n++, i = k * 3, m = 1 / (Math.hypot(dx, dy, dz) || 1);
    this.p[i] = x; this.p[i + 1] = y; this.p[i + 2] = z; this.v[i] = this.v[i + 1] = this.v[i + 2] = 0;
    // la cabeza (brillo) está en el origen y la cola apunta hacia fuera: dirección invertida
    this.d[i] = -dx * m; this.d[i + 1] = -dy * m; this.d[i + 2] = -dz * m;
    this.life[k] = this.max[k] = life; this.grav[k] = 0; this.drag[k] = 0;
    this.l0[k] = len * 0.55; this.l1[k] = len; this.w0[k] = w; this.w1[k] = w * 0.25;
    this.col[i] = r; this.col[i + 1] = g; this.col[i + 2] = b; this.mode[k] = 1;
  }
  swap(a, c) {
    if (a === c) return;
    for (let s = 0; s < 3; s++) { this.p[a * 3 + s] = this.p[c * 3 + s]; this.v[a * 3 + s] = this.v[c * 3 + s]; this.d[a * 3 + s] = this.d[c * 3 + s]; this.col[a * 3 + s] = this.col[c * 3 + s]; }
    this.life[a] = this.life[c]; this.max[a] = this.max[c]; this.grav[a] = this.grav[c]; this.drag[a] = this.drag[c];
    this.w0[a] = this.w0[c]; this.w1[a] = this.w1[c]; this.l0[a] = this.l0[c]; this.l1[a] = this.l1[c]; this.mode[a] = this.mode[c];
  }
  update(dt) {
    const p = this.p, v = this.v, b = this.b;
    for (let k = 0; k < this.n;) {
      this.life[k] -= dt;
      if (this.life[k] <= 0) { this.swap(k, --this.n); continue; }
      const i = k * 3, t = 1 - this.life[k] / this.max[k];
      if (this.mode[k] === 0) {
        const s = Math.max(0, 1 - this.drag[k] * dt);
        v[i] *= s; v[i + 2] *= s; v[i + 1] = v[i + 1] * s - this.grav[k] * dt;
        p[i] += v[i] * dt; p[i + 1] += v[i + 1] * dt; p[i + 2] += v[i + 2] * dt;
        if (p[i + 1] < 0.03) { p[i + 1] = 0.03; v[i + 1] *= -0.28; v[i] *= 0.6; v[i + 2] *= 0.6; }
        const sp = Math.hypot(v[i], v[i + 1], v[i + 2]) || 1e-3;
        const len = (this.l0[k] + (this.l1[k] - this.l0[k]) * t) * Math.min(1, 0.22 + sp * 0.11);
        const w = this.w0[k] + (this.w1[k] - this.w0[k]) * t, al = Math.pow(1 - t, 0.85);
        b.push(p[i], p[i + 1], p[i + 2], v[i] / sp, v[i + 1] / sp, v[i + 2] / sp, len, w, this.col[i], this.col[i + 1], this.col[i + 2], al);
      } else {
        const len = this.l0[k] + (this.l1[k] - this.l0[k]) * Math.min(1, t * 2.2), w = this.w0[k] + (this.w1[k] - this.w0[k]) * t;
        b.push(p[i], p[i + 1], p[i + 2], this.d[i], this.d[i + 1], this.d[i + 2], len, w, this.col[i], this.col[i + 1], this.col[i + 2], 1 - t * t);
      }
      k++;
    }
  }
  clear() { this.n = 0; }
}

/** color hex → r,g,b normalizado a su canal máximo y multiplicado (HDR): color vivo aunque el hex sea apagado */
export function hot(hex, gain, out) {
  tmpCol.setHex(hex);
  const m = Math.max(tmpCol.r, tmpCol.g, tmpCol.b, 0.01);
  out[0] = (tmpCol.r / m) * gain; out[1] = (tmpCol.g / m) * gain; out[2] = (tmpCol.b / m) * gain;
  return out;
}

export { clamp as fxClamp };

/**
 * structKit — building blocks shared by structures.js (settlement) and landmarks.js: the assembler that merges procedural
 * (paint.js) and KayKit pieces into a handful of draw calls, plus halos / ground glow / smoke FX and reusable architectural parts
 * (windows, arched doors, lantern brackets, steps, planters).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/rng.js';
import { Paint, PAT } from './paint.js';
import { paintMaterial, glowPaintMaterial } from './worldMaterials.js';
import { WORLD } from './atmosphere.js';
import { getNoiseTexture } from './noiseTex.js';

export const PI = Math.PI, TAU = Math.PI * 2;
export const CYAN = '#7fe3ff', WARM = '#ffb458', EMBER = '#ff7a2a';

// ───────────────────────────────────────────────────────── shared FX materials (halos, smoke)
let haloMat = null, groundGlowMat = null, smokeMat = null, quadGeo = null;
const fxQuad = () => (quadGeo ??= new THREE.PlaneGeometry(1, 1));
function getHaloMat() {
  return (haloMat ??= new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uGlow: WORLD.uGlow },
    vertexShader: `varying vec2 vUv; varying vec3 vCol;
      void main(){ vUv = uv * 2.0 - 1.0;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0);
        #endif
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(instanceMatrix[0].xyz);
        c.xy += position.xy * s; c.z += 0.4;
        gl_Position = projectionMatrix * c; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vCol; uniform float uGlow;
      void main(){ float d = length(vUv); if (d > 1.0) discard; float a = pow(1.0 - d, 2.4); float core = pow(1.0 - d, 8.0);
        gl_FragColor = vec4(vCol * (a * 0.42 + core * 0.7) * (0.55 + 0.45 * uGlow), 1.0); }`,
  }));
}
function getGroundGlowMat() {
  return (groundGlowMat ??= new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    uniforms: { uGlow: WORLD.uGlow },
    vertexShader: `varying vec2 vUv; varying vec3 vCol;
      void main(){ vUv = uv * 2.0 - 1.0;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vCol; uniform float uGlow;
      void main(){ float d = length(vUv); if (d > 1.0) discard; float a = pow(1.0 - d, 1.8); gl_FragColor = vec4(vCol * a * 0.32 * (0.5 + 0.5 * uGlow), 1.0); }`,
  }));
}
function getSmokeMat() {
  return (smokeMat ??= new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { uTime: WORLD.uTime, uWind: WORLD.uWind, uNoise: { value: getNoiseTexture() }, fogColor: { value: new THREE.Color() }, fogNear: { value: 0 }, fogFar: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying float vLife; varying float vFogDepth; varying vec3 vFogWP;
      uniform float uTime; uniform vec4 uWind;
      void main(){ vUv = uv * 2.0 - 1.0;
        float id = float(gl_InstanceID);
        float ph = fract(uTime * 0.18 + id * 0.137 + instanceMatrix[3].x * 0.05);
        vLife = ph;
        vec3 base = instanceMatrix[3].xyz;
        float rise = ph * 4.2;
        vec3 off = vec3(uWind.x * ph * ph * 3.2 + sin(ph * 6.0 + id) * 0.18, rise, uWind.y * ph * ph * 3.2 + cos(ph * 5.0 + id) * 0.15);
        vec4 c = modelViewMatrix * vec4(base + off, 1.0);
        float s = length(instanceMatrix[0].xyz) * (0.7 + ph * 2.2);
        c.xy += position.xy * s;
        vFogDepth = -c.z; vFogWP = cameraPosition + transpose(mat3(viewMatrix)) * c.xyz;
        gl_Position = projectionMatrix * c; }`,
    fragmentShader: `varying vec2 vUv; varying float vLife; uniform sampler2D uNoise;
      #include <fog_pars_fragment>
      void main(){ float d = length(vUv); if (d > 1.0) discard;
        float n = texture2D(uNoise, vUv * 0.5 + 0.5 + vLife).r;
        float a = (1.0 - smoothstep(0.35, 1.0, d + (n - 0.5) * 0.5)) * smoothstep(0.0, 0.12, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife)) * 0.5;
        gl_FragColor = vec4(mix(vec3(0.34, 0.31, 0.3), vec3(0.78, 0.74, 0.7), vLife), a);
        #include <fog_fragment>
      }`,
  }));
}
// the smoke shader reuses the patched fog chunks: mark the material fog-enabled so three uploads fogColor & co.
function smokeFogFlag(m) { m.fog = true; return m; }

/** glowing resonance strings: additive, thickness shimmers per string id (ids are baked as an attribute) */
let stringMat = null;
export function stringMaterial() {
  return (stringMat ??= new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: WORLD.uTime, uGlow: WORLD.uGlow },
    vertexShader: `attribute float aId; varying float vId; uniform float uTime;
      void main(){ vId = aId; float w = 1.0 + 0.9 * sin(uTime * 7.0 + aId * 1.7) * sin(uTime * 2.1 + aId);
        vec3 p = position; float cx = -1.0 + aId * 0.25; p.x = cx + (p.x - cx) * w; p.z *= w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `varying float vId; uniform float uTime; uniform float uGlow;
      void main(){ float f = 0.6 + 0.4 * sin(uTime * 5.0 + vId * 2.3); gl_FragColor = vec4(vec3(0.3, 0.75, 1.0) * (0.55 + 0.75 * f) * (0.55 + 0.45 * uGlow), 1.0); }`,
  }));
}

// ───────────────────────────────────────────────────────── assembler
export class Build {
  constructor(ctx = {}, seed = 'x') {
    this.ctx = ctx; this.wa = ctx.wa?.ready ? ctx.wa : null; this.rng = new Rng(`struct:${seed}`);
    this.solid = new Paint(); this.glow = new Paint();
    this.kitParts = new Map(); this.halos = []; this.floorGlows = []; this.smokes = []; this.extra = [];
    this.group = new THREE.Group(); this.updates = [];
  }
  /** add a KayKit piece (merged into one mesh per atlas variant). `fallback` is drawn with Paint when the kit is missing. */
  kit(key, { pos = [0, 0, 0], ry = 0, rx = 0, rz = 0, s = 1, sx = s, sy = s, sz = s, variant = 'base', fallback = null } = {}) {
    const geo = this.wa?.geo(key);
    if (!geo) { fallback?.(this); return this; }
    const [g] = key.split('/');
    const k = `${g}|${variant}`;
    let list = this.kitParts.get(k); if (!list) this.kitParts.set(k, list = { g, variant, items: [] });
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    list.items.push(geo.clone().applyMatrix4(m));
    return this;
  }
  /** merge a Paint pair built in local coordinates (window, door…) */
  put(parts, pos = [0, 0, 0], yaw = 0) { if (parts.solid) this.solid.merge(parts.solid, pos, yaw); if (parts.glow) this.glow.merge(parts.glow, pos, yaw); return this; }
  /** a banner / flag: kit cloth that waves from its top edge (own mesh: needs the wind material) */
  cloth(key, { pos = [0, 0, 0], ry = 0, s = 1, swayHeight = 3.8, amt = 1.5, variant = 'base' } = {}) {
    const geo = this.wa?.geo(key); if (!geo) return this;
    const mat = this.wa.material(key.split('/')[0], variant, { wind: true, windFlip: true, swayHeight, swayAmt: amt, ao: false });
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.y = ry; m.scale.setScalar(s); m.castShadow = true; m.receiveShadow = true; this.group.add(m);
    return this;
  }
  halo(pos, color = WARM, size = 1.6) { this.halos.push({ pos, color, size }); return this; }
  floorGlow(pos, color = WARM, size = 5) { this.floorGlows.push({ pos, color, size }); return this; }
  smoke(pos, n = 7, size = 0.55) { this.smokes.push({ pos, n, size }); return this; }
  light(color, intensity, distance, pos, flicker = false) { const l = new THREE.PointLight(color, intensity, distance, 2); l.position.set(...pos); l.userData.flicker = flicker; this.group.add(l); return l; }
  add(mesh) { this.group.add(mesh); return mesh; }
  onUpdate(fn) { this.updates.push(fn); return this; }

  finish({ shadows = true } = {}) {
    const g = this.group;
    if (this.solid.count) { const m = new THREE.Mesh(this.solid.build(), paintMaterial()); m.castShadow = shadows; m.receiveShadow = true; m.name = 'solid'; g.add(m); }
    if (this.glow.count) { const m = new THREE.Mesh(this.glow.build(), glowPaintMaterial(this.glowBase ?? 2.4)); m.castShadow = false; m.receiveShadow = false; m.name = 'glowpaint'; g.add(m); }
    for (const { g: grp, variant, items } of this.kitParts.values()) {
      const mat = this.wa.material(grp, variant, { aoK: 0.62, aoH: 1.5 }); if (!mat || !items.length) continue;
      const geo = items.length === 1 ? items[0] : mergeGeometries(items, false);
      const m = new THREE.Mesh(geo, mat); m.castShadow = shadows; m.receiveShadow = true; m.name = `kit_${grp}`; g.add(m);
    }
    const inst = (list, mat, name, make) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(fxQuad(), mat, list.length); const c = new THREE.Color(), mm = new THREE.Matrix4();
      list.forEach((h, i) => { make(h, mm); mesh.setMatrixAt(i, mm); mesh.setColorAt(i, c.set(h.color)); });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.name = name; g.add(mesh);
    };
    inst(this.halos, getHaloMat(), 'halos', (h, mm) => mm.compose(new THREE.Vector3(...h.pos), new THREE.Quaternion(), new THREE.Vector3(h.size, h.size, h.size)));
    inst(this.floorGlows, getGroundGlowMat(), 'floorglow', (h, mm) => mm.compose(new THREE.Vector3(...h.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0)), new THREE.Vector3(h.size, h.size, h.size)));
    for (const sm of this.smokes) {
      const mesh = new THREE.InstancedMesh(fxQuad(), smokeFogFlag(getSmokeMat()), sm.n); const mm = new THREE.Matrix4();
      for (let i = 0; i < sm.n; i++) { mm.compose(new THREE.Vector3(...sm.pos), new THREE.Quaternion(), new THREE.Vector3(sm.size, sm.size, sm.size)); mesh.setMatrixAt(i, mm); }
      mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.name = 'smoke'; g.add(mesh);
    }
    if (this.updates.length) g.userData.update = (t, st, focus) => { for (const u of this.updates) u(t, st, focus); };
    return g;
  }
}

// ───────────────────────────────────────────────────────── reusable architectural parts (local frame: +z faces out of the wall, origin on the wall surface)
export function windowParts(w = 1.0, h = 1.25, { shutters = true, frame = 'woodDark', lit = true, sill = true } = {}) {
  const s = new Paint(), g = new Paint();
  const t = 0.1;
  s.box(w + 0.3, t * 1.5, 0.22, { pos: [0, h / 2 + t * 0.75, 0.05], mat: 'limestoneLight', bevel: 0.02 });         // lintel
  s.box(t * 1.5, h, 0.16, { pos: [-w / 2 - t * 0.2, 0, 0.04], mat: frame }); s.box(t * 1.5, h, 0.16, { pos: [w / 2 + t * 0.2, 0, 0.04], mat: frame });
  s.box(w + 0.3, t, 0.16, { pos: [0, -h / 2 - t * 0.5, 0.04], mat: frame });
  if (sill) s.box(w + 0.45, 0.1, 0.3, { pos: [0, -h / 2 - t - 0.04, 0.1], mat: 'limestoneLight', bevel: 0.02 });
  s.box(0.06, h, 0.1, { pos: [0, 0, 0.03], mat: frame }); s.box(w, 0.06, 0.1, { pos: [0, 0.05, 0.03], mat: frame });                      // mullion / transom
  if (lit) g.box(w, h, 0.05, { pos: [0, 0, -0.02], mat: 'glowWarm', g: [0.05, 0.9] });
  else s.box(w, h, 0.05, { pos: [0, 0, -0.02], mat: 'void', g: [0.05, 0.6] });
  if (shutters) for (const sx of [-1, 1]) { s.box(w * 0.42, h * 1.02, 0.07, { pos: [sx * (w / 2 + w * 0.2 + 0.1), 0, 0.1], rot: [0, sx * 0.55, 0], mat: 'woodRed', pat: PAT.plank, g: [0.1, 0.8] }); }
  return { solid: s, glow: g };
}
/** double door in an arched limestone frame; `open` shows the dark interior */
export function doorParts(w = 1.5, h = 2.5, { open = false, mat = 'wood' } = {}) {
  const s = new Paint(), g = new Paint();
  s.archFrame(w, h, 0.5, 0.26, { mat: 'limestoneLight', g: [0.05, 0.75] });
  const hh = h + w / 2;
  s.box(w * 0.5, h, 0.12, { pos: [-w * 0.25, h / 2, -0.04], mat, pat: PAT.plank, g: [0.1, 0.8] }); s.box(w * 0.5, h, 0.12, { pos: [w * 0.25, h / 2, -0.04], mat, pat: PAT.plank, g: [0.1, 0.8] });
  // arched head filler
  const hs = new THREE.Shape(); hs.moveTo(-w / 2, 0); hs.absarc(0, 0, w / 2, Math.PI, 0, true); hs.lineTo(-w / 2, 0);
  const hg = new THREE.ShapeGeometry(hs, 10); hg.translate(0, h, -0.1);
  s.add(hg, { mat, g: [0.1, 0.5], pat: PAT.plank });
  for (const y of [0.55, h - 0.5]) s.box(w - 0.1, 0.12, 0.05, { pos: [0, y, 0.04], mat: 'iron' });
  s.cyl(0.07, 0.07, 0.04, 8, { pos: [-0.12, h * 0.46, 0.06], rot: [PI / 2, 0, 0], mat: 'brass' }); s.cyl(0.07, 0.07, 0.04, 8, { pos: [0.12, h * 0.46, 0.06], rot: [PI / 2, 0, 0], mat: 'brass' });
  return { solid: s, glow: g };
}
export function lanternBracket(lit = true) {
  const s = new Paint(), g = new Paint();
  s.box(0.08, 0.08, 0.55, { pos: [0, 0, 0.27], mat: 'iron' }); s.box(0.08, 0.5, 0.08, { pos: [0, -0.2, 0.05], mat: 'iron' });
  s.cone(0.2, 0.2, 4, { pos: [0, -0.06, 0.55], rot: [0, PI / 4, 0], mat: 'iron' });
  s.box(0.26, 0.04, 0.26, { pos: [0, -0.4, 0.55], mat: 'iron' });
  for (const [x, z] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) s.box(0.025, 0.3, 0.025, { pos: [x, -0.22, 0.55 + z], mat: 'iron' });
  if (lit) g.box(0.17, 0.26, 0.17, { pos: [0, -0.22, 0.55], mat: 'glowWarm' });
  return { solid: s, glow: g };
}
export function steps(w, n, rise, run, mat = 'limestone') {
  const s = new Paint();
  for (let i = 0; i < n; i++) s.box(w + (n - i) * 0.04, rise, run * (n - i), { pos: [0, rise * (n - i - 0.5) - rise * 0.0, run * (n - i) / 2], mat, pat: PAT.stone, bevel: 0.03, g: [0.1, 0.6] });
  return s;
}
export function crateStack(rng, n = 3) {
  const s = new Paint();
  for (let i = 0; i < n; i++) s.box(0.62, 0.55, 0.62, { pos: [(i % 2) * 0.66 - 0.3, 0.28 + Math.floor(i / 2) * 0.55, (i % 3) * 0.1], rot: [0, rng.range(-0.25, 0.25), 0], mat: 'woodLight', pat: PAT.plank, bevel: 0.02 });
  return s;
}
export function flowerBox(w = 1.3, colors = ['#f4d35e', '#ee6c4d', '#f7f7f7']) {
  const s = new Paint();
  s.box(w, 0.2, 0.3, { pos: [0, 0, 0.15], mat: 'wood', pat: PAT.plank, bevel: 0.015 });
  s.box(w - 0.06, 0.12, 0.24, { pos: [0, 0.14, 0.15], mat: 'earth' });
  const n = Math.round(w / 0.22);
  for (let i = 0; i < n; i++) { const x = -w / 2 + 0.12 + i * (w - 0.24) / Math.max(1, n - 1); s.ico(0.11, 0, { pos: [x, 0.27, 0.15], mat: i % 2 ? 'leaf' : 'leafDark' }); s.ico(0.06, 0, { pos: [x + 0.02, 0.38, 0.17], mat: ['clothGold', 'clothRed', 'white'][i % 3] }); }
  return s;
}


/** Procedural mesh toolkit: cached geometries/materials so hundreds of entities share GPU resources. */
import * as THREE from 'three';

const geoCache = new Map();
const matCache = new Map();

export function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); g.userData.shared = true; geoCache.set(key, g); }
  return g;
}

/** @param {string} color @param {{emissive?:string, ei?:number, rough?:number, metal?:number, flat?:boolean, vc?:boolean, opacity?:number, side?:number, fade?:boolean}} [o] */
export function mat(color, o = {}) {
  const key = `${color}|${o.emissive ?? ''}|${o.ei ?? 0}|${o.rough ?? 0.85}|${o.metal ?? 0}|${o.flat ?? 1}|${o.vc ?? 0}|${o.opacity ?? 1}|${o.side ?? 0}|${o.fade ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: o.vc ? 0xffffff : color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, flatShading: o.flat !== false,
      emissive: o.emissive ?? '#000000', emissiveIntensity: o.ei ?? 0, vertexColors: !!o.vc,
      transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
    });
    if (o.fade !== false) applyOcclusionFade(m);
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}

// ───────────────────────── occlusion fade (dithered, camera→player cylinder)
export const fadeUniforms = {
  uCam: { value: new THREE.Vector3() },
  uTarget: { value: new THREE.Vector3() },
  uFadeRadius: { value: 2.6 },
  uFadeOn: { value: 1 },
};
export function applyOcclusionFade(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fadeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n vWPos = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;\n#else\n vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos;
uniform vec3 uCam; uniform vec3 uTarget; uniform float uFadeRadius; uniform float uFadeOn;
float bayer4(vec2 p){ int x=int(mod(p.x,4.0)); int y=int(mod(p.y,4.0)); int i=x+y*4;
 float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[i]+0.5)/16.0; }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
 if (uFadeOn > 0.5) {
   vec3 ray = uTarget - uCam; float rl = length(ray); vec3 rd = ray / rl;
   float t = dot(vWPos - uCam, rd);
   if (t > 1.0 && t < rl - 0.5) {
     float d = length((uCam + rd * t) - vWPos);
     float k = 1.0 - smoothstep(uFadeRadius * 0.55, uFadeRadius, d);
     float hgt = smoothstep(0.2, 1.4, vWPos.y - uTarget.y + 0.9);
     if (bayer4(gl_FragCoord.xy) < k * 0.92 * hgt) discard;
   }
 }`);
  };
  material.customProgramCacheKey = () => 'occfade';
}

// ───────────────────────── primitive helpers
export function box(w, h, d, color, o = {}) {
  const m = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), o.material ?? mat(color, o));
  place(m, o); return m;
}
export function cyl(rt, rb, h, color, o = {}) {
  const m = new THREE.Mesh(geo(`c${rt},${rb},${h},${o.seg ?? 8}`, () => new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 8)), o.material ?? mat(color, o));
  place(m, o); return m;
}
export function cone(r, h, color, o = {}) { return cyl(0, r, h, color, o); }
export function sphere(r, color, o = {}) {
  const m = new THREE.Mesh(geo(`s${r},${o.seg ?? 8}`, () => new THREE.SphereGeometry(r, o.seg ?? 8, o.seg2 ?? 6)), o.material ?? mat(color, o));
  place(m, o); return m;
}
export function torus(r, t, color, o = {}) {
  const m = new THREE.Mesh(geo(`t${r},${t},${o.seg ?? 16}`, () => new THREE.TorusGeometry(r, t, 6, o.seg ?? 16)), o.material ?? mat(color, o));
  place(m, o); return m;
}
export function ico(r, color, o = {}) {
  const m = new THREE.Mesh(geo(`i${r},${o.detail ?? 0}`, () => new THREE.IcosahedronGeometry(r, o.detail ?? 0)), o.material ?? mat(color, o));
  place(m, o); return m;
}
function place(m, o) {
  if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
  if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  if (o.scale) m.scale.set(...(Array.isArray(o.scale) ? o.scale : [o.scale, o.scale, o.scale]));
  m.castShadow = o.shadow !== false; m.receiveShadow = o.receive !== false;
  if (o.name) m.name = o.name;
}
export function group(children = [], o = {}) {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  if (o.pos) g.position.set(...o.pos);
  if (o.rot) g.rotation.set(...o.rot);
  if (o.name) g.name = o.name;
  return g;
}

/** merge several meshes (sharing one vertex-color material) into a single BufferGeometry */
export function mergeVC(parts) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  const c = new THREE.Color();
  for (const { geometry, color, matrix } of parts) {
    const g = geometry.index ? geometry : geometry;
    const p = g.attributes.position, n = g.attributes.normal;
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    c.set(color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); pos.push(v.x, v.y, v.z);
      nn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(nn.x, nn.y, nn.z);
      const shade = 0.82 + 0.18 * Math.min(1, Math.max(0, v.y / 3));
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}
export const M4 = (px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** dispose GPU resources of an object tree, except the shared kit caches */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) if (!m.userData?.shared) { for (const k of ['map', 'emissiveMap']) m[k]?.dispose?.(); m.dispose(); }
  });
}

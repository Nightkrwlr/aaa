import * as THREE from 'three';
import { Rng } from '../../core/rng.js';
import { mat, geo, mergeVC, M4, box, cyl, cone, sphere, torus, ico, group, applyOcclusionFade } from './kit.js';

const PI = Math.PI;

// ───────────────────────── instanced prop geometries (vertex-coloured, one draw call per kind)
function rockGeo(seed, color) {
  const r = new Rng(`rock${seed}`);
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
    if (!jit.has(key)) jit.set(key, 0.78 + r.next() * 0.42);
    v.multiplyScalar(jit.get(key));
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y + 0.35, v.z);
  }
  g.computeVertexNormals();
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < p.count; i++) { const s = 0.78 + 0.3 * (p.getY(i) / 1.1); col[i * 3] = c.r * s; col[i * 3 + 1] = c.g * s; col[i * 3 + 2] = c.b * s; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function pineGeo() {
  const parts = [{ geometry: new THREE.CylinderGeometry(0.16, 0.24, 1.4, 6), color: '#6a5238', matrix: M4(0, 0.7, 0) }];
  const tiers = [[1.35, 1.5, 1.3], [1.05, 1.4, 2.2], [0.75, 1.3, 3.0], [0.45, 1.1, 3.75]];
  for (const [r, h, y] of tiers) parts.push({ geometry: new THREE.ConeGeometry(r, h, 7), color: y > 3 ? '#6f9a5a' : '#587f4a', matrix: M4(0, y, 0, 0, 0.4 * y) });
  return mergeVC(parts);
}
function shrubGeo() {
  return mergeVC([
    { geometry: new THREE.IcosahedronGeometry(0.42, 0), color: '#6f8f4a', matrix: M4(0, 0.35, 0, 0, 0, 0, 1, 0.8, 1) },
    { geometry: new THREE.IcosahedronGeometry(0.3, 0), color: '#86a45a', matrix: M4(0.3, 0.3, 0.1, 0.3) },
    { geometry: new THREE.IcosahedronGeometry(0.28, 0), color: '#5f8240', matrix: M4(-0.25, 0.28, -0.1) },
  ]);
}
function grassGeo() {
  const parts = [];
  for (let b = 0; b < 5; b++) {
    const a = (b / 5) * PI * 2 + b, rr = 0.12 + (b % 2) * 0.08, h = 0.55 + (b % 3) * 0.2;
    parts.push({ geometry: new THREE.ConeGeometry(0.05, h, 3), color: b % 2 ? '#a5b86a' : '#8aa456', matrix: M4(Math.sin(a) * rr, h / 2, Math.cos(a) * rr, 0.2 * Math.cos(a), 0, 0.2 * Math.sin(a)) });
  }
  return mergeVC(parts);
}
function ruinWallGeo() {
  const parts = [];
  const r = new Rng('ruinwall');
  for (let i = 0; i < 6; i++) {
    const h = 0.9 + r.next() * 1.1;
    parts.push({ geometry: new THREE.BoxGeometry(0.9, h, 0.8), color: i % 2 ? '#c8bb9e' : '#b9ad92', matrix: M4(-2 + i * 0.8 + r.range(-0.05, 0.05), h / 2, r.range(-0.08, 0.08), 0, r.range(-0.1, 0.1), 0) });
  }
  parts.push({ geometry: new THREE.BoxGeometry(4.6, 0.3, 1.0), color: '#a89c82', matrix: M4(0, 0.15, 0) });
  return mergeVC(parts);
}
function pillarGeo() {
  return mergeVC([
    { geometry: new THREE.CylinderGeometry(0.62, 0.7, 0.4, 10), color: '#b3a78c', matrix: M4(0, 0.2, 0) },
    { geometry: new THREE.CylinderGeometry(0.45, 0.52, 3.2, 10), color: '#d3c8ac', matrix: M4(0, 2.0, 0) },
    { geometry: new THREE.CylinderGeometry(0.66, 0.5, 0.5, 10), color: '#b3a78c', matrix: M4(0, 3.85, 0) },
    { geometry: new THREE.TorusGeometry(0.5, 0.05, 5, 12), color: '#d9a24a', matrix: M4(0, 2.8, 0, PI / 2) },
  ]);
}
function crateGeo() {
  return mergeVC([
    { geometry: new THREE.BoxGeometry(1, 0.9, 1), color: '#a8825a', matrix: M4(0, 0.45, 0) },
    { geometry: new THREE.BoxGeometry(1.06, 0.1, 1.06), color: '#7a5a3a', matrix: M4(0, 0.15, 0) },
    { geometry: new THREE.BoxGeometry(1.06, 0.1, 1.06), color: '#7a5a3a', matrix: M4(0, 0.75, 0) },
  ]);
}

const BUILDERS = {
  rock: () => [rockGeo(1, '#9d9482'), rockGeo(2, '#a79e8a'), rockGeo(3, '#8d8575')],
  pine: () => [pineGeo()],
  shrub: () => [shrubGeo()],
  grass: () => [grassGeo()],
  ruin_wall: () => [ruinWallGeo()],
  pillar: () => [pillarGeo()],
  crate: () => [crateGeo()],
};

/** Create InstancedMesh batches for all instanced props of a zone. */
export function buildInstancedProps(zone, quality) {
  const out = new THREE.Group();
  out.name = 'props';
  const byKind = new Map();
  for (const p of zone.props) {
    if (!BUILDERS[p.kind]) continue;
    if (p.kind === 'grass' && Math.random() > 2) continue;
    (byKind.get(p.kind) ?? byKind.set(p.kind, []).get(p.kind)).push(p);
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  applyOcclusionFade(material);
  const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const windUniform = { value: 0 };
  grassMat.onBeforeCompile = (s) => {
    s.uniforms.uWind = windUniform;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
 vec4 wp = modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.);
 float sway = sin(uWind * 1.7 + wp.x * 0.6 + wp.z * 0.45) * 0.16 * position.y;
 transformed.x += sway; transformed.z += sway * 0.6;`);
  };
  grassMat.customProgramCacheKey = () => 'grass';
  const dummy = new THREE.Object3D();
  const meshes = [];
  for (const [kind, list] of byKind) {
    const geos = BUILDERS[kind]();
    const keep = kind === 'grass' ? Math.floor(list.length * quality.grass) : kind === 'shrub' ? Math.floor(list.length * Math.max(0.4, quality.grass)) : list.length;
    const subset = list.slice(0, keep);
    const buckets = geos.map(() => []);
    subset.forEach((p, i) => buckets[i % geos.length].push(p));
    geos.forEach((g, gi) => {
      const items = buckets[gi];
      if (!items.length) return;
      const m = new THREE.InstancedMesh(g, kind === 'grass' ? grassMat : material, items.length);
      items.forEach((p, i) => {
        dummy.position.set(p.x, p.y - (kind === 'rock' ? 0.12 * p.scale : 0), p.z);
        dummy.rotation.set(0, p.rot, 0);
        const sy = kind === 'rock' ? p.scale * (0.7 + (i % 5) * 0.12) : p.scale;
        dummy.scale.set(p.scale, sy, p.scale);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.castShadow = kind !== 'grass' && kind !== 'shrub';
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.name = `inst_${kind}`;
      out.add(m);
      meshes.push(m);
    });
  }
  return { group: out, windUniform };
}

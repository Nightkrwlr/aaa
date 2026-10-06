import * as THREE from 'three';
import { Rng } from '../../core/rng.js';
import { applyOcclusionFade } from './kit.js';

const C = (h) => new THREE.Color(h);
const BIOME = {
  limestone_dawn: { low: C('#8fa35f'), high: C('#cfc3a8'), rock: C('#9b917c'), soil: C('#a9946d') },
  settlement: { low: C('#a2a56a'), high: C('#d8cba9'), rock: C('#a39a86'), soil: C('#b8a47c') },
  windharp: { low: C('#7f9a62'), high: C('#d4c9b0'), rock: C('#9aa0a0'), soil: C('#9fa38a') },
  quarry: { low: C('#a8967a'), high: C('#c9b99a'), rock: C('#8e8372'), soil: C('#8f7e66') },
  overlook: { low: C('#8ea46a'), high: C('#ddd2b6'), rock: C('#a69c88'), soil: C('#b7ab8f') },
  choir: { low: C('#9a9aa6'), high: C('#cfc7d4'), rock: C('#807a8c'), soil: C('#8c8598') },
};
const PATH = C('#d3c39a');

/** Build the ground mesh with per-vertex biome colour, slope rock and painted paths. */
export function buildTerrainMesh(zone, subdiv = 2) {
  const [W, H] = zone.def.size, [ox, oz] = zone.def.origin;
  const nx = W * subdiv, nz = H * subdiv;
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const colors = new Float32Array((nx + 1) * (nz + 1) * 3);
  const rng = new Rng('terrain-color');
  const tmp = new THREE.Color();
  let k = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = ox + (i / nx) * W, z = oz + (j / nz) * H;
    const h = zone.heightAt(x, z);
    positions[k * 3] = x; positions[k * 3 + 1] = h; positions[k * 3 + 2] = z;
    const slope = zone.terrain.slopeAt(x, z);
    const area = zone.areaAt(x, z);
    const b = BIOME[area?.biome] ?? BIOME.limestone_dawn;
    const t = THREE.MathUtils.clamp((h + 1) / 10, 0, 1);
    tmp.copy(b.low).lerp(b.high, t * 0.7 + (area ? 0 : 0.2));
    const n = (Math.sin(x * 0.37) * Math.cos(z * 0.41) + Math.sin(x * 0.11 + z * 0.13)) * 0.04;
    tmp.offsetHSL(0, 0, n + (rng.next() - 0.5) * 0.015);
    const rockMix = THREE.MathUtils.smoothstep(slope, 0.35, 0.95);
    tmp.lerp(b.rock, rockMix);
    const p = zone.terrain.pathStrength(x, z);
    if (p > 0) tmp.lerp(PATH, p * 0.85 * (1 - rockMix));
    // darken outside the playable bounds
    const edge = Math.min(x - zone.bounds.x0, zone.bounds.x1 - x, z - zone.bounds.z0, zone.bounds.z1 - z);
    if (edge < 12) tmp.multiplyScalar(0.6 + 0.4 * Math.max(0, edge / 12));
    colors[k * 3] = tmp.r; colors[k * 3 + 1] = tmp.g; colors[k * 3 + 2] = tmp.b;
    k++;
  }
  const idx = new Uint32Array(nx * nz * 6);
  let q = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

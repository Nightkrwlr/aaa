/**
 * Procedural low-poly vegetation & rock geometries in the same chunky, flat-shaded, gradient-coloured style as the KayKit kit.
 * All geometries are vertex-coloured (dark base → light tip) so one kit material draws them with wind + contact AO.
 * Deterministic: every factory takes a seed.
 */
import * as THREE from 'three';
import { Rng } from '../../core/rng.js';

const C = (h) => new THREE.Color(h);
const nonIndexed = (g) => (g.index ? g.toNonIndexed() : g);
const lerpC = (a, b, t) => a.clone().lerp(b, t);

/** accumulate triangles with per-vertex colours + explicit normals */
class Soup {
  constructor() { this.p = []; this.n = []; this.c = []; }
  tri(a, b, c, ca, cb, cc, na, nb, nc) {
    for (const [v, col, nn] of [[a, ca, na], [b, cb, nb], [c, cc, nc]]) { this.p.push(v.x, v.y, v.z); this.c.push(col.r, col.g, col.b); this.n.push(nn.x, nn.y, nn.z); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    g.userData.shared = true;
    return g;
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** a clump of tapered grass blades; normals point mostly up so blades light like the ground they grow from */
export function grassTuftGeo(seed = 1, { blades = 9, height = 0.55, radius = 0.16, width = 0.075 } = {}) {
  const r = new Rng(`tuft${seed}`), s = new Soup();
  const base = C('#58803f'), mid = C('#86ae55'), tip = C('#c6de84');
  for (let i = 0; i < blades; i++) {
    const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * radius;
    const ox = Math.sin(a) * d, oz = Math.cos(a) * d;
    const yaw = r.range(0, Math.PI * 2), lean = r.range(0.12, 0.55) * (0.6 + d / radius * 0.6);
    const h = height * r.range(0.65, 1.2) * (1 - d / radius * 0.3), w = width * r.range(0.8, 1.2);
    const dx = Math.sin(a) * 0.5 + Math.sin(yaw) * 0.5, dz = Math.cos(a) * 0.5 + Math.cos(yaw) * 0.5;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const bl = V(ox - cy * w, 0, oz + sy * w), br = V(ox + cy * w, 0, oz - sy * w);
    const midOff = lean * h * 0.35, tipOff = lean * h * 0.95;
    const ml = V(ox - cy * w * 0.62 + dx * midOff, h * 0.55, oz + sy * w * 0.62 + dz * midOff), mr = V(ox + cy * w * 0.62 + dx * midOff, h * 0.55, oz - sy * w * 0.62 + dz * midOff);
    const tp = V(ox + dx * tipOff, h * (1 - lean * 0.18), oz + dz * tipOff);
    const nn = V(dx * 0.22, 1, dz * 0.22).normalize();
    const tint = r.range(0.88, 1.12), cB = base.clone().multiplyScalar(tint), cM = mid.clone().multiplyScalar(tint), cT = tip.clone().multiplyScalar(tint);
    s.tri(bl, br, ml, cB, cB, cM, nn, nn, nn); s.tri(br, mr, ml, cB, cM, cM, nn, nn, nn); s.tri(ml, mr, tp, cM, cM, cT, nn, nn, nn);
  }
  return s.geometry();
}

/** a drooping broad-leaf fern/bracken */
export function fernGeo(seed = 1, { leaves = 8, length = 0.9 } = {}) {
  const r = new Rng(`fern${seed}`), s = new Soup();
  const base = C('#2f5a3a'), tip = C('#79b068');
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + r.range(-0.2, 0.2), L = length * r.range(0.75, 1.15), w = 0.17 * r.range(0.85, 1.2);
    const dx = Math.sin(a), dz = Math.cos(a), px = -dz, pz = dx;
    const pts = [];
    for (let k = 0; k <= 3; k++) { const t = k / 3; pts.push({ x: dx * L * t, y: 0.12 + Math.sin(t * Math.PI * 0.8) * L * 0.42 - t * t * L * 0.16, z: dz * L * t, w: w * (1 - t * t * 0.9) * (0.4 + t * 1.2 * (1 - t)), t }); }
    const up = V(dx * 0.3, 1, dz * 0.3).normalize();
    for (let k = 0; k < 3; k++) {
      const A = pts[k], B = pts[k + 1];
      const al = V(A.x - px * A.w, A.y, A.z - pz * A.w), ar = V(A.x + px * A.w, A.y, A.z + pz * A.w), bl = V(B.x - px * B.w, B.y, B.z - pz * B.w), br = V(B.x + px * B.w, B.y, B.z + pz * B.w);
      const cA = lerpC(base, tip, A.t), cB = lerpC(base, tip, B.t);
      s.tri(al, ar, bl, cA, cA, cB, up, up, up); s.tri(ar, br, bl, cA, cB, cB, up, up, up);
    }
  }
  return s.geometry();
}

/** a wildflower: crossed stem quads + a low-poly bloom of `petals` triangles around a centre */
export function flowerGeo(seed, petalColor, { height = 0.42, petals = 5, size = 0.1, center = '#f2c94c' } = {}) {
  const r = new Rng(`flower${seed}`), s = new Soup();
  const stem = C('#4f7a43'), stemTop = C('#6fa04f'), pc = C(petalColor), cc = C(center);
  const n = V(0, 1, 0);
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI / 2 + r.range(0, 0.5), dx = Math.cos(a) * 0.012, dz = Math.sin(a) * 0.012;
    const lean = r.range(-0.05, 0.05);
    s.tri(V(-dx, 0, -dz), V(dx, 0, dz), V(-dx + lean, height, -dz), stem, stem, stemTop, n, n, n);
    s.tri(V(dx, 0, dz), V(dx + lean, height, dz), V(-dx + lean, height, -dz), stem, stemTop, stemTop, n, n, n);
  }
  // two leaves
  for (let k = 0; k < 2; k++) { const a = k * Math.PI + r.range(0, 1); const lx = Math.sin(a) * 0.16, lz = Math.cos(a) * 0.16; s.tri(V(0, 0.04, 0), V(lx, 0.16, lz), V(lx * 0.4 + lz * 0.18, 0.12, lz * 0.4 - lx * 0.18), stem, stemTop, stem, n, n, n); }
  const top = V(0, height, 0), tilt = 0.55;
  for (let i = 0; i < petals; i++) {
    const a0 = (i / petals) * Math.PI * 2, a1 = ((i + 1) / petals) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = V(Math.sin(a0) * size * 0.5, height + 0.01, Math.cos(a0) * size * 0.5), p1 = V(Math.sin(a1) * size * 0.5, height + 0.01, Math.cos(a1) * size * 0.5);
    const tipP = V(Math.sin(am) * size * 1.25, height + tilt * size * 0.7, Math.cos(am) * size * 1.25);
    const nn = V(Math.sin(am) * 0.5, 1, Math.cos(am) * 0.5).normalize();
    s.tri(p0, p1, tipP, pc, pc, pc.clone().multiplyScalar(1.12), nn, nn, nn);
    s.tri(top, p1, p0, cc, cc, cc, n, n, n);
  }
  return s.geometry();
}

/** lumpy low-poly bush: a cluster of displaced icospheres, flat-shaded, dark base → bright top */
export function bushGeo(seed = 1, { radius = 0.62, lumps = 4, hue = 0 } = {}) {
  const r = new Rng(`bush${seed}`), s = new Soup();
  const dark = C('#2c4a30').offsetHSL(hue, 0, 0), light = C('#79a85a').offsetHSL(hue, 0, 0);
  for (let l = 0; l < lumps; l++) {
    const rad = radius * r.range(0.62, 0.95), cx = l === 0 ? 0 : r.range(-0.55, 0.55) * radius, cz = l === 0 ? 0 : r.range(-0.55, 0.55) * radius, cy = rad * r.range(0.62, 0.85);
    const g = nonIndexed(new THREE.IcosahedronGeometry(rad, 1));
    const pos = g.attributes.position, jit = new Map();
    for (let i = 0; i < pos.count; i++) {
      const v = V(pos.getX(i), pos.getY(i), pos.getZ(i)); const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
      if (!jit.has(key)) jit.set(key, r.range(0.82, 1.16));
      v.multiplyScalar(jit.get(key)); v.y *= 0.8; pos.setXYZ(i, v.x + cx, Math.max(0.02, v.y + cy), v.z + cz);
    }
    g.computeVertexNormals();
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i += 3) {
      const na = V(nor.getX(i), nor.getY(i), nor.getZ(i));
      for (let k = 0; k < 3; k++) {
        const y = pos.getY(i + k), t = Math.min(1, y / (radius * 1.5));
        const col = lerpC(dark, light, Math.pow(t, 0.8)).multiplyScalar(0.9 + 0.2 * Math.max(0, na.y));
        s.p.push(pos.getX(i + k), y, pos.getZ(i + k)); s.n.push(na.x, na.y, na.z); s.c.push(col.r, col.g, col.b);
      }
    }
    g.dispose();
  }
  return s.geometry();
}

/** faceted boulder: displaced icosphere, flattened base, moss on the upward faces, darker toes. */
export function rockGeo(seed = 1, { radius = 1, flat = 0.72, detail = 1, base = '#9d9482', moss = true, mossColor = '#5b7d4a', angular = 0.28 } = {}) {
  const r = new Rng(`rock${seed}`), s = new Soup();
  const g = nonIndexed(new THREE.IcosahedronGeometry(radius, detail));
  const pos = g.attributes.position, jit = new Map();
  const sx = r.range(0.85, 1.2), sz = r.range(0.85, 1.2);
  for (let i = 0; i < pos.count; i++) {
    const v = V(pos.getX(i), pos.getY(i), pos.getZ(i)); const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 1 - angular * 0.5 + r.next() * angular * 1.3);
    v.multiplyScalar(jit.get(key)); v.x *= sx; v.z *= sz; v.y *= flat;
    if (v.y < -radius * 0.12) v.y = -radius * 0.12 + (v.y + radius * 0.12) * 0.3;
    pos.setXYZ(i, v.x, v.y + radius * 0.3, v.z);
  }
  g.computeVertexNormals();
  const nor = g.attributes.normal, cb = C(base), cm = C(mossColor), dark = cb.clone().multiplyScalar(0.58), light = cb.clone().lerp(C('#e8dcc4'), 0.28);
  for (let i = 0; i < pos.count; i += 3) {
    const nn = V(nor.getX(i), nor.getY(i), nor.getZ(i)), tone = 0.9 + r.next() * 0.2;
    for (let k = 0; k < 3; k++) {
      const y = pos.getY(i + k), t = Math.min(1, Math.max(0, y / (radius * 0.9)));
      let col = lerpC(dark, light, Math.pow(t, 0.75)).multiplyScalar(tone);
      if (moss && nn.y > 0.62) col = lerpC(col, cm, Math.min(1, (nn.y - 0.55) * 1.6) * 0.55);
      s.p.push(pos.getX(i + k), y, pos.getZ(i + k)); s.n.push(nn.x, nn.y, nn.z); s.c.push(col.r, col.g, col.b);
    }
  }
  g.dispose();
  return s.geometry();
}

/** hexagonal crystal cluster (resonance quartz) with an emissive-friendly bright core colour baked into vertex colours */
export function crystalGeo(seed = 1, { count = 5, height = 1.1, color = '#7fe3ff' } = {}) {
  const r = new Rng(`crystal${seed}`), s = new Soup();
  const dark = C(color).multiplyScalar(0.35), light = C(color).lerp(C('#ffffff'), 0.5);
  for (let i = 0; i < count; i++) {
    const a = r.range(0, Math.PI * 2), d = i === 0 ? 0 : r.range(0.12, 0.34), h = height * (i === 0 ? 1 : r.range(0.45, 0.85)), w = 0.1 * (i === 0 ? 1.3 : r.range(0.7, 1));
    const tiltA = r.range(0, Math.PI * 2), tilt = i === 0 ? 0.08 : r.range(0.1, 0.45);
    const cx = Math.sin(a) * d, cz = Math.cos(a) * d, tx = Math.sin(tiltA) * tilt * h, tz = Math.cos(tiltA) * tilt * h;
    const seg = 6, ring = [];
    for (let k = 0; k < seg; k++) { const th = (k / seg) * Math.PI * 2; ring.push([Math.sin(th) * w, Math.cos(th) * w]); }
    const topC = V(cx + tx, h, cz + tz), shoulder = 0.72;
    for (let k = 0; k < seg; k++) {
      const [x0, z0] = ring[k], [x1, z1] = ring[(k + 1) % seg];
      const b0 = V(cx + x0, 0, cz + z0), b1 = V(cx + x1, 0, cz + z1);
      const s0 = V(cx + x0 + tx * shoulder, h * shoulder, cz + z0 + tz * shoulder), s1 = V(cx + x1 + tx * shoulder, h * shoulder, cz + z1 + tz * shoulder);
      const am = (k + 0.5) / seg * Math.PI * 2, n1 = V(Math.sin(am), 0.18, Math.cos(am)).normalize(), n2 = V(Math.sin(am), 0.7, Math.cos(am)).normalize();
      s.tri(b0, b1, s0, dark, dark, light, n1, n1, n1); s.tri(b1, s1, s0, dark, light, light, n1, n1, n1);
      s.tri(s0, s1, topC, light, light, light, n2, n2, n2);
    }
  }
  return s.geometry();
}

/** simple log / stump lying on the ground (low-poly cylinder with ring cut + bark gradient) */
export function logGeo(seed = 1, { length = 2.4, radius = 0.28 } = {}) {
  const r = new Rng(`log${seed}`), s = new Soup();
  const bark = C('#6b4d36'), barkLight = C('#8a6a48'), ring = C('#caa774');
  const seg = 7;
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
    const y0 = Math.sin(a0) * radius + radius, y1 = Math.sin(a1) * radius + radius, z0 = Math.cos(a0) * radius, z1 = Math.cos(a1) * radius;
    const n = V(0, Math.sin(am), Math.cos(am)).normalize();
    const a = V(-length / 2, y0, z0), b = V(length / 2, y0 + r.range(-0.02, 0.02), z0), c = V(-length / 2, y1, z1), d = V(length / 2, y1, z1);
    const col = lerpC(bark, barkLight, Math.max(0, Math.sin(am)) * 0.8);
    s.tri(a, c, b, col, col, col, n, n, n); s.tri(b, c, d, col, col, col, n, n, n);
    for (const [sx, nx] of [[-length / 2, -1], [length / 2, 1]]) { const cen = V(sx, radius, 0); const nn = V(nx, 0, 0); s.tri(cen, V(sx, y0, z0), V(sx, y1, z1), ring, ring.clone().multiplyScalar(0.85), ring.clone().multiplyScalar(0.85), nn, nn, nn); }
  }
  return s.geometry();
}

/** mushroom cluster (glowing variant gets a bright cap colour; the material decides emissive) */
export function mushroomGeo(seed = 1, { cap = '#7fe3ff', stem = '#d8d2c0', n = 3 } = {}) {
  const r = new Rng(`mush${seed}`), s = new Soup();
  const cs = C(stem), cc = C(cap);
  for (let i = 0; i < n; i++) {
    const x = r.range(-0.14, 0.14), z = r.range(-0.14, 0.14), h = r.range(0.12, 0.26), rad = r.range(0.07, 0.13), seg = 6;
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const sw = 0.018;
      const nS = V(Math.sin(am), 0, Math.cos(am));
      s.tri(V(x + Math.sin(a0) * sw, 0, z + Math.cos(a0) * sw), V(x + Math.sin(a1) * sw, 0, z + Math.cos(a1) * sw), V(x + Math.sin(a0) * sw, h, z + Math.cos(a0) * sw), cs.clone().multiplyScalar(0.7), cs.clone().multiplyScalar(0.7), cs, nS, nS, nS);
      s.tri(V(x + Math.sin(a1) * sw, 0, z + Math.cos(a1) * sw), V(x + Math.sin(a1) * sw, h, z + Math.cos(a1) * sw), V(x + Math.sin(a0) * sw, h, z + Math.cos(a0) * sw), cs.clone().multiplyScalar(0.7), cs, cs, nS, nS, nS);
      const nC = V(Math.sin(am) * 0.6, 0.8, Math.cos(am) * 0.6).normalize();
      s.tri(V(x + Math.sin(a0) * rad, h, z + Math.cos(a0) * rad), V(x + Math.sin(a1) * rad, h, z + Math.cos(a1) * rad), V(x, h + rad * 0.7, z), cc.clone().multiplyScalar(0.7), cc.clone().multiplyScalar(0.7), cc.clone().lerp(C('#ffffff'), 0.35), nC, nC, nC);
    }
  }
  return s.geometry();
}

/** low-poly pine for the procedural fallback (when the kit is unavailable) */
export function pineFallbackGeo(seed = 1, { height = 6 } = {}) {
  const r = new Rng(`pine${seed}`), s = new Soup();
  const trunk = C('#5c4330'), dark = C('#264a36'), light = C('#5f9460');
  const tiers = 4;
  const trunkH = height * 0.28;
  const tseg = 5;
  for (let k = 0; k < tseg; k++) {
    const a0 = (k / tseg) * Math.PI * 2, a1 = ((k + 1) / tseg) * Math.PI * 2, am = (a0 + a1) / 2, rb = 0.3, rt = 0.18, n = V(Math.sin(am), 0.1, Math.cos(am)).normalize();
    s.tri(V(Math.sin(a0) * rb, 0, Math.cos(a0) * rb), V(Math.sin(a1) * rb, 0, Math.cos(a1) * rb), V(Math.sin(a0) * rt, trunkH, Math.cos(a0) * rt), trunk.clone().multiplyScalar(0.7), trunk.clone().multiplyScalar(0.7), trunk, n, n, n);
    s.tri(V(Math.sin(a1) * rb, 0, Math.cos(a1) * rb), V(Math.sin(a1) * rt, trunkH, Math.cos(a1) * rt), V(Math.sin(a0) * rt, trunkH, Math.cos(a0) * rt), trunk.clone().multiplyScalar(0.7), trunk, trunk, n, n, n);
  }
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y0 = trunkH * 0.7 + f * height * 0.46, rad = (1 - f * 0.7) * height * 0.28, h = height * 0.34, seg = 7, off = r.range(0, 1);
    const topP = V(0, y0 + h, 0);
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2 + off, a1 = ((k + 1) / seg) * Math.PI * 2 + off, am = (a0 + a1) / 2, n = V(Math.sin(am) * 0.7, 0.55, Math.cos(am) * 0.7).normalize();
      const cb = lerpC(dark, light, f * 0.6).multiplyScalar(0.85), ct = lerpC(dark, light, 0.35 + f * 0.5);
      s.tri(V(Math.sin(a0) * rad, y0, Math.cos(a0) * rad), V(Math.sin(a1) * rad, y0, Math.cos(a1) * rad), topP, cb, cb, ct, n, n, n);
    }
  }
  return s.geometry();
}

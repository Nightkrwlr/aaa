/**
 * Terrain — deterministic heightfield from authored features (plateaus, ramps, paths) + low-frequency noise.
 * Pure math (no Three.js) so nav, spawns, tests and the renderer all use the exact same ground.
 */
import { Rng, hashString } from '../../core/rng.js';
import { clamp, smooth } from '../../core/math.js';

function valueNoise(seed) {
  const perm = new Uint8Array(512);
  const r = new Rng(`noise:${seed}`);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const g = (x, z) => perm[(perm[x & 255] + z) & 255] / 255;
  return (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = smooth(xf), v = smooth(zf);
    const a = g(xi, zi), b = g(xi + 1, zi), c = g(xi, zi + 1), d = g(xi + 1, zi + 1);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  };
}

function segInfo(px, pz, pts) {
  // nearest point on polyline: returns {d, t (0..1 along), h interpolated}
  let best = { d: Infinity, t: 0, h: 0 }, acc = 0;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, ah] = pts[i], [bx, bz, bh] = pts[i + 1];
    const abx = bx - ax, abz = bz - az, l2 = abx * abx + abz * abz || 1;
    const t = clamp(((px - ax) * abx + (pz - az) * abz) / l2, 0, 1);
    const d = Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
    if (d < best.d) best = { d, t: (acc + Math.sqrt(l2) * t) / total, h: (ah ?? 0) + ((bh ?? 0) - (ah ?? 0)) * t };
    acc += Math.sqrt(l2);
  }
  return best;
}

export class Terrain {
  constructor(def) {
    this.def = def;
    const t = def.terrain;
    this.base = t.base ?? 0;
    this.noise = valueNoise(def.seed);
    this.noise2 = valueNoise(def.seed + ':b');
    this.amp = t.noiseAmp ?? 0.5;
    this.scale = t.noiseScale ?? 0.05;
    this.plateaus = t.plateaus ?? [];
    this.ramps = t.ramps ?? [];
    this.paths = t.paths ?? [];
    this.ox = def.origin[0]; this.oz = def.origin[1];
    this.w = def.size[0]; this.d = def.size[1];
  }

  /** ground height at world (x,z) */
  heightAt(x, z) {
    let h = this.base;
    const n = (this.noise(x * this.scale, z * this.scale) - 0.5) * 2 + (this.noise2(x * this.scale * 2.3, z * this.scale * 2.3) - 0.5) * 0.5;
    let flat = 1; // damp noise on authored flats
    for (const p of this.plateaus) {
      const dx = (x - p.c[0]) / p.r[0], dz = (z - p.c[1]) / p.r[1];
      const r = Math.hypot(dx, dz);
      const f = p.feather / Math.min(p.r[0], p.r[1]);
      // t = 1 inside, 0 outside, smooth across feather band at the rim
      const tt = clamp((1 + f * 0.5 - r) / f, 0, 1);
      const t = smooth(tt);
      h = h + (p.h - h) * t;
      if (t > 0.05) flat = Math.min(flat, 1 - t * 0.85);
    }
    h += n * this.amp * flat;
    for (const rp of this.ramps) {
      const s = segInfo(x, z, rp.points);
      if (s.d < rp.width * 1.4) {
        const w = 1 - smooth(clamp((s.d - rp.width * 0.55) / (rp.width * 0.85), 0, 1));
        h = h + (s.h - h) * w;
      }
    }
    return h;
  }

  slopeAt(x, z) {
    const e = 0.6;
    const hx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const hz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return Math.hypot(hx, hz);
  }

  /** ground tint layer id for painting (0 grass/lichen, 1 limestone, 2 path, 3 rock, 4 dark soil) */
  pathStrength(x, z) {
    let best = 0;
    for (const p of this.paths) {
      const s = segInfo(x, z, p.points.map((q) => [q[0], q[1], 0]));
      const k = 1 - smooth(clamp((s.d - p.width * 0.5) / (p.width * 0.9), 0, 1));
      if (k > best) best = k;
    }
    return best;
  }
}

/**
 * Procedural, tileable noise textures (CPU generated once, no external files).
 * One RGBA8 texture packs four different noise "flavours" so the terrain / prop shaders can build painterly detail
 * from a single fetch per scale:
 *   R  soft fbm (cloud-like blotches)           G  cellular (pebbles / cracks / cobbles)
 *   B  fine grain (4-octave high frequency)      A  stretched fbm (brush strokes, grass streaks, rock strata)
 */
import * as THREE from 'three';

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** periodic value noise: lattice of `fx` x `fy` cells wrapping over the unit square */
function pnoise(u, v, fx, fy, seed) {
  const x = u * fx, y = v * fy;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = fade(x - x0), ty = fade(y - y0);
  const xa = ((x0 % fx) + fx) % fx, xb = (xa + 1) % fx, ya = ((y0 % fy) + fy) % fy, yb = (ya + 1) % fy;
  const a = hash2(xa, ya, seed), b = hash2(xb, ya, seed), c = hash2(xa, yb, seed), d = hash2(xb, yb, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function fbm(u, v, fx, fy, oct, seed) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * pnoise(u, v, fx << i, fy << i, seed + i * 17); n += a; a *= 0.5; }
  return s / n;
}
/** periodic cellular noise (F1 distance), jittered grid of f x f cells */
function worley(u, v, f, seed) {
  const x = u * f, y = v * f, xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const wx = ((cx % f) + f) % f, wy = ((cy % f) + f) % f;
    const px = cx + hash2(wx, wy, seed), py = cy + hash2(wx, wy, seed + 101);
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < best) best = d;
  }
  return Math.min(1, Math.sqrt(best));
}

let cached = null;
/** @returns {THREE.DataTexture} 256² RGBA8 tileable noise, mipmapped, repeat-wrapped */
export function getNoiseTexture(size = 256) {
  if (cached) return cached;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const u = i / size, v = j / size, k = (j * size + i) * 4;
    const r = fbm(u, v, 4, 4, 5, 3);
    const g = worley(u, v, 10, 7);
    const b = fbm(u, v, 32, 32, 3, 11);
    const a = fbm(u, v, 3, 24, 4, 19);
    // contrast-stretch the (naturally mid-grey) fbm channels so shaders can use them directly as 0..1 masks
    const st = (x) => Math.max(0, Math.min(1, (x - 0.5) * 1.9 + 0.5));
    data[k] = st(r) * 255; data[k + 1] = (1 - g) * 255; data[k + 2] = st(b) * 255; data[k + 3] = st(a) * 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  t.userData = { shared: true };
  cached = t;
  return t;
}

/** deterministic cheap 1-D/2-D value noise for CPU-side placement code (not periodic) */
export function vnoise(x, z, seed = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), tx = fade(x - xi), tz = fade(z - zi);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed), c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
export function fbm2(x, z, oct = 3, seed = 0) { let s = 0, a = 0.5, n = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f, seed + i * 31); n += a; a *= 0.5; f *= 2; } return s / n; }
export { hash2 };

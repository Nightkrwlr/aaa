/**
 * Terrain — a chunked, variable-resolution heightfield grid (fine around the playable zone, coarse mountain-wall "skirt"
 * beyond it so the world never ends in a void) drawn with a procedural painterly shader:
 *   • control maps (path, lushness, biome tint, curvature/AO, plaza paving, moss, wear) baked from the sim's Terrain + areas,
 *   • slope / height / curvature driven blending between grass, dust, worn path, cobbles and faceted stratified limestone cliffs,
 *   • multi-scale tileable noise (no external textures), drifting cloud shadows, shared height fog (see atmosphere.js).
 * Ground height is exactly `zone.heightAt` inside the zone, so nothing placed with it floats or sinks.
 */
import * as THREE from 'three';
import { getNoiseTexture, fbm2, vnoise } from './noiseTex.js';
import { WORLD, WORLD_GLSL, bindWorldUniforms } from './atmosphere.js';

const C = (h) => new THREE.Color(h);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** biome identity: lushness (grass vs. bare limestone dust) and warm(1)/cool(0) tint */
const BIOME = {
  limestone_dawn: { lush: 0.88, tint: 0.5 }, settlement: { lush: 0.28, tint: 0.56 }, windharp: { lush: 0.82, tint: 0.42 },
  quarry: { lush: 0.10, tint: 1.0 }, overlook: { lush: 0.58, tint: 0.6 }, choir: { lush: 0.16, tint: 0.0 },
};

/** half-size of the mountain-wall skirt around the playable zone (metres) */
const SKIRT = 380;

/** grid line coordinates: fine inside [a,b], spacing doubling outwards every 6 steps */
function gridLines(a, b, s0) {
  const xs = [];
  for (let x = a; x < b - 1e-6; x += s0) xs.push(+x.toFixed(4));
  xs.push(b);
  let lo = a, hi = b, sp = s0 * 2;
  const lowerSide = [], upperSide = [];
  while (b + (hi - b) < b + SKIRT) {
    for (let k = 0; k < 6; k++) { hi += sp; lo -= sp; upperSide.push(+hi.toFixed(3)); lowerSide.push(+lo.toFixed(3)); }
    sp *= 2;
    if (hi - b > SKIRT) break;
  }
  return [...lowerSide.reverse(), ...xs, ...upperSide];
}

/** world height: the zone's own heightfield inside, rising rocky terraced walls outside the playable bounds */
function makeHeightFn(zone) {
  const b = zone.bounds, seed = 11;
  const inside = (x, z) => zone.heightAt(x, z);
  return (x, z) => {
    const h0 = inside(x, z);
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    const d = Math.hypot(dx, dz);
    if (d <= 0) return h0;
    // blend region: the skirt starts exactly at the zone edge (C0) and rises with craggy, terraced ridges
    const edge = Math.max(0, Math.min(1, d / 4));
    const base = inside(Math.min(Math.max(x, b.x0), b.x1), Math.min(Math.max(z, b.z0), b.z1));
    const rn = fbm2(x * 0.045, z * 0.045, 4, seed), rn2 = fbm2(x * 0.11 + 9, z * 0.11, 3, seed + 5);
    const rise = 52 * Math.pow(sstep(0, 42, d), 1.15) + 38 * sstep(30, 140, d);
    let w = rise * (0.62 + 0.75 * rn) + (rn2 - 0.5) * 9 * sstep(2, 30, d);
    const step = 5.2; w = w + (Math.floor(w / step) * step + sstep(0.15, 0.85, (w / step) % 1) * step - w) * 0.5 * sstep(4, 26, d);
    const wallH = base + Math.max(0, w);
    // smooth-max with the zone's own heightfield (which keeps extending beyond the edge: cliff plateaus)
    const k = 3;
    const hh = Math.max(h0, wallH) + Math.pow(Math.max(0, k - Math.abs(h0 - wallH)) / k, 2) * k * 0.25;
    return h0 + (hh - h0) * edge;
  };
}

/** control maps (RGBA8 each, 2 texels per metre over the zone) */
function buildControlMaps(zone, H) {
  const [W, Ht] = zone.def.size, [ox, oz] = zone.def.origin;
  const res = 2, nx = W * res, nz = Ht * res;
  const c1 = new Uint8Array(nx * nz * 4), c2 = new Uint8Array(nx * nz * 4), slopeArr = new Float32Array(nx * nz), hCpu = new Float32Array(nx * nz);
  // height raster at texel centres for curvature
  const hr = new Float32Array((nx + 8) * (nz + 8));
  const hw = nx + 8;
  for (let j = -4; j < nz + 4; j++) for (let i = -4; i < nx + 4; i++) hr[(j + 4) * hw + i + 4] = H(ox + (i + 0.5) / res, oz + (j + 0.5) / res);
  const hAt = (i, j) => hr[(Math.min(nz + 3, Math.max(-4, j)) + 4) * hw + Math.min(nx + 3, Math.max(-4, i)) + 4];
  const areas = zone.areas;
  const pois = zone.pois ?? [];
  const pave = [];
  for (const p of pois) {
    if (p.type === 'area_mark' && p.id.includes('settlement')) pave.push({ x: p.x, z: p.z, r0: 7.5, r1: 11.5, s: 1.0, plaza: true });
    else if (p.type === 'waypoint') pave.push({ x: p.x, z: p.z, r0: 2.2, r1: 3.6, s: 0.95 });
    else if (p.type === 'station' || p.type === 'stash' || p.type === 'chart') pave.push({ x: p.x, z: p.z, r0: 1.6, r1: 2.8, s: 0.85 });
    else if (p.type === 'gate') pave.push({ x: p.x, z: p.z, r0: 4.5, r1: 7.5, s: 0.9 });
    else if (p.type === 'arena' && p.id.includes('boss')) pave.push({ x: p.x, z: p.z, r0: 9.5, r1: 15.5, s: 0.55, ring: true });
  }
  for (const s of zone.def.structures ?? []) if (s.kind === 'windharp' || s.kind === 'cylinder') pave.push({ x: s.pos[0], z: s.pos[1], r0: 2.0, r1: 3.4, s: 0.7 });
  const lushOf = (x, z) => {
    let sw = 0.25, sl = 0.78 * 0.25, st = 0.5 * 0.25;
    for (const a of areas) {
      const d = Math.sqrt(((x - a.c[0]) / a.r[0]) ** 2 + ((z - a.c[1]) / a.r[1]) ** 2);
      const w = 1 - sstep(0.72, 1.3, d);
      if (w <= 0) continue;
      const bi = BIOME[a.biome] ?? BIOME.limestone_dawn;
      sw += w; sl += w * bi.lush; st += w * bi.tint;
    }
    return [sl / sw, st / sw];
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = ox + (i + 0.5) / res, z = oz + (j + 0.5) / res;
    const k = (j * nx + i) * 4;
    const path = zone.terrain.pathStrength(x, z);
    const [lush, tint] = lushOf(x, z);
    const h = hAt(i, j);
    hCpu[j * nx + i] = h;
    slopeArr[j * nx + i] = Math.hypot(hAt(i + 1, j) - hAt(i - 1, j), hAt(i, j + 1) - hAt(i, j - 1)) * 0.5 * res;
    // curvature at two scales (laplacian): + concave (occluded), - convex (exposed edge)
    const l1 = (hAt(i - 2, j) + hAt(i + 2, j) + hAt(i, j - 2) + hAt(i, j + 2)) * 0.25 - h;
    const l2 = (hAt(i - 4, j) + hAt(i + 4, j) + hAt(i, j - 4) + hAt(i, j + 4)) * 0.25 - h;
    const curv = 0.5 - (l1 * 0.55 + l2 * 0.2) * 0.9;
    c1[k] = clamp01(path) * 255; c1[k + 1] = clamp01(lush) * 255; c1[k + 2] = clamp01(tint) * 255; c1[k + 3] = clamp01(curv) * 255;
    let pv = 0, plaza = 0;
    for (const p of pave) {
      const d = Math.hypot(x - p.x, z - p.z);
      let m = 1 - sstep(p.r0, p.r1, d);
      if (p.ring) m = sstep(p.r0 - 3, p.r0, d) * (1 - sstep(p.r0 + 2, p.r1, d)) * 0.8;
      m *= p.s; if (m > pv) pv = m; if (p.plaza && m > plaza) plaza = m;
    }
    const moss = clamp01((fbm2(x * 0.12, z * 0.12, 3, 41) - 0.35) * 2.2) * lush;
    c2[k] = clamp01(pv) * 255; c2[k + 1] = moss * 255; c2[k + 2] = 0; c2[k + 3] = clamp01(plaza) * 255;   // .b = prop contact AO (painted later)
  }
  const mk = (data) => {
    const t = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; t.userData = { shared: false };
    return t;
  };
  return { t1: mk(c1), t2: mk(c2), rect: new THREE.Vector4(ox, oz, 1 / W, 1 / Ht), cpu: { c1, c2, slope: slopeArr, h: hCpu, nx, nz, ox, oz, res } };
}

// ───────────────────────────────────────────────── shader
const VERT_PARS = `
varying vec3 vWP; varying vec3 vWN;
`;
const FRAG_PARS = `
varying vec3 vWP; varying vec3 vWN;
uniform sampler2D tCtrl1; uniform sampler2D tCtrl2; uniform vec4 uRect;
uniform vec3 uGrassA, uGrassB, uGrassDry, uDust, uPathA, uPathB, uRockA, uRockB, uRockC, uMoss, uQuarry, uChoir, uCobA, uCobB;
uniform vec4 uBounds;  // x0, z0, x1, z1
uniform float uFacet, uDetail;
${WORLD_GLSL.frag}
float gRock; float gCloud;
float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
vec3 triN(vec3 wp, vec3 w, float s){ return texture2D(uNoise, wp.zy * s).rgb * w.x + texture2D(uNoise, wp.xz * s).rgb * w.y + texture2D(uNoise, wp.xy * s).rgb * w.z; }
vec3 terrainAlbedo(vec3 wp, vec3 n, out float ao){
  vec2 cuv = (wp.xz - uRect.xy) * uRect.zw;
  vec4 c1 = texture2D(tCtrl1, cuv), c2 = texture2D(tCtrl2, cuv);
  float path = c1.r, lush = c1.g, tint = c1.b, curv = c1.a;
  float pave = c2.r, moss = c2.g, wear = c2.b, plaza = c2.a;
  float slope = 1.0 - n.y;
  vec4 nL = texture2D(uNoise, wp.xz * 0.012);
  vec4 nM = texture2D(uNoise, wp.xz * 0.046 + 0.31);
  vec4 nS = texture2D(uNoise, wp.xz * 0.21 + 0.67);
  vec4 nF = texture2D(uNoise, wp.xz * 0.95 + 0.13);
  vec4 nX = texture2D(uNoise, wp.xz * 3.1 + 0.51);
  float blotch = nL.r * 0.55 + nM.r * 0.45;
  // ───── ground: grass ↔ dry grass ↔ dust
  vec3 grass = mix(uGrassA, uGrassB, smoothstep(0.30, 0.72, blotch));
  grass = mix(grass, uGrassDry, smoothstep(0.55, 0.85, nM.r * 0.6 + nL.r * 0.5 - lush * 0.35));
  grass *= 0.88 + 0.24 * nS.r;
  grass *= 0.92 + 0.16 * mix(nF.r, nX.b, 0.5);
  vec3 dust = mix(uDust, uDust * vec3(1.10, 1.04, 0.88), nM.r);
  dust *= 0.9 + 0.2 * nF.b;
  float dryAmt = smoothstep(0.34, 0.68, 1.0 - lush + (nM.r - 0.5) * 0.55 + (nS.r - 0.5) * 0.18);
  vec3 ground = mix(grass, dust, dryAmt);
  // biome tints
  float warm = smoothstep(0.62, 1.0, tint), cool = 1.0 - smoothstep(0.0, 0.38, tint);
  ground = mix(ground, ground * 0.8 + uQuarry * 0.55, warm * 0.55);
  ground = mix(ground, ground * 0.78 + uChoir * 0.6, cool * 0.7);
  // ───── rock: triplanar, stratified, cracked
  vec3 tw = pow(abs(n), vec3(5.0)); tw /= (tw.x + tw.y + tw.z);
  vec3 tr1 = triN(wp, tw, 0.075), tr2 = triN(wp, tw, 0.31);
  float strata = wp.y * 0.62 + tr1.r * 1.35 + (nM.r - 0.5) * 0.9;
  float band = floor(strata), fr = fract(strata);
  float bl = h11(band * 1.7 + 3.0);
  vec3 rock = mix(uRockA, uRockB, bl);
  rock = mix(rock, uRockC, smoothstep(0.78, 1.0, fr) * 0.55 + smoothstep(0.2, 0.0, fr) * 0.18 * (1.0 - bl));
  rock *= 0.8 + 0.4 * tr2.b;
  float crack = 1.0 - smoothstep(0.22, 0.5, tr1.g);
  rock *= 1.0 - crack * 0.38;
  rock *= 0.9 + 0.2 * tr2.r;
  float rockMask = smoothstep(0.17, 0.33, slope + (tr1.r - 0.5) * 0.22 + (nS.r - 0.5) * 0.08);
  // rocky outcrops on flat ground in dry biomes
  rockMask = max(rockMask, smoothstep(0.80, 0.95, nM.b * 0.5 + nL.g * 0.5 + (1.0 - lush) * 0.18) * (1.0 - path) * 0.55);
  // ledges: flat-ish rock tops carry moss / grass
  float ledge = rockMask * smoothstep(0.7, 0.97, n.y) ;
  rock = mix(rock, mix(uMoss, grass, 0.4), ledge * 0.7 * smoothstep(0.3, 0.7, lush + moss));
  vec3 col = mix(ground, rock, rockMask);
  // moss patches in damp, lush places and on shaded rock
  col = mix(col, uMoss * (0.85 + 0.3 * nS.r), moss * 0.45 * (1.0 - path) * smoothstep(0.3, 0.8, nL.r + 0.1));
  // ───── worn path
  float pw = path + (nS.r - 0.5) * 0.3 + (nF.r - 0.5) * 0.12;
  float pathMask = smoothstep(0.34, 0.62, pw) * (1.0 - rockMask * 0.85);
  vec3 pcol = mix(uPathA, uPathB, smoothstep(0.3, 0.8, nM.r + nF.g * 0.2));
  pcol *= 0.88 + 0.24 * nF.b;
  float peb = smoothstep(0.62, 0.72, nS.g * nF.g * 1.9);
  pcol = mix(pcol, uPathB * 1.12, peb * 0.55);
  float trim = smoothstep(0.12, 0.38, pw) * (1.0 - smoothstep(0.38, 0.62, pw));
  col *= 1.0 - trim * 0.12;
  col = mix(col, pcol, pathMask);
  // ───── cobbles (plaza / waypoint pads): worley cells from the noise's cell channel
  float cell = texture2D(uNoise, wp.xz * 0.34).g;
  float cell2 = texture2D(uNoise, wp.xz * 0.34 + vec2(0.5, 0.25)).g;
  float joint = smoothstep(0.30, 0.52, cell);
  float pm = smoothstep(0.38, 0.7, pave + (nS.r - 0.5) * 0.35) * (1.0 - rockMask);
  float stoneId = floor(cell2 * 6.0);
  vec3 cob = mix(uCobA, uCobB, h11(stoneId * 3.7 + floor(cell * 5.0)));
  cob *= 0.86 + 0.26 * nF.r;
  cob = mix(cob * 0.55, cob, joint);
  col = mix(col, cob, pm * smoothstep(0.1, 0.4, joint + 0.35));
  col = mix(col, cob, pm * 0.65);
  // contact shadow blobs painted by props (trees, rocks, buildings)
  col *= 1.0 - wear * 0.55;
  // ───── baked curvature AO / edge highlight
  ao = mix(0.5, 1.0, smoothstep(0.1, 0.5, curv));
  col *= mix(1.0, 1.14, smoothstep(0.55, 0.9, curv) * rockMask);
  gRock = rockMask;
  // beyond the playable bounds everything becomes rocky, colder and darker (reads as a mountain wall, hides the border)
  float out_ = max(max(uBounds.x - wp.x, wp.x - uBounds.z), max(uBounds.y - wp.z, wp.z - uBounds.w));
  float o = smoothstep(-2.0, 12.0, out_);
  col = mix(col, rock * vec3(0.92, 0.94, 1.0), o * 0.85);
  gRock = max(gRock, o * smoothstep(0.1, 0.25, slope));
  return col;
}
`;

function makeTerrainMaterial(maps, zone, q) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.97, metalness: 0 });
  const b = zone.bounds;
  const U = {
    tCtrl1: { value: maps.t1 }, tCtrl2: { value: maps.t2 }, uRect: { value: maps.rect },
    uGrassA: { value: C('#4f7a45') }, uGrassB: { value: C('#7e9c52') }, uGrassDry: { value: C('#a39a5c') }, uDust: { value: C('#c9bd9c') },
    uPathA: { value: C('#bfa97e') }, uPathB: { value: C('#d9c9a2') }, uRockA: { value: C('#9a8f7c') }, uRockB: { value: C('#7b7263') }, uRockC: { value: C('#cfc3a8') },
    uMoss: { value: C('#4b7048') }, uQuarry: { value: C('#b59468') }, uChoir: { value: C('#8d869c') }, uCobA: { value: C('#b7ab92') }, uCobB: { value: C('#8f8672') },
    uBounds: { value: new THREE.Vector4(b.x0, b.z0, b.x1, b.z1) }, uFacet: { value: 0.85 }, uDetail: { value: q?.detail ?? 1 },
  };
  m.userData.U = U;
  m.onBeforeCompile = (s) => {
    bindWorldUniforms(s);
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWP = position; vWN = normal;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
 float gAO;
 vec3 nW = normalize(vWN);
 diffuseColor.rgb = terrainAlbedo(vWP, nW, gAO) * gAO;
 gCloud = cloudShade(vWP);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
 { vec3 fdx = dFdx(vViewPosition); vec3 fdy = dFdy(vViewPosition); vec3 fn = normalize(cross(fdx, fdy)); normal = normalize(mix(normal, fn, gRock * uFacet)); }`)
      .replace('#include <opaque_fragment>', 'outgoingLight *= mix(1.0, gCloud, 0.85);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'terrain-v1';
  return m;
}

/**
 * @param {any} zone built zone (heightAt, bounds, areas, terrain…)
 * @param {{detail?:number, fine?:number}} q fine = grid spacing inside the zone (0.5 high, 1 low)
 */
export function buildTerrainMesh(zone, q = {}) {
  const s0 = q.fine ?? 0.5;
  const b = zone.bounds;
  const Hf = makeHeightFn(zone);
  const xs = gridLines(b.x0, b.x1, s0), zs = gridLines(b.z0, b.z1, s0);
  const NX = xs.length, NZ = zs.length;
  const Hh = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) Hh[j * NX + i] = Hf(xs[i], zs[j]);
  const nrm = new Float32Array(NX * NZ * 3);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(NX - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(NZ - 1, j + 1);
    const dhx = (Hh[j * NX + i1] - Hh[j * NX + i0]) / (xs[i1] - xs[i0]), dhz = (Hh[j1 * NX + i] - Hh[j0 * NX + i]) / (zs[j1] - zs[j0]);
    const l = Math.hypot(dhx, 1, dhz), k = (j * NX + i) * 3;
    nrm[k] = -dhx / l; nrm[k + 1] = 1 / l; nrm[k + 2] = -dhz / l;
  }
  const maps = buildControlMaps(zone, Hf);
  const material = makeTerrainMaterial(maps, zone, q);
  const group = new THREE.Group(); group.name = 'terrain';
  const CH = 36;
  for (let cj = 0; cj < NZ - 1; cj += CH) for (let ci = 0; ci < NX - 1; ci += CH) {
    const w = Math.min(CH, NX - 1 - ci), h = Math.min(CH, NZ - 1 - cj);
    const vc = (w + 1) * (h + 1);
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3);
    let k = 0;
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const gi = ci + i, gj = cj + j, g = gj * NX + gi;
      pos[k] = xs[gi]; pos[k + 1] = Hh[g]; pos[k + 2] = zs[gj];
      nor[k] = nrm[g * 3]; nor[k + 1] = nrm[g * 3 + 1]; nor[k + 2] = nrm[g * 3 + 2];
      k += 3;
    }
    const idx = new Uint16Array(w * h * 6); let q2 = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const a = j * (w + 1) + i, bb = a + 1, c = a + w + 1, d = c + 1;
      const ha = pos[a * 3 + 1], hb = pos[bb * 3 + 1], hc = pos[c * 3 + 1], hd = pos[d * 3 + 1];
      if (Math.abs(ha - hd) < Math.abs(hb - hc)) { idx[q2++] = a; idx[q2++] = c; idx[q2++] = d; idx[q2++] = a; idx[q2++] = d; idx[q2++] = bb; }
      else { idx[q2++] = a; idx[q2++] = c; idx[q2++] = bb; idx[q2++] = bb; idx[q2++] = c; idx[q2++] = d; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, material);
    mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = `terrain_${ci}_${cj}`;
    // chunks beyond the playable area never need shadows → cheaper shadow-receiving shaders are not worth a second material; keep one
    group.add(mesh);
  }
  const cp = maps.cpu;
  /** CPU-side read of the baked ground description at (x,z): used by scatter code so props agree with the shader */
  const sample = (x, z) => {
    const i = Math.min(cp.nx - 1, Math.max(0, Math.floor((x - cp.ox) * cp.res))), j = Math.min(cp.nz - 1, Math.max(0, Math.floor((z - cp.oz) * cp.res)));
    const k = (j * cp.nx + i) * 4;
    return { h: zone.heightAt(x, z), slope: cp.slope[j * cp.nx + i], path: cp.c1[k] / 255, lush: cp.c1[k + 1] / 255, tint: cp.c1[k + 2] / 255, curv: cp.c1[k + 3] / 255, pave: cp.c2[k] / 255, moss: cp.c2[k + 1] / 255, ao: cp.c2[k + 2] / 255, plaza: cp.c2[k + 3] / 255 };
  };
  /** stamp soft contact-shadow blobs (trees, rocks, buildings) into the ground's AO channel: [{x,z,r,k?}] */
  const paintAO = (list) => {
    const c2 = cp.c2;
    for (const o of list) {
      const rr = o.r * 1.9, k = o.k ?? 0.8;
      const i0 = Math.max(0, Math.floor((o.x - rr - cp.ox) * cp.res)), i1 = Math.min(cp.nx - 1, Math.ceil((o.x + rr - cp.ox) * cp.res));
      const j0 = Math.max(0, Math.floor((o.z - rr - cp.oz) * cp.res)), j1 = Math.min(cp.nz - 1, Math.ceil((o.z + rr - cp.oz) * cp.res));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(cp.ox + (i + 0.5) / cp.res - o.x, cp.oz + (j + 0.5) / cp.res - o.z) / rr;
        if (d >= 1) continue;
        const w = (1 - d) * (1 - d) * k * 255, idx = (j * cp.nx + i) * 4 + 2;
        if (w > c2[idx]) c2[idx] = w;
      }
    }
    maps.t2.needsUpdate = true;
  };
  const resetAO = () => { const c2 = cp.c2; for (let i = 2; i < c2.length; i += 4) c2[i] = 0; maps.t2.needsUpdate = true; };
  group.userData = { material, maps, heightFn: Hf, sample, paintAO, resetAO, dispose() { maps.t1.dispose(); maps.t2.dispose(); } };
  return group;
}

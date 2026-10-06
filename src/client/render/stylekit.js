/**
 * stylekit — procedural parts in the same visual language as the KayKit art: chunky, bevelled low-poly shapes with a
 * baked top-lit gradient (the KayKit atlas is a palette of vertical gradients), strong colour blocking and emissive
 * accents. Used for weapons/props carried by rigged characters and for every non-humanoid creature.
 *
 *   const m = P('rbox', [0.5, 0.4, 0.8, 0.08], '#8a7a68', { pos:[0,0.5,0] })       // bevelled block
 *   P('tube', [[[0,0,0],[0,0.4,0.2],[0,0.9,0.1]], 0.12, 0.02], '#d9cbb0')           // tapered horn / tail / tendril
 *   P('lathe', [[[0.0,0],[0.3,0.05],[0.36,0.4],[0.2,0.5]]], '#c9954a')              // bell / urn (profile x=radius,y=height)
 *   P('sph', [0.1], '#7fe3ff', { glow: 2.4 })                                       // unlit emissive accent (blooms)
 *
 * Geometry is cached by shape+colour so a pack of 30 creatures shares GPU buffers; materials are shared per kind.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;
const _c = new THREE.Color();
const geoCache = new Map();

/** lighten (k>0) or darken (k<0) a hex colour, returns hex string */
export function shade(hex, k) {
  _c.set(hex);
  if (k >= 0) _c.lerp(new THREE.Color('#ffffff'), k); else _c.lerp(new THREE.Color('#000000'), -k);
  return `#${_c.getHexString()}`;
}
export function mix(a, b, t) { _c.set(a).lerp(new THREE.Color(b), t); return `#${_c.getHexString()}`; }

// ───────────────────────── geometry factories (unit cached)
function cached(key, make) { let g = geoCache.get(key); if (!g) { g = make(); g.userData.shared = true; geoCache.set(key, g); } return g; }

/** tapered tube along a Catmull-Rom path: used for horns, tails, tendrils, spider legs, worm bodies */
export function taperedTube(points, r0, r1, { segs = 10, radial = 6, closed = false, curve = 'catmullrom' } = {}) {
  const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const path = new THREE.CatmullRomCurve3(pts, closed, curve, 0.5);
  const frames = path.computeFrenetFrames(segs, closed);
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = path.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * PI * 2, cx = Math.cos(a), sy = Math.sin(a);
      const nx = N.x * cx + B.x * sy, ny = N.y * cx + B.y * sy, nz = N.z * cx + B.z * sy;
      pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r); nor.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  // cap the thick end with a blunt dome so there is never a visible hole
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function make(kind, a) {
  switch (kind) {
    case 'rbox': return new RoundedBoxGeometry(a[0], a[1], a[2], a[4] ?? 2, Math.min(a[3] ?? 0.06, Math.min(a[0], a[1], a[2]) * 0.49));
    case 'box': return new THREE.BoxGeometry(a[0], a[1], a[2]);
    case 'cyl': return new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] ?? 8, 1);
    case 'cone': return new THREE.ConeGeometry(a[0], a[1], a[2] ?? 6, 1);
    case 'sph': return new THREE.SphereGeometry(a[0], a[1] ?? 10, a[2] ?? 8);
    case 'ico': return new THREE.IcosahedronGeometry(a[0], a[1] ?? 0);
    case 'oct': return new THREE.OctahedronGeometry(a[0], a[1] ?? 0);
    case 'dodeca': return new THREE.DodecahedronGeometry(a[0], a[1] ?? 0);
    case 'tor': return new THREE.TorusGeometry(a[0], a[1], a[2] ?? 6, a[3] ?? 18);
    case 'lathe': return new THREE.LatheGeometry(a[0].map((p) => new THREE.Vector2(p[0], p[1])), a[1] ?? 12);
    case 'tube': return taperedTube(a[0], a[1], a[2], a[3] ?? {});
    case 'plane': return new THREE.PlaneGeometry(a[0], a[1]);
    case 'capsule': return new THREE.CapsuleGeometry(a[0], a[1], a[2] ?? 3, a[3] ?? 8);
    default: throw new Error(`stylekit: unknown shape ${kind}`);
  }
}

/** bake a top-lit gradient (+ faint up/down normal bias) into the vertex colours of a geometry clone */
function colourize(src, hex, top, bot, bias) {
  const g = src.clone(); g.userData.shared = true;
  const pos = g.attributes.position, nor = g.attributes.normal;
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y, span = Math.max(1e-4, y1 - y0);
  const base = new THREE.Color(hex);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) - y0) / span;
    const ny = nor ? nor.getY(i) : 0;
    const f = (bot + (top - bot) * k) * (1 + ny * bias);
    col[i * 3] = Math.min(1.6, base.r * f); col[i * 3 + 1] = Math.min(1.6, base.g * f); col[i * 3 + 2] = Math.min(1.6, base.b * f);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ───────────────────────── materials (shared)
const mats = {};
export function material(kind, key = '') {
  const id = kind + key;
  if (mats[id]) return mats[id];
  let m;
  switch (kind) {
    case 'solid': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.0 }); break;
    case 'flat': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.0, flatShading: true }); break;
    case 'gloss': m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.08 }); break;
    case 'trans': { const o = Number(key) || 0.5; m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, transparent: true, opacity: o, depthWrite: false }); break; }
    case 'glow': { const [hex, inten] = key.split('|'); m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(Number(inten)), toneMapped: false }); break; }
    case 'glowtrans': { const [hex, inten, op] = key.split('|'); m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(Number(inten)), toneMapped: false, transparent: true, opacity: Number(op), depthWrite: false, blending: THREE.AdditiveBlending }); break; }
    default: throw new Error(`stylekit: material ${kind}`);
  }
  m.userData.shared = true;
  mats[id] = m;
  return m;
}

/**
 * Build one mesh.  o: { pos, rot, scale, top, bot, bias, flat, gloss, glow, opacity, name, shadow }
 *   glow → unlit emissive colour × intensity;   opacity → translucent;   top/bot → gradient brightness multipliers
 */
export function P(kind, args, hex, o = {}) {
  const top = o.top ?? 1.16, bot = o.bot ?? 0.74, bias = o.bias ?? 0.1;
  let geo, mat;
  if (o.glow !== undefined) {
    geo = cached(`${kind}|${JSON.stringify(args)}`, () => make(kind, args));
    mat = o.opacity !== undefined && o.opacity < 1 ? material('glowtrans', `${hex}|${o.glow}|${o.opacity}`) : material('glow', `${hex}|${o.glow}`);
  } else {
    const gk = `${kind}|${JSON.stringify(args)}|${hex}|${top}|${bot}|${bias}`;
    geo = cached(gk, () => colourize(make(kind, args), hex, top, bot, bias));
    mat = o.opacity !== undefined && o.opacity < 1 ? material('trans', String(o.opacity)) : material(o.flat ? 'flat' : o.gloss ? 'gloss' : 'solid');
  }
  const m = new THREE.Mesh(geo, mat);
  if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
  if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  if (o.scale !== undefined) { if (Array.isArray(o.scale)) m.scale.set(o.scale[0], o.scale[1], o.scale[2]); else m.scale.setScalar(o.scale); }
  m.castShadow = o.shadow !== false && o.glow === undefined && o.opacity === undefined;
  m.receiveShadow = o.receive === true;
  if (o.name) m.name = o.name;
  return m;
}

/** named joint (Group) — the animation layer finds parts by name */
export function J(name, pos = [0, 0, 0], rot = null) {
  const g = new THREE.Group(); g.name = name; g.position.set(pos[0], pos[1], pos[2]); if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
  return g;
}
export function G(children = [], o = {}) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  if (o.name) g.name = o.name;
  if (o.pos) g.position.set(o.pos[0], o.pos[1], o.pos[2]);
  if (o.rot) g.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  if (o.scale !== undefined) g.scale.setScalar(o.scale);
  return g;
}
export function add(parent, ...kids) { for (const k of kids) if (k) parent.add(k); return parent; }

/** soft radial blob used for contact shadows / glows (texture shared) */
let blobTex = null;
export function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c); blobTex.colorSpace = THREE.SRGBColorSpace;
  return blobTex;
}

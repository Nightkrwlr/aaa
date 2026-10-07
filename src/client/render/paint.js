/**
 * Paint — a tiny mesh builder for procedural architecture/props with the "gradient palette" look of the KayKit art:
 * every part picks a palette swatch (worldMaterials.js) and the swatch gradient runs along the part's height, so pieces get
 * painterly top-light / bottom-shade for free. Parts also carry a surface-pattern id + surface coordinates (metres) used by the
 * paint material to draw stone courses, roof tiles, planks… analytically.
 *
 *   const p = new Paint();
 *   p.box(4, 3, 3, { pos: [0, 1.5, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.06 });
 *   const geometry = p.build();
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { palette, paletteUV } from './worldMaterials.js';

export const PAT = { none: 0, stone: 1, tile: 2, plank: 3, plaster: 4, thatch: 5, rock: 6 };

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _uv = [0, 0];

export class Paint {
  constructor() { this.P = []; this.N = []; this.T = []; this.S = []; this.A = []; this.count = 0; }

  /**
   * add an arbitrary geometry.
   * @param {THREE.BufferGeometry} geometry
   * @param {{pos?:number[], rot?:number[], scale?:number|number[], mat?:string, g?:[number,number], pat?:number, tile?:number, uvMode?:'box'|'cyl', yr?:[number,number], flat?:boolean}} o
   */
  add(geometry, o = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.computeVertexNormals();           // flat, per-face normals
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    g.computeBoundingBox();
    const [y0, y1] = o.yr ?? [g.boundingBox.min.y, g.boundingBox.max.y];
    const span = Math.max(1e-4, y1 - y0);
    const sw = palette(o.mat ?? 'limestone'), [g0, g1] = o.g ?? [0.08, 0.85];
    const tile = o.tile ?? 1, pat = o.pat ?? 0, cyl = o.uvMode === 'cyl';
    const cx = (g.boundingBox.min.x + g.boundingBox.max.x) / 2, cz = (g.boundingBox.min.z + g.boundingBox.max.z) / 2;
    const rAvg = Math.max(0.2, (g.boundingBox.max.x - g.boundingBox.min.x + g.boundingBox.max.z - g.boundingBox.min.z) / 4);
    _q.setFromEuler(_e.set(...(o.rot ?? [0, 0, 0])));
    const sc = o.scale === undefined ? [1, 1, 1] : Array.isArray(o.scale) ? o.scale : [o.scale, o.scale, o.scale];
    _m.compose(_p.set(...(o.pos ?? [0, 0, 0])), _q, _s.set(...sc));
    const nm = new THREE.Matrix3().getNormalMatrix(_m);
    for (let i = 0; i < n; i += 3) {
      // face normal in part space decides the surface projection (one projection per triangle → consistent patterns per face)
      _n.fromBufferAttribute(nor, i);
      const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
      for (let k = 0; k < 3; k++) {
        _a.fromBufferAttribute(pos, i + k);
        const t = g0 + (g1 - g0) * Math.min(1, Math.max(0, (y1 - _a.y) / span));
        paletteUV(sw, t, _uv);
        let su, sv;
        if (cyl && ay < 0.7) { su = Math.atan2(_a.x - cx, _a.z - cz) * rAvg; sv = _a.y; }
        else if (ay >= 0.6) { su = _a.x; sv = _a.z; }
        else if (ax > az) { su = _a.z; sv = _a.y; }
        else { su = _a.x; sv = _a.y; }
        this.T.push(_uv[0], _uv[1]); this.S.push(su * tile, sv * tile); this.A.push(pat);
        _b.copy(_a).applyMatrix4(_m); this.P.push(_b.x, _b.y, _b.z);
        _c.fromBufferAttribute(nor, i + k).applyMatrix3(nm).normalize(); this.N.push(_c.x, _c.y, _c.z);
      }
    }
    this.count += n;
    g.dispose();
    return this;
  }

  box(w, h, d, o = {}) {
    const bevel = o.bevel ?? 0;
    const geo = bevel > 0 ? new RoundedBoxGeometry(w, h, d, o.bevelSeg ?? 1, Math.min(bevel, w / 2.01, h / 2.01, d / 2.01)) : new THREE.BoxGeometry(w, h, d);
    return this.add(geo, o);
  }
  cyl(rTop, rBot, h, seg, o = {}) { return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, o.open ?? false), { uvMode: 'cyl', ...o }); }
  cone(r, h, seg, o = {}) { return this.cyl(0, r, h, seg, o); }
  sphere(r, ws = 8, hs = 5, o = {}) { return this.add(new THREE.SphereGeometry(r, ws, hs), o); }
  ico(r, detail = 0, o = {}) { return this.add(new THREE.IcosahedronGeometry(r, detail), o); }
  torus(r, tube, rs = 6, ts = 14, o = {}) { return this.add(new THREE.TorusGeometry(r, tube, rs, ts), o); }
  /** triangular / polygon prism: `pts` in the XY plane, extruded along Z by `depth` (centered) */
  prism(pts, depth, o = {}) {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); geo.translate(0, 0, -depth / 2);
    return this.add(geo, o);
  }
  /** a pitched roof: two tiled slabs + wall-coloured gables. Ridge along local X. Returns the ridge height. */
  gable(w, d, rise, o = {}) {
    const oh = o.overhang ?? 0.35, th = o.thick ?? 0.16, mat = o.mat ?? 'terracotta', pos = o.pos ?? [0, 0, 0], yaw = o.yaw ?? 0;
    const run = d / 2 + oh, slope = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    const grp = new Paint();
    for (const sgn of [-1, 1]) {
      // slab built with its local Y along the slope (ridge = top = light, eave = bottom = dark) and Z as thickness
      grp.box(w + oh * 2, slope, th, { pos: [0, rise / 2 + th * 0.35, sgn * run / 2], rot: [-sgn * (Math.PI / 2 - ang), 0, 0], mat, pat: o.pat ?? PAT.tile, g: [0.12, 0.78], tile: o.tile ?? 1, ...(o.bevel ? { bevel: o.bevel } : {}) });
    }
    // ridge cap
    grp.box(w + oh * 2 + 0.1, th * 1.6, th * 2.4, { pos: [0, rise + 0.02, 0], mat: o.ridgeMat ?? 'terracotta', g: [0.2, 0.6] });
    // gable triangles (wall material)
    if (o.gables !== false) for (const sx of [-1, 1]) grp.prism([[-d / 2, 0], [d / 2, 0], [0, rise]], 0.1, { pos: [sx * (w / 2 - 0.02), 0, 0], rot: [0, Math.PI / 2, 0], mat: o.gableMat ?? 'plaster', pat: PAT.plaster, g: [0.2, 0.9], yr: [0, rise] });
    this.#merge(grp, pos, yaw);
    return rise;
  }
  #merge(other, pos = [0, 0, 0], yaw = 0) {
    _q.setFromEuler(_e.set(0, yaw, 0)); _m.compose(_p.set(...pos), _q, _s.set(1, 1, 1));
    const nm = new THREE.Matrix3().getNormalMatrix(_m);
    for (let i = 0; i < other.P.length; i += 3) {
      _a.set(other.P[i], other.P[i + 1], other.P[i + 2]).applyMatrix4(_m); this.P.push(_a.x, _a.y, _a.z);
      _b.set(other.N[i], other.N[i + 1], other.N[i + 2]).applyMatrix3(nm).normalize(); this.N.push(_b.x, _b.y, _b.z);
    }
    this.T.push(...other.T); this.S.push(...other.S); this.A.push(...other.A); this.count += other.count;
  }
  /** merge another Paint, placed at pos / yaw */
  merge(other, pos, yaw) { this.#merge(other, pos, yaw); return this; }

  /** an arch-topped stone frame (opening w × h with a semicircular head) extruded `depth`, `border` thick */
  archFrame(w, h, depth, border, o = {}) {
    const hw = w / 2, r = hw;
    const sh = new THREE.Shape(); const ow = hw + border;
    sh.moveTo(-ow, 0); sh.lineTo(ow, 0); sh.lineTo(ow, h); sh.absarc(0, h, ow, 0, Math.PI, false); sh.lineTo(-ow, 0);
    const hole = new THREE.Path(); hole.moveTo(-hw, 0); hole.lineTo(-hw, h); hole.absarc(0, h, hw, Math.PI, 0, true); hole.lineTo(hw, 0); hole.lineTo(-hw, 0);
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 8 });
    geo.translate(0, 0, -depth / 2);
    return this.add(geo, { yr: [0, h + ow], pat: PAT.stone, ...o });
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.T, 2));
    g.setAttribute('aSurf', new THREE.Float32BufferAttribute(this.S, 2));
    g.setAttribute('aPat', new THREE.Float32BufferAttribute(this.A, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

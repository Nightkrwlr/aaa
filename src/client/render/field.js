/**
 * Field — instanced scatter helper. Items are binned into square cells; every (geometry × cell) becomes one InstancedMesh with a
 * tight bounding sphere, so the GPU frustum-culls whole cells and small dressing can also be distance-culled per quality preset.
 * One draw call per visible (kind × cell); no per-frame allocations.
 */
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class Field {
  /** @param {THREE.Object3D} parent @param {{cell?:number}} [o] */
  constructor(parent, o = {}) {
    this.group = new THREE.Group(); this.group.name = o.name ?? 'field'; parent.add(this.group);
    this.cell = o.cell ?? 24;
    this.entries = [];   // { mesh, cx, cz, maxDist, minQ }
    this.instances = 0; this.meshes = 0;
  }

  /**
   * @param {THREE.BufferGeometry} geometry @param {THREE.Material} material
   * @param {{x:number,y:number,z:number,ry?:number,rx?:number,rz?:number,sx?:number,sy?:number,sz?:number,color?:THREE.Color|number|string}[]} items
   * @param {{cast?:boolean, receive?:boolean, maxDist?:number, name?:string, cell?:number}} [o]
   */
  add(geometry, material, items, o = {}) {
    if (!items.length) return [];
    const cell = o.cell ?? this.cell, bins = new Map();
    for (const it of items) {
      const key = `${Math.floor(it.x / cell)},${Math.floor(it.z / cell)}`;
      let b = bins.get(key); if (!b) { b = []; bins.set(key, b); }
      b.push(it);
    }
    const out = [];
    for (const [key, list] of bins) {
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      const hasColor = list.some((it) => it.color !== undefined);
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        _q.setFromEuler(_e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0));
        _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.sx ?? 1, it.sy ?? it.sx ?? 1, it.sz ?? it.sx ?? 1));
        mesh.setMatrixAt(i, _m);
        if (hasColor) mesh.setColorAt(i, it.color === undefined ? _c.set(0xffffff) : (it.color.isColor ? it.color : _c.set(it.color)));
      }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = !!o.cast; mesh.receiveShadow = o.receive !== false;
      mesh.computeBoundingSphere(); mesh.computeBoundingBox?.();
      mesh.name = o.name ?? 'inst';
      this.group.add(mesh);
      const [cx, cz] = key.split(',').map(Number);
      const e = { mesh, cx: (cx + 0.5) * cell, cz: (cz + 0.5) * cell, r: cell * 0.75, maxDist: o.maxDist ?? Infinity };
      this.entries.push(e); out.push(e);
      this.instances += list.length; this.meshes++;
    }
    return out;
  }

  /** distance-cull cells that have a maxDist (call once per frame with the player focus) */
  update(fx, fz, scale = 1) {
    for (const e of this.entries) {
      if (e.maxDist === Infinity) continue;
      const d = Math.hypot(e.cx - fx, e.cz - fz), lim = e.maxDist * scale + e.r;
      e.mesh.visible = d < lim;
    }
  }

  dispose() {
    for (const e of this.entries) e.mesh.dispose?.();
    this.group.removeFromParent();
    this.entries.length = 0;
  }
}

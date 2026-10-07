import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * mergeStatic — draw-call diet for hand-built models (creatures, weapons, props).
 *
 * A procedural creature is assembled from dozens of primitives (a boar was 62 meshes = 62 draw calls, ×30 enemies in a fight).
 * Meshes that never move relative to their parent joint can be baked into one geometry per (parent, material, shadow flags):
 * same picture, a fraction of the calls. Anything the animation layer addresses is left alone:
 *   • named meshes and named joints keep their identity (the animator finds parts by name)
 *   • skinned / instanced meshes, meshes flagged `userData.noMerge`, and hidden ones are never touched
 * Vertex colours and shared materials are preserved; UVs are dropped (the model materials carry no textures).
 *
 * @param {THREE.Object3D} root
 * @returns {{before:number, after:number}} mesh counts, for tests and budgets
 */
export function mergeStatic(root) {
  const groups = new Map();
  let before = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    before++;
    if (o.isSkinnedMesh || o.isInstancedMesh || o.name || o.userData.noMerge || !o.visible || !o.parent || Array.isArray(o.material)) return;
    const g = o.geometry, hasColor = !!g.attributes.color, indexed = !!g.index;
    const key = `${o.parent.uuid}|${o.material.uuid}|${+o.castShadow}${+o.receiveShadow}|${hasColor ? 'c' : '-'}${indexed ? 'i' : '-'}|${o.renderOrder}`;
    let gr = groups.get(key);
    if (!gr) groups.set(key, gr = { parent: o.parent, material: o.material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, meshes: [] });
    gr.meshes.push(o);
  });

  let after = before;
  for (const gr of groups.values()) {
    if (gr.meshes.length < 2) continue;
    const geos = gr.meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.clone();
      g.deleteAttribute('uv'); g.deleteAttribute('uv1');
      g.applyMatrix4(m.matrix);                          // bake the mesh's transform into the parent joint's space
      return g;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;                               // incompatible attribute layouts: leave the originals
    merged.computeBoundingSphere();
    merged.userData.owned = true;                        // unique to this model instance: the view that owns it must dispose it
    const mesh = new THREE.Mesh(merged, gr.material);
    mesh.castShadow = gr.cast; mesh.receiveShadow = gr.receive; mesh.renderOrder = gr.order;
    mesh.userData.merged = gr.meshes.length;
    gr.parent.add(mesh);
    for (const m of gr.meshes) m.removeFromParent();
    after -= gr.meshes.length - 1;
  }
  return { before, after };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeStatic } from '../src/client/render/mergeStatic.js';

const mat = new THREE.MeshStandardMaterial({ vertexColors: true });
const other = new THREE.MeshBasicMaterial();
const piece = (geo, m, pos, name) => {
  const g = geo.clone(); const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.5), 3));
  const mesh = new THREE.Mesh(g, m); mesh.position.set(...pos); if (name) mesh.name = name; return mesh;
};

test('static pieces of one joint and material become a single mesh, geometry baked into joint space', () => {
  const root = new THREE.Group(), leg = new THREE.Group(); leg.name = 'leg';
  const box = new THREE.BoxGeometry(1, 1, 1);
  leg.add(piece(box, mat, [0, 0, 0]), piece(box, mat, [0, 2, 0]), piece(box, mat, [0, 4, 0]));
  root.add(leg);
  const r = mergeStatic(root);
  assert.equal(r.before, 3); assert.equal(r.after, 1);
  const meshes = []; root.traverse((o) => o.isMesh && meshes.push(o));
  assert.equal(meshes.length, 1);
  meshes[0].geometry.computeBoundingBox();
  assert.ok(Math.abs(meshes[0].geometry.boundingBox.max.y - 4.5) < 1e-4 && Math.abs(meshes[0].geometry.boundingBox.min.y + 0.5) < 1e-4, 'positions were baked');
  assert.equal(meshes[0].parent, leg, 'the merged mesh stays under the animated joint');
  assert.equal(meshes[0].geometry.userData.owned, true);
});

test('named parts, other materials and other joints are not merged together', () => {
  const root = new THREE.Group(), a = new THREE.Group(), b = new THREE.Group(); a.name = 'a'; b.name = 'b';
  const box = new THREE.BoxGeometry(1, 1, 1);
  a.add(piece(box, mat, [0, 0, 0]), piece(box, mat, [1, 0, 0]), piece(box, other, [2, 0, 0]), piece(box, mat, [3, 0, 0], 'head'));
  b.add(piece(box, mat, [0, 0, 0]), piece(box, mat, [1, 0, 0]));
  root.add(a, b);
  const r = mergeStatic(root);
  assert.equal(r.before, 6);
  // a: (mat ×2 → 1) + other + head ; b: (mat ×2 → 1)  =>  4 meshes
  assert.equal(r.after, 4);
  assert.ok(root.getObjectByName('head'), 'the named part survives untouched');
});

test('vertex count and triangle count are preserved', () => {
  const root = new THREE.Group(), j = new THREE.Group(); j.name = 'j';
  const geos = [new THREE.BoxGeometry(1, 1, 1), new THREE.SphereGeometry(0.5, 8, 6), new THREE.CylinderGeometry(0.3, 0.3, 1, 7)];
  let verts = 0, tris = 0;
  geos.forEach((g, i) => { verts += g.attributes.position.count; tris += g.index.count / 3; j.add(piece(g, mat, [i, 0, 0])); });
  root.add(j); mergeStatic(root);
  let v2 = 0, t2 = 0; root.traverse((o) => { if (o.isMesh) { v2 += o.geometry.attributes.position.count; t2 += o.geometry.index.count / 3; } });
  assert.equal(v2, verts); assert.equal(t2, tris);
});

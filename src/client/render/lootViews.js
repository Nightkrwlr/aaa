/** LootViews — ground items as small floating models with rarity beams; labels are drawn on the 2D overlay. */
import * as THREE from 'three';
import { mat, box, cyl, cone, sphere, torus, ico, group, disposeTree } from './kit.js';
import { RARITY_COLOR } from '../ui/itemText.js';

const BEAM = { common: 0, fine: 3.2, attuned: 6, relic: 9 };
const beamMat = new Map();
const bm = (c) => { let m = beamMat.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); beamMat.set(c, m); } return m; };
const glow = (c, i = 1) => mat(c, { emissive: c, ei: i, fade: false });

function itemModel(reg, g) {
  const base = reg.get(g.item.base), slot = base?.slot, col = RARITY_COLOR[g.item.rarity];
  const m = group();
  const metal = '#b0a898';
  switch (slot) {
    case 'weapon': m.add(cyl(0.05, 0.05, 0.9, '#6a4e34', { rot: [0, 0, Math.PI / 2.6], pos: [0, 0.3, 0] })); m.add(box(0.34, 0.26, 0.26, metal, { pos: [0.28, 0.55, 0], metal: 0.6 })); break;
    case 'offhand': m.add(cyl(0.34, 0.34, 0.07, metal, { rot: [Math.PI / 2.4, 0, 0], pos: [0, 0.3, 0], metal: 0.6, seg: 10 })); break;
    case 'head': m.add(sphere(0.26, metal, { pos: [0, 0.3, 0], scale: [1, 0.85, 1], metal: 0.6 })); m.add(box(0.3, 0.08, 0.3, col, { pos: [0, 0.2, 0.05], material: glow(col, 0.5) })); break;
    case 'chest': m.add(box(0.5, 0.45, 0.28, metal, { pos: [0, 0.3, 0], metal: 0.4 })); m.add(box(0.5, 0.1, 0.3, col, { pos: [0, 0.5, 0], material: glow(col, 0.4) })); break;
    case 'hands': m.add(box(0.3, 0.16, 0.22, metal, { pos: [-0.1, 0.2, 0] })); m.add(box(0.3, 0.16, 0.22, metal, { pos: [0.12, 0.2, 0.05] })); break;
    case 'feet': m.add(box(0.2, 0.18, 0.4, metal, { pos: [-0.12, 0.15, 0] })); m.add(box(0.2, 0.18, 0.4, metal, { pos: [0.12, 0.15, 0.05] })); break;
    case 'neck': m.add(torus(0.2, 0.025, '#d9a24a', { pos: [0, 0.35, 0], rot: [Math.PI / 2.2, 0, 0], metal: 0.7 })); m.add(sphere(0.07, col, { pos: [0, 0.12, 0.1], material: glow(col, 1) })); break;
    case 'ring': m.add(torus(0.12, 0.03, '#d9a24a', { pos: [0, 0.3, 0], rot: [Math.PI / 2.2, 0, 0], metal: 0.7 })); m.add(sphere(0.05, col, { pos: [0, 0.4, 0], material: glow(col, 1) })); break;
    default: m.add(ico(0.22, col, { pos: [0, 0.32, 0], material: glow(col, 0.9) }));
  }
  return m;
}

export class LootViews {
  constructor(scene3d, session, heightAt) {
    this.s3 = scene3d; this.session = session; this.heightAt = heightAt; this.reg = session.registry;
    this.root = new THREE.Group(); this.root.name = 'loot'; scene3d.content.add(this.root);
    this.views = new Map(); this.echoes = new Map();
  }
  #make(g) {
    const root = new THREE.Group();
    let col = '#ffffff', beam = 0;
    if (g.kind === 'item') { col = RARITY_COLOR[g.item.rarity]; beam = BEAM[g.item.rarity]; root.add(itemModel(this.reg, g)); }
    else if (g.kind === 'chimes') { col = '#ffd27a'; for (let i = 0; i < Math.min(5, 1 + Math.floor(Math.log10(g.amount + 1) * 1.6)); i++) root.add(cyl(0.14, 0.14, 0.04, '#d9a24a', { pos: [(i % 3 - 1) * 0.16, 0.05 + (i > 2 ? 0.06 : 0), Math.floor(i / 3) * 0.14], metal: 0.7, seg: 10 })); }
    else if (g.kind === 'material') { col = '#9fe8ff'; root.add(ico(0.14, col, { pos: [0, 0.22, 0], material: glow(col, 0.7) })); }
    else if (g.kind === 'consumable') { col = '#9fe6b0'; root.add(sphere(0.14, col, { pos: [0, 0.2, 0], material: glow(col, 0.6) })); root.add(cyl(0.05, 0.05, 0.14, '#ddd', { pos: [0, 0.38, 0] })); }
    else if (g.kind === 'potionCharge') { col = '#ff6a5a'; root.add(sphere(0.16, col, { pos: [0, 0.2, 0], material: glow(col, 0.9) })); root.add(cyl(0.05, 0.05, 0.14, '#ddd', { pos: [0, 0.4, 0] })); beam = 2; }
    else if (g.kind === 'deathBundle') { col = '#b79cff'; root.add(cyl(0.2, 0.28, 0.5, '#4a3f5a', { pos: [0, 0.25, 0], seg: 8 })); root.add(sphere(0.18, col, { pos: [0, 0.65, 0], material: glow(col, 1.4) })); beam = 7; }
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; root.add(disc);
    let b = null;
    if (beam > 0) { b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, beam, 8, 1, true), bm(col)); b.position.y = beam / 2; root.add(b); }
    root.userData = { born: this.session.world.time };
    return { root, disc, beam: b };
  }
  update(dt, t) {
    const ground = this.session.loot?.ground ?? [];
    const seen = new Set();
    for (const g of ground) {
      seen.add(g.uid);
      let v = this.views.get(g.uid);
      if (!v) { v = this.#make(g); this.views.set(g.uid, v); this.root.add(v.root); }
      const age = Math.min(1, (this.session.world.time - g.born) / 0.5);
      v.root.position.set(g.x, this.heightAt(g.x, g.z) + (1 - age) * 0.6 * (1 - age), g.z);
      v.root.children[0].rotation.y = t * 0.9 + g.uid;
      v.root.children[0].position.y = 0.1 + Math.sin(t * 2 + g.uid) * 0.05;
      v.disc.material.opacity = 0.35 + Math.sin(t * 3 + g.uid) * 0.2;
      if (v.beam) v.beam.material.opacity = 0.2 + Math.sin(t * 2.2 + g.uid) * 0.06;
    }
    for (const [uid, v] of this.views) if (!seen.has(uid)) { this.root.remove(v.root); disposeTree(v.root); this.views.delete(uid); }
    // voice echoes: translucent cyan wisps that fade as their capture window closes
    const ec = this.session.loot?.voiceEchoes ?? [];
    const es = new Set();
    for (const e of ec) {
      es.add(e.uid);
      let v = this.echoes.get(e.uid);
      if (!v) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); const r = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.35, 32), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; const g = new THREE.Group(); g.add(m, r); v = { g, m, r }; this.echoes.set(e.uid, v); this.root.add(g); }
      const left = Math.max(0, (e.expires - this.session.world.time));
      v.g.position.set(e.x, this.heightAt(e.x, e.z) + 1.2 + Math.sin(t * 2.5) * 0.15, e.z);
      v.m.rotation.set(t, t * 0.7, 0); v.m.material.opacity = Math.min(0.7, left * 0.3) * (0.7 + 0.3 * Math.sin(t * 8));
      v.r.position.y = -1.1; v.r.scale.setScalar(0.6 + (1 - Math.min(1, left / 10)) * 0.8);
    }
    for (const [uid, v] of this.echoes) if (!es.has(uid)) { this.root.remove(v.g); this.echoes.delete(uid); }
  }
  dispose() { this.s3.content.remove(this.root); disposeTree(this.root); }
}

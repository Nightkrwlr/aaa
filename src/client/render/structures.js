/** Authored structures & landmarks built from primitives (settlement, windharps, waystones, gates…). */
import * as THREE from 'three';
import { mat, box, cyl, cone, sphere, torus, ico, group, geo } from './kit.js';

const PI = Math.PI;
const LIMESTONE = '#d3c8ac', LIMESTONE_D = '#b3a78c', BRASS = '#b88a3e', BRASS_D = '#8a6428', WOOD = '#8a6a48', WOOD_D = '#6a4e34', CLOTH = '#a8553a', CYAN = '#7fe3ff';

const BUILD = {
  windharp() {
    // tall serrane arch with resonant strings
    const g = group();
    g.add(box(0.7, 5.4, 0.7, LIMESTONE, { pos: [-1.5, 2.7, 0] }));
    g.add(box(0.7, 5.4, 0.7, LIMESTONE, { pos: [1.5, 2.7, 0] }));
    g.add(box(4.0, 0.7, 0.8, LIMESTONE_D, { pos: [0, 5.6, 0] }));
    g.add(box(0.9, 0.5, 0.9, LIMESTONE_D, { pos: [-1.5, 0.25, 0] }));
    g.add(box(0.9, 0.5, 0.9, LIMESTONE_D, { pos: [1.5, 0.25, 0] }));
    for (let i = 0; i < 7; i++) {
      const x = -1.05 + i * 0.35;
      const len = 4.3 - Math.abs(i - 3) * 0.28;
      const s = cyl(0.012, 0.012, len, '#e8dcc0', { pos: [x, 5.2 - len / 2, 0], emissive: CYAN, ei: 0.5, seg: 4, shadow: false });
      s.userData.string = i; g.add(s);
    }
    g.add(torus(0.45, 0.06, BRASS, { pos: [0, 5.6, 0.45], rot: [PI / 2, 0, 0] }));
    g.userData.update = (t) => { g.children.forEach((c) => { if (c.userData.string !== undefined) c.rotation.z = Math.sin(t * 3 + c.userData.string) * 0.015; }); };
    return g;
  },
  hall() {
    const g = group();
    g.add(box(8.4, 0.5, 6.6, LIMESTONE_D, { pos: [0, 0.25, 0] }));
    g.add(box(7.6, 3.2, 5.8, '#c9b58f', { pos: [0, 2.1, 0] }));
    g.add(cone(5.6, 2.8, '#7a4a38', { pos: [0, 5.1, 0], seg: 4, rot: [0, PI / 4, 0], scale: [1.18, 1, 0.92] }));
    g.add(box(1.4, 2.2, 0.2, WOOD_D, { pos: [0, 1.6, 2.95] }));
    g.add(box(1.0, 0.8, 0.2, '#ffd9a0', { pos: [-2.4, 2.3, 2.95], emissive: '#ffb050', ei: 0.9 }));
    g.add(box(1.0, 0.8, 0.2, '#ffd9a0', { pos: [2.4, 2.3, 2.95], emissive: '#ffb050', ei: 0.9 }));
    g.add(torus(0.5, 0.07, BRASS, { pos: [0, 4.2, 3.05], rot: [0, 0, 0] })); // serrane ring with a notch = the Rest sign
    return g;
  },
  hut() {
    const g = group();
    g.add(cyl(2.3, 2.5, 2.6, '#c9b58f', { pos: [0, 1.3, 0], seg: 8 }));
    g.add(cone(3.1, 2.3, '#8d5a3e', { pos: [0, 3.7, 0], seg: 8 }));
    g.add(box(0.9, 1.7, 0.2, WOOD_D, { pos: [0, 0.85, 2.38], rot: [0, 0, 0] }));
    g.add(box(0.6, 0.5, 0.2, '#ffd9a0', { pos: [1.4, 1.6, 1.95], rot: [0, 0.6, 0], emissive: '#ffb050', ei: 0.8 }));
    return g;
  },
  tent() {
    const g = group();
    g.add(cone(3.0, 3.0, CLOTH, { pos: [0, 1.5, 0], seg: 5 }));
    g.add(cone(2.9, 0.4, '#e4cf9c', { pos: [0, 0.2, 0], seg: 5 }));
    g.add(box(0.5, 1.4, 0.1, '#2a2118', { pos: [0, 0.7, 2.35] }));
    g.add(cyl(0.05, 0.05, 1.2, WOOD_D, { pos: [0, 3.5, 0] }));
    return g;
  },
  forge() {
    const g = group();
    g.add(box(2.2, 1.0, 1.4, '#6d6458', { pos: [0, 0.5, 0] }));
    g.add(box(1.8, 0.2, 1.0, '#ff7a2a', { pos: [0, 1.02, 0], emissive: '#ff6a1a', ei: 1.2 }));
    g.add(box(0.8, 0.5, 0.45, '#3a3a40', { pos: [-0.2, 1.3, 0.0], metal: 0.6 }));
    g.add(cyl(0.35, 0.5, 2.6, '#6d6458', { pos: [0.7, 2.0, -0.3], seg: 6 }));
    const l = new THREE.PointLight('#ff8a3a', 8, 12, 2); l.position.set(0, 1.6, 0); g.add(l);
    g.userData.update = (t) => { l.intensity = 7 + Math.sin(t * 13) * 1.2 + Math.sin(t * 7.3) * 0.8; };
    return g;
  },
  alchemy_table() {
    const g = group();
    g.add(box(2.0, 0.15, 1.0, WOOD, { pos: [0, 0.95, 0] }));
    for (const [x, z] of [[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]]) g.add(box(0.12, 0.95, 0.12, WOOD_D, { pos: [x, 0.47, z] }));
    g.add(sphere(0.22, '#9fe6b0', { pos: [-0.5, 1.28, 0], emissive: '#6dff9a', ei: 0.6, opacity: 0.85 }));
    g.add(sphere(0.18, '#ffb3a0', { pos: [0.1, 1.24, 0.2], emissive: '#ff7a5a', ei: 0.5, opacity: 0.85 }));
    g.add(cyl(0.12, 0.12, 0.5, '#bde3f0', { pos: [0.6, 1.3, -0.1], opacity: 0.8 }));
    return g;
  },
  stash_chest() {
    const g = group();
    g.add(box(1.5, 0.8, 0.9, WOOD, { pos: [0, 0.4, 0] }));
    g.add(cyl(0.45, 0.45, 1.5, WOOD_D, { pos: [0, 0.9, 0], rot: [0, 0, PI / 2], seg: 8 }));
    g.add(box(0.2, 0.3, 0.12, BRASS, { pos: [0, 0.75, 0.48] }));
    g.add(box(1.6, 0.12, 0.2, BRASS_D, { pos: [0, 0.4, 0.46] }));
    return g;
  },
  bell_post() {
    // the great bell of Orrel's Ledge: brass bell in a limestone frame
    const g = group();
    g.add(box(0.7, 4.2, 0.7, LIMESTONE, { pos: [-1.5, 2.1, 0] }));
    g.add(box(0.7, 4.2, 0.7, LIMESTONE, { pos: [1.5, 2.1, 0] }));
    g.add(box(4.0, 0.6, 0.8, LIMESTONE_D, { pos: [0, 4.3, 0] }));
    const bell = group([cyl(0.45, 1.0, 1.4, BRASS, { pos: [0, 0, 0], seg: 10, metal: 0.6, rough: 0.4 }), sphere(0.2, BRASS_D, { pos: [0, -0.8, 0] })], { pos: [0, 3.1, 0] });
    g.add(bell);
    g.userData.update = (t) => { bell.rotation.z = Math.sin(t * 0.9) * 0.05; };
    g.userData.bell = bell;
    return g;
  },
  lantern() {
    const g = group();
    g.add(cyl(0.07, 0.09, 2.4, '#3a3028', { pos: [0, 1.2, 0], seg: 5 }));
    g.add(box(0.36, 0.42, 0.36, '#ffd9a0', { pos: [0, 2.5, 0], emissive: '#ffb050', ei: 1.4 }));
    g.add(cone(0.3, 0.3, '#3a3028', { pos: [0, 2.85, 0], seg: 4 }));
    const l = new THREE.PointLight('#ffb050', 5, 9, 2); l.position.set(0, 2.5, 0); g.add(l);
    g.userData.update = (t) => { l.intensity = 4.6 + Math.sin(t * 9 + g.position.x) * 0.5; };
    return g;
  },
  banner() {
    const g = group();
    g.add(cyl(0.06, 0.06, 3.4, WOOD_D, { pos: [0, 1.7, 0], seg: 5 }));
    const cloth = box(0.9, 1.6, 0.04, CLOTH, { pos: [0.5, 2.6, 0] });
    g.add(cloth);
    g.add(torus(0.22, 0.03, '#e8dcc0', { pos: [0.5, 2.7, 0.04] }));
    g.userData.update = (t) => { cloth.rotation.y = Math.sin(t * 2 + g.position.z) * 0.18; };
    return g;
  },
  cylinder() {
    const g = group();
    g.add(cyl(0.7, 0.8, 0.3, LIMESTONE_D, { pos: [0, 0.15, 0], seg: 10 }));
    g.add(cyl(0.45, 0.45, 1.3, '#bfeaff', { pos: [0, 0.95, 0], seg: 10, opacity: 0.55, emissive: CYAN, ei: 0.8, fade: true }));
    g.add(cyl(0.22, 0.22, 0.9, '#d9a24a', { pos: [0, 0.95, 0], seg: 6, metal: 0.5 }));
    g.add(cyl(0.55, 0.45, 0.14, BRASS, { pos: [0, 1.65, 0], seg: 10, metal: 0.6 }));
    const l = new THREE.PointLight(CYAN, 6, 8, 2); l.position.set(0, 1.1, 0); g.add(l);
    g.userData.update = (t) => { l.intensity = 5 + Math.sin(t * 2.2) * 1.4; };
    g.userData.glow = true;
    return g;
  },
  mural() {
    const g = group();
    g.add(box(3.2, 2.6, 0.4, LIMESTONE_D, { pos: [0, 1.3, 0] }));
    // "La Nota Ausente": ring of notes with one missing
    for (let i = 0; i < 11; i++) {
      const a = (i / 12) * PI * 2 + 0.3;
      g.add(box(0.18, 0.18, 0.06, '#d9a24a', { pos: [Math.sin(a) * 0.9, 1.4 + Math.cos(a) * 0.9, 0.22], emissive: '#d9a24a', ei: 0.3 }));
    }
    return g;
  },
  gate_door() {
    const g = group();
    const L = box(2.6, 5, 0.6, LIMESTONE_D, { pos: [-1.35, 2.5, 0] }), R = box(2.6, 5, 0.6, LIMESTONE_D, { pos: [1.35, 2.5, 0] });
    g.add(L, R);
    g.add(torus(1.1, 0.08, CYAN, { pos: [0, 2.8, 0.34], emissive: CYAN, ei: 1.2 }));
    g.add(box(8.4, 0.9, 1.0, LIMESTONE, { pos: [0, 5.4, 0] }));
    g.add(box(1.0, 5.4, 1.0, LIMESTONE, { pos: [-4.1, 2.7, 0] }));
    g.add(box(1.0, 5.4, 1.0, LIMESTONE, { pos: [4.1, 2.7, 0] }));
    g.userData.doors = { L, R };
    g.userData.setOpen = (o) => { L.position.x = -1.35 - o * 2.3; R.position.x = 1.35 + o * 2.3; };
    return g;
  },
  statue_nomouth() {
    const g = group();
    g.add(box(1.4, 0.5, 1.4, LIMESTONE_D, { pos: [0, 0.25, 0] }));
    g.add(cyl(0.38, 0.5, 2.0, LIMESTONE, { pos: [0, 1.5, 0], seg: 7 }));
    g.add(sphere(0.32, LIMESTONE, { pos: [0, 2.8, 0] }));
    g.add(box(0.5, 0.1, 0.1, '#7d725c', { pos: [0, 2.7, 0.3] })); // smooth: no mouth
    g.add(box(0.2, 1.2, 0.2, LIMESTONE, { pos: [-0.55, 1.7, 0.1], rot: [0, 0, 0.3] }));
    g.add(box(0.2, 1.2, 0.2, LIMESTONE, { pos: [0.55, 1.7, 0.1], rot: [0, 0, -0.3] }));
    return g;
  },
  waystone() {
    const g = group();
    g.add(cyl(0.7, 0.9, 0.35, LIMESTONE_D, { pos: [0, 0.17, 0], seg: 6 }));
    g.add(box(0.7, 1.9, 0.7, LIMESTONE, { pos: [0, 1.3, 0], rot: [0, 0.4, 0] }));
    g.add(cone(0.5, 0.6, LIMESTONE, { pos: [0, 2.55, 0], seg: 4, rot: [0, 0.4 + PI / 4, 0] }));
    const ring = torus(0.62, 0.04, CYAN, { pos: [0, 1.5, 0], emissive: CYAN, ei: 1.0, rot: [PI / 2 + 0.2, 0, 0] });
    g.add(ring);
    const l = new THREE.PointLight(CYAN, 4, 7, 2); l.position.set(0, 1.6, 0); g.add(l);
    g.userData.update = (t, st) => { ring.rotation.z = t * 0.8; ring.material.emissiveIntensity = st?.active ? 1.6 : 0.35; l.intensity = st?.active ? 5 : 1.2; };
    return g;
  },
  cave_mouth() {
    const g = group();
    g.add(box(1.4, 7, 6, '#7d745f', { pos: [0, 3.5, -3.8], rot: [0, 0, 0] }));
    g.add(box(2.6, 1.6, 8.6, '#8c8470', { pos: [-0.4, 6.6, -0.2] }));
    g.add(box(2.4, 6.4, 1.6, '#8c8470', { pos: [-0.2, 3.2, -4.4] }));
    g.add(box(2.4, 6.4, 1.6, '#8c8470', { pos: [-0.2, 3.2, 4.0] }));
    g.add(box(0.5, 5.2, 6.8, '#050608', { pos: [0.3, 2.6, 0], emissive: '#0a1218', ei: 0.4 }));
    g.add(torus(2.6, 0.1, CYAN, { pos: [0.7, 2.8, 0], rot: [0, PI / 2, 0], emissive: CYAN, ei: 1.1 }));
    const l = new THREE.PointLight(CYAN, 6, 11, 2); l.position.set(2.5, 2.6, 0); g.add(l);
    return g;
  },
};

export function buildStructure(kind) {
  const f = BUILD[kind];
  return f ? f() : null;
}

/** The Broken Canticle: a colossal serrane resonator tower visible from the whole zone (navigation landmark). */
export function buildCanticle() {
  const g = group();
  const shaft = cyl(7, 11, 90, '#c5b99c', { pos: [0, 45, 0], seg: 14, fade: false });
  g.add(shaft);
  for (let i = 0; i < 6; i++) g.add(torus(8.6 - i * 0.5, 0.7, '#d9a24a', { pos: [0, 14 + i * 12, 0], rot: [PI / 2, 0, 0], seg: 24, fade: false, emissive: '#d9a24a', ei: 0.12 }));
  // the break: jagged crown
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2, h = 6 + ((i * 37) % 11);
    g.add(box(3.4, h, 2.4, '#bdb194', { pos: [Math.sin(a) * 5.4, 90 + h / 2 - 2, Math.cos(a) * 5.4], rot: [0.1 * Math.sin(a), a, 0.15 * Math.cos(a)], fade: false }));
  }
  const ring = torus(18, 0.9, '#7fe3ff', { pos: [0, 96, 0], rot: [PI / 2 + 0.25, 0, 0], seg: 48, emissive: '#7fe3ff', ei: 1.6, fade: false });
  g.add(ring);
  const ring2 = torus(13, 0.6, '#7fe3ff', { pos: [0, 100, 0], rot: [PI / 2 - 0.2, 0.3, 0], seg: 40, emissive: '#7fe3ff', ei: 1.2, fade: false });
  g.add(ring2);
  g.userData.update = (t) => { ring.rotation.z = t * 0.07; ring2.rotation.z = -t * 0.1; };
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return g;
}

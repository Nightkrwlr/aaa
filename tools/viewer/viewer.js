// Stand-alone art viewer (dev tool): renders imported assets with a game-like isometric camera + lighting,
// without booting the game. Drive it from Playwright via window.__viewer (see tools/e2e/assets.mjs).
import * as THREE from 'three';
import { Assets } from '/src/client/render/assets.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a3040'); scene.fog = new THREE.Fog('#2a3040', 40, 110);
const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.5, 300);
scene.add(new THREE.HemisphereLight('#bcd0ff', '#4a3a30', 0.9));
const sun = new THREE.DirectionalLight('#fff0d8', 2.4); sun.position.set(-14, 26, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 80; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#5a6a4c', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const A = new Assets('/assets/'); const rigs = []; const stage = new THREE.Group(); scene.add(stage);
function look(x, z, dist = 26, yaw = Math.PI / 4, pitch = 0.8) {
  cam.position.set(x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(x, 1.2, z);
  sun.position.set(x - 14, 26, z + 10); sun.target.position.set(x, 0, z);
}
let last = performance.now();
function frame(t) { const dt = Math.min(0.05, (t - last) / 1000); last = t; for (const r of rigs) r.update(dt); renderer.render(scene, cam); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

window.__viewer = {
  THREE, scene, cam, renderer, A, stage, rigs, sun, look,
  async init(onlyChars = false) { await A.load(); return { ok: A.ready, anims: A.anims.length }; },
  async add(group, id, x, z, ry = 0, sc = 1) { const m = await A.propAsync(group, id); if (!m) return null; m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(sc); stage.add(m); return m; },
  /** atts: array of built-in part names (strings) and/or [bone, group, id] external props */
  async char(id, x, z, anim, atts = [], ry = 0.5, { tint = null, emissive = null, scale = 1 } = {}) {
    const r = A.character(id, { tint, emissive, scale }); if (!r) return null;
    r.root.position.set(x, 0, z); r.root.rotation.y = ry;
    r.equip(atts.filter((a) => typeof a === 'string'));
    for (const a of atts) if (Array.isArray(a)) { const [bone, g, pid] = a; await A.template(g, pid); r.attach(bone, A.prop(g, pid)); }
    r.play(anim); stage.add(r.root); rigs.push(r); return r;
  },
  clear() { for (const r of rigs.splice(0)) r.dispose(); stage.clear(); },
};
document.getElementById('log').textContent = 'viewer ready';

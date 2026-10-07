/**
 * InteractViews — meshes for everything in `session.interactables` that has no authored structure: chests, shrines, puzzle pillars /
 * tablets / dials / mirrors, gathering nodes, lore objects, portals, artifacts…  Views are created/removed by diffing the interactable
 * list each frame (dungeons and events mutate it).
 *
 * Affordance (Art Bible §3: "interactive = golden halo on the ground"): every usable interactable within reach of the hero carries a gentle,
 * pulsing golden sigil on the floor that fades with distance (no clutter), the nearest one brightens and gets a bobbing icon.
 */
import * as THREE from 'three';
import { disposeTree } from './kit.js';
import { Paint, PAT } from './paint.js';
import { paintMaterial, glowMaterial, glowPaintMaterial } from './worldMaterials.js';
import { crystalGeo } from './foliage.js';
import { glyphTexture, GLYPHS } from './glyphs.js';
import { WORLD } from './atmosphere.js';
import { getNoiseTexture } from './noiseTex.js';
import { buildModelFromSpec } from './models.js';
import { animate } from './anim.js';
import { trace } from '../../sim/puzzles/beamMirrors.js';

const PI = Math.PI, TAU = PI * 2;
const PILLAR_COLORS = ['#7fe3ff', '#ffb050', '#b79cff', '#6dff9a', '#ff7a8a', '#ffe34a', '#9fb0ff', '#ffa0e0'];
const CYAN = '#7fe3ff', GOLD = '#ffd27a';

const SKIP_WHEN_STRUCTURE = new Set(['waypoint', 'station', 'stash', 'gate', 'npc', 'dungeon_portal', 'lore', 'event_npc']);

// ───────────────────────────────────────────────────────── tiny helpers
const solid = (p, o = {}) => { const m = new THREE.Mesh(p.build(), paintMaterial(o)); m.castShadow = true; m.receiveShadow = true; return m; };
const glowMesh = (p, base = 2.2) => { const m = new THREE.Mesh(p.build(), glowPaintMaterial(base)); m.castShadow = false; return m; };
/** an emissive material instance we can animate freely (not shared) */
const liveGlow = (color, i = 1.5) => { const m = glowMaterial(color, i, { fade: false }).clone(); m.userData.shared = false; m.userData.glowBase = 0; m.emissiveIntensity = i; return m; };
const grp = (...c) => { const g = new THREE.Group(); for (const x of c) g.add(x); return g; };
const mesh = (geo, mat, o = {}) => { const m = new THREE.Mesh(geo, mat); if (o.pos) m.position.set(...o.pos); if (o.rot) m.rotation.set(...o.rot); m.castShadow = !!o.cast; return m; };
const pointLight = (color, i, d, y) => { const l = new THREE.PointLight(color, i, d, 2); l.position.y = y; return l; };

let veilMat = null;
/** swirling portal veil */
function getVeilMaterial() {
  return (veilMat ??= new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: WORLD.uTime, uColor: { value: new THREE.Color('#b79cff') }, uAmt: { value: 1 }, uNoise: { value: getNoiseTexture() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uTime, uAmt; uniform sampler2D uNoise;
      void main(){ vec2 c = vUv * 2.0 - 1.0; float d = length(c * vec2(0.8, 0.62));
        float a1 = atan(c.y, c.x);
        float sw = texture2D(uNoise, vec2(a1 / 6.2831 + uTime * 0.05, d * 0.9 - uTime * 0.12)).r;
        float sw2 = texture2D(uNoise, vec2(a1 / 6.2831 * 2.0 - uTime * 0.07, d * 1.7 + uTime * 0.2)).g;
        float edge = smoothstep(1.0, 0.55, d);
        float a = edge * (0.18 + 0.5 * sw * sw2 + 0.25 * smoothstep(0.7, 1.0, d));
        gl_FragColor = vec4(uColor * (0.7 + 1.1 * sw), a * uAmt); }`,
  }));
}
function veil(color, w = 2.7, h = 3.2) {
  const m = getVeilMaterial().clone(); m.uniforms = { uTime: WORLD.uTime, uColor: { value: new THREE.Color(color) }, uAmt: { value: 1 }, uNoise: { value: getNoiseTexture() } };
  const v = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); v.renderOrder = 9; return v;
}

// ───────────────────────────────────────────────────────── the views
const BUILD = {
  shrine() {
    const s = new Paint();
    s.cyl(1.2, 1.35, 0.3, 8, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.95, 1.1, 0.3, 8, { pos: [0, 0.28, 0], mat: 'limestone', pat: PAT.stone });
    s.cyl(0.5, 0.36, 0.55, 10, { pos: [0, 0.7, 0], mat: 'brass', g: [0.1, 0.8] }); s.torus(0.5, 0.06, 5, 16, { pos: [0, 0.98, 0], rot: [PI / 2, 0, 0], mat: 'brass' });
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; s.box(0.14, 0.9, 0.14, { pos: [Math.sin(a) * 0.95, 0.75, Math.cos(a) * 0.95], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.02 }); }
    const g = grp(solid(s));
    const fm = liveGlow(CYAN, 2.4), flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.85, 6), fm); flame.position.y = 1.4; g.add(flame);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.5, 40).rotateX(-PI / 2), liveGlow(CYAN, 1.5)); ring.position.y = 0.06; g.add(ring);
    const l = pointLight(CYAN, 6, 11, 1.5); g.add(l);
    return { root: g, light: l, tick: (t) => { flame.scale.set(1 + Math.sin(t * 11) * 0.08, 1 + Math.sin(t * 9) * 0.16, 1 + Math.cos(t * 10) * 0.08); fm.emissiveIntensity = 2.2 + Math.sin(t * 7) * 0.4; ring.material.emissiveIntensity = 1.1 + Math.sin(t * 2) * 0.5; l.intensity = 5.5 + Math.sin(t * 7) * 0.8; } };
  },
  chest(o) {
    const rich = (o.tier ?? 1) >= 2, wood = rich ? 'clothPurple' : 'wood', trim = rich ? 'brass' : 'iron';
    const body = new Paint();
    body.box(1.4, 0.72, 0.9, { pos: [0, 0.36, 0], mat: wood, pat: PAT.plank, bevel: 0.04, g: [0.1, 0.85] });
    for (const x of [-0.5, 0.5]) body.box(0.12, 0.76, 0.96, { pos: [x, 0.37, 0], mat: trim, bevel: 0.015 });
    body.box(1.46, 0.1, 0.95, { pos: [0, 0.74, 0], mat: trim, bevel: 0.02 });
    body.box(0.26, 0.3, 0.1, { pos: [0, 0.55, 0.48], mat: 'brass', bevel: 0.02 });
    const lidP = new Paint();
    lidP.add(new THREE.CylinderGeometry(0.46, 0.46, 1.4, 10, 1, false, 0, PI).rotateZ(PI / 2).translate(0, 0, 0.45), { pos: [0, 0.0, 0], mat: wood, pat: PAT.plank, g: [0.1, 0.8], yr: [-0.1, 0.5] });
    for (const x of [-0.5, 0.5]) lidP.add(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 10, 1, false, 0, PI).rotateZ(PI / 2).translate(x, 0, 0.45), { mat: trim });
    lidP.box(0.2, 0.16, 0.08, { pos: [0, 0.0, 0.93], mat: 'brass' });
    const lid = solid(lidP); const lidG = grp(lid); lidG.position.set(0, 0.75, -0.45);
    const g = grp(solid(body), lidG);
    const mark = rich ? liveGlow(CYAN, 1.2) : null;
    if (o.sealed || o.secret) { const r = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.05, 32).rotateX(-PI / 2), liveGlow('#b79cff', 1.6)); r.position.y = 0.05; g.add(r); }
    if (rich) { const r2 = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.98, 32).rotateX(-PI / 2), mark); r2.position.y = 0.05; g.add(r2); }
    return { root: g, tick: (t, ob) => { const target = ob.opened ? -1.15 : 0; lidG.rotation.x += (target - lidG.rotation.x) * 0.2; } };
  },
  key_pedestal() {
    const s = new Paint(); s.cyl(0.55, 0.7, 0.35, 8, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.38, 0.5, 0.6, 8, { pos: [0, 0.5, 0], mat: 'limestone', pat: PAT.stone }); s.cyl(0.48, 0.38, 0.12, 8, { pos: [0, 0.86, 0], mat: 'brass' });
    const k = new Paint(); k.torus(0.18, 0.05, 5, 12, { mat: 'brass' }); k.box(0.07, 0.5, 0.07, { pos: [0, -0.35, 0], mat: 'brass' }); k.box(0.2, 0.07, 0.07, { pos: [0.1, -0.5, 0], mat: 'brass' }); k.box(0.14, 0.07, 0.07, { pos: [0.07, -0.38, 0], mat: 'brass' });
    const key = glowMesh(k, 1.4); key.position.y = 1.5;
    return { root: grp(solid(s), key), tick: (t, ob) => { key.visible = !ob.taken; key.rotation.y = t * 1.6; key.position.y = 1.5 + Math.sin(t * 2) * 0.1; } };
  },
  mechanism() {
    const s = new Paint(); s.box(1.3, 0.5, 1.3, { pos: [0, 0.25, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.04 }); s.box(0.9, 0.08, 0.9, { pos: [0, 0.54, 0], mat: 'limestone', bevel: 0.02 });
    const lv = new Paint(); lv.cyl(0.06, 0.06, 1.2, 6, { pos: [0, 0.6, 0], mat: 'woodDark' }); lv.sphere(0.15, 8, 6, { pos: [0, 1.25, 0], mat: 'brass' });
    const lever = grp(solid(lv)); lever.position.set(0, 0.55, 0);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), liveGlow('#444444', 0.1)); lamp.position.set(0.45, 0.66, 0.45);
    return { root: grp(solid(s), lever, lamp), tick: (t, ob) => { lever.rotation.z += ((ob.active ? 0.9 : -0.6) - lever.rotation.z) * 0.15; lamp.material.color.set(ob.active ? '#1c3a24' : '#222'); lamp.material.emissive.set(ob.active ? '#6dff9a' : '#111'); lamp.material.emissiveIntensity = ob.active ? 1.8 : 0.1; } };
  },
  lore(o) {
    if (o.loreKind === 'corpse') {
      const s = new Paint(); s.box(1.5, 0.12, 0.6, { pos: [0, 0.06, 0], rot: [0, 0.4, 0], mat: 'clothCream' }); s.sphere(0.2, 7, 5, { pos: [0.7, 0.2, 0.2], mat: 'bone' }); s.cyl(0.04, 0.04, 1.2, 5, { pos: [-0.3, 0.3, -0.3], rot: [0, 0, PI / 2.4], mat: 'woodDark' }); s.box(0.45, 0.3, 0.3, { pos: [-0.6, 0.15, 0.4], mat: 'clothRed', bevel: 0.03 });
      return { root: grp(solid(s)), tick: () => {} };
    }
    if (o.loreKind === 'cylinder') {
      const s = new Paint(); s.cyl(0.45, 0.55, 0.25, 8, { pos: [0, 0.1, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.3, 0.3, 0.9, 10, { pos: [0, 0.7, 0], mat: 'brass', g: [0.1, 0.8] });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 5, 20), liveGlow(CYAN, 2)); ring.position.y = 1.1; ring.rotation.x = PI / 2;
      return { root: grp(solid(s), ring), tick: (t) => { ring.rotation.z = t * 1.4; ring.material.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.6; } };
    }
    const s = new Paint(); s.box(1.1, 1.4, 0.24, { pos: [0, 0.7, 0], mat: 'rock', pat: PAT.stone, bevel: 0.05 }); s.box(1.3, 0.18, 0.4, { pos: [0, 0.05, 0], mat: 'limestoneDark', bevel: 0.03 });
    const gl = new Paint(); for (let i = 0; i < 4; i++) gl.box(0.7 - i * 0.1, 0.045, 0.03, { pos: [0, 0.4 + i * 0.24, 0.13], mat: 'glassCyan', g: [0.6, 1] });
    return { root: grp(solid(s), glowMesh(gl, 1.4)), tick: () => {} };
  },
  tablet(o) {
    const s = new Paint(); s.box(1.1, 1.5, 0.22, { pos: [0, 0.75, 0], mat: 'rock', pat: PAT.stone, bevel: 0.05 }); s.box(1.3, 0.14, 0.4, { pos: [0, 0.04, 0], mat: 'limestoneDark', bevel: 0.03 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshBasicMaterial({ map: glyphTexture(GLYPHS[(o.clue * 3 + 1) % 8], { color: '#d9a24a', bg: '#2a2620' }) })); face.position.set(0, 0.8, 0.12);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.68, 28).rotateX(-PI / 2), liveGlow('#d9a24a', 1)); ring.position.y = 0.05;
    return { root: grp(solid(s), face, ring), tick: () => {} };
  },
  tone_pillar(o) {
    const col = PILLAR_COLORS[o.index % 8];
    const s = new Paint(); s.cyl(0.5, 0.62, 0.3, 8, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.32, 0.4, 1.9, 8, { pos: [0, 1.1, 0], mat: 'limestone', pat: PAT.stone, g: [0.05, 0.9] }); s.cyl(0.44, 0.34, 0.18, 8, { pos: [0, 2.1, 0], mat: 'brass' });
    const rm = liveGlow(col, 0.8), om = liveGlow(col, 1), ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 5, 18), rm), orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), om);
    ring.position.y = 2.4; ring.rotation.x = PI / 2; orb.position.y = 2.8;
    return { root: grp(solid(s), ring, orb), tick: (t, ob, api) => { const lit = api.lit(ob), f = api.flash(ob); const i = 0.5 + (lit ? 1.6 : 0) + f * 2.8; rm.emissiveIntensity = i; om.emissiveIntensity = i * 0.9; orb.position.y = 2.8 + Math.sin(t * 2 + ob.index) * 0.06 + f * 0.2; orb.rotation.y = t; ring.rotation.z = t * 0.5; } };
  },
  mirror() {
    const s = new Paint(); s.cyl(0.24, 0.34, 0.5, 8, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.07, 0.07, 0.5, 6, { pos: [0, 0.55, 0], mat: 'iron' });
    const pl = new Paint(); pl.box(1.1, 1.0, 0.06, { mat: 'ironLight', bevel: 0.02 }); const plane = solid(pl); plane.position.y = 0.95;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.88), new THREE.MeshStandardMaterial({ color: '#dff6ff', metalness: 0.95, roughness: 0.08, emissive: '#7fe3ff', emissiveIntensity: 0.25 })); face.position.z = 0.035; plane.add(face);
    const f2 = face.clone(); f2.position.z = -0.035; f2.rotation.y = PI; plane.add(f2);
    return { root: grp(solid(s), plane), tick: (t, ob, api) => { const e = api.puzzle(ob.puzzle); const st = e?.state.state?.[ob.index]; const target = st === '/' ? -PI / 4 : PI / 4; plane.rotation.y += (target - plane.rotation.y) * 0.2; } };
  },
  beam_emitter() {
    const s = new Paint(); s.cyl(0.32, 0.42, 0.8, 8, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.22, 0.28, 0.3, 8, { pos: [0, 0.5, 0], mat: 'brass' });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), liveGlow(CYAN, 2.4)); core.position.y = 0.98;
    return { root: grp(solid(s), core), tick: (t) => { core.material.emissiveIntensity = 2 + Math.sin(t * 4) * 0.5; } };
  },
  glyph_dial() {
    const s = new Paint(); s.cyl(0.75, 0.85, 0.35, 12, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.66, 0.72, 0.12, 14, { pos: [0, 0.22, 0], mat: 'brass' });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' })); disc.position.y = 0.4;
    let last = -1;
    return { root: grp(solid(s), disc), tick: (t, ob, api) => { const e = api.puzzle(ob.puzzle); const v = e?.state.dials?.[ob.index] ?? 0; if (v !== last) { last = v; disc.material.map = glyphTexture(GLYPHS[v % 8], { color: e?.solved ? '#6dff9a' : CYAN }); disc.material.needsUpdate = true; } } };
  },
  resource(o) {
    const g = new THREE.Group(), m = o.mat;
    let glowOf = null;
    if (m === 'mat.sonic_quartz') {
      const cm = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#5fd4ff', emissiveIntensity: 1.5, roughness: 0.3, flatShading: true, color: '#aee6ff' });
      g.add(new THREE.Mesh(crystalGeo(7, { count: 5, height: 0.9 }), cm)); glowOf = cm;
    } else if (m === 'mat.bellflower') {
      const p = new Paint(), gl = new Paint();
      for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.17, h = 0.55 + (i % 3) * 0.1; p.cyl(0.015, 0.02, h, 4, { pos: [x, h / 2, (i % 2) * 0.1], mat: 'leaf' }); gl.cone(0.12, 0.22, 6, { pos: [x, h + 0.04, (i % 2) * 0.1], rot: [PI, 0, 0], mat: 'glassCyan', g: [0.4, 0.9] }); }
      g.add(solid(p), glowMesh(gl, 1.3));
    } else if (m === 'mat.brass_scrap') {
      const p = new Paint(); for (let i = 0; i < 5; i++) p.box(0.32, 0.06, 0.2, { pos: [(i - 2) * 0.16, 0.07 + i * 0.03, (i % 2) * 0.1], rot: [0.2 * i, i, 0.3], mat: i % 2 ? 'brass' : 'bronze', bevel: 0.01 });
      g.add(solid(p));
    } else if (m === 'mat.limestone_dust') {
      const p = new Paint(); for (let i = 0; i < 4; i++) p.ico(0.2 - i * 0.03, 0, { pos: [(i - 1.5) * 0.26, 0.1, (i % 2) * 0.12], mat: 'limestoneLight', pat: PAT.rock, scale: [1, 0.7, 1] });
      g.add(solid(p));
    } else {
      const p = new Paint(); for (let i = 0; i < 7; i++) p.cone(0.09, 0.4, 4, { pos: [(i % 3 - 1) * 0.16, 0.2, Math.floor(i / 3) * 0.2 - 0.1], rot: [0.2 * (i - 3), 0, 0.2 * (i % 3 - 1)], mat: i % 2 ? 'moss' : 'leaf' });
      g.add(solid(p));
    }
    // a faint sparkle ring so gatherables read from afar without clutter
    const sp = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 24).rotateX(-PI / 2), liveGlow(GOLD, 0.8)); sp.position.y = 0.05; g.add(sp);
    return { root: g, tick: (t, ob, api) => { const av = api.nodeOk(ob); g.scale.setScalar(av ? 1 : 0.0001); g.rotation.y = Math.sin(t * 0.6 + ob.x) * 0.1; sp.material.emissiveIntensity = 0.5 + 0.4 * Math.sin(t * 2.5 + ob.z); if (glowOf) glowOf.emissiveIntensity = 1.2 + 0.4 * Math.sin(t * 3 + ob.x); } };
  },
  artifact() {
    const g = new THREE.Group();
    const om = liveGlow(GOLD, 2.6), orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), om); orb.position.y = 1.4; g.add(orb);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 5, 28), liveGlow(CYAN, 2)), r2 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 5, 28), liveGlow('#ffffff', 1.4));
    r1.position.y = r2.position.y = 1.4; g.add(r1, r2);
    const s = new Paint(); s.cyl(0.4, 0.55, 0.3, 8, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); g.add(solid(s));
    const l = pointLight(GOLD, 6, 12, 1.5); g.add(l);
    return { root: g, light: l, tick: (t) => { orb.position.y = 1.4 + Math.sin(t * 2) * 0.12; orb.rotation.y = t; r1.rotation.set(t * 0.9, t * 0.5, 0); r2.rotation.set(t * 0.4, 0, t * 0.7); } };
  },
  dungeon_exit() { return portal('#6dff9a'); },
  dungeon_entrance() { return portal('#ffb050'); },
  secret_door() { return rune('#b79cff'); },
  shortcut_door() { return rune('#ffb050'); },
};
BUILD.secret_chest = BUILD.chest;
BUILD.dungeon_portal = () => portal('#b79cff');

/** an arched limestone frame with a swirling veil and a pulsing floor sigil */
function portal(color) {
  const s = new Paint();
  s.box(0.7, 0.4, 0.9, { pos: [-1.6, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.04 }); s.box(0.7, 0.4, 0.9, { pos: [1.6, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.04 });
  s.archFrame(2.7, 2.8, 0.8, 0.5, { pos: [0, 0.1, 0], mat: 'limestone', g: [0.05, 0.9] });
  s.box(0.5, 0.55, 0.95, { pos: [0, 4.5, 0], mat: 'brass', bevel: 0.04, g: [0.1, 0.8] });
  const g = grp(solid(s));
  const v = veil(color); v.position.y = 1.75; g.add(v);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 40).rotateX(-PI / 2), liveGlow(color, 1.3)); ring.position.y = 0.07; g.add(ring);
  const l = pointLight(color, 5, 10, 1.8); g.add(l);
  return { root: g, light: l, tick: (t) => { ring.material.emissiveIntensity = 1.0 + Math.sin(t * 2.2) * 0.5; l.intensity = 4.6 + Math.sin(t * 2.4) * 1.0; } };
}
function rune(color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 20).rotateX(-PI / 2), liveGlow(color, 1.6)); m.position.y = 0.08;
  return { root: grp(m), tick: (t) => { m.material.emissiveIntensity = 1.0 + Math.sin(t * 3) * 0.7; } };
}

// ───────────────────────────────────────────────────────── affordance markers
const MARK_KINDS = new Set(['chest', 'secret_chest', 'shrine', 'lore', 'resource', 'mechanism', 'key_pedestal', 'tablet', 'glyph_dial', 'artifact', 'dungeon_exit', 'dungeon_entrance', 'dungeon_portal', 'waypoint', 'station', 'stash', 'secret_door', 'shortcut_door', 'tone_pillar', 'mirror']);

class Markers {
  constructor(root, max = 80) {
    this.max = max;
    const g = new THREE.RingGeometry(0.62, 1.0, 40).rotateX(-PI / 2);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      uniforms: { uTime: WORLD.uTime },
      vertexShader: `attribute float aAmt; varying vec2 vP; varying float vAmt; void main(){ vP = position.xz; vAmt = aAmt; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vP; varying float vAmt; uniform float uTime;
        void main(){ float d = length(vP); float a = atan(vP.x, vP.y);
          float dash = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(a * 12.0 + uTime * 0.8));
          float rim = smoothstep(0.62, 0.7, d) * (1.0 - smoothstep(0.92, 1.0, d));
          float soft = smoothstep(0.62, 1.0, d) * (1.0 - smoothstep(0.98, 1.0, d)) * 0.35;
          float pulse = 0.75 + 0.25 * sin(uTime * 2.2);
          float al = (rim * (0.35 + 0.65 * dash) + soft) * vAmt * pulse;
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.45) * al * 1.4, 1.0); }`,
    });
    this.amt = new THREE.InstancedBufferAttribute(new Float32Array(max), 1); this.amt.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aAmt', this.amt);
    this.mesh = new THREE.InstancedMesh(g, this.mat, max); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 4; root.add(this.mesh);
    // the floating icon over the nearest one
    this.icon = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: glyphTexture('circle_notch', { color: '#ffe6a8', bg: '#00000000', size: 96 }), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    this.icon.renderOrder = 30; this.icon.visible = false; root.add(this.icon);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  update(list, player, nearest, hover, heightAt, cam, t) {
    let n = 0;
    for (const o of list) {
      if (n >= this.max) break;
      const d = Math.hypot(o.x - player.x, o.z - player.z);
      if (d > 26) continue;
      const near = o === nearest, hov = o === hover;
      const base = 1 - THREE.MathUtils.smoothstep(d, 9, 26);
      const a = Math.max(near ? 1.0 : 0, hov ? 1.0 : 0, base * 0.55);
      if (a < 0.02) continue;
      const r = Math.max(0.9, Math.min(2.4, (o.r ?? 2) * 0.6)) * (near ? 1.12 : 1);
      this.m.compose(this.v.set(o.x, heightAt(o.x, o.z) + 0.1, o.z), this.q.identity(), this.s.set(r, 1, r));
      this.mesh.setMatrixAt(n, this.m); this.amt.setX(n, a * (near ? 1.5 : 1)); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; this.amt.needsUpdate = true;
    const ic = nearest ?? hover;
    if (ic) { this.icon.visible = true; this.icon.position.set(ic.x, heightAt(ic.x, ic.z) + 2.6 + Math.sin(t * 2.4) * 0.12, ic.z); this.icon.quaternion.copy(cam.quaternion); } else this.icon.visible = false;
  }
}

export class InteractViews {
  /** @param {{scene:THREE.Scene, addEmitter:Function}} scene3d @param {any} session @param {(x:number,z:number)=>number} heightAt @param {any} registry */
  constructor(scene3d, session, heightAt, registry) {
    this.s3 = scene3d; this.session = session; this.heightAt = heightAt; this.reg = registry;
    scene3d.session = session;
    this.root = new THREE.Group(); this.root.name = 'interactables'; scene3d.content.add(this.root);
    this.views = new Map();
    this.flashes = new Map(); this.lit = new Map();
    this.beams = new Map();
    this.specs = new Map(registry.all('model').map((m) => [m.id, m]));
    this.markers = new Markers(this.root); this.nearest = null; this.hover = null;
    this.api = {
      lit: (o) => this.lit.get(o.puzzle)?.has(o.index) ?? false,
      flash: (o) => this.flashes.get(`${o.puzzle}:${o.index}`) ?? 0,
      puzzle: (id) => this.session.puzzleEntry(id),
      nodeOk: (o) => this.session.nodeAvailable(o).ok || o.needs === 'listen' && this.session.world.echoes.some((e) => e.id === o.id && e.found),
    };
    const ev = session.events;
    this.offs = [
      ev.on('puzzle:strike', (i) => { const set = this.lit.get(i.puzzle) ?? new Set(); this.lit.set(i.puzzle, set); if (i.correct) { set.add(i.index); this.flashes.set(`${i.puzzle}:${i.index}`, 1); } else { set.clear(); this.flashes.set(`${i.puzzle}:${i.index}`, 1); } if (i.done) this.lit.set(i.puzzle, new Set([...Array(16).keys()])); }),
    ];
  }

  #structureNear(o) { return this.session.zone?.props.some((p) => p.structure && (p.x - o.x) ** 2 + (p.z - o.z) ** 2 < 3.6 ** 2); }

  #create(o) {
    let b = null;
    if (o.kind === 'stranded_scout' || o.kind === 'survivor' || o.kind === 'event_npc') {
      const def = this.reg.get(o.npc ?? 'npc.scout');
      const spec = this.specs.get(def?.model ?? 'mdl.npc_scout');
      if (!spec) return null;
      const model = buildModelFromSpec(spec);
      const root = new THREE.Group(); root.add(model.root);
      b = { root, tick: (t, ob, api, dt) => { animate(model, { speed: 0, t, dead: false, deadT: 0, hurt: 0, cast: null, dashing: false, listening: false }, dt); } };
    } else if (SKIP_WHEN_STRUCTURE.has(o.kind)) {
      if (this.#structureNear(o) || o.kind === 'npc' || o.kind === 'event_npc') return null;
      if (o.kind === 'lore') b = BUILD.lore({ loreKind: 'cylinder' }); else if (o.kind === 'dungeon_portal') b = BUILD.dungeon_portal(); else return null;
    } else if (BUILD[o.kind]) b = BUILD[o.kind](o, this.api);
    if (!b) return null;
    const y = this.heightAt(o.x, o.z);
    b.root.position.set(o.x, y, o.z);
    b.root.rotation.y = (o.x * 12.9898 + o.z * 78.233) % 6.28;
    this.root.add(b.root);
    if (b.light) { b.root.remove(b.light); this.s3.addEmitter(b.root, b.light); }
    return b;
  }

  update(dt, t) {
    const list = this.session.interactables ?? [];
    const alive = new Set();
    const usable = [];
    for (const o of list) {
      alive.add(o.id);
      let v = this.views.get(o.id);
      if (v === undefined) { v = this.#create(o); this.views.set(o.id, v ?? null); }
      const act = this.session.isActive(o);
      if (act && !o.decor && (MARK_KINDS.has(o.kind) || o.kind === 'chest') && !(o.kind === 'resource' && !this.api.nodeOk(o))) usable.push(o);
      if (!v) continue;
      const show = o.kind === 'chest' || o.kind === 'secret_chest' ? (!o.hiddenUntilRevealed || o.revealed) : act || o.kind === 'resource';
      v.root.visible = !!show || (o.kind === 'chest' && !!o.opened);
      if (v.root.visible) v.tick?.(t, o, this.api, dt);
    }
    for (const [id, v] of this.views) if (!alive.has(id)) { if (v) { this.root.remove(v.root); disposeTree(v.root); } this.views.delete(id); }
    for (const [k, f] of this.flashes) { const n = f - dt * 2.4; if (n <= 0) this.flashes.delete(k); else this.flashes.set(k, n); }
    this.#beams();
    this.markers.update(usable, this.session.player, this.nearest, this.hover, this.heightAt, this.s3.camera, t);
  }

  /** beam puzzles: draw the traced beam as emissive segments */
  #beams() {
    const host = this.session.mode === 'dungeon' ? this.session.dungeon.puzzles : this.session.puzzleHost.map;
    for (const [id, e] of host) {
      if (e.type !== 'beam_mirrors' || !e.board) continue;
      let b = this.beams.get(id);
      if (!b) { b = { line: null, key: '' }; this.beams.set(id, b); }
      const tr = e.state.trace; const key = e.state.state.join('') + tr.cells.length;
      if (key === b.key) continue;
      b.key = key;
      if (b.line) { this.root.remove(b.line); b.line.geometry.dispose(); }
      const { ox, oz, cell } = e.board;
      const toW = (x, y) => [ox + (x + 0.5) * cell, oz + (y + 0.5) * cell];
      const [ex, ey] = e.instance.emitter.pos;
      const verts = [];
      let [px, pz] = toW(ex, ey);
      for (const [cx, cy] of tr.cells) { const [wx, wz] = toW(cx, cy); verts.push(px, 1.0, pz, wx, 1.0, wz); px = wx; pz = wz; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      b.line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: tr.solved ? '#6dff9a' : '#7fe3ff', linewidth: 2 }));
      this.root.add(b.line);
    }
  }

  /** the nearest usable interactable (set by the game each frame) brightens and gets the icon */
  highlight(o) { this.nearest = o ?? null; }
  /** the interactable under the pointer */
  setHover(o) { this.hover = o ?? null; }

  dispose() { for (const f of this.offs) f?.(); this.s3.content.remove(this.root); disposeTree(this.root); }
}

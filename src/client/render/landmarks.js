/**
 * Landmarks — the iconic, story-bearing structures of the Terraza Baja: wind harps, the Bell Gate, the voice cylinder, mural,
 * the faceless statue, waystones, the resonance chart, the crypt mouth and the Broken Canticle tower.
 * Same conventions as structures.js (local frame, +z front, optional userData.update / PointLights).
 */
import * as THREE from 'three';
import { Paint, PAT } from './paint.js';
import { Build, PI, TAU, CYAN, WARM, EMBER, doorParts, steps, lanternBracket, stringMaterial } from './structKit.js';
import { glowMaterial, glowPaintMaterial, paintMaterial } from './worldMaterials.js';

export const LANDMARKS = {
  /** a wind harp: two fluted limestone pillars, a brass-keyed arch and a veil of glowing resonant strings; chimes sway in the wind */
  windharp(ctx) {
    const b = new Build(ctx, `harp${ctx.seed ?? ''}`), s = b.solid, r = b.rng;
    for (const x of [-1.35, 1.35]) {
      s.box(1.05, 0.55, 1.05, { pos: [x, 0.1, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.05 });
      s.cyl(0.34, 0.4, 5.0, 8, { pos: [x, 3.0, 0], mat: 'limestone', pat: PAT.stone, g: [0.05, 0.9] });
      for (const y of [1.6, 3.2, 4.7]) s.cyl(0.4, 0.4, 0.14, 8, { pos: [x, y, 0], mat: 'brass', g: [0.1, 0.7] });
      s.box(0.8, 0.3, 0.8, { pos: [x, 5.65, 0], mat: 'limestoneLight', bevel: 0.04 });
    }
    // arch: half torus + keystone
    s.add(new THREE.TorusGeometry(1.35, 0.3, 5, 14, PI), { pos: [0, 5.8, 0], mat: 'limestone', pat: PAT.stone, g: [0.1, 0.8], yr: [0, 1.8] });
    s.box(0.5, 0.55, 0.7, { pos: [0, 7.4, 0], mat: 'brass', bevel: 0.04, g: [0.1, 0.7] }); s.torus(0.26, 0.05, 5, 12, { pos: [0, 7.4, 0.38], mat: 'brass' });
    s.box(2.9, 0.16, 0.2, { pos: [0, 1.0, 0], mat: 'brass', g: [0.1, 0.6] });                       // bridge the strings anchor to
    // strings: one merged glow mesh, shimmer in the shader
    const N = 9, sg = new THREE.BufferGeometry(), pos = [], ids = [], idx = [];
    for (let i = 0; i < N; i++) {
      const x = -1.0 + (i / (N - 1)) * 2.0, top = 5.8 + Math.sqrt(Math.max(0.01, 1.05 * 1.05 - x * x)) - 0.06, bot = 1.05, w = 0.028, d = 0.028, k = pos.length / 3;
      for (const [px, pz] of [[-w, -d], [w, -d], [w, d], [-w, d]]) { pos.push(x + px, bot, pz, x + px, top, pz); ids.push(i, i); }
      for (let q = 0; q < 4; q++) { const a = k + q * 2, c = k + ((q + 1) % 4) * 2; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('aId', new THREE.Float32BufferAttribute(ids, 1)); sg.setIndex(idx);
    const strings = new THREE.Mesh(sg, stringMaterial()); strings.frustumCulled = false; strings.renderOrder = 4; b.add(strings);
    // wind chimes under the arch
    const chimes = new THREE.Group(); chimes.position.set(0, 7.1, 0); b.add(chimes);
    const cp = new Paint(); cp.cyl(0.03, 0.03, 0.5, 5, { pos: [0, -0.25, 0], mat: 'iron' });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, len = 0.7 + (i % 3) * 0.35; cp.cyl(0.05, 0.05, len, 6, { pos: [Math.sin(a) * 0.28, -0.7 - len / 2, Math.cos(a) * 0.28], mat: 'brass', g: [0.1, 0.8] }); }
    const cm = new THREE.Mesh(cp.build(), paintMaterial({ pat: false })); cm.castShadow = true; chimes.add(cm);
    b.onUpdate((t) => { chimes.rotation.z = Math.sin(t * 1.3 + r.range(0, 0.001)) * 0.07; chimes.rotation.x = Math.sin(t * 0.9) * 0.05; });
    b.glow.add(new THREE.RingGeometry(1.7, 1.85, 28).rotateX(-PI / 2), { pos: [0, 0.03, 0], mat: 'glassCyan', g: [0.8, 1.0] });
    b.halo([0, 3.6, 0.2], CYAN, 2.6).floorGlow([0, 0.06, 0], CYAN, 4.2);
    return b.finish();
  },

  /** the Bell Gate to the Empty Choir: twin towers with braziers, carved arch, two sliding bronze leaves with resonance inlays */
  gate_door(ctx) {
    const b = new Build(ctx, 'gate'), s = b.solid, g = b.glow;
    for (const x of [-5.2, 5.2]) {
      s.box(2.5, 0.9, 2.5, { pos: [x, 0.1, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.06 });
      s.box(1.9, 7.2, 1.9, { pos: [x, 4.1, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.07, g: [0.05, 0.9] });
      for (const y of [2.2, 5.6]) s.box(2.1, 0.22, 2.1, { pos: [x, y, 0], mat: 'brass', bevel: 0.03, g: [0.1, 0.6] });
      s.box(2.4, 0.5, 2.4, { pos: [x, 7.9, 0], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.06 });
      s.cyl(0.62, 0.34, 0.5, 8, { pos: [x, 8.4, 0], mat: 'iron', g: [0.1, 0.8] });
      g.cone(0.42, 1.0, 6, { pos: [x, 9.1, 0], mat: 'glassCyan', g: [0.55, 1.0] });
      b.halo([x, 9.0, 0], CYAN, 3.2);
    }
    // arch + lintel
    s.archFrame(5.6, 4.6, 1.5, 0.75, { pos: [0, 0.4, 0], mat: 'limestone', g: [0.05, 0.9] });
    s.box(11.6, 0.8, 1.7, { pos: [0, 8.35 - 0.4, -0.0], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.06 });
    s.box(0.9, 1.1, 1.8, { pos: [0, 7.1, 0.0], mat: 'brass', bevel: 0.05, g: [0.1, 0.7] });
    g.torus(0.34, 0.05, 5, 16, { pos: [0, 7.1, 0.93], mat: 'glassCyan', g: [0.6, 1.0] });
    // leaves
    const leaf = (sign) => {
      const p = new Paint(), gp = new Paint();
      p.box(2.8, 5.0, 0.32, { pos: [sign * 1.4, 2.5, 0], mat: 'bronze', bevel: 0.05, g: [0.05, 0.9] });
      for (const y of [0.9, 2.5, 4.1]) p.box(2.7, 0.16, 0.38, { pos: [sign * 1.4, y, 0], mat: 'iron' });
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) p.sphere(0.07, 5, 4, { pos: [sign * (0.4 + i * 0.5), 0.9 + j * 1.6 + 0.3, 0.2], mat: 'brass' });
      gp.torus(0.7, 0.045, 5, 24, { pos: [sign * 1.4, 2.9, 0.19], mat: 'glassCyan', g: [0.6, 1.0] });
      for (let i = 0; i < 11; i++) { const a = (i / 12) * TAU + 0.2; gp.box(0.1, 0.1, 0.03, { pos: [sign * 1.4 + Math.sin(a) * 0.7, 2.9 + Math.cos(a) * 0.7, 0.2], mat: 'glassCyan', g: [0.4, 0.8] }); }
      const grp = new THREE.Group(); grp.add(Object.assign(new THREE.Mesh(p.build(), paintMaterial()), { castShadow: true, receiveShadow: true })); grp.add(new THREE.Mesh(gp.build(), glowPaintMaterial(2.2)));
      return grp;
    };
    const L = leaf(-1), R = leaf(1); L.position.set(0, 0.4, 0); R.position.set(0, 0.4, 0); b.add(L); b.add(R);
    b.group.userData.doors = { L, R };
    b.group.userData.setOpen = (o) => { const k = Math.min(1, Math.max(0, o)); L.position.x = -k * 2.55; R.position.x = k * 2.55; L.position.y = R.position.y = 0.4; };
    b.put({ solid: steps(6.4, 4, 0.2, 0.55) }, [0, 0.35, 1.0]);
    b.cloth('dungeon/banner_blue', { pos: [-3.1, 4.2, 1.0], s: 1.3, swayHeight: 3.75 }).cloth('dungeon/banner_blue', { pos: [3.1, 4.2, 1.0], s: 1.3, swayHeight: 3.75 });
    b.floorGlow([0, 0.4, 3.2], CYAN, 6);
    b.light(CYAN, 6, 14, [0, 3.5, 3.4]);
    return b.finish();
  },

  /** the voice cylinder: a brass-bound glass tube on a carved plinth, glowing with captured sound, runes orbiting */
  cylinder(ctx) {
    const b = new Build(ctx, 'cyl'), s = b.solid, g = b.glow;
    s.cyl(0.8, 0.95, 0.4, 8, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.62, 0.7, 0.3, 8, { pos: [0, 0.35, 0], mat: 'limestone', pat: PAT.stone });
    s.cyl(0.5, 0.52, 0.16, 12, { pos: [0, 0.58, 0], mat: 'brass', g: [0.1, 0.7] }); s.cyl(0.46, 0.5, 0.16, 12, { pos: [0, 1.78, 0], mat: 'brass', g: [0.1, 0.7] });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; s.box(0.07, 1.3, 0.07, { pos: [Math.sin(a) * 0.42, 1.2, Math.cos(a) * 0.42], mat: 'bronze' }); }
    s.cone(0.4, 0.4, 8, { pos: [0, 2.05, 0], mat: 'brass', g: [0.1, 0.8] }); s.sphere(0.1, 6, 5, { pos: [0, 2.3, 0], mat: 'brass' });
    const tube = new Paint(); tube.cyl(0.38, 0.38, 1.2, 12, { pos: [0, 1.18, 0], mat: 'glassCyan', g: [0.5, 1.0] });
    b.add(new THREE.Mesh(tube.build(), glowMaterial(CYAN, 1.4, { opacity: 0.62, fade: false, body: '#8fe9ff' })));
    g.cyl(0.14, 0.14, 1.0, 8, { pos: [0, 1.18, 0], mat: 'white' });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 5, 28), glowMaterial(CYAN, 2.6, { fade: false })), ring2 = ring1.clone();
    ring1.position.y = ring2.position.y = 1.2; b.add(ring1); b.add(ring2);
    b.onUpdate((t) => { ring1.rotation.set(PI / 2 + Math.sin(t) * 0.35, t * 0.9, 0); ring2.rotation.set(PI / 2 - Math.sin(t * 0.8) * 0.35, -t * 0.7, 0.5); ring1.position.y = 1.2 + Math.sin(t * 1.4) * 0.12; ring2.position.y = 1.2 - Math.sin(t * 1.1) * 0.1; });
    g.add(new THREE.RingGeometry(1.0, 1.12, 28).rotateX(-PI / 2), { pos: [0, 0.03, 0], mat: 'glassCyan', g: [0.8, 1.0] });
    b.halo([0, 1.3, 0], CYAN, 3.0).floorGlow([0, 0.05, 0], CYAN, 4.4);
    const l = b.light(CYAN, 6, 9, [0, 1.4, 0.4]);
    b.onUpdate((t) => { l.intensity = 5 + Math.sin(t * 2.2) * 1.2; });
    return b.finish();
  },

  /** "La Nota Ausente": a carved wall with a ring of brass notes — one missing */
  mural(ctx) {
    const b = new Build(ctx, 'mural'), s = b.solid, g = b.glow, r = b.rng;
    s.box(3.8, 0.5, 1.0, { pos: [0, 0.1, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.05 });
    s.box(3.4, 2.7, 0.55, { pos: [0, 1.7, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.07, g: [0.05, 0.9] });
    s.box(3.7, 0.3, 0.75, { pos: [0, 3.2, 0], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.05 });
    for (const x of [-1.85, 1.85]) s.box(0.35, 3.1, 0.7, { pos: [x, 1.7, 0], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.05 });
    s.torus(1.12, 0.07, 5, 28, { pos: [0, 1.85, 0.3], mat: 'limestoneLight' }); s.torus(0.5, 0.05, 5, 20, { pos: [0, 1.85, 0.3], mat: 'limestoneLight' });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.3, x = Math.sin(a) * 0.82, y = 1.85 + Math.cos(a) * 0.82;
      if (i === 4) { s.box(0.26, 0.26, 0.06, { pos: [x, y, 0.29], rot: [0, 0, -a], mat: 'void' }); continue; }
      g.box(0.22, 0.22, 0.08, { pos: [x, y, 0.32], rot: [0, 0, -a], mat: 'brass', g: [0.1, 0.8] });
    }
    g.cone(0.22, 0.34, 4, { pos: [0, 1.85, 0.32], rot: [PI / 2, 0, 0], mat: 'brass' });
    for (let i = 0; i < 6; i++) s.ico(0.14 + r.next() * 0.1, 0, { pos: [-1.6 + i * 0.62 + r.range(-0.1, 0.1), 0.45 + r.next() * 0.2, 0.35], mat: i % 2 ? 'moss' : 'leafDark', scale: [1, 0.6, 1] });
    b.kit('graveyard/candle_triple', { pos: [-1.2, 0.35, 0.8], s: 0.9 }).kit('graveyard/candle_melted', { pos: [1.2, 0.35, 0.75], s: 0.9 });
    b.halo([-1.2, 0.9, 0.85], WARM, 0.9).halo([1.2, 0.8, 0.8], WARM, 0.8).halo([0, 1.85, 0.7], '#ffcf7a', 2.6);
    b.light('#ffcf7a', 2.2, 6, [0, 1.8, 1.5]);
    return b.finish();
  },

  /** faceless statue of the Taciturn: robed figure, raised hands, a smooth face with no mouth */
  statue_nomouth(ctx) {
    const b = new Build(ctx, 'statue'), s = b.solid, r = b.rng;
    s.box(1.55, 0.4, 1.55, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.05 }); s.box(1.2, 0.35, 1.2, { pos: [0, 0.38, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.05 });
    s.cyl(0.4, 0.62, 1.9, 9, { pos: [0, 1.5, 0], mat: 'limestone', g: [0.1, 0.9] });
    s.cyl(0.4, 0.46, 0.16, 9, { pos: [0, 1.0, 0], mat: 'limestoneLight' });
    s.sphere(0.46, 8, 5, { pos: [0, 2.5, 0], scale: [1.15, 0.55, 0.8], mat: 'limestone', g: [0.1, 0.9] });
    for (const sx of [-1, 1]) { s.cyl(0.11, 0.15, 1.15, 6, { pos: [sx * 0.62, 2.95, 0.12], rot: [0.35, 0, sx * 0.55], mat: 'limestone', g: [0.1, 0.9] }); s.sphere(0.14, 6, 4, { pos: [sx * 0.9, 3.45, 0.32], mat: 'limestoneLight' }); }
    s.sphere(0.29, 9, 6, { pos: [0, 2.95, 0.04], mat: 'limestoneLight', g: [0.1, 0.9] });
    s.cone(0.4, 0.55, 8, { pos: [0, 3.2, -0.1], rot: [-0.25, 0, 0], mat: 'limestone' });   // hood
    s.box(0.5, 0.025, 0.06, { pos: [0, 2.85, 0.31], mat: 'limestoneDark' });                // smooth: only a seam where the mouth would be
    for (let i = 0; i < 5; i++) s.ico(0.13 + r.next() * 0.09, 0, { pos: [r.range(-0.7, 0.7), 0.28, 0.65 + r.range(-0.1, 0.1)], mat: i % 2 ? 'moss' : 'leafDark', scale: [1, 0.6, 1] });
    s.box(0.04, 0.9, 0.04, { pos: [0.18, 1.5, 0.52], rot: [0, 0, 0.2], mat: 'soot' });
    return b.finish();
  },

  /** waystone: carved obelisk on a stepped base with an orbiting resonance ring — wakes up when discovered / when the hero is near */
  waystone(ctx) {
    const b = new Build(ctx, 'waystone'), s = b.solid, g = b.glow;
    s.cyl(1.05, 1.15, 0.3, 6, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone }); s.cyl(0.82, 0.92, 0.3, 6, { pos: [0, 0.3, 0], mat: 'limestone', pat: PAT.stone });
    s.box(0.78, 2.1, 0.62, { pos: [0, 1.5, 0], rot: [0, 0.4, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.05, g: [0.05, 0.9] });
    s.cone(0.52, 0.7, 4, { pos: [0, 2.9, 0], rot: [0, 0.4 + PI / 4, 0], mat: 'limestoneLight', g: [0.1, 0.8] });
    for (let i = 0; i < 4; i++) g.box(0.5 - i * 0.07, 0.045, 0.03, { pos: [0, 0.95 + i * 0.32, 0.34], rot: [0, 0.4, 0], mat: 'glassCyan', g: [0.4, 0.9] });
    // the bit that moves/wakes: own materials so each stone can glow independently
    const ringMat = glowMaterial(CYAN, 2.4, { fade: false }).clone(), coreMat = glowMaterial(CYAN, 3, { fade: false }).clone();
    ringMat.userData.shared = false; coreMat.userData.shared = false; ringMat.userData.glowBase = 0; coreMat.userData.glowBase = 0;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.04, 5, 30), ringMat); ring.position.y = 1.6; b.add(ring);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), coreMat); gem.position.y = 3.45; b.add(gem);
    const halo = new Build(ctx, 'wsh'); halo.halo([0, 1.9, 0.4], CYAN, 3.2); const hm = halo.finish(); b.add(hm);
    const light = b.light(CYAN, 3, 8, [0, 1.8, 0.6]);
    let a = 0.35;
    b.onUpdate((t, st, focus) => {
      const sess = ctx.session?.(), prop = ctx.prop;
      const known = sess && prop?.poi ? sess.state?.waypoints?.has?.(prop.poi) : false;
      const d = focus ? Math.hypot(focus.x - b.group.position.x, focus.z - b.group.position.z) : 99;
      const target = Math.min(1, (known ? 0.65 : 0.25) + (d < 7 ? (1 - d / 7) * 0.5 : 0));
      a += (target - a) * 0.08;
      ring.rotation.set(PI / 2 + 0.2, 0, t * (0.6 + a)); ring.position.y = 1.6 + Math.sin(t * 1.3) * 0.08;
      gem.rotation.y = t * 1.4; gem.position.y = 3.45 + Math.sin(t * 1.9) * 0.08;
      ringMat.emissiveIntensity = 0.5 + a * 3.0; coreMat.emissiveIntensity = 0.7 + a * 3.6; light.intensity = 0.8 + a * 4.2;
      hm.scale.setScalar(0.4 + a * 0.8);
    });
    b.floorGlow([0, 0.06, 0], CYAN, 3.8);
    return b.finish();
  },

  /** the resonance chart table: a map-strewn bench with an astrolabe and a projected ring hologram */
  chart_table(ctx) {
    const b = new Build(ctx, 'chart'), s = b.solid, g = b.glow;
    s.box(2.6, 0.14, 1.6, { pos: [0, 1.0, 0], mat: 'woodLight', pat: PAT.plank, bevel: 0.025 });
    for (const [x, z] of [[-1.1, -0.62], [1.1, -0.62], [-1.1, 0.62], [1.1, 0.62]]) s.box(0.16, 1.0, 0.16, { pos: [x, 0.5, z], mat: 'woodDark' });
    s.box(2.2, 0.07, 0.1, { pos: [0, 0.4, 0.6], mat: 'woodDark' }); s.box(2.2, 0.07, 0.1, { pos: [0, 0.4, -0.6], mat: 'woodDark' });
    s.box(2.1, 0.03, 1.3, { pos: [0, 1.09, 0], mat: 'clothCream', g: [0.1, 0.5] });
    for (let i = 0; i < 6; i++) s.box(1.6 - i * 0.12, 0.012, 0.025, { pos: [0, 1.115, -0.45 + i * 0.17], rot: [0, 0.1 * (i - 2.5), 0], mat: 'soot' });
    s.torus(0.34, 0.025, 4, 18, { pos: [0.7, 1.17, 0.2], rot: [PI / 2, 0, 0], mat: 'brass' }); s.torus(0.22, 0.02, 4, 14, { pos: [0.7, 1.19, 0.2], rot: [PI / 2 + 0.3, 0, 0.4], mat: 'brass' });
    s.cyl(0.07, 0.07, 0.3, 6, { pos: [-0.8, 1.25, 0.3], rot: [0, 0, PI / 2 - 0.2], mat: 'clothCream' }); s.cyl(0.07, 0.07, 0.3, 6, { pos: [-0.95, 1.2, 0.0], rot: [0.1, 0.3, PI / 2], mat: 'clothCream' });
    g.torus(0.46, 0.022, 4, 28, { pos: [0, 1.5, 0], rot: [PI / 2, 0, 0], mat: 'glassCyan', g: [0.5, 1.0] }); g.cyl(0.05, 0.05, 0.6, 5, { pos: [0, 1.28, 0], mat: 'glassCyan', g: [0.5, 1.0] });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 4, 24), glowMaterial(CYAN, 2.4, { fade: false })); ring.position.y = 1.5; b.add(ring);
    b.onUpdate((t) => { ring.rotation.set(PI / 2 + Math.sin(t) * 0.4, t * 1.3, 0); });
    b.kit('dungeon/candle_lit', { pos: [-1.05, 1.07, -0.5], s: 0.7 }).kit('dungeon/candle_triple', { pos: [1.05, 1.07, -0.5], s: 0.7 });
    b.halo([0, 1.55, 0], CYAN, 2.2).halo([-1.05, 1.6, -0.5], WARM, 0.8);
    b.light(CYAN, 3, 7, [0, 1.9, 0.4]);
    return b.finish();
  },

  /** the Crypt of Resonance: a mausoleum bored into the eastern cliff — KayKit crypt, stairs down, cyan runes, torches */
  cave_mouth(ctx) {
    const b = new Build(ctx, 'crypt'), s = b.solid, g = b.glow;
    const had = !!b.wa?.geo('graveyard/crypt');
    b.kit('graveyard/crypt', { pos: [-0.5, -0.4, 0], ry: 0, s: 1.0, variant: 'violet', fallback: (bb) => { bb.solid.box(6, 4, 7, { pos: [0, 2, 0], mat: 'rockViolet', pat: PAT.stone }); } });
    // cliff shoulders, rubble and a rock lintel
    for (const [x, y, z, sc] of [[-2.2, 0.8, -4.2, 1.9], [-2.4, 1.0, 4.4, 2.0], [-1.0, 4.9, -3.0, 1.6], [-1.2, 5.0, 3.1, 1.7], [-3.2, 0.4, 0, 1.2]]) s.ico(sc, 1, { pos: [x, y, z], mat: 'rockViolet', pat: PAT.rock, scale: [1.2, 0.9, 1.1], g: [0.05, 0.9] });
    b.put({ solid: steps(2.6, 5, 0.3, 0.5, 'limestoneDark') }, [2.4, 0.2, 0], PI / 2);
    for (const z of [-2.1, 2.1]) { s.cyl(0.16, 0.2, 2.0, 6, { pos: [3.6, 1.0, z], mat: 'iron' }); s.cyl(0.36, 0.2, 0.3, 8, { pos: [3.6, 2.1, z], mat: 'iron' }); g.cone(0.3, 0.7, 6, { pos: [3.6, 2.5, z], mat: 'ember', g: [0.2, 0.9] }); b.halo([3.6, 2.6, z], EMBER, 2.0); }
    g.box(0.06, 2.4, 1.6, { pos: [2.0, 2.0, 0], mat: 'glassCyan', g: [0.85, 1.0] });
    const l = b.light('#9fdcff', 5, 12, [4, 2.5, 0]); b.light(EMBER, 3, 8, [3.7, 2.6, 2.2], true);
    b.floorGlow([4.6, 0.12, 0], CYAN, 6);
    return b.finish();
  },
};

/** The Broken Canticle: a colossal fluted resonator tower, snapped crown and giant resonance rings (visible from afar) */
export function buildCanticle() {
  const b = new Build({}, 'canticle'), s = b.solid, g = b.glow;
  const mat = paintMaterial({ pat: false, fade: false });
  s.cyl(7.5, 11.5, 30, 16, { pos: [0, 15, 0], mat: 'limestone', g: [0.05, 0.95] }); s.cyl(6.8, 7.5, 40, 16, { pos: [0, 50, 0], mat: 'limestoneLight', g: [0.05, 0.95] }); s.cyl(5.6, 6.8, 26, 14, { pos: [0, 83, 0], mat: 'limestone', g: [0.05, 0.95] });
  for (let i = 0; i < 6; i++) s.cyl(7.9 - i * 0.4, 7.9 - i * 0.4, 1.2, 16, { pos: [0, 12 + i * 13, 0], mat: 'brass', g: [0.1, 0.7] });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, h = 6 + ((i * 37) % 11); s.box(3.4, h, 2.4, { pos: [Math.sin(a) * 5.0, 96 + h / 2 - 2, Math.cos(a) * 5.0], rot: [0.1 * Math.sin(a), a, 0.15 * Math.cos(a)], mat: 'limestoneDark', g: [0.1, 0.9] }); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(18, 0.9, 6, 56), glowMaterial(CYAN, 2.2, { fade: false })), ring2 = new THREE.Mesh(new THREE.TorusGeometry(13, 0.6, 6, 48), glowMaterial(CYAN, 2.0, { fade: false }));
  ring.position.y = 102; ring2.position.y = 106; b.add(ring); b.add(ring2);
  const g2 = b.finish({ shadows: false });
  g2.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g2.userData.update = (t) => { ring.rotation.set(PI / 2 + 0.25, 0, t * 0.07); ring2.rotation.set(PI / 2 - 0.2, 0.3, -t * 0.1); };
  return g2;
}

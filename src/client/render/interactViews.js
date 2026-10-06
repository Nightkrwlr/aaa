/**
 * InteractViews — procedural meshes for everything in `session.interactables` that has no authored structure:
 * chests, shrines, puzzle pillars / tablets / dials / mirrors, gathering nodes, lore objects, portals, artifacts…
 * Views are created/removed by diffing the interactable list each frame (dungeons and events mutate it).
 */
import * as THREE from 'three';
import { mat, box, cyl, cone, sphere, torus, ico, group, disposeTree } from './kit.js';
import { glyphTexture, GLYPHS } from './glyphs.js';
import { buildModelFromSpec } from './models.js';
import { animate } from './anim.js';
import { trace } from '../../sim/puzzles/beamMirrors.js';

const PI = Math.PI;
const PILLAR_COLORS = ['#7fe3ff', '#ffb050', '#b79cff', '#6dff9a', '#ff7a8a', '#ffe34a', '#9fb0ff', '#ffa0e0'];
const STONE = '#8d8570', STONE_D = '#6d6658', BRASS = '#d9a24a', BRASS_D = '#8a6428', WOOD = '#8a6a48', CYAN = '#7fe3ff';
const glow = (c, i = 1) => mat(c, { emissive: c, ei: i, fade: false });

const SKIP_WHEN_STRUCTURE = new Set(['waypoint', 'station', 'stash', 'gate', 'npc', 'dungeon_portal', 'lore', 'event_npc']);

const BUILD = {
  shrine() {
    const g = group();
    g.add(cyl(0.95, 1.15, 0.3, STONE, { pos: [0, 0.15, 0] }));
    g.add(cyl(0.55, 0.38, 0.5, BRASS, { pos: [0, 0.55, 0], metal: 0.6 }));
    const flame = cone(0.24, 0.8, CYAN, { pos: [0, 1.2, 0], seg: 6, material: glow(CYAN, 1.6) });
    g.add(flame);
    g.add(torus(1.3, 0.04, CYAN, { pos: [0, 0.05, 0], rot: [PI / 2, 0, 0], material: glow(CYAN, 1.2), seg: 32 }));
    const l = new THREE.PointLight(CYAN, 6, 11, 2); l.position.y = 1.4; g.add(l);
    return { root: g, light: l, tick: (t) => { flame.scale.y = 1 + Math.sin(t * 9) * 0.15; l.intensity = 5.5 + Math.sin(t * 7) * 0.8; } };
  },
  chest(o) {
    const g = group(); const rich = (o.tier ?? 1) >= 2;
    g.add(box(1.3, 0.7, 0.85, rich ? '#4a3f5a' : WOOD, { pos: [0, 0.35, 0] }));
    g.add(box(1.34, 0.1, 0.9, rich ? '#7fe3ff' : BRASS_D, { pos: [0, 0.45, 0], emissive: rich ? CYAN : '#000', ei: rich ? 0.5 : 0 }));
    const lid = new THREE.Group(); lid.position.set(0, 0.7, -0.42);
    lid.add(box(1.34, 0.3, 0.9, rich ? '#5a4d70' : '#9a7a54', { pos: [0, 0.15, 0.42] }));
    lid.add(box(0.2, 0.22, 0.1, BRASS, { pos: [0, 0.05, 0.9], metal: 0.6 }));
    g.add(lid);
    if (o.sealed || o.secret) g.add(torus(0.9, 0.03, '#b79cff', { pos: [0, 0.05, 0], rot: [PI / 2, 0, 0], material: glow('#b79cff', 1) }));
    return { root: g, tick: (t, ob) => { const target = ob.opened ? -1.15 : 0; lid.rotation.x += (target - lid.rotation.x) * 0.2; } };
  },
  key_pedestal() {
    const g = group();
    g.add(cyl(0.5, 0.65, 0.9, STONE, { pos: [0, 0.45, 0], seg: 6 }));
    const key = group([torus(0.18, 0.05, BRASS, { material: glow(BRASS, 0.8) }), box(0.07, 0.5, 0.07, BRASS, { pos: [0, -0.35, 0], material: glow(BRASS, 0.8) }), box(0.2, 0.07, 0.07, BRASS, { pos: [0.1, -0.5, 0], material: glow(BRASS, 0.8) })]);
    key.position.y = 1.5; g.add(key);
    return { root: g, tick: (t, ob) => { key.visible = !ob.taken; key.rotation.y = t * 1.6; key.position.y = 1.5 + Math.sin(t * 2) * 0.1; } };
  },
  mechanism() {
    const g = group();
    g.add(box(1.2, 0.5, 1.2, STONE_D, { pos: [0, 0.25, 0] }));
    const lever = group([cyl(0.06, 0.06, 1.2, '#5a4a3a', { pos: [0, 0.6, 0] }), sphere(0.14, BRASS, { pos: [0, 1.25, 0] })]);
    lever.position.set(0, 0.5, 0); g.add(lever);
    const lamp = sphere(0.16, '#222', { pos: [0.4, 0.58, 0.4] }); g.add(lamp);
    return { root: g, tick: (t, ob) => { lever.rotation.z += ((ob.active ? 0.9 : -0.6) - lever.rotation.z) * 0.15; lamp.material = ob.active ? glow('#6dff9a', 1.4) : mat('#444'); } };
  },
  lore(o) {
    const g = group();
    if (o.loreKind === 'corpse') {
      g.add(box(1.5, 0.12, 0.6, '#cfc7b0', { pos: [0, 0.08, 0], rot: [0, 0.4, 0] })); g.add(sphere(0.2, '#d8d0bc', { pos: [0.7, 0.2, 0.2] }));
      g.add(cyl(0.04, 0.04, 1.2, '#6a5a48', { pos: [-0.3, 0.3, -0.3], rot: [0, 0, PI / 2.4] }));
    } else if (o.loreKind === 'cylinder') {
      g.add(cyl(0.45, 0.5, 0.25, STONE_D, { pos: [0, 0.12, 0] })); g.add(cyl(0.28, 0.28, 0.9, '#b88a3e', { pos: [0, 0.7, 0], metal: 0.6 }));
      g.add(torus(0.3, 0.03, CYAN, { pos: [0, 1.0, 0], rot: [PI / 2, 0, 0], material: glow(CYAN, 1.3) }));
    } else {
      g.add(box(1.1, 1.3, 0.2, STONE, { pos: [0, 0.65, 0] }));
      for (let i = 0; i < 4; i++) g.add(box(0.7 - i * 0.08, 0.04, 0.02, CYAN, { pos: [0, 0.35 + i * 0.22, 0.11], material: glow(CYAN, 0.9) }));
    }
    return { root: g, tick: () => {} };
  },
  tablet(o) {
    const g = group();
    g.add(box(1.0, 1.4, 0.2, STONE, { pos: [0, 0.7, 0] }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), new THREE.MeshBasicMaterial({ map: glyphTexture(GLYPHS[(o.clue * 3 + 1) % 8], { color: '#d9a24a', bg: '#2a2620' }), transparent: false }));
    face.position.set(0, 0.7, 0.11); g.add(face);
    g.add(torus(0.62, 0.025, BRASS, { pos: [0, 0.05, 0], rot: [PI / 2, 0, 0], material: glow(BRASS, 0.6) }));
    return { root: g, tick: () => {} };
  },
  tone_pillar(o, ctx) {
    const col = PILLAR_COLORS[o.index % 8];
    const g = group();
    g.add(cyl(0.45, 0.55, 0.3, STONE_D, { pos: [0, 0.15, 0] }));
    g.add(cyl(0.3, 0.38, 1.9, STONE, { pos: [0, 1.2, 0], seg: 8 }));
    const ring = torus(0.4, 0.06, col, { pos: [0, 2.3, 0], rot: [PI / 2, 0, 0], material: glow(col, 0.5) }); g.add(ring);
    const orb = sphere(0.2, col, { pos: [0, 2.7, 0], material: glow(col, 0.7) }); g.add(orb);
    return { root: g, tick: (t, ob, api) => { const lit = api.lit(ob), f = api.flash(ob); const i = 0.35 + (lit ? 1.4 : 0) + f * 2.4; ring.material = glow(col, i); orb.material = glow(col, i * 0.9); orb.position.y = 2.7 + Math.sin(t * 2 + ob.index) * 0.06 + f * 0.2; } };
  },
  mirror(o) {
    const g = group();
    g.add(cyl(0.2, 0.3, 0.5, STONE_D, { pos: [0, 0.25, 0] }));
    const plane = box(1.1, 1.0, 0.06, '#cfe9f2', { pos: [0, 0.95, 0], metal: 0.9, rough: 0.15 }); g.add(plane);
    return { root: g, tick: (t, ob, api) => { const e = api.puzzle(ob.puzzle); const s = e?.state.state?.[ob.index]; const target = s === '/' ? -PI / 4 : PI / 4; plane.rotation.y += (target - plane.rotation.y) * 0.2; } };
  },
  beam_emitter() {
    const g = group();
    g.add(cyl(0.3, 0.4, 0.8, STONE_D, { pos: [0, 0.4, 0] })); g.add(sphere(0.25, CYAN, { pos: [0, 0.95, 0], material: glow(CYAN, 1.6) }));
    return { root: g, tick: () => {} };
  },
  glyph_dial(o) {
    const g = group();
    g.add(cyl(0.7, 0.8, 0.35, STONE_D, { pos: [0, 0.17, 0] }));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    disc.position.y = 0.42; g.add(disc);
    let last = -1;
    return { root: g, tick: (t, ob, api) => { const e = api.puzzle(ob.puzzle); const v = e?.state.dials?.[ob.index] ?? 0; if (v !== last) { last = v; disc.material.map = glyphTexture(GLYPHS[v % 8], { color: e?.solved ? '#6dff9a' : CYAN }); disc.material.needsUpdate = true; } } };
  },
  resource(o) {
    const g = group(); const m = o.mat;
    if (m === 'mat.sonic_quartz') { for (let i = 0; i < 3; i++) g.add(ico(0.18 + i * 0.06, CYAN, { pos: [(i - 1) * 0.22, 0.2 + i * 0.05, (i % 2) * 0.1], scale: [0.6, 1.8, 0.6], rot: [0, i, 0.2 * (i - 1)], material: glow(CYAN, 0.9) })); }
    else if (m === 'mat.bellflower') { for (let i = 0; i < 4; i++) { g.add(cyl(0.02, 0.02, 0.5, '#4a7a4a', { pos: [(i - 1.5) * 0.15, 0.25, 0], seg: 4 })); g.add(cone(0.11, 0.2, '#8fb0ff', { pos: [(i - 1.5) * 0.15, 0.55, 0], rot: [PI, 0, 0], material: glow('#8fb0ff', 0.5) })); } }
    else if (m === 'mat.brass_scrap') { for (let i = 0; i < 4; i++) g.add(box(0.3, 0.05, 0.2, BRASS, { pos: [(i - 1.5) * 0.18, 0.08 + i * 0.03, (i % 2) * 0.1], rot: [0.2 * i, i, 0.3], metal: 0.7 })); }
    else if (m === 'mat.limestone_dust') { for (let i = 0; i < 3; i++) g.add(ico(0.22 - i * 0.04, '#e6dcc0', { pos: [(i - 1) * 0.28, 0.12, 0] })); }
    else { for (let i = 0; i < 6; i++) g.add(cone(0.08, 0.35, '#9ab08a', { pos: [(i % 3 - 1) * 0.16, 0.17, Math.floor(i / 3) * 0.2 - 0.1], rot: [0.2 * (i - 3), 0, 0.2 * (i % 3 - 1)], seg: 4 })); }
    return { root: g, tick: (t, ob, api) => { const av = api.nodeOk(ob); g.scale.setScalar(av ? 1 : 0.0001); g.rotation.y = Math.sin(t * 0.6 + ob.x) * 0.1; } };
  },
  artifact() {
    const g = group();
    const orb = sphere(0.42, BRASS, { pos: [0, 1.4, 0], material: glow(BRASS, 1.3), seg: 12 }); g.add(orb);
    const r1 = torus(0.7, 0.04, CYAN, { pos: [0, 1.4, 0], material: glow(CYAN, 1.2) }); g.add(r1);
    const r2 = torus(0.85, 0.03, '#ffffff', { pos: [0, 1.4, 0], material: glow('#ffffff', 0.8) }); g.add(r2);
    const l = new THREE.PointLight(BRASS, 6, 12, 2); l.position.y = 1.5; g.add(l);
    return { root: g, light: l, tick: (t) => { orb.position.y = 1.4 + Math.sin(t * 2) * 0.12; r1.rotation.set(t * 0.9, t * 0.5, 0); r2.rotation.set(t * 0.4, 0, t * 0.7); } };
  },
  dungeon_exit() { return portal('#6dff9a'); },
  dungeon_entrance() { return portal('#ffb050'); },
  secret_door() { return rune('#b79cff'); },
  shortcut_door() { return rune('#ffb050'); },
};
BUILD.secret_chest = BUILD.chest;
BUILD.dungeon_portal = () => portal('#b79cff');

function portal(color) {
  const g = group();
  g.add(box(0.5, 3.4, 0.5, STONE, { pos: [-1.6, 1.7, 0] })); g.add(box(0.5, 3.4, 0.5, STONE, { pos: [1.6, 1.7, 0] })); g.add(box(3.7, 0.5, 0.6, STONE_D, { pos: [0, 3.6, 0] }));
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  veil.position.y = 1.7; g.add(veil);
  const l = new THREE.PointLight(color, 5, 10, 2); l.position.y = 1.8; g.add(l);
  return { root: g, light: l, tick: (t) => { veil.material.opacity = 0.28 + Math.sin(t * 2.4) * 0.08; } };
}
function rune(color) {
  const g = group();
  const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -PI / 2; m.position.y = 0.08; g.add(m);
  return { root: g, tick: (t) => { m.material.opacity = 0.5 + Math.sin(t * 3) * 0.3; } };
}

export class InteractViews {
  /** @param {{scene:THREE.Scene, addEmitter:Function}} scene3d @param {any} session @param {(x:number,z:number)=>number} heightAt @param {any} registry */
  constructor(scene3d, session, heightAt, registry) {
    this.s3 = scene3d; this.session = session; this.heightAt = heightAt; this.reg = registry;
    this.root = new THREE.Group(); this.root.name = 'interactables'; scene3d.content.add(this.root);
    this.views = new Map();
    this.flashes = new Map(); this.lit = new Map();
    this.beams = new Map();
    this.specs = new Map(registry.all('model').map((m) => [m.id, m]));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 32), new THREE.MeshBasicMaterial({ color: '#ffe6a8', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -PI / 2; this.ring.visible = false; this.root.add(this.ring);
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
    for (const o of list) {
      alive.add(o.id);
      let v = this.views.get(o.id);
      if (v === undefined) { v = this.#create(o); this.views.set(o.id, v ?? null); }
      if (!v) continue;
      const show = o.kind === 'chest' || o.kind === 'secret_chest' ? (!o.hiddenUntilRevealed || o.revealed) : this.session.isActive(o) || o.kind === 'resource';
      v.root.visible = !!show || (o.kind === 'chest' && !!o.opened);
      if (v.root.visible) v.tick?.(t, o, this.api, dt);
    }
    for (const [id, v] of this.views) if (!alive.has(id)) { if (v) { this.root.remove(v.root); disposeTree(v.root); } this.views.delete(id); }
    for (const [k, f] of this.flashes) { const n = f - dt * 2.4; if (n <= 0) this.flashes.delete(k); else this.flashes.set(k, n); }
    this.#beams();
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
      const { ox, oz, cell } = e.board, pts = [];
      const toW = (x, y) => [ox + (x + 0.5) * cell, oz + (y + 0.5) * cell];
      const [ex, ey] = e.instance.emitter.pos; pts.push(...toW(ex, ey));
      let prevDir = e.instance.emitter.dir;
      const verts = [];
      let [px, pz] = toW(ex, ey);
      for (const [cx, cy] of tr.cells) { const [wx, wz] = toW(cx, cy); verts.push(px, 1.0, pz, wx, 1.0, wz); px = wx; pz = wz; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      b.line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: tr.solved ? '#6dff9a' : '#7fe3ff', linewidth: 2 }));
      this.root.add(b.line);
      // receptors
      for (const [rx, ry] of e.instance.receptors) { /* receptors drawn as small orbs once */ }
    }
  }

  highlight(o) {
    if (!o) { this.ring.visible = false; return; }
    this.ring.visible = true; this.ring.position.set(o.x, this.heightAt(o.x, o.z) + 0.12, o.z);
    this.ring.scale.setScalar(Math.max(1, (o.r ?? 2) * 0.7));
  }

  dispose() { for (const f of this.offs) f?.(); this.s3.content.remove(this.root); disposeTree(this.root); }
}

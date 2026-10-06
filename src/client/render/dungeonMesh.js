/**
 * DungeonMesh — turns a generated dungeon (tilemap + content) into 3D: merged floor, instanced walls & trim,
 * doors/gates, themed props and budgeted lights. Rooms get subtle tints from their role (boss / shrine / secret…).
 * The runtime stays the source of truth: doors opening are mirrored through `onDoorOpen`.
 */
import * as THREE from 'three';
import { Rng } from '../../core/rng.js';
import { T, TILE } from '../../sim/dungeon/tilemap.js';
import { mat, box, cyl, cone, sphere, torus, ico, group, applyOcclusionFade, disposeTree } from './kit.js';

const PI = Math.PI, WALL_H = 3.5;
const ROOM_TINT = { boss: '#8a4a3a', shrine: '#4a8aa8', secret: '#8a6aa8', treasure: '#a88a3a', entrance: '#6a8a6a', exit: '#6a8a6a', wave_arena: '#8a5a4a', puzzle: '#5a6a9a' };

export function buildDungeonMesh(dungeon, family, scene3d) {
  const map = dungeon.map, pal = family.palette, content = dungeon.content;
  const root = new THREE.Group(); root.name = 'dungeon';
  const rng = new Rng(`${dungeon.seed}:mesh`);
  const out = { root, doorViews: new Map(), update: () => {}, wallIndex: new Map() };

  // ── floor (one merged mesh, vertex colours)
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color(), base = new THREE.Color(pal.floor), tint = new THREE.Color();
  const roomOf = (x, y) => { const r = map.region[map.idx(x, y)]; return r < 0 ? null : [...dungeon.rooms.values()].find((rm) => rm.region === r); };
  const regionRoom = new Map(); for (const rm of dungeon.rooms.values()) regionRoom.set(rm.region, rm);
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.get(x, y);
    if (t === T.WALL) continue;
    const rm = regionRoom.get(map.region[map.idx(x, y)]);
    c.copy(base);
    const checker = (x + y) & 1 ? 0.94 : 1.03;
    const n = 0.9 + rng.next() * 0.2;
    c.multiplyScalar(checker * n);
    if (rm && ROOM_TINT[rm.node?.type]) { tint.set(ROOM_TINT[rm.node.type]); c.lerp(tint, 0.28); }
    if (t === T.DOOR) c.lerp(new THREE.Color(pal.trim), 0.35);
    if (t === T.PIT) c.set('#050607');
    const x0 = x * TILE, z0 = y * TILE, x1 = x0 + TILE, z1 = z0 + TILE, b = pos.length / 3;
    pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
    for (let i = 0; i < 4; i++) { nor.push(0, 1, 0); col.push(c.r, c.g, c.b); }
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); fg.setIndex(idx);
  const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  applyOcclusionFade(floorMat);
  const floor = new THREE.Mesh(fg, floorMat); floor.receiveShadow = true; floor.name = 'floor'; root.add(floor);

  // ── walls (instanced) + trim caps. Only wall tiles touching open ground are drawn.
  const touches = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = map.get(x + dx, y + dy); if (t !== T.WALL && t !== T.SECRET) return true; } return false; };
  const wallTiles = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) { const t = map.get(x, y); if ((t === T.WALL || t === T.SECRET) && touches(x, y)) wallTiles.push([x, y, t]); }
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true });
  applyOcclusionFade(wallMat);
  const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1, wallTiles.length));
  const trimMat = new THREE.MeshStandardMaterial({ color: pal.trim, roughness: 0.7, metalness: 0.2, flatShading: true }); applyOcclusionFade(trimMat);
  const trims = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE + 0.12, 0.22, TILE + 0.12), trimMat, Math.max(1, wallTiles.length));
  const m4 = new THREE.Matrix4(), wc = new THREE.Color(), wbase = new THREE.Color(pal.wall);
  wallTiles.forEach(([x, y, t], i) => {
    const h = WALL_H * (0.94 + ((x * 7 + y * 13) % 5) * 0.03);
    m4.compose(new THREE.Vector3(x * TILE + TILE / 2, h / 2, y * TILE + TILE / 2), new THREE.Quaternion(), new THREE.Vector3(1, h / WALL_H, 1));
    walls.setMatrixAt(i, m4);
    wc.copy(wbase).multiplyScalar(0.82 + ((x * 31 + y * 17) % 9) * 0.03);
    if (t === T.SECRET) wc.multiplyScalar(0.93);
    walls.setColorAt(i, wc);
    m4.compose(new THREE.Vector3(x * TILE + TILE / 2, h + 0.08, y * TILE + TILE / 2), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    trims.setMatrixAt(i, m4);
    out.wallIndex.set(map.idx(x, y), i);
  });
  walls.castShadow = true; walls.receiveShadow = true; walls.frustumCulled = false; trims.frustumCulled = false;
  root.add(walls, trims);
  out.walls = walls; out.trims = trims;

  // ── doors
  const mkDoor = (door) => {
    const g = new THREE.Group();
    const xs = door.cells.map(([x]) => x), ys = door.cells.map(([, y]) => y);
    const passAlongX = (x, y) => map.get(x - 1, y) !== T.WALL && map.get(x + 1, y) !== T.WALL;
    const spanX = new Set(xs).size > 1 || (new Set(ys).size === 1 && !passAlongX(xs[0], ys[0]));
    const cx = door.x, cz = door.z, span = (spanX ? (Math.max(...xs) - Math.min(...xs) + 1) : (Math.max(...ys) - Math.min(...ys) + 1)) * TILE;
    g.position.set(cx, 0, cz); g.rotation.y = spanX ? 0 : PI / 2;
    const kind = door.kind;
    if (door.type === T.LOCK) {
      const bars = group();
      for (let i = 0; i < Math.max(3, Math.round(span / 0.45)); i++) bars.add(cyl(0.05, 0.05, 2.9, '#b88a3e', { pos: [-span / 2 + 0.3 + i * (span - 0.6) / Math.max(2, Math.round(span / 0.45) - 1), 1.45, 0], metal: 0.7, seg: 5 }));
      bars.add(box(span, 0.18, 0.2, '#6d5a3a', { pos: [0, 2.9, 0] })); bars.add(box(span, 0.18, 0.2, '#6d5a3a', { pos: [0, 0.4, 0] }));
      bars.add(sphere(0.2, '#ffd27a', { pos: [0, 1.5, 0.16], material: mat('#ffd27a', { emissive: '#ffb050', ei: 1.1, fade: false }) }));
      g.add(bars); out.doorViews.set(door.id, { g, bars });
    } else if (kind === 'shortcut' || door.type === T.ONEWAY) {
      const pl = group();
      for (let i = 0; i < 5; i++) pl.add(box(span, 0.35, 0.18, '#7a5a3a', { pos: [0, 0.3 + i * 0.5, 0.05 * (i % 2)], rot: [0, 0, (i % 2 ? 1 : -1) * 0.05] }));
      pl.add(box(0.2, 2.8, 0.3, '#5a4028', { pos: [-span / 2 + 0.2, 1.4, 0] })); pl.add(box(0.2, 2.8, 0.3, '#5a4028', { pos: [span / 2 - 0.2, 1.4, 0] }));
      g.add(pl); out.doorViews.set(door.id, { g, bars: pl });
    } else if (kind === 'secret') {
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(span * 0.9, 2.4), new THREE.MeshBasicMaterial({ color: '#b79cff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      seam.position.set(0, 1.4, 0); g.add(seam); out.doorViews.set(door.id, { g, seam, secret: true });
    }
    // frame for every door
    const frame = group();
    frame.add(box(0.5, 3.4, 0.7, pal.trim, { pos: [-span / 2 - 0.25, 1.7, 0] })); frame.add(box(0.5, 3.4, 0.7, pal.trim, { pos: [span / 2 + 0.25, 1.7, 0] })); frame.add(box(span + 1.0, 0.5, 0.7, pal.trim, { pos: [0, 3.35, 0] }));
    if (kind !== 'secret') g.add(frame);
    root.add(g);
  };
  for (const d of scene3d.session.dungeon.doors) mkDoor(d);

  out.openDoor = (door) => {
    const v = out.doorViews.get(door.id);
    for (const [x, y] of door.cells) { const i = out.wallIndex.get(map.idx(x, y)); if (i !== undefined) { m4.compose(new THREE.Vector3(0, -50, 0), new THREE.Quaternion(), new THREE.Vector3(0.001, 0.001, 0.001)); walls.setMatrixAt(i, m4); trims.setMatrixAt(i, m4); } }
    walls.instanceMatrix.needsUpdate = true; trims.instanceMatrix.needsUpdate = true;
    if (v) { v.opening = 0; v.open = true; }
    if (door.kind === 'secret') { const fr = group(); /* secret doors reveal a plain archway */ }
  };

  // ── props
  const P = { };
  for (const p of content.props) {
    const m = buildProp(p.kind, pal, family);
    if (!m) continue;
    m.position.set(p.x, 0, p.z); m.rotation.y = p.rot ?? 0; m.scale.setScalar(p.scale ?? 1);
    root.add(m);
    if (m.userData.update) { const f = m.userData.update; const prev = out.update; out.update = (t) => { prev(t); f(t); }; }
  }
  // room emblems (floor rings) for boss / shrine / exit
  for (const rm of dungeon.rooms.values()) {
    const ty = rm.node?.type;
    if (!['boss', 'shrine', 'wave_arena'].includes(ty)) continue;
    const r = Math.min(rm.w, rm.h) * TILE * 0.32;
    const col = ty === 'boss' ? '#ff6a4a' : ty === 'shrine' ? '#7fe3ff' : '#ffb050';
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -PI / 2; ring.position.set((rm.cx + 0.5) * TILE, 0.04, (rm.cy + 0.5) * TILE); root.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r * 0.6, 40), ring.material); ring2.rotation.x = -PI / 2; ring2.position.copy(ring.position); root.add(ring2);
  }

  // ── lights → emitters (budgeted by Scene3D)
  for (const l of content.lights) {
    const light = new THREE.PointLight(l.color, l.intensity * (content.lightMult ?? 1), l.range, 2);
    const holder = new THREE.Object3D(); holder.position.set(l.x, 2.2, l.z); root.add(holder);
    scene3d.addEmitter(holder, light, l.flicker);
  }

  // secret doors shimmer while the player listens
  const prevU = out.update;
  out.update = (t, listenActive) => {
    prevU(t);
    for (const v of out.doorViews.values()) if (v.secret && v.seam) v.seam.material.opacity += ((v.revealed ? 0.55 + Math.sin(t * 4) * 0.2 : 0) - v.seam.material.opacity) * 0.15;
    for (const v of out.doorViews.values()) if (v.open && v.bars && v.opening !== undefined) { v.opening = Math.min(1, v.opening + 0.03); v.bars.position.y = v.opening * 3.2; if (v.opening >= 1) v.bars.visible = false; }
  };
  out.dispose = () => disposeTree(root);
  return out;
}

const MAT = (c, o) => mat(c, o);
function buildProp(kind, pal, family) {
  const g = group();
  switch (kind) {
    case 'd_pillar': g.add(cyl(0.7, 0.8, 0.4, pal.wall, { pos: [0, 0.2, 0], seg: 10 })); g.add(cyl(0.5, 0.55, 3.0, pal.floor, { pos: [0, 1.9, 0], seg: 10 })); g.add(cyl(0.75, 0.55, 0.35, pal.trim, { pos: [0, 3.55, 0], seg: 10 })); break;
    case 'sarcophagus': g.add(box(1.0, 0.7, 2.2, '#7d776a', { pos: [0, 0.35, 0] })); g.add(box(1.1, 0.25, 2.3, '#9a9484', { pos: [0, 0.82, 0], rot: [0, 0, 0.0] })); g.add(box(0.2, 0.05, 1.0, pal.trim, { pos: [0, 0.97, 0], emissive: pal.trim, ei: 0.3 })); break;
    case 'urn': g.add(cyl(0.3, 0.2, 0.7, '#a07a54', { pos: [0, 0.35, 0], seg: 8 })); g.add(cyl(0.2, 0.3, 0.2, '#8a6a46', { pos: [0, 0.8, 0], seg: 8 })); break;
    case 'brazier': {
      g.add(cyl(0.12, 0.2, 0.9, '#3a3a40', { pos: [0, 0.45, 0], metal: 0.5, seg: 6 })); g.add(cyl(0.5, 0.3, 0.3, '#2a2a30', { pos: [0, 1.0, 0], metal: 0.5, seg: 8 }));
      const f = cone(0.3, 0.8, '#ffb050', { pos: [0, 1.5, 0], seg: 6, material: mat('#ffb050', { emissive: '#ff7a1a', ei: 1.6, fade: false }) }); g.add(f);
      g.userData.update = (t) => { f.scale.y = 1 + Math.sin(t * 11 + g.position.x) * 0.18; f.scale.x = f.scale.z = 1 + Math.sin(t * 8.3 + g.position.z) * 0.1; };
      break; }
    case 'crystal_cluster': for (let i = 0; i < 4; i++) g.add(ico(0.35, '#7fe3ff', { pos: [Math.sin(i * 1.7) * 0.5, 0.7 * (1 - i * 0.12), Math.cos(i * 1.7) * 0.5], scale: [0.55, 1.5 + (i % 2) * 0.6, 0.55], rot: [0.2 * i, i, 0.2], material: mat('#7fe3ff', { emissive: '#4ab8d8', ei: 0.9, fade: false }) })); break;
    case 'stalagmite': g.add(cone(0.5, 1.8, pal.wall, { pos: [0, 0.9, 0], seg: 6 })); break;
    case 'mushroom': g.add(cyl(0.06, 0.09, 0.5, '#d6cfa8', { pos: [0, 0.25, 0], seg: 5 })); g.add(sphere(0.3, '#6dffaa', { pos: [0, 0.55, 0], scale: [1, 0.55, 1], material: mat('#6dffaa', { emissive: '#3aff8a', ei: 0.9, fade: false }) })); break;
    case 'machine': g.add(box(1.6, 2.0, 1.2, '#5a5750', { pos: [0, 1.0, 0] })); g.add(cyl(0.45, 0.45, 0.25, '#b88a3e', { pos: [0, 1.5, 0.65], rot: [PI / 2, 0, 0], metal: 0.6 })); g.add(box(0.8, 0.2, 0.05, '#ffb050', { pos: [0, 1.9, 0.62], material: mat('#ffb050', { emissive: '#ffb050', ei: 1.1, fade: false }) })); break;
    case 'console': g.add(box(1.4, 0.9, 0.7, '#4a4a4f', { pos: [0, 0.45, 0] })); g.add(box(1.3, 0.1, 0.7, '#3a3a40', { pos: [0, 1.0, 0.0], rot: [-0.45, 0, 0] })); g.add(box(0.9, 0.05, 0.4, '#7fe3ff', { pos: [0, 1.07, 0.0], rot: [-0.45, 0, 0], material: mat('#7fe3ff', { emissive: '#7fe3ff', ei: 1.0, fade: false }) })); break;
    case 'cargo': g.add(box(1.2, 1.0, 1.2, '#8a6a44', { pos: [0, 0.5, 0] })); g.add(box(0.9, 0.8, 0.9, '#7a5c3a', { pos: [0.3, 1.4, 0.1], rot: [0, 0.4, 0] })); break;
    case 'lamp_post': g.add(cyl(0.06, 0.08, 2.6, '#3a3a40', { pos: [0, 1.3, 0], seg: 5 })); g.add(sphere(0.2, '#fff4d0', { pos: [0, 2.7, 0], material: mat('#fff4d0', { emissive: '#ffe4a0', ei: 1.5, fade: false }) })); break;
    default: return null;
  }
  return g;
}

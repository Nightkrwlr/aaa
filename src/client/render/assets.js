import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { logger } from '../../core/logger.js';

const log = logger('assets');

/**
 * Asset library — loads the optimised CC0 glTF set (public/assets, built by tools/assets/build-assets.mjs) and hands out
 * ready-to-use instances. This is the ONLY place that knows about files and clip names; the rest of the client asks for
 * "a Knight", "a wall piece", "play Attack".
 *
 *   const assets = new Assets();                    await assets.load(onProgress)
 *   const rig = assets.character('Knight', {tint:'#9fb4ff'})   // THREE.Group + AnimationMixer wrapper
 *   rig.play('Run');  rig.once('Attack1H', {then:'Idle'});  rig.update(dt)
 *   rig.attach('hand.r', assets.prop('weapons','sword_1handed'))
 *   const wall = assets.prop('dungeon','wall')      // static prop (cheap clone, shared geometry/material)
 *   const {geometry, material} = assets.bake('dungeon','floor_tile_large')   // merged, for InstancedMesh
 *
 * Every public method degrades gracefully: when a model is missing it returns null so callers fall back to the
 * procedural models (the game must still start if an asset fails to download).
 */

/** logical clip names used by the game → real KayKit clip names (first existing one wins) */
export const CLIPS = {
  idle: ['Idle', 'Unarmed_Idle'],
  idleCombat: ['Idle_Combat', '2H_Melee_Idle', 'Idle'],
  walk: ['Walking_A', 'Walking_B'],
  run: ['Running_A', 'Running_B'],
  runBack: ['Walking_Backwards'],
  strafeL: ['Running_Strafe_Left'],
  strafeR: ['Running_Strafe_Right'],
  attack1h: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop'],
  attack1h2: ['1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab'],
  attack1hStab: ['1H_Melee_Attack_Stab'],
  attack2h: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'],
  attack2hSlice: ['2H_Melee_Attack_Slice'],
  attackSpin: ['2H_Melee_Attack_Spin', '2H_Melee_Attack_Spinning'],
  attackUnarmed: ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Kick'],
  attackDual: ['Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Chop'],
  attackJump: ['1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Chop'],
  shoot: ['1H_Ranged_Shoot', '2H_Ranged_Shoot', 'Throw'],
  aim: ['1H_Ranged_Aiming', '2H_Ranged_Aiming'],
  cast: ['Spellcast_Shoot', 'Spellcast_Raise'],
  castLong: ['Spellcast_Long', 'Spellcasting'],
  castRaise: ['Spellcast_Raise'],
  summon: ['Spellcast_Summon', 'Spellcast_Raise'],
  throw: ['Throw'],
  dodge: ['Dodge_Forward'],
  dodgeBack: ['Dodge_Backward'],
  dodgeL: ['Dodge_Left'],
  dodgeR: ['Dodge_Right'],
  block: ['Blocking', 'Block'],
  blockHit: ['Block_Hit'],
  hit: ['Hit_A', 'Hit_B'],
  hit2: ['Hit_B', 'Hit_A'],
  death: ['Death_A', 'Death_B'],
  death2: ['Death_B', 'Death_A'],
  deathSkeleton: ['Death_C_Skeletons', 'Death_A'],
  spawn: ['Spawn_Ground', 'Spawn_Air'],
  spawnSkeleton: ['Spawn_Ground_Skeletons', 'Skeletons_Awaken_Standing', 'Spawn_Ground'],
  taunt: ['Taunt', 'Cheer'],
  cheer: ['Cheer'],
  interact: ['Interact', 'Use_Item'],
  pickup: ['PickUp'],
  use: ['Use_Item'],
};

const WEAPON_PARTS = /(Sword|Axe|Shield|Wand|Staff|Crossbow|Knife|Throwable|Mug|Spellbook|Quiver)/i;

/** thin wrapper around one animated character instance */
export class CharacterRig {
  /** @param {THREE.Group} root @param {THREE.AnimationClip[]} clips @param {{height:number}} meta */
  constructor(id, root, clips, meta = {}) {
    this.id = id; this.root = root; this.height = meta.height ?? 1.8;
    this.mixer = new THREE.AnimationMixer(root);
    this.clips = new Map(clips.map((c) => [c.name, c]));
    this.actions = new Map();
    this.current = null; this.currentName = null;
    this.timeScale = 1;
    this.materials = [];
    this.#cacheMaterials();
    this.bones = new Map();
    root.traverse((o) => { if (o.isBone) this.bones.set(o.name, o); });
    this._flash = 0; this._flashColor = new THREE.Color('#ffffff'); this._base = new Map();
    this.mixer.addEventListener('finished', (e) => this.#onFinished(e));
    this._after = null;
  }

  #cacheMaterials() {
    const seen = new Set();
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; // skinned bounds are unreliable once animated
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = Array.isArray(o.material) ? mats.map((m) => this.#own(m)) : this.#own(o.material);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (!seen.has(m)) { seen.add(m); this.materials.push(m); }
    });
  }
  #own(m) { const c = m.clone(); c.userData.base = { color: c.color?.clone(), emissive: c.emissive?.clone(), emissiveIntensity: c.emissiveIntensity ?? 0 }; return c; }

  /** resolve a logical name (CLIPS key) or a literal clip name to an existing clip name */
  resolve(name) {
    if (this.clips.has(name)) return name;
    for (const n of CLIPS[name] ?? []) if (this.clips.has(n)) return n;
    return null;
  }
  has(name) { return this.resolve(name) !== null; }
  duration(name) { const n = this.resolve(name); return n ? this.clips.get(n).duration : 0; }

  action(name) {
    const n = this.resolve(name); if (!n) return null;
    let a = this.actions.get(n);
    if (!a) { a = this.mixer.clipAction(this.clips.get(n)); this.actions.set(n, a); }
    return a;
  }

  /** loop a clip (locomotion/idle). Re-asking for the clip that already plays only updates the speed. */
  play(name, { fade = 0.14, speed = 1, startAt = null } = {}) {
    const a = this.action(name); if (!a) return null;
    if (this.current === a) { a.timeScale = speed * this.timeScale; return a; }
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.enabled = true;
    a.timeScale = speed * this.timeScale; a.setEffectiveWeight(1);
    if (startAt !== null) a.time = startAt;
    if (this.current) this.current.crossFadeTo(a, fade, false);
    a.play();
    this.current = a; this.currentName = this.resolve(name); this._after = null;
    return a;
  }

  /**
   * play a clip once (attacks, hits, casts) and return to `then` (default: whatever looped before, else Idle).
   * `duration` rescales the clip so a 0.43 s attack in the sim looks like a 0.43 s swing.
   */
  once(name, { fade = 0.08, speed = 1, duration = null, then = null, clamp = false, from = 0 } = {}) {
    const a = this.action(name); if (!a) return null;
    const back = then ?? this.currentName ?? 'Idle';
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = clamp; a.enabled = true; a.setEffectiveWeight(1);
    const k = duration ? a.getClip().duration / duration : speed;
    a.timeScale = k * this.timeScale; a.time = from;
    if (this.current && this.current !== a) this.current.crossFadeTo(a, fade, false);
    a.play();
    this._after = clamp ? null : { prev: this.current, back };
    this.current = a; this.currentName = this.resolve(name);
    return a;
  }

  #onFinished(e) {
    if (e.action !== this.current || !this._after) return;
    const { back } = this._after; this._after = null;
    this.current = null; this.currentName = null;
    this.play(back, { fade: 0.12 });
  }

  /** attach an Object3D to a bone ('handslot.r' | 'handslot.l' | 'head' | 'chest' | 'spine' …); returns the object */
  attach(boneName, obj, { position = null, rotation = null, scale = 1 } = {}) {
    const bone = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(boneName)); if (!bone || !obj) { if (!bone) log.warn(`no bone ${boneName} on ${this.id}`); return null; } // the glTF loader strips '.' from node names
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (position) obj.position.set(...position);
    if (rotation) obj.rotation.set(...rotation);
    obj.scale.setScalar(scale);
    bone.add(obj);
    return obj;
  }

  /**
   * show exactly the built-in weapon/shield meshes named in `parts` (Adventurers ship every variant inside the file, parented
   * to handslot.r / handslot.l): rig.equip(['1H_Sword', 'Round_Shield']). Everything else that looks like a weapon is hidden.
   */
  equip(parts = []) {
    const want = new Set(parts);
    this.root.traverse((o) => { if (o.name && WEAPON_PARTS.test(o.name) && !/^(Knight|Barbarian|Mage|Rogue)_(Arm|Leg|Body|Head)/.test(o.name)) o.visible = want.has(o.name); });
    return this;
  }
  /** names of the built-in weapon parts (for tooling) */
  weaponParts() { const out = []; this.root.traverse((o) => { if (o.name && WEAPON_PARTS.test(o.name)) out.push(o.name); }); return out; }

  /** hide/show the built-in prop meshes that ship inside the character files (sword, shield, hat…) */
  setPartVisible(match, visible) { this.root.traverse((o) => { if (o.name && match.test(o.name)) o.visible = visible; }); }
  listParts() { const out = []; this.root.traverse((o) => { if (o.isMesh || (o.name && !o.isBone)) out.push(o.name); }); return out; }

  /** multiply the albedo (keeps the gradient atlas shading) and optionally add emissive */
  setTint(color, { emissive = null, emissiveIntensity = 0.6 } = {}) {
    const c = new THREE.Color(color);
    for (const m of this.materials) {
      const b = m.userData.base;
      m.color.copy(b.color).multiply(c);
      if (emissive) { m.emissive.set(emissive); m.emissiveIntensity = emissiveIntensity; } else { m.emissive?.copy(b.emissive); m.emissiveIntensity = b.emissiveIntensity; }
    }
  }
  /** brief white/colour flash on hit */
  flash(color = '#ffffff', seconds = 0.12) { this._flashColor.set(color); this._flash = seconds; this._flashMax = seconds; }

  update(dt) {
    this.mixer.update(dt);
    if (this._flash > 0) {
      this._flash -= dt;
      const k = Math.max(0, this._flash / this._flashMax);
      for (const m of this.materials) { m.emissive?.copy(this._flashColor); m.emissiveIntensity = (m.userData.base.emissiveIntensity ?? 0) + k * 1.6; }
      if (this._flash <= 0) for (const m of this.materials) { m.emissive?.copy(m.userData.base.emissive); m.emissiveIntensity = m.userData.base.emissiveIntensity; }
    }
  }

  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); for (const m of this.materials) m.dispose(); }
}

export class Assets {
  constructor(baseUrl = null) {
    this.base = baseUrl ?? new URL('assets/', typeof document !== 'undefined' ? document.baseURI : 'http://localhost/').href;
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.manifest = null; this.anims = []; this.ready = false; this.failed = new Set();
    this.templates = new Map(); this.baked = new Map();
  }

  async #json(path) { const r = await fetch(this.base + path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
  #gltf(path) { return new Promise((res, rej) => this.loader.load(this.base + path, res, undefined, rej)); }

  /**
   * preload manifest + shared animation library + the model ids asked for (default: every character).
   * @param {(p:{done:number,total:number,item:string})=>void} [onProgress]
   * @param {string[]} [preload] list of 'group/id'
   */
  async load(onProgress = null, preload = null) {
    try {
      this.manifest = await this.#json('manifest.json');
      const lib = await this.#gltf(this.manifest.models['anims/Rig_Medium'].file);
      this.anims = lib.animations;
      const list = preload ?? Object.keys(this.manifest.models).filter((k) => k.startsWith('chars/'));
      let done = 0; onProgress?.({ done, total: list.length, item: 'anims' });
      await Promise.all(list.map(async (k) => { await this.template(...k.split('/')); onProgress?.({ done: ++done, total: list.length, item: k }); }));
      this.ready = true;
    } catch (e) { log.error('asset load failed — falling back to procedural models', e); this.ready = false; }
    return this.ready;
  }

  has(group, id) { return !!this.manifest?.models?.[`${group}/${id}`] && !this.failed.has(`${group}/${id}`); }
  ids(group) { return Object.keys(this.manifest?.models ?? {}).filter((k) => k.startsWith(`${group}/`)).map((k) => k.slice(group.length + 1)); }
  info(group, id) { return this.manifest?.models?.[`${group}/${id}`] ?? null; }

  /** load (once) and return the glTF template for a model */
  async template(group, id) {
    const key = `${group}/${id}`;
    if (this.templates.has(key)) return this.templates.get(key);
    const entry = this.manifest?.models?.[key]; if (!entry) { this.failed.add(key); return null; }
    const p = this.#gltf(entry.file)
      .then((g) => { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); this.templates.set(key, g); return g; }) // swap the pending promise for the resolved glTF
      .catch((e) => { log.warn(`failed to load ${key}`, e); this.failed.add(key); this.templates.delete(key); return null; });
    this.templates.set(key, p);
    return p;
  }
  /** synchronous access once a template has been awaited */
  #ready(key) { const t = this.templates.get(key); return t && t.then ? null : t; }

  /** @returns {CharacterRig|null} */
  character(id, { tint = null, emissive = null, scale = 1, group = 'chars' } = {}) {
    const key = `${group}/${id}`;
    let t = this.templates.get(key);
    if (!t || typeof t.then === 'function') return null; // not resolved yet (preload it first)
    const root = SkeletonUtils.clone(t.scene);
    const wrap = new THREE.Group(); wrap.add(root); wrap.scale.setScalar(scale);
    const info = this.info(group, id);
    const rig = new CharacterRig(id, wrap, this.anims, { height: info ? (info.bbox.max[1] - info.bbox.min[1]) * scale : 1.8 * scale });
    rig.equip([]); // every built-in weapon variant is hidden until the caller picks one
    if (tint || emissive) rig.setTint(tint ?? '#ffffff', { emissive });
    rig.play('idle');
    return rig;
  }

  /** static prop clone (shares geometry + material with the template) or null if it is not loaded yet */
  prop(group, id) {
    const key = `${group}/${id}`;
    const t = this.templates.get(key);
    if (!t || typeof t.then === 'function') return null;
    return t.scene.clone(true);
  }
  async propAsync(group, id) { const t = await this.template(group, id); return t ? t.scene.clone(true) : null; }

  /** merge every mesh of a static model into one geometry + one material (for InstancedMesh). Cached. */
  async bakeAsync(group, id) {
    const key = `${group}/${id}`;
    if (this.baked.has(key)) return this.baked.get(key);
    const t = await this.template(group, id); if (!t) return null;
    t.scene.updateMatrixWorld(true);
    const geoms = []; let material = null;
    t.scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld); geoms.push(g); material ??= Array.isArray(o.material) ? o.material[0] : o.material;
    });
    if (!geoms.length) return null;
    const merged = mergeGeometries(geoms);
    const out = { geometry: merged, material };
    this.baked.set(key, out); return out;
  }
  bake(group, id) { return this.baked.get(`${group}/${id}`) ?? null; }
}

function mergeGeometries(list) {
  // same attribute layout across KayKit parts (position/normal/uv) — concatenate manually to avoid a utils import cycle
  const names = ['position', 'normal', 'uv'];
  const total = list.reduce((s, g) => s + g.attributes.position.count, 0);
  const idxTotal = list.reduce((s, g) => s + (g.index ? g.index.count : g.attributes.position.count), 0);
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const first = list[0].attributes[n]; if (!first) continue;
    const arr = new Float32Array(total * first.itemSize); let off = 0;
    for (const g of list) { const a = g.attributes[n]; for (let i = 0; i < a.count; i++) for (let k = 0; k < first.itemSize; k++) arr[(off + i) * first.itemSize + k] = a.getComponent(i, k); off += a.count; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, first.itemSize));
  }
  const idx = new Uint32Array(idxTotal); let vo = 0, io = 0;
  for (const g of list) { const n = g.attributes.position.count; if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < n; i++) idx[io++] = vo + i; vo += n; }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

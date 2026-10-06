import * as THREE from 'three';
import { fadeUniforms, disposeTree } from './kit.js';
import { buildDungeonMesh } from './dungeonMesh.js';
import { buildTerrainMesh } from './terrainMesh.js';
import { buildInstancedProps } from './props.js';
import { buildStructure, buildCanticle } from './structures.js';
import { buildSky, buildBackdrop } from './sky.js';
import { resolveQuality } from './quality.js';
import { PostFx } from './post.js';
import { installWorldFog, WorldFog, WORLD, resolveAtmosphere, PRESETS } from './atmosphere.js';
import { WorldAssets } from './worldAssets.js';
import { updateGlow } from './worldMaterials.js';
import { logger } from '../../core/logger.js';

const log = logger('scene3d');

const CB = { none: 0, protanopia: 1, deuteranopia: 2, tritanopia: 3 };

export class Scene3D {
  constructor(canvas, settings) {
    installWorldFog();
    this.canvas = canvas;
    this.settings = settings;
    this.q = resolveQuality(settings.quality, settings.renderScale);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.setClearColor('#b8c4cf');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens once, in the final post pass (see post.js)
    this.renderer.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.content = new THREE.Group(); this.content.name = 'content'; this.scene.add(this.content);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 900);
    this.updaters = [];
    this.emitters = [];
    this.lightPool = [];
    this.clock = 0;
    this.variant = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('tod') || 'dawn';
    this.sunDir = new THREE.Vector3(-0.6, 0.5, 0.3).normalize();
    this.baseSun = 3.3; this.baseHemi = 1;
    this.#setupLights();
    // kit art (KayKit CC0): starts downloading now so it is ready by the time the title screen is dismissed
    this.wa = new WorldAssets();
    this.worldReady = { done: false };
    this.wa.load().then(() => { if (this.zone?.props && this.content && !this.dungeonMesh) this.#buildWorldContent(true); }).catch((e) => log.warn('kit load failed', e));
    this.post = new PostFx(this.renderer, this.scene, this.camera);
    this.grade = { uniforms: this.post.u };
    this.applyQuality();
    this.resize();
  }

  /** optional: share the game's Assets instance (manifest/loader/cache) with the world builder */
  useAssets(assets) {
    if (!assets || this.wa.promise) return;
    this.wa = new WorldAssets(assets);
    this.wa.load().then(() => { if (this.zone?.props && !this.dungeonMesh) this.#buildWorldContent(true); });
  }

  #setupLights() {
    this.hemi = new THREE.HemisphereLight('#8fb0dd', '#6b5642', 1.05);
    this.sun = new THREE.DirectionalLight('#ffd094', 3.3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.035; this.sun.shadow.radius = 2.2;
    const sc = this.sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 190;
    this.rim = new THREE.DirectionalLight('#9fd8ff', 0.55); this.rim.castShadow = false;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.rim, this.rim.target);
    this.shadowExtent = 30;
  }

  /** apply a full atmosphere (lights, fog, sky, grade) — `variant` is a PRESETS key or a ready resolveAtmosphere() object */
  setAtmosphere(variant = this.variant, zoneAmbient = this.zone?.def?.ambient ?? null) {
    const a = typeof variant === 'string' ? resolveAtmosphere(variant, zoneAmbient) : variant;
    if (typeof variant === 'string') this.variant = variant;
    this.atm = a;
    this.hemi.color.copy(a.hemiSky); this.hemi.groundColor.copy(a.hemiGround); this.baseHemi = a.hemiIntensity; this.hemi.intensity = a.hemiIntensity;
    this.sun.color.copy(a.sun); this.baseSun = a.sunIntensity; this.sun.intensity = a.sunIntensity; this.sunDir = a.sunDir.clone();
    this.rim.color.copy(a.hemiSky).lerp(new THREE.Color('#9fe8ff'), 0.5);
    this.scene.fog = new WorldFog(a.fog, a.density, a.falloff);
    this.baseFog = { color: a.fog.clone(), density: a.density, falloff: a.falloff };
    this.scene.background = a.fog.clone();
    this.renderer.setClearColor(a.fog);
    this.sky?.userData.apply?.(a);
    const u = this.post.u, hc = this.settings.highContrast ? 1.16 : 1;
    u.uExposure.value = a.exposure; u.uSat.value = a.sat; u.uContrast.value = a.contrast * hc; u.uVig.value = a.vignette; u.uLift.value = a.lift;
    u.uShadowTint.value.copy(a.shadowTint); u.uHighTint.value.copy(a.highTint);
    this.post.bloom.strength = a.bloom[0]; this.post.bloom.radius = a.bloom[1]; this.post.bloom.threshold = a.bloom[2];
    WORLD.uCloud.value.set(0.16 + a.cloud * 0.5, 0.012, 0.007, 0.0075);
    WORLD.uSunTint.value.copy(a.sun);
    WORLD.uGlow.value = a.glow;
    return a;
  }

  applyQuality() {
    this.q = resolveQuality(this.settings.quality, this.settings.renderScale);
    const q = this.q;
    this.renderer.shadowMap.enabled = q.shadows > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sun.castShadow = q.shadows > 0;
    if (q.shadows > 0 && this.sun.shadow.mapSize.x !== q.shadows) { this.sun.shadow.mapSize.set(q.shadows, q.shadows); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.renderer.setPixelRatio(q.pixelRatio);
    this.post.configure({ samples: q.samples, bloom: q.bloom, ao: q.ao });
    this.post.setSize(this.size?.w ?? (this.canvas.clientWidth || 800), this.size?.h ?? (this.canvas.clientHeight || 600));
    this.camera.far = 900;
    this.camera.updateProjectionMatrix();
    this.post.u.uCB.value = CB[this.settings.colorblind ?? 'none'] ?? 0;
    this.post.u.uGrain.value = q.name === 'low' ? 0.1 : 0.35;
    if (this.atm) this.setAtmosphere(this.atm);
    this.#assignLights();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.size = { w, h };
  }

  /** remove everything the current zone/dungeon added (kit-cached geometry is shared and survives) */
  clearContent() {
    this.props?.field?.dispose();
    this.scene.remove(this.content); disposeTree(this.content);
    this.terrain?.userData?.dispose?.();
    this.content = new THREE.Group(); this.content.name = 'content'; this.scene.add(this.content);
    this.updaters = []; this.worldUpdaters = []; this.emitters = []; this.props = null; this.worldGroup = null; this.terrain = null; this.backdrop = null; this.canticle = null; this.dungeonMesh?.dispose?.(); this.dungeonMesh = null; this.windUniform = null; this.baseFog = null;
    this.sky = null;
    this.playerLight?.removeFromParent(); this.playerLight = null;
  }

  /** light the scene like a dungeon: dark cool ambient, dense fog, a torch that follows the player */
  loadDungeon(session, family) {
    this.clearContent();
    const lt = family.light, mult = session.dungeon.d.content.lightMult ?? 1;
    this.zone = { heightAt: () => 0, def: { ambient: {} } };
    const a = resolveAtmosphere('night');
    a.fog.set(lt.fog); a.density = lt.fogDensity * (mult < 1 ? 1.25 : 1); a.falloff = 0;
    a.hemiSky.set(lt.ambient); a.hemiGround.set('#10131a'); a.hemiIntensity = 1.2 * mult;
    a.sun.set('#8aa0c8'); a.sunIntensity = 0.55; a.sunDir.set(-0.4, 1, -0.3).normalize();
    a.exposure = 1.0; a.sat = 1.12; a.contrast = 1.12; a.vignette = 0.5; a.stars = 0; a.glow = 1.3; a.bloom = [0.55, 0.75, 1.0];
    this.setAtmosphere(a);
    this.sky = null;
    this.dungeonMesh = buildDungeonMesh(session.dungeon.d, family, { session, addEmitter: (o, l, f) => this.addEmitter(o, l, f) });
    this.content.add(this.dungeonMesh.root);
    this.playerLight = new THREE.PointLight(lt.torch, 9 * mult, 15, 1.6); this.scene.add(this.playerLight);
    this.#assignLights();
    return this.dungeonMesh;
  }

  /** register a point light that follows an object but only "really" lights while it is among the nearest N */
  addEmitter(obj, light, flicker = false) {
    if (light.parent) light.parent.remove(light);
    this.emitters.push({ light, obj, local: light.position.clone(), base: light.intensity, root: obj, flicker });
  }

  loadZone(zone) {
    this.clearContent();
    this.zone = zone;
    this.sky = buildSky(resolveAtmosphere(this.variant, zone.def.ambient));
    this.content.add(this.sky);
    this.setAtmosphere(this.variant, zone.def.ambient);
    this.backdrop = buildBackdrop(zone);
    this.content.add(this.backdrop);
    this.terrain = buildTerrainMesh(zone, { fine: this.q.fine, detail: this.q.detail });
    this.content.add(this.terrain);
    this.#buildWorldContent(false);
    // landmark
    for (const lm of zone.def.landmarks ?? []) {
      const c = buildCanticle();
      c.position.set(lm.pos[0], -4, lm.pos[1]);
      this.content.add(c);
      this.canticle = c;
      this.updaters.push((t) => c.userData.update(t));
    }
    this.updaters.push((t) => this.backdrop.userData.update(t));
    this.#assignLights();
  }

  /** props, vegetation and structures — rebuilt once when the kit finishes loading after the zone (procedural stand-ins before) */
  #buildWorldContent(rebuild) {
    const zone = this.zone; if (!zone?.props || !this.terrain) return;
    if (rebuild && this.worldGroup) {
      this.props?.field?.dispose(); this.worldGroup.removeFromParent(); disposeTree(this.worldGroup);
      this.emitters = this.emitters.filter((e) => e.owner !== 'world'); this.worldUpdaters = [];
      this.terrain.userData.resetAO?.();
    }
    const ctx = { wa: this.wa, q: this.q, terrain: this.terrain, zone, session: () => this.session };
    const root = new THREE.Group(); root.name = 'world';
    const inst = buildInstancedProps(zone, ctx);
    root.add(inst.group);
    this.props = inst;
    for (const u of inst.updaters) this.worldUpdaters.push(u);
    // authored structures
    this.structures = [];
    for (const p of zone.props) {
      if (!p.structure) continue;
      const obj = buildStructure(p.kind, { wa: this.wa, q: this.q, seed: `${p.x.toFixed(1)}:${p.z.toFixed(1)}`, prop: p, session: ctx.session });
      if (!obj) continue;
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.setScalar(p.scale);
      obj.userData.prop = p;
      root.add(obj);
      this.structures.push(obj);
      if (obj.userData.update) this.worldUpdaters.push((t, focus) => obj.userData.update(t, obj.userData.state, focus));
      const lights = [];
      obj.traverse((o) => { if (o.isPointLight) lights.push(o); });
      for (const o of lights) { const parent = o.parent; parent.remove(o); this.emitters.push({ light: o, obj: parent, local: o.position.clone(), base: o.intensity, root: obj, flicker: !!o.userData.flicker, owner: 'world' }); }
    }
    this.worldGroup = root; this.content.add(root);
    this.worldReady.done = !!(this.wa.ready || this.wa.failed);
  }

  #assignLights() {
    for (const l of this.lightPool) this.scene.remove(l);
    this.lightPool = [];
    for (let i = 0; i < this.q.lights; i++) { const l = new THREE.PointLight('#ffffff', 0, 12, 2); l.castShadow = false; this.scene.add(l); this.lightPool.push(l); }
  }

  /** nearest emitters take the limited pool of real lights (budgeted dynamic lighting) */
  #updateLights(focus) {
    if (!this.emitters.length) return;
    const list = this.emitters.map((e) => { e.root.updateWorldMatrix(true, false); const wp = e.local.clone().applyMatrix4(e.obj.matrixWorld); e.wp = wp; e.d = wp.distanceToSquared(focus); return e; }).sort((a, b) => a.d - b.d);
    this.lightPool.forEach((l, i) => {
      const e = list[i];
      if (!e || e.d > 55 * 55) { l.intensity += (0 - l.intensity) * 0.2; return; }
      l.position.copy(e.wp); l.color.copy(e.light.color); l.distance = e.light.distance;
      const fl = e.flicker ? 0.86 + 0.14 * Math.sin(this.clock * 11 + e.wp.x * 3) * Math.sin(this.clock * 7.3 + e.wp.z) : 1;
      l.intensity += (e.light.intensity * fl - l.intensity) * 0.25;
    });
  }

  /**
   * @param {{x:number,y:number,z:number}} focus
   */
  update(dt, t, focus, listenAmt = 0, hurt = 0, flash = 0) {
    this.clock = t;
    WORLD.uTime.value = t;
    fadeUniforms.uCam.value.copy(this.camera.position);
    fadeUniforms.uTarget.value.set(focus.x, focus.y + 1.0, focus.z);
    fadeUniforms.uFadeOn.value = this.settings.occlusionFade === false ? 0 : 1;
    for (const u of this.updaters) u(t);
    for (const u of this.worldUpdaters ?? []) u(t, focus);
    this.props?.update(focus.x, focus.z);
    updateGlow(WORLD.uGlow.value);
    // the sun follows the focus on a texel grid (no shadow shimmer); its frustum hugs what the camera can see
    const dist = this.camera.position.distanceTo(new THREE.Vector3(focus.x, focus.y, focus.z));
    const ext = Math.max(22, Math.min(44, dist * 0.92)) * this.q.shadowExtent;
    if (Math.abs(ext - this.shadowExtent) > 0.4) { const sc = this.sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); this.shadowExtent = ext; }
    const d = this.sunDir, tex = (this.shadowExtent * 2) / (this.q.shadows || 1024);
    const sx = Math.round(focus.x / tex) * tex, sz = Math.round(focus.z / tex) * tex;
    this.sun.target.position.set(sx, focus.y, sz);
    this.sun.position.set(sx + d.x * 80, focus.y + d.y * 80, sz + d.z * 80);
    this.rim.target.position.set(focus.x, focus.y, focus.z);
    this.rim.position.set(focus.x + 6, focus.y + 22, focus.z - 60);
    this.#updateLights(new THREE.Vector3(focus.x, focus.y, focus.z));
    if (this.playerLight) { this.playerLight.position.set(focus.x, focus.y + 2.6, focus.z); this.playerLight.intensity += ((9 + Math.sin(t * 9) * 0.5) * (this.dungeonMesh ? 1 : 0) - this.playerLight.intensity) * 0.2; }
    this.dungeonMesh?.update(t);
    const u = this.post.u;
    u.uListen.value += (listenAmt - u.uListen.value) * Math.min(1, dt * 6); u.uFlash.value = this.settings.reduceFlashes ? Math.min(flash, 0.12) : flash; u.uHurt.value = hurt;
  }

  render() { this.post.render(this.clock); }

  /** world → screen px */
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h, visible: v.z < 1 && v.z > -1 };
  }

  /** ray from screen px to the ground (iterative against the heightfield) */
  groundAt(px, py, hintY = 0) {
    const ndc = new THREE.Vector2((px / this.size.w) * 2 - 1, -(py / this.size.h) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    let y = hintY, p = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      const t = (y - ray.ray.origin.y) / ray.ray.direction.y;
      p.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t);
      y = this.zone.heightAt(p.x, p.z);
    }
    return { x: p.x, y, z: p.z };
  }
}

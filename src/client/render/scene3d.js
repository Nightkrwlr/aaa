import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { fadeUniforms, disposeTree } from './kit.js';
import { buildDungeonMesh } from './dungeonMesh.js';
import { buildTerrainMesh } from './terrainMesh.js';
import { buildInstancedProps } from './props.js';
import { buildStructure, buildCanticle } from './structures.js';
import { buildSky, buildBackdrop } from './sky.js';
import { resolveQuality } from './quality.js';

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uListen: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uSat: { value: 1.05 }, uContrast: { value: 1.04 }, uCB: { value: 0 }, uHurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uVig,uListen,uTime,uFlash,uSat,uContrast,uCB,uHurt;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - 0.5;
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      // listen: desaturate, cool tint, soft ripples
      vec3 cool = vec3(l * 0.85, l * 1.05, l * 1.25);
      c.rgb = mix(c.rgb, cool, uListen * 0.55);
      c.rgb *= 1.0 - uListen * 0.12 * (0.5 + 0.5 * sin(length(q) * 28.0 - uTime * 3.0));
      c.rgb = (c.rgb - 0.5) * uContrast + 0.5;
      float v = smoothstep(0.85, 0.2, length(q) * (1.0 + uVig));
      c.rgb *= mix(1.0 - uVig, 1.0, v);
      c.rgb += vec3(uFlash * 0.35);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.25, 0.7, 0.7), uHurt * smoothstep(0.2, 0.9, length(q) * 1.6));
      if (uCB > 0.5 && uCB < 1.5) { c.rgb = vec3(c.r * 0.567 + c.g * 0.433, c.r * 0.558 + c.g * 0.442, c.g * 0.242 + c.b * 0.758); }
      else if (uCB > 1.5 && uCB < 2.5) { c.rgb = vec3(c.r * 0.625 + c.g * 0.375, c.r * 0.7 + c.g * 0.3, c.g * 0.3 + c.b * 0.7); }
      else if (uCB > 2.5) { c.rgb = vec3(c.r * 0.95 + c.g * 0.05, c.g * 0.433 + c.b * 0.567, c.g * 0.475 + c.b * 0.525); }
      gl_FragColor = c; }`,
};

export class Scene3D {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.q = resolveQuality(settings.quality, settings.renderScale);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.setClearColor('#b8c4cf');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.content = new THREE.Group(); this.content.name = 'content'; this.scene.add(this.content);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 700);
    this.updaters = [];
    this.emitters = [];
    this.lightPool = [];
    this.clock = 0;
    this.#setupLights();
    this.#setupComposer();
    this.applyQuality();
    this.resize();
  }

  #setupLights() {
    this.hemi = new THREE.HemisphereLight('#d8e8ff', '#8a7a62', 1.55);
    this.sun = new THREE.DirectionalLight('#ffd9a0', 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    const sc = this.sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 160;
    this.scene.add(this.hemi, this.sun, this.sun.target);
  }

  #setupComposer() {
    const size = new THREE.Vector2(this.canvas.clientWidth || 800, this.canvas.clientHeight || 600);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(size, 0.38, 0.65, 0.86);
    this.grade = new ShaderPass(GRADE);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
  }

  applyQuality() {
    this.q = resolveQuality(this.settings.quality, this.settings.renderScale);
    const q = this.q;
    this.renderer.shadowMap.enabled = q.shadows > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sun.castShadow = q.shadows > 0;
    if (q.shadows > 0) { this.sun.shadow.mapSize.set(q.shadows, q.shadows); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.bloom.enabled = q.bloom;
    this.renderer.setPixelRatio(q.pixelRatio);
    this.composer.setPixelRatio(q.pixelRatio);
    this.camera.far = Math.max(400, q.drawDist * 4);
    this.camera.updateProjectionMatrix();
    this.grade.uniforms.uCB.value = { none: 0, protanopia: 1, deuteranopia: 2, tritanopia: 3 }[this.settings.colorblind ?? 'none'];
    this.grade.uniforms.uContrast.value = this.settings.highContrast ? 1.22 : 1.04;
    this.#assignLights();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.size = { w, h };
  }

  /** remove everything the current zone/dungeon added (kit-cached geometry is shared and survives) */
  clearContent() {
    this.scene.remove(this.content); disposeTree(this.content);
    this.content = new THREE.Group(); this.content.name = 'content'; this.scene.add(this.content);
    this.updaters = []; this.emitters = []; this.terrain = null; this.backdrop = null; this.canticle = null; this.dungeonMesh?.dispose?.(); this.dungeonMesh = null; this.windUniform = null; this.baseFog = null;
    this.playerLight?.removeFromParent(); this.playerLight = null;
  }

  /** light the scene like a dungeon: dark cool ambient, dense fog, a torch that follows the player */
  loadDungeon(session, family) {
    this.clearContent();
    const lt = family.light, mult = session.dungeon.d.content.lightMult ?? 1;
    this.zone = { heightAt: () => 0, def: { ambient: {} } };
    this.scene.background = new THREE.Color(lt.fog); this.scene.fog = new THREE.FogExp2(lt.fog, lt.fogDensity * (mult < 1 ? 1.25 : 1));
    this.renderer.setClearColor(lt.fog);
    this.hemi.color.set(lt.ambient); this.hemi.groundColor.set('#10131a'); this.baseHemi = 1.2 * mult; this.hemi.intensity = this.baseHemi;
    this.sun.color.set('#8aa0c8'); this.sunDir = new THREE.Vector3(-0.4, 1, -0.3).normalize(); this.baseSun = 0.55; this.sun.intensity = this.baseSun;
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
    this.baseHemi = 1.55; this.baseSun = 3.2; this.hemi.intensity = 1.55; this.sun.intensity = 3.2;
    this.zone = zone;
    const amb = zone.def.ambient;
    this.scene.background = new THREE.Color(amb.sky[1]);
    this.scene.fog = new THREE.FogExp2(amb.fog, amb.fogDensity);
    this.renderer.setClearColor(amb.fog);
    this.hemi.color.set(amb.hemi[0]); this.hemi.groundColor.set(amb.hemi[1]);
    this.sun.color.set(amb.sun);
    this.sunDir = new THREE.Vector3(...amb.sunDir).normalize();
    this.content.add(buildSky(amb));
    this.backdrop = buildBackdrop(zone);
    this.content.add(this.backdrop);
    this.terrain = buildTerrainMesh(zone, this.q.pixelRatio > 1.3 ? 2 : 2);
    this.content.add(this.terrain);
    const inst = buildInstancedProps(zone, this.q);
    this.content.add(inst.group);
    this.baseFog = { color: new THREE.Color(amb.fog), density: amb.fogDensity };
    this.windUniform = inst.windUniform;
    // structures
    this.structures = [];
    for (const p of zone.props) {
      if (!p.structure) continue;
      const obj = buildStructure(p.kind);
      if (!obj) continue;
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.rot;
      obj.scale.setScalar(p.scale);
      obj.userData.prop = p;
      this.content.add(obj);
      this.structures.push(obj);
      if (obj.userData.update) this.updaters.push((t) => obj.userData.update(t, obj.userData.state));
      const lights = [];
      obj.traverse((o) => { if (o.isPointLight) lights.push(o); });
      for (const o of lights) { const parent = o.parent; parent.remove(o); this.emitters.push({ light: o, obj: parent, local: o.position.clone(), base: o.intensity, root: obj, flicker: false }); }
    }
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
    fadeUniforms.uCam.value.copy(this.camera.position);
    fadeUniforms.uTarget.value.set(focus.x, focus.y + 1.0, focus.z);
    fadeUniforms.uFadeOn.value = this.settings.occlusionFade === false ? 0 : 1;
    for (const u of this.updaters) u(t);
    if (this.windUniform) this.windUniform.value = t;
    // sun follows focus, snapped to shadow texels
    const d = this.sunDir, tex = 84 / (this.q.shadows || 1024);
    const sx = Math.round(focus.x / tex) * tex, sz = Math.round(focus.z / tex) * tex;
    this.sun.target.position.set(sx, focus.y, sz);
    this.sun.position.set(sx + d.x * 70, focus.y + d.y * 70, sz + d.z * 70);
    this.#updateLights(new THREE.Vector3(focus.x, focus.y, focus.z));
    if (this.playerLight) { this.playerLight.position.set(focus.x, focus.y + 2.6, focus.z); this.playerLight.intensity += ((9 + Math.sin(t * 9) * 0.5) * (this.dungeonMesh ? 1 : 0) - this.playerLight.intensity) * 0.2; }
    this.dungeonMesh?.update(t);
    const u = this.grade.uniforms;
    u.uTime.value = t; u.uListen.value += (listenAmt - u.uListen.value) * Math.min(1, dt * 6); u.uFlash.value = this.settings.reduceFlashes ? Math.min(flash, 0.12) : flash; u.uHurt.value = hurt;
  }

  render() { this.composer.render(); }

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

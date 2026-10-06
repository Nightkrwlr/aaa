import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { i18n, t } from '../core/i18n.js';
import { logger, setLogLevel } from '../core/logger.js';
import { World } from '../sim/world.js';
import { buildZone } from '../sim/world/zone.js';
import { populateZone } from '../sim/world/populate.js';
import { createPlayerEntity } from '../sim/player.js';
import { Scene3D } from './render/scene3d.js';
import { CameraRig } from './render/cameraRig.js';
import { Vfx } from './render/vfx.js';
import { EntityViews } from './render/entityViews.js';
import { Input } from './input/input.js';
import { Overlay } from './ui/overlay.js';
import { Hud } from './ui/hud.js';
import { loadSettings, saveSettings } from './settings.js';

const log = logger('game');

export class Game {
  constructor(registry, dom) {
    this.registry = registry;
    this.dom = dom;
    this.settings = loadSettings();
    i18n.setLang(this.settings.language);
    document.documentElement.style.setProperty('--ui-scale', this.settings.uiScale);
    document.documentElement.style.setProperty('--text-scale', this.settings.textScale);
    document.documentElement.style.setProperty('--hud-scale', this.settings.hudScale);
    this.fps = 60; this.time = 0; this.frames = 0;
    this.running = false;
    this.modal = null;
  }

  /** build the playable world */
  start({ classId = 'cls.belfry', seed = 'sunderchoir-1', level = 1 } = {}) {
    const reg = this.registry;
    this.zone = buildZone(reg, 'zone.calvarre_lower');
    this.world = new World({ registry: reg, nav: this.zone.nav, seed, areaLevel: level, difficulty: this.settings.difficulty });
    this.world.zone = this.zone;
    const cls = reg.require(classId, 'class');
    this.character = { classId, level, xp: 0 };
    const p = createPlayerEntity(this.world, cls, level, this.zone.spawnPoint.x, this.zone.spawnPoint.z);
    this.world.addPlayer(p);
    this.player = p;
    this.#applyUnlocks();
    this.groups = populateZone(this.world, this.zone, { seed });

    this.scene3d = new Scene3D(this.dom.gl, this.settings);
    this.rig = new CameraRig(this.scene3d.camera);
    this.rig.setZoom(this.settings.cameraZoom);
    this.rig.shakeScale = this.settings.screenShake;
    this.scene3d.loadZone(this.zone);
    this.vfx = new Vfx(this.scene3d.scene, this.scene3d.camera, this.rig, this.scene3d.q, this.settings);
    this.vfx.bind(this.world, this.zone);
    this.views = new EntityViews(this.scene3d.scene, reg, this.zone, this.vfx);
    this.overlay = new Overlay(this.dom.overlay);
    this.hud = new Hud(this.dom.ui, this);
    this.input = new Input(this.dom.gl, this.settings, {
      onAction: (a, down, e) => this.#onAction(a, down, e),
      onMouse: (b, down) => this.#onMouse(b, down),
      onWheel: (dy) => this.rig.wheel(dy),
    });
    window.addEventListener('resize', () => this.#resize());
    this.#resize();
    this.world.events.on('entity:died', (i) => { if (i.entity.team === 'enemy' && i.killer === this.player) this.#onKill(i.entity); });
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((n) => this.#frame(n));
    return this;
  }

  #applyUnlocks() {
    const cls = this.player.cls;
    const slots = ['s1', 's2', 's3', 's4', 's5', 's6'];
    const unlocked = cls.unlocks.filter((u) => u.level <= this.character.level).map((u) => u.ability);
    const loadout = { primary: cls.loadout.primary, dodge: cls.loadout.dodge };
    unlocked.slice(0, 6).forEach((id, i) => { loadout[slots[i]] = id; });
    this.player.loadout = loadout;
  }

  #onKill(e) {
    // minimal XP for now; Character system takes over in the progression stage
  }

  #resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.scene3d.resize();
    this.overlay.resize(w, h);
    this.vfx.particles.setViewport(h * this.scene3d.q.pixelRatio, this.scene3d.camera.fov);
  }

  castSlot(slot) { this.world.controller.castSlot(this.player, slot); }

  #onAction(a, down) {
    const p = this.player, w = this.world;
    if (!p || p.dead) return;
    const slotMap = this.input.skillSlots;
    if (a in slotMap) { if (down) w.controller.castSlot(p, slotMap[a]); if (slotMap[a] === 's1' || true) p.cmd.channel = down ? true : p.cmd.channel; if (!down) p.cmd.channel = false; return; }
    if (a === 'dodge' && down) w.controller.castSlot(p, 'dodge');
    if (a === 'listen') p.cmd.listen = down;
    if (a === 'voice' && down) w.controller.castSlot(p, 'voice');
  }

  #onMouse(button, down) {
    const p = this.player, c = p?.cmd; if (!c || p.dead) return;
    if (button === 0) {
      this.leftHeld = down;
      if (!down) { c.holdPrimary = false; if (this.leftMode === 'attack') c.attackTarget = c.attackTarget; return; }
      const hover = this.hoverEnemy;
      if (this.input.keys.has('ShiftLeft')) { this.leftMode = 'stand'; c.holdPrimary = true; c.attackTarget = null; c.moveTo = null; }
      else if (hover) { this.leftMode = 'attack'; c.attackTarget = hover.uid; c.moveTo = null; }
      else { this.leftMode = 'move'; c.attackTarget = null; c.moveTo = { x: this.input.hoverGround.x, z: this.input.hoverGround.z }; }
    }
  }

  // ───────────────────────── frame
  #frame(now) {
    if (!this.running) return;
    const raw = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    this.fps += (1 / Math.max(raw, 1e-4) - this.fps) * 0.05;
    this.time += raw;
    this.#update(raw);
    this.scene3d.render();
    this.#drawOverlay();
    requestAnimationFrame((n) => this.#frame(n));
    this.frames++;
  }

  #update(dt) {
    const w = this.world, p = this.player, input = this.input;
    input.pollPad();
    // hit-stop: slow simulation briefly
    const simDt = this.vfx.hitstop > 0 ? dt * 0.06 : dt;
    // pointer → ground + hover
    const m = input.mouse;
    if (!this.modal) {
      const g = this.scene3d.groundAt(m.x, m.y, p.y ?? 0);
      input.hoverGround = g;
      this.hoverEnemy = this.views.pick(w, this.scene3d.camera, this.scene3d.size, m.x, m.y, (e) => e.team === 'enemy' && !e.untargetable);
      this.#feedCommands(dt, g);
    }
    w.update(simDt);
    this.views.update(w, dt, this.time, this.hoverEnemy?.uid);
    this.vfx.update(dt, this.time, w, this.views);
    const dir = p.cmd.moveDir ?? (p.intent ? { x: p.intent.x, z: p.intent.z } : { x: 0, z: 0 });
    this.rig.update(dt, { x: p.x, y: p.y, z: p.z }, dir, this.time);
    this.scene3d.update(dt, this.time, { x: p.x, y: p.y, z: p.z }, p.listen?.active ? 1 : 0, p.hp / p.hpMax < 0.3 ? 1 - p.hp / p.hpMax : 0, this.vfx.flash);
    this.hud.update(w, p, dt);
    this.vfx.particles.density = this.scene3d.q.particles;
  }

  #feedCommands(dt, ground) {
    const p = this.player, c = p.cmd, inp = this.input, w = this.world;
    if (p.dead) return;
    c.aim = { x: ground.x, z: ground.z };
    // direct movement: WASD / stick / touch (camera relative)
    const f = this.rig.forwardDir(), r = this.rig.rightDir();
    let ix = 0, iz = 0;
    if (inp.isDown('moveUp')) iz += 1; if (inp.isDown('moveDown')) iz -= 1;
    if (inp.isDown('moveRight')) ix += 1; if (inp.isDown('moveLeft')) ix -= 1;
    if (inp.pad.active) { ix += inp.pad.ax; iz -= inp.pad.az; }
    if (inp.touch.stickId !== null) { ix += inp.touch.dx; iz -= inp.touch.dz; }
    if (ix || iz) {
      const l = Math.hypot(ix, iz);
      const k = Math.min(1, l) / l;
      c.moveDir = { x: (f.x * iz + r.x * ix) * k, z: (f.z * iz + r.z * ix) * k };
    } else c.moveDir = null;
    // gamepad aim
    if (inp.pad.active && (inp.pad.bx || inp.pad.bz)) { const bx = inp.pad.bx, bz = -inp.pad.bz; c.aim = { x: p.x + (f.x * bz + r.x * bx) * 8, z: p.z + (f.z * bz + r.z * bx) * 8 }; }
    else if (inp.pad.active && c.moveDir && !inp.mouse.down[0]) c.aim = { x: p.x + c.moveDir.x * 6, z: p.z + c.moveDir.z * 6 };
    // WASD scheme: the primary attack follows the cursor while LMB held
    if (this.leftHeld && this.leftMode === 'move' && !this.hoverEnemy) c.moveTo = { x: ground.x, z: ground.z };
    if (this.leftHeld && this.leftMode === 'attack' && this.hoverEnemy) c.attackTarget = this.hoverEnemy.uid;
    if (inp.pad.primary) c.holdPrimary = true; else if (!this.leftHeld || this.leftMode !== 'stand') c.holdPrimary = this.leftMode === 'stand' && this.leftHeld;
    if (this.settings.scheme === 'wasd') { c.holdPrimary = this.leftHeld || !!inp.pad.primary; if (this.leftHeld) { c.attackTarget = null; c.moveTo = null; } }
    // aim assist for gamepad/touch
    if ((inp.pad.active || inp.touchMode) && this.settings.aimAssist > 0) {
      const near = w.nearestHostile(p, 9, (e) => !e.untargetable);
      if (near && Math.hypot(near.x - c.aim.x, near.z - c.aim.z) < 5 * this.settings.aimAssist + 2) c.aim = { x: near.x, z: near.z };
    }
  }

  #drawOverlay() {
    const o = this.overlay, w = this.world, cam = this.scene3d;
    o.begin();
    if (this.settings.damageNumbers) for (const n of this.vfx.numbers) {
      const s = cam.project(n.x, n.y, n.z); if (!s.visible) continue;
      const k = n.t / n.life;
      const pop = n.crit ? 1 + Math.max(0, 0.5 - n.t * 2.2) : 1;
      o.text(s.x, s.y, n.text, { size: 17 * n.scale * pop, color: n.color, alpha: Math.min(1, (1 - k) * 2.2) });
    }
    // enemy health bars (hurt, hovered, or elite+)
    for (const e of w.entities) {
      if (e.dead || e.team !== 'enemy' || e.hidden && e.untargetable) continue;
      const hovered = this.hoverEnemy === e;
      const hurt = e.hp < e.hpMax;
      const big = e.tier === 'elite' || e.tier === 'miniboss';
      if (!(hovered || (hurt && w.time - e.lastHurtTime < 6) || big)) continue;
      if (e.tier === 'boss') continue;
      const s = cam.project(e.x, e.y + (e.height ?? 1.5) + 0.35, e.z); if (!s.visible) continue;
      const wBar = e.tier === 'elite' || e.tier === 'miniboss' ? 78 : 52;
      o.bar(s.x, s.y, wBar, e.tier === 'elite' ? 7 : 5, e.hp / e.hpMax, { fill: e.tier === 'elite' ? '#ffcf5a' : e.tier === 'miniboss' ? '#ff8a3a' : '#d9473a', shield: e.shield ? e.shield / e.hpMax : 0 });
      if (hovered || big) o.text(s.x, s.y - 11, t(`${e.id}.name`), { size: 12, color: big ? '#ffcf5a' : '#f2e7cf' });
    }
  }

  get dev() { return typeof __DEV_TOOLS__ !== 'undefined' && __DEV_TOOLS__; }
}

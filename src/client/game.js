import * as THREE from 'three';
import { i18n, t } from '../core/i18n.js';
import { logger } from '../core/logger.js';
import { statDefsFrom } from '../sim/stats.js';
import { GameSession } from '../sim/session.js';
import { SaveManager, LocalStorageAdapter, AutoSaver } from '../sim/save.js';
import { Scene3D } from './render/scene3d.js';
import { CameraRig } from './render/cameraRig.js';
import { Vfx } from './render/vfx.js';
import { EntityViews } from './render/entityViews.js';
import { Assets } from './render/assets.js';
import { setModelAssets } from './render/models.js';
import { dependenciesOf } from './render/charFactory.js';
import { InteractViews } from './render/interactViews.js';
import { LootViews } from './render/lootViews.js';
import { GateCurtain, WeatherFx } from './render/worldFx.js';
import { Input } from './input/input.js';
import { Overlay } from './ui/overlay.js';
import { Hud } from './ui/hud.js';
import { UIManager } from './ui/uiManager.js';
import { registerPanels } from './ui/panels/index.js';
import { AudioEngine } from './audio.js';
import { itemName, RARITY_COLOR, setRarityPalette } from './ui/itemText.js';
import { setFxPalette } from './render/groundFx.js';
import { loadSettings, saveSettings } from './settings.js';

const log = logger('game');
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

/**
 * Game — the browser shell around a GameSession: rendering, input, HUD/UI, audio, saves.
 * The session owns all rules; this class translates frames/events/devices into session calls and back into visuals.
 */
export class Game {
  constructor(registry, dom) {
    this.registry = registry; this.dom = dom;
    this.settings = loadSettings();
    // real art (KayKit glTF): one Assets instance for the whole client, preloaded at boot with progress for the title screen
    this.assets = new Assets();
    this.assetState = { ready: false, failed: false, done: 0, total: 0, item: '' };
    this.assetListeners = new Set();
    this.assetsReady = null;
    this.statDefs = statDefsFrom(registry);
    this.saves = new SaveManager(new LocalStorageAdapter(), { build: BUILD });
    this.session = null; this.autosaver = null;
    this.fps = 60; this.time = 0; this.frames = 0; this.running = false;
    this.barGhost = new Map(); this.dtDraw = 1 / 60;   // enemy health bars: the lost chunk lingers a moment (see #drawOverlay)
    this.state = 'menu'; // menu | playing
    this.leftMode = 'move'; this.pendingInteract = null; this.pendingPickup = null;
    this.hoverEnemy = null; this.hoverIA = null; this.hoverLoot = null; this.fade = 0; this.fadeTarget = 0; this.rebuilding = false;
    this.applySettings(true);
  }

  // ───────────────────────── boot & lifecycle
  boot() {
    const d = this.dom;
    this.#loadAssets();
    this.scene3d = new Scene3D(d.gl, this.settings);
    this.rig = new CameraRig(this.scene3d.camera);
    this.rig.setZoom(this.settings.cameraZoom); this.rig.shakeScale = this.settings.screenShake;
    this.vfx = new Vfx(this.scene3d.scene, this.scene3d.camera, this.rig, this.scene3d.q, this.settings);
    this.weatherFx = new WeatherFx(this.scene3d, this.vfx.particles);
    this.overlay = new Overlay(d.overlay);
    this.audio = new AudioEngine(this.settings);
    this.ui = new UIManager(this, d.ui);
    registerPanels(this.ui);
    this.hud = new Hud(d.ui, this);
    this.fadeEl = document.createElement('div'); this.fadeEl.id = 'fade'; d.ui.append(this.fadeEl);
    this.input = new Input(d.gl, this.settings, {
      onAction: (a, down, e) => this.#onAction(a, down, e),
      onMouse: (b, down) => this.#onMouse(b, down),
      onWheel: (dy) => { if (!this.ui.blocking) this.rig.wheel(dy); },
    });
    window.addEventListener('resize', () => this.#resize());
    window.addEventListener('beforeunload', () => { try { this.autosaver?.request('exit', true); } catch { /* ignore */ } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.session && !this.session.dead) this.autosaver?.request('hidden', true); });
    this.#resize();
    this.running = true; this.last = performance.now();
    this.ui.open('title');
    requestAnimationFrame((n) => this.#frame(n));
    return this;
  }

  canvasFocus() { this.dom.gl.focus?.({ preventScroll: true }); }

  /**
   * Preload the glTF art (characters + the props their specs reference) and tell the title screen how far along it is.
   * If anything fails the game keeps running with the procedural models (EntityViews upgrades views when the art arrives).
   * `game.assetsReady` is a promise (e2e tools await it).
   */
  #loadAssets() {
    const st = this.assetState;
    setModelAssets(this.assets);
    const keys = dependenciesOf(this.registry.all('model'));
    const emit = () => { for (const f of this.assetListeners) { try { f(st); } catch { /* UI listener must never break loading */ } } };
    st.total = keys.length; emit();
    this.assetsReady = this.assets.load((p) => { st.done = p.done; st.total = p.total || st.total; st.item = p.item; emit(); }, keys)
      .then((ok) => { st.ready = !!ok; st.failed = !ok; if (!ok) log.warn('art failed to load: using procedural models'); emit(); return !!ok; })
      .catch((err) => { st.failed = true; log.error('art loading crashed: using procedural models', err); emit(); return false; });
  }
  /** subscribe to asset-loading progress (called immediately with the current state); returns an unsubscribe fn */
  onAssets(fn) { this.assetListeners.add(fn); try { fn(this.assetState); } catch { /* ignore */ } return () => this.assetListeners.delete(fn); }

  /** start a fresh playthrough */
  newGame({ classId = 'cls.belfry', name = 'Reposo', seed = `sc-${Date.now().toString(36)}`, difficulty = this.settings.difficulty } = {}) {
    this.settings.difficulty = difficulty; saveSettings(this.settings);
    const s = new GameSession({ registry: this.registry, seed, classId, name, settings: this.sessionSettings() });
    s.start();
    this.#attach(s);
  }

  continueGame(slot = 'auto') {
    const r = this.saves.load(slot, this.registry, { settings: this.sessionSettings() });
    if (!r.ok) return r;
    this.#attach(r.session);
    if (r.recovered) this.toast(t('toast.save_recovered'));
    return r;
  }

  sessionSettings() { const s = this.settings; return { difficulty: s.difficulty, lootFilter: { mode: s.lootFilter ?? 'normal', ...(s.lootFilterCustom ?? {}) }, autoPickupMaterials: s.autoPickupMaterials, puzzleHints: s.puzzleHints, telemetry: s.telemetry }; }

  quitToTitle() {
    if (this.session && !this.session.dead) this.autosaver?.request('quit', true);
    this.#detach(); this.ui.closeAll(); this.state = 'menu'; this.ui.open('title');
  }

  #detach() {
    this.views?.dispose?.(); this.interact?.dispose(); this.loot?.dispose(); this.session?.events.clear();
    this.scene3d.clearContent(); this.session = null; this.autosaver = null; this.views = this.interact = this.loot = this.gate = null;
    this.hud.reset?.();
  }

  #attach(session) {
    this.#detach();
    this.session = session; this.state = 'playing';
    this.ui.closeAll();
    this.autosaver = new AutoSaver(session, this.saves, { slot: 'auto' });
    this.#bindSession(session);
    this.#buildContext();
    this.audio.resume();
    this.canvasFocus();
    this.hud.setSession?.(session);
  }

  get character() { return this.session?.character; }
  get zone() { return this.session?.zone; }
  get world() { return this.session?.world; }
  get player() { return this.session?.player; }

  // ───────────────────────── session → UI/audio wiring
  #bindSession(s) {
    const ev = s.events;
    ev.on('toast', (i) => this.toast(this.toastText(i), i.item));
    ev.on('subtitle', (i) => this.hud.subtitle(i.speaker ? `${t(`${i.speaker}.name`)}: ${t(i.key)}` : t(i.key)));
    ev.on('ui:open', (i) => this.#openFromSession(i));
    ev.on('music', (i) => this.audio.music(i.state));
    ev.on('area', (i) => { this.hud.areaName(t(`${i.area}.name`)); });
    ev.on('quest:started', (i) => { this.hud.pulseTracker?.(); this.audio.ui('quest'); });
    ev.on('quest:stage', () => { this.hud.pulseTracker?.(); this.audio.ui('quest'); });
    ev.on('quest:done', () => this.audio.ui('questDone'));
    ev.on('level:up', (i) => { this.toast(t('toast.level_up', { level: i.level })); this.audio.ui('level'); this.vfx.flash = Math.max(this.vfx.flash, 0.35); });
    ev.on('voice:captured', (i) => { this.toast(t('toast.voice_new', { name: t(`${this.registry.get(i.voice)?.ability}.name`) })); this.audio.ui('voice'); });
    ev.on('secret:found', () => this.audio.ui('secret'));
    ev.on('player:died', (i) => { this.audio.ui('death'); this.ui.closeAll(); this.ui.open('death', i); });
    ev.on('player:respawn', () => { this.rig.initialised = false; });
    ev.on('dungeon:enter', () => this.#queueRebuild());
    ev.on('dungeon:leave', () => this.#queueRebuild());
    ev.on('fasttravel', () => { this.rig.initialised = false; this.audio.ui('travel'); });
    ev.on('gate:open', () => this.audio.ui('gate'));
    ev.on('puzzle:strike', (i) => this.audio.puzzle(i.index, i.correct));
    ev.on('puzzle', () => this.audio.ui('secret'));
    ev.on('loot:picked', () => this.audio.ui('pickup'));
    ev.on('loot:chimes', () => this.audio.ui('coin'));
    ev.on('boss:start', (i) => { this.audio.music('boss'); });
    ev.on('boss', () => { this.audio.music('explore'); });
    ev.on('weather', (i) => this.audio.weather(i.type));
    ev.on('door:open', () => this.audio.ui('door'));
    ev.on('event:start', () => this.audio.ui('event'));
    ev.on('shop:buy', () => this.audio.ui('coin'));
    ev.on('gate:barrier', () => {});
    ev.on('dungeon:objective_done', () => { this.toast(t('toast.objective_done')); this.audio.ui('questDone'); });
    ev.on('dungeon:collapse', (i) => this.toast(t('toast.collapse', { seconds: i.seconds })));
    ev.on('director:breather', () => {});
    ev.on('puzzle:hint', (i) => { if (i.hint?.type === 'text') this.toast(t(i.hint.key)); else if (i.hint) this.toast(t('toast.hint_nudge')); });
  }

  toastText(i) {
    const p = { ...(i.params ?? {}) };
    for (const [k, v] of Object.entries(p)) if (typeof v === 'string' && /^[a-z]+\./.test(v) && i18n.has(`${v}.name`)) p[k] = t(`${v}.name`);
    return t(i.key, p);
  }
  toast(text, item) { this.hud.toast(text, item); }

  #openFromSession(i) {
    this.audio.ui('open');
    switch (i.panel) {
      case 'dialogue': this.ui.open('dialogue', i); break;
      case 'shop': this.ui.open('shop', i); break;
      case 'craft': this.ui.open('craft', i); break;
      case 'respec': this.ui.open('talents', { respec: true }); break;
      case 'waypoints': this.ui.open('map', { mode: 'travel', at: i.at }); break;
      case 'chart': this.ui.open('rift', i); break;
      default: this.ui.open(i.panel, i);
    }
  }

  // ───────────────────────── context (overworld / dungeon) scene building
  #queueRebuild() { this.rebuilding = true; this.fadeTarget = 1; }

  #buildContext() {
    const s = this.session, reg = this.registry;
    this.views?.dispose?.(); this.interact?.dispose(); this.loot?.dispose();
    let zoneLike;
    if (s.mode === 'dungeon') {
      const fam = reg.require(s.dungeon.d.family, 'dungeonFamily');
      this.scene3d.loadDungeon(s, fam);
      zoneLike = { heightAt: () => 0 };
      s.dungeon.world.events.on('door:open', (i) => { /* world-level events not used */ });
      s.events.on('door:open', () => {});
      this.gate = null;
      this.dungeonViewDoors = () => { const rt = s.dungeon, dm = this.scene3d.dungeonMesh; if (!rt || !dm || s.mode !== 'dungeon') return; for (const d of rt.doors) { const v = dm.doorViews.get(d.id); if (v && d.open && !v.open) dm.openDoor(d); } };
    } else {
      this.scene3d.loadZone(s.zone);
      zoneLike = s.zone;
      this.gate = new GateCurtain(this.scene3d, s.zone, s);
      this.dungeonViewDoors = null;
    }
    this.vfx.reset?.();
    this.vfx.bind(s.world, zoneLike);
    this.audio.bind(s.world, s.player);
    this.views = new EntityViews(this.scene3d.content, reg, zoneLike, this.vfx, this.assets, this.scene3d.camera);
    this.views.bindSession(s);
    this.interact = new InteractViews(this.scene3d, s, (x, z) => zoneLike.heightAt(x, z), reg);
    this.loot = new LootViews(this.scene3d, s, (x, z) => zoneLike.heightAt(x, z));
    this.rig.initialised = false;
    this.hud.setSession?.(s);
    this.scene3d.baseFog && (this.weatherFx.k = 1);
    this.#resize();
  }

  // ───────────────────────── settings
  applySettings(initial = false) {
    const st = this.settings, root = document.documentElement.style;
    i18n.setLang(st.language);
    root.setProperty('--ui-scale', st.uiScale); root.setProperty('--text-scale', st.textScale); root.setProperty('--hud-scale', st.hudScale);
    document.documentElement.classList.toggle('hc', !!st.highContrast);
    document.documentElement.classList.toggle('reduce-motion', !!st.reduceFlashes);
    for (const m of ['protanopia', 'deuteranopia', 'tritanopia']) document.documentElement.classList.toggle(`cb-${m}`, st.colorblind === m);
    setFxPalette(st.colorblind); setRarityPalette(st.colorblind);
    if (initial) return;
    this.scene3d.applyQuality(); this.rig.shakeScale = st.screenShake; this.rig.setZoom(st.cameraZoom);
    this.vfx.q = this.scene3d.q; this.vfx.particles.density = this.scene3d.q.particles;
    this.audio.applySettings();
    if (this.session) {
      Object.assign(this.session.settings, this.sessionSettings());
      for (const pz of this.session.puzzleHost.map.values()) pz.hints.enabled = st.puzzleHints !== false;
      if (this.session.dungeon) for (const pz of this.session.dungeon.puzzles.values()) pz.hints.enabled = st.puzzleHints !== false;
    }
    saveSettings(st);
  }

  #resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.scene3d.resize(); this.overlay.resize(w, h);
    this.vfx.particles.setViewport(h * this.scene3d.q.pixelRatio, this.scene3d.camera.fov);
  }

  castSlot(slot) { if (this.session && !this.ui.blocking) this.world.controller.castSlot(this.player, slot); }

  // ───────────────────────── input
  #onAction(a, down) {
    if (this.state !== 'playing') return;
    if (a === 'pause' && down) { if (!this.ui.escape()) this.ui.open('pause'); return; }
    const s = this.session;
    if (this.ui.blocking) {
      if (down && a === 'inventory' && this.ui.isOpen('inventory')) this.ui.close('inventory');
      else if (down && ['talents', 'map', 'quests', 'codex', 'craft', 'voices'].includes(a)) { const id = a === 'voices' ? 'skills' : a; if (this.ui.isOpen(id)) this.ui.close(id); }
      return;
    }
    const p = s.player, w = s.world;
    if (p.dead) return;
    const slotMap = this.input.skillSlots;
    if (a in slotMap) { if (down) w.controller.castSlot(p, slotMap[a]); p.cmd.channel = down; return; }
    switch (a) {
      case 'dodge': if (down) w.controller.castSlot(p, 'dodge'); break;
      case 'listen': p.cmd.listen = down; break;
      case 'voice': if (down) w.controller.castSlot(p, 'voice'); break;
      case 'interact': if (down) this.#interactNearest(); break;
      case 'potion': if (down) { const r = s.usePotion(); if (!r.ok && r.reason === 'empty') this.toast(t('toast.no_potions')); } break;
      case 'inventory': if (down) this.ui.open('inventory'); break;
      case 'talents': if (down) this.ui.open('talents'); break;
      case 'map': if (down) this.ui.open('map'); break;
      case 'quests': if (down) this.ui.open('quests'); break;
      case 'codex': if (down) this.ui.open('codex'); break;
      case 'craft': if (down) this.ui.open('craft', { station: null }); break;
      case 'voices': if (down) this.ui.open('skills'); break;
      case 'lootToggle': this.showAllLoot = down; break;
      case 'devtools': if (down && this.dev) this.ui.toggle('dev'); break;
      default: break;
    }
  }

  #onMouse(button, down) {
    if (this.state !== 'playing' || this.ui.blocking) return;
    const p = this.player, c = p?.cmd; if (!c || p.dead) return;
    if (button === 0) {
      this.leftHeld = down;
      if (!down) { c.holdPrimary = false; return; }
      this.#refreshHover();
      if (this.hoverLoot) { this.pendingPickup = this.hoverLoot.uid; this.pendingInteract = null; c.attackTarget = null; this.#moveTo(this.hoverLoot.x, this.hoverLoot.z); return; }
      if (this.hoverIA && !this.hoverEnemy) { this.#clickInteract(this.hoverIA); return; }
      this.pendingInteract = null; this.pendingPickup = null;
      if (this.input.keys.has('ShiftLeft')) { this.leftMode = 'stand'; c.holdPrimary = true; c.attackTarget = null; c.moveTo = null; }
      else if (this.hoverEnemy) { this.leftMode = 'attack'; c.attackTarget = this.hoverEnemy.uid; c.moveTo = null; }
      else if (this.input.touchMode && this.input.touchStick) return; // touch + stick: a tap on bare ground must not walk the player there
      else { this.leftMode = 'move'; c.attackTarget = null; c.moveTo = { x: this.input.hoverGround.x, z: this.input.hoverGround.z }; }
    }
  }

  /** re-pick ground / enemy / loot / interactable under the pointer (also on press, so a click never uses a stale hover) */
  #refreshHover() {
    const m = this.input.mouse, w = this.session.world, p = this.player;
    const g = this.scene3d.groundAt(m.x, m.y, p.y ?? 0);
    this.input.hoverGround = g;
    this.hoverEnemy = this.views.pick(w, this.scene3d.camera, this.scene3d.size, m.x, m.y, (e) => e.team === 'enemy' && !e.untargetable);
    this.#hoverTargets(m.x, m.y);
    return g;
  }

  #moveTo(x, z) { const c = this.player.cmd; c.moveTo = { x, z }; c.attackTarget = null; }

  #clickInteract(o) {
    const p = this.player;
    if (Math.hypot(o.x - p.x, o.z - p.z) <= (o.r ?? 2.4) + 0.8) { this.#doInteract(o); return; }
    this.pendingInteract = o; this.pendingPickup = null; this.#moveTo(o.x, o.z);
  }
  #interactNearest() {
    const o = this.session.nearestInteractable(); if (o) this.#doInteract(o);
    else { const g = this.#nearestLoot(3.4); if (g) this.#doPickup(g.uid); }
  }
  #doInteract(o) {
    this.pendingInteract = null; this.player.cmd.moveTo = null;
    const r = this.session.interact(o);
    if (!r.ok && r.reason === 'far') this.toast(t('toast.too_far'));
    if (r.ok) this.audio.ui('interact');
  }
  #nearestLoot(range) {
    const p = this.player; let best = null, bd = range;
    for (const g of this.session.loot.ground) { const d = Math.hypot(g.x - p.x, g.z - p.z); if (d < bd) { bd = d; best = g; } }
    return best;
  }
  #doPickup(uid) {
    this.pendingPickup = null;
    const r = this.session.pickup(uid);
    if (!r.ok) { if (r.reason === 'full') this.toast(t('toast.inventory_full')); else if (r.reason === 'far') this.toast(t('toast.too_far')); }
  }

  // ───────────────────────── frame
  #frame(now) {
    if (!this.running) return;
    const cap = this.fpsCap ?? this.settings.fpsCap; // 0 = uncapped; the mobile PerfGovernor / battery saver sets 30
    if (cap > 0 && !this.fixedDt && now - this.last < 1000 / cap - 2) { requestAnimationFrame((n) => this.#frame(n)); return; }
    const raw = this.fixedDt ?? Math.min(0.1, (now - this.last) / 1000); this.last = now;
    this.fps += (1 / Math.max(raw, 1e-4) - this.fps) * 0.05;
    this.time += raw;
    try { this.#update(raw); } catch (err) { log.error('frame failed', err); }
    this.scene3d.render();
    this.dtDraw = raw; if (this.barGhost.size > 400) this.barGhost.clear();
    this.#drawOverlay();
    requestAnimationFrame((n) => this.#frame(n));
    this.frames++;
  }

  #update(dt) {
    // screen fade for context switches
    const target = this.fadeTarget;
    this.fade += Math.sign(target - this.fade) * Math.min(Math.abs(target - this.fade), dt * 4.5);
    this.fadeEl.style.opacity = this.fade.toFixed(3);
    if (this.rebuilding && this.fade >= 1) { this.rebuilding = false; this.#buildContext(); this.fadeTarget = 0; }
    if (this.state !== 'playing' || !this.session) { this.#idleCamera(dt); return; }
    const s = this.session, w = s.world, p = s.player, input = this.input;
    input.pollPad();
    const blocking = this.ui.blocking;
    const simDt = blocking || this.rebuilding ? 0 : (this.vfx.hitstop > 0 ? dt * 0.06 : dt);
    const m = input.mouse;
    if (!blocking) {
      const g = this.#refreshHover();
      this.#feedCommands(dt, g);
      this.#pending();
    } else { this.hoverEnemy = null; this.hoverIA = null; this.hoverLoot = null; }
    s.update(simDt);
    this.ui.update(dt);
    this.dungeonViewDoors?.();
    this.views.update(w, this.vfx.hitstop > 0 ? dt * 0.06 : dt, this.time, this.hoverEnemy?.uid);   // rigs freeze with the sim during hit-stop
    this.interact.update(dt, this.time);
    this.loot.update(dt, this.time);
    this.gate?.update(dt, this.time);
    this.vfx.update(dt, this.time, w, this.views);
    const dir = p.cmd.moveDir ?? (p.intent ? { x: p.intent.x, z: p.intent.z } : { x: 0, z: 0 });
    this.rig.update(dt, { x: p.x, y: p.y, z: p.z }, dir, this.time);
    this.weatherFx.update(dt, s.mode === 'overworld' ? s.weather?.state() && { current: s.weather.current, dir: s.weather.dir } : null, p);
    this.scene3d.update(dt, this.time, { x: p.x, y: p.y, z: p.z }, p.listen?.active ? 1 : 0, p.hp / p.hpMax < 0.3 ? 1 - p.hp / p.hpMax : 0, this.vfx.flash);
    this.hud.update(w, p, dt);
    this.#updatePrompt();
    this.audio.update(dt, { session: s, player: p, combat: s.director.inCombat(), boss: this.#activeBoss() });
    this.vfx.particles.density = this.scene3d.q.particles;
  }

  #idleCamera(dt) {
    // slow orbit over the terrace behind the title menu (once a world exists) or nothing
    this.scene3d.render?.();
  }

  #hoverTargets(mx, my) {
    const s = this.session, cam = this.scene3d.camera, size = this.scene3d.size, p = this.player;
    const v = new THREE.Vector3();
    let bestIA = null, bd = 44;
    const near = (x, y, z) => { v.set(x, y, z).project(cam); return v.z < 1 ? [(v.x * 0.5 + 0.5) * size.w, (-v.y * 0.5 + 0.5) * size.h] : null; };
    for (const o of s.interactables) {
      if (o.decor || !s.isActive(o)) continue;
      if (Math.hypot(o.x - p.x, o.z - p.z) > 40) continue;
      const sp = near(o.x, (this.zone?.heightAt(o.x, o.z) ?? 0) + (o.kind === 'npc' ? 1.2 : 0.8), o.z); if (!sp) continue;
      const d = Math.hypot(sp[0] - mx, sp[1] - my);
      if (d < bd) { bd = d; bestIA = o; }
    }
    this.hoverIA = bestIA;
    let bestL = null, bl = 34;
    for (const g of s.loot.ground) {
      const sp = near(g.x, (this.zone?.heightAt(g.x, g.z) ?? 0) + 0.4, g.z); if (!sp) continue;
      const d = Math.hypot(sp[0] - mx, sp[1] - my);
      if (d < bl) { bl = d; bestL = g; }
    }
    this.hoverLoot = bestL;
  }

  #pending() {
    const p = this.player;
    if (this.pendingInteract) {
      const o = this.pendingInteract;
      if (!this.session.isActive(o)) this.pendingInteract = null;
      else if (Math.hypot(o.x - p.x, o.z - p.z) <= (o.r ?? 2.4) + 0.6) this.#doInteract(o);
    }
    if (this.pendingPickup) {
      const g = this.session.loot.find(this.pendingPickup);
      if (!g) this.pendingPickup = null;
      else if (Math.hypot(g.x - p.x, g.z - p.z) <= 2.2) { p.cmd.moveTo = null; this.#doPickup(g.uid); }
    }
  }

  #feedCommands(dt, ground) {
    const p = this.player, c = p.cmd, inp = this.input, w = this.world;
    if (p.dead) return;
    c.aim = { x: ground.x, z: ground.z };
    const ta = inp.touchAim(p, w); if (ta) c.aim = ta; // touch: aim-drag / nearest hostile / facing (never the stale finger position)
    const f = this.rig.forwardDir(), r = this.rig.rightDir();
    let ix = 0, iz = 0;
    if (inp.isDown('moveUp')) iz += 1; if (inp.isDown('moveDown')) iz -= 1;
    if (inp.isDown('moveRight')) ix += 1; if (inp.isDown('moveLeft')) ix -= 1;
    if (inp.pad.active) { ix += inp.pad.ax; iz -= inp.pad.az; }
    if (inp.touch.stickId !== null) { ix += inp.touch.dx; iz -= inp.touch.dz; }
    if (ix || iz) {
      const l = Math.hypot(ix, iz), k = Math.min(1, l) / l;
      c.moveDir = { x: (f.x * iz + r.x * ix) * k, z: (f.z * iz + r.z * ix) * k };
      this.pendingInteract = null; this.pendingPickup = null;
    } else c.moveDir = null;
    if (inp.pad.active && (inp.pad.bx || inp.pad.bz)) { const bx = inp.pad.bx, bz = -inp.pad.bz; c.aim = { x: p.x + (f.x * bz + r.x * bx) * 8, z: p.z + (f.z * bz + r.z * bx) * 8 }; }
    else if (inp.pad.active && c.moveDir && !inp.mouse.down[0]) c.aim = { x: p.x + c.moveDir.x * 6, z: p.z + c.moveDir.z * 6 };
    if (this.leftHeld && this.leftMode === 'move' && !this.hoverEnemy && !this.pendingInteract && !this.pendingPickup) c.moveTo = { x: ground.x, z: ground.z };
    if (this.leftHeld && this.leftMode === 'attack' && this.hoverEnemy) c.attackTarget = this.hoverEnemy.uid;
    if (inp.pad.primary || inp.virtual.primary) c.holdPrimary = true; else if (!this.leftHeld || this.leftMode !== 'stand') c.holdPrimary = this.leftMode === 'stand' && this.leftHeld;
    if (this.settings.scheme === 'wasd') { c.holdPrimary = this.leftHeld || !!inp.pad.primary || inp.virtual.primary; if (this.leftHeld) { c.attackTarget = null; if (!this.pendingInteract && !this.pendingPickup) c.moveTo = null; } }
    if ((inp.pad.active || inp.touchMode) && this.settings.aimAssist > 0) {
      const near = w.nearestHostile(p, 9, (e) => !e.untargetable);
      if (near && Math.hypot(near.x - c.aim.x, near.z - c.aim.z) < 5 * this.settings.aimAssist + 2) c.aim = { x: near.x, z: near.z };
    }
  }

  #activeBoss() { const w = this.world; return w?.entities.find((e) => e.boss && !e.dead && e.boss.started) ?? null; }

  #updatePrompt() {
    const s = this.session; if (!s || this.ui.blocking || s.player.dead) { this.hud.prompt(null); return; }
    const o = this.hoverIA && Math.hypot(this.hoverIA.x - s.player.x, this.hoverIA.z - s.player.z) < 22 ? this.hoverIA : s.nearestInteractable();
    const near = s.nearestInteractable();
    this.interact?.highlight(near ?? null);
    if (near) { const label = t(near.labelKey ?? 'ia.interact'); const nm = near.nameKey && i18n.has(near.nameKey) ? ` — ${t(near.nameKey)}` : ''; this.hud.prompt(`[${this.#keyName('interact')}] ${label}${nm}`); }
    else { const g = this.#nearestLoot(3.4); if (g) this.hud.prompt(`[${this.#keyName('interact')}] ${t('ui.pickup')}`); else this.hud.prompt(null); }
  }
  #keyName(action) { const c = this.input.bindings[action]?.[0] ?? ''; return c.replace('Key', '').replace('Digit', '').replace('Mouse', 'M'); }

  #drawOverlay() {
    const o = this.overlay, cam = this.scene3d;
    o.begin();
    if (this.state !== 'playing' || !this.session) return;
    const s = this.session, w = s.world, p = s.player;
    if (this.settings.damageNumbers) for (const n of this.vfx.numbers) {
      const sp = cam.project(n.x, n.y, n.z); if (!sp.visible) continue;
      const k = n.t / n.life, a = Math.min(1, n.t / 0.14), b = a - 1;
      const pop = a < 1 ? 0.5 + 0.5 * (1 + 2.7 * b * b * b + 1.7 * b * b) * (n.crit ? 1.25 : 1) : 1;        // ease-out-back: punches in with a little overshoot
      const drift = Math.sin(n.seed * 6.283) * 16 * Math.min(1, n.t * 2.5);
      o.text(sp.x + drift, sp.y, n.text, { size: Math.round(17 * n.scale * pop), color: n.color, alpha: Math.min(1, (1 - k) * 2.4), stroke: n.crit ? '#5a2a00' : '#000' });
    }
    for (const e of w.entities) {
      if (e.dead || e.team !== 'enemy' || (e.hidden && e.untargetable) || e.isHazard) continue;
      const hovered = this.hoverEnemy === e, hurt = e.hp < e.hpMax, big = e.tier === 'elite' || e.tier === 'miniboss';
      if (!(hovered || (hurt && w.time - e.lastHurtTime < 6) || big)) continue;
      if (e.tier === 'boss' || (e.boss && e.boss.started)) continue;
      const sp = cam.project(e.x, e.y + (e.height ?? 1.5) + 0.35, e.z); if (!sp.visible) continue;
      const wBar = big ? 78 : 52;
      const frac = e.hp / e.hpMax; let gh = this.barGhost.get(e.uid) ?? frac;
      gh = frac >= gh ? frac : Math.max(frac, gh - this.dtDraw * 0.7); this.barGhost.set(e.uid, gh);
      o.bar(sp.x, sp.y, wBar, e.tier === 'elite' ? 7 : 5, frac, { fill: e.tier === 'elite' ? '#ffcf5a' : e.tier === 'miniboss' ? '#ff8a3a' : '#d9473a', shield: e.shield ? e.shield / e.hpMax : 0, ghost: gh });
      if (hovered || big) o.text(sp.x, sp.y - 11, t(`${e.id}.name`), { size: 12, color: big ? '#ffcf5a' : '#f2e7cf' });
      if (e.modifiers?.length && (hovered || big)) o.text(sp.x, sp.y - 24, e.modifiers.map((m) => t(`${m}.name`)).join(' · '), { size: 11, color: '#ffb36a' });
    }
    // NPC names + quest markers
    for (const [id, e] of s.mode === 'overworld' ? s.overworld.npcs : []) {
      if (Math.hypot(e.x - p.x, e.z - p.z) > 26) continue;
      const sp = cam.project(e.x, e.y + 2.15, e.z); if (!sp.visible) continue;
      o.text(sp.x, sp.y, t(`${e.npc}.name`), { size: 12, color: '#ffe6a8' });
      const mk = s.npcMarker(e.npc);
      if (mk) o.text(sp.x, sp.y - 18 + Math.sin(this.time * 4) * 2, mk === 'objective' ? '?' : '!', { size: 24, color: mk === 'objective' ? '#ffe27a' : '#7fe3ff' });
    }
    // interactable labels (named ones) and echo markers while listening
    const listening = p.listen?.active;
    for (const ob of s.interactables) {
      if (ob.kind === 'tone_pillar' && Math.hypot(ob.x - p.x, ob.z - p.z) < 14) { const sp = cam.project(ob.x, 3.2, ob.z); if (sp.visible) o.text(sp.x, sp.y, t(ob.nameKey), { size: 12, color: '#d9d5ff' }); }
      if (ob === this.hoverIA && ob.nameKey && i18n.has(ob.nameKey)) { const sp = cam.project(ob.x, (this.zone?.heightAt(ob.x, ob.z) ?? 0) + 2.2, ob.z); if (sp.visible) o.text(sp.x, sp.y, t(ob.nameKey), { size: 13, color: '#fff' }); }
    }
    if (listening) for (const e of w.echoes) {
      if (!w.listen.isRevealed(e)) continue;
      const sp = cam.project(e.x, (this.zone?.heightAt(e.x, e.z) ?? 0) + 1.2, e.z); if (!sp.visible) continue;
      o.diamond(sp.x, sp.y, 9 + Math.sin(this.time * 6) * 2, e.kind === 'secret' ? '#b79cff' : e.kind === 'resource' ? '#7fe3ff' : '#ffd27a', 0.9);
    }
    // loot labels
    const items = [];
    for (const g of s.loot.ground) {
      const sp = cam.project(g.x, (this.zone?.heightAt(g.x, g.z) ?? 0) + 0.8, g.z); if (!sp.visible) continue;
      let text = null, color = '#fff';
      if (g.kind === 'item') { const r = g.item.rarity; if (r !== 'common' || this.showAllLoot || this.hoverLoot === g) { text = itemName(this.registry, g.item); color = RARITY_COLOR[r]; } }
      else if (this.hoverLoot === g || this.showAllLoot) { text = g.kind === 'chimes' ? `${g.amount} ${t('ui.chimes')}` : g.kind === 'material' ? `${t(`${g.id}.name`)} ×${g.amount}` : g.kind === 'consumable' ? t(`${g.id}.name`) : g.kind === 'deathBundle' ? `${t('ui.death_bundle')} (${g.amount})` : t('ui.potion_charge'); color = g.kind === 'deathBundle' ? '#b79cff' : '#ffd27a'; }
      if (text) items.push({ x: sp.x, y: sp.y, text, color, hover: this.hoverLoot === g });
    }
    items.sort((a, b) => a.y - b.y);
    for (let i = 0; i < items.length; i++) { for (let j = 0; j < i; j++) if (Math.abs(items[i].x - items[j].x) < 110 && Math.abs(items[i].y - items[j].y) < 16) items[i].y = items[j].y + 16; }
    for (const it of items) o.text(it.x, it.y, it.text, { size: it.hover ? 14 : 12, color: it.color, stroke: 'rgba(0,0,0,.9)' });
    this.hud.boss(w, this.#activeBoss());
  }

  get dev() { return typeof __DEV_TOOLS__ !== 'undefined' && __DEV_TOOLS__; }
}

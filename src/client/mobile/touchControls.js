import { clusterLayout } from './layout.js';
import { iconSVG } from '../ui/iconGen.js';
import { t } from '../../core/i18n.js';

/**
 * TouchControls — the whole on-screen control scheme for phones and tablets.
 *
 *  left thumb   floating virtual stick (appears where the thumb lands; quick tap = world tap)
 *  right thumb  big ATTACK button (hold = auto-attack the nearest enemy, drag = aim by hand) on a thumb arc of
 *               DODGE + skills; tap = cast at the nearest enemy, press-and-drag = aim, release = cast, drag back = cancel;
 *               self-cast skills fire on press, channelled skills (beams) channel while held
 *  world        tap enemy = attack it, loot = pick up, NPC/object = interact (generous hit areas), two fingers = pinch zoom
 *  extras       contextual INTERACT pill, potion, listen (toggle or hold), voice, menu button, vitals, Cadence phrase dots
 *
 * Everything funnels into the same paths as keyboard/mouse: Input.hooks.onAction / onMouse, Input.touch (stick),
 * Input.virtual (attack/aim) — the simulation never knows a finger was involved.
 */

const TONE = { low: '#d9a24a', mid: '#7fe3ff', high: '#c9b4ff' };
const SLOT_ACTION = { s1: 'skill1', s2: 'skill2', s3: 'skill3', s4: 'skill4', s5: 'skill5', s6: 'skill6' };
const TAP_MS = 220, TAP_PX = 12, AIM_START_PX = 14;

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class TouchControls {
  constructor(game, { root = document.getElementById('ui') } = {}) {
    this.g = game; this.root = root; this.input = game.input;
    this.enabled = false; this.shown = false;
    this.ptr = new Map();                  // pointerId → record
    this.btnEls = new Map();               // id → {el, cd, num, ring, icon}
    this.sig = ''; this.layout = null; this.lastUpdate = 0;
    this.aim = null;                       // active skill aim {id, ox, oy, x, y, mag, dir, kind, range}
    this.listenOn = false;
    this.rafOn = false;
    this.wptr = null;                      // canvas pointers (world taps / pinch)
    this.boundWorld = null;

    this.el = el('div', 'tc hidden'); this.el.id = 'tc';
    this.zone = el('div', 'tc-zone'); this.zone.dataset.kind = 'stick';
    this.stickEl = el('div', 'tc-stick hidden', '<i class="tc-base"></i><i class="tc-knob"></i>');
    this.home = el('div', 'tc-home', '<i></i>');
    this.cluster = el('div', 'tc-cluster');
    this.vitals = el('div', 'tc-vitals', '<div class="tc-bar life"><i></i><b></b></div><div class="tc-bar res"><i></i><b></b></div><div class="tc-bar xp"><i></i></div><div class="tc-phrase"><i></i><i></i><i></i></div>');
    this.phrase = this.vitals.querySelector('.tc-phrase');
    this.menuBtn = el('button', 'tc-menu', '<span>☰</span><em class="hidden"></em>'); this.menuBtn.setAttribute('aria-label', 'Menu'); this.menuBtn.type = 'button';
    this.interactBtn = el('button', 'tc-interact hidden'); this.interactBtn.type = 'button';
    this.aimCanvas = el('canvas', 'tc-aim');
    this.el.append(this.zone, this.home, this.stickEl, this.cluster, this.vitals, this.menuBtn, this.interactBtn, this.aimCanvas);
    root.append(this.el);

    this.#bind();
    window.addEventListener('resize', () => { this.sig = ''; }); window.addEventListener('orientationchange', () => { this.sig = ''; });
    window.visualViewport?.addEventListener('resize', () => { this.sig = ''; });
    for (const ev of ['blur', 'pagehide']) window.addEventListener(ev, () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
  }

  // ───────────────────────── lifecycle
  setEnabled(on) { this.enabled = on; this.input.touchMode = on; if (!on) { this.releaseAll(); this.#show(false); document.documentElement.classList.remove('tc-on'); } else this.#loop(); }
  get S() { return this.g.settings; }

  #loop() {
    if (this.rafOn) return; this.rafOn = true;
    const tick = (now) => {
      if (!this.enabled) { this.rafOn = false; return; }
      if (now - this.lastUpdate >= 30) { this.lastUpdate = now; try { this.update(); } catch (e) { console.error('[touch]', e); } }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  #show(v) { if (v === this.shown) return; this.shown = v; this.el.classList.toggle('hidden', !v); if (!v) this.releaseAll(); }

  releaseAll() {
    for (const rec of [...this.ptr.values()]) this.#end(rec, true);
    this.ptr.clear();
    const v = this.input.virtual; v.primary = false; v.aimDir = null; v.aimDist = null;
    this.input.touch.stickId = null; this.input.touch.dx = this.input.touch.dz = 0;
    this.stickEl.classList.add('hidden'); this.aim = null; this.#clearAim();
    for (const b of this.btnEls.values()) b.el.classList.remove('down');
    if (this.g.player?.cmd) { this.g.player.cmd.channel = false; if (!this.S.listenToggle) this.g.player.cmd.listen = false; }
  }

  // ───────────────────────── geometry & layout
  #insets() {
    const cs = getComputedStyle(document.documentElement);
    const px = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
    return { top: px('--sat'), right: px('--sar'), bottom: px('--sab'), left: px('--sal') };
  }

  #idsFor(p) {
    const ids = [];
    if (p.loadout?.dodge) ids.push('dodge');
    for (const s of ['s1', 's2', 's3', 's4', 's5', 's6']) if (p.loadout?.[s]) ids.push(s);
    ids.push('potion', 'listen');
    if (p.voices?.equipped?.[0] || p.loadout?.voice) ids.push('voice');
    return ids;
  }

  #rebuild(p) {
    const W = window.visualViewport?.width ?? innerWidth, H = window.visualViewport?.height ?? innerHeight;
    const S = this.S, ids = this.#idsFor(p);
    this.layout = clusterLayout({ W, H, insets: this.#insets(), scale: S.touchScale ?? 1, leftHanded: !!S.leftHanded, ids, topReserve: Math.round(60 * Math.max(0.8, Math.min(1.3, Math.min(W, H) / 390))) });
    const L = this.layout, m = L.m;
    this.el.style.setProperty('--tc-u', String(m.u)); this.el.style.setProperty('--tc-op', String(S.touchOpacity ?? 0.9));
    this.cluster.innerHTML = ''; this.btnEls.clear();
    const mk = (id, btn) => {
      const b = el('div', `tc-btn tc-${id}`);
      b.dataset.id = id; b.style.width = b.style.height = `${btn.r * 2}px`; b.style.left = `${btn.x - btn.r}px`; b.style.top = `${btn.y - btn.r}px`;
      const world = this.g.world;
      let ab = null, icon = null;
      if (id === 'attack') { const pid = p.loadout?.primary; ab = pid ? world.abilities.resolve(p, pid) : null; icon = ab?.icon ?? { glyph: 'blades', elem: 'physical' }; }
      else if (SLOT_ACTION[id] || id === 'dodge') { const aid = p.loadout?.[id]; ab = aid ? world.abilities.resolve(p, aid) : null; icon = ab?.icon ?? (id === 'dodge' ? { glyph: 'roll', elem: 'none' } : null); }
      else if (id === 'potion') icon = { glyph: 'potion', elem: 'heal' };
      else if (id === 'listen') icon = { glyph: 'ear', elem: 'sonic' };
      else if (id === 'voice') icon = { glyph: 'voice', elem: 'sonic' };
      const size = Math.round(btn.r * 2 - 6);
      b.innerHTML = `<svg class="tc-ring" viewBox="0 0 100 100"><circle class="tc-ring-bg" cx="50" cy="50" r="46"/><circle class="tc-ring-fg" cx="50" cy="50" r="46" pathLength="100"/></svg><div class="tc-ico">${icon ? iconSVG(icon, size) : ''}</div><b class="tc-num"></b><i class="tc-cnt"></i>`;
      if (ab?.tone) { b.dataset.tone = ab.tone; b.style.setProperty('--tone', TONE[ab.tone] ?? '#d9a24a'); }
      b.dataset.aim = ab?.channel ? 'channel' : (ab?.aim ?? (id === 'attack' ? 'direction' : 'self'));
      this.cluster.append(b);
      this.btnEls.set(id, { el: b, ring: b.querySelector('.tc-ring-fg'), num: b.querySelector('.tc-num'), cnt: b.querySelector('.tc-cnt'), ab, id });
    };
    for (const [id, btn] of Object.entries(L.buttons)) mk(id, btn);
    // stick home hint + zone + side-dependent HUD pieces
    const zw = Math.round(W * (W > H ? 0.46 : 0.5));
    this.zone.style.cssText = `left:${S.leftHanded ? W - zw : 0}px;width:${zw}px;top:${Math.round(H * (W > H ? 0.42 : 0.56))}px;bottom:0`;
    this.home.style.left = `${L.stickHome.x}px`; this.home.style.top = `${L.stickHome.y}px`; this.home.style.setProperty('--r', `${m.stick}px`);
    this.el.classList.toggle('lefty', !!S.leftHanded);
    this.menuBtn.style.width = this.menuBtn.style.height = `${m.menu}px`;
    this.interactBtn.style.height = `${Math.round(50 * m.u)}px`;
    this.#sizeAim();
  }

  // ───────────────────────── input plumbing
  #bind() {
    const down = (e) => this.#down(e), move = (e) => this.#move(e), up = (e) => this.#up(e);
    this.el.addEventListener('pointerdown', down); this.el.addEventListener('pointermove', move);
    this.el.addEventListener('pointerup', up); this.el.addEventListener('pointercancel', up);
    this.el.addEventListener('lostpointercapture', (e) => { const r = this.ptr.get(e.pointerId); if (r && !r.ended) this.#end(r, true); });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.menuBtn.addEventListener('click', () => this.g.ui.toggle('mmenu'));
    this.interactBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.haptic(8); this.g.input.hooks.onAction?.('interact', true, null); });
    // canvas = world taps + pinch
    const gl = document.getElementById('gl');
    gl.addEventListener('pointerdown', (e) => this.#worldDown(e)); gl.addEventListener('pointermove', (e) => this.#worldMove(e));
    gl.addEventListener('pointerup', (e) => this.#worldUp(e)); gl.addEventListener('pointercancel', (e) => this.#worldUp(e, true));
  }

  #down(e) {
    if (!this.enabled || e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target.closest?.('.tc-btn, .tc-zone, .tc-menu, .tc-interact');
    if (!target || target === this.menuBtn || target === this.interactBtn) return;
    e.preventDefault();
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const now = e.timeStamp; // event time, not handler time: a slow frame must not turn a tap into a long press
    if (target.classList.contains('tc-zone')) {
      if ([...this.ptr.values()].some((r) => r.kind === 'stick')) return;
      const rec = { kind: 'stick', id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: now, travel: 0, ended: false };
      this.ptr.set(e.pointerId, rec); this.#stickStart(rec);
    } else {
      const id = target.dataset.id;
      const rec = { kind: 'btn', btn: id, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, t0: now, travel: 0, aiming: false, fired: false, ended: false };
      this.ptr.set(e.pointerId, rec); this.#btnStart(rec);
    }
  }

  #move(e) {
    const rec = this.ptr.get(e.pointerId); if (!rec || rec.ended) return;
    rec.x = e.clientX; rec.y = e.clientY; rec.travel = Math.max(rec.travel, Math.hypot(rec.x - (rec.sx ?? rec.ox), rec.y - (rec.sy ?? rec.oy)));
    if (rec.kind === 'stick') this.#stickMove(rec); else this.#btnMove(rec);
  }

  #up(e) { const rec = this.ptr.get(e.pointerId); if (!rec) return; this.#end(rec, e.type === 'pointercancel', e.timeStamp); this.ptr.delete(e.pointerId); }

  #end(rec, cancelled, tEnd = performance.now()) {
    if (rec.ended) return; rec.ended = true; rec.tEnd = tEnd;
    if (rec.kind === 'stick') this.#stickEnd(rec, cancelled); else this.#btnEnd(rec, cancelled);
  }

  // ───────────────────────── virtual stick
  #stickStart(rec) {
    const S = this.S;
    this.stickEl.classList.remove('hidden');
    const R = this.layout.m.stick;
    rec.R = R;
    this.#placeStick(rec.ox, rec.oy, rec.ox, rec.oy);
    this.input.touch.stickId = 'tc'; this.input.touch.dx = this.input.touch.dz = 0;
    this.input.touchStick = (S.touchScheme ?? 'stick') === 'stick';
    this.haptic(4);
  }
  #stickMove(rec) {
    let dx = rec.x - rec.ox, dy = rec.y - rec.oy, d = Math.hypot(dx, dy);
    const R = rec.R;
    if (d > R) { // floating origin: drag the base along so the thumb never runs out of room
      const ex = d - R; rec.ox += dx / d * ex; rec.oy += dy / d * ex; dx = rec.x - rec.ox; dy = rec.y - rec.oy; d = Math.hypot(dx, dy);
    }
    let vx = dx / R, vy = dy / R; const mag = Math.min(1, d / R);
    const DEAD = 0.14;
    if (mag < DEAD) { vx = vy = 0; } else { const k = (mag - DEAD) / (1 - DEAD) / Math.max(1e-6, mag); vx *= k; vy *= k; }
    this.input.touch.dx = vx; this.input.touch.dz = vy;
    this.#placeStick(rec.ox, rec.oy, rec.x, rec.y, R);
  }
  #stickEnd(rec, cancelled) {
    this.input.touch.stickId = null; this.input.touch.dx = this.input.touch.dz = 0;
    this.stickEl.classList.add('hidden');
    const quick = (rec.tEnd ?? performance.now()) - rec.t0 < TAP_MS && rec.travel < TAP_PX;
    if (quick && !cancelled) this.input.tapAt(rec.sx, rec.sy); // a short tap inside the stick area is still a tap on the world
  }
  #placeStick(ox, oy, kx, ky, R = 60) {
    const d = Math.hypot(kx - ox, ky - oy), k = d > R ? R / d : 1;
    this.stickEl.style.setProperty('--ox', `${ox}px`); this.stickEl.style.setProperty('--oy', `${oy}px`);
    this.stickEl.style.setProperty('--kx', `${(kx - ox) * k}px`); this.stickEl.style.setProperty('--ky', `${(ky - oy) * k}px`);
    this.stickEl.style.setProperty('--R', `${R}px`);
  }

  // ───────────────────────── buttons
  #cam() { const rig = this.g.rig; return { f: rig.forwardDir(), r: rig.rightDir() }; }
  /** screen-space drag vector → world direction (screen up = camera forward) */
  #dirFromScreen(dx, dy) {
    const { f, r } = this.#cam(); const l = Math.hypot(dx, dy) || 1;
    const ix = dx / l, iz = -dy / l;
    const x = f.x * iz + r.x * ix, z = f.z * iz + r.z * ix, n = Math.hypot(x, z) || 1;
    return { x: x / n, z: z / n };
  }
  #player() { return this.g.session?.player ?? null; }

  #btnStart(rec) {
    const id = rec.btn, b = this.btnEls.get(id); if (!b) return;
    b.el.classList.add('down'); this.haptic(id === 'attack' ? 5 : 8);
    const v = this.input.virtual, hooks = this.input.hooks, p = this.#player(); if (!p) return;
    if (id === 'attack') { v.primary = true; return; }
    if (id === 'dodge') { this.#dodge(p); return; }
    if (id === 'potion') { hooks.onAction?.('potion', true, null); return; }
    if (id === 'voice') { v.autoAimUntil = performance.now() + 300; hooks.onAction?.('voice', true, null); return; }
    if (id === 'listen') {
      if (this.S.listenToggle ?? true) { this.listenOn = !this.listenOn; hooks.onAction?.('listen', this.listenOn, null); b.el.classList.toggle('on', this.listenOn); }
      else hooks.onAction?.('listen', true, null);
      return;
    }
    // skills
    const kind = b.el.dataset.aim;
    rec.kind2 = kind; rec.range = b.ab?.range ?? 10;
    if (kind === 'self') { hooks.onAction?.(SLOT_ACTION[id], true, null); rec.fired = true; return; }          // buffs / wards / self-nova: no aiming to do
    if (kind === 'channel') { v.autoAimUntil = performance.now() + 400; hooks.onAction?.(SLOT_ACTION[id], true, null); rec.fired = true; rec.channel = true; return; } // beam: channel while held, drag steers
    // direction / ground: cast on release (tap) or aim by dragging
  }

  #btnMove(rec) {
    const id = rec.btn, v = this.input.virtual;
    const dx = rec.x - rec.ox, dy = rec.y - rec.oy, mag = Math.hypot(dx, dy);
    if (id === 'attack') {
      if (mag > AIM_START_PX) { const d = this.#dirFromScreen(dx, dy); v.aimDir = d; v.aimDist = null; rec.aiming = true; this.#setAim({ id, dir: d, mag, kind: 'direction', range: 9 }); }
      else if (rec.aiming) { v.aimDir = null; rec.aiming = false; this.aim = null; }
      return;
    }
    if (rec.kind2 === 'self' || ['dodge', 'potion', 'voice', 'listen'].includes(id)) return;
    if (rec.kind2 === 'channel') { if (mag > AIM_START_PX) { v.aimDir = this.#dirFromScreen(dx, dy); v.aimDist = null; } return; }
    if (mag > AIM_START_PX) {
      rec.aiming = true; rec.dragged = Math.max(rec.dragged ?? 0, mag);
      const dir = this.#dirFromScreen(dx, dy);
      rec.dir = dir; rec.mag = mag;
      v.aimDir = dir; v.aimDist = rec.kind2 === 'ground' ? clamp(rec.range * Math.min(1, mag / 90), 2.5, rec.range) : null;
      this.#setAim({ id, dir, mag, kind: rec.kind2, range: rec.range, dist: v.aimDist });
    } else if (rec.aiming && rec.dragged > 40) { rec.cancelled = true; this.aim = { ...(this.aim ?? {}), cancel: true }; } // dragged back to the button: cancel
    else if (rec.aiming) { rec.aiming = false; v.aimDir = null; this.aim = null; }
    if (mag > AIM_START_PX * 2) rec.cancelled = false;
  }

  #btnEnd(rec, cancelled) {
    const id = rec.btn, b = this.btnEls.get(id), v = this.input.virtual, hooks = this.input.hooks, p = this.#player();
    b?.el.classList.remove('down');
    if (id === 'attack') { v.primary = false; v.aimDir = null; this.aim = null; this.#clearAim(); return; }
    if (id === 'listen') { if (!(this.S.listenToggle ?? true) && p?.cmd) hooks.onAction?.('listen', false, null); return; }
    if (!p || ['dodge', 'potion', 'voice'].includes(id)) { if (id === 'voice') hooks.onAction?.('voice', false, null); return; }
    if (rec.kind2 === 'self') { hooks.onAction?.(SLOT_ACTION[id], false, null); return; }
    if (rec.kind2 === 'channel') { hooks.onAction?.(SLOT_ACTION[id], false, null); v.aimDir = null; v.aimDist = null; this.aim = null; this.#clearAim(); return; }
    // direction / ground skills: fire on release unless cancelled
    if (!cancelled && !rec.cancelled) {
      v.autoAimUntil = performance.now() + 350;
      hooks.onAction?.(SLOT_ACTION[id], true, null);
      setTimeout(() => hooks.onAction?.(SLOT_ACTION[id], false, null), 60);
      this.haptic(10);
    }
    // keep the explicit aim alive just long enough for the buffered cast to resolve in the sim
    setTimeout(() => { if (!this.aim || this.aim.id === id) { v.aimDir = null; v.aimDist = null; } }, rec.aiming ? 320 : 0);
    this.aim = null; this.#clearAim();
  }

  /** dodge away from the nearest enemy when standing still (retreat), else along the stick; the sim handles stick direction itself */
  #dodge(p) {
    const v = this.input.virtual, w = this.g.world;
    if (!this.input.touch.stickId || (!this.input.touch.dx && !this.input.touch.dz)) {
      const near = w.nearestHostile(p, 9, (e) => !e.untargetable);
      let dx, dz;
      if (near) { dx = p.x - near.x; dz = p.z - near.z; } else { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); } // retreat; with nothing around, hop backwards
      const l = Math.hypot(dx, dz) || 1; v.aimDir = { x: dx / l, z: dz / l }; v.aimDist = 5;
      setTimeout(() => { if (!this.aim) { v.aimDir = null; v.aimDist = null; } }, 320);
    }
    this.input.hooks.onAction?.('dodge', true, null);
  }

  // ───────────────────────── world taps / pinch (canvas)
  #worldDown(e) {
    if (!this.enabled || e.pointerType === 'mouse') return;
    e.preventDefault();
    this.wptr ??= new Map();
    this.wptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: e.timeStamp, travel: 0 });
    if (this.wptr.size === 2) { const [a, b] = [...this.wptr.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; for (const r of this.wptr.values()) r.cancelTap = true; }
    else if (this.wptr.size === 1 && (this.S.touchScheme ?? 'stick') === 'tap') { this.input.touchStick = false; this.input.mouse.x = e.clientX; this.input.mouse.y = e.clientY; this.input.hooks.onMouse?.(0, true, this.input.mouse); this.input.mouse.down[0] = true; this.tapHold = e.pointerId; }
  }
  #worldMove(e) {
    const r = this.wptr?.get(e.pointerId); if (!r) return;
    r.x = e.clientX; r.y = e.clientY; r.travel = Math.max(r.travel, Math.hypot(r.x - r.sx, r.y - r.sy));
    if (this.tapHold === e.pointerId) { const rect = e.target.getBoundingClientRect?.() ?? { left: 0, top: 0 }; this.input.mouse.x = e.clientX - rect.left; this.input.mouse.y = e.clientY - rect.top; }
    if (this.wptr.size === 2 && this.pinch) {
      const [a, b] = [...this.wptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      this.input.hooks.onWheel?.(-(d - this.pinch.d) * 2.6); this.pinch.d = d;
    }
  }
  #worldUp(e, cancelled = false) {
    const r = this.wptr?.get(e.pointerId); if (!r) return;
    this.wptr.delete(e.pointerId);
    if (this.wptr.size < 2) this.pinch = null;
    if (this.tapHold === e.pointerId) { this.tapHold = null; this.input.mouse.down[0] = false; this.input.hooks.onMouse?.(0, false, this.input.mouse); return; }
    const quick = e.timeStamp - r.t0 < TAP_MS + 120 && r.travel < TAP_PX * 1.5;
    if (quick && !cancelled && !r.cancelTap) { this.input.touchStick = (this.S.touchScheme ?? 'stick') === 'stick'; this.input.tapAt(r.sx, r.sy); }
  }

  // ───────────────────────── per-frame refresh
  update() {
    const g = this.g, s = g.session, p = s?.player;
    const active = this.enabled && g.state === 'playing' && !!s && !!p;
    document.documentElement.classList.toggle('tc-on', active);   // desktop HUD pieces stay hidden behind panels too
    const playing = active && !g.ui.blocking && !p.dead && !g.rebuilding;
    this.#show(playing);
    if (!playing) return;
    if (g.world !== this.boundWorld) this.#bindWorld(g.world);
    const W = window.visualViewport?.width ?? innerWidth, H = window.visualViewport?.height ?? innerHeight;
    const sig = `${W}x${H}|${JSON.stringify(p.loadout)}|${p.voices?.equipped?.[0] ?? ''}|${this.S.touchScale}|${this.S.leftHanded}|${this.S.touchOpacity}|${g.world.abilities.version ?? ''}`;
    if (sig !== this.sig) { this.sig = sig; this.#rebuild(p); }
    this.#refreshButtons(p);
    this.#refreshHud(p);
    this.#refreshInteract(p);
    this.#drawAim(p);
  }

  #refreshButtons(p) {
    const w = this.g.world;
    for (const b of this.btnEls.values()) {
      const id = b.id; let ab = null, left = 0, total = 1, afford = true, charges = null;
      if (id === 'attack' || id === 'dodge' || SLOT_ACTION[id]) {
        const aid = id === 'attack' ? p.loadout?.primary : p.loadout?.[id];
        ab = aid ? w.abilities.resolve(p, aid) : null;
        if (ab) {
          total = Math.max(0.1, ab.cooldown || 0.1);
          const ch = w.abilities.chargesOf(p, ab);
          if (ch) { left = ch.c.n < 1 ? Math.max(0, ch.c.at - w.time) : 0; charges = ch.c.n; } else left = id === 'attack' ? 0 : w.abilities.cooldownLeft(p, aid);
          afford = !ab.cost || w.resources.canAfford(p, ab.cost);
        }
      } else if (id === 'potion') {
        charges = this.g.character?.potion?.charges ?? null;
        afford = charges === null ? true : charges > 0;
      } else if (id === 'listen') { b.el.classList.toggle('on', !!p.listen?.active); afford = (p.listen?.breath ?? 1) > 0.3 || !!p.listen?.active; }
      b.ring.style.strokeDashoffset = left > 0 ? `${100 - (1 - Math.min(1, left / total)) * 100}` : '0';
      b.el.classList.toggle('cooling', left > 0.05);
      b.el.classList.toggle('nores', !afford);
      const txt = left > 0.05 ? (left >= 10 ? String(Math.ceil(left)) : left.toFixed(1)) : '';
      if (b.num.textContent !== txt) b.num.textContent = txt;
      const ct = charges !== null && charges !== undefined && (id === 'potion' || (ab?.charges ?? 0) > 1) ? String(charges) : '';
      if (b.cnt.textContent !== ct) b.cnt.textContent = ct;
    }
  }

  #refreshHud(p) {
    const w = this.g.world, ch = this.g.character;
    const life = this.vitals.querySelector('.life'), res = this.vitals.querySelector('.res'), xp = this.vitals.querySelector('.xp i');
    life.firstChild.style.width = `${clamp(p.hp / p.hpMax, 0, 1) * 100}%`; life.lastChild.textContent = `${Math.ceil(p.hp)}`;
    life.classList.toggle('low', p.hp / p.hpMax < 0.3);
    if (p.res) { const max = w.resources.max(p); res.className = `tc-bar res ${p.res.id}`; res.firstChild.style.width = `${clamp(p.res.value / max, 0, 1) * 100}%`; res.lastChild.textContent = `${Math.floor(p.res.value)}`; }
    if (ch) xp.style.width = `${Math.min(100, ch.xp / Math.max(1, w.balance.xpToNext(ch.level)) * 100)}%`;
    const ph = p.cadence?.phrase ?? [];
    this.phrase.querySelectorAll('i').forEach((d, i) => { d.className = ph[i] ? ph[i].tone : ''; });
    const badge = this.menuBtn.querySelector('em'); const pts = ch?.talentPoints?.() ?? 0;
    badge.textContent = pts > 0 ? String(pts) : ''; badge.classList.toggle('hidden', !(pts > 0));
  }

  #refreshInteract(p) {
    const s = this.g.session; let label = null;
    const near = s.nearestInteractable?.();
    if (near) { const base = t(near.labelKey ?? 'ia.interact'); const nm = near.nameKey ? t(near.nameKey) : ''; label = nm && nm !== near.nameKey && !String(nm).startsWith('⟦') ? `${base} · ${nm}` : base; }
    else {
      let best = null, bd = 3.6;
      for (const gr of s.loot?.ground ?? []) { const d = Math.hypot(gr.x - p.x, gr.z - p.z); if (d < bd) { bd = d; best = gr; } }
      if (best) label = t('ui.pickup');
    }
    if (label !== this.interactLabel) { this.interactLabel = label; this.interactBtn.textContent = label ?? ''; this.interactBtn.classList.toggle('hidden', !label); }
    if (label && this.layout) {
      const m = this.layout.m, W = window.visualViewport?.width ?? innerWidth, H = window.visualViewport?.height ?? innerHeight, st = this.interactBtn.style;
      if (H > W) {                  // portrait: the right thumb's fan of buttons covers the bottom centre, so the pill sits above the stick's home on the free side
        st.left = `${Math.round(W * (this.S.leftHanded ? 0.7 : 0.3))}px`; st.maxWidth = `${Math.round(W * 0.44)}px`;
        st.bottom = `${Math.round(this.#insets().bottom + m.margin + 2 * m.stick + 44 * m.u)}px`;
      } else { st.left = `${Math.round(W / 2)}px`; st.maxWidth = ''; st.bottom = `${Math.round(m.margin + 8 * m.u)}px`; }
    }
  }

  // ───────────────────────── aim indicator
  #sizeAim() {
    const c = this.aimCanvas, dpr = Math.min(2, window.devicePixelRatio || 1), W = window.visualViewport?.width ?? innerWidth, H = window.visualViewport?.height ?? innerHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = `${W}px`; c.style.height = `${H}px`; this.aimDpr = dpr;
  }
  #setAim(a) { this.aim = a; }
  #clearAim() { const c = this.aimCanvas, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); this.aimDrawn = false; }
  #drawAim(p) {
    const a = this.aim; if (!a || !this.S.showAimLine && this.S.showAimLine !== undefined) { if (this.aimDrawn) this.#clearAim(); return; }
    const c = this.aimCanvas, x = c.getContext('2d'), dpr = this.aimDpr ?? 1; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, c.width, c.height);
    const sc = this.g.scene3d, gy = this.g.zone?.heightAt?.(p.x, p.z) ?? p.y ?? 0;
    const len = a.kind === 'ground' ? (a.dist ?? 6) : Math.min(a.range ?? 9, 9);
    const o = sc.project(p.x, gy + 0.1, p.z), e = sc.project(p.x + a.dir.x * len, gy + 0.1, p.z + a.dir.z * len);
    if (!o.visible && !e.visible) return;
    const col = a.cancel ? '#ff6a5a' : '#8feaff';
    const dx = e.x - o.x, dy = e.y - o.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = col; x.fillStyle = col;
    x.globalAlpha = 0.28; x.lineWidth = 30; x.beginPath(); x.moveTo(o.x, o.y); x.lineTo(e.x, e.y); x.stroke();          // soft lane
    x.globalAlpha = 0.55; x.lineWidth = 14; x.beginPath(); x.moveTo(o.x, o.y); x.lineTo(e.x, e.y); x.stroke();
    x.globalAlpha = 1; x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.setLineDash([4, 10]); x.beginPath(); x.moveTo(o.x, o.y); x.lineTo(e.x, e.y); x.stroke(); x.setLineDash([]);
    if (a.kind === 'ground') { x.globalAlpha = 0.35; x.beginPath(); x.arc(e.x, e.y, 26, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; x.lineWidth = 3; x.strokeStyle = col; x.stroke(); }
    else { x.globalAlpha = 1; x.fillStyle = col; x.beginPath(); x.moveTo(e.x + ux * 14, e.y + uy * 14); x.lineTo(e.x - ux * 8 - uy * 13, e.y - uy * 8 + ux * 13); x.lineTo(e.x - ux * 8 + uy * 13, e.y - uy * 8 - ux * 13); x.closePath(); x.fill(); x.strokeStyle = '#06222c'; x.lineWidth = 2; x.stroke(); }
    x.globalAlpha = 1; this.aimDrawn = true;
  }

  // ───────────────────────── feedback
  haptic(ms) { const k = this.S.vibration ?? 1; if (k > 0 && navigator.vibrate) { try { navigator.vibrate(Math.max(1, Math.round(ms * k))); } catch { /* unsupported */ } } }

  #bindWorld(w) {
    this.boundWorld = w; if (!w) return;
    w.events.on('damage', (i) => { const p = this.#player(); if (!p) return; if (i.target === p && i.amount > 0) this.haptic(Math.min(40, 10 + (i.amount / p.hpMax) * 120)); else if (i.crit && i.source === p) this.haptic(9); });
    w.events.on('level:up', () => { if (navigator.vibrate && (this.S.vibration ?? 1) > 0) navigator.vibrate([24, 40, 24, 40, 60]); });
    w.events.on('entity:died', (i) => { if (i.entity?.boss) this.haptic(60); });
  }
}

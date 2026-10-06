/**
 * Input — mouse+keyboard (click-to-move or WASD), gamepad and touch all write the same player.cmd.
 * Bindings are data (remappable). The sim never sees devices.
 */
export const DEFAULT_BINDINGS = {
  moveUp: ['KeyW'], moveDown: ['KeyS'], moveLeft: ['KeyA'], moveRight: ['KeyD'],
  skill1: ['Digit1'], skill2: ['Digit2'], skill3: ['Digit3'], skill4: ['Digit4'], skill5: ['KeyQ'], skill6: ['Mouse2'],
  dodge: ['Space'], listen: ['KeyF'], voice: ['KeyR'], interact: ['KeyE'], potion: ['KeyZ'], hold: ['ShiftLeft'],
  inventory: ['KeyI'], talents: ['KeyT'], map: ['KeyM'], quests: ['KeyJ'], codex: ['KeyC'], craft: ['KeyG'], pause: ['Escape'], voices: ['KeyV'], lootToggle: ['AltLeft'],
};
export const ACTION_LIST = Object.keys(DEFAULT_BINDINGS);
const SKILL_SLOTS = { skill1: 's1', skill2: 's2', skill3: 's3', skill4: 's4', skill5: 's5', skill6: 's6' };

export class Input {
  constructor(canvas, settings, hooks) {
    this.canvas = canvas; this.settings = settings; this.hooks = hooks;
    this.keys = new Set(); this.mouse = { x: 0, y: 0, down: [false, false, false], over: true };
    this.pad = { active: false, ax: 0, az: 0, bx: 0, bz: 0 };
    this.touch = { move: null, aim: null, stickId: null, startX: 0, startY: 0, dx: 0, dz: 0 };
    this.locked = false; // UI modal open
    this.hoverUid = null; this.hoverGround = { x: 0, y: 0, z: 0 };
    this.bind();
  }

  get bindings() { return { ...DEFAULT_BINDINGS, ...(this.settings.bindings ?? {}) }; }
  isDown(action) { return this.bindings[action]?.some((c) => c.startsWith('Mouse') ? this.mouse.down[Number(c[5]) - 1 + 0] : this.keys.has(c)); }

  bind() {
    const c = this.canvas;
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.repeat) { if (!['Tab'].includes(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code);
      const act = this.actionsFor(e.code);
      for (const a of act) this.hooks.onAction?.(a, true, e);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code) || act.length) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); for (const a of this.actionsFor(e.code)) this.hooks.onAction?.(a, false, e); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = [false, false, false]; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('mousemove', (e) => { const r = c.getBoundingClientRect(); this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; });
    c.addEventListener('mousedown', (e) => {
      c.focus();
      this.mouse.down[e.button] = true;
      const code = `Mouse${e.button + 1}`;
      this.hooks.onMouse?.(e.button, true, this.mouse);
      for (const a of this.actionsFor(code)) this.hooks.onAction?.(a, true, e);
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.down[e.button] = false;
      this.hooks.onMouse?.(e.button, false, this.mouse);
      for (const a of this.actionsFor(`Mouse${e.button + 1}`)) this.hooks.onAction?.(a, false, e);
    });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.hooks.onWheel?.(e.deltaY); }, { passive: false });
    // touch: left half = virtual stick (move), right half taps = aim/attack
    c.addEventListener('touchstart', (e) => this.#touch(e, 'start'), { passive: false });
    c.addEventListener('touchmove', (e) => this.#touch(e, 'move'), { passive: false });
    c.addEventListener('touchend', (e) => this.#touch(e, 'end'), { passive: false });
    c.addEventListener('touchcancel', (e) => this.#touch(e, 'end'), { passive: false });
  }

  actionsFor(code) { const out = []; for (const [a, codes] of Object.entries(this.bindings)) if (codes.includes(code)) out.push(a); return out; }

  #touch(e, phase) {
    e.preventDefault();
    this.touchMode = true;
    const r = this.canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      const x = t.clientX - r.left, y = t.clientY - r.top;
      if (phase === 'start') {
        if (x < r.width * 0.5 && this.touch.stickId === null) { this.touch.stickId = t.identifier; this.touch.startX = x; this.touch.startY = y; this.touch.dx = this.touch.dz = 0; }
        else { this.mouse.x = x; this.mouse.y = y; this.hooks.onMouse?.(0, true, this.mouse); this.mouse.down[0] = true; this.touch.aimId = t.identifier; }
      } else if (phase === 'move') {
        if (t.identifier === this.touch.stickId) { const dx = (x - this.touch.startX) / 60, dy = (y - this.touch.startY) / 60; const l = Math.hypot(dx, dy); this.touch.dx = l > 1 ? dx / l : dx; this.touch.dz = l > 1 ? dy / l : dy; if (l < 0.18) { this.touch.dx = this.touch.dz = 0; } }
        else if (t.identifier === this.touch.aimId) { this.mouse.x = x; this.mouse.y = y; }
      } else {
        if (t.identifier === this.touch.stickId) { this.touch.stickId = null; this.touch.dx = this.touch.dz = 0; }
        if (t.identifier === this.touch.aimId) { this.mouse.down[0] = false; this.hooks.onMouse?.(0, false, this.mouse); this.touch.aimId = null; }
      }
    }
  }

  /** gamepad polling → this.pad + discrete actions (rising edge) */
  pollPad() {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) { this.pad.active = false; return; }
    const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    const ax = dz(gp.axes[0] ?? 0), az = dz(gp.axes[1] ?? 0), bx = dz(gp.axes[2] ?? 0), bz = dz(gp.axes[3] ?? 0);
    this.pad.active = !!(ax || az || bx || bz) || gp.buttons.some((b) => b.pressed);
    this.pad.ax = ax; this.pad.az = az; this.pad.bx = bx; this.pad.bz = bz;
    const MAP = { 0: 'dodge', 2: 'skill1', 3: 'skill2', 1: 'skill3', 5: 'skill4', 4: 'skill5', 7: 'primary', 6: 'listen', 9: 'pause', 8: 'map', 12: 'inventory', 13: 'talents', 14: 'quests', 15: 'voice' };
    this.padPrev ??= [];
    gp.buttons.forEach((b, i) => {
      const was = this.padPrev[i];
      const a = MAP[i];
      if (a && b.pressed !== was) { if (a === 'primary') this.pad.primary = b.pressed; else this.hooks.onAction?.(a, b.pressed, null); }
      this.padPrev[i] = b.pressed;
    });
  }

  get skillSlots() { return SKILL_SLOTS; }
}

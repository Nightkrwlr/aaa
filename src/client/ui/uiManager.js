import { h, Tooltip } from './dom.js';
import { logger } from '../../core/logger.js';
const log = logger('ui');

/**
 * UIManager — owns all DOM panels. A panel is a factory (game, ui) → {el, open(data), close(), update(dt), blocking}.
 * Blocking panels pause the simulation and capture input. Escape closes the top panel (or opens Pause).
 */
export class UIManager {
  constructor(game, root) {
    this.g = game; this.root = root; this.defs = new Map(); this.inst = new Map(); this.stack = [];
    this.layer = h('div', { id: 'panels' }); root.append(this.layer);
    this.tip = new Tooltip(root);
    this.focusBefore = null;
  }
  register(id, factory) { this.defs.set(id, factory); }
  #get(id) {
    let p = this.inst.get(id);
    if (!p) {
      const f = this.defs.get(id); if (!f) { log.warn(`no panel ${id}`); return null; }
      p = f(this.g, this); p.id = id; p.el.classList.add('panel', `p-${id}`, 'hidden'); p.el.setAttribute('role', 'dialog'); p.el.setAttribute('aria-label', id);
      this.layer.append(p.el); this.inst.set(id, p);
    }
    return p;
  }
  isOpen(id) { return this.stack.some((p) => p.id === id); }
  open(id, data) {
    const p = this.#get(id); if (!p) return null;
    if (this.isOpen(id)) { p.open?.(data); return p; }
    if (!this.stack.length) this.focusBefore = document.activeElement;
    this.stack.push(p); p.el.classList.remove('hidden'); p.el.style.zIndex = String(10 + this.stack.length);
    p.open?.(data);
    this.#dual();
    this.g.audio?.ui('open');
    queueMicrotask(() => { const f = p.el.querySelector('[autofocus], button:not(:disabled), input, select'); f?.focus?.({ preventScroll: true }); });
    return p;
  }
  close(id) {
    const i = this.stack.findIndex((p) => p.id === id); if (i < 0) return;
    const [p] = this.stack.splice(i, 1);
    p.el.classList.add('hidden'); p.close?.(); this.tip.hide();
    this.#dual();
    this.g.audio?.ui('close');
    if (!this.stack.length) { this.g.canvasFocus?.(); }
  }
  #dual() { document.body.classList.toggle('dual', this.isOpen('shop') || this.isOpen('stash')); }
  toggle(id, data) { this.isOpen(id) ? this.close(id) : this.open(id, data); }
  closeAll(except = []) { for (const p of [...this.stack]) if (!except.includes(p.id)) this.close(p.id); }
  get top() { return this.stack[this.stack.length - 1] ?? null; }
  get blocking() { return this.stack.some((p) => p.blocking !== false); }
  /** Escape: close the top panel that allows it, else open pause (only while playing) */
  escape() {
    const t = this.top;
    if (t) { if (t.noEscape) return true; this.close(t.id); return true; }
    return false;
  }
  update(dt) { for (const p of this.stack) p.update?.(dt); }
}

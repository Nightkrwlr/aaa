/** Tiny DOM helpers (no framework): h(), widgets (button, tabs, slider, toggle, select) with keyboard/aria support. */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) { if (c === null || c === undefined || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export function button(label, onClick, { cls = '', title, disabled = false, key } = {}) {
  const b = h('button', { class: `btn ${cls}`, type: 'button', title, disabled, onClick }, label);
  if (key) b.dataset.key = key;
  return b;
}

/** tabs: [{id,label}] → {bar, show(id)}; content switching is done by the caller through onChange */
export function tabs(items, onChange, initial = items[0]?.id) {
  const bar = h('div', { class: 'tabs', role: 'tablist' });
  const btns = new Map();
  const select = (id, fire = true) => { for (const [k, b] of btns) { b.classList.toggle('on', k === id); b.setAttribute('aria-selected', k === id ? 'true' : 'false'); } if (fire) onChange(id); };
  for (const it of items) { const b = h('button', { class: 'tab', type: 'button', role: 'tab', onClick: () => select(it.id) }, it.label); btns.set(it.id, b); bar.append(b); }
  select(initial, false);
  return { bar, select, current: () => [...btns].find(([, b]) => b.classList.contains('on'))?.[0] };
}

export function slider(label, value, { min = 0, max = 1, step = 0.05, fmt = (v) => `${Math.round(v * 100)}%`, onInput }) {
  const out = h('span', { class: 'sl-val' }, fmt(value));
  const inp = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  inp.addEventListener('input', () => { out.textContent = fmt(Number(inp.value)); onInput(Number(inp.value)); });
  return h('label', { class: 'row' }, h('span', { class: 'lbl' }, label), inp, out);
}
export function toggle(label, value, onChange, hint) {
  const inp = h('input', { type: 'checkbox' }); inp.checked = !!value;
  inp.addEventListener('change', () => onChange(inp.checked));
  return h('label', { class: 'row', title: hint }, h('span', { class: 'lbl' }, label), inp);
}
export function select(label, value, options, onChange) {
  const sel = h('select', { 'aria-label': label }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  sel.addEventListener('change', () => onChange(sel.value));
  return h('label', { class: 'row' }, h('span', { class: 'lbl' }, label), sel);
}

/** floating tooltip that follows the pointer and stays on-screen */
export class Tooltip {
  constructor(root) { this.el = h('div', { class: 'tooltip hidden', role: 'tooltip' }); root.append(this.el); this.x = 0; this.y = 0; window.addEventListener('mousemove', (e) => { this.x = e.clientX; this.y = e.clientY; if (!this.el.classList.contains('hidden')) this.#place(); }); }
  show(html) { this.el.innerHTML = html; this.el.classList.remove('hidden'); this.#place(); }
  hide() { this.el.classList.add('hidden'); }
  #place() {
    const r = this.el.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
    let x = this.x + 18, y = this.y + 14;
    if (x + r.width > W - 8) x = this.x - r.width - 18;
    if (y + r.height > H - 8) y = Math.max(8, H - r.height - 8);
    this.el.style.left = `${Math.max(8, x)}px`; this.el.style.top = `${y}px`;
  }
}
/** attach a tooltip to an element: fn() returns html (or null for none) */
export function bindTip(ui, el, fn) {
  el.addEventListener('mouseenter', () => { const html = fn(); if (html) ui.tip.show(html); });
  el.addEventListener('mouseleave', () => ui.tip.hide());
  el.addEventListener('focus', () => { const html = fn(); if (html) { const r = el.getBoundingClientRect(); ui.tip.x = r.right; ui.tip.y = r.top; ui.tip.show(html); } });
  el.addEventListener('blur', () => ui.tip.hide());
}

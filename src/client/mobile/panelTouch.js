/**
 * panelTouch — gives the desktop-style panels the three gestures a finger cannot produce natively:
 *   long-press            → `contextmenu` on release (right-click menus: item actions, sell, favourite…)   [iOS never fires it itself]
 *   double-tap            → `dblclick`   (equip / unequip / use)                                 [iOS fires it unreliably]
 *   press, hold and drag  → HTML5 drag-and-drop events on `draggable` elements (inventory swap, equip by drop…)
 *                           with a floating ghost under the finger and the same `dataTransfer` contract the panels use
 * Panels keep their plain DOM handlers (click / dblclick / contextmenu / dragstart / dragover / drop): nothing in them knows
 * a finger was involved. Only touch pointers inside `.panel` are affected; mouse and keyboard are untouched.
 *
 * Timing is judged with the *event* timestamps, never with timers alone: a janky frame (a phone under load, a software-GL
 * test machine) can delay a timer past a pointerup that is already queued, and a quick tap must never turn into a long press.
 */
const LONG_MS = 430, MOVE_PX = 10, TAP_MS = 350, DBL_MS = 320, DBL_PX = 26;

export function installPanelTouch({ isTouch = () => true } = {}) {
  let press = null, lastTap = null, swallowClickUntil = 0;

  const fire = (type, target, init = {}) => {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, ...init });
    target.dispatchEvent(e); return e;
  };
  const fakeDT = () => ({ data: {}, types: [], effectAllowed: 'all', dropEffect: 'move', files: [], items: [], setData(k, v) { this.data[k] = String(v); if (!this.types.includes(k)) this.types.push(k); }, getData(k) { return this.data[k] ?? ''; }, clearData() { this.data = {}; this.types = []; }, setDragImage() {} });
  const dragEvt = (type, target, dt, x, y) => { const e = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window }); Object.defineProperty(e, 'dataTransfer', { value: dt }); target.dispatchEvent(e); return e; };

  const cleanup = () => { if (!press) return; clearTimeout(press.timer); cancelAnimationFrame(press.raf); press.ghost?.remove(); press.undrag?.(); press = null; };

  const fireLong = (p) => { p.fired = true; fire('contextmenu', p.el, { clientX: p.x, clientY: p.y, button: 2 }); swallowClickUntil = performance.now() + 700; };

  const onDown = (e) => {
    if (e.pointerType !== 'touch' || !isTouch()) return;
    const el = e.target; if (!(el instanceof Element) || !el.closest('.panel') || el.closest('input, textarea, select, canvas, .tc')) return;
    cleanup();
    const draggable = el.closest('[draggable="true"]');
    const me = press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, el, draggable, armed: false, fired: false, up: false, dnd: null, moved: false, timer: 0, raf: 0 };
    // browsers start their own touch drag-and-drop on `draggable` elements after a long press (Chrome Android, iOS 15+):
    // two drags at once would double-fire dragstart/drop, so the native one is switched off for the length of the gesture
    if (draggable) { draggable.setAttribute('draggable', 'false'); me.undrag = () => draggable.setAttribute('draggable', 'true'); }
    me.timer = setTimeout(() => {
      // this callback can run late, after a pointerup that is already queued: rAF runs after the frame's input, so a tap wins
      me.raf = requestAnimationFrame(() => {
        if (press !== me || me.up || me.moved) return;
        me.armed = true; try { navigator.vibrate?.(8); } catch { /* ignore */ }   // armed: hold + move = drag; the menu itself fires on release (see onUp)
      });
    }, LONG_MS);
  };

  const startDnd = (e) => {
    const src = press.draggable; if (!src) return false;
    const dt = fakeDT(); const start = dragEvt('dragstart', src, dt, e.clientX, e.clientY);
    if (start.defaultPrevented && !Object.keys(dt.data).length) return false;
    const r = src.getBoundingClientRect(); const ghost = src.cloneNode(true);
    Object.assign(ghost.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', zIndex: '9999', pointerEvents: 'none', opacity: '.85', transform: 'scale(1.12)', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.7))' });
    document.body.append(ghost);
    press.dnd = { dt, src, under: null, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top }; press.ghost = ghost;
    src.classList.add('dragging');
    return true;
  };

  const onMove = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const travel = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    if (!press.dnd) {
      if (travel > MOVE_PX) {
        // armed by the timer, or held long enough by the event clock while the timer is still starved
        const held = e.timeStamp - press.t >= LONG_MS;
        if ((press.armed || held) && press.draggable && !press.fired) { press.armed = true; if (!startDnd(e)) { press.moved = true; clearTimeout(press.timer); } }
        else { press.moved = true; clearTimeout(press.timer); }
      }
      if (!press?.dnd) return;
    }
    const d = press.dnd;
    d.ghost.style.left = `${e.clientX - d.dx}px`; d.ghost.style.top = `${e.clientY - d.dy}px`;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (under !== d.under) { if (d.under) dragEvt('dragleave', d.under, d.dt, e.clientX, e.clientY); d.under = under; if (under) dragEvt('dragenter', under, d.dt, e.clientX, e.clientY); }
    if (under) dragEvt('dragover', under, d.dt, e.clientX, e.clientY);
  };

  const onUp = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press, cancelled = e.type === 'pointercancel';
    p.up = true; clearTimeout(p.timer); cancelAnimationFrame(p.raf);
    const held = e.timeStamp - p.t;
    if (p.dnd) {
      const d = p.dnd;
      if (!cancelled && d.under) dragEvt('drop', d.under, d.dt, e.clientX, e.clientY);
      dragEvt('dragend', d.src, d.dt, e.clientX, e.clientY); d.src.classList.remove('dragging');
      swallowClickUntil = performance.now() + 500; cleanup(); return;
    }
    if (!cancelled && !p.moved && !p.fired && held >= LONG_MS) {
      // a real long press: draggable items open their menu on release; for the rest it covers a starved timer
      fireLong(p);
    } else if (!cancelled && !p.moved && !p.fired && held < TAP_MS) {
      // quick tap: remember it, and turn a second tap on the same control into a dblclick
      const now = e.timeStamp, tgt = p.el.closest('button, .tile, .cell, .row, li, [role="button"], a') ?? p.el;
      if (lastTap && now - lastTap.t < DBL_MS && lastTap.el === tgt && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DBL_PX) { setTimeout(() => fire('dblclick', tgt, { clientX: e.clientX, clientY: e.clientY, detail: 2 }), 0); lastTap = null; }
      else lastTap = { t: now, el: tgt, x: e.clientX, y: e.clientY };
    }
    cleanup();
  };

  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', onUp, true);
  // a long-press / drop must not also count as a click on whatever is under the finger afterwards
  document.addEventListener('click', (e) => { if (performance.now() < swallowClickUntil && e.isTrusted) { e.stopPropagation(); e.preventDefault(); } }, true);
  // once a drag is armed, the page must not scroll under the finger
  document.addEventListener('touchmove', (e) => { if (press && (press.dnd || (press.armed && press.draggable))) e.preventDefault(); }, { passive: false, capture: true });
  // native iOS callout/selection must not fight the gesture
  document.addEventListener('selectstart', (e) => { if (press?.armed || press?.dnd) e.preventDefault(); });
  return { cancel: cleanup };
}

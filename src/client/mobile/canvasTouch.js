/**
 * canvasTouch — panels built around a <canvas> (talent tree, map…) were written for a mouse: they pan with mousedown/mousemove,
 * zoom with the wheel and click on mouseup. A finger drag produces none of those, so this bridges touch pointers that land on
 * such a canvas into the mouse events the panel already understands (the panel's own code stays untouched):
 *
 *   one-finger drag    → mousedown (at the start point) + mousemove… + mouseup            (pan)
 *   quick tap          → mousemove (hover/tooltip) then mousedown + mouseup               (click)
 *   long press         → mousedown/mouseup with button 2 + contextmenu, on release        (secondary action: refund, waypoint…)
 *   two-finger pinch   → wheel events at the midpoint (one notch per ~14 px) while the midpoint's movement pans
 *
 * Panels listed in CONFIRM spend a resource on click (talent points): there a first tap only *inspects* (hover → tooltip) and a
 * second tap on the same spot within 4 s confirms, so a stray finger never spends points.
 * The game canvas (#gl) is excluded: the touch controls own it.
 */
const LONG_MS = 450, MOVE_PX = 8, NOTCH_PX = 14, CONFIRM_MS = 4000, CONFIRM_PX = 28;
const CONFIRM = ['.p-talents'];

export function installCanvasTouch({ isTouch = () => true } = {}) {
  const ptrs = new Map();                                   // pointerId → {x, y}
  let cv = null, down = false, moved = false, longFired = false, long = 0, t0 = 0, start = null, pinch = null, acc = 0, lastTap = null, spent = false, swallowClick = false;

  const mouse = (type, target, x, y, extra = {}) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: type === 'mouseup' ? 0 : 1, ...extra }));
  const wheel = (dy, x, y) => cv.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, deltaY: dy, deltaMode: 0 }));
  const mid = () => { const [a, b] = [...ptrs.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
  const confirmMode = () => CONFIRM.some((s) => cv?.closest(s));
  const reset = () => { clearTimeout(long); cv = null; down = false; moved = false; longFired = false; start = null; pinch = null; acc = 0; spent = false; ptrs.clear(); };
  const fireLong = () => {
    longFired = true;
    mouse('mousemove', cv, start.x, start.y, { buttons: 0 });
    mouse('mousedown', cv, start.x, start.y, { button: 2, buttons: 2 }); mouse('mouseup', window, start.x, start.y, { button: 2, buttons: 0 });
    mouse('contextmenu', cv, start.x, start.y, { button: 2, buttons: 2 });
  };
  const press = (x, y) => { if (!down) { mouse('mousedown', cv, x, y); down = true; } };
  const release = (x, y) => { if (down) { mouse('mouseup', window, x, y); down = false; } };

  const onDown = (e) => {
    if (e.pointerType !== 'touch' || !isTouch()) return;
    const c = e.target;
    if (!(c instanceof HTMLCanvasElement) || c.id === 'gl' || !c.closest('.panel')) return;
    e.preventDefault();                                     // no compatibility mouse events: this bridge is the only source
    try { c.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      cv = c; moved = false; longFired = false; spent = false; t0 = e.timeStamp; start = { x: e.clientX, y: e.clientY };
      const me = start;
      // the secondary action fires on RELEASE, judged by the event clock: a timer can run before a queued pointerup/move is delivered
      // (busy frame), which would turn a tap or a drag into a long press. The timer only gives the haptic tick.
      long = setTimeout(() => { if (cv && start === me && !moved && ptrs.size === 1) { try { navigator.vibrate?.(8); } catch { /* ignore */ } } }, LONG_MS);
    } else if (ptrs.size === 2 && cv) {
      clearTimeout(long); moved = true;
      const m = mid(); pinch = { d: m.d }; acc = 0;
      press(m.x, m.y);                                      // the midpoint pans through the panel's own drag handling
    }
  };

  const onMove = (e) => {
    const p = ptrs.get(e.pointerId); if (!p || !cv) return;
    p.x = e.clientX; p.y = e.clientY;
    if (spent) return;                                      // the finger left over after a pinch only waits to be lifted
    if (ptrs.size >= 2 && pinch) {
      const m = mid();
      acc += m.d - pinch.d; pinch.d = m.d;
      while (acc > NOTCH_PX) { wheel(-1, m.x, m.y); acc -= NOTCH_PX; }     // fingers apart → zoom in
      while (acc < -NOTCH_PX) { wheel(1, m.x, m.y); acc += NOTCH_PX; }
      mouse('mousemove', cv, m.x, m.y);
      return;
    }
    if (longFired) return;
    if (!moved && Math.hypot(p.x - start.x, p.y - start.y) > MOVE_PX) { moved = true; clearTimeout(long); press(start.x, start.y); }
    if (moved) mouse('mousemove', cv, p.x, p.y);
  };

  const onUp = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const cancelled = e.type === 'pointercancel', p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size > 0) { pinch = null; spent = true; release(-9999, -9999); return; }   // a finger left after a pinch: end the drag cleanly (no jump, no click)
    clearTimeout(long);
    if (cv && !down && !moved && !longFired && !cancelled && e.timeStamp - t0 >= LONG_MS) fireLong();   // a real long press whose timer was starved
    else if (cv && down) {
      // end of a drag or of a pinch: park the pointer outside the canvas so the panel's mouseup never counts as a click
      release(-9999, -9999);
    } else if (cv && !moved && !longFired && !cancelled) {
      const x = p.x, y = p.y;
      mouse('mousemove', cv, x, y, { buttons: 0 });
      const again = lastTap && e.timeStamp - lastTap.t < CONFIRM_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < CONFIRM_PX && lastTap.cv === cv;
      if (!confirmMode() || again) { mouse('mousedown', cv, x, y); mouse('mouseup', window, x, y); lastTap = null; }
      else { lastTap = { t: e.timeStamp, x, y, cv }; swallowClick = true; }   // inspect only: the browser's own click after this tap must not reach a click-based panel
    }
    reset();
  };

  document.addEventListener('click', (e) => { if (swallowClick && e.isTrusted) { e.stopImmediatePropagation(); e.preventDefault(); } swallowClick = false; }, true);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', onUp, true);
  return { cancel: reset };
}

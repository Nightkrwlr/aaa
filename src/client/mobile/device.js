/**
 * Device — what are we running on? Drives the `html` classes that the touch CSS keys off, and the input-mode switch
 * (touch ⇄ mouse) so hybrid laptops get the right controls for whatever the player is using right now.
 *
 *   html.touch      touch controls are active (phones, tablets, or a laptop whose player just touched the screen)
 *   html.phone      shortest screen side < 600 css px        html.tablet  otherwise, when touch
 *   html.ios / html.android / html.standalone (installed PWA) / html.portrait / html.landscape
 *
 * Settings can force the mode: settings.touchControls = 'auto' | 'on' | 'off'.
 */
const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : { matches: false, addEventListener() {} });

export const Device = {
  coarse: mq('(pointer: coarse)').matches,
  anyFine: mq('(any-pointer: fine)').matches,
  touchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0,
  ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  get ios() { return /iPad|iPhone|iPod/.test(this.ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && this.touchPoints > 1); },
  get android() { return /Android/i.test(this.ua); },
  get standalone() { return mq('(display-mode: standalone)').matches || mq('(display-mode: fullscreen)').matches || (typeof navigator !== 'undefined' && navigator.standalone === true); },
  get mobileUA() { return /Android|iPhone|iPad|iPod|Mobile/i.test(this.ua) || (this.ios); },
  /** true when the primary input is a finger */
  get touchFirst() { return this.coarse || (this.mobileUA && this.touchPoints > 0); },
  /** shortest side of the visual viewport in css px */
  get shortSide() { const vv = window.visualViewport; return Math.min(vv?.width ?? innerWidth, vv?.height ?? innerHeight); },
  get portrait() { return innerHeight > innerWidth; },
  get phone() { return Math.min(screen.width, screen.height) < 600 || this.shortSide < 600; },
  /** rough performance class used for first-run quality defaults */
  perfClass() {
    const cores = navigator.hardwareConcurrency ?? 4, mem = navigator.deviceMemory ?? (this.ios ? 4 : 4);
    if (!this.mobileUA && !this.coarse) return cores >= 8 ? 'high' : 'medium';
    if (this.ios) return mem >= 4 && cores >= 6 ? 'medium' : 'low';
    return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  },
};

/**
 * Keeps the html classes in sync and fires onMode('touch'|'mouse') when the player switches device.
 * @returns {{mode:()=>string, force:(m:'auto'|'on'|'off')=>void, destroy:()=>void}}
 */
export function watchDevice({ force = 'auto', onMode = null } = {}) {
  const root = document.documentElement;
  let mode = (force === 'on' || (force === 'auto' && Device.touchFirst)) ? 'touch' : 'mouse';
  let forced = force;
  let lastTouch = 0;
  const apply = () => {
    root.classList.toggle('touch', mode === 'touch');
    root.classList.toggle('phone', mode === 'touch' && Device.phone);
    root.classList.toggle('tablet', mode === 'touch' && !Device.phone);
    root.classList.toggle('ios', Device.ios); root.classList.toggle('android', Device.android);
    root.classList.toggle('standalone', Device.standalone);
    const portrait = Device.portrait;
    root.classList.toggle('portrait', portrait); root.classList.toggle('landscape', !portrait);
    root.style.setProperty('--vh', `${(window.visualViewport?.height ?? innerHeight) * 0.01}px`);
  };
  const set = (m) => { if (m === mode) return; mode = m; apply(); onMode?.(m); };
  const onTouch = () => { lastTouch = performance.now(); if (forced === 'auto') set('touch'); };
  const onMouse = (e) => {
    // browsers synthesise mouse events after a touch: ignore those, only a real pointer move switches back
    if (forced !== 'auto' || performance.now() - lastTouch < 800) return;
    if (e.pointerType === 'mouse' || e.type === 'mousemove') { if ((e.movementX || e.movementY) && Device.anyFine) set('mouse'); }
  };
  window.addEventListener('touchstart', onTouch, { passive: true, capture: true });
  window.addEventListener('mousemove', onMouse, { passive: true });
  const onResize = () => apply();
  window.addEventListener('resize', onResize); window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  apply(); onMode?.(mode);
  return {
    mode: () => mode,
    force(m) { forced = m; if (m === 'on') set('touch'); else if (m === 'off') set('mouse'); else set(Device.touchFirst ? 'touch' : 'mouse'); },
    destroy() { window.removeEventListener('touchstart', onTouch, true); window.removeEventListener('mousemove', onMouse); window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); },
  };
}

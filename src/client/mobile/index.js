import './mobile.css';
import { Device, watchDevice } from './device.js';
import { TouchControls } from './touchControls.js';
import { mobileMenu, touchSettings } from './mobileMenu.js';
import { installLifecycle } from './lifecycle.js';
import { PerfGovernor, mobileDefaults } from './perf.js';
import { installPanelTouch } from './panelTouch.js';
import { installCanvasTouch } from './canvasTouch.js';

/**
 * initMobile — wires the whole phone/tablet layer into a booted Game without the game knowing about it:
 *   device mode (touch ⇄ mouse) → on-screen controls, html classes, menu panels, lifecycle (save/pause/wake lock/audio
 *   unlock/back button/context loss), adaptive performance. Desktop players are untouched: nothing here activates unless
 *   the device (or the player's setting) asks for touch.
 */
export function initMobile(game) {
  const S = game.settings;
  if (mobileDefaults(S, { keepQuality: new URLSearchParams(location.search).has('quality') })) game.applySettings(); // ?quality= (QA) wins over the device's preset

  const controls = new TouchControls(game);
  const perf = new PerfGovernor(game);
  const device = watchDevice({
    force: S.touchControls ?? 'auto',
    onMode: (m) => { controls.setEnabled(m === 'touch'); if (m === 'touch') perf.start(); else { perf.stop(); perf.level = 0; perf.apply(); } },
  });
  game.ui.register('mmenu', mobileMenu);
  game.ui.register('mset', touchSettings);
  const lifecycle = installLifecycle(game, { isTouch: () => device.mode() === 'touch' });
  // desktop-style panels keep their click / dblclick / contextmenu / drag handlers: a finger gets all three through this layer
  const panelTouch = installPanelTouch({ isTouch: () => device.mode() === 'touch' });
  // canvases inside panels (talent tree, map) were written for a mouse: finger drag = pan, pinch = zoom, long press = right click
  const canvasTouch = installCanvasTouch({ isTouch: () => device.mode() === 'touch' });

  // a settings change anywhere (desktop panel, touch panel) re-syncs the mobile layer
  const orig = game.applySettings.bind(game);
  game.applySettings = (...a) => { orig(...a); try { device.force(S.touchControls ?? 'auto'); perf.onSettings(); controls.sig = ''; } catch (e) { console.error('[mobile]', e); } };

  // orientation changes settle late on some browsers: nudge a resize once the new size is real
  const nudge = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
  window.addEventListener('orientationchange', nudge);
  window.visualViewport?.addEventListener('resize', nudge);

  const api = { device, controls, perf, lifecycle, panelTouch, canvasTouch, Device };
  game.mobile = api;
  return api;
}

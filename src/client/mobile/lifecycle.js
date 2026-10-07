import { t } from '../../core/i18n.js';
import { Device } from './device.js';
import { logger } from '../../core/logger.js';

const log = logger('mobile');

/**
 * Lifecycle — everything a phone does to a web game that a desktop never does:
 *  • the tab is frozen or killed when the player switches app, takes a call or pulls the shade → save + pause
 *  • iOS/Android block audio until a gesture; iOS also mutes WebAudio on the silent switch
 *  • the screen sleeps mid-fight unless we ask it not to; the browser's back button would leave the game
 *  • the GPU context can be lost while backgrounded; the page must not scroll, bounce, zoom or select text
 *  • storage can be evicted (iOS Safari clears site data after ~7 days of non-use unless installed): ask for persistence
 */

let wakeLock = null;

export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export async function toggleFullscreen() {
  const d = document, root = d.documentElement;
  try {
    if (isFullscreen()) { await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.()); screen.orientation?.unlock?.(); }
    else { await (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.()); try { await screen.orientation?.lock?.('landscape'); } catch { /* not supported / not allowed */ } }
  } catch (e) { log.warn('fullscreen failed', e); }
}

/** small dismissible banner at the bottom of the screen */
export function showHint(html, { actions = [], ttl = 0, id = null } = {}) {
  document.querySelectorAll(`.mob-hint${id ? `[data-id="${id}"]` : ''}`).forEach((n) => n.remove());
  const d = document.createElement('div'); d.className = 'mob-hint'; if (id) d.dataset.id = id; d.setAttribute('role', 'status');
  d.innerHTML = `<div>${html}</div>`;
  const close = () => d.remove();
  for (const [label, fn] of actions) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => { try { fn?.(); } finally { close(); } }; d.append(b); }
  document.body.append(d); if (ttl) setTimeout(close, ttl);
  return close;
}

const seen = (k) => { try { return localStorage.getItem(`sdc.hint.${k}`) === '1'; } catch { return false; } };
const mark = (k) => { try { localStorage.setItem(`sdc.hint.${k}`, '1'); } catch { /* private mode */ } };

/** @param {import('../game.js').Game} game */
export function installLifecycle(game, { isTouch = () => Device.touchFirst } = {}) {
  const gl = document.getElementById('gl');
  let hiddenAt = 0, installEvent = null;

  // ── screen stays on while playing
  const acquire = async () => {
    if (!('wakeLock' in navigator) || wakeLock || document.hidden || game.state !== 'playing') return;
    try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch { /* denied / unsupported */ }
  };

  // ── background / foreground: save, pause, and never kill a hero while the player is on a phone call
  const onHidden = () => { hiddenAt = performance.now(); try { if (game.session && !game.session.dead) game.autosaver?.request('hidden', true); } catch (e) { log.warn('save on hide failed', e); } };
  const onShown = () => {
    const away = performance.now() - hiddenAt; hiddenAt = 0;
    acquire();
    if (game.audio?.ctx?.state === 'suspended') game.audio.resume();
    if (isTouch() && away > 1200 && game.state === 'playing' && game.session && !game.ui.blocking) game.ui.open('pause');
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? onHidden() : onShown()));
  window.addEventListener('pagehide', onHidden);          // iOS Safari: the reliable "page is going away" signal
  window.addEventListener('pageshow', (e) => { if (e.persisted) onShown(); });

  // ── audio unlock (must happen inside a user gesture; touchend/pointerup count on iOS, touchstart does not)
  const unlock = () => {
    game.audio?.resume?.();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* old browsers */ } // iOS 17+: audible even on the silent switch
    if (game.audio?.ctx?.state === 'running') for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) window.removeEventListener(ev, unlock, true);
    acquire(); requestPersist();
  };
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, unlock, true);

  // ── gestures that would fight the game
  const stop = (e) => e.preventDefault();
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
  document.addEventListener('dblclick', (e) => { if (isTouch() && !e.target.closest?.('input, textarea')) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (isTouch() && e.touches.length > 1 && !e.target.closest?.('.panel')) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (isTouch() && !e.target.closest?.('input, textarea')) e.preventDefault(); });

  // ── back button / back gesture opens the pause menu instead of leaving the game
  let armed = false;
  const arm = () => { if (armed || !isTouch()) return; armed = true; try { history.pushState({ sdc: 1 }, ''); } catch { /* ignore */ } };
  window.addEventListener('popstate', () => {
    if (!armed) return;
    if (game.state === 'playing' && game.session) { if (!game.ui.escape()) game.ui.open('pause'); try { history.pushState({ sdc: 1 }, ''); } catch { /* ignore */ } }
    else armed = false;
  });
  window.addEventListener('pointerdown', arm, { once: true, capture: true });

  // ── GPU context lost (three.js restores itself; we tell the player and keep the sim paused meanwhile)
  let lostEl = null;
  gl?.addEventListener('webglcontextlost', () => {
    log.warn('webgl context lost');
    if (game.state === 'playing' && game.session && !game.ui.blocking) game.ui.open('pause');
    lostEl ??= Object.assign(document.createElement('div'), { className: 'mob-resume', textContent: t('hint.gl_lost') }); document.body.append(lostEl);
  });
  gl?.addEventListener('webglcontextrestored', () => { log.info('webgl context restored'); lostEl?.remove(); lostEl = null; try { game.scene3d.applyQuality(); game.scene3d.resize(); } catch (e) { log.warn('restore failed', e); } });

  // ── storage persistence (survives low-disk eviction; does not stop iOS' 7-day rule unless installed)
  const requestPersist = async () => { try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* ignore */ } };

  // ── install: Chrome hands us an install prompt we keep for the ☰ menu card; nothing pops up in the middle of a fight
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
  window.addEventListener('appinstalled', () => { installEvent = null; mark('install'); });
  // first time on a portrait phone: suggest landscape once, small and non-blocking
  setTimeout(() => { if (isTouch() && Device.portrait && Device.phone && !seen('rotate') && game.state === 'playing') { mark('rotate'); showHint(t('hint.rotate'), { ttl: 8000, id: 'rotate' }); } }, 12000);

  return { acquireWakeLock: acquire, requestPersist, get installEvent() { return installEvent; } };
}

import { t } from '../../core/i18n.js';
import { toggleFullscreen, isFullscreen } from './lifecycle.js';

/**
 * Two small touch-first panels registered into the UIManager:
 *   mmenu  the ☰ menu: big tiles for every game screen (bag, skills, talents, quests, map, codex, forge, settings, pause)
 *   mset   touch settings: controls mode/scheme, size, opacity, left-handed, listen toggle, aim line, vibration, performance
 * Plain DOM (no dependency on the desktop panel helpers) so they keep working however the desktop UI evolves.
 */

const ICONS = {
  inventory: '<path d="M12 18h24l3 22H9z"/><path d="M18 18c0-9 12-9 12 0"/>',
  talents: '<circle cx="24" cy="10" r="4"/><circle cx="10" cy="35" r="4"/><circle cx="24" cy="35" r="4"/><circle cx="38" cy="35" r="4"/><path d="M24 14v17M24 21L10 31M24 21l14 10"/>',
  skills: '<path d="M27 5L13 26h9l-3 17 15-23h-9z"/>',
  quests: '<path d="M12 8h20a4 4 0 0 1 4 4v24a4 4 0 0 0 4 4H16a4 4 0 0 1-4-4z"/><path d="M18 18h14M18 25h14M18 32h9"/>',
  map: '<path d="M6 12l12-4 12 4 12-4v28l-12 4-12-4-12 4z"/><path d="M18 8v28M30 12v28"/>',
  codex: '<path d="M8 10h14a4 4 0 0 1 4 4v24a4 4 0 0 0-4-4H8zM40 10H26v28a4 4 0 0 1 4-4h10z"/>',
  craft: '<path d="M8 15h28c0 6-6 9-10 9v6h6v6H14v-6h6v-6c-4 0-12-3-12-9z"/>',
  settings: '<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>',
  pause: '<path d="M16 10v28M32 10v28" stroke-width="5"/>',
  touch: '<path d="M18 30V13a3 3 0 0 1 6 0v10l10 2a4 4 0 0 1 3 4v6c0 6-4 9-10 9h-3c-5 0-7-3-9-7l-5-9a3 3 0 0 1 5-3z"/>',
  fullscreen: '<path d="M8 18V8h10M30 8h10v10M40 30v10H30M18 40H8V30"/>',
  close: '<path d="M12 12l24 24M36 12L12 36"/>',
};
const svg = (k) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
const div = (cls, html = '') => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; return d; };

export function mobileMenu(game, ui) {
  const el = div('mmenu');
  const tiles = [['inventory', 'inventory'], ['skills', 'skills'], ['talents', 'talents'], ['quests', 'quests'], ['map', 'map'], ['codex', 'codex'], ['craft', 'craft'], ['settings', 'settings']];
  const go = (panel) => { ui.close('mmenu'); ui.open(panel, panel === 'craft' ? { station: null } : undefined); };
  const render = () => {
    el.innerHTML = '';
    const head = div('', `<h2><span>${t('mm.title')}</span><button type="button" class="x" aria-label="${t('mm.close')}">✕</button></h2>`);
    head.querySelector('.x').onclick = () => ui.close('mmenu');
    const grid = div('mm-grid');
    for (const [key, panel] of tiles) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mm-tile';
      b.innerHTML = `${svg(key)}<span>${t(`mm.${key}`)}</span>`;
      if (key === 'talents') { const pts = game.character?.talentPoints?.() ?? 0; if (pts > 0) b.insertAdjacentHTML('beforeend', `<span class="mm-badge">${pts}</span>`); }
      b.onclick = () => go(panel);
      grid.append(b);
    }
    const row = div('mm-row');
    const mk = (key, label, fn, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.onclick = fn; row.append(b); return b; };
    mk('pause', t('mm.pause'), () => { ui.close('mmenu'); ui.open('pause'); });
    mk('touch', t('mm.touch'), () => { ui.close('mmenu'); ui.open('mset'); });
    if (document.fullscreenEnabled || document.webkitFullscreenEnabled) mk('fs', isFullscreen() ? t('mm.exit_fullscreen') : t('mm.fullscreen'), () => { toggleFullscreen(); ui.close('mmenu'); });
    el.append(head, grid, row);
  };
  return { el, blocking: true, open: render, close() {} };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function touchSettings(game, ui) {
  const el = div('mset');
  const S = () => game.settings;
  const set = (k, v) => { S()[k] = v; game.applySettings(); };
  const row = (label, hint, control) => { const r = div('ms-row', `<div><label>${label}</label>${hint ? `<small>${hint}</small>` : ''}</div>`); r.append(control); return r; };
  const sw = (key, def = false) => { const b = document.createElement('button'); b.type = 'button'; b.className = `ms-sw ${(S()[key] ?? def) ? 'on' : ''}`; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(!!(S()[key] ?? def))); b.onclick = () => { const v = !(S()[key] ?? def); set(key, v); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); }; return b; };
  const range = (key, min, max, step, def) => { const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = S()[key] ?? def; i.oninput = () => set(key, clamp(parseFloat(i.value), min, max)); return i; };
  const select = (key, opts, def) => { const s = document.createElement('select'); for (const [v, l] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = l; s.append(o); } s.value = S()[key] ?? def; s.onchange = () => set(key, s.value); return s; };
  const render = () => {
    el.innerHTML = '';
    const head = div('', `<h2><span>${t('ts.title')}</span><button type="button" class="x" aria-label="${t('mm.close')}">✕</button></h2>`);
    head.querySelector('.x').onclick = () => ui.close('mset');
    el.append(head,
      row(t('ts.mode'), '', select('touchControls', [['auto', t('ts.mode_auto')], ['on', t('ts.mode_on')], ['off', t('ts.mode_off')]], 'auto')),
      row(t('ts.scheme'), '', select('touchScheme', [['stick', t('ts.scheme_stick')], ['tap', t('ts.scheme_tap')]], 'stick')),
      row(t('ts.size'), '', range('touchScale', 0.8, 1.35, 0.05, 1)),
      row(t('ts.opacity'), '', range('touchOpacity', 0.4, 1, 0.05, 0.9)),
      row(t('ts.lefty'), t('ts.lefty_hint'), sw('leftHanded', false)),
      row(t('ts.listen_toggle'), t('ts.listen_toggle_hint'), sw('listenToggle', true)),
      row(t('ts.aimline'), '', sw('showAimLine', true)),
      row(t('ts.haptics'), '', range('vibration', 0, 1, 0.1, 1)),
      row(t('ts.perf'), '', select('perfMode', [['auto', t('ts.perf_auto')], ['saver', t('ts.perf_saver')], ['smooth', t('ts.perf_smooth')]], 'auto')),
      row(t('ts.res'), '', range('renderScale', 0.5, 1, 0.05, 1)),
    );
  };
  return { el, blocking: true, open: render, close() {} };
}

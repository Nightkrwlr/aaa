import { logger } from '../core/logger.js';
const log = logger('settings');
const KEY = 'sunderchoir.settings.v1';

export const DEFAULTS = {
  version: 1,
  language: 'es', quality: 'high', renderScale: 1, vsync: true, fpsCap: 0,
  uiScale: 1, textScale: 1, colorblind: 'none', highContrast: false, reduceFlashes: false, subtitles: true,
  screenShake: 1, vibration: 1, hitStop: true, damageNumbers: true, occlusionFade: true,
  volMaster: 0.8, volMusic: 0.6, volSfx: 0.8, volUi: 0.7, volAmbient: 0.7,
  scheme: 'click', bindings: {}, aimAssist: 0.35, autoPickupMaterials: true, lootFilter: 'normal',
  puzzleHints: true, hudTracker: true, hudScale: 1, cameraZoom: 32, difficulty: 'seeker', telemetry: false,
  showFps: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { log.warn('could not read settings', e); }
  return { ...DEFAULTS };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { log.warn('could not save settings', e); }
}

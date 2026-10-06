import { Device } from './device.js';
import { logger } from '../../core/logger.js';

const log = logger('perf');
const PRESETS = ['low', 'medium', 'high', 'ultra'];

/**
 * PerfGovernor — keeps a phone playable without the player touching a setting.
 *
 * It watches real frame times and walks a quality ladder down when the device cannot keep up, and (carefully, with
 * probation) back up when there is headroom. The player's chosen settings are never overwritten: the governor works on top
 * of them (base quality + render scale) and the saved values stay what the player picked.
 *
 *   ladder 0: as chosen           1: render scale ×0.85      2: one preset lower      3: render scale ×0.7
 *          4: lowest preset       5: render scale ×0.55      6: + 30 fps cap
 *
 * perfMode: 'auto' (target ~45 fps) | 'saver' (30 fps cap, battery friendly) | 'smooth' (aim for 60)
 */
export class PerfGovernor {
  constructor(game) {
    this.g = game; this.level = 0; this.samples = []; this.t0 = 0; this.lastChange = 0; this.badUntil = 0; this.lastUp = -1e9;
    this.maxLevel = 6; this.timer = 0; this.last = 0; this.enabled = true;
  }

  get S() { return this.g.settings; }
  get mode() { return this.S.perfMode ?? 'auto'; }
  get target() { return this.mode === 'saver' ? 30 : this.mode === 'smooth' ? 58 : 46; }

  start() {
    if (this.running) return; this.running = true;
    const tick = (now) => {
      if (!this.running) return;
      if (this.last) this.#sample(now - this.last, now);
      this.last = now; requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    this.apply();
  }
  stop() { this.running = false; }

  /** apply the current ladder level on top of the player's chosen settings */
  apply() {
    const g = this.g, S = this.S, sc = g.scene3d; if (!sc) return;
    const baseQ = Math.max(0, PRESETS.indexOf(S.quality ?? 'high')), baseScale = S.renderScale ?? 1;
    let q = baseQ, scale = baseScale, cap = this.mode === 'saver' ? 30 : (S.fpsCap || 0);
    const L = this.level;
    if (L >= 1) scale *= 0.85;
    if (L >= 2) q = Math.max(0, baseQ - 1);
    if (L >= 3) scale = baseScale * 0.7;
    if (L >= 4) q = 0;
    if (L >= 5) scale = baseScale * 0.55;
    if (L >= 6) cap = 30;
    // push into the renderer without persisting: swap, apply, restore
    const keep = { quality: S.quality, renderScale: S.renderScale };
    S.quality = PRESETS[q]; S.renderScale = Math.max(0.4, scale);
    try { sc.applyQuality(); this.g.vfx && (this.g.vfx.q = sc.q); this.g.vfx?.particles && (this.g.vfx.particles.density = sc.q.particles); sc.resize?.(); } finally { S.quality = keep.quality; S.renderScale = keep.renderScale; }
    g.fpsCap = cap || 0;
  }

  /** the player changed settings (or the mode): re-base and re-apply */
  onSettings() { this.apply(); }

  #sample(dtMs, now) {
    const g = this.g;
    if (document.hidden || g.fixedDt || g.state !== 'playing' || g.rebuilding || g.fade > 0.05) { this.samples.length = 0; this.t0 = 0; return; }
    if (dtMs > 500) return;                       // a stall (tab switch, GC) is not a measurement
    this.samples.push(dtMs); if (this.samples.length > 600) this.samples.shift();
    this.timer += dtMs; if (this.timer < 1000) return; this.timer = 0;
    // average over the last ~3 s
    let sum = 0, n = 0; for (let i = this.samples.length - 1; i >= 0 && sum < 3000; i--) { sum += this.samples[i]; n++; }
    if (sum < 2800) return;
    const fps = n / (sum / 1000);
    this.fpsNow = fps;
    const cappedAt = g.fpsCap || 60;
    const tgt = Math.min(this.target, cappedAt * 0.95);
    if (fps < tgt * 0.82 && this.level < this.maxLevel && now - this.lastChange > 4000) {
      this.level++; this.lastChange = now; this.samples.length = 0;
      if (now - this.lastUp < 20000) this.badUntil = now + 120000;   // we just went up and it did not hold: stop trying for a while
      log.info(`fps ${fps.toFixed(0)} < ${tgt.toFixed(0)}: quality ladder → ${this.level}`);
      this.apply();
    } else if (fps >= Math.min(58, cappedAt * 0.97) && this.level > 0 && now - this.lastChange > 12000 && now > this.badUntil) {
      this.level--; this.lastChange = now; this.lastUp = now; this.samples.length = 0;
      log.info(`fps ${fps.toFixed(0)}: headroom, quality ladder → ${this.level}`);
      this.apply();
    }
  }
}

/** first-run defaults for phones: pick a sensible preset by device class so the very first frame is already smooth */
export function mobileDefaults(settings) {
  if (settings.perfInit) return false;
  settings.perfInit = true;
  if (Device.touchFirst) {
    settings.quality = Device.perfClass();
    settings.renderScale = 1;
    settings.touchControls = 'auto';
    settings.uiScale = Device.phone ? 1 : 1;
  }
  return true;
}

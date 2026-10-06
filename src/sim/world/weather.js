import { Rng } from '../../core/rng.js';

/** Weather cycle per zone: calm / mist / windstorm. Affects gathering (conditions), AI perception and projectiles. */
export const WEATHER_EFFECTS = {
  calm: { aggro: 1, wind: 0, fog: 1 },
  mist: { aggro: 0.7, wind: 0, fog: 2.4 },
  windstorm: { aggro: 1, wind: 3.2, fog: 1.3 },
};

export class Weather {
  constructor(session, cfg, seed) {
    this.s = session; this.cfg = cfg ?? { pool: ['calm'], minSeconds: 240, maxSeconds: 480 };
    this.rng = new Rng(`${seed}:weather`);
    this.current = 'calm'; this.t = 0; this.until = this.#duration();
    this.dir = this.rng.range(0, Math.PI * 2);
    this.forced = null;
  }
  #duration() { return this.rng.range(this.cfg.minSeconds, this.cfg.maxSeconds); }

  force(type, seconds) { this.#set(type); this.forced = { until: this.t + seconds }; this.until = this.t + seconds; }

  #set(type) {
    this.current = type; this.t = 0;
    const fx = WEATHER_EFFECTS[type];
    const w = this.s.world;
    if (w) w.wind = fx.wind ? { x: Math.sin(this.dir) * fx.wind, z: Math.cos(this.dir) * fx.wind } : null;
    this.s.events.emit('weather', { type });
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.until) {
      this.forced = null;
      let next = this.rng.pick(this.cfg.pool);
      if (next === this.current && this.rng.chance(0.5)) next = this.rng.pick(this.cfg.pool);
      this.dir = this.rng.range(0, Math.PI * 2);
      this.#set(next);
      this.until = this.#duration();
    }
  }
  fx() { return WEATHER_EFFECTS[this.current]; }
  state() { return { current: this.current, t: this.t, until: this.until, dir: this.dir }; }
  restore(s) { if (!s) return; this.current = s.current; this.t = s.t; this.until = s.until; this.dir = s.dir; const fx = WEATHER_EFFECTS[this.current]; if (this.s.world && fx.wind) this.s.world.wind = { x: Math.sin(this.dir) * fx.wind, z: Math.cos(this.dir) * fx.wind }; }
}

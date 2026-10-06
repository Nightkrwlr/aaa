import { Rng } from '../../core/rng.js';

/**
 * Dynamic events (per region): data in data/world/events.json. Triggered on demand by the Experience Director
 * (or forced from debug). Each event spawns its own actors, tracks a simple goal and pays out on success.
 */
export class EventSystem {
  constructor(session) {
    this.s = session; this.active = null; this.cooldownUntil = 0; this.rng = new Rng(`${session.seed}:events`); this.history = [];
    session.events.on('director:event_request', () => this.request());
  }

  def(id) { return this.s.registry.require(id, 'event'); }

  request(id) {
    const s = this.s;
    if (this.active || !s.zone) return false;
    if (s.state.clock.seconds < this.cooldownUntil && !id) return false;
    const pool = (s.zone.def.events ?? []).map((e) => this.def(e)).filter((e) => (!e.minLevel || s.character.level >= e.minLevel) && (!e.weather || s.weather?.current === e.weather) && (!e.area || s.zone.areaAt(s.player.x, s.player.z)?.id === e.area || e.area === '*'));
    const d = id ? this.def(id) : (pool.length ? this.rng.weighted(pool, (e) => e.weight ?? 1) : null);
    if (!d) return false;
    return this.#start(d);
  }

  #start(d) {
    const s = this.s, w = s.world, p = s.player, rng = this.rng;
    const ang = rng.range(0, Math.PI * 2), r = rng.range(16, 24);
    let x = p.x + Math.sin(ang) * r, z = p.z + Math.cos(ang) * r;
    if (!w.nav.isWalkable(x, z)) { const n = w.nav.nearestWalkable(x, z, 10); if (!n) return false; x = n.x; z = n.z; }
    const ev = { id: d.id, def: d, x, z, started: w.time, enemies: [], npc: null, done: false };
    for (const m of d.enemies ?? []) for (let i = 0; i < (m.count ?? 1); i++) {
      const e = w.spawnEnemy(m.id, x + rng.range(-3, 3), z + rng.range(-3, 3), { level: s.character.level, elite: !!m.elite, eliteCount: m.eliteCount });
      e.eventId = d.id; e.noRespawn = true; ev.enemies.push(e);
      if (m.aggro) e.ai.target = p;
    }
    if (d.weather && d.forceWeather) s.weather?.force(d.forceWeather, d.duration ?? 120);
    if (d.npc) { ev.npc = { id: d.npc, x, z }; s.registerEventNpc?.(ev); }
    this.active = ev;
    s.events.emit('event:start', { id: d.id, x, z });
    s.events.emit('toast', { key: `evt.${d.id.slice(4)}.start` });
    return true;
  }

  update() {
    const ev = this.active; if (!ev) return;
    const s = this.s, w = s.world;
    const alive = ev.enemies.filter((e) => !e.dead && !e.removed);
    const timeout = ev.def.timeout && w.time - ev.started > ev.def.timeout;
    if (!alive.length && ev.enemies.length) this.#finish(true);
    else if (timeout) this.#finish(false);
    else if (!ev.enemies.length && ev.def.duration && w.time - ev.started > ev.def.duration) this.#finish(true);
  }

  #finish(success) {
    const ev = this.active, s = this.s;
    this.active = null; this.cooldownUntil = s.state.clock.seconds + s.balance.d.director.eventCooldownSeconds;
    this.history.push({ id: ev.id, success });
    s.events.emit('event:end', { id: ev.id, success });
    if (success) {
      s.events.emit('toast', { key: `evt.${ev.id.slice(4)}.win` });
      const rw = ev.def.reward ?? {};
      if (rw.xp) s.character.grantXp(s.world, s.player, rw.xp);
      s.loot.spawn(ev.x, ev.z, [{ type: 'chimes', amount: Math.round(s.balance.chimeUnit(s.character.level) * (rw.chimes ?? 6)) }, ...(rw.materials ?? []).map((m) => ({ type: 'material', id: m.id, amount: m.n })), ...(rw.items ? Array.from({ length: rw.items }, () => ({ type: 'item', item: s.factory.roll(s.world.rng, { ilvl: s.character.level, bias: 0.6, tags: s.character.buildTags(), classId: s.character.classId }) })) : [])]);
    }
  }
}

/**
 * Save system — versioned, checksummed, atomic, with rotating backups, migrations and export/import.
 *
 * Envelope: { magic:'SDCH', version, build, savedAt, meta, checksum, payload:string(JSON) }
 *  • the checksum covers the payload text, so a truncated/edited file is detected before parsing
 *  • write path: serialize → write `.tmp` → read back & verify → rotate `.bak1..N` → promote to main → drop `.tmp`
 *  • read path: main → `.tmp` (interrupted promote) → `.bak1..N`; the first valid one wins and is flagged `recovered`
 *  • migrations upgrade old payloads step by step (v1 → v2 → … → SAVE_VERSION); unknown FUTURE versions are refused, never guessed
 *  • dungeon runs are ephemeral by design: saving inside one stores the portal position (safe re-entry)
 */
import { GameSession } from './session.js';
import { GameState } from './state.js';
import { Character } from './character.js';
import { Inventory } from './items/inventory.js';
import { logger } from '../core/logger.js';

const log = logger('save');
export const SAVE_VERSION = 3;
const MAGIC = 'SDCH';

// ───────────────────────── checksum (FNV-1a 32 over UTF-16 units + length)
export function checksum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(16).padStart(8, '0')}-${text.length.toString(16)}`;
}

// ───────────────────────── storage adapters
export class MemoryAdapter {
  constructor() { this.m = new Map(); }
  read(k) { return this.m.has(k) ? this.m.get(k) : null; }
  write(k, v) { this.m.set(k, v); }
  remove(k) { this.m.delete(k); }
  keys() { return [...this.m.keys()]; }
}
export class LocalStorageAdapter {
  constructor(storage = globalThis.localStorage) { this.s = storage; }
  read(k) { try { return this.s.getItem(k); } catch { return null; } }
  write(k, v) { this.s.setItem(k, v); }
  remove(k) { try { this.s.removeItem(k); } catch { /* ignore */ } }
  keys() { const out = []; try { for (let i = 0; i < this.s.length; i++) out.push(this.s.key(i)); } catch { /* ignore */ } return out; }
}
// ───────────────────────── migrations: payload vN → vN+1
export const MIGRATIONS = {
  // v1 → v2: stash and key items were introduced; flags moved under state
  1: (p) => { p.stash ??= { capacity: 80, slots: [] }; p.state ??= { flags: p.flags ?? {} }; delete p.flags; if (p.character?.inv && !p.character.inv.keyItems) p.character.inv.keyItems = []; return p; },
  // v2 → v3: cleared groups / depleted nodes / puzzle progress / dungeon spec records, and `pos` split from character
  2: (p) => { p.state ??= {}; p.state.cleared ??= []; p.state.depleted ??= {}; p.state.puzzlesRead ??= {}; p.state.dungeons = { done: 0, bySeed: {}, specs: {}, ...(p.state.dungeons ?? {}) }; if (p.character?.pos) { p.pos = p.character.pos; delete p.character.pos; } return p; },
};

export function migrate(payload, from) {
  let p = payload;
  for (let v = from; v < SAVE_VERSION; v++) {
    const fn = MIGRATIONS[v];
    if (!fn) throw new Error(`no migration from save v${v}`);
    p = fn(p); log.info(`migrated save v${v} → v${v + 1}`);
  }
  return p;
}

// ───────────────────────── (de)serialisation of a live session
export function snapshot(session) {
  const ctx = session.mode === 'dungeon' ? null : session.overworld;
  const over = session.overworld;
  const live = session.mode === 'dungeon' ? session.dungeonCtx : over;
  const pos = session.mode === 'dungeon' ? { x: session.dungeonCtx.back.x, z: session.dungeonCtx.back.z } : { x: over.player.x, z: over.player.z };
  return {
    seed: session.seed,
    settings: { difficulty: session.settings.difficulty, lootFilter: session.settings.lootFilter, puzzleHints: session.settings.puzzleHints },
    state: session.state.toJSON(),
    character: session.character.toJSON(),
    stash: session.stash.toJSON(),
    weather: session.weather?.state() ?? null,
    pos: { ...pos, hpRatio: Math.max(0.05, live.player.hp / live.player.hpMax) },
    zone: over.zone.id,
    ctxKind: ctx ? 'overworld' : 'dungeon',
  };
}

export function metaOf(session) {
  const ch = session.character;
  return { name: ch.name, classId: ch.classId, level: ch.level, playSeconds: Math.round(ch.counters.playSeconds), area: session.areaId, quests: session.quests.active().length, zone: session.zone?.id };
}

/** rebuild a playable session from a (migrated) payload */
export function restore(registry, payload, { settings = {} } = {}) {
  const s = new GameSession({ registry, seed: payload.seed, classId: payload.character.classId, name: payload.character.name, settings: { ...payload.settings, ...settings } });
  s.state = GameState.fromJSON(payload.state);
  s.character = Character.fromJSON({ registry, balance: s.balance, factory: s.factory }, payload.character);
  s.stash = Inventory.fromJSON(payload.stash);
  // place the player where they saved (falls back to the checkpoint when the spot is no longer walkable)
  const cp = s.state.checkpoint;
  if (payload.pos) s.state.checkpoint = { zone: payload.zone ?? 'zone.calvarre_lower', wp: cp?.wp ?? null, x: payload.pos.x, z: payload.pos.z };
  s.start({ zoneId: payload.zone ?? 'zone.calvarre_lower' });
  s.state.checkpoint = cp; // the real respawn point is untouched
  if (payload.pos?.hpRatio) s.player.hp = Math.max(1, Math.round(s.player.hpMax * payload.pos.hpRatio));
  if (payload.weather) s.weather.restore(payload.weather);
  return s;
}

// ───────────────────────── manager
export class SaveManager {
  constructor(adapter, { backups = 3, prefix = 'sdc.save', build = 'dev', now = () => Date.now() } = {}) {
    this.a = adapter; this.backups = backups; this.prefix = prefix; this.build = build; this.now = now;
  }
  key(slot, suffix = '') { return `${this.prefix}.${slot}${suffix}`; }

  /** @returns {{ok:boolean, meta?:any, bytes?:number, error?:string}} */
  save(slot, session) {
    try {
      const payload = JSON.stringify(snapshot(session));
      const meta = { ...metaOf(session), savedAt: this.now() };
      const env = JSON.stringify({ magic: MAGIC, version: SAVE_VERSION, build: this.build, savedAt: meta.savedAt, meta, checksum: checksum(payload), payload });
      const tmp = this.key(slot, '.tmp');
      this.a.write(tmp, env);
      const back = this.#parse(this.a.read(tmp));
      if (!back.ok) { this.a.remove(tmp); return { ok: false, error: `verify failed: ${back.error}` }; }
      // rotate backups (oldest dropped), then promote
      for (let i = this.backups; i >= 2; i--) { const prev = this.a.read(this.key(slot, `.bak${i - 1}`)); if (prev !== null) this.a.write(this.key(slot, `.bak${i}`), prev); }
      const cur = this.a.read(this.key(slot));
      if (cur !== null && this.#parse(cur).ok) this.a.write(this.key(slot, '.bak1'), cur);
      this.a.write(this.key(slot), env);
      this.a.remove(tmp);
      return { ok: true, meta, bytes: env.length };
    } catch (err) {
      log.error('save failed', err);
      return { ok: false, error: String(err.message ?? err) };
    }
  }

  #parse(text) {
    if (!text) return { ok: false, error: 'empty' };
    let env;
    try { env = JSON.parse(text); } catch { return { ok: false, error: 'unparseable (truncated?)' }; }
    if (env.magic !== MAGIC) return { ok: false, error: 'bad magic' };
    if (typeof env.payload !== 'string' || checksum(env.payload) !== env.checksum) return { ok: false, error: 'checksum mismatch' };
    if (env.version > SAVE_VERSION) return { ok: false, error: `save is from a newer version (v${env.version})`, future: true };
    return { ok: true, env };
  }

  /** read the best valid envelope for a slot: main → tmp → bak1..N */
  read(slot) {
    const cands = [['main', this.key(slot)], ['tmp', this.key(slot, '.tmp')], ...Array.from({ length: this.backups }, (_, i) => [`bak${i + 1}`, this.key(slot, `.bak${i + 1}`)])];
    const errors = [];
    for (const [name, k] of cands) {
      const raw = this.a.read(k); if (raw === null) continue;
      const r = this.#parse(raw);
      if (r.ok) return { ok: true, env: r.env, source: name, recovered: name !== 'main', errors };
      errors.push(`${name}: ${r.error}`);
      if (r.future) return { ok: false, error: r.error, errors };
    }
    return { ok: false, error: errors.length ? errors.join('; ') : 'no save', errors };
  }

  load(slot, registry, opts = {}) {
    const r = this.read(slot);
    if (!r.ok) return r;
    try {
      let payload = JSON.parse(r.env.payload);
      if (r.env.version < SAVE_VERSION) payload = migrate(payload, r.env.version);
      const session = restore(registry, payload, opts);
      return { ok: true, session, recovered: r.recovered, source: r.source, migrated: r.env.version < SAVE_VERSION, meta: r.env.meta };
    } catch (err) {
      log.error('load failed', err);
      return { ok: false, error: `load failed: ${err.message}` };
    }
  }

  list(slots = ['auto', 'slot1', 'slot2', 'slot3']) {
    return slots.map((slot) => { const r = this.read(slot); return r.ok ? { slot, meta: r.env.meta, version: r.env.version, recovered: r.recovered } : { slot, empty: r.error === 'no save', corrupt: r.error !== 'no save', error: r.error }; });
  }

  delete(slot) { for (const suf of ['', '.tmp', ...Array.from({ length: this.backups }, (_, i) => `.bak${i + 1}`)]) this.a.remove(this.key(slot, suf)); }

  /** shareable text blob (base64 of the envelope) */
  exportSlot(slot) { const r = this.read(slot); if (!r.ok) return null; const text = JSON.stringify(r.env); return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(text))) : Buffer.from(text, 'utf8').toString('base64'); }
  importSlot(slot, blob) {
    try {
      const text = typeof atob === 'function' ? decodeURIComponent(escape(atob(blob.trim()))) : Buffer.from(blob.trim(), 'base64').toString('utf8');
      const r = this.#parse(text);
      if (!r.ok) return { ok: false, error: r.error };
      this.a.write(this.key(slot), text);
      return { ok: true, meta: r.env.meta };
    } catch (err) { return { ok: false, error: 'not a valid save blob' }; }
  }
}

/** autosave helper: debounced, always allowed for important reasons */
export class AutoSaver {
  constructor(session, manager, { slot = 'auto', minGap = 20 } = {}) {
    this.s = session; this.m = manager; this.slot = slot; this.minGap = minGap; this.last = -1e9; this.count = 0;
    session.events.on('autosave', ({ reason }) => this.request(reason));
  }
  request(reason, force = false) {
    const t = this.s.time;
    const important = force || ['boss', 'quest', 'dungeon', 'secret', 'puzzle', 'level'].includes(reason);
    if (!important && t - this.last < this.minGap) return null;
    if (this.s.dead) return null;
    this.last = t; this.count++;
    const r = this.m.save(this.slot, this.s);
    this.s.events.emit('toast', { key: r.ok ? 'toast.autosaved' : 'toast.save_failed' });
    return r;
  }
}

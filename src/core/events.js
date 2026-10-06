/** Minimal typed-ish event bus. Systems communicate through events, never through each other's internals. */
export class EventBus {
  constructor() { this.map = new Map(); }

  on(type, fn) {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }

  once(type, fn) {
    const off = this.on(type, (e) => { off(); fn(e); });
    return off;
  }

  emit(type, payload = {}) {
    const set = this.map.get(type);
    if (set) for (const fn of [...set]) {
      try { fn(payload); } catch (err) { logger('events').error(`handler for ${type} failed`, err); }
    }
    const any = this.map.get('*');
    if (any) for (const fn of [...any]) {
      try { fn({ type, ...payload }); } catch (err) { logger('events').error('wildcard handler failed', err); }
    }
  }

  clear() { this.map.clear(); }
}

import { logger } from './logger.js';

import { deepFreeze } from './math.js';
import { logger } from './logger.js';

const log = logger('registry');

/**
 * Content registry. All gameplay content (abilities, enemies, items…) lives in JSON files shaped as
 *   { "kind": "ability", "items": [ { "id": "abl.x", ... } ] }
 * IDs are permanent, globally unique and namespaced (`abl.`, `enm.`, `itm.`…). Display text is never stored
 * here: it is resolved through locale keys `<id>.name`, `<id>.desc`, …
 */
export class Registry {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.byKind = new Map();
    /** @type {Map<string, any>} */
    this.byId = new Map();
    this.errors = [];
  }

  /** @param {Record<string, any>} bundle map of source path → parsed file */
  load(bundle) {
    for (const [path, file] of Object.entries(bundle)) this.addFile(path, file);
    return this;
  }

  addFile(path, file) {
    const data = file && file.default ? file.default : file;
    if (!data || typeof data.kind !== 'string' || !Array.isArray(data.items)) {
      this.errors.push(`${path}: not a content file (needs kind + items[])`);
      log.warn(`skipping ${path}: not a content file`);
      return;
    }
    let kindMap = this.byKind.get(data.kind);
    if (!kindMap) this.byKind.set(data.kind, (kindMap = new Map()));
    for (const item of data.items) {
      if (!item || typeof item.id !== 'string') {
        this.errors.push(`${path}: entry without id`);
        continue;
      }
      if (this.byId.has(item.id)) {
        this.errors.push(`${path}: duplicate id ${item.id}`);
        log.error(`duplicate id ${item.id} in ${path}`);
        continue;
      }
      item.kind = data.kind;
      item.__src = path;
      deepFreeze(item);
      kindMap.set(item.id, item);
      this.byId.set(item.id, item);
    }
  }

  has(id) { return this.byId.has(id); }
  get(id) { return this.byId.get(id); }

  require(id, kind) {
    const it = this.byId.get(id);
    if (!it) throw new Error(`Registry: missing content id "${id}"${kind ? ` (expected ${kind})` : ''}`);
    if (kind && it.kind !== kind) throw new Error(`Registry: "${id}" is ${it.kind}, expected ${kind}`);
    return it;
  }

  /** @returns {any[]} */
  all(kind) { return [...(this.byKind.get(kind)?.values() ?? [])]; }
  ids(kind) { return [...(this.byKind.get(kind)?.keys() ?? [])]; }
  kinds() { return [...this.byKind.keys()]; }
  count() { return this.byId.size; }
}

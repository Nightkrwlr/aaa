import { logger } from './logger.js';
const log = logger('i18n');

/**
 * Localization. Keys only — no literal text in code. Fallback chain: lang → default → key.
 * Params use {name} placeholders. Plural: key + '#one' / '#other' when `count` is passed.
 */
export class I18n {
  constructor(defaultLang = 'es') {
    this.defaultLang = defaultLang;
    this.lang = defaultLang;
    /** @type {Record<string, Record<string,string>>} */
    this.tables = {};
    this.missing = new Set();
  }

  addTable(lang, table) { this.tables[lang] = Object.assign(this.tables[lang] ?? {}, table); }
  languages() { return Object.keys(this.tables); }
  setLang(lang) { if (this.tables[lang]) this.lang = lang; else log.warn(`language ${lang} not loaded`); }

  has(key) { return key in (this.tables[this.lang] ?? {}) || key in (this.tables[this.defaultLang] ?? {}); }

  t(key, params) {
    let s = this.tables[this.lang]?.[key];
    if (params && 'count' in params) {
      const pk = `${key}#${params.count === 1 ? 'one' : 'other'}`;
      s = this.tables[this.lang]?.[pk] ?? this.tables[this.defaultLang]?.[pk] ?? s;
    }
    if (s === undefined) s = this.tables[this.defaultLang]?.[key];
    if (s === undefined) {
      if (!this.missing.has(key)) { this.missing.add(key); log.debug(`missing text key: ${key}`); }
      return `⟦${key}⟧`;
    }
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
    return s;
  }
}

/** shared instance used by UI/client; sim never needs it */
export const i18n = new I18n('es');
export const t = (k, p) => i18n.t(k, p);

// Node-only helpers (tests, tools). Never imported by the browser bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Registry } from './registry.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

export function loadJsonTree(dir) {
  const bundle = {};
  for (const p of walk(dir)) {
    const rel = relative(ROOT, p).replaceAll('\\', '/');
    try { bundle[rel] = JSON.parse(readFileSync(p, 'utf8')); }
    catch (e) { throw new Error(`Invalid JSON in ${rel}: ${e.message}`); }
  }
  return bundle;
}

let cached = null;
export function loadRegistry() {
  if (!cached) cached = new Registry().load(loadJsonTree(join(ROOT, 'data')));
  return cached;
}
export function freshRegistry() { return new Registry().load(loadJsonTree(join(ROOT, 'data'))); }

export function loadLocale(lang) {
  const flat = {};
  const dir = join(ROOT, 'locales', lang);
  for (const p of walk(dir)) Object.assign(flat, JSON.parse(readFileSync(p, 'utf8')));
  return flat;
}

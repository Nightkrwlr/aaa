#!/usr/bin/env node
/** Scans client code for literal locale keys (t('…') / labelKey / key: '…') and checks ES+EN coverage. usage: node tools/check-ui-keys.mjs [--list] */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadLocale, ROOT } from '../src/core/nodeLoader.js';

const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(js|mjs)$/.test(n)) out.push(p); } return out; };
const files = [...walk(join(ROOT, 'src/client')), ...walk(join(ROOT, 'src/sim'))];
const keys = new Map();
const re = /\b(?:t|i18n\.t|game\.toast\(t|toast\(t)\(\s*'([a-zA-Z][a-zA-Z0-9_.]*)'/g;
const re2 = /(?:labelKey|key|textKey|nameKey|hintKey):\s*'([a-z][a-zA-Z0-9_.]*\.[a-zA-Z0-9_.]+)'/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const r of [re, re2]) { r.lastIndex = 0; let m; while ((m = r.exec(src))) { if (!keys.has(m[1])) keys.set(m[1], f.replace(ROOT, '')); } }
}
const L = { es: loadLocale('es'), en: loadLocale('en') };
let missing = 0;
for (const lang of ['es', 'en']) {
  const miss = [...keys].filter(([k]) => !(k in L[lang]) && !/^(ia|toast|gate|evt|pz)\./.test(k) || (/^(ia|toast|gate|evt|pz)\./.test(k) && !(k in L[lang])));
  missing += miss.length;
  if (miss.length) { console.error(`✖ ${lang}: ${miss.length} keys used in code are missing`); if (process.argv.includes('--list') || miss.length < 12) for (const [k, f] of miss) console.error(`   ${k}   (${f})`); }
}
const onlyEs = Object.keys(L.es).filter((k) => !(k in L.en)), onlyEn = Object.keys(L.en).filter((k) => !(k in L.es));
if (onlyEs.length || onlyEn.length) { console.error(`✖ locale parity: ${onlyEs.length} keys only in es, ${onlyEn.length} only in en`); for (const k of [...onlyEs, ...onlyEn].slice(0, 10)) console.error(`   ${k}`); missing += onlyEs.length + onlyEn.length; }
console.log(missing ? `FAILED (${missing})` : `OK — ${keys.size} literal keys checked`);
process.exit(missing ? 1 : 0);

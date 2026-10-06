#!/usr/bin/env node
/**
 * validate-data — content integrity checker (run in CI and before every build).
 *  1. registry load errors (duplicate ids, malformed files)
 *  2. cross-references: every string that looks like a content id must resolve
 *  3. per-kind schema rules (required fields)
 *  4. locale coverage: every required display key exists in ES and EN
 *  5. zone checks (reachability), dungeon sample generation
 * usage: node tools/validate-data.mjs [--strict] [--quiet] [--locale-only]
 */
import { freshRegistry, loadLocale } from '../src/core/nodeLoader.js';
import { buildZone, validateZone } from '../src/sim/world/zone.js';

const args = new Set(process.argv.slice(2));
const reg = freshRegistry();
const errors = [], warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ── 1. registry errors
for (const e of reg.errors) err(`registry: ${e}`);

// ── 2. cross-references. Prefixes that must resolve to a registry item.
const REF_PREFIXES = ['abl', 'enm', 'unq', 'mat', 'con', 'gem', 'rcp', 'st', 'rx', 'elm', 'enc', 'dfm', 'obj', 'mod', 'nar', 'boss', 'voc', 'qst', 'dlg', 'gate', 'evt', 'sec', 'cdx', 'mdl', 'npc', 'cls', 'zone', 'rgn', 'shp', 'prop'];
const TEXT_SUFFIX = /\.(name|desc|title|body|text|start|win|lose|hint\d?|label|tip|short)$/;
const SKIP_FIELDS = new Set(['__src', 'kind', 'id', 'say', 'speaker', 'textKey', 'labelKey', 'nameKey', 'hintKey', 'key', 'lore', 'tone', 'icon', 'anim', 'fx', 'sfx', 'vfx']);
const refRe = new RegExp(`^(${REF_PREFIXES.join('|')})\\.[a-z0-9_.]+$`);
// ids that are intentionally not registry items
const EXEMPT = (s) => /^(abl\.(con|belfry|prismatist|skirmisher)\.)?potion/.test(s) && false;

function walk(v, path, srcId, field) {
  if (typeof v === 'string') {
    if (field && SKIP_FIELDS.has(field)) return;
    if (!refRe.test(v) || TEXT_SUFFIX.test(v)) return;
    if (!reg.has(v) && !EXEMPT(v)) err(`xref: ${srcId} → ${path} references missing "${v}"`);
    return;
  }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`, srcId, field)); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, srcId, k);
}
for (const kind of reg.kinds()) for (const it of reg.all(kind)) walk(it, '', it.id, null);

// ── 3. schema rules
const need = (kind, fields) => { for (const it of reg.all(kind)) for (const f of fields) if (it[f] === undefined) err(`schema: ${kind} ${it.id} missing "${f}"`); };
need('enemy', ['family', 'tier', 'model', 'abilities', 'ai']);
need('ability', ['effects']);
need('quest', ['stages']);
need('dialogue', ['npc', 'roots', 'nodes']);
need('gate', ['requirements']);
need('npc', ['model']);
need('event', ['weight']);
for (const q of reg.all('quest')) {
  const ids = new Set(q.stages.map((s) => s.id));
  for (const s of q.stages) { if (s.next && !ids.has(s.next)) err(`quest ${q.id}: stage ${s.id} → unknown next ${s.next}`); if (!s.objectives) err(`quest ${q.id}: stage ${s.id} has no objectives[]`); }
  for (const n of q.next ?? []) if (!reg.has(n)) err(`quest ${q.id}: next ${n} missing`);
}
for (const d of reg.all('dialogue')) {
  for (const r of d.roots) if (!d.nodes[r.id]) err(`dialogue ${d.id}: root ${r.id} has no node`);
  for (const [id, n] of Object.entries(d.nodes)) {
    if (n.next && !d.nodes[n.next]) err(`dialogue ${d.id}: node ${id} → next ${n.next} missing`);
    for (const c of n.choices ?? []) if (c.next && !d.nodes[c.next]) err(`dialogue ${d.id}: node ${id} choice → ${c.next} missing`);
  }
}
for (const e of reg.all('enemy')) {
  if (e.family === 'fam.test') continue;
  for (const a of e.abilities ?? []) if (!reg.has(a)) err(`enemy ${e.id}: ability ${a} missing`);
  if (!reg.has(e.model)) err(`enemy ${e.id}: model ${e.model} missing`);
  if (!reg.has(e.family)) err(`enemy ${e.id}: family ${e.family} missing`);
}
for (const c of reg.all('class')) for (const u of c.unlocks) if (!reg.has(u.ability)) err(`class ${c.id}: unlock ${u.ability} missing`);

// ── 4. locale coverage
const NAMED = ['ability', 'enemy', 'item', 'baseItem', 'affix', 'unique', 'material', 'consumable', 'gem', 'recipe', 'status', 'talent', 'class', 'quest', 'npc', 'gate', 'event', 'dungeonFamily', 'dungeonObjective', 'dungeonModifier', 'voice', 'secret', 'region', 'model'];
const NO_LOCALE = new Set(['model']);
const langs = ['es', 'en'];
const L = Object.fromEntries(langs.map((l) => [l, loadLocale(l)]));
const required = new Set();
for (const kind of reg.kinds()) {
  if (NO_LOCALE.has(kind)) continue;
  for (const it of reg.all(kind)) {
    if (it.id.startsWith('enm.test') || it.family === 'fam.test' || it.id.startsWith('abl.test')) continue;
    if (NAMED.includes(kind) || kind === 'family' || kind === 'zone') required.add(`${it.id}.name`);
  }
}
for (const k of ['codex']) for (const c of reg.all(k)) { required.add(`${c.id}.title`); required.add(`${c.id}.body`); }
for (const q of reg.all('quest')) {
  required.add(`${q.id}.summary`);
  for (const s of q.stages) { required.add(`${q.id}.${s.id}.title`); required.add(`${q.id}.${s.id}.desc`); for (const o of s.objectives) required.add(`${q.id}.${s.id}.o${s.objectives.indexOf(o)}`); }
}
for (const d of reg.all('dialogue')) for (const n of Object.values(d.nodes)) { if (n.textKey) required.add(n.textKey); for (const c of n.choices ?? []) if (c.textKey) required.add(c.textKey); }
for (const g of reg.all('gate')) for (const r of g.requirements) if (r.textKey) required.add(r.textKey);
const missing = {};
for (const l of langs) {
  const miss = [...required].filter((k) => !(k in L[l]));
  missing[l] = miss;
  if (miss.length) (args.has('--strict') ? err : warn)(`locale ${l}: ${miss.length} missing keys (first: ${miss.slice(0, 6).join(', ')})`);
}
for (const [k, v] of Object.entries(L.es)) if (typeof v !== 'string' || !v.trim()) err(`locale es: empty value for ${k}`);

// ── 5. zones
for (const z of reg.all('zone')) {
  try { const zone = buildZone(reg, z.id); for (const e of validateZone(zone)) err(`zone ${z.id}: ${e}`); }
  catch (e) { err(`zone ${z.id}: build failed — ${e.message}`); }
}

if (!args.has('--quiet')) {
  console.log(`content: ${reg.count()} entries in ${reg.kinds().length} kinds · locale keys es=${Object.keys(L.es).length} en=${Object.keys(L.en).length}`);
  if (args.has('--list-missing')) for (const l of langs) console.log(`missing ${l}:`, missing[l].join('\n  '));
}
for (const w of warns) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
console.log(errors.length ? `FAILED: ${errors.length} errors, ${warns.length} warnings` : `OK (${warns.length} warnings)`);
process.exit(errors.length ? 1 : 0);

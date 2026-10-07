#!/usr/bin/env node
/**
 * build — compone Operación Eclipse en un único HTML.
 *
 *   node tools/build.mjs [--dev] [--out dist/eclipse.html]
 *
 * 1. concatena src/game/_prelude.js + los fragmentos de _order.json (comparten ámbito, como el bundle original)
 * 2. empaqueta con esbuild (three@0.160.1 + addons oficiales + src/engine/*) en un IIFE
 * 3. inserta el IIFE y los dos blobs JSON (sprites y modelos GLB) en la plantilla HTML
 *
 * Salidas:
 *   dist/eclipse.html           documento completo (para probar en local y alojar)
 *   dist/eclipse.artifact.html  solo el fragmento del <body> (lo que se publica como Artifact)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const outFile = path.resolve(ROOT, outArg ?? 'dist/eclipse.html');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 1) fragmentos → entrada única
const gameDir = path.join(ROOT, 'src/game');
const order = JSON.parse(fs.readFileSync(path.join(gameDir, '_order.json'), 'utf8'));
let entry = '';
for (const f of order) entry += `\n// ═══ ${f} ═══\n` + fs.readFileSync(path.join(gameDir, f), 'utf8');
fs.mkdirSync(path.join(ROOT, '.build'), { recursive: true });
const entryPath = path.join(ROOT, '.build/game.entry.js');
fs.writeFileSync(entryPath, entry);

// 2) bundle
const t0 = Date.now();
const res = await build({
  entryPoints: [entryPath], bundle: true, write: false, format: 'iife', platform: 'browser', target: ['es2020'],
  minify: !dev, legalComments: 'none', logLevel: 'warning', treeShaking: true,
  define: { 'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production') },
});
let js = res.outputFiles[0].text;
js = js.replace(/<\/script/gi, '<\\/script');

// 3) HTML
const head = read('html/template.head.html');
const split = head.indexOf('<body>\n') + '<body>\n'.length;
const skeletonStart = head.slice(0, split);
const fragmentHead = head.slice(split);
const art = fs.readFileSync(path.join(ROOT, 'assets/artmanifest.json'), 'utf8');
const models = fs.readFileSync(path.join(ROOT, 'assets/models3d.json'), 'utf8');
const fragment = fragmentHead + `<script type="application/json" id="artmanifest">${art}</script>\n<script type="application/json" id="models3d">${models}</script>\n<script>${js}</script>\n`;
const full = skeletonStart + fragment + '\n</body></html>';
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, full);
const artifactPath = outFile.replace(/\.html$/, '.artifact.html');
fs.writeFileSync(artifactPath, fragment);
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`build ok (${dev ? 'dev' : 'min'}) in ${((Date.now() - t0) / 1000).toFixed(1)}s · js ${(js.length / 1024).toFixed(0)} KB · ${path.relative(ROOT, outFile)} ${mb(full.length)} · artifact fragment ${mb(fragment.length)}`);

#!/usr/bin/env node
/**
 * build — compone Operación Eclipse en un único HTML.
 *
 *   node tools/build.mjs [--dev] [--out dist/eclipse.html] [--title "Nombre"] [--host]
 *
 * 1. concatena src/game/_prelude.js + los fragmentos de _order.json (comparten ámbito, como el bundle original)
 * 2. empaqueta con esbuild (three@0.160.1 + addons oficiales + src/engine/*) en un IIFE
 * 3. inserta el IIFE y los dos blobs JSON (sprites y modelos GLB) en la plantilla HTML
 *
 * Salidas:
 *   dist/eclipse.html           documento completo (para probar en local y alojar)
 *   dist/eclipse.artifact.html  solo el fragmento del <body> (lo que se publica como Artifact)
 *
 * --host  edición para alojamiento propio (Hostinger…): añade metadatos de app móvil (pantalla completa, color de tema),
 *         enlaza manifest.webmanifest + iconos, marca la página como noindex y deja junto a la salida el manifiesto y los
 *         iconos de public/. No genera el fragmento de Artifact. Ejemplo:
 *           node tools/build.mjs --host --out dist/host/index.html --title "Operación Eclipse Remasterizada"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const titleArg = args.includes('--title') ? args[args.indexOf('--title') + 1] : null;   // p. ej. --title "Operación Eclipse Remasterizada" (nombre de la edición publicada)
const host = args.includes('--host');
const outFile = path.resolve(ROOT, outArg ?? (host ? 'dist/host/index.html' : 'dist/eclipse.html'));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 1) fragmentos → entrada única
const gameDir = path.join(ROOT, 'src/game');
const order = JSON.parse(fs.readFileSync(path.join(gameDir, '_order.json'), 'utf8'));
// cada frente puede aportar sus imports en src/game/_prelude.<frente>.js (se incluyen tras _prelude.js, en orden alfabético):
// así los agentes no se pisan en el mismo fichero
const extraPreludes = fs.readdirSync(gameDir).filter((f) => /^_prelude\..+\.js$/.test(f)).sort();
order.splice(1, 0, ...extraPreludes.filter((f) => !order.includes(f)));
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
  alias: { '@engine': path.join(ROOT, 'src/engine') },
  define: { 'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production') },
});
let js = res.outputFiles[0].text;
js = js.replace(/<\/script/gi, '<\\/script');

// 3) HTML
let head = read('html/template.head.html');
if (titleArg) head = head.replace(/<title>.*?<\/title>/, `<title>${titleArg}</title>`);
const split = head.indexOf('<body>\n') + '<body>\n'.length;
const skeletonStart = head.slice(0, split);
const fragmentHead = head.slice(split);
const art = fs.readFileSync(path.join(ROOT, 'assets/artmanifest.json'), 'utf8');
const models = fs.readFileSync(path.join(ROOT, 'assets/models3d.json'), 'utf8');
const fragment = fragmentHead + `<script type="application/json" id="artmanifest">${art}</script>\n<script type="application/json" id="models3d">${models}</script>\n<script>${js}</script>\n`;
const HOST_HEAD = `<meta name="theme-color" content="#070a14"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Eclipse"><meta name="robots" content="noindex,nofollow"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="icon-192.png"><link rel="apple-touch-icon" href="apple-touch-icon.png">`;
const skeleton = host ? skeletonStart.replace('</head>', HOST_HEAD + '</head>') : skeletonStart;
const full = skeleton + fragment + '\n</body></html>';
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, full);
if (host) {
  // manifiesto + iconos junto a index.html: instalable como app a pantalla completa y en horizontal (el juego es un shooter apaisado)
  const outDir = path.dirname(outFile);
  for (const f of fs.readdirSync(path.join(ROOT, 'public'))) if (f !== 'icon.svg') fs.copyFileSync(path.join(ROOT, 'public', f), path.join(outDir, f));
  const title = titleArg ?? (head.match(/<title>(.*?)<\/title>/)?.[1] ?? 'Operación Eclipse');
  const desc = head.match(/<meta name="description" content="(.*?)">/)?.[1] ?? '';
  fs.writeFileSync(path.join(outDir, 'manifest.webmanifest'), JSON.stringify({
    name: title, short_name: 'Eclipse', description: desc, lang: 'es', start_url: './', scope: './',
    display: 'fullscreen', display_override: ['fullscreen', 'standalone'], orientation: 'landscape',
    background_color: '#070a14', theme_color: '#070a14',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
  }, null, 2) + '\n');
} else {
  fs.writeFileSync(outFile.replace(/\.html$/, '.artifact.html'), fragment);
}
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`build ok (${dev ? 'dev' : 'min'}${host ? ', host' : ''}) in ${((Date.now() - t0) / 1000).toFixed(1)}s · js ${(js.length / 1024).toFixed(0)} KB · ${path.relative(ROOT, outFile)} ${mb(full.length)}${host ? ' · + manifest e iconos' : ` · artifact fragment ${mb(fragment.length)}`}`);

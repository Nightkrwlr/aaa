#!/usr/bin/env node
/**
 * grid — hoja de contactos de N imágenes con su nombre debajo (para comparar variantes de golpe).
 *
 *   node tools/grid.mjs --out hoja.png [--cols 2] [--w 640] img1.png img2.png …
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './_pw.mjs';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const files = args.filter((a, i) => a.endsWith('.png') && args[i - 1] !== '--out');
const cols = Number(opt('cols', 2)), W = Number(opt('w', 640)), out = path.resolve(opt('out', 'grid.png'));
if (!files.length) { console.error('uso: node tools/grid.mjs --out hoja.png [--cols 2] [--w 640] a.png b.png …'); process.exit(2); }
let html = `<body style="margin:0;background:#111;color:#ccc;font:13px sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},${W}px);gap:8px;padding:8px">`;
for (const f of files) html += `<figure style="margin:0"><img style="width:${W}px;display:block" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption style="padding:2px 4px">${path.basename(f, '.png')}</figcaption></figure>`;
html += '</div></body>';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cols * (W + 8) + 8, height: 600 } });
await page.setContent(html); await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('grid →', out);

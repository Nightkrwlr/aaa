#!/usr/bin/env node
/**
 * make-icons — rasteriza public/icon.svg en los PNG de la edición alojada (icono de app, apple-touch-icon, favicon).
 *
 *   node tools/make-icons.mjs
 *
 * Los PNG resultantes se guardan en el repo (public/); este guion solo hace falta si cambia el SVG.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, ROOT } from './_pw.mjs';
const dir = path.join(ROOT, 'public');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const SIZES = { 'icon-512.png': 512, 'icon-192.png': 192, 'apple-touch-icon.png': 180, 'favicon-32.png': 32 };
const browser = await chromium.launch();
for (const [name, px] of Object.entries(SIZES)) {
  const page = await browser.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:#070a14"><div style="width:${px}px;height:${px}px">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</div></body>`);
  await page.screenshot({ path: path.join(dir, name), clip: { x: 0, y: 0, width: px, height: px } });
  await page.close();
  console.log('→', name, px + 'px', fs.statSync(path.join(dir, name)).size + ' B');
}
await browser.close();

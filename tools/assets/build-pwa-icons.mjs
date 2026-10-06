#!/usr/bin/env node
// Renders tools/assets/icon.svg to the PNG icons the web app manifest and iOS need (public/icons/*.png).
// usage: node tools/assets/build-pwa-icons.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync('tools/assets/icon.svg', 'utf8');
const body = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '');
const OUT = 'public/icons'; mkdirSync(OUT, { recursive: true });
const SIZES = [
  ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['apple-touch-icon.png', 180, 1],
  ['icon-maskable-512.png', 512, 0.78], // Android masks to a circle/squircle: keep the art inside the safe zone
];
const browser = await chromium.launch();
for (const [name, size, k] of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // the first two <defs>/<rect> children are the background; art is scaled around the centre for maskable
  const html = `<html><body style="margin:0;background:#06090e"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${body.replace('<g id="art">', `<g id="art" transform="translate(256 256) scale(${k}) translate(-256 -256)">`)}</svg></body></html>`;
  await page.setContent(html); await page.screenshot({ path: `${OUT}/${name}` }); await page.close();
  console.log('wrote', `${OUT}/${name}`);
}
await browser.close();

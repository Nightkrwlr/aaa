#!/usr/bin/env node
/**
 * montage — hoja de contactos «antes | después» para revisar capturas de dos etiquetas.
 *
 *   node tools/montage.mjs --dir /ruta/capturas --a antes --b despues --names base-day,reg-valle,reg-ciudad [--cols 1] [--w 760] [--out hoja.png]
 *
 * Busca `${dir}/${a}-${name}.png` y `${dir}/${b}-${name}.png`. Chromium sin GL (solo maqueta HTML).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './_pw.mjs';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(opt('dir', '.')), A = opt('a'), B = opt('b'), W = Number(opt('w', 760)), cols = Number(opt('cols', 1));
const names = opt('names', '').split(',').filter(Boolean);
const out = path.resolve(opt('out', path.join(dir, `montage-${A}-vs-${B}.png`)));
if (!A || !B || !names.length) { console.error('uso: --dir --a --b --names n1,n2 [--cols --w --out]'); process.exit(2); }
const b64 = (f) => (fs.existsSync(f) ? 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') : null);
let html = `<body style="margin:0;background:#111;color:#ccc;font:13px sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},auto);gap:10px;padding:10px">`;
for (const n of names) {
  const a = b64(path.join(dir, `${A}-${n}.png`)), b = b64(path.join(dir, `${B}-${n}.png`));
  html += `<div><div style="padding:2px 4px">${n} — <b style="color:#ffb340">${A}</b> | <b style="color:#5dff9a">${B}</b></div><div style="display:flex;gap:6px">` +
    [a, b].map((s) => (s ? `<img src="${s}" style="width:${W}px;display:block">` : `<div style="width:${W}px;height:${Math.round(W * 0.5625)}px;background:#300;display:grid;place-items:center">falta</div>`)).join('') + '</div></div>';
}
html += '</div></body>';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: (W * 2 + 20) * cols + 20, height: 800 } });
await page.setContent(html); await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('montage →', out);

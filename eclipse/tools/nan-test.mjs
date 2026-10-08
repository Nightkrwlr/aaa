#!/usr/bin/env node
/**
 * nan-test — regresión del «cuadrado negro»: un solo píxel NaN en el destino HDR no debe contaminar la pantalla.
 *
 *   node tools/nan-test.mjs [--out dir]
 *
 * Dibuja una escena gris con un cuadradito que escribe NaN (0/0) y la pasa por PostFx con y sin saneado; mide cuántos píxeles
 * negros hay alrededor. Con saneado debe haber ≤ el tamaño del propio cuadradito; sin él, el bloom y el FXAA lo ensanchan.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, ROOT } from './_pw.mjs';
const args = process.argv.slice(2);
const outDir = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(ROOT, '.build'));
fs.mkdirSync(outDir, { recursive: true });
const entry = `
import * as T from 'three';
import { PostFx } from '@engine/post.js';
window.run = (sanitize, fxaa, nan) => {
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270; document.body.appendChild(canvas);
  const r = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(480, 270, false); r.toneMapping = T.NoToneMapping;
  const scene = new T.Scene(); scene.background = new T.Color(0x303840);
  const cam = new T.OrthographicCamera(-4, 4, 2.25, -2.25, 0.1, 50); cam.position.set(0, 0, 10);
  const bg = new T.Mesh(new T.PlaneGeometry(10, 6), new T.MeshBasicMaterial({ color: 0x8a9aa8 })); bg.position.z = -1; scene.add(bg);
  const bad = new T.Mesh(new T.PlaneGeometry(0.12, 0.12), new T.ShaderMaterial({ uniforms: { uZ: { value: 0 } }, vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform float uZ; void main(){ float n = uZ / uZ; gl_FragColor = vec4(n, n, n, 1.0); }' }));
  bad.visible = nan; scene.add(bad);
  const post = new PostFx(r, scene, cam, { sanitize });
  post.configure({ samples: 0, bloom: true, fxaa });
  post.setSize(480, 270);
  post.bloom.strength = 0.8;
  post.render();
  const gl = r.getContext(); const px = new Uint8Array(480 * 270 * 4); gl.readPixels(0, 0, 480, 270, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let dark = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] < 60) dark++;
  return dark;
};
`;
const res = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, write: false, format: 'iife', platform: 'browser', alias: { '@engine': path.join(ROOT, 'src/engine') }, logLevel: 'error' });
const js = res.outputFiles[0].text;
const server = http.createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html' }); s.end(`<body style="margin:0"><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body>`); }).listen(0, '127.0.0.1');
await new Promise((r) => server.on('listening', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
const cases = [['sin NaN (referencia)', true, false, false], ['NaN, sin saneado, sin FXAA', false, false, true], ['NaN, sin saneado, con FXAA', false, true, true], ['NaN, con saneado, sin FXAA', true, false, true], ['NaN, con saneado, con FXAA', true, true, true]];
let fail = false; const ref = {};
for (const [name, san, fx, nan] of cases) {
  const dark = await page.evaluate(([s, f, n]) => window.run(s, f, n), [san, fx, nan]);
  ref[name] = dark; console.log(`${name.padEnd(32)} píxeles oscuros: ${dark}`);
}
const limit = ref['sin NaN (referencia)'] + 16 * 16;   // el propio cuadradito (≈ 14×14 px) como mucho
if (ref['NaN, con saneado, sin FXAA'] > limit || ref['NaN, con saneado, con FXAA'] > limit) { console.log('FALLO: el saneado no contiene el NaN'); fail = true; }
else console.log(ref['NaN, sin saneado, sin FXAA'] > limit ? 'OK (y sin saneado el NaN sí ensancha la mancha: la prueba es sensible)' : 'OK (aviso: sin saneado el NaN no se propagó en este renderizador; la prueba no discrimina aquí)');
if (errs.length) console.log('errores de página:', [...new Set(errs)].slice(0, 3).join(' | '));
await browser.close(); server.close(); process.exit(fail ? 1 : 0);

import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

/** writes the precache list + versions into dist/sw.js once the bundle exists (see public/sw.js) */
function sdcPwa() {
  let outDir = 'dist';
  const walk = (d, acc = []) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, acc) : acc.push(p); } return acc; };
  return {
    name: 'sdc-pwa', apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const swPath = join(outDir, 'sw.js'); if (!existsSync(swPath)) return;
      const files = walk(outDir).map((f) => relative(outDir, f).split('\\').join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.startsWith('assets/models/') && f !== 'assets/manifest.json');
      const hash = createHash('sha1'); for (const f of files.sort()) hash.update(f).update(readFileSync(join(outDir, f)));
      const assetManifest = join(outDir, 'assets', 'manifest.json');
      const assetVersion = existsSync(assetManifest) ? createHash('sha1').update(readFileSync(assetManifest)).digest('hex').slice(0, 10) : 'none';
      const core = ['./', ...files.map((f) => `./${f}`)];
      writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__VERSION__', process.env.BUILD_ID ?? hash.digest('hex').slice(0, 10)).replace('__ASSET_VERSION__', assetVersion).replace('__PRECACHE__', JSON.stringify(core)));
    },
  };
}

// DEV_TOOLS: debug menu, god mode, seed tools. Always false in production builds.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [sdcPwa()],
  define: {
    __DEV_TOOLS__: JSON.stringify(mode !== 'production'),
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? 'local'),
  },
  server: { port: 5173, host: true },
  build: { target: 'es2022', sourcemap: mode !== 'production', chunkSizeWarningLimit: 1400 },
}));

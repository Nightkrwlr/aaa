// resuelve Playwright: primero el node_modules de la raíz del repo (o de un worktree con enlace), luego el del repo principal
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [path.join(ROOT, '../package.json'), '/home/user/aaa/package.json'];
let playwright = null, lastErr = null;
for (const c of candidates) { try { if (fs.existsSync(path.join(path.dirname(c), 'node_modules/playwright'))) { playwright = createRequire(c)('playwright'); break; } } catch (e) { lastErr = e; } }
if (!playwright) throw new Error('Playwright no encontrado (instala en la raíz del repo o enlaza node_modules): ' + (lastErr?.message ?? ''));
export const { chromium } = playwright;
export { ROOT };

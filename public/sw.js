/* SUNDERCHOIR service worker — fast repeat loads and offline play.
 * The build (vite.config.js › sdc-pwa) replaces the three placeholders below; in dev this file is never registered.
 *  • core files (html, js, css, manifest, icons): precached, versioned per build
 *  • /assets/** (3D models, animations): cache-first, versioned by the asset manifest hash
 *  • page navigations: network first (always the newest game), cached shell when offline
 */
const VERSION = '__VERSION__';
const ASSET_VERSION = '__ASSET_VERSION__';
const PRECACHE = __PRECACHE__;
const CORE = `sdc-core-${VERSION}`, ASSETS = `sdc-assets-${ASSET_VERSION}`;

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const c = await caches.open(CORE);
  await Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => { /* a missing optional file must not block the install */ })));
  await self.skipWaiting();
})()));

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('sdc-') && k !== CORE && k !== ASSETS) await caches.delete(k);
  await self.clients.claim();
})()));

const put = async (name, req, res) => { if (res && res.ok && res.type === 'basic') { const c = await caches.open(name); await c.put(req, res.clone()); } return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { const res = await fetch(req); const key = new Request(url.origin + url.pathname); put(CORE, key, res); return res; }
      catch { return (await caches.match(new Request(url.origin + url.pathname))) ?? (await caches.match('./index.html')) ?? Response.error(); }
    })());
    return;
  }
  const isAsset = url.pathname.includes('/assets/');
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit && isAsset) return hit;                       // models / hashed bundles never change under the same name+version
    const net = fetch(req).then((res) => put(isAsset ? ASSETS : CORE, req, res)).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }            // stale-while-revalidate for icons, manifest…
    return (await net) ?? Response.error();
  })());
});

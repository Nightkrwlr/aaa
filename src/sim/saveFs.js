/** Node-only filesystem adapter for the SaveManager (tests, tools). Never imported by the browser bundle. */
export async function fsAdapter(dir) {
  const fs = await import('node:fs'); const path = await import('node:path');
  fs.mkdirSync(dir, { recursive: true });
  const f = (k) => path.join(dir, k.replace(/[^a-zA-Z0-9._-]/g, '_'));
  return {
    read: (k) => (fs.existsSync(f(k)) ? fs.readFileSync(f(k), 'utf8') : null),
    write: (k, v) => fs.writeFileSync(f(k), v),
    remove: (k) => { try { fs.unlinkSync(f(k)); } catch { /* ignore */ } },
    keys: () => fs.readdirSync(dir),
  };
}


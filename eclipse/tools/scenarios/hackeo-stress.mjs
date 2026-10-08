// HACKEO · robustez: cientos de sesiones que se abren, se juegan a medias y se cierran de todas las formas (✕, Esc, abortar, otra sesión encima, fin normal)
// sin dejar escuchas de teclado/resize colgadas, lienzos huérfanos, temporizadores vivos ni sesiones atascadas; y sin errores.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/hackeo-stress.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, logs, page, wait } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await api.region('desierto');
  await ev(() => { const G = window.__G; G.world.packCd = 1e9; G.world.evT = 1e9; G.uiBlockDamage = true; });

  const r = await ev(async () => {
    const G = window.__G, h = window.__hack;
    // contabilidad de escuchas de window y de temporizadores creados desde ahora
    const live = new Map(); // "tipo" → Set de funciones
    const addO = window.addEventListener.bind(window), remO = window.removeEventListener.bind(window);
    window.addEventListener = (t, f, o) => { if (typeof f === 'function') { if (!live.has(t)) live.set(t, new Set()); live.get(t).add(f); } return addO(t, f, o); };
    window.removeEventListener = (t, f, o) => { live.get(t) && live.get(t).delete(f); return remO(t, f, o); };
    const count = () => ['keydown', 'keyup', 'resize'].map((t) => (live.get(t) ? live.get(t).size : 0));
    const base = count();
    const timers = new Set();
    const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
    window.setInterval = (f, ms, ...a) => { const id = si(f, ms, ...a); timers.add(id); return id; };
    window.clearInterval = (id) => { timers.delete(id); return ci(id); };

    const kinds = h.api.kinds, out = { sesiones: 0, errores: [], abiertas: 0 };
    let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    window.addEventListener('error', (e) => out.errores.push(String(e.message)));
    const pump = (s, n) => { for (let i = 0; i < n && s && !s.ended; i++) { s.manual = true; h.step(1, 0.1, rnd() < 0.5); } };
    for (let i = 0; i < 160; i++) {
      const k = kinds[Math.floor(rnd() * kinds.length)];
      const how = Math.floor(rnd() * 6);
      const hd = h.api.run({ title: 'Estrés ' + i, kinds: [k], layers: 1 + Math.floor(rnd() * 2), diff: 1 + Math.floor(rnd() * 4), noPre: rnd() < 0.7, seed: 1000 + i, noExtra: true }, () => { out.cbs = (out.cbs | 0) + 1; });
      if (!hd) { out.noAbre = (out.noAbre | 0) + 1; document.querySelector('#panel [data-close]')?.click(); continue; }
      out.sesiones++;
      let s = h.s;
      if (s && s.state === 'pre') { document.querySelector('#hkGo')?.click(); }
      pump(h.s, Math.floor(rnd() * 400));
      s = h.s;
      if (how === 0) document.querySelector('#panel [data-close]')?.click(); // ✕
      else if (how === 1) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); // Esc
      else if (how === 2) document.querySelector('#hkAb')?.click(); // Desconectar
      else if (how === 3) { // otra sesión encima (la antigua se limpia sola)
        document.querySelector('#panel [data-close]')?.click();
        const hd2 = h.api.run({ title: 'Encima', kinds: ['fw'], layers: 1, diff: 1, noPre: true, noExtra: true, seed: 5 }, null);
        if (hd2) { pump(h.s, 20); document.querySelector('#panel [data-close]')?.click(); }
      } else if (how === 4) { const res = h.autoplay(25); document.querySelector('#hkOk')?.click(); document.querySelector('#panel [data-close]')?.click(); }
      else { pump(h.s, 1200); document.querySelector('#hkOk')?.click(); document.querySelector('#panel [data-close]')?.click(); }
      if (G.uiOpen) { out.abiertas++; document.querySelector('#panel [data-close]')?.click(); }
      if (h.s) { out.huerfanas = (out.huerfanas | 0) + 1; }
      await new Promise((r) => setTimeout(r, 0));
    }
    await new Promise((r) => setTimeout(r, 100));
    out.cv = document.querySelectorAll('.hk-cv, .hk-game, .hk-pre').length;
    out.listeners = { base, ahora: count() };
    out.timers = timers.size;
    out.active = h.api.active();
    out.ui = G.uiOpen;
    return out;
  });
  check('160 sesiones al azar (✕, Esc, desconectar, otra encima, resolver con bots, agotar el tiempo) sin errores de página', r.errores.length === 0 && r.sesiones >= 120, JSON.stringify({ sesiones: r.sesiones, errores: r.errores.slice(0, 3), noAbre: r.noAbre | 0 }));
  check('no queda ninguna sesión ni panel abierto', r.active === false && r.ui === null && r.cv === 0 && !r.huerfanas, JSON.stringify({ active: r.active, ui: r.ui, cv: r.cv, huerfanas: r.huerfanas | 0 }));
  check('las escuchas de teclado y resize vuelven al nivel inicial (sin fugas)', r.listeners.ahora.join() === r.listeners.base.join(), JSON.stringify(r.listeners));
  check('no quedan intervalos vivos de los minijuegos antiguos', r.timers === 0, 'temporizadores ' + r.timers);
  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de consola nuevos', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((x) => !x.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

// HACKEO ↔ LORE con el Archivo REAL (31d-lore.js del frente LORE): hay que usar una build que incluya los dos frentes
// (p. ej. la combinada de /tmp: copia de este árbol + 31d-lore.js, _prelude.lore.js y engine/lore-data.js del otro worktree).
// Si la build no tiene el Archivo (window.__lore) el guion se salta sin fallar.
//   node tools/shot.mjs --html /ruta/combo.html --scenario tools/scenarios/hackeo-lore-real.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  const has = await ev(() => !!window.__lore && !!window.__G.loreApi && !!window.__G.hackApi);
  if (!has) { console.log('SKIP  esta build no incluye el Archivo (frente LORE): usa la build combinada'); return; }
  await api.region('desierto');
  await ev(() => { const G = window.__G; G.world.packCd = 1e9; G.world.evT = 1e9; G.uiBlockDamage = true; });

  // 1 · cifrado con la clave de ARGOS real
  const c1 = await ev(() => {
    const A = window.__G.loreApi, h = window.__hack, out = {};
    const antes = h.games.cipher.gen(777, 3); out.antes = antes.word;
    const hint0 = A.hintFor('complejo.clave'); out.known0 = !!hint0.known; out.kind = hint0.kind; out.value = hint0.value;
    A.reveal('complejo.clave', true); // el jugador «anota» la pista leyendo la entrada
    const hint1 = A.hintFor('complejo.clave'); out.known1 = !!hint1.known;
    const g = h.games.cipher.gen(777, 3);
    out.despues = g.word; out.fin = g.plain.slice(-18); out.reveal = [...new Set(String(hint1.value).split(''))].every((ch) => g.reveal.includes(g.map[ch]));
    out.valida = h.games.cipher.validate(777, 3).ok;
    return out;
  });
  check('la pista «complejo.clave» del Archivo real es una palabra y, una vez anotada, entra en el cifrado', c1.kind === 'word' && c1.antes === null && c1.known1 && c1.despues === c1.value && /CLAVE /.test(c1.fin) && c1.reveal && c1.valida, JSON.stringify(c1));

  // 2 · el Archivo lanza el descifrado de un chip real y recibe q = 1
  const pick = await ev(() => {
    const A = window.__G.loreApi;
    const e = A.entries.find((q) => q.k === 'chip' && !q.boss && !q.secret && (q.d || 2) <= 2);
    if (!e) return null;
    window.__lore.grant(e.id, { quiet: true });
    const before = A.get(e.id);
    window.__lore.open('chips', e.id);
    return { id: e.id, q0: before.q, readable0: before.readable, ui: window.__G.uiOpen };
  });
  check('un chip cifrado real aparece como no legible en el Archivo', pick && pick.q0 === 0 && pick.readable0 === false && pick.ui === 'archive', JSON.stringify(pick));
  if (!pick) return process.exit(1);
  const f1 = await ev(() => {
    const G = window.__G, h = window.__hack, out = {};
    const btn = document.querySelector('[data-lo="decrypt"]');
    out.boton = !!btn;
    btn && btn.click();
    out.abre = G.uiOpen === 'hack' && /Chip cifrado/.test(document.querySelector('#panel h2')?.textContent || '');
    out.sub = document.querySelector('.hk-card h3')?.textContent || '';
    document.querySelector('#hkGo')?.click();
    const res = h.autoplay(900);
    out.res = res && { ok: res.ok, q: res.q, capas: res.capas };
    document.querySelector('#hkOk')?.click();
    return out;
  });
  await wait(3);
  const f2 = await ev((id) => {
    const A = window.__G.loreApi, e = A.get(id);
    return { q: e.q, readable: e.readable, ui: window.__G.uiOpen, tab: document.querySelector('#panel h2')?.textContent, tr: window.__lore.state().tr && window.__lore.state().tr[id] };
  }, pick.id);
  check('pulsar «Descifrar chip» abre el hackeo (chip, dos capas) con el nombre real de la entrada', f1.boton && f1.abre && f1.sub.length > 3 && f1.res && f1.res.ok && f1.res.q === 1 && f1.res.capas >= 2, JSON.stringify(f1));
  check('al cerrar el resultado el Archivo marca el chip como descifrado (q = 1, legible) y se reabre en su pestaña', f2.q === 1 && f2.readable === true && f2.ui === 'archive', JSON.stringify(f2));

  // 3 · fallo y desconexión: el Archivo anota el intento (q 0) sin avance gratis
  const pick2 = await ev(() => {
    const A = window.__G.loreApi;
    const e = A.entries.find((q) => q.k === 'chip' && !q.boss && !q.secret && A.get(q.id).q === 0);
    window.__lore.grant(e.id, { quiet: true });
    window.__G.uiOpen && document.querySelector('#panel [data-close]')?.click();
    window.__lore.open('chips', e.id);
    return e.id;
  });
  const g1 = await ev(() => {
    const h = window.__hack;
    document.querySelector('[data-lo="decrypt"]')?.click();
    document.querySelector('#hkGo').click();
    const s = h.s; s.manual = true; s.trace = 99.99; h.step(5, 1 / 60);
    document.querySelector('#hkOk')?.click();
    return { last: h.HK.last && { ok: h.HK.last.ok, q: h.HK.last.q } };
  });
  await wait(3);
  const g2 = await ev((id) => { const A = window.__G.loreApi; return { q: A.get(id).q, readable: A.get(id).readable, tr: window.__lore.state().tr && window.__lore.state().tr[id], ui: window.__G.uiOpen }; }, pick2);
  check('chip fallido: el Archivo no lo da por descifrado (q 0, un intento anotado) y vuelve a su pestaña', g1.last && g1.last.ok === false && g1.last.q === 0 && g2.q === 0 && g2.readable === false && g2.ui === 'archive', JSON.stringify({ g1, g2 }));

  // 4 · chip como botín de cámara acorazada (loreApi.next + grant reales)
  const r4 = await ev(() => {
    const G = window.__G, h = window.__hack, A = G.loreApi, p = G.player;
    // región de un chip aún sin hallar (en el valle solo hay chips de jefe, que no se dan como botín)
    const objetivo = A.entries.find((e) => e.k === 'chip' && !e.boss && !e.secret && !A.has(e.id));
    const ent = { k: 'terminal', id: 'term_real_loot', x: p.x + 2, z: p.z, eff: 'cache', diff: 2, reg: objetivo ? objetivo.reg : 1 };
    const expected = A.next('chip', ent.reg); // lo que el Archivo dará a continuación en esa región
    const sp = h.terminalSpec(ent, { lockUntil: 0 }); sp.loot = false;
    let got = null;
    const found0 = A.entries.filter((e) => A.has(e.id)).length;
    for (let i = 0; i < 200 && !got; i++) { h.rng(300 + i); h.rewards({ spec: sp, risk: 2 }, { capas: 3 }, []); G.pickups.length = 0; const f = A.entries.filter((e) => A.has(e.id)).length; if (f > found0) got = i; }
    const nuevo = A.entries.find((e) => A.has(e.id) && A.get(e.id).q === 0 && e.k === 'chip');
    const nuevoId = expected && A.has(expected);
    return { got, reg: ent.reg, esperado: expected, concedido: !!nuevoId, found0, found1: A.entries.filter((e) => A.has(e.id)).length, esChip: !!nuevo };
  });
  check('la cámara acorazada concede un chip real del Archivo (de la región del terminal)', r4.got !== null && r4.found1 === r4.found0 + 1 && r4.concedido, JSON.stringify(r4));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni de consola nuevos', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

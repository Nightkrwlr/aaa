// HACKEO · contratos con otros frentes y entrada de teclado: x.loreApi simulada (o la real si existe), run({kind:"chip"}) del Archivo,
// callback entregado tras cerrar el panel, cifrado con la clave de ARGOS, chip como botín de cámara acorazada, tecla V y Esc.
//   node tools/build.mjs --dev --out dist/dev.html
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/hackeo-lore.mjs --size 640x360 --quality low --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, logs, page } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  // D11: los enemigos ya no se hackean a mano por defecto (x.cfg.hack.enemy.manual = false; ahora se hackean máquinas, ver maquinas-core). Aquí se reactiva para seguir probando el motor de la sesión con enemigos.
  await ev(() => { window.__hack.cfg.enemy.manual = true; });
  await api.region('desierto');
  await ev(() => { const G = window.__G; G.world.packCd = 1e9; G.world.evT = 1e9; G.uiBlockDamage = true; });

  // ── 1 · cifrado con la clave de ARGOS (hint known) ──
  const ci = await ev(() => {
    const G = window.__G, h = window.__hack, out = {};
    const had = !!G.loreApi;
    // sin Archivo: el cifrado no cambia y no hay palabra
    delete G.loreApi;
    const g0 = h.games.cipher.gen(4242, 3); out.sinArchivo = { word: g0.word, plainEnd: g0.plain.slice(-12) };
    out.v0 = h.games.cipher.validate(4242, 3).ok;
    G.loreApi = {
      entries: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }], has: () => true,
      hintFor: (k) => (k === 'complejo.clave' ? { kind: 'word', value: 'CENTINELA', known: true, display: 'CENTINELA' } : { kind: 'digits', known: false, display: '1 2 3 4' }),
    };
    const g1 = h.games.cipher.gen(4242, 3);
    out.conArchivo = { word: g1.word, plainEnd: g1.plain.slice(-16), hint: g1.hint, revealOk: [...new Set('CENTINELA')].every((ch) => g1.reveal.includes(g1.map[ch])) };
    out.v1 = h.games.cipher.validate(4242, 3).ok;
    // si la pista no es una palabra o no está anotada, no se usa
    G.loreApi.hintFor = () => ({ kind: 'word', value: 'CENTINELA', known: false });
    out.noConocida = h.games.cipher.gen(4242, 3).word;
    G.loreApi.hintFor = () => ({ kind: 'word', value: 'x<script>', known: true });
    out.rara = h.games.cipher.gen(4242, 3).word;
    // validate() de toda la familia con el Archivo activo
    G.loreApi.hintFor = (k) => (k === 'complejo.clave' ? { kind: 'word', value: 'ALBA', known: true } : null);
    let okAll = true; for (let d = 1; d <= 5; d++) for (let i = 0; i < 20; i++) if (!h.games.cipher.validate(100 + i * 13, d).ok) okAll = false;
    out.todo = okAll;
    if (!had) delete G.loreApi;
    return out;
  });
  check('cifrado sin Archivo: sin palabra y sigue siendo resoluble', ci.sinArchivo.word === null && ci.v0, JSON.stringify(ci.sinArchivo));
  check('cifrado con la clave de ARGOS leída: el mensaje termina con ella, la pista la cita y sus letras vienen puestas', ci.conArchivo.word === 'CENTINELA' && /CLAVE CENTINELA$/.test(ci.conArchivo.plainEnd) && /CENTINELA/.test(ci.conArchivo.hint) && ci.conArchivo.revealOk && ci.v1, JSON.stringify(ci.conArchivo));
  check('pistas no anotadas o raras se ignoran; validate() sigue cumpliéndose (100 puzles)', ci.noConocida === null && ci.rara === null && ci.todo, JSON.stringify({ n: ci.noConocida, r: ci.rara, t: ci.todo }));

  // ── 2 · el Archivo lanza el descifrado: run({kind:"chip"}) ──
  const ch = await ev(() => {
    const G = window.__G, h = window.__hack, out = {}, calls = [], got = [];
    G.loreApi = { entries: [], has: () => true, decrypt: (id, q) => { calls.push([id, q]); return { ok: q >= 1, q }; }, hintFor: () => null };
    // a) éxito: el callback llega al cerrar, con q = 1, y hackeo NO llama a decrypt (lo hace el Archivo)
    const hd = h.api.run({ kind: 'chip', id: 'chip_L1', name: 'Registro de prueba', tier: 3, diff: 3, lore: true }, (r) => got.push(r));
    out.abre = !!hd && /Chip cifrado/.test(document.querySelector('#panel h2')?.textContent || '');
    out.sub = document.querySelector('.hk-card h3')?.textContent || '';
    document.querySelector('#hkGo').click();
    const res = h.autoplay(600);
    out.antes = { res: !!res, ok: res && res.ok, q: res && res.q, cb: got.length, calls: calls.length };
    document.querySelector('#hkOk').click();
    out.despues = { cb: got.length, q: got[0] && got[0].q, ok: got[0] && got[0].ok, chip: got[0] && got[0].chip, calls: calls.length, ui: window.__G.uiOpen };
    // b) fallo: q parcial según las capas superadas (0 capas → 0), sin llamar a decrypt
    h.api.run({ kind: 'chip', id: 'chip_L2', diff: 2, lore: true }, (r) => got.push(r));
    document.querySelector('#hkGo').click();
    const s = h.s; s.manual = true; s.trace = 99.99; h.step(5, 1 / 60);
    document.querySelector('#hkOk').click();
    out.fallo = { ok: got[1] && got[1].ok, q: got[1] && got[1].q, calls: calls.length };
    return out;
  });
  check('run({kind:"chip", lore:true}) abre «Chip cifrado» con el nombre del chip', ch.abre && /Registro de prueba/.test(ch.sub), ch.sub);
  check('el callback del Archivo se entrega DESPUÉS de cerrar el panel, con ok y q = 1; hackeo no duplica decrypt()', ch.antes.ok && ch.antes.cb === 0 && ch.despues.cb === 1 && ch.despues.q === 1 && ch.despues.ok && ch.despues.chip === 'chip_L1' && ch.despues.calls === 0 && ch.despues.ui === null, JSON.stringify(ch));
  check('chip fallido: ok false, q parcial (0 con 0 capas superadas) y sin llamar a decrypt', ch.fallo.ok === false && ch.fallo.q === 0 && ch.fallo.calls === 0, JSON.stringify(ch.fallo));
  const ab = await ev(async () => {
    const G = window.__G, h = window.__hack, got = [];
    h.api.run({ kind: 'chip', id: 'chip_L3', diff: 2, lore: true }, (r) => got.push(r));
    document.querySelector('#hkGo').click();
    document.querySelector('#hkAb').click(); // desconectar
    await new Promise((r) => setTimeout(r, 60));
    return { cb: got.length, abortado: got[0] && got[0].abortado, q: got[0] && got[0].q, ok: got[0] && got[0].ok, ui: G.uiOpen };
  });
  check('desconectar a mitad: callback con abortado, ok false y q = 0 (sin avance gratis en el Archivo)', ab.cb === 1 && ab.abortado === true && ab.ok === false && ab.q === 0 && ab.ui === null, JSON.stringify(ab));

  // ── 3 · decryptChip directo (otros frentes): llama a decrypt con q ──
  const dc = await ev(() => {
    const G = window.__G, h = window.__hack, calls = [];
    G.loreApi = { entries: [], has: () => true, decrypt: (id, q) => { calls.push([id, q]); return { ok: q >= 1, q }; }, hintFor: () => null };
    h.api.decryptChip('chip_D1', null, { diff: 2 });
    document.querySelector('#hkGo').click();
    const res = h.autoplay(600);
    const txt = document.querySelector('.hk-res')?.textContent || '';
    document.querySelector('#hkOk').click();
    return { ok: res && res.ok, calls, txt: /Chip descifrado/.test(txt), chips: h.state().stats.chips };
  });
  check('decryptChip(id): llama a loreApi.decrypt(id, 1) al superar las dos capas y cuenta el chip', dc.ok && dc.calls.length === 1 && dc.calls[0][0] === 'chip_D1' && dc.calls[0][1] === 1 && dc.txt && dc.chips >= 1, JSON.stringify(dc));

  // ── 4 · chip como botín de cámara acorazada ──
  const rw = await ev(() => {
    const G = window.__G, h = window.__hack, p = G.player, out = {};
    const given = [];
    G.loreApi = { entries: [], has: () => true, next: (k, reg) => { given.push([k, reg]); return 'chip_R1'; }, grant: (id) => { out.granted = id; return true; }, hintFor: () => null };
    const ent = { k: 'terminal', id: 'term_chip_loot', x: p.x + 2, z: p.z, eff: 'cache', diff: 2, reg: 2 };
    // se llama a la función de recompensas con una sesión simulada (jugar 40 hackeos de verdad costaría minutos)
    const run = (e, risk, capas, seed) => { h.rng(seed); out.granted = null; const sp = h.terminalSpec(e, { lockUntil: 0 }); sp.loot = false; h.rewards({ spec: sp, risk }, { capas }, []); G.pickups.length = 0; return !!out.granted; };
    let hits = 0; const N = 400;
    for (let i = 0; i < N; i++) if (run(ent, 1, 2, 1000 + i)) hits++;
    out.n = N; out.hits = hits; out.reg = given.length ? given[0] : null;
    let hitsHi = 0; for (let i = 0; i < N; i++) if (run(ent, 2, 3, 5000 + i)) hitsHi++;
    out.hitsHi = hitsHi;
    // un relé (no acorazado) nunca da chip
    const rel = { k: 'terminal', id: 'term_relay_nochip', x: p.x + 2, z: p.z, eff: 'relay', diff: 1, reg: 2 };
    let relayChip = 0; for (let i = 0; i < 100; i++) if (run(rel, 2, 3, 9000 + i)) relayChip++;
    out.relayChip = relayChip;
    return out;
  });
  // esperado: riesgo estándar 2 capas 14 % (56 de 400 ± 7), agresivo 3 capas 25 % × 1,5 = 37,5 % (150 de 400 ± 10)
  check('cámara acorazada con Archivo: guarda un chip ≈14 % (estándar, 2 capas) y ≈38 % (agresivo, 3 capas); un relé nunca', rw.hits > 36 && rw.hits < 80 && rw.hitsHi > 115 && rw.hitsHi < 185 && rw.reg && rw.reg[0] === 'chip' && rw.reg[1] === 2 && rw.relayChip === 0, JSON.stringify({ n: rw.n, hits: rw.hits, hitsHi: rw.hitsHi, reg: rw.reg, relay: rw.relayChip }));

  // ── 5 · tecla V y Esc ──
  const v = await ev(() => {
    const G = window.__G, h = window.__hack, p = G.player;
    G.uiOpen && document.querySelector('#panel [data-close]')?.click(); G.paused = false;
    delete G.loreApi;
    for (const e of G.enemies) e.dead = true;
    const tur = window.__spawn('torreta', 5, p.x + 2.5, p.z + 0.5);
    window.__step(12, 1 / 30);
    return { cand: h.HK.cand && h.HK.cand.id, ui: G.uiOpen };
  });
  await page.keyboard.down('KeyV'); await wait(3); await page.keyboard.up('KeyV'); await wait(2);
  const v2 = await ev(() => ({ ui: window.__G.uiOpen, title: document.querySelector('#panel h2')?.textContent, esc: /Esc/.test(document.querySelector('.hk-pre')?.textContent || '') }));
  check('tecla V sobre una torreta hackeable abre la intrusión', v.cand === 'torreta' && v2.ui === 'hack' && /Intrusi/.test(v2.title || ''), JSON.stringify({ v, v2 }));
  await page.keyboard.press('Escape'); await wait(3);
  const v3 = await ev(() => ({ ui: window.__G.uiOpen, last: window.__hack.HK.last && window.__hack.HK.last.abortado, busy: window.__hack.api.active() }));
  check('Esc desconecta sin penalización (cierra el panel, sin sesión huérfana)', v3.ui === null && v3.last === true && v3.busy === false, JSON.stringify(v3));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni de consola nuevos', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

// Puzles (D7) · integración REAL con los otros frentes (esta build incluye 31d-lore y 31e-hacking): runas dictadas por el Archivo
// (x.loreApi.hintFor), documentos como premio (loreApi.next/grant), atajo electrónico por hackeo (x.hackApi.run) y botín/XP de ECONOMÍA.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/puzles-lore.mjs --size 960x540 --out /ruta
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });
  await api.region('desierto');
  const spawn = (kind, tier, idx, extra = {}) => ev(([kind, tier, idx, extra]) => {
    const P = window.__puzzles, G = window.__G;
    let rt = null;
    for (let a = 0; a < 8 && !rt; a++) rt = P.spawn(kind, tier, idx, { radius: 26, dx: (a % 3 - 1) * 10, dz: (Math.floor(a / 3) - 0.5) * 12, id: 'pz_i_' + kind, ...extra });
    if (!rt) return { ok: false };
    const z = rt.pz;
    const T = z.T, lx = z.d.lw / 2, lz = z.d.lh + 1.0;
    G.player.x = T.tx + T.m00 * lx + T.m01 * lz; G.player.z = T.tz + T.m10 * lx + T.m11 * lz; G.player.inv = 9999; G.S.settings.aim = 'auto';
    window.__step(12, 1 / 30);
    return { ok: true, id: rt.e.id, mode: z.spec.mode, n: z.spec.n, active: P.PZ.active === rt };
  }, [kind, tier, idx, extra]);

  // ── 1 · el Archivo existe y su vocabulario de glifos coincide con las runas ──
  const v = await ev(() => { const A = window.__G.loreApi, P = window.__puzzles; if (!A) return null; return { glyphs: A.vocab.glyphs, runes: P.gens.runes && [...Array(8).keys()].map((i) => i) , cfg: Object.keys(A.entries).length }; });
  check('x.loreApi existe (build combinada)', !!v, JSON.stringify(v && v.glyphs));
  const same = await ev(() => { const A = window.__G.loreApi; const names = ['Sol', 'Luna', 'Serpiente', 'Ojo', 'Cristal', 'Raíz', 'Llama', 'Onda']; return A.vocab.glyphs.every((g, i) => g === names[i]); });
  check('los 8 glifos del Archivo coinciden, en orden, con las 8 runas del puzle', same);

  // ── 2 · runas dictadas por el documento de la región ──
  const hint = await ev(() => { const A = window.__G.loreApi; const h = A.hintFor('desierto.runas'); return { seq: h.seq, names: h.names, display: h.display, known: h.known, what: h.what, entry: h.entry }; });
  console.log('pista', JSON.stringify(hint));
  const s1 = await spawn('runes', 2, 4, { lore: { key: 'desierto.runas', len: 4 } });
  const spec = await ev(() => { const z = window.__puzzles.rt('pz_i_runes').pz; const names = ['Sol', 'Luna', 'Serpiente', 'Ojo', 'Cristal', 'Raíz', 'Llama', 'Onda']; return { mode: z.spec.mode, key: z.spec.key, order: z.spec.order, ids: z.spec.ids, n: z.spec.n, len: z.spec.len, ordenGlifos: z.spec.order.map((i) => names[z.spec.ids[i]]), decoys: z.spec.ids.slice(z.spec.len).map((i) => names[i]) }; });
  check('con el Archivo, el acertijo de runas es la variante «lore» con 4 runas y 2 señuelos', s1.ok && spec.mode === 'lore' && spec.len === 4 && spec.n === 6 && spec.key === 'desierto.runas', JSON.stringify(spec));
  check('el orden de activación es EXACTAMENTE el que da hintFor(desierto.runas)', JSON.stringify(spec.ordenGlifos) === JSON.stringify(hint.names), `${spec.ordenGlifos} vs ${hint.names}`);
  check('los señuelos no están en la pista', spec.decoys.every((d) => !hint.names.includes(d)), spec.decoys.join(','));
  const t0 = await ev(() => document.querySelector('#pzHud .pzc')?.innerText || '');
  check('sin haber leído el documento, la inscripción es ilegible y remite al Archivo', /ilegible/i.test(t0) && /Archivo/.test(t0) && !t0.includes(hint.display), t0.replace(/\n/g, ' | '));
  // el botón Pista anota la pista en el Archivo (loreApi.reveal) y la inscripción pasa a coincidir con lo anotado
  await page.click('#pzHud button[data-pz="hint"]'); await wait(3);
  const t1 = await ev(() => ({ c: document.querySelector('#pzHud .pzc')?.innerText || '', known: window.__G.loreApi.hintFor('desierto.runas').known }));
  check('«Pista» anota los glifos en el Archivo y la inscripción lo refleja', t1.known && t1.c.includes(hint.display), t1.c.replace(/\n/g, ' | '));
  await shot('runas-lore');
  // un señuelo cuesta: error, runas apagadas, daño que no mata
  const dec = await ev(() => {
    const P = window.__puzzles, G = window.__G, rt = P.rt('pz_i_runes'), z = rt.pz;
    const id = z.spec.len; // primer señuelo
    const hp0 = G.player.hp; G.player.inv = 0; G.player.hp = 5; // casi muerto: el daño del acertijo no debe matarlo
    const [wx, wz] = (() => { const f = z.gen.focus(z.spec, z.st, id), T = z.T; const sx = f[0] + 0.5, sz = f[1] + 1.4; return [T.tx + T.m00 * sx + T.m01 * sz, T.tz + T.m10 * sx + T.m11 * sz]; })();
    G.player.x = wx; G.player.z = wz;
    const T = z.T, f = z.gen.focus(z.spec, z.st, id);
    G.player.face = Math.atan2((T.tx + T.m00 * (f[0] + 0.5) + T.m01 * (f[1] + 0.5)) - wx, (T.tz + T.m10 * (f[0] + 0.5) + T.m11 * (f[1] + 0.5)) - wz);
    window.__step(2, 1 / 30);
    const pick = P.PZ.pickId;
    G.world.updatePrompt(); G.world.interact(); window.__step(2, 1 / 30);
    const r = { pick, id, errors: z.st.errors, k: z.st.k, hp: G.player.hp, dead: G.player.dead, msg: z.msg && z.msg.text };
    G.player.hp = G.player.maxHp; G.player.inv = 9999;
    return r;
  });
  check('pulsar un señuelo da error (runas apagadas) y el daño nunca mata', dec.pick === dec.id && dec.errors === 1 && dec.k === 0 && !dec.dead && dec.hp > 0 && /equivocado/i.test(dec.msg || ''), JSON.stringify(dec));
  // premio: documento del Archivo (probabilidad forzada a 1 solo en la prueba)
  const rew = await ev(() => {
    const P = window.__puzzles, G = window.__G, A = G.loreApi, rt = P.rt('pz_i_runes');
    P.cfg.reward.lore = { 1: 1, 2: 1, 3: 1 };
    const found0 = Object.values(G.S.lore.f || {}).length, xp0 = G.S.xp, lvl0 = G.S.lvl;
    const out = P.bot(rt);
    window.__step(4, 1 / 30);
    const last = P.PZ.events[P.PZ.events.length - 1];
    return { out, found: Object.values(G.S.lore.f || {}).length - found0, ev: last && { kind: last.kind, tier: last.tier, perfect: last.perfect, errors: last.errors, drops: last.drops, how: last.how, lvl: last.lvl }, xp: (G.S.xp - xp0) + (G.S.lvl - lvl0) * 1e6 };
  });
  check('las runas del Archivo se resuelven en el orden dictado', rew.out.ok, JSON.stringify(rew.out));
  check('el acertijo suelta un documento nuevo del Archivo (premio de lore)', rew.found >= 1, `entradas nuevas: ${rew.found}`);
  check('puzzleSolved lleva el tipo, el nivel, los errores y no es «perfecto» (hubo un error y una pista)', rew.ev && rew.ev.kind === 'runes' && rew.ev.tier === 2 && rew.ev.errors === 1 && rew.ev.perfect === false && rew.ev.drops > 0, JSON.stringify(rew.ev));
  check('el premio da XP (ECONOMÍA: ecoGrantXp) y botín por tier', rew.xp > 0, `xp ${rew.xp}`);
  await ev(() => window.__puzzles.remove('pz_i_runes'));

  // ── 3 · sin Archivo el puzle de runas vuelve a las pistas lógicas (defensivo) ──
  const nol = await ev(() => {
    const G = window.__G, P = window.__puzzles, A = G.loreApi;
    G.loreApi = A; const saved = window.__G.loreApi; // x.loreApi vive en x (= __G)
    delete G.loreApi;
    let rt = null;
    for (let a = 0; a < 8 && !rt; a++) rt = P.spawn('runes', 2, 4, { radius: 26, dx: (a % 3 - 1) * 10, dz: (Math.floor(a / 3) - 0.5) * 12, id: 'pz_nolore', lore: { key: 'desierto.runas', len: 4 } });
    const mode = rt && rt.pz && rt.pz.spec.mode;
    rt && P.remove('pz_nolore');
    G.loreApi = saved;
    return { mode, restored: !!window.__G.loreApi };
  });
  check('sin x.loreApi, el puzle pedido «lore» cae a la inscripción con pistas lógicas', nol.mode === 'clues' && nol.restored, JSON.stringify(nol));

  // ── 4 · colocación: en el Desierto/Colmena las mazmorras con runas son de la variante del Archivo ──
  const pl = await ev(() => {
    const P = window.__puzzles, G = window.__G;
    const R = P.pure.rng(5); const out = { lore: 0, runasDes: 0, otrosDes: 0, fuera: 0, ok: true };
    const stairs = G.world.map.ents.filter((e) => e.k === 'stairs' && e.enc !== 'puzzle');
    for (let i = 0; i < 160; i++) {
      const e = R.pick(stairs); const reg = e.reg | 0; const t = window.__De[reg];
      const n = { sub: true, ent: e, enc: e.enc, reg, lvl: 12, mods: [], theme: null, obj: 'sub', pool: t, seed: R.int(1, 1e9) };
      const m = P.rawSub(n); const ent = P.place(m, n); if (!ent) continue;
      const key = t.key;
      if (ent.pz.lore) { out.lore++; if (!(key === 'desierto' || key === 'colmena') || ent.pz.kind !== 'runes') out.ok = false; }
      else if (key === 'desierto' || key === 'colmena') { ent.pz.kind === 'runes' ? out.runasDes++ : out.otrosDes++; }
    }
    return out;
  });
  check('solo el Desierto y la Colmena colocan el acertijo de runas «lore»', pl.ok && pl.lore > 0, JSON.stringify(pl));

  // ── 5 · atajo electrónico por hackeo (x.hackApi) ──
  await ev(() => { const H = window.__hack.state(); H.lvl = 12; });
  const s2 = await spawn('circuit', 1, 6, { id: 'pz_i_circuit' });
  await wait(3);
  const hk = await rect('#pzHud button[data-pz="hack"]');
  async function rect(sel) { return ev((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height }; }, sel); }
  check('un puzle electrónico (enrutado) muestra «Hackear» si existe x.hackApi', s2.ok && !!hk && hk.h >= 44, JSON.stringify(hk));
  const nb = await ev(() => { const P = window.__puzzles; return { boxesHack: !!P.gens.boxes.hackable, lasersHack: !!P.gens.lasers.hackable, runesHack: !!P.gens.runes.hackable, memHack: !!P.gens.memory.hackable }; });
  check('los puzles físicos (cajas, láser, runas, memoria) no se hackean', !nb.boxesHack && !nb.lasersHack && !nb.runesHack && !nb.memHack, JSON.stringify(nb));
  if (hk) {
    let res = null;
    for (let intento = 0; intento < 4 && !(res && res.ok); intento++) {
      await page.click('#pzHud button[data-pz="hack"]'); await wait(3);
      const open = await ev(() => window.__G.uiOpen);
      if (intento === 0) check('«Hackear» abre una sesión de hackeo (panel «hack»)', open === 'hack', String(open));
      res = await ev(() => { const h = window.__hack; document.querySelector('#hkGo')?.click(); const r = h.autoplay(300); document.querySelector('#hkOk')?.click(); document.querySelector('#panel [data-close]')?.click(); return r && { ok: r.ok, capas: r.capas, objetivo: r.objetivo }; });
      await wait(4);
    }
    const fin = await ev(() => { const P = window.__puzzles, rt = P.rt('pz_i_circuit'); const last = P.PZ.events[P.PZ.events.length - 1]; return { done: !!rt.pzDone, how: last && last.how, perfect: last && last.perfect, stats: window.__G.S.puzzleStats.hack }; });
    check('un hackeo con éxito resuelve el puzle (how = hack, nunca «perfecto») y se cuenta', res && res.ok && fin.done && fin.how === 'hack' && fin.perfect === false && fin.stats === 1, JSON.stringify({ res, fin }));
  }
  await ev(() => window.__puzzles.remove('pz_i_circuit'));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const warns = logs.filter((l) => /\[warning\]/.test(l) && /puzles/.test(l));
  check('sin avisos de [puzles]', warns.length === 0, warns.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
}

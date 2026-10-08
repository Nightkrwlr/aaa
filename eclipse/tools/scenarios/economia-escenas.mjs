// Economía: botín de 30 muertes, hitos Épico/Legendario forzados, tienda y venta en el Bastión, pestaña Botín y ruta de ascenso.
// Comprobaciones con PASS/FAIL y pocas capturas (se miran con ojos críticos; usa --size 960x540 o --device pixel7).
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();
  await ev(() => { window.__G.uiBlockDamage = true; });   // invulnerable: aquí se mira el botín, no la supervivencia

  // ── 1. migración y estado inicial
  const s0 = await ev(() => { const S = window.__G.S; return { junk: typeof S.junk, sig: typeof S.sig, hitos: Array.isArray(S.hitos), econ: !!S.econ, vm: Object.getOwnPropertyDescriptor(S.mats, 'sigilo')?.enumerable === false, diff: S.diff }; });
  check('migración: S.junk, S.sig, S.hitos, S.econ y materiales virtuales', s0.junk === 'object' && s0.sig === 'object' && s0.hitos && s0.econ && s0.vm, JSON.stringify(s0));

  // ── 2. combate: 30 muertes y su botín en el suelo
  const k = await ev(() => {
    const G = window.__G, p = G.player; let n = 0;
    const ids = ['rastrero', 'infectado', 'escupidor', 'saltador', 'avispa', 'hinchado'];
    for (let i = 0; i < 30; i++) { const a = i * 0.9, r = 4 + (i % 5); const e = window.__spawn(ids[i % ids.length], 3, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, { alerted: false }); if (e) n++; }
    const xp0 = G.S.xp, lvl0 = G.S.lvl;
    for (const e of [...G.enemies]) if (!e.dead) e.kill({});
    window.__step(24, 1 / 30);
    const kinds = {};
    for (const q of G.pickups) kinds[q.k] = (kinds[q.k] || 0) + 1;
    return { spawned: n, kinds, trophies: window.__eco.ground.length, orbs: G.pickups.filter((q) => q.k === 'xp').length, xp0, lvl0 };
  });
  check('30 enemigos generados y abatidos', k.spawned >= 25, JSON.stringify(k));
  check('las orbes de XP se funden (≤ 6 para 30 muertes simultáneas)', k.orbs <= 6, `orbes: ${k.orbs}`);
  check('hay trofeos en el suelo', k.trophies > 0, `trofeos: ${k.trophies}`);
  await api.hideUi(false);
  await shot('combate-botin');

  // recoger todo (imán) y comprobar que los trofeos llegan a S.junk (el panel de ascenso de nivel pausa el juego: se cierra)
  await ev(() => window.__dbg.UI.close());
  await ev(() => window.__step(200, 1 / 30));
  const j = await ev(() => { const S = window.__G.S; return { n: Object.values(S.junk).reduce((a, b) => a + b, 0), kinds: Object.keys(S.junk).length, credits: S.credits, lvl: S.lvl, xp: Math.round(S.xp) }; });
  check('los trofeos se recogen en S.junk', j.n > 0, JSON.stringify(j));

  // ── 3. hitos: un Épico y un Legendario forzados
  await ev(() => window.__dbg.UI.close());   // el ascenso de nivel por las muertes abre su panel de mejora
  await ev(() => { window.__eco.cfg.milestone.banner = { 3: 60, 4: 60, 5: 60 }; });   // el banner dura lo que dura la captura (GL por software es lento)
  // (la lectura del DOM va en la misma evaluación que la caída: con GL por software los fotogramas tardan segundos y el banner dura 4 s)
  const h3 = await ev(() => { window.__dbg.drop('plan', 3, 'champion'); return { banner: document.getElementById('ecoMile')?.textContent || '', flash: document.getElementById('ecoFlash')?.className, hitos: window.__G.S.hitos.length, mile: window.__G.pickups.filter((p) => p.mile).length }; });
  check('hito Épico: banner, destello, registro y pickup marcado', /ÉPICO/.test(h3.banner) && h3.flash === 'on' && h3.hitos === 1 && h3.mile === 1, JSON.stringify(h3).slice(0, 160));
  await shot('hito-epico');
  const h4 = await ev(() => { window.__dbg.drop('plan', 4, 'boss'); return { banner: document.getElementById('ecoMile')?.textContent || '', hitos: window.__G.S.hitos.length, last: window.__G.S.hitos.at(-1) }; });
  check('hito Legendario: nombre único y frase', /LEGENDARIO/.test(h4.banner) && h4.hitos === 2 && h4.last.q && /«|“/.test(h4.banner), JSON.stringify(h4.last).slice(0, 200));
  await shot('hito-legendario');
  const pil = await page.evaluate(() => { const m = window.__G.pickups.find((p) => p.mile === 4); return m && m.mesh ? m.mesh.children.length : 0; });
  check('pilar de luz añadido al pickup del hito', pil >= 3, `hijos de la malla: ${pil}`);
  const slow = await ev(() => window.__eco.ecoRnd && true);
  void slow;

  // ── 4. Bastión: tienda, venta y Botín
  await ev(() => { window.__dbg.give('trofeos', 30); window.__dbg.give('creditos', 5); });
  await ev(() => window.__dbg.openShop('vega')); await wait(6);
  const sh = await ev(() => { const S = window.__G.S; const st = S.shop.vega; return { plans: st.items.length, mods: st.chips.length, maxR: Math.max(...st.items.map((i) => i.r)), maxT: Math.max(...st.chips.map((c) => c.t)), mins: Math.round((st.until - Date.now()) / 60000) }; });
  check('tienda: 2 planos + 3 módulos, sin Raro+ ni T3+, rotación 45 min', sh.plans === 2 && sh.mods === 3 && sh.maxR <= 1 && sh.maxT <= 2 && sh.mins >= 44 && sh.mins <= 45, JSON.stringify(sh));
  await shot('tienda-comprar');
  await page.click('[data-et="sell"]'); await wait(6);
  await shot('tienda-vender');
  const before = await ev(() => ({ c: window.__G.S.credits, n: Object.values(window.__G.S.junk).reduce((a, b) => a + b, 0), v: window.__eco.ecoJunkTotals(true).v }));
  await page.click('#eSellAll'); await wait(4);
  const after = await ev(() => ({ c: window.__G.S.credits, n: Object.values(window.__G.S.junk).reduce((a, b) => a + b, 0) }));
  check('«Vender todo el botín» en la tienda paga el valor de los trofeos', after.c - before.c === Math.round(before.v) && after.n <= before.n, `${before.c} → ${after.c} (+${before.v}), piezas ${before.n} → ${after.n}`);
  await page.click('[data-et="cur"]'); await wait(4);
  const cur = await ev(() => document.querySelectorAll('#panel .eco-row').length);
  check('Comprador de curiosidades lista las regiones', cur >= 8, `filas: ${cur}`);
  await page.keyboard.press('Escape'); await wait(3);

  // inventario con Botín: sin vendedor cerca no se puede vender; con el vendedor (Bastión) sí
  await ev(() => window.__dbg.give('trofeos', 18));
  const far = await ev(() => { const G = window.__G; G.player.x = 20; G.player.z = 20; return window.__eco.ecoCanSell(); });
  const near = await ev(() => { const G = window.__G, v = G.map.ents.find((e) => e.k === 'npc' && e.npc === 'vega'); if (!v) return null; G.player.x = v.x + 1.5; G.player.z = v.z + 1.5; return { can: window.__eco.ecoCanSell(), npc: window.__eco.ecoVendorNear() }; });
  check('venta: lejos de un vendedor no se puede; junto a Vega (Bastión) sí', far === false && near && near.can && near.npc === 'vega', JSON.stringify({ far, near }));
  await ev(() => window.__dbg.openBotin()); await wait(6);
  await shot('inventario-botin');
  await page.keyboard.press('Escape'); await wait(3);

  // ── 5. primera muerte de un jefe principal: Sigilo + XP de descubrimiento (y la segunda no repite)
  const bs = await ev(() => {
    const G = window.__G, S = G.S, p = G.player, mk = () => { const b = window.__spawn('reina', 6, p.x + 5, p.z + 5, { boss: true }); b.kill({}); };
    const x0 = S.xp + S.lvl * 1e6; mk(); const afterFirst = { sig: S.sig.reina, count: window.__eco.ecoSigCount(), xpUp: S.xp + S.lvl * 1e6 > x0 };
    mk(); return { first: afterFirst, again: S.sig.reina, junkBoss: Object.keys(S.junk).includes('reina') || window.__eco.ground.some((g) => g.id === 'reina') };
  });
  check('primera muerte de un jefe principal: 1 Sigilo (una sola vez), XP y trofeo de jefe', bs.first.sig === 1 && bs.first.count === 1 && bs.first.xpUp && bs.again === 1 && bs.junkBoss, JSON.stringify(bs));
  await ev(() => { const S = window.__G.S; S.sig = {}; S.sigSeen = {}; window.__dbg.UI.close(); });

  // ── 5b. ruta de ascenso a Legendario
  const asc = await ev(() => {
    const E = window.__eco, G = window.__G, S = G.S;
    const it = E.us(10, { type: 'weapon', rarity: 3 }); E.Ss(it, { silent: true });
    const c0 = E.qd(it);
    S.mats.crystal += 50; S.mats.core += 50; S.mats.data += 50; S.credits += 1e6;
    const noSig = E.cp(it);
    window.__dbg.give('sigilo', 3); window.__dbg.give('fragmento', 1);
    const have = { sig: E.ecoSigCount(), frag: S.eclipseFrag, matSigilo: S.mats.sigilo };
    const ok = E.cp(it);
    return { cost: c0, noSig, have, ok, r: it.r, sigAfter: E.ecoSigCount(), fragAfter: S.eclipseFrag };
  });
  check('ascender a Legendario exige 3 Sigilos + 1 Fragmento', asc.cost.sigilo === 3 && asc.cost.fragmento === 1 && asc.noSig === false && asc.ok === true && asc.r === 4 && asc.sigAfter === 0 && asc.fragAfter === 0, JSON.stringify(asc).slice(0, 260));

  // ── 6. dificultad
  const d = await ev(() => { const E = window.__eco; return { d1: E.mt.enemyDmg(1) / Math.pow(1.085, 0), d15: E.mt.enemyDmg(15) / Math.pow(1.085, 14), d30: E.mt.enemyDmg(30) / Math.pow(1.085, 29), diff: Object.fromEntries(Object.entries(E.Di).map(([k, v]) => [k, [v.hp, v.dmg]])) }; });
  check('daño temprano ×1,4 que se diluye a ×1,0 hacia el nivel 15', Math.abs(d.d1 - 1.4) < 0.01 && Math.abs(d.d15 - 1) < 0.01 && Math.abs(d.d30 - 1) < 0.01, JSON.stringify(d));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok); console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

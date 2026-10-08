// Lore (D5): comprobaciones funcionales de punta a punta en el juego real (colocación, recogida, grabación con subtítulos, chips,
// terminales, expedientes de jefe, colecciones y recompensas, operaciones, guardado, compatibilidad con los registros antiguos).
//   node tools/shot.mjs --scenario tools/scenarios/lore-demo.mjs --out /ruta --size 640x360
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await api.god(true);
  await ev(() => window.__silence && window.__silence(false));

  // ── 1. guardado: S.lore pasa de lista a objeto sin romper el código antiguo ──
  const st = await ev(() => {
    const S = window.__G.S, L = S.lore;
    const before = L.length;
    L.push(3);
    const ok = L.includes(3) && L.pads.includes(3) && L.length === before + 1;
    L.pads.splice(L.pads.indexOf(3), 1);
    const json = JSON.parse(JSON.stringify(S.lore));
    return { v: S.loreV, keys: Object.keys(S.lore).sort().join(','), shim: ok, jsonHasLen: 'length' in json, seed: S.lore.seed };
  });
  check('S.lore es un objeto con S.loreV = 1 y semilla propia', st.v === 1 && st.keys === 'c,d,f,h,o,pads,pm,r,seed,tr' && st.seed > 0, JSON.stringify(st));
  check('compatibilidad: length / includes / push apuntan a los registros antiguos y no viajan en el JSON', st.shim && !st.jsonHasLen);
  const mig = await ev(() => {
    const L = window.__lore, S = JSON.parse(JSON.stringify(window.__G.S));
    S.lore = [0, 5, 7]; delete S.loreV;                 // guardado de la build anterior: lista de índices
    L.migrate(S); const a = JSON.stringify(S.lore); L.migrate(S);   // idempotente
    return { len: S.lore.length, pads: S.lore.pads, same: a === JSON.stringify(S.lore), v: S.loreV };
  });
  check('migración desde una lista antigua: conserva los registros y es idempotente', mig.len === 3 && mig.pads.join() === '0,5,7' && mig.same && mig.v === 1, JSON.stringify(mig));

  // ── 2. colocación ──
  const plan = await ev(() => { const L = window.__lore, p = L.plan(); return { n: p.placed.length, fallback: p.fallback.length, byForm: p.byForm, nodes: L.nodes().length, term: Object.keys(L.LR.termLore).length }; });
  check('47 entradas de mundo colocadas (37 nodos + 10 en terminales) sin respaldo aleatorio', plan.n === 47 && plan.nodes === 37 && plan.term === 10 && plan.fallback === 0, JSON.stringify(plan));
  const hashes = await ev(() => {
    const m = window.__G.map, h = (a) => { let x = 2166136261 >>> 0; for (let i = 0; i < a.length; i++) { x ^= a[i]; x = Math.imul(x, 16777619) >>> 0; } return x; };
    const s = (t) => { let x = 2166136261 >>> 0; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; };
    return { ter: h(m.ter), reg: h(m.reg), blk: h(m.blk), props: s(JSON.stringify(m.props)), decor: s(JSON.stringify(m.decor)), ents: s(JSON.stringify(m.ents.filter((e) => e.k !== 'lore'))), pois: s(JSON.stringify(m.pois)) };
  });
  console.log('MAPHASH ' + JSON.stringify(hashes));
  if (process.env.EXPECT_MAP) check('el mapa generado es idéntico al de la build sin lore', JSON.stringify(hashes) === process.env.EXPECT_MAP, 'hash ' + JSON.stringify(hashes));

  const stand = (id, clear) => ev(([id, clear]) => {
    const G = window.__G, L = window.__lore, n = L.nodes().find((e) => e.lid === id);
    if (!n) return null;
    // sitio libre desde el que se vea el nodo (sin pared de por medio)
    const m = G.map; let at = [n.x + 1, n.z + 1];
    outer: for (const r of [0.9, 1.3, 1.7]) for (let k = 0; k < 16; k++) { const a = n.ang + k * 0.393, px = n.x + Math.sin(a) * r, pz = n.z + Math.cos(a) * r; if (!m.circleHits(px, pz, G.player.r) && m.los(px, pz, n.x, n.z)) { at = [px, pz]; break outer; } }
    if (G.mode === 'world') G.world.loadWorld({ x: at[0], z: at[1] }); else { G.player.x = at[0]; G.player.z = at[1]; }
    G.player.vx = G.player.vz = 0;
    window.__step(30, 1 / 30);   // ≥ 0,4 s de simulación: el director de mundo crea el registro de un nodo recién generado en su siguiente barrido
    if (clear) for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - G.player.x, e.z - G.player.z) < 16) { e.dead = true; e.deadT = 0; }
    const near = G.enemies.filter((e) => !e.dead && Math.hypot(e.x - G.player.x, e.z - G.player.z) < 16).length;
    return { d: +Math.hypot(G.player.x - n.x, G.player.z - n.z).toFixed(2), prompt: G.prompt ? G.prompt.text : null, near, mode: G.mode };
  }, [id, clear]);
  const closeUi = async () => { if (await ev(() => window.__G.uiOpen)) { await page.keyboard.press('Escape'); await wait(3); } };
  const press = async () => { await page.keyboard.press('e'); await ev(() => window.__step(3, 1 / 30)); await wait(2); };
  const nodeOf = (form, kind) => ev(([f, k]) => { const n = window.__lore.nodes().find((e) => e.form === f && (!k || e.kind === k)); return n ? { id: n.lid, x: n.x, z: n.z } : null; }, [form, kind]);

  // ── 3. estantería → libro: aviso, recogida, lector automático si no hay enemigos cerca ──
  const sh = await nodeOf('shelf', 'libro') || await nodeOf('book', 'libro');
  const s1 = await stand(sh.id, true);
  check('junto a la estantería sale el aviso «Hojear la estantería» (o «Recoger libro»)', /Hojear|Recoger libro/.test(s1.prompt || ''), JSON.stringify(s1));
  await shot('estanteria');
  await press();
  const r1 = await ev((id) => ({ found: !!window.__G.S.lore.f[id], gone: !window.__lore.nodes().some((e) => e.lid === id), ui: window.__G.uiOpen }), sh.id);
  check('E recoge el libro: queda hallado y el nodo desaparece', r1.found && r1.gone, JSON.stringify(r1));
  check('con la zona despejada (16 m) se abre solo el lector del Archivo', r1.ui === 'archive' && s1.near === 0, r1.ui + ' (enemigos cerca: ' + s1.near + ')');
  await shot('lector');
  await closeUi();

  // ── 4. grabación: reproducción automática con subtítulos y parada al tocar ──
  const rc = await nodeOf('rec', 'grab');
  const s2 = await stand(rc.id);
  check('junto al equipo de radio: «Escuchar la grabación»', s2.prompt === 'Escuchar la grabación', JSON.stringify(s2));
  await press(); await page.waitForTimeout(900);
  const v1 = await ev(() => { const el = document.getElementById('loreSub'); return { playing: !!window.__lore.voiceAt(), shown: el && el.style.display === 'block', who: el && el.querySelector('.who').textContent, txt: el && el.textContent.length }; });
  check('la grabación suena sola y aparecen los subtítulos con el nombre del hablante', v1.playing && v1.shown && v1.who && v1.txt > 5, JSON.stringify(v1));
  await shot('subtitulos');
  await page.click('#loreSub'); await wait(2);
  const v2 = await ev(() => ({ playing: !!window.__lore.voiceAt(), shown: document.getElementById('loreSub').style.display }));
  check('tocar el subtítulo detiene la voz y lo oculta', !v2.playing && v2.shown === 'none', JSON.stringify(v2));

  // ── 5. cadáver con chip: cifrado, descifrado parcial y completo ──
  const cb = await ev(() => { const n = window.__lore.nodes().find((e) => e.form === 'body' && e.kind === 'chip'); return n ? { id: n.lid } : null; });
  const s3 = await stand(cb.id);
  check('junto al caído: «Registrar al caído»', s3.prompt === 'Registrar al caído', JSON.stringify(s3));
  await press();
  const c1 = await ev((id) => { const L = window.__lore.api; return { has: L.has(id), readable: L.readable(id), ui: window.__G.uiOpen }; }, cb.id);
  check('el chip se recoge cifrado (no se abre ningún modal)', c1.has && !c1.readable && c1.ui === null, JSON.stringify(c1));
  const c2 = await ev((id) => { const L = window.__lore.api; const a = L.decrypt(id, 0.4), tr = window.__G.S.lore.tr[id]; const b = L.decrypt(id, 1); return { a: a.q, aok: a.ok, b: b.q, bok: b.ok, tr, readable: L.readable(id), text: L.get(id).text && L.get(id).text.length }; }, cb.id);
  check('decrypt(id, calidad): 0,4 parcial; 1 completo; idempotente', c2.a === 0.4 && !c2.aok && c2.b === 1 && c2.bok && c2.readable && c2.tr === 1 && c2.text > 20, JSON.stringify(c2));

  // ── 6. terminales con archivo ◈ ──
  const t1 = await ev(() => {
    const G = window.__G, L = window.__lore, id = Object.keys(L.LR.termLore)[0], ent = G.map.ents.find((e) => e.id === id), eid = L.LR.termLore[id];
    G.world.rt.get(id) || G.world.rt.set(id, { e: ent, mesh: null, ph: 0 });
    const before = G.world.promptFor(ent, G.world.rt.get(id));
    G.world.hackResult(ent, G.world.rt.get(id), false);          // fallo: alarma, sin archivo
    const failFound = G.S.lore.f[eid];
    G.world.rt.get(id).lockUntil = 0;
    G.world.hackResult(ent, G.world.rt.get(id), true);
    return { before, failFound: !!failFound, found: !!G.S.lore.f[eid], eid };
  });
  check('el aviso de la terminal con archivo termina en ◈; un hackeo fallido no lo da y uno correcto sí', /◈$/.test(t1.before || '') && !t1.failFound && t1.found, JSON.stringify(t1));

  // ── 7. expedientes de jefe ──
  const b1 = await ev(() => {
    const L = window.__lore, S = window.__G.S;
    const En = window.__eco.En;
    L.emit('bossKilled', { id: 'kharsa', def: En.kharsa, mini: true, name: 'Kharsa' });   // minijefe: no cuenta
    const mini = !!S.lore.f.b_kharsa;
    L.emit('bossKilled', { id: 'reina', def: En.reina, name: 'Reina de la Plaga' });
    L.emit('bossKilled', { id: 'carnicero', def: En.carnicero, name: 'El Carnicero' });
    return { mini, reina: !!S.lore.f.b_reina, carn: !!S.lore.f.b_carnicero, readable: L.api.readable('b_reina') };
  });
  check('al abatir un jefe llega su expediente (cifrado); los minijefes no lo dan; también los secretos', !b1.mini && b1.reina && b1.carn && !b1.readable, JSON.stringify(b1));

  // ── 7b. mazmorra de escaleras (antes de las colecciones, que se llevan todo lo de la región) ──
  const sub = await ev(() => { const L = window.__lore; const ids = L.enterSub('sewer', 1); const mode = window.__G.mode; L.leave(); return { ids, mode, back: window.__G.mode }; });
  check('una mazmorra de alcantarillas (Ciudad) trae la cinta de Rosa', sub.ids && sub.ids.join() === 'c_alc_op' && sub.mode === 'op' && sub.back === 'world', JSON.stringify(sub));

  // ── 8. colecciones y recompensas ──
  const col = await ev(() => {
    const L = window.__lore, S = window.__G.S, G = window.__G;
    const known0 = S.gadgets ? Object.keys(S.gadgets.known).length : -1, tp0 = S.talentPts | 0;
    for (const e of L.api.entries.filter((x) => x.reg === 0 && !x.secret)) { L.grant(e.id, { quiet: true }); e.k === 'chip' && L.api.decrypt(e.id, 1); }
    const p = L.api.progress('reg0'), done1 = S.lore.c.reg0;
    const tp1 = S.talentPts | 0, known1 = S.gadgets ? Object.keys(S.gadgets.known).length : -1;
    L.api.decrypt('b_reina', 1);                                   // repetir no vuelve a pagar
    const colEv = L.LR.log.filter((l) => l[0] === 'loreCollection' && l[1] === 'reg0').length;
    return { p: `${p.have}/${p.total}`, done: done1, tp: tp1 - tp0, plan: known1 - known0, ev: colEv, grants: S.talentGrants && S.talentGrants['lore:reg0'] };
  });
  check('completar la colección del Valle: 1 punto de talento (una sola vez) y un plano de gadget', col.done === 1 && col.ev === 1 && col.tp === 1 && col.plan >= 0, JSON.stringify(col));
  const map = await ev(() => {
    const L = window.__lore, G = window.__G, w = G.world, m = G.map, fw = w.fogW;
    const count = (reg) => { let n = 0; for (let cz = 0; cz < fw; cz++) for (let cx = 0; cx < fw; cx++) if (m.regAt(cx * 2 + 1, cz * 2 + 1) === reg && (w.fogBits[(cz * fw + cx) >> 3] >> ((cz * fw + cx) & 7)) & 1) n++; return n; };
    const b = count(1);
    for (const e of L.api.entries.filter((x) => x.reg === 1 && !x.secret)) { L.grant(e.id, { quiet: true }); e.k === 'chip' && L.api.decrypt(e.id, 1); }
    return { before: b, after: count(1), done: G.S.lore.c.reg1 };
  });
  check('la colección de la Ciudad revela el mapa de su región', map.done === 1 && map.after > map.before + 1000, JSON.stringify(map));

  // ── 9. operaciones y mazmorras: un nodo por mapa generado ──
  const op1 = await ev(() => { const L = window.__lore; const ids = L.enterOp(7, 'bunker'); return { ids, mode: window.__G.mode }; });
  check('una operación (Yermo, búnker) trae su documento de lore', op1.mode === 'op' && op1.ids.join() === 'y_op', JSON.stringify(op1));
  const so = await stand('y_op');
  check('en la operación: aviso y recogida', /Recoger/.test(so.prompt || ''), JSON.stringify(so));
  await press();
  const o2 = await ev(() => ({ found: !!window.__G.S.lore.f.y_op, left: window.__lore.nodes().length, ui: window.__G.uiOpen }));
  check('el documento de la operación se recoge y no vuelve a salir', o2.found && o2.left === 0, JSON.stringify(o2));
  await closeUi();
  const op2 = await ev(() => { const L = window.__lore; L.leave(); const back = window.__G.mode; const ids = L.enterOp(7, 'bunker'); L.leave(); return { back, again: ids }; });
  check('al volver a entrar en una operación del mismo tema ya no repite lo hallado', op2.back === 'world' && op2.again.length === 0, JSON.stringify(op2));

  // ── 10. pistas de puzle ──
  const hint = await ev(() => {
    const L = window.__lore, a = L.hint('valle.bunker'), b = L.hint('valle.bunker');
    const known = L.api.hintFor('valle.bunker').known;
    L.api.grant('v_ronda7', { quiet: true });
    L.open('libros', 'v_ronda7');
    const html = document.querySelector('#panel') ? document.querySelector('#panel').textContent : '';
    return { value: a.value, same: a.value === b.value, known, knownAfter: L.api.hintFor('valle.bunker').known, shown: html.includes(a.display), disp: a.display };
  });
  check('hintFor(clave) es determinista por partida, se muestra en el libro y queda anotada', hint.same && hint.shown && hint.knownAfter, JSON.stringify(hint));
  await closeUi();

  // ── 11. Archivo con L y compatibilidad con los registros antiguos ──
  await page.keyboard.press('l'); await wait(4);
  const k1 = await ev(() => window.__G.uiOpen);
  await page.keyboard.press('l'); await wait(4);
  const k2 = await ev(() => window.__G.uiOpen);
  check('la tecla L abre y cierra el Archivo', k1 === 'archive' && k2 === null, `${k1} → ${k2}`);
  const leg = await ev(() => {
    const G = window.__G, S = G.S, n0 = S.lore.pads.length;
    G.world.takeDatapad({ id: 'dp_test_1', reg: 0, x: 0, z: 0 }, {});
    return { n: S.lore.pads.length - n0, ui: G.uiOpen, title: document.querySelector('#panel h3') ? document.querySelector('#panel h3').textContent : null };
  });
  check('un registro de datos antiguo se sigue leyendo y se guarda en S.lore.pads', leg.n === 1 && leg.ui === 'lore' && !!leg.title, JSON.stringify(leg));
  await page.click('#lArch'); await wait(4);
  const leg2 = await ev(() => ({ na: window.__eco.na.length, ui: window.__G.uiOpen, tabs: [...document.querySelectorAll('#panel .tab')].map((t) => t.textContent), lore: !!document.querySelector('#panel [data-lore]') }));
  check('el Archivo antiguo cuenta bien sus registros y ofrece volver al de lore', new RegExp('Registros 1/' + leg2.na).test(leg2.tabs.join('|')) && leg2.lore, JSON.stringify(leg2));
  await shot('archivo-antiguo');
  await closeUi();

  // ── 12. coste de dibujo de un nodo ──
  const pp = await ev(() => { const L = window.__lore, n = L.nodes().find((e) => e.form === 'rec' || e.form === 'shelf' || e.form === 'body'); return n ? { id: n.lid, x: n.x, z: n.z } : null; });
  if (pp) {
    await stand(pp.id); await wait(6);
    await api.freeze(true);   // escena quieta: la diferencia de llamadas es solo la del nodo (sin enemigos ni partículas que cambien entre medidas)
    const withNode = await api.perf();
    await ev((id) => window.__lore.grant(id, { quiet: true }), pp.id); await wait(4);
    const without = await api.perf();
    await api.freeze(false);
    console.log('PERF con nodo', JSON.stringify(withNode), 'sin nodo', JSON.stringify(without));
    check('un nodo cercano cuesta ≤ 2 llamadas de dibujo', withNode.calls - without.calls <= 2, `${withNode.calls} → ${without.calls}`);
  }

  // ── 13. Instinto (Cazador): con chestSense los nodos cercanos salen como puntos de su color en el minimapa (y no sin el talento) ──
  const sn = await ev(() => {
    const G = window.__G, L = window.__lore, n = L.nodes().find((e) => e.kind);
    if (!n) return null;
    G.player.x = n.x + 3; G.player.z = n.z + 3;
    const fx = G.S.talentFx || (G.S.talentFx = {}), keep = fx.chestSense;
    const dots = (sense) => {
      fx.chestSense = sense;
      const fills = [], st = {};
      const c = new Proxy(st, { get: (t, k) => (k in t ? t[k] : k === 'fill' ? () => fills.push(t.fillStyle) : () => {}), set: (t, k, v) => ((t[k] = v), true) });
      L.minimapPings(c);
      return fills.length;
    };
    const sin = dots(0), con = dots(40);
    window.__step(40, 1 / 30);   // varios barridos de loreScan con el pulso de Instinto activo: no debe fallar
    fx.chestSense = keep;
    return { sin, con, nodes: L.nodes().length };
  });
  check('Instinto: los nodos de lore cercanos salen en el minimapa solo con el talento', sn && sn.sin === 0 && sn.con >= 1, JSON.stringify(sn));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

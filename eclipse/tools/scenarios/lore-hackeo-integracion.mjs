// LORE ↔ HACKEO integrados (revisión adversarial): recorre el descifrado de chips PULSANDO la interfaz real del Archivo (ratón en escritorio,
// toques CDP en --device pixel7) con el frente HACKEO de verdad, y comprueba los estados que podrían quedar colgados.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/lore-hackeo-integracion.mjs --size 640x360 --quality low --out /ruta
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/lore-hackeo-integracion.mjs --device pixel7 [--portrait] --out /ruta
// SHOTS=1 guarda 2-3 capturas.
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page, touch } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await api.god(true);
  const has = await ev(() => !!window.__lore && !!window.__hack && !!window.__G.loreApi && !!window.__G.hackApi);
  if (!has) { console.log('FAIL  la build no incluye los dos frentes'); process.exitCode = 1; return; }
  await ev(() => { const G = window.__G; G.world.packCd = 1e9; G.world.evT = 1e9; });

  const rect = (sel) => ev((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }, sel);
  const tap = async (sel) => {
    await ev((sel) => { const e = document.querySelector(sel); e && e.scrollIntoView({ block: 'center' }); }, sel); await wait(2);
    const r = await rect(sel);
    if (!r) throw new Error('no existe ' + sel);
    if (touch) await touch.tap(Math.round(r.cx), Math.round(r.cy)); else await page.mouse.click(r.cx, r.cy);
    await wait(3); await page.waitForTimeout(120);
    return r;
  };
  const st = () => ev(() => { const G = window.__G, h = window.__hack, A = G.loreApi; return { ui: G.uiOpen, hk: !!h.HK.s, paused: G.paused, sub: document.getElementById('loreSub')?.style.display || null, ids: A.entries.filter((e) => e.k === 'chip' && A.has(e.id)).length }; });
  const chip = (id) => ev((id) => { const A = window.__G.loreApi, L = window.__lore.state(); const g = A.get(id); return { q: g.q, readable: g.readable, tr: L.tr[id] | 0, d: L.d[id] || 0 }; }, id);
  const openChip = async (id) => {
    // abre el Archivo como el jugador (botón ARCH. / tecla L), pestaña Chips y la tarjeta del chip
    if ((await ev(() => window.__G.uiOpen)) === null) {
      if (touch) await tap('#tmenu [data-a="archive"]'); else { await page.keyboard.press('l'); await wait(4); }
    }
    await tap('#panel [data-lt="chips"]');
    await tap(`#panel .lo-card[data-id="${id}"]`);
  };

  // chips de prueba (no de jefe) sin descifrar
  const ids = await ev(() => { const A = window.__G.loreApi; return A.entries.filter((e) => e.k === 'chip' && !e.boss && !e.secret).slice(0, 6).map((e) => e.id); });
  await ev((ids) => ids.forEach((id) => window.__lore.grant(id, { quiet: true })), ids);
  const [c1, c2, c3, c4] = ids;
  await page.waitForTimeout(600);

  // 1 · el botón «Descifrar chip» abre el hackeo con la pantalla previa y el nombre real
  await openChip(c1);
  await tap('#panel [data-lo="decrypt"]');
  let s = await st();
  const pre = await ev(() => ({ title: document.querySelector('#panel h2')?.textContent, sub: document.querySelector('.hk-card h3')?.textContent || '', go: !!document.querySelector('#hkGo'), no: !!document.querySelector('#hkNo') }));
  check('«Descifrar chip» abre la pantalla previa del hackeo con el nombre del chip', s.ui === 'hack' && s.hk && pre.go && pre.no && /Chip cifrado/.test(pre.title) && pre.sub.length > 3, JSON.stringify({ s, pre }));
  if (process.env.SHOTS) await shot('previa-chip');

  // 2 · Desconectar en la pantalla previa: el Archivo vuelve, sin sesión colgada y SIN contar intento
  await tap('#hkNo');
  s = await st(); let c = await chip(c1);
  check('desconectar en la pantalla previa: vuelve el Archivo, sin sesión colgada y sin intento anotado', s.ui === 'archive' && !s.hk && c.tr === 0 && c.d === 0, JSON.stringify({ s, c }));

  // 3 · desconectar a mitad de la capa
  await tap('#panel [data-lo="decrypt"]');
  await tap('#hkGo');
  s = await st();
  check('conectar arranca la primera capa (cifrado)', s.ui === 'hack' && (await ev(() => window.__hack.s?.state)) === 'run' && (await ev(() => window.__hack.s?.layers[0].kind)) === 'cipher', JSON.stringify(s));
  if (process.env.SHOTS) await shot('capa-cifrado');
  await tap('#hkAb');
  await page.waitForTimeout(200); await wait(3);
  s = await st(); c = await chip(c1);
  check('desconectar a mitad: vuelve el Archivo, la sesión se limpia y no hay intento ni avance', s.ui === 'archive' && !s.hk && c.tr === 0 && c.d === 0, JSON.stringify({ s, c }));

  // 4 · fallo por traza: el Archivo anota el intento y deja el chip algo más legible (+15 %); nunca queda bloqueado
  const fallo = async (cid) => {
    await ev(() => document.querySelector('#panel [data-lo="decrypt"]').scrollIntoView({ block: 'center' }));
    await tap('#panel [data-lo="decrypt"]');
    await tap('#hkGo');
    await ev(() => { const h = window.__hack, s = h.s; s.manual = true; s.trace = 99.99; h.step(8, 1 / 60); });
    const res = await ev(() => { const l = window.__hack.HK.last; return l && { ok: l.ok, q: l.q, capasOk: l.capasOk, abortado: !!l.abortado }; });
    const txt = await ev(() => document.querySelector('.hk-res')?.textContent || '');
    await tap('#hkOk');
    await page.waitForTimeout(200); await wait(3);
    return { res, txt };
  };
  let f = await fallo(c1);
  s = await st(); c = await chip(c1);
  check('fallo: el resultado se cierra con «Continuar», el Archivo vuelve y el chip gana 15 % de legibilidad', f.res && f.res.ok === false && s.ui === 'archive' && !s.hk && c.tr === 1 && Math.abs(c.d - 0.15) < 1e-9 && !c.readable, JSON.stringify({ f, s, c }));
  check('el mensaje del hackeo no promete un porcentaje que el Archivo no aplica', !/legible al/.test(f.txt), f.txt.slice(0, 160));
  // el botón pasa a «Seguir descifrando» y la ficha muestra el porcentaje
  const lab = await ev(() => document.querySelector('#panel [data-lo="decrypt"]')?.textContent + ' | ' + (document.querySelector('#panel .lo-m, #panel .wbody')?.textContent.match(/Legible al \d+ %/) || [''])[0]);
  check('tras un fallo la ficha ofrece «Seguir descifrando» y muestra el porcentaje', /Seguir descifrando/.test(lab) && /Legible al 15 %/.test(lab), lab);
  f = await fallo(c1); c = await chip(c1);
  check('un segundo fallo acumula (30 %) y cuenta dos intentos', c.tr === 2 && Math.abs(c.d - 0.3) < 1e-9, JSON.stringify(c));

  // 5 · éxito con el bot: q = 1, legible, texto en claro, colección y hackeo contabilizados
  const ev0 = await ev(() => ({ chips: window.__hack.state().stats.chips, lvlxp: window.__hack.state().xp, dec: window.__lore.LR.log.filter((l) => l[0] === 'loreDecrypted' && l[2] >= 1).length }));
  await tap('#panel [data-lo="decrypt"]');
  await tap('#hkGo');
  const win = await ev(() => { const r = window.__hack.autoplay(900); return r && { ok: r.ok, q: r.q, capas: r.capas, capasOk: r.capasOk, chip: r.chip, objetivo: r.objetivo, lore: window.__hack.s?.spec.lore }; });
  await tap('#hkOk');
  await page.waitForTimeout(250); await wait(3);
  s = await st(); c = await chip(c1);
  const clear = await ev(() => ({ garb: !!document.querySelector('#panel .lo-garb'), txt: !!document.querySelector('#panel .lo-txt'), btn: !!document.querySelector('#panel [data-lo="decrypt"]') }));
  const ev1 = await ev(() => ({ chips: window.__hack.state().stats.chips, xp: window.__hack.state().xp, decEv: window.__lore.LR.log.filter((l) => l[0] === 'loreDecrypted' && l[2] >= 1).length }));  // solo los completos (los parciales también emiten el evento)
  check('éxito: q = 1, legible, el Archivo vuelve a la ficha del chip ya en claro y sin botón de descifrar', win && win.ok && win.q === 1 && win.objetivo === 'chip' && s.ui === 'archive' && c.q === 1 && c.readable && clear.txt && !clear.garb && !clear.btn, JSON.stringify({ win, s, c, clear }));
  check('éxito: se cuenta una sola vez (hackeo: chips +1 y XP; lore: un solo loreDecrypted)', ev1.chips === ev0.chips + 1 && ev1.decEv === ev0.dec + 1 && ev1.xp !== ev0.lvlxp, JSON.stringify({ ev0, ev1 }));
  if (process.env.SHOTS) await shot('chip-descifrado');

  // 6 · cerrar el resultado con la ✕ (no con «Continuar») también entrega el callback una sola vez y no deja nada colgado
  await openChip(c2);
  await tap('#panel [data-lo="decrypt"]');
  await tap('#hkGo');
  await ev(() => { window.__hack.autoplay(900); });
  await tap('#panel .x');
  await page.waitForTimeout(300); await wait(3);
  s = await st(); c = await chip(c2);
  check('cerrar el resultado con la ✕: el chip queda descifrado una vez, el Archivo vuelve y no hay sesión', c.q === 1 && c.tr === 0 && s.ui === 'archive' && !s.hk, JSON.stringify({ s, c }));

  // 7 · Esc durante la capa (escritorio y táctil con teclado): desconecta y no abre la pausa
  await openChip(c3);
  await tap('#panel [data-lo="decrypt"]');
  await tap('#hkGo');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250); await wait(3);
  s = await st(); c = await chip(c3);
  check('Esc durante la capa: vuelve el Archivo (no la pausa), sin intento ni sesión', s.ui === 'archive' && !s.hk && c.tr === 0, JSON.stringify({ s, c }));

  // 8 · otro panel encima (muerte) mientras se descifra: el Archivo NO debe pisarlo al llegar el callback de la sesión abortada
  await tap('#panel [data-lo="decrypt"]');
  await tap('#hkGo');
  await ev(() => { window.__dbg.openDeath(); });
  await page.waitForTimeout(400); await wait(4);
  s = await st(); c = await chip(c3);
  check('con la pantalla de muerte encima, el callback abortado no reabre el Archivo ni suma intento', s.ui === 'death' && !s.hk && c.tr === 0, JSON.stringify({ s, c }));
  await ev(() => { document.querySelector('#panel [data-close]')?.click(); window.__G.player.dead = false; window.__G.uiOpen = null; window.__G.paused = false; const p = document.getElementById('panel'); p.hidden = true; p.innerHTML = ''; });

  // 9 · teclas del juego con el cifrado abierto: ninguna abre otro panel ni cambia la sesión (L, I, M, J, V, P, Tab…)
  await openChip(c4);
  await tap('#panel [data-lo="decrypt"]');
  await tap('#hkGo');
  const keys = await ev(() => {
    const G = window.__G, h = window.__hack, s0 = h.s, out = { bad: [] };
    const codes = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((k) => 'Key' + k).concat(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Space', 'Tab', 'Enter', 'KeyV', 'ArrowLeft', 'ArrowRight']);
    for (const code of codes) {
      for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code, key: code.replace('Key', '').toLowerCase(), bubbles: true }));
      if (G.uiOpen !== 'hack' || h.s !== s0) out.bad.push(code + ':' + G.uiOpen);
    }
    out.still = G.uiOpen === 'hack' && h.s === s0;
    return out;
  });
  await wait(3);
  s = await st();
  check('teclear todas las letras, dígitos y flechas con el cifrado abierto no abre paneles ni cambia la sesión', keys.still && keys.bad.length === 0 && s.ui === 'hack', JSON.stringify({ keys, s }));
  await ev(() => document.querySelector('#hkAb')?.click());
  await page.waitForTimeout(250); await wait(3);

  // 10 · una grabación sonando en el panel se detiene al abrir el hackeo (ni voz ni subtítulos por encima del minijuego)
  const rec = await ev(() => window.__G.loreApi.entries.find((e) => e.k === 'grab' && !e.boss && !e.secret).id);
  await ev((r) => window.__lore.grant(r, { quiet: true }), rec);
  await tap('#panel [data-lt="grab"]');
  await tap(`#panel .lo-card[data-id="${rec}"]`);
  await tap('#panel [data-lo="play"]');
  await page.waitForTimeout(500);
  const sonando = await ev(() => !!window.__lore.voiceAt());
  await tap('#panel [data-lt="chips"]');
  await tap(`#panel .lo-card[data-id="${c4}"]`);
  await tap('#panel [data-lo="decrypt"]');
  await page.waitForTimeout(300); await wait(3);
  const vz = await ev(() => ({ voz: !!window.__lore.voiceAt(), sub: document.getElementById('loreSub')?.style.display || 'none', ui: window.__G.uiOpen }));
  check('la grabación del panel se detiene al lanzar el descifrado (sin voz ni subtítulos sobre el minijuego)', sonando && !vz.voz && vz.sub !== 'block' && vz.ui === 'hack', JSON.stringify({ sonando, vz }));
  await tap('#hkNo');

  // 11 · terminal con archivo guardado: el hackeo nuevo dispara el wrapper de hackResult de LORE al triunfar (y solo entonces)
  const T = await ev(() => {
    const G = window.__G, LR = window.__lore.LR, A = G.loreApi;
    const tid = Object.keys(LR.termLore).find((k) => !A.has(LR.termLore[k]));
    if (!tid) return null;
    const ent = G.map.ents.find((e) => e.k === 'terminal' && e.id === tid);
    return ent ? { id: tid, lid: LR.termLore[tid], x: ent.x, z: ent.z, eff: ent.eff, diff: ent.diff } : null;
  });
  if (!T) check('hay una terminal con archivo guardado en el mapa', false, 'sin terminales de lore');
  else {
    await ev((T) => { const G = window.__G; G.world.loadWorld({ x: T.x + 1.2, z: T.z + 1.2 }); }, T);
    await wait(10);
    // fallo primero: no concede
    await ev((T) => { const G = window.__G, ent = G.map.ents.find((e) => e.id === T.id); G.player.dead = false; window.__dbg.openHack(ent, { lockUntil: 0 }); }, T);
    await wait(2);
    let ts = await ev(() => ({ ui: window.__G.uiOpen, hk: !!window.__hack.s, tit: document.querySelector('#panel h2')?.textContent }));
    check('interactuar con la terminal abre el hackeo nuevo (no el antiguo)', ts.ui === 'hack' && ts.hk && /Terminal/.test(ts.tit), JSON.stringify(ts));
    await tap('#hkGo');
    await ev(() => { const h = window.__hack, s = h.s; s.manual = true; s.trace = 99.99; h.step(8, 1 / 60); });
    await tap('#hkOk'); await wait(3);
    const noGrant = await ev((T) => window.__G.loreApi.has(T.lid), T);
    check('hackear mal una terminal con archivo no concede la entrada', noGrant === false);
    await page.waitForTimeout(100);
    await ev((T) => { const G = window.__G, ent = G.map.ents.find((e) => e.id === T.id); G.player.dead = false; window.__dbg.openHack(ent, { lockUntil: 0 }); }, T);
    await tap('#hkGo');
    const ok = await ev(() => window.__hack.autoplay(900));
    const lines = await ev(() => document.querySelector('.hk-res')?.textContent || '');
    // con el resultado abierto, la entrada concedida por la terminal (a veces una grabación) no debe sonar ni poner subtítulos que tapen «Continuar»
    const enRes = await ev(() => { const b = document.querySelector('#hkOk'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { voz: !!window.__lore.voiceAt(), sub: document.getElementById('loreSub')?.style.display || 'none', top: e && (e.id || e.className || e.tagName) }; });
    check('con el resultado del hackeo abierto no suena la grabación ni hay subtítulos, y «Continuar» recibe el toque', !enRes.voz && enRes.sub !== 'block' && enRes.top === 'hkOk', JSON.stringify(enRes));
    await tap('#hkOk'); await wait(3);
    const got = await ev((T) => ({ has: window.__G.loreApi.has(T.lid), ui: window.__G.uiOpen, toast: document.getElementById('toasts')?.textContent.slice(-200) }), T);
    check('hackear bien una terminal con archivo concede la entrada y el aviso no abre paneles encima del resultado', ok && ok.ok && got.has && got.ui === null, JSON.stringify({ ok: ok && ok.ok, got, lines: lines.slice(0, 120) }));
  }

  // 12 · al final: ningún estado colgado
  await wait(5);
  const fin = await ev(() => { const h = window.__hack, G = window.__G; const m = document.querySelector('.hk-mark'); return { hk: !!h.HK.s, ui: G.uiOpen, ctl: h.HK.ctl.length, mark: m ? m.style.display : null, raf: h.HK.s ? h.HK.s.raf : 0 }; });
  check('al terminar no quedan sesión, panel ni unidades controladas', !fin.hk && fin.ui === null && fin.ctl === 0, JSON.stringify(fin));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni de consola nuevos', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

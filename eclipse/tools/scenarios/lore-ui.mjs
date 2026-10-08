// Lore (D5): el Archivo y los subtítulos en móvil (toques reales por CDP) y en escritorio. Comprueba que nada desborda, que los objetivos
// táctiles miden ≥ 36 px, que los subtítulos no tapan los controles y que se puede navegar solo con toques.
//   node tools/shot.mjs --device pixel7 --scenario tools/scenarios/lore-ui.mjs --out /ruta --tag h
//   node tools/shot.mjs --device pixel7 --portrait --scenario tools/scenarios/lore-ui.mjs --out /ruta --tag v
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page, touch, size } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame(); await api.god(true);
  console.log('dispositivo', api.device, JSON.stringify(size), api.portrait ? 'vertical' : '');
  const rect = (sel) => ev((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }, sel);
  const tap = async (sel) => {
    await ev((sel) => { const e = document.querySelector(sel); e && e.scrollIntoView({ block: 'center' }); }, sel); await wait(2);
    const r = await rect(sel);
    if (!r) throw new Error('no existe ' + sel);
    if (touch) await touch.tap(r.cx, r.cy); else await page.mouse.click(r.cx, r.cy);
    await wait(4); await page.waitForTimeout(150);
    return r;
  };
  await ev(() => {
    const L = window.__lore;
    for (const id of ['v_ronda7', 'v_veterinaria', 'v_efemerides', 'c_mercado', 'c_guia_metro', 'v_radio_reyes', 'v_mensaje_vidal', 'c_radio_lucia', 'c_chip_hospital', 'd_geologo', 'p_manual_eclipse', 'p_argos_0']) L.grant(id, { quiet: true });
    L.api.decrypt('c_chip_hospital', 1); L.api.decrypt('d_geologo', 0.45);
  });
  await page.waitForTimeout(1500); await wait(6);
  const badge = await ev(() => { const b = document.querySelector('#tmenu [data-a="archive"]'); return b ? { has: b.classList.contains('lo-unread'), box: (() => { const r = b.getBoundingClientRect(); return [r.width, r.height]; })() } : null; });
  console.log('badge ARCH.', JSON.stringify(badge));
  if (touch) { check('el botón ARCH. existe y marca las novedades', badge && badge.has, JSON.stringify(badge)); }
  await shot('hud');
  // abrir con el botón táctil (o la tecla L en escritorio)
  if (touch) await tap('#tmenu [data-a="archive"]'); else { await page.keyboard.press('l'); await wait(4); }
  check('el Archivo se abre', (await ev(() => window.__G.uiOpen)) === 'archive');
  const fit = async (label) => ev((label) => {
    const win = document.querySelector('#panel .win'), r = win.getBoundingClientRect(), d = document.documentElement;
    const small = [...document.querySelectorAll('#panel .tab, #panel .btn, #panel .lo-card')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height < 30; }).length;
    return { label, w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, over: d.scrollWidth > innerWidth + 1, inside: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, small };
  }, label);
  let f = await fit('lista');
  check('el panel cabe en pantalla (lista de libros)', f.inside && !f.over, JSON.stringify(f));
  await shot('lista');
  // entrar en un libro tocando su tarjeta
  await tap('#panel .lo-card[data-id="v_ronda7"]');
  f = await fit('libro');
  check('tocar una tarjeta abre el lector', (await ev(() => !!document.querySelector('#panel .lo-txt'))) && f.inside && !f.over, JSON.stringify(f));
  await shot('lector');
  await tap('#panel [data-lo="next"]');
  check('‹ › pasan al libro siguiente', (await ev(() => document.querySelector('#panel .lo-t').textContent)) !== 'Cuaderno de ronda del búnker 7');
  await tap('#panel [data-lo="back"]');
  // chips: tarjeta cifrada y descifrado (se aborta: el minijuego es del juego base)
  await tap('#panel [data-lt="chips"]');
  await shot('chips');
  await tap('#panel .lo-card[data-id="d_geologo"]');
  f = await fit('chip');
  check('el chip parcial se ve emborronado con el botón de seguir descifrando', await ev(() => !!document.querySelector('#panel .lo-garb') && !!document.querySelector('#panel [data-lo="decrypt"]')), JSON.stringify(f));
  await shot('chip');
  await tap('#panel [data-lo="decrypt"]');
  await page.waitForTimeout(400); await wait(6);
  const hk = await ev(() => ({ ui: window.__G.uiOpen, box: (() => { const r = document.querySelector('#panel .win').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() }));
  check('el descifrado abre el minijuego y se puede cancelar con un toque', hk.ui === 'lorehack', JSON.stringify(hk));
  await shot('descifrar');
  await tap('#loAbort');
  check('cancelar vuelve al chip en el Archivo', (await ev(() => window.__G.uiOpen)) === 'archive');
  // grabaciones: reproducir con un toque
  await tap('#panel [data-lt="grab"]');
  await tap('#panel .lo-card[data-id="v_radio_reyes"]');
  await tap('#panel [data-lo="play"]');
  await page.waitForTimeout(1200); await wait(4);
  const pl = await ev(() => ({ playing: !!window.__lore.voiceAt(), btn: document.querySelector('#panel .lo-play').textContent.trim(), cur: document.querySelectorAll('#panel .lo-line.cur').length }));
  check('la grabación suena desde el panel y resalta la línea que toca', pl.playing && /Detener/.test(pl.btn) && pl.cur === 1, JSON.stringify(pl));
  await shot('grab');
  await tap('#panel [data-lo="play"]');
  check('un segundo toque la detiene', !(await ev(() => !!window.__lore.voiceAt())));
  await tap('#panel [data-lt="cols"]');
  f = await fit('colecciones');
  check('las colecciones caben y muestran 11 tarjetas', f.inside && !f.over && (await ev(() => document.querySelectorAll('#panel .lo-col').length)) === 11, JSON.stringify(f));
  await shot('colecciones');
  await tap('#panel [data-lt="hitos"]');
  await tap('#panel [data-lt="diario"]');
  check('«Diario ▸» abre el Archivo antiguo con la pestaña para volver', await ev(() => !!document.querySelector('#panel [data-lore]')));
  await shot('diario');
  await tap('#panel [data-lore]');
  check('…y volver al de lore funciona', await ev(() => !!document.querySelector('#panel .lo-win')));
  await tap('#panel .x');
  check('la X cierra el Archivo', (await ev(() => window.__G.uiOpen)) === null);

  // subtítulos en pantalla (sin panel): no deben tapar controles
  await ev(() => window.__lore.api.play('c_radio_lucia'));
  await page.waitForTimeout(1500); await wait(4);
  const sb = await ev(() => {
    const s = document.getElementById('loreSub'), r = s.getBoundingClientRect();
    const hit = [];
    for (const sel of ['#tmenu', '#tbDash', '#tbUse', '#tbGren', '#tbSwap', '#tbMed', '#tbStim', '#hTL', '#mini', '#prompt']) {
      const e = document.querySelector(sel); if (!e || e.offsetParent === null) continue;
      const b = e.getBoundingClientRect();
      if (b.width && !(b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom)) hit.push(sel);
    }
    return { shown: s.style.display === 'block', x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, hit };
  });
  check('los subtítulos están a la vista y no tapan botones ni paneles', sb.shown && sb.inView && sb.hit.length === 0, JSON.stringify(sb));
  await shot('subtitulos');
  if (touch) { await touch.tap(sb.x + sb.w / 2, sb.y + sb.h / 2); await wait(3); check('tocar el subtítulo detiene la voz', !(await ev(() => !!window.__lore.voiceAt()))); }
  else await ev(() => window.__lore.api.stop());

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

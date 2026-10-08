// Puzles (D7) · interfaz y táctil: tarjeta del acertijo, botones con toques reales (CDP) o ratón, USAR táctil, solapes con el HUD y capturas.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/puzles-ui.mjs --device pixel7 --dpr 1 --out /ruta            (apaisado)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/puzles-ui.mjs --device pixel7 --portrait --dpr 1 --out /ruta (vertical)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/puzles-ui.mjs --size 960x540 --out /ruta                      (escritorio)
// SHOTS=0 omite las capturas. Variable DEV=se|iphone14|... se pasa con --device.
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page, touch, device, portrait } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  const SHOTS = process.env.SHOTS !== '0';
  const tag = `${device}${portrait ? '-v' : ''}`;
  const snap = async (n) => { if (SHOTS) await shot(`${tag}-${n}`); };
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });
  const vp = await ev(() => ({ w: innerWidth, h: innerHeight }));
  console.log('viewport', JSON.stringify(vp), 'dispositivo', device, portrait ? 'vertical' : '');
  const rect = (sel, nth = 0) => ev(([sel, nth]) => { const e = document.querySelectorAll(sel)[nth]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2, vis: getComputedStyle(e).display !== 'none' && r.width > 0 }; }, [sel, nth]);
  const tap = async (x, y) => { if (touch) await touch.tap(Math.round(x), Math.round(y)); else await page.mouse.click(x, y); await wait(3); };

  await api.region('desierto');
  const setup = async (kind, tier, idx) => ev(([kind, tier, idx]) => {
    const P = window.__puzzles, G = window.__G;
    let rt = null;
    for (let a = 0; a < 8 && !rt; a++) rt = P.spawn(kind, tier, idx, { radius: 26, dx: (a % 3 - 1) * 10, dz: (Math.floor(a / 3) - 0.5) * 12, id: 'pz_ui_' + kind });
    if (!rt) return { ok: false };
    const z = rt.pz;
    // plantado en el borde sur del rectángulo (donde se plantaría un jugador al llegar)
    const [wx, wz] = (() => { const T = z.T; const lx = z.d.lw / 2, lz = z.d.lh + 1.0; return [T.tx + T.m00 * lx + T.m01 * lz, T.tz + T.m10 * lx + T.m11 * lz]; })();
    G.player.x = wx; G.player.z = wz; G.player.inv = 9999; G.S.settings.aim = 'auto';
    window.__step(12, 1 / 30);
    return { ok: true, id: rt.e.id, near: z.near, active: P.PZ.active === rt };
  }, [kind, tier, idx]);

  // ── runas: es la tarjeta más larga (inscripción) y lleva etiquetas flotantes ──
  const s1 = await setup('runes', 2, 5);
  check('runas: la tarjeta se activa al llegar', s1.ok && s1.near && s1.active, JSON.stringify(s1));
  await wait(4);
  const card = await rect('#pzHud');
  check('la tarjeta es visible', card && card.vis, JSON.stringify(card));
  // solapes con el resto del HUD (no deben pisar el panel del jugador, el minimapa, las armas ni los botones táctiles)
  const boxes = {};
  for (const sel of ['#hTL', '#mini', '#hB', '#tmenu', '#tbUse', '#tbDash', '#tbGren', '#tbSwap', '#tbMed', '#tbStim', '#tbGdg', '#tbHack', '#prompt', '#tracker']) { const r = await rect(sel); if (r && r.vis) boxes[sel] = r; }
  const over = [];
  for (const [sel, r] of Object.entries(boxes)) {
    const ix = Math.max(0, Math.min(card.x + card.w, r.x + r.w) - Math.max(card.x, r.x)), iy = Math.max(0, Math.min(card.y + card.h, r.y + r.h) - Math.max(card.y, r.y));
    if (ix * iy > 40 && !['#tracker', '#prompt'].includes(sel)) over.push(`${sel} ${Math.round(ix)}×${Math.round(iy)}`);
  }
  console.log('tarjeta', JSON.stringify(card), 'solapes:', over.join(' · ') || 'ninguno');
  check('la tarjeta no pisa el panel del jugador, el minimapa, el menú táctil, las armas ni los botones', over.length === 0, over.join(' · '));
  check('la tarjeta cabe en la pantalla', card.x >= -1 && card.y >= -1 && card.x + card.w <= vp.w + 1 && card.y + card.h <= vp.h + 1, JSON.stringify(card));
  const btns = await ev(() => [...document.querySelectorAll('#pzHud button')].map((b) => { const r = b.getBoundingClientRect(); return { k: b.dataset.pz, w: Math.round(r.width), h: Math.round(r.height), cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }));
  check('botones táctiles ≥ 44 px (Reiniciar / Pista)', btns.length >= 2 && btns.every((b) => Math.min(b.w, b.h) >= 44), JSON.stringify(btns.map((b) => `${b.k} ${b.w}×${b.h}`)));
  const labels = await ev(() => [...document.querySelectorAll('#pzLab b')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, x: Math.round(r.x), y: Math.round(r.y), in: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }));
  check('las etiquetas de las runas se dibujan (texto del DOM) dentro de la pantalla', labels.length >= 5 && labels.filter((l) => l.in).length >= labels.length - 1, JSON.stringify(labels.map((l) => l.t + '@' + l.x + ',' + l.y)));
  await snap('runas');

  // ── toque/clic en «Pista» ──
  const h0 = await ev(() => window.__puzzles.rt('pz_ui_runes').pz.st.hints);
  const hint = btns.find((b) => b.k === 'hint');
  await tap(hint.cx, hint.cy);
  const h1 = await ev(() => window.__puzzles.rt('pz_ui_runes').pz.st.hints);
  check(touch ? 'toque real en «Pista» da una pista' : 'clic en «Pista» da una pista', h1 === h0 + 1, `${h0} → ${h1}`);

  // ── USAR por toque: se coloca junto a la runa correcta y se toca el botón USAR (táctil) o se pulsa E ──
  const pre = await ev(() => {
    const P = window.__puzzles, G = window.__G, rt = P.rt('pz_ui_runes'), z = rt.pz;
    const plan = z.gen.bot(z.spec, z.st);
    const a = plan[0], id = a.id;
    // junto a la runa, mirándola
    const T = z.T, f = z.gen.focus(z.spec, z.st, id);
    const sx = f[0] + 0.5, sz = f[1] + 1.35;
    G.player.x = T.tx + T.m00 * sx + T.m01 * sz; G.player.z = T.tz + T.m10 * sx + T.m11 * sz;
    const gx = T.tx + T.m00 * (f[0] + 0.5) + T.m01 * (f[1] + 0.5), gz = T.tz + T.m10 * (f[0] + 0.5) + T.m11 * (f[1] + 0.5);
    G.player.face = Math.atan2(gx - G.player.x, gz - G.player.z);
    window.__step(3, 1 / 30);
    return { id, k0: z.st.k, prompt: G.prompt && G.prompt.text, picked: P.PZ.pickId };
  });
  await wait(4);
  const use = await rect('#tbUse');
  console.log('USAR', JSON.stringify(use), 'aviso', pre.prompt);
  check('el aviso de USAR apunta a la runa correcta', pre.picked === pre.id && /Activar runa/.test(pre.prompt || ''), JSON.stringify(pre));
  if (touch) {
    check('el botón táctil USAR está visible y es ≥ 44 px', use && use.vis && Math.min(use.w, use.h) >= 44, JSON.stringify(use));
    await tap(use.cx, use.cy);
  } else { await page.keyboard.down('KeyE'); await ev(() => window.__step(2, 1 / 30)); await page.keyboard.up('KeyE'); }
  await ev(() => window.__step(3, 1 / 30));
  const post = await ev(() => window.__puzzles.rt('pz_ui_runes').pz.st.k);
  check(touch ? 'tocar USAR activa la runa' : 'pulsar E activa la runa', post === pre.k0 + 1, `${pre.k0} → ${post}`);
  await snap('runas-usar');

  // ── reiniciar con el botón (toque) ──
  const btns2 = await ev(() => [...document.querySelectorAll('#pzHud button')].map((b) => { const r = b.getBoundingClientRect(); return { k: b.dataset.pz, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }));
  const rst = btns2.find((b) => b.k === 'reset');
  await tap(rst.cx, rst.cy);
  const r1 = await ev(() => { const z = window.__puzzles.rt('pz_ui_runes').pz; return { k: z.st.k, resets: z.st.resets }; });
  check('«Reiniciar» apaga las runas', r1.k === 0 && r1.resets === 1, JSON.stringify(r1));
  await ev(() => window.__puzzles.remove('pz_ui_runes'));

  // ── cajas: la tarjeta con Deshacer ──
  await ev(() => { window.__G.player.x += 40; window.__step(10, 1 / 30); });
  const s2 = await setup('boxes', 2, 9);
  await wait(4);
  const card2 = await rect('#pzHud');
  check('cajas: tarjeta con Reiniciar / Deshacer / Pista', s2.ok && card2 && card2.vis && (await ev(() => document.querySelectorAll('#pzHud button').length)) >= 3, JSON.stringify(s2));
  await snap('cajas');
  await ev(() => window.__puzzles.remove('pz_ui_boxes'));

  // ── temporizada: el estado se actualiza solo (sin reconstruir los botones) ──
  await ev(() => { window.__G.player.x += 40; window.__step(10, 1 / 30); });
  const s3 = await setup('timed', 2, 3);
  await wait(3);
  const keep = await ev(() => { const b = document.querySelector('#pzHud button'); window.__step(30, 1 / 30); return document.querySelector('#pzHud button') === b; });
  check('el DOM de los botones no se reconstruye con el estado animado (un toque no se pierde)', s3.ok && keep);
  await ev(() => window.__puzzles.remove('pz_ui_timed'));

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS de ${results.length}` : `\nTODO OK (${results.length} comprobaciones)`);
  if (bad.length) process.exitCode = 1;
}

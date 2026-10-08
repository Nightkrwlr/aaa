// comprobaciones de los cuatro ajustes de la última revisión de la persona propietaria:
//  1) el aviso de punto de talento es una pastilla pequeña que no toca el tracker de misiones
//  2) el personaje no lleva contorno permanente, pero se ve su silueta tras un obstáculo
//  3) el laboratorio conserva el scroll al subir una investigación
export default async function (api) {
  const { boot, newGame, ev, wait, shot, page, logs } = api;
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  await boot(); await newGame();

  // ── 1) botón de talento
  await ev(() => { window.__dbg.Quests.accept('m1'); window.__dbg.Quests.accept('s_tomas1'); });
  await ev(() => window.__step(8, 1 / 30)); await wait(6);
  const h0 = await ev(() => { const b = document.querySelector('#hTL').getBoundingClientRect(); const t = document.querySelector('#tracker').getBoundingClientRect(); return { tl: b.height, ty: t.y }; });
  await ev(() => { window.__G.S.talentPts = 3; });
  await ev(() => window.__step(8, 1 / 30)); await wait(6);
  const r1 = await ev(() => {
    const rect = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom, d: getComputedStyle(e).display }; };
    return { perk: rect('#hPerk'), trk: rect('#tracker'), trk1: rect('#tracker .trk'), hpanel: rect('.hpanel'), tl: rect('#hTL'), txt: document.querySelector('#hPerk')?.textContent, vw: innerWidth, vh: innerHeight };
  });
  console.log(JSON.stringify(r1));
  const p = r1.perk, t = r1.trk1 || r1.trk;
  check('la pastilla de talento se muestra', p && p.d !== 'none' && p.w > 0, `${p && p.w.toFixed(0)}x${p && p.h.toFixed(0)} «${r1.txt}»`);
  check('la pastilla es pequeña (≤ 30 px de alto, ≤ 56 de ancho)', p && p.h <= 30 && p.w <= 56);
  const hit = p && t && !(p.r < t.x || p.x > t.x + t.w || p.b < t.y || p.y > t.y + t.h);
  check('la pastilla no se solapa con las misiones', p && t && !hit, t ? `misiones y=${t.y.toFixed(0)}..${(t.y + t.h).toFixed(0)}, pastilla y=${p.y.toFixed(0)}..${p.b.toFixed(0)}` : 'sin tracker');
  check('el HUD no crece ni se mueve el tracker al aparecer la pastilla', Math.abs(r1.tl.h - h0.tl) < 0.5 && Math.abs(r1.trk.y - h0.ty) < 0.5, `HUD ${h0.tl.toFixed(0)}→${r1.tl.h.toFixed(0)} px · tracker y ${h0.ty.toFixed(0)}→${r1.trk.y.toFixed(0)}`);
  await shot('hud-talento');
  // tocar la pastilla abre el árbol de talentos
  await ev(() => document.querySelector('#hPerk').click()); await wait(6);
  check('tocar la pastilla abre el árbol de talentos', await ev(() => window.__G.uiOpen === 'talents'));
  await page.keyboard.press('Escape'); await wait(4);
  await ev(() => { window.__G.S.talentPts = 0; });

  // ── 3) laboratorio: el scroll se conserva al subir una investigación
  await ev(() => { const S = window.__G.S; S.credits = 999999; for (const k of Object.keys(S.mats)) S.mats[k] = 9999; });
  await ev(() => window.__dbg.openResearch()); await wait(8);
  const sc = await ev(() => { const b = document.querySelector('#panel .wbody'); const room = b.scrollHeight - b.clientHeight; b.scrollTop = Math.min(room, 140); return { top: b.scrollTop, room }; });
  check('el laboratorio tiene lista desplazable en este tamaño', sc.room > 40, JSON.stringify(sc));
  const before = await ev(() => { const cards = [...document.querySelectorAll('#panel [data-r]')]; const lv = (n) => (n.closest('.card')?.textContent.match(/Nivel (\d+)\//) || [])[1]; const c = cards.find((e) => e.closest('.card')?.classList.contains('can')); return c ? { id: c.dataset.r, lv: lv(c), idx: cards.indexOf(c) } : null; });
  check('hay una investigación que se puede subir', !!before, JSON.stringify(before));
  if (before) {
    await ev((id) => document.querySelector(`#panel [data-r="${id}"]`).click(), before.id); await wait(6);
    const after = await ev((id) => { const b = document.querySelector('#panel .wbody'); const c = document.querySelector(`#panel [data-r="${id}"]`); const lv = c ? (c.closest('.card')?.textContent.match(/Nivel (\d+)\//) || [])[1] : null; return { top: b.scrollTop, lv }; }, before.id);
    check('al subir la investigación sube de nivel', after.lv && +after.lv === +before.lv + 1, `${before.lv} → ${after.lv}`);
    check('la lista NO vuelve al principio (scroll conservado)', Math.abs(after.top - sc.top) <= 2, `antes ${sc.top} · después ${after.top}`);
  }
  await shot('laboratorio');
  await page.keyboard.press('Escape'); await wait(4);

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `FALLAN ${bad.length}/${results.length}` : `TODO OK ${results.length}/${results.length}`);
}

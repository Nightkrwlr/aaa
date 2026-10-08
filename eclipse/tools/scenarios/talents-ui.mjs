// Árbol de talentos: subir de nivel sin modal, abrir con T, comprar con el ratón/toque, reasignar, guardar, recargar,
// migrar un guardado antiguo y panel Personaje. Capturas: ≤ 8 (solo UI nueva).
//   node tools/shot.mjs --scenario tools/scenarios/talents-ui.mjs [--device pixel7 [--portrait]] --out DIR --tag desk [--dpr 1]
//   OLDSAVE=/ruta/old-save.json (opcional, ver talents-oldsave.mjs) activa la prueba de migración.
import fs from 'node:fs';
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page, device } = api;
  const mobile = device && device !== 'desktop';
  const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  const only = (process.env.PARTS || 'all');
  const tap = async (sel) => { const el = await page.$(sel); if (!el) throw new Error('no existe ' + sel); await el.scrollIntoViewIfNeeded().catch(() => {}); const b = await el.boundingBox(); if (mobile && api.touch) { await api.touch.tap(b.x + b.width / 2, b.y + b.height / 2); } else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await wait(3); };
  const nodeCenter = async (id) => { const b = await (await page.$(`[data-n="${id}"]`)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const clickNode = async (id) => { await ev((i) => window.__talents.focus(i), id); await wait(2); const c = await nodeCenter(id); if (mobile && api.touch) await api.touch.tap(c.x, c.y); else await page.mouse.click(c.x, c.y); await wait(3); };

  await boot(); await newGame();

  // ── 1. subir de nivel NO abre modal; da toast y punto; el botón #hPerk aparece
  const lv = await ev(() => { const G = window.__G, p = G.player; window.__toasts = []; G.events.toast.push((t) => window.__toasts.push(t)); const l0 = G.S.lvl; for (let i = 0; i < 600 && G.S.lvl === l0; i++) p.addXp(20);   // la curva de XP de ECONOMÍA es otra: se sube de nivel sea cual sea
    return { l0, l1: G.S.lvl, pts: G.S.talentPts, ui: G.uiOpen, earned: G.S.talentEarned }; });
  await wait(6);
  const vis = await ev(() => { const b = document.querySelector('#hPerk'); return { disp: getComputedStyle(b).display, txt: b.textContent, toasts: window.__toasts }; });
  check('subir de nivel concede 1 punto y no abre ningún panel', lv.l1 === lv.l0 + 1 && lv.pts === 1 && lv.ui == null, JSON.stringify(lv));
  check('pastilla #hPerk visible («▲», pequeña, fuera del flujo del HUD) y toast de punto', vis.disp !== 'none' && /▲/.test(vis.txt) && vis.toasts.some((t) => /talento/i.test(t)), JSON.stringify(vis));
  await shot('01-nivel-sin-modal');

  // más puntos: nivel 12 (para que reasignar cueste créditos) y puntos suficientes para ver el árbol con contenido
  await ev(() => { const G = window.__G, S = G.S; while (S.lvl < 12) G.player.addXp(400); S.credits = 5000; G.player.recalc(); });
  const pts0 = await ev(() => ({ lvl: window.__G.S.lvl, pts: window.__G.S.talentPts, earned: window.__G.S.talentEarned }));
  check('1 punto por nivel desde L2', pts0.pts === pts0.lvl - 1 && pts0.earned === pts0.lvl - 1, JSON.stringify(pts0));

  // ── 2. tecla T (escritorio) o botón táctil «TAL.»
  if (mobile) await tap('#tbTal'); else { await page.keyboard.press('t'); await wait(6); }
  await wait(12);
  const open = await ev(() => ({ ui: window.__G.uiOpen, nodes: document.querySelectorAll('.tn').length, edges: document.querySelectorAll('.te').length, pts: document.querySelector('#tlPts')?.textContent }));
  check('T / TAL. abre el panel de talentos con 150 nodos', open.ui === 'talents' && open.nodes === 150, JSON.stringify(open));
  await shot('02-arbol-inicial');

  // ── 3. comprar con clics/toques reales sobre el lienzo
  await clickNode('t_bas_root');
  const info1 = await ev(() => document.querySelector('#tlInfo')?.innerText.slice(0, 160));
  check('tocar un nodo muestra su ficha', /Entrenamiento de resistencia/.test(info1 || ''), (info1 || '').replace(/\n/g, ' | '));
  await tap('#tlBuy'); await tap('#tlBuy'); await tap('#tlBuy');
  const r1 = await ev(() => ({ rank: window.__G.S.perks.t_bas_root, pts: window.__G.S.talentPts, hp: Math.round(window.__G.player.maxHp) }));
  check('comprar 3 rangos de la raíz descuenta 3 puntos y sube la vida', r1.rank === 3 && r1.pts === pts0.pts - 3, JSON.stringify(r1));
  await clickNode('t_bas_b1'); await tap('#tlBuy'); await tap('#tlBuy');
  await clickNode('t_bas_b3'); // bloqueado: no se puede comprar
  const blocked = await ev(() => ({ dis: document.querySelector('#tlBuy')?.disabled, why: document.querySelector('.tli-why')?.textContent, cls: document.querySelector('[data-n="t_bas_b3"]').className }));
  check('un nodo sin prerrequisito está bloqueado y explica por qué', blocked.dis && /adyacente/.test(blocked.why || '') && /lock/.test(blocked.cls), JSON.stringify(blocked));
  await ev(() => { for (let i = 0; i < 16; i++) window.__talents.grant('prueba', 'p' + i); const T = window.__talents; for (const id of ['t_bas_b2', 't_bas_b3', 't_bas_b4', 't_bas_b5', 't_bas_b6']) T.buy(id); });
  const keyBlock = await ev(() => ({ c: window.__talents.canBuy('t_bas_kb'), sp: window.__talents.spent('bas') }));
  check('un nodo clave exige 15 puntos gastados en su rama', !keyBlock.c.ok && /Gasta 15/.test(keyBlock.c.why) && keyBlock.sp < 15, JSON.stringify(keyBlock));
  await ev(() => { const T = window.__talents; for (let i = 0; i < 4; i++) T.buy('t_bas_b1'); for (let i = 0; i < 3; i++) T.buy('t_bas_b2'); });
  await ev(() => window.__talents.buy('t_bas_kb'));
  const kb = await ev(() => ({ r: window.__G.S.perks.t_bas_kb, ms: window.__G.player.speed, spent: window.__talents.spent('bas') }));
  check('con ≥15 puntos en Bastión se compra «Muro viviente» (−15 % velocidad)', kb.r === 1 && kb.ms < 5.0, `gastados ${kb.spent}, velocidad ${kb.ms.toFixed(2)}`);
  await ev(() => { window.__talents.open(); window.__talents.focus('t_bas_kb'); });
  await wait(10);
  await shot('03-arbol-con-compras');

  // ── 4. resaltar por estadística y zoom (rueda / pellizco)
  await ev(() => { const s = document.querySelector('#tlHi'); s.value = 'dmgRed'; s.dispatchEvent(new Event('change')); });
  const hl = await ev(() => ({ hl: document.querySelectorAll('.tn.hl').length, dim: document.querySelectorAll('.tn.dim').length }));
  check('resaltar por estadística marca nodos y atenúa el resto', hl.hl > 3 && hl.hl + hl.dim === 150, JSON.stringify(hl));
  const s0 = await ev(() => document.querySelector('#tlWorld').style.transform);
  if (!mobile) { const v = await (await page.$('#tlView')).boundingBox(); await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2); await page.mouse.wheel(0, -300); await wait(3); }
  else { const v = await (await page.$('#tlView')).boundingBox(); await page.click('.tlzoom [data-z="1"]'); await wait(3); }
  const s1 = await ev(() => document.querySelector('#tlWorld').style.transform);
  check('el zoom cambia la escala del lienzo', s0 !== s1, `${s0} → ${s1}`);
  // arrastre
  const v = await (await page.$('#tlView')).boundingBox();
  if (!mobile) { await page.mouse.move(v.x + 60, v.y + 60); await page.mouse.down(); await page.mouse.move(v.x + 160, v.y + 110, { steps: 6 }); await page.mouse.up(); }
  else { await api.touch.drag(11, [v.x + 60, v.y + 60], [v.x + 140, v.y + 100], 6); await api.touch.up(11); }
  await wait(3);
  const s2 = await ev(() => document.querySelector('#tlWorld').style.transform);
  check('arrastrar desplaza el lienzo', s1 !== s2, `${s1} → ${s2}`);
  await ev(() => { const s = document.querySelector('#tlHi'); s.value = ''; s.dispatchEvent(new Event('change')); });

  // ── 5. reasignar (nivel 12 → cuesta 150·nivel créditos)
  const before = await ev(() => ({ cr: window.__G.S.credits, spent: window.__talents.spent(), free: window.__G.S.talentPts, earned: window.__G.S.talentEarned, lvl: window.__G.S.lvl }));
  const conf = await ev(() => { const b = document.querySelector('#tlRespec'); b.click(); const t = b.textContent; b.click(); return t; });
  const after = await ev(() => ({ cr: window.__G.S.credits, spent: window.__talents.spent(), free: window.__G.S.talentPts, perks: Object.keys(window.__G.S.perks).length }));
  check('reasignar pide confirmación y devuelve todos los puntos cobrando 150·nivel', /Seguro/.test(conf) && after.spent === 0 && after.free === before.earned && before.cr - after.cr === 150 * before.lvl && after.perks === 0, `${conf} | antes ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  // gratis hasta el nivel 10
  const free10 = await ev(() => { const S = window.__G.S; const l = S.lvl; S.lvl = 10; window.__talents.buy('t_art_root'); const c0 = S.credits; const r = window.__talents.respec(); S.lvl = l; return { ok: r.ok, cost: r.cost, delta: c0 - S.credits }; });
  check('reasignar es gratis hasta el nivel 10', free10.ok && free10.cost === 0 && free10.delta === 0, JSON.stringify(free10));

  // ── 6. guardar y recargar (Continuar) conserva el árbol
  await ev(() => { for (const id of ['t_art_root', 't_art_root', 't_art_root', 't_art_b1', 't_art_b1', 't_art_b2']) window.__talents.buy(id); window.__G.events.save.forEach((f) => f(true)); });
  const saved = await ev(() => ({ perks: JSON.stringify(window.__G.S.perks), pts: window.__G.S.talentPts, dmg: window.__G.player.st.dmg }));
  await ev(() => window.__G.events.save.forEach((f) => f(true)));
  await boot();
  await page.click('#mCont'); await page.waitForTimeout(1500); await wait(15);
  const loaded = await ev(() => ({ perks: JSON.stringify(window.__G.S.perks), pts: window.__G.S.talentPts, dmg: window.__G.player.st.dmg, v: window.__G.S.talentsV }));
  check('guardar y recargar conserva rangos, puntos libres y estadísticas', loaded.perks === saved.perks && loaded.pts === saved.pts && Math.abs(loaded.dmg - saved.dmg) < 1e-9 && loaded.v === 1, `${saved.perks} pts ${saved.pts} → ${loaded.perks} pts ${loaded.pts}`);

  // ── 7. panel Personaje con el resumen de talentos
  await ev(() => window.__dbg.openInventory('char')); await wait(12);
  const ch = await ev(() => ({ ui: window.__G.uiOpen, sum: !!document.querySelector('.tlsum .tls'), txt: document.querySelector('.tlsum')?.innerText.slice(0, 140) }));
  check('el panel Personaje muestra el resumen de talentos', ch.sum, JSON.stringify(ch));
  if (!mobile) await shot('04-personaje-resumen');
  await page.keyboard.press('Escape'); await wait(4);

  // ── 8. migración de un guardado antiguo
  if (process.env.OLDSAVE && fs.existsSync(process.env.OLDSAVE)) {
    const old = fs.readFileSync(process.env.OLDSAVE, 'utf8');
    await page.addInitScript((j) => localStorage.setItem('opeclipse_save_v1', j), old); // tras descargar la página (que guarda) y antes de cargar la nueva
    await boot();
    await page.click('#mCont'); await page.waitForTimeout(1500); await wait(15);
    const o = JSON.parse(old);
    const mg = await ev(() => { const S = window.__G.S; return { lvl: S.lvl, perks: JSON.stringify(S.perks), pending: S.pendingPerks, pts: S.talentPts, earned: S.talentEarned, v: S.talentsV, grants: JSON.stringify(S.talentGrants), toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent) }; });
    await ev(() => window.__step(120, 1 / 30));
    const msg = await ev(() => window.__talents.lastWelcome || '');
    const expect = o.lvl - 1 + 1; // 1 punto por nivel (lvl-1) + 1 por el jefe de la región 0
    check('migración: perks antiguos reembolsados como puntos (nivel−1 + jefes)', mg.v === 1 && mg.perks === '{}' && mg.pending === 0 && mg.pts === expect && mg.earned === expect, `antes: lvl ${o.lvl} perks ${JSON.stringify(o.perks)} pending ${o.pendingPerks} → ahora ${JSON.stringify(mg)}`);
    check('migración: mensaje de bienvenida al árbol', /Árbol de talentos/.test(msg + mg.toasts.join('|')), msg);
    await shot('05-migracion');
  } else console.log('(migración omitida: define OLDSAVE con un guardado antiguo)');

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok); console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

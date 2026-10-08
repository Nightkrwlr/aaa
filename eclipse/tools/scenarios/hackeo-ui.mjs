// HACKEO · interfaz y táctil: pantalla previa, minijuegos jugados con toques reales (CDP) o ratón, tamaños de zonas táctiles,
// que nada se salga de la pantalla, marcador «HACKEAR» sobre torretas y capturas.
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/hackeo-ui.mjs --device pixel7 --dpr 1 --out /ruta            (apaisado)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/hackeo-ui.mjs --device pixel7 --portrait --dpr 1 --out /ruta (vertical)
//   node tools/shot.mjs --html dist/dev.html --scenario tools/scenarios/hackeo-ui.mjs --size 960x540 --out /ruta                     (escritorio, ratón)
// Variable SHOTS=0 omite las capturas (más rápido).
export default async function (api) {
  const { boot, newGame, ev, wait, shot, logs, page, touch, device, portrait } = api;
  const results = [];
  const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
  const SHOTS = process.env.SHOTS !== '0';
  const tag = `${device}${portrait ? '-v' : ''}`;
  const snap = async (n) => { if (SHOTS) await shot(`${tag}-${n}`); };
  await boot(); await newGame();
  const vp = await ev(() => ({ w: innerWidth, h: innerHeight, touch: !!navigator.maxTouchPoints }));
  console.log('viewport', JSON.stringify(vp), 'dispositivo', device, portrait ? 'vertical' : '');
  const rect = (sel, nth = 0) => ev(([sel, nth]) => { const e = document.querySelectorAll(sel)[nth]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }, [sel, nth]);
  const tap = async (x, y) => { if (touch) await touch.tap(Math.round(x), Math.round(y)); else await page.mouse.click(x, y); await wait(2); };
  const tapSel = async (sel, nth = 0) => { await ev(([sel, nth]) => document.querySelectorAll(sel)[nth]?.scrollIntoView({ block: 'center', inline: 'center' }), [sel, nth]); const r = await rect(sel, nth); if (!r) return false; await tap(r.cx, r.cy); return true; };
  const layout = (name) => ev(([name]) => {
    const W = innerWidth, H = innerHeight, out = { name, issues: [] };
    const doc = document.documentElement;
    if (doc.scrollWidth > W + 1) out.issues.push('scroll horizontal ' + doc.scrollWidth);
    for (const sel of ['.win.hk', '.hk-game', '.hk-foot', '.hk-bar', '.hk-tools']) {
      const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect();
      if (r.width === 0 && sel !== '.hk-tools') continue;
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.issues.push(`${sel} fuera de pantalla ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    const g = document.querySelector('.hk-game'); if (g) { const r = g.getBoundingClientRect(); out.game = `${Math.round(r.width)}×${Math.round(r.height)}`; if (r.height < 150) out.issues.push('área de juego muy baja ' + Math.round(r.height)); }
    // zonas táctiles: botones visibles de la interfaz de hackeo ≥ 40 px en su lado menor
    const small = [];
    for (const e of document.querySelectorAll('#panel button, #panel .tn-pad, #panel .tn-sl')) {
      const r = e.getBoundingClientRect(); if (!r.width || e.disabled) continue;
      if (e.matches('.cp-l')) { if (r.width < 22 || r.height < 40) small.push('cp-l ' + Math.round(r.width) + '×' + Math.round(r.height)); continue; }
      if (Math.min(r.width, r.height) < 36 && !e.matches('.x,[data-close]')) small.push((e.className || e.id || e.tagName) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
    }
    if (small.length) out.issues.push('táctiles pequeños: ' + [...new Set(small)].slice(0, 6).join(', '));
    return out;
  }, [name]);
  const reportLayout = async (name) => { const l = await layout(name); check(`diseño ${name}: sin desbordes ni zonas pequeñas${l.game ? ' (juego ' + l.game + ')' : ''}`, l.issues.length === 0, l.issues.join(' | ')); };

  // — pantalla previa con riesgo, programas y compilador (cámara acorazada de 2 capas) —
  await ev(() => {
    const G = window.__G, h = window.__hack, H = h.state(), S = G.S, p = G.player;
    H.lvl = 7; H.xp = 0; H.heat = 12; H.tools = { disipador: 3, ralentizador: 2, oraculo: 2, fantasma: 1, rompehielo: 0 }; H.loadout = ['disipador', 'oraculo'];
    S.mats.data = 20; S.mats.battery = 5; S.mats.crystal = 5; S.credits = 999;
    window.__dbg.openHack({ k: 'terminal', id: 'term_ui_cache', x: p.x + 2, z: p.z, eff: 'cache', diff: 3, reg: 0 }, { lockUntil: 0 });
  });
  await wait(3);
  check('pantalla previa: capas, riesgo y programas', !!(await rect('#hkGo')) && (await ev(() => document.querySelectorAll('.hk-risk button').length === 3 && document.querySelectorAll('.hk-pg[data-load]').length === 5)));
  await snap('pre');
  await reportLayout('previa');
  const layers0 = await ev(() => document.querySelectorAll('.hk-lay span').length);
  await tapSel('.hk-risk button', 2); // Agresivo
  const layers1 = await ev(() => ({ n: document.querySelectorAll('.hk-lay span').length, on: document.querySelector('.hk-risk button.on')?.textContent }));
  check('tocar «Agresivo» añade una capa (de 2 a 3) y se marca', layers0 === 2 && layers1.n === 3 && /Agresivo/.test(layers1.on), JSON.stringify({ layers0, layers1 }));
  const comp0 = await ev(() => window.__hack.state().tools.oraculo);
  await ev(() => { const d = document.querySelector('.hk-pre details'); d && (d.open = true); });
  await tapSel('[data-comp="oraculo"]');
  const comp1 = await ev(() => window.__hack.state().tools.oraculo);
  check('compilar un programa gasta datos y créditos y suma una unidad', comp1 === comp0 + 1, `${comp0} → ${comp1}`);
  await tapSel('[data-load="fantasma"]'); // cargar un programa más (hay hueco: nivel 7 → 3 huecos)
  const ld = await ev(() => window.__hack.s.loadout.join());
  check('cargar un programa lo añade al equipo (límite por nivel)', /fantasma/.test(ld) && ld.split(',').length === 3, ld);
  await tapSel('#hkGo');
  await wait(2);
  check('«CONECTAR» pasa a la ejecución con traza, capas y programas', !!(await rect('#hkTb')) && (await ev(() => document.querySelectorAll('.hk-tool').length === 3 && document.querySelectorAll('.hk-layers b').length === 3)));
  await snap('run');
  await reportLayout('ejecución');
  await ev(() => document.querySelector('#hkAb').click());
  await wait(2);

  // — cada minijuego nuevo con toques reales —
  const open = (kind, diff = 2) => ev(([k, d]) => { const h = window.__hack; h.s && document.querySelector('#hkAb')?.click(); h.api.run({ title: 'UI ' + k, kinds: [k], layers: 1, diff: d, noPre: true, risk: 1, noExtra: true, seed: 31337 }, null); h.s.manual = true; h.step(4, 1 / 60); return !!h.s; }, [kind, diff]);
  const close = () => ev(() => { window.__G.uiOpen && document.querySelector('#panel [data-close]')?.click(); });

  // Cortafuegos: arrastrar mueve la pala; tocar lanza
  await open('fw', 2); await wait(2);
  await snap('fw'); await reportLayout('cortafuegos');
  const cv = await rect('.hk-cv');
  const pad0 = await ev(() => window.__hack.s.game.sim.padTo);
  if (touch) { await touch.down(5, cv.cx, cv.cy + cv.h * 0.3); await touch.move(5, cv.cx + 60, cv.cy + cv.h * 0.3); await touch.move(5, cv.cx + 70, cv.cy + cv.h * 0.3); await touch.up(5); }
  else { await page.mouse.move(cv.cx, cv.cy + cv.h * 0.3); await page.mouse.down(); await page.mouse.move(cv.cx + 60, cv.cy + cv.h * 0.3, { steps: 4 }); await page.mouse.up(); }
  const fw1 = await ev(() => { const sim = window.__hack.s.game.sim; return { padTo: sim.padTo, stuck: sim.ball.stuck }; });
  check('cortafuegos: arrastrar el dedo mueve la pala y toca para lanzar', Math.abs(fw1.padTo - pad0) > 8 && fw1.stuck === false, JSON.stringify({ pad0, fw1 }));
  await close();

  // Cifrado: tocar letra cifrada + tecla
  await open('cipher', 2); await wait(2);
  await snap('cipher'); await reportLayout('cifrado');
  const idx = await ev(() => { const t = [...document.querySelectorAll('.cp-l')].findIndex((e) => !e.classList.contains('fix')); return t; });
  await tapSel('.cp-l', idx);
  const kidx = await ev(() => [...document.querySelectorAll('.cp-k')].findIndex((e) => !e.classList.contains('used') && e.dataset.k !== '-'));
  await tapSel('.cp-k', kidx);
  const cp = await ev(() => { const t = [...document.querySelectorAll('.cp-l:not(.fix) .g')].map((e) => e.textContent).filter(Boolean); return t.length; });
  check('cifrado: tocar una letra y una tecla asigna la sustitución', cp >= 1, `asignadas ${cp}`);
  await close();

  // Enrutado: tocar nodos vecinos
  await open('route', 3); await wait(2);
  await snap('route'); await reportLayout('enrutado');
  const rt = await ev(() => { const G = window.__hack.s.game.G; const nb = Object.keys(G.adj[G.S]).map(Number).find((i) => !G.ice[i]); return { nb }; });
  const nodeRect = await ev((nb) => { const c = document.querySelector(`[data-n="${nb}"] circle`); const r = c.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width }; }, rt.nb);
  await tap(nodeRect.cx, nodeRect.cy);
  const rt1 = await ev(() => document.querySelector('.rt-bar')?.textContent || '');
  check('enrutado: tocar un nodo vecino alarga la ruta (latencia > 0)', /LATENCIA\s*[1-9]/.test(rt1), rt1.replace(/\s+/g, ' '));
  const nodeHit = await ev(() => { const r = document.querySelector('[data-n="1"] circle').getBoundingClientRect(); return Math.round(r.width); });
  check('enrutado: la zona táctil de un nodo mide ≥ 36 px', nodeHit >= 36, nodeHit + ' px');
  await close();

  // Sintonía: arrastrar por el panel
  await open('tune', 3); await wait(2);
  await snap('tune'); await reportLayout('sintonía');
  const pd = await rect('.tn-pad'); const k0 = await ev(() => document.querySelector('.tn-pad i').style.left);
  if (touch) { await touch.down(6, pd.cx, pd.cy); await touch.move(6, pd.cx + pd.w * 0.3, pd.cy - pd.h * 0.2); await touch.up(6); }
  else { await page.mouse.move(pd.cx, pd.cy); await page.mouse.down(); await page.mouse.move(pd.cx + pd.w * 0.3, pd.cy - pd.h * 0.2, { steps: 4 }); await page.mouse.up(); }
  const k1 = await ev(() => document.querySelector('.tn-pad i').style.left);
  const sl = await rect('.tn-sl');
  if (sl) { if (touch) { await touch.down(7, sl.x + 20, sl.cy); await touch.move(7, sl.x + sl.w * 0.7, sl.cy); await touch.up(7); } else { await page.mouse.move(sl.x + 20, sl.cy); await page.mouse.down(); await page.mouse.move(sl.x + sl.w * 0.7, sl.cy, { steps: 3 }); await page.mouse.up(); } }
  const ph = await ev(() => document.querySelector('.tn-sl i')?.style.left);
  check('sintonía: arrastrar por el panel mueve el control y el deslizador de fase', k0 !== k1 && ph && parseFloat(ph) > 50, `${k0} → ${k1} · fase ${ph}`);
  await close();

  // Fuerza bruta: tocar el carril cuando llega la nota
  await open('brute', 2); await wait(2);
  await snap('brute'); await reportLayout('fuerza bruta');
  const bf = await ev(() => { const sim = window.__hack.s.game.sim; const n = sim.notes[0]; const g = window.__hack.s; g.manual = true; while (sim.clock < n.t - 0.03) window.__hack.step(1, 1 / 60); return { lane: n.lane, clock: sim.clock, t: n.t }; });
  const bc = await rect('.hk-cv');
  await tap(bc.x + bc.w * (bf.lane + 0.5) / 4, bc.y + bc.h * 0.6);
  const hits = await ev(() => window.__hack.s.game.sim.hits);
  check('fuerza bruta: tocar el carril en el momento acierta la nota', hits === 1, `hits ${hits} (nota carril ${bf.lane})`);
  await close();

  // — marcador «HACKEAR» sobre una torreta —
  const mk = await ev(() => {
    const G = window.__G, h = window.__hack, p = G.player;
    G.uiOpen && document.querySelector('#panel [data-close]')?.click(); G.paused = false;
    const tur = window.__spawn('torreta', 4, p.x + 3, p.z + 1);
    window.__step(12, 1 / 30);
    const m = document.querySelector('.hk-mark'); const r = m && m.getBoundingClientRect(); const b = m && m.querySelector('button').getBoundingClientRect();
    return { cand: h.HK.cand && h.HK.cand.id, shown: m && getComputedStyle(m).display !== 'none', x: r && Math.round(r.x), y: r && Math.round(r.y), w: b && Math.round(b.width), h: b && Math.round(b.height), W: innerWidth, H: innerHeight, txt: m && m.textContent.trim() };
  });
  check('marcador HACKEAR visible sobre la torreta, dentro de la pantalla y ≥ 44 px de alto', mk.cand === 'torreta' && mk.shown && mk.x >= 0 && mk.y >= 0 && mk.x + mk.w <= mk.W + 1 && mk.h >= 44, JSON.stringify(mk));
  await snap('marker');
  const mr = await rect('.hk-mark button');
  if (mr) await tap(mr.cx, mr.cy);
  await wait(3);
  const opened = await ev(() => ({ ui: window.__G.uiOpen, title: document.querySelector('#panel h2')?.textContent }));
  check('tocar el marcador abre la intrusión (pantalla previa de la torreta)', opened.ui === 'hack' && /Intrusi/.test(opened.title || ''), JSON.stringify(opened));
  await snap('enemy-pre');
  await reportLayout('intrusión en torreta');
  await close();

  const errors = logs.filter((l) => /pageerror|\[error\]/.test(l) && !/ERR_FAILED|net::/.test(l));
  check('sin errores de página ni de consola nuevos', errors.length === 0, errors.slice(0, 3).join(' | '));
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\n${bad.length} FALLOS` : '\nTODO OK');
  if (bad.length) process.exitCode = 1;
}

// D10 · interfaz de las sorpresas (31i-surprises.js): las etiquetas del HUD (Eclipse, Némesis, asedio, pactos) no se solapan con el resto del HUD táctil
//   node tools/shot.mjs --scenario tools/scenarios/sorpresas-ui.mjs --device pixel7 --dpr 1 --quality low --out DIR
export default async function ({ boot, newGame, ev, wait, page, shot }) {
  await boot(); await newGame();
  await ev(() => { window.__silence && window.__silence(true); });
  const base = await ev(() => { const b = window.__G.map.pois.base; return { x: b.x, z: b.z }; });
  // fuera del Bastión (en el Bastión no hay Eclipse ni caza), con todas las etiquetas activas a la vez
  await ev(() => { const G = window.__G; G.world.loadWorld({ x: G.map.pois.base.x + 40, z: G.map.pois.base.z }); G.S.lvl = 14; G.player.recalc(); G.player.inv = 1e9; });
  await wait(20);
  await ev(() => {
    const G = window.__G, X = window.__sx, S = G.S; for (const e of G.enemies) { e.dead = true; e.deadT = 0; }
    X.ecl.begin();
    const k = window.__spawn('rastrero', 12, G.player.x + 3, G.player.z, { alerted: true }); window.__sx.N.born = -999; window.__sx.N.riseT = -99999; const n = X.nem.rise(k); n.due = 0; X.nem.spawn(n);
    S.sx.siege.next = S.playTime - 1; window.__step(3, 1 / 30); S.sx.siege.st = 'warn'; S.sx.siege.t = 60;
    const A = X.pact, ents = G.map.ents.filter((e) => e.k === 'shrine' && A.isShrine(e)); S.sx.pact.used = {}; A.seal(ents[0], A.offers(ents[0].id, A.cycle())[0]); A.seal(ents[1], A.offers(ents[1].id, A.cycle())[1]);
    window.__step(20, 1 / 30);
  });
  await wait(30);
  const sizes = [[915, 412], [844, 390], [667, 375], [740, 360], [390, 844], [375, 667], [360, 640]];
  let bad = 0;
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await wait(10);
    const r = await ev(() => {
      const bar = document.getElementById('sxBar');
      const pills = [...bar.querySelectorAll('.sxl')].filter((el) => el.style.display !== 'none');
      const out = [];
      // (los avisos #toasts y #lootfeed son pasajeros y van centrados en táctil: no cuentan)
      const others = ['#tmenu', '#mini', '#hTL', '#hTR', '#tracker', '#wslots', '#wpn', '.wslot', '#touch .tb', '#prompt'].flatMap((s) => [...document.querySelectorAll(s)]);
      const hit = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      for (const p of pills) {
        const a = p.getBoundingClientRect();
        if (a.left < -1 || a.right > innerWidth + 1 || a.top < -1 || a.bottom > innerHeight + 1) out.push('«' + p.className.split(' ')[1] + '» fuera de pantalla');
        for (const el of others) { const b = el.getBoundingClientRect(); if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue; if (hit(a, b)) out.push('«' + p.className.split(' ')[1] + '» (' + [a.left, a.top, a.right, a.bottom].map(Math.round) + ') solapa con ' + (el.id || el.className || el.tagName) + ' (' + [b.left, b.top, b.right, b.bottom].map(Math.round) + ')'); }
      }
      return { size: innerWidth + 'x' + innerHeight, n: pills.length, keys: pills.map((p) => p.className.split(' ')[1]).join(','), barH: Math.round(bar.getBoundingClientRect().height), problems: out };
    });
    if (r.problems.length || r.n < 4) bad++;
    console.log(`${r.problems.length || r.n < 4 ? 'FAIL' : 'PASS'}  ${r.size}  ${r.n} etiquetas (${r.keys}) alto ${r.barH}  ${r.problems.join('; ')}`);
    await shot('ui-' + w + 'x' + h);
  }
  console.log(bad ? `${bad} tamaños con problemas` : 'TODO OK');
  if (bad) process.exitCode = 1;
}

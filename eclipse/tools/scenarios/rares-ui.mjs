// D13 · interfaz de los raros en móvil y escritorio: la barra del raro (#rqBar, bajo el reloj) cabe en pantalla, no tapa el minimapa ni la tarjeta del jugador ni los controles táctiles
// y el aviso de «mecánica» se lee sin salirse. Prueba 7 tamaños de pantalla (apaisados y verticales) con un raro de nombre largo y estado largo.
//   node tools/shot.mjs --scenario tools/scenarios/rares-ui.mjs --device pixel7 --dpr 1 --out DIR     (y con --portrait; también en escritorio)
export default async function ({ boot, newGame, ev, wait, page, shot, device }) {
  await boot(); await newGame();
  await ev(() => {
    window.__silence && window.__silence(true); window.__dbg.Spawner.update = () => {};
    const G = window.__G, R = window.__rare, p = G.player;
    for (const e of G.enemies.slice()) { e.dead = true; e.deadT = 0; }
    const rng = { int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) };
    const s = R.spot(0, rng) || { x: G.map.pois.base.x + 45, z: G.map.pois.base.z + 45 };
    p.x = s.x; p.z = s.z; G.world.check(true); window.__step(20, 1 / 30);
    p.maxHp = 5e5; p.hp = 5e5; p.inv = 1e9; G.player.ws = [null, null];
    for (const e of G.enemies.slice()) if (!e.rq) { e.dead = true; e.deadT = 0; }
    const e = R.spawn('pararrayos', 5, s.x + 7, s.z, { alert: true });
    e.rq.name = 'Capitán Inmortal del Valle Esmeralda'; e.name = e.rq.name; e.hp = e.maxHp = 5e9;
    window.__step(20, 1 / 30);
    G.uiBlockDamage = true;
  });
  // en escritorio (sin controles táctiles) solo tienen sentido las ventanas de escritorio; con --device móvil, los tamaños de teléfono
  const touch = await ev(() => document.body.classList.contains('touch'));
  const sizes = touch ? [[915, 412], [844, 390], [667, 375], [740, 360], [390, 844], [375, 667], [360, 640]] : [[1280, 720], [1100, 620], [960, 540]];
  let bad = 0;
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await wait(10);
    await ev(() => { window.__step(5, 1 / 30); });
    const r = await ev(() => {
      const bar = document.getElementById('rqBar');
      const out = [], info = {};
      if (!bar || !bar.classList.contains('on')) return { size: innerWidth + 'x' + innerHeight, problems: ['la barra del raro no está visible'] };
      const b = bar.getBoundingClientRect();
      info.bar = [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)];
      if (b.left < 0 || b.right > innerWidth || b.top < 0 || b.bottom > innerHeight) out.push('la barra se sale de la pantalla');
      for (const sel of ['.nm', '.hp', '.stt']) { const el = bar.querySelector(sel); if (!el) continue; const q = el.getBoundingClientRect(); if (q.left < -0.5 || q.right > innerWidth + 0.5) out.push(sel + ' se sale en horizontal'); if (el.scrollWidth > el.clientWidth + 1 && sel !== '.nm' && sel !== '.stt') out.push(sel + ' recortado'); }
      const rects = ['#tmenu', '#mini', '#hTL', '#hTR', '#tracker', '#wslots', '#wpn', '.wslot', '#touch .tb', '#joy', '#gdg'].flatMap((s) => [...document.querySelectorAll(s)]);
      for (const el of rects) {
        const q = el.getBoundingClientRect();
        if (!q.width || !q.height || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
        // el texto del nombre y el estado (no el contenedor, que ocupa todo el ancho del bloque central) frente al resto de piezas
        for (const sel of ['.nm', '.hp', '.stt']) {
          const t = bar.querySelector(sel); if (!t) continue; const tb = t.getBoundingClientRect(); const wTxt = Math.min(tb.width, t.scrollWidth);
          const L = tb.left, Rr = tb.left + wTxt;
          const ox = Math.min(Rr, q.right) - Math.max(L, q.left), oy = Math.min(tb.bottom, q.bottom) - Math.max(tb.top, q.top);
          if (ox > 6 && oy > 2) out.push(sel + ' solapa con ' + (el.id || el.className) + ' (' + Math.round(ox) + '×' + Math.round(oy) + ' px)');   // los cajones de los bloques laterales llevan algo de holgura: solo se cuentan solapes de más de 6 px
        }
      }
      info.text = bar.innerText.replace(/\s+/g, ' ').slice(0, 90);
      return { size: innerWidth + 'x' + innerHeight, problems: out, info };
    });
    if (r.problems.length) bad++;
    console.log(`${r.problems.length ? 'FAIL' : 'PASS'}  ${r.size}  ${JSON.stringify(r.info || {})}  ${r.problems.join('; ')}`);
    if (w === 915 || w === 390 || w === 960) await shot(`rares-ui-${w}x${h}`);
  }
  const logs = [];
  console.log(bad ? `${bad} tamaños con problemas` : 'TODO OK');
  if (bad) process.exitCode = 1;
}

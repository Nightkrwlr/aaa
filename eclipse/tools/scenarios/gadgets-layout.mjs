// Comprueba que el botón GADGET no se solapa con los demás controles táctiles ni con el HUD en las pantallas objetivo.
//   node tools/shot.mjs --scenario tools/scenarios/gadgets-layout.mjs --device pixel7 --dpr 1 --out DIR
export default async function ({ boot, newGame, ev, wait, page, shot }) {
  await boot(); await newGame();
  const sizes = [[915, 412], [844, 390], [667, 375], [740, 360], [390, 844], [375, 667], [360, 640]];
  let bad = 0;
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await wait(8);
    const r = await ev(() => {
      const circ = (el) => { const b = el.getBoundingClientRect(); return { id: el.id || el.textContent.trim().slice(0, 8), cx: b.x + b.width / 2, cy: b.y + b.height / 2, r: Math.min(b.width, b.height) / 2, b }; };
      const g = circ(document.getElementById('tbGdg'));
      const out = [];
      for (const el of document.querySelectorAll('#touch .tb')) { if (el.id === 'tbGdg') continue; const c = circ(el); if (Math.hypot(c.cx - g.cx, c.cy - g.cy) < c.r + g.r + 2) out.push('solapa con ' + c.id); }
      const rects = ['#tmenu', '#mini', '#hTL', '#hTR', '#hTC', '#tracker', '#wslots', '#wpn', '.wslot'].flatMap((s) => [...document.querySelectorAll(s)]);
      for (const el of rects) { const b = el.getBoundingClientRect(); if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden') continue; if (!(g.b.right < b.left || g.b.left > b.right || g.b.bottom < b.top || g.b.top > b.bottom)) out.push('solapa con ' + (el.id || el.className)); }
      const inside = g.b.left >= 0 && g.b.right <= innerWidth && g.b.top >= 0 && g.b.bottom <= innerHeight;
      if (!inside) out.push('fuera de pantalla');
      return { size: innerWidth + 'x' + innerHeight, btn: Math.round(g.cx) + ',' + Math.round(g.cy) + ' ⌀' + Math.round(g.r * 2), problems: out };
    });
    if (r.problems.length) bad++;
    console.log(`${r.problems.length ? 'FAIL' : 'PASS'}  ${r.size}  botón en ${r.btn}  ${r.problems.join('; ')}`);
  }
  console.log(bad ? `${bad} tamaños con solapes` : 'TODO OK');
  if (bad) process.exitCode = 1;
}

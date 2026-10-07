// Phone e2e #3 — the three gestures a finger cannot do natively, on the real inventory panel:
//   tap → select · double-tap → equip (dblclick) · long-press → quick action (contextmenu) · hold + drag → move to another cell (drag & drop)
// usage: node tools/mobile-shot.mjs tools/e2e/mobile-panels.mjs --device pixel7 --dpr 1
export default async function ({ page, touch, wait, shot, logs, device, size }) {
  const OUT = 'artifacts/shots'; const portrait = size.height > size.width; const tag = `${device}_${portrait ? 'port' : 'land'}`;
  const results = [];
  const check = (name, ok, extra = '') => { results.push([name, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const center = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);

  // a bag with items the hero can really equip
  const made = await ev(() => {
    const g = window.__game, S = g.session, C = S.character, out = [];
    for (let i = 0; out.length < 6 && i < 80; i++) {
      const it = S.factory.roll(S.rng.fork(`pt${i}`), { ilvl: 1, slot: ['weapon', 'head', 'chest', 'hands', 'feet', 'neck'][i % 6], rarity: 'fine', classId: C.classId, noUnique: true });
      if (C.canEquip(it, C.slotFor(it)).ok === false) continue;
      if (C.inv.add(it)) out.push(it.iid);
    }
    return out;
  });
  check('test bag filled with equippable items', made.length >= 4, `${made.length} items`);

  const openInv = async () => {
    await ev(() => { const u = window.__game.ui; u.close('inventory'); });
    await wait(200);
    await ev(() => { window.__game.ui.open('inventory'); });
    await page.waitForFunction(() => document.querySelectorAll('.inv-root .cell .tile').length > 0, null, { timeout: 8000 }).catch(() => {});
    await wait(300);
  };
  await openInv();
  await shot(`${OUT}/mobpanel_${tag}_1_inventory.png`);
  const used0 = await ev(() => window.__game.session.character.inv.used);

  // 1 ── tap selects (detail card appears)
  const t0 = await center('.inv-root .cell[data-i="0"] .tile');
  check('first bag cell holds a tile', !!t0);
  if (t0) { await touch.tap(t0.x, t0.y); await wait(500); check('tap selects the item (detail card shown)', await ev(() => !!document.querySelector('.inv-right .tt-card, .inv-right [class*="card"]'))); }
  await shot(`${OUT}/mobpanel_${tag}_2_selected.png`);

  // 2 ── double tap equips: two quick taps on the same tile
  await openInv();
  const d0 = await center('.inv-root .cell[data-i="0"] .tile');
  if (d0) {
    await touch.doubleTap(d0.x, d0.y); await wait(600);
    const used1 = await ev(() => window.__game.session.character.inv.used);
    check('double-tap equips the item (bag shrinks by one)', used1 === used0 - 1, `bag ${used0} → ${used1}`);
  } else check('double-tap target tile found', false, await ev(() => JSON.stringify({ cells: document.querySelectorAll('.inv-root .cell').length, first: document.querySelector('.inv-root .cell')?.outerHTML?.slice(0, 160), slots: window.__game.session.character.inv.slots.slice(0, 6).map((x) => x?.iid ?? null) })));

  // 3 ── long press = contextmenu (quick action). The panel's onContext equips too, so the bag must shrink again.
  await openInv();
  const used2 = await ev(() => window.__game.session.character.inv.used);
  const l0 = await center('.inv-root .cell[data-i="0"] .tile') ?? await center('.inv-root .cell .tile');
  if (l0) {
    await ev(() => { window.__ctx = 0; document.addEventListener('contextmenu', () => { window.__ctx++; }, { once: false, capture: true }); });
    await touch.down(11, l0.x, l0.y); await sleep(900); await touch.up(11); await wait(500);
    const fired = await ev(() => window.__ctx);
    check('long-press fires a contextmenu', fired >= 1, `${fired} event(s)`);
  }

  // 4 ── hold, drag onto another cell that is on screen, drop: the two cells swap (checked on the game state, not the DOM)
  await openInv();
  const cells = await ev(() => [...document.querySelectorAll('.inv-root .cell')].map((c, i) => { const r = c.getBoundingClientRect(); return { i, has: !!c.querySelector('.tile'), x: r.left + r.width / 2, y: r.top + r.height / 2, onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; }));
  const vis = cells.filter((c) => c.onScreen);
  const A = vis.find((c) => c.has), B = vis.find((c) => c.has && c.i !== A?.i);
  check('two filled cells are on screen to drag between', !!A && !!B, `${vis.length} of ${cells.length} cells on screen`);
  if (A && B) {
    const before = await ev(([a, b]) => { const s = window.__game.session.character.inv.slots; return [s[a]?.iid, s[b]?.iid]; }, [A.i, B.i]);
    await touch.down(12, A.x, A.y); await sleep(650);
    const steps = 8; for (let i = 1; i <= steps; i++) { await touch.move(12, A.x + (B.x - A.x) * i / steps, A.y + (B.y - A.y) * i / steps); await sleep(20); }
    await shot(`${OUT}/mobpanel_${tag}_3_dragging.png`);
    await touch.up(12); await wait(500);
    const after = await ev(([a, b]) => { const s = window.__game.session.character.inv.slots; return [s[a]?.iid, s[b]?.iid]; }, [A.i, B.i]);
    check('hold + drag onto another cell swaps the two items', before[0] === after[1] && before[1] === after[0] && before[0] !== before[1], JSON.stringify({ before, after }));
  }

  // 5 ── the page must not have scrolled or zoomed under all that
  check('page did not scroll or zoom', await ev(() => scrollY === 0 && scrollX === 0 && (visualViewport?.scale ?? 1) === 1));

  if (logs.length) console.log('LOGS\n' + [...new Set(logs)].slice(0, 12).join('\n'));
  const bad = results.filter(([, ok]) => !ok).length;
  console.log(bad ? `MOBILE PANELS FAILED: ${bad}` : `MOBILE PANELS OK (${results.length} checks)`);
  return bad;
}

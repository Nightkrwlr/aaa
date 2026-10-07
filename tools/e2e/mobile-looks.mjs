// Visual QA of every panel on a phone with a POPULATED game (full bag, geared hero, talent points, quests, codex…).
//   node tools/mobile-shot.mjs tools/e2e/mobile-looks.mjs --device pixel7 --dpr 1 --query "e2e=1&autostart=belfry&seed=looks&fixed=1&quality=low"
// Screenshots: artifacts/shots/look_<device>_<land|port>_<panel>.png — judge them by eye, this script only fails on page errors.
export default async function ({ page, wait, shot, logs, device, size }) {
  const OUT = 'artifacts/shots', tag = `${device}_${size.height > size.width ? 'port' : 'land'}`;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(() => {
    const g = window.__game, s = g.session, C = s.character, w = g.world;
    C.level = 18; C.autoLoadout(); C.recompute(w, g.player);
    const slots = ['weapon', 'head', 'chest', 'hands', 'feet', 'neck', 'ring', 'ring', 'relic', 'offhand'];
    const rars = ['common', 'fine', 'fine', 'attuned', 'relic'];
    for (let i = 0; i < 34; i++) { const it = s.factory.roll(s.rng.fork(`look${i}`), { ilvl: 14 + (i % 5), rarity: rars[i % 5], slot: slots[i % slots.length], classId: C.classId, noUnique: true }); C.inv.add(it); }
    for (const it of C.inv.items().slice(0, 12)) { try { if (C.canEquip(it, C.slotFor(it)).ok) s.equip(it.iid); } catch { /* ignore */ } }
    C.inv.chimes = 4210; C.xp = 0;
  });
  await wait(300);
  const panels = [['inventory', {}], ['skills', {}], ['talents', {}], ['quests', {}], ['map', {}], ['codex', {}], ['craft', { station: null }], ['settings', {}], ['pause', {}]];
  for (const [id, opts] of panels) {
    await ev(([i, o]) => { const u = window.__game.ui; u.closeAll(); u.open(i, o); }, [id, opts]);
    await wait(500);
    await shot(`${OUT}/look_${tag}_${id}.png`);
  }
  // tap an item: the detail card must be reachable too
  await ev(() => { const u = window.__game.ui; u.closeAll(); u.open('inventory'); });
  await wait(400);
  await ev(() => { const t = document.querySelector('.inv-root .cell .tile'); t?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await wait(400); await shot(`${OUT}/look_${tag}_inventory_selected.png`);
  const bad = logs.filter((l) => /pageerror|frame failed/.test(l));
  console.log(bad.length ? `LOOKS: ${bad.length} page error(s): ${bad[0]}` : 'LOOKS OK');
  return bad.length;
}

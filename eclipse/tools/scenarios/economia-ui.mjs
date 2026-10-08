// Interfaz nueva de economía en cualquier dispositivo: tienda (vender), pestaña Botín del inventario y Registro de hitos.
//   node tools/shot.mjs --scenario tools/scenarios/economia-ui.mjs --device pixel7 [--portrait] --dpr 1 --out DIR
export default async function (api) {
  const { boot, newGame, ev, wait, shot, page } = api;
  await boot(); await newGame();
  await ev(() => {
    const G = window.__G, E = window.__eco;
    G.uiBlockDamage = true; window.__dbg.UI.close();
    window.__dbg.give('trofeos', 40);
    // objetos de sobra para la pestaña Vender y un par de hitos para el Registro
    for (const r of [0, 0, 1, 2, 3]) { const it = E.us(5, { rarity: r }); E.Ss(it, { silent: true }); }
    window.__dbg.drop('plan', 3, 'champion'); window.__dbg.drop('plan', 4, 'boss');
    window.__eco.cfg.milestone.banner = { 3: 1, 4: 1, 5: 1 };
    window.__G.S.credits = 3200;
    const v = G.map.ents.find((e) => e.k === 'npc' && e.npc === 'vega'); G.player.x = v.x + 1.5; G.player.z = v.z + 1.5;
  });
  await wait(4);
  await ev(() => window.__dbg.openShop('vega')); await wait(4);
  await page.click('[data-et="sell"]'); await wait(5);
  await shot('tienda-vender');
  await page.keyboard.press('Escape'); await wait(3);
  await ev(() => window.__dbg.openBotin()); await wait(5);
  await shot('inventario-botin');
  await page.keyboard.press('Escape'); await wait(3);
  await ev(() => window.__dbg.openHitos()); await wait(5);
  await shot('archivo-hitos');
}

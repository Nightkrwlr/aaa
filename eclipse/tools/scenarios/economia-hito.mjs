// Solo las celebraciones de hito (Épico, Legendario, Mítico) para revisar banner, destello y pilar en cualquier dispositivo.
//   node tools/shot.mjs --scenario tools/scenarios/economia-hito.mjs --device pixel7 [--portrait] --dpr 1 --out DIR
export default async function (api) {
  const { boot, newGame, ev, wait, shot } = api;
  await boot(); await newGame();
  await ev(() => { window.__G.uiBlockDamage = true; window.__dbg.UI.close(); window.__eco.cfg.milestone.banner = { 3: 90, 4: 90, 5: 90 }; });
  for (const [name, r, kind] of [['epico', 3, 'plan'], ['legendario', 4, 'plan'], ['mitico', 5, 'plan']]) {
    await ev(([r, kind]) => { window.__dbg.UI.close(); window.__dbg.drop(kind, r, r === 5 ? 'bossSecret' : 'boss'); }, [r, kind]);
    await wait(3);
    await shot(name);
  }
}

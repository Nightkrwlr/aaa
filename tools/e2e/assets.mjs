// Visual QA of the imported art through the stand-alone viewer: character lineup + dungeon + graveyard vignettes.
// usage: node tools/viewer-shot.mjs   (starts Vite, opens /tools/viewer/index.html, writes artifacts/shots/assets_*.png)
const OUT = process.env.SHOT_DIR ?? 'artifacts/shots';
export default async function ({ page, wait, shot, logs }) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const r = await ev(() => window.__viewer.init()); console.log('viewer', JSON.stringify(r));
  await ev(async () => {
    const V = window.__viewer;
    const L = [
      ['Knight', 'run', ['1H_Sword', 'Round_Shield']],
      ['Barbarian', 'attack2h', ['2H_Axe']],
      ['Mage', 'castLong', ['2H_Staff']],
      ['Rogue', 'attack1h', ['Knife', 'Knife_Offhand']],
      ['Rogue_Hooded', 'walk', ['1H_Crossbow']],
      ['Skeleton_Warrior', 'idleCombat', [['handslot.r', 'weapons_skeleton', 'Skeleton_Blade'], ['handslot.l', 'weapons_skeleton', 'Skeleton_Shield_Small_A']]],
      ['Skeleton_Mage', 'cast', [['handslot.r', 'weapons_skeleton', 'Skeleton_Staff']]],
      ['Skeleton_Rogue', 'run', [['handslot.r', 'weapons_skeleton', 'Skeleton_Blade']]],
      ['Skeleton_Minion', 'attackUnarmed', []],
    ];
    let i = 0; for (const [id, anim, atts] of L) await V.char(id, -12 + i++ * 3, 0, anim, atts, 0.4);
    V.look(0, 0, 22);
  });
  await wait(2500); await shot(`${OUT}/assets_lineup.png`);
  await ev(() => window.__viewer.look(-9, 0, 9)); await wait(800); await shot(`${OUT}/assets_lineup_close.png`);
  await ev(async () => {
    const V = window.__viewer; V.clear();
    for (let x = -3; x <= 3; x++) for (let z = 0; z < 3; z++) await V.add('dungeon', 'floor_tile_large', x * 4, 4 + z * 4);
    for (let x = -3; x <= 3; x++) await V.add('dungeon', x === 0 ? 'wall_doorway' : 'wall', x * 4, 0);
    await V.add('dungeon', 'torch_mounted', -4, 0.6); await V.add('dungeon', 'torch_mounted', 4, 0.6);
    await V.add('dungeon', 'barrel_large', 6, 3, 0.4); await V.add('dungeon', 'chest', -7, 3, 0.2); await V.add('dungeon', 'column', -8, 4); await V.add('dungeon', 'column', 8, 4);
    await V.add('dungeon', 'banner_red', -8, 0.5); await V.add('dungeon', 'table_long_decorated_A', 0, 9); await V.add('dungeon', 'candle_triple', 0, 9.2);
    await V.char('Knight', -2, 6, 'idleCombat', ['1H_Sword', 'Round_Shield'], 0.2);
    await V.char('Skeleton_Warrior', 3, 7, 'idleCombat', [['handslot.r', 'weapons_skeleton', 'Skeleton_Blade'], ['handslot.l', 'weapons_skeleton', 'Skeleton_Shield_Small_A']], 3.4);
    V.look(0, 6, 22);
  });
  await wait(2500); await shot(`${OUT}/assets_dungeon.png`);
  await ev(async () => {
    const V = window.__viewer; V.clear();
    const P = [['tree_dead_large', -6, -2], ['tree_pine_orange_large', 7, -3], ['tree_pine_yellow_medium', 10, 2], ['tree_dead_medium', -10, 3], ['gravestone', -2, 3], ['grave_A', 2, 4], ['grave_B', 5, 6], ['crypt', 0, -6], ['lantern_standing', -4, 5], ['fence', -8, 7], ['fence', -5, 7.5], ['pumpkin_orange_jackolantern', 4, 2], ['shrine_candles', 8, 7], ['coffin', -7, 6], ['path_A', 0, 4], ['path_B', 0, 8]];
    for (const [id, x, z] of P) await V.add('graveyard', id, x, z, 0.3);
    await V.char('Mage', 0, 1, 'castRaise', ['2H_Staff'], 0.6);
    V.look(0, 2, 24);
  });
  await wait(2500); await shot(`${OUT}/assets_graveyard.png`);
}

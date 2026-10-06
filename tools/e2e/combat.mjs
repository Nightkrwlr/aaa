// Combat scenario: player vs a mixed group; captures telegraphs and hit VFX mid-fight.
export default async function ({ page, wait, shot }) {
  const dir = '/tmp/claude-0/-home-user-aaa/3b641f7c-91e0-5f65-bdba-08dc578ec535/scratchpad/shots';
  await page.evaluate(() => {
    const g = window.__game, w = g.world, p = g.player;
    p.x = -24; p.z = 14; g.rig.initialised = false;
    p.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 99999 }]); w.refreshLife(p, true);
    // clear nearby enemies then spawn a showcase
    for (const e of w.entities) if (e.team === 'enemy') { e.dead = true; e.removed = true; }
    p.res.value = 100;
    const spawn = (id, dx, dz) => w.spawnEnemy(id, p.x + dx, p.z + dz, { level: 3 });
    spawn('enm.hollow_shieldbearer', 3, -3); spawn('enm.cracked_cantor', 5, -7); spawn('enm.hollow_chorister', 3.5, 1); spawn('enm.crackhide_boar', -4, -8); spawn('enm.chime_spitter', 8, -2); spawn('enm.keening_wisp', -6, -2);
  });
  await wait(2800);
  await shot(`${dir}/combat_1.png`);
  await page.evaluate(() => { const g = window.__game; g.player.cmd.aim = { x: g.player.x + 3, z: g.player.z - 3 }; g.world.controller.castSlot(g.player, 's1'); });
  await wait(450);
  await shot(`${dir}/combat_2.png`);
  await wait(1500);
  await page.evaluate(() => { const g = window.__game; g.player.res.value = 100; g.world.controller.castSlot(g.player, 's1'); });
  await wait(300);
  await shot(`${dir}/combat_3.png`);
}

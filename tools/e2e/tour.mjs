// Screenshot tour of the zone: teleports the player through key places.
export default async function ({ page, wait, shot }) {
  const places = [['settlement', 0, -24], ['quarry', 40, -2], ['windharps', -40, -32], ['overlook', 40, -56], ['choir', 5, 46], ['path', -30, 20]];
  for (const [name, x, z] of places) {
    await page.evaluate(([x, z]) => { const g = window.__game; g.player.x = x; g.player.z = z; g.player.invuln = 0; g.rig.setZoom(34); g.rig.initialised = false; g.player.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 99999 }]); g.world.refreshLife(g.player, true); }, [x, z]);
    await wait(2500);
    await shot(`${process.env.SHOT_DIR ?? 'artifacts/shots'}/tour_${name}.png`);
  }
}

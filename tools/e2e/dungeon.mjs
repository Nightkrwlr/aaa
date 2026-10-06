// Visual QA of the dungeon renderer: enters each family through the Resonance Chart API and screenshots key rooms.
const OUT = process.env.SHOT_DIR ?? '/tmp/claude-0/-home-user-aaa/3b641f7c-91e0-5f65-bdba-08dc578ec535/scratchpad/shots';
export default async function ({ page, wait, shot, logs }) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(() => { const g = window.__game, s = g.session; s.character.level = 6; s.character.recompute(s.world, s.player); s.player.stats.add('test', [{ stat: 'life', op: 'flat', value: 900 }]); });
  const fams = [['dfm.serrane_crypt', 'crypt', 'obj.retrieve_artifact', ['mod.dim', 'mod.hush_pockets']], ['dfm.crystal_cavern', 'cavern', 'obj.slay_boss', ['mod.spore_clouds']], ['dfm.broken_facility', 'facility', 'obj.destroy_nodes', ['mod.power_surges']]];
  for (const [fam, name, objective, mods] of fams) {
    const r = await ev(([fam, objective, mods]) => { const g = window.__game, s = g.session; if (s.mode === 'dungeon') s.dungeon.leave(false); const res = s.openRift({ family: fam, size: 'small', seed: 'visual-1', objective, modifiers: mods }); return { ok: res.ok, errors: res.errors }; }, [fam, objective, mods]);
    if (!r.ok) { console.log('FAIL enter', fam, JSON.stringify(r)); continue; }
    await wait(2500);
    await shot(`${OUT}/dng_${name}_entrance.png`);
    const spots = await ev(() => { const s = window.__game.session, rt = s.dungeon, d = rt.d, c = d.content; const pts = []; const first = d.graph.critical; const roomPos = (id) => { const r = d.rooms.get(id); return [(r.cx + 0.5) * 2, (r.cy + 0.5) * 2]; }; pts.push(['mid', ...roomPos(first[Math.floor(first.length / 2)])]); const pz = c.puzzles[0]; if (pz) pts.push(['puzzle', pz.x - 3, pz.z]); pts.push(['boss', c.boss.x, c.boss.z - 5]); const shr = c.shrines[0]; if (shr) pts.push(['shrine', shr.x, shr.z - 3]); return pts; });
    for (const [label, x, z] of spots) {
      await ev(([x, z]) => { const g = window.__game, s = g.session; s.player.x = x; s.player.z = z; g.rig.initialised = false; s.player.hp = s.player.hpMax; }, [x, z]);
      await wait(2200);
      await shot(`${OUT}/dng_${name}_${label}.png`);
    }
  }
  const errs = logs.filter((l) => /pageerror|frame failed|ERROR/.test(l));
  console.log(errs.length ? `ERRORS:\n${errs.slice(0, 8).join('\n')}` : 'no frame errors');
}

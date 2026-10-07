// Quick look at the dungeon renderer: DNG=crypt,cavern,facility  SPOTS=mid,puzzle,boss,shrine,entrance,door,lock  SHOT_DIR=artifacts/shots
// usage: DNG=crypt SPOTS=mid,boss node tools/shot.mjs artifacts/shots/dl_end.png --script tools/e2e/dungeon-look.mjs --wait 2000 --query "e2e=1&autostart=belfry&seed=dungeons&fixed=1&quality=high"
const OUT = process.env.SHOT_DIR ?? 'artifacts/shots';
const FAMS = {
  crypt: ['dfm.serrane_crypt', 'obj.retrieve_artifact', ['mod.dim', 'mod.hush_pockets']],
  cavern: ['dfm.crystal_cavern', 'obj.slay_boss', ['mod.spore_clouds']],
  facility: ['dfm.broken_facility', 'obj.destroy_nodes', ['mod.power_surges']],
};
export default async function ({ page, shot, logs }) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frames = (n) => ev((k) => new Promise((res) => { const g = window.__game, t = g.frames + k; const id = setInterval(() => { if (g.frames >= t) { clearInterval(id); res(); } }, 16); }), n);
  await ev(() => { const g = window.__game, s = g.session; s.character.level = 6; s.character.recompute(s.world, s.player); s.player.stats.add('test', [{ stat: 'life', op: 'flat', value: 900 }]); });
  const want = (process.env.DNG ?? 'crypt').split(','), spots = (process.env.SPOTS ?? 'mid,boss').split(',');
  const seed = process.env.SEED ?? 'visual-1';
  for (const name of want) {
    const [fam, objective, mods] = FAMS[name];
    const r = await ev(([fam, objective, mods, seed]) => { const g = window.__game, s = g.session; if (s.mode === 'dungeon') s.dungeon.leave(false); const res = s.openRift({ family: fam, size: 'small', seed, objective, modifiers: mods }); return { ok: res.ok, errors: res.errors }; }, [fam, objective, mods, seed]);
    if (!r.ok) { console.log('FAIL enter', fam, JSON.stringify(r)); continue; }
    await frames(34);
    if (spots.includes('entrance')) await shot(`${OUT}/dl_${name}_entrance.png`);
    const pts = await ev(() => { const s = window.__game.session, d = s.dungeon.d, c = d.content, out = {}; const first = d.graph.critical; const rp = (id) => { const r = d.rooms.get(id); return [(r.cx + 0.5) * 2, (r.cy + 0.5) * 2]; }; out.mid = rp(first[Math.floor(first.length / 2)]); const pz = c.puzzles[0]; if (pz) out.puzzle = [pz.x - 3, pz.z]; out.boss = [c.boss.x, c.boss.z - 5]; const shr = c.shrines[0]; if (shr) out.shrine = [shr.x, shr.z - 3]; const dr = s.dungeon.doors.find((x) => x.kind !== 'secret' && x.type === 2) ?? s.dungeon.doors.find((x) => x.kind !== 'secret'); if (dr) out.door = [dr.x, dr.z + 4]; const lk = s.dungeon.doors.find((x) => x.type === 3); if (lk) out.lock = [lk.x, lk.z + 4]; return out; });
    for (const label of spots) {
      if (label === 'entrance' || !pts[label]) continue;
      const [x, z] = pts[label];
      await ev(([x, z]) => { const g = window.__game, s = g.session; s.player.x = x; s.player.z = z; g.rig.initialised = false; s.player.hp = s.player.hpMax; }, [x, z]);
      await frames(22);
      await shot(`${OUT}/dl_${name}_${label}.png`);
    }
  }
  const errs = logs.filter((l) => /pageerror|frame failed|ERROR/.test(l));
  console.log(errs.length ? `ERRORS:\n${errs.slice(0, 8).join('\n')}` : 'no frame errors');
}

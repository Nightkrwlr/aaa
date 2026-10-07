// Character / enemy roster visual QA inside the REAL game (real camera, lights, post-processing).
//
//   node tools/shot.mjs out.png --script tools/e2e/chars.mjs --wait 800 --query "e2e=1&autostart=belfry&seed=chars&fixed=1&quality=high"
//
// env:  SET=classes|npcs|hollow|beasts|constructs|bosses|all   (default all)  — or IDS=enm.a,enm.b,@mdl.x  (a leading @ shows a bare model on a display entity)
//       VIEW=lineup|run|attack|hit|death|sheet   (default sheet = lineup + run + attack + death contact sheet of every archetype)
//       ZOOM=15..38 (camera distance, default 19)   SHOT_DIR=artifacts/shots   HUD=1 keeps the HUD   TAG=name
//
// Everything is driven through window.__game (e2e=1): the AI is frozen so poses are deterministic, enemies are spawned with
// world.spawnEnemy, attacks are cast through the real ability runtime (free:true) so the animation state machine sees genuine cast phases.
const OUT = process.env.SHOT_DIR ?? 'artifacts/shots';
const TAG = process.env.TAG ?? 'chars';
const SETS = {
  classes: ['@mdl.belfry', '@mdl.prismatist', '@mdl.skirmisher'],
  npcs: ['@mdl.npc_orrel', '@mdl.npc_hesk', '@mdl.npc_sil', '@mdl.npc_maeve', '@mdl.npc_tarn', '@mdl.npc_scout'],
  hollow: ['enm.hollow_chorister', 'enm.hollow_shieldbearer', 'enm.cracked_cantor', 'enm.hollow_sacristan', 'enm.wailer', 'enm.mute_bellringer', 'enm.penitent_blast', 'enm.hollow_whisperer'],
  beasts: ['enm.cliff_stalker', 'enm.crackhide_boar', 'enm.drone_swarm', 'enm.chime_spitter', 'enm.echo_burrower', 'enm.pulsing_cocoon', 'enm.keening_wisp'],
  constructs: ['enm.brass_sentinel', 'enm.tuning_turret', 'enm.wire_spider', 'enm.reaper_gear', 'enm.resonance_node', '@mdl.dummy', '@mdl.echo_decoy'],
  bosses: ['boss.brannoch', 'boss.ildra', 'boss.crypt_warden', 'boss.cave_matriarch', 'boss.facility_core', 'boss.tarn_echo'],
};
SETS.all = [...SETS.classes, ...SETS.npcs, ...SETS.hollow, ...SETS.beasts, ...SETS.constructs, ...SETS.bosses];

export default async function ({ page, wait: wallWait, shot, logs }) {
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frames = async (n) => { const f0 = await ev(() => window.__game.frames); await page.waitForFunction((t) => window.__game.frames >= t, f0 + n, { timeout: 180000, polling: 40 }); };
  const ready = await ev(() => window.__game.assetsReady);
  console.log('art ready:', ready);
  const view = process.env.VIEW ?? 'sheet';
  const zoom = Number(process.env.ZOOM ?? 22);
  const yaw = process.env.YAW !== undefined ? Number(process.env.YAW) : Math.PI / 4;     // facing: PI/4 = towards the camera, PI/4+1.57 = profile
  const setName = process.env.SET ?? 'all';
  const ids = process.env.IDS ? process.env.IDS.split(',') : (SETS[setName] ?? SETS.all);
  if (!process.env.HUD) await ev(() => { document.getElementById('ui').style.visibility = 'hidden'; });

  // ── stage: freeze AI, clear the zone's enemies, find a flat clearing next to the player
  const stage = await ev(() => {
    const g = window.__game, w = g.world, p = g.player;
    w.ai.update = () => {};
    for (const e of w.entities) if (e.team === 'enemy') { e.removed = true; }
    p.stats.add('godmode', [{ stat: 'life', op: 'flat', value: 99999 }]); w.refreshLife(p, true);
    const z = g.zone; let best = null;
    for (let r = 0; r < 40; r++) {
      const x = p.x + (Math.random() - 0.5) * 80, zz = p.z + (Math.random() - 0.5) * 80;
      if (!w.nav.isWalkable(x, zz)) continue;
      let lo = 1e9, hi = -1e9;
      for (let i = -8; i <= 8; i += 2) for (let j = -8; j <= 8; j += 2) { const h = z.heightAt(x + i, zz + j); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (!best || hi - lo < best.var) best = { x, z: zz, var: hi - lo };
    }
    return best ?? { x: p.x, z: p.z, var: 99 };
  });
  console.log('stage', JSON.stringify(stage));
  const spawnAll = (ids, opts) => ev(({ ids, stage, opts }) => {
    const g = window.__game, w = g.world, p = g.player;
    const spacing = opts.spacing, rightX = Math.SQRT1_2, rightZ = -Math.SQRT1_2;
    const per = opts.perRow, n = ids.length;
    const out = [];
    ids.forEach((id, i) => {
      const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, n - row * per);
      const off = (col - (inRow - 1) / 2) * spacing;
      const fx = -rightZ, fz = rightX; // forward (away from camera) = (-0.707,-0.707)... rows stack along it
      const x = stage.x + rightX * off - Math.SQRT1_2 * row * spacing * 0.9, z = stage.z + rightZ * off - Math.SQRT1_2 * row * spacing * 0.9;
      let e;
      if (id.startsWith('@')) {
        e = w.makeObject({ id: `show.${id}`, x, z, radius: 0.5, hp: 99999, team: 'neutral', untargetable: true });
        e.def = { model: id.slice(1) }; e.tier = 'standard'; e.stats.add('x', [{ stat: 'life', op: 'base', value: 100 }]);
        e.corpseTime = 1e9;
      } else {
        e = w.spawnEnemy(id, x, z, { level: 6 });
        e.ai.cfg.aggroRange = 0; e.ai.cfg.hearRange = 0; e.asleep = false;
      }
      e.yaw = opts.yaw; e.hp = e.hpMax = e.hpMax || 1;
      out.push({ id, uid: e.uid });
    });
    // keep the player close (so distance-LOD matches real play) but out of frame: just behind the camera side of the clearing
    p.x = stage.x + 12; p.z = stage.z + 12; p.yaw = Math.PI / 4;
    const gy = g.zone.heightAt(stage.x, stage.z);
    g.rig.cine = { x: stage.x - 0.8 * opts.perRowShift, y: gy + 1.0, z: stage.z - 0.8 * opts.perRowShift, zoom: opts.zoom };
    g.rig.initialised = false;
    return out;
  }, { ids, stage, opts });

  const uids = [];
  const setup = async (list, opts) => { const r = await spawnAll(list, opts); uids.length = 0; uids.push(...r); await frames(14); };
  const per = Math.min(8, ids.length);
  const groups = []; for (let i = 0; i < ids.length; i += 8) groups.push(ids.slice(i, i + 8));

  const lineup = async (list, name) => { await setup(list, { spacing: zoom > 26 ? 3.2 : 2.5, perRow: 8, zoom, yaw, perRowShift: 0 }); await frames(20); await shot(`${OUT}/${TAG}_${name}.png`); };

  if (view === 'lineup' || view === 'sheet') {
    let gi = 0;
    for (const grp of groups) { await lineup(grp, `${setName}_${gi++}_lineup`); await ev(() => { const w = window.__game.world; for (const e of w.entities) if (e !== window.__game.player && e.kind !== 'npc') e.removed = true; }); await frames(2); }
  }

  if (view === 'run' || view === 'sheet') {
    let gi = 0;
    for (const grp of groups) {
      await setup(grp, { spacing: 2.6, perRow: 8, zoom, yaw, perRowShift: 0 });
      await ev(() => { const w = window.__game.world; for (const e of w.entities) { if (e === window.__game.player || e.removed || e.untargetable && e.kind !== 'object') continue; if (e.kind === 'player') continue; e.intent = { x: -Math.SQRT1_2, z: -Math.SQRT1_2, speedMult: 1 }; } });
      await frames(26); await shot(`${OUT}/${TAG}_${setName}_${gi}_run.png`);
      await ev(() => { const w = window.__game.world; for (const e of w.entities) if (e !== window.__game.player && e.kind !== 'npc') e.removed = true; });
      await frames(2); gi++;
    }
  }

  if (view === 'attack' || view === 'sheet') {
    let gi = 0;
    for (const grp of groups) {
      await setup(grp, { spacing: 2.6, perRow: 8, zoom, yaw, perRowShift: 0 });
      // every enemy casts its first ability at the player (free:true): shoot at the impact moment of each cast
      await ev(() => {
        const g = window.__game, w = g.world, p = g.player;
        for (const e of w.entities) { if (e === p || e.dead || !e.abilityIds?.length) continue; e.ai.target = p; const ab = e.abilityIds[0]; w.abilities.tryCast(e, ab, p.x, p.z, { free: true, target: p.uid }); }
      });
      await frames(10); await shot(`${OUT}/${TAG}_${setName}_${gi}_attack_a.png`);
      await frames(12); await shot(`${OUT}/${TAG}_${setName}_${gi}_attack_b.png`);
      await ev(() => { const w = window.__game.world; for (const e of w.entities) if (e !== window.__game.player && e.kind !== 'npc') e.removed = true; });
      await frames(2); gi++;
    }
  }

  if (view === 'death' || view === 'sheet') {
    let gi = 0;
    for (const grp of groups) {
      await setup(grp, { spacing: 2.6, perRow: 8, zoom, yaw, perRowShift: 0 });
      await ev(() => { const g = window.__game, w = g.world; for (const e of w.entities) { if (e === g.player || e.dead || e.kind === 'object') continue; if (e.team === 'enemy') w.kill(e, g.player); } });
      await frames(14); await shot(`${OUT}/${TAG}_${setName}_${gi}_death_a.png`);
      await frames(20); await shot(`${OUT}/${TAG}_${setName}_${gi}_death_b.png`);
      await ev(() => { const w = window.__game.world; for (const e of w.entities) if (e !== window.__game.player && e.kind !== 'npc') e.removed = true; });
      await frames(2); gi++;
    }
  }

  if (view === 'hit') {
    await setup(groups[0], { spacing: 2.6, perRow: 8, zoom, yaw, perRowShift: 0 });
    await ev(() => { const g = window.__game, w = g.world, p = g.player; for (const e of w.entities) if (e.team === 'enemy' && !e.dead) w.dealDirect(p, e, e.hpMax * 0.06, 'physical', {}); });
    await frames(3); await shot(`${OUT}/${TAG}_hit_a.png`);
    await frames(5); await shot(`${OUT}/${TAG}_hit_b.png`);
  }

  const info = await ev(() => { const g = window.__game, r = g.scene3d.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, tex: r.memory.textures, views: g.views.stats }; });
  console.log('RENDER', JSON.stringify(info));
  const errs = logs.filter((l) => /pageerror|error/i.test(l));
  if (errs.length) console.log('ERRORS', [...new Set(errs)].slice(0, 8).join('\n'));
}

import { h, button, clear, tabs, select, toggle } from '../dom.js';
import { t } from '../../../core/i18n.js';
import { logger, setLogLevel } from '../../../core/logger.js';

/** Developer tools — only registered in dev builds (__DEV_TOOLS__). Never shipped to production. */
export function dev(game, ui) {
  const el = h('div', { class: 'dev-root' });
  let tab = 'cheats'; const out = h('pre', { class: 'dev-out' });
  const S = () => game.session;
  const say = (x) => { out.textContent = typeof x === 'string' ? x : JSON.stringify(x, null, 1); };
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

  const render = () => {
    clear(el);
    const s = S();
    el.append(h('div', { class: 'panel-head' }, h('h2', {}, 'DEV TOOLS'), h('span', { class: 'dim' }, `seed ${s.seed} · tick ${s.world.tickCount} · ${s.mode}`), button('✕', () => ui.close('dev'), { cls: 'x' })));
    el.append(tabs([['cheats', 'Cheats'], ['spawn', 'Spawn'], ['world', 'World'], ['story', 'Story'], ['dungeon', 'Dungeon'], ['perf', 'Perf / debug']].map(([id, label]) => ({ id, label })), (id) => { tab = id; render(); }, tab).bar);
    const body = h('div', { class: 'dev-body' });
    const c = s.character, p = s.player, w = s.world;
    if (tab === 'cheats') {
      const lvl = h('input', { type: 'number', value: c.level, min: 1, max: 60, style: { width: '70px' } });
      body.append(
        h('div', { class: 'row' }, 'Level', lvl, button('Set', () => { c.level = Math.max(1, Math.min(60, num(lvl.value, 1))); c.xp = 0; c.recompute(w, p); p.hp = p.hpMax; render(); }), button('+500 XP', () => { c.grantXp(w, p, 500); render(); }), button('+5 talent pts', () => { c.talentBonus += 5; render(); })),
        h('div', { class: 'row' }, button('+1000 chimes', () => { c.inv.addChimes(1000); }), button('Materials ×20', () => { for (const m of s.registry.all('material')) c.inv.addMaterial(m.id, 20); }), button('Refill potions', () => c.refillPotions()), button('Heal', () => w.heal(p, p.hpMax, null, true))),
        toggle('God mode', !!p.flags.has('god') || p.stats.get('life') > 50000, (v) => { if (v) p.stats.add('dev:god', [{ stat: 'life', op: 'flat', value: 99999 }, { stat: 'damage', op: 'more', group: 'dev', value: 4 }]); else p.stats.remove('dev:god'); w.refreshLife(p, true); }),
        select('Time scale', String(w.timeScale), ['0.25', '0.5', '1', '2', '4'].map((v) => [v, `${v}×`]), (v) => { w.timeScale = Number(v); }),
        h('div', { class: 'row' }, select('Roll item', 'fine', ['common', 'fine', 'attuned', 'relic'].map((r) => [r, r]), (r) => { const it = s.factory.roll(w.rng, { ilvl: c.level, rarity: r, tags: c.buildTags(), classId: c.classId }); c.inv.add(it); say(`gave ${it.iid} ${it.base} ${it.rarity}`); }),
          select('Unique', '', [['', '—'], ...s.registry.all('unique').map((u) => [u.id, u.id])], (u) => { if (u) { c.inv.add(s.factory.makeUnique(w.rng, u, c.level)); say(`gave ${u}`); } })));
    } else if (tab === 'spawn') {
      const en = select('Enemy', 'enm.hollow_chorister', s.registry.all('enemy').filter((e) => e.family !== 'fam.test').map((e) => [e.id, e.id]), () => {});
      const cnt = h('input', { type: 'number', value: 3, min: 1, max: 30, style: { width: '60px' } });
      const el2 = h('input', { type: 'checkbox' });
      body.append(en, h('div', { class: 'row' }, 'Count', cnt, h('label', {}, el2, ' elite'), button('Spawn here', () => { const id = en.querySelector('select').value; for (let i = 0; i < num(cnt.value, 1); i++) { const e = w.spawnEnemy(id, p.x + 4 + Math.random() * 4, p.z + Math.random() * 6 - 3, { level: c.level, elite: el2.checked }); e.ai.target = p; e.alerted = true; } }), button('Kill all enemies', () => { for (const e of w.entities) if (e.team === 'enemy' && !e.dead) w.kill(e, p); }), button('Remove all', () => { for (const e of w.entities) if (e.team === 'enemy') e.removed = true; })));
    } else if (tab === 'world') {
      if (s.mode === 'overworld') {
        body.append(select('Teleport to', '', [['', '—'], ...s.zone.pois.filter((q) => q.type !== 'area_mark').map((q) => [q.id, q.id])], (id) => { const q = s.zone.poiById.get(id); if (q) { p.x = q.x + 1.5; p.z = q.z + 1.5; game.rig.initialised = false; } }),
          select('Weather', s.weather.current, [['calm', 'calm'], ['mist', 'mist'], ['windstorm', 'windstorm']], (v) => s.weather.force(v, 300)),
          h('div', { class: 'row' }, button('Unlock all waypoints', () => { for (const q of s.zone.pois) if (q.type === 'waypoint') s.unlockWaypoint(q.id); }), button('Reveal map', () => { s.state.explore(s.zone, 0, 0, 200); }), button('Force event', () => { s.dyn.request(); }), button('Rest', () => s.rest())),
          h('div', { class: 'row' }, ...s.registry.all('gate').filter((g) => !g.designed).map((g) => button(`Open ${g.id}`, () => s.openGate(g.id)))));
      } else body.append(h('div', {}, 'Teleports available in the overworld only.'), button('Open all doors', () => { for (const d of s.dungeon.doors) s.dungeon.openDoor(d.id); }), button('Complete objective', () => { s.dungeon.objective.done = true; }), button('Reveal all rooms', () => { for (const r of s.dungeon.d.rooms.keys()) s.dungeon.explored.add(r); }));
    } else if (tab === 'story') {
      const q = select('Quest', '', [['', '—'], ...s.registry.all('quest').map((x) => [x.id, x.id])], () => {});
      const flag = h('input', { type: 'text', placeholder: 'flag name', style: { width: '160px' } });
      body.append(q, h('div', { class: 'row' }, button('Start', () => { const id = q.querySelector('select').value; if (id) s.quests.start(id); }), button('Complete', () => { const id = q.querySelector('select').value; if (id) s.quests.complete(id); }), button('Next stage', () => { const id = q.querySelector('select').value, st = s.state.quests[id]; if (st) { const d = s.registry.get(id), i = d.stages.findIndex((x) => x.id === st.stage); if (d.stages[i + 1]) s.quests.advanceTo(id, d.stages[i + 1].id); else s.quests.complete(id); } })),
        h('div', { class: 'row' }, flag, button('Set flag', () => { s.state.setFlag(flag.value.trim()); s.events.emit('flag', { flag: flag.value.trim() }); }), button('Dump state', () => say({ flags: s.state.flags, quests: s.state.quests, gates: s.state.gates, bosses: [...s.state.bosses], secrets: s.state.secrets }))));
    } else if (tab === 'dungeon') {
      const fam = select('Family', 'dfm.serrane_crypt', s.registry.all('dungeonFamily').map((f) => [f.id, f.id]), () => {});
      const seed = h('input', { type: 'text', value: 'dev-1', style: { width: '120px' } });
      const size = select('Size', 'small', [['small', 'small'], ['medium', 'medium'], ['large', 'large']], () => {});
      body.append(fam, size, h('div', { class: 'row' }, 'Seed', seed, button('Generate & enter', () => { const r = s.openRift({ family: fam.querySelector('select').value, size: size.querySelector('select').value, seed: seed.value }); say(r.ok ? { id: r.dungeon.id, rooms: r.dungeon.rooms.size, attempts: r.dungeon.attempt, code: r.dungeon.code } : r); })),
        s.mode === 'dungeon' ? h('pre', { class: 'dev-out' }, s.dungeon.d.map.ascii().split('\n').slice(0, 70).join('\n')) : null);
    } else {
      body.append(h('div', { class: 'row' }, button('Stats', () => say({ fps: game.fps.toFixed(0), entities: w.entities.length, calls: game.scene3d.renderer.info.render.calls, tris: game.scene3d.renderer.info.render.triangles, geos: game.scene3d.renderer.info.memory.geometries, tex: game.scene3d.renderer.info.memory.textures, ai: w.ai.stats, lootGround: s.loot.ground.length, zones: w.zones.length, projectiles: w.projectiles.length, director: s.director.log.slice(-5), events: s.dyn.history })),
        button('Telemetry', () => say(s.telemetry.slice(-30))), button('Missing i18n keys', () => say([...(window.__i18nMissing ?? [])].slice(0, 40))), button('Debug log', () => setLogLevel('debug')), button('Snapshot save', () => say(game.saves.save('slot3', s)))),
        toggle('Show nav grid (overlay)', !!game.devNav, (v) => { game.devNav = v; }));
    }
    el.append(body, out);
  };
  return { el, blocking: false, open() { render(); }, close() {}, update() {} };
}

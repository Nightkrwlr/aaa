import { h, button, clear } from '../dom.js';
import { t, i18n } from '../../../core/i18n.js';
import { T, TILE } from '../../../sim/dungeon/tilemap.js';

const terrainCache = new Map();
function terrainImage(zone) {
  let c = terrainCache.get(zone.id); if (c) return c;
  const [W, H] = zone.def.size, [ox, oz] = zone.def.origin;
  c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = ox + i + 0.5, z = oz + j + 0.5, y = zone.heightAt(x, z);
    const dx = zone.heightAt(x + 1, z) - zone.heightAt(x - 1, z), dz = zone.heightAt(x, z + 1) - zone.heightAt(x, z - 1);
    const shade = Math.max(0.55, Math.min(1.35, 1 + (-dx * 0.55 - dz * 0.35) * 0.45));
    const blocked = zone.nav.isBlockedCell(zone.nav.cx(x), zone.nav.cz(z));
    const base = y > 10 ? [150, 140, 128] : y > 4 ? [190, 176, 146] : y > 0.8 ? [176, 168, 130] : y < -1.5 ? [118, 120, 132] : [150, 156, 124];
    const k = (blocked ? 0.74 : 1) * shade, p = (j * W + i) * 4;
    img.data[p] = Math.min(255, base[0] * k); img.data[p + 1] = Math.min(255, base[1] * k); img.data[p + 2] = Math.min(255, base[2] * k); img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  terrainCache.set(zone.id, c);
  return c;
}

export function mapPanel(game, ui) {
  const el = h('div', { class: 'map-root' });
  const canvas = h('canvas', { class: 'map-canvas', width: 640, height: 640, 'aria-label': t('ui.map') });
  const ctx = canvas.getContext('2d');
  const side = h('div', { class: 'map-side' });
  let mode = 'view', at = null, hoverWp = null, raf = 0;
  const S = 640;

  const zoneMap = () => {
    const s = game.session, z = s.zone, [W, H] = z.def.size, [ox, oz] = z.def.origin, k = S / W;
    return { z, W, H, ox, oz, k, toS: (x, zz) => [(x - ox) * k, (zz - oz) * k], toW: (px, py) => [px / k + ox, py / k + oz] };
  };

  const draw = () => {
    raf = 0;
    if (!ui.isOpen('map')) return;
    const s = game.session;
    ctx.clearRect(0, 0, S, S);
    if (s.mode === 'dungeon') return drawDungeon();
    const m = zoneMap(), st = s.state, grid = st.fogGrid(m.z);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrainImage(m.z), 0, 0, S, S);
    // areas (names on explored ones)
    ctx.font = '700 13px sans-serif'; ctx.textAlign = 'center';
    for (const a of m.z.areas) {
      const [x, y] = m.toS(a.c[0], a.c[1]);
      if (!st.visitedAreas.has(a.id)) continue;
      ctx.fillStyle = 'rgba(30,24,16,.75)'; ctx.fillText(t(`${a.id}.name`).toUpperCase(), x + 1, y + 1); ctx.fillStyle = 'rgba(255,240,205,.95)'; ctx.fillText(t(`${a.id}.name`).toUpperCase(), x, y);
    }
    // fog of war
    ctx.fillStyle = 'rgba(12,14,20,.9)';
    const cs = grid.C * m.k;
    for (let j = 0; j < grid.rows; j++) for (let i = 0; i < grid.cols; i++) if (!grid.known(i, j)) ctx.fillRect(i * cs - 0.5, j * cs - 0.5, cs + 1, cs + 1);
    const known = (x, z) => { const i = Math.floor((x - m.ox) / grid.C), j = Math.floor((z - m.oz) / grid.C); return grid.known(i, j); };
    // gate curtain
    for (const g of m.z.def.gates ?? []) { const [cx, cy] = m.toS(g.ellipse.c[0], g.ellipse.c[1]); const open = s.barrierOpen(g.id); ctx.strokeStyle = open ? 'rgba(109,255,154,.5)' : 'rgba(127,227,255,.85)'; ctx.setLineDash(open ? [4, 6] : []); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx, cy, g.ellipse.r[0] * m.k, g.ellipse.r[1] * m.k, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    // POIs
    hoverWp = hoverWp && st.waypoints.has(hoverWp.id) ? hoverWp : null;
    const icon = (x, y, shape, col, r = 6) => { ctx.fillStyle = col; ctx.strokeStyle = '#10131a'; ctx.lineWidth = 2; ctx.beginPath(); if (shape === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); } else if (shape === 'square') ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); else ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
    for (const p of m.z.pois) {
      const [x, y] = m.toS(p.x, p.z);
      if (p.type === 'waypoint') { const unlocked = st.waypoints.has(p.id); if (!unlocked && !known(p.x, p.z)) continue; icon(x, y, 'diamond', unlocked ? '#7fe3ff' : '#5a6a78', 8); if (hoverWp?.id === p.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke(); } }
      else if (known(p.x, p.z) && ['dungeon', 'station', 'gate', 'stash', 'chart'].includes(p.type)) icon(x, y, p.type === 'dungeon' ? 'square' : 'circle', p.type === 'dungeon' ? '#b79cff' : p.type === 'gate' ? '#7fe3ff' : '#ffd27a', 5);
    }
    for (const n of m.z.npcs) if (st.npcMemory[n.id]?.met && !n.cond) { const [x, y] = m.toS(n.x, n.z); icon(x, y, 'circle', '#ffd27a', 4); }
    // quest objective hint
    const qid = st.flags.trackedQuest && st.quests[st.flags.trackedQuest]?.state === 'active' ? st.flags.trackedQuest : s.quests.active()[0];
    if (qid) for (const o of s.quests.objectives(qid)) {
      if (o.done) continue;
      let pos = null;
      if (o.type === 'reach') { const a = m.z.areaById.get(o.area); if (a) pos = a.c; }
      else if (o.type === 'defeatBoss') { const b = m.z.def.bosses.find((x) => x.boss === o.boss); if (b) pos = b.pos; }
      else if (o.type === 'talk') { const n = m.z.npcs.find((x) => x.id === o.npc); if (n) pos = [n.x, n.z]; }
      else if (o.type === 'completeDungeon') { const p = m.z.pois.find((x) => x.dungeon === o.dungeon); if (p) pos = [p.x, p.z]; }
      else if (o.type === 'discover' && o.id === 'cdx.cylinder_awakening') { const p = m.z.poiById.get('poi.voice_cylinder_1'); if (p) pos = [p.x, p.z]; }
      else if (o.type === 'flag' && o.flag === 'open:gate.choir_door') { const p = m.z.poiById.get('poi.bellgate'); if (p) pos = [p.x, p.z]; }
      if (pos) { const [x, y] = m.toS(pos[0], pos[1]); const pulse = 1 + Math.sin(performance.now() / 260) * 0.2; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 16 * pulse, 0, 7); ctx.stroke(); ctx.fillStyle = '#ffe27a'; ctx.font = '700 16px sans-serif'; ctx.fillText('★', x, y + 5); }
    }
    // markers
    for (const mk of st.markers) { const [x, y] = m.toS(mk.x, mk.z); ctx.fillStyle = '#ff6a8a'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 14); ctx.lineTo(x + 5, y - 14); ctx.closePath(); ctx.fill(); }
    // player
    const p = s.player, [px, py] = m.toS(p.x, p.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI - p.yaw); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    raf = requestAnimationFrame(draw);
  };

  const drawDungeon = () => {
    const s = game.session, rt = s.dungeon, map = rt.d.map, p = s.player;
    const sc = Math.min(S / map.w, S / map.h) * 0.98;
    const roomBy = new Map(); for (const r of rt.d.rooms.values()) roomBy.set(r.region, r);
    ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const tt = map.get(x, y); if (tt === T.WALL || tt === T.SECRET) continue;
      const rm = roomBy.get(map.region[map.idx(x, y)]);
      if (rm && !rt.explored.has(rm.id)) continue;
      if (!rm && Math.hypot(x - p.x / TILE, y - p.z / TILE) > 14) continue;
      ctx.fillStyle = tt === T.LOCK ? '#d9a24a' : tt === T.DOOR ? '#7a8a9a' : rm?.node?.type === 'boss' ? '#6a3030' : rm?.node?.type === 'shrine' ? '#2a6a7a' : '#4a5668';
      ctx.fillRect(x * sc, y * sc, sc + 0.5, sc + 0.5);
    }
    for (const o of rt.interactables) { if (o.decor || !s.isActive(o)) continue; const rm = rt.d.rooms.get(o.room); if (rm && !rt.explored.has(rm.id)) continue; const col = { shrine: '#7fe3ff', dungeon_exit: '#6dff9a', chest: '#ffd27a', key_pedestal: '#ffe27a', mechanism: '#ffe27a', artifact: '#ff9a4a', tone_pillar: '#b79cff' }[o.kind]; if (!col) continue; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(o.x / TILE * sc, o.z / TILE * sc, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x / TILE * sc, p.z / TILE * sc, 5, 0, 7); ctx.fill();
    raf = requestAnimationFrame(draw);
  };

  canvas.addEventListener('mousemove', (e) => {
    const s = game.session; if (s.mode !== 'overworld') return;
    const r = canvas.getBoundingClientRect(), px = (e.clientX - r.left) * (S / r.width), py = (e.clientY - r.top) * (S / r.height), m = zoneMap();
    let best = null, bd = 16;
    for (const p of m.z.pois) { if (p.type !== 'waypoint') continue; const [x, y] = m.toS(p.x, p.z); const d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = p; } }
    hoverWp = best;
    if (best) ui.tip.show(`<div class="tt-name">${t(`${best.name}.name`)}</div><div class="tt-flag">${s.state.waypoints.has(best.id) ? t('ui.click_travel') : t('ui.waypoint_locked')}</div>`); else ui.tip.hide();
  });
  canvas.addEventListener('click', (e) => {
    const s = game.session; if (s.mode !== 'overworld' || !hoverWp) return;
    if (!s.state.waypoints.has(hoverWp.id)) return;
    const r = s.fastTravel(hoverWp.id);
    if (r.ok) { ui.close('map'); } else game.toast(t(`toast.travel_${r.reason}`));
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); const s = game.session; if (s.mode !== 'overworld') return;
    const r = canvas.getBoundingClientRect(), px = (e.clientX - r.left) * (S / r.width), py = (e.clientY - r.top) * (S / r.height), m = zoneMap(), [wx, wz] = m.toW(px, py);
    const near = s.state.markers.findIndex((mk) => Math.hypot(mk.x - wx, mk.z - wz) < 6);
    if (near >= 0) s.state.markers.splice(near, 1); else if (s.state.markers.length < 12) s.state.markers.push({ x: wx, z: wz });
  });

  const renderSide = () => {
    clear(side);
    const s = game.session, st = s.state;
    side.append(h('h3', {}, s.mode === 'dungeon' ? t(`${s.dungeon.d.family}.name`) : t('rgn.calvarre.name')));
    if (s.mode === 'dungeon') {
      const d = s.dungeon.d;
      side.append(h('div', { class: 'dim' }, `${t(`${d.objective}.name`)} · ${t(`size.${d.size}`)} · ${t('ui.ilvl')} ${d.ilvl}`), h('div', { class: 'dim' }, `${t('ui.seed')}: ${d.code}`), d.modifiers.length ? h('div', {}, d.modifiers.map((m) => h('div', { class: 'chip' }, `${t(`${m}.name`)} — ${t(`${m}.desc`)}`))) : null);
    } else {
      side.append(h('div', { class: 'dim' }, t('rgn.calvarre.desc')));
      if (mode === 'travel') side.append(button(t('ui.rest_here'), () => { const r = s.rest(); if (!r.ok) game.toast(t('toast.rest_combat')); }, { cls: 'primary' }));
      side.append(h('h4', {}, t('ui.world_gates')));
      for (const g of s.registry.all('gate')) {
        const stt = s.gates.status(g.id);
        side.append(h('div', { class: `gate-card ${stt.open ? 'open' : ''}` }, h('b', {}, `${stt.open ? '🔓' : '🔒'} ${t(`${g.id}.name`)}`), g.designed ? h('div', { class: 'dim' }, t('gate.designed')) : null, h('ul', {}, stt.reqs.filter((r) => !r.hidden).map((r) => h('li', { class: r.met ? 'met' : 'unmet' }, `${r.met ? '✔' : '✖'} ${t(r.textKey)}${r.optional ? ` (${t('ui.optional')})` : ''}`)))));
      }
      side.append(h('h4', {}, t('ui.regions')));
      for (const r of s.registry.all('region')) side.append(h('div', { class: `region ${r.status}` }, h('b', {}, t(`${r.id}.name`)), h('div', { class: 'dim' }, `${t(`${r.id}.mechanic`)} · ${t(`rgn.status.${r.status}`)}`)));
      side.append(h('div', { class: 'legend dim' }, `◆ ${t('ui.legend_wp')} · ■ ${t('ui.legend_dungeon')} · ● ${t('ui.legend_npc')} · ★ ${t('ui.legend_objective')} · ▾ ${t('ui.legend_marker')}`), h('div', { class: 'dim' }, t('ui.map_hint')));
    }
  };

  el.append(h('div', { class: 'panel-head' }, h('h2', {}, t('ui.map')), button('✕', () => ui.close('map'), { cls: 'x' })), h('div', { class: 'map-cols' }, canvas, side));
  return { el, blocking: true, open(d) { mode = d?.mode ?? 'view'; at = d?.at ?? null; renderSide(); if (!raf) raf = requestAnimationFrame(draw); }, close() { cancelAnimationFrame(raf); raf = 0; ui.tip.hide(); } };
}

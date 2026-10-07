import { t } from '../../core/i18n.js';
import { iconSVG } from './iconGen.js';
import { itemName, RARITY_COLOR } from './itemText.js';
import { T, TILE } from '../../sim/dungeon/tilemap.js';
import './hud.css';

const SLOT_KEYS = { s1: '1', s2: '2', s3: '3', s4: '4', s5: 'Q', s6: 'RMB' };

/** HUD: orbs, skill bar with cooldown sweeps, Phrase tracker, Breath, statuses, boss bar, XP, toasts. */
export class Hud {
  constructor(root, game) {
    this.g = game;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div class="bossbar hidden"><div class="name"></div><div class="bar"><i></i></div><div class="bar shield hidden"><i></i></div></div>
      <div class="area-name"></div>
      <div class="subtitles hidden"></div>
      <div class="prompt hidden"></div>
      <div class="tracker hidden"></div>
      <div class="minimap"><canvas width="172" height="172"></canvas></div>
      <div class="statuses"></div>
      <div class="breath"><i></i></div>
      <div class="xpbar"><i></i></div>
      <div class="hud-bottom">
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div class="potion" role="button" tabindex="0" title=""><span class="pk">Z</span><span class="pn"></span></div><div class="orb life"><div class="fill"></div><div class="txt"></div></div></div>
        <div style="display:flex;flex-direction:column;align-items:center">
          <div class="phrase"><i></i><i></i><i></i></div>
          <div class="skillbar"></div>
        </div>
        <div class="orb res"><div class="fill"></div><div class="txt"></div></div>
      </div>
      <div class="fps hidden"></div>`;
    root.appendChild(this.el);
    this.q = (s) => this.el.querySelector(s);
    this.slots = {};
    this.lastLoadout = '';
    this.statusKey = '';
    this.mini = this.q('.minimap canvas').getContext('2d');
    this.q('.potion').addEventListener('click', () => game.session?.usePotion());
    this.trackT = 0; this.trackKey = '';
  }

  setSession(s) { this.s = s; this.lastLoadout = ''; this.trackKey = ''; this.statusKey = ''; }
  reset() { this.s = null; this.q('.tracker').classList.add('hidden'); this.q('.bossbar').classList.add('hidden'); }
  pulseTracker() { const el = this.q('.tracker'); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }

  toast(text, item) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = item ? `${text}: ${itemName(this.g.registry, item)}` : text;
    if (item) d.style.color = RARITY_COLOR[item.rarity];
    d.setAttribute('role', 'status');
    this.el.appendChild(d);
    while (this.el.querySelectorAll('.toast').length > 5) this.el.querySelector('.toast').remove();
    setTimeout(() => d.remove(), 3600);
  }
  areaName(text) { const a = this.q('.area-name'); a.textContent = text; a.classList.remove('show'); void a.offsetWidth; a.classList.add('show'); }
  subtitle(text, ms = 3500) { const s = this.q('.subtitles'); if (!this.g.settings.subtitles) return; s.textContent = text; s.classList.remove('hidden'); clearTimeout(this._st); this._st = setTimeout(() => s.classList.add('hidden'), ms); }
  prompt(text) { const p = this.q('.prompt'); if (!text) { p.classList.add('hidden'); return; } p.textContent = text; p.classList.remove('hidden'); }

  buildSkillbar(world, p) {
    const bar = this.q('.skillbar'); bar.innerHTML = ''; this.slots = {};
    const order = ['dodge', 's1', 's2', 's3', 's4', 's5', 's6', 'voice'];
    for (const slot of order) {
      const id = p.loadout[slot] ?? (slot === 'voice' ? 'voice' : null);
      const ab = id && id !== 'voice' ? world.registry.get(id) : null;
      const d = document.createElement('div');
      d.className = `skill ${slot === 'dodge' || slot === 'voice' ? 'small' : ''} ${ab?.tone ? `tone-${ab.tone}` : ''}`;
      d.dataset.slot = slot;
      d.innerHTML = `${ab ? iconSVG(ab.icon, 56) : iconSVG({ glyph: slot === 'voice' ? 'voice' : 'roll', elem: 'none' }, 56)}<div class="cd" style="transform:scaleY(0)"></div><div class="key">${slot === 'dodge' ? '␣' : slot === 'voice' ? 'R' : SLOT_KEYS[slot]}</div><div class="cdt"></div>${ab?.tone ? `<span class="tone ${ab.tone}"></span>` : ''}`;
      if (!ab && slot !== 'dodge' && slot !== 'voice') d.style.opacity = '0.25';
      d.title = ab ? t(`${ab.id}.name`) : '';
      d.addEventListener('click', () => this.g.castSlot(slot));
      bar.appendChild(d);
      this.slots[slot] = { el: d, cd: d.querySelector('.cd'), cdt: d.querySelector('.cdt'), id };
    }
  }

  update(world, p, dt) {
    if (!p) return;
    const sig = JSON.stringify(p.loadout) + (p.voices?.equipped?.[0] ?? '');
    if (sig !== this.lastLoadout) { this.lastLoadout = sig; this.buildSkillbar(world, p); }
    const life = this.q('.orb.life'), res = this.q('.orb.res');
    life.querySelector('.fill').style.height = `${Math.max(0, p.hp / p.hpMax) * 100}%`;
    life.querySelector('.txt').textContent = `${Math.ceil(p.hp)} / ${p.hpMax}`;
    life.classList.toggle('low', p.hp > 0 && p.hp / p.hpMax < 0.3);
    if (p.res) {
      res.className = `orb res ${p.res.id}`;
      const max = world.resources.max(p);
      res.querySelector('.fill').style.height = `${Math.min(1, p.res.value / max) * 100}%`;
      res.querySelector('.txt').textContent = `${Math.floor(p.res.value)}`;
      res.title = t(`res.${p.res.id}`);
    }
    const sh = life.querySelector('.shield') ?? life.appendChild(Object.assign(document.createElement('div'), { className: 'shield' }));
    sh.style.boxShadow = `inset 0 0 0 4px rgba(159,232,255,${Math.min(0.9, (p.shield || 0) / p.hpMax * 3)})`;
    // cooldowns
    for (const [slot, s] of Object.entries(this.slots)) {
      if (!s.id || s.id === 'voice') { if (slot === 'voice') this.#voiceSlot(s, p); continue; }
      const ab = world.abilities.resolve(p, s.id);
      if (!ab) continue;
      const ch = world.abilities.chargesOf(p, ab);
      let left = 0, total = Math.max(0.1, ab.cooldown || 1);
      if (ch) { left = ch.c.n < 1 ? Math.max(0, ch.c.at - world.time) : 0; }
      else left = world.abilities.cooldownLeft(p, s.id);
      s.cd.style.transform = `scaleY(${left > 0 ? Math.min(1, left / total) : 0})`;
      s.cdt.textContent = left > 0.05 ? (left >= 10 ? Math.ceil(left) : left.toFixed(1)) : '';
      const afford = !ab.cost || world.resources.canAfford(p, ab.cost);
      s.el.classList.toggle('nores', !afford);
    }
    // phrase
    const dots = this.el.querySelectorAll('.phrase i');
    const ph = p.cadence?.phrase ?? [];
    dots.forEach((d, i) => { d.className = ph[i] ? ph[i].tone : ''; });
    // breath & xp
    const br = this.q('.breath'); const bmax = world.listen.maxBreath(p);
    br.classList.toggle('on', p.listen.active || p.listen.breath < bmax - 0.05);
    br.querySelector('i').style.width = `${p.listen.breath / bmax * 100}%`;
    const ch = this.g.character;
    if (ch) this.q('.xpbar i').style.width = `${Math.min(100, ch.xp / Math.max(1, world.balance.xpToNext(ch.level)) * 100)}%`;
    this.#statuses(p);
    this.#potion();
    this.#tracker(dt);
    this.#minimap(world, p);
    const fps = this.q('.fps'); fps.classList.toggle('hidden', !this.g.settings.showFps); if (this.g.settings.showFps) fps.textContent = `${this.g.fps.toFixed(0)} fps · ${world.entities.length} ent · ${this.g.scene3d.renderer.info.render.calls} dc`;
  }

  #potion() {
    const ch = this.g.character; if (!ch) return;
    const el = this.q('.potion');
    el.querySelector('.pn').textContent = `${ch.potion.charges}/${ch.potion.max}`;
    el.classList.toggle('empty', ch.potion.charges <= 0);
    el.title = t('hud.potion');
  }

  #tracker(dt) {
    this.trackT -= dt; if (this.trackT > 0) return; this.trackT = 0.25;
    const el = this.q('.tracker'), s = this.g.session;
    if (!s || !this.g.settings.hudTracker) { el.classList.add('hidden'); return; }
    const tracked = s.state.flags.trackedQuest && s.state.quests[s.state.flags.trackedQuest]?.state === 'active' ? s.state.flags.trackedQuest : s.quests.active().find((id) => s.registry.get(id)?.category === 'main') ?? s.quests.active()[0];
    let html = '';
    if (s.mode === 'dungeon') {
      const rt = s.dungeon, o = rt.objective;
      html += `<div class="tq-title">${t(`${rt.d.objective}.name`)}</div><div class="tq-obj ${o.done ? 'done' : ''}">${t(`${rt.d.objective}.desc`)}</div>`;
      if (rt.d.content.waveArena && o.active) html += `<div class="tq-obj">${t('hud.wave', { n: o.wave, total: rt.d.content.waveArena.waves })}</div>`;
      if (o.collapseAt) html += `<div class="tq-obj warn">${t('hud.collapse', { s: Math.max(0, Math.ceil(o.collapseAt - rt.world.time)) })}</div>`;
      if (rt.keys.size) html += `<div class="tq-obj">🗝 ${rt.keys.size}</div>`;
    } else if (tracked) {
      const q = s.state.quests[tracked];
      html += `<div class="tq-title">${t(`${tracked}.name`)}</div><div class="tq-stage">${t(`${tracked}.${q.stage}.title`)}</div>`;
      for (const o of s.quests.objectives(tracked)) html += `<div class="tq-obj ${o.done ? 'done' : ''}">${o.done ? '✔' : '◇'} ${t(`${tracked}.${q.stage}.o${o.index}`)}${o.need > 1 ? ` (${o.have}/${o.need})` : ''}</div>`;
    }
    if (html === this.trackKey) return;
    this.trackKey = html; el.innerHTML = html; el.classList.toggle('hidden', !html);
  }

  #voiceSlot(s, p) {
    const v = p.voices; if (!v) return;
    const eq = v.equipped[0];
    s.cdt.textContent = eq ? `${v.charges}` : '';
    s.el.style.opacity = eq ? 1 : 0.35;
  }

  #statuses(p) {
    const key = p.st.map((s) => s.def.id + s.stacks).join(',');
    if (key === this.statusKey) return;
    this.statusKey = key;
    const box = this.q('.statuses'); box.innerHTML = '';
    for (const s of p.st) {
      if (s.def.tags?.includes('zone') && !s.def.icon) continue;
      const d = document.createElement('div'); d.className = 'status'; d.style.borderColor = s.def.color;
      d.title = t(`${s.def.id}.name`);
      d.innerHTML = iconSVG({ glyph: s.def.icon, elem: 'none' }, 26) + (s.stacks > 1 ? `<span class="st">${s.stacks}</span>` : '');
      box.appendChild(d);
    }
  }

  #dungeonMap(world, p) {
    const rt = this.g.session.dungeon, map = rt.d.map, ctx = this.mini, S = 172, sc = 5;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, S, S);
    const yaw = this.g.rig.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
    const px = p.x / TILE, pz = p.z / TILE, R = 22;
    const roomBy = new Map(); for (const r of rt.d.rooms.values()) roomBy.set(r.region, r);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = Math.floor(px) + dx, y = Math.floor(pz) + dy, tt = map.get(x, y);
      if (tt === T.WALL) continue;
      const rm = roomBy.get(map.region[map.idx(x, y)]);
      const known = (rm && rt.explored.has(rm.id)) || Math.hypot(dx, dy) < 7 || (!rm && Math.hypot(dx, dy) < 12);
      if (!known) continue;
      const ddx = (x + 0.5 - px), ddy = (y + 0.5 - pz);
      const mx = S / 2 + (ddx * c - ddy * sn) * sc, my = S / 2 + (ddx * sn + ddy * c) * sc;
      if ((mx - S / 2) ** 2 + (my - S / 2) ** 2 > (S / 2) ** 2) continue;
      ctx.fillStyle = tt === T.LOCK ? '#d9a24a' : tt === T.DOOR ? '#6a7a8a' : tt === T.SECRET ? '#26303d' : rm?.node?.type === 'boss' ? '#5a2a2a' : rm?.node?.type === 'shrine' ? '#2a5a6a' : '#3a4656';
      ctx.fillRect(mx - sc / 2, my - sc / 2, sc + 0.6, sc + 0.6);
    }
    const dot = (x, z, col, r = 2.5) => { const dx = x / TILE - px, dy = z / TILE - pz; const mx = S / 2 + (dx * c - dy * sn) * sc, my = S / 2 + (dx * sn + dy * c) * sc; if ((mx - S / 2) ** 2 + (my - S / 2) ** 2 > (S / 2 - 3) ** 2) return; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.fill(); };
    for (const o of rt.interactables) { if (o.decor || !this.g.session.isActive(o)) continue; const rm = rt.d.rooms.get(o.room); if (rm && !rt.explored.has(rm.id)) continue; if (['shrine', 'dungeon_exit', 'key_pedestal', 'mechanism', 'artifact', 'chest'].includes(o.kind)) dot(o.x, o.z, o.kind === 'shrine' ? '#7fe3ff' : o.kind === 'dungeon_exit' ? '#6dff9a' : '#ffd27a', 3); }
    for (const e of world.entities) if (e.team === 'enemy' && !e.dead && !e.hidden && !e.isHazard && Math.hypot(e.x - p.x, e.z - p.z) < 30) dot(e.x, e.z, '#ff4a3a', 2);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(S / 2, S / 2, 3.5, 0, 7); ctx.fill();
  }

  #minimap(world, p) {
    if (this.g.session?.mode === 'dungeon') return this.#dungeonMap(world, p);
    const ctx = this.mini; const zone = this.g.zone; if (!zone) return;
    const S = 172, scale = 1.35; // px per metre
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    // rotate with the camera so "up" on the minimap matches screen-up
    ctx.rotate(Math.PI / 4 * 0 + 0);
    const toM = (x, z) => { const dx = x - p.x, dz = z - p.z; const yaw = this.g.rig.yaw; const c = Math.cos(yaw), s = Math.sin(yaw); return [(dx * c - dz * s) * scale, (dx * s + dz * c) * scale]; };
    // explored fog is handled by the full map; minimap draws walkable cells near the player
    const R = Math.ceil(S / 2 / scale / 1) + 4;
    ctx.fillStyle = '#26303d';
    for (let dz = -R; dz <= R; dz += 2) for (let dx = -R; dx <= R; dx += 2) {
      const x = p.x + dx, z = p.z + dz;
      if (!zone.nav.isWalkable(x, z)) continue;
      const [mx, my] = toM(x, z); if (mx * mx + my * my > (S / 2) ** 2) continue;
      const h = zone.heightAt(x, z);
      ctx.fillStyle = `hsl(210, 18%, ${24 + Math.max(-4, Math.min(12, h)) * 1.4}%)`;
      ctx.fillRect(mx - scale, my - scale, scale * 2 + 0.5, scale * 2 + 0.5);
    }
    for (const e of world.entities) {
      if (e.dead || e === p) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z); if (d > 60) continue;
      const [mx, my] = toM(e.x, e.z);
      if (e.team === 'enemy') { if (e.hidden) continue; ctx.fillStyle = e.tier === 'boss' ? '#ff9a4a' : '#ff4a3a'; ctx.fillRect(mx - 2, my - 2, 4, 4); }
      else if (e.kind === 'npc') { ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(mx, my, 3, 0, 7); ctx.fill(); }
    }
    for (const poi of zone.pois) {
      if (poi.type !== 'waypoint') continue;
      const [mx, my] = toM(poi.x, poi.z); if (mx * mx + my * my > (S / 2) ** 2) continue;
      ctx.fillStyle = '#7fe3ff'; ctx.fillRect(mx - 3, my - 3, 6, 6);
    }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
  }

  boss(world, boss) {
    const el = this.q('.bossbar');
    if (!boss || boss.dead) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('.name').textContent = t(`${boss.id}.name`);
    el.querySelector('.bar i').style.width = `${boss.hp / boss.hpMax * 100}%`;
    const sh = el.querySelector('.shield');
    const bs = boss.bossShield;
    sh.classList.toggle('hidden', !bs || bs.value <= 0);
    if (bs) sh.querySelector('i').style.width = `${bs.value / bs.max * 100}%`;
  }
}

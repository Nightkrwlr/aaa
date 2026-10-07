import { t, i18n } from '../core/i18n.js';
import { compareItem } from '../sim/items/compare.js';
import './hints.css';

/**
 * Hints — the invisible tutorial. Each hint appears ONCE per install, exactly when its situation arises (first enemy in view,
 * first loot on the ground, first level-up…), says what to do in the player's own input vocabulary (finger vs keyboard/mouse),
 * and goes away on its own — or the moment the player does the thing. Nothing blocks input, nothing repeats, never two at once.
 *
 * Texts: locales `hint.<id>` (keyboard + mouse) and optional `hint.<id>.touch` (falls back to the keyboard text).
 * Rules are plain functions of the live game, polled 4×/s: cheap, and impossible to desync from the simulation.
 */
const STORE = 'sdc.hints.v1';
const load = () => { try { return new Set(JSON.parse(localStorage.getItem(STORE) ?? '[]')); } catch { return new Set(); } };
const save = (set) => { try { localStorage.setItem(STORE, JSON.stringify([...set])); } catch { /* private mode: they will simply repeat next visit */ } };

/** id, when(ctx) → show?, done(ctx) → player already did it?, ttl seconds, delay (s of play before it may show) */
const RULES = [
  { id: 'move', ttl: 9, delay: 1.5, when: (c) => c.t > 1.5 && c.moved < 3, done: (c) => c.moved >= 3 },
  { id: 'attack', ttl: 9, when: (c) => c.enemyNear < 16 && c.dealt === 0, done: (c) => c.dealt > 0 },
  { id: 'skills', ttl: 10, when: (c) => c.kills >= 2 && c.skills >= 2 && c.casts === 0 && c.enemyNear < 20, done: (c) => c.casts > 0 },
  { id: 'dodge', ttl: 9, when: (c) => c.hurtHits >= 3 && c.dodges === 0, done: (c) => c.dodges > 0 },
  { id: 'loot', ttl: 9, when: (c) => c.lootNear < 9 && c.picked === 0, done: (c) => c.picked > 0 },
  { id: 'potion', ttl: 8, when: (c) => c.hpFrac < 0.4 && c.potions > 0, done: (c) => c.potionsUsed > 0 || c.hpFrac > 0.7 },
  { id: 'levelup', ttl: 11, when: (c) => c.level >= 2 && c.points > 0 && !c.talentsOpened, done: (c) => c.talentsOpened },
  { id: 'equip', ttl: 11, when: (c) => c.upgrade && !c.bagOpened, done: (c) => c.bagOpened },
];

export class Hints {
  /** @param {import('./game.js').Game} game @param {import('../sim/session.js').GameSession} session */
  constructor(game, session) {
    this.g = game; this.s = session; this.seen = load(); this.shown = null; this.cool = 4; this.poll = 0; this.t = 0;
    this.stat = { moved: 0, dealt: 0, kills: 0, casts: 0, picked: 0, dodges: 0, hurtHits: 0, potionsUsed: 0, talentsOpened: false, bagOpened: false, upgrade: false };
    this.p0 = { x: session.player.x, z: session.player.z };
    this.el = document.createElement('div'); this.el.className = 'hint-pop hidden'; this.el.setAttribute('role', 'status'); this.el.setAttribute('aria-live', 'polite');
    document.getElementById('ui')?.append(this.el) ?? document.body.append(this.el);
    const ev = session.events, wev = session.world.events, st = this.stat, p = session.player;
    this.offs = [
      ev.on('kill', () => { st.kills++; }),
      wev.on('damage', (i) => { if (i.source === p && !i.dot) st.dealt++; if (i.target === p && !i.dot) st.hurtHits++; }),
      wev.on('cast:impact', (i) => { if (i.entity === p && i.ab?.slotType !== 'dodge' && i.ab?.slotType !== 'primary' && !i.ab?.tags?.includes('basic')) st.casts++; }),
      wev.on('dash:start', (i) => { if (i.entity === p) st.dodges++; }),
      wev.on('loot:picked', () => { st.picked++; }),
      session.events.on('potion:used', () => { st.potionsUsed++; }),
      wev.on('potion:used', () => { st.potionsUsed++; }),
    ];
  }

  /** the UI manager tells us which panels have been looked at (a hint about a panel retires once that panel was opened) */
  note(panelId) { if (panelId === 'talents') this.stat.talentsOpened = true; if (panelId === 'inventory') this.stat.bagOpened = true; }

  #ctx() {
    const s = this.s, w = s.world, p = s.player, st = this.stat, C = s.character;
    st.moved = Math.max(st.moved, Math.hypot(p.x - this.p0.x, p.z - this.p0.z));
    let enemyNear = 99, lootNear = 99;
    for (const e of w.entities) { if (e.dead || e.team !== 'enemy' || e.untargetable || e.hidden) continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < enemyNear) enemyNear = d; }
    for (const g of s.loot?.ground ?? []) { if (g.kind !== 'item') continue; const d = Math.hypot(g.x - p.x, g.z - p.z); if (d < lootNear) lootNear = d; }
    const skills = ['s1', 's2', 's3', 's4', 's5', 's6'].filter((k) => C.loadout[k]).length;
    if (!st.upgrade && C.inv.items().length) { try { st.upgrade = C.inv.items().slice(0, 12).some((it) => compareItem(C, s.factory, it).verdict === 'upgrade'); } catch { /* unequippable */ } }
    return { ...st, t: this.t, enemyNear, lootNear, skills, hpFrac: p.hp / p.hpMax, potions: C.potion.charges, level: C.level, points: C.talentPoints(), dealt: w.metrics.damageDealt > 0 ? 1 : 0 };
  }

  update(dt) {
    this.t += dt; this.cool -= dt;
    if (this.shown) {
      this.shown.age += dt;
      if (this.shown.age > this.shown.rule.ttl) this.#hide(false);
    }
    this.poll += dt; if (this.poll < 0.25) return; this.poll = 0;
    const s = this.s; if (s.dead || this.g.ui.blocking) { if (this.shown && this.g.ui.blocking) this.#hide(false); return; }
    const c = this.#ctx();
    if (this.shown) { if (this.shown.rule.done(c)) this.#hide(true); return; }
    if (this.cool > 0) return;
    for (const rule of RULES) {
      if (this.seen.has(rule.id) || !(rule.delay === undefined || this.t >= rule.delay) || rule.done(c) || !rule.when(c)) continue;
      this.#show(rule); break;
    }
  }

  #text(id) {
    const touch = document.documentElement.classList.contains('touch');
    const k = touch && i18n.has(`hint.${id}.touch`) ? `hint.${id}.touch` : `hint.${id}`;
    return t(k);
  }

  #show(rule) {
    const text = this.#text(rule.id);
    if (!text || text === `hint.${rule.id}`) { this.seen.add(rule.id); return; }       // no copy yet for this language: skip silently
    this.shown = { rule, age: 0 };
    this.el.innerHTML = `<span class="hp-ico" aria-hidden="true">✦</span><span class="hp-txt"></span>`;
    this.el.querySelector('.hp-txt').textContent = text;
    this.el.classList.remove('hidden'); requestAnimationFrame(() => this.el.classList.add('on'));
  }

  #hide(completed) {
    if (!this.shown) return;
    if (completed || this.shown.age > 2) { this.seen.add(this.shown.rule.id); save(this.seen); }      // dismissed unseen (a panel opened right away) → it may come back
    this.shown = null; this.cool = completed ? 3 : 8;
    this.el.classList.remove('on'); setTimeout(() => { if (!this.shown) this.el.classList.add('hidden'); }, 260);
  }

  dispose() { for (const off of this.offs) off?.(); this.el.remove(); }
}

import { h, button, clear, tabs } from '../dom.js';
import { bindTip } from '../dom.js';
import { t } from '../../../core/i18n.js';
import { iconSVG } from '../iconGen.js';
import { esc } from '../itemText.js';

const SLOTS = ['s1', 's2', 's3', 's4', 's5', 's6'];
const SLOT_KEY = { s1: '1', s2: '2', s3: '3', s4: '4', s5: 'Q', s6: 'RMB' };

export function abilityTip(game, ab, extra = '') {
  const s = game.session, reg = s.registry;
  const tone = ab.tone ? `<span class="tone ${ab.tone}"></span> ${t(`tone.${ab.tone}`)}` : '';
  const cost = ab.cost ? `${t('ui.cost')}: ${ab.cost}` : '';
  const cd = ab.cooldown ? `${t('ui.cooldown')}: ${ab.cooldown}s` : '';
  return `<div class="tt-name">${esc(t(`${ab.id}.name`))}</div><div class="tt-sub">${tone} ${(ab.tags ?? []).filter((x) => i18nHas(`tag.${x}`)).map((x) => t(`tag.${x}`)).join(' · ')}</div><div class="tt-uniq">${esc(t(`${ab.id}.desc`))}</div><div class="tt-sub">${[cost, cd].filter(Boolean).join(' · ')}</div>${extra}`;
}
import { i18n } from '../../../core/i18n.js';
const i18nHas = (k) => i18n.has(k);

export function skills(game, ui) {
  const el = h('div', { class: 'skills-root' });
  let tab = 'skills', slot = 's1';
  const render = () => {
    clear(el);
    const s = game.session, c = s.character, reg = s.registry;
    const head = h('div', { class: 'panel-head' }, h('h2', {}, t('ui.skills')), button('✕', () => ui.close('skills'), { cls: 'x' }));
    const tb = tabs([{ id: 'skills', label: t('ui.tab_skills') }, { id: 'voices', label: t('ui.tab_voices') }], (id) => { tab = id; render(); }, tab);
    const body = h('div', { class: 'skills-body' });
    if (tab === 'skills') {
      const bar = h('div', { class: 'loadout' });
      bar.append(slotBtn('primary', c.loadout.primary, true), slotBtn('dodge', c.loadout.dodge, true));
      for (const sl of SLOTS) bar.append(slotBtn(sl, c.loadout[sl], false));
      function slotBtn(sl, id, fixed) {
        const ab = id ? reg.get(id) : null;
        const b = h('button', { class: `skill-slot ${sl === slot ? 'on' : ''} ${fixed ? 'fixed' : ''}`, type: 'button', onClick: () => { if (!fixed) { slot = sl; render(); } } }, ab ? h('span', { html: iconSVG(ab.icon, 54) }) : h('span', { class: 'dim' }, '—'), h('span', { class: 'sk-key' }, SLOT_KEY[sl] ?? (sl === 'dodge' ? '␣' : 'LMB')));
        if (ab) bindTip(ui, b, () => abilityTip(game, ab));
        return b;
      }
      const avail = c.cls.unlocks;
      const list = h('div', { class: 'ability-list' });
      for (const u of avail) {
        const ab = reg.get(u.ability), ok = u.level <= c.level;
        const row = h('div', { class: `ability ${ok ? '' : 'locked'}` }, h('span', { html: iconSVG(ab.icon, 44) }), h('div', { class: 'ab-main' }, h('b', {}, t(`${ab.id}.name`)), h('div', { class: 'dim' }, ok ? t(`${ab.id}.desc`) : t('ui.unlocks_at', { level: u.level }))),
          ok ? button(t('ui.assign'), () => { c.setLoadout(slot, ab.id); c.recompute(s.world, s.player); render(); }, { cls: 'small' }) : null);
        bindTip(ui, row, () => abilityTip(game, ab));
        list.append(row);
      }
      body.append(h('div', { class: 'dim' }, t('ui.skills_hint', { slot: SLOT_KEY[slot] })), bar, list);
    } else {
      const v = c.voices;
      body.append(h('div', { class: 'dim' }, t('ui.voices_hint')), h('div', { class: 'voice-charges' }, `${t('hud.voice')}: ${s.player.voices.charges}/${s.player.voices.max}`));
      const list = h('div', { class: 'ability-list' });
      if (!v.library.length) list.append(h('div', { class: 'empty-msg' }, t('ui.no_voices')));
      for (const id of v.library) {
        const def = reg.get(id), ab = reg.get(def.ability), eq = v.equipped.includes(id);
        const row = h('div', { class: `ability ${eq ? 'eq' : ''}` }, h('span', { html: iconSVG(def.icon ?? ab.icon, 44) }), h('div', { class: 'ab-main' }, h('b', {}, t(`${ab.id}.name`)), h('div', { class: 'dim' }, t(`${ab.id}.desc`)), h('div', { class: 'dim' }, `${t('ui.source')}: ${t(`${def.source}.name`)}`)),
          button(eq ? t('ui.equipped') : t('ui.equip'), () => { c.equipVoice(id, 0); c.recompute(s.world, s.player); render(); }, { cls: 'small', disabled: eq }));
        bindTip(ui, row, () => abilityTip(game, ab));
        list.append(row);
      }
      body.append(list);
    }
    el.append(head, tb.bar, body);
  };
  return { el, blocking: true, open() { render(); }, close() {}, refresh: render };
}

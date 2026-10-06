import { h, button, clear, select } from '../dom.js';
import { t } from '../../../core/i18n.js';

export function rift(game, ui) {
  const el = h('div', { class: 'rift-root' });
  let fam = 'dfm.serrane_crypt', size = 'medium', obj = 'random', mods = new Set(), seed = '';
  const render = () => {
    clear(el);
    const s = game.session, reg = s.registry;
    const fams = reg.all('dungeonFamily'), objs = reg.all('dungeonObjective');
    const f = reg.get(fam);
    const cards = h('div', { class: 'class-cards' }, fams.map((d) => h('button', { class: `class-card ${d.id === fam ? 'on' : ''}`, type: 'button', onClick: () => { fam = d.id; mods.clear(); render(); } }, h('div', { class: 'cc-name' }, t(`${d.id}.name`)), h('div', { class: 'cc-desc' }, t(`${d.id}.desc`)))));
    const modRow = h('div', { class: 'mods' }, f.modifiers.map((m) => { const on = mods.has(m); const d = reg.get(m); return h('button', { class: `chip ${on ? 'on' : ''}`, type: 'button', title: t(`${m}.desc`), onClick: () => { if (on) mods.delete(m); else if (mods.size < 2) mods.add(m); render(); } }, `${on ? '✔ ' : ''}${t(`${m}.name`)}${d.reward ? ` (+${Math.round(d.reward * 100)}%)` : ''}`); }));
    const bonus = [...mods].reduce((a, m) => a + (reg.get(m).reward ?? 0), 0);
    const seedIn = h('input', { type: 'text', value: seed, placeholder: t('ui.seed_hint'), 'aria-label': t('ui.seed') });
    seedIn.addEventListener('input', () => { seed = seedIn.value; });
    el.append(h('div', { class: 'panel-head' }, h('h2', {}, t('ia.chart')), button('✕', () => ui.close('rift'), { cls: 'x' })),
      h('p', { class: 'dim' }, t('ui.rift_desc')), cards,
      h('div', { class: 'ng-fields' }, select(t('ui.size'), size, [['small', t('size.small')], ['medium', t('size.medium')], ['large', t('size.large')]], (v) => { size = v; render(); }), select(t('ui.objective'), obj, [['random', t('ui.random')], ...objs.map((o) => [o.id, t(`${o.id}.name`)])], (v) => { obj = v; render(); }), h('label', {}, t('ui.seed'), seedIn)),
      h('div', {}, h('b', {}, t('ui.modifiers')), ` (${mods.size}/2)`), modRow,
      h('div', { class: 'dim' }, `${t('ui.reward_bonus')}: +${Math.round(bonus * 100)} % · ${t('ui.recommended')}: ${t('ui.ilvl')} ${s.character.level}`),
      h('div', { class: 'row' }, button(t('ui.enter_rift'), () => {
        const sd = seed.trim() || `rift-${s.state.dungeons.done + 1}-${Date.now().toString(36).slice(-4)}`;
        ui.close('rift');
        const r = s.openRift({ family: fam, size, seed: sd, objective: obj === 'random' ? undefined : obj, modifiers: [...mods] });
        if (!r.ok) game.toast(t(r.toast ?? 'toast.dungeon_failed'));
      }, { cls: 'primary' })));
  };
  return { el, blocking: true, open() { seed = ''; render(); }, close() {} };
}

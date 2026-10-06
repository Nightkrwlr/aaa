import { h, button, clear } from '../dom.js';
import { t } from '../../../core/i18n.js';
import { itemTile } from './tiles.js';

export function stash(game, ui) {
  const el = h('div', { class: 'stash-root' });
  const render = () => {
    clear(el);
    const s = game.session;
    const head = h('div', { class: 'panel-head' }, h('h2', {}, t('ia.stash')), h('span', { class: 'dim' }, `${s.stash.used}/${s.stash.capacity}`), button('✕', () => ui.close('stash'), { cls: 'x' }));
    const grid = h('div', { class: 'grid wide' });
    s.stash.slots.forEach((it) => { const cell = h('div', { class: 'cell' }); if (it) cell.append(itemTile(game, ui, it, { onClick: (x) => { const r = s.stashTake(x.iid); if (!r.ok) game.toast(t('toast.inventory_full')); render(); ui.inst.get('inventory')?.refresh?.(); } })); grid.append(cell); });
    el.append(head, h('div', { class: 'dim' }, t('ui.stash_hint')), grid);
  };
  return { el, blocking: true, open() { render(); ui.open('inventory'); }, close() { ui.close('inventory'); }, refresh: render };
}

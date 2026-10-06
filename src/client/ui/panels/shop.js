import { h, button, clear, tabs } from '../dom.js';
import { t } from '../../../core/i18n.js';
import { iconSVG } from '../iconGen.js';
import { itemTile } from './tiles.js';
import { itemName } from '../itemText.js';

export function shop(game, ui) {
  const el = h('div', { class: 'shop-root' });
  let npc = null, shopId = null, tab = 'buy';
  const render = () => {
    clear(el);
    const s = game.session, c = s.character, sh = s.shop;
    const head = h('div', { class: 'panel-head' }, h('h2', {}, `${t(`${npc}.name`)} — ${t(`${shopId}.name`)}`), h('div', { class: 'chimes' }, `🔔 ${c.inv.chimes}`), button('✕', () => ui.close('shop'), { cls: 'x' }));
    const tb = tabs([{ id: 'buy', label: t('ui.buy') }, { id: 'sell', label: t('ui.sell') }, { id: 'back', label: t('ui.buyback') }], (id) => { tab = id; render(); }, tab);
    const body = h('div', { class: 'shop-body' });
    const note = (r) => game.toast(r.ok ? t('toast.bought') : t(r.reason === 'chimes' ? 'toast.not_enough_chimes' : r.reason === 'full' ? 'toast.inventory_full' : 'toast.cant_buy'));
    if (tab === 'buy') {
      const stock = sh.stock(shopId);
      const grid = h('div', { class: 'shop-grid' });
      for (const e of stock) {
        const row = h('div', { class: `shop-row ${e.soldOut ? 'sold' : ''}` });
        if (e.type === 'item') row.append(itemTile(game, ui, e.item, { price: e.price, size: 52 }), h('div', { class: 'sr-name' }, itemName(s.registry, e.item)));
        else {
          const id = e.id; const name = e.type === 'potion' ? t('hud.potion') : t(`${id}.name`);
          const ico = e.type === 'material' ? { glyph: 'material', elem: 'sonic' } : e.type === 'potion' ? { glyph: 'potion', elem: 'heal' } : (s.registry.get(id)?.icon ?? { glyph: 'potion', elem: 'heal' });
          row.append(h('div', { class: 'tile', html: iconSVG(ico, 48) }), h('div', { class: 'sr-name' }, `${name}${e.amount > 1 ? ` ×${e.amount}` : ''}`, e.type !== 'potion' && s.registry.get(id)?.desc !== undefined ? '' : ''));
        }
        row.append(h('div', { class: 'sr-price' }, `🔔 ${e.price}`), button(e.soldOut ? t('ui.sold') : t('ui.buy'), () => { note(sh.buy(shopId, e.sid)); render(); }, { disabled: e.soldOut || c.inv.chimes < e.price }));
        grid.append(row);
      }
      body.append(grid);
    } else if (tab === 'sell') {
      const grid = h('div', { class: 'grid' });
      c.inv.slots.forEach((it) => { const cell = h('div', { class: 'cell' }); if (it) cell.append(itemTile(game, ui, it, { price: s.factory.sellValue(it), onClick: (x) => { if (x.fav || x.locked) { game.toast(t('toast.item_protected')); return; } sh.sell(x.iid); game.audio.ui('coin'); render(); } })); grid.append(cell); });
      body.append(h('div', { class: 'dim' }, t('ui.sell_hint')), grid);
    } else {
      const list = h('div', { class: 'shop-grid' });
      if (!sh.buyback.length) list.append(h('div', { class: 'empty-msg' }, t('ui.empty')));
      for (const b of sh.buyback) list.append(h('div', { class: 'shop-row' }, itemTile(game, ui, b.item, { price: b.price }), h('div', { class: 'sr-name' }, itemName(s.registry, b.item)), h('div', { class: 'sr-price' }, `🔔 ${b.price}`), button(t('ui.rebuy'), () => { const r = sh.rebuy(b.uid); note(r); render(); }, { disabled: c.inv.chimes < b.price })));
      body.append(list);
    }
    el.append(head, tb.bar, body);
  };
  return { el, blocking: true, open(d) { npc = d.npc; shopId = game.session.shop.forNpc(npc)?.id; if (!shopId) { ui.close('shop'); return; } tab = 'buy'; render(); ui.open('inventory'); }, close() { ui.close('inventory'); }, refresh: render };
}

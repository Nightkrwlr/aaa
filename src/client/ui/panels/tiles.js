import { h } from '../dom.js';
import { bindTip } from '../dom.js';
import { iconSVG } from '../iconGen.js';
import { itemName, itemTooltipHTML, RARITY_COLOR } from '../itemText.js';
import { compareItem } from '../../../sim/items/compare.js';

/** one item square: rarity border, icon, fav/lock marks, ilvl, tooltip with build-aware comparison */
export function itemTile(game, ui, item, { onClick, onDblClick, onContext, selected = false, size = 52, price = null, noCompare = false, drag = null, equipped = false } = {}) {
  const s = game.session, base = s.registry.get(item.base);
  const col = RARITY_COLOR[item.rarity];
  const el = h('div', { class: `tile item r-${item.rarity} ${selected ? 'sel' : ''} ${item.unique ? 'uniq' : ''} ${item.stability <= 0 ? 'cracked' : ''}`, tabindex: 0, role: 'button', 'aria-label': itemName(s.registry, item), style: { width: `${size}px`, height: `${size}px`, '--rar': col } });
  el.innerHTML = iconSVG(base.icon, size - 4, { rarity: col });
  const marks = h('div', { class: 'marks' }, item.fav ? '★' : '', item.locked ? '🔒' : '');
  el.append(marks, h('div', { class: 'ilvl' }, String(item.ilvl)));
  if (item.up) el.append(h('div', { class: 'up' }, `+${item.up}`));
  if (item.sockets?.length) el.append(h('div', { class: 'sockdots' }, item.sockets.map((g) => (g ? '●' : '○')).join('')));
  bindTip(ui, el, () => {
    let cmp = null;
    if (!noCompare && !equipped) { try { cmp = compareItem(s.character, s.factory, item); } catch { cmp = null; } }
    return itemTooltipHTML(game, item, { cmp, price });
  });
  if (onClick) el.addEventListener('click', (e) => onClick(item, e));
  if (onDblClick) el.addEventListener('dblclick', (e) => onDblClick(item, e));
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); onContext?.(item, e); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onDblClick ?? onClick)?.(item, e); } });
  if (drag) { el.draggable = true; el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', JSON.stringify(drag)); e.dataTransfer.effectAllowed = 'move'; }); }
  return el;
}

export function emptyTile(label, size = 52, extra = {}) {
  return h('div', { class: 'tile empty', style: { width: `${size}px`, height: `${size}px` }, 'aria-label': label, title: label, ...extra }, h('span', { class: 'slot-label' }, label));
}

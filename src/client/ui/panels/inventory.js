import { h, button, clear, tabs } from '../dom.js';
import { bindTip } from '../dom.js';
import { t } from '../../../core/i18n.js';
import { iconSVG } from '../iconGen.js';
import { itemName, itemTooltipHTML, modLine, esc, RARITY_COLOR } from '../itemText.js';
import { itemTile, emptyTile } from './tiles.js';
import { summarize, compareItem } from '../../../sim/items/compare.js';
import { EQUIP_SLOTS } from '../../../sim/character.js';
import { RARITY_ORDER } from '../../../sim/items/generator.js';

const SLOT_LAYOUT = [['head'], ['neck', 'chest', 'ring1'], ['weapon', 'hands', 'offhand'], ['ring2', 'feet', 'relic']];

export function inventory(game, ui) {
  const el = h('div', { class: 'inv-root' });
  let tab = 'items', sel = null, filter = { text: '', rarity: 'all', slot: 'all', upgrades: false };

  const s = () => game.session, ch = () => game.session.character;

  const render = () => {
    clear(el);
    const S = s(), C = ch(), inv = C.inv;
    // ── header
    const head = h('div', { class: 'panel-head' }, h('h2', {}, t('ui.inventory')), h('div', { class: 'chimes' }, `🔔 ${inv.chimes} ${t('ui.chimes')}`), button('✕', () => ui.close('inventory'), { cls: 'x', title: t('ui.close') }));
    // ── equipment
    const eq = h('div', { class: 'equip' });
    for (const row of SLOT_LAYOUT) {
      const r = h('div', { class: 'eq-row' });
      for (const slot of row) {
        const it = C.equipment[slot];
        r.append(it ? itemTile(game, ui, it, { selected: sel?.iid === it.iid, equipped: true, size: 58, onClick: (i) => { sel = i; render(); }, onDblClick: (i) => { const res = S.unequip(slot); if (!res.ok) game.toast(t(`toast.${res.reason === 'full' ? 'inventory_full' : 'cant_unequip'}`)); render(); } }) : emptyTile(t(`slot.${slot.replace(/\d/, '')}`), 58));
      }
      eq.append(r);
    }
    // ── stats
    const st = summarize(C, C.equipment);
    const P = S.player.stats;
    const statRow = (label, val, stat) => { const row = h('div', { class: 'stat-row' }, h('span', {}, label), h('b', {}, val)); if (stat) bindTip(ui, row, () => `<b>${esc(label)}</b>${P.explain(stat).rows.filter((r) => r.applies).map((r) => `<div class="tt-line">${esc(r.src)} · ${r.op} ${typeof r.value === 'number' ? Math.round(r.value * 1000) / 1000 : r.value}</div>`).join('')}`); return row; };
    const stats = h('div', { class: 'stats' },
      statRow(t('ui.dps'), `${st.dps}`), statRow(t('ui.burst'), `${st.burst}`), statRow(t('stat.life'), `${st.life}`, 'life'), statRow(t('ui.ehp'), `${st.ehp}`),
      statRow(t('stat.armor'), `${st.armor} (${Math.round(st.armorReduction * 100)} %)`, 'armor'), statRow(t('stat.critChance'), `${(st.crit * 100).toFixed(1)} %`, 'critChance'), statRow(t('stat.moveSpeed'), `${st.moveSpeed}`, 'moveSpeed'),
      h('div', { class: 'res-row' }, ['fire', 'frost', 'shock', 'toxic', 'sonic', 'hollow'].map((k) => h('span', { class: `rchip ${k}`, title: t(`stat.res.${k}`) }, `${Math.round((st.res[k] ?? 0) * 100)}%`))));
    const left = h('div', { class: 'inv-left' }, eq, stats);

    // ── center
    const tb = tabs([{ id: 'items', label: t('ui.tab_items') }, { id: 'materials', label: t('ui.tab_materials') }, { id: 'consumables', label: t('ui.tab_consumables') }, { id: 'key', label: t('ui.tab_key') }], (id) => { tab = id; sel = null; render(); }, tab);
    const center = h('div', { class: 'inv-center' }, tb.bar);
    if (tab === 'items') {
      const rarSel = h('select', { 'aria-label': t('ui.rarity') }, ['all', 'common', 'fine', 'attuned', 'relic'].map((r) => h('option', { value: r, selected: r === filter.rarity }, r === 'all' ? t('ui.all') : t(`rarity.${r}`))));
      rarSel.addEventListener('change', () => { filter.rarity = rarSel.value; renderGrid(); });
      const slotSel = h('select', { 'aria-label': t('ui.slot') }, ['all', 'weapon', 'offhand', 'head', 'chest', 'hands', 'feet', 'neck', 'ring', 'relic'].map((r) => h('option', { value: r, selected: r === filter.slot }, r === 'all' ? t('ui.all') : t(`slot.${r}`))));
      slotSel.addEventListener('change', () => { filter.slot = slotSel.value; renderGrid(); });
      const search = h('input', { type: 'search', placeholder: t('ui.search'), value: filter.text, 'aria-label': t('ui.search') });
      search.addEventListener('input', () => { filter.text = search.value.toLowerCase(); renderGrid(); });
      const up = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: filter.upgrades }), t('ui.only_upgrades'));
      up.querySelector('input').addEventListener('change', (e) => { filter.upgrades = e.target.checked; renderGrid(); });
      const sorts = h('div', { class: 'sorts' }, ['rarity', 'ilvl', 'slot', 'value', 'power'].map((m) => button(t(`ui.sort_${m}`), () => { inv.sort(m, S.factory, S.registry); render(); }, { cls: 'small' })));
      center.append(h('div', { class: 'toolbar' }, search, rarSel, slotSel, up), sorts);
    }
    const grid = h('div', { class: `grid ${tab}` });
    center.append(grid);
    const renderGrid = () => {
      clear(grid);
      if (tab === 'items') {
        const cmpCache = new Map();
        inv.slots.forEach((it, i) => {
          const cell = h('div', { class: 'cell', dataset: { i } });
          cell.addEventListener('dragover', (e) => e.preventDefault());
          cell.addEventListener('drop', (e) => { e.preventDefault(); try { const d = JSON.parse(e.dataTransfer.getData('text/plain')); if (d.from === 'inv') { inv.swap(d.i, i); render(); } else if (d.from === 'eq') { S.unequip(d.slot); render(); } } catch { /* ignore */ } });
          if (it) {
            const name = itemName(S.registry, it).toLowerCase();
            let dim = false;
            if (filter.text && !name.includes(filter.text) && !S.factory.derive(it).lines.some((l) => modLine(game.statDefs, l.mod, l.value).toLowerCase().includes(filter.text))) dim = true;
            if (filter.rarity !== 'all' && it.rarity !== filter.rarity) dim = true;
            if (filter.slot !== 'all' && S.registry.get(it.base).slot !== filter.slot) dim = true;
            if (filter.upgrades) { let c = cmpCache.get(it.iid); if (!c) { try { c = compareItem(C, S.factory, it).verdict; } catch { c = 'sidegrade'; } cmpCache.set(it.iid, c); } if (!['upgrade', 'defensive', 'trade_offense', 'trade_defense'].includes(c)) dim = true; }
            const tile = itemTile(game, ui, it, { selected: sel?.iid === it.iid, drag: { from: 'inv', i }, onClick: (x) => { sel = x; render(); }, onDblClick: (x) => { const r = S.equip(x.iid); if (!r.ok) game.toast(r.reason === 'level' ? t('toast.need_level', { n: r.need }) : t('toast.cant_equip')); render(); }, onContext: (x) => { const r = S.equip(x.iid); if (r.ok) render(); } });
            if (dim) tile.classList.add('dim');
            cell.append(tile);
          }
          grid.append(cell);
        });
      } else if (tab === 'materials') {
        for (const [id, n] of Object.entries(inv.materials)) { const d = S.registry.get(id); const tile = h('div', { class: 'tile mat', tabindex: 0 }, h('span', { html: iconSVG({ glyph: 'material', elem: 'sonic' }, 40) }), h('div', { class: 'qty' }, String(n))); bindTip(ui, tile, () => `<div class="tt-name">${esc(t(`${id}.name`))}</div><div class="tt-lore">${esc(t(`${id}.desc`))}</div>`); grid.append(h('div', { class: 'cell' }, tile)); }
        if (!Object.keys(inv.materials).length) grid.append(h('div', { class: 'empty-msg' }, t('ui.empty')));
      } else if (tab === 'consumables') {
        for (const [id, n] of Object.entries(inv.consumables)) { const d = S.registry.get(id); const tile = h('div', { class: 'tile con', tabindex: 0, onClick: () => { const r = S.useConsumable(id); if (!r.ok) game.toast(t(`toast.use_${r.reason}`)); render(); } }, h('span', { html: iconSVG(d.icon ?? { glyph: 'potion', elem: 'heal' }, 40) }), h('div', { class: 'qty' }, String(n))); bindTip(ui, tile, () => `<div class="tt-name">${esc(t(`${id}.name`))}</div><div class="tt-lore">${esc(t(`${id}.desc`))}</div><div class="tt-flag">${t('ui.click_use')}</div>`); grid.append(h('div', { class: 'cell' }, tile)); }
        if (!Object.keys(inv.consumables).length) grid.append(h('div', { class: 'empty-msg' }, t('ui.empty')));
      } else {
        for (const id of inv.keyItems) { const tile = h('div', { class: 'tile key', tabindex: 0 }, h('span', { html: iconSVG({ glyph: 'scroll', elem: 'brass' }, 40) })); bindTip(ui, tile, () => `<div class="tt-name">${esc(t(`${id}.name`))}</div><div class="tt-lore">${esc(t(`${id}.desc`))}</div>`); grid.append(h('div', { class: 'cell' }, h('div', { class: 'keyrow' }, tile, h('span', {}, t(`${id}.name`))))); }
        if (!inv.keyItems.size) grid.append(h('div', { class: 'empty-msg' }, t('ui.empty')));
      }
    };
    renderGrid();
    center.append(h('div', { class: 'inv-foot' }, `${inv.used}/${inv.capacity}`, ' · ', button(t('ui.salvage_commons'), () => ui.open('confirm', { text: t('ui.confirm_salvage_commons'), onYes: () => { let n = 0; for (const it of inv.items()) if (it.rarity === 'common' && !it.fav && !it.locked) { const r = S.crafting.salvage(C, it.iid, S.rng.fork(`bulk${it.iid}`)); if (r.ok) n++; } game.toast(t('toast.salvaged', { n })); render(); } }), { cls: 'small' })));

    // ── right: selected details
    const right = h('div', { class: 'inv-right' });
    if (sel && tab === 'items') {
      const it = inv.find(sel.iid) ?? Object.values(C.equipment).find((x) => x?.iid === sel.iid);
      if (!it) { sel = null; }
      else {
        const eqd = Object.values(C.equipment).some((x) => x?.iid === it.iid);
        let cmp = null; if (!eqd) { try { cmp = compareItem(C, S.factory, it); } catch { /* ignore */ } }
        right.append(h('div', { class: 'tt-card', html: itemTooltipHTML(game, it, { cmp, price: S.factory.sellValue(it) }) }));
        const acts = h('div', { class: 'actions' });
        if (!eqd) acts.append(button(t('ui.equip'), () => { const r = S.equip(it.iid); if (!r.ok) game.toast(r.reason === 'level' ? t('toast.need_level', { n: r.need }) : t('toast.cant_equip')); sel = null; render(); }, { cls: 'primary' }));
        else acts.append(button(t('ui.unequip'), () => { const slot = Object.entries(C.equipment).find(([, x]) => x?.iid === it.iid)[0]; S.unequip(slot); sel = null; render(); }));
        acts.append(button(it.fav ? `★ ${t('ui.unfavorite')}` : `☆ ${t('ui.favorite')}`, () => { it.fav = !it.fav; render(); }), button(it.locked ? `🔓 ${t('ui.unlock')}` : `🔒 ${t('ui.lock')}`, () => { it.locked = !it.locked; render(); }));
        if (!eqd) {
          acts.append(button(t('ui.salvage'), () => { const r = S.crafting.salvage(C, it.iid, S.rng.fork(`sv${it.iid}`)); if (!r.ok) game.toast(t('toast.item_protected')); else game.toast(t('toast.salvage_result', { chimes: r.chimes })); sel = null; render(); }, { disabled: it.fav || it.locked }));
          if (ui.isOpen('shop')) acts.append(button(t('ui.sell'), () => { S.shop.sell(it.iid); sel = null; render(); ui.inst.get('shop')?.refresh?.(); }, { disabled: it.fav || it.locked }));
          if (ui.isOpen('stash')) acts.append(button(t('ui.to_stash'), () => { const r = S.stashPut(it.iid); if (!r.ok) game.toast(t('toast.stash_full')); sel = null; render(); ui.inst.get('stash')?.refresh?.(); }));
          if (it.rarity !== 'common') acts.append(button(t('ui.open_craft'), () => ui.open('craft', { item: it.iid })));
        }
        right.append(acts);
      }
    } else right.append(h('div', { class: 'hint-card' }, document.documentElement.classList.contains('touch') ? t('ui.inv_hint_touch') : t('ui.inv_hint')));
    // potion belt
    right.append(h('div', { class: 'belt' }, h('b', {}, t('hud.potion')), ` ${C.potion.charges}/${C.potion.max}`, ' ', button(t('ui.use'), () => { S.usePotion(); render(); }, { cls: 'small' })));
    el.append(head, h('div', { class: 'inv-cols' }, left, center, right));
  };

  return { el, blocking: true, open() { sel = null; render(); }, close() {}, refresh: render };
}

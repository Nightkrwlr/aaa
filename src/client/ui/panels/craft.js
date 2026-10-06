import { h, button, clear, tabs } from '../dom.js';
import { bindTip } from '../dom.js';
import { t } from '../../../core/i18n.js';
import { itemName, itemTooltipHTML, modLine, esc, RARITY_COLOR } from '../itemText.js';
import { itemTile } from './tiles.js';
import { iconSVG } from '../iconGen.js';

const costLine = (game, cost) => {
  const inv = game.session.character.inv;
  const parts = [];
  if (cost.chimes) parts.push(`<span class="${inv.chimes >= cost.chimes ? '' : 'bad'}">🔔 ${Math.round(cost.chimes)}</span>`);
  for (const [id, n] of Object.entries(cost.materials ?? {})) parts.push(`<span class="${(inv.materials[id] ?? 0) >= n ? '' : 'bad'}">${esc(t(`${id}.name`))} ${inv.materialCount(id)}/${n}</span>`);
  return parts.join(' · ');
};

export function craft(game, ui) {
  const el = h('div', { class: 'craft-root' });
  let tab = 'rework', selId = null, station = null, log = '', recCat = 'forge';
  const S = () => game.session, C = () => game.session.character;

  const allItems = () => [...Object.values(C().equipment).filter(Boolean), ...C().inv.items()];
  const selItem = () => allItems().find((i) => i.iid === selId) ?? null;
  const result = (msg) => { log = msg; render(); };

  const render = () => {
    clear(el);
    const s = S(), c = C();
    const head = h('div', { class: 'panel-head' }, h('h2', {}, t(station ? `ia.station_${station}` : 'ui.crafting')), h('div', { class: 'chimes' }, `🔔 ${c.inv.chimes}`), button('✕', () => ui.close('craft'), { cls: 'x' }));
    const tb = tabs([{ id: 'rework', label: t('ui.craft_rework') }, { id: 'upgrade', label: t('ui.craft_upgrade') }, { id: 'sockets', label: t('ui.craft_sockets') }, { id: 'recipes', label: t('ui.craft_recipes') }, { id: 'prof', label: t('ui.craft_prof') }], (id) => { tab = id; render(); }, tab);
    const body = h('div', { class: 'craft-body' });
    if (tab === 'recipes') body.append(recipesView());
    else if (tab === 'prof') body.append(profView());
    else {
      const list = h('div', { class: 'craft-list' }, h('h3', {}, t('ui.pick_item')));
      const grid = h('div', { class: 'grid mini' });
      for (const it of allItems()) grid.append(itemTile(game, ui, it, { size: 46, selected: selId === it.iid, noCompare: true, onClick: (x) => { selId = x.iid; log = ''; render(); } }));
      list.append(grid);
      const it = selItem();
      const det = h('div', { class: 'craft-detail' });
      if (!it) det.append(h('div', { class: 'hint-card' }, t('ui.craft_hint')));
      else {
        det.append(h('div', { class: 'tt-card', html: itemTooltipHTML(game, it, {}) }));
        det.append(opsFor(it));
      }
      if (log) det.append(h('div', { class: 'craft-log' }, log));
      body.append(list, det);
    }
    el.append(head, tb.bar, body);
  };

  const opsFor = (it) => {
    const s = S(), c = C(), cr = s.crafting, ops = h('div', { class: 'ops' });
    const rng = (k) => s.rng.fork(`${k}${it.iid}${s.time | 0}${it.reworks ?? 0}${it.up ?? 0}`);
    const reasonText = (r) => t(`ui.craft_err_${r.reason}`);
    if (tab === 'rework') {
      const rc = cr.reworkCost(it, 'reforge'), rr = cr.reworkCost(it, 'reroll');
      ops.append(h('div', { class: 'op' }, h('b', {}, t('ui.reforge')), h('div', { class: 'dim' }, t('ui.reforge_desc')), h('div', { class: 'cost', html: costLine(game, rc) }),
        button(t('ui.reforge'), () => { const r = cr.reforge(c, it.iid, rng('rf')); result(r.ok ? t('ui.craft_ok_reforge', { s: r.stability }) : reasonText(r)); }, { disabled: !it.affixes.length || it.stability <= 0 })));
      if (!it.unique) {
        const row = h('div', { class: 'op' }, h('b', {}, t('ui.retune')), h('div', { class: 'dim' }, t('ui.retune_desc', { p: Math.round((0.12 + 0.06 * (it.reworks ?? 0)) * 100) })), h('div', { class: 'cost', html: costLine(game, rr) }));
        it.affixes.forEach((a, i) => row.append(button(`${t(`${a.id}.name`)}`, () => { const r = cr.rerollAffix(c, it.iid, i, rng(`rt${i}`)); result(r.ok ? (r.cracked ? t('ui.craft_cracked') : t('ui.craft_ok_retune', { n: t(`${r.affix}.name`) })) : reasonText(r)); }, { cls: 'small', disabled: it.stability <= 0 })));
        ops.append(row);
      }
      ops.append(h('div', { class: 'dim' }, t('ui.stability_note')));
    } else if (tab === 'upgrade') {
      const uc = cr.upgradeCost(it);
      ops.append(h('div', { class: 'op' }, h('b', {}, `${t('ui.upgrade')} +${it.up ?? 0} → +${(it.up ?? 0) + 1}`), h('div', { class: 'dim' }, t('ui.upgrade_desc')), h('div', { class: 'cost', html: costLine(game, uc) }),
        button(t('ui.upgrade'), () => { const r = cr.upgrade(c, it.iid, rng('up')); result(r.ok ? (r.success ? t('ui.craft_ok_upgrade', { n: r.up }) : t('ui.craft_fail_upgrade')) : reasonText(r)); }, { disabled: (it.up ?? 0) >= 5 })));
    } else if (tab === 'sockets') {
      const gems = Object.entries(c.inv.consumables).filter(([id]) => id.startsWith('gem.'));
      if (!(it.sockets?.length)) ops.append(h('div', { class: 'dim' }, t('ui.no_sockets')));
      it.sockets?.forEach((g, i) => {
        const row = h('div', { class: 'op' }, h('b', {}, `${t('ui.socket')} ${i + 1}: ${g ? t(`${g}.name`) : t('ui.empty')}`));
        if (g) row.append(button(t('ui.extract'), () => { const r = cr.extractGem(c, it.iid, i, rng(`ex${i}`)); result(r.ok ? (r.survived ? t('ui.craft_ok_extract') : t('ui.craft_gem_lost')) : reasonText(r)); }, { cls: 'small' }));
        const sel = h('div', { class: 'gem-row' });
        for (const [gid, n] of gems) { const b = button(`${t(`${gid}.name`)} ×${n}`, () => { const r = cr.socket(c, it.iid, i, gid); result(r.ok ? t('ui.craft_ok_socket') : reasonText(r)); }, { cls: 'small' }); sel.append(b); }
        row.append(sel); ops.append(row);
      });
    }
    return ops;
  };

  const recipesView = () => {
    const s = S(), c = C(), cr = s.crafting;
    const cats = ['alchemy', 'forge', 'runes'];
    const wrap = h('div', { class: 'recipes' });
    const ctb = tabs(cats.map((k) => ({ id: k, label: `${t(`prof.${k}.name`)} (${c.prof[k].level})` })), (id) => { recCat = id; render(); }, recCat);
    wrap.append(ctb.bar);
    const needStation = { alchemy: 'alchemy', forge: 'forge', runes: 'forge' }[recCat];
    const atStation = station === needStation;
    if (!atStation) wrap.append(h('div', { class: 'warn' }, t('ui.need_station', { station: t(`ia.station_${needStation}`) })));
    const list = h('div', { class: 'rlist' });
    for (const r of cr.recipesFor(recCat)) {
      const need = c.prof[recCat].level >= r.minProf;
      const row = h('div', { class: `recipe ${need ? '' : 'locked'}` }, h('div', { class: 'r-name' }, t(`${r.id}.name`), h('small', {}, ` · ${t('ui.prof_level')} ${r.minProf}`)), h('div', { class: 'cost', html: costLine(game, { chimes: r.chimes, materials: r.inputs }) }));
      const make = (opts = {}) => { const res = cr.craft(c, r.id, s.rng.fork(`cr${r.id}${s.time | 0}${c.inv.chimes}`), opts); result(res.ok ? t('ui.craft_ok_recipe', { n: t(`${r.id}.name`) }) : t(`ui.craft_err_${res.reason}`, { need: res.need })); };
      if (r.output.type === 'item') {
        const slots = r.output.slot === 'armor' ? ['head', 'chest', 'hands', 'feet', 'offhand'] : r.output.slot === 'jewelry' ? ['neck', 'ring', 'relic'] : [r.output.slot];
        const sl = h('select', {}, slots.map((x) => h('option', { value: x }, t(`slot.${x}`))));
        row.append(sl, button(t('ui.craft'), () => make({ slot: sl.value }), { disabled: !need || !atStation }));
      } else if (r.output.type === 'gem_fuse') {
        const stones = ['sonic', 'ember', 'rime', 'spark', 'venom', 'vigor', 'bulwark', 'echo'];
        const sl = h('select', {}, stones.map((x) => h('option', { value: x }, t(`gem.${x}_1.name`).replace(/ astillada| astillado/i, ''))));
        row.append(sl, button(t('ui.fuse'), () => { const q = 1; const r2 = cr.craft(c, r.id, s.rng.fork(`fz${s.time | 0}`), { stone: sl.value, quality: q }); result(r2.ok ? t('ui.craft_ok_recipe', { n: t(`${r2.gem}.name`) }) : t(`ui.craft_err_${r2.reason}`)); }, { disabled: !need || !atStation }));
      } else row.append(button(t('ui.craft'), () => make(), { disabled: !need || !atStation }));
      list.append(row);
    }
    wrap.append(list);
    if (log) wrap.append(h('div', { class: 'craft-log' }, log));
    return wrap;
  };

  const profView = () => {
    const c = C();
    return h('div', { class: 'profs' }, ['alchemy', 'forge', 'runes'].map((k) => { const p = c.prof[k]; const need = k === 'forge' || k === 'runes' ? 40 * p.level ** 1.5 : 30 + p.level * 18; return h('div', { class: 'prof' }, h('b', {}, `${t(`prof.${k}.name`)} — ${t('ui.level')} ${p.level}`), h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, p.xp / need * 100)}%` } })), h('div', { class: 'dim' }, t(`prof.${k}.desc`))); }));
  };

  return { el, blocking: true, open(d) { station = d?.station ?? null; if (d?.item) { selId = d.item; tab = 'rework'; } if (station === 'alchemy') { tab = 'recipes'; recCat = 'alchemy'; } else if (station === 'forge') { tab = 'rework'; } log = ''; render(); }, close() {}, refresh: render };
}

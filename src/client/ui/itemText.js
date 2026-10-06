/** Text helpers for items & stats: names, mod lines, tooltips. Pure functions over registry data + locale. */
import { t, i18n } from '../../core/i18n.js';

export const RARITY_COLOR = { common: '#d8d4c8', fine: '#6fb3ff', attuned: '#ffd24a', relic: '#ff8a3a' };
export const RARITY_LABEL = { common: 'rarity.common', fine: 'rarity.fine', attuned: 'rarity.attuned', relic: 'rarity.relic' };

export function itemName(reg, item) {
  if (!item) return '';
  if (item.unique) return t(`${item.unique}.name`);
  const base = t(`${item.base}.name`);
  if (item.rarity === 'attuned' && item.epithet !== undefined) return `${base} «${t(`item.epithet.${item.epithet}`)}»`;
  if (item.rarity === 'fine') {
    const pre = item.affixes.map((a) => reg.get(a.id)).find((d) => d?.type === 'prefix'), suf = item.affixes.map((a) => reg.get(a.id)).find((d) => d?.type === 'suffix');
    return `${base}${pre ? ` ${t(`${pre.id}.name`).toLowerCase()}` : ''}${!pre && suf ? ` ${t(`${suf.id}.name`)}` : ''}`;
  }
  return base;
}

const PCT_OPS = new Set(['inc', 'more']);
/** "+12 % Daño sónico" */
export function modLine(statDefs, mod, value) {
  const def = statDefs.get?.(mod.stat) ?? statDefs[mod.stat];
  const fmt = def?.fmt ?? 'int';
  const tag = (mod.tags ?? []).map((g) => t(`tag.${g}`)).join(' ');
  let name = t(`stat.${mod.stat}`);
  if (tag && ['damage', 'damageFlat'].includes(mod.stat)) name = `${name} ${tag}`;
  else if (tag) name = `${name} (${tag})`;
  const sign = value >= 0 ? '+' : '−', a = Math.abs(value);
  let txt;
  if (PCT_OPS.has(mod.op) || fmt === 'pct' || fmt === 'pct_s') txt = `${sign}${round(a * 100)} %${fmt === 'pct_s' ? '/s' : ''}`;
  else if (fmt === 'per_s') txt = `${sign}${round(a)}/s`;
  else if (fmt === 'mult') txt = `${sign}${round(a * 100)} %`;
  else txt = `${sign}${round(a)}`;
  return `${txt} ${name}`;
}
const round = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

export function statName(stat) { return t(`stat.${stat}`); }

/** HTML tooltip for an item. `cmp` is the output of compareItem() (optional). */
export function itemTooltipHTML(game, item, { cmp = null, price = null } = {}) {
  const s = game.session, reg = s.registry, fac = s.factory;
  const d = fac.derive(item);
  const base = reg.get(item.base);
  const col = RARITY_COLOR[item.rarity];
  const sd = game.statDefs;
  let h = `<div class="tt-name" style="color:${col}">${esc(itemName(reg, item))}</div>`;
  h += `<div class="tt-sub">${t(RARITY_LABEL[item.rarity])} · ${t(`slot.${base.slot}`)}${base.kind ? ` · ${t(`kind.${base.kind}`)}` : ''} · ${t('ui.ilvl')} ${item.ilvl}${item.up ? ` · +${item.up}` : ''}</div>`;
  if (d.weapon) h += `<div class="tt-weapon">${t('ui.weapon_hit')}: <b>${Math.round(d.weapon.hit)}</b> · ${t('ui.speed')} ${(base.weapon?.speed ?? 1).toFixed(2)}</div>`;
  const implicit = d.mods.filter((m) => m.group === 'base' || m.src === 'base');
  for (const l of d.lines) {
    const cls = l.kind === 'prefix' || l.kind === 'suffix' ? 'aff' : l.kind === 'unique' ? 'uni' : l.kind === 'gem' ? 'gem' : 'aff';
    const range = l.range ? ` <i>(${fmtRange(l)})</i>` : '';
    h += `<div class="tt-line ${cls}">${esc(modLine(sd, l.mod, l.value))}${range}</div>`;
  }
  if (item.unique) { h += `<div class="tt-uniq">${esc(t(`${item.unique}.desc`))}</div><div class="tt-lore">${esc(t(`${item.unique}.lore`))}</div>`; }
  if (item.sockets?.length) h += `<div class="tt-sock">${item.sockets.map((g) => (g ? `<span class="sock full">${esc(t(`${g}.name`))}</span>` : '<span class="sock"></span>')).join('')}</div>`;
  h += `<div class="tt-stab">${t('ui.stability')}: ${item.stability}/${item.maxStability}${item.stability <= 0 ? ` · ${t('ui.cracked')}` : ''}</div>`;
  const req = game.session.character.reqLevel(item);
  h += `<div class="tt-req ${game.session.character.level < req ? 'bad' : ''}">${t('ui.req_level', { level: req })}</div>`;
  if (cmp) h += cmpHTML(cmp);
  if (price !== null) h += `<div class="tt-price">${price} ${t('ui.chimes')}</div>`;
  if (item.fav) h += `<div class="tt-flag">★ ${t('ui.favorite')}</div>`;
  if (item.locked) h += `<div class="tt-flag">🔒 ${t('ui.locked')}</div>`;
  return h;
}
function fmtRange(l) { const r = l.range; if (!r) return ''; const f = (v) => (Math.abs(r[0]) < 2 && l.mod.op !== 'flat' ? `${round(v * 100)}%` : round(v)); return `${f(r[0])}–${f(r[1])}`; }

function cmpHTML(c) {
  const col = { upgrade: '#6dff9a', defensive: '#7fe3ff', trade_offense: '#ffd27a', trade_defense: '#ffd27a', sidegrade: '#ddd', downgrade: '#ff6a5a' }[c.verdict] ?? '#ddd';
  let h = `<div class="tt-cmp" style="border-color:${col}"><div style="color:${col};font-weight:700">${t(`ui.cmp.${c.verdict}`)}</div>`;
  const show = c.rows.filter((r) => ['dps', 'ehp', 'life', 'armor', 'moveSpeed', 'crit', 'cooldownRate', 'resourceGain', 'listenRange', 'statusChance'].includes(r.key) || r.key.startsWith('res.')).slice(0, 8);
  for (const r of show) {
    const up = r.delta > 0, pct = r.key.startsWith('res.') || r.key === 'crit' || r.key === 'statusChance' ? `${up ? '+' : ''}${(r.delta * 100).toFixed(1)} %` : `${up ? '+' : ''}${(r.pct * 100).toFixed(1)} %`;
    h += `<div>${t(`ui.cmp.key.${r.key.startsWith('res.') ? 'res' : r.key}`, { type: r.key.startsWith('res.') ? t(`stat.${r.key}`) : '' })}: <b style="color:${up ? '#6dff9a' : '#ff6a5a'}">${pct}</b>${r.relevant ? ' ★' : ''}</div>`;
  }
  if (c.transforms) h += `<div style="color:#ffb36a">${t('ui.cmp.transforms')}</div>`;
  return `${h}</div>`;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { i18n };

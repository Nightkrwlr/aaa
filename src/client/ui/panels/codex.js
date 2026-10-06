import { h, button, clear, tabs } from '../dom.js';
import { t, i18n } from '../../../core/i18n.js';
import { iconSVG } from '../iconGen.js';
import { glyphDataURL, GLYPHS } from '../../render/glyphs.js';
import { BESTIARY_TIERS } from '../../../sim/codex.js';

const CATS = ['all', 'world', 'factions', 'creatures', 'places', 'voices', 'inscriptions', 'notes', 'glyphs', 'mysteries'];

export function codex(game, ui) {
  const el = h('div', { class: 'codex-root' });
  let tab = 'lore', cat = 'all', sel = null;
  const render = () => {
    clear(el);
    const s = game.session, cx = s.codex, prog = cx.progress();
    const head = h('div', { class: 'panel-head' }, h('h2', {}, t('ui.codex')), h('div', { class: 'dim' }, `${t('ui.lore')} ${prog.codex[0]}/${prog.codex[1]} · ${t('ui.bestiary')} ${prog.bestiary[0]}/${prog.bestiary[1]}`), button('✕', () => ui.close('codex'), { cls: 'x' }));
    const tb = tabs([{ id: 'lore', label: t('ui.lore') }, { id: 'bestiary', label: t('ui.bestiary') }, { id: 'stats', label: t('ui.statistics') }], (id) => { tab = id; sel = null; render(); }, tab);
    const body = h('div', { class: 'codex-body' });
    if (tab === 'lore') {
      const cats = h('div', { class: 'cats' }, CATS.map((c) => button(t(`ui.cat_${c}`), () => { cat = c; sel = null; render(); }, { cls: `small ${c === cat ? 'on' : ''}` })));
      const list = h('div', { class: 'c-list' }), det = h('div', { class: 'c-detail' });
      const entries = cx.entries().filter((e) => cat === 'all' || e.category === cat);
      for (const e of entries) list.append(h('button', { class: `c-item ${e.found ? '' : 'unknown'} ${sel === e.id ? 'on' : ''}`, type: 'button', onClick: () => { sel = e.id; render(); } }, e.found ? t(e.titleKey) : '???'));
      const e = entries.find((x) => x.id === sel) ?? entries.find((x) => x.found);
      if (e) { sel = e.id; det.append(e.found ? h('div', {}, h('h3', {}, t(e.titleKey)), h('div', { class: 'dim' }, t(`ui.cat_${e.category}`)), h('p', { class: 'lore-text' }, t(e.bodyKey)), e.category === 'glyphs' ? glyphView(e.id) : null) : h('div', {}, h('h3', {}, '???'), h('p', { class: 'dim' }, e.hintKey ? t(e.hintKey) : t('ui.undiscovered')))); }
      else det.append(h('div', { class: 'empty-msg' }, t('ui.empty')));
      body.append(h('div', { class: 'c-left' }, cats, list), det);
    } else if (tab === 'bestiary') {
      const list = h('div', { class: 'c-list' }), det = h('div', { class: 'c-detail' });
      const b = cx.bestiary();
      for (const e of b) list.append(h('button', { class: `c-item ${e.seen ? '' : 'unknown'} ${sel === e.id ? 'on' : ''}`, type: 'button', onClick: () => { sel = e.id; render(); } }, e.seen ? `${t(`${e.id}.name`)}  (${e.kills})` : '???'));
      const e = b.find((x) => x.id === sel) ?? b.find((x) => x.seen);
      if (e?.seen) {
        sel = e.id;
        const def = s.registry.get(e.id), next = BESTIARY_TIERS.find((x) => x.kills > e.kills);
        det.append(h('h3', {}, t(`${e.id}.name`)), h('div', { class: 'dim' }, `${t(`${def.family}.name`)} · ${t(`tier.${def.tier}`)} · ${e.kills} ${t('ui.kills')}${next ? ` (${t('ui.next_tier', { n: next.kills })})` : ''}`), h('p', { class: 'lore-text' }, t(`${e.id}.desc`)));
        if (e.tier >= 2) det.append(h('div', {}, h('b', {}, `${t('ui.weak')}: `), (e.weak ?? []).map((x) => t(`tag.${x}`)).join(', ') || '—', ' · ', h('b', {}, `${t('ui.resist')}: `), (e.resist ?? []).map((x) => t(`tag.${x}`)).join(', ') || '—'));
        if (e.tier >= 3) det.append(h('div', {}, h('b', {}, `${t('ui.tip')}: `), t(`tip.${e.tip}`)), h('div', {}, h('b', {}, `${t('ui.drops')}: `), (e.drops ?? []).map((id) => t(`${id}.name`)).join(', ') || '—'), h('div', { class: 'dim' }, (def.abilities ?? []).map((a) => t(`${a}.name`)).join(' · ')));
        if (e.hasLore) det.append(h('p', { class: 'lore-text' }, `“${t(`${e.id}.lore`)}”`));
        if (e.tier < 4) det.append(h('div', { class: 'dim' }, t('ui.bestiary_locked')));
      } else det.append(h('div', { class: 'empty-msg' }, t('ui.empty')));
      body.append(h('div', { class: 'c-left' }, list), det);
    } else {
      const st = s.state.stats, ch = s.character;
      const rows = [['ui.playtime', `${Math.floor(ch.counters.playSeconds / 60)} min`], ['ui.kills', st.kills], ['ui.deaths', st.deaths], ['ui.listens', st.listens], ['ui.chords', st.chords], ['ui.perfect_dodges', st.perfectDodges], ['ui.voices_captured', st.voicesCaptured], ['ui.secrets', st.secretsFound], ['ui.dungeons_done', st.dungeons], ['ui.quests_done', st.quests], ['ui.items_found', ch.counters.itemsFound], ['ui.chimes_earned', ch.counters.chimesEarned]];
      body.append(h('table', { class: 'epi-stats' }, rows.map(([k, v]) => h('tr', {}, h('td', {}, t(k)), h('td', {}, String(v))))));
    }
    el.append(head, tb.bar, body);
  };
  const glyphView = (id) => { const idx = { 'cdx.glyph_1': 1, 'cdx.glyph_2': 4, 'cdx.glyph_3': 7 }[id]; if (idx === undefined) return null; return h('img', { class: 'glyph-img', src: glyphDataURL(GLYPHS[idx], 96), alt: t(`pz.glyph.${GLYPHS[idx]}`) }); };
  return { el, blocking: true, open() { render(); }, close() {}, refresh: render };
}

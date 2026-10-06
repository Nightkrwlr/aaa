import { h, button, clear, tabs } from '../dom.js';
import { t } from '../../../core/i18n.js';

const CAT_ICON = { main: '★', side: '◆', secret: '✦' };

export function quests(game, ui) {
  const el = h('div', { class: 'quests-root' });
  let tab = 'active', sel = null;
  const render = () => {
    clear(el);
    const s = game.session, st = s.state;
    const head = h('div', { class: 'panel-head' }, h('h2', {}, t('ui.journal')), button('✕', () => ui.close('quests'), { cls: 'x' }));
    const tb = tabs([{ id: 'active', label: t('ui.q_active') }, { id: 'done', label: t('ui.q_done') }], (id) => { tab = id; sel = null; render(); }, tab);
    const ids = Object.entries(st.quests).filter(([, q]) => (tab === 'active' ? q.state === 'active' : q.state !== 'active')).map(([id]) => id);
    ids.sort((a, b) => (s.registry.get(a).category === 'main' ? -1 : 1) - (s.registry.get(b).category === 'main' ? -1 : 1));
    sel = ids.includes(sel) ? sel : ids[0] ?? null;
    const list = h('div', { class: 'q-list' });
    for (const id of ids) { const d = s.registry.get(id); list.append(h('button', { class: `q-item ${id === sel ? 'on' : ''} ${d.category}`, type: 'button', onClick: () => { sel = id; render(); } }, `${CAT_ICON[d.category] ?? '•'} ${t(`${id}.name`)}`)); }
    if (!ids.length) list.append(h('div', { class: 'empty-msg' }, t('ui.empty')));
    const det = h('div', { class: 'q-detail' });
    if (sel) {
      const d = s.registry.get(sel), q = st.quests[sel];
      det.append(h('h3', {}, t(`${sel}.name`)), h('div', { class: 'dim' }, t(`ui.cat_${d.category}`)), h('p', {}, t(`${sel}.summary`)));
      if (q.state === 'active') {
        det.append(h('h4', {}, t(`${sel}.${q.stage}.title`)), h('p', {}, t(`${sel}.${q.stage}.desc`)));
        const ul = h('ul', { class: 'objs' });
        for (const o of s.quests.objectives(sel)) ul.append(h('li', { class: o.done ? 'done' : '' }, `${o.done ? '✔' : '◇'} ${t(`${sel}.${q.stage}.o${o.index}`)}${o.need > 1 ? ` (${o.have}/${o.need})` : ''}`));
        det.append(ul);
        const tracked = st.flags.trackedQuest === sel || (!st.flags.trackedQuest && d.category === 'main');
        det.append(button(tracked ? `✔ ${t('ui.tracking')}` : t('ui.track'), () => { st.flags.trackedQuest = sel; render(); }, { cls: 'small' }));
      } else det.append(h('div', { class: 'dim' }, q.state === 'done' ? t('ui.completed') : t('ui.failed')));
      const done = d.stages.map((x) => x.id); const idx = done.indexOf(q.stage);
      if (idx > 0 || q.state === 'done') det.append(h('details', {}, h('summary', {}, t('ui.q_history')), h('ul', {}, d.stages.slice(0, q.state === 'done' ? d.stages.length : idx).map((x) => h('li', {}, `✔ ${t(`${sel}.${x.id}.title`)}`)))));
    }
    el.append(head, tb.bar, h('div', { class: 'q-cols' }, list, det));
  };
  return { el, blocking: true, open() { render(); }, close() {}, refresh: render };
}

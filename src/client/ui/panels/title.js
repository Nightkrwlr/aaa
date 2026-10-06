import { h, button, clear, select } from '../dom.js';
import { t } from '../../../core/i18n.js';
import { iconSVG } from '../iconGen.js';

const CLASSES = ['cls.belfry', 'cls.prismatist', 'cls.skirmisher'];
const DIFFS = ['wanderer', 'seeker', 'chorister', 'maestro'];

export function fmtTime(sec) { const h2 = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h2 ? `${h2} h ${m} min` : `${m} min`; }
export function slotCard(game, s, { onLoad, onDelete, onSave } = {}) {
  const meta = s.meta;
  const card = h('div', { class: `slot ${s.corrupt ? 'bad' : ''}` });
  if (s.empty) card.append(h('div', { class: 'slot-empty' }, t('ui.slot_empty')));
  else if (s.corrupt) card.append(h('div', { class: 'slot-empty' }, t('ui.slot_corrupt'), h('small', {}, s.error)));
  else card.append(
    h('div', { class: 'slot-main' }, h('b', {}, meta.name), ` · ${t(`${meta.classId}.name`)} · ${t('hud.level', { level: meta.level })}`),
    h('div', { class: 'slot-sub' }, `${fmtTime(meta.playSeconds)} · ${meta.area ? t(`${meta.area}.name`) : t('area.unknown')} · ${new Date(meta.savedAt).toLocaleString()}`),
    s.recovered ? h('div', { class: 'slot-warn' }, t('ui.slot_recovered')) : null);
  const row = h('div', { class: 'slot-actions' });
  if (onLoad && !s.empty && !s.corrupt) row.append(button(t('ui.load'), () => onLoad(s.slot)));
  if (onSave) row.append(button(t('ui.save'), () => onSave(s.slot)));
  if (onDelete && !s.empty) row.append(button(t('ui.delete'), () => onDelete(s.slot), { cls: 'danger' }));
  card.append(row);
  return card;
}

export function title(game, ui) {
  const el = h('div', { class: 'title-screen' });
  const body = h('div', { class: 'title-body' });
  el.append(h('div', { class: 'title-bg' }), body);
  let nameVal = t('ui.default_name');

  const mainMenu = () => {
    clear(body);
    const slots = game.saves.list();
    const hasSave = slots.some((s) => s.meta);
    const newest = slots.filter((s) => s.meta).sort((a, b) => b.meta.savedAt - a.meta.savedAt)[0];
    body.append(
      h('h1', { class: 'logo' }, t('game.title')), h('div', { class: 'subtitle' }, t('game.subtitle')),
      h('div', { class: 'menu' },
        hasSave ? button(`${t('ui.continue')}${newest ? ` — ${newest.meta.name} (${t('hud.level', { level: newest.meta.level })})` : ''}`, () => { const r = game.continueGame(newest.slot); if (!r.ok) game.toast(r.error); }, { cls: 'primary', key: 'continue' }) : null,
        button(t('ui.new_game'), newGame, { cls: hasSave ? '' : 'primary', key: 'new' }),
        hasSave ? button(t('ui.load_game'), loadMenu) : null,
        button(t('ui.settings'), () => ui.open('settings')),
        button(t('ui.controls'), () => ui.open('settings', { tab: 'controls' })),
        button(t('ui.about'), about)),
      h('div', { class: 'version' }, `${t('ui.version')} ${typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'} · ${t('ui.language')}: `, h('a', { href: '#', onClick: (e) => { e.preventDefault(); game.settings.language = game.settings.language === 'es' ? 'en' : 'es'; game.applySettings(); mainMenu(); } }, game.settings.language.toUpperCase())));
  };

  const newGame = () => {
    clear(body);
    let cls = 'cls.belfry'; let diff = game.settings.difficulty ?? 'seeker'; let seed = '';
    const cards = h('div', { class: 'class-cards' });
    const render = () => {
      clear(cards);
      for (const id of CLASSES) {
        const c = game.registry.get(id);
        const card = h('button', { class: `class-card ${id === cls ? 'on' : ''}`, type: 'button', onClick: () => { cls = id; render(); } },
          h('div', { class: 'cc-icon', html: iconSVG({ glyph: c.resource.id === 'toll' ? 'bell' : c.resource.id === 'fulgor' ? 'prism' : 'blade', elem: 'sonic' }, 72) }),
          h('div', { class: 'cc-name' }, t(`${id}.name`)), h('div', { class: 'cc-res' }, `${t('ui.resource')}: ${t(`${id}.resource`)}`), h('div', { class: 'cc-desc' }, t(`${id}.desc`)));
        cards.append(card);
      }
    };
    render();
    const nameIn = h('input', { type: 'text', maxlength: 18, value: nameVal, 'aria-label': t('ui.name') });
    const seedIn = h('input', { type: 'text', placeholder: t('ui.seed_hint'), 'aria-label': t('ui.seed') });
    body.append(h('h2', {}, t('ui.new_game')), cards,
      h('div', { class: 'ng-fields' }, h('label', {}, t('ui.name'), nameIn), h('label', {}, t('ui.seed'), seedIn),
        select(t('ui.difficulty'), diff, DIFFS.map((d) => [d, t(`diff.${d}`)]), (v) => { diff = v; descr.textContent = t(`diff.${v}.desc`); })),
      (() => { const d = h('div', { class: 'diff-desc' }, t(`diff.${diff}.desc`)); return d; })(),
      h('div', { class: 'menu row' }, button(t('ui.back'), mainMenu), button(t('ui.begin'), () => { nameVal = nameIn.value.trim() || t('ui.default_name'); game.newGame({ classId: cls, name: nameVal, difficulty: diff, seed: seedIn.value.trim() || undefined }); }, { cls: 'primary' })));
    const descr = body.querySelector('.diff-desc');
  };

  const loadMenu = () => {
    clear(body);
    const list = h('div', { class: 'slots' });
    const refresh = () => {
      clear(list);
      for (const s of game.saves.list()) list.append(slotCard(game, s, { onLoad: (slot) => { const r = game.continueGame(slot); if (!r.ok) game.toast(r.error); }, onDelete: (slot) => ui.open('confirm', { text: t('ui.confirm_delete'), onYes: () => { game.saves.delete(slot); refresh(); } }) }));
    };
    refresh();
    const imp = h('textarea', { class: 'import', placeholder: t('ui.import_hint'), rows: 3 });
    body.append(h('h2', {}, t('ui.load_game')), list,
      h('div', { class: 'menu row' }, button(t('ui.back'), mainMenu)),
      h('details', {}, h('summary', {}, t('ui.import_export')), imp, button(t('ui.import'), () => { const r = game.saves.importSlot('slot3', imp.value); game.toast(r.ok ? t('toast.imported') : t('toast.import_failed')); refresh(); })));
  };

  const about = () => {
    clear(body);
    body.append(h('h2', {}, t('ui.about')), h('p', { class: 'about' }, t('ui.about_text')), h('p', { class: 'about' }, t('ui.assets_note')), h('div', { class: 'menu row' }, button(t('ui.back'), mainMenu)));
  };

  return { el, blocking: true, noEscape: true, open() { mainMenu(); }, close() {} };
}

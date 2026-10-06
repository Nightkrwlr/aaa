import { h, clear } from '../dom.js';
import { t } from '../../../core/i18n.js';

export function dialogue(game, ui) {
  const el = h('div', { class: 'dialogue-box' });
  const nameEl = h('div', { class: 'dlg-name' }), textEl = h('div', { class: 'dlg-text', 'aria-live': 'polite' }), choicesEl = h('div', { class: 'dlg-choices' });
  const hint = h('div', { class: 'dlg-hint' }, t('ui.dlg_hint'));
  el.append(nameEl, textEl, choicesEl, hint);
  let timer = null, full = '', shown = 0, view = null;

  const finish = () => { clearInterval(timer); timer = null; textEl.textContent = full; shown = full.length; renderChoices(); };
  const type = () => {
    clearInterval(timer);
    if (game.settings.reduceFlashes) { finish(); return; }
    shown = 0; textEl.textContent = '';
    timer = setInterval(() => { shown += 2; textEl.textContent = full.slice(0, shown); if (shown >= full.length) finish(); }, 16);
  };
  const advance = (i) => {
    const s = game.session; if (!s) return;
    const nv = s.dialogue.advance(i);
    game.audio.ui('click');
    if (!nv) { ui.close('dialogue'); return; }
    show(nv);
  };
  const renderChoices = () => {
    clear(choicesEl);
    if (!view) return;
    if (!view.choices.length) { choicesEl.append(h('button', { class: 'btn dlg-choice', onClick: () => advance(null), autofocus: true }, `${view.hasNext ? t('ui.dlg_continue') : t('ui.dlg_end')} ▸`)); return; }
    view.choices.forEach((c, n) => choicesEl.append(h('button', { class: `btn dlg-choice ${c.enabled ? '' : 'off'}`, disabled: !c.enabled, onClick: () => advance(c.index), dataset: { n: n + 1 } }, `${n + 1}. ${t(c.textKey)}`)));
    choicesEl.querySelector('button:not(:disabled)')?.focus();
  };
  const show = (v) => {
    view = v; nameEl.textContent = t(`${v.speaker}.name`);
    full = t(v.textKey, v.params); clear(choicesEl); type();
  };
  const onKey = (e) => {
    if (!ui.isOpen('dialogue')) return;
    if (/^[1-9]$/.test(e.key)) { const b = choicesEl.querySelector(`[data-n="${e.key}"]`); if (b && !b.disabled) b.click(); }
    else if (e.key === ' ' || e.key === 'Enter') { if (timer) { finish(); e.preventDefault(); e.stopPropagation(); } else if (!view?.choices.length) { advance(null); e.preventDefault(); } }
  };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => { if (timer && e.target !== choicesEl) finish(); });
  return {
    el, blocking: true,
    open(d) { if (d?.view) show(d.view); },
    close() { clearInterval(timer); timer = null; game.session?.dialogue.end(); },
  };
}

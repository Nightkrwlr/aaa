import { h, button, clear, tabs, slider, toggle, select } from '../dom.js';
import { t } from '../../../core/i18n.js';
import { DEFAULT_BINDINGS, ACTION_LIST } from '../../input/input.js';
import { DEFAULTS } from '../../settings.js';

const keyLabel = (c) => c.replace('Key', '').replace('Digit', '').replace('Mouse', 'M').replace('Arrow', '↑↓←→'.includes('x') ? '' : '').replace('Space', '␣').replace('ShiftLeft', 'Shift').replace('AltLeft', 'Alt').replace('Escape', 'Esc');

/** local-only telemetry dump: nothing is ever sent anywhere, the player decides what to do with the file */
function exportTelemetry(game) {
  const rows = game.session?.telemetry ?? [];
  if (!rows.length) { game.toast(t('ui.telemetry_empty')); return; }
  const blob = new Blob([JSON.stringify({ build: game.build ?? 'local', savedAt: new Date().toISOString(), events: rows }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `sunderchoir-telemetry-${Date.now()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  game.toast(t('toast.telemetry_saved', { n: rows.length }));
}

export function settings(game, ui) {
  const el = h('div', { class: 'settings-root' });
  let tab = 'graphics', capturing = null;
  const st = () => game.settings;
  const apply = () => game.applySettings();
  const set = (k, v) => { st()[k] = v; apply(); };

  const render = () => {
    clear(el);
    const head = h('div', { class: 'panel-head' }, h('h2', {}, t('ui.settings')), button(t('ui.defaults'), () => ui.open('confirm', { text: t('ui.confirm_defaults'), onYes: () => { Object.assign(game.settings, { ...DEFAULTS, language: game.settings.language }); apply(); render(); } }), { cls: 'small' }), button('✕', () => ui.close('settings'), { cls: 'x' }));
    const tb = tabs(['graphics', 'audio', 'gameplay', 'access', 'controls'].map((id) => ({ id, label: t(`ui.set_${id}`) })), (id) => { tab = id; render(); }, tab);
    const body = h('div', { class: 'settings-body' });
    const S = st();
    if (tab === 'graphics') body.append(
      select(t('ui.quality'), S.quality, [['low', t('ui.q_low')], ['medium', t('ui.q_medium')], ['high', t('ui.q_high')], ['ultra', t('ui.q_ultra')]], (v) => set('quality', v)),
      slider(t('ui.render_scale'), S.renderScale, { min: 0.5, max: 1.5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set('renderScale', v) }),
      slider(t('ui.camera_zoom'), S.cameraZoom, { min: 15, max: 38, step: 1, fmt: (v) => `${v}`, onInput: (v) => set('cameraZoom', v) }),
      toggle(t('ui.occlusion_fade'), S.occlusionFade, (v) => set('occlusionFade', v), t('ui.occlusion_fade_hint')),
      toggle(t('ui.show_fps'), S.showFps, (v) => set('showFps', v)),
      toggle(t('ui.damage_numbers'), S.damageNumbers, (v) => set('damageNumbers', v)),
      h('p', { class: 'dim' }, t('ui.quality_hint')));
    else if (tab === 'audio') body.append(...[['volMaster', 'ui.vol_master'], ['volMusic', 'ui.vol_music'], ['volSfx', 'ui.vol_sfx'], ['volUi', 'ui.vol_ui'], ['volAmbient', 'ui.vol_ambient']].map(([k, l]) => slider(t(l), S[k], { onInput: (v) => set(k, v) })));
    else if (tab === 'gameplay') body.append(
      select(t('ui.difficulty'), S.difficulty, ['wanderer', 'seeker', 'chorister', 'maestro'].map((d) => [d, t(`diff.${d}`)]), (v) => { set('difficulty', v); if (game.session) game.session.world.difficulty = v; }),
      h('div', { class: 'dim' }, t(`diff.${S.difficulty}.desc`)),
      select(t('ui.scheme'), S.scheme, [['click', t('ui.scheme_click')], ['wasd', t('ui.scheme_wasd')]], (v) => set('scheme', v)),
      select(t('ui.loot_filter'), S.lootFilter, [['all', t('ui.lf_all')], ['normal', t('ui.lf_normal')], ['strict', t('ui.lf_strict')]], (v) => set('lootFilter', v)),
      h('div', { class: 'dim' }, t(`ui.lf_${S.lootFilter}_desc`)),
      toggle(t('ui.auto_pickup'), S.autoPickupMaterials, (v) => set('autoPickupMaterials', v)),
      toggle(t('ui.puzzle_hints'), S.puzzleHints, (v) => set('puzzleHints', v), t('ui.puzzle_hints_hint')),
      toggle(t('ui.hit_stop'), S.hitStop, (v) => set('hitStop', v)),
      toggle(t('ui.hud_tracker'), S.hudTracker, (v) => set('hudTracker', v)),
      slider(t('ui.screen_shake'), S.screenShake, { onInput: (v) => set('screenShake', v) }),
      slider(t('ui.aim_assist'), S.aimAssist, { onInput: (v) => set('aimAssist', v) }),
      toggle(t('ui.telemetry'), S.telemetry, (v) => set('telemetry', v), t('ui.telemetry_hint')),
      button(t('ui.telemetry_export'), () => exportTelemetry(game), { cls: 'small' }),
      select(t('ui.language'), S.language, [['es', 'Español'], ['en', 'English']], (v) => { set('language', v); render(); }));
    else if (tab === 'access') body.append(
      slider(t('ui.ui_scale'), S.uiScale, { min: 0.8, max: 1.5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set('uiScale', v) }),
      slider(t('ui.text_scale'), S.textScale, { min: 0.8, max: 1.6, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set('textScale', v) }),
      slider(t('ui.hud_scale'), S.hudScale, { min: 0.8, max: 1.5, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set('hudScale', v) }),
      select(t('ui.colorblind'), S.colorblind, [['none', t('ui.cb_none')], ['protanopia', t('ui.cb_protan')], ['deuteranopia', t('ui.cb_deuter')], ['tritanopia', t('ui.cb_tritan')]], (v) => set('colorblind', v)),
      toggle(t('ui.high_contrast'), S.highContrast, (v) => set('highContrast', v)),
      toggle(t('ui.reduce_flashes'), S.reduceFlashes, (v) => set('reduceFlashes', v), t('ui.reduce_flashes_hint')),
      toggle(t('ui.subtitles'), S.subtitles, (v) => set('subtitles', v)),
      slider(t('ui.vibration'), S.vibration, { onInput: (v) => set('vibration', v) }),
      h('p', { class: 'dim' }, t('ui.access_note')));
    else {
      const grid = h('div', { class: 'bind-grid' });
      const binds = { ...DEFAULT_BINDINGS, ...(S.bindings ?? {}) };
      for (const a of ACTION_LIST.filter((x) => x !== 'devtools' || game.dev)) {
        const b = h('button', { class: `btn bind ${capturing === a ? 'cap' : ''}`, type: 'button', onClick: () => { capturing = a; render(); } }, capturing === a ? t('ui.press_key') : binds[a].map(keyLabel).join(' / '));
        grid.append(h('div', { class: 'bind-row' }, h('span', {}, t(`act.${a}`)), b));
      }
      body.append(h('div', { class: 'dim' }, t('ui.bind_hint')), grid, button(t('ui.reset_bindings'), () => { S.bindings = {}; apply(); render(); }, { cls: 'small' }));
    }
    el.append(head, tb.bar, body);
  };

  // capture the next key / mouse button for a rebinding (swaps with any conflicting action)
  const onKey = (e) => {
    if (!capturing || !ui.isOpen('settings')) return;
    e.preventDefault(); e.stopPropagation();
    const code = e.type === 'mousedown' ? `Mouse${e.button + 1}` : e.code;
    if (code === 'Escape') { capturing = null; render(); return; }
    const S = st(); S.bindings ??= {};
    const cur = { ...DEFAULT_BINDINGS, ...S.bindings };
    for (const other of ACTION_LIST) if (other !== capturing && cur[other].includes(code)) S.bindings[other] = cur[other].filter((c) => c !== code).concat(cur[capturing]).slice(0, 1);
    S.bindings[capturing] = [code]; capturing = null; apply(); render();
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('mousedown', (e) => { if (capturing && e.target.closest?.('.bind.cap') === null && e.button > 0) onKey(e); }, true);

  return { el, blocking: true, open(d) { tab = d?.tab ?? tab; render(); }, close() { capturing = null; game.canvasFocus(); } };
}

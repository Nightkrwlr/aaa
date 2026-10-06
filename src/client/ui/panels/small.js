import { h, button, clear } from '../dom.js';
import { t, i18n } from '../../../core/i18n.js';
import { clueText } from '../../../sim/puzzles/clues.js';
import { slotCard, fmtTime } from './title.js';
import { glyphDataURL, GLYPHS } from '../../render/glyphs.js';
import { GLYPH_SYMBOLS } from '../../../sim/puzzles/glyphLock.js';

// ───────────────────────── confirm
export function confirmBox(game, ui) {
  const el = h('div', { class: 'modal-small' });
  let cb = null;
  return {
    el, blocking: true,
    open(d) { cb = d; clear(el); el.append(h('p', {}, d.text), h('div', { class: 'row' }, button(t('ui.yes'), () => { ui.close('confirm'); d.onYes?.(); }, { cls: 'primary' }), button(t('ui.no'), () => ui.close('confirm')))); },
    close() { cb = null; },
  };
}

// ───────────────────────── pause
export function pause(game, ui) {
  const el = h('div', { class: 'modal-small pause' });
  const render = () => {
    clear(el);
    const slots = h('div', { class: 'slots' });
    for (const s of game.saves.list(['slot1', 'slot2', 'slot3'])) slots.append(slotCard(game, s, { onSave: (slot) => { const r = game.saves.save(slot, game.session); game.toast(r.ok ? t('toast.saved') : t('toast.save_failed')); render(); }, onLoad: (slot) => ui.open('confirm', { text: t('ui.confirm_load'), onYes: () => { const r = game.continueGame(slot); if (!r.ok) game.toast(r.error); } }) }));
    const s = game.session, st = s.state.stats, ch = s.character;
    el.append(h('h2', {}, t('ui.paused')),
      h('div', { class: 'menu' }, button(t('ui.resume'), () => ui.close('pause'), { cls: 'primary' }), button(t('ui.settings'), () => ui.open('settings')), button(t('ui.controls'), () => ui.open('settings', { tab: 'controls' })), button(t('ui.quit_title'), () => ui.open('confirm', { text: t('ui.confirm_quit'), onYes: () => game.quitToTitle() }))),
      h('h3', {}, t('ui.saves')), slots,
      h('div', { class: 'export-row' }, button(t('ui.export_save'), () => { game.saves.save('slot1', s); const blob = game.saves.exportSlot('slot1'); navigator.clipboard?.writeText(blob).then(() => game.toast(t('toast.copied')), () => { prompt(t('ui.export_save'), blob); }); })),
      h('div', { class: 'stats-mini' }, `${t('ui.playtime')}: ${fmtTime(ch.counters.playSeconds)} · ${t('ui.kills')}: ${st.kills} · ${t('ui.deaths')}: ${st.deaths} · ${t('ui.secrets')}: ${st.secretsFound} · ${t('ui.seed')}: ${s.seed}`));
  };
  return { el, blocking: true, open() { render(); }, close() { game.canvasFocus(); } };
}

// ───────────────────────── death
export function death(game, ui) {
  const el = h('div', { class: 'death-screen' });
  return {
    el, blocking: true, noEscape: true,
    open(d) {
      clear(el);
      const s = game.session;
      el.append(h('h1', {}, t('hud.dead')), h('p', {}, d?.lost ? t('ui.death_lost', { n: d.lost }) : t('ui.death_nothing')), h('p', { class: 'dim' }, s.mode === 'dungeon' ? t('ui.death_hint_dungeon') : t('ui.death_hint')),
        button(t('hud.respawn'), () => { s.respawn(); ui.close('death'); }, { cls: 'primary' }));
    },
    close() {},
  };
}

// ───────────────────────── lore (codex entries or narrative pieces)
export function lore(game, ui) {
  const el = h('div', { class: 'modal-small lore' });
  return {
    el, blocking: true,
    open(d) {
      clear(el);
      const key = d.key ?? '';
      const isCodex = i18n.has(`${key}.title`);
      el.append(h('h2', {}, isCodex ? t(`${key}.title`) : t('ui.inscription')), h('p', { class: 'lore-text' }, isCodex ? t(`${key}.body`) : t(key)), button(t('ui.close'), () => ui.close('lore'), { cls: 'primary' }));
      if (isCodex) el.append(h('div', { class: 'dim' }, t('ui.codex_added')));
    },
    close() {},
  };
}

// ───────────────────────── clue tablet
export function tablet(game, ui) {
  const el = h('div', { class: 'modal-small tablet' });
  return {
    el, blocking: true,
    open(d) {
      clear(el);
      const s = game.session, inst = d.instance, read = s.state.puzzlesRead[d.puzzle] ?? [d.clue];
      const total = inst?.clues?.length ?? 0;
      el.append(h('h2', {}, t('pz.tablet.title')), h('p', { class: 'lore-text clue' }, inst ? clueText(inst, inst.clues[d.clue], t) : '…'));
      if (inst && s.mode === 'overworld') {
        el.append(h('div', { class: 'dim' }, t('pz.tablet.count', { n: read.length, total })));
        if (read.length > 1) el.append(h('h3', {}, t('ui.known_clues')), h('ul', {}, read.map((i) => h('li', {}, clueText(inst, inst.clues[i], t)))));
      }
      el.append(button(t('ui.close'), () => ui.close('tablet'), { cls: 'primary' }));
    },
    close() {},
  };
}

// ───────────────────────── gate status
export function gate(game, ui) {
  const el = h('div', { class: 'modal-small gate' });
  return {
    el, blocking: true,
    open(d) {
      clear(el);
      const st = game.session.gates.status(d.gate), def = game.session.registry.get(d.gate);
      el.append(h('h2', {}, t(`${d.gate}.name`)), h('div', { class: 'dim' }, st.open ? t('gate.status.open') : t('gate.status.sealed')));
      if (def.designed) el.append(h('p', {}, t('gate.designed')));
      el.append(h('ul', { class: 'reqs' }, st.reqs.map((r) => h('li', { class: r.met ? 'met' : 'unmet' }, `${r.met ? '✔' : '✖'} ${t(r.textKey)}${r.optional ? ` (${t('ui.optional')})` : ''}`))));
      el.append(button(t('ui.close'), () => ui.close('gate'), { cls: 'primary' }));
    },
    close() {},
  };
}

// ───────────────────────── epilogue
export function epilogue(game, ui) {
  const el = h('div', { class: 'epilogue' });
  return {
    el, blocking: true, noEscape: true,
    open() {
      clear(el);
      const s = game.session, st = s.state.stats, ch = s.character;
      const rows = [[t('ui.playtime'), fmtTime(ch.counters.playSeconds)], [t('ui.level'), ch.level], [t('ui.kills'), st.kills], [t('ui.deaths'), st.deaths], [t('ui.secrets'), st.secretsFound], [t('ui.dungeons_done'), st.dungeons], [t('ui.quests_done'), st.quests], [t('ui.codex'), `${s.codex.progress().codex[0]}/${s.codex.progress().codex[1]}`]];
      el.append(h('h1', {}, t('epilogue.title')), h('p', { class: 'epi-text' }, t('epilogue.text')),
        h('table', { class: 'epi-stats' }, rows.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, String(v))))),
        h('p', { class: 'dim' }, t('epilogue.designed')),
        h('div', { class: 'row' }, button(t('epilogue.keep'), () => ui.close('epilogue'), { cls: 'primary' }), button(t('ui.quit_title'), () => game.quitToTitle())));
    },
    close() { game.session?.autosaver; game.autosaver?.request('epilogue', true); },
  };
}

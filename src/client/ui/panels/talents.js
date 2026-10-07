import { h, button, clear, tabs } from '../dom.js';
import { t, i18n } from '../../../core/i18n.js';
import { modLine, esc } from '../itemText.js';

const BRANCH_COL = { core: '#e8dcc0', A: '#ff9a5a', B: '#7fe3ff', C: '#b6e84a' };
const KIND_R = { start: 17, minor: 8, notable: 13, transformer: 15, keystone: 19 };

function nodeName(tree, n) { const key = n.kind === 'minor' ? `tal.minor.${n.tmpl}` : `${n.id}.name`; return i18n.has(key) ? t(key) : n.id; }

export function talents(game, ui) {
  const el = h('div', { class: 'tal-root' });
  const canvas = h('canvas', { class: 'tal-canvas', tabindex: 0, 'aria-label': t('ui.talents') });
  const ctx = canvas.getContext('2d');
  let view = { x: 0, y: 0, k: 0.7 }, drag = null, hover = null, search = '', mode = 'tree', respecMode = false, raf = 0;

  const S = () => game.session, C = () => game.session.character;
  const tree = () => C().tree;

  const nodeHTML = (n) => {
    const tr = tree(), c = C();
    let html = `<div class="tt-name" style="color:${BRANCH_COL[n.branch] ?? '#fff'}">${esc(nodeName(tr, n))}</div><div class="tt-sub">${t(`ui.node_${n.kind}`)}${n.branch !== 'core' ? ` · ${t(`tal.branch.${c.classId.split('.')[1]}.${n.branch}`)}` : ''}${n.cost > 1 ? ` · ${n.cost} ${t('ui.points')}` : ''}</div>`;
    if (n.kind !== 'minor' && i18n.has(`${n.id}.desc`)) html += `<div class="tt-uniq">${esc(t(`${n.id}.desc`))}</div>`;
    for (const m of n.mods ?? []) html += `<div class="tt-line aff">${esc(modLine(game.statDefs, m, m.value))}</div>`;
    if (n.flags?.length) html += `<div class="tt-line uni">${n.flags.map((f) => esc(i18n.has(`flag.${f}`) ? t(`flag.${f}`) : f)).join(', ')}</div>`;
    if (n.excl) { const other = [...tr.nodes.values()].filter((x) => x.excl === n.excl && x.id !== n.id).map((x) => nodeName(tr, x)); html += `<div class="tt-flag">${t('ui.excl_with')}: ${esc(other.join(', '))}</div>`; }
    if (n.req?.level) html += `<div class="tt-req ${c.level < n.req.level ? 'bad' : ''}">${t('ui.req_level', { level: n.req.level })}</div>`;
    const alloc = c.alloc.has(n.id);
    const chk = alloc ? tr.canDeallocate(c.alloc, n.id) : tr.canAllocate(c.alloc, n.id, { points: c.talentPoints(), level: c.level });
    if (alloc) html += `<div class="tt-flag">${chk.ok ? t('ui.rclick_remove') : t(`ui.cant_${chk.reason}`)}</div>`;
    else html += `<div class="tt-flag">${chk.ok ? t('ui.click_alloc') : t(`ui.cant_${chk.reason}`)}</div>`;
    return html;
  };

  const worldToScreen = (x, y) => [(x + view.x) * view.k + canvas.width / 2 / dpr, (y + view.y) * view.k + canvas.height / 2 / dpr];
  const screenToWorld = (sx, sy) => [(sx - canvas.width / 2 / dpr) / view.k - view.x, (sy - canvas.height / 2 / dpr) / view.k - view.y];
  let dpr = 1;

  const draw = () => {
    raf = 0;
    if (!ui.isOpen('talents') || mode !== 'tree') return;
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    const tr = tree(), c = C();
    const q = search.trim().toLowerCase();
    // links
    for (const n of tr.nodes.values()) for (const l of n.links) {
      const m = tr.node(l); if (!m || m.id < n.id) continue;
      const [x1, y1] = worldToScreen(...n.pos), [x2, y2] = worldToScreen(...m.pos);
      const both = c.alloc.has(n.id) && c.alloc.has(m.id);
      ctx.strokeStyle = both ? (BRANCH_COL[m.branch === 'core' ? n.branch : m.branch] ?? '#fff') : 'rgba(120,130,150,.35)'; ctx.lineWidth = both ? 3.2 : 1.6;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    const pts = c.talentPoints();
    for (const n of tr.nodes.values()) {
      const [x, y] = worldToScreen(...n.pos), r = KIND_R[n.kind] * Math.min(1.3, Math.max(0.7, view.k));
      const on = c.alloc.has(n.id);
      const avail = !on && tr.canAllocate(c.alloc, n.id, { points: pts, level: c.level }).ok;
      const col = BRANCH_COL[n.branch] ?? '#fff';
      ctx.save(); ctx.translate(x, y);
      ctx.beginPath();
      if (n.kind === 'transformer') { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); }
      else if (n.kind === 'keystone') { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }
      else ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = on ? col : avail ? 'rgba(40,48,64,.95)' : 'rgba(22,26,34,.95)';
      ctx.fill();
      ctx.lineWidth = hover === n ? 4 : avail ? 3 : 2;
      ctx.strokeStyle = on ? '#fff' : avail ? col : 'rgba(110,120,140,.8)';
      ctx.stroke();
      if (q && (nodeName(tr, n).toLowerCase().includes(q) || (i18n.has(`${n.id}.desc`) && t(`${n.id}.desc`).toLowerCase().includes(q)))) { ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.stroke(); }
      if (n.kind === 'keystone' || n.kind === 'transformer') { ctx.fillStyle = on ? '#10131a' : col; ctx.font = `700 ${Math.round(r * 0.9)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.kind === 'keystone' ? '★' : '⟲', 0, 1); }
      ctx.restore();
      if (view.k > 0.55 && n.kind !== 'minor') { ctx.fillStyle = 'rgba(240,230,205,.9)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(nodeName(tr, n), x, y + r + 14); }
    }
    // branch labels
    ctx.font = '700 15px sans-serif'; ctx.textAlign = 'center';
    for (const b of ['A', 'B', 'C']) { const ns = [...tr.nodes.values()].filter((n) => n.branch === b); if (!ns.length) continue; const cx = ns.reduce((a, n) => a + n.pos[0], 0) / ns.length, cy = ns.reduce((a, n) => a + n.pos[1], 0) / ns.length; const [sx, sy] = worldToScreen(cx, cy); ctx.fillStyle = BRANCH_COL[b]; ctx.globalAlpha = 0.25; ctx.fillText(t(`tal.branch.${c.classId.split('.')[1]}.${b}`).toUpperCase(), sx, sy); ctx.globalAlpha = 1; }
  };
  const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };

  const pick = (sx, sy) => {
    const [wx, wy] = screenToWorld(sx, sy);
    let best = null, bd = Infinity;
    for (const n of tree().nodes.values()) { const d = Math.hypot(n.pos[0] - wx, n.pos[1] - wy); const r = KIND_R[n.kind] / view.k + 6 / view.k; if (d < r && d < bd) { bd = d; best = n; } }
    return best;
  };

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (drag) { view.x += (sx - drag.x) / view.k; view.y += (sy - drag.y) / view.k; drag.x = sx; drag.y = sy; drag.moved = true; redraw(); return; }
    const n = pick(sx, sy);
    if (n !== hover) { hover = n; if (n) ui.tip.show(nodeHTML(n)); else ui.tip.hide(); redraw(); }
  });
  canvas.addEventListener('mousedown', (e) => { const r = canvas.getBoundingClientRect(); drag = { x: e.clientX - r.left, y: e.clientY - r.top, moved: false, btn: e.button }; });
  window.addEventListener('mouseup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved) return;
    const r = canvas.getBoundingClientRect(), n = pick(e.clientX - r.left, e.clientY - r.top);
    if (n) act(n, d.btn === 2);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; const [bx, by] = screenToWorld(sx, sy); view.k = Math.min(1.6, Math.max(0.28, view.k * (e.deltaY < 0 ? 1.12 : 0.89))); const [ax, ay] = screenToWorld(sx, sy); view.x += ax - bx; view.y += ay - by; redraw(); }, { passive: false });
  canvas.addEventListener('mouseleave', () => { hover = null; ui.tip.hide(); redraw(); });

  const act = (n, remove) => {
    const S_ = S(), c = C();
    const res = remove || c.alloc.has(n.id) ? S_.deallocateTalent(n.id) : S_.allocateTalent(n.id);
    if (!res.ok) { game.toast(t(`ui.cant_${res.reason}`)); return; }
    game.audio.ui(remove ? 'close' : 'click'); rebuildHead(); ui.tip.show(nodeHTML(n)); redraw(); if (mode === 'list') renderList();
  };

  const head = h('div', { class: 'panel-head' });
  const body = h('div', { class: 'tal-body' });
  const list = h('div', { class: 'tal-list' });
  const rebuildHead = () => {
    clear(head);
    const c = C(), cost = c.respecCost();
    const searchIn = h('input', { type: 'search', placeholder: t('ui.search'), value: search, 'aria-label': t('ui.search') });
    searchIn.addEventListener('input', () => { search = searchIn.value; redraw(); if (mode === 'list') renderList(); });
    const tb = tabs([{ id: 'tree', label: t('ui.tal_tree') }, { id: 'list', label: t('ui.tal_list') }], (id) => { mode = id; canvas.style.display = id === 'tree' ? 'block' : 'none'; list.style.display = id === 'list' ? 'block' : 'none'; if (id === 'list') renderList(); else redraw(); }, mode);
    head.append(h('h2', {}, `${t('ui.talents')} — ${t(`${c.classId}.name`)}`), h('div', { class: 'points' }, `${t('ui.points_free')}: `, h('b', {}, String(c.talentPoints()))), tb.bar, searchIn,
      button(`${t('ui.respec')} (${cost} 🔔)`, () => ui.open('confirm', { text: t('ui.confirm_respec', { cost }), onYes: () => { const r = S().respec(); if (!r.ok) game.toast(t('toast.not_enough_chimes')); else game.toast(t('toast.respec_done')); rebuildHead(); redraw(); if (mode === 'list') renderList(); } }), { cls: respecMode ? 'primary' : '' }),
      button('✕', () => ui.close('talents'), { cls: 'x', title: t('ui.close') }));
    head.append(h('div', { class: 'legend' }, ['A', 'B', 'C'].map((b) => h('span', { style: { color: BRANCH_COL[b] } }, `● ${t(`tal.branch.${c.classId.split('.')[1]}.${b}`)}`)), h('span', {}, '◆ ' + t('ui.node_transformer')), h('span', {}, '⬢ ' + t('ui.node_keystone'))));
  };
  const renderList = () => {
    clear(list);
    const tr = tree(), c = C(), q = search.trim().toLowerCase();
    const groups = [['alloc', t('ui.allocated')], ['avail', t('ui.available')]];
    for (const [g, label] of groups) {
      list.append(h('h3', {}, label));
      for (const n of tr.nodes.values()) {
        if (n.kind === 'start') continue;
        const on = c.alloc.has(n.id), av = !on && tr.canAllocate(c.alloc, n.id, { points: c.talentPoints(), level: c.level }).ok;
        if ((g === 'alloc') !== on || (g === 'avail' && !av)) continue;
        const nm = nodeName(tr, n); if (q && !nm.toLowerCase().includes(q)) continue;
        const row = h('div', { class: 'tal-item' }, h('b', { style: { color: BRANCH_COL[n.branch] } }, nm), h('span', { class: 'dim' }, ` ${t(`ui.node_${n.kind}`)}`), h('div', { class: 'tal-desc', html: nodeHTML(n).replace(/<div class="tt-name".*?<\/div>/, '') }), button(on ? t('ui.remove') : t('ui.allocate'), () => act(n, on), { cls: 'small' }));
        list.append(row);
      }
    }
  };
  body.append(canvas, list);
  el.append(head, body);
  return {
    el, blocking: true,
    open(d) { respecMode = !!d?.respec; mode = document.documentElement.classList.contains('phone') ? 'list' : 'tree'; rebuildHead(); canvas.style.display = mode === 'tree' ? 'block' : 'none'; list.style.display = mode === 'list' ? 'block' : 'none'; if (mode === 'list') renderList(); const hub = tree().node(tree().start); view = { x: -hub.pos[0] + 0, y: 90, k: 0.62 }; redraw(); setTimeout(redraw, 50); if (respecMode) game.toast(t('ui.respec_hint')); },
    close() { ui.tip.hide(); },
    update() { if (ui.isOpen('talents') && mode === 'tree' && !raf) redraw(); },
  };
}

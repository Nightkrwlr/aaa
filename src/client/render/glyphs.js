/** Glyph painter — the eight Serrane symbols drawn with strokes (used by dials, stones, tablets and the codex UI). */
import * as THREE from 'three';

export const GLYPHS = ['circle_notch', 'tide', 'ember', 'wing', 'root', 'bell', 'eye_closed', 'spiral'];

/** draw glyph `name` centred in a size×size box */
export function drawGlyph(ctx, name, size, color = '#7fe3ff', lw = size / 14) {
  const c = size / 2, r = size * 0.36;
  ctx.save();
  ctx.translate(c, c); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (name) {
    case 'circle_notch': ctx.arc(0, 0, r, -Math.PI / 2 + 0.28, Math.PI * 1.5 - 0.28); break;
    case 'tide':
      for (let k = -1; k <= 1; k++) { ctx.moveTo(-r, k * r * 0.5); for (let i = 0; i <= 8; i++) ctx.lineTo(-r + (i / 8) * r * 2, k * r * 0.5 + Math.sin(i / 8 * Math.PI * 3) * r * 0.16); }
      break;
    case 'ember': ctx.moveTo(0, -r); ctx.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.8, r * 0.8, 0, r); ctx.bezierCurveTo(-r * 0.8, r * 0.8, -r * 0.9, -r * 0.2, 0, -r); ctx.moveTo(0, r * 0.1); ctx.quadraticCurveTo(r * 0.3, r * 0.45, 0, r * 0.7); break;
    case 'wing': ctx.moveTo(-r, r * 0.6); ctx.quadraticCurveTo(-r * 0.2, -r, r, -r * 0.7); for (let i = 0; i < 4; i++) { ctx.moveTo(-r * 0.6 + i * r * 0.35, r * 0.3 - i * r * 0.22); ctx.lineTo(-r * 0.2 + i * r * 0.4, r * 0.7 - i * r * 0.3); } break;
    case 'root': ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.2); ctx.moveTo(0, -r * 0.1); ctx.lineTo(-r * 0.7, r * 0.7); ctx.moveTo(0, r * 0.1); ctx.lineTo(r * 0.7, r * 0.8); ctx.moveTo(0, r * 0.2); ctx.lineTo(r * 0.1, r); break;
    case 'bell': ctx.moveTo(-r * 0.8, r * 0.6); ctx.quadraticCurveTo(-r * 0.8, -r * 0.9, 0, -r * 0.9); ctx.quadraticCurveTo(r * 0.8, -r * 0.9, r * 0.8, r * 0.6); ctx.lineTo(-r * 0.8, r * 0.6); ctx.moveTo(-r * 0.15, r * 0.85); ctx.lineTo(r * 0.15, r * 0.85); break;
    case 'eye_closed': ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, r * 0.9, r, 0); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * r * 0.38, r * 0.34 - Math.abs(i) * 0.03 * r); ctx.lineTo(i * r * 0.5, r * 0.75); } break;
    case 'spiral': for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 5, rr = (i / 60) * r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } break;
    default: ctx.rect(-r / 2, -r / 2, r, r);
  }
  ctx.stroke();
  ctx.restore();
}

const texCache = new Map();
/** emissive-friendly square texture of a glyph on a dark stone background */
export function glyphTexture(name, { color = '#7fe3ff', bg = '#1a1f28', size = 128 } = {}) {
  const key = `${name}|${color}|${bg}`;
  let t = texCache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  ctx.shadowColor = color; ctx.shadowBlur = size / 10;
  drawGlyph(ctx, name, size, color);
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData = { shared: true };
  texCache.set(key, t);
  return t;
}

export function glyphDataURL(name, size = 64, color = '#7fe3ff') {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'); drawGlyph(ctx, name, size, color, size / 12);
  return cv.toDataURL();
}

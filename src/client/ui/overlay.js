/** 2D overlay canvas: floating damage numbers, enemy health bars, name tags, markers (cheap, no DOM churn). */
export class Overlay {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.dpr = 1; }
  resize(w, h, dpr = Math.min(2, window.devicePixelRatio || 1)) { this.dpr = dpr; this.c.width = w * dpr; this.c.height = h * dpr; this.w = w; this.h = h; }
  begin() { const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h); c.textAlign = 'center'; c.textBaseline = 'middle'; }

  text(x, y, str, { size = 16, color = '#fff', stroke = '#000', alpha = 1, bold = true } = {}) {
    const c = this.ctx; c.globalAlpha = alpha;
    c.font = `${bold ? '700 ' : ''}${size}px 'Segoe UI', Arial, sans-serif`;
    c.lineWidth = Math.max(2, size / 5); c.strokeStyle = stroke; c.lineJoin = 'round';
    c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y); c.globalAlpha = 1;
  }

  bar(x, y, w, h, frac, { fill = '#c0392b', back = 'rgba(0,0,0,.65)', border = '#000', shield = 0, shieldColor = '#9fe8ff', ghost = null } = {}) {
    const c = this.ctx;
    c.fillStyle = back; c.fillRect(x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2);
    if (ghost !== null && ghost > frac) { c.fillStyle = 'rgba(255,238,200,.85)'; c.fillRect(x - w / 2, y - h / 2, w * Math.min(1, ghost), h); }   // the chunk you just took away lingers, then drains
    c.fillStyle = fill; c.fillRect(x - w / 2, y - h / 2, w * Math.max(0, Math.min(1, frac)), h);
    if (shield > 0) { c.fillStyle = shieldColor; c.fillRect(x - w / 2, y + h / 2 - 2, w * Math.min(1, shield), 2); }
    c.strokeStyle = border; c.lineWidth = 1; c.strokeRect(x - w / 2 - 0.5, y - h / 2 - 0.5, w + 1, h + 1);
  }

  diamond(x, y, r, color, alpha = 1) {
    const c = this.ctx; c.globalAlpha = alpha; c.fillStyle = color; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); c.stroke(); c.globalAlpha = 1;
  }
}

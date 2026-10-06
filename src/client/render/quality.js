export const PRESETS = {
  low:    { shadows: 0,    pixelRatio: 0.75, bloom: false, grass: 0.25, particles: 0.35, lights: 2, aa: false, drawDist: 80, post: false },
  medium: { shadows: 1024, pixelRatio: 1,    bloom: false, grass: 0.6,  particles: 0.7,  lights: 4, aa: true,  drawDist: 110, post: true },
  high:   { shadows: 2048, pixelRatio: 1.25, bloom: true,  grass: 1.0,  particles: 1.0,  lights: 6, aa: true,  drawDist: 150, post: true },
  ultra:  { shadows: 4096, pixelRatio: 2,    bloom: true,  grass: 1.0,  particles: 1.0,  lights: 8, aa: true,  drawDist: 200, post: true },
};
export function resolveQuality(name, scale = 1) {
  const q = { ...(PRESETS[name] ?? PRESETS.high) };
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  q.pixelRatio = Math.max(0.5, Math.min(q.pixelRatio, dpr) * scale);
  return q;
}

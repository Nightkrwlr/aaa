/**
 * Quality presets. Every knob degrades gracefully; LOW keeps the same art direction with the expensive layers off
 * (no shadow map → baked contact shadows only, no MSAA/bloom/AO, coarse terrain, fewer grass tufts, 2 real lights).
 *
 *   shadows     shadow-map size (0 = off)          shadowExtent  half-size of the follow-camera shadow frustum multiplier
 *   samples     MSAA samples of the HDR target     bloom / ao    post layers
 *   fine        terrain grid spacing in the zone   detail        terrain shader detail level (0 = fewest texture fetches)
 *   grass       grass/flower density multiplier    scatter       extra dressing (pebbles, tufts, ferns) multiplier
 *   lights      real point lights budget           shafts/dust   light shafts + floating motes
 *   drawDist    cull radius (m) for small instanced dressing
 */
export const PRESETS = {
  low:    { shadows: 0,    shadowExtent: 1, pixelRatio: 0.75, samples: 0, bloom: false, ao: false, aa: false, fine: 1.0, detail: 0, grass: 0.3,  scatter: 0.35, particles: 0.35, lights: 2, drawDist: 46, shafts: false, motes: 0,  post: true, mist: false, tilt: 0 },
  medium: { shadows: 1024, shadowExtent: 1, pixelRatio: 1,    samples: 2, bloom: false, ao: false, aa: true,  fine: 0.5, detail: 1, grass: 0.65, scatter: 0.7,  particles: 0.7,  lights: 4, drawDist: 62, shafts: true,  motes: 40, post: true, mist: true,  tilt: 0 },
  high:   { shadows: 2048, shadowExtent: 1, pixelRatio: 1.25, samples: 4, bloom: true,  ao: false, aa: true,  fine: 0.5, detail: 2, grass: 1.0,  scatter: 1.0,  particles: 1.0,  lights: 6, drawDist: 78, shafts: true,  motes: 90, post: true, mist: true,  tilt: 1 },
  ultra:  { shadows: 4096, shadowExtent: 1, pixelRatio: 2,    samples: 4, bloom: true,  ao: true,  aa: true,  fine: 0.5, detail: 2, grass: 1.0,  scatter: 1.25, particles: 1.0,  lights: 8, drawDist: 96, shafts: true,  motes: 140, post: true, mist: true, tilt: 1 },
};

export function resolveQuality(name, scale = 1) {
  const q = { ...(PRESETS[name] ?? PRESETS.high), name: PRESETS[name] ? name : 'high' };
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  q.pixelRatio = Math.max(0.5, Math.min(q.pixelRatio, dpr) * scale);
  return q;
}

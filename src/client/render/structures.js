/**
 * Structures & landmarks — the authored buildings of the Terraza Baja, built from procedural architecture (paint.js: bevelled
 * limestone blocks, tiled roofs, timber framing, emissive windows) plus KayKit set-dressing pieces, merged into a handful of draw
 * calls per structure. Every structure is a Group in its own local frame (+z = front), with optional
 *   userData.update(t, state, focus)  per-frame animation        PointLight children → budgeted by Scene3D (userData.flicker)
 * Footprints match data/world/props.json radii (the sim owns collision), so nothing blocks or clips differently than it looks.
 */
import * as THREE from 'three';
import { Paint, PAT } from './paint.js';
import { Build, windowParts, doorParts, lanternBracket, steps, crateStack, flowerBox, PI, TAU, CYAN, WARM, EMBER } from './structKit.js';
import { LANDMARKS, buildCanticle } from './landmarks.js';
export { buildCanticle };

// ───────────────────────────────────────────────────────── the structures
const BUILD = {
  /** the settlement's great hall: stone ground floor, jettied half-timbered upper floor, teal tiled roof, chimney, warm windows */
  hall(ctx) {
    const b = new Build(ctx, 'hall'), r = b.rng, s = b.solid;
    // foundation + ground floor
    s.box(7.8, 1.0, 6.2, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.05, g: [0.1, 0.9] });
    s.box(7.0, 2.7, 5.4, { pos: [0, 1.85, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.06, g: [0.05, 0.85] });
    for (const [x, z] of [[-3.5, 2.7], [3.5, 2.7], [-3.5, -2.7], [3.5, -2.7]]) s.box(0.55, 2.8, 0.55, { pos: [x, 1.9, z], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.05, tile: 1.1 });   // quoins
    // jetty beam + upper floor
    s.box(7.5, 0.3, 5.9, { pos: [0, 3.35, 0], mat: 'woodDark', pat: PAT.plank, bevel: 0.03 });
    s.box(7.0, 2.3, 5.4, { pos: [0, 4.65, 0], mat: 'plaster', pat: PAT.plaster, g: [0.1, 0.8] });
    for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) { s.box(0.2, 2.3, 0.14, { pos: [x, 4.65, 2.72], mat: 'woodDark' }); s.box(0.2, 2.3, 0.14, { pos: [x, 4.65, -2.72], mat: 'woodDark' }); }
    for (const z of [-2.7, 0, 2.7]) { s.box(0.14, 2.3, 0.2, { pos: [3.52, 4.65, z], mat: 'woodDark' }); s.box(0.14, 2.3, 0.2, { pos: [-3.52, 4.65, z], mat: 'woodDark' }); }
    s.box(7.1, 0.18, 0.16, { pos: [0, 4.65, 2.74], mat: 'woodDark' }); s.box(7.1, 0.18, 0.16, { pos: [0, 5.7, 2.74], mat: 'woodDark' });
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) s.box(0.12, 1.3, 0.1, { pos: [sx * (0.9 + i * 1.8), 4.65, 2.76], rot: [0, 0, sx * 0.6], mat: 'woodDark' });
    // roof
    b.solid.gable(7.0, 5.4, 2.7, { pos: [0, 5.8, 0], overhang: 0.6, mat: 'slateTeal', ridgeMat: 'slateTeal', gableMat: 'plaster', thick: 0.2, tile: 1 });
    // dormer
    s.box(1.5, 1.2, 1.1, { pos: [0, 6.5, 1.55], mat: 'plaster', pat: PAT.plaster });
    s.gable(1.5, 1.2, 0.8, { pos: [0, 7.1, 1.55], yaw: PI / 2, overhang: 0.2, mat: 'slateTeal', ridgeMat: 'slateTeal', thick: 0.1 });
    // chimney
    s.box(1.0, 3.4, 1.0, { pos: [2.3, 6.4, -0.9], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.04, g: [0.1, 0.8] }); s.box(1.25, 0.25, 1.25, { pos: [2.3, 8.2, -0.9], mat: 'limestone', bevel: 0.04 });
    b.smoke([2.3, 8.35, -0.9], 8, 0.62);
    // door with steps and a notched-ring sign ("the Rest")
    b.put(doorParts(1.6, 2.5), [0, 1.0, 2.7]);
    b.put({ solid: steps(2.6, 3, 0.25, 0.42) }, [0, 0.55, 2.7 + 0.25]);
    const sign = new Paint(); sign.box(0.07, 0.07, 0.9, { pos: [0, 0, 0.45], mat: 'iron' }); sign.box(0.07, 0.07, 0.07, { pos: [0, 0, 0.9], mat: 'iron' }); sign.torus(0.34, 0.06, 6, 18, { pos: [0, -0.62, 0.9], mat: 'brass', g: [0.1, 0.7] }); sign.box(0.16, 0.18, 0.1, { pos: [0.3, -0.5, 0.9], mat: 'limestone' });
    b.put({ solid: sign }, [0, 4.15, 2.72]);
    b.put(lanternBracket(), [-1.55, 3.0, 2.72]); b.put(lanternBracket(), [1.55, 3.0, 2.72]);
    b.halo([-1.55, 2.8, 3.27], WARM, 1.5).halo([1.55, 2.8, 3.27], WARM, 1.5).floorGlow([-1.5, 1.08, 3.7], WARM, 4).floorGlow([1.5, 1.08, 3.7], WARM, 4);
    // windows: ground floor flanking the door, upper floor, side
    for (const x of [-2.4, 2.4]) b.put(windowParts(1.0, 1.3), [x, 1.95, 2.7]);
    for (const x of [-2.3, 0, 2.3]) b.put(windowParts(0.95, 1.2, { shutters: x !== 0 }), [x, 4.7, 2.72]);
    for (const x of [-2.4, 2.4]) b.put({ solid: flowerBox(1.3) }, [x, 1.15, 2.95]);
    b.put(windowParts(0.9, 1.2), [3.5, 2.0, 0.6], PI / 2); b.put(windowParts(0.9, 1.2), [3.5, 4.7, -0.6], PI / 2); b.put(windowParts(0.9, 1.2), [-3.5, 2.0, -0.4], -PI / 2);
    b.halo([-2.4, 1.95, 2.9], WARM, 1.5).halo([2.4, 1.95, 2.9], WARM, 1.5).halo([-2.3, 4.7, 2.9], WARM, 1.3).halo([2.3, 4.7, 2.9], WARM, 1.3).halo([0, 4.7, 2.9], WARM, 1.3);
    // woodshed lean-to on the right + barrels, crates, bench
    const shed = new Paint();
    for (const [x, z] of [[0.1, 0.1], [2.0, 0.1], [0.1, 2.0], [2.0, 2.0]]) shed.box(0.16, 2.0, 0.16, { pos: [x, 1.0, z], mat: 'woodDark' });
    shed.box(2.5, 0.12, 2.6, { pos: [1.05, 2.05, 1.05], rot: [-0.18, 0, 0], mat: 'woodLight', pat: PAT.plank });
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4 - j; i++) shed.cyl(0.2, 0.2, 1.6, 7, { pos: [0.35 + i * 0.4 + j * 0.2, 0.22 + j * 0.34, 0.5], rot: [0, 0, PI / 2], mat: 'woodLight', g: [0.2, 0.7] });
    b.put({ solid: shed }, [3.55, 0.45, -1.8], 0);
    b.kit('dungeon/barrel_large', { pos: [-4.45, 0.45, 2.3], ry: 0.5, s: 0.62 }).kit('dungeon/barrel_small', { pos: [-4.5, 0.45, 1.1], ry: 1.2, s: 0.8 }).kit('dungeon/box_small', { pos: [-4.3, 0.45, 3.4], ry: 0.2, s: 0.8 }).kit('dungeon/box_small', { pos: [-4.35, 1.25, 3.35], ry: 0.7, s: 0.62 });
    b.kit('graveyard/bench', { pos: [3.1, 0.45, 3.5], ry: 0.15, s: 0.9 });
    b.light(WARM, 5, 12, [0, 2.6, 4.2]);
    return b.finish();
  },

  /** round cottage: stone drum, tiled/thatched cone roof, arched door, shuttered window, chimney — variant by position */
  hut(ctx) {
    const b = new Build(ctx, `hut${ctx.seed ?? ''}`), r = b.rng, s = b.solid;
    const v = Math.floor(r.next() * 3), roof = ['terracotta', 'slateTeal', 'thatch'][v], wall = ['limestone', 'plasterWarm', 'limestoneLight'][Math.floor(r.next() * 3)];
    s.cyl(2.7, 2.8, 0.9, 10, { pos: [0, 0.0, 0], mat: 'limestoneDark', pat: PAT.stone, g: [0.1, 0.9] });
    s.cyl(2.3, 2.45, 2.55, 10, { pos: [0, 1.7, 0], mat: wall, pat: wall === 'plasterWarm' ? PAT.plaster : PAT.stone, g: [0.05, 0.85] });
    s.cyl(2.55, 2.45, 0.22, 10, { pos: [0, 3.05, 0], mat: 'woodDark', pat: PAT.plank });
    s.cone(3.35, 2.7, 10, { pos: [0, 4.55, 0], mat: roof, pat: roof === 'thatch' ? PAT.thatch : PAT.tile, g: [0.1, 0.85], tile: 1 });
    s.cyl(0.0, 0.16, 0.7, 6, { pos: [0, 6.2, 0], mat: 'brass' }); s.sphere(0.2, 8, 6, { pos: [0, 6.5, 0], mat: 'brass' });
    s.box(0.7, 1.9, 0.7, { pos: [1.2, 4.7, -0.9], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.04 }); s.box(0.9, 0.18, 0.9, { pos: [1.2, 5.7, -0.9], mat: 'limestone', bevel: 0.03 });
    b.smoke([1.2, 5.85, -0.9], 6, 0.5);
    b.put(doorParts(1.15, 2.1), [0, 1.0, 2.62]);
    b.put({ solid: steps(1.8, 2, 0.22, 0.4) }, [0, 0.5, 2.62 + 0.3]);
    for (const a of [0.95, -0.95, 3.1]) { const x = Math.sin(a) * 2.34, z = Math.cos(a) * 2.34; b.put(windowParts(0.75, 0.95, { shutters: a !== 3.1 }), [x, 2.05, z], a); b.halo([Math.sin(a) * 2.6, 2.05, Math.cos(a) * 2.6], WARM, 1.25); }
    b.put(lanternBracket(), [1.35, 3.0, 2.58]);
    b.halo([1.35, 2.78, 3.12], WARM, 1.3).floorGlow([1.3, 0.62, 3.4], WARM, 3.2);
    b.kit('dungeon/barrel_small', { pos: [-1.7, 0.45, 2.6], ry: 0.4, s: 0.85 }).kit('dungeon/box_small', { pos: [-2.4, 0.45, 1.9], ry: 0.9, s: 0.7 });
    if (v === 1) b.put({ solid: flowerBox(1.1) }, [-1.9, 0.62, 2.4], 0.4);
    b.light(WARM, 3.2, 9, [0, 2.4, 3.6]);
    return b.finish();
  },

  /** merchant's striped market tent with a counter, wares and a hanging lantern */
  tent(ctx) {
    const b = new Build(ctx, 'tent'), s = b.solid, r = b.rng;
    const n = 8, W = 4.4, D = 3.4, H = 2.7;
    for (let i = 0; i < n; i++) { const stripe = i % 2 ? 'clothCream' : 'clothRed'; s.gable(W / n, D, H, { pos: [-W / 2 + (i + 0.5) * W / n, 0.0, 0], yaw: 0, overhang: 0.0, mat: stripe, ridgeMat: stripe, pat: PAT.none, gables: false, thick: 0.07, tile: 0.01 }); }
    // front awning
    s.box(W + 0.4, 0.07, 1.6, { pos: [0, 2.5, 2.1], rot: [0.32, 0, 0], mat: 'clothRed', g: [0.2, 0.7] });
    for (const x of [-1, 1]) { s.cyl(0.07, 0.09, 3.1, 6, { pos: [x * (W / 2 + 0.2), 1.55, 2.75], mat: 'woodDark' }); s.cyl(0.04, 0.04, 1.4, 5, { pos: [x * (W / 2 + 0.2), 2.45, 2.0], rot: [PI / 2, 0, 0], mat: 'woodDark' }); }
    s.cyl(0.05, 0.05, W + 0.6, 6, { pos: [0, H + 0.12, 0], rot: [0, 0, PI / 2], mat: 'woodDark' });
    for (const x of [-1, 1]) s.sphere(0.12, 6, 4, { pos: [x * (W / 2 + 0.3), H + 0.14, 0], mat: 'brass' });
    // counter + wares
    s.box(3.2, 0.12, 1.05, { pos: [0, 1.0, 1.7], mat: 'wood', pat: PAT.plank, bevel: 0.02 }); s.box(3.0, 0.9, 0.9, { pos: [0, 0.5, 1.7], mat: 'woodDark', pat: PAT.plank });
    s.box(3.3, 0.1, 1.15, { pos: [0, 1.08, 1.7], mat: 'clothCream' });
    for (let i = 0; i < 6; i++) { s.cyl(0.085, 0.09, 0.28, 8, { pos: [-1.2 + i * 0.22, 1.28, 1.55], mat: ['glassCyan', 'clothRed', 'moss', 'brass', 'clothPurple', 'ember'][i], g: [0.2, 0.8] }); }
    s.box(0.5, 0.3, 0.38, { pos: [0.8, 1.27, 1.9], mat: 'woodLight', pat: PAT.plank, bevel: 0.02 }); s.sphere(0.12, 6, 4, { pos: [0.7, 1.46, 1.9], mat: 'clothGold' }); s.sphere(0.12, 6, 4, { pos: [0.9, 1.46, 1.92], mat: 'terracotta' });
    b.kit('dungeon/barrel_large', { pos: [-2.9, 0.0, 0.5], ry: 0.3, s: 0.7 }).kit('dungeon/crates_stacked', { pos: [2.8, 0.0, 0.4], ry: -0.4, s: 0.55 }).kit('dungeon/barrel_small', { pos: [-2.7, 0.0, 1.8], ry: 1.0, s: 0.85 });
    b.put(lanternBracket(), [0, 2.8, 2.2], 0); b.halo([0, 2.35, 2.75], WARM, 1.6).floorGlow([0, 0.1, 3.1], WARM, 4.2);
    b.light(WARM, 4, 10, [0, 2.2, 3.2]);
    return b.finish();
  },

  /** open smithy: stone hearth with glowing coals, chimney + hood, anvil on a stump, bellows, quench barrel, tool rack, lean-to roof */
  forge(ctx) {
    const b = new Build(ctx, 'forge'), s = b.solid, g = b.glow;
    s.box(2.3, 1.0, 1.45, { pos: [0, 0.3, -0.05], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.05, g: [0.1, 0.9] });
    s.box(1.7, 0.1, 0.95, { pos: [0, 0.84, -0.05], mat: 'soot' });
    g.box(1.35, 0.12, 0.7, { pos: [0, 0.9, -0.02], mat: 'ember', g: [0.55, 1.0] });
    for (let i = 0; i < 6; i++) g.ico(0.1, 0, { pos: [-0.5 + i * 0.2, 1.0, -0.05 + (i % 2) * 0.12], mat: 'ember', g: [0.2, 0.9], scale: [1, 0.7, 1] });
    s.box(2.1, 2.3, 0.55, { pos: [0, 1.4, -0.82], mat: 'limestone', pat: PAT.stone, bevel: 0.05, g: [0.1, 0.9] });
    s.box(1.0, 2.9, 0.95, { pos: [0.1, 3.5, -0.8], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.04, g: [0.1, 0.8] }); s.box(1.25, 0.22, 1.2, { pos: [0.1, 5.0, -0.8], mat: 'limestone', bevel: 0.04 });
    b.smoke([0.1, 5.15, -0.8], 8, 0.7);
    s.box(1.9, 0.16, 1.2, { pos: [0, 2.0, -0.18], rot: [-0.35, 0, 0], mat: 'iron', g: [0.1, 0.7] });
    // anvil on a stump
    s.cyl(0.34, 0.42, 0.6, 8, { pos: [1.45, 0.3, 0.85], mat: 'woodDark', pat: PAT.plank, g: [0.2, 0.7] });
    s.box(0.34, 0.26, 0.26, { pos: [1.45, 0.73, 0.85], mat: 'iron' }); s.box(0.8, 0.16, 0.36, { pos: [1.45, 0.93, 0.85], mat: 'ironLight', bevel: 0.02 }); s.cone(0.12, 0.5, 6, { pos: [1.98, 0.93, 0.85], rot: [0, 0, -PI / 2], mat: 'ironLight' });
    // bellows
    s.box(0.18, 0.5, 0.9, { pos: [-1.35, 0.55, -0.2], rot: [0, 0.1, 0.1], mat: 'woodLight', pat: PAT.plank }); s.cone(0.34, 0.9, 6, { pos: [-1.35, 0.7, 0.4], rot: [PI / 2 + 0.1, 0, 0], mat: 'woodRed', g: [0.2, 0.8] });
    // tool rack on the back wall
    s.box(1.8, 0.08, 0.1, { pos: [0, 2.7, -0.5], mat: 'woodDark' });
    for (const x of [-0.6, 0.0, 0.6]) { s.box(0.07, 0.6, 0.07, { pos: [x, 2.35, -0.5], mat: 'woodDark' }); s.box(0.26, 0.16, 0.14, { pos: [x, 2.65, -0.5], mat: 'ironLight' }); }
    b.kit('dungeon/barrel_small', { pos: [-1.5, 0.0, 1.0], ry: 0.4, s: 0.78 }).kit('dungeon/sword_shield', { pos: [-0.9, 2.2, -1.06], s: 0.5 }).kit('dungeon/trunk_small_A', { pos: [1.9, 0.0, -0.2], ry: -0.4, s: 0.9 });
    // lean-to shed
    for (const x of [-1.55, 1.9]) s.box(0.16, 2.7, 0.16, { pos: [x, 1.35, 1.75], mat: 'woodDark' });
    s.box(4.2, 0.12, 2.5, { pos: [0.18, 2.78, 0.55], rot: [-0.16, 0, 0], mat: 'woodLight', pat: PAT.plank, g: [0.1, 0.7] });
    s.box(4.3, 0.2, 0.2, { pos: [0.18, 2.62, 1.78], mat: 'woodDark' });
    b.halo([0, 1.15, 0.3], EMBER, 2.6).floorGlow([0, 0.05, 0.6], EMBER, 5.2);
    const l = b.light(EMBER, 9, 13, [0, 1.5, 0.5], true);
    b.onUpdate((t) => { l.intensity = 8 + Math.sin(t * 13) * 1.4 + Math.sin(t * 7.3) * 0.9; });
    return b.finish();
  },

  /** alchemist's bench: bubbling flasks that glow, shelf of bottles, mortar, scales, hanging herbs, small canopy */
  alchemy_table(ctx) {
    const b = new Build(ctx, 'alchemy'), s = b.solid, g = b.glow, r = b.rng;
    s.box(2.2, 0.13, 1.1, { pos: [0, 0.98, 0], mat: 'woodLight', pat: PAT.plank, bevel: 0.02 });
    for (const [x, z] of [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]]) s.box(0.13, 0.95, 0.13, { pos: [x, 0.47, z], mat: 'woodDark' });
    s.box(1.9, 0.07, 0.8, { pos: [0, 0.35, 0], mat: 'wood', pat: PAT.plank });
    // back shelf
    for (const x of [-1.05, 1.05]) s.box(0.1, 2.6, 0.1, { pos: [x, 1.3, -0.7], mat: 'woodDark' });
    for (const y of [1.55, 2.2]) s.box(2.2, 0.08, 0.4, { pos: [0, y, -0.7], mat: 'woodLight', pat: PAT.plank });
    ['bottle_A_green', 'bottle_B_brown', 'bottle_C_green', 'bottle_A_brown', 'bottle_B_green', 'bottle_C_brown'].forEach((k, i) => b.kit(`dungeon/${k}`, { pos: [-0.85 + (i % 3) * 0.78 + (i > 2 ? 0.25 : 0), i > 2 ? 2.24 : 1.59, -0.7], ry: r.range(0, 6), s: 0.62 }));
    // flasks (emissive liquids)
    const fl = [['water', -0.7, 0.1, 0.2], ['ember', 0.05, 0.15, 0.17], ['grassBase', 0.6, -0.05, 0.19]];
    for (const [m, x, z, rad] of fl) { g.sphere(rad, 8, 6, { pos: [x, 1.05 + rad + 0.04, z], mat: m, g: [0.1, 0.9] }); s.cyl(0.06, 0.07, 0.24, 6, { pos: [x, 1.05 + rad * 2 + 0.1, z], mat: 'glassCyan', g: [0.1, 0.5] }); s.cyl(0.05, 0.05, 0.05, 6, { pos: [x, 1.05 + rad * 2 + 0.24, z], mat: 'woodDark' }); }
    s.torus(0.22, 0.025, 5, 12, { pos: [-0.2, 1.3, -0.25], rot: [PI / 2, 0, 0], mat: 'bronze' }); s.cyl(0.14, 0.14, 0.34, 8, { pos: [-0.2, 1.2, -0.25], mat: 'bronze', g: [0.1, 0.8] });
    s.cyl(0.17, 0.12, 0.14, 8, { pos: [0.95, 1.1, 0.25], mat: 'rockWarm' }); s.cyl(0.03, 0.04, 0.3, 5, { pos: [0.97, 1.28, 0.25], rot: [0.5, 0, 0.3], mat: 'woodLight' });
    s.box(0.4, 0.08, 0.3, { pos: [-0.9, 1.08, -0.1], mat: 'clothRed' }); s.box(0.4, 0.08, 0.3, { pos: [-0.9, 1.16, -0.08], rot: [0, 0.2, 0], mat: 'clothBlue' });
    g.cyl(0.03, 0.03, 0.18, 5, { pos: [0.3, 1.14, 0.38], mat: 'glowWarm' }); b.halo([0.3, 1.32, 0.38], WARM, 0.8);
    // hanging herbs + canopy
    s.cyl(0.04, 0.04, 2.4, 5, { pos: [0, 2.7, -0.4], rot: [0, 0, PI / 2], mat: 'woodDark' });
    for (let i = 0; i < 5; i++) { const x = -0.9 + i * 0.45; s.cyl(0.015, 0.015, 0.4, 4, { pos: [x, 2.45, -0.4], mat: 'rope' }); s.cone(0.14, 0.5, 5, { pos: [x, 2.0, -0.4], rot: [PI, 0, 0], mat: ['leaf', 'moss', 'leafTeal', 'thatch', 'leaf'][i], g: [0.1, 0.9] }); }
    s.box(2.6, 0.06, 1.8, { pos: [0, 2.95, -0.1], rot: [0.12, 0, 0], mat: 'clothTeal', g: [0.2, 0.8] });
    b.kit('dungeon/stool', { pos: [1.5, 0, 0.9], ry: 0.6, s: 0.9 });
    b.halo([-0.7, 1.4, 0.1], '#7affc0', 1.3).halo([0.6, 1.4, -0.05], '#88ff88', 1.1);
    b.light('#8fffb8', 3.2, 7, [0, 1.8, 0.6]);
    return b.finish();
  },

  /** the stash: a great iron-banded chest on a carved plinth with a glowing resonance plate and candles */
  stash_chest(ctx) {
    const b = new Build(ctx, 'stash'), s = b.solid, g = b.glow;
    s.box(2.1, 0.34, 1.6, { pos: [0, 0.17, 0], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.05 }); s.box(1.9, 0.12, 1.4, { pos: [0, 0.38, 0], mat: 'limestone', bevel: 0.03 });
    b.kit('dungeon/chest', { pos: [0, 0.44, 0], s: 0.95, fallback: (bb) => { bb.solid.box(1.5, 0.8, 0.95, { pos: [0, 0.85, 0], mat: 'wood', pat: PAT.plank, bevel: 0.05 }); bb.solid.cyl(0.48, 0.48, 1.5, 8, { pos: [0, 1.25, 0], rot: [0, 0, PI / 2], mat: 'wood', pat: PAT.plank }); } });
    g.box(0.5, 0.12, 0.04, { pos: [0, 0.2, 0.82], mat: 'glassCyan' }); g.box(0.06, 0.5, 0.04, { pos: [0, 0.2, 0.82], mat: 'glassCyan' });
    for (const x of [-0.85, 0.85]) { b.kit('dungeon/candle_lit', { pos: [x, 0.44, 0.5], s: 0.85 }); b.halo([x, 1.0, 0.5], WARM, 0.8); }
    g.cyl(1.0, 1.0, 0.02, 18, { pos: [0, 0.02, 0], mat: 'glassCyan', g: [0.0, 0.1] });
    b.halo([0, 0.7, 0.9], CYAN, 1.5).floorGlow([0, 0.04, 0.2], CYAN, 4.2);
    b.light(CYAN, 2.5, 6, [0, 1.4, 1.2]);
    return b.finish();
  },

  /** the great bell of Orrel's Ledge: bronze bell in a limestone frame, resonance circle on the ground; the bell sways */
  bell_post(ctx) {
    const b = new Build(ctx, 'bell'), s = b.solid, g = b.glow;
    for (const x of [-1.25, 1.25]) {
      s.box(0.95, 0.5, 0.95, { pos: [x, 0.15, 0], mat: 'limestoneDark', pat: PAT.stone, bevel: 0.05 });
      s.box(0.62, 4.0, 0.62, { pos: [x, 2.3, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.05, g: [0.05, 0.9] });
      s.box(0.9, 0.34, 0.9, { pos: [x, 4.45, 0], mat: 'limestoneLight', pat: PAT.stone, bevel: 0.05 });
      s.box(0.72, 0.18, 0.72, { pos: [x, 3.0, 0], mat: 'brass' });
    }
    s.box(3.5, 0.55, 0.8, { pos: [0, 4.75, 0], mat: 'limestone', pat: PAT.stone, bevel: 0.06 }); s.box(3.7, 0.2, 0.95, { pos: [0, 5.1, 0], mat: 'limestoneLight', bevel: 0.05 });
    s.cyl(0.08, 0.08, 3.0, 8, { pos: [0, 4.4, 0], rot: [0, 0, PI / 2], mat: 'iron' });
    // bell (lathe profile)
    const pts = [[0.0, 0.0], [0.28, -0.02], [0.4, -0.35], [0.5, -0.75], [0.66, -1.15], [0.78, -1.45], [0.82, -1.5], [0.7, -1.52], [0.64, -1.35], [0.5, -1.0], [0.36, -0.55], [0.0, -0.3]];
    const lathe = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 14);
    const bell = new Build(ctx, 'bellpart'); bell.solid.add(lathe, { mat: 'brass', g: [0.1, 0.95], yr: [-1.5, 0] });
    bell.solid.torus(0.8, 0.05, 5, 14, { pos: [0, -1.5, 0], rot: [PI / 2, 0, 0], mat: 'bronze' });
    bell.solid.sphere(0.2, 7, 5, { pos: [0, -1.55, 0], mat: 'bronze' }); bell.solid.cyl(0.04, 0.04, 1.1, 5, { pos: [0, -1.0, 0], mat: 'iron' });
    const mesh = bell.finish(); mesh.position.set(0, 4.5, 0); b.add(mesh);
    b.onUpdate((t) => { mesh.rotation.z = Math.sin(t * 0.9) * 0.05; });
    // resonance circle
    g.add(new THREE.RingGeometry(1.85, 2.0, 40).rotateX(-PI / 2), { pos: [0, 0.03, 0], mat: 'glassCyan', g: [0.8, 1.0] }); g.add(new THREE.RingGeometry(1.45, 1.52, 40).rotateX(-PI / 2), { pos: [0, 0.03, 0], mat: 'glassCyan', g: [0.8, 1.0] });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.box(0.1, 0.03, 0.34, { pos: [Math.sin(a) * 2.3, 0.04, Math.cos(a) * 2.3], rot: [0, a, 0], mat: 'glassCyan', g: [0.7, 1.0] }); }
    b.floorGlow([0, 0.06, 0], CYAN, 5.0);
    b.light(CYAN, 3, 9, [0, 1.2, 1.5]);
    return b.finish();
  },

  /** lamp post: KayKit hanging lantern post + a real flame glow */
  lantern(ctx) {
    const b = new Build(ctx, 'lamp');
    const had = !!b.wa?.geo('graveyard/post_lantern');
    b.kit('graveyard/post_lantern', { s: 0.9, fallback: (bb) => { bb.solid.cyl(0.08, 0.1, 2.6, 6, { pos: [0, 1.3, 0], mat: 'iron' }); bb.solid.box(0.4, 0.5, 0.4, { pos: [0, 2.6, 0], mat: 'iron' }); } });
    const lx = 0, lz = had ? 1.0 : 0, ly = had ? 2.38 : 2.6;
    b.glow.box(0.2, 0.3, 0.2, { pos: [lx, ly, lz], mat: 'glowWarm' });
    b.halo([lx, ly + 0.05, lz + 0.1], WARM, 1.9).floorGlow([lx, 0.07, lz + 0.2], WARM, 5.2);
    const l = b.light(WARM, 5, 10, [lx, ly, lz + 0.2], true);
    const ph = b.rng.next() * 6;
    b.onUpdate((t) => { l.intensity = 4.4 + Math.sin(t * 9 + ph) * 0.5; });
    return b.finish();
  },

  /** pennant on a pole (kit banner that waves from its top edge) */
  banner(ctx) {
    const b = new Build(ctx, 'banner'), s = b.solid;
    s.cyl(0.07, 0.09, 4.0, 6, { pos: [0, 2.0, 0], mat: 'woodDark', pat: PAT.plank }); s.sphere(0.12, 6, 5, { pos: [0, 4.05, 0], mat: 'brass' });
    s.box(1.5, 0.08, 0.1, { pos: [0.5, 3.75, 0], mat: 'woodDark' });
    b.cloth('dungeon/banner_red', { pos: [0.5, 0.15, 0.02], ry: 0, s: 1.0, swayHeight: 3.75, amt: 1.4 });
    return b.finish();
  },
};

const ALL = { ...BUILD, ...LANDMARKS };

/** build a structure group by prop kind (null when the kind has no authored look) */
export function buildStructure(kind, ctx = {}) {
  const f = ALL[kind];
  if (!f) return null;
  try { const obj = f(ctx); obj.userData.kind = kind; return obj; } catch (e) { console.warn(`structure ${kind} failed`, e); return null; }
}

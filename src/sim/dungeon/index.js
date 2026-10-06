import { Rng, hashString, seedToCode } from '../../core/rng.js';
import { logger } from '../../core/logger.js';
import { buildGraph, simulateProgress } from './graph.js';
import { placeOnLattice, rasterize } from './embed.js';
import { placeContent } from './content.js';
import { validateDungeon } from './validate.js';

const log = logger('dungeon');

/**
 * Generate a dungeon. Fully deterministic for (family, seed, size, objective, modifiers, ilvl).
 * Retries internal sub-seeds (`seed#attempt`) until validation passes — the same call always returns the same result.
 * @returns {{ok:boolean, dungeon?:any, errors:string[], attempts:number}}
 */
export function generateDungeon(registry, spec) {
  const family = registry.require(spec.family, 'dungeonFamily');
  const size = spec.size ?? 'medium';
  const objective = spec.objective ?? pickObjective(registry, new Rng(`${spec.seed}:obj`));
  const modifiers = spec.modifiers ?? pickModifiers(registry, family, new Rng(`${spec.seed}:mod`));
  const allErrors = [];
  for (let attempt = 0; attempt < (spec.maxAttempts ?? 24); attempt++) {
    const rng = new Rng(`${spec.seed}|${family.id}|${size}|${objective}#${attempt}`);
    try {
      const graph = buildGraph(registry, family, { size, objective }, rng.fork('graph'));
      const sim = simulateProgress(graph);
      if (!sim.ok) { allErrors.push(...sim.errors.map((e) => `a${attempt} graph: ${e}`)); continue; }
      const placement = placeOnLattice(graph, rng.fork('place'));
      if (!placement) { allErrors.push(`a${attempt} lattice placement failed`); continue; }
      const ras = rasterize(graph, placement, family, rng.fork('raster'));
      if (!ras.ok) { allErrors.push(`a${attempt} raster: ${ras.error}`); continue; }
      const content = placeContent(registry, family, graph, ras.map, ras.rooms, rng.fork('content'), { ilvl: spec.ilvl ?? 1, difficulty: spec.difficulty, modifiers, boss: spec.boss, narrative: spec.narrative, storyNpc: spec.storyNpc });
      const dungeon = { id: `dgn_${hashString(`${spec.seed}${family.id}${size}${objective}`).toString(36)}`, seed: spec.seed, code: seedToCode(hashString(String(spec.seed))), spec: spec.specId ?? null, family: family.id, size, objective, modifiers, ilvl: spec.ilvl ?? 1, attempt, graph, map: ras.map, rooms: ras.rooms, content, placement: { W: placement.W, H: placement.H } };
      const errs = validateDungeon(registry, dungeon);
      if (errs.length) { allErrors.push(...errs.map((e) => `a${attempt} validate: ${e}`)); continue; }
      return { ok: true, dungeon, errors: [], attempts: attempt + 1 };
    } catch (err) {
      allErrors.push(`a${attempt} exception: ${err.message}`);
      log.debug(err.stack);
    }
  }
  return { ok: false, errors: allErrors.slice(-12), attempts: spec.maxAttempts ?? 24 };
}

function pickObjective(registry, rng) { return rng.weighted(registry.all('dungeonObjective'), (o) => o.weight).id; }
function pickModifiers(registry, family, rng) {
  const n = rng.int(0, 2);
  const pool = family.modifiers.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) { const k = rng.int(0, pool.length - 1); out.push(pool.splice(k, 1)[0]); }
  return out;
}

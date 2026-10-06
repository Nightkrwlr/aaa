import { freshRegistry } from '../../src/core/nodeLoader.js';
import { GameSession } from '../../src/sim/session.js';

let regCache = null;
export const sreg = () => (regCache ??= freshRegistry());

export function makeSession({ seed = 'test-session', classId = 'cls.belfry', level = 1, settings = {} } = {}) {
  const s = new GameSession({ registry: sreg(), seed, classId, settings });
  if (level > 1) s.character.level = level;
  s.start();
  return s;
}
export const tick = (s, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) s.update(1 / 60); };
export const teleport = (s, x, z) => { s.player.x = x; s.player.z = z; s.player.vx = s.player.vz = 0; };
export const ia = (s, id) => s.interactables.find((o) => o.id === id);
/** run a real kill through the world (events, XP, loot, quests) without playing the fight */
export const slay = (s, e) => { s.world.kill(e, s.player); };
export const talk = (s, npcId) => {
  const o = ia(s, npcId); teleport(s, o.x, o.z + 1.2); tick(s, 0.1);
  return s.interact(o);
};
/** advance a dialogue by always picking the first enabled choice, or "continue" */
export function talkThrough(s, npcId, picks = []) {
  const r = talk(s, npcId); let view = r.dialogue, guard = 0;
  const seen = [];
  while (view && guard++ < 40) {
    seen.push(view.node);
    if (!view.choices.length) { view = s.dialogue.advance(null); continue; }
    const idx = picks.length ? picks.shift() : view.choices[view.choices.length - 1].index;
    view = s.dialogue.advance(idx);
  }
  return seen;
}
/** hear the first cylinder (tutorial step) */
export function hearCylinder(s) {
  const c = ia(s, 'poi.voice_cylinder_1'); teleport(s, c.x, c.z); tick(s, 0.1); s.interact(c);
}

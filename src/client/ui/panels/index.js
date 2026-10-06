import { title } from './title.js';
import { dialogue } from './dialogue.js';
import { pause, death, lore, tablet, gate, epilogue, confirmBox } from './small.js';
import { inventory } from './inventory.js';
import { talents } from './talents.js';
import { skills } from './skills.js';
import { quests } from './quests.js';
import { mapPanel } from './map.js';
import { codex } from './codex.js';
import { shop } from './shop.js';
import { craft } from './craft.js';
import { stash } from './stash.js';
import { settings } from './settings.js';
import { rift } from './rift.js';
import { dev } from './dev.js';

export function registerPanels(ui) {
  const all = { title, dialogue, pause, death, lore, tablet, gate, epilogue, confirm: confirmBox, inventory, talents, skills, quests, map: mapPanel, codex, shop, craft, stash, settings, rift };
  if (typeof __DEV_TOOLS__ !== 'undefined' && __DEV_TOOLS__) all.dev = dev;
  for (const [id, f] of Object.entries(all)) ui.register(id, f);
}

/**
 * DialogueSystem — conversation graphs per NPC with conditions, effects and memory.
 * dialogue: { npc, roots:[{id,cond,priority}], nodes:{ id:{ textKey, speaker?, choices:[{textKey,cond,effects,next}], next, effects } } }
 * The hub picks the highest-priority root whose condition holds, so NPCs react to what you've done.
 */
import { applyEffects } from './effects.js';
import { checkCond } from './state.js';

export class DialogueSystem {
  constructor(session) { this.s = session; this.current = null; }

  forNpc(npcId) { return this.s.registry.all('dialogue').find((d) => d.npc === npcId); }

  /** @returns {{npc,node,text,choices:[{index,textKey,enabled}]}|null} */
  start(npcId) {
    const d = this.forNpc(npcId); if (!d) return null;
    const roots = d.roots.filter((r) => checkCond(this.s, r.cond)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    if (!roots.length) return null;
    this.current = { dialogue: d, npc: npcId };
    this.s.state.npcMemory[npcId] ??= {};
    this.s.state.npcMemory[npcId].met = true;
    this.s.events.emit('talk', { npc: npcId });
    return this.#enter(roots[0].id);
  }

  #enter(nodeId) {
    const { dialogue } = this.current;
    const node = dialogue.nodes[nodeId];
    if (!node) { this.end(); return null; }
    this.current.node = nodeId;
    applyEffects(this.s, node.effects);
    const choices = (node.choices ?? []).map((c, index) => ({ index, textKey: c.textKey, enabled: checkCond(this.s, c.cond), hidden: c.hideIfDisabled && !checkCond(this.s, c.cond) })).filter((c) => !c.hidden);
    const view = { npc: this.current.npc, node: nodeId, textKey: node.textKey, speaker: node.speaker ?? this.current.npc, choices, hasNext: !!node.next && !choices.length, params: node.params };
    this.current.view = view;
    return view;
  }

  /** choose option i (index in the original choice list) or continue (null) */
  advance(choiceIndex = null) {
    if (!this.current) return null;
    const node = this.current.dialogue.nodes[this.current.node];
    if (choiceIndex === null) { if (node.next) return this.#enter(node.next); this.end(); return null; }
    const c = node.choices?.[choiceIndex];
    if (!c || !checkCond(this.s, c.cond)) return this.current.view;
    applyEffects(this.s, c.effects);
    if (c.next) return this.#enter(c.next);
    this.end(); return null;
  }

  end() { if (this.current) this.s.events.emit('talk:end', { npc: this.current.npc }); this.current = null; }
}

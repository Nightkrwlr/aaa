/** Turn a tone_logic clue into a locale key + params (names are locale keys; the UI translates them). Pure. */
export function clueParts(inst, clue) {
  const n = (i) => `pz.name.${inst.names[i]}`;
  const a = clue.args;
  switch (clue.kind) {
    case 'before': case 'adjacent': case 'notAdjacent': return { key: `pz.clue.${clue.kind}`, names: { a: n(a[0]), b: n(a[1]) }, nums: {} };
    case 'notFirst': case 'notLast': case 'first': case 'last': return { key: `pz.clue.${clue.kind}`, names: { a: n(a[0]) }, nums: {} };
    case 'between': return { key: 'pz.clue.between', names: { a: n(a[0]), b: n(a[1]), c: n(a[2]) }, nums: {} };
    case 'exactly': return { key: 'pz.clue.exactly', names: { a: n(a[0]) }, nums: { k: a[1] + 1 } };
    case 'gap': return { key: 'pz.clue.gap', names: { a: n(a[0]), b: n(a[1]) }, nums: { m: a[2] - 1 } };
    default: return { key: 'pz.clue.before', names: {}, nums: {} };
  }
}
export function clueText(inst, clue, t) {
  const p = clueParts(inst, clue);
  const params = { ...p.nums };
  for (const [k, v] of Object.entries(p.names)) params[k] = t(v);
  return t(p.key, params);
}

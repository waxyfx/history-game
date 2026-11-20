// What E acts on, on the real builds. Where an object and a person share a spot (the rope and the bound hunter Zhebei,
// the musket rack and its sentry, …) both must be reachable by walking up and turning towards them; every object must be
// reachable from somewhere (the Zhebei bug: the rope's reach ended just short of where a player naturally stands).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const pad = n => String(n).padStart(2, '0');
async function level(n) {
  const w = await WebAssembly.compile(await readFile(new URL(`../public/engine/rpg/tarikh-rpg${n === 1 ? '' : '-' + n}.wasm`, import.meta.url)));
  const e = {...new WebAssembly.Instance(w, {}).exports}; e._initialize?.(); e.tj_init(); e.tj_groups(0);
  const MAP = (await import(`../src/rpg/gen/map${pad(n)}.js`))[`MAP${pad(n)}`];
  return {e, MAP};
}
// Every spot around (x, y) within `reach` px and every facing: which targets can E pick?
function targets(e, MAP, x, y, reach = 34) {
  const seen = new Set();
  for (let r = 4; r <= reach; r += 3) for (let k = 0; k < 16; k++) {
    const px = Math.round(x + Math.cos(k * Math.PI / 8) * r), py = Math.round(y + Math.sin(k * Math.PI / 8) * r);
    if (e.tj_solid(px, py)) continue;
    for (let f = 0; f < 8; f++) {
      e.tj_teleport(px, py); e.tj_face(f); e.tj_heal(100); e.tj_tick(); e.tj_events_clear();
      const kind = e.tj_state(25), id = e.tj_state(26);
      if (kind === 0) seen.add('ia:' + MAP.interacts[id]); else if (kind === 1) seen.add('npc:' + MAP.npcs[id]);
    }
  }
  return seen;
}
const SHARED = [[1, 'rope', 'hunter'], [1, 'toolpile', 'crafter'], [4, 'envoypost', 'envoy'], [5, 'qinthrone', 'qin'],
  [8, 'keys', 'tilmash'], [8, 'primer', 'teacher'], [8, 'musketrack', 'sentry8'], [10, 'halldoor', 'twin10']];

for (const [n, ia, npc] of SHARED) test(`MAP${pad(n)}: «${ia}» and ${npc} on one spot — E reaches both`, async () => {
  const {e, MAP} = await level(n);
  const i = MAP.interacts.indexOf(ia), j = MAP.npcs.indexOf(npc);
  assert(i >= 0 && j >= 0, 'both exist');
  e.tj_ia(i, 1, 0); e.tj_npc_flags(j, 1, 0, 0);
  const [x, y] = MAP.interactPos[ia];
  e.tj_npc_set(j, Math.round(MAP.npcPos[npc][0]), Math.round(MAP.npcPos[npc][1]), 4, 0, 1);   // hold the NPC at home
  e.tj_npc_flags(j, 1, 0, 0);
  const seen = targets(e, MAP, x, y);
  assert(seen.has('ia:' + ia), `the object is reachable: ${[...seen]}`);
  assert(seen.has('npc:' + npc), `the person is reachable: ${[...seen]}`);
});

test('MAP01: Zhebei\'s rope is in reach from below, beside and above him', async () => {
  const {e, MAP} = await level(1);
  const i = MAP.interacts.indexOf('rope'), j = MAP.npcs.indexOf('hunter');
  e.tj_ia(i, 1, 120); e.tj_npc_flags(j, 0, 0, 0);
  const [hx, hy] = MAP.npcPos.hunter;
  for (const [dx, dy, f, where] of [[0, 22, 0, 'below'], [-20, 4, 2, 'left'], [20, 4, 6, 'right'], [0, -16, 4, 'above']]) {
    if (e.tj_solid(Math.round(hx + dx), Math.round(hy + dy))) continue;
    e.tj_teleport(Math.round(hx + dx), Math.round(hy + dy)); e.tj_face(f); e.tj_tick(); e.tj_events_clear();
    assert.equal(MAP.interacts[e.tj_state(26)], 'rope', 'standing ' + where);
  }
});

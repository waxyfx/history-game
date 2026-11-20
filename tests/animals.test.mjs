// Animals on the real builds: no stutter. A herd must not flicker between walking and standing (the bug: an animal
// pushing against a fence toggled its walk animation every few ticks), nor spin its facing. Measured over 10 s of game
// time after the double init the game does (boot + new game), with the hero walking past the herd.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function engine(n) {
  const w = await WebAssembly.compile(await readFile(new URL(`../public/engine/rpg/tarikh-rpg${n === 1 ? '' : '-' + n}.wasm`, import.meta.url)));
  const e = {...new WebAssembly.Instance(w, {}).exports}; e._initialize?.(); e.tj_init(); e.tj_init(); return e;
}
for (const n of [1, 2, 3, 5]) test(`MAP0${n}: animals walk and stand without flicker`, async () => {
  const e = await engine(n), ids = [];
  for (let i = 0; i < 64 && e.tj_animal(i, 6) >= 0; i++) ids.push(i);
  if (!ids.length) return;
  const ax = e.tj_animal(ids[0], 0) / 1000, ay = e.tj_animal(ids[0], 1) / 1000;
  e.tj_teleport(Math.round(ax + 70), Math.round(ay));
  const anim = ids.map(i => e.tj_animal(i, 3)), face = ids.map(i => e.tj_animal(i, 2)), sw = ids.map(() => 0), turns = ids.map(() => 0);
  for (let t = 0; t < 600; t++) {
    e.tj_input((t / 100 | 0) % 2 ? 4 : 8); e.tj_heal(100); e.tj_tick(); e.tj_events_clear();
    ids.forEach((i, k) => { const a = e.tj_animal(i, 3), f = e.tj_animal(i, 2);
      if (a !== anim[k]) { sw[k]++; anim[k] = a; } if (f !== face[k]) { turns[k]++; face[k] = f; } });
  }
  assert(Math.max(...sw) <= 14, `animation switches per animal in 10 s: ${sw}`);
  assert(Math.max(...turns) <= 20, `facing changes per animal in 10 s: ${turns}`);
});

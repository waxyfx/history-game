import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const module = await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg.wasm', import.meta.url)));
function start() { const e = new WebAssembly.Instance(module, {}).exports; e._initialize?.(); e.tj_init(); return e; }
const words = e => { const n = e.tj_save(); return [...new Uint32Array(e.memory.buffer, e.tj_save_buffer(), n / 4)]; };
const load = (e, w) => { new Uint32Array(e.memory.buffer, e.tj_save_buffer(), w.length).set(w); return e.tj_load(w.length * 4); };

test('Save v3 round-trips position, inventory, story tags and enemies', () => {
  const a = start();
  a.tj_teleport(32 * 16, 44 * 16); a.tj_item_add(3, 1); a.tj_item_add(4, 7); a.tj_tag(2, 1); a.tj_ia(5, 1, 0); a.tj_damage(30);
  const w = words(a);
  assert.equal(w.length, 54);
  const b = start();
  assert.equal(load(b, w), 1);
  assert.equal(b.tj_state(2), 1); assert.equal(b.tj_state(8), 70); assert.equal(b.tj_item_count(4), 7);
  assert.deepEqual(words(b), w);
});

test('Save v3 rejects corrupt, oversized and prototype (v1/v2) saves without changing state', () => {
  const e = start(), w = words(e);
  const bad = [...w]; bad[7] = 999;
  assert.equal(load(e, bad), -1, 'checksum');
  const old = [...w]; old[1] = 2;
  assert.equal(load(e, old), -2, 'old prototype version');
  assert.equal(e.tj_load(97 * 4), -1, 'oversized length');
  assert.equal(e.tj_state(8), 100);
});

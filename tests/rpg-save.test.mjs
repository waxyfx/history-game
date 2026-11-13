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
  assert.equal(w.length, 59);
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

test('Save v3: MAP01 saves written before MAP02 (14 items, 54 words) still load', () => {
  const a = start();
  a.tj_teleport(32 * 16, 44 * 16); a.tj_item_add(3, 1); a.tj_item_add(4, 9);
  const cur = words(a);
  // Rebuild the legacy layout: header + 14 item counts + enemies, same FNV-1a checksum (word 3 excluded).
  const legacy = [...cur.slice(0, 24 + 14), ...cur.slice(24 + 19)];
  legacy[2] = legacy.length;
  let h = 2166136261;
  for (let i = 0; i < legacy.length; i++) if (i !== 3) for (let s = 0; s < 32; s += 8) { h ^= (legacy[i] >>> s) & 255; h = Math.imul(h, 16777619) >>> 0; }
  legacy[3] = h;
  assert.equal(legacy.length, 54);
  const b = start();
  assert.equal(load(b, legacy), 1);
  assert.equal(b.tj_item_count(4), 9); assert.equal(b.tj_item_count(3), 1); assert.equal(b.tj_item_count(15), 0);
});

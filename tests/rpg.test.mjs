import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {decodePNG} from '../src/rpg/png.js';

const binary = await readFile(new URL('../public/engine/rpg/tarikh-rpg.wasm', import.meta.url));
const module = await WebAssembly.compile(binary);
const atlas = await decodePNG(await readFile(new URL('../public/art/rpg/atlas.png', import.meta.url)), async b => inflateSync(b));
const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8, INTERACT = 16, STRIKE = 32;
function start(withAtlas = true) {
  const e = new WebAssembly.Instance(module, {}).exports;
  e._initialize?.();
  if (withAtlas) { new Uint8Array(e.memory.buffer, e.tj_atlas(), atlas.data.length).set(atlas.data); e.tj_atlas_ready(1); }
  e.tj_init();
  return e;
}
const pos = e => [e.tj_state(0) / 1000, e.tj_state(1) / 1000];
const tick = (e, n = 1) => { for (let i = 0; i < n; i++) e.tj_tick(); };
const move = (e, keys, n) => { e.tj_input(keys); tick(e, n); e.tj_input(0); };
const events = e => { const out = []; for (let i = 0; i < e.tj_event_count(); i++) out.push([e.tj_event(i, 0), e.tj_event(i, 1), e.tj_event(i, 2)]); e.tj_events_clear(); return out; };

test('RPG WASM: standalone module, atlas matches engine, opaque varied frame', () => {
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  const e = start();
  assert.equal(atlas.width, e.tj_atlas_size(0)); assert.equal(atlas.height, e.tj_atlas_size(1));
  e.tj_render();
  const px = new Uint8Array(e.memory.buffer, e.tj_pixels(), 480 * 320 * 4).slice();
  for (let i = 3; i < px.length; i += 4) assert.equal(px[i], 255);
  assert(new Set(new Uint32Array(px.buffer)).size > 200, 'Sprite art produces a rich palette');
  assert.equal(e.tj_state(11), 480); assert.equal(e.tj_state(12), 320);
});

test('RPG WASM: eight headings move with normalized speed; Shift runs faster', () => {
  const dirs = [[UP, 0, 0, -1], [UP | RIGHT, 1, 1, -1], [RIGHT, 2, 1, 0], [DOWN | RIGHT, 3, 1, 1], [DOWN, 4, 0, 1], [DOWN | LEFT, 5, -1, 1], [LEFT, 6, -1, 0], [UP | LEFT, 7, -1, -1]];
  for (const [keys, facing, sx, sy] of dirs) {
    const e = start(false), [x, y] = pos(e);
    move(e, keys, 10);
    const [nx, ny] = pos(e);
    assert.equal(Math.sign(Math.round(nx - x)), sx); assert.equal(Math.sign(Math.round(ny - y)), sy);
    assert.equal(e.tj_state(3), facing);
    assert(Math.abs(Math.hypot(nx - x, ny - y) - 11.5) < .01, 'walk speed 1.15 px/tick in every direction');
  }
  const e = start(false), [x] = pos(e);
  move(e, RIGHT | 64, 10);
  assert(Math.abs(pos(e)[0] - x - 18) < .01, 'run speed 1.8 px/tick');
});

test('RPG WASM: map border, water and props collide; pause freezes simulation', () => {
  const e = start(false);
  move(e, LEFT, 600);
  const [x] = pos(e);
  assert(x > 16 && x < 60, 'border cliffs stop the player');
  assert.equal(e.tj_tile(-1, 0), -1);
  assert.equal(e.tj_solid(0, 0), 1);
  const t = e.tj_state(10);
  e.tj_pause(1); tick(e, 50); assert.equal(e.tj_state(10), t);
  e.tj_pause(0); tick(e, 5); assert.equal(e.tj_state(10), t + 5);
});

test('RPG WASM: interactables emit events only when enabled; hold interactions need time', () => {
  const e = start(false);
  // page1 is interactable index 0 at (240,800).
  e.tj_ia(0, 1, 0); e.tj_teleport(240, 812); e.tj_face(0); events(e);
  e.tj_input(INTERACT); tick(e, 2); e.tj_input(0); tick(e, 1);
  assert(events(e).some(([t, a, b]) => t === 2 && a === 0 && b === 0), 'press E emits EV_INTERACT');
  e.tj_ia(0, 1, 60); tick(e, 20);
  e.tj_input(INTERACT); tick(e, 30); e.tj_input(0); tick(e, 1);
  assert(!events(e).some(([t, , b]) => t === 2 && b & 0x10000), 'released hold does not complete');
  e.tj_input(INTERACT); tick(e, 70); e.tj_input(0);
  assert(events(e).some(([t, , b]) => t === 2 && (b & 0x10000)), 'full hold completes');
  e.tj_ia(0, 0, 0); tick(e, 20); e.tj_input(INTERACT); tick(e, 2); e.tj_input(0);
  assert(!events(e).some(([t]) => t === 2), 'disabled interactable is ignored');
});

test('RPG WASM: zone changes, triggers and teleport into the secret cave', () => {
  const e = start(false); events(e);
  e.tj_teleport(32 * 16, 41 * 16 + 40); tick(e, 2);
  const ev = events(e);
  assert.equal(e.tj_state(2), 1);
  assert(ev.some(([t, a]) => t === 3 && a === 0), 'settlement trigger fires');
  e.tj_teleport(25 * 16, 104.5 * 16); tick(e, 1);
  assert.equal(e.tj_state(2), 5); assert.equal(e.tj_state(35), 1, 'cave area');
  assert(e.tj_state(7) & (1 << 5));
});

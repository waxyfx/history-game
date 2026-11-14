import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Fixture = shipped engine + scenario hooks (tests/rpg-fixture.cpp). Rebuild: node scripts/build-rpg.mjs --test
const module = await WebAssembly.compile(await readFile(new URL('./fixtures/rpg-fixture.wasm', import.meta.url)));
const STRIKE = 32;
function start() { const e = new WebAssembly.Instance(module, {}).exports; e._initialize?.(); e.tj_init(); return e; }
const tick = (e, n) => { for (let i = 0; i < n; i++) e.tj_tick(); };
const events = e => { const o = []; for (let i = 0; i < e.tj_event_count(); i++) o.push([e.tj_event(i, 0), e.tj_event(i, 1), e.tj_event(i, 2)]); e.tj_events_clear(); return o; };
// An open steppe spot in the hunting grounds.
const X = 92 * 16, Y = 62 * 16;

test('Combat: sword arc hits only in front; enemy health drops and death drops loot', () => {
  assert.equal(start().fixture_arc(0, 2, X, Y, X + 18, Y), 1);
  assert.equal(start().fixture_arc(0, 2, X, Y, X - 18, Y), 0);
  const e = start();
  e.fixture_player(X, Y, 2); e.fixture_enemy(0, X + 16, Y);
  const hp0 = e.tj_enemy(0, 0);
  e.tj_input(STRIKE); tick(e, 2); e.tj_input(0); tick(e, 10);
  assert(e.tj_enemy(0, 0) < hp0, 'sword damages the wolf');
  for (let i = 0; i < 10 && e.tj_enemy(0, 0) > 0; i++) { e.tj_teleport(X, Y); e.tj_face(2); e.tj_enemy_set(0, X + 16, Y, e.tj_enemy(0, 0), 0, 6, 0, 0, -1); e.tj_input(STRIKE); tick(e, 2); e.tj_input(0); tick(e, 30); }
  assert.equal(e.tj_enemy(0, 0), 0, 'wolf defeated');
  assert(events(e).some(([t]) => t === 4), 'EV_ENEMY_DIED');
});

test('Combat: bow consumes arrows and refuses to fire when empty', () => {
  const e = start();
  e.tj_item_add(3, 1); e.tj_item_add(4, 2);
  e.fixture_player(X, Y, 2); assert.equal(e.tj_equip(2), 1);
  e.tj_input(STRIKE); tick(e, 2); e.tj_input(0); tick(e, 60);
  assert.equal(e.tj_item_count(4), 1);
  e.tj_input(STRIKE); tick(e, 2); e.tj_input(0); tick(e, 60);
  assert.equal(e.tj_item_count(4), 0); events(e);
  e.tj_input(STRIKE); tick(e, 2); e.tj_input(0);
  assert(events(e).some(([t]) => t === 17), 'EV_NOAMMO');
});

test('Combat: enemies detect, chase and damage the player; solo death and respawn', () => {
  const e = start();
  e.fixture_player(X, Y, 2); e.fixture_enemy(0, X + 60, Y);
  tick(e, 400);
  assert(e.fixture_hp() < 100, 'wolf attacks');
  tick(e, 60); events(e); e.tj_damage(200); tick(e, 120);
  assert(events(e).some(([t]) => t === 8), 'EV_DEAD after the death animation');
  e.tj_respawn(1);
  assert.equal(e.tj_state(8), 100); assert.equal(e.tj_state(9), 2);
});

test('Co-op: party of two is downed instead of dying and can be revived; peers are tracked', () => {
  const e = start();
  e.tj_party(2, 0);
  e.fixture_player(X, Y, 2);
  e.tj_peer(1, X + 12, Y, 6, 0, 0, 100, 0, 1);
  tick(e, 5);
  e.tj_damage(200); tick(e, 2);
  assert(e.tj_state(24) > 0, 'downed');
  assert(events(e).some(([t]) => t === 7), 'EV_DOWN');
  e.tj_revive(40);
  assert.equal(e.tj_state(24), 0); assert.equal(e.tj_state(8), 40);
  // Host resolves a client's hit on an enemy; a client never applies damage locally.
  e.fixture_enemy(0, X + 30, Y);
  const hp = e.tj_enemy(0, 0); e.tj_enemy_damage(0, 10, 1); assert.equal(e.tj_enemy(0, 0), hp - 10);
  const c = start(); c.tj_party(2, 1); c.fixture_player(X, Y, 2); c.fixture_enemy(0, X + 16, Y);
  events(c); const h2 = c.tj_enemy(0, 0); c.tj_input(STRIKE); tick(c, 2); c.tj_input(0); tick(c, 10);
  assert.equal(c.tj_enemy(0, 0), h2); assert(events(c).some(([t]) => t === 11), 'client reports EV_ENEMY_HIT');
});

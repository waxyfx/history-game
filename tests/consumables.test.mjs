// Shared consumables and timed effects (src/rpg/effects.hpp): pickup, quantity, healing, buffs,
// stacking, expiry, save/load and backwards compatibility, on both epochs' engines.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONSUMABLES, EFFECTS, BELT_ORDER} from '../src/rpg/effects.js';
import {ITEMS, ITEM_ICONS} from '../src/rpg/i18n.js';
import {validateSnapshot} from '../src/rpg/persistence.js';
import {persistence as p2} from '../src/rpg/level2.js';
import {createQuest, newFlags} from '../src/rpg/quest.js';
import {MAP01} from '../src/rpg/gen/map01.js';
import {MAP02} from '../src/rpg/gen/map02.js';

const wasm1 = await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg.wasm', import.meta.url)));
const wasm2 = await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg-2.wasm', import.meta.url)));
const start = (m = wasm1) => { const e = new WebAssembly.Instance(m, {}).exports; e._initialize?.(); e.tj_init(); return e; };
const IT = {kit: 5, herb: 9, herbbig: 20, strength: 21, guard: 22, swift: 23, coal: 24, curd: 25};
const hp = e => e.tj_state(8);
const words = e => { const n = e.tj_save(); return [...new Uint32Array(e.memory.buffer, e.tj_save_buffer(), n / 4)]; };
const load = (e, w) => { new Uint32Array(e.memory.buffer, e.tj_save_buffer(), w.length).set(w); return e.tj_load(w.length * 4); };
const effects = e => [0, 1, 2, 3].map(s => [e.tj_effect(s, 0), e.tj_effect(s, 1)]).filter(([id]) => id > 0);
const run = (e, n) => { for (let i = 0; i < n; i++) e.tj_tick(); };
// Fresh hero in the open steppe with no invulnerability window left.
function hero(m) { const e = start(m); run(e, 200); return e; }

test('Pickup: walking over a consumable adds it to the inventory once, up to the item limit', () => {
  const e = hero();
  const [x, y] = [e.tj_state(0) / 1000, e.tj_state(1) / 1000];
  e.tj_spawn_item(IT.strength, 1, Math.round(x), Math.round(y));
  run(e, 2);
  assert.equal(e.tj_item_count(IT.strength), 1);
  e.tj_item_add(IT.strength, 10);
  assert.equal(e.tj_item_count(IT.strength), 3, 'strong infusions are capped at 3');
  e.tj_spawn_item(IT.strength, 1, Math.round(x), Math.round(y)); run(e, 2);
  assert.equal(e.tj_item_count(IT.strength), 3, 'a full stack leaves the pickup on the ground');
});

test('Healing: restores HP, never above max HP, consumes one item, refused at full health', () => {
  const e = hero();
  e.tj_item_add(IT.herb, 2); e.tj_item_add(IT.herbbig, 1);
  assert.equal(e.tj_use(IT.herb), -3, 'no waste at full health');
  assert.equal(e.tj_item_count(IT.herb), 2);
  e.tj_damage(40); assert.equal(hp(e), 60);
  assert.equal(e.tj_use(IT.herb), 1); assert.equal(hp(e), 85); assert.equal(e.tj_item_count(IT.herb), 1);
  assert.equal(e.tj_use(IT.herbbig), -2, 'shared cooldown between consumables');
  run(e, 41);
  assert.equal(e.tj_use(IT.herbbig), 1); assert.equal(hp(e), 100, 'capped at max HP'); assert.equal(e.tj_item_count(IT.herbbig), 0);
  run(e, 41);
  assert.equal(e.tj_use(IT.herbbig), 0, 'nothing left to use');
});

test('Damage buff: +30% for 15 s, then expires and damage returns to normal', () => {
  const e = hero();
  e.tj_item_add(IT.strength, 1);
  assert.equal(e.tj_state(41), 0);
  assert.equal(e.tj_use(IT.strength), 1);
  assert.equal(e.tj_item_count(IT.strength), 0, 'consumed');
  assert.equal(e.tj_state(41), 30);
  assert.deepEqual(effects(e), [[1, 900]]);
  // Real hit on a wolf: base sword damage vs buffed damage.
  const strike = buffed => {
    const g = start(); run(g, 200); g.tj_item_add(IT.strength, 1); if (buffed) g.tj_use(IT.strength);
    g.tj_groups(0xffff);
    const ex = g.tj_enemy(0, 2) / 1000, ey = g.tj_enemy(0, 3) / 1000, before = g.tj_enemy(0, 0);
    g.tj_teleport(Math.round(ex - 14), Math.round(ey)); g.tj_face(2);
    g.tj_input(32); g.tj_tick(); g.tj_input(0); run(g, 30);
    return before - g.tj_enemy(0, 0);
  };
  const base = strike(false), boosted = strike(true);
  assert(base > 0, 'the sword hits');
  assert.equal(boosted, Math.floor(base * 130 / 100), `buffed hit ${boosted} = base ${base} × 1.3`);
  run(e, 899);
  assert.equal(e.tj_state(41), 30, 'still active one tick before the end');
  run(e, 1);
  assert.equal(e.tj_state(41), 0, 'expired');
  assert.deepEqual(effects(e), []);
});

test('Defense buff: incoming damage −25% (never below 1); speed buff: +20% movement', () => {
  const e = hero();
  e.tj_item_add(IT.guard, 1); e.tj_use(IT.guard);
  assert.equal(e.tj_state(42), 25);
  e.tj_damage(20); assert.equal(hp(e), 85, '20 × 0.75 = 15');
  const walk = buff => {
    const g = start(); run(g, 200);
    if (buff) { g.tj_item_add(IT.swift, 1); g.tj_use(IT.swift); }
    const x0 = g.tj_state(0); g.tj_input(8); run(g, 40); g.tj_input(0);
    return (g.tj_state(0) - x0) / 1000;
  };
  const normal = walk(false), fast = walk(true);
  assert(normal > 20, 'hero walks');
  assert(Math.abs(fast / normal - 1.2) < .03, `speed ratio ${fast / normal}`);
});

test('Stacking: the same buff refreshes instead of stacking; kinds are capped; death clears effects', () => {
  const e = hero();
  e.tj_item_add(IT.strength, 2); e.tj_item_add(IT.coal, 1);
  e.tj_use(IT.strength); run(e, 300);
  assert.deepEqual(effects(e), [[1, 600]]);
  e.tj_use(IT.strength);
  assert.deepEqual(effects(e), [[1, 900]], 'refreshed to the full duration, still one effect');
  assert.equal(e.tj_state(41), 30, 'magnitude did not double');
  run(e, 41); e.tj_use(IT.coal);
  assert.equal(e.tj_state(41), 55, 'strength + forge fire add up (30 + 25)…');
  assert(e.tj_state(41) <= 60, '…but never above the damage cap');
  e.tj_damage(200); run(e, 2);
  assert.deepEqual(effects(e), [], 'effects end when the hero falls');
});

test('Regeneration (dried curd): +3 HP per second for 10 s, capped at max HP', () => {
  const e = hero();
  e.tj_item_add(IT.curd, 1); e.tj_damage(50);
  e.tj_use(IT.curd);
  run(e, 600);
  assert.equal(hp(e), 80, '50 + 10 × 3');
  assert.deepEqual(effects(e), []);
});

test('Effects pause during cutscenes', () => {
  const e = hero();
  e.tj_item_add(IT.swift, 1); e.tj_use(IT.swift);
  e.tj_cinematic(1); run(e, 300); e.tj_cinematic(0);
  assert.deepEqual(effects(e), [[3, 720]]);
});

test('Save/load: inventory quantities, HP and active effects survive; MAP01 and MAP02 layouts', () => {
  for (const m of [wasm1, wasm2]) {
    const a = hero(m);
    a.tj_item_add(IT.herb, 3); a.tj_item_add(IT.guard, 2); a.tj_item_add(IT.strength, 1);
    a.tj_use(IT.strength); run(a, 100); a.tj_damage(30);
    const w = words(a);
    const b = start(m);
    assert.equal(load(b, w), 1);
    assert.equal(b.tj_item_count(IT.herb), 3); assert.equal(b.tj_item_count(IT.guard), 2); assert.equal(b.tj_item_count(IT.strength), 0);
    assert.equal(hp(b), hp(a));
    assert.deepEqual(effects(b), effects(a), 'active effect restored with its remaining time');
    const bad = [...w], i = w.length - 8; bad[i] = 99;   // unknown effect id
    let h = 2166136261; for (let k = 0; k < bad.length; k++) if (k !== 3) for (let s = 0; s < 32; s += 8) { h ^= (bad[k] >>> s) & 255; h = Math.imul(h, 16777619) >>> 0; }
    bad[3] = h;
    assert.equal(load(start(m), bad), -1, 'forged effect rejected');
  }
});

test('Backwards compatibility: MAP01 saves of 54 and 59 words still load (no effects, new items default to 0)', () => {
  const a = hero();
  a.tj_item_add(IT.herb, 4);
  const cur = words(a);
  assert.equal(cur.length, 73);
  const enemies = cur.slice(24 + 25, 24 + 25 + 16);
  for (const n of [14, 19]) {
    const old = [...cur.slice(0, 24 + n), ...enemies];
    old[2] = old.length;
    let h = 2166136261; for (let k = 0; k < old.length; k++) if (k !== 3) for (let s = 0; s < 32; s += 8) { h ^= (old[k] >>> s) & 255; h = Math.imul(h, 16777619) >>> 0; }
    old[3] = h;
    const b = start();
    assert.equal(load(b, old), 1, n + '-item save loads');
    assert.equal(b.tj_item_count(IT.herb), 4);
    assert.equal(b.tj_item_count(IT.strength), 0);
    assert.deepEqual(effects(b), []);
    const env = {v: 3, words: old, flags: {b: {}, talked: [], tracks: [], petro: [], quiz: {}, t0: 1}};
    assert.doesNotThrow(() => validateSnapshot(env), 'envelope accepts the old length ' + old.length);
  }
  assert.doesNotThrow(() => validateSnapshot({v: 3, words: cur, flags: {b: {}, quiz: {}}}));
  assert.throws(() => p2.validateSnapshot({v: 3, words: cur, flags: {b: {}, quiz: {}}}), /Invalid/, 'MAP01 words are not a MAP02 save');
});

test('Data: every consumable has a name, icon and belt slot; effects have labels; maps place them', () => {
  for (const id of Object.keys(CONSUMABLES).map(Number)) {
    assert(ITEMS.kk[id] && ITEMS.ru[id] && ITEM_ICONS[id], 'item ' + id);
    assert(BELT_ORDER.includes(id));
    const fx = CONSUMABLES[id].effect; if (fx) assert(EFFECTS[fx]?.kk && EFFECTS[fx]?.ru);
  }
  const e1 = start(), e2 = start(wasm2);
  for (const id of Object.keys(CONSUMABLES)) assert.equal(e1.tj_item_info(+id, 0), 2, 'consumable type in the engine: ' + id);
  // Pickups exist on both maps (static pickups are spawned at init).
  assert(MAP01 && MAP02);
  const count = e => { let n = 0; for (let i = 0; i < 64; i++) if (e.tj_item_count) n++; return n; };
  assert(count(e1) && count(e2));
});

test('Strong enemies drop valuable consumables (bear → big herb)', () => {
  const e = start(); e.tj_groups(0xffff); run(e, 2);
  const bear = MAP01.enemies.findIndex(x => x.type === 3);
  for (let i = 0; i < 80 && e.tj_enemy(bear, 0) > 0; i++) { e.tj_enemy_damage(bear, 40, 0); run(e, 3); }
  assert.equal(e.tj_enemy(bear, 0), 0);
  const [bx, by] = [e.tj_enemy(bear, 2) / 1000, e.tj_enemy(bear, 3) / 1000];   // loot lies where it fell
  for (const dx of [-9, 0, 9]) { e.tj_teleport(Math.round(bx + dx), Math.round(by)); run(e, 2); }
  assert.equal(e.tj_item_count(IT.herbbig), 1);
});

test('MAP01 → MAP02: the camp gate opens the next epoch only after a pass', async () => {
  const calls = [], said = [];
  const G = {E: {}, flags: newFlags(), local: {granted: [], seen: [], attempts: {}}, party: () => 1, lang: () => 'kk', area: () => 0,
    say: async l => { said.push(l); }, levelPassed: () => false, gotoLevel: n => calls.push(n), changed() {}, toast() {}};
  const q = createQuest(G);
  await q.interact('campgate');
  assert.deepEqual(calls, [], 'locked while MAP01 is not passed');
  G.levelPassed = () => true;
  await q.interact('campgate');
  assert.deepEqual(calls, [2], 'passed MAP01 leads to MAP02');
});

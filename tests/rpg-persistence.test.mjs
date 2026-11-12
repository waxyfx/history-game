import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {restoreSnapshot, validateSnapshot, SAVE_WORDS} from '../src/rpg/persistence.js';
const module = await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg.wasm', import.meta.url)));
function start() { const e = new WebAssembly.Instance(module, {}).exports; e._initialize?.(); e.tj_init(); return e; }
const flags = () => ({b: {}, talked: [], tracks: [], petro: [], quiz: {}, bonus: null, t0: 1, tEnd: 0});
function snapshot(e) { const n = e.tj_save(); return {v: 3, words: [...new Uint32Array(e.memory.buffer, e.tj_save_buffer(), n / 4)], flags: flags(), local: {}}; }
test('RPG envelope rejects malformed words BEFORE any WASM memory write', () => {
  const e = start(), original = snapshot(e), memory = new Uint8Array(e.memory.buffer).slice();
  assert.equal(original.words.length, SAVE_WORDS);
  for (const words of [Array(97).fill(0), Array(10000).fill(0), [], original.words.map((w, i) => i === 4 ? -1 : w), original.words.map((w, i) => i === 4 ? 1.5 : w)]) {
    assert.throws(() => restoreSnapshot(e, JSON.stringify({...original, words})));
    assert.deepEqual(new Uint8Array(e.memory.buffer), memory);
  }
});
test('RPG envelope validates story flags atomically (no forged quizzes, unknown ids or bad bonus)', () => {
  const e = start(), original = snapshot(e), memory = new Uint8Array(e.memory.buffer).slice();
  for (const f of [{quiz: {unknown: {a: 1, t: 1}}}, {quiz: {stone_main: {a: 0, t: 1}}}, {talked: ['crafter', 'crafter']}, {tracks: [9]}, {bonus: {correct: 6, t: 1}}, {b: {x: 'yes'}}, {b: []}]) {
    assert.throws(() => restoreSnapshot(e, JSON.stringify({...original, flags: {...flags(), ...f}})));
    assert.deepEqual(new Uint8Array(e.memory.buffer), memory);
  }
  assert.throws(() => restoreSnapshot(e, JSON.stringify({...original, v: 2})));
  assert.throws(() => restoreSnapshot(e, '{broken'));
  assert.throws(() => restoreSnapshot(e, ' '.repeat(32769)));
});
test('RPG envelope restores legitimate flags and native state together', () => {
  const e = start(), data = snapshot(e);
  data.flags.quiz = {stone_main: {a: 2, t: 5, by: 0}}; data.flags.b = {intro: true, page1: true}; data.local = {granted: ['page'], attempts: {stone_main: 2}};
  const r = restoreSnapshot(e, JSON.stringify(data));
  assert.equal(r.flags.quiz.stone_main.a, 2); assert.equal(r.flags.b.page1, true); assert.deepEqual(r.local.granted, ['page']);
  assert.equal(validateSnapshot(data).words.length, SAVE_WORDS);
});

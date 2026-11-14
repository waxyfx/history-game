import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuest, questStage, applyWorld} from '../src/rpg/quest04.js';
import {DIALOGUES, SIDES} from '../src/rpg/story04.js';

function game() {
  const items = [], dialogue = [];
  const E = new Proxy({}, {get: (_, key) => key === 'tj_item_add' ? (...args) => items.push(args) : () => 0});
  const flags = {b: {}, talked: [], tracks: [], petro: [], quiz: {}};
  const G = {E, flags, local: {granted: []}, area: () => 0, changed() {}, sfx() {}, save() {},
    async say(lines) { dialogue.push(lines); }};
  return {G, items, dialogue, q: createQuest(G)};
}

test('MAP04 meeting awards page through dialogue without any video API, once only', async () => {
  const {G, q, items, dialogue} = game();
  G.flags.b.peace = true;
  await q.interact('knotdesk');
  assert.equal(G.flags.b.page, true);
  assert.equal(questStage(G.flags), 'home');
  assert(dialogue.includes(DIALOGUES.film));
  assert.equal(items.filter(([id]) => id === 8).length, 1);
  await q.interact('knotdesk');
  applyWorld(G);
  assert.equal(items.filter(([id]) => id === 8).length, 1);
});

test('MAP04 council requires all sides and evidence; burned tally raid gates tomb stage', () => {
  const {G} = game(), f = G.flags;
  f.b.arrived = true;
  assert.equal(questStage(f), 'arrive');
  f.talked = [...SIDES];
  assert.equal(questStage(f), 'proofs');
  f.tracks = [1, 2, 3]; f.quiz.hun_decimal = {ok: true}; f.quiz.hun_three = {ok: true};
  assert.equal(questStage(f), 'council');
  Object.assign(f.b, {council: true, raid: true});
  assert.equal(questStage(f), 'raid');
  f.b.raidDone = true;
  assert.equal(questStage(f), 'tomb');
});

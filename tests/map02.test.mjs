import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HISTORICAL_QUIZZES, DIALOGUES, SECRETS, QUESTS, NAMES, SPEAKERS, ZONE_NAMES} from '../src/rpg/story02.js';
import {scoreOf, pageLines, questStage, MAX_SCORE, PASS_SCORE, TRIAL_POINTS, IA, NPC, TAG, TRIG} from '../src/rpg/quest02.js';
import {persistence, SAVE_WORDS_L2} from '../src/rpg/level2.js';
import {MAP02} from '../src/rpg/gen/map02.js';
import {localPassed} from '../src/rpg/levels.js';

const sql = await readFile(new URL('../supabase/migrations/008_bronze_age.sql', import.meta.url), 'utf8');
const keys = Object.fromEntries([...sql.matchAll(/\(2, '(bronze_\w+)', '(main|final|secret)', (\d), (\d+)\)/g)].map(m => [m[1], {kind: m[2], correct: +m[3], points: +m[4]}]));
const KAZ = /[әғқңөұүһі]/i;
const trials = Object.values(HISTORICAL_QUIZZES);
const wasm = await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg-2.wasm', import.meta.url)));
const start = () => { const e = new WebAssembly.Instance(wasm, {}).exports; e._initialize?.(); e.tj_init(); return e; };

test('MAP02 trials: answers and weights match the private server keys (008); texts are Kazakh', () => {
  assert.equal(trials.length, 7);
  for (const q of trials) {
    const k = keys[q.id];
    assert(k, 'server key for ' + q.id);
    assert.equal(k.correct, q.correctIndex, 'correct option ' + q.id);
    assert.equal(k.points, q.points, 'points ' + q.id);
    assert.equal(k.kind, q.tier, 'tier ' + q.id);
    assert(q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4);
    assert.match(q.question, KAZ); for (const o of q.options) assert.match(o, KAZ, q.id);
    assert(q.intro.length && q.evidence.length, 'observe before answering: ' + q.id);
    assert(q.branch.ok.length && q.branch.no.length, 'both choices continue the story: ' + q.id);
    assert(q.explanation && q.source, 'historical logic + source: ' + q.id);
    assert(IA[q.at] != null, 'trial is placed in the world: ' + q.id);
  }
  const by = t => trials.filter(q => q.tier === t);
  assert.equal(by('main').length, 3); assert.equal(by('final').length, 1); assert(by('secret').length >= 3);
  const sum = l => l.reduce((s, q) => s + q.points, 0);
  assert.equal(sum(trials), MAX_SCORE); assert.equal(sum([...by('main'), ...by('final')]), PASS_SCORE);
  assert.match(sql, /required_quiz = 'bronze_tablet' where level_id = 2/);
});

test('MAP02 story: required lines, all new texts in Kazakh, every interact/NPC named', () => {
  const all = Object.values(DIALOGUES).flat();
  assert(all.every(l => KAZ.test(l.kk) && SPEAKERS[l.who]), 'Kazakh lines with known speakers');
  assert(all.some(l => l.who === 'zulmatNamed' && l.kk === 'Сен әлі де оларды өзіңнен қорқытатын мен деп ойлайсың ба?'));
  assert(all.some(l => l.who === 'smith' && l.kk === 'Ол дұрыс айтады. Біз сені есімізде сақтадық.'));
  assert(all.some(l => l.kk.includes('«Шежіреші оралғанда, от екінші рет сөнеді»')));
  for (const k of MAP02.interacts) assert(NAMES[k], 'name for ' + k);
  for (const k of MAP02.npcs) assert(SPEAKERS[k], 'speaker for ' + k);
  for (const q of Object.values(QUESTS)) assert.match(q.kk.join(' '), KAZ);
  assert.equal(ZONE_NAMES.kk.length, 9);
  assert(SECRETS.length >= 5);
  for (const t of ['trapopen', 'ashwall', 'hearthlit', 'furnacelit1']) assert(TAG[t] > 0, 'tag ' + t);
  for (const t of ['square', 'forge', 'arena']) assert(TRIG[t] != null);
  assert(NPC.smithdown != null && NPC.missing3 != null);
});

test('MAP02 score: 89 fails, 90 passes, 100 passes; a wrong final still completes the level', () => {
  const flags = ok => ({b: {}, talked: [], tracks: [], petro: [], quiz: Object.fromEntries(Object.entries(ok).map(([id, v]) => [id, {a: 1, t: 1, ok: v, ch: 0}])), t0: 1, tEnd: 0});
  const path = {bronze_metal: true, bronze_economy: true, bronze_burial: true, bronze_tablet: true};
  assert.equal(scoreOf(flags(path)), 90);
  assert.equal(scoreOf(flags(Object.fromEntries(Object.keys(TRIAL_POINTS).map(k => [k, true])))), 100);
  const s89 = scoreOf(flags({...path, bronze_metal: false, bronze_casting: true, bronze_mausoleum: true, bronze_tin: true}));
  assert.equal(s89, 80); assert(s89 < PASS_SCORE);
  assert.equal(scoreOf(flags({...path, bronze_economy: false, bronze_casting: true, bronze_mausoleum: true, bronze_tin: true, bronze_metal: true})), 80);
  const wrongFinal = flags({...path, bronze_tablet: false});
  assert.equal(scoreOf(wrongFinal), 60); assert.equal(pageLines(wrongFinal), 3);
});

test('MAP02 quest stages follow the investigation without softlocks', () => {
  const f = {b: {}, talked: [], tracks: [], petro: [], quiz: {}};
  assert.equal(questStage(f), 'arrive');
  f.b.village = true; assert.equal(questStage(f), 'investigate');
  f.talked = ['guard', 'shepherd', 'villager1']; f.tracks = [1, 3]; assert.equal(questStage(f), 'investigate', 'mandatory trials first');
  f.quiz.bronze_metal = {ok: false}; f.quiz.bronze_economy = {ok: true}; assert.equal(questStage(f), 'report', 'a wrong choice still continues');
  f.b.elderClue = true; assert.equal(questStage(f), 'sanctuary');
  f.b.freed = true; assert.equal(questStage(f), 'cist');
  f.quiz.bronze_burial = {ok: false}; assert.equal(questStage(f), 'trapdoor');
  f.b.under = true; assert.equal(questStage(f), 'murals');
  f.petro = [1, 2, 3, 4]; assert.equal(questStage(f), 'smith');
  f.b.smithTalk = true; assert.equal(questStage(f), 'tablet');
  f.b.tabletSeen = true; assert.equal(questStage(f), 'boss');
  f.b.keeper = true; assert.equal(questStage(f), 'ember');
  f.b.ember = true; assert.equal(questStage(f), 'rekindle');
  f.b.rekindled = true; assert.equal(questStage(f), 'gate');
  f.b.finished = true; assert.equal(questStage(f), 'done');
});

test('MAP02 save: engine writes 69 words, own envelope schema, MAP01 saves are not accepted', () => {
  const a = start();
  a.tj_teleport(51 * 16, 34 * 16); a.tj_item_add(16, 1); a.tj_item_add(19, 1);
  const n = a.tj_save() / 4;
  assert.equal(n, SAVE_WORDS_L2);
  const words = [...new Uint32Array(a.memory.buffer, a.tj_save_buffer(), n)];
  const raw = JSON.stringify({v: 3, words, flags: {b: {village: true}, talked: ['guard'], tracks: [1], petro: [], quiz: {bronze_metal: {a: 1, t: 1, ok: true, ch: 1}}, t0: 1}, local: {granted: ['kit']}});
  const b = start();
  const data = persistence.restoreSnapshot(b, raw);
  assert.equal(b.tj_item_count(16), 1); assert.equal(b.tj_item_count(19), 1); assert.equal(data.flags.quiz.bronze_metal.ok, true);
  assert.throws(() => persistence.validateSnapshot({v: 3, words: words.slice(0, 59), flags: {b: {}, quiz: {}}}), /Invalid/);
  assert.throws(() => persistence.validateFlags({b: {}, quiz: {stone_main: {a: 1, t: 1}}}), /Invalid/, 'MAP01 trial ids are foreign here');
  assert.throws(() => persistence.validateFlags({b: {}, talked: ['crafter'], quiz: {}}), /Invalid/);
});

test('MAP02 engine: level data is wired (boss, groups, areas) and the world starts at the outskirts', () => {
  const e = start();
  assert.equal(e.tj_enemy_count(), 13);
  assert.equal(e.tj_state(35), 0, 'starts in the world area');
  assert.equal(e.tj_state(2), 0, 'outskirts zone');
  const keeper = [...Array(13).keys()].find(i => e.tj_enemy(i, 4) === 6);
  assert(keeper != null && e.tj_enemy(keeper, 0) === 640, 'keeper boss with 640 hp');
});

test('MAP02 local unlock reads only passed MAP01 journeys', () => {
  const mem = v => ({getItem: () => v});
  assert.equal(localPassed(1, mem(null)), false);
  assert.equal(localPassed(1, mem(JSON.stringify([{map: 1, passed: false, score: 89}]))), false);
  assert.equal(localPassed(1, mem(JSON.stringify([{map: 1, passed: true, score: 90}]))), true);
  assert.equal(localPassed(1, mem('{bad')), false);
});

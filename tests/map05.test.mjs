import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HISTORICAL_QUIZZES, FACTS, DIALOGUES, SPEAKERS, QUESTS, SECRETS, CHOICES} from '../src/rpg/story05.js';
import {questStage, scoreOf, secretsFound, pageLines} from '../src/rpg/quest05.js';
import {persistence, SAVE_WORDS_L5} from '../src/rpg/level5.js';
import {anomaliesFound, anomaly, ANOMALIES} from '../src/rpg/anomalies.js';
import {MAP05} from '../src/rpg/gen/map05.js';
import {LEVEL_IDS} from '../src/rpg/levels.js';

const sql = await readFile(new URL('../supabase/migrations/011_turk_era.sql', import.meta.url), 'utf8');
const trials = Object.values(HISTORICAL_QUIZZES);
const keys = Object.fromEntries([...sql.matchAll(/\(5, '(turk_\w+)', '(main|final|secret)', (\d), (\d+)\)/g)].map(m => [m[1], {kind: m[2], correct: +m[3], points: +m[4]}]));
const wasm = await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg-5.wasm', import.meta.url)));
function start() { const e = new WebAssembly.Instance(wasm, {}).exports; e._initialize?.(); e.tj_init(); return e; }
function tick(e, n) { for (let i = 0; i < n; i++) { e.tj_heal(100); e.tj_tick(); } }
const flags = (b = {}, extra = {}) => ({b, talked: [], tracks: [], petro: [], quiz: {}, bonus: null, t0: 0, tEnd: 0, ...extra});

test('MAP05 is registered after MAP04 and has its own engine build', () => {
  assert(LEVEL_IDS.includes(5));
  assert.equal(SAVE_WORDS_L5, 24 + 25 + MAP05.enemies.length * 2 + 8);
  assert(SAVE_WORDS_L5 <= 96, 'fits the native save buffer');
});

test('MAP05 private keys match all eight trials and the 90/100 scoring contract', () => {
  assert.equal(trials.length, 8); assert.equal(Object.keys(keys).length, 8);
  for (const q of trials) {
    assert.deepEqual(keys[q.id], {kind: q.tier, correct: q.correctIndex, points: q.points}, q.id);
    assert.equal(q.epoch, 5); assert.equal(q.options.length, 4); assert.match(q.question, /[әғқңөұүһі]/i);
    assert(q.source && q.explanation && q.evidence.length && q.branch.ok.length && q.branch.no.length, q.id);
  }
  assert.equal(trials.reduce((n, q) => n + q.points, 0), 100);
  assert.equal(trials.filter(q => q.tier !== 'secret').reduce((n, q) => n + q.points, 0), 90);
  assert.match(sql, /required_quiz = 'turk_final' where level_id = 5/);
});

test('MAP05 dialogue: every line has a known speaker and both languages', () => {
  const lines = Object.values(DIALOGUES).flatMap(v => typeof v === 'function' ? [] : Array.isArray(v) ? v.flat() : Object.values(v));
  assert(lines.length > 120);
  for (const l of lines) { assert(SPEAKERS[l.who], 'speaker ' + l.who); assert(l.kk && l.ru, 'kk+ru: ' + l.kk); assert(!/undefined|null|NaN/.test(l.kk + l.ru)); }
  for (const s of Object.values(SPEAKERS)) assert(s.kk && s.ru);
  for (const q of Object.values(QUESTS)) assert(q.kk?.length === 2 && q.ru?.length === 2 && q.target);
  assert.equal(CHOICES.kultegin.options.length, 3);
});

test('MAP05 history: real people in their own time, fiction labelled, the 711 campaign sourced', () => {
  assert.match(FACTS.tonyukuk.kk, /Ілтеріс.*Қапаған.*Білге/); assert.match(FACTS.tonyukuk.kk, /көркем қиял/);
  assert.match(FACTS.kultegin.kk, /684–731/); assert.match(FACTS.kultegin.kk, /732/);
  assert.match(FACTS.turgesh.kk, /711/); assert.match(FACTS.turgesh.kk, /ойдан шығарылған/);
  // In 711–712 Bilge was not yet kagan: Tonyukuk serves Kapagan in the dialogue.
  assert.match(DIALOGUES.tonyukuk1[0].kk, /Қапаған қағанға беремін/);
  const runes = trials.find(q => q.id === 'turk_runes'); assert.match(runes.options[runes.correctIndex], /1893.*Томсен/);
  const bolchu = trials.find(q => q.id === 'turk_bolchu'); assert.match(bolchu.explanation, /пікірі әртүрлі/);
});

test('MAP05 the journal rewrites itself silently but the objective stays the same', () => {
  assert.equal(QUESTS.gather.target, QUESTS.gather2.target);
  assert.notEqual(QUESTS.gather.kk[1], QUESTS.gather2.kk[1]);
  assert.equal(QUESTS.gather.kk[0], QUESTS.gather2.kk[0]);
  assert.equal(questStage(flags({arrived: true, met: true})), 'gather');
  assert.equal(questStage(flags({arrived: true, met: true}, {talked: ['togyz']})), 'gather2');
  assert.equal(questStage(flags({page: true})), 'home');
  assert.equal(questStage(flags({page: true, surfaced: true})), 'home2');
});

test('MAP05 quest chain: both versions → the other side → the stone → lake → below → page', () => {
  const ev = {talked: ['irkin', 'kumis', 'togyz', 'sentry'], tracks: [1, 2, 3]};
  assert.equal(questStage(flags({arrived: true, met: true}, ev)), 'ktcamp');
  const sides = {talked: [...ev.talked, 'tonyukuk', 'kultegin'], tracks: [1, 2, 3], quiz: {turk_bolchu: {a: 1, t: 1, ok: true}}};
  assert.equal(questStage(flags({arrived: true, met: true}, sides)), 'stele');
  assert.equal(questStage(flags({twin1: true})), 'lake');
  assert.equal(questStage(flags({lakeSeen: true})), 'ruin');
  assert.equal(questStage(flags({under: true})), 'boss');
  assert.equal(questStage(flags({sealOpen: true})), 'chamber');
  const all = Object.fromEntries(trials.map(q => [q.id, {a: 1, t: 1, ok: true}]));
  assert.equal(scoreOf(flags({}, {quiz: all})), 100);
  assert.equal(pageLines(flags({}, {quiz: all})), 4);
  assert.equal(secretsFound(flags(Object.fromEntries(SECRETS.map(s => [s, true])))), 6);
});

test('MAP05 saves validate and reject forged data', () => {
  const ok = persistence.validateFlags(flags({twin1: true}, {talked: ['irkin', 'kumis'], tracks: [1, 3]}));
  assert.deepEqual(ok.tracks, [1, 3]);
  assert.throws(() => persistence.validateFlags(flags({}, {tracks: [9]})));
  assert.throws(() => persistence.validateFlags(flags({}, {talked: ['zulmat']})));
  assert.throws(() => persistence.validateFlags(flags({}, {quiz: {hun_script: {a: 1, t: 1}}})));
});

test('team anomalies: ten ids, validated store, counted once', () => {
  const store = new Map(); const storage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
  const G = {lang: () => 'kk', toast: () => {}, sfx: () => {}};
  assert.equal(Object.keys(ANOMALIES).length, 10);
  assert.equal(anomaly(G, 'map03', storage), true); assert.equal(anomaly(G, 'map03', storage), false);
  assert.equal(anomaly(G, 'bogus', storage), false);
  store.set('tarikh.anomalies', '["map01","map01","x",5]'); assert.deepEqual(anomaliesFound(storage), ['map01']);
  store.set('tarikh.anomalies', '{bad'); assert.deepEqual(anomaliesFound(storage), []);
});

test('MAP05 native «Екінші бейне»: prediction, harmless copies, exposure and refusal (never dies)', () => {
  const e = start(), i = Array.from({length: e.tj_enemy_count()}, (_, k) => k).find(k => e.tj_enemy(k, 4) === 9);
  assert.notEqual(i, undefined);
  e.tj_groups(1 << 5); e.tj_teleport(440, 1530); tick(e, 90);
  assert.equal(e.tj_enemy(i, 14), 1);
  let ring = false; for (let t = 0; t < 400 && !ring; t++) { e.tj_input(t % 60 < 30 ? 8 : 4); tick(e, 1); ring = e.tj_enemy(i, 15) === 1; }
  e.tj_input(0); assert(ring, 'phase 1 marks where the hero will be');
  e.tj_enemy_damage(i, 10000, 0); assert.equal(e.tj_enemy(i, 0), 506, 'burst stops at the phase boundary');
  tick(e, 1); assert.equal(e.tj_enemy(i, 14), 2);
  tick(e, 75); assert.equal(e.tj_enemy(i, 16), 7, 'three copies');
  const hp = e.tj_enemy(i, 0);
  for (let k = 0; k < 3; k++) {
    for (let a = 0; a < 5 && (e.tj_enemy(i, 16) & (1 << k)); a++) {
      e.tj_teleport(Math.round(e.tj_enemy(i, 17 + k) / 1000), Math.round(e.tj_enemy(i, 20 + k) / 1000 + 18)); e.tj_face(0); e.tj_input(32); tick(e, 10); e.tj_input(0); tick(e, 30);
    }
    assert.equal(e.tj_enemy(i, 16) & (1 << k), 0, 'copy ' + k + ' dissolved');
  }
  assert(e.tj_enemy(i, 0) <= hp);
  let exposed = false; for (let t = 0; t < 240 && !exposed; t++) { tick(e, 1); exposed = e.tj_enemy(i, 15) === 6; }
  assert(exposed, 'no copies left → exposed');
  e.tj_enemy_damage(i, 10000, 0); assert.equal(e.tj_enemy(i, 0), 253, 'second boundary');
  tick(e, 60); assert.equal(e.tj_enemy(i, 14), 3); assert.equal(e.tj_enemy(i, 15), 9, 'refusal');
  e.tj_enemy_damage(i, 10000, 0); assert.equal(e.tj_enemy(i, 0), 253, 'blows pass through him');
  let alert = false; for (let k = 0; k < e.tj_event_count(); k++) if (e.tj_event(k, 0) === 15 && e.tj_event(k, 2) === 99) alert = true;
  assert(alert, 'refusal hands over to the story (EV_ALERT 99)');
});

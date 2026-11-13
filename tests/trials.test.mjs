import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HISTORICAL_QUIZZES, BONUS_QUIZ, BONUS_META, DIALOGUES} from '../src/rpg/story.js';
import {scoreOf, pageLines, MAX_SCORE, PASS_SCORE, TRIAL_POINTS} from '../src/rpg/quest.js';
import {validateFlags} from '../src/rpg/persistence.js';

const sql = (await readFile(new URL('../supabase/migrations/006_members_results.sql', import.meta.url), 'utf8')) +
  (await readFile(new URL('../supabase/migrations/007_competition.sql', import.meta.url), 'utf8'));
const serverKeys = Object.fromEntries([...sql.matchAll(/\(1, '(stone_\w+)', '\w+', (\d)\)/g)].map(m => [m[1], +m[2]]));
const serverPoints = Object.fromEntries([...sql.matchAll(/\('(stone_\w+)', '(main|final|secret)', (\d+)\)/g)].map(m => [m[1], {kind: m[2], points: +m[3]}]));
const KAZ = /[әғқңөұүһі]/i;
const trials = [...Object.values(HISTORICAL_QUIZZES).map(q => ({id: q.id, options: q.options, correct: q.correctIndex, text: q.question, tier: q.tier, points: q.points})),
  ...BONUS_QUIZ.questions.map((q, i) => ({id: BONUS_META[i].id, options: q.o.kk, correct: q.a, text: q.q.kk, tier: 'secret', points: BONUS_META[i].points}))];

test('Every MAP01 trial has a valid answer that matches the private server key', () => {
  assert.equal(trials.length, 10);
  for (const t of trials) {
    assert(t.options.length >= 3 && t.correct >= 0 && t.correct < t.options.length, t.id);
    assert.equal(serverKeys[t.id], t.correct, 'server key for ' + t.id);
    assert.equal(serverPoints[t.id]?.points, t.points, 'server points for ' + t.id);
    assert.equal(serverPoints[t.id].kind, t.tier, 'tier for ' + t.id);
    assert.match(t.text, KAZ, 'Kazakh question text: ' + t.id);
    for (const o of t.options) assert.match(o, KAZ, 'Kazakh options: ' + t.id);
  }
});

test('Structure: 3 mandatory + 1 final + secret trials; mandatory path alone reaches the pass score', () => {
  const by = k => trials.filter(t => t.tier === k);
  assert.equal(by('main').length, 3); assert.equal(by('final').length, 1);
  assert(by('secret').length >= 2);
  const sum = list => list.reduce((s, t) => s + t.points, 0);
  assert.equal(sum(trials), MAX_SCORE);
  assert.equal(sum([...by('main'), ...by('final')]), PASS_SCORE, 'all mandatory + final = 90 = pass');
  for (const q of Object.values(HISTORICAL_QUIZZES)) {
    assert(q.intro?.length && q.evidence?.length, 'observe before answering: ' + q.id);
    assert(q.branch.ok.length && q.branch.no.length, 'both branches continue the story: ' + q.id);
    assert(q.explanation && q.source, 'historical logic + source: ' + q.id);
    assert.equal(Object.keys(q).filter(k => k.endsWith('_ru')).length, 0, 'new story texts are Kazakh-only: ' + q.id);
  }
  assert(DIALOGUES.shadow.some(l => l.who === 'zulmat'), 'Zulmat speaks in the shadow scene');
});

test('Local score mirrors the server weights: 90 pass, 100 pass, below 90 fail; a wrong final still completes', () => {
  const flags = ok => ({b: {}, talked: [], tracks: [], petro: [], quiz: Object.fromEntries(Object.entries(ok).map(([id, v]) => [id, {a: 1, t: 1, ok: v, ch: 0}])), t0: 1, tEnd: 0});
  const all = Object.fromEntries(Object.keys(TRIAL_POINTS).map(id => [id, true]));
  assert.equal(scoreOf(flags(all)), 100);
  const path = {stone_main: true, stone_hunting: true, stone_cave: true, stone_secret: true};
  assert.equal(scoreOf(flags(path)), 90); assert(scoreOf(flags(path)) >= PASS_SCORE);
  const wrongFinal = {...path, stone_secret: false, stone_workshop: true, stone_bonus_4: true};
  assert.equal(scoreOf(flags(wrongFinal)), 66); assert(scoreOf(flags(wrongFinal)) < PASS_SCORE);
  assert.equal(pageLines(flags(wrongFinal)), 3, 'page restored, one line stays distorted');
  // Saved choices keep the branch result.
  const v = validateFlags(flags({stone_main: false}));
  assert.equal(v.quiz.stone_main.ok, false); assert.equal(v.quiz.stone_main.ch, 0);
  assert.throws(() => validateFlags({...flags({}), quiz: {stone_main: {a: 1, t: 1, ok: 'yes'}}}));
});

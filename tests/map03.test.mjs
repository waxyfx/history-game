import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HISTORICAL_QUIZZES, DIALOGUES, SECRETS, QUESTS, NAMES, SPEAKERS, ZONE_NAMES, CHOICES, PEOPLE, EVIDENCE} from '../src/rpg/story03.js';
import {scoreOf, pageLines, questStage, MAX_SCORE, PASS_SCORE, TRIAL_POINTS, IA, NPC, TAG, TRIG, createQuest} from '../src/rpg/quest03.js';
import {persistence, SAVE_WORDS_L3} from '../src/rpg/level3.js';
import {MAP03} from '../src/rpg/gen/map03.js';
import {newFlags} from '../src/rpg/quest.js';

const sql = await readFile(new URL('../supabase/migrations/009_saka_world.sql', import.meta.url), 'utf8');
const keys = Object.fromEntries([...sql.matchAll(/\(3, '(saka_\w+)', '(main|final|secret)', (\d), (\d+)\)/g)].map(m => [m[1], {kind: m[2], correct: +m[3], points: +m[4]}]));
const KAZ = /[әғқңөұүһі]/i;
const trials = Object.values(HISTORICAL_QUIZZES);
const wasm = await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg-3.wasm', import.meta.url)));
const start = () => { const e = new WebAssembly.Instance(wasm, {}).exports; e._initialize?.(); e.tj_init(); return e; };

test('MAP03 trials match the private server keys (009); 3 main + final + 4 secret = 100, mandatory = 90; Kazakh', () => {
  assert.equal(trials.length, 8);
  for (const q of trials) {
    const k = keys[q.id];
    assert(k, 'server key for ' + q.id);
    assert.equal(k.correct, q.correctIndex, q.id); assert.equal(k.points, q.points, q.id); assert.equal(k.kind, q.tier, q.id);
    assert.equal(q.options.length, 4);
    assert.match(q.question, KAZ); for (const o of q.options) assert.match(o, KAZ);
    assert(q.intro.length && q.evidence.length && q.branch.ok.length && q.branch.no.length && q.explanation && q.source, q.id);
    assert(IA[q.at] != null || NPC[q.at] != null, 'trial placed in the world: ' + q.id);
  }
  const by = t => trials.filter(q => q.tier === t), sum = l => l.reduce((s, q) => s + q.points, 0);
  assert.equal(by('main').length, 3); assert.equal(by('final').length, 1); assert(by('secret').length >= 3);
  assert.equal(sum(trials), MAX_SCORE); assert.equal(sum([...by('main'), ...by('final')]), PASS_SCORE);
  assert.match(sql, /required_quiz = 'saka_final' where level_id = 3/);
});

test('MAP03 story: the accusation scene, Kazakh text everywhere, every speaker/interact named', () => {
  const all = Object.values(DIALOGUES).flat();
  assert(all.every(l => KAZ.test(l.kk) && SPEAKERS[l.who]), 'Kazakh lines with known speakers: ' + all.filter(l => !KAZ.test(l.kk) || !SPEAKERS[l.who]).map(l => l.kk).join(' | '));
  const scene = DIALOGUES.assembly;
  const who = new Set(scene.map(l => l.who));
  for (const k of ['barsbek', 'qaraman', 'arna', 'altynbek', 'kungey', 'ulpan', 'warrior1', 'warrior2', 'zulmatNamed', 'aibar']) assert(who.has(k), 'speaks in the assembly: ' + k);
  assert(scene.some(l => l.who === 'zulmatNamed' && /құтқарушы/.test(l.kk)), 'Zulmat twists the story');
  assert(scene.findIndex(l => l.who === 'qaraman' && /қоршаңдар/.test(l.kk)) > scene.findIndex(l => l.who === 'zulmatNamed'), 'warriors surround after the speech');
  for (const k of MAP03.interacts) assert(NAMES[k], 'name for ' + k);
  for (const k of MAP03.npcs) assert(SPEAKERS[k], 'speaker for ' + k);
  for (const q of Object.values(QUESTS)) assert.match(q.kk.join(' '), KAZ);
  assert.equal(ZONE_NAMES.kk.length, 13);
  assert(SECRETS.length >= 5);
  assert(DIALOGUES.niche.some(l => /бұрын/.test(l.kk)), 'a secret proves Zulmat was here before');
  for (const c of Object.values(CHOICES)) { assert.equal(c.options.length, 2); assert.match(c.question, KAZ); }
  for (const t of ['mirrorseal', 'zmirror', 'armorstand']) assert(TAG[t] > 0);
  for (const t of ['outskirts', 'arena', 'hall']) assert(TRIG[t] != null);
});

test('MAP03 score: 89 fails, 90 passes, 100 passes; a wrong final still completes the level', () => {
  const flags = ok => ({b: {}, talked: [], tracks: [], petro: [], quiz: Object.fromEntries(Object.entries(ok).map(([id, v]) => [id, {a: 1, t: 1, ok: v, ch: 0}])), t0: 1, tEnd: 0});
  const path = {saka_gold: true, saka_kurgan: true, saka_women: true, saka_final: true};
  assert.equal(scoreOf(flags(path)), 90);
  assert.equal(scoreOf(flags(Object.fromEntries(Object.keys(TRIAL_POINTS).map(k => [k, true])))), 100);
  const s = scoreOf(flags({...path, saka_gold: false, saka_esik: true, saka_berel: true, saka_altar: true, saka_hats: true}));
  assert.equal(s, 80); assert(s < PASS_SCORE);
  assert.equal(pageLines(flags({...path, saka_final: false})), 3);
});

test('MAP03 stages: camp → arrival → people → accusation → any 4 of 6 clues → tomb → boss → mirror → verdict → camp', () => {
  const f = newFlags(); const b = f.b;
  assert.equal(questStage(f), 'camp');
  b.arrived = true; assert.equal(questStage(f), 'arrive');
  b.welcomed = true; assert.equal(questStage(f), 'learn');
  f.talked = ['barsbek', 'qaraman', 'arna', 'kungey']; assert.equal(questStage(f), 'learn', 'the goldsmith trial first');
  f.quiz.saka_gold = {ok: false}; assert.equal(questStage(f), 'gather', 'a wrong choice still continues');
  b.accused = true; assert.equal(questStage(f), 'investigate');
  for (const clue of [EVIDENCE.hoofs, EVIDENCE.legend, EVIDENCE.seal, EVIDENCE.tally]) f.tracks.push(clue);   // any four
  b.trail = true; assert.equal(questStage(f), 'tomb');
  b.tomb = true; assert.equal(questStage(f), 'boss');
  b.freed = true; assert.equal(questStage(f), 'mirror');
  b.mirror = true; assert.equal(questStage(f), 'verdict');
  b.verdict = true; assert.equal(questStage(f), 'home');
  b.finished = true; assert.equal(questStage(f), 'done');
  assert(PEOPLE.length === 5 && Object.keys(EVIDENCE).length === 6);
});

test('MAP03 choices change attitudes: fleeing makes the goldsmith demand his plaque; the private talk wins Qaraman', async () => {
  const run = async (choice, plaque) => {
    const said = [], E = new Proxy({}, {get: () => () => 0});
    const G = {E, flags: newFlags(), local: {granted: [], seen: [], attempts: {}}, party: () => 1, lang: () => 'kk', area: () => 0,
      say: async l => { said.push(...l); }, choose: async () => choice, changed() {}, toast() {}, sfx() {}, spawnFx() {}, save() {}, travel: async () => {}};
    Object.assign(G.flags.b, {arrived: true, welcomed: true, accused: true, [choice ? 'fled' : 'submitted']: true, plaque});
    const q = createQuest(G);
    await q.talk('altynbek');
    G.flags.tracks = [1, 2, 3, 4, 5, 6];
    await q.talk('qaraman');
    return {said: said.map(l => l.kk).join(' '), flags: G.flags};
  };
  const submit = await run(0, false);
  assert(submit.flags.tracks.includes(EVIDENCE.ledger) || /моншақ/.test(submit.said), 'after submitting the goldsmith shares his account');
  assert(submit.flags.b.qaramanTold, 'Qaraman hears the evidence privately');
  const fled = await run(1, false);
  assert.match(fled.said, /қапсырманы тауып бер/, 'after fleeing the goldsmith asks for his stolen plaque first');
});

test('MAP03 save: 89 words with its own schema; MAP02 saves are not accepted', () => {
  const a = start();
  const n = a.tj_save() / 4;
  assert.equal(n, SAVE_WORDS_L3);
  const words = [...new Uint32Array(a.memory.buffer, a.tj_save_buffer(), n)];
  const raw = JSON.stringify({v: 3, words, flags: {b: {accused: true, submitted: true}, talked: ['arna'], tracks: [1, 5], petro: [], quiz: {saka_gold: {a: 1, t: 1, ok: true, ch: 1}}, t0: 1}, local: {granted: ['kit']}});
  const data = persistence.restoreSnapshot(start(), raw);
  assert.equal(data.flags.b.submitted, true); assert.deepEqual(data.flags.tracks, [1, 5]);
  assert.throws(() => persistence.validateSnapshot({v: 3, words: words.slice(0, 83), flags: {b: {}, quiz: {}}}), /Invalid/);
  assert.throws(() => persistence.validateFlags({b: {}, quiz: {bronze_metal: {a: 1, t: 1}}}), /Invalid/);
});

test('MAP03 engine: the golden rider — phases follow health, frontal guard on foot, mirror illusions', () => {
  const e = start();
  e.tj_groups(0xffff);
  const boss = MAP03.enemies.findIndex(x => x.type === 7);
  assert(boss >= 0 && e.tj_enemy(boss, 0) === 720);
  e.tj_teleport(32 * 16, 91 * 16);
  for (let i = 0; i < 120; i++) e.tj_tick();
  assert.equal(e.tj_enemy(boss, 14), 1, 'mounted');
  for (let i = 0; i < 40 && e.tj_enemy(boss, 14) < 2; i++) { e.tj_enemy_damage(boss, 30, 0); e.tj_heal(100); for (let k = 0; k < 4; k++) e.tj_tick(); }
  assert.equal(e.tj_enemy(boss, 14), 2, 'on foot below 60%');
  for (let i = 0; i < 120; i++) { e.tj_heal(100); e.tj_tick(); }
  const dir = [[0, -1], [.7, -.7], [1, 0], [.7, .7], [0, 1], [-.7, .7], [-1, 0], [-.7, -.7]];
  for (let k = 0; k < 200 && e.tj_enemy(boss, 15) !== 0; k++) { e.tj_heal(100); e.tj_tick(); }
  const f = e.tj_enemy(boss, 7), [dx, dy] = dir[f], bx = e.tj_enemy(boss, 2) / 1000, by = e.tj_enemy(boss, 3) / 1000;
  e.tj_teleport(Math.round(bx + dx * 16), Math.round(by + dy * 16));
  const hp = e.tj_enemy(boss, 0); e.tj_enemy_damage(boss, 25, 0);
  assert.equal(e.tj_enemy(boss, 0), hp, 'frontal blow deflected');
  e.tj_teleport(Math.round(bx - dx * 16), Math.round(by - dy * 16)); e.tj_enemy_damage(boss, 25, 0);
  assert(e.tj_enemy(boss, 0) < hp, 'blow from behind lands');
  for (let i = 0; i < 60 && e.tj_enemy(boss, 14) < 3; i++) {
    const g = e.tj_enemy(boss, 7), [gx, gy] = dir[g];
    e.tj_teleport(Math.round(e.tj_enemy(boss, 2) / 1000 - gx * 16), Math.round(e.tj_enemy(boss, 3) / 1000 - gy * 16));
    e.tj_enemy_damage(boss, 30, 0); e.tj_heal(100); for (let k = 0; k < 3; k++) e.tj_tick();
  }
  for (let i = 0; i < 130; i++) { e.tj_heal(100); e.tj_tick(); }
  assert.equal(e.tj_enemy(boss, 14), 3); assert.equal(e.tj_enemy(boss, 16), 6, 'two mirror illusions');
});

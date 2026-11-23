// MAP06–MAP10: content contracts (trials ↔ private server keys, both languages, quest targets that exist on the map),
// the campaign chain (each gate leads to the next level once the level is passed), and the native mechanics of the late
// eras run on the real engine builds (composite bow range, sabre series, lance charge, bullets and bursts, the bosses).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LEVEL_IDS, loadLevel} from '../src/rpg/levels.js';
import {ANOMALIES} from '../src/rpg/anomalies.js';
import {ALL_EPOCHS} from '../src/rpg/campaign.js';

const pad = n => String(n).padStart(2, '0');
const MIGRATION = {6: '013_horde_era', 7: '014_khanate_era', 8: '015_empire_era', 9: '016_soviet_era', 10: '017_independence_era'};
const GATE = {6: 'gate6', 7: 'gate7', 8: 'gate8', 9: 'gate9', 10: 'gate10'};
const LV = {};
for (const n of [6, 7, 8, 9, 10]) {
  LV[n] = {story: await import(`../src/rpg/story${pad(n)}.js`), quest: await import(`../src/rpg/quest${pad(n)}.js`), level: await loadLevel(n),
    mod: await import(`../src/rpg/level${n}.js`), map: (await import(`../src/rpg/gen/map${pad(n)}.js`))[`MAP${pad(n)}`],
    sql: await readFile(new URL(`../supabase/migrations/${MIGRATION[n]}.sql`, import.meta.url), 'utf8') +
      await readFile(new URL('../supabase/migrations/020_content_gaps.sql', import.meta.url), 'utf8'),   // audit №14 secret trials
    wasm: await WebAssembly.compile(await readFile(new URL(`../public/engine/rpg/tarikh-rpg-${n}.wasm`, import.meta.url)))};
}
function engine(n) { const e = new WebAssembly.Instance(LV[n].wasm, {}).exports; e._initialize?.(); e.tj_init(); return e; }
function tick(e, n) { for (let i = 0; i < n; i++) { e.tj_heal(100); e.tj_tick(); } }
const flags = (b = {}, extra = {}) => ({b, talked: [], tracks: [], petro: [], quiz: {}, bonus: null, t0: 0, tEnd: 0, ...extra});
const fire = (e, mask, n) => { e.tj_input(mask); tick(e, n); e.tj_input(0); };

test('the campaign has ten playable epochs in order, each with its own engine build and a save that fits', () => {
  assert.deepEqual(LEVEL_IDS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(ALL_EPOCHS.map(e => e.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(ALL_EPOCHS[5].slug, 'horde');
  for (const n of [6, 7, 8, 9, 10]) {
    const {level, mod, map} = LV[n];
    assert.equal(level.id, n); assert.equal(level.requires, n - 1); assert.equal(level.wasm, `/engine/rpg/tarikh-rpg-${n}.wasm`);
    const words = mod.SAVE_WORDS ?? mod[`SAVE_WORDS_L${n}`];
    assert.equal(words, 24 + 25 + map.enemies.length * 2 + 8); assert(words <= 96, 'fits the native save buffer');
    assert.equal(level.next ?? null, n < 10 ? n + 1 : null, 'next level');
  }
});

for (const n of [6, 7, 8, 9, 10]) {
  // Audit №14 added secret trials to MAP06 (IX–XII centuries), MAP08 (1916, Alash) and MAP09 (1937–38, ALZhIR, the Virgin
  // Lands, Baikonur): the mandatory trials still give 90, secrets add 2–3 each, and the level score is capped at 100.
  const TRIALS = {6: 12, 7: 8, 8: 11, 9: 12, 10: 8};
  test(`MAP${pad(n)}: ${TRIALS[n]} trials match the private keys and the 90 + secrets (capped at 100) scoring contract`, () => {
    const {story, sql} = LV[n], trials = Object.values(story.HISTORICAL_QUIZZES);
    const keys = Object.fromEntries([...sql.matchAll(new RegExp(`\\(${n}, '(\\w+)', '(main|final|secret)', (\\d), (\\d+)\\)`, 'g'))].map(m => [m[1], {kind: m[2], correct: +m[3], points: +m[4]}]));
    assert.equal(trials.length, TRIALS[n]); assert.equal(Object.keys(keys).length, TRIALS[n]);
    assert.equal(new Set(trials.map(q => q.id)).size, trials.length, 'unique trial ids');
    for (const q of trials) {
      assert.deepEqual(keys[q.id], {kind: q.tier, correct: q.correctIndex, points: q.points}, q.id);
      assert.equal(q.epoch, n); assert.equal(q.options.length, 4); assert.match(q.question, /[әғқңөұүһі]/i);
      assert(q.options.every((o, i) => o.startsWith('ABCD'[i] + ') ')), q.id + ': options in the «A) …» format');
      assert(q.source && q.explanation && q.evidence.length && q.branch.ok.length && q.branch.no.length, q.id);
      if (q.tier === 'secret') assert(q.points >= 2 && q.points <= 3, q.id + ': a secret gives 2–3 points');
    }
    assert(trials.reduce((s, q) => s + q.points, 0) >= 100, 'all trials reach the 100 cap');
    assert.equal(trials.filter(q => q.tier !== 'secret').reduce((s, q) => s + q.points, 0), 90);
    assert.equal(trials.filter(q => q.tier === 'final').length, 1);
    assert.deepEqual([...(story.MAIN_QUIZ_ORDER || [1, 2, 3, 4, 5, 6, 7, 8])].sort((a, b) => a - b), Object.keys(story.HISTORICAL_QUIZZES).map(Number).sort((a, b) => a - b), 'the journal lists every trial');
    assert.match(sql, /pass_score = 60|100, 60, 60/);
  });

  test(`MAP${pad(n)}: every line has a speaker and both languages; quests, secrets and talkers exist on the map`, () => {
    const {story, map} = LV[n];
    const lines = Object.values(story.DIALOGUES).flatMap(v => typeof v === 'function' ? [] : Array.isArray(v) ? v.flat() : Object.values(v));
    assert(lines.length > 45, 'a real amount of dialogue: ' + lines.length);
    for (const l of lines) { assert(story.SPEAKERS[l.who], 'speaker ' + l.who); assert(l.kk && l.ru, 'kk+ru: ' + l.kk); assert(!/undefined|null|NaN/.test(l.kk + l.ru)); }
    for (const [k, q] of Object.entries(story.QUESTS)) {
      assert(q.kk?.length === 2 && q.ru?.length === 2, k);
      const t = q.target; assert(t.startsWith('npc:') ? map.npcs.includes(t.slice(4)) : map.interacts.includes(t) || map.triggers.includes(t), `${k} → ${t}`);
    }
    assert.equal(story.SECRETS.length, 6);
    for (const s of story.SECRETS) assert(map.interacts.includes(s), 'secret on the map: ' + s);
    for (const k of story.TALKERS) assert(map.npcs.includes(k), 'talker on the map: ' + k);
    for (const q of Object.values(story.HISTORICAL_QUIZZES)) assert(map.interacts.includes(q.at) || map.npcs.includes(q.at), 'trial place: ' + q.at);
    assert(map.interacts.includes(GATE[n]), 'the gate');
    assert(story.ARTIFACTS?.length >= 3, 'artifacts');
  });

  test(`MAP${pad(n)}: the gate leads on only when the page is earned and the level is passed`, async () => {
    const {quest, map} = LV[n], e = engine(n);
    const calls = [];
    const G = {E: e, flags: flags({page: true, finished: true}), local: {granted: []}, lang: () => 'kk', changed() {}, save() {}, area: () => 0,
      say: async () => {}, quiz: async () => {}, choose: async () => 0, cine: async () => {}, toast() {}, sfx() {}, spawnFx() {}, heroPos: () => [0, 0],
      levelPassed: () => true, gotoLevel: k => calls.push(['goto', k]), results: () => calls.push(['results']), complete() {}};
    const q = quest.createQuest(G);
    await q.interact(GATE[n]);
    assert.deepEqual(calls[0], n < 10 ? ['goto', n + 1] : ['results'], 'passed → next');
    G.levelPassed = () => false; calls.length = 0; await q.interact(GATE[n]);
    assert.deepEqual(calls[0], ['results'], 'not passed → results');
    G.flags = flags({}); calls.length = 0; await q.interact(GATE[n]);
    assert.equal(calls.length, 0, 'no page → the gate stays shut');
    assert(map.enemies.some(en => en.type >= 6), 'a boss');
  });
}

test('team anomalies: one per epoch, ten in all', () => {
  assert.deepEqual(Object.keys(ANOMALIES), ['map01', 'map02', 'map03', 'map04', 'map05', 'map06', 'map07', 'map08', 'map09', 'map10']);
});

test('quest stages advance along the story (MAP07–MAP10)', () => {
  const s7 = LV[7].quest.questStage, s8 = LV[8].quest.questStage, s9 = LV[9].quest.questStage, s10 = LV[10].quest.questStage;
  assert.equal(s7(flags()), 'arrive'); assert.equal(s7(flags({met: true})), 'memory');
  assert.equal(s7(flags({met: true}, {tracks: [1, 2, 3]})), 'arms'); assert.equal(s7(flags({met: true, batyrDone: true}, {tracks: [1, 2, 3]})), 'council');
  assert.equal(s7(flags({councilDone: true})), 'ridge'); assert.equal(s7(flags({noyonDown: true})), 'page'); assert.equal(s7(flags({page: true})), 'home');
  assert.equal(s8(flags({met: true}, {tracks: [1, 2, 3]})), 'arms'); assert.equal(s8(flags({night: true})), 'fire');
  assert.equal(s8(flags({night: true, door1: true, door2: true, door3: true})), 'smoke'); assert.equal(s8(flags({chronDown: true})), 'page');
  assert.equal(s9(flags({met: true}, {tracks: [1, 2, 3]})), 'training'); assert.equal(s9(flags({instructorDone: true})), 'orchard');
  assert.equal(s9(flags({twin9: true})), 'ppsh'); assert.equal(s9(flags({ppshDone: true})), 'hall'); assert.equal(s9(flags({heirDown: true})), 'page');
  assert.equal(s10(flags({met: true}, {tracks: [1, 2, 3]})), 'door'); assert.equal(s10(flags({sacrifice: true})), 'hall');
  assert.equal(s10(flags({zulmatDown: true})), 'page'); assert.equal(s10(flags({page: true})), 'done');
});

test('scoring: 100 for all trials, the pass mark 60, the page needs the four main trials', () => {
  for (const n of [6, 7, 8, 9, 10]) {
    const {quest, story} = LV[n], all = Object.fromEntries(Object.values(story.HISTORICAL_QUIZZES).map(q => [q.id, {ok: true}]));
    assert.equal(quest.scoreOf(flags({}, {quiz: all})), 100); assert.equal(quest.PASS_SCORE, 60);
    assert.equal(quest.pageLines(flags({}, {quiz: all})), 4); assert.equal(quest.PAGE_TOTAL, 4);
    // Mandatory trials alone give 90; the secrets fill the rest up to the cap.
    const main = Object.fromEntries(Object.values(story.HISTORICAL_QUIZZES).filter(q => q.tier !== 'secret').map(q => [q.id, {ok: true}]));
    assert.equal(quest.scoreOf(flags({}, {quiz: main})), 90, `MAP${pad(n)} mandatory = 90`);
  }
});

// Audit №14: each new secret trial is reached in play — the quest hands it to G.quiz from its NPC or object.
test('the IX–XII century, 1916/Alash and 1937–Baikonur secret trials are reachable from their NPCs and objects', async () => {
  const NEW = {6: ['horde_karakhan', 'horde_books', 'horde_kipchak', 'horde_otrar'], 8: ['rus_1916', 'rus_torgai', 'rus_alash'],
    9: ['sov_1937', 'sov_alzhir', 'sov_tyn', 'sov_baikonur']};
  for (const [n, ids] of Object.entries(NEW)) {
    const {quest, story, map} = LV[n], e = engine(+n), asked = [];
    const byNum = Object.fromEntries(Object.entries(story.HISTORICAL_QUIZZES).map(([k, q]) => [+k, q.id]));
    const G = {E: e, flags: flags({met: true}), local: {granted: []}, lang: () => 'kk', changed() {}, save() {}, area: () => 0,
      say: async () => {}, quiz: async k => { asked.push(byNum[k]); G.flags.quiz[byNum[k]] = {a: 1, t: 1, ok: true}; }, choose: async () => 0,
      cine: async () => {}, toast() {}, sfx() {}, spawnFx() {}, heroPos: () => [0, 0], levelPassed: () => false, gotoLevel() {}, results() {}, complete() {}};
    const q = quest.createQuest(G);
    for (const id of ids) {
      const at = Object.values(story.HISTORICAL_QUIZZES).find(t => t.id === id).at;
      asked.length = 0;
      if (map.npcs.includes(at)) await q.talk(at); else { assert(map.interacts.includes(at), id + ' at ' + at); await q.interact(at); }
      assert.deepEqual(asked, [id], `MAP${pad(n)} ${at} → ${id}`);
      assert(story.NAMES[at] || map.npcs.includes(at), `${at} has a name`);
    }
  }
});

// ---------------------------------------------------------------- native mechanics on the real builds
const projectiles = e => { let n = 0; for (let i = 0; i < 48; i++) if (e.tj_projectile(i, 0)) n++; return n; };
function flight(e) {   // how far one shot flies (pixels), fired north from a clear spot
  let best = 0, y0 = e.tj_state(1) / 1000;
  fire(e, 32, 4);
  for (let t = 0; t < 140; t++) { tick(e, 1); for (let i = 0; i < 48; i++) if (e.tj_projectile(i, 0)) best = Math.max(best, y0 - e.tj_projectile(i, 2) / 1000); }
  return best;
}

test('composite bow (MAP06) flies farther than the base bow; bullets (MAP08) fly fast', () => {
  const e = engine(6); e.tj_item_add(3, 1); e.tj_item_add(4, 30); e.tj_teleport(56 * 16, 40 * 16); e.tj_equip(2); e.tj_face(0); tick(e, 2);
  const base = flight(e);
  e.tj_weapon_tune(...LV[6].quest.COMPOSITE_BOW); tick(e, 60);
  const comp = flight(e);
  assert(comp > base + 40, `composite ${comp} > base ${base}`);
  // MAP08 flintlock (weapons.js profile): a lead round, not an arrow — several times faster.
  const g = engine(8); g.tj_item_add(3, 1); g.tj_item_add(4, 10); g.tj_teleport(49 * 16, 60 * 16); g.tj_equip(2); g.tj_face(0);
  LV[8].quest.applyWeapons(g, {lesson: true}); tick(g, 2);
  fire(g, 32, 1); let fired = 0; for (let t = 0; t < 40 && !fired; t++) { tick(g, 1); fired = projectiles(g); }
  assert.equal(fired, 1); const i = [...Array(48).keys()].find(k => g.tj_projectile(k, 0));
  assert.equal(g.tj_projectile(i, 4), 1, 'a lead round');
  const y1 = g.tj_projectile(i, 2); tick(g, 1); assert(y1 - g.tj_projectile(i, 2) > 12000, 'a round moves > 12 px per tick');
});

test('PPSh (MAP09): a tap fires a burst of three; the Mosin fires one round per press', () => {
  const e = engine(9); e.tj_item_add(2, 1); e.tj_item_add(3, 1); e.tj_item_add(4, 30); e.tj_teleport(46 * 16, 40 * 16); e.tj_equip(2); e.tj_face(0);
  LV[9].quest.applyWeapons(e, {rifle: true, ppsh: true}); tick(e, 2);
  const before = e.tj_item_count(4); fire(e, 32, 2); tick(e, 40);
  assert.equal(before - e.tj_item_count(4), 3);
  const m = engine(9); m.tj_item_add(2, 1); m.tj_item_add(3, 1); m.tj_item_add(4, 30); m.tj_teleport(46 * 16, 40 * 16); m.tj_equip(2); m.tj_face(0);
  LV[9].quest.applyWeapons(m, {rifle: true}); tick(m, 2);
  const b2 = m.tj_item_count(4); fire(m, 32, 2); tick(m, 40);
  assert.equal(b2 - m.tj_item_count(4), 1, 'the Mosin: one round');
});

test('MAP07 noyon: no blow lands while his three banners stand', () => {
  const e = engine(7), i = LV[7].map.enemies.findIndex(en => en.type === 8);
  e.tj_groups(1 << 4); e.tj_teleport(62 * 16, 12 * 16); tick(e, 120);
  for (let k = 0; k < 200 && e.tj_enemy(i, 14) < 2; k++) { e.tj_enemy_damage(i, 30, 0); tick(e, 2); }
  for (let k = 0; k < 200 && !(e.tj_enemy(i, 16) === 7 && e.tj_enemy(i, 1) !== 6); k++) tick(e, 1);   // banners up
  if (e.tj_enemy(i, 16) === 7) { const hp = e.tj_enemy(i, 0); e.tj_enemy_damage(i, 40, 0); assert.equal(e.tj_enemy(i, 0), hp, 'shielded by the banners'); }
  assert(e.tj_enemy(i, 14) >= 2, 'phase 2 reached');
});

test('MAP10 Zulmat: shielded while he writes, stops at the level floor until it is lifted, then falls', () => {
  const e = engine(10), i = LV[10].map.enemies.findIndex(en => en.type === 11), max = 1200;
  e.tj_groups(1 << 4); e.tj_boss_floor(20); e.tj_teleport(42 * 16, 17 * 16); tick(e, 120);
  for (let k = 0; k < 400 && e.tj_enemy(i, 14) < 3; k++) { e.tj_enemy_damage(i, 40, 0); tick(e, 2); }
  assert.equal(e.tj_enemy(i, 14), 3, 'phase 3');
  for (let k = 0; k < 400; k++) { e.tj_enemy_damage(i, 40, 0); tick(e, 2); }
  assert.equal(e.tj_enemy(i, 0), max * 20 / 100, 'held at the floor: the canon takes over');
  e.tj_boss_floor(0);
  for (let k = 0; k < 600 && e.tj_enemy(i, 0) > 0; k++) { e.tj_enemy_damage(i, 40, 0); tick(e, 2); }
  assert.equal(e.tj_enemy(i, 0), 0, 'after the merging he can fall');
});

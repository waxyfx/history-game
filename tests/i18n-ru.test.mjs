// Russian everywhere: after the level loads (src/rpg/ru-pack.js), every dialogue line, quest, zone, name and trial of the
// ten maps has a Russian text, so a Russian-speaking player never gets a Kazakh-only card (the bug of mixed languages).
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadLevel} from '../src/rpg/levels.js';
import {localQuiz} from '../src/rpg/ru-pack.js';

const isLine = v => v && typeof v === 'object' && 'who' in v && 'kk' in v;
const lines = v => Array.isArray(v) ? v.flatMap(lines) : isLine(v) ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(lines) : [];
const cyrKk = /[әғқңөұүһі]/i;   // letters that exist in Kazakh but not in Russian
// Untranslated = a noticeable share of Kazakh words (proper names such as Шежіре, Түйінші, «Менің Қазақстаным» are fine).
const kazakh = s => { const w = String(s).replace(/«[^»]*»/g, '«»').split(/\s+/).filter(Boolean); return w.filter(x => cyrKk.test(x)).length > Math.max(1, w.length * .25); };

for (let n = 1; n <= 10; n++) {
  test(`MAP${String(n).padStart(2, '0')}: every line, quest, zone and trial reads in Russian`, async () => {
    const L = await loadLevel(n);
    const all = [...lines(L.DIALOGUES), ...Object.values(L.HISTORICAL_QUIZZES).flatMap(q => [...lines(q.intro), ...lines(q.branch)])];
    const missing = all.filter(l => !l.ru || (l.ru === l.kk && cyrKk.test(l.kk)) || kazakh(l.ru));
    assert.equal(missing.length, 0, 'lines without Russian: ' + missing.slice(0, 3).map(l => l.kk).join(' | '));
    for (const [k, q] of Object.entries(L.QUESTS)) assert(q.ru?.length === 2 && !kazakh(q.ru[0]) && !kazakh(q.ru[1]), 'quest ' + k);
    assert(!L.ZONE_NAMES.ru.some(kazakh), 'zones: ' + L.ZONE_NAMES.ru.join(', '));
    for (const q of Object.values(L.HISTORICAL_QUIZZES)) {
      const r = localQuiz(q, 'ru');
      for (const s of [r.title, r.questTitle, r.question, r.explanation, ...(r.options || []), ...(r.evidence || []), ...(r.items || []), ...(r.left || []), ...(r.right || []), ...(r.text ? [r.text] : [])]) assert(s && !kazakh(s), `${q.id}: ${s}`);
      if (/^[A-D]\) /.test(q.options?.[0] || '')) assert.deepEqual(r.options.map(o => o.slice(0, 2)), q.options.map(o => o.slice(0, 2)), q.id + ' option letters keep their order');
      for (const k of ['options', 'items', 'left', 'right']) if (q[k]) assert(r[k] !== q[k] || !q[k].some(cyrKk.test.bind(cyrKk)), `${q.id}: ${k} translated`);
      if (q.text) assert(r.text !== q.text && r.text.includes('___'), q.id + ': gap text translated');
      assert.equal(localQuiz(q, 'kk'), q, 'Kazakh stays the source');
    }
  });
}

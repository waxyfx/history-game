// Audit №14: a production build ships no trial answer keys. The Vite plugin (scripts/strip-answer-keys.mjs) removes
// correctIndex, accepted, why, explanation and MAP01's bonus a/w/e from the story modules, and the explanations from the
// Russian packs (src/rpg/ru/mapNN.js); everything else must stay identical.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {stripKeys, removeProp, STORY_FILE} from '../scripts/strip-answer-keys.mjs';

const files = ['story.js', ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `story${String(n).padStart(2, '0')}.js`)];
const noComments = s => s.replace(/^\s*\/\/.*$/gm, '');
const HIDDEN = ['correctIndex', 'why', 'accepted', 'explanation'];
const bare = q => {
  const out = {...q};
  for (const k of HIDDEN) delete out[k];
  if (q.ru) { out.ru = {...q.ru}; delete out.ru.explanation; }
  return out;
};

test('removeProp drops one property with nested arrays, objects and quoted brackets', () => {
  const src = "const q = {id: 'x', why: ['a ] b', {c: [1, 2]}], correctIndex: 2, accepted: 'Па\\'л', options: ['A) ]', 'B)']};";
  const out = removeProp(removeProp(removeProp(src, 'why'), 'correctIndex'), 'accepted');
  assert.equal(out, "const q = {id: 'x', options: ['A) ]', 'B)']};");
});

test('removeProp also drops a quoted (JSON-style) key', () => {
  const src = '{"title": "x", "explanation": "a, \\"b\\" }", "source": "s"}';
  assert.equal(removeProp(src, 'explanation'), '{"title": "x", "source": "s"}');
});

test('the story modules lose their answer keys and explanations and keep everything else', async () => {
  for (const f of files) {
    const url = new URL(`../src/rpg/${f}`, import.meta.url);
    assert(STORY_FILE.test(url.pathname), f);
    const out = stripKeys(await readFile(url, 'utf8'));
    assert(!/\bcorrectIndex\s*:|\baccepted\s*:|\bwhy\s*:|\bexplanation\s*:/.test(noComments(out)), f + ': a key is left');
    const tmp = new URL(`../src/rpg/__stripped_${f}`, import.meta.url);
    await writeFile(tmp, out);
    try {
      const a = await import(url), b = await import(tmp);
      const qa = Object.values(a.HISTORICAL_QUIZZES), qb = Object.values(b.HISTORICAL_QUIZZES);
      assert.equal(qb.length, qa.length, f);
      qb.forEach((q, i) => {
        for (const k of HIDDEN) assert.equal(q[k], undefined, `${q.id}.${k}`);
        assert(qa[i].explanation, qa[i].id + ': the source keeps its explanation');
        assert.deepEqual(bare(q), bare(qa[i]), q.id);
      });
      for (const q of b.BONUS_QUIZ?.questions || []) { assert(!('a' in q) && !('w' in q) && !('e' in q), f + ' bonus'); assert(q.q && q.o && q.ev, f + ' bonus text stays'); }
    } finally { await unlink(tmp); }
  }
});

test('the Russian packs lose their explanations and keep every other text', async () => {
  for (let n = 1; n <= 10; n++) {
    const f = `ru/map${String(n).padStart(2, '0')}.js`, url = new URL(`../src/rpg/${f}`, import.meta.url);
    assert(STORY_FILE.test(url.pathname), f);
    const out = stripKeys(await readFile(url, 'utf8'));
    assert(!/"explanation"\s*:/.test(out), f + ': an explanation is left');
    const tmp = new URL(`../src/rpg/ru/__stripped_${n}.js`, import.meta.url);
    await writeFile(tmp, out);
    try {
      const a = (await import(url)).default, b = (await import(tmp)).default;
      assert.deepEqual(Object.keys(b.quizzes || {}), Object.keys(a.quizzes || {}), f);
      for (const [id, q] of Object.entries(b.quizzes || {})) {
        assert.equal(q.explanation, undefined, id);
        const want = {...a.quizzes[id]}; delete want.explanation; delete want.why;
        assert.deepEqual({...q, why: undefined}, {...want, why: undefined}, id);
      }
      assert.deepEqual(b.lines, a.lines, f + ' lines');
    } finally { await unlink(tmp); }
  }
});

test('the home page bundle drops the old prototype questions and keeps the eras', async () => {
  const {stripLegacyQuestions, CONTENT_FILE} = await import('../scripts/strip-answer-keys.mjs');
  const url = new URL('../src/content.js', import.meta.url);
  assert(CONTENT_FILE.test(url.pathname));
  const out = stripLegacyQuestions(await readFile(url, 'utf8'));
  assert(!/\bquestion\s*:|\bexplanation\s*:/.test(noComments(out)));
  const tmp = new URL('../src/__stripped_content.js', import.meta.url);
  await writeFile(tmp, out);
  try {
    const a = await import(url), b = await import(tmp);
    assert.equal(b.epochs.length, a.epochs.length);
    b.epochs.forEach((e, i) => {
      assert.equal(e.question, undefined); assert.equal(e.explanation, undefined);
      const {question, explanation, ...rest} = a.epochs[i];
      assert.deepEqual(e, rest);
    });
    assert.deepEqual(b.reviewNotes, a.reviewNotes); a.epochs.forEach(e => assert.equal(b.sourceLabel(e.source), a.sourceLabel(e.source)));
  } finally { await unlink(tmp); }
});

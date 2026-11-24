// Audit №14: a production build ships no trial answer keys. The Vite plugin (scripts/strip-answer-keys.mjs) removes
// correctIndex, accepted, why and MAP01's bonus a/w from the story modules; everything else must stay identical.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {stripKeys, removeProp, STORY_FILE} from '../scripts/strip-answer-keys.mjs';

const files = ['story.js', ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `story${String(n).padStart(2, '0')}.js`)];
const noComments = s => s.replace(/^\s*\/\/.*$/gm, '');

test('removeProp drops one property with nested arrays, objects and quoted brackets', () => {
  const src = "const q = {id: 'x', why: ['a ] b', {c: [1, 2]}], correctIndex: 2, accepted: 'Па\\'л', options: ['A) ]', 'B)']};";
  const out = removeProp(removeProp(removeProp(src, 'why'), 'correctIndex'), 'accepted');
  assert.equal(out, "const q = {id: 'x', options: ['A) ]', 'B)']};");
});

test('the story modules lose their answer keys and keep everything else', async () => {
  for (const f of files) {
    const url = new URL(`../src/rpg/${f}`, import.meta.url);
    assert(STORY_FILE.test(url.pathname), f);
    const out = stripKeys(await readFile(url, 'utf8'));
    assert(!/\bcorrectIndex\s*:|\baccepted\s*:|\bwhy\s*:/.test(noComments(out)), f + ': a key is left');
    const tmp = new URL(`../src/rpg/__stripped_${f}`, import.meta.url);
    await writeFile(tmp, out);
    try {
      const a = await import(url), b = await import(tmp);
      const qa = Object.values(a.HISTORICAL_QUIZZES), qb = Object.values(b.HISTORICAL_QUIZZES);
      assert.equal(qb.length, qa.length, f);
      qb.forEach((q, i) => {
        assert.equal(q.correctIndex, undefined, q.id); assert.equal(q.why, undefined, q.id);
        assert.deepEqual({...q, correctIndex: undefined, why: undefined, accepted: undefined}, {...qa[i], correctIndex: undefined, why: undefined, accepted: undefined}, q.id);
      });
      for (const q of b.BONUS_QUIZ?.questions || []) { assert(!('a' in q) && !('w' in q), f + ' bonus'); assert(q.q && q.o && q.e, f + ' bonus text stays'); }
    } finally { await unlink(tmp); }
  }
});

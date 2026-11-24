// Every trial in all ten epochs: the right answer must not stand out by its length (players learned to pick the longest).
import test from 'node:test';
import assert from 'node:assert/strict';

const files = ['story.js', ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `story${String(n).padStart(2, '0')}.js`)];
test('trial options have similar lengths and the correct one is not the giveaway', async () => {
  let n = 0;
  for (const f of files) {
    const S = await import('../src/rpg/' + f);
    for (const q of Object.values(S.HISTORICAL_QUIZZES)) {
      n++;
      // Order, match, gap and map trials have no lettered sentence options to compare (audit №14 trial types).
      if (!['choice', 'artifact'].includes(q.type || 'choice')) continue;
      const L = q.options.map(o => o.length), c = q.correctIndex, sorted = [...L].sort((a, b) => b - a);
      assert(Math.max(...L) / Math.min(...L) <= 1.4, `${q.id}: lengths ${L.join('/')}`);
      assert(!(L[c] === sorted[0] && L[c] > 1.1 * sorted[1]), `${q.id}: the correct option is clearly the longest`);
    }
  }
  assert(n >= 76);
});

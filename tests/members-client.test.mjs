import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfficialRun, profileHTML, isUuid} from '../src/members.js';

const memoryStorage = () => { const m = new Map(); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)}; };

test('Official run client: sends choices only, retries reuse the same request UUID', async () => {
  const calls = []; let failNext = true;
  const rpc = async (name, args) => {
    calls.push([name, args]);
    if (name === 'level_start_run') return {id: '11111111-1111-4111-8111-111111111111', status: 'active', score: 0};
    if (name === 'level_submit_answer' && failNext) { failNext = false; throw new Error('network'); }
    if (name === 'level_submit_answer') return {correct: true, awarded: 100, attempts: 1, run: {id: args[0], status: 'active', score: 100}};
    if (name === 'level_finish_run') return {score: 100, attempt_number: 1};
  };
  const run = createOfficialRun({rpc, storage: memoryStorage()});
  await run.start('solo', 'not-a-uuid');
  assert.deepEqual(calls[0], ['level_start_run', [1, 'solo', null]]);
  await assert.rejects(run.answer('stone_main', 1), /network/);
  const res = await run.answer('stone_main', 1);
  const [first, second] = calls.filter(c => c[0] === 'level_submit_answer');
  assert.equal(first[1][3], second[1][3], 'same request id after a failure');
  assert(isUuid(first[1][3]));
  assert.deepEqual(first[1].slice(0, 3), ['11111111-1111-4111-8111-111111111111', 'stone_main', 1], 'no score in the payload');
  assert.equal(res.awarded, 100); assert.equal(run.run.score, 100);
  await run.answer('stone_cave', 1);
  assert.notEqual(calls.at(-1)[1][3], second[1][3], 'a new answer gets a new request id');
  await run.finish();
  assert.equal(calls.at(-1)[0], 'level_finish_run'); assert.equal(run.active, false);
});

test('Profile HTML escapes user data and rejects non-https avatars', () => {
  const html = profileHTML({name: '<img src=x onerror=alert(1)>', email: 'a@b.kz', role: 'student', avatar_url: 'javascript:alert(1)',
    levels: [{level_id: 1, attempts: 2, best_score: 510, max_score: 750, best_percentage: 68, passed: true, best_duration_seconds: 754}],
    recent: [{level_id: 1, score: 510, max_score: 750, percentage: 68, attempt_number: 2, mode: 'solo', duration_seconds: 754, passed: true, finished_at: new Date().toISOString()}]},
    id => id === 1 ? 'Тас дәуірі' : String(id));
  assert(!html.includes('<img src=x')); assert(!html.includes('javascript:'));
  assert.match(html, /Тас дәуірі/); assert.match(html, /510 \/ 750/); assert.match(html, /12:34/); assert.match(html, /Оқушы/);
});

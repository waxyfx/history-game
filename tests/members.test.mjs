import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Supabase-shaped auth schema: users with Google metadata and auth.identities.
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
    create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users, provider text, provider_id text, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  const dir = new URL('../supabase/migrations/', import.meta.url);
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(f, dir), 'utf8'));
  const as = async (id, role = 'authenticated') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']); await db.exec('set role ' + role); };
  const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as r`, args)).rows[0].r;
  const sys = async (sql, args = []) => { await db.exec('reset role'); return db.query(sql, args); };
  // Simulates what Supabase Auth writes after a Google sign-in (the client never supplies these fields).
  const googleUser = async (name, sub, avatar = 'https://lh3.googleusercontent.com/a/' + sub) => {
    const id = randomUUID();
    await sys(`insert into auth.users values($1,$2,$3,$4)`, [id, name.toLowerCase() + '@school.kz',
      JSON.stringify({full_name: name, avatar_url: avatar, sub, provider_id: sub}), JSON.stringify({provider: 'google', providers: ['google']})]);
    await sys(`insert into auth.identities(user_id,provider,provider_id) values($1,'google',$2)`, [id, sub]);
    await sys(`update auth.users set email=email where id=$1`, [id]); // identity row exists now -> trigger re-syncs
    return id;
  };
  return {db, as, rpc, sys, googleUser};
}
const backdate = (sys, run, seconds) => sys(`update public.level_runs set started_at=clock_timestamp()-make_interval(secs=>$2) where id=$1`, [run, seconds]);

test('Members: Google identity creates a server-side profile with role student', async t => {
  const {db, as, rpc, sys, googleUser} = await setup(); t.after(() => db.close());
  const aru = await googleUser('Ару Сапар', 'google-1001');
  await as(aru);
  const p = await rpc('get_my_profile');
  assert.equal(p.id, aru); assert.equal(p.google_user_id, 'google-1001'); assert.equal(p.name, 'Ару Сапар');
  assert.equal(p.email, 'ару сапар@school.kz'.replace(' ', ' ')); assert.match(p.avatar_url, /^https:\/\/lh3/);
  assert.equal(p.role, 'student'); assert(p.created_at);
  assert.equal(await rpc('get_my_role'), 'student');
  // Clients cannot write profile identity/role directly.
  await assert.rejects(db.query(`update public.profiles set role='admin' where id=$1`, [aru]), /permission denied/);
  await assert.rejects(db.query(`insert into public.profiles(id,display_name,role) values($1,'x','admin')`, [randomUUID()]), /permission denied/);
  // Non-https avatars from metadata are dropped; anon gets nothing.
  const bad = randomUUID();
  await sys(`insert into auth.users values($1,'b@b.kz',$2,'{}')`, [bad, JSON.stringify({name: 'B', avatar_url: 'javascript:alert(1)'})]);
  assert.equal((await sys('select avatar_url from public.profiles where id=$1', [bad])).rows[0].avatar_url, null);
  await as(null, 'anon');
  await assert.rejects(rpc('get_my_profile'), /permission denied/);
  await as(null);
  await assert.rejects(rpc('get_my_profile'), /Кіру қажет/);
});

test('Members: admin role is server-checked and reflected in the profile', async t => {
  const {db, as, rpc, sys, googleUser} = await setup(); t.after(() => db.close());
  const admin = await googleUser('Admin', 'g-admin'), st = await googleUser('Student', 'g-st');
  await sys(`insert into private.user_roles(user_id,role) values($1,'admin')`, [admin]);
  await as(st);
  await assert.rejects(rpc('admin_set_user_role', [admin, 'student']), /Әкімші/);
  await assert.rejects(rpc('admin_get_level_results'), /Құқық/);
  await as(admin);
  assert.equal((await rpc('get_my_profile')).role, 'admin');
  await rpc('admin_set_user_role', [st, 'teacher']); await as(st); assert.equal((await rpc('get_my_profile')).role, 'teacher');
  await as(admin); await rpc('admin_set_user_role', [st, 'player']); await as(st); assert.equal((await rpc('get_my_profile')).role, 'student');
  await as(admin); await assert.rejects(rpc('admin_set_user_role', [st, 'owner']), /Рөл/);
});

test('Results: single-choice trials are scored secretly on the server and cannot be forged', async t => {
  const {db, as, rpc, sys, googleUser} = await setup(); t.after(() => db.close());
  const st = await googleUser('Bek', 'g-bek'), other = await googleUser('Other', 'g-other');
  await as(st);
  const run = await rpc('level_start_run', [1, 'solo', null]);
  assert.equal(run.status, 'active'); assert.equal(run.max_score, 100); assert.equal(run.pass_score, 90);
  assert(run.server_now && run.competition_started_at, 'server clock for the live timer');
  assert.equal(run.score, undefined, 'no score during the run');
  assert.equal((await rpc('level_start_run', [1, 'solo', null])).id, run.id, 'active run is resumed');
  const ans = (quiz, choice, req = randomUUID()) => rpc('level_submit_answer', [run.id, quiz, choice, req]);
  // Wrong choice on a mandatory trial: recorded, no verdict revealed, cannot be changed afterwards.
  const first = await ans('stone_main', 0);
  assert.equal(first.recorded, true); assert.equal(first.correct, undefined); assert.equal(first.awarded, undefined);
  assert.deepEqual(first.run.answered, ['stone_main']);
  assert.equal((await ans('stone_main', 1)).recorded, false, 'one choice per trial');
  const req = randomUUID(); await ans('stone_hunting', 2, req);
  assert.equal((await ans('stone_hunting', 2, req)).duplicate, true);
  await assert.rejects(ans('stone_hunting', 1, req), /басқа деректермен/);
  await ans('stone_cave', 1);
  await assert.rejects(ans('unknown_quiz', 0), /табылмады/);
  await assert.rejects(rpc('level_finish_run', [run.id, randomUUID()]), /соңғы сынағы/);
  await ans('stone_secret', 2); // a wrong final choice is a story branch, not a softlock
  await assert.rejects(rpc('level_finish_run', [run.id, randomUUID()]), /жылдам/);
  await as(other);
  await assert.rejects(rpc('level_submit_answer', [run.id, 'stone_secret', 0, randomUUID()]), /табылмады/);
  assert.equal((await db.query('select * from public.level_runs')).rows.length, 0, 'RLS hides other runs');
  await backdate(sys, run.id, 600);
  await as(st);
  const result = await rpc('level_finish_run', [run.id, randomUUID()]);
  assert.equal(result.score, 40); assert.equal(result.max_score, 100); assert.equal(result.passed, false);
  assert.equal(result.next_level_unlocked, false); assert.equal(result.answers.stone_main.correct, false, 'verdicts only after the level');
  await assert.rejects(db.query(`insert into public.level_results(run_id,user_id,level_id,score,max_score,percentage,started_at,finished_at,duration_seconds,attempt_number,passed,mode) values($1,$2,1,100,100,100,now(),now(),1,9,true,'solo')`, [run.id, st]), /permission denied/);
  await assert.rejects(db.query(`update public.level_results set score=100, passed=true`), /permission denied/);
  await assert.rejects(db.query(`select * from private.official_quiz_keys`), /permission denied/);
  await assert.rejects(db.query(`select * from private.level_run_answers`), /permission denied/);
  const adm = await googleUser('Teacher', 'g-t'); await sys(`insert into private.user_roles values($1,'teacher')`, [adm]);
  await as(adm);
  assert.equal((await rpc('admin_get_level_results', [1, 50, 0]))[0].name, 'Bek');
});

test('Competition: 89 fail, 90 pass, 100 pass, retries, next-level lock and server time', async t => {
  const {db, as, rpc, sys, googleUser} = await setup(); t.after(() => db.close());
  // Configurable weights (operator-side): final 50 + main 39 = 89, + cave 1 = 90, + hunting 10 = 100.
  await sys(`update private.official_quiz_keys set points = 0 where level_id = 1`);
  for (const [q, p] of [['stone_secret', 50], ['stone_main', 39], ['stone_cave', 1], ['stone_hunting', 10]])
    await sys(`update private.official_quiz_keys set points = $2 where level_id = 1 and quiz_id = $1`, [q, p]);
  assert.equal((await sys(`select pass_score, max_score from private.official_level_rules where level_id = 1`)).rows[0].pass_score, 90);
  const st = await googleUser('Aru', 'g-aru');
  await as(st);
  await assert.rejects(rpc('level_start_run', [2, 'solo', null]), /құлыптаулы/, 'level 2 is locked before level 1 is passed');
  const play = async (answers, backSeconds) => {
    const run = await rpc('level_start_run', [1, 'solo', null]);
    for (const [q, c] of answers) await rpc('level_submit_answer', [run.id, q, c, randomUUID()]);
    await backdate(sys, run.id, backSeconds); await as(st);
    return [run, await rpc('level_finish_run', [run.id, randomUUID()])];
  };
  // Attempt 1: 89 -> finished but NOT passed.
  const [run1, r1] = await play([['stone_secret', 0], ['stone_main', 1], ['stone_cave', 0]], 300);
  assert.deepEqual([r1.score, r1.passed, r1.attempt_number, r1.next_level_unlocked], [89, false, 1, false]);
  await assert.rejects(rpc('level_start_run', [2, 'solo', null]), /құлыптаулы/);
  // Attempt 2 starts from zero (previous answers are not carried over): 90 -> PASS, level 2 unlocks.
  const [run2, r2] = await play([['stone_secret', 0], ['stone_main', 1], ['stone_cave', 1]], 200);
  assert.notEqual(run2.id, run1.id); assert.deepEqual(run2.answered, [], 'fresh attempt');
  assert.deepEqual([r2.score, r2.passed, r2.attempt_number, r2.next_level_unlocked, r2.next_level], [90, true, 2, true, 2]);
  // Server time: attempt duration from this run only; competition time keeps counting across attempts.
  assert(r2.duration_seconds >= 200 && r2.duration_seconds < 260, 'attempt duration from server timestamps');
  assert.equal(r2.competition_id, r1.competition_id, 'retries keep the same competition timer');
  assert(r2.competition_seconds >= r1.competition_seconds, 'competition timer is not reset');
  await sys(`update public.competitions set started_at = started_at - interval '1 hour' where id = $1`, [r2.competition_id]);
  await as(st);
  const lvl2 = await rpc('level_start_run', [2, 'solo', null]);
  assert.equal(lvl2.level_id, 2);
  // Another attempt at level 1 after passing: 100 is a pass and gets attempt 3.
  await rpc('level_abandon_run', [lvl2.id]);
  const [, r3] = await play([['stone_secret', 0], ['stone_main', 1], ['stone_cave', 1], ['stone_hunting', 2]], 120);
  assert.deepEqual([r3.score, r3.passed, r3.attempt_number], [100, true, 3]);
  assert(r3.competition_seconds >= 3600, 'competition duration measured from the first official start');
  const prof = await rpc('get_my_profile');
  assert.deepEqual(prof.unlocked_levels, [1, 2]);
  assert.deepEqual([prof.levels[0].attempts, prof.levels[0].best_score, prof.levels[0].passed], [3, 100, true]);
  assert.equal(prof.recent.length, 3, 'failed attempts stay in the statistics');
  // A forged client clock cannot change anything: durations come only from server timestamps.
  const rows = (await sys(`select duration_seconds, extract(epoch from finished_at - started_at)::int as d from public.level_results`)).rows;
  for (const r of rows) assert(Math.abs(r.duration_seconds - r.d) <= 1);
});

test('Results: team mode requires membership of a started session; abandon frees the slot', async t => {
  const {db, as, rpc, sys, googleUser} = await setup(); t.after(() => db.close());
  const teacher = await googleUser('T', 'g-t1'), s1 = await googleUser('S1', 'g-s1'), out = await googleUser('Out', 'g-o');
  await sys(`insert into private.user_roles values($1,'teacher')`, [teacher]);
  await as(teacher); const room = await rpc('create_session', ['Class']);
  await as(s1); await rpc('set_profile', ['S1']); await rpc('join_session', [room.code, 0]);
  await as(out); await rpc('set_profile', ['O']); await rpc('join_session', [room.code, 1]);
  await as(s1); await assert.rejects(rpc('level_start_run', [1, 'team', room.id]), /сессия/);
  await as(teacher); await rpc('start_session', [room.id]);
  await as(s1); const run = await rpc('level_start_run', [1, 'team', room.id]); assert.equal(run.mode, 'team');
  await assert.rejects(rpc('level_start_run', [1, 'team', null]), /сессия/);
  await assert.rejects(rpc('level_start_run', [1, 'solo', room.id]), /сессия/);
  await assert.rejects(rpc('level_start_run', [7, 'solo', null]), /құлыптаулы/);
  await assert.rejects(rpc('level_start_run', [11, 'solo', null]), /табылмады/);
  await rpc('level_abandon_run', [run.id]);
  const fresh = await rpc('level_start_run', [1, 'solo', null]); assert.notEqual(fresh.id, run.id);
});

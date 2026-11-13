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

test('Results: official run is scored on the server and cannot be forged from the client', async t => {
  const {db, as, rpc, sys, googleUser} = await setup(); t.after(() => db.close());
  const st = await googleUser('Bek', 'g-bek'), other = await googleUser('Other', 'g-other');
  await as(st);
  const run = await rpc('level_start_run', [1, 'solo', null]);
  assert.equal(run.status, 'active'); assert.equal(run.score, 0); assert.equal(run.max_score, 750);
  assert.equal((await rpc('level_start_run', [1, 'solo', null])).id, run.id, 'active run is resumed, not duplicated');
  const ans = (quiz, choice, req = randomUUID()) => rpc('level_submit_answer', [run.id, quiz, choice, req]);
  // Main quiz: wrong then right = 60; repeat gives nothing; idempotent replay; altered payload rejected.
  assert.equal((await ans('stone_main', 0)).correct, false);
  const req = randomUUID(), ok = await ans('stone_main', 1, req);
  assert.deepEqual([ok.correct, ok.awarded, ok.attempts], [true, 60, 2]);
  assert.equal((await ans('stone_main', 1, req)).duplicate, true);
  await assert.rejects(ans('stone_main', 2, req), /басқа деректермен/);
  assert.equal((await ans('stone_main', 1)).awarded, 0);
  for (const [q, c] of [['stone_workshop', 1], ['stone_hunting', 2], ['stone_cave', 1]]) assert.equal((await ans(q, c)).awarded, 100);
  // Bonus: only the first answer counts.
  assert.equal((await ans('stone_bonus_1', 3)).awarded, 0);
  assert.equal((await ans('stone_bonus_1', 0)).awarded, 0, 'bonus is closed after the first answer');
  assert.equal((await ans('stone_bonus_2', 0)).awarded, 50);
  await assert.rejects(ans('unknown_quiz', 0), /табылмады/);
  await assert.rejects(ans('stone_cave', 42), /Жауап/);
  // Finishing requires the mandatory quiz and a plausible duration.
  await assert.rejects(rpc('level_finish_run', [run.id, randomUUID()]), /міндетті/);
  await ans('stone_secret', 0);
  await assert.rejects(rpc('level_finish_run', [run.id, randomUUID()]), /жылдам/);
  // Another user can neither see nor touch this run.
  await as(other);
  await assert.rejects(rpc('level_submit_answer', [run.id, 'stone_secret', 0, randomUUID()]), /табылмады/);
  await assert.rejects(rpc('level_finish_run', [run.id, randomUUID()]), /табылмады/);
  assert.equal((await db.query('select * from public.level_runs')).rows.length, 0, 'RLS hides other runs');
  await backdate(sys, run.id, 600);
  await as(st);
  const freq = randomUUID(), result = await rpc('level_finish_run', [run.id, freq]);
  assert.equal(result.score, 60 + 300 + 50 + 100); assert.equal(result.max_score, 750);
  assert.equal(Number(result.percentage), 68); assert.equal(result.attempt_number, 1); assert.equal(result.passed, true);
  assert.equal(result.mode, 'solo'); assert(result.duration_seconds >= 600);
  assert.equal((await rpc('level_finish_run', [run.id, freq])).duplicate, true);
  await assert.rejects(rpc('level_finish_run', [run.id, randomUUID()]), /аяқталған/);
  await assert.rejects(ans('stone_cave', 1), /аяқталған/);
  // Direct writes to results are impossible for students.
  await assert.rejects(db.query(`insert into public.level_results(run_id,user_id,level_id,score,max_score,percentage,started_at,finished_at,duration_seconds,attempt_number,passed,mode) values($1,$2,1,750,750,100,now(),now(),1,9,true,'solo')`, [run.id, st]), /permission denied/);
  await assert.rejects(db.query(`update public.level_results set score=750`), /permission denied/);
  await assert.rejects(db.query(`delete from public.level_results`), /permission denied/);
  await assert.rejects(db.query(`select * from private.official_quiz_keys`), /permission denied/);
  // Second attempt: separate record, attempt_number 2, failing score kept as not passed.
  const run2 = await rpc('level_start_run', [1, 'solo', null]);
  assert.notEqual(run2.id, run.id);
  await rpc('level_submit_answer', [run2.id, 'stone_secret', 1, randomUUID()]);
  await rpc('level_submit_answer', [run2.id, 'stone_secret', 2, randomUUID()]);
  await rpc('level_submit_answer', [run2.id, 'stone_secret', 0, randomUUID()]);
  await backdate(sys, run2.id, 120);
  const r2 = await rpc('level_finish_run', [run2.id, randomUUID()]);
  assert.deepEqual([r2.score, r2.attempt_number, r2.passed], [30, 2, false]);
  const prof = await rpc('get_my_profile');
  assert.deepEqual([prof.levels[0].attempts, prof.levels[0].best_score, prof.levels[0].passed], [2, 510, true]);
  assert.equal(prof.recent.length, 2); assert.equal(prof.recent[0].attempt_number, 2);
  // Teachers/admins read results via RPC; other students do not see them.
  await as(other); assert.equal((await db.query('select * from public.level_results')).rows.length, 0);
  const adm = await googleUser('Teacher', 'g-t'); await sys(`insert into private.user_roles values($1,'teacher')`, [adm]);
  await as(adm);
  const list = await rpc('admin_get_level_results', [1, 50, 0]);
  assert.equal(list.length, 2); assert.equal(list[0].name, 'Bek');
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
  await assert.rejects(rpc('level_start_run', [7, 'solo', null]), /табылмады/);
  await rpc('level_abandon_run', [run.id]);
  const fresh = await rpc('level_start_run', [1, 'solo', null]); assert.notEqual(fresh.id, run.id);
});

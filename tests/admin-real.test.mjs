import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

// Same Supabase-shaped setup as tests/members.test.mjs: all migrations, Google users, role switching.
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
  const googleUser = async (name, sub) => {
    const id = randomUUID();
    await sys(`insert into auth.users values($1,$2,$3,$4)`, [id, sub + '@school.kz',
      JSON.stringify({full_name: name, avatar_url: 'https://lh3.googleusercontent.com/a/' + sub, sub, provider_id: sub}), JSON.stringify({provider: 'google', providers: ['google']})]);
    await sys(`insert into auth.identities(user_id,provider,provider_id) values($1,'google',$2)`, [id, sub]);
    await sys(`update auth.users set email=email where id=$1`, [id]);
    return id;
  };
  // One official MAP01 run with the given trial choices, finished after the minimum time.
  const play = async (user, answers) => {
    await as(user);
    const run = await rpc('level_start_run', [1, 'solo', null]);
    for (const [q, c] of answers) await rpc('level_submit_answer', [run.id, q, c, randomUUID()]);
    await sys(`update public.level_runs set started_at=clock_timestamp()-interval '5 minutes' where id=$1`, [run.id]);
    await as(user);
    return rpc('level_finish_run', [run.id, randomUUID()]);
  };
  return {db, as, rpc, sys, googleUser, play};
}

test('Admin panel data: only teachers and admins, built from real profiles and results', async t => {
  const {db, as, rpc, sys, googleUser, play} = await setup(); t.after(() => db.close());
  const admin = await googleUser('Admin Aqyl', 'g-admin'), teacher = await googleUser('Teacher Dana', 'g-teacher');
  const aru = await googleUser('Aru Sapar', 'g-aru'), beks = await googleUser('Beks Nur', 'g-beks');
  await sys(`insert into private.user_roles(user_id,role) values($1,'admin'),($2,'teacher')`, [admin, teacher]);

  // Aru passes MAP01 (final 30 + two mandatory 20 = 70 >= 60); Beks fails (only the final, 30).
  const pass = await play(aru, [['stone_secret', 0], ['stone_main', 1], ['stone_cave', 1]]);
  const fail = await play(beks, [['stone_secret', 0], ['stone_main', 0]]);
  assert.equal(pass.passed, true); assert.equal(fail.passed, false);

  // Students and anonymous callers are rejected.
  await as(aru);
  for (const [name, args] of [['admin_overview', []], ['admin_list_users', [null, 50, 0]], ['admin_trial_stats', [1]]])
    await assert.rejects(rpc(name, args), /Мұғалім немесе Әкімші/, name + ' is teacher/admin only');
  await as(null, 'anon');
  await assert.rejects(rpc('admin_overview'), /permission denied|Кіру қажет/);

  // Overview counts the real tables.
  await as(teacher);
  const o = await rpc('admin_overview');
  assert.deepEqual([o.users, o.students, o.teachers, o.admins], [4, 2, 1, 1]);
  assert.deepEqual([o.results, o.passed, o.players_with_results, o.runs_active], [2, 1, 2, 0]);
  const l1 = o.levels.find(l => l.level_id === 1);
  assert.deepEqual([l1.attempts, l1.players, l1.passed_players, l1.pass_score, l1.max_score], [2, 2, 1, 60, 100]);
  assert(l1.trials >= 4, 'MAP01 has its trial keys');
  assert.equal(o.levels.length, 10);
  assert.deepEqual(o.recent.map(r => r.name).sort(), ['Aru Sapar', 'Beks Nur']);

  // Users: e-mail only for admins; search by name; result summary per person.
  const asTeacher = await rpc('admin_list_users', [null, 50, 0]);
  assert.equal(asTeacher.length, 4);
  assert(asTeacher.every(u => u.email == null), 'teachers do not see e-mail addresses');
  await as(admin);
  const asAdmin = await rpc('admin_list_users', [null, 50, 0]);
  const aruRow = asAdmin.find(u => u.user_id === aru);
  assert.equal(aruRow.email, 'g-aru@school.kz');
  assert.deepEqual([aruRow.role, aruRow.attempts, aruRow.levels_passed, aruRow.max_level_passed, aruRow.best_total], ['student', 1, 1, 1, pass.score]);
  assert.deepEqual((await rpc('admin_list_users', ['beks', 50, 0])).map(u => u.name), ['Beks Nur']);
  assert.deepEqual((await rpc('admin_list_users', ['%', 50, 0])).length, 0, 'search is literal text, not a LIKE pattern');

  // Trial statistics: counts only, never the answer keys.
  const stats = await rpc('admin_trial_stats', [1]);
  const byId = Object.fromEntries(stats.map(s => [s.quiz_id, s]));
  assert.deepEqual([byId.stone_secret.answered_count, byId.stone_secret.right_count], [2, 2]);
  assert.deepEqual([byId.stone_main.answered_count, byId.stone_main.right_count], [2, 1]);
  assert.deepEqual([byId.stone_cave.answered_count, byId.stone_cave.right_count], [1, 1]);
  assert(stats.every(s => !('correct' in s) && !('choice' in s)), 'no answer key or chosen option is exposed');

  // The admin can change a role through the existing server function; the overview follows.
  await rpc('admin_set_user_role', [beks, 'teacher']);
  assert.equal((await rpc('admin_overview')).teachers, 2);
});

// Migration 025: class sessions from the teacher panel (audit №14: no class session, no team rating).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

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
  const user = async name => {
    const id = randomUUID();
    await sys(`insert into auth.users values($1,$2,$3,$4)`, [id, name.toLowerCase() + '@school.kz', JSON.stringify({full_name: name}), JSON.stringify({provider: 'email'})]);
    return id;
  };
  return {db, as, rpc, sys, user};
}
// MAP02: the three mandatory trials and the final one, right or wrong.
const MAP02 = {bronze_metal: 1, bronze_economy: 2, bronze_burial: 0, bronze_tablet: 1};
async function playMap02(ctx, id, session, wrong = []) {
  await ctx.as(id);
  const run = await ctx.rpc('level_start_run', [2, 'team', session]);
  for (const [q, k] of Object.entries(MAP02)) await ctx.rpc('level_submit_answer', [run.id, q, wrong.includes(q) ? (k + 1) % 3 : k, randomUUID()]);
  await ctx.sys(`update public.level_runs set started_at=clock_timestamp()-interval '10 minutes' where id=$1`, [run.id]);
  await ctx.as(id);
  return ctx.rpc('level_finish_run', [run.id, randomUUID()]);
}

test('class session: a teacher opens an epoch for the class, two teams play it, the panel shows the table', async t => {
  const ctx = await setup(); t.after(() => ctx.db.close());
  const {as, rpc, sys, user} = ctx;
  const teacher = await user('Apai'), other = await user('Agai'), aru = await user('Aru'), bek = await user('Bek'), dana = await user('Dana');
  await sys(`insert into private.user_roles(user_id,role) values($1,'teacher'),($2,'teacher')`, [teacher, other]);

  await as(aru);
  await assert.rejects(rpc('class_session_create', ['8А', 2]), /Мұғалім/, 'a student cannot create a session');
  await as(null, 'anon');
  await assert.rejects(rpc('class_session_list'), /permission denied/);

  await as(teacher);
  await assert.rejects(rpc('class_session_create', ['8А', 11]), /Дәуір/);
  const s = await rpc('class_session_create', ['8А · Қола дәуірі', 2]);
  assert.equal(s.status, 'lobby'); assert.equal(s.level_id, 2); assert.equal(s.code.length, 10);
  assert.deepEqual((await rpc('class_session_list')).map(x => x.id), [s.id]);
  await as(other);
  assert.deepEqual(await rpc('class_session_list'), [], 'another teacher does not see it');
  await assert.rejects(rpc('class_session_start', [s.id]), /Құқық/);

  await as(aru); assert.equal((await rpc('class_session_join', [s.code.toLowerCase(), 0])).team, 0);
  await as(bek); await rpc('class_session_join', [s.code, 1]);
  await as(aru);
  await assert.rejects(rpc('level_start_run', [2, 'team', s.id]), /басталған сессия/, 'not before the teacher starts');
  await assert.rejects(rpc('level_start_run', [2, 'solo', null]), /құлыптаулы/, 'MAP02 is still locked on its own');
  await rpc('level_start_run', [1, 'solo', null]);   // an unfinished solo run must not swallow the class run (other level)

  await as(teacher);
  assert.equal((await rpc('class_session_start', [s.id])).status, 'started');
  await as(dana); assert.equal((await rpc('class_session_join', [s.code, 1])).team, 1, 'a late student may join');
  await as(aru);
  await assert.rejects(rpc('level_start_run', [3, 'team', s.id]), /басқа дәуірге/);
  const r1 = await playMap02(ctx, aru, s.id);
  assert.equal(r1.passed, true);
  const r2 = await playMap02(ctx, bek, s.id, ['bronze_metal', 'bronze_economy']);
  assert.equal(r2.passed, false);
  await as(dana); await rpc('level_start_run', [2, 'team', s.id]);   // still playing

  await as(teacher);
  const res = await rpc('class_session_results', [s.id]);
  assert.equal(res.session.members, 3);
  assert.deepEqual(res.members.map(m => [m.name, m.team, m.passed, m.playing]), [['Aru', 0, true, false], ['Bek', 1, false, false], ['Dana', 1, null, true]]);
  assert(res.members[0].score > res.members[1].score);
  assert.deepEqual(res.teams.map(g => [g.team, g.members, g.finished, g.passed]), [[0, 1, 1, 1], [1, 2, 1, 0]]);
  await as(bek);
  await assert.rejects(rpc('class_session_results', [s.id]), /Мұғалім/, 'students do not see the class table');

  await as(teacher);
  assert.equal((await rpc('class_session_close', [s.id])).status, 'closed');
  await as(dana);
  await assert.rejects(rpc('class_session_join', [s.code, 0]), /жабылған/);
  const after = await user('Erlan'); await as(after);
  await assert.rejects(rpc('level_start_run', [2, 'solo', null]), /құлыптаулы/, 'a closed session opens nothing');
});

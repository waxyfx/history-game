// Audit №14 follow-up: trial explanations named the right option, so a production build ships none (strip-keys) and
// the server hands each one out only after the player's choice, for a finished level, or to a teacher (migration 024).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {explanationRows, explanationsSQL, MIGRATION} from '../scripts/explanations-sql.mjs';

test('migration 024 is up to date with the story modules and the Russian packs', async () => {
  const rows = await explanationRows();
  assert.equal(rows.length, 99, 'every trial of the ten maps has an explanation');
  for (const [n, id, kk, ru] of rows) assert(kk && ru, `MAP${n} ${id}: kk and ru`);
  assert.equal(await readFile(MIGRATION, 'utf8'), explanationsSQL(rows), 'run: node scripts/explanations-sql.mjs');
});

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
    await sys(`insert into auth.users values($1,$2,$3,$4)`, [id, name + '@school.kz', JSON.stringify({full_name: name}), JSON.stringify({provider: 'email'})]);
    return id;
  };
  return {db, as, rpc, sys, user};
}

test('trial_explain: nothing before the choice, the answered trial after it, everything for a teacher', async t => {
  const {db, as, rpc, sys, user} = await setup(); t.after(() => db.close());
  const st = await user('bek'), teacher = await user('apai');
  await sys(`insert into private.user_roles(user_id,role) values($1,'teacher')`, [teacher]);
  await as(null, 'anon');
  await assert.rejects(rpc('trial_explain', [1, ['stone_main']]), /permission denied/);
  await assert.rejects(db.query('select * from private.trial_explanations'), /permission denied/);
  await as(st);
  await assert.rejects(db.query('select * from private.trial_explanations'), /permission denied/, 'no direct reads');
  assert.deepEqual(await rpc('trial_explain', [1, ['stone_main', 'stone_cave']]), {}, 'closed before the choice');
  const run = await rpc('level_start_run', [1, 'solo', null]);
  await rpc('level_submit_answer', [run.id, 'stone_main', 0, randomUUID()]);
  const r = await rpc('trial_explain', [1, ['stone_main', 'stone_cave']]);
  assert.deepEqual(Object.keys(r), ['stone_main'], 'only the answered trial');
  assert.match(r.stone_main.kk, /Палеолит/); assert.match(r.stone_main.ru, /Палеолит/);
  assert.deepEqual(await rpc('trial_explain', [2, ['stone_main']]), {}, 'another level stays closed');
  await assert.rejects(rpc('trial_explain', [1, Array.from({length: 41}, (_, i) => 'q' + i)]), /тізімі/);
  await as(teacher);
  const all = await rpc('trial_explain', [1, ['stone_main', 'stone_cave', 'stone_hunting']]);
  assert.deepEqual(Object.keys(all).sort(), ['stone_cave', 'stone_hunting', 'stone_main']);
});

test('every positional rpc() call of the game has its named parameters, matching the SQL function', async () => {
  const main = await readFile(new URL('../src/rpg/main.js', import.meta.url), 'utf8');
  const table = main.match(/const RPC_PARAMS = (\{[\s\S]*?\});/)[1];
  const params = Function(`return ${table}`)();
  const calls = [...new Set([...main.matchAll(/\brpc\('([a-z_]+)',\s*\[/g)].map(m => m[1]))];
  assert(calls.includes('trial_check') && calls.includes('rpg_save_put') && calls.includes('trial_explain'), calls.join());
  const dir = new URL('../supabase/migrations/', import.meta.url);
  let sql = '';
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) sql += await readFile(new URL(f, dir), 'utf8');
  for (const name of [...calls, ...Object.keys(params)]) {
    assert(params[name], `${name}: missing in RPC_PARAMS (Supabase would get {} and answer PGRST202)`);
    const defs = [...sql.matchAll(new RegExp(`create (?:or replace )?function public\\.${name}\\(([^)]*)\\)`, 'gi'))];
    assert(defs.length, name + ': no SQL function');
    const args = defs.at(-1)[1].split(',').map(a => a.trim().split(/\s+/)[0]).filter(Boolean);
    assert.deepEqual(params[name], args, name);
  }
});

test('the home page counts every trial of the game', async () => {
  const {loadLevel, LEVEL_IDS} = await import('../src/rpg/levels.js');
  let total = 0;
  for (const n of LEVEL_IDS) { const L = await loadLevel(n); total += Object.keys(L.HISTORICAL_QUIZZES).length + (L.BONUS_QUIZ?.questions?.length || 0); }
  const home = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.equal(Number(home.match(/<b>(\d+)<\/b><span>тарихи сынақ/)[1]), total);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// PostgREST runs STABLE/IMMUTABLE functions in a READ ONLY transaction. A public RPC that checks the caller through
// private.require_user / require_teacher* writes a rate-limit row, so it must be VOLATILE or it fails on Supabase with
// «cannot execute INSERT in a read-only transaction» (migration 026). This checks every public function after all
// migrations, and replays one such call the way PostgREST does to show the failure mode is real.
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);
    create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users, provider text, provider_id text, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  const dir = new URL('../supabase/migrations/', import.meta.url);
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(f, dir), 'utf8'));
  return db;
}

test('RPC: functions that check the caller are VOLATILE (PostgREST read-only transactions)', async t => {
  const db = await setup(); t.after(() => db.close());
  const {rows} = await db.query(`select p.proname, p.provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.provolatile in ('s','i') and p.prosrc ~ 'require_(user|teacher)'`);
  assert.deepEqual(rows.map(r => r.proname).sort(), [], 'public functions that write a rate-limit row must not be STABLE/IMMUTABLE');

  // What PostgREST does for a STABLE function: the same call inside a read-only transaction fails.
  const user = '00000000-0000-4000-8000-000000000001';
  await db.query(`insert into auth.users values($1,'u@school.kz','{}','{}')`, [user]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('begin read only');
  await assert.rejects(db.query('select private.require_user()'), /read-only transaction/);
  await db.exec('rollback');
});

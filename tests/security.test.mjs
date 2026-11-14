import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

test('Security regressions across every migration', async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 const admin=randomUUID(),player=randomUUID(),other=randomUUID();
 for(const id of [admin,player,other])await db.query('insert into auth.users values($1)',[id]);
 await db.query("insert into private.user_roles(user_id,role) values($1,'admin')",[admin]);
 async function as(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);}
 const rpc=async(name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
 await as(admin);const room=await rpc('create_session',['Security test']);
 await as(player);await rpc('set_profile',['Player']);await rpc('join_session',[room.code,0]);
 await as(other);await rpc('set_profile',['Other']);await rpc('join_session',[room.code,1]);
 await as(admin);await rpc('start_session',[room.id]);
 await as(player);const run=await rpc('v2_start_run',[room.id]);
 const submit=(value,req=randomUUID(),quiz='quiz_stone_main')=>rpc('v2_submit_epoch_answer',[run.id,quiz,JSON.stringify(value),req]);
 await t.test('Repeated rewards and altered idempotency payloads',async()=>{
  const req=randomUUID();const first=await submit('Палеолит',req);assert.equal(first.awarded,100);
  assert.equal((await submit('Палеолит',req)).duplicate,true);
  await assert.rejects(submit('Неолит',req),/another action/);
  const retries=await Promise.all([submit('Палеолит'),submit('Палеолит')]);
  assert.deepEqual(retries.map(r=>r.awarded),[0,0]);
  assert.equal((await rpc('v2_run_state',[run.id])).score,100);
  await as(other);await assert.rejects(submit('Палеолит',req),/access denied/);
  await as(player);
 });
 await t.test('Wrong answers increment attempts and reduce rewards',async()=>{
  assert.equal((await submit('Wrong',randomUUID(),'quiz_stone_workshop')).attempts,1);
  const correct=await submit('Чоппер',randomUUID(),'quiz_stone_workshop');
  assert.equal(correct.attempts,2);assert.equal(correct.awarded,60);
 });
 await t.test('Invalid input and direct mutation are denied',async()=>{
  for(const value of [null,{},'x'.repeat(1501)])await assert.rejects(submit(value),/Invalid answer/);
  await assert.rejects(db.exec('update public.epoch_quiz_attempts set awarded=100'),/permission denied/);
  assert.equal((await db.query('select * from public.dynamic_quizzes')).rows.length,0);
  await as(admin);await assert.rejects(rpc('admin_get_players',[null,null,0]),/pagination/);
  await assert.rejects(rpc('admin_upsert_quiz',['xx',1,'main','Question',null,'["A"]','Explanation',true]),/Invalid quiz/);
  await as(player);
 });
 await t.test('Unpublished quizzes and anonymous RPC execution are denied',async()=>{
  const quizzes=await rpc('v2_get_epoch_quizzes',[1]);assert.ok(quizzes.length);assert.equal(quizzes[0].explanation,undefined);
  await as(admin);await rpc('admin_set_epoch_published',[1,false]);
  await as(player);assert.deepEqual(await rpc('v2_get_epoch_quizzes',[1]),[]);
  await assert.rejects(submit('Садақ пен жебе',randomUUID(),'quiz_stone_hunting'),/not available/);
  await as(null,'anon');await assert.rejects(rpc('v2_get_epoch_quizzes',[1]),/permission denied/);
  await as(admin);await rpc('admin_set_epoch_published',[1,true]);
 });
 await t.test('Role grants and revocations agree with legacy session authorization',async()=>{
  await rpc('admin_set_user_role',[other,'teacher']);await as(other);await rpc('create_session',['Allowed']);
  await as(admin);await rpc('admin_set_user_role',[other,'player']);await as(other);
  await assert.rejects(rpc('create_session',['Forbidden']),/Мұғалім/);
 });
 await t.test('Failed runs and foreign epochs reject rewards; score cap does not block legacy completion',async()=>{
  await db.exec('reset role');await db.query("update public.game_runs set status='failed' where id=$1",[run.id]);
  await as(player);await assert.rejects(submit('Садақ пен жебе',randomUUID(),'quiz_stone_hunting'),/not active/);
  await db.exec('reset role');await db.query("update public.game_runs set status='active',level=2 where id=$1",[run.id]);
  await as(player);await assert.rejects(submit('Садақ пен жебе',randomUUID(),'quiz_stone_hunting'),/not available/);
  await db.exec('reset role');await db.query('update public.game_runs set level=1,score=990 where id=$1',[run.id]);
  await as(player);const result=await rpc('v2_submit_answer',[run.id,'stone',JSON.stringify('Палеолит'),'main',randomUUID()]);
  assert.equal(result.run.score,1000);assert.equal(result.run.stage,'exit');
  assert.equal((await rpc('v2_finish_level',[run.id,1,randomUUID()])).run.level,2);
 });
 await t.test('Closed sessions cannot earn new rewards',async()=>{
  await as(admin);await rpc('close_session',[room.id]);await as(player);
  await assert.rejects(submit('Садақ пен жебе',randomUUID(),'quiz_stone_hunting'),/not active/);
 });
});

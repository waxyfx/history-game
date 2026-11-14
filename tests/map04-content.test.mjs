import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {HISTORICAL_QUIZZES,FACTS,DIALOGUES,SPEAKERS} from '../src/rpg/story04.js';

const sql=await readFile(new URL('../supabase/migrations/010_hun_era.sql',import.meta.url),'utf8');
const trials=Object.values(HISTORICAL_QUIZZES);
const keys=Object.fromEntries([...sql.matchAll(/\(4, '(hun_\w+)', '(main|final|secret)', (\d), (\d+)\)/g)].map(m=>[m[1],{kind:m[2],correct:+m[3],points:+m[4]}]));

test('MAP04 private keys match all eight Kazakh trials and the 90/100 scoring contract',()=>{
 assert.equal(trials.length,8);assert.equal(Object.keys(keys).length,8);
 for(const q of trials){
  assert.deepEqual(keys[q.id],{kind:q.tier,correct:q.correctIndex,points:q.points},q.id);
  assert.equal(q.epoch,4);assert.equal(q.options.length,4);assert.match(q.question,/[әғқңөұүһі]/i);
  assert(q.source&&q.explanation&&q.evidence.length&&q.branch.ok.length&&q.branch.no.length,q.id);
 }
 assert.equal(trials.reduce((n,q)=>n+q.points,0),100);
 assert.equal(trials.filter(q=>q.tier!=='secret').reduce((n,q)=>n+q.points,0),90);
 assert.match(sql,/required_quiz = 'hun_final' where level_id = 4/);
 for(const line of Object.values(DIALOGUES).flat())assert(SPEAKERS[line.who]&&line.kk,'known Kazakh speaker');
});

test('MAP04 distinguishes the 36 BCE siege, fictional Feng Liao meeting and the scope of genetic evidence',()=>{
 assert.match(FACTS.zhizhi.kk,/36/);
 assert.match(FACTS.fengliao.kk,/40.*расталмаған/);
 const final=trials.find(q=>q.id==='hun_final');
 assert.match(final.source,/10\.1073\/pnas\.2418485122/);
 assert.match(final.options[final.correctIndex],/кейбір.*генетикалық/);
 assert.match(final.explanation,/2025/);
 assert.match(trials.find(q=>q.id==='hun_script').options[1],/дәлелдемейді/);
 assert.match(trials.find(q=>q.id==='hun_fort').explanation,/Дулай.*Талас/);
});

test('MAP04 official SQL: locked progression, private answers, one-shot scoring and final requirement',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
 create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,provider text,provider_id text,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 const user=randomUUID(),other=randomUUID();
 for(const id of [user,other])await db.query("insert into auth.users values($1,'test@example.invalid','{}','{}')",[id]);
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
 async function sys(query,args=[]){await db.exec('reset role');return db.query(query,args);}
 const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
 async function finish(run){await sys("update public.level_runs set started_at=clock_timestamp()-interval '10 minutes' where id=$1",[run.id]);await as(user);return rpc('level_finish_run',[run.id,randomUUID()]);}
 await as(user);await assert.rejects(rpc('level_start_run',[4,'solo',null]),/құлыптаулы/);
 // Unlock MAP04 through real official RPC results, not a client/local unlock flag.
 for(let level=1;level<=3;level++){
  const qs=(await sys("select quiz_id,correct from private.official_quiz_keys where level_id=$1 and kind in ('main','final')",[level])).rows;
  await as(user);const run=await rpc('level_start_run',[level,'solo',null]);
  for(const q of qs)await rpc('level_submit_answer',[run.id,q.quiz_id,q.correct,randomUUID()]);
  assert.equal((await finish(run)).passed,true);
 }
 await t.test('Mandatory trials produce 90; answers are hidden and cannot be changed or duplicated',async()=>{
  const run=await rpc('level_start_run',[4,'solo',null]);assert.equal(run.pass_score,90);assert.equal(run.max_score,100);
  await assert.rejects(db.query('select * from private.official_quiz_keys where level_id=4'),/permission denied/);
  await assert.rejects(rpc('level_submit_answer',[run.id,'saka_final',3,randomUUID()]),/табылмады/);
  await assert.rejects(rpc('level_finish_run',[run.id,randomUUID()]),/соңғы сынағы/);
  const request=randomUUID();const args=[run.id,'hun_script',1,request];
  const result=await rpc('level_submit_answer',args);assert.equal(result.correct,undefined);assert.equal(result.awarded,undefined);
  assert.equal((await rpc('level_submit_answer',args)).duplicate,true);
  await assert.rejects(rpc('level_submit_answer',[run.id,'hun_script',0,request]),/басқа деректермен/);
  await as(other);await assert.rejects(rpc('level_submit_answer',args),/табылмады/);await as(user);
  assert.equal((await rpc('level_submit_answer',[run.id,'hun_script',0,randomUUID()])).recorded,false);
  for(const q of trials.filter(q=>q.tier!=='secret'&&q.id!=='hun_script'))await rpc('level_submit_answer',[run.id,q.id,q.correctIndex,randomUUID()]);
  const finished=await finish(run);assert.equal(finished.score,90);assert.equal(finished.passed,true);
 });
 await t.test('All trials yield 100; a wrong final completes with 70 and fails without blocking the result',async()=>{
  for(const wrongFinal of [false,true]){
   await sys('update private.rate_limits set calls=0');await as(user);
   const run=await rpc('level_start_run',[4,'solo',null]);
   for(const q of trials)await rpc('level_submit_answer',[run.id,q.id,wrongFinal&&q.tier==='final'?(q.correctIndex+1)%4:q.correctIndex,randomUUID()]);
   const finished=await finish(run);assert.equal(finished.score,wrongFinal?70:100);assert.equal(finished.passed,!wrongFinal);
  }
 });
});

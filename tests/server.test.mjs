import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {answers} from '../scripts/answers.mjs';

test('PostgreSQL: authoritative runs, retries, branches, history and permissions',async t=>{
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const migrationDir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of (await readdir(migrationDir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,migrationDir),'utf8'));
 const teacher=randomUUID(),bob=randomUUID(),cara=randomUUID(),outsider=randomUUID();
 for(const u of [teacher,bob,cara,outsider])await db.query('insert into auth.users values($1)',[u]);
 await db.query('insert into private.teachers values($1)',[teacher]);
 async function as(u,role='authenticated'){
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u||'']);
  await db.exec('set role '+role);
 }
 async function rpc(name,args=[]){return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;}
 async function admin(sql,args=[]){await db.exec('reset role');return db.query(sql,args);}
 const answer=(run,id,value,phase='main',req=randomUUID())=>rpc('v2_submit_answer',[run,id,JSON.stringify(value),phase,req]);
 const branch=(run,id,req=randomUUID())=>rpc('v2_complete_branch',[run,id,req]);
 const finish=(run,level,req=randomUUID())=>rpc('v2_finish_level',[run,level,req]);
 let room,rb,rc;
 await t.test('Authentication, teacher-only session creation and fixed roster',async()=>{
  await as(bob);await assert.rejects(rpc('create_session',['Forbidden']),/Мұғалім/);
  await as(teacher);room=await rpc('create_session',['Сынақ сессиясы']);
  await as(bob);await rpc('set_profile',['Бек']);await rpc('join_session',[room.code,0]);
  await as(cara);await rpc('set_profile',['Ару']);await rpc('join_session',[room.code,1]);
  await as(bob);await assert.rejects(rpc('start_session',[room.id]),/Құқық/);
  await as(teacher);await rpc('start_session',[room.id]);
  await as(bob);await rpc('join_session',[room.code,1]);
  await as(outsider);await rpc('set_profile',['Сыртқы']);await assert.rejects(rpc('join_session',[room.code,1]),/бекітілген/);
  await assert.rejects(rpc('v2_start_run',[room.id]),/рұқсат/);
  await as(bob);rb=await rpc('v2_start_run',[room.id]);const repeated=await rpc('v2_start_run',[room.id]);assert.equal(repeated.id,rb.id);assert.equal(rb.score,0);assert.equal(rb.lives,3);
  const roster=await rpc('v2_room_state',[room.id]);assert.equal(roster.members.find(m=>m.name==='Бек').team,0);
  await as(cara);rc=await rpc('v2_start_run',[room.id]);
  await as(null,'anon');await assert.rejects(rpc('v2_start_run',[room.id]),/permission denied/);
 });
 await t.test('Direct writes, answer keys and other players history are inaccessible',async()=>{
  await as(bob);await assert.rejects(db.query('update public.game_runs set score=1000 where id=$1',[rb.id]),/permission denied/);
  await assert.rejects(db.query('delete from public.run_questions'),/permission denied/);
  await assert.rejects(db.query('select * from private.questions'),/permission denied/);
  assert.deepEqual((await db.query('select id from public.game_runs where id=$1',[rc.id])).rows,[]);
  await assert.rejects(rpc('v2_run_state',[rc.id]),/рұқсат/);
  await assert.rejects(answer(rc.id,'stone','Палеолит'),/рұқсат/);
  await assert.rejects(rpc('submit_answer',[room.id,'stone','"Палеолит"','main']),/permission denied/);
  await assert.rejects(rpc('finish_level',[room.id,1]),/permission denied/);
 });
 await t.test('A level requires its mandatory answer; rescue gives no points or scored attempts',async()=>{
  await as(bob);await assert.rejects(finish(rb.id,1),/міндетті/);
  await assert.rejects(answer(rb.id,'bronze',answers.bronze[0]),/ретімен/);
  const res=await answer(rb.id,'stone','Палеолит','rescue');assert.equal(res.correct,true);assert.equal(res.awarded,0);assert.equal(res.run.score,0);assert.deepEqual(res.run.answers,{});assert.equal(res.run.stage,'study');
  await assert.rejects(answer(rb.id,'stone',null),/пішімі/);
 });
 await t.test('First wrong request is idempotent; retry is blocked until alternative completed',async()=>{
  await as(bob);const req=randomUUID();const first=await answer(rb.id,'stone','Қате','main',req);
  assert.equal(first.attempts,1);assert.equal(first.run.stage,'fragment');assert.equal(first.run.score,0);
  const replay=await answer(rb.id,'stone','Қате','main',req);assert.equal(replay.attempts,1);assert.equal(replay.duplicate,true);
  await assert.rejects(answer(rb.id,'stone','Палеолит','main',req),/басқа әрекет/);
  await assert.rejects(answer(rb.id,'stone','Палеолит','repair'),/баламалы/);
  const br=randomUUID();assert.equal((await branch(rb.id,'stone',br)).stage,'repair');assert.equal((await branch(rb.id,'stone',br)).stage,'repair');
  await assert.rejects(branch(rb.id,'stone'),/ашық емес/);
  const bad=await answer(rb.id,'stone','Қате','repair');assert.equal(bad.attempts,2);assert.equal(bad.run.stage,'fragment');
  await branch(rb.id,'stone');const good=await answer(rb.id,'stone','  ПАЛЕОЛИТ  ','repair');assert.equal(good.attempts,3);assert.equal(good.awarded,30);assert.equal(good.run.score,30);assert.equal(good.run.stage,'exit');
  const solved=await answer(rb.id,'stone','Палеолит');assert.equal(solved.awarded,0);assert.equal(solved.attempts,3);assert.equal(solved.run.score,30);
  const f=randomUUID();const exit=await finish(rb.id,1,f);assert.equal(exit.passed,true);assert.equal(exit.requiredScore,30);assert.equal(exit.run.level,2);assert.equal((await finish(rb.id,1,f)).run.level,2);
  await assert.rejects(finish(rb.id,1),/өтуге рұқсат/);
 });
 await t.test('Second attempt gives 60, concurrent correct submissions cannot double award',async()=>{
  await as(cara);const one=await answer(rc.id,'stone','Қате');assert.equal(one.run.score,0);await branch(rc.id,'stone');
  const two=await answer(rc.id,'stone','Палеолит','repair');assert.equal(two.awarded,60);assert.equal(two.attempts,2);await finish(rc.id,1);
  const results=await Promise.all([answer(rc.id,'bronze',answers.bronze[0]),answer(rc.id,'bronze',answers.bronze[0])]);
  assert.equal(results.reduce((sum,r)=>sum+r.awarded,0),100);assert.equal(results.at(-1).run.score,160);assert.equal(results.at(-1).attempts,1);
 });
 await t.test('Insufficient cumulative score ends run; restart preserves history without carrying points',async()=>{
  await as(bob);
  for(const [id,level] of [['bronze',2],['saka',3]]){
   await answer(rb.id,id,'Қате');await branch(rb.id,id);await answer(rb.id,id,'Қате','repair');await branch(rb.id,id);const r=await answer(rb.id,id,answers[id][0],'repair');assert.equal(r.awarded,30);
   const ended=await finish(rb.id,level);assert.equal(ended.passed,level===2);if(level===3){assert.equal(ended.run.status,'failed');assert.equal(ended.run.score,90);assert.equal(ended.run.level,3);assert.equal(ended.requiredScore,100);}
  }
  await assert.rejects(answer(rb.id,'saka','Жетісу'),/аяқталған/);
  const next=await rpc('v2_start_run',[room.id]);assert.notEqual(next.id,rb.id);assert.equal(next.score,0);assert.equal(next.level,1);assert.equal(next.lives,3);assert.deepEqual(next.answers,{});
  const history=(await db.query('select id,score,status from public.game_runs order by sequence')).rows;assert.equal(history.length,2);assert.equal(history[0].score,90);assert.equal(history[0].status,'failed');
  const leaderboard=await rpc('v2_room_state',[room.id]);assert.equal(leaderboard.members.length,2);assert.equal(leaderboard.members.find(m=>m.name==='Бек').score,0);
 });
 await t.test('All six answer formats work server-side and chronological order matters',async()=>{
  await admin('update private.rate_limits set calls=0');await as(cara);await finish(rc.id,2);
  const ids=['saka','hun','turk','turgesh','karluk','karakhan','horde','kazakh'];
  for(let i=0;i<ids.length;i++){
   const id=ids[i];let value=answers[id][0];
   if(id==='turk'){
    const wrong=await answer(rc.id,id,[...value].reverse());assert.equal(wrong.correct,false);await branch(rc.id,id);
    const corrected=await answer(rc.id,id,value,'repair');assert.equal(corrected.awarded,60);
   }else{
    const r=await answer(rc.id,id,value);assert.equal(r.correct,true,id);assert.equal(r.awarded,100,id);
   }
   const out=await finish(rc.id,i+3);assert.equal(out.passed,true);
  }
  const end=await rpc('v2_run_state',[rc.id]);assert.equal(end.status,'finished');assert.equal(end.level,11);assert.equal(end.score,920);assert.equal(end.completed.length,10);
 });
 await t.test('Successful request rate limit and closed session enforce rejection',async()=>{
  await admin('update private.rate_limits set calls=60,window_at=clock_timestamp() where user_id=$1',[cara]);await as(cara);await assert.rejects(rpc('v2_run_state',[rc.id]),/тым көп/);
  await admin('update private.rate_limits set calls=0');await as(teacher);await rpc('close_session',[room.id]);
  await as(bob);await assert.rejects(rpc('v2_start_run',[room.id]),/белсенді емес/);
 });
 await db.close();
});

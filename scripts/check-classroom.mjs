import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const count=64;
const base=process.argv[2]||'http://127.0.0.1:5176';
const files=JSON.parse(await readFile('src/resource-sizes.json','utf8'));
let started=performance.now();
await Promise.all(Array.from({length:count},async()=>{
 for(const [n,size] of Object.entries(files)){
  const res=await fetch(base+'/engine/'+n+'.pack');assert.equal(res.status,200);
  assert.equal((await res.arrayBuffer()).byteLength,size.compressed);
 }
}));
console.log(count,'parallel local downloads, ms',Math.round(performance.now()-started));
const db=new PGlite();
try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated");
 for(const f of ['001_schema','002_content','003_progression'])await db.exec(await readFile('supabase/migrations/'+f+'.sql','utf8'));
 const teacher=randomUUID(),students=Array.from({length:count},()=>randomUUID());
 for(const id of [teacher,...students])await db.query('insert into auth.users values($1)',[id]);
 await db.query('insert into private.teachers values($1)',[teacher]);
 const as=(id,fn)=>db.transaction(async tx=>{
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await tx.exec('set local role authenticated');
  const call=async(name,args)=>(await tx.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as v',args)).rows[0].v;
  return fn(call);
 });
 const room=await as(teacher,c=>c('create_session',['Топтық сынақ']));
 started=performance.now();
 await Promise.all(students.map((id,i)=>as(id,async c=>{await c('set_profile',['Оқушы '+i]);await c('join_session',[room.code,i%2]);})));
 await as(teacher,c=>c('start_session',[room.id]));
 await Promise.all(students.map(id=>as(id,async c=>{
  const run=await c('v2_start_run',[room.id]),args=[run.id,'stone','"Палеолит"','main',randomUUID()];
  await c('v2_submit_answer',args);await c('v2_submit_answer',args);
 })));
 await Promise.all(students.map(id=>as(id,async c=>{
  const {members}=await c('v2_room_state',[room.id]);assert.equal(members.length,count);assert(members.every(m=>m.score===100));
 })));
 console.log(count,'identities joined, submitted twice and read complete ranking. Single PGlite connection, ms',Math.round(performance.now()-started));
}finally{await db.close();}

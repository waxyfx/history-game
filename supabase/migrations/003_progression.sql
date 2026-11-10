-- Run-based authoritative progression. Tarikh, 2026-11-04.
-- Existing 001/002 data remains as legacy history; legacy grading RPCs are revoked.
create table private.level_rules(level int primary key check(level between 1 and 10), min_score int not null);
insert into private.level_rules values(1,30),(2,60),(3,100),(4,140),(5,190),(6,240),(7,300),(8,360),(9,430),(10,500);
create table public.game_runs(
 id uuid primary key default gen_random_uuid(), session_id uuid not null, user_id uuid not null,
 sequence bigint generated always as identity unique,
 level int not null default 1 check(level between 1 and 11), score int not null default 0 check(score between 0 and 1000),
 status text not null default 'active' check(status in('active','failed','finished')),
 stage text not null default 'study' check(stage in('study','fragment','repair','exit')),
 started_at timestamptz not null default clock_timestamp(), ended_at timestamptz,
 foreign key(session_id,user_id) references public.members(session_id,user_id) on delete cascade
);
create unique index one_active_run on public.game_runs(session_id,user_id) where status='active';
create table public.run_questions(
 run_id uuid references public.game_runs on delete cascade, question_id text references private.questions,
 user_id uuid not null references auth.users, attempts int not null default 0 check(attempts>=0),
 correct boolean not null default false, awarded int not null default 0 check(awarded in(0,30,60,100)),
 primary key(run_id,question_id)
);
create table private.run_events(
 run_id uuid references public.game_runs on delete cascade, request_id uuid not null,
 payload jsonb not null, response jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(run_id,request_id)
);
alter table public.game_runs enable row level security;
alter table public.run_questions enable row level security;
revoke all on public.game_runs,public.run_questions from public,anon,authenticated;
grant select on public.game_runs,public.run_questions to authenticated;
create policy own_game_runs on public.game_runs for select to authenticated using(user_id=auth.uid());
create policy own_run_questions on public.run_questions for select to authenticated using(user_id=auth.uid());
revoke all on private.level_rules,private.run_events from public,anon,authenticated;

create function private.run_snapshot(p_run uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(r)-'user_id' || jsonb_build_object(
  'lives',3, 'requiredScore',coalesce((select min_score from private.level_rules where level=r.level),1000),
  'answers',coalesce((select jsonb_object_agg(question_id,jsonb_build_object('correct',correct,'attempts',attempts,'awarded',awarded)) from public.run_questions where run_id=r.id),'{}'::jsonb),
  'mistakes',coalesce((select jsonb_agg(question_id order by question_id) from public.run_questions where run_id=r.id and attempts>case when correct then 1 else 0 end),'[]'::jsonb),
  'completed',coalesce((select jsonb_agg(n) from generate_series(1,r.level-1) n),'[]'::jsonb)
 ) from public.game_runs r where r.id=p_run;
$$;

create function private.valid_answer(p_answer jsonb,p_accepted jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare candidate jsonb; ok boolean; i int;
begin
 for candidate in select value from jsonb_array_elements(p_accepted) loop
  if jsonb_typeof(candidate)='string' and jsonb_typeof(p_answer)='string' then
   if lower(regexp_replace(trim(normalize(candidate#>>'{}',NFKC)),'\s+',' ','g')) = lower(regexp_replace(trim(normalize(p_answer#>>'{}',NFKC)),'\s+',' ','g')) then return true;end if;
  elsif jsonb_typeof(candidate)='array' and jsonb_typeof(p_answer)='array' then
   if jsonb_array_length(candidate)<>jsonb_array_length(p_answer) then continue;end if;
   ok:=true;
   for i in 0..jsonb_array_length(candidate)-1 loop
    if jsonb_typeof(p_answer->i) is distinct from 'string' or lower(regexp_replace(trim(normalize(candidate->>i,NFKC)),'\s+',' ','g')) is distinct from lower(regexp_replace(trim(normalize(p_answer->>i,NFKC)),'\s+',' ','g')) then ok:=false;end if;
   end loop;
   if ok then return true;end if;
  end if;
 end loop;
 return false;
end $$;

create function public.v2_start_run(p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); r public.game_runs;
begin
 perform 1 from public.sessions where id=p_session and status='started' for share;
 if not found then raise exception 'Сессия белсенді емес';end if;
 -- A fixed membership row serializes run creation across tabs.
 perform 1 from public.members where session_id=p_session and user_id=u for update;
 if not found then raise exception 'Бұл сессияға қатысуға рұқсат жоқ';end if;
 select * into r from public.game_runs where session_id=p_session and user_id=u and status='active' for update;
 if r.id is null then insert into public.game_runs(session_id,user_id) values(p_session,u) returning * into r;end if;
 return private.run_snapshot(r.id);
end $$;

create function public.v2_run_state(p_run uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();begin
 if not exists(select 1 from public.game_runs where id=p_run and user_id=u) then raise exception 'Бұл өтуге рұқсат жоқ';end if;
 return private.run_snapshot(p_run);
end $$;

create function public.v2_submit_answer(p_run uuid,p_question text,p_answer jsonb,p_phase text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); r public.game_runs; q private.questions; t public.run_questions; ev private.run_events; body jsonb; result jsonb; ok boolean; points int:=0;
begin
 if p_request is null or p_phase is null or p_phase not in('main','repair','rescue') or p_answer is null or jsonb_typeof(p_answer) not in ('array','string') or octet_length(p_answer::text)>1500 then raise exception 'Жауап пішімі қате';end if;
 select * into r from public.game_runs where id=p_run and user_id=u for update;
 if r.id is null then raise exception 'Бұл өтуге рұқсат жоқ';end if;
 body:=jsonb_build_object('action','answer','question',p_question,'answer',p_answer,'phase',p_phase);
 select * into ev from private.run_events where run_id=p_run and request_id=p_request;
 if found then
  if ev.payload<>body then raise exception 'Сұрау нөмірі басқа әрекетке қолданылған';end if;
  return ev.response || jsonb_build_object('duplicate',true,'run',private.run_snapshot(p_run));
 end if;
 perform 1 from public.sessions where id=r.session_id and status='started' for share;
 if not found then raise exception 'Сессия белсенді емес';end if;
 if r.status<>'active' then raise exception 'Бұл өту аяқталған. Жаңа ойынды бастаңыз';end if;
 select * into q from private.questions where id=p_question;
 if q.id is null or q.level<>r.level then raise exception 'Тапсырмалар дәуір ретімен орындалады';end if;
 select * into t from public.run_questions where run_id=p_run and question_id=p_question;
 if p_phase<>'rescue' and coalesce(t.correct,false) then
  -- A different request ID still cannot award a solved event twice.
  result:=jsonb_build_object('run',private.run_snapshot(p_run),'correct',true,'awarded',0,'attempts',t.attempts,'explanation',q.explanation,'duplicate',true);
  insert into private.run_events values(p_run,p_request,body,result,clock_timestamp());return result;
 end if;
 if p_phase='main' and r.stage<>'study' or p_phase='repair' and r.stage<>'repair' then raise exception 'Алдымен баламалы жолды аяқтаңыз';end if;
 ok:=private.valid_answer(p_answer,q.accepted);
 if p_phase<>'rescue' then
  insert into public.run_questions(run_id,question_id,user_id) values(p_run,p_question,u) on conflict do nothing;
  update public.run_questions set attempts=attempts+1 where run_id=p_run and question_id=p_question returning * into t;
  if ok then
   points:=case when t.attempts=1 then 100 when t.attempts=2 then 60 else 30 end;
   update public.run_questions set correct=true,awarded=points where run_id=p_run and question_id=p_question;
  end if;
  update public.game_runs set score=score+points,stage=case when ok then 'exit' else 'fragment' end where id=p_run;
 end if;
 result:=jsonb_build_object('run',private.run_snapshot(p_run),'correct',ok,'awarded',points,'attempts',coalesce(t.attempts,0),'explanation',q.explanation,'duplicate',false);
 insert into private.run_events values(p_run,p_request,body,result,clock_timestamp());
 return result;
end $$;

create function public.v2_complete_branch(p_run uuid,p_question text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();r public.game_runs;q private.questions;ev private.run_events;body jsonb;result jsonb;
begin
 if p_request is null then raise exception 'Сұрау нөмірі қажет';end if;
 select * into r from public.game_runs where id=p_run and user_id=u for update;
 if r.id is null then raise exception 'Бұл өтуге рұқсат жоқ';end if;
 body:=jsonb_build_object('action','branch','question',p_question);
 select * into ev from private.run_events where run_id=p_run and request_id=p_request;
 if found then if ev.payload<>body then raise exception 'Сұрау нөмірі басқа әрекетке қолданылған';end if;return private.run_snapshot(p_run);end if;
 perform 1 from public.sessions where id=r.session_id and status='started' for share;
 if not found then raise exception 'Сессия белсенді емес';end if;
 select * into q from private.questions where id=p_question;
 if r.status<>'active' or r.stage<>'fragment' or q.level is distinct from r.level then raise exception 'Бұл баламалы жол қазір ашық емес';end if;
 update public.game_runs set stage='repair' where id=p_run;
 result:=private.run_snapshot(p_run);
 insert into private.run_events values(p_run,p_request,body,result,clock_timestamp());return result;
end $$;

create function public.v2_finish_level(p_run uuid,p_level int,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();r public.game_runs;ev private.run_events;body jsonb;result jsonb;required int;passed boolean;
begin
 if p_request is null or p_level is null or p_level not between 1 and 10 then raise exception 'Деңгей не сұрау нөмірі қате';end if;
 select * into r from public.game_runs where id=p_run and user_id=u for update;
 if r.id is null then raise exception 'Бұл өтуге рұқсат жоқ';end if;
 body:=jsonb_build_object('action','finish','level',p_level);
 select * into ev from private.run_events where run_id=p_run and request_id=p_request;
 if found then if ev.payload<>body then raise exception 'Сұрау нөмірі басқа әрекетке қолданылған';end if;return ev.response || jsonb_build_object('run',private.run_snapshot(p_run));end if;
 perform 1 from public.sessions where id=r.session_id and status='started' for share;
 if not found then raise exception 'Сессия белсенді емес';end if;
 if r.status<>'active' or r.level<>p_level then raise exception 'Бұл деңгейге өтуге рұқсат жоқ';end if;
 if r.stage<>'exit' or not exists(select 1 from private.questions where level=p_level) or exists(select 1 from private.questions q where q.level=p_level and not exists(select 1 from public.run_questions t where t.run_id=p_run and t.question_id=q.id and t.correct)) then raise exception 'Барлық міндетті тапсырмаларға дұрыс жауап беріңіз';end if;
 select min_score into required from private.level_rules where level=p_level;
 passed:=r.score>=required;
 if not passed then
  update public.game_runs set status='failed',ended_at=clock_timestamp() where id=p_run;
 elsif p_level=10 then
  update public.game_runs set status='finished',level=11,ended_at=clock_timestamp() where id=p_run;
 else
  update public.game_runs set level=level+1,stage='study' where id=p_run;
 end if;
 result:=jsonb_build_object('run',private.run_snapshot(p_run),'passed',passed,'requiredScore',required);
 insert into private.run_events values(p_run,p_request,body,result,clock_timestamp());return result;
end $$;

create function public.v2_room_state(p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();s public.sessions;
begin
 select * into s from public.sessions where id=p_session;
 if s.id is null or (s.host<>u and not exists(select 1 from public.members where session_id=p_session and user_id=u)) then raise exception 'Бұл сессияға рұқсат жоқ';end if;
 return jsonb_build_object('session',to_jsonb(s),'members',coalesce((select jsonb_agg(jsonb_build_object(
  'name',m.display_name,'team',m.team,'score',coalesce(r.score,0),'level',coalesce(r.level,1),'status',coalesce(r.status,'waiting'),'finished',coalesce(r.status='finished',false),
  'correct',(select count(*) from public.run_questions t where t.run_id=r.id and t.correct),
  'wrong',coalesce((select sum(attempts-case when correct then 1 else 0 end) from public.run_questions t where t.run_id=r.id),0),
  'seconds',case when r.id is null then 0 else extract(epoch from coalesce(r.ended_at,clock_timestamp())-r.started_at) end
 )) from public.members m left join lateral(select * from public.game_runs a where a.session_id=m.session_id and a.user_id=m.user_id order by sequence desc limit 1) r on true where m.session_id=p_session),'[]'::jsonb));
end $$;

revoke execute on function public.submit_answer(uuid,text,jsonb,text),public.finish_level(uuid,int) from public,anon,authenticated;
revoke all on function private.run_snapshot(uuid),private.valid_answer(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.v2_start_run(uuid),public.v2_run_state(uuid),public.v2_submit_answer(uuid,text,jsonb,text,uuid),public.v2_complete_branch(uuid,text,uuid),public.v2_finish_level(uuid,int,uuid),public.v2_room_state(uuid) from public,anon;
grant execute on function public.v2_start_run(uuid),public.v2_run_state(uuid),public.v2_submit_answer(uuid,text,jsonb,text,uuid),public.v2_complete_branch(uuid,text,uuid),public.v2_finish_level(uuid,int,uuid),public.v2_room_state(uuid) to authenticated;

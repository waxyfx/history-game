-- Apply after 004. Serialize rewards on the authenticated owner's run row.
create table public.epoch_quiz_attempts (
 run_id uuid references public.game_runs on delete cascade,
 quiz_id text references public.dynamic_quizzes,
 user_id uuid not null references auth.users,
 attempts int not null default 0,
 correct boolean not null default false,
 awarded int not null default 0,
 primary key(run_id,quiz_id)
);
alter table public.epoch_quiz_attempts enable row level security;
revoke all on public.epoch_quiz_attempts from public,anon,authenticated;
grant select on public.epoch_quiz_attempts to authenticated;
create policy own_epoch_quiz_attempts on public.epoch_quiz_attempts for select to authenticated using(user_id=auth.uid());

create or replace function public.v2_submit_epoch_answer(p_run_id uuid,p_quiz_id text,p_answer jsonb,p_req_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();r public.game_runs;q public.dynamic_quizzes;
 t public.epoch_quiz_attempts;ev private.run_events;body jsonb;result jsonb;ok boolean;points int:=0;
begin
 if p_req_id is null or p_quiz_id is null or length(p_quiz_id) not between 1 and 100 or p_answer is null or jsonb_typeof(p_answer) not in ('string','array') or octet_length(p_answer::text)>1500 then raise exception 'Invalid answer format';end if;
 select * into r from public.game_runs where id=p_run_id and user_id=u for update;
 if r.id is null then raise exception 'Run access denied';end if;
 body:=jsonb_build_object('action','epoch_answer','quiz_id',p_quiz_id,'answer',p_answer);
 select * into ev from private.run_events where run_id=p_run_id and request_id=p_req_id;
 if found then
  if ev.payload<>body then raise exception 'Request ID already used for another action';end if;
  return ev.response || jsonb_build_object('duplicate',true,'run_score',r.score);
 end if;
 perform 1 from public.sessions where id=r.session_id and status='started' for share;
 if not found or r.status<>'active' then raise exception 'Session or run is not active';end if;
 select dq.* into q from public.dynamic_quizzes dq join public.campaign_epochs ep on ep.id=dq.epoch_id where dq.id=p_quiz_id and dq.active and ep.published;
 if q.id is null or q.epoch_id<>r.level then raise exception 'Quiz is not available in this epoch';end if;
 select * into t from public.epoch_quiz_attempts where run_id=p_run_id and quiz_id=p_quiz_id;
 if coalesce(t.correct,false) then
  return jsonb_build_object('correct',true,'awarded',0,'attempts',t.attempts,'explanation',q.explanation,'run_score',r.score,'duplicate',true);
 end if;
 insert into public.epoch_quiz_attempts(run_id,quiz_id,user_id) values(p_run_id,p_quiz_id,u) on conflict do nothing;
 update public.epoch_quiz_attempts set attempts=attempts+1 where run_id=p_run_id and quiz_id=p_quiz_id returning * into t;
 ok:=private.valid_answer(p_answer,q.accepted_answers);
 if ok then
  points:=least(1000-r.score,case when t.attempts=1 then 100 when t.attempts=2 then 60 else 30 end);
  update public.epoch_quiz_attempts set correct=true,awarded=points where run_id=p_run_id and quiz_id=p_quiz_id;
  update public.game_runs set score=score+points where id=p_run_id;
 end if;
 result:=jsonb_build_object('correct',ok,'awarded',points,'attempts',t.attempts,'explanation',q.explanation,'run_score',r.score+points,'duplicate',false);
 insert into private.run_events(run_id,request_id,payload,response) values(p_run_id,p_req_id,body,result);
 return result;
end $$;

create or replace function public.v2_get_epoch_quizzes(p_epoch int) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'epoch_id',q.epoch_id,'task_id',q.task_id,'question_text',q.question_text,'options',q.options,'points',q.points)),'[]'::jsonb)
 from public.dynamic_quizzes q join public.campaign_epochs ep on ep.id=q.epoch_id
 where q.epoch_id=p_epoch and q.active and ep.published;
$$;

-- Policies use the public wrapper: private schema remains inaccessible to clients.
drop policy select_published_epochs on public.campaign_epochs;
create policy select_published_epochs on public.campaign_epochs for select to public using(published or public.get_my_role() in ('teacher','admin'));
drop policy view_dynamic_quizzes on public.dynamic_quizzes;
create policy view_dynamic_quizzes on public.dynamic_quizzes for select to authenticated using(public.get_my_role() in ('teacher','admin'));

-- PostgreSQL grants PUBLIC EXECUTE to new functions by default.
revoke all on all functions in schema private from public,anon,authenticated;
revoke execute on function public.get_my_role(),public.admin_get_dashboard(),public.admin_get_players(text,int,int),public.admin_get_teams(),public.admin_get_sessions(),public.admin_close_session(uuid),public.admin_get_epochs(),public.admin_set_epoch_published(int,boolean),public.admin_get_quizzes(int),public.admin_upsert_quiz(text,int,text,text,jsonb,jsonb,text,boolean),public.admin_delete_quiz(text),public.admin_set_user_role(uuid,text),public.v2_get_epoch_quizzes(int),public.v2_submit_epoch_answer(uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.get_my_role(),public.admin_get_dashboard(),public.admin_get_players(text,int,int),public.admin_get_teams(),public.admin_get_sessions(),public.admin_close_session(uuid),public.admin_get_epochs(),public.admin_set_epoch_published(int,boolean),public.admin_get_quizzes(int),public.admin_upsert_quiz(text,int,text,text,jsonb,jsonb,text,boolean),public.admin_delete_quiz(text),public.admin_set_user_role(uuid,text),public.v2_get_epoch_quizzes(int),public.v2_submit_epoch_answer(uuid,text,jsonb,uuid) to authenticated;
grant execute on function public.get_my_role() to anon;

create or replace function public.admin_get_players(p_search text default null, p_limit int default 50, p_offset int default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r text := private.require_teacher_or_admin();
  players jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 or length(p_search)>100 then raise exception 'Invalid pagination';end if;
  select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) into players from (
    select
      u.id as user_id,
      coalesce(pr.display_name, 'Ойыншы') as display_name,
      private.get_user_role(u.id) as role,
      count(distinct r.id) as runs_count,
      coalesce(max(r.score), 0) as max_score,
      coalesce(max(r.level), 1) as max_level,
      max(r.started_at) as last_active
    from auth.users u
    left join public.profiles pr on pr.id = u.id
    left join public.game_runs r on r.user_id = u.id
    where p_search is null or pr.display_name ilike '%' || p_search || '%'
    group by u.id, pr.display_name
    order by last_active desc nulls last
    limit p_limit offset p_offset
  ) p;
  return players;
end $$;


create or replace function public.admin_upsert_quiz(
  p_id text, p_epoch_id int, p_task_id text,
  p_question text, p_options jsonb, p_accepted jsonb,
  p_explanation text, p_active boolean default true
) returns void language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  r text := private.require_teacher_or_admin();
begin
  if p_id is null or length(p_id)>100 or p_epoch_id is null or p_task_id is null or length(trim(p_task_id)) not between 1 and 100 or p_question is null or length(p_question)>2000 or p_explanation is null or length(p_explanation)>4000 or p_active is null then raise exception 'Invalid quiz input';end if;
  if p_options is null or p_accepted is null or jsonb_typeof(p_options)<>'array' or jsonb_typeof(p_accepted)<>'array' then raise exception 'Invalid quiz answers';end if;
  if jsonb_array_length(p_options) not between 2 and 20 or jsonb_array_length(p_accepted) not between 1 and 20 or octet_length(p_options::text)>10000 or octet_length(p_accepted::text)>10000 then raise exception 'Invalid quiz answers';end if;
  if exists(select 1 from jsonb_array_elements(p_options || p_accepted) v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}')) not between 1 and 500) then raise exception 'Invalid quiz answer text';end if;
  if p_id is null or length(trim(p_id)) < 2 then raise exception 'Сұрақ идентификаторы қате'; end if;
  if p_epoch_id not between 1 and 8 then raise exception 'Дәуір 1 мен 8 аралығында болуы тиіс'; end if;
  if p_question is null or length(trim(p_question)) < 5 then raise exception 'Сұрақ мәтіні тым қысқа'; end if;
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) < 2 then raise exception 'Кемінде 2 жауап нұсқасы қажет'; end if;
  if jsonb_typeof(p_accepted) <> 'array' or jsonb_array_length(p_accepted) < 1 then raise exception 'Дұрыс жауап көрсетілмеген'; end if;

  insert into public.dynamic_quizzes (
    id, epoch_id, task_id, question_text, options, accepted_answers, explanation, points, active, created_by, updated_at
  ) values (
    trim(p_id), p_epoch_id, trim(p_task_id), trim(p_question), p_options, p_accepted, trim(p_explanation), 100, p_active, u, clock_timestamp()
  ) on conflict (id) do update set
    epoch_id = excluded.epoch_id, task_id = excluded.task_id, question_text = excluded.question_text,
    options = excluded.options, accepted_answers = excluded.accepted_answers,
    explanation = excluded.explanation, active = excluded.active, updated_at = clock_timestamp();

  insert into private.audit_logs (actor_id, action, target_type, target_id, details)
  values (u, 'upsert_quiz', 'quiz', p_id, jsonb_build_object('epoch', p_epoch_id, 'task', p_task_id));
end $$;


-- Keep legacy lobby authorization consistent with RBAC grants and revocations.
create function private.sync_teacher_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.role in ('teacher','admin') then insert into private.teachers(user_id) values(NEW.user_id) on conflict do nothing;
 else delete from private.teachers where user_id=NEW.user_id;end if;
 return NEW;
end $$;
create trigger sync_teacher_role after insert or update of role on private.user_roles for each row execute function private.sync_teacher_role();
insert into private.teachers(user_id) select user_id from private.user_roles where role in ('teacher','admin') on conflict do nothing;
delete from private.teachers t using private.user_roles r where t.user_id=r.user_id and r.role='player';
revoke all on function private.sync_teacher_role() from public,anon,authenticated;

-- Dynamic bonuses share the existing capped total; legacy answers must remain completable.
create or replace function public.v2_submit_answer(p_run uuid,p_question text,p_answer jsonb,p_phase text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
  update public.game_runs set score=least(1000,score+points),stage=case when ok then 'exit' else 'fragment' end where id=p_run;
 end if;
 result:=jsonb_build_object('run',private.run_snapshot(p_run),'correct',ok,'awarded',points,'attempts',coalesce(t.attempts,0),'explanation',q.explanation,'duplicate',false);
 insert into private.run_events values(p_run,p_request,body,result,clock_timestamp());
 return result;
end $$;


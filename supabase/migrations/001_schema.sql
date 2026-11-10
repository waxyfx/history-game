-- PostgreSQL / Supabase. Apply as project owner. No service key in the browser.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.teachers(user_id uuid primary key references auth.users on delete cascade);
create table private.questions(id text primary key, level int unique not null check(level between 1 and 10), accepted jsonb not null, explanation text not null);
create table private.rate_limits(user_id uuid primary key, window_at timestamptz not null, calls int not null);
create table public.profiles(id uuid primary key references auth.users on delete cascade, display_name text not null check(length(display_name) between 1 and 60));
create table public.sessions(id uuid primary key default gen_random_uuid(), code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)), host uuid not null references auth.users, title text not null check(length(title) between 1 and 80), status text not null default 'lobby' check(status in ('lobby','started','closed')), created_at timestamptz not null default now(), started_at timestamptz);
create table public.members(session_id uuid references public.sessions on delete cascade, user_id uuid references auth.users on delete cascade, team int not null check(team in (0,1)), display_name text not null, primary key(session_id,user_id));
create table public.attempts(session_id uuid,user_id uuid, level int not null default 1 check(level between 1 and 11), phase text not null default 'main' check(phase in ('main','repair','cleared','finished')), score int not null default 0 check(score between 0 and 1000), correct int not null default 0, wrong int not null default 0, finished_at timestamptz, primary key(session_id,user_id), foreign key(session_id,user_id) references public.members on delete cascade);
create table public.answers(id bigint generated always as identity primary key, session_id uuid not null, user_id uuid not null, question_id text not null references private.questions, phase text not null check(phase in ('main','repair','rescue')), correct boolean not null, created_at timestamptz not null default now(), foreign key(session_id,user_id) references public.attempts on delete cascade);
create unique index one_scored_answer on public.answers(session_id,user_id,question_id) where phase='main';
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.members enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.attempts,public.answers to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy own_attempts on public.attempts for select to authenticated using(user_id=auth.uid());
create policy own_answers on public.answers for select to authenticated using(user_id=auth.uid());
create function private.require_user() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r private.rate_limits;
begin
 if u is null then raise exception 'Кіру қажет';end if;
 insert into private.rate_limits values(u,clock_timestamp(),0) on conflict do nothing;
 select * into r from private.rate_limits where user_id=u for update;
 if r.window_at < clock_timestamp()-interval '1 minute' then update private.rate_limits set window_at=clock_timestamp(),calls=1 where user_id=u;
 elsif r.calls>=60 then raise exception 'Сұрау тым көп. Бір минут күтіңіз';
 else update private.rate_limits set calls=calls+1 where user_id=u;end if;
 return u;
end $$;
create function public.set_profile(p_name text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();begin
 if p_name is null or length(trim(p_name)) not between 1 and 60 then raise exception 'Атыңызды тексеріңіз';end if;
 insert into public.profiles values(u,trim(p_name)) on conflict(id) do update set display_name=excluded.display_name;
end $$;
create function public.my_role() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.teachers where user_id=auth.uid())$$;
create function public.create_session(p_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();s public.sessions;begin
 if not exists(select 1 from private.teachers where user_id=u) then raise exception 'Мұғалім құқығы қажет';end if;
 if p_title is null or length(trim(p_title)) not between 1 and 80 then raise exception 'Сессия атауын тексеріңіз';end if;
 insert into public.sessions(host,title) values(u,trim(p_title)) returning * into s;return to_jsonb(s);
end $$;
create function public.join_session(p_code text,p_team int) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();s public.sessions;n text;begin
 if p_team is null or p_team not in(0,1) or p_code is null or length(p_code)<>10 then raise exception 'Сессия коды немесе топ қате';end if;
 select * into s from public.sessions where code=upper(p_code) for update;
 if s.id is null then raise exception 'Сессия табылмады';end if;
 if s.status<>'lobby' then
  if exists(select 1 from public.members where session_id=s.id and user_id=u) then return to_jsonb(s);end if;
  raise exception 'Сессия басталды. Құрамы бекітілген';end if;
 select display_name into n from public.profiles where id=u;
 if n is null then raise exception 'Алдымен атыңызды сақтаңыз';end if;
 insert into public.members values(s.id,u,p_team,n) on conflict(session_id,user_id) do update set team=excluded.team,display_name=excluded.display_name;
 return to_jsonb(s);
end $$;
create function public.start_session(p_session uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();s public.sessions;begin
 select * into s from public.sessions where id=p_session for update;
 if s.host is distinct from u or not exists(select 1 from private.teachers where user_id=u) then raise exception 'Құқық жеткіліксіз';end if;
 if s.status<>'lobby' then raise exception 'Сессия бұрын басталған';end if;
 if (select count(distinct team) from public.members where session_id=p_session)<>2 then raise exception 'Екі топқа да қатысушы қажет';end if;
 update public.sessions set status='started',started_at=clock_timestamp() where id=p_session;
 insert into public.attempts(session_id,user_id) select session_id,user_id from public.members where session_id=p_session;
end $$;
create function public.close_session(p_session uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();begin
 if not exists(select 1 from public.sessions s join private.teachers t on t.user_id=s.host where s.id=p_session and s.host=u) then raise exception 'Құқық жеткіліксіз';end if;
 update public.sessions set status='closed' where id=p_session;
end $$;
create function public.submit_answer(p_session uuid,p_question text,p_answer jsonb,p_phase text default 'main') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();a public.attempts;q private.questions;prev public.answers;ok boolean:=false;candidate jsonb;i int;part boolean;room public.sessions;
begin
 if p_phase is null or p_phase not in('main','repair','rescue') or p_answer is null or octet_length(p_answer::text)>1500 then raise exception 'Жауап пішімі қате';end if;
 select * into room from public.sessions where id=p_session for share;
 if room.status is distinct from 'started' then raise exception 'Сессия белсенді емес';end if;
 select * into a from public.attempts where session_id=p_session and user_id=u for update;
 if a.user_id is null then raise exception 'Бұл сессияға қатысуға рұқсат жоқ';end if;
 select * into q from private.questions where id=p_question;
 if q.id is null then raise exception 'Тапсырма табылмады';end if;
 if p_phase='main' then
  select * into prev from public.answers where session_id=p_session and user_id=u and question_id=p_question and phase='main';
  if prev.id is not null then return jsonb_build_object('correct',prev.correct,'score',a.score,'phase',a.phase,'explanation',q.explanation,'duplicate',true);end if;
 end if;
 if a.level<>q.level or a.phase='finished' then raise exception 'Тапсырмалар ретімен орындалады';end if;
 if p_phase<>'rescue' and a.phase<>p_phase then raise exception 'Бұл жауап кезеңі жабық';end if;
 for candidate in select value from jsonb_array_elements(q.accepted) loop
  part:=false;
  if jsonb_typeof(candidate)='string' and jsonb_typeof(p_answer)='string' then
   part:=lower(regexp_replace(trim(candidate#>>'{}'),'\s+',' ','g'))=lower(regexp_replace(trim(p_answer#>>'{}'),'\s+',' ','g'));
  elsif jsonb_typeof(candidate)='array' and jsonb_typeof(p_answer)='array' and jsonb_array_length(candidate)=jsonb_array_length(p_answer) then
   part:=true;
   for i in 0..jsonb_array_length(candidate)-1 loop
    if jsonb_typeof(p_answer->i)<>'string' or lower(trim(candidate->>i)) is distinct from lower(trim(p_answer->>i)) then part:=false;end if;
   end loop;
  end if;
  ok:=ok or coalesce(part,false);
 end loop;
 insert into public.answers(session_id,user_id,question_id,phase,correct) values(p_session,u,p_question,p_phase,ok);
 if p_phase='main' then
  update public.attempts set score=score+case when ok then 100 else 0 end,correct=correct+case when ok then 1 else 0 end,wrong=wrong+case when ok then 0 else 1 end,phase=case when ok then 'cleared' else 'repair' end where session_id=p_session and user_id=u returning * into a;
 elsif p_phase='repair' and ok then update public.attempts set phase='cleared' where session_id=p_session and user_id=u returning * into a;end if;
 return jsonb_build_object('correct',ok,'score',a.score,'phase',a.phase,'explanation',q.explanation,'duplicate',false);
end $$;
create function public.finish_level(p_session uuid,p_level int) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();a public.attempts;begin
 perform 1 from public.sessions where id=p_session and status='started' for share;
 if not found then raise exception 'Сессия белсенді емес';end if;
 select * into a from public.attempts where session_id=p_session and user_id=u for update;
 if a.user_id is null then raise exception 'Қатысуға рұқсат жоқ';end if;
 if p_level<a.level then return to_jsonb(a);end if;
 if a.level<>p_level or a.phase<>'cleared' then raise exception 'Алдымен тарихи тапсырманы аяқтаңыз';end if;
 update public.attempts set level=level+1,phase=case when level=10 then 'finished' else 'main' end,finished_at=case when level=10 then clock_timestamp() else null end where session_id=p_session and user_id=u returning * into a;
 return to_jsonb(a);
end $$;
create function public.room_state(p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();s public.sessions;begin
 select * into s from public.sessions where id=p_session;
 if s.id is null or (s.host<>u and not exists(select 1 from public.members where session_id=p_session and user_id=u)) then raise exception 'Бұл сессияға рұқсат жоқ';end if;
 return jsonb_build_object('session',to_jsonb(s),'members',coalesce((select jsonb_agg(jsonb_build_object('name',m.display_name,'team',m.team,'score',coalesce(a.score,0),'correct',coalesce(a.correct,0),'wrong',coalesce(a.wrong,0),'level',coalesce(a.level,1),'finished',a.finished_at is not null,'seconds',extract(epoch from coalesce(a.finished_at,clock_timestamp())-s.started_at))) from public.members m left join public.attempts a using(session_id,user_id) where m.session_id=p_session),'[]'::jsonb));
end $$;
revoke all on all functions in schema public from public,anon;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function public.set_profile(text),public.my_role(),public.create_session(text),public.join_session(text,int),public.start_session(uuid),public.close_session(uuid),public.submit_answer(uuid,text,jsonb,text),public.finish_level(uuid,int),public.room_state(uuid) to authenticated;

-- Migration 006: participants (Google identity profiles, roles) and protected official level results.
-- Keeps 001-005 intact. The local game save (browser) and competitive results are separate:
-- results are written ONLY by the server functions below, from answers checked against private keys.

-- ---------------------------------------------------------------- roles: student by default
alter table private.user_roles drop constraint if exists user_roles_role_check;
alter table private.user_roles add constraint user_roles_role_check check (role in ('player', 'student', 'teacher', 'admin'));

create or replace function private.get_user_role(u uuid) returns text language sql stable security definer set search_path='' as $$
  select coalesce(
    (select role from private.user_roles where user_id=u),
    case when exists(select 1 from private.teachers where user_id=u) then 'teacher' else 'student' end
  );
$$;
-- Profile-facing role: legacy 'player' is reported as 'student'.
create or replace function private.profile_role(u uuid) returns text language sql stable security definer set search_path='' as $$
  select case private.get_user_role(u) when 'admin' then 'admin' when 'teacher' then 'teacher' else 'student' end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text) returns void language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  r text := private.get_user_role(u);
  v text := case when p_role = 'player' then 'student' else p_role end;
begin
  if r <> 'admin' then raise exception 'Тек Бас Әкімші рөлдерді тағайындай алады'; end if;
  if v is null or v not in ('student', 'teacher', 'admin') then raise exception 'Рөл дұрыс емес'; end if;
  insert into private.user_roles (user_id, role) values (p_user_id, v)
  on conflict (user_id) do update set role=excluded.role;
  insert into private.audit_logs (actor_id, action, target_type, target_id, details)
  values (u, 'set_user_role', 'user', p_user_id::text, jsonb_build_object('role', v));
end $$;

-- ---------------------------------------------------------------- profiles from the verified identity
alter table public.profiles
  add column if not exists google_user_id text,
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz not null default clock_timestamp(),
  add column if not exists role text not null default 'student';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'teacher', 'admin'));
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (avatar_url is null or (avatar_url ~ '^https://' and length(avatar_url) <= 512));
alter table public.profiles drop constraint if exists profiles_email_check;
alter table public.profiles add constraint profiles_email_check check (email is null or length(email) <= 320);
create unique index if not exists profiles_google_user_id_key on public.profiles(google_user_id) where google_user_id is not null;
update public.profiles p set role = private.profile_role(p.id);

-- Reads name/email/avatar/Google id from auth.users / auth.identities on the server.
-- Never from client arguments. to_jsonb() keeps it working on minimal auth schemas (tests).
create or replace function private.sync_profile(u uuid) returns void language plpgsql security definer set search_path='' as $$
declare
  j jsonb; meta jsonb; app jsonb; v_email text; v_name text; v_avatar text; v_google text;
begin
  select to_jsonb(au) into j from auth.users au where au.id = u;
  if j is null then raise exception 'Пайдаланушы табылмады'; end if;
  meta := coalesce(j->'raw_user_meta_data', '{}'::jsonb);
  app := coalesce(j->'raw_app_meta_data', '{}'::jsonb);
  v_email := nullif(left(j->>'email', 320), '');
  v_name := left(trim(coalesce(nullif(meta->>'full_name', ''), nullif(meta->>'name', ''), split_part(coalesce(v_email, ''), '@', 1), '')), 60);
  if v_name = '' then v_name := 'Оқушы'; end if;
  v_avatar := coalesce(nullif(meta->>'avatar_url', ''), nullif(meta->>'picture', ''));
  if v_avatar is not null and (v_avatar !~ '^https://' or length(v_avatar) > 512) then v_avatar := null; end if;
  if to_regclass('auth.identities') is not null then
    execute $q$select i.provider_id from auth.identities i where i.user_id = $1 and i.provider = 'google' order by i.created_at limit 1$q$
      into v_google using u;
  end if;
  if v_google is null and (app->>'provider' = 'google' or app->'providers' ? 'google') then
    v_google := coalesce(nullif(meta->>'provider_id', ''), nullif(meta->>'sub', ''));
  end if;
  insert into public.profiles (id, display_name, google_user_id, email, avatar_url, role)
  values (u, v_name, v_google, v_email, v_avatar, private.profile_role(u))
  on conflict (id) do update set
    google_user_id = coalesce(excluded.google_user_id, public.profiles.google_user_id),
    email = excluded.email, avatar_url = excluded.avatar_url, role = excluded.role;
end $$;

create or replace function private.on_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.sync_profile(NEW.id);
  return NEW;
end $$;
drop trigger if exists tj_on_auth_user on auth.users;
create trigger tj_on_auth_user after insert or update on auth.users for each row execute function private.on_auth_user();

create or replace function private.on_role_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.profiles set role = private.profile_role(coalesce(NEW.user_id, OLD.user_id)) where id = coalesce(NEW.user_id, OLD.user_id);
  return coalesce(NEW, OLD);
end $$;
drop trigger if exists tj_on_role_change on private.user_roles;
create trigger tj_on_role_change after insert or update or delete on private.user_roles for each row execute function private.on_role_change();

-- ---------------------------------------------------------------- official level runs and results
create table private.official_level_rules (
  level_id int primary key check (level_id between 1 and 10),
  max_score int not null check (max_score > 0),
  pass_score int not null check (pass_score > 0),
  min_seconds int not null default 60 check (min_seconds >= 0),
  required_quiz text not null
);
create table private.official_quiz_keys (
  level_id int not null references private.official_level_rules,
  quiz_id text not null check (length(quiz_id) between 1 and 40),
  kind text not null check (kind in ('main', 'bonus')),
  correct int not null check (correct between 0 and 9),
  primary key (level_id, quiz_id)
);
-- MAP01 «Алғашқы іздер»: 5 main quizzes (100/60/30) + 5 bonus questions (50, first answer only).
insert into private.official_level_rules values (1, 750, 250, 60, 'stone_secret');
insert into private.official_quiz_keys values
  (1, 'stone_main', 'main', 1), (1, 'stone_workshop', 'main', 1), (1, 'stone_hunting', 'main', 2),
  (1, 'stone_cave', 'main', 1), (1, 'stone_secret', 'main', 0),
  (1, 'stone_bonus_1', 'bonus', 0), (1, 'stone_bonus_2', 'bonus', 0), (1, 'stone_bonus_3', 'bonus', 1),
  (1, 'stone_bonus_4', 'bonus', 0), (1, 'stone_bonus_5', 'bonus', 0);

create table public.level_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  level_id int not null references private.official_level_rules,
  mode text not null check (mode in ('solo', 'team')),
  session_id uuid references public.sessions on delete set null,
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz
);
create unique index level_runs_one_active on public.level_runs(user_id, level_id) where status = 'active';
create table private.level_run_answers (
  run_id uuid not null references public.level_runs on delete cascade,
  quiz_id text not null,
  attempts int not null default 0 check (attempts >= 0),
  correct boolean not null default false,
  awarded int not null default 0 check (awarded >= 0),
  primary key (run_id, quiz_id)
);
create table private.level_requests (
  request_id uuid primary key,
  user_id uuid not null,
  payload jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create table public.level_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.level_runs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  level_id int not null,
  score int not null check (score >= 0),
  max_score int not null check (max_score > 0),
  percentage numeric(5,2) not null check (percentage between 0 and 100),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_seconds int not null check (duration_seconds >= 0),
  attempt_number int not null check (attempt_number >= 1),
  passed boolean not null,
  mode text not null check (mode in ('solo', 'team')),
  session_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  check (score <= max_score), check (finished_at >= started_at),
  unique (user_id, level_id, attempt_number)
);
create index level_results_user on public.level_results(user_id, level_id);

alter table public.level_runs enable row level security;
alter table public.level_results enable row level security;
revoke all on public.level_runs, public.level_results from public, anon, authenticated;
grant select on public.level_runs, public.level_results to authenticated;
create policy own_level_runs on public.level_runs for select to authenticated using (user_id = auth.uid());
create policy own_level_results on public.level_results for select to authenticated
  using (user_id = auth.uid() or public.get_my_role() in ('teacher', 'admin'));
revoke all on all tables in schema private from anon, authenticated;

-- Replay helper: same request UUID + same payload returns the stored response; another payload is rejected.
create or replace function private.level_replay(p_request uuid, u uuid, p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.level_requests;
begin
  if p_request is null then raise exception 'Сұрау идентификаторы қажет'; end if;
  select * into r from private.level_requests where request_id = p_request;
  if not found then return null; end if;
  if r.user_id <> u or r.payload <> p_payload then raise exception 'Сұрау идентификаторы басқа деректермен қолданылған'; end if;
  return r.response || jsonb_build_object('duplicate', true);
end $$;

create or replace function private.level_run_state(p_run uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id', r.id, 'level_id', r.level_id, 'mode', r.mode, 'status', r.status, 'started_at', r.started_at,
    'score', coalesce((select sum(a.awarded) from private.level_run_answers a where a.run_id = r.id), 0),
    'max_score', l.max_score,
    'answers', coalesce((select jsonb_object_agg(a.quiz_id, jsonb_build_object('correct', a.correct, 'attempts', a.attempts, 'awarded', a.awarded))
                         from private.level_run_answers a where a.run_id = r.id), '{}'::jsonb))
  from public.level_runs r join private.official_level_rules l on l.level_id = r.level_id where r.id = p_run;
$$;

create or replace function public.level_start_run(p_level int, p_mode text, p_session uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); v_run uuid; s public.sessions;
begin
  if not exists (select 1 from private.official_level_rules where level_id = p_level) then raise exception 'Деңгей табылмады'; end if;
  if p_mode is null or p_mode not in ('solo', 'team') then raise exception 'Режим дұрыс емес'; end if;
  if p_mode = 'team' then
    select * into s from public.sessions where id = p_session;
    if not found or s.status <> 'started' or not exists (select 1 from public.members m where m.session_id = s.id and m.user_id = u) then
      raise exception 'Топтық режим тек басталған сессия мүшесіне рұқсат';
    end if;
  elsif p_session is not null then raise exception 'Жеке режимде сессия көрсетілмейді';
  end if;
  perform private.sync_profile(u);
  select id into v_run from public.level_runs where user_id = u and level_id = p_level and status = 'active';
  if v_run is null then
    insert into public.level_runs (user_id, level_id, mode, session_id) values (u, p_level, p_mode, p_session) returning id into v_run;
  end if;
  return private.level_run_state(v_run);
end $$;

create or replace function public.level_submit_answer(p_run uuid, p_quiz text, p_choice int, p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user(); r public.level_runs; k private.official_quiz_keys; a private.level_run_answers;
  payload jsonb := jsonb_build_object('fn', 'answer', 'run', p_run, 'quiz', p_quiz, 'choice', p_choice);
  replay jsonb; ok boolean; pts int := 0; res jsonb;
begin
  -- Owner check comes first: other users' runs are indistinguishable from missing ones.
  select * into r from public.level_runs where id = p_run and user_id = u for update;
  if not found then raise exception 'Попытка табылмады'; end if;
  replay := private.level_replay(p_request, u, payload);
  if replay is not null then return replay; end if;
  if r.status <> 'active' then raise exception 'Попытка аяқталған'; end if;
  select * into k from private.official_quiz_keys where level_id = r.level_id and quiz_id = p_quiz;
  if not found then raise exception 'Сұрақ табылмады'; end if;
  if p_choice is null or p_choice not between 0 and 9 then raise exception 'Жауап дұрыс емес'; end if;
  insert into private.level_run_answers (run_id, quiz_id) values (p_run, p_quiz) on conflict do nothing;
  select * into a from private.level_run_answers where run_id = p_run and quiz_id = p_quiz for update;
  ok := p_choice = k.correct;
  if a.correct or (k.kind = 'bonus' and a.attempts > 0) then
    -- Already solved / bonus already answered: report correctness, never award again.
    res := jsonb_build_object('correct', ok, 'awarded', 0, 'attempts', a.attempts, 'closed', true);
  else
    if ok then pts := case when k.kind = 'bonus' then 50 when a.attempts = 0 then 100 when a.attempts = 1 then 60 else 30 end; end if;
    update private.level_run_answers set attempts = attempts + 1, correct = ok, awarded = pts where run_id = p_run and quiz_id = p_quiz;
    res := jsonb_build_object('correct', ok, 'awarded', pts, 'attempts', a.attempts + 1, 'closed', ok or k.kind = 'bonus');
  end if;
  res := res || jsonb_build_object('run', private.level_run_state(p_run));
  insert into private.level_requests (request_id, user_id, payload, response) values (p_request, u, payload, res);
  return res || jsonb_build_object('duplicate', false);
end $$;

create or replace function public.level_finish_run(p_run uuid, p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user(); r public.level_runs; l private.official_level_rules;
  payload jsonb := jsonb_build_object('fn', 'finish', 'run', p_run);
  replay jsonb; v_score int; v_now timestamptz := clock_timestamp(); v_attempt int; res public.level_results; out jsonb;
begin
  select * into r from public.level_runs where id = p_run and user_id = u for update;
  if not found then raise exception 'Попытка табылмады'; end if;
  replay := private.level_replay(p_request, u, payload);
  if replay is not null then return replay; end if;
  if r.status <> 'active' then raise exception 'Попытка аяқталған'; end if;
  select * into l from private.official_level_rules where level_id = r.level_id;
  if not exists (select 1 from private.level_run_answers where run_id = p_run and quiz_id = l.required_quiz and correct) then
    raise exception 'Деңгейдің міндетті тапсырмасы орындалмаған';
  end if;
  if v_now - r.started_at < make_interval(secs => l.min_seconds) then raise exception 'Попытка тым жылдам аяқталды'; end if;
  select coalesce(sum(awarded), 0) into v_score from private.level_run_answers where run_id = p_run;
  v_score := least(v_score, l.max_score);
  -- Serialize per user+level so attempt numbers never collide.
  perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || r.level_id::text, 0));
  select coalesce(max(attempt_number), 0) + 1 into v_attempt from public.level_results where user_id = u and level_id = r.level_id;
  update public.level_runs set status = 'finished', finished_at = v_now where id = p_run;
  insert into public.level_results (run_id, user_id, level_id, score, max_score, percentage, started_at, finished_at, duration_seconds, attempt_number, passed, mode, session_id)
  values (p_run, u, r.level_id, v_score, l.max_score, round(v_score * 100.0 / l.max_score, 2), r.started_at, v_now,
          floor(extract(epoch from v_now - r.started_at))::int, v_attempt, v_score >= l.pass_score, r.mode, r.session_id)
  returning * into res;
  out := to_jsonb(res) - 'user_id';
  insert into private.level_requests (request_id, user_id, payload, response) values (p_request, u, payload, out);
  return out || jsonb_build_object('duplicate', false);
end $$;

create or replace function public.level_abandon_run(p_run uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user();
begin
  update public.level_runs set status = 'abandoned', finished_at = clock_timestamp() where id = p_run and user_id = u and status = 'active';
  if not found then raise exception 'Белсенді попытка табылмады'; end if;
end $$;

create or replace function public.get_my_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); p public.profiles;
begin
  select * into p from public.profiles where id = u;
  if not found then perform private.sync_profile(u); select * into p from public.profiles where id = u; end if;
  return jsonb_build_object(
    'id', p.id, 'google_user_id', p.google_user_id, 'name', p.display_name, 'email', p.email, 'avatar_url', p.avatar_url,
    'created_at', p.created_at, 'role', private.profile_role(u),
    'levels', coalesce((select jsonb_agg(x order by x.level_id) from (
        select level_id, count(*) as attempts, max(score) as best_score, max(max_score) as max_score, max(percentage) as best_percentage,
               bool_or(passed) as passed, min(duration_seconds) filter (where passed) as best_duration_seconds, max(finished_at) as last_finished_at
        from public.level_results where user_id = u group by level_id) x), '[]'::jsonb),
    'active_runs', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'level_id', level_id, 'mode', mode, 'started_at', started_at))
        from public.level_runs where user_id = u and status = 'active'), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.finished_at desc) from (
        select * from public.level_results where user_id = u order by finished_at desc limit 20) r), '[]'::jsonb));
end $$;

create or replace function public.sync_my_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user();
begin
  perform private.sync_profile(u);
  return public.get_my_profile();
end $$;

create or replace function public.admin_get_level_results(p_level int default null, p_limit int default 100, p_offset int default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user();
begin
  if private.get_user_role(u) not in ('teacher', 'admin') then raise exception 'Құқық жоқ'; end if;
  return coalesce((select jsonb_agg(x) from (
    select r.id, r.user_id, p.display_name as name, r.level_id, r.score, r.max_score, r.percentage, r.started_at, r.finished_at,
           r.duration_seconds, r.attempt_number, r.passed, r.mode
    from public.level_results r left join public.profiles p on p.id = r.user_id
    where p_level is null or r.level_id = p_level
    order by r.finished_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb);
end $$;

revoke all on function private.profile_role(uuid), private.sync_profile(uuid), private.on_auth_user(), private.on_role_change(),
  private.level_replay(uuid, uuid, jsonb), private.level_run_state(uuid) from public, anon, authenticated;
revoke all on function public.level_start_run(int, text, uuid), public.level_submit_answer(uuid, text, int, uuid), public.level_finish_run(uuid, uuid),
  public.level_abandon_run(uuid), public.get_my_profile(), public.sync_my_profile(), public.admin_get_level_results(int, int, int) from public, anon;
grant execute on function public.level_start_run(int, text, uuid), public.level_submit_answer(uuid, text, int, uuid), public.level_finish_run(uuid, uuid),
  public.level_abandon_run(uuid), public.get_my_profile(), public.sync_my_profile(), public.admin_get_level_results(int, int, int) to authenticated;

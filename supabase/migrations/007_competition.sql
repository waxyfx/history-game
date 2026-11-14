-- Migration 007: competitive level system.
-- * Every level: max_score 100, pass_score 90 (configurable in private.official_level_rules).
-- * Historical trials are single-choice branches: one answer per trial, the server never tells the
--   client whether a choice was correct during the run (choices lead to story branches).
-- * Fail (score < pass_score): the level is finished but not passed, the next level stays locked,
--   a new attempt starts from 0 with attempt_number + 1. Pass: the next level unlocks.
-- * Times are server-side: attempt duration = run finished_at - started_at; the competition timer
--   (first official start -> now/end) is NOT reset by retries.

-- ---------------------------------------------------------------- rules and keys
alter table private.official_quiz_keys add column if not exists points int not null default 0 check (points between 0 and 100);
alter table private.official_quiz_keys drop constraint if exists official_quiz_keys_kind_check;
alter table private.official_quiz_keys add constraint official_quiz_keys_kind_check check (kind in ('main', 'final', 'secret', 'bonus'));
alter table private.official_level_rules drop constraint if exists official_level_rules_check;
alter table private.official_level_rules add constraint official_level_rules_check check (pass_score <= max_score);

-- MAP01: 3 mandatory trials (20 each) + final trial (30) = 90; secret trials add up to 10.
update private.official_level_rules set max_score = 100, pass_score = 90, required_quiz = 'stone_secret' where level_id = 1;
update private.official_quiz_keys k set kind = v.kind, points = v.points from (values
  ('stone_main', 'main', 20), ('stone_hunting', 'main', 20), ('stone_cave', 'main', 20), ('stone_secret', 'final', 30),
  ('stone_workshop', 'secret', 4), ('stone_bonus_4', 'secret', 2),
  ('stone_bonus_1', 'secret', 1), ('stone_bonus_2', 'secret', 1), ('stone_bonus_3', 'secret', 1), ('stone_bonus_5', 'secret', 1)
) as v(quiz_id, kind, points) where k.level_id = 1 and k.quiz_id = v.quiz_id;
-- Later epochs get their rules now (content/keys arrive with each level); they stay locked until the
-- previous level is passed and cannot be finished without their own trials.
insert into private.official_level_rules (level_id, max_score, pass_score, min_seconds, required_quiz)
select g, 100, 90, 60, 'final' from generate_series(2, 10) g on conflict (level_id) do nothing;

-- ---------------------------------------------------------------- competition (total timer)
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  mode text not null check (mode in ('solo', 'team')),
  session_id uuid references public.sessions on delete set null,
  status text not null default 'active' check (status in ('active', 'finished')),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz
);
create unique index competitions_one_active on public.competitions(user_id, mode) where status = 'active';
alter table public.competitions enable row level security;
revoke all on public.competitions from public, anon, authenticated;
grant select on public.competitions to authenticated;
create policy own_competitions on public.competitions for select to authenticated using (user_id = auth.uid());

alter table public.level_runs add column if not exists competition_id uuid references public.competitions on delete set null;
alter table private.level_run_answers add column if not exists choice int;
alter table public.level_results add column if not exists competition_id uuid references public.competitions on delete set null;
alter table public.level_results add column if not exists competition_seconds int check (competition_seconds >= 0);

create or replace function private.level_unlocked(u uuid, p_level int) returns boolean language sql stable security definer set search_path='' as $$
  select p_level = 1 or exists (select 1 from public.level_results where user_id = u and level_id = p_level - 1 and passed);
$$;

-- During a run the client sees only WHICH trials were answered, never correctness or score.
create or replace function private.level_run_state(p_run uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id', r.id, 'level_id', r.level_id, 'mode', r.mode, 'status', r.status, 'started_at', r.started_at,
    'competition_id', r.competition_id, 'competition_started_at', c.started_at, 'server_now', clock_timestamp(),
    'max_score', l.max_score, 'pass_score', l.pass_score,
    'answered', coalesce((select jsonb_agg(a.quiz_id order by a.quiz_id) from private.level_run_answers a where a.run_id = r.id and a.attempts > 0), '[]'::jsonb))
  from public.level_runs r join private.official_level_rules l on l.level_id = r.level_id
  left join public.competitions c on c.id = r.competition_id where r.id = p_run;
$$;

create or replace function public.level_start_run(p_level int, p_mode text, p_session uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); v_run uuid; s public.sessions; v_comp uuid;
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
  if not private.level_unlocked(u, p_level) then raise exception 'Деңгей құлыптаулы: алдыңғы дәуір өтілмеген'; end if;
  perform private.sync_profile(u);
  select id into v_run from public.level_runs where user_id = u and level_id = p_level and status = 'active';
  if v_run is null then
    select id into v_comp from public.competitions where user_id = u and mode = p_mode and status = 'active';
    if v_comp is null then
      insert into public.competitions (user_id, mode, session_id) values (u, p_mode, p_session) returning id into v_comp;
    end if;
    insert into public.level_runs (user_id, level_id, mode, session_id, competition_id) values (u, p_level, p_mode, p_session, v_comp) returning id into v_run;
  end if;
  return private.level_run_state(v_run);
end $$;

create or replace function public.level_submit_answer(p_run uuid, p_quiz text, p_choice int, p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user(); r public.level_runs; k private.official_quiz_keys; a private.level_run_answers;
  payload jsonb := jsonb_build_object('fn', 'answer', 'run', p_run, 'quiz', p_quiz, 'choice', p_choice);
  replay jsonb; res jsonb;
begin
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
  if a.attempts > 0 then
    res := jsonb_build_object('recorded', false, 'closed', true);   -- one choice per trial; nothing changes
  else
    update private.level_run_answers set attempts = 1, choice = p_choice, correct = (p_choice = k.correct),
      awarded = case when p_choice = k.correct then k.points else 0 end
    where run_id = p_run and quiz_id = p_quiz;
    res := jsonb_build_object('recorded', true, 'closed', true);
  end if;
  res := res || jsonb_build_object('run', private.level_run_state(p_run));
  insert into private.level_requests (request_id, user_id, payload, response) values (p_request, u, payload, res);
  return res || jsonb_build_object('duplicate', false);
end $$;

create or replace function public.level_finish_run(p_run uuid, p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user(); r public.level_runs; l private.official_level_rules;
  payload jsonb := jsonb_build_object('fn', 'finish', 'run', p_run);
  replay jsonb; v_score int; v_now timestamptz := clock_timestamp(); v_attempt int; v_passed boolean;
  c public.competitions; v_last int; res public.level_results; out jsonb;
begin
  select * into r from public.level_runs where id = p_run and user_id = u for update;
  if not found then raise exception 'Попытка табылмады'; end if;
  replay := private.level_replay(p_request, u, payload);
  if replay is not null then return replay; end if;
  if r.status <> 'active' then raise exception 'Попытка аяқталған'; end if;
  select * into l from private.official_level_rules where level_id = r.level_id;
  -- The final trial must be ANSWERED (any choice: a wrong one is a story branch, not a softlock).
  if not exists (select 1 from private.level_run_answers where run_id = p_run and quiz_id = l.required_quiz and attempts > 0) then
    raise exception 'Деңгейдің соңғы сынағы орындалмаған';
  end if;
  if v_now - r.started_at < make_interval(secs => l.min_seconds) then raise exception 'Попытка тым жылдам аяқталды'; end if;
  select least(coalesce(sum(awarded), 0), l.max_score) into v_score from private.level_run_answers where run_id = p_run;
  v_passed := v_score >= l.pass_score;
  perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || r.level_id::text, 0));
  select coalesce(max(attempt_number), 0) + 1 into v_attempt from public.level_results where user_id = u and level_id = r.level_id;
  update public.level_runs set status = 'finished', finished_at = v_now where id = p_run;
  select * into c from public.competitions where id = r.competition_id for update;
  -- The competition ends when the last configured level is passed; retries never reset it.
  select max(level_id) into v_last from private.official_level_rules;
  if found and c.id is not null and v_passed and r.level_id = v_last then
    update public.competitions set status = 'finished', finished_at = v_now where id = c.id;
  end if;
  insert into public.level_results (run_id, user_id, level_id, score, max_score, percentage, started_at, finished_at, duration_seconds,
                                    attempt_number, passed, mode, session_id, competition_id, competition_seconds)
  values (p_run, u, r.level_id, v_score, l.max_score, round(v_score * 100.0 / l.max_score, 2), r.started_at, v_now,
          floor(extract(epoch from v_now - r.started_at))::int, v_attempt, v_passed, r.mode, r.session_id,
          c.id, case when c.id is null then null else floor(extract(epoch from v_now - c.started_at))::int end)
  returning * into res;
  out := (to_jsonb(res) - 'user_id') || jsonb_build_object('pass_score', l.pass_score,
    'next_level', case when r.level_id < 10 then r.level_id + 1 else null end,
    'next_level_unlocked', v_passed and r.level_id < 10,
    'answers', (select jsonb_object_agg(a.quiz_id, jsonb_build_object('correct', a.correct, 'awarded', a.awarded))
                from private.level_run_answers a where a.run_id = p_run));
  insert into private.level_requests (request_id, user_id, payload, response) values (p_request, u, payload, out);
  return out || jsonb_build_object('duplicate', false);
end $$;

create or replace function public.get_my_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); p public.profiles;
begin
  select * into p from public.profiles where id = u;
  if not found then perform private.sync_profile(u); select * into p from public.profiles where id = u; end if;
  return jsonb_build_object(
    'id', p.id, 'google_user_id', p.google_user_id, 'name', p.display_name, 'email', p.email, 'avatar_url', p.avatar_url,
    'created_at', p.created_at, 'role', private.profile_role(u),
    'unlocked_levels', (select jsonb_agg(g order by g) from generate_series(1, 10) g where private.level_unlocked(u, g)),
    'levels', coalesce((select jsonb_agg(x order by x.level_id) from (
        select level_id, count(*) as attempts, max(score) as best_score, max(max_score) as max_score, max(percentage) as best_percentage,
               bool_or(passed) as passed, min(duration_seconds) filter (where passed) as best_duration_seconds, max(finished_at) as last_finished_at
        from public.level_results where user_id = u group by level_id) x), '[]'::jsonb),
    'active_runs', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'level_id', level_id, 'mode', mode, 'started_at', started_at))
        from public.level_runs where user_id = u and status = 'active'), '[]'::jsonb),
    'competitions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'mode', mode, 'status', status, 'started_at', started_at, 'finished_at', finished_at,
        'elapsed_seconds', floor(extract(epoch from coalesce(finished_at, clock_timestamp()) - started_at))::int) order by started_at desc)
        from public.competitions where user_id = u), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(to_jsonb(r) - 'user_id' order by r.finished_at desc) from (
        select * from public.level_results where user_id = u order by finished_at desc limit 20) r), '[]'::jsonb));
end $$;

revoke all on function private.level_unlocked(uuid, int) from public, anon, authenticated;

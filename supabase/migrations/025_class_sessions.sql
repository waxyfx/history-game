-- Migration 025: class sessions from the teacher panel (audit №14: «Сыныпқа арналған тест сессиясын құру / жабу — Жоқ»,
-- «Топтық жарыс / 2 команда рейтингі — Жоқ»).
-- A teacher creates a session for one epoch; the class joins with its 10-letter code (team A or B), the teacher starts it,
-- every student plays that epoch in team mode (?level=N&session=…: official runs tied to the session) and the panel shows
-- the class table and the two teams' totals live; the teacher closes the session at the end of the lesson.
-- The old Doom-era create_session/start_session (001) checked the retired private.teachers table and needed two teams
-- to start; these use the roles of migration 018 (private.get_user_role) and allow a whole class in one team.

alter table public.sessions add column if not exists level_id int check (level_id between 1 and 10);

-- A student in a started session for an epoch may open that epoch even if the previous one is not passed yet:
-- the teacher chooses the lesson's epoch.
create or replace function private.level_unlocked(u uuid, p_level int) returns boolean language sql stable security definer set search_path='' as $$
  select p_level = 1
    or exists (select 1 from public.level_results where user_id = u and level_id = p_level - 1 and passed)
    or exists (select 1 from public.members m join public.sessions s on s.id = m.session_id
               where m.user_id = u and s.level_id = p_level and s.status = 'started');
$$;
revoke all on function private.level_unlocked(uuid, int) from public, anon, authenticated;

-- level_start_run (007) resumed any active run of the level, so a student with an unfinished solo run joined the class
-- session with that run and the result never reached the class table. A run of another session (or a solo run when a
-- session is asked for, and back) is abandoned first; the rest is unchanged.
create or replace function public.level_start_run(p_level int, p_mode text, p_session uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); v_run uuid; v_sess uuid; s public.sessions; v_comp uuid;
begin
  if not exists (select 1 from private.official_level_rules where level_id = p_level) then raise exception 'Деңгей табылмады'; end if;
  if p_mode is null or p_mode not in ('solo', 'team') then raise exception 'Режим дұрыс емес'; end if;
  if p_mode = 'team' then
    select * into s from public.sessions where id = p_session;
    if not found or s.status <> 'started' or not exists (select 1 from public.members m where m.session_id = s.id and m.user_id = u) then
      raise exception 'Топтық режим тек басталған сессия мүшесіне рұқсат';
    end if;
    if s.level_id is not null and s.level_id <> p_level then raise exception 'Бұл сессия басқа дәуірге арналған'; end if;
  elsif p_session is not null then raise exception 'Жеке режимде сессия көрсетілмейді';
  end if;
  if not private.level_unlocked(u, p_level) then raise exception 'Деңгей құлыптаулы: алдыңғы дәуір өтілмеген'; end if;
  perform private.sync_profile(u);
  select id, session_id into v_run, v_sess from public.level_runs where user_id = u and level_id = p_level and status = 'active';
  if v_run is not null and v_sess is distinct from p_session then
    update public.level_runs set status = 'abandoned', finished_at = clock_timestamp() where id = v_run;
    v_run := null;
  end if;
  if v_run is null then
    select id into v_comp from public.competitions where user_id = u and mode = p_mode and status = 'active'
      and session_id is not distinct from p_session;
    if v_comp is null then
      update public.competitions set status = 'finished', finished_at = clock_timestamp() where user_id = u and mode = p_mode and status = 'active';
      insert into public.competitions (user_id, mode, session_id) values (u, p_mode, p_session) returning id into v_comp;
    end if;
    insert into public.level_runs (user_id, level_id, mode, session_id, competition_id) values (u, p_level, p_mode, p_session, v_comp) returning id into v_run;
  end if;
  return private.level_run_state(v_run);
end $$;

create or replace function private.require_teacher(u uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare r text := private.get_user_role(u);
begin
  if r not in ('teacher', 'admin') then raise exception 'Мұғалім құқығы қажет'; end if;
  return r;
end $$;
revoke all on function private.require_teacher(uuid) from public, anon, authenticated;

-- The host teacher, or an admin, may manage a session.
create or replace function private.own_session(u uuid, p_session uuid) returns public.sessions language plpgsql stable security definer set search_path='' as $$
declare r text := private.require_teacher(u); s public.sessions;
begin
  select * into s from public.sessions where id = p_session;
  if not found then raise exception 'Сессия табылмады'; end if;
  if s.host <> u and r <> 'admin' then raise exception 'Құқық жеткіліксіз'; end if;
  return s;
end $$;
revoke all on function private.own_session(uuid, uuid) from public, anon, authenticated;

create or replace function private.session_json(s public.sessions) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id', s.id, 'code', s.code, 'title', s.title, 'level_id', s.level_id, 'status', s.status,
    'created_at', s.created_at, 'started_at', s.started_at,
    'members', (select count(*) from public.members m where m.session_id = s.id));
$$;
revoke all on function private.session_json(public.sessions) from public, anon, authenticated;

create or replace function public.class_session_create(p_title text, p_level int) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); s public.sessions;
begin
  perform private.require_teacher(u);
  if p_title is null or length(trim(p_title)) not between 1 and 80 then raise exception 'Сессия атауын тексеріңіз'; end if;
  if p_level is null or p_level not between 1 and 10 then raise exception 'Дәуірді таңдаңыз'; end if;
  if (select count(*) from public.sessions where host = u and status <> 'closed') >= 20 then raise exception 'Ашық сессиялар тым көп: ескілерін жабыңыз'; end if;
  insert into public.sessions (host, title, level_id) values (u, trim(p_title), p_level) returning * into s;
  return private.session_json(s);
end $$;

-- A student joins with the code: team 0 (A) or 1 (B); late arrivals may join a started session, not a closed one.
create or replace function public.class_session_join(p_code text, p_team int) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); s public.sessions; n text;
begin
  if p_team is null or p_team not in (0, 1) or p_code is null or length(trim(p_code)) <> 10 then raise exception 'Сессия коды немесе топ қате'; end if;
  select * into s from public.sessions where code = upper(trim(p_code));
  if not found or s.status = 'closed' then raise exception 'Сессия табылмады немесе жабылған'; end if;
  if (select count(*) from public.members where session_id = s.id) >= 60 and not exists (select 1 from public.members where session_id = s.id and user_id = u) then
    raise exception 'Сессия толық';
  end if;
  perform private.sync_profile(u);
  select coalesce(nullif(display_name, ''), 'Оқушы') into n from public.profiles where id = u;
  insert into public.members (session_id, user_id, team, display_name) values (s.id, u, p_team, left(coalesce(n, 'Оқушы'), 80))
  on conflict (session_id, user_id) do update set team = case when s.status = 'lobby' then excluded.team else public.members.team end;
  return private.session_json(s) || jsonb_build_object('team', (select team from public.members where session_id = s.id and user_id = u));
end $$;

create or replace function public.class_session_start(p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); s public.sessions := private.own_session(u, p_session);
begin
  if s.status <> 'lobby' then raise exception 'Сессия бұрын басталған'; end if;
  update public.sessions set status = 'started', started_at = clock_timestamp() where id = p_session returning * into s;
  return private.session_json(s);
end $$;

create or replace function public.class_session_close(p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); s public.sessions := private.own_session(u, p_session);
begin
  update public.sessions set status = 'closed' where id = p_session returning * into s;
  return private.session_json(s);
end $$;

create or replace function public.class_session_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := private.require_user(); r text := private.require_teacher(u);
begin
  return coalesce((select jsonb_agg(private.session_json(s) order by s.created_at desc)
    from (select * from public.sessions where (host = u or r = 'admin') and level_id is not null order by created_at desc limit 50) s), '[]'::jsonb);
end $$;

-- The class table: every member's best result of this session (score, %, passed, time, attempts) and the two teams'
-- totals (average best score of each team, members who passed).
create or replace function public.class_session_results(p_session uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := private.require_user(); s public.sessions := private.own_session(u, p_session); rows jsonb;
begin
  with best as (
    select distinct on (lr.user_id) lr.user_id, lr.score, lr.max_score, lr.percentage, lr.passed, lr.duration_seconds
    from public.level_results lr where lr.session_id = p_session
    order by lr.user_id, lr.score desc, lr.duration_seconds asc
  ), tries as (
    select user_id, count(*) as n from public.level_results where session_id = p_session group by user_id
  ), playing as (
    select user_id from public.level_runs where session_id = p_session and status = 'active'
  )
  select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', m.display_name, 'team', m.team,
      'score', b.score, 'max_score', b.max_score, 'percentage', b.percentage, 'passed', b.passed, 'seconds', b.duration_seconds,
      'attempts', coalesce(t.n, 0), 'playing', exists (select 1 from playing p where p.user_id = m.user_id))
      order by b.score desc nulls last, b.duration_seconds asc nulls last, m.display_name), '[]'::jsonb)
  into rows
  from public.members m left join best b on b.user_id = m.user_id left join tries t on t.user_id = m.user_id
  where m.session_id = p_session;
  return jsonb_build_object('session', private.session_json(s), 'members', rows,
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('team', g.team, 'members', g.members, 'finished', g.finished,
        'passed', g.passed, 'average', g.average) order by g.team), '[]'::jsonb)
      from (select m.team, count(*) as members, count(b.user_id) as finished, count(*) filter (where b.passed) as passed,
              round(avg(coalesce(b.score, 0))::numeric, 1) as average
            from public.members m left join (
              select distinct on (user_id) user_id, score, passed from public.level_results where session_id = p_session
              order by user_id, score desc) b on b.user_id = m.user_id
            where m.session_id = p_session group by m.team) g));
end $$;

revoke all on function public.class_session_create(text, int), public.class_session_join(text, int), public.class_session_start(uuid),
  public.class_session_close(uuid), public.class_session_list(), public.class_session_results(uuid) from public, anon;
grant execute on function public.class_session_create(text, int), public.class_session_join(text, int), public.class_session_start(uuid),
  public.class_session_close(uuid), public.class_session_list(), public.class_session_results(uuid) to authenticated;

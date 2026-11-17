-- Migration 018: the admin panel reads the real 2D-game data.
-- The 004 admin functions count the legacy 3D tables (game_runs, members, dynamic_quizzes), which the
-- 2D campaign never writes. These functions read what it does write: profiles (Google sign-in),
-- official runs (level_runs), results (level_results), per-trial answers and the level rules/keys.
-- Teacher or admin only (private.require_teacher_or_admin); e-mail addresses are shown to admins only.
-- Answer keys (which option is correct) are never returned.

-- Overview: user counts, result totals, per-level statistics and the latest results.
create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare r text := private.require_teacher_or_admin();
begin
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'students', (select count(*) from public.profiles where role = 'student'),
    'teachers', (select count(*) from public.profiles where role = 'teacher'),
    'admins', (select count(*) from public.profiles where role = 'admin'),
    'runs_active', (select count(*) from public.level_runs where status = 'active'),
    'results', (select count(*) from public.level_results),
    'passed', (select count(*) from public.level_results where passed),
    'players_with_results', (select count(distinct user_id) from public.level_results),
    'avg_percentage', (select coalesce(round(avg(percentage), 1), 0) from public.level_results),
    'levels', coalesce((select jsonb_agg(x order by x.level_id) from (
      select l.level_id, l.max_score, l.pass_score,
             (select count(*) from private.official_quiz_keys k where k.level_id = l.level_id) as trials,
             count(res.id) as attempts,
             count(distinct res.user_id) as players,
             count(distinct res.user_id) filter (where res.passed) as passed_players,
             coalesce(round(avg(res.percentage), 1), 0) as avg_percentage,
             coalesce(max(res.percentage), 0) as best_percentage,
             coalesce(round(avg(res.duration_seconds)), 0)::int as avg_seconds,
             (select count(*) from public.level_runs lr where lr.level_id = l.level_id and lr.status = 'active') as runs_active
      from private.official_level_rules l
      left join public.level_results res on res.level_id = l.level_id
      group by l.level_id, l.max_score, l.pass_score) x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(y) from (
      select res.level_id, res.score, res.max_score, res.percentage, res.passed, res.attempt_number,
             res.duration_seconds, res.finished_at, coalesce(p.display_name, '—') as name
      from public.level_results res left join public.profiles p on p.id = res.user_id
      order by res.finished_at desc limit 10) y), '[]'::jsonb)
  );
end $$;

-- People who signed in, with their role and a summary of their official results.
create or replace function public.admin_list_users(p_search text default null, p_limit int default 200, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text := private.require_teacher_or_admin();
  q text := nullif(trim(coalesce(p_search, '')), '');
begin
  return coalesce((select jsonb_agg(x) from (
    select p.id as user_id, p.display_name as name, p.avatar_url, p.role, p.created_at,
           case when r = 'admin' then p.email end as email,
           (select count(*) from public.level_results res where res.user_id = p.id) as attempts,
           (select count(distinct res.level_id) from public.level_results res where res.user_id = p.id and res.passed) as levels_passed,
           (select max(res.level_id) from public.level_results res where res.user_id = p.id and res.passed) as max_level_passed,
           (select coalesce(sum(b.best), 0) from (select max(res.score) as best from public.level_results res
              where res.user_id = p.id group by res.level_id) b) as best_total,
           greatest(p.created_at, (select max(lr.started_at) from public.level_runs lr where lr.user_id = p.id)) as last_active
    from public.profiles p
    where q is null or strpos(lower(p.display_name), lower(q)) > 0
       or (r = 'admin' and strpos(lower(coalesce(p.email, '')), lower(q)) > 0)
    order by last_active desc nulls last
    limit least(greatest(coalesce(p_limit, 200), 1), 500) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb);
end $$;

-- Per-trial statistics for one level over finished runs: how many answered and how many chose correctly.
create or replace function public.admin_trial_stats(p_level int) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text := private.require_teacher_or_admin();
begin
  return coalesce((select jsonb_agg(x order by x.kind_order, x.quiz_id) from (
    select k.quiz_id, k.kind, k.points,
           case k.kind when 'main' then 1 when 'final' then 2 when 'secret' then 3 else 4 end as kind_order,
           count(a.run_id) filter (where a.attempts > 0) as answered_count,
           count(a.run_id) filter (where a.correct) as right_count
    from private.official_quiz_keys k
    left join public.level_runs lr on lr.level_id = k.level_id and lr.status = 'finished'
    left join private.level_run_answers a on a.run_id = lr.id and a.quiz_id = k.quiz_id
    where k.level_id = p_level
    group by k.quiz_id, k.kind, k.points) x), '[]'::jsonb);
end $$;

revoke all on function public.admin_overview(), public.admin_list_users(text, int, int), public.admin_trial_stats(int) from public, anon;
grant execute on function public.admin_overview(), public.admin_list_users(text, int, int), public.admin_trial_stats(int) to authenticated;

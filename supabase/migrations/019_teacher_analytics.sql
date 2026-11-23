-- Migration 019: teacher analytics on the real 2D-game data (audit №14, «Мұғалімге жарамдылық»).
-- * admin_trial_stats: per trial, how many finished runs picked each option (A, B, C, D…), so a teacher sees which
--   wrong idea the class believed, not only the share of right answers.
-- * admin_result_answers: one student's answers in one finished run — which trials were right and which option was
--   picked — so a teacher sees exactly where that student went wrong.
-- Teacher or admin only (private.require_teacher_or_admin, migration 018). As in 018, answer keys are never returned:
-- the panel marks the right option from the trial texts it already ships.

create or replace function public.admin_trial_stats(p_level int) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text := private.require_teacher_or_admin();
begin
  return coalesce((select jsonb_agg(x order by x.kind_order, x.quiz_id) from (
    select k.quiz_id, k.kind, k.points,
           case k.kind when 'main' then 1 when 'final' then 2 when 'secret' then 3 else 4 end as kind_order,
           count(a.run_id) filter (where a.attempts > 0) as answered_count,
           count(a.run_id) filter (where a.correct) as right_count,
           coalesce((select jsonb_object_agg(c.choice::text, c.n) from (
               select a2.choice, count(*) as n
               from public.level_runs lr2
               join private.level_run_answers a2 on a2.run_id = lr2.id and a2.quiz_id = k.quiz_id
               where lr2.level_id = k.level_id and lr2.status = 'finished' and a2.attempts > 0 and a2.choice is not null
               group by a2.choice) c), '{}'::jsonb) as choices
    from private.official_quiz_keys k
    left join public.level_runs lr on lr.level_id = k.level_id and lr.status = 'finished'
    left join private.level_run_answers a on a.run_id = lr.id and a.quiz_id = k.quiz_id
    where k.level_id = p_level
    group by k.level_id, k.quiz_id, k.kind, k.points) x), '[]'::jsonb);
end $$;

create or replace function public.admin_result_answers(p_result uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text := private.require_teacher_or_admin(); v_run uuid; v_level int;
begin
  select lr.run_id, lr.level_id into v_run, v_level from public.level_results lr where lr.id = p_result;
  if not found then raise exception 'Нәтиже табылмады'; end if;
  return coalesce((select jsonb_agg(x order by x.kind_order, x.quiz_id) from (
    select k.quiz_id, k.kind, k.points,
           case k.kind when 'main' then 1 when 'final' then 2 when 'secret' then 3 else 4 end as kind_order,
           coalesce(a.attempts, 0) > 0 as answered, a.choice, coalesce(a.correct, false) as right, coalesce(a.awarded, 0) as awarded
    from private.official_quiz_keys k
    left join private.level_run_answers a on a.run_id = v_run and a.quiz_id = k.quiz_id
    where k.level_id = v_level) x), '[]'::jsonb);
end $$;

revoke all on function public.admin_trial_stats(int), public.admin_result_answers(uuid) from public, anon;
grant execute on function public.admin_trial_stats(int), public.admin_result_answers(uuid) to authenticated;

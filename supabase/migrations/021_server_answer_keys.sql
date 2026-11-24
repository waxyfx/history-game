-- Migration 021: the trial answer keys leave the browser (audit №14, «клиенттегі жауап кілттері»).
-- A production build ships no correctIndex (vite plugin scripts/strip-answer-keys.mjs). The server alone knows the keys:
-- * level_submit_answer: still one choice per trial; right after that choice it returns the verdict and the right
--   option, so the game shows its feedback card at once (the choice is already fixed — nothing can change).
--   Choices up to 99999: ordering and matching trials send their arrangement as digits (e.g. 2031).
-- * trial_check: a verdict outside an official run — for a teacher or admin, after the player has finished the level,
--   or for a trial the player has already answered (practice replays). It never opens a key before a first choice.
-- * admin_trial_keys: the right options for the Trials tab of the teacher panel (teacher/admin only).

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
  if p_choice is null or p_choice not between 0 and 99999 then raise exception 'Жауап дұрыс емес'; end if;
  insert into private.level_run_answers (run_id, quiz_id) values (p_run, p_quiz) on conflict do nothing;
  select * into a from private.level_run_answers where run_id = p_run and quiz_id = p_quiz for update;
  if a.attempts > 0 then
    -- One choice per trial: the first one stands; its verdict is repeated, nothing changes.
    res := jsonb_build_object('recorded', false, 'closed', true, 'choice', a.choice, 'correct', coalesce(a.correct, false));
  else
    update private.level_run_answers set attempts = 1, choice = p_choice, correct = (p_choice = k.correct),
      awarded = case when p_choice = k.correct then k.points else 0 end
    where run_id = p_run and quiz_id = p_quiz;
    res := jsonb_build_object('recorded', true, 'closed', true, 'choice', p_choice, 'correct', p_choice = k.correct);
  end if;
  res := res || jsonb_build_object('right', k.correct, 'run', private.level_run_state(p_run));
  insert into private.level_requests (request_id, user_id, payload, response) values (p_request, u, payload, res);
  return res || jsonb_build_object('duplicate', false);
end $$;

create or replace function public.trial_check(p_level int, p_quiz text, p_choice int) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := private.require_user(); k private.official_quiz_keys;
begin
  select * into k from private.official_quiz_keys where level_id = p_level and quiz_id = p_quiz;
  if not found then raise exception 'Сұрақ табылмады'; end if;
  if p_choice is null or p_choice not between 0 and 99999 then raise exception 'Жауап дұрыс емес'; end if;
  if private.get_user_role(u) not in ('teacher', 'admin')
     and not exists (select 1 from public.level_runs lr where lr.user_id = u and lr.level_id = p_level and lr.status = 'finished')
     and not exists (select 1 from public.level_runs lr join private.level_run_answers a on a.run_id = lr.id
                     where lr.user_id = u and lr.level_id = p_level and a.quiz_id = p_quiz and a.attempts > 0) then
    raise exception 'Жауапты тексеру ресми попыткада ғана ашылады';
  end if;
  return jsonb_build_object('correct', p_choice = k.correct, 'right', k.correct);
end $$;

create or replace function public.admin_trial_keys(p_level int) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text := private.require_teacher_or_admin();
begin
  return coalesce((select jsonb_object_agg(k.quiz_id, k.correct) from private.official_quiz_keys k where k.level_id = p_level), '{}'::jsonb);
end $$;

revoke all on function public.trial_check(int, text, int), public.admin_trial_keys(int) from public, anon;
grant execute on function public.trial_check(int, text, int), public.admin_trial_keys(int) to authenticated;

-- Migration 004: Admin Panel, RBAC, Campaign V2 & Dynamic Quizzes
-- Preserves all existing 001/002/003 schema, legacy Beta 0.1, and 100/60/30 grading rules.

-- 1. RBAC User Roles
create table if not exists private.user_roles (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check(role in ('player', 'teacher', 'admin')),
  created_at timestamptz not null default clock_timestamp()
);

-- Seed initial teachers as 'teacher' role
insert into private.user_roles (user_id, role)
select user_id, 'teacher' from private.teachers
on conflict (user_id) do nothing;

create or replace function private.get_user_role(u uuid) returns text language sql stable security definer set search_path='' as $$
  select coalesce(
    (select role from private.user_roles where user_id=u),
    case when exists(select 1 from private.teachers where user_id=u) then 'teacher' else 'player' end
  );
$$;

create or replace function public.get_my_role() returns text language sql stable security definer set search_path='' as $$
  select private.get_user_role(auth.uid());
$$;

-- 2. Audit Logs
create table if not exists private.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users,
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb,
  created_at timestamptz not null default clock_timestamp()
);

-- 3. Campaign V2 & 8 Historical Epochs
create table if not exists public.campaign_epochs (
  id int primary key check(id between 1 and 8),
  slug text unique not null,
  title text not null,
  subtitle text not null,
  period text not null,
  description text not null,
  published boolean not null default true,
  sort_order int not null default 1,
  created_at timestamptz not null default clock_timestamp()
);

insert into public.campaign_epochs (id, slug, title, subtitle, period, description, published, sort_order) values
(1, 'stone', 'Тас дәуірі', 'Алғашқы іздер', 'б.з.б. 2,6 млн ж. – б.з.б. 3 мыңж.', 'Палеолит, мезолит, неолит. Тас құралдар, отты меңгеру, Борықазған, Таңбалы.', true, 1),
(2, 'bronze', 'Қола дәуірі', 'Өркениет бастауы', 'б.з.б. II мыңж. – б.з.б. VIII ғ.', 'Андронов және Беғазы-Дәндібай мәдениеттері, металлургия, қыш өнері.', true, 2),
(3, 'saka', 'Сақ дәуірі', 'Дала мұрасы', 'б.з.б. VIII ғ. – б.з. V ғ.', 'Сақтар, үйсіндер, қаңлылар. Аң стилі, Бесшатыр және Есік обасы (Алтын адам).', true, 3),
(4, 'turk', 'Түрік қағанаты', 'Бабалар үні', 'VI – XIII ғғ. басы', 'Түрік қағанаты, Күлтегін мен Тоныкөк руна жазулары, Жібек жолы қалалары.', true, 4),
(5, 'kazakh_khanate', 'Қазақ хандығы', 'Хандық туы', '1465 ж. – XVIII ғ. басы', 'Керей мен Жәнібек, Қасым хан, Есім хан, Әз Тәуке хан және Жеті жарғы.', true, 5),
(6, 'freedom', 'Бостандық жолы', 'Елдік мұраты', 'XVIII ғ. – XX ғ. басы', 'Абылай хан, ұлт-азаттық көтерілістер (Кенесары), Абай, Алашорда үкіметі.', true, 6),
(7, 'soviet', 'Дәуір сыны', 'Қазақстан кеңес заманында', '1917 – 1991 жж.', 'Ауыр сындар, ҰОС батырлары (Бауыржан, Әлия, Мәншүк), Түрксіб, 1986 Желтоқсан.', true, 7),
(8, 'independent', 'Тәуелсіз Қазақстан', 'Жаңа заман', '1991 жылдан бүгінге дейін', 'Мемлекеттік тәуелсіздік, мемлекеттік рәміздер, Астана, тарихи толық шежіре.', true, 8)
on conflict (id) do update set
  title=excluded.title, subtitle=excluded.subtitle, period=excluded.period,
  description=excluded.description, published=excluded.published;

-- 4. Dynamic Quizzes (Editable by Teachers and Administrators without WASM rebuild)
create table if not exists public.dynamic_quizzes (
  id text primary key,
  epoch_id int not null references public.campaign_epochs(id),
  task_id text not null,
  question_text text not null,
  options jsonb not null,
  accepted_answers jsonb not null,
  explanation text not null,
  points int not null default 100,
  active boolean not null default true,
  created_by uuid references auth.users,
  updated_at timestamptz not null default clock_timestamp()
);

-- Seed Stone Age dynamic quizzes
insert into public.dynamic_quizzes (id, epoch_id, task_id, question_text, options, accepted_answers, explanation, points, active) values
('quiz_stone_main', 1, 'main', 'Адамзат тарихындағы ең ұзаққа созылған ежелгі тас ғасыры қалай аталады?', '["Неолит", "Палеолит", "Мезолит", "Энеолит"]'::jsonb, '["Палеолит"]'::jsonb, 'Палеолит — адамзат тарихының 99%-ын құрайтын ежелгі тас ғасыры.', 100, true),
('quiz_stone_workshop', 1, 'workshop', 'Қаратау жотасынан (Борықазған) табылған, бір жағы ғана жанышталған ең көне тас құрал қалай аталады?', '["Микролит", "Чоппер", "Қола орақ", "Темір кескіш"]'::jsonb, '["Чоппер"]'::jsonb, 'Чоппер — ерте палеолиттің қарапайым малтатас шапқы құралы.', 100, true),
('quiz_stone_hunting', 1, 'hunting', 'Мезолит дәуірінде аң аулауды түбегейлі өзгерткен басты өнертабыс қандай?', '["Дөңгелек", "Соқа", "Садақ пен жебе", "Болат қылыш"]'::jsonb, '["Садақ пен жебе"]'::jsonb, 'Садақ пен жебе мезолит дәуірінде пайда болып, жеке аңшылыққа мүмкіндік берді.', 100, true),
('quiz_stone_cave', 1, 'cave', 'Қазақстандағы ЮНЕСКО мұрасына енген, мыңдаған ежелгі петроглифтері бар атақты кешен қайсы?', '["Отырар төбесі", "Таңбалы (Тамғалы)", "Сарайшық", "Сығанақ"]'::jsonb, '["Таңбалы (Тамғалы)", "Таңбалы"]'::jsonb, 'Таңбалы шатқалында 5000-нан астам тасқа қашалған петроглифтер сақталған.', 100, true),
('quiz_stone_secret', 1, 'secret', 'Адам баласы тастан кейін алғаш игерген металл қайсы?', '["Мыс (энеолит)", "Шойын мен болат", "Алюминий", "Титан"]'::jsonb, '["Мыс (энеолит)", "Мыс"]'::jsonb, 'Адамдар тастан кейін алғаш рет таза мысты (энеолит) өңдеуді үйренді.', 100, true)
on conflict (id) do update set
  question_text=excluded.question_text, options=excluded.options,
  accepted_answers=excluded.accepted_answers, explanation=excluded.explanation;

-- Permissions and RLS
alter table public.campaign_epochs enable row level security;
alter table public.dynamic_quizzes enable row level security;
alter table private.user_roles enable row level security;
alter table private.audit_logs enable row level security;

revoke all on all tables in schema private from anon, authenticated;
grant select on public.campaign_epochs to anon, authenticated;
create policy select_published_epochs on public.campaign_epochs for select to public using(published=true or private.get_user_role(auth.uid()) in ('teacher','admin'));

revoke all on public.dynamic_quizzes from anon, authenticated;
grant select on public.dynamic_quizzes to authenticated;
create policy view_dynamic_quizzes on public.dynamic_quizzes for select to authenticated using(private.get_user_role(auth.uid()) in ('teacher','admin'));

-- Helper: require teacher or admin role
create or replace function private.require_teacher_or_admin() returns text language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  r text := private.get_user_role(u);
begin
  if r not in ('teacher', 'admin') then
    raise exception 'Құқық шектелген: Мұғалім немесе Әкімші рөлі қажет';
  end if;
  return r;
end $$;

-- 5. Admin RPC Functions
create or replace function public.admin_get_dashboard() returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r text := private.require_teacher_or_admin();
  total_players int; total_sessions int; active_sessions int; total_teams int;
  avg_score numeric; completed_runs int;
  recent_logs jsonb;
begin
  select count(distinct user_id) into total_players from public.members;
  select count(*) into total_sessions from public.sessions;
  select count(*) into active_sessions from public.sessions where status in ('lobby', 'started');
  select count(distinct team) into total_teams from public.members;
  select coalesce(round(avg(score), 1), 0) into avg_score from public.game_runs where status in ('finished', 'active');
  select count(*) into completed_runs from public.game_runs where status='finished';

  select coalesce(jsonb_agg(l), '[]'::jsonb) into recent_logs from (
    select id, action, target_type, target_id, details, created_at
    from private.audit_logs order by created_at desc limit 10
  ) l;

  return jsonb_build_object(
    'total_players', total_players,
    'total_sessions', total_sessions,
    'active_sessions', active_sessions,
    'total_teams', 2,
    'avg_score', avg_score,
    'completed_levels', completed_runs,
    'recent_logs', recent_logs
  );
end $$;

create or replace function public.admin_get_players(p_search text default null, p_limit int default 50, p_offset int default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r text := private.require_teacher_or_admin();
  players jsonb;
begin
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

create or replace function public.admin_get_teams() returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r text := private.require_teacher_or_admin();
  teams jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into teams from (
    select
      m.team,
      case when m.team=0 then 'Көк Бөрі (A тобы)' else 'Алтын Қыран (B тобы)' end as team_name,
      count(distinct m.user_id) as member_count,
      coalesce(sum(gr.score), 0) as total_score,
      coalesce(round(avg(gr.score), 1), 0) as avg_score
    from public.members m
    left join public.game_runs gr on gr.session_id = m.session_id and gr.user_id = m.user_id
    group by m.team
    order by m.team
  ) t;
  return teams;
end $$;

create or replace function public.admin_get_sessions() returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r text := private.require_teacher_or_admin();
  sess jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb) into sess from (
    select
      s.id, s.code, s.title, s.status, s.created_at, s.started_at,
      coalesce(pr.display_name, 'Мұғалім') as host_name,
      count(m.user_id) as members_count
    from public.sessions s
    left join public.profiles pr on pr.id = s.host
    left join public.members m on m.session_id = s.id
    group by s.id, pr.display_name
    order by s.created_at desc
    limit 50
  ) s;
  return sess;
end $$;

create or replace function public.admin_close_session(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  r text := private.get_user_role(u);
  s public.sessions;
begin
  select * into s from public.sessions where id=p_session_id for update;
  if s.id is null then raise exception 'Сессия табылмады'; end if;
  if r <> 'admin' and s.host <> u then raise exception 'Тек сессия авторы немесе Әкімші жаба алады'; end if;
  update public.sessions set status='closed' where id=p_session_id;

  insert into private.audit_logs (actor_id, action, target_type, target_id, details)
  values (u, 'close_session', 'session', p_session_id::text, jsonb_build_object('title', s.title));
end $$;

create or replace function public.admin_get_epochs() returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r text := private.require_teacher_or_admin();
  eps jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb) into eps from (
    select
      ep.id, ep.slug, ep.title, ep.subtitle, ep.period, ep.description, ep.published, ep.sort_order,
      count(q.id) as question_count
    from public.campaign_epochs ep
    left join public.dynamic_quizzes q on q.epoch_id = ep.id and q.active = true
    group by ep.id
    order by ep.sort_order
  ) e;
  return eps;
end $$;

create or replace function public.admin_set_epoch_published(p_epoch_id int, p_published boolean) returns void language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  r text := private.get_user_role(u);
begin
  if r <> 'admin' then raise exception 'Тек Бас Әкімші дәуірдің жариялануын өзгерте алады'; end if;
  update public.campaign_epochs set published=p_published where id=p_epoch_id;
  insert into private.audit_logs (actor_id, action, target_type, target_id, details)
  values (u, 'set_epoch_published', 'epoch', p_epoch_id::text, jsonb_build_object('published', p_published));
end $$;

create or replace function public.admin_get_quizzes(p_epoch_id int) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r text := private.require_teacher_or_admin();
  quizzes jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb) into quizzes from (
    select id, epoch_id, task_id, question_text, options, explanation, points, active, updated_at
    from public.dynamic_quizzes
    where epoch_id = p_epoch_id
    order by task_id, id
  ) q;
  return quizzes;
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

create or replace function public.admin_delete_quiz(p_id text) returns void language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  r text := private.require_teacher_or_admin();
begin
  update public.dynamic_quizzes set active=false, updated_at=clock_timestamp() where id=p_id;
  insert into private.audit_logs (actor_id, action, target_type, target_id, details)
  values (u, 'deactivate_quiz', 'quiz', p_id, null);
end $$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text) returns void language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  r text := private.get_user_role(u);
begin
  if r <> 'admin' then raise exception 'Тек Бас Әкімші рөлдерді тағайындай алады'; end if;
  if p_role not in ('player', 'teacher', 'admin') then raise exception 'Рөл дұрыс емес'; end if;
  insert into private.user_roles (user_id, role) values (p_user_id, p_role)
  on conflict (user_id) do update set role=excluded.role;

  insert into private.audit_logs (actor_id, action, target_type, target_id, details)
  values (u, 'set_user_role', 'user', p_user_id::text, jsonb_build_object('role', p_role));
end $$;

-- 6. Player API: Get active quiz for an epoch (WITHOUT accepted_answers!)
create or replace function public.v2_get_epoch_quizzes(p_epoch int) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'epoch_id', q.epoch_id,
    'task_id', q.task_id,
    'question_text', q.question_text,
    'options', q.options,
    'explanation', q.explanation,
    'points', q.points
  )), '[]'::jsonb)
  from public.dynamic_quizzes q
  where q.epoch_id = p_epoch and q.active = true;
$$;

-- 7. Player API: Authoritative submission for dynamic quiz
create or replace function public.v2_submit_epoch_answer(
  p_run_id uuid, p_quiz_id text, p_answer jsonb, p_req_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  q public.dynamic_quizzes;
  r public.game_runs;
  existing private.run_events;
  prev_attempts int := 0;
  is_correct boolean := false;
  awarded_points int := 0;
  result jsonb;
begin
  if p_req_id is null then raise exception 'Сұрау нөмірі (UUID) қажет'; end if;
  select * into existing from private.run_events where run_id=p_run_id and request_id=p_req_id;
  if existing.request_id is not null then
    return existing.response || jsonb_build_object('duplicate', true);
  end if;

  select * into r from public.game_runs where id=p_run_id for update;
  if r.id is null or r.user_id <> u then raise exception 'Ойын сессиясы табылмады немесе рұқсат жоқ'; end if;

  select * into q from public.dynamic_quizzes where id=p_quiz_id and active=true;
  if q.id is null then raise exception 'Сұрақ табылмады немесе белсенді емес'; end if;

  is_correct := private.valid_answer(p_answer, q.accepted_answers);
  prev_attempts := 1;

  if is_correct then
    awarded_points := 100;
    update public.game_runs set score = score + awarded_points where id=p_run_id;
  else
    awarded_points := 0;
  end if;

  result := jsonb_build_object(
    'correct', is_correct,
    'awarded', awarded_points,
    'attempts', prev_attempts,
    'explanation', q.explanation,
    'run_score', r.score + awarded_points
  );

  insert into private.run_events (run_id, request_id, payload, response)
  values (p_run_id, p_req_id, jsonb_build_object('quiz_id', p_quiz_id, 'answer', p_answer), result);

  return result;
end $$;

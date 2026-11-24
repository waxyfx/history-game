-- Migration 023: the game's progress follows the account (audit №14: «анонимді прогресс тек 1 браузерде»).
-- One save per player and level (the same JSON the game keeps in localStorage, validated again by the game when it is
-- restored). Private table: no direct access; only the player's own row through two RPCs. Scores never come from here —
-- official results stay in level_runs / level_results.
create table if not exists private.rpg_saves (
  user_id uuid not null references auth.users on delete cascade,
  level_id int not null check (level_id between 1 and 10),
  data jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

create or replace function public.rpg_save_put(p_level int, p_data jsonb) returns timestamptz language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user(); v_now timestamptz := clock_timestamp();
begin
  if p_level is null or p_level not between 1 and 10 then raise exception 'Деңгей табылмады'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or (p_data ->> 'v') is distinct from '3' then raise exception 'Сақтау пішімі дұрыс емес'; end if;
  if octet_length(p_data::text) > 32768 then raise exception 'Сақтау тым үлкен'; end if;
  insert into private.rpg_saves (user_id, level_id, data, saved_at) values (u, p_level, p_data, v_now)
  on conflict (user_id, level_id) do update set data = excluded.data, saved_at = excluded.saved_at;
  return v_now;
end $$;

create or replace function public.rpg_save_get(p_level int) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := private.require_user();
begin
  return (select jsonb_build_object('data', s.data, 'saved_at', s.saved_at) from private.rpg_saves s where s.user_id = u and s.level_id = p_level);
end $$;

revoke all on function public.rpg_save_put(int, jsonb), public.rpg_save_get(int) from public, anon;
grant execute on function public.rpg_save_put(int, jsonb), public.rpg_save_get(int) to authenticated;

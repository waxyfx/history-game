-- Migration 022: new trial types (audit №14: «6 тапсырма түрінің орнына тек 1 ғана тип»).
-- Besides the four-option choice the game now has an artifact picture (MAP02), a place on the map (MAP06), a word into
-- a gap (MAP07), a time order (MAP06, MAP09, MAP10) and a matching (MAP08). An order or matching answer travels as one
-- integer — the arrangement as digits (2310 = left 1 ↔ right 2, left 2 ↔ right 3, …) — so the keys may exceed 9 now.
-- All seven are secret trials (2 points); the mandatory 90 stay as they were and the level still caps at 100.
-- Answer keys match src/rpg/story02.js, story06.js … story10.js (stripped from production builds, migration 021).
alter table private.official_quiz_keys drop constraint if exists official_quiz_keys_correct_check;
alter table private.official_quiz_keys add constraint official_quiz_keys_correct_check check (correct between 0 and 99999);

insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (2, 'bronze_pot', 'secret', 0, 2),
  (6, 'horde_khans', 'secret', 1302, 2),
  (6, 'horde_map', 'secret', 0, 2),
  (7, 'kaz_gap', 'secret', 0, 2),
  (8, 'rus_match', 'secret', 2310, 2),
  (9, 'sov_order', 'secret', 2130, 2),
  (10, 'ind_order', 'secret', 13042, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

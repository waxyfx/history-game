-- Migration 016: MAP09 «Кеңестік Қазақстан / Хат» official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90; 4 secret trials add 10. Pass mark 60 (012).
-- Answer indices match src/rpg/story09.js; verdicts remain private until run completion.
insert into private.official_level_rules (level_id, max_score, pass_score, min_seconds, required_quiz)
values (9, 100, 60, 60, 'sov_memory')
on conflict (level_id) do update set max_score = 100, pass_score = 60, required_quiz = 'sov_memory';
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (9, 'sov_316', 'main', 1, 20),
  (9, 'sov_evac', 'main', 2, 20),
  (9, 'sov_zhambyl', 'main', 0, 20),
  (9, 'sov_memory', 'final', 3, 30),
  (9, 'sov_famine', 'secret', 1, 3),
  (9, 'sov_ind', 'secret', 0, 3),
  (9, 'sov_heroes', 'secret', 2, 2),
  (9, 'sov_deport', 'secret', 3, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

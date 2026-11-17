-- Migration 014: MAP07 «Қазақ хандығы / Жеті ата» official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90; 4 secret trials add 10. Pass mark 60 (012).
-- Answer indices match src/rpg/story07.js; verdicts remain private until run completion.
insert into private.official_level_rules (level_id, max_score, pass_score, min_seconds, required_quiz)
values (7, 100, 60, 60, 'kaz_bulanty')
on conflict (level_id) do update set max_score = 100, pass_score = 60, required_quiz = 'kaz_bulanty';
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (7, 'kaz_zheti', 'main', 1, 20),
  (7, 'kaz_aktaban', 'main', 0, 20),
  (7, 'kaz_jarghy', 'main', 2, 20),
  (7, 'kaz_bulanty', 'final', 3, 30),
  (7, 'kaz_turt', 'secret', 0, 3),
  (7, 'kaz_kiiz', 'secret', 1, 3),
  (7, 'kaz_zhuz', 'secret', 1, 2),
  (7, 'kaz_turkistan', 'secret', 2, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

-- Migration 015: MAP08 «Ресей империясы / Өрт» official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90; 4 secret trials add 10. Pass mark 60 (012).
-- Answer indices match src/rpg/story08.js; verdicts remain private until run completion.
insert into private.official_level_rules (level_id, max_score, pass_score, min_seconds, required_quiz)
values (8, 100, 60, 60, 'rus_sources')
on conflict (level_id) do update set max_score = 100, pass_score = 60, required_quiz = 'rus_sources';
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (8, 'rus_1822', 'main', 1, 20),
  (8, 'rus_fort', 'main', 2, 20),
  (8, 'rus_kenesary', 'main', 0, 20),
  (8, 'rus_sources', 'final', 2, 30),
  (8, 'rus_isatay', 'secret', 1, 3),
  (8, 'rus_trade', 'secret', 0, 3),
  (8, 'rus_school', 'secret', 2, 2),
  (8, 'rus_aul', 'secret', 1, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

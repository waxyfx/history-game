-- Migration 017: MAP10 «Тәуелсіз Қазақстан / Он бірінші тігіс» official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90; 4 secret trials add 10. Pass mark 60 (012).
-- Answer indices match src/rpg/story10.js; verdicts remain private until run completion.
insert into private.official_level_rules (level_id, max_score, pass_score, min_seconds, required_quiz)
values (10, 100, 60, 60, 'ind_shezhire')
on conflict (level_id) do update set max_score = 100, pass_score = 60, required_quiz = 'ind_shezhire';
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (10, 'ind_1991', 'main', 1, 20),
  (10, 'ind_symbols', 'main', 0, 20),
  (10, 'ind_semey', 'main', 2, 20),
  (10, 'ind_shezhire', 'final', 3, 30),
  (10, 'ind_zheltoqsan', 'secret', 0, 3),
  (10, 'ind_constitution', 'secret', 1, 3),
  (10, 'ind_tenge', 'secret', 2, 2),
  (10, 'ind_capital', 'secret', 0, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

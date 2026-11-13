-- Migration 009: MAP03 «Сақтар әлемі» (Saka epoch) official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90 = pass score; 4 secret trials add 10.
-- Correct option indices match src/rpg/story03.js; the client never receives them during a run.
update private.official_level_rules set max_score = 100, pass_score = 90, required_quiz = 'saka_final' where level_id = 3;
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (3, 'saka_gold', 'main', 1, 20), (3, 'saka_kurgan', 'main', 2, 20), (3, 'saka_women', 'main', 0, 20),
  (3, 'saka_final', 'final', 3, 30),
  (3, 'saka_esik', 'secret', 1, 3), (3, 'saka_berel', 'secret', 2, 3), (3, 'saka_altar', 'secret', 1, 2), (3, 'saka_hats', 'secret', 0, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

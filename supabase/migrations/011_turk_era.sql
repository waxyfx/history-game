-- Migration 011: MAP05 «Жадтың көлеңкесі» (Түркі қағанаты) official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90; 4 secret trials add 10.
-- Answer indices match src/rpg/story05.js; verdicts remain private until run completion.
update private.official_level_rules set max_score = 100, pass_score = 90, required_quiz = 'turk_final' where level_id = 5;
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (5, 'turk_runes', 'main', 1, 20), (5, 'turk_bolchu', 'main', 1, 20), (5, 'turk_balbal', 'main', 2, 20),
  (5, 'turk_final', 'final', 2, 30),
  (5, 'turk_tamga', 'secret', 0, 3), (5, 'turk_kultegin', 'secret', 1, 3), (5, 'turk_wolf', 'secret', 0, 2), (5, 'turk_talas', 'secret', 1, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

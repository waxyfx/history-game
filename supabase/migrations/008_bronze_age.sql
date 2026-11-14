-- Migration 008: MAP02 «Күлге көмілген шындық» (Bronze Age) official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90 = pass score; 3 secret trials add 10.
-- Correct option indices match src/rpg/story02.js; the client never receives them during a run.
update private.official_level_rules set max_score = 100, pass_score = 90, required_quiz = 'bronze_tablet' where level_id = 2;
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (2, 'bronze_metal', 'main', 1, 20), (2, 'bronze_economy', 'main', 2, 20), (2, 'bronze_burial', 'main', 0, 20),
  (2, 'bronze_tablet', 'final', 1, 30),
  (2, 'bronze_casting', 'secret', 2, 4), (2, 'bronze_mausoleum', 'secret', 1, 3), (2, 'bronze_tin', 'secret', 3, 3)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

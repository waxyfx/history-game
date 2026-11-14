-- Migration 010: MAP04 «Ғұндар дәуірі» official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90; 4 secret trials add 10.
-- Answer indices match src/rpg/story04.js; verdicts remain private until run completion.
update private.official_level_rules set max_score = 100, pass_score = 90, required_quiz = 'hun_final' where level_id = 4;
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (4, 'hun_script', 'main', 1, 20), (4, 'hun_decimal', 'main', 2, 20), (4, 'hun_three', 'main', 0, 20),
  (4, 'hun_final', 'final', 2, 30),
  (4, 'hun_whistle', 'secret', 3, 3), (4, 'hun_fort', 'secret', 1, 3), (4, 'hun_silk', 'secret', 0, 2), (4, 'hun_zhangqian', 'secret', 1, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

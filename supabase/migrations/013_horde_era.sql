-- Migration 013: MAP06 «Алтын Орда» official trial keys.
-- 3 mandatory trials (20 each) + final trial (30) = 90; 4 secret trials add 10. Pass mark 60 (012).
-- Answer indices match src/rpg/story06.js; verdicts remain private until run completion.
insert into private.official_level_rules (level_id, max_score, pass_score, min_seconds, required_quiz)
values (6, 100, 60, 60, 'horde_sources')
on conflict (level_id) do update set max_score = 100, pass_score = 60, required_quiz = 'horde_sources';
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (6, 'horde_ulus', 'main', 1, 20), (6, 'horde_yam', 'main', 1, 20), (6, 'horde_trade', 'main', 2, 20),
  (6, 'horde_sources', 'final', 2, 30),
  (6, 'horde_islam', 'secret', 0, 3), (6, 'horde_urus', 'secret', 1, 3), (6, 'horde_army', 'secret', 0, 2), (6, 'horde_paiza', 'secret', 1, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

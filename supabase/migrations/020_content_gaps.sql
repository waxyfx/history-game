-- Migration 020: teacher audit №14 — content gaps closed with eleven new SECRET trials.
--   MAP06 (013): IX–XII centuries — the Karakhanid state, the Karakhanid books, the Kipchaks (Desht-i Kipchak), Otrar 1218–1220.
--   MAP08 (015): the decree of 25 June 1916, Torgai and Amangeldy Imanov, the Alash autonomy (December 1917).
--   MAP09 (016): the repressions of 1937–38, ALZhIR, the Virgin Lands (1954), Baikonur (1955, 1957, 1961).
-- The mandatory trials keep their 90 points; secret trials add 2–3 points each as before. A level still scores at most
-- 100 (max_score stays 100: level_finish_run takes least(sum, max_score)), so a full score no longer needs every secret.
-- Answer indices match src/rpg/story06.js, story08.js and story09.js; verdicts remain private until run completion.
insert into private.official_quiz_keys (level_id, quiz_id, kind, correct, points) values
  (6, 'horde_karakhan', 'secret', 1, 3),
  (6, 'horde_books', 'secret', 2, 2),
  (6, 'horde_kipchak', 'secret', 3, 2),
  (6, 'horde_otrar', 'secret', 0, 3),
  (8, 'rus_1916', 'secret', 3, 3),
  (8, 'rus_torgai', 'secret', 0, 2),
  (8, 'rus_alash', 'secret', 2, 3),
  (9, 'sov_1937', 'secret', 1, 3),
  (9, 'sov_alzhir', 'secret', 0, 2),
  (9, 'sov_tyn', 'secret', 2, 2),
  (9, 'sov_baikonur', 'secret', 3, 2)
on conflict (level_id, quiz_id) do update set kind = excluded.kind, correct = excluded.correct, points = excluded.points;

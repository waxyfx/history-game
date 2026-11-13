# Серверное прохождение v2

Применить миграции 001, 002, 003 по порядку. Старые grading RPC `submit_answer`/`finish_level` закрыты; lobby RPC прежние. Текущая карта содержит одно обязательное задание. Все пороги накопительные: 30, 60, 100, 140, 190, 240, 300, 360, 430, 500. Любое число ошибок допускается в первых двух эпохах; дальше можно компенсировать снижение награды более точными ответами. Это не ограничение числа ответов: поражение проверяется только на выходе после решения обязательного задания.

RPC доступны только authenticated:

- `v2_start_run(p_session)` → snapshot; существующая активная попытка возвращается без сброса. После завершения/поражения создаётся новый UUID, 0 баллов, первая эпоха. Новая жизнь начинается с 3, боевые жизни контролируются локальным Doom.
- `v2_run_state(p_run)` → snapshot, только владелец.
- `v2_submit_answer(p_run,p_question,p_answer,p_phase,p_request)` → `{run,correct,awarded,attempts,explanation,duplicate}`. `p_phase`: `main`, `repair`, `rescue`.
- `v2_complete_branch(p_run,p_question,p_request)` → snapshot. Разрешён только из fragment; меняет стадию на repair. Вызывается после нахождения дополнительного фрагмента.
- `v2_finish_level(p_run,p_level,p_request)` → `{run,passed,requiredScore}`. Сначала проверяет правильное решение всех обязательных заданий, затем сумму баллов. Недостаток завершает попытку со статусом failed.
- `v2_room_state(p_session)` → `{session,members}`. У каждого участника берётся последняя попытка, включая активную/неудачную; состав команды остаётся зафиксированным. Имя, команда, score, level, correct, wrong, seconds, finished, status доступны членам сессии и преподавателю; email/UUID пользователей не раскрываются.

Snapshot: `{id,session_id,sequence,level,score,status,stage,started_at,ended_at,lives:3,requiredScore,answers:{questionId:{correct,attempts,awarded}},mistakes:[questionId],completed:[level]}`. status: active/failed/finished. stage: study/fragment/repair/exit. `lives:3` — начальное значение новой попытки, а не серверная телеметрия боя; при синхронизации активной попытки не сбрасывать текущие локальные жизни.

У каждого изменяющего шага UUID `p_request`; при повторе запроса после сетевой ошибки нужно посылать тот же UUID и те же параметры. Ответ события возвращается снова, но snapshot актуальный. Другие параметры с тем же UUID отвергаются. Другой UUID для уже решённого задания не даёт баллов. Попытки увеличиваются только при main/repair, при каждом новом неверном ответе нужно вновь пройти fragment. Награда: 100 / 60 / 30, только при первом правильном ответе. Rescue не меняет счёт, число оцениваемых ответов или сюжетную стадию.

История: select `game_runs` и `run_questions` ограничен RLS владельцем; direct insert/update/delete запрещён. Старые строки `attempts`/`answers` сохраняются как legacy, не участвуют в v2 рейтинге. Преподаватель не может редактировать баллы. Текущий rate limit из 001 — 60 успешных RPC/минуту на пользователя; отклонённые транзакции откатывают счётчик, поэтому для ограничения злоупотреблений ошибочными запросами требуется gateway/WAF лимит на хостинге.

Граница античита: сервер не принимает клиентский итоговый балл и защищает порядок ответов/веток/переходов. Положение игрока, бой и факт физического нахождения фрагмента исполняются в клиентском Doom. Сервер проверяет допустимость события завершения ветки, но не доказывает передвижение по карте; взломанный клиент может вызвать это событие напрямую. Локальная тренировка не является защищённым соревнованием.

## Участники и официальные результаты (006)

Миграция `006_members_results.sql` (применять после 001–005).

**Вход.** Google OAuth через Supabase Auth (PKCE, `src/api.js`). После входа триггер на `auth.users` и RPC `sync_my_profile()` создают/обновляют `public.profiles` **на сервере** из `auth.users` и `auth.identities`: `id`, `google_user_id`, `display_name` (= name), `email`, `avatar_url` (только https), `created_at`, `role`. Клиент эти поля не передаёт и не может записать (нет INSERT/UPDATE grant). Роль по умолчанию `student`; источник истины — `private.user_roles` (`student`/`teacher`/`admin`, legacy `player` = `student`), меняется только `admin_set_user_role` администратором и зеркалируется в `profiles.role`.

**Игровой save и соревновательный результат разделены.** Save — `localStorage` (`tarikh.rpg.v3`, проверяется `src/rpg/persistence.js`), влияет только на сюжет. Результат — `public.level_results`, пишется только функцией `level_finish_run`.

RPC (authenticated):
- `level_start_run(p_level, p_mode 'solo'|'team', p_session)` → `{id, level_id, mode, status, started_at, score, max_score, answers}`. Одна активная попытка на пользователя и уровень (повторный вызов возвращает её). `team` требует членства в начатой сессии.
- `level_submit_answer(p_run, p_quiz, p_choice, p_request)` → `{correct, awarded, attempts, closed, run, duplicate}`. Клиент отправляет только номер варианта; ключи в `private.official_quiz_keys`. Основные вопросы 100/60/30 за первый верный ответ, бонусные 50 только за первый ответ.
- `level_finish_run(p_run, p_request)` → строка результата. Требует решённого обязательного задания (MAP01: `stone_secret`) и не менее `min_seconds` (60 с) от серверного `started_at`. Сервер считает `score`, `max_score` (MAP01: 750), `percentage`, `duration_seconds`, `attempt_number` (под advisory lock), `passed` (MAP01: score ≥ 250).
- `level_abandon_run(p_run)`, `get_my_profile()` (профиль, лучшие результаты, число попыток, пройденные уровни, активные попытки, последние 20 попыток), `sync_my_profile()`.
- `admin_get_level_results(p_level, p_limit, p_offset)` — только teacher/admin.

Повтор с тем же `p_request` и теми же параметрами возвращает сохранённый ответ (`duplicate:true`); другие параметры отвергаются. RLS: ученик видит только свои `level_runs`/`level_results`; teacher/admin — все результаты. Прямые INSERT/UPDATE/DELETE запрещены.

Граница античита: сервер не принимает счёт от клиента и проверяет ответы, но не видит движение и бой — секреты и бой в официальный счёт не входят. Варианты ответов MAP01 присутствуют и в клиентском бандле (офлайн‑режим), поэтому знание ответов из кода не предотвращается.

## Вход в админ-панель (логин + пароль)

Кнопка «Әкімші» на главной открывает `/admin.html`, где `src/admin/gate.js` показывает форму входа.

- **С Supabase (production):** настоящий вход Supabase Auth по email и паролю; затем сервер (`get_my_role`) должен вернуть `admin` или `teacher`, иначе выход. Создать аккаунт: Supabase → Authentication → Users → Add user (email + пароль; включён провайдер Email), затем в SQL Editor:
  `insert into private.user_roles(user_id, role) select id, 'admin' from auth.users where email = 'admin@ваш-домен' on conflict (user_id) do update set role = 'admin';`
  Чтобы входить логином `Admin`, задайте `VITE_ADMIN_EMAIL=admin@ваш-домен`. Используйте длинный пароль: простой пароль легко подобрать.
- **Без Supabase, только `npm run dev`:** демо-вход из `.env.local` (`VITE_DEV_ADMIN_LOGIN`, `VITE_DEV_ADMIN_PASSWORD_SHA256` — SHA-256 пароля, не сам пароль). Этот путь вырезается из production-сборки и не даёт серверных прав: панель показывает демо-данные.
- Браузерная проверка: `ADMIN_CHECK_LOGIN=... ADMIN_CHECK_PASSWORD=... node scripts/check-admin-browser.mjs <url>`.

## Соревновательная система (007)

- У каждого уровня `max_score = 100`, `pass_score = 90` (`private.official_level_rules`, настраивается оператором). 89 — не пройдено, 90 и 100 — пройдено.
- Исторические испытания — выбор с последствиями: один ответ на испытание, во время уровня сервер **не** сообщает, верен ли выбор (`level_submit_answer` → `{recorded, closed, run}`; `run` содержит только список отвеченных испытаний, без счёта). Вердикты и объяснения возвращает только `level_finish_run` (поле `answers`), игра показывает их в «Шежіре журналы» после уровня.
- MAP01: 3 обязательных испытания по 20 + финальное 30 = 90; секретные испытания дают до 10 (Шақпақ 4, тайник Жебея 2, четыре шага скрытой комнаты по 1).
- Для завершения нужен **ответ** на финальное испытание (любой: неверный — сюжетная ветка, не softlock).
- Провал (score < pass_score): уровень завершён, `passed=false`, следующий уровень заблокирован (`level_start_run` → «Деңгей құлыптаулы»), новая попытка начинается с 0, `attempt_number + 1`, прежний результат остаётся в статистике. Успех: `next_level_unlocked=true`.
- Время только серверное: `duration_seconds` = finished_at − started_at попытки; `competition_seconds` — от первого официального старта (`public.competitions`), повторные попытки его не сбрасывают. `level_start_run` возвращает `server_now`, `started_at`, `competition_started_at` — фронтенд лишь рисует живой таймер.
- `get_my_profile` дополнительно возвращает `unlocked_levels` и `competitions`.

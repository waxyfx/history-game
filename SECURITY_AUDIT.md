# Security & QA audit — 13 ноября 2026

Область: локальный код Tarikh Joly, обе игровые оболочки, SQL001–007, сборка и demo admin. Только синтетические данные и локальная среда; внешняя БД не изменялась. Исходная ветка feature/motion-comic-intro.

## Исправлено

| Severity | Находка | Исправление / проверка |
|---|---|---|
| HIGH | Динамический квиз повторно выдавал100 с новым UUID запроса | 005: lock строки run и таблица попыток, выдача один раз; security.test |
| HIGH | Replay читался до проверки владельца; закрытые/чужие эпохи могли выдавать баллы | Owner-first, active run/session, published/current epoch; security.test |
| HIGH | Понижение роли не отзывает legacy teacher | Синхронизация RBAC с private.teachers; security.test |
| HIGH | Размер сохранения не проверялся до записи в WASM, metadata могла частично восстановиться | Ограничение buffer, проверка integer/metadata/rewards до native load; rpg-persistence.test |
| HIGH (потенциальная утечка) | Публичный ZIP включал произвольные локальные config/credentials | Allowlist и защита от ссылок за корень; build.test с синтетическими секретами |
| HIGH (dependency) | Известные уязвимости dev server Vite6.4.1 | Exact6.4.6, npm audit сообщает0 известных уязвимостей |
| HIGH (gameplay) | Динамические бонусы могли блокировать legacy прохождение при cap1000 | Сумма ограничена1000 без SQL constraint failure; regression990→1000→следующий уровень |
| MEDIUM | HTML и JS injection через формы demo admin | Экранирование text/attributes, quiz ID передаётся data-атрибутом; browser payload regression |
| MEDIUM | Неограниченные/null quiz fields, pagination; неверный RLS helper; PUBLIC RPC grants | 005: validation, безопасный wrapper, явные EXECUTE grants |
| MEDIUM | Сбой localStorage прерывал RPG loop; roadmap не ставил паузу; autosave во время transition терялся | Обработка storage ошибок, pause, отложенное сохранение; browser regression |
| MEDIUM | .gitignore не охватывал production env/private configs | Расширены исключения, .env.example сохранён |

SQL выполняет параметризованные запросы в тестах; SECURITY DEFINER использует пустой search_path и квалифицированные имена. Ответы хранятся в private/защищённых таблицах; player не получает accepted_answers. Это локальная проверка конкретных политик, а не сертификация всего окружения.

## Проверки

- npm test с настроенным Python3:50/50 PASS,0 skipped.
- npm run build: PASS (Vite6.4.6, архив исходников).
- npm audit после обновления:0 известных уязвимостей на момент проверки.
- check-engine: WASM загружен, движение на10 legacy картах PASS.
- check-admin-browser: PASS, навигация и формы demo, HTML/attribute/ID injection остаются инертными. Переключение ролей UI не является проверкой серверной авторизации.
- SQL suite: RLS, чужие run, direct writes, идемпотентность, неверные/null/длинные ответы, закрытые сессии и revoked roles PASS. Promise.all на одном PGlite connection не доказывает межсоединительную конкурентность.
- Сканирование распространённых шаблонов секретов в рабочем дереве: совпадений реальных секретов не найдено; история Git не проверена.

## Готовность

Подходит для ограниченного технического тестирования с указанными ограничениями. **Не готово к публичному сетевому тестированию:** клиентский кооператив не имеет доверенного серверного контроля membership/событий; production интеграция не проверена. Финал MAP01 теперь реализован и проходит автоматизированный сценарий. Полную безопасность и полную проходимость не утверждаем. Все оставшиеся риски и необходимые действия перечислены в KNOWN_ISSUES.md; план ручной проверки — QA_CHECKLIST.md.

После каждой реализации: добавить воспроизводящий regression при возможности, выполнить релевантный suite и обновить этот отчёт. Не скрывать непроверенные области зелёной сборкой.

## Повторная проверка 13 ноября

Во время паузы появились коммиты7503ebe–0c5e134 с MAP01, членством и результатами; старые выводы о незавершённом финале обновлены. Новые несвязанные изменения MAP02 в рабочем дереве не входят в этот audit commit.

- Актуальный npm test:50/50 PASS,0 skipped; build PASS.
- check-rpg-browser PASS: сюжетный маршрут, финал, save/reload, локальные3 вкладки, отказ4-й, replication, revive и disconnect. Используются QA teleport/step и пропуск кат-сцен; это не доказательство обычной проходимости и защиты от злонамеренного клиента.
- check-admin-browser PASS на временном локальном dev-login: формы, навигация, инертные XSS payloads. Реальный Supabase login не проверен.
- HIGH открыт: src/rpg/net.js выбирает host и лимит3 по клиентским presence/времени; sender и игровые сообщения не подтверждаются доверенным сервером. Не выдавать локальный PASS за защищённый интернет-кооператив.
- QA handle window.__tj ограничен import.meta.env.DEV; production не экспортирует его. Это удаление тестового интерфейса, не античит.

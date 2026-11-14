# Запуск и тестирование

Node.js 22+; команды из корня проекта:

    npm ci
    npm test
    npm run build
    npm run dev -- --port 5176

Открыть http://127.0.0.1:5176/ (Beta), /rpg.html (новая RPG), /admin.html (демо). В отдельных терминалах с работающим сервером:

    node scripts/check-engine.mjs
    node scripts/check-rpg-browser.mjs http://127.0.0.1:5176
    node scripts/check-admin-browser.mjs http://127.0.0.1:5176
    node scripts/check-devices.mjs http://127.0.0.1:5176
    node scripts/check-classroom.mjs http://127.0.0.1:5176

Браузерные scripts используют локальные Chrome/Edge по Windows-путям; требуется установленный браузер. Скриншоты в test-results/ не коммитятся. PGlite проверяет SQL локально, без production-данных. Один PGlite connection не моделирует блокировки независимых PostgreSQL connections.

Для онлайна создать отдельный тестовый Supabase, применить все SQL из supabase/migrations по номерам; настроить Google OAuth и .env.local по .env.example. Не помещать service-role в VITE_*. Проверить минимум две отдельные тестовые учётные записи и анонимный браузер. Не использовать реальные данные учеников.

Результаты этой проверки: SECURITY_AUDIT.md. Перед передачей пройти QA_CHECKLIST.md; баги оформлять по BUG_REPORT_TEMPLATE.md. Полное прохождение, production HTTP/CSP и реальный сетевой coop не заменяются unit-тестами.

Для сборки архива и его regression-теста нужен Python 3. Если python не в PATH, задайте PYTHON полным путём к python.exe (PowerShell: $env:PYTHON = "C:\path\python.exe"). В sandbox браузер может зависнуть на Runtime.enable: запускать локальный QA с разрешением на браузер; timeout не считать PASS.

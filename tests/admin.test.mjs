import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL: Admin Panel RBAC, CRUD, Dynamic Quizzes, and Audit Logging', async t => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
  `);

  for (const f of ['001_schema.sql', '002_content.sql', '003_progression.sql', '004_admin_campaign_v2.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + f, import.meta.url), 'utf8'));
  }

  const adminUser = randomUUID();
  const teacherUser = randomUUID();
  const playerUser = randomUUID();

  for (const u of [adminUser, teacherUser, playerUser]) {
    await db.query('insert into auth.users values($1)', [u]);
  }

  // Set roles
  await db.query('insert into private.user_roles values($1, $2)', [adminUser, 'admin']);
  await db.query('insert into private.user_roles values($1, $2)', [teacherUser, 'teacher']);
  await db.query('insert into private.user_roles values($1, $2)', [playerUser, 'player']);

  async function as(u, role = 'authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [u || '']);
    await db.exec('set role ' + role);
  }

  async function rpc(name, args = []) {
    return (await db.query(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args)).rows[0].result;
  }

  await t.test('Role resolution: player, teacher, admin', async () => {
    await as(playerUser);
    assert.equal(await rpc('get_my_role'), 'player');
    await as(teacherUser);
    assert.equal(await rpc('get_my_role'), 'teacher');
    await as(adminUser);
    assert.equal(await rpc('get_my_role'), 'admin');
  });

  await t.test('RBAC: Player is rejected from administrative endpoints', async () => {
    await as(playerUser);
    await assert.rejects(rpc('admin_get_dashboard'), /Мұғалім немесе Әкімші/);
    await assert.rejects(rpc('admin_get_players', [null, 10, 0]), /Мұғалім немесе Әкімші/);
    await assert.rejects(rpc('admin_get_sessions'), /Мұғалім немесе Әкімші/);
    await assert.rejects(rpc('admin_upsert_quiz', ['test_q', 1, 'main', 'Сұрақ?', JSON.stringify(['A', 'B']), JSON.stringify(['A']), 'Түсіндірме', true]), /Мұғалім немесе Әкімші/);
  });

  await t.test('Teacher access: Dashboard, Session list, Epochs, and Teams', async () => {
    await as(teacherUser);
    const dash = await rpc('admin_get_dashboard');
    assert.equal(typeof dash.total_players, 'number');
    assert.equal(typeof dash.total_sessions, 'number');
    assert.equal(dash.total_teams, 2);

    const epochs = await rpc('admin_get_epochs');
    assert.equal(epochs.length, 8);
    assert.equal(epochs[0].slug, 'stone');
    assert.equal(epochs[7].slug, 'independent');

    const teams = await rpc('admin_get_teams');
    assert.ok(Array.isArray(teams));
  });

  await t.test('Teacher CRUD: Create, Edit and Deactivate Quizzes without WASM rebuild', async () => {
    await as(teacherUser);
    // Create new question
    const qId = 'custom_bronze_pot';
    await rpc('admin_upsert_quiz', [
      qId, 2, 'pottery',
      'Андронов мәдениетінің қыш ыдыстарына қандай өрнектер тән?',
      JSON.stringify(['Геометриялық өрнектер', 'Өсімдік өрнектері', 'Жазулар', 'Абстракция']),
      JSON.stringify(['Геометриялық өрнектер', 'Геометриялық']),
      'Андронов мәдениетіне сынық сызықты және үшбұрышты геометриялық өрнектер тән.',
      true
    ]);

    // Verify it appears in teacher quizzes
    const quizzes = await rpc('admin_get_quizzes', [2]);
    const found = quizzes.find(q => q.id === qId);
    assert.ok(found);
    assert.equal(found.task_id, 'pottery');

    // Verify player API returns it WITHOUT accepted_answers!
    await as(playerUser);
    const playerQuizzes = await rpc('v2_get_epoch_quizzes', [2]);
    const playerFound = playerQuizzes.find(q => q.id === qId);
    assert.ok(playerFound);
    assert.equal(playerFound.accepted_answers, undefined, 'Accepted answers must never be revealed to player');
    assert.equal(playerFound.options.length, 4);

    // Teacher deactivates question
    await as(teacherUser);
    await rpc('admin_delete_quiz', [qId]);
    await as(playerUser);
    const afterDelete = await rpc('v2_get_epoch_quizzes', [2]);
    assert.ok(!afterDelete.find(q => q.id === qId), 'Deactivated question must not be returned to player');
  });

  await t.test('Admin-only privileges: publish epoch, role changes, and audit log', async () => {
    await as(teacherUser);
    await assert.rejects(rpc('admin_set_epoch_published', [2, false]), /Тек Бас Әкімші/);
    await assert.rejects(rpc('admin_set_user_role', [playerUser, 'teacher']), /Тек Бас Әкімші/);

    await as(adminUser);
    await rpc('admin_set_epoch_published', [2, false]);
    await rpc('admin_set_user_role', [playerUser, 'teacher']);

    await as(playerUser);
    assert.equal(await rpc('get_my_role'), 'teacher');

    // Audit logs are populated
    await db.exec('reset role');
    const logs = (await db.query('select * from private.audit_logs order by id desc limit 5')).rows;
    assert.ok(logs.length >= 2);
    assert.ok(logs.some(l => l.action === 'set_user_role'));
    assert.ok(logs.some(l => l.action === 'set_epoch_published'));
  });
});


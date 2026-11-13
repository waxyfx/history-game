import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const candidates = process.env.BROWSER_EXE ? [process.env.BROWSER_EXE] : [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
];
let exe;
for (const candidate of candidates) {
  try { await access(candidate); exe = candidate; break; } catch {}
}
assert(exe, 'Set BROWSER_EXE to an installed Chromium browser');

const profile = await mkdtemp(join(tmpdir(), 'tarikh-admin-'));
const child = spawn(exe, [
  '--headless=new', '--remote-debugging-port=0',
  '--user-data-dir=' + profile, '--no-first-run',
  '--disable-background-networking', 'about:blank'
], { stdio: 'ignore', windowsHide: true });

let ws;
try {
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    try {
      port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
    } catch {
      await delay(100);
    }
  }
  assert(port, 'Browser launch failed');

  const target = (await (await fetch('http://localhost:' + port + '/json/list')).json()).find(t => t.type === 'page');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(JSON.stringify(msg.params.args));
    if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };

  async function call(method, params = {}) {
    const n = ++id; let timer;
    const response = new Promise((resolve, reject) => {
      pending.set(n, resolve);
      timer = setTimeout(() => { pending.delete(n); reject(new Error('CDP timeout: ' + method)); }, 15000);
    });
    ws.send(JSON.stringify({ id: n, method, params }));
    try {
      const msg = await response;
      if (msg.error) throw Error(msg.error.message);
      return msg.result;
    } finally {
      clearTimeout(timer);
    }
  }

  async function js(expression) {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
    return r.result.value;
  }

  async function wait(expression) {
    for (let i = 0; i < 150; i++) {
      if (await js(expression)) return;
      await delay(100);
    }
    throw Error('Timed out: ' + expression);
  }

  await call('Runtime.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: base + '/admin.html' });
  // admin.html is behind a sign-in gate (src/admin/gate.js). Credentials come from the environment,
  // e.g. ADMIN_CHECK_LOGIN=Admin ADMIN_CHECK_PASSWORD=... with the local demo login from .env.local.
  await wait('document.querySelector("#gate-form") !== null || document.querySelector("aside.admin-sidebar") !== null');
  if (await js('document.querySelector("#gate-form") !== null')) {
    assert(process.env.ADMIN_CHECK_LOGIN && process.env.ADMIN_CHECK_PASSWORD, 'Set ADMIN_CHECK_LOGIN and ADMIN_CHECK_PASSWORD for the admin sign-in gate');
    await js(`document.getElementById('gate-login').value=${JSON.stringify(process.env.ADMIN_CHECK_LOGIN)};document.getElementById('gate-pass').value=${JSON.stringify(process.env.ADMIN_CHECK_PASSWORD)};document.getElementById('gate-form').requestSubmit()`);
  }

  await wait('document.querySelector("aside.admin-sidebar") !== null');
  assert.equal(await js('document.querySelector("header.admin-topbar h1").textContent'), 'Басқару тақтасы (Dashboard)');

  // 1. Check KPI cards on Dashboard
  assert(await js('document.querySelectorAll(".kpi-card").length >= 4'));

  // 2. Navigate to Players
  await js('document.querySelector("button[data-tab=\'players\']").click()');
  await wait('document.querySelector("#player-search") !== null');
  assert.equal(await js('document.querySelector("header.admin-topbar h1").textContent'), 'Ойыншылар мен оқушылар');
  assert(await js('document.querySelectorAll("table.admin-table tbody tr").length >= 5'));

  // 3. Navigate to Quizzes
  await js('document.querySelector("button[data-tab=\'quizzes\']").click()');
  await wait('document.querySelector("#add-quiz-btn") !== null');
  assert.equal(await js('document.querySelector("header.admin-topbar h1").textContent'), 'Квиздер мен сұрақтарды басқару (CRUD)');
  assert(await js('document.querySelectorAll("table.admin-table tbody tr").length >= 5'));

  // 4. Navigate to Epochs
  await js('document.querySelector("button[data-tab=\'epochs\']").click()');
  await wait('document.querySelectorAll(".epoch-admin-card").length === 8');

  // 5. Check Role Switching & Permission restriction
  await js('document.querySelector("#role-select").value = "player"');
  await js('document.querySelector("#role-select").dispatchEvent(new Event("change"))');
  await wait('document.querySelector(".admin-section").textContent.includes("Құқық шектелген")');

  assert.deepEqual(errors, [], 'No browser console or runtime errors in Admin Panel');
  console.log('PASS: Admin Panel dashboard, navigation, players, quizzes, 8 epochs, and RBAC restrictions verified.');
} finally {
  ws?.close();
  child.kill();
}


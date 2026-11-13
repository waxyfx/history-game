// End-to-end browser check for MAP01 (headless Chrome/Edge over CDP, no extra dependencies).
// Usage: npm run dev, then: node scripts/check-rpg-browser.mjs http://127.0.0.1:5173
// Walks the whole story (cutscenes skipped), combat, quizzes, secrets, save/load and a 3-player
// co-op party over BroadcastChannel (+ a refused 4th player). Screenshots go to test-results/.
import {spawn} from 'node:child_process';
import {access, mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const candidates = process.env.BROWSER_EXE ? [process.env.BROWSER_EXE] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
let exe; for (const c of candidates) { try { await access(c); exe = c; break; } catch {} }
assert(exe, 'Set BROWSER_EXE to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(), 'tarikh-rpg-'));
const child = spawn(exe, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore', windowsHide: true});
await mkdir('test-results', {recursive: true});
const sockets = [];
let port;
async function page(url, {w = 1600, h = 900} = {}) {
  const target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, {method: 'PUT'})).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl); sockets.push(ws);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args.map(a => a.value ?? a.description)));
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const call = (method, params = {}) => new Promise((res, rej) => { const n = ++id; const tm = setTimeout(() => rej(new Error('CDP timeout ' + method)), 30000); pending.set(n, m => { clearTimeout(tm); m.error ? rej(new Error(m.error.message)) : res(m.result); }); ws.send(JSON.stringify({id: n, method, params})); });
  const js = async expr => { const r = await call('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(expr)) return; await delay(80); } throw new Error('Timed out: ' + expr); };
  const key = async (code, k, type) => call('Input.dispatchKeyEvent', {type, code, key: k, windowsVirtualKeyCode: {KeyE: 69, KeyD: 68, Space: 32, Escape: 27, KeyI: 73}[code] || 0});
  const press = async (code, k) => { await key(code, k, 'keyDown'); await delay(40); await key(code, k, 'keyUp'); };
  const shot = async name => { const r = await call('Page.captureScreenshot', {format: 'png'}); await writeFile('test-results/' + name + '.png', Buffer.from(r.data, 'base64')); };
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: false});
  await call('Page.navigate', {url});
  await wait('window.__tj && __tj.E');
  return {call, js, wait, press, key, shot, errors};
}
// Drives dialogs/panels until the UI is idle. Quizzes are answered by trying options in order.
const settle = async (p, {maxMs = 30000} = {}) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await p.js(`({c: __tj.cine, d: __tj.dialog, p: __tj.panelOpen,
      opt: !!document.querySelector('#panel-card [data-opt]:not(:disabled)'), next: !!document.querySelector('#bq-next:not([hidden])'),
      close: !!document.querySelector('#panel-card [data-close]:not([hidden])')})`);
    if (s.c) await p.js('__tj.skipCutscene()');
    if (s.d) { await p.js('__tj.advanceDialog()'); await delay(30); continue; }
    if (s.p) {
      if (s.next) await p.js(`document.querySelector('#bq-next').click()`);
      else if (s.opt) await p.js(`(() => { const o = document.querySelector('#panel-card [data-trial]'); const k = ${JSON.stringify(KEY)}[o?.dataset.trial] ?? 0; o.querySelector('[data-opt="' + k + '"]').click(); })()`);
      else if (s.close) await p.js(`document.querySelector('#panel-card [data-close]:not([hidden])').click()`);
      await delay(60); continue;
    }
    if (!s.c && !s.d && !s.p) { await delay(250); const again = await p.js('!!(__tj.cine || __tj.dialog || __tj.panelOpen)'); if (!again) return; }
    await delay(60);
  }
  throw new Error('UI did not settle');
};
const T = 16;
// QA answer key (matches supabase/migrations/006/007 keys).
const KEY = {stone_main: 1, stone_workshop: 1, stone_hunting: 2, stone_cave: 1, stone_secret: 0, stone_bonus_1: 0, stone_bonus_2: 0, stone_bonus_3: 1, stone_bonus_4: 0, stone_bonus_5: 0};
try {
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  assert(port, 'Browser launch failed');
  const a = await page(base + '/rpg.html?new=1');
  const ia = name => `__tj.G.flags`; void ia;
  // 1. Arrival cutscene + first quiz (wrong, then right => 60 points).
  await a.wait('__tj.cine === "intro"');
  await delay(1200); await a.shot('map01-01-arrival');
  await a.js('__tj.skipCutscene()');
  // Observe first: the trial opens with Aibar's reasoning, then the choice panel.
  for (let i = 0; i < 200 && !(await a.js('__tj.panelOpen && !!document.querySelector("#panel-card [data-opt]")')); i++) { await a.js('__tj.advanceDialog()'); await delay(60); }
  await a.shot('map01-02-quiz');
  assert(!(await a.js('document.querySelector("#qfb")')), 'no right/wrong verdict element during a trial');
  await a.js(`document.querySelector('#panel-card [data-opt="1"]').click()`);
  await a.wait('!__tj.panelOpen');
  assert.equal(await a.js('document.querySelectorAll("#panel-card .right, #panel-card .wrong").length'), 0);
  assert.equal(await a.js('__tj.G.flags.quiz.stone_main.ok'), true);
  await settle(a);
  assert.match(await a.js('document.querySelector("#s-score").textContent'), /⏱ \d+:\d\d/, 'live timer, no live score');
  assert.equal(await a.js('__tj.E.tj_item_count(8)'), 1, 'page fragment 1/3');
  // 2. Real keyboard movement and collision with the map border.
  const p0 = await a.js('__tj.E.tj_state(0)');
  await a.key('KeyD', 'd', 'keyDown'); await delay(700); await a.key('KeyD', 'd', 'keyUp');
  assert(await a.js('__tj.E.tj_state(0)') > p0 + 20000, 'D moves east');
  await a.js('__tj.E.tj_teleport(40, 860); __tj.step(120); __tj.E.tj_input(4); __tj.step(200); __tj.E.tj_input(0)');
  assert(await a.js('__tj.E.tj_state(0) > 16000'), 'border cliffs block');
  await a.js('__tj.E.tj_teleport(220, 860); __tj.step(2)');
  await a.shot('map01-03-hud');
  // 3. Settlement: cutscene, villagers (bow, spear, herbs), elder task.
  await a.js(`__tj.E.tj_teleport(${24 * T}, ${42 * T}); __tj.step(3)`);
  await a.wait('__tj.cine === "meet"'); await delay(1500); await a.shot('map01-04-village');
  await settle(a);
  for (const v of ['crafter', 'cook', 'scraper']) { a.js(`__tj.quest.talk('${v}')`); await delay(200); await settle(a); }
  assert.equal(await a.js('__tj.G.flags.talked.length'), 3);
  assert.equal(await a.js('__tj.E.tj_item_count(3)'), 1, 'bow from Shaqpaq');
  assert.equal(await a.js('__tj.E.tj_item_count(2)'), 1, 'spear from Qamys');
  a.js(`__tj.quest.talk('elder')`); await a.wait('__tj.cine === "elderTask"'); await settle(a);
  assert(await a.js('__tj.G.flags.b.elderTask'));
  // NPC routines move people around the settlement.
  const npc0 = await a.js('[__tj.E.tj_npc(4,0), __tj.E.tj_npc(4,1)]'); await a.js('__tj.step(400)');
  assert.notDeepEqual(await a.js('[__tj.E.tj_npc(4,0), __tj.E.tj_npc(4,1)]'), npc0, 'child walks a route');
  // 4. Tracks + quiver quiz (via E key interactions).
  for (const [i, x, y] of [[1, 61.5, 48.3], [2, 72, 45.2], [3, 80.5, 41.5], [4, 85, 36.5]]) {
    await a.js(`__tj.E.tj_teleport(${x * T}, ${y * T + 12}); __tj.E.tj_face(0); __tj.step(4)`);
    await a.press('KeyE', 'e'); await delay(150); await settle(a);
  }
  assert.equal(await a.js('__tj.G.flags.tracks.length'), 4); assert(await a.js('!!__tj.G.flags.quiz.stone_hunting'));
  // 5. Combat: wolves in the hunting grounds take damage from the sword and die.
  await a.js(`__tj.E.tj_teleport(${75 * T - 20}, ${49 * T}); __tj.E.tj_face(2); __tj.step(2)`);
  let wolfHp = await a.js('__tj.E.tj_enemy(0,0)');
  for (let i = 0; i < 40 && wolfHp > 0; i++) {
    await a.js(`(() => { const E = __tj.E, ex = E.tj_enemy(0,2)/1000, ey = E.tj_enemy(0,3)/1000; E.tj_teleport(Math.round(ex - 14), Math.round(ey)); E.tj_face(2); E.tj_heal(100); E.tj_input(32); __tj.step(3); E.tj_input(0); __tj.step(26); })()`);
    wolfHp = await a.js('__tj.E.tj_enemy(0,0)');
    if (i === 0) await a.shot('map01-05-combat');
  }
  assert.equal(wolfHp, 0, 'wolf defeated');
  await settle(a);
  // 6. Rescue: hold E on the rope -> hunter scene -> Zulmat's shadow (cutscene).
  await a.js(`__tj.E.tj_groups(0); __tj.E.tj_teleport(${89 * T}, ${21 * T + 14}); __tj.E.tj_face(0); __tj.step(3)`);
  await a.key('KeyE', 'e', 'keyDown'); await a.js('__tj.step(230)'); await a.key('KeyE', 'e', 'keyUp');
  await a.wait('__tj.cine === "freed"'); await delay(2500); await a.js('__tj.step(1)');
  await settle(a);
  assert(await a.js('__tj.G.flags.b.freed && __tj.G.flags.b.shadow'));
  // 7. Return: cutscene, dusk light, torch.
  await a.js(`__tj.E.tj_teleport(${24 * T}, ${42 * T}); __tj.step(3)`);
  await a.wait('__tj.cine === "return"'); await delay(1500); await a.shot('map01-06-return');
  await settle(a);
  assert(await a.js('__tj.G.flags.b.returned && __tj.E.tj_item_count(7) === 1'), 'torch received');
  // 8. Solo mechanism: hold the lever, the boulder rolls away.
  await a.js(`__tj.E.tj_teleport(${94.5 * T + 12}, ${9.5 * T + 4}); __tj.E.tj_face(6); __tj.step(3)`);
  await delay(150); await settle(a); await a.js('__tj.E.tj_face(6); __tj.step(2)');
  await a.key('KeyE', 'e', 'keyDown'); await a.js('__tj.step(170)'); await a.key('KeyE', 'e', 'keyUp');
  await a.wait('__tj.cine === "opened"'); await settle(a);
  assert(await a.js('__tj.G.flags.b.caveOpen'));
  // 9. Enter the cave (fade + teleport), bear encounter.
  await a.js(`__tj.E.tj_teleport(${102 * T}, ${6.6 * T + 14}); __tj.E.tj_face(0); __tj.step(3)`);
  await a.press('KeyE', 'e'); await a.wait('__tj.E.tj_state(2) === 5', 5000); await settle(a);
  await a.js(`__tj.E.tj_teleport(${25 * T}, ${101 * T}); __tj.step(3)`);
  await a.wait('__tj.cine === "bear"'); await settle(a);
  await a.js('__tj.step(90)'); await a.shot('map01-07-cave-bear');
  await a.js(`(() => { for (let i = 0; i < 60 && __tj.E.tj_enemy(7,0) > 0; i++) { __tj.E.tj_enemy_damage(7, 30, 0); __tj.step(16); } })()`);
  assert.equal(await a.js('__tj.E.tj_enemy(7,0)'), 0, 'bear defeated');
  await settle(a);
  // 10. Petroglyphs (+quiz), hidden chamber (hold), bonus quiz, flute.
  for (const [n, x] of [[1, 15.5], [2, 21], [3, 29], [4, 34.5]]) {
    await a.js(`__tj.E.tj_teleport(${x * T}, ${80.2 * T + 18}); __tj.E.tj_face(0); __tj.step(3)`);
    await delay(120); await settle(a); await a.js('__tj.step(2)');
    await a.press('KeyE', 'e'); await delay(150); await settle(a);
  }
  assert.equal(await a.js('__tj.G.flags.petro.length'), 4); assert(await a.js('!!__tj.G.flags.quiz.stone_cave && __tj.E.tj_item_count(11) === 1'));
  await a.js(`__tj.E.tj_teleport(${13.5 * T + 16}, ${85.2 * T}); __tj.E.tj_face(6); __tj.step(3)`);
  await a.key('KeyE', 'e', 'keyDown'); await a.js('__tj.step(130)'); await a.key('KeyE', 'e', 'keyUp'); await delay(200); await settle(a);
  assert(await a.js('__tj.G.flags.b.chamber'));
  await a.js(`__tj.E.tj_teleport(${7 * T}, ${81.2 * T + 14}); __tj.E.tj_face(0); __tj.step(3)`);
  await a.press('KeyE', 'e');
  for (let i = 0; i < 200 && !(await a.js('__tj.panelOpen')); i++) { await a.js('__tj.advanceDialog()'); await delay(60); }
  await a.shot('map01-08-bonus-quiz'); await settle(a);
  assert.equal(await a.js('[1,2,3,5].filter(n => __tj.G.flags.quiz["stone_bonus_" + n]).length'), 4, 'chamber investigation answered');
  await a.js(`__tj.E.tj_teleport(${9 * T}, ${86.6 * T + 14}); __tj.E.tj_face(0); __tj.step(3)`); await a.press('KeyE', 'e'); await delay(150); await settle(a);
  assert(await a.js('__tj.G.flags.b.flute'));
  // 11. Zulmat's mark (quiz 5), the page, completion screen, portal to the camp.
  await a.js(`__tj.E.tj_teleport(${25 * T}, ${77.6 * T + 16}); __tj.E.tj_face(0); __tj.step(3)`); await a.press('KeyE', 'e'); await delay(150); await settle(a);
  assert(await a.js('!!__tj.G.flags.quiz.stone_secret'));
  await a.js(`__tj.E.tj_teleport(${25 * T}, ${79.2 * T + 12}); __tj.E.tj_face(0); __tj.step(3)`); await a.press('KeyE', 'e');
  await a.wait('__tj.cine === "page"'); await delay(2500); await a.shot('map01-09-page');
  await a.js('__tj.skipCutscene()'); await a.wait('__tj.panelOpen && !!document.querySelector("#go-camp")', 10000);
  assert.match(await a.js('document.querySelector(".verdict").textContent'), /94 \/ 100/);
  await a.js(`document.querySelector('#open-journal').click()`); await a.wait('!!document.querySelector(".journal-list")');
  await a.shot('map01-10b-journal');
  await a.js(`document.querySelector('#journal-back').click()`); await a.wait('!!document.querySelector("#go-camp")');
  await a.shot('map01-10-complete');
  assert(await a.js('__tj.G.flags.b.finished && __tj.E.tj_item_count(8) === 3'));
  await a.js(`document.querySelector('#go-camp').click()`); await a.wait('__tj.E.tj_state(2) === 6', 8000); await settle(a);
  await a.js('__tj.step(30)'); await a.shot('map01-11-camp');
  const score = await a.js('Object.values(__tj.G.flags.quiz).filter(r => r.ok).length');
  // 12. Save, reload, verify.
  await a.js('__tj.save()');
  await a.call('Page.reload'); await delay(1500); await a.wait('window.__tj && __tj.E && __tj.G.flags.b.finished');
  assert.equal(await a.js('__tj.E.tj_state(2)'), 6, 'position restored');
  assert.equal(await a.js('Object.values(__tj.G.flags.quiz).filter(r => r.ok).length'), score, 'trial choices restored');
  // Failing branch: a wrong final choice keeps the game going, then the level ends below 90 with a retry.
  await a.js(`__tj.G.flags.quiz.stone_secret.ok = false; __tj.G.changed(); __tj.results(); 1`);
  await a.wait('!!document.querySelector("#retry-epoch")');
  assert.match(await a.js('document.querySelector(".verdict").textContent'), /64 \/ 100/);
  await a.shot('map01-13-fail');
  await a.js(`document.querySelector('#retry-epoch').click()`); await a.wait('__tj.cine === "intro"', 8000);
  assert.equal(await a.js('Object.keys(__tj.G.flags.quiz).length'), 0, 'retry starts the epoch from zero');
  await settle(a);
  assert.deepEqual(a.errors, [], 'no runtime errors (solo)');
  // 13. Co-op: three tabs in one party, a fourth is refused.
  const code = 'QATEST';
  const host = await page(base + '/rpg.html?new=1&party=' + code);
  await settle(host);
  const p2 = await page(base + '/rpg.html?new=1&party=' + code); await settle(p2);
  const p3 = await page(base + '/rpg.html?new=1&party=' + code); await settle(p3);
  await host.wait('__tj.party.size === 3', 10000); await p3.wait('__tj.party.size === 3', 10000);
  assert.deepEqual([await host.js('__tj.party.slot'), await p2.js('__tj.party.slot'), await p3.js('__tj.party.slot')], [0, 1, 2]);
  const p4 = await page(base + '/rpg.html?new=1&party=' + code); await delay(2500);
  assert.equal(await p4.js('__tj.party.net'), null, '4th player refused'); assert.equal(await host.js('__tj.party.size'), 3);
  // Positions replicate: move player 2, host sees it.
  await p2.js(`__tj.E.tj_teleport(${12 * T + 30}, ${53.5 * T})`);
  await host.js(`__tj.E.tj_teleport(${12 * T}, ${53.5 * T})`);
  await delay(3000); await host.js('__tj.step(2)');
  await host.shot('map01-12-coop');
  const seen = await host.js('[...__tj.party.peers.values()].map(p => p.x)');
  assert(seen.includes(12 * T + 30), 'host sees player 2 position');
  // Team progress: a flag set by player 3 reaches the host; revive works across tabs.
  await p3.js(`__tj.G.flags.b.cache = true; __tj.G.changed()`); await host.wait('__tj.G.flags.b.cache === true', 5000);
  await host.js('__tj.E.tj_damage(500)'); await delay(300);
  assert(await host.js('__tj.E.tj_state(24) > 0'), 'host downed in co-op');
  await p2.js(`__tj.E.tj_teleport(${12 * T + 10}, ${53.5 * T}); __tj.E.tj_face(6)`); await delay(300);
  await p2.key('KeyE', 'e', 'keyDown'); await p2.js('__tj.step(170)'); await p2.key('KeyE', 'e', 'keyUp');
  await host.wait('__tj.E.tj_state(24) === 0 && __tj.E.tj_state(8) === 40', 5000);
  // Disconnect: player 3 leaves, others drop to 2.
  await p3.js('__tj.leaveParty()'); await host.wait('__tj.party.size === 2', 8000);
  for (const pg of [host, p2]) assert.deepEqual(pg.errors, [], 'no runtime errors (co-op)');
  console.log('PASS: MAP01 story end-to-end (arrival, settlement, villagers, elder task, tracks, combat, rescue, shadow, return, lever, cave, bear, petroglyphs, hidden chamber, bonus quiz, Zulmat mark, page, completion, camp), save/reload, co-op 3 players + refused 4th, replication, shared flags, revive, disconnect.');
} finally { for (const ws of sockets) ws.close(); child.kill(); }

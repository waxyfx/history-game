// MAP06 integration: real DOM dialogue/quiz/choice and proximity input; dev hooks accelerate travel/combat.
// Checks the evidence chain, the new weapons with real input (a running lance charge on the yam field, the
// composite bow at long range), the time anomalies, the false clue, the herald boss phase by phase (only a lance
// charge breaks his seals), the original scroll, the book comic, the five-marks easter egg and save/reload.
import {spawn} from 'node:child_process';
import {access, mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const GATE = +(process.env.GATE ?? 1);
const candidates = process.env.BROWSER_EXE ? [process.env.BROWSER_EXE] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
let exe; for (const c of candidates) { try { await access(c); exe = c; break; } catch {} }
assert(exe, 'Set BROWSER_EXE to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(), 'tarikh-map06-'));
const child = spawn(exe, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore', windowsHide: true});
await mkdir('test-results', {recursive: true});
let port, ws;
const KEY = Object.fromEntries(Object.values((await import('../src/rpg/story06.js')).HISTORICAL_QUIZZES).map(q => [q.id, q.correctIndex]));
async function open(url) {
  const target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, {method: 'PUT'})).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args.map(a => a.value ?? a.description)));
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const call = (method, params = {}) => new Promise((res, rej) => { const n = ++id; const tm = setTimeout(() => rej(new Error('CDP timeout ' + method)), 60000); pending.set(n, m => { clearTimeout(tm); m.error ? rej(new Error(m.error.message)) : res(m.result); }); ws.send(JSON.stringify({id: n, method, params})); });
  const js = async expr => { const r = await call('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await js(expr)) return; } catch {} await delay(80); } throw new Error('Timed out: ' + expr); };
  const key = (code, k, type) => call('Input.dispatchKeyEvent', {type, code, key: k, windowsVirtualKeyCode: {KeyE: 69}[code] || 0});
  const press = async (code, k) => { await key(code, k, 'keyDown'); await delay(40); await key(code, k, 'keyUp'); };
  const shot = async name => { const r = await call('Page.captureScreenshot', {format: 'png'}); await writeFile('test-results/' + name + '.png', Buffer.from(r.data, 'base64')); };
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {width: 1600, height: 900, deviceScaleFactor: 1, mobile: false});
  await call('Page.navigate', {url});
  return {call, js, wait, press, key, shot, errors};
}
const seenTrials = [], seenChoices = []; let comicSeen = 0;
const settle = async (p, {maxMs = 60000} = {}) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await p.js(`({c: __tj.cine, d: __tj.dialog, p: __tj.panelOpen, comic: !!document.querySelector('.tj-intro'), trial: document.querySelector('#panel-card [data-trial]')?.dataset.trial || null,
      choice: document.querySelector('#panel-card [data-choice]') ? document.querySelector('#panel-card h2').textContent : null,
      opt: !!document.querySelector('#panel-card [data-opt]:not(:disabled)'), close: !!document.querySelector('#panel-card [data-close]:not([hidden])'),
      verdict: /✓|✗|Дұрыс!|Қате/.test(document.querySelector('#panel-card')?.textContent || '')})`);
    if (s.comic) { if (!comicSeen++) { await delay(3500); await p.shot('map06-09-book'); } await p.press('Escape', 'Escape'); await delay(400); continue; }
    if (s.c) await p.js('__tj.skipCutscene()');
    if (s.d) { await p.js('__tj.advanceDialog()'); await delay(25); continue; }
    if (s.p) {
      if (s.choice) { seenChoices.push(s.choice); await p.js(`document.querySelector('#panel-card [data-ch="${GATE}"]').click()`); }
      else if (s.opt && s.trial) { assert(!s.verdict, 'no verdict during a trial'); seenTrials.push(s.trial); await p.js(`document.querySelector('#panel-card [data-opt="${KEY[s.trial] ?? 0}"]').click()`); }
      else if (s.close) await p.js(`document.querySelector('#panel-card [data-close]:not([hidden])').click()`);
      await delay(90); continue;
    }
    if (!s.c && !s.d && !s.p) { await delay(300); if (!(await p.js('!!(__tj.cine || __tj.dialog || __tj.panelOpen || document.querySelector(".tj-intro"))'))) return; }
    await delay(50);
  }
  throw new Error('UI did not settle');
};
async function use(p, name, {hold = 0, dy = 14, dx = 0, face = 0} = {}) {
  const tp = steps => `(() => { const [x, y] = __tj.LV.MAP.interactPos[${JSON.stringify(name)}]; __tj.E.tj_teleport(Math.round(x + ${dx}), Math.round(y + ${dy})); __tj.E.tj_face(${face}); __tj.step(${steps}); })()`;
  await p.js(tp(3)); await settle(p); await p.js(tp(2));
  if (hold) { await p.key('KeyE', 'e', 'keyDown'); await p.js(`__tj.step(${hold})`); await p.key('KeyE', 'e', 'keyUp'); }
  else await p.press('KeyE', 'e');
  await delay(160); await settle(p);
}
async function talk(p, npc) {
  const tp = steps => `(() => { const i = __tj.LV.MAP.npcs.indexOf(${JSON.stringify(npc)}); const E = __tj.E; E.tj_teleport(E.tj_npc(i, 0), E.tj_npc(i, 1) + 14); E.tj_face(0); __tj.step(${steps}); })()`;
  await p.js(tp(2)); await settle(p); await p.js(tp(1));
  await p.press('KeyE', 'e'); await delay(160); await settle(p);
}
const flag = (p, k) => p.js(`!!__tj.G.flags.b.${k}`);
const stage = p => p.js('__tj.LV.questStage(__tj.G.flags)');
const tracker = p => p.js(`document.getElementById('obj-detail').textContent`);
const goTo = (p, x, y) => p.js(`(() => { __tj.E.tj_teleport(${Math.round(x * 16)}, ${Math.round(y * 16)}); __tj.step(3); })()`);
const groupKill = (p, g) => p.js(`(() => { const E = __tj.E, L = __tj.LV.MAP.enemies; for (let r = 0; r < 80; r++) { let any = false; L.forEach((e, i) => { if (e.group === ${g} && E.tj_enemy(i, 0) > 0) { any = true; E.tj_enemy_damage(i, 40, 0); } }); E.tj_heal(100); __tj.step(2); if (!any) break; } })()`);

const run = (p, mask, n) => p.js(`(() => { const E = __tj.E; E.tj_input(${mask}); for (let i = 0; i < ${n}; i++) { E.tj_heal(100); __tj.step(1); } E.tj_input(0); return 1; })()`);
// A running thrust: run toward (x, y) from the west, strike while still running.
async function charge(p, x, y, {from = 70, dy = 2} = {}) {
  // One evaluation: the page's own frame loop would otherwise reset the input between segments.
  await p.js(`(() => { const E = __tj.E; E.tj_equip(1); E.tj_teleport(${Math.round(x - from)}, ${Math.round(y + dy)}); E.tj_face(2); __tj.step(2);
    for (const [m, n] of [[72, 9], [104, 3], [72, 3], [0, 30]]) for (let i = 0; i < n; i++) { E.tj_input(m); E.tj_heal(100); __tj.step(1); }
    E.tj_input(0); return 1; })()`);
}
const seal = (p, H, k) => p.js(`[__tj.E.tj_enemy(${H}, ${17 + k}) / 1000, __tj.E.tj_enemy(${H}, ${20 + k}) / 1000]`);
try {
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  assert(port, 'Browser launch failed');
  const a = await open(base + '/rpg.html?level=6&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 6', 40000);
  await a.wait('__tj.cine === "arrival"'); await delay(1500); await a.shot('map06-01-arrival'); await settle(a);
  assert(await flag(a, 'arrived'), 'arrived'); assert.equal(await stage(a), 'arrive');
  // Act I — the scribe and the false line; Qarabuqa walks in.
  await talk(a, 'scribe'); assert(await flag(a, 'met'), 'met the scribe'); assert.equal(await stage(a), 'evidence');
  await goTo(a, 58, 34); await settle(a); assert(await flag(a, 'townSeen'), 'town: city and steppe');
  await a.shot('map06-02-town');
  for (const n of ['khorezm', 'mudarris', 'aysha']) await talk(a, n);
  await groupKill(a, 1);
  // Act II — the evidence: the library copy, the mint, the yam register.
  await use(a, 'genealogy'); await use(a, 'mint'); await use(a, 'yamregister');
  assert.equal(await stage(a), 'arms', 'three proofs');
  assert(await flag(a, 'register') && await flag(a, 'coin'), 'artifacts: register sheet, coin');
  await use(a, 'genealogy'); assert(await flag(a, 'twoHands'), 'two hands in the margins');
  await use(a, 'mint'); assert(await flag(a, 'coinShift'), 'the coin letters shift');
  // The cavalry lance: the yamchi, then a real running thrust at each target.
  await talk(a, 'yamchi'); assert(await flag(a, 'lanceLesson'), 'lance lesson');
  const LT = [56, 61, 66].map(x => [x * 16, Math.round(16.4 * 16)]);
  await a.js(`(() => { const E = __tj.E; E.tj_equip(1); E.tj_teleport(${LT[0][0] - 30}, ${LT[0][1] + 2}); E.tj_face(2); __tj.step(2); E.tj_input(32); __tj.step(2); E.tj_input(0); for (let i = 0; i < 40; i++) __tj.step(1); return 1; })()`);
  await settle(a);
  assert(!(await flag(a, 'lanceT1')), 'a standing thrust does not count');
  for (const [x, y] of LT) await charge(a, x, y);
  await settle(a);
  assert(await flag(a, 'lanceDone'), 'three running thrusts: ' + JSON.stringify(await a.js('[1,2,3].map(k => !!__tj.G.flags.b["lanceT" + k])')));
  await a.shot('map06-03-lance');
  await use(a, 'lancerack');   // secret trial: the decimal army
  // The false clue on the field; then the register line has moved to «tomorrow».
  await groupKill(a, 2);
  await goTo(a, 60, 10); await settle(a); assert(await flag(a, 'silhouette'), 'hooded figure on the field');
  await use(a, 'yamregister'); assert(await flag(a, 'regChanged'), 'register line changed');
  // The composite bow: three materials, the bench, then two hits from more than nine steps.
  await talk(a, 'bowyer'); assert(await flag(a, 'bowyerMet'));
  for (const m of ['horn', 'sinew', 'bark']) await use(a, m);
  await talk(a, 'bowyer'); assert(await flag(a, 'bowMade'), 'composite bow made');
  const shoot = (x, y, dist) => a.js(`(() => { const E = __tj.E; E.tj_equip(2); E.tj_teleport(${x}, ${y + dist}); E.tj_face(0); __tj.step(2); E.tj_input(32); for (let i = 0; i < 3; i++) __tj.step(1); E.tj_input(0); for (let i = 0; i < 90; i++) { E.tj_heal(100); __tj.step(1); } return 1; })()`);
  await shoot(51 * 16, Math.round(4.4 * 16), 80); await settle(a);
  assert(!(await flag(a, 'longT1')), 'too close does not count');
  for (const x of [51, 65]) { await shoot(x * 16, Math.round(4.4 * 16), 12 * 16); await settle(a); }
  assert(await flag(a, 'bowDone'), 'long-range hits: ' + JSON.stringify(await a.js('[!!__tj.G.flags.b.longT1, !!__tj.G.flags.b.longT2, __tj.E.tj_state(14)]')));
  await a.shot('map06-04-bow');
  assert.equal(await stage(a), 'confront');
  // Secrets and the remaining side trial.
  await groupKill(a, 3);
  for (const s of ['turbe', 'margin', 'balbalblock', 'scribehome', 'fivemarks', 'caravangate']) await use(a, s);
  assert(await a.js(`JSON.parse(localStorage.getItem('tarikh.anomalies') || '[]').includes('map06')`), 'anomaly collected');
  assert(await a.js('__tj.save(true)'), 'save MAP06');
  const snap = await a.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort(), [...__tj.G.flags.tracks].sort(), __tj.G.flags.quiz, __tj.G.local.granted])');
  await a.js('__tj.load(true)');
  assert.equal(await a.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort(), [...__tj.G.flags.tracks].sort(), __tj.G.flags.quiz, __tj.G.local.granted])'), snap, 'MAP06 save reload');
  // Act III — the confrontation, the archive.
  await use(a, 'archivedoor');
  await a.wait('__tj.G.flags.b.under && __tj.E.tj_state(35) === 1'); await settle(a);
  assert(await flag(a, 'confronted')); assert.equal(await stage(a), 'boss');
  await groupKill(a, 4); await settle(a);
  await goTo(a, 32, 105); await settle(a); assert(await flag(a, 'hallSeen'), 'the hall of shelves');
  await goTo(a, 32, 98); await settle(a);
  if (!(await flag(a, 'bossSeen'))) { await goTo(a, 32, 96); await settle(a); }
  assert(await flag(a, 'bossSeen'), 'boss reveal');
  const H = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 10)');
  const st = () => a.js(`[__tj.E.tj_enemy(${H}, 0), __tj.E.tj_enemy(${H}, 14), __tj.E.tj_enemy(${H}, 15), __tj.E.tj_enemy(${H}, 16), __tj.E.tj_enemy(${H}, 1)]`);
  const breakSeals = async () => {
    for (let k = 0; k < 3; k++) for (let t = 0; t < 4 && ((await st())[3] >> k) & 1; t++) { const [x, y] = await seal(a, H, k); await charge(a, x, y, {from: 64, dy: 0}); }
  };
  // Phase 1 — the gallop and the volley; wait for a volley, then wear him down.
  await a.js(`(() => { const E = __tj.E; E.tj_teleport(32 * 16, 99 * 16); for (let i = 0; i < 600 && E.tj_enemy(${H}, 15) !== 3; i++) { E.tj_heal(100); __tj.step(1); } return 1; })()`);
  assert.equal((await st())[2], 3, 'phase 1 volley'); await a.shot('map06-05-boss-p1');
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 200 && E.tj_enemy(${H}, 14) < 2; i++) { E.tj_enemy_damage(${H}, 40, 0); E.tj_heal(100); __tj.step(2); } for (let i = 0; i < 120; i++) { E.tj_heal(100); __tj.step(1); } return 1; })()`);
  let s = await st(); assert.equal(s[1], 2, 'phase 2'); assert.equal(s[3], 7, 'three seals');
  // Seals: blows bounce off him; only a running lance charge breaks a seal.
  const hp2 = s[0];
  await a.js(`__tj.E.tj_enemy_damage(${H}, 40, 0); 1`);
  assert.equal((await st())[0], hp2, 'shielded by the seals');
  {
    const [x, y] = await seal(a, H, 0);
    await a.js(`(() => { const E = __tj.E; E.tj_equip(1); E.tj_teleport(${Math.round(x - 30)}, ${Math.round(y)}); E.tj_face(2); __tj.step(2); E.tj_input(32); __tj.step(3); E.tj_input(0); for (let i = 0; i < 30; i++) { E.tj_heal(100); __tj.step(1); } return 1; })()`);
    assert.equal((await st())[3] & 1, 1, 'a standing thrust leaves the seal');
  }
  await breakSeals();
  for (let k = 0; k < 3; k++) assert.equal(((await st())[3] >> k) & 1, 0, 'seal ' + k + ' broken by a charge');
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 60 && E.tj_enemy(${H}, 15) !== 6; i++) { E.tj_heal(100); __tj.step(1); } return 1; })()`);
  s = await st(); assert.equal(s[2], 6, 'exposed without seals: ' + JSON.stringify(s));
  await a.shot('map06-06-boss-p2');
  for (let r = 0; r < 5 && (await st())[1] < 3; r++) {
    await breakSeals();
    await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 60 && E.tj_enemy(${H}, 15) !== 6; i++) { E.tj_heal(100); __tj.step(1); } for (let i = 0; i < 80 && E.tj_enemy(${H}, 14) < 3 && E.tj_enemy(${H}, 15) === 6; i++) { E.tj_enemy_damage(${H}, 40, 0); E.tj_heal(100); __tj.step(2); } return 1; })()`);
  }
  assert.equal((await st())[1], 3, 'phase 3');
  // Phase 3 — the reading: three sweeping lines, shielded while he reads; then winded, open to blows.
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 400 && E.tj_enemy(${H}, 15) !== 7; i++) { E.tj_heal(100); __tj.step(1); } return 1; })()`);
  s = await st(); assert.equal(s[2], 7, 'phase 3 reading');
  await a.shot('map06-07-boss-p3');
  const hp3 = s[0]; await a.js(`__tj.E.tj_enemy_damage(${H}, 40, 0); 1`); assert.equal((await st())[0], hp3, 'shielded while reading');
  await a.js(`(() => { const E = __tj.E; for (let r = 0; r < 3000 && E.tj_enemy(${H}, 0) > 0; r++) { if (E.tj_enemy(${H}, 15) === 5) E.tj_enemy_damage(${H}, 40, 0); E.tj_heal(100); __tj.step(1); } return 1; })()`);
  await a.wait('__tj.cine === "bossDown" || __tj.G.flags.b.heraldDown', 10000); await settle(a);
  assert(await flag(a, 'heraldDown'), 'herald defeated'); assert(await flag(a, 'yarlyk') && await flag(a, 'paiza'), 'yarlyk and paiza');
  assert.equal(await stage(a), 'archive');
  await a.shot('map06-08-archive');
  await use(a, 'thread'); assert.equal(await a.js('__tj.LV.secretsFound(__tj.G.flags)'), 6, 'six secrets');
  // The original → the final trial → the choice → the page → the book comic.
  await use(a, 'origscroll', {dy: 16});
  assert(comicSeen > 0, 'the book comic played'); await a.wait(`!document.querySelector('.tj-intro')`, 6000); await settle(a);
  assert(await flag(a, 'page'), 'page 6 granted'); assert(await flag(a, GATE === 1 ? 'erased' : 'exposed'), 'choice recorded');
  assert.equal(await stage(a), 'home'); assert.equal(await a.js('__tj.E.tj_item_count(8)'), 1, 'one chronicle page');
  await use(a, 'stairsup'); await a.wait('__tj.E.tj_state(35) === 0'); await settle(a);
  await use(a, 'gate6');
  await a.wait('__tj.G.flags.b.finished', 20000);
  if (!(await a.js('!!document.querySelector("#go-camp,#retry-epoch")'))) await a.js('__tj.G.complete(); 1');
  for (let i = 0; i < 200 && !(await a.js('__tj.panelOpen && !!document.querySelector("#go-camp,#retry-epoch")')); i++) { await a.js('__tj.advanceDialog()'); await delay(60); }
  await a.shot('map06-10-result');
  const res = await a.js('({score: document.querySelector(".verdict .big")?.textContent, pass: !!document.querySelector("#go-camp"), secrets: __tj.LV.secretsFound(__tj.G.flags), page: __tj.LV.pageLines(__tj.G.flags), area: __tj.E.tj_state(35)})');
  assert.equal(res.score, '100 / 100'); assert(res.pass); assert.equal(res.page, 4); assert.equal(res.area, 0);
  assert.deepEqual([...new Set(seenTrials)].sort(), Object.keys(KEY).sort(), 'all eight trials');
  assert.equal(seenChoices.length, 1, 'one choice');
  assert.deepEqual(a.errors, [], 'no runtime errors');
  console.log('MAP06 browser PASS', JSON.stringify(res), 'choice', GATE);
} finally { try { ws?.close(); } catch {} child.kill(); }

// MAP05 integration: real DOM dialogue/quiz/choice and proximity input; dev hooks accelerate travel/combat.
// Checks the psychological layer (journal rewrite, denials, repeated events, reflection, lingering), the boss
// «Екінші бейне» phase by phase, the hidden chamber, the vision comic, the clay-army easter egg and save/reload.
import {spawn} from 'node:child_process';
import {access, mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const GATE = +(process.env.GATE ?? 0);
const candidates = process.env.BROWSER_EXE ? [process.env.BROWSER_EXE] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
let exe; for (const c of candidates) { try { await access(c); exe = c; break; } catch {} }
assert(exe, 'Set BROWSER_EXE to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(), 'tarikh-map05-'));
const child = spawn(exe, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore', windowsHide: true});
await mkdir('test-results', {recursive: true});
let port, ws;
const KEY = Object.fromEntries(Object.values((await import('../src/rpg/story05.js')).HISTORICAL_QUIZZES).map(q => [q.id, q.correctIndex]));
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
    if (s.comic) { if (!comicSeen++) { await delay(3500); await p.shot('map05-11-vision'); } await p.press('Escape', 'Escape'); await delay(400); continue; }
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

try {
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  assert(port, 'Browser launch failed');
  const a = await open(base + '/rpg.html?level=5&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 5');
  await a.wait('__tj.cine === "camp"'); await delay(1500); await a.shot('map05-01-camp');
  await settle(a);
  await use(a, 'campturk');
  await a.wait('__tj.cine === "arrival" || __tj.G.flags.b.arrived'); await delay(1600); await a.shot('map05-02-arrival'); await settle(a);
  assert(await flag(a, 'arrived'), 'arrived'); assert.equal(await stage(a), 'arrive');
  // Act I — «Ты вернулся».
  await talk(a, 'irkin');
  assert(await flag(a, 'met'), 'met Irkin'); assert.equal(await stage(a), 'gather');
  const journal1 = await tracker(a);
  // Act II — two stories.
  await use(a, 'burntgate'); assert(await flag(a, 'gateSeen'), 'gate scene');
  await a.shot('map05-03-gate');
  await groupKill(a, 2); await settle(a);
  await talk(a, 'kumis'); await talk(a, 'sentry');
  await talk(a, 'togyz');
  assert.equal(await stage(a), 'gather2', 'journal entry rewritten');
  const journal2 = await tracker(a);
  assert.notEqual(journal1, journal2, 'the journal changed without a notice');
  await use(a, 'cradle'); await use(a, 'runeboard');
  assert.equal(await stage(a), 'ktcamp', 'both versions collected');
  // Repeated event + silhouette on the road.
  await goTo(a, 40.5, 59); await settle(a); assert(await flag(a, 'sightSeen'), 'silhouette on the road');
  await goTo(a, 46, 55); await settle(a); assert(await flag(a, 'herd1'), 'herdsman passes');
  await goTo(a, 40.5, 46); await settle(a); assert(await flag(a, 'hush1'), 'music cut on the bend');
  // The other side.
  await goTo(a, 88, 22); await settle(a); assert(await flag(a, 'ktSeen'), 'camp arrival');
  await talk(a, 'tonyukuk'); await talk(a, 'kultegin');
  assert(await flag(a, ['gateYes', 'gateNo', 'gateUnsure'][GATE]), 'answer to Kül Tegin recorded');
  assert.equal(await stage(a), 'stele');
  await a.shot('map05-04-ktcamp');
  // Act III — the stone, the first meeting.
  await use(a, 'stele'); await use(a, 'balbals');
  assert(await flag(a, 'twin1'), 'first meeting with the second Aibar');
  assert.equal(await stage(a), 'lake');
  await talk(a, 'kumis'); assert(await a.js('__tj.G.flags.b.twin1'), 'kumis talked after meeting');
  await talk(a, 'herd'); assert(await flag(a, 'herdDenied'), 'herdsman denies the meeting');
  await goTo(a, 46, 55); await settle(a); assert(await flag(a, 'herd2'), 'herdsman stops the second time');
  await goTo(a, 40.5, 46); await settle(a); assert(await flag(a, 'hush2'), 'the same silence again');
  await use(a, 'scarf'); assert(await flag(a, 'scarf'), 'the scarf appeared');
  // Lingering on the field: an eighth balbal (real time, 4 Hz tick).
  await groupKill(a, 3);
  await goTo(a, 64, 46); await a.wait('__tj.G.flags.b.balbalTurned', 30000); await settle(a);
  await a.shot('map05-05-balbal');
  // The lake: the reflection lags, then the second meeting.
  await a.js('__tj.E.tj_teleport(17 * 16, 52 * 16); 1'); await delay(900);
  await a.shot('map05-06-reflection');
  assert.equal(await a.js('__tj.E.tj_npc(__tj.LV.MAP.npcs.indexOf("reflect"), 2)'), 1, 'reflection visible on the shore');
  await a.wait('__tj.cine === "lake" || __tj.G.flags.b.lakeSeen', 10000); await settle(a);
  assert(await flag(a, 'lakeSeen'), 'second meeting at the lake'); assert.equal(await stage(a), 'ruin');
  for (const s of ['tamga', 'statue', 'wolfden', 'lakestone', 'oldcamp']) await use(a, s);
  assert.equal(await a.js('__tj.LV.secretsFound(__tj.G.flags)'), 6, 'six secrets');
  assert(await a.js('__tj.save(true)'), 'save MAP05');
  const snap = await a.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort(), [...__tj.G.flags.tracks].sort(), __tj.G.flags.quiz, __tj.G.local.granted])');
  await a.js('__tj.load(true)');
  assert.equal(await a.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort(), [...__tj.G.flags.tracks].sort(), __tj.G.flags.quiz, __tj.G.local.granted])'), snap, 'MAP05 save reload');
  // Act IV — below.
  await use(a, 'chamberdoor');
  await a.wait('__tj.G.flags.b.under && __tj.E.tj_state(35) === 1'); await settle(a);
  await groupKill(a, 4); await settle(a);
  // The clay army (easter egg): a loose rock in the antechamber's west wall.
  await use(a, 'qincrack', {hold: 120, dx: 14, dy: 0, face: 6});
  assert(await flag(a, 'qinOpen'), 'hidden passage opened');
  await talk(a, 'qin'); assert(await flag(a, 'qinMet'), 'met the emperor');
  await a.shot('map05-07-qin');
  assert(await a.js(`JSON.parse(localStorage.getItem('tarikh.anomalies') || '[]').includes('map05')`), 'anomaly collected');
  await groupKill(a, 4);
  await goTo(a, 32, 98); await settle(a);
  if (!(await flag(a, 'bossSeen'))) { await goTo(a, 32, 96); await settle(a); }
  assert(await flag(a, 'bossSeen'), 'boss reveal');
  const W = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 9)');
  const st = () => a.js(`[__tj.E.tj_enemy(${W}, 0), __tj.E.tj_enemy(${W}, 14), __tj.E.tj_enemy(${W}, 15), __tj.E.tj_enemy(${W}, 16)]`);
  // Phase 1 — prediction: a ring where the hero will be; the mirror walk.
  await a.js(`(() => { const E = __tj.E; E.tj_teleport(440, 1530); for (let i = 0; i < 500 && E.tj_enemy(${W}, 15) !== 1; i++) { E.tj_heal(100); E.tj_input(i % 60 < 30 ? 8 : 4); __tj.step(1); } E.tj_input(0); })()`);
  assert.equal((await st())[2], 1, 'phase 1 prediction ring'); await a.shot('map05-08-boss-p1');
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 80 && E.tj_enemy(${W}, 14) < 2; i++) { E.tj_enemy_damage(${W}, 40, 0); E.tj_heal(100); __tj.step(3); } for (let i = 0; i < 90; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  let s = await st(); assert.equal(s[1], 2, 'phase 2'); assert.equal(s[3], 7, 'three copies');
  // Copies: harmless false signals; a blow dissolves a copy without hurting him.
  for (let k = 0; k < 3; k++) {
    const hp0 = (await st())[0];
    await a.js(`(() => { const E = __tj.E; for (let t = 0; t < 5 && (E.tj_enemy(${W}, 16) & (1 << ${k})); t++) { const x = E.tj_enemy(${W}, ${17 + k}) / 1000, y = E.tj_enemy(${W}, ${20 + k}) / 1000;
      E.tj_teleport(Math.round(x), Math.round(y + 18)); E.tj_face(0); E.tj_input(32); for (let i = 0; i < 10; i++) { E.tj_heal(100); __tj.step(1); } E.tj_input(0); for (let i = 0; i < 30; i++) { E.tj_heal(100); __tj.step(1); } } })()`);
    assert.equal(((await st())[3] >> k) & 1, 0, 'copy ' + k + ' dissolved');
    assert((await st())[0] <= hp0, 'copies never heal him');
  }
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 240 && E.tj_enemy(${W}, 15) !== 6; i++) { E.tj_heal(100); __tj.step(1); } })()`);   // a dash in flight finishes first
  s = await st(); assert.equal(s[3], 0, 'no copies left'); assert.equal(s[2], 6, 'exposed after the copies are gone: ' + JSON.stringify(s));
  await a.shot('map05-09-boss-p2');
  await a.js(`(() => { const E = __tj.E; for (let r = 0; r < 6 && E.tj_enemy(${W}, 14) < 3; r++) { for (let i = 0; i < 60 && E.tj_enemy(${W}, 14) < 3 && E.tj_enemy(${W}, 15) === 6; i++) { E.tj_enemy_damage(${W}, 40, 0); E.tj_heal(100); __tj.step(2); }
      for (let k = 0; k < 3; k++) for (let t = 0; t < 5 && (E.tj_enemy(${W}, 16) & (1 << k)); t++) { const x = E.tj_enemy(${W}, 17 + k) / 1000, y = E.tj_enemy(${W}, 20 + k) / 1000; E.tj_teleport(Math.round(x), Math.round(y + 18)); E.tj_face(0); E.tj_input(32); for (let i = 0; i < 10; i++) { E.tj_heal(100); __tj.step(1); } E.tj_input(0); for (let i = 0; i < 30; i++) { E.tj_heal(100); __tj.step(1); } }
      for (let i = 0; i < 200 && E.tj_enemy(${W}, 15) !== 6 && E.tj_enemy(${W}, 14) < 3; i++) { E.tj_heal(100); __tj.step(1); } } })()`);
  // Phase 3 — refusal: blows pass through him, the story takes over.
  await a.wait(`__tj.E.tj_enemy(${W}, 14) === 3`, 5000);
  await a.js(`(() => { for (let i = 0; i < 80; i++) { __tj.E.tj_heal(100); __tj.step(1); } })()`);
  await a.wait('__tj.cine === "refusal" || __tj.G.flags.b.imageDown', 8000);
  await a.shot('map05-10-boss-refusal');
  await settle(a);
  assert(await flag(a, 'imageDown'), 'he stopped fighting'); assert(await flag(a, 'sealOpen'), 'seal opened');
  assert(await a.js(`(() => { const E = __tj.E, hp = E.tj_enemy(${W}, 0); E.tj_enemy_damage(${W}, 60, 0); return E.tj_enemy(${W}, 0) === hp && E.tj_enemy(${W}, 6) === 0; })()`), 'gone and untouchable');
  assert.equal(await stage(a), 'chamber');
  // The impossible proof → final trial → last meeting → page → the vision comic.
  await use(a, 'inscription', {dy: 16});
  assert(comicSeen > 0, 'the vision comic played'); await a.wait(`!document.querySelector('.tj-intro')`, 6000); await settle(a);
  assert(await flag(a, 'page'), 'page 5 granted'); assert.equal(await stage(a), 'home');
  assert.equal(await a.js('__tj.E.tj_item_count(8)'), 1, 'one chronicle page');
  await use(a, 'stairsup');
  await a.wait('__tj.E.tj_state(35) === 0'); await settle(a);
  assert.equal(await stage(a), 'home2', 'the «home» entry rewrote itself');
  await use(a, 'turkgate');
  await a.wait('__tj.cine === "home"'); await a.js('__tj.skipCutscene()');
  for (let i = 0; i < 200 && !(await a.js('__tj.panelOpen && !!document.querySelector("#go-camp,#retry-epoch")')); i++) { await a.js('__tj.advanceDialog()'); await delay(60); }
  await a.shot('map05-12-result');
  const res = await a.js('({score: document.querySelector(".verdict .big")?.textContent, pass: !!document.querySelector("#go-camp"), secrets: __tj.LV.secretsFound(__tj.G.flags), page: __tj.LV.pageLines(__tj.G.flags), area: __tj.E.tj_state(35)})');
  assert.equal(res.score, '100 / 100'); assert(res.pass); assert.equal(res.page, 4); assert.equal(res.area, 2);
  assert.deepEqual([...new Set(seenTrials)].sort(), Object.keys(KEY).sort(), 'all eight trials');
  assert.equal(seenChoices.length, 1, 'one choice');
  assert.deepEqual(a.errors, [], 'no runtime errors');
  console.log('MAP05 browser PASS', JSON.stringify(res), 'gate answer', GATE);
} finally { try { ws?.close(); } catch {} child.kill(); }

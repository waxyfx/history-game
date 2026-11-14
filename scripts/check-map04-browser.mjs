// MAP04 integration: real DOM dialogue/quiz and proximity input; dev hooks accelerate travel/combat.
import {spawn} from 'node:child_process';
import {access, mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const CHOICE = {tally: +(process.env.TALLY ?? 0), ally: +(process.env.ALLY ?? 0)};
const candidates = process.env.BROWSER_EXE ? [process.env.BROWSER_EXE] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
let exe; for (const c of candidates) { try { await access(c); exe = c; break; } catch {} }
assert(exe, 'Set BROWSER_EXE to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(), 'tarikh-map04-'));
const child = spawn(exe, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore', windowsHide: true});
await mkdir('test-results', {recursive: true});
let port, ws;
const KEY = Object.fromEntries(Object.values((await import('../src/rpg/story04.js')).HISTORICAL_QUIZZES).map(q => [q.id, q.correctIndex]));
const T = 16;
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
  const call = (method, params = {}) => new Promise((res, rej) => { const n = ++id; const tm = setTimeout(() => rej(new Error('CDP timeout ' + method)), 30000); pending.set(n, m => { clearTimeout(tm); m.error ? rej(new Error(m.error.message)) : res(m.result); }); ws.send(JSON.stringify({id: n, method, params})); });
  const js = async expr => { const r = await call('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await js(expr)) return; } catch {} await delay(80); } throw new Error('Timed out: ' + expr); };
  const key = (code, k, type) => call('Input.dispatchKeyEvent', {type, code, key: k, windowsVirtualKeyCode: {KeyE: 69}[code] || 0});
  const press = async (code, k) => { await key(code, k, 'keyDown'); await delay(40); await key(code, k, 'keyUp'); };
  const shot = async name => { const r = await call('Page.captureScreenshot', {format: 'png'}); await writeFile('test-results/' + name + '.png', Buffer.from(r.data, 'base64')); };
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {width: 1600, height: 900, deviceScaleFactor: 1, mobile: false});
  await call('Page.navigate', {url});
  return {call, js, wait, press, key, shot, errors, nav: u => call('Page.navigate', {url: u})};
}
const seenTrials = [], seenChoices = [];
const settle = async (p, {maxMs = 45000} = {}) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await p.js(`({c: __tj.cine, d: __tj.dialog, p: __tj.panelOpen, trial: document.querySelector('#panel-card [data-trial]')?.dataset.trial || null,
      choice: document.querySelector('#panel-card [data-choice]') ? document.querySelector('#panel-card h2').textContent : null,
      opt: !!document.querySelector('#panel-card [data-opt]:not(:disabled)'), close: !!document.querySelector('#panel-card [data-close]:not([hidden])'),
      verdict: /✓|✗|Дұрыс!|Қате/.test(document.querySelector('#panel-card')?.textContent || '')})`);
    if (s.c) await p.js('__tj.skipCutscene()');
    if (s.d) { await p.js('__tj.advanceDialog()'); await delay(25); continue; }
    if (s.p) {
      if (s.choice) { const k = /Жалған таңба/.test(s.choice) ? CHOICE.tally : CHOICE.ally; seenChoices.push(s.choice); await p.js(`document.querySelector('#panel-card [data-ch="${k}"]').click()`); }
      else if (s.opt && s.trial) { assert(!s.verdict, 'no verdict during a trial'); seenTrials.push(s.trial); await p.js(`document.querySelector('#panel-card [data-opt="${KEY[s.trial] ?? 0}"]').click()`); }
      else if (s.close) await p.js(`document.querySelector('#panel-card [data-close]:not([hidden])').click()`);
      await delay(90); continue;
    }
    if (!s.c && !s.d && !s.p) { await delay(250); if (!(await p.js('!!(__tj.cine || __tj.dialog || __tj.panelOpen)'))) return; }
    await delay(50);
  }
  throw new Error('UI did not settle');
};
async function use(p, name, {hold = 0, dy = 14, dx = 0, face = 0} = {}) {
  await p.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos[${JSON.stringify(name)}]; __tj.E.tj_teleport(Math.round(x + ${dx}), Math.round(y + ${dy})); __tj.E.tj_face(${face}); __tj.step(3); })()`);
  await settle(p);   // a zone trigger may have opened a line first
  await p.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos[${JSON.stringify(name)}]; __tj.E.tj_teleport(Math.round(x + ${dx}), Math.round(y + ${dy})); __tj.E.tj_face(${face}); __tj.step(2); })()`);
  if (hold) { await p.key('KeyE', 'e', 'keyDown'); await p.js(`__tj.step(${hold})`); await p.key('KeyE', 'e', 'keyUp'); }
  else await p.press('KeyE', 'e');
  await delay(160); await settle(p);
}
async function talk(p, npc) {
  await p.js(`(() => { const i = __tj.LV.MAP.npcs.indexOf(${JSON.stringify(npc)}); const E = __tj.E; E.tj_teleport(E.tj_npc(i, 0), E.tj_npc(i, 1) + 14); E.tj_face(0); __tj.step(2); })()`);
  await settle(p);
  await p.js(`(() => { const i = __tj.LV.MAP.npcs.indexOf(${JSON.stringify(npc)}); const E = __tj.E; E.tj_teleport(E.tj_npc(i, 0), E.tj_npc(i, 1) + 14); E.tj_face(0); __tj.step(1); })()`);
  await p.press('KeyE', 'e'); await delay(160); await settle(p);
}
const flag = (p, k) => p.js(`!!__tj.G.flags.b.${k}`);
const ev = p => p.js('__tj.G.flags.tracks.length');
const groupKill = (p, g) => p.js(`(() => { const E = __tj.E, L = __tj.LV.MAP.enemies; for (let r = 0; r < 80; r++) { let any = false; L.forEach((e, i) => { if (e.group === ${g} && E.tj_enemy(i, 0) > 0) { any = true; E.tj_enemy_damage(i, 40, 0); } }); E.tj_heal(100); __tj.step(12); if (!any) break; } return L.filter((e, i) => e.group === ${g} && E.tj_enemy(i, 0) > 0).length; })()`);

try {
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  assert(port, 'Browser launch failed');
  const a = await open(base + '/rpg.html?level=4&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 4');
  await a.wait('__tj.cine === "camp"'); await delay(1500);
  await settle(a);
  await a.shot('map04-01-camp');
  await talk(a, 'dana');
  await use(a, 'camphun');
  await a.wait('__tj.cine === "arrival" || __tj.G.flags.b.arrived'); await delay(2500); await a.shot('map04-02a-arrival-pan'); await settle(a);
  assert(await flag(a, 'arrived'), 'arrived in Talas');
  assert.equal(await a.js('__tj.E.tj_state(35)'), 0);
  await a.shot('map04-02-talas');
  for (const npc of ['zhizhi', 'fengliao', 'kangju', 'shuga', 'wusunbek', 'merchant']) await talk(a, npc);
  await talk(a, 'fengliao');
  await use(a, 'tallystone');
  assert(await flag(a, CHOICE.tally ? 'tallyBurned' : 'tallyKept'), 'tally choice recorded');
  await use(a, 'muster'); await use(a, 'borderstone');
  await groupKill(a, 2);
  await use(a, 'envoypost', {hold: 180});
  assert(await flag(a, 'envoyFree'), 'envoy rescued');
  assert.equal(await ev(a), 3, 'all three proofs');
  for (const name of ['ramparts', 'whistle', 'silk', 'cord11', 'bell', 'oldkit', 'wallmark']) await use(a, name);
  assert(await a.js('__tj.save(true)'), 'save MAP04');
  const snap = await a.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort(), [...__tj.G.flags.tracks].sort(), __tj.G.flags.quiz, __tj.G.local.granted])');
  await a.js('__tj.load(true)');
  assert.equal(await a.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort(), [...__tj.G.flags.tracks].sort(), __tj.G.flags.quiz, __tj.G.local.granted])'), snap, 'MAP04 save reload');
  assert(await a.js('!!localStorage.getItem("tarikh.rpg.v3.L4")'), 'separate save key');
  await use(a, 'council');
  assert(await flag(a, 'council'), 'council complete');
  assert(await flag(a, ['allyZhizhi','allyFeng','allyKangju'][CHOICE.ally]), 'ally recorded');
  if (CHOICE.tally) {
    assert(await flag(a, 'raid'), 'burned tally starts raid');
    await groupKill(a, 3); await settle(a);
    assert(await flag(a, 'raidDone'), 'raid resolved');
  }
  await a.shot('map04-03-council');
  await use(a, 'tombdoor');
  await a.wait('__tj.G.flags.b.under && __tj.E.tj_state(35) === 1'); await settle(a);
  assert(await flag(a, 'under'));
  assert.equal(await a.js('__tj.E.tj_state(35)'), 1);
  await groupKill(a, 4);
  await a.js('__tj.E.tj_teleport(512, 1456); __tj.step(4)');
  await settle(a);
  if (!(await flag(a, 'bossSeen'))) { await a.js('__tj.E.tj_teleport(512, 1408); __tj.step(4)'); await settle(a); }
  assert(await flag(a, 'bossSeen'), 'witness reveal');
  await a.shot('map04-04-witness');
  // The witness, phase by phase (with buffs from the belt).
  const W = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 8)');
  const st = () => a.js(`[__tj.E.tj_enemy(${W}, 0), __tj.E.tj_enemy(${W}, 14), __tj.E.tj_enemy(${W}, 15), __tj.E.tj_enemy(${W}, 16)]`);
  await a.js('__tj.E.tj_item_add(21, 1); __tj.useItem(21); 1');
  await a.js(`(() => { const E = __tj.E; E.tj_teleport(512, 1460); for (let i = 0; i < 400 && E.tj_enemy(${W}, 15) !== 1; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  await a.shot('map04-06-witness-p1-volley');
  assert.equal((await st())[1], 1, 'phase 1');
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 60 && E.tj_enemy(${W}, 14) < 2; i++) { E.tj_enemy_damage(${W}, 40, 0); E.tj_heal(100); __tj.step(3); } for (let i = 0; i < 100; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  let s2 = await st(); assert.equal(s2[1], 2, 'phase 2'); assert.equal(s2[3], 7, 'three banners');
  await a.js(`(() => { const E = __tj.E, hp = E.tj_enemy(${W}, 0); E.tj_enemy_damage(${W}, 50, 0); return hp === E.tj_enemy(${W}, 0); })()`).then(v => assert(v, 'banners block damage'));
  await a.shot('map04-07-witness-p2-banners');
  for (let k = 0; k < 3; k++) {
    await a.js(`(() => { const E = __tj.E, a = 1.5708 + ${k} * 2.0944, x = 512 + Math.cos(a) * 62, y = 1392 + Math.sin(a) * 40 + 6;
      for (let t = 0; t < 4 && (E.tj_enemy(${W}, 16) & (1 << ${k})); t++) { E.tj_teleport(Math.round(x), Math.round(y + 18)); E.tj_face(0); E.tj_input(32); for (let i = 0; i < 10; i++) { E.tj_heal(100); __tj.step(1); } E.tj_input(0); for (let i = 0; i < 30; i++) { E.tj_heal(100); __tj.step(1); } } })()`);
  }
  s2 = await st(); assert.equal(s2[3], 0, 'all banners cut'); assert.equal(s2[2], 6, 'collapsed, open to blows');
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 60 && E.tj_enemy(${W}, 14) < 3 && E.tj_enemy(${W}, 15) === 6; i++) { E.tj_enemy_damage(${W}, 40, 0); E.tj_heal(100); __tj.step(2); } for (let i = 0; i < 100; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  if ((await st())[1] < 3) {   // banners raised again: cut them once more
    for (let k = 0; k < 3; k++) await a.js(`(() => { const E = __tj.E, a = 1.5708 + ${k} * 2.0944, x = 512 + Math.cos(a) * 62, y = 1392 + Math.sin(a) * 40 + 6;
      for (let t = 0; t < 4 && (E.tj_enemy(${W}, 16) & (1 << ${k})); t++) { E.tj_teleport(Math.round(x), Math.round(y + 18)); E.tj_face(0); E.tj_input(32); for (let i = 0; i < 10; i++) { E.tj_heal(100); __tj.step(1); } E.tj_input(0); for (let i = 0; i < 30; i++) { E.tj_heal(100); __tj.step(1); } } })()`);
    await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 60 && E.tj_enemy(${W}, 14) < 3; i++) { E.tj_enemy_damage(${W}, 40, 0); E.tj_heal(100); __tj.step(2); } for (let i = 0; i < 100; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  }
  assert.equal((await st())[1], 3, 'phase 3');
  await a.js(`(() => { const E = __tj.E; E.tj_teleport(512, 1440); for (let i = 0; i < 300 && E.tj_enemy(${W}, 15) !== 3; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  await a.shot('map04-08-witness-p3-echo');
  await a.js(`(() => { const E = __tj.E; for (let r = 0; r < 12 && E.tj_enemy(${W}, 0) > 0; r++) { for (let i = 0; i < 500 && E.tj_enemy(${W}, 15) !== 6; i++) { E.tj_heal(100); __tj.step(1); }
      for (let i = 0; i < 30 && E.tj_enemy(${W}, 15) === 6 && E.tj_enemy(${W}, 0) > 0; i++) { E.tj_enemy_damage(${W}, 40, 0); __tj.step(2); } } __tj.step(30); })()`);
  await groupKill(a, 6); await settle(a);
  assert(await flag(a, 'witnessDown'), 'witness defeated');
  await use(a, 'masks');
  assert(await flag(a, 'masks'), 'final quiz');
  await use(a, 'stairsup');
  await a.wait('__tj.E.tj_state(35) === 0'); await delay(300);
  await use(a, 'council');
  assert(await flag(a, 'peace'), 'peace restored');
  await use(a, 'tombdoor');
  await a.wait('__tj.E.tj_state(35) === 1'); await delay(300);
  // The film: played in full (not skipped), timed, with frames captured along the way.
  await a.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos.knotdesk; __tj.E.tj_teleport(x, y + 14); __tj.E.tj_face(0); __tj.step(3); })()`);
  await settle(a);
  await a.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos.knotdesk; __tj.E.tj_teleport(x, y + 14); __tj.E.tj_face(0); __tj.step(2); })()`);
  await a.press('KeyE', 'e');
  await a.wait('__tj.cine === "film4"', 8000);
  const t0 = Date.now(), subs = new Set(); let shot = 0;
  assert(await a.js(`document.getElementById('viewport').classList.contains('film')`), 'film letterbox');
  while (await a.js('__tj.cine === "film4"') && Date.now() - t0 < 140000) {
    const s = await a.js(`document.getElementById('sub').hidden ? '' : document.getElementById('sub').textContent`); if (s) subs.add(s);
    const el = (Date.now() - t0) / 1000;
    if ([6, 22, 34, 48, 62, 74, 84].some((t, i) => i === shot && el >= t)) { await a.shot('map04-film-' + String(++shot).padStart(2, '0')); }
    await delay(250);
  }
  const filmSeconds = (Date.now() - t0) / 1000;
  console.log('film seconds', filmSeconds.toFixed(1), 'subtitles', subs.size);
  assert(filmSeconds >= 60 && filmSeconds <= 120, 'film length ' + filmSeconds);
  assert(subs.size >= 8, 'timed subtitles shown: ' + subs.size);
  assert.equal(await a.js('__tj.E.tj_npc(__tj.LV.MAP.npcs.indexOf("knot"), 2)'), 0, 'the knot-keeper is gone after the film');
  await settle(a);
  assert(await flag(a, 'page'), 'page 4 granted');
  assert.equal(await a.js('__tj.E.tj_item_count(8)'), 1, 'one chronicle page');
  await use(a, 'stairsup');
  await a.js('(() => { const [x,y]=__tj.LV.MAP.interactPos.hungate; __tj.E.tj_teleport(x,y+14); __tj.E.tj_face(0); __tj.step(3); })()');
  await a.press('KeyE', 'e');
  await a.wait('__tj.cine === "home"');
  await a.js('__tj.skipCutscene()');
  for (let i=0;i<200 && !(await a.js('__tj.panelOpen && !!document.querySelector("#go-camp,#retry-epoch")'));i++) { await a.js('__tj.advanceDialog()'); await delay(60); }
  await a.shot('map04-05-result');
  const res=await a.js('({score:document.querySelector(".verdict .big")?.textContent,pass:!!document.querySelector("#go-camp"),secrets:__tj.LV.secretsFound(__tj.G.flags),page:__tj.LV.pageLines(__tj.G.flags),area:__tj.E.tj_state(35)})');
  assert.equal(res.score,'100 / 100'); assert(res.pass); assert.equal(res.page,4); assert.equal(res.area,2);
  assert.deepEqual([...new Set(seenTrials)].sort(),Object.keys(KEY).sort(),'all eight trials');
  assert.deepEqual(a.errors,[],'no runtime errors');
  console.log('MAP04 browser PASS',JSON.stringify(res),'choices',JSON.stringify(CHOICE));
} finally { try { ws?.close(); } catch {} child.kill(); }

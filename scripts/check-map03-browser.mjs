// End-to-end browser check for MAP03 «Сақтар әлемі» (headless Chrome/Edge over CDP).
// Usage: npm run dev, then: node scripts/check-map03-browser.mjs http://127.0.0.1:5173
// Camp → arrival → welcome → the five people → the accusation (choice) → evidence from several
// sources (foal side-quest, Qaraman choice, Arna's trial) → the tomb → the golden rider (all three
// phases: charge telegraph, frontal guard, mirror illusions) → Zulmat's mirror → verdict → page →
// back to the Chroniclers' Camp → result 100/100 with every secret.
import {spawn} from 'node:child_process';
import {access, mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const CHOICE = {assembly: +(process.env.ASSEMBLY ?? 0), qaraman: 0};
const candidates = process.env.BROWSER_EXE ? [process.env.BROWSER_EXE] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
let exe; for (const c of candidates) { try { await access(c); exe = c; break; } catch {} }
assert(exe, 'Set BROWSER_EXE to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(), 'tarikh-map03-'));
const child = spawn(exe, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore', windowsHide: true});
await mkdir('test-results', {recursive: true});
let port, ws;
const KEY = {saka_gold: 1, saka_kurgan: 2, saka_women: 0, saka_final: 3, saka_esik: 1, saka_berel: 2, saka_altar: 1, saka_hats: 0};
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
      if (s.choice) { const k = /Жауынгерлер/.test(s.choice) ? CHOICE.assembly : CHOICE.qaraman; seenChoices.push(s.choice); await p.js(`document.querySelector('#panel-card [data-ch="${k}"]').click()`); }
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
  const a = await open(base + '/rpg.html?level=3');
  await a.wait('window.__tj && __tj.E');
  await a.js(`localStorage.setItem('tarikh.introLang', 'kk'); localStorage.setItem('tarikh.rpg.results', JSON.stringify([{map: 1, passed: true, t0: 1}, {map: 2, passed: true, t0: 2}])); 1`);
  await a.nav(base + '/rpg.html?level=3&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 3');
  // 1. Chroniclers' Camp
  await a.wait('__tj.cine === "camp"'); await delay(2200); await a.shot('map03-01-camp'); await settle(a);
  await talk(a, 'dana');
  // 2. Through the gate: arrival in the Saka steppe
  await use(a, 'campsaka');
  await a.wait('__tj.cine === "arrival" || __tj.G.flags.b.arrived'); await settle(a);
  assert(await flag(a, 'arrived'), 'arrived');
  assert.equal(await a.js('__tj.E.tj_state(35)'), 0, 'world area');
  await a.shot('map03-02-arrival');
  // 3. Welcome at the edge of the settlement
  await a.js(`__tj.E.tj_teleport(${30 * T}, ${50 * T}); __tj.step(4)`);
  await a.wait('__tj.cine === "welcome"'); await delay(2500); await a.shot('map03-03-welcome'); await settle(a);
  assert(await flag(a, 'welcomed'));
  // 4. The five people, the goldsmith's trial
  for (const w of ['barsbek', 'qaraman', 'arna', 'altynbek', 'kungey', 'ulpan', 'tayzhan']) await talk(a, w);
  await use(a, 'goldwork');
  assert(await a.js('!!__tj.G.flags.quiz.saka_gold'), 'goldsmith trial');
  assert.equal(await a.js('__tj.LV.questStage(__tj.G.flags)'), 'gather');
  // Secrets on the surface (independent of the story order)
  await use(a, 'niche', {dy: -14, face: 4});
  await use(a, 'institute'); await use(a, 'arnacache'); await use(a, 'altar');
  // Save/load before the big scene.
  assert(await a.js('__tj.save(true)'));
  const snap = await a.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort()])');
  await a.js('__tj.load(true)');
  assert.equal(await a.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort()])'), snap, 'save/load mid-level');
  // 5. THE ACCUSATION
  await a.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos.assembly; __tj.E.tj_teleport(x, y + 14); __tj.E.tj_face(0); __tj.step(3); })()`);
  await a.press('KeyE', 'e');
  await a.wait('__tj.cine === "assembly"'); await delay(2600); await a.shot('map03-04a-assembly-opens');
  for (let i = 0; i < 400 && !(await a.js(`document.getElementById('dlg-name').textContent === 'Зұлмат' && !document.getElementById('dlg').hidden`)); i++) { await a.js('__tj.advanceDialog()'); await delay(120); }
  await delay(900); await a.shot('map03-04b-zulmat-speech');
  for (let i = 0; i < 400 && !(await a.js(`/Жауынгерлер! Оны қоршаңдар/.test(document.getElementById('dlg-text').textContent)`)); i++) { await a.js('__tj.advanceDialog()'); await delay(120); }
  await delay(1500); await a.shot('map03-04c-surrounded');
  await settle(a);
  // (use() settles everything; replay the key frames for the record)
  assert(await flag(a, 'accused'), 'accused');
  assert(await flag(a, CHOICE.assembly ? 'fled' : 'submitted'), 'choice recorded');
  assert(seenChoices.some(c => /Жауынгерлер/.test(c)), 'assembly choice shown');
  // Changed attitudes: Qaraman refuses, the warriors are cold, Arna and the shaman help.
  await talk(a, 'qaraman');
  await talk(a, 'warrior1');
  // 6. Evidence from several sources
  await use(a, 'hoofs'); await use(a, 'shard');
  await groupKill(a, 3);
  await groupKill(a, 2);
  await use(a, 'kurganseal');
  assert(await a.js('!!__tj.G.flags.quiz.saka_kurgan'), 'kurgan trial');
  await talk(a, 'kungey');          // legend
  await talk(a, 'kungey');          // secret trial: pointed hats
  if (CHOICE.assembly) { await talk(a, 'altynbek'); assert.equal(await ev(a), 4, 'the goldsmith refuses after the escape'); await use(a, 'plaque'); }
  await talk(a, 'altynbek');        // ledger (after fleeing: only once his stolen plaque is returned)
  await talk(a, 'tayzhan');         // refuses: the foal side quest starts
  assert(await flag(a, 'foalQuest'));
  await talk(a, 'foal');
  assert(await flag(a, 'foalHome'));
  await talk(a, 'tayzhan');         // tally stick
  assert.equal(await ev(a), 6, 'all six pieces of evidence');
  await talk(a, 'qaraman');         // choice: tell him privately
  assert(await flag(a, 'qaramanTold'));
  await use(a, 'target');           // Arna's trial
  await talk(a, 'arna');            // she leads the way: trail
  assert(await flag(a, 'trail'), 'trail open');
  // 7. The royal tomb
  await use(a, 'tunnel');
  await a.wait('__tj.G.flags.b.tomb && __tj.E.tj_state(35) === 1'); await settle(a);
  assert(await flag(a, 'tomb')); assert.equal(await a.js('__tj.E.tj_state(35)'), 1, 'tomb area');
  await a.js(`__tj.E.tj_teleport(${32 * T}, ${100 * T}); __tj.step(4)`); await settle(a);
  await a.js('__tj.step(30)'); await a.shot('map03-05-tomb');
  await groupKill(a, 4); await groupKill(a, 5);
  await use(a, 'horses'); await use(a, 'treasury');
  // 8. The golden rider
  await a.js(`__tj.E.tj_teleport(${32 * T}, ${91 * T}); __tj.step(4)`);
  await a.wait('__tj.cine === "boss"'); await delay(1500); await settle(a);
  const boss = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 7)');
  // Consumables during the boss fight (strength + guard from the belt).
  await a.js('__tj.E.tj_item_add(21, 1); __tj.E.tj_item_add(22, 1); __tj.useItem(21); __tj.E.tj_tick(); for (let i = 0; i < 45; i++) __tj.E.tj_tick(); __tj.useItem(22); 1');
  assert(await a.js('__tj.E.tj_state(41) >= 30 && __tj.E.tj_state(42) >= 25'), 'buffs active in the fight');
  // Phase 1: wait for a charge telegraph.
  await a.js(`(() => { const E = __tj.E; E.tj_teleport(${32 * T}, ${90.5 * T}); for (let i = 0; i < 400 && E.tj_enemy(${boss}, 15) !== 1; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  await a.shot('map03-06-boss-charge');
  assert.equal(await a.js(`__tj.E.tj_enemy(${boss}, 14)`), 1, 'phase 1 (mounted)');
  // Phase 2: on foot, the golden armour deflects frontal blows.
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 40 && E.tj_enemy(${boss}, 14) < 2; i++) { E.tj_enemy_damage(${boss}, 30, 0); E.tj_heal(100); __tj.step(4); } for (let i = 0; i < 120; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  assert.equal(await a.js(`__tj.E.tj_enemy(${boss}, 14)`), 2, 'phase 2 (on foot)');
  const front = await a.js(`(() => { const E = __tj.E, i = ${boss}; for (let k = 0; k < 200 && E.tj_enemy(i, 15) !== 0; k++) { E.tj_heal(100); __tj.step(1); }
    const f = E.tj_enemy(i, 7), D = [[0,-1],[.7,-.7],[1,0],[.7,.7],[0,1],[-.7,.7],[-1,0],[-.7,-.7]][f], bx = E.tj_enemy(i, 2) / 1000, by = E.tj_enemy(i, 3) / 1000;
    E.tj_teleport(Math.round(bx + D[0] * 16), Math.round(by + D[1] * 16)); const hp = E.tj_enemy(i, 0);
    E.tj_enemy_damage(i, 25, 0); return [hp, E.tj_enemy(i, 0)]; })()`);
  assert.equal(front[1], front[0], 'a frontal blow is deflected by the golden armour');
  const back = await a.js(`(() => { const E = __tj.E, i = ${boss}; const f = E.tj_enemy(i, 7), D = [[0,-1],[.7,-.7],[1,0],[.7,.7],[0,1],[-.7,.7],[-1,0],[-.7,-.7]][f], bx = E.tj_enemy(i, 2) / 1000, by = E.tj_enemy(i, 3) / 1000;
    E.tj_teleport(Math.round(bx - D[0] * 16), Math.round(by - D[1] * 16)); const hp = E.tj_enemy(i, 0); E.tj_enemy_damage(i, 25, 0); return [hp, E.tj_enemy(i, 0)]; })()`);
  assert(back[1] < back[0], 'a blow from behind lands');
  await a.shot('map03-07-boss-guard');
  // Phase 3: mirror illusions; a blow shatters one.
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 60 && E.tj_enemy(${boss}, 14) < 3; i++) { const f = E.tj_enemy(${boss}, 7), D = [[0,-1],[.7,-.7],[1,0],[.7,.7],[0,1],[-.7,.7],[-1,0],[-.7,-.7]][f];
      E.tj_teleport(Math.round(E.tj_enemy(${boss}, 2) / 1000 - D[0] * 16), Math.round(E.tj_enemy(${boss}, 3) / 1000 - D[1] * 16)); E.tj_enemy_damage(${boss}, 30, 0); E.tj_heal(100); __tj.step(3); }
      for (let i = 0; i < 130; i++) { E.tj_heal(100); __tj.step(1); } })()`);
  assert.equal(await a.js(`__tj.E.tj_enemy(${boss}, 14)`), 3, 'phase 3');
  assert.equal(await a.js(`__tj.E.tj_enemy(${boss}, 16)`), 6, 'two mirror illusions');
  await a.shot('map03-08-boss-illusions');
  await groupKill(a, 7);
  // Kill the rider (the engine keeps him alive; the story frees Bexary).
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 80 && E.tj_enemy(${boss}, 0) > 0; i++) { const f = E.tj_enemy(${boss}, 7), D = [[0,-1],[.7,-.7],[1,0],[.7,.7],[0,1],[-.7,.7],[-1,0],[-.7,-.7]][f];
      E.tj_teleport(Math.round(E.tj_enemy(${boss}, 2) / 1000 - D[0] * 16), Math.round(E.tj_enemy(${boss}, 3) / 1000 - D[1] * 16)); E.tj_enemy_damage(${boss}, 30, 0); E.tj_heal(100); __tj.step(3); } __tj.step(20); })()`);
  await a.shot('map03-09-boss-down');
  await settle(a);
  assert(await flag(a, 'freed'), 'Bexary freed');
  // 9. Zulmat's mirror: final trial, the missing return
  await use(a, 'mirroraltar');
  assert(await flag(a, 'mirror')); assert(await a.js('!!__tj.G.flags.quiz.saka_final'));
  await a.shot('map03-10-mirror-freed');
  // 10. The verdict
  await use(a, 'stairsup');
  await a.wait('__tj.E.tj_state(35) === 0'); await delay(300);
  await a.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos.assembly; __tj.E.tj_teleport(x, y + 14); __tj.E.tj_face(0); __tj.step(3); })()`);
  await a.press('KeyE', 'e');
  await a.wait('__tj.cine === "verdict"'); await delay(3000); await a.shot('map03-11-verdict'); await settle(a);
  assert(await flag(a, 'verdict'));
  assert.equal(await a.js('__tj.E.tj_item_count(8)'), 1, 'Shezhire page 3');
  // 11. Home to the camp, results
  await a.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos.sakagate; __tj.E.tj_teleport(x, y + 14); __tj.E.tj_face(0); __tj.step(3); })()`);
  await a.press('KeyE', 'e');
  await a.wait('__tj.cine === "home"', 8000); await delay(1500); await a.shot('map03-12-home');
  await a.js('__tj.skipCutscene()');
  for (let i = 0; i < 200 && !(await a.js('__tj.panelOpen && !!document.querySelector("#retry-epoch, #go-camp")')); i++) { await a.js('__tj.advanceDialog()'); await delay(60); }
  await a.shot('map03-13-result');
  const res = await a.js(`({score: document.querySelector('.verdict .big')?.textContent, pass: !!document.querySelector('#go-camp'), secrets: __tj.LV.secretsFound(__tj.G.flags), page: __tj.LV.pageLines(__tj.G.flags), area: __tj.E.tj_state(35)})`);
  assert.equal(res.score, '100 / 100'); assert(res.pass); assert.equal(res.secrets, 6); assert.equal(res.page, 4); assert.equal(res.area, 2, 'back in the camp');
  assert.deepEqual([...new Set(seenTrials)].sort(), Object.keys(KEY).sort(), 'all eight trials played');
  assert.deepEqual(a.errors, [], 'no page errors');
  console.log('MAP03 browser check passed:', JSON.stringify(res), 'trials', seenTrials.length, 'choices', seenChoices.length, 'assembly choice', CHOICE.assembly);
} finally { try { ws?.close(); } catch {} child.kill(); }

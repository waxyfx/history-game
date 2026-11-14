// End-to-end browser check for MAP02 «Күлге көмілген шындық» (headless Chrome/Edge over CDP).
// Usage: npm run dev, then: node scripts/check-map02-browser.mjs http://127.0.0.1:5173
// Checks the MAP01 lock, then plays the whole level: arrival, accusation, investigation (witnesses,
// clues, trials without verdicts), sanctuary shades, trapdoor, murals, smith + Zulmat, tablet + final
// trial, the keeper boss (phases), rekindling, all six secrets, save/load, and the Saka transition.
import {spawn} from 'node:child_process';
import {access, mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {TEMP_UNLOCK_ALL} from '../src/rpg/levels.js';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const candidates = process.env.BROWSER_EXE ? [process.env.BROWSER_EXE] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
let exe; for (const c of candidates) { try { await access(c); exe = c; break; } catch {} }
assert(exe, 'Set BROWSER_EXE to an installed Chromium browser');
const profile = await mkdtemp(join(tmpdir(), 'tarikh-map02-'));
const child = spawn(exe, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore', windowsHide: true});
await mkdir('test-results', {recursive: true});
let port, ws;
// QA answer key (matches supabase/migrations/008_bronze_age.sql).
const KEY = {bronze_metal: 1, bronze_economy: 2, bronze_burial: 0, bronze_tablet: 1, bronze_casting: 2, bronze_mausoleum: 1, bronze_tin: 3};
const T = 16;
async function open(url, {w = 1600, h = 900} = {}) {
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
  await call('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: false});
  await call('Page.navigate', {url});
  return {call, js, wait, press, key, shot, errors, nav: u => call('Page.navigate', {url: u})};
}
const seenTrials = [];
const settle = async (p, {maxMs = 40000} = {}) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await p.js(`({c: __tj.cine, d: __tj.dialog, p: __tj.panelOpen, opt: !!document.querySelector('#panel-card [data-opt]:not(:disabled)'),
      close: !!document.querySelector('#panel-card [data-close]:not([hidden])'), trial: document.querySelector('#panel-card [data-trial]')?.dataset.trial || null,
      verdict: /Дұрыс!|Қате|✓|✗/.test(document.querySelector('#panel-card')?.textContent || '')})`);
    if (s.c) await p.js('__tj.skipCutscene()');
    if (s.d) { await p.js('__tj.advanceDialog()'); await delay(25); continue; }
    if (s.p) {
      if (s.opt && s.trial) {
        assert(!s.verdict, 'no verdict is shown during a trial: ' + s.trial);
        seenTrials.push(s.trial);
        await p.js(`document.querySelector('#panel-card [data-opt="${KEY[s.trial] ?? 0}"]').click()`);
      } else if (s.close) await p.js(`document.querySelector('#panel-card [data-close]:not([hidden])').click()`);
      await delay(80); continue;
    }
    if (!s.c && !s.d && !s.p) { await delay(220); if (!(await p.js('!!(__tj.cine || __tj.dialog || __tj.panelOpen)'))) return; }
    await delay(50);
  }
  throw new Error('UI did not settle');
};
// Stand south of an interactable, face north and press (or hold) E.
async function use(p, name, {hold = 0, dy = 14, dx = 0, face = 0} = {}) {
  await p.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos[${JSON.stringify(name)}]; __tj.E.tj_teleport(Math.round(x + ${dx}), Math.round(y + ${dy})); __tj.E.tj_face(${face}); __tj.step(3); })()`);
  if (hold) { await p.key('KeyE', 'e', 'keyDown'); await p.js(`__tj.step(${hold})`); await p.key('KeyE', 'e', 'keyUp'); }
  else await p.press('KeyE', 'e');
  await delay(160); await settle(p);
}
async function talk(p, npc) {
  await p.js(`(() => { const i = __tj.LV.MAP.npcs.indexOf(${JSON.stringify(npc)}); const E = __tj.E; E.tj_teleport(E.tj_npc(i, 0), E.tj_npc(i, 1) + 14); E.tj_face(0); __tj.step(2); })()`);
  await p.press('KeyE', 'e'); await delay(160); await settle(p);
}
const flag = (p, k) => p.js(`!!__tj.G.flags.b.${k}`);
const groupKill = (p, g) => p.js(`(() => { const E = __tj.E, L = __tj.LV.MAP.enemies; for (let r = 0; r < 80; r++) { let any = false; L.forEach((e, i) => { if (e.group === ${g} && E.tj_enemy(i, 0) > 0) { any = true; E.tj_enemy_damage(i, 40, 0); } }); E.tj_heal(100); __tj.step(12); if (!any) break; } return L.filter((e, i) => e.group === ${g} && E.tj_enemy(i, 0) > 0).length; })()`);

try {
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  assert(port, 'Browser launch failed');
  // 0. Lock: MAP02 is closed until MAP01 is passed (no local pass, signed out).
  const a = await open(base + '/rpg.html?level=2');
  if (!TEMP_UNLOCK_ALL) {   // the lock is temporarily lifted for QA (src/rpg/levels.js)
    await a.wait(`document.querySelector('#panel-card')?.textContent.includes('MAP 01')`);
    assert(!(await a.js('!!window.__tj')), 'locked level does not start the game');
    await a.shot('map02-00-locked');
  } else await a.wait('window.__tj && __tj.E');
  await a.js(`localStorage.setItem('tarikh.introLang', 'kk'); localStorage.setItem('tarikh.rpg.results', JSON.stringify([{map: 1, t0: 1, at: '2026-01-01', score: 92, passed: true, party: 1}])); 1`);
  await a.nav(base + '/rpg.html?level=2&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 2');
  assert.equal(await a.js('location.search'), '?level=2', 'level stays in the URL');
  // 1. Arrival.
  await a.wait('__tj.cine === "arrival"'); await delay(2600); await a.shot('map02-01-arrival');
  await settle(a);
  assert(await flag(a, 'arrived'));
  assert(await a.js('__tj.E.tj_item_count(2) === 1 && __tj.E.tj_item_count(3) === 1 && __tj.E.tj_item_count(4) >= 12'), 'kit granted');
  // Armed raiders on the road (group 2): a real fight with the sword.
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 60 && E.tj_enemy(2, 0) > 0; i++) { const ex = E.tj_enemy(2, 2) / 1000, ey = E.tj_enemy(2, 3) / 1000; E.tj_teleport(Math.round(ex - 16), Math.round(ey)); E.tj_face(2); E.tj_heal(100); E.tj_input(32); __tj.step(2); E.tj_input(0); __tj.step(24); } })()`);
  await a.shot('map02-02-raiders');
  assert.equal(await a.js('__tj.E.tj_enemy(2, 0)'), 0, 'raider defeated in melee');
  await groupKill(a, 2);
  // 2. Accusation in the square.
  await a.js(`__tj.E.tj_teleport(${42.5 * T}, ${32.5 * T}); __tj.step(4)`);
  await a.wait('__tj.cine === "accuse"'); await delay(3800); await a.shot('map02-03-accusation');
  await settle(a); assert(await flag(a, 'village'));
  // 3. Forge cutscene, then the investigation.
  await a.js(`__tj.E.tj_teleport(${66 * T}, ${31 * T}); __tj.step(4)`);
  await a.wait('__tj.cine === "forge"'); await delay(2500); await a.shot('map02-04-forge');
  await settle(a); assert(await flag(a, 'forgeSeen'));
  await use(a, 'brokenaxe');
  assert(await a.js('!!__tj.G.flags.quiz.bronze_metal'), 'axe trial');
  for (const w of ['guard', 'shepherd', 'grainkeeper', 'villager1', 'villager2']) await talk(a, w);
  for (const c of ['hearth', 'forgetrack', 'bracelet', 'doorsymbol']) await use(a, c);
  await use(a, 'granary');
  assert.deepEqual(await a.js('[__tj.G.flags.talked.length, __tj.G.flags.tracks.length]'), [5, 4]);
  assert.equal(await a.js('__tj.E.tj_item_count(19)'), 1, 'bracelet clue item');
  await talk(a, 'elder');
  assert(await flag(a, 'elderClue'), 'report to the elder');
  // 4. Sanctuary: shades guard the missing villagers.
  await a.js(`__tj.E.tj_teleport(${51 * T}, ${15 * T}); __tj.step(4)`); await a.js(`__tj.E.tj_teleport(${51 * T}, ${13.2 * T}); __tj.step(4)`);
  await settle(a); await a.js('__tj.step(60)'); await a.shot('map02-05-shades');
  assert.equal(await groupKill(a, 3), 0, 'shades dispelled');
  await delay(200); await settle(a);
  assert(await flag(a, 'freed'), 'missing villagers freed');
  await use(a, 'cist');
  assert(await a.js('!!__tj.G.flags.quiz.bronze_burial'), 'cist trial: ' + await a.js('JSON.stringify([__tj.E.tj_state(25), __tj.E.tj_state(26), __tj.E.tj_state(0), __tj.E.tj_state(1)])'));
  await use(a, 'pgaibar');
  // 5. Secrets on the surface: record under the loose stone, hidden workshop, mausoleum (wolves guard the burial ground).
  await use(a, 'secretnote');
  await use(a, 'sheafstack', {hold: 120, dx: -18, dy: 0, face: 2});
  await a.js(`__tj.E.tj_teleport(${63 * T}, ${55 * T}); __tj.step(6)`); await settle(a);
  await use(a, 'hiddenmould');
  await a.js(`__tj.E.tj_teleport(${80 * T}, ${50 * T}); __tj.step(6)`); await settle(a);
  await groupKill(a, 1);
  await use(a, 'mausoleum', {dy: 20});
  await a.shot('map02-06-burial');
  // Save/load round trip mid-level.
  assert(await a.js('__tj.save(true)'));
  const before = await a.js('JSON.stringify([__tj.G.flags.b, __tj.E.tj_item_count(17)])');
  await a.js('__tj.load(true)');
  assert.equal(await a.js('JSON.stringify([__tj.G.flags.b, __tj.E.tj_item_count(17)])'), before, 'save/load keeps MAP02 state');
  // 6. Discovery: the trapdoor under the forge.
  await use(a, 'trapdoor', {hold: 160});
  await a.wait('__tj.G.flags.b.under'); await settle(a);
  assert(await flag(a, 'under')); assert.equal(await a.js('__tj.E.tj_state(35)'), 1, 'underground area');
  await a.shot('map02-07-underground');
  // 7. Murals -> smith -> Zulmat.
  await groupKill(a, 4);
  for (const m of ['mural1', 'mural2', 'mural3']) await use(a, m);
  await use(a, 'mural4');
  await a.wait('__tj.cine === "smith" || __tj.cine === "zulmat" || __tj.G.flags.b.smithTalk');
  await delay(1800); await a.shot('map02-08-smith');
  for (let i = 0; i < 40 && !(await a.js('__tj.cine === "zulmat"')) && !(await flag(a, 'smithTalk')); i++) { await a.js('__tj.advanceDialog()'); await delay(150); }
  if (await a.js('__tj.cine === "zulmat"')) {
    for (let i = 0; i < 6; i++) { await a.js('__tj.advanceDialog()'); await delay(400); }
    await a.shot('map02-09-zulmat');
  }
  await settle(a); assert(await flag(a, 'smithTalk'));
  // Secret room behind the ash wall: Institute symbol + tin trial.
  await use(a, 'ashwall', {hold: 160, dx: 18, dy: 0, face: 6});
  assert(await flag(a, 'ashwall'));
  await use(a, 'instpillar'); await use(a, 'tinstone');
  // 8. Tablet + final trial (Zulmat's distortion).
  await use(a, 'tablet');
  await settle(a);
  assert(await flag(a, 'tabletSeen')); assert(await a.js('!!__tj.G.flags.quiz.bronze_tablet'));
  // 9. Boss: phases, telegraphs, health bar, death.
  await a.js(`__tj.E.tj_teleport(${44 * T}, ${87 * T}); __tj.step(4)`);
  await a.wait('__tj.cine === "boss"'); await delay(1500); await settle(a);
  const boss = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 6)');
  await a.js(`(() => { const E = __tj.E; E.tj_teleport(${44 * T}, ${88.4 * T}); for (let i = 0; i < 160; i++) { E.tj_heal(100); __tj.step(2); } })()`);
  await a.shot('map02-10-boss-phase1');
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 40 && E.tj_enemy(${boss}, 0) > 380; i++) { E.tj_enemy_damage(${boss}, 30, 0); E.tj_heal(100); __tj.step(6); } for (let i = 0; i < 120; i++) { E.tj_heal(100); __tj.step(2); } })()`);
  assert(await a.js(`__tj.E.tj_enemy(${boss}, 14) >= 2`), 'phase 2 reached');
  await a.shot('map02-11-boss-phase2');
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 40 && E.tj_enemy(${boss}, 0) > 150; i++) { E.tj_enemy_damage(${boss}, 30, 0); E.tj_heal(100); __tj.step(6); } for (let i = 0; i < 140; i++) { E.tj_heal(100); __tj.step(2); } })()`);
  assert(await a.js(`__tj.E.tj_enemy(${boss}, 14) >= 3`), 'phase 3 reached');
  await a.shot('map02-12-boss-phase3');
  await a.js(`(() => { const E = __tj.E; for (let i = 0; i < 60 && E.tj_enemy(${boss}, 0) > 0; i++) { E.tj_enemy_damage(${boss}, 40, 0); E.tj_heal(100); __tj.step(6); } __tj.step(30); })()`);
  await a.shot('map02-13-boss-death');
  await settle(a); await groupKill(a, 6);
  assert(await flag(a, 'keeper'), 'keeper defeated');
  await use(a, 'keeperfire');
  assert(await flag(a, 'ember')); assert.equal(await a.js('__tj.E.tj_item_count(16)'), 1);
  // 10. Rekindle the hearth, then the Saka gate.
  await use(a, 'stairsup');
  assert.equal(await a.js('__tj.E.tj_state(35)'), 0, 'back on the surface');
  await use(a, 'hearth');
  await a.wait('__tj.cine === "rekindle" || __tj.G.flags.b.rekindled');
  await delay(3200); await a.shot('map02-14-rekindle');
  await settle(a);
  assert(await flag(a, 'rekindled')); assert.equal(await a.js('__tj.E.tj_item_count(8)'), 1, 'Shezhire page');
  await a.js('__tj.step(30)'); await a.shot('map02-15-village-lit');
  await a.js(`(() => { const [x, y] = __tj.LV.MAP.interactPos.sakagate; __tj.E.tj_teleport(x, y + 14); __tj.E.tj_face(0); __tj.step(3); })()`);
  await a.press('KeyE', 'e');
  await a.wait('__tj.cine === "saka"'); await delay(2500); await a.shot('map02-16-saka');
  await a.js('__tj.skipCutscene()');
  for (let i = 0; i < 200 && !(await a.js('__tj.panelOpen && !!document.querySelector("#retry-epoch, #go-camp")')); i++) { await a.js('__tj.advanceDialog()'); await delay(60); }
  await a.shot('map02-17-result');
  const res = await a.js(`({score: document.querySelector('.verdict .big')?.textContent, pass: !!document.querySelector('#go-camp'), secrets: __tj.LV.secretsFound(__tj.G.flags), page: __tj.LV.pageLines(__tj.G.flags)})`);
  assert.equal(res.score, '100 / 100'); assert(res.pass); assert.equal(res.secrets, 6); assert.equal(res.page, 4);
  await a.js(`document.querySelector('#open-journal').click()`); await delay(200); await a.shot('map02-18-journal');
  assert.deepEqual([...new Set(seenTrials)].sort(), Object.keys(KEY).sort(), 'all seven trials were played');
  const hist = await a.js(`JSON.parse(localStorage.getItem('tarikh.rpg.results')).filter(h => h.map === 2)`);
  assert(hist.length === 1 && hist[0].passed, 'MAP02 result stored');
  assert.deepEqual(a.errors, [], 'no page errors');
  console.log('MAP02 browser check passed:', JSON.stringify(res), 'trials', seenTrials.length);
} finally { try { ws?.close(); } catch {} child.kill(); }

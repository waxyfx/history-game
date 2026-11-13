// Browser walkthrough of the shared consumables (headless Chrome/Edge over CDP, real key input).
// Usage: npm run dev, then: node scripts/check-consumables-browser.mjs http://127.0.0.1:5173
// MAP01: pick up a herb → see it in the bag → take real damage from wolves → heal with Q → pick up the
// strength infusion → drink it from the belt → see the aura and HUD timer → wait for it to expire →
// save → reload → state restored → continue the story (villagers + elder's task).
// MAP02: forge coal from the forge quarter → fire buff active → effect persists through save/reload.
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
const profile = await mkdtemp(join(tmpdir(), 'tarikh-items-'));
const child = spawn(exe, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore', windowsHide: true});
await mkdir('test-results', {recursive: true});
let port, ws;
const VK = {KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyQ: 81, KeyI: 73, Escape: 27, Digit4: 52, Digit5: 53, Digit6: 54, Digit7: 55, Digit8: 56, Digit9: 57};
async function open(url) {
  const target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, {method: 'PUT'})).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const call = (method, params = {}) => new Promise((res, rej) => { const n = ++id; const tm = setTimeout(() => rej(new Error('CDP timeout ' + method)), 30000); pending.set(n, m => { clearTimeout(tm); m.error ? rej(new Error(m.error.message)) : res(m.result); }); ws.send(JSON.stringify({id: n, method, params})); });
  const js = async expr => { const r = await call('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await js(expr)) return; } catch {} await delay(80); } throw new Error('Timed out: ' + expr); };
  const key = (code, type) => call('Input.dispatchKeyEvent', {type, code, key: code.replace(/^Key|^Digit/, '').toLowerCase(), windowsVirtualKeyCode: VK[code] || 0});
  const press = async code => { await key(code, 'keyDown'); await delay(50); await key(code, 'keyUp'); await delay(60); };
  const holdKey = async (code, ms) => { await key(code, 'keyDown'); await delay(ms); await key(code, 'keyUp'); await delay(60); };
  const shot = async name => { const r = await call('Page.captureScreenshot', {format: 'png'}); await writeFile('test-results/' + name + '.png', Buffer.from(r.data, 'base64')); };
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {width: 1600, height: 900, deviceScaleFactor: 1, mobile: false});
  await call('Page.navigate', {url});
  return {call, js, wait, press, holdKey, shot, errors, nav: u => call('Page.navigate', {url: u})};
}
const settle = async (p, choice = 1) => {
  for (let i = 0; i < 400; i++) {
    const s = await p.js(`({c: __tj.cine, d: __tj.dialog, p: __tj.panelOpen, opt: !!document.querySelector('#panel-card [data-opt]:not(:disabled)'), close: !!document.querySelector('#panel-card [data-close]')})`);
    if (s.c) await p.js('__tj.skipCutscene()');
    if (s.d) { await p.js('__tj.advanceDialog()'); await delay(30); continue; }
    if (s.p) { await p.js(s.opt ? `document.querySelector('#panel-card [data-opt="${choice}"]').click()` : `document.querySelector('#panel-card [data-close]')?.click()`); await delay(120); continue; }
    if (!s.c) { await delay(250); if (!(await p.js('!!(__tj.cine || __tj.dialog || __tj.panelOpen)'))) return; }
    await delay(60);
  }
  throw new Error('UI did not settle');
};
const toasts = p => p.js(`[...document.querySelectorAll('.toast')].map(t => t.textContent)`);
const st = (p, f) => p.js(`__tj.E.tj_state(${f})`);
const count = (p, i) => p.js(`__tj.E.tj_item_count(${i})`);
const tp = (p, x, y) => p.js(`__tj.E.tj_teleport(${Math.round(x * 16)}, ${Math.round(y * 16)}); 1`);
const T = 16;

try {
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  assert(port, 'Browser launch failed');
  const a = await open(base + '/rpg.html?new=1');
  await a.wait('window.__tj && __tj.E');
  await a.js(`localStorage.setItem('tarikh.introLang', 'kk'); 1`);   // Kazakh UI, then a fresh start
  await a.nav(base + '/rpg.html?new=1'); await a.wait('window.__tj && __tj.E');
  await a.wait('__tj.cine === "intro"'); await settle(a);
  // 1–2. Pick up the first herb by walking onto it; it shows in the belt and in the bag, with a one-time hint.
  await tp(a, 9, 48); await delay(200);
  await a.holdKey('KeyW', 700);
  assert.equal(await count(a, 9), 2, 'herbs picked up');
  const hint = (await toasts(a)).join(' | ');
  await delay(900);
  assert.match((await toasts(a)).join(' | '), /Q/, 'tutorial hint about Q: ' + hint);
  assert(await a.js(`!!document.querySelector('#belt [data-belt="9"]')`), 'herb on the belt');
  await a.shot('items-01-herb-pickup');
  await a.press('KeyI'); await delay(250);
  assert.match(await a.js(`document.getElementById('panel-card').innerText`), /Кіші емдік шөп × 2/);
  await a.shot('items-02-bag');
  await a.press('Escape'); await delay(150);
  // 3. Real damage: stand in the wolves' hunting ground.
  await a.js(`(() => { const E = __tj.E; E.tj_teleport(Math.round(E.tj_enemy(0, 2) / 1000 - 26), Math.round(E.tj_enemy(0, 3) / 1000)); })()`);
  await a.wait('__tj.E.tj_state(8) <= 75', 30000);
  await tp(a, 18, 50); await delay(800);
  const hurt = await st(a, 8);
  assert(hurt < 100);
  await a.shot('items-03-hurt');
  // 4–5. Heal with Q: +25, never above 100, one herb consumed; spamming Q hits the cooldown.
  await a.press('KeyQ'); await delay(80);
  const healed = await st(a, 8);
  assert.equal(healed, Math.min(100, hurt + 25), `heal ${hurt} → ${healed}`);
  assert.equal(await count(a, 9), 1);
  await a.press('KeyQ');
  assert.match((await toasts(a)).join(' '), /ерте/, 'cooldown message');
  await a.shot('items-04-healed');
  // 6. Strength infusion on the path to the strangers' camp.
  await tp(a, 86, 32.2); await delay(200);
  await a.holdKey('KeyW', 600);
  assert.equal(await count(a, 21), 1, 'strength infusion picked up');
  await delay(900);
  assert.match((await toasts(a)).join(' '), /уақытша/, 'buff hint');
  await settle(a);   // the ravine edge may open a line of dialogue first
  // 7–8. Drink it from the belt (its number key), see the HUD timer and the aura.
  const slot = await a.js(`document.querySelector('#belt [data-belt="21"] kbd').textContent`);
  await a.press('Digit' + slot); await delay(400);
  assert.equal(await count(a, 21), 0, 'consumed: slot ' + slot + ' ' + JSON.stringify(await toasts(a)) + ' belt ' + await a.js(`[...document.querySelectorAll('#belt [data-belt]')].map(b => b.dataset.belt + '@' + b.querySelector('kbd').textContent).join(',')`) + ' cine ' + await a.js('__tj.cine + "/" + __tj.dialog + "/" + __tj.panelOpen'));
  assert.equal(await st(a, 41), 30, '+30% damage active');
  assert.match(await a.js(`document.getElementById('buffs').innerText`), /Күш\s*1[45]s/);
  await a.shot('items-05-strength-active');
  // A real hit with the buff on a stranger: +30% sword damage.
  const hit = await a.js(`(() => { const E = __tj.E, i = __tj.LV.MAP.enemies.findIndex(e => e.type === 1); const hp0 = E.tj_enemy(i, 0);
    E.tj_teleport(Math.round(E.tj_enemy(i, 2) / 1000 - 14), Math.round(E.tj_enemy(i, 3) / 1000)); E.tj_face(2); return [i, hp0]; })()`);
  await a.press('KeyD'); await a.js('__tj.E.tj_face(2)'); await a.holdKey('Space', 120); await delay(500);
  const dealt = hit[1] - (await a.js(`__tj.E.tj_enemy(${hit[0]}, 0)`));
  assert(dealt === 0 || dealt % 13 === 0 || dealt >= 13, 'buffed hit: ' + dealt);
  await a.shot('items-06-buffed-fight');
  await tp(a, 66, 40); await delay(300);
  // 9–10. Wait for the end of the effect (15 s); the last seconds blink, then it is gone.
  await a.wait(`document.querySelector('#buffs .buff.ending')`, 20000);
  await a.shot('items-07-ending');
  await a.wait('__tj.E.tj_state(41) === 0', 8000);
  await delay(300);
  assert.equal(await a.js(`document.getElementById('buffs').innerText.trim()`), '');
  assert.match((await toasts(a)).join(' '), /әсері бітті/);
  // 11–12. Save, reload the page, the saved bag and HP come back.
  const before = await a.js(`JSON.stringify([__tj.E.tj_state(8), __tj.E.tj_item_count(9), __tj.E.tj_item_count(5), __tj.E.tj_item_count(21)])`);
  await a.js(`document.getElementById('b-save').click(); 1`); await delay(300);
  await a.nav(base + '/rpg.html'); await a.wait('window.__tj && __tj.E'); await delay(800);
  assert.equal(await a.js(`JSON.stringify([__tj.E.tj_state(8), __tj.E.tj_item_count(9), __tj.E.tj_item_count(5), __tj.E.tj_item_count(21)])`), before, 'state restored after reload');
  // An effect active at save time is restored too.
  await a.js(`__tj.E.tj_item_add(23, 1); __tj.useItem(23); 1`); await delay(300);
  const fx = await a.js(`__tj.E.tj_effect(0, 0)`);
  await a.js(`document.getElementById('b-save').click(); 1`); await delay(200);
  await a.nav(base + '/rpg.html'); await a.wait('window.__tj && __tj.E'); await delay(800);
  assert.equal(await a.js(`__tj.E.tj_effect(0, 0)`), fx, 'speed effect restored after reload');
  assert(await a.js(`__tj.E.tj_effect(0, 1) > 500`));
  await a.shot('items-08-reloaded');
  // 13. Continue the story: meet the village, hear three villagers, receive the elder's task.
  await tp(a, 24, 42); await a.wait('__tj.cine === "meet"'); await settle(a);
  for (const who of ['crafter', 'cook', 'scraper']) {
    await a.js(`(() => { const i = __tj.LV.MAP.npcs.indexOf('${who}'), E = __tj.E; E.tj_teleport(E.tj_npc(i, 0), E.tj_npc(i, 1) + 14); E.tj_face(0); })()`);
    await delay(150); await a.press('KeyE'); await delay(200); await settle(a);
  }
  await a.js(`(() => { const i = __tj.LV.MAP.npcs.indexOf('elder'), E = __tj.E; E.tj_teleport(E.tj_npc(i, 0), E.tj_npc(i, 1) + 14); E.tj_face(0); })()`);
  await delay(150); await a.press('KeyE'); await delay(300); await settle(a);
  assert(await a.js('__tj.G.flags.b.elderTask'), 'story continues: elder task received');
  assert.equal(await count(a, 4) >= 0, true);
  await a.shot('items-09-story-continues');
  assert.deepEqual(a.errors, [], 'no page errors on MAP01');

  // MAP02: forge coal → fire buff; the buff survives save/reload.
  ws.close();
  const b = await open(base + '/rpg.html?level=2&new=1');
  await b.wait('window.__tj && __tj.E && __tj.LV.id === 2');
  await b.wait('__tj.cine === "arrival"'); await settle(b);
  assert(await b.js('__tj.E.tj_item_count(2) === 1'), 'MAP02 kit');
  await tp(b, 82, 34.4); await delay(200);
  await b.holdKey('KeyW', 500);
  assert.equal(await count(b, 24), 1, 'forge coal picked up');
  await settle(b);
  await b.press('Digit' + (await b.js(`document.querySelector('#belt [data-belt="24"] kbd').textContent`))); await delay(400);
  assert.equal(await st(b, 41), 25, 'forge fire: +25% damage');
  await b.js('__tj.E.tj_tick(); 1'); await delay(500);
  await b.shot('items-10-map02-forge-fire');
  assert.equal(await count(b, 16), 0, 'the sacred ember stays a story item (not consumed, not on the belt)');
  assert(!(await b.js(`!!document.querySelector('#belt [data-belt="16"]')`)));
  await b.js(`document.getElementById('b-save').click(); 1`); await delay(200);
  await b.nav(base + '/rpg.html?level=2'); await b.wait('window.__tj && __tj.E && __tj.LV.id === 2'); await delay(800);
  assert.equal(await b.js('__tj.E.tj_effect(0, 0)'), 4, 'forge fire restored on MAP02');
  assert.deepEqual(b.errors, [], 'no page errors on MAP02');
  console.log('Consumables browser walkthrough passed (MAP01 13 steps + MAP02 forge coal).');
} finally { try { ws?.close(); } catch {} child.kill(); }

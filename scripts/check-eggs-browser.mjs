// Team easter eggs MAP01–MAP04 (MAP05's is covered by check-map05-browser.mjs): the loose rock gives a hint on a
// tap and opens on a hold; the MAP03 board rejects a wrong move and opens on mate; each find is saved in the level
// flags and in the shared collection; reload keeps it; progress, score and secrets are untouched. Muted.
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
const profile = await mkdtemp(join(tmpdir(), 'tarikh-eggs-'));
const child = spawn(exe, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', 'about:blank'], {stdio: 'ignore', windowsHide: true});
await mkdir('test-results', {recursive: true});
let port, ws;
async function open() {
  const target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, {method: 'PUT'})).json();
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args.map(a => a.value ?? a.description)));
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const call = (method, params = {}) => new Promise((res, rej) => { const n = ++id; const tm = setTimeout(() => rej(new Error('CDP timeout ' + method)), 30000); pending.set(n, m => { clearTimeout(tm); m.error ? rej(new Error(m.error.message)) : res(m.result); }); ws.send(JSON.stringify({id: n, method, params})); });
  const js = async expr => { const r = await call('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await js(expr)) return; } catch {} await delay(80); } throw new Error('Timed out: ' + expr); };
  const key = (code, k, type) => call('Input.dispatchKeyEvent', {type, code, key: k, windowsVirtualKeyCode: {KeyE: 69}[code] || 0});
  const press = async (code, k) => { await key(code, k, 'keyDown'); await delay(40); await key(code, k, 'keyUp'); };
  const shot = async name => { const r = await call('Page.captureScreenshot', {format: 'png'}); await writeFile('test-results/' + name + '.png', Buffer.from(r.data, 'base64')); };
  await call('Runtime.enable'); await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {width: 1366, height: 768, deviceScaleFactor: 1, mobile: false});
  return {call, js, wait, press, key, shot, errors, nav: u => call('Page.navigate', {url: u})};
}
let lastChoice = null;
const settle = async (p, pick = 0) => {
  for (let n = 0; n < 400; n++) {
    const s = await p.js(`({c: __tj.cine, d: __tj.dialog, p: __tj.panelOpen, choice: !!document.querySelector('#panel-card [data-choice]'), opt: !!document.querySelector('#panel-card [data-opt]:not(:disabled)'), close: !!document.querySelector('#panel-card [data-close]:not([hidden])')})`);
    if (await p.js(`!!document.querySelector('.tj-intro')`)) { await p.press('Escape', 'Escape'); await delay(300); continue; }   // MAP04 opens with its comic
    if (s.c) { await p.js('__tj.skipCutscene()'); await delay(60); continue; }
    if (s.d) { await p.js('__tj.advanceDialog()'); await delay(25); continue; }
    if (s.p) { if (s.choice) { lastChoice = pick; await p.js(`document.querySelector('#panel-card [data-ch="${pick}"]').click()`); } else if (s.opt) await p.js(`document.querySelector('#panel-card [data-opt]:not(:disabled)').click()`); else if (s.close) await p.js(`document.querySelector('#panel-card [data-close]:not([hidden])').click()`); await delay(80); continue; }
    await delay(200); if (!(await p.js('!!(__tj.cine || __tj.dialog || __tj.panelOpen)'))) return;
  }
  throw new Error('UI did not settle');
};
async function use(p, name, {hold = 0, dx = 0, dy = 14, face = 0, pick = 0} = {}) {
  const tp = `(() => { const [x, y] = __tj.LV.MAP.interactPos[${JSON.stringify(name)}]; __tj.E.tj_teleport(Math.round(x + ${dx}), Math.round(y + ${dy})); __tj.E.tj_face(${face}); __tj.step(3); })()`;
  await p.js(tp); await settle(p); await p.js(tp);
  if (hold) { await p.key('KeyE', 'e', 'keyDown'); await p.js(`__tj.step(${hold})`); await p.key('KeyE', 'e', 'keyUp'); } else await p.press('KeyE', 'e');
  await delay(150); await settle(p, pick);
}
const EGGS = [
  {level: 1, crack: 'doomcrack', item: 'doomthrone', open: 'eggDoomOpen', flag: 'eggDoom', id: 'map01', crackAt: {dx: 2, dy: 0, face: 6}},
  {level: 2, crack: 'chipcrack', item: 'gpuplan', open: 'eggChipOpen', flag: 'eggChip', id: 'map02', crackAt: {dx: 2, dy: 0, face: 6}},
  {level: 3, chess: 'chess', item: 'zeromask', open: 'eggChessOpen', flag: 'eggZero', id: 'map03'},
  {level: 4, crack: 'labcrack', item: 'greenportal', open: 'eggLabOpen', flag: 'eggLab', id: 'map04', crackAt: {dx: -2, dy: 0, face: 2}},
];
try {
  for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  const p = await open();
  for (const egg of EGGS) {
    const url = base + '/rpg.html' + (egg.level > 1 ? '?level=' + egg.level + '&new=1' : '?new=1');
    await p.nav(url); await p.wait(`window.__tj && __tj.E && __tj.LV.id === ${egg.level}`, 30000); await delay(1200); await settle(p);
    const before = await p.js('JSON.stringify([__tj.LV.questStage(__tj.G.flags), __tj.LV.scoreOf(__tj.G.flags), __tj.LV.secretsFound(__tj.G.flags)])');
    await p.js('__tj.E.tj_groups(0); 1');   // the egg check is not about combat
    if (egg.crack) {
      await use(p, egg.crack, egg.crackAt);                                   // a tap: only a hint
      assert(!(await p.js(`!!__tj.G.flags.b.${egg.open}`)), egg.id + ': a tap does not open');
      await use(p, egg.crack, {...egg.crackAt, hold: 120});                   // a hold opens
    } else {
      await use(p, egg.chess, {pick: 2});                                     // wrong move
      assert(!(await p.js(`!!__tj.G.flags.b.${egg.open}`)), egg.id + ': wrong move keeps it shut');
      await use(p, egg.chess, {pick: 0});                                     // mate
    }
    assert(await p.js(`!!__tj.G.flags.b.${egg.open}`), egg.id + ': opened');
    await use(p, egg.item);
    assert(await p.js(`!!__tj.G.flags.b.${egg.flag}`), egg.id + ': found');
    await p.shot('egg-' + egg.id);
    assert(await p.js(`JSON.parse(localStorage.getItem('tarikh.anomalies') || '[]').includes('${egg.id}')`), egg.id + ': collected');
    const after = await p.js('JSON.stringify([__tj.LV.questStage(__tj.G.flags), __tj.LV.scoreOf(__tj.G.flags), __tj.LV.secretsFound(__tj.G.flags)])');
    assert.equal(after, before, egg.id + ': progress, score and secrets untouched');
    assert(await p.js('__tj.save(true)')); await p.js('__tj.load(true)');
    assert(await p.js(`!!__tj.G.flags.b.${egg.flag} && !!__tj.G.flags.b.${egg.open}`), egg.id + ': kept after reload');
    // The opened passage is walkable: step from the trigger spot into the room.
    const [ix, iy] = await p.js(`__tj.LV.MAP.interactPos[${JSON.stringify(egg.item)}]`);
    await p.js(`__tj.E.tj_teleport(${ix}, ${iy + 16}); __tj.step(2); 1`);
    console.log('egg', egg.id, 'ok');
  }
  assert.equal(await p.js(`JSON.parse(localStorage.getItem('tarikh.anomalies')).length`), 4);
  assert.deepEqual(p.errors, [], 'no runtime errors');
  console.log('Team eggs browser PASS');
} finally { try { ws?.close(); } catch {} child.kill(); }

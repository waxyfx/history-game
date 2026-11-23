// Shared driver for the per-level browser checks (MAP07–MAP10): a muted headless Chromium over CDP, the real DOM dialogue /
// quiz / choice UI and proximity input; dev hooks (__tj) only accelerate travel and combat. Same protocol as check-map06.
import {spawn} from 'node:child_process';
import {access, mkdtemp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {QA_COOKIES} from './qa-profile.mjs';
export {assert, delay};

export async function launch(name, storyPath, {choice = 0} = {}) {
  const candidates = process.env.BROWSER_EXE ? [process.env.BROWSER_EXE] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  let exe; for (const c of candidates) { try { await access(c); exe = c; break; } catch {} }
  assert(exe, 'Set BROWSER_EXE to an installed Chromium browser');
  const profile = await mkdtemp(join(tmpdir(), `tarikh-${name}-`));
  const child = spawn(exe, ['--headless=new', '--mute-audio', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', 'about:blank'], {stdio: 'ignore', windowsHide: true});
  await mkdir('test-results', {recursive: true});
  let port; for (let i = 0; i < 100 && !port; i++) { try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch { await delay(100); } }
  assert(port, 'Browser launch failed');
  const KEY = Object.fromEntries(Object.values((await import(storyPath)).HISTORICAL_QUIZZES).map(q => [q.id, q.correctIndex]));
  const seen = {trials: [], choices: [], comics: 0};
  const sockets = [];
  async function open(url) {
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
    const call = (method, params = {}) => new Promise((res, rej) => { const n = ++id; const tm = setTimeout(() => rej(new Error('CDP timeout ' + method)), 60000); pending.set(n, m => { clearTimeout(tm); m.error ? rej(new Error(m.error.message)) : res(m.result); }); ws.send(JSON.stringify({id: n, method, params})); });
    const js = async expr => { const r = await call('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const wait = async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await js(expr)) return; } catch {} await delay(80); } throw new Error('Timed out: ' + expr); };
    const key = (code, k, type) => call('Input.dispatchKeyEvent', {type, code, key: k, windowsVirtualKeyCode: {KeyE: 69}[code] || 0});
    const press = async (code, k) => { await key(code, k, 'keyDown'); await delay(40); await key(code, k, 'keyUp'); };
    const shot = async n => { const r = await call('Page.captureScreenshot', {format: 'png'}); await writeFile('test-results/' + n + '.png', Buffer.from(r.data, 'base64')); };
    await call('Runtime.enable'); await call('Page.enable'); await call('Network.setCookies', QA_COOKIES);   // play as the local profile «QA» (scripts/qa-profile.mjs)
    await call('Emulation.setDeviceMetricsOverride', {width: 1600, height: 900, deviceScaleFactor: 1, mobile: false});
    await call('Page.navigate', {url});
    const p = {call, js, wait, press, key, shot, errors};
    Object.assign(p, helpers(p, KEY, seen, choice, name));
    return p;
  }
  return {open, KEY, seen, close: () => { for (const s of sockets) try { s.close(); } catch {} child.kill(); }};
}

function helpers(p, KEY, seen, choice, name) {
  const settle = async ({maxMs = 60000} = {}) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const s = await p.js(`({c: __tj.cine, d: __tj.dialog, p: __tj.panelOpen, comic: !!document.querySelector('.tj-intro'), trial: document.querySelector('#panel-card [data-trial]')?.dataset.trial || null,
        choice: document.querySelector('#panel-card [data-choice]') ? document.querySelector('#panel-card h2').textContent : null,
        opt: !!document.querySelector('#panel-card [data-opt]:not(:disabled)'), close: !!document.querySelector('#panel-card [data-close]:not([hidden])'),
        verdict: /✓|✗|Дұрыс!|Қате/.test(document.querySelector('#panel-card')?.textContent || '')})`);
      if (s.comic) { if (!seen.comics++) { await delay(3500); await p.shot(`${name}-comic`); } await p.press('Escape', 'Escape'); await delay(400); continue; }
      if (s.c) await p.js('__tj.skipCutscene()');
      if (s.d) { await p.js('__tj.advanceDialog()'); await delay(25); continue; }
      if (s.p) {
        if (s.choice) { seen.choices.push(s.choice); await p.js(`document.querySelector('#panel-card [data-ch="${choice}"]').click()`); }
        else if (s.opt && s.trial) { assert(!s.verdict, 'no verdict during a trial'); seen.trials.push(s.trial); await p.js(`document.querySelector('#panel-card [data-opt="${KEY[s.trial] ?? 0}"]').click()`); }
        else if (s.close) await p.js(`document.querySelector('#panel-card [data-close]:not([hidden])').click()`);
        await delay(90); continue;
      }
      if (!s.c && !s.d && !s.p) { await delay(300); if (!(await p.js('!!(__tj.cine || __tj.dialog || __tj.panelOpen || document.querySelector(".tj-intro"))'))) return; }
      await delay(50);
    }
    throw new Error('UI did not settle');
  };
  const use = async (n, {hold = 0, dy = 14, dx = 0, face = 0} = {}) => {
    const tp = steps => `(() => { const [x, y] = __tj.LV.MAP.interactPos[${JSON.stringify(n)}]; __tj.E.tj_teleport(Math.round(x + ${dx}), Math.round(y + ${dy})); __tj.E.tj_face(${face}); __tj.step(${steps}); })()`;
    await p.js(tp(3)); await settle(); await p.js(tp(2));
    if (hold) { await p.key('KeyE', 'e', 'keyDown'); await p.js(`__tj.step(${hold})`); await p.key('KeyE', 'e', 'keyUp'); }
    else await p.press('KeyE', 'e');
    await delay(160); await settle();
  };
  const talk = async npc => {
    const tp = steps => `(() => { const i = __tj.LV.MAP.npcs.indexOf(${JSON.stringify(npc)}); const E = __tj.E; E.tj_teleport(E.tj_npc(i, 0), E.tj_npc(i, 1) + 14); E.tj_face(0); __tj.step(${steps}); })()`;
    await p.js(tp(2)); await settle(); await p.js(tp(1));
    await p.press('KeyE', 'e'); await delay(160); await settle();
  };
  // One trial answered by hand (audit №14): walk up to the NPC or object, read the dialogue, pick an option, and read the
  // feedback card the same panel turns into at once — verdict, right option, explanation, source — before the story goes on.
  const trialCard = async (target, pick) => {
    const isNpc = await p.js(`__tj.LV.MAP.npcs.includes(${JSON.stringify(target)})`);
    const tp = isNpc ? `(() => { const i = __tj.LV.MAP.npcs.indexOf(${JSON.stringify(target)}); const E = __tj.E; E.tj_teleport(E.tj_npc(i, 0), E.tj_npc(i, 1) + 14); E.tj_face(0); __tj.step(2); })()`
      : `(() => { const [x, y] = __tj.LV.MAP.interactPos[${JSON.stringify(target)}]; __tj.E.tj_teleport(Math.round(x), Math.round(y + 14)); __tj.E.tj_face(0); __tj.step(2); })()`;
    await p.js(tp); await settle(); await p.js(tp);
    await p.press('KeyE', 'e'); await delay(160);
    let id = null;
    for (const t0 = Date.now(); !id && Date.now() - t0 < 30000;) {
      if (await p.js('!!__tj.cine')) await p.js('__tj.skipCutscene()');
      if (await p.js('!!__tj.dialog')) { await p.js('__tj.advanceDialog()'); await delay(25); continue; }
      id = await p.js(`document.querySelector('#panel-card [data-trial] [data-opt]:not(:disabled)') ? document.querySelector('#panel-card [data-trial]').dataset.trial : null`);
      if (!id) await delay(60);
    }
    assert(id, 'a trial opens at ' + target);
    assert(!(await p.js(`!!document.querySelector('#panel-card .trial-verdict')`)), 'no verdict before the choice');
    seen.trials.push(id);
    await p.js(`document.querySelector('#panel-card [data-opt="${pick}"]').click()`);
    await p.wait(`!!document.querySelector('#panel-card .trial-verdict')`, 5000);
    const card = await p.js(`(() => { const c = document.querySelector('#panel-card'), v = c.querySelector('.trial-verdict');
      return {ok: v.classList.contains('ok'), verdict: v.textContent.replace(/\\s+/g, ' ').trim(), right: c.querySelector('[data-opt].right')?.dataset.opt ?? null,
        wrong: c.querySelector('[data-opt].wrong')?.dataset.opt ?? null, expl: c.querySelector('.expl')?.textContent || '', source: c.querySelector('.source')?.textContent || '',
        locked: [...c.querySelectorAll('[data-opt]')].every(b => b.disabled)}; })()`);
    await p.shot(`${name}-card-${id}`);
    await settle();
    return {id, ...card};
  };
  const flag = k => p.js(`!!__tj.G.flags.b.${k}`);
  const stage = () => p.js('__tj.LV.questStage(__tj.G.flags)');
  const goTo = (x, y) => p.js(`(() => { __tj.E.tj_teleport(${Math.round(x * 16)}, ${Math.round(y * 16)}); __tj.step(3); })()`);
  const groupKill = g => p.js(`(() => { const E = __tj.E, L = __tj.LV.MAP.enemies; for (let r = 0; r < 80; r++) { let any = false; L.forEach((e, i) => { if (e.group === ${g} && e.type < 6 && E.tj_enemy(i, 0) > 0) { any = true; E.tj_enemy_damage(i, 40, 0); } }); E.tj_heal(100); __tj.step(2); if (!any) break; } })()`);
  // One evaluation per manoeuvre: the page's own frame loop would otherwise reset the input between segments.
  const moves = (segments, {x, y, face = 2, weapon = 0} = {}) => p.js(`(() => { const E = __tj.E; E.tj_equip(${weapon}); ${x != null ? `E.tj_teleport(${Math.round(x)}, ${Math.round(y)});` : ''} E.tj_face(${face}); __tj.step(2);
    for (const [m, n] of ${JSON.stringify(segments)}) for (let i = 0; i < n; i++) { E.tj_input(m); E.tj_heal(100); __tj.step(1); } E.tj_input(0); return 1; })()`);
  const charge = (x, y, {from = 70, dy = 2, weapon = 1} = {}) => moves([[72, 9], [104, 3], [72, 3], [0, 30]], {x: x - from, y: y + dy, weapon});
  const combo = (x, y, {from = 26, dy = 2} = {}) => moves([[32, 2], [0, 30], [32, 2], [0, 30], [32, 2], [0, 34]], {x: x - from, y: y + dy, weapon: 0});
  // Firearms have their own cycle (reload, bolt, heat): wait until the weapon is ready, as a player would, then fire.
  const ready = () => p.js(`(() => { const E = __tj.E; for (let t = 0; t < 600 && (E.tj_state(53) || E.tj_state(55) || E.tj_state(57) || E.tj_state(15) || E.tj_state(16)); t++) { E.tj_heal(100); __tj.step(1); } return 1; })()`);
  const shoot = async (x, y, dist, {weapon = 2, wait = 90} = {}) => { await moves([[0, 1]], {x, y: y + dist, face: 0, weapon}); await ready(); return moves([[32, 3], [0, wait]], {x, y: y + dist, face: 0, weapon}); };
  const save = async () => { assert(await p.js('__tj.save(true)'), 'save');
    const snap = await p.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort(), [...__tj.G.flags.tracks].sort(), __tj.G.flags.quiz, __tj.G.local.granted])');
    await p.js('__tj.load(true)');
    assert.equal(await p.js('JSON.stringify([__tj.G.flags.b, [...__tj.G.flags.talked].sort(), [...__tj.G.flags.tracks].sort(), __tj.G.flags.quiz, __tj.G.local.granted])'), snap, 'save reload'); };
  // Wear a boss down: blows whenever he is open (the hurt function decides); heal the hero meanwhile.
  const bossStep = (H, n = 1, dmg = 40) => p.js(`(() => { const E = __tj.E; for (let i = 0; i < ${n}; i++) { E.tj_enemy_damage(${H}, ${dmg}, 0); E.tj_heal(100); __tj.step(2); } return [E.tj_enemy(${H}, 0), E.tj_enemy(${H}, 14), E.tj_enemy(${H}, 15), E.tj_enemy(${H}, 16)]; })()`);
  const bossState = H => p.js(`[__tj.E.tj_enemy(${H}, 0), __tj.E.tj_enemy(${H}, 14), __tj.E.tj_enemy(${H}, 15), __tj.E.tj_enemy(${H}, 16)]`);
  const finish = async gate => {
    await use(gate);
    await p.wait('__tj.G.flags.b.finished', 20000);
    if (!(await p.js('!!document.querySelector("#go-camp,#retry-epoch")'))) await p.js('__tj.G.complete(); 1');
    for (let i = 0; i < 200 && !(await p.js('__tj.panelOpen && !!document.querySelector("#go-camp,#retry-epoch")')); i++) { await p.js('__tj.advanceDialog()'); await delay(60); }
    await p.shot(`${name}-result`);
    return p.js('({score: document.querySelector(".verdict .big")?.textContent, pass: !!document.querySelector("#go-camp"), next: document.querySelector("#go-camp")?.textContent, secrets: __tj.LV.secretsFound(__tj.G.flags), page: __tj.LV.pageLines(__tj.G.flags)})');
  };
  return {settle, use, talk, trialCard, flag, stage, goTo, groupKill, moves, charge, combo, shoot, save, bossStep, bossState, finish};
}

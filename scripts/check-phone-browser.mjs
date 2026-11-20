// Phone check: MAP01 with real touch events (CDP Input.dispatchTouchEvent) on a touch screen (default 390×844, held
// upright: the game turns itself sideways). Each control is pressed where it is drawn; state is read during holds.
import {launch, delay, assert} from './check-lib.mjs';
// Usage: npm run dev, then: node scripts/check-phone-browser.mjs http://localhost:5173 [390x844|844x390]
const base = process.argv[2] || 'http://localhost:5173';
const [W, H] = (process.argv[3] || '390x844').split('x').map(Number);
const B = await launch('phoneaudit', '../src/rpg/story.js');
const a = await B.open('about:blank');
await a.call('Emulation.setDeviceMetricsOverride', {width: W, height: H, deviceScaleFactor: 2, mobile: true});
await a.call('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
await a.call('Page.navigate', {url: base + '/rpg.html?new=1'});
await a.wait('window.__tj && __tj.E', 40000); await delay(2500);
const R = {}, T = 16;
const rect = sel => a.js('(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width || getComputedStyle(e).visibility === "hidden") return null; return [r.left + r.width / 2, r.top + r.height / 2]; })()');
let tid = 1;
const down = async (x, y) => { const id = tid++; await a.call('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id}]}); return id; };
const up = async () => { await a.call('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await delay(120); };
async function tap(sel, ms = 80) { const p = await rect(sel); if (!p) return 'missing ' + sel; await down(p[0], p[1]); await delay(ms); await up(); return 'ok'; }
const st = () => a.js('({x: __tj.E.tj_state(0) / 1000, y: __tj.E.tj_state(1) / 1000, cine: __tj.cine, dlg: __tj.dialog, panel: __tj.panelOpen, weapon: __tj.E.tj_state(13), hp: __tj.E.tj_state(8), anim: __tj.E.tj_state(22), att: __tj.E.tj_state(15), hold: __tj.E.tj_state(27), focus: __tj.E.tj_state(25) >= 0 ? (__tj.E.tj_state(25) === 1 ? "npc:" + __tj.LV.MAP.npcs[__tj.E.tj_state(26)] : "ia:" + __tj.LV.MAP.interacts[__tj.E.tj_state(26)]) : null})');
async function settle(max = 80) {   // dialogue, scenes and panels — all by touch, as a player would
  for (let i = 0; i < max; i++) {
    const s = await st();
    if (s.dlg) { await tap('#dlg'); continue; }
    if (s.cine) { await tap('#skip'); await delay(250); continue; }
    if (s.panel) { let ok = false; for (const sel of ['#panel-card [data-opt]:not(:disabled)', '#panel-card [data-choice]', '#panel-card [data-close]', '#panel-card button']) if ((await tap(sel)).startsWith('ok')) { ok = true; break; }
      if (!ok) { R.stuckPanel = await a.js('document.getElementById("panel-card").innerText.slice(0, 160)'); break; } await delay(250); continue; }
    await delay(300); const again = await st(); if (!again.dlg && !again.cine && !again.panel) return;
  }
}
async function holdOn(sel, ms) { const p = await rect(sel); if (!p) return 'missing ' + sel; await down(p[0], p[1]); await delay(ms / 2); const mid = await st(); await delay(ms / 2); await up(); return mid; }
const teleport = (x, y, face = 0) => a.js(`(() => { __tj.E.tj_teleport(${Math.round(x)}, ${Math.round(y)}); __tj.E.tj_face(${face}); __tj.step(3); return 1; })()`);

R.rotated = await a.js('document.querySelector(".rpg").classList.contains("rot")');
await settle(); R.afterIntro = await st();
// joystick: four directions (screen drags; when the game is turned sideways, game-right is screen-down)
for (const [name, gx, gy] of [['right', 60, 0], ['left', -60, 0], ['up', 0, -60], ['down', 0, 60]]) {
  await settle();
  const p = await a.js('(() => { const r = document.querySelector(".stick").getBoundingClientRect(); return [r.left + r.width * .5, r.top + r.height * .5]; })()');
  const [dx, dy] = R.rotated ? [-gy, gx] : [gx, gy];
  const s0 = await st(); const id = await down(p[0], p[1]);
  for (let k = 1; k <= 6; k++) { await a.call('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: p[0] + dx * k / 6, y: p[1] + dy * k / 6, id}]}); await delay(100); }
  await delay(300); await up(); const s1 = await st();
  R['stick_' + name] = [Math.round(s1.x - s0.x), Math.round(s1.y - s0.y)];
}
await settle(); R.attackDuring = await holdOn('.acts button[data-key="32"]', 300);
await a.js('(() => { __tj.E.tj_item_add(2, 1); __tj.E.tj_item_add(3, 1); __tj.E.tj_item_add(4, 10); return 1; })()'); await delay(600);
R.slot2 = [await tap('.slots button[data-weapon="1"]'), (await st()).weapon];
R.slot3 = [await tap('.slots button[data-weapon="2"]'), (await st()).weapon];
R.slot1 = [await tap('.slots button[data-weapon="0"]'), (await st()).weapon];
await settle(); const npc = await a.js('(() => { const i = __tj.LV.MAP.npcs.indexOf("crafter"); return [__tj.E.tj_npc(i, 0), __tj.E.tj_npc(i, 1)]; })()');
await teleport(npc[0], npc[1] + 14, 0); R.npcFocus = (await st()).focus;
await tap('.acts button[data-key="16"]'); await delay(500); R.talkOpens = (await st()).dlg; await settle();
await a.js('(() => { Object.assign(__tj.G.flags.b, {met: 1, elderTask: 1}); __tj.G.flags.talked = ["crafter", "cook", "scraper"]; __tj.G.flags.tracks = [1, 2, 3, 4]; __tj.LV.applyWorld(__tj.G); __tj.E.tj_groups(0); return 1; })()');
await settle(); await teleport(89 * T, 21 * T + 14, 0); R.ropeFocus = (await st()).focus;
R.ropeHoldMid = await holdOn('.acts button[data-key="16"]', 3400); await delay(800);
R.ropeFreed = await a.js('!!__tj.G.flags.b.freed'); await settle();
await a.js('(() => { __tj.E.tj_item_add(9, 2); __tj.E.tj_damage(40); return 1; })()'); await delay(1300);
const hp0 = (await st()).hp; R.heal = [await tap('#t-heal'), hp0, (await st()).hp];
R.bag = [await tap('#b-inv'), (await st()).panel]; await tap('#panel-card [data-close]'); await delay(300); R.bagClosed = !(await st()).panel;
R.errors = a.errors;
await a.shot('phone-' + W + 'x' + H);
B.close();
const moved = ([dx, dy], ax, sign) => (ax === 'x' ? dx : dy) * sign > 40;
assert(moved(R.stick_right, 'x', 1) && moved(R.stick_left, 'x', -1) && moved(R.stick_up, 'y', -1) && moved(R.stick_down, 'y', 1), 'joystick moves the hero in all four directions: ' + JSON.stringify([R.stick_right, R.stick_left, R.stick_up, R.stick_down]));
assert.equal(R.attackDuring.att, 1, 'the attack button attacks');
assert.deepEqual([R.slot2[1], R.slot3[1], R.slot1[1]], [1, 2, 0], 'weapon slots switch by tap (not swallowed by the joystick area)');
assert(R.npcFocus === 'npc:crafter' && R.talkOpens, 'E talks to the person in front');
assert(R.ropeFocus === 'ia:rope' && R.ropeHoldMid.hold > 0 && R.ropeFreed, 'holding E on the rope frees Zhebei');
assert(R.heal[2] > R.heal[1], 'the heal button heals');
assert(R.bag[1] && R.bagClosed, 'the bag opens and closes by tap');
assert.deepEqual(R.errors, [], 'no page errors');
console.log(`PASS: phone ${W}x${H} (${R.rotated ? 'upright, game turned sideways' : 'landscape'}): joystick, attack, weapon slots, talk, hold E (rope), heal, bag.`);
process.exit(0);

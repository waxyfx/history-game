// Every level from a fresh start, the opening settled by clicks only (the dialogue box, the skip button, panel buttons),
// the way a player does it: afterwards no conversation may still hold the controls and the bag must open.
// The MAP09 bug: the hero spawns inside the station zone, its line started a moment before the arrival cutscene, the
// cutscene's lines took over the shared resolver, the first conversation never ended and dialogBusy stayed on for good.
// Usage: node scripts/check-dialog-browser.mjs [levels, e.g. 1,9]   (needs the dev server on :5173)
import {launch, delay, assert} from './check-lib.mjs';
import {QA_COOKIES} from './qa-profile.mjs';
const levels = (process.argv[2] || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
const B = await launch('dialog', '../src/rpg/story.js');
const bad = [];
// Audit №14: /rpg.html?level=N used to start without an account. Now the game asks first (local profile without a
// server), does not start until a name is given, and starts right after it.
{
  const a = await B.open('about:blank');
  await a.call('Network.clearBrowserCookies');
  await a.call('Page.navigate', {url: 'http://localhost:5173/rpg.html?level=3&new=1'});
  await a.wait(`!!document.querySelector('#panel-card #acc-name')`, 30000);
  await delay(800);
  assert(!(await a.js('!!(window.__tj && __tj.E)')), 'no game before an account');
  await a.js(`document.querySelector('#acc-local').click(), 1`);
  assert.match(await a.js(`document.querySelector('#acc-error').textContent`), /2/, 'an empty name is refused');
  await a.js(`(() => { const i = document.querySelector('#acc-name'); i.value = 'QA'; document.querySelector('#acc-local').click(); return 1; })()`);
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 3', 40000);
  assert(/tj_player=/.test(await a.js('document.cookie')), 'the profile is kept in a cookie');
  console.log('✓ account first: /rpg.html?level=3 waits for the account window, then starts');
  await a.call('Network.setCookies', QA_COOKIES);
}
for (const n of levels) {
  const a = await B.open('about:blank');
  // an upright phone (the game turned sideways): the timing where the zone line and the cutscene overlapped
  await a.call('Emulation.setDeviceMetricsOverride', {width: 390, height: 664, deviceScaleFactor: 2, mobile: true});
  await a.call('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  await a.call('Page.navigate', {url: `http://localhost:5173/rpg.html?level=${n}&new=1`});
  await a.wait(`window.__tj && __tj.E && __tj.LV.id === ${n}`, 40000);
  await delay(2500);
  let quiet = 0;
  for (let i = 0; i < 160 && quiet < 3; i++) {
    const s = await a.js('({cine: __tj.cine, dlg: __tj.dialog, panel: __tj.panelOpen, comic: !!document.querySelector(".tj-intro")})');
    if (s.comic) { await a.js('document.querySelector(".tj-skip")?.click(), 1'); await delay(500); quiet = 0; continue; }
    if (s.dlg) { await a.js('document.getElementById("dlg").click(), 1'); await delay(200); quiet = 0; continue; }
    if (s.cine) { await a.js('document.getElementById("skip").click(), 1'); await delay(220); quiet = 0; continue; }
    if (s.panel) { await a.js('(document.querySelector("#panel-card [data-opt]:not(:disabled)") || document.querySelector("#panel-card [data-choice]") || document.querySelector("#panel-card [data-close]") || document.querySelector("#panel-card button"))?.click(), 1'); await delay(220); quiet = 0; continue; }
    quiet++; await delay(350);
  }
  const busy = await a.js('__tj.dialogBusy');
  await a.js('document.getElementById("b-inv").click(), 1'); await delay(250);
  const bag = await a.js('__tj.panelOpen');
  const line = `MAP${String(n).padStart(2, '0')} dialogBusy ${busy} bag ${bag} errors ${a.errors.length}`;
  console.log((busy || !bag || a.errors.length ? '✗ ' : '✓ ') + line);
  if (busy || !bag || a.errors.length) bad.push(line + (a.errors.length ? ' ' + a.errors[0] : ''));
}
B.close();
assert.deepEqual(bad, [], 'conversations left the controls locked:\n' + bad.join('\n'));
console.log('Dialogue browser check PASS:', levels.length, 'levels, controls free after the opening');
process.exit(0);

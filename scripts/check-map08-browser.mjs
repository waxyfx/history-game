// MAP08 «Өрт» integration (muted headless Chromium): three voices of 1838, the flintlock and the bayonet with real input
// (long shots, too-close shots refused), the night attack and the three jammed doors (hold E), the Chronicler (prediction,
// copies, then he stops fighting and names the bait), the big motion comic «Өрт», the page, secrets and the gate to MAP09.
import {launch, assert, delay} from './check-lib.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const B = await launch('map08', '../src/rpg/story08.js');
try {
  const a = await B.open(base + '/rpg.html?level=8&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 8', 40000);
  await a.wait('__tj.cine === "arrival"'); await delay(1200); await a.shot('map08-01-arrival'); await a.settle();
  assert.equal(await a.stage(), 'arrive');
  assert.equal(await a.js('__tj.E.tj_item_count(3)'), 0, 'no musket before the lesson');
  await a.talk('tilmash'); assert(await a.flag('met')); assert.equal(await a.stage(), 'voices');
  await a.goTo(49, 38); await a.settle(); assert(await a.flag('fortSeen'));
  await a.shot('map08-02-fort');
  await a.groupKill(1);
  for (const n of ['akbope', 'tatar', 'sarbaz', 'teacher']) await a.talk(n);
  assert.equal(await a.stage(), 'arms', 'three voices');
  await a.talk('sentry8'); assert(await a.flag('lesson'));
  assert.equal(await a.js('__tj.E.tj_item_count(3)'), 1, 'musket granted'); assert.equal(await a.js('__tj.E.tj_item_count(4)'), 12, '12 rounds');
  const MT = [66, 72].map(x => [x * 16, Math.round(47.4 * 16)]), BT = [64, 68, 72].map(x => [x * 16, Math.round(58.6 * 16)]);
  await a.shoot(MT[0][0], MT[0][1], 60); await a.settle();
  assert(!(await a.flag('musketT1')), 'too close does not count');
  for (const [x, y] of MT) { await a.shoot(x, y, 10 * 16); await a.settle(); }
  for (const [x, y] of BT) { await a.moves([[32, 3], [0, 36]], {x: x - 22, y: y + 2, weapon: 1}); await a.settle(); }
  assert(await a.flag('sentryDone'), 'range: ' + JSON.stringify(await a.js('["musketT1","musketT2","bayonetT1","bayonetT2","bayonetT3"].map(k => !!__tj.G.flags.b[k])')));
  await a.shot('map08-03-range');
  assert.equal(await a.stage(), 'night');
  for (const s of ['dombra', 'oldsabre', 'primer', 'letter', 'plough', 'keys']) await a.use(s);
  assert.equal(await a.js('__tj.LV.secretsFound(__tj.G.flags)'), 6, 'six secrets: ' + JSON.stringify(await a.js('__tj.LV.SECRETS.filter(k => !__tj.G.flags.b[k])')));
  // Audit №14: 1916 and Alash. The decree answered wrongly on purpose: the card names the right option at once; the secret
  // points are spare (the level caps at 100), so the result below is still 100.
  const c = await a.trialCard('ukaz', (B.KEY.rus_1916 + 1) % 4);
  assert.equal(c.id, 'rus_1916'); assert(!c.ok && c.locked && c.right === String(B.KEY.rus_1916), 'verdict card: ' + JSON.stringify(c));
  assert(c.verdict.includes('ABCD'[B.KEY.rus_1916] + ')') && /1916/.test(c.expl) && /жарлық|указ/.test(c.source), 'right option, explanation, source: ' + JSON.stringify(c));
  for (const s of ['torgai', 'gazet']) await a.use(s);
  await a.talk('teacher');   // the second visit: a matching trial (people and deeds)
  assert(['rus_torgai', 'rus_alash', 'rus_match'].every(id => B.seen.trials.includes(id)), 'Torgai, Alash and matching trials');
  await a.save();
  // The night of the fire.
  await a.goTo(50, 36); await a.settle(); assert(await a.flag('night'), 'the night attack');
  await a.shot('map08-04-night');
  await a.groupKill(2); await a.groupKill(3);
  await a.use('door1'); assert(!(await a.flag('door1')), 'a tap does not open a jammed door');
  for (const d of ['door1', 'door2', 'door3']) await a.use(d, {hold: 100});
  assert.equal(await a.stage(), 'smoke', 'three rescued');
  await a.goTo(50, 36); await a.settle(); assert(await a.flag('bossSeen'), 'the Chronicler in the smoke');
  const H = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 9)');
  let s = await a.bossState(H), shot2 = false;
  for (let r = 0; r < 160 && !(await a.flag('chronDown')); r++) {
    s = await a.bossStep(H, 4);
    if (s[1] === 2 && s[3]) {
      if (!shot2) { shot2 = true; await a.shot('map08-05-copies'); }
      for (let k = 0; k < 3; k++) if ((s[3] >> k) & 1) {
        const [x, y] = await a.js(`[__tj.E.tj_enemy(${H}, ${17 + k}) / 1000, __tj.E.tj_enemy(${H}, ${20 + k}) / 1000]`);
        await a.moves([[32, 2], [0, 30]], {x, y: y + 18, face: 0, weapon: 0});
      }
    }
    if (await a.js('!!(__tj.cine || __tj.dialog || document.querySelector(".tj-intro"))')) await a.settle();
  }
  await a.settle();
  assert(await a.flag('chronDown'), 'the Chronicler stopped: ' + JSON.stringify(await a.bossState(H)));
  assert(B.seen.comics > 0, 'the comic «Өрт» played');
  assert(await a.flag('ink'));
  // The translator's walk between his two spots passes the desk: if E lands on him, press again, as a player would.
  for (let k = 0; k < 4 && !(await a.flag('page')); k++) await a.use('officedesk');
  assert(await a.flag('page'), 'page: ' + JSON.stringify(await a.js('({stage: __tj.LV.questStage(__tj.G.flags), b: __tj.G.flags.b, focus: __tj.E.tj_state(6), panel: __tj.panelOpen, cine: __tj.cine})'))); assert.equal(await a.stage(), 'home');
  const res = await a.finish('gate8');
  assert.equal(res.score, '100 / 100'); assert(res.pass); assert.equal(res.page, 4); assert.equal(res.secrets, 6);
  assert.deepEqual([...new Set(B.seen.trials)].sort(), Object.keys(B.KEY).sort(), 'all twelve trials');
  assert.equal(await a.js('__tj.LV.next'), 9, 'next level');
  assert.deepEqual(a.errors, [], 'no runtime errors');
  console.log('MAP08 browser PASS', JSON.stringify(res));
} finally { B.close(); }

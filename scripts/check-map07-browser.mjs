// MAP07 «Жеті ата» integration (muted headless Chromium): memory of the aul, the sabre series and the naiza charge with
// real input on the batyr's dummies, the bi's council and its choice, the second Aidar at the gate-stone, the noyon with
// three banners (the banners must fall before he can be hurt), the page, secrets, save/reload and the gate to MAP08.
import {launch, assert, delay} from './check-lib.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const CHOICE = +(process.env.CHOICE ?? 0);
const B = await launch('map07', '../src/rpg/story07.js', {choice: CHOICE});
try {
  const a = await B.open(base + '/rpg.html?level=7&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 7', 40000);
  await a.wait('__tj.cine === "arrival"'); await delay(1200); await a.shot('map07-01-arrival'); await a.settle();
  assert(await a.flag('arrived')); assert.equal(await a.stage(), 'arrive');
  await a.talk('aksakal'); assert(await a.flag('met')); assert.equal(await a.stage(), 'memory');
  await a.goTo(44, 41); await a.settle(); assert(await a.flag('aulSeen'));
  await a.shot('map07-02-aul');
  // Act I — the memory of the aul: song, lament, pasture (wolves first).
  await a.talk('zhyrshy'); await a.talk('zhyrshy'); await a.talk('apa');   // the second visit: a gap trial
  await a.talk('qyz'); assert(!(await a.js('__tj.G.flags.tracks.includes(3)')), 'pasture waits for the wolves');
  await a.groupKill(1); await a.settle(); assert(await a.flag('wolvesDone'), 'wolves gone');
  await a.talk('qyz');
  assert.equal(await a.stage(), 'arms', 'three pieces of memory');
  // Act II — the sabre and the naiza, real input.
  await a.talk('usta'); assert(await a.flag('sabreGiven'));
  await a.talk('batyr'); assert(await a.flag('lessons'));
  const ST = [46, 50, 54].map(x => [x * 16, Math.round(24.6 * 16)]), NT = [44, 50, 56].map(x => [x * 16, Math.round(15.2 * 16)]);
  await a.moves([[32, 2], [0, 40]], {x: ST[0][0] - 24, y: ST[0][1] + 2, weapon: 0}); await a.settle();
  assert(!(await a.flag('sabreT1')), 'a single cut does not count');
  for (const [x, y] of ST) { await a.combo(x, y); await a.settle(); }
  for (const [x, y] of NT) { await a.charge(x, y); await a.settle(); }
  assert(await a.flag('batyrDone'), 'training: ' + JSON.stringify(await a.js('["sabreT1","sabreT2","sabreT3","naizaT1","naizaT2","naizaT3"].map(k => !!__tj.G.flags.b[k])')));
  await a.shot('map07-03-training');
  await a.use('lancerack');
  assert.equal(await a.stage(), 'council');
  // Act III — the council, the choice.
  await a.talk('bi'); assert(await a.flag('councilDone')); assert(await a.flag(CHOICE ? 'councilMove' : 'councilStay'));
  assert.equal(await a.stage(), 'ridge');
  // The second Aidar at the gate-stone.
  await a.goTo(80, 44); await a.settle(); assert(await a.flag('twin7'), 'second Aidar at the stone');
  await a.use('gatestone'); assert(await a.flag('palm'), 'palm artifact');
  for (const s of ['saba', 'tuskiiz', 'oldbox', 'qyzhorse', 'ninepits']) await a.use(s);
  assert.equal(await a.js('__tj.LV.secretsFound(__tj.G.flags)'), 6, 'six secrets: ' + JSON.stringify(await a.js('__tj.LV.SECRETS.filter(k => !__tj.G.flags.b[k])')));
  assert(await a.js(`JSON.parse(localStorage.getItem('tarikh.anomalies') || '[]').includes('map07')`), 'anomaly');
  await a.save();
  // Act IV — the ridge: the noyon of the grey banners.
  await a.groupKill(2); await a.groupKill(3);
  await a.goTo(62, 12); await a.settle(); assert(await a.flag('bossSeen'), 'boss reveal');
  const H = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 8)');
  let s = await a.bossState(H);
  for (let r = 0; r < 120 && s[0] > 0; r++) {
    s = await a.bossStep(H, 6);
    if (s[1] === 2 && s[3]) {   // the banners: cut each one down with real blows
      for (let k = 0; k < 3; k++) if ((s[3] >> k) & 1) {
        const [x, y] = await a.js(`[__tj.E.tj_enemy(${H}, ${17 + k}) / 1000, __tj.E.tj_enemy(${H}, ${20 + k}) / 1000]`);
        await a.moves([[32, 2], [0, 24], [32, 2], [0, 24]], {x, y: y + 16, face: 0, weapon: 0});
      }
      if (r === 0 || !(await a.flag('bannerShot'))) { await a.shot('map07-04-banners'); await a.js('__tj.G.flags.b.bannerShot = true; 1'); }
      s = await a.bossState(H);
    }
  }
  await a.wait('__tj.cine === "noyonDown" || __tj.G.flags.b.noyonDown', 10000); await a.settle();
  assert(await a.flag('noyonDown'), 'noyon defeated'); assert(await a.flag('greyBanner'));
  await a.use('ancestor');
  assert(await a.flag('page')); assert.equal(await a.stage(), 'home');
  const res = await a.finish('gate7');
  assert.equal(res.score, '100 / 100'); assert(res.pass); assert.equal(res.page, 4); assert.equal(res.secrets, 6);
  assert.deepEqual([...new Set(B.seen.trials)].sort(), Object.keys(B.KEY).sort(), 'all nine trials');
  assert.equal(B.seen.choices.length, 1, 'one choice');
  // The way on: the result's button leads to MAP08.
  assert.equal(await a.js('__tj.LV.next'), 8, 'next level');
  assert.deepEqual(a.errors, [], 'no runtime errors');
  console.log('MAP07 browser PASS', JSON.stringify(res), 'choice', CHOICE);
} finally { B.close(); }

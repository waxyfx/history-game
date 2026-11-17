// MAP10 «Он бірінші тігіс» integration (muted headless Chromium): the three lines of the tenth page, the second Aidar's
// sacrifice at the white page, the final fight with Zulmat by the canon — the bow lost in phase 2, the spear and the
// artifacts in phase 3, only the sword left; at the health floor the wound, the finale comic, the merging (the hero's sheet
// with the fire in the eye); then the fight ends, the tenth page, the ending, the campaign result.
import {launch, assert, delay} from './check-lib.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const B = await launch('map10', '../src/rpg/story10.js');
try {
  const a = await B.open(base + '/rpg.html?level=10&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 10', 40000);
  await a.wait('__tj.cine === "arrival"'); await delay(1200); await a.shot('map10-01-arrival'); await a.settle();
  assert.equal(await a.stage(), 'arrive');
  const kit = await a.js('[1, 2, 3].map(i => __tj.E.tj_item_count(i))');
  assert.deepEqual(kit, [1, 1, 1], 'sword, spear and bow at the start');
  await a.talk('citizen'); assert(await a.flag('met'));
  await a.groupKill(1);
  await a.use('monument'); assert(await a.js('__tj.G.flags.tracks.includes(1)'), 'the square');
  await a.talk('prof'); assert(await a.js('__tj.G.flags.tracks.includes(2)'), 'the lobby');
  await a.talk('dana'); await a.talk('erlan'); await a.talk('guard10');
  await a.groupKill(2);
  await a.use('semey'); assert(await a.js('__tj.G.flags.tracks.includes(3)'), 'the archive'); assert(await a.flag('erased'));
  assert.equal(await a.stage(), 'door');
  for (const s of ['zheltoqsan', 'constitution', 'tenge', 'astana', 'book', 'tencharms']) await a.use(s);
  assert.equal(await a.js('__tj.LV.secretsFound(__tj.G.flags)'), 6, 'six secrets: ' + JSON.stringify(await a.js('__tj.LV.SECRETS.filter(k => !__tj.G.flags.b[k])')));
  assert(await a.js(`JSON.parse(localStorage.getItem('tarikh.anomalies') || '[]').includes('map10')`), 'anomaly');
  await a.save();
  // The sacrifice.
  await a.use('halldoor'); assert(await a.flag('sacrifice'), 'the second Aidar holds the white page'); assert(await a.flag('twinline'));
  await a.shot('map10-02-sacrifice');
  // The final fight.
  await a.goTo(42, 18); await a.settle(); assert(await a.flag('bossSeen'), 'Zulmat');
  await a.groupKill(3);
  const H = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 11)');
  let s = await a.bossState(H), shots = 0;
  const tickWait = n => a.js(`(() => { for (let i = 0; i < ${n}; i++) { __tj.E.tj_heal(100); __tj.step(1); } return 1; })()`);
  for (let r = 0; r < 200 && !(await a.flag('merged')); r++) {
    s = await a.bossStep(H, 6);
    await tickWait(30); await delay(300);   // the 4 Hz quest tick runs on real time
    if (await a.js('!!(__tj.cine || __tj.dialog || __tj.panelOpen || document.querySelector(".tj-intro"))')) await a.settle();
    if (s[1] === 2 && !shots) { shots++; await a.shot('map10-03-p2'); }
    if (s[1] === 3 && shots === 1) { shots++; await a.shot('map10-04-p3'); }
  }
  assert(await a.flag('lostBow'), 'the bow is lost'); assert(await a.flag('lostSpear'), 'the spear is lost'); assert(await a.flag('artifactsLost'));
  assert.deepEqual(await a.js('[1, 2, 3, 4].map(i => __tj.E.tj_item_count(i))'), [1, 0, 0, 0], 'only the sword is left');
  assert(await a.flag('merged'), 'the merging'); assert(B.seen.comics > 0, 'the finale comic played'); assert(await a.flag('stitch'));
  assert.equal(await a.js('__tj.E.tj_state(13)'), 0, 'sword in hand');
  // With the fire: the floor is gone, the sword ends it.
  for (let r = 0; r < 120 && (await a.bossState(H))[0] > 0; r++) await a.moves([[32, 2], [0, 22]], {x: (await a.js(`__tj.E.tj_enemy(${H}, 2)`)) / 1000, y: (await a.js(`__tj.E.tj_enemy(${H}, 3)`)) / 1000 + 16, face: 0, weapon: 0}).then(() => a.bossStep(H, 2));
  await a.wait('__tj.cine === "zulmatDown" || __tj.G.flags.b.zulmatDown', 10000); await a.settle();
  assert(await a.flag('zulmatDown'), 'Zulmat falls');
  await a.shot('map10-05-after');
  await a.use('gatecore'); assert(await a.flag('page')); assert.equal(await a.stage(), 'done');
  const res = await a.finish('gate10');
  assert.equal(res.score, '100 / 100'); assert(res.pass); assert.equal(res.page, 4); assert.equal(res.secrets, 6);
  assert.deepEqual([...new Set(B.seen.trials)].sort(), Object.keys(B.KEY).sort(), 'all eight trials');
  assert.equal(await a.js('__tj.LV.next ?? null'), null, 'the last level');
  assert.deepEqual(a.errors, [], 'no runtime errors');
  console.log('MAP10 browser PASS', JSON.stringify(res));
} finally { B.close(); }

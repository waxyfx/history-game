// MAP09 «Хат» integration (muted headless Chromium): the home front (crates, the library, the lost boy found in the lists),
// the Mosin rifle and its bayonet with real input, the second Aidar's truth in the orchard and the choice, the PPSh burst
// (one press — three rounds), the Heir in the hall of memory, the names list, secrets and the gate to MAP10.
import {launch, assert, delay} from './check-lib.mjs';

const base = process.argv[2] || 'http://127.0.0.1:5173';
const B = await launch('map09', '../src/rpg/story09.js');
try {
  const a = await B.open(base + '/rpg.html?level=9&new=1');
  await a.wait('window.__tj && __tj.E && __tj.LV.id === 9', 40000);
  await a.wait('__tj.cine === "arrival"'); await delay(1200); await a.shot('map09-01-arrival'); await a.settle();
  assert.equal(await a.stage(), 'arrive');
  await a.talk('postwoman'); assert(await a.flag('met')); assert(await a.flag('triangle'));
  await a.goTo(40, 64); await a.settle(); assert(await a.flag('stationSeen'));
  // The home front.
  await a.talk('worker');
  for (const c of ['crate1', 'crate2', 'crate3']) await a.use(c);
  await a.talk('worker'); assert(await a.js('__tj.G.flags.tracks.includes(1)'), 'plant');
  await a.talk('librarian'); assert(await a.js('__tj.G.flags.tracks.includes(2)'), 'library');
  await a.talk('evacuee'); await a.use('lists'); assert(await a.flag('reunion'), 'the boy found his mother');
  await a.shot('map09-02-reunion');
  assert.equal(await a.stage(), 'training');
  // The Mosin rifle and its bayonet.
  assert.equal(await a.js('__tj.E.tj_item_count(3)'), 0, 'no rifle before training');
  await a.talk('instructor'); assert(await a.flag('rifle')); assert.equal(await a.js('__tj.E.tj_item_count(3)'), 1);
  const RT = [10, 22].map(x => [x * 16, Math.round(8.4 * 16)]), ST = [12, 16, 20].map(x => [x * 16, Math.round(20.6 * 16)]);
  await a.shoot(RT[0][0], RT[0][1], 60); await a.settle(); assert(!(await a.flag('rifleT1')), 'too close');
  for (const [x, y] of RT) { await a.shoot(x, y, 10 * 16); await a.settle(); }
  for (const [x, y] of ST) { await a.moves([[32, 3], [0, 36]], {x: x - 22, y: y + 2, weapon: 1}); await a.settle(); }
  assert(await a.flag('instructorDone'), 'training');
  await a.shot('map09-03-range');
  // The orchard: the second Aidar's truth.
  await a.groupKill(1);
  await a.goTo(74, 18); await a.settle(); assert(await a.flag('twin9'), 'the truth in the orchard'); assert(await a.flag('apple'));
  // The PPSh: one press, three rounds.
  await a.talk('instructor'); assert(await a.flag('ppsh'));
  const ammo0 = await a.js('__tj.E.tj_item_count(4)');
  await a.shoot(8 * 16, Math.round(14.4 * 16), 6 * 16, {wait: 40}); await a.settle();
  assert.equal(ammo0 - await a.js('__tj.E.tj_item_count(4)'), 3, 'a burst of three');
  for (const x of [8, 14, 20]) if (!(await a.flag('burstT' + ([8, 14, 20].indexOf(x) + 1)))) { await a.shoot(x * 16, Math.round(14.4 * 16), 6 * 16, {wait: 40}); await a.settle(); }
  assert(await a.flag('ppshDone'), 'burst line');
  for (const s of ['turksib', 'heroines', 'famine', 'deport', 'cards', 'ninestars']) await a.use(s);
  assert.equal(await a.js('__tj.LV.secretsFound(__tj.G.flags)'), 6, 'six secrets: ' + JSON.stringify(await a.js('__tj.LV.SECRETS.filter(k => !__tj.G.flags.b[k])')));
  // Audit №14: 1937–38, ALZhIR, the Virgin Lands, Baikonur. The closed shelf answered rightly by hand (the card at once),
  // ALZhIR wrongly on purpose (the card names the right option; spare secret points keep the result at 100).
  const c1 = await a.trialCard('banned', B.KEY.sov_1937);
  assert.equal(c1.id, 'sov_1937'); assert(c1.ok && c1.locked && c1.right === String(B.KEY.sov_1937) && c1.wrong === null, 'right card: ' + JSON.stringify(c1));
  assert(/1937/.test(c1.expl) && /ақтау|реабилит/.test(c1.source), 'explanation and source: ' + JSON.stringify(c1));
  const c2 = await a.trialCard('alzhir', (B.KEY.sov_alzhir + 1) % 4);
  assert.equal(c2.id, 'sov_alzhir'); assert(!c2.ok && c2.right === String(B.KEY.sov_alzhir) && c2.verdict.includes('ABCD'[B.KEY.sov_alzhir] + ')'), 'wrong card: ' + JSON.stringify(c2));
  for (const s of ['tyn', 'baikonur']) await a.use(s);
  assert(['sov_tyn', 'sov_baikonur'].every(id => B.seen.trials.includes(id)), 'Virgin Lands and Baikonur trials');
  await a.save();
  // The hall of memory: two voices, then the Heir.
  await a.goTo(46, 16); await a.settle(); assert(await a.flag('bossSeen'), 'the hall');
  await a.groupKill(2);
  const H = await a.js('__tj.LV.MAP.enemies.findIndex(e => e.type === 6)');
  let s = await a.bossState(H), shot = false;
  for (let r = 0; r < 120 && s[0] > 0; r++) { s = await a.bossStep(H, 6); if (!shot && s[1] >= 2) { shot = true; await a.shot('map09-04-heir'); } }
  await a.wait('__tj.cine === "heirDown" || __tj.G.flags.b.heirDown', 10000); await a.settle();
  assert(await a.flag('heirDown'), 'the Heir stopped');
  await a.use('names'); assert(await a.flag('page')); assert(await a.flag('nameslist'));
  const res = await a.finish('gate9');
  assert.equal(res.score, '100 / 100'); assert(res.pass); assert.equal(res.page, 4); assert.equal(res.secrets, 6);
  assert.deepEqual([...new Set(B.seen.trials)].sort(), Object.keys(B.KEY).sort(), 'all twelve trials');
  assert.equal(B.seen.choices.length, 1, 'one choice');
  assert.equal(await a.js('__tj.LV.next'), 10, 'next level');
  assert.deepEqual(a.errors, [], 'no runtime errors');
  console.log('MAP09 browser PASS', JSON.stringify(res));
} finally { B.close(); }

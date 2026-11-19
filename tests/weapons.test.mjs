// Weapon matrix on the real engine builds: every era's weapon is driven through its own profile (src/rpg/weapons.js)
// and must behave as that weapon — not as a renamed bow or a re-skinned sword. Each test presses the actual inputs
// (tj_input: 32 strike, 128 reload, 256 parry) and reads what the engine did: projectiles, rounds, timers, sounds, damage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FIRE} from '../src/rpg/weapons.js';

const pad = n => String(n).padStart(2, '0');
const WASM = {}, LEVEL = {}, QUEST = {};
for (const n of [1, 2, 3, 5, 6, 7, 8, 9, 10]) {
  WASM[n] = await WebAssembly.compile(await readFile(new URL(`../public/engine/rpg/tarikh-rpg${n === 1 ? '' : '-' + n}.wasm`, import.meta.url)));
  LEVEL[n] = (await import(`../src/rpg/level${n}.js`)).default;
  if (n >= 6) QUEST[n] = await import(`../src/rpg/quest${pad(n)}.js`);
}
const STRIKE = 32, RELOAD = 128, PARRY = 256;
const SFX = {bow: 6, bowstring: 22, musket: 23, rifle: 24, smg: 25, pulse: 26, reload: 27, bolt: 28, dry: 29, vent: 30, parry: 31};
const EV = {sfx: 1, noammo: 17, reload: 20, parry: 21, impact: 22};
const ST = {kind: 50, mag: 51, cap: 52, reload: 53, bolt: 55, heat: 56, overheat: 57, parry: 58, counter: 59, draw: 60, attack: 15, facing: 3, x: 0, y: 1};

// One era, armed as the level arms it. `b`: the story flags that hand out the late weapons.
function era(n, b = {}, ammo = 30) {
  const e = {...new WebAssembly.Instance(WASM[n], {}).exports}; e._initialize?.(); e.tj_init();
  for (const i of [1, 2, 3]) e.tj_item_add(i, 1);
  e.tj_item_add(4, ammo);
  if (n <= 5) LEVEL[n].arsenal(e); else QUEST[n].applyWeapons(e, b);
  e.events = []; return e;
}
function tick(e, n = 1) { for (let i = 0; i < n; i++) { e.tj_heal(100); e.tj_tick(); for (let k = 0; k < e.tj_event_count(); k++) e.events.push([e.tj_event(k, 0), e.tj_event(k, 1), e.tj_event(k, 2)]); e.tj_events_clear(); } }
const press = (e, mask, n) => { e.tj_input(mask); tick(e, n); e.tj_input(0); };
const st = (e, f) => e.tj_state(f);
const sounds = e => e.events.filter(v => v[0] === EV.sfx).map(v => v[1]);
const events = (e, type) => e.events.filter(v => v[0] === type);
const ammo = e => e.tj_item_count(4);
function liveShots(e) { const out = []; for (let i = 0; i < 48; i++) if (e.tj_projectile(i, 0) && e.tj_projectile(i, 3) < 0) out.push(i); return out; }
// Fire once (press `hold` ticks) and measure the round: speed per tick, whether it is a lead round.
function shotProfile(e, hold = 2) {
  e.events = []; press(e, STRIKE, hold);
  let i = -1; for (let t = 0; t < 30 && i < 0; t++) { [i = -1] = liveShots(e); if (i < 0) tick(e, 1); }
  if (i < 0) return {none: true};
  const y0 = e.tj_projectile(i, 2), bullet = e.tj_projectile(i, 4); tick(e, 1);
  return {speed: (y0 - e.tj_projectile(i, 2)) / 1000, bullet};
}
function ready(e, max = 400) { for (let t = 0; t < max && (st(e, ST.reload) || st(e, ST.bolt) || st(e, ST.overheat) || st(e, ST.attack)); t++) tick(e, 1); tick(e, 4); }
function aim(e, x, y, face = 0) { e.tj_equip(2); e.tj_teleport(x * 16, y * 16); e.tj_face(face); tick(e, 2); e.events = []; }
// A hostile in front of the hero: the first enemy of a group, enabled; returns its index.
function target(e, group) {
  e.tj_groups(1 << group); tick(e, 2);
  for (let i = 0; i < e.tj_enemy_count(); i++) if (e.tj_enemy(i, 11) === group && e.tj_enemy(i, 6) && e.tj_enemy(i, 0) > 0) return i;
  return -1;
}

test('a firearm is not a bow: lead round several times faster, its own report, no bowstring loose', () => {
  const bow = era(2); aim(bow, 46, 40);
  const arrow = shotProfile(bow, 2);
  assert.equal(arrow.bullet, 0, 'MAP02 bow looses an arrow'); assert(arrow.speed > 3.5 && arrow.speed < 6, 'an arrow flies ~4 px/tick: ' + arrow.speed);
  assert(sounds(bow).includes(SFX.bow) && !sounds(bow).some(s => s >= SFX.musket && s <= SFX.pulse), 'bow sound only');

  const gun = era(8, {lesson: true}, 12); aim(gun, 49, 60);
  const round = shotProfile(gun, 1);
  assert.equal(round.bullet, 1, 'MAP08 flintlock fires a lead round'); assert(round.speed >= 12, 'a round flies ≥ 12 px/tick: ' + round.speed);
  assert(round.speed > arrow.speed * 3, 'more than three times an arrow');
  assert(sounds(gun).includes(SFX.musket), 'the musket report'); assert(!sounds(gun).includes(SFX.bow), 'never the bow sound');
});

test('flintlock (MAP08): one round, ~2.5 s reload, no firing while reloading, cartridges never negative', () => {
  const e = era(8, {lesson: true}, 3); aim(e, 49, 60);
  assert.equal(st(e, ST.kind), FIRE.musket[0]); assert.equal(st(e, ST.cap), 1); assert.equal(st(e, ST.mag), 1, 'comes loaded');
  press(e, STRIKE, 1); tick(e, 20);
  assert.equal(ammo(e), 2, 'one cartridge per shot'); assert.equal(st(e, ST.mag), 0);
  tick(e, 10); assert(st(e, ST.reload) > 100, 'reloading by itself after the shot');
  assert(events(e, EV.reload).some(v => v[1] === 1) && sounds(e).includes(SFX.reload), 'reload starts with its sound');
  const during = ammo(e); press(e, STRIKE, 3); tick(e, 20); assert.equal(ammo(e), during, 'the trigger does nothing while reloading');
  ready(e); assert.equal(st(e, ST.mag), 1, 'loaded again');
  for (let k = 0; k < 4; k++) { press(e, STRIKE, 1); tick(e, 30); ready(e); }
  assert.equal(ammo(e), 0); assert(ammo(e) >= 0); assert.equal(st(e, ST.mag), 0);
  e.events = []; press(e, STRIKE, 2); tick(e, 4);
  assert(events(e, EV.noammo).length >= 1 && sounds(e).includes(SFX.dry), 'an empty flintlock only clicks');
});

test('Mosin (MAP09): five-round clip, the bolt between shots, a clip reload; PPSh: automatic, far faster, lighter rounds', () => {
  const m = era(9, {rifle: true}, 40); aim(m, 46, 40);
  assert.equal(st(m, ST.kind), FIRE.mosin[0]); assert.equal(st(m, ST.cap), 5);
  press(m, STRIKE, 1); tick(m, 12); const a1 = ammo(m);
  assert(st(m, ST.bolt) > 0, 'working the bolt');
  press(m, STRIKE, 2); tick(m, 4); assert.equal(ammo(m), a1, 'no second shot during the bolt cycle');
  ready(m); press(m, STRIKE, 1); tick(m, 12); assert.equal(ammo(m), a1 - 1, 'the next round after the bolt');
  assert(sounds(m).includes(SFX.rifle) && sounds(m).includes(SFX.bolt), 'rifle report and bolt');
  for (let k = 0; k < 3; k++) { ready(m); press(m, STRIKE, 1); tick(m, 12); }
  assert.equal(st(m, ST.mag), 0); for (let t = 0; t < 120 && !st(m, ST.reload); t++) tick(m, 1); assert(st(m, ST.reload) > 0, 'the clip goes in after the bolt'); ready(m); assert.equal(st(m, ST.mag), 5);
  // 2 seconds on the trigger: the rifle vs the sub-machine gun
  const p = era(9, {rifle: true, ppsh: true}, 40); aim(p, 46, 40);
  assert.equal(st(p, ST.kind), FIRE.ppsh[0]); assert.equal(st(p, ST.cap), 35);
  const r0 = ammo(m); press(m, STRIKE, 120); tick(m, 10); const rifleRounds = r0 - ammo(m);
  const p0 = ammo(p); press(p, STRIKE, 120); tick(p, 10); const smgRounds = p0 - ammo(p);
  assert(smgRounds >= 20, 'PPSh in 2 s: ' + smgRounds); assert(rifleRounds <= 3, 'Mosin in 2 s: ' + rifleRounds);
  assert(sounds(p).includes(SFX.smg) && !sounds(p).includes(SFX.rifle));
  // a tap still sends three
  const q = era(9, {rifle: true, ppsh: true}, 40); aim(q, 46, 40); const t0 = ammo(q); press(q, STRIKE, 2); tick(q, 40);
  assert.equal(t0 - ammo(q), 3, 'a tap = a burst of three');
  // per-round damage: the rifle hits much harder
  assert(QUEST[9].MOSIN[1] >= 3 * QUEST[9].PPSH[1], 'Mosin round ≥ 3× a PPSh round');
});

test('PPSh rounds spread; recoil pushes the shooter back', () => {
  const p = era(9, {rifle: true, ppsh: true}, 40); aim(p, 46, 40);
  const y0 = st(p, ST.y); press(p, STRIKE, 30);
  const xs = new Set(); for (const i of liveShots(p)) xs.add(Math.round(p.tj_projectile(i, 1) / 1000));
  assert(xs.size >= 2, 'rounds leave at different angles');
  assert(st(p, ST.y) > y0, 'pushed back (south) while firing north');
});

test('pulse rifle (MAP10): an instant beam (no projectile), heat instead of a magazine, overheating stops it', () => {
  const e = era(10, {}, 30); aim(e, 42, 54);
  assert.equal(st(e, ST.kind), FIRE.pulse[0]);
  press(e, STRIKE, 1); tick(e, 6);
  assert.equal(liveShots(e).length, 0, 'no projectile in flight'); assert(events(e, EV.impact).length >= 1, 'the beam struck at once');
  assert(sounds(e).includes(SFX.pulse)); assert(st(e, ST.heat) > 0);
  let shots = 1; while (!st(e, ST.overheat) && shots < 10) { tick(e, 16); press(e, STRIKE, 1); tick(e, 4); shots++; }
  assert(st(e, ST.overheat) > 0 && shots <= 5, 'overheats after a few quick shots: ' + shots);
  assert(sounds(e).includes(SFX.vent));
  const a = ammo(e); press(e, STRIKE, 2); tick(e, 10); assert.equal(ammo(e), a, 'no shot while venting');
});

test('switching weapons abandons a reload; respawn resets the weapon state', () => {
  const e = era(8, {lesson: true}, 6); aim(e, 49, 60);
  press(e, STRIKE, 1); tick(e, 60); assert(st(e, ST.reload) > 0);
  assert.equal(e.tj_equip(0), 1, 'the gun can be put away mid-reload'); tick(e, 1); assert.equal(st(e, ST.reload), 0, 'the reload stops when the gun is put away');
  e.tj_equip(2); tick(e, 30); assert(st(e, ST.reload) > 0, 'the empty gun reloads again when taken up');
  e.tj_respawn(0); tick(e, 1); assert.equal(st(e, ST.reload), 0); assert.equal(st(e, ST.mag), 1, 'back at the checkpoint with a loaded weapon');
});

test('bow: holding draws (the arrow flies farther), the arrows aim while drawn', () => {
  // MAP02 (18, 60): a lane clear for 300 px to the north
  const flight = (hold, e) => { aim(e, 18, 60); const y0 = st(e, ST.y) / 1000; let best = 0; press(e, STRIKE, hold);
    for (let t = 0; t < 160; t++) { tick(e, 1); for (const i of liveShots(e)) best = Math.max(best, y0 - e.tj_projectile(i, 2) / 1000); } return best; };
  const tap = flight(3, era(2)), full = flight(56, era(2));
  assert(full > tap + 40, `full draw ${full} > tap ${tap}`);
  const e = era(2); aim(e, 18, 60); e.tj_input(STRIKE); tick(e, 20); e.tj_input(STRIKE | 8); tick(e, 3); e.tj_input(0); tick(e, 2);
  assert.equal(st(e, ST.facing), 2, 'turned east while drawing');
});

test('melee: akinakes chains, the Turkic sabre parries and counters, the bayonet lunges, the lance charges, the club-free spear thrusts', () => {
  // akinakes (MAP03): the follow-up cut lands within a few ticks
  const firstHit = (e, gap) => { e.tj_equip(0); e.tj_teleport(46 * 16, 40 * 16); tick(e, 2); press(e, STRIKE, 1); tick(e, gap); press(e, STRIKE, 1);
    let t = 0; while (st(e, ST.attack) && t < 60) { tick(e, 1); t++; } return t; };
  const ak = era(3), plain = era(1);
  assert(firstHit(ak, 14) < firstHit(plain, 26), 'the akinakes follow-up is quicker than a plain blade');
  // Turkic sabre (MAP05): F parries a blow; the next cut is a counter
  const s = era(5); s.tj_equip(0); s.tj_teleport(46 * 16, 40 * 16); tick(s, 2);
  press(s, PARRY, 1); assert(st(s, ST.parry) > 0, 'the parry window opens');
  const hp = st(s, 8); s.tj_damage(30); assert.equal(st(s, 8), hp, 'a parried blow does no harm');
  assert(st(s, ST.counter) > 0, 'the counter window opens'); tick(s, 1);
  assert(events(s, EV.parry).length >= 1 && sounds(s).includes(SFX.parry), 'the parry event and its clang');
  s.events = []; press(s, STRIKE, 1); assert.equal(st(s, ST.counter), 0, 'the next cut spends the counter');
  const noParry = era(1); noParry.tj_equip(0); press(noParry, PARRY, 1); assert.equal(st(noParry, ST.parry), 0, 'the Institute blade has no parry');
  // bayonet (MAP08): the thrust carries the hero forward
  const b = era(8, {lesson: true}); b.tj_equip(1); b.tj_teleport(49 * 16, 60 * 16); b.tj_face(0); tick(b, 2);
  const by = st(b, ST.y); press(b, STRIKE, 1); tick(b, 12); assert(by - st(b, ST.y) >= 8000, 'a step into the bayonet thrust');
  const sp = era(1); sp.tj_equip(1); sp.tj_teleport(46 * 16, 40 * 16); sp.tj_face(0); tick(sp, 2);
  const sy = st(sp, ST.y); press(sp, STRIKE, 1); tick(sp, 14); assert(Math.abs(sy - st(sp, ST.y)) < 1000, 'the stone spear thrusts in place');
  assert.equal(st(sp, 62), 0); assert.equal(st(b, 62), 2); assert.equal(st(era(6, {lanceLesson: true}), 62), 1, 'the cavalry lance charges');
  assert.equal(st(era(7, {sabreGiven: true, lessons: true}), 61), 1, 'MAP07 shashka: the three-cut series'); assert.equal(st(s, 61), 2, 'MAP05 sabre: parry');
});

test('a lead round wounds an enemy it reaches', () => {
  const e = era(8, {lesson: true}, 12); const i = target(e, 1);
  assert(i >= 0, 'MAP08 has a hostile in group 1');
  const ex = e.tj_enemy(i, 2) / 1000, ey = e.tj_enemy(i, 3) / 1000;
  e.tj_equip(2); e.tj_teleport(Math.round(ex), Math.round(ey + 48)); e.tj_face(0); tick(e, 1);
  const hp = e.tj_enemy(i, 0); press(e, STRIKE, 1); tick(e, 20);
  assert(e.tj_enemy(i, 0) < hp, `a lead round wounds (${hp} → ${e.tj_enemy(i, 0)})`);
});

test('a gun the story hands over comes loaded; swapping Mosin ↔ PPSh means loading the other one', () => {
  const e = era(9, {rifle: true}, 15); assert.equal(st(e, ST.kind), FIRE.mosin[0]); assert.equal(st(e, ST.mag), 5, 'the Mosin is handed over loaded');
  const p = era(9, {rifle: true, ppsh: true}, 40); assert.equal(st(p, ST.kind), FIRE.ppsh[0]); assert.equal(st(p, ST.mag), 35);
  aim(p, 46, 40);
  assert(QUEST[9].swapLongGun(p, {rifle: true, ppsh: true})); assert.equal(st(p, ST.kind), FIRE.mosin[0]); assert.equal(st(p, ST.mag), 0, 'the swapped-in Mosin is empty');
  press(p, STRIKE, 1); tick(p, 2); assert(st(p, ST.reload) > 0, 'the trigger starts loading it');
  QUEST[9].swapLongGun(p, {rifle: true, ppsh: true}); assert.equal(st(p, ST.kind), FIRE.ppsh[0]);   // back to the PPSh (module state restored)
  const before = era(9, {rifle: true}, 15); assert.equal(st(before, ST.kind), FIRE.mosin[0]);
});

test('the gun handed over before its cartridges is loaded with the first ones (MAP08 lesson order)', () => {
  const e = {...new WebAssembly.Instance(WASM[8], {}).exports}; e._initialize?.(); e.tj_init(); e.events = [];
  for (const i of [1, 2, 3]) e.tj_item_add(i, 1);
  QUEST[8].applyWeapons(e, {lesson: true});
  assert.equal(st(e, ST.mag), 0); e.tj_item_add(4, 12); assert.equal(st(e, ST.mag), 1, 'loaded with the first cartridge');
  assert.equal(ammo(e), 12, 'the loaded round is one of the twelve');
});

test('level descriptors keep their weapon hooks (MAP09 swap, MAP01–05 arsenals)', async () => {
  const {loadLevel} = await import('../src/rpg/levels.js');
  assert.equal(typeof (await loadLevel(9)).swapRanged, 'function', 'MAP09: 3 swaps the long guns');
  for (const n of [1, 2, 3, 4, 5]) assert.equal(typeof (await loadLevel(n)).arsenal, 'function', `MAP0${n} arsenal`);
});

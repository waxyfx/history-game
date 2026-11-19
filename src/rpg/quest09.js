// MAP09 «Хат» quest logic (grow-only flags). talked = people heard, tracks = the home front (plant, library, station).
// New combat: the Mosin rifle (long, precise; its bayonet in slot 2), the bayonet-knife (slot 1, fast), and later the
// PPSh — one press fires a burst of three (tj_burst). The story is mostly the home front: work, letters, the lost boy;
// the second Aidar tells the truth in the orchard; the Heir and the Chronicler argue aloud before the boss (the Heir).
import {MAP09} from './gen/map09.js';
import {A, TS, IT, P, indexes, scoring, kit, arm, makeStrikeWatch} from './epochkit.js';
import {makeArrowWatch} from './range.js';
import {FIRE, MELEE} from './weapons.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, PROOFS, FACTS, CHOICES, ARTIFACTS, PAGE_IDS, FRONT} from './story09.js';

export const {IA, NPC, TRIG, TAG} = indexes(MAP09);
const SC = scoring(HISTORICAL_QUIZZES, SECRETS, PAGE_IDS);
export const {MAX_SCORE, PASS_SCORE, TRIAL_POINTS, scoreOf, pageLines, secretsFound, PAGE_TOTAL} = SC;
export const BOSS = MAP09.enemies.findIndex(e => e.type === 6);
export const RIFLE_T = [10, 22].map((x, k) => ({x: x * TS, y: 8.4 * TS, key: 'rifleT' + (k + 1)}));
export const BAYONET_T = [12, 16, 20].map((x, k) => ({x: x * TS, y: 20.6 * TS, key: 'stabT' + (k + 1)}));
export const BURST_T = [8, 14, 20].map((x, k) => ({x: x * TS, y: 14.4 * TS, key: 'burstT' + (k + 1)}));
export const KNIFE = [0, 24, 4, 12, 24, 14], MOSIN_BAYONET = [1, 30, 9, 24, 44, 7], MOSIN = [2, 70, 6, 30, 320, 0], PPSH = [2, 20, 1, 3, 220, 0];
export const RANGE_MIN = 8 * TS;
const FRONT_PROOF = {worker: 'plant', librarian: 'library', evacuee: 'station'};
let ppshMode = false, preferMosin = false;
export const usingPPSh = () => ppshMode;
// Both long guns once the PPSh is given: pressing 3 again swaps between them (weapons.js — two different weapons).
export function swapLongGun(E, b) { if (!b.ppsh) return false; preferMosin = !preferMosin; applyWeapons(E, b, true); return true; }

export const frontDone = f => FRONT.every(k => f.tracks.includes(PROOFS[FRONT_PROOF[k]]));
export const trainingDone = f => !!f.b.instructorDone;
export function questStage(f) {
  const b = f.b;
  if (b.finished) return 'done';
  if (b.page) return 'home';
  if (b.heirDown) return 'page';
  if (b.ppshDone) return 'hall';
  if (b.twin9) return 'ppsh';
  if (trainingDone(f)) return 'orchard';
  if (frontDone(f)) return 'training';
  if (b.met) return 'home_front';
  return 'arrive';
}
export function questTarget(f) {
  const stage = questStage(f), b = f.b;
  if (stage === 'home_front') {
    if (!f.tracks.includes(PROOFS.plant)) return ['crate1', 'crate2', 'crate3'].find(k => !b[k]) ? {ia: IA[['crate1', 'crate2', 'crate3'].find(k => !b[k])]} : {npc: NPC.worker};
    if (!f.tracks.includes(PROOFS.library)) return {npc: NPC.librarian};
    return b.lookFor ? {ia: IA.lists} : {npc: NPC.evacuee};
  }
  if (stage === 'orchard') return {ia: IA.famine};
  if (stage === 'hall') return {ia: IA.names};
  const t = QUESTS[stage].target;
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

const ZONE_LIGHT = [[206, 200, 192], [196, 188, 180], [214, 206, 182], [206, 200, 196], [210, 214, 190], [206, 202, 194], [170, 160, 150], [204, 198, 190]];
export function applyWeapons(E, b, swapped = false) {
  ppshMode = !!b.ppsh && !preferMosin;
  arm(E, {tunes: [KNIFE, ...(b.rifle ? [MOSIN_BAYONET, ppshMode ? PPSH : MOSIN] : [])], bullets: 1, hero: 'aibargun',
    fire: !b.rifle ? FIRE.bow : ppshMode ? FIRE.ppsh : FIRE.mosin, empty: swapped, blade: MELEE.knife, pole: MELEE.bayonet});
}
export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const tag = (key, hidden) => E.tj_tag(TAG[key], hidden ? 1 : 0);
  for (const k of Object.keys(IA)) ia(k, true);
  for (const k of ['crate1', 'crate2', 'crate3']) { tag(k, !!b[k]); ia(k, !!b.met && !b[k]); }
  // Groups: 1 shades of oblivion in the orchard's dusk, 2 shades in the hall, 3 the Heir.
  E.tj_groups((trainingDone(f) && !b.twin9 ? 1 << 1 : 0) | (b.bossSeen && !b.heirDown ? 1 << 2 | 1 << 3 : 0));
  applyWeapons(E, b);
  E.tj_torch(0);
  E.tj_light(...(b.page ? [214, 214, 226] : ZONE_LIGHT[E.tj_state(2)] || ZONE_LIGHT[0]));
  const arm_ = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {station: !b.stationSeen, orchard: trainingDone(f) && !b.twin9, hall: !!b.ppshDone && !b.bossSeen, street: false};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm_(k, on); G.armed[k] = on; }
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  npcFlags('postwoman', true, !b.met ? 2 : 0);
  for (const k of FRONT) npcFlags(k, true, b.met && !f.tracks.includes(PROOFS[FRONT_PROOF[k]]) ? 2 : 0);
  npcFlags('akyn', true, 0);
  npcFlags('instructor', true, (frontDone(f) && !b.rifle) || (b.twin9 && !b.ppsh) ? 2 : 0);
  if (G.forceNpc || G.npcState !== String(b.reunion)) {
    G.npcState = String(b.reunion); npcFlags('twin9', false, 0, 1);
    if (b.reunion) { E.tj_npc_set(NPC.mother, ...P(31.6, 62), 6, A.idle, 1); npcFlags('mother', false, 0, 0); } else npcFlags('mother', false, 0, 1);
    for (const k of ['postwoman', 'worker', 'librarian', 'akyn', 'evacuee', 'instructor']) E.tj_npc_routine(NPC[k]);
  }
  G.forceNpc = false;
  G.K?.grant('kit', true, () => E.tj_item_add(IT.herb, 2));
  G.K?.grant('rifle', b.rifle, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 15); });
  G.K?.grant('ppsh', b.ppsh, () => E.tj_item_add(IT.arrows, 30));
  G.K?.grant('page', b.page, () => E.tj_item_add(IT.page, 1));
}

export function createQuest(G) {
  const {E} = G;
  const K = G.K = kit(G, MAP09, {ARTIFACTS, D});
  G.applyWorld = () => applyWorld(G);
  const {b, set, addTo, npcAt, hide, show} = K;
  const quiz = id => G.quiz(SC.QID[id]);
  const proof = async id => { if (addTo('tracks', id)) { G.sfx('secret'); if (frontDone(G.flags) && !b().frontSaid) { set('frontSaid'); await G.say(D.frontDone); } } };

  async function start() {
    E.tj_teleport(...P(46, 70.4)); E.tj_checkpoint(...P(46, 70.4));
    return G.cine('arrival', cutArrival);
  }
  async function talk(key) {
    const f = G.flags, B = f.b, first = !f.talked.includes(key);
    switch (key) {
      case 'postwoman':
        if (B.page) return G.say(D.postwomanAfter);
        if (!B.met) { await G.say(D.postwoman1); addTo('talked', 'postwoman'); K.artifact('triangle'); set('met'); return; }
        return G.say(D.postwoman2);
      case 'worker':
        if (first) { await G.say(D.worker1); addTo('talked', 'worker'); }
        if (f.tracks.includes(PROOFS.plant)) return G.say(D.workerDone);
        if (!['crate1', 'crate2', 'crate3'].every(k => B[k])) return first ? undefined : G.say(D.workerWait);
        await G.say(D.workerDone, FACTS.evac); await quiz('sov_evac'); return proof(PROOFS.plant);
      case 'librarian': case 'akyn':
        addTo('talked', key);
        if (f.tracks.includes(PROOFS.library)) return G.say(key === 'akyn' ? D.librarian1.slice(1, 2) : D.librarian2);
        if (!B.met) return G.say(D.librarian2);
        await G.say(D.librarian1, FACTS.zhambyl); addTo('talked', 'librarian'); addTo('talked', 'akyn');
        await quiz('sov_zhambyl'); return proof(PROOFS.library);
      case 'evacuee':
        addTo('talked', 'evacuee');
        if (B.reunion) return G.say(D.evacueeAfter);
        await G.say(D.evacuee1); set('lookFor'); return;
      case 'mother': return G.say(D.reunion.slice(0, 1));
      case 'instructor':
        addTo('talked', 'instructor');
        if (B.twin9 && !B.ppsh) { await G.say(D.alarm); set('ppsh'); applyWeapons(E, b()); applyWorld(G); return; }
        if (B.ppsh) return G.say(B.ppshDone ? D.ppshDone : D.ppshWait);
        if (B.instructorDone) return G.say(D.instructorDone);
        if (!frontDone(f)) return G.say(D.instructor1.slice(0, 1));
        if (!B.rifle) { await G.say(D.instructor1, FACTS.panfilov); await quiz('sov_316'); set('rifle'); applyWeapons(E, b()); applyWorld(G); return; }
        return G.say(D.instructorWait);
    }
  }
  async function interact(key) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'gate9':
        if (!B.page) return G.say(D.gateLocked);
        G.sfx('portal');
        if (!B.finished) return G.cine('home', cutHome);
        if (G.levelPassed()) return G.gotoLevel(10);
        return G.results();
      case 'crate1': case 'crate2': case 'crate3':
        if (B[key] || !B.met) return;
        set(key); G.sfx('pickup'); await G.say(D.crate);
        if (['crate1', 'crate2', 'crate3'].every(k => b()[k])) K.toast('Үш жәшік — Сәулеге бар', 'Три ящика — иди к Сауле');
        return;
      case 'lists':
        if (B.reunion) return G.say(D.lists);
        if (!B.lookFor) return G.say(D.postwoman2);
        await G.say(D.lists); return G.cine('reunion', cutReunion);
      case 'postbag': return G.say(D.postwoman2);
      case 'riflerack': return G.say(B.rifle ? D.instructorWait : D.instructor1.slice(0, 1));
      case 'names':
        if (B.page) return G.say(D.names.slice(1));
        if (!B.heirDown) return G.say(D.hallLocked);
        return finale();
      // secrets
      case 'turksib': if (!B.turksib) { set('turksib'); G.sfx('secret'); await G.say(D.turksib); } return quiz('sov_ind');
      case 'heroines': if (!B.heroines) { set('heroines'); G.sfx('secret'); await G.say(D.heroines); } return quiz('sov_heroes');
      case 'famine': if (!B.famine) { set('famine'); G.sfx('secret'); await G.say(D.famine); } return quiz('sov_famine');
      case 'deport': if (!B.deport) { set('deport'); G.sfx('secret'); await G.say(D.deport); } return quiz('sov_deport');
      case 'cards': { await K.secret('cards', D.cards); K.artifact('card'); return; }
      case 'ninestars': { const fresh = !B.ninestars; await K.secret('ninestars', D.ninestars); if (fresh) K.anomaly('map09'); return; }
    }
  }
  async function finale() {
    await G.say(D.names);
    K.artifact('nameslist');
    await quiz('sov_memory');
    set('page'); G.forceNpc = true; applyWorld(G);
    G.sfx('page');
    await G.say(D.page);
    if (pageLines(G.flags) < PAGE_TOTAL) await G.say(D.pageDistorted);
    G.save(true);
  }
  async function trigger(key) {
    const B = b(), f = G.flags;
    if (key === 'station' && !B.stationSeen) { set('stationSeen'); return G.say(D.stationFirst); }
    if (key === 'orchard' && trainingDone(f) && !B.twin9) return twin9();
    if (key === 'hall' && B.ppshDone && !B.bossSeen) return G.cine('hall', cutHall);
  }
  async function enemyDied(i, type) {
    if (type === 6 && !b().heirDown) return G.cine('heirDown', cutHeirDown);
  }

  // ---------------------------------------------------------------- the training ground (per frame)
  const watchShots = makeArrowWatch(E), stabWatch = makeStrikeWatch(E);
  let hintAt = 0;
  function hit(key, x, y) { if (b()[key]) return; set(key); G.sfx('impact'); G.spawnFx([x, y - 14], 0, 12); }
  function frame() {
    if (!E || G.busy?.()) return;
    const B = b(), [hx, hy] = G.heroPos();
    if (B.rifle && !B.instructorDone) {
      watchShots(RIFLE_T.filter(t => !B[t.key]), t => {
        if (Math.hypot(hx - t.x, hy - t.y) < RANGE_MIN) { if (performance.now() - hintAt > 2500) { hintAt = performance.now(); G.say(D.instructorClose); } return; }
        hit(t.key, t.x, t.y);
      });
      stabWatch(G, {weapon: 1, targets: BAYONET_T.filter(t => !B[t.key]), near: 50, onHit: t => hit(t.key, t.x, t.y)});
      if ([...RIFLE_T, ...BAYONET_T].every(t => b()[t.key])) { set('instructorDone'); G.save(true); G.say(D.instructorDone); }
    }
    if (B.ppsh && !B.ppshDone) {
      watchShots(BURST_T.filter(t => !B[t.key]), t => hit(t.key, t.x, t.y));
      if (BURST_T.every(t => b()[t.key])) { set('ppshDone'); G.save(true); G.say(D.ppshDone); }
    }
  }
  const T = {zone: -1};
  function tick() {
    if (!E || G.busy?.()) return;
    const z = E.tj_state(2);
    if (z !== T.zone) { T.zone = z; applyWorld(G); }
  }

  // ---------------------------------------------------------------- cutscenes
  async function cutArrival(d) {
    d.music('mystery');
    const hero = G.heroPos();
    d.pose(A.idle, 1); d.face(0); d.cam(hero[0], hero[1] - 20, 999); d.light(200, 196, 190, true);
    G.sfx('portal'); await d.flash(500); d.fx(hero[0], hero[1] - 8, 7, 18); await d.fadeIn(1400); await d.wait(400);
    await d.say(D.arrive.slice(0, 2));
    d.cam(...P(34, 63), 1); await d.wait(1500);   // the train
    d.cam(...P(16, 44), 1.2); await d.wait(1200); // the plant
    d.cam(...P(46, 12), 1.2); await d.wait(1200); // the hall of memory
    d.cam(hero[0], hero[1] - 10, 1.6); await d.wait(400);
    await d.say(D.arrive.slice(2));
    d.music('village');
    d.final(() => set('arrived'));
  }
  async function cutReunion(d) {
    d.music('camp');
    E.tj_npc_set(NPC.mother, ...P(36, 63), 6, A.walk, 1); show('mother'); npcAt('evacuee', 30, 62, 2, A.idle);
    E.tj_npc_goto(NPC.mother, ...P(31.6, 62), 1, A.idle);
    d.cam(...P(33, 61), 1.8); await d.wait(1200);
    await d.say(D.reunion);
    d.final(() => { set('reunion'); addTo('tracks', PROOFS.station); G.forceNpc = true; applyWorld(G); });
  }
  async function cutTwin9(d) {
    d.music('off');
    npcAt('twin9', 74, 14, 4, A.idle); show('twin9');
    d.cam(...P(74, 13), 1.8); await d.wait(900);
    await d.say(D.orchard);
    await d.say(D.twin9);
    d.final(() => set('twin9Heard'));
  }
  // The choice is asked outside the cutscene (the panel and the film never overlap); then he leaves an apple and goes.
  async function twin9() {
    await G.cine('twin9', cutTwin9);
    const c = await G.choose(CHOICES.twin);
    await G.say(c === 1 ? [...D.twin9Ask, ...D.twin9Ally] : D.twin9Ally);
    G.sfx('secret'); E.tj_fog(80); G.spawnFx(P(74, 13.6), 2, 10);
    setTimeout(() => E.tj_fog(0), 500);
    hide('twin9'); set(c === 1 ? 'askedStitch' : 'brother'); set('twin9'); K.artifact('apple');
    G.save(true);
  }
  async function cutHall(d) {
    d.music('off');
    d.cam(...P(46, 11), 1.4); await d.wait(800);
    G.sfx('heartbeat');
    await d.say(D.hall);
    d.music('witness');
    d.final(() => { set('bossSeen'); applyWorld(G); });
  }
  async function cutHeirDown(d) {
    d.music('off');
    const ex = E.tj_enemy(BOSS, 2) / 1000 || P(46, 11)[0], ey = E.tj_enemy(BOSS, 3) / 1000 || P(46, 11)[1];
    d.cam(ex, ey - 10, 1.6); await d.wait(600);
    d.fx(ex, ey - 12, 2, 24); E.tj_shake(8);
    await d.say(D.heirDown);
    d.final(() => { set('heirDown'); G.forceNpc = true; applyWorld(G); });
    d.music('mystery');
  }
  async function cutHome(d) {
    d.music('camp');
    const [hx, hy] = G.heroPos(); d.cam(hx, hy - 10, 1.8); await d.wait(500);
    await d.say(D.home);
    d.final(() => { set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); G.forceNpc = true; });
    d.after(() => G.complete());
  }
  function mirror(id) {
    const s = {reunion: cutReunion, twin9: cutTwin9, hall: cutHall, heirDown: cutHeirDown, home: cutHome}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates() {}, enemyDied, bossTalk() {}, tick, frame, mirror};
}

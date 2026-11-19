// MAP08 «Өрт» quest logic (grow-only flags). talked = people heard, tracks = the three voices of one year (land, trade,
// revolt). New combat: the flintlock musket (slow, long, heavy; bullets) and the bayonet on its barrel; the sabre stays.
// The night of 1838: the fortress burns, Aidar breaks three jammed doors (hold E) — he rescues, he does not fight the
// sides. Then the Chronicler (one of Zulmat's two selves) in the smoke: the second image's behaviour, and when he stops
// fighting he names the bait and Aidar's hand (the turning point), followed by the big motion comic «Өрт».
import {MAP08} from './gen/map08.js';
import {A, TS, IT, P, indexes, scoring, kit, arm, makeStrikeWatch} from './epochkit.js';
import {makeArrowWatch} from './range.js';
import {FIRE, MELEE} from './weapons.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, PROOFS, FACTS, ARTIFACTS, PAGE_IDS, VOICES} from './story08.js';

export const {IA, NPC, TRIG, TAG} = indexes(MAP08);
const SC = scoring(HISTORICAL_QUIZZES, SECRETS, PAGE_IDS);
export const {MAX_SCORE, PASS_SCORE, TRIAL_POINTS, scoreOf, pageLines, secretsFound, PAGE_TOTAL} = SC;
export const BOSS = MAP08.enemies.findIndex(e => e.type === 9);
export const MUSKET_T = [66, 72].map((x, k) => ({x: x * TS, y: 47.4 * TS, key: 'musketT' + (k + 1)}));
export const BAYONET_T = [64, 68, 72].map((x, k) => ({x: x * TS, y: 58.6 * TS, key: 'bayonetT' + (k + 1)}));
export const MUSKET = [2, 64, 10, 40, 260, 0], BAYONET = [1, 34, 9, 26, 46, 7], SABRE = [0, 28, 5, 14, 28, 16];
export const RANGE_MIN = 8 * TS;
const VOICE_PROOF = {akbope: 'land', tatar: 'trade', sarbaz: 'revolt'};

export const voicesDone = f => VOICES.every(k => f.tracks.includes(PROOFS[VOICE_PROOF[k]]));
export const armsDone = f => !!f.b.sentryDone;
export const rescued = b => !!(b.door1 && b.door2 && b.door3);
export function questStage(f) {
  const b = f.b;
  if (b.finished) return 'done';
  if (b.page) return 'home';
  if (b.chronDown) return 'page';
  if (rescued(b)) return 'smoke';
  if (b.night) return 'fire';
  if (voicesDone(f) && armsDone(f)) return 'night';
  if (voicesDone(f)) return 'arms';
  if (b.met) return 'voices';
  return 'arrive';
}
export function questTarget(f) {
  const stage = questStage(f), b = f.b;
  if (stage === 'voices') return {npc: NPC[VOICES.find(k => !f.tracks.includes(PROOFS[VOICE_PROOF[k]]))]};
  if (stage === 'fire') return {ia: IA[['door1', 'door2', 'door3'].find(k => !b[k])]};
  if (stage === 'night' || stage === 'smoke') return {ia: IA.officedesk};
  const t = QUESTS[stage].target;
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

const ZONE_LIGHT = [[214, 200, 176], [206, 196, 180], [220, 200, 170], [218, 202, 172], [206, 196, 176], [196, 206, 210], [212, 200, 176], [186, 176, 160]];
export function applyWeapons(E, b) {
  // Flintlock: one round, a flash in the pan before the shot, ~2.5 s to reload. Bayonet: a step into the thrust.
  arm(E, {tunes: [SABRE, ...(b.lesson ? [BAYONET, MUSKET] : [])], sabre: 1, bullets: 1, hero: 'aibargun', fire: b.lesson ? FIRE.musket : FIRE.bow, pole: MELEE.bayonet});
}
export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const tag = (key, hidden) => E.tj_tag(TAG[key], hidden ? 1 : 0);
  tag('burnt', !b.night);
  for (const k of Object.keys(IA)) ia(k, true);
  for (const k of ['door1', 'door2', 'door3']) ia(k, !!b.night && !b[k], 90);
  // Groups: 1 horse thieves on the road, 2 raiders in the night's chaos, 3 ink shades in the smoke, 4 the Chronicler.
  E.tj_groups((b.met ? 1 << 1 : 0) | (b.night && !b.chronDown ? 1 << 2 | 1 << 3 : 0) | (b.bossSeen && !b.chronDown ? 1 << 4 : 0));
  applyWeapons(E, b);
  E.tj_torch(0);
  const z = E.tj_state(2);
  if (b.night && !b.chronDown) { E.tj_light(118, 74, 64); E.tj_fog(z === 1 || z === 7 ? 90 : 40); }
  else { E.tj_fog(0); E.tj_light(...(b.page ? [200, 200, 214] : ZONE_LIGHT[z] || ZONE_LIGHT[0])); }
  const arm_ = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {fort: !b.fortSeen, range: false, camp: false, court: (voicesDone(f) && armsDone(f) && !b.night) || (rescued(b) && !b.bossSeen)};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm_(k, on); G.armed[k] = on; }
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  npcFlags('tilmash', true, !b.met ? 2 : 0);
  for (const k of VOICES) npcFlags(k, true, b.met && !f.talked.includes(k) ? 2 : 0);
  npcFlags('sentry8', true, voicesDone(f) && !b.lesson ? 2 : 0);
  npcFlags('teacher', true, b.met && !f.talked.includes('teacher') ? 1 : 0);
  if (G.forceNpc || G.npcState !== String(b.bossSeen)) {
    G.npcState = String(b.bossSeen); npcFlags('chron', false, 0, 1);
    for (const k of ['tilmash', 'akbope', 'tatar', 'sarbaz', 'sentry8', 'teacher']) E.tj_npc_routine(NPC[k]);
  }
  G.forceNpc = false;
  G.K?.grant('kit', true, () => E.tj_item_add(IT.herb, 2));
  G.K?.grant('musket', b.lesson, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 12); });
  G.K?.grant('page', b.page, () => E.tj_item_add(IT.page, 1));
}

export function createQuest(G) {
  const {E} = G;
  const K = G.K = kit(G, MAP08, {ARTIFACTS, D});
  G.applyWorld = () => applyWorld(G);
  const {b, set, addTo, npcAt, hide, show} = K;
  const quiz = id => G.quiz(SC.QID[id]);
  const proof = async id => { if (addTo('tracks', id)) { G.sfx('secret'); if (voicesDone(G.flags) && !b().voicesSaid) { set('voicesSaid'); await G.say(D.voicesDone); } } };

  async function start() {
    E.tj_teleport(...P(49, 72.4)); E.tj_checkpoint(...P(49, 72.4));
    return G.cine('arrival', cutArrival);
  }
  async function talk(key) {
    const f = G.flags, B = f.b, first = !f.talked.includes(key);
    switch (key) {
      case 'tilmash':
        if (B.page) return G.say(D.tilmashAfter);
        if (!B.met) { await G.say(D.tilmash1, FACTS.ustav); addTo('talked', 'tilmash'); await quiz('rus_1822'); set('met'); return; }
        return G.say(D.tilmash2);
      case 'akbope':
        if (B.door1) return G.say(D.akbopeAfter);
        if (B.night) return G.say(D.akbope2);
        if (first) { await G.say(D.akbope1); addTo('talked', 'akbope'); }
        if (!f.quiz.rus_fort && B.met) { await quiz('rus_fort'); return proof(PROOFS.land); }
        return G.say(D.akbope1.slice(1));
      case 'tatar':
        if (first) { await G.say(D.tatar1); addTo('talked', 'tatar'); }
        if (!f.quiz.rus_trade && B.met) { await quiz('rus_trade'); return proof(PROOFS.trade); }
        return G.say(D.tatar2);
      case 'sarbaz':
        if (first) { await G.say(D.sarbaz1, FACTS.kenesary); addTo('talked', 'sarbaz'); }
        if (!f.quiz.rus_kenesary && B.met) { await quiz('rus_kenesary'); return proof(PROOFS.revolt); }
        return G.say(D.sarbaz2);
      case 'sentry8':
        addTo('talked', 'sentry8');
        if (B.sentryDone) return G.say(D.sentryAfter);
        if (!voicesDone(f)) return G.say(D.sentry1.slice(0, 1));
        if (!B.lesson) { await G.say(D.sentry1); set('lesson'); applyWeapons(E, b()); K.artifact('flint'); return; }
        return G.say(D.sentry1.slice(2));
      case 'teacher':
        if (first) { await G.say(D.teacher1); addTo('talked', 'teacher'); return; }
        return G.say(D.teacher2);
    }
  }
  async function interact(key, hold) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'gate8':
        if (!B.page) return G.say(D.gateLocked);
        G.sfx('portal');
        if (!B.finished) return G.cine('home', cutHome);
        if (G.levelPassed()) return G.gotoLevel(9);
        return G.results();
      case 'officedesk':
        if (B.page) return G.say(D.officedesk.slice(1));
        if (B.chronDown) return finale();
        return G.say(voicesDone(f) ? D.tilmash2 : D.voicesNeeded);
      case 'musketrack': return G.say(B.lesson ? D.sentryAfter : D.armsNeeded);
      case 'door1': case 'door2': case 'door3': {
        if (!B.night || B[key]) return;
        if (!hold) return G.say(D.doorHint);
        set(key); G.sfx('impact'); E.tj_shake(6); G.spawnFx(K.pos(key), 1, 14);
        await G.say(D.door[+key.slice(-1) - 1]);
        if (rescued(b()) && !b().rescuedSaid) { set('rescuedSaid'); await G.say(D.rescued); }
        return;
      }
      // secrets
      case 'dombra': if (!B.dombra) { set('dombra'); G.sfx('secret'); await G.say(D.dombra, FACTS.isatay); } return quiz('rus_isatay');
      case 'oldsabre': { await K.secret('oldsabre', D.oldsabre); K.artifact('shezhire_sabre'); return; }
      case 'primer': if (!B.primer) { set('primer'); G.sfx('secret'); await G.say(D.primer); } return quiz('rus_school');
      case 'letter': return K.secret('letter', D.letter);
      case 'plough': if (!B.plough) { set('plough'); G.sfx('secret'); await G.say(D.plough); } return quiz('rus_aul');
      case 'keys': { const fresh = !B.keys; await K.secret('keys', D.keys); if (fresh) K.anomaly('map08'); return; }
    }
  }
  async function finale() {
    await G.say(D.officedesk);
    K.artifact('register');
    await quiz('rus_sources');
    set('page'); G.forceNpc = true; applyWorld(G);
    G.sfx('page');
    await G.say(D.page);
    if (pageLines(G.flags) < PAGE_TOTAL) await G.say(D.pageDistorted);
    await G.say(D.afterComic);
    G.save(true);
  }
  async function trigger(key) {
    const B = b(), f = G.flags;
    if (key === 'fort' && !B.fortSeen) { set('fortSeen'); return G.say(D.fortFirst); }
    if (key === 'court') {
      if (G.armed) G.armed.court = null;
      if (voicesDone(f) && armsDone(f) && !B.night) return G.cine('night', cutNight);
      if (rescued(B) && !B.bossSeen) return G.cine('smoke', cutSmoke);
    }
  }
  async function enemyDied() {}
  // The Chronicler stops fighting (engine event, phase 3): he speaks — the bait, the hand — then the big comic.
  async function bossTalk() {
    if (b().chronDown) return;
    await G.cine('refusal', cutRefusal);
    if (G.comic) await G.comic();
    G.save(true);
  }

  // ---------------------------------------------------------------- the range (per frame)
  const watchShots = makeArrowWatch(E), bayonetWatch = makeStrikeWatch(E);
  let hintAt = 0;
  function hit(key, x, y) { if (b()[key]) return; set(key); G.sfx('impact'); G.spawnFx([x, y - 14], 0, 12); }
  function frame() {
    if (!E || G.busy?.()) return;
    const B = b();
    if (!B.lesson || B.sentryDone) return;
    const [hx, hy] = G.heroPos();
    watchShots(MUSKET_T.filter(t => !B[t.key]), t => {
      if (Math.hypot(hx - t.x, hy - t.y) < RANGE_MIN) { if (performance.now() - hintAt > 2500) { hintAt = performance.now(); G.say(D.sentryClose); } return; }
      hit(t.key, t.x, t.y);
    });
    bayonetWatch(G, {weapon: 1, targets: BAYONET_T.filter(t => !B[t.key]), near: 52, onHit: t => hit(t.key, t.x, t.y)});
    if ([...MUSKET_T, ...BAYONET_T].every(t => b()[t.key]) && !b().sentryDone) { set('sentryDone'); G.save(true); G.say(D.sentryDone); }
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
    d.pose(A.idle, 1); d.face(0); d.cam(hero[0], hero[1] - 20, 999); d.light(200, 190, 170, true);
    G.sfx('portal'); await d.flash(500); d.fx(hero[0], hero[1] - 8, 7, 18); await d.fadeIn(1400); await d.wait(400);
    await d.say(D.arrive.slice(0, 3));
    d.cam(...P(49, 33), 1); await d.wait(1600);   // the fortress
    d.cam(...P(22, 40), 1.2); await d.wait(1200); // the aul under the walls
    d.cam(...P(16, 12), 1.2); await d.wait(1200); // the sarbaz camp
    d.cam(hero[0], hero[1] - 10, 1.6); await d.wait(400);
    await d.say(D.arrive.slice(3));
    d.music('village');
    d.final(() => set('arrived'));
  }
  async function cutNight(d) {
    d.music('danger');
    d.light(120, 80, 70);
    d.cam(...P(49, 33), 1.2); await d.wait(800);
    G.sfx('shout'); E.tj_shake(10);
    await d.say(D.night);
    d.fx(...P(46, 30), 1, 18); d.fx(...P(56, 36), 1, 18); G.sfx('impact');
    d.final(() => { set('night'); G.forceNpc = true; applyWorld(G); });
  }
  async function cutSmoke(d) {
    d.music('off');
    npcAt('chron', 50, 34, 4, A.idle); show('chron');
    d.cam(...P(50, 34), 1.8); await d.wait(900);
    G.sfx('heartbeat');
    await d.say(D.smoke);
    d.fx(...P(50, 33.6), 2, 16); hide('chron');
    d.music('witness');
    d.final(() => { hide('chron'); set('bossSeen'); G.forceNpc = true; applyWorld(G); });
  }
  async function cutRefusal(d) {
    d.music('off');
    const ex = E.tj_enemy(BOSS, 2) / 1000 || P(50, 35)[0], ey = E.tj_enemy(BOSS, 3) / 1000 || P(50, 35)[1];
    d.cam(ex, ey - 10, 1.6); await d.wait(700);
    await d.say(D.refusal);
    d.fx(ex, ey - 12, 2, 26); G.sfx('portal'); E.tj_shake(10);
    await d.say(D.chronGone);
    d.final(() => { set('chronDown'); K.artifact('ink'); G.forceNpc = true; applyWorld(G); });
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
    const s = {night: cutNight, smoke: cutSmoke, refusal: cutRefusal, home: cutHome}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates() {}, enemyDied, bossTalk, tick, frame, mirror};
}

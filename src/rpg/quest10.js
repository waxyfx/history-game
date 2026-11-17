// MAP10 «Он бірінші тігіс» — the finale (grow-only flags). talked = people heard, tracks = the three lines of the tenth
// page (the square, the lobby, the archive). The second Aidar's sacrifice opens the hall; the fight with Zulmat follows
// the canon (docs/story-canon.md 1.3): with each phase Aidar loses gear — the bow and arrows, then the spear and the
// artifacts — until only the sword is left; at the health floor Zulmat wounds him (the eye), he falls, and the motion
// comic shows Түйінші, the reveal, the transfer, the merging and the fire in the socket. Then, with the fire, he ends it.
import {MAP10} from './gen/map10.js';
import {A, TS, IT, P, indexes, scoring, kit, arm} from './epochkit.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, PROOFS, FACTS, ARTIFACTS, PAGE_IDS, STEPS} from './story10.js';

export const {IA, NPC, TRIG, TAG} = indexes(MAP10);
const SC = scoring(HISTORICAL_QUIZZES, SECRETS, PAGE_IDS);
export const {MAX_SCORE, PASS_SCORE, TRIAL_POINTS, scoreOf, pageLines, secretsFound, PAGE_TOTAL} = SC;
export const BOSS = MAP10.enemies.findIndex(e => e.type === 11);
export const FLOOR = 20;   // % of Zulmat's health where the canon takes over (the wound, the comic)
export const ARTIFACT_FLAGS = ['twinline', 'erased'];

export const truthDone = f => STEPS.every(k => f.tracks.includes(PROOFS[k]));
export function questStage(f) {
  const b = f.b;
  if (b.finished || b.page) return 'done';
  if (b.zulmatDown) return 'page';
  if (b.sacrifice) return 'hall';
  if (truthDone(f)) return 'door';
  if (b.met) return 'truth';
  return 'arrive';
}
export function questTarget(f) {
  const stage = questStage(f);
  if (stage === 'truth') {
    if (!f.tracks.includes(PROOFS.lobby)) return {npc: NPC.prof};
    return {ia: IA.semey};
  }
  if (stage === 'done') return {ia: IA.gate10};
  const t = QUESTS[stage].target;
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

const ZONE_LIGHT = [[206, 212, 222], [212, 214, 222], [196, 214, 226], [176, 200, 220], [150, 160, 196], [214, 220, 214]];
export function applyWeapons(E, b) { arm(E, {hero: b.merged ? 'aibarfire' : 'aibar'}); E.tj_boss_floor(b.merged ? 0 : FLOOR); }
export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  for (const k of Object.keys(IA)) ia(k, true);
  // Groups: 1 shades in the street, 2 shades in the archive, 3 shades in the hall, 4 Zulmat.
  E.tj_groups((b.met ? 1 << 1 : 0) | (f.tracks.includes(PROOFS.lobby) ? 1 << 2 : 0) | (b.bossSeen && !b.zulmatDown ? 1 << 3 | 1 << 4 : 0));
  applyWeapons(E, b);
  E.tj_torch(0);
  const z = E.tj_state(2);
  E.tj_light(...(b.page ? [222, 222, 232] : b.bossSeen && !b.zulmatDown && z === 4 ? [128, 132, 176] : ZONE_LIGHT[z] || ZONE_LIGHT[0]));
  const arm_ = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {square: !b.squareSeen, lobby: !!b.met && !b.lobbySeen, hall: !!b.sacrifice && !b.bossSeen, archive: false};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm_(k, on); G.armed[k] = on; }
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  npcFlags('citizen', true, !b.met ? 2 : 0);
  npcFlags('prof', true, b.met && !f.tracks.includes(PROOFS.lobby) ? 2 : 0);
  npcFlags('dana', true, 0); npcFlags('erlan', true, 0); npcFlags('guard10', true, 0);
  if (G.forceNpc || G.npcState !== String(b.sacrifice)) {
    G.npcState = String(b.sacrifice); npcFlags('twin10', false, 0, 1); npcFlags('knot', false, 0, 1);
    for (const k of ['citizen', 'prof', 'dana', 'erlan', 'guard10']) E.tj_npc_routine(NPC[k]);
  }
  G.forceNpc = false;
  // The gear Aidar carries home from nine epochs; the finale takes it away again (losses are flags, re-applied on load).
  G.K?.grant('kit', true, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 20); E.tj_item_add(IT.herb, 3); });
  if (b.lostBow) { E.tj_item_add(IT.bow, -9); E.tj_item_add(IT.arrows, -99); }
  if (b.lostSpear) E.tj_item_add(IT.spear, -9);
  if ((b.lostBow && E.tj_state(13) === 2) || (b.lostSpear && E.tj_state(13) === 1)) E.tj_equip(0);
  G.K?.grant('page', b.page, () => E.tj_item_add(IT.page, 1));
}

export function createQuest(G) {
  const {E} = G;
  const K = G.K = kit(G, MAP10, {ARTIFACTS, D});
  G.applyWorld = () => applyWorld(G);
  const {b, set, addTo, npcAt, hide, show} = K;
  const quiz = id => G.quiz(SC.QID[id]);
  const proof = async id => { if (addTo('tracks', id)) { G.sfx('secret'); if (truthDone(G.flags) && !b().truthSaid) { set('truthSaid'); await G.say(D.truthDone); } } };

  async function start() {
    E.tj_teleport(...P(42, 66.4)); E.tj_checkpoint(...P(42, 66.4));
    return G.cine('arrival', cutArrival);
  }
  async function talk(key) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'citizen':
        if (!B.met) { await G.say(D.citizen1); addTo('talked', 'citizen'); set('met'); return; }
        return G.say(D.citizen2);
      case 'dana': case 'erlan':
        addTo('talked', key);
        return G.say(B.page ? D.ending.slice(key === 'dana' ? 0 : 1, key === 'dana' ? 1 : 2) : D.lobby);
      case 'prof':
        addTo('talked', 'prof');
        if (!B.met) return G.say(D.prof2);
        if (!f.tracks.includes(PROOFS.lobby)) { await G.say(D.prof1, FACTS.symbols); await quiz('ind_symbols'); return proof(PROOFS.lobby); }
        return G.say(D.prof2);
      case 'guard10': addTo('talked', 'guard10'); return G.say(D.guard1);
    }
  }
  async function interact(key) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'gate10':
        if (!B.page) return G.say(D.gateLocked);
        if (!B.finished) return G.cine('home', cutEnding);
        return G.results();
      case 'monument':
        if (!B.met) return G.say(D.squareFirst);
        if (!f.quiz.ind_1991) { await G.say(D.squareFirst, FACTS.independence); await quiz('ind_1991'); }
        return proof(PROOFS.square);
      case 'symbols': return G.say(D.prof1.slice(0, 1));
      case 'semey':
        if (!f.tracks.includes(PROOFS.lobby)) return G.say(D.guard1);
        if (!f.quiz.ind_semey) { await G.say(D.semey, FACTS.semey); K.artifact('erased'); await quiz('ind_semey'); }
        return proof(PROOFS.archive);
      case 'halldoor':
        if (B.sacrifice) return;
        if (!truthDone(f)) return G.say(D.doorLocked);
        return G.cine('sacrifice', cutSacrifice);
      case 'gatecore':
        if (B.page) return G.say(D.page.slice(1));
        if (!B.zulmatDown) return G.say(D.gatecore.slice(0, 1));
        return finale();
      // secrets
      case 'zheltoqsan': if (!B.zheltoqsan) { set('zheltoqsan'); G.sfx('secret'); await G.say(D.zheltoqsan); } return quiz('ind_zheltoqsan');
      case 'constitution': if (!B.constitution) { set('constitution'); G.sfx('secret'); await G.say(D.constitution); } return quiz('ind_constitution');
      case 'tenge': if (!B.tenge) { set('tenge'); G.sfx('secret'); await G.say(D.tenge); } return quiz('ind_tenge');
      case 'astana': if (!B.astana) { set('astana'); G.sfx('secret'); await G.say(D.astana); } return quiz('ind_capital');
      case 'book': return K.secret('book', D.book);
      case 'tencharms': { const fresh = !B.tencharms; await K.secret('tencharms', D.tencharms); if (fresh) K.anomaly('map10'); return; }
    }
  }
  async function finale() {
    await G.say(D.gatecore);
    await quiz('ind_shezhire');
    set('page'); G.forceNpc = true; applyWorld(G);
    G.sfx('page');
    await G.say(D.page);
    if (pageLines(G.flags) < PAGE_TOTAL) await G.say(D.pageDistorted);
    G.save(true);
  }
  async function trigger(key) {
    const B = b();
    if (key === 'square' && !B.squareSeen) { set('squareSeen'); return G.say(D.squareFirst); }
    if (key === 'lobby' && !B.lobbySeen) { set('lobbySeen'); return G.say(D.lobby); }
    if (key === 'hall' && B.sacrifice && !B.bossSeen) return G.cine('boss', cutBoss);
  }
  async function enemyDied(i, type) {
    if (type === 11 && !b().zulmatDown) return G.cine('zulmatDown', cutZulmatDown);
  }

  // ---------------------------------------------------------------- the final fight (4 Hz): gear loss, the wound
  const T = {zone: -1, busy: false};
  async function wound() {
    T.busy = true;
    await G.cine('wound', cutWound);
    if (G.comic) await G.comic();
    set('merged'); K.artifact('stitch'); E.tj_heal(100); applyWorld(G);
    await G.say(D.afterComic);
    G.save(true);
    T.busy = false;
  }
  function tick() {
    if (!E || G.busy?.() || T.busy) return;
    const B = b(), z = E.tj_state(2);
    if (z !== T.zone) { T.zone = z; applyWorld(G); }
    if (!B.bossSeen || B.zulmatDown || BOSS < 0) return;
    const hp = E.tj_enemy(BOSS, 0), phase = E.tj_enemy(BOSS, 14), max = 1200;
    if (phase >= 2 && !B.lostBow) { set('lostBow'); applyWorld(G); G.sfx('shadow'); G.say(D.loseBow); return; }
    if (phase >= 3 && !B.lostSpear) {
      set('lostSpear'); set('artifactsLost'); applyWorld(G); G.sfx('shadow');
      K.toast('Артефакттар жоғалды. Тек қылыш қалды.', 'Артефакты утрачены. Остался только меч.', 'warn');
      G.say(D.loseSpear); return;
    }
    if (B.lostSpear && !B.merged && hp > 0 && hp <= max * FLOOR / 100) wound();
  }

  // ---------------------------------------------------------------- cutscenes
  async function cutArrival(d) {
    d.music('mystery');
    const hero = G.heroPos();
    d.pose(A.idle, 1); d.face(0); d.cam(hero[0], hero[1] - 20, 999); d.light(206, 212, 222, true);
    G.sfx('portal'); await d.flash(500); d.fx(hero[0], hero[1] - 8, 7, 18); await d.fadeIn(1400); await d.wait(400);
    await d.say(D.arrive.slice(0, 2));
    d.cam(...P(14, 34), 1.1); await d.wait(1300);   // the square
    d.cam(...P(42, 32), 1.1); await d.wait(1300);   // the Institute
    d.cam(...P(42, 10), 1.2); await d.wait(1500);   // the Gate
    d.cam(hero[0], hero[1] - 10, 1.6); await d.wait(400);
    await d.say(D.arrive.slice(2));
    d.music('village');
    d.final(() => set('arrived'));
  }
  async function cutSacrifice(d) {
    d.music('off');
    npcAt('twin10', 43.6, 25.2, 6, A.idle); show('twin10'); d.face(2);
    d.cam(...P(42.6, 24.6), 2); await d.wait(800);
    await d.say(D.sacrifice);
    npcAt('twin10', 42, 23.6, 0, A.walk); G.sfx('heartbeat'); await d.wait(900);
    d.fx(...P(42, 23.4), 2, 30); E.tj_shake(6); G.sfx('portal'); hide('twin10');
    await d.wait(700);
    await d.say(D.sacrificeAfter);
    d.music('mystery');
    d.final(() => { hide('twin10'); set('sacrifice'); K.artifact('twinline'); G.forceNpc = true; applyWorld(G); });
  }
  async function cutBoss(d) {
    d.music('off');
    d.cam(...P(42, 12), 1.4); await d.wait(900);
    G.sfx('heartbeat'); d.fx(...P(42, 11), 2, 24);
    await d.say(D.hall);
    d.music('witness');
    d.final(() => { set('bossSeen'); applyWorld(G); });
  }
  async function cutWound(d) {
    d.music('off');
    const [hx, hy] = G.heroPos();
    d.cam(hx, hy - 10, 2.2); await d.wait(500);
    await d.say(D.wound.slice(0, 1));
    G.sfx('impact'); E.tj_shake(14); d.fx(hx, hy - 16, 1, 20); await d.flash(300);
    d.pose(A.death, 1); await d.wait(900);
    await d.say(D.wound.slice(1));
  }
  async function cutZulmatDown(d) {
    d.music('off');
    const ex = E.tj_enemy(BOSS, 2) / 1000 || P(42, 12)[0], ey = E.tj_enemy(BOSS, 3) / 1000 || P(42, 12)[1];
    d.cam(ex, ey - 10, 1.6); await d.wait(600);
    d.fx(ex, ey - 12, 2, 30); E.tj_shake(10);
    await d.say(D.zulmatDown);
    d.music('mystery');
    d.final(() => { set('zulmatDown'); G.forceNpc = true; applyWorld(G); });
  }
  async function cutEnding(d) {
    d.music('camp');
    npcAt('dana', 40, 62, 0, A.idle); npcAt('erlan', 44, 62, 0, A.idle);
    const [hx, hy] = G.heroPos(); d.cam(hx, hy - 10, 1.6); await d.wait(600);
    await d.say(D.ending);
    d.final(() => { set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); G.forceNpc = true; });
    d.after(() => G.complete());
  }
  function mirror(id) {
    const s = {sacrifice: cutSacrifice, boss: cutBoss, zulmatDown: cutZulmatDown, home: cutEnding}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates() {}, enemyDied, bossTalk() {}, tick, mirror};
}

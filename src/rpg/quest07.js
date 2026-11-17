// MAP07 «Жеті ата» quest logic (grow-only flags; co-op mergeable). talked = people heard, tracks = the three pieces of
// the aul's memory (song, lament, pasture). New combat: the sabre series (every third quick cut is a finishing blow)
// and the naiza charge (a running thrust); both are trained on the batyr's dummies and break the noyon's banners.
import {MAP07} from './gen/map07.js';
import {A, TS, IT, P, indexes, scoring, kit, arm, makeStrikeWatch} from './epochkit.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, PROOFS, FACTS, CHOICES, ARTIFACTS, PAGE_IDS, MEMORY} from './story07.js';

export const {IA, NPC, TRIG, TAG} = indexes(MAP07);
const SC = scoring(HISTORICAL_QUIZZES, SECRETS, PAGE_IDS);
export const {MAX_SCORE, PASS_SCORE, TRIAL_POINTS, scoreOf, pageLines, secretsFound, PAGE_TOTAL} = SC;
export const BOSS = MAP07.enemies.findIndex(e => e.type === 8);
export const SABRE_T = [46, 50, 54].map((x, k) => ({x: x * TS, y: 24.6 * TS, key: 'sabreT' + (k + 1)}));
export const NAIZA_T = [44, 50, 56].map((x, k) => ({x: x * TS, y: 15.2 * TS, key: 'naizaT' + (k + 1)}));
export const SABRE = [0, 28, 5, 14, 28, 16], NAIZA = [1, 32, 10, 28, 52, 8];

export const memoryDone = f => MEMORY.every(k => f.tracks.includes(PROOFS[{zhyrshy: 'song', apa: 'lament', qyz: 'pasture'}[k]]));
export const armsDone = f => !!f.b.batyrDone;
export function questStage(f) {
  const b = f.b;
  if (b.finished) return 'done';
  if (b.page) return 'home';
  if (b.noyonDown) return 'page';
  if (b.councilDone) return 'ridge';
  if (memoryDone(f) && armsDone(f)) return 'council';
  if (memoryDone(f)) return 'arms';
  if (b.met) return 'memory';
  return 'arrive';
}
export function questTarget(f) {
  const stage = questStage(f), b = f.b;
  if (stage === 'memory') { const k = MEMORY.find(k => !f.tracks.includes(PROOFS[{zhyrshy: 'song', apa: 'lament', qyz: 'pasture'}[k]])); return {npc: NPC[k]}; }
  if (stage === 'arms') return b.sabreGiven ? {npc: NPC.batyr} : {npc: NPC.usta};
  if (stage === 'ridge') return b.bossSeen ? {ia: IA.ancestor} : {ia: IA.ancestor};
  const t = QUESTS[stage].target;
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

const ZONE_LIGHT = [[226, 206, 176], [232, 210, 178], [228, 206, 172], [224, 200, 170], [222, 214, 176], [210, 214, 206], [204, 200, 196], [214, 190, 168]];
export function applyWeapons(E, b) {
  arm(E, {tunes: [...(b.sabreGiven ? [SABRE] : []), ...(b.lessons ? [NAIZA] : [])], sabre: b.sabreGiven, lance: b.lessons});
}
export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const met = !!b.met;
  for (const k of Object.keys(IA)) ia(k, true);
  ia('ancestor', true);
  // Groups: 1 wolves at the pastures, 2 the vanguard by the ford, 3 the screen on the ridge, 4 the noyon.
  E.tj_groups((met ? 1 << 1 : 0) | (b.councilDone ? 1 << 2 | 1 << 3 : 0) | (b.bossSeen && !b.noyonDown ? 1 << 4 : 0));
  applyWeapons(E, b);
  E.tj_torch(0);
  E.tj_light(...(b.page ? [214, 214, 224] : ZONE_LIGHT[E.tj_state(2)] || ZONE_LIGHT[0]));
  const arm_ = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {aul: !b.aulSeen, ford: false, hill: !!b.councilDone && !b.twin7, ridge: !!b.councilDone && !b.bossSeen};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm_(k, on); G.armed[k] = on; }
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  npcFlags('aksakal', true, !met ? 2 : 0);
  for (const k of MEMORY) npcFlags(k, true, met && !f.talked.includes(k) ? 2 : 0);
  npcFlags('usta', true, memoryDone(f) && !b.sabreGiven ? 2 : 0);
  npcFlags('batyr', true, b.sabreGiven && !b.lessons ? 2 : 0);
  npcFlags('bi', true, memoryDone(f) && armsDone(f) && !b.councilDone ? 2 : 0);
  if (G.forceNpc || G.npcState !== String(b.twin7)) {
    G.npcState = String(b.twin7); npcFlags('twin7', false, 0, 1);
    for (const k of ['aksakal', 'batyr', 'zhyrshy', 'apa', 'usta', 'qyz', 'bi']) E.tj_npc_routine(NPC[k]);
  }
  G.forceNpc = false;
  const K = G.K;
  K?.grant('kit', true, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 16); E.tj_item_add(IT.herb, 2); });
  K?.grant('page', b.page, () => E.tj_item_add(IT.page, 1));
}

export function createQuest(G) {
  const {E} = G;
  const K = G.K = kit(G, MAP07, {ARTIFACTS, D});
  G.applyWorld = () => applyWorld(G);
  const {b, set, addTo, npcAt, hide, show} = K;
  const quiz = id => G.quiz(SC.QID[id]);
  const proof = async id => { if (addTo('tracks', id)) { G.sfx('secret'); if (memoryDone(G.flags) && !b().memorySaid) { set('memorySaid'); await G.say(D.memoryDone); } } };

  async function start() {
    E.tj_teleport(...P(44, 68.4)); E.tj_checkpoint(...P(44, 68.4));
    return G.cine('arrival', cutArrival);
  }
  const wolvesAlive = () => MAP07.enemies.some((e, i) => e.group === 1 && E.tj_enemy(i, 0) > 0);
  async function talk(key) {
    const f = G.flags, B = f.b, first = !f.talked.includes(key);
    switch (key) {
      case 'aksakal':
        if (!B.met) { await G.say(D.aksakal1, FACTS.zheti); addTo('talked', 'aksakal'); set('met'); return; }
        return G.say(B.page ? D.aksakalAfter : D.aksakal2);
      case 'zhyrshy':
        if (!B.met) return G.say(D.zhyrshy2);
        if (first) { await G.say(D.zhyrshy1); addTo('talked', 'zhyrshy'); }
        if (!f.quiz.kaz_zheti) { await quiz('kaz_zheti'); return proof(PROOFS.song); }
        return G.say(D.zhyrshy2);
      case 'apa':
        if (!B.met) return G.say(D.apa2);
        if (first) { await G.say(D.apa1, FACTS.aktaban); addTo('talked', 'apa'); }
        if (!f.quiz.kaz_aktaban) { await quiz('kaz_aktaban'); return proof(PROOFS.lament); }
        return G.say(D.apa2);
      case 'qyz':
        if (first) { await G.say(D.qyz1); addTo('talked', 'qyz'); }
        if (wolvesAlive()) return first ? undefined : G.say(D.qyz1.slice(1));
        if (!f.quiz.kaz_turt) { await G.say(D.qyz2); await quiz('kaz_turt'); }
        return proof(PROOFS.pasture);
      case 'usta':
        addTo('talked', 'usta');
        if (!memoryDone(f)) return G.say(D.usta1.slice(0, 1));
        if (!B.sabreGiven) { await G.say(D.usta1); set('sabreGiven'); K.artifact('sabre'); applyWeapons(E, b()); return; }
        return G.say(D.usta2);
      case 'batyr':
        addTo('talked', 'batyr');
        if (!B.sabreGiven) return G.say(D.armsNeeded);
        if (!B.lessons) { await G.say(D.batyr1); set('lessons'); applyWeapons(E, b()); K.toast('Қылыш: 1-2-3 · Найза: Shift + шабуыл', 'Сабля: 1-2-3 · Найза: Shift + атака'); return; }
        if (!B.batyrDone) return G.say(D.batyrHintSabre);
        return G.say(D.batyrAfter);
      case 'bi':
        addTo('talked', 'bi');
        if (B.councilDone) return G.say(D.biAfter);
        if (!memoryDone(f) || !armsDone(f)) return G.say(D.councilNeeded);
        await G.say(D.bi1, FACTS.jarghy);
        if (!f.quiz.kaz_jarghy) await quiz('kaz_jarghy');
        { const c = await G.choose(CHOICES.council); set(c === 1 ? 'councilMove' : 'councilStay'); await G.say(c === 1 ? D.choiceMove : D.choiceStay); }
        set('councilDone'); G.save(true); return;
    }
  }

  async function interact(key) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'gate7':
        if (!B.page) return G.say(D.gateLocked);
        G.sfx('portal');
        if (!B.finished) return G.cine('home', cutHome);
        if (G.levelPassed()) return G.gotoLevel(8);
        return G.results();
      case 'jarghy': return B.councilDone ? G.say(D.biAfter) : G.say(D.bi1.slice(1));
      case 'sabrerack': return B.sabreGiven ? G.say(D.usta2) : talk('usta');
      case 'lancerack': if (B.batyrDone) return quiz('kaz_zhuz'); return G.say(B.lessons ? D.batyrHintLance : D.armsNeeded);
      case 'pasture': return G.say(D.pasture);
      case 'ancestor':
        if (B.page) return G.say(D.ancestor.slice(1));
        if (!B.noyonDown) return G.say(D.hill);
        return finale();
      // secrets
      case 'saba': return K.secret('saba', D.saba);
      case 'tuskiiz': if (!B.tuskiiz) { set('tuskiiz'); G.sfx('secret'); await G.say(D.tuskiiz); } return quiz('kaz_kiiz');
      case 'oldbox': if (!B.oldbox) { set('oldbox'); G.sfx('secret'); await G.say(D.oldbox); K.artifact('horde_coin'); } return quiz('kaz_turkistan');
      case 'qyzhorse': return K.secret('qyzhorse', D.qyzhorse);
      case 'ninepits': { const fresh = !B.ninepits; await K.secret('ninepits', D.ninepits); if (fresh) K.anomaly('map07'); return; }
      case 'gatestone': { await K.secret('gatestone', B.twin7 ? D.twin7Gone : D.gatestone); if (B.twin7) K.artifact('palm'); return; }
    }
  }
  async function finale() {
    await G.say(D.ancestor);
    await quiz('kaz_bulanty');
    set('page'); G.forceNpc = true; applyWorld(G);
    G.sfx('page');
    await G.say(D.page);
    if (pageLines(G.flags) < PAGE_TOTAL) await G.say(D.pageDistorted);
    G.save(true);
  }
  async function trigger(key) {
    const B = b();
    if (key === 'aul' && !B.aulSeen) { set('aulSeen'); return G.say(D.aulFirst); }
    if (key === 'hill' && B.councilDone && !B.twin7) return G.cine('twin7', cutTwin7);
    if (key === 'ridge' && B.councilDone && !B.bossSeen) return G.cine('boss', cutBoss);
  }
  async function enemyDied(i, type) {
    if (type === 8 && !b().noyonDown) return G.cine('noyonDown', cutNoyonDown);
    if (type === 0 && !wolvesAlive() && !b().wolvesDone) { set('wolvesDone'); K.toast('Қасқырлар кетті — Аружанға бар', 'Волки ушли — иди к Аружан'); }
  }

  // ---------------------------------------------------------------- the training ground (per frame)
  const sabreWatch = makeStrikeWatch(E), naizaWatch = makeStrikeWatch(E);
  let hintAt = 0;
  const hint = lines => { if (performance.now() - hintAt > 2500) { hintAt = performance.now(); G.toast?.(lines[0][G.lang?.() === 'ru' ? 'ru' : 'kk'], 'warn'); } };
  function hit(key, x, y) { if (b()[key]) return; set(key); G.sfx('impact'); G.spawnFx([x, y - 14], 0, 12); }
  function frame() {
    if (!E || G.busy?.()) return;
    const B = b();
    if (!B.lessons || B.batyrDone) return;
    sabreWatch(G, {weapon: 0, targets: SABRE_T.filter(t => !B[t.key]), need: 'combo', near: 44, onHit: t => hit(t.key, t.x, t.y), onMiss: () => hint(D.batyrHintSabre)});
    naizaWatch(G, {weapon: 1, targets: NAIZA_T.filter(t => !B[t.key]), need: 'run', near: 60, onHit: t => hit(t.key, t.x, t.y), onMiss: () => hint(D.batyrHintLance)});
    if ([...SABRE_T, ...NAIZA_T].every(t => b()[t.key]) && !b().batyrDone) { set('batyrDone'); G.save(true); G.say(D.batyrDone); }
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
    d.pose(A.idle, 1); d.face(0); d.cam(hero[0], hero[1] - 20, 999); d.light(210, 196, 170, true);
    G.sfx('portal'); await d.flash(500); d.fx(hero[0], hero[1] - 8, 7, 18); await d.fadeIn(1400); await d.wait(400);
    await d.say(D.arrive.slice(0, 2));
    d.cam(...P(44, 40), 1); await d.wait(1600);   // the aul
    d.cam(...P(46, 20), 1.2); await d.wait(1300); // the smithy
    d.cam(...P(62, 7), 1.2); await d.wait(1500);  // grey banners on the ridge
    d.cam(hero[0], hero[1] - 10, 1.6); await d.wait(400);
    await d.say(D.arrive.slice(2));
    d.music('village');
    d.final(() => set('arrived'));
  }
  async function cutTwin7(d) {
    d.music('off');
    npcAt('twin7', 84.6, 36.4, 0, A.interact); show('twin7');
    d.cam(...P(84, 36), 1.8); await d.wait(900);
    await d.say(D.twin7.slice(0, 3));
    G.sfx('heartbeat'); await d.wait(600);
    npcAt('twin7', 84.6, 36.4, 6, A.idle);
    await d.say(D.twin7.slice(3));
    E.tj_fog(110); await d.wait(500); hide('twin7'); d.fx(...P(84.6, 36), 2, 10); E.tj_fog(0);
    d.music('steppe');
    d.final(() => { hide('twin7'); E.tj_fog(0); set('twin7'); });
  }
  async function cutBoss(d) {
    d.music('danger');
    d.cam(...P(62, 7), 1.4); await d.wait(900);
    await d.say(D.ridge);
    d.music('witness');
    d.final(() => set('bossSeen'));
  }
  async function cutNoyonDown(d) {
    d.music('off');
    const ex = E.tj_enemy(BOSS, 2) / 1000 || P(62, 7)[0], ey = E.tj_enemy(BOSS, 3) / 1000 || P(62, 7)[1];
    d.cam(ex, ey - 10, 1.6); await d.wait(600);
    await d.say(D.noyonDown, FACTS.bulanty);
    d.final(() => { set('noyonDown'); K.artifact('greyBanner'); G.forceNpc = true; applyWorld(G); });
    d.music('steppe');
  }
  async function cutHome(d) {
    d.music('camp');
    const [hx, hy] = G.heroPos(); d.cam(hx, hy - 10, 1.8); await d.wait(500);
    await d.say(D.home);
    d.final(() => { set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); G.forceNpc = true; });
    d.after(() => G.complete());
  }
  function mirror(id) {
    const s = {twin7: cutTwin7, boss: cutBoss, noyonDown: cutNoyonDown, home: cutHome}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates() {}, enemyDied, bossTalk() {}, tick, frame, mirror};
}

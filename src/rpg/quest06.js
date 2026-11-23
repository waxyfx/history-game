// MAP06 «Алтын Орда» quest logic (same grow-only flag model as MAP01–MAP05; co-op mergeable).
//   talked = people heard, tracks = proofs (story06 PROOFS: 1 copy, 2 coins, 3 yam register), petro = unused.
// Weapons earned in the story (the old ones stay): the cavalry lance (a running spear thrust, tj_lance) from the
// yamchi, and the composite bow (horn + sinew + birch bark → faster draw, longer range) from the bowyer. Both are
// re-applied from the flags on every load (applyWorld → tj_weapon_tune).
// Time anomalies (quiet, never explained): the mudarris quotes what Aidar is about to say; the yam register's
// line moves from «three days ago» to «tomorrow»; the coin's letters change for a moment; two hands in one ink in
// the margins; a hooded figure with a grey scarf on the cavalry field (the false clue — nothing names him).
import {MAP06} from './gen/map06.js';
import {A, TS, IT} from './quest.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, PROOFS, FACTS, CHOICES, ARTIFACTS} from './story06.js';
import {anomaly} from './anomalies.js';
import {makeArrowWatch} from './range.js';
import {arsenal, FIRE, MELEE} from './weapons.js';

export const IA = Object.fromEntries(MAP06.interacts.map((n, i) => [n, i]));
export const NPC = Object.fromEntries(MAP06.npcs.map((n, i) => [n, i]));
export const TRIG = Object.fromEntries(MAP06.triggers.map((n, i) => [n, i]));
export const TAG = Object.fromEntries(MAP06.tags.map((n, i) => [n, i]));
const P = (x, y) => [Math.round(x * TS), Math.round(y * TS)];
const QID = Object.fromEntries(Object.entries(HISTORICAL_QUIZZES).map(([n, q]) => [q.id, +n]));
export const BOSS = MAP06.enemies.findIndex(e => e.type === 10);

export const MAX_SCORE = 100, PASS_SCORE = 60;
export const TRIAL_POINTS = Object.fromEntries(Object.values(HISTORICAL_QUIZZES).map(q => [q.id, q.points]));
export function scoreOf(f) {
  let s = 0;
  for (const [id, r] of Object.entries(f.quiz)) if (r.ok) s += TRIAL_POINTS[id] || 0;
  return Math.min(MAX_SCORE, s);
}
export const PAGE_TOTAL = 4;
export function pageLines(f) { return ['horde_ulus', 'horde_yam', 'horde_trade', 'horde_sources'].filter(id => f.quiz[id]?.ok).length; }
export function secretsFound(f) { return SECRETS.filter(s => f.b[s]).length; }
export const evidenceDone = f => Object.values(PROOFS).every(p => f.tracks.includes(p));
export const MATERIALS = ['horn', 'sinew', 'bark'];
export const armsDone = f => !!f.b.lanceDone && !!f.b.bowDone;

// Weapon tuning (slot: 0 sword, 1 spear, 2 bow): damage, windup, recovery, range, width.
export const COMPOSITE_BOW = [2, 30, 9, 20, 290, 0], CAVALRY_LANCE = [1, 32, 10, 28, 52, 8];
// Training targets (pixels): the lance targets on the yam field, the long-range bow targets at its north edge.
export const LANCE_T = [56, 61, 66].map((x, k) => ({x: x * TS, y: 16.4 * TS, key: 'lanceT' + (k + 1)}));
export const LONG_T = [51, 65].map((x, k) => ({x: x * TS, y: 4.4 * TS, key: 'longT' + (k + 1)}));
export const LONG_MIN = 9 * TS;   // «more than nine steps away»

export function questStage(f) {
  const b = f.b;
  if (b.finished) return 'done';
  if (b.page) return 'home';
  if (b.heraldDown) return 'archive';
  if (b.under) return 'boss';
  if (evidenceDone(f) && armsDone(f)) return 'confront';
  if (evidenceDone(f)) return 'arms';
  if (b.met) return 'evidence';
  return 'arrive';
}
export function questTarget(f) {
  const stage = questStage(f), b = f.b;
  if (stage === 'evidence') {
    if (!f.tracks.includes(PROOFS.copy)) return {ia: IA.genealogy};
    if (!f.tracks.includes(PROOFS.coins)) return {ia: IA.mint};
    return {ia: IA.yamregister};
  }
  if (stage === 'arms') {
    if (!b.lanceDone) return f.talked.includes('yamchi') ? {ia: IA.lancerack} : {npc: NPC.yamchi};
    if (!b.bowyerMet) return {npc: NPC.bowyer};
    if (!b.bowMade) { const m = MATERIALS.find(k => !b[k]); return m ? {ia: IA[m]} : {npc: NPC.bowyer}; }
    return {ia: IA.yamregister};   // the long-range targets stand just north of the yam post
  }
  const t = QUESTS[stage].target;
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

// Warm steppe daylight; the madrasa cooler, the necropolis grey; after the page everything a little paler.
const ZONE_LIGHT = [[214, 196, 166], [220, 200, 168], [226, 202, 160], [196, 192, 186], [168, 170, 176], [200, 204, 196], [218, 200, 164], [222, 196, 156]];
function worldLight(G, zone) {
  const b = G.flags.b;
  if (b.page) return [196, 196, 210];
  return ZONE_LIGHT[zone] || ZONE_LIGHT[0];
}
export function applyWeapons(E, b) {
  if (b.bowMade) E.tj_weapon_tune(...COMPOSITE_BOW); else E.tj_weapon_tune(2, 0, 0, 0, 0, 0);
  if (b.lanceLesson) { E.tj_weapon_tune(...CAVALRY_LANCE); E.tj_lance(1); } else { E.tj_weapon_tune(1, 0, 0, 0, 0, 0); E.tj_lance(0); }
  // Composite bow: a faster, flatter arrow (still drawn and aimed); the lance charges at a run, the spear only thrusts.
  arsenal(E, {fire: b.bowMade ? FIRE.compositeBow : FIRE.bow, blade: MELEE.institute, pole: b.lanceLesson ? MELEE.lance : MELEE.spear});
}

export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const tag = (key, hidden) => E.tj_tag(TAG[key], hidden ? 1 : 0);
  const met = !!b.met, ev = evidenceDone(f);
  for (const m of MATERIALS) tag(m, !!b[m]);
  tag('archiveseal', !!b.heraldDown);
  ia('gate6', true); ia('genealogy', true); ia('mint', true); ia('yamregister', true); ia('caravangate', true);
  ia('bowbench', !!b.bowyerMet); ia('lancerack', true);
  for (const m of MATERIALS) ia(m, !!b.bowyerMet && !b[m] && !b.bowMade);
  ia('archivedoor', true); ia('stairsup', true); ia('origscroll', !!b.heraldDown);
  for (const s of ['turbe', 'margin', 'balbalblock', 'scribehome', 'fivemarks', 'kutadgu']) ia(s, true);
  ia('thread', !!b.heraldDown);
  // Groups: 1 Qarabuqa's patrol at the bazaar, 2 his lancers on the field, 3 the necropolis patrol,
  // 4 ink shades below, 5 the herald of the forged yarlyk.
  E.tj_groups((met ? 1 << 1 : 0) | (b.lanceDone ? 1 << 2 : 0) | (ev ? 1 << 3 : 0) | (b.under ? 1 << 4 : 0) | (b.bossSeen && !b.heraldDown ? 1 << 5 : 0));
  applyWeapons(E, b);
  const area = G.area();
  E.tj_torch(area === 1 ? 1 : 0);
  if (area === 1) E.tj_light(156, 140, 116);
  else E.tj_light(...worldLight(G, E.tj_state(2)));
  const arm = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {town: !b.townSeen, field: !!b.lanceDone && !b.silhouette, ford: false, madrasa: false, necropolis: false,
    hall: !!b.under && !b.hallSeen, arena: !!b.under && !b.bossSeen};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm(k, on); G.armed[k] = on; }
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  npcFlags('scribe', true, !met ? 2 : 0);
  npcFlags('khorezm', true, met && (!f.talked.includes('khorezm') || !f.quiz.horde_otrar) ? 1 : 0);
  npcFlags('mudarris', true, met && (!f.talked.includes('mudarris') || !f.quiz.horde_karakhan) ? 1 : 0);
  npcFlags('yamchi', true, ev && !f.talked.includes('yamchi') ? 2 : 0);
  npcFlags('bowyer', true, ev && b.lanceDone && !b.bowyerMet ? 2 : b.bowyerMet && !b.bowMade && MATERIALS.every(m => b[m]) ? 2 : 0);
  npcFlags('aysha', true, met && !f.quiz.horde_kipchak ? 1 : 0);
  const qVisible = b.heraldDown && !b.choiceMade;
  if (G.forceNpc || G.npcState !== npcState(b)) {
    G.npcState = npcState(b);
    npcFlags('twin6', false, 0, 1);
    if (qVisible) { E.tj_npc_set(NPC.qarabuqa, ...P(28.6, 87.6), 2, A.idle, 1); npcFlags('qarabuqa', false, 0, 0); }
    else npcFlags('qarabuqa', false, 0, 1);
    for (const k of ['scribe', 'khorezm', 'bowyer', 'yamchi', 'mudarris', 'aysha']) E.tj_npc_routine(NPC[k]);
  }
  G.forceNpc = false;
  grant(G, 'kit', true, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 16); E.tj_item_add(IT.torch, 1); E.tj_item_add(IT.herb, 2); });
  grant(G, 'page', b.page, () => E.tj_item_add(IT.page, 1));
}
const npcState = b => [b.heraldDown, b.choiceMade, b.page].map(Number).join('');
function grant(G, key, cond, fn) { if (cond && !G.local.granted.includes(key)) { G.local.granted.push(key); fn(); } }
export const artifactsOf = f => ARTIFACTS.filter(a => f.b[a.flag]);

export function createQuest(G) {
  const {E} = G;
  const b = () => G.flags.b;
  const set = k => { if (!G.flags.b[k]) { G.flags.b[k] = true; G.changed(); applyWorld(G); } };
  const pos = key => MAP06.interactPos[key];
  const quiz = id => G.quiz(QID[id]);
  const addTo = (k, v) => { if (!G.flags[k].includes(v)) { G.flags[k] = [...G.flags[k], v]; G.changed(); applyWorld(G); return true; } return false; };
  const npcAt = (key, x, y, facing = 4, anim = A.idle) => E.tj_npc_set(NPC[key], ...P(x, y), facing, anim, 1);
  const npcGo = (key, x, y, run = 0, anim = A.idle) => E.tj_npc_goto(NPC[key], ...P(x, y), run, anim);
  const hide = key => E.tj_npc_flags(NPC[key], 0, 0, 1);
  const show = key => E.tj_npc_flags(NPC[key], 0, 0, 0);
  const ru = () => G.lang?.() === 'ru';
  function artifact(flag) {
    if (b()[flag]) return;
    set(flag); const a = ARTIFACTS.find(x => x.flag === flag);
    if (a) G.toast?.(`${ru() ? 'Артефакт' : 'Артефакт'}: ${a[ru() ? 'ru' : 'kk']}`, 'good');
  }
  async function proof(id) {
    if (!addTo('tracks', id)) return;
    G.sfx('secret');
    if (evidenceDone(G.flags) && !b().evidenceSaid) { set('evidenceSaid'); await G.say(D.evidenceDone); }
  }
  const secret = async (key, lines, fact) => { if (!b()[key]) { set(key); G.sfx('secret'); } return G.say(lines, fact); };

  // No camp between epochs: Aidar steps out by the road gate, Dana and Erlan speak over the link.
  async function start() {
    E.tj_teleport(...P(44, 69.4)); E.tj_checkpoint(...P(44, 69.4));
    return G.cine('arrival', cutArrival);
  }

  async function talk(key) {
    const f = G.flags, B = f.b, first = !f.talked.includes(key);
    switch (key) {
      case 'scribe':
        if (!B.met) return G.cine('scribe', cutScribe);
        if (B.page) return G.say(D.scribeAfter);
        return G.say(D.scribe2);
      // Secret trials of the IX–XII centuries (audit №14): the people of 1350 remember Otrar, the Karakhanids, the Kipchaks.
      case 'khorezm':
        if (first) { await G.say(D.khorezm1, FACTS.saraychik); addTo('talked', 'khorezm'); }
        if (!f.quiz.horde_otrar) { await G.say(D.otrar, FACTS.otrar); return quiz('horde_otrar'); }
        return G.say(D.khorezm2);
      case 'mudarris':
        if (first) { await G.say(D.mudarris1, FACTS.uzbek); addTo('talked', 'mudarris'); }
        if (!f.quiz.horde_karakhan) { await G.say(D.karakhan, FACTS.karakhan); return quiz('horde_karakhan'); }
        return G.say(D.mudarris2);
      case 'yamchi':
        if (first) { await G.say(D.yamchi1, FACTS.yam); addTo('talked', 'yamchi'); if (!B.lanceLesson) return lanceLesson(); return; }
        if (!B.lanceLesson) return lanceLesson();
        if (!B.lanceDone) return G.say(D.lanceHint);
        return G.say(D.yamchiAfter);
      case 'bowyer':
        addTo('talked', 'bowyer');
        if (B.bowDone) return G.say(D.bowyerDone);
        if (B.bowMade) return G.say(D.bowyerMade.slice(1, 2));
        if (!B.bowyerMet) { await G.say(D.bowyer1, FACTS.compbow); set('bowyerMet'); return; }
        if (MATERIALS.every(m => B[m])) return makeBow();
        return G.say(D.bowyerWait);
      case 'aysha':
        addTo('talked', 'aysha');
        await G.say(D.aysha);
        if (!f.quiz.horde_kipchak) { await G.say(D.kipchak, FACTS.kipchak); return quiz('horde_kipchak'); }
        return;
    }
  }
  async function lanceLesson() {
    await G.say(D.lanceIntro);
    set('lanceLesson'); applyWeapons(E, b());
    G.toast?.(ru() ? 'Копьё всадника: разбег + атака' : 'Салт аттының найзасы: жүгіріс + шабуыл', 'good');
  }
  async function makeBow() {
    G.sfx('knot'); G.spawnFx(pos('bowbench'), 0, 12);
    set('bowMade'); applyWeapons(E, b());
    await G.say(D.bowyerMade);
  }

  async function interact(key, hold) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'gate6':
        if (!B.page) return G.say(D.gateLocked);
        G.sfx('portal');
        if (!B.finished) return G.cine('home', cutHome);
        if (G.levelPassed()) return G.gotoLevel(7);   // MAP06 → MAP07
        return G.results();
      case 'genealogy':
        if (!B.met) return G.say(D.scribe1.slice(0, 1));
        if (f.quiz.horde_ulus) { if (!B.twoHands) { set('twoHands'); G.sfx('secret'); } return G.say(D.genealogyAgain); }
        await quiz('horde_ulus'); return proof(PROOFS.copy);
      case 'mint':
        if (!B.met) return G.say(D.khorezm2);
        if (f.quiz.horde_trade) { if (!B.coinShift) { set('coinShift'); G.sfx('heartbeat'); } return G.say(D.mintAgain); }
        await quiz('horde_trade'); artifact('coin'); return proof(PROOFS.coins);
      case 'yamregister':
        if (!B.met) return G.say(D.caravangate);
        if (f.quiz.horde_yam) {
          if (B.silhouette && !B.regChanged) { set('regChanged'); G.sfx('heartbeat'); return G.say(D.yamregister2); }
          return G.say(D.yamregister2.slice(B.regChanged ? 0 : 1, 2));
        }
        await G.say(D.yamregister1); artifact('register');
        await quiz('horde_yam'); return proof(PROOFS.register);
      case 'lancerack':
        if (!B.lanceLesson) return f.talked.includes('yamchi') ? lanceLesson() : G.say(D.yamchi1.slice(0, 1));
        if (B.lanceDone) return quiz('horde_army');
        return G.say(D.lanceHint);
      case 'bowbench':
        if (B.bowMade) return G.say(B.bowDone ? D.bowyerDone : D.bowyerMade.slice(1, 2));
        if (MATERIALS.every(m => B[m])) return makeBow();
        return G.say(D.bowyerWait);
      case 'horn': case 'sinew': case 'bark':
        if (B[key]) return;
        set(key); G.sfx('pickup'); await G.say(D[key]);
        if (MATERIALS.every(m => b()[m])) G.toast?.(ru() ? 'Все три материала — к Токе' : 'Үш материал да бар — Тоқаға бар', 'good');
        return;
      case 'caravangate': await G.say(D.caravangate); return quiz('horde_paiza');
      case 'kutadgu': if (!f.quiz.horde_books) G.sfx('secret'); await G.say(D.kutadgu); return quiz('horde_books');
      case 'archivedoor':
        if (!evidenceDone(f)) return G.say(D.archiveDoorLocked);
        if (!armsDone(f)) return G.say(D.armsNeeded);
        if (!B.confronted) await G.cine('confront', cutConfront);
        await G.travel(...P(32, 112.4)); E.tj_checkpoint(...P(32, 112.4)); set('under');
        return;
      case 'stairsup':
        return G.travel(...P(90, 31.6));
      case 'origscroll':
        if (B.page) return G.say(D.origscroll.slice(1));
        return finale();
      // secrets
      case 'turbe': if (!B.turbe) { set('turbe'); G.sfx('secret'); await G.say(D.turbe, FACTS.uzbek); } return quiz('horde_islam');
      case 'margin': if (!B.margin) { set('margin'); G.sfx('secret'); await G.say(D.margin); } return quiz('horde_urus');
      case 'balbalblock': return secret('balbalblock', D.balbalblock);
      case 'thread': { const fresh = !B.thread; await secret('thread', D.thread); if (fresh) artifact('thread'); return; }
      case 'scribehome': return secret('scribehome', D.scribehome);
      case 'fivemarks': { const fresh = !B.fivemarks; await secret('fivemarks', D.fivemarks); if (fresh) anomaly(G, 'map06'); return; }
    }
  }

  // The original: the final trial → the choice over the false line → the page → the book (motion comic).
  async function finale() {
    await G.say(D.origscroll);
    await quiz('horde_sources');
    await G.say(D.choiceQarabuqa);
    const c = await G.choose(CHOICES.qarabuqa);
    set(c === 1 ? 'erased' : 'exposed');
    await G.say(c === 1 ? D.eraseLine : D.exposeLine);
    set('choiceMade'); G.forceNpc = true; applyWorld(G);
    set('page'); G.forceNpc = true; applyWorld(G);
    G.sfx('page');
    await G.say(D.page);
    if (pageLines(G.flags) < PAGE_TOTAL) await G.say(D.pageDistorted);
    if (G.comic) await G.comic();
    await G.say(D.afterComic);
    G.save(true);
  }

  async function trigger(key) {
    const B = b();
    if (key === 'town' && !B.townSeen) { set('townSeen'); return G.say(D.townFirst, FACTS.horde); }
    if (key === 'field' && B.lanceDone && !B.silhouette) return G.cine('silhouette', cutSilhouette);
    if (key === 'hall' && !B.hallSeen) { set('hallSeen'); return G.say(D.hall); }
    if (key === 'arena' && !B.bossSeen) return G.cine('boss', cutBoss);
  }
  function plates() {}
  async function enemyDied(i, type) {
    if (type === 10 && !b().heraldDown) return G.cine('bossDown', cutBossDown);
  }
  async function bossTalk() {}

  // ---------------------------------------------------------------- per frame: the lance targets, the long-range bow
  const watchArrows = makeArrowWatch(E);
  const F = {att: 0, hintAt: 0};
  function hit(key, x, y) {
    if (b()[key]) return;
    set(key); G.sfx('impact'); G.spawnFx([x, y - 14], 0, 12);
  }
  function frame() {
    if (!E || G.busy?.() || G.area() !== 0) { F.att = E?.tj_state(15) || 0; return; }
    const B = b(), [hx, hy] = G.heroPos();
    const att = E.tj_state(15);
    // Lance: a fresh spear thrust next to a target; it counts only from a run.
    if (B.lanceLesson && !B.lanceDone && att && !F.att && E.tj_state(13) === 1) {
      const t = LANCE_T.find(t => !B[t.key] && Math.hypot(hx - t.x, hy - t.y) < 60);
      if (t) {
        if (E.tj_state(34) && F.mov) {   // the thrust stops the feet: judge the run by the frame before it
          hit(t.key, t.x, t.y);
          if (LANCE_T.every(t => b()[t.key])) { set('lanceDone'); G.save(true); G.say(D.lanceDone); }
        } else if (performance.now() - F.hintAt > 2500) { F.hintAt = performance.now(); G.toast?.(ru() ? 'Разбегись (Shift) — потом бей' : 'Жүгір (Shift) — сосын сал', 'warn'); }
      }
    }
    F.att = att; F.mov = !att && E.tj_state(33) && E.tj_state(34);
    // Composite bow: the two far targets, hit from more than nine steps away.
    if (B.bowMade && !B.bowDone) {
      watchArrows(LONG_T.filter(t => !B[t.key]), t => {
        if (Math.hypot(hx - t.x, hy - t.y) < LONG_MIN) { if (performance.now() - F.hintAt > 2500) { F.hintAt = performance.now(); G.say(D.bowTooClose); } return; }
        hit(t.key, t.x, t.y);
        if (LONG_T.every(t => b()[t.key])) { set('bowDone'); G.save(true); G.say(D.bowyerDone); }
      });
    }
  }
  const T = {lastZone: -1};
  function tick() {
    if (!E || G.busy?.()) return;
    const zone = E.tj_state(2);
    if (G.area() === 0 && zone !== T.lastZone) { T.lastZone = zone; E.tj_light(...worldLight(G, zone)); }
  }

  // ---------------------------------------------------------------- cutscenes
  async function cutArrival(d) {
    d.music('mystery');
    const hero = G.heroPos();
    d.pose(A.idle, 1); d.face(0); d.cam(hero[0], hero[1] - 20, 999); d.light(200, 186, 160, true);
    G.sfx('portal'); await d.flash(500); d.fx(hero[0], hero[1] - 8, 7, 18); await d.fadeIn(1400); await d.wait(400);
    await d.say(D.arrive.slice(0, 2));
    d.cam(...P(56, 34), 1); await d.wait(1800);     // the town: brick houses and yurts side by side
    d.cam(...P(52, 54), 1.2); await d.wait(1400);   // the bazaar and the mint
    d.cam(...P(90, 30), 1.2); await d.wait(1400);   // the madrasa
    d.cam(...P(60, 12), 1.2); await d.wait(1400);   // the yam station
    d.cam(hero[0], hero[1] - 10, 1.6); await d.wait(500);
    await d.say(D.arrive.slice(2));
    d.music('village');
    d.final(() => set('arrived'));
  }
  async function cutScribe(d) {
    d.music('village');
    d.cam(...P(86, 37), 2); await d.wait(500);
    await d.say(D.scribe1, FACTS.horde);
    // Qarabuqa walks in from the street.
    npcAt('qarabuqa', 80, 40, 2, A.walk); show('qarabuqa'); npcGo('qarabuqa', 84, 39.4);
    d.cam(...P(84, 38.4), 1.8); G.sfx('heartbeat'); await d.wait(1600);
    await d.say(D.qarabuqaArrive);
    npcGo('qarabuqa', 78, 44, 1); await d.wait(1200);
    d.final(() => { hide('qarabuqa'); addTo('talked', 'scribe'); set('met'); G.forceNpc = true; });
  }
  async function cutSilhouette(d) {
    d.music('off');
    npcAt('twin6', 57, 6, 4, A.idle); show('twin6');
    d.cam(...P(57, 7), 1.6); await d.wait(1400);
    await d.say(D.silhouette);
    npcAt('twin6', 57, 6, 0, A.idle); await d.wait(500);
    E.tj_fog(120); await d.wait(600); hide('twin6'); d.fx(...P(57, 5.6), 2, 10); E.tj_fog(0);
    d.music('steppe');
    d.final(() => { hide('twin6'); E.tj_fog(0); set('silhouette'); });
  }
  async function cutConfront(d) {
    d.music('danger');
    npcAt('qarabuqa', 90, 31.6, 4, A.idle); show('qarabuqa');
    d.cam(...P(90, 31), 1.8); await d.wait(600);
    await d.say(D.confront.slice(0, 2));
    npcGo('qarabuqa', 90, 30, 1); await d.wait(900);
    d.fx(...P(90, 29.6), 2, 12); hide('qarabuqa');
    await d.say(D.confront.slice(2));
    d.final(() => { hide('qarabuqa'); set('confronted'); });
  }
  async function cutBoss(d) {
    d.music('off');
    const a = P(32, 95);
    d.cam(a[0], a[1] - 10, 1.4); await d.wait(900);
    G.sfx('heartbeat'); d.fx(a[0], a[1] - 16, 2, 20); await d.wait(500);
    await d.say(D.boss);
    d.music('witness');
    d.final(() => set('bossSeen'));
  }
  async function cutBossDown(d) {
    d.music('off');
    const ex = E.tj_enemy(BOSS, 2) / 1000 || P(32, 95)[0], ey = E.tj_enemy(BOSS, 3) / 1000 || P(32, 95)[1];
    d.cam(ex, ey - 10, 1.6); await d.wait(600);
    d.fx(ex, ey - 12, 2, 26); E.tj_shake(8);
    await d.say(D.bossDown);
    d.final(() => { set('heraldDown'); artifact('yarlyk'); artifact('paiza'); G.forceNpc = true; applyWorld(G); });
    d.cam(...P(32.5, 89.4), 1.6); G.sfx('secret'); await d.wait(1100);
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
    const s = {scribe: cutScribe, silhouette: cutSilhouette, confront: cutConfront, boss: cutBoss, bossDown: cutBossDown, home: cutHome}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates, enemyDied, bossTalk, tick, frame, mirror};
}

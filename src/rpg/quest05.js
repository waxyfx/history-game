// MAP05 quest logic (same grow-only flag model as MAP01–MAP04; co-op mergeable).
//   talked = people heard, tracks = proofs (story05 PROOFS), petro = unused.
// Psychological layer (all reversible, none of it blocks progress):
//   · the journal (the HUD tracker) silently rewrites two entries: gather → gather2, home → home2;
//   · people contradict each other and themselves (Kumis denies her son after the first meeting, the herdsman
//     denies the meeting he watched, the sentry repeats his words with one line changed);
//   · repeated events: the herdsman's route (the second time he stops and looks), the music cutting out at the
//     same bend of the road, an orange scarf appearing where there was none;
//   · the environment: per-zone moonlight, a reflection in the lake that lags behind, a balbal that appears and
//     faces Aibar if he lingers on the field;
//   · reactions to real, tracked actions: the MAP04 tally choice (read from the MAP04 save), the answer given to
//     Kül Tegin, and the MAP05 secrets already found.
import {MAP05} from './gen/map05.js';
import {A, TS, IT} from './quest.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, SECRET_NAMES, WITNESSES, SIDES, PROOFS, FACTS, CHOICES} from './story05.js';
import {anomaly} from './anomalies.js';

export const IA = Object.fromEntries(MAP05.interacts.map((n, i) => [n, i]));
export const NPC = Object.fromEntries(MAP05.npcs.map((n, i) => [n, i]));
export const TRIG = Object.fromEntries(MAP05.triggers.map((n, i) => [n, i]));
export const TAG = Object.fromEntries(MAP05.tags.map((n, i) => [n, i]));
const P = (x, y) => [Math.round(x * TS), Math.round(y * TS)];
const QID = Object.fromEntries(Object.entries(HISTORICAL_QUIZZES).map(([n, q]) => [q.id, +n]));
const BOSS = MAP05.enemies.findIndex(e => e.type === 9);

export const MAX_SCORE = 100, PASS_SCORE = 90;
export const TRIAL_POINTS = Object.fromEntries(Object.values(HISTORICAL_QUIZZES).map(q => [q.id, q.points]));
export function scoreOf(f) {
  let s = 0;
  for (const [id, r] of Object.entries(f.quiz)) if (r.ok) s += TRIAL_POINTS[id] || 0;
  return Math.min(MAX_SCORE, s);
}
export const PAGE_TOTAL = 4;
export function pageLines(f) { return ['turk_runes', 'turk_bolchu', 'turk_balbal', 'turk_final'].filter(id => f.quiz[id]?.ok).length; }
export function secretsFound(f) { return SECRETS.filter(s => f.b[s]).length; }
const witnessesDone = f => WITNESSES.every(k => f.talked.includes(k));
const evidenceDone = f => witnessesDone(f) && Object.values(PROOFS).every(p => f.tracks.includes(p));
const sidesDone = f => SIDES.every(k => f.talked.includes(k)) && !!f.quiz.turk_bolchu;
const steleDone = f => !!f.quiz.turk_runes && !!f.quiz.turk_balbal;

export function questStage(f) {
  const b = f.b;
  if (b.finished) return 'done';
  if (b.page) return b.surfaced ? 'home2' : 'home';
  if (b.sealOpen) return 'chamber';
  if (b.under) return 'boss';
  if (b.lakeSeen) return 'ruin';
  if (b.twin1) return 'lake';
  if (evidenceDone(f) && sidesDone(f)) return 'stele';
  if (evidenceDone(f)) return 'ktcamp';
  if (b.met) return f.talked.includes('togyz') ? 'gather2' : 'gather';
  if (b.arrived) return 'arrive';
  return 'camp';
}
export function questTarget(f) {
  const stage = questStage(f), t = QUESTS[stage].target;
  if (stage === 'gather' || stage === 'gather2') {
    if (!f.tracks.includes(PROOFS.gate)) return {ia: IA.burntgate};
    const w = WITNESSES.find(k => !f.talked.includes(k)); if (w) return {npc: NPC[w]};
    if (!f.tracks.includes(PROOFS.cradle)) return {ia: IA.cradle};
    return {ia: IA.runeboard};
  }
  if (stage === 'ktcamp') { const s = SIDES.find(k => !f.talked.includes(k)); return {npc: NPC[s || 'tonyukuk']}; }
  if (stage === 'stele') return {ia: f.quiz.turk_runes && !f.quiz.turk_balbal ? IA.balbals : IA.stele};
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

// Cold moonlight; each place has its own (the camp fire is warm, the field and the hill are cold).
const ZONE_LIGHT = [[92, 100, 146], [128, 116, 142], [130, 92, 104], [182, 150, 124], [82, 92, 140], [96, 116, 162], [96, 102, 146], [80, 82, 124]];
function worldLight(G, zone) {
  const b = G.flags.b;
  if (b.page) return [150, 144, 180];
  const [r, g, bl] = ZONE_LIGHT[zone] || ZONE_LIGHT[0];
  return b.twin1 && zone !== 3 ? [r - 14, g - 10, bl] : [r, g, bl];
}

export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const tag = (key, hidden) => E.tj_tag(TAG[key], hidden ? 1 : 0);
  tag('scarf', !(b.twin1 && !b.scarf)); tag('balbalx', !b.balbalTurned); tag('chamberseal', b.sealOpen); tag('qinseal', b.qinOpen);
  const arr = !!b.arrived, met = !!b.met;
  ia('campturk', true); ia('campgate', true); ia('holo', true); ia('turkgate', true);
  ia('cradle', met); ia('runeboard', met); ia('burntgate', met); ia('scarf', b.twin1 && !b.scarf);
  ia('stele', arr); ia('statue', arr); ia('balbals', arr); ia('lakestone', true); ia('tamga', true); ia('wolfden', true); ia('oldcamp', true);
  ia('chamberdoor', arr); ia('stairsup', true); ia('inscription', b.sealOpen); ia('qincrack', !b.qinOpen, 90); ia('qinthrone', b.qinOpen);
  // Groups: 1 wolves by the den, 2 echoes of the raid at the gate, 3 shades on the field (after the first meeting),
  // 4 shades below, 5 the second image (until he refuses to fight).
  E.tj_groups((1 << 1) | (b.gateSeen ? 1 << 2 : 0) | (b.twin1 && !b.lakeSeen ? 1 << 3 : 0) | (b.under ? 1 << 4 : 0) | (b.bossSeen && !b.imageDown ? 1 << 5 : 0));
  const area = G.area();
  E.tj_torch(area === 1 ? 1 : 0);
  if (area === 1) E.tj_light(150, 150, 192);
  else if (area === 2) E.tj_light(200, 202, 214);
  else E.tj_light(...worldLight(G, E.tj_state(2)));
  const arm = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {gate: met && !b.gateSeen, sight: met && !b.sightSeen, ktcamp: arr && !b.ktSeen, lake: false,
    herd: met && !(b.herd1 && b.herd2), hush: met && !(b.hush1 && b.hush2), hall: b.under && !b.hallSeen, arena: b.under && !b.bossSeen,
    field: false, hill: false};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm(k, on); G.armed[k] = on; }
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  npcFlags('irkin', arr, arr && !met ? 2 : 0);
  for (const k of WITNESSES) npcFlags(k, met, met && !f.talked.includes(k) ? 2 : 0);
  const ev = evidenceDone(f);
  for (const k of SIDES) npcFlags(k, arr, ev && !f.talked.includes(k) ? 2 : 0);
  const ayanAway = b.twin1 && !b.imageDown;
  npcFlags('ayan', met && !ayanAway, 0, ayanAway); npcFlags('herd', met, 0); npcFlags('qin', b.qinOpen, b.qinOpen && !b.qinMet ? 1 : 0);
  npcFlags('dana', true, 0); npcFlags('erlan', true, 0);
  if (G.forceNpc || G.npcState !== npcState(b)) {
    G.npcState = npcState(b);
    npcFlags('twin', false, 0, 1); npcFlags('reflect', false, 0, 1);
    for (const k of ['irkin', 'kumis', 'togyz', 'sentry', 'herd', 'tonyukuk', 'kultegin']) E.tj_npc_routine(NPC[k]);
    if (!ayanAway) E.tj_npc_routine(NPC.ayan);
  }
  G.forceNpc = false;
  grant(G, 'kit', true, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 14); E.tj_item_add(IT.torch, 1); E.tj_item_add(IT.herb, 2); });
  grant(G, 'page', b.page, () => E.tj_item_add(IT.page, 1));
}
const npcState = b => [b.twin1, b.imageDown, b.qinOpen, b.page].map(Number).join('');
function grant(G, key, cond, fn) { if (cond && !G.local.granted.includes(key)) { G.local.granted.push(key); fn(); } }

// The MAP04 save is read only to quote what the player really did there (never modified).
function talasChoice() {
  try { const s = JSON.parse(localStorage.getItem('tarikh.rpg.v3.L4') || 'null'); const b = s?.flags?.b || {};
    return b.tallyBurned ? 'burned' : b.tallyKept ? 'kept' : 'none'; } catch { return 'none'; }
}

export function createQuest(G) {
  const {E} = G;
  const b = () => G.flags.b;
  const set = k => { if (!G.flags.b[k]) { G.flags.b[k] = true; G.changed(); applyWorld(G); } };
  const pos = key => MAP05.interactPos[key];
  const quiz = id => G.quiz(QID[id]);
  const addTo = (k, v) => { if (!G.flags[k].includes(v)) { G.flags[k] = [...G.flags[k], v]; G.changed(); applyWorld(G); return true; } return false; };
  const npcGo = (key, x, y, run = 0, anim = A.idle) => E.tj_npc_goto(NPC[key], ...P(x, y), run, anim);
  const npcAt = (key, x, y, facing = 4, anim = A.idle) => E.tj_npc_set(NPC[key], ...P(x, y), facing, anim, 1);
  const hide = key => E.tj_npc_flags(NPC[key], 0, 0, 1);
  async function proof(id) {
    if (!addTo('tracks', id)) return;
    G.sfx('secret');
    if (evidenceDone(G.flags) && !b().evidenceSaid) { set('evidenceSaid'); await G.say(D.evidenceDone); }
  }
  const secret = async (key, lines, fact) => { if (!b()[key]) { set(key); G.sfx('secret'); } return G.say(lines, fact); };
  async function start() { return G.cine('camp', cutCamp); }

  async function talk(key) {
    const f = G.flags, B = f.b, first = !f.talked.includes(key);
    switch (key) {
      case 'dana': return G.say(B.finished ? D.home.slice(4) : D.campTalkDana);
      case 'erlan': return G.say(D.campTalkErlan);
      case 'irkin':
        if (!B.met) return G.cine('irkin', cutIrkin);
        return G.say(f.talked.includes('togyz') && B.twin1 ? D.irkin3 : D.irkin2);
      case 'kumis':
        if (B.twin1 && !B.imageDown && !first) return G.say(D.kumisDeny);
        if (B.imageDown) return G.say(D.kumisBack);
        if (!first) return G.say(D.kumis2);
        await G.say(D.kumis1); addTo('talked', 'kumis'); return witnessCheck();
      case 'togyz':
        if (!first) return G.say(D.togyz2);
        await G.say(D.togyz1); addTo('talked', 'togyz'); return witnessCheck();
      case 'sentry':
        if (B.twin1) { await G.say(D.sentry2); if (first) { addTo('talked', 'sentry'); return witnessCheck(); } return; }
        await G.say(D.sentry1); if (first) { addTo('talked', 'sentry'); return witnessCheck(); } return;
      case 'ayan': return G.say(D.ayan);
      case 'herd':
        if (B.twin1 && !B.herdDenied) { set('herdDenied'); return G.say(D.herdDeny); }
        return G.say(D.herd3);
      case 'tonyukuk':
        if (first) { await G.say(D.tonyukuk1, FACTS.tonyukuk); addTo('talked', 'tonyukuk'); }
        if (!f.quiz.turk_bolchu) { await quiz('turk_bolchu'); applyWorld(G); return sideCheck(); }
        return G.say(D.tonyukuk2, FACTS.turgesh);
      case 'kultegin': {
        if (!first) return G.say(D.kultegin2);
        await G.say(D.kultegin1, FACTS.kultegin);
        const c = await G.choose(CHOICES.kultegin);
        set(['gateYes', 'gateNo', 'gateUnsure'][c] || 'gateUnsure');
        await G.say(D.kulteginAnswer[c] || D.kulteginAnswer[2]);
        addTo('talked', 'kultegin'); return sideCheck();
      }
      case 'qin':
        if (!B.qinMet) { set('qinMet'); await G.say(D.qin); anomaly(G, 'map05'); return; }
        return G.say(D.qinAgain);
    }
  }
  async function witnessCheck() {
    if (witnessesDone(G.flags) && !b().witnessesSaid) { set('witnessesSaid'); await G.say(D.witnessesDone); }
    if (evidenceDone(G.flags) && !b().evidenceSaid) { set('evidenceSaid'); await G.say(D.evidenceDone); }
  }
  async function sideCheck() { if (sidesDone(G.flags)) { applyWorld(G); G.save(true); } }

  async function interact(key, hold) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'campturk':
        if (B.page) return G.say(D.campTalkErlan);
        G.sfx('portal');
        await G.travel(...P(40, 69.4));
        if (!B.arrived) return G.cine('arrival', cutArrival);
        return;
      case 'turkgate':
        if (!B.page) return G.say(D.turkgateLocked);
        G.sfx('portal'); await G.travel(...P(89, 99));
        if (!B.finished) return G.cine('home', cutHome);
        return;
      case 'campgate': return G.say(D.campgateLocked);
      case 'holo': return G.results();
      case 'cradle': await G.say(D.cradle); return proof(PROOFS.cradle);
      case 'runeboard':
        await G.say(D.runeboard); await proof(PROOFS.runeboard);
        return quiz('turk_talas');
      case 'burntgate': await G.say(D.gate); return proof(PROOFS.gate);
      case 'scarf': return secret('scarf', D.scarf);
      case 'stele': {
        if (f.quiz.turk_runes) { if (canTwin1()) return G.cine('twin1', cutTwin1); return G.say(D.steleAgain); }
        await quiz('turk_runes'); applyWorld(G);
        return maybeTwin1();
      }
      case 'balbals': {
        if (f.quiz.turk_balbal) { if (canTwin1()) return G.cine('twin1', cutTwin1); return G.say(D.balbalsAgain); }
        await quiz('turk_balbal'); applyWorld(G);
        return maybeTwin1();
      }
      case 'statue': if (!B.statue) { set('statue'); G.sfx('secret'); await G.say(D.statue); } return quiz('turk_kultegin');
      case 'tamga': if (!B.tamga) { set('tamga'); G.sfx('secret'); await G.say(D.tamga); } return quiz('turk_tamga');
      case 'wolfden': if (!B.wolfden) { set('wolfden'); G.sfx('secret'); await G.say(D.wolfden); } return quiz('turk_wolf');
      case 'lakestone': return secret('lakestone', D.lakestone);
      case 'oldcamp': return secret('oldcamp', D.oldcamp);
      case 'chamberdoor':
        if (!B.lakeSeen) return G.say(D.chamberdoorLocked);
        await G.travel(...P(32, 113)); E.tj_checkpoint(...P(32, 113)); set('under');
        return;
      case 'stairsup':
        await G.travel(...P(94, 54.2));
        if (B.page && !B.surfaced) set('surfaced');   // the journal entry for «home» quietly rewrites itself
        return;
      case 'inscription':
        if (B.page) return G.say(D.inscriptionAgain);
        return finale();
      case 'qincrack':
        if (B.qinOpen) return;
        if (!hold) return G.say(D.qincrackHint);
        set('qinOpen'); G.sfx('secret'); E.tj_shake(8); G.spawnFx(pos('qincrack'), 1, 14); G.forceNpc = true; applyWorld(G);
        return;
      case 'qinthrone': return talk('qin');
    }
  }
  // The first meeting happens on the field, and only once both versions and the other side were heard.
  const canTwin1 = () => !b().twin1 && steleDone(G.flags) && evidenceDone(G.flags) && sidesDone(G.flags);
  async function maybeTwin1() { if (canTwin1()) { G.save(true); return G.cine('twin1', cutTwin1); } }
  // The impossible proof: the wall in Aibar's hand → the final trial → the last meeting → the page → the vision.
  async function finale() {
    await G.say(D.inscription);
    await quiz('turk_final');
    await G.cine('twin3', cutTwin3);
    set('page'); G.forceNpc = true; applyWorld(G);
    G.sfx('page');
    await G.say(D.page);
    if (pageLines(G.flags) < PAGE_TOTAL) await G.say(D.pageDistorted);
    if (G.comic) await G.comic();
    await G.say(D.afterVision);
    G.save(true);
  }

  async function trigger(key) {
    const B = b();
    if (key === 'gate' && !B.gateSeen) return G.cine('gate', cutGate);
    if (key === 'sight' && !B.sightSeen) return G.cine('sight', cutSight);
    if (key === 'ktcamp' && !B.ktSeen) return G.cine('ktcamp', cutKtcamp);
    if (key === 'lake' && B.twin1 && !B.lakeSeen) return G.cine('lake', cutLake);
    if (key === 'hall' && !B.hallSeen) { set('hallSeen'); return G.say(D.hall); }
    if (key === 'arena' && !B.bossSeen) return G.cine('boss', cutBoss);
    if (key === 'herd') return herdPass();
    if (key === 'hush') return hush();
  }
  // Repeated event 1: the herdsman's route. The first time he passes by; after the meeting on the field he stops.
  async function herdPass() {
    const B = b();
    if (G.armed) G.armed.herd = null;   // engine triggers fire once: re-arm for the next pass
    if (!B.herd1) { set('herd1'); return G.say(D.herd1); }
    if (B.twin1 && !B.herd2) {
      set('herd2'); const [hx, hy] = G.heroPos();
      E.tj_npc_set(NPC.herd, hx + 26, hy - 6, 6, A.idle, 1);
      await G.say(D.herd2); E.tj_npc_routine(NPC.herd);
    }
  }
  // Repeated event 2: the music breaks off at the same bend of the road (twice).
  async function hush() {
    const B = b();
    if (G.armed) G.armed.hush = null;
    const key = !B.hush1 ? 'hush1' : B.twin1 && !B.hush2 ? 'hush2' : null;
    if (!key) return;
    set(key); G.music?.('off'); E.tj_fog(120);
    await G.say(key === 'hush1' ? D.hush : D.hush2);
    setTimeout(() => { E.tj_fog(0); G.musicZone?.(); }, 1800);
  }
  function plates() {}
  async function enemyDied() {}
  // The boss stops fighting in his third phase (engine event): he talks, then he is gone; the seal opens.
  async function bossTalk() {
    if (b().imageDown) return;
    return G.cine('refusal', cutRefusal);
  }

  // ---------------------------------------------------------------- per-tick (4 Hz) psychological layer
  const T = {last: null, prev: null, still: 0, lastZone: -1};
  function tick() {
    if (!E || G.busy?.()) return;
    const B = b(), zone = E.tj_state(2), [x, y] = G.heroPos();
    if (G.area() === 0 && zone !== T.lastZone) { T.lastZone = zone; E.tj_light(...worldLight(G, zone)); }
    // The lake: the reflection follows a tick late; after the first meeting, two ticks late.
    const onShore = zone === 5 && x > 8 * TS && x < 27 * TS && y > 49 * TS && y < 55.6 * TS && !B.lakeSeen;
    if (onShore) {
      const lag = B.twin1 ? T.prev : T.last, src = lag || [x, y, E.tj_state(3), false];
      E.tj_npc_set(NPC.reflect, Math.round(src[0]), Math.round(2 * 55.6 * TS - src[1]), (12 - src[2]) % 8, src[3] ? A.walk : A.idle, 1);
      E.tj_npc_flags(NPC.reflect, 0, 0, 0);
      T.reflectOn = true;
      // After the first meeting: watch the lagging reflection for ~2 s, then the second meeting begins.
      if (B.twin1 && ++T.shore >= 8) { T.shore = 0; G.cine('lake', cutLake); }
    } else { T.shore = 0; if (T.reflectOn) { T.reflectOn = false; E.tj_npc_flags(NPC.reflect, 0, 0, 1); } }
    const moving = T.last ? Math.hypot(x - T.last[0], y - T.last[1]) > 2 : false;
    T.prev = T.last; T.last = [x, y, E.tj_state(3), moving];
    // The field: stand still long enough after the first meeting and one more balbal is there, facing you.
    // «Lingering» = staying within ~3.5 tiles of the same spot for ~18 s (small steps and knock-backs do not reset it).
    if (zone === 4 && B.twin1 && !B.balbalTurned) {
      if (!T.anchor || Math.hypot(x - T.anchor[0], y - T.anchor[1]) > 56) { T.anchor = [x, y]; T.still = 0; }
      else if (++T.still >= 72) { set('balbalTurned'); G.sfx('secret'); G.say(D.balbalx); }
    } else { T.still = 0; T.anchor = null; }
  }

  // ---------------------------------------------------------------- cutscenes
  async function cutCamp(d) {
    d.music('camp');
    const hero = G.heroPos(); d.cam(hero[0], hero[1] - 10, 999);
    await d.fadeIn(1200);
    npcGo('dana', 86.5, 99); npcGo('erlan', 91.5, 99); await d.wait(700);
    await d.say(D.camp.slice(0, 2));
    d.cam(...P(89, 95), 1.6); G.sfx('page'); d.fx(...P(89, 94), 0, 14); await d.wait(900);
    await d.say(D.camp.slice(2));
    d.final(() => { G.forceNpc = true; E.tj_npc_routine(NPC.dana); E.tj_npc_routine(NPC.erlan); });
  }
  async function cutArrival(d) {
    d.music('mystery');
    const hero = G.heroPos();
    // Stepped through the camp gate standing — arrives standing (no fall / wake-up).
    d.pose(A.idle, 1); d.face(0); d.cam(hero[0], hero[1] - 20, 999); d.light(110, 118, 170, true);
    G.sfx('portal'); await d.flash(500); d.fx(hero[0], hero[1] - 8, 7, 18); await d.fadeIn(1400); await d.wait(500);
    await d.say(D.arrive.slice(0, 2));
    d.cam(...P(20, 28), .9); await d.wait(2400);      // the aul, its fires
    d.cam(...P(57, 40), 1.2); await d.wait(1600);     // the stone on the field
    d.cam(...P(88, 18), 1.2); await d.wait(1600);     // the camp of the wolf banners
    d.cam(...P(36, 28), 1.4); await d.wait(1200);     // someone at the gate
    await d.say(D.arrive.slice(2));
    d.music('steppe');
    d.final(() => set('arrived'));
  }
  async function cutIrkin(d) {
    d.music('village');
    const [hx, hy] = G.heroPos();
    npcAt('irkin', hx / TS + 1.6, hy / TS - .6, 6, A.idle);
    d.cam(hx + 14, hy - 12, 2); await d.wait(600);
    await d.say(D.irkin1.slice(0, 5));
    G.sfx('heartbeat'); await d.wait(500);
    await d.say(D.irkin1.slice(5));
    d.cam(...P(36, 29), 1.4); await d.wait(1300);
    d.final(() => { addTo('talked', 'irkin'); set('met'); E.tj_npc_routine(NPC.irkin); });
  }
  async function cutGate(d) {
    d.music('mystery');
    const [hx, hy] = G.heroPos();
    d.cam(hx + 10, hy - 10, 1.6); await d.wait(700);
    d.fx(...P(37, 29), 1, 16); G.sfx('breath');
    await d.say(D.gateFirst);
    // Echoes of that night step out of the smoke.
    d.cam(...P(45, 29), 1.6); G.sfx('shadow'); await d.wait(900);
    d.final(() => set('gateSeen'));
  }
  async function cutSight(d) {
    d.music('off');
    const [hx, hy] = G.heroPos();
    npcAt('twin', hx / TS, hy / TS - 13, 4, A.idle);
    d.cam(hx, hy - 150, 1.2); await d.wait(1600);
    await d.say(D.sight.slice(0, 1));
    E.tj_fog(140); await d.wait(700); hide('twin'); d.fx(hx, hy - 13 * TS, 2, 10); E.tj_fog(0);
    await d.wait(600);
    await d.say(D.sight.slice(1));
    d.music('steppe');
    d.final(() => { hide('twin'); set('sightSeen'); });
  }
  async function cutKtcamp(d) {
    d.music('village');
    d.cam(...P(88, 18), 1.4); await d.wait(900);
    await d.say(D.ktcampFirst.slice(0, 1));
    npcAt('twin', 79.4, 28.4, 2, A.idle); d.cam(...P(80, 26), 2); await d.wait(900);
    hide('twin'); G.sfx('secret'); await d.wait(500);
    await d.say(D.ktcampFirst.slice(1));
    d.final(() => { hide('twin'); set('ktSeen'); });
  }
  async function cutTwin1(d) {
    d.music('off');
    const [hx, hy] = G.heroPos();
    const tx = hx / TS + 3.2, ty = hy / TS + .4;
    npcAt('twin', tx, ty, 6, A.idle); d.face(2);
    d.cam(hx + 26, hy - 10, 1.4); E.tj_shadow(...P(tx, ty - .6), 60); d.light(96, 108, 160);
    G.sfx('heartbeat'); await d.wait(1200);
    await d.say(D.twin1);
    await d.say([D.twin1Tally[talasChoice()]]);
    const B = G.flags.b, ans = B.gateYes ? 0 : B.gateNo ? 1 : B.gateUnsure ? 2 : -1;
    if (ans >= 0) await d.say([D.twin1Answer[ans]]);
    await d.say(D.twin1b.slice(0, 3));
    G.sfx('secret'); E.tj_fog(150); await d.wait(500);
    await d.say(D.twin1b.slice(3));
    hide('twin'); d.fx(...P(tx, ty), 2, 14); E.tj_shadow(0, 0, 0); await d.wait(700); E.tj_fog(0);
    d.music('mystery');
    d.final(() => { hide('twin'); E.tj_shadow(0, 0, 0); E.tj_fog(0); set('twin1'); G.forceNpc = true; });
  }
  async function cutLake(d) {
    d.music('off');
    const [hx, hy] = G.heroPos();
    d.cam(hx, hy + 30, 1.4); await d.wait(800);
    await d.say(D.lake);
    // The reflection stops following and stands up out of the water — no: it is beside him now.
    E.tj_npc_flags(NPC.reflect, 0, 0, 1);
    npcAt('twin', hx / TS + 2.6, hy / TS - .2, 6, A.idle); d.face(2); G.sfx('heartbeat');
    d.cam(hx + 20, hy - 8, 1.6); await d.wait(900);
    await d.say(D.twin2);
    hide('twin'); d.fx(hx + 2.6 * TS, hy, 2, 12); G.sfx('secret');
    d.cam(...P(94, 52), 1.6); await d.wait(1500);
    d.music('mystery');
    d.final(() => { hide('twin'); E.tj_npc_flags(NPC.reflect, 0, 0, 1); set('lakeSeen'); });
  }
  async function cutBoss(d) {
    d.music('off');
    const a = MAP05.enemies[BOSS] ? P(32, 95) : G.heroPos();
    d.cam(a[0], a[1] - 10, 1.4); await d.wait(900);
    G.sfx('heartbeat'); d.fx(a[0], a[1] - 16, 2, 20); await d.wait(500);
    await d.say(D.boss);
    d.music('witness');
    d.final(() => set('bossSeen'));
  }
  async function cutRefusal(d) {
    d.music('off');
    const ex = E.tj_enemy(BOSS, 2) / 1000, ey = E.tj_enemy(BOSS, 3) / 1000;
    d.cam(ex, ey - 10, 1.6); await d.wait(700);
    await d.say(D.refusal);
    d.fx(ex, ey - 12, 2, 26); G.sfx('portal'); E.tj_shake(10);
    d.final(() => { set('imageDown'); set('sealOpen'); G.forceNpc = true; applyWorld(G); });
    d.cam(...P(32.5, 89.4), 1.6); await d.wait(1200);
    await d.say(D.sealOpen);
    d.music('mystery');
  }
  async function cutTwin3(d) {
    d.music('off');
    const [hx, hy] = G.heroPos();
    npcAt('twin', 40, 85.4, 6, A.idle); d.face(2);
    d.cam(hx + 50, hy - 6, 1.4); await d.wait(900);
    await d.say(D.twin3.slice(0, 1));
    const n = secretsFound(G.flags);
    if (n) {
      const found = SECRETS.filter(s => G.flags.b[s]).map(s => SECRET_NAMES[s]);
      await d.say([D.twin3Secrets(n, {kk: found.map(x => x.kk).join(', '), ru: found.map(x => x.ru).join(', ')})]);
    }
    await d.say(D.twin3.slice(1));
    hide('twin'); d.fx(...P(40, 85), 2, 18); G.sfx('secret'); await d.wait(800);
    d.final(() => hide('twin'));
  }
  async function cutHome(d) {
    d.music('camp');
    d.cam(...P(89, 97), 2); await d.wait(600);
    npcGo('dana', 87, 98.4); npcGo('erlan', 91, 98.4);
    await d.say(D.home.slice(0, 2));
    d.cam(...P(89, 95), 1.6); G.sfx('secret'); await d.wait(1100);
    await d.say(D.home.slice(2));
    set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now();
    d.final(() => { set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); G.forceNpc = true; });
    d.after(() => G.complete());
  }
  function mirror(id) {
    const s = {irkin: cutIrkin, gate: cutGate, sight: cutSight, ktcamp: cutKtcamp, twin1: cutTwin1, lake: cutLake, boss: cutBoss, refusal: cutRefusal, twin3: cutTwin3, home: cutHome}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates, enemyDied, bossTalk, tick, mirror};
}

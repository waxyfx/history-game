// MAP03 quest logic: the same grow-only flag model as MAP01/MAP02 (co-op mergeable) plus MAP03 state.
//   talked = people heard, tracks = evidence found (story03 EVIDENCE), petro = unused.
// Trust and choices are booleans in flags.b (submitted/fled, qaramanTold, trustArna, foalHome, …):
// they change who talks to Aibar, what they reveal, and how the final assembly plays out.
import {MAP03} from './gen/map03.js';
import {A, TS, IT} from './quest.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, PEOPLE, EVIDENCE, FACTS, CHOICES} from './story03.js';

export const IA = Object.fromEntries(MAP03.interacts.map((n, i) => [n, i]));
export const NPC = Object.fromEntries(MAP03.npcs.map((n, i) => [n, i]));
export const TRIG = Object.fromEntries(MAP03.triggers.map((n, i) => [n, i]));
export const TAG = Object.fromEntries(MAP03.tags.map((n, i) => [n, i]));
const P = (x, y) => [Math.round(x * TS), Math.round(y * TS)];
const QID = Object.fromEntries(Object.entries(HISTORICAL_QUIZZES).map(([n, q]) => [q.id, +n]));

export const MAX_SCORE = 100, PASS_SCORE = 90;
export const TRIAL_POINTS = Object.fromEntries(Object.values(HISTORICAL_QUIZZES).map(q => [q.id, q.points]));
export function scoreOf(f) {
  let s = 0;
  for (const [id, r] of Object.entries(f.quiz)) if (r.ok) s += TRIAL_POINTS[id] || 0;
  return Math.min(MAX_SCORE, s);
}
export const PAGE_TOTAL = 4;
export function pageLines(f) { return ['saka_gold', 'saka_kurgan', 'saka_women', 'saka_final'].filter(id => f.quiz[id]?.ok).length; }
export function secretsFound(f) { return SECRETS.filter(s => f.b[s]).length; }
export const evidenceCount = f => f.tracks.length;
const ready = f => f.talked.filter(k => PEOPLE.includes(k)).length >= 4 && !!f.quiz.saka_gold;
const trailReady = f => f.b.accused && evidenceCount(f) >= 4;

export function questStage(f) {
  const b = f.b;
  if (b.finished) return 'done';
  if (b.verdict) return 'home';
  if (b.mirror) return 'verdict';
  if (b.freed) return 'mirror';
  if (b.tomb) return 'boss';
  if (b.trail) return 'tomb';
  if (b.accused) return 'investigate';
  if (ready(f)) return 'gather';
  if (b.welcomed) return 'learn';
  if (b.arrived) return 'arrive';
  return 'camp';
}
export function questTarget(f) {
  const stage = questStage(f), t = QUESTS[stage].target;
  if (stage === 'learn') {
    if (!f.quiz.saka_gold && f.talked.includes('altynbek')) return {ia: IA.goldwork};
    const who = PEOPLE.find(k => !f.talked.includes(k));
    return who ? {npc: NPC[who]} : {ia: IA.goldwork};
  }
  if (stage === 'investigate') {
    if (evidenceCount(f) >= 4 && !f.quiz.saka_women) return {ia: IA.target};
    if (!f.tracks.includes(EVIDENCE.hoofs)) return {ia: IA.hoofs};
    if (!f.tracks.includes(EVIDENCE.shard)) return {ia: IA.shard};
    if (!f.tracks.includes(EVIDENCE.seal)) return {ia: IA.kurganseal};
    if (!f.tracks.includes(EVIDENCE.legend)) return {npc: NPC.kungey};
    if (!f.tracks.includes(EVIDENCE.ledger)) return {npc: NPC.altynbek};
    return {npc: NPC.tayzhan};
  }
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

// ---------------------------------------------------------------- world state from flags
export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const tag = (key, hidden) => E.tj_tag(TAG[key], hidden ? 1 : 0);
  tag('mirrorseal', b.freed); tag('armorstand', !b.treasury); tag('lostplaque', b.plaque);
  tag('shardmark', f.tracks.includes(EVIDENCE.shard)); tag('campgatelight', false);
  const acc = !!b.accused;
  ia('campsaka', true); ia('campgate', true); ia('holo', true); ia('sakagate', true);
  ia('hoofs', b.arrived); ia('shard', b.arrived && !f.tracks.includes(EVIDENCE.shard)); ia('plaque', acc && !b.plaque);
  ia('goldwork', b.welcomed); ia('target', b.welcomed); ia('altar', true); ia('niche', !b.niche);
  ia('kurganseal', b.arrived); ia('tunnel', b.arrived); ia('institute', true); ia('arnacache', !b.arnacache);
  ia('assembly', b.welcomed); ia('stairsup', true); ia('horses', true); ia('treasury', true);
  ia('mirroraltar', b.freed);
  // Groups: 1 steppe archers, 2 kurgan leopards, 3 corrupted riders at the ford (after the accusation),
  // 4 tomb shades, 5 tomb warriors, 6 the rider (7 = his adds, woken by the engine in phase 2).
  E.tj_groups((1 << 1) | (1 << 2) | (acc ? 1 << 3 : 0) | (b.tomb ? (1 << 4) | (1 << 5) : 0) | (b.bossSeen ? 1 << 6 : 0));
  const area = G.area();
  E.tj_torch(area === 1 ? 1 : 0);
  if (area === 1) E.tj_light(200, 160, 120);
  else if (area === 2) E.tj_light(200, 202, 214);
  else if (b.verdict) E.tj_light(232, 210, 172);
  else if (acc && !b.mirror) E.tj_light(196, 170, 182);
  else E.tj_light(212, 208, 200);
  // Triggers
  const arm = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {outskirts: b.arrived && !b.welcomed, square: false, ford: b.arrived && !b.fordSeen, kurgans: b.arrived && !b.kurgansSeen,
    hall: b.tomb && !b.hallSeen, arena: b.tomb && !b.bossSeen, camp: false};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm(k, on); G.armed[k] = on; }
  // NPCs: attitudes after the accusation are visible in who talks and who keeps a bubble.
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  const w = !!b.welcomed;
  npcFlags('barsbek', w, w && ready(f) && !acc ? 2 : 0);
  for (const k of ['qaraman', 'arna', 'altynbek', 'kungey', 'tayzhan', 'ulpan']) npcFlags(k, w, w && !f.talked.includes(k) ? 1 : 0);
  if (acc && !b.trail && evidenceCount(f) >= 4) npcFlags('arna', true, 2);
  npcFlags('warrior1', w, 0); npcFlags('warrior2', w, 0);
  npcFlags('dana', true, 0); npcFlags('erlan', true, 0);
  const foalOut = b.foalQuest && !b.foalHome;
  if (G.forceNpc || G.npcState !== npcState(b)) {
    G.npcState = npcState(b);
    if (foalOut) { E.tj_npc_set(NPC.foal, ...P(101, 36), 6, A.idle, 1); npcFlags('foal', true, 1); }
    else if (b.foalHome) { E.tj_npc_set(NPC.foal, ...P(38, 22), 2, A.graze ?? A.idle, 1); npcFlags('foal', false, 0); }
    else npcFlags('foal', false, 0, 1);
    if (b.verdict) {
      for (const [k, x, y] of [['bexary', 58, 41], ['herder1', 51, 42], ['herder2', 53, 42]]) { E.tj_npc_set(NPC[k], ...P(x, y), 4, A.idle, 1); npcFlags(k, true, 0); }
    } else if (b.mirror) {
      for (const [k, x, y] of [['bexary', 31, 90], ['herder1', 29, 89], ['herder2', 34, 89]]) { E.tj_npc_set(NPC[k], ...P(x, y), 0, A.idle, 1); npcFlags(k, true, 0); }
    } else if (b.freed) {
      E.tj_npc_set(NPC.bexary, ...P(32, 88), 0, A.sit, 1); npcFlags('bexary', true, 0);
      for (const k of ['herder1', 'herder2']) { E.tj_npc_set(NPC[k], ...P(k === 'herder1' ? 27 : 38, 82.4), 4, A.sit, 1); npcFlags(k, false, 0); }
    } else for (const k of ['bexary', 'herder1', 'herder2']) npcFlags(k, false, 0, 1);
    if (!G.alarmSet || G.forceNpc) for (const k of ['barsbek', 'qaraman', 'arna', 'altynbek', 'kungey', 'ulpan', 'warrior1', 'warrior2']) E.tj_npc_routine(NPC[k]);
    G.alarmSet = true;
  }
  G.forceNpc = false;
  grant(G, 'kit', true, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 14); E.tj_item_add(IT.torch, 1); E.tj_item_add(IT.herb, 2); });
  grant(G, 'arnagift', !!f.quiz.saka_women?.ok, () => E.tj_item_add(IT.strength, 1));
  grant(G, 'page', b.verdict, () => E.tj_item_add(IT.page, 1));
}
const npcState = b => [b.foalQuest, b.foalHome, b.freed, b.mirror, b.verdict].map(Number).join('');
function grant(G, key, cond, fn) {
  if (cond && !G.local.granted.includes(key)) { G.local.granted.push(key); fn(); }
}

// ---------------------------------------------------------------- handlers
export function createQuest(G) {
  const {E} = G;
  const b = () => G.flags.b;
  const set = k => { if (!G.flags.b[k]) { G.flags.b[k] = true; G.changed(); applyWorld(G); } };
  const pos = key => MAP03.interactPos[key];
  const quiz = id => G.quiz(QID[id]);
  const addTo = (k, v) => { if (!G.flags[k].includes(v)) { G.flags[k] = [...G.flags[k], v]; G.changed(); applyWorld(G); return true; } return false; };
  async function evidence(id) {
    if (!addTo('tracks', id)) return;
    G.sfx('secret');
    G.toast(`Айғақ: ${evidenceCount(G.flags)} / 6`);
    await checkTrail();
  }
  async function checkTrail() {
    const f = G.flags;
    if (trailReady(f) && !f.b.trailHint) { set('trailHint'); await G.say([D.evidenceEnough[0]]); }
  }
  async function start() { return G.cine('camp', cutCamp); }

  async function talk(key) {
    const f = G.flags, B = f.b, first = !f.talked.includes(key);
    const heard = () => { if (first) { addTo('talked', key); if (ready(G.flags) && !B.accused) G.toast('Барсбек жиын шақырды. Алаңдағы ошаққа бар.'); } };
    switch (key) {
      case 'dana': return G.say(B.finished ? D.home.slice(3) : D.campTalkDana);
      case 'erlan': return G.say(D.campTalkErlan);
      case 'foal':
        if (B.foalQuest && !B.foalHome) { await G.say(D.foal); set('foalHome'); G.forceNpc = true; applyWorld(G); }
        return;
      case 'barsbek':
        if (!B.accused) { await G.say(first ? D.barsbek1 : D.barsbek2); heard(); return; }
        if (B.verdict) return G.say(D.verdictSubmit.slice(0, 1));
        return G.say(B.fled && evidenceCount(f) < 4 ? D.barsbekCold : D.barsbekAfter);
      case 'qaraman':
        if (!B.accused) { await G.say(first ? D.qaraman1 : D.qaraman2); heard(); return; }
        if (B.verdict) return G.say(B.qaramanTold ? D.verdictQaramanAlly : D.verdictQaramanBitter);
        if (evidenceCount(f) >= 4 && !B.qaramanAsked) {
          set('qaramanAsked');
          const c = await G.choose(CHOICES.qaraman);
          if (c === 0) { await G.say(D.qaramanReady); set('qaramanTold'); }
          else await G.say([{who: 'aibar', kk: '(Айбар үнсіз өтіп кетті. Шындықты ел алдында айтады.)'}]);
          return;
        }
        return G.say(D.qaramanHostile);
      case 'arna':
        if (!B.accused) { await G.say(first ? D.arna1 : D.arna2); heard(); return; }
        if (trailReady(f) && !B.trail) {
          if (!f.quiz.saka_women) return G.say([{who: 'arna', kk: 'Айғақтарың жеткілікті. Бірақ жолға шықпас бұрын — садақ нысанасына кел. Сенің көзіңді тексергім келеді.'}]);
          return G.cine('trail', cutTrail);
        }
        return G.say(D.arna2);
      case 'altynbek':
        if (!B.accused) { await G.say(first ? D.altynbek1 : D.altynbek2); heard(); return; }
        if (f.tracks.includes(EVIDENCE.ledger)) return G.say(D.altynbek2);
        if (B.fled && !B.plaque) return G.say(D.ledgerWary);
        await G.say(D.ledger); return evidence(EVIDENCE.ledger);
      case 'kungey':
        if (!B.accused) { await G.say(first ? D.kungey1 : D.kungey2); heard(); return; }
        if (!f.tracks.includes(EVIDENCE.legend)) { await G.say(D.legend); return evidence(EVIDENCE.legend); }
        if (!f.quiz.saka_hats) return quiz('saka_hats');
        return G.say(D.kungey2);
      case 'tayzhan':
        if (!B.accused) { await G.say(first ? D.tayzhan1 : D.tayzhan2); heard(); return; }
        if (f.tracks.includes(EVIDENCE.tally)) return G.say(D.tally.slice(2));
        if (B.foalHome || f.quiz.saka_women?.ok) { await G.say(D.tally); return evidence(EVIDENCE.tally); }
        await G.say(D.tayzhanWary); set('foalQuest'); G.forceNpc = true; applyWorld(G);
        return G.say(D.tayzhanFoal);
      case 'ulpan':
        await G.say(first ? D.ulpan1 : D.ulpan2); heard(); return;
      case 'warrior1': case 'warrior2':
        return G.say(B.accused && !B.verdict ? D.warriorAfter : D.warrior);
      case 'bexary': return G.say(D.bossDown.slice(2, 3));
      case 'herder1': case 'herder2': return G.say(D.mirrorFree.slice(key === 'herder2' ? 0 : 1, key === 'herder2' ? 1 : 2));
    }
  }

  async function interact(key, hold) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'campsaka':
        if (B.verdict) return G.say(D.campTalkErlan);
        G.sfx('portal');
        await G.travel(...P(12, 67));
        if (!B.arrived) return G.cine('arrival', cutArrival);
        return;
      case 'sakagate':
        if (!B.verdict) return G.say(D.sakagateLocked);
        G.sfx('portal');
        await G.travel(...P(89, 99));
        if (!B.finished) return G.cine('home', cutHome);
        return;
      case 'campgate': return G.say(D.campgateLocked);
      case 'holo': return G.results();
      case 'hoofs': await G.say(D.hoofs, FACTS.horse); return evidence(EVIDENCE.hoofs);
      case 'shard': await G.say(D.shard); return evidence(EVIDENCE.shard);
      case 'plaque': if (!B.plaque) { set('plaque'); G.sfx('pickup'); return G.say(D.plaqueFound); } return;
      case 'goldwork': {
        const r = await quiz('saka_gold');
        if (r.fresh && r.ok) { E.tj_item_add(IT.arrows, 8); G.sfx('pickup'); }
        if (r.fresh && ready(G.flags) && !B.accused) G.toast('Барсбек жиын шақырды. Алаңдағы ошаққа бар.');
        return;
      }
      case 'target': {
        if (!B.accused && !f.quiz.saka_women) return G.say(D.arna2);
        const r = await quiz('saka_women');
        if (r.fresh) set('trustArna');
        await checkTrail();
        return;
      }
      case 'altar':
        if (!B.altar) { set('altar'); G.sfx('secret'); await G.say(D.altarLook, FACTS.animal); }
        return quiz('saka_altar');
      case 'niche': if (!B.niche) { set('niche'); G.sfx('secret'); G.spawnFx(pos('niche'), 7, 16); return G.say(D.niche); } return;
      case 'kurganseal':
        await G.say(D.sealSeen, FACTS.kurgan);
        await evidence(EVIDENCE.seal);
        return quiz('saka_kurgan');
      case 'tunnel':
        if (!B.trail) return G.say(f.quiz.saka_kurgan ? D.needEvidence : D.tunnelClosed);
        await G.travel(...P(32, 108.5));
        E.tj_checkpoint(...P(32, 108.5));
        set('tomb');
        return;
      case 'stairsup': return G.travel(...P(96, 26.5));
      case 'institute': if (!B.institute) { set('institute'); G.sfx('secret'); } return G.say(D.institute);
      case 'arnacache': if (!B.arnacache) { set('arnacache'); G.sfx('secret'); return G.say(D.arnacache); } return;
      case 'assembly':
        if (B.mirror && !B.verdict) return G.cine('verdict', cutVerdict);
        if (!B.accused && ready(f)) return G.cine('assembly', cutAssembly);
        E.tj_checkpoint(...P(56, 42)); E.tj_heal(100); G.save(true);
        return G.say(B.accused ? [{who: 'aibar', kk: 'Ошақ әлі жылы. Ел маған әлі де күдікпен қарайды.'}] : [{who: 'aibar', kk: 'Жиын ошағы. Ел осы жерде кеңеседі.'}], FACTS.saka);
      case 'horses':
        if (!B.horses) { set('horses'); G.sfx('secret'); await G.say(D.horses, FACTS.horse); }
        return quiz('saka_berel');
      case 'treasury':
        if (!B.treasury) { set('treasury'); G.sfx('secret'); await G.say(D.treasury); }
        return quiz('saka_esik');
      case 'mirroraltar':
        if (B.mirror) return G.say(D.mirror.slice(2));
        return G.cine('mirror', cutMirror);
    }
  }

  async function trigger(key) {
    const B = b();
    if (key === 'outskirts' && !B.welcomed) return G.cine('welcome', cutWelcome);
    if (key === 'ford' && !B.fordSeen) { set('fordSeen'); return G.say(D.ford); }
    if (key === 'kurgans' && !B.kurgansSeen) { set('kurgansSeen'); G.sfx('howl'); return G.say(D.kurgansIn, FACTS.kurgan); }
    if (key === 'hall' && !B.hallSeen) { set('hallSeen'); return G.say(D.hall); }
    if (key === 'arena' && !B.bossSeen) return G.cine('boss', cutBoss);
  }
  function plates() {}
  async function enemyDied(i, type) {
    if (type === 7 && !b().freed) { set('freed'); G.forceNpc = true; applyWorld(G); E.tj_shake(24); G.sfx('portal'); await G.say(D.bossDown); }
  }

  // ------------------------------------------------------------ cutscenes (skip = fast-forward to the end state)
  const npcGo = (key, x, y, run = 0, anim = A.idle) => E.tj_npc_goto(NPC[key], ...P(x, y), run, anim);
  const npcAt = (key, x, y, facing = 4, anim = A.idle) => E.tj_npc_set(NPC[key], ...P(x, y), facing, anim, 1);
  // 1 — the Chroniclers' Camp
  async function cutCamp(d) {
    d.music('camp');
    const hero = G.heroPos();
    d.cam(hero[0], hero[1] - 10, 999);
    await d.fadeIn(1200);
    npcGo('dana', 86.5, 99); npcGo('erlan', 91.5, 99);
    await d.wait(700);
    await d.say(D.camp.slice(0, 2));
    d.cam(...P(89, 95), 1.6); G.sfx('page'); d.fx(...P(89, 94), 0, 14); await d.wait(900);
    await d.say(D.camp.slice(2, 4));
    d.cam(...pos('campsaka'), 1.8); G.sfx('portal'); d.fx(...pos('campsaka'), 7, 16); await d.wait(1000);
    await d.say(D.camp.slice(4));
    d.final(() => { G.forceNpc = true; E.tj_npc_routine(NPC.dana); E.tj_npc_routine(NPC.erlan); });
  }
  // 2 — arrival in the Saka steppe
  async function cutArrival(d) {
    d.music('mystery');
    const hero = G.heroPos();
    d.pose(A.death, 300); d.cam(hero[0], hero[1] - 20, 999);
    G.sfx('portal'); await d.flash(500);
    await d.fadeIn(1200);
    await d.wait(500);
    d.pose(A.idle, 1);
    await d.say(D.arrive.slice(0, 1));
    d.cam(...P(36, 18), 1.4); await d.wait(1600);   // horses grazing below the snowy ridge
    await d.say(D.arrive.slice(1, 2));
    d.cam(...P(46, 42), 1.6); d.fx(...P(56, 38), 1, 10); await d.wait(1500);
    d.cam(...P(78, 46), 1.8); await d.wait(1000);    // the warriors' camp, armed
    await d.say(D.arrive.slice(2));
    d.music('explore');
    d.final(() => set('arrived'));
  }
  // 3 — welcome at the edge of the settlement
  async function cutWelcome(d) {
    d.music('village');
    const [hx, hy] = G.heroPos();
    npcGo('qaraman', hx / TS + 2, hy / TS - .5, 1, A.idle);
    d.cam(hx + 16, hy - 8, 2.4); await d.wait(1100);
    await d.say(D.welcome.slice(0, 3));
    npcGo('barsbek', hx / TS + 3.4, hy / TS - 2.2, 0, A.talk);
    npcGo('arna', hx / TS + 5.5, hy / TS - 4, 0, A.idle);
    d.cam(hx + 30, hy - 20, 1.4); await d.wait(1600);
    await d.say(D.welcome.slice(3, 5));
    d.cam(...P(hx / TS + 5.5, hy / TS - 4), 2); await d.wait(800);
    await d.say(D.welcome.slice(5, 6));
    d.cam(hx + 24, hy - 14, 2); await d.wait(500);
    await d.say(D.welcome.slice(6));
    d.final(() => { set('welcomed'); G.forceNpc = true; for (const k of ['qaraman', 'barsbek', 'arna']) E.tj_npc_routine(NPC[k]); });
  }
  // 4 — THE ACCUSATION: the people against Aibar
  async function cutAssembly(d) {
    d.music('village');
    E.tj_teleport(...P(56, 43.2)); d.face(0);
    E.tj_light(200, 160, 150);
    npcAt('barsbek', 56, 37.2, 4, A.talk); npcAt('kungey', 61.5, 38.4, 6, A.idle);
    for (const [k, x, y, fc] of [['qaraman', 60.5, 41.5, 6], ['ulpan', 51.5, 40.5, 2], ['altynbek', 52.5, 43.5, 2], ['warrior1', 60, 44.5, 6],
      ['warrior2', 52, 45.5, 2], ['arna', 50, 42, 2], ['tayzhan', 49.5, 44, 2]]) npcAt(k, x, y, fc, A.idle);
    d.cam(...P(56, 40), 999);
    await d.fadeIn(900);
    d.cam(...P(56, 38), 1.2); await d.wait(800);
    await d.say(D.assembly.slice(0, 2));                // the elder opens the assembly
    d.cam(...P(60, 43), 2); await d.wait(600);
    await d.say(D.assembly.slice(2, 3));                // a warrior's testimony
    d.cam(...P(51.5, 41), 2); await d.wait(500);
    await d.say(D.assembly.slice(3, 4));                // the mother's testimony
    d.cam(...P(59, 42), 2); npcGo('qaraman', 57.6, 42.6, 0, A.talk); await d.wait(700);
    await d.say(D.assembly.slice(4, 6));                // Qaraman accuses
    d.face(2);
    await d.say(D.assembly.slice(6, 8));
    d.cam(...P(52.5, 43), 2); await d.wait(400);
    await d.say(D.assembly.slice(8, 10));               // the goldsmith defends, a warrior mocks
    d.cam(...P(50.5, 42), 2); npcGo('arna', 54.4, 42.6, 1, A.talk); await d.wait(600);
    await d.say(D.assembly.slice(10, 12));              // Arna speaks up, Qaraman turns on her
    d.music('off');
    d.cam(...P(56, 39.4), 1.4); await d.wait(700);
    await d.say(D.assembly.slice(12, 13));              // the shaman: the fire burns wrong
    d.fog(150); G.sfx('shadow'); E.tj_light(130, 100, 160); E.tj_shake(8);
    const fire = P(56, 39.4);
    for (let a = 0; a <= 230; a += 23) { E.tj_shadow(fire[0], fire[1] - 26, a); await d.wait(70); }
    d.fx(fire[0], fire[1] - 20, 7, 30);
    await d.say(D.assembly.slice(13, 15));              // a face in the fire — everyone sees it
    await d.wait(400);
    await d.say(D.assembly.slice(15, 18));              // Zulmat's speech
    await d.say(D.assembly.slice(18, 20));              // Aibar names him — Zulmat turns it against him
    for (let a = 230; a >= 0; a -= 23) { E.tj_shadow(fire[0], fire[1] - 26, a); await d.wait(50); }
    d.fog(0); G.sfx('whoosh'); E.tj_shake(14);
    d.music('danger');
    const [hx, hy] = G.heroPos();
    npcGo('warrior1', hx / TS + 1.3, hy / TS + .2, 1, A.spear); npcGo('warrior2', hx / TS - 1.3, hy / TS + .2, 1, A.spear);
    npcGo('qaraman', hx / TS + .2, hy / TS - 1.4, 1, A.idle);
    d.cam(hx, hy - 6, 2); await d.wait(900);
    await d.say(D.assembly.slice(20));                  // surrounded; the elder demands an answer
    d.final(() => { E.tj_shadow(0, 0, 0); E.tj_fog(0); set('accused'); });
    d.after(async () => {
      const c = await G.choose(CHOICES.assembly);
      if (c === 0) { set('submitted'); await G.say(D.assemblySubmit); }
      else { set('fled'); G.spawnFx(G.heroPos(), 1, 14); await G.say(D.assemblyFlee); await G.travel(...P(44, 47)); }
      G.forceNpc = true; applyWorld(G);
      await G.say(D.afterAssembly);
      G.save(true);
    });
  }
  // 5 — Arna leads the way to the kurgans
  async function cutTrail(d) {
    d.music('mystery');
    await d.say(D.evidenceEnough.slice(1));
    d.cam(...P(96, 22), 1.6); await d.wait(1500);
    d.fx(...P(96, 22), 7, 16); G.sfx('shadow');
    await d.say([{who: 'aibar', kk: 'Ұрылар жолы. Жоғалғандар — сонда. Ал олармен бірге — Зұлматтың айнасы.'}]);
    d.final(() => set('trail'));
  }
  // 6 — the golden rider
  async function cutBoss(d) {
    d.music('off');
    const arena = P(32, 88);
    d.cam(arena[0], arena[1] - 10, 1.4); await d.wait(900);
    G.sfx('hooves'); E.tj_shake(14); d.fx(arena[0], arena[1], 2, 20);
    await d.wait(600);
    await d.say(D.boss.slice(0, 3));
    d.fog(120); G.sfx('shadow');
    await d.say(D.boss.slice(3, 4));
    d.fog(0);
    await d.say(D.boss.slice(4));
    d.music('danger');
    d.final(() => { E.tj_fog(0); set('bossSeen'); });
  }
  // 7 — Zulmat's mirror: the final trial and the freeing of the missing
  async function cutMirror(d) {
    d.music('mystery');
    const m = pos('mirroraltar');
    d.cam(m[0], m[1] - 10, 1.6); await d.wait(700);
    await d.say(D.mirror.slice(0, 1));
    d.fog(130); G.sfx('shadow');
    for (let a = 0; a <= 180; a += 20) { E.tj_shadow(m[0], m[1] - 34, a); await d.wait(60); }
    await d.say(D.mirror.slice(1));
    for (let a = 180; a >= 0; a -= 20) { E.tj_shadow(m[0], m[1] - 34, a); await d.wait(40); }
    d.fog(0);
    d.final(() => { E.tj_shadow(0, 0, 0); E.tj_fog(0); });
    d.after(async () => {
      await quiz('saka_final');
      G.sfx('rumble'); E.tj_shake(20); G.spawnFx(m, 7, 30);
      E.tj_tag(TAG.zmirror, 1);
      set('mirror'); G.forceNpc = true; applyWorld(G);
      await G.say(D.mirrorFree);
      G.save(true);
    });
  }
  // 8 — the verdict: the truth before the assembly, the page, a new riddle
  async function cutVerdict(d) {
    d.music('village');
    E.tj_teleport(...P(56, 43.2)); d.face(0);
    npcAt('barsbek', 56, 37.2, 4, A.talk); npcAt('kungey', 61.5, 38.4, 6, A.idle);
    for (const [k, x, y, fc] of [['qaraman', 60.5, 41.5, 6], ['ulpan', 51.5, 40.5, 2], ['altynbek', 52.5, 43.5, 2], ['warrior1', 60, 44.5, 6],
      ['warrior2', 52, 45.5, 2], ['arna', 50, 42, 2], ['tayzhan', 49.5, 44, 2], ['bexary', 58.5, 43.6, 6], ['herder1', 54, 44.6, 0], ['herder2', 52.6, 41.6, 2]]) npcAt(k, x, y, fc, A.idle);
    d.cam(...P(56, 40), 999);
    await d.fadeIn(900);
    await d.say(D.verdict.slice(0, 1));
    npcGo('ulpan', 52.6, 41.2, 1, A.talk);
    await d.say(D.verdict.slice(1, 2));
    npcGo('qaraman', 58.6, 42.4, 1, A.talk);
    d.cam(...P(58.5, 42.6), 2); await d.wait(700);
    await d.say(D.verdict.slice(2, 5));                  // brothers
    d.cam(...P(56, 41), 1.6); await d.wait(400);
    await d.say(D.verdict.slice(5, 7));                  // how Zulmat manipulated them
    await d.say(G.flags.b.fled ? D.verdictFled : D.verdictSubmit);
    await d.say(G.flags.b.qaramanTold ? D.verdictQaramanAlly : D.verdictQaramanBitter);
    if (G.flags.b.trustArna) await d.say(D.verdictArna);
    await d.say(D.verdict.slice(7));
    d.music('mystery');
    const fire = P(56, 39.4);
    d.cam(fire[0], fire[1] - 10, 1.4); G.sfx('page'); d.fx(fire[0], fire[1] - 18, 0, 30); await d.flash(400);
    d.pose(A.victory, 220);
    await d.say(D.page.slice(0, 2));
    set('verdict'); applyWorld(G);
    await d.say(D.page.slice(2));
    if (pageLines(G.flags) < PAGE_TOTAL) await d.say(D.pageDistorted);
    d.cam(...pos('sakagate'), 2.4); G.sfx('portal'); d.fx(...pos('sakagate'), 7, 20); await d.wait(1200);
    d.final(() => { set('verdict'); G.forceNpc = true; });
  }
  // 9 — home: the Chroniclers' Camp and the trembling fourth gate
  async function cutHome(d) {
    d.music('camp');
    d.cam(...P(89, 97), 2); await d.wait(600);
    npcGo('dana', 87, 98.4); npcGo('erlan', 91, 98.4);
    await d.say(D.home.slice(0, 3));
    d.cam(...pos('campgate'), 1.6); G.sfx('portal'); d.fx(...pos('campgate'), 7, 20); E.tj_shake(6); await d.wait(1200);
    await d.say(D.home.slice(3));
    set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now();
    d.final(() => { set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); G.forceNpc = true; });
    d.after(() => G.complete());
  }

  function mirror(id) {
    const s = {welcome: cutWelcome, assembly: cutAssembly, trail: cutTrail, boss: cutBoss, verdict: cutVerdict, home: cutHome}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates, enemyDied, mirror};
}

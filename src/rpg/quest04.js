// MAP04 quest logic (same grow-only flag model as MAP01–MAP03; co-op mergeable).
//   talked = sides and witnesses heard, tracks = proofs (story04 PROOFS), petro = unused.
// Choices live in flags.b: tallyKept/tallyBurned (burning it sends corrupted riders to the ford),
// allyZhizhi/allyFeng/allyKangju (who is told first: a gift, and who speaks for Aibar at the end).
import {MAP04} from './gen/map04.js';
import {A, TS, IT} from './quest.js';
import {playFilm} from './cinema04.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, SIDES, WITNESSES, PROOFS, FACTS, CHOICES} from './story04.js';

export const IA = Object.fromEntries(MAP04.interacts.map((n, i) => [n, i]));
export const NPC = Object.fromEntries(MAP04.npcs.map((n, i) => [n, i]));
export const TRIG = Object.fromEntries(MAP04.triggers.map((n, i) => [n, i]));
export const TAG = Object.fromEntries(MAP04.tags.map((n, i) => [n, i]));
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
export function pageLines(f) { return ['hun_script', 'hun_decimal', 'hun_three', 'hun_final'].filter(id => f.quiz[id]?.ok).length; }
export function secretsFound(f) { return SECRETS.filter(s => f.b[s]).length; }
const sidesDone = f => SIDES.every(k => f.talked.includes(k));
const proofsDone = f => f.tracks.length >= 3 && !!f.quiz.hun_decimal && !!f.quiz.hun_three;

export function questStage(f) {
  const b = f.b;
  if (b.finished) return 'done';
  if (b.page) return 'home';
  if (b.peace) return 'hollow';
  if (b.masks) return 'peace';
  if (b.witnessDown) return 'masks';
  if (b.under) return 'boss';
  if (b.council && b.raid && !b.raidDone) return 'raid';
  if (b.council) return 'tomb';
  if (sidesDone(f) && proofsDone(f)) return 'council';
  if (sidesDone(f)) return 'proofs';
  if (b.arrived) return 'arrive';
  return 'camp';
}
export function questTarget(f) {
  const stage = questStage(f), t = QUESTS[stage].target;
  if (stage === 'arrive') { const who = SIDES.find(k => !f.talked.includes(k)); return who ? {npc: NPC[who]} : null; }
  if (stage === 'proofs') {
    if (!f.tracks.includes(PROOFS.tally)) return {ia: IA.tallystone};
    if (!f.tracks.includes(PROOFS.envoy)) return {ia: IA.envoypost};
    const w = WITNESSES.find(k => !f.talked.includes(k)); if (w) return {npc: NPC[w]};
    if (!f.quiz.hun_decimal) return {ia: IA.muster};
    return {ia: IA.borderstone};
  }
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const tag = (key, hidden) => E.tj_tag(TAG[key], hidden ? 1 : 0);
  tag('tally', b.tallyBurned); tag('hollowseal', b.peace);
  const arr = !!b.arrived, sides = sidesDone(f);
  ia('camphun', true); ia('campgate', true); ia('holo', true); ia('hungate', true);
  ia('tallystone', arr && !b.tallyBurned); ia('council', arr); ia('muster', arr); ia('borderstone', arr);
  ia('envoypost', arr && !b.envoyFree, 110); ia('whistle', true); ia('ramparts', arr); ia('wallmark', true); ia('silk', true);
  ia('cord11', true); ia('cordwest', true); ia('bell', true); ia('oldkit', true);
  ia('tombdoor', arr); ia('stairsup', true); ia('masks', b.witnessDown); ia('knotdesk', b.peace && !b.page);
  // Groups: 1 deserters on the steppe, 2 corrupted guards of the envoy, 3 corrupted riders at the ford (only if the
  // tally was burned), 4 shadows below, 5 the witness (6 = his adds, woken by the engine in phase 2).
  E.tj_groups((1 << 1) | (arr ? 1 << 2 : 0) | (b.raid && !b.raidDone ? 1 << 3 : 0) | (b.under ? 1 << 4 : 0) | (b.bossSeen ? 1 << 5 : 0));
  const area = G.area();
  E.tj_torch(area === 1 ? 1 : 0);
  if (area === 1) E.tj_light(170, 160, 200);
  else if (area === 2) E.tj_light(200, 202, 214);
  else if (b.peace) E.tj_light(226, 206, 170);
  else if (b.council) E.tj_light(170, 150, 178);
  else E.tj_light(214, 196, 164);
  const arm = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {stone: arr && !b.stoneSeen, fortgate: arr && !b.fortSeen, burial: arr && !b.burialSeen, crossing: !!b.raid && !b.raidSeen,
    hall: b.under && !b.hallSeen, arena: b.under && !b.bossSeen, aul: false};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm(k, on); G.armed[k] = on; }
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  for (const k of [...SIDES, ...WITNESSES]) npcFlags(k, arr, arr && !f.talked.includes(k) ? (SIDES.includes(k) ? 2 : sides ? 1 : 0) : 0);
  npcFlags('guard', arr, 0); npcFlags('dana', true, 0); npcFlags('erlan', true, 0);
  if (G.forceNpc || G.npcState !== npcState(b)) {
    G.npcState = npcState(b);
    if (b.peace) { E.tj_npc_set(NPC.envoy, ...P(92, 42), 6, A.idle, 1); npcFlags('envoy', true, 0); }
    else if (b.envoyFree) { E.tj_npc_set(NPC.envoy, ...P(96.5, 24), 4, A.idle, 1); npcFlags('envoy', true, 0); }
    else { E.tj_npc_set(NPC.envoy, ...P(98, 23), 4, A.sit, 1); npcFlags('envoy', false, 0); }
    if (b.peace && !b.page) { E.tj_npc_set(NPC.knot, ...P(30, 82.6), 2, A.idle, 1); npcFlags('knot', false, 0); }
    else npcFlags('knot', false, 0, 1);
    for (const k of [...SIDES, ...WITNESSES]) E.tj_npc_routine(NPC[k]);
  }
  G.forceNpc = false;
  grant(G, 'kit', true, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 14); E.tj_item_add(IT.torch, 1); E.tj_item_add(IT.herb, 2); });
  grant(G, 'allyZ', b.allyZhizhi, () => E.tj_item_add(IT.strength, 2));
  grant(G, 'allyF', b.allyFeng, () => E.tj_item_add(IT.herbbig, 2));
  grant(G, 'allyK', b.allyKangju, () => E.tj_item_add(IT.guard, 2));
  grant(G, 'page', b.page, () => E.tj_item_add(IT.page, 1));
}
const npcState = b => [b.envoyFree, b.peace, b.page].map(Number).join('');
function grant(G, key, cond, fn) { if (cond && !G.local.granted.includes(key)) { G.local.granted.push(key); fn(); } }

export function createQuest(G) {
  const {E} = G;
  const b = () => G.flags.b;
  const set = k => { if (!G.flags.b[k]) { G.flags.b[k] = true; G.changed(); applyWorld(G); } };
  const pos = key => MAP04.interactPos[key];
  const quiz = id => G.quiz(QID[id]);
  const addTo = (k, v) => { if (!G.flags[k].includes(v)) { G.flags[k] = [...G.flags[k], v]; G.changed(); applyWorld(G); return true; } return false; };
  const groupAlive = g => MAP04.enemies.some((e, j) => e.group === g && E.tj_enemy(j, 0) > 0);
  async function proof(id) {
    if (!addTo('tracks', id)) return;
    G.sfx('secret'); G.toast(`Айғақ: ${G.flags.tracks.length} / 3`);
    if (sidesDone(G.flags) && proofsDone(G.flags)) G.toast('Үш айғақ жиналды. Елшілер тасына бар.');
  }
  const secret = async (key, lines, fact) => { if (!b()[key]) { set(key); G.sfx('secret'); } return G.say(lines, fact); };
  async function start() { return G.cine('camp', cutCamp); }

  async function talk(key) {
    const f = G.flags, B = f.b, first = !f.talked.includes(key);
    switch (key) {
      case 'dana': return G.say(B.finished ? D.home.slice(2, 3) : D.campTalkDana);
      case 'erlan': return G.say(D.campTalkErlan);
      case 'guard': return G.say([D.fortgate[0]]);
      case 'envoy': return G.say(D.envoyLater, FACTS.envoys);
      case 'zhizhi': case 'fengliao': case 'kangju': {
        if (first) {
          await G.say(D[key + '1'], FACTS[key]); addTo('talked', key);
          if (sidesDone(G.flags) && !B.sidesSaid) { set('sidesSaid'); await G.say(D.sidesDone); }
          return;
        }
        if (key === 'fengliao' && !f.quiz.hun_zhangqian) return quiz('hun_zhangqian');
        return G.say(D[key + '2']);
      }
      case 'shuga': case 'wusunbek': case 'merchant': {
        if (!first) return G.say(D.witnessAgain);
        await G.say(D[key + '1'], key === 'wusunbek' ? FACTS.wusun : null); addTo('talked', key);
        if (WITNESSES.every(k => G.flags.talked.includes(k))) { await G.say(D.witnessesDone); await proof(PROOFS.witnesses); }
        return;
      }
    }
  }

  async function interact(key, hold) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'camphun':
        if (B.page) return G.say(D.campTalkErlan);
        G.sfx('portal'); await G.travel(...P(40, 69.4));
        if (!B.arrived) return G.cine('arrival', cutArrival);
        return;
      case 'hungate':
        if (!B.page) return G.say(D.hungateLocked);
        G.sfx('portal'); await G.travel(...P(89, 99));
        if (!B.finished) return G.cine('home', cutHome);
        return;
      case 'campgate': return G.say(D.campgateLocked);
      case 'holo': return G.results();
      case 'tallystone': {
        const r = await quiz('hun_script');
        if (r.fresh) {
          const c = await G.choose(CHOICES.tally);
          if (c === 0) { set('tallyKept'); await G.say(D.tallyKeep); } else { set('tallyBurned'); G.spawnFx(pos('tallystone'), 1, 10); await G.say(D.tallyBurn); }
          await proof(PROOFS.tally);
        }
        return;
      }
      case 'muster': { const r = await quiz('hun_decimal'); if (r.fresh && r.ok) { E.tj_item_add(IT.arrows, 8); G.sfx('pickup'); } if (r.fresh && proofsDone(G.flags) && sidesDone(G.flags)) G.toast('Үш айғақ жиналды. Елшілер тасына бар.'); return; }
      case 'borderstone': { const r = await quiz('hun_three'); if (r.fresh && proofsDone(G.flags) && sidesDone(G.flags)) G.toast('Үш айғақ жиналды. Елшілер тасына бар.'); return; }
      case 'envoypost':
        if (B.envoyFree) return;
        if (groupAlive(2)) return G.toast('Алдымен күзетшілерді жең.', 'warn');
        if (hold) { set('envoyFree'); G.sfx('revive'); G.forceNpc = true; applyWorld(G); await G.say(D.envoyFree, FACTS.envoys); await proof(PROOFS.envoy); }
        return;
      case 'council':
        if (B.masks && !B.peace) return G.cine('peace', cutPeace);
        if (B.council) { E.tj_checkpoint(...P(54, 43)); E.tj_heal(100); G.save(true); return G.say([{who: 'aibar', kk: 'Үш ту бір желмен желбіреп тұр.'}]); }
        if (!(sidesDone(f) && proofsDone(f))) return G.say(D.councilNeed);
        return G.cine('council', cutCouncil);
      case 'ramparts': return quiz('hun_fort');
      case 'whistle': if (!B.whistle) { set('whistle'); G.sfx('secret'); await G.say(D.whistleLook); } return quiz('hun_whistle');
      case 'silk': if (!B.silk) { set('silk'); G.sfx('secret'); await G.say(D.silkLook); } return quiz('hun_silk');
      case 'cord11': return secret('cord11', D.cord11);
      case 'cordwest': return G.say(D.cordwest);
      case 'bell': return secret('bell', D.bell);
      case 'oldkit': return secret('oldkit', D.oldkit);
      case 'wallmark': return secret('wallmark', D.wallmark);
      case 'tombdoor':
        if (!B.council || (B.raid && !B.raidDone)) return G.say(D.tombClosed);
        await G.travel(...P(32, 108.5)); E.tj_checkpoint(...P(32, 108.5)); set('under');
        return;
      case 'stairsup': return G.travel(...P(93, 17.4));
      case 'masks':
        if (B.masks) return G.say(D.masksAfter);
        await quiz('hun_final'); set('masks'); await G.say(D.masksAfter); G.save(true);
        return;
      case 'knotdesk': if (B.peace && !B.page) return finale(); return;
    }
  }
  // The meeting with the third party: an in-engine film (cinema04.js), then the page.
  async function finale() {
    if (G.film) await G.film(playFilm); else await G.say(D.film);
    set('page'); G.forceNpc = true; applyWorld(G);
    G.sfx('page');
    await G.say(D.page);
    if (pageLines(G.flags) < PAGE_TOTAL) await G.say(D.pageDistorted);
    G.save(true);
  }

  async function trigger(key) {
    const B = b();
    if (key === 'stone' && !B.stoneSeen) { set('stoneSeen'); return G.say([D.arrive[2]]); }
    if (key === 'fortgate' && !B.fortSeen) return G.cine('fortgate', cutFortgate);
    if (key === 'burial' && !B.burialSeen) { set('burialSeen'); return G.say(D.burial); }
    if (key === 'crossing' && B.raid && !B.raidSeen) { set('raidSeen'); G.sfx('hooves'); return G.say(D.raid); }
    if (key === 'hall' && !B.hallSeen) { set('hallSeen'); return G.say(D.hall); }
    if (key === 'arena' && !B.bossSeen) return G.cine('boss', cutBoss);
  }
  function plates() {}
  async function enemyDied(i, type) {
    if (type === 8 && !b().witnessDown) { set('witnessDown'); E.tj_shake(24); G.sfx('portal'); await G.say(D.bossDown); }
    if (MAP04.enemies[i].group === 3 && b().raid && !b().raidDone && !groupAlive(3)) { set('raidDone'); await G.say(D.raidDone); }
  }

  const npcGo = (key, x, y, run = 0, anim = A.idle) => E.tj_npc_goto(NPC[key], ...P(x, y), run, anim);
  const npcAt = (key, x, y, facing = 4, anim = A.idle) => E.tj_npc_set(NPC[key], ...P(x, y), facing, anim, 1);
  async function cutCamp(d) {
    d.music('camp');
    const hero = G.heroPos(); d.cam(hero[0], hero[1] - 10, 999);
    await d.fadeIn(1200);
    npcGo('dana', 86.5, 99); npcGo('erlan', 91.5, 99); await d.wait(700);
    await d.say(D.camp.slice(0, 3));
    d.cam(...P(89, 95), 1.6); G.sfx('page'); d.fx(...P(89, 94), 0, 14); await d.wait(900);
    await d.say(D.camp.slice(3));
    d.final(() => { G.forceNpc = true; E.tj_npc_routine(NPC.dana); E.tj_npc_routine(NPC.erlan); });
  }
  async function cutArrival(d) {
    d.music('mystery');
    const hero = G.heroPos();
    d.pose(A.death, 300); d.cam(hero[0], hero[1] - 20, 999);
    G.sfx('portal'); await d.flash(500); await d.fadeIn(1200); await d.wait(400);
    d.pose(A.idle, 1);
    await d.say(D.arrive.slice(0, 1));
    d.cam(...P(90, 42), 1.2); await d.wait(1700);    // the fort
    d.cam(...P(12, 32), .9); await d.wait(2200);     // the aul beyond the river
    d.cam(...P(52, 22), 1.4); await d.wait(1500);    // the Kangju camp
    await d.say(D.arrive.slice(1, 2));
    d.cam(...P(54, 39), 1.6); await d.wait(1400);    // the lonely stone with three banners
    await d.say(D.arrive.slice(2, 3));
    // A grey figure by the stone — gone before the camera settles.
    npcAt('knot', 57, 37.4, 6); await d.wait(900);
    G.sfx('secret'); E.tj_npc_flags(NPC.knot, 0, 0, 1); d.fx(...P(57, 37), 2, 8);
    d.cam(hero[0], hero[1] - 10, 2); await d.wait(900);
    await d.say(D.arrive.slice(3));
    d.music('explore');
    d.final(() => { E.tj_npc_flags(NPC.knot, 0, 0, 1); set('arrived'); });
  }
  async function cutFortgate(d) {
    d.music('village');
    const [hx, hy] = G.heroPos();
    npcGo('shuga', hx / TS + 1.8, hy / TS - 1.2, 1, A.talk);
    d.cam(hx + 30, hy - 8, 2); await d.wait(1000);
    await d.say(D.fortgate.slice(0, 3));
    d.cam(...P(81, 43), 2); await d.wait(700);
    await d.say(D.fortgate.slice(3));
    d.final(() => { set('fortSeen'); E.tj_npc_routine(NPC.shuga); });
  }
  // The council at the envoys' stone: proofs, the second choice, and — if the tally was burned — the raid.
  async function cutCouncil(d) {
    d.music('village');
    E.tj_teleport(...P(54, 43.4)); d.face(0);
    npcAt('zhizhi', 50.4, 39.6, 2, A.idle); npcAt('fengliao', 57.6, 39.6, 6, A.idle); npcAt('kangju', 54, 37, 4, A.idle);
    npcAt('shuga', 49, 42, 2); npcAt('wusunbek', 59, 42, 6);
    d.cam(...P(54, 40), 999); await d.fadeIn(900);
    await d.say(D.council.slice(0, 2));
    d.cam(...P(54, 39), 1.4); await d.wait(600);
    await d.say(D.council.slice(2, 4));
    await d.say(G.flags.b.tallyBurned ? D.councilNoTally : D.councilTally);
    await d.say(D.council.slice(4));
    d.final(() => set('council'));
    d.after(async () => {
      const c = await G.choose(CHOICES.council);
      set(['allyZhizhi', 'allyFeng', 'allyKangju'][c]);
      await G.say([D.allyZhizhi, D.allyFeng, D.allyKangju][c]);
      if (G.flags.b.tallyBurned) set('raid');
      G.forceNpc = true; applyWorld(G); G.save(true);
      if (G.flags.b.raid) G.toast('Салт аттылар өткелге шықты!', 'warn');
    });
  }
  async function cutBoss(d) {
    d.music('off');
    const a = P(32, 87);
    d.cam(a[0], a[1] - 10, 1.4); await d.wait(900);
    G.sfx('shadow'); E.tj_shake(12); d.fx(a[0], a[1] - 20, 7, 24); await d.wait(600);
    await d.say(D.boss.slice(0, 3));
    d.fog(130);
    await d.say(D.boss.slice(3, 4));
    d.cam(a[0], a[1] + 50, 1.6); await d.wait(900);   // Zulmat looks past Aibar, at the dark behind him
    G.sfx('secret');
    await d.say(D.boss.slice(4));
    d.fog(0); d.music('witness');
    d.final(() => { E.tj_fog(0); set('bossSeen'); });
  }
  async function cutPeace(d) {
    d.music('village');
    E.tj_teleport(...P(54, 43.4)); d.face(0);
    npcAt('zhizhi', 50.4, 39.6, 2, A.idle); npcAt('fengliao', 57.6, 39.6, 6, A.idle); npcAt('kangju', 54, 37, 4, A.idle);
    npcAt('shuga', 49, 42, 2); npcAt('wusunbek', 59, 42, 6); npcAt('envoy', 51.6, 42.4, 2); npcAt('merchant', 57, 43.6, 6);
    d.cam(...P(54, 40), 999); await d.fadeIn(900);
    d.pose(A.interact, 40); d.fx(...P(54, 41), 7, 14);
    await d.say(D.peace);
    const B = G.flags.b;
    await d.say(B.allyZhizhi ? D.peaceAllyZhizhi : B.allyFeng ? D.peaceAllyFeng : D.peaceAllyKangju);
    if (B.raid) await d.say(D.peaceRaid);
    E.tj_light(226, 206, 170);
    await d.say(D.peaceEnd.slice(0, 3));
    d.music('mystery');
    d.cam(...P(88, 18), 2.4); G.sfx('secret'); await d.wait(1600);
    npcAt('knot', 90, 17.6, 2); await d.wait(900); E.tj_npc_flags(NPC.knot, 0, 0, 1); d.fx(...P(90, 17), 2, 8);
    await d.say(D.peaceEnd.slice(3));
    d.final(() => { set('peace'); G.forceNpc = true; });
  }
  async function cutHome(d) {
    d.music('camp');
    d.cam(...P(89, 97), 2); await d.wait(600);
    npcGo('dana', 87, 98.4); npcGo('erlan', 91, 98.4);
    await d.say(D.home.slice(0, 2));
    d.cam(...P(100, 93), 1.6); G.sfx('secret'); await d.wait(1300);   // the tent someone entered eleven seconds earlier
    await d.say(D.home.slice(2, 4));
    d.cam(...P(89, 97), 2); d.music('off'); await d.wait(900);
    await d.say(D.home.slice(4));
    set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now();
    d.final(() => { set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); G.forceNpc = true; });
    d.after(() => G.complete());
  }
  function mirror(id) {
    const s = {fortgate: cutFortgate, council: cutCouncil, boss: cutBoss, peace: cutPeace, home: cutHome}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates, enemyDied, mirror};
}

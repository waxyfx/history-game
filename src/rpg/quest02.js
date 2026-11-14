// MAP02 quest logic: same flag model as MAP01 (grow-only, co-op mergeable), MAP02 world state,
// interaction handlers and the ten cinematic cutscenes. Uses the shared engine API only.
//   talked = witnesses heard, tracks = clues examined (story02 CLUES), petro = murals examined.
import {MAP02} from './gen/map02.js';
import {A, TS, IT as IT1} from './quest.js';
import {DIALOGUES as D, HISTORICAL_QUIZZES, QUESTS, SECRETS, WITNESSES, CLUES, FACTS} from './story02.js';

export const IA = Object.fromEntries(MAP02.interacts.map((n, i) => [n, i]));
export const NPC = Object.fromEntries(MAP02.npcs.map((n, i) => [n, i]));
export const TRIG = Object.fromEntries(MAP02.triggers.map((n, i) => [n, i]));
export const TAG = Object.fromEntries(MAP02.tags.map((n, i) => [n, i]));
export const IT = {...IT1, tablet: 15, ember: 16, mould: 17, seal: 18, bracelet: 19};
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
export function pageLines(f) {
  return ['bronze_metal', 'bronze_economy', 'bronze_burial', 'bronze_tablet'].filter(id => f.quiz[id]?.ok).length;
}
export function secretsFound(f) { return SECRETS.filter(s => f.b[s]).length; }
const reportReady = f => f.talked.filter(w => WITNESSES.includes(w)).length >= 3 && f.tracks.length >= 2 && !!f.quiz.bronze_metal && !!f.quiz.bronze_economy;

export function questStage(f) {
  const b = f.b;
  if (b.finished) return 'done';
  if (b.rekindled) return 'gate';
  if (b.ember) return 'rekindle';
  if (b.keeper) return 'ember';
  if (b.tabletSeen) return 'boss';
  if (b.smithTalk) return 'tablet';
  if (f.petro.length >= 4) return 'smith';
  if (b.under) return 'murals';
  if (f.quiz.bronze_burial) return 'trapdoor';
  if (b.freed) return 'cist';
  if (b.elderClue) return 'sanctuary';
  if (reportReady(f)) return 'report';
  if (b.village) return 'investigate';
  return 'arrive';
}
export function questTarget(f) {
  const stage = questStage(f), t = QUESTS[stage].target;
  if (stage === 'investigate') {
    if (!f.quiz.bronze_metal) return {ia: IA.brokenaxe};
    if (!f.quiz.bronze_economy) return {ia: IA.granary};
    const w = WITNESSES.find(k => !f.talked.includes(k));
    if (f.talked.filter(k => WITNESSES.includes(k)).length < 3 && w) return {npc: NPC[w]};
    const c = Object.keys(CLUES).find(k => !f.tracks.includes(CLUES[k]));
    return {ia: IA[c || 'hearth']};
  }
  if (stage === 'murals') return {ia: IA['mural' + ([1, 2, 3, 4].find(n => !f.petro.includes(n)) || 1)]};
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  return {ia: IA[t]};
}

// ---------------------------------------------------------------- world state from flags
const groupOf = i => MAP02.enemies[i].group;
export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b;
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const tag = (key, hidden) => E.tj_tag(TAG[key], hidden ? 1 : 0);
  const lit = !!b.rekindled;
  tag('hearthcold', lit); tag('hearthlit', !lit); tag('hearthfire', !lit);
  for (const n of [1, 2, 3]) { tag('furnacecold' + n, lit); tag('furnacelit' + n, !lit); }
  tag('loosestone', b.note); tag('sheafstack', b.sheaves); tag('hiddenmould', b.mould);
  tag('trapdoor', b.under); tag('trapopen', !b.under);
  tag('ashwall', b.ashwall); tag('tablet', b.tablet); tag('keeperfire', b.ember);
  const village = !!b.village;
  ia('hearth', true); ia('brokenaxe', b.forgeSeen); ia('forgetrack', village); ia('bracelet', village && !b.bracelet);
  ia('doorsymbol', village); ia('secretnote', !b.note); ia('granary', village); ia('pgaibar', true);
  ia('cist', b.elderClue); ia('mausoleum', true);
  ia('sheafstack', !b.sheaves, 90); ia('hiddenmould', b.sheaves);
  ia('trapdoor', b.under || !!f.quiz.bronze_burial, b.under ? 0 : 120); ia('stairsup', true);
  for (const n of [1, 2, 3, 4]) ia('mural' + n, true);
  ia('ashwall', !b.ashwall, 120); ia('instpillar', b.ashwall); ia('tinstone', b.ashwall);
  ia('tablet', b.smithTalk && !b.tablet); ia('keeperfire', b.keeper && !b.ember); ia('sakagate', true);
  // Enemy groups: 1 burial wolves, 2 raiders on the road, 3 sanctuary shades, 4 underground wraiths, 5 the keeper
  // (group 6 — the keeper's adds — is woken by the engine from phase 2).
  E.tj_groups((1 << 1) | (1 << 2) | (b.elderClue ? 1 << 3 : 0) | (b.under ? 1 << 4 : 0) | (b.bossSeen ? 1 << 5 : 0));
  const under = G.area() === 1;
  E.tj_torch(under ? 1 : 0);
  if (under) E.tj_light(196, 150, 136);
  else if (lit) E.tj_light(224, 196, 158);
  else if (b.village) E.tj_light(184, 156, 146);
  else E.tj_light(176, 150, 146);
  // Triggers
  const arm = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {square: !b.village, forge: village && !b.forgeSeen, sanctuary: b.elderClue && !b.shadesSeen, murals: false,
    arena: b.tabletSeen && !b.bossSeen, burial: !b.burialSeen, workshop: b.sheaves && !b.workshopSeen};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm(k, on); G.armed[k] = on; }
  // NPCs
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  npcFlags('elder', village, village && reportReady(f) && !b.elderClue ? 2 : 0);
  for (const w of WITNESSES) npcFlags(w, village, village && !f.talked.includes(w) ? 1 : 0);
  const smithBelow = b.under && !b.rekindled;
  npcFlags('smith', village, 0, smithBelow);
  const smithDown = smithBelow && f.petro.length >= 4;
  if (smithDown) { E.tj_npc_set(NPC.smithdown, ...P(25, 96.5), 6, A.idle, 1); npcFlags('smithdown', true, b.smithTalk ? 0 : 2); }
  else npcFlags('smithdown', false, 0, 1);
  if (G.forceNpc || G.missingState !== missingState(b)) {
    G.missingState = missingState(b);
    const spots = b.freed ? [[48, 34.5], [54, 34.5], [51, 36]] : [[47, 10.5], [55, 10.5], [51, 14]];
    ['missing1', 'missing2', 'missing3'].forEach((k, i) => {
      if (!b.elderClue) { npcFlags(k, false, 0, 1); return; }
      const anim = b.freed ? (b.rekindled ? A.idle : A.sit) : A.death;
      E.tj_npc_set(NPC[k], ...P(...spots[i]), b.freed ? 4 : 2, anim, 1);
      npcFlags(k, b.freed, 0);
    });
    if (b.rekindled) for (const k of ['elder', 'smith', 'guard', 'grainkeeper', 'villager1', 'villager2']) E.tj_npc_routine(NPC[k]);
  }
  G.forceNpc = false;
  // Kit: the chronicler arrives armed as at the end of MAP01; story items follow team progress.
  grant(G, 'kit', true, () => { E.tj_item_add(IT.spear, 1); E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 12); E.tj_item_add(IT.torch, 1); });
  grant(G, 'bracelet', b.bracelet, () => E.tj_item_add(IT.bracelet, 1));
  grant(G, 'mould', b.mould, () => E.tj_item_add(IT.mould, 1));
  grant(G, 'seal', b.institute, () => E.tj_item_add(IT.seal, 1));
  grant(G, 'tablet', b.tablet, () => E.tj_item_add(IT.tablet, 1));
  grant(G, 'ember', b.ember, () => E.tj_item_add(IT.ember, 1));
  grant(G, 'page', b.rekindled, () => { if (E.tj_item_count(IT.ember) > 0) E.tj_item_add(IT.ember, -1); E.tj_item_add(IT.page, 1); });
}
const missingState = b => [b.elderClue, b.freed, b.rekindled].map(Number).join('');
function grant(G, key, cond, fn) {
  if (cond && !G.local.granted.includes(key)) { G.local.granted.push(key); fn(); }
}

// ---------------------------------------------------------------- handlers
export function createQuest(G) {
  const {E} = G;
  const b = () => G.flags.b;
  const set = k => { if (!G.flags.b[k]) { G.flags.b[k] = true; G.changed(); applyWorld(G); } };
  const pos = key => MAP02.interactPos[key];
  const quiz = id => G.quiz(QID[id]);
  const addTo = (k, v) => { if (!G.flags[k].includes(v)) { G.flags[k] = [...G.flags[k], v]; G.changed(); applyWorld(G); return true; } return false; };

  async function start() { return G.cine('arrival', cutArrival); }

  async function talk(key) {
    const f = G.flags, B = f.b;
    if (key === 'elder') {
      if (!B.village) return;
      if (!B.elderClue && reportReady(f)) return G.cine('report', cutReport);
      if (B.rekindled) return G.say(D.elderAfter);
      return G.say(B.elderClue ? D.elderLater : D.elderWait);
    }
    if (key === 'smith') {
      if (B.rekindled) return G.say(D.smithAfter);
      if (!B.forgeSeen) return G.say(D.smith0);
      return G.say(B.freed ? D.smithBlock : D.smith1);
    }
    if (key === 'smithdown') {
      if (!B.smithTalk && f.petro.length >= 4) return G.cine('smith', cutSmith);
      return G.say(B.smithTalk ? D.smithDownAfter : D.smithDownWait);
    }
    if (key.startsWith('missing')) return G.say(D[key]);
    if (!WITNESSES.includes(key)) return;
    const first = !f.talked.includes(key);
    await G.say(D[key + (first ? '1' : '2')]);
    if (first) {
      addTo('talked', key);
      if (reportReady(G.flags)) G.toast('Айғақтар жеткілікті. Ақсары анаға бар.');
    }
  }

  async function clue(key) {
    const lines = {hearth: D.clueHearth, forgetrack: D.clueTrack, bracelet: D.clueBracelet, doorsymbol: D.clueDoor}[key];
    const fresh = !G.flags.tracks.includes(CLUES[key]);
    await G.say(fresh ? lines : D.clueAgain, key === 'hearth' ? FACTS.hearth : key === 'doorsymbol' ? FACTS.dugout : null);
    if (key === 'bracelet') set('bracelet');
    if (addTo('tracks', CLUES[key]) && reportReady(G.flags)) G.toast('Айғақтар жеткілікті. Ақсары анаға бар.');
  }

  async function interact(key, hold) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'hearth':
        E.tj_checkpoint(...P(51, 34)); E.tj_heal(100); G.save(true);
        if (B.ember && !B.rekindled) return G.cine('rekindle', cutRekindle);
        if (B.rekindled) return G.say([D.page[1]], FACTS.fire);
        if (!B.village) return G.say(D.hearthNeedEmber);
        if (B.keeper) return G.say(D.hearthNeedEmber);
        return clue('hearth');
      case 'forgetrack': case 'bracelet': case 'doorsymbol': return clue(key);
      case 'brokenaxe': {
        const r = await quiz('bronze_metal');
        if (r.fresh && r.ok) { E.tj_item_add(IT.arrows, 8); G.sfx('pickup'); }
        if (r.fresh && reportReady(G.flags)) G.toast('Айғақтар жеткілікті. Ақсары анаға бар.');
        return;
      }
      case 'granary': {
        const r = await quiz('bronze_economy');
        if (r.fresh && r.ok) { E.tj_item_add(IT.herb, 2); G.sfx('pickup'); }
        if (r.fresh && reportReady(G.flags)) G.toast('Айғақтар жеткілікті. Ақсары анаға бар.');
        return;
      }
      case 'cist':
        if (!B.freed) return G.say(D.cistLocked);
        return quiz('bronze_burial');
      case 'secretnote':
        if (!B.note) { set('note'); G.sfx('secret'); G.spawnFx(pos('secretnote'), 2, 8); return G.say(D.note); }
        return;
      case 'pgaibar':
        if (!B.pgaibar) { set('pgaibar'); G.sfx('secret'); }
        return G.say(D.pgaibar, FACTS.petro);
      case 'mausoleum':
        if (!B.mausoleum) { set('mausoleum'); G.sfx('secret'); await G.say(D.mausoleumLook, FACTS.kurgan); }
        return quiz('bronze_mausoleum');
      case 'sheafstack':
        if (hold && !B.sheaves) { set('sheaves'); G.sfx('secret'); G.spawnFx(pos('sheafstack'), 2, 12); return G.say(D.sheafstack); }
        return;
      case 'hiddenmould':
        if (!B.mould) { set('mould'); set('workshop'); G.sfx('pickup'); await G.say(D.mould); }
        return quiz('bronze_casting');
      case 'trapdoor':
        if (B.under) { await G.travel(...P(27, 102.4)); return; }
        if (hold && f.quiz.bronze_burial) return G.cine('discovery', cutDiscovery);
        return;
      case 'stairsup': return G.travel(...P(73.5, 35.4));
      case 'mural1': case 'mural2': case 'mural3': case 'mural4': {
        const n = +key.slice(5);
        await G.say(D[key], n === 2 ? FACTS.petro : null);
        addTo('petro', n);
        if (G.flags.petro.length >= 4 && !B.smithTalk) return G.cine('smith', cutSmith);
        return;
      }
      case 'ashwall':
        if (hold && !B.ashwall) { set('ashwall'); G.sfx('rumble'); E.tj_shake(14); G.spawnFx(pos('ashwall'), 2, 16); return G.say(D.ashwallOpen); }
        return G.say(D.ashwall);
      case 'instpillar':
        if (!B.institute) { set('institute'); G.sfx('secret'); }
        return G.say(D.institute);
      case 'tinstone': {
        const r = await quiz('bronze_tin');
        if (r.fresh) set('tinroom');
        return;
      }
      case 'tablet': if (B.smithTalk && !B.tablet) return G.cine('tablet', cutTablet); return;
      case 'keeperfire':
        if (B.keeper && !B.ember) { set('ember'); G.sfx('pickup'); G.spawnFx(pos('keeperfire'), 0, 20); return G.say(D.ember); }
        return;
      case 'sakagate':
        if (!B.rekindled) return G.say(D.sakaLocked);
        if (!B.finished) return G.cine('saka', cutSaka);
        return G.results();
    }
  }

  async function trigger(key) {
    const B = b();
    if (key === 'square' && !B.village) return G.cine('accuse', cutAccuse);
    if (key === 'forge' && !B.forgeSeen) return G.cine('forge', cutForge);
    if (key === 'sanctuary' && !B.shadesSeen) { set('shadesSeen'); E.tj_shake(8); G.sfx('shadow'); return G.say(D.sanctuary); }
    if (key === 'arena' && !B.bossSeen) return G.cine('boss', cutBoss);
    if (key === 'burial' && !B.burialSeen) { set('burialSeen'); G.sfx('howl'); return G.say(D.burial, FACTS.kurgan); }
    if (key === 'workshop' && !B.workshopSeen) { set('workshopSeen'); return G.say(D.workshop, FACTS.forge); }
  }
  function plates() {}
  async function enemyDied(i, type) {
    if (groupOf(i) === 3 && !b().freed) {
      const left = MAP02.enemies.some((e, j) => e.group === 3 && E.tj_enemy(j, 0) > 0);
      if (!left) { set('freed'); G.sfx('revive'); G.forceNpc = true; applyWorld(G); await G.say(D.freed); }
    }
    if (type === 6 && !b().keeper) {
      set('keeper'); E.tj_shake(30); G.sfx('roar');
      G.spawnFx(pos('keeperfire'), 2, 30);
      await G.say(D.bossDown);
    }
  }

  // ------------------------------------------------------------ cutscenes (skip = fast-forward)
  const npcGo = (key, x, y, run = 0, anim = A.idle) => E.tj_npc_goto(NPC[key], ...P(x, y), run, anim);
  // 1 — Arrival through the gate into the ash.
  async function cutArrival(d) {
    const hero = G.heroPos();
    d.music('mystery');
    d.pose(A.death, 360); d.cam(hero[0], hero[1] - 20, 999);
    G.sfx('portal');
    await d.flash(500);
    d.fx(hero[0], hero[1] - 8, 7, 24);
    await d.fadeIn(1600);
    await d.wait(700);
    await d.say(D.arrive.slice(0, 1));
    d.pose(A.idle, 1);
    await d.say(D.arrive.slice(1));
    d.face(6); await d.wait(600); d.face(2); await d.wait(600);
    d.cam(...P(32, 40), 1.6); await d.wait(1500);       // dugouts on the slope
    d.cam(...P(51, 31), 1.8); await d.wait(1500);       // the dead hearth — no smoke at all
    d.fx(...P(51, 31), 2, 10);
    await d.say(D.arriveLook);
    d.cam(...P(18, 32), 2.2); await d.wait(1400);       // raiders on the road
    d.cam(hero[0], hero[1] - 10, 2.5); await d.wait(700);
    applyWorld(G);
    await d.say(D.arriveKit);
    d.music('explore');
    d.final(() => set('arrived'));
  }
  // 2 — Accusation in the square.
  async function cutAccuse(d) {
    d.music('danger');
    const [hx, hy] = G.heroPos();
    npcGo('guard', hx / TS + 1.6, hy / TS, 1, A.idle);
    d.cam(hx + 20, hy - 8, 3); await d.wait(900);
    d.face(2);
    await d.say(D.accuse.slice(0, 1));
    for (const [k, x, y] of [['villager1', 46, 30.5], ['villager2', 46.5, 34.5], ['grainkeeper', 48.5, 36], ['shepherd', 47.5, 28.4]]) npcGo(k, x, y, 1, A.talk);
    d.cam(...P(47, 32), 2); await d.wait(1200);
    await d.say(D.accuse.slice(1, 4));
    npcGo('elder', 46.2, 31.6, 0, A.talk);
    d.music('village');
    d.cam(...P(46, 31.6), 1.4); await d.wait(1500);
    await d.say(D.accuse.slice(4, 7));
    await d.wait(300);
    await d.say(D.accuse.slice(7));
    d.final(() => { set('village'); G.forceNpc = true; for (const k of ['elder', 'guard', 'villager1', 'villager2', 'grainkeeper', 'shepherd']) E.tj_npc_routine(NPC[k]); });
  }
  // 3 — Forge: a smith hammering at a cold furnace.
  async function cutForge(d) {
    d.music('mystery');
    E.tj_npc_set(NPC.smith, ...P(72, 30.6), 2, A.work, 1);
    d.cam(...P(72, 30), 2.4); await d.wait(900);
    G.sfx('impact'); await d.wait(500); G.sfx('impact'); d.fx(...P(73, 30.2), 0, 6);
    await d.wait(400);
    E.tj_npc_face(NPC.smith, 6);
    await d.say(D.forge.slice(0, 3));
    d.cam(...pos('trapdoor'), 3); await d.wait(1100);   // he glanced at the floor
    await d.say(D.forge.slice(3, 4));
    d.cam(...pos('brokenaxe'), 2.5); await d.wait(800);
    await d.say(D.forge.slice(4));
    d.final(() => { set('forgeSeen'); E.tj_npc_routine(NPC.smith); });
  }
  // (between 3 and 4) the elder hears the contradictions.
  async function cutReport(d) {
    d.cam(...P(49, 29), 2.5); await d.wait(500);
    npcGo('guard', 47.4, 30.4, 0, A.idle);
    await d.say(D.report.slice(0, 3));
    E.tj_npc_face(NPC.guard, 2);
    await d.say(D.report.slice(3, 4));
    d.cam(...P(51, 10), 2.6); await d.wait(1400);       // the sanctuary hill
    d.fx(...P(51, 10), 7, 14);
    G.sfx('shadow');
    await d.say(D.report.slice(4));
    d.final(() => { set('elderClue'); G.forceNpc = true; E.tj_npc_routine(NPC.guard); });
  }
  // 4 — Discovery: the trapdoor and the painted hall below the forge.
  async function cutDiscovery(d) {
    d.music('off');
    const td = pos('trapdoor');
    npcGo('smith', 74.6, 33.4, 1, A.talk);
    d.cam(td[0], td[1], 3); await d.wait(900);
    await d.say(D.discoveryStop);
    G.sfx('rumble'); E.tj_shake(16); d.fx(td[0], td[1], 2, 14);
    E.tj_tag(TAG.trapdoor, 1); E.tj_tag(TAG.trapopen, 0);
    await d.wait(800);
    set('under');
    await G.travel(...P(27, 102.4));
    E.tj_checkpoint(...P(27, 102.4));
    d.music('mystery');
    d.cam(...P(27, 96), 1.6); await d.wait(1200);
    await d.say(D.discovery.slice(0, 1));
    d.cam(...P(19, 92), 1.6); await d.wait(1300);
    G.sfx('portal'); d.fx(...P(19, 91), 0, 16);
    await d.say(D.discovery.slice(1, 3));
    d.cam(...P(35.5, 92), 1.2); await d.wait(1500);
    await d.say(D.discovery.slice(3));
    d.final(() => { set('under'); E.tj_checkpoint(...P(27, 102.4)); G.forceNpc = true; });
  }
  // 5 — The smith's confession under the murals, then 6 — Zulmat.
  async function cutSmith(d) {
    d.music('mystery');
    E.tj_npc_set(NPC.smithdown, ...P(27, 103), 0, A.idle, 1);
    npcGo('smithdown', 25, 96.5, 0, A.talk);
    d.cam(...P(26, 99), 2); await d.wait(1600);
    await d.say(D.smithTalk.slice(0, 3));
    d.cam(...P(35.5, 92), 2); await d.wait(900);      // the chronicler on the wall
    await d.say(D.smithTalk.slice(3, 5));
    d.cam(...P(25, 96.5), 2.4); await d.wait(700);
    await d.say(D.smithTalk.slice(5));
    d.final(() => { G.forceNpc = true; });
    d.after(() => G.cine('zulmat', cutZulmat));
  }
  async function cutZulmat(d) {
    d.music('off');
    const at = P(30, 92);
    d.cam(at[0], at[1], 2); await d.wait(600);
    d.fog(160); G.sfx('shadow'); E.tj_light(110, 80, 130);
    for (let a = 0; a <= 210; a += 20) { E.tj_shadow(at[0], at[1] - 20, a); await d.wait(70); }
    await d.say(D.zulmat.slice(0, 2));
    await d.wait(500);
    await d.say(D.zulmat.slice(2, 3));               // «Сен әлі де оларды өзіңнен қорқытатын мен деп ойлайсың ба?»
    await d.wait(700);
    await d.say(D.zulmat.slice(3, 5));
    d.cam(...P(25, 96.5), 2.6); await d.wait(700);
    await d.say(D.zulmat.slice(5, 6));               // «Ол дұрыс айтады. Біз сені есімізде сақтадық.»
    await d.wait(600);
    await d.say(D.zulmat.slice(6, 8));
    E.tj_shake(10); G.sfx('whoosh');
    for (let a = 210; a >= 0; a -= 21) { E.tj_shadow(at[0], at[1] - 20, a); await d.wait(50); }
    await d.say(D.zulmat.slice(8));
    d.fog(0);
    d.final(() => { E.tj_shadow(0, 0, 0); E.tj_fog(0); set('smithTalk'); });
  }
  // 7 — The bronze tablet, then the final trial.
  async function cutTablet(d) {
    d.music('mystery');
    const tp = pos('tablet');
    d.cam(tp[0], tp[1] - 10, 2); await d.wait(700);
    d.pose(A.interact, 40);
    await d.say(D.tablet.slice(0, 2));
    G.sfx('page'); await d.flash(260); d.fx(tp[0], tp[1] - 8, 0, 20);
    await d.say(D.tablet.slice(2, 3));
    await d.wait(500);
    await d.say(D.tablet.slice(3, 4));
    d.fog(110); G.sfx('shadow');
    await d.say(D.tablet.slice(4));
    d.fog(0);
    d.final(() => { E.tj_fog(0); set('tablet'); set('tabletSeen'); });
    d.after(async () => { await quiz('bronze_tablet'); await G.say(D.tabletAfter); });
  }
  // 8 — The distorted keeper of the sacred fire.
  async function cutBoss(d) {
    d.music('off');
    const kf = pos('keeperfire');
    d.cam(kf[0], kf[1] + 30, 2); await d.wait(900);
    G.sfx('rumble'); E.tj_shake(18);
    d.fx(kf[0], kf[1] + 40, 2, 20);
    await d.wait(700);
    await d.say(D.boss.slice(0, 1));
    G.sfx('roar'); E.tj_shake(26);
    await d.say(D.boss.slice(1, 3));
    d.music('danger');
    await d.say(D.boss.slice(3));
    d.final(() => set('bossSeen'));
  }
  // 9 — Rekindling: the hearth, the furnaces, the village.
  async function cutRekindle(d) {
    d.music('village');
    const h = pos('hearth');
    for (const [k, x, y] of [['elder', 49, 30], ['guard', 47, 32.5], ['smith', 54.5, 32.5], ['grainkeeper', 48.5, 35.4], ['villager1', 53.5, 35.4], ['villager2', 55, 30.4]]) npcGo(k, x, y, 0, A.idle);
    d.cam(h[0], h[1] - 10, 2.2); await d.wait(1100);
    await d.say(D.rekindle.slice(0, 2));
    d.pose(A.interact, 60);
    await d.wait(500);
    G.sfx('portal'); await d.flash(300);
    set('rekindled');
    G.forceNpc = true; applyWorld(G);
    for (const k of ['elder', 'guard', 'smith', 'grainkeeper', 'villager1', 'villager2']) E.tj_npc_set(NPC[k], ...P(...{elder: [49, 30], guard: [47, 32.5], smith: [54.5, 32.5], grainkeeper: [48.5, 35.4], villager1: [53.5, 35.4], villager2: [55, 30.4]}[k]), 4, A.idle, 1);
    d.fx(h[0], h[1] - 6, 0, 30); E.tj_shake(8);
    await d.say(D.rekindle.slice(2, 3));
    d.cam(...P(74, 30), 1.6); await d.wait(1200);    // the furnaces roar again
    G.sfx('impact');
    d.cam(h[0], h[1] - 10, 1.6); await d.wait(900);
    await d.say(D.rekindle.slice(3));
    d.pose(A.victory, 200);
    G.sfx('page');
    await d.say(D.page);
    if (pageLines(G.flags) < PAGE_TOTAL) await d.say(D.pageDistorted);
    d.cam(...pos('sakagate'), 2); G.sfx('portal'); d.fx(...pos('sakagate'), 7, 20); await d.wait(1100);
    d.final(() => { set('rekindled'); G.forceNpc = true; });
  }
  // 10 — Transition to the Saka world.
  async function cutSaka(d) {
    d.music('mystery');
    const g = pos('sakagate');
    d.cam(g[0], g[1] - 12, 2); await d.wait(800);
    G.sfx('portal'); d.fx(g[0], g[1] - 8, 7, 26); E.tj_shake(10);
    await d.say(D.saka.slice(0, 3));
    d.fog(120); G.sfx('shadow');
    for (let a = 0; a <= 150; a += 15) { E.tj_shadow(g[0], g[1] - 44, a); await d.wait(60); }
    await d.say(D.saka.slice(3, 4));
    for (let a = 150; a >= 0; a -= 15) { E.tj_shadow(g[0], g[1] - 44, a); await d.wait(40); }
    d.fog(0);
    await d.say(D.saka.slice(4));
    await d.walk(g[0], g[1] + 6);
    await d.flash(900);
    set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now();
    d.final(() => { E.tj_shadow(0, 0, 0); E.tj_fog(0); set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); });
    d.after(() => G.complete());
  }

  function mirror(id) {
    const s = {accuse: cutAccuse, forge: cutForge, report: cutReport, discovery: cutDiscovery, smith: cutSmith, zulmat: cutZulmat,
      boss: cutBoss, rekindle: cutRekindle, saka: cutSaka}[id];
    if (s) G.cine(id, s);
  }
  return {start, talk, interact, trigger, plates, enemyDied, mirror};
}

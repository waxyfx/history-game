// MAP01 quest logic: shared story flags, deterministic world state, interaction handlers, cutscenes.
// Flags only grow (booleans become true, sets gain members, first solved quiz wins), so
// co-op peers can merge them in any order without conflicts or duplicated rewards.
import {MAP01} from './gen/map01.js';
import {ANIMS, SHEETS} from './gen/atlas.js';
import {DIALOGUES, HISTORICAL_QUIZZES, FACTS, VILLAGERS, SECRETS, QUESTS, BONUS_META, CACHE_BRANCH} from './story.js';

export const TS = 16;
export const A = Object.fromEntries(ANIMS.map((n, i) => [n, i]));
export const SH = Object.fromEntries(SHEETS.map((n, i) => [n, i]));
export const IA = Object.fromEntries(MAP01.interacts.map((n, i) => [n, i]));
export const NPC = Object.fromEntries(MAP01.npcs.map((n, i) => [n, i]));
export const TRIG = Object.fromEntries(MAP01.triggers.map((n, i) => [n, i]));
export const TAG = Object.fromEntries(MAP01.tags.map((n, i) => [n, i]));
const P = (x, y) => [Math.round(x * TS), Math.round(y * TS)];
// Item ids (src/rpg/inventory.hpp)
export const IT = {sword: 1, spear: 2, bow: 3, arrows: 4, kit: 5, tool: 6, torch: 7, page: 8, herb: 9, quiver: 10, ochre: 11, flute: 12, crystal: 13, necklace: 14};

export function newFlags() {
  return {b: {}, talked: [], tracks: [], petro: [], quiz: {}, bonus: null, t0: Date.now(), tEnd: 0};
}
export function mergeFlags(a, b) {
  const out = newFlags();
  out.b = {...a.b};
  for (const k in b.b || {}) if (b.b[k]) out.b[k] = true;
  for (const k of ['talked', 'tracks', 'petro']) out[k] = [...new Set([...(a[k] || []), ...(b[k] || [])])].sort();
  out.quiz = {...a.quiz};
  for (const [id, r] of Object.entries(b.quiz || {})) if (!out.quiz[id] || r.t < out.quiz[id].t) out.quiz[id] = r;
  out.bonus = !a.bonus ? b.bonus || null : !b.bonus ? a.bonus : (b.bonus.t < a.bonus.t ? b.bonus : a.bonus);
  out.t0 = Math.min(a.t0 || Date.now(), b.t0 || Date.now());
  out.tEnd = a.tEnd && b.tEnd ? Math.min(a.tEnd, b.tEnd) : a.tEnd || b.tEnd || 0;
  return out;
}

export function secretsFound(f) {
  return SECRETS.filter(s => s === 'petro' ? f.petro.length >= 4 : f.b[s]).length;
}
// Level score (max 100, pass 90): trial weights from story.js; mirrors 007_competition.sql.
export const MAX_SCORE = 100, PASS_SCORE = 90;
export const TRIAL_POINTS = Object.fromEntries([...Object.values(HISTORICAL_QUIZZES).map(q => [q.id, q.points]), ...BONUS_META.map(b => [b.id, b.points])]);
export function scoreOf(f) {
  let s = 0;
  for (const [id, r] of Object.entries(f.quiz)) if (r.ok) s += TRIAL_POINTS[id] || 0;
  return Math.min(MAX_SCORE, s);
}
// Page completeness: the four lines restored by the mandatory and final trials.
export function pageLines(f) {
  return ['stone_main', 'stone_hunting', 'stone_cave', 'stone_secret'].filter(id => f.quiz[id]?.ok).length;
}
export function questStage(f) {
  const b = f.b;
  if (b.camp) return 'camp';
  if (b.finished) return 'portal';
  if (f.quiz.stone_secret) return 'page';
  if (b.inCave) return 'depths';
  if (b.caveOpen) return 'enter';
  if (b.returned) return 'cave';
  if (b.freed) return 'back';
  if (b.ravine || f.tracks.length >= 4) return 'rescue';
  if (b.elderTask) return 'tracks';
  if (f.talked.length >= 3) return 'report';
  if (b.village) return 'village';
  return 'arrive';
}
export function questTarget(f) {
  const q = QUESTS[questStage(f)], t = q.target;
  if (!t) return null;
  if (t.startsWith('npc:')) return {npc: NPC[t.slice(4)]};
  if (t === 'track1') { const next = [1, 2, 3, 4].find(n => !f.tracks.includes(n)) || 4; return {ia: IA['track' + next]}; }
  return {ia: IA[t]};
}

// ---------------------------------------------------------------- world state from flags
export function applyWorld(G) {
  const {E, flags: f} = G, b = f.b, party = G.party();
  const ia = (key, on, hold = 0) => E.tj_ia(IA[key], on ? 1 : 0, hold);
  const tag = (key, hidden) => E.tj_tag(TAG[key], hidden ? 1 : 0);
  tag('page1', b.page1); tag('page2', b.page2); tag('boulder', b.caveOpen);
  tag('thicket', b.thicket); tag('cachebush', b.cachebush); tag('cache', b.cache);
  tag('crackrock', b.crack); tag('flute', b.flute); tag('homegate', !b.finished);
  ia('page1', !b.page1);
  ia('firepit', true); ia('toolpile', b.bow);
  for (const n of [1, 2, 3, 4]) ia('track' + n, b.elderTask);
  ia('thicket', !b.thicket); ia('cachebush', !b.cachebush); ia('cache', b.cachebush && !b.cache);
  ia('rope', b.elderTask && !b.freed, 200);
  ia('boulder', b.returned && !b.caveOpen); ia('lever', b.returned && !b.caveOpen && party === 1, 150);
  ia('cavemouth', b.caveOpen); ia('caveexit', true);
  for (const n of [1, 2, 3, 4]) ia('petro' + n, true);
  ia('crack', !b.crack, 110); ia('altar', b.crack); ia('flute', b.crack && !b.flute);
  ia('zmark', true); ia('page2', !!f.quiz.stone_secret && !b.page2);
  ia('homegate', b.finished); ia('campgate', true); ia('holo', true);
  // Enemy groups: 1 hunting wolves, 2 ravine wolves, 3 strangers (flee from the shadow), 4 cave bear.
  E.tj_groups((1 << 1) | (1 << 2) | (b.shadow ? 0 : 1 << 3) | (1 << 4));
  E.tj_torch(b.returned ? 1 : 0);
  // Light: day -> golden afternoon after the rescue -> dusk after the return.
  if (G.area() === 2) E.tj_light(190, 198, 214);
  else if (b.returned) E.tj_light(170, 136, 150);
  else if (b.freed) E.tj_light(214, 196, 166);
  else E.tj_light(200, 200, 200);
  // Triggers
  const arm = (k, on) => E.tj_trigger_arm(TRIG[k], on ? 1 : 0);
  if (!G.armed) G.armed = {};
  const want = {settlement: !b.village || (b.shadow && !b.returned), ravine: b.elderTask && !b.ravine, cave_hall: b.inCave && !b.bearSeen,
    cave_paint: !b.paint, plates: b.returned && !b.caveOpen, hunting: false, shadow: false};
  for (const [k, on] of Object.entries(want)) if (G.armed[k] !== on) { arm(k, on); G.armed[k] = on; }
  // NPCs
  const npcFlags = (key, talk, bubble, hidden = 0) => E.tj_npc_flags(NPC[key], talk ? 1 : 0, bubble, hidden ? 1 : 0);
  const elderBubble = (!b.village) ? 0 : (f.talked.length >= 3 && !b.elderTask) ? 2 : 0;
  npcFlags('elder', b.village, elderBubble);
  for (const v of VILLAGERS) npcFlags(v, b.village, b.village && !f.talked.includes(v) ? 1 : 0);
  const alarm = b.shadow && !b.returned;
  if (alarm !== G.alarm || G.forceNpc) {
    G.alarm = alarm;
    if (alarm) { // Danger: the hunter is gone and a shadow walks the rocks — villagers keep close to the fire.
      E.tj_npc_goto(NPC.scraper, ...P(42.5, 43.2), 1, A.idle); E.tj_npc_goto(NPC.cook, ...P(30.6, 40.2), 0, A.idle);
      E.tj_npc_goto(NPC.child, ...P(27, 38.4), 1, A.idle); E.tj_npc_goto(NPC.crafter, ...P(33.6, 42.6), 0, A.idle);
    } else for (const v of [...VILLAGERS, 'elder']) E.tj_npc_routine(NPC[v]);
  }
  if (!b.freed) { npcFlags('hunter', false, 0); E.tj_npc_set(NPC.hunter, ...P(89.2, 21.6), 4, A.sit, 1); }
  else if (!b.returned) npcFlags('hunter', false, 0, 1);
  else { E.tj_npc_set(NPC.hunter, ...P(35.2, 44.6), 6, A.idle, 1); npcFlags('hunter', true, 0); }
  const solo = party === 1;
  E.tj_npc_set(NPC.dana, ...P(70, 89), 3, A.idle, solo ? 1 : 0); E.tj_npc_set(NPC.erlan, ...P(82, 89), 5, A.talk, solo ? 1 : 0);
  npcFlags('dana', solo, 0); npcFlags('erlan', solo, 0);
  G.forceNpc = false;
  // Personal kit follows team progress (co-op joiners receive what the village gave the team).
  grant(G, 'bow', b.bow, () => { E.tj_item_add(IT.bow, 1); E.tj_item_add(IT.arrows, 12); });
  grant(G, 'spear', b.spear, () => E.tj_item_add(IT.spear, 1));
  grant(G, 'torch', b.returned, () => { E.tj_item_add(IT.torch, 1); E.tj_item_add(IT.necklace, 1); });
  grant(G, 'page', b.page1, () => E.tj_item_add(IT.page, 1));
}
function grant(G, key, cond, fn) {
  if (cond && !G.local.granted.includes(key)) { G.local.granted.push(key); fn(); }
}

// ---------------------------------------------------------------- handlers
const D = DIALOGUES;
export function createQuest(G) {
  const {E} = G;
  const b = () => G.flags.b;
  const set = (k) => { if (!G.flags.b[k]) { G.flags.b[k] = true; G.changed(); applyWorld(G); } };
  const pos = key => MAP01.interactPos[key];

  async function talk(npcKey) {
    const f = G.flags, B = f.b;
    if (npcKey === 'elder') {
      if (!B.village) return;
      if (!B.elderTask && f.talked.length >= 3) return G.cine('elderTask', cutElderTask);
      if (!B.elderTask) return G.say(f.talked.length ? D.elderWait : D.elder1);
      if (B.returned) return G.say(D.elderAfter);
      return G.say([D.elder2[3]]);
    }
    if (npcKey === 'hunter') return G.say(D.hunterTalk);
    if (npcKey === 'dana') return G.say(G.flags.b.camp ? D.dana : D.camp);
    if (npcKey === 'erlan') return G.say(D.erlan);
    if (!VILLAGERS.includes(npcKey)) return;
    const first = !f.talked.includes(npcKey);
    await G.say(D[npcKey + (first ? '1' : '2')]);
    if (first) {
      f.talked = [...f.talked, npcKey];
      if (npcKey === 'crafter') set('bow');
      if (npcKey === 'scraper') set('spear');
      if (npcKey === 'cook') { E.tj_item_add(IT.herb, 2); }
      G.changed();
      if (f.talked.length === 3) G.toast(G.lang() === 'ru' ? 'Вернись к старейшине Тасқаре.' : 'Тасқара ақсақалға орал.');
    }
  }

  async function interact(key, hold) {
    const f = G.flags, B = f.b;
    switch (key) {
      case 'page1': if (!B.page1) return G.cine('intro', cutIntro, true); return;
      case 'firepit': E.tj_checkpoint(...P(31, 42.6)); E.tj_heal(100); G.save(true); return G.say(D.firepit, FACTS.fire);
      case 'toolpile': { // Shaqpaq's trial (secret): trust and a gift depend on the choice.
        const r = await G.quiz(2);
        if (r.fresh && r.ok) { E.tj_item_add(IT.tool, 1); E.tj_item_add(IT.arrows, 6); G.sfx('pickup'); }
        return;
      }
      case 'track1': case 'track2': case 'track3': case 'track4': {
        const n = +key.slice(5);
        await G.say(D[key]);
        if (!f.tracks.includes(n)) { f.tracks = [...f.tracks, n]; G.changed(); }
        if (n === 4 && !B.quiver) { set('quiver'); E.tj_item_add(IT.quiver, 1); E.tj_item_add(IT.arrows, 8); G.sfx('pickup'); await G.quiz(3); }
        return;
      }
      case 'thicket': set('thicket'); G.sfx('secret'); G.spawnFx(pos('thicket'), 2, 10); return G.say(D.thicket);
      case 'cachebush': set('cachebush'); G.spawnFx(pos('cachebush'), 2, 8); return G.say(D.cachebush);
      case 'cache': if (!B.cache) { set('cache'); E.tj_item_add(IT.arrows, 10); E.tj_item_add(IT.herb, 1); E.tj_item_add(IT.kit, 1); G.sfx('secret'); await G.say(D.cache); await G.bonusTrial(3, CACHE_BRANCH); } return;
      case 'rope': if (hold && !B.freed) { set('freed'); return G.cine('freed', cutFreed); } return;
      case 'boulder': return G.say(G.party() > 1 ? D.boulderCoop : [...D.boulder, ...D.boulderSolo]);
      case 'lever': if (hold && !B.caveOpen) { set('caveOpen'); return G.cine('opened', cutOpened); } return;
      case 'cavemouth': if (!B.caveOpen) return;
        await G.travel(...P(25, 104.5));
        if (!B.inCave) set('inCave');
        return;
      case 'caveexit': return G.travel(...P(102, 10.4));
      case 'petro1': case 'petro2': case 'petro3': case 'petro4': {
        const n = +key.slice(5);
        if (n !== 1) await G.say(D[key], FACTS.petro); // petro1 is the «sun-headed man» trial
        if (!f.petro.includes(n)) {
          f.petro = [...f.petro, n]; G.changed();
          if (f.petro.length === 4) { E.tj_item_add(IT.ochre, 1); G.sfx('secret'); await G.say(D.petroAll, FACTS.ochre); }
        }
        if (n === 1) await G.quiz(4);
        return;
      }
      case 'crack': if (hold && !B.crack) { set('crack'); set('chamber'); G.sfx('rumble'); E.tj_shake(18); G.spawnFx(pos('crack'), 2, 14); G.sfx('secret'); return G.say([...D.crack, ...D.chamber]); } return;
      case 'altar': return G.chamber();
      case 'flute': if (!B.flute) { set('flute'); E.tj_item_add(IT.flute, 1); G.sfx('secret'); return G.say(D.flute); } return;
      case 'zmark':
        if (f.quiz.stone_secret) return G.say([D.zmark[0]]);
        await G.say(D.zmark);
        if (!G.local.crystal) { G.local.crystal = 1; E.tj_item_add(IT.crystal, 1); }
        return G.quiz(5);
      case 'page2': if (!B.page2 && f.quiz.stone_secret) { set('page2'); return G.cine('page', cutPage); } return;
      case 'homegate':
        G.sfx('portal');
        await G.travel(...P(76, 83));
        if (!B.camp) { set('camp'); if (G.party() === 1) await G.cine('camp', cutCamp); }
        return;
      case 'campgate':
        if (!G.levelPassed()) return G.say(D.campgateLocked);
        await G.say(D.campgateOpen);
        return G.gotoLevel?.(2);
      case 'holo': return G.results();
    }
  }

  async function trigger(key) {
    const B = b();
    if (key === 'settlement') {
      if (!B.village) return G.cine('meet', cutMeet);
      if (B.shadow && !B.returned) return G.cine('return', cutReturn);
    }
    if (key === 'ravine') { set('ravine'); return G.say(D.ravine); }
    if (key === 'cave_hall' && !B.bearSeen) { set('bearSeen'); return G.cine('bear', cutBear); }
    if (key === 'cave_paint' && !B.paint) { set('paint'); return G.say(D.paint); }
    if (key === 'plates' && !B.caveOpen) return G.say(G.party() > 1 ? D.boulderCoop : D.boulder);
  }
  function plates(mask) {
    if (b().caveOpen || !b().returned) return;
    if (mask === 3) { set('caveOpen'); G.cine('opened', cutOpened); }
    else if (mask) G.toast(G.lang() === 'ru' ? D.plates1[0].ru : D.plates1[0].kk);
  }
  function enemyDied(i, type) {
    if (type === 3) set('bear');
  }

  // ------------------------------------------------------------ cutscenes
  // Every cutscene: opening shot -> action -> dialogue -> visual event -> reaction -> hand-off.
  // Skipping fast-forwards the same script, so the end state (flags, items, NPCs) is identical.
  const npcGo = (key, x, y, run = 0, anim = A.idle) => E.tj_npc_goto(NPC[key], ...P(x, y), run, anim);
  async function cutIntro(d) {
    const hero = G.heroPos();
    d.music('mystery');
    d.pose(A.death, 400); d.cam(hero[0], hero[1] - 20, 999);
    G.sfx('portal');
    await d.flash(500);
    await d.fadeIn(1800);
    await d.wait(900);
    await d.say(D.wake.slice(0, 1));
    d.pose(A.idle, 1);
    await d.wait(500);
    await d.say(D.wake.slice(1));
    // Looking around: left, right, then the horizon.
    d.face(6); await d.wait(700); d.face(2); await d.wait(700);
    d.cam(hero[0] + 90, hero[1] - 40, 1.2); await d.wait(1200);
    await d.say(D.look);
    d.music('explore');
    d.cam(...P(32, 39), 2.2); await d.wait(2400);
    d.fx(...P(32, 40.4), 1, 8);
    await d.wait(500);
    await d.say(D.smoke);
    d.cam(...pos('page1'), 3); await d.wait(900);
    await d.walk(pos('page1')[0] - 12, pos('page1')[1] + 4);
    d.face(2); d.pose(A.interact, 30);
    await d.say([D.fragment[0]]);
    G.sfx('page'); d.fx(...pos('page1'), 0, 18); E.tj_shake(6);
    set('page1'); applyWorld(G);
    await d.wait(600);
    await d.say(D.fragment.slice(1));
    d.camFollow();
    d.final(() => { set('intro'); set('page1'); });
    d.after(() => G.quiz(1));
  }
  async function cutMeet(d) {
    d.music('village');
    d.cam(...P(32, 41), 2.5);              // Opening: the fire, people at work.
    await d.wait(1200);
    npcGo('child', 32.4, 39.8, 1, A.talk);  // The child runs to the elder.
    E.tj_npc_face(NPC.crafter, 6); E.tj_npc_face(NPC.cook, 6);
    await d.wait(900);
    await d.say(D.meet.slice(0, 1));
    npcGo('scraper', 27, 42.6, 1, A.idle);  // Qamys blocks the stranger's way.
    d.cam(...P(27, 42.4), 3); await d.wait(900);
    await d.say(D.meet.slice(1, 3));
    await d.wait(400);
    npcGo('elder', 27.6, 41.4, 0, A.talk);
    d.cam(...P(28.5, 41.6), 1.6); await d.wait(1600);
    await d.say(D.meet.slice(3));
    d.final(() => { set('village'); G.forceNpc = true; for (const k of ['elder', 'child', 'scraper']) E.tj_npc_routine(NPC[k]); });
  }
  async function cutElderTask(d) {
    d.cam(...P(33, 40), 3);
    await d.say(D.elder2.slice(0, 1));
    G.sfx('howl');                           // Far away, the wolves answer.
    d.cam(...P(60, 46), 3.2); await d.wait(1600);
    d.fx(...P(85, 32), 1, 10);
    await d.say(D.elder2.slice(1, 2));
    d.cam(...P(31, 42), 4); await d.wait(900);
    await d.say(D.elder2.slice(2, 3));
    await d.wait(500);
    d.cam(...P(33, 40), 2); await d.wait(600);
    await d.say(D.elder2.slice(3));
    d.final(() => set('elderTask'));
  }
  async function cutFreed(d) {
    d.music('mystery');
    const post = P(89.2, 21.6);
    d.cam(post[0], post[1] - 10, 3);
    E.tj_npc_set(NPC.hunter, post[0] - 6, post[1] + 6, 2, A.idle, 1);
    await d.wait(500);
    await d.say(D.freed);
    // Scene 4: the shadow on the rocks. Silence first, then fog.
    const rock = P(100, 19.6);
    d.music('off'); await d.wait(700);
    d.fog(170); G.sfx('shadow'); E.tj_light(150, 130, 175);
    d.cam(rock[0], rock[1] - 10, 1.4);
    await d.wait(1600);
    for (let a = 0; a <= 220; a += 20) { E.tj_shadow(rock[0], rock[1] - 22, a); await d.wait(80); }
    await d.wait(600);
    await d.say(D.shadow.slice(0, 1));
    await d.wait(400);
    await d.say(D.shadow.slice(1, 2));
    E.tj_shake(14); G.sfx('whoosh'); await d.flash(220);
    for (let a = 220; a >= 0; a -= 22) { E.tj_shadow(rock[0], rock[1] - 22, a); await d.wait(50); }
    d.fx(rock[0], rock[1] - 24, 7, 28);
    d.fog(0); E.tj_light(214, 196, 166);
    await d.wait(500);
    d.cam(post[0], post[1] - 10, 2.4); await d.wait(800);
    await d.say(D.shadow.slice(2, 4));
    await d.say(D.shadow.slice(4));
    d.music('explore');
    await d.say(D.shadowAfter);
    E.tj_npc_goto(NPC.hunter, ...P(84, 30), 1, A.idle);
    await d.wait(1600);
    d.final(() => { E.tj_shadow(0, 0, 0); E.tj_fog(0); set('shadow'); G.forceNpc = true; });
  }
  async function cutReturn(d) {
    d.music('village');
    E.tj_light(185, 150, 150);              // Sunset over the settlement.
    E.tj_npc_set(NPC.hunter, ...P(36, 44), 6, A.idle, 1);
    d.cam(...P(33, 42), 2.5);
    await d.wait(800);
    npcGo('child', 34.4, 43.4, 1, A.talk);
    await d.say(D.return1.slice(0, 1));
    npcGo('cook', 33.2, 44.4, 0, A.idle); npcGo('crafter', 37, 43, 0, A.idle);
    await d.wait(700);
    await d.say(D.return1.slice(1, 4));
    G.sfx('pickup');
    await d.say(D.return1.slice(4, 5));
    E.tj_light(170, 136, 150);
    await d.wait(600);
    await d.say(D.return1.slice(5, 7));
    d.cam(...P(100, 10), 5); await d.wait(2000);   // The painted cave, far in the ravine.
    G.sfx('howl');
    await d.say(D.return1.slice(7, 8));
    d.cam(...P(33, 42), 6); await d.wait(900);
    await d.say(D.return1.slice(8));
    d.final(() => { set('returned'); G.forceNpc = true; });
  }
  async function cutOpened(d) {
    const bp = pos('boulder');
    d.cam(bp[0], bp[1], 3);
    await d.wait(600);
    G.sfx('rumble'); E.tj_shake(40);
    for (let i = 0; i < 6; i++) { d.fx(bp[0] + (i - 2.5) * 10, bp[1], 2, 6); await d.wait(170); }
    set('caveOpen'); applyWorld(G);
    await d.wait(700);
    d.cam(bp[0], bp[1] - 24, 1); await d.wait(700);
    await d.say(D.opened);
    d.final(() => set('caveOpen'));
  }
  async function cutBear(d) {
    d.music('off');
    d.cam(...P(25, 96.6), 3); await d.wait(1100);
    E.tj_shake(24); G.sfx('roar');
    d.music('danger');
    await d.wait(800);
    await d.say(D.bear);
  }
  async function cutPage(d) {
    d.music('mystery');
    const pp = pos('page2');
    d.cam(pp[0], pp[1] - 10, 2);
    d.pose(A.victory, 260);
    G.sfx('page'); d.fx(pp[0], pp[1] - 6, 0, 28); await d.flash(300);
    E.tj_item_add(IT.page, 2);
    await d.say(D.page.slice(0, 2));
    d.music('off'); await d.wait(600);
    d.fog(150); G.sfx('shadow'); E.tj_light(90, 70, 120);
    for (let a = 0; a <= 150; a += 15) { E.tj_shadow(pp[0], pp[1] - 40, a); await d.wait(70); }
    await d.say(D.page.slice(2, 3));
    await d.wait(700);
    await d.say(D.page.slice(3, 4));
    for (let a = 150; a >= 0; a -= 15) { E.tj_shadow(pp[0], pp[1] - 40, a); await d.wait(50); }
    d.fog(0);
    await d.say(D.page.slice(4));
    G.sfx('portal'); E.tj_shake(10);
    set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); applyWorld(G);
    d.cam(...pos('homegate'), 2); await d.wait(1100);
    await d.say(D.portal);
    d.final(() => { E.tj_shadow(0, 0, 0); E.tj_fog(0); set('finished'); if (!G.flags.tEnd) G.flags.tEnd = Date.now(); });
    d.after(() => G.complete());
  }
  async function cutCamp(d) {
    d.music('camp');
    d.cam(...P(66, 84), 2); await d.wait(900);   // Tents of the field team, then the gate.
    d.cam(...P(76, 80), 2); await d.wait(1100);
    d.cam(...P(76, 86), 2); await d.wait(700);
    await d.say(D.camp);
  }

  // Peers replay a story beat that a teammate triggered (flags inside the scripts are idempotent).
  function mirror(id) {
    const s = {meet: cutMeet, elderTask: cutElderTask, freed: cutFreed, return: cutReturn, opened: cutOpened, bear: cutBear, page: cutPage}[id];
    if (s) G.cine(id, s);
  }
  return {talk, interact, trigger, plates, enemyDied, mirror};
}

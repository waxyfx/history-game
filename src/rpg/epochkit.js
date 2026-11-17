// Shared building blocks for the late epochs (MAP07–MAP10): indexes into a generated map, scoring, the level
// descriptor and the helpers every quest uses. MAP01–MAP06 keep their own copies (they predate this file).
import {A, TS, IT} from './quest.js';
import {SHEETS} from './gen/atlas.js';
import {makePersistence} from './persistence.js';
import {anomaly} from './anomalies.js';

export const P = (x, y) => [Math.round(x * TS), Math.round(y * TS)];
export const sheetIndex = name => Array.isArray(SHEETS) ? SHEETS.findIndex(s => (s.name || s) === name) : Object.keys(SHEETS).indexOf(name);

export function indexes(MAP) {
  const ix = list => Object.fromEntries(list.map((n, i) => [n, i]));
  return {IA: ix(MAP.interacts), NPC: ix(MAP.npcs), TRIG: ix(MAP.triggers), TAG: ix(MAP.tags)};
}

// Scoring: trial points (100 in all), pass mark 60; the page has PAGE_IDS lines (the main trials + the final one).
export function scoring(QUIZZES, SECRETS, PAGE_IDS) {
  const TRIAL_POINTS = Object.fromEntries(Object.values(QUIZZES).map(q => [q.id, q.points]));
  const QID = Object.fromEntries(Object.entries(QUIZZES).map(([n, q]) => [q.id, +n]));
  return {
    MAX_SCORE: 100, PASS_SCORE: 60, TRIAL_POINTS, QID, PAGE_TOTAL: PAGE_IDS.length,
    scoreOf: f => { let s = 0; for (const [id, r] of Object.entries(f.quiz)) if (r.ok) s += TRIAL_POINTS[id] || 0; return Math.min(100, s); },
    pageLines: f => PAGE_IDS.filter(id => f.quiz[id]?.ok).length,
    secretsFound: f => SECRETS.filter(s => f.b[s]).length,
  };
}

// The level descriptor main.js binds (same shape as level5.js / level6.js).
export function levelDescriptor({id, title, MAP, S, Q, enemies, comic, back, UI, music, ambience, items, sfx, next}) {
  const SAVE_WORDS = 24 + 25 + enemies * 2 + 8;
  const persistence = makePersistence({
    quizIds: Object.values(S.HISTORICAL_QUIZZES).map(q => q.id),
    sets: {talked: S.TALKERS, tracks: Object.values(S.PROOFS), petro: []},
    grants: ['kit', 'page', ...(S.GRANTS || [])], words: [SAVE_WORDS]});
  return {
    SAVE_WORDS, persistence,
    level: {
      id, title, wasm: `/engine/rpg/tarikh-rpg-${id}.wasm`, saveKey: `tarikh.rpg.v3.L${id}`, MAP, requires: id - 1,
      SPEAKERS: S.SPEAKERS, ZONE_NAMES: S.ZONE_NAMES, QUESTS: S.QUESTS, HISTORICAL_QUIZZES: S.HISTORICAL_QUIZZES, BONUS_QUIZ: S.BONUS_QUIZ,
      BONUS_META: S.BONUS_META, CHAMBER_FAIL: S.CHAMBER_FAIL, TRIAL_LEVELS: S.TRIAL_LEVELS, MAIN_QUIZ_ORDER: S.MAIN_QUIZ_ORDER,
      SECRETS: S.SECRETS, DIALOGUES: S.DIALOGUES, NAMES: S.NAMES, LABELS: S.LABELS,
      applyWorld: Q.applyWorld, createQuest: Q.createQuest, questStage: Q.questStage, questTarget: Q.questTarget,
      scoreOf: Q.scoreOf, secretsFound: Q.secretsFound, pageLines: Q.pageLines, pageTotal: Q.PAGE_TOTAL, restoreSnapshot: persistence.restoreSnapshot,
      begin: quest => quest.start(), comic, back, UI, music, ambience, items, sfx,
      ...(next ? {next: next.id, passLabel: next.label} : {passLabel: {kk: 'Дәуірлер картасы', ru: 'Карта эпох'}}),
    },
  };
}
export const STORY_DEFAULTS = {MAIN_QUIZ_ORDER: [1, 2, 3, 4, 5, 6, 7, 8], TRIAL_LEVELS: ['', 'Бақылау', 'Түсіну', 'Талдау', 'Қайта құру', 'Сыни ойлау'],
  BONUS_META: [], BONUS_QUIZ: {id: 'none', title: {kk: ''}, questions: []}, CHAMBER_FAIL: []};

// Quest helpers bound to the running game.
export function kit(G, MAP, {ARTIFACTS = [], D = {}} = {}) {
  const {E} = G, {IA, NPC, TAG} = indexes(MAP);
  const b = () => G.flags.b;
  const ru = () => G.lang?.() === 'ru';
  const K = {
    E, IA, NPC, TAG, b, ru,
    set: k => { if (!G.flags.b[k]) { G.flags.b[k] = true; G.changed(); G.applyWorld?.(); } },
    addTo: (k, v) => { if (!G.flags[k].includes(v)) { G.flags[k] = [...G.flags[k], v]; G.changed(); G.applyWorld?.(); return true; } return false; },
    pos: key => MAP.interactPos[key],
    npcAt: (key, x, y, facing = 4, anim = A.idle) => E.tj_npc_set(NPC[key], ...P(x, y), facing, anim, 1),
    npcGo: (key, x, y, run = 0, anim = A.idle) => E.tj_npc_goto(NPC[key], ...P(x, y), run, anim),
    hide: key => E.tj_npc_flags(NPC[key], 0, 0, 1),
    show: key => E.tj_npc_flags(NPC[key], 0, 0, 0),
    toast: (kk, ru_, kind = 'good') => G.toast?.(ru() ? ru_ : kk, kind),
    artifact(flag) {
      if (b()[flag]) return false;
      K.set(flag); const a = ARTIFACTS.find(x => x.flag === flag);
      if (a) G.toast?.(`${ru() ? 'Артефакт' : 'Артефакт'}: ${a[ru() ? 'ru' : 'kk']}`, 'good');
      return true;
    },
    async secret(key, lines, fact) { if (!b()[key]) { K.set(key); G.sfx('secret'); } return G.say(lines, fact); },
    anomaly: id => anomaly(G, id),
    grant(key, cond, fn) { if (cond && !G.local.granted.includes(key)) { G.local.granted.push(key); fn(); } },
    D,
  };
  return K;
}

// Weapon setup for an epoch (re-applied after every load): tunes = [[slot, dmg, windup, recovery, range, width], ...].
export function arm(E, {tunes = [], lance = 0, sabre = 0, bullets = 0, burst = 0, hero = 'aibar'} = {}) {
  for (let w = 0; w < 3; w++) E.tj_weapon_tune(w, 0, 0, 0, 0, 0);
  for (const t of tunes) E.tj_weapon_tune(...t);
  E.tj_lance(lance ? 1 : 0); E.tj_sabre(sabre ? 1 : 0); E.tj_bullets(bullets ? 1 : 0); E.tj_burst(burst || 0);
  const s = sheetIndex(hero); if (s >= 0) E.tj_hero(s);
}

// A training target is hit by a fresh melee strike started near it. Returns a per-frame watcher.
export function makeStrikeWatch(E) {
  // The sabre series mirrors the engine's rule: a cut within 48 ticks of the last one extends it; the third finishes it.
  const F = {att: 0, mov: 0, combo: 0, last: -999};
  return function watch(G, {weapon, targets, near = 56, need = 'any', onHit, onMiss}) {
    const att = E.tj_state(15), [hx, hy] = G.heroPos(), tick = E.tj_state(10);
    if (att && !F.att && E.tj_state(13) === weapon) {
      let finisher = false;
      if (weapon === 0) { F.combo = tick - F.last < 48 ? F.combo + 1 : 1; F.last = tick; if (F.combo >= 3) { F.combo = 0; finisher = true; } }
      const t = targets.find(t => Math.hypot(hx - t.x, hy - t.y) < near);
      if (t) {
        const ok = need === 'any' || (need === 'run' && E.tj_state(34) && F.mov) || (need === 'combo' && finisher);
        if (ok) onHit(t); else onMiss?.(t);
      }
    }
    F.mov = !att && E.tj_state(33) && E.tj_state(34); F.att = att;
  };
}
export {A, TS, IT};

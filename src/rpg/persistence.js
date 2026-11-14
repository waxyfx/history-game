import { HISTORICAL_QUIZZES } from './story.js';

// Save envelope v3: {v:3, words:[uint32...], flags, local}, one schema per epoch.
// Everything is validated BEFORE touching WASM memory or live game state; the native save
// buffer has 96 words, so never size a view from unchecked input. Scores are not stored:
// they are derived from validated trial flags, which prevents forged or duplicated totals.
const invalid = () => { throw new Error('Invalid RPG save'); };
const isTime = v => Number.isFinite(v) && v >= 0 && v < 1e14;

/** schema: {quizIds, sets: {talked, tracks, petro}, grants, words: [allowed word counts]} */
export function makePersistence(schema) {
  const quizIds = new Set(schema.quizIds), SETS = schema.sets, GRANTS = new Set(schema.grants), WORDS = new Set(schema.words);
  function validateFlags(f) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) invalid();
    if (!f.b || typeof f.b !== 'object' || Array.isArray(f.b) || Object.keys(f.b).length > 64) invalid();
    for (const [k, v] of Object.entries(f.b)) if (!/^[a-zA-Z][a-zA-Z0-9]{0,23}$/.test(k) || typeof v !== 'boolean') invalid();
    for (const [k, allowed] of Object.entries(SETS)) {
      const list = f[k] ?? [];
      if (!Array.isArray(list) || list.length > allowed.length || new Set(list).size !== list.length || list.some(v => !allowed.includes(v))) invalid();
    }
    if (!f.quiz || typeof f.quiz !== 'object' || Array.isArray(f.quiz)) invalid();
    for (const [id, r] of Object.entries(f.quiz)) {
      if (!quizIds.has(id) || !r || !Number.isSafeInteger(r.a) || r.a < 1 || r.a > 99 || !isTime(r.t)) invalid();
      if ((r.ok != null && typeof r.ok !== 'boolean') || (r.ch != null && (!Number.isSafeInteger(r.ch) || r.ch < 0 || r.ch > 9))) invalid();
    }
    if (f.bonus != null && (!Number.isSafeInteger(f.bonus.correct) || f.bonus.correct < 0 || f.bonus.correct > 5 || !isTime(f.bonus.t))) invalid();
    if (!isTime(f.t0 ?? 0) || !isTime(f.tEnd ?? 0)) invalid();
    return {b: {...f.b}, talked: [...(f.talked || [])], tracks: [...(f.tracks || [])], petro: [...(f.petro || [])],
      quiz: Object.fromEntries(Object.entries(f.quiz).map(([k, r]) => [k, {a: r.a, t: r.t, by: Number.isSafeInteger(r.by) ? r.by : 0, ok: r.ok === true, ch: Number.isSafeInteger(r.ch) ? r.ch : null}])),
      bonus: f.bonus ? {correct: f.bonus.correct, t: f.bonus.t, by: Number.isSafeInteger(f.bonus.by) ? f.bonus.by : 0} : null, t0: f.t0 || 0, tEnd: f.tEnd || 0};
  }
  function validateLocal(l) {
    const local = {granted: [], attempts: {}, seen: [], crystal: 0};
    if (l == null) return local;
    if (typeof l !== 'object' || Array.isArray(l)) invalid();
    if (l.granted != null) { if (!Array.isArray(l.granted) || l.granted.some(g => !GRANTS.has(g))) invalid(); local.granted = [...new Set(l.granted)]; }
    if (l.seen != null) { if (!Array.isArray(l.seen) || l.seen.length > 48 || l.seen.some(s => typeof s !== 'string' || s.length > 24)) invalid(); local.seen = [...new Set(l.seen)]; }
    if (l.attempts != null) {
      if (typeof l.attempts !== 'object' || Array.isArray(l.attempts)) invalid();
      for (const [id, n] of Object.entries(l.attempts)) { if (!quizIds.has(id) || !Number.isSafeInteger(n) || n < 1 || n > 99) invalid(); local.attempts[id] = n; }
    }
    local.crystal = l.crystal ? 1 : 0;
    return local;
  }
  function validateSnapshot(data) {
    if (!data || data.v !== 3 || !Array.isArray(data.words) || !WORDS.has(data.words.length)) invalid();
    if (!data.words.every(w => Number.isInteger(w) && w >= 0 && w <= 0xffffffff)) invalid();
    return {words: data.words, flags: validateFlags(data.flags), local: validateLocal(data.local)};
  }
  function restoreSnapshot(engine, raw) {
    if (typeof raw !== 'string' || raw.length > 32768) invalid();
    const data = validateSnapshot(JSON.parse(raw));
    new Uint32Array(engine.memory.buffer, engine.tj_save_buffer(), data.words.length).set(data.words);
    const result = engine.tj_load(data.words.length * 4);
    if (result === -2) { const e = new Error('Old RPG save'); e.old = true; throw e; }
    if (result < 1) invalid();
    return data;
  }
  return {validateFlags, validateLocal, validateSnapshot, restoreSnapshot};
}

// MAP01: 73 words now (25 items + 4 effect slots). Earlier layouts stay loadable: 59 words (19 items,
// MAP02 release) and 54 words (14 items, first MAP01 release).
export const SAVE_WORDS = 73, PREV_SAVE_WORDS = 59, LEGACY_SAVE_WORDS = 54;
const map01 = makePersistence({
  quizIds: [...Object.values(HISTORICAL_QUIZZES).map(q => q.id), 'stone_bonus_1', 'stone_bonus_2', 'stone_bonus_3', 'stone_bonus_4', 'stone_bonus_5'],
  sets: {talked: ['crafter', 'cook', 'scraper', 'child'], tracks: [1, 2, 3, 4], petro: [1, 2, 3, 4]},
  grants: ['bow', 'spear', 'torch', 'page'], words: [SAVE_WORDS, PREV_SAVE_WORDS, LEGACY_SAVE_WORDS]});
export const {validateFlags, validateLocal, validateSnapshot, restoreSnapshot} = map01;

import { HISTORICAL_QUIZZES } from './story.js';

// MAP01 save envelope v3: {v:3, words:[54 uint32], flags, local}.
// Everything is validated BEFORE touching WASM memory or live game state; the native save
// buffer has 96 words, so never size a view from unchecked input. Scores are not stored:
// they are derived from validated quiz/secret flags, which prevents forged or duplicated totals.
export const SAVE_WORDS = 54;
const quizIds = new Set([...Object.values(HISTORICAL_QUIZZES).map(q => q.id), 'stone_bonus_1', 'stone_bonus_2', 'stone_bonus_3', 'stone_bonus_4', 'stone_bonus_5']);
const SETS = {talked: ['crafter', 'cook', 'scraper', 'child'], tracks: [1, 2, 3, 4], petro: [1, 2, 3, 4]};
const GRANTS = new Set(['bow', 'spear', 'torch', 'page']);
const invalid = () => { throw new Error('Invalid RPG save'); };
const isTime = v => Number.isFinite(v) && v >= 0 && v < 1e14;

export function validateFlags(f) {
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
export function validateLocal(l) {
  const local = {granted: [], attempts: {}, seen: [], crystal: 0};
  if (l == null) return local;
  if (typeof l !== 'object' || Array.isArray(l)) invalid();
  if (l.granted != null) { if (!Array.isArray(l.granted) || l.granted.some(g => !GRANTS.has(g))) invalid(); local.granted = [...new Set(l.granted)]; }
  if (l.seen != null) { if (!Array.isArray(l.seen) || l.seen.length > 32 || l.seen.some(s => typeof s !== 'string' || s.length > 24)) invalid(); local.seen = [...new Set(l.seen)]; }
  if (l.attempts != null) {
    if (typeof l.attempts !== 'object' || Array.isArray(l.attempts)) invalid();
    for (const [id, n] of Object.entries(l.attempts)) { if (!quizIds.has(id) || !Number.isSafeInteger(n) || n < 1 || n > 99) invalid(); local.attempts[id] = n; }
  }
  local.crystal = l.crystal ? 1 : 0;
  return local;
}
export function validateSnapshot(data) {
  if (!data || data.v !== 3 || !Array.isArray(data.words) || data.words.length !== SAVE_WORDS) invalid();
  if (!data.words.every(w => Number.isInteger(w) && w >= 0 && w <= 0xffffffff)) invalid();
  return {words: data.words, flags: validateFlags(data.flags), local: validateLocal(data.local)};
}
export function restoreSnapshot(engine, raw) {
  if (typeof raw !== 'string' || raw.length > 32768) invalid();
  const data = validateSnapshot(JSON.parse(raw));
  new Uint32Array(engine.memory.buffer, engine.tj_save_buffer(), data.words.length).set(data.words);
  const result = engine.tj_load(data.words.length * 4);
  if (result === -2) { const e = new Error('Old RPG save'); e.old = true; throw e; }
  if (result < 1) invalid();
  return data;
}

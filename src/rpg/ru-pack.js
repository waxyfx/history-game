// Russian for content first written only in Kazakh (MAP01–MAP04 dialogue, zones, names, quests; the trials of all ten
// maps). The packs live in src/rpg/ru/mapNN.js; this merges one into a level's story module at load time, so the
// Kazakh source stays untouched and every line still falls back to Kazakh when a translation is missing.
const isLine = v => v && typeof v === 'object' && 'who' in v && 'kk' in v;
function walkLines(v, fn) {
  if (Array.isArray(v)) v.forEach(x => walkLines(x, fn));
  else if (isLine(v)) fn(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(x => walkLines(x, fn));
}
const applied = new WeakSet();   // the story module namespace itself cannot take a flag
export function applyRu(S, pack) {
  if (!pack || applied.has(S.DIALOGUES)) return S;
  const lines = pack.lines || {};
  const fill = l => { if ((!l.ru || l.ru === l.kk) && lines[l.kk]) l.ru = lines[l.kk]; };
  walkLines(S.DIALOGUES, fill); walkLines(S.CHOICES || {}, fill);
  if (pack.zones && S.ZONE_NAMES?.ru) S.ZONE_NAMES.ru.splice(0, pack.zones.length, ...pack.zones);
  for (const [k, ru] of Object.entries(pack.names || {})) {
    const v = S.NAMES?.[k];
    if (typeof v === 'string') S.NAMES[k] = {kk: v, ru};
    else if (v && (!v.ru || v.ru === v.kk)) v.ru = ru;
  }
  for (const [k, ru] of Object.entries(pack.quests || {})) if (S.QUESTS?.[k] && !S.QUESTS[k].ru) S.QUESTS[k].ru = ru;
  for (const q of Object.values(S.HISTORICAL_QUIZZES || {})) {
    const t = pack.quizzes?.[q.id]; if (!t) continue;
    q.ru = {title: t.title, questTitle: t.questTitle, question: t.question, options: t.options, evidence: t.evidence, explanation: t.explanation, source: t.source};
    walkLines(q.intro, fill); walkLines(q.branch, fill);
    const pair = (list, ru) => (list || []).forEach((l, i) => { if (ru?.[i] && (!l.ru || l.ru === l.kk)) l.ru = ru[i]; });
    pair(q.intro, t.intro); pair(q.branch?.ok, t.ok); pair(q.branch?.no, t.no);
  }
  applied.add(S.DIALOGUES);
  return S;
}
// The trial as the player sees it in the current language (falls back to Kazakh field by field).
export function localQuiz(q, lang) {
  if (lang !== 'ru' || !q?.ru) return q;
  const r = q.ru;
  return {...q, title: r.title || q.title, questTitle: r.questTitle || q.questTitle, question: r.question || q.question,
    options: r.options?.length === q.options.length ? r.options : q.options, evidence: r.evidence || q.evidence,
    explanation: r.explanation || q.explanation, source: r.source || q.source};
}
export const TRIAL_LEVELS_RU = ['', 'Наблюдение', 'Понимание', 'Анализ', 'Реконструкция', 'Критическое мышление'];

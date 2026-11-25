// Production builds ship no trial answer keys (audit №14: «барлық correctIndex кілттері клиентте»).
// The story modules keep their keys in the source (tests, browser checks and the dev server use them); this Vite plugin
// removes every property that gives an answer away before the code reaches the bundle:
//   correctIndex (the right option), accepted (MAP01's old accepted answer), why (per-option notes whose empty slot
//   marks the right one); in MAP01's bonus questions: a (the right option) and w (the same notes).
// The server checks each choice instead (migration 021: level_submit_answer, trial_check).
// Explanations too (audit №14 follow-up: «Аң стилі…» named the right option of saka_gold): explanation in the story
// modules and in the Russian packs (src/rpg/ru/mapNN.js, JSON-style "explanation": keys), e in MAP01's bonus questions.
// The server gives each one out after the choice (migration 024: trial_explain).

// Removes `name: <value>,` for object properties, scanning the value with bracket and string awareness.
// The key may be quoted (`"explanation": …` in the JSON-style Russian packs).
export function removeProp(code, name, {from = 0} = {}) {
  const re = new RegExp(`(^|[\\s{,])(["']?)${name}\\2:\\s*`, 'g');
  let out = '', last = 0, m;
  re.lastIndex = from;
  while ((m = re.exec(code))) {
    const start = m.index + m[1].length;
    let i = re.lastIndex, depth = 0, quote = null;
    for (; i < code.length; i++) {
      const c = code[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
      if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
      if (c === '[' || c === '{' || c === '(') depth++;
      else if (c === ']' || c === '}' || c === ')') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) { i++; break; }
    }
    while (i < code.length && /[ \t]/.test(code[i])) i++;
    out += code.slice(last, start); last = i; re.lastIndex = i;
  }
  return out + code.slice(last);
}

export function stripKeys(code) {
  for (const name of ['correctIndex', 'accepted', 'why', 'explanation']) code = removeProp(code, name);
  const bonus = code.indexOf('export const BONUS_QUIZ');
  if (bonus >= 0) {
    let tail = code.slice(bonus);
    for (const name of ['a', 'w', 'e']) tail = removeProp(tail, name);
    code = code.slice(0, bonus) + tail;
  }
  return code;
}

export const STORY_FILE = /[\\/]src[\\/]rpg[\\/](story(\d\d)?|ru[\\/]map\d\d)\.js$/;
// src/content.js: the old 3D prototype's ten practice questions. The home page needs only the eras (title, period,
// symbol, colour, source); the questions and explanations are dead weight there, so a build drops them. The server's
// copy (migration 002) is written from the source file by scripts/content-build.mjs, which this plugin never touches.
export const CONTENT_FILE = /[\\/]src[\\/]content\.js$/;
export const stripLegacyQuestions = code => ['question', 'explanation'].reduce((c, name) => removeProp(c, name), code);
export function stripAnswerKeys() {
  return {
    name: 'strip-answer-keys',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (STORY_FILE.test(file)) return {code: stripKeys(code), map: null};
      if (CONTENT_FILE.test(file)) return {code: stripLegacyQuestions(code), map: null};
      return null;
    },
  };
}

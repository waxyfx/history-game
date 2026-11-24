// Production builds ship no trial answer keys (audit №14: «барлық correctIndex кілттері клиентте»).
// The story modules keep their keys in the source (tests, browser checks and the dev server use them); this Vite plugin
// removes every property that gives an answer away before the code reaches the bundle:
//   correctIndex (the right option), accepted (MAP01's old accepted answer), why (per-option notes whose empty slot
//   marks the right one); in MAP01's bonus questions: a (the right option) and w (the same notes).
// The server checks each choice instead (migration 021: level_submit_answer, trial_check).

// Removes `name: <value>,` for object properties, scanning the value with bracket and string awareness.
export function removeProp(code, name, {from = 0} = {}) {
  const re = new RegExp(`(^|[\\s{,])${name}:\\s*`, 'g');
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
  for (const name of ['correctIndex', 'accepted', 'why']) code = removeProp(code, name);
  const bonus = code.indexOf('export const BONUS_QUIZ');
  if (bonus >= 0) {
    let tail = code.slice(bonus);
    for (const name of ['a', 'w']) tail = removeProp(tail, name);
    code = code.slice(0, bonus) + tail;
  }
  return code;
}

export const STORY_FILE = /[\\/]src[\\/]rpg[\\/]story(\d\d)?\.js$/;
export function stripAnswerKeys() {
  return {
    name: 'strip-answer-keys',
    enforce: 'pre',
    transform(code, id) {
      if (!STORY_FILE.test(id.split('?')[0])) return null;
      return {code: stripKeys(code), map: null};
    },
  };
}

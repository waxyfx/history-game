// MAP08 · «Өрт / Пожар» — the third big motion-comic (same format and player as the game intro: src/intro).
// The catastrophe and the turning point (docs/story-canon.md 1.4): the fortress burns; Dana's paper notebook holds the
// first version of the Institute's report, and on the screen beside it the same line rewrites itself; 2087 — a hand with
// the Institute's wrist device slams the Gate console and the safety lock breaks; the binding is cut and pages fly like
// sparks. What is NOT shown: who tied the eleventh stitch, who the second Aidar is.
export const CAST = {
 hero: {kk: 'Айдар', ru: 'Айдар'},
 dana: {kk: 'Дана', ru: 'Дана'},
 sys: {kk: 'ЖҮЙЕ', ru: 'СИСТЕМА'},
};

const VO = (at, end, kk, ru) => ({at, end, kind: 'caption', p: [50, 84], w: 64, kk, ru});

export const SHOTS = [
 // ── 1. ӨРТ / ПОЖАР ────────────────────────────────────────────────
 {id: 'fort', scene: 1, dur: 7, trans: 'black', lines: [], sfx: [[0, 'wind', 7], [1.4, 'sting'], [3, 'whoosh'], [5, 'whoosh']]},
 {id: 'notebook', scene: 1, dur: 9, trans: 'fade', lines: [
  VO(5.6, 8.6, '«Бірінші нұсқа. Мен оны қолмен жаздым.»', '«Первая версия. Я переписала её от руки.»'),
 ], sfx: [[1.2, 'swish'], [3.4, 'glass'], [4.6, 'dissolve']]},
 // ── 2. ҚОЛ / РУКА ─────────────────────────────────────────────────
 {id: 'console', scene: 2, dur: 7, trans: 'flash', lines: [], sfx: [[0, 'tunnel', 6], [2.6, 'heart'], [4.2, 'flashBoom'], [4.4, 'glass']]},
 {id: 'binding', scene: 2, dur: 8, trans: 'cut', lines: [], sfx: [[.8, 'stone'], [2, 'swish'], [2.4, 'swish'], [2.8, 'swish'], [6, 'dissolve']]},
 // ── 3. ІЗ / СЛЕД ──────────────────────────────────────────────────
 {id: 'palm', scene: 3, dur: 7, trans: 'fade', lines: [], sfx: [[.6, 'heart'], [1.6, 'heart'], [4.6, 'stone']]},
 {id: 'final', scene: 3, dur: 9, trans: 'black', lines: [
  VO(1.2, 4.4, '«Сен қорғаймын деп ойладың.»', '«Ты думал, что защищаешь.»'),
  VO(4.8, 8.4, '«Ал қолың — кесті.»', '«А рука — разрезала.»'),
 ]},
 {id: 'title', scene: 3, dur: 5, trans: 'black', lines: [
  {at: .4, end: 5, kind: 'title', p: [50, 46], kk: 'ӨРТ', ru: 'ӨРТ', subKk: 'MAP08 · Ресей империясы · 1838', subRu: 'MAP08 · Российская империя · 1838'},
 ], sfx: [[.2, 'flashBoom']]},
];

export const TOTAL = SHOTS.reduce((sum, s) => sum + s.dur, 0);
export const START = {};
let start = 0;
for (const shot of SHOTS) {
 shot.start = start; START[shot.id] = start;
 for (const line of shot.lines) {line.t0 = start + line.at; line.t1 = start + line.end; line.shot = shot.id;}
 shot.cues = (shot.sfx || []).map(([at, name, dur]) => ({t: start + at, name, dur}));
 start += shot.dur;
}
export const LINES = SHOTS.flatMap(s => s.lines);
LINES.forEach((line, i) => {line.id = `${line.shot}-${i}`;});
export const SCENE_TITLES = {1: {kk: 'Өрт', ru: 'Пожар'}, 2: {kk: 'Қол', ru: 'Рука'}, 3: {kk: 'Із', ru: 'След'}};

// Score: low brass-like drones and the crackle of the fire (taiko rolls); a single high bell for the notebook line,
// answered a semitone lower when the screen rewrites it; at the console the heartbeat stops the music.
export function score(I) {
 const ev = [], at = (t, fn) => ev.push({t, fn}), S = START;
 at(S.fort, w => I.pad(w, ['C2', 'G2', 'C3'], 16, {vol: .035, cut: 700, att: 2}));
 for (let b = 0; b < 12; b++) at(S.fort + .4 + b * .5, w => {I.taiko(w, b % 3 ? .12 : .22); if (b % 2) I.hat(w, .015);});
 at(S.notebook + 1, w => I.bell(w, 'G4', .05)); at(S.notebook + 3.4, w => I.bell(w, 'F#4', .05));
 at(S.notebook, w => I.kobyz(w, 'C3', 8, .025));
 at(S.console + 4.2, w => I.stab(w, ['C2', 'F#2'], .08));
 at(S.binding, w => I.pad(w, ['C2', 'Eb2', 'G2'], 8, {vol: .04, cut: 1100, att: .3}));
 at(S.final, w => I.pad(w, ['C2', 'G2', 'Eb3'], 13, {vol: .03, cut: 800, att: 2.5}));
 ['G3', 'F3', 'Eb3', 'D3', 'C3'].forEach((n, i) => at(S.final + 1.4 + i * 1.3, w => I.dombra(w, [n], .08)));
 return ev;
}

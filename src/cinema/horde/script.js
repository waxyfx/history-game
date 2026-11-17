// MAP06 · «Кітап / Книга» — motion-comic (same format and player as the game intro: src/intro).
// Plays when Aidar takes the sixth page. Images only, nothing is explained: the book; its pages are generations,
// the sixth grows out of the fifth like a branch; a record changes on the page; the spine with eleven stitches —
// the last one unlike the others, holding an empty page; two hands in the same ink in the margins; the question.
export const CAST = {
 hero: {kk: 'Айдар', ru: 'Айдар'},
 sys: {kk: 'ЖҮЙЕ', ru: 'СИСТЕМА'},
};

const VO = (at, end, kk, ru) => ({at, end, kind: 'caption', p: [50, 84], w: 64, kk, ru});

export const SHOTS = [
 // ── 1. КІТАП / КНИГА ──────────────────────────────────────────────
 {id: 'book', scene: 1, dur: 7, trans: 'black', lines: [], sfx: [[0, 'wind', 7], [2.4, 'stone'], [4.2, 'swish'], [5.2, 'swish']]},
 {id: 'pages', scene: 1, dur: 9, trans: 'fade', lines: [], sfx: [[.6, 'chime'], [2, 'chime'], [3.4, 'chime'], [6, 'heart'], [7, 'heart']]},
 // ── 2. ЖАЗБА / ЗАПИСЬ ─────────────────────────────────────────────
 {id: 'record', scene: 2, dur: 7, trans: 'cut', lines: [], sfx: [[1.6, 'glass'], [3.4, 'dissolve']]},
 {id: 'spine', scene: 2, dur: 9, trans: 'fade', lines: [], sfx: [...Array.from({length: 10}, (_, i) => [.6 + i * .42, 'steps']), [6, 'heart'], [7.2, 'sting']]},
 // ── 3. ЖИЕК / ПОЛЯ ────────────────────────────────────────────────
 {id: 'margins', scene: 3, dur: 7, trans: 'cut', lines: [], sfx: [[.4, 'swish'], [3.8, 'swish']]},
 {id: 'question', scene: 3, dur: 9, trans: 'black', lines: [
  VO(1.4, 4.6, '«Шежіре ұрпақтарды жазады.»', '«Шежіре записывает поколения.»'),
  VO(5, 8.6, '«Онда Айдардың өзін кім жазды?»', '«Тогда кто записал самого Айдара?»'),
 ], sfx: [[.6, 'stone'], [8.2, 'dissolve']]},
 {id: 'title', scene: 3, dur: 5, trans: 'black', lines: [
  {at: .4, end: 5, kind: 'title', p: [50, 46], kk: 'АЛТЫН ОРДА', ru: 'АЛТЫН ОРДА', subKk: 'MAP06 · Шежіренің 6-парағы', subRu: 'MAP06 · Шестая страница Шежіре'},
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
export const SCENE_TITLES = {1: {kk: 'Кітап', ru: 'Книга'}, 2: {kk: 'Жазба', ru: 'Запись'}, 3: {kk: 'Жиек', ru: 'Поля'}};

// Score: a warm low drone (the dombra's open fifth); six bell notes for six pages, the sixth a step higher;
// a kobyz under the changed record; eleven soft taps for the stitches, the eleventh late and lower; silence, the question.
export function score(I) {
 const ev = [], at = (t, fn) => ev.push({t, fn}), S = START;
 at(S.book, w => I.pad(w, ['D2', 'A2', 'D3'], 16, {vol: .03, cut: 600, att: 3}));
 ['D4', 'E4', 'F4', 'G4', 'A4', 'C5'].forEach((n, i) => at(S.pages + .6 + i * 1.05, w => I.bell(w, n, .05)));
 at(S.record, w => I.kobyz(w, 'A2', 7, .03));
 at(S.record + 1.6, w => I.stab(w, ['D2', 'Ab2'], .06));
 for (let k = 0; k < 10; k++) at(S.spine + .6 + k * .42, w => I.hat(w, .03));
 at(S.spine + 7.2, w => {I.taiko(w, .28); I.bell(w, 'D3', .05);});
 at(S.margins, w => I.pad(w, ['D2', 'F2', 'A2'], 7, {vol: .03, cut: 900, att: 1}));
 ['A3', 'G3', 'F3', 'E3', 'D3'].forEach((n, i) => at(S.question + 1.2 + i * 1.3, w => I.dombra(w, [n], .08)));
 at(S.title, w => I.pad(w, ['D2', 'A2', 'F3'], 5, {vol: .04, cut: 1200, att: .3}));
 return ev;
}

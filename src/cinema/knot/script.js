// MAP04 · «Түйінші» — motion-comic (same format and player as the game intro: src/intro).
// Timings are shot-local seconds; the converter below makes them absolute. kk + ru on every line.
// The scene raises questions only: who the knot-keeper is, why «not this time», whose handwriting, why eleven.

export const CAST = {
 hero: {kk: 'Айдар', ru: 'Айдар'},
 knot: {kk: '???', ru: '???'},
 sys: {kk: 'ЖҮЙЕ', ru: 'СИСТЕМА'},
};

const K = (at, end, p, tip, kk, ru, w = 30) => ({at, end, kind: 'speech', who: 'knot', p, tip, w, kk, ru});
const A = (at, end, p, tip, kk, ru, w = 26, kind = 'speech') => ({at, end, kind, who: 'hero', p, tip, w, kk, ru});
const VO = (at, end, kk, ru) => ({at, end, kind: 'caption', p: [50, 84], w: 60, kk, ru});

export const SHOTS = [
 // ── 1. ІЗ / СЛЕД ─────────────────────────────────────────────────────
 {id: 'night', scene: 1, dur: 9, trans: 'black', lines: [], sfx: [[0, 'wind', 38]]},
 {id: 'tally', scene: 1, dur: 9, trans: 'fade', lines: [], sfx: [[4.4, 'chime'], [6.5, 'stone']]},
 {id: 'tracks', scene: 1, dur: 9, trans: 'cut', lines: [], sfx: [[.4, 'steps'], [4.6, 'whoosh'], [6.2, 'heart'], [7.3, 'heart']]},
 // ── 2. ТҮЙІНШІ ──────────────────────────────────────────────────────
 {id: 'reveal', scene: 2, dur: 11, trans: 'fade', lines: [], sfx: [[2.8, 'sting'], [8.6, 'heart']]},
 {id: 'meet', scene: 2, dur: 11, trans: 'cut', lines: [
  K(1, 4.6, [74, 13], [70, 31], 'Сен тағы да тым ерте келдің.', 'Ты опять пришёл слишком рано.', 26),
  A(5.4, 7.6, [24, 15], [31, 35], 'Біз таныспыз ба?', 'Мы знакомы?'),
  K(8.4, 10.9, [74, 13], [70, 31], 'Бұл жолы — жоқ.', 'Не в этот раз.', 20),
 ]},
 {id: 'eye', scene: 2, dur: 4, trans: 'cut', lines: [], sfx: [[.2, 'heart'], [1.3, 'heart']]},
 {id: 'montage', scene: 2, dur: 6, trans: 'flash', lines: [], sfx: [[0, 'tunnel', 5.8], ...Array.from({length: 8}, (_, i) => [.1 + i * .7, 'swish']), [5.7, 'glass']]},
 {id: 'who', scene: 2, dur: 10, trans: 'fade', lines: [
  A(.5, 2.6, [22, 14], [29, 38], 'Сен кімсің?', 'Кто ты?'),
  K(3.1, 6.2, [76, 12], [67, 29], 'Бұл сұрақты бұрын қойған адам.', 'Тот, кто уже задавал этот вопрос.', 26),
  A(6.6, 7.9, [22, 14], [29, 38], 'Қашан?', 'Когда?', 16),
  K(8.3, 9.95, [76, 12], [67, 29], 'Сен есіңе түсіре алмайсың.', 'Ты не помнишь.', 24),
 ]},
 // ── 3. ОН БІРІНШІ ТҮЙІН / ОДИННАДЦАТЫЙ УЗЕЛ ─────────────────────────
 {id: 'stone', scene: 3, dur: 11, trans: 'cut', lines: [
  K(3.4, 7.2, [70, 12], [62, 30], 'Зұлматпен кездескенде — оның айтқанын тыңдама.', 'Когда встретишь Зулмата — не слушай то, что он скажет.', 30),
  K(8.2, 10.9, [70, 12], [62, 30], 'Оның үндемей қалғанын тыңда.', 'Слушай то, о чём он промолчит.', 26),
 ], sfx: [[1.6, 'stone'], [2.2, 'chime']]},
 {id: 'vanish', scene: 3, dur: 7, trans: 'cut', lines: [
  A(.4, 2.4, [28, 14], [36, 34], 'Тоқта!', 'Подожди!', 18, 'shout'),
 ], sfx: [[.6, 'whoosh'], [1.8, 'steps'], [3.2, 'dissolve']]},
 {id: 'wall', scene: 3, dur: 9, trans: 'fade', lines: [
  {at: 5.6, end: 8.9, kind: 'caption', p: [26, 82], w: 36, kk: 'Бұл — Айдардың қолтаңбасы.', ru: 'Это почерк Айдара.'},
 ], sfx: [[.8, 'chime'], [2.6, 'zaps', 1.8], [3, 'glass'], [4.4, 'heart']]},
 {id: 'zulmat', scene: 3, dur: 2.5, trans: 'cut', lines: [], sfx: [[0, 'sting']]},
 {id: 'final', scene: 3, dur: 11, trans: 'black', lines: [
  VO(2.2, 5.9, '«Тарих бәрін есте сақтамайды.»', '«История помнит не всё.»'),
  VO(6.6, 10.8, '«Кейде ол тек қараған адамды ғана есте сақтайды.»', '«Иногда она помнит только того, кто смотрел.»'),
 ]},
 {id: 'title', scene: 3, dur: 5, trans: 'black', lines: [
  {at: .4, end: 5, kind: 'title', p: [50, 46], kk: 'ЖОҒАЛҒАН ШЕЖІРЕ', ru: 'ЖОҒАЛҒАН ШЕЖІРЕ', subKk: 'MAP04 · Ғұндар дәуірі', subRu: 'MAP04 · Эпоха гуннов'},
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
export const SCENE_TITLES = {1: {kk: 'Із', ru: 'След'}, 2: {kk: 'Түйінші', ru: 'Түйінші'}, 3: {kk: 'Он бірінші түйін', ru: 'Одиннадцатый узел'}};

// Score: low drones of the night steppe; a three-note bronze bell = the knot-keeper's motif; kobyz under the
// dialogue; taiko under the montage; one soft dombra phrase at the end.
export function score(I) {
 const ev = [], at = (t, fn) => ev.push({t, fn}), S = START;
 at(S.night, w => I.pad(w, ['D2', 'A2', 'D3'], 26, {vol: .03, cut: 500, att: 4}));
 at(S.tracks + 5, w => I.pad(w, ['C2', 'G2', 'Eb3'], 12, {vol: .035, cut: 600, att: 2}));
 const motif = ['A4', 'E5', 'D5'];
 for (const t0 of [S.tally + 4.5, S.reveal + 7.5, S.stone + 1.8, S.final + 1])
  motif.forEach((n, i) => at(t0 + i * .5, w => I.bell(w, n, .05)));
 at(S.meet, w => I.kobyz(w, 'D3', 11, .035));
 at(S.who, w => {I.kobyz(w, 'A2', 10, .035); I.pad(w, ['D3', 'F3', 'A3'], 10, {vol: .025, cut: 800, att: 1.5});});
 for (let b = 0; b < 12; b++) at(S.montage + b * .5, w => {I.taiko(w, b % 4 ? .18 : .32); if (b % 2) I.hat(w, .02);});
 at(S.montage, w => I.pad(w, ['D2', 'Ab2', 'D3'], 6, {vol: .05, cut: 1600, att: .1}));
 at(S.stone, w => I.pad(w, ['F2', 'C3', 'A3'], 11, {vol: .03, cut: 900, att: 2}));
 at(S.vanish, w => {I.stab(w, ['D3', 'Ab3'], .08); I.taiko(w, .3);});
 at(S.wall, w => I.pad(w, ['Bb1', 'F2', 'E3'], 9, {vol: .04, cut: 700, att: 1}));
 at(S.final, w => I.pad(w, ['D2', 'A2', 'E3', 'F#3'], 16, {vol: .035, cut: 900, att: 3}));
 ['D4', 'F#4', 'A4', 'G4', 'F#4', 'E4', 'D4'].forEach((n, i) => at(S.final + 4 + i * .9, w => I.dombra(w, [n], .1)));
 return ev;
}

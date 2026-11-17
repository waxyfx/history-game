// MAP10 · «Он бірінші тігіс / Одиннадцатый стежок» — the fourth big motion-comic, the finale (format of src/intro).
// The canon sequence (docs/story-canon.md 1.3) after the fight has stripped Aidar to his sword: the wound and the lost eye;
// he falls; Түйінші appears; the reveal — he is the future Aidar; he passes on experience, strength and memories; the two
// merge; the fire in the empty socket. Order is fixed by the author; nothing here changes it.
export const CAST = {
 hero: {kk: 'Айдар', ru: 'Айдар'},
 knot: {kk: 'Түйінші', ru: 'Түйінші'},
 sys: {kk: 'ЖҮЙЕ', ru: 'СИСТЕМА'},
};

const VO = (at, end, kk, ru, who) => ({at, end, kind: 'caption', p: [50, 84], w: 64, kk, ru, ...(who ? {who} : {})});

export const SHOTS = [
 // ── 1. ЖАРА / РАНА ────────────────────────────────────────────────
 {id: 'wound', scene: 1, dur: 6, trans: 'black', lines: [], sfx: [[.4, 'heart'], [2.2, 'swish'], [2.5, 'glass'], [2.6, 'flashBoom']]},
 {id: 'fall', scene: 1, dur: 7, trans: 'fade', lines: [
  VO(3.6, 6.6, '«Мен кіммін?»', '«Кто я?»', 'hero'),
 ], sfx: [[.6, 'stone'], [2.4, 'heart'], [4, 'heart']]},
 // ── 2. ТҮЙІНШІ ────────────────────────────────────────────────────
 {id: 'arrive', scene: 2, dur: 8, trans: 'fade', lines: [], sfx: [[.4, 'steps'], [1.6, 'steps'], [2.8, 'steps'], [5.4, 'chime']]},
 {id: 'reveal', scene: 2, dur: 10, trans: 'cut', lines: [
  VO(.8, 3.6, '«Сен үшінші сұрақты қойдың. Енді жауап беруге болады.»', '«Ты задал третий вопрос. Теперь на него можно ответить.»', 'knot'),
  VO(4.6, 7.2, '«Мен — сенмін. Сенің болашағыңмын.»', '«Я — это ты. Твоё будущее.»', 'knot'),
  VO(7.6, 9.8, '«Мен он бірінші тігісті байладым. Енді оны саған беремін.»', '«Я завязал одиннадцатый стежок. Теперь я отдаю его тебе.»', 'knot'),
 ], sfx: [[4.2, 'heart'], [7.4, 'chime']]},
 // ── 3. ТІГІС / СТЕЖОК ─────────────────────────────────────────────
 {id: 'transfer', scene: 3, dur: 8, trans: 'cut', lines: [], sfx: [[.6, 'tunnel', 7], ...Array.from({length: 10}, (_, i) => [2 + i * .45, 'swish'])]},
 {id: 'merge', scene: 3, dur: 7, trans: 'flash', lines: [], sfx: [[1.2, 'whoosh'], [4.6, 'flashBoom']]},
 {id: 'fire', scene: 3, dur: 9, trans: 'cut', lines: [
  VO(4.2, 8.6, '«Тарих қараған адамды есте сақтайды.»', '«История помнит того, кто смотрел.»'),
 ], sfx: [[1.8, 'sting'], [2, 'flashBoom']]},
 {id: 'title', scene: 3, dur: 6, trans: 'black', lines: [
  {at: .4, end: 6, kind: 'title', p: [50, 46], kk: 'ОН БІРІНШІ ТІГІС', ru: 'ОН БІРІНШІ ТІГІС', subKk: 'MAP10 · Тәуелсіз Қазақстан · 2087', subRu: 'MAP10 · Независимый Казахстан · 2087'},
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
export const SCENE_TITLES = {1: {kk: 'Жара', ru: 'Рана'}, 2: {kk: 'Түйінші', ru: 'Түйінші'}, 3: {kk: 'Тігіс', ru: 'Стежок'}};

// Score: silence and a heartbeat for the wound; for Түйінші the two-note motif of MAP05 (E4 → C4), this time not echoed
// but answered — the future answers the present; for the merging all the motifs of the epochs at once; for the fire a
// single held chord in D (the book's key from MAP06) rising to A.
export function score(I) {
 const ev = [], at = (t, fn) => ev.push({t, fn}), S = START;
 at(S.fall, w => I.pad(w, ['D2', 'A2'], 7, {vol: .025, cut: 400, att: 2}));
 at(S.arrive + 1, w => I.kobyz(w, 'D3', 9, .03));
 for (const t0 of [S.arrive + 5.4, S.reveal + 4.6]) {at(t0, w => I.bell(w, 'E4', .05)); at(t0 + .55, w => I.bell(w, 'C4', .05)); at(t0 + 1.4, w => I.bell(w, 'G4', .045));}
 at(S.reveal, w => I.pad(w, ['C2', 'G2', 'E3'], 10, {vol: .03, cut: 900, att: 2}));
 ['D4', 'E4', 'F4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'].forEach((n, i) => at(S.transfer + 2 + i * .45, w => I.bell(w, n, .04)));
 for (let b = 0; b < 8; b++) at(S.merge + b * .5, w => {I.taiko(w, b % 4 ? .14 : .28); if (b % 2) I.hat(w, .02);});
 at(S.fire, w => I.pad(w, ['D2', 'A2', 'F#3', 'A3'], 15, {vol: .045, cut: 1600, att: 1.2}));
 ['A3', 'D4', 'F#4', 'A4'].forEach((n, i) => at(S.fire + 4.2 + i * 1.1, w => I.dombra(w, [n], .09)));
 return ev;
}

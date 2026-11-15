// MAP05 · «Көрініс / Видение» — motion-comic (same format and player as the game intro: src/intro).
// Plays when Aibar takes the fifth page. Images only, no explanation of their order:
// the runic stone, Zulmat, the second Aibar, the eleventh knot, the Gate of time, Aibar looking at the viewer.
export const CAST = {
 hero: {kk: 'Айбар', ru: 'Айбар'},
 twin: {kk: '???', ru: '???'},
 sys: {kk: 'ЖҮЙЕ', ru: 'СИСТЕМА'},
};

const VO = (at, end, kk, ru) => ({at, end, kind: 'caption', p: [50, 84], w: 60, kk, ru});

export const SHOTS = [
 // ── 1. ТАС / КАМЕНЬ ────────────────────────────────────────────────
 {id: 'stone', scene: 1, dur: 7, trans: 'black', lines: [], sfx: [[0, 'wind', 7], [3.2, 'chime'], [5.4, 'chime']]},
 {id: 'zulmat', scene: 1, dur: 4, trans: 'cut', lines: [], sfx: [[0, 'sting']]},
 // ── 2. БЕЙНЕ / ОТРАЖЕНИЕ ───────────────────────────────────────────
 {id: 'twin', scene: 2, dur: 7, trans: 'fade', lines: [], sfx: [[.4, 'steps'], [3.6, 'heart'], [4.6, 'heart']]},
 {id: 'knot', scene: 2, dur: 5, trans: 'cut', lines: [], sfx: [[1.2, 'stone'], [2.6, 'chime']]},
 {id: 'gate', scene: 2, dur: 6, trans: 'flash', lines: [], sfx: [[0, 'tunnel', 5.6], [4.8, 'whoosh']]},
 {id: 'montage', scene: 2, dur: 4, trans: 'flash', lines: [], sfx: [...Array.from({length: 6}, (_, i) => [.05 + i * .66, 'swish']), [3.8, 'glass']]},
 // ── 3. ҚАРАШ / ВЗГЛЯД ─────────────────────────────────────────────
 {id: 'look', scene: 3, dur: 7, trans: 'cut', lines: [], sfx: [[.6, 'heart'], [1.6, 'heart'], [6.4, 'dissolve']]},
 {id: 'final', scene: 3, dur: 8, trans: 'black', lines: [
  VO(1.4, 4.4, '«Жазылғанды өшіру мүмкін емес.»', '«Написанное не стереть.»'),
  VO(4.8, 7.8, '«Бірақ оны кім жазғанын ұмытуға болады.»', '«Но можно забыть, кто это написал.»'),
 ]},
 {id: 'title', scene: 3, dur: 5, trans: 'black', lines: [
  {at: .4, end: 5, kind: 'title', p: [50, 46], kk: 'ЖАДТЫҢ КӨЛЕҢКЕСІ', ru: 'ЖАДТЫҢ КӨЛЕҢКЕСІ', subKk: 'MAP05 · Түркі қағанаты', subRu: 'MAP05 · Тюркский каганат'},
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
export const SCENE_TITLES = {1: {kk: 'Тас', ru: 'Камень'}, 2: {kk: 'Бейне', ru: 'Отражение'}, 3: {kk: 'Қараш', ru: 'Взгляд'}};

// Score: a cold drone; a two-note motif (E4 → C4) that is always answered by its own echo a beat later,
// quieter — the music repeats itself the way the level does; taiko under the montage; silence for the look.
export function score(I) {
 const ev = [], at = (t, fn) => ev.push({t, fn}), S = START;
 at(S.stone, w => I.pad(w, ['E2', 'B2', 'E3'], 17, {vol: .03, cut: 500, att: 3}));
 for (const t0 of [S.stone + 2.6, S.twin + 2, S.knot + 1, S.final + 1]) {
  at(t0, w => I.bell(w, 'E4', .05)); at(t0 + .55, w => I.bell(w, 'C4', .05));
  at(t0 + 1.4, w => I.bell(w, 'E4', .022)); at(t0 + 1.95, w => I.bell(w, 'C4', .022));   // the echo
 }
 at(S.zulmat, w => I.stab(w, ['E2', 'Bb2'], .07));
 at(S.twin, w => I.kobyz(w, 'B2', 7, .03));
 at(S.gate, w => I.pad(w, ['E2', 'G#2', 'D3'], 6, {vol: .045, cut: 1400, att: .2}));
 for (let b = 0; b < 8; b++) at(S.montage + b * .5, w => {I.taiko(w, b % 4 ? .16 : .3); if (b % 2) I.hat(w, .02);});
 at(S.final, w => I.pad(w, ['C2', 'G2', 'E3'], 13, {vol: .03, cut: 800, att: 2.5}));
 ['E4', 'D4', 'C4', 'B3', 'C4'].forEach((n, i) => at(S.final + 3 + i * 1, w => I.dombra(w, [n], .09)));
 return ev;
}

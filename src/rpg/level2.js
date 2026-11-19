// MAP02 «Күлге көмілген шындық» bindings for the shared RPG runtime (same engine, same UI, own content).
import {MAP02} from './gen/map02.js';
import * as S from './story02.js';
import RU from './ru/map02.js';
import {applyRu} from './ru-pack.js';
applyRu(S, RU);   // Russian for the parts written only in Kazakh
import * as Q from './quest02.js';
import {makePersistence} from './persistence.js';
import {EGG_NAMES, EGG_LABELS} from './eggs.js';

// 24 header words + 25 items + 13 enemies × 2 + 4 effect slots × 2; 69-word saves (19 items, no effects) stay loadable.
export const SAVE_WORDS_L2 = 24 + 25 + 13 * 2 + 8, PREV_SAVE_WORDS_L2 = 24 + 19 + 13 * 2;
export const persistence = makePersistence({
  quizIds: Object.values(S.HISTORICAL_QUIZZES).map(q => q.id),
  sets: {talked: S.WITNESSES, tracks: Object.values(S.CLUES), petro: [1, 2, 3, 4]},
  grants: ['kit', 'bow', 'bowkit', 'bracelet', 'mould', 'seal', 'tablet', 'ember', 'page'], words: [SAVE_WORDS_L2, PREV_SAVE_WORDS_L2]});

const fireAt = (x, y, tx, ty) => Math.max(0, 1 - Math.hypot(x - tx * 16, y - ty * 16) / 150);
import {arsenal, FIRE, MELEE} from './weapons.js';
export default {
  id: 2, title: 'Күлге көмілген шындық', wasm: '/engine/rpg/tarikh-rpg-2.wasm', saveKey: 'tarikh.rpg.v3.L2', MAP: MAP02, requires: 1,
  // Bronze Age: the bow is the lesson here — hold to draw (a fuller draw flies farther and harder), aim with the arrows.
  arsenal: E => arsenal(E, {fire: FIRE.bow, blade: MELEE.institute, pole: MELEE.spear}),
  SPEAKERS: S.SPEAKERS, ZONE_NAMES: S.ZONE_NAMES, QUESTS: S.QUESTS, HISTORICAL_QUIZZES: S.HISTORICAL_QUIZZES, BONUS_QUIZ: S.BONUS_QUIZ,
  BONUS_META: S.BONUS_META, CHAMBER_FAIL: S.CHAMBER_FAIL, TRIAL_LEVELS: S.TRIAL_LEVELS, MAIN_QUIZ_ORDER: S.MAIN_QUIZ_ORDER,
  SECRETS: S.SECRETS, DIALOGUES: S.DIALOGUES, NAMES: {...S.NAMES, ...EGG_NAMES}, LABELS: {...S.LABELS, ...EGG_LABELS},
  applyWorld: Q.applyWorld, createQuest: Q.createQuest, questStage: Q.questStage, questTarget: Q.questTarget,
  scoreOf: Q.scoreOf, secretsFound: Q.secretsFound, pageLines: Q.pageLines, pageTotal: Q.PAGE_TOTAL, restoreSnapshot: persistence.restoreSnapshot,
  begin: quest => quest.start(),
  back: {label: {kk: 'Ауылға оралу', ru: 'Ауылға оралу'}, x: 51, y: 34},
  passLabel: {kk: 'Сақ дәуіріне өту →', ru: 'В эпоху саков →'}, next: 3,
  // Epoch weapon names (slot 1–3). Later maps rename the slots for their own arms (akinak, sabre…).
  UI: {weapon: {kk: ['Шоқпар', 'Найза', 'Садақ'], ru: ['Дубина', 'Копьё', 'Лук']}, 
    chapter: {kk: 'MAP 02 · ҚОЛА ДӘУІРІ'}, complete: {kk: 'MAP 02 АЯҚТАЛДЫ'}, completeSub: {kk: 'Шежіренің 2-парағы қалпына келді'},
    stay: {kk: 'Қола дәуірінде қалу'},
  },
  music: (z, f) => z === 8 ? 'cave' : z === 1 || z === 2 || z === 4 ? (f.b.rekindled ? 'village' : 'mystery') : z === 6 || z === 3 ? 'mystery' : z === 7 ? 'danger' : 'explore',
  ambience: (z, x, y, tile, f) => {
    const lit = f.b.rekindled ? 1 : 0;
    const fire = z === 8 ? fireAt(x, y, 44, 81) : lit * Math.max(fireAt(x, y, 51, 31.6), fireAt(x, y, 68, 26), fireAt(x, y, 80, 27), fireAt(x, y, 76, 36));
    let river = 0;
    for (let dx = -6; dx <= 6; dx++) { const t = tile(Math.floor(x / 16) + dx, Math.floor(y / 16)); if (t === 4 || t === 5) river = Math.max(river, 1 - Math.abs(dx) / 7); }
    return {wind: z === 8 ? 0 : .8, fire: Math.min(1, fire), river, cave: z === 8 ? 1 : 0, birds: lit && z !== 8 ? 1 : 0};
  },
};

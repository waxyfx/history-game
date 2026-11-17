// MAP05 «Жадтың көлеңкесі» bindings for the shared RPG runtime (same engine, same UI, own content).
import {MAP05} from './gen/map05.js';
import * as S from './story05.js';
import * as Q from './quest05.js';
import {makePersistence} from './persistence.js';

// 24 header words + 25 items + 12 enemies × 2 + 4 effect slots × 2.
export const SAVE_WORDS_L5 = 24 + 25 + 12 * 2 + 8;
export const persistence = makePersistence({
  quizIds: Object.values(S.HISTORICAL_QUIZZES).map(q => q.id),
  sets: {talked: S.TALKERS, tracks: Object.values(S.PROOFS), petro: []},
  grants: ['kit', 'page'], words: [SAVE_WORDS_L5]});

const near = (x, y, tx, ty, r = 150) => Math.max(0, 1 - Math.hypot(x - tx * 16, y - ty * 16) / r);
export default {
  id: 5, title: 'Жадтың көлеңкесі', wasm: '/engine/rpg/tarikh-rpg-5.wasm', saveKey: 'tarikh.rpg.v3.L5', MAP: MAP05, requires: 4,
  SPEAKERS: S.SPEAKERS, ZONE_NAMES: S.ZONE_NAMES, QUESTS: S.QUESTS, HISTORICAL_QUIZZES: S.HISTORICAL_QUIZZES, BONUS_QUIZ: S.BONUS_QUIZ,
  BONUS_META: S.BONUS_META, CHAMBER_FAIL: S.CHAMBER_FAIL, TRIAL_LEVELS: S.TRIAL_LEVELS, MAIN_QUIZ_ORDER: S.MAIN_QUIZ_ORDER,
  SECRETS: S.SECRETS, DIALOGUES: S.DIALOGUES, NAMES: S.NAMES, LABELS: S.LABELS,
  applyWorld: Q.applyWorld, createQuest: Q.createQuest, questStage: Q.questStage, questTarget: Q.questTarget,
  scoreOf: Q.scoreOf, secretsFound: Q.secretsFound, pageLines: Q.pageLines, pageTotal: Q.PAGE_TOTAL, restoreSnapshot: persistence.restoreSnapshot,
  begin: quest => quest.start(),
  // The vision (motion comic in the intro's format) after the fifth page.
  comic: async opts => (await import('../cinema/vision/index.js')).playVisionComic(opts),
  back: {label: {kk: 'Тұманды далаға оралу', ru: 'Вернуться в туманную степь'}, x: 40, y: 65},
  next: 6, passLabel: {kk: 'MAP06 · Алтын Орда', ru: 'MAP06 · Золотая Орда'},
  UI: {chapter: {kk: 'MAP 05 · ТҮРКІ ҚАҒАНАТЫ', ru: 'MAP 05 · ТЮРКСКИЙ КАГАНАТ'}, title: {kk: 'Жадтың көлеңкесі', ru: 'Тень памяти'},
    complete: {kk: 'MAP 05 АЯҚТАЛДЫ', ru: 'MAP 05 ЗАВЕРШЕНА'}, completeSub: {kk: 'Шежіренің 5-парағы қалпына келді', ru: 'Пятая страница Шежіре восстановлена'},
    stay: {kk: 'Түркі дәуірінде қалу', ru: 'Остаться в тюркской эпохе'}, nextOpened: {kk: 'MAP06 ашылды: Алтын Орда', ru: 'Открыта MAP06: Золотая Орда'}},
  music: (z, f) => z === 10 ? 'camp' : z >= 8 ? 'cave' : z === 1 || z === 3 ? 'village' : z === 4 || z === 5 || z === 7 || f?.b?.twin1 ? 'mystery' : 'steppe',
  ambience: (z, x, y, tile) => {
    let river = 0;
    for (let dx = -6; dx <= 6; dx++) { const t = tile(Math.floor(x / 16) + dx, Math.floor(y / 16)); if (t === 4 || t === 5) river = Math.max(river, (1 - Math.abs(dx) / 7) * .5); }
    return {wind: z >= 8 && z <= 9 ? 0 : .8, fire: z === 10 ? near(x, y, 89, 102) : Math.max(near(x, y, 18, 25), near(x, y, 88, 19.5)), river, cave: z === 8 || z === 9 ? 1 : 0, birds: 0};
  },
};

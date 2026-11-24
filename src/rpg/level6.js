// MAP06 «Алтын Орда» bindings for the shared RPG runtime (same engine, same UI, own content).
import {MAP06} from './gen/map06.js';
import * as S from './story06.js';
import RU from './ru/map06.js';
import {applyRu} from './ru-pack.js';
applyRu(S, RU);   // Russian for the parts written only in Kazakh
import * as Q from './quest06.js';
import {makePersistence} from './persistence.js';

// 24 header words + 25 items + 11 enemies × 2 + 4 effect slots × 2.
export const SAVE_WORDS_L6 = 24 + 25 + 11 * 2 + 8;
export const persistence = makePersistence({
  quizIds: Object.values(S.HISTORICAL_QUIZZES).map(q => q.id),
  sets: {talked: S.TALKERS, tracks: Object.values(S.PROOFS), petro: []},
  grants: ['kit', 'page'], words: [SAVE_WORDS_L6]});

const near = (x, y, tx, ty, r = 150) => Math.max(0, 1 - Math.hypot(x - tx * 16, y - ty * 16) / r);
export default {
  id: 6, title: 'Алтын Орда', wasm: '/engine/rpg/tarikh-rpg-6.wasm', saveKey: 'tarikh.rpg.v3.L6', MAP: MAP06, requires: 5,
  SPEAKERS: S.SPEAKERS, ZONE_NAMES: S.ZONE_NAMES, QUESTS: S.QUESTS, HISTORICAL_QUIZZES: S.HISTORICAL_QUIZZES, BONUS_QUIZ: S.BONUS_QUIZ,
  BONUS_META: S.BONUS_META, CHAMBER_FAIL: S.CHAMBER_FAIL, TRIAL_LEVELS: S.TRIAL_LEVELS, MAIN_QUIZ_ORDER: S.MAIN_QUIZ_ORDER,
  SECRETS: S.SECRETS, DIALOGUES: S.DIALOGUES, NAMES: S.NAMES, LABELS: S.LABELS,
  applyWorld: Q.applyWorld, createQuest: Q.createQuest, questStage: Q.questStage, questTarget: Q.questTarget,
  scoreOf: Q.scoreOf, secretsFound: Q.secretsFound, pageLines: Q.pageLines, pageTotal: Q.PAGE_TOTAL, restoreSnapshot: persistence.restoreSnapshot, validateFlags: persistence.validateFlags,
  begin: quest => quest.start(),
  // The book (motion comic in the intro's format) after the sixth page.
  comic: async opts => (await import('../cinema/horde/index.js')).playHordeComic(opts),
  back: {label: {kk: 'Жайық жолына оралу', ru: 'Вернуться к дороге у Яика'}, x: 44, y: 69.4},
  next: 7, passLabel: {kk: 'MAP07 · Қазақ хандығы', ru: 'MAP07 · Казахское ханство'},
  UI: {chapter: {kk: 'MAP 06 · АЛТЫН ОРДА', ru: 'MAP 06 · ЗОЛОТАЯ ОРДА'}, title: {kk: 'Алтын Орда', ru: 'Золотая Орда'},
    complete: {kk: 'MAP 06 АЯҚТАЛДЫ', ru: 'MAP 06 ЗАВЕРШЕНА'}, completeSub: {kk: 'Шежіренің 6-парағы қалпына келді', ru: 'Шестая страница Шежіре восстановлена'},
    stay: {kk: 'Алтын Орда дәуірінде қалу', ru: 'Остаться в эпохе Золотой Орды'}, nextOpened: {kk: 'MAP07 ашылды: Қазақ хандығы', ru: 'Открыта MAP07: Казахское ханство'}},
  music: (z, f) => z === 9 ? (f?.b?.bossSeen && !f?.b?.heraldDown ? 'witness' : 'cave') : z === 8 ? 'cave' : z === 1 || z === 2 || z === 7 ? 'village' : z === 3 || z === 4 ? 'mystery' : 'steppe',
  ambience: (z, x, y, tile) => {
    let river = 0;
    for (let dx = -6; dx <= 6; dx++) { const t = tile(Math.floor(x / 16) + dx, Math.floor(y / 16)); if (t === 4 || t === 5) river = Math.max(river, (1 - Math.abs(dx) / 7) * .5); }
    const under = z === 8 || z === 9;
    return {wind: under ? 0 : z === 4 ? 1 : .6, fire: under ? 0 : Math.max(near(x, y, 12, 46), near(x, y, 62, 30)), river, cave: under ? 1 : 0, birds: z === 0 || z === 5 || z === 6 ? .5 : 0};
  },
};

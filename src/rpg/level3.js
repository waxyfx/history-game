// MAP03 «Сақтар әлемі» bindings for the shared RPG runtime (same engine, same UI, own content).
import {MAP03} from './gen/map03.js';
import * as S from './story03.js';
import RU from './ru/map03.js';
import {applyRu} from './ru-pack.js';
applyRu(S, RU);   // Russian for the parts written only in Kazakh
import * as Q from './quest03.js';
import {makePersistence} from './persistence.js';
import {EGG_NAMES, EGG_LABELS} from './eggs.js';

// 24 header words + 25 items + 16 enemies × 2 + 4 effect slots × 2.
export const SAVE_WORDS_L3 = 24 + 25 + 16 * 2 + 8;
export const persistence = makePersistence({
  quizIds: Object.values(S.HISTORICAL_QUIZZES).map(q => q.id),
  sets: {talked: S.TALKERS, tracks: Object.values(S.EVIDENCE), petro: []},
  grants: ['kit', 'arnagift', 'page'], words: [SAVE_WORDS_L3]});

const near = (x, y, tx, ty, r = 150) => Math.max(0, 1 - Math.hypot(x - tx * 16, y - ty * 16) / r);
import {arsenal, FIRE, MELEE} from './weapons.js';
export default {
  id: 3, title: 'Сақтар әлемі', wasm: '/engine/rpg/tarikh-rpg-3.wasm', saveKey: 'tarikh.rpg.v3.L3', MAP: MAP03, requires: 2,
  // Saka: the akinakes — short reach, quick, the follow-up cut comes almost at once (quick chain).
  arsenal: E => { E.tj_weapon_tune(0, 22, 4, 12, 22, 12); arsenal(E, {fire: FIRE.bow, blade: MELEE.akinakes, pole: MELEE.spear}); },
  items: {1: {kk: ['Ақинақ', 'Сақтың қысқа семсері: қысқа әрі жылдам, екінші соққы бірден келеді.'], ru: ['Акинак', 'Короткий меч саков: близко и быстро, второй удар следует сразу.'], icon: 'knife'}},
  SPEAKERS: S.SPEAKERS, ZONE_NAMES: S.ZONE_NAMES, QUESTS: S.QUESTS, HISTORICAL_QUIZZES: S.HISTORICAL_QUIZZES, BONUS_QUIZ: S.BONUS_QUIZ,
  BONUS_META: S.BONUS_META, CHAMBER_FAIL: S.CHAMBER_FAIL, TRIAL_LEVELS: S.TRIAL_LEVELS, MAIN_QUIZ_ORDER: S.MAIN_QUIZ_ORDER,
  SECRETS: S.SECRETS, DIALOGUES: S.DIALOGUES, NAMES: {...S.NAMES, ...EGG_NAMES}, LABELS: {...S.LABELS, ...EGG_LABELS},
  applyWorld: Q.applyWorld, createQuest: Q.createQuest, questStage: Q.questStage, questTarget: Q.questTarget,
  scoreOf: Q.scoreOf, secretsFound: Q.secretsFound, pageLines: Q.pageLines, pageTotal: Q.PAGE_TOTAL, restoreSnapshot: persistence.restoreSnapshot, validateFlags: persistence.validateFlags,
  begin: quest => quest.start(),
  back: {label: {kk: 'Сақ қонысына оралу', ru: 'Вернуться в стан саков'}, x: 56, y: 44},
  passLabel: {kk: 'Ғұндар дәуіріне өту →', ru: 'В эпоху гуннов →'}, next: 4,
  UI: {chapter: {kk: 'MAP 03 · САҚ ДӘУІРІ', ru: 'MAP 03 · ЭПОХА САКОВ'}, complete: {kk: 'MAP 03 АЯҚТАЛДЫ', ru: 'MAP 03 ЗАВЕРШЕНА'}, completeSub: {kk: 'Шежіренің 3-парағы қалпына келді', ru: 'Третья страница Шежире восстановлена'}, stay: {kk: 'Сақ дәуірінде қалу', ru: 'Остаться в эпохе саков'}, nextOpened: {kk: 'MAP04 — Ғұндар дәуірі ашылды', ru: 'Открыта MAP04: эпоха гуннов'}},
  music: (z, f) => z === 12 ? 'camp' : z >= 10 ? 'cave' : z <= 3 && z >= 1 ? 'village' : z === 6 || z === 9 || z === 7 ? 'mystery' : 'explore',
  ambience: (z, x, y, tile, f) => {
    let river = 0;
    for (let dx = -6; dx <= 6; dx++) { const t = tile(Math.floor(x / 16) + dx, Math.floor(y / 16)); if (t === 4 || t === 5) river = Math.max(river, 1 - Math.abs(dx) / 7); }
    const fire = z >= 10 ? near(x, y, 32, 88, 120) * .5 : Math.max(near(x, y, 56, 39.4), near(x, y, 78, 45), near(x, y, 89, 102));
    return {wind: z >= 10 && z <= 11 ? 0 : z === 8 || z === 7 ? 1 : .7, fire, river, cave: z === 10 || z === 11 ? 1 : 0, birds: z <= 7 && !f.b.accused ? 1 : 0};
  },
};

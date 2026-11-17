// MAP01 «Алғашқы іздер» bindings for the shared RPG runtime (main.js). Content stays in story.js/quest.js.
import {MAP01} from './gen/map01.js';
import * as S from './story.js';
import * as Q from './quest.js';
import {restoreSnapshot} from './persistence.js';
import {INTERACT_LABEL} from './i18n.js';
import {EGG_NAMES, EGG_LABELS} from './eggs.js';

export default {
  id: 1, title: 'Алғашқы іздер', wasm: '/engine/rpg/tarikh-rpg.wasm', saveKey: 'tarikh.rpg.v3', MAP: MAP01,
  SPEAKERS: S.SPEAKERS, ZONE_NAMES: S.ZONE_NAMES, QUESTS: S.QUESTS, HISTORICAL_QUIZZES: S.HISTORICAL_QUIZZES, BONUS_QUIZ: S.BONUS_QUIZ,
  BONUS_META: S.BONUS_META, CHAMBER_FAIL: S.CHAMBER_FAIL, TRIAL_LEVELS: S.TRIAL_LEVELS, MAIN_QUIZ_ORDER: S.MAIN_QUIZ_ORDER,
  SECRETS: S.SECRETS, DIALOGUES: S.DIALOGUES, NAMES: EGG_NAMES, LABELS: {...INTERACT_LABEL, ...EGG_LABELS},
  applyWorld: Q.applyWorld, createQuest: Q.createQuest, questStage: Q.questStage, questTarget: Q.questTarget,
  scoreOf: Q.scoreOf, secretsFound: Q.secretsFound, pageLines: Q.pageLines, pageTotal: 4, restoreSnapshot,
  begin: quest => quest.interact('page1'),
  next: 2, passLabel: {kk: 'Қола дәуіріне өту →', ru: 'В бронзовый век →'},
  back: {label: {kk: 'Тас дәуіріне оралу', ru: 'Вернуться в каменный век'}, x: 30, y: 43.2},
};

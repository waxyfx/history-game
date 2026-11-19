// MAP04 «Ғұндар дәуірі» bindings for the shared RPG runtime (same engine, same UI, own content).
import {MAP04} from './gen/map04.js';
import * as S from './story04.js';
import RU from './ru/map04.js';
import {applyRu} from './ru-pack.js';
applyRu(S, RU);   // Russian for the parts written only in Kazakh
import * as Q from './quest04.js';
import {makePersistence} from './persistence.js';
import {EGG_NAMES, EGG_LABELS} from './eggs.js';
import {playFilm} from './cinema04.js';

// 24 header words + 25 items + 14 enemies × 2 + 4 effect slots × 2.
export const SAVE_WORDS_L4 = 24 + 25 + 14 * 2 + 8;
export const persistence = makePersistence({
  quizIds: Object.values(S.HISTORICAL_QUIZZES).map(q => q.id),
  sets: {talked: S.TALKERS, tracks: Object.values(S.PROOFS), petro: []},
  grants: ['kit', 'allyZ', 'allyF', 'allyK', 'page'], words: [SAVE_WORDS_L4]});

const near = (x, y, tx, ty, r = 150) => Math.max(0, 1 - Math.hypot(x - tx * 16, y - ty * 16) / r);
import {arsenal, FIRE, MELEE} from './weapons.js';
export default {
  id: 4, title: 'Ғұндар дәуірі', wasm: '/engine/rpg/tarikh-rpg-4.wasm', saveKey: 'tarikh.rpg.v3.L4', MAP: MAP04, requires: 3,
  // Huns: the blade and the bow keep their own systems (cut; draw-aim-loose).
  arsenal: E => arsenal(E, {fire: FIRE.bow, blade: MELEE.institute, pole: MELEE.spear}),
  SPEAKERS: S.SPEAKERS, ZONE_NAMES: S.ZONE_NAMES, QUESTS: S.QUESTS, HISTORICAL_QUIZZES: S.HISTORICAL_QUIZZES, BONUS_QUIZ: S.BONUS_QUIZ,
  BONUS_META: S.BONUS_META, CHAMBER_FAIL: S.CHAMBER_FAIL, TRIAL_LEVELS: S.TRIAL_LEVELS, MAIN_QUIZ_ORDER: S.MAIN_QUIZ_ORDER,
  SECRETS: S.SECRETS, DIALOGUES: S.DIALOGUES, NAMES: {...S.NAMES, ...EGG_NAMES}, LABELS: {...S.LABELS, ...EGG_LABELS},
  applyWorld: Q.applyWorld, createQuest: Q.createQuest, questStage: Q.questStage, questTarget: Q.questTarget,
  scoreOf: Q.scoreOf, secretsFound: Q.secretsFound, pageLines: Q.pageLines, pageTotal: Q.PAGE_TOTAL, restoreSnapshot: persistence.restoreSnapshot,
  begin: quest => quest.start(),
  // The motion-comic «Түйінші» (src/cinema/knot), played on the way from the camp into Talas.
  comic: async opts => (await import('../cinema/knot/index.js')).playKnotComic(opts),
  // ?film=1: the hollow is open, the knot-keeper waits; the hero stands in the hall (enemies off).
  playDemoFilm: G => { Object.assign(G.flags.b, {arrived: true, council: true, witnessDown: true, masks: true, peace: true}); G.forceNpc = true; Q.applyWorld(G);
    G.E.tj_groups(0); G.E.tj_teleport(32 * 16, 96 * 16); return G.film(playFilm, 'filmdemo'); },
  back: {label: {kk: 'Талас даласына оралу', ru: 'Талас даласына оралу'}, x: 40, y: 65},
  passLabel: {kk: 'Түркі дәуіріне өту →', ru: 'В тюркскую эпоху →'}, next: 5,
  UI: {chapter: {kk: 'MAP 04 · ҒҰНДАР ДӘУІРІ'}, complete: {kk: 'MAP 04 АЯҚТАЛДЫ'}, completeSub: {kk: 'Шежіренің 4-парағы қалпына келді'}, stay: {kk: 'Ғұндар дәуірінде қалу'}, nextOpened: {kk: 'MAP05 ашылды: Түркі қағанаты', ru: 'MAP05 открыта: Тюркский каганат'}},
  music: (z, f) => z === 10 ? 'camp' : z >= 8 ? 'cave' : z === 1 || z === 2 || z === 5 ? 'village' : z === 7 ? 'mystery' : 'steppe',
  ambience: (z, x, y, tile) => {
    let river = 0;
    for (let dx = -6; dx <= 6; dx++) { const t = tile(Math.floor(x / 16) + dx, Math.floor(y / 16)); if (t === 4 || t === 5) river = Math.max(river, 1 - Math.abs(dx) / 7); }
    return {wind: z === 8 || z === 9 ? 0 : .7, fire: z === 10 ? near(x, y, 89, 97) : 0, river, cave: z === 8 || z === 9 ? 1 : 0, birds: z < 7 ? 1 : 0};
  },
};

// MAP09 «Хат» — Soviet Kazakhstan, Alma-Ata 1941 (shared runtime, own content).
import {MAP09} from './gen/map09.js';
import * as S from './story09.js';
import * as Q from './quest09.js';
import {levelDescriptor, STORY_DEFAULTS} from './epochkit.js';

const MOSIN = {kk: ['Мосин мылтығы', 'Бес оқ, алысқа әрі дәл.'], ru: ['Винтовка Мосина', 'Пять патронов, далеко и точно.'], icon: 'rifle'};
const PPSH = {kk: ['ППШ', 'Бір басқанда — үш оқтан қатарынан.'], ru: ['ППШ', 'Одно нажатие — очередь в три патрона.'], icon: 'ppsh'};
const D = levelDescriptor({
  id: 9, title: 'Хат', MAP: MAP09, S: {...STORY_DEFAULTS, ...S}, Q, enemies: MAP09.enemies.length,
  back: {label: {kk: 'Вокзалға оралу', ru: 'Вернуться на вокзал'}, x: 46, y: 70.4},
  next: {id: 10, label: {kk: 'MAP10 · Тәуелсіз Қазақстан', ru: 'MAP10 · Независимый Казахстан'}},
  UI: {chapter: {kk: 'MAP 09 · КЕҢЕСТІК ҚАЗАҚСТАН', ru: 'MAP 09 · СОВЕТСКИЙ КАЗАХСТАН'}, title: {kk: 'Хат', ru: 'Письмо'},
    complete: {kk: 'MAP 09 АЯҚТАЛДЫ', ru: 'MAP 09 ЗАВЕРШЕНА'}, completeSub: {kk: 'Шежіренің 9-парағы қалпына келді', ru: 'Девятая страница Шежіре восстановлена'},
    stay: {kk: '1941 жылда қалу', ru: 'Остаться в 1941 году'}, nextOpened: {kk: 'MAP10 ашылды: 2087 жыл', ru: 'Открыта MAP10: 2087 год'},
    arrows: {kk: 'Патрондар', ru: 'Патроны'}},
  items: {1: {kk: ['Штык-пышақ', 'Қысқа жүз: жылдам соққы.'], ru: ['Штык-нож', 'Короткий клинок: быстрый удар.'], icon: 'knife'},
    2: {kk: ['Мосин штыгы', 'Мылтықтың штыгы: жақын шаншу.'], ru: ['Штык Мосина', 'Штык винтовки: укол вблизи.'], icon: 'bayonet'},
    get 3() { return Q.usingPPSh() ? PPSH : MOSIN; },
    4: {kk: ['Патрондар', 'Мылтық пен автоматқа ортақ.'], ru: ['Патроны', 'Общие для винтовки и автомата.'], icon: 'cartridges'}},
  sfx: {bow: 'shot', bowstring: 'cock'},
  music: (z, f) => z === 6 ? (f?.b?.bossSeen && !f?.b?.heirDown ? 'witness' : 'mystery') : z === 4 ? 'mystery' : z === 2 ? 'danger' : 'village',
  ambience: (z) => ({wind: z === 2 || z === 4 ? .6 : .3, fire: 0, river: 0, cave: z === 6 ? .6 : 0, birds: z === 4 ? .7 : 0}),
});
export const {SAVE_WORDS, persistence} = D;
export default D.level;

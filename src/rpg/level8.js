// MAP08 «Өрт» — the Russian Empire, Akmola 1838 (shared runtime, own content).
import {MAP08} from './gen/map08.js';
import * as S from './story08.js';
import RU from './ru/map08.js';
import {applyRu} from './ru-pack.js';
applyRu(S, RU);   // Russian for the parts written only in Kazakh
import * as Q from './quest08.js';
import {levelDescriptor, STORY_DEFAULTS} from './epochkit.js';

const near = (x, y, tx, ty, r = 150) => Math.max(0, 1 - Math.hypot(x - tx * 16, y - ty * 16) / r);
const D = levelDescriptor({
  id: 8, title: 'Өрт', MAP: MAP08, S: {...STORY_DEFAULTS, ...S}, Q, enemies: MAP08.enemies.length,
  // The big motion comic: the catastrophe and the turning point.
  comic: async opts => (await import('../cinema/fire/index.js')).playFireComic(opts),
  back: {label: {kk: 'Дала жолына оралу', ru: 'Вернуться на степную дорогу'}, x: 49, y: 72.4},
  next: {id: 9, label: {kk: 'MAP09 · Кеңестік Қазақстан', ru: 'MAP09 · Советский Казахстан'}},
  UI: {chapter: {kk: 'MAP 08 · РЕСЕЙ ИМПЕРИЯСЫ', ru: 'MAP 08 · РОССИЙСКАЯ ИМПЕРИЯ'}, title: {kk: 'Өрт', ru: 'Пожар'},
    complete: {kk: 'MAP 08 АЯҚТАЛДЫ', ru: 'MAP 08 ЗАВЕРШЕНА'}, completeSub: {kk: 'Шежіренің 8-парағы қалпына келді', ru: 'Восьмая страница Шежіре восстановлена'},
    stay: {kk: 'XIX ғасырда қалу', ru: 'Остаться в XIX веке'}, nextOpened: {kk: 'MAP09 ашылды: Кеңестік Қазақстан', ru: 'Открыта MAP09: Советский Казахстан'},
    arrows: {kk: 'Оқ-дәрі', ru: 'Пули и порох'}},
  items: {1: {kk: ['Қылыш', 'Шеге ұстаның тәсілі: үш соққы — үшіншісі аяқтаушы.'], ru: ['Сабля', 'Приём мастера Шеге: три удара — третий завершающий.'], icon: 'sabre'},
    2: {kk: ['Сүңгі (штык)', 'Мылтықтың ұшындағы жүз: жақын шаншу.'], ru: ['Штык', 'Клинок на стволе ружья: укол вблизи.'], icon: 'bayonet'},
    3: {kk: ['Шақпақты мылтық', 'Баяу оқталады, алысқа әрі қатты атады.'], ru: ['Кремнёвое ружьё', 'Заряжается медленно, бьёт далеко и сильно.'], icon: 'musket'},
    4: {kk: ['Оқ-дәрі', 'Қорғасын оқ пен дәрі: бір оқ — бір ату.'], ru: ['Пули и порох', 'Свинцовая пуля и порох: одна пуля — один выстрел.'], icon: 'balls'}},
  sfx: {bow: 'shot', bowstring: 'cock'},
  music: (z, f) => f?.b?.night && !f?.b?.chronDown ? (f?.b?.bossSeen ? 'witness' : 'danger') : z === 1 || z === 2 || z === 3 ? 'village' : z === 7 ? 'mystery' : 'steppe',
  ambience: (z, x, y, tile, f) => {
    let river = 0;
    for (let dx = -6; dx <= 6; dx++) { const t = tile(Math.floor(x / 16) + dx, Math.floor(y / 16)); if (t === 4 || t === 5) river = Math.max(river, (1 - Math.abs(dx) / 7) * .5); }
    const night = f?.b?.night && !f?.b?.chronDown;
    return {wind: .7, fire: night && (z === 1 || z === 7) ? .9 : Math.max(near(x, y, 22, 40), near(x, y, 18, 14)), river, cave: 0, birds: night ? 0 : z === 5 ? .5 : 0};
  },
});
export const {SAVE_WORDS, persistence} = D;
export default D.level;

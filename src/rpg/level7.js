// MAP07 «Жеті ата» — the Kazakh Khanate (shared runtime, own content).
import {MAP07} from './gen/map07.js';
import * as S from './story07.js';
import * as Q from './quest07.js';
import {levelDescriptor, STORY_DEFAULTS} from './epochkit.js';

const near = (x, y, tx, ty, r = 150) => Math.max(0, 1 - Math.hypot(x - tx * 16, y - ty * 16) / r);
const D = levelDescriptor({
  id: 7, title: 'Жеті ата', MAP: MAP07, S: {...STORY_DEFAULTS, ...S}, Q, enemies: MAP07.enemies.length,
  back: {label: {kk: 'Дала жолына оралу', ru: 'Вернуться на степную дорогу'}, x: 44, y: 68.4},
  next: {id: 8, label: {kk: 'MAP08 · Ресей империясы', ru: 'MAP08 · Российская империя'}},
  UI: {chapter: {kk: 'MAP 07 · ҚАЗАҚ ХАНДЫҒЫ', ru: 'MAP 07 · КАЗАХСКОЕ ХАНСТВО'}, title: {kk: 'Жеті ата', ru: 'Семь предков'},
    complete: {kk: 'MAP 07 АЯҚТАЛДЫ', ru: 'MAP 07 ЗАВЕРШЕНА'}, completeSub: {kk: 'Шежіренің 7-парағы қалпына келді', ru: 'Седьмая страница Шежіре восстановлена'},
    stay: {kk: 'Хандық дәуірінде қалу', ru: 'Остаться в эпохе ханства'}, nextOpened: {kk: 'MAP08 ашылды: Ресей империясы', ru: 'Открыта MAP08: Российская империя'}},
  items: {1: {kk: ['Қылыш', 'Иілген жүз: үш жылдам соққы — үшіншісі аяқтаушы.'], ru: ['Сабля', 'Изогнутый клинок: три быстрых удара — третий завершающий.'], icon: 'sabre'},
    2: {kk: ['Найза', 'Ұзын найза: жүгіріп келіп шаншу — екпінді соққы.'], ru: ['Найза', 'Длинное копьё: удар с разбега — удар с разгоном.'], icon: 'naiza'}},
  music: (z, f) => z === 7 ? (f?.b?.bossSeen && !f?.b?.noyonDown ? 'witness' : 'danger') : z === 1 || z === 2 || z === 3 ? 'village' : z === 6 ? 'mystery' : 'steppe',
  ambience: (z, x, y, tile) => {
    let river = 0;
    for (let dx = -6; dx <= 6; dx++) { const t = tile(Math.floor(x / 16) + dx, Math.floor(y / 16)); if (t === 4 || t === 5) river = Math.max(river, (1 - Math.abs(dx) / 7) * .5); }
    return {wind: z === 6 || z === 7 ? 1 : .7, fire: Math.max(near(x, y, 44, 40), near(x, y, 40, 18)), river, cave: 0, birds: z === 4 || z === 0 ? .5 : 0};
  },
});
export const {SAVE_WORDS, persistence} = D;
export default D.level;

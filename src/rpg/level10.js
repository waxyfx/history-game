// MAP10 «Он бірінші тігіс» — independent Kazakhstan, Almaty 2087: the finale (shared runtime, own content).
import {MAP10} from './gen/map10.js';
import * as S from './story10.js';
import * as Q from './quest10.js';
import {levelDescriptor, STORY_DEFAULTS} from './epochkit.js';

const D = levelDescriptor({
  id: 10, title: 'Он бірінші тігіс', MAP: MAP10, S: {...STORY_DEFAULTS, ...S}, Q, enemies: MAP10.enemies.length,
  // The fourth big motion comic: the canon finale (the wound, Түйінші, the merging, the fire).
  comic: async opts => (await import('../cinema/stitch/index.js')).playStitchComic(opts),
  back: {label: {kk: 'Алматы көшесіне оралу', ru: 'Вернуться на улицу Алматы'}, x: 42, y: 66.4},
  UI: {chapter: {kk: 'MAP 10 · ТӘУЕЛСІЗ ҚАЗАҚСТАН', ru: 'MAP 10 · НЕЗАВИСИМЫЙ КАЗАХСТАН'}, title: {kk: 'Он бірінші тігіс', ru: 'Одиннадцатый стежок'},
    complete: {kk: 'ШЕЖІРЕ ТОЛЫҚ', ru: 'ШЕЖИРЕ ЦЕЛОЕ'}, completeSub: {kk: 'Он парақ. Он бір тігіс. Жоғалған шежіре табылды.', ru: 'Десять страниц. Одиннадцать стежков. Потерянная шежире найдена.'},
    stay: {kk: '2087 жылда қалу', ru: 'Остаться в 2087 году'}, nextOpened: {kk: 'Науқан аяқталды', ru: 'Кампания завершена'},
    arrows: {kk: 'Ұяшықтар', ru: 'Ячейки'}},
  items: {1: {kk: ['Институт қылышы', 'Шежіре институтының жүзі. Ол ешқашан жоғалмайды.'], ru: ['Меч Института', 'Клинок Института Шежире. Его не отнять.'], icon: 'sword'},
    2: {kk: ['Ион-найза', 'Энергия ұшты найза: жүгіріп келіп шаншу — екпінді соққы.'], ru: ['Ион-найза', 'Копьё с энергетическим остриём: удар с разбега — удар с разгоном.'], icon: 'ionlance'},
    3: {kk: ['Импульс мылтығы', 'Энергия зарядтары: жылдам әрі алысқа.'], ru: ['Импульсная винтовка', 'Энергетические заряды: быстро и далеко.'], icon: 'pulse'},
    4: {kk: ['Энергия ұяшықтары', 'Импульс мылтығының зарядтары.'], ru: ['Энергоячейки', 'Заряды импульсной винтовки.'], icon: 'cells'}},
  sfx: {bowstring: 'cock'},
  music: (z, f) => z === 4 ? (f?.b?.bossSeen && !f?.b?.zulmatDown ? 'witness' : 'mystery') : z === 2 || z === 3 ? 'mystery' : 'village',
  ambience: (z) => ({wind: z === 0 || z === 1 || z === 5 ? .5 : 0, fire: 0, river: 0, cave: z === 4 ? .5 : 0, birds: z === 5 ? .7 : z === 0 ? .3 : 0}),
});
export const {SAVE_WORDS, persistence} = D;
export default D.level;

// UI data for the shared consumables and timed effects (engine data: src/rpg/effects.hpp).
// Adding a consumable to a later epoch = one row in effects.hpp + one row here + its name in i18n.js.

// Effect ids match `EffectId` in effects.hpp.
export const EFFECTS = {
  1: {icon: '⚔', color: '#e0503a', kk: 'Күш', ru: 'Сила', note: {kk: 'соққы +30%', ru: 'урон +30%'}},
  2: {icon: '🛡', color: '#8fc3ee', kk: 'Қорған', ru: 'Защита', note: {kk: 'алатын зақым −25%', ru: 'получаемый урон −25%'}},
  3: {icon: '🏃', color: '#7ff5e4', kk: 'Жүйрік', ru: 'Скорость', note: {kk: 'жылдамдық +20%', ru: 'скорость +20%'}},
  4: {icon: '🔥', color: '#f59a2a', kk: 'Ұста оты', ru: 'Огонь кузни', note: {kk: 'соққы +25%', ru: 'урон +25%'}},
  5: {icon: '✚', color: '#8fd36b', kk: 'Қуат', ru: 'Восстановление', note: {kk: 'секундына +3 ❤', ru: '+3 ❤ в секунду'}},
};
// Consumable item ids (inventory.hpp) in belt order, with what they do (for UI decisions only;
// the engine applies the real values). heal: instant HP; effect: EFFECTS id.
export const CONSUMABLES = {
  9: {heal: 25}, 20: {heal: 50}, 5: {heal: 45},
  25: {effect: 5}, 21: {effect: 1}, 22: {effect: 2}, 23: {effect: 3}, 24: {effect: 4},
};
export const BELT_ORDER = [9, 20, 5, 25, 21, 22, 23, 24];
// Quick heal (Q): the smallest heal first so big ones are kept for emergencies.
export const QUICK_HEAL = [9, 25, 20, 5];
// One-time tutorial hints on the first pickup of each kind.
export const HINTS = {
  heal: {kk: 'Емдік зат алдың. Жарақат алғанда Q басып емдел (немесе белдіктегі түйме / 4–9 пернелері). Денсаулық шегінен асып кетпейді.',
    ru: 'Ты подобрал лечение. Когда ранен — нажми Q (или кнопку на поясе / клавиши 4–9). Выше максимума здоровье не поднимется.'},
  buff: {kk: 'Бұл зат уақытша күш береді. Оны шайқас алдында қолдан: белдіктегі түйме немесе 4–9 пернелері. Белсенді әсерлер денсаулық жолағының астында көрінеді.',
    ru: 'Этот предмет даёт временное усиление. Используй его перед боем: кнопка на поясе или клавиши 4–9. Активные эффекты видны под полосой здоровья.'},
};

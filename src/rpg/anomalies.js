// «Уақыт аномалиялары» — the team easter eggs, one per epoch (MAP01–MAP05), collected across levels.
// Optional: they never count toward score, secrets or progress; each one is also stored in its level's flags.
// The collection lives in its own key so it survives level changes; it is validated on read.
const KEY = 'tarikh.anomalies';
export const ANOMALIES = {
  map01: {kk: 'Темір бетперде', ru: 'Железная маска'},
  map02: {kk: 'Жасыл тор', ru: 'Зелёная сетка'},
  map03: {kk: 'Ақ патша', ru: 'Белый король'},
  map04: {kk: 'Жасыл портал', ru: 'Зелёный портал'},
  map05: {kk: 'Саз әскер', ru: 'Глиняное войско'},
};
const IDS = Object.keys(ANOMALIES);
export function anomaliesFound(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage.getItem(KEY) || '[]'); return Array.isArray(v) ? [...new Set(v.filter(id => IDS.includes(id)))] : []; } catch { return []; }
}
// Records the find and shows the collection count. Returns true the first time.
export function anomaly(G, id, storage = globalThis.localStorage) {
  if (!IDS.includes(id)) return false;
  const list = anomaliesFound(storage), fresh = !list.includes(id);
  if (fresh) { list.push(id); try { storage.setItem(KEY, JSON.stringify(list)); } catch {} }
  const ru = G.lang?.() === 'ru';
  G.toast?.(`${ru ? 'Аномалия времени' : 'Уақыт аномалиясы'}: ${ANOMALIES[id][ru ? 'ru' : 'kk']} · ${list.length} / ${IDS.length}`, 'good');
  G.sfx?.('secret');
  return fresh;
}

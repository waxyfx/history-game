// Epoch registry: one runtime (main.js + engine), one content bundle per level, loaded on demand.
const LOADERS = {1: () => import('./level1.js'), 2: () => import('./level2.js')};
export const LEVEL_IDS = Object.keys(LOADERS).map(Number);
export function levelFromURL(search = globalThis.location?.search || '') {
  const n = Number(new URLSearchParams(search).get('level') || 1);
  return LOADERS[n] ? n : 1;
}
export async function loadLevel(id) { return (await (LOADERS[id] || LOADERS[1])()).default; }
// Practice-mode unlock (local journeys). Official runs are unlocked by the server (level_start_run).
export function localPassed(levelId, storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem('tarikh.rpg.results') || '[]').some(h => (h.map ?? 1) === levelId && h.passed); } catch { return false; }
}

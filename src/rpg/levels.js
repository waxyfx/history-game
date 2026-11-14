// Epoch registry: one runtime (main.js + engine), one content bundle per level, loaded on demand.
const LOADERS = {1: () => import('./level1.js'), 2: () => import('./level2.js'), 3: () => import('./level3.js'), 4: () => import('./level4.js')};
export const LEVEL_IDS = Object.keys(LOADERS).map(Number);
// TEMPORARY (QA): every playable epoch is open in practice mode so levels can be checked without
// passing the previous one. Official runs are still unlocked only by the server. Set to false to restore the gate.
export const TEMP_UNLOCK_ALL = true;
export function levelFromURL(search = globalThis.location?.search || '') {
  const n = Number(new URLSearchParams(search).get('level') || 1);
  return LOADERS[n] ? n : 1;
}
export async function loadLevel(id) { return (await (LOADERS[id] || LOADERS[1])()).default; }
// Practice-mode unlock (local journeys). Official runs are unlocked by the server (level_start_run).
export function localPassed(levelId, storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem('tarikh.rpg.results') || '[]').some(h => (h.map ?? 1) === levelId && h.passed); } catch { return false; }
}

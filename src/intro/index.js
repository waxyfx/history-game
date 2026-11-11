// TARIKH JOLY — motion-comic intro. Loaded on demand (separate chunk); the DoomGeneric/WASM
// game is untouched and keeps loading underneath while the intro plays.
import {SHOTS, LINES, TOTAL, CAST, SCENE_TITLES, VOICE_FILES} from './script.js';
import {SCENES} from './scenes.js';
import {playComic} from './player.js';
export {introLang} from './player.js';

export function playIntro(opts = {}) {
 return playComic({
  shots: SHOTS, lines: LINES, total: TOTAL, cast: CAST, sceneTitles: SCENE_TITLES, scenes: SCENES, voiceFiles: VOICE_FILES,
  sceneCount: 6, seenKey: 'tarikh.introSeen', label: {kk: 'Кіріспе комикс', ru: 'Вступительный комикс'},
 }, opts);
}

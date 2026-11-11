// «Автор шежіресі» — secret cutscene found in the author's yurt on MAP10 (Қазақ хандығы).
// Separate lazy chunk; reuses the intro's comic player, art kit and synthesizer.
import {SHOTS, LINES, TOTAL, CAST, SCENE_TITLES, score} from './egg-script.js';
import {SCENES} from './egg-scenes.js';
import {playComic} from '../intro/player.js';

// Secret spot: the yurt thing placed at (112,150) on MAP10 by scripts/make-wad.py.
export const SECRET = {level: 10, x: 112, y: 150, radius: 150};

export function playAuthorEgg(opts = {}) {
 return playComic({
  shots: SHOTS, lines: LINES, total: TOTAL, cast: CAST, sceneTitles: SCENE_TITLES, scenes: SCENES, score,
  sceneCount: 3, seenKey: 'tarikh.eggFound', enterSkips: false, devKey: 'eggT',
  label: {kk: 'Автор шежіресі', ru: 'Шежире автора'},
 }, opts);
}

// MAP08 «Өрт» motion-comic: the same player and controls as the game intro (src/intro/player.js).
import {playComic} from '../../intro/player.js';
import {SHOTS, LINES, TOTAL, CAST, SCENE_TITLES, score} from './script.js';
import {SCENES} from './scenes.js';

export function playFireComic(opts = {}) {
 return playComic({shots: SHOTS, lines: LINES, total: TOTAL, cast: CAST, sceneTitles: SCENE_TITLES, scenes: SCENES, score,
  sceneCount: 3, seenKey: 'tarikh.fireSeen', devKey: 'fireT', label: {kk: 'Өрт', ru: 'Пожар'}}, opts);
}

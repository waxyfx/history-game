// MAP05 vision motion-comic: the same player and controls as the game intro (src/intro/player.js).
import {playComic} from '../../intro/player.js';
import {SHOTS, LINES, TOTAL, CAST, SCENE_TITLES, score} from './script.js';
import {SCENES} from './scenes.js';

export function playVisionComic(opts = {}) {
 return playComic({shots: SHOTS, lines: LINES, total: TOTAL, cast: CAST, sceneTitles: SCENE_TITLES, scenes: SCENES, score,
  sceneCount: 3, seenKey: 'tarikh.visionSeen', devKey: 'visionT', label: {kk: 'Көрініс', ru: 'Видение'}}, opts);
}

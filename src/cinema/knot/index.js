// MAP04 cinematic «Түйінші» — a motion comic in the intro's format (same player, art kit and synthesizer).
// Loaded on demand as its own chunk.
import {SHOTS, LINES, TOTAL, CAST, SCENE_TITLES, score} from './script.js';
import {SCENES} from './scenes.js';
import {playComic} from '../../intro/player.js';

export function playKnotComic(opts = {}) {
 return playComic({
  shots: SHOTS, lines: LINES, total: TOTAL, cast: CAST, sceneTitles: SCENE_TITLES, scenes: SCENES, score,
  sceneCount: 3, seenKey: 'tarikh.knotSeen', devKey: 'knotT', label: {kk: 'Түйінші', ru: 'Түйінші'},
 }, opts);
}

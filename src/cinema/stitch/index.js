// MAP10 «Он бірінші тігіс» motion-comic (the finale): the same player and controls as the game intro (src/intro/player.js).
import {playComic} from '../../intro/player.js';
import {SHOTS, LINES, TOTAL, CAST, SCENE_TITLES, score} from './script.js';
import {SCENES} from './scenes.js';

export function playStitchComic(opts = {}) {
 return playComic({shots: SHOTS, lines: LINES, total: TOTAL, cast: CAST, sceneTitles: SCENE_TITLES, scenes: SCENES, score: opts.noScore ? () => [] : score,   // the finale's recorded song replaces the comic's own score
  sceneCount: 3, seenKey: 'tarikh.stitchSeen', devKey: 'stitchT', label: {kk: 'Он бірінші тігіс', ru: 'Одиннадцатый стежок'}}, opts);
}

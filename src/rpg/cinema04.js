// MAP04 film «Түйінші» (~85 s): the first meeting with the third party, rendered live by the engine.
// Eight shots joined by hard cuts through black and one white memory-flash; camera dollies, light and fog
// changes, particles, actor movement, procedural bell/heartbeat/breath cues and timed subtitles.
// Skipping fast-forwards to the same end state (d.final).
import {MAP04} from './gen/map04.js';
import {A, TS} from './quest.js';
import {DIALOGUES as D} from './story04.js';

const NPC = Object.fromEntries(MAP04.npcs.map((n, i) => [n, i]));
const TAG = Object.fromEntries(MAP04.tags.map((n, i) => [n, i]));
const P = (x, y) => [Math.round(x * TS), Math.round(y * TS)];
const line = i => D.film[i];

export async function playFilm(d) {
  const {E} = d, K = NPC.knot;
  const settle = () => { E.tj_shadow(0, 0, 0); E.tj_fog(0); E.tj_npc_flags(K, 0, 0, 1); E.tj_tag(TAG.filmprints, 0); };
  d.final(settle);
  // Setup: the hall is empty, the knot-keeper stands in the hollow with his back to us.
  E.tj_tag(TAG.filmprints, 1);
  E.tj_npc_set(K, ...P(31.2, 86.4), 0, A.interact, 1); E.tj_npc_flags(K, 0, 0, 0);
  E.tj_teleport(...P(32, 96)); d.face(0);
  d.music('off');
  await d.black(10);
  d.light(40, 42, 62, true); d.fog(90);

  // SHOT 1 — darkness; a bell answers a step nobody took.
  await d.wait(1200); d.sfx('bell', .8); await d.wait(2000);
  d.cam(...P(32, 99), 999);
  await d.unblack(2200);

  // SHOT 2 — the hall of witnesses after the battle: a slow push north, three masks smoulder.
  d.music('film'); d.light(92, 88, 122);
  d.cam(...P(32, 90), .35); await d.wait(2800);
  d.fx(...P(32, 88.6), 7, 12); d.sfx('breath', .6); await d.wait(2400);
  const walking = d.walk(...P(32.4, 90.6));
  d.cam(...P(32, 89.4), .45); await walking; await d.wait(700);

  // SHOT 3 — into the hollow: swaying cords, a lamp, a grey back that does not turn.
  d.cam(...P(31.8, 87.6), .55); d.light(122, 112, 142); d.sfx('knot'); await d.wait(1900);
  d.fx(...P(37, 82.4), 5, 6); await d.wait(1200);
  d.sfx('knot', .7); await d.wait(1300);
  await d.sub(line(0), 3300);
  await d.wait(900);
  await d.sub(line(1), 2000);

  // SHOT 4 — a memory cut: white flash, the smoke of the Stone Age, a whisper only Aibar could have heard.
  d.sfx('breath'); await d.wait(600);
  await d.flash(900);
  d.fog(175); d.light(206, 192, 168, true);
  for (let k = 0; k < 6; k++) { d.fx(...P(27.5 + k * 1.8, 85), 1, 4); await d.wait(230); }
  await d.sub(line(2), 4400);
  d.fog(90); d.light(112, 104, 138, true);
  await d.sub(line(3), 2200); await d.wait(500);
  await d.sub(line(4), 2700);

  // SHOT 5 — he turns; the hood keeps the face in shadow; the page passes between them.
  E.tj_npc_set(K, ...P(31.2, 86.4), 4, A.idle, 1); d.sfx('heartbeat'); await d.wait(1500);
  d.cam(...P(32, 88.6), .5);
  E.tj_npc_goto(K, ...P(32.2, 89.2), 0, A.idle); await d.wait(2300);
  d.sfx('page'); d.fx(...P(32.3, 90), 0, 26); await d.wait(800);
  await d.sub(line(5), 3300);
  d.pose(A.interact, 70); await d.wait(600);
  await d.sub(line(6), 2600);

  // SHOT 6 — the eleventh knot.
  d.cam(...P(36, 86), .8); await d.wait(1200);
  d.sfx('bell', .5); d.fx(...P(37, 83), 0, 12);
  await d.sub(line(7), 4400);

  // SHOT 7 — Zulmat tears in, and for the first time he is afraid.
  d.music('off'); d.sfx('rumble'); E.tj_shake(18); d.light(124, 62, 164);
  const z = P(32, 92.4);
  d.cam(z[0], z[1] - 18, 1.2);
  for (let a = 0; a <= 230; a += 23) { E.tj_shadow(z[0], z[1] - 22, a); await d.wait(60); }
  d.sfx('shadow'); d.fog(160);
  await d.sub(line(8), 2700);
  d.cam(...P(32, 89.4), 1.4); await d.wait(700);
  await d.sub(line(9), 3100);

  // SHOT 8 — the lamp goes out; one bell; when the light returns he is gone.
  d.sfx('bell', 1); await d.black(400);
  E.tj_shadow(0, 0, 0); d.fog(0); E.tj_npc_flags(K, 0, 0, 1); E.tj_tag(TAG.filmprints, 0);
  await d.wait(2600); d.sfx('heartbeat', .6); await d.wait(1300);
  d.light(150, 140, 172, true); d.cam(...P(32, 90.5), 999);
  await d.unblack(2400);
  // FINAL FRAME — two trails of the same boots meet in the dust; only one trail leaves.
  d.music('film');
  d.cam(...P(32, 87.4), .22);
  const PRINTS = [[22.5, 91.6], [24.5, 90.8], [26.5, 90], [28.5, 89.4], [30.5, 88.6], [41.5, 91.6], [39.5, 90.8], [37.5, 90], [35.5, 89.4], [33.5, 88.6], [32, 87.2], [32, 85.8]];
  for (let r = 0; r < 6; r++) { for (const [x, y] of PRINTS) d.fx(...P(x, y), 5, 1); await d.wait(700); }
  await d.title('ОН БІРІНШІ ТҮЙІН', 2800);
  await d.black(1600);
  settle();
  await d.unblack(500);
}

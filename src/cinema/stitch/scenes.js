// MAP10 «Он бірінші тігіс» — shot builders (same kit as src/intro/scenes.js; the knot-keeper and the cord are MAP04's).
import {h, g, path, tf, lerp, seg, ease, easeOut, rand, INK, nextId, makeHero, makeVillain, makeGate, makeHand, applyCam, page, overlay, sparks, mix} from '../../intro/art.js';
import {makeKnot, cord} from '../knot/scenes.js';

function grad(root, stops, {x2 = 0, y2 = 1, radial = false} = {}) {
 const id = nextId('st-g'), d = h('defs', {}, root);
 const el = h(radial ? 'radialGradient' : 'linearGradient', radial ? {id} : {id, x1: 0, y1: 0, x2, y2}, d);
 stops.forEach(([o, c, a = 1]) => h('stop', {offset: o, 'stop-color': c, 'stop-opacity': a}, el));
 return `url(#${id})`;
}
// The hall of the Gate: a dark floor, the Gate's ring of light above.
function gateHall(parent) {
 const R = g(parent);
 h('rect', {x: -800, y: -400, width: 3200, height: 1900, fill: grad(R, [[0, '#06070f'], [.6, '#141a2e'], [1, '#05060a']])}, R);
 R.gate = makeGate(R, 800, 300, 230);
 path(R, 'M-800,700 L2400,700 L2400,1500 L-800,1500 Z', '#0a0c14', 0);
 for (let x = -800; x < 2400; x += 120) path(R, `M${x},700 L${800 + (x - 800) * 2.2},1500`, 'none', 2, {stroke: '#1c2236'});
 return R;
}
// A big face of Aidar (close-up): skin, hair, the scarf; eyes are separate so one can close, bleed, burn.
function face(parent) {
 const F = {root: g(parent)};
 for (const x of [470, 1130]) h('ellipse', {cx: x, cy: 500, rx: 46, ry: 80, fill: '#b98a6a', stroke: INK, 'stroke-width': 7}, F.root);   // ears
 h('ellipse', {cx: 800, cy: 470, rx: 330, ry: 400, fill: '#c99a78', stroke: INK, 'stroke-width': 8}, F.root);
 h('ellipse', {cx: 960, cy: 600, rx: 120, ry: 160, fill: '#a87a5c', opacity: .25}, F.root);   // the shadow side
 path(F.root, 'M470,330 C500,120 700,40 820,50 C980,60 1120,140 1130,340 C1080,240 960,200 800,220 C660,230 540,260 470,330 Z', '#2a1e18', 6);
 path(F.root, 'M480,760 C620,880 980,880 1120,760 L1180,900 L420,900 Z', '#e98a2f', 7);   // the scarf
 F.eyeL = g(F.root); F.eyeR = g(F.root);
 for (const [E, x] of [[F.eyeL, 660], [F.eyeR, 940]]) {
  path(E, `M${x - 80},470 Q${x},410 ${x + 80},470 Q${x},520 ${x - 80},470 Z`, '#ece4d8', 6);
  h('circle', {cx: x, cy: 468, r: 34, fill: '#4a3022', stroke: INK, 'stroke-width': 4}, E); h('circle', {cx: x, cy: 468, r: 14, fill: '#0a0606'}, E);
  h('circle', {cx: x + 12, cy: 456, r: 7, fill: '#fff', opacity: .9}, E);
 }
 path(F.root, 'M590,400 Q660,370 730,395 M870,395 Q940,370 1010,400', 'none', 9, {stroke: '#2a1e18'});
 path(F.root, 'M800,470 L770,580 Q800,600 830,585', 'none', 6);   // the nose
 path(F.root, 'M720,680 Q800,700 880,680', 'none', 6);
 return F;
}

// Aidar's sword in his hand (the Institute blade): a line along the forearm that swings with the arm.
function swordIn(R) {
 const S = g(R.j.handF);
 path(S, 'M-12,14 L12,14', 'none', 7, {stroke: '#8a6a3a', 'stroke-linecap': 'round'});      // the guard
 path(S, 'M0,14 L0,190', 'none', 9, {stroke: '#d8e2ea', 'stroke-linecap': 'round'});        // the blade
 path(S, 'M3,22 L3,182', 'none', 2, {stroke: '#ffffff', opacity: .7});
 return S;
}
// A cut that flashes white, then stays as a dark-red line.
function cutMark(parent, d) {
 const flash = path(parent, d, 'none', 14, {stroke: '#fff6e8', 'stroke-linecap': 'round', opacity: 0});
 const mark = path(parent, d, 'none', 8, {stroke: '#8c1a14', 'stroke-linecap': 'round', opacity: 0});
 return t => {flash.setAttribute('opacity', Math.max(0, seg(t, 0, .08) - seg(t, .12, .45)).toFixed(2)); mark.setAttribute('opacity', (seg(t, .05, .3) * .95).toFixed(2));};
}
const GUARD = {shF: 70, elF: 50, wrF: -20, shB: 20, elB: 40, hipF: 14, kneeF: 18, hipB: -12, kneeB: 10, lean: 6};
const CUT_UP = {shF: 150, elF: 20, wrF: 10, shB: -10, elB: 30, hipF: 24, kneeF: 22, hipB: -18, kneeB: 8, lean: -6};
const CUT_DOWN = {shF: 30, elF: 0, wrF: -30, shB: 30, elB: 20, hipF: 30, kneeF: 30, hipB: -22, kneeB: 6, lean: 16};
const HIT = {shF: 40, elF: 70, wrF: 0, shB: -30, elB: 60, hipF: -10, kneeF: 10, hipB: 16, kneeB: 20, lean: -22, head: -14};
const HUNCH = {shF: 10, elF: 30, wrF: -20, shB: -10, elB: 40, hipF: 8, kneeF: 22, hipB: -6, kneeB: 20, lean: 16, head: 16, y: 14};   // bent over, still on his feet

export const SCENES = {
 // 0a — the fight in the hall of the Gate, with everything he has left: cut, parry, cut — the ink hand answers;
 // he is thrown back, falls to one knee, and gets up again for one more charge.
 fight(root) {
  const cam = g(root); const R = gateHall(cam);
  const z = makeVillain(cam); z.place(1060, 780, 1.25, true);
  const a = makeHero(cam); a.place(560, 780, 1.25, false); swordIn(a);
  const sp = [1.3, 2.7, 4.1, 7.9].map((at, i) => [at, sparks(cam, 830, 470, 22, 5 + i, i % 2 ? '#7ff5e4' : '#ffe28a')]);
  const hit = cutMark(cam, 'M500,430 L580,530');   // across the chest, where the ink hand caught him
  const ink = h('ellipse', {cx: 980, cy: 560, rx: 0, ry: 0, fill: '#0a0814', opacity: .85}, cam);
  overlay(root, 'url(#tj-vig)');
  return t => {
   let pose = GUARD, x = 560, tilt = 0;
   // three exchanges: guard → raise → strike, a step forward each time
   [1, 2.4, 3.8].forEach((t0, i) => {
    if (t < t0) return;
    const up = ease(seg(t, t0, t0 + .35)), down = ease(seg(t, t0 + .35, t0 + .6));
    if (t < t0 + .6) pose = down > 0 ? mix(CUT_UP, CUT_DOWN, down) : mix(GUARD, CUT_UP, up);
    else if (t < t0 + 1) pose = mix(CUT_DOWN, GUARD, ease(seg(t, t0 + .6, t0 + 1)));
    x = 560 + 50 * i + 50 * ease(seg(t, t0, t0 + .6));
   });
   if (t > 4.8) { const k = ease(seg(t, 4.8, 5.4)); pose = mix(GUARD, HIT, k); x = lerp(710, 460, k); tilt = seg(t, 5.2, 5.7) * -10; }
   if (t > 5.7) { pose = mix(HIT, HUNCH, ease(seg(t, 5.7, 6.2))); x = 460; }
   if (t > 6.6) { pose = mix(HUNCH, GUARD, ease(seg(t, 6.6, 7.2))); tilt = 0; }
   if (t > 7.3) { const k = ease(seg(t, 7.3, 7.7)); pose = mix(GUARD, CUT_UP, k); x = lerp(460, 660, k); }
   if (t > 7.7) pose = mix(CUT_UP, CUT_DOWN, ease(seg(t, 7.7, 8)));
   a.place(x, 780, 1.25, false, tilt); a.pose(pose);
   a.face({brow: t > 4.8 ? -.8 : -.5, mouth: t > 4.8 && t < 6.6 ? 'open' : t > 7.2 ? 'shout' : 'closed', look: [6, 0]}); a.tick(t, false);
   // Zulmat barely moves; at 4.6 his ink hand lashes out
   const lash = Math.max(0, seg(t, 4.5, 4.9) - seg(t, 5.1, 5.8));
   z.place(lerp(1060, 1010, lash), 780, 1.25, true); z.pose({shF: 30 + lash * 100, elF: 20 - lash * 20, shB: 10, lean: -4 + lash * 10});
   z.face({mouth: 'smirk'}); z.coatSwing = Math.sin(t * 2) * 2; z.tick(t, false);
   ink.setAttribute('rx', (lash * 230).toFixed(0)); ink.setAttribute('ry', (lash * 60).toFixed(0)); ink.setAttribute('cx', lerp(980, 640, lash).toFixed(0));
   sp.forEach(([at, f]) => f(t - at));
   hit(t - 5.0);
   R.gate.set(t, .8);
   applyCam(cam, [lerp(800, 780, ease(t / 9)), 470, lerp(.92, 1.02, ease(t / 9)), 0], [1.3, 2.7, 4.1, 5.0, 7.9].some(v => t > v && t < v + .2) ? 12 : 0, t);
  };
 },
 // 0b — the wounds: on one knee, the blows keep coming — the shoulder, the arm, the side. The sword sinks but stays in his hand.
 wounds(root) {
  const cam = g(root); const R = gateHall(cam);
  const a = makeHero(cam); a.place(760, 800, 1.5, false); swordIn(a);
  const cuts = [[.8, 'M700,470 L790,540'], [2.0, 'M820,560 L880,650'], [3.2, 'M690,600 L780,640']].map(([at, d]) => [at, cutMark(cam, d)]);
  const red = h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: '#5a0a08', opacity: 0}, root);
  overlay(root, 'url(#tj-vig)');
  return t => {
   const sag = ease(seg(t, .6, 5));
   const jolt = [.8, 2, 3.2].reduce((v, at) => v + Math.max(0, seg(t, at, at + .08) - seg(t, at + .12, at + .4)), 0);   // each blow rocks him back
   a.pose(mix(mix(HUNCH, {...HUNCH, shF: -10, elF: 10, head: 30, lean: 26, y: 30}, sag), {...HUNCH, lean: -12, head: -10}, jolt));
   a.face({brow: -.9, mouth: t > 4.4 ? 'open' : 'closed', look: [0, 2], blink: t > 3.3 && t < 3.6 ? 1 : 0}); a.tick(t, false);
   cuts.forEach(([at, f]) => f(t - at));
   red.setAttribute('opacity', (cuts.reduce((sum, [at]) => sum + Math.max(0, seg(t, at, at + .06) - seg(t, at + .1, at + .5)), 0) * .35).toFixed(2));
   R.gate.set(t, .6);
   applyCam(cam, [760, lerp(470, 500, ease(t / 6)), lerp(1.05, 1.25, ease(t / 6)), 0], [.8, 2, 3.2].some(v => t > v && t < v + .2) ? 14 : 0, t);
  };
 },
 // 1 — the ink blade crosses the face; one eye goes dark, red, then black.
 wound(root) {
  const cam = g(root); page(cam, '#0b0a10');
  const F = face(cam);
  const cut = path(cam, 'M520,300 L1080,640', 'none', 18, {stroke: '#d6f8ff', 'stroke-linecap': 'round', 'stroke-dasharray': 800, 'stroke-dashoffset': 800});
  const blood = path(cam, 'M600,400 C620,460 640,520 610,640 C700,600 720,500 700,420 Z', '#8c1a14', 0, {opacity: 0});
  const shut = path(cam, 'M578,474 Q660,512 742,474', 'none', 9, {stroke: '#3a0c08', 'stroke-linecap': 'round', opacity: 0});   // the closed lid
  const black = h('rect', {x: -400, y: -300, width: 1200, height: 1500, fill: '#000', opacity: 0}, root);
  return t => {
   cut.setAttribute('stroke-dashoffset', (800 * (1 - seg(t, 2.2, 2.5))).toFixed(0));
   cut.setAttribute('opacity', (1 - seg(t, 2.6, 3.4)).toFixed(2));
   blood.setAttribute('opacity', seg(t, 2.6, 3.4).toFixed(2)); shut.setAttribute('opacity', seg(t, 2.8, 3.6).toFixed(2));
   F.eyeL.setAttribute('opacity', (1 - seg(t, 2.6, 3)).toFixed(2));
   black.setAttribute('opacity', (seg(t, 3.4, 5) * .85).toFixed(2));   // half of the world goes dark
   applyCam(cam, [800, 470, lerp(1, 1.25, ease(t / 6)), 0], t > 2.4 && t < 3 ? 10 : 0, t);
  };
 },
 // 2 — he falls in the hall of the Gate, only the sword left in his hand; blood on the floor; the Gate's light above.
 fall(root) {
  const cam = g(root); const R = gateHall(cam);
  const pool = h('ellipse', {cx: 840, cy: 760, rx: 0, ry: 0, fill: '#5e0f0c', opacity: .9}, cam);
  const a = makeHero(cam); a.place(820, 760, 1.3, false);
  const sword = path(cam, 'M900,740 L1060,700', 'none', 8, {stroke: '#cfd6dd', 'stroke-linecap': 'round'});
  overlay(root, 'url(#tj-vig)');
  return t => {
   const k = ease(seg(t, .2, 1.6));
   a.place(820, 760, 1.3, false, lerp(0, -82, k)); a.pose({head: lerp(0, 20, k)}); a.face({look: [0, 1], mouth: 'closed', brow: -.4}); a.tick(t, false);
   pool.setAttribute('rx', (seg(t, 1.6, 6) * 180).toFixed(1)); pool.setAttribute('ry', (seg(t, 1.6, 6) * 30).toFixed(1));
   sword.setAttribute('opacity', '1');
   R.gate.set(t, .7);
   applyCam(cam, [820, lerp(560, 640, ease(t / 7)), lerp(1.1, 1.5, ease(t / 7)), 0]);
  };
 },
 // 3 — steps; out of the Gate's light the knot-keeper comes and kneels beside him.
 arrive(root) {
  const cam = g(root); const R = gateHall(cam);
  const a = makeHero(cam); a.place(760, 780, 1.1, false, -82); a.pose({head: 20});
  const K = makeKnot(cam); K.place(800, 300, .55); K.reveal({body: 0, hand: 0, hem: 0, face: 0, eye: 0});
  overlay(root, 'url(#tj-vig)');
  return t => {
   const walk = ease(seg(t, .4, 5.4));
   K.place(lerp(800, 960, walk), lerp(300, 790, walk), lerp(.55, 1.15, walk));
   K.reveal({body: seg(t, 1, 3.4), hand: seg(t, 3, 4.4), hem: seg(t, 2.4, 3.6), face: 0, eye: seg(t, 6, 7)});
   K.tick(t); a.tick(t, false);
   R.gate.set(t, .7);
   applyCam(cam, [lerp(800, 880, walk), lerp(420, 640, walk), lerp(1, 1.3, walk), 0]);
  };
 },
 // 4 — the hood falls: an older face — grey at the temples, the same scarf faded; the Institute's device, old and scratched.
 reveal(root) {
  const cam = g(root); page(cam, '#0a0b12');
  h('ellipse', {cx: 800, cy: 450, rx: 700, ry: 460, fill: 'url(#tj-glow)', opacity: .14}, cam);
  const F = face(cam);
  const grey = path(cam, 'M470,330 C500,120 700,40 820,50 C980,60 1120,140 1130,340 C1080,240 960,200 800,220 C660,230 540,260 470,330 Z', '#9a968e', 0, {opacity: 0});
  path(cam, 'M600,630 L660,600 M940,600 L1000,630', 'none', 4, {stroke: '#8a6a52'});                    // lines of age
  const scar = path(cam, 'M560,330 L760,560', 'none', 10, {stroke: '#7a4a3a', 'stroke-linecap': 'round', opacity: 0});   // the old wound, healed
  const hood = path(cam, 'M330,900 C320,300 520,-40 800,-60 C1080,-40 1280,300 1270,900 L1130,900 C1140,420 1000,180 800,180 C600,180 460,420 470,900 Z', '#4a4b53', 8);
  // the cloak itself falls from the shoulders after the hood: he takes it off to be seen
  const cloak = path(cam, 'M120,1100 C200,820 380,760 470,760 L1130,760 C1220,760 1400,820 1480,1100 Z', '#3c3d45', 8);
  const scarf = g(cam); path(scarf, 'M480,760 C620,880 980,880 1120,760 L1180,900 L420,900 Z', '#b8875a', 7);   // the same scarf, faded
  F.eyeL.setAttribute('opacity', 0);
  const ember = h('circle', {cx: 660, cy: 468, r: 22, fill: '#ffb347', opacity: 0}, cam);
  return t => {
   const drop = ease(seg(t, .4, 2.6));
   tf(hood, 0, lerp(0, 760, drop)); hood.setAttribute('opacity', (1 - seg(t, 2, 2.8)).toFixed(2));
   const off = ease(seg(t, 2.4, 4)); tf(cloak, lerp(0, -200, off), lerp(0, 520, off)); cloak.setAttribute('opacity', (1 - seg(t, 3.4, 4.2)).toFixed(2));
   grey.setAttribute('opacity', (seg(t, 1.4, 2.6) * .55).toFixed(2)); scar.setAttribute('opacity', seg(t, 2.2, 3).toFixed(2));
   ember.setAttribute('opacity', (seg(t, 3, 4) * (.5 + .3 * Math.sin(t * 6))).toFixed(2));
   applyCam(cam, [800, 470, lerp(1, 1.12, ease(t / 13)), 0]);
  };
 },
 // 5 — the hands meet; the cord of eleven knots passes from the old hand to the young one; the ten epochs flash by.
 transfer(root) {
  const cam = g(root); page(cam, '#07080e');
  const glow = h('ellipse', {cx: 800, cy: 450, rx: 520, ry: 260, fill: 'url(#tj-glow-v)', opacity: 0}, cam);
  const old = makeHand(cam, {jacket: '#4a4b53', cuff: '#2f3037', skin: '#a8866e', skinD: '#8a6a52'}); tf(old.root, 1240, 300, 120, .9);
  const young = makeHand(cam); tf(young.root, 360, 300, -120, .9);
  const C = cord(cam, 520, 450, 560);
  const r = rand(4), glyphs = ['ᛉ', '◈', '♜', '☼', '↟', '❋', '⌂', '◇', '✧', '⌁'];
  const flashes = glyphs.map((s, i) => {const t_ = h('text', {x: 400 + r() * 800, y: 200 + r() * 500, 'font-size': 90, fill: '#fff6c8', 'text-anchor': 'middle', opacity: 0}, cam); t_.textContent = s; return t_;});
  return t => {
   const k = ease(seg(t, .4, 2));
   tf(old.root, lerp(1240, 1010, k), 300, 120, .9); tf(young.root, lerp(360, 590, k), 300, -120, .9);
   old.grip(seg(t, 1.6, 2.2)); young.grip(seg(t, 1.6, 2.2));
   C.setAttribute('opacity', seg(t, 1.8, 2.4).toFixed(2));
   C.last.setAttribute('fill', t > 6 ? '#ffb347' : '#3a2a44');
   flashes.forEach((f, i) => f.setAttribute('opacity', (seg(t, 2 + i * .45, 2.2 + i * .45) - seg(t, 2.4 + i * .45, 2.8 + i * .45)).toFixed(2)));
   glow.setAttribute('opacity', (seg(t, 2, 7) * .6).toFixed(2));
   applyCam(cam, [800, 420, lerp(1, 1.2, ease(t / 8)), 0]);
  };
 },
 // 6 — two silhouettes, the young and the old, step into each other and become one.
 merge(root) {
  const cam = g(root); page(cam, '#05060a');
  const glow = h('ellipse', {cx: 800, cy: 450, rx: 300, ry: 420, fill: 'url(#tj-glow)', opacity: 0}, cam);
  const a = makeHero(cam); a.place(620, 820, 1.25, false);
  const K = makeKnot(cam); K.place(980, 820, 1.25, true); K.reveal({face: 1, eye: 1});
  const white = h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: '#fff', opacity: 0}, root);
  return t => {
   const k = ease(seg(t, .6, 4.4));
   a.place(lerp(620, 800, k), 820, 1.25, false); K.place(lerp(980, 800, k), 820, 1.25, true);
   K.root.setAttribute('opacity', (1 - seg(t, 3.6, 4.6)).toFixed(2)); a.tick(t, false); K.tick(t);
   glow.setAttribute('opacity', (seg(t, 2, 4.6) * .6).toFixed(2));
   white.setAttribute('opacity', ((seg(t, 4.4, 4.7) - seg(t, 4.8, 6.4)) * .9).toFixed(2));
   applyCam(cam, [800, 470, lerp(1, 1.3, k), 0]);
  };
 },
 // 7 — the face again, close: the empty socket ignites — a supernatural fire, the eleventh stitch.
 fire(root) {
  const cam = g(root); page(cam, '#07060a');
  const F = face(cam); F.eyeL.setAttribute('opacity', 0);
  path(cam, 'M560,330 L760,560', 'none', 10, {stroke: '#7a4a3a', 'stroke-linecap': 'round'});
  path(cam, 'M580,470 Q660,520 740,470 Q660,430 580,470 Z', '#120806', 5);   // the socket
  const halo = h('ellipse', {cx: 660, cy: 450, rx: 0, ry: 0, fill: 'url(#tj-glow-v)', opacity: .9}, cam);
  const tongues = Array.from({length: 7}, (_, i) => {const p = path(cam, '', i % 2 ? '#7ff5e4' : '#ffb347', 0, {opacity: 0}); p.ph = i * .9; p.dx = (i - 3) * 14; return p;});
  const sp = sparks(cam, 660, 420, 18, 9, '#7ff5e4');
  return t => {
   const on = seg(t, 1.8, 2.4);
   halo.setAttribute('rx', (on * 170).toFixed(1)); halo.setAttribute('ry', (on * 130).toFixed(1));
   tongues.forEach(p => {const hgt = (70 + Math.sin(t * 8 + p.ph) * 26) * on, x = 660 + p.dx;
    p.setAttribute('d', `M${x - 16},470 Q${x - 10},${470 - hgt * .6} ${x + Math.sin(t * 5 + p.ph) * 10},${470 - hgt} Q${x + 12},${470 - hgt * .5} ${x + 16},470 Z`);
    p.setAttribute('opacity', (on * .9).toFixed(2));});
   void sp;
   applyCam(cam, [lerp(800, 690, ease(seg(t, 2, 6))), lerp(470, 450, ease(seg(t, 2, 6))), lerp(1, 1.9, ease(seg(t, 2, 7))), 0], t > 1.8 && t < 2.3 ? 6 : 0, t);
   root.setAttribute('opacity', (1 - seg(t, 8.4, 9)).toFixed(2));
  };
 },
 title(root) {
  page(root, '#000');
  const glow = h('ellipse', {cx: 800, cy: 430, rx: 520, ry: 140, fill: 'url(#tj-glow-v)', opacity: 0}, root);
  return t => {glow.setAttribute('opacity', (seg(t, .4, 1.6) * .25 * (1 - seg(t, 5, 6))).toFixed(2));};
 },
};
void easeOut;

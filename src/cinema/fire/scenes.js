// MAP08 «Өрт» — shot builders (same kit and conventions as src/intro/scenes.js and src/cinema/horde).
import {h, g, path, tf, lerp, seg, ease, rand, INK, nextId, makeHand, makeConsole, makeBook, applyCam, page, overlay, sparks} from '../../intro/art.js';

const PARCH = '#efe3c2', INK_W = '#1f2a3a';
function grad(root, stops, {x2 = 0, y2 = 1, radial = false} = {}) {
 const id = nextId('fc-g'), d = h('defs', {}, root);
 const el = h(radial ? 'radialGradient' : 'linearGradient', radial ? {id} : {id, x1: 0, y1: 0, x2, y2}, d);
 stops.forEach(([o, c, a = 1]) => h('stop', {offset: o, 'stop-color': c, 'stop-opacity': a}, el));
 return `url(#${id})`;
}
function embers(parent, n, seed, {x0 = -200, x1 = 1800, y = 900} = {}) {
 const r = rand(seed);
 return Array.from({length: n}, () => {const c = h('circle', {cx: 0, cy: 0, r: 1.5 + r() * 3, fill: r() < .5 ? '#ffb347' : '#ffe08a'}, parent); c.x0 = x0 + r() * (x1 - x0); c.sp = 30 + r() * 70; c.ph = r() * 6; c.y0 = y; return c;});
}
const tickEmbers = (list, t) => list.forEach(c => {const y = c.y0 - ((t * c.sp + c.ph * 100) % 900); c.setAttribute('cx', (c.x0 + Math.sin(t * 1.3 + c.ph) * 30).toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('opacity', Math.max(0, Math.min(1, (y + 100) / 600)).toFixed(2));});
function script(parent, x, y, w, n, {gap = 44, seed = 3, color = INK_W, sw = 5} = {}) {
 const r = rand(seed), out = [];
 for (let i = 0; i < n; i++) {
  const len = w * (.6 + r() * .4); let d = `M${x},${y + i * gap}`;
  for (let s = 1; s <= 10; s++) d += ` q${len / 20},${(r() - .5) * 16} ${len / 10},${(r() - .5) * 4}`;
  out.push(path(parent, d, 'none', sw, {stroke: color, 'stroke-linecap': 'round', 'stroke-dasharray': 1600, 'stroke-dashoffset': 0}));
 }
 return out;
}

export const SCENES = {
 // 1 — the palisade burns at night; the watchtower stands black against the flames.
 fort(root) {
  const cam = g(root);
  h('rect', {x: -800, y: -400, width: 3200, height: 1900, fill: grad(cam, [[0, '#0a0610'], [.55, '#3a1410'], [.8, '#b8441a'], [1, '#2a0c08']])}, cam);
  const glow = h('ellipse', {cx: 800, cy: 640, rx: 1100, ry: 300, fill: 'url(#tj-glow-r)', opacity: .5}, cam);
  const back = g(cam), wall = g(cam);   // the flames burn behind the palisade
  for (let x = -300; x < 1900; x += 34) path(wall, `M${x},560 L${x + 14},520 L${x + 28},560 L${x + 28},760 L${x},760 Z`, '#1a0d08', 3);
  path(cam, 'M1180,760 L1200,320 L1290,320 L1310,760 Z M1160,330 L1245,250 L1330,330 Z', '#120806', 4);
  path(cam, 'M-400,760 L2000,760 L2000,1400 L-400,1400 Z', '#140806', 0);
  const flames = Array.from({length: 18}, (_, i) => {const f = path(back, '', i % 2 ? '#ff9a3a' : '#ffd36a', 0, {opacity: .85}); f.x = -200 + i * 120; f.ph = i * 1.7; return f;});
  const E = embers(cam, 60, 8, {y: 760});
  overlay(root, 'url(#tj-vig)');
  return t => {
   flames.forEach(f => {const hgt = 120 + Math.sin(t * 6 + f.ph) * 40 + Math.sin(t * 11 + f.ph) * 20;
    f.setAttribute('d', `M${f.x - 50},600 Q${f.x - 20},${600 - hgt * .6} ${f.x + Math.sin(t * 4 + f.ph) * 20},${600 - hgt} Q${f.x + 30},${600 - hgt * .5} ${f.x + 50},600 Z`);});
   glow.setAttribute('opacity', (.45 + Math.sin(t * 9) * .08).toFixed(2));
   tickEmbers(E, t);
   applyCam(cam, [800, lerp(520, 470, ease(t / 7)), lerp(1, 1.2, ease(t / 7)), 0], 1.5, t);
  };
 },
 // 2 — Dana's notebook beside a screen: the same line; on the screen it rewrites itself, on the paper it stays.
 notebook(root) {
  const cam = g(root); page(cam, '#0d1418');
  h('ellipse', {cx: 800, cy: 450, rx: 900, ry: 500, fill: 'url(#tj-glow)', opacity: .12}, cam);
  // the notebook (left)
  path(cam, 'M140,140 L760,120 L780,800 L160,820 Z', PARCH, 6);
  for (let k = 0; k < 9; k++) path(cam, `M180,${200 + k * 64} L740,${186 + k * 64}`, 'none', 2, {stroke: '#bcd0de'});
  script(cam, 200, 240, 500, 4, {gap: 64, seed: 11});
  const mine = script(cam, 200, 496, 500, 1, {seed: 21, color: '#a8281a', sw: 6})[0];   // the first version, in red pen
  h('ellipse', {cx: 452, cy: 496, rx: 290, ry: 40, fill: 'none', stroke: '#a8281a', 'stroke-width': 3}, cam);
  // the screen (right)
  path(cam, 'M860,160 L1480,160 L1480,760 L860,760 Z', '#0b2228', 6);
  h('rect', {x: 870, y: 170, width: 600, height: 580, fill: 'url(#tj-glow)', opacity: .18}, cam);
  script(cam, 900, 260, 520, 4, {gap: 64, seed: 11, color: '#7ff5e4', sw: 5});
  const lineA = script(cam, 900, 516, 520, 1, {seed: 21, color: '#7ff5e4', sw: 5})[0];
  const lineB = script(cam, 900, 516, 520, 1, {seed: 77, color: '#7ff5e4', sw: 5})[0]; lineB.setAttribute('stroke-dashoffset', 1600);
  const cursor = h('rect', {x: 900, y: 500, width: 10, height: 32, fill: '#7ff5e4'}, cam);
  overlay(root, 'url(#tj-vig)');
  return t => {
   lineA.setAttribute('stroke-dashoffset', (1600 * seg(t, 2.2, 3.4)).toFixed(0));
   lineB.setAttribute('stroke-dashoffset', (1600 * (1 - seg(t, 3.6, 5.2))).toFixed(0));
   cursor.setAttribute('x', (900 + 520 * seg(t, 3.6, 5.2)).toFixed(0)); cursor.setAttribute('opacity', (Math.sin(t * 10) > 0 ? 1 : 0).toString());
   mine.setAttribute('stroke-width', (6 + seg(t, 5.4, 6) * 2).toFixed(1));
   applyCam(cam, [lerp(820, 470, ease(seg(t, 5, 8))), 470, lerp(1, 1.5, ease(seg(t, 5, 8))), 0]);
  };
 },
 // 3 — 2087: the Gate console; a hand with the Institute's wrist device slams the safety lock; the glass cracks.
 console(root) {
  const cam = g(root); page(cam, '#081218');
  h('ellipse', {cx: 800, cy: 420, rx: 760, ry: 420, fill: 'url(#tj-glow)', opacity: .2}, cam);
  const C = makeConsole(cam, 800, 760); tf(C.root, 800, 760, 0, 1.6);
  const crack = path(cam, 'M760,460 L720,520 L750,540 L690,620 M720,520 L660,500 M750,540 L820,580 L800,650', 'none', 5, {stroke: '#e8fbff', opacity: 0});
  const flash = h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: '#fff', opacity: 0}, cam);
  const hand = makeHand(cam); tf(hand.root, 1300, 1400, -30, 1);
  overlay(root, 'url(#tj-vig)');
  return t => {
   const k = ease(seg(t, .6, 4.2));
   tf(hand.root, lerp(1300, 860, k), lerp(1400, 760, k), lerp(-30, -8, k), 1);
   hand.grip(seg(t, 3.4, 4.2));
   C.setPower(lerp(1, 2.5, seg(t, 0, 4.2)), t > 4.2);
   crack.setAttribute('opacity', seg(t, 4.2, 4.4).toFixed(2));
   flash.setAttribute('opacity', ((seg(t, 4.2, 4.3) - seg(t, 4.4, 5)) * .8).toFixed(2));
   applyCam(cam, [lerp(800, 840, k), lerp(460, 560, k), lerp(1, 1.4, k), 0], t > 4.2 ? 6 : 0, t);
  };
 },
 // 4 — the binding is cut: the open book, its stitches part one by one, the pages fly out and burn like sparks.
 binding(root) {
  const cam = g(root); page(cam, '#0a0806');
  const B = makeBook(cam, true); tf(B.root, 800, 520, 0, 3);
  const stitches = Array.from({length: 10}, (_, i) => path(cam, `M${780},${330 + i * 34} L${820},${330 + i * 34}`, 'none', 7, {stroke: '#e9e3d4', 'stroke-linecap': 'round'}));
  const r = rand(5);
  const pages = Array.from({length: 10}, (_, i) => {const P = g(cam); path(P, 'M-40,-52 L40,-52 L40,52 L-40,52 Z', PARCH, 4); h('text', {x: 0, y: 12, 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 800, fill: '#7a5a2a'}, P).textContent = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i];
   P.vx = (r() - .5) * 900; P.vy = -300 - r() * 400; P.rot = (r() - .5) * 600; P.setAttribute('opacity', 0); return P;});
  const E = embers(cam, 40, 13, {y: 700, x0: 400, x1: 1200});
  overlay(root, 'url(#tj-vig)');
  return t => {
   stitches.forEach((s, i) => s.setAttribute('opacity', (1 - seg(t, .8 + i * .12, 1 + i * .12)).toFixed(2)));
   pages.forEach((P, i) => {const k = Math.max(0, t - 2 - i * .08);
    P.setAttribute('opacity', (k > 0 ? 1 - seg(k, 3, 5) : 0).toFixed(2));
    tf(P, 800 + P.vx * k * .4, 480 + P.vy * k * .4 + 120 * k * k, P.rot * k * .3, 1 - seg(k, 3, 5) * .6);});
   tickEmbers(E, t);
   applyCam(cam, [800, 460, lerp(1.1, .9, ease(t / 8)), 0], t > 2 && t < 3 ? 4 : 0, t);
  };
 },
 // 5 — the burnt register: the palm print of a hand on the paper; Aidar's hand comes down and fits it exactly.
 palm(root) {
  const cam = g(root); page(cam, PARCH);
  h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: 'url(#tj-ht2)', opacity: .08}, cam);
  script(cam, 300, 160, 1000, 12, {gap: 52, seed: 31, color: '#4a3a28'});
  path(cam, 'M-200,900 Q300,760 600,880 T1800,820 L1800,1200 L-200,1200 Z', '#2a1a10', 0, {opacity: .8});   // the burnt edge
  const print = g(cam); tf(print, 800, 470);
  path(print, 'M-66,-90 C-80,-20 -70,40 -40,70 C-10,96 40,90 62,52 C76,20 74,-40 64,-90 Z', '#1c1410', 0, {opacity: .55});
  [-42, -14, 14, 40].forEach(x => h('ellipse', {cx: x, cy: -140, rx: 14, ry: 46, fill: '#1c1410', opacity: .55}, print));
  const hand = makeHand(cam); tf(hand.root, 800, -500, 180, 1);
  return t => {
   const k = ease(seg(t, 2, 4.6));
   tf(hand.root, 800, lerp(-500, 380, k), 180, 1);
   applyCam(cam, [800, 470, lerp(1, 1.25, ease(t / 7)), 0]);
   root.setAttribute('opacity', (1 - seg(t, 6.4, 7)).toFixed(2));
  };
 },
 final(root) {
  page(root, '#000');
  const glow = h('ellipse', {cx: 800, cy: 450, rx: 420, ry: 120, fill: 'url(#tj-glow-r)', opacity: 0}, root);
  const sp = sparks(root, 800, 520, 16, 4);
  return t => {glow.setAttribute('opacity', (seg(t, 1, 3) * .2 * (1 - seg(t, 8, 9))).toFixed(2)); void sp;};
 },
 title(root) {
  page(root, '#000');
  const glow = h('ellipse', {cx: 800, cy: 430, rx: 520, ry: 140, fill: 'url(#tj-glow-r)', opacity: 0}, root);
  return t => {glow.setAttribute('opacity', (seg(t, .4, 1.6) * .22 * (1 - seg(t, 4, 5))).toFixed(2));};
 },
};
void INK;

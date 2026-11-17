// MAP06 «Кітап» — shot builders (same kit and conventions as src/intro/scenes.js and src/cinema/vision).
import {h, g, path, tf, lerp, seg, ease, rand, INK, nextId, makeHero, applyCam, page, overlay} from '../../intro/art.js';

const PARCH = '#e8dcbc', PARCH_D = '#cdbb8f', INK_W = '#2a1d14', GOLD = '#d5bd7b', CYAN = '#7ff5e4';
function grad(root, stops, {x2 = 0, y2 = 1, radial = false} = {}) {
 const id = nextId('hb-g'), d = h('defs', {}, root);
 const el = h(radial ? 'radialGradient' : 'linearGradient', radial ? {id} : {id, x1: 0, y1: 0, x2, y2}, d);
 stops.forEach(([o, c, a = 1]) => h('stop', {offset: o, 'stop-color': c, 'stop-opacity': a}, el));
 return `url(#${id})`;
}
// A dark room lit by one lamp (the archive under the madrasa).
function lampRoom(parent) {
 const R = g(parent);
 h('rect', {x: -800, y: -400, width: 3200, height: 1900, fill: grad(R, [[0, '#120c08'], [.6, '#2a1c12'], [1, '#0b0705']])}, R);
 R.lamp = h('ellipse', {cx: 800, cy: 420, rx: 760, ry: 520, fill: 'url(#tj-glow)', opacity: .22}, R);
 return R;
}
// Lines of handwriting: wavy strokes standing for script (right to left, the Arabic-script Turkic of the age).
function scriptLines(parent, x, y, w, n, {gap = 34, seed = 3, color = INK_W, sw = 4} = {}) {
 const r = rand(seed), out = [];
 for (let i = 0; i < n; i++) {
  const len = w * (.55 + r() * .45); let d = `M${x + w},${y + i * gap}`;
  for (let s = 1; s <= 8; s++) d += ` q${-len / 16},${(r() - .5) * 14} ${-len / 8},${(r() - .5) * 4}`;
  out.push(path(parent, d, 'none', sw, {stroke: color, 'stroke-linecap': 'round', 'stroke-dasharray': 1400, 'stroke-dashoffset': 0}));
 }
 return out;
}
function leaf(parent, x, y, w = 150, hgt = 200, glyph = '') {
 const P = g(parent); tf(P, x, y);
 path(P, `M${-w / 2},${-hgt / 2} L${w / 2},${-hgt / 2} L${w / 2},${hgt / 2} L${-w / 2},${hgt / 2} Z`, PARCH, 4);
 scriptLines(P, -w / 2 + 16, -hgt / 2 + 40, w - 32, 4, {gap: 30, seed: Math.round(x + y), sw: 3});
 if (glyph) h('text', {x: 0, y: hgt / 2 - 22, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 800, fill: '#7a5a2a'}, P).textContent = glyph;
 return P;
}

export const SCENES = {
 // 1 — the book on the table; the cover with a tamga; it opens, its pages fan.
 book(root) {
  const cam = g(root); lampRoom(cam);
  path(cam, 'M-400,640 L2000,640 L2000,1400 L-400,1400 Z', '#3b2717', 0);
  const B = g(cam); tf(B, 800, 560);
  const leftC = path(B, 'M0,0 L-420,-20 L-420,60 L0,80 Z', '#5a2c1a', 6);
  const pagesL = g(B), pagesR = g(B);
  for (let i = 0; i < 9; i++) path(pagesL, `M0,${-6 - i * 4} L${-400 + i * 3},${-24 - i * 4} L${-400 + i * 3},${44 - i * 2} L0,${64 - i * 2} Z`, i % 2 ? PARCH : PARCH_D, 2);
  for (let i = 0; i < 9; i++) path(pagesR, `M0,${-6 - i * 4} L${400 - i * 3},${-24 - i * 4} L${400 - i * 3},${44 - i * 2} L0,${64 - i * 2} Z`, i % 2 ? PARCH : PARCH_D, 2);
  const cover = g(B);
  path(cover, 'M0,0 L420,-20 L420,60 L0,80 Z', '#6b3420', 6);
  path(cover, 'M170,10 L210,-14 L250,10 M190,30 L230,30', 'none', 6, {stroke: GOLD});   // the tamga
  const dust = Array.from({length: 26}, (_, i) => {const r = rand(i + 9); const c = h('circle', {cx: 800 + (r() - .5) * 700, cy: 300 + r() * 300, r: 1.5 + r() * 2, fill: '#f3dca4', opacity: .5}, cam); c.sp = 4 + r() * 8; c.y0 = +c.getAttribute('cy'); return c;});
  overlay(root, 'url(#tj-vig)');
  return t => {
   const open = ease(seg(t, 2.2, 5.2));
   // The cover swings over (a squash on x), the right stack lifts after it.
   tf(cover, 0, 0, 0, lerp(1, -1, open), 1);
   pagesR.setAttribute('opacity', open > .5 ? 1 : 0);
   leftC.setAttribute('opacity', 1);
   dust.forEach(d => d.setAttribute('cy', (d.y0 - (t * d.sp) % 200).toFixed(1)));
   applyCam(cam, [800, lerp(520, 470, t / 7), lerp(1.05, 1.35, ease(t / 7)), 0]);
  };
 },
 // 2 — the pages are generations: each grows from the one before; the sixth sprouts from the fifth like a branch.
 pages(root) {
  const cam = g(root); page(cam, '#1a120c');
  h('ellipse', {cx: 800, cy: 450, rx: 900, ry: 560, fill: 'url(#tj-glow)', opacity: .14}, cam);
  const glyphs = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const pos = [[800, 760], [640, 600], [920, 520], [700, 380], [900, 250], [1150, 170]];
  const links = [], leaves = [];
  pos.forEach(([x, y], i) => {
   if (i) {
    const [px, py] = pos[i - 1];
    const d = `M${px},${py - 90} C${px},${py - 160} ${x},${y + 160} ${x},${y + 90}`;
    links.push(path(cam, d, 'none', i === 5 ? 9 : 7, {stroke: i === 5 ? '#8a6a3a' : '#6b5232', 'stroke-dasharray': 600, 'stroke-dashoffset': 600, 'stroke-linecap': 'round'}));
   }
  });
  pos.forEach(([x, y], i) => {const L = leaf(cam, x, y, 130, 170, glyphs[i]); L.setAttribute('opacity', 0); leaves.push(L);});
  // The sixth leaf has a small sprout of new branches beyond it, unfinished.
  const sprout = path(cam, 'M1150,80 C1160,20 1230,0 1290,-30 M1150,80 C1130,20 1090,-10 1060,-40', 'none', 5, {stroke: '#8a6a3a', 'stroke-dasharray': 300, 'stroke-dashoffset': 300, 'stroke-linecap': 'round'});
  overlay(root, 'url(#tj-vig)');
  return t => {
   leaves.forEach((L, i) => {
    const k = i < 5 ? ease(seg(t, .4 + i * 1.05, 1.2 + i * 1.05)) : ease(seg(t, 5.6, 7.2));
    L.setAttribute('opacity', k.toFixed(2));
    const [x, y] = pos[i]; tf(L, x, y, i === 5 ? lerp(-20, 4, k) : 0, i === 5 ? lerp(.2, 1, k) : lerp(.8, 1, k));
   });
   links.forEach((l, i) => l.setAttribute('stroke-dashoffset', (600 * (1 - (i < 4 ? seg(t, .9 + i * 1.05, 1.5 + i * 1.05) : seg(t, 4.8, 6))).toFixed(1))));
   sprout.setAttribute('stroke-dashoffset', (300 * (1 - seg(t, 7.4, 8.8))).toFixed(1));
   applyCam(cam, [lerp(800, 960, ease(t / 9)), lerp(560, 300, ease(t / 9)), lerp(.9, 1.15, t / 9), 0]);
  };
 },
 // 3 — a record on the page changes: one line unwrites itself and another writes in its place, same ink.
 record(root) {
  const cam = g(root); page(cam, PARCH);
  h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: 'url(#tj-ht2)', opacity: .08}, cam);
  const lines = scriptLines(cam, 360, 220, 880, 10, {gap: 56, seed: 61, sw: 6});
  const target = lines[5];
  const fresh = scriptLines(cam, 360, 220 + 5 * 56, 880, 1, {gap: 56, seed: 97, sw: 6})[0];
  fresh.setAttribute('stroke-dashoffset', 1400);
  const ring = h('ellipse', {cx: 800, cy: 500, rx: 520, ry: 46, fill: 'none', stroke: '#9b2a1a', 'stroke-width': 3, opacity: 0}, cam);
  overlay(root, 'url(#tj-vig)');
  return t => {
   target.setAttribute('stroke-dashoffset', (1400 * seg(t, 1.6, 3.2)).toFixed(0));
   fresh.setAttribute('stroke-dashoffset', (1400 * (1 - seg(t, 3.4, 5.4))).toFixed(0));
   ring.setAttribute('opacity', (seg(t, 1.2, 1.6) * (1 - seg(t, 5.6, 6.4)) * .6).toFixed(2));
   applyCam(cam, [800, 500, lerp(1.1, 1.6, ease(seg(t, 0, 4))), 0]);
  };
 },
 // 4 — the spine: eleven stitches, one after another; the eleventh is other — late, another thread — and holds an empty page.
 spine(root) {
  const cam = g(root); lampRoom(cam);
  path(cam, 'M640,60 L960,60 L960,860 L640,860 Z', '#5a2c1a', 6);
  path(cam, 'M680,60 L680,860 M920,60 L920,860', 'none', 3, {stroke: '#3a1a10'});
  const st = [];
  for (let i = 0; i < 11; i++) {
   const y = 110 + i * 68, last = i === 10;
   const s = path(cam, `M700,${y} L900,${y + (last ? 14 : 0)}`, 'none', last ? 9 : 7, {stroke: last ? '#9aa4b8' : '#e9e3d4', 'stroke-linecap': 'round', 'stroke-dasharray': 240, 'stroke-dashoffset': 240});
   st.push(s);
  }
  const knot = h('circle', {cx: 900, cy: 804, r: 13, fill: '#3a2a44', stroke: INK, 'stroke-width': 3, opacity: 0}, cam);
  const halo = h('circle', {cx: 900, cy: 804, r: 70, fill: 'url(#tj-glow-v)', opacity: 0}, cam);
  // The empty page hanging from the last stitch.
  const empty = g(cam); tf(empty, 1010, 820);
  path(empty, 'M0,-80 L230,-60 L250,220 L10,200 Z', PARCH, 4);
  empty.setAttribute('opacity', 0);
  overlay(root, 'url(#tj-vig)');
  return t => {
   st.forEach((s, i) => {
    const a = i < 10 ? .6 + i * .42 : 6.4, b = a + (i < 10 ? .36 : 1.4);
    s.setAttribute('stroke-dashoffset', (240 * (1 - seg(t, a, b))).toFixed(0));
   });
   knot.setAttribute('opacity', seg(t, 7.6, 7.9).toFixed(2));
   halo.setAttribute('opacity', (seg(t, 7.6, 8.4) * .55).toFixed(2));
   empty.setAttribute('opacity', seg(t, 7.8, 8.6).toFixed(2));
   tf(empty, 1010, 820, Math.sin(t * 1.4) * 2.5);
   applyCam(cam, [lerp(800, 900, ease(seg(t, 5.6, 9))), lerp(300, 760, ease(seg(t, 0, 8))), lerp(1.2, 1.7, ease(seg(t, 5.6, 9))), 0]);
  };
 },
 // 5 — the margins: two hands, one ink. One writes evenly; the other tears the paper. They write toward each other.
 margins(root) {
  const cam = g(root); page(cam, PARCH);
  path(cam, 'M420,0 L420,900 M1180,0 L1180,900', 'none', 3, {stroke: PARCH_D});
  scriptLines(cam, 470, 120, 660, 13, {gap: 54, seed: 31, sw: 5, color: '#5a4630'});
  const r = rand(77);
  let even = 'M300,60', torn = 'M1300,860';
  for (let i = 1; i <= 26; i++) even += ` Q${300 + (i % 2 ? 26 : -26)},${60 + i * 15 - 7} 300,${60 + i * 15}`;
  for (let i = 1; i <= 26; i++) torn += ` L${1300 + (r() - .5) * 60},${860 - i * 15}`;
  const A = path(cam, even, 'none', 5, {stroke: INK_W, 'stroke-dasharray': 1600, 'stroke-dashoffset': 1600, 'stroke-linecap': 'round'});
  const B = path(cam, torn, 'none', 6, {stroke: INK_W, 'stroke-dasharray': 1800, 'stroke-dashoffset': 1800, 'stroke-linejoin': 'bevel'});
  const tears = Array.from({length: 7}, (_, i) => path(cam, `M${1290 + (r() - .5) * 40},${820 - i * 56} l${(r() - .5) * 30},${-14 - r() * 10}`, 'none', 2, {stroke: '#8a7350', opacity: 0}));
  overlay(root, 'url(#tj-vig)');
  return t => {
   A.setAttribute('stroke-dashoffset', (1600 * (1 - seg(t, .4, 6))).toFixed(0));
   B.setAttribute('stroke-dashoffset', (1800 * (1 - seg(t, .4, 6))).toFixed(0));
   tears.forEach((p, i) => p.setAttribute('opacity', seg(t, .8 + i * .7, 1.1 + i * .7).toFixed(2)));
   applyCam(cam, [800, 450, lerp(1, 1.12, t / 7), 0]);
  };
 },
 // 6 — Aidar alone before the closed book; the question.
 question(root) {
  const A = g(root); page(A, '#0a0806');
  const glow = h('ellipse', {cx: 800, cy: 640, rx: 520, ry: 160, fill: 'url(#tj-glow)', opacity: 0}, A);
  const book = g(A); tf(book, 800, 690);
  path(book, 'M-260,0 L260,0 L260,70 L-260,70 Z', '#5a2c1a', 6);
  path(book, 'M-40,20 L0,-4 L40,20 M-20,40 L20,40', 'none', 6, {stroke: GOLD});
  const a = makeHero(A); a.place(560, 860, 1.4, false);
  return t => {
   glow.setAttribute('opacity', (seg(t, .4, 2) * .2 * (1 - seg(t, 8.2, 9))).toFixed(2));
   a.pose({head: lerp(14, 6, seg(t, 1, 5))}); a.face({look: [2, 1], mouth: 'closed', brow: -.2}); a.tick(t, false);
   applyCam(A, [lerp(700, 760, ease(t / 9)), lerp(560, 600, ease(t / 9)), lerp(1, 1.12, t / 9), 0]);
   root.setAttribute('opacity', (1 - seg(t, 8.4, 9)).toFixed(2));
  };
 },
 title(root) {
  page(root, '#000');
  const glow = h('ellipse', {cx: 800, cy: 430, rx: 520, ry: 140, fill: 'url(#tj-glow)', opacity: 0}, root);
  return t => {glow.setAttribute('opacity', (seg(t, .4, 1.6) * .22 * (1 - seg(t, 4, 5))).toFixed(2));};
 },
};
void CYAN;

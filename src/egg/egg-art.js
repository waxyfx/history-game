// Art for the author's easter egg: yurt interior, the author (Жәнібек), ancestors, horses, crowds.
import {h, g, path, tf, lerp, rand, orn, INK} from '../intro/art.js';

const capsule = (len, w1, w2) => {const a = w1 / 2, b = w2 / 2; return `M${-a},0 L${-b},${len} A${b},${b} 0 0 0 ${b},${len} L${a},0 A${a},${a} 0 0 0 ${-a},0Z`;};
function joint(parent, x, y) {const j = g(parent); j.px = x; j.py = y; j.setAttribute('transform', `translate(${x} ${y})`); return j;}
const rot = (j, a) => j.setAttribute('transform', `translate(${j.px} ${j.py}) rotate(${a.toFixed(2)})`);

// Төре таңбасы — trident tamga (embroidered in gold on the түскиіз behind the author).
export function tamga(parent, x, y, s = 1, color = '#f2c255') {
 const T = g(parent); tf(T, x, y, 0, s);
 const d = 'M-46,-58 C-50,-14 -34,6 -6,10 L-6,74 M6,74 L6,10 C34,6 50,-14 46,-58 M0,-72 L0,10 M-46,-58 L-56,-40 M-46,-58 L-34,-44 M46,-58 L56,-40 M46,-58 L34,-44 M0,-72 L-10,-54 M0,-72 L10,-54 M-22,74 L22,74';
 path(T, d, 'none', 22, {stroke: INK});
 path(T, d, 'none', 13, {stroke: color});
 path(T, d, 'none', 3, {stroke: '#fff3c2', opacity: .55, transform: 'translate(-2 -2)'});
 return T;
}

// Kazakh yurt interior: кереге lattice, red уық poles, шаңырақ, түскиіз with the tamga, сандық, домбыра, текемет.
export function yurtInterior(parent) {
 const Y = {root: g(parent)};
 h('rect', {x: -300, y: -300, width: 2200, height: 1400, fill: '#3b2416'}, Y.root);
 // Roof felt + уық poles radiating from the шаңырақ.
 path(Y.root, 'M-300,-300 L1900,-300 L1900,360 L-300,360 Z', '#5a3a24', 0);
 for (let i = -16; i <= 16; i++) path(Y.root, `M${800 + i * 22},-120 L${800 + i * 150},360`, 'none', 10, {stroke: '#a8402c'});
 for (let i = -16; i <= 16; i++) path(Y.root, `M${800 + i * 22},-120 L${800 + i * 150},360`, 'none', 2, {stroke: INK, opacity: .7});
 Y.beam = path(Y.root, 'M700,-140 L900,-140 L1180,900 L420,900 Z', '#ffe2a0', 0, {opacity: .16});
 const sh = g(Y.root); tf(sh, 800, -140);
 h('circle', {r: 150, fill: '#ffe7b0', stroke: INK, 'stroke-width': 5}, sh);
 h('circle', {r: 150, fill: 'none', stroke: '#8a3b22', 'stroke-width': 18}, sh);
 path(sh, 'M-110,-30 Q0,10 110,-30 M-110,30 Q0,-10 110,30 M-30,-110 Q10,0 -30,110 M30,-110 Q-10,0 30,110', 'none', 10, {stroke: '#8a3b22'});
 // Кереге lattice wall.
 h('rect', {x: -300, y: 360, width: 2200, height: 360, fill: '#e3cfa4'}, Y.root);
 let d = ''; for (let x = -340; x < 1960; x += 34) d += `M${x},360 L${x + 360},720 M${x + 360},360 L${x},720 `;
 path(Y.root, d, 'none', 5, {stroke: '#9a5a2e'});
 path(Y.root, 'M-300,360 L1900,360', 'none', 10, {stroke: '#7a1f2b'});
 for (let x = -260; x < 1900; x += 70) orn(Y.root, x, 360, 50, '#f2c255');
 // Түскиіз (wall carpet) with ornament border and the trident tamga.
 Y.carpet = g(Y.root);
 path(Y.carpet, 'M540,380 L1060,380 L1060,700 L540,700 Z', '#7a1f2b', 5);
 path(Y.carpet, 'M564,404 L1036,404 L1036,676 L564,676 Z', 'none', 4, {stroke: '#f2c255'});
 for (let x = 590; x <= 1010; x += 60) {orn(Y.carpet, x, 392, 40, '#f2c255'); orn(Y.carpet, x, 688, 40, '#f2c255');}
 Y.tamgaGlow = h('circle', {cx: 800, cy: 540, r: 170, fill: 'url(#tj-glow-g)', opacity: .35}, Y.carpet);
 Y.tamga = tamga(Y.carpet, 800, 540, 1.15);
 // Сандық with stacked көрпе (quilts).
 const chest = g(Y.root);
 path(chest, 'M120,560 L420,560 L420,720 L120,720 Z', '#8a5a2a', 4);
 path(chest, 'M140,580 L400,580 L400,700 L140,700 Z', 'none', 3, {stroke: '#d9d4c8'});
 orn(chest, 270, 640, 110, '#d9d4c8');
 ['#c23b2a', '#2f6d6a', '#e2b45a', '#6b2a52'].forEach((c, i) => path(chest, `M110,${548 - i * 26} L430,${548 - i * 26} L426,${524 - i * 26} L114,${524 - i * 26} Z`, c, 3));
 // Домбыра on the wall.
 const dom = g(Y.root); tf(dom, 1300, 420, 18);
 path(dom, 'M-8,0 L8,0 L6,-230 L-6,-230 Z', '#6b3f1d', 3);
 path(dom, 'M0,0 C50,10 64,80 40,130 C24,160 -24,160 -40,130 C-64,80 -50,10 0,0 Z', '#a8652c', 4);
 h('circle', {cx: 0, cy: 70, r: 12, fill: '#3b2416', stroke: INK, 'stroke-width': 2}, dom);
 path(dom, 'M-3,-226 L-3,140 M3,-226 L3,140', 'none', 1.2, {stroke: '#f6eedc'});
 // Floor: текемет with ornament.
 path(Y.root, 'M-300,720 L1900,720 L1900,1100 L-300,1100 Z', '#6b4a2c', 4);
 path(Y.root, 'M200,760 L1400,760 L1560,980 L40,980 Z', '#b8432e', 5);
 path(Y.root, 'M250,780 L1350,780 L1490,955 L110,955 Z', 'none', 4, {stroke: '#f2deb0'});
 for (let x = 260; x <= 1340; x += 110) orn(Y.root, x, 868, 70, '#f2deb0');
 // Low table with tea bowls.
 Y.table = g(Y.root);
 path(Y.table, 'M560,800 Q800,770 1040,800 Q800,830 560,800 Z', '#7a4a22', 4);
 path(Y.table, 'M600,806 L612,846 M1000,806 L988,846', 'none', 8, {stroke: '#5a3416'});
 for (const x of [700, 800, 900]) {path(Y.table, `M${x - 18},790 Q${x},812 ${x + 18},790 Z`, '#f6f1e6', 3); path(Y.table, `M${x - 14},792 L${x + 14},792`, 'none', 3, {stroke: '#2f6d6a'});}
 h('rect', {x: -300, y: -300, width: 2200, height: 1400, fill: 'url(#tj-vig)', opacity: .7}, Y.root);
 Y.tick = t => {Y.beam.setAttribute('opacity', (.13 + Math.sin(t * .8) * .03).toFixed(3)); Y.tamgaGlow.setAttribute('opacity', (.3 + Math.sin(t * 2) * .08).toFixed(2));};
 return Y;
}

// Generic rig used for the author and the ancestors (3/4 view facing right, flip for left).
function rig(parent, build) {
 const root = g(parent), R = {root, j: {}, mouths: {}, mood: {brow: 0, mouth: 'closed', look: [0, 0], blink: 0}, seed: Math.random() * 10};
 R.place = (x, y, s = 1, flip = false, r = 0) => root.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(2)}) scale(${flip ? -s : s} ${s})`);
 R.pose = p => {
  const J = R.j, v = k => p[k] ?? 0;
  J.body.setAttribute('transform', `translate(${J.body.px} ${J.body.py + v('y')}) rotate(${v('lean')})`);
  rot(J.head, v('head'));
  rot(J.thighB, -v('hipB')); rot(J.shinB, v('kneeB')); rot(J.thighF, -v('hipF')); rot(J.shinF, v('kneeF'));
  rot(J.upperB, -v('shB')); rot(J.foreB, -v('elB')); rot(J.upperF, -v('shF')); rot(J.foreF, -v('elF'));
 };
 R.face = f => Object.assign(R.mood, f);
 R.tick = (t, talking) => {
  const m = R.mood;
  for (const k in R.mouths) R.mouths[k].style.display = 'none';
  let mouth = m.mouth;
  if (talking) {const ph = Math.sin(t * 23 + Math.sin(t * 7) * 2); mouth = ph > .35 ? 'open' : ph > -.3 ? 'mid' : 'closed';}
  (R.mouths[mouth] || R.mouths.closed).style.display = '';
  const blink = m.blink || ((t + R.seed) % 4.4 < .13 ? 1 : 0);
  R.eyesOpen.style.display = blink > .5 ? 'none' : ''; R.eyesShut.style.display = blink > .5 ? '' : 'none';
  R.irises.setAttribute('transform', `translate(${m.look[0]} ${m.look[1]})`);
  R.brows.forEach((b, i) => b.setAttribute('transform', `translate(0 ${(-m.brow * 3).toFixed(1)}) rotate(${(m.brow * (i ? 9 : -9)).toFixed(1)} ${b.cx} ${b.cy})`));
  R.extra?.(t);
 };
 build(R);
 R.pose({});
 return R;
}
function limbs(R, c) {
 const J = R.j;
 const leg = (x, back) => {
  const thigh = joint(J.body, x, 0), shin = joint(thigh, 0, 116);
  path(thigh, capsule(116, 40, 32), back ? c.pantsD : c.pants); path(shin, capsule(108, 32, 26), back ? c.pantsD : c.pants);
  path(shin, 'M-17,64 L15,64 L16,108 L38,112 Q44,122 36,126 L-17,126 Z', back ? '#1d1410' : c.boot);
  return [thigh, shin];
 };
 const arm = (x, y, back) => {
  const up = joint(J.body, x, y), fore = joint(up, 0, 92), hand = joint(fore, 0, 82);
  path(up, capsule(94, c.sleeveW || 40, (c.sleeveW || 40) - 6), back ? c.robeD : c.robe);
  path(fore, capsule(82, (c.sleeveW || 40) - 6, (c.sleeveW || 40) - 4), back ? c.robeD : c.robe);
  if (c.cuff) path(fore, `M${-(c.sleeveW || 40) / 2 + 2},66 L${(c.sleeveW || 40) / 2 - 2},66 L${(c.sleeveW || 40) / 2},82 L${-(c.sleeveW || 40) / 2},82 Z`, c.cuff, 2.5);
  path(hand, 'M-12,-4 C-15,8 -14,22 -6,30 C0,34 8,32 12,24 C15,14 14,2 11,-4 Z', back ? c.skinD : c.skin);
  path(hand, 'M10,6 C17,8 20,16 15,20', back ? c.skinD : c.skin, 2.5);
  return [up, fore, hand];
 };
 return {leg, arm};
}
// 3/4 head (pivot at neck top). Shared by author and ancestors; hair/beard/hat are options.
function head(R, H, c) {
 path(H, 'M-8,0 L-10,-18 L14,-18 L14,0 Z', c.skinD, 0);
 path(H, 'M-26,-30 C-36,-50 -36,-80 -14,-92 C6,-102 30,-94 36,-74 L38,-58 L46,-44 L39,-40 L39,-33 L36,-27 C36,-15 27,-7 14,-5 L-8,-16 Z', c.skin, 3.5);
 path(H, 'M-26,-30 C-32,-46 -26,-62 -16,-70 L-8,-44 L-8,-16 Z', c.skinD, 0, {opacity: .8});
 path(H, 'M-17,-58 C-26,-60 -27,-38 -16,-36 C-12,-40 -12,-54 -17,-58Z', c.skin, 2.5);
 path(H, 'M38,-42 Q35,-41 33,-43', 'none', 2);
 R.eyesOpen = g(H); R.eyesShut = g(H);
 path(R.eyesOpen, 'M3,-57 Q11,-64 19,-57 Q11,-52 3,-57Z', '#f6efe4', 2);
 path(R.eyesOpen, 'M26,-57 Q31,-62 36,-58 Q31,-54 26,-57Z', '#f6efe4', 2);
 R.irises = g(R.eyesOpen);
 h('circle', {cx: 12, cy: -57.5, r: 3.8, fill: c.iris || '#2a1810'}, R.irises); h('circle', {cx: 31.5, cy: -57.8, r: 2.8, fill: c.iris || '#2a1810'}, R.irises);
 h('circle', {cx: 13.2, cy: -59, r: 1.2, fill: '#fff'}, R.irises);
 path(R.eyesOpen, 'M2,-57 Q11,-65 20,-58 M25,-57 Q31,-63 37,-58', 'none', 3.2);
 path(R.eyesShut, 'M3,-56 Q11,-52 19,-56 M26,-57 Q31,-54 36,-57', 'none', 3);
 if (c.age) path(H, 'M2,-50 Q10,-47 18,-50 M30,-36 Q34,-30 32,-24 M-2,-62 Q4,-64 8,-63', 'none', 1.6, {opacity: .6});
 R.brows = [path(H, 'M0,-66 Q10,-72 20,-67', 'none', 5, {stroke: c.browCol || INK}), path(H, 'M25,-67 Q31,-71 37,-66', 'none', 4.5, {stroke: c.browCol || INK})];
 R.brows[0].cx = 10; R.brows[0].cy = -68; R.brows[1].cx = 31; R.brows[1].cy = -68;
 const M = R.mouths;
 M.closed = path(H, 'M25,-31 Q31,-29.5 36,-31.5', 'none', 2.5);
 M.smile = path(H, 'M24,-32 Q31,-26 37,-33', 'none', 2.5);
 M.mid = path(H, 'M25,-32 Q31,-31 36,-32 Q31,-26 25,-32Z', '#4a1d16', 2.2);
 M.open = path(H, 'M24,-33 Q31,-32 37,-33 Q34,-22 27,-23 Q24,-27 24,-33Z', '#4a1d16', 2.2);
 if (c.beard === 'long') path(H, 'M14,-24 C18,-10 22,10 30,40 L36,6 L40,-24 Q30,-18 14,-24Z', c.beardCol, 2.5);
 if (c.beard === 'short') path(H, 'M-6,-18 C0,-6 14,0 26,-2 C34,-6 40,-16 40,-26 L36,-22 Q30,-14 22,-16 Q10,-14 0,-24 Z', c.beardCol, 2.5);
 if (c.beard === 'pointed') path(H, 'M18,-22 C22,-10 28,0 34,14 L38,-6 L40,-22 Q30,-16 18,-22Z', c.beardCol, 2.5);
 if (c.mustache) path(H, 'M22,-35 Q31,-40 41,-35 Q44,-30 46,-26 Q38,-32 31,-32 Q24,-31 18,-28 Q19,-32 22,-35Z', c.beardCol, 2);
 if (c.glasses) {path(H, 'M2,-57 a9,8 0 1 0 18,0 a9,8 0 1 0 -18,0 M25,-57 a6,7 0 1 0 12,0 a6,7 0 1 0 -12,0 M20,-58 L25,-58 M2,-58 L-14,-56', 'none', 2.4);}
 // Hair.
 if (c.hair === 'curtain') {
  path(H, 'M-30,-40 C-46,-68 -32,-106 4,-108 C30,-110 48,-96 46,-76 L42,-62 C38,-72 30,-80 18,-84 C10,-80 2,-74 -6,-66 L-12,-52 L-20,-40 Z', c.hairCol, 3.5);
  path(H, 'M16,-86 C4,-82 -6,-70 -8,-56 C-2,-64 6,-70 14,-72 Z', c.hairCol, 3);
  path(H, 'M18,-86 C30,-82 40,-72 42,-58 C36,-66 28,-70 22,-72 Z', c.hairCol, 3);
  path(H, 'M17,-100 L17,-80 M-20,-80 C-12,-92 0,-98 12,-99', 'none', 2.5, {stroke: '#4a3a33'});
 } else if (c.hair === 'short') {
  path(H, 'M-30,-40 C-44,-70 -30,-104 4,-104 C28,-106 40,-94 38,-78 C30,-86 14,-90 -2,-86 C-12,-80 -16,-64 -18,-50 Z', c.hairCol, 3.5);
 } else if (c.hair === 'bald') {
  path(H, 'M-30,-40 C-36,-52 -34,-64 -26,-72 L-18,-50 Z', c.hairCol, 3);
 }
 // Hats.
 const hat = g(H);
 if (c.hat === 'mongol') {
  path(hat, 'M-24,-108 C-12,-150 26,-150 36,-108 Z', c.hatCol, 3.5);
  path(hat, 'M-40,-104 C-30,-120 40,-122 52,-102 C46,-88 -34,-86 -40,-104 Z', '#7a5a3a', 3.5);
  path(hat, 'M-36,-102 C-20,-112 34,-114 48,-100', 'none', 3, {stroke: '#a88a62'});
  h('circle', {cx: 6, cy: -146, r: 7, fill: '#d14b3a', stroke: INK, 'stroke-width': 2.5}, hat);
 } else if (c.hat === 'helmet') {
  path(hat, 'M-34,-80 C-34,-130 46,-130 44,-80 Z', '#7c7f86', 3.5);
  path(hat, 'M4,-122 L6,-150 L10,-122 Z', '#9a9ca2', 2.5);
  path(hat, 'M-36,-82 L46,-82 L46,-74 L-36,-74 Z', '#c99a3a', 2.5);
  path(hat, 'M-36,-76 L-44,-30 L-20,-30 L-14,-74 Z', '#5d4a3a', 3);
 } else if (c.hat === 'borik') {
  path(hat, 'M-26,-104 C-20,-146 30,-150 38,-104 Z', c.hatCol, 3.5);
  path(hat, 'M-40,-100 C-30,-118 42,-120 52,-98 C48,-84 -36,-82 -40,-100 Z', '#e8e0d0', 3.5);
  path(hat, 'M-36,-96 L-30,-106 M-20,-92 L-16,-108 M-2,-90 L0,-110 M16,-90 L18,-110 M34,-92 L36,-108', 'none', 2, {stroke: '#a89c88'});
  if (c.uki) {path(hat, 'M8,-142 C2,-170 14,-190 26,-200 C24,-180 22,-162 14,-142 Z', '#f4f0e6', 2.5); path(hat, 'M14,-150 L20,-188', 'none', 1.5, {stroke: '#c9c0b0'});}
  orn(hat, 6, -126, 30, '#f2c255');
 } else if (c.hat === 'crown') {
  path(hat, 'M-28,-104 L-26,-150 L-8,-136 L6,-160 L20,-136 L38,-150 L38,-104 Z', '#c9952e', 3.5);
  path(hat, 'M-40,-100 C-30,-118 42,-120 52,-98 C48,-84 -36,-82 -40,-100 Z', '#3a2a22', 3.5);
  h('circle', {cx: 6, cy: -124, r: 6, fill: '#c23b2a', stroke: INK, 'stroke-width': 2}, hat);
 }
}

const AUTHOR = {skin: '#efcdb0', skinD: '#cfa385', hairCol: '#1a1411', robe: '#1f2b56', robeD: '#141c3a', trim: '#e9b94f', pants: '#2a2a33', pantsD: '#1b1b22', boot: '#3b2a20', hair: 'curtain', iris: '#3a2416'};

// The author: 19-year-old, curtain haircut, fair skin, navy velvet шапан with gold ornament over a white shirt.
export function makeAuthor(parent) {
 const c = AUTHOR;
 return rig(parent, R => {
  const J = R.j; J.body = joint(R.root, 0, -236);
  path(R.root, 'M-80,0 A80,12 0 1 0 80,0 A80,12 0 1 0 -80,0', '#000', 0, {opacity: .25});
  const {leg, arm} = limbs(R, c);
  [J.upperB, J.foreB] = arm(30, -132, true);
  [J.thighB, J.shinB] = leg(10, true); [J.thighF, J.shinF] = leg(-8, false);
  // Long шапан skirt.
  R.hem = g(J.body);
  path(R.hem, 'M-50,-20 L-64,160 Q0,176 62,160 L48,-20 Z', c.robe, 3.5);
  path(R.hem, 'M14,-20 L24,164 Q44,166 62,160 L48,-20 Z', c.robeD, 0);
  path(R.hem, 'M-64,160 Q0,176 62,160', 'none', 8, {stroke: c.trim}); path(R.hem, 'M-64,160 Q0,176 62,160', 'none', 2);
  path(R.hem, 'M10,-20 L18,166', 'none', 7, {stroke: c.trim}); path(R.hem, 'M10,-20 L18,166', 'none', 2);
  for (const y of [40, 100]) orn(R.hem, -24, y, 40, c.trim);
  const torso = g(J.body);
  path(torso, 'M-48,-10 L-54,-80 L-58,-130 Q-32,-154 4,-154 Q40,-154 60,-128 L54,-80 L48,-10 Z', c.robe, 3.5);
  path(torso, 'M20,-150 Q44,-152 60,-128 L54,-80 L48,-10 L22,-10 Z', c.robeD, 0);
  path(torso, 'M20,-150 Q44,-152 60,-128 L54,-80 L48,-10 L22,-10 Z', 'url(#tj-ht)', 0, {opacity: .25});
  path(torso, 'M-48,-10 L-54,-80 L-58,-130 Q-32,-154 4,-154 Q40,-154 60,-128 L54,-80 L48,-10 Z', 'none', 3.5);
  // White shirt in the open front + gold-trimmed lapels.
  path(torso, 'M-8,-150 L24,-150 L14,-60 L6,-60 Z', '#f6f3ec', 2.5);
  path(torso, 'M-12,-152 L4,-60 L10,-10 M28,-152 L16,-60', 'none', 8, {stroke: c.trim});
  path(torso, 'M-12,-152 L4,-60 L10,-10 M28,-152 L16,-60', 'none', 2);
  orn(torso, -30, -96, 34, c.trim); orn(torso, 40, -96, 30, '#b88a2e');
  path(torso, 'M-50,-36 L52,-36 L50,-24 L-49,-24 Z', '#5a2a1a', 2.5);
  path(torso, 'M-2,-36 L16,-36 L16,-24 L-2,-24 Z', c.trim, 2);
  path(torso, 'M-6,-156 L-8,-142 L18,-142 L16,-156 Z', c.skinD, 2.5);
  J.head = joint(J.body, 4, -156);
  head(R, J.head, c);
  [J.upperF, J.foreF] = arm(-20, -130, false);
  R.hemSwing = 0;
  R.extra = t => R.hem.setAttribute('transform', `skewX(${(R.hemSwing + Math.sin(t * 1.8 + R.seed) * .8).toFixed(2)})`);
  R.mood.mouth = 'smile';
 });
}

// Ancestors: robe/deel or (for Әлихан) a suit; hat, beard and colours are options.
export function makeKhan(parent, o = {}) {
 const c = {skin: '#c9925f', skinD: '#9d6845', hairCol: '#1a1411', beardCol: '#1a1411', robe: '#7a2b24', robeD: '#521a16', trim: '#e2b45a', pants: '#2b2622', pantsD: '#1c1814', boot: '#3a2a21', hat: 'none', hatCol: '#5a1f1a', hair: 'short', beard: 'none', ...o};
 return rig(parent, R => {
  const J = R.j; J.body = joint(R.root, 0, -236);
  path(R.root, 'M-80,0 A80,12 0 1 0 80,0 A80,12 0 1 0 -80,0', '#000', 0, {opacity: .25});
  const {leg, arm} = limbs(R, c);
  [J.upperB, J.foreB] = arm(30, -132, true);
  [J.thighB, J.shinB] = leg(10, true); [J.thighF, J.shinF] = leg(-8, false);
  R.hem = g(J.body);
  if (!c.suit) {
   path(R.hem, 'M-50,-20 L-62,150 Q0,166 60,150 L48,-20 Z', c.robe, 3.5);
   path(R.hem, 'M14,-20 L22,154 Q44,156 60,150 L48,-20 Z', c.robeD, 0);
   path(R.hem, 'M-62,150 Q0,166 60,150', 'none', 7, {stroke: c.trim}); path(R.hem, 'M-62,150 Q0,166 60,150', 'none', 2);
  }
  const torso = g(J.body);
  if (c.suit) {
   path(torso, 'M-44,20 L-50,-80 L-54,-130 Q-30,-154 4,-154 Q38,-154 56,-128 L50,-80 L44,20 Z', c.robe, 3.5);
   path(torso, 'M-8,-150 L22,-150 L12,-40 L4,-40 Z', '#f6f3ec', 2.5);
   path(torso, 'M4,-140 L12,-140 L10,-70 L6,-70 Z', '#3a2a4a', 2);
   path(torso, 'M-14,-152 L6,-30 M30,-152 L12,-30', 'none', 4);
  } else {
   path(torso, 'M-48,-10 L-54,-80 L-58,-130 Q-32,-154 4,-154 Q40,-154 60,-128 L54,-80 L48,-10 Z', c.robe, 3.5);
   path(torso, 'M20,-150 Q44,-152 60,-128 L54,-80 L48,-10 L22,-10 Z', c.robeD, 0);
   // Deel-style diagonal closure with trim.
   path(torso, 'M-16,-150 Q20,-120 40,-60 L46,-10', 'none', 8, {stroke: c.trim}); path(torso, 'M-16,-150 Q20,-120 40,-60 L46,-10', 'none', 2);
   path(torso, 'M-50,-36 L52,-36 L50,-22 L-49,-22 Z', c.belt || '#3a2a1a', 2.5);
   if (c.sword) {path(torso, 'M-40,-28 L-70,90', 'none', 9, {stroke: '#3a2a1a'}); path(torso, 'M-40,-28 L-70,90', 'none', 2);}
  }
  path(torso, 'M-6,-156 L-8,-142 L18,-142 L16,-156 Z', c.skinD, 2.5);
  J.head = joint(J.body, 4, -156);
  head(R, J.head, c);
  [J.upperF, J.foreF, R.handF] = arm(-20, -130, false);
  if (c.prop === 'sword') {R.sword = g(R.handF); path(R.sword, 'M-4,10 L4,10 L6,150 L0,166 L-6,150 Z', '#c9ccd4', 2.5); path(R.sword, 'M-16,8 L16,8', 'none', 7, {stroke: '#c99a3a'});}
  if (c.prop === 'scroll') {R.scroll = g(R.handF);}
  R.hemSwing = 0;
  R.extra = t => R.hem.setAttribute('transform', `skewX(${(R.hemSwing + Math.sin(t * 2 + R.seed) * 1).toFixed(2)})`);
 });
}

// Side-view horse (facing right) with saddle cloth; legs are joints for a gallop cycle.
export function makeHorse(parent, col = '#7a4a2a', mane = '#2a1a12') {
 const Hs = {root: g(parent)};
 const legs = [[-90, 'b'], [-70, 'f'], [80, 'b'], [100, 'f']].map(([x, k]) => {const lg = joint(Hs.root, x, -150); const lower = joint(lg, 0, 70);
  path(lg, capsule(72, 30, 20), k === 'b' ? shade(col) : col, 3); path(lower, capsule(72, 18, 14), k === 'b' ? shade(col) : col, 3); path(lower, 'M-10,64 L10,64 L12,80 L-12,80 Z', '#2a2018', 2.5); return [lg, lower];});
 Hs.tail = path(Hs.root, '', mane, 3);
 path(Hs.root, 'M-120,-200 C-130,-250 -80,-262 -20,-258 L60,-258 C100,-262 120,-280 136,-310 L160,-350 C170,-366 196,-366 210,-346 L232,-310 C238,-298 226,-288 212,-292 L180,-300 C170,-270 154,-230 130,-200 C90,-150 -60,-140 -110,-170 Z', col, 3.5);
 path(Hs.root, 'M140,-312 C150,-340 160,-356 176,-362 L168,-330 L184,-336 L166,-300 Z', mane, 3);
 path(Hs.root, 'M190,-360 L196,-384 L204,-356 Z', col, 2.5);
 h('circle', {cx: 196, cy: -334, r: 4, fill: INK}, Hs.root);
 path(Hs.root, 'M-40,-262 L60,-262 L66,-200 L-46,-196 Z', '#8a2a24', 3);
 orn(Hs.root, 10, -230, 60, '#f2c255');
 path(Hs.root, 'M-30,-266 Q10,-282 50,-266', 'none', 8, {stroke: '#3a2416'});
 Hs.legs = legs;
 Hs.tick = (t, speed = 1, gallop = true) => {
  legs.forEach(([lg, lower], i) => {const ph = t * 9 * speed + (i < 2 ? 0 : 2.4) + i * .5; rot(lg, gallop ? Math.sin(ph) * 34 : Math.sin(ph * .2) * 2); rot(lower, gallop ? Math.max(0, Math.cos(ph)) * 50 : 0);});
  const w = Math.sin(t * 8 * speed);
  Hs.tail.setAttribute('d', `M-118,-220 C-170,${-220 + w * 10} -190,${-170 + w * 20} -200,${-120 + w * 26} C-176,${-150 + w * 12} -150,${-180 + w * 6} -116,-200 Z`);
 };
 Hs.tick(0, 1, false);
 return Hs;
}
function shade(hex) {const n = parseInt(hex.slice(1), 16); const f = v => Math.round(v * .72).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);}
// A rider sits on the saddle: hips at (x+10, y-262*s) of the horse.
export function mount(rider, horseX, horseY, s, flip = false, bob = 0) {
 rider.place(horseX + (flip ? -10 : 10) * s, horseY - 262 * s + 236 * s * .9 + 34 * s + bob, s * .9, flip);
 rider.pose({hipF: 82, kneeF: 86, hipB: 76, kneeB: 90, ...rider._ridePose});
}

// Crowd of simple ink silhouettes; arms can be raised (k 0..1).
export function crowd(parent, n, x0, x1, y, s = 1, seed = 3, col = '#2a1a1a') {
 const r = rand(seed), C = {root: g(parent), people: []};
 for (let i = 0; i < n; i++) {
  const p = g(C.root), x = lerp(x0, x1, i / Math.max(1, n - 1)) + (r() - .5) * 30, sc = s * (.85 + r() * .3);
  path(p, 'M-26,0 L-22,-70 Q0,-84 22,-70 L26,0 Z', col, 2.5);
  h('circle', {cx: 0, cy: -96, r: 18, fill: col, stroke: INK, 'stroke-width': 2.5}, p);
  if (r() > .5) path(p, 'M-20,-104 Q0,-136 20,-104 Z', '#4a2a1a', 2);
  const armL = path(p, 'M-18,-64 L-34,-10', 'none', 9, {stroke: col}), armR = path(p, 'M18,-64 L34,-10', 'none', 9, {stroke: col});
  C.people.push({p, x, y: y + (r() - .5) * 16, sc, armL, armR, ph: r() * 6});
 }
 C.tick = (t, raise = 0) => C.people.forEach(o => {
  tf(o.p, o.x, o.y + Math.sin(t * 3 + o.ph) * 2 * raise, 0, o.sc);
  const k = Math.max(0, raise * (.6 + .4 * Math.sin(t * 4 + o.ph)));
  o.armL.setAttribute('d', `M-18,-64 L${lerp(-34, -30, k)},${lerp(-10, -130, k)}`); o.armR.setAttribute('d', `M18,-64 L${lerp(34, 30, k)},${lerp(-10, -130, k)}`);
 });
 C.tick(0);
 return C;
}

// Banner (туғ) with waving cloth or horsetail plumes.
export function banner(parent, x, y, {col = '#f4efe2', tails = 0, h: ht = 360} = {}) {
 const B = {root: g(parent)}; tf(B.root, x, y);
 path(B.root, `M-4,0 L4,0 L4,${-ht} L-4,${-ht} Z`, '#5a3a1a', 2.5);
 path(B.root, `M0,${-ht - 30} L10,${-ht} L-10,${-ht} Z`, '#c99a3a', 2.5);
 B.cloth = path(B.root, '', col, 3);
 B.tails = Array.from({length: tails}, () => path(B.root, '', col, 2.5));
 B.tick = t => {
  if (tails) B.tails.forEach((p, i) => {const a = -ht + 10 + i * 6, w = Math.sin(t * 5 + i) * 10; p.setAttribute('d', `M-6,${a} C-30,${a + 60 + w} -10,${a + 140} ${-24 + w},${a + 200} C-6,${a + 150} 6,${a + 80} 6,${a}Z`);});
  else {let top = `M4,${-ht + 10}`, bot = ''; for (let k = 0; k <= 6; k++) {const xx = 4 + k * 26, yy = -ht + 10 + Math.sin(t * 4 - k * .8) * 8 * (k / 6); top += ` L${xx},${yy}`; bot = ` L${xx},${yy + 100 - k * 4}` + bot;} B.cloth.setAttribute('d', top + bot + ` L4,${-ht + 110}Z`);}
 };
 B.tick(0);
 return B;
}

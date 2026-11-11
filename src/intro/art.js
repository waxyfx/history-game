// Vector "graphic novel" art kit for the intro: ink outlines, flat cel shading, halftone shadows.
// Characters are rigs (nested joint groups) so the same model is reused in every shot → consistent look.

export const NS = 'http://www.w3.org/2000/svg';
export const INK = '#0c0a0b';
export function h(tag, attrs = {}, parent) {
 const e = document.createElementNS(NS, tag);
 for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
 parent?.appendChild(e);
 return e;
}
export const g = (parent, attrs) => h('g', attrs, parent);
export const path = (parent, d, fill = 'none', sw = 3, extra = {}) =>
 h('path', {d, fill, stroke: sw ? INK : 'none', 'stroke-width': sw || null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...extra}, parent);
export const tf = (el, x = 0, y = 0, r = 0, sx = 1, sy = sx) => el.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${r.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = k => (k = clamp(k), k < .5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const easeOut = k => 1 - (1 - clamp(k)) ** 3;
export const easeIn = k => clamp(k) ** 3;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
// Deterministic pseudo-random (art must look identical every viewing).
export function rand(seed) {let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;}

// Shared <defs>: halftone screens, glows, ornament symbol.
export function defs(svg) {
 const d = h('defs', {}, svg);
 const dots = (id, r, size, color, rot = 45) => {const p = h('pattern', {id, width: size, height: size, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${rot})`}, d); h('circle', {cx: size / 2, cy: size / 2, r, fill: color}, p);};
 dots('tj-ht', 1.7, 7, '#000');
 dots('tj-ht2', 2.6, 9, '#000');
 dots('tj-htl', 1.5, 7, '#fff');
 const radial = (id, stops, attrs = {}) => {const r = h('radialGradient', {id, ...attrs}, d); stops.forEach(([o, c, a = 1]) => h('stop', {offset: o, 'stop-color': c, 'stop-opacity': a}, r)); return r;};
 const linear = (id, stops, x2 = 0, y2 = 1) => {const l = h('linearGradient', {id, x1: 0, y1: 0, x2, y2}, d); stops.forEach(([o, c, a = 1]) => h('stop', {offset: o, 'stop-color': c, 'stop-opacity': a}, l)); return l;};
 radial('tj-glow', [[0, '#fff', 1], [.25, '#9ffcff', .9], [.6, '#2fd6e6', .35], [1, '#0a6a7a', 0]]);
 radial('tj-glow-v', [[0, '#fff', 1], [.25, '#ff9ee8', .9], [.6, '#9b2cff', .45], [1, '#3a0a5a', 0]]);
 radial('tj-glow-g', [[0, '#fffbe6', 1], [.3, '#ffd77a', .85], [.7, '#e59b2e', .25], [1, '#a35a10', 0]]);
 radial('tj-glow-r', [[0, '#ffd0d0', .9], [.4, '#ff2b45', .45], [1, '#ff2b45', 0]]);
 radial('tj-vig', [[.55, '#000', 0], [1, '#000', .75]]);
 linear('tj-sky-city', [[0, '#081428'], [.45, '#22345e'], [.78, '#a0566a'], [1, '#f2a35e']]);
 linear('tj-sky-dawn', [[0, '#27355f'], [.38, '#6a5d8e'], [.68, '#e98f6a'], [.88, '#f8cf8e'], [1, '#fbe6b4']]);
 linear('tj-wall', [[0, '#0b1f26'], [1, '#123842']]);
 linear('tj-floor', [[0, '#123139'], [1, '#050d10']]);
 linear('tj-holo', [[0, '#7ff5ff', .55], [1, '#2bb7d0', .12]]);
 linear('tj-beam', [[0, '#ffe7a0', 0], [.5, '#ffe7a0', .55], [1, '#ffe7a0', 0]], 1, 0);
 // Қошқар мүйіз (ram's horn) ornament — the visual motif of the Institute and the Chronicle.
 const orn = h('symbol', {id: 'tj-orn', viewBox: '-40 -22 80 44'}, d);
 path(orn, 'M0,18 C0,4 -6,-4 -16,-4 C-26,-4 -30,6 -24,12 C-19,16 -13,11 -16,6 M0,18 C0,4 6,-4 16,-4 C26,-4 30,6 24,12 C19,16 13,11 16,6 M0,18 V-18 M-8,-12 C-4,-20 4,-20 8,-12', 'none', 4, {stroke: 'currentColor'});
 return d;
}
export const orn = (parent, x, y, w, color, extra = {}) => h('use', {href: '#tj-orn', x: x - w / 2, y: y - w * .275, width: w, height: w * .55, style: `color:${color}`, ...extra}, parent);

// Simple jagged lightning bolt between two points.
export function bolt(x1, y1, x2, y2, rnd, parts = 9, amp = 28) {
 let d = `M${x1},${y1}`; const nx = -(y2 - y1), ny = x2 - x1, L = Math.hypot(nx, ny) || 1;
 for (let i = 1; i < parts; i++) {const k = i / parts, o = (rnd() - .5) * amp * 2 * Math.sin(Math.PI * k); d += ` L${(x1 + (x2 - x1) * k + nx / L * o).toFixed(1)},${(y1 + (y2 - y1) * k + ny / L * o).toFixed(1)}`;}
 return d + ` L${x2},${y2}`;
}

// Comic speed lines radiating from a focus (static shape, jittered per frame by the scene).
export function speedLines(parent, cx, cy, r0, r1, n, color = '#fff', seed = 3) {
 const r = rand(seed); let d = '';
 for (let i = 0; i < n; i++) {
  const a = r() * Math.PI * 2, w = .004 + r() * .012, rr = r0 + r() * (r1 - r0) * .4;
  d += `M${cx + Math.cos(a - w) * r1},${cy + Math.sin(a - w) * r1} L${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr} L${cx + Math.cos(a + w) * r1},${cy + Math.sin(a + w) * r1}Z`;
 }
 return path(parent, d, color, 0);
}

// ─────────────────────────── CHARACTER RIGS ───────────────────────────
const capsule = (len, w1, w2) => {const a = w1 / 2, b = w2 / 2; return `M${-a},0 L${-b},${len} A${b},${b} 0 0 0 ${b},${len} L${a},0 A${a},${a} 0 0 0 ${-a},0Z`;};
function joint(parent, x, y) {const j = g(parent); j.px = x; j.py = y; j.setAttribute('transform', `translate(${x} ${y})`); return j;}
const rot = (j, a) => j.setAttribute('transform', `translate(${j.px} ${j.py}) rotate(${a.toFixed(2)})`);

function makeRig(parent, build) {
 const root = g(parent), R = {root, j: {}, mouths: {}, mood: {brow: 0, mouth: 'closed', look: [0, 0], blink: 0}, talking: false, seed: Math.random() * 10};
 R.place = (x, y, s = 1, flip = false, r = 0) => root.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(2)}) scale(${flip ? -s : s} ${s})`);
 // Angles: positive = forward swing (towards facing direction); knees/elbows positive = natural bend.
 R.pose = p => {
  const J = R.j, v = k => p[k] ?? 0;
  rot(J.body, v('lean')); rot(J.head, v('head'));
  rot(J.thighB, -v('hipB')); rot(J.shinB, v('kneeB')); rot(J.thighF, -v('hipF')); rot(J.shinF, v('kneeF'));
  rot(J.upperB, -v('shB')); rot(J.foreB, -v('elB')); rot(J.upperF, -v('shF')); rot(J.foreF, -v('elF'));
  if (J.handF) rot(J.handF, -v('wrF')); if (J.handB) rot(J.handB, -v('wrB'));
  if (p.y != null) J.body.setAttribute('transform', `translate(${J.body.px} ${J.body.py + p.y}) rotate(${v('lean')})`);
 };
 R.face = f => Object.assign(R.mood, f);
 R.tick = (t, talking) => {
  const m = R.mood;
  for (const k in R.mouths) R.mouths[k].style.display = 'none';
  let mouth = m.mouth;
  if (talking) {const ph = Math.sin(t * 23 + Math.sin(t * 7) * 2); mouth = ph > .35 ? (m.mouth === 'shout' ? 'shout' : 'open') : ph > -.3 ? 'mid' : m.mouth === 'shout' ? 'mid' : 'closed';}
  (R.mouths[mouth] || R.mouths.closed).style.display = '';
  const cycle = (t + R.seed) % 4.2, blink = m.blink || (cycle < .13 ? 1 : 0);
  R.eyesOpen.style.display = blink > .5 ? 'none' : ''; R.eyesShut.style.display = blink > .5 ? '' : 'none';
  R.irises.setAttribute('transform', `translate(${m.look[0]} ${m.look[1]})`);
  R.brows.forEach((b, i) => b.setAttribute('transform', `translate(0 ${(-m.brow * 3).toFixed(1)}) rotate(${(m.brow * (i ? 9 : -9)).toFixed(1)} ${b.cx} ${b.cy})`));
  R.extra?.(t, talking);
 };
 build(R);
 return R;
}

const HERO = {skin: '#c98a5f', skinD: '#9c6142', hair: '#17110f', hairH: '#33525a', jacket: '#1f5e5f', jacketD: '#123c40', trim: '#e2b45a',
 pants: '#2b303c', pantsD: '#1a1e27', boot: '#3a2a21', scarf: '#e98a2f', scarfD: '#b4561a', device: '#7ff5e4'};

function leg(R, parent, x, c, back) {
 const thigh = joint(parent, x, 0), shin = joint(thigh, 0, 112);
 path(thigh, capsule(112, 40, 32), back ? c.pantsD : c.pants);
 path(shin, capsule(108, 32, 26), back ? c.pantsD : c.pants);
 path(shin, 'M-17,70 L15,70 L16,108 L38,112 Q44,122 36,126 L-17,126 Z', back ? '#271c16' : c.boot);
 path(shin, 'M-15,78 L14,78', 'none', 2.5);
 return [thigh, shin];
}
function arm(R, parent, x, y, c, back, {sleeve, sleeveD, cuff, skin, skinD, glove}) {
 const up = joint(parent, x, y), fore = joint(up, 0, 90), hand = joint(fore, 0, 80);
 path(up, capsule(92, 36, 30), back ? sleeveD : sleeve);
 path(fore, capsule(80, 30, 25), back ? sleeveD : sleeve);
 if (cuff) path(fore, 'M-14,62 L14,62 L13,76 L-13,76 Z', cuff, 2.5);
 const hf = glove || (back ? skinD : skin);
 path(hand, 'M-12,-4 C-15,8 -14,22 -6,30 C0,34 8,32 12,24 C15,14 14,2 11,-4 Z', hf);
 path(hand, 'M10,6 C17,8 20,16 15,20', hf, 2.5);
 path(hand, 'M-6,16 L-6,28 M0,18 L0,31 M6,16 L6,28', 'none', 1.8);
 return [up, fore, hand];
}

export function makeHero(parent) {
 const c = HERO;
 return makeRig(parent, R => {
  const J = R.j, root = R.root;
  path(root, 'M-70,0 A70,12 0 1 0 70,0 A70,12 0 1 0 -70,0', '#000', 0, {opacity: .28});
  J.body = joint(root, 0, -230);
  [J.upperB, J.foreB, J.handB] = arm(R, J.body, 34, -128, c, true, {sleeve: c.jacket, sleeveD: c.jacketD, cuff: '#0e2a2d', skin: c.skin, skinD: c.skinD});
  [J.thighB, J.shinB] = leg(R, J.body, 10, c, true);
  [J.thighF, J.shinF] = leg(R, J.body, -6, c, false);
  // Jacket torso + gold ornamental trim along the front edge and hem.
  const torso = g(J.body);
  path(torso, 'M-40,22 L-46,-60 L-52,-122 Q-30,-150 4,-150 Q38,-150 56,-124 L50,-60 L44,22 Z', c.jacket);
  path(torso, 'M18,-144 Q40,-148 56,-124 L50,-60 L44,22 L16,22 Z', c.jacketD, 0);
  path(torso, 'M18,-144 Q40,-148 56,-124 L50,-60 L44,22 L16,22 Z', 'url(#tj-ht)', 0, {opacity: .35});
  path(torso, 'M-40,22 L-46,-60 L-52,-122 Q-30,-150 4,-150 Q38,-150 56,-124 L50,-60 L44,22 Z', 'none', 3.5);
  path(torso, 'M-30,-96 Q-20,-70 -24,-40 M-36,-128 Q-14,-112 -2,-120', 'none', 2, {opacity: .55});
  path(torso, 'M12,-136 L14,-60 L12,22', 'none', 7, {stroke: c.trim});
  path(torso, 'M12,-136 L14,-60 L12,22', 'none', 2);
  path(torso, 'M-40,12 L44,12', 'none', 6, {stroke: c.trim});
  for (const y of [-110, -76, -42, -8]) orn(torso, 13, y, 18, '#7a4f12');
  path(torso, 'M-44,-30 L47,-30 L46,-18 L-43,-18 Z', '#2a2018', 2.5);
  path(torso, 'M4,-30 L20,-30 L20,-18 L4,-18 Z', c.trim, 2);
  // Neck.
  path(torso, 'M-6,-150 L-8,-136 L18,-136 L16,-150 Z', c.skinD, 2.5);
  // Head (pivot at the top of the neck).
  J.head = joint(J.body, 4, -150);
  const H = J.head;
  path(H, 'M-8,0 L-10,-18 L14,-18 L14,0 Z', c.skinD, 0);
  path(H, 'M-26,-30 C-36,-50 -36,-80 -14,-92 C6,-102 30,-94 36,-74 L38,-58 L46,-44 L39,-40 L39,-33 L36,-27 C36,-15 27,-7 14,-5 L-8,-16 Z', c.skin, 3.5);
  path(H, 'M-26,-30 C-32,-46 -26,-62 -16,-70 L-8,-44 L-8,-16 Z', c.skinD, 0, {opacity: .85});
  path(H, 'M-17,-58 C-26,-60 -27,-38 -16,-36 C-12,-40 -12,-54 -17,-58Z', c.skin, 2.5);
  path(H, 'M-18,-52 C-21,-48 -20,-42 -16,-41', 'none', 1.8);
  path(H, 'M38,-42 Q35,-41 33,-43', 'none', 2);
  path(H, 'M30,-20 Q24,-14 18,-16', 'none', 1.5, {opacity: .5});
  // Eyes.
  R.eyesOpen = g(H); R.eyesShut = g(H);
  path(R.eyesOpen, 'M3,-57 Q11,-64 19,-57 Q11,-52 3,-57Z', '#f6efe4', 2);
  path(R.eyesOpen, 'M26,-57 Q31,-62 36,-58 Q31,-54 26,-57Z', '#f6efe4', 2);
  R.irises = g(R.eyesOpen);
  h('circle', {cx: 12, cy: -57.5, r: 3.8, fill: '#2a1810'}, R.irises); h('circle', {cx: 31.5, cy: -57.8, r: 2.8, fill: '#2a1810'}, R.irises);
  h('circle', {cx: 13.2, cy: -59, r: 1.2, fill: '#fff'}, R.irises);
  path(R.eyesOpen, 'M2,-57 Q11,-65 20,-58 M25,-57 Q31,-63 37,-58', 'none', 3.2);
  path(R.eyesShut, 'M3,-56 Q11,-52 19,-56 M26,-57 Q31,-54 36,-57', 'none', 3);
  R.brows = [path(H, 'M0,-66 Q10,-72 20,-67', 'none', 5), path(H, 'M25,-67 Q31,-71 37,-66', 'none', 4.5)];
  R.brows[0].cx = 10; R.brows[0].cy = -68; R.brows[1].cx = 31; R.brows[1].cy = -68;
  // Mouths.
  const M = R.mouths;
  M.closed = path(H, 'M25,-31 Q31,-29.5 36,-31.5', 'none', 2.5);
  M.smile = path(H, 'M24,-32 Q31,-26 37,-33', 'none', 2.5);
  M.mid = path(H, 'M25,-32 Q31,-31 36,-32 Q31,-26 25,-32Z', '#4a1d16', 2.2);
  M.open = path(H, 'M24,-33 Q31,-32 37,-33 Q34,-22 27,-23 Q24,-27 24,-33Z', '#4a1d16', 2.2);
  M.grit = g(H); path(M.grit, 'M23,-34 L37,-34 L36,-26 L24,-26 Z', '#f2ece0', 2.2); path(M.grit, 'M23,-30 L37,-30', 'none', 1.5);
  M.shout = g(H); path(M.shout, 'M22,-36 Q31,-36 39,-35 Q37,-17 28,-17 Q21,-22 22,-36Z', '#3e130f', 2.5); path(M.shout, 'M24,-35 L38,-34 L37,-31 L24,-32Z', '#f2ece0', 0);
  // Hair.
  path(H, 'M-30,-40 C-46,-66 -32,-104 2,-106 C26,-110 46,-98 46,-80 L56,-84 L46,-72 L52,-68 L38,-64 C32,-72 22,-78 10,-77 L6,-68 L0,-77 C-8,-74 -12,-64 -13,-52 L-20,-40 Z', c.hair, 3.5);
  path(H, 'M-16,-90 C-2,-100 18,-100 30,-92', 'none', 4, {stroke: c.hairH, opacity: .9});
  path(H, 'M-24,-74 C-18,-86 -8,-92 4,-94', 'none', 3, {stroke: c.hairH, opacity: .6});
  // Scarf: collar wrap + a flowing tail whose path is regenerated every frame.
  const scarf = g(J.body);
  R.scarfTail = path(scarf, '', c.scarf, 3);
  path(scarf, 'M-20,-152 Q6,-140 30,-150 L34,-134 Q6,-122 -24,-136 Z', c.scarf, 3);
  path(scarf, 'M-22,-140 Q6,-130 32,-140', 'none', 2, {stroke: c.scarfD});
  J.body.insertBefore(scarf, J.head);
  J.body.insertBefore(R.scarfTail, J.body.firstChild);
  // Front arm with wrist device (drawn last, over the torso).
  [J.upperF, J.foreF, J.handF] = arm(R, J.body, -22, -124, c, false, {sleeve: c.jacket, sleeveD: c.jacketD, cuff: '#0e2a2d', skin: c.skin, skinD: c.skinD});
  R.device = h('rect', {x: -14, y: 44, width: 28, height: 16, rx: 4, fill: c.device, stroke: INK, 'stroke-width': 2.5}, J.foreF);
  R.deviceGlow = h('circle', {cx: 0, cy: 52, r: 22, fill: 'url(#tj-glow)', opacity: .5}, J.foreF);
  R.wind = 0.3;
  R.extra = t => {
   // Scarf tail flutters behind the hero; wind 0 = hanging, 1 = streaming horizontally.
   const w = R.wind, pts = [];
   for (let i = 0; i <= 6; i++) {
    const k = i / 6, len = 34 + 150 * k;
    const ang = lerp(80, 172, w) * Math.PI / 180 + Math.sin(t * (6 + w * 8) - k * 5) * (.08 + w * .18) * k;
    pts.push([-14 + Math.cos(ang) * len, -142 + Math.sin(ang) * len]);
   }
   let top = 'M-14,-146', bot = '';
   pts.forEach(([x, y], i) => {const wdt = 13 - i * 1.3; top += ` L${(x).toFixed(1)},${(y - wdt).toFixed(1)}`; bot = ` L${(x).toFixed(1)},${(y + wdt).toFixed(1)}` + bot;});
   R.scarfTail.setAttribute('d', top + bot + ' L-14,-130 Z');
  };
  R.pose({});
 });
}

const VIL = {skin: '#c2b1a2', skinD: '#8e7b6d', hair: '#cfcbc6', coat: '#2c1631', coatD: '#170a1b', trim: '#d4214f', pants: '#1b1620', boot: '#141016', glove: '#151217', eye: '#ff2e88'};

export function makeVillain(parent) {
 const c = VIL;
 return makeRig(parent, R => {
  const J = R.j, root = R.root;
  path(root, 'M-80,0 A80,12 0 1 0 80,0 A80,12 0 1 0 -80,0', '#000', 0, {opacity: .3});
  J.body = joint(root, 0, -252);
  [J.upperB, J.foreB, J.handB] = arm(R, J.body, 26, -150, c, true, {sleeve: c.coat, sleeveD: c.coatD, cuff: c.trim, glove: c.glove});
  const lc = {pants: c.pants, pantsD: '#110d15', boot: c.boot};
  [J.thighB, J.shinB] = leg(R, J.body, 10, lc, true);
  [J.thighF, J.shinF] = leg(R, J.body, -8, lc, false);
  J.thighB.querySelectorAll('path')[0].setAttribute('d', capsule(124, 36, 30)); J.shinB.py = J.shinF.py = 124;
  J.thighF.querySelectorAll('path')[0].setAttribute('d', capsule(124, 36, 30));
  // Long coat: torso + swinging skirt (hem) group.
  R.hem = g(J.body);
  path(R.hem, 'M-46,-20 L-62,150 Q-10,166 54,150 L44,-20 Z', c.coat, 3.5);
  path(R.hem, 'M12,-20 L22,152 Q40,156 54,150 L44,-20 Z', c.coatD, 0);
  path(R.hem, 'M-62,150 Q-10,166 54,150', 'none', 6, {stroke: c.trim});
  path(R.hem, 'M10,-20 L18,154', 'none', 3);
  const torso = g(J.body);
  path(torso, 'M-46,-10 L-52,-80 L-58,-148 Q-30,-170 6,-168 Q42,-170 60,-146 L52,-80 L44,-10 Z', c.coat, 3.5);
  path(torso, 'M20,-166 Q44,-166 60,-146 L52,-80 L44,-10 L22,-10 Z', c.coatD, 0);
  path(torso, 'M20,-166 Q44,-166 60,-146 L52,-80 L44,-10 L22,-10 Z', 'url(#tj-ht2)', 0, {opacity: .3});
  path(torso, 'M-46,-10 L-52,-80 L-58,-148 Q-30,-170 6,-168 Q42,-170 60,-146 L52,-80 L44,-10 Z', 'none', 3.5);
  path(torso, 'M10,-160 L16,-10', 'none', 3);
  for (const y of [-130, -100, -70, -40]) h('circle', {cx: 20, cy: y, r: 3.6, fill: '#b8b4c4', stroke: INK, 'stroke-width': 1.5}, torso);
  path(torso, 'M-58,-148 Q-30,-170 6,-168 L2,-150 Q-30,-152 -52,-132 Z', c.trim, 2.5);
  // Tall villain collar behind the head.
  R.collar = path(J.body, 'M-50,-148 L-66,-240 L-28,-182 L36,-182 L62,-234 L56,-148 Z', '#3d1e45', 3.5);
  path(J.body, 'M-50,-148 L-66,-240 L-28,-182 M36,-182 L62,-234 L56,-148', 'none', 4, {stroke: c.trim});
  path(J.body, 'M-40,-160 L-52,-214 L-26,-176 Z M42,-176 L54,-210 L48,-160 Z', '#1a0a20', 0);
  path(J.body, 'M-6,-176 L-6,-160 L16,-160 L16,-176 Z', c.skinD, 2.5);
  J.head = joint(J.body, 4, -174);
  const H = J.head;
  path(H, 'M-24,-34 C-34,-60 -30,-98 -6,-108 C18,-116 38,-102 40,-82 L41,-64 L52,-47 L43,-43 L43,-34 L39,-28 L36,-12 L25,-1 L8,-4 L-8,-22 Z', c.skin, 3.5);
  path(H, 'M-24,-34 C-30,-52 -26,-70 -14,-80 L-6,-46 L-8,-22 Z', c.skinD, 0, {opacity: .9});
  path(H, 'M14,-44 L26,-26 M33,-40 Q37,-39 39,-42', 'none', 2);
  path(H, 'M-14,-62 C-24,-62 -24,-42 -14,-40 C-10,-44 -10,-56 -14,-62Z', c.skin, 2.5);
  // Goatee + thin moustache.
  path(H, 'M27,-26 L41,-27 L37,4 L31,-4 Z', c.hair, 2.5);
  path(H, 'M29,-33 Q36,-36 44,-32', 'none', 2.5, {stroke: '#8d8a87'});
  R.eyesOpen = g(H); R.eyesShut = g(H);
  // Cybernetic implant around the near eye.
  path(R.eyesOpen, 'M0,-72 L22,-74 L24,-52 L6,-50 L-2,-58 Z', '#59506a', 2.5);
  h('circle', {cx: 2, cy: -70, r: 1.6, fill: '#ccc'}, R.eyesOpen); h('circle', {cx: 20, cy: -54, r: 1.6, fill: '#ccc'}, R.eyesOpen);
  R.implant = h('circle', {cx: 12, cy: -62, r: 6.5, fill: c.eye, stroke: INK, 'stroke-width': 2}, R.eyesOpen);
  R.implantGlow = h('circle', {cx: 12, cy: -62, r: 22, fill: 'url(#tj-glow-v)', opacity: .7}, R.eyesOpen);
  path(R.eyesOpen, 'M28,-62 Q32,-65 37,-62 Q32,-60 28,-62Z', '#efe6da', 2);
  R.irises = g(R.eyesOpen); h('circle', {cx: 33, cy: -62.2, r: 2.2, fill: '#1a1a1a'}, R.irises);
  path(R.eyesShut, 'M28,-61 Q32,-59 37,-61', 'none', 2.5);
  h('circle', {cx: 12, cy: -62, r: 6.5, fill: '#7a1747', stroke: INK, 'stroke-width': 2}, R.eyesShut);
  R.brows = [path(H, 'M-2,-80 L22,-72', 'none', 5.5, {stroke: '#8d8a87'}), path(H, 'M27,-70 L39,-76', 'none', 5, {stroke: '#8d8a87'})];
  R.brows[0].cx = 10; R.brows[0].cy = -76; R.brows[1].cx = 33; R.brows[1].cy = -73;
  const M = R.mouths;
  M.closed = path(H, 'M27,-30 Q33,-29 39,-31', 'none', 2.5);
  M.smirk = path(H, 'M26,-30 Q33,-29 40,-36', 'none', 3);
  M.mid = path(H, 'M27,-31 Q33,-31 39,-32 Q34,-25 27,-31Z', '#3a0f1a', 2.2);
  M.open = path(H, 'M26,-32 Q33,-32 40,-33 Q37,-20 29,-21 Q26,-25 26,-32Z', '#3a0f1a', 2.2);
  M.shout = g(H); path(M.shout, 'M24,-35 Q33,-35 42,-34 Q40,-14 30,-14 Q23,-20 24,-35Z', '#300a14', 2.5); path(M.shout, 'M26,-34 L41,-33 L40,-30 L26,-31Z', '#eee', 0);
  M.grit = g(H); path(M.grit, 'M25,-34 L40,-34 L39,-25 L26,-25 Z', '#eee', 2.2); path(M.grit, 'M25,-29.5 L40,-29.5', 'none', 1.5);
  // Slicked-back grey hair with a white streak.
  path(H, 'M-28,-40 C-42,-72 -28,-112 4,-116 C28,-120 44,-106 42,-88 C30,-98 10,-100 -4,-94 C-14,-88 -18,-72 -17,-54 Z', c.hair, 3.5);
  path(H, 'M-20,-80 C-14,-98 4,-108 26,-104', 'none', 5, {stroke: '#fff'});
  path(H, 'M-26,-62 C-26,-80 -18,-94 -4,-102 M-10,-50 C-14,-70 -6,-86 10,-94', 'none', 2, {stroke: '#8d8a87'});
  // Front arm (gloved) — holds the Time Key in some shots.
  [J.upperF, J.foreF, J.handF] = arm(R, J.body, -16, -146, c, false, {sleeve: c.coat, sleeveD: c.coatD, cuff: c.trim, glove: c.glove});
  R.key = g(J.handF, {style: 'display:none'});
  path(R.key, 'M-3,10 L3,10 L3,70 L-3,70 Z', '#9b98a8', 2.5);
  path(R.key, 'M0,62 L10,78 L0,100 L-10,78 Z', '#ff3d9a', 2.5);
  h('circle', {cx: 0, cy: 80, r: 26, fill: 'url(#tj-glow-v)', opacity: .8}, R.key);
  R.mood.mouth = 'smirk';
  R.coatSwing = 0;
  R.extra = t => {
   R.hem.setAttribute('transform', `skewX(${(R.coatSwing + Math.sin(t * 2.2 + R.seed) * 1.2).toFixed(2)})`);
   const p = .55 + .45 * Math.sin(t * 5);
   R.implantGlow.setAttribute('opacity', (.45 + p * .4).toFixed(2));
  };
  R.pose({});
 });
}

// Back view of the hero for the final "over the shoulder" shot (same palette, scarf, ornament).
export function makeHeroBack(parent) {
 const c = HERO, root = g(parent), R = {root};
 path(root, 'M-26,-230 L-30,-6 L-6,-6 L0,-150 L6,-6 L30,-6 L26,-230 Z', c.pants, 3.5);
 path(root, 'M-34,-16 L-4,-16 L-4,0 L-38,0 Z M4,-16 L34,-16 L38,0 L4,0 Z', c.boot, 3);
 R.armL = g(root); path(R.armL, capsule(170, 34, 26), c.jacketD); tf(R.armL, -44, -364, 8);
 R.armR = g(root); path(R.armR, capsule(170, 34, 26), c.jacketD); tf(R.armR, 44, -364, -8);
 path(root, 'M-46,-210 L-50,-300 L-52,-362 Q-26,-384 0,-384 Q26,-384 52,-362 L50,-300 L46,-210 Z', c.jacket, 3.5);
 path(root, 'M-46,-222 L46,-222', 'none', 7, {stroke: c.trim});
 // Institute emblem on the back: шаңырақ (yurt crown) lattice.
 h('circle', {cx: 0, cy: -300, r: 26, fill: 'none', stroke: c.trim, 'stroke-width': 4}, root);
 path(root, 'M-26,-300 L26,-300 M0,-326 L0,-274 M-18,-318 Q0,-300 18,-318 M-18,-282 Q0,-300 18,-282', 'none', 3, {stroke: c.trim});
 for (const x of [-30, 0, 30]) orn(root, x, -236, 26, c.trim);
 path(root, 'M-14,-388 L-16,-372 L16,-372 L14,-388 Z', c.skinD, 2.5);
 path(root, 'M-30,-404 Q0,-388 30,-404 L32,-382 Q0,-368 -32,-382 Z', c.scarf, 3);
 R.tail = path(root, '', c.scarf, 3);
 path(root, 'M-30,-410 C-40,-450 -20,-478 4,-476 C30,-476 42,-450 30,-410 C20,-402 -20,-402 -30,-410Z', c.hair, 3.5);
 path(root, 'M-20,-470 L-26,-484 L-10,-474 L-2,-490 L6,-474 L20,-484 L18,-468', c.hair, 3);
 path(root, 'M-36,-430 C-42,-424 -40,-412 -32,-410 M36,-430 C42,-424 40,-412 32,-410', c.skin, 2.5);
 R.tick = t => {
  let top = 'M20,-396', bot = '';
  for (let i = 0; i <= 6; i++) {const k = i / 6, x = 20 + k * 150, y = -396 + k * 40 + Math.sin(t * 7 - k * 5) * 14 * k, w = 12 - i * 1.2; top += ` L${x.toFixed(1)},${(y - w).toFixed(1)}`; bot = ` L${x.toFixed(1)},${(y + w).toFixed(1)}` + bot;}
  R.tail.setAttribute('d', top + bot + ' L20,-382 Z');
 };
 R.place = (x, y, s = 1, r = 0) => tf(root, x, y, r, s);
 return R;
}

// ─────────────────────────── PROPS ───────────────────────────
// The Chronicle (Шежіре): leather-bound book with gold ornament; open = glowing pages.
export function makeBook(parent, open = false) {
 const B = {root: g(parent)};
 B.glow = h('circle', {cx: 0, cy: -10, r: 150, fill: 'url(#tj-glow-g)', opacity: .7}, B.root);
 if (open) {
  path(B.root, 'M-110,10 L-4,26 L-4,-50 L-100,-70 Z', '#5b3416', 3);
  path(B.root, 'M110,10 L4,26 L4,-50 L100,-70 Z', '#5b3416', 3);
  B.left = path(B.root, 'M-98,0 L-4,16 L-4,-58 L-90,-76 Z', '#fbe9bd', 3);
  B.right = path(B.root, 'M98,0 L4,16 L4,-58 L90,-76 Z', '#fbe9bd', 3);
  path(B.root, 'M-80,-56 L-20,-44 M-82,-44 L-22,-32 M-84,-32 L-24,-20 M80,-56 L20,-44 M82,-44 L22,-32 M84,-32 L24,-20', 'none', 2, {stroke: '#a77b3a'});
  orn(B.root, -50, -12, 34, '#b8782a'); orn(B.root, 50, -12, 34, '#b8782a');
 } else {
  path(B.root, 'M-70,-48 L70,-48 L74,46 L-74,46 Z', '#5b3416', 3.5);
  path(B.root, 'M-70,40 L74,40 L74,52 L-70,52 Z', '#fbe9bd', 2.5);
  path(B.root, 'M-58,-36 L58,-36 L60,32 L-60,32 Z', 'none', 3, {stroke: '#e2b45a'});
  orn(B.root, 0, -2, 70, '#e2b45a');
 }
 return B;
}
export function makePage(parent, glyph) {
 const P = g(parent);
 h('circle', {r: 46, fill: 'url(#tj-glow-g)', opacity: .8}, P);
 path(P, 'M-22,-28 L22,-28 L22,28 L-22,28 Z', '#fbe9bd', 2.5);
 const t = h('text', {x: 0, y: 9, 'text-anchor': 'middle', 'font-size': 26, fill: '#a3631e', 'font-family': 'Georgia,serif'}, P); t.textContent = glyph;
 return P;
}
let uid = 0;
export const nextId = p => p + (++uid);
export const GLYPHS = ['◈', '◇', '✧', '↟', 'ᛉ', '☼', '⌁', '⌂', '♜', '❋'];

// The Time Gate: dais, pylons, two counter-rotating rings, glowing core.
export function makeGate(parent, x, y, r = 250) {
 const G = {root: g(parent)};
 tf(G.root, x, y);
 G.halo = h('circle', {r: r * 1.7, fill: 'url(#tj-glow)', opacity: .35}, G.root);
 path(G.root, `M${-r * 1.1},${r * .92} L${r * 1.1},${r * .92} L${r * 1.25},${r * 1.12} L${-r * 1.25},${r * 1.12} Z`, '#15333a', 3.5);
 path(G.root, `M${-r * .9},${r * .78} L${r * .9},${r * .78} L${r * 1.1},${r * .92} L${-r * 1.1},${r * .92} Z`, '#1d4650', 3.5);
 for (const s of [-1, 1]) {
  path(G.root, `M${s * r * 1.02},${r * .9} L${s * r * 1.12},${-r * .5} L${s * r * 1.26},${-r * .5} L${s * r * 1.22},${r * .9} Z`, '#183b44', 3.5);
  path(G.root, `M${s * r * 1.14},${-r * .3} L${s * r * 1.21},${-r * .3} L${s * r * 1.19},${r * .7} L${s * r * 1.15},${r * .7} Z`, '#6ff3ff', 0, {opacity: .8});
 }
 G.core = h('circle', {r: r * .78, fill: 'url(#tj-glow)'}, G.root);
 G.swirl = g(G.root);
 const sw = rand(7);
 for (let i = 0; i < 7; i++) {const a = i / 7 * 360, rr = r * (.25 + sw() * .45); path(G.swirl, `M0,0 Q${rr},${-rr * .6} ${rr * .9},${rr * .5}`, 'none', 3, {stroke: '#fff', opacity: .55, transform: `rotate(${a})`});}
 G.outer = g(G.root);
 h('circle', {r, fill: 'none', stroke: INK, 'stroke-width': 46}, G.outer);
 h('circle', {r, fill: 'none', stroke: '#2a5862', 'stroke-width': 38}, G.outer);
 h('circle', {r, fill: 'none', stroke: '#d7a94e', 'stroke-width': 4, 'stroke-dasharray': '30 18'}, G.outer);
 for (let i = 0; i < 12; i++) {const a = i * 30; const n = g(G.outer, {transform: `rotate(${a})`}); path(n, `M-9,${-r - 24} L9,${-r - 24} L7,${-r + 22} L-7,${-r + 22} Z`, '#173840', 3);}
 G.inner = g(G.root);
 h('circle', {r: r * .8, fill: 'none', stroke: INK, 'stroke-width': 26}, G.inner);
 h('circle', {r: r * .8, fill: 'none', stroke: '#173840', 'stroke-width': 20}, G.inner);
 GLYPHS.forEach((s, i) => {const a = i / 10 * Math.PI * 2; const t = h('text', {x: Math.cos(a) * r * .8, y: Math.sin(a) * r * .8 + 7, 'text-anchor': 'middle', 'font-size': 20, fill: '#7ff5ff', 'font-family': 'Georgia,serif'}, G.inner); t.textContent = s;});
 G.set = (t, power = .4, mode = 'calm') => {
  const sp = 8 + power * 120;
  G.outer.setAttribute('transform', `rotate(${(t * sp) % 360})`);
  G.inner.setAttribute('transform', `rotate(${(-t * sp * 1.6) % 360})`);
  G.swirl.setAttribute('transform', `rotate(${(t * sp * 3) % 360}) scale(${1 + Math.sin(t * 9) * .04 * power})`);
  const fill = mode === 'calm' ? 'url(#tj-glow)' : 'url(#tj-glow-v)';
  G.core.setAttribute('fill', fill); G.halo.setAttribute('fill', fill);
  G.halo.setAttribute('opacity', (.25 + power * .3 + Math.sin(t * 13) * .05 * power).toFixed(2));
 };
 return G;
}

// ─────────────────────────── ENVIRONMENTS ───────────────────────────
export function labRoom(parent, {w = 1800} = {}) {
 const L = {root: g(parent)};
 h('rect', {x: -200, y: -100, width: w + 400, height: 900, fill: 'url(#tj-wall)'}, L.root);
 // Panelled wall with ornament frieze.
 for (let x = -200; x < w + 200; x += 160) {path(L.root, `M${x},-100 L${x},640`, 'none', 2, {stroke: '#06151a'}); path(L.root, `M${x + 4},-100 L${x + 4},640`, 'none', 1.5, {stroke: '#1f5560', opacity: .6});}
 h('rect', {x: -200, y: 58, width: w + 400, height: 46, fill: '#0b2026', stroke: INK, 'stroke-width': 3}, L.root);
 for (let x = -160; x < w + 200; x += 64) orn(L.root, x, 81, 46, '#b98a3c', {opacity: .75});
 // Night window onto the city.
 const win = g(L.root);
 h('rect', {x: 40, y: 150, width: 420, height: 300, fill: 'url(#tj-sky-city)', stroke: INK, 'stroke-width': 6}, win);
 const rr = rand(11);
 for (let i = 0; i < 14; i++) {const bx = 50 + i * 30, bh = 60 + rr() * 150; h('rect', {x: bx, y: 450 - bh, width: 24, height: bh, fill: '#0d1a33'}, win); for (let k = 0; k < 6; k++) if (rr() > .45) h('rect', {x: bx + 5 + (k % 2) * 9, y: 450 - bh + 10 + k * 16, width: 4, height: 6, fill: '#ffd98a'}, win);}
 path(win, 'M250,150 L250,450 M40,300 L460,300', 'none', 5);
 L.winCrack = path(win, 'M300,210 L270,250 L290,262 L240,320 M270,250 L230,240 M290,262 L340,300 L330,350', 'none', 3, {stroke: '#e8fbff', style: 'display:none'});
 // Floor.
 path(L.root, `M-200,640 L${w + 200},640 L${w + 200},900 L-200,900 Z`, 'url(#tj-floor)', 3);
 for (let i = -12; i <= 12; i++) path(L.root, `M${w / 2 + i * 60},640 L${w / 2 + i * 260},900`, 'none', 1.5, {stroke: '#1e4a54', opacity: .5});
 for (const y of [690, 760, 850]) path(L.root, `M-200,${y} L${w + 200},${y}`, 'none', 1.5, {stroke: '#1e4a54', opacity: .45});
 // Ceiling alarm lamps.
 L.lamps = [300, 900, 1500].map(x => {const lg = g(L.root); path(lg, `M${x - 30},-100 L${x + 30},-100 L${x + 22},-60 L${x - 22},-60 Z`, '#222', 3); return h('circle', {cx: x, cy: -50, r: 120, fill: 'url(#tj-glow-r)', opacity: 0}, lg);});
 return L;
}

export function makeDoor(parent, x, y) {
 const D = {root: g(parent)}; tf(D.root, x, y);
 const cid = 'tj-door' + (++uid); const cp = h('clipPath', {id: cid}, D.root); h('rect', {x: -110, y: -380, width: 220, height: 380}, cp);
 const inner = g(D.root, {'clip-path': `url(#${cid})`});
 h('rect', {x: -110, y: -380, width: 220, height: 380, fill: '#ffe6c8'}, inner);
 D.light = h('rect', {x: -110, y: -380, width: 220, height: 380, fill: '#fff', opacity: .6}, inner);
 D.l = path(inner, 'M-110,-380 L0,-380 L0,0 L-110,0 Z', '#1a3c44', 3); D.r = path(inner, 'M0,-380 L110,-380 L110,0 L0,0 Z', '#1a3c44', 3);
 path(D.root, 'M-130,-400 L130,-400 L130,0 L110,0 L110,-380 L-110,-380 L-110,0 L-130,0 Z', '#0d2329', 3.5);
 D.sign = h('rect', {x: -40, y: -440, width: 80, height: 24, rx: 4, fill: '#7ff5e4', stroke: INK, 'stroke-width': 2}, D.root);
 D.set = k => {tf(D.l, -110 * k); tf(D.r, 110 * k); D.light.setAttribute('opacity', (.6 * k).toFixed(2));};
 D.set(0);
 return D;
}

export function makeConsole(parent, x, y, flip = false) {
 const C = {root: g(parent)}; tf(C.root, x, y, 0, flip ? -1 : 1, 1);
 C.screen = g(C.root);
 path(C.screen, 'M-120,-330 L120,-310 L120,-170 L-120,-190 Z', 'url(#tj-holo)', 2.5, {stroke: '#7ff5ff'});
 path(C.screen, 'M-100,-290 L100,-272 M-100,-260 L60,-246', 'none', 2, {stroke: '#bffaff', opacity: .7});
 GLYPHS.forEach((s, i) => {const t = h('text', {x: -100 + i * 21, y: -212 + i * 1.7, 'font-size': 15, fill: '#dffcff', 'font-family': 'Georgia,serif'}, C.screen); t.textContent = s;});
 C.bar = h('rect', {x: -100, y: -238, width: 80, height: 10, fill: '#7ff5ff'}, C.screen);
 path(C.root, 'M-150,-110 L150,-110 L130,0 L-130,0 Z', '#16343c', 3.5);
 path(C.root, 'M-170,-140 L170,-140 L150,-104 L-150,-104 Z', '#22505a', 3.5);
 for (let i = 0; i < 9; i++) h('rect', {x: -140 + i * 31, y: -132, width: 20, height: 10, rx: 2, fill: i % 3 ? '#7ff5e4' : '#e2b45a', stroke: INK, 'stroke-width': 1.5}, C.root);
 C.slot = h('rect', {x: 90, y: -136, width: 26, height: 12, fill: '#000', stroke: '#ff3d9a', 'stroke-width': 2}, C.root);
 C.setPower = (p, alarm) => {C.bar.setAttribute('width', (Math.min(1, p / 2.5) * 200).toFixed(1)); C.bar.setAttribute('fill', alarm ? '#ff3d6a' : '#7ff5ff');};
 return C;
}

export function makePedestal(parent, x, y) {
 const P = {root: g(parent)}; tf(P.root, x, y);
 path(P.root, 'M-60,0 L60,0 L48,-30 L-48,-30 Z', '#1d4650', 3.5);
 path(P.root, 'M-30,-30 L30,-30 L24,-130 L-24,-130 Z', '#173840', 3.5);
 path(P.root, 'M-50,-130 L50,-130 L42,-150 L-42,-150 Z', '#22505a', 3.5);
 orn(P.root, 0, -80, 40, '#d7a94e');
 P.book = makeBook(P.root, true); tf(P.book.root, 0, -175, 0, .75);
 return P;
}

// Futuristic Alatau skyline at dusk; the Institute tower has a шаңырақ (yurt crown) dome.
export function cityScape(parent) {
 const C = {root: g(parent)}, r = rand(21);
 h('rect', {x: -400, y: -200, width: 2400, height: 1300, fill: 'url(#tj-sky-city)'}, C.root);
 C.stars = g(C.root); for (let i = 0; i < 60; i++) h('circle', {cx: r() * 2400 - 400, cy: r() * 300 - 150, r: r() * 1.8 + .4, fill: '#fff', opacity: r() * .7 + .2}, C.stars);
 C.far = g(C.root); // mountains
 path(C.far, 'M-400,560 L-180,330 L-60,420 L120,250 L300,400 L520,230 L700,380 L900,210 L1120,390 L1320,260 L1540,410 L1760,280 L2000,450 L2000,700 L-400,700 Z', '#3a3f6e', 3.5);
 path(C.far, 'M120,250 L80,292 L118,284 L140,300 L170,280 Z M520,230 L476,280 L512,270 L540,286 L566,262 Z M900,210 L850,264 L894,252 L926,272 L948,250 Z M1320,260 L1276,304 L1316,296 L1346,312 L1370,290 Z M1760,280 L1720,320 L1760,314 L1786,326 L1806,306 Z', '#e9e6f6', 2.5);
 path(C.far, 'M-400,560 L-180,330 L-60,420 L120,250 L300,400 L520,230 L700,380 L900,210 L1120,390 L1320,260 L1540,410 L1760,280 L2000,450 L2000,700 L-400,700 Z', 'url(#tj-ht)', 0, {opacity: .18});
 const towers = (layer, n, base, minH, maxH, col, lit, seed) => {
  const rr = rand(seed);
  for (let i = 0; i < n; i++) {
   const x = -400 + i * (2400 / n) + rr() * 30, w = 40 + rr() * 60, hh = minH + rr() * (maxH - minH);
   path(layer, `M${x},${base} L${x},${base - hh} L${x + w * .5},${base - hh - 18 * rr()} L${x + w},${base - hh} L${x + w},${base} Z`, col, 3);
   for (let yy = base - hh + 16; yy < base - 10; yy += 18) for (let xx = x + 8; xx < x + w - 8; xx += 14) if (rr() < lit) h('rect', {x: xx, y: yy, width: 6, height: 8, fill: rr() < .8 ? '#ffd98a' : '#7ff5ff'}, layer);
  }
 };
 C.mid = g(C.root); towers(C.mid, 26, 760, 120, 330, '#1b2546', .14, 5);
 // The Institute: slim tower, gold шаңырақ dome, holo ring.
 C.inst = g(C.root);
 path(C.inst, 'M760,760 L770,330 L830,330 L840,760 Z', '#22305a', 3.5);
 for (let y = 350; y < 740; y += 26) h('rect', {x: 782, y, width: 36, height: 10, fill: '#7ff5ff', opacity: .7}, C.inst);
 path(C.inst, 'M700,330 Q800,200 900,330 Z', '#2b3a66', 3.5);
 path(C.inst, 'M700,330 Q800,200 900,330', 'none', 6, {stroke: '#e2b45a'});
 h('circle', {cx: 800, cy: 262, r: 34, fill: '#ffdf8a', stroke: INK, 'stroke-width': 3}, C.inst);
 path(C.inst, 'M766,262 L834,262 M800,228 L800,296 M776,238 Q800,262 824,238 M776,286 Q800,262 824,286', 'none', 3, {stroke: '#8a5a14'});
 for (let i = -4; i <= 4; i++) path(C.inst, `M${800 + i * 22},${300 - Math.abs(i) * 3} L${800 + i * 12},270`, 'none', 2, {stroke: '#e2b45a'});
 C.ring = h('ellipse', {cx: 800, cy: 400, rx: 120, ry: 22, fill: 'none', stroke: '#7ff5ff', 'stroke-width': 4, opacity: .8}, C.inst);
 C.beacon = h('circle', {cx: 800, cy: 262, r: 140, fill: 'url(#tj-glow-g)', opacity: .5}, C.inst);
 C.near = g(C.root); towers(C.near, 14, 920, 200, 420, '#0f1631', .16, 9);
 path(C.near, 'M-400,840 L2000,800 L2000,830 L-400,872 Z', '#0b0f22', 3);
 C.cars = [0, 1, 2, 3, 4].map(i => {const cg = g(C.root); h('rect', {x: -40, y: -5, width: 80, height: 3, fill: '#7ff5ff', opacity: .6}, cg); path(cg, 'M-18,-8 Q0,-18 18,-8 L22,4 L-22,4 Z', '#2a3a6a', 2.5); h('circle', {cx: 22, cy: 0, r: 4, fill: '#ffd98a'}, cg); return cg;});
 C.tick = t => {
  C.cars.forEach((cg, i) => {const sp = 120 + i * 40, x = ((t * sp + i * 500) % 2600) - 500, y = 380 + i * 70 + Math.sin(t + i) * 6; tf(cg, i % 2 ? 1800 - x : x, y, 0, i % 2 ? -1 : 1, 1);});
  C.ring.setAttribute('ry', (22 + Math.sin(t * 2) * 4).toFixed(1));
  C.beacon.setAttribute('opacity', (.4 + Math.sin(t * 1.7) * .12).toFixed(2));
 };
 return C;
}

// Ancient steppe at dawn: mountains, feather-grass, wild horses, golden eagle, distant hunters' smoke.
export function steppe(parent, {w = 2600, seed = 4} = {}) {
 const S = {root: g(parent)}, r = rand(seed);
 h('rect', {x: -400, y: -300, width: w + 800, height: 1400, fill: 'url(#tj-sky-dawn)'}, S.root);
 S.sun = g(S.root);
 h('circle', {cx: 0, cy: 0, r: 420, fill: 'url(#tj-glow-g)', opacity: .55}, S.sun);
 h('circle', {cx: 0, cy: 0, r: 70, fill: '#fff4cf', stroke: INK, 'stroke-width': 3}, S.sun);
 tf(S.sun, w * .55, 330);
 S.clouds = g(S.root);
 for (let i = 0; i < 6; i++) {const cx = r() * w, cy = 80 + r() * 200, s = .6 + r(); const c = g(S.clouds); tf(c, cx, cy, 0, s); path(c, 'M-120,20 Q-120,-20 -70,-18 Q-60,-50 -10,-44 Q20,-70 60,-40 Q110,-40 110,0 Q130,20 100,24 Z', '#f4c7a6', 2.5); path(c, 'M-110,20 Q-20,4 104,22', 'none', 6, {stroke: '#d98b78', opacity: .7});}
 // Far snowy range.
 path(S.root, `M-400,560 L-200,380 L-90,450 L120,300 L260,420 L480,280 L620,380 L860,250 L1040,400 L1260,300 L1420,420 L1640,290 L1840,400 L2060,310 L2260,430 L2500,330 L${w + 400},480 L${w + 400},700 L-400,700 Z`, '#7d78a4', 3.5);
 path(S.root, 'M120,300 L80,346 L120,336 L150,356 L176,330 Z M480,280 L432,330 L474,318 L510,338 L534,312 Z M860,250 L808,306 L854,294 L892,316 L916,290 Z M1260,300 L1214,346 L1256,336 L1290,354 L1314,330 Z M1640,290 L1596,334 L1636,326 L1668,344 L1690,320 Z M2060,310 L2016,354 L2056,346 L2088,364 L2110,340 Z M2500,330 L2460,370 L2500,362 L2530,378 L2550,356 Z', '#f6f0f6', 2.5);
 path(S.root, `M-400,560 L-200,380 L-90,450 L120,300 L260,420 L480,280 L620,380 L860,250 L1040,400 L1260,300 L1420,420 L1640,290 L1840,400 L2060,310 L2260,430 L2500,330 L${w + 400},480 L${w + 400},700 L-400,700 Z`, 'url(#tj-ht)', 0, {opacity: .14});
 path(S.root, 'M120,300 L100,420 M480,280 L500,410 M860,250 L830,380 M860,250 L900,360 M1260,300 L1240,420 M1640,290 L1660,410 M2060,310 L2040,430 M2500,330 L2520,440', 'none', 2.5, {opacity: .45});
 // Golden "time dome" on the horizon — the chroniclers' camp between epochs.
 S.beacon = g(S.root); tf(S.beacon, w * .82, 560);
 h('circle', {r: 260, fill: 'url(#tj-glow-g)', opacity: .7}, S.beacon);
 S.beam = h('rect', {x: -14, y: -600, width: 28, height: 600, fill: 'url(#tj-beam)', opacity: .9}, S.beacon);
 path(S.beacon, 'M-70,0 A70,52 0 0 1 70,0', 'none', 3, {stroke: '#fff1c4', opacity: .9, 'stroke-dasharray': '10 8'});
 // Rolling hills.
 path(S.root, `M-400,600 Q0,520 400,580 T1200,570 T2000,590 T${w + 400},560 L${w + 400},760 L-400,760 Z`, '#8c8158', 3.5);
 path(S.root, `M-400,600 Q0,520 400,580 T1200,570 T2000,590 T${w + 400},560 L${w + 400},760 L-400,760 Z`, 'url(#tj-ht)', 0, {opacity: .15});
 // Hunters' smoke far away (animated wisp).
 S.smokeW = path(S.root, '', 'none', 22, {stroke: '#e6dcd0', opacity: .35}); S.smoke = path(S.root, '', 'none', 9, {stroke: '#f3ece2', opacity: .7});
 h('circle', {cx: w * .38, cy: 590, r: 7, fill: '#ffb347', stroke: INK, 'stroke-width': 2}, S.root);
 // Wild horses (mid-ground silhouettes).
 S.herd = g(S.root);
 S.horses = Array.from({length: 7}, (_, i) => {const hg = g(S.herd); const parts = horse(hg); return {hg, parts, x: i * 120 + r() * 60, y: 640 + r() * 40, s: .55 + r() * .2, ph: r() * 6};});
 // Plain.
 path(S.root, `M-400,660 Q600,630 1300,660 T${w + 400},650 L${w + 400},1100 L-400,1100 Z`, '#b39a58', 3.5);
 path(S.root, `M-400,760 Q600,730 1300,760 T${w + 400},750 L${w + 400},1100 L-400,1100 Z`, '#9d8445', 0);
 // Feather grass (селеу) clumps in front, swaying.
 S.grass = [];
 for (let i = 0; i < 46; i++) {
  const gx = -300 + i * ((w + 600) / 46) + r() * 30, gy = 780 + r() * 240, s = .6 + (gy - 780) / 240 * .9;
  const cg = g(S.root); let d = '';
  for (let b = 0; b < 7; b++) {const a = -60 + b * 20 + r() * 10, L = 70 + r() * 70; d += `M0,0 Q${a * .4},${-L * .6} ${a},${-L}`;}
  path(cg, d, 'none', 3, {stroke: '#e8d8a0'}); path(cg, d, 'none', 1.2, {stroke: '#6d5a2a', opacity: .5});
  S.grass.push({cg, gx, gy, s, ph: r() * 6});
 }
 // Golden eagle.
 S.eagle = g(S.root); const eg = g(S.eagle);
 path(eg, 'M0,0 C-30,-14 -70,-10 -110,6 C-80,0 -50,4 -24,12 Z M0,0 C30,-14 70,-10 110,6 C80,0 50,4 24,12 Z', '#3a2618', 2.5);
 path(eg, 'M-14,4 Q0,-6 14,4 L8,20 L-8,20 Z', '#4a301c', 2.5); path(eg, 'M-6,-2 Q0,-12 6,-2 Z', '#d9c39a', 2);
 S.eagleWing = eg;
 S.tick = t => {
  S.grass.forEach(o => tf(o.cg, o.gx, o.gy, Math.sin(t * 1.6 + o.ph + o.gx * .004) * 7, o.s));
  let d = `M${w * .38},590`; for (let k = 1; k <= 16; k++) d += ` L${(w * .38 + k * k * .9 + Math.sin(t * .8 + k * .5) * k * 1.6).toFixed(1)},${590 - k * 22}`;
  S.smoke.setAttribute('d', d); S.smokeW.setAttribute('d', d);
  S.beam.setAttribute('opacity', (.65 + Math.sin(t * 3) * .2).toFixed(2));
  tf(S.eagleWing, 0, 0, 0, 1, .8 + Math.sin(t * 2.2) * .25);
 };
 S.runHerd = (t, x0, sp) => S.horses.forEach(o => {const x = x0 - t * sp + o.x; tf(o.hg, x, o.y + Math.sin(t * 9 + o.ph) * 3, 0, -o.s, o.s); gallop(o.parts, t * 9 + o.ph);});
 return S;
}
function horse(parent) {
 const col = '#3b2b22';
 const legs = [[-38, 0], [-26, 0], [30, 0], [42, 0]].map(([x]) => {const lg = joint(parent, x, -48); path(lg, 'M-5,0 L5,0 L4,44 L-4,44 Z', col, 2); return lg;});
 path(parent, 'M-52,-62 Q-56,-90 -20,-92 L30,-92 Q52,-94 58,-110 L70,-136 Q80,-146 92,-134 L98,-118 L86,-112 L72,-96 Q66,-70 54,-58 Q10,-44 -40,-50 Z', col, 2.5);
 path(parent, 'M62,-120 L48,-104 L40,-96 L54,-100 Z M66,-134 L50,-118 L44,-108', '#1e1510', 2);
 path(parent, 'M-52,-80 Q-80,-74 -86,-48 Q-70,-62 -56,-64 Z', '#1e1510', 2);
 return legs;
}
function gallop(legs, ph) {legs.forEach((lg, i) => rot(lg, Math.sin(ph + (i < 2 ? 0 : 2.2) + i * .6) * 32));}

// Close-up hand reaching for the stone tool (shot "tool").
export function makeHand(parent, o = {}) {
 const Hd = {root: g(parent)}, c = {...HERO, ...o};
 path(Hd.root, 'M-80,-420 L80,-420 L70,-80 L-70,-80 Z', c.jacket, 4);
 path(Hd.root, 'M-72,-150 L72,-150 L70,-80 L-70,-80 Z', c.cuff || '#0e2a2d', 4);
 if (!o.noDevice) {h('rect', {x: -50, y: -260, width: 100, height: 56, rx: 10, fill: c.device, stroke: INK, 'stroke-width': 4}, Hd.root); h('circle', {cx: 0, cy: -232, r: 90, fill: 'url(#tj-glow)', opacity: .45}, Hd.root);}
 path(Hd.root, 'M-66,-90 C-80,-20 -70,40 -40,70 C-10,96 40,90 62,52 C76,20 74,-40 64,-90 Z', c.skin, 4);
 path(Hd.root, 'M20,-80 C40,-60 50,10 40,60 C56,30 66,-20 60,-80 Z', c.skinD, 0);
 Hd.fingers = [-42, -14, 14, 40].map((x, i) => {const f = joint(Hd.root, x, 60 - Math.abs(x) * .3); path(f, capsule(66 - Math.abs(i - 1.5) * 8, 26, 22), c.skin, 3.5); path(f, 'M-8,30 L8,30', 'none', 2); return f;});
 Hd.thumb = joint(Hd.root, -62, -10); path(Hd.thumb, capsule(70, 30, 24), c.skin, 3.5);
 Hd.grip = k => {Hd.fingers.forEach((f, i) => rot(f, (i - 1.5) * -6 + k * -48)); rot(Hd.thumb, -30 + k * -40);};
 Hd.grip(0);
 return Hd;
}
// Knapped stone chopper (Lower Palaeolithic pebble tool).
export function makeStoneTool(parent) {
 const T = g(parent);
 path(T, 'M-70,10 C-74,-30 -40,-56 6,-58 C50,-60 76,-30 74,6 C72,34 30,46 -10,44 C-46,42 -68,34 -70,10 Z', '#8e8576', 4);
 path(T, 'M6,-58 L-6,-20 L30,-34 Z M30,-34 L46,6 L74,6 M-6,-20 L-30,10 L6,20 L46,6 M-30,10 L-70,10', 'none', 3);
 path(T, 'M6,-58 L-6,-20 L30,-34 Z', '#a9a091', 0, {opacity: .9});
 path(T, 'M-70,10 C-68,34 -46,42 -10,44 C30,46 72,34 74,6 L46,6 L6,20 L-30,10 Z', '#6e665a', 0, {opacity: .8});
 path(T, 'M-70,10 C-74,-30 -40,-56 6,-58 C50,-60 76,-30 74,6 C72,34 30,46 -10,44 C-46,42 -68,34 -70,10 Z', 'url(#tj-ht)', 0, {opacity: .2});
 return T;
}

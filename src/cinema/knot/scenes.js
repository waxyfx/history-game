// MAP04 «Түйінші» — shot builders (same kit and conventions as src/intro/scenes.js).
// Each builder draws a layered illustration and returns update(t) for shot-local time.
import {h, g, path, tf, lerp, clamp, ease, easeOut, easeIn, seg, rand, INK, nextId,
 makeHero, makeVillain, makeHeroBack, makePage, makeGate, makeHand, camAt, applyCam, panel, page, overlay} from '../../intro/art.js';

// ─────────────────────────── art: the night steppe of Talas, the knot-keeper, props ───────────────────────────
function grad(root, stops, {x2 = 0, y2 = 1, radial = false} = {}) {
 const id = nextId('kn-g'), d = h('defs', {}, root);
 const el = h(radial ? 'radialGradient' : 'linearGradient', radial ? {id} : {id, x1: 0, y1: 0, x2, y2}, d);
 stops.forEach(([o, c, a = 1]) => h('stop', {offset: o, 'stop-color': c, 'stop-opacity': a}, el));
 return `url(#${id})`;
}
// Layers: sky+stars+moon (far), ridge, settlement lights, plain (mid), dust, grass (near). tick(t, px) = parallax.
function nightSteppe(parent, {seed = 7, town = true, w = 3000} = {}) {
 const S = {root: g(parent)}, r = rand(seed);
 h('rect', {x: -800, y: -400, width: w + 1600, height: 1900, fill: grad(S.root, [[0, '#0e1a3c'], [.42, '#27427a'], [.76, '#5f6496'], [1, '#a07a86']])}, S.root);
 S.sky = g(S.root);
 S.stars = Array.from({length: 150}, () => {const c = h('circle', {cx: -600 + r() * (w + 1200), cy: -300 + r() * 760, r: (.6 + r() * 1.8).toFixed(1), fill: '#ecebff'}, S.sky); c.ph = r() * 6; c.base = .3 + r() * .7; return c;});
 S.moon = g(S.sky); tf(S.moon, w * .62, 120);
 h('circle', {r: 420, fill: 'url(#tj-glow)', opacity: .22}, S.moon);
 h('circle', {r: 46, fill: '#f3ead0', stroke: INK, 'stroke-width': 3}, S.moon);
 h('circle', {cx: 16, cy: -8, r: 42, fill: '#22386a'}, S.moon);
 S.far = g(S.root);
 path(S.far, `M-800,520 L-200,430 L120,470 L460,380 L820,452 L1180,360 L1560,440 L1900,392 L2300,470 L2700,410 L${w + 800},470 L${w + 800},1500 L-800,1500 Z`, '#2a3460', 3);
 path(S.far, `M460,380 L520,400 L600,388 M1180,360 L1240,382 L1320,370 M1900,392 L1960,410`, 'none', 3, {stroke: '#7d8bc0'});
 S.town = g(S.root); S.lights = [];
 if (town) {
  for (let i = 0; i < 9; i++) {
   const x = 1380 + i * 46 + r() * 18, y = 520 + (i % 3) * 6, s = .5 + r() * .25, yg = g(S.town); tf(yg, x, y, 0, s);
   path(yg, 'M-40,0 C-40,-34 -22,-50 0,-52 C22,-50 40,-34 40,0 Z', '#1a1a33', 2.5);
   const glow = h('circle', {cx: 0, cy: -12, r: 40, fill: 'url(#tj-glow-g)', opacity: .5}, yg);
   h('rect', {x: -7, y: -18, width: 14, height: 18, fill: '#ffb24a'}, yg);
   S.lights.push({glow, ph: r() * 6});
  }
  const fire = h('circle', {cx: 1570, cy: 534, r: 90, fill: 'url(#tj-glow-g)', opacity: .5}, S.town); S.lights.push({glow: fire, ph: 1});
 }
 S.mid = g(S.root);
 path(S.mid, `M-800,560 Q300,520 900,560 T${w + 800},552 L${w + 800},1500 L-800,1500 Z`, '#3b3654', 3);
 h('rect', {x: -800, y: 556, width: w + 1600, height: 900, fill: grad(S.mid, [[0, '#4a4262'], [.5, '#2a2640'], [1, '#100e1a']]), opacity: .92}, S.mid);
 h('rect', {x: -800, y: 556, width: w + 1600, height: 900, fill: 'url(#tj-ht)', opacity: .1}, S.mid);
 S.dust = Array.from({length: 22}, () => {const e = h('ellipse', {cx: 0, cy: 0, rx: 140 + r() * 260, ry: 10 + r() * 22, fill: '#c9bba8', opacity: (.05 + r() * .09).toFixed(3)}, S.mid); e.x0 = -800 + r() * (w + 1600); e.y0 = 560 + r() * 360; e.sp = 60 + r() * 140; return e;});
 S.near = g(S.root);
 for (let i = 0; i < 70; i++) {const x = -700 + i * (w + 1400) / 70 + r() * 30, hh = 40 + r() * 90; const bl = path(S.near, `M${x},1000 Q${x + 4},${1000 - hh / 2} ${x + 10 + r() * 20},${1000 - hh}`, 'none', 4, {stroke: '#0d0b18'}); bl.x = x; bl.h = hh; bl.ph = r() * 6;}
 S.tick = (t, px = 0, wind = 1) => {
  S.stars.forEach(s => s.setAttribute('opacity', (s.base * (.65 + .35 * Math.sin(t * 2 + s.ph))).toFixed(2)));
  tf(S.sky, px * .85, 0); tf(S.far, px * .6, 0); tf(S.town, px * .55, 0); tf(S.mid, px * .3, 0); tf(S.near, -px * .25, 0);
  S.lights.forEach(l => l.glow.setAttribute('opacity', (.42 + Math.sin(t * 7 + l.ph) * .08 + Math.sin(t * 13 + l.ph) * .05).toFixed(2)));
  S.dust.forEach(e => {const x = ((e.x0 + t * e.sp * wind) % (w + 2400)) - 1200; e.setAttribute('cx', x.toFixed(1)); e.setAttribute('cy', (e.y0 + Math.sin(t + e.x0) * 6).toFixed(1));});
 };
 return S;
}
// The knot-keeper: a grey hooded figure; parts can be revealed one by one (silhouette → hand → hem → face → eye).
function makeKnot(parent) {
 const K = {root: g(parent)}, robe = 'M-72,0 C-80,-120 -70,-250 -44,-330 C-30,-372 30,-372 44,-330 C70,-250 80,-120 72,0 Z',
  hood = 'M-56,-298 C-66,-360 -44,-426 2,-434 C46,-426 66,-360 56,-298 C40,-284 -40,-284 -56,-298 Z';
 path(K.root, 'M-90,0 A90,14 0 1 0 90,0 A90,14 0 1 0 -90,0', '#000', 0, {opacity: .35});
 K.sil = g(K.root); path(K.sil, robe, '#07070c', 3); path(K.sil, hood, '#07070c', 3);
 K.detail = g(K.root);
 path(K.detail, robe, '#4a4b53', 4);
 path(K.detail, 'M-30,-300 C-40,-200 -44,-100 -40,0 M10,-310 C16,-200 22,-100 26,0 M40,-280 C54,-180 60,-80 58,0', 'none', 3, {stroke: '#2f3037'});
 path(K.detail, robe, 'url(#tj-ht)', 0, {opacity: .18});
 path(K.detail, hood, '#56575f', 4);
 path(K.detail, 'M-40,-310 C-30,-360 -10,-400 10,-410', 'none', 3, {stroke: '#6b6c75'});
 K.hem = g(K.root); path(K.hem, 'M-72,-2 L-62,16 L-50,0 L-38,18 L-24,0 L-10,16 L4,0 L18,18 L32,0 L46,16 L58,0 L72,-2 Z', '#3b3c44', 3);
 K.void = h('ellipse', {cx: 6, cy: -344, rx: 30, ry: 38, fill: '#050508'}, K.root);
 K.face = g(K.root);
 path(K.face, 'M-14,-326 Q6,-306 28,-326 L26,-314 Q6,-296 -12,-314 Z', '#b29682', 3);
 path(K.face, 'M-2,-318 Q6,-314 14,-318', 'none', 2);
 K.eye = g(K.root); tf(K.eye, 14, -352);
 path(K.eye, 'M-10,0 Q0,-7 10,0 Q0,6 -10,0 Z', '#d7dbe2', 2);
 h('circle', {r: 3.6, fill: '#8b93a8'}, K.eye); h('circle', {r: 1.6, fill: '#0b0b10'}, K.eye);
 K.glint = h('circle', {cx: 1.5, cy: -1.5, r: 1.2, fill: '#fff'}, K.eye);
 K.hand = g(K.root); tf(K.hand, 46, -210);
 path(K.hand, 'M-16,-30 L16,-34 L20,6 L-18,8 Z', '#3f4048', 3);
 path(K.hand, 'M-14,6 C-18,30 -6,44 6,44 C20,42 24,22 18,6 Z', '#b29682', 3);
 K.cords = Array.from({length: 5}, (_, i) => path(K.hand, '', 'none', 2.5, {stroke: i === 4 ? '#e7c66d' : '#d9d4c7'}));
 K.place = (x, y, s = 1, flip = false) => K.root.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${flip ? -s : s} ${s})`);
 K.reveal = ({body = 1, hand = 1, hem = 1, face = 1, eye = 1} = {}) => {
  K.detail.setAttribute('opacity', body.toFixed(2)); K.sil.setAttribute('opacity', (1 - body * .9).toFixed(2));
  K.hand.setAttribute('opacity', hand.toFixed(2)); K.hem.setAttribute('opacity', hem.toFixed(2));
  K.face.setAttribute('opacity', face.toFixed(2)); K.eye.setAttribute('opacity', eye.toFixed(2));
 };
 K.tick = t => {
  K.cords.forEach((c, i) => {const x = -10 + i * 5, sw = Math.sin(t * 1.6 + i) * 4; let d = `M${x},40`; for (let k = 1; k <= 7; k++) d += ` L${(x + sw * k / 7).toFixed(1)},${40 + k * 12}`; c.setAttribute('d', d);});
  K.glint.setAttribute('opacity', (.6 + Math.sin(t * 3) * .4).toFixed(2));
 };
 K.reveal(); K.tick(0);
 return K;
}
// A cord with eleven knots; the eleventh is different.
function cord(parent, x, y, len = 520, {glow = true} = {}) {
 const C = g(parent); tf(C, x, y);
 path(C, `M0,0 C${len * .3},-18 ${len * .6},18 ${len},0`, 'none', 7, {stroke: '#d9d4c7'});
 path(C, `M0,0 C${len * .3},-18 ${len * .6},18 ${len},0`, 'none', 2, {stroke: '#8f897c'});
 const knots = Array.from({length: 11}, (_, i) => {const k = (i + .5) / 11, kx = len * k, ky = Math.sin(k * Math.PI * 2) * -8; const n = h('circle', {cx: kx, cy: ky, r: i === 10 ? 13 : 10, fill: i === 10 ? '#3a2a44' : '#e9e3d4', stroke: INK, 'stroke-width': 3}, C); return n;});
 C.last = knots[10];
 C.halo = h('circle', {cx: knots[10].getAttribute('cx'), cy: knots[10].getAttribute('cy'), r: 46, fill: 'url(#tj-glow-v)', opacity: glow ? .5 : 0}, C);
 C.insertBefore(C.halo, C.firstChild);
 return C;
}
function tally(parent) {
 const T = {root: g(parent)};
 T.front = g(T.root);
 path(T.front, 'M-460,-70 L440,-80 Q470,-78 472,-40 L476,46 Q474,80 444,80 L-452,72 Q-480,70 -480,40 L-482,-40 Q-480,-70 -460,-70 Z', '#7a5434', 5);
 for (let i = 0; i < 9; i++) path(T.front, `M${-440 + i * 100},-66 Q${-400 + i * 100},0 ${-436 + i * 100},70`, 'none', 2.5, {stroke: '#5b3d24'});
 for (const x of [-300, -240, -180, -120]) path(T.front, `M${x},-70 L${x + 10},-30 L${x + 20},-70`, '#2a1b10', 3);
 T.seal = g(T.front); tf(T.seal, 230, 0);
 h('circle', {r: 96, fill: '#8f1d22', stroke: INK, 'stroke-width': 5}, T.seal);
 h('circle', {r: 70, fill: 'none', stroke: '#5e1013', 'stroke-width': 6}, T.seal);
 path(T.seal, 'M-34,10 C-30,-30 0,-44 24,-30 L36,-46 L40,-18 C46,4 24,30 -6,28 Z', '#6e1418', 3);
 T.crack = path(T.seal, 'M-60,-60 L-18,-22 L-30,6 L14,30 L4,52 L40,80', 'none', 5, {stroke: '#0c0606'});
 path(T.front, 'M-460,-70 L440,-80 Q470,-78 472,-40 L476,46 Q474,80 444,80 L-452,72 Q-480,70 -480,40 L-482,-40 Q-480,-70 -460,-70 Z', 'url(#tj-ht)', 0, {opacity: .15});
 T.back = g(T.root);
 path(T.back, 'M-460,-70 L440,-80 Q470,-78 472,-40 L476,46 Q474,80 444,80 L-452,72 Q-480,70 -480,40 L-482,-40 Q-480,-70 -460,-70 Z', '#6a472c', 5);
 for (let i = 0; i < 9; i++) path(T.back, `M${-440 + i * 100},-66 Q${-400 + i * 100},0 ${-436 + i * 100},70`, 'none', 2.5, {stroke: '#4c321d'});
 h('circle', {cx: 40, cy: 0, r: 120, fill: 'url(#tj-glow-v)', opacity: .35}, T.back);
 path(T.back, 'M-120,-6 C-40,-40 40,40 120,0 C170,-20 200,20 240,4', 'none', 8, {stroke: '#ddd6c6'});
 h('circle', {cx: 40, cy: 2, r: 22, fill: '#e9e3d4', stroke: INK, 'stroke-width': 4}, T.back);
 path(T.back, 'M28,-8 Q40,14 54,-6', 'none', 3);
 T.flip = k => {const s = Math.cos(k * Math.PI); T.front.style.display = s >= 0 ? '' : 'none'; T.back.style.display = s < 0 ? '' : 'none'; tf(T.root, 0, 0, 0, 1, Math.max(.04, Math.abs(s)));};
 T.flip(0);
 return T;
}
function ruin(parent) {
 const R = g(parent);
 for (let i = 0; i < 9; i++) {const a = Math.PI + i / 8 * Math.PI, x = Math.cos(a) * 240, y = Math.sin(a) * 70; path(R, `M${x - 22},${y} L${x - 18},${y - 70 - (i % 3) * 18} L${x + 16},${y - 76 - (i % 2) * 14} L${x + 22},${y} Z`, '#2a2b38', 3);}
 path(R, 'M-140,-20 L120,-30 L150,20 L-160,26 Z', '#323343', 3);
 path(R, 'M-300,40 Q0,70 300,36', 'none', 3, {stroke: '#1b1b26'});
 return R;
}
const prints = (parent, pts, s = 1) => pts.map(([x, y], i) => {const p = h('ellipse', {cx: x + (i % 2 ? 12 : -12) * s, cy: y, rx: 10 * s, ry: 18 * s, fill: '#0c0a10', opacity: 0, transform: `rotate(${i % 2 ? 12 : -12} ${x} ${y})`}, parent); return p;});

// ─────────────────────────── shots ───────────────────────────
export const SCENES = {
 // 1 — the night steppe: wide, slow push, dust, distant fires; no words.
 night(root) {
  const cam = g(root), S = nightSteppe(cam);
  const vig = h('rect', {x: -800, y: -400, width: 3200, height: 1800, fill: 'url(#tj-vig)'}, root);
  return t => {
   S.tick(t, -t * 14, 1.2);
   applyCam(cam, camAt([[0, 1200, 470, .82], [9, 1360, 500, 1.02]], t));
   vig.setAttribute('opacity', '.55');
  };
 },
 // 2 — the forged tally in the dust: push to the broken seal; it turns over, a knot; Aibar's hand lifts it.
 tally(root) {
  const cam = g(root);
  h('rect', {x: -1200, y: -800, width: 3200, height: 2200, fill: grad(cam, [[0, '#1f1a22'], [1, '#0b090e']])}, cam);
  const r = rand(11);
  for (let i = 0; i < 140; i++) h('circle', {cx: -900 + r() * 2600, cy: -500 + r() * 1700, r: (1 + r() * 4).toFixed(1), fill: '#2e2830', opacity: .8}, cam);
  const lit = h('ellipse', {cx: 200, cy: 40, rx: 900, ry: 420, fill: 'url(#tj-glow-g)', opacity: .14}, cam);
  const T = tally(cam), dust = Array.from({length: 18}, () => {const e = h('ellipse', {rx: 60 + r() * 120, ry: 8 + r() * 10, fill: '#a99a8c', opacity: .06}, cam); e.x0 = -900 + r() * 1800; e.y0 = -300 + r() * 600; return e;});
  const hand = makeHand(cam, {noDevice: false}); tf(hand.root, 260, 1200, 0, 1);
  return t => {
   dust.forEach(e => {e.setAttribute('cx', (e.x0 + t * 180).toFixed(0)); e.setAttribute('cy', (e.y0 + Math.sin(t + e.x0) * 10).toFixed(0));});
   T.flip(easeInOut(seg(t, 3.8, 5.2)) * 1);
   const grab = seg(t, 5.6, 6.6), lift = seg(t, 6.6, 8.6);
   hand.grip(easeOut(seg(t, 6.2, 6.7)));
   tf(hand.root, lerp(260, 40, easeOut(grab)), lerp(1200, 250, easeOut(grab)) - easeIn(lift) * 260, -12 + lift * 8, 1);
   tf(T.root, 0, -easeIn(lift) * 300, lift * -6, 1, Math.max(.04, Math.abs(Math.cos(easeInOut(seg(t, 3.8, 5.2)) * Math.PI))));
   lit.setAttribute('opacity', (.12 + Math.sin(t * 2) * .03).toFixed(2));
   applyCam(cam, camAt([[0, 0, 0, .72], [3.6, 200, 0, 1.25], [5.4, 80, 0, 1.1], [9, 60, -160, 1.05]], t));
  };
 },
 // 3 — footprints lead to the ruin; for a second a hooded silhouette on the ridge; Aibar turns — gone.
 tracks(root) {
  const cam = g(root), S = nightSteppe(cam, {town: false, seed: 9});
  const R = ruin(cam); tf(R, 1900, 640, 0, 1.1);
  const fp = prints(cam, Array.from({length: 16}, (_, i) => [800 + i * 70, 820 - i * 11]), 1.3);
  const silK = makeKnot(cam); silK.place(2120, 520, .55); silK.reveal({body: 0, hand: 0, hem: 0, face: 0, eye: 0});
  const hero = makeHero(cam); hero.place(700, 860, .62, false);
  return t => {
   S.tick(t, -t * 30, lerp(1, 3, seg(t, 4.2, 5.2)) - seg(t, 6, 8) * 1.6);
   fp.forEach((p, i) => p.setAttribute('opacity', (.85 * clamp((t * 2.2 - i * .3) / 1)).toFixed(2)));
   const turn = seg(t, 6, 6.5);
   hero.place(700 + Math.min(t, 6) * 40, 860, .62, turn > .5);
   const ph = t * 5;
   hero.pose(t < 6 ? {lean: 4, head: 0, hipF: Math.sin(ph) * 18, hipB: -Math.sin(ph) * 18, kneeF: Math.max(0, -Math.cos(ph)) * 24, kneeB: Math.max(0, Math.cos(ph)) * 24, shF: -Math.sin(ph) * 14, shB: Math.sin(ph) * 14, elF: 12, elB: 12}
    : {lean: -4, head: 6, shF: 24, elF: 30, shB: 10, elB: 10});
   hero.face({look: [turn > .5 ? -2 : 2, -1], mouth: 'closed', brow: turn});
   hero.wind = .7; hero.tick(t, false);
   // The silhouette exists for about one second, at the edge of the dust gust.
   const sil = seg(t, 4.6, 4.9) * (1 - seg(t, 5.8, 6.1));
   silK.root.setAttribute('opacity', sil.toFixed(2)); silK.tick(t);
   applyCam(cam, camAt([[0, 900, 640, 1.1], [4.4, 1600, 600, 1], [5.4, 1900, 560, 1.25], [6.2, 1100, 640, 1.05], [9, 1200, 640, 1.1]], t));
  };
 },
 // 4 — over Aibar's shoulder: the knot-keeper takes shape in the dust — silhouette, hand, hem, face, eye.
 reveal(root, ctx) {
  const cam = g(root), S = nightSteppe(cam, {town: false, seed: 13});
  const R = ruin(cam); tf(R, 1250, 640, 0, .9);
  const K = makeKnot(cam); K.place(1250, 700, .78);
  const back = makeHeroBack(cam); tf(back.root, 640, 1260, 0, 1.25);
  const fog = Array.from({length: 8}, (_, i) => h('ellipse', {cx: 1250, cy: 640, rx: 420 - i * 30, ry: 120 - i * 8, fill: '#8b8496', opacity: .07}, cam));
  return t => {
   S.tick(t, -t * 6, .6);
   K.reveal({body: easeOut(seg(t, 4, 6.5)), hand: easeOut(seg(t, 2.6, 4)), hem: easeOut(seg(t, 4.6, 5.8)), face: easeOut(seg(t, 6.8, 8.2)), eye: easeOut(seg(t, 8.6, 9.2))});
   K.root.setAttribute('opacity', easeOut(seg(t, .6, 2.6)).toFixed(2)); K.tick(t);
   fog.forEach((f, i) => f.setAttribute('cx', (1250 + Math.sin(t * .6 + i) * 60).toFixed(0)));
   tf(back.root, 640 + Math.sin(t * .8) * 3, 1260, 0, 1.25);
   applyCam(cam, camAt([[0, 1000, 640, 1], [6, 1120, 560, 1.35], [9, 1250, 470, 2.1], [11, 1262, 440, 2.4]], t));
  };
 },
 // 5 — the two of them; three lines; a held pause between each.
 meet(root, ctx) {
  const cam = g(root), S = nightSteppe(cam, {town: false, seed: 13});
  const R = ruin(cam); tf(R, 1250, 640, 0, .9);
  const hero = makeHero(cam); hero.place(520, 760, .9, false);
  const K = makeKnot(cam); K.place(1120, 760, .95, true);
  return t => {
   S.tick(t, 0, .4);
   hero.pose({lean: -2, head: lerp(-4, 4, seg(t, 5, 6)), shF: 18, elF: 26, shB: 8, elB: 10});
   hero.face({look: [3, -1], mouth: 'closed', brow: t > 8.4 ? .6 : .3});
   hero.wind = .4; hero.tick(t, ctx.talking('hero'));
   K.tick(t); K.reveal({body: 1, hand: 1, hem: 1, face: .9, eye: t > 8.2 ? 1 : .6});
   applyCam(cam, camAt([[0, 820, 520, 1], [4.8, 900, 500, 1.06], [8.2, 1060, 470, 1.18], [11, 1110, 440, 1.32]], t));
  };
 },
 // 6 — extreme close-up of the eye; something circular moves in the iris.
 eye(root) {
  page(root, '#060609');
  const E = g(root);
  h('ellipse', {cx: 800, cy: 450, rx: 900, ry: 520, fill: '#2a2a31'}, E);
  h('ellipse', {cx: 800, cy: 450, rx: 900, ry: 520, fill: 'url(#tj-ht2)', opacity: .25}, E);
  const white = path(E, 'M220,450 Q800,120 1380,450 Q800,760 220,450 Z', '#d6d9df', 7);
  const iris = g(E);
  h('circle', {cx: 800, cy: 450, r: 220, fill: grad(E, [[0, '#2a2f3c'], [.5, '#7d8597'], [.86, '#5a3c75'], [1, '#1b1424']], {radial: true}), stroke: INK, 'stroke-width': 6}, iris);
  for (let i = 0; i < 40; i++) {const a = i / 40 * Math.PI * 2; path(iris, `M${800 + Math.cos(a) * 90},${450 + Math.sin(a) * 90} L${800 + Math.cos(a) * 210},${450 + Math.sin(a) * 210}`, 'none', 2, {stroke: '#2b2e3a', opacity: .5});}
  const pupil = h('circle', {cx: 800, cy: 450, r: 82, fill: '#050507'}, iris);
  const ring = g(iris); h('circle', {cx: 800, cy: 450, r: 54, fill: 'none', stroke: '#7ff5ff', 'stroke-width': 4, opacity: .7}, ring); h('circle', {cx: 800, cy: 450, r: 30, fill: 'url(#tj-glow)', opacity: .5}, ring);
  h('circle', {cx: 860, cy: 390, r: 26, fill: '#fff', opacity: .85}, iris);
  const lidT = path(E, '', '#3a3a43', 7), lidB = path(E, '', '#3a3a43', 7);
  const hood = path(root, 'M-200,-200 L1800,-200 L1800,260 Q800,40 -200,260 Z', '#050508', 0);
  return t => {
   const open = 1 - (seg(t, 3.1, 3.3) - seg(t, 3.35, 3.6)), up = 120 + (330 - 120) * (1 - open);
   lidT.setAttribute('d', `M160,450 Q800,${up - 250} 1440,450 L1440,-200 L160,-200 Z`);
   lidB.setAttribute('d', `M160,450 Q800,${780 - (1 - open) * 330} 1440,450 L1440,1100 L160,1100 Z`);
   pupil.setAttribute('r', (82 - seg(t, .4, 1.4) * 22 + seg(t, 2, 2.6) * 30).toFixed(1));
   tf(ring, 0, 0, t * 40, 1); ring.setAttribute('opacity', (seg(t, 1.2, 1.8) * (1 - seg(t, 2.8, 3.2))).toFixed(2));
   tf(iris, Math.sin(t * 1.3) * 6, Math.cos(t * 1.1) * 3);
   applyCam(root, [800, 450, 1 + t * .05, 0]);
   void white; void hood;
  };
 },
 // 7 — eight flashes that cannot be read in time.
 montage(root) {
  const frames = [];
  const fr = build => {const f = g(root); f.style.display = 'none'; build(f); frames.push(f); return f;};
  fr(f => {page(f, '#2b0d12'); const s = g(f); h('rect', {x: -400, y: 520, width: 2400, height: 900, fill: '#12060a'}, s); path(s, 'M-400,520 L200,300 L500,420 L900,240 L1300,420 L2000,300 L2000,520 Z', '#3d1620', 3); const hr = makeHero(f); hr.place(800, 760, .8, false); hr.pose({head: 8}); hr.tick(0, false);});
  fr(f => {page(f, '#121625'); const a = makeHero(f), k = makeKnot(f); a.place(640, 800, .85, false); a.pose({head: 2}); a.tick(0, false); k.place(940, 800, .9, false); k.tick(0);});
  fr(f => {page(f, '#1c0f22'); const a = makeHero(f), v = makeVillain(f); a.place(620, 800, .85, false); a.face({look: [2, 0], mouth: 'closed'}); a.tick(0, false); v.place(980, 800, .82, true); v.tick(0, false);});
  fr(f => {page(f, '#d9c9a2'); const p = makePage(f, '◈'); tf(p.root || p, 800, 450, -4, 2.6);});
  fr(f => {page(f, '#08070c'); const c = cord(f, 300, 450, 1000); c.halo.setAttribute('opacity', '.9');});
  fr(f => {page(f, '#1a1820'); h('text', {x: 640, y: 470, 'font-size': 110, fill: '#d8d0bc', 'font-family': 'Georgia,serif', 'font-style': 'italic', transform: 'rotate(-3 640 470)'}, f).textContent = 'ҮШІН…'; const hd = makeHand(f, {noDevice: true}); tf(hd.root, 1040, 560, -28, .62); hd.grip(.8);});
  fr(f => {page(f, '#1a1820'); const hd = makeHand(f, {noDevice: true, skin: '#a8826a', skinD: '#7a5a46', jacket: '#4a4b53', cuff: '#2c2d33'}); tf(hd.root, 800, 600, -18, .68); hd.grip(.6);
   for (let i = 0; i < 9; i++) path(hd.root, `M${-50 + i * 12},${-40 + (i % 3) * 30} q10,6 20,0`, 'none', 2.5, {stroke: '#5c4334'});});
  fr(f => {page(f, '#020a10'); const G = makeGate(f, 800, 450, 230); G.set?.(1.2, 1);});
  const white = overlay(root, '#fff', {opacity: 0});
  const ht = overlay(root, 'url(#tj-ht2)', {opacity: .12});
  return t => {
   const i = Math.min(7, Math.floor(t / .7)), local = t - i * .7;
   frames.forEach((f, k) => {f.style.display = k === i ? '' : 'none';});
   const f = frames[i];
   tf(f, Math.sin(t * 40) * 6 * (local < .1 ? 1 : 0), 0, 0, 1 + local * .12);
   white.setAttribute('opacity', (local < .08 ? .7 : 0).toFixed(2));
   f.setAttribute('opacity', (t > 5.6 ? 1 - seg(t, 5.6, 6) : 1).toFixed(2));
   ht.setAttribute('opacity', (.1 + (i % 2) * .08).toFixed(2));
  };
 },
 // 8 — «Who are you?» — over-the-shoulder, the knot-keeper unmoving.
 who(root, ctx) {
  const cam = g(root), S = nightSteppe(cam, {town: false, seed: 13});
  const R = ruin(cam); tf(R, 1250, 640, 0, .9);
  const K = makeKnot(cam); K.place(1080, 780, .95, true);
  const back = makeHeroBack(cam); tf(back.root, 560, 1180, 0, 1.15);
  return t => {
   S.tick(t, 0, .3); K.tick(t);
   K.reveal({body: 1, hand: 1, hem: 1, face: t > 3 && t < 6.3 ? 1 : .7, eye: 1});
   applyCam(cam, camAt([[0, 900, 520, 1.15], [3, 980, 500, 1.22], [6.5, 920, 520, 1.18], [10, 1010, 480, 1.3]], t));
  };
 },
 // 9 — he comes closer and leaves a small cord with eleven knots on a stone; two sentences about Zulmat.
 stone(root, ctx) {
  const cam = g(root), S = nightSteppe(cam, {town: false, seed: 13});
  const rock = g(cam); path(rock, 'M700,770 L730,716 L800,690 L900,684 L980,700 L1030,744 L1040,770 Z', '#5c5a6e', 5);
  path(rock, 'M730,716 L800,722 L900,712 L980,700 M800,722 L790,770 M900,712 L930,770', 'none', 3, {stroke: '#3d3b4c'});
  path(rock, 'M740,712 L800,692 L900,686 L960,698 L900,706 L800,712 Z', '#7a7890', 0);
  path(rock, 'M700,770 L730,716 L800,690 L900,684 L980,700 L1030,744 L1040,770 Z', 'url(#tj-ht)', 0, {opacity: .2});
  const C = cord(cam, 800, 700, 180, {glow: true}); C.setAttribute('opacity', 0);
  const K = makeKnot(cam); K.place(1240, 800, .95, true);
  const hero = makeHero(cam); hero.place(420, 830, .9, false);
  return t => {
   S.tick(t, 0, .3); K.tick(t);
   const walk = easeInOut(seg(t, 0, 1.6)), kneel = seg(t, 1.4, 2) * (1 - seg(t, 2.6, 3.2));
   K.place(lerp(1240, 1040, walk), 800 + kneel * 30, .95, true);
   C.setAttribute('opacity', seg(t, 1.9, 2.3).toFixed(2)); C.halo.setAttribute('opacity', (.35 + Math.sin(t * 3) * .15).toFixed(2));
   const turn = seg(t, 7.6, 8.2);
   K.place(lerp(1240, 1040, walk) + turn * 40, 800 + kneel * 30, .95, turn < .5);
   hero.pose({lean: 2, head: -6, shF: 10, elF: 14}); hero.face({look: [2, 1], mouth: 'closed', brow: .5}); hero.wind = .3; hero.tick(t, false);
   applyCam(cam, camAt([[0, 920, 560, 1.05], [2.2, 880, 680, 1.6], [3.4, 960, 560, 1.2], [8, 1040, 520, 1.3], [11, 1060, 500, 1.36]], t));
  };
 },
 // 10 — «Wait!» — he dissolves into dust; Aibar runs after him; nobody.
 vanish(root, ctx) {
  const cam = g(root), S = nightSteppe(cam, {town: false, seed: 13});
  const K = makeKnot(cam); K.place(1120, 790, .95, false);
  const hero = makeHero(cam); hero.place(560, 800, .9, false);
  const r = rand(5), motes = Array.from({length: 60}, () => {const m = h('circle', {r: (2 + r() * 5).toFixed(1), fill: '#a99a8c', opacity: 0}, cam); m.vx = 40 + r() * 160; m.vy = -30 - r() * 90; m.x0 = 1080 + r() * 90; m.y0 = 440 + r() * 340; return m;});
  return t => {
   S.tick(t, 0, lerp(.5, 3, seg(t, .5, 1.5)));
   const go = seg(t, .8, 2.6);
   K.root.setAttribute('opacity', (1 - easeIn(go)).toFixed(2)); K.place(1120 + go * 40, 790, .95, false); K.tick(t);
   motes.forEach(m => {const k = seg(t, .8, 4); m.setAttribute('cx', (m.x0 + m.vx * k * 2).toFixed(0)); m.setAttribute('cy', (m.y0 + m.vy * k).toFixed(0)); m.setAttribute('opacity', (k > 0 ? (1 - k) * .55 : 0).toFixed(2));});
   const run = seg(t, 1.6, 4.4), ph = t * 9;
   hero.place(lerp(560, 1080, easeOut(run)), 800, .9, false);
   hero.pose(run > 0 && run < 1 ? {lean: 14, hipF: Math.sin(ph) * 30, hipB: -Math.sin(ph) * 30, kneeF: Math.max(0, -Math.cos(ph)) * 44, kneeB: Math.max(0, Math.cos(ph)) * 44, shF: -Math.sin(ph) * 30, shB: Math.sin(ph) * 30, elF: 50, elB: 50}
    : t < 1.6 ? {lean: 8, shF: 70, elF: 10, head: -4} : {lean: -4, head: 10, shF: 14, elF: 20});
   hero.face({look: [run >= 1 ? -2 : 3, 0], mouth: t < 2.4 ? 'shout' : 'closed', brow: .8}); hero.wind = .9; hero.tick(t, ctx.talking('hero'));
   applyCam(cam, camAt([[0, 840, 540, 1.1], [1.6, 900, 520, 1.15], [4.4, 1080, 520, 1.05], [7, 1100, 500, .95]], t));
  };
 },
 // 11 — the cord in his palm; the picture tears; on the wall behind him, a line in his own handwriting.
 wall(root) {
  const cam = g(root);
  h('rect', {x: -800, y: -600, width: 3200, height: 2200, fill: grad(cam, [[0, '#24222c'], [1, '#121118']])}, cam);
  const r = rand(21);
  for (let i = 0; i < 26; i++) {const x = -200 + (i % 7) * 300 + (Math.floor(i / 7) % 2) * 150, y = -100 + Math.floor(i / 7) * 220; path(cam, `M${x},${y} L${x + 280},${y + 6} L${x + 276},${y + 206} L${x - 4},${y + 200} Z`, '#2c2a35', 3);}
  const write = g(cam), text = 'ҮШІНШІ СҰРАҚТЫ ҚОЙМА';
  const txt = h('text', {x: 800, y: 330, 'text-anchor': 'middle', 'font-size': 96, fill: '#d8d0bc', 'font-family': 'Georgia,serif', 'font-style': 'italic', transform: 'rotate(-2 800 330)', 'letter-spacing': 4}, write);
  const red = h('text', {x: 806, y: 330, 'text-anchor': 'middle', 'font-size': 96, fill: '#ff2e5a', 'font-family': 'Georgia,serif', 'font-style': 'italic', transform: 'rotate(-2 800 330)', opacity: 0, 'letter-spacing': 4}, write);
  const cyan = h('text', {x: 794, y: 330, 'text-anchor': 'middle', 'font-size': 96, fill: '#3ff0ff', 'font-family': 'Georgia,serif', 'font-style': 'italic', transform: 'rotate(-2 800 330)', opacity: 0, 'letter-spacing': 4}, write);
  const hand = makeHand(cam, {noDevice: false}); tf(hand.root, 820, 1160, -8, 1.05); hand.grip(.35);
  const C = cord(cam, 640, 860, 320); C.halo.setAttribute('opacity', '.7');
  const slices = Array.from({length: 6}, (_, i) => h('rect', {x: -800, y: -200 + i * 230, width: 3200, height: 60 + r() * 60, fill: '#ffffff', opacity: 0}, root));
  return t => {
   const n = Math.round(text.length * seg(t, 2.6, 4.8));
   [txt, red, cyan].forEach(el => {el.textContent = text.slice(0, n);});
   const glitch = seg(t, 2.4, 2.6) * (1 - seg(t, 4.6, 5)), jit = glitch ? Math.sin(t * 90) * 14 : 0;
   red.setAttribute('opacity', (glitch * .7).toFixed(2)); cyan.setAttribute('opacity', (glitch * .7).toFixed(2));
   tf(red, jit, 0); tf(cyan, -jit, 0);
   slices.forEach((s, i) => s.setAttribute('opacity', (glitch && Math.sin(t * 60 + i * 2) > .7 ? .06 : 0).toFixed(2)));
   tf(cam, glitch ? Math.sin(t * 70) * 8 : 0, 0);
   hand.grip(.35 + seg(t, .2, 1.2) * .3);
   C.halo.setAttribute('opacity', (.5 + Math.sin(t * 4) * .2).toFixed(2));
   applyCam(cam, camAt([[0, 760, 820, 1.35], [2.2, 760, 760, 1.25], [4, 800, 420, 1.05], [9, 800, 380, 1.15]], t), glitch * 5, t);
  };
 },
 // 12 — Zulmat looks straight at us. Nothing is said.
 zulmat(root) {
  page(root, '#0a0510');
  h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: 'url(#tj-glow-v)', opacity: .35}, root);
  const v = makeVillain(root); v.place(800, 2010, 3.6, false);
  const ht = overlay(root, 'url(#tj-ht2)', {opacity: .15});
  return t => {
   v.pose({head: 0}); v.face({look: [0, 0], mouth: 'closed', brow: -.3}); v.tick(t, false);
   v.face({look: [-3, 0], mouth: 'closed', brow: -.4});
   applyCam(root, [lerp(830, 850, t / 2.5), lerp(300, 252, t / 2.5), 2.3 + t * .35, 0]);
   root.setAttribute('opacity', (1 - seg(t, 2.1, 2.5)).toFixed(2));
   void ht;
  };
 },
 // 13 — final: Aibar alone in the huge night steppe; the camera pulls far back.
 final(root, ctx) {
  const cam = g(root), S = nightSteppe(cam, {seed: 7});
  const hero = makeHero(cam); hero.place(1200, 760, .5, false);
  return t => {
   S.tick(t, 0, .8);
   hero.pose({head: -6, shF: 6, elF: 10, shB: 4}); hero.face({look: [0, -2], mouth: 'closed', brow: .4}); hero.wind = .6; hero.tick(t, false);
   applyCam(cam, camAt([[0, 1200, 600, 2.4], [11, 1240, 470, .7]], t));
   root.setAttribute('opacity', (seg(t, 0, 1.4) * (1 - seg(t, 10.2, 11))).toFixed(2));
  };
 },
 // 14 — black; the title.
 title(root) {
  page(root, '#000');
  const glow = h('ellipse', {cx: 800, cy: 430, rx: 520, ry: 140, fill: 'url(#tj-glow-v)', opacity: 0}, root);
  return t => {glow.setAttribute('opacity', (seg(t, .4, 1.6) * .25 * (1 - seg(t, 4, 5))).toFixed(2));};
 },
};
function easeInOut(k) {return ease(k);}

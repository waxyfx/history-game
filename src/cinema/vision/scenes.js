// MAP05 vision — shot builders (same kit and conventions as src/intro/scenes.js and src/cinema/knot).
import {h, g, path, tf, lerp, seg, rand, INK, nextId, makeHero, makeVillain, makeGate, applyCam, page, overlay} from '../../intro/art.js';

function grad(root, stops, {x2 = 0, y2 = 1, radial = false} = {}) {
 const id = nextId('vs-g'), d = h('defs', {}, root);
 const el = h(radial ? 'radialGradient' : 'linearGradient', radial ? {id} : {id, x1: 0, y1: 0, x2, y2}, d);
 stops.forEach(([o, c, a = 1]) => h('stop', {offset: o, 'stop-color': c, 'stop-opacity': a}, el));
 return `url(#${id})`;
}
// Cold moonlit steppe with fog bands (parallax: sky, ridge, plain, fog).
function coldSteppe(parent, seed = 11) {
 const S = {root: g(parent)}, r = rand(seed);
 h('rect', {x: -800, y: -400, width: 3200, height: 1900, fill: grad(S.root, [[0, '#070d1f'], [.5, '#1b2a4f'], [.8, '#3d4f78'], [1, '#6f7fa0']])}, S.root);
 S.sky = g(S.root);
 S.stars = Array.from({length: 110}, () => {const c = h('circle', {cx: -600 + r() * 2800, cy: -300 + r() * 700, r: (.6 + r() * 1.6).toFixed(1), fill: '#e6ecff'}, S.sky); c.ph = r() * 6; return c;});
 const moon = g(S.sky); tf(moon, 330, 170);
 h('circle', {r: 360, fill: 'url(#tj-glow)', opacity: .2}, moon);
 h('circle', {r: 52, fill: '#eef0ff', stroke: INK, 'stroke-width': 3}, moon);
 S.far = g(S.root);
 path(S.far, 'M-800,560 L-260,440 L120,500 L520,400 L900,470 L1260,380 L1700,460 L2400,420 L2400,1500 L-800,1500 Z', '#1d2747', 3);
 path(S.far, 'M520,400 L580,424 L640,414 M1260,380 L1320,404', 'none', 3, {stroke: '#9fb2df'});
 S.mid = g(S.root);
 h('rect', {x: -800, y: 600, width: 3200, height: 900, fill: grad(S.mid, [[0, '#2c3656'], [.6, '#161c30'], [1, '#07090f']])}, S.mid);
 path(S.mid, 'M-800,604 Q400,580 900,606 T2400,600', 'none', 3);
 S.fog = Array.from({length: 9}, (_, i) => {const e = h('ellipse', {cx: 0, cy: 0, rx: 380 + r() * 300, ry: 26 + r() * 30, fill: '#c9d4ee', opacity: (.06 + r() * .07).toFixed(3)}, S.root); e.x0 = r() * 2400; e.y0 = 560 + i * 34; e.sp = 14 + r() * 26; return e;});
 S.tick = (t, px = 0) => {
  S.stars.forEach(s => s.setAttribute('opacity', (.45 + .4 * Math.sin(t * 2 + s.ph)).toFixed(2)));
  tf(S.sky, px * .8, 0); tf(S.far, px * .55, 0); tf(S.mid, px * .3, 0);
  S.fog.forEach(e => {e.setAttribute('cx', (((e.x0 + t * e.sp) % 3200) - 800).toFixed(1)); e.setAttribute('cy', (e.y0 + Math.sin(t * .7 + e.x0) * 5).toFixed(1));});
 };
 return S;
}
// A tall stele with runes; runes[] light up one by one (cyan).
function stele(parent, x, y, s = 1) {
 const T = g(parent); tf(T, x, y, 0, s);
 path(T, 'M-150,0 L-140,-620 L0,-700 L140,-620 L150,0 Z', '#4b5160', 6);
 path(T, 'M-150,0 L-140,-620 L0,-700 L0,0 Z', '#3a3f4c', 0, {opacity: .6});
 path(T, 'M-60,-640 L0,-690 L60,-640 M-30,-610 L30,-610', 'none', 5, {stroke: '#20232c'});   // the ibex tamga
 const r = rand(5); T.runes = [];
 for (let col = 0; col < 3; col++) for (let row = 0; row < 9; row++) {
  const rx = -80 + col * 80, ry = -560 + row * 58, k = Math.floor(r() * 4);
  const d = [`M${rx},${ry} L${rx},${ry + 40} M${rx},${ry} L${rx + 18},${ry + 14}`, `M${rx},${ry} L${rx},${ry + 40} M${rx - 16},${ry + 22} L${rx},${ry + 8}`,
   `M${rx - 14},${ry} L${rx + 14},${ry + 40} M${rx + 14},${ry} L${rx - 14},${ry + 40}`, `M${rx},${ry} L${rx},${ry + 40} M${rx},${ry + 20} L${rx + 16},${ry + 34}`][k];
  T.runes.push(path(T, d, 'none', 6, {stroke: '#191b22'}));
 }
 h('rect', {x: -170, y: -10, width: 340, height: 30, fill: '#2b2f3a', stroke: INK, 'stroke-width': 5}, T);
 return T;
}
// The second Aibar: the same rig, a grey scarf, no device on the wrist, a steady cyan glint in the eyes.
function makeTwin(parent) {
 const t = makeHero(parent);
 t.root.querySelectorAll('[fill="#e98a2f"]').forEach(el => el.setAttribute('fill', '#9a9a8c'));
 t.root.querySelectorAll('[stroke="#b4561a"]').forEach(el => el.setAttribute('stroke', '#5f615c'));
 if (t.device) t.device.style.display = 'none';
 if (t.deviceGlow) t.deviceGlow.style.display = 'none';
 return t;
}
function cord(parent, x, y, len, {color = '#d9d4c7', glow = 1} = {}) {
 const C = g(parent); tf(C, x, y);
 path(C, `M0,0 C${len * .3},-20 ${len * .6},20 ${len},0`, 'none', 7, {stroke: color});
 C.knots = Array.from({length: 11}, (_, i) => {const k = (i + .5) / 11; return h('circle', {cx: len * k, cy: Math.sin(k * Math.PI * 2) * -9, r: i === 10 ? 14 : 10, fill: i === 10 ? '#3a2a44' : '#e9e3d4', stroke: INK, 'stroke-width': 3}, C);});
 C.halo = h('circle', {cx: C.knots[10].getAttribute('cx'), cy: C.knots[10].getAttribute('cy'), r: 60, fill: 'url(#tj-glow-v)', opacity: .6 * glow}, C);
 C.insertBefore(C.halo, C.firstChild);
 return C;
}

export const SCENES = {
 // 1 — the stone: slow push; runes catch light one by one.
 stone(root) {
  const cam = g(root), S = coldSteppe(cam);
  const T = stele(cam, 800, 900, .95);
  const glow = h('ellipse', {cx: 800, cy: 560, rx: 260, ry: 360, fill: 'url(#tj-glow)', opacity: 0}, cam);
  cam.insertBefore(glow, T);
  overlay(root, 'url(#tj-vig)');
  return t => {
   S.tick(t, -t * 8);
   const lit = Math.floor(seg(t, 1.5, 6.4) * T.runes.length);
   T.runes.forEach((p, i) => p.setAttribute('stroke', i < lit ? '#7ff5e4' : '#191b22'));
   glow.setAttribute('opacity', (seg(t, 2, 6) * .35).toFixed(2));
   applyCam(cam, [800, lerp(520, 470, t / 7), 1 + t * .045, 0]);
  };
 },
 // 2 — Zulmat: a silhouette in violet haze, his back to us; he does not turn.
 zulmat(root) {
  page(root, '#07040c');
  h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: 'url(#tj-glow-v)', opacity: .45}, root);
  const v = makeVillain(root); v.place(800, 860, 1.05, true);
  const ht = overlay(root, 'url(#tj-ht2)', {opacity: .18});
  return t => {
   v.pose({head: 0}); v.tick(t, false);
   v.root.setAttribute('opacity', (.55 + Math.sin(t * 9) * .08 * (t > 2.4 ? 1 : 0)).toFixed(2));
   v.root.setAttribute('filter', 'brightness(0.25)');
   applyCam(root, [800, 520, 1.02 + t * .03, 0]);
   root.setAttribute('opacity', (1 - seg(t, 3.5, 4)).toFixed(2));
   void ht;
  };
 },
 // 3 — the second Aibar steps out of the fog and stops; slow zoom to the face; the glint.
 twin(root) {
  const cam = g(root), S = coldSteppe(cam, 19);
  const tw = makeTwin(cam); tw.place(800, 900, .95, false);
  overlay(root, 'url(#tj-vig)');
  return t => {
   S.tick(t, 0);
   const walk = 1 - seg(t, 0, 2.6);
   tw.place(lerp(980, 800, seg(t, 0, 2.6)), 900, .95, true);
   tw.pose({head: walk > 0 ? 2 : 0}); tw.face({look: t > 3 ? [0, 0] : [-2, 0], mouth: 'closed', brow: -.2});
   tw.wind = .5; tw.tick(t, walk > 0);
   applyCam(cam, [lerp(800, 812, seg(t, 3, 7)), lerp(520, 432, seg(t, 3, 7)), 1 + seg(t, 3, 7) * 1.3, 0]);
  };
 },
 // 4 — the eleventh knot, and a second identical cord sliding over the first.
 knot(root) {
  page(root, '#08070c');
  const a = cord(root, 260, 450, 1080), b = cord(root, 260, 450, 1080, {color: '#9aa7b8', glow: 0});
  b.setAttribute('opacity', 0);
  return t => {
   a.halo.setAttribute('opacity', (.5 + Math.sin(t * 5) * .2).toFixed(2));
   tf(b, 260 + lerp(0, 16, seg(t, 1.4, 4)), 450 + lerp(0, -10, seg(t, 1.4, 4)));
   b.setAttribute('opacity', (seg(t, 1.2, 2.4) * .55).toFixed(2));
   applyCam(root, [lerp(800, 1180, seg(t, 0, 4.6)), 450, 1 + seg(t, 0, 4.6) * .9, 0]);
  };
 },
 // 5 — the Gate: two silhouettes, one on each side; neither steps in first.
 gate(root) {
  page(root, '#020a10');
  const G = makeGate(root, 800, 430, 250);
  const a = makeHero(root), b = makeTwin(root);
  a.place(470, 880, .7, false); b.place(1130, 880, .7, true);
  [a, b].forEach(x => x.root.setAttribute('filter', 'brightness(0.18)'));
  return t => {
   G.set?.(1 + t * .2, 1);
   a.pose({head: 2}); b.pose({head: 2}); a.tick(t, false); b.tick(t, false);
   applyCam(root, [800, 520, 1 + t * .05, 0]);
  };
 },
 // 6 — montage: the images return out of order.
 montage(root) {
  const frames = [];
  const fr = build => {const f = g(root); f.style.display = 'none'; build(f); frames.push(f); return f;};
  fr(f => {page(f, '#0b0f1c'); stele(f, 800, 960, .8);});
  fr(f => {page(f, '#100616'); const v = makeVillain(f); v.place(800, 860, 1, false); v.tick(0, false); v.root.setAttribute('filter', 'brightness(0.3)');});
  fr(f => {page(f, '#0c1220'); const tw = makeTwin(f); tw.place(800, 880, .9, false); tw.face({look: [0, 0], mouth: 'closed'}); tw.tick(0, false);});
  fr(f => {page(f, '#08070c'); cord(f, 300, 450, 1000);});
  fr(f => {page(f, '#020a10'); makeGate(f, 800, 450, 230);});
  fr(f => {page(f, '#0c1220'); const a = makeHero(f); a.place(800, 880, .9, false); a.face({look: [0, 0], mouth: 'closed'}); a.tick(0, false);});
  const white = overlay(root, '#fff', {opacity: 0});
  return t => {
   const i = Math.min(5, Math.floor(t / .66)), local = t - i * .66;
   frames.forEach((f, k) => {f.style.display = k === i ? '' : 'none';});
   tf(frames[i], Math.sin(t * 40) * 5 * (local < .1 ? 1 : 0), 0, 0, 1 + local * .14);
   white.setAttribute('opacity', (local < .07 ? .6 : 0).toFixed(2));
  };
 },
 // 7 — Aibar turns his head toward us; then his eye, straight into the camera (the viewer).
 look(root) {
  const A = g(root); page(A, '#0a0e18');
  h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: 'url(#tj-glow)', opacity: .12}, A);
  const a = makeHero(A); a.place(800, 1500, 2.6, false);
  const Ey = g(root); Ey.style.display = 'none'; page(Ey, '#060609');
  h('ellipse', {cx: 800, cy: 450, rx: 900, ry: 520, fill: '#2b2420'}, Ey);
  h('ellipse', {cx: 800, cy: 450, rx: 900, ry: 520, fill: 'url(#tj-ht2)', opacity: .25}, Ey);
  path(Ey, 'M200,450 Q800,110 1400,450 Q800,780 200,450 Z', '#e4ddd2', 7);
  const iris = g(Ey);
  h('circle', {cx: 800, cy: 450, r: 230, fill: grad(Ey, [[0, '#1d140f'], [.55, '#5a3a26'], [.9, '#2a1c14'], [1, '#120b08']], {radial: true}), stroke: INK, 'stroke-width': 6}, iris);
  for (let i = 0; i < 44; i++) {const an = i / 44 * Math.PI * 2; path(iris, `M${800 + Math.cos(an) * 96},${450 + Math.sin(an) * 96} L${800 + Math.cos(an) * 220},${450 + Math.sin(an) * 220}`, 'none', 2, {stroke: '#1a110c', opacity: .5});}
  const pupil = h('circle', {cx: 800, cy: 450, r: 88, fill: '#050507'}, iris);
  const glint = h('rect', {x: 700, y: 470, width: 70, height: 40, rx: 10, fill: '#7ff5e4', opacity: 0}, iris);   // the wrist device reflected in the eye
  h('circle', {cx: 868, cy: 384, r: 28, fill: '#fff', opacity: .85}, iris);
  const lidT = path(Ey, '', '#7c5a44', 7), lidB = path(Ey, '', '#7c5a44', 7);
  const ht = overlay(root, 'url(#tj-ht2)', {opacity: .1});
  return t => {
   const close = t >= 3.3;
   A.style.display = close ? 'none' : ''; Ey.style.display = close ? '' : 'none';
   if (!close) {
    const turn = seg(t, .6, 3);
    a.pose({head: lerp(10, 0, turn)}); a.face({look: [lerp(-3, 1, turn), 0], mouth: 'closed', brow: lerp(0, -.25, turn)});
    a.tick(t, false);
    applyCam(A, [lerp(860, 900, turn), lerp(470, 420, turn), lerp(1.05, 1.3, turn), 0]);
    return;
   }
   const k = t - 3.3, open = 1 - (seg(k, 2.6, 2.75) - seg(k, 2.8, 3.05));
   lidT.setAttribute('d', `M140,450 Q800,${-140 + 260 * open} 1460,450 L1460,-200 L140,-200 Z`);
   lidB.setAttribute('d', `M140,450 Q800,${1110 - 330 * open} 1460,450 L1460,1100 L140,1100 Z`);
   pupil.setAttribute('r', (88 - seg(k, .2, 1.6) * 26).toFixed(1));
   glint.setAttribute('opacity', (seg(k, .8, 1.6) * .7).toFixed(2));
   applyCam(Ey, [800, 450, 1 + k * .06, 0]);
   root.setAttribute('opacity', (1 - seg(t, 6.6, 7)).toFixed(2));
   void ht;
  };
 },
 final(root) {
  page(root, '#000');
  const glow = h('ellipse', {cx: 800, cy: 450, rx: 420, ry: 120, fill: 'url(#tj-glow)', opacity: 0}, root);
  return t => glow.setAttribute('opacity', (seg(t, 1, 3) * .14 * (1 - seg(t, 7, 8))).toFixed(2));
 },
 title(root) {
  page(root, '#000');
  const glow = h('ellipse', {cx: 800, cy: 430, rx: 520, ry: 140, fill: 'url(#tj-glow)', opacity: 0}, root);
  return t => {glow.setAttribute('opacity', (seg(t, .4, 1.6) * .22 * (1 - seg(t, 4, 5))).toFixed(2));};
 },
};

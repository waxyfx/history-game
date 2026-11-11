// Shot builders: each returns update(t) for shot-local time t (seconds).
import {h, g, path, tf, lerp, clamp, ease, easeOut, easeIn, seg, rand, bolt, speedLines, orn, INK, nextId,
 makeHero, makeVillain, makeHeroBack, makeBook, makePage, makeGate, labRoom, makeDoor, makeConsole, makePedestal,
 cityScape, steppe, makeHand, makeStoneTool, GLYPHS} from './art.js';

// Camera: keys = [[t, x, y, zoom, rot]] → look at (x,y) with eased interpolation.
function camAt(keys, t) {
 if (t <= keys[0][0]) return keys[0].slice(1);
 for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
  const a = keys[i - 1], b = keys[i], k = ease((t - a[0]) / (b[0] - a[0]));
  return [1, 2, 3, 4].map(j => lerp(a[j] ?? 0, b[j] ?? 0, k));
 }
 return keys.at(-1).slice(1);
}
export const motion = {shake: 1};
function applyCam(el, [x, y, z, r = 0], shake = 0, t = 0) {
 shake *= motion.shake;
 const sx = shake ? (Math.sin(t * 53) + Math.sin(t * 31)) * shake : 0, sy = shake ? (Math.cos(t * 47) + Math.sin(t * 37)) * shake : 0;
 el.setAttribute('transform', `translate(${(800 + sx).toFixed(1)} ${(450 + sy).toFixed(1)}) rotate(${r.toFixed(2)}) scale(${z.toFixed(4)}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})`);
}
// Comic panel: clipped content group + ink border. reveal(k) slides/fades the panel in.
function panel(parent, pts, bg) {
 const id = nextId('tj-p'), cp = h('clipPath', {id}, parent);
 const poly = pts.map(p => p.join(',')).join(' ');
 h('polygon', {points: poly}, cp);
 const wrap = g(parent), inner = g(wrap, {'clip-path': `url(#${id})`});
 if (bg) h('rect', {x: -200, y: -200, width: 2000, height: 1300, fill: bg}, inner);
 const content = g(inner);
 h('polygon', {points: poly, fill: 'none', stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round'}, wrap);
 const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
 return {wrap, content, reveal(k) {k = easeOut(k); wrap.setAttribute('opacity', k.toFixed(2)); wrap.setAttribute('transform', `translate(${cx} ${cy}) scale(${(.92 + .08 * k).toFixed(3)}) translate(${-cx} ${-cy})`);}};
}
function page(parent, color = '#ece0c4') {
 h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: color}, parent);
 h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: 'url(#tj-ht)', opacity: .06}, parent);
}
// Sparks burst (ink-outlined streaks with gravity).
function sparks(parent, x, y, n = 18, seed = 1, color = '#ffe28a') {
 const r = rand(seed), sp = Array.from({length: n}, () => ({a: r() * Math.PI * 2, v: 300 + r() * 500, l: 10 + r() * 22}));
 const el = path(parent, '', 'none', 4, {stroke: color});
 return t => {
  if (t < 0 || t > 1.4) {el.setAttribute('d', ''); return;}
  let d = ''; for (const s of sp) {const px = x + Math.cos(s.a) * s.v * t, py = y + Math.sin(s.a) * s.v * t + 600 * t * t; const vx = Math.cos(s.a), vy = Math.sin(s.a) + 1.2 * t; d += `M${px.toFixed(1)},${py.toFixed(1)} l${(-vx * s.l).toFixed(1)},${(-vy * s.l).toFixed(1)}`;}
  el.setAttribute('d', d); el.setAttribute('opacity', (1 - t / 1.4).toFixed(2));
 };
}
const walk = (ph, amt = 1) => ({hipF: Math.sin(ph) * 22 * amt, hipB: -Math.sin(ph) * 22 * amt, kneeF: Math.max(0, -Math.cos(ph)) * 30 * amt, kneeB: Math.max(0, Math.cos(ph)) * 30 * amt,
 shF: -Math.sin(ph) * 16 * amt, shB: Math.sin(ph) * 16 * amt, elF: 12, elB: 12, y: -Math.abs(Math.cos(ph)) * 6 * amt});
const mix = (a, b, k) => {const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) o[key] = lerp(a[key] ?? 0, b[key] ?? 0, k); return o;};
const overlay = (parent, fill, extra = {}) => h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill, ...extra}, parent);

export const SCENES = {
 city(root) {
  const cam = g(root), C = cityScape(cam);
  return t => {
   const k = ease(t / 9);
   tf(C.far, 0, k * 50); tf(C.mid, 0, -k * 20); tf(C.near, 0, -k * 70); tf(C.stars, 0, k * 60);
   C.tick(t);
   applyCam(cam, camAt([[0, 800, 520, 1], [9, 800, 380, 1.4]], t));
  };
 },

 lab(root, ctx) {
  const cam = g(root), L = labRoom(cam), G = makeGate(cam, 760, 400, 230);
  const D = makeDoor(cam, 1480, 640), P = makePedestal(cam, 1120, 700);
  const hero = makeHero(cam), C = makeConsole(cam, 440, 700);
  hero.place(250, 790, .78, false);
  return t => {
   G.set(t, .35); C.setPower(1);
   const typing = t < 5.2, sp = Math.sin(t * 22);
   const look = t > 5.2 ? ease(seg(t, 5.2, 5.8)) : 0;
   hero.pose({lean: 6 - look * 6, head: 8 - look * 12, shF: 62, elF: 44 + (typing ? sp * 6 : 0), shB: 54, elB: 40 + (typing ? -sp * 6 : 0), wrF: 10, wrB: 10, hipF: 4, hipB: -4});
   hero.face({look: [2, typing ? 2 : -1], mouth: t > 9 ? 'smile' : 'closed', brow: look * .2});
   hero.wind = .15; hero.tick(t, ctx.talking('hero'));
   P.book.glow.setAttribute('opacity', (.55 + Math.sin(t * 2) * .12).toFixed(2));
   applyCam(cam, camAt([[0, 760, 400, 1.08], [2.2, 760, 410, 1.12], [5, 500, 470, 1.3], [10, 470, 470, 1.36]], t));
  };
 },

 chronicle(root, ctx) {
  page(root, '#0d1418');
  const A = panel(root, [[30, 30], [800, 30], [740, 870], [30, 870]], '#11303a');
  const B = panel(root, [[830, 30], [1570, 30], [1570, 870], [770, 870]], '#0b1f28');
  // Left: hero close-up lit by the Chronicle.
  h('circle', {cx: 820, cy: 380, r: 700, fill: 'url(#tj-glow-g)', opacity: .35}, A.content);
  const hero = makeHero(A.content); hero.place(330, 1840, 3.4, false);
  h('rect', {x: 30, y: 30, width: 760, height: 840, fill: 'url(#tj-ht)', opacity: .08}, A.content);
  // Right: open book on its pedestal, ten glyphs orbiting.
  const P = makePedestal(B.content, 1180, 1010); tf(P.root, 1180, 1010, 0, 2.2);
  const orbit = g(B.content);
  const glyphs = GLYPHS.map(s => {const tx = h('text', {'text-anchor': 'middle', 'font-size': 46, fill: '#ffe7a6', stroke: INK, 'stroke-width': 1.5, 'font-family': 'Georgia,serif'}, orbit); tx.textContent = s; return tx;});
  return t => {
   A.reveal(seg(t, 0, .5)); B.reveal(seg(t, .3, 1));
   hero.pose({head: -4 + Math.sin(t * .8) * 1.5, shF: 10, shB: 6, elF: 20});
   hero.face({look: [2.5, -.5], mouth: t > 5 ? 'smile' : 'closed', brow: .2});
   hero.wind = .1; hero.tick(t, false);
   glyphs.forEach((tx, i) => {const a = i / 10 * Math.PI * 2 + t * .35; tx.setAttribute('x', (1180 + Math.cos(a) * 280).toFixed(1)); tx.setAttribute('y', (520 + Math.sin(a) * 90).toFixed(1)); tx.setAttribute('opacity', (.55 + .45 * Math.sin(a)).toFixed(2));});
   P.book.glow.setAttribute('opacity', (.6 + Math.sin(t * 3) * .15).toFixed(2));
   applyCam(root, [800, 450, 1 + t * .006, 0]);
  };
 },

 alarm(root, ctx) {
  const cam = g(root), L = labRoom(cam), G = makeGate(cam, 760, 400, 230);
  const P = makePedestal(cam, 1040, 700), D = makeDoor(cam, 1430, 640);
  const vil = makeVillain(cam), hero = makeHero(cam), C = makeConsole(cam, 400, 700);
  hero.place(220, 800, .8, false);
  const red = overlay(root, '#ff1e3c', {style: 'mix-blend-mode:multiply', opacity: 0});
  return t => {
   G.set(t, .5); C.setPower(1.4, true);
   const pulse = (Math.sin(t * Math.PI * 2 / .9) + 1) / 2;
   red.setAttribute('opacity', (.18 + pulse * .22).toFixed(2));
   L.lamps.forEach(l => l.setAttribute('opacity', (pulse * .9).toFixed(2)));
   const open = easeOut(seg(t, 2.4, 3.2)); D.set(open);
   const wk = seg(t, 3.2, 6.2), vx = lerp(1430, 1220, ease(wk));
   vil.place(vx, 645, .76, true);
   vil.root.style.filter = `brightness(${lerp(.05, 1, seg(t, 3.6, 5.6)).toFixed(2)})`;
   vil.pose(wk > 0 && wk < 1 ? walk(t * 6.2, 1) : {shF: 6, shB: -4, elF: 18, elB: 10});
   vil.coatSwing = wk > 0 && wk < 1 ? Math.sin(t * 6.2) * 4 : 0;
   vil.face({mouth: 'smirk', look: [-1, 0]}); vil.tick(t, ctx.talking('villain'));
   const turn = ease(seg(t, .3, 1.2));
   hero.pose({lean: 6 - turn * 10, head: 8 - turn * 14, shF: lerp(62, 20, turn), elF: lerp(44, 70, turn), shB: lerp(54, 10, turn), elB: 30, hipF: 4, hipB: -4});
   hero.face({look: [3, -1], brow: t > 4.6 ? -1 : lerp(0, .8, turn), mouth: t > 4.6 ? 'shout' : turn > .5 ? 'open' : 'closed'});
   hero.wind = .2; hero.tick(t, ctx.talking('hero'));
   applyCam(cam, camAt([[0, 800, 450, 1.02], [4, 860, 440, 1.04], [9, 760, 430, 1.1]], t), .8, t);
  };
 },

 villain(root, ctx) {
  const cam = g(root);
  overlay(cam, '#120812');
  h('circle', {cx: 1250, cy: 300, r: 620, fill: 'url(#tj-glow)', opacity: .35}, cam);
  h('circle', {cx: 300, cy: 900, r: 700, fill: 'url(#tj-glow-r)', opacity: .5}, cam);
  for (let i = 0; i < 9; i++) path(cam, `M${i * 200 - 100},-200 L${i * 200 + 60},1100`, 'none', 2, {stroke: '#2a1626'});
  const vil = makeVillain(cam); vil.place(900, 2040, 3.5, true, -3);
  const rim = h('circle', {cx: 600, cy: 420, r: 260, fill: 'url(#tj-glow-r)', opacity: .35, style: 'mix-blend-mode:screen'}, cam);
  overlay(cam, 'url(#tj-vig)');
  return t => {
   const gest = ease(seg(t, 4.4, 5.2));
   vil.pose({head: -4 + Math.sin(t * .9) * 2 + gest * 4, shF: lerp(8, 50, gest), elF: lerp(20, 100, gest), wrF: gest * -30, shB: 8, elB: 20});
   vil.face({mouth: 'smirk', look: [-1.5, -1], brow: -.6});
   vil.tick(t, ctx.talking('villain'));
   rim.setAttribute('opacity', (.3 + Math.sin(t * 6) * .08).toFixed(2));
   applyCam(cam, camAt([[0, 820, 470, 1], [9, 840, 440, 1.14, 1.5]], t));
  };
 },

 standoff(root, ctx) {
  const cam = g(root), L = labRoom(cam), G = makeGate(cam, 800, 330, 270);
  const P = makePedestal(cam, 800, 850); tf(P.root, 800, 850, 0, 1.05);
  const hero = makeHero(cam), vil = makeVillain(cam);
  hero.place(420, 860, .92, false); vil.place(1190, 860, .9, true);
  const red = overlay(root, '#ff1e3c', {style: 'mix-blend-mode:multiply', opacity: .15});
  return t => {
   G.set(t, .55);
   red.setAttribute('opacity', (.12 + (Math.sin(t * 7) + 1) * .06).toFixed(2));
   const point = ease(seg(t, .6, 1.4)) * (1 - ease(seg(t, 4.6, 5.2)));
   vil.pose({shF: lerp(8, 70, point), elF: lerp(16, 6, point), shB: 6, elB: 14, head: -2});
   vil.face({mouth: 'smirk', look: [-1, 0], brow: -.5}); vil.tick(t, ctx.talking('villain'));
   const fist = ease(seg(t, 4.8, 5.4));
   hero.pose({lean: fist * 6, shF: lerp(10, 50, fist), elF: lerp(20, 110, fist), shB: -6, elB: 20, hipF: 6, hipB: -6, head: -fist * 4});
   hero.face({look: [2, -.5], brow: lerp(-.4, -1, fist), mouth: fist > .2 ? 'shout' : 'grit'});
   hero.wind = .3; hero.tick(t, ctx.talking('hero'));
   applyCam(cam, camAt([[0, 800, 520, 1.02], [9, 800, 540, 1.14]], t));
  };
 },

 key(root, ctx) {
  const cam = g(root);
  overlay(cam, '#0a1a20');
  const C = makeConsole(cam, 800, 1180); tf(C.root, 800, 1180, 0, 3.4);
  const pct = h('text', {x: 1220, y: 250, 'font-size': 120, 'font-weight': 800, fill: '#ff6b8f', stroke: INK, 'stroke-width': 3, 'text-anchor': 'middle', 'font-family': 'Rubik,Manrope,Arial,sans-serif'}, cam);
  const hand = makeHand(cam, {jacket: '#2c1631', cuff: '#d4214f', skin: '#151217', skinD: '#0a080b', noDevice: true});
  const key = g(hand.root); path(key, 'M-8,40 L8,40 L8,190 L-8,190 Z', '#9b98a8', 3); path(key, 'M0,170 L26,215 L0,270 L-26,215 Z', '#ff3d9a', 3); const kg = h('circle', {cx: 0, cy: 220, r: 80, fill: 'url(#tj-glow-v)', opacity: .8}, key);
  hand.root.insertBefore(key, hand.root.firstChild);
  const flash = h('circle', {cx: 1110, cy: 720, r: 500, fill: 'url(#tj-glow-v)', opacity: 0}, cam);
  const sp = sparks(cam, 1110, 720, 22, 4, '#ff9ee8');
  return t => {
   const k = easeOut(seg(t, 0, .6));
   tf(hand.root, lerp(1360, 1110, k), lerp(-150, 480 - 0, k), lerp(-30, -8, k), 1.1);
   hand.grip(1);
   const p = t < 1.4 ? 1 : t < 2.6 ? 1.4 : 1.8; pct.textContent = Math.round(p * 100) + '%';
   C.setPower(p, t > .6);
   flash.setAttribute('opacity', (t > .6 ? (.5 + Math.sin(t * 20) * .2) * (1 - seg(t, .6, 5) * .3) : 0).toFixed(2));
   kg.setAttribute('opacity', (.6 + Math.sin(t * 15) * .3).toFixed(2));
   sp(t - .6);
   applyCam(cam, camAt([[0, 900, 450, 1], [5.5, 960, 470, 1.12, -2]], t), t > .6 ? 2 : 0, t);
  };
 },

 struggle(root, ctx) {
  page(root);
  const cam = g(root);
  const A = panel(cam, [[40, 40], [830, 40], [720, 430], [40, 430]], '#7fe0e0');
  const B = panel(cam, [[860, 40], [1560, 40], [1560, 430], [750, 430]], '#3b1440');
  const Cp = panel(cam, [[40, 460], [1560, 460], [1560, 860], [40, 860]], '#10262c');
  // P1: hero lunges (speed lines).
  const sl1 = speedLines(A.content, 600, 220, 60, 900, 70, '#fff', 2);
  const hero1 = makeHero(A.content); hero1.place(330, 580, .82, false);
  // P2: grapple over the closed Chronicle.
  h('circle', {cx: 1150, cy: 230, r: 380, fill: 'url(#tj-glow-v)', opacity: .7}, B.content);
  const sl2 = speedLines(B.content, 1150, 230, 80, 900, 50, '#ff9ee8', 5);
  const hero2 = makeHero(B.content), vil2 = makeVillain(B.content);
  hero2.place(960, 665, 1.25, false); vil2.place(1340, 700, 1.18, true);
  const book2 = makeBook(B.content, false); tf(book2.root, 1150, 260, -8, .9);
  const sp2 = sparks(B.content, 1150, 250, 16, 9, '#ff9ee8');
  // P3: villain lifts the book; hero slams into the console.
  const L3 = g(Cp.content); labRoom(L3); tf(L3, -50, 240, 0, .88);
  const G3 = makeGate(Cp.content, 880, 640, 130);
  const C3 = makeConsole(Cp.content, 300, 880); tf(C3.root, 300, 880, -6, .9);
  const hero3 = makeHero(Cp.content), vil3 = makeVillain(Cp.content);
  const book3 = makeBook(Cp.content, false);
  const sp3 = sparks(Cp.content, 330, 760, 26, 12);
  return t => {
   A.reveal(seg(t, 0, .4)); B.reveal(seg(t, 4, 4.5)); Cp.reveal(seg(t, 8.3, 8.8));
   // P1
   sl1.setAttribute('transform', `rotate(${(Math.sin(t * 40) * 1.2).toFixed(2)} 600 220)`);
   const l = easeOut(seg(t, 0, .6));
   hero1.pose({lean: 26 * l, hipF: 50 * l, kneeF: 35 * l, hipB: -36 * l, kneeB: 40 * l, shF: 95 * l, elF: 10, shB: 80 * l, elB: 20, head: -16 * l, wrF: -20});
   hero1.face({brow: -1, mouth: 'shout', look: [3, 0]}); hero1.wind = 1; hero1.tick(t, ctx.talking('hero'));
   // P2
   const j = Math.sin(t * 30) * 2;
   hero2.pose({lean: 14, shF: 82 + j, elF: 26, shB: 70 - j, elB: 30, head: -6});
   hero2.face({brow: -1, mouth: 'grit', look: [3, 0]}); hero2.wind = .8; hero2.tick(t, false);
   vil2.pose({lean: 10, shF: 80 - j, elF: 30, shB: 64 + j, elB: 36, head: -4});
   vil2.face({brow: -1, mouth: t > 5.1 ? 'grit' : 'grit', look: [-2, 0]}); vil2.tick(t, ctx.talking('villain'));
   tf(book2.root, 1150 + j * 3, 260, -8 + j, .9);
   sl2.setAttribute('transform', `rotate(${(t * 12).toFixed(1)} 1150 230)`);
   sp2(t - 4.3);
   // P3
   const f = easeOut(seg(t, 8.5, 9.1));
   hero3.place(lerp(600, 380, f), 830, .64, false, lerp(0, -24, f));
   hero3.pose({lean: -20 * f, shF: 60 * f, shB: 110 * f, elF: 30, elB: 50, hipF: 40 * f, kneeF: 50 * f, hipB: 10, kneeB: 30, head: 10 * f});
   hero3.face({brow: .4, mouth: f > .2 ? 'open' : 'grit', blink: f > .3 && f < .9 ? 1 : 0}); hero3.wind = .7; hero3.tick(t, false);
   vil3.place(1230, 840, .64, true);
   const lift = ease(seg(t, 9.2, 10.2));
   vil3.pose({shF: lerp(60, 165, lift), elF: lerp(30, 10, lift), shB: 20, elB: 30, lean: -4 * lift, head: -6 * lift});
   vil3.face({mouth: lift > .5 ? 'smirk' : 'grit', brow: -.6, look: [-1, -1]}); vil3.tick(t, false);
   tf(book3.root, lerp(1120, 1190, lift), lerp(690, 500, lift), 10, .45);
   G3.set(t, .8, 'hot'); sp3(t - 8.8);
   const page = t < 4 ? [430, 235, 1.75] : t < 8.3 ? [1150, 235, 1.75] : t < 12.2 ? [800, 640, 1.1] : [800, 450, 1];
   const prev = t < 4 ? page : t < 4.5 ? [430, 235, 1.75] : t < 8.3 ? page : t < 8.8 ? [1150, 235, 1.75] : t < 12.2 ? page : [800, 640, 1.1];
   const k = t < 4 ? 1 : t < 4.5 ? ease(seg(t, 4, 4.5)) : t < 8.3 ? 1 : t < 8.8 ? ease(seg(t, 8.3, 8.8)) : t < 12.2 ? 1 : ease(seg(t, 12.2, 13.4));
   applyCam(cam, [lerp(prev[0], page[0], k), lerp(prev[1], page[1], k), lerp(prev[2], page[2], k), 0], t > 8.8 && t < 10 ? 6 * (1 - seg(t, 8.8, 10)) : t > 4.3 && t < 5 ? 3 : 0, t);
  };
 },

 tear(root, ctx) {
  const cam = g(root);
  overlay(cam, '#160a1c');
  h('circle', {cx: 800, cy: -100, r: 900, fill: 'url(#tj-glow-v)', opacity: .8}, cam);
  for (let i = 0; i < 20; i++) path(cam, `M${800 + Math.cos(i / 20 * 6.28) * 2000},${-100 + Math.sin(i / 20 * 6.28) * 2000} L800,-100`, 'none', 3, {stroke: '#ff9ee8', opacity: .25});
  const halves = [-1, 1].map(s => {const hg = g(cam); path(hg, `M0,-110 L${s * 160},-110 L${s * 168},110 L0,110 Z`, '#5b3416', 4); path(hg, `M${s * 18},-90 L${s * 140},-90 L${s * 146},90 L${s * 18},90 Z`, 'none', 4, {stroke: '#e2b45a'}); orn(hg, s * 80, 0, 90, '#e2b45a'); path(hg, `M0,-110 L${s * 14},-90 L${s * 10},-50 L${s * 18},-20 L${s * 6},20 L${s * 16},60 L0,110`, '#fbe9bd', 3); return hg;});
  const gl = [-1, 1].map(s => {const hd = makeHand(cam, {jacket: '#2c1631', cuff: '#d4214f', skin: '#151217', skinD: '#0a080b', noDevice: true}); hd.grip(.8); return {hd, s};});
  const pages = GLYPHS.map(s => makePage(cam, s));
  const r = rand(5), pr = pages.map(() => ({a: r() * Math.PI * 2, v: .6 + r() * .6, spin: (r() - .5) * 720, d: r() * .5}));
  return t => {
   const k = easeOut(seg(t, .3, 1.2));
   halves.forEach((hg, i) => {const s = i ? 1 : -1; tf(hg, 800 + s * k * 120, 520 + k * 40, s * k * 24, 1.6);});
   gl.forEach(({hd, s}) => tf(hd.root, 800 + s * (290 + k * 140), 560 + k * 40, s * (90 - k * 10), .9));
   pages.forEach((p, i) => {
    const q = clamp((t - .5 - pr[i].d) / 3.6);
    const x = 800 + Math.cos(pr[i].a) * 260 * q * pr[i].v * 2 + Math.sin(q * 7 + i) * 60 * q;
    const y = 520 - q * 760 * pr[i].v + Math.cos(q * 6 + i) * 30;
    tf(p, x, y, pr[i].spin * q, (1.4 - q * .6) * (q > 0 ? 1 : 0));
    p.setAttribute('opacity', q > 0 ? 1 : 0);
   });
   applyCam(cam, camAt([[0, 800, 520, 1.08], [8, 800, 430, .96, 2]], t), t < 1.4 ? 3 * (1 - seg(t, .3, 1.4)) : t > 7.2 ? 4 : 0, t);
  };
 },

 overload(root, ctx) {
  const cam = g(root), L = labRoom(cam), G = makeGate(cam, 800, 360, 270);
  const C = makeConsole(cam, 300, 760), hero = makeHero(cam), vil = makeVillain(cam);
  hero.place(150, 820, .78, false);
  const bolts = g(cam), r = rand(17);
  const boltEls = Array.from({length: 6}, () => [path(bolts, '', 'none', 14, {stroke: '#c48bff', opacity: .35}), path(bolts, '', 'none', 4, {stroke: '#fff'})]);
  const ends = [[300, -100], [1300, -100], [240, 640], [1360, 640], [800, -100], [1500, 300]];
  const pages = GLYPHS.map(s => makePage(cam, s));
  const shards = g(cam), sr = rand(23), sh = Array.from({length: 40}, () => ({x: (sr() - .5) * 120, y: -sr() * 330, s: 6 + sr() * 14, d: sr() * 2.2, spin: sr() * 600}));
  const shardEls = sh.map(o => path(shards, `M0,${-o.s} L${o.s * .8},${o.s * .6} L${-o.s * .8},${o.s * .4} Z`, sr() > .5 ? '#5a1e7a' : '#1a0a22', 1.5));
  const red = overlay(root, '#9b2cff', {style: 'mix-blend-mode:screen', opacity: .1});
  let lastBolt = -1;
  return t => {
   const power = 1 + seg(t, 0, 6);
   G.set(t, power, 'hot'); C.setPower(2.5, true);
   L.winCrack.style.display = t > 3 ? '' : 'none';
   if (Math.floor(t * 12) !== lastBolt) {
    lastBolt = Math.floor(t * 12);
    boltEls.forEach(([a, b], i) => {const ang = r() * Math.PI * 2, sx = 800 + Math.cos(ang) * 270, sy = 360 + Math.sin(ang) * 270; const [ex, ey] = ends[i]; const d = r() < .75 ? bolt(sx, sy, ex + (r() - .5) * 200, ey, r, 10, 50) : ''; a.setAttribute('d', d); b.setAttribute('d', d);});
   }
   red.setAttribute('opacity', (.08 + Math.random() * .1).toFixed(2));
   // Hero holds on to the console.
   hero.pose({lean: -14, shF: 70, elF: 10, shB: 40, elB: 30, hipF: -10, kneeF: 20, hipB: -30, kneeB: 30, head: -6});
   hero.face({brow: -1, mouth: 'grit', look: [3, -1]}); hero.wind = -.8; hero.tick(t, false);
   // Villain is pulled in and dissolves into shadows.
   const pull = easeIn(seg(t, 4.4, 9.6));
   vil.place(lerp(1180, 900, pull), lerp(830, 520, pull), lerp(.82, .5, pull), true, lerp(0, -40, pull));
   vil.pose({lean: -20 - pull * 20, shF: 120, elF: 20, shB: 140, elB: 10, hipF: 20, hipB: -40, kneeB: 40, head: 10});
   vil.face({brow: t > 7.6 ? -1 : 1, mouth: 'shout', look: [-2, -1]}); vil.tick(t, ctx.talking('villain'));
   vil.root.setAttribute('opacity', (1 - seg(t, 8.4, 10)).toFixed(2));
   vil.root.style.filter = `brightness(${(1 - seg(t, 7.2, 9.4) * .85).toFixed(2)}) saturate(${(1 + seg(t, 7.2, 9.4)).toFixed(2)})`;
   sh.forEach((o, i) => {const q = clamp((t - 7.2 - o.d) / 1.6); const x0 = lerp(1180, 900, pull) + o.x, y0 = lerp(830, 520, pull) + o.y * lerp(.82, .5, pull);
    tf(shardEls[i], lerp(x0, 800, easeIn(q)), lerp(y0, 360, easeIn(q)), o.spin * q, q > 0 && q < 1 ? 1 : 0);});
   pages.forEach((p, i) => {const a = i / 10 * Math.PI * 2 + t * (1.5 + t * .3), rr = 420 * (1 - seg(t, 1, 11) * .9); tf(p, 800 + Math.cos(a) * rr, 360 + Math.sin(a) * rr * .6, t * 200 + i * 36, .7 * (1 - seg(t, 8, 11.5)));});
   applyCam(cam, camAt([[0, 800, 450, 1.0], [6, 820, 440, 1.06], [12, 800, 420, 1.12]], t), 2 + seg(t, 0, 12) * 6, t);
  };
 },

 decision(root, ctx) {
  const cam = g(root);
  overlay(cam, '#160b22');
  h('circle', {cx: 1500, cy: 400, r: 900, fill: 'url(#tj-glow-v)', opacity: .8}, cam);
  const lines = speedLines(cam, 1500, 420, 200, 1600, 60, '#e5c3ff', 8); lines.setAttribute('opacity', .5);
  path(cam, 'M600,700 L1700,640 L1700,672 L600,732 Z', '#3a4a52', 4);
  const hero = makeHero(cam); hero.place(560, 1620, 2.5, false);
  overlay(cam, 'url(#tj-vig)');
  return t => {
   const rel = ease(seg(t, 5.6, 6.2));
   hero.pose({lean: 4 + rel * 18, shF: lerp(80, 120, rel), elF: lerp(10, 0, rel), wrF: -10, head: -6 + Math.sin(t * 9) * 1, shB: 30});
   hero.face({brow: t > 4 ? -1 : -.4, mouth: t > 4 ? 'shout' : 'grit', look: [3, 0]});
   hero.wind = -1; hero.tick(t, ctx.talking('hero'));
   lines.setAttribute('transform', `rotate(${(t * 25).toFixed(1)} 1500 420)`);
   applyCam(cam, camAt([[0, 760, 470, 1], [5.6, 790, 460, 1.08], [6.5, 1300, 420, 2.4]], t), 2.5, t);
  };
 },

 tunnel(root, ctx) {
  const cam = g(root);
  const hero = makeHero(cam), fx = ctx.canvas, c = fx.getContext('2d'), r = rand(31);
  const streaks = Array.from({length: ctx.low ? 90 : 180}, () => ({a: r() * Math.PI * 2, z: r(), hue: r()}));
  const glyphs = Array.from({length: 24}, (_, i) => ({a: r() * Math.PI * 2, z: r(), s: GLYPHS[i % 10]}));
  return (t, dt) => {
   const W = fx.width, H = fx.height, cx = W / 2, cy = H / 2, S = Math.min(W, H);
   const warm = seg(t, 5.5, 8);
   const bg = c.createRadialGradient(cx, cy, 0, cx, cy, S);
   bg.addColorStop(0, warm > 0 ? `rgba(255,${200 + warm * 40},${150 + warm * 80},1)` : '#fff');
   bg.addColorStop(.18, `hsl(${lerp(280, 40, warm)},80%,${lerp(55, 70, warm)}%)`);
   bg.addColorStop(.6, `hsl(${lerp(250, 25, warm)},70%,${lerp(18, 35, warm)}%)`);
   bg.addColorStop(1, '#05030a');
   c.fillStyle = bg; c.fillRect(0, 0, W, H);
   c.lineCap = 'round';
   for (const s of streaks) {
    s.z += dt * (1.2 + t * .25); if (s.z > 1) {s.z -= 1; s.a = r() * Math.PI * 2;}
    const z0 = s.z ** 2.2 * S * .9, z1 = (s.z + .06) ** 2.2 * S * .9, a = s.a + t * .6;
    c.strokeStyle = `hsla(${(s.hue * 60 + lerp(260, 30, warm)) % 360},90%,75%,${s.z.toFixed(2)})`;
    c.lineWidth = 1 + s.z * 5 * S / 900;
    c.beginPath(); c.moveTo(cx + Math.cos(a) * z0, cy + Math.sin(a) * z0); c.lineTo(cx + Math.cos(a) * z1, cy + Math.sin(a) * z1); c.stroke();
   }
   c.font = `${Math.round(S / 18)}px Georgia,serif`; c.textAlign = 'center';
   for (const gl of glyphs) {
    gl.z += dt * .5; if (gl.z > 1) gl.z -= 1;
    const d = gl.z ** 2 * S * .8, a = gl.a - t * .4;
    c.globalAlpha = Math.min(1, gl.z * 1.5); c.fillStyle = '#ffe9a8';
    c.save(); c.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d); c.scale(.4 + gl.z * 1.6, .4 + gl.z * 1.6); c.fillText(gl.s, 0, 0); c.restore();
   }
   c.globalAlpha = 1;
   hero.place(800, 450 + 230 * .5, .5, false, t * 70);
   hero.pose({shF: 150, elF: 20, shB: -130, elB: 30, hipF: 40, kneeF: 30, hipB: -30, kneeB: 50, lean: 0});
   hero.face({brow: 1, mouth: 'open', look: [0, 0], blink: 0}); hero.wind = .9; hero.tick(t, false);
   applyCam(cam, [800, 450, lerp(1.4, .5, t / 8.5), 0], 3, t);
  };
 },

 wake(root, ctx) {
  const cam = g(root), S = steppe(cam, {w: 2600, seed: 4});
  const lids = g(root), top = path(lids, '', '#000', 0), bot = path(lids, '', '#000', 0);
  return t => {
   S.tick(t);
   tf(S.eagle, 1480 + Math.cos(t * .5) * 260, 250 + Math.sin(t * .5) * 70, Math.cos(t * .5) * 12, 1.1);
   const o = t < .6 ? 0 : t < 1.2 ? seg(t, .6, 1.2) * .4 : t < 1.7 ? .4 - seg(t, 1.2, 1.7) * .35 : ease(seg(t, 1.7, 3.2));
   const gap = o * 560;
   top.setAttribute('d', `M-100,-100 L1700,-100 L1700,${450 - gap} Q800,${450 - gap - 140 * o} -100,${450 - gap} Z`);
   bot.setAttribute('d', `M-100,1000 L1700,1000 L1700,${450 + gap} Q800,${450 + gap + 140 * o} -100,${450 + gap} Z`);
   const bl = ctx.low ? 0 : 5 * (1 - seg(t, 1, 3.4)); ctx.svg.style.filter = bl > .05 ? `blur(${bl.toFixed(1)}px)` : '';
   applyCam(cam, camAt([[0, 1500, 300, 1.15, -8], [6, 1500, 360, 1.05, -2]], t));
  };
 },

 steppe(root, ctx) {
  ctx.svg.style.filter = '';
  const cam = g(root), S = steppe(cam, {w: 2600, seed: 4});
  const hero = makeHero(cam); hero.place(560, 960, .7, false);
  return t => {
   S.tick(t); S.runHerd(t, 1900, 70);
   tf(S.eagle, 1500 - t * 60, 230 + Math.sin(t * .8) * 30, -6, .7);
   const up = ease(seg(t, 0, 2.4)), lift = ease(seg(t, 5.3, 6)) * (1 - ease(seg(t, 9, 9.6))), pt = ease(seg(t, 9.4, 10.2));
   hero.place(560, 960, .7, false);
   hero.pose({lean: lerp(34, 0, up), hipF: lerp(70, 6, up), kneeF: lerp(100, 0, up), hipB: lerp(-10, -6, up), kneeB: lerp(120, 0, up), y: lerp(70, 0, up),
    shF: Math.max(lerp(30, 10, up), lift * 80, pt * 100), elF: Math.max(lift * 95, 10), shB: 4, elB: 16, head: lift * 10 + (t > 2.4 && t < 5 ? Math.sin((t - 2.4) * 2.4) * 8 : 0) - pt * 4});
   hero.face({look: lift > .5 ? [2, 2.5] : [2.5, -1], brow: .4, mouth: 'closed', blink: 0}); hero.wind = .45; hero.tick(t, ctx.talking('hero'));
   applyCam(cam, camAt([[0, 1000, 520, 1.06], [13, 1220, 500, 1.0]], t));
  };
 },

 tool(root, ctx) {
  page(root, '#0f1316');
  const A = panel(root, [[30, 30], [790, 30], [730, 870], [30, 870]], '#8a7a4c');
  const B = panel(root, [[820, 30], [1570, 30], [1570, 870], [760, 870]], '#e9b787');
  // A: ground close-up with the chopper.
  const r = rand(8);
  for (let i = 0; i < 18; i++) {const x = 60 + r() * 680, y = 500 + r() * 360; path(A.content, `M${x},${y} q${12 + r() * 20},-${6 + r() * 8} ${30 + r() * 20},0 q-10,${8 + r() * 6} -${30 + r() * 20},0Z`, '#7a6a48', 2.5);}
  for (let i = 0; i < 26; i++) {const x = 40 + r() * 720; path(A.content, `M${x},880 Q${x + (r() - .5) * 60},${700 - r() * 160} ${x + (r() - .5) * 140},${520 + r() * 200}`, 'none', 4, {stroke: '#e8d8a0'});}
  const tool = makeStoneTool(A.content);
  const hand = makeHand(A.content);
  // B: hero looks at the golden light.
  const SB = steppe(B.content, {w: 2000, seed: 9}); tf(SB.root, -500, 120, 0, .9);
  const hero = makeHero(B.content); hero.place(1020, 1640, 2.4, false);
  const warm = h('circle', {cx: 1600, cy: 360, r: 520, fill: 'url(#tj-glow-g)', opacity: .5, style: 'mix-blend-mode:screen'}, B.content);
  return t => {
   A.reveal(seg(t, 0, .4)); B.reveal(seg(t, 3.6, 4.1));
   const d = ease(seg(t, .2, 1.4)), lift = ease(seg(t, 1.8, 3.4));
   tf(hand.root, 420, lerp(-120, 640, d) - lift * 200, -8, .85);
   hand.grip(ease(seg(t, 1.2, 1.8)));
   tf(tool, 420 + lift * 10, 690 - lift * 200, -10 + lift * 18, 1.4);
   SB.tick(t);
   hero.pose({head: -4, shF: 6, elF: 10});
   hero.face({look: [3, -1], brow: t > 4 ? .8 : .2, mouth: 'open', blink: 0}); hero.wind = .4; hero.tick(t, ctx.talking('hero'));
   warm.setAttribute('opacity', (.45 + Math.sin(t * 2.5) * .1).toFixed(2));
   applyCam(root, [800, 450, 1 + t * .004, 0]);
  };
 },

 handoff(root, ctx) {
  const cam = g(root), S = steppe(cam, {w: 2000, seed: 9});
  const hero = makeHeroBack(cam);
  const frame = path(root, '', '#0c0a0b', 0, {'fill-rule': 'evenodd'});
  return t => {
   S.tick(t); S.runHerd(t + 6, 2600, 70);
   tf(S.eagle, 1200 + t * 50, 260 + Math.sin(t) * 20, 4, .5);
   hero.place(1180, 1260, 1.25); hero.tick(t);
   const z = ease(seg(t, 4.6, 9));
   applyCam(cam, camAt([[0, 1360, 560, 1.0], [4.6, 1400, 560, 1.06], [9, 1630, 520, 2.6]], t));
   // The comic frame opens up and leaves the screen → the game camera takes over.
   const inset = lerp(26, -80, z);
   frame.setAttribute('d', `M-50,-50 H1650 V950 H-50 Z M${inset},${inset} H${1600 - inset} V${900 - inset} H${inset} Z`);
  };
 },
};

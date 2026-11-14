// Shot builders for the author's easter egg (same conventions as the intro: update(t) per shot).
import {h, g, path, tf, lerp, clamp, ease, easeOut, seg, rand, orn, INK, speedLines, camAt, applyCam, overlay, sparks} from '../intro/art.js';
import {yurtInterior, makeAuthor, makeKhan, makeHorse, mount, crowd, banner, tamga} from './egg-art.js';

const SAT = {sitting: {hipF: 84, kneeF: 96, hipB: 80, kneeB: 100, y: 96}};
// Parchment frame around every ancestor panel + generation badge (language-neutral).
function scrollFrame(root, gen, years) {
 const F = g(root);
 path(F, 'M-50,-50 H1650 V950 H-50 Z M24,24 H1576 V876 H24 Z', '#e9d6a8', 0, {'fill-rule': 'evenodd'});
 path(F, 'M24,24 H1576 V876 H24 Z', 'none', 6);
 path(F, 'M40,40 H1560 V860 H40 Z', 'none', 2, {stroke: '#a3631e'});
 for (const [x, y] of [[24, 24], [1576, 24], [24, 876], [1576, 876]]) orn(F, x, y, 70, '#a3631e');
 if (gen) {const b = g(F); tf(b, 120, 790); h('circle', {r: 54, fill: '#7a1f2b', stroke: INK, 'stroke-width': 5}, b); h('circle', {r: 44, fill: 'none', stroke: '#f2c255', 'stroke-width': 3}, b);
  const t = h('text', {y: 16, 'text-anchor': 'middle', 'font-size': 46, 'font-weight': 800, fill: '#f6e3b0', 'font-family': 'Rubik,Manrope,sans-serif'}, b); t.textContent = gen;}
 if (years) {h('rect', {x: 186, y: 768, width: 300, height: 52, rx: 26, fill: '#e9d6a8', stroke: INK, 'stroke-width': 3}, F); const t = h('text', {x: 210, y: 806, 'font-size': 34, 'font-style': 'italic', fill: '#5a3416', 'font-family': 'PT Serif,Georgia,serif'}, F); t.textContent = years;}
 return F;
}
function sky(parent, top, mid, bottom) {
 const id = 'egg-sky-' + Math.random().toString(36).slice(2, 7), lg = h('linearGradient', {id, x1: 0, y1: 0, x2: 0, y2: 1}, parent);
 [[0, top], [.6, mid], [1, bottom]].forEach(([o, c]) => h('stop', {offset: o, 'stop-color': c}, lg));
 h('rect', {x: -400, y: -300, width: 2400, height: 1500, fill: `url(#${id})`}, parent);
}
const hills = (parent, y, col, amp = 60, seed = 1) => {const r = rand(seed); let d = `M-400,${y}`; for (let x = -400; x <= 2000; x += 200) d += ` Q${x + 100},${y - amp * (.5 + r())} ${x + 200},${y}`; return path(parent, d + ' L2000,1200 L-400,1200 Z', col, 3.5);};

export const SCENES = {
 enter(root) {
  const cam = g(root);
  sky(cam, '#1b2440', '#3a3a5e', '#6a5a6e');
  hills(cam, 760, '#2a2638', 40, 2);
  // Yurt exterior close-up with the felt door rolling up.
  path(cam, 'M200,900 L200,420 Q800,200 1400,420 L1400,900 Z', '#ead8b1', 5);
  path(cam, 'M200,520 Q800,330 1400,520', 'none', 14, {stroke: '#8c493a'});
  for (let x = 260; x < 1400; x += 90) orn(cam, x, 470 - Math.sin((x - 200) / 1200 * Math.PI) * 120, 60, '#8c493a');
  path(cam, 'M620,900 L620,560 L980,560 L980,900 Z', '#2a1408', 5);
  const glow = h('rect', {x: 620, y: 560, width: 360, height: 340, fill: '#ffd98a', opacity: 0}, cam);
  const door = g(cam);
  path(door, 'M620,560 L980,560 L980,900 L620,900 Z', '#b8432e', 5);
  path(door, 'M650,590 L950,590 L950,870 L650,870 Z', 'none', 4, {stroke: '#f2deb0'});
  orn(door, 800, 730, 160, '#f2deb0');
  const roll = h('rect', {x: 610, y: 540, width: 380, height: 0, rx: 20, fill: '#9a3624', stroke: INK, 'stroke-width': 4}, cam);
  return t => {
   const k = ease(seg(t, 1.6, 3.4));
   door.setAttribute('transform', `translate(0 ${(-340 * k).toFixed(1)}) scale(1 ${(1 - k * .98).toFixed(3)})`);
   door.setAttribute('transform', `translate(0 560) scale(1 ${(1 - k * .97).toFixed(3)}) translate(0 -560)`);
   roll.setAttribute('height', (k * 46).toFixed(1));
   glow.setAttribute('opacity', (k * .9).toFixed(2));
   applyCam(cam, camAt([[0, 800, 560, 1], [3.2, 800, 640, 1.4], [5, 800, 720, 3]], t));
  };
 },

 meet(root, ctx) {
  const cam = g(root), Y = yurtInterior(cam), A = makeAuthor(cam);
  cam.appendChild(Y.table);
  return t => {
   Y.tick(t);
   const up = ease(seg(t, 0, 1.4)), wave = seg(t, 1.2, 3.4) * (1 - seg(t, 3.4, 4));
   A.place(600, 770, 1, false);
   A.pose({lean: lerp(24, 0, up), y: lerp(60, 0, up), hipF: lerp(40, 4, up), kneeF: lerp(70, 0, up), hipB: lerp(30, -4, up), kneeB: lerp(70, 0, up),
    shF: lerp(14, 150, Math.min(1, wave * 3)), elF: 30 + Math.sin(t * 9) * 22 * wave, shB: 8, elB: 18, head: -3});
   A.face({look: [3, 0], mouth: 'smile', brow: .3}); A.tick(t, ctx.talking('author'));
   applyCam(cam, camAt([[0, 800, 120, 1], [1.6, 760, 500, 1.05], [7, 740, 520, 1.12], [13, 720, 540, 1.22]], t));
  };
 },

 tore(root, ctx) {
  const cam = g(root), Y = yurtInterior(cam), A = makeAuthor(cam);
  return t => {
   Y.tick(t);
   const gest = ease(seg(t, .6, 1.6)) * (1 - ease(seg(t, 5, 5.8)));
   A.place(640, 1660, 2.6, false);
   A.pose({head: -4 + gest * 6, shB: lerp(6, -50, gest), elB: lerp(16, 40, gest), shF: 12, elF: 30, lean: -gest * 3});
   A.face({look: gest > .5 ? [-3, -1] : [3, 0], mouth: 'smile', brow: .2}); A.tick(t, ctx.talking('author'));
   Y.tamgaGlow.setAttribute('opacity', (.35 + gest * .4 + Math.sin(t * 3) * .05).toFixed(2));
   applyCam(cam, camAt([[0, 760, 520, 1.15], [11, 760, 500, 1.24]], t));
  };
 },

 scroll(root, ctx) {
  const cam = g(root), Y = yurtInterior(cam), A = makeAuthor(cam);
  const S = g(cam), paper = path(S, '', '#f3e2b4', 4), lines = path(S, '', 'none', 3, {stroke: '#a3631e'}), rollL = g(S), rollR = g(S);
  for (const r of [rollL, rollR]) {path(r, 'M-14,-70 L14,-70 L14,70 L-14,70 Z', '#c9a45a', 4); path(r, 'M-8,-90 L8,-90 L8,90 L-8,90 Z', '#6b3f1d', 3);}
  return t => {
   Y.tick(t);
   A.place(800, 1180, 1.6, false);
   A.pose({shF: 70, elF: 50, shB: 60, elB: 60, head: 4});
   A.face({look: [1, 2], mouth: 'smile'}); A.tick(t, ctx.talking('author'));
   const w = 40 + 380 * ease(seg(t, .6, 2.4));
   paper.setAttribute('d', `M${800 - w},560 L${800 + w},560 L${800 + w},720 L${800 - w},720 Z`);
   let d = ''; for (let i = 0; i < 4; i++) d += `M${800 - w + 30},${590 + i * 36} L${800 + w - 30},${590 + i * 36} `; lines.setAttribute('d', w > 80 ? d : '');
   tf(rollL, 800 - w, 640); tf(rollR, 800 + w, 640);
   applyCam(cam, camAt([[0, 800, 520, 1.1], [3.6, 800, 600, 1.4], [6, 800, 640, 4]], t));
  };
 },

 genghis(root, ctx) {
  const cam = g(root);
  sky(cam, '#2a1e3a', '#c45a3a', '#f2b45a');
  h('circle', {cx: 1100, cy: 520, r: 140, fill: '#ffe2a0', stroke: INK, 'stroke-width': 4}, cam);
  hills(cam, 700, '#5a3a3a', 30, 4);
  const army = crowd(cam, 22, 700, 1500, 760, .55, 5, '#2a1414');
  const spears = path(cam, '', 'none', 3, {stroke: '#2a1414'});
  path(cam, 'M-300,1000 Q300,520 760,640 Q900,700 1000,1000 Z', '#2a1a1a', 4);
  const horse = makeHorse(cam, '#e8e2d6', '#8a8a8a');
  const gk = makeKhan(cam, {hat: 'mongol', hatCol: '#3a3a5e', beard: 'long', beardCol: '#9a9690', mustache: true, robe: '#2f4a6a', robeD: '#1f324a', trim: '#e2b45a', age: true, browCol: '#6a6660', sword: true});
  const B = banner(cam, 560, 640, {tails: 9, h: 420});
  scrollFrame(root, '26', '~1162–1227');
  return t => {
   const r = ease(seg(t, 1, 2.2));
   tf(horse.root, 300, 640, 0, .75); horse.tick(t, 1, false);
   gk._ridePose = {shF: lerp(20, 120, r), elF: lerp(30, 0, r), shB: 20, elB: 30, head: -4};
   mount(gk, 300, 640, .75); gk.face({mouth: 'closed', brow: -.4, look: [3, -1]}); gk.tick(t, false);
   B.tick(t);
   army.tick(t, ease(seg(t, 1.8, 2.6)));
   let d = ''; army.people.forEach(o => {const raise = ease(seg(t, 1.8, 2.6)); d += `M${o.x + 28 * o.sc},${o.y - 60 * o.sc} L${o.x + 30 * o.sc},${o.y - (160 + raise * 60) * o.sc} `;}); spears.setAttribute('d', d);
   applyCam(cam, camAt([[0, 700, 520, 1.05], [7.4, 620, 470, 1.18]], t));
  };
 },

 jochi(root, ctx) {
  const cam = g(root);
  sky(cam, '#6a8ab8', '#e8c48a', '#f2dcaa');
  path(cam, 'M-400,640 Q-100,470 200,600 Q420,480 700,610 Q980,500 1300,620 Q1600,520 2000,640 L2000,1200 L-400,1200 Z', '#9a8a6a', 4);
  // Mausoleum of Jochi Khan, Ulytau (brick, domed).
  const m = g(cam); tf(m, 640, 640, 0, .8);
  path(m, 'M-110,0 L-110,-150 L110,-150 L110,0 Z', '#c99a6a', 4);
  path(m, 'M-70,-150 C-70,-260 70,-260 70,-150 Z', '#5aa8a8', 4);
  path(m, 'M-40,0 L-40,-90 Q0,-130 40,-90 L40,0 Z', '#7a5a3a', 4);
  for (let y = -130; y < 0; y += 20) path(m, `M-110,${y} L110,${y}`, 'none', 1.5, {opacity: .4});
  const ground = path(cam, 'M-400,720 Q400,690 1200,720 T2400,710 L2400,1200 L-400,1200 Z', '#c4a45a', 4);
  const gold = h('rect', {x: -400, y: 700, width: 0, height: 500, fill: '#ffd77a', opacity: .45, style: 'mix-blend-mode:screen'}, cam);
  const horse = makeHorse(cam, '#5a3a22', '#1a1008');
  const jk = makeKhan(cam, {hat: 'helmet', beard: 'short', mustache: true, robe: '#6a2a24', robeD: '#4a1a16', sword: true});
  scrollFrame(root, '25', '~1182–1227');
  return t => {
   const x = lerp(80, 760, seg(t, 0, 6)), bob = Math.sin(t * 9) * 6;
   tf(horse.root, x, 820 + bob * .3, 0, .62); horse.tick(t, 1, true);
   jk._ridePose = {shF: 40, elF: 50, shB: 30, elB: 40, lean: 8}; mount(jk, x, 820 + bob * .3, .62); jk.face({brow: -.3, look: [3, 0]}); jk.tick(t, false);
   gold.setAttribute('width', (2400 * ease(seg(t, .8, 5))).toFixed(0));
   applyCam(cam, [lerp(700, 980, seg(t, 0, 7.4)), 560, 1.05, 0]);
  };
 },

 urus(root, ctx) {
  const cam = g(root);
  sky(cam, '#5a8ac8', '#f0d8a8', '#f4e2b8');
  // Sygnak: adobe walls, round towers, a dome.
  const city = g(cam);
  path(city, 'M-200,640 L1700,640 L1700,520 L-200,520 Z', '#c9a06a', 4);
  for (let x = -160; x < 1700; x += 260) {path(city, `M${x - 40},640 L${x - 40},460 Q${x},430 ${x + 40},460 L${x + 40},640 Z`, '#b8905a', 4); for (let k = -30; k <= 30; k += 20) path(city, `M${x + k},452 L${x + k},440`, 'none', 6);}
  path(city, 'M760,520 C760,400 940,400 940,520 Z', '#5aa8a8', 4);
  path(city, 'M800,520 L800,600 Q850,560 900,600 L900,520', 'none', 4);
  path(cam, 'M-400,640 L2000,640 L2000,1200 L-400,1200 Z', '#d8b878', 4);
  // Throne under a canopy.
  path(cam, 'M220,380 L720,380 L680,440 L260,440 Z', '#f4f0e6', 4);
  path(cam, 'M250,440 L250,820 M690,440 L690,820', 'none', 10, {stroke: '#7a4a22'});
  path(cam, 'M330,820 L610,820 L590,700 L350,700 Z', '#c99a3a', 4);
  path(cam, 'M360,700 L360,520 Q470,470 580,520 L580,700 Z', '#7a1f2b', 4);
  orn(cam, 470, 560, 80, '#f2c255');
  const guards = crowd(cam, 4, 100, 860, 840, .9, 7, '#3a2a2a');
  const B = banner(cam, 820, 840, {col: '#f8f6ee', h: 380});
  const uk = makeKhan(cam, {hat: 'borik', hatCol: '#e8e0d0', beard: 'long', beardCol: '#cfcac4', mustache: true, age: true, robe: '#e8e2d2', robeD: '#bfb8a6', trim: '#c99a3a', browCol: '#8a8680'});
  scrollFrame(root, '20', 'XIV');
  return t => {
   const r = ease(seg(t, 1.2, 2));
   uk.place(470, 820, .8, false);
   uk.pose({...SAT.sitting, shF: lerp(20, 110, r), elF: lerp(60, 10, r), shB: 20, elB: 60});
   uk.face({mouth: 'closed', brow: -.2, look: [3, 0]}); uk.tick(t, false);
   guards.tick(t, r * .3); B.tick(t);
   applyCam(cam, camAt([[0, 720, 520, 1.05], [7.4, 640, 560, 1.16]], t));
  };
 },

 barak(root, ctx) {
  const cam = g(root);
  sky(cam, '#8a6a5a', '#d8a878', '#e8c898');
  const bg = g(cam); hills(bg, 620, '#a88a6a', 50, 9); hills(bg, 700, '#8a6a4a', 30, 3);
  const lines = speedLines(cam, 1800, 520, 100, 2200, 60, '#fff3dc', 6); lines.setAttribute('opacity', .5);
  const dust = g(cam); const puffs = Array.from({length: 10}, () => h('circle', {r: 30, fill: '#d8c098', stroke: INK, 'stroke-width': 3, opacity: .8}, dust));
  const horse = makeHorse(cam, '#2a1a12', '#0a0806');
  const bk = makeKhan(cam, {hat: 'helmet', beard: 'short', mustache: true, robe: '#2a4a3a', robeD: '#1a3226', prop: 'sword'});
  scrollFrame(root, '18', 'XV');
  return t => {
   tf(bg, -((t * 160) % 400), 0);
   const bob = Math.sin(t * 11) * 8;
   tf(horse.root, 520, 820 + bob, -4, .78); horse.tick(t, 1.3, true);
   const sw = Math.sin(t * 3) * .5 + .5;
   bk._ridePose = {shF: lerp(130, 170, sw), elF: lerp(40, 0, sw), shB: 40, elB: 50, lean: 14}; mount(bk, 520, 820 + bob, .78); bk.face({brow: -1, mouth: 'open', look: [3, 0]}); bk.tick(t, false);
   puffs.forEach((p, i) => {const k = ((t * 1.4 + i / 10) % 1); p.setAttribute('cx', (430 - k * 500).toFixed(0)); p.setAttribute('cy', (820 - k * 60 - (i % 3) * 20).toFixed(0)); p.setAttribute('r', (20 + k * 50).toFixed(0)); p.setAttribute('opacity', (.8 * (1 - k)).toFixed(2));});
   lines.setAttribute('transform', `translate(${(Math.sin(t * 40) * 6).toFixed(1)} 0)`);
   applyCam(cam, [700, 540, 1.05, -1], 3, t);
  };
 },

 zhanibek(root, ctx) {
  const cam = g(root);
  sky(cam, '#4a7ab8', '#a8c8e8', '#e8f0f4');
  path(cam, 'M-400,560 L-100,330 L80,430 L320,260 L520,420 L760,280 L980,440 L1200,300 L1420,450 L1700,320 L2000,520 L2000,700 L-400,700 Z', '#6a7aa8', 4);
  path(cam, 'M320,260 L270,318 L318,306 L350,326 L380,300 Z M760,280 L712,334 L756,322 L790,342 L812,318 Z M1200,300 L1154,350 L1196,340 L1230,358 L1254,334 Z', '#f6f8fc', 3);
  path(cam, 'M-400,660 Q600,620 1400,660 T2400,650 L2400,1200 L-400,1200 Z', '#8aa86a', 4);
  const people = crowd(cam, 16, 40, 1000, 900, .8, 11, '#3a2a2a');
  const felt = g(cam);
  const lifters = crowd(felt, 4, 300, 780, 830, 1.05, 13, '#5a3a2a');
  const sheet = g(felt);
  path(sheet, 'M260,640 Q540,600 820,640 Q540,690 260,640 Z', '#fbf8ee', 5);
  path(sheet, 'M300,640 Q540,612 780,640 Q540,676 300,640 Z', 'none', 3, {stroke: '#c99a3a'});
  const zk = makeKhan(sheet, {hat: 'borik', hatCol: '#7a1f2b', uki: true, beard: 'pointed', mustache: true, robe: '#2a5a8a', robeD: '#1a3a5a', trim: '#f2c255'});
  const kerey = makeKhan(cam, {hat: 'borik', hatCol: '#2a4a3a', uki: true, beard: 'short', mustache: true, robe: '#6a2a52', robeD: '#4a1a3a', trim: '#f2c255'});
  scrollFrame(root, '17', '~1465');
  return t => {
   const lift = Math.max(0, Math.sin(seg(t, .5, 3.8) * Math.PI * 3)) * (t < 3.8 ? 1 : 0), up = lift * 90;
   tf(sheet, 0, -up);
   zk.place(540, 650, .55, false); zk.pose({...SAT.sitting, shF: 40 + lift * 80, elF: 30, shB: 30 + lift * 60, elB: 30}); zk.face({mouth: lift > .3 ? 'smile' : 'closed', brow: .2, look: [2, -1]}); zk.tick(t, false);
   lifters.tick(t, 1); lifters.people.forEach(o => {o.p.setAttribute('transform', `translate(${o.x} ${o.y - up * .4}) scale(${o.sc})`);});
   people.tick(t, ease(seg(t, .5, 1.5)));
   kerey.place(960, 900, .7, true); kerey.pose({shF: 100, elF: 20, shB: 10, elB: 20}); kerey.face({mouth: 'smile', look: [-2, -1]}); kerey.tick(t, false);
   applyCam(cam, camAt([[0, 680, 560, 1.05], [7.4, 620, 560, 1.15]], t));
  };
 },

 kasym(root, ctx) {
  const cam = g(root);
  sky(cam, '#3a6a9a', '#c8d8e0', '#f0e6c8');
  path(cam, 'M-400,640 L2000,640 L2000,1200 L-400,1200 Z', '#c8a868', 4);
  const B1 = banner(cam, 200, 640, {col: '#2a6a8a', h: 400}), B2 = banner(cam, 920, 640, {col: '#2a6a8a', h: 400});
  path(cam, 'M260,700 L860,700 L900,760 L220,760 Z', '#8a5a2a', 4);
  const people = crowd(cam, 18, -40, 1000, 920, .9, 17, '#3a2a2a');
  const kk = makeKhan(cam, {hat: 'crown', beard: 'long', beardCol: '#2a1a12', mustache: true, robe: '#7a1f2b', robeD: '#521520', trim: '#f2c255'});
  const sc = g(cam), paper = path(sc, '', '#f6ead0', 4), text = path(sc, '', 'none', 3, {stroke: '#7a4a22'});
  scrollFrame(root, '16', '1511–1521');
  return t => {
   kk.place(560, 700, .8, false); kk.pose({shF: 70, elF: 60, shB: 60, elB: 70, head: 4});
   kk.face({mouth: t > 1.5 && t < 3.5 ? (Math.sin(t * 18) > 0 ? 'open' : 'mid') : 'closed', brow: -.2, look: [2, 2]}); kk.tick(t, false);
   const open = ease(seg(t, .4, 1.6)), w = 30 + 150 * open;
   paper.setAttribute('d', `M${600 - w},420 L${600 + w},420 L${600 + w},${470 + open * 120} L${600 - w},${470 + open * 120} Z`);
   let d = ''; const n = Math.floor(seg(t, 1.4, 3.6) * 5); for (let i = 0; i < n; i++) d += `M${600 - w + 20},${450 + i * 24} L${600 + w - 20 - (i % 2) * 40},${450 + i * 24} `; text.setAttribute('d', d);
   people.tick(t, ease(seg(t, 3, 4)) * .6); B1.tick(t); B2.tick(t + 1);
   applyCam(cam, camAt([[0, 640, 520, 1.05], [7.4, 600, 500, 1.15]], t));
  };
 },

 abylai(root, ctx) {
  const cam = g(root);
  sky(cam, '#4a8ac8', '#b8d8e8', '#f0e2b8');
  // Turkestan: the mausoleum of Khoja Ahmed Yasawi, where Abylai was proclaimed khan.
  const m = g(cam); tf(m, 560, 640, 0, .9);
  path(m, 'M-320,0 L-320,-170 L320,-170 L320,0 Z', '#d2b07a', 4);
  path(m, 'M-130,0 L-130,-330 L130,-330 L130,0 Z', '#c89e66', 4);
  path(m, 'M-70,0 L-70,-220 Q0,-280 70,-220 L70,0 Z', '#7a5a3a', 4);
  path(m, 'M150,-170 C150,-300 300,-300 300,-170 Z', '#3aa8b8', 4);
  for (let k = 0; k < 6; k++) path(m, `M${170 + k * 22},-170 Q225,-300 ${170 + k * 22},-170`, 'none', 2, {opacity: .4});
  path(cam, 'M-400,640 L2000,640 L2000,1200 L-400,1200 Z', '#c8a868', 4);
  const banners = [0, 1, 2].map(i => banner(cam, 0, 0, {col: ['#2a6a9a', '#c99a3a', '#7a1f2b'][i], h: 360}));
  const envoys = crowd(cam, 2, 120, 1000, 860, .9, 19, '#3a3040');
  const ak = makeKhan(cam, {hat: 'borik', hatCol: '#2a4a8a', uki: true, beard: 'pointed', mustache: true, robe: '#1f4a6a', robeD: '#123248', trim: '#f2c255', sword: true});
  scrollFrame(root, null, '1711–1781');
  return t => {
   const k = ease(seg(t, .5, 3));
   banners.forEach((b, i) => {tf(b.root, lerp([-200, 560, 1300][i], 500 + i * 60, k), 860); b.tick(t + i);});
   envoys.people.forEach((o, i) => o.p.setAttribute('transform', `translate(${o.x} ${o.y}) rotate(${(i ? -1 : 1) * 20 * ease(seg(t, 2, 3))} 0 0) scale(${o.sc})`));
   ak.place(560, 880, .85, false); ak.pose({shF: lerp(10, 140, ease(seg(t, 2.6, 3.4))), elF: 10, shB: 10, elB: 20});
   ak.face({mouth: 'closed', brow: -.2, look: [2, -1]}); ak.tick(t, false);
   applyCam(cam, camAt([[0, 640, 540, 1.05], [7.4, 600, 520, 1.15]], t));
  };
 },

 bokei(root, ctx) {
  const cam = g(root);
  sky(cam, '#3a1a2a', '#c8443a', '#f2a45a');
  hills(cam, 720, '#3a1a1a', 30, 23);
  const clash = g(cam);
  const h1 = makeHorse(clash, '#1a0a0a', '#000'), h2 = makeHorse(clash, '#1a0a0a', '#000');
  const r1 = makeKhan(clash, {hat: 'borik', beard: 'short', robe: '#1a0a0a', robeD: '#0a0404', trim: '#1a0a0a', skin: '#1a0a0a', skinD: '#0a0404', hatCol: '#1a0a0a', prop: 'sword'});
  const r2 = makeKhan(clash, {hat: 'borik', beard: 'short', robe: '#1a0a0a', robeD: '#0a0404', trim: '#1a0a0a', skin: '#1a0a0a', skinD: '#0a0404', hatCol: '#1a0a0a', prop: 'sword'});
  const sp = sparks(clash, 520, 520, 24, 3, '#ffe28a');
  const portrait = g(cam);
  h('circle', {cx: 560, cy: 520, r: 420, fill: 'url(#tj-glow-g)', opacity: .6}, portrait);
  const bk = makeKhan(portrait, {hat: 'borik', hatCol: '#3a2a22', beard: 'long', beardCol: '#cfcac4', mustache: true, age: true, robe: '#3a5a3a', robeD: '#243a24', trim: '#f2c255', browCol: '#8a8680'});
  scrollFrame(root, '8', 'XVIII–XIX');
  return t => {
   const c = ease(seg(t, 0, 1));
   tf(h1.root, lerp(-100, 330, c), 820, 0, .6); h1.tick(t, 1.3, t < 1.1);
   tf(h2.root, lerp(1200, 730, c), 820, 0, -.6, .6); h2.tick(t, 1.3, t < 1.1);
   r1._ridePose = {shF: 160, elF: 0, lean: 10}; mount(r1, lerp(-100, 330, c), 820, .6); r1.tick(t, false);
   r2._ridePose = {shF: 150, elF: 10, lean: 10}; r2.place(lerp(1200, 730, c) - 6, 820 - 262 * .6 + 236 * .54, .54, true); r2.pose({hipF: 82, kneeF: 86, hipB: 76, kneeB: 90, ...r2._ridePose}); r2.tick(t, false);
   sp(t - 1);
   const fade = seg(t, 2.4, 3.2);
   clash.setAttribute('opacity', (1 - fade * .85).toFixed(2));
   portrait.setAttribute('opacity', fade.toFixed(2));
   bk.place(560, 1260, 1.6, false); bk.pose({head: -3, shF: 10, elF: 20}); bk.face({mouth: 'closed', brow: -.1, look: [2, 0]}); bk.tick(t, false);
   applyCam(cam, [600, 520, 1.05 + fade * .05, 0], t > .9 && t < 1.5 ? 6 : 0, t);
  };
 },

 alikhan(root, ctx) {
  const cam = g(root);
  overlay(cam, '#1a1a2a');
  path(cam, 'M140,120 L560,120 L560,520 L140,520 Z', '#1a2a4a', 5);
  h('circle', {cx: 420, cy: 240, r: 54, fill: '#f6eccc', stroke: INK, 'stroke-width': 3}, cam);
  path(cam, 'M350,120 L350,520 M140,320 L560,320', 'none', 6);
  for (let x = 0; x < 1600; x += 120) path(cam, `M${x},0 L${x},900`, 'none', 2, {stroke: '#26263a'});
  const lamp = h('circle', {cx: 860, cy: 600, r: 380, fill: 'url(#tj-glow-g)', opacity: .7}, cam);
  const ak = makeKhan(cam, {suit: true, hair: 'short', glasses: true, mustache: true, beardCol: '#2a1a12', robe: '#2a2a3a', robeD: '#1a1a26', skin: '#d4a07a', skinD: '#ab7a58'});
  path(cam, 'M380,700 L1100,700 L1060,760 L420,760 Z', '#6b3f1d', 4);
  path(cam, 'M440,760 L440,900 M1040,760 L1040,900', 'none', 14, {stroke: '#4a2a12'});
  path(cam, 'M840,700 L880,700 L876,640 L844,640 Z', '#c99a3a', 3);
  path(cam, 'M846,640 C846,600 878,600 878,640 Z', '#ffe7a0', 3);
  path(cam, 'M560,690 L780,690 L790,700 L550,700 Z', '#f6f1e6', 3);
  const pen = path(cam, 'M0,0 L40,-60', 'none', 5);
  const pages = Array.from({length: 4}, (_, i) => {const p = g(cam); path(p, 'M-50,-34 L50,-34 L50,34 L-50,34 Z', '#f6f1e6', 3); const tx = h('text', {y: 10, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: '#7a1f2b', 'font-family': 'Rubik,sans-serif'}, p); tx.textContent = 'АЛАШ'; return p;});
  scrollFrame(root, null, '1866–1937');
  return t => {
   ak.place(600, 1130, 1.3, false); ak.pose({...SAT.sitting, shF: 70, elF: 80 + Math.sin(t * 8) * 6, shB: 50, elB: 70, head: 10 + Math.sin(t) * 2, lean: 8});
   ak.face({look: [2, 3], mouth: 'closed', brow: -.2}); ak.tick(t, false);
   tf(pen, 690 + Math.sin(t * 8) * 30, 690);
   lamp.setAttribute('opacity', (.62 + Math.sin(t * 9) * .04).toFixed(2));
   pages.forEach((p, i) => {const q = clamp((t - 1.5 - i * .5) / 2.5); tf(p, 680 + q * (500 + i * 80), 690 - q * (420 - i * 60) - Math.sin(q * 6) * 30, q * 200 * (i % 2 ? -1 : 1), q > 0 ? 1 : 0); p.setAttribute('opacity', (q > 0 ? 1 - q * .4 : 0).toFixed(2));});
   applyCam(cam, camAt([[0, 700, 520, 1.05], [7.4, 680, 540, 1.14]], t));
  };
 },

 outro(root, ctx) {
  const cam = g(root), Y = yurtInterior(cam), A = makeAuthor(cam);
  return t => {
   Y.tick(t);
   const bow = ease(seg(t, 9, 10)) * (1 - ease(seg(t, 10.6, 11.4)));
   A.place(640, 1660, 2.6, false);
   A.pose({head: -4 + bow * 10, lean: bow * 10, shF: lerp(12, 60, bow), elF: lerp(30, 90, bow), shB: lerp(8, 50, bow), elB: lerp(16, 90, bow)});
   A.face({look: [3, 0], mouth: 'smile', brow: .3, blink: bow > .5 ? 1 : 0}); A.tick(t, ctx.talking('author'));
   applyCam(cam, camAt([[0, 760, 500, 1.24], [9, 760, 520, 1.15], [12, 800, 470, .95]], t));
  };
 },
};

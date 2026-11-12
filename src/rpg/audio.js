// Procedural Web Audio for MAP01: ambience (wind, fire, river, cave), music and SFX.
// No audio files, no dependencies. All levels are kept soft: the steppe should breathe, not shout.
let ctx = null, master = null, sfxBus = null, musicBus = null, ambBus = null, noiseBuf = null;
let muted = false;
const amb = {};
let musicTimer = 0, musicMode = 'off', musicStep = 0;

function C() {
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
    master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = .32; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = .5; ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
export function unlockAudio() { C(); }
export function toggleAudioMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : .55, ctx.currentTime, .05);
  return muted;
}
export function isAudioMuted() { return muted; }

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function osc(type, f0, f1, dur, peak, {at = 0, bus = sfxBus, pan = 0, attack = .005, q} = {}) {
  const c = C(); if (!c || muted) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, attack, peak, dur);
  p.pan.value = pan;
  o.connect(g).connect(p).connect(bus);
  o.start(t); o.stop(t + attack + dur + .05);
}
function noise(dur, peak, {at = 0, type = 'bandpass', f = 1200, f1, q = 1, bus = sfxBus, pan = 0, attack = .004} = {}) {
  const c = C(); if (!c || muted) return;
  const t = c.currentTime + at;
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(), p = c.createStereoPanner(); p.pan.value = pan;
  env(g, t, attack, peak, dur);
  s.connect(fl).connect(g).connect(p).connect(bus);
  s.start(t, Math.random()); s.stop(t + attack + dur + .05);
}

// ---------------------------------------------------------------- SFX
const SFX = {
  step_grass: (v, p) => noise(.07, .05 * v, {f: 900, q: .7, pan: p}),
  step_dirt: (v, p) => noise(.06, .07 * v, {f: 500, q: 1.2, pan: p}),
  step_water: (v, p) => { noise(.12, .07 * v, {f: 1800, f1: 600, q: 1, pan: p}); },
  step_cave: (v, p) => { noise(.05, .06 * v, {f: 380, q: 2, pan: p}); osc('sine', 180, 120, .08, .02 * v, {pan: p}); },
  sword: (v, p) => noise(.16, .16 * v, {f: 2600, f1: 900, q: 1.5, pan: p}),
  spear: (v, p) => { noise(.12, .12 * v, {f: 1400, f1: 500, q: 2, pan: p}); osc('triangle', 220, 120, .1, .05 * v, {pan: p}); },
  bowstring: (v, p) => osc('triangle', 300, 340, .25, .03 * v, {pan: p, attack: .2}),
  bow: (v, p) => { osc('triangle', 520, 180, .12, .1 * v, {pan: p}); noise(.18, .06 * v, {f: 3000, f1: 1200, pan: p}); },
  arrow_hit: (v, p) => { noise(.05, .12 * v, {f: 700, q: 3, pan: p}); osc('square', 140, 80, .05, .04 * v, {pan: p}); },
  enemy_hurt: (v, p) => { osc('sawtooth', 240, 130, .12, .07 * v, {pan: p}); noise(.08, .08 * v, {f: 800, pan: p}); },
  enemy_die: (v, p) => { osc('sawtooth', 200, 60, .45, .08 * v, {pan: p}); noise(.3, .06 * v, {f: 500, f1: 200, pan: p}); },
  howl: (v, p) => { const c = C(); if (!c || muted) return; osc('sine', 420, 640, .5, .05 * v, {pan: p, attack: .25}); osc('sine', 640, 380, .9, .05 * v, {at: .7, pan: p}); },
  growl: (v, p) => { osc('sawtooth', 90, 70, .35, .07 * v, {pan: p, attack: .05}); noise(.35, .05 * v, {f: 300, q: 4, pan: p}); },
  roar: (v, p) => { osc('sawtooth', 110, 55, 1.1, .16 * v, {pan: p, attack: .08}); noise(1.1, .12 * v, {f: 420, f1: 160, q: 2, pan: p, attack: .08}); },
  swipe: (v, p) => noise(.22, .14 * v, {f: 900, f1: 300, q: 1, pan: p}),
  shout: (v, p) => { osc('sawtooth', 260, 330, .18, .05 * v, {pan: p, attack: .03}); osc('sawtooth', 330, 220, .2, .05 * v, {at: .2, pan: p}); },
  pickup: (v) => { osc('sine', 660, 660, .1, .07 * v); osc('sine', 990, 990, .16, .06 * v, {at: .08}); },
  splash: (v, p) => noise(.3, .08 * v, {f: 1500, f1: 400, pan: p}),
  hooves: (v, p) => { for (let i = 0; i < 4; i++) noise(.04, .05 * v, {at: i * .09, f: 260, q: 3, pan: p}); },
  block: () => osc('square', 160, 120, .08, .04),
  down: () => { osc('sine', 330, 110, .9, .12); noise(.4, .05, {f: 300}); },
  revive: () => { [523, 659, 784, 1046].forEach((f, i) => osc('sine', f, f, .25, .06, {at: i * .1})); },
  impact: (v, p) => { osc('sine', 80, 40, .4, .2 * v, {pan: p}); noise(.3, .14 * v, {f: 200, pan: p}); },
  hurt: () => { osc('sawtooth', 180, 90, .2, .09); noise(.12, .07, {f: 600}); },
  dialog: () => osc('sine', 880, 880, .05, .025),
  type: () => osc('square', 1300 + Math.random() * 200, 1300, .015, .008),
  quiz_ok: () => { [523, 659, 784].forEach((f, i) => osc('sine', f, f, .35, .07, {at: i * .09})); osc('triangle', 1046, 1046, .6, .04, {at: .3}); },
  quiz_bad: () => { osc('sawtooth', 220, 150, .3, .05); osc('sawtooth', 160, 110, .35, .05, {at: .16}); },
  page: () => { [392, 494, 587, 784, 988].forEach((f, i) => osc('sine', f, f, .7, .05, {at: i * .12, attack: .03})); noise(1.2, .03, {f: 5000, q: .5, attack: .4}); },
  secret: () => { [784, 988, 1175, 1568].forEach((f, i) => osc('triangle', f, f, .25, .05, {at: i * .07})); },
  rumble: () => { osc('sine', 50, 38, 1.6, .2, {attack: .2}); noise(1.6, .12, {f: 140, q: 1, attack: .3}); },
  portal: () => { osc('sine', 200, 900, 1.4, .06, {attack: .5}); osc('sine', 300, 1350, 1.4, .04, {attack: .5}); noise(1.4, .04, {f: 2000, q: .4, attack: .6}); },
  shadow: () => { osc('sine', 70, 64, 3, .12, {attack: 1}); osc('sawtooth', 140, 130, 3, .025, {attack: 1.2}); noise(3, .05, {f: 600, f1: 2400, q: 6, attack: 1.4}); },
  whoosh: () => noise(.6, .07, {f: 400, f1: 3000, q: .8, attack: .25}),
  noammo: () => osc('square', 200, 160, .06, .03),
};
export function sfx(name, volume = 1, pan = 0) {
  const f = SFX[name];
  if (f) try { f(Math.max(0, Math.min(1, volume)), Math.max(-1, Math.min(1, pan))); } catch {}
}

// ---------------------------------------------------------------- ambience
function loopNoise(name, {type = 'lowpass', f = 600, q = .7} = {}) {
  const c = C(); if (!c) return null;
  if (amb[name]) return amb[name];
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = c.createGain(); g.gain.value = 0;
  s.connect(fl).connect(g).connect(ambBus); s.start();
  return (amb[name] = {s, fl, g});
}
// level: {wind, fire, river, cave, fog} each 0..1. Called every few frames.
export function ambience(level) {
  const c = C(); if (!c) return;
  const t = c.currentTime;
  const w = loopNoise('wind', {type: 'bandpass', f: 500, q: .6});
  const fi = loopNoise('fire', {type: 'highpass', f: 1800, q: .5});
  const r = loopNoise('river', {type: 'lowpass', f: 900, q: .3});
  const cv = loopNoise('cave', {type: 'lowpass', f: 180, q: 1});
  if (!w) return;
  const gust = .6 + .4 * Math.sin(t * .23) * Math.sin(t * .071 + 1);
  w.g.gain.setTargetAtTime(.12 * (level.wind || 0) * gust, t, .4);
  w.fl.frequency.setTargetAtTime(380 + 420 * gust, t, .5);
  fi.g.gain.setTargetAtTime(.09 * (level.fire || 0) * (.6 + Math.random() * .8), t, .05);
  r.g.gain.setTargetAtTime(.1 * (level.river || 0), t, .3);
  cv.g.gain.setTargetAtTime(.22 * (level.cave || 0), t, .6);
  // Occasional ambient voices: larks by day, drips in the cave.
  if (!muted && Math.random() < .004 * (level.birds || 0)) {
    const base = 2400 + Math.random() * 1400;
    for (let i = 0; i < 4; i++) osc('sine', base, base * (1.1 + Math.random() * .2), .06, .012, {at: i * .09, bus: ambBus});
  }
  if (!muted && Math.random() < .01 * (level.cave || 0)) osc('sine', 1400 + Math.random() * 600, 700, .12, .03, {bus: ambBus});
}

// ---------------------------------------------------------------- music
// A soft steppe drone with a breathy flute (sybyzgy-like) on a pentatonic scale.
const SCALE = [0, 2, 5, 7, 9, 12, 14, 17];
const PHRASES = {
  explore: [[0, 2], [2, 1], [3, 2], [4, 1], [3, 1], [2, 3], [-1, 2], [1, 1], [2, 1], [0, 4], [-1, 4]],
  village: [[2, 1], [3, 1], [4, 2], [3, 1], [2, 1], [1, 2], [0, 2], [-1, 1], [2, 1], [4, 1], [5, 2], [4, 4], [-1, 3]],
  danger: [[0, 1], [0, 1], [3, 1], [-1, 1], [0, 1], [1, 1], [0, 2], [-1, 2]],
  cave: [[0, 4], [-1, 2], [5, 3], [-1, 3], [3, 4], [-1, 4]],
  mystery: [[0, 6], [-1, 2], [1, 6], [-1, 4]],
  camp: [[4, 1], [5, 1], [7, 2], [5, 1], [4, 1], [2, 2], [4, 3], [-1, 1]],
};
let droneNodes = null;
function drone(on, root) {
  const c = C(); if (!c) return;
  if (!droneNodes) {
    const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'sine'; fl.type = 'lowpass'; fl.frequency.value = 320; g.gain.value = 0;
    o1.connect(fl); o2.connect(fl); fl.connect(g).connect(musicBus); o1.start(); o2.start();
    droneNodes = {o1, o2, g, fl};
  }
  const t = c.currentTime;
  droneNodes.o1.frequency.setTargetAtTime(root / 2, t, .5);
  droneNodes.o2.frequency.setTargetAtTime(root * .75, t, .5);
  droneNodes.g.gain.setTargetAtTime(on ? .06 : 0, t, 1.2);
}
function flute(freq, dur, at) {
  const c = C(); if (!c || muted) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
  o.type = 'sine'; o.frequency.value = freq; vib.frequency.value = 5.2; vg.gain.value = freq * .008;
  vib.connect(vg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.09, t + .08);
  g.gain.setValueAtTime(.08, t + dur * .7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicBus); o.start(t); vib.start(t); o.stop(t + dur + .05); vib.stop(t + dur + .05);
  noise(Math.min(.25, dur), .012, {at, f: freq * 2, q: 3, bus: musicBus, attack: .05});
}
function drum(at, accent) {
  osc('sine', accent ? 110 : 80, 45, .25, accent ? .14 : .08, {at, bus: musicBus});
  noise(.08, accent ? .04 : .02, {at, f: 200, q: 1, bus: musicBus});
}
export function music(mode) {
  if (mode === musicMode) return;
  musicMode = mode; musicStep = 0;
  clearTimeout(musicTimer);
  const roots = {explore: 196, village: 220, danger: 174.6, cave: 146.8, mystery: 130.8, camp: 246.9};
  drone(mode !== 'off', roots[mode] || 196);
  if (mode === 'off') return;
  const beat = mode === 'danger' ? .32 : mode === 'cave' || mode === 'mystery' ? .7 : .45;
  const tick = () => {
    if (musicMode !== mode) return;
    const phrase = PHRASES[mode];
    const [deg, len] = phrase[musicStep % phrase.length];
    const root = roots[mode];
    if (deg >= 0 && !muted) flute(root * 2 * Math.pow(2, SCALE[deg] / 12), len * beat * .95, 0);
    if (mode === 'danger' && !muted) { drum(0, musicStep % 4 === 0); drum(beat / 2, false); }
    if (mode === 'village' && musicStep % 4 === 0 && !muted) drum(0, false);
    musicStep++;
    musicTimer = setTimeout(tick, len * beat * 1000);
  };
  musicTimer = setTimeout(tick, 600);
}

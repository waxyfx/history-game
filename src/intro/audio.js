// Procedural score and sound effects for the intro (WebAudio, no audio files → tiny download).
// Events are scheduled just-in-time by the player, so pause (ctx.suspend) and skip stay in sync.

const A4 = 440;
const NOTE = {C: -9, 'C#': -8, Db: -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4, 'F#': -3, Gb: -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2};
const up = (n, o) => n.replace(/-?\d$/, d => +d + o);
export const hz = n => {const m = /^([A-G][b#]?)(-?\d)$/.exec(n); return A4 * 2 ** ((NOTE[m[1]] + (m[2] - 4) * 12) / 12);};

export function createAudio(ctx, {low = false, score: customScore} = {}) {
 const out = ctx.createGain(); out.gain.value = 0;
 const comp = ctx.createDynamicsCompressor();
 comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .2;
 out.connect(comp).connect(ctx.destination);
 const bus = name => {const g = ctx.createGain(); g.gain.value = {music: .6, sfx: .7, voice: .16}[name]; g.connect(out); return g;};
 const music = bus('music'), sfx = bus('sfx'), voice = bus('voice');
 const sr = ctx.sampleRate;

 const noiseBuf = ctx.createBuffer(1, sr * 2, sr);
 {const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;}
 const verb = ctx.createConvolver();
 {const len = Math.floor(sr * (low ? 1 : 1.8)), b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;}
  verb.buffer = b;}
 const verbOut = ctx.createGain(); verbOut.gain.value = .32; verb.connect(verbOut).connect(out);
 const live = new Set();

 // ── helpers ──
 const gain = (v = 1, dest) => {const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g;};
 const send = (node, amount) => node.connect(gain(amount, verb));
 const filt = (type, f, q = .7) => {const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;};
 function osc(type, f, t, end) {const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(end); track(o); return o;}
 function noise(t, end, rate = 1) {const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate; s.start(t, Math.random()); s.stop(end); track(s); return s;}
 function track(n) {live.add(n); n.onended = () => live.delete(n);}
 function env(g, t, a, peak, hold, rel) {
  const p = g.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a);
  p.setValueAtTime(peak, t + a + hold); p.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  return t + a + hold + rel + .05;
 }

 // ── instruments ──
 function pad(t, notes, dur, {vol = .07, cut = 900, type = 'sawtooth', att = 1.4, rel = 2.2, dest = music} = {}) {
  const f = filt('lowpass', cut, .5), g = gain(0); f.connect(g); g.connect(dest); send(g, .6);
  const end = env(g, t, att, vol, Math.max(0, dur - att), rel);
  for (const n of notes) for (const d of [-7, 6]) {const o = osc(type, hz(n), t, end); o.detune.value = d; o.connect(f);}
 }
 function bass(t, n, dur = .22, vol = .2) {
  const g = gain(0, music), f = filt('lowpass', 420); f.connect(g);
  const end = env(g, t, .008, vol, dur * .5, dur * .6);
  osc('sawtooth', hz(n), t, end).connect(f); osc('sine', hz(n) / 2, t, end).connect(g);
 }
 function arp(t, n, vol = .045) {
  const g = gain(0, music), f = filt('lowpass', 2400, 2); f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(600, t + .25);
  f.connect(g); send(g, .5);
  const end = env(g, t, .004, vol, .02, .32);
  osc('triangle', hz(n), t, end).connect(f); osc('square', hz(n) * 2, t, end).connect(gain(.25, f));
 }
 function bell(t, n, vol = .07) {
  const g = gain(0, music); send(g, 1.2);
  const end = env(g, t, .005, vol, .05, 2.6);
  const car = osc('sine', hz(n), t, end), mod = osc('sine', hz(n) * 3.5, t, end), mg = gain(hz(n) * 1.2);
  mod.connect(mg).connect(car.frequency); car.connect(g);
 }
 const ksCache = new Map();
 function ksBuffer(f) {
  const key = Math.round(f); if (ksCache.has(key)) return ksCache.get(key);
  const N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 1.8), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const ring = new Float32Array(N); let last = 0;
  for (let i = 0; i < N; i++) {last = last * .4 + (Math.random() * 2 - 1) * .6; ring[i] = last;}
  for (let i = 0, k = 0; i < len; i++) {const cur = ring[k], nx = ring[(k + 1) % N]; ring[k] = .4985 * (cur + nx); d[i] = cur; k = (k + 1) % N;}
  ksCache.set(key, buf); return buf;
 }
 // Dombra: plucked two-string dyads (Karplus–Strong), body resonance around 650 Hz.
 function dombra(t, notes, vol = .22) {
  const body = filt('peaking', 650, 1.4); body.gain.value = 5; const g = gain(vol, music); body.connect(g); send(g, .45);
  notes.forEach((n, i) => {const s = ctx.createBufferSource(); s.buffer = ksBuffer(hz(n)); s.connect(body); s.start(t + i * .012); track(s);});
 }
 // Kobyz-like bowed tone: two saws, vibrato, raspy noise, nasal band-pass.
 function kobyz(t, n, dur, vol = .06) {
  const bp = filt('bandpass', 950, .8), lp = filt('lowpass', 2600), g = gain(0, music);
  bp.connect(lp).connect(g); send(g, .9);
  const end = env(g, t, .45, vol, Math.max(0, dur - .45), .9);
  const vib = osc('sine', 5.2, t, end), vg = gain(5); vib.connect(vg);
  for (const d of [0, 8]) {const o = osc('sawtooth', hz(n), t, end); o.detune.value = d; vg.connect(o.detune); o.connect(bp);}
  const rasp = noise(t, end); const rf = filt('bandpass', hz(n) * 3, 6); rasp.connect(rf).connect(gain(.25, bp));
 }
 function kick(t, vol = .5) {const g = gain(0, music); const end = env(g, t, .002, vol, .02, .3); const o = osc('sine', 140, t, end); o.frequency.exponentialRampToValueAtTime(42, t + .14); o.connect(g);}
 function taiko(t, vol = .35) {
  const g = gain(0, music); send(g, .5); const end = env(g, t, .003, vol, .03, .55);
  const o = osc('sine', 105, t, end); o.frequency.exponentialRampToValueAtTime(58, t + .3); o.connect(g);
  const n = noise(t, t + .2); const f = filt('lowpass', 700); n.connect(f).connect(gain(.6, g));
 }
 function hat(t, vol = .03) {const g = gain(0, music); const end = env(g, t, .001, vol, .005, .05); noise(t, end).connect(filt('highpass', 7000)).connect(g);}
 function stab(t, notes, vol = .09) {pad(t, notes, .25, {vol, cut: 2200, att: .01, rel: .7});}

 // ── sound effects ──
 const FX = {
  cityAmb(t, dur) {const g = gain(0, sfx); env(g, t, 2, .05, dur - 3, 1); noise(t, t + dur, .5).connect(filt('lowpass', 500)).connect(g);},
  flyby(t) {const g = gain(0, sfx); const end = env(g, t, .8, .12, .1, 1); const n = noise(t, end), f = filt('bandpass', 400, 2);
   f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + .8); f.frequency.exponentialRampToValueAtTime(250, end); n.connect(f).connect(g);
   const o = osc('sawtooth', 160, t, end); o.frequency.linearRampToValueAtTime(220, t + .8); o.frequency.linearRampToValueAtTime(120, end); o.connect(filt('lowpass', 600)).connect(gain(.15, g));},
  hum(t, dur) {const g = gain(0, sfx); env(g, t, 1.5, .045, dur - 2.5, 1); for (const f of [55, 110, 165.5]) osc('sawtooth', f, t, t + dur).connect(filt('lowpass', 380)).connect(g);},
  typing(t) {for (let i = 0; i < 9; i++) {const s = t + i * .11 + Math.random() * .05, g = gain(0, sfx); const end = env(g, s, .001, .06, .005, .03); noise(s, end).connect(filt('bandpass', 3000 + Math.random() * 1500, 3)).connect(g);}},
  beep(t) {[0, .14].forEach((d, i) => {const g = gain(0, sfx); const end = env(g, t + d, .005, .05, .07, .05); osc('square', i ? 1320 : 990, t + d, end).connect(filt('lowpass', 3000)).connect(g);});},
  chime(t) {['A5', 'D6', 'E6', 'A6'].forEach((n, i) => bell(t + i * .14, n, .045));},
  alarm(t, dur) {for (let s = t; s < t + dur; s += .9) {const g = gain(0, sfx); const end = env(g, s, .02, .055, .7, .1); const o = osc('square', 620, s, end);
   o.frequency.setValueAtTime(620, s); o.frequency.linearRampToValueAtTime(880, s + .45); o.frequency.linearRampToValueAtTime(620, s + .85); o.connect(filt('lowpass', 1800)).connect(g); send(g, .4);}},
  door(t) {const g = gain(0, sfx); const end = env(g, t, .05, .2, .5, .5); const f = filt('bandpass', 900, 1.2);
   f.frequency.setValueAtTime(1600, t); f.frequency.exponentialRampToValueAtTime(300, end); noise(t, end).connect(f).connect(g);
   const th = gain(0, sfx); const e2 = env(th, t + .6, .005, .3, .02, .3); const o = osc('sine', 70, t + .6, e2); o.frequency.exponentialRampToValueAtTime(40, e2); o.connect(th);},
  steps(t) {for (let i = 0; i < 5; i++) {const s = t + i * .62, g = gain(0, sfx); const end = env(g, s, .002, .16, .01, .12); noise(s, end).connect(filt('bandpass', 260, 2)).connect(g); send(g, .5);}},
  sting(t) {pad(t, ['D2', 'A2', 'Eb3', 'D4'], 1.6, {vol: .1, cut: 1400, att: .02, rel: 2.5, dest: sfx}); taiko(t, .45);},
  click(t) {const g = gain(0, sfx); const end = env(g, t, .001, .35, .01, .08); noise(t, end).connect(filt('highpass', 2500)).connect(g);
   const o = osc('square', 1800, t, t + .04); o.connect(gain(.05, sfx));},
  powerUp(t) {const g = gain(0, sfx); const end = env(g, t, 3.5, .1, .4, .5); const o = osc('sawtooth', 80, t, end); o.frequency.exponentialRampToValueAtTime(900, t + 4);
   o.connect(filt('lowpass', 1800)).connect(g); send(g, .4);},
  whoosh(t) {const g = gain(0, sfx); const end = env(g, t, .12, .32, .05, .4); const f = filt('bandpass', 500, 1.5);
   f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2800, t + .2); f.frequency.exponentialRampToValueAtTime(400, end); noise(t, end).connect(f).connect(g);},
  swish(t) {const g = gain(0, sfx); const end = env(g, t, .06, .16, .02, .3); const f = filt('bandpass', 1200, 3); f.frequency.exponentialRampToValueAtTime(5000, end); noise(t, end).connect(f).connect(g);},
  punch(t) {const g = gain(0, sfx); const end = env(g, t, .002, .42, .02, .22); const o = osc('sine', 120, t, end); o.frequency.exponentialRampToValueAtTime(45, t + .15); o.connect(g);
   noise(t, t + .08).connect(filt('lowpass', 2200)).connect(gain(.6, g));},
  crash(t) {FX.punch(t); const g = gain(0, sfx); const end = env(g, t, .002, .35, .1, .9); noise(t, end).connect(filt('highpass', 1600)).connect(g); send(g, .6);},
  sparks(t) {for (let i = 0; i < 14; i++) {const s = t + Math.random() * 1.4, g = gain(0, sfx); const end = env(g, s, .001, .09 * Math.random() + .03, .01, .04); noise(s, end).connect(filt('highpass', 4000)).connect(g);}},
  tear(t) {const g = gain(0, sfx); const end = env(g, t, .02, .4, .5, .2); const f = filt('bandpass', 1800, 1); noise(t, end, .6).connect(f).connect(g);
   const am = osc('square', 38, t, end), ag = gain(.5); am.connect(ag).connect(g.gain);},
  pages(t) {for (let i = 0; i < 10; i++) {const s = t + i * .16, g = gain(0, sfx); const end = env(g, s, .02, .08, .05, .2); noise(s, end).connect(filt('bandpass', 2500 + i * 200, 2)).connect(g); bell(s, ['D6', 'A5', 'F6', 'E6', 'C6'][i % 5], .02);}},
  boom(t) {const g = gain(0, sfx); const end = env(g, t, .005, .45, .1, 2.2); const o = osc('sine', 80, t, end); o.frequency.exponentialRampToValueAtTime(30, t + 1.4); o.connect(g);
   noise(t, end, .4).connect(filt('lowpass', 500)).connect(gain(.8, g)); send(g, .5);},
  zaps(t, dur) {for (let s = t; s < t + dur; s += .25 + Math.random() * .55) {const g = gain(0, sfx); const len = .08 + Math.random() * .25; const end = env(g, s, .002, .12, len, .05);
   const o = osc('sawtooth', 70 + Math.random() * 90, s, end), lfo = osc('square', 40 + Math.random() * 80, s, end), lg = gain(600); lfo.connect(lg).connect(o.frequency);
   o.connect(filt('highpass', 300)).connect(g); noise(s, end).connect(filt('highpass', 5000)).connect(gain(.4, g));}},
  rumble(t, dur) {const g = gain(0, sfx); env(g, t, 1, .3, dur - 2, 1); noise(t, t + dur, .25).connect(filt('lowpass', 140, 2)).connect(g);
   const o = osc('sawtooth', 41, t, t + dur); o.connect(filt('lowpass', 120)).connect(gain(.35, g));},
  glass(t) {for (let i = 0; i < 20; i++) {const s = t + Math.random() * .5, g = gain(0, sfx); const end = env(g, s, .001, .08, .01, .25 * Math.random() + .05);
   osc('sine', 2500 + Math.random() * 5000, s, end).connect(g);} FX.click(t);},
  dissolve(t) {const g = gain(0, sfx); const end = env(g, t, .3, .2, 2.5, 1.2); const o = osc('sawtooth', 220, t, end); o.frequency.exponentialRampToValueAtTime(40, end);
   const f = filt('bandpass', 700, 4); f.frequency.exponentialRampToValueAtTime(120, end); o.connect(f).connect(g); noise(t, end).connect(filt('bandpass', 300, 3)).connect(gain(.5, g)); send(g, 1);},
  heart(t) {[0, .22].forEach((d, i) => {const g = gain(0, sfx); const end = env(g, t + d, .004, i ? .3 : .45, .02, .2); const o = osc('sine', 62, t + d, end); o.frequency.exponentialRampToValueAtTime(38, end); o.connect(g);});},
  tunnel(t, dur) {const g = gain(0, sfx); env(g, t, .4, .3, dur - .5, .1); const f = filt('bandpass', 200, 1.2); f.frequency.setValueAtTime(150, t); f.frequency.exponentialRampToValueAtTime(3000, t + dur);
   noise(t, t + dur).connect(f).connect(g); const o = osc('sawtooth', 50, t, t + dur); o.frequency.exponentialRampToValueAtTime(400, t + dur); o.connect(filt('lowpass', 900)).connect(gain(.3, g)); send(g, .6);},
  flashBoom(t) {FX.boom(t); const g = gain(0, sfx); const end = env(g, t, .002, .18, .05, 3); osc('sine', 1760, t, end).connect(g); send(g, 1.5);},
  wind(t, dur) {const g = gain(0, sfx); env(g, t, 2.5, .2, dur - 4, 1.4); const f = filt('bandpass', 500, .9); noise(t, t + dur, .7).connect(f).connect(g);
   const lfo = osc('sine', .13, t, t + dur), lg = gain(260); lfo.connect(lg).connect(f.frequency);
   const g2 = gain(0, sfx); env(g2, t, 3, .05, dur - 5, 1.5); const f2 = filt('bandpass', 1900, 8); noise(t, t + dur).connect(f2).connect(g2); const l2 = osc('sine', .21, t, t + dur); l2.connect(gain(500)).connect(f2.frequency);},
  eagle(t) {const g = gain(0, sfx); const end = env(g, t, .04, .07, .5, .5); const o = osc('sine', 2600, t, end);
   o.frequency.setValueAtTime(2900, t); o.frequency.exponentialRampToValueAtTime(1700, t + .9); const m = osc('sine', 33, t, end), mg = gain(140); m.connect(mg).connect(o.frequency); o.connect(g); send(g, 1.6);},
  gallop(t, dur) {for (let s = t; s < t + dur; s += .42) for (const d of [0, .07, .16]) {const q = s + d, g = gain(0, sfx); const end = env(g, q, .002, .07 * (1 - (q - t) / dur * .6), .01, .1);
   noise(q, end).connect(filt('lowpass', 300)).connect(g);}},
  stone(t) {[0, .09].forEach(d => {const g = gain(0, sfx); const end = env(g, t + d, .001, .25, .01, .12); noise(t + d, end).connect(filt('bandpass', 2400, 4)).connect(g);});},
 };

 // ── the score (absolute intro time → events) ──
 function score() {
  const ev = [], at = (t, fn) => ev.push({t, fn});
  // 1. Future: warm minor pads + gentle arpeggio, the Chronicle motif on bells.
  const chords = [['D3', 'A3', 'C4', 'E4', 'F4'], ['Bb2', 'F3', 'A3', 'D4'], ['G2', 'D3', 'F3', 'Bb3', 'A4'], ['A2', 'E3', 'G3', 'D4']];
  chords.forEach((c, i) => at(i * 7.5, w => {pad(w, c, 7.6, {vol: .05}); bass(w, c[0].replace(/\d/, d => d - 1), 7, .09);}));
  const arpNotes = chords.map(c => [...c.slice(1), c[1].replace(/\d/, d => +d + 1)]);
  for (let t = 9, i = 0; t < 29.8; t += .155, i++) {const c = arpNotes[Math.min(3, Math.floor(t / 7.5))]; const n = c[[0, 1, 2, 3, 2, 1][i % 6]]; at(t, w => arp(w, n, .03 + (i % 6 === 0 ? .015 : 0)));}
  const motif = ['A4', 'D5', 'C5', 'A4', 'G4', 'A4'];
  motif.forEach((n, i) => at(19.8 + i * .5, w => bell(w, n, .05)));
  // 2. Antagonist: low drone, chromatic pulse, villain chord.
  at(30, w => pad(w, ['D2', 'A2'], 27, {vol: .07, cut: 380, att: 3}));
  for (let t = 32.4, i = 0; t < 56.8; t += .25, i++) at(t, w => bass(w, ['D2', 'D2', 'D2', 'Eb2', 'D2', 'D2', 'D2', 'C2'][i % 8], .16, .12));
  at(48, w => pad(w, ['G2', 'D3', 'Bb3', 'Eb4'], 9, {vol: .045, cut: 1200}));
  for (let t = 48; t < 56.8; t += .125) at(t, w => hat(w, .012));
  // 3. Confrontation: riser into taiko drums + bass ostinato (140 bpm).
  at(57, w => pad(w, ['D3', 'Eb3', 'A3'], 5.5, {vol: .05, cut: 700, att: 4}));
  const beat = 60 / 140;
  for (let t = 62.5, b = 0; t < 77; t += beat / 2, b++) {
   const s = b % 8;
   if (s === 0 || s === 5) at(t, w => kick(w, .45));
   if (s === 2 || s === 6) at(t, w => taiko(w, .3));
   at(t, w => hat(w, s % 2 ? .015 : .025));
   at(t, w => bass(w, ['D2', 'D2', 'F2', 'D2', 'C2', 'C2', 'Eb2', 'C2'][s], .14, .13));
  }
  at(66.8, w => stab(w, ['D3', 'F3', 'A3', 'C4'])); at(71.4, w => stab(w, ['Eb3', 'G3', 'Bb3', 'D4'], .11));
  at(77, w => pad(w, ['D3', 'F3', 'A3', 'E4'], 8, {vol: .06, cut: 1600, att: .6}));
  motif.forEach((n, i) => at(77.6 + i * .42, w => bell(w, up(n, 1), .03)));
  // 4. Overload: double-time drums, distorted bass, then the slow-motion decision.
  for (let t = 85, b = 0; t < 96.8; t += beat / 2, b++) {
   if (b % 2 === 0) at(t, w => kick(w, .5)); if (b % 4 === 2) at(t, w => taiko(w, .35));
   at(t, w => bass(w, b % 8 < 6 ? 'D2' : 'Eb2', .12, .15)); at(t, w => hat(w, .02));
  }
  at(85, w => pad(w, ['D3', 'Eb3', 'Ab3', 'D4'], 12, {vol: .05, cut: 1800}));
  at(97, w => pad(w, ['A4', 'D5', 'E5'], 6.5, {vol: .03, cut: 3000, type: 'triangle', att: 1}));
  at(101, w => pad(w, ['D3', 'A3', 'D4', 'F#4', 'A4'], 3, {vol: .07, cut: 2400, att: .4, rel: 1}));
  // Tunnel: everything rises; the theme races backwards.
  for (let t = 103.6, i = 0; t < 111.4; t += .13, i++) at(t, w => arp(w, up(motif[motif.length - 1 - (i % 6)], 1), .025));
  at(103.6, w => pad(w, ['D3', 'A3', 'D4', 'E4'], 7.8, {vol: .05, cut: 3000, att: 6, rel: .2}));
  // 5–6. Steppe: wind, kobyz drone, dombra kuy built on the same motif → hopeful resolution.
  at(113.4, w => kobyz(w, 'D3', 25, .045)); at(116, w => kobyz(w, 'A3', 22, .03));
  const strum = [['D3', 'A3'], ['D3', 'G3'], ['D3', 'G3']];
  for (let t = 118, i = 0; t < 138.8; t += .28, i++) {
   const bar = Math.floor(i / 6) % 4, step = i % 6;
   const dy = bar === 3 ? (step % 3 ? ['C3', 'G3'] : ['C3', 'F3']) : strum[step % 3];
   at(t, w => dombra(w, dy, step % 3 === 0 ? .22 : .13));
  }
  const tune = ['A4', 'D5', 'C5', 'A4', 'G4', 'A4', 'F4', 'G4', 'A4', 'D4'];
  tune.forEach((n, i) => at(124 + i * .56 + (i > 5 ? .28 : 0), w => dombra(w, [n], .2)));
  tune.forEach((n, i) => at(131 + i * .56, w => dombra(w, [up(n, 1)], .16)));
  at(139, w => {pad(w, ['D3', 'A3', 'D4', 'F#4', 'A4'], 6, {vol: .05, cut: 1800, att: 2}); kobyz(w, 'A4', 2.6, .04);});
  at(141.6, w => kobyz(w, 'D5', 2.4, .04));
  at(144, w => {pad(w, ['D2', 'A2', 'D3', 'F#3', 'A3', 'E4'], 4, {vol: .06, cut: 2000, att: .3, rel: 3}); taiko(w, .4);});
  motif.forEach((n, i) => at(144.2 + i * .3, w => bell(w, up(n, 1), .04)));
  return ev.sort((a, b) => a.t - b.t);
 }

 let lastBlip = 0;
 return {
  ctx, events: customScore ? customScore({pad, bass, arp, bell, dombra, kobyz, kick, taiko, hat, stab, fx: (n, w, d) => FX[n]?.(w, d), up}).sort((a, b) => a.t - b.t) : score(),
  fx(name, when, dur) {FX[name]?.(when, dur);},
  blip(who, when) {
   if (when - lastBlip < .06) return; lastBlip = when;
   const g = gain(0, voice), f = filt('bandpass', who === 'villain' ? 600 : who === 'sys' ? 2400 : 1300, 2); f.connect(g);
   const base = who === 'villain' ? 105 : who === 'sys' ? 880 : 205;
   const end = env(g, when, .006, who === 'sys' ? .06 : .3, .02, .05);
   osc(who === 'sys' ? 'square' : who === 'villain' ? 'sawtooth' : 'triangle', base * (1 + Math.random() * .25), when, end).connect(f);
  },
  fadeIn(v = 1) {out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(v, ctx.currentTime, .05);},
  setMuted(m) {out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, .05);},
  fadeOut(sec = .6) {out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(0, ctx.currentTime, sec / 4);},
  stopAll() {for (const n of live) try {n.stop();} catch {} live.clear();},
  dispose() {this.stopAll(); setTimeout(() => out.disconnect(), 50);},
 };
}

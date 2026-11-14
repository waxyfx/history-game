// Motion-comic player shared by the intro and the author's easter egg. Stories are data:
// shots (with scene builders), timed lines (bubbles, captions, info cards) and an optional score.
import './intro.css';
import {h, defs, clamp, seg, motion} from './art.js';
import {createAudio} from './audio.js';

const UI = {
 kk: {skip: 'Өткізу', next: 'Әрі қарай', pause: 'Үзіліс', play: 'Жалғастыру', mute: 'Дыбысты өшіру', unmute: 'Дыбысты қосу', lang: 'Тіл', label: 'Кіріспе комикс', rotate: 'Толық көру үшін құрылғыны көлденең бұрыңыз', sound: 'Дыбысты қосу үшін түртіңіз'},
 ru: {skip: 'Пропустить', next: 'Далее', pause: 'Пауза', play: 'Продолжить', mute: 'Выключить звук', unmute: 'Включить звук', lang: 'Язык', label: 'Вступительный комикс', rotate: 'Поверните устройство горизонтально', sound: 'Нажмите, чтобы включить звук'},
};
const LANG_KEY = 'tarikh.introLang';
const store = {get(k) {try {return localStorage.getItem(k);} catch {return null;}}, set(k, v) {try {localStorage.setItem(k, v);} catch {}}};
export function introLang() {const s = store.get(LANG_KEY); return s === 'ru' || s === 'kk' ? s : /^ru/i.test(navigator.language || '') ? 'ru' : 'kk';}

/**
 * Plays a comic story over the page. Returns {done}: resolves when the overlay is gone.
 * Lines with hold:true (info cards) stop the clock until the viewer presses “next”.
 */
export function playComic(story, {audioCtx, low = false} = {}) {
 const {shots: SHOTS, lines: LINES, total: TOTAL, cast: CAST, sceneTitles: SCENE_TITLES, scenes: SCENES, voiceFiles: VOICE_FILES = {}, sceneCount = 6} = story;
 const holds = LINES.filter(l => l.hold).map(l => ({line: l, at: l.t0 + (l.holdAt ?? .9)})).sort((a, b) => a.at - b.at);
 let nextHold = 0, holding = null;
 let lang = introLang();
 const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
 motion.shake = reduced ? 0 : low ? .6 : 1;
 const T = () => UI[lang];

 // ── DOM ──
 const root = document.createElement('div');
 root.className = 'tj-intro'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
 root.innerHTML = `<div class="tj-stage"><canvas class="tj-fx"></canvas><div class="tj-art"></div><svg class="tj-bsvg" aria-hidden="true"></svg><div class="tj-bubbles"></div><div class="tj-cover"></div>
  <div class="tj-chip"></div><div class="tj-progress"><i></i></div></div>
  <div class="tj-titles"></div>
  <div class="tj-controls"><div class="tj-lang" role="group"><button data-l="kk">ҚАЗ</button><button data-l="ru">РУС</button></div>
  <button class="tj-ic" data-a="mute"></button><button class="tj-ic" data-a="pause"></button><button class="tj-skip" data-a="skip"></button></div>
  <button class="tj-sound" hidden></button><div class="tj-rotate"></div><div class="tj-live" aria-live="polite"></div>`;
 document.body.append(root);
 const $ = s => root.querySelector(s);
 const stage = $('.tj-stage'), art = $('.tj-art'), fxCanvas = $('.tj-fx'), bsvg = $('.tj-bsvg'), bubbles = $('.tj-bubbles'), cover = $('.tj-cover'), titles = $('.tj-titles');
 const svg = h('svg', {viewBox: '0 0 1600 900', preserveAspectRatio: 'xMidYMid slice', class: 'tj-svg'}); art.append(svg);
 defs(svg);
 const world = h('g', {}, svg);

 // ── stage sizing (16:9, letterboxed) ──
 let W = 0, H = 0;
 function layout() {
  const vw = innerWidth, vh = innerHeight; W = Math.min(vw, vh * 16 / 9); H = W * 9 / 16;
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  root.style.setProperty('--u', (W / 100) + 'px');
  const dpr = Math.min(devicePixelRatio || 1, low ? 1 : 1.5);
  fxCanvas.width = Math.round(W * dpr); fxCanvas.height = Math.round(H * dpr);
  bsvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  for (const b of shown.values()) drawBubble(b);
 }

 // ── audio ──
 let audio = null;
 try {if (audioCtx) {audio = createAudio(audioCtx, {low, score: story.score}); audioCtx.resume?.();}} catch (e) {console.warn(e); audio = null;}
 let muted = store.get('tarikh.introMuted') === '1';
 const cues = [...(audio?.events || []).map(e => ({t: e.t, run: w => e.fn(w)})), ...SHOTS.flatMap(s => s.cues.map(c => ({t: c.t, run: w => audio.fx(c.name, w, c.dur)})))].sort((a, b) => a.t - b.t);
 let cueIdx = 0;
 const soundBtn = $('.tj-sound');
 function audioReady() {return audio && audioCtx.state === 'running';}
 soundBtn.onclick = () => {audioCtx?.resume?.(); soundBtn.hidden = true;};

 // ── clock ──
 let t = 0, last = performance.now(), paused = false, ended = false, raf = 0, shotIdx = -1, current = null, previous = null;
 const ctx = {svg, canvas: fxCanvas, low, talking: who => speaking.has(who)};
 const speaking = new Set();
 const shown = new Map(), voices = new Set();

 function shotAt(time) {for (let i = SHOTS.length - 1; i >= 0; i--) if (time >= SHOTS[i].start) return i; return 0;}
 function enterShot(i) {
  const s = SHOTS[i];
  if (previous) previous.g.remove();
  previous = current && s.trans === 'fade' ? current : null;
  if (current && !previous) current.g.remove();
  const gEl = h('g', {}, world);
  fxCanvas.getContext('2d').clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  fxCanvas.style.visibility = s.canvas ? 'visible' : 'hidden';
  const update = SCENES[s.id](gEl, ctx);
  current = {g: gEl, update, shot: s};
  shotIdx = i;
  const chip = SCENE_TITLES[s.scene];
  $('.tj-chip').textContent = `${s.scene} / ${sceneCount} · ${chip[lang]}`;
 }

 // ── bubbles ──
 function lineText(line) {return line[lang] || line.kk;}
 function makeBubble(line) {
  const el = document.createElement('div');
  el.className = `tj-b tj-${line.kind}`;
  const text = lineText(line);
  if (line.kind === 'title') {
   el.innerHTML = `<small>${line.kind === 'title' ? (lang === 'ru' ? line.subRu : line.subKk) : ''}</small><strong></strong>`;
   el.querySelector('strong').textContent = text; titles.append(el);
   return {line, el, text, full: true};
  }
  if (line.kind === 'card') {
   const L = o => esc(o?.[lang] ?? o?.kk ?? o ?? '');
   el.innerHTML = `<div class="tj-card-k">${L(line.tag)}</div><h3>${L(line.name)}</h3><div class="tj-card-y">${L(line.years)}</div>${line.rel ? `<p class="tj-card-r">${L(line.rel)}</p>` : ''}<p>${L(line.fact)}</p><button class="tj-next" data-a="next">${T().next} <span aria-hidden="true">▸</span></button>`;
   el.style.left = line.p[0] + '%'; el.style.top = line.p[1] + '%'; el.style.width = (line.w || 34) + '%';
   bubbles.append(el); $('.tj-live').textContent = L(line.name) + '. ' + L(line.fact);
   return {line, el, text, full: true};
  }
  if (line.kind === 'sfx' || line.kind === 'flash') {
   el.textContent = text; el.style.left = line.p[0] + '%'; el.style.top = line.p[1] + '%';
   el.style.setProperty('--rot', (line.rot || 0) + 'deg');
   if (line.big) el.classList.add('tj-big');
   bubbles.append(el); return {line, el, text, full: true};
  }
  const name = line.who && line.who !== 'sys' && ['speech', 'shout', 'thought'].includes(line.kind) ? `<b class="tj-name">${CAST[line.who][lang]}</b>` : line.who === 'sys' ? `<b class="tj-name">${CAST.sys[lang]}</b>` : '';
  el.innerHTML = `${name}<span class="tj-on"></span><span class="tj-off"></span>`;
  el.style.left = line.p[0] + '%'; el.style.top = line.p[1] + '%'; el.style.maxWidth = (line.w || 30) + '%';
  bubbles.append(el);
  const b = {line, el, text, on: el.querySelector('.tj-on'), off: el.querySelector('.tj-off'), n: -1, shape: null};
  b.off.textContent = text;
  if (!['caption'].includes(line.kind)) b.shape = h('path', {class: `tj-shape tj-s-${line.kind}`}, bsvg);
  drawBubble(b);
  live(line);
  if (VOICE_FILES[lang]?.includes(line.id) && !muted) {b.voice = new Audio(`${story.voiceDir || '/intro/voice'}/${lang}/${line.id}.mp3`); b.voice.play().catch(() => {}); voices.add(b.voice);}
  return b;
 }
 function live(line) {const who = line.who ? CAST[line.who][lang] + ': ' : ''; $('.tj-live').textContent = who + lineText(line);}
 const esc = v => String(v).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
 function release() {if (!holding) return; holding = null; nextHold++; root.classList.remove('tj-holding'); last = performance.now(); if (audio && audioReady() && !muted) audio.blip('sys', audioCtx.currentTime + .01);}
 function drawBubble(b) {
  if (!b.shape) return;
  const r = b.el.getBoundingClientRect(), s = stage.getBoundingClientRect();
  const x = r.left - s.left, y = r.top - s.top, w = r.width, hh = r.height;
  const tip = b.line.tip ? [b.line.tip[0] / 100 * W, b.line.tip[1] / 100 * H] : null;
  b.shape.setAttribute('d', bubblePath(b.line.kind, x, y, w, hh, tip, b.line.t0));
 }
 function updateBubbles() {
  const active = new Set();
  speaking.clear();
  for (const line of LINES) {
   if (t < line.t0 || t >= line.t1) continue;
   active.add(line);
   let b = shown.get(line);
   if (!b) {b = makeBubble(line); shown.set(line, b);}
   if (b.on) {
    const n = Math.min(b.text.length, Math.floor((t - line.t0) * 42));
    if (n !== b.n) {
     if (n > b.n && !b.voice && audio && !muted && audioReady() && line.who && !paused && /[^\s.,…!?—-]/.test(b.text[n - 1] || '')) audio.blip(line.who, audioCtx.currentTime + .01);
     b.n = n; b.on.textContent = b.text.slice(0, n); b.off.textContent = b.text.slice(n);
    }
    if (line.who && n < b.text.length) speaking.add(line.who);
   }
   const fadeOut = clamp((line.t1 - t) / .25), fadeIn = clamp((t - line.t0) / .18);
   b.el.style.opacity = Math.min(fadeOut, line.kind === 'sfx' || line.kind === 'flash' ? 1 : fadeIn);
   if (b.shape) b.shape.style.opacity = b.el.style.opacity;
  }
  for (const [line, b] of shown) if (!active.has(line)) {b.el.remove(); b.shape?.remove(); shown.delete(line);}
 }
 function relang() {
  for (const [, b] of shown) {b.el.remove(); b.shape?.remove();}
  shown.clear();
  root.querySelectorAll('[data-l]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === lang)));
  $('[data-a="skip"]').innerHTML = `${T().skip} <span aria-hidden="true">⏭</span>`;
  $('[data-a="skip"]').setAttribute('aria-label', `${T().skip} (Esc)`);
  $('.tj-rotate').textContent = T().rotate; soundBtn.textContent = '🔈 ' + T().sound;
  root.setAttribute('aria-label', story.label?.[lang] || T().label);
  if (current) {const chip = SCENE_TITLES[current.shot.scene]; $('.tj-chip').textContent = `${current.shot.scene} / ${sceneCount} · ${chip[lang]}`;}
  syncButtons();
 }
 function syncButtons() {
  const p = $('[data-a="pause"]'), m = $('[data-a="mute"]');
  p.innerHTML = paused ? '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  p.setAttribute('aria-label', paused ? T().play : T().pause);
  m.innerHTML = muted ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  m.setAttribute('aria-label', muted ? T().unmute : T().mute);
  m.disabled = !audio;
 }

 // ── loop ──
 let resolveDone; const done = new Promise(r => {resolveDone = r;});
 let outro = null;
 function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (paused || ended) return;
  if (!holding) t += dt;
  if (!holding && nextHold < holds.length && t >= holds[nextHold].at) {t = holds[nextHold].at; holding = holds[nextHold]; root.classList.add('tj-holding'); setTimeout(() => root.querySelector('.tj-next')?.focus({preventScroll: true}), 50);}
  if (outro == null && t >= TOTAL) return finish(false);
  const i = shotAt(t);
  if (i !== shotIdx) enterShot(i);
  const s = current.shot, lt = t - s.start;
  current.update(lt, dt);
  if (previous) {
   const k = clamp(lt / .7);
   current.g.setAttribute('opacity', k.toFixed(3));
   if (k >= 1) {previous.g.remove(); previous = null; current.g.removeAttribute('opacity');}
  }
  // Transitions through black / white / flash.
  const tr = s.trans, coverK = tr === 'black' ? 1 - seg(lt, 0, 1) : tr === 'white' ? 1 - seg(lt, 0, 1.4) : tr === 'flash' ? (1 - seg(lt, 0, .35)) * (motion.shake ? .9 : .4) : 0;
  cover.style.background = tr === 'black' ? '#000' : '#fff'; cover.style.opacity = coverK.toFixed(3);
  // Final hand-off: the comic dissolves into the game camera underneath.
  if (s.handoff) {
   const k = seg(lt, 6.3, 8.4);
   stage.style.opacity = (1 - k).toFixed(3); root.style.setProperty('--bg', `rgba(0,0,0,${(1 - k).toFixed(3)})`);
   titles.style.opacity = (1 - seg(lt, 8.4, 9)).toFixed(3);
  }
  updateBubbles();
  // Just-in-time audio scheduling.
  if (audio) {
   while (cueIdx < cues.length && cues[cueIdx].t <= t + .12) {
    const c = cues[cueIdx++];
    if (c.t >= t - .25 && audioReady()) try {c.run(audioCtx.currentTime + Math.max(0, c.t - t) + .02);} catch (e) {console.warn(e);}
   }
   if (!audioReady() && audioCtx.state === 'suspended' && t > .8 && !paused) soundBtn.hidden = false;
  }
  $('.tj-progress i').style.transform = `scaleX(${(t / TOTAL).toFixed(4)})`;
 }
 function seek(time) {t = clamp(time, 0, TOTAL - .01); holding = null; root.classList.remove('tj-holding'); nextHold = holds.findIndex(x => x.at > t); if (nextHold < 0) nextHold = holds.length; cueIdx = cues.findIndex(c => c.t >= t); if (cueIdx < 0) cueIdx = cues.length; audio?.stopAll();}
 function setPaused(p) {
  paused = p; syncButtons();
  if (audioCtx && audio) {if (p) audioCtx.suspend?.(); else audioCtx.resume?.();}
  for (const v of voices) if (!v.ended) p ? v.pause() : v.play().catch(() => {});
  root.classList.toggle('tj-paused', p);
 }
 function finish(skipped) {
  if (outro != null) return; outro = performance.now(); ended = true;
  audio?.fadeOut(skipped ? .5 : 1.2); for (const v of voices) v.pause();
  if (audioCtx?.state === 'suspended') audioCtx.resume?.();
  root.classList.add('tj-out');
  setTimeout(() => {
   cancelAnimationFrame(raf); removeEventListener('resize', layout); removeEventListener('keydown', onKey, true); document.removeEventListener('visibilitychange', onVis);
   audio?.dispose(); root.remove(); if (story.seenKey) store.set(story.seenKey, '1');
   resolveDone({skipped});
  }, skipped ? 450 : 350);
 }

 // ── controls ──
 function onKey(e) {
  if (holding && ['Enter', 'Space', 'KeyE', 'ArrowRight'].includes(e.code)) {e.preventDefault(); e.stopPropagation(); release();}
  else if (e.code === 'Escape' || (e.code === 'Enter' && story.enterSkips !== false)) {e.preventDefault(); e.stopPropagation(); finish(true);}
  else if (e.code === 'KeyE') {e.preventDefault(); e.stopPropagation();}
  else if (e.code === 'Space' || e.code === 'KeyK') {e.preventDefault(); e.stopPropagation(); setPaused(!paused);}
  else if (e.code === 'KeyM') {e.stopPropagation(); toggleMute();}
 }
 function toggleMute() {if (!audio) return; muted = !muted; audio.setMuted(muted); for (const v of voices) v.muted = muted; store.set('tarikh.introMuted', muted ? '1' : '0'); syncButtons();}
 root.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.l) {lang = b.dataset.l; store.set(LANG_KEY, lang); relang();}
  if (b.dataset.a === 'skip') finish(true);
  if (b.dataset.a === 'next') release();
  if (b.dataset.a === 'pause') setPaused(!paused);
  if (b.dataset.a === 'mute') toggleMute();
 });
 addEventListener('keydown', onKey, true);
 addEventListener('resize', layout);
 // Pause while the tab is hidden; resume automatically if we were the ones who paused.
 let autoPaused = false;
 const onVis = () => {
  if (ended) return;
  if (document.hidden && !paused) {autoPaused = true; setPaused(true);}
  else if (!document.hidden && autoPaused) {autoPaused = false; last = performance.now(); setPaused(false);}
 };
 document.addEventListener('visibilitychange', onVis);

 layout(); relang();
 if (audio) {audio.setMuted(muted); if (!muted) audio.fadeIn();}
 document.fonts?.load?.('700 20px Rubik').catch(() => {});
 $('[data-a="skip"]').focus({preventScroll: true});
 if (import.meta.env.DEV) {
  const q = new URLSearchParams(location.search);
  if (q.has(story.devKey || 'introT')) seek(+q.get(story.devKey || 'introT'));
  if (q.has('introPause')) {paused = true; setTimeout(() => {const i = shotAt(t); enterShot(i); current.update(t - current.shot.start, 0); updateBubbles(); syncButtons();}, 0);}
  window.__tjIntro = {seek: s => {seek(s); const i = shotAt(t); enterShot(i); current.update(t - current.shot.start, .016); updateBubbles();}, pause: () => setPaused(true), play: () => setPaused(false), get t() {return t;}, finish, release, step: sec => {for (let i = 0; i < sec * 20; i++) frame(last + 50);}};
 }
 raf = requestAnimationFrame(n => {last = n; frame(n);});
 return {done};
}

// Bubble outlines (speech/shout/thought/sys) drawn as one SVG path so tail and body share a single ink line.
function bubblePath(kind, x, y, w, hh, tip, seed) {
 const cx = x + w / 2, cy = y + hh / 2;
 if (kind === 'shout') {
  const n = 22, pts = []; let s = Math.floor(seed * 100) || 7;
  const rx = w / 2 + 22, ry = hh / 2 + 18;
  for (let i = 0; i < n; i++) {
   const a = i / n * Math.PI * 2, out = i % 2 ? .82 : 1.08 + ((s = (s * 9301 + 49297) % 233280) / 233280) * .14;
   pts.push([cx + Math.cos(a) * rx * out, cy + Math.sin(a) * ry * out]);
  }
  if (tip) {const a = Math.atan2(tip[1] - cy, tip[0] - cx); let best = 0, bd = 9; pts.forEach((p, i) => {if (i % 2) return; const d = Math.abs(((Math.atan2(p[1] - cy, p[0] - cx) - a + 9.42) % 6.283) - 3.14); if (d < bd) {bd = d; best = i;}}); pts[best] = tip;}
  return 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' L') + 'Z';
 }
 if (kind === 'thought') {
  const rx = w / 2 + 18, ry = hh / 2 + 14, n = 12; let d = '';
  for (let i = 0; i <= n; i++) {
   const a = i / n * Math.PI * 2, px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
   if (!i) d += `M${px.toFixed(1)},${py.toFixed(1)}`; else d += ` A${(rx * .32).toFixed(1)},${(ry * .38).toFixed(1)} 0 0 1 ${px.toFixed(1)},${py.toFixed(1)}`;
  }
  d += 'Z';
  if (tip) for (const [k, r] of [[.45, 9], [.72, 6], [.92, 4]]) {
   const ex = cx + (tip[0] - cx) * k, ey = cy + (tip[1] - cy) * k;
   const sx = lerpEdge(cx, cy, rx, ry, tip, k);
   if (sx) d += ` M${(ex + r).toFixed(1)},${ey.toFixed(1)} a${r},${r} 0 1 0 ${-2 * r},0 a${r},${r} 0 1 0 ${2 * r},0Z`;
  }
  return d;
 }
 // Rounded rectangle (speech) or chamfered panel (sys) with an optional tail merged into the outline.
 const pad = kind === 'sys' ? 0 : 6, X = x - pad, Y = y - pad, Wd = w + pad * 2, Hd = hh + pad * 2;
 const r = kind === 'sys' ? 0 : Math.min(Hd / 2, 26);
 const edges = [];
 let tailSide = null, base = 0;
 if (tip && kind !== 'sys') {
  if (tip[1] > Y + Hd) tailSide = 'b'; else if (tip[1] < Y) tailSide = 't'; else tailSide = tip[0] < X ? 'l' : 'r';
  const tw = Math.min(26, (tailSide === 'b' || tailSide === 't' ? Wd : Hd) * .25);
  base = tailSide === 'b' || tailSide === 't' ? clamp(tip[0] * .35 + cx * .65, X + r + tw, X + Wd - r - tw) : clamp(tip[1] * .35 + cy * .65, Y + r + tw, Y + Hd - r - tw);
  edges.tw = tw;
 }
 const tw = edges.tw || 0, T = tip;
 let d = `M${X + r},${Y}`;
 if (tailSide === 't') d += ` L${base - tw},${Y} L${T[0]},${T[1]} L${base + tw},${Y}`;
 d += ` L${X + Wd - r},${Y} Q${X + Wd},${Y} ${X + Wd},${Y + r}`;
 if (tailSide === 'r') d += ` L${X + Wd},${base - tw} L${T[0]},${T[1]} L${X + Wd},${base + tw}`;
 d += ` L${X + Wd},${Y + Hd - r} Q${X + Wd},${Y + Hd} ${X + Wd - r},${Y + Hd}`;
 if (tailSide === 'b') d += ` L${base + tw},${Y + Hd} L${T[0]},${T[1]} L${base - tw},${Y + Hd}`;
 d += ` L${X + r},${Y + Hd} Q${X},${Y + Hd} ${X},${Y + Hd - r}`;
 if (tailSide === 'l') d += ` L${X},${base + tw} L${T[0]},${T[1]} L${X},${base - tw}`;
 d += ` L${X},${Y + r} Q${X},${Y} ${X + r},${Y}Z`;
 if (kind === 'sys' && tip) d += ` M${cx},${Y + Hd} L${tip[0]},${tip[1]}`;
 return d;
}
function lerpEdge(cx, cy, rx, ry, tip, k) {const dx = (tip[0] - cx) / rx, dy = (tip[1] - cy) / ry; return Math.hypot(dx, dy) * k > 1.05;}

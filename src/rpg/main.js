// MAP01 page: boots the C++/WASM engine, uploads the sprite atlas, runs the fixed-step loop and
// owns the DOM UI (HUD, dialogue, quizzes, inventory, minimap), story flow, audio and co-op glue.
import './style.css';
import {decodePNG, browserInflate} from './png.js';
import {ATLAS_RECTS} from './gen/atlas.js';
import {MAP01} from './gen/map01.js';
import {UI, ITEMS, ITEM_ICONS, INTERACT_LABEL, getLang, setLang} from './i18n.js';
import {SPEAKERS, ZONE_NAMES, QUESTS, HISTORICAL_QUIZZES, BONUS_QUIZ, MAIN_QUIZ_ORDER, SECRETS} from './story.js';
import {ALL_EPOCHS} from './campaign.js';
import {sfx, music, ambience, toggleAudioMute, isAudioMuted, unlockAudio} from './audio.js';
import {createParty, makeCode, MAX_PARTY} from './net.js';
import {restoreSnapshot} from './persistence.js';
import {A, SH, TS, IT, newFlags, mergeFlags, applyWorld, createQuest, questStage, questTarget, scoreOf, secretsFound, quizPoints} from './quest.js';

const W = 480, H = 320, SAVE_KEY = 'tarikh.rpg.v3', RESULTS_KEY = 'tarikh.rpg.results';
const SFX_NAMES = ['step_grass', 'step_dirt', 'step_water', 'step_cave', 'sword', 'spear', 'bow', 'arrow_hit', 'enemy_hurt', 'enemy_die', 'howl', 'growl', 'roar', 'swipe', 'shout', 'pickup', 'splash', 'hooves', 'block', 'down', 'revive', 'impact', 'bowstring'];
const EV = {SFX: 1, INTERACT: 2, TRIGGER: 3, ENEMY_DIED: 4, PICKUP: 5, HURT: 6, DOWN: 7, DEAD: 8, REVIVED: 9, ZONE: 10, ENEMY_HIT: 11, PEER_HIT: 12, REVIVE_PEER: 13, PLATES: 14, ALERT: 15, HOLD: 16, NOAMMO: 17};
const NAMES = {
  kk: {page1: 'Жарқыраған үзінді', track1: 'Із', track2: 'Сынған жебе', track3: 'Сүйреткен із', track4: 'Қорамсақ', toolpile: 'Шақпақтың құралдары', firepit: 'Ошақ', thicket: 'Қалың бұта',
    cachebush: 'Бұта', cache: 'Жасырын қойма', rope: 'Арқан', boulder: 'Үлкен тас', lever: 'Бөрене-тұтқа', cavemouth: 'Суретті үңгір', caveexit: 'Шығу', petro1: 'Жартас суреті', petro2: 'Жартас суреті',
    petro3: 'Жартас суреті', petro4: 'Жартас суреті', crack: 'Жарық', altar: 'Бабалар қабырғасы', flute: 'Себет', zmark: 'Бөтен белгі', page2: 'Шежіре парағы', homegate: 'Уақыт өткелі', campgate: 'MAP02 қақпасы', holo: 'Шежіре үстелі'},
  ru: {page1: 'Светящийся фрагмент', track1: 'Следы', track2: 'Сломанная стрела', track3: 'Волок', track4: 'Колчан', toolpile: 'Орудия Шақпақа', firepit: 'Очаг', thicket: 'Заросли',
    cachebush: 'Куст', cache: 'Тайник', rope: 'Верёвка', boulder: 'Огромный камень', lever: 'Бревно-рычаг', cavemouth: 'Расписная пещера', caveexit: 'Выход', petro1: 'Наскальный рисунок', petro2: 'Наскальный рисунок',
    petro3: 'Наскальный рисунок', petro4: 'Наскальный рисунок', crack: 'Трещина', altar: 'Стена предков', flute: 'Корзина', zmark: 'Чужой знак', page2: 'Страница Шежире', homegate: 'Временной проход', campgate: 'Врата MAP02', holo: 'Стол Шежире'},
};
const VERB = {kk: {take: 'алу', examine: 'зерттеу', hold: 'ұстап тұр', enter: 'кіру', talk: 'сөйлесу', revive: 'тұрғызу (ұстап тұр)'}, ru: {take: 'взять', examine: 'изучить', hold: 'удерживай', enter: 'войти', talk: 'говорить', revive: 'поднять (удерживай)'}};
const HEROES = ['aibar', 'dana', 'erlan'];

let lang = getLang();
document.documentElement.lang = lang;
const t = k => UI[lang][k] ?? UI.kk[k] ?? k;
const L = o => o == null ? '' : typeof o === 'string' ? o : o[lang] ?? o.kk ?? '';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- DOM
document.querySelector('#rpg-app').innerHTML = `
<main class="rpg">
  <section class="stage">
    <div class="viewport" id="viewport">
      <canvas id="world" width="${W}" height="${H}" tabindex="0" aria-label="MAP01"></canvas>
      <div class="hud" id="hud">
        <div class="hud-tl">
          <div class="hp"><span class="hp-icon">♥</span><div class="hp-track"><div id="hp-fill"></div><span id="hp-text"></span></div><span id="lives" class="lives"></span></div>
          <div id="allies" class="allies"></div>
        </div>
        <div class="hud-tr" id="tracker"><small id="zone-name"></small><b id="obj-title"></b><span id="obj-detail"></span>
          <span class="stats"><i id="s-score"></i><i id="s-secrets"></i><i id="s-quiz"></i></span></div>
        <div class="hotbar" id="hotbar">
          <div class="slots" id="slots"></div>
          <div class="ammo"><span id="ammo-icon"></span><b id="arrows">0</b></div>
          <span class="sep"></span>
          <button id="b-inv" class="hb"></button><button id="b-save" class="hb"></button><button id="b-load" class="hb"></button>
          <button id="b-road" class="hb"></button><button id="b-help" class="hb"></button>
          <span class="sep"></span>
          <button id="lang-btn" class="hb"></button><button id="audio-btn" class="hb"></button><button id="coop-btn" class="hb"></button>
          <button id="fs-btn" class="hb" title="Fullscreen">⛶</button><a class="hb" href="/" title="Home">⌂</a>
        </div>
        <canvas id="minimap" class="minimap" width="112" height="72"></canvas>
        <div id="prompt" class="prompt" hidden></div>
        <div id="banner" class="banner"></div>
        <div id="toasts" class="toasts" aria-live="polite"></div>
      </div>
      <div class="bars" id="bars"><i></i><i></i></div>
      <div class="fade" id="fade"></div>
      <div class="dlg" id="dlg" hidden>
        <canvas id="dlg-portrait" width="48" height="48"></canvas>
        <div class="dlg-body"><b id="dlg-name"></b><p id="dlg-text"></p><small id="dlg-fact" hidden></small></div>
        <span class="dlg-next">▼</span>
      </div>
      <button class="skip" id="skip" hidden></button>
      <div class="panel" id="panel" hidden><div class="panel-card" id="panel-card"></div></div>
      <p id="loading" class="loading" role="status"></p>
      <div class="touch" id="touch">
        <div class="dpad"><button data-key="1" aria-label="up">▲</button><button data-key="4" aria-label="left">◀</button><button data-key="2" aria-label="down">▼</button><button data-key="8" aria-label="right">▶</button></div>
        <div class="acts"><button data-key="64" aria-label="run">⇧</button><button data-key="32" aria-label="attack">⚔</button><button data-key="16" aria-label="action">E</button></div>
      </div>
    </div>
  </section>
</main>`;

const canvas = $('world'), ctx = canvas.getContext('2d', {alpha: false});
const mini = $('minimap'), mctx = mini.getContext('2d');
let E = null, frame = null, atlasCanvas = null;

// ---------------------------------------------------------------- state
const G = {
  E: null, flags: newFlags(), local: {granted: [], attempts: {}, seen: [], crystal: 0}, armed: null, alarm: null, forceNpc: true,
  lang: () => lang, party: () => party.size, area: () => E ? E.tj_state(35) : 0,
};
const party = {size: 1, slot: 0, host: true, net: null, members: [], peers: new Map(), lastState: 0, lastEnemies: 0, lastFlags: 0};
let quest, panelOpen = false, cine = null, dialogBusy = false, loopStarted = false;
let lastTime = 0, acc = 0, hudKey = '', lastZone = -1, lastSave = 0, flagsDirty = false, minimapArea = -1, miniBase = null;
const held = new Set(), touch = new Map();
const keyBits = {KeyW: 1, ArrowUp: 1, KeyS: 2, ArrowDown: 2, KeyA: 4, ArrowLeft: 4, KeyD: 8, ArrowRight: 8, KeyE: 16, Space: 32, ShiftLeft: 64, ShiftRight: 64};

function input() {
  if (!E) return;
  const blocked = panelOpen || dialogBusy || cine;
  let mask = 0;
  if (!blocked) { for (const c of held) mask |= keyBits[c] || 0; for (const v of touch.values()) mask |= v; }
  E.tj_input(mask);
}
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  $('toasts').append(el);
  setTimeout(() => el.classList.add('out'), 3400); setTimeout(() => el.remove(), 4000);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}
function iconHTML(name) {
  const r = ATLAS_RECTS[name]; if (!r) return '';
  return `<i class="icon" style="background-position:-${r[0] * 2}px -${r[1] * 2}px"></i>`;
}
function drawPortrait(cv, who) {
  const c2 = cv.getContext('2d'); c2.imageSmoothingEnabled = false; c2.clearRect(0, 0, 48, 48);
  const r = ATLAS_RECTS[SPEAKERS[who]?.portrait || who];
  if (r && atlasCanvas) c2.drawImage(atlasCanvas, r[0], r[1], r[2], r[3], 0, 0, 48, 48);
}
const heroPos = () => [E.tj_state(0) / 1000, E.tj_state(1) / 1000];

// ---------------------------------------------------------------- dialogue
let dlgResolve = null, typing = null;
async function say(lines, fact) {
  if (!lines || !lines.length) return;
  const owned = !cine; // Free conversations freeze the action locally.
  if (owned) { dialogBusy = true; freeze(true); }
  for (let i = 0; i < lines.length; i++) {
    if (cine?.skipping) break;
    const line = lines[i], sp = SPEAKERS[line.who] || {kk: line.who, ru: line.who};
    $('dlg').hidden = false;
    $('dlg').classList.toggle('sys', line.who === 'sys');
    $('dlg').classList.toggle('villain', line.who.startsWith('zulmat'));
    $('dlg-name').textContent = L(sp);
    drawPortrait($('dlg-portrait'), line.who);
    const showFact = fact && i === lines.length - 1;
    $('dlg-fact').hidden = !showFact;
    if (showFact) $('dlg-fact').innerHTML = `<b>${esc(t('fact'))}</b> ${esc(L(fact))}`;
    sfx('dialog');
    await typeLine(L(line));
    if (!cine?.skipping) await new Promise(r => { dlgResolve = r; });
  }
  $('dlg').hidden = true;
  if (owned) { dialogBusy = false; freeze(false); }
}
function typeLine(text) {
  return new Promise(res => {
    const el = $('dlg-text'); let n = 0;
    el.textContent = '';
    clearInterval(typing);
    const finish = () => { clearInterval(typing); typing = null; el.textContent = text; dlgResolve = null; res(); };
    typing = setInterval(() => {
      n += 2; el.textContent = text.slice(0, n);
      if (n % 8 === 0) sfx('type');
      if (n >= text.length || cine?.skipping) finish();
    }, 22);
    dlgResolve = finish;
  });
}
function advanceDialog() {
  if ($('dlg').hidden || !dlgResolve) return false;
  const r = dlgResolve; dlgResolve = null; r(); return true;
}
function freeze(on) {
  if (!E) return;
  if (party.size > 1) E.tj_control(on ? 0 : 1); else E.tj_cinematic(on ? 1 : 0);
  input();
}

// ---------------------------------------------------------------- cutscenes (skip = fast-forward to the end state)
async function playCutscene(id, script, broadcast = true) {
  if (cine || G.local.seen.includes(id)) return;
  G.local.seen.push(id);
  if (broadcast && party.net) party.net.send('cut', {id});
  const d = cine = {id, skipping: false, afters: []};
  E.tj_cinematic(1); input();
  $('bars').classList.add('on'); $('skip').hidden = false; $('skip').textContent = t('skip');
  const isAibar = party.slot === 0;
  Object.assign(d, {
    wait: ms => d.skipping ? Promise.resolve() : new Promise(r => { const s = setInterval(() => { if (d.skipping) { clearInterval(s); r(); } }, 50); setTimeout(() => { clearInterval(s); r(); }, ms); }),
    say: lines => say(lines),
    cam: (x, y, speed) => E.tj_camera(1, Math.round(x), Math.round(y), Math.round((d.skipping ? 999 : speed) * 100)),
    camFollow: () => E.tj_camera(0, 0, 0, 0),
    fadeIn: async ms => { const f = $('fade'); f.style.transition = 'none'; f.style.opacity = 1; await sleep(30); f.style.transition = `opacity ${d.skipping ? 0 : ms}ms`; f.style.opacity = 0; await d.wait(ms); },
    pose: (anim, ticks) => { if (isAibar) E.tj_pose(anim, ticks); },
    face: f => { if (isAibar) E.tj_face(f); },
    walk: async (x, y) => {
      if (!isAibar) return;
      for (let i = 0; i < 600; i++) {
        const [hx, hy] = heroPos();
        if (Math.hypot(x - hx, y - hy) < 1.5) break;
        if (d.skipping) { E.tj_teleport(Math.round(x), Math.round(y)); break; }
        E.tj_walk_to(Math.round(x), Math.round(y)); await sleep(16);
      }
    },
    fx: (x, y, type, n) => E.tj_spawn_fx(type, Math.round(x), Math.round(y), n),
    fog: n => E.tj_fog(n), music: m => music(m),
    final: fn => fn(), after: fn => d.afters.push(fn),
  });
  try { await script(d); } catch (e) { console.error(e); }
  if (d.skipping) { E.tj_shadow(0, 0, 0); E.tj_fog(0); $('fade').style.transition = 'none'; $('fade').style.opacity = 0; }
  E.tj_camera(0, 0, 0, 0);
  $('bars').classList.remove('on'); $('skip').hidden = true; $('dlg').hidden = true;
  cine = null; E.tj_cinematic(0); input();
  applyWorld(G); changed(); autosave();
  musicForZone(true);
  for (const fn of d.afters) await fn();
}
function skipCutscene() { if (cine && !cine.skipping) { cine.skipping = true; advanceDialog(); } }

// ---------------------------------------------------------------- panels
let panelResolve = null;
function openPanel(html, cls = '', pauseGame = true) {
  $('panel-card').className = 'panel-card ' + cls;
  $('panel-card').innerHTML = html;
  $('panel').hidden = false; panelOpen = true;
  if (E) { if (pauseGame && party.size === 1) E.tj_pause(1); else E.tj_control(0); }
  input();
  $('panel-card').querySelector('button,input')?.focus();
}
function closePanel() {
  if (!panelOpen) return;
  $('panel').hidden = true; panelOpen = false;
  if (E) { E.tj_pause(0); if (!cine && !dialogBusy) E.tj_control(1); }
  lastTime = performance.now(); acc = 0; input(); canvas.focus({preventScroll: true});
  const r = panelResolve; panelResolve = null; r?.();
}
const panelDone = () => new Promise(r => { panelResolve = r; });

function quiz(n) {
  const q = HISTORICAL_QUIZZES[n];
  const fld = k => lang === 'ru' && q[k + '_ru'] ? q[k + '_ru'] : q[k];
  const head = `<p class="eyebrow">${esc(fld('questTitle'))} · ${esc(t('fact'))}</p><h2>${esc(fld('title'))}</h2>`;
  if (G.flags.quiz[q.id]) {
    openPanel(`${head}<p>${esc(t('solvedBefore'))}</p><p class="fact">${esc(fld('explanation'))}</p><p class="src">${esc(t('source'))}: ${esc(q.source)}</p><button class="primary" data-close>${esc(t('next'))} →</button>`, 'quiz');
    return panelDone().then(() => true);
  }
  openPanel(`${head}<p class="q">${esc(fld('question'))}</p><div class="opts">${fld('options').map((o, i) => `<button data-opt="${i}">${esc(o)}</button>`).join('')}</div><div id="qfb" class="qfb" hidden></div><p class="src">${esc(t('source'))}: ${esc(q.source)}</p><button class="primary" data-close hidden>${esc(t('next'))} →</button>`, 'quiz');
  $('panel-card').querySelectorAll('[data-opt]').forEach(btn => btn.onclick = () => {
    if (btn.disabled) return;
    const a = (G.local.attempts[q.id] || 0) + 1; G.local.attempts[q.id] = a;
    const fb = $('qfb'); fb.hidden = false;
    if (+btn.dataset.opt === q.correctIndex) {
      sfx('quiz_ok');
      if (!G.flags.quiz[q.id]) { G.flags.quiz[q.id] = {a, t: Date.now(), by: party.slot}; changed(); }
      const pts = quizPoints(G.flags.quiz[q.id].a);
      fb.className = 'qfb ok'; fb.innerHTML = `<b>✓ ${esc(t('quizRight'))} +${pts} ${esc(t('points'))}</b><br>${esc(fld('explanation'))}`;
      $('panel-card').querySelectorAll('[data-opt]').forEach(b => b.disabled = true);
      btn.classList.add('right');
      const c = $('panel-card').querySelector('[data-close]'); c.hidden = false; c.focus();
      applyWorld(G); autosave();
    } else {
      sfx('quiz_bad'); btn.disabled = true; btn.classList.add('wrong');
      fb.className = 'qfb bad'; fb.innerHTML = `<b>✗ ${esc(t('quizWrong'))}</b> ${esc(fld('hint'))} <em>(${a} ${esc(t('attempt'))})</em>`;
    }
  });
  return panelDone().then(() => !!G.flags.quiz[q.id]);
}
function bonusQuiz() {
  let i = 0, correct = 0;
  const total = BONUS_QUIZ.questions.length;
  const show = () => {
    const q = BONUS_QUIZ.questions[i];
    openPanel(`<p class="eyebrow">${esc(L(BONUS_QUIZ.title))} · ${i + 1}/${total} · ${esc(t('fact'))}</p>${i === 0 ? `<p>${esc(t('bonusIntro'))}</p>` : ''}<p class="q">${esc(L(q.q))}</p><div class="opts">${L(q.o).map((o, k) => `<button data-opt="${k}">${esc(o)}</button>`).join('')}</div><div id="qfb" class="qfb" hidden></div><button class="primary" id="bq-next" hidden>${esc(t('next'))} →</button>`, 'quiz');
    $('panel-card').querySelectorAll('[data-opt]').forEach(btn => btn.onclick = () => {
      if (btn.disabled) return;
      const ok = +btn.dataset.opt === q.a; if (ok) correct++;
      sfx(ok ? 'quiz_ok' : 'quiz_bad');
      $('panel-card').querySelectorAll('[data-opt]').forEach(b => { b.disabled = true; if (+b.dataset.opt === q.a) b.classList.add('right'); });
      if (!ok) btn.classList.add('wrong');
      const fb = $('qfb'); fb.hidden = false; fb.className = 'qfb ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = `<b>${ok ? '✓ ' + esc(t('quizRight')) : '✗'}</b> ${esc(L(q.e))}`;
      const nb = $('bq-next'); nb.hidden = false; nb.focus();
      nb.onclick = () => { i++; if (i < total) show(); else done(); };
    });
  };
  const done = () => {
    if (!G.flags.bonus) { G.flags.bonus = {correct, t: Date.now(), by: party.slot}; changed(); }
    const best = G.flags.bonus.correct;
    openPanel(`<p class="eyebrow">${esc(L(BONUS_QUIZ.title))}</p><h2>${esc(t('bonusDone'))}</h2><p class="big">${correct} / ${total} ${esc(t('correct'))}</p><p>${esc(t('bonus'))}: +${best * 50} ${esc(t('points'))}</p><p class="src">${esc(t('source'))}: ${esc(BONUS_QUIZ.source)}</p><div class="row"><button id="bq-again">${esc(t('replay'))}</button><button class="primary" data-close>${esc(t('close'))}</button></div>`, 'quiz');
    $('bq-again').onclick = () => { i = 0; correct = 0; show(); };
    autosave();
  };
  show();
  return panelDone();
}
function inventory() {
  const rows = [];
  for (let item = 1; item <= 14; item++) {
    const n = E.tj_item_count(item); if (n <= 0) continue;
    const type = E.tj_item_info(item, 0), [name, desc] = ITEMS[lang][item];
    const sel = type === 0 && E.tj_state(13) === item - 1;
    const act = type === 0 ? `<button data-use="${item}" ${sel ? 'disabled' : ''}>${esc(sel ? t('equipped') : t('equip'))}</button>`
      : type === 2 ? `<button data-use="${item}" ${E.tj_state(8) >= 100 ? 'disabled' : ''}>${esc(t('use'))}</button>`
      : item === IT.arrows && party.size > 1 ? `<button data-give="1">${esc(t('give'))}</button>` : '';
    rows.push(`<article class="inv">${iconHTML(ITEM_ICONS[item])}<div><b>${esc(name)} <span>× ${n}</span></b><p>${esc(desc)}</p></div>${act}</article>`);
  }
  openPanel(`<p class="eyebrow">${esc(t('journal'))}</p><h2>${esc(t('inventory'))}</h2><small>${esc(t('invHint'))}</small><div class="inv-list">${rows.join('')}</div><button class="primary" data-close>${esc(t('close'))}</button>`, 'inventory');
  $('panel-card').querySelectorAll('[data-use]').forEach(b => b.onclick = () => { if (E.tj_use(+b.dataset.use)) sfx('pickup'); updateHud(true); inventory(); });
  $('panel-card').querySelectorAll('[data-give]').forEach(b => b.onclick = () => { giveArrows(); inventory(); });
}
function help() {
  openPanel(`<p class="eyebrow">${esc(t('chapter'))}</p><h2>${esc(t('helpTitle'))}</h2><p>${esc(t('help'))}</p><p class="fiction"><b>${esc(t('fiction'))}:</b> ${lang === 'ru' ? 'персонажи и события уровня вымышлены; исторические факты отмечены отдельно и имеют источники.' : 'деңгейдің кейіпкерлері мен оқиғалары ойдан шығарылған; тарихи деректер бөлек белгіленіп, дереккөзі көрсетілген.'}</p><button class="primary" data-close>${esc(t('resume'))}</button>`);
}
function pauseMenu() {
  openPanel(`<h2>${esc(t('pause'))}</h2><div class="col"><button class="primary" data-close>${esc(t('resume'))}</button><button id="pm-save">${esc(t('save'))}</button><button id="pm-load">${esc(t('load'))}</button><button id="pm-help">${esc(t('helpTitle'))}</button></div>`);
  $('pm-save').onclick = () => { closePanel(); save(); };
  $('pm-load').onclick = () => { closePanel(); load(); };
  $('pm-help').onclick = help;
}
function roadmap() {
  openPanel(`<p class="eyebrow">TARIKH JOLY</p><h2>${lang === 'ru' ? 'Карта эпох' : 'Дәуірлер картасы'}</h2><div class="epochs">${ALL_EPOCHS.map(e => `<article class="${e.id === 1 ? 'on' : ''}"><small>MAP ${String(e.id).padStart(2, '0')} · ${esc(e.badge)}</small><b>${esc(e.title)}</b><span>${esc(e.period)}</span>${e.id > 1 ? `<em>${esc(t('mapLocked'))}</em>` : ''}</article>`).join('')}</div><button class="primary" data-close>${esc(t('close'))}</button>`, 'wide');
}
function resultsHTML() {
  const f = G.flags, solved = MAIN_QUIZ_ORDER.filter(n => f.quiz[HISTORICAL_QUIZZES[n].id]).length;
  const secs = Math.max(0, Math.round(((f.tEnd || Date.now()) - f.t0) / 1000));
  return `<div class="results">
    <span><small>${esc(t('score'))}</small><b>${scoreOf(f)}</b></span>
    <span><small>${esc(t('quizzes'))}</small><b>${solved} / 5</b></span>
    <span><small>${esc(t('bonus'))}</small><b>${f.bonus ? f.bonus.correct + ' / 5' : '—'}</b></span>
    <span><small>${esc(t('secrets'))}</small><b>${secretsFound(f)} / ${SECRETS.length}</b></span>
    <span><small>${esc(t('enemies'))}</small><b>${E.tj_state(32)}</b></span>
    <span><small>${esc(t('time'))}</small><b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b></span>
  </div>`;
}
function complete() {
  try { // Local history of completed runs (one entry per journey).
    const hist = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
    if (!hist.find(h => h.t0 === G.flags.t0)) {
      hist.push({map: 1, t0: G.flags.t0, at: new Date().toISOString(), score: scoreOf(G.flags), secrets: secretsFound(G.flags), bonus: G.flags.bonus?.correct ?? null, party: party.size});
      localStorage.setItem(RESULTS_KEY, JSON.stringify(hist.slice(-20)));
    }
  } catch {}
  save(true);
  music('camp');
  openPanel(`<p class="eyebrow">${esc(t('complete'))}</p><h2>${esc(t('completeSub'))}</h2>${resultsHTML()}<div class="row"><button class="primary" id="go-camp">${esc(t('toCamp'))}</button><button data-close>${esc(t('stay'))}</button></div>`, 'complete');
  $('go-camp').onclick = () => { closePanel(); quest.interact('homegate'); };
  return panelDone();
}
function results() {
  openPanel(`<p class="eyebrow">${esc(t('results'))}</p><h2>${esc(t('completeSub'))}</h2>${resultsHTML()}<div class="row"><button id="back-stone">${esc(t('returnStone'))}</button><button class="primary" data-close>${esc(t('close'))}</button></div>`, 'complete');
  $('back-stone').onclick = () => { closePanel(); travel(30 * TS, 43.2 * TS); };
  return panelDone();
}
function gameOver() {
  openPanel(`<h2>${esc(t('gameOver'))}</h2><p>${esc(t('gameOverText'))}</p><div class="col"><button class="primary" id="go-load">${esc(t('continueSave'))}</button><button id="go-new">${esc(t('restart'))}</button></div>`);
  $('go-load').onclick = () => { closePanel(); if (!load()) newGame(); };
  $('go-new').onclick = () => { closePanel(); newGame(); };
}

// ---------------------------------------------------------------- co-op
function coopPanel() {
  const n = party.net;
  const members = n ? party.members.map(m => `<li><span class="dot s${m.slot}"></span>${esc(SPEAKERS[HEROES[m.slot]][lang])}${m.self ? ' ★' : ''}${m.slot === 0 ? ' · ' + esc(t('host')) : ''}</li>`).join('') : '';
  openPanel(`<p class="eyebrow">${esc(t('party'))} · ${party.size}/${MAX_PARTY}</p><h2>${esc(t('coop'))}</h2><p>${esc(t('coopNote'))}</p>
    ${n ? `<p class="code">${esc(t('partyCode'))}: <b id="cp-code-val">${esc(n.code)}</b></p><ul class="members">${members}</ul><p class="note">${esc(n.transport === 'supabase' ? t('coopNet') : t('coopLocal'))}</p><button id="cp-leave">${esc(t('leave'))}</button>`
      : `<div class="row"><button class="primary" id="cp-create">${esc(t('create'))}</button></div><div class="row"><input id="cp-code" maxlength="6" placeholder="ABC123" autocomplete="off"><button id="cp-join">${esc(t('join'))}</button></div><p class="note">${esc(t('coopLocal'))}</p>`}
    <button data-close>${esc(t('close'))}</button>`, '', false);
  $('cp-create')?.addEventListener('click', () => { startParty(makeCode()); setTimeout(coopPanel, 300); });
  $('cp-join')?.addEventListener('click', () => { const c = $('cp-code').value.trim().toUpperCase(); if (/^[A-Z0-9]{6}$/.test(c)) { startParty(c); setTimeout(coopPanel, 600); } });
  $('cp-leave')?.addEventListener('click', () => { leaveParty(); coopPanel(); });
}
function startParty(code) {
  leaveParty();
  party.net = createParty(code, {
    name: 'chronicler',
    onMessage: onNet,
    onMembers: (list, mySlot) => {
      const known = new Set(party.members.map(m => m.id));
      party.members = list; party.slot = mySlot; party.size = list.length; party.host = mySlot === 0;
      const others = list.filter(m => !m.self);
      for (const [id, p] of party.peers) if (!others.find(o => o.id === id)) { E.tj_peer_off(p.eslot); party.peers.delete(id); toast(t('left')); }
      others.forEach((m, i) => {
        const p = party.peers.get(m.id) || {};
        if (p.eslot && p.eslot !== i + 1) E.tj_peer_off(p.eslot);
        party.peers.set(m.id, {...p, eslot: i + 1, slot: m.slot});
        if (!known.has(m.id) && known.size) toast(`${SPEAKERS[HEROES[m.slot]][lang]} ${t('joined')}`);
      });
      E.tj_hero(SH[HEROES[mySlot]] ?? 0);
      E.tj_party(party.size, party.host ? 0 : 1);
      party.net?.send('fl', {flags: G.flags});
      applyWorld(G); updateHud(true);
    },
    onRefused: () => { toast(t('full'), 'warn'); party.net = null; resetSolo(); },
  });
  history.replaceState(null, '', '?party=' + code);
}
function resetSolo() {
  for (const p of party.peers.values()) E.tj_peer_off(p.eslot);
  party.peers.clear(); party.members = []; party.size = 1; party.slot = 0; party.host = true;
  E.tj_party(1, 0); E.tj_hero(SH.aibar); applyWorld(G); updateHud(true);
}
function leaveParty() {
  if (!party.net) return;
  party.net.leave(); party.net = null;
  resetSolo();
  history.replaceState(null, '', location.pathname);
}
function peerByMemberSlot(slot) { for (const p of party.peers.values()) if (p.slot === slot) return p; return null; }
function memberSlotOfEngine(eslot) { for (const p of party.peers.values()) if (p.eslot === eslot) return p.slot; return -1; }
function onNet(m) {
  const peer = party.peers.get(m.from);
  switch (m.type) {
    case 'st': if (peer) { Object.assign(peer, {last: performance.now(), x: m.x, y: m.y, hp: m.hp, down: !!(m.fl & 1)}); E.tj_peer(peer.eslot, m.x, m.y, m.f, m.a, m.fr, m.hp, m.fl, SH[HEROES[peer.slot]] ?? 0); } break;
    case 'en': if (!party.host && Array.isArray(m.e)) m.e.forEach((e, i) => Array.isArray(e) && E.tj_enemy_set(i, ...e)); break;
    case 'hit': if (party.host && peer) E.tj_enemy_damage(m.i | 0, Math.min(60, m.d | 0), peer.eslot); break;
    case 'dmg': if (m.to === party.slot) E.tj_damage(Math.min(60, m.d | 0)); break;
    case 'rev': if (m.to === party.slot) E.tj_revive(40); break;
    case 'give': if (m.to === party.slot && m.item === IT.arrows) { E.tj_item_add(IT.arrows, Math.min(10, m.n | 0)); toast(t('received')); sfx('pickup'); } break;
    case 'fl': if (m.flags) { const before = JSON.stringify(G.flags); try { G.flags = mergeFlags(G.flags, m.flags); } catch {} if (JSON.stringify(G.flags) !== before) { applyWorld(G); updateHud(true); } } break;
    case 'cut': quest.mirror(m.id); break;
  }
}
function netTick(now) {
  const n = party.net; if (!n || party.size < 2) return;
  if (now - party.lastState > 70) {
    party.lastState = now;
    const fl = (E.tj_state(24) ? 1 : 0) | (E.tj_state(15) ? 2 : 0) | (E.tj_state(34) ? 4 : 0);
    n.send('st', {x: Math.round(E.tj_state(0) / 1000), y: Math.round(E.tj_state(1) / 1000), f: E.tj_state(3), a: E.tj_state(22), fr: E.tj_state(23), hp: E.tj_state(8), fl});
  }
  if (party.host && now - party.lastEnemies > 110) {
    party.lastEnemies = now;
    const list = [];
    for (let i = 0; i < E.tj_enemy_count(); i++) list.push([E.tj_enemy(i, 2) / 1000 | 0, E.tj_enemy(i, 3) / 1000 | 0, E.tj_enemy(i, 0), E.tj_enemy(i, 1), E.tj_enemy(i, 7), E.tj_enemy(i, 8), E.tj_enemy(i, 9), E.tj_enemy(i, 10)]);
    n.send('en', {e: list});
  }
  if (flagsDirty || now - party.lastFlags > 2000) { party.lastFlags = now; flagsDirty = false; n.send('fl', {flags: G.flags}); }
  for (const p of party.peers.values()) if (p.last && now - p.last > 6000) { E.tj_peer_off(p.eslot); p.last = 0; }
}
// Background tabs get no animation frames: keep presence/state flowing on a slow timer.
setInterval(() => { if (document.hidden && E) { handleEvents(); netTick(performance.now()); } }, 250);
function giveArrows() {
  const [x, y] = heroPos();
  let best = null, bd = 48;
  for (const p of party.peers.values()) if (p.last) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
  if (!best || E.tj_item_count(IT.arrows) < 5) { toast(t('nobody')); return; }
  E.tj_item_add(IT.arrows, -5); party.net.send('give', {to: best.slot, item: IT.arrows, n: 5}); toast(t('gave'));
}

// ---------------------------------------------------------------- persistence
function save(silent) {
  if (!E) return false;
  const bytes = E.tj_save();
  if (bytes <= 0) { if (!silent) toast(t('saveBlocked'), 'warn'); return false; }
  const words = Array.from(new Uint32Array(E.memory.buffer, E.tj_save_buffer(), bytes / 4));
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({v: 3, words, flags: G.flags, local: G.local, savedAt: new Date().toISOString()}));
    lastSave = performance.now();
    if (!silent) toast(t('saved'));
    return true;
  } catch { if (!silent) toast(t('storageFail'), 'warn'); return false; }
}
function autosave() { if (!cine) save(true); }
function load(silent) {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch {}
  if (!raw) { if (!silent) toast(t('noSave')); return false; }
  try {
    const data = restoreSnapshot(E, raw);
    G.flags = mergeFlags(newFlags(), data.flags);
    G.flags.t0 = data.flags.t0 || Date.now();
    G.local = data.local;
    G.armed = null; G.forceNpc = true;
    E.tj_party(party.size, party.host ? 0 : 1); E.tj_hero(SH[HEROES[party.slot]] ?? 0);
    applyWorld(G); updateHud(true); lastZone = -1;
    if (!silent) toast(t('loaded'));
    return true;
  } catch (e) {
    if (!silent || e.old) toast(e.old ? t('oldSave') : t('saveFail'), 'warn');
    return false;
  }
}
function newGame() {
  E.tj_init();
  G.flags = newFlags(); G.local = {granted: [], attempts: {}, seen: [], crystal: 0}; G.armed = null; G.forceNpc = true;
  E.tj_party(party.size, party.host ? 0 : 1); E.tj_hero(SH[HEROES[party.slot]] ?? 0);
  applyWorld(G); lastZone = -1; updateHud(true);
  if (party.slot === 0) { $('fade').style.transition = 'none'; $('fade').style.opacity = 1; setTimeout(() => quest.interact('page1'), 200); }
  else $('fade').style.opacity = 0;
}
function changed() { flagsDirty = true; updateHud(true); }
async function travel(x, y) {
  const f = $('fade');
  f.style.transition = 'opacity 380ms'; f.style.opacity = 1;
  await sleep(400);
  E.tj_teleport(Math.round(x), Math.round(y));
  applyWorld(G);
  await sleep(120);
  f.style.opacity = 0;
  autosave();
}

// ---------------------------------------------------------------- HUD
function updateHud(force) {
  if (!E) return;
  const hp = E.tj_state(8), lives = E.tj_state(9), weapon = E.tj_state(13), arrows = E.tj_state(14), zone = E.tj_state(2);
  const stage = questStage(G.flags), q = QUESTS[stage][lang];
  const allies = party.size > 1 ? [...party.peers.values()].map(p => `${p.slot}:${p.hp}:${p.down}`).join(',') : '';
  const key = [hp, lives, weapon, arrows, zone, stage, lang, scoreOf(G.flags), party.size, E.tj_item_count(2), E.tj_item_count(3), secretsFound(G.flags), allies, isAudioMuted()].join('|');
  if (key === hudKey && !force) return;
  hudKey = key;
  $('hp-fill').style.width = Math.max(0, hp) + '%';
  $('hp-fill').classList.toggle('low', hp < 30);
  $('hp-text').textContent = hp + ' / 100';
  $('lives').textContent = '◆'.repeat(Math.max(0, lives)) + '◇'.repeat(Math.max(0, 3 - lives));
  $('arrows').textContent = arrows;
  $('ammo-icon').innerHTML = iconHTML('arrows');
  $('slots').innerHTML = ['sword', 'spear', 'bow'].map((n, i) => {
    const has = E.tj_item_count(i + 1) > 0;
    return `<button data-weapon="${i}" class="${weapon === i ? 'on' : ''}" ${has ? '' : 'disabled'} title="${esc(t('weapon')[i])}"><kbd>${i + 1}</kbd>${iconHTML(n)}</button>`;
  }).join('');
  $('slots').querySelectorAll('[data-weapon]').forEach(b => b.onclick = () => equip(+b.dataset.weapon));
  $('zone-name').textContent = ZONE_NAMES[lang][zone] || '';
  $('obj-title').textContent = q[0]; $('obj-detail').textContent = q[1];
  $('s-score').textContent = `${t('score')} ${scoreOf(G.flags)}`;
  $('s-secrets').textContent = `${t('secrets')} ${secretsFound(G.flags)}/${SECRETS.length}`;
  $('s-quiz').textContent = `${lang === 'ru' ? 'Квизы' : 'Квиз'} ${MAIN_QUIZ_ORDER.filter(n => G.flags.quiz[HISTORICAL_QUIZZES[n].id]).length}/5`;
  $('b-inv').innerHTML = `<kbd>I</kbd> ${esc(t('inventory'))}`; $('b-save').textContent = '💾 ' + t('save'); $('b-load').textContent = '📂 ' + t('load');
  $('b-help').textContent = '?'; $('b-help').title = t('helpTitle'); $('b-road').textContent = '🗺 ' + (lang === 'ru' ? 'Эпохи' : 'Дәуірлер');
  $('lang-btn').textContent = t('lang'); $('audio-btn').textContent = isAudioMuted() ? '🔇' : '🔊'; $('audio-btn').title = t('mute');
  $('coop-btn').textContent = `👥${party.size > 1 ? ' ' + party.size + '/3' : ''}`; $('coop-btn').title = t('coop');
  $('allies').innerHTML = party.size > 1 ? party.members.filter(m => !m.self).map(m => {
    const p = peerByMemberSlot(m.slot), php = p?.hp ?? 100;
    return `<div class="ally s${m.slot}"><span>${esc(SPEAKERS[HEROES[m.slot]][lang])}${p?.down ? ' ✚' : ''}</span><i style="width:${Math.max(0, php)}%"></i></div>`;
  }).join('') : '';
}
function equip(w) {
  if (!E || panelOpen || cine) return;
  if (E.tj_equip(w)) sfx('dialog');
  updateHud(true); canvas.focus({preventScroll: true});
}
function updatePrompt() {
  const kind = E.tj_state(25), id = E.tj_state(26), el = $('prompt');
  if (kind < 0 || cine || dialogBusy || panelOpen) { el.hidden = true; return; }
  let text = '';
  if (kind === 0) { const key = MAP01.interacts[id]; text = `${NAMES[lang][key] || key} · ${VERB[lang][INTERACT_LABEL[key] || 'examine']}`; }
  else if (kind === 1) text = `${L(SPEAKERS[MAP01.npcs[id]])} · ${VERB[lang].talk}`;
  else if (kind === 2) text = VERB[lang].revive;
  const html = `<kbd>E</kbd> ${esc(text)}`;
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = false;
}
let bannerTimer = 0;
function banner(text) {
  const b = $('banner'); b.textContent = text; b.classList.add('on');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('on'), 2600);
}
const TILE_RGB = ['3d6a3b', '7a7d44', '77593b', 'b49c68', '1d5a76', '4aa0a8', '5e504a', '2f383a', '120a18', '7c6b60'].map(h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)));
function buildMinimap(areaIdx) {
  const a = Object.values(MAP01.areas)[areaIdx];
  const w = a[2] - a[0], h = a[3] - a[1];
  mini.width = w; mini.height = h;
  const img = mctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = TILE_RGB[E.tj_tile(a[0] + x, a[1] + y)] || [0, 0, 0], i = (y * w + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
  miniBase = img; minimapArea = areaIdx;
}
function drawMinimap(now) {
  const area = E.tj_state(35);
  if (area !== minimapArea) buildMinimap(area);
  const a = Object.values(MAP01.areas)[area];
  mctx.putImageData(miniBase, 0, 0);
  const dot = (px, py, col, r = 1) => { mctx.fillStyle = col; mctx.fillRect(Math.round(px / TS - a[0]) - r, Math.round(py / TS - a[1]) - r, r * 2 + 1, r * 2 + 1); };
  for (let i = 0; i < MAP01.npcs.length; i++) if (E.tj_npc(i, 2)) dot(E.tj_npc(i, 0), E.tj_npc(i, 1), '#e2b45a', 0);
  for (let i = 0; i < E.tj_enemy_count(); i++) if (E.tj_enemy(i, 6) && E.tj_enemy(i, 0) > 0 && E.tj_enemy(i, 12)) dot(E.tj_enemy(i, 2) / 1000, E.tj_enemy(i, 3) / 1000, '#e06a3f', 0);
  const tg = questTarget(G.flags);
  if (tg && (now / 400 | 0) % 2) {
    let p = null;
    if (tg.npc != null && E.tj_npc(tg.npc, 2)) p = [E.tj_npc(tg.npc, 0), E.tj_npc(tg.npc, 1)];
    else if (tg.ia != null) p = MAP01.interactPos[MAP01.interacts[tg.ia]];
    if (p) dot(p[0], p[1], '#fff2c4', 1);
  }
  const colors = ['#86cdbd', '#86a6c8', '#f0b878'];
  for (const p of party.peers.values()) if (p.last) dot(p.x, p.y, colors[p.slot], 1);
  const [x, y] = heroPos();
  dot(x, y, '#ffffff', 1);
}

// ---------------------------------------------------------------- engine events
function handleEvents() {
  const n = E.tj_event_count(), evs = [];
  for (let i = 0; i < n; i++) evs.push([E.tj_event(i, 0), E.tj_event(i, 1), E.tj_event(i, 2)]);
  E.tj_events_clear();
  for (const [type, a, b] of evs) {
    switch (type) {
      case EV.SFX: { const d = b & 0x7fff, left = b >> 15; sfx(SFX_NAMES[a], Math.max(0, 1 - d / 400), (left ? -1 : 1) * Math.min(1, d / 260) * .6); break; }
      case EV.INTERACT: {
        if (cine || dialogBusy || panelOpen) break;
        const hold = (b & 0x10000) !== 0, id = b & 0xffff;
        if (a === 1) quest.talk(MAP01.npcs[id]); else quest.interact(MAP01.interacts[id], hold);
        break;
      }
      case EV.TRIGGER: quest.trigger(MAP01.triggers[a]); break;
      case EV.ENEMY_DIED: quest.enemyDied(a, b); break;
      case EV.PICKUP: toast(`${t('got')}: ${ITEMS[lang][a][0]} ×${b}`); updateHud(true); break;
      case EV.HURT: sfx('hurt'); break;
      case EV.DOWN: toast(t('downed'), 'warn'); break;
      case EV.DEAD: onDeath(); break;
      case EV.REVIVED: toast('✚'); break;
      case EV.ZONE: onZone(a); break;
      case EV.ENEMY_HIT: party.net?.send('hit', {i: a, d: b}); break;
      case EV.PEER_HIT: { const s = memberSlotOfEngine(a); if (s >= 0) party.net?.send('dmg', {to: s, d: b}); break; }
      case EV.REVIVE_PEER: { const s = memberSlotOfEngine(a); if (s >= 0) party.net?.send('rev', {to: s}); break; }
      case EV.PLATES: quest.plates(a); break;
      case EV.ALERT: if (!cine) music('danger'); break;
      case EV.NOAMMO: toast(t('noAmmo'), 'warn'); sfx('noammo'); break;
    }
  }
}
async function onDeath() {
  toast(t('died'), 'warn');
  await sleep(500);
  E.tj_respawn(party.size > 1 ? 0 : 1);
  if (E.tj_state(19)) { gameOver(); return; }
  toast(t('respawn'));
  updateHud(true); musicForZone(true);
}
function onZone(z) {
  if (z === lastZone) return;
  lastZone = z;
  banner(ZONE_NAMES[lang][z]);
  musicForZone();
  applyWorld(G);
  updateHud(true);
  if (performance.now() - lastSave > 4000) autosave();
}
function musicForZone(force) {
  if (cine && !force) return;
  const z = E.tj_state(2);
  music(z === 1 ? 'village' : z === 5 ? 'cave' : z === 6 ? 'camp' : z === 4 ? 'danger' : 'explore');
}
function ambienceTick() {
  const z = E.tj_state(2), [x, y] = heroPos();
  const fire = Math.max(0, 1 - Math.hypot(x - 32 * TS, y - 41 * TS) / 140) + Math.max(0, 1 - Math.hypot(x - 85 * TS, y - 19.5 * TS) / 140);
  let river = 0;
  for (let dx = -6; dx <= 6; dx++) { const tt = E.tj_tile(Math.floor(x / TS) + dx, Math.floor(y / TS)); if (tt === 4 || tt === 5) river = Math.max(river, 1 - Math.abs(dx) / 7); }
  ambience({wind: z === 5 ? 0 : z === 4 ? 1 : .7, fire: Math.min(1, fire), river, cave: z === 5 ? 1 : 0, birds: z <= 3 && !G.flags.b.returned ? 1 : 0});
}

// ---------------------------------------------------------------- loop
let ambTick = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (!E) return;
  const dt = Math.min(Math.max(now - lastTime, 0), 100); lastTime = now;
  const frozen = panelOpen && party.size === 1;
  if (!frozen) { acc += dt; while (acc >= 1000 / 60) { E.tj_tick(); acc -= 1000 / 60; } } else acc = 0;
  handleEvents();
  E.tj_render();
  ctx.putImageData(frame, 0, 0);
  updateHud(); updatePrompt();
  if ((now / 100 | 0) % 2 === 0) drawMinimap(now);
  if ((now / 250 | 0) !== ambTick) { ambTick = now / 250 | 0; ambienceTick(); }
  netTick(now);
  if (now - lastSave > 60000 && !cine && !panelOpen) autosave();
}

// ---------------------------------------------------------------- input wiring
window.addEventListener('keydown', e => {
  unlockAudio();
  if (e.ctrlKey || e.metaKey || e.altKey || !E) return;
  if (document.activeElement?.tagName === 'INPUT') return;
  if (e.code === 'Escape') { e.preventDefault(); if (cine) skipCutscene(); else if (panelOpen) closePanel(); else if (!dialogBusy) pauseMenu(); return; }
  if (!$('dlg').hidden && ['KeyE', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); if (!e.repeat) advanceDialog(); return; }
  if (panelOpen || cine || dialogBusy) return;
  if (e.code === 'KeyI' && !e.repeat) { e.preventDefault(); inventory(); return; }
  if (e.code === 'KeyM' && !e.repeat) { mini.classList.toggle('hidden'); return; }
  if (e.code === 'KeyG' && !e.repeat && party.size > 1) { giveArrows(); return; }
  if (/^Digit[123]$/.test(e.code)) { e.preventDefault(); if (!e.repeat) equip(+e.code.at(-1) - 1); return; }
  if (keyBits[e.code]) { e.preventDefault(); held.add(e.code); input(); }
});
window.addEventListener('keyup', e => { if (keyBits[e.code]) { held.delete(e.code); input(); } });
window.addEventListener('blur', () => { held.clear(); touch.clear(); input(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); input(); if (E && !panelOpen && !cine && !dialogBusy && party.size === 1) pauseMenu(); } });
for (const btn of document.querySelectorAll('[data-key]')) {
  btn.addEventListener('pointerdown', ev => { ev.preventDefault(); unlockAudio(); btn.setPointerCapture(ev.pointerId); if (!$('dlg').hidden) { advanceDialog(); return; } touch.set(ev.pointerId, +btn.dataset.key); input(); });
  for (const n of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(n, ev => { touch.delete(ev.pointerId); input(); });
}
$('dlg').addEventListener('click', () => advanceDialog());
$('skip').onclick = skipCutscene;
$('panel').addEventListener('click', e => { if (e.target.closest('[data-close]')) closePanel(); });
canvas.addEventListener('pointerdown', () => { unlockAudio(); canvas.focus({preventScroll: true}); });
$('b-inv').onclick = () => E && !cine && !dialogBusy && inventory();
$('b-save').onclick = () => save();
$('b-load').onclick = () => !cine && load();
$('b-help').onclick = () => !cine && help();
$('b-road').onclick = () => !cine && roadmap();
$('lang-btn').onclick = () => { lang = lang === 'kk' ? 'ru' : 'kk'; setLang(lang); document.documentElement.lang = lang; updateHud(true); if (E) banner(ZONE_NAMES[lang][E.tj_state(2)]); };
$('audio-btn').onclick = () => { unlockAudio(); toggleAudioMute(); updateHud(true); };
$('coop-btn').onclick = () => E && !cine && !dialogBusy && coopPanel();

function resize() {
  // The game always fills the whole window (letterboxed); the HUD and hotbar live inside the frame.
  const vp = $('viewport');
  const s = Math.max(.5, Math.min(innerWidth / W, innerHeight / H));
  vp.style.width = W * s + 'px'; vp.style.height = H * s + 'px';
  vp.style.setProperty('--s', s);
}
// Browsers allow real fullscreen only after a user gesture: enter it on the first key/click.
let autoFs = true;
function enterFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({navigationUI: 'hide'}).catch(() => {});
}
function firstGesture() { if (autoFs) { autoFs = false; enterFullscreen(); } }
window.addEventListener('pointerdown', firstGesture, {capture: true});
window.addEventListener('keydown', e => { if (e.code !== 'Escape') firstGesture(); }, {capture: true});
$('fs-btn').onclick = () => { autoFs = false; if (document.fullscreenElement) document.exitFullscreen?.(); else enterFullscreen(); };
addEventListener('resize', resize);
new ResizeObserver(resize).observe(document.body);

// ---------------------------------------------------------------- boot
async function boot() {
  $('loading').textContent = t('loading');
  try {
    const [wasm, png] = await Promise.all([
      fetch('/engine/rpg/tarikh-rpg.wasm').then(r => { if (!r.ok) throw new Error('WASM ' + r.status); return r.arrayBuffer(); }),
      fetch('/art/rpg/atlas.png').then(r => { if (!r.ok) throw new Error('atlas ' + r.status); return r.arrayBuffer(); }),
    ]);
    const {instance} = await WebAssembly.instantiate(wasm, {});
    E = G.E = instance.exports;
    E._initialize?.();
    const atlas = await decodePNG(new Uint8Array(png), browserInflate);
    if (atlas.width !== E.tj_atlas_size(0) || atlas.height !== E.tj_atlas_size(1)) throw new Error('atlas size mismatch');
    new Uint8Array(E.memory.buffer, E.tj_atlas(), atlas.data.length).set(atlas.data);
    E.tj_atlas_ready(1);
    atlasCanvas = document.createElement('canvas'); atlasCanvas.width = atlas.width; atlasCanvas.height = atlas.height;
    atlasCanvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(atlas.data.buffer, atlas.data.byteOffset, atlas.data.length), atlas.width, atlas.height), 0, 0);
    document.documentElement.style.setProperty('--atlas', `url(${atlasCanvas.toDataURL()})`);
    document.documentElement.style.setProperty('--atlas-size', `${atlas.width * 2}px ${atlas.height * 2}px`);
    E.tj_init();
    frame = new ImageData(new Uint8ClampedArray(E.memory.buffer, E.tj_pixels(), W * H * 4), W, H);
    Object.assign(G, {
      say, quiz, bonusQuiz, results, complete, travel, toast, changed, heroPos, save: s => save(s),
      cine: (id, fn) => playCutscene(id, fn), sfx, spawnFx: (p, type, n) => E.tj_spawn_fx(type, p[0], p[1], n),
    });
    quest = createQuest(G);
    $('loading').remove();
    resize();
    $('hotbar').addEventListener('pointerdown', e => e.stopPropagation());
    const params = new URLSearchParams(location.search);
    if (params.has('new')) { // Started from the intro comic: a fresh journey into MAP01.
      try { const old = localStorage.getItem(SAVE_KEY); if (old) localStorage.setItem(SAVE_KEY + '.prev', old); localStorage.removeItem(SAVE_KEY); } catch {}
      history.replaceState(null, '', location.pathname + (params.get('party') ? '?party=' + params.get('party') : ''));
      newGame();
    } else if (load(true)) $('fade').style.opacity = 0;
    else newGame();
    if (params.has('coop')) setTimeout(() => !cine && coopPanel(), 400);
    const code = new URLSearchParams(location.search).get('party');
    if (code && /^[A-Z0-9]{6}$/.test(code)) startParty(code);
    canvas.focus({preventScroll: true});
    lastTime = performance.now();
    updateHud(true);
    if (!loopStarted) { loopStarted = true; requestAnimationFrame(loop); }
    musicForZone(true);
    // Debug/QA handle (used by scripts/check-rpg-browser.mjs).
    const step = n => { for (let i = 0; i < n; i++) { E.tj_tick(); handleEvents(); } E.tj_render(); ctx.putImageData(frame, 0, 0); updateHud(); updatePrompt(); drawMinimap(performance.now()); };
    window.__tj = {E, G, party, quest, save, load, newGame, skipCutscene, closePanel, advanceDialog, travel, step, inventory, coopPanel, startParty, leaveParty,
      get panelOpen() { return panelOpen; }, get cine() { return cine?.id || null; }, get dialog() { return !$('dlg').hidden; }};
  } catch (err) {
    console.error(err);
    $('loading').textContent = t('loadFail');
  }
}
boot();

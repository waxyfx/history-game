import './style.css';
import {
  playSword, playSpear, playBow, playHit, playHurt,
  playPickup, playDialog, playQuizCorrect, playQuizWrong,
  playDefeat, toggleAudioMute, isAudioMuted
} from './audio.js';
import { ZONE_NAMES, ZONE_OBJECTIVES, HISTORICAL_QUIZZES, STORY_EVENTS } from './story.js';
import { ALL_EPOCHS } from './campaign.js';

const root = document.querySelector('#rpg-app');
root.innerHTML = `
  <header>
    <a class="brand" href="/"><span class="brand-mark">Т</span><span>TARIKH JOLY<small>ЖОҒАЛҒАН ШЕЖІРЕ</small></span></a>
    <div class="header-actions">
      <button class="audio-toggle" id="audio-toggle" aria-label="Дыбысты қосу/өшіру">🔊 Дыбыс</button>
      <a class="back" href="/">Beta 0.1 ↗</a>
    </div>
  </header>
  <main>
    <div class="chapter">
      <div>
        <p class="eyebrow">MAP 01 / ТАС ДӘУІРІ</p>
        <h1 id="chapter-title">Алғашқы іздер</h1>
      </div>
      <span class="build-label">2D · 16-bit Pixel Art</span>
    </div>
    <div class="game-layout">
      <section class="game-panel" aria-label="Ойын алаңы">
        <div class="zone-bar">
          <span><i></i> <span id="zone">Апат орны</span></span>
          <span id="discovered">01 / 06 АЙМАҚ</span>
        </div>
        <div class="viewport">
          <canvas id="world" width="480" height="320" tabindex="0" aria-label="Ойын картасы. WASD — қозғалу, E — әрекет, Space — шабуыл, 1/2/3 — қару."></canvas>
          <p id="loading" role="status">Уақыт жолы ашылуда…</p>
        </div>
        <div class="game-footer">
          <span><kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd> Қозғалу</span>
          <span><kbd>E</kbd> Әрекет</span>
          <span><kbd>Space</kbd> Шабуыл</span>
          <button id="pause" disabled>Ⅱ Үзіліс</button>
        </div>
      </section>
      <aside>
        <div class="chapter-number">
          <span>01 / 08 ДӘУІР</span>
          <button class="roadmap-link" id="roadmap-btn">Жол картасы</button>
        </div>
        <p class="eyebrow">САЯХАТШЫНЫҢ КҮНДЕЛІГІ</p>
        <h2 id="objective">Апат орнын зертте</h2>
        <p id="objective-detail">Уақыт машинасы істен шықты. Шығысқа қарай соқпақпен жүріп, өзендегі көпірден өт.</p>
        <div class="status-card">
          <span>Денсаулық <b id="health">100 / 100</b></span>
          <div class="health-track"><div id="health-fill"></div></div>
          <span class="lives">Өмір <b id="lives">◆ ◆ ◆</b></span>
          <span class="weapon-status">Қару <b id="weapon">Қылыш</b></span>
          <span>Жебе <b id="arrows">12</b></span>
          <div class="score-badge"><span>Ұпай:</span><b id="score-val">0</b></div>
          <div class="weapon-controls" aria-label="Қаруды таңдау">
            <button data-weapon="0" aria-pressed="true"><kbd>1</kbd> Қылыш</button>
            <button data-weapon="1" aria-pressed="false"><kbd>2</kbd> Найза</button>
            <button data-weapon="2" aria-pressed="false"><kbd>3</kbd> Садақ</button>
          </div>
          <small id="combat-message" role="status" aria-live="polite"></small>
        </div>
        <div class="route">
          <span class="route-dot active"></span><span>Апат орны</span>
          <span class="route-line"></span><span class="route-dot" id="camp-dot"></span><span>Ежелгі қоныс</span>
        </div>
        <div class="aside-buttons">
          <button id="save-btn" title="Прогресті браузерде сақтау">💾 Сақтау</button>
          <button id="load-btn" title="Сақталған прогресті жүктеу">📂 Жүктеу</button>
        </div>
        <button class="secondary" id="inventory-button">I · Қоржын</button>
        <button class="secondary" id="help">Басқару және оқиға</button>
      </aside>
    </div>
    <div class="touch-controls" aria-label="Сенсорлық басқару">
      <div class="dpad">
        <button data-key="1" aria-label="Жоғары">↑</button>
        <button data-key="4" aria-label="Солға">←</button>
        <button data-key="2" aria-label="Төмен">↓</button>
        <button data-key="8" aria-label="Оңға">→</button>
      </div>
      <button data-key="16">E · Әрекет</button>
      <button data-key="32">⚔ Шабуыл</button>
    </div>
    <footer>
      <span>ЖОЛДЫ ЗЕРТТЕ. ӨТКЕНДІ ТАНЫ.</span>
      <span>C++ / WebAssembly · Fixed camera · 8 Epochs</span>
    </footer>
  </main>

  <dialog id="dialog" aria-labelledby="dialog-title">
    <p class="eyebrow" id="dialog-label"></p>
    <h2 id="dialog-title"></h2>
    <p id="dialog-text"></p>
    <div id="quiz-box" hidden>
      <h3 id="quiz-question" style="font-size:16px;margin:0 0 10px;color:#f3eedc"></h3>
      <div id="quiz-options"></div>
      <div id="quiz-feedback" hidden></div>
    </div>
    <div id="inventory-list" hidden></div>
    <p id="inventory-message" role="status" hidden></p>
    <button id="dialog-close">Жалғастыру →</button>
  </dialog>

  <dialog id="epochs-dialog" aria-labelledby="epochs-title">
    <p class="eyebrow">ТАРИХ ЖОЛЫ — КАМПАНИЯ</p>
    <h2 id="epochs-title">Сегіз тарихи дәуір</h2>
    <p>Әр дәуірдің өз картасы, тарихи оқиғалары және антагонист бұрмалаулары бар.</p>
    <div class="epochs-grid" id="epochs-grid"></div>
    <button id="epochs-close" style="margin-top:20px">Жабу ✕</button>
  </dialog>
`;

const $ = id => document.getElementById(id);
const canvas = $('world'), ctx = canvas.getContext('2d', { alpha: false });
const dialog = $('dialog'), epochsDialog = $('epochs-dialog');

let engine, frame, paused = false, last = 0, acc = 0, openedEvent = 0;
let lastZone = -1, lastVisited = -1, lastHud = '', lastHealth = 100, inventoryOpen = false;
let totalScore = 0;
const quizAttempts = new Map();
const solvedQuizzes = new Set();

const held = new Set(), touch = new Map();
const keyBits = { KeyW: 1, ArrowUp: 1, KeyS: 2, ArrowDown: 2, KeyA: 4, ArrowLeft: 4, KeyD: 8, ArrowRight: 8, KeyE: 16, Space: 32 };
const weaponNames = ['Қылыш', 'Найза', 'Садақ'];
const itemTypes = ['Қару', 'Оқ-дәрі', 'Көмек заты', 'Тарихи зат', 'Сюжеттік кілт', 'Артефакт'];
const decoder = new TextDecoder();

function sendInput() {
  if (engine) engine.tj_input(paused ? 0 : [...[...held].map(code => keyBits[code]), ...touch.values()].reduce((mask, key) => mask | key, 0));
}

function clearInput() {
  held.clear();
  touch.clear();
  sendInput();
}

function combatMessage(text) {
  $('combat-message').textContent = text;
  clearTimeout(combatMessage.timer);
  combatMessage.timer = setTimeout(() => { $('combat-message').textContent = ''; }, 2400);
}

function equipWeapon(weapon) {
  if (!engine || paused) return;
  if (!engine.tj_equip(weapon)) {
    combatMessage('Соққы аяқталғанша күте тұр.');
  } else {
    playDialog();
  }
  canvas.focus({ preventScroll: true });
}

for (const button of document.querySelectorAll('[data-weapon]')) {
  button.onclick = () => equipWeapon(Number(button.dataset.weapon));
}

$('audio-toggle').onclick = () => {
  const isMuted = toggleAudioMute();
  $('audio-toggle').textContent = isMuted ? '🔇 Дыбыссыз' : '🔊 Дыбыс';
};

function updateHud() {
  const health = engine.tj_state(8), lives = engine.tj_state(9), weapon = engine.tj_state(13), arrows = engine.tj_state(14);
  const state = [health, lives, weapon, arrows, totalScore].join(':');
  if (health < lastHealth && health > 0) {
    playHurt();
    combatMessage(`⚠ Жарақат алдың: -${lastHealth - health} HP!`);
  }
  lastHealth = health;
  if (state === lastHud) return;
  lastHud = state;

  $('health').textContent = health + ' / 100';
  $('health-fill').style.width = Math.max(0, health) + '%';
  $('lives').textContent = lives ? '◆ '.repeat(lives).trim() : '0';
  $('weapon').textContent = weaponNames[weapon];
  $('arrows').textContent = arrows;
  $('score-val').textContent = totalScore;
  for (const button of document.querySelectorAll('[data-weapon]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.weapon) === weapon));
  }
}

function defeated() {
  return engine?.tj_state(19) === 1;
}

function itemText(item, field) {
  const ptr = engine.tj_item_text(item, field), memory = new Uint8Array(engine.memory.buffer);
  if (!ptr || ptr >= memory.length) return '';
  let end = ptr;
  while (end < memory.length && end < ptr + 1024 && memory[end]) end++;
  return decoder.decode(memory.subarray(ptr, end));
}

function renderInventory() {
  $('inventory-list').replaceChildren();
  for (let item = 1; item <= 8; item++) {
    const count = engine.tj_item_count(item);
    if (count <= 0) continue;
    const type = engine.tj_item_info(item, 0), row = document.createElement('article');
    row.className = 'inventory-item';
    row.dataset.itemId = itemText(item, 0);
    const heading = document.createElement('div');
    heading.className = 'inventory-heading';
    const name = document.createElement('strong');
    name.textContent = itemText(item, 1);
    const quantity = document.createElement('span');
    quantity.textContent = '× ' + count;
    heading.append(name, quantity);
    const kind = document.createElement('small');
    kind.textContent = itemTypes[type];
    const description = document.createElement('p');
    description.textContent = itemText(item, 2);
    row.append(kind, heading, description);

    if (type === 0 || type === 2) {
      const selected = type === 0 && engine.tj_state(13) === item - 1;
      const action = document.createElement('button');
      action.textContent = selected ? 'Таңдалған' : type === 0 ? 'Жабдықтау' : 'Қолдану';
      action.disabled = selected || (type === 2 && engine.tj_state(8) >= 100);
      action.onclick = () => {
        const ok = engine.tj_use(item);
        if (ok) {
          if (type === 0) playSword();
          else playPickup();
          $('inventory-message').textContent = type === 0 ? 'Қару ауыстырылды.' : 'Денсаулық қалпына келтірілді (+35 HP).';
        } else {
          $('inventory-message').textContent = 'Қазір қолдану мүмкін емес.';
        }
        renderInventory();
        updateHud();
        $('dialog-close').focus();
      };
      row.append(action);
    }
    $('inventory-list').append(row);
  }
}

function openInventory() {
  if (!engine || dialog.open || defeated() || engine.tj_state(18) > 0) return;
  showDialog('САЯХАТШЫ ЖАБДЫҒЫ', 'Қоржын', 'Табылған заттар мен жабдық. Қоржын ашық кезде ойын тоқтайды.');
  inventoryOpen = true;
  dialog.classList.add('inventory');
  $('inventory-list').hidden = false;
  $('inventory-message').hidden = false;
  $('inventory-message').textContent = '';
  renderInventory();
}

$('inventory-button').onclick = openInventory;

// Persistence (localStorage)
function saveGame() {
  if (!engine || engine.tj_state(18) > 0 || engine.tj_state(5) > 0) {
    combatMessage('Қазір ойынды сақтауға болмайды.');
    return;
  }
  const bytes = engine.tj_save();
  if (bytes <= 0) {
    combatMessage('Шабуыл немесе қозғалыс кезінде сақтау мүмкін емес.');
    return;
  }
  const words = Array.from(new Uint32Array(engine.memory.buffer, engine.tj_save_buffer(), bytes / 4));
  const payload = {
    words,
    score: totalScore,
    solved: Array.from(solvedQuizzes),
    attempts: Array.from(quizAttempts.entries()),
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('tarikh_rpg_save_v2', JSON.stringify(payload));
  combatMessage('💾 Ойын сәтті сақталды!');
}

function loadGame() {
  if (!engine) return;
  const raw = localStorage.getItem('tarikh_rpg_save_v2');
  if (!raw) {
    combatMessage('Сақталған ойын табылмады.');
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.words) || data.words.length < 31) throw new Error('Invalid format');
    new Uint32Array(engine.memory.buffer, engine.tj_save_buffer(), data.words.length).set(data.words);
    const res = engine.tj_load(data.words.length * 4);
    if (res < 1) throw new Error('C++ restore failed: ' + res);
    totalScore = Number(data.score) || 0;
    solvedQuizzes.clear();
    (data.solved || []).forEach(id => solvedQuizzes.add(id));
    quizAttempts.clear();
    (data.attempts || []).forEach(([k, v]) => quizAttempts.set(k, v));
    lastZone = -1;
    lastVisited = -1;
    lastHud = '';
    updateHud();
    combatMessage('📂 Сақталған прогресс жүктелді!');
    playPickup();
  } catch (err) {
    console.error(err);
    combatMessage('Сақтау файлын жүктеу сәтсіз аяқталды.');
  }
}

$('save-btn').onclick = saveGame;
$('load-btn').onclick = loadGame;

function showDialog(label, title, text, isDefeat = false) {
  if (defeated() && !isDefeat) return;
  paused = true;
  clearInput();
  engine?.tj_pause(1);
  $('dialog-label').textContent = label;
  $('dialog-title').textContent = title;
  $('dialog-text').textContent = text;
  $('dialog-close').textContent = isDefeat ? 'Қайта бастау' : 'Жалғастыру →';
  $('dialog-close').hidden = false;
  $('quiz-box').hidden = true;
  inventoryOpen = false;
  dialog.classList.remove('inventory');
  $('inventory-list').hidden = true;
  $('inventory-message').hidden = true;
  dialog.classList.toggle('defeat', isDefeat);
  if (!dialog.open) dialog.showModal();
  $('dialog-close').focus();
  if (isDefeat) playDefeat();
  else playDialog();
}

function showQuiz(quizIndex) {
  const q = HISTORICAL_QUIZZES[quizIndex];
  if (!q) return;
  paused = true;
  clearInput();
  engine?.tj_pause(1);
  inventoryOpen = false;
  dialog.classList.remove('inventory');
  $('inventory-list').hidden = true;
  $('inventory-message').hidden = true;

  $('dialog-label').textContent = q.questTitle;
  $('dialog-title').textContent = q.title;
  $('dialog-text').textContent = solvedQuizzes.has(q.id)
    ? `Бұл тарихи тапсырма бұрын орындалған. Түсіндірме: ${q.explanation}`
    : 'Сұраққа мұқият жауап беріп, шежірені қалпына келтіріңіз:';

  const box = $('quiz-box');
  const questionEl = $('quiz-question');
  const optionsEl = $('quiz-options');
  const feedbackEl = $('quiz-feedback');

  if (solvedQuizzes.has(q.id)) {
    box.hidden = true;
    $('dialog-close').textContent = 'Жалғастыру →';
    $('dialog-close').hidden = false;
    if (!dialog.open) dialog.showModal();
    $('dialog-close').focus();
    return;
  }

  box.hidden = false;
  questionEl.textContent = q.question;
  optionsEl.replaceChildren();
  feedbackEl.hidden = true;
  feedbackEl.className = '';
  $('dialog-close').hidden = true;

  const curAttempts = quizAttempts.get(q.id) || 0;

  q.options.forEach((optText, optIdx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-opt-btn';
    btn.textContent = optText;
    btn.onclick = () => {
      const attempts = (quizAttempts.get(q.id) || 0) + 1;
      quizAttempts.set(q.id, attempts);

      if (optIdx === q.correctIndex) {
        // Correct answer!
        const pts = attempts === 1 ? 100 : attempts === 2 ? 60 : 30;
        totalScore += pts;
        solvedQuizzes.add(q.id);
        playQuizCorrect();
        feedbackEl.className = 'correct';
        feedbackEl.innerHTML = `<strong>✓ Дұрыс жауап! (+${pts} ұпай)</strong><br>${q.explanation}`;
        feedbackEl.hidden = false;
        optionsEl.querySelectorAll('button').forEach(b => b.disabled = true);
        $('dialog-close').hidden = false;
        $('dialog-close').textContent = 'Жалғастыру →';
        $('dialog-close').focus();
        updateHud();
        saveGame();
      } else {
        // Wrong answer!
        playQuizWrong();
        feedbackEl.className = 'wrong';
        feedbackEl.innerHTML = `<strong>✗ Қате жауап! (${attempts}-әрекет)</strong><br>Тарихи дерек бұрмаланды. Кеңес: ${q.hint}<br><em>Баламалы деректі зерттеп, қайта көріңіз.</em>`;
        feedbackEl.hidden = false;
      }
    };
    optionsEl.append(btn);
  });

  if (!dialog.open) dialog.showModal();
}

function closeDialog() {
  if (defeated()) return;
  dialog.close();
  inventoryOpen = false;
  if (openedEvent) {
    engine?.tj_ack();
    openedEvent = 0;
  }
  paused = false;
  engine?.tj_pause(0);
  clearInput();
  last = performance.now();
  acc = 0;
  canvas.focus({ preventScroll: true });
}

$('dialog-close').onclick = () => {
  if (defeated()) {
    engine.tj_init();
    openedEvent = 0;
    lastZone = -1;
    lastVisited = -1;
    lastHud = '';
    clearTimeout(combatMessage.timer);
    $('combat-message').textContent = '';
  }
  closeDialog();
};

dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeDialog();
});

// Roadmap Dialog
$('roadmap-btn').onclick = () => {
  const grid = $('epochs-grid');
  grid.replaceChildren();
  ALL_EPOCHS.forEach(ep => {
    const card = document.createElement('article');
    card.className = 'epoch-card' + (ep.id === 1 ? ' active' : '');
    card.innerHTML = `
      <span class="epoch-badge">${ep.badge}</span>
      <h3>MAP 0${ep.id}: ${ep.title}</h3>
      <small>${ep.subtitle} · ${ep.period}</small>
      <p>${ep.description}</p>
      <small style="color:#d5c28f">${ep.id === 1 ? 'Қазір ойналуда' : 'Құлыпталған (MAP 01 аяқталған соң)'}</small>
    `;
    grid.append(card);
  });
  epochsDialog.showModal();
};

$('epochs-close').onclick = () => epochsDialog.close();

$('help').onclick = () => showDialog(
  'ЖОЛҒА ШЫҚПАС БҰРЫН',
  'Өткенге алғашқы қадам',
  'WASD немесе бағыттауыш пернелер — қозғалу. E — әрекет, затты алу және квиздерге жауап беру. I — қоржын. Space — шабуыл; 1 — қылыш, 2 — найза, 3 — садақ. 6 байланысқан аймақ бар: Апат орны, Қоныс, Шеберхана, Орман, Петроглифтер үңгірі және Құпия уақыт құрдымы.'
);

$('pause').onclick = () => showDialog(
  'ҮЗІЛІС',
  'Саяхат сені күтеді',
  'Қозғалыс тоқтатылды. Дайын болғанда саяхатты жалғастыр.'
);

window.addEventListener('keydown', event => {
  if (event.code === 'KeyI' && !event.repeat && engine && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (inventoryOpen) { event.preventDefault(); closeDialog(); return; }
    if (!dialog.open && (document.activeElement === canvas || document.activeElement === document.body)) {
      event.preventDefault(); openInventory(); return;
    }
  }
  if (event.code === 'Escape' && !dialog.open && engine) {
    event.preventDefault(); $('pause').click(); return;
  }
  if (paused || !engine || event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.activeElement !== canvas && document.activeElement !== document.body) return;

  if (/^Digit[123]$/.test(event.code)) {
    event.preventDefault();
    if (!event.repeat) equipWeapon(Number(event.code.at(-1)) - 1);
    return;
  }
  if (event.code === 'Space' && !event.repeat) {
    const w = engine.tj_state(13);
    if (w === 2 && engine.tj_state(14) === 0) {
      combatMessage('Жебе таусылды. Басқа қаруды таңда.');
    } else {
      if (w === 0) playSword();
      else if (w === 1) playSpear();
      else if (w === 2) playBow();
    }
  }
  const bit = keyBits[event.code];
  if (bit) {
    event.preventDefault();
    held.add(event.code);
    sendInput();
  }
});

window.addEventListener('keyup', event => {
  const bit = keyBits[event.code];
  if (bit) {
    held.delete(event.code);
    sendInput();
  }
});

function suspend() {
  clearInput();
  if (engine && !dialog.open && !epochsDialog.open) $('pause').click();
}
window.addEventListener('blur', suspend);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });

canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));

for (const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touch.set(event.pointerId, Number(button.dataset.key));
    sendInput();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(name, event => {
      touch.delete(event.pointerId);
      sendInput();
    });
  }
}

function resize() {
  const viewport = canvas.parentElement;
  const scale = Math.max(1, Math.min(3, Math.floor(viewport.clientWidth / 480)));
  canvas.style.width = 480 * scale + 'px';
  canvas.style.height = 320 * scale + 'px';
}
new ResizeObserver(resize).observe(canvas.parentElement);

function paint(now) {
  acc += Math.min(Math.max(now - last, 0), 100);
  last = now;
  if (!paused) {
    while (acc >= 1000 / 60) {
      engine.tj_tick();
      acc -= 1000 / 60;
    }
  } else {
    acc = 0;
  }
  engine.tj_render();
  ctx.putImageData(frame, 0, 0);
  updateHud();

  const zone = engine.tj_state(2), visited = engine.tj_state(7), event = engine.tj_state(6);
  if (zone !== lastZone) {
    lastZone = zone;
    const name = ZONE_NAMES[zone] || 'Апат орны';
    const obj = ZONE_OBJECTIVES[zone] || ZONE_OBJECTIVES[0];
    $('zone').textContent = name;
    $('objective').textContent = obj.title;
    $('objective-detail').textContent = obj.detail;
    // Auto-save on zone transition
    if (visited > 1) saveGame();
  }

  if (visited !== lastVisited) {
    lastVisited = visited;
    const visitedCount = visited.toString(2).replace(/0/g, '').length;
    // Format matches check-rpg-browser.mjs regex /02 \/ 0[26] АЙМАҚ/
    $('discovered').textContent = String(visitedCount).padStart(2, '0') + ' / 06 АЙМАҚ';
    $('camp-dot').classList.toggle('active', Boolean(visited & 2));
  }

  if (event === 6) {
    const item = engine.tj_state(21);
    combatMessage('Алынды: ' + itemText(item, 1));
    playPickup();
    engine.tj_ack();
    saveGame();
  } else if (event && !openedEvent) {
    openedEvent = event;
    if (event === 2) {
      // Event 2 is checked specifically by check-rpg-browser.mjs
      showDialog(
        'ҚОНЫСТАҒЫ КЕЗДЕСУ',
        'Алғашқы байланыс',
        'Қоныс тұрғыны отқа, кейін шеберханаға қарай қолын созады. Саяхатшы оның ишарасын түсінуге тырысады. Бұл — көркем көрініс; ежелгі адамдардың тілі туралы ғылыми тұжырым емес.'
      );
    } else if (event === 3) {
      // Workshop Quiz
      showQuiz(2);
    } else if (event === 7) {
      // Hunter Quiz
      showQuiz(3);
    } else if (event === 8 || event === 9) {
      // Cave Petroglyph Quiz
      showQuiz(4);
    } else if (event === 10) {
      // Secret Anomaly Quiz
      showQuiz(5);
    } else if (STORY_EVENTS[event]) {
      const e = STORY_EVENTS[event];
      showDialog(e.label, e.title, e.text, event === 5);
    } else {
      showDialog('ОҚИҒА', 'Жол жалғасады', 'Айналаны зерттеп, тарихты қалпына келтір.');
    }
  }

  requestAnimationFrame(paint);
}

async function boot() {
  try {
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    const response = await fetch('/engine/rpg/tarikh-rpg.wasm');
    if (!response.ok) throw new Error('WASM HTTP ' + response.status);
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
    engine = instance.exports;
    engine._initialize?.();
    engine.tj_init();
    frame = new ImageData(new Uint8ClampedArray(engine.memory.buffer, engine.tj_pixels(), 480 * 320 * 4), 480, 320);
    ctx.putImageData(frame, 0, 0);
    $('loading').remove();
    $('pause').disabled = false;
    resize();
    canvas.focus({ preventScroll: true });

    // Check if previous save exists
    const hasSave = localStorage.getItem('tarikh_rpg_save_v2');
    if (hasSave) {
      combatMessage('💾 Алдыңғы сақталған прогресс табылды. Жүктеу үшін "Жүктеу" түймесін басыңыз.');
    }

    last = performance.now();
    requestAnimationFrame(paint);
  } catch (error) {
    console.error(error);
    $('loading').textContent = 'Қозғалтқыш жүктелмеді. Бетті қайта жүктеңіз немесе WASM жинағын тексеріңіз.';
  }
}

boot();

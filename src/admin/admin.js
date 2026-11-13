import { escapeHtml } from './escape.js';
import './admin.css';
import { ALL_EPOCHS, ALL_EPOCH_QUIZZES } from '../rpg/campaign.js';
import { HISTORICAL_QUIZZES } from '../rpg/story.js';

// Reactive state for the admin panel
const state = {
  activeTab: 'dashboard',
  role: 'teacher', // 'teacher' | 'admin' | 'player'
  searchQuery: '',
  selectedEpoch: 1,
  sessions: [
    { id: 'sess-001', code: 'TRK9024A1B', title: '7-сынып: Тас дәуірі және Қола', status: 'started', host: 'Айгүл Мұғалім', members: 24, created_at: '2026-11-11 14:30' },
    { id: 'sess-002', code: 'TRK8812K9Z', title: '8-сынып: Сақтар мен Түркілер', status: 'lobby', host: 'Дәурен Ұстаз', members: 18, created_at: '2026-11-11 16:00' },
    { id: 'sess-003', code: 'TRK7721X4M', title: 'Сынақ жарысы: Топтық бақталастық', status: 'closed', host: 'Айгүл Мұғалім', members: 32, created_at: '2026-11-10 11:15' }
  ],
  players: [
    { id: 'p1', name: 'Бексұлтан Серік', role: 'player', runs: 3, score: 260, level: 3, last_active: '2026-11-11 17:40' },
    { id: 'p2', name: 'Аружан Қанат', role: 'player', runs: 4, score: 300, level: 3, last_active: '2026-11-11 17:35' },
    { id: 'p3', name: 'Диас Нұрлан', role: 'player', runs: 2, score: 190, level: 2, last_active: '2026-11-11 16:50' },
    { id: 'p4', name: 'Мадина Ерлан', role: 'player', runs: 5, score: 300, level: 3, last_active: '2026-11-11 16:20' },
    { id: 'p5', name: 'Әлішер Төлеген', role: 'player', runs: 1, score: 100, level: 1, last_active: '2026-11-11 15:10' }
  ],
  epochs: ALL_EPOCHS.map(e => ({ ...e, published: true })),
  quizzes: [
    ...Object.values(HISTORICAL_QUIZZES).map(q => ({
      id: q.id,
      epoch_id: 1,
      task_id: q.questTitle,
      question_text: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      active: true
    })),
    {
      id: 'bronze_andronov',
      epoch_id: 2,
      task_id: 'Андронов қышы',
      question_text: 'Андронов мәдениетінің қыш ыдыстарына тән негізгі өрнектер қандай?',
      options: ['Геометриялық өрнектер (үшбұрыштар, сынық сызықтар)', 'Өсімдік бейнелері', 'Құс қанаттары', 'Көне жазулар'],
      correctIndex: 0,
      explanation: 'Андронов мәдениетінің қыштары сынық сызықты және меандрлы геометриялық оюлармен әшекейленген.',
      active: true
    },
    {
      id: 'saka_gold',
      epoch_id: 3,
      task_id: 'Есік обасы',
      question_text: '1969 жылы Есік обасынан табылған Алтын адамның бас киімінде қандай аңдардың мүсіндері бейнеленген?',
      options: ['Қанатты аттар (пырақтар), барыс, құстар', 'Қасқыр мен түйе', 'Арыстан мен піл', 'Аққу мен балық'],
      correctIndex: 0,
      explanation: 'Алтын адамның конус пішінді биік бас киімінде қанатты пырақтар мен аң стиліндегі алтын пластиналар бар.',
      active: true
    }
  ]
};

const root = document.querySelector('#admin-app');
const $ = id => document.getElementById(id);

function renderApp() {
  root.innerHTML = `
    <aside class="admin-sidebar">
      <div class="sidebar-brand">
        <div class="mark">Т</div>
        <div>
          <h2>TARIKH JOLY</h2>
          <small>ӘКІМШІЛІК ПАНЕЛЬ</small>
        </div>
      </div>
      <nav class="admin-nav">
        <button class="${state.activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">📊 Басқару тақтасы</button>
        <button class="${state.activeTab === 'players' ? 'active' : ''}" data-tab="players">👥 Ойыншылар</button>
        <button class="${state.activeTab === 'teams' ? 'active' : ''}" data-tab="teams">⚔ Топтар мен рейтинг</button>
        <button class="${state.activeTab === 'sessions' ? 'active' : ''}" data-tab="sessions">🎮 Ойын сессиялары</button>
        <button class="${state.activeTab === 'epochs' ? 'active' : ''}" data-tab="epochs">🗺 8 Дәуір (Деңгейлер)</button>
        <button class="${state.activeTab === 'quizzes' ? 'active' : ''}" data-tab="quizzes">📝 Квиздер мен сұрақтар</button>
        <button class="${state.activeTab === 'analytics' ? 'active' : ''}" data-tab="analytics">📈 Аналитика</button>
      </nav>
      <div class="sidebar-footer">
        <p style="margin-bottom:8px">Қазіргі рөл:</p>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="role-badge ${state.role}">${state.role === 'admin' ? 'Бас Әкімші' : state.role === 'teacher' ? 'Мұғалім' : 'Ойыншы'}</span>
          <select id="role-select" style="background:#132223;border:1px solid #2f4543;color:#cedabe;font-size:11px;padding:3px 6px;border-radius:3px">
            <option value="teacher" ${state.role === 'teacher' ? 'selected' : ''}>Мұғалім</option>
            <option value="admin" ${state.role === 'admin' ? 'selected' : ''}>Әкімші</option>
            <option value="player" ${state.role === 'player' ? 'selected' : ''}>Ойыншы</option>
          </select>
        </div>
      </div>
    </aside>

    <main class="admin-content">
      <header class="admin-topbar">
        <h1>${getTabTitle(state.activeTab)}</h1>
        <div class="topbar-right">
          <a href="/rpg.html">🎮 2D RPG Ойнау</a>
          <a href="/">Doom Beta 0.1</a>
        </div>
      </header>

      <p role="note" style="padding:12px 24px">ДЕМО: жасанды деректер. Өзгерістер тек осы бетте сақталады. Рөл таңдауы серверлік құқық бермейді.</p>
      <div class="admin-section">
        ${renderContent()}
      </div>
    </main>

    <!-- Modal for new quiz -->
    <dialog class="admin-modal" id="quiz-modal">
      <h2 id="modal-title">Жаңа тарихи сұрақ қосу</h2>
      <form id="quiz-form">
        <div class="form-group">
          <label>Сұрақ идентификаторы (ID):</label>
          <input type="text" id="q-id" placeholder="мысалы: quiz_stone_fire" required />
        </div>
        <div class="form-group">
          <label>Тарихи дәуір:</label>
          <select id="q-epoch">
            ${state.epochs.map(e => `<option value="${e.id}">${e.id}. ${e.title} (${e.subtitle})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Тапсырма тақырыбы (Task / Location):</label>
          <input type="text" id="q-task" placeholder="мысалы: Ошақ басындағы сұрақ" required />
        </div>
        <div class="form-group">
          <label>Сұрақ мәтіні:</label>
          <textarea id="q-text" rows="3" placeholder="Сұрақты қазақ тілінде жазыңыз..." required></textarea>
        </div>
        <div class="form-group">
          <label>A нұсқасы:</label>
          <input type="text" id="q-opt-0" required />
        </div>
        <div class="form-group">
          <label>B нұсқасы:</label>
          <input type="text" id="q-opt-1" required />
        </div>
        <div class="form-group">
          <label>C нұсқасы:</label>
          <input type="text" id="q-opt-2" required />
        </div>
        <div class="form-group">
          <label>D нұсқасы:</label>
          <input type="text" id="q-opt-3" required />
        </div>
        <div class="form-group">
          <label>Дұрыс нұсқаны таңдаңыз:</label>
          <select id="q-correct">
            <option value="0">A нұсқасы</option>
            <option value="1">B нұсқасы</option>
            <option value="2">C нұсқасы</option>
            <option value="3">D нұсқасы</option>
          </select>
        </div>
        <div class="form-group">
          <label>Тарихи түсіндірме (Explanation):</label>
          <textarea id="q-exp" rows="2" placeholder="Оқушыға дұрыс жауаптың тарихи мәнін түсіндіру..." required></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="modal-cancel">Болдырмау</button>
          <button type="submit" class="btn">Сақтау</button>
        </div>
      </form>
    </dialog>

    <!-- Modal for new session -->
    <dialog class="admin-modal" id="session-modal">
      <h2>Жаңа сыныптық сессия ашу</h2>
      <form id="session-form">
        <div class="form-group">
          <label>Сессия атауы (сынып немесе топ):</label>
          <input type="text" id="sess-title" placeholder="мысалы: 7 «А» сыныбы — Тарих сабағы" required />
        </div>
        <div class="form-group">
          <label>Қосылу коды (автоматты 10 таңбалы):</label>
          <input type="text" id="sess-code" readonly style="font-family:monospace;letter-spacing:2px;font-weight:bold" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="sess-cancel">Болдырмау</button>
          <button type="submit" class="btn">Сессияны бастау</button>
        </div>
      </form>
    </dialog>
  `;

  attachEvents();
}

function getTabTitle(tab) {
  const titles = {
    dashboard: 'Басқару тақтасы (Dashboard)',
    players: 'Ойыншылар мен оқушылар',
    teams: 'Командалық рейтинг және статистика',
    sessions: 'Ойын сессияларын басқару',
    epochs: '8 Тарихи дәуір (Карталар мен тапсырмалар)',
    quizzes: 'Квиздер мен сұрақтарды басқару (CRUD)',
    analytics: 'Оқыту аналитикасы мен нәтижелер'
  };
  return titles[tab] || 'Әкімшілік панель';
}

function renderContent() {
  if (state.role === 'player') {
    return `
      <div style="background:#2d1a1a;border:1px solid #7f1d1d;padding:24px;border-radius:6px;color:#fca5a5">
        <h3 style="margin-bottom:8px">Құқық шектелген: Ойыншы рөлі</h3>
        <p>Сіз қазір «Ойыншы» ретінде кіріп тұрсыз. Әкімшілік функцияларға (сұрақтарды өңдеу, сессия құру, нәтижелерді көру) тек <strong>Мұғалім</strong> немесе <strong>Әкімші</strong> қол жеткізе алады.</p>
        <p style="margin-top:12px;font-size:12px">Төменгі сол жақтағы рөл ауыстырғыштан рөліңізді «Мұғалім» немесе «Әкімші» күйіне ауыстыра аласыз.</p>
      </div>
    `;
  }

  switch (state.activeTab) {
    case 'dashboard': return renderDashboard();
    case 'players': return renderPlayers();
    case 'teams': return renderTeams();
    case 'sessions': return renderSessions();
    case 'epochs': return renderEpochs();
    case 'quizzes': return renderQuizzes();
    case 'analytics': return renderAnalytics();
    default: return renderDashboard();
  }
}

function renderDashboard() {
  const totalPlayers = state.players.length;
  const activeSessions = state.sessions.filter(s => s.status !== 'closed').length;
  const avgScore = Math.round(state.players.reduce((a, b) => a + b.score, 0) / totalPlayers);
  const completedRuns = state.players.filter(p => p.score >= 300).length;

  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <h3>Барлық оқушылар</h3>
        <div class="number">${totalPlayers}</div>
      </div>
      <div class="kpi-card">
        <h3>Белсенді сессиялар</h3>
        <div class="number">${activeSessions}</div>
      </div>
      <div class="kpi-card">
        <h3>Орташа нәтиже</h3>
        <div class="number">${avgScore} <small style="font-size:16px;color:#95a593">/ 300</small></div>
      </div>
      <div class="kpi-card">
        <h3>Аяқталған дәуірлер</h3>
        <div class="number">${completedRuns}</div>
      </div>
    </div>

    <h3 style="font-size:16px;margin-bottom:12px">Соңғы белсенді сессиялар</h3>
    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Сессия атауы</th>
            <th>Коды</th>
            <th>Мұғалім</th>
            <th>Қатысушылар</th>
            <th>Күйі</th>
          </tr>
        </thead>
        <tbody>
          ${state.sessions.map(s => `
            <tr>
              <td><strong>${escapeHtml(s.title)}</strong></td>
              <td><code style="background:#0b1617;padding:2px 6px;border-radius:3px">${escapeHtml(s.code)}</code></td>
              <td>${escapeHtml(s.host)}</td>
              <td>${s.members} оқушы</td>
              <td><span class="role-badge ${s.status === 'started' ? 'teacher' : s.status === 'lobby' ? 'admin' : 'player'}">${s.status === 'started' ? 'Ойналуда' : s.status === 'lobby' ? 'Күтуде' : 'Аяқталған'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlayers() {
  const filtered = state.players.filter(p => p.name.toLowerCase().includes(state.searchQuery.toLowerCase()));
  return `
    <div class="search-bar">
      <input type="text" id="player-search" placeholder="Оқушының атын іздеу..." value="${escapeHtml(state.searchQuery)}" />
    </div>
    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Оқушының аты</th>
            <th>Рөлі</th>
            <th>Талпыныстар саны</th>
            <th>Жоғары балл</th>
            <th>Жеткен дәуірі</th>
            <th>Соңғы белсенділік</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(p => `
            <tr>
              <td><strong>${escapeHtml(p.name)}</strong></td>
              <td><span class="role-badge ${escapeHtml(p.role)}">${escapeHtml(p.role)}</span></td>
              <td>${p.runs} рет</td>
              <td><strong style="color:var(--gold-primary)">${p.score}</strong></td>
              <td>MAP 0${p.level}</td>
              <td>${escapeHtml(p.last_active)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTeams() {
  return `
    <div class="kpi-grid">
      <div class="kpi-card" style="border-left:4px solid #38bdf8">
        <h3>Көк Бөрі (A тобы)</h3>
        <div class="number">650 <small style="font-size:16px;color:#95a593">ұпай</small></div>
        <p style="margin-top:8px;font-size:12px;color:var(--text-muted)">14 оқушы белсенді</p>
      </div>
      <div class="kpi-card" style="border-left:4px solid #f59e0b">
        <h3>Алтын Қыран (B тобы)</h3>
        <div class="number">710 <small style="font-size:16px;color:#95a593">ұпай</small></div>
        <p style="margin-top:8px;font-size:12px;color:var(--text-muted)">16 оқушы белсенді</p>
      </div>
    </div>

    <h3 style="font-size:16px;margin-bottom:12px">Командалық жарыс рейтингі</h3>
    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Орын</th>
            <th>Команда</th>
            <th>Жалпы жинаған балл</th>
            <th>Орташа көрсеткіш</th>
            <th>Қатысушылар</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>🥇 1-орын</td>
            <td><strong style="color:#f59e0b">Алтын Қыран (B тобы)</strong></td>
            <td>710 ұпай</td>
            <td>88.75%</td>
            <td>16 оқушы</td>
          </tr>
          <tr>
            <td>🥈 2-орын</td>
            <td><strong style="color:#38bdf8">Көк Бөрі (A тобы)</strong></td>
            <td>650 ұпай</td>
            <td>81.25%</td>
            <td>14 оқушы</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderSessions() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <p style="font-size:13px;color:var(--text-muted)">Сыныпта сабақ өткізу үшін жаңа сессия ашып, оқушыларға қосылу кодын беріңіз.</p>
      <button class="btn" id="create-session-btn">+ Жаңа сессия құру</button>
    </div>
    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Сессия атауы</th>
            <th>Қосылу коды</th>
            <th>Мұғалім</th>
            <th>Қатысушылар</th>
            <th>Күйі</th>
            <th>Әрекеттер</th>
          </tr>
        </thead>
        <tbody>
          ${state.sessions.map(s => `
            <tr>
              <td><strong>${escapeHtml(s.title)}</strong></td>
              <td><code style="font-size:14px;background:#0b1617;padding:4px 8px;border-radius:4px;color:var(--gold-primary);font-weight:bold">${escapeHtml(s.code)}</code></td>
              <td>${escapeHtml(s.host)}</td>
              <td>${s.members} қатысушы</td>
              <td><span class="role-badge ${s.status === 'started' ? 'teacher' : s.status === 'lobby' ? 'admin' : 'player'}">${s.status === 'started' ? 'Белсенді' : s.status === 'lobby' ? 'Күтуде' : 'Жабылған'}</span></td>
              <td>
                ${s.status !== 'closed' ? `<button class="btn btn-danger" style="font-size:11px;padding:4px 8px" onclick="window.adminCloseSession('${s.id}')">Жабу</button>` : '<small style="color:var(--text-muted)">Аяқталды</small>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEpochs() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <p style="font-size:13px;color:var(--text-muted)">Tarikh Joly сегіз дәуірден тұрады. Бас әкімші дәуірлерді жариялауды немесе жасыруды басқара алады.</p>
    </div>
    <div class="epoch-list-grid">
      ${state.epochs.map(e => `
        <div class="epoch-admin-card ${e.published ? 'published' : 'draft'}">
          <span class="role-badge ${e.published ? 'teacher' : 'player'}" style="margin-bottom:8px">${e.published ? 'Жарияланған' : 'Жабық'}</span>
          <h4>MAP 0${e.id}: ${e.title}</h4>
          <small style="color:var(--gold-dim);display:block;margin-bottom:6px">${e.subtitle} · ${e.period}</small>
          <p>${e.description}</p>
          <div class="epoch-actions">
            <span style="font-size:11px;color:var(--text-muted)">${state.quizzes.filter(q => q.epoch_id === e.id).length} сұрақ бар</span>
            ${state.role === 'admin' ? `
              <button class="btn btn-secondary" style="font-size:11px;padding:4px 8px" onclick="window.adminToggleEpoch(${e.id})">
                ${e.published ? 'Жасыру' : 'Жариялау'}
              </button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderQuizzes() {
  const currentQuizzes = state.quizzes.filter(q => q.epoch_id === state.selectedEpoch);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:13px;color:var(--text-muted)">Дәуірді таңдаңыз:</label>
        <select id="epoch-filter" style="background:var(--bg-sidebar);border:1px solid var(--border);color:var(--text-main);padding:6px 10px;border-radius:4px">
          ${state.epochs.map(e => `<option value="${e.id}" ${state.selectedEpoch === e.id ? 'selected' : ''}>${e.id}. ${e.title}</option>`).join('')}
        </select>
      </div>
      <button class="btn" id="add-quiz-btn">+ Жаңа сұрақ қосу</button>
    </div>

    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID / Тапсырма</th>
            <th>Сұрақ мәтіні</th>
            <th>Дұрыс жауап</th>
            <th>Түсіндірме</th>
            <th>Күйі</th>
            <th>Әрекет</th>
          </tr>
        </thead>
        <tbody>
          ${currentQuizzes.length === 0 ? `
            <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Бұл дәуірге әзірге қосымша сұрақ қосылмаған. «Жаңа сұрақ қосу» түймесін басыңыз.</td></tr>
          ` : currentQuizzes.map(q => `
            <tr>
              <td><strong style="color:var(--gold-primary)">${escapeHtml(q.id)}</strong><br><small style="color:var(--text-muted)">${escapeHtml(q.task_id)}</small></td>
              <td style="max-width:280px;line-height:1.4">${escapeHtml(q.question_text)}</td>
              <td><span style="color:var(--accent-green);font-weight:600">${escapeHtml(q.options[q.correctIndex] || q.options[0])}</span></td>
              <td style="max-width:260px;font-size:12px;color:var(--text-muted);line-height:1.4">${escapeHtml(q.explanation)}</td>
              <td><span class="role-badge ${q.active ? 'teacher' : 'player'}">${q.active ? 'Белсенді' : 'Өшірулі'}</span></td>
              <td>
                <button class="btn btn-danger" style="font-size:11px;padding:4px 8px" data-delete-quiz="${escapeHtml(q.id)}">Өшіру</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAnalytics() {
  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <h3>Дұрыс жауап пайызы</h3>
        <div class="number">78.4%</div>
      </div>
      <div class="kpi-card">
        <h3>1-ші әрекеттен шешкендер</h3>
        <div class="number">64%</div>
      </div>
      <div class="kpi-card">
        <h3>Орташа уақыт</h3>
        <div class="number">4 мин</div>
      </div>
      <div class="kpi-card">
        <h3>Ең жиі қате кеткен тақырып</h3>
        <div class="number" style="font-size:18px;margin-top:8px">Чоппер мен Бифас</div>
      </div>
    </div>

    <h3 style="font-size:16px;margin-bottom:12px">Дәуірлер бойынша оқушылардың өту статистикасы</h3>
    <div class="table-container">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Дәуір</th>
            <th>Сұрақтар саны</th>
            <th>Орташа балл</th>
            <th>Сәтті өткендер</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>MAP 01: Тас дәуірі</td>
            <td>5 сұрақ</td>
            <td>280 / 300</td>
            <td><strong style="color:var(--accent-green)">92%</strong></td>
          </tr>
          <tr>
            <td>MAP 02: Қола дәуірі</td>
            <td>4 сұрақ</td>
            <td>250 / 300</td>
            <td><strong style="color:var(--accent-green)">84%</strong></td>
          </tr>
          <tr>
            <td>MAP 03: Сақ дәуірі</td>
            <td>4 сұрақ</td>
            <td>240 / 300</td>
            <td><strong style="color:var(--accent-green)">80%</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function attachEvents() {
  document.querySelectorAll('[data-delete-quiz]').forEach(button => {
    button.onclick = () => window.adminDeleteQuiz(button.dataset.deleteQuiz);
  });
  // Navigation tabs
  document.querySelectorAll('nav.admin-nav button').forEach(btn => {
    btn.onclick = () => {
      state.activeTab = btn.dataset.tab;
      renderApp();
    };
  });

  // Role select
  const roleSelect = $('role-select');
  if (roleSelect) {
    roleSelect.onchange = e => {
      state.role = e.target.value;
      renderApp();
    };
  }

  // Player search
  const searchInput = $('player-search');
  if (searchInput) {
    searchInput.oninput = e => {
      state.searchQuery = e.target.value;
      renderApp();
      const newSearch = $('player-search');
      if (newSearch) {
        newSearch.focus();
        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
      }
    };
  }

  // Epoch filter in Quizzes
  const epochFilter = $('epoch-filter');
  if (epochFilter) {
    epochFilter.onchange = e => {
      state.selectedEpoch = Number(e.target.value);
      renderApp();
    };
  }

  // Quiz Modal
  const addQuizBtn = $('add-quiz-btn');
  const quizModal = $('quiz-modal');
  const modalCancel = $('modal-cancel');
  const quizForm = $('quiz-form');

  if (addQuizBtn && quizModal) {
    addQuizBtn.onclick = () => {
      $('q-id').value = `quiz_ep${state.selectedEpoch}_${Date.now().toString(36)}`;
      $('q-epoch').value = state.selectedEpoch;
      $('q-task').value = '';
      $('q-text').value = '';
      $('q-opt-0').value = '';
      $('q-opt-1').value = '';
      $('q-opt-2').value = '';
      $('q-opt-3').value = '';
      $('q-exp').value = '';
      quizModal.showModal();
    };
  }

  if (modalCancel && quizModal) {
    modalCancel.onclick = () => quizModal.close();
  }

  if (quizForm && quizModal) {
    quizForm.onsubmit = e => {
      e.preventDefault();
      const newQ = {
        id: $('q-id').value.trim(),
        epoch_id: Number($('q-epoch').value),
        task_id: $('q-task').value.trim(),
        question_text: $('q-text').value.trim(),
        options: [
          $('q-opt-0').value.trim(),
          $('q-opt-1').value.trim(),
          $('q-opt-2').value.trim(),
          $('q-opt-3').value.trim()
        ],
        correctIndex: Number($('q-correct').value),
        explanation: $('q-exp').value.trim(),
        active: true
      };
      state.quizzes.push(newQ);
      quizModal.close();
      renderApp();
    };
  }

  // Session Modal
  const createSessionBtn = $('create-session-btn');
  const sessionModal = $('session-modal');
  const sessCancel = $('sess-cancel');
  const sessionForm = $('session-form');

  if (createSessionBtn && sessionModal) {
    createSessionBtn.onclick = () => {
      $('sess-title').value = '';
      $('sess-code').value = 'TRK' + Math.random().toString(36).substring(2, 9).toUpperCase();
      sessionModal.showModal();
    };
  }

  if (sessCancel && sessionModal) {
    sessCancel.onclick = () => sessionModal.close();
  }

  if (sessionForm && sessionModal) {
    sessionForm.onsubmit = e => {
      e.preventDefault();
      const newSess = {
        id: 'sess-' + Date.now(),
        code: $('sess-code').value,
        title: $('sess-title').value.trim(),
        status: 'lobby',
        host: state.role === 'admin' ? 'Бас Әкімші' : 'Мұғалім',
        members: 0,
        created_at: new Date().toISOString().substring(0, 16).replace('T', ' ')
      };
      state.sessions.unshift(newSess);
      sessionModal.close();
      renderApp();
    };
  }
}

// Global actions for inline button handlers
window.adminCloseSession = id => {
  const s = state.sessions.find(x => x.id === id);
  if (s) {
    s.status = 'closed';
    renderApp();
  }
};

window.adminToggleEpoch = id => {
  const ep = state.epochs.find(x => x.id === id);
  if (ep) {
    ep.published = !ep.published;
    renderApp();
  }
};

window.adminDeleteQuiz = id => {
  const q = state.quizzes.find(x => x.id === id);
  if (q) {
    q.active = false;
    renderApp();
  }
};

renderApp();

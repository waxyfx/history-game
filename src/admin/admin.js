// Admin panel on real data: Google-signed-in participants, official runs and results of the 2D campaign.
// Server functions (all teacher/admin-only on the server): admin_overview, admin_list_users,
// admin_trial_stats (migration 018; option counts in 019), admin_result_answers (019: one student's answers),
// admin_get_level_results and admin_set_user_role (006), get_my_role. Tables export to CSV (Excel opens them).
// Without Supabase the gate loads the demo panel (admin-demo.js) instead.
import {escapeHtml as esc} from './escape.js';
import './admin.css';
import {db} from '../api.js';
import {ALL_EPOCHS} from '../rpg/campaign.js';
import {LEVEL_IDS} from '../rpg/levels.js';

// Trial titles live in the per-level story files (plain data, loaded only for the Trials tab).
const STORIES = {
  1: () => import('../rpg/story.js'), 2: () => import('../rpg/story02.js'), 3: () => import('../rpg/story03.js'),
  4: () => import('../rpg/story04.js'), 5: () => import('../rpg/story05.js'), 6: () => import('../rpg/story06.js'),
  7: () => import('../rpg/story07.js'), 8: () => import('../rpg/story08.js'), 9: () => import('../rpg/story09.js'),
  10: () => import('../rpg/story10.js')
};
const ROLE = {student: 'Оқушы', teacher: 'Мұғалім', admin: 'Әкімші'};
const ROLE_CLASS = {student: 'player', teacher: 'teacher', admin: 'admin'};
const KIND = {main: 'Міндетті', final: 'Қорытынды', secret: 'Құпия', bonus: 'Бонус'};
const TABS = {
  dashboard: ['📊 Басқару тақтасы', 'Басқару тақтасы'],
  users: ['👥 Қатысушылар', 'Қатысушылар мен рөлдер'],
  results: ['🏆 Нәтижелер', 'Ресми нәтижелер'],
  levels: ['🗺 Деңгейлер', '10 дәуір: деңгейлер статистикасы'],
  trials: ['📝 Сынақтар', 'Сынақтар статистикасы']
};

const state = {
  tab: 'dashboard', role: null, me: null, error: '', notice: '', loading: false,
  overview: null, users: null, search: '', results: {}, resultsLevel: 0, trials: {}, trialsLevel: 1, titles: {},
  answers: null   // {result, rows, error}: one student's answers, shown under the results table
};
const root = document.querySelector('#admin-app');
const $ = id => document.getElementById(id);

async function call(name, args = {}) {
  const {data, error} = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
const era = id => ALL_EPOCHS.find(e => e.id === id);
const levelName = id => `MAP ${String(id).padStart(2, '0')} · ${era(id)?.title || ''}`;
const when = t => (t ? new Date(t).toLocaleString('kk-KZ', {dateStyle: 'short', timeStyle: 'short'}) : '—');
const mmss = s => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const num = v => Number(v || 0);

// ------------------------------------------------------------------ data loading
async function load(force = false) {
  state.loading = true; state.error = ''; render();
  try {
    if (state.tab === 'dashboard' || state.tab === 'levels') {
      if (force || !state.overview) state.overview = await call('admin_overview');
    } else if (state.tab === 'users') {
      if (force || !state.users) state.users = await call('admin_list_users', {p_search: state.search || null, p_limit: 300, p_offset: 0});
    } else if (state.tab === 'results') {
      const key = state.resultsLevel;
      if (force || !state.results[key]) state.results[key] = await call('admin_get_level_results', {p_level: key || null, p_limit: 300, p_offset: 0});
    } else if (state.tab === 'trials') {
      const n = state.trialsLevel;
      if (force || !state.trials[n]) state.trials[n] = await call('admin_trial_stats', {p_level: n});
      await trialTexts(n);
    }
  } catch (e) {
    state.error = e.message || String(e);
  } finally {
    state.loading = false; render();
  }
}

// Trial texts of one level from its story file: title, options and the right option (the client ships them anyway;
// the server never returns keys). MAP01's five secret questions come from BONUS_QUIZ.
const kk = v => (v && typeof v === 'object' && !Array.isArray(v) ? v.kk : v);
async function trialTexts(n) {
  if (state.titles[n] || !STORIES[n]) return state.titles[n] || {};
  const m = await STORIES[n]();
  const out = Object.fromEntries(Object.values(m.HISTORICAL_QUIZZES || {}).map(q => [q.id, {title: kk(q.title), options: kk(q.options) || [], right: q.correctIndex}]));
  (m.BONUS_META || []).forEach((b, i) => { const q = m.BONUS_QUIZ?.questions?.[i]; if (q) out[b.id] = {title: `${kk(m.BONUS_QUIZ.title)} · ${i + 1}`, options: kk(q.o) || [], right: q.a}; });
  return (state.titles[n] = out);
}
const LETTER = i => 'ABCDEFGHIJ'[i] || '?';
const optText = (q, i) => { const o = q?.options?.[i] || ''; return /^[A-JА-Г]\)\s/.test(o) ? o : `${LETTER(i)}) ${o}`; };
const trialName = (n, id) => state.titles[n]?.[id]?.title || id;

// CSV for Excel: UTF-8 with BOM, «;» between columns (what Excel expects in kk/ru locales), quotes doubled.
function downloadCSV(name, header, rows) {
  const cell = v => { const t = v == null ? '' : String(v); return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const text = '\uFEFF' + [header, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'text/csv;charset=utf-8'}));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvButton = id => `<button class="btn btn-secondary" id="${id}">⬇ CSV (Excel)</button>`;

// ------------------------------------------------------------------ screens
function kpi(title, value, sub = '') {
  return `<div class="kpi-card"><h3>${esc(title)}</h3><div class="number">${value}</div>${sub ? `<p class="kpi-sub">${sub}</p>` : ''}</div>`;
}
function resultBadge(passed) {
  return `<span class="role-badge ${passed ? 'teacher' : 'player'}">${passed ? 'Өтті' : 'Өтпеді'}</span>`;
}
const EMPTY_RESULTS = 'Әзірге ресми нәтиже жоқ. Оқушылар Google арқылы кіріп, деңгейді аяқтағанда осында көрінеді.';

function resultsTable(rows, withName = true) {
  if (!rows.length) return `<p class="empty-note">${EMPTY_RESULTS}</p>`;
  return `<div class="table-container"><table class="admin-table"><thead><tr>
    ${withName ? '<th>Қатысушы</th>' : ''}<th>Деңгей</th><th>Ұпай</th><th>%</th><th>Нәтиже</th><th>Талпыныс</th><th>Уақыт</th><th>Аяқталды</th><th>Жауаптар</th>
  </tr></thead><tbody>${rows.map(r => `<tr class="${state.answers?.result?.id === r.id ? 'selected' : ''}">
    ${withName ? `<td><strong>${esc(r.name || '—')}</strong></td>` : ''}
    <td>${esc(levelName(r.level_id))}</td>
    <td><strong style="color:var(--gold-primary)">${num(r.score)}</strong> / ${num(r.max_score)}</td>
    <td>${Math.round(num(r.percentage))}%</td>
    <td>${resultBadge(r.passed)}</td>
    <td>${num(r.attempt_number)}</td>
    <td>${mmss(r.duration_seconds)}</td>
    <td>${esc(when(r.finished_at))}</td>
    <td>${r.id ? `<button class="btn btn-secondary btn-small" data-answers="${esc(r.id)}">Көру</button>` : '—'}</td>
  </tr>`).join('')}</tbody></table></div>${answersPanel()}`;
}

// One student's answers: every trial of the level, the option picked, right or wrong, points.
function answersPanel() {
  const A = state.answers;
  if (!A) return '';
  const r = A.result, n = r.level_id;
  const head = `<div class="answers-head"><h3 class="section-title">${esc(r.name || '—')} · ${esc(levelName(n))} · ${num(r.score)} / ${num(r.max_score)}</h3>
    <div>${A.rows ? csvButton('csv-answers') : ''} <button class="btn btn-secondary" id="answers-close" aria-label="Жабу">✕</button></div></div>`;
  if (A.error) return `<div class="answers-box">${head}<p class="admin-alert error" role="alert">${esc(A.error)}</p></div>`;
  if (!A.rows) return `<div class="answers-box">${head}<p class="empty-note">Жүктелуде…</p></div>`;
  const wrong = A.rows.filter(a => a.answered && !a.right).length;
  return `<div class="answers-box">${head}<p class="hint">Жауап берілген: ${A.rows.filter(a => a.answered).length} / ${A.rows.length} · қате: ${wrong}</p>
    <div class="table-container"><table class="admin-table"><thead><tr><th>Сынақ</th><th>Түрі</th><th>Таңдаған нұсқа</th><th>Дұрыс нұсқа</th><th>Нәтиже</th><th>Ұпай</th></tr></thead>
    <tbody>${A.rows.map(a => { const q = state.titles[n]?.[a.quiz_id] || {};
      const picked = a.answered && a.choice != null ? optText(q, a.choice) : '—';
      const right = q.right != null ? optText(q, q.right) : '—';
      return `<tr class="${a.answered ? (a.right ? 'row-ok' : 'row-bad') : ''}"><td><strong>${esc(trialName(n, a.quiz_id))}</strong><br><small class="muted">${esc(a.quiz_id)}</small></td>
        <td>${esc(KIND[a.kind] || a.kind)}</td><td>${esc(picked)}</td><td>${a.answered && !a.right ? esc(right) : '<span class="muted">—</span>'}</td>
        <td>${a.answered ? (a.right ? '✓ Дұрыс' : '✗ Қате') : '<span class="muted">Жауап жоқ</span>'}</td><td>${num(a.awarded)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}
async function openAnswers(id) {
  const all = Object.values(state.results).flat().concat(state.overview?.recent || []);
  const result = all.find(r => r.id === id);
  if (!result) return;
  if (state.answers?.result?.id === id) { state.answers = null; return render(); }
  state.answers = {result}; render();
  try {
    await trialTexts(result.level_id);
    state.answers.rows = await call('admin_result_answers', {p_result: id});
  } catch (e) {
    state.answers.error = /admin_result_answers|does not exist|schema cache/i.test(e.message || '')
      ? 'Бұл мүмкіндікке серверде 019_teacher_analytics.sql миграциясы керек (Supabase → SQL Editor).' : (e.message || String(e));
  }
  if (state.answers?.result?.id === id) render();
}

function renderDashboard() {
  const o = state.overview;
  if (!o) return '';
  return `<div class="kpi-grid">
      ${kpi('Тіркелгендер', num(o.users), `Оқушы ${num(o.students)} · Мұғалім ${num(o.teachers)} · Әкімші ${num(o.admins)}`)}
      ${kpi('Ресми нәтижелер', num(o.results), `${num(o.players_with_results)} қатысушы`)}
      ${kpi('Өткендер', num(o.passed), `${pct(num(o.passed), num(o.results))}% өту үлесі`)}
      ${kpi('Орташа нәтиже', `${Math.round(num(o.avg_percentage))}%`)}
      ${kpi('Қазір ойнап жатыр', num(o.runs_active), 'аяқталмаған ресми ойындар')}
    </div>
    <h3 class="section-title">Соңғы нәтижелер</h3>
    ${resultsTable(o.recent || [])}`;
}

function renderUsers() {
  const users = state.users || [];
  const admin = state.role === 'admin';
  return `<div class="search-bar">
      <input type="search" id="user-search" placeholder="${admin ? 'Аты немесе email бойынша іздеу…' : 'Аты бойынша іздеу…'}" value="${esc(state.search)}" />
      ${users.length ? csvButton('csv-users') : ''}
    </div>
    ${admin ? '<p class="hint">Рөлді өзгерту бірден серверде сақталады. Өз рөліңізді өзгерте алмайсыз.</p>' : '<p class="hint">Рөлдерді тек Әкімші өзгерте алады.</p>'}
    ${users.length ? `<div class="table-container"><table class="admin-table"><thead><tr>
      <th>Қатысушы</th><th>Рөл</th><th>Талпыныстар</th><th>Өткен деңгейлер</th><th>Үздік ұпайлар қосындысы</th><th>Соңғы белсенділік</th>
    </tr></thead><tbody>${users.map(u => `<tr>
      <td class="person">${u.avatar_url && /^https:\/\//.test(u.avatar_url) ? `<img src="${esc(u.avatar_url)}" alt="" referrerpolicy="no-referrer">` : ''}
        <div><strong>${esc(u.name)}</strong>${u.email ? `<small>${esc(u.email)}</small>` : ''}</div></td>
      <td>${admin ? `<select class="role-select" data-user="${esc(u.user_id)}" ${u.user_id === state.me ? 'disabled title="Өз рөліңізді өзгерте алмайсыз"' : ''}>
          ${Object.entries(ROLE).map(([v, l]) => `<option value="${v}" ${u.role === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>` : `<span class="role-badge ${ROLE_CLASS[u.role] || 'player'}">${esc(ROLE[u.role] || u.role)}</span>`}</td>
      <td>${num(u.attempts)}</td>
      <td>${num(u.levels_passed)}${u.max_level_passed ? ` <small class="muted">(соңғысы MAP ${String(u.max_level_passed).padStart(2, '0')})</small>` : ''}</td>
      <td><strong style="color:var(--gold-primary)">${num(u.best_total)}</strong></td>
      <td>${esc(when(u.last_active))}</td>
    </tr>`).join('')}</tbody></table></div>` : `<p class="empty-note">${state.search ? 'Ешкім табылмады.' : 'Әзірге ешкім кірмеген.'}</p>`}`;
}

function levelOptions(selected, withAll) {
  return `${withAll ? `<option value="0" ${selected === 0 ? 'selected' : ''}>Барлық деңгейлер</option>` : ''}
    ${LEVEL_IDS.map(n => `<option value="${n}" ${selected === n ? 'selected' : ''}>${esc(levelName(n))}</option>`).join('')}`;
}

function renderResults() {
  return `<div class="filter-row"><label for="results-level">Деңгей:</label>
      <select id="results-level">${levelOptions(state.resultsLevel, true)}</select>
      ${(state.results[state.resultsLevel] || []).length ? csvButton('csv-results') : ''}</div>
    <p class="hint">«Көру» оқушының әр сынақта қай нұсқаны таңдағанын және қай жерде қателескенін көрсетеді.</p>
    ${resultsTable(state.results[state.resultsLevel] || [])}`;
}

function renderLevels() {
  const o = state.overview;
  if (!o) return '';
  const rows = o.levels || [];
  return `<p class="hint">Әр деңгей 100 ұпайдан бағаланады, сервер есептейді. Мұнда барлық ресми талпыныстар бойынша статистика.</p>
    <div class="table-container"><table class="admin-table"><thead><tr>
      <th>Деңгей</th><th>Кезең</th><th>Өту шегі</th><th>Сынақтар</th><th>Талпыныстар</th><th>Қатысушылар</th><th>Өткендер</th><th>Орташа %</th><th>Үздік %</th><th>Орташа уақыт</th><th>Қазір ойнауда</th>
    </tr></thead><tbody>${rows.map(l => `<tr>
      <td><strong>${esc(levelName(l.level_id))}</strong>${LEVEL_IDS.includes(l.level_id) ? '' : ' <small class="muted">(картасы жоқ)</small>'}</td>
      <td><small>${esc(era(l.level_id)?.period || '')}</small></td>
      <td>${num(l.pass_score)} / ${num(l.max_score)}</td>
      <td>${num(l.trials)}</td>
      <td>${num(l.attempts)}</td>
      <td>${num(l.players)}</td>
      <td>${num(l.passed_players)}</td>
      <td>${Math.round(num(l.avg_percentage))}%</td>
      <td>${Math.round(num(l.best_percentage))}%</td>
      <td>${l.attempts ? mmss(l.avg_seconds) : '—'}</td>
      <td>${num(l.runs_active)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

// The most chosen wrong option of a trial: the idea the class believed (needs the option counts of migration 019).
function topWrong(t, q) {
  const c = Object.entries(t.choices || {}).map(([k, v]) => [+k, num(v)]).filter(([k, v]) => v > 0 && k !== q?.right).sort((a, b) => b[1] - a[1])[0];
  return c ? {i: c[0], n: c[1]} : null;
}
function choicesCell(t, q) {
  if (!t.choices) return '<span class="muted">019 миграциясы керек</span>';
  const total = Object.values(t.choices).reduce((sum, v) => sum + num(v), 0);
  if (!total) return '<span class="muted">—</span>';
  const opts = Math.max((q?.options || []).length, ...Object.keys(t.choices).map(k => +k + 1));
  return `<div class="choice-bars">${Array.from({length: opts}, (_, i) => { const v = num(t.choices[i]);
    return `<span class="${i === q?.right ? 'right' : ''}" title="${esc(q?.options?.[i] || '')}"><b>${LETTER(i)}</b><i style="width:${pct(v, total)}%"></i>${v}</span>`; }).join('')}</div>`;
}
function renderTrials() {
  const n = state.trialsLevel, rows = state.trials[n] || [], texts = state.titles[n] || {};
  return `<div class="filter-row"><label for="trials-level">Деңгей:</label>
      <select id="trials-level">${levelOptions(n, false)}</select>${rows.length ? csvButton('csv-trials') : ''}</div>
    <p class="hint">Аяқталған ресми ойындар бойынша. «Нұсқалар»: сынып әр нұсқаны қанша рет таңдағаны (жасыл — дұрыс нұсқа). «Жиі қате»: сыныптың ең көп сенген қате идеясы.</p>
    ${rows.length ? `<div class="table-container"><table class="admin-table"><thead><tr>
      <th>Сынақ</th><th>Түрі</th><th>Ұпай</th><th>Жауап бергендер</th><th>Дұрыс %</th><th>Нұсқалар</th><th>Жиі қате</th>
    </tr></thead><tbody>${rows.map(t => { const q = texts[t.quiz_id], w = topWrong(t, q); return `<tr>
      <td><strong>${esc(trialName(n, t.quiz_id))}</strong><br><small class="muted">${esc(t.quiz_id)}</small></td>
      <td>${esc(KIND[t.kind] || t.kind)}</td>
      <td>${num(t.points)}</td>
      <td>${num(t.answered_count)}</td>
      <td>${t.answered_count ? `${pct(num(t.right_count), num(t.answered_count))}%` : '—'}</td>
      <td>${choicesCell(t, q)}</td>
      <td>${w ? `<small>${esc(optText(q, w.i))} <span class="muted">(${w.n})</span></small>` : '<span class="muted">—</span>'}</td>
    </tr>`; }).join('')}</tbody></table></div>` : '<p class="empty-note">Бұл деңгейдің сынақтары серверде әлі тіркелмеген.</p>'}`;
}

function renderSection() {
  if (state.loading && !hasData()) return '<p class="empty-note">Жүктелуде…</p>';
  switch (state.tab) {
    case 'users': return renderUsers();
    case 'results': return renderResults();
    case 'levels': return renderLevels();
    case 'trials': return renderTrials();
    default: return renderDashboard();
  }
}
function hasData() {
  return {dashboard: state.overview, levels: state.overview, users: state.users, results: state.results[state.resultsLevel], trials: state.trials[state.trialsLevel]}[state.tab];
}

function render() {
  const focused = document.activeElement?.id === 'user-search' ? document.activeElement.selectionStart : null;
  root.innerHTML = `
    <aside class="admin-sidebar">
      <div class="sidebar-brand"><div class="mark">Т</div><div><h2>TARIKH JOLY</h2><small>ӘКІМШІЛІК ПАНЕЛЬ</small></div></div>
      <nav class="admin-nav">${Object.entries(TABS).map(([k, [label]]) => `<button class="${state.tab === k ? 'active' : ''}" data-tab="${k}">${label}</button>`).join('')}</nav>
      <div class="sidebar-footer"><p style="margin-bottom:8px">Сіздің рөліңіз (серверден):</p>
        <span class="role-badge ${ROLE_CLASS[state.role] || 'player'}">${esc(ROLE[state.role] || '—')}</span></div>
    </aside>
    <main class="admin-content">
      <header class="admin-topbar"><h1>${esc(TABS[state.tab][1])}</h1>
        <div class="topbar-right"><button class="btn btn-secondary" id="refresh" ${state.loading ? 'disabled' : ''}>↻ Жаңарту</button><a href="/">🎮 Ойынға</a></div></header>
      ${state.error ? `<p class="admin-alert error" role="alert">Деректер жүктелмеді: ${esc(state.error)}</p>` : ''}
      ${state.notice ? `<p class="admin-alert" role="status">${esc(state.notice)}</p>` : ''}
      <div class="admin-section">${renderSection()}</div>
    </main>`;
  attach();
  if (focused != null && $('user-search')) { $('user-search').focus(); $('user-search').setSelectionRange(focused, focused); }
}

// ------------------------------------------------------------------ events
let searchTimer;
function attach() {
  root.querySelectorAll('nav.admin-nav button').forEach(b => { b.onclick = () => { state.tab = b.dataset.tab; state.notice = ''; load(); }; });
  $('refresh')?.addEventListener('click', () => { state.notice = ''; load(true); });
  $('results-level')?.addEventListener('change', e => { state.resultsLevel = Number(e.target.value); state.answers = null; load(); });
  root.querySelectorAll('[data-answers]').forEach(b => { b.onclick = () => openAnswers(b.dataset.answers); });
  $('answers-close')?.addEventListener('click', () => { state.answers = null; render(); });
  const stamp = new Date().toISOString().slice(0, 10), map = n => 'MAP' + String(n).padStart(2, '0');
  $('csv-results')?.addEventListener('click', () => downloadCSV(`natizheler-${state.resultsLevel ? map(state.resultsLevel) : 'barlyq'}-${stamp}.csv`,
    ['Қатысушы', 'Деңгей', 'Ұпай', 'Максимум', '%', 'Нәтиже', 'Талпыныс', 'Уақыт (сек)', 'Аяқталды'],
    (state.results[state.resultsLevel] || []).map(r => [r.name || '', levelName(r.level_id), num(r.score), num(r.max_score), Math.round(num(r.percentage)),
      r.passed ? 'Өтті' : 'Өтпеді', num(r.attempt_number), num(r.duration_seconds), r.finished_at || ''])));
  $('csv-trials')?.addEventListener('click', () => {
    const n = state.trialsLevel, texts = state.titles[n] || {};
    downloadCSV(`synaqtar-${map(n)}-${stamp}.csv`, ['Сынақ', 'ID', 'Түрі', 'Ұпай', 'Жауап бергендер', 'Дұрыс', 'Дұрыс %', 'A', 'B', 'C', 'D', 'Дұрыс нұсқа', 'Жиі қате нұсқа'],
      (state.trials[n] || []).map(t => { const q = texts[t.quiz_id], w = topWrong(t, q);
        return [trialName(n, t.quiz_id), t.quiz_id, KIND[t.kind] || t.kind, num(t.points), num(t.answered_count), num(t.right_count),
          t.answered_count ? pct(num(t.right_count), num(t.answered_count)) : '', ...[0, 1, 2, 3].map(i => num(t.choices?.[i])),
          q?.right != null ? LETTER(q.right) : '', w ? optText(q, w.i) : '']; }));
  });
  $('csv-answers')?.addEventListener('click', () => {
    const A = state.answers, n = A.result.level_id;
    downloadCSV(`zhauaptar-${(A.result.name || 'oqushy').replace(/[^\p{L}\p{N}]+/gu, '_')}-${map(n)}-${stamp}.csv`, ['Сынақ', 'ID', 'Таңдаған нұсқа', 'Дұрыс нұсқа', 'Нәтиже', 'Ұпай'],
      A.rows.map(a => { const q = state.titles[n]?.[a.quiz_id] || {};
        return [trialName(n, a.quiz_id), a.quiz_id, a.answered && a.choice != null ? optText(q, a.choice) : '',
          q.right != null ? optText(q, q.right) : '', a.answered ? (a.right ? 'Дұрыс' : 'Қате') : 'Жауап жоқ', num(a.awarded)]; }));
  });
  $('csv-users')?.addEventListener('click', () => downloadCSV(`qatysushylar-${stamp}.csv`, ['Аты', 'Email', 'Рөл', 'Талпыныстар', 'Өткен деңгейлер', 'Үздік ұпайлар', 'Соңғы белсенділік'],
    (state.users || []).map(u => [u.name || '', u.email || '', ROLE[u.role] || u.role, num(u.attempts), num(u.levels_passed), num(u.best_total), u.last_active || ''])));
  $('trials-level')?.addEventListener('change', e => { state.trialsLevel = Number(e.target.value); load(); });
  $('user-search')?.addEventListener('input', e => {
    state.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => load(true), 300);
  });
  root.querySelectorAll('select.role-select').forEach(sel => {
    sel.onchange = async () => {
      const user = (state.users || []).find(u => u.user_id === sel.dataset.user);
      sel.disabled = true;
      try {
        await call('admin_set_user_role', {p_user_id: sel.dataset.user, p_role: sel.value});
        state.notice = `Рөл сақталды: ${user?.name || ''} — ${ROLE[sel.value]}.`;
        state.overview = null;
        await load(true);
      } catch (e) {
        state.error = e.message || String(e);
        await load(true);
      }
    };
  });
}

// ------------------------------------------------------------------ start
async function boot() {
  try {
    const [{data: session}, role] = await Promise.all([db.auth.getSession(), call('get_my_role')]);
    state.me = session?.session?.user?.id || null;
    state.role = role;
  } catch (e) {
    state.error = e.message || String(e);
  }
  await load();
}
boot();

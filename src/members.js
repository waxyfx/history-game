// Participants: Google sign-in (Supabase Auth), server profile, and official level runs.
// The browser never computes or sends a score: it only sends quiz choices; the server checks them
// against private keys and writes the result. The local game save stays separate (src/rpg/persistence.js).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = v => typeof v === 'string' && UUID.test(v);
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));

export async function currentUser(db) {
  if (!db) return null;
  const {data} = await db.auth.getSession();
  return data?.session?.user || null;
}
// Profile fields come from the verified identity on the server (auth.users / auth.identities).
export const syncProfile = rpc => rpc('sync_my_profile');

/**
 * Official run for one level. `rpc(name,args)` is injected (src/api.js in the browser, a stub in tests).
 * Each mutating call has a request UUID that is persisted until the server answers, so a retry after a
 * network failure replays the same request instead of creating a second answer or result.
 */
export function createOfficialRun({rpc, storage = globalThis.localStorage, level = 1}) {
  let run = null;
  const key = k => `tarikh.official.${level}.${k}`;
  const get = k => { try { return JSON.parse(storage.getItem(key(k)) || 'null'); } catch { return null; } };
  const put = (k, v) => { try { v == null ? storage.removeItem(key(k)) : storage.setItem(key(k), JSON.stringify(v)); } catch {} };
  async function durable(name, payload, args) {
    const tag = name + ':' + JSON.stringify(payload);
    let pending = get('pending');
    if (!pending || pending.tag !== tag) { pending = {tag, request: newId()}; put('pending', pending); }
    const result = await rpc(name, [...args, pending.request]);
    put('pending', null);
    return result;
  }
  return {
    get run() { return run; },
    get active() { return !!run && run.status === 'active'; },
    async start(mode = 'solo', session = null) {
      run = await rpc('level_start_run', [level, mode, isUuid(session) ? session : null]);
      return run;
    },
    async answer(quizId, choice) {
      if (!run) throw new Error('No official run');
      const res = await durable('level_submit_answer', {run: run.id, quizId, choice}, [run.id, quizId, choice]);
      if (res.run) run = res.run;
      return res;
    },
    async finish() {
      if (!run) throw new Error('No official run');
      const res = await durable('level_finish_run', {run: run.id}, [run.id]);
      run = {...run, status: 'finished'};
      return res;
    },
  };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fmtTime = s => s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const ROLE = {student: 'Оқушы', teacher: 'Мұғалім', admin: 'Әкімші'};
/** Profile card HTML (Kazakh UI, all values escaped). `levelName(id)` maps level ids to titles. */
export function profileHTML(p, levelName = id => 'MAP ' + String(id).padStart(2, '0')) {
  const levels = p.levels || [], recent = p.recent || [];
  const passed = levels.filter(l => l.passed).map(l => levelName(l.level_id));
  const avatar = p.avatar_url && /^https:\/\//.test(p.avatar_url) ? `<img class="avatar" src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((p.name || '?')[0])}</span>`;
  const active = (p.active_runs || []).map(r => `<li>${esc(levelName(r.level_id))} · ${r.mode === 'team' ? 'топ' : 'жеке'} · басталды ${esc(new Date(r.started_at).toLocaleString())}</li>`).join('');
  return `<div class="member">${avatar}<div><h2>${esc(p.name)}</h2><p class="muted">${esc(p.email || '')} · ${esc(ROLE[p.role] || p.role)}</p></div></div>
  <h3>Ағымдағы прогресс</h3>${active ? `<ul>${active}</ul>` : '<p class="muted">Белсенді ресми попытка жоқ.</p>'}
  <h3>Өтілген дәуірлер</h3><p>${passed.length ? passed.map(esc).join(', ') : '<span class="muted">Әзірге жоқ</span>'}</p>
  <h3>Үздік нәтижелер</h3>${levels.length ? `<table class="results-table"><tr><th>Деңгей</th><th>Үздік</th><th>%</th><th>Попытка</th><th>Үздік уақыт</th><th>Өтті</th></tr>${levels.map(l => `<tr><td>${esc(levelName(l.level_id))}</td><td>${l.best_score} / ${l.max_score}</td><td>${Number(l.best_percentage).toFixed(0)}%</td><td>${l.attempts}</td><td>${fmtTime(l.best_duration_seconds)}</td><td>${l.passed ? '✓' : '—'}</td></tr>`).join('')}</table>` : '<p class="muted">Әзірге ресми нәтиже жоқ.</p>'}
  <h3>Соңғы попыткалар</h3>${recent.length ? recent.map(r => `<div class="review"><strong>${esc(levelName(r.level_id))} · ${r.score} / ${r.max_score} (${Number(r.percentage).toFixed(0)}%)</strong><p>${r.attempt_number}-попытка · ${r.mode === 'team' ? 'топ' : 'жеке'} · ${fmtTime(r.duration_seconds)} · ${r.passed ? 'өтті' : 'өтпеді'}</p><small>${esc(new Date(r.finished_at).toLocaleString())}</small></div>`).join('') : '<p class="muted">Попыткалар жоқ.</p>'}`;
}

// Admin panel sign-in shown before /admin.html loads the panel.
// - Supabase configured: Google sign-in (the same Supabase Auth account as the game) or email/password;
//   either way the SERVER role (get_my_role) must be admin or teacher. The login "Admin" can be mapped
//   to an email with VITE_ADMIN_EMAIL.
// - Local dev server without Supabase: optional demo sign-in from .env.local
//   (VITE_DEV_ADMIN_LOGIN + VITE_DEV_ADMIN_PASSWORD_SHA256). This branch exists only in `npm run dev`
//   (import.meta.env.DEV); production builds never contain it, and it grants no server rights.
import {db} from '../api.js';
import './admin.css';

const app = document.querySelector('#admin-app');
const DEMO_KEY = 'tarikh.admin.demo';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const demoEnabled = () => import.meta.env.DEV && !db && !!import.meta.env.VITE_DEV_ADMIN_LOGIN && /^[0-9a-f]{64}$/.test(import.meta.env.VITE_DEV_ADMIN_PASSWORD_SHA256 || '');

async function serverRole() {
  const {data, error} = await db.rpc('get_my_role');
  if (error) throw error;
  return data;
}
async function openPanel(label, role = 'admin') {
  app.innerHTML = '';
  await import('./admin.js');
  // Show the panel in the signed-in role (the demo panel otherwise starts as teacher).
  const sel = document.getElementById('role-select');
  if (sel && sel.value !== role) { sel.value = role; sel.dispatchEvent(new Event('change', {bubbles: true})); }
  const bar = document.createElement('div');
  bar.className = 'gate-session';
  bar.innerHTML = `<span>${esc(label)}</span><button type="button">Шығу</button>`;
  bar.querySelector('button').onclick = async () => {
    try { sessionStorage.removeItem(DEMO_KEY); } catch {}
    if (db) await db.auth.signOut();
    location.reload();
  };
  document.body.append(bar);
}

function showLogin(message = '') {
  const mode = db ? 'server' : demoEnabled() ? 'demo' : 'none';
  app.innerHTML = `<main class="gate">
    <form class="gate-card" id="gate-form" autocomplete="on">
      <p class="gate-eyebrow">TARIKH JOLY · ӘКІМШІЛІК</p>
      <h1>Әкімші панеліне кіру</h1>
      ${mode === 'none' ? `<p class="gate-note">Кіру үшін Supabase бапталуы қажет (.env.local: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) және әкімші аккаунты жасалуы керек. README / docs/server-api.md қараңыз.</p>` : ''}
      ${mode === 'demo' ? `<p class="gate-note">Жергілікті демо-кіру (тек <code>npm run dev</code>). Серверлік құқық бермейді, деректер — демо.</p>` : ''}
      ${mode === 'server' ? `<button type="button" class="gate-google" id="gate-google">Google арқылы кіру</button><p class="gate-or">немесе email мен құпия сөз</p>` : ''}
      <label>Логин<input id="gate-login" name="username" autocomplete="username" required maxlength="120" ${mode === 'none' ? 'disabled' : ''}></label>
      <label>Құпия сөз<input id="gate-pass" name="password" type="password" autocomplete="current-password" required maxlength="200" ${mode === 'none' ? 'disabled' : ''}></label>
      <p class="gate-error" id="gate-error" role="alert">${esc(message)}</p>
      <button type="submit" ${mode === 'none' ? 'disabled' : ''}>Кіру</button>
      <a class="gate-back" href="/">← Басты бет</a>
    </form></main>`;
  const form = document.getElementById('gate-form');
  // Google: Supabase returns to this page; boot() then checks the server role of that Google account.
  document.getElementById('gate-google')?.addEventListener('click', async e => {
    const google = e.currentTarget;
    google.disabled = true;
    const {error} = await db.auth.signInWithOAuth({provider: 'google', options: {redirectTo: location.origin + location.pathname}});
    if (error) { document.getElementById('gate-error').textContent = 'Google арқылы кіру басталмады.'; google.disabled = false; }
  });
  form.onsubmit = async e => {
    e.preventDefault();
    const login = document.getElementById('gate-login').value.trim(), pass = document.getElementById('gate-pass').value;
    const err = document.getElementById('gate-error'), button = form.querySelector('button[type=submit]');
    err.textContent = ''; button.disabled = true;
    try {
      if (mode === 'server') {
        const email = login.includes('@') ? login : (import.meta.env.VITE_ADMIN_EMAIL && login.toLowerCase() === 'admin' ? import.meta.env.VITE_ADMIN_EMAIL : null);
        if (!email) throw new Error('Логин ретінде email енгізіңіз (немесе VITE_ADMIN_EMAIL баптаңыз).');
        const {error} = await db.auth.signInWithPassword({email, password: pass});
        if (error) throw new Error('Логин немесе құпия сөз қате.');
        const role = await serverRole();
        if (role !== 'admin' && role !== 'teacher') { await db.auth.signOut(); throw new Error('Бұл аккаунтта әкімші құқығы жоқ.'); }
        await openPanel(`${email} · ${role === 'admin' ? 'Әкімші' : 'Мұғалім'}`, role);
      } else if (mode === 'demo') {
        const ok = login === import.meta.env.VITE_DEV_ADMIN_LOGIN && (await sha256(pass)) === import.meta.env.VITE_DEV_ADMIN_PASSWORD_SHA256;
        if (!ok) throw new Error('Логин немесе құпия сөз қате.');
        try { sessionStorage.setItem(DEMO_KEY, '1'); } catch {}
        await openPanel(`${login} · демо`);
      }
    } catch (e2) {
      err.textContent = e2.message || 'Кіру мүмкін болмады.';
      button.disabled = false;
    }
  };
  document.getElementById('gate-login')?.focus();
}

async function boot() {
  let message = '';
  try {
    // A failed Google sign-in comes back with the reason in the URL; show it and clean the address bar.
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
    const oauthError = q.get('error_description') || h.get('error_description');
    if (oauthError) { message = 'Google арқылы кіру аяқталмады: ' + oauthError; history.replaceState(null, '', location.pathname); }
    if (db) {
      const {data} = await db.auth.getSession();
      if (data?.session) {
        const role = await serverRole().catch(() => null);
        if (role === 'admin' || role === 'teacher') return openPanel(`${data.session.user.email || ''} · ${role === 'admin' ? 'Әкімші' : 'Мұғалім'}`, role);
        // Signed in (e.g. with Google in the game) but without rights: keep that session and explain.
        message = `${data.session.user.email || 'Бұл аккаунт'}: әкімші немесе мұғалім құқығы жоқ. Басқа аккаунтпен кіріңіз.`;
      }
    } else if (demoEnabled()) {
      let on = false; try { on = sessionStorage.getItem(DEMO_KEY) === '1'; } catch {}
      if (on) return openPanel(`${import.meta.env.VITE_DEV_ADMIN_LOGIN} · демо`);
    }
  } catch {}
  showLogin(message);
}
boot();

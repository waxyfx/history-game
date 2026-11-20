// Accounts before play: «Саяхатты бастау» / «Топпен ойнау» first ask the player to sign in or register, once.
// - With the server (Supabase): a real account — e-mail + password (sign up / sign in) or Google. The session is kept
//   in cookies (cookieStorage, used by api.js) for 30 days and refreshed by Supabase, so the player is not asked again.
// - Without the server (local runs, a site without VITE_SUPABASE_*): there is nowhere to keep passwords safely, so the
//   window offers an honest local profile — the player's name only, kept in a cookie on this device.

const DAY = 86400;
const secure = () => (globalThis.location?.protocol === 'https:' ? '; Secure' : '');
function readCookie(name, doc = globalThis.document) {
  const all = doc?.cookie ? doc.cookie.split('; ') : [];
  const hit = all.find(c => c.startsWith(name + '='));
  return hit == null ? null : hit.slice(name.length + 1);
}
function writeCookie(name, value, maxAge, doc = globalThis.document) {
  if (doc) doc.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure()}`;
}

// A Storage-like adapter for the Supabase client that keeps the session in cookies. A session is a few KB, more than
// one cookie holds, so the value is split into numbered chunks (key.0, key.1, … and key.n with the count).
// An older session kept in localStorage is still read once (and moved to cookies on the next write).
export function cookieStorage({days = 30, chunk = 3000, doc = globalThis.document, local = globalThis.localStorage} = {}) {
  const age = days * DAY;
  const clear = (key, from = 0) => { const n = +readCookie(key + '.n', doc) || 0; for (let i = from; i < n; i++) writeCookie(`${key}.${i}`, '', 0, doc); };
  return {
    getItem(key) {
      const n = +readCookie(key + '.n', doc) || 0;
      if (!n) { try { return local?.getItem(key) ?? null; } catch { return null; } }
      let s = '';
      for (let i = 0; i < n; i++) { const part = readCookie(`${key}.${i}`, doc); if (part == null) return null; s += part; }
      try { return decodeURIComponent(s); } catch { return null; }
    },
    setItem(key, value) {
      const enc = encodeURIComponent(String(value)), n = Math.max(1, Math.ceil(enc.length / chunk));
      clear(key, n);
      for (let i = 0; i < n; i++) writeCookie(`${key}.${i}`, enc.slice(i * chunk, (i + 1) * chunk), age, doc);
      writeCookie(key + '.n', String(n), age, doc);
      try { local?.removeItem(key); } catch {}
    },
    removeItem(key) {
      clear(key); writeCookie(key + '.n', '', 0, doc);
      try { local?.removeItem(key); } catch {}
    },
  };
}

// The local profile (no server): {id, name}, one year.
const LOCAL = 'tj_player';
export function localProfile(doc = globalThis.document) {
  try { const v = readCookie(LOCAL, doc); if (!v) return null; const p = JSON.parse(decodeURIComponent(v)); return p && typeof p.name === 'string' && p.name ? p : null; } catch { return null; }
}
export function saveLocalProfile(name, doc = globalThis.document) {
  const clean = String(name || '').replace(/[<>"'`]/g, '').trim().slice(0, 40);
  if (clean.length < 2) return null;
  const p = {id: localProfile(doc)?.id || (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)), name: clean};
  writeCookie(LOCAL, encodeURIComponent(JSON.stringify(p)), 365 * DAY, doc);
  return p;
}
export function forgetLocalProfile(doc = globalThis.document) { writeCookie(LOCAL, '', 0, doc); }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const emailOk = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

// Shows the window when nobody is signed in; resolves true once the player is in (or false if the window is closed).
// `ui` is the page's modal: {show(html), close(), root()} — the legacy home page passes its own.
export async function requireAccount(db, ui) {
  if (db) { try { const {data} = await db.auth.getSession(); if (data?.session?.user) return true; } catch {} }
  else if (localProfile()) return true;
  return new Promise(resolve => {
    let done = false;
    const finish = ok => { if (done) return; done = true; ui.close(); resolve(ok); };
    const field = (id, label, type = 'text', extra = '') => `<label class="field">${label}<input id="${id}" type="${type}" ${extra}></label>`;
    const err = msg => { const el = ui.root().querySelector('#acc-error'); if (el) el.textContent = msg; };
    const busy = on => ui.root().querySelectorAll('#acc button').forEach(b => { b.disabled = on; });
    if (!db) {
      ui.show(`<div id="acc"><div class="eyebrow">ЖЕКЕ КАБИНЕТ</div><h2>Ойыншы аты</h2>
        <p>Сервер әлі бапталмаған, сондықтан онлайн-аккаунт жасау мүмкін емес. Атыңды жаз — ол осы құрылғыда сақталады, келесі жолы қайта сұралмайды.</p>
        ${field('acc-name', 'Атың', 'text', 'maxlength="40" autocomplete="nickname"')}
        <div id="acc-error" role="alert" class="muted"></div>
        <div class="actions"><button class="primary" id="acc-local">Ойынға кіру</button><button class="outline" id="acc-cancel">Жабу</button></div></div>`);
      const go = () => { const p = saveLocalProfile(ui.root().querySelector('#acc-name').value); if (!p) return err('Атың кемінде 2 әріп болсын.'); finish(true); };
      ui.root().querySelector('#acc-local').onclick = go;
      ui.root().querySelector('#acc-name').onkeydown = e => { if (e.key === 'Enter') go(); };
      ui.root().querySelector('#acc-cancel').onclick = () => finish(false);
      ui.root().querySelector('#acc-name').focus();
      return;
    }
    const render = mode => {
      const reg = mode === 'register';
      ui.show(`<div id="acc"><div class="eyebrow">ЖЕКЕ КАБИНЕТ</div><h2>${reg ? 'Тіркелу' : 'Кіру'}</h2>
        <div class="tabs"><button class="${reg ? 'outline' : 'primary'}" id="acc-tab-login">Кіру</button><button class="${reg ? 'primary' : 'outline'}" id="acc-tab-reg">Тіркелу</button></div>
        ${reg ? field('acc-name', 'Атың', 'text', 'maxlength="40" autocomplete="name"') : ''}
        ${field('acc-email', 'Электрондық пошта', 'email', 'autocomplete="email"')}
        ${field('acc-pass', 'Құпия сөз', 'password', `minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}"`)}
        <div id="acc-error" role="alert" class="muted"></div>
        <div class="actions"><button class="primary" id="acc-go">${reg ? 'Тіркелу' : 'Кіру'}</button><button class="outline" id="acc-google">Google арқылы</button><button class="outline" id="acc-cancel">Жабу</button></div>
        <p class="muted">Бір рет кірсең жеткілікті: келесі жолы осы браузерде өзі есіне сақтайды.</p></div>`);
      const $ = s => ui.root().querySelector(s);
      $('#acc-tab-login').onclick = () => render('login'); $('#acc-tab-reg').onclick = () => render('register');
      $('#acc-cancel').onclick = () => finish(false);
      $('#acc-google').onclick = async () => { busy(true); const {error} = await db.auth.signInWithOAuth({provider: 'google', options: {redirectTo: location.origin + location.pathname}}); if (error) { busy(false); err(error.message); } };
      const go = async () => {
        const email = $('#acc-email').value.trim(), password = $('#acc-pass').value, name = reg ? $('#acc-name').value.trim().slice(0, 40) : '';
        if (!emailOk(email)) return err('Поштаны дұрыс жаз.');
        if (password.length < 6) return err('Құпия сөз кемінде 6 таңба болсын.');
        if (reg && name.length < 2) return err('Атың кемінде 2 әріп болсын.');
        busy(true); err('');
        try {
          if (reg) {
            const {data, error} = await db.auth.signUp({email, password, options: {data: {full_name: name}, emailRedirectTo: location.origin + location.pathname}});
            if (error) throw error;
            if (!data.session) { busy(false); return ui.show(`<div id="acc"><div class="eyebrow">ЖЕКЕ КАБИНЕТ</div><h2>Поштаңды тексер</h2><p>${esc(email)} адресіне растау хаты жіберілді. Сілтемені басқан соң осы бетке оралып, «Кіру» арқылы кір.</p><div class="actions"><button class="primary" id="acc-back">Кіру</button></div></div>`), ui.root().querySelector('#acc-back').onclick = () => render('login'); }
          } else {
            const {error} = await db.auth.signInWithPassword({email, password});
            if (error) throw error;
          }
          finish(true);
        } catch (e) {
          busy(false);
          const m = String(e?.message || e);
          err(/invalid login/i.test(m) ? 'Пошта не құпия сөз қате.' : /already registered/i.test(m) ? 'Бұл пошта тіркелген — «Кіру» арқылы кір.' : /confirm/i.test(m) ? 'Алдымен поштадағы растау сілтемесін бас.' : m);
        }
      };
      $('#acc-go').onclick = go;
      $('#acc-pass').onkeydown = e => { if (e.key === 'Enter') go(); };
      (reg ? $('#acc-name') : $('#acc-email')).focus();
    };
    render('login');
  });
}

// The account session in cookies (src/account.js): a Supabase session is several KB, more than one cookie, so it is
// chunked; it survives a "reload" (a new adapter over the same cookies), is removed cleanly, and an older session kept
// in localStorage is still read. The local profile (no server) is a name only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cookieStorage, localProfile, saveLocalProfile, forgetLocalProfile} from '../src/account.js';

// A minimal document.cookie: name=value pairs; Max-Age=0 deletes.
function fakeDoc() {
  const jar = new Map();
  return {jar, get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; '); },
    set cookie(s) { const [pair, ...attrs] = s.split('; '); const i = pair.indexOf('='), k = pair.slice(0, i), v = pair.slice(i + 1);
      if (attrs.some(a => a === 'Max-Age=0')) jar.delete(k); else jar.set(k, v); }};
}
const fakeLocal = () => { const m = new Map(); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)}; };

test('a large session is chunked into cookies and read back after a reload', () => {
  const doc = fakeDoc(), local = fakeLocal();
  const session = JSON.stringify({access_token: 'x'.repeat(1400), refresh_token: 'r'.repeat(40), user: {id: 'u1', email: 'a@b.kz', user_metadata: {full_name: 'Айдар Ақынов'}}, pad: 'й'.repeat(900)});
  cookieStorage({doc, local}).setItem('sb-key', session);
  assert(+doc.jar.get('sb-key.n') >= 2, 'split into several cookies');
  for (const [k, v] of doc.jar) assert(v.length <= 3000, `cookie ${k} fits`);
  assert.equal(cookieStorage({doc, local}).getItem('sb-key'), session, 'the same session after a reload');
  cookieStorage({doc, local}).setItem('sb-key', 'short');
  assert.equal(doc.jar.get('sb-key.n'), '1'); assert(!doc.jar.has('sb-key.1'), 'stale chunks removed');
  cookieStorage({doc, local}).removeItem('sb-key');
  assert.equal(cookieStorage({doc, local}).getItem('sb-key'), null); assert.equal(doc.jar.size, 0);
});

test('an older session in localStorage is still read, then moved to cookies', () => {
  const doc = fakeDoc(), local = fakeLocal();
  local.setItem('sb-key', '{"old":1}');
  const st = cookieStorage({doc, local});
  assert.equal(st.getItem('sb-key'), '{"old":1}');
  st.setItem('sb-key', '{"new":1}');
  assert.equal(local.getItem('sb-key'), null); assert.equal(cookieStorage({doc, local}).getItem('sb-key'), '{"new":1}');
});

test('the local profile keeps a clean name and can be forgotten', () => {
  const doc = fakeDoc();
  assert.equal(localProfile(doc), null);
  assert.equal(saveLocalProfile(' a ', doc), null, 'too short');
  const p = saveLocalProfile('<b>Дана</b>', doc);
  assert.equal(p.name, 'bДана/b'); assert.deepEqual(localProfile(doc), p);
  assert.equal(saveLocalProfile('Ерлан', doc).id, p.id, 'the same player keeps the id');
  forgetLocalProfile(doc); assert.equal(localProfile(doc), null);
});

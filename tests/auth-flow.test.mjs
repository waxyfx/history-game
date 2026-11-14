import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';

// Same client options as src/api.js. No network: skipBrowserRedirect returns the provider URL.
test('Google sign-in uses Supabase Auth with PKCE and returns to the current page', async () => {
  const store = new Map();
  const storage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k)};
  const db = createClient('https://project-ref.supabase.co', 'sb_publishable_test', {auth: {flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage}});
  const {data, error} = await db.auth.signInWithOAuth({provider: 'google', options: {redirectTo: 'http://127.0.0.1:5173/', skipBrowserRedirect: true}});
  assert.equal(error, null);
  const url = new URL(data.url);
  assert.equal(url.origin + url.pathname, 'https://project-ref.supabase.co/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.equal(url.searchParams.get('redirect_to'), 'http://127.0.0.1:5173/');
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  assert(url.searchParams.get('code_challenge').length >= 43);
  assert([...store.keys()].some(k => k.endsWith('-code-verifier')), 'PKCE verifier kept locally, never in the URL');
  const api = await readFile(new URL('../src/api.js', import.meta.url), 'utf8');
  assert.match(api, /flowType:'pkce'/); assert.match(api, /provider:'google'/);
  assert.doesNotMatch(api, /service_role|SERVICE_ROLE/);
});

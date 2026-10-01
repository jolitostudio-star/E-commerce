import test from 'node:test';
import assert from 'node:assert/strict';
import { protect, accountCookie } from '../api/_account.js';
import { GET, POST } from '../api/account.js';
import { seal } from '../api/_auth.js';
import { leadCookie } from '../api/_lead.js';

process.env.SESSION_SECRET = 'test-secret-at-least-thirty-two-characters';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
const origin = 'https://example.com';
const session = { access_token: 'valid', refresh_token: 'refresh', expires_at: Date.now()/1000+3600 };
const request = (cookie = '', options = {}) => new Request(origin + '/api/account', { ...options, headers: { cookie, origin, ...options.headers } });
const savedFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = savedFetch; });

test('API blocks anonymous requests before running business logic', async () => {
  let called = false;
  const response = await protect(() => { called = true; return Response.json({}); })(request());
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test('anonymous demo reads only its own saved reference without accessing Auth', async () => {
  globalThis.fetch = async () => { throw new Error('Anonymous demo must not call Auth'); };
  const cookie = leadCookie(new Request(origin), 'https://meli.la/example').split(';')[0];
  const response = await GET(new Request(origin + '/api/account?view=lead', { headers: { cookie } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { pendingListing:'https://meli.la/example' });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('anonymous demo cannot read a forged reference or a protected dashboard', async () => {
  const response = await GET(new Request(origin + '/api/account?view=lead', { headers: { cookie:'miq_lead=forged' } }));
  assert.deepEqual(await response.json(), {pendingListing:null});
  assert.equal((await GET(new Request(origin + '/api/account?view=app'))).status,303);
});
test('protected dashboard redirects anonymous users', async () => {
  const response = await GET(new Request(origin + '/api/account?view=app'));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/login');
});
test('rejects forged cookies and tokens rejected by Supabase', async () => {
  assert.equal((await GET(request('miq_account=forged'))).status, 401);
  globalThis.fetch = async () => Response.json({ message: 'Invalid token' }, { status: 401 });
  assert.equal((await GET(request('miq_account=' + encodeURIComponent(seal(session))))).status, 401);
});
test('validates users with Supabase before rendering dashboard', async () => {
  globalThis.fetch = async url => {
    assert.match(String(url), /\/auth\/v1\/user/);
    return Response.json({ id: 'owner', email: 'owner@example.com' });
  };
  const response = await GET(new Request(origin + '/api/account?view=app', { headers: { cookie: 'miq_account=' + encodeURIComponent(seal(session)) } }));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /window.accountId="owner"/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
test('renews expired sessions and returns a protected cookie', async () => {
  globalThis.fetch = async url => String(url).includes('/token')
    ? Response.json({ ...session, expires_in: 3600, token_type: 'bearer', user: { id: 'owner' } })
    : Response.json({ id: 'owner' });
  const response = await GET(request('miq_account=' + encodeURIComponent(seal({ ...session, expires_at: 1 }))));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
});
test('rejects cross-origin login and mutation without Origin', async () => {
  for (const badOrigin of ['https://attacker.com', '']) {
    const response = await POST(request('', { method: 'POST', headers: { origin: badOrigin }, body: '{}' }));
    assert.equal(response.status, 403);
  }
});
test('login creates session cookie without returning tokens', async () => {
  globalThis.fetch = async () => Response.json({ ...session, expires_in: 3600, user: { id: 'owner' } });
  const response = await POST(request('', { method: 'POST', body: JSON.stringify({ action: 'login', email: 'owner@example.com', password: 'test-password' }) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).signedIn, true);
  assert.match(response.headers.get('set-cookie'), /miq_account=/);
  assert.match(response.headers.get('set-cookie'), /ml_session=;.*Max-Age=0/);
});
test('signup requiring confirmation creates no session', async () => {
  globalThis.fetch = async () => Response.json({ id: 'owner', email: 'owner@example.com', identities: [] });
  const response = await POST(request('', { method: 'POST', body: JSON.stringify({ action: 'signup', email: 'owner@example.com', password: 'test-password' }) }));
  assert.equal((await response.json()).signedIn, false);
  assert.equal(response.headers.get('set-cookie'), null);
});
test('session cookies support localhost and require Secure on HTTPS', () => {
  assert.match(accountCookie(request(), session), /; Secure$/);
  assert.doesNotMatch(accountCookie(new Request('http://localhost:3000'), session), /Secure/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { seal } from '../api/_auth.js';
import { mercadoLivreSession } from '../api/_session.js';

process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-bytes';

function requestWith(session) {
  const headers = session ? { cookie: `ml_session=${encodeURIComponent(seal(session))}` } : {};
  return new Request('http://localhost/api/ml/listings', { headers });
}

async function withEnv(values, fn) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.entries(values).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value);
  try { return await fn(); } finally {
    Object.entries(previous).forEach(([key, value]) => value === undefined ? delete process.env[key] : process.env[key] = value);
  }
}

async function withFetch(mock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

test('usa o token da sessão enquanto ele é válido', async () => {
  const session = await mercadoLivreSession(requestWith({ access_token: 'A', refresh_token: 'R', expires_at: Date.now() + 3600000 }));
  assert.equal(session.token, 'A');
  assert.equal(session.cookie, null);
});

test('mantém o token atual se a renovação falhar antes do vencimento', async () => {
  await withFetch(async () => Response.json({ error: 'invalid_grant' }, { status: 400 }), async () => {
    const session = await mercadoLivreSession(requestWith({ access_token: 'A', refresh_token: 'R', expires_at: Date.now() + 30000 }));
    assert.equal(session.token, 'A');
  });
});

test('pede nova conexão quando o token venceu e a renovação falha', async () => {
  await withFetch(async () => Response.json({ error: 'invalid_grant' }, { status: 400 }), async () => {
    await assert.rejects(
      mercadoLivreSession(requestWith({ access_token: 'A', refresh_token: 'R', expires_at: Date.now() - 1000 })),
      error => error.status === 401 && error.code === 'ML_SESSION_EXPIRED'
    );
  });
});

test('token de desenvolvimento só vale fora da Vercel', async () => {
  await withEnv({ ML_ACCESS_TOKEN: 'DEV', VERCEL: undefined }, async () => {
    assert.equal((await mercadoLivreSession(requestWith(null))).token, 'DEV');
  });
  await withEnv({ ML_ACCESS_TOKEN: 'DEV', VERCEL: '1' }, async () => {
    assert.equal((await mercadoLivreSession(requestWith(null))).token, '');
  });
});

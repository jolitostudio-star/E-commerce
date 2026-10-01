import assert from 'node:assert/strict';
import test from 'node:test';
import { cookie, seal, unseal } from '../api/_auth.js';

test('protege e recupera a sessão OAuth', () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-bytes';
  try {
    const payload = { access_token: 'access', refresh_token: 'refresh', user_id: 123 };
    const encrypted = seal(payload);
    assert.doesNotMatch(encrypted, /access|refresh/);
    assert.deepEqual(unseal(encrypted), payload);
    assert.equal(unseal(encrypted + 'alterado'), null);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test('gera cookie de sessão com proteções do navegador', () => {
  const value = cookie('ml_session', 'valor', 60);
  assert.match(value, /HttpOnly/);
  assert.match(value, /Secure/);
  assert.match(value, /SameSite=Lax/);
  assert.match(value, /Max-Age=60/);
});

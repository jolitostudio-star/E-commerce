import assert from 'node:assert/strict';
import test from 'node:test';
import { seal } from '../api/_auth.js';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
const originalFetch = globalThis.fetch;
const request = url => new Request(url, { headers: { cookie: 'miq_account=' + encodeURIComponent(seal({ access_token: 'valid', refresh_token: 'refresh', expires_at: Math.floor(Date.now()/1000)+3600 })) } });
test.before(() => { globalThis.fetch = async () => Response.json({ id: 'test-user', email: 'test@example.com' }); });
test.after(() => { globalThis.fetch = originalFetch; });
import { GET, POST } from '../api/oauth.js';

process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-bytes';
process.env.ML_CLIENT_ID = '123';
process.env.ML_CLIENT_SECRET = 'segredo';
process.env.ML_REDIRECT_URI = 'https://exemplo.vercel.app/integracao/mercadolivre/retorno';

test('encaminha a conexão do Mercado Livre pela função única de OAuth', async () => {
  const response = await GET(request('https://exemplo.vercel.app/api/oauth?provider=mercadolivre&step=connect'));
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /^https:\/\/auth\.mercadolivre\.com\.br\/authorization\?/);
});

test('mantém a query original do retorno junto com canal e etapa', async () => {
  // Sem o cookie da tentativa, o callback recusa; isso prova que chegou ao handler certo com o code.
  const response = await GET(request('https://exemplo.vercel.app/api/oauth?provider=mercadolivre&step=callback&code=X&state=Y'));
  assert.equal(response.status, 400);
  assert.equal(await response.text(), 'Autorização inválida ou expirada.');
});

test('recusa canal ou etapa desconhecidos', async () => {
  assert.equal((await GET(request('https://exemplo.vercel.app/api/oauth?provider=amazon&step=connect'))).status, 404);
  assert.equal((await GET(request('https://exemplo.vercel.app/api/oauth?provider=mercadolivre&step=finish'))).status, 404);
  assert.equal((await POST(new Request('https://exemplo.vercel.app/api/oauth?provider=mercadolivre&step=connect', { method: 'POST', headers: { origin: 'https://exemplo.vercel.app', cookie: 'miq_account=' + encodeURIComponent(seal({ access_token: 'valid', refresh_token: 'refresh', expires_at: Math.floor(Date.now()/1000)+3600 })) } }))).status, 404);
});

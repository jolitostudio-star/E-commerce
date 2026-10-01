import assert from 'node:assert/strict';
import test from 'node:test';
import { identifyProduct, imageInput, visionAllowed } from '../api/_vision.js';

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function fakeClient(response) {
  const calls = [];
  const options = [];
  return { calls, options, interactions: { create: async (params, requestOptions) => { calls.push(params); options.push(requestOptions); if (response instanceof Error) throw response; return response; } } };
}

test('envia a foto ao Gemini e devolve o texto de busca', async () => {
  const client = fakeClient({
    output_text: JSON.stringify({ identified: true, query: 'maquina de cortar cabelo dragon t9', name: 'Máquina de cortar cabelo Dragon T9', brand: 'Dragon', model: 'T9', confidence: 'alta', note: 'confira se é sem fio' })
  });
  const result = await identifyProduct({ mediaType: 'image/png', data: PIXEL }, { client });
  assert.equal(result.query, 'maquina de cortar cabelo dragon t9');
  assert.equal(result.confidence, 'alta');
  const params = client.calls[0];
  assert.equal(params.model, 'gemini-3.8-flash');
  assert.equal(params.store, false);
  assert.equal(params.response_format.mime_type, 'application/json');
  assert.deepEqual(params.input[1], { type: 'image', data: PIXEL, mime_type: 'image/png' });
  assert.deepEqual(client.options[0].retries, { strategy: 'none' });
});

test('trata foto sem produto, bloqueio e limite da cota gratuita', async () => {
  const empty = fakeClient({ output_text: JSON.stringify({ identified: false, query: '', name: '', brand: '', model: '', confidence: 'baixa', note: 'foto escura' }) });
  assert.equal((await identifyProduct({ mediaType: 'image/png', data: PIXEL }, { client: empty })).identified, false);
  const blocked = fakeClient({ output_text: '' });
  await assert.rejects(identifyProduct({ mediaType: 'image/png', data: PIXEL }, { client: blocked }), error => error.code === 'VISION_REFUSED');
  const limited = fakeClient(Object.assign(new Error('quota'), { status: 429 }));
  await assert.rejects(identifyProduct({ mediaType: 'image/png', data: PIXEL }, { client: limited }), error => error.status === 429 && error.code === 'VISION_RATE_LIMIT');
  const badKey = fakeClient(Object.assign(new Error('bad'), { status: 400 }));
  await assert.rejects(identifyProduct({ mediaType: 'image/png', data: PIXEL }, { client: badKey }), error => error.code === 'VISION_NOT_CONFIGURED');
});

test('valida o formato e o tamanho da foto', () => {
  assert.throws(() => imageInput({ mediaType: 'image/gif', data: PIXEL }), error => error.code === 'INVALID_IMAGE');
  assert.throws(() => imageInput({ mediaType: 'image/jpeg', data: 'não é base64' }), error => error.code === 'INVALID_IMAGE');
  assert.throws(() => imageInput({ mediaType: 'image/jpeg', data: 'A'.repeat(6 * 1024 * 1024) }), error => error.code === 'IMAGE_TOO_LARGE');
  assert.equal(imageInput({ mediaType: 'image/jpeg', data: `data:image/jpeg;base64,${PIXEL}` }).data, PIXEL);
});

test('restringe a foto às contas autorizadas quando configurado', () => {
  const previous = process.env.VISION_ALLOWED_ML_USERS;
  try {
    delete process.env.VISION_ALLOWED_ML_USERS;
    assert.equal(visionAllowed(1), true);
    process.env.VISION_ALLOWED_ML_USERS = '130618215, 42';
    assert.equal(visionAllowed(130618215), true);
    assert.equal(visionAllowed(7), false);
  } finally {
    if (previous === undefined) delete process.env.VISION_ALLOWED_ML_USERS;
    else process.env.VISION_ALLOWED_ML_USERS = previous;
  }
});

test('com o Gemini sobrecarregado (503) tenta uma vez outro modelo', async () => {
  const models = [];
  let calls = 0;
  const client = { interactions: { create: async params => {
    models.push(params.model); calls++;
    if (calls === 1) throw Object.assign(new Error('high demand'), { status: 503 });
    return { output_text: JSON.stringify({ identified: true, query: 'luminaria coluna grega', name: 'Luminária', brand: '', model: '', confidence: 'media', note: '' }) };
  } } };
  const result = await identifyProduct({ mediaType: 'image/png', data: PIXEL }, { client });
  assert.equal(result.query, 'luminaria coluna grega');
  assert.deepEqual(models, ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);

  const busy = { interactions: { create: async () => { throw Object.assign(new Error('high demand'), { status: 503 }); } } };
  await assert.rejects(identifyProduct({ mediaType: 'image/png', data: PIXEL }, { client: busy }), error => error.code === 'VISION_BUSY' && error.status === 503);
});

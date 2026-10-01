import assert from 'node:assert/strict';
import test from 'node:test';
import { applyBulkPriceDiscount, catalogWinner, listSellerItems } from '../api/_ml.js';

function response(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), { status });
}

test('sincroniza e normaliza anúncios do vendedor', async () => {
  const fetchMock = async url => {
    const path = new URL(url).pathname;
    if (path === '/users/me') return response({ id: 42, nickname: 'LOJA', seller_reputation: { level_id: '5_green' } });
    if (path === '/users/42/items/search') return response({ results: ['MLB1'], paging: { total: 1 } });
    if (path === '/items/MLB1') return response({
      id: 'MLB1', title: 'Produto real', price: 99.9, available_quantity: 7, sold_quantity: 3,
      status: 'active', condition: 'new', listing_type_id: 'gold_special', seller_custom_field: 'SKU-1',
      shipping: { free_shipping: true }, permalink: 'https://produto.mercadolivre.com.br/MLB1'
    });
    assert.fail(`URL inesperada: ${url}`);
  };
  const result = await listSellerItems('token', { fetch: fetchMock });
  assert.equal(result.seller.nickname, 'LOJA');
  assert.equal(result.items[0].sku, 'SKU-1');
  assert.equal(result.items[0].price, 99.9);
  assert.equal(result.items[0].freeShipping, true);
});

test('aplica desconto individual em vários anúncios', async () => {
  const calls = [];
  const fetchMock = async (url, options) => {
    const path = new URL(url).pathname;
    if (options.method === 'GET') return response({ id: path.split('/').at(-1), price: 100 });
    calls.push({ path, body: JSON.parse(options.body) });
    return response({ price: 90, original_price: 100 });
  };
  const result = await applyBulkPriceDiscount('token', {
    itemIds: ['MLB1', 'MLB2'], discount: 10, startDate: '2026-09-26', finishDate: '2026-10-05'
  }, { fetch: fetchMock, today: '2026-09-25' });
  assert.equal(result.applied, 2);
  assert.equal(result.failed, 0);
  assert.equal(calls[0].body.deal_price, 90);
  assert.equal(calls[0].body.promotion_type, 'PRICE_DISCOUNT');
});

test('bloqueia desconto ou duração fora dos limites', async () => {
  await assert.rejects(
    applyBulkPriceDiscount('token', { itemIds: ['MLB1'], discount: 2, startDate: '2026-09-26', finishDate: '2026-09-30' }),
    error => error.code === 'INVALID_DISCOUNT'
  );
  await assert.rejects(
    applyBulkPriceDiscount('token', { itemIds: ['MLB1'], discount: 10, startDate: '2026-09-01', finishDate: '2026-09-30' }),
    error => error.code === 'INVALID_DATES'
  );
});

test('bloqueia promoção com início no passado', async () => {
  await assert.rejects(
    applyBulkPriceDiscount('token', { itemIds: ['MLB1'], discount: 10, startDate: '2026-09-20', finishDate: '2026-09-27' }, {
      today: '2026-09-25',
      fetch: async () => assert.fail('não deveria chamar a API')
    }),
    error => error.code === 'INVALID_DATES'
  );
});

test('sincroniza os anúncios disponíveis mesmo se um deles falhar', async () => {
  const fetchMock = async url => {
    const path = new URL(url).pathname;
    if (path === '/users/me') return response({ id: 42, nickname: 'LOJA' });
    if (path === '/users/42/items/search') return response({ results: ['MLB1', 'MLB2'], paging: { total: 2 } });
    if (path === '/items/MLB1') return response({ id: 'MLB1', title: 'Ok', price: 10 });
    return response({ message: 'erro temporário' }, 500);
  };
  const result = await listSellerItems('token', { fetch: fetchMock });
  assert.deepEqual(result.items.map(item => item.id), ['MLB1']);
  assert.equal(result.unavailable, 1);
});

test('interrompe a sincronização quando o acesso expira', async () => {
  const fetchMock = async url => {
    const path = new URL(url).pathname;
    if (path === '/users/me') return response({ id: 42 });
    if (path === '/users/42/items/search') return response({ results: ['MLB1'] });
    return response({ message: 'invalid token' }, 401);
  };
  await assert.rejects(listSellerItems('token', { fetch: fetchMock }), error => error.status === 401);
});

test('usa a oferta mais barata do catálogo quando não há buy_box_winner', async () => {
  const fetchMock = async url => {
    assert.equal(new URL(url).pathname, '/products/MLB19/items');
    return response({ results: [{ item_id: 'MLB2', price: 120 }, { item_id: 'MLB1', price: 99.9 }, { item_id: 'MLB3', price: 0 }] });
  };
  assert.deepEqual(await catalogWinner({ id: 'MLB19', buy_box_winner: null }, 'token', { fetch: fetchMock }), { item_id: 'MLB1', price: 99.9 });
  const winner = { item_id: 'MLB7', price: 50 };
  assert.equal(await catalogWinner({ id: 'MLB19', buy_box_winner: winner }, 'token', { fetch: () => assert.fail('não deveria buscar ofertas') }), winner);
  assert.equal(await catalogWinner({ id: 'MLB19' }, 'token', { fetch: async () => response({ message: 'not found' }, 404) }), null);
});

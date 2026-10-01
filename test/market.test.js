import assert from 'node:assert/strict';
import test from 'node:test';
import { researchMercadoLivre } from '../api/_market.js';

function product(id, price) {
  return {
    id,
    name: `Produto ${id}`,
    buy_box_winner: {
      item_id: `MLB${id}`,
      price,
      official_store_name: `Loja ${id}`,
      shipping: { free_shipping: id === '2' },
      permalink: `https://produto.mercadolivre.com.br/MLB${id}`
    }
  };
}

test('calcula estatísticas usando ofertas vencedoras do catálogo', async () => {
  let searchUrl;
  const fetchMock = async url => {
    if (url.pathname === '/products/search') {
      searchUrl = url;
      return new Response(JSON.stringify({ results: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }] }));
    }
    const id = url.pathname.split('/').at(-1);
    const prices = { 1: 80, 2: 100, 3: 120, 4: 140 };
    return new Response(JSON.stringify(product(id, prices[id])));
  };
  const result = await researchMercadoLivre('fone bluetooth', 50, 'token', { fetch: fetchMock });
  assert.equal(searchUrl.searchParams.get('q'), 'fone bluetooth');
  assert.equal(searchUrl.searchParams.get('site_id'), 'MLB');
  assert.equal(searchUrl.pathname, '/products/search');
  assert.equal(result.source, 'mercado_livre_catalog');
  assert.equal(result.sampleSize, 4);
  assert.equal(result.stats.min, 80);
  assert.equal(result.stats.max, 140);
  assert.equal(result.stats.avg, 110);
  assert.ok(result.rec.point >= 50 / (1 - 0.119 - 0.25));
});

test('recusa pesquisa sem credencial', async () => {
  await assert.rejects(
    researchMercadoLivre('produto', 0, '', { fetch: async () => assert.fail('não deveria chamar a API') }),
    error => error.code === 'ML_NOT_CONNECTED' && error.status === 401
  );
});

test('informa quando nenhum produto do catálogo tem oferta ativa', async () => {
  const fetchMock = async url => url.pathname === '/products/search'
    ? new Response(JSON.stringify({ results: [{ id: '1' }] }))
    : new Response(JSON.stringify({ id: '1', name: 'Produto sem oferta', buy_box_winner: null }));
  await assert.rejects(
    researchMercadoLivre('produto', 0, 'token', { fetch: fetchMock }),
    error => error.code === 'INSUFFICIENT_RESULTS' && error.status === 404
  );
});

test('usa a comissão e a margem-alvo informadas no preço mínimo', async () => {
  const fetchMock = async url => url.pathname === '/products/search'
    ? new Response(JSON.stringify({ results: [{ id: '1' }] }))
    : new Response(JSON.stringify(product('1', 20)));
  const result = await researchMercadoLivre('produto', 60, 'token', { fetch: fetchMock, commission: '20', target: '30' });
  assert.equal(result.commission, 0.2);
  assert.equal(result.target, 0.3);
  assert.equal(result.floor, 120);
  assert.equal(result.rec.point, 120);
});

test('ignora produtos cuja consulta de detalhes falha', async () => {
  const fetchMock = async url => {
    if (url.pathname === '/products/search') return new Response(JSON.stringify({ results: [{ id: '1' }, { id: '2' }] }));
    if (url.pathname.endsWith('/2')) throw new Error('timeout');
    return new Response(JSON.stringify(product('1', 50)));
  };
  const result = await researchMercadoLivre('produto', 0, 'token', { fetch: fetchMock });
  assert.equal(result.sampleSize, 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { competitionLevel, getTrends, keywordInsight, opportunityOf, priceBand } from '../api/_radar.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('classifica as 50 tendências nos grupos oficiais', async () => {
  let path;
  const fetchMock = async url => {
    path = new URL(url).pathname;
    return json(Array.from({ length: 50 }, (_, index) => ({ keyword: `termo ${index + 1}`, url: 'https://lista.mercadolivre.com.br/x' })));
  };
  const result = await getTrends('token', { fetch: fetchMock, category: 'MLB1051' });
  assert.equal(path, '/trends/MLB/MLB1051');
  assert.equal(result.trends.length, 50);
  assert.equal(result.trends[0].group, 'growth');
  assert.equal(result.trends[9].group, 'growth');
  assert.equal(result.trends[10].group, 'desired');
  assert.equal(result.trends[29].group, 'desired');
  assert.equal(result.trends[30].group, 'popular');
});

test('recusa categoria com formato inválido', async () => {
  await assert.rejects(
    getTrends('token', { category: '../users/me', fetch: async () => assert.fail('não deveria chamar a API') }),
    error => error.code === 'INVALID_CATEGORY'
  );
});

test('mede concorrência e faixa de preço de um termo', async () => {
  const fetchMock = async url => {
    const { pathname } = new URL(url);
    if (pathname.includes('domain_discovery')) return json([{ category_id: 'MLB1', category_name: 'Fones', domain_name: 'Fones de ouvido' }]);
    if (pathname === '/products/search') return json({ results: [{ id: 'P1' }, { id: 'P2' }], paging: { total: 20 } });
    const price = pathname.endsWith('P1') ? 40 : 60;
    return json({ buy_box_winner: { price, shipping: { logistic_type: 'drop_off' } } });
  };
  const result = await keywordInsight('token', 'fone bluetooth', { fetch: fetchMock });
  assert.equal(result.category.name, 'Fones');
  assert.equal(result.competition.level, 'Baixa');
  assert.equal(result.prices.min, 40);
  assert.equal(result.priceBand, 'Até R$ 50');
});

test('regras de concorrência, oportunidade e faixa de preço', () => {
  assert.equal(competitionLevel(10, 0), 'Baixa');
  assert.equal(competitionLevel(10, 0.6), 'Média');
  assert.equal(competitionLevel(1000, 0), 'Alta');
  assert.equal(opportunityOf('growth', 'Baixa').label, 'Promissora');
  assert.equal(opportunityOf('popular', 'Alta').label, 'Disputada');
  assert.equal(priceBand(600), 'Acima de R$ 500');
});

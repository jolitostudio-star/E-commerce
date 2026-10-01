import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePurchase, purchaseInput, relevantOffers, withoutOutliers } from '../api/_purchase.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Catálogo com três ofertas (R$ 90, 100 e 110), tarifa de 12% + R$ 0 e frete grátis cotado em R$ 20.
function mercadoLivre({ prices = [90, 100, 110], shipping = 20, fee = 0.12, fixed = 0, trends = [] } = {}) {
  const calls = [];
  const fetchMock = async url => {
    const parsed = new URL(url);
    calls.push(parsed);
    const path = parsed.pathname;
    if (path === '/products/search') return json({ results: prices.map((_, index) => ({ id: `MLB${index + 1}` })) });
    if (path.startsWith('/products/MLB')) {
      const index = Number(path.slice('/products/MLB'.length)) - 1;
      return json({ id: `MLB${index + 1}`, name: `Máquina de corte ${index + 1}`, buy_box_winner: { item_id: `MLB9${index}`, price: prices[index], category_id: 'MLB1234' } });
    }
    if (path === '/users/me') return json({ id: 42 });
    if (path === '/sites/MLB/listing_prices') {
      const price = Number(parsed.searchParams.get('price'));
      return json({ listing_type_id: 'gold_special', sale_fee_amount: price * fee + fixed, sale_fee_details: { percentage_fee: fee * 100, fixed_fee: fixed } });
    }
    if (path === '/users/42/shipping_options/free') {
      return shipping === null ? json({ message: 'erro' }, 500) : json({ coverage: { all_country: { list_cost: shipping } } });
    }
    if (path === '/trends/MLB') return json(trends);
    assert.fail(`URL inesperada: ${url}`);
  };
  return { fetch: fetchMock, calls };
}

test('reconhece código de barras e aplica padrões do formulário', () => {
  const input = purchaseInput({ query: '7891234567895', cost: '25,50', size: 'medio' });
  assert.equal(input.gtin, '7891234567895');
  assert.equal(input.query, '');
  assert.equal(input.cost, 25.5);
  assert.equal(input.packaging, 3);
  assert.equal(input.target, 0.25);
  assert.equal(purchaseInput({ query: 'maquina dragao 2024' }).gtin, '');
});

test('busca o código de barras no catálogo pelo product_identifier', async () => {
  const ml = mercadoLivre();
  await evaluatePurchase('token', { query: '7891234567895', cost: 30 }, { fetch: ml.fetch });
  const search = ml.calls.find(url => url.pathname === '/products/search');
  assert.equal(search.searchParams.get('product_identifier'), '7891234567895');
  assert.equal(search.searchParams.get('q'), null);
});

test('diz que compensa quando a margem no preço de mercado passa da meta', async () => {
  const ml = mercadoLivre({ trends: [{ keyword: 'maquina de cortar cabelo' }] });
  const result = await evaluatePurchase('token', { query: 'maquina de cortar cabelo', cost: 30, quantity: 10, size: 'pequeno' }, { fetch: ml.fetch });
  const market = result.scenarios[0];
  // 100 - 12 (tarifa) - 20 (frete) - 1,50 (embalagem) - 30 (custo) = 36,50
  assert.equal(market.price, 100);
  assert.equal(market.profit, 36.5);
  assert.equal(market.margin, 0.365);
  assert.equal(result.verdict.key, 'compensa');
  // 100 × (1 - 0,12 - 0,25) - 20 - 1,50 = 41,50
  assert.equal(result.maxCost, 41.5);
  assert.equal(result.totals.capital, 300);
  assert.equal(result.totals.profit, 365);
  assert.equal(result.trending, 'maquina de cortar cabelo');
  const shippingQuote = ml.calls.find(url => url.pathname === '/users/42/shipping_options/free');
  assert.equal(shippingQuote.searchParams.get('dimensions'), '20x15x10,300');
});

test('abaixo de R$ 79 o vendedor não paga o frete', async () => {
  const ml = mercadoLivre({ prices: [40, 45, 50] });
  const result = await evaluatePurchase('token', { query: 'suporte de celular', cost: 10 }, { fetch: ml.fetch });
  assert.deepEqual(result.scenarios[0].shipping, { amount: 0, source: 'comprador_paga' });
  assert.equal(ml.calls.some(url => url.pathname.includes('shipping_options')), false);
});

test('marca como arriscado quando a margem fica abaixo da meta e como não compensa no prejuízo', async () => {
  const risky = await evaluatePurchase('token', { query: 'maquina de cortar cabelo', cost: 55 }, { fetch: mercadoLivre().fetch });
  assert.equal(risky.verdict.key, 'arriscado');
  const loss = await evaluatePurchase('token', { query: 'maquina de cortar cabelo', cost: 80 }, { fetch: mercadoLivre().fetch });
  assert.equal(loss.verdict.key, 'nao_compensa');
  assert.ok(loss.scenarios[0].profit < 0);
});

test('pede o frete quando a cotação falha e usa o valor informado', async () => {
  const missing = await evaluatePurchase('token', { query: 'maquina de cortar cabelo', cost: 30 }, { fetch: mercadoLivre({ shipping: null }).fetch });
  assert.equal(missing.verdict.key, 'incompleto');
  assert.equal(missing.scenarios[0].profit, null);
  const informed = await evaluatePurchase('token', { query: 'maquina de cortar cabelo', cost: 30, shipping: '18' }, { fetch: mercadoLivre({ shipping: null }).fetch });
  assert.equal(informed.scenarios[0].shipping.source, 'informado');
  assert.equal(informed.scenarios[0].profit, 38.5);
});

test('calcula o preço mínimo sem prejuízo respeitando a regra dos R$ 79', async () => {
  const result = await evaluatePurchase('token', { query: 'maquina de cortar cabelo', cost: 30 }, { fetch: mercadoLivre().fetch });
  // Sem frete: (30 + 1,5) / 0,88 = 35,80, abaixo de R$ 79.
  assert.equal(result.minPrice, 35.8);
  // Com 25% de margem: (31,5) / 0,63 = 50, ainda abaixo de R$ 79.
  assert.equal(result.targetPrice, 50);
});

test('recusa pedido sem produto ou sem custo', async () => {
  await assert.rejects(evaluatePurchase('token', { query: 'ab', cost: 10 }, { fetch: mercadoLivre().fetch }), error => error.code === 'INVALID_QUERY');
  await assert.rejects(evaluatePurchase('token', { query: 'maquina', cost: 0 }, { fetch: mercadoLivre().fetch }), error => error.code === 'INVALID_COST');
});

test('ignora kits, lotes e produtos que não batem com a busca', () => {
  const offer = (title, price) => ({ title, price });
  const offers = [
    offer('Máquina de Cortar Cabelo Dragon T9 Dourada', 35),
    offer('Máquina Cortar Cabelo Dragon Retrô', 49.9),
    offer('Máquina de Cortar Cabelo Dragon Profissional Sem Fio', 59.9),
    offer('Kit Máquina Cortar Cabelo + Barbeador', 169.9),
    offer('Chaveiro Dragão', 7.5)
  ];
  assert.deepEqual(relevantOffers(offers, 'maquina de cortar cabelo dragon').map(o => o.price), [35, 49.9, 59.9]);
  assert.ok(relevantOffers(offers, 'kit maquina de cortar cabelo').some(o => o.price === 169.9));
});

test('descarta preços fora da curva', () => {
  const prices = [30, 32, 35, 38, 150, 5].map(price => ({ title: 'x', price }));
  assert.deepEqual(withoutOutliers(prices).map(o => o.price), [30, 32, 35, 38]);
});

test('pelo código de barras junta as ofertas buscadas pelo nome do produto', async () => {
  const json = body => new Response(JSON.stringify(body));
  const fetchMock = async url => {
    const u = new URL(url); const p = u.pathname;
    if (p === '/products/search') return json({ results: u.searchParams.get('product_identifier') ? [{ id: 'MLB1' }] : [{ id: 'MLB1' }, { id: 'MLB2' }, { id: 'MLB3' }] });
    if (p === '/products/MLB1') return json({ id: 'MLB1', name: 'Leite Condensado Moça 395g', buy_box_winner: { price: 8, category_id: 'MLB1' } });
    if (p === '/products/MLB2') return json({ id: 'MLB2', name: 'Leite Condensado Moça 395g Nestlé', buy_box_winner: { price: 9, category_id: 'MLB1' } });
    if (p === '/products/MLB3') return json({ id: 'MLB3', name: 'Leite Condensado Moça 395g Caixa', buy_box_winner: { price: 10, category_id: 'MLB1' } });
    if (p === '/users/me') return json({ id: 1 });
    if (p === '/sites/MLB/listing_prices') return json({ sale_fee_amount: 1, sale_fee_details: { percentage_fee: 12, fixed_fee: 0 } });
    if (p === '/trends/MLB') return json([]);
    assert.fail(`URL inesperada: ${url}`);
  };
  const result = await evaluatePurchase('token', { query: '7891000100103', cost: 4 }, { fetch: fetchMock });
  assert.equal(result.product.title, 'Leite Condensado Moça 395g');
  assert.equal(result.product.matchedByBarcode, true);
  assert.equal(result.market.sampleSize, 3);
  assert.equal(result.market.med, 9);
});

test('usa o preço de venda informado e mantém o mercado como referência', async () => {
  const result = await evaluatePurchase('token', { query: 'maquina de cortar cabelo', cost: 30, salePrice: '140' }, { fetch: mercadoLivre().fetch });
  assert.equal(result.priceSource, 'manual');
  assert.deepEqual(result.scenarios.map(s => [s.key, s.price]), [['manual', 140], ['mercado', 100]]);
  // 140 - 16,80 (12%) - 20 (frete) - 1,50 - 30 = 71,70
  assert.equal(result.scenarios[0].profit, 71.7);
  assert.equal(result.totals.profit, 71.7);
  assert.ok(result.verdict.reasons.some(reason => /acima da maioria das ofertas/.test(reason)));
});

test('analisa só com o preço informado quando o catálogo não tem ofertas', async () => {
  const base = mercadoLivre();
  const categories = [];
  const fetchMock = async url => {
    const u = new URL(url);
    if (u.pathname === '/products/search') return new Response(JSON.stringify({ results: [] }));
    if (u.pathname === '/sites/MLB/domain_discovery/search') { categories.push(u.searchParams.get('q')); return new Response(JSON.stringify([{ category_id: 'MLB270879' }])); }
    return base.fetch(url);
  };
  await assert.rejects(evaluatePurchase('token', { query: 'kit chave de fenda 30 pontas', cost: 8 }, { fetch: fetchMock }), error => error.code === 'NO_OFFERS');
  const result = await evaluatePurchase('token', { query: 'kit chave de fenda 30 pontas', cost: 8, salePrice: 19.5 }, { fetch: fetchMock });
  assert.equal(result.market, null);
  assert.deepEqual(result.scenarios.map(s => s.key), ['manual']);
  assert.equal(categories[0], 'kit chave de fenda 30 pontas');
  const feeCall = base.calls.find(u => u.pathname === '/sites/MLB/listing_prices');
  assert.equal(feeCall.searchParams.get('category_id'), 'MLB270879');
  assert.ok(result.verdict.reasons.some(reason => /não encontrei ofertas comparáveis/i.test(reason)));
});

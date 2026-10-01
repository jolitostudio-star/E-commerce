import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeListing, analyzeTitle, parseListingRef, resolveShortListingLink, solvePrice } from '../api/_listing.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('entende links e IDs de anúncio', () => {
  assert.deepEqual(parseListingRef('MLB1234567890'), { type: 'item', id: 'MLB1234567890' });
  assert.deepEqual(parseListingRef('https://produto.mercadolivre.com.br/MLB-1234567890-fone-bluetooth-_JM'), { type: 'item', id: 'MLB1234567890' });
  assert.deepEqual(parseListingRef('https://www.mercadolivre.com.br/fone/p/MLB19098163'), { type: 'product', id: 'MLB19098163' });
  assert.deepEqual(parseListingRef('https://www.mercadolivre.com.br/fone/p/MLB19098163?item_id=MLB555555555'), { type: 'item', id: 'MLB555555555' });
  assert.equal(parseListingRef('https://exemplo.com/produto'), null);
});

test('avalia título e encontra termos do segmento que faltam', () => {
  const item = { attributes: [{ id: 'BRAND', value_name: 'Acme' }] };
  const result = analyzeTitle('FONE BLUETOOTH PROMOÇÃO!!!', item, ['Fone Bluetooth Sem Fio TWS', 'Fone Sem Fio TWS Bluetooth 5.3', 'Fone TWS Sem Fio']);
  const failed = result.checks.filter(check => !check.ok).map(check => check.id);
  for (const id of ['length', 'promo', 'caps', 'symbols', 'brand']) assert.ok(failed.includes(id), id);
  assert.ok(result.missingKeywords.includes('tws'));
  assert.ok(result.missingKeywords.includes('sem fio'));
});

test('recalcula o preço mínimo quando a tarifa fixa muda de faixa', async () => {
  // Abaixo de 79: 12% + 6 fixo. A partir de 79: só 12%.
  const feeAt = async price => price < 79 ? { percentage: 0.12, fixed: 6 } : { percentage: 0.12, fixed: 0 };
  assert.equal(await solvePrice(feeAt, 30, 5, 0, 100), 46.59);
  assert.equal(await solvePrice(feeAt, 60, 10, 0, 100), 79.55);
});

function mlMock({ sold = 300, pictures = 3 } = {}) {
  return async url => {
    const { pathname, searchParams } = new URL(url);
    if (pathname === '/items/MLB111111111') return json({
      id: 'MLB111111111', title: 'Fone Bluetooth', price: 100, original_price: 125, seller_id: 9, category_id: 'MLB1',
      listing_type_id: 'gold_special', sold_quantity: sold, date_created: '2026-06-27T00:00:00Z',
      pictures: Array.from({ length: pictures }, (_, index) => ({ id: String(index) })),
      attributes: [{ id: 'BRAND', value_name: 'Acme' }, { id: 'COLOR', value_name: 'Preto' }],
      shipping: { free_shipping: true, logistic_type: 'fulfillment' }
    });
    if (pathname === '/users/9') return json({ nickname: 'CONCORRENTE', seller_reputation: { level_id: '5_green', power_seller_status: 'platinum', transactions: { completed: 5000, ratings: { positive: 0.98 } } } });
    if (pathname === '/users/me') return json({ id: 1, nickname: 'EU', seller_reputation: { level_id: '4_light_green' } });
    if (pathname === '/categories/MLB1') return json({ id: 'MLB1', name: 'Fones de Ouvido', path_from_root: [{ name: 'Eletrônicos' }, { name: 'Fones de Ouvido' }] });
    if (pathname === '/categories/MLB1/attributes') return json([
      { id: 'BRAND', name: 'Marca', tags: { required: true } },
      { id: 'MODEL', name: 'Modelo', tags: { required: true } },
      { id: 'COLOR', name: 'Cor', tags: {} },
      { id: 'ITEM_CONDITION', name: 'Condição', tags: { hidden: true } }
    ]);
    if (pathname === '/sites/MLB/listing_prices') {
      const price = Number(searchParams.get('price'));
      return json({ listing_type_id: 'gold_special', sale_fee_amount: price * 0.16, sale_fee_details: { percentage_fee: 16, fixed_fee: 0 } });
    }
    if (pathname === '/products/search') return json({ results: [{ id: 'P1' }, { id: 'P2' }], paging: { total: 40 } });
    if (pathname.includes('domain_discovery')) return json([{ domain_name: 'Fones de ouvido' }]);
    if (pathname.startsWith('/products/')) return json({ name: 'Fone Bluetooth TWS Sem Fio', buy_box_winner: { price: 95 } });
    return json({ message: 'not found' }, 404);
  };
}

test('progresso conclui somente etapas realmente executadas na consulta', async () => {
  const events = [];
  await analyzeListing('test-token', { ref:'MLB111111111' }, { fetch:mlMock(), onProgress:event=>events.push(event) });
  for (const stage of ['link','content','pricing','summary']) {
    const started = events.findIndex(event=>event.stage===stage && event.state==='running');
    const done = events.findIndex(event=>event.stage===stage && event.state==='done');
    assert.ok(started >= 0 && done > started, stage);
  }
  const failed = [];
  await assert.rejects(analyzeListing('test-token',{ref:'MLB111111111'},{fetch:async()=>json({},404),onProgress:event=>failed.push(event)}));
  assert.equal(failed.some(event=>event.state==='done'),false);
});

test('monta a análise estratégica completa com estimativas identificadas', async () => {
  const result = await analyzeListing('token', {
    ref: 'https://produto.mercadolivre.com.br/MLB-111111111-fone-_JM',
    store: { cost: 30, packaging: 2, shipping: 10, target: 25, budget: 1000 }
  }, { fetch: mlMock(), now: Date.parse('2026-09-25T00:00:00Z') });

  assert.equal(result.pricing.discount, 20);
  assert.equal(result.pricing.fee.amount, 16);
  assert.equal(result.pricing.fee.source, 'mercado_livre_listing_prices');
  assert.equal(result.pricing.minimumPrice, 50);
  assert.equal(result.pricing.targetPrice, 71.19);
  assert.equal(result.content.attributes.total, 3);
  assert.deepEqual(result.content.attributes.missingImportant, ['Modelo']);
  assert.equal(result.seller.logistics, 'Mercado Envios Full');
  assert.equal(result.sales.publicSold, 300);
  assert.equal(result.sales.pace.estimated, true);
  assert.equal(result.sales.pace.perMonth, 100);
  assert.equal(result.sales.revenue.estimated, true);
  assert.equal(result.strategy.initialStock.estimated, true);
  assert.equal(result.strategy.initialStock.units, 10);
  assert.equal(result.strategy.initialStock.capital, 320);
  assert.equal(result.strategy.recommended.price, 97);
  assert.ok(['otimista', 'moderado', 'arriscado'].includes(result.strategy.opportunity.key));
  assert.ok(result.strategy.actions.length > 0);
  assert.ok(result.strategy.titleIdeas.length > 0);
  assert.ok(result.strategy.titleIdeas.every(title => title.length <= 60));
  assert.ok(!('description' in result.listing));
});

test('funciona sem vendas públicas e sem custo informado', async () => {
  const result = await analyzeListing('token', { ref: 'MLB111111111', store: {} }, {
    fetch: mlMock({ sold: null }),
    now: Date.parse('2026-09-25T00:00:00Z')
  });
  assert.equal(result.sales.publicSold, null);
  assert.equal(result.sales.pace, undefined);
  assert.equal(result.pricing.minimumPrice, null);
  assert.equal(result.strategy.recommended, null);
  assert.equal(result.strategy.actions[0].priority, 1);
  assert.match(result.strategy.opportunity.note, /custo/);
});

test('informa quando o anúncio não existe', async () => {
  await assert.rejects(
    analyzeListing('token', { ref: 'MLB999999999' }, { fetch: async () => json({ message: 'not found' }, 404) }),
    error => error.status === 404 && error.code === 'LISTING_NOT_FOUND'
  );
});

const redirect = location => new Response(null, { status: 301, headers: { location } });

test('segue o link curto meli.la até o anúncio', async () => {
  const calls = [];
  const fetchMock = async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'manual');
    assert.ok(options.headers['user-agent']);
    if (url === 'https://meli.la/abc123') return redirect('https://produto.mercadolivre.com.br/MLB-1234567890-fone-_JM');
    assert.fail(`URL inesperada: ${url}`);
  };
  const resolved = await resolveShortListingLink('https://meli.la/abc123', { fetch: fetchMock });
  assert.deepEqual(parseListingRef(resolved), { type: 'item', id: 'MLB1234567890' });
  assert.equal(calls.length, 1);
});

test('não segue redirecionamento para fora do Mercado Livre', async () => {
  const fetchMock = async () => redirect('https://exemplo.com/MLB-1234567890');
  assert.equal(await resolveShortListingLink('https://meli.la/abc123', { fetch: fetchMock }), 'https://meli.la/abc123');
});

test('explica quando o link curto é uma vitrine de afiliado', async () => {
  const fetchMock = async () => redirect('https://www.mercadolivre.com.br/social/loja?matt_word=loja&matt_tool=33751059');
  await assert.rejects(
    analyzeListing('token', { ref: 'https://meli.la/27g95rk' }, { fetch: fetchMock }),
    error => error.status === 400 && /vitrine de afiliado/.test(error.message)
  );
});

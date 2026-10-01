import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanDescription, suggestDescription } from '../api/_description.js';
import { analyzeDescription, buildDiagnosis, diagnoseListing } from '../api/_diagnosis.js';

const json = body => new Response(JSON.stringify(body));

function item(overrides = {}) {
  return {
    id: 'MLB1234567', title: 'Luminária De Mesa Coluna Grega', price: 49.9, status: 'active', available_quantity: 10, sold_quantity: 0,
    date_created: '2025-10-01T00:00:00.000Z', listing_type_id: 'gold_special', shipping: { free_shipping: false, logistic_type: 'drop_off' },
    pictures: [{ max_size: '1200x1200' }, { max_size: '500x500' }, { max_size: '1200x1200' }], attributes: [], ...overrides
  };
}

const analysis = {
  title: { score: 86, checks: [] },
  competitors: { prices: { min: 30, max: 45 } },
  content: { hasVideo: false, attributes: { filled: 11, total: 12, ratio: 0.92, missingImportant: ['Código universal de produto'] } },
  pricing: { fee: { amount: 6 } },
  seller: { level: 'Sem reputação', levelPoints: 0 }
};

const goodDescription = `Luminária de mesa em formato de coluna grega, ideal para decorar salas, quartos e escritórios. A luz suave cria um ambiente aconchegante e o acabamento combina com decoração clássica ou moderna.

CARACTERÍSTICAS
- Material: resina
- Acabamento branco e bege

MEDIDAS
- Altura: 30 cm

O QUE VEM NA EMBALAGEM
- 1 luminária
- Cabo USB

GARANTIA
90 dias contra defeitos de fabricação.`;

test('avalia a descrição e aponta o que falta', () => {
  const empty = analyzeDescription('', item());
  assert.equal(empty.length, 0);
  assert.ok(empty.missing.includes('tamanho'));
  const good = analyzeDescription(goodDescription, item());
  assert.deepEqual(good.missing, []);
  assert.equal(good.score, 100);
  const withContact = analyzeDescription(goodDescription + '\nChama no WhatsApp (11) 91234-5678', item());
  assert.equal(withContact.forbidden, true);
  const shouting = analyzeDescription('LUMINÁRIA LINDA PARA SUA CASA ' .repeat(12), item());
  assert.ok(shouting.missing.includes('maiusculas'));
  assert.ok(shouting.missing.includes('paragrafos'));
});

test('pede voltagem só para produto elétrico', () => {
  const electric = analyzeDescription(goodDescription, item({ title: 'Luminária LED USB recarregável' }));
  assert.ok(electric.checks.some(entry => entry.key === 'voltagem'));
  const plain = analyzeDescription(goodDescription, item({ title: 'Vaso de cerâmica' }));
  assert.equal(plain.checks.some(entry => entry.key === 'voltagem'), false);
});

test('identifica anúncio que quase ninguém encontra', () => {
  const result = buildDiagnosis({ item: item(), analysis, description: analyzeDescription('', item()), visits: { last30: 12, total: 40 }, premiumFee: { amount: 8.5 } });
  assert.equal(result.stage.key, 'exposicao');
  const visits = result.checks.find(entry => entry.key === 'visitas');
  assert.equal(visits.status, 'bad');
  const photos = result.checks.find(entry => entry.key === 'resolucao');
  assert.equal(photos.status, 'warn');
  const installments = result.checks.find(entry => entry.key === 'parcelamento');
  assert.match(installments.detail, /R\$\s?2,50/);
  assert.ok(result.priorities.length > 0 && result.priorities.every(entry => entry.where));
});

test('identifica anúncio visto mas sem vendas e prioriza preço e conversão', () => {
  const result = buildDiagnosis({ item: item({ price: 60 }), analysis, description: analyzeDescription(goodDescription, item()), visits: { last30: 300, total: 900 }, premiumFee: null });
  assert.equal(result.stage.key, 'conversao');
  assert.equal(result.checks.find(entry => entry.key === 'conversao').status, 'bad');
  assert.equal(result.checks.find(entry => entry.key === 'preco').status, 'bad');
  assert.equal(result.priorities[0].key, 'preco');
});

test('anúncio pausado ou sem estoque vem primeiro', () => {
  const result = buildDiagnosis({ item: item({ status: 'paused', available_quantity: 0 }), analysis, description: analyzeDescription(goodDescription, item()), visits: { last30: 500, total: 2000 }, premiumFee: null });
  assert.equal(result.stage.key, 'bloqueado');
});

test('só diagnostica anúncios da própria conta', async () => {
  const fetchMock = async url => {
    const path = new URL(url).pathname;
    if (path === '/items/MLB1234567') return json(item({ seller_id: 99 }));
    if (path === '/users/me') return json({ id: 42 });
    assert.fail(`URL inesperada: ${url}`);
  };
  await assert.rejects(diagnoseListing('token', 'MLB1234567', { fetch: fetchMock }), error => error.status === 403);
  await assert.rejects(diagnoseListing('token', 'abc', { fetch: fetchMock }), error => error.status === 400);
});

test('limpa HTML e markdown da descrição sugerida', () => {
  assert.equal(cleanDescription('<b>**Luminária**</b>\r\n\r\n\r\n## GARANTIA\n90 dias'), 'Luminária\n\nGARANTIA\n90 dias');
});

test('gera a sugestão de descrição com os dados do anúncio', async () => {
  const calls = [];
  const client = { interactions: { create: async params => { calls.push(params); return { output_text: JSON.stringify({ description: 'LUMINÁRIA\n- Material: resina\n\nMEDIDAS\n[preencher: altura em cm]', fill: ['altura em cm'] }) }; } } };
  const fetchMock = async url => {
    const path = new URL(url).pathname;
    if (path === '/items/MLB1234567') return json(item({ seller_id: 42, attributes: [{ id: 'MATERIAL', name: 'Material', value_name: 'Resina' }, { id: 'SELLER_SKU', name: 'SKU', value_name: 'G10' }] }));
    if (path === '/users/me') return json({ id: 42 });
    if (path === '/items/MLB1234567/description') return json({ plain_text: 'Luminária bonita.' });
    assert.fail(`URL inesperada: ${url}`);
  };
  const result = await suggestDescription('token', 'MLB1234567', { fetch: fetchMock, client });
  assert.match(result.description, /\[preencher: altura em cm\]/);
  assert.deepEqual(result.fill, ['altura em cm']);
  assert.match(result.where, /Modificar › Descrição/);
  assert.match(calls[0].input, /Material: Resina/);
  assert.doesNotMatch(calls[0].input, /SKU/);
  assert.match(calls[0].input, /Luminária bonita\./);
});

test('avisa quando o preço está muito abaixo das ofertas parecidas', () => {
  const result = buildDiagnosis({ item: item({ price: 19.9 }), analysis: { ...analysis, competitors: { prices: { min: 48.46, max: 87.3 } } }, description: analyzeDescription(goodDescription, item()), visits: { last30: 0, total: 2 }, premiumFee: null });
  const price = result.checks.find(entry => entry.key === 'preco');
  assert.equal(price.status, 'info');
  assert.match(price.label, /bem abaixo/);
});

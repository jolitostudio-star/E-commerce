import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/quotes.js');
const { normalize, metrics, ranked } = globalThis.MargemIQQuotes;

const quote = overrides => ({
  id:'q1', supplierId:1, supplierName:'Fornecedor A', product:'Organizador plástico',
  unitPrice:20, quantity:10, freightTotal:50, salePrice:60, feePercent:12,
  taxPercent:4, shippingSale:5, packaging:2, ...overrides
});

test('calcula custo final, investimento, lucro e margem da cotação', () => {
  const result=metrics(quote());
  assert.equal(result.freightUnit,5);
  assert.equal(result.landedCost,25);
  assert.equal(result.investment,250);
  assert.equal(result.fee,7.2);
  assert.equal(result.tax,2.4);
  assert.equal(result.profit,18.4);
  assert.equal(Math.round(result.margin*10000)/100,30.67);
});

test('mantém a cotação sem margem quando o preço de venda não foi informado', () => {
  const result=metrics(quote({salePrice:0}));
  assert.equal(result.profit,null);
  assert.equal(result.margin,null);
});

test('destaca melhor custo e melhor margem apenas entre o mesmo produto', () => {
  const rows=ranked([
    quote({id:'a',supplierId:1,supplierName:'A',unitPrice:20}),
    quote({id:'b',supplierId:2,supplierName:'B',unitPrice:18,freightTotal:20}),
    quote({id:'c',supplierId:3,supplierName:'C',product:'Panela',unitPrice:30})
  ]);
  const b=rows.find(row => row.quote.id==='b');
  const c=rows.find(row => row.quote.id==='c');
  assert.equal(b.bestCost,true);
  assert.equal(b.bestMargin,true);
  assert.equal(c.bestCost,true);
  assert.equal(c.bestMargin,true);
});

test('recusa cotação sem produto, fornecedor ou preço válido', () => {
  assert.throws(() => normalize(quote({product:''})),/produto/i);
  assert.throws(() => normalize(quote({supplierId:0})),/fornecedor/i);
  assert.throws(() => normalize(quote({unitPrice:0})),/preço/i);
});

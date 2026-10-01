import assert from 'node:assert/strict';
import test from 'node:test';
import { listSellerOrders, periodDays } from '../api/_orders.js';

const json = body => new Response(JSON.stringify(body));

function order(id, { status = 'paid', shipment = null, quantity = 1, price = 100, fee = 12, item = 'MLB1' } = {}) {
  return { id, status, date_created: '2026-09-20T10:00:00.000-03:00', shipping: shipment ? { id: shipment } : null,
    order_items: [{ item: { id: item, title: 'Luminária', seller_sku: 'G10' }, quantity, unit_price: price, sale_fee: fee }] };
}

test('aceita só períodos de 7, 30 ou 90 dias', () => {
  assert.equal(periodDays('7'), 7);
  assert.equal(periodDays('90'), 90);
  assert.equal(periodDays('365'), 30);
  assert.equal(periodDays(undefined), 30);
});

test('lista vendas com tarifa por unidade e frete pago pelo vendedor', async () => {
  const calls = [];
  const fetchMock = async url => {
    const u = new URL(url); calls.push(u);
    if (u.pathname === '/users/me') return json({ id: 42, nickname: 'LOJA' });
    if (u.pathname === '/orders/search') return json({ paging: { total: 3 }, results: [
      order(1, { shipment: 'S1', quantity: 2, price: 50, fee: 6 }),
      order(2, { shipment: 'S1' }),
      order(3, { status: 'cancelled', shipment: 'S2' })
    ] });
    if (u.pathname === '/shipments/S1/costs') return json({ senders: [{ user_id: 42, cost: 21.5 }], receiver: { cost: 0 } });
    assert.fail(`URL inesperada: ${url}`);
  };
  const result = await listSellerOrders('token', { days: 7 }, { fetch: fetchMock, now: Date.parse('2026-09-25T12:00:00Z') });
  const search = calls.find(u => u.pathname === '/orders/search');
  assert.equal(search.searchParams.get('seller'), '42');
  assert.equal(search.searchParams.get('order.date_created.from'), '2026-09-18T12:00:00.000-00:00');
  const [first, second, cancelled] = result.orders;
  assert.equal(first.revenue, 100);
  assert.equal(first.fee, 12);
  assert.deepEqual(first.shipping, { amount: 21.5, source: 'mercado_livre_shipments' });
  assert.deepEqual(second.shipping, { amount: 0, source: 'mesmo_envio' });
  assert.equal(cancelled.shipping.source, 'cancelado');
  assert.equal(calls.some(u => u.pathname === '/shipments/S2/costs'), false);
  assert.equal(result.truncated, false);
});

test('pagina até 200 pedidos e avisa quando há mais', async () => {
  let pages = 0;
  const fetchMock = async url => {
    const u = new URL(url);
    if (u.pathname === '/users/me') return json({ id: 42 });
    if (u.pathname === '/orders/search') {
      pages++;
      const offset = Number(u.searchParams.get('offset'));
      return json({ paging: { total: 260 }, results: Array.from({ length: 50 }, (_, i) => order(offset + i + 1)) });
    }
    assert.fail(`URL inesperada: ${url}`);
  };
  const result = await listSellerOrders('token', {}, { fetch: fetchMock });
  assert.equal(pages, 4);
  assert.equal(result.orders.length, 200);
  assert.equal(result.truncated, true);
});

test('marca o frete como indisponível quando a consulta falha', async () => {
  const fetchMock = async url => {
    const u = new URL(url);
    if (u.pathname === '/users/me') return json({ id: 42 });
    if (u.pathname === '/orders/search') return json({ paging: { total: 1 }, results: [order(1, { shipment: 'S9' })] });
    return new Response('{}', { status: 500 });
  };
  const result = await listSellerOrders('token', {}, { fetch: fetchMock });
  assert.deepEqual(result.orders[0].shipping, { amount: null, source: 'indisponivel' });
});

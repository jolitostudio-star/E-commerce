import { mapLimit, mlError, mlFetch } from './_ml.js';

// Vendas (pedidos) do vendedor no Mercado Livre, com a tarifa cobrada e o frete pago pelo vendedor em cada envio.
// O custo dos produtos fica no navegador; o lucro é calculado na tela.

const PERIODS = new Set([7, 30, 90]);
const PAGE = 50;
const MAX_ORDERS = 200;

export function periodDays(value) {
  const days = Number(value);
  return PERIODS.has(days) ? days : 30;
}

function mapOrder(order) {
  const items = (order.order_items || []).map(entry => {
    const quantity = Number(entry.quantity || 0);
    const unitPrice = Number(entry.unit_price || 0);
    return {
      itemId: String(entry.item?.id || ''),
      title: String(entry.item?.title || 'Produto'),
      sku: String(entry.item?.seller_sku || entry.item?.seller_custom_field || ''),
      quantity,
      unitPrice,
      // sale_fee vem por unidade vendida.
      fee: Math.round(Number(entry.sale_fee || 0) * quantity * 100) / 100
    };
  });
  return {
    id: String(order.id),
    date: String(order.date_created || ''),
    status: String(order.status || ''),
    packId: order.pack_id ? String(order.pack_id) : null,
    shipmentId: order.shipping?.id ? String(order.shipping.id) : null,
    revenue: Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100,
    fee: Math.round(items.reduce((sum, item) => sum + item.fee, 0) * 100) / 100,
    items
  };
}

// Quanto o vendedor pagou pelo envio (senders[].cost em /shipments/{id}/costs).
async function sellerShippingCost(token, shipmentId, sellerId, options) {
  try {
    const costs = await mlFetch(`/shipments/${encodeURIComponent(shipmentId)}/costs`, token, options);
    const senders = Array.isArray(costs?.senders) ? costs.senders : [];
    const mine = senders.find(sender => String(sender.user_id) === String(sellerId)) || senders[0];
    const cost = Number(mine?.cost);
    return Number.isFinite(cost) ? cost : null;
  } catch (error) {
    if (error.status === 401) throw error;
    return null;
  }
}

export async function listSellerOrders(token, input = {}, options = {}) {
  const days = periodDays(input.days);
  const now = options.now || Date.now();
  const from = new Date(now - days * 86400000).toISOString().replace('Z', '-00:00');
  const me = await mlFetch('/users/me', token, options);
  if (!me?.id) throw mlError('Não foi possível identificar a conta do Mercado Livre.', 502, 'ML_API_ERROR');

  const raw = [];
  let total = 0;
  for (let offset = 0; offset < MAX_ORDERS; offset += PAGE) {
    const params = new URLSearchParams({ seller: String(me.id), 'order.date_created.from': from, sort: 'date_desc', limit: String(PAGE), offset: String(offset) });
    const page = await mlFetch(`/orders/search?${params}`, token, options);
    const results = Array.isArray(page?.results) ? page.results : [];
    total = Number(page?.paging?.total || results.length);
    raw.push(...results);
    if (results.length < PAGE || raw.length >= total) break;
  }
  const orders = raw.slice(0, MAX_ORDERS).map(mapOrder);

  // Pedidos do mesmo carrinho dividem um envio: o frete entra uma vez só, no primeiro pedido do envio.
  const shipments = [...new Set(orders.filter(order => order.status !== 'cancelled' && order.shipmentId).map(order => order.shipmentId))];
  const costs = new Map(await mapLimit(shipments, 4, async id => [id, await sellerShippingCost(token, id, me.id, options)]));
  const charged = new Set();
  for (const order of orders) {
    if (order.status === 'cancelled' || !order.shipmentId) { order.shipping = { amount: 0, source: order.shipmentId ? 'cancelado' : 'sem_envio' }; continue; }
    const amount = costs.get(order.shipmentId);
    if (amount === null || amount === undefined) { order.shipping = { amount: null, source: 'indisponivel' }; continue; }
    order.shipping = charged.has(order.shipmentId) ? { amount: 0, source: 'mesmo_envio' } : { amount, source: 'mercado_livre_shipments' };
    charged.add(order.shipmentId);
  }

  return {
    seller: { id: String(me.id), nickname: String(me.nickname || '') },
    period: { days, from },
    orders,
    total,
    truncated: total > orders.length,
    fetchedAt: now
  };
}

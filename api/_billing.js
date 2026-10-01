import { createClient } from '@supabase/supabase-js';
import { MercadoPagoConfig, Preference, Payment, WebhookSignatureValidator } from 'mercadopago';

export const PRICE_CENTS = 100;
export const billingError = (message, status = 503, code = 'PAYMENT_UNAVAILABLE') => Object.assign(new Error(message), { status, code });

export function paymentConfigured() {
  return Boolean(process.env.MP_PAYMENTS_ENABLED === '1' && process.env.MP_ACCESS_TOKEN && process.env.MP_WEBHOOK_SECRET && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && publicAppUrl());
}

export function publicAppUrl() {
  try {
    if (!/^https:\/\//i.test(process.env.APP_URL || '')) return null;
    const url = new URL(process.env.APP_URL || '');
    return url.protocol === 'https:' && !['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname) && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

export function billingDb() {
  if (!process.env.SUPABASE_SECRET_KEY) throw billingError('Os pagamentos ainda não estão disponíveis.');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function paymentClients() {
  const config = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN, options: { timeout: 10000 } });
  return { preference: new Preference(config), payment: new Payment(config) };
}

export function preferenceBody(order, account) {
  const baseUrl = process.env.APP_URL?.trim() || 'http://localhost:3000';
  const publicUrl = publicAppUrl();
  const back = `${baseUrl.replace(/\/$/,'')}/diagnostico?order=${encodeURIComponent(order.id)}`;
  return {
    items: [{ id: order.id, title: 'MargemIQ — análise completa de um anúncio', quantity: 1, unit_price: PRICE_CENTS / 100, currency_id: 'BRL' }],
    payer: { email: account.user.email },
    external_reference: order.id,
    metadata: { order_id: order.id, user_id: account.user.id },
    back_urls: { success: back, failure: back, pending: back },
    ...(publicUrl ? { auto_return: 'approved', notification_url: `${publicUrl}/api/payments?view=webhook` } : {}),
    statement_descriptor: 'MARGEMIQ'
  };
}

export function checkoutRedirect(preference) {
  if (!preference.id || !preference.collector_id || !/^https:\/\/(?:[\w-]+\.)?mercadopago\.com(?:\.br)?\//.test(preference.init_point || '')) throw billingError('O provedor não devolveu um checkout válido.');
  return preference.init_point;
}

export function normalizeCosts(input = {}) {
  const costs = {};
  for (const [name, max, fallback] of [['cost',10000000,0],['packaging',10000000,0],['shipping',10000000,0],['target',80,20]]) {
    const value = input[name] === undefined || input[name] === '' ? fallback : Number(input[name]);
    if (!Number.isFinite(value) || value < 0 || value > max) throw billingError('Confira os custos e a margem informados.', 400, 'INVALID_COSTS');
    costs[name] = value;
  }
  return costs;
}

export function trustedPayment(payment, order) {
  if (String(payment.external_reference) !== order.id || String(payment.metadata?.user_id) !== order.user_id || String(payment.metadata?.order_id) !== order.id || String(payment.collector_id) !== order.collector_id || payment.currency_id !== 'BRL' || Number(payment.transaction_amount) !== PRICE_CENTS / 100 || (process.env.VERCEL && payment.live_mode !== true)) {
    throw billingError('O pagamento não corresponde a esta análise.', 403, 'PAYMENT_MISMATCH');
  }
  if (!['approved','pending','in_process','rejected','cancelled','refunded','charged_back','authorized'].includes(payment.status)) throw billingError('O pagamento ainda não pôde ser confirmado.', 409, 'PAYMENT_PENDING');
  if (Number(payment.transaction_amount_refunded || 0) > 0) return 'refunded';
  return ['pending','in_process','authorized'].includes(payment.status) ? 'pending' : payment.status;
}

export async function reconcilePayment(paymentId, { userId = null, db = billingDb(), payment = paymentClients().payment } = {}) {
  if (!/^\d{1,30}$/.test(String(paymentId))) throw billingError('Pagamento inválido.', 400, 'INVALID_PAYMENT');
  const verified = await payment.get({ id: String(paymentId) });
  if (!/^[0-9a-f-]{36}$/i.test(String(verified.external_reference))) throw billingError('Pagamento não encontrado.', 404, 'ORDER_NOT_FOUND');
  let query = db.from('diagnostic_orders').select('*').eq('id', verified.external_reference);
  if (userId) query = query.eq('user_id', userId);
  const { data: order, error } = await query.maybeSingle();
  if (error || !order) throw billingError('Análise não encontrada para esta conta.', 404, 'ORDER_NOT_FOUND');
  if (order.payment_id && order.payment_id !== String(verified.id)) throw billingError('Esta análise já está associada a outro pagamento.', 409, 'PAYMENT_MISMATCH');
  const status = trustedPayment(verified, order);
  const updatedAt = new Date(verified.date_last_updated || verified.date_created).toISOString();
  const { data: saved, error: updateError } = await db.from('diagnostic_orders').update({ payment_id: String(verified.id), status, payment_updated_at: updatedAt, updated_at: new Date().toISOString() })
    .eq('id', order.id).or(`payment_updated_at.is.null,payment_updated_at.lte.${updatedAt}`).select('*').maybeSingle();
  if (updateError) throw billingError('Não foi possível registrar o pagamento. Tente consultar novamente.');
  if (!saved) {
    const { data: newer, error: newerError } = await db.from('diagnostic_orders').select('*').eq('id', order.id).maybeSingle();
    if (newerError || !newer) throw billingError('Não foi possível consultar o pagamento mais recente.');
    return newer;
  }
  // Fresh provider status is required even if a previously cached order was approved.
  return saved;
}

export async function paidOrder(userId, orderId, dependencies = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(orderId))) throw billingError('Análise inválida.', 400, 'INVALID_ORDER');
  const db = dependencies.db || billingDb();
  const { data: order, error } = await db.from('diagnostic_orders').select('*').eq('id', orderId).eq('user_id', userId).maybeSingle();
  if (error || !order) throw billingError('Análise não encontrada para esta conta.', 404, 'ORDER_NOT_FOUND');
  if (!order.payment_id) throw billingError('Aguardando confirmação do pagamento.', 402, 'PAYMENT_REQUIRED');
  const confirmed = await reconcilePayment(order.payment_id, { ...dependencies, db, userId });
  if (confirmed.status !== 'approved') throw billingError('Aguardando confirmação do pagamento.', 402, 'PAYMENT_REQUIRED');
  return confirmed;
}

export function verifyWebhook(request, input) {
  const url = new URL(request.url);
  const id = url.searchParams.get('data.id');
  if (input?.type !== 'payment' || !/^\d{1,30}$/.test(id || '') || String(input.data?.id) !== id || !request.headers.get('x-request-id')) throw billingError('Notificação inválida.', 400, 'INVALID_WEBHOOK');
  try {
    WebhookSignatureValidator.validate({ xSignature: request.headers.get('x-signature'), xRequestId: request.headers.get('x-request-id'), dataId: id, secret: process.env.MP_WEBHOOK_SECRET || '', toleranceSeconds: 300 });
  } catch { throw billingError('Assinatura inválida.', 401, 'INVALID_SIGNATURE'); }
  return id;
}

export async function processPaymentEvent(paymentId, eventKey, dependencies = {}) {
  const db = dependencies.db || billingDb();
  await reconcilePayment(paymentId, { ...dependencies, db });
  const { error } = await db.from('diagnostic_payment_events').update({ processed_at: new Date().toISOString() }).eq('event_key', eventKey);
  if (error) throw error;
}

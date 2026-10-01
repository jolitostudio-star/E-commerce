import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { protect } from './_account.js';
import { readLead } from './_lead.js';
import { analyzeListing } from './_listing.js';
import { mercadoLivreSession, sessionHeaders } from './_session.js';
import { preparedReport } from './_guest-analysis.js';
import { paymentConfigured, billingDb, billingError, paymentClients, preferenceBody, checkoutRedirect, normalizeCosts, reconcilePayment, processPaymentEvent, verifyWebhook } from './_billing.js';

const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
function failure(error) {
  if (!error.status) console.error('Falha na integração de pagamentos', { code: error.code || 'UNKNOWN' });
  return Response.json({ error: error.status ? error.message : 'Não foi possível concluir o pagamento. Tente consultar o status antes de pagar novamente.', code: error.code || 'PAYMENT_UNAVAILABLE' }, { status: error.status || 503, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get('view') === 'config') return Response.json({ enabled: paymentConfigured(), amount: 1, currency: 'BRL' }, { headers: { 'cache-control': 'no-store' } });
  return protect(async (req, account) => {
    if (url.searchParams.get('view') === 'history') {
      const { data, error } = await billingDb().from('diagnostic_orders').select('id,listing_ref,status,created_at').eq('user_id', account.user.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(20);
      if (error) return failure(billingError('Não foi possível consultar suas análises.'));
      return Response.json({ orders: data || [] });
    }
    const orderId = url.searchParams.get('order');
    if (!uuid(orderId)) return failure(billingError('Análise inválida.', 400, 'INVALID_ORDER'));
    const db = billingDb();
    const { data: order, error } = await db.from('diagnostic_orders').select('*').eq('id', orderId).eq('user_id', account.user.id).maybeSingle();
    if (error || !order) return failure(billingError('Análise não encontrada para esta conta.', 404, 'ORDER_NOT_FOUND'));
    let confirmed = order;
    const candidateId = url.searchParams.get('payment_id') || order.payment_id;
    try {
      if (candidateId) {
        confirmed = await reconcilePayment(candidateId, { db, userId: account.user.id });
        if (confirmed.id !== order.id) throw billingError('Pagamento não corresponde a esta análise.', 403, 'PAYMENT_MISMATCH');
      } else if (order.preference_id) {
        const found = await paymentClients().payment.search({ options: { external_reference: order.id, sort: 'date_created', criteria: 'desc', limit: 5 } });
        const approved = found.results?.find(payment => payment.status === 'approved') || found.results?.[0];
        if (approved) confirmed = await reconcilePayment(approved.id, { db, userId: account.user.id });
      }
      return Response.json({ order: order.id, status: confirmed.status, listingRef: order.listing_ref, amount: 1, ready: confirmed.status === 'approved' });
    } catch (error) { return failure(error); }
  })(request);
}

async function checkout(request, account) {
  if (!paymentConfigured()) return failure(billingError('O pagamento ainda não está disponível. Sua prévia continua gratuita.'));
  const input = await request.json().catch(() => null);
  const ref = readLead(request);
  if (!ref || !uuid(input?.requestKey)) return failure(billingError('Comece pelo link do anúncio para continuar.', 400, 'LEAD_REQUIRED'));
  const db = billingDb();
  const { data: previous, error: lookupError } = await db.from('diagnostic_orders').select('*').eq('user_id', account.user.id).eq('request_key', input.requestKey).maybeSingle();
  if (lookupError) return failure(billingError('Não foi possível consultar sua análise.'));
  if (previous) {
    if (previous.listing_ref !== ref) return failure(billingError('Este pedido pertence a outro anúncio.', 409, 'ORDER_MISMATCH'));
    if (previous.status === 'approved') return Response.json({ order: previous.id, ready: true });
    if (previous.checkout_url) return Response.json({ order: previous.id, checkoutUrl: previous.checkout_url });
    return failure(billingError('O pagamento está sendo preparado. Consulte novamente em instantes.', 409, 'CHECKOUT_PROCESSING'));
  }
  let session = { cookie: null };
  try {
    // Compute and persist the report before charging, so an upstream error cannot charge for an unavailable result.
    const report = await preparedReport(request,db);
    if(!report) throw billingError('Sua consulta expirou. Analise o anúncio novamente antes de pagar.',409,'PREVIEW_REQUIRED');
    const order = { id: crypto.randomUUID(), user_id: account.user.id, request_key: input.requestKey, listing_ref: ref, amount_cents: 100, currency: 'BRL', status: 'creating', report };
    const { error: insertError } = await db.from('diagnostic_orders').insert(order);
    if (insertError?.code === '23505') throw billingError('O pagamento já está sendo preparado. Aguarde e tente consultar novamente.', 409, 'CHECKOUT_PROCESSING');
    if (insertError) throw billingError('Não foi possível preparar sua análise.');
    // This persisted order ID is reused as the SDK idempotency key and external reference.
    let result;
    try {
      result = await paymentClients().preference.create({ body: preferenceBody(order, account), requestOptions: { idempotencyKey: order.id } });
    } catch {
      // Do not repeat an uncertain provider request: the same request key remains reserved.
      await db.from('diagnostic_orders').update({ status: 'checkout_error' }).eq('id', order.id);
      throw billingError('Não foi possível preparar o checkout. Nenhuma cobrança foi confirmada.');
    }
    checkoutRedirect(result);
    const { error: updateError } = await db.from('diagnostic_orders').update({ status: 'pending', preference_id: String(result.id), checkout_url: result.init_point, collector_id: String(result.collector_id), updated_at: new Date().toISOString() }).eq('id', order.id);
    if (updateError) throw billingError('Não foi possível salvar o checkout. Tente consultar novamente.');
    return Response.json({ order: order.id, checkoutUrl: result.init_point }, { headers: sessionHeaders(session) });
  } catch (error) {
    const response = failure(error);
    if (session.cookie) response.headers.append('set-cookie', session.cookie);
    return response;
  }
}

export async function POST(request) {
  if (new URL(request.url).searchParams.get('view') !== 'webhook') return protect(checkout)(request);
  if (!paymentConfigured()) return failure(billingError('Receptor de pagamentos indisponível.'));
  try {
    const input = await request.json();
    const paymentId = verifyWebhook(request, input);
    const eventKey = `payment:${paymentId}:${String(input.id || request.headers.get('x-request-id')).slice(0,100)}`;
    const db = billingDb();
    // Durable inbox before acknowledgment; no event is lost if a function stops after responding.
    const { error } = await db.from('diagnostic_payment_events').upsert({ event_key: eventKey, payment_id: paymentId, processed_at: null });
    if (error) throw billingError('Não foi possível registrar a notificação.');
    const work = processPaymentEvent(paymentId, eventKey, { db }).catch(error => console.error('Notificação aguardando reconciliação', { code: error.code || 'UNKNOWN', event: eventKey }));
    if (process.env.VERCEL) waitUntil(work);
    else await work;
    return Response.json({ received: true }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return failure(error); }
}

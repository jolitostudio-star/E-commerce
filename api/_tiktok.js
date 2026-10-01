import crypto from 'node:crypto';
import { cookie, readCookie, seal, unseal } from './_auth.js';

// TikTok Shop Open API (versões 202309+). O Brasil usa os domínios "Rest of World".
const API_HOST = 'https://open-api.tiktokglobalshop.com';
const AUTH_HOST = 'https://auth.tiktok-shops.com';
const AUTHORIZE_URL = 'https://services.tiktokshop.com/open/authorize';

export function tiktokConfigured() {
  return Boolean(process.env.TIKTOK_APP_KEY && process.env.TIKTOK_APP_SECRET && process.env.TIKTOK_SERVICE_ID && process.env.SESSION_SECRET);
}

export function assertTiktokConfig() {
  const missing = ['TIKTOK_APP_KEY', 'TIKTOK_APP_SECRET', 'TIKTOK_SERVICE_ID', 'SESSION_SECRET'].filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Configuração do TikTok Shop incompleta: ${missing.join(', ')}.`);
}

function tiktokError(message, status = 502, code = 'TIKTOK_API_ERROR', detail = null) {
  return Object.assign(new Error(message), { status, code, detail });
}

// Assinatura: HMAC-SHA256 (hex) de secret + path + parâmetros em ordem alfabética ({chave}{valor}, sem sign
// e access_token) + corpo exato enviado + secret, usando o app secret como chave.
export function tiktokSign(path, query, body = '') {
  const secret = process.env.TIKTOK_APP_SECRET || '';
  const params = Object.keys(query)
    .filter(key => key !== 'sign' && key !== 'access_token')
    .sort()
    .map(key => `${key}${query[key]}`)
    .join('');
  return crypto.createHmac('sha256', secret).update(`${secret}${path}${params}${body}${secret}`).digest('hex');
}

// O redirect é o "Redirect URL" cadastrado no app do Partner Center; o link não o repete.
export function createTiktokAuthorization() {
  assertTiktokConfig();
  const state = crypto.randomBytes(24).toString('base64url');
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('service_id', process.env.TIKTOK_SERVICE_ID);
  url.searchParams.set('state', state);
  return { url: url.toString(), state, cookie: seal({ state, createdAt: Date.now() }) };
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function tokenRequest(path, params, options = {}) {
  const url = new URL(AUTH_HOST + path);
  url.searchParams.set('app_key', process.env.TIKTOK_APP_KEY || '');
  url.searchParams.set('app_secret', process.env.TIKTOK_APP_SECRET || '');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await (options.fetch || fetch)(url.toString(), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  const result = await readJson(response);
  const data = result.data || {};
  if (!response.ok || result.code !== 0 || !data.access_token) {
    console.error('TikTok Shop OAuth recusado', { status: response.status, code: result.code ?? null, message: result.message || null, request_id: result.request_id || null });
    throw tiktokError(result.message || 'Falha ao autorizar o TikTok Shop.', 502, 'TIKTOK_OAUTH_ERROR');
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    // A API devolve os vencimentos como timestamps Unix (segundos), não como durações.
    expires_at: Number(data.access_token_expire_in || 0) * 1000,
    refresh_expires_at: Number(data.refresh_token_expire_in || 0) * 1000,
    seller_name: String(data.seller_name || '')
  };
}

export function exchangeTiktokCode(code, options = {}) {
  return tokenRequest('/api/v2/token/get', { auth_code: code, grant_type: 'authorized_code' }, options);
}

export function refreshTiktokAccess(refreshToken, options = {}) {
  return tokenRequest('/api/v2/token/refresh', { refresh_token: refreshToken, grant_type: 'refresh_token' }, options);
}

// O cookie acompanha o refresh token, que dura o período de autorização escolhido pelo vendedor.
export function tiktokSessionCookie(token) {
  const seconds = Math.floor((token.refresh_expires_at - Date.now()) / 1000);
  return cookie('tiktok_session', seal(token), Math.min(Math.max(seconds, 3600), 365 * 86400));
}

export async function tiktokSession(request, options = {}) {
  const session = unseal(readCookie(request, 'tiktok_session'));
  if (!session?.access_token) throw tiktokError('Conecte sua loja do TikTok Shop.', 401, 'TIKTOK_NOT_CONNECTED');
  // O access token vale 7 dias; renova com um dia de folga.
  if (session.expires_at >= Date.now() + 86400000) return { session, cookie: null };
  try {
    const renewed = await refreshTiktokAccess(session.refresh_token, options);
    return { session: renewed, cookie: tiktokSessionCookie(renewed) };
  } catch (error) {
    if (session.expires_at > Date.now()) return { session, cookie: null };
    throw tiktokError('A conexão com o TikTok Shop expirou. Conecte a loja novamente.', 401, 'TIKTOK_SESSION_EXPIRED');
  }
}

async function tiktokRequest(path, token, { query = {}, body, fetch: fetchImpl = fetch, timeout = 12000 } = {}) {
  if (!token) throw tiktokError('Conecte sua loja do TikTok Shop.', 401, 'TIKTOK_NOT_CONNECTED');
  const params = { ...query, app_key: process.env.TIKTOK_APP_KEY || '', timestamp: String(Math.floor(Date.now() / 1000)) };
  const payload = body === undefined ? '' : JSON.stringify(body);
  const url = new URL(API_HOST + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  url.searchParams.set('sign', tiktokSign(path, params, payload));
  const response = await fetchImpl(url.toString(), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-tts-access-token': token },
    body: payload || undefined,
    signal: AbortSignal.timeout(timeout)
  });
  const result = await readJson(response);
  if (!response.ok || result.code !== 0) {
    const authFailure = response.status === 401 || /access[_ ]?token|expired|unauthori[sz]ed/i.test(String(result.message || ''));
    throw tiktokError(
      result.message || 'O TikTok Shop recusou a operação.',
      authFailure ? 401 : 502,
      authFailure ? 'TIKTOK_SESSION_EXPIRED' : 'TIKTOK_API_ERROR',
      { code: result.code ?? null, request_id: result.request_id || null }
    );
  }
  return result.data || {};
}

function skuPrice(sku) {
  return Number(sku?.price?.sale_price || sku?.price?.tax_exclusive_price || 0);
}

export async function listShopProducts(session, options = {}) {
  const shops = (await tiktokRequest('/authorization/202309/shops', session.access_token, options)).shops || [];
  const shop = shops.find(entry => entry.region === 'BR') || shops[0];
  if (!shop?.cipher) throw tiktokError('Nenhuma loja do TikTok Shop foi autorizada para o MargemIQ.', 404, 'TIKTOK_NO_SHOP');

  const limit = Math.min(100, Math.max(1, Number(options.limit) || 100));
  const search = await tiktokRequest('/product/202502/products/search', session.access_token, {
    ...options,
    query: { page_size: limit, shop_cipher: shop.cipher },
    body: { status: 'ACTIVATE' }
  });

  // A busca não informa vendas nem imagens; preço e estoque vêm dos SKUs (variações) do produto.
  const items = (search.products || []).map(product => {
    const skus = Array.isArray(product.skus) ? product.skus : [];
    const prices = skus.map(skuPrice).filter(price => price > 0);
    return {
      id: String(product.id),
      title: String(product.title || 'Produto sem título'),
      sku: skus.length === 1 ? String(skus[0].seller_sku || '') : '',
      price: prices.length ? Math.min(...prices) : 0,
      originalPrice: null,
      hasVariations: skus.length > 1,
      availableQuantity: skus.reduce((sum, sku) => sum + (sku.inventory || []).reduce((total, entry) => total + Number(entry.quantity || 0), 0), 0),
      soldQuantity: null,
      status: product.status === 'ACTIVATE' ? 'active' : String(product.status || '').toLowerCase(),
      thumbnail: null,
      permalink: null
    };
  });

  return {
    shop: { id: String(shop.id || ''), name: String(shop.name || session.seller_name || ''), region: String(shop.region || '') },
    items,
    paging: { total: Number(search.total_count || items.length), limit, offset: 0 },
    syncedAt: Date.now()
  };
}

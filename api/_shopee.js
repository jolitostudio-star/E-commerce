import crypto from 'node:crypto';
import { cookie, readCookie, seal, unseal } from './_auth.js';
import { mapLimit } from './_ml.js';

// Shopee Open Platform v2 (lojas do Brasil). A Vercel roda nos EUA (iad1), por isso o host .com.br.
// Com SHOPEE_SANDBOX=1 tudo passa a usar o ambiente de testes da Shopee.
function hosts() {
  return process.env.SHOPEE_SANDBOX === '1'
    ? { api: 'https://openplatform.sandbox.test-stable.shopee.sg', auth: 'https://open.sandbox.test-stable.shopee.com.br/auth' }
    : { api: 'https://openplatform.shopee.com.br', auth: 'https://open.shopee.com.br/auth' };
}

export function shopeeConfigured() {
  return Boolean(process.env.SHOPEE_PARTNER_ID && process.env.SHOPEE_PARTNER_KEY && process.env.SHOPEE_REDIRECT_URI && process.env.SESSION_SECRET);
}

export function assertShopeeConfig() {
  const missing = ['SHOPEE_PARTNER_ID', 'SHOPEE_PARTNER_KEY', 'SHOPEE_REDIRECT_URI', 'SESSION_SECRET'].filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Configuração da Shopee incompleta: ${missing.join(', ')}.`);
}

function shopeeError(message, status = 502, code = 'SHOPEE_API_ERROR', detail = null) {
  return Object.assign(new Error(message), { status, code, detail });
}

// Assinatura: HMAC-SHA256 (hex minúsculo) de partner_id + path + timestamp [+ access_token + shop_id].
export function shopeeSign(path, timestamp, accessToken = '', shopId = '') {
  const base = `${process.env.SHOPEE_PARTNER_ID || ''}${path}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', process.env.SHOPEE_PARTNER_KEY || '').update(base).digest('hex');
}

export function createShopeeAuthorization() {
  assertShopeeConfig();
  const state = crypto.randomBytes(24).toString('base64url');
  const url = new URL(hosts().auth);
  url.searchParams.set('partner_id', process.env.SHOPEE_PARTNER_ID);
  url.searchParams.set('auth_type', 'seller');
  url.searchParams.set('redirect_uri', process.env.SHOPEE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return { url: url.toString(), state, cookie: seal({ state, createdAt: Date.now() }) };
}

async function shopeeRequest(path, { query = {}, body, token = '', shopId = '', fetch: fetchImpl = fetch, timeout = 12000 } = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(hosts().api + path);
  url.searchParams.set('partner_id', process.env.SHOPEE_PARTNER_ID || '');
  url.searchParams.set('timestamp', String(timestamp));
  url.searchParams.set('sign', shopeeSign(path, timestamp, token, shopId));
  if (token) {
    url.searchParams.set('access_token', token);
    url.searchParams.set('shop_id', String(shopId));
  }
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetchImpl(url.toString(), {
    method: body ? 'POST' : 'GET',
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout)
  });
  const data = await response.json().catch(() => ({}));
  // A Shopee costuma responder 200 com `error` preenchido; os dois casos são tratados como falha.
  if (!response.ok || data.error) {
    const authFailure = response.status === 401 || /access_token|error_auth|invalid_acceess_token|invalid_access_token/i.test(String(data.error || ''));
    throw shopeeError(
      data.message || data.error || 'A Shopee recusou a operação.',
      authFailure ? 401 : 502,
      authFailure ? 'SHOPEE_SESSION_EXPIRED' : 'SHOPEE_API_ERROR',
      { error: data.error || null, request_id: data.request_id || null }
    );
  }
  return data;
}

function tokenResult(data, shopId) {
  if (!data.access_token) throw shopeeError('A Shopee não devolveu o token de acesso.');
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    shop_id: Number(data.shop_id || shopId),
    expires_at: Date.now() + Number(data.expire_in || 0) * 1000
  };
}

export async function exchangeShopeeCode(code, shopId, options = {}) {
  const data = await shopeeRequest('/api/v2/auth/token/get', {
    ...options,
    body: { code, shop_id: Number(shopId), partner_id: Number(process.env.SHOPEE_PARTNER_ID) }
  });
  return tokenResult(data, shopId);
}

export async function refreshShopeeAccess(refreshToken, shopId, options = {}) {
  const data = await shopeeRequest('/api/v2/auth/access_token/get', {
    ...options,
    body: { refresh_token: refreshToken, shop_id: Number(shopId), partner_id: Number(process.env.SHOPEE_PARTNER_ID) }
  });
  return tokenResult(data, shopId);
}

// O access token vale 4 horas e o refresh token 30 dias; o cookie dura o mesmo que o refresh token.
const SESSION_MAX_AGE = 30 * 86400;

export async function shopeeSession(request, options = {}) {
  const session = unseal(readCookie(request, 'shopee_session'));
  if (!session?.access_token || !session.shop_id) {
    throw shopeeError('Conecte sua loja da Shopee.', 401, 'SHOPEE_NOT_CONNECTED');
  }
  if (session.expires_at >= Date.now() + 60000) return { session, cookie: null };
  try {
    const renewed = await refreshShopeeAccess(session.refresh_token, session.shop_id, options);
    return { session: renewed, cookie: cookie('shopee_session', seal(renewed), SESSION_MAX_AGE) };
  } catch (error) {
    // Outra requisição simultânea pode já ter renovado; o token antigo continua valendo até vencer.
    if (session.expires_at > Date.now()) return { session, cookie: null };
    throw shopeeError('A conexão com a Shopee expirou. Conecte a loja novamente.', 401, 'SHOPEE_SESSION_EXPIRED');
  }
}

export function shopeeSessionCookie(token) {
  return cookie('shopee_session', seal(token), SESSION_MAX_AGE);
}

function chunks(values, size) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size));
}

function priceOf(entry) {
  const info = Array.isArray(entry?.price_info) ? entry.price_info[0] : null;
  return { current: Number(info?.current_price || 0), original: Number(info?.original_price || 0) };
}

export async function listShopItems(session, options = {}) {
  const call = (path, query) => shopeeRequest(path, { ...options, query, token: session.access_token, shopId: session.shop_id });
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 100));

  const [shop, list] = await Promise.all([
    call('/api/v2/shop/get_shop_info', {}),
    call('/api/v2/product/get_item_list', { offset: 0, page_size: limit, item_status: 'NORMAL' })
  ]);
  const ids = (list.response?.item || []).map(item => String(item.item_id));

  const baseLists = await mapLimit(chunks(ids, 50), 3, group => call('/api/v2/product/get_item_base_info', { item_id_list: group.join(',') }));
  const extraLists = await mapLimit(chunks(ids, 50), 3, group => call('/api/v2/product/get_item_extra_info', { item_id_list: group.join(',') }));
  const sales = new Map(extraLists.flatMap(result => result.response?.item_list || []).map(item => [String(item.item_id), Number(item.sale || 0)]));
  const baseItems = baseLists.flatMap(result => result.response?.item_list || []);

  // Anúncios com variações não trazem preço nem estoque no item: vêm de cada modelo.
  // Um anúncio com erro não derruba a sincronização; só a perda de acesso interrompe.
  const items = (await mapLimit(baseItems, 4, async item => {
    const id = String(item.item_id);
    let price = priceOf(item);
    let stock = Number(item.stock_info_v2?.summary_info?.total_available_stock || 0);
    if (item.has_model) {
      try {
        const models = (await call('/api/v2/product/get_model_list', { item_id: id })).response?.model || [];
        const prices = models.map(priceOf).filter(entry => entry.current > 0);
        const cheapest = prices.sort((a, b) => a.current - b.current)[0] || { current: 0, original: 0 };
        price = cheapest;
        stock = models.reduce((sum, model) => sum + Number(model.stock_info_v2?.summary_info?.total_available_stock || 0), 0);
      } catch (error) {
        if (error.status === 401) throw error;
        return null;
      }
    }
    return {
      id,
      title: String(item.item_name || 'Anúncio sem título'),
      sku: String(item.item_sku || ''),
      price: price.current,
      originalPrice: price.original > price.current ? price.original : null,
      hasVariations: Boolean(item.has_model),
      availableQuantity: stock,
      soldQuantity: sales.get(id) ?? 0,
      status: item.item_status === 'NORMAL' ? 'active' : String(item.item_status || '').toLowerCase(),
      thumbnail: item.image?.image_url_list?.[0] || null,
      permalink: `https://shopee.com.br/product/${encodeURIComponent(session.shop_id)}/${encodeURIComponent(id)}`
    };
  })).filter(Boolean);

  return {
    shop: { id: String(session.shop_id), name: String(shop.shop_name || shop.response?.shop_name || '') },
    items,
    unavailable: ids.length - items.length,
    paging: { total: Number(list.response?.total_count || items.length), limit, offset: 0 },
    syncedAt: Date.now()
  };
}

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { seal, unseal } from '../api/_auth.js';
import { createShopeeAuthorization, listShopItems, shopeeSession, shopeeSign } from '../api/_shopee.js';

process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-bytes';
process.env.SHOPEE_PARTNER_ID = '2001887';
process.env.SHOPEE_PARTNER_KEY = 'chave-de-teste';
process.env.SHOPEE_REDIRECT_URI = 'https://exemplo.vercel.app/integracao/shopee/retorno';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function requestWith(session) {
  return new Request('http://localhost/api/shopee/listings', { headers: { cookie: `shopee_session=${encodeURIComponent(seal(session))}` } });
}

test('assina chamadas de loja na ordem exigida pela Shopee', () => {
  const expected = crypto.createHmac('sha256', 'chave-de-teste')
    .update('2001887/api/v2/shop/get_shop_info165571443159777174636562737266615546704c6d14701711')
    .digest('hex');
  assert.equal(shopeeSign('/api/v2/shop/get_shop_info', 1655714431, '59777174636562737266615546704c6d', 14701711), expected);
  assert.match(expected, /^[0-9a-f]{64}$/);
});

test('gera o link de autorização do Brasil com state', () => {
  const authorization = createShopeeAuthorization();
  const url = new URL(authorization.url);
  assert.equal(url.origin + url.pathname, 'https://open.shopee.com.br/auth');
  assert.equal(url.searchParams.get('partner_id'), '2001887');
  assert.equal(url.searchParams.get('auth_type'), 'seller');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('redirect_uri'), process.env.SHOPEE_REDIRECT_URI);
  assert.equal(unseal(authorization.cookie).state, url.searchParams.get('state'));
});

test('sincroniza anúncios simples e com variações', async () => {
  const fetchMock = async url => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://openplatform.shopee.com.br');
    assert.equal(parsed.searchParams.get('shop_id'), '77');
    assert.equal(parsed.searchParams.get('access_token'), 'A');
    assert.match(parsed.searchParams.get('sign'), /^[0-9a-f]{64}$/);
    switch (parsed.pathname) {
      case '/api/v2/shop/get_shop_info': return response({ error: '', shop_name: 'Loja Teste' });
      case '/api/v2/product/get_item_list':
        assert.equal(parsed.searchParams.get('item_status'), 'NORMAL');
        return response({ error: '', response: { item: [{ item_id: 1 }, { item_id: 2 }], total_count: 2 } });
      case '/api/v2/product/get_item_base_info':
        assert.equal(parsed.searchParams.get('item_id_list'), '1,2');
        return response({ error: '', response: { item_list: [
          { item_id: 1, item_name: 'Caneca', item_sku: 'CAN-1', item_status: 'NORMAL', has_model: false,
            price_info: [{ current_price: 29.9, original_price: 39.9 }],
            stock_info_v2: { summary_info: { total_available_stock: 12 } }, image: { image_url_list: ['https://img/1.jpg'] } },
          { item_id: 2, item_name: 'Camiseta', item_status: 'NORMAL', has_model: true }
        ] } });
      case '/api/v2/product/get_item_extra_info':
        return response({ error: '', response: { item_list: [{ item_id: 1, sale: 5 }, { item_id: 2, sale: 9 }] } });
      case '/api/v2/product/get_model_list':
        assert.equal(parsed.searchParams.get('item_id'), '2');
        return response({ error: '', response: { model: [
          { price_info: [{ current_price: 59.9, original_price: 59.9 }], stock_info_v2: { summary_info: { total_available_stock: 3 } } },
          { price_info: [{ current_price: 49.9, original_price: 49.9 }], stock_info_v2: { summary_info: { total_available_stock: 4 } } }
        ] } });
      default: assert.fail(`URL inesperada: ${url}`);
    }
  };
  const result = await listShopItems({ access_token: 'A', shop_id: 77 }, { fetch: fetchMock });
  assert.equal(result.shop.name, 'Loja Teste');
  assert.equal(result.paging.total, 2);
  const [simple, variations] = result.items;
  assert.deepEqual(
    { price: simple.price, originalPrice: simple.originalPrice, stock: simple.availableQuantity, sold: simple.soldQuantity, sku: simple.sku, status: simple.status },
    { price: 29.9, originalPrice: 39.9, stock: 12, sold: 5, sku: 'CAN-1', status: 'active' }
  );
  assert.equal(simple.permalink, 'https://shopee.com.br/product/77/1');
  assert.deepEqual({ price: variations.price, stock: variations.availableQuantity, sold: variations.soldQuantity, hasVariations: variations.hasVariations },
    { price: 49.9, stock: 7, sold: 9, hasVariations: true });
});

test('trata erro de token da Shopee como sessão expirada', async () => {
  const fetchMock = async () => response({ error: 'invalid_access_token', message: 'Invalid access_token.' });
  await assert.rejects(
    listShopItems({ access_token: 'A', shop_id: 77 }, { fetch: fetchMock }),
    error => error.status === 401 && error.code === 'SHOPEE_SESSION_EXPIRED'
  );
});

test('renova o token vencido e devolve o novo cookie', async () => {
  const fetchMock = async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/v2/auth/access_token/get');
    assert.deepEqual(JSON.parse(options.body), { refresh_token: 'R', shop_id: 77, partner_id: 2001887 });
    return response({ error: '', access_token: 'B', refresh_token: 'R2', expire_in: 14400, shop_id: 77 });
  };
  const current = await shopeeSession(requestWith({ access_token: 'A', refresh_token: 'R', shop_id: 77, expires_at: Date.now() - 1000 }), { fetch: fetchMock });
  assert.equal(current.session.access_token, 'B');
  assert.equal(current.session.refresh_token, 'R2');
  assert.match(current.cookie, /^shopee_session=/);
});

test('pede conexão quando não há loja da Shopee', async () => {
  await assert.rejects(
    shopeeSession(new Request('http://localhost/api/shopee/listings')),
    error => error.status === 401 && error.code === 'SHOPEE_NOT_CONNECTED'
  );
});

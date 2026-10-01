import assert from 'node:assert/strict';
import test from 'node:test';
import { seal, unseal } from '../api/_auth.js';
import { createTiktokAuthorization, exchangeTiktokCode, listShopProducts, tiktokSession, tiktokSign } from '../api/_tiktok.js';

process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-bytes';
process.env.TIKTOK_APP_KEY = '29a39d';
process.env.TIKTOK_APP_SECRET = 'e59af819cc';
process.env.TIKTOK_SERVICE_ID = '7300000000000000001';

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function requestWith(session) {
  return new Request('http://localhost/api/tiktok/listings', { headers: { cookie: `tiktok_session=${encodeURIComponent(seal(session))}` } });
}

test('reproduz a assinatura do exemplo oficial do TikTok Shop', () => {
  assert.equal(
    tiktokSign('/authorization/202309/shops', { app_key: '29a39d', timestamp: '1623812664' }),
    'b596b73e0cc6de07ac26f036364178ab16b0a907af13d43f0a0cd2345f582dc8'
  );
});

test('ignora sign e access_token e inclui o corpo na assinatura', () => {
  const withBody = tiktokSign('/product/202502/products/search', { app_key: '29a39d', timestamp: '1', shop_cipher: 'C' }, '{"status":"ACTIVATE"}');
  assert.equal(tiktokSign('/product/202502/products/search', { app_key: '29a39d', timestamp: '1', shop_cipher: 'C', sign: 'x', access_token: 'y' }, '{"status":"ACTIVATE"}'), withBody);
  assert.notEqual(tiktokSign('/product/202502/products/search', { app_key: '29a39d', timestamp: '1', shop_cipher: 'C' }), withBody);
});

test('gera o link de autorização com service_id e state', () => {
  const authorization = createTiktokAuthorization();
  const url = new URL(authorization.url);
  assert.equal(url.origin + url.pathname, 'https://services.tiktokshop.com/open/authorize');
  assert.equal(url.searchParams.get('service_id'), process.env.TIKTOK_SERVICE_ID);
  assert.equal(unseal(authorization.cookie).state, url.searchParams.get('state'));
});

test('troca o código por tokens usando grant_type authorized_code', async () => {
  const fetchMock = async url => {
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, 'https://auth.tiktok-shops.com/api/v2/token/get');
    assert.equal(parsed.searchParams.get('grant_type'), 'authorized_code');
    assert.equal(parsed.searchParams.get('auth_code'), 'CODE');
    return response({ code: 0, data: { access_token: 'A', refresh_token: 'R', access_token_expire_in: 1900000000, refresh_token_expire_in: 1930000000, seller_name: 'Loja' } });
  };
  const token = await exchangeTiktokCode('CODE', { fetch: fetchMock });
  assert.equal(token.access_token, 'A');
  assert.equal(token.expires_at, 1900000000 * 1000);
  assert.equal(token.seller_name, 'Loja');
});

test('sincroniza produtos com preço mínimo e estoque somado dos SKUs', async () => {
  const fetchMock = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(options.headers['x-tts-access-token'], 'A');
    assert.equal(parsed.searchParams.get('access_token'), null);
    assert.match(parsed.searchParams.get('sign'), /^[0-9a-f]{64}$/);
    if (parsed.pathname === '/authorization/202309/shops') {
      return response({ code: 0, data: { shops: [{ id: '1', name: 'Loja BR', region: 'BR', cipher: 'CIPHER' }] } });
    }
    if (parsed.pathname === '/product/202502/products/search') {
      assert.equal(options.method, 'POST');
      assert.equal(parsed.searchParams.get('shop_cipher'), 'CIPHER');
      assert.deepEqual(JSON.parse(options.body), { status: 'ACTIVATE' });
      return response({ code: 0, data: { total_count: 2, products: [
        { id: '10', title: 'Caneca', status: 'ACTIVATE', skus: [{ seller_sku: 'CAN-1', price: { sale_price: '39.90' }, inventory: [{ quantity: 5 }, { quantity: 2 }] }] },
        { id: '11', title: 'Camiseta', status: 'ACTIVATE', skus: [
          { seller_sku: 'CAM-P', price: { sale_price: '59.90' }, inventory: [{ quantity: 3 }] },
          { seller_sku: 'CAM-M', price: { tax_exclusive_price: '49.90' }, inventory: [{ quantity: 4 }] }
        ] }
      ] } });
    }
    assert.fail(`URL inesperada: ${url}`);
  };
  const result = await listShopProducts({ access_token: 'A' }, { fetch: fetchMock });
  assert.equal(result.shop.name, 'Loja BR');
  assert.equal(result.paging.total, 2);
  const [simple, variations] = result.items;
  assert.deepEqual({ price: simple.price, stock: simple.availableQuantity, sku: simple.sku, status: simple.status, sold: simple.soldQuantity },
    { price: 39.9, stock: 7, sku: 'CAN-1', status: 'active', sold: null });
  assert.deepEqual({ price: variations.price, stock: variations.availableQuantity, sku: variations.sku, hasVariations: variations.hasVariations },
    { price: 49.9, stock: 7, sku: '', hasVariations: true });
});

test('avisa quando nenhuma loja foi autorizada', async () => {
  const fetchMock = async () => response({ code: 0, data: { shops: [] } });
  await assert.rejects(listShopProducts({ access_token: 'A' }, { fetch: fetchMock }), error => error.code === 'TIKTOK_NO_SHOP');
});

test('renova o token perto do vencimento e pede reconexão quando não dá', async () => {
  const renewed = await tiktokSession(
    requestWith({ access_token: 'A', refresh_token: 'R', expires_at: Date.now() + 3600000, refresh_expires_at: Date.now() + 86400000 * 30 }),
    { fetch: async () => response({ code: 0, data: { access_token: 'B', refresh_token: 'R2', access_token_expire_in: 1900000000, refresh_token_expire_in: 1930000000 } }) }
  );
  assert.equal(renewed.session.access_token, 'B');
  assert.match(renewed.cookie, /^tiktok_session=/);

  await assert.rejects(
    tiktokSession(requestWith({ access_token: 'A', refresh_token: 'R', expires_at: Date.now() - 1000 }), { fetch: async () => response({ code: 105002, message: 'refresh token expired' }) }),
    error => error.status === 401 && error.code === 'TIKTOK_SESSION_EXPIRED'
  );
});

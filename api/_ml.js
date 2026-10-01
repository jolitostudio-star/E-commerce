function mlError(message, status = 502, code = 'ML_API_ERROR', detail = null) {
  return Object.assign(new Error(message), { status, code, detail });
}

async function mlFetch(path, token, options = {}) {
  if (!token) throw mlError('Conecte sua conta do Mercado Livre.', 401, 'ML_NOT_CONNECTED');
  const response = await (options.fetch || fetch)(`https://api.mercadolibre.com${path}`, {
    method: options.method || 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeout || 12000)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.error || 'O Mercado Livre recusou a operação.';
    throw Object.assign(mlError(message, response.status === 401 ? 401 : 502, 'ML_API_ERROR', data), { upstreamStatus: response.status });
  }
  return data;
}

async function mapLimit(values, limit, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return output;
}

// Oferta de referência de um produto de catálogo. O buy_box_winner vem nulo quando não há disputa
// entre vendedores; nesse caso a referência é a oferta mais barata de /products/{id}/items.
export async function catalogWinner(product, token, options = {}) {
  if (Number(product?.buy_box_winner?.price) > 0) return product.buy_box_winner;
  if (!product?.id) return null;
  try {
    const offers = await mlFetch(`/products/${encodeURIComponent(product.id)}/items?limit=20`, token, options);
    const priced = (offers?.results || []).filter(offer => Number(offer?.price) > 0).sort((a, b) => Number(a.price) - Number(b.price));
    return priced[0] || null;
  } catch (error) {
    if (error.status === 401) throw error;
    return null;
  }
}

export async function listSellerItems(token, options = {}) {
  const me = await mlFetch('/users/me', token, options);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 50));
  const search = await mlFetch(`/users/${encodeURIComponent(me.id)}/items/search?status=active&limit=${limit}`, token, options);
  const ids = (search.results || []).map(String);
  // Um anúncio com erro não deve derrubar a sincronização inteira; só a perda de acesso interrompe.
  const rawItems = await mapLimit(ids, 8, async id => {
    try {
      return await mlFetch(`/items/${encodeURIComponent(id)}`, token, options);
    } catch (error) {
      if (error.status === 401) throw error;
      return null;
    }
  });
  const items = rawItems.filter(Boolean).map(item => ({
    id: String(item.id),
    title: String(item.title || 'Anúncio sem título'),
    sku: String(item.seller_custom_field || item.attributes?.find(attribute => attribute.id === 'SELLER_SKU')?.value_name || ''),
    price: Number(item.price || 0),
    originalPrice: Number(item.original_price || 0) || null,
    availableQuantity: Number(item.available_quantity || 0),
    soldQuantity: Number(item.sold_quantity || 0),
    status: String(item.status || ''),
    condition: String(item.condition || ''),
    listingType: String(item.listing_type_id || ''),
    thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail.replace(/^http:/, 'https:') : null,
    permalink: typeof item.permalink === 'string' ? item.permalink : null,
    catalogListing: Boolean(item.catalog_listing),
    freeShipping: Boolean(item.shipping?.free_shipping)
  }));
  return {
    seller: { id: String(me.id), nickname: String(me.nickname || ''), reputation: me.seller_reputation?.level_id || null },
    items,
    unavailable: ids.length - items.length,
    paging: { total: Number(search.paging?.total || items.length), limit, offset: 0 },
    syncedAt: Date.now()
  };
}

// Data de hoje (AAAA-MM-DD) no fuso do Brasil, independente do fuso do servidor.
function todayInBrazil() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export async function applyBulkPriceDiscount(token, input, options = {}) {
  input = input && typeof input === 'object' ? input : {};
  const itemIds = Array.isArray(input.itemIds) ? [...new Set(input.itemIds.map(String))] : [];
  const discount = Number(input.discount);
  const startDate = String(input.startDate || '');
  const finishDate = String(input.finishDate || '');
  if (!itemIds.length || itemIds.length > 50) throw mlError('Selecione entre 1 e 50 anúncios.', 400, 'INVALID_ITEMS');
  if (!Number.isFinite(discount) || discount < 5 || discount > 80) throw mlError('O desconto deve ficar entre 5% e 80%.', 400, 'INVALID_DISCOUNT');
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const days = (Date.parse(`${finishDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000;
  if (!isoDate.test(startDate) || !isoDate.test(finishDate) || !Number.isFinite(days) || days < 0 || days > 13) {
    throw mlError('Escolha um período válido de até 14 dias.', 400, 'INVALID_DATES');
  }
  if (startDate < (options.today || todayInBrazil())) {
    throw mlError('A promoção não pode começar em uma data passada.', 400, 'INVALID_DATES');
  }

  const results = await mapLimit(itemIds, 4, async itemId => {
    try {
      const item = await mlFetch(`/items/${encodeURIComponent(itemId)}`, token, options);
      const originalPrice = Number(item.price || 0);
      if (!(originalPrice > 0)) throw mlError('Preço atual inválido.', 422, 'INVALID_PRICE');
      const dealPrice = Math.round(originalPrice * (1 - discount / 100) * 100) / 100;
      const response = await mlFetch(`/seller-promotions/items/${encodeURIComponent(itemId)}?app_version=v2`, token, {
        ...options,
        method: 'POST',
        body: {
          deal_price: dealPrice,
          start_date: `${startDate}T00:00:00`,
          finish_date: `${finishDate}T00:00:00`,
          promotion_type: 'PRICE_DISCOUNT'
        }
      });
      return { itemId, ok: true, originalPrice, dealPrice, response };
    } catch (error) {
      return { itemId, ok: false, error: error.message, detail: error.detail || null };
    }
  });
  return {
    results,
    applied: results.filter(result => result.ok).length,
    failed: results.filter(result => !result.ok).length
  };
}

export { mlError, mlFetch, mapLimit };

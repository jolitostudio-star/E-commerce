import { catalogWinner } from './_ml.js';

function percentile(sorted, ratio) {
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

function apiError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

// Recebe um percentual (ex.: 11.9) e devolve a fração, limitada entre 0 e o teto.
function percentParam(value, fallback, max) {
  const number = value === null || value === undefined || value === '' ? NaN : Number(value);
  return (Number.isFinite(number) ? Math.min(Math.max(number, 0), max) : fallback) / 100;
}

export async function researchMercadoLivre(query, cost, token, options = {}) {
  if (!token) throw apiError('Conecte o Mercado Livre para pesquisar anúncios reais.', 401, 'ML_NOT_CONNECTED');
  const fetcher = options.fetch || fetch;
  const siteId = options.siteId || process.env.ML_SITE_ID || 'MLB';
  const url = new URL('https://api.mercadolibre.com/products/search');
  url.searchParams.set('q', query);
  url.searchParams.set('site_id', siteId);
  url.searchParams.set('status', 'active');
  url.searchParams.set('limit', '12');
  const response = await fetcher(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error('Mercado Livre pesquisa de catálogo recusada', { status: response.status, detail });
    throw apiError(
      response.status === 401 ? 'A conexão com o Mercado Livre expirou.' : 'O Mercado Livre não respondeu à pesquisa.',
      response.status === 401 ? 401 : 502,
      'ML_API_ERROR'
    );
  }
  const payload = await response.json();
  const productIds = (payload.results || [])
    .map(product => typeof product === 'string' ? product : product?.id)
    .filter(Boolean)
    .slice(0, 12);
  const details = await Promise.all(productIds.map(async productId => {
    try {
      const detailUrl = new URL(`https://api.mercadolibre.com/products/${encodeURIComponent(productId)}`);
      const detailResponse = await fetcher(detailUrl, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(9000)
      });
      if (!detailResponse.ok) return null;
      return await detailResponse.json();
    } catch {
      return null;
    }
  }));
  const winners = await Promise.all(details.map(product => product ? catalogWinner(product, token, { fetch: fetcher }) : null));
  const items = details
    .map((product, index) => ({ product, winner: winners[index] }))
    .filter(({ winner }) => Number(winner?.price) > 0)
    .map(({ product, winner }, index) => {
      return {
        id: String(winner.item_id || product.id || ''),
        title: String(product.name || winner.title || 'Produto sem título'),
        seller: String(winner.official_store_name || `Oferta do catálogo ${index + 1}`),
        price: Number(winner.price),
        sold: Number(winner.sold_quantity || 0),
        rating: Number(product.reviews?.rating_average || winner.reviews?.rating_average || 0),
        shipFree: Boolean(winner.shipping?.free_shipping),
        ship: 0,
        trend: 0,
        permalink: typeof winner.permalink === 'string'
          ? winner.permalink
          : (typeof product.permalink === 'string' ? product.permalink : null)
      };
    });
  if (items.length === 0) {
    throw apiError('Não encontrei uma oferta ativa no catálogo para esse termo.', 404, 'INSUFFICIENT_RESULTS');
  }
  const prices = items.map(item => item.price).sort((a, b) => a - b);
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const med = percentile(prices, 0.5);
  const numericCost = Math.max(0, Number(cost) || 0);
  const commission = percentParam(options.commission, 11.9, 50);
  const target = percentParam(options.target, 25, 80);
  const floor = numericCost > 0 && commission + target < 0.95 ? numericCost / (1 - commission - target) : 0;
  return {
    q: query,
    cost: numericCost,
    commission,
    target,
    floor,
    comps: items,
    stats: { min: prices[0], max: prices.at(-1), avg, med },
    trend: 0,
    rec: {
      point: Math.max(floor, Math.min(med, avg * 0.98)),
      low: percentile(prices, 0.25),
      high: percentile(prices, 0.75)
    },
    when: Date.now(),
    source: 'mercado_livre_catalog',
    sampleSize: items.length
  };
}

import { catalogWinner, mapLimit, mlError, mlFetch } from './_ml.js';

const siteId = () => process.env.ML_SITE_ID || 'MLB';

// Ordem oficial da API de tendências: 10 buscas que mais crescem, 20 mais desejadas e 20 mais populares.
export const TREND_GROUPS = [
  { key: 'growth', label: 'Maior crescimento', from: 0, to: 10, demand: 'Em crescimento', points: 3 },
  { key: 'desired', label: 'Mais desejados', from: 10, to: 30, demand: 'Alta', points: 2 },
  { key: 'popular', label: 'Mais populares', from: 30, to: 50, demand: 'Alta e estável', points: 1 }
];

function groupOf(index) {
  return TREND_GROUPS.find(group => index >= group.from && index < group.to) || TREND_GROUPS.at(-1);
}

export async function getTrends(token, options = {}) {
  const category = options.category ? String(options.category) : '';
  if (category && !/^[A-Z]{3}\d+$/.test(category)) throw mlError('Categoria inválida.', 400, 'INVALID_CATEGORY');
  const list = await mlFetch(`/trends/${siteId()}${category ? `/${category}` : ''}`, token, options);
  const trends = (Array.isArray(list) ? list : [])
    .slice(0, 50)
    .map((trend, index) => {
      const group = groupOf(index);
      return {
        rank: index + 1,
        keyword: String(trend?.keyword || '').trim(),
        url: typeof trend?.url === 'string' ? trend.url : null,
        group: group.key,
        groupLabel: group.label,
        demand: group.demand
      };
    })
    .filter(trend => trend.keyword);
  return { siteId: siteId(), category: category || null, trends, source: 'mercado_livre_trends', fetchedAt: Date.now() };
}

export async function getCategories(token, options = {}) {
  const list = await mlFetch(`/sites/${siteId()}/categories`, token, options);
  return {
    categories: (Array.isArray(list) ? list : [])
      .map(category => ({ id: String(category.id || ''), name: String(category.name || '') }))
      .filter(category => category.id && category.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  };
}

export function priceBand(price) {
  if (!(price > 0)) return null;
  if (price <= 50) return 'Até R$ 50';
  if (price <= 150) return 'R$ 50 a 150';
  if (price <= 500) return 'R$ 150 a 500';
  return 'Acima de R$ 500';
}

// Heurística: quantidade de produtos no catálogo + força logística de quem vence a compra.
export function competitionLevel(catalogProducts, fullShare) {
  const levels = ['Baixa', 'Média', 'Alta'];
  let index = catalogProducts === null ? 1 : catalogProducts <= 30 ? 0 : catalogProducts <= 300 ? 1 : 2;
  if (fullShare >= 0.5) index = Math.min(2, index + 1);
  return levels[index];
}

export function opportunityOf(group, competition) {
  const demandPoints = TREND_GROUPS.find(item => item.key === group)?.points || 1;
  const competitionPoints = { Baixa: 2, 'Média': 1, Alta: 0 }[competition] ?? 1;
  const score = demandPoints + competitionPoints;
  return { score, label: score >= 4 ? 'Promissora' : score >= 2 ? 'Avaliar' : 'Disputada' };
}

export async function keywordInsight(token, keyword, options = {}) {
  const q = String(keyword || '').trim();
  if (q.length < 2 || q.length > 120) throw mlError('Informe um termo entre 2 e 120 caracteres.', 400, 'INVALID_QUERY');
  const site = siteId();
  const [domain, search] = await Promise.all([
    mlFetch(`/sites/${site}/domain_discovery/search?limit=1&q=${encodeURIComponent(q)}`, token, options).catch(error => {
      if (error.status === 401) throw error;
      return null;
    }),
    mlFetch(`/products/search?status=active&limit=10&site_id=${site}&q=${encodeURIComponent(q)}`, token, options)
  ]);
  const ids = (search?.results || []).map(product => typeof product === 'string' ? product : product?.id).filter(Boolean).slice(0, 6);
  const products = await mapLimit(ids, 3, id => mlFetch(`/products/${encodeURIComponent(id)}`, token, options).catch(error => {
    if (error.status === 401) throw error;
    return null;
  }));
  const winners = (await mapLimit(products, 3, product => product ? catalogWinner(product, token, options) : null)).filter(winner => Number(winner?.price) > 0);
  const prices = winners.map(winner => Number(winner.price)).sort((a, b) => a - b);
  const catalogProducts = Number.isFinite(Number(search?.paging?.total)) ? Number(search.paging.total) : null;
  const fullShare = winners.length ? winners.filter(winner => winner.shipping?.logistic_type === 'fulfillment').length / winners.length : 0;
  const officialShare = winners.length ? winners.filter(winner => winner.official_store_id || winner.official_store_name).length / winners.length : 0;
  const middle = Math.floor(prices.length / 2);
  const med = !prices.length ? null : prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
  const competition = competitionLevel(catalogProducts, fullShare);
  const first = Array.isArray(domain) ? domain[0] : null;
  return {
    keyword: q,
    category: first?.category_id ? { id: String(first.category_id), name: String(first.category_name || '') } : null,
    domain: first?.domain_name ? String(first.domain_name) : null,
    competition: { level: competition, catalogProducts, sample: winners.length, fullShare, officialShare },
    prices: prices.length ? { min: prices[0], med, max: prices.at(-1), sample: prices.length } : null,
    priceBand: priceBand(med),
    fetchedAt: Date.now()
  };
}

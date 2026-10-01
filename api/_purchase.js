import { catalogWinner, mapLimit, mlError, mlFetch } from './_ml.js';
import { feeCalculator, normalizeText, solvePrice } from './_listing.js';

// "Vale a pena comprar?": com o custo de compra de um produto, estima se a revenda no Mercado Livre compensa.
// Preço de mercado, tarifa e frete vêm da API oficial; o que for estimativa sai marcado como tal.

const siteId = () => process.env.ML_SITE_ID || 'MLB';
const round2 = value => Math.round(value * 100) / 100;
const brl = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percent = value => (value * 100).toFixed(1).replace(".", ",") + "%";

// No Brasil, a partir deste preço o frete grátis é obrigatório e o custo do envio fica com o vendedor.
export const FREE_SHIPPING_MIN = 79;

// Tamanhos de caixa usados para cotar o frete (dimensões em cm e peso em gramas, formato da API).
export const PACKAGE_SIZES = {
  pequeno: { label: 'Pequeno', detail: 'até 20×15×10 cm e 300 g', dimensions: '20x15x10,300', packaging: 1.5 },
  medio: { label: 'Médio', detail: 'até 30×20×15 cm e 1 kg', dimensions: '30x20x15,1000', packaging: 3 },
  grande: { label: 'Grande', detail: 'até 40×30×25 cm e 3 kg', dimensions: '40x30x25,3000', packaging: 6 }
};
const LISTING_TYPES = { gold_special: 'Clássico', gold_pro: 'Premium' };

function number(value, { min = 0, max = Infinity, fallback = null } = {}) {
  const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function purchaseInput(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const text = String(raw.query || '').trim().slice(0, 120);
  const digits = text.replace(/\D/g, '');
  // Código de barras: EAN-8, UPC-A (12), EAN-13 ou GTIN-14 digitado ou lido pela câmera.
  const gtin = /^\d{8}$|^\d{12,14}$/.test(text.replace(/\s/g, '')) ? digits : '';
  const size = PACKAGE_SIZES[raw.size] ? raw.size : 'pequeno';
  return {
    query: gtin ? '' : text,
    gtin,
    cost: number(raw.cost, { max: 1e6, fallback: 0 }),
    quantity: Math.round(number(raw.quantity, { min: 1, max: 100000, fallback: 1 })),
    size,
    packaging: number(raw.packaging, { max: 1e4, fallback: PACKAGE_SIZES[size].packaging }),
    shipping: number(raw.shipping, { max: 1e4 }),
    tax: number(raw.tax, { max: 50, fallback: 0 }) / 100,
    target: number(raw.target, { max: 80, fallback: 25 }) / 100,
    listingType: LISTING_TYPES[raw.listingType] ? raw.listingType : 'gold_special',
    // Preço de venda informado pelo usuário (opcional): substitui o preço de mercado na conta.
    salePrice: number(raw.salePrice, { min: 0, max: 1e6 }) > 0 ? number(raw.salePrice, { min: 0, max: 1e6 }) : null
  };
}

function percentile(sorted, ratio) {
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)))];
}

async function searchCatalog(token, params, limit, options) {
  const query = new URLSearchParams({ site_id: siteId(), status: 'active', limit: String(limit), ...params });
  const search = await mlFetch(`/products/search?${query}`, token, options);
  const ids = (search.results || []).map(result => typeof result === 'string' ? result : result?.id).filter(Boolean).slice(0, limit);
  const products = await mapLimit(ids, 6, id => mlFetch(`/products/${encodeURIComponent(id)}`, token, options).catch(error => {
    if (error.status === 401) throw error;
    return null;
  }));
  const winners = await mapLimit(products, 6, product => product ? catalogWinner(product, token, options) : null);
  return products.map((product, index) => ({ product, winner: winners[index] })).filter(({ winner }) => Number(winner?.price) > 0).map(({ product, winner }) => ({
    productId: String(product.id),
    itemId: String(winner.item_id || ''),
    title: String(product.name || 'Produto do catálogo'),
    price: Number(winner.price),
    categoryId: String(winner.category_id || product.category_id || ''),
    shipFree: Boolean(winner.shipping?.free_shipping),
    permalink: typeof product.permalink === 'string' ? product.permalink : (typeof winner.permalink === 'string' ? winner.permalink : null)
  }));
}

const SEARCH_STOPWORDS = new Set('de da do das dos para com sem em no na nos nas e ou a o as os um uma'.split(' '));
const MULTIPACK = /\b(kit|combo|lote|atacado|pack|\d+\s*(un|und|unid|unidades|pcs|pecas|pares))\b/;
const words = text => normalizeText(text).split(/[^a-z0-9]+/).filter(word => word.length > 1 && !SEARCH_STOPWORDS.has(word));

// A busca do catálogo traz produtos parecidos mas diferentes (kits, lotes, acessórios). Fica com as ofertas cujo
// título tem mais palavras da busca e descarta kits/lotes, a não ser que a própria busca peça um kit.
export function relevantOffers(offers, reference) {
  const wanted = words(reference);
  if (!wanted.length) return offers;
  const wantsPack = MULTIPACK.test(normalizeText(reference));
  const scored = offers.map(offer => {
    const title = words(offer.title);
    return { offer, score: wanted.filter(word => title.includes(word)).length / wanted.length, pack: MULTIPACK.test(normalizeText(offer.title)) };
  });
  const pool = scored.filter(entry => wantsPack || !entry.pack);
  for (const minimum of [0.75, 0.5, 0.34]) {
    const kept = pool.filter(entry => entry.score >= minimum);
    if (kept.length >= 3) return kept.map(entry => entry.offer);
  }
  const matching = pool.filter(entry => entry.score > 0);
  return (matching.length ? matching : pool.length ? pool : scored).map(entry => entry.offer);
}

// Descarta preços fora da curva (menos de um terço ou mais do triplo da mediana).
export function withoutOutliers(offers) {
  if (offers.length < 4) return offers;
  const median = percentile(offers.map(offer => offer.price).sort((a, b) => a - b), 0.5);
  return offers.filter(offer => offer.price >= median / 3 && offer.price <= median * 3);
}

async function findOffers(token, input, options) {
  if (!input.gtin) {
    const found = await searchCatalog(token, { q: input.query }, 20, options);
    const kept = withoutOutliers(relevantOffers(found, input.query));
    return { offers: kept, ignored: found.length - kept.length, matched: null };
  }
  // Pelo código de barras vem o produto exato, mas quase sempre com uma oferta só; o nome dele traz as demais.
  const exact = await searchCatalog(token, { product_identifier: input.gtin }, 5, options);
  if (!exact.length) return { offers: [], ignored: 0, matched: null };
  const matched = exact[0].title;
  const byName = await searchCatalog(token, { q: words(matched).slice(0, 6).join(' ') }, 20, options).catch(error => {
    if (error.status === 401) throw error;
    return [];
  });
  const others = byName.filter(offer => !exact.some(item => item.productId === offer.productId));
  const kept = withoutOutliers([...exact, ...relevantOffers(others, matched)]);
  return { offers: kept, ignored: exact.length + others.length - kept.length, matched };
}

function mostCommon(values) {
  const counts = new Map();
  values.filter(Boolean).forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

// Custo de frete grátis que o vendedor paga, cotado pela API para o tamanho de caixa escolhido.
async function freeShippingCost(token, userId, price, input, options) {
  const params = new URLSearchParams({
    dimensions: PACKAGE_SIZES[input.size].dimensions,
    item_price: round2(price).toFixed(2),
    listing_type_id: input.listingType,
    mode: 'me2',
    condition: 'new',
    logistic_type: 'drop_off',
    free_shipping: 'true',
    verbose: 'true'
  });
  try {
    const quote = await mlFetch(`/users/${encodeURIComponent(userId)}/shipping_options/free?${params}`, token, options);
    const cost = Number(quote?.coverage?.all_country?.list_cost);
    return Number.isFinite(cost) && cost > 0 ? cost : null;
  } catch (error) {
    if (error.status === 401) throw error;
    return null;
  }
}

async function isTrending(token, query, options) {
  if (!query) return null;
  try {
    const trends = await mlFetch(`/trends/${siteId()}`, token, options);
    const wanted = normalizeText(query).split(/\s+/).filter(word => word.length > 2);
    const hit = (Array.isArray(trends) ? trends : []).find(trend => {
      const keyword = normalizeText(trend.keyword);
      return wanted.length && wanted.filter(word => keyword.includes(word)).length >= Math.min(2, wanted.length);
    });
    return hit ? String(hit.keyword) : null;
  } catch (error) {
    if (error.status === 401) throw error;
    return null;
  }
}

// Categoria provável de um texto (define a tarifa quando não há ofertas no catálogo).
async function predictCategory(token, query, options) {
  if (!query) return '';
  try {
    const found = await mlFetch(`/sites/${siteId()}/domain_discovery/search?limit=1&q=${encodeURIComponent(query)}`, token, options);
    return String((Array.isArray(found) ? found[0] : null)?.category_id || '');
  } catch (error) {
    if (error.status === 401) throw error;
    return '';
  }
}

export async function evaluatePurchase(token, raw, options = {}) {
  const input = purchaseInput(raw);
  if (!input.gtin && input.query.length < 3) throw mlError('Digite o nome do produto (mínimo 3 letras) ou leia o código de barras.', 400, 'INVALID_QUERY');
  if (!(input.cost > 0)) throw mlError('Informe o preço que você vai pagar por unidade.', 400, 'INVALID_COST');

  const [{ offers, ignored, matched }, me] = await Promise.all([findOffers(token, input, options), mlFetch('/users/me', token, options)]);
  if (!offers.length && input.salePrice === null) {
    throw mlError(input.gtin
      ? 'Esse código de barras não está no catálogo do Mercado Livre. Digite o nome do produto ou informe o preço de venda.'
      : 'Não encontrei ofertas comparáveis no catálogo do Mercado Livre. Informe o preço de venda que você viu para analisar.', 404, 'NO_OFFERS');
  }
  const prices = offers.map(offer => offer.price).sort((a, b) => a - b);
  const market = prices.length ? {
    min: prices[0], low: percentile(prices, 0.25), med: percentile(prices, 0.5), high: percentile(prices, 0.75), max: prices.at(-1),
    sampleSize: prices.length, ignored, categoryId: mostCommon(offers.map(offer => offer.categoryId))
  } : null;
  // Sem ofertas, a categoria (que define a tarifa) vem do preditor de categoria do Mercado Livre.
  const categoryId = market?.categoryId || await predictCategory(token, input.query || matched, options);

  const feeAt = feeCalculator(token, { category_id: categoryId, listing_type_id: input.listingType }, 0.14, options);
  const quotes = new Map();
  async function shippingAt(price) {
    if (price < FREE_SHIPPING_MIN) return { amount: 0, source: 'comprador_paga' };
    if (input.shipping !== null) return { amount: input.shipping, source: 'informado' };
    const key = round2(price).toFixed(2);
    if (!quotes.has(key)) quotes.set(key, freeShippingCost(token, me.id, price, input, options));
    const amount = await quotes.get(key);
    return amount === null ? { amount: null, source: 'indisponivel' } : { amount, source: 'mercado_livre_shipping_options' };
  }

  async function scenario(key, label, short, price) {
    const [fee, shipping] = await Promise.all([feeAt(price), shippingAt(price)]);
    const tax = round2(price * input.tax);
    const known = shipping.amount !== null;
    const profit = known ? round2(price - fee.amount - shipping.amount - input.packaging - input.cost - tax) : null;
    return {
      key, label, short, price,
      fee: { amount: round2(fee.amount), percentage: fee.percentage, fixed: fee.fixed, source: fee.source },
      shipping, packaging: input.packaging, tax, cost: input.cost,
      profit, margin: profit === null ? null : round2(profit / price * 10000) / 10000
    };
  }

  // Menor preço de venda para atingir a margem pedida, respeitando a regra do frete grátis a partir de R$ 79.
  async function priceFor(margin) {
    const base = input.cost + input.packaging;
    const below = await solvePrice(feeAt, base, 0, margin + input.tax, Math.max(10, base * 1.5));
    if (below !== null && below < FREE_SHIPPING_MIN) return below;
    const ship = await shippingAt(Math.max(FREE_SHIPPING_MIN, below || FREE_SHIPPING_MIN));
    if (ship.amount === null) return null;
    const above = await solvePrice(feeAt, base, ship.amount, margin + input.tax, Math.max(FREE_SHIPPING_MIN, below || FREE_SHIPPING_MIN));
    return above === null ? null : Math.max(FREE_SHIPPING_MIN, above);
  }

  // Com preço informado, a conta usa esse preço e o mercado vira referência; sem ele, mediana e 25% mais baratos.
  const manual = input.salePrice !== null;
  const plan = manual
    ? [['manual', 'Seu preço de venda', 'Seu preço', input.salePrice], ...(market ? [['mercado', 'Preço de mercado (mediana)', 'Mercado', market.med]] : [])]
    : [['mercado', 'Preço de mercado (mediana)', 'Mercado', market.med], ['competitivo', 'Preço competitivo (mais baratos)', 'Competitivo', market.low]];
  const [scenarios, minPrice, targetPrice, trending] = await Promise.all([
    Promise.all(plan.map(args => scenario(...args))),
    priceFor(0),
    priceFor(input.target),
    isTrending(token, input.query || matched || offers[0]?.title, options)
  ]);
  const [primary, secondary] = scenarios;
  const where = manual ? 'no seu preço' : 'no preço de mercado';

  // Quanto dá para pagar por unidade e ainda ter a margem-alvo vendendo no preço principal.
  const maxCost = primary.profit === null ? null
    : round2(primary.price * (1 - primary.fee.percentage - input.tax - input.target) - primary.fee.fixed - primary.shipping.amount - input.packaging);

  const reasons = [];
  let verdict;
  const cheapestLoses = !manual && secondary?.profit !== null && secondary?.profit <= 0;
  if (primary.profit === null) {
    verdict = { key: 'incompleto', label: 'Informe o frete' };
    reasons.push(`Não consegui cotar o frete grátis de um produto de ${brl(primary.price)} no Mercado Livre. Informe o valor do frete para concluir.`);
  } else if (primary.margin >= input.target && !cheapestLoses) {
    verdict = { key: 'compensa', label: 'Compensa' };
    reasons.push(`Vendendo a ${brl(primary.price)} (${where.replace('no ', '')}), a margem fica em ${percent(primary.margin)}, acima da sua meta.`);
    if (!manual) reasons.push('Mesmo no preço dos concorrentes mais baratos ainda sobra lucro.');
  } else if (primary.profit > 0) {
    verdict = { key: 'arriscado', label: 'Arriscado' };
    reasons.push(primary.margin < input.target
      ? `Vendendo a ${brl(primary.price)} (${where.replace('no ', '')}), a margem é de ${percent(primary.margin)}, abaixo da sua meta.`
      : 'Para vender tão barato quanto os concorrentes mais baratos, você teria prejuízo.');
  } else {
    verdict = { key: 'nao_compensa', label: 'Não compensa' };
    reasons.push(`Vendendo a ${brl(primary.price)}, as tarifas, o frete e o custo passam do valor da venda.`);
  }
  if (maxCost !== null) reasons.push(maxCost > 0
    ? `Para ter ${Math.round(input.target * 100)}% de margem ${where}, pague no máximo ${brl(maxCost)} por unidade.`
    : `Nem de graça a margem-alvo seria atingida ${where}.`);
  if (manual && market && input.salePrice > market.high * 1.15) {
    reasons.push(`Seu preço está acima da maioria das ofertas do catálogo (até ${brl(market.high)}). Confira se são produtos iguais ao seu.`);
  }
  if (manual && !market) reasons.push('Não encontrei ofertas comparáveis no catálogo; a análise usa só o preço que você informou.');
  if (!manual && market.sampleSize < 3) reasons.push('Poucas ofertas no catálogo: o preço de mercado é menos confiável.');
  if (trending) reasons.push(`O termo “${trending}” está entre as tendências da semana no Mercado Livre.`);

  return {
    query: input.query, gtin: input.gtin || null,
    product: { title: matched || input.query, matchedByBarcode: Boolean(matched) },
    inputs: { cost: input.cost, quantity: input.quantity, size: input.size, sizeLabel: `${PACKAGE_SIZES[input.size].label} (${PACKAGE_SIZES[input.size].detail})`, packaging: input.packaging, tax: input.tax, target: input.target, listingType: input.listingType, listingTypeLabel: LISTING_TYPES[input.listingType], salePrice: input.salePrice },
    priceSource: manual ? 'manual' : 'mercado',
    market,
    offers: offers.slice(0, 8).map(({ title, price, shipFree, permalink }) => ({ title, price, shipFree, permalink })),
    scenarios,
    minPrice, targetPrice, maxCost,
    totals: {
      capital: round2(input.cost * input.quantity),
      profit: primary.profit === null ? null : round2(primary.profit * input.quantity),
      estimated: true
    },
    trending,
    verdict: { ...verdict, reasons },
    freeShippingMin: FREE_SHIPPING_MIN,
    when: Date.now()
  };
}

import { catalogWinner, mapLimit, mlError, mlFetch } from './_ml.js';

// Análise estratégica de um anúncio. Usa apenas dados oficiais da API do Mercado Livre;
// não reproduz descrição nem imagens do concorrente. Todo número estimado vem com `estimated: true`.

const siteId = () => process.env.ML_SITE_ID || 'MLB';
const round2 = value => Math.round(value * 100) / 100;

const STOPWORDS = new Set(('a o os as um uma de da do das dos e em no na nos nas para por com sem que ou ao aos '
  + 'mais muito kit novo nova original produto unidade unidades un pcs peca pecas envio entrega').split(' '));
const PROMO_WORDS = /\b(promo(cao)?|oferta|frete gratis|barato|desconto|liquidacao|imperdivel|melhor preco|queima)\b/;

const REPUTATION = {
  '5_green': { label: 'Verde (excelente)', points: 5 },
  '4_light_green': { label: 'Verde-claro (boa)', points: 4 },
  '3_yellow': { label: 'Amarela (regular)', points: 3 },
  '2_orange': { label: 'Laranja (ruim)', points: 2 },
  '1_red': { label: 'Vermelha (crítica)', points: 1 }
};
const POWER_SELLER = { platinum: 'MercadoLíder Platinum', gold: 'MercadoLíder Gold', silver: 'MercadoLíder' };
const LOGISTICS = {
  fulfillment: 'Mercado Envios Full',
  self_service: 'Mercado Envios Flex',
  cross_docking: 'Coleta no vendedor',
  xd_drop_off: 'Entrega em agência',
  drop_off: 'Entrega em agência',
  custom: 'Envio próprio',
  not_specified: 'Não informado'
};
// Atributos úteis para títulos e diferenciação (marca e modelo ficam de fora: são do concorrente).
const SPEC_ATTRIBUTES = ['LINE', 'COLOR', 'MAIN_COLOR', 'CAPACITY', 'SIZE', 'MATERIAL', 'VOLTAGE', 'POWER', 'VOLUME',
  'WEIGHT', 'LENGTH', 'UNITS_PER_PACK', 'FORMAT', 'GENDER', 'CONNECTIVITY', 'STORAGE_CAPACITY'];

export function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// "sem fio", "sem glúten" etc. viram um termo só ("sem_fio") para não perder o sentido.
function tokens(value) {
  return normalizeText(value).replace(/\bsem\s+([a-z0-9]+)/g, 'sem_$1').split(/[^a-z0-9_]+/).filter(word => word.length > 1 && !STOPWORDS.has(word));
}

export function parseListingRef(input) {
  const text = String(input || '').trim();
  if (!text || text.length > 2000) return null;
  const itemParam = text.match(/(?:wid|item_id)=([A-Z]{3})-?(\d{6,})/i);
  if (itemParam) return { type: 'item', id: `${itemParam[1].toUpperCase()}${itemParam[2]}` };
  const product = text.match(/\/p\/([A-Z]{3})(\d{5,})/i);
  if (product) return { type: 'product', id: `${product[1].toUpperCase()}${product[2]}` };
  const item = text.match(/\b(M[A-Z]{2})-?(\d{6,})/i);
  if (item) return { type: 'item', id: `${item[1].toUpperCase()}${item[2]}` };
  return null;
}

// Links curtos de compartilhamento (meli.la) só revelam o anúncio depois do redirecionamento.
export function isShortListingLink(input) {
  try { return new URL(String(input || '').trim()).hostname === 'meli.la'; } catch { return false; }
}

function isMercadoLivreHost(hostname) {
  return hostname === 'meli.la' || /(^|\.)mercadoli[bv]re\.com(\.[a-z]{2})?$/.test(hostname);
}

// Segue no máximo 3 redirecionamentos e só entre domínios do Mercado Livre; devolve a última URL.
export async function resolveShortListingLink(input, options = {}) {
  let url = new URL(String(input).trim());
  for (let hop = 0; hop < 3; hop++) {
    let response;
    try {
      response = await (options.fetch || fetch)(url.toString(), {
        redirect: 'manual',
        // Sem user-agent o meli.la responde 403.
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; MargemIQ/1.0)' },
        signal: AbortSignal.timeout(8000)
      });
    } catch {
      throw mlError('Não foi possível abrir o link curto. Cole o link completo do anúncio.', 502, 'SHORT_LINK_FAILED');
    }
    const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
    if (!location) break;
    const next = new URL(location, url);
    if (next.protocol !== 'https:' || next.username || next.password || next.port || !isMercadoLivreHost(next.hostname)) break;
    url = next;
    if (parseListingRef(url.toString())) break;
  }
  return url.toString();
}

function attributeValue(item, id) {
  return item.attributes?.find(attribute => attribute.id === id)?.value_name || null;
}

// ---------- Título ----------
export function analyzeTitle(title, item, competitorNames = []) {
  const normalized = normalizeText(title);
  const titleWords = new Set(tokens(title));
  const brand = attributeValue(item, 'BRAND');
  const model = attributeValue(item, 'MODEL');
  const words = String(title || '').split(/\s+/).filter(Boolean);
  const capsWords = words.filter(word => word.length > 3 && /[A-ZÀ-Ú]/.test(word) && word === word.toUpperCase());
  const counts = {};
  tokens(title).filter(word => word.length > 3).forEach(word => { counts[word] = (counts[word] || 0) + 1; });
  const repeated = Object.keys(counts).filter(word => counts[word] > 1);

  const documentFrequency = {};
  competitorNames.forEach(name => new Set(tokens(name)).forEach(word => { documentFrequency[word] = (documentFrequency[word] || 0) + 1; }));
  const minimum = Math.max(2, Math.ceil(competitorNames.length * 0.3));
  const brandWords = new Set(tokens(brand));
  const terms = Object.entries(documentFrequency)
    .filter(([word, count]) => count >= minimum && !brandWords.has(word) && !/^\d+$/.test(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
  const readable = word => word.replace('_', ' ');
  const keywords = terms.map(readable);
  const missingKeywords = terms.filter(word => !titleWords.has(word)).map(readable);

  const checks = [
    { id: 'length', ok: title.length >= 40 && title.length <= 60, label: 'Tamanho', detail: `${title.length} de 60 caracteres. O ideal é usar entre 40 e 60.` },
    ...(brand ? [{ id: 'brand', ok: normalized.includes(normalizeText(brand)), label: 'Marca no título', detail: `Marca informada: ${brand}.` }] : []),
    ...(model ? [{ id: 'model', ok: normalized.includes(normalizeText(model)), label: 'Modelo no título', detail: `Modelo informado: ${model}.` }] : []),
    { id: 'promo', ok: !PROMO_WORDS.test(normalized), label: 'Sem termos promocionais', detail: 'Palavras como "promoção", "oferta" ou "frete grátis" não ajudam na busca e podem violar as regras de título.' },
    { id: 'caps', ok: capsWords.length <= 1, label: 'Sem excesso de maiúsculas', detail: capsWords.length ? `Em maiúsculas: ${capsWords.slice(0, 4).join(', ')}.` : 'Uso de maiúsculas adequado.' },
    { id: 'symbols', ok: !/[!*#@$%|]/.test(title), label: 'Sem símbolos', detail: 'Símbolos não são indexados pela busca.' },
    { id: 'repeat', ok: repeated.length === 0, label: 'Sem palavras repetidas', detail: repeated.length ? `Repetidas: ${repeated.join(', ')}.` : 'Nenhuma repetição.' },
    ...(keywords.length ? [{
      id: 'keywords',
      ok: missingKeywords.length <= Math.floor(keywords.length / 3),
      label: 'Palavras-chave do segmento',
      detail: missingKeywords.length ? `Termos frequentes nos concorrentes que faltam: ${missingKeywords.join(', ')}.` : 'Cobre os termos mais frequentes do segmento.'
    }] : [])
  ];
  return {
    title,
    length: title.length,
    score: Math.round(checks.filter(check => check.ok).length / checks.length * 100),
    checks,
    keywords,
    missingKeywords
  };
}

// ---------- Tarifas ----------
function normalizeFee(payload, listingType) {
  const entry = Array.isArray(payload) ? payload.find(fee => fee.listing_type_id === listingType) || payload[0] : payload;
  if (!entry || !Number.isFinite(Number(entry.sale_fee_amount))) return null;
  const details = entry.sale_fee_details || {};
  return {
    amount: Number(entry.sale_fee_amount),
    percentage: Number(details.percentage_fee ?? details.meli_percentage_fee ?? 0) / 100,
    fixed: Number(details.fixed_fee || 0),
    listingType: entry.listing_type_id || listingType,
    source: 'mercado_livre_listing_prices'
  };
}

export function feeCalculator(token, item, fallbackCommission, options) {
  const cache = new Map();
  return async price => {
    const key = round2(price).toFixed(2);
    if (!cache.has(key)) {
      const query = new URLSearchParams({ price: key, listing_type_id: item.listing_type_id || 'gold_special', category_id: item.category_id || '' });
      cache.set(key, mlFetch(`/sites/${siteId()}/listing_prices?${query}`, token, options)
        .then(payload => normalizeFee(payload, item.listing_type_id))
        .catch(error => {
          if (error.status === 401) throw error;
          return null;
        })
        .then(fee => fee || {
          amount: round2(price * fallbackCommission),
          percentage: fallbackCommission,
          fixed: 0,
          listingType: item.listing_type_id || null,
          source: 'configuracao_da_loja'
        }));
    }
    return cache.get(key);
  };
}

// Preço em que receita líquida cobre custo + frete + tarifa (e a margem desejada).
// A tarifa fixa muda por faixa de preço, então recalculamos com a tarifa oficial do preço encontrado.
export async function solvePrice(feeAt, unitCost, shipping, margin, startPrice) {
  let fee = await feeAt(startPrice);
  let price = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const denominator = 1 - fee.percentage - margin;
    if (denominator <= 0.05) return null;
    const next = round2((unitCost + shipping + fee.fixed) / denominator);
    if (price !== null && Math.abs(next - price) < 0.01) break;
    price = next;
    fee = await feeAt(price);
  }
  return price;
}

// ---------- Opinião sobre o anúncio ----------
function reputationOf(user) {
  if (!user) return null;
  const reputation = user.seller_reputation || {};
  const ratings = reputation.transactions?.ratings || {};
  return {
    nickname: user.nickname ? String(user.nickname) : null,
    level: REPUTATION[reputation.level_id]?.label || 'Sem reputação',
    levelPoints: REPUTATION[reputation.level_id]?.points || 0,
    powerSeller: POWER_SELLER[reputation.power_seller_status] || null,
    completedSales: Number.isFinite(Number(reputation.transactions?.completed)) ? Number(reputation.transactions.completed) : null,
    positiveRatings: Number.isFinite(Number(ratings.positive)) ? Number(ratings.positive) : null
  };
}

function attributesOf(item, categoryAttributes) {
  const relevant = (categoryAttributes || []).filter(attribute => !attribute.tags?.hidden && !attribute.tags?.read_only && !attribute.tags?.fixed);
  const filledIds = new Set((item.attributes || []).filter(attribute => attribute.value_name || attribute.value_id).map(attribute => attribute.id));
  const important = relevant.filter(attribute => attribute.tags?.required || attribute.tags?.catalog_required || attribute.relevance === 1);
  return {
    filled: relevant.filter(attribute => filledIds.has(attribute.id)).length,
    total: relevant.length,
    ratio: relevant.length ? relevant.filter(attribute => filledIds.has(attribute.id)).length / relevant.length : null,
    missingImportant: important.filter(attribute => !filledIds.has(attribute.id)).map(attribute => String(attribute.name)).slice(0, 8)
  };
}

function salesOf(item, now) {
  const sold = item.sold_quantity === null || item.sold_quantity === undefined || !Number.isFinite(Number(item.sold_quantity)) ? null : Number(item.sold_quantity);
  const created = Date.parse(item.date_created || item.start_time || '');
  const ageDays = Number.isFinite(created) ? Math.max(1, Math.floor((now - created) / 86400000)) : null;
  const sales = { publicSold: sold, ageDays, source: 'mercado_livre_items' };
  if (sold !== null && ageDays !== null && sold > 0) {
    const perDay = sold / ageDays;
    sales.pace = {
      estimated: true,
      perDay: round2(perDay),
      perMonth: Math.round(perDay * 30),
      basis: `Média de ${sold} venda(s) em ${ageDays} dia(s) de anúncio. O ritmo real varia com preço, estoque e sazonalidade.`
    };
    sales.revenue = {
      estimated: true,
      total: round2(sold * Number(item.price || 0)),
      perMonth: round2(perDay * 30 * Number(item.price || 0)),
      basis: 'Vendas públicas multiplicadas pelo preço atual. O preço pode ter mudado ao longo do tempo.'
    };
  }
  return sales;
}

function levelFrom(score) {
  if (score >= 3) return { key: 'otimista', label: 'Otimista' };
  if (score >= 1) return { key: 'moderado', label: 'Moderado' };
  return { key: 'arriscado', label: 'Arriscado' };
}

function titleIdeas(noun, keywords, specs) {
  const build = parts => {
    const seen = new Set();
    const words = parts.join(' ').split(/\s+/).filter(word => {
      const key = normalizeText(word);
      if (!word || (seen.has(key) && !word.startsWith('['))) return false;
      seen.add(key);
      return true;
    });
    let title = '';
    for (const word of words) {
      if ((title + ' ' + word).trim().length > 60) break;
      title = (title + ' ' + word).trim();
    }
    return title;
  };
  const cap = word => word.charAt(0).toUpperCase() + word.slice(1);
  const terms = keywords.slice(0, 3).map(cap);
  return [...new Set([
    build([noun, ...terms, '[Sua Marca]']),
    build([noun, '[Sua Marca]', '[Modelo]', ...specs.slice(0, 2)]),
    build([noun, ...specs.slice(0, 1), ...terms.slice(0, 2), '[Diferencial]'])
  ])].filter(Boolean);
}

export function buildStrategy(data) {
  const { item, seller, me, title, attributes, sales, competitors, prices, store, fee, category } = data;
  const price = Number(item.price);
  const hasCost = store.cost > 0;
  const factors = [];
  let score = 0;
  const add = (impact, label, detail) => { score += impact; factors.push({ impact, label, detail }); };

  const profitAtMarket = hasCost ? round2(price - fee.amount - store.cost - store.shipping) : null;
  const marginAtMarket = hasCost ? profitAtMarket / price : null;
  if (hasCost) {
    if (marginAtMarket >= store.target) add(2, 'Margem saudável no preço atual', `Vendendo a ${price.toFixed(2)} você teria margem de ${(marginAtMarket * 100).toFixed(1)}%.`);
    else if (marginAtMarket >= 0.1) add(1, 'Margem positiva, abaixo da meta', `Margem de ${(marginAtMarket * 100).toFixed(1)}% contra a meta de ${(store.target * 100).toFixed(0)}%.`);
    else if (marginAtMarket >= 0) add(0, 'Margem apertada', `Sobram só ${(marginAtMarket * 100).toFixed(1)}% no preço do concorrente.`);
    else add(-2, 'Prejuízo no preço atual', `Cada venda no preço do concorrente daria ${profitAtMarket.toFixed(2)} de resultado.`);
  }
  if (sales.pace) {
    if (sales.pace.perMonth >= 60) add(1, 'Demanda comprovada', `Cerca de ${sales.pace.perMonth} vendas/mês (estimativa).`);
    else if (sales.pace.perMonth < 5) add(-1, 'Demanda baixa neste anúncio', `Cerca de ${sales.pace.perMonth} vendas/mês (estimativa).`);
  }
  if (seller) {
    if (seller.levelPoints >= 5 && seller.powerSeller && seller.powerSeller !== 'MercadoLíder') add(-1, 'Concorrente forte', `${seller.level} · ${seller.powerSeller}.`);
    else if (seller.levelPoints > 0 && seller.levelPoints <= 3) add(1, 'Concorrente com reputação frágil', seller.level);
  }
  const listingGaps = [];
  if (title.score < 70) listingGaps.push('título');
  if ((item.pictures || []).length < 6) listingGaps.push('fotos');
  if (attributes.ratio !== null && attributes.ratio < 0.7) listingGaps.push('ficha técnica');
  if (listingGaps.length) add(1, 'Anúncio concorrente pode ser superado', `Pontos fracos: ${listingGaps.join(', ')}.`);
  const full = item.shipping?.logistic_type === 'fulfillment';
  if (full && item.shipping?.free_shipping) add(-1, 'Concorrente usa Full com frete grátis', 'Você precisará de prazo de entrega semelhante.');
  if (competitors && competitors.catalogProducts !== null && competitors.catalogProducts > 300) add(-1, 'Mercado saturado', `${competitors.catalogProducts} produtos de catálogo para essa busca.`);
  if (me && seller && me.levelPoints < seller.levelPoints) add(-1, 'Sua reputação está abaixo da do concorrente', `Sua: ${me.level} · concorrente: ${seller.level}.`);

  const level = levelFrom(score);
  if (!hasCost) level.note = 'Informe o custo do produto para completar a análise de margem.';

  const recommended = (() => {
    if (!hasCost || prices.target === null) return null;
    if (prices.target <= price) return { price: round2(Math.max(prices.target, price * 0.97)), reason: 'Entrar até 3% abaixo do concorrente sem abrir mão da margem-alvo.' };
    if (prices.minimum !== null && prices.minimum <= price) return { price: round2(price), reason: 'Acompanhar o preço do concorrente; a margem fica abaixo da meta.' };
    return { price: prices.target, reason: 'Seu custo exige preço acima do mercado. Só compensa com um diferencial claro.' };
  })();

  const monthly = sales.pace?.perMonth ?? null;
  let units = monthly ? Math.min(150, Math.max(5, Math.round(monthly * 0.1))) : 10;
  let stockBasis = monthly
    ? 'Cerca de 10% do ritmo mensal estimado do anúncio analisado, para vender em até 30 dias.'
    : 'Sem vendas públicas para medir o ritmo: lote pequeno só para validar a demanda.';
  if (hasCost && store.budget > 0 && units * store.cost > store.budget) {
    units = Math.max(1, Math.floor(store.budget / store.cost));
    stockBasis += ' Limitado ao orçamento informado.';
  }
  const initialStock = { estimated: true, units, capital: hasCost ? round2(units * store.cost) : null, basis: stockBasis };

  const actions = [];
  const action = (priority, text, why) => actions.push({ priority, text, why });
  if (!hasCost) action(1, 'Informe custo, frete e embalagem do seu produto.', 'Sem custo não dá para saber se existe margem.');
  if (hasCost && marginAtMarket < store.target && prices.maxCost !== null) {
    action(1, `Negocie custo unitário até ${prices.maxCost.toFixed(2)}.`, `É o custo máximo para ter ${(store.target * 100).toFixed(0)}% de margem no preço atual do concorrente.`);
  }
  if (attributes.missingImportant.length) action(1, `Preencha a ficha técnica completa, começando por: ${attributes.missingImportant.slice(0, 4).join(', ')}.`, 'Esses atributos faltam no concorrente e ajudam a aparecer nos filtros de busca.');
  if (title.missingKeywords.length) action(2, `Inclua no seu título termos do segmento, como: ${title.missingKeywords.slice(0, 4).join(', ')}.`, 'São os termos mais frequentes entre os produtos concorrentes.');
  if ((item.pictures || []).length < 8) action(2, 'Produza de 8 a 10 fotos próprias: fundo branco, detalhes, medidas e o produto em uso.', `O concorrente tem ${(item.pictures || []).length} foto(s).`);
  if (full) action(2, 'Avalie Full ou Flex para igualar o prazo de entrega.', 'O concorrente entrega pelo Full.');
  if (me && seller && me.levelPoints < seller.levelPoints) action(2, 'Comece com um lote pequeno e priorize o atendimento para subir a reputação.', 'Reputação pesa na conversão e na exposição.');
  action(3, `Faça um teste de 14 a 21 dias com ${units} unidade(s) antes de comprar em volume.`, 'Valida a conversão real antes de imobilizar capital.');

  const differentiation = [];
  if (!item.shipping?.free_shipping) differentiation.push('Ofereça frete grátis: o concorrente não oferece.');
  if (!full) differentiation.push('Entregue mais rápido com Full ou Flex: o concorrente não usa Full.');
  if (!(item.sale_terms || []).some(term => term.id === 'WARRANTY_TYPE' || term.id === 'WARRANTY_TIME')) differentiation.push('Deixe uma garantia explícita no anúncio.');
  if (!item.video_id) differentiation.push('Publique um vídeo curto mostrando o produto em uso.');
  differentiation.push('Monte um kit com um item complementar de baixo custo para fugir da comparação direta de preço.');
  differentiation.push('Responda nas fotos e no título as dúvidas mais comuns da categoria (medidas, compatibilidade, conteúdo da embalagem).');

  const noun = category?.name || data.domain || tokens(item.title).slice(0, 2).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const specs = SPEC_ATTRIBUTES.map(id => attributeValue(item, id)).filter(Boolean).map(String).slice(0, 3);

  return {
    opportunity: { ...level, score, factors },
    margin: hasCost ? { profitAtMarket, marginAtMarket } : null,
    recommended,
    initialStock,
    actions: actions.sort((a, b) => a.priority - b.priority),
    titleIdeas: titleIdeas(noun, title.keywords, specs),
    differentiation: differentiation.slice(0, 6),
    marketTest: {
      estimated: true,
      days: '14 a 21 dias',
      units,
      price: recommended?.price ?? null,
      watch: ['Visitas por dia', 'Conversão (vendas ÷ visitas)', 'Perguntas sem resposta', 'Margem real depois das tarifas'],
      successCriteria: 'Vender pelo menos metade do lote dentro do prazo, mantendo a margem-alvo.',
      stopCriteria: 'Se não houver vendas na primeira semana com boa exposição, revise foto principal, título e preço antes de repor estoque.'
    }
  };
}

function storeInput(input) {
  const number = value => Math.max(0, Number(value) || 0);
  const target = Number(input?.target);
  return {
    cost: round2(number(input?.cost) + number(input?.packaging)),
    shipping: round2(number(input?.shipping)),
    target: Number.isFinite(target) ? Math.min(Math.max(target, 0), 80) / 100 : 0.25,
    commission: Number.isFinite(Number(input?.commission)) ? Math.min(Math.max(Number(input.commission), 0), 50) / 100 : 0.119,
    budget: number(input?.budget)
  };
}

const optional = promise => promise.catch(error => {
  if (error.status === 401) throw error;
  return null;
});

export async function analyzeListing(token, input, options = {}) {
  const progress = (stage, state) => options.onProgress?.({ stage, state });
  progress('link', 'running');
  let ref = parseListingRef(input?.ref);
  if (!ref && isShortListingLink(input?.ref)) {
    const resolved = await resolveShortListingLink(input.ref, options);
    ref = parseListingRef(resolved);
    if (!ref && new URL(resolved).pathname.startsWith('/social/')) {
      throw mlError('Esse link abre uma vitrine de afiliado, não um anúncio. Abra o produto no Mercado Livre e copie o link dele.', 400, 'INVALID_LISTING');
    }
  }
  if (!ref) throw mlError('Cole o link do anúncio ou um ID como MLB1234567890.', 400, 'INVALID_LISTING');
  const store = storeInput(input?.store);
  const now = options.now || Date.now();

  let itemId = ref.id;
  if (ref.type === 'product') {
    const product = await mlFetch(`/products/${ref.id}`, token, options).catch(error => {
      if (error.upstreamStatus === 404) throw mlError('Produto de catálogo não encontrado.', 404, 'LISTING_NOT_FOUND');
      throw error;
    });
    itemId = (await catalogWinner(product, token, options))?.item_id;
    if (!itemId) throw mlError('Este produto de catálogo não tem uma oferta ativa para analisar.', 404, 'LISTING_NOT_FOUND');
  }
  const item = await mlFetch(`/items/${encodeURIComponent(itemId)}`, token, options).catch(error => {
    if (error.upstreamStatus === 404) throw mlError('Anúncio não encontrado. Confira o link ou o ID.', 404, 'LISTING_NOT_FOUND');
    throw error;
  });
  if (!(Number(item?.price) > 0)) throw mlError('O anúncio não tem um preço ativo para analisar.', 422, 'LISTING_WITHOUT_PRICE');
  options.onListing?.({ id: String(item.id), title: String(item.title || ''), thumbnail: item.pictures?.[0]?.secure_url || item.secure_thumbnail || null });
  progress('link', 'done');
  progress('content', 'running');
  progress('pricing', 'running');

  const searchTerms = tokens(item.title).slice(0, 5).join(' ');
  const feeAt = feeCalculator(token, item, store.commission, options);
  const [sellerRaw, meRaw, category, categoryAttributes, search, domain, fee] = await Promise.all([
    optional(mlFetch(`/users/${encodeURIComponent(item.seller_id)}`, token, options)),
    options.publicOnly ? null : optional(mlFetch('/users/me', token, options)),
    item.category_id ? optional(mlFetch(`/categories/${encodeURIComponent(item.category_id)}`, token, options)) : null,
    item.category_id ? optional(mlFetch(`/categories/${encodeURIComponent(item.category_id)}/attributes`, token, options)) : null,
    searchTerms ? optional(mlFetch(`/products/search?status=active&limit=10&site_id=${siteId()}&q=${encodeURIComponent(searchTerms)}`, token, options)) : null,
    searchTerms ? optional(mlFetch(`/sites/${siteId()}/domain_discovery/search?limit=1&q=${encodeURIComponent(searchTerms)}`, token, options)) : null,
    feeAt(Number(item.price))
  ]);

  const productIds = (search?.results || []).map(product => typeof product === 'string' ? product : product?.id).filter(Boolean).slice(0, 6);
  const catalog = await mapLimit(productIds, 3, id => optional(mlFetch(`/products/${encodeURIComponent(id)}`, token, options)));
  const competitorNames = catalog.map(product => product?.name).filter(Boolean);
  const winners = await mapLimit(catalog, 3, product => product ? optional(catalogWinner(product, token, options)) : null);
  const competitorPrices = winners.map(winner => Number(winner?.price)).filter(value => value > 0).sort((a, b) => a - b);
  const competitors = {
    catalogProducts: Number.isFinite(Number(search?.paging?.total)) ? Number(search.paging.total) : null,
    sample: competitorPrices.length,
    prices: competitorPrices.length ? { min: competitorPrices[0], max: competitorPrices.at(-1) } : null
  };

  const title = analyzeTitle(String(item.title || ''), item, competitorNames);
  const attributes = attributesOf(item, Array.isArray(categoryAttributes) ? categoryAttributes : []);
  const sales = salesOf(item, now);
  const seller = reputationOf(sellerRaw);
  const me = meRaw && String(meRaw.id) !== String(item.seller_id) ? reputationOf(meRaw) : null;
  progress('content', 'done');

  const hasCost = store.cost > 0;
  const minimum = hasCost ? await solvePrice(feeAt, store.cost, store.shipping, 0, Number(item.price)) : null;
  const target = hasCost ? await solvePrice(feeAt, store.cost, store.shipping, store.target, Number(item.price)) : null;
  const maxCost = round2(Number(item.price) * (1 - fee.percentage - store.target) - fee.fixed - store.shipping);
  const prices = { minimum, target, maxCost: maxCost > 0 ? maxCost : null };
  progress('pricing', 'done');
  progress('summary', 'running');

  const categoryInfo = category ? {
    id: String(category.id),
    name: String(category.name || ''),
    path: (category.path_from_root || []).map(node => String(node.name))
  } : null;
  const strategy = buildStrategy({
    item, seller, me, title, attributes, sales, competitors, prices, store, fee,
    category: categoryInfo,
    domain: Array.isArray(domain) && domain[0]?.domain_name ? String(domain[0].domain_name) : null
  });

  const price = Number(item.price);
  const originalPrice = Number(item.original_price) > price ? Number(item.original_price) : null;
  progress('summary', 'done');
  return {
    listing: {
      id: String(item.id),
      title: String(item.title || ''),
      thumbnail: item.pictures?.[0]?.secure_url || item.secure_thumbnail || null,
      permalink: typeof item.permalink === 'string' ? item.permalink : null,
      condition: String(item.condition || ''),
      catalogListing: Boolean(item.catalog_listing),
      listingType: String(item.listing_type_id || ''),
      category: categoryInfo
    },
    title,
    pricing: {
      price,
      originalPrice,
      discount: originalPrice ? round2((1 - price / originalPrice) * 100) : 0,
      fee,
      freeShipping: Boolean(item.shipping?.free_shipping),
      minimumPrice: minimum,
      targetPrice: target,
      maxCostForTarget: prices.maxCost
    },
    content: {
      pictures: (item.pictures || []).length,
      hasVideo: Boolean(item.video_id),
      attributes
    },
    seller: seller ? {
      ...seller,
      officialStore: Boolean(item.official_store_id),
      logistics: LOGISTICS[item.shipping?.logistic_type] || 'Não informado',
      logisticType: item.shipping?.logistic_type || null
    } : null,
    you: me,
    sales,
    competitors,
    store,
    strategy,
    analyzedAt: now
  };
}

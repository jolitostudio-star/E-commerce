import { mlError, mlFetch } from './_ml.js';
import { analyzeListing, feeCalculator, normalizeText } from './_listing.js';

// Diagnóstico de um anúncio do próprio vendedor: por que não vende e o que corrigir.
// Só lê dados do Mercado Livre; nenhuma alteração é feita no anúncio.

const round2 = value => Math.round(value * 100) / 100;
const brl = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = value => (value * 100).toFixed(1).replace('.', ',') + '%';

// Caminho no Mercado Livre para corrigir cada ponto (o MargemIQ não altera o anúncio).
const EDIT = 'No Mercado Livre: Vendas › Anúncios › seu anúncio › Modificar';
export const WHERE = {
  descricao: `${EDIT} › Descrição`,
  titulo: `${EDIT} › Título (só dá para mudar enquanto o anúncio não tem vendas)`,
  preco: `${EDIT} › Preço`,
  fotos: `${EDIT} › Fotos`,
  ficha: `${EDIT} › Ficha técnica`,
  tipo: `${EDIT} › Tipo de anúncio (Clássico ou Premium)`,
  frete: `${EDIT} › Forma de entrega`,
  estoque: `${EDIT} › Estoque`,
  status: 'No Mercado Livre: Vendas › Anúncios › seu anúncio › Reativar'
};

// ---------- Descrição ----------
const CONTACT = /(\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4})|([\w.-]+@[\w-]+\.\w+)|(https?:\/\/|www\.)|\b(whats ?app|zap|instagram|insta|telegram|facebook)\b/i;
const ELECTRIC = /\b(bivolt|110 ?v|127 ?v|220 ?v|eletric|usb|bateria|recarreg|pilha|led|tomada)/;

export function analyzeDescription(text, item = {}) {
  const raw = String(text || '');
  const plain = normalizeText(raw);
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const upper = letters ? raw.replace(/[^A-ZÀ-Þ]/g, '').length / letters.length : 0;
  const context = normalizeText(`${item.title || ''} ${(item.attributes || []).map(attribute => `${attribute.id} ${attribute.value_name || ''}`).join(' ')}`);
  const checks = [
    { key: 'tamanho', ok: raw.trim().length >= 300, label: 'Texto completo', detail: raw.trim().length ? `${raw.trim().length} caracteres. Descrições curtas deixam dúvidas e o comprador desiste.` : 'O anúncio está sem descrição.' },
    { key: 'medidas', ok: /(\d+([.,]\d+)?\s?(cm|mm|m|metros?|pol|polegadas|kg|g|ml|l|litros?)\b)|medidas|dimens|altura|largura|comprimento|diametro/.test(plain), label: 'Medidas e tamanho', detail: 'Informe medidas, peso ou capacidade.' },
    { key: 'material', ok: /material|plastico|metal|aco|madeira|algodao|silicone|vidro|couro|tecido|pla\b|resina|aluminio|inox|borracha|ceramica|mdf|poliester/.test(plain), label: 'Material', detail: 'Diga do que o produto é feito.' },
    { key: 'conteudo', ok: /(itens inclusos|conteudo da embalagem|acompanha|vem com|inclui|kit contem|o que vem|na caixa)/.test(plain), label: 'O que vem na embalagem', detail: 'Liste tudo o que o comprador recebe.' },
    { key: 'uso', ok: /(ideal para|indicado|como usar|modo de uso|serve para|perfeito para|utilizado|use para|aplicacao)/.test(plain), label: 'Para que serve', detail: 'Explique o uso e para quem o produto é indicado.' },
    { key: 'garantia', ok: /garantia/.test(plain), label: 'Garantia', detail: 'Informe a garantia (a legal é de 90 dias para produtos duráveis).' },
    ...(ELECTRIC.test(context) ? [{ key: 'voltagem', ok: /(bivolt|110|127|220|volts?|\bv\b|usb|bateria|pilha)/.test(plain), label: 'Voltagem ou alimentação', detail: 'Produto elétrico: informe voltagem, bateria ou tipo de alimentação.' }] : []),
    { key: 'paragrafos', ok: raw.trim().length < 300 || /\n/.test(raw), label: 'Organizado em partes', detail: 'Texto corrido é difícil de ler no celular. Separe em blocos curtos.' },
    { key: 'maiusculas', ok: upper < 0.3, label: 'Sem excesso de letras maiúsculas', detail: 'Texto todo em maiúsculas parece grito e cansa a leitura.' },
    { key: 'contato', ok: !CONTACT.test(raw), label: 'Sem telefone, e-mail, links ou redes sociais', detail: 'O Mercado Livre proíbe dados de contato na descrição e pode pausar o anúncio.' }
  ];
  const missing = checks.filter(check => !check.ok);
  return {
    text: raw,
    length: raw.trim().length,
    checks,
    score: Math.round(checks.filter(check => check.ok).length / checks.length * 100),
    forbidden: missing.some(check => check.key === 'contato'),
    missing: missing.map(check => check.key)
  };
}

// ---------- Visitas ----------
async function visitsOf(token, itemId, options) {
  const [recent, total] = await Promise.all([
    mlFetch(`/items/${encodeURIComponent(itemId)}/visits/time_window?last=30&unit=day`, token, options).catch(error => { if (error.status === 401) throw error; return null; }),
    mlFetch(`/visits/items?ids=${encodeURIComponent(itemId)}`, token, options).catch(error => { if (error.status === 401) throw error; return null; })
  ]);
  const last30 = Number(recent?.total_visits);
  const lifetime = Number(total?.[itemId]);
  return { last30: Number.isFinite(last30) ? last30 : null, total: Number.isFinite(lifetime) ? lifetime : null };
}

// ---------- Diagnóstico ----------
function check(key, area, status, label, detail, where) {
  return { key, area, status, label, detail, where: where || null };
}

export function buildDiagnosis({ item, analysis, description, visits, premiumFee, now = Date.now() }) {
  const price = Number(item.price || 0);
  const sold = Number(item.sold_quantity || 0);
  const ageDays = Math.max(1, Math.floor((now - Date.parse(item.date_created || item.start_time || now)) / 86400000));
  const conversion = visits.total ? sold / visits.total : null;
  const checks = [];

  // Anúncio fora do ar ou sem estoque não vende, independentemente do resto.
  if (item.status && item.status !== 'active') checks.push(check('status', 'Anúncio', 'bad', 'Anúncio não está ativo', `Status atual: ${item.status}. Enquanto não estiver ativo, ninguém consegue comprar.`, WHERE.status));
  const stock = Number(item.available_quantity || 0);
  if (stock === 0) checks.push(check('estoque', 'Anúncio', 'bad', 'Sem estoque', 'Com estoque zerado o anúncio some das buscas.', WHERE.estoque));
  else if (stock < 3) checks.push(check('estoque', 'Anúncio', 'warn', 'Estoque muito baixo', `Só ${stock} unidade(s). Estoque baixo reduz a exposição e pode sair de alguns filtros.`, WHERE.estoque));

  // Funil: primeiro visitas (as pessoas encontram o anúncio?), depois conversão (quem vê compra?).
  if (visits.last30 === null) checks.push(check('visitas', 'Visibilidade', 'info', 'Visitas indisponíveis', 'O Mercado Livre não informou as visitas deste anúncio agora.'));
  else if (visits.last30 < 30) checks.push(check('visitas', 'Visibilidade', 'bad', 'Pouquíssimas visitas', `${visits.last30} visita(s) nos últimos 30 dias. O problema principal é ser encontrado: título, categoria, preço nas buscas e frete.`));
  else if (visits.last30 < 150) checks.push(check('visitas', 'Visibilidade', 'warn', 'Poucas visitas', `${visits.last30} visitas nos últimos 30 dias.`));
  else checks.push(check('visitas', 'Visibilidade', 'ok', 'Boa quantidade de visitas', `${visits.last30} visitas nos últimos 30 dias.`));

  if (visits.total !== null && visits.total >= 100) {
    if (sold === 0) checks.push(check('conversao', 'Conversão', 'bad', 'Visitas sem nenhuma venda', `${visits.total} visitas e nenhuma venda. As pessoas veem e desistem: preço, fotos, descrição, frete e parcelamento.`));
    else if (conversion < 0.01) checks.push(check('conversao', 'Conversão', 'warn', 'Conversão baixa', `${percent(conversion)} das visitas viram venda (${sold} venda(s) em ${visits.total} visitas).`));
    else checks.push(check('conversao', 'Conversão', 'ok', 'Conversão boa', `${percent(conversion)} das visitas viram venda.`));
  } else if (visits.total !== null) {
    checks.push(check('conversao', 'Conversão', 'info', 'Poucas visitas para medir a conversão', `${visits.total} visita(s) no total e ${sold} venda(s).`));
  }

  // Preço contra as ofertas do catálogo.
  const competitors = analysis.competitors?.prices;
  if (competitors) {
    const middle = (competitors.min + competitors.max) / 2;
    if (price > competitors.max) checks.push(check('preco', 'Preço', 'bad', 'Preço acima de todos os concorrentes', `Seu preço é ${brl(price)}; as ofertas parecidas vão de ${brl(competitors.min)} a ${brl(competitors.max)}.`, WHERE.preco));
    else if (price > middle) checks.push(check('preco', 'Preço', 'warn', 'Preço na metade mais cara', `Seu preço é ${brl(price)}; as ofertas parecidas vão de ${brl(competitors.min)} a ${brl(competitors.max)}.`, WHERE.preco));
    // Muito abaixo de todas as ofertas: ou não são o mesmo produto, ou dá para cobrar mais.
    else if (price < competitors.min * 0.6) checks.push(check('preco', 'Preço', 'info', 'Preço bem abaixo das ofertas parecidas', `Seu preço é ${brl(price)}; as ofertas parecidas vão de ${brl(competitors.min)} a ${brl(competitors.max)}. Confira se são produtos iguais ao seu: se forem, talvez dê para cobrar mais.`, WHERE.preco));
    else checks.push(check('preco', 'Preço', 'ok', 'Preço competitivo', `Seu preço é ${brl(price)}; as ofertas parecidas vão de ${brl(competitors.min)} a ${brl(competitors.max)}.`));
  } else checks.push(check('preco', 'Preço', 'info', 'Sem concorrentes comparáveis', 'Não encontrei ofertas parecidas no catálogo para comparar o preço.'));

  // Título.
  const title = analysis.title;
  const titleIssues = (title?.checks || []).filter(entry => !entry.ok).map(entry => entry.detail);
  if (title) checks.push(check('titulo', 'Título', title.score >= 80 ? 'ok' : title.score >= 60 ? 'warn' : 'bad', `Título com nota ${title.score}/100`, titleIssues.length ? titleIssues.slice(0, 2).join(' ') : 'Título claro e com as palavras certas.', title.score >= 80 ? null : WHERE.titulo));

  // Fotos: quantidade e resolução.
  const pictures = Array.isArray(item.pictures) ? item.pictures : [];
  const small = pictures.filter(picture => { const [width, height] = String(picture.max_size || picture.size || '').split('x').map(Number); return width && height && Math.max(width, height) < 800; }).length;
  if (pictures.length < 3) checks.push(check('fotos', 'Fotos', 'bad', 'Poucas fotos', `${pictures.length} foto(s). Use de 6 a 10: fundo branco, detalhes, medidas e o produto em uso.`, WHERE.fotos));
  else if (pictures.length < 6) checks.push(check('fotos', 'Fotos', 'warn', 'Dá para ter mais fotos', `${pictures.length} fotos. O ideal é de 6 a 10, mostrando detalhes, medidas e o produto em uso.`, WHERE.fotos));
  else checks.push(check('fotos', 'Fotos', 'ok', 'Boa quantidade de fotos', `${pictures.length} fotos.`));
  if (small) checks.push(check('resolucao', 'Fotos', 'warn', 'Fotos em baixa resolução', `${small} foto(s) com menos de 800 px. Fotos pequenas não permitem zoom e passam menos confiança.`, WHERE.fotos));
  if (!analysis.content?.hasVideo) checks.push(check('video', 'Fotos', 'info', 'Sem vídeo', 'Um vídeo curto do produto em uso ajuda a vender.', WHERE.fotos));

  // Ficha técnica.
  const attributes = analysis.content?.attributes;
  if (attributes && attributes.total) {
    const missingNames = attributes.missingImportant || [];
    checks.push(check('ficha', 'Ficha técnica', missingNames.length ? 'warn' : attributes.ratio >= 0.7 ? 'ok' : 'warn',
      `Ficha técnica ${Math.round((attributes.ratio || 0) * 100)}% preenchida`,
      missingNames.length ? `Faltam: ${missingNames.slice(0, 5).join(', ')}. Esses campos aparecem nos filtros de busca.` : `${attributes.filled} de ${attributes.total} campos preenchidos.`,
      missingNames.length || attributes.ratio < 0.7 ? WHERE.ficha : null));
  }

  // Descrição.
  const missingDescription = description.checks.filter(entry => !entry.ok);
  checks.push(check('descricao', 'Descrição', description.forbidden || !description.length || missingDescription.length > 3 ? 'bad' : missingDescription.length ? 'warn' : 'ok',
    description.length ? `Descrição com nota ${description.score}/100` : 'Anúncio sem descrição',
    missingDescription.length ? `Falta: ${missingDescription.map(entry => entry.label.toLowerCase()).join(', ')}.` : 'Descrição completa.',
    missingDescription.length ? WHERE.descricao : null));

  // Frete.
  const freeShipping = Boolean(item.shipping?.free_shipping);
  const logistic = item.shipping?.logistic_type;
  if (logistic === 'fulfillment') checks.push(check('frete', 'Frete', 'ok', 'Mercado Envios Full', 'Entrega rápida com o selo Full, que costuma aumentar as vendas.'));
  else if (freeShipping) checks.push(check('frete', 'Frete', 'ok', 'Frete grátis', 'O anúncio oferece frete grátis.'));
  else if (price >= 79) checks.push(check('frete', 'Frete', 'warn', 'Sem frete grátis', 'A partir de R$ 79 o frete grátis é esperado pelo comprador.', WHERE.frete));
  else checks.push(check('frete', 'Frete', 'info', 'Comprador paga o frete', 'Abaixo de R$ 79 o comprador paga o frete. Oferecer frete grátis dá destaque, mas o custo sai do seu lucro.', WHERE.frete));

  // Parcelamento sem juros vem com o anúncio Premium.
  if (item.listing_type_id === 'gold_pro') checks.push(check('parcelamento', 'Parcelamento', 'ok', 'Parcelamento sem juros (Premium)', 'O anúncio Premium oferece parcelamento sem juros e aparece melhor para quem compra parcelado.'));
  else {
    const current = analysis.pricing?.fee?.amount;
    const extra = premiumFee && Number.isFinite(current) ? round2(premiumFee.amount - current) : null;
    checks.push(check('parcelamento', 'Parcelamento', price >= 100 ? 'warn' : 'info', 'Sem parcelamento sem juros (Clássico)',
      `No Clássico o comprador paga juros para parcelar.${extra !== null && extra > 0 ? ` No Premium a tarifa sobe cerca de ${brl(extra)} por venda (de ${brl(current)} para ${brl(premiumFee.amount)}).` : ''} Para produtos mais caros, parcelar sem juros costuma fazer diferença.`, WHERE.tipo));
  }

  // Reputação da conta.
  const reputation = analysis.seller;
  if (reputation && reputation.levelPoints < 3) checks.push(check('reputacao', 'Conta', 'warn', `Reputação: ${reputation.level}`, 'Contas sem reputação ou com reputação baixa vendem menos. Responda perguntas rápido e envie no prazo para subir.'));

  const bad = checks.filter(entry => entry.status === 'bad');
  const warn = checks.filter(entry => entry.status === 'warn');
  let stage;
  if (checks.some(entry => ['status', 'estoque'].includes(entry.key) && entry.status === 'bad')) stage = { key: 'bloqueado', label: 'O anúncio não está disponível para compra' };
  else if (visits.last30 !== null && visits.last30 < 30) stage = { key: 'exposicao', label: 'Pouca gente encontra este anúncio' };
  else if (visits.total !== null && visits.total >= 100 && (sold === 0 || conversion < 0.01)) stage = { key: 'conversao', label: 'As pessoas veem o anúncio, mas não compram' };
  else if (bad.length || warn.length) stage = { key: 'ajustes', label: 'O anúncio tem pontos a melhorar' };
  else stage = { key: 'ok', label: 'O anúncio está bem montado' };

  // Prioridade: o que bloqueia, depois o que mais pesa na etapa do funil em que o anúncio trava.
  const focus = stage.key === 'exposicao' ? ['titulo', 'preco', 'frete', 'ficha', 'fotos'] : ['preco', 'fotos', 'descricao', 'parcelamento', 'frete', 'titulo'];
  const rank = entry => (entry.status === 'bad' ? 0 : 10) + (focus.includes(entry.key) ? focus.indexOf(entry.key) : 9);
  const priorities = [...bad, ...warn].filter(entry => entry.where).sort((a, b) => rank(a) - rank(b)).slice(0, 4);

  return {
    listing: {
      id: String(item.id), title: String(item.title || ''), price, permalink: typeof item.permalink === 'string' ? item.permalink : null,
      thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail.replace(/^http:/, 'https:') : null,
      listingType: item.listing_type_id === 'gold_pro' ? 'Premium' : item.listing_type_id === 'gold_special' ? 'Clássico' : String(item.listing_type_id || ''),
      status: String(item.status || ''), stock, sold, ageDays, canEditTitle: sold === 0
    },
    funnel: { visits30: visits.last30, visitsTotal: visits.total, sold, conversion },
    stage,
    checks,
    priorities,
    description: { text: description.text, length: description.length, score: description.score, checks: description.checks, where: WHERE.descricao },
    analyzedAt: now
  };
}

export async function diagnoseListing(token, itemId, options = {}) {
  const id = String(itemId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{3}\d{6,}$/.test(id)) throw mlError('Anúncio inválido.', 400, 'INVALID_LISTING');
  const [item, me] = await Promise.all([mlFetch(`/items/${id}`, token, options), mlFetch('/users/me', token, options)]);
  if (String(item.seller_id) !== String(me.id)) throw mlError('O diagnóstico é só para anúncios da sua conta.', 403, 'NOT_YOUR_LISTING');

  const [analysis, descriptionRaw, visits, premiumFee] = await Promise.all([
    analyzeListing(token, { ref: id }, options),
    mlFetch(`/items/${id}/description`, token, options).catch(error => { if (error.status === 401) throw error; return null; }),
    visitsOf(token, id, options),
    item.listing_type_id === 'gold_pro' ? null
      : feeCalculator(token, { category_id: item.category_id, listing_type_id: 'gold_pro' }, 0.17, options)(Number(item.price || 0)).catch(() => null)
  ]);
  const description = analyzeDescription(descriptionRaw?.plain_text || descriptionRaw?.text || '', item);
  return buildDiagnosis({ item, analysis, description, visits, premiumFee, now: options.now });
}

import { mlError, mlFetch } from './_ml.js';
import { WHERE } from './_diagnosis.js';
import { generateJson } from './_gemini.js';

// Sugestão de descrição para um anúncio do próprio vendedor, escrita pelo Gemini a partir dos dados do anúncio.
// Não altera nada no Mercado Livre: o texto é devolvido para o vendedor revisar e colar.

const SYSTEM = `Você escreve descrições de anúncios do Mercado Livre Brasil para um pequeno vendedor.
Reescreva a descrição do anúncio usando SOMENTE as informações fornecidas (título, ficha técnica e descrição atual).
Regras:
- Português do Brasil com acentuação e ortografia corretas (ç, ã, õ, á, é, í, ó, ú, â, ê, ô), inclusive nos títulos dos blocos. Tom claro e direto, frases curtas.
- Ignore campos da ficha técnica sem valor para o comprador: marca "Genérica" ou "Sem marca", códigos internos e características com valor "Não" (ex.: "Com Wi-Fi: Não"). Escreva as características em linguagem natural (ex.: "1 luminária" em vez de "Unidades por kit: 1").
- Texto simples, sem HTML, sem markdown, sem asteriscos, sem emojis. Use quebras de linha e, para listas, linhas começando com "- ".
- Organize em blocos, nesta ordem, com um título curto em maiúsculas em cada bloco: apresentação do produto (2 ou 3 frases), CARACTERÍSTICAS, MEDIDAS, O QUE VEM NA EMBALAGEM, COMO USAR / INDICAÇÃO, GARANTIA.
- Nunca invente medidas, material, voltagem, quantidade, garantia, marca ou modelo. Quando uma informação importante não estiver nos dados, escreva o espaço para o vendedor completar, assim: [preencher: medidas em cm].
- Não use telefone, e-mail, links, redes sociais, nem peça contato fora do Mercado Livre (é proibido).
- Não prometa o que não está nos dados (ex.: "o melhor do mercado", "entrega em 24h", "original" sem confirmação).
- Não fale de concorrentes nem de preço.
- No máximo 2.500 caracteres.
Em "fill", liste em português os itens que ficaram como [preencher: ...] para o vendedor completar.`;

const SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    fill: { type: 'array', items: { type: 'string' } }
  },
  required: ['description', 'fill']
};

// Remove o que o Mercado Livre não aceita na descrição (HTML, markdown) e o que é proibido (contatos).
export function cleanDescription(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*|__|#{1,6}\s?/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 5000);
}

export async function suggestDescription(token, itemId, options = {}) {
  const id = String(itemId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{3}\d{6,}$/.test(id)) throw mlError('Anúncio inválido.', 400, 'INVALID_LISTING');
  const [item, me, current] = await Promise.all([
    mlFetch(`/items/${id}`, token, options),
    mlFetch('/users/me', token, options),
    mlFetch(`/items/${id}/description`, token, options).catch(error => { if (error.status === 401) throw error; return null; })
  ]);
  if (String(item.seller_id) !== String(me.id)) throw mlError('A sugestão de descrição é só para anúncios da sua conta.', 403, 'NOT_YOUR_LISTING');

  const specs = (item.attributes || [])
    .filter(attribute => attribute.value_name && !/^(SELLER_SKU|GTIN|ITEM_CONDITION)$/.test(attribute.id))
    .map(attribute => `- ${attribute.name}: ${attribute.value_name}`)
    .slice(0, 40);
  const prompt = [
    `Título: ${item.title}`,
    `Condição: ${item.condition === 'new' ? 'novo' : item.condition === 'used' ? 'usado' : item.condition || 'não informada'}`,
    item.warranty ? `Garantia informada no anúncio: ${item.warranty}` : 'Garantia: não informada',
    'Ficha técnica:',
    specs.length ? specs.join('\n') : '- (vazia)',
    'Descrição atual:',
    String(current?.plain_text || '').trim() || '(sem descrição)'
  ].join('\n');

  const result = await generateJson({
    client: options.client,
    system: SYSTEM,
    input: prompt,
    schema: SCHEMA,
    messages: {
      rateLimit: 'O limite gratuito da IA foi atingido por agora. Espere um pouco e tente de novo.',
      failure: 'Não foi possível gerar a descrição agora. Tente de novo.',
      refused: 'A IA não conseguiu escrever uma descrição para este anúncio.'
    }
  });
  const description = cleanDescription(result.description);
  if (!description) throw mlError('A IA não conseguiu escrever uma descrição para este anúncio.', 422, 'VISION_REFUSED');
  return {
    itemId: id,
    description,
    fill: (Array.isArray(result.fill) ? result.fill : []).map(String).slice(0, 12),
    where: WHERE.descricao
  };
}

import { aiAllowed, aiError, generateJson, geminiConfigured } from './_gemini.js';

// Identifica um produto numa foto tirada na loja do fornecedor e devolve um texto de busca para o Mercado Livre.
// Usa o Gemini (camada gratuita do Google AI Studio). Na camada gratuita o Google pode usar o conteúdo enviado
// para melhorar os produtos dele; o MargemIQ não guarda a foto.

const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const SYSTEM = `Você ajuda um revendedor brasileiro que está numa loja de atacado (como a 25 de Março ou o Brás) a pesquisar o preço de revenda de um produto no Mercado Livre.
Você recebe uma foto do produto, às vezes na embalagem. Identifique o que é e monte o texto de busca que um comprador digitaria no Mercado Livre para achar esse mesmo produto.
- O texto de busca é em português, com até 8 palavras: tipo do produto + marca + modelo/linha + a especificação que mais muda o preço (voltagem, capacidade, tamanho, quantidade na embalagem).
- Só inclua marca e modelo se estiverem legíveis na foto ou forem inconfundíveis. Nunca invente marca ou modelo; na dúvida, use só o tipo do produto e as características visíveis.
- Se a foto mostrar um kit ou pacote com várias unidades, diga isso no texto de busca.
- confidence: "alta" quando marca/modelo estão legíveis, "media" quando o tipo é claro mas o modelo não, "baixa" quando não dá para ter certeza do que é.
- Se não houver um produto identificável na foto, responda identified=false e explique em note o que atrapalhou (foto escura, tremida, muito longe).
- note: uma frase curta, em português, com o que o revendedor deve conferir antes de comprar (ex.: "confira a voltagem na caixa").`;

const SCHEMA = {
  type: 'object',
  properties: {
    identified: { type: 'boolean' },
    query: { type: 'string', description: 'Texto de busca para o Mercado Livre, até 8 palavras.' },
    name: { type: 'string' },
    brand: { type: 'string' },
    model: { type: 'string' },
    confidence: { type: 'string', enum: ['alta', 'media', 'baixa'] },
    note: { type: 'string' }
  },
  required: ['identified', 'query', 'name', 'brand', 'model', 'confidence', 'note']
};

export const visionConfigured = geminiConfigured;
export const visionAllowed = aiAllowed;
const visionError = aiError;

export function imageInput(raw) {
  const mediaType = String(raw?.mediaType || '');
  const data = String(raw?.data || '').replace(/^data:[^;]+;base64,/, '');
  if (!MEDIA_TYPES.has(mediaType) || !data || !/^[A-Za-z0-9+/]+=*$/.test(data)) {
    throw visionError('Envie uma foto em JPEG, PNG ou WebP.', 400, 'INVALID_IMAGE');
  }
  if (Math.floor(data.length * 3 / 4) > MAX_IMAGE_BYTES) {
    throw visionError('A foto ficou grande demais. Tente de novo.', 413, 'IMAGE_TOO_LARGE');
  }
  return { mediaType, data };
}

export async function identifyProduct(raw, options = {}) {
  if (!visionConfigured() && !options.client) {
    throw visionError('A identificação por foto ainda não está configurada.', 503, 'VISION_NOT_CONFIGURED');
  }
  const image = imageInput(raw);
  const result = await generateJson({
    client: options.client,
    system: SYSTEM,
    input: [
      { type: 'text', text: 'Identifique o produto desta foto.' },
      { type: 'image', data: image.data, mime_type: image.mediaType }
    ],
    schema: SCHEMA,
    messages: {
      rateLimit: 'O limite gratuito de fotos foi atingido por agora. Espere um pouco ou digite o nome do produto.',
      failure: 'Não foi possível analisar a foto agora. Tente de novo.',
      refused: 'Não foi possível analisar esta foto. Digite o nome do produto.'
    }
  });
  return {
    identified: Boolean(result.identified && String(result.query || '').trim()),
    query: String(result.query || '').trim().slice(0, 120),
    name: String(result.name || ''),
    brand: String(result.brand || ''),
    model: String(result.model || ''),
    confidence: ['alta', 'media', 'baixa'].includes(result.confidence) ? result.confidence : 'baixa',
    note: String(result.note || '')
  };
}

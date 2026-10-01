import { GoogleGenAI } from '@google/genai';

// Chamada ao Gemini (camada gratuita do Google AI Studio) com resposta em JSON.
// Usada pela identificação por foto e pela sugestão de descrição.

const DEFAULT_MODEL = 'gemini-3.8-flash';
// Segundo modelo gratuito, usado uma vez quando o principal responde 503 (sobrecarregado).
const DEFAULT_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Quem pode usar os recursos de IA (a cota gratuita é limitada). Vazio = qualquer conta do ML conectada.
export function aiAllowed(userId) {
  const allowed = String(process.env.VISION_ALLOWED_ML_USERS || '').split(',').map(id => id.trim()).filter(Boolean);
  return !allowed.length || allowed.includes(String(userId));
}

export function aiError(message, status = 502, code = 'AI_ERROR') {
  return Object.assign(new Error(message), { status, code });
}

export async function generateJson({ system, input, schema, client, timeout = 25000, messages = {} }) {
  if (!geminiConfigured() && !client) throw aiError('A IA ainda não está configurada.', 503, 'VISION_NOT_CONFIGURED');
  const gemini = client || new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const request = model => gemini.interactions.create({
    model,
    system_instruction: system,
    input,
    response_format: { type: 'text', mime_type: 'application/json', schema },
    // Não guarda o pedido nos servidores do Google para consulta posterior.
    store: false
  // Sem novas tentativas do SDK: com a cota gratuita esgotada ele tentaria 5 vezes e a tela ficaria parada.
  }, { retries: { strategy: 'none' }, timeout_ms: timeout });
  const statusOf = error => Number(error?.status ?? error?.statusCode);

  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  let interaction;
  try {
    try {
      interaction = await request(primary);
    } catch (error) {
      // 503 = modelo gratuito sobrecarregado naquele momento; outro modelo costuma ter capacidade livre.
      if (statusOf(error) !== 503 || !fallback || fallback === primary) throw error;
      console.error('Gemini sobrecarregado, tentando outro modelo', { primary, fallback });
      interaction = await request(fallback);
    }
  } catch (error) {
    const status = statusOf(error);
    console.error('Erro da API do Gemini', { status: Number.isFinite(status) ? status : null, message: error?.message });
    if (status === 429) throw aiError(messages.rateLimit || 'O limite gratuito da IA foi atingido por agora. Espere um pouco e tente de novo.', 429, 'VISION_RATE_LIMIT');
    if (status === 400 || status === 401 || status === 403) throw aiError('A chave da IA é inválida ou não tem acesso a este modelo.', 503, 'VISION_NOT_CONFIGURED');
    if (status === 503) throw aiError('A IA gratuita do Google está sobrecarregada agora. Tente de novo em alguns segundos.', 503, 'VISION_BUSY');
    throw aiError(messages.failure || 'A IA não respondeu agora. Tente de novo.', 502, 'VISION_ERROR');
  }
  try {
    return JSON.parse(interaction?.output_text || '');
  } catch {
    // Sem texto costuma ser bloqueio dos filtros de segurança do Google.
    throw aiError(messages.refused || 'A IA não conseguiu responder a este pedido.', 422, 'VISION_REFUSED');
  }
}

import { protect } from '../_account.js';
import { suggestDescription } from '../_description.js';
import { diagnoseListing } from '../_diagnosis.js';
import { aiAllowed } from '../_gemini.js';
import { analyzeListing } from '../_listing.js';
import { mlFetch } from '../_ml.js';
import { assertSameOrigin, respondWithSession } from '../_session.js';

// Análise de anúncio, diagnóstico de anúncio próprio e sugestão de descrição na mesma função
// (o plano Hobby da Vercel limita o número de funções). Nada aqui altera anúncios no Mercado Livre.
function handlePOST(request) {
  return respondWithSession(request, async token => {
    assertSameOrigin(request);
    const input = await request.json().catch(() => null);
    if (input?.action === 'diagnostico') return diagnoseListing(token, input.itemId);
    if (input?.action === 'descricao') {
      const me = await mlFetch('/users/me', token);
      if (!aiAllowed(me.id)) throw Object.assign(new Error('A IA não está liberada para esta conta.'), { status: 403, code: 'VISION_FORBIDDEN' });
      return suggestDescription(token, input.itemId);
    }
    return analyzeListing(token, input);
  });
}

export const POST = protect(handlePOST);

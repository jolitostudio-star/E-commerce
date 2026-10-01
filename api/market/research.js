import { protect } from '../_account.js';
import { researchMercadoLivre } from '../_market.js';
import { mlFetch } from '../_ml.js';
import { evaluatePurchase } from '../_purchase.js';
import { identifyProduct, visionAllowed } from '../_vision.js';
import { assertSameOrigin, mercadoLivreSession, respondWithSession, sessionHeaders } from '../_session.js';

async function handleGET(request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  if (query.length < 3 || query.length > 120) {
    return Response.json({ error: 'Informe uma busca entre 3 e 120 caracteres.' }, { status: 400 });
  }
  let session = { cookie: null };
  try {
    session = await mercadoLivreSession(request);
    const result = await researchMercadoLivre(query, url.searchParams.get('cost'), session.token, {
      commission: url.searchParams.get('commission'),
      target: url.searchParams.get('target')
    });
    return Response.json(result, { headers: sessionHeaders(session) });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code || 'INTERNAL_ERROR' }, {
      status: error.status || 500,
      headers: sessionHeaders(session)
    });
  }
}

// "Vale a pena comprar?" e a identificação por foto usam a mesma função (o plano Hobby da Vercel limita o número de funções).
function handlePOST(request) {
  return respondWithSession(request, async token => {
    assertSameOrigin(request);
    const input = await request.json().catch(() => null);
    if (input?.action === 'identificar') {
      // Cada foto tem custo na API da IA: só contas do Mercado Livre conectadas (e, se configurado, autorizadas).
      const me = await mlFetch('/users/me', token);
      if (!visionAllowed(me.id)) throw Object.assign(new Error('A identificação por foto não está liberada para esta conta.'), { status: 403, code: 'VISION_FORBIDDEN' });
      return identifyProduct(input.image);
    }
    return evaluatePurchase(token, input);
  });
}

export const GET = protect(handleGET, {admin:true});
export const POST = protect(handlePOST, {admin:true});

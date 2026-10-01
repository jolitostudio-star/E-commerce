import { protect } from '../../_account.js';
import { applyBulkPriceDiscount } from '../../_ml.js';
import { assertSameOrigin, mercadoLivreSession, sessionHeaders } from '../../_session.js';

async function handlePOST(request) {
  let session = { cookie: null };
  try {
    assertSameOrigin(request);
    session = await mercadoLivreSession(request);
    const input = await request.json();
    const result = await applyBulkPriceDiscount(session.token, input);
    return Response.json(result, { headers: sessionHeaders(session) });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code || 'INTERNAL_ERROR' }, {
      status: error.status || 500,
      headers: sessionHeaders(session)
    });
  }
}

export const POST = protect(handlePOST);

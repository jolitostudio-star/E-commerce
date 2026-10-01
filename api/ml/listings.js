import { protect } from '../_account.js';
import { listSellerItems } from '../_ml.js';
import { mercadoLivreSession, sessionHeaders } from '../_session.js';

async function handleGET(request) {
  let session = { cookie: null };
  try {
    session = await mercadoLivreSession(request);
    const result = await listSellerItems(session.token);
    return Response.json(result, { headers: sessionHeaders(session) });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code || 'INTERNAL_ERROR' }, {
      status: error.status || 500,
      headers: sessionHeaders(session)
    });
  }
}

export const GET = protect(handleGET);

import { protect } from '../_account.js';
import { listShopProducts, tiktokSession } from '../_tiktok.js';

async function handleGET(request) {
  let cookie = null;
  try {
    const current = await tiktokSession(request);
    cookie = current.cookie;
    const result = await listShopProducts(current.session);
    return Response.json(result, { headers: { 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });
  } catch (error) {
    if (!error.status) console.error(error);
    return Response.json({ error: error.status ? error.message : 'Erro interno.', code: error.code || 'INTERNAL_ERROR' }, {
      status: error.status || 500,
      headers: { 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) }
    });
  }
}

export const GET = protect(handleGET);

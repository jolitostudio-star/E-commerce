import { protect } from './_account.js';
import * as mercadolivre from './_oauth-mercadolivre.js';
import * as shopee from './_oauth-shopee.js';
import * as tiktok from './_oauth-tiktok.js';

// Uma função só para a autorização de todos os canais (o plano Hobby da Vercel limita a 12 funções).
// Os rewrites do vercel.json indicam o canal e a etapa: /api/oauth?provider=<canal>&step=<etapa>.
const providers = { mercadolivre, shopee, tiktok };

function handlerFor(request, method) {
  const url = new URL(request.url);
  const step = url.searchParams.get('step');
  const allowed = method === 'POST' ? step === 'finish' : step === 'connect' || step === 'callback';
  const provider = providers[url.searchParams.get('provider')];
  return allowed && provider && typeof provider[step] === 'function' ? provider[step] : null;
}

function notFound() {
  return Response.json({ error: 'Rota não encontrada.' }, { status: 404 });
}

function handleGET(request, account) {
  const handler = handlerFor(request, 'GET');
  return handler ? handler(request, account) : notFound();
}

function handlePOST(request, account) {
  const handler = handlerFor(request, 'POST');
  return handler ? handler(request, account) : notFound();
}

export const GET = protect(handleGET, { page: true, admin:true });
export const POST = protect(handlePOST, {admin:true});

import { cookie, readCookie, refreshAccess, seal, unseal } from './_auth.js';

// ML_ACCESS_TOKEN só vale no servidor local; na Vercel cada visitante usa a própria conta via OAuth.
function developmentToken() {
  return process.env.VERCEL ? '' : (process.env.ML_ACCESS_TOKEN || '');
}

export async function mercadoLivreSession(request) {
  const session = unseal(readCookie(request, 'ml_session'));
  if (!session?.access_token) return { token: developmentToken(), cookie: null };
  if (!session.refresh_token || session.expires_at >= Date.now() + 60000) {
    return { token: session.access_token, cookie: null };
  }
  try {
    const renewed = await refreshAccess(session.refresh_token);
    return { token: renewed.access_token, cookie: cookie('ml_session', seal(renewed), 15552000) };
  } catch (error) {
    // O refresh token do Mercado Livre é de uso único: outra requisição simultânea pode já tê-lo usado.
    // Enquanto o access token atual não vence, seguimos com ele; depois disso, é preciso reconectar.
    if (session.expires_at > Date.now()) return { token: session.access_token, cookie: null };
    throw Object.assign(new Error('A conexão com o Mercado Livre expirou. Conecte a conta novamente.'), {
      status: 401,
      code: 'ML_SESSION_EXPIRED'
    });
  }
}

export function sessionHeaders(session) {
  return {
    'cache-control': 'no-store',
    ...(session.cookie ? { 'set-cookie': session.cookie } : {})
  };
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw Object.assign(new Error('Origem da solicitação inválida.'), { status: 403, code: 'INVALID_ORIGIN' });
  }
}

// Executa uma operação com o token da sessão e devolve JSON, renovando o cookie quando necessário.
export async function respondWithSession(request, operation) {
  let session = { cookie: null };
  try {
    session = await mercadoLivreSession(request);
    const result = await operation(session.token);
    if (result instanceof Response) {
      if (session.cookie) result.headers.append('set-cookie', session.cookie);
      return result;
    }
    return Response.json(result, { headers: sessionHeaders(session) });
  } catch (error) {
    if (!error.status) console.error(error);
    return Response.json({ error: error.status ? error.message : 'Erro interno.', code: error.code || 'INTERNAL_ERROR' }, {
      status: error.status || 500,
      headers: sessionHeaders(session)
    });
  }
}

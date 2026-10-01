import { createClient } from '@supabase/supabase-js';
import { seal, unseal, readCookie } from './_auth.js';

export function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.SESSION_SECRET) {
    throw Object.assign(new Error('Autenticação não configurada.'), { status: 503 });
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export function accountCookie(request, session) {
  const secure = process.env.VERCEL || new URL(request.url).protocol === 'https:';
  return `miq_account=${session ? encodeURIComponent(seal({ access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at })) : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session ? 2592000 : 0}${secure ? '; Secure' : ''}`;
}

export function sameOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw Object.assign(new Error('Origem inválida.'), { status: 403 });
  }
}

export async function authenticate(request) {
  let session;
  try { session = unseal(readCookie(request, 'miq_account')); } catch { /* malformed cookie */ }
  if (!session?.access_token) return null;
  const supabase = client();
  let renewed = null;
  if (session.expires_at * 1000 < Date.now() + 60000) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token });
    if (error || !data.session) return null;
    session = data.session;
    renewed = accountCookie(request, session);
  }
  // Always validate with Auth, never trust the cookie's embedded user/claims.
  const { data, error } = await supabase.auth.getUser(session.access_token);
  return error || !data.user || data.user.is_anonymous ? null : { user: data.user, session, cookie: renewed };
}

export function protect(handler, { page = false } = {}) {
  return async request => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) sameOrigin(request);
      const account = await authenticate(request);
      if (!account) return page
        ? new Response(null, { status: 303, headers: { location: '/login', 'cache-control': 'no-store' } })
        : Response.json({ error: 'Entre na sua conta para continuar.', code: 'AUTH_REQUIRED' }, { status: 401, headers: { 'cache-control': 'no-store' } });
      const response = await handler(request, account);
      response.headers.set('cache-control', 'private, no-store');
      if (account.cookie) response.headers.append('set-cookie', account.cookie);
      return response;
    } catch (error) {
      return Response.json({ error: error.status ? error.message : 'Não foi possível validar sua sessão.' }, { status: error.status || 503, headers: { 'cache-control': 'no-store' } });
    }
  };
}

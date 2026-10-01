import { client, accountCookie, authenticate, sameOrigin, protect } from './_account.js';
import { clearCookie } from './_auth.js';
import { dashboard } from './_app.js';
import { validateLead, leadCookie, readLead } from './_lead.js';

export async function GET(request) {
  if (new URL(request.url).searchParams.get('view') === 'lead') {
    return Response.json({ pendingListing: readLead(request) }, { headers: { 'cache-control': 'private, no-store' } });
  }
  if (new URL(request.url).searchParams.get('view') === 'app') {
    return protect((req, account) => {
      const id = JSON.stringify(account.user.id).replace(/</g, '\\u003c');
      const html = dashboard.replace('<head>', `<head><script>window.accountId=${id};</script>`);
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }, { page: true })(request);
  }
  return protect((req, account) => Response.json({ user: { id: account.user.id, email: account.user.email }, pendingListing: readLead(req) }))(request);
}

export async function POST(request) {
  const headers = new Headers({ 'cache-control': 'no-store' });
  try {
    sameOrigin(request);
    const input = await request.json();
    if (input.action === 'lead') {
      const ref = validateLead(input.ref);
      if (!ref) return Response.json({ error: 'Cole um link válido de anúncio do Mercado Livre ou o ID MLB.' }, { status: 400, headers });
      headers.append('set-cookie', leadCookie(request, ref));
      return Response.json({ ok: true, next: '/diagnostico' }, { headers });
    }
    const supabase = client();
    if (input.action === 'logout') {
      const account = await authenticate(request);
      if (account) {
        await supabase.auth.setSession(account.session);
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      headers.append('set-cookie', accountCookie(request, null));
      for (const name of ['ml_session', 'shopee_session', 'tiktok_session', 'ml_oauth_attempt', 'shopee_oauth_attempt', 'tiktok_oauth_attempt', 'miq_funnel_return']) headers.append('set-cookie', clearCookie(name));
      return Response.json({ ok: true }, { headers });
    }
    if (!['login', 'signup'].includes(input.action) || typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || typeof input.password !== 'string' || input.password.length < (input.action === 'signup' ? 8 : 1) || input.password.length > 256) {
      return Response.json({ error: 'Informe um e-mail válido e uma senha (mínimo de 8 caracteres no cadastro).' }, { status: 400, headers });
    }
    const credentials = { email: input.email.trim(), password: input.password };
    const { data, error } = input.action === 'signup' ? await supabase.auth.signUp(credentials) : await supabase.auth.signInWithPassword(credentials);
    if (error) return Response.json({ error: input.action === 'login' ? 'E-mail ou senha inválidos, ou e-mail ainda não confirmado.' : 'Não foi possível cadastrar. Verifique os dados e tente novamente.' }, { status: 400, headers });
    if (data.session) {
      headers.append('set-cookie', accountCookie(request, data.session));
      // Prevent marketplace credentials carrying over when a different person signs in.
      for (const name of ['ml_session', 'shopee_session', 'tiktok_session']) headers.append('set-cookie', clearCookie(name));
    }
    const continuing = input.next === 'diagnostico' && readLead(request);
    if (data.session && !continuing) headers.append('set-cookie', clearCookie('miq_lead'));
    return Response.json({ ok: true, signedIn: Boolean(data.session), next: continuing ? '/diagnostico' : '/app', message: data.session ? 'Bem-vindo!' : 'Confira seu e-mail para confirmar o cadastro. Depois, entre com sua senha.' }, { headers });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : 'Não foi possível concluir. Tente novamente.' }, { status: error.status || 503, headers });
  }
}

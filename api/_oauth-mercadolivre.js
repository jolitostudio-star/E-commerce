import { clearCookie, cookie, createOauthAttempt, exchangeCode, readCookie, redirectUri, seal, unseal } from './_auth.js';

export function connect(request) {
  try {
    const attempt = createOauthAttempt();
    const url = new URL('https://auth.mercadolivre.com.br/authorization');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', process.env.ML_CLIENT_ID || '');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', attempt.state);
    url.searchParams.set('code_challenge', attempt.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    const headers = new Headers({ location: url.toString(), 'set-cookie': cookie('ml_oauth_attempt', attempt.cookie, 600), 'cache-control': 'no-store' });
    if (request && new URL(request.url).searchParams.get('next') === 'diagnostico') headers.append('set-cookie', cookie('miq_funnel_return', seal({ path: '/diagnostico', at: Date.now() }), 600));
    return new Response(null, {
      status: 302,
      headers
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function callback(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response(null, { status: 302, headers: { location: '/' } });
  const attempt = unseal(readCookie(request, 'ml_oauth_attempt'));
  if (!attempt || attempt.state !== url.searchParams.get('state') || Date.now() - attempt.createdAt > 600000) {
    return new Response('Autorização inválida ou expirada.', { status: 400 });
  }
  let token;
  try {
    token = await exchangeCode(code, attempt.verifier);
  } catch (error) {
    return new Response(`Não foi possível concluir a autorização: ${error.message}`, { status: 502 });
  }
  const title = 'Mercado Livre conectado';
  const detail = 'A conta foi autorizada com segurança. Você já pode consultar anúncios reais no MargemIQ.';
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · MargemIQ</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07080b;color:#eef1f5;font:16px Inter,system-ui}.card{max-width:560px;margin:24px;padding:32px;border:1px solid #283020;border-radius:18px;background:#0e1015}.mark{width:48px;height:48px;border-radius:14px;background:#d8ff3e;color:#07080b;display:grid;place-items:center;font-size:26px;font-weight:900}h1{font-size:24px;margin:20px 0 10px}p{color:#9aa2ae;line-height:1.6}a{color:#d8ff3e}</style><body><main class="card"><div class="mark">↗</div><h1>${title}</h1><p>${detail}</p><a href="/app">Voltar ao MargemIQ</a></main></body></html>`;
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  headers.append('set-cookie', cookie('ml_session', seal(token), 15552000));
  headers.append('set-cookie', clearCookie('ml_oauth_attempt'));
  const funnel = unseal(readCookie(request, 'miq_funnel_return'));
  if (funnel?.path === '/diagnostico' && Date.now() - funnel.at < 600000) {
    headers.set('location', '/diagnostico');
    headers.append('set-cookie', clearCookie('miq_funnel_return'));
    return new Response(null, { status: 303, headers });
  }
  return new Response(html, { headers });
}

export async function finish(request) {
  const form = await request.formData();
  const code = form.get('code');
  const state = form.get('state');
  const attempt = unseal(readCookie(request, 'ml_oauth_attempt'));

  if (!code || !attempt || attempt.state !== state || Date.now() - attempt.createdAt > 600000) {
    return new Response('Autorização inválida ou expirada.', { status: 400 });
  }

  let token;
  try {
    token = await exchangeCode(code, attempt.verifier);
  } catch (error) {
    return new Response(`Não foi possível concluir a autorização: ${error.message}`, { status: 502 });
  }

  const funnel = unseal(readCookie(request, 'miq_funnel_return'));
  const back = funnel?.path === '/diagnostico' && Date.now() - funnel.at < 600000 ? '/diagnostico' : '/app?mercadolivre=conectado';
  const headers = new Headers({ location: back, 'cache-control': 'no-store' });
  headers.append('set-cookie', clearCookie('miq_funnel_return'));
  headers.append('set-cookie', cookie('ml_session', seal(token), 15552000));
  headers.append('set-cookie', clearCookie('ml_oauth_attempt'));
  return new Response(null, { status: 303, headers });
}

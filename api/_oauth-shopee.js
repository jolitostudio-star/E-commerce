import { clearCookie, cookie, readCookie, unseal } from './_auth.js';
import { createShopeeAuthorization, exchangeShopeeCode, shopeeSessionCookie } from './_shopee.js';

export function connect() {
  try {
    const authorization = createShopeeAuthorization();
    return new Response(null, {
      status: 302,
      headers: { location: authorization.url, 'set-cookie': cookie('shopee_oauth_attempt', authorization.cookie, 600), 'cache-control': 'no-store' }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function page(title, detail, status = 200) {
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · MargemIQ</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07080b;color:#eef1f5;font:16px Inter,system-ui}.card{max-width:560px;margin:24px;padding:32px;border:1px solid #283020;border-radius:18px;background:#0e1015}.mark{width:48px;height:48px;border-radius:14px;background:#d8ff3e;color:#07080b;display:grid;place-items:center;font-size:26px;font-weight:900}h1{font-size:24px;margin:20px 0 10px}p{color:#9aa2ae;line-height:1.6}a{color:#d8ff3e}</style><body><main class="card"><div class="mark">↗</div><h1>${title}</h1><p>${detail}</p><a href="/">Voltar ao MargemIQ</a></main></body></html>`;
  return new Response(html, { status, headers: new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }) });
}

export async function callback(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const shopId = url.searchParams.get('shop_id');
  if (!code) return new Response(null, { status: 302, headers: { location: '/' } });
  const attempt = unseal(readCookie(request, 'shopee_oauth_attempt'));
  if (!attempt || attempt.state !== url.searchParams.get('state') || Date.now() - attempt.createdAt > 600000) {
    return new Response('Autorização inválida ou expirada.', { status: 400 });
  }
  if (!shopId) {
    return page('Autorize pela conta da loja', 'A autorização veio de uma conta principal. Entre com a conta da própria loja na Shopee e conecte novamente.', 400);
  }
  let token;
  try {
    token = await exchangeShopeeCode(code, shopId);
  } catch (error) {
    return new Response(`Não foi possível concluir a autorização: ${error.message}`, { status: 502 });
  }
  const response = page('Shopee conectada', 'A loja foi autorizada com segurança. Você já pode sincronizar os anúncios da Shopee no MargemIQ.');
  response.headers.append('set-cookie', shopeeSessionCookie(token));
  response.headers.append('set-cookie', clearCookie('shopee_oauth_attempt'));
  return response;
}

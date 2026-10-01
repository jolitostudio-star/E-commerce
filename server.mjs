import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Servidor local que espelha a Vercel: arquivos públicos + as mesmas funções de api/.
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 3000);
const vercelConfig = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const securityHeaders = Object.fromEntries(
  (vercelConfig.headers || []).flatMap(rule => rule.headers.map(header => [header.key.toLowerCase(), header.value]))
);

// Só estes arquivos são públicos. Nunca expor .env, código do servidor, testes etc.
const publicPages = new Set(['index.html', 'login.html', 'diagnostico.html', 'finalizar.html']);
function publicFile(pathname) {
  let relative;
  try { relative = decodeURIComponent(pathname).replace(/^\/+/, ''); } catch { return null; }
  if (relative === '') return 'index.html';
  if (publicPages.has(relative)) return relative;
  if (publicPages.has(relative + '.html')) return relative + '.html';
  if (/^assets\/[\w.-]+$/.test(relative) && !relative.includes('..')) return relative;
  return null;
}

function apiModulePath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'api' || segments.length < 2) return null;
  if (!segments.every(segment => /^[a-z0-9-]+$/.test(segment))) return null;
  const file = join(root, ...segments) + '.js';
  return existsSync(file) ? file : null;
}

function send(res, status, headers, body) {
  res.writeHead(status, { ...securityHeaders, ...headers });
  res.end(body);
}

async function toWebRequest(req, url) {
  const chunks = [];
  let size = 0;
  if (!['GET', 'HEAD'].includes(req.method)) {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1_000_000) throw Object.assign(new Error('Solicitação muito grande.'), { status: 413 });
      chunks.push(chunk);
    }
  }
  return new Request(url, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(v => [key, v])),
    body: chunks.length ? Buffer.concat(chunks) : undefined
  });
}

async function sendWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => { if (key !== 'set-cookie') headers[key] = value; });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  send(res, response.status, headers, Buffer.from(await response.arrayBuffer()));
}

async function handleApi(req, res, url, modulePath) {
  try {
    const handlers = await import(pathToFileURL(modulePath).href);
    const handler = handlers[req.method];
    if (typeof handler !== 'function') {
      return send(res, 405, { 'content-type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Método não permitido.' }));
    }
    return await sendWebResponse(res, await handler(await toWebRequest(req, url)));
  } catch (error) {
    console.error(error);
    return send(res, error.status || 500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      JSON.stringify({ error: error.status ? error.message : 'Erro interno.', code: 'INTERNAL_ERROR' }));
  }
}

const server = http.createServer(async (req, res) => {
  let url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
  const rewrite = (vercelConfig.rewrites || []).find(rule => rule.source === url.pathname);
  // Como na Vercel, a query do destino do rewrite se soma à query original.
  if (rewrite) {
    const destination = new URL(rewrite.destination, url);
    url.searchParams.forEach((value, key) => destination.searchParams.append(key, value));
    url = destination;
  }
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    const modulePath = apiModulePath(pathname);
    if (modulePath) return handleApi(req, res, url, modulePath);
    return send(res, 404, { 'content-type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'Rota não encontrada.' }));
  }

  const file = publicFile(pathname);
  if (!file) return send(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Arquivo não encontrado.');
  try {
    const body = await readFile(join(root, file));
    send(res, 200, { 'content-type': types[extname(file)] || 'application/octet-stream' }, body);
  } catch {
    send(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Arquivo não encontrado.');
  }
});

server.listen(port, () => console.log(`MargemIQ disponível em http://localhost:${port}`));

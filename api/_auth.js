import crypto from 'node:crypto';

const encoder = new TextEncoder();
const redirectUri = process.env.ML_REDIRECT_URI || '';

export function assertOauthConfig() {
  const missing = ['ML_CLIENT_ID', 'ML_CLIENT_SECRET', 'ML_REDIRECT_URI', 'SESSION_SECRET'].filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Configuração OAuth incompleta: ${missing.join(', ')}.`);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET não configurado.');
  return crypto.createHash('sha256').update(secret).digest();
}

export function createOauthAttempt() {
  assertOauthConfig();
  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { state, verifier, challenge, cookie: seal({ state, verifier, createdAt: Date.now() }) };
}

export function seal(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString('base64url')).join('.');
}

export function unseal(value) {
  if (!value) return null;
  try {
    const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

export function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  const match = raw.split(';').map(item => item.trim()).find(item => item.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookie(name) {
  return cookie(name, '', 0);
}

export async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ML_CLIENT_ID || '',
    client_secret: process.env.ML_CLIENT_SECRET || '',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  });
  return tokenRequest(body);
}

export async function refreshAccess(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID || '',
    client_secret: process.env.ML_CLIENT_SECRET || '',
    refresh_token: refreshToken
  });
  return tokenRequest(body);
}

async function tokenRequest(body) {
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) {
    console.error('Mercado Livre OAuth recusado', {
      status: response.status,
      error: result.error || null,
      message: result.message || null,
      cause: result.cause || null
    });
    throw new Error(result.message || result.error || 'Falha ao autorizar o Mercado Livre.');
  }
  return { ...result, expires_at: Date.now() + Number(result.expires_in || 0) * 1000 };
}

export { redirectUri };

import { shopeeConfigured } from './_shopee.js';
import { tiktokConfigured } from './_tiktok.js';
import { visionConfigured } from './_vision.js';

export function GET() {
  return Response.json({
    ok: true,
    platform: 'vercel',
    integrations: {
      mercadoLivreConfigured: Boolean(
        (!process.env.VERCEL && process.env.ML_ACCESS_TOKEN) ||
        (process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET && process.env.ML_REDIRECT_URI && process.env.SESSION_SECRET)
      ),
      shopeeConfigured: shopeeConfigured(),
      tiktokConfigured: tiktokConfigured(),
      visionConfigured: visionConfigured()
    }
  }, { headers: { 'cache-control': 'no-store' } });
}

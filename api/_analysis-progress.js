import { analyzeListing } from './_listing.js';
import { previewOf } from './_lead.js';

export function streamPreview(token, ref, analyze = analyzeListing) {
  if (!token) throw Object.assign(new Error('Conecte sua conta do Mercado Livre para consultar o anúncio.'), { status: 401, code: 'ML_NOT_CONNECTED' });
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const emit = event => { if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); };
      try {
        const report = await analyze(token, { ref }, { onProgress: progress => emit({ type: 'progress', ...progress }), onListing: listing => emit({ type: 'listing', listing }) });
        emit({ type: 'ready', preview: previewOf(report) });
      } catch (error) {
        emit({ type: 'error', error: error.status ? error.message : 'Não foi possível concluir a consulta. Tente novamente.', code: error.code || 'ANALYSIS_FAILED' });
      } finally { if (!cancelled) controller.close(); }
    },
    cancel() { cancelled = true; }
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}

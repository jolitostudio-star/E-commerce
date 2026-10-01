import { protect } from '../_account.js';
import { suggestDescription } from '../_description.js';
import { diagnoseListing } from '../_diagnosis.js';
import { aiAllowed } from '../_gemini.js';
import { analyzeListing } from '../_listing.js';
import { mlFetch } from '../_ml.js';
import { assertSameOrigin, respondWithSession } from '../_session.js';
import { readLead, previewOf } from '../_lead.js';
import { paidOrder, billingError } from '../_billing.js';
import { streamPreview } from '../_analysis-progress.js';

// Análise de anúncio, diagnóstico de anúncio próprio e sugestão de descrição na mesma função
// (o plano Hobby da Vercel limita o número de funções). Nada aqui altera anúncios no Mercado Livre.
async function handlePOST(request, account) {
    assertSameOrigin(request);
    const input = await request.json().catch(() => null);
    if (input?.action === 'previa') {
      const ref = readLead(request);
      if (!ref) throw Object.assign(new Error('Cole o link do anúncio para começar.'), { status: 400, code: 'LEAD_REQUIRED' });
      return respondWithSession(request, async token => input.progress ? streamPreview(token, ref) : previewOf(await analyzeListing(token, { ref })));
    }
    if (!input?.orderId) throw billingError('A análise completa custa R$ 1 por anúncio. Comece pela prévia gratuita.', 402, 'PAYMENT_REQUIRED');
    const order = await paidOrder(account.user.id, input.orderId);
    if (!order.report) throw billingError('Sua análise ainda está sendo preparada. Tente novamente.', 409, 'REPORT_PENDING');
    if (['diagnostico','descricao'].includes(input.action) && input.itemId !== order.report.listing.id) throw billingError('O pagamento corresponde a outro anúncio.', 403, 'ORDER_MISMATCH');
    if (input?.action === 'diagnostico') return respondWithSession(request, token => diagnoseListing(token, input.itemId));
    if (input?.action === 'descricao') {
      return respondWithSession(request, async token => {
      const me = await mlFetch('/users/me', token);
      if (!aiAllowed(me.id)) throw Object.assign(new Error('A IA não está liberada para esta conta.'), { status: 403, code: 'VISION_FORBIDDEN' });
      return suggestDescription(token, input.itemId);
      });
    }
    return Response.json(order.report);
}

export const POST = protect(handlePOST);

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
import { streamGuestPreview, prepareReport } from '../_guest-analysis.js';
import { sameOrigin } from '../_account.js';
import { isAdmin } from '../_access.js';

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
    if(['diagnostico','descricao'].includes(input.action) && !isAdmin(account.user)) throw billingError('Esta ferramenta é exclusiva do painel.',403,'ADMIN_REQUIRED');
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

export async function POST(request) {
  try {
    sameOrigin(request);
    const input=await request.clone().json().catch(()=>null);
    if(input?.action==='previa') return input.progress ? streamGuestPreview(request,{resumeOnly:input.resume===true}) : Response.json(await prepareReport(request,{resumeOnly:input.resume===true}),{headers:{'cache-control':'private, no-store'}});
    return protect(handlePOST)(request);
  } catch(error) {
    return Response.json({error:error.status?error.message:'Não foi possível consultar o anúncio.',code:error.code || 'ANALYSIS_FAILED'},{status:error.status || 503,headers:{'cache-control':'no-store'}});
  }
}

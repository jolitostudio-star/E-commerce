import { protect } from './_account.js';
import { getCategories, getTrends, keywordInsight, opportunityOf } from './_radar.js';
import { respondWithSession } from './_session.js';

// Uma função só para o Radar (o plano Hobby da Vercel limita a 12 funções). Os rewrites do vercel.json
// mantêm os endereços /api/radar/trends, /api/radar/categories e /api/radar/keyword.
const VIEWS = {
  trends: (token, params) => getTrends(token, { category: params.get('category') || '' }),
  categories: token => getCategories(token),
  keyword: async (token, params) => {
    const insight = await keywordInsight(token, params.get('q'));
    const group = params.get('group');
    return group ? { ...insight, opportunity: opportunityOf(group, insight.competition.level) } : insight;
  }
};

function handleGET(request) {
  const params = new URL(request.url).searchParams;
  const view = VIEWS[params.get('view')];
  if (!view) return Response.json({ error: 'Rota não encontrada.' }, { status: 404 });
  return respondWithSession(request, token => view(token, params));
}

export const GET = protect(handleGET, {admin:true});

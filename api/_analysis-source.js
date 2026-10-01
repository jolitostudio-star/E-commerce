import { randomUUID } from 'node:crypto';
import { seal, unseal, refreshAccess } from './_auth.js';
import { isAdmin } from './_access.js';
import { billingDb, billingError } from './_billing.js';

const unavailable = () => billingError('A consulta de anúncios ainda não está disponível. Tente novamente mais tarde; nenhuma cobrança foi feita.',503,'SOURCE_UNAVAILABLE');
export async function saveAnalysisSource(account, token, db = billingDb()) {
  if (!isAdmin(account?.user)) throw billingError('Apenas o proprietário pode configurar a consulta.',403,'ADMIN_REQUIRED');
  const { error } = await db.from('diagnostic_source').upsert({id:'mercadolivre',owner_id:account.user.id,credentials:seal(token),revision:randomUUID(),lease_until:null});
  if (error) throw unavailable();
}
export async function analysisSourceToken(db = billingDb()) {
  // Optional server-only token; never a token supplied by a visitor.
  if (process.env.ML_ANALYSIS_ACCESS_TOKEN) return process.env.ML_ANALYSIS_ACCESS_TOKEN;
  const {data:source,error} = await db.from('diagnostic_source').select('*').eq('id','mercadolivre').maybeSingle();
  if (error || !source || !isAdmin({id:source.owner_id})) throw unavailable();
  let token;
  try { token = unseal(source.credentials); } catch { throw unavailable(); }
  if (!token?.access_token) throw unavailable();
  if (token.expires_at > Date.now()+120000) return token.access_token;
  if (!token.refresh_token) throw unavailable();
  if (source.lease_until && Date.parse(source.lease_until)>Date.now()) {
    if(token.expires_at > Date.now()+15000) return token.access_token;
    throw unavailable();
  }
  const revision=randomUUID();
  const {data:claimed,error:claimError} = await db.from('diagnostic_source').update({revision,lease_until:new Date(Date.now()+30000).toISOString()}).eq('id','mercadolivre').eq('revision',source.revision).select('id').maybeSingle();
  if(claimError || !claimed) throw unavailable();
  try {
    const renewed = await refreshAccess(token.refresh_token);
    const {error:saveError} = await db.from('diagnostic_source').update({credentials:seal(renewed),lease_until:null}).eq('id','mercadolivre').eq('revision',revision);
    if(saveError) throw unavailable();
    return renewed.access_token;
  } catch {
    // Keep the lease until it expires; do not retry a single-use refresh token immediately.
    if(token.expires_at > Date.now()+15000) return token.access_token;
    throw unavailable();
  }
}

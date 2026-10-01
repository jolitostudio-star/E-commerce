import { createHash } from 'node:crypto';
import { readLeadState } from './_lead.js';
import { analyzeListing } from './_listing.js';
import { analysisSourceToken } from './_analysis-source.js';
import { billingDb, billingError } from './_billing.js';

const scope = request => {
  const lead=readLeadState(request);
  if(!lead) throw billingError('Cole novamente o link do anúncio para começar.',400,'LEAD_REQUIRED');
  return {...lead,key:createHash('sha256').update(lead.id).digest('hex')};
};
export function previewMetadata(report, cached=false) {
  return {listing:{id:report.listing.id,title:report.listing.title,thumbnail:report.listing.thumbnail || null},analyzedAt:report.analyzedAt,cached,ready:true};
}
export async function preparedReport(request, db=billingDb()) {
  const lead=scope(request);
  const {data,error}=await db.from('diagnostic_previews').select('report,listing_ref,expires_at').eq('lead_hash',lead.key).maybeSingle();
  if(error) throw billingError('Não foi possível recuperar a consulta.',503,'PREVIEW_UNAVAILABLE');
  return data?.listing_ref===lead.ref && Date.parse(data.expires_at)>Date.now() && data.report ? data.report : null;
}
export async function prepareReport(request, options={}) {
  const db=options.db || billingDb(), lead=scope(request);
  const existing=await preparedReport(request,db);
  if(existing) return previewMetadata(existing,true);
  if(options.resumeOnly) throw billingError('Sua consulta expirou. Informe o anúncio novamente antes de pagar.',409,'PREVIEW_REQUIRED');
  const token=await (options.source || analysisSourceToken)(db);
  const {count,error:limitError}=await db.from('diagnostic_previews').select('lead_hash',{count:'exact',head:true}).gte('created_at',new Date(Date.now()-60000).toISOString());
  if(limitError) throw billingError('A consulta está temporariamente indisponível.',503,'PREVIEW_UNAVAILABLE');
  if(count>=20) throw billingError('Muitas consultas neste momento. Tente novamente em um minuto.',429,'PREVIEW_LIMIT');
  const {error:claimError}=await db.from('diagnostic_previews').upsert({lead_hash:lead.key,listing_ref:lead.ref,report:null,expires_at:new Date(Date.now()+3600000).toISOString()},{onConflict:'lead_hash',ignoreDuplicates:true});
  if(claimError) throw billingError('Não foi possível iniciar a consulta.',503,'PREVIEW_UNAVAILABLE');
  const report=await (options.analyze || analyzeListing)(token,{ref:lead.ref},{publicOnly:true,onProgress:options.onProgress,onListing:options.onListing});
  const {error:saveError}=await db.from('diagnostic_previews').update({report,expires_at:new Date(Date.now()+3600000).toISOString()}).eq('lead_hash',lead.key).eq('listing_ref',lead.ref);
  if(saveError) throw billingError('Não foi possível salvar sua análise. Nenhuma cobrança foi feita.',503,'PREVIEW_UNAVAILABLE');
  return previewMetadata(report);
}
export function streamGuestPreview(request, options={}) {
  const encoder=new TextEncoder();let cancelled=false;
  const stream=new ReadableStream({async start(controller){
    const emit=event=>{if(!cancelled)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));};
    try {
      const preview=await prepareReport(request,{...options,onProgress:event=>emit({type:'progress',...event}),onListing:listing=>emit({type:'listing',listing})});
      emit({type:'ready',preview});
    } catch(error) {
      emit({type:'error',code:error.code || 'ANALYSIS_FAILED',error:error.status?error.message:'Não foi possível consultar o anúncio. Nenhuma cobrança foi feita.'});
    } finally {if(!cancelled)controller.close();}
  },cancel(){cancelled=true;}});
  return new Response(stream,{headers:{'content-type':'application/x-ndjson; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}

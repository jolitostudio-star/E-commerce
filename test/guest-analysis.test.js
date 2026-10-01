import test from 'node:test';
import assert from 'node:assert/strict';
import { leadCookie } from '../api/_lead.js';
import { prepareReport, preparedReport, previewMetadata, streamGuestPreview } from '../api/_guest-analysis.js';
process.env.SESSION_SECRET='guest-test-secret-at-least-thirty-two-characters';
const request=()=>new Request('https://example.com/api/analysis/listing',{method:'POST',headers:{origin:'https://example.com',cookie:leadCookie(new Request('https://example.com'),'MLB12345678').split(';')[0]}});
const report={listing:{id:'MLB12345678',title:'Fone Bluetooth',thumbnail:'https://http2.mlstatic.com/fone.jpg'},analyzedAt:Date.now(),title:{score:55},strategy:{actions:['paid-only-improvements']}};
function database(){
  let row=null,count=0;
  return {get row(){return row;},get writes(){return count;},from(){return {
    select(_columns,options){this.countOnly=options?.head;return this;},eq(){return this;},gte(){return Promise.resolve({count:0,error:null});},
    maybeSingle(){return Promise.resolve({data:row,error:null});},
    upsert(value){if(!row)row={...value};return Promise.resolve({error:null});},
    update(value){this.patch=value;return this;},
    then(resolve){count++;row={...row,...this.patch};resolve({error:null});}
  };}};
}
test('a real report is prepared before payment, but no scores or findings reach the guest',async()=>{
  const db=database(),req=request();let calls=0;
  const analyze=async(token,input,options)=>{calls++;assert.equal(token,'server-token');assert.equal(input.ref,'MLB12345678');assert.equal(options.publicOnly,true);return report;};
  const result=await prepareReport(req,{db,source:async()=> 'server-token',analyze});
  assert.equal(result.listing.title,'Fone Bluetooth');assert.equal(result.ready,true);
  assert.doesNotMatch(JSON.stringify(result),/paid-only|score|strategy|server-token/);
  assert.deepEqual((await preparedReport(req,db)).strategy,report.strategy);
  const again=await prepareReport(req,{db,source:()=>{throw new Error('must reuse');},analyze});
  assert.equal(again.cached,true);assert.equal(calls,1);
});
test('a forged or missing listing cannot prepare a report',async()=>{
  await assert.rejects(()=>prepareReport(new Request('https://example.com'),{db:database()}),{code:'LEAD_REQUIRED'});
});
test('failed consultation never emits ready or reveals a final report',async()=>{
  const response=streamGuestPreview(request(),{db:database(),source:async()=>{throw Object.assign(new Error('Consulta indisponível'),{status:503,code:'SOURCE_UNAVAILABLE'});}});
  const events=(await response.text()).trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.map(x=>x.type),['error']);assert.equal(events[0].code,'SOURCE_UNAVAILABLE');
});
test('expired reports require a new real consultation',async()=>{
  const db=database(),req=request();await prepareReport(req,{db,source:async()=> 'token',analyze:async()=>report});
  db.row.expires_at=new Date(0).toISOString();assert.equal(await preparedReport(req,db),null);
});
test('preview metadata is a strict projection of the public product identity',()=>{
  assert.deepEqual(Object.keys(previewMetadata(report)).sort(),['analyzedAt','cached','listing','ready']);
});

test('registration continuation never silently repeats an expired analysis',async()=>{
  let called=false;
  await assert.rejects(()=>prepareReport(request(),{db:database(),resumeOnly:true,source:async()=>{called=true;return 'token';}}),{code:'PREVIEW_REQUIRED'});
  assert.equal(called,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateLead, previewOf, readLead } from '../api/_lead.js';
import { seal } from '../api/_auth.js';
import { normalizeCosts, trustedPayment, preferenceBody, verifyWebhook, paidOrder, reconcilePayment } from '../api/_billing.js';
import { POST as analyze } from '../api/analysis/listing.js';

process.env.SESSION_SECRET = 'test-secret-at-least-thirty-two-characters';
const order = { id:'12345678-1234-1234-1234-123456789abc', user_id:'owner', collector_id:'99', payment_id:'42', status:'approved', report:{ private:'full report' } };
const payment = (extra = {}) => ({ id:42, external_reference:order.id, metadata:{ user_id:'owner', order_id:order.id }, collector_id:99, currency_id:'BRL', transaction_amount:1, status:'approved', date_last_updated:new Date().toISOString(), ...extra });
function database(row, latest = null) {
  return { from() {
    const filters = {}; let update = false;
    const builder = {
      select(){return this;}, eq(key,value){filters[key]=value; return this;},
      update(){update=true;return this;}, or(){return this;},
      async maybeSingle(){
        if ((filters.user_id && filters.user_id !== row.user_id) || (filters.id && filters.id !== row.id)) return {data:null};
        if(update && latest) return {data:null};
        return {data:update ? {...row,status:row.providerStatus || 'approved'} : latest || row};
      }
    };
    return builder;
  }};
}
test('lead accepts Mercado Livre references and rejects foreign URLs', () => {
  assert.equal(validateLead(' MLB12345678 '),'MLB12345678');
  assert.equal(validateLead('https://meli.la/example'),'https://meli.la/example');
  for(const ref of ['https://evil.example/MLB12345678','https://mercadolivre.com.br.evil.example/MLB12345678','https://user:secret@mercadolivre.com.br/MLB12345678','http://meli.la/example']) assert.equal(validateLead(ref),null);
});
test('expired saved references cannot start a checkout', () => {
  const cookie = 'miq_lead='+encodeURIComponent(seal({ref:'MLB12345678',createdAt:Date.now()-604800001}));
  assert.equal(readLead(new Request('https://example.com',{headers:{cookie}})),null);
});
test('preview never serializes the paid strategy, costs or report', () => {
  const result = previewOf({ listing:{id:'MLB12345678',title:'Example',secret:'hidden'}, title:{score:62,checks:[{ok:false,detail:'Title too short'}]}, content:{pictures:1}, strategy:{private:'secret strategy'}, pricing:{cost:888}, analyzedAt:'now' });
  assert.deepEqual(Object.keys(result).sort(),['analyzedAt','finding','listing','note','titleScore']);
  assert.deepEqual(result.listing,{id:'MLB12345678',title:'Example'});
  assert.doesNotMatch(JSON.stringify(result),/888|secret strategy|hidden/);
});
test('checkout charges exactly R$ 1 and uses only public HTTPS auto-return', () => {
  const old = process.env.APP_URL;
  try {
    process.env.APP_URL='http://localhost:3000';
    assert.equal(preferenceBody(order,{user:{email:'buyer@example.com'}}).auto_return,undefined);
    process.env.APP_URL='https://example.com';
    const body=preferenceBody(order,{user:{email:'buyer@example.com'}});
    assert.equal(body.items[0].unit_price,1); assert.equal(body.items[0].quantity,1);
    assert.equal(body.auto_return,'approved'); assert.equal(body.external_reference,order.id);
  } finally { if(old === undefined) delete process.env.APP_URL; else process.env.APP_URL=old; }
});
test('amount, currency, recipient and user must match; refunds revoke access', () => {
  assert.equal(trustedPayment(payment(),order),'approved');
  for(const mismatch of [{transaction_amount:0.01},{currency_id:'USD'},{collector_id:1},{external_reference:'another'},{metadata:{user_id:'another',order_id:order.id}}]) assert.throws(()=>trustedPayment(payment(mismatch),order),{code:'PAYMENT_MISMATCH'});
  assert.equal(trustedPayment(payment({transaction_amount_refunded:1}),order),'refunded');
  assert.equal(trustedPayment(payment({status:'in_process'}),order),'pending');
});
test('paid reports reject another account and pending payment', async () => {
  await assert.rejects(paidOrder('other',order.id,{db:database(order)}),{code:'ORDER_NOT_FOUND'});
  await assert.rejects(paidOrder('owner',order.id,{db:database({...order,payment_id:null})}),{code:'PAYMENT_REQUIRED'});
  await assert.rejects(paidOrder('owner',order.id,{db:database({...order,providerStatus:'pending'}),payment:{get:async()=>payment({status:'pending'})}}),{code:'PAYMENT_REQUIRED'});
});
test('paid report requires provider revalidation and rejects a refund', async () => {
  let calls=0;
  const result=await paidOrder('owner',order.id,{db:database(order),payment:{get:async()=>{calls++;return payment();}}});
  assert.equal(result.id,order.id); assert.equal(calls,1);
  await assert.rejects(paidOrder('owner',order.id,{db:database({...order,providerStatus:'refunded'}),payment:{get:async()=>payment({status:'refunded'})}}),{code:'PAYMENT_REQUIRED'});
});
test('older approved events cannot override a newer refund', async () => {
  const result=await reconcilePayment('42',{db:database(order,{...order,status:'refunded'}),payment:{get:async()=>payment()}});
  assert.equal(result.status,'refunded');
});
test('webhook requires a current signature and matching query payment ID', () => {
  process.env.MP_WEBHOOK_SECRET='test-only-secret';
  const ts=String(Math.floor(Date.now()/1000)), requestId='request-123';
  const signature=crypto.createHmac('sha256',process.env.MP_WEBHOOK_SECRET).update(`id:42;request-id:${requestId};ts:${ts};`).digest('hex');
  const req=new Request('https://example.com/api/payments?view=webhook&data.id=42',{headers:{'x-request-id':requestId,'x-signature':`ts=${ts},v1=${signature}`}});
  assert.equal(verifyWebhook(req,{type:'payment',data:{id:42}}),'42');
  assert.throws(()=>verifyWebhook(req,{type:'payment',data:{id:43}}),{code:'INVALID_WEBHOOK'});
  const forged=new Request(req.url,{headers:{'x-request-id':requestId,'x-signature':`ts=${ts},v1=bad`}});
  assert.throws(()=>verifyWebhook(forged,{type:'payment',data:{id:42}}),{code:'INVALID_SIGNATURE'});
});
test('invalid or negative costs cannot influence paid calculations', () => {
  assert.equal(normalizeCosts({cost:'12.50'}).cost,12.5);
  for(const costs of [{cost:-1},{shipping:Infinity},{target:81},{packaging:'invalid'}]) assert.throws(()=>normalizeCosts(costs),{code:'INVALID_COSTS'});
});
test('authenticated requests without a paid order are denied before Mercado Livre calls', async () => {
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.match(String(url),/\/auth\/v1\/user/);
    return Response.json({id:'owner',email:'owner@example.com'});
  };
  try {
    const session=seal({access_token:'valid',refresh_token:'refresh',expires_at:Date.now()/1000+3600});
    const response=await analyze(new Request('https://example.com/api/analysis/listing',{method:'POST',headers:{origin:'https://example.com',cookie:'miq_account='+encodeURIComponent(session)},body:JSON.stringify({ref:'MLB12345678'})}));
    assert.equal(response.status,402); assert.equal((await response.json()).code,'PAYMENT_REQUIRED');
  } finally {globalThis.fetch=oldFetch;}
});

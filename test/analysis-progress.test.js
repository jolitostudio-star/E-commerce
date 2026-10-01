import test from 'node:test';
import assert from 'node:assert/strict';
import { streamPreview } from '../api/_analysis-progress.js';

const report = {listing:{id:'MLB12345678',title:'Produto'},title:{score:90},content:{pictures:3},strategy:{private:'paid-only'},analyzedAt:1};
test('progress arrives before the report and exposes only the preview', async()=>{
  let finish;
  const response=streamPreview('token','MLB12345678',async(token,input,{onProgress})=>{
    onProgress({stage:'link',state:'running'});
    await new Promise(resolve=>{finish=resolve;});
    onProgress({stage:'link',state:'done'});
    return report;
  });
  const reader=response.body.getReader(), decoder=new TextDecoder();
  assert.deepEqual(JSON.parse(decoder.decode((await reader.read()).value)),{type:'progress',stage:'link',state:'running'});
  finish();
  let result='';
  while(true){const {value,done}=await reader.read();if(done)break;result+=decoder.decode(value);}
  const events=result.trim().split('\n').map(JSON.parse);
  assert.equal(events[0].state,'done'); assert.equal(events[1].type,'ready');
  assert.doesNotMatch(result,/paid-only|strategy/);
});
test('a failed analysis never emits ready or pretends to finish',async()=>{
  const response=streamPreview('token','MLB12345678',async(_token,_input,{onProgress})=>{
    onProgress({stage:'link',state:'running'});
    throw Object.assign(new Error('Anúncio não encontrado'),{status:404,code:'LISTING_NOT_FOUND'});
  });
  const events=(await response.text()).trim().split('\n').map(JSON.parse);
  assert.equal(events.at(-1).type,'error');assert.equal(events.at(-1).code,'LISTING_NOT_FOUND');
  assert.equal(events.some(event=>event.type==='ready'||event.state==='done'),false);
});
test('unexpected upstream errors do not expose server details',async()=>{
  const response=streamPreview('token','MLB12345678',async()=>{throw new Error('secret internal detail');});
  assert.doesNotMatch(await response.text(),/secret internal detail/);
});
test('real consultation cannot start without Mercado Livre connection',()=>{
  assert.throws(()=>streamPreview('','MLB12345678'),{code:'ML_NOT_CONNECTED'});
});

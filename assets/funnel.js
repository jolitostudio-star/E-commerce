const byId = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const money = value => value === null || value === undefined ? 'Não disponível' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const message = byId('previewMessage');
const payButton = byId('payButton');
const payMessage = byId('paymentMessage');
const query = new URLSearchParams(location.search);
let currentOrder = query.get('order');
let ref = null;
let accountId = null;
let previewReady = false;
let paymentsEnabled = false;
let requestKey = null;


async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível continuar. Tente novamente.'), { code: data.code, status: response.status });
  return data;
}
function actionLink(label, href) {
  const link = document.createElement('a');
  link.className = 'button secondary'; link.href = href; link.textContent = label;
  byId('previewActions').append(link);
}
function updatePaymentButton() {
  payButton.disabled = !previewReady || (Boolean(accountId) && !paymentsEnabled);
  payMessage.textContent = !accountId ? 'Crie sua conta gratuitamente na próxima etapa. Depois, conclua o pagamento no Mercado Pago.' : !paymentsEnabled ? 'Pagamento ainda em configuração. A prévia é gratuita e nenhuma cobrança será feita agora.' : !previewReady ? 'Veja a prévia antes de decidir pelo pagamento.' : 'Pagamento único. A análise é liberada após a confirmação do Mercado Pago.';
}
function showProduct(listing) {
  const result=byId('previewResult'); result.classList.remove('hidden'); result.replaceChildren();
  const product=document.createElement('div');product.className='demo-listing';
  if (/^https:\/\/(?:[\w-]+\.)?mlstatic\.com\//.test(listing.thumbnail || '')) {
    const image=document.createElement('img');image.src=listing.thumbnail;image.alt=listing.title;image.width=image.height=112;product.append(image);
  }
  const title=document.createElement('h2');title.textContent=listing.title;product.append(title);result.append(product);
}
function updateProgress(event) {
  const row = [...byId('analysisProgress').querySelectorAll('[data-stage]')].find(entry => entry.dataset.stage === event.stage);
  if (!row || !['running','done'].includes(event.state)) return;
  row.dataset.state = event.state;
  row.querySelector('.stage-icon').textContent = event.state === 'done' ? '✓' : '◌';
  row.querySelector('small').textContent = event.state === 'done' ? 'Consultado' : 'Em andamento';
}
async function analyzeWithProgress() {
  byId('analysisTitle').textContent = query.get('checkout') === '1' ? 'Retomando seu pagamento.' : 'Analisando seu anúncio.';
  if (query.get('checkout') !== '1') byId('analysisProgress').classList.remove('hidden');
  const response = await fetch('/api/analysis/listing', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action:'previa',progress:true,resume:query.get('checkout')==='1'}) });
  if (!response.ok) {
    const data = await response.json();
    throw Object.assign(new Error(data.error), {code:data.code});
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', preview = null;
  function consume(line) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'progress') updateProgress(event);
    if (event.type === 'listing') {message.textContent = 'Analisando: ' + event.listing.title;showProduct(event.listing);}
    if (event.type === 'ready') preview = event.preview;
    if (event.type === 'error') throw Object.assign(new Error(event.error), {code:event.code});
  }
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) {buffer += decoder.decode(); break;}
      buffer += decoder.decode(value,{stream:true});
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        consume(buffer.slice(0,newline)); buffer = buffer.slice(newline+1);
      }
    }
    consume(buffer);
    if (!preview) throw new Error('A consulta foi interrompida. Tente novamente.');
    return preview;
  } catch(error) { await reader.cancel().catch(()=>{}); throw error; }
  finally {reader.releaseLock();}
}
function renderPreview(data) {
  previewReady = true;
  byId('analysisTitle').textContent = 'Seu anúncio foi consultado.';
  byId('analysisProgress').classList.add('hidden');
  byId('paidOffer').classList.remove('hidden');
  byId('paidOffer').querySelector('details').classList.add('hidden');
  message.textContent = 'O relatório está preparado. O pagamento de R$ 1 libera as notas, os pontos de melhoria e as sugestões.';
  showProduct(data.listing);
  const result=byId('previewResult');
  const lock=document.createElement('p');lock.className='small';lock.textContent='✓ Produto identificado · Resultado completo reservado até a confirmação do pagamento.';result.append(lock);
  payButton.textContent=accountId?'Pagar com Mercado Pago →':'Liberar relatório por R$ 1 →';
  updatePaymentButton();
}
function renderFull(report) {
  showProduct(report.listing);
  byId('analysisTitle').textContent = 'Seu resultado está liberado.';
  byId('paidOffer').classList.add('hidden');
  byId('panelUpsell').classList.remove('hidden');
  byId('previewActions').replaceChildren();
  message.textContent = `Pagamento confirmado. Análise de ${report.listing.id} disponível.`;
  const target = byId('fullResult'); target.classList.remove('hidden');
  const strategy = report.strategy;
  const area = (title, content) => `<section class="result-card"><h3>${title}</h3>${content}</section>`;
  byId('fullContent').innerHTML = `<h2>${escapeHtml(report.listing.title)}</h2><p class="small">Consulta realizada em ${escapeHtml(new Date(report.analyzedAt).toLocaleString('pt-BR'))}. Reabrir este resultado não gera nova cobrança.</p>`
    + area('Comece por estas prioridades', (strategy.actions || []).slice(0,3).map((entry,i) => `<div class="finding"><span class="eyebrow">${i+1} · PRIORIDADE ${escapeHtml(entry.priority)}</span><h3>${escapeHtml(entry.text)}</h3><p>${escapeHtml(entry.why.replaceAll("no concorrente","no anúncio analisado"))}</p></div>`).join(''))
    + area('Título e conteúdo', `<p><strong>Título: ${escapeHtml(report.title.score)}/100</strong></p><ul>${report.title.checks.map(entry => `<li>${entry.ok ? '✓' : '↗'} ${escapeHtml(entry.label)}: ${escapeHtml(entry.detail)}</li>`).join('')}</ul><p>${escapeHtml(report.content.pictures)} foto(s) · ${report.content.hasVideo ? 'Vídeo informado' : 'Sem vídeo informado'}</p><p>Atributos a revisar: ${escapeHtml(report.content.attributes.missingImportant.join(', ') || 'Nenhum atributo importante ausente nos critérios avaliados.')}</p><p class="small">A quantidade de fotos não avalia sua qualidade visual.</p>`)
    + area('Preço e margem', `<p>Preço atual: <strong>${money(report.pricing.price)}</strong></p><p>Ofertas comparáveis: ${report.competitors.prices ? money(report.competitors.prices.min) + ' a ' + money(report.competitors.prices.max) : 'Dados indisponíveis nesta consulta.'}</p><p>Preço mínimo sem prejuízo: <strong>${money(report.pricing.minimumPrice)}</strong></p><p>Preço para a margem-alvo: <strong>${money(report.pricing.targetPrice)}</strong></p><p class="small">${report.store.cost ? 'Cálculo baseado nos custos informados e nas tarifas consultadas. Confira suas condições de frete.' : 'Você não informou custos; nenhum lucro ou preço com margem foi calculado.'}</p>`)
    + area('Reputação e diferenciação', `<p>Reputação: ${escapeHtml(report.seller?.level || 'Não disponível')}</p><p>Logística: ${escapeHtml(report.seller?.logistics || 'Não disponível')}</p><ul>${strategy.differentiation.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>`)
    + area('Ideias para revisar seu título', `<ul>${strategy.titleIdeas.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul><p class="small">Adapte as sugestões ao seu produto. Preencha os campos indicados e confirme os termos antes de publicar.</p>`)
    + area('Outras ações sugeridas', `<ul>${strategy.actions.slice(3).map(entry => `<li><strong>${escapeHtml(entry.text)}</strong> ${escapeHtml(entry.why)}</li>`).join('')}</ul>`);
}
async function loadFull(orderId) {
  const data = await api('/api/analysis/listing', { action: 'completo', orderId });
  renderFull(data);
}
async function checkOrder() {
  payButton.disabled = true;
  const url = new URL('/api/payments', location.origin);
  url.searchParams.set('order', currentOrder);
  const paymentId = query.get('payment_id') || query.get('collection_id');
  if (paymentId) url.searchParams.set('payment_id', paymentId);
  const status = await api(url.pathname + url.search);
  if (status.ready) { await loadFull(currentOrder); return true; }
  payMessage.textContent = ['refunded','charged_back'].includes(status.status) ? 'O pagamento foi devolvido ou contestado. Este resultado está bloqueado.' : status.status === 'rejected' || status.status === 'cancelled' ? 'O pagamento não foi aprovado. Confira o checkout antes de tentar novamente.' : 'Pagamento ainda não confirmado. Use “Consultar pagamento” para verificar novamente.';
  byId('previewActions').replaceChildren();
  const check = document.createElement('button');check.className = 'button secondary'; check.textContent = 'Consultar pagamento';
  check.onclick = async () => { check.disabled = true; try { await checkOrder(); } catch(error) { payMessage.textContent = error.message; } finally { check.disabled = false; } };
  byId('previewActions').append(check);
  return false;
}
async function loadHistory() {
  try {
    const { orders } = await api('/api/payments?view=history');
    byId('reportHistory').replaceChildren();
    for (const order of orders) {
      const link = document.createElement('a'); link.className = 'button secondary'; link.href = '/diagnostico?order=' + encodeURIComponent(order.id);
      link.textContent = 'Reabrir análise · ' + new Date(order.created_at).toLocaleDateString('pt-BR');
      byId('reportHistory').append(link);
    }
    if (!orders.length) byId('reportHistory').textContent = 'Você ainda não tem análises pagas.';
  } catch { byId('reportHistory').textContent = 'Não foi possível consultar o histórico agora.'; }
}
async function start() {
  try {
    const account=await api('/api/account').catch(error=>{if(error.code==='AUTH_REQUIRED')return null;throw error;});
    accountId=account?.user.id || null;
    const config=await api('/api/payments?view=config'); paymentsEnabled=config.enabled;
    if(accountId) await loadHistory(); else byId('reportHistory').closest('section').classList.add('hidden');
    if(currentOrder) {
      if(!accountId) {message.textContent='Entre na conta que comprou esta análise.';actionLink('Entrar para ver meu relatório →','/login?order='+encodeURIComponent(currentOrder));return;}
      byId('paidOffer').classList.remove('hidden');
      byId('analysisTitle').textContent='Confirmação do pagamento';
      await checkOrder();return;
    }
    const lead=await api('/api/account?view=lead');ref=lead.pendingListing;
    if(!ref) {
      if(accountId){location.replace(account.admin?'/app':'/analises');return;}
      byId('analysisTitle').textContent='Qual anúncio você quer analisar?';message.textContent='Cole um link de anúncio para começar.';actionLink('Informar anúncio →','/');return;
    }
    const data=await analyzeWithProgress();renderPreview(data);
    if(accountId){
      const attempt=sessionStorage.getItem('miq_attempt')||crypto.randomUUID();sessionStorage.setItem('miq_attempt',attempt);
      const key=accountId+':miq_checkout:'+ref+':'+attempt;
      requestKey=localStorage.getItem(key)||crypto.randomUUID();localStorage.setItem(key,requestKey);
      if(query.get('checkout')==='1' && paymentsEnabled) await checkout();
    }
  } catch(error) {
    byId('paidOffer').classList.add('hidden');
    byId('analysisTitle').textContent='Não foi possível concluir a consulta.';
    message.textContent=error.message;
    for(const row of byId('analysisProgress').querySelectorAll('[data-state="running"]')){row.dataset.state='paused';row.querySelector('small').textContent='Interrompido';}
    actionLink('Informar outro anúncio →','/');
  }
}
async function checkout() {
  payButton.disabled = true; payMessage.textContent = 'Preparando sua análise e o checkout de R$ 1…';
  try {
    const data = await api('/api/payments', { requestKey, store: { cost: byId('cost')?.value || 0, packaging: byId('packaging')?.value || 0, shipping: byId('shipping')?.value || 0, target: byId('target')?.value || 20 } });
    currentOrder = data.order;
    if (data.ready) { await loadFull(data.order); return; }
    // Only a Mercado Pago HTTPS checkout returned by the server is accepted.
    if (!/^https:\/\/(?:[\w-]+\.)?mercadopago\.com(?:\.br)?\//.test(data.checkoutUrl || '')) throw new Error('O checkout não está disponível.');
    history.replaceState(null, '', '/diagnostico?order=' + encodeURIComponent(data.order));
    location.assign(data.checkoutUrl);
  } catch (error) { payMessage.textContent = error.message; payButton.disabled = !paymentsEnabled || !previewReady; }
}
payButton.addEventListener('click', () => {
  if(!accountId){location.assign('/login?next=diagnostico&checkout=1');return;}
  checkout();
});
start();

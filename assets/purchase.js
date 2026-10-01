/* ============================================================
   MargemIQ — "Vale a pena comprar?"
   Pensada para o celular, na loja do fornecedor: nome ou código de barras + preço de compra → veredito.
   Usa os utilitários globais do index.html ($, esc, brl, toast, icon, state, persist, renderAll, targetMargin, VIEWS).
   ============================================================ */
(function(){
  const HISTORY_KEY = 'margemIQ_purchase_history';
  const PREFILL_KEY = 'margemiq_purchase_prefill_v1';
  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/umd/zxing-browser.min.js';
  const SIZES = [
    { key:'pequeno', label:'Pequeno', detail:'até 20×15×10 cm · 300 g', packaging:1.5 },
    { key:'medio', label:'Médio', detail:'até 30×20×15 cm · 1 kg', packaging:3 },
    { key:'grande', label:'Grande', detail:'até 40×30×25 cm · 3 kg', packaging:6 }
  ];
  const VERDICT_STYLE = {
    compensa: { color:'var(--emerald)', bg:'rgba(61,220,151,.08)', icon:'check' },
    arriscado: { color:'var(--amber)', bg:'rgba(255,178,36,.08)', icon:'alert' },
    nao_compensa: { color:'var(--rose)', bg:'rgba(255,93,115,.08)', icon:'x' },
    incompleto: { color:'var(--amber)', bg:'rgba(255,178,36,.08)', icon:'alert' }
  };
  const SHIPPING_SOURCE = {
    comprador_paga: 'o comprador paga (venda abaixo de R$ 79)',
    informado: 'valor informado por você',
    mercado_livre_shipping_options: 'cotação oficial do Mercado Livre',
    indisponivel: 'não foi possível cotar'
  };
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem((window.accountId || 'guest') + ':' + key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem((window.accountId || 'guest') + ':' + key, JSON.stringify(value)); } catch {} };
  const money = value => value === null || value === undefined ? '—' : brl(value);
  const pct = value => value === null || value === undefined ? '—' : fmtPct1(value * 100);
  const safeUrl = url => typeof url === 'string' && /^https:\/\/[\w.-]*mercadoli[bv]re\.com(\.br)?\//.test(url) ? url : null;
  let size = 'pequeno';
  let last = null;

  function renderShell(){
    $('#viewPurchase').innerHTML = `
      <div class="card p-5 max-w-[760px] mx-auto w-full">
        <h2 class="font-display font-semibold text-[18px]">Vale a pena comprar?</h2>
        <p class="text-[12.5px] text-[var(--muted)] mt-1">Na loja do fornecedor: digite o produto ou leia o código de barras, informe quanto vai pagar por unidade e veja se a revenda no Mercado Livre compensa.</p>
        <div id="pcPrefill" class="mt-3 rounded-xl px-3 py-2 text-[12px]" style="background:var(--volt-dim);color:var(--volt)" hidden></div>
        <label class="fld mt-5"><label>Produto</label>
          <div class="flex gap-2">
            <input id="pcQuery" class="inp !h-12 flex-1" placeholder="Ex.: máquina de cortar cabelo dragão" autocomplete="off" enterkeyhint="search">
            <button class="btn btn-ghost !h-12 !px-3.5" id="pcPhoto" type="button" title="Identificar pela foto" data-integration="vision" hidden>${icon('camera','w-5 h-5')}<span class="hidden sm:inline">Foto</span></button>
            <input id="pcPhotoInput" type="file" accept="image/*" capture="environment" hidden>
            <button class="btn btn-ghost !h-12 !px-3.5" id="pcScan" type="button" title="Ler código de barras">${icon('scan','w-5 h-5')}<span class="hidden sm:inline">Código de barras</span></button>
          </div>
          <div id="pcPhotoNote" class="text-[12px] mt-2" hidden></div>
        </label>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <label class="fld"><label>Preço por unidade (R$)</label><input id="pcCost" class="inp !h-12" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00"></label>
          <label class="fld"><label>Quantidade</label><input id="pcQty" class="inp !h-12" type="number" inputmode="numeric" min="1" step="1" value="10"></label>
          <label class="fld col-span-2"><label>Preço de venda no Mercado Livre (R$) <span class="font-normal text-[var(--faint)]">— opcional</span></label><input id="pcSale" class="inp !h-12" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Automático: preço do catálogo do Mercado Livre"></label>
        </div>
        <div class="fld mt-3"><label>Tamanho da caixa para envio</label>
          <div class="grid grid-cols-3 gap-2" id="pcSizes">${SIZES.map(s => `
            <button type="button" class="rounded-xl border px-2 py-2.5 text-left transition" data-size="${s.key}">
              <div class="text-[13px] font-semibold">${s.label}</div><div class="text-[10.5px] text-[var(--faint)] leading-tight mt-0.5">${s.detail}</div>
            </button>`).join('')}</div>
        </div>
        <details class="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <summary class="cursor-pointer text-[12.5px] font-semibold text-[var(--muted)]">Ajustes (embalagem, frete, imposto, meta)</summary>
          <div class="grid grid-cols-2 gap-3 mt-3">
            <label class="fld"><label>Tipo de anúncio</label><select id="pcListing" class="inp"><option value="gold_special">Clássico</option><option value="gold_pro">Premium</option></select></label>
            <label class="fld"><label>Margem-alvo (%)</label><input id="pcTarget" class="inp" type="number" inputmode="decimal" min="0" max="80" step="1"></label>
            <label class="fld"><label>Embalagem por unidade (R$)</label><input id="pcPack" class="inp" type="number" inputmode="decimal" min="0" step="0.01"></label>
            <label class="fld"><label>Imposto sobre a venda (%)</label><input id="pcTax" class="inp" type="number" inputmode="decimal" min="0" max="50" step="0.1" placeholder="0"></label>
            <label class="fld col-span-2"><label>Frete grátis por venda (R$) — deixe vazio para cotar no Mercado Livre</label><input id="pcShip" class="inp" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Cotação automática"></label>
          </div>
        </details>
        <button class="btn btn-primary w-full !h-12 mt-4 text-[14.5px]" id="pcRun">${icon('sparkles','w-4 h-4')}Analisar compra</button>
        <div id="pcHistory" class="flex flex-wrap gap-2 mt-3"></div>
      </div>
      <div id="pcResult" class="max-w-[760px] mx-auto w-full"></div>`;
    $('#pcTarget').value = Math.round(targetMargin * 100);
    $$('#pcSizes [data-size]').forEach(button => button.addEventListener('click', () => selectSize(button.dataset.size)));
    selectSize(size);
    $('#pcRun').addEventListener('click', run);
    $('#pcQuery').addEventListener('keydown', event => { if(event.key === 'Enter') $('#pcCost').focus(); });
    $('#pcCost').addEventListener('keydown', event => { if(event.key === 'Enter') run(); });
    $('#pcScan').addEventListener('click', scanBarcode);
    $('#pcPhoto').addEventListener('click', () => $('#pcPhotoInput').click());
    $('#pcPhotoInput').addEventListener('change', event => { const file = event.target.files?.[0]; event.target.value = ''; if(file) identifyPhoto(file); });
    $('#pcQuery').addEventListener('input', () => { $('#pcPhotoNote').hidden = true; });
    revealIntegrations($('#viewPurchase'));
    renderHistory();
    consumePrefill();
  }

  function consumePrefill(){
    let data = null;
    try{ data = JSON.parse(sessionStorage.getItem(PREFILL_KEY) || 'null'); sessionStorage.removeItem(PREFILL_KEY); }catch{}
    if(!data || !data.product || !(Number(data.cost) > 0)) return;
    $('#pcQuery').value = data.product;
    $('#pcCost').value = Number(data.cost).toFixed(2);
    $('#pcQty').value = Math.max(1,Number(data.quantity) || 1);
    $('#pcSale').value = Number(data.salePrice) > 0 ? Number(data.salePrice).toFixed(2) : '';
    $('#pcPack').value = Number(data.packaging) >= 0 ? Number(data.packaging).toFixed(2) : $('#pcPack').value;
    $('#pcShip').value = Number(data.shippingSale) > 0 ? Number(data.shippingSale).toFixed(2) : '';
    $('#pcTax').value = Number(data.taxPercent) > 0 ? Number(data.taxPercent) : '0';
    const note = $('#pcPrefill');
    note.hidden = false;
    note.textContent = `Cotação de ${data.supplierName || 'fornecedor'} carregada. O custo já inclui o frete da compra rateado por unidade.`;
  }

  function selectSize(key){
    const previous = SIZES.find(s => s.key === size);
    size = key;
    const current = SIZES.find(s => s.key === key);
    // A embalagem acompanha o tamanho, a menos que o usuário tenha digitado outro valor.
    if(!$('#pcPack').value || Number($('#pcPack').value) === previous.packaging) $('#pcPack').value = current.packaging.toFixed(2);
    $$('#pcSizes [data-size]').forEach(button => {
      const on = button.dataset.size === key;
      button.style.borderColor = on ? 'rgba(216,255,62,.55)' : 'var(--border)';
      button.style.background = on ? 'var(--volt-dim)' : 'var(--surface-2)';
    });
  }

  function renderHistory(){
    const history = read(HISTORY_KEY, []);
    $('#pcHistory').innerHTML = history.map((entry, index) => {
      const style = VERDICT_STYLE[entry.verdict] || VERDICT_STYLE.incompleto;
      return `<button class="chip" data-history="${index}" title="Refazer esta análise"><i class="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style="background:${style.color}"></i>${esc(entry.label)} · ${brl(entry.cost)}</button>`;
    }).join('');
    $$('#pcHistory [data-history]').forEach(button => button.addEventListener('click', () => {
      const entry = read(HISTORY_KEY, [])[Number(button.dataset.history)];
      if(!entry) return;
      $('#pcQuery').value = entry.query; $('#pcCost').value = entry.cost; $('#pcQty').value = entry.quantity || 1; $('#pcSale').value = entry.salePrice || '';
      selectSize(entry.size || 'pequeno');
      run();
    }));
  }

  function remember(data, query){
    const entry = { query, label: query.length > 28 ? query.slice(0, 27) + '…' : query, cost: data.inputs.cost, quantity: data.inputs.quantity, size: data.inputs.size, salePrice: data.inputs.salePrice, verdict: data.verdict.key };
    write(HISTORY_KEY, [entry, ...read(HISTORY_KEY, []).filter(item => item.query.toLowerCase() !== query.toLowerCase())].slice(0, 8));
    renderHistory();
  }

  async function run(){
    const query = $('#pcQuery').value.trim();
    if(query.length < 3){ $('#pcQuery').classList.add('err'); setTimeout(() => $('#pcQuery').classList.remove('err'), 600); $('#pcQuery').focus(); return; }
    if(!(Number($('#pcCost').value) > 0)){ $('#pcCost').classList.add('err'); setTimeout(() => $('#pcCost').classList.remove('err'), 600); $('#pcCost').focus(); return; }
    const button = $('#pcRun');
    button.disabled = true; button.innerHTML = `${icon('refresh','w-4 h-4 animate-spin')}Consultando o Mercado Livre…`;
    $('#pcResult').innerHTML = '<div class="grid gap-4 mt-5"><div class="skel h-[150px]"></div><div class="skel h-[220px]"></div></div>';
    try{
      const response = await fetch('/api/market/research', {
        method:'POST',
        headers:{ 'content-type':'application/json', accept:'application/json' },
        body: JSON.stringify({
          query, cost: $('#pcCost').value, quantity: $('#pcQty').value, salePrice: $('#pcSale').value, size,
          packaging: $('#pcPack').value, shipping: $('#pcShip').value, tax: $('#pcTax').value,
          target: $('#pcTarget').value, listingType: $('#pcListing').value
        })
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível analisar agora.'), { status: response.status, code: data.code });
      last = data;
      renderResult(data);
      remember(data, query);
      $('#pcResult').scrollIntoView({ behavior:'smooth', block:'start' });
    }catch(error){
      const reconnect = error.status === 401 || /NOT_CONNECTED|EXPIRED/.test(error.code || '');
      $('#pcResult').innerHTML = `<div class="card p-6 mt-5 text-center"><div class="font-semibold" style="color:var(--rose)">${esc(error.message)}</div>
        ${reconnect ? '<a href="/conectar/mercadolivre" class="btn btn-primary sm mt-4 inline-flex">Conectar Mercado Livre</a>' : ''}</div>`;
    }finally{
      button.disabled = false; button.innerHTML = `${icon('sparkles','w-4 h-4')}Analisar compra`;
    }
  }

  // Uma linha da conta por unidade, com uma coluna por cenário (seu preço, mercado, competitivo).
  function line(label, cells, strong){
    return `<tr><td class="${strong ? 'font-semibold' : 'text-[var(--muted)]'}">${label}</td>${cells.map(cell => `<td class="text-right pl-3 whitespace-nowrap ${strong ? 'font-bold' : ''}">${cell}</td>`).join('')}</tr>`;
  }
  const minus = value => value ? '− ' + brl(value) : brl(0);
  const profitCell = scenario => scenario.profit === null ? '—' : `<span class="${scenario.profit >= 0 ? 't-pos' : 't-neg'}">${brl(scenario.profit)}</span><div class="text-[11px] font-semibold text-[var(--faint)]">${pct(scenario.margin)}</div>`;

  function renderResult(d){
    const style = VERDICT_STYLE[d.verdict.key] || VERDICT_STYLE.incompleto;
    const [market] = d.scenarios;
    const all = (render) => d.scenarios.map(render);
    const feeLabel = scenario => `Tarifa ML (${pct(scenario.fee.percentage)}${scenario.fee.fixed ? ' + ' + brl(scenario.fee.fixed) : ''})${scenario.fee.source === 'mercado_livre_listing_prices' ? '' : ' <span class="est">Estimativa</span>'}`;
    const shipCell = scenario => scenario.shipping.amount === null ? '<span class="t-warn">informe</span>' : minus(scenario.shipping.amount);
    $('#pcResult').innerHTML = `
      <div class="card p-5 mt-5" style="border-color:${style.color}; background:${style.bg}">
        <div class="flex items-start gap-3">
          <span class="grid place-items-center w-11 h-11 rounded-xl flex-none" style="background:${style.color}; color:#0B0D05">${icon(style.icon,'w-6 h-6')}</span>
          <div class="min-w-0">
            <div class="font-display font-bold text-[24px] leading-tight" style="color:${style.color}">${esc(d.verdict.label)}</div>
            <div class="text-[12.5px] text-[var(--muted)] mt-0.5 truncate">${esc(d.product.title)}${d.gtin ? ` · código ${esc(d.gtin)}` : ''}</div>
          </div>
        </div>
        ${d.product.matchedByBarcode ? `<div class="mt-3 rounded-lg px-3 py-2 text-[12px]" style="background:rgba(255,178,36,.1); color:#FFC966">Produto encontrado pelo código de barras: <b>${esc(d.product.title)}</b>. Confira se é o mesmo que está na sua mão — alguns vendedores cadastram o código errado.</div>` : ''}
        <ul class="mt-3 space-y-1.5 text-[13px]">${d.verdict.reasons.map(reason => `<li class="flex gap-2"><i class="mt-2 w-1.5 h-1.5 rounded-full flex-none" style="background:${style.color}"></i><span>${esc(reason)}</span></li>`).join('')}</ul>
      </div>

      <div class="grid grid-cols-2 gap-3 mt-3">
        <div class="card p-4"><div class="kpi-label">Lucro por unidade</div><div class="font-display font-bold text-[20px] mt-1 ${market.profit !== null && market.profit < 0 ? 't-neg' : 't-pos'}">${money(market.profit)}</div><div class="text-[11.5px] text-[var(--faint)]">vendendo a ${brl(market.price)}</div></div>
        <div class="card p-4"><div class="kpi-label">Margem</div><div class="font-display font-bold text-[20px] mt-1">${pct(market.margin)}</div><div class="text-[11.5px] text-[var(--faint)]">meta ${Math.round(d.inputs.target * 100)}%</div></div>
        <div class="card p-4"><div class="kpi-label">Pague no máximo</div><div class="font-display font-bold text-[20px] mt-1">${d.maxCost !== null && d.maxCost > 0 ? brl(d.maxCost) : '—'}</div><div class="text-[11.5px] text-[var(--faint)]">por unidade, para bater a meta</div></div>
        <div class="card p-4"><div class="kpi-label">Venda mínima sem prejuízo</div><div class="font-display font-bold text-[20px] mt-1">${money(d.minPrice)}</div><div class="text-[11.5px] text-[var(--faint)]">com meta: ${money(d.targetPrice)}</div></div>
      </div>

      <div class="card p-5 mt-3">
        <div class="section-title mb-3">Conta por unidade</div>
        <div class="overflow-x-auto"><table class="w-full text-[13px]">
          <thead><tr class="text-[11px] text-[var(--faint)] uppercase tracking-wider"><th class="text-left font-semibold pb-2"></th>${all(s => `<th class="text-right font-semibold pb-2 pl-3">${esc(s.short || s.label)}</th>`).join('')}</tr></thead>
          <tbody class="[&_td]:py-1.5">
            ${line('Preço de venda', all(s => brl(s.price)), true)}
            ${line(feeLabel(market), all(s => minus(s.fee.amount)))}
            ${line('Frete grátis (vendedor)', all(shipCell))}
            ${line('Embalagem', all(s => minus(s.packaging)))}
            ${d.inputs.tax ? line(`Imposto (${pct(d.inputs.tax)})`, all(s => minus(s.tax))) : ''}
            ${line('Preço de compra', all(s => minus(s.cost)))}
            ${line('Sobra por unidade', all(profitCell), true)}
          </tbody>
        </table></div>
        <p class="text-[11.5px] text-[var(--faint)] mt-3">Frete: ${esc(SHIPPING_SOURCE[market.shipping.source] || '')}. Caixa ${esc(d.inputs.sizeLabel)}, anúncio ${esc(d.inputs.listingTypeLabel)}.${d.priceSource === 'manual' ? ' A conta usa o preço de venda que você informou; “Mercado” é a mediana do catálogo, só como referência.' : ' “Competitivo” é o preço dos 25% mais baratos do catálogo.'}</p>
      </div>

      <div class="card p-5 mt-3">
        <div class="section-title mb-3">Compra de ${d.inputs.quantity} unidade(s)</div>
        <div class="grid grid-cols-2 gap-3 text-[13px]">
          <div><div class="text-[var(--muted)]">Dinheiro para comprar</div><div class="font-bold text-[17px] mt-0.5">${brl(d.totals.capital)}</div></div>
          <div><div class="text-[var(--muted)]">Lucro se vender tudo <span class="est">Estimativa</span></div><div class="font-bold text-[17px] mt-0.5 ${d.totals.profit !== null && d.totals.profit < 0 ? 't-neg' : 't-pos'}">${money(d.totals.profit)}</div></div>
        </div>
      </div>

      <div class="card p-5 mt-3">
        <div class="section-title mb-1">Preço no Mercado Livre</div>
        <div class="text-[12.5px] text-[var(--muted)] mb-3">${d.market ? `${d.market.sampleSize} oferta(s) comparáveis no catálogo · de ${brl(d.market.min)} a ${brl(d.market.max)}${d.market.ignored ? ` · ${d.market.ignored} ignorada(s) (kits, lotes, outros produtos ou preços fora da curva)` : ''}` : 'Nenhuma oferta comparável encontrada no catálogo.'}${d.trending ? ` · <span class="pill st-ok">Em alta</span>` : ''}</div>
        ${d.market && d.priceSource !== 'manual' ? '<div class="text-[11.5px] text-[var(--faint)] mb-3">Achou o preço diferente no Mercado Livre? Informe em “Preço de venda” e analise de novo.</div>' : ''}
        <div class="space-y-2">${d.offers.map(offer => {
          const url = safeUrl(offer.permalink);
          const title = url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="hover:underline">${esc(offer.title)}</a>` : esc(offer.title);
          return `<div class="flex items-center gap-3 text-[12.5px]"><span class="flex-1 min-w-0 truncate">${title}</span>${offer.shipFree ? '<span class="text-[10.5px] text-[var(--faint)]">frete grátis</span>' : ''}<b>${brl(offer.price)}</b></div>`;
        }).join('')}</div>
      </div>

      <div class="grid grid-cols-2 gap-3 mt-3 mb-6">
        <button class="btn btn-ghost !h-12" id="pcNew">${icon('refresh','w-4 h-4')}Nova análise</button>
        <button class="btn btn-primary !h-12" id="pcSave">${icon('plus','w-4 h-4')}Salvar como produto</button>
      </div>`;
    $('#pcNew').addEventListener('click', () => { $('#pcResult').innerHTML = ''; $('#pcQuery').value = ''; $('#pcCost').value = ''; $('#pcSale').value = ''; window.scrollTo({ top:0, behavior:'smooth' }); $('#pcQuery').focus(); });
    $('#pcSave').addEventListener('click', saveAsProduct);
  }

  // Leva o produto analisado para a lista de Produtos, já com custo, embalagem, frete e preço de mercado.
  function saveAsProduct(){
    if(!last) return;
    const market = last.scenarios[0];
    const name = (last.query || last.product.title).trim();
    state.products.unshift({
      id: 'p' + Date.now().toString(36), name: name.charAt(0).toUpperCase() + name.slice(1), category: 'Compra avaliada',
      sku: last.gtin || 'NEW-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      type: 'buy', buyCost: last.inputs.cost, materials: 0, labor: 0, overhead: 0, hours: 0,
      freight: market.shipping.amount || 0, packaging: last.inputs.packaging, stock: last.inputs.quantity,
      prices: { ml: market.price, shopee: null, tiktok: null, amazon: null }, ai: null
    });
    persist(); renderAll();
    toast('Produto salvo na sua lista de Produtos');
    $('#pcSave').disabled = true;
  }

  /* ---------- Foto do produto (identificação por IA) ---------- */
  // Fotos de celular têm 12 MP ou mais: reduz para no máximo 1600 px no lado maior, o bastante para ler a embalagem.
  async function shrinkPhoto(file){
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  async function identifyPhoto(file){
    const button = $('#pcPhoto'), note = $('#pcPhotoNote');
    button.disabled = true; button.innerHTML = `${icon('refresh','w-5 h-5 animate-spin')}<span class="hidden sm:inline">Analisando…</span>`;
    note.hidden = false; note.style.color = 'var(--muted)'; note.textContent = 'Identificando o produto pela foto…';
    try{
      const data = await shrinkPhoto(file);
      const response = await fetch('/api/market/research', {
        method:'POST', headers:{ 'content-type':'application/json', accept:'application/json' },
        body: JSON.stringify({ action:'identificar', image:{ mediaType:'image/jpeg', data } })
      });
      const result = await response.json().catch(() => ({}));
      if(!response.ok) throw new Error(result.error || 'Não foi possível analisar a foto agora.');
      if(!result.identified){
        note.style.color = 'var(--amber)';
        note.textContent = `Não reconheci o produto. ${result.note || 'Tente uma foto mais de perto, com boa luz.'}`;
        return;
      }
      $('#pcQuery').value = result.query;
      const label = { alta:'Alta confiança', media:'Confiança média', baixa:'Pouca certeza' }[result.confidence];
      note.style.color = result.confidence === 'baixa' ? 'var(--amber)' : 'var(--muted)';
      note.textContent = `${label}: ${result.name}${result.note ? ' — ' + result.note : ''}. Confira o texto acima antes de analisar.`;
      $('#pcCost').focus();
    }catch(error){
      note.style.color = 'var(--rose)';
      note.textContent = error.message;
    }finally{
      button.disabled = false; button.innerHTML = `${icon('camera','w-5 h-5')}<span class="hidden sm:inline">Foto</span>`;
    }
  }

  /* ---------- Código de barras pela câmera ---------- */
  function loadZxing(){
    if(window.ZXingBrowser) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = ZXING_URL; script.onload = resolve; script.onerror = () => reject(new Error('Não foi possível carregar o leitor de código de barras.'));
      document.head.appendChild(script);
    });
  }

  async function scanBarcode(){
    if(!navigator.mediaDevices?.getUserMedia){ toast('Este navegador não permite usar a câmera. Digite o nome do produto.', 'rose'); return; }
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 p-4';
    overlay.style.background = 'rgba(0,0,0,.92)';
    overlay.innerHTML = `
      <div class="text-[14px] font-semibold text-center">Aponte a câmera para o código de barras</div>
      <div class="relative w-full max-w-[420px] rounded-2xl overflow-hidden border border-[var(--border-2)]">
        <video class="w-full block" playsinline muted></video>
        <div class="absolute left-[8%] right-[8%] top-1/2 h-0.5" style="background:var(--volt); box-shadow:0 0 12px var(--volt)"></div>
      </div>
      <div class="text-[12px] text-[var(--muted)] text-center" data-status>Abrindo a câmera…</div>
      <button class="btn btn-ghost" data-close>Cancelar</button>`;
    document.body.appendChild(overlay);
    let controls = null;
    const close = () => { try { controls?.stop(); } catch {} overlay.remove(); };
    overlay.querySelector('[data-close]').addEventListener('click', close);
    try{
      await loadZxing();
      const reader = new window.ZXingBrowser.BrowserMultiFormatReader();
      controls = await reader.decodeFromConstraints({ video:{ facingMode:'environment' } }, overlay.querySelector('video'), (result, error, ctrl) => {
        if(!result) return;
        ctrl.stop(); overlay.remove();
        $('#pcQuery').value = result.getText();
        toast(`Código ${result.getText()} lido`);
        $('#pcCost').focus();
      });
      overlay.querySelector('[data-status]').textContent = 'Procurando código…';
    }catch(error){
      close();
      toast(error?.name === 'NotAllowedError' ? 'Permita o uso da câmera para ler o código de barras.' : (error?.message || 'Não foi possível abrir a câmera.'), 'rose');
    }
  }

  VIEWS.compra.open = function(){ if(!$('#pcRun')) renderShell(); else consumePrefill(); };
})();

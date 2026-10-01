(function(){
  const view = document.getElementById('viewSuppliers');
  if(!view || typeof VIEWS === 'undefined') return;

  const FAVORITES_KEY = 'margemiq_supplier_favorites_v1';
  const QUOTES_KEY = 'margemiq_supplier_quotes_v1';
  const PURCHASE_PREFILL_KEY = 'margemiq_purchase_prefill_v1';
  const PAGE_SIZE = 24;
  const catalog = { rows:[], filtered:[], query:'', segment:'all', status:'all', page:1, favorites:new Set(), quotes:[], quoteSupplier:null };

  try{
    const saved = JSON.parse(localStorage.getItem((window.accountId || 'guest') + ':' + FAVORITES_KEY) || '[]');
    if(Array.isArray(saved)) catalog.favorites = new Set(saved.map(Number));
  }catch{}
  try{
    const savedQuotes = JSON.parse(localStorage.getItem((window.accountId || 'guest') + ':' + QUOTES_KEY) || '[]');
    if(Array.isArray(savedQuotes)) catalog.quotes = savedQuotes;
  }catch{}

  const clean = value => String(value ?? '').trim();
  const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const safeHttp = value => {
    try{ const url = new URL(clean(value)); return /^https?:$/.test(url.protocol) ? url.href : ''; }catch{ return ''; }
  };
  const initials = name => clean(name).split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase();
  const official = row => Boolean(safeHttp(row.url) || safeHttp(row.catalogUrl));
  const uncertain = row => clean(row.status) === 'Leitura incerta';
  const unidentified = row => clean(row.status) === 'Não identificado';
  const hasContact = row => Boolean(safeHttp(row.url) || safeHttp(row.catalogUrl) || clean(row.phone) || clean(row.email) || clean(row.contact));
  const phoneHref = phone => {
    const value = clean(phone);
    const whatsapp = value.match(/whats?app[^\d]*(?:\+?55\D*)?(\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})/i);
    const firstPhone = value.match(/(?:\+?55\D*)?(\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})/);
    const digits = clean(whatsapp?.[1] || firstPhone?.[1]).replace(/\D/g,'');
    if(!/^\d{10,11}$/.test(digits)) return '';
    return `https://wa.me/55${digits}`;
  };
  const statusInfo = row => official(row)
    ? { label:'Canal confirmado', cls:'st-ok' }
    : uncertain(row)
      ? { label:'Nome a conferir', cls:'st-amber' }
      : unidentified(row)
        ? { label:'Não identificado', cls:'st-rose' }
        : { label:'Dados pendentes', cls:'st-muted' };

  function saveFavorites(){
    try{ localStorage.setItem((window.accountId || 'guest') + ':' + FAVORITES_KEY, JSON.stringify([...catalog.favorites])); }catch{}
  }
  function saveQuotes(){
    try{ localStorage.setItem((window.accountId || 'guest') + ':' + QUOTES_KEY, JSON.stringify(catalog.quotes)); }catch{}
  }

  function shell(){
    view.innerHTML = `
      <section class="card overflow-hidden">
        <div class="p-5 sm:p-6 border-b border-[var(--border)] flex flex-wrap items-start gap-4">
          <div class="flex-1 min-w-[240px]">
            <div class="text-[10.5px] uppercase tracking-[.15em] font-bold" style="color:var(--volt)">Base própria de compras</div>
            <h1 class="font-display text-xl sm:text-2xl font-bold mt-1">Catálogo de fornecedores</h1>
            <p class="text-[12.5px] text-[var(--muted)] mt-2 max-w-2xl leading-relaxed">Encontre marcas, canais oficiais e contatos para cotação. Confirme pedido mínimo, preço e condições comerciais diretamente com o fornecedor antes de comprar.</p>
          </div>
          <div class="text-right">
            <div class="text-[10px] uppercase tracking-[.12em] text-[var(--faint)] font-bold">Atualizado em</div>
            <div class="text-[13px] font-semibold mt-1" id="supplierUpdatedAt">29/09/2026</div>
          </div>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border)]" id="supplierStats"></div>
      </section>

      <section class="card" id="supplierQuotesSec">
        <div class="p-5 border-b border-[var(--border)] flex flex-wrap items-center gap-3">
          <div class="flex-1 min-w-[230px]">
            <h2 class="font-display font-semibold text-[15.5px]">Comparador de cotações</h2>
            <p class="text-[12px] text-[var(--muted)] mt-1">Compare o custo final do mesmo produto em fornecedores diferentes.</p>
          </div>
          <span class="count-pill" id="quoteCount">0 cotações</span>
        </div>
        <div id="quoteBoard"></div>
      </section>

      <section class="card">
        <div class="p-4 sm:p-5 border-b border-[var(--border)] space-y-3">
          <div class="flex flex-col lg:flex-row gap-3">
            <div class="relative flex-1">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]">${icon('search','w-4 h-4')}</span>
              <input id="supplierSearch" class="inp !pl-9" placeholder="Buscar marca, segmento, telefone ou e-mail…" autocomplete="off">
            </div>
            <select id="supplierSegment" class="inp lg:!w-[250px]" aria-label="Filtrar por segmento"></select>
            <select id="supplierStatus" class="inp lg:!w-[210px]" aria-label="Filtrar por situação">
              <option value="all">Todas as situações</option>
              <option value="store">Com loja online</option>
              <option value="catalog">Com catálogo</option>
              <option value="new">Novos fornecedores</option>
              <option value="favorites">Meus favoritos</option>
            </select>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--muted)]">
            <span id="supplierResultCount">Carregando catálogo…</span>
            <span class="hidden sm:inline">·</span>
            <span>A lista mantém apenas fornecedores com loja, catálogo ou vitrine de produtos identificada.</span>
          </div>
        </div>
        <div id="supplierGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4 sm:p-5"></div>
        <div id="supplierPager" class="px-5 py-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3"></div>
      </section>

      <div class="modal" id="quoteModal" aria-hidden="true">
        <div class="modal-ov" data-qclose></div>
        <div class="modal-panel max-w-2xl">
          <div class="flex items-start justify-between gap-3">
            <div><h3 class="font-display font-bold text-[17px]">Nova cotação</h3><p class="text-[12px] text-[var(--muted)] mt-1" id="quoteSupplierName"></p></div>
            <button class="icon-btn" data-qclose aria-label="Fechar">${icon('x','w-4 h-4')}</button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <label class="fld sm:col-span-2"><label>Produto</label><input id="qProduct" class="inp" placeholder="Ex.: Organizador plástico 30 litros"></label>
            <label class="fld"><label>Preço por unidade (R$)</label><input id="qUnit" class="inp" type="number" min="0" step="0.01" inputmode="decimal"></label>
            <label class="fld"><label>Quantidade</label><input id="qQty" class="inp" type="number" min="1" step="1" value="10" inputmode="numeric"></label>
            <label class="fld"><label>Frete total da compra (R$)</label><input id="qFreight" class="inp" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label>
            <label class="fld"><label>Preço de venda esperado (R$)</label><input id="qSale" class="inp" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Opcional"></label>
            <label class="fld"><label>Comissão do marketplace (%)</label><input id="qFee" class="inp" type="number" min="0" max="50" step="0.1" inputmode="decimal"></label>
            <label class="fld"><label>Imposto sobre a venda (%)</label><input id="qTax" class="inp" type="number" min="0" max="50" step="0.1" value="0" inputmode="decimal"></label>
            <label class="fld"><label>Frete pago por venda (R$)</label><input id="qShipSale" class="inp" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label>
            <label class="fld"><label>Embalagem por unidade (R$)</label><input id="qPack" class="inp" type="number" min="0" step="0.01" value="1.50" inputmode="decimal"></label>
            <label class="fld"><label>Pedido mínimo</label><input id="qMinimum" class="inp" placeholder="Ex.: R$ 500 ou 20 unidades"></label>
            <label class="fld"><label>Prazo estimado (dias)</label><input id="qLead" class="inp" type="number" min="0" step="1" inputmode="numeric" placeholder="Opcional"></label>
            <label class="fld sm:col-span-2"><label>Observações</label><textarea id="qNotes" class="inp min-h-[76px] resize-y" placeholder="Forma de pagamento, validade da proposta, contato…"></textarea></label>
          </div>
          <div class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 mt-4 text-[11.5px] text-[var(--muted)]">A margem do comparador considera comissão, imposto, frete da venda e embalagem informados. A análise final no Mercado Livre consulta tarifas e preços atuais.</div>
          <div class="flex justify-end gap-2 mt-5"><button class="btn btn-ghost" data-qclose>Cancelar</button><button class="btn btn-primary" id="qSave">${icon('check','w-4 h-4')}Salvar cotação</button></div>
        </div>
      </div>`;
  }

  function renderStats(){
    const total = catalog.rows.length;
    const confirmed = catalog.rows.filter(official).length;
    const contacts = catalog.rows.filter(hasContact).length;
    const segments = new Set(catalog.rows.map(row => clean(row.segment)).filter(Boolean)).size;
    document.getElementById('supplierStats').innerHTML = [
      ['Fornecedores', total, 'com canal de produtos'],
      ['Canais confirmados', confirmed, 'loja ou catálogo'],
      ['Com contato', contacts, 'canal comercial identificado'],
      ['Segmentos', segments, 'categorias no catálogo']
    ].map(([label,value,sub]) => `<div class="bg-[var(--surface)] p-4 sm:p-5"><div class="kpi-label">${label}</div><div class="font-display font-bold text-2xl mt-1" style="color:var(--volt)">${value}</div><div class="text-[11px] text-[var(--faint)] mt-1">${sub}</div></div>`).join('');
  }

  function defaultFee(){
    const ml = state?.marketplaces?.find(item => item.id === 'ml');
    return Number(ml?.fee || 12);
  }

  function renderQuotes(){
    const board = document.getElementById('quoteBoard');
    if(!board) return;
    document.getElementById('quoteCount').textContent = `${catalog.quotes.length} cotaç${catalog.quotes.length === 1 ? 'ão' : 'ões'}`;
    if(!catalog.quotes.length){
      board.innerHTML = `<div class="p-8 sm:p-10 text-center"><div class="font-semibold">Nenhuma cotação salva</div><p class="text-[12px] text-[var(--muted)] mt-1">Clique em “Nova cotação” no fornecedor para começar a comparar.</p></div>`;
      return;
    }
    const rows = MargemIQQuotes.ranked(catalog.quotes);
    board.innerHTML = `<div class="overflow-x-auto"><table class="tbl w-full min-w-[950px]"><thead><tr><th>Produto e fornecedor</th><th>Custo unitário</th><th>Frete/un.</th><th>Custo final</th><th>Investimento</th><th>Lucro/un.</th><th>Margem</th><th class="!text-right">Ações</th></tr></thead><tbody>${rows.map(row => {
      const q=row.quote;
      return `<tr class="!cursor-default" data-quote-id="${esc(q.id)}"><td><div class="font-semibold">${esc(q.product)}</div><div class="text-[11px] text-[var(--muted)] mt-1">${esc(q.supplierName)}${q.leadDays ? ` · ${q.leadDays} dias` : ''}</div></td>
        <td>${brl(q.unitPrice)}</td><td>${brl(row.freightUnit)}</td><td><b>${brl(row.landedCost)}</b>${row.bestCost ? '<div class="tag tag-em mt-1">Melhor custo</div>' : ''}</td>
        <td>${brl(row.investment)}</td><td class="${row.profit !== null && row.profit < 0 ? 't-neg' : row.profit !== null ? 't-pos' : 'text-[var(--faint)]'}">${row.profit === null ? 'Informe a venda' : brl(row.profit)}</td>
        <td><b>${row.margin === null ? '—' : fmtPct1(row.margin*100)}</b>${row.bestMargin ? '<div class="tag tag-em mt-1">Melhor margem</div>' : ''}</td>
        <td><div class="flex justify-end gap-2"><button class="btn btn-primary sm" data-analyze-quote>Analisar no ML</button><button class="btn btn-danger-soft sm" data-delete-quote>Excluir</button></div></td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="px-5 py-3 border-t border-[var(--border)] text-[11px] text-[var(--faint)]">Compare fornecedores usando o mesmo nome de produto. O custo final soma preço unitário e frete da compra rateado.</div>`;
  }

  function openQuote(row){
    catalog.quoteSupplier = row;
    $('#quoteSupplierName').textContent = `${row.brand} · ${row.segment || 'segmento a confirmar'}`;
    ['qProduct','qUnit','qSale','qMinimum','qLead','qNotes'].forEach(id => { $('#'+id).value=''; });
    $('#qQty').value='10'; $('#qFreight').value='0'; $('#qTax').value='0'; $('#qShipSale').value='0'; $('#qPack').value='1.50'; $('#qFee').value=defaultFee();
    if(row.minimum && !/^a (confirmar|consultar)$/i.test(clean(row.minimum))) $('#qMinimum').value=row.minimum;
    openModal($('#quoteModal')); setTimeout(() => $('#qProduct').focus(),100);
  }

  function closeQuote(){ closeModal($('#quoteModal')); catalog.quoteSupplier=null; }

  function saveQuote(){
    const supplier=catalog.quoteSupplier;
    if(!supplier) return;
    try{
      const quote=MargemIQQuotes.normalize({
        id:'q'+Date.now().toString(36), supplierId:supplier.id, supplierName:supplier.brand,
        product:$('#qProduct').value, unitPrice:$('#qUnit').value, quantity:$('#qQty').value,
        freightTotal:$('#qFreight').value, salePrice:$('#qSale').value, feePercent:$('#qFee').value,
        taxPercent:$('#qTax').value, shippingSale:$('#qShipSale').value, packaging:$('#qPack').value,
        minimumOrder:$('#qMinimum').value, leadDays:$('#qLead').value, notes:$('#qNotes').value
      });
      catalog.quotes.unshift(quote); saveQuotes(); renderQuotes(); closeQuote();
      toast('Cotação salva no comparador'); $('#supplierQuotesSec').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(error){ toast(error.message,'rose'); }
  }

  function analyzeQuote(id){
    const quote=catalog.quotes.find(item => item.id===id);
    if(!quote) return;
    const result=MargemIQQuotes.metrics(quote);
    sessionStorage.setItem(PURCHASE_PREFILL_KEY,JSON.stringify({
      product:quote.product, supplierName:quote.supplierName, cost:result.landedCost, quantity:quote.quantity,
      salePrice:quote.salePrice, packaging:quote.packaging, shippingSale:quote.shippingSale, taxPercent:quote.taxPercent
    }));
    document.querySelector('#mainNav [data-nav="compra"]')?.click();
  }

  function populateSegments(){
    const select = document.getElementById('supplierSegment');
    const counts = new Map();
    catalog.rows.forEach(row => { const value=clean(row.segment)||'Sem segmento'; counts.set(value,(counts.get(value)||0)+1); });
    const options = [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],'pt-BR'));
    select.innerHTML = `<option value="all">Todos os segmentos</option>` + options.map(([name,count]) => `<option value="${esc(name)}">${esc(name)} (${count})</option>`).join('');
  }

  function applyFilters(){
    const q = key(catalog.query);
    catalog.filtered = catalog.rows.filter(row => {
      if(catalog.segment !== 'all' && clean(row.segment) !== catalog.segment) return false;
      if(catalog.status === 'store' && !safeHttp(row.url)) return false;
      if(catalog.status === 'catalog' && !safeHttp(row.catalogUrl)) return false;
      if(catalog.status === 'new' && !/^novo/i.test(clean(row.origin))) return false;
      if(catalog.status === 'favorites' && !catalog.favorites.has(Number(row.id))) return false;
      if(q){
        const haystack = key([row.brand,row.type,row.segment,row.location,row.status,row.phone,row.email,row.contact,row.b2b,row.origin].join(' '));
        if(!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a,b) => {
      const fav = Number(catalog.favorites.has(Number(b.id))) - Number(catalog.favorites.has(Number(a.id)));
      if(fav) return fav;
      const conf = Number(official(b)) - Number(official(a));
      if(conf) return conf;
      return clean(a.brand).localeCompare(clean(b.brand),'pt-BR');
    });
    const lastPage = Math.max(1, Math.ceil(catalog.filtered.length/PAGE_SIZE));
    catalog.page = Math.min(catalog.page,lastPage);
    renderRows();
  }

  function supplierCard(row){
    const info = statusInfo(row);
    const url = safeHttp(row.url);
    const catalogUrl = safeHttp(row.catalogUrl);
    const whatsapp = phoneHref(row.phone);
    const email = clean(row.email);
    const favorite = catalog.favorites.has(Number(row.id));
    const hue = hueOf(clean(row.brand));
    const actions = [
      `<button class="btn btn-primary sm flex-1" data-new-quote>${icon('plus','w-4 h-4')}Nova cotação</button>`,
      url ? `<a class="btn btn-ghost sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Loja online</a>` : '',
      catalogUrl ? `<a class="btn btn-ghost sm" href="${esc(catalogUrl)}" target="_blank" rel="noopener noreferrer">Catálogo</a>` : '',
      whatsapp ? `<a class="btn btn-ghost sm" href="${esc(whatsapp)}" target="_blank" rel="noopener noreferrer" title="Conversar pelo WhatsApp">WhatsApp</a>` : '',
      email ? `<a class="btn btn-ghost sm" href="mailto:${esc(email)}" title="Enviar e-mail">E-mail</a>` : ''
    ].filter(Boolean).join('');
    return `<article class="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-4 flex flex-col min-h-[245px]" data-supplier-id="${Number(row.id)}">
      <div class="flex items-start gap-3">
        <div class="p-avatar !w-11 !h-11" style="color:hsl(${hue},85%,72%);background:hsla(${hue},60%,45%,.18);border:1px solid hsla(${hue},60%,55%,.35)">${esc(initials(row.brand)||'?')}</div>
        <div class="min-w-0 flex-1">
          <h2 class="font-display font-semibold text-[14px] leading-snug break-words">${esc(row.brand)}</h2>
          <p class="text-[11.5px] text-[var(--muted)] mt-1 line-clamp-2">${esc(row.segment || 'Segmento a confirmar')}</p>
        </div>
        <button class="icon-btn !w-9 !h-9" data-favorite title="${favorite?'Remover dos favoritos':'Adicionar aos favoritos'}" aria-label="${favorite?'Remover dos favoritos':'Adicionar aos favoritos'}" style="${favorite?'color:var(--amber);border-color:rgba(255,178,36,.35)':''}">${icon('star','w-4 h-4')}</button>
      </div>
      <div class="mt-3"><span class="pill ${info.cls}"><span class="dot"></span>${info.label}</span></div>
      <div class="mt-3 space-y-1.5 text-[11.5px] text-[var(--muted)] flex-1">
        ${row.b2b ? `<div><b class="text-[var(--text)] font-semibold">Atacado:</b> ${esc(row.b2b)}</div>` : ''}
        ${row.location ? `<div><b class="text-[var(--text)] font-semibold">Localização:</b> ${esc(row.location)}</div>` : ''}
        ${row.minimum ? `<div><b class="text-[var(--text)] font-semibold">Pedido mínimo:</b> ${esc(row.minimum)}</div>` : ''}
        ${row.phone ? `<div class="truncate"><b class="text-[var(--text)] font-semibold">Telefone:</b> ${esc(row.phone)}</div>` : ''}
        ${row.email ? `<div class="truncate"><b class="text-[var(--text)] font-semibold">E-mail:</b> ${esc(row.email)}</div>` : ''}
        ${row.contact && !row.phone && !row.email ? `<div class="truncate"><b class="text-[var(--text)] font-semibold">Contato:</b> ${esc(row.contact)}</div>` : ''}
        ${!row.b2b && !row.minimum && !row.phone && !row.email ? '<div class="text-[var(--faint)]">Contato comercial ainda não localizado.</div>' : ''}
      </div>
      <div class="flex flex-wrap gap-2 mt-4">${actions}</div>
    </article>`;
  }

  function renderRows(){
    const total = catalog.filtered.length;
    const pages = Math.max(1,Math.ceil(total/PAGE_SIZE));
    const start = (catalog.page-1)*PAGE_SIZE;
    const rows = catalog.filtered.slice(start,start+PAGE_SIZE);
    document.getElementById('supplierResultCount').textContent = `${total} fornecedor(es) encontrado(s)`;
    document.getElementById('supplierGrid').innerHTML = rows.length
      ? rows.map(supplierCard).join('')
      : `<div class="md:col-span-2 xl:col-span-3 py-14 text-center"><div class="font-semibold">Nenhum fornecedor encontrado</div><div class="text-[12px] text-[var(--muted)] mt-1">Tente outro nome, segmento ou situação.</div></div>`;
    document.getElementById('supplierPager').innerHTML = `<span class="text-[11.5px] text-[var(--muted)]">Página ${catalog.page} de ${pages}</span><div class="flex gap-2"><button class="btn btn-ghost sm" data-page="prev" ${catalog.page<=1?'disabled':''}>Anterior</button><button class="btn btn-ghost sm" data-page="next" ${catalog.page>=pages?'disabled':''}>Próxima</button></div>`;
  }

  async function load(){
    if(catalog.rows.length){ applyFilters(); return; }
    try{
      const response = await fetch('/assets/suppliers.json',{headers:{accept:'application/json'}});
      if(!response.ok) throw new Error('Catálogo indisponível.');
      const data = await response.json();
      catalog.rows = Array.isArray(data.suppliers) ? data.suppliers : [];
      const date = clean(data.updatedAt).split('-');
      if(date.length === 3) document.getElementById('supplierUpdatedAt').textContent = `${date[2]}/${date[1]}/${date[0]}`;
      const navCount = document.getElementById('supplierNavCount');
      if(navCount) navCount.textContent = String(catalog.rows.length);
      renderStats(); populateSegments(); applyFilters();
    }catch(error){
      document.getElementById('supplierGrid').innerHTML = `<div class="md:col-span-2 xl:col-span-3 py-14 text-center text-[var(--muted)]">Não foi possível carregar o catálogo agora.</div>`;
      document.getElementById('supplierResultCount').textContent = error.message;
    }
  }

  shell();
  renderQuotes();
  $('#qSave').addEventListener('click', saveQuote);
  view.addEventListener('input', event => {
    if(event.target.id !== 'supplierSearch') return;
    catalog.query = event.target.value; catalog.page=1; applyFilters();
  });
  view.addEventListener('change', event => {
    if(event.target.id === 'supplierSegment') catalog.segment = event.target.value;
    else if(event.target.id === 'supplierStatus') catalog.status = event.target.value;
    else return;
    catalog.page=1; applyFilters();
  });
  view.addEventListener('click', event => {
    if(event.target.closest('[data-qclose]')){ closeQuote(); return; }
    const quoteButton=event.target.closest('[data-new-quote]');
    if(quoteButton){
      const id=Number(quoteButton.closest('[data-supplier-id]')?.dataset.supplierId);
      const row=catalog.rows.find(item => Number(item.id)===id);
      if(row) openQuote(row);
      return;
    }
    const quoteRow=event.target.closest('[data-quote-id]');
    if(quoteRow && event.target.closest('[data-analyze-quote]')){ analyzeQuote(quoteRow.dataset.quoteId); return; }
    if(quoteRow && event.target.closest('[data-delete-quote]')){
      if(!confirm('Excluir esta cotação?')) return;
      catalog.quotes=catalog.quotes.filter(item => item.id!==quoteRow.dataset.quoteId); saveQuotes(); renderQuotes(); toast('Cotação excluída'); return;
    }
    const fav = event.target.closest('[data-favorite]');
    if(fav){
      const card=fav.closest('[data-supplier-id]'); const id=Number(card?.dataset.supplierId);
      if(catalog.favorites.has(id)) catalog.favorites.delete(id); else catalog.favorites.add(id);
      saveFavorites(); applyFilters();
      return;
    }
    const page = event.target.closest('[data-page]')?.dataset.page;
    if(page){ catalog.page += page==='next'?1:-1; renderRows(); view.scrollIntoView({behavior:'smooth',block:'start'}); }
  });

  VIEWS.suppliers.open = load;
  if(location.hash === '#suppliers' && !view.hidden) load();
})();

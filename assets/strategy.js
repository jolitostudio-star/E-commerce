/* ============================================================
   MargemIQ — Radar de oportunidades e Análise estratégica de anúncio
   Usa os utilitários globais do index.html ($, $$, esc, brl, toast, icon, state, unitCost, targetMargin, VIEWS).
   ============================================================ */
(function(){
  const STORE = { favs:'margemIQ_radar_favs', cache:'margemIQ_radar_cache', history:'margemIQ_analysis_history' };
  const CACHE_TTL = 24 * 3600 * 1000;
  const GROUP_LABEL = { growth:'Maior crescimento', desired:'Mais desejados', popular:'Mais populares' };
  const COMP_TONE = { Baixa:'st-ok', 'Média':'st-amber', Alta:'st-rose' };
  const OPP_TONE = { Promissora:'st-ok', Avaliar:'st-amber', Disputada:'st-rose' };

  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem((window.accountId || 'guest') + ':' + key)); return value ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem((window.accountId || 'guest') + ':' + key, JSON.stringify(value)); } catch {} };
  const pct = value => value === null || value === undefined ? '—' : fmtPct1(value * 100);
  const money = value => value === null || value === undefined ? '—' : brl(value);
  const est = '<span class="est" title="Número estimado, não é venda confirmada">Estimativa</span>';
  const safeUrl = url => typeof url === 'string' && /^https:\/\/[\w.-]*mercadoli[bv]re\.com(\.br)?\//.test(url) ? url : null;

  async function api(path, init){
    const response = await fetch(path, { ...init, headers:{ accept:'application/json', ...(init && init.body ? { 'content-type':'application/json' } : {}) } });
    const data = await response.json().catch(() => ({}));
    if(!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível consultar o Mercado Livre agora.'), { code:data.code, status:response.status });
    return data;
  }
  function errorBox(error){
    const reconnect = error.status === 401 || /NOT_CONNECTED|EXPIRED/.test(error.code || '');
    return `<div class="card p-8 text-center"><div class="font-semibold" style="color:var(--rose)">${esc(error.message)}</div>
      ${reconnect ? '<a href="/conectar/mercadolivre" class="btn btn-primary sm mt-4 inline-flex">Conectar Mercado Livre</a>' : ''}</div>`;
  }

  /* ================= RADAR ================= */
  const radar = { loaded:false, loading:false, category:'', group:'all', sort:'rank', trends:[], categories:[], busy:new Set() };

  function cacheKey(keyword){ return (radar.category || 'all') + '|' + keyword.toLowerCase(); }
  function cached(keyword){
    const entry = read(STORE.cache, {})[cacheKey(keyword)];
    return entry && Date.now() - entry.at < CACHE_TTL ? entry.data : null;
  }
  function saveCache(keyword, data){
    const all = read(STORE.cache, {});
    Object.keys(all).forEach(key => { if(Date.now() - all[key].at > CACHE_TTL) delete all[key]; });
    all[cacheKey(keyword)] = { at:Date.now(), data };
    write(STORE.cache, all);
  }
  const favs = () => read(STORE.favs, []);
  const isFav = keyword => favs().some(f => f.keyword.toLowerCase() === keyword.toLowerCase());

  function renderRadarShell(){
    $('#viewRadar').innerHTML = `
      <div class="card p-5">
        <div class="flex flex-wrap items-start gap-4">
          <div class="flex-1 min-w-[260px]">
            <h2 class="font-display font-semibold text-[17px]">Radar de oportunidades</h2>
            <p class="text-[12.5px] text-[var(--muted)] mt-1">As 50 tendências semanais oficiais do Mercado Livre no Brasil. Os grupos de demanda vêm da própria API. Concorrência, faixa de preço e oportunidade são uma classificação do MargemIQ, calculada a partir do catálogo.</p>
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            <select id="rdCategory" class="inp !w-auto !py-2 text-[12.5px]"><option value="">Todas as categorias</option></select>
            <select id="rdSort" class="inp !w-auto !py-2 text-[12.5px]">
              <option value="rank">Posição oficial</option>
              <option value="opportunity">Melhor oportunidade</option>
              <option value="competition">Menor concorrência</option>
              <option value="price">Menor preço</option>
            </select>
            <button class="btn btn-ghost sm" id="rdRefresh">${icon('refresh','w-4 h-4')}Atualizar</button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3 mt-4">
          <div class="seg" id="rdGroups">
            <button data-g="all" class="on">Todas</button>
            <button data-g="growth">Maior crescimento</button>
            <button data-g="desired">Mais desejados</button>
            <button data-g="popular">Mais populares</button>
            <button data-g="favs">${icon('star')}Favoritos</button>
          </div>
          <button class="btn btn-primary sm ml-auto" id="rdEnrich">${icon('target','w-4 h-4')}Classificar concorrência</button>
        </div>
      </div>
      <section class="card" id="rdFavsSec" hidden></section>
      <section class="card">
        <div class="overflow-x-auto">
          <table class="tbl radar-tbl w-full min-w-[980px]">
            <thead><tr><th>#</th><th>Termo</th><th>Demanda</th><th>Concorrência</th><th>Faixa de preço</th><th>Categoria</th><th>Oportunidade</th><th class="!text-right">Ações</th></tr></thead>
            <tbody id="rdBody"><tr><td colspan="8" class="!text-center !py-12 text-[var(--muted)]">Carregando tendências…</td></tr></tbody>
          </table>
        </div>
      </section>`;
    $('#rdCategory').addEventListener('change', e => { radar.category = e.target.value; loadTrends(); });
    $('#rdSort').addEventListener('change', e => { radar.sort = e.target.value; renderRadarRows(); });
    $('#rdRefresh').addEventListener('click', () => loadTrends());
    $('#rdEnrich').addEventListener('click', enrichVisible);
    $$('#rdGroups button').forEach(button => button.addEventListener('click', () => {
      radar.group = button.dataset.g;
      $$('#rdGroups button').forEach(b => b.classList.toggle('on', b === button));
      renderRadarRows();
    }));
    $('#rdBody').addEventListener('click', event => {
      const star = event.target.closest('[data-fav]');
      if(star) return toggleFav(star.dataset.fav);
      const run = event.target.closest('[data-enrich]');
      if(run) return enrichKeywords([run.dataset.enrich]);
    });
  }

  function rowData(trend){
    const insight = cached(trend.keyword);
    return { ...trend, insight };
  }
  function visibleRows(){
    let rows;
    if(radar.group === 'favs'){
      rows = favs().map(f => {
        const current = radar.trends.find(t => t.keyword.toLowerCase() === f.keyword.toLowerCase());
        return rowData(current || { rank:null, keyword:f.keyword, group:f.snapshot.group, demand:'Fora do top 50', url:null });
      });
    } else rows = radar.trends.filter(t => radar.group === 'all' || t.group === radar.group).map(rowData);
    const competitionOrder = { Baixa:0, 'Média':1, Alta:2 };
    const sorters = {
      rank: (a,b) => (a.rank ?? 99) - (b.rank ?? 99),
      opportunity: (a,b) => (b.insight?.opportunity?.score ?? -1) - (a.insight?.opportunity?.score ?? -1) || (a.rank ?? 99) - (b.rank ?? 99),
      competition: (a,b) => (competitionOrder[a.insight?.competition.level] ?? 9) - (competitionOrder[b.insight?.competition.level] ?? 9),
      price: (a,b) => (a.insight?.prices?.med ?? Infinity) - (b.insight?.prices?.med ?? Infinity)
    };
    return rows.sort(sorters[radar.sort]);
  }

  function renderRadarRows(){
    const rows = visibleRows();
    $('#rdEnrich').innerHTML = `${icon('target','w-4 h-4')}Classificar concorrência (${rows.filter(r => !r.insight).length})`;
    $('#rdEnrich').disabled = !rows.some(r => !r.insight) || radar.busy.size > 0;
    renderFavs();
    if(!rows.length){
      $('#rdBody').innerHTML = `<tr><td colspan="8" class="!text-center !py-12 text-[var(--muted)]">${radar.group === 'favs' ? 'Nenhum favorito ainda. Toque na estrela de um termo para monitorá-lo.' : 'Nenhuma tendência nesta seleção.'}</td></tr>`;
      return;
    }
    $('#rdBody').innerHTML = rows.map(r => {
      const i = r.insight;
      const busy = radar.busy.has(r.keyword.toLowerCase());
      const url = safeUrl(r.url);
      return `<tr>
        <td class="font-bold text-[var(--muted)]" style="font-variant-numeric:tabular-nums">${r.rank ?? '—'}</td>
        <td><div class="font-semibold">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="hover:underline">${esc(r.keyword)}</a>` : esc(r.keyword)}</div>
          <div class="text-[11px] text-[var(--faint)] mt-0.5">${esc(GROUP_LABEL[r.group] || '')}</div></td>
        <td><span class="pill ${r.group === 'growth' ? 'st-ok' : r.rank ? 'st-muted' : 'st-rose'}">${esc(r.demand)}</span></td>
        <td>${i ? `<span class="pill ${COMP_TONE[i.competition.level]}">${esc(i.competition.level)}</span><div class="text-[11px] text-[var(--faint)] mt-1">${i.competition.catalogProducts ?? '?'} produtos no catálogo${i.competition.fullShare >= .5 ? ' · maioria Full' : ''}</div>` : '<span class="text-[var(--faint)]">—</span>'}</td>
        <td>${i && i.prices ? `<b>${esc(i.priceBand)}</b><div class="text-[11px] text-[var(--faint)] mt-1">${brl(i.prices.min)} a ${brl(i.prices.max)} · ${i.prices.sample} ofertas</div>` : '<span class="text-[var(--faint)]">—</span>'}</td>
        <td class="text-[12.5px] text-[var(--muted)]">${i && i.category ? esc(i.category.name) : '—'}</td>
        <td>${i && i.opportunity ? `<span class="pill ${OPP_TONE[i.opportunity.label]}">${esc(i.opportunity.label)}</span>` : '<span class="text-[var(--faint)]">—</span>'}</td>
        <td class="!text-right whitespace-nowrap">
          <button class="btn btn-ghost sm" data-enrich="${esc(r.keyword)}" ${busy ? 'disabled' : ''}>${busy ? 'Analisando…' : i ? 'Reanalisar' : 'Analisar'}</button>
          <button class="star-btn ${isFav(r.keyword) ? 'on' : ''}" data-fav="${esc(r.keyword)}" title="${isFav(r.keyword) ? 'Remover dos favoritos' : 'Favoritar e monitorar'}">${isFav(r.keyword) ? `<svg viewBox="0 0 24 24" fill="currentColor">${ICONS.star}</svg>` : icon('star')}</button>
        </td>
      </tr>`;
    }).join('');
  }

  function renderFavs(){
    const list = favs();
    const section = $('#rdFavsSec');
    section.hidden = !list.length;
    if(!list.length) return;
    section.innerHTML = `<div class="p-5">
      <div class="flex flex-wrap items-center gap-3">
        <h3 class="font-display font-semibold text-[15px]">Monitoramento</h3>
        <span class="count-pill">${list.length} favorito(s)</span>
        <span class="text-[11.5px] text-[var(--muted)]">Comparado com a situação do dia em que você favoritou. Fica salvo só neste navegador.</span>
      </div>
      <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">${list.map(f => {
        const now = radar.trends.find(t => t.keyword.toLowerCase() === f.keyword.toLowerCase());
        const sameList = (f.category || '') === radar.category;
        const insight = cached(f.keyword);
        let rankText = 'Mude para a categoria em que foi favoritado';
        if(sameList) rankText = now ? (f.snapshot.rank ? (now.rank < f.snapshot.rank ? `Subiu de #${f.snapshot.rank} para #${now.rank}` : now.rank > f.snapshot.rank ? `Caiu de #${f.snapshot.rank} para #${now.rank}` : `Estável em #${now.rank}`) : `#${now.rank}`) : 'Saiu do top 50';
        const priceText = insight?.prices && f.snapshot.priceMed ? (() => {
          const delta = insight.prices.med / f.snapshot.priceMed - 1;
          return `Preço mediano ${delta >= 0 ? '+' : ''}${fmtPct1(delta*100)} (${brl(insight.prices.med)})`;
        })() : insight?.prices ? `Preço mediano ${brl(insight.prices.med)}` : 'Analise para medir o preço';
        return `<div class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div class="flex items-start gap-2"><b class="flex-1 text-[13px]">${esc(f.keyword)}</b>
            <button class="star-btn on" data-unfav="${esc(f.keyword)}" title="Remover">${`<svg viewBox="0 0 24 24" fill="currentColor">${ICONS.star}</svg>`}</button></div>
          <div class="text-[11.5px] mt-1 ${sameList && !now ? 't-neg' : 'text-[var(--muted)]'}">${esc(rankText)}</div>
          <div class="text-[11.5px] text-[var(--muted)] mt-0.5">${esc(priceText)}</div>
          <div class="text-[10.5px] text-[var(--faint)] mt-1.5">Desde ${new Date(f.addedAt).toLocaleDateString('pt-BR')}</div>
        </div>`;
      }).join('')}</div></div>`;
    $$('#rdFavsSec [data-unfav]').forEach(button => button.addEventListener('click', () => toggleFav(button.dataset.unfav)));
  }

  function toggleFav(keyword){
    const list = favs();
    const index = list.findIndex(f => f.keyword.toLowerCase() === keyword.toLowerCase());
    if(index >= 0){ list.splice(index, 1); toast('Removido dos favoritos'); }
    else {
      const trend = radar.trends.find(t => t.keyword.toLowerCase() === keyword.toLowerCase());
      const insight = cached(keyword);
      list.push({ keyword, category:radar.category, addedAt:Date.now(), snapshot:{ rank:trend?.rank ?? null, group:trend?.group ?? null, priceMed:insight?.prices?.med ?? null, competition:insight?.competition.level ?? null } });
      toast('Favoritado. O MargemIQ vai comparar a evolução deste termo.');
    }
    write(STORE.favs, list);
    renderRadarRows();
  }

  async function enrichKeywords(keywords){
    const queue = keywords.filter(k => !radar.busy.has(k.toLowerCase()));
    queue.forEach(k => radar.busy.add(k.toLowerCase()));
    renderRadarRows();
    let failures = 0, lastError = null;
    const worker = async () => {
      while(queue.length){
        const keyword = queue.shift();
        const trend = radar.trends.find(t => t.keyword === keyword);
        try{
          const params = new URLSearchParams({ q:keyword });
          if(trend) params.set('group', trend.group);
          const data = await api('/api/radar/keyword?' + params);
          saveCache(keyword, data);
          // Preenche o preço de referência do favorito na primeira análise.
          const list = favs(); const fav = list.find(f => f.keyword.toLowerCase() === keyword.toLowerCase());
          if(fav && !fav.snapshot.priceMed && data.prices){ fav.snapshot.priceMed = data.prices.med; write(STORE.favs, list); }
        }catch(error){
          failures++; lastError = error;
          if(error.status === 401){ queue.length = 0; }
        }finally{
          radar.busy.delete(keyword.toLowerCase());
          renderRadarRows();
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if(failures) toast(lastError.status === 401 ? lastError.message : `${failures} termo(s) não puderam ser analisados agora.`, 'err');
  }
  function enrichVisible(){ enrichKeywords(visibleRows().filter(r => !r.insight).map(r => r.keyword)); }

  async function loadTrends(){
    if(radar.loading) return;
    radar.loading = true;
    $('#rdBody').innerHTML = '<tr><td colspan="8" class="!text-center !py-12 text-[var(--muted)]">Carregando tendências oficiais…</td></tr>';
    try{
      const data = await api('/api/radar/trends' + (radar.category ? '?category=' + encodeURIComponent(radar.category) : ''));
      radar.trends = data.trends || [];
      const firstLoad = !radar.loaded;
      radar.loaded = true;
      renderRadarRows();
      // Na primeira abertura, classifica só as 10 que mais crescem; o resto fica sob demanda.
      if(firstLoad) enrichKeywords(radar.trends.filter(t => t.group === 'growth' && !cached(t.keyword)).map(t => t.keyword));
    }catch(error){
      $('#rdBody').innerHTML = `<tr><td colspan="8">${errorBox(error)}</td></tr>`;
    }finally{ radar.loading = false; }
  }
  async function loadCategories(){
    try{
      const data = await api('/api/radar/categories');
      radar.categories = data.categories || [];
      $('#rdCategory').innerHTML = '<option value="">Todas as categorias</option>' + radar.categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      $('#rdCategory').value = radar.category;
    }catch{}
  }

  VIEWS.radar.open = function(){
    if(!$('#rdBody')) renderRadarShell();
    if(!radar.loaded){ loadTrends(); loadCategories(); }
  };

  /* ================= ANÁLISE DE ANÚNCIO ================= */

  function renderAnalysisShell(){
    const products = state.products.map(p => `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.sku)}</option>`).join('');
    $('#viewAnalysis').innerHTML = `
      <div class="card p-5">
        <h2 class="font-display font-semibold text-[17px]">Análise estratégica de anúncio</h2>
        <p class="text-[12.5px] text-[var(--muted)] mt-1">Cole o link ou o ID de um anúncio do Mercado Livre. O MargemIQ responde se você consegue competir, por qual preço, com qual margem, quanto comprar e o que melhorar primeiro. Não copiamos textos nem imagens: analisamos padrões e montamos uma estratégia original.</p>
        <div class="grid lg:grid-cols-[1.4fr_1fr] gap-5 mt-5">
          <div>
            <label class="block text-[12px] font-semibold text-[var(--muted)] mb-1.5">Link ou ID do anúncio</label>
            <div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]">${icon('search','w-4 h-4')}</span>
              <input id="anRef" class="inp !pl-9 !h-12" placeholder="https://produto.mercadolivre.com.br/MLB-… ou MLB1234567890" autocomplete="off"></div>
            <div id="anHistory" class="chips"></div>
          </div>
          <div class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div class="section-title mb-3">Sua estrutura</div>
            <select id="anProduct" class="inp mb-3"><option value="">Preencher manualmente</option>${products}</select>
            <div class="grid grid-cols-2 gap-3">
              <label class="fld"><label>Custo unitário (R$)</label><input id="anCost" class="inp" type="number" min="0" step="0.01" placeholder="0,00"></label>
              <label class="fld"><label>Embalagem (R$)</label><input id="anPack" class="inp" type="number" min="0" step="0.01" placeholder="0,00"></label>
              <label class="fld"><label>Frete por unidade (R$)</label><input id="anShip" class="inp" type="number" min="0" step="0.01" placeholder="0,00" title="Estimativa do que você paga de envio por venda"></label>
              <label class="fld"><label>Margem-alvo (%)</label><input id="anTarget" class="inp" type="number" min="0" max="80" step="1"></label>
              <label class="fld col-span-2"><label>Orçamento para estoque inicial (R$, opcional)</label><input id="anBudget" class="inp" type="number" min="0" step="1" placeholder="Sem limite"></label>
            </div>
          </div>
        </div>
        <button class="btn btn-primary w-full !h-12 mt-5 text-[14px]" id="anRun">${icon('target','w-4 h-4')}Analisar anúncio</button>
      </div>
      <div id="anResult"></div>`;
    $('#anTarget').value = Math.round(targetMargin * 100);
    $('#anProduct').addEventListener('change', e => {
      const p = state.products.find(x => x.id === e.target.value);
      if(!p) return;
      $('#anCost').value = ((p.type === 'prod' ? p.materials + p.labor + p.overhead : p.buyCost)).toFixed(2);
      $('#anPack').value = p.packaging.toFixed(2);
      $('#anShip').value = p.freight.toFixed(2);
    });
    $('#anRun').addEventListener('click', runListingAnalysis);
    $('#anRef').addEventListener('keydown', e => { if(e.key === 'Enter') runListingAnalysis(); });
    renderHistory();
  }

  function renderHistory(){
    const list = read(STORE.history, []);
    $('#anHistory').innerHTML = list.length ? '<span class="text-[11px] text-[var(--faint)] self-center">Recentes:</span>' + list.map(h => `<button class="chip" data-ref="${esc(h.ref)}" title="${esc(h.title)}">${esc(h.id)} · ${esc(h.level)}</button>`).join('') : '';
    $$('#anHistory [data-ref]').forEach(chip => chip.addEventListener('click', () => { $('#anRef').value = chip.dataset.ref; runListingAnalysis(); }));
  }

  async function runListingAnalysis(){
    const ref = $('#anRef').value.trim();
    if(!ref){ $('#anRef').classList.add('err'); setTimeout(() => $('#anRef').classList.remove('err'), 600); $('#anRef').focus(); return; }
    const button = $('#anRun');
    button.disabled = true; button.innerHTML = `${icon('refresh','w-4 h-4 animate-spin')}Analisando anúncio, tarifas e concorrência…`;
    $('#anResult').innerHTML = '<div class="grid md:grid-cols-3 gap-4">' + Array.from({ length:6 }, () => '<div class="skel h-[160px]"></div>').join('') + '</div>';
    try{
      const commission = state.marketplaces.find(m => m.id === 'ml')?.commission ?? 11.9;
      const data = await api('/api/analysis/listing', { method:'POST', body:JSON.stringify({ ref, store:{
        cost:$('#anCost').value, packaging:$('#anPack').value, shipping:$('#anShip').value,
        target:$('#anTarget').value, budget:$('#anBudget').value, commission
      } }) });

      const history = read(STORE.history, []).filter(h => h.id !== data.listing.id);
      history.unshift({ ref, id:data.listing.id, title:data.listing.title, level:data.strategy.opportunity.label, at:Date.now() });
      write(STORE.history, history.slice(0, 6));
      renderHistory();
      renderAnalysis(data);
    }catch(error){
      $('#anResult').innerHTML = errorBox(error);
    }finally{
      button.disabled = false; button.innerHTML = `${icon('target','w-4 h-4')}Analisar anúncio`;
    }
  }

  const kv = (label, value) => `<div class="kv"><span>${label}</span><b>${value}</b></div>`;
  const section = (title, body, extra) => `<div class="card p-5"><div class="section-title mb-3">${title}${extra || ''}</div>${body}</div>`;

  function renderAnalysis(d){
    const s = d.strategy, opp = s.opportunity, p = d.pricing, link = safeUrl(d.listing.permalink);
    const feeLabel = p.fee.source === 'mercado_livre_listing_prices'
      ? `${brl(p.fee.amount)} <span class="text-[11px] text-[var(--faint)]">(${fmtPct1(p.fee.percentage*100)}${p.fee.fixed ? ' + ' + brl(p.fee.fixed) : ''} · oficial)</span>`
      : `${brl(p.fee.amount)} ${est}`;
    const factors = opp.factors.map(f => `<div class="check ${f.impact >= 0 ? 'ok' : 'bad'}"><i>${f.impact > 0 ? '+' + f.impact : f.impact}</i><div><b>${esc(f.label)}</b><div class="text-[var(--muted)] text-[12px]">${esc(f.detail)}</div></div></div>`).join('');

    const header = `<div class="opp-card opp-${opp.key}">
      <div class="flex flex-wrap items-start gap-4">
        <div class="flex-1 min-w-[260px]">
          <div class="text-[11px] uppercase tracking-[.12em] font-bold text-[var(--faint)]">${esc(d.listing.id)}${d.listing.category ? ' · ' + esc(d.listing.category.path.join(' › ')) : ''}</div>
          <div class="font-display font-semibold text-[16px] mt-1">${esc(d.listing.title)}</div>
          ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="link-btn mt-1 inline-block">Ver anúncio no Mercado Livre ↗</a>` : ''}
        </div>
        <div class="text-right">
          <div class="text-[11px] uppercase tracking-[.12em] font-bold text-[var(--faint)]">Nível da oportunidade</div>
          <div class="font-display font-bold text-[26px]">${esc(opp.label)}</div>
          ${opp.note ? `<div class="text-[11.5px] t-warn max-w-[260px]">${esc(opp.note)}</div>` : ''}
        </div>
      </div>
      ${factors ? `<div class="grid md:grid-cols-2 gap-x-6 mt-3">${factors}</div>` : ''}
    </div>`;

    const recommendation = s.recommended ? `<div class="rec-box">
        <div class="text-[11px] uppercase tracking-[.12em] font-bold" style="color:var(--volt)">Preço sugerido para entrar</div>
        <div class="font-display font-bold text-[28px] mt-1">${brl(s.recommended.price)}</div>
        <div class="text-[12px] text-[var(--muted)] mt-1">${esc(s.recommended.reason)}</div>
        <div class="grid grid-cols-2 gap-2 mt-3">
          <div class="stat-cell"><div class="l">Mínimo sem prejuízo</div><div class="v">${money(p.minimumPrice)}</div></div>
          <div class="stat-cell"><div class="l">Para a margem-alvo</div><div class="v">${money(p.targetPrice)}</div></div>
        </div>
      </div>` : `<div class="rec-box"><div class="text-[13px]">Informe o custo do seu produto para calcular o preço mínimo sem prejuízo e o preço sugerido.</div></div>`;

    const pricing = section('Preço, desconto e tarifas',
      kv('Preço atual', brl(p.price)) +
      (p.originalPrice ? kv('Preço original', `${brl(p.originalPrice)} <span class="t-pos">−${fmtPct1(p.discount)}</span>`) : kv('Desconto', 'Sem desconto ativo')) +
      kv('Tarifa de venda', feeLabel) +
      kv('Frete grátis', p.freeShipping ? 'Sim' : 'Não') +
      kv('Seu custo máximo p/ a meta', money(p.maxCostForTarget)) +
      (d.margin ? kv('Sua margem no preço dele', `<span class="${d.margin.marginAtMarket >= 0 ? 't-pos' : 't-neg'}">${pct(d.margin.marginAtMarket)} (${brl(d.margin.profitAtMarket)}/un.)</span>`) : ''));

    const title = section(`Título e palavras-chave <span class="count-pill">${d.title.score}/100</span>`,
      d.title.checks.map(c => `<div class="check ${c.ok ? 'ok' : 'bad'}"><i>${c.ok ? '✓' : '!'}</i><div><b>${esc(c.label)}</b><div class="text-[var(--muted)] text-[12px]">${esc(c.detail)}</div></div></div>`).join('') +
      (d.title.keywords.length ? `<div class="text-[11.5px] text-[var(--faint)] mt-2">Termos frequentes no segmento: ${d.title.keywords.map(esc).join(', ')}</div>` : ''));

    const a = d.content.attributes;
    const content = section('Imagens e ficha técnica',
      kv('Imagens', `${d.content.pictures} ${d.content.pictures >= 6 ? '<span class="t-pos">✓</span>' : '<span class="t-warn">(recomendado: 6 ou mais)</span>'}`) +
      kv('Vídeo', d.content.hasVideo ? 'Sim' : 'Não') +
      kv('Atributos preenchidos', a.total ? `${a.filled} de ${a.total} (${pct(a.ratio)})` : 'Não disponível') +
      (a.missingImportant.length ? `<div class="text-[12px] text-[var(--muted)] mt-2">Faltam atributos importantes: <b style="color:var(--text)">${a.missingImportant.map(esc).join(', ')}</b></div>` : ''));

    const sl = d.seller;
    const seller = section('Vendedor e logística', sl ?
      kv('Vendedor', esc(sl.nickname || '—')) + kv('Reputação', esc(sl.level)) + kv('Selo', esc(sl.powerSeller || 'Sem selo')) +
      kv('Vendas concluídas', sl.completedSales !== null ? sl.completedSales.toLocaleString('pt-BR') : '—') +
      kv('Avaliações positivas', sl.positiveRatings !== null ? pct(sl.positiveRatings) : '—') +
      kv('Logística', esc(sl.logistics)) + kv('Loja oficial', sl.officialStore ? 'Sim' : 'Não')
      : '<div class="text-[12.5px] text-[var(--muted)]">Dados do vendedor indisponíveis.</div>');

    const sales = d.sales;
    const salesBody = kv('Vendas públicas', sales.publicSold !== null ? sales.publicSold.toLocaleString('pt-BR') : 'Não divulgadas pela API') +
      kv('Idade do anúncio', sales.ageDays ? `${sales.ageDays} dias` : '—') +
      (sales.pace ? kv(`Ritmo ${est}`, `~${sales.pace.perMonth} vendas/mês`) +
        kv(`Faturamento ${est}`, `~${brl(sales.revenue.perMonth)}/mês`) +
        `<p class="text-[11px] text-[var(--faint)] mt-2">${esc(sales.pace.basis)} ${esc(sales.revenue.basis)}</p>`
        : '<p class="text-[11px] text-[var(--faint)] mt-2">Sem vendas públicas não é possível estimar ritmo nem faturamento.</p>');

    const you = d.you;
    const store = section('Sua loja x este concorrente',
      (you ? kv('Sua reputação', esc(you.level)) + kv('Reputação do concorrente', esc(sl?.level || '—')) : '<div class="text-[12px] text-[var(--muted)] mb-2">Este anúncio é da sua própria conta.</div>') +
      kv('Seu custo total por unidade', d.store.cost ? brl(d.store.cost + d.store.shipping) : 'Não informado') +
      kv('Margem-alvo', pct(d.store.target)) +
      (d.competitors.prices ? kv('Preços no catálogo', `${brl(d.competitors.prices.min)} a ${brl(d.competitors.prices.max)}`) : '') +
      (d.competitors.catalogProducts !== null ? kv('Produtos concorrentes no catálogo', d.competitors.catalogProducts.toLocaleString('pt-BR')) : ''));

    const actions = section('Plano de ação priorizado', `<ol class="space-y-2.5">${s.actions.map((act, index) => `<li class="flex gap-3 items-start">
        <span class="prio prio-${act.priority}">${act.priority === 1 ? 'AGORA' : act.priority === 2 ? 'DEPOIS' : 'VALIDAR'}</span>
        <div><b class="text-[13px]">${index + 1}. ${esc(act.text)}</b><div class="text-[12px] text-[var(--muted)]">${esc(act.why)}</div></div></li>`).join('')}</ol>`);

    const ideas = section('Ideias de título', `<p class="text-[11.5px] text-[var(--faint)] mb-2">Montadas a partir de padrões do segmento. Troque os campos entre colchetes pelos dados reais do seu produto.</p>` +
      s.titleIdeas.map(t => `<div class="flex items-center gap-2 py-2 border-b border-[var(--border)] last:border-0"><span class="flex-1 text-[13px]">${esc(t)}</span><span class="text-[11px] text-[var(--faint)]">${t.length}/60</span><button class="link-btn" data-copy="${esc(t)}">Copiar</button></div>`).join(''));

    const diff = section('Como se diferenciar', `<ul class="space-y-2">${s.differentiation.map(item => `<li class="flex gap-2 text-[13px]"><span style="color:var(--volt)">›</span><span>${esc(item)}</span></li>`).join('')}</ul>`);

    const st = s.initialStock, test = s.marketTest;
    const stock = section(`Estoque inicial e teste de mercado ${est}`,
      kv('Estoque inicial sugerido', `${st.units} unidade(s)`) +
      kv('Capital necessário', st.capital !== null ? brl(st.capital) : 'Informe o custo') +
      `<p class="text-[11px] text-[var(--faint)] mt-1 mb-3">${esc(st.basis)}</p>` +
      kv('Duração do teste', esc(test.days)) + kv('Preço do teste', money(test.price)) +
      `<div class="text-[12px] text-[var(--muted)] mt-2"><b style="color:var(--text)">Acompanhe:</b> ${test.watch.map(esc).join(' · ')}</div>
       <div class="text-[12px] text-[var(--muted)] mt-1.5"><b style="color:var(--text)">Sucesso:</b> ${esc(test.successCriteria)}</div>
       <div class="text-[12px] text-[var(--muted)] mt-1.5"><b style="color:var(--text)">Parar e ajustar:</b> ${esc(test.stopCriteria)}</div>`);

    $('#anResult').innerHTML = `<div class="space-y-4">
      ${header}
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="space-y-4">${recommendation}${pricing}</div>
        <div class="space-y-4">${actions}${stock}</div>
        <div class="space-y-4">${store}${section('Vendas', salesBody)}</div>
      </div>
      <div class="grid lg:grid-cols-3 gap-4">${title}${content}${seller}</div>
      <div class="grid lg:grid-cols-2 gap-4">${ideas}${diff}</div>
      <p class="text-center text-[11px] text-[var(--faint)]">Dados oficiais da API do Mercado Livre em ${new Date(d.analyzedAt).toLocaleString('pt-BR')}. Itens marcados como estimativa são projeções do MargemIQ, não vendas confirmadas.</p>
    </div>`;
    $$('#anResult [data-copy]').forEach(button => button.addEventListener('click', async () => {
      try{ await navigator.clipboard.writeText(button.dataset.copy); toast('Título copiado'); }catch{ toast('Não foi possível copiar', 'err'); }
    }));
  }

  VIEWS.analysis.open = function(){
    if(!$('#anRun')) return renderAnalysisShell();
    // Produtos podem ter sido criados ou editados no painel desde a última visita.
    const select = $('#anProduct'), current = select.value;
    select.innerHTML = '<option value="">Preencher manualmente</option>' + state.products.map(p => `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.sku)}</option>`).join('');
    select.value = state.products.some(p => p.id === current) ? current : '';
    if(!$('#anTarget').value) $('#anTarget').value = Math.round(targetMargin * 100);
  };

  // Links diretos: #radar e #analysis/<link ou ID do anúncio>.
  function openFromHash(){
    const [name, ...rest] = decodeURIComponent(location.hash.slice(1)).split('/');
    if(!VIEWS[name]) return;
    const nav = document.querySelector(`#mainNav [data-nav="${name}"]`);
    if(nav) nav.click();
    const ref = rest.join('/');
    if(name === 'analysis' && ref){ $('#anRef').value = ref; runListingAnalysis(); }
  }
  openFromHash();
})();

/* ============================================================
   MargemIQ — Diagnóstico de anúncio
   Por que um anúncio da própria conta não vende e onde corrigir no Mercado Livre.
   Nada é alterado no anúncio: a descrição sugerida é copiada e colada pelo vendedor.
   Usa os utilitários globais do index.html ($, $$, esc, brl, fmtPct1, icon, toast, openModal, closeModal, integrations).
   ============================================================ */
(function(){
  const STATUS = {
    bad: { icon: 'x', color: 'var(--rose)', bg: 'rgba(255,93,115,.12)', label: 'Corrigir' },
    warn: { icon: 'alert', color: 'var(--amber)', bg: 'rgba(255,178,36,.12)', label: 'Melhorar' },
    ok: { icon: 'check', color: 'var(--emerald)', bg: 'rgba(61,220,151,.12)', label: 'OK' },
    info: { icon: 'alert', color: 'var(--muted)', bg: 'rgba(255,255,255,.06)', label: 'Info' }
  };
  const STAGE = {
    bloqueado: { color: 'var(--rose)', bg: 'rgba(255,93,115,.08)' },
    exposicao: { color: 'var(--amber)', bg: 'rgba(255,178,36,.08)' },
    conversao: { color: 'var(--amber)', bg: 'rgba(255,178,36,.08)' },
    ajustes: { color: 'var(--volt)', bg: 'rgba(216,255,62,.06)' },
    ok: { color: 'var(--emerald)', bg: 'rgba(61,220,151,.08)' }
  };
  const safeUrl = url => typeof url === 'string' && /^https:\/\/[\w.-]*mercadoli[bv]re\.com(\.br)?\//.test(url) ? url : null;
  const num = value => value === null || value === undefined ? '—' : Number(value).toLocaleString('pt-BR');
  let current = null;

  const modal = document.createElement('div');
  modal.className = 'modal'; modal.id = 'diagModal'; modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `<div class="modal-ov" data-dclose></div><div class="modal-panel max-w-2xl !p-0" id="diagPanel"></div>`;
  document.body.appendChild(modal);
  modal.querySelector('[data-dclose]').addEventListener('click', () => closeModal(modal));

  async function api(body){
    const response = await fetch('/api/analysis/listing', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if(!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível analisar agora.'), { status: response.status, code: data.code });
    return data;
  }

  function header(listing){
    return `<div class="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]" style="background:var(--surface)">
      ${listing?.thumbnail ? `<img src="${esc(listing.thumbnail)}" alt="" class="w-11 h-11 rounded-lg object-cover bg-white flex-none">` : ''}
      <div class="flex-1 min-w-0">
        <div class="text-[10.5px] uppercase tracking-[.12em] text-[var(--faint)] font-bold">Diagnóstico do anúncio</div>
        <div class="font-semibold text-[13.5px] truncate">${esc(listing?.title || 'Carregando…')}</div>
      </div>
      <button class="icon-btn flex-none" data-dclose aria-label="Fechar">${icon('x','w-4 h-4')}</button>
    </div>`;
  }

  function bindClose(){ $$('#diagPanel [data-dclose]').forEach(button => button.addEventListener('click', () => closeModal(modal))); }

  function checkRow(entry){
    const s = STATUS[entry.status] || STATUS.info;
    return `<div class="flex gap-3 py-3 border-b border-[var(--border)] last:border-0">
      <span class="grid place-items-center w-7 h-7 rounded-lg flex-none" style="background:${s.bg}; color:${s.color}">${icon(s.icon,'w-4 h-4')}</span>
      <div class="flex-1 min-w-0">
        <div class="text-[13px] font-semibold">${esc(entry.label)}</div>
        <div class="text-[12px] text-[var(--muted)] mt-0.5">${esc(entry.detail)}</div>
        ${entry.where && entry.status !== 'ok' ? `<div class="text-[11.5px] mt-1.5" style="color:var(--volt)">${icon('pencil','w-3 h-3 inline -mt-0.5 mr-1')}${esc(entry.where)}</div>` : ''}
      </div>
    </div>`;
  }

  function render(d){
    const stage = STAGE[d.stage.key] || STAGE.ajustes;
    const f = d.funnel;
    const areas = [...new Set(d.checks.map(entry => entry.area))];
    const url = safeUrl(d.listing.permalink);
    $('#diagPanel').innerHTML = header(d.listing) + `
      <div class="p-5 space-y-4">
        <div class="rounded-xl p-4" style="border:1px solid ${stage.color}; background:${stage.bg}">
          <div class="font-display font-bold text-[18px]" style="color:${stage.color}">${esc(d.stage.label)}</div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[12px]">
            <div><div class="text-[var(--faint)]">Visitas (30 dias)</div><div class="font-bold text-[16px]">${num(f.visits30)}</div></div>
            <div><div class="text-[var(--faint)]">Visitas no total</div><div class="font-bold text-[16px]">${num(f.visitsTotal)}</div></div>
            <div><div class="text-[var(--faint)]">Vendas</div><div class="font-bold text-[16px]">${num(f.sold)}</div></div>
            <div><div class="text-[var(--faint)]">Conversão</div><div class="font-bold text-[16px]">${f.conversion === null ? '—' : fmtPct1(f.conversion * 100)}</div></div>
          </div>
          <div class="text-[11px] text-[var(--faint)] mt-2">${esc(d.listing.listingType)} · ${brl(d.listing.price)} · ${d.listing.stock} em estoque · anúncio com ${d.listing.ageDays} dia(s)</div>
        </div>

        ${d.priorities.length ? `<div class="card p-4">
          <div class="section-title mb-2">Corrija primeiro</div>
          <ol class="space-y-2">${d.priorities.map((entry, index) => `<li class="flex gap-3 text-[13px]"><b class="flex-none w-5 h-5 rounded-full grid place-items-center text-[11px]" style="background:var(--volt); color:#0B0D05">${index + 1}</b><div class="min-w-0"><div class="font-semibold">${esc(entry.label)}</div><div class="text-[11.5px] mt-0.5" style="color:var(--volt)">${esc(entry.where)}</div></div></li>`).join('')}</ol>
        </div>` : ''}

        ${areas.map(area => `<div class="card px-4 py-1"><div class="section-title pt-3">${esc(area)}</div>${d.checks.filter(entry => entry.area === area).map(checkRow).join('')}</div>`).join('')}

        <div class="card p-4" id="diagDescription">
          <div class="section-title mb-2">Descrição atual <span class="font-normal normal-case tracking-normal text-[11px]">· nota ${d.description.score}/100</span></div>
          ${d.description.length ? `<pre class="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed max-h-[220px] overflow-y-auto rounded-lg p-3 bg-[var(--surface-2)] border border-[var(--border)]" style="font-family:inherit">${esc(d.description.text)}</pre>` : '<div class="text-[12.5px] text-[var(--rose)]">O anúncio está sem descrição.</div>'}
          <div class="mt-3 space-y-1">${d.description.checks.map(entry => `<div class="flex gap-2 text-[12px]"><span style="color:${entry.ok ? 'var(--emerald)' : 'var(--amber)'}">${icon(entry.ok ? 'check' : 'alert','w-3.5 h-3.5 inline')}</span><span class="${entry.ok ? 'text-[var(--muted)]' : ''}">${esc(entry.label)}${entry.ok ? '' : ` — ${esc(entry.detail)}`}</span></div>`).join('')}</div>
          <div id="diagSuggestion" class="mt-4">
            ${integrations.vision
              ? `<button class="btn btn-primary w-full !h-11" id="diagSuggest">${icon('sparkles','w-4 h-4')}Sugerir nova descrição com IA</button>`
              : '<div class="text-[11.5px] text-[var(--faint)]">Configure a IA (GEMINI_API_KEY) para receber uma descrição sugerida.</div>'}
          </div>
        </div>

        <div class="text-[11.5px] text-[var(--faint)]">O MargemIQ não altera o anúncio. Faça as mudanças no Mercado Livre pelos caminhos indicados. Visitas e vendas vêm do Mercado Livre; as faixas de "poucas visitas" e "conversão baixa" são referências do MargemIQ.</div>
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="btn btn-ghost w-full">Ver anúncio no Mercado Livre ↗</a>` : ''}
      </div>`;
    bindClose();
    $('#diagSuggest')?.addEventListener('click', suggest);
  }

  async function suggest(){
    const box = $('#diagSuggestion');
    box.innerHTML = `<div class="skel h-[160px]"></div><div class="text-[12px] text-[var(--muted)] mt-2">Escrevendo uma descrição com os dados do seu anúncio…</div>`;
    try{
      const data = await api({ action: 'descricao', itemId: current });
      box.innerHTML = `
        <div class="section-title mb-2">Descrição sugerida <span class="font-normal normal-case tracking-normal text-[11px]">· revise antes de usar</span></div>
        ${data.fill.length ? `<div class="rounded-lg px-3 py-2 mb-2 text-[12px]" style="background:rgba(255,178,36,.1); color:#FFC966">Complete os trechos <b>[preencher: …]</b> antes de colar: ${esc(data.fill.join(', '))}.</div>` : ''}
        <textarea id="diagText" class="inp !h-auto min-h-[280px] text-[12.5px] leading-relaxed" spellcheck="true">${esc(data.description)}</textarea>
        <div class="flex items-center justify-between text-[11px] text-[var(--faint)] mt-1"><span>Escrita pela IA a partir do título, da ficha técnica e da descrição atual.</span><span id="diagCount"></span></div>
        <button class="btn btn-primary w-full !h-11 mt-3" id="diagCopy">${icon('check','w-4 h-4')}Copiar descrição</button>
        <div class="text-[12px] mt-3 rounded-lg p-3 border border-[var(--border)] bg-[var(--surface-2)]"><b>Onde colar:</b> ${esc(data.where)}. Apague o texto antigo, cole o novo e salve.</div>
        <button class="btn btn-ghost w-full mt-2" id="diagRetry">${icon('refresh','w-4 h-4')}Gerar outra sugestão</button>`;
      const count = () => { $('#diagCount').textContent = `${$('#diagText').value.length} caracteres`; };
      $('#diagText').addEventListener('input', count); count();
      $('#diagCopy').addEventListener('click', copy);
      $('#diagRetry').addEventListener('click', suggest);
    }catch(error){
      box.innerHTML = `<div class="text-[12.5px]" style="color:var(--rose)">${esc(error.message)}</div><button class="btn btn-ghost w-full mt-2" id="diagRetry">${icon('refresh','w-4 h-4')}Tentar de novo</button>`;
      $('#diagRetry').addEventListener('click', suggest);
    }
  }

  async function copy(){
    const text = $('#diagText').value;
    if(/\[preencher:/i.test(text)) toast('Atenção: ainda há trechos [preencher: …] no texto.', 'rose');
    try{ await navigator.clipboard.writeText(text); }
    catch{ $('#diagText').select(); document.execCommand('copy'); }
    toast('Descrição copiada. Agora cole no Mercado Livre.');
  }

  window.openDiagnosis = async function(itemId){
    current = itemId;
    $('#diagPanel').innerHTML = header(null) + '<div class="p-5 space-y-3"><div class="skel h-[120px]"></div><div class="skel h-[90px]"></div><div class="skel h-[260px]"></div></div>';
    bindClose();
    openModal(modal);
    try{
      const data = await api({ action: 'diagnostico', itemId });
      if(current === itemId) render(data);
    }catch(error){
      const reconnect = error.status === 401 || /NOT_CONNECTED|EXPIRED/.test(error.code || '');
      $('#diagPanel').innerHTML = header(null) + `<div class="p-6 text-center"><div class="font-semibold" style="color:var(--rose)">${esc(error.message)}</div>${reconnect ? '<a href="/conectar/mercadolivre" class="btn btn-primary sm mt-4 inline-flex">Conectar Mercado Livre</a>' : ''}</div>`;
      bindClose();
    }
  };
})();

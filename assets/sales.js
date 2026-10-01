/* ============================================================
   MargemIQ — Minhas vendas
   Pedidos reais do Mercado Livre com tarifa e frete oficiais; o custo vem dos Produtos (salvos no navegador).
   Usa os utilitários globais do index.html ($, $$, esc, brl, fmtPct1, icon, toast, state, findLocalProduct, VIEWS).
   ============================================================ */
(function(){
  const sales = { days: 30, data: null, loading: false };
  const STATUS = {
    paid: { label: 'Paga', cls: 'st-ok' },
    confirmed: { label: 'Confirmada', cls: 'st-ok' },
    payment_in_process: { label: 'Pagamento em análise', cls: 'st-amber' },
    payment_required: { label: 'Aguardando pagamento', cls: 'st-amber' },
    partially_paid: { label: 'Paga em parte', cls: 'st-amber' },
    cancelled: { label: 'Cancelada', cls: 'st-rose' },
    invalid: { label: 'Inválida', cls: 'st-rose' }
  };
  const pct = value => value === null || value === undefined ? '—' : fmtPct1(value * 100);
  const money = value => value === null || value === undefined ? '—' : brl(value);
  const dateLabel = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

  // Custo de uma unidade sem o frete estimado do cadastro: aqui o frete real vem do Mercado Livre.
  function productCost(item){
    const product = findLocalProduct({ id: item.itemId, sku: item.sku, title: item.title });
    if(!product) return null;
    const base = (product.type === 'prod' ? product.materials + product.labor + product.overhead : product.buyCost) + product.packaging;
    return base > 0 ? { product, unit: base } : null;
  }

  function computeOrder(order){
    const counted = order.status !== 'cancelled' && order.status !== 'invalid';
    let cost = 0, missingCost = false;
    order.items.forEach(item => {
      const found = productCost(item);
      if(found) cost += found.unit * item.quantity; else missingCost = true;
    });
    const shipping = order.shipping?.amount;
    const profit = !counted || missingCost || shipping === null ? null : Math.round((order.revenue - order.fee - shipping - cost) * 100) / 100;
    return { ...order, counted, cost: missingCost ? null : Math.round(cost * 100) / 100, missingCost, profit, margin: profit === null || !order.revenue ? null : profit / order.revenue };
  }

  function summarize(orders){
    const valid = orders.filter(order => order.counted);
    const sum = key => valid.reduce((total, order) => total + (order[key] || 0), 0);
    const complete = valid.filter(order => order.profit !== null);
    const profit = complete.reduce((total, order) => total + order.profit, 0);
    const completeRevenue = complete.reduce((total, order) => total + order.revenue, 0);
    const byProduct = new Map();
    valid.forEach(order => order.items.forEach(item => {
      const key = item.itemId || item.title;
      const entry = byProduct.get(key) || { title: item.title, itemId: item.itemId, units: 0, revenue: 0, profit: 0, known: 0, unknown: 0, noCost: false };
      entry.units += item.quantity; entry.revenue += item.unitPrice * item.quantity;
      // Lucro por produto: o pedido inteiro entra no primeiro item (quase todo pedido tem um item só).
      if(order.items[0] === item){ if(order.profit === null) entry.unknown++; else { entry.profit += order.profit; entry.known++; } }
      if(!productCost(item)) entry.noCost = true;
      byProduct.set(key, entry);
    }));
    return {
      count: valid.length, cancelled: orders.length - valid.length,
      units: valid.reduce((total, order) => total + order.items.reduce((s, item) => s + item.quantity, 0), 0),
      revenue: sum('revenue'), fee: sum('fee'),
      shipping: valid.reduce((total, order) => total + (order.shipping?.amount || 0), 0),
      cost: sum('cost'), profit, margin: completeRevenue ? profit / completeRevenue : null,
      missingCost: valid.filter(order => order.missingCost).length,
      missingShipping: valid.filter(order => order.shipping?.amount === null).length,
      complete: complete.length,
      products: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue)
    };
  }

  function renderShell(){
    $('#viewSales').innerHTML = `
      <div class="max-w-[1100px] mx-auto w-full space-y-4">
        <div class="card p-5">
          <div class="flex flex-wrap items-start gap-3">
            <div class="flex-1 min-w-[220px]">
              <h2 class="font-display font-semibold text-[18px]">Minhas vendas</h2>
              <p class="text-[12.5px] text-[var(--muted)] mt-1" id="slSubtitle">Pedidos do Mercado Livre com a tarifa e o frete cobrados de verdade. O lucro usa o custo cadastrado em Produtos.</p>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
              <div class="flex rounded-xl border border-[var(--border)] overflow-hidden" id="slPeriods">${[7, 30, 90].map(days => `<button class="px-3 h-9 text-[12.5px] font-semibold" data-days="${days}">${days} dias</button>`).join('')}</div>
              <button class="btn btn-ghost sm" id="slRefresh">${icon('refresh','w-4 h-4')}Atualizar</button>
            </div>
          </div>
        </div>
        <div id="slBody"></div>
      </div>`;
    $$('#slPeriods [data-days]').forEach(button => button.addEventListener('click', () => { sales.days = Number(button.dataset.days); load(); }));
    $('#slRefresh').addEventListener('click', load);
  }

  function markPeriod(){
    $$('#slPeriods [data-days]').forEach(button => {
      const on = Number(button.dataset.days) === sales.days;
      button.style.background = on ? 'var(--volt-dim)' : 'var(--surface-2)';
      button.style.color = on ? 'var(--volt)' : 'var(--muted)';
    });
  }

  async function load(){
    if(sales.loading) return;
    sales.loading = true; markPeriod();
    $('#slRefresh').disabled = true;
    $('#slBody').innerHTML = '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3"><div class="skel h-[96px]"></div><div class="skel h-[96px]"></div><div class="skel h-[96px]"></div><div class="skel h-[96px]"></div></div><div class="skel h-[220px] mt-4"></div>';
    try{
      const response = await fetch(`/api/ml/orders?days=${sales.days}`, { headers: { accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if(!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível buscar as vendas agora.'), { status: response.status, code: data.code });
      sales.data = data;
      render();
    }catch(error){
      const reconnect = error.status === 401 || /NOT_CONNECTED|EXPIRED/.test(error.code || '');
      $('#slBody').innerHTML = `<div class="card p-6 text-center"><div class="font-semibold" style="color:var(--rose)">${esc(error.message)}</div>${reconnect ? '<a href="/conectar/mercadolivre" class="btn btn-primary sm mt-4 inline-flex">Conectar Mercado Livre</a>' : ''}</div>`;
    }finally{
      sales.loading = false; $('#slRefresh').disabled = false;
    }
  }

  function kpi(label, value, sub, cls){
    return `<div class="card p-4 min-w-0"><div class="kpi-label">${label}</div><div class="font-display font-bold text-[20px] mt-1 truncate ${cls || ''}">${value}</div>${sub ? `<div class="text-[11.5px] text-[var(--faint)] mt-0.5">${sub}</div>` : ''}</div>`;
  }

  function render(){
    const data = sales.data;
    const orders = data.orders.map(computeOrder);
    const s = summarize(orders);
    $('#slSubtitle').textContent = `${data.seller.nickname || 'Conta conectada'} · últimos ${data.period.days} dias · ${s.count} venda(s)${s.cancelled ? ` e ${s.cancelled} cancelada(s)` : ''}`;
    if(!orders.length){
      $('#slBody').innerHTML = `<div class="card p-8 text-center"><div class="font-semibold">Nenhuma venda nos últimos ${data.period.days} dias</div><div class="text-[12.5px] text-[var(--muted)] mt-1">Quando você vender no Mercado Livre, as vendas aparecem aqui com a tarifa, o frete e o lucro de cada uma.</div></div>`;
      return;
    }
    const warnings = [
      s.missingCost ? `<b>${s.missingCost} venda(s) sem custo cadastrado</b>: o lucro delas não entra no total. Importe os anúncios em Produtos e informe o custo.` : '',
      s.missingShipping ? `${s.missingShipping} venda(s) sem o valor do frete: o Mercado Livre não informou o custo do envio.` : '',
      data.truncated ? `Mostrando as ${orders.length} vendas mais recentes de ${data.total}.` : ''
    ].filter(Boolean);
    $('#slBody').innerHTML = `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${kpi('Faturamento', brl(s.revenue), `${s.units} unidade(s) vendida(s)`)}
        ${kpi('Tarifas do ML', brl(s.fee), s.revenue ? pct(s.fee / s.revenue) + ' do faturamento' : '')}
        ${kpi('Frete pago por você', brl(s.shipping), s.revenue ? pct(s.shipping / s.revenue) + ' do faturamento' : '')}
        ${kpi('Lucro real', s.complete ? brl(s.profit) : '—', s.complete ? `margem ${pct(s.margin)}${s.missingCost ? ` · ${s.complete} de ${s.count} vendas` : ''}` : 'informe o custo dos produtos', s.complete ? (s.profit >= 0 ? 't-pos' : 't-neg') : '')}
      </div>
      ${warnings.length ? `<div class="card p-4 text-[12.5px] space-y-1" style="border-color:rgba(255,178,36,.35); background:rgba(255,178,36,.06); color:#FFC966">${warnings.map(w => `<div>${w}</div>`).join('')}</div>` : ''}
      <div class="card p-5">
        <div class="section-title mb-3">Por produto</div>
        <div class="space-y-2">${s.products.map(p => `
          <div class="flex items-center gap-3 text-[13px]">
            <div class="flex-1 min-w-0"><div class="truncate font-semibold">${esc(p.title)}</div><div class="text-[11px] text-[var(--faint)]">${p.units} un. · ${brl(p.revenue)}</div></div>
            <div class="text-right">${productProfit(p)}</div>
          </div>`).join('')}</div>
      </div>
      <div class="card p-5">
        <div class="section-title mb-3">Vendas</div>
        <div class="space-y-3">${orders.map(renderOrder).join('')}</div>
      </div>`;
  }

  // Lucro do produto no período; quando falta custo ou frete em alguma venda, mostra o parcial e o motivo.
  function productProfit(p){
    if(p.noCost) return '<div class="font-bold text-[var(--faint)]">sem custo</div>';
    if(!p.known) return '<div class="font-bold text-[var(--faint)]">—</div><div class="text-[10.5px] text-[var(--faint)]">frete não informado</div>';
    return `<div class="font-bold ${p.profit >= 0 ? 't-pos' : 't-neg'}">${brl(p.profit)}</div>${p.unknown ? `<div class="text-[10.5px] text-[var(--faint)]">parcial: ${p.known} de ${p.known + p.unknown} vendas</div>` : ''}`;
  }

  function renderOrder(order){
    const status = STATUS[order.status] || { label: order.status || '—', cls: '' };
    const shipping = order.shipping || {};
    const shippingLabel = shipping.source === 'mesmo_envio' ? 'no mesmo envio' : shipping.source === 'sem_envio' ? 'sem envio' : shipping.amount === null ? 'não informado' : '− ' + brl(shipping.amount);
    return `<div class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 ${order.counted ? '' : 'opacity-60'}">
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          ${order.items.map(item => `<div class="font-semibold text-[13px] leading-snug">${esc(item.title)}</div><div class="text-[11.5px] text-[var(--faint)] mt-0.5">${item.quantity} × ${brl(item.unitPrice)}</div>`).join('')}
          <div class="text-[11px] text-[var(--faint)] mt-1">${esc(dateLabel(order.date))} · pedido ${esc(order.id)}</div>
        </div>
        <span class="pill ${status.cls}">${esc(status.label)}</span>
      </div>
      ${order.counted ? `<div class="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1 mt-3 text-[12px]">
        <div><span class="text-[var(--faint)]">Venda</span><div class="font-semibold">${brl(order.revenue)}</div></div>
        <div><span class="text-[var(--faint)]">Tarifa ML</span><div class="font-semibold">− ${brl(order.fee)}</div></div>
        <div><span class="text-[var(--faint)]">Frete</span><div class="font-semibold">${shippingLabel}</div></div>
        <div><span class="text-[var(--faint)]">Custo</span><div class="font-semibold">${order.missingCost ? '<span class="t-warn">sem custo</span>' : '− ' + brl(order.cost)}</div></div>
        <div class="col-span-2 sm:col-span-1"><span class="text-[var(--faint)]">Lucro</span><div class="font-bold text-[14px] ${order.profit === null ? 'text-[var(--faint)]' : order.profit >= 0 ? 't-pos' : 't-neg'}">${order.profit === null ? '—' : `${brl(order.profit)} <span class="text-[11px] font-semibold">${pct(order.margin)}</span>`}</div></div>
      </div>` : ''}
    </div>`;
  }

  VIEWS.vendas.open = function(){
    if(!$('#slRefresh')) renderShell();
    // Os custos podem ter mudado em Produtos: recalcula sem buscar de novo se já houver dados do mesmo período.
    if(sales.data && sales.data.period.days === sales.days) { markPeriod(); render(); } else load();
  };
})();

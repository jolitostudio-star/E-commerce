(function(root){
  const number = (value, fallback = 0) => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const productKey = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function normalize(input){
    const quote = {
      id: String(input.id || ''), supplierId:Number(input.supplierId || 0), supplierName:String(input.supplierName || '').trim(),
      product:String(input.product || '').trim(), unitPrice:number(input.unitPrice), quantity:Math.max(1,Math.trunc(number(input.quantity,1))),
      freightTotal:Math.max(0,number(input.freightTotal)), salePrice:Math.max(0,number(input.salePrice)),
      feePercent:Math.max(0,number(input.feePercent)), taxPercent:Math.max(0,number(input.taxPercent)),
      shippingSale:Math.max(0,number(input.shippingSale)), packaging:Math.max(0,number(input.packaging)),
      minimumOrder:String(input.minimumOrder || '').trim(), leadDays:Math.max(0,Math.trunc(number(input.leadDays))),
      notes:String(input.notes || '').trim(), createdAt:String(input.createdAt || new Date().toISOString())
    };
    if(quote.product.length < 2) throw new Error('Informe o produto da cotação.');
    if(!(quote.unitPrice > 0)) throw new Error('Informe um preço unitário válido.');
    if(!quote.supplierId || !quote.supplierName) throw new Error('Fornecedor inválido.');
    return quote;
  }

  function metrics(input){
    const quote = normalize(input);
    const freightUnit = quote.freightTotal / quote.quantity;
    const landedCost = quote.unitPrice + freightUnit;
    const investment = quote.unitPrice * quote.quantity + quote.freightTotal;
    const fee = quote.salePrice * quote.feePercent / 100;
    const tax = quote.salePrice * quote.taxPercent / 100;
    const profit = quote.salePrice > 0 ? quote.salePrice - fee - tax - quote.shippingSale - quote.packaging - landedCost : null;
    const margin = profit === null ? null : profit / quote.salePrice;
    return { quote, freightUnit:round(freightUnit), landedCost:round(landedCost), investment:round(investment), fee:round(fee), tax:round(tax), profit:profit === null ? null : round(profit), margin };
  }

  function ranked(quotes){
    const rows = quotes.map(metrics);
    const groups = new Map();
    rows.forEach(row => { const k=productKey(row.quote.product); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(row); });
    groups.forEach(group => {
      const bestCost = Math.min(...group.map(row => row.landedCost));
      const margins = group.filter(row => row.margin !== null).map(row => row.margin);
      const bestMargin = margins.length ? Math.max(...margins) : null;
      group.forEach(row => { row.bestCost=row.landedCost===bestCost; row.bestMargin=bestMargin!==null && row.margin===bestMargin; });
    });
    return rows.sort((a,b) => productKey(a.quote.product).localeCompare(productKey(b.quote.product)) || a.landedCost-b.landedCost);
  }

  root.MargemIQQuotes = { normalize, metrics, ranked, productKey };
})(globalThis);

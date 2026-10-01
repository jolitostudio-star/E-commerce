const status=document.getElementById('portalMessage');
async function loadPortal(){
  try{
    const response=await fetch('/api/account'),account=await response.json();
    if(!response.ok){if(account.code==='AUTH_REQUIRED'){location.replace('/login');return;}throw new Error(account.error);}
    if(account.admin){const link=document.createElement('a');link.href='/app';link.className='button secondary';link.textContent='Meu painel administrativo →';document.getElementById('portalReports').append(link);}
    const history=await fetch('/api/payments?view=history'),data=await history.json();
    if(!history.ok)throw new Error(data.error);
    for(const order of data.orders){const link=document.createElement('a');link.className='button secondary';link.href='/diagnostico?order='+encodeURIComponent(order.id);link.textContent='Abrir relatório · '+new Date(order.created_at).toLocaleDateString('pt-BR');document.getElementById('portalReports').append(link);}
    status.textContent=data.orders.length?'Escolha um relatório para ver os dados e as melhorias sugeridas.':'Você ainda não tem relatórios pagos.';
  }catch(error){status.textContent=error.message || 'Não foi possível carregar suas análises.';}
}
document.getElementById('signOut').onclick=async()=>{const response=await fetch('/api/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'logout'})});if(response.ok)location.replace('/login');};
loadPortal();

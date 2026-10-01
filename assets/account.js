const logout = document.createElement('button');
logout.textContent = 'Sair da conta';
logout.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:100;background:#181c25;color:#eef1f5;border:1px solid #5c6472;border-radius:10px;padding:10px 16px;cursor:pointer';
logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    const response = await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    if (!response.ok) throw new Error();
    location.replace('/login');
  } catch { logout.disabled = false; logout.textContent = 'Tentar sair novamente'; }
});
document.body.append(logout);
window.startPaidAnalysis = async (ref, costs = null) => {
  sessionStorage.removeItem('miq_preview');
    sessionStorage.setItem('miq_attempt',crypto.randomUUID());
  const response = await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'lead', ref }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível continuar.');
  localStorage.removeItem(window.accountId + ':miq_checkout:' + String(ref).trim());
  sessionStorage.removeItem(window.accountId + ':miq_analysis_costs');
  if (costs) sessionStorage.setItem(window.accountId + ':miq_analysis_costs', JSON.stringify(costs));
  location.assign('/diagnostico');
};
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401 && new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href).origin === location.origin) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.code === 'AUTH_REQUIRED') location.replace('/login');
  }
  return response;
};

const sourceButton=document.createElement('button');sourceButton.textContent='Ativar consultas pelo link';sourceButton.style.cssText='position:fixed;bottom:68px;right:18px;z-index:100;background:#d8ff3e;color:#0b1400;border:0;border-radius:10px;padding:12px;cursor:pointer';sourceButton.onclick=async()=>{sourceButton.disabled=true;try{const response=await fetch('/api/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'analysis_source'})}),data=await response.json();if(!response.ok){if(data.code==='ML_NOT_CONNECTED'){location.assign('/conectar/mercadolivre');return;}throw new Error(data.error);}sourceButton.textContent='Consultas pelo link ativadas';}catch(error){sourceButton.textContent=error.message;sourceButton.disabled=false;}};document.body.append(sourceButton);

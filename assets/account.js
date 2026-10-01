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
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401 && new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href).origin === location.origin) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.code === 'AUTH_REQUIRED') location.replace('/login');
  }
  return response;
};

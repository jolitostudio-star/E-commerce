const leadForm = document.getElementById('leadForm');
const leadButton = document.getElementById('leadSubmit');
const leadMessage = document.getElementById('leadMessage');
leadForm.addEventListener('submit', async event => {
  event.preventDefault();
  leadButton.disabled = true;
  leadMessage.textContent = 'Guardando seu anúncio…';
  try {
    const response = await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'lead', ref: document.getElementById('listingRef').value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const session = await fetch('/api/account');
    if (session.ok) {
      const account = await session.json();
      localStorage.removeItem(account.user.id + ':miq_checkout:' + account.pendingListing);
      sessionStorage.removeItem(account.user.id + ':miq_analysis_costs');
    }
    location.assign(session.ok ? '/diagnostico' : '/login?next=diagnostico');
  } catch (error) {
    leadMessage.textContent = error.message || 'Não foi possível continuar. Tente novamente.';
    leadButton.disabled = false;
  }
});

let action = 'login';
const form = document.getElementById('auth');
const submit = document.getElementById('submit');
const toggle = document.getElementById('toggle');
const message = document.getElementById('message');
const password = document.getElementById('password');
toggle.onclick = () => {
  action = action === 'login' ? 'signup' : 'login';
  document.getElementById('title').textContent = action === 'login' ? 'Entrar na sua conta' : 'Criar sua conta';
  submit.textContent = action === 'login' ? 'Entrar' : 'Cadastrar';
  toggle.textContent = action === 'login' ? 'Criar uma conta' : 'Já tenho uma conta';
  password.autocomplete = action === 'login' ? 'current-password' : 'new-password';
  password.minLength = action === 'login' ? 1 : 8;
  message.textContent = '';
};
form.onsubmit = async event => {
  event.preventDefault();
  submit.disabled = toggle.disabled = true;
  message.textContent = 'Aguarde…';
  try {
    const response = await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, next: new URLSearchParams(location.search).get('next'), order:new URLSearchParams(location.search).get('order'), email: document.getElementById('email').value, password: password.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    password.value = '';
    if (data.signedIn) location.replace(/^\/(?:app|analises|diagnostico)(?:\?[^#]*)?$/.test(data.next) ? data.next : '/analises');
    else message.textContent = data.message;
  } catch (error) { message.textContent = error.message || 'Não foi possível conectar. Tente novamente.'; }
  finally { submit.disabled = toggle.disabled = false; }
};

if (new URLSearchParams(location.search).get('next') === 'diagnostico') {
  toggle.click();
  message.textContent = new URLSearchParams(location.search).get('checkout') === '1'
    ? 'Crie sua conta gratuitamente para continuar. Depois, conclua o pagamento de R$ 1 para liberar o relatório do anúncio. Nenhuma cobrança é feita no cadastro.'
    : 'Seu anúncio foi salvo. Crie sua conta para continuar com a prévia gratuita.';
}

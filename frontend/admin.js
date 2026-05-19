// ===== FINPESSOAL – AUTH FRONTEND =====

// Se já está logado, vai para a página correta
if (getToken()) {
  const u = getUsuario();
  if (u?.perfil === 'admin') window.location.href = '/pages/admin.html';
  else window.location.href = '/pages/dashboard.html';
}

function alternarForm() {
  document.getElementById('formLogin').classList.toggle('hidden');
  document.getElementById('formCadastro').classList.toggle('hidden');
}

function mostrarErro(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function ocultarErro(id) {
  document.getElementById(id).classList.add('hidden');
}

async function fazerLogin() {
  ocultarErro('erroLogin');
  const email = document.getElementById('loginEmail').value.trim();
  const senha  = document.getElementById('loginSenha').value;
  if (!email || !senha) { mostrarErro('erroLogin','Preencha e-mail e senha.'); return; }

  const resp = await apiPost('/auth/login', { email, senha });

  if (!resp || !resp.ok) {
    const cod = resp?.data?.codigo;
    if (cod === 'LICENCA_EXPIRADA') {
      mostrarErro('erroLogin', '⏰ Licença expirada. Entre em contato com o administrador para renovar.');
    } else if (cod === 'BLOQUEADO') {
      mostrarErro('erroLogin', '🚫 Conta bloqueada. Entre em contato com o administrador.');
    } else {
      mostrarErro('erroLogin', resp?.data?.erro || 'Erro ao fazer login.');
    }
    return;
  }

  localStorage.setItem('fp_token',   resp.data.token);
  localStorage.setItem('fp_usuario', JSON.stringify(resp.data.usuario));

  // Redireciona de acordo com o perfil
  if (resp.data.usuario.perfil === 'admin') {
    window.location.href = '/pages/admin.html';
  } else {
    window.location.href = '/pages/dashboard.html';
  }
}

async function fazerCadastro() {
  ocultarErro('erroCadastro');
  document.getElementById('sucessoCadastro').classList.add('hidden');
  const nome  = document.getElementById('cadNome').value.trim();
  const email = document.getElementById('cadEmail').value.trim();
  const senha = document.getElementById('cadSenha').value;
  if (!nome || !email || !senha) { mostrarErro('erroCadastro','Preencha todos os campos.'); return; }

  const resp = await apiPost('/auth/cadastrar', { nome, email, senha });
  if (!resp || !resp.ok) { mostrarErro('erroCadastro', resp?.data?.erro || 'Erro ao cadastrar.'); return; }

  const suc = document.getElementById('sucessoCadastro');
  suc.textContent = 'Conta criada! Faça login.';
  suc.classList.remove('hidden');
  setTimeout(() => {
    alternarForm();
    document.getElementById('loginEmail').value = email;
  }, 1500);
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (!document.getElementById('formLogin').classList.contains('hidden')) fazerLogin();
  else fazerCadastro();
});

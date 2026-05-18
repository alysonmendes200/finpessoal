// ===== FINPESSOAL - FUNÇÕES COMUNS =====

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const EMOJIS_CAT = {
  salario: '💼', freela: '💻', aluguel: '🏠', investimento: '📈',
  pensao: '👴', presente: '🎁', outros: '💰',
  moradia: '🏠', alimentacao: '🛒', transporte: '🚗', saude: '❤️',
  educacao: '📚', lazer: '🎮', assinaturas: '📺', fatura: '💳',
  servicos: '🔧', eletronicos: '📱', moveis: '🛋️', roupas: '👕',
  viagem: '✈️', veiculo: '🚗'
};

// Verificar autenticação
function verificarAuth() {
  if (!getToken()) {
    window.location.href = '/';
    return false;
  }
  return true;
}

// Sair
function sair() {
  localStorage.removeItem('fp_token');
  localStorage.removeItem('fp_usuario');
  window.location.href = '/';
}

// Formatar moeda
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(valor || 0);
}

// Preencher selects de mês/ano
function preencherMesAno(idMes, idAno, mesVal, anoVal) {
  const selMes = document.getElementById(idMes);
  const selAno = document.getElementById(idAno);
  if (!selMes || !selAno) return;

  selMes.innerHTML = '';
  MESES.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = m;
    if ((i + 1) === parseInt(mesVal)) opt.selected = true;
    selMes.appendChild(opt);
  });

  selAno.innerHTML = '';
  const anoAtual = new Date().getFullYear();
  for (let a = anoAtual - 2; a <= anoAtual + 2; a++) {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    if (a === parseInt(anoVal)) opt.selected = true;
    selAno.appendChild(opt);
  }
}

// Preencher selects de filtro (topbar)
function preencherFiltros() {
  const agora = new Date();
  preencherMesAno('selMes', 'selAno', agora.getMonth() + 1, agora.getFullYear());
}

// Obter mês/ano selecionados
function getMesSelecionado() {
  return document.getElementById('selMes')?.value || new Date().getMonth() + 1;
}

function getAnoSelecionado() {
  return document.getElementById('selAno')?.value || new Date().getFullYear();
}

// Saudação
function exibirSaudacao() {
  const usuario = getUsuario();
  const hora = new Date().getHours();
  let saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const el = document.getElementById('saudacao');
  if (el && usuario) el.textContent = `${saud}, ${usuario.nome.split(' ')[0]}! 👋`;
}

// Toggle sidebar mobile
function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('aberta');
  document.getElementById('overlay').classList.toggle('ativo');
}

function fecharMenu() {
  document.getElementById('sidebar').classList.remove('aberta');
  document.getElementById('overlay').classList.remove('ativo');
}

// Modal
function abrirModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
  const erroModal = document.getElementById('erroModal');
  if (erroModal) erroModal.classList.add('hidden');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

// Emoji da categoria
function emojiCat(cat) {
  return EMOJIS_CAT[cat] || '📌';
}

// Init comum
document.addEventListener('DOMContentLoaded', () => {
  if (!verificarAuth()) return;
  exibirSaudacao();
  preencherFiltros();
});

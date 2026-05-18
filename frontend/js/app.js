// ===== FINPESSOAL – FUNÇÕES COMUNS v2 =====

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const EMOJIS_CAT = {
  // receitas
  'Salário':'💼','Freelance / Bico':'💻','Aluguel recebido':'🏠',
  'Investimentos':'📈','Pensão / Benefício':'👴','Presente / Doação':'🎁',
  // despesas
  'Moradia':'🏠','Alimentação':'🛒','Transporte':'🚗','Saúde':'❤️',
  'Educação':'📚','Lazer':'🎮','Assinaturas':'📺','Fatura Cartão':'💳',
  'Serviços':'🔧','Vestuário':'👕','Higiene / Beleza':'🪥',
  // parcelamentos
  'Eletrônicos':'📱','Móveis / Casa':'🛋️','Roupas':'👗',
  'Viagem':'✈️','Veículo':'🚗','Acordo / Parcelamento':'📝','Venda':'💰',
  'Outros':'📌'
};

// Cache local de categorias (carregado 1x por página)
let _catsReceitas = [];
let _catsDespesas = [];
let _tiposDespesas = [];
let _configCarregado = false;

// ── Autenticação ─────────────────────────────────────────────────
function verificarAuth() {
  if (!getToken()) { window.location.href = '/'; return false; }
  return true;
}
function sair() {
  localStorage.removeItem('fp_token');
  localStorage.removeItem('fp_usuario');
  window.location.href = '/';
}

// ── Formatação ───────────────────────────────────────────────────
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(valor || 0);
}
function formatarData(ts) {
  if (!ts) return '–';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR');
}
function formatarDataHora(ts) {
  if (!ts) return '–';
  const d = new Date(ts);
  return d.toLocaleString('pt-BR');
}
function nomeDoMes(m) { return MESES[(parseInt(m) - 1)] || ''; }

// ── Emoji ────────────────────────────────────────────────────────
function emojiCat(cat) { return EMOJIS_CAT[cat] || '📌'; }

// ── Carrega configurações (categorias + tipos) da API ─────────────
async function carregarConfiguracoes() {
  if (_configCarregado) return;
  const resp = await apiGet('/configuracoes/tudo');
  if (!resp || !resp.ok) return;
  _catsReceitas  = resp.data.categorias_receitas  || [];
  _catsDespesas  = resp.data.categorias_despesas  || [];
  _tiposDespesas = resp.data.tipos_despesas       || [];
  _configCarregado = true;
}

// ── Preenche um <select> com array de { id, nome } ───────────────
function preencherSelect(idSelect, itens, valorSelecionado) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const atual = valorSelecionado ?? sel.value;
  sel.innerHTML = itens.map(i =>
    `<option value="${i.nome}" ${i.nome === atual ? 'selected' : ''}>${i.nome}</option>`
  ).join('');
}

function preencherSelectTipos(idSelect, valorSelecionado) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const atual = valorSelecionado ?? sel.value;
  sel.innerHTML = _tiposDespesas.map(t =>
    `<option value="${t.codigo}" ${t.codigo === atual ? 'selected' : ''}>${t.nome}</option>`
  ).join('');
}

// ── Selects de mês/ano ───────────────────────────────────────────
function preencherMesAno(idMes, idAno, mesVal, anoVal) {
  const selMes = document.getElementById(idMes);
  const selAno = document.getElementById(idAno);
  if (!selMes || !selAno) return;

  selMes.innerHTML = MESES.map((m, i) =>
    `<option value="${i+1}" ${(i+1) === parseInt(mesVal) ? 'selected' : ''}>${m}</option>`
  ).join('');

  const anoAtual = new Date().getFullYear();
  selAno.innerHTML = '';
  for (let a = anoAtual - 2; a <= anoAtual + 3; a++) {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    if (a === parseInt(anoVal)) opt.selected = true;
    selAno.appendChild(opt);
  }
}

function preencherFiltros() {
  const agora = new Date();
  preencherMesAno('selMes','selAno', agora.getMonth()+1, agora.getFullYear());
}

function getMesSelecionado() { return document.getElementById('selMes')?.value || new Date().getMonth()+1; }
function getAnoSelecionado()  { return document.getElementById('selAno')?.value || new Date().getFullYear(); }

// ── Saudação ─────────────────────────────────────────────────────
function exibirSaudacao() {
  const usuario = getUsuario();
  const hora    = new Date().getHours();
  const saud    = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const el      = document.getElementById('saudacao');
  if (el && usuario) el.textContent = `${saud}, ${usuario.nome.split(' ')[0]}! 👋`;
}

// ── Sidebar mobile ────────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('aberta');
  document.getElementById('overlay').classList.toggle('ativo');
}
function fecharMenu() {
  document.getElementById('sidebar').classList.remove('aberta');
  document.getElementById('overlay').classList.remove('ativo');
}

// ── Modal genérico ────────────────────────────────────────────────
function abrirModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
  const erroEl = document.getElementById('erroModal');
  if (erroEl) erroEl.classList.add('hidden');
}
function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

// ── Barra de diagnóstico ─────────────────────────────────────────
function renderDiagnostico(containerId, totalReceitas, totalGastos, saldo) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const pct = totalReceitas > 0
    ? Math.min((totalGastos / totalReceitas) * 100, 100)
    : 0;

  let classeBar = '';
  if (pct > 80) classeBar = 'vermelho';
  else if (pct > 50) classeBar = 'amarelo';

  let badgeClass, emoji, titulo, detalhe;
  if (saldo > 0) {
    const pctLivre = ((saldo / totalReceitas) * 100).toFixed(1);
    badgeClass = 'sucesso'; emoji = '🟢';
    titulo  = 'CONFIRMADO: Orçamento no azul.';
    detalhe = `Sobra líquida de ${formatarMoeda(saldo)} (${pctLivre}% livre)`;
  } else if (saldo === 0) {
    badgeClass = 'alerta'; emoji = '🟡';
    titulo  = 'ALERTA: Orçamento zerado.';
    detalhe = 'Vivendo no limite — sem margem para imprevistos';
  } else {
    badgeClass = 'perigo'; emoji = '🔴';
    titulo  = 'PERIGO: O dinheiro NÃO vai dar!';
    detalhe = `Faltam ${formatarMoeda(Math.abs(saldo))} para cobrir as contas`;
  }

  el.innerHTML = `
    <h3>🩺 Diagnóstico de Saúde Orçamentária</h3>
    <div class="diagnostico-badge ${badgeClass}">
      <span>${emoji}</span>
      <div>
        <div style="font-weight:800">${titulo}</div>
        <div style="font-weight:400;font-size:13px;opacity:0.9">${detalhe}</div>
      </div>
    </div>
    <div class="diag-row">
      <div class="barra-progresso">
        <div class="barra-fill ${classeBar}" style="width:${pct.toFixed(1)}%"></div>
      </div>
      <span class="diag-pct">${pct.toFixed(1)}% comprometido</span>
      <span class="diag-pct" style="color:var(--text-muted)">${formatarMoeda(totalGastos)} de ${formatarMoeda(totalReceitas)}</span>
    </div>`;
}

// ── Init de página ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!verificarAuth()) return;
  exibirSaudacao();
  preencherFiltros();
  await carregarConfiguracoes();
});

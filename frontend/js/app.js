// ===== FINPESSOAL – FUNÇÕES COMUNS v5 =====

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const EMOJIS_CAT = {
  'Salário':'💼','Freelance / Bico':'💻','Aluguel recebido':'🏠',
  'Investimentos':'📈','Pensão / Benefício':'👴','Presente / Doação':'🎁',
  'Moradia':'🏠','Alimentação':'🛒','Transporte':'🚗','Saúde':'❤️',
  'Educação':'📚','Lazer':'🎮','Assinaturas':'📺','Fatura Cartão':'💳',
  'Serviços':'🔧','Vestuário':'👕','Higiene / Beleza':'🪥',
  'Eletrônicos':'📱','Móveis / Casa':'🛋️','Roupas':'👗',
  'Viagem':'✈️','Veículo':'🚗','Acordo / Parcelamento':'📝','Venda':'💰',
  'Outros':'📌'
};

let _catsReceitas    = [];
let _catsDespesas    = [];
let _tiposDespesas   = [];
let _configCarregado = false;
let _configPromise   = null;

// ── Estado global de mês/ano ─────────────────────────────────────
const _MES_KEY = 'fp_mes';
const _ANO_KEY = 'fp_ano';

function getMesGlobal() { return parseInt(sessionStorage.getItem(_MES_KEY)) || new Date().getMonth() + 1; }
function getAnoGlobal() { return parseInt(sessionStorage.getItem(_ANO_KEY)) || new Date().getFullYear(); }
function setMesAnoGlobal(mes, ano) { sessionStorage.setItem(_MES_KEY, mes); sessionStorage.setItem(_ANO_KEY, ano); }
function getMesSelecionado() { return getMesGlobal(); }
function getAnoSelecionado() { return getAnoGlobal(); }

// ── Auth ─────────────────────────────────────────────────────────
function verificarAuth() {
  if (!getToken()) { window.location.href = '/'; return false; }
  // Admin não deve estar em páginas de usuário normal
  const u = getUsuario();
  if (u?.perfil === 'admin' && !window.location.pathname.includes('admin')) {
    window.location.href = '/pages/admin.html'; return false;
  }
  return true;
}

function sair() {
  localStorage.removeItem('fp_token');
  localStorage.removeItem('fp_usuario');
  sessionStorage.removeItem(_MES_KEY);
  sessionStorage.removeItem(_ANO_KEY);
  window.location.href = '/';
}

// ── Formatação ───────────────────────────────────────────────────
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0); }
function formatarData(ts) { return ts ? new Date(ts).toLocaleDateString('pt-BR') : '–'; }
function formatarDataHora(ts) { return ts ? new Date(ts).toLocaleString('pt-BR') : '–'; }
function nomeDoMes(m) { return MESES[(parseInt(m)-1)]||''; }
function emojiCat(cat) { return EMOJIS_CAT[cat]||'📌'; }

// ── Configurações ─────────────────────────────────────────────────
async function carregarConfiguracoes() {
  if (_configCarregado) return;
  if (_configPromise) return _configPromise;
  _configPromise = (async () => {
    const resp = await apiGet('/configuracoes/tudo');
    if (!resp || !resp.ok) return;
    _catsReceitas  = resp.data.categorias_receitas || [];
    _catsDespesas  = resp.data.categorias_despesas || [];
    _tiposDespesas = resp.data.tipos_despesas      || [];
    _configCarregado = true;
  })();
  return _configPromise;
}

// ── Selects ──────────────────────────────────────────────────────
function preencherSelect(idSelect, itens, valorSelecionado) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const atual = valorSelecionado ?? sel.value;
  sel.innerHTML = itens.map(i => `<option value="${i.nome}" ${i.nome===atual?'selected':''}>${i.nome}</option>`).join('');
}
function preencherMesAno(idMes, idAno, mesVal, anoVal) {
  const sM = document.getElementById(idMes);
  const sA = document.getElementById(idAno);
  if (!sM || !sA) return;
  sM.innerHTML = MESES.map((m,i) => `<option value="${i+1}" ${(i+1)===parseInt(mesVal)?'selected':''}>${m}</option>`).join('');
  const anoAtual = new Date().getFullYear();
  sA.innerHTML = '';
  for (let a = anoAtual-2; a <= anoAtual+3; a++) {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    if (a === parseInt(anoVal)) opt.selected = true;
    sA.appendChild(opt);
  }
}
function preencherFiltros() { preencherMesAno('selMes','selAno', getMesGlobal(), getAnoGlobal()); }

// ── Avatar sidebar ────────────────────────────────────────────────
function renderizarSidebarUser() {
  const usuario   = getUsuario();
  const container = document.getElementById('sidebarUser');
  if (!usuario || !container) return;
  const ini = usuario.nome ? usuario.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() : '?';
  const avatarHtml = usuario.foto_url
    ? `<div class="sidebar-avatar"><img src="${usuario.foto_url}" alt="avatar" onerror="this.style.display='none'" /></div>`
    : `<div class="sidebar-avatar">${ini}</div>`;
  container.innerHTML = `
    ${avatarHtml}
    <div class="sidebar-user-info">
      <div class="sidebar-user-nome">${usuario.nome}</div>
      <div class="sidebar-user-email">${usuario.email}</div>
    </div>`;
}

// ── Seletor de mês na sidebar (mobile) ───────────────────────────
function renderizarSidebarMesSel(callbackAoMudar) {
  const container = document.getElementById('sidebarMesSel');
  if (!container) return;
  const mesAtual = getMesGlobal(), anoAtual = getAnoGlobal(), anoBase = new Date().getFullYear();
  const opsMes = MESES.map((m,i) => `<option value="${i+1}" ${(i+1)===mesAtual?'selected':''}>${m}</option>`).join('');
  let opsAno = '';
  for (let a = anoBase-2; a <= anoBase+3; a++) opsAno += `<option value="${a}" ${a===anoAtual?'selected':''}>${a}</option>`;
  container.innerHTML = `
    <div class="sidebar-mes-titulo">📅 Mês de referência</div>
    <div class="sidebar-mes-selects">
      <select id="sbMes" onchange="onSidebarMesChange()">${opsMes}</select>
      <select id="sbAno" onchange="onSidebarMesChange()">${opsAno}</select>
    </div>`;
  window._onMesChange = callbackAoMudar || null;
}
function onSidebarMesChange() {
  const mes = parseInt(document.getElementById('sbMes')?.value) || getMesGlobal();
  const ano = parseInt(document.getElementById('sbAno')?.value) || getAnoGlobal();
  setMesAnoGlobal(mes, ano);
  const sM = document.getElementById('selMes'); const sA = document.getElementById('selAno');
  if (sM) sM.value = mes; if (sA) sA.value = ano;
  if (typeof window._onMesChange === 'function') window._onMesChange();
}
function onTopbarMesChange(callback) {
  const mes = parseInt(document.getElementById('selMes')?.value) || getMesGlobal();
  const ano = parseInt(document.getElementById('selAno')?.value) || getAnoGlobal();
  setMesAnoGlobal(mes, ano);
  const sM = document.getElementById('sbMes'); const sA = document.getElementById('sbAno');
  if (sM) sM.value = mes; if (sA) sA.value = ano;
  if (typeof callback === 'function') callback();
}

// ── Aviso de licença ──────────────────────────────────────────────
function exibirAvisoLicenca() {
  const u = getUsuario();
  if (!u || u.perfil === 'admin' || !u.licenca_ate) return;

  const hoje      = new Date();
  const expiracao = new Date(u.licenca_ate);
  expiracao.setHours(23, 59, 59, 999);
  const diasRestantes = Math.ceil((expiracao - hoje) / (1000 * 60 * 60 * 24));

  if (diasRestantes > 7) return; // sem aviso se > 7 dias

  const banner = document.createElement('div');
  banner.className = 'licenca-banner';

  if (diasRestantes <= 0) {
    banner.className += ' licenca-expirada';
    banner.innerHTML = `⏰ <strong>Licença expirada!</strong> Entre em contato com o administrador para renovar.`;
  } else if (diasRestantes === 1) {
    banner.className += ' licenca-urgente';
    banner.innerHTML = `⚠️ <strong>Sua licença expira HOJE!</strong> Renove agora para não perder o acesso.`;
  } else {
    banner.className += ' licenca-aviso';
    banner.innerHTML = `⚠️ <strong>Licença expira em ${diasRestantes} dias</strong> (${new Date(u.licenca_ate).toLocaleDateString('pt-BR')}). Renove em breve.`;
  }

  // Insere antes do .page-content
  const pc = document.querySelector('.page-content');
  if (pc) pc.prepend(banner);
}

// ── Saudação ─────────────────────────────────────────────────────
function exibirSaudacao() {
  const usuario = getUsuario();
  const hora    = new Date().getHours();
  const saud    = hora<12?'Bom dia':hora<18?'Boa tarde':'Boa noite';
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

// ── Modal ─────────────────────────────────────────────────────────
function abrirModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
  const e = document.getElementById('erroModal');
  if (e) e.classList.add('hidden');
}
function fecharModal() { document.getElementById('modalOverlay').classList.add('hidden'); }

// ── Diagnóstico ───────────────────────────────────────────────────
function renderDiagnostico(containerId, totalReceitas, totalGastos, saldo) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pct = totalReceitas > 0 ? Math.min((totalGastos/totalReceitas)*100,100) : 0;
  const classeBar = pct>80?'vermelho':pct>50?'amarelo':'';
  let badgeClass, emoji, titulo, detalhe;
  if (saldo > 0) {
    const pL = ((saldo/totalReceitas)*100).toFixed(1);
    badgeClass='sucesso'; emoji='🟢'; titulo='CONFIRMADO: Orçamento no azul.';
    detalhe=`Sobra líquida de ${formatarMoeda(saldo)} (${pL}% livre)`;
  } else if (saldo===0) {
    badgeClass='alerta'; emoji='🟡'; titulo='ALERTA: Orçamento zerado.';
    detalhe='Vivendo no limite — sem margem para imprevistos';
  } else {
    badgeClass='perigo'; emoji='🔴'; titulo='PERIGO: O dinheiro NÃO vai dar!';
    detalhe=`Faltam ${formatarMoeda(Math.abs(saldo))} para cobrir as contas`;
  }
  el.innerHTML = `
    <h3>🩺 Diagnóstico de Saúde Orçamentária</h3>
    <div class="diagnostico-badge ${badgeClass}">
      <span>${emoji}</span>
      <div><div style="font-weight:800">${titulo}</div>
      <div style="font-weight:400;font-size:13px;opacity:0.9">${detalhe}</div></div>
    </div>
    <div class="diag-row">
      <div class="barra-progresso"><div class="barra-fill ${classeBar}" style="width:${pct.toFixed(1)}%"></div></div>
      <span class="diag-pct">${pct.toFixed(1)}% comprometido</span>
      <span class="diag-pct" style="color:var(--text-muted)">${formatarMoeda(totalGastos)} de ${formatarMoeda(totalReceitas)}</span>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!verificarAuth()) return;
  exibirSaudacao();
  renderizarSidebarUser();
  preencherFiltros();
  exibirAvisoLicenca();
  await carregarConfiguracoes();
});

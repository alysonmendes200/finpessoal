// ===== FINPESSOAL – PAINEL ADMIN =====

let _usuarios    = [];  // cache completo
let _filtrados   = [];  // após filtros
let _uidLicenca  = null;
let _tabLicenca  = 'dias';
let _uidConfirm  = null;
let _acaoConfirm = null;

// ── Inicialização ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Verifica autenticação e perfil admin
  const token   = getToken();
  const usuario = getUsuario();
  if (!token || !usuario) { window.location.href = '/'; return; }
  if (usuario.perfil !== 'admin') { window.location.href = '/pages/dashboard.html'; return; }

  // Exibe nome do admin na sidebar
  const sidebarUser = document.getElementById('sidebarUser');
  if (sidebarUser) {
    const ini = usuario.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
    sidebarUser.innerHTML = `
      <div class="sidebar-avatar">${ini}</div>
      <div class="sidebar-user-info">
        <div class="sidebar-user-nome">${usuario.nome}</div>
        <div class="sidebar-user-email">Administrador</div>
      </div>`;
  }

  await carregarUsuarios();
});

// ── Carregar dados ────────────────────────────────────────────────
async function carregarUsuarios() {
  const [statsResp, usersResp] = await Promise.all([
    apiGet('/admin/stats'),
    apiGet('/admin/usuarios')
  ]);

  if (statsResp?.ok) {
    const s = statsResp.data;
    document.getElementById('statTotal').textContent      = s.users      || 0;
    document.getElementById('statAtivas').textContent     = s.ativas     || 0;
    document.getElementById('statExpiradas').textContent  = s.expiradas  || 0;
    document.getElementById('statBloqueados').textContent = s.bloqueados || 0;
  }

  if (usersResp?.ok) {
    _usuarios = usersResp.data;
    filtrarTabela();
  }
}

// ── Filtro da tabela ──────────────────────────────────────────────
function filtrarTabela() {
  const busca     = document.getElementById('buscaUsuario').value.toLowerCase();
  const situacao  = document.getElementById('filtroSituacao').value;

  _filtrados = _usuarios.filter(u => {
    const matchBusca = !busca || u.nome.toLowerCase().includes(busca) || u.email.toLowerCase().includes(busca);
    const matchSit   = !situacao || u.situacao === situacao;
    return matchBusca && matchSit;
  });

  renderTabela(_filtrados);
}

// ── Render tabela ─────────────────────────────────────────────────
function renderTabela(lista) {
  const tbody = document.getElementById('corpoTabela');

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(u => {
    const sit   = situacaoBadge(u.situacao);
    const dtLic = u.licenca_ate ? new Date(u.licenca_ate).toLocaleDateString('pt-BR') : '–';
    const dias  = u.dias_licenca !== null
      ? (u.dias_licenca >= 0 ? `+${u.dias_licenca}d` : `${u.dias_licenca}d`)
      : '–';
    const dtCad = new Date(u.criado_em).toLocaleDateString('pt-BR');

    const btnBloquear = u.bloqueado
      ? `<button class="btn-acao success" onclick="confirmarAcao(${u.id},'desbloquear','${esc(u.nome)}')" title="Desbloquear">🔓</button>`
      : `<button class="btn-acao danger"  onclick="confirmarAcao(${u.id},'bloquear','${esc(u.nome)}')"   title="Bloquear">🔒</button>`;

    return `<tr>
      <td><strong>${esc(u.nome)}</strong></td>
      <td style="color:var(--text-muted)">${esc(u.email)}</td>
      <td>${u.perfil === 'admin' ? '<span class="badge" style="background:#fef9c3;color:#854d0e">Admin</span>' : '<span class="badge badge-fixo">User</span>'}</td>
      <td>${sit}</td>
      <td>${dtLic}</td>
      <td style="${u.dias_licenca !== null && u.dias_licenca < 0 ? 'color:var(--red)' : u.dias_licenca !== null && u.dias_licenca <= 7 ? 'color:var(--amber)' : ''}">${dias}</td>
      <td style="color:var(--text-muted)">${dtCad}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn-acao" onclick="abrirLicenca(${u.id},'${esc(u.nome)}')" title="Licença">🗓️</button>
          ${u.perfil !== 'admin' ? btnBloquear : ''}
          ${u.perfil !== 'admin' ? `<button class="btn-acao danger" onclick="confirmarAcao(${u.id},'excluir','${esc(u.nome)}')" title="Excluir">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function esc(str) { return (str||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }

function situacaoBadge(sit) {
  const mapa = {
    admin:       '<span class="badge" style="background:#fef9c3;color:#854d0e">Admin</span>',
    ativa:       '<span class="badge" style="background:var(--green-lt);color:var(--green)">✅ Ativa</span>',
    expirando:   '<span class="badge" style="background:#fef3c7;color:var(--amber)">⚠️ Expirando</span>',
    expirada:    '<span class="badge" style="background:var(--red-lt);color:var(--red)">❌ Expirada</span>',
    sem_licenca: '<span class="badge" style="background:#f1f5f9;color:var(--text-muted)">⭕ Sem licença</span>',
    bloqueado:   '<span class="badge" style="background:#fce7f3;color:#be185d">🚫 Bloqueado</span>'
  };
  return mapa[sit] || sit;
}

// ── Modal Licença ─────────────────────────────────────────────────
function abrirLicenca(uid, nome) {
  _uidLicenca = uid;
  document.getElementById('licNome').textContent = nome;
  document.getElementById('erroLicenca').classList.add('hidden');
  document.getElementById('inputDias').value = '';
  document.getElementById('inputData').value = '';
  // Preenche data com licença atual do usuário
  const u = _usuarios.find(x => x.id === uid);
  if (u?.licenca_ate) {
    document.getElementById('inputData').value = u.licenca_ate.split('T')[0];
  }
  document.getElementById('modalLicenca').classList.remove('hidden');
}
function fecharModalLicenca() {
  document.getElementById('modalLicenca').classList.add('hidden');
  _uidLicenca = null;
}
function trocarTabLic(tab, btn) {
  _tabLicenca = tab;
  document.getElementById('tabDias').style.display = tab === 'dias' ? '' : 'none';
  document.getElementById('tabData').style.display = tab === 'data' ? '' : 'none';
  document.querySelectorAll('.admin-lic-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
function setDias(n) {
  document.getElementById('inputDias').value = n;
}
async function salvarLicenca() {
  if (!_uidLicenca) return;
  const erroEl = document.getElementById('erroLicenca');
  erroEl.classList.add('hidden');

  let body;
  if (_tabLicenca === 'dias') {
    const dias = parseInt(document.getElementById('inputDias').value);
    if (!dias || dias < 1) {
      erroEl.textContent = 'Informe o número de dias (mínimo 1).';
      erroEl.classList.remove('hidden'); return;
    }
    body = { dias };
  } else {
    const data = document.getElementById('inputData').value;
    if (!data) {
      erroEl.textContent = 'Selecione uma data.'; erroEl.classList.remove('hidden'); return;
    }
    body = { licenca_ate: data };
  }

  const resp = await apiPut(`/admin/usuarios/${_uidLicenca}/licenca`, body);
  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar licença.';
    erroEl.classList.remove('hidden'); return;
  }
  fecharModalLicenca();
  carregarUsuarios();
}
async function removerLicenca() {
  if (!_uidLicenca) return;
  const resp = await apiPut(`/admin/usuarios/${_uidLicenca}/licenca`, { licenca_ate: null });
  if (resp?.ok) { fecharModalLicenca(); carregarUsuarios(); }
}

// ── Modal Confirmação ─────────────────────────────────────────────
function confirmarAcao(uid, acao, nome) {
  _uidConfirm  = uid;
  _acaoConfirm = acao;
  const msgs = {
    bloquear:    [`🔒 Bloquear usuário`,    `O usuário <strong>${nome}</strong> perderá o acesso imediatamente.`],
    desbloquear: [`🔓 Desbloquear usuário`, `O usuário <strong>${nome}</strong> poderá acessar novamente.`],
    excluir:     [`🗑️ Excluir usuário`,     `Todos os dados de <strong>${nome}</strong> serão apagados permanentemente. Essa ação não pode ser desfeita.`]
  };
  const [titulo, msg] = msgs[acao] || ['Confirmar', 'Deseja continuar?'];
  document.getElementById('confirmTitulo').textContent = titulo;
  document.getElementById('confirmMsg').innerHTML      = msg;
  document.getElementById('btnConfirm').className = acao === 'excluir'
    ? 'btn-primario btn-danger'
    : 'btn-primario';
  document.getElementById('modalConfirm').classList.remove('hidden');
}
function fecharConfirm() {
  document.getElementById('modalConfirm').classList.add('hidden');
  _uidConfirm = null; _acaoConfirm = null;
}
async function executarConfirm() {
  if (!_uidConfirm || !_acaoConfirm) return;
  let resp;
  if (_acaoConfirm === 'bloquear') {
    resp = await apiPut(`/admin/usuarios/${_uidConfirm}/bloquear`, { bloqueado: true });
  } else if (_acaoConfirm === 'desbloquear') {
    resp = await apiPut(`/admin/usuarios/${_uidConfirm}/bloquear`, { bloqueado: false });
  } else if (_acaoConfirm === 'excluir') {
    resp = await apiDelete(`/admin/usuarios/${_uidConfirm}`);
  }
  fecharConfirm();
  if (resp?.ok) carregarUsuarios();
}

// ── Sidebar mobile admin (simplificada) ──────────────────────────
function toggleMenuAdmin() {
  document.getElementById('sidebar').classList.toggle('aberta');
  document.getElementById('overlay').classList.toggle('ativo');
}
function fecharMenuAdmin() {
  document.getElementById('sidebar').classList.remove('aberta');
  document.getElementById('overlay').classList.remove('ativo');
}
function sairAdmin() {
  localStorage.removeItem('fp_token');
  localStorage.removeItem('fp_usuario');
  window.location.href = '/';
}

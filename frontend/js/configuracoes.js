// ===== FINPESSOAL – CONFIGURAÇÕES JS =====

let _tipoModal    = null;  // 'receita' | 'despesa'
let _editandoCatId = null;
let _editandoTipoId = null;

// ── Inicialização ─────────────────────────────────────────────────
async function carregarPagina() {
  const resp = await apiGet('/configuracoes/tudo');
  if (!resp || !resp.ok) return;

  const d = resp.data;
  renderCatReceitas(d.categorias_receitas);
  renderCatDespesas(d.categorias_despesas);
  renderTipos(d.tipos_despesas);
  renderBackup(d.ultimo_backup);

  const u = getUsuario();
  if (u) {
    document.getElementById('infoUsuario').textContent =
      `Nome: ${u.nome} · E-mail: ${u.email}`;
  }
}

// ── Backup Status ─────────────────────────────────────────────────
function renderBackup(backup) {
  const el = document.getElementById('backupStatus');
  if (!backup) {
    el.textContent = 'Nenhum backup registrado ainda. O primeiro ocorre 5s após o servidor iniciar.';
    return;
  }
  const dt = new Date(backup.realizado_em);
  const fmt = dt.toLocaleString('pt-BR');
  el.innerHTML = `Último backup automático realizado em: <strong>${fmt}</strong>
    &nbsp;·&nbsp; Status: <strong style="color:var(--green)">${backup.status}</strong>`;
}

// ── CATEGORIAS DE RECEITAS ────────────────────────────────────────
function renderCatReceitas(lista) {
  const el = document.getElementById('listaCatReceitas');
  if (!lista?.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Nenhuma categoria cadastrada.</p>';
    return;
  }
  el.innerHTML = lista.map(c => `
    <div class="config-item">
      <span class="item-emoji">💰</span>
      <span class="config-item-nome">${c.nome}</span>
      <div class="item-acoes">
        <button class="btn-acao" onclick="editarCatReceita(${c.id},'${c.nome.replace(/'/g,"\\'")}')">✏️</button>
        <button class="btn-acao danger" onclick="deletarCatReceita(${c.id})">🗑️</button>
      </div>
    </div>`).join('');
}

function editarCatReceita(id, nome) {
  _tipoModal     = 'receita';
  _editandoCatId = id;
  document.getElementById('modalCatTitulo').textContent = 'Editar Categoria de Receita';
  document.getElementById('catNome').value = nome;
  document.getElementById('erroCat').classList.add('hidden');
  document.getElementById('modalCatOverlay').classList.remove('hidden');
}

async function deletarCatReceita(id) {
  if (!confirm('Remover esta categoria?')) return;
  const resp = await apiDelete(`/configuracoes/categorias-receitas/${id}`);
  if (resp?.ok) carregarPagina();
}

// ── CATEGORIAS DE DESPESAS ────────────────────────────────────────
function renderCatDespesas(lista) {
  const el = document.getElementById('listaCatDespesas');
  if (!lista?.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Nenhuma categoria cadastrada.</p>';
    return;
  }
  el.innerHTML = lista.map(c => `
    <div class="config-item">
      <span class="item-emoji">💳</span>
      <span class="config-item-nome">${c.nome}</span>
      <div class="item-acoes">
        <button class="btn-acao" onclick="editarCatDespesa(${c.id},'${c.nome.replace(/'/g,"\\'")}')">✏️</button>
        <button class="btn-acao danger" onclick="deletarCatDespesa(${c.id})">🗑️</button>
      </div>
    </div>`).join('');
}

function editarCatDespesa(id, nome) {
  _tipoModal     = 'despesa';
  _editandoCatId = id;
  document.getElementById('modalCatTitulo').textContent = 'Editar Categoria de Despesa';
  document.getElementById('catNome').value = nome;
  document.getElementById('erroCat').classList.add('hidden');
  document.getElementById('modalCatOverlay').classList.remove('hidden');
}

async function deletarCatDespesa(id) {
  if (!confirm('Remover esta categoria?')) return;
  const resp = await apiDelete(`/configuracoes/categorias-despesas/${id}`);
  if (resp?.ok) carregarPagina();
}

// ── TIPOS DE DESPESAS ─────────────────────────────────────────────
function renderTipos(lista) {
  const el = document.getElementById('listaTipos');
  if (!lista?.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Nenhum tipo cadastrado.</p>';
    return;
  }
  el.innerHTML = lista.map(t => `
    <div class="config-item">
      <span class="item-emoji">🏷️</span>
      <span class="config-item-nome">${t.nome}</span>
      <span class="config-item-codigo">(${t.codigo})</span>
      <div class="item-acoes">
        <button class="btn-acao" onclick="editarTipo(${t.id},'${t.nome.replace(/'/g,"\\'")}','${t.codigo}')">✏️</button>
        <button class="btn-acao danger" onclick="deletarTipo(${t.id})">🗑️</button>
      </div>
    </div>`).join('');
}

async function deletarTipo(id) {
  if (!confirm('Remover este tipo?')) return;
  const resp = await apiDelete(`/configuracoes/tipos-despesas/${id}`);
  if (resp?.ok) carregarPagina();
}

function editarTipo(id, nome, codigo) {
  _editandoTipoId = id;
  document.getElementById('modalTipoTitulo').textContent = 'Editar Tipo de Despesa';
  document.getElementById('tipoNome').value   = nome;
  document.getElementById('tipoCodigo').value = codigo;
  document.getElementById('erroTipo').classList.add('hidden');
  document.getElementById('modalTipoOverlay').classList.remove('hidden');
}

// ── Modais de Categoria ───────────────────────────────────────────
function abrirModalCategoria(tipo) {
  _tipoModal     = tipo;
  _editandoCatId = null;
  document.getElementById('modalCatTitulo').textContent =
    tipo === 'receita' ? 'Nova Categoria de Receita' : 'Nova Categoria de Despesa';
  document.getElementById('catNome').value = '';
  document.getElementById('erroCat').classList.add('hidden');
  document.getElementById('modalCatOverlay').classList.remove('hidden');
}
function fecharModalCat() {
  document.getElementById('modalCatOverlay').classList.add('hidden');
  _editandoCatId = null;
}

async function salvarCategoria() {
  const erroEl = document.getElementById('erroCat');
  erroEl.classList.add('hidden');
  const nome = document.getElementById('catNome').value.trim();
  if (!nome) { erroEl.textContent = 'Digite um nome.'; erroEl.classList.remove('hidden'); return; }

  const endpoint = _tipoModal === 'receita'
    ? '/configuracoes/categorias-receitas'
    : '/configuracoes/categorias-despesas';

  const resp = _editandoCatId
    ? await apiPut(`${endpoint}/${_editandoCatId}`, { nome })
    : await apiPost(endpoint, { nome });

  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.remove('hidden'); return;
  }
  fecharModalCat();
  carregarPagina();
}

// ── Modais de Tipo ────────────────────────────────────────────────
function abrirModalTipo() {
  _editandoTipoId = null;
  document.getElementById('modalTipoTitulo').textContent = 'Novo Tipo de Despesa';
  document.getElementById('tipoNome').value   = '';
  document.getElementById('tipoCodigo').value = '';
  document.getElementById('erroTipo').classList.add('hidden');
  document.getElementById('modalTipoOverlay').classList.remove('hidden');
}
function fecharModalTipo() {
  document.getElementById('modalTipoOverlay').classList.add('hidden');
  _editandoTipoId = null;
}

async function salvarTipo() {
  const erroEl = document.getElementById('erroTipo');
  erroEl.classList.add('hidden');
  const nome   = document.getElementById('tipoNome').value.trim();
  const codigo = document.getElementById('tipoCodigo').value.trim().toLowerCase().replace(/\s+/g,'_');
  if (!nome || (!_editandoTipoId && !codigo)) {
    erroEl.textContent = 'Preencha nome e código.'; erroEl.classList.remove('hidden'); return;
  }

  const resp = _editandoTipoId
    ? await apiPut(`/configuracoes/tipos-despesas/${_editandoTipoId}`, { nome })
    : await apiPost('/configuracoes/tipos-despesas', { nome, codigo });

  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.'; erroEl.classList.remove('hidden'); return;
  }
  fecharModalTipo();
  carregarPagina();
}

document.addEventListener('DOMContentLoaded', () => { setTimeout(carregarPagina, 150); });

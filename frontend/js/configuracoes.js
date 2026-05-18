// ===== FINPESSOAL – CONFIGURAÇÕES v3 (Accordion) =====

let _tipoModal     = null;   // 'receita' | 'despesa'
let _editandoCatId = null;

// ── Accordion ─────────────────────────────────────────────────────
const _accordionState = {};   // { perfil: false, catRec: false, ... }

function toggleAccordion(id) {
  const corpo = document.getElementById(`corpo-${id}`);
  const chev  = document.getElementById(`chev-${id}`);
  const header = corpo.previousElementSibling;

  const abrindo = !_accordionState[id];
  _accordionState[id] = abrindo;

  corpo.classList.toggle('aberto', abrindo);
  chev.classList.toggle('aberto', abrindo);
  header.classList.toggle('aberto', abrindo);
}

// ── Inicialização ─────────────────────────────────────────────────
async function carregarPagina() {
  const resp = await apiGet('/configuracoes/tudo');
  if (!resp || !resp.ok) return;

  const d = resp.data;
  renderCatReceitas(d.categorias_receitas);
  renderCatDespesas(d.categorias_despesas);
  renderBackup(d.ultimo_backup);
  carregarPerfil();
}

// ── PERFIL ────────────────────────────────────────────────────────
async function carregarPerfil() {
  const resp = await apiGet('/auth/perfil');
  if (!resp || !resp.ok) return;
  const u = resp.data;

  document.getElementById('perfilNome').value    = u.nome    || '';
  document.getElementById('perfilFotoUrl').value = u.foto_url || '';

  atualizarPreviewPerfil(u.nome, u.email, u.foto_url);
}

function atualizarPreviewPerfil(nome, email, fotoUrl) {
  document.getElementById('perfilNomePreview').textContent  = nome  || '–';
  document.getElementById('perfilEmailPreview').textContent = email || '–';

  const avatar = document.getElementById('perfilAvatarPreview');
  if (fotoUrl) {
    avatar.innerHTML = `<img src="${fotoUrl}" alt="Foto" onerror="this.parentElement.innerHTML='${(nome||'?')[0].toUpperCase()}'" />`;
  } else {
    avatar.textContent = nome ? nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() : '?';
  }
}

function previewFoto() {
  const url  = document.getElementById('perfilFotoUrl').value.trim();
  const nome = document.getElementById('perfilNome').value.trim();
  const u    = getUsuario();
  atualizarPreviewPerfil(nome || u?.nome, u?.email, url);
}

async function salvarPerfil() {
  const erroEl = document.getElementById('erroSucesoPerfil');
  erroEl.classList.remove('alerta-erro','alerta-sucesso','hidden');

  const nome       = document.getElementById('perfilNome').value.trim();
  const foto_url   = document.getElementById('perfilFotoUrl').value.trim();
  const senhaAtual = document.getElementById('perfilSenhaAtual').value;
  const novaSenha  = document.getElementById('perfilNovaSenha').value;

  if (!nome) {
    erroEl.textContent = 'O nome não pode ficar vazio.';
    erroEl.classList.add('alerta-erro');
    erroEl.classList.remove('hidden');
    return;
  }

  const corpo = { nome, foto_url: foto_url || null };
  if (novaSenha) { corpo.senha_atual = senhaAtual; corpo.nova_senha = novaSenha; }

  const resp = await apiPut('/auth/perfil', corpo);

  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.add('alerta-erro');
    erroEl.classList.remove('hidden');
    return;
  }

  // Atualiza token e dados em localStorage
  localStorage.setItem('fp_token', resp.data.token);
  localStorage.setItem('fp_usuario', JSON.stringify(resp.data.usuario));

  // Atualiza sidebar imediatamente
  renderizarSidebarUser();

  // Limpa campos de senha
  document.getElementById('perfilSenhaAtual').value = '';
  document.getElementById('perfilNovaSenha').value  = '';

  // Exibe sucesso
  erroEl.textContent = '✅ Perfil salvo com sucesso!';
  erroEl.classList.add('alerta-sucesso');
  erroEl.classList.remove('hidden');

  // Atualiza preview
  atualizarPreviewPerfil(resp.data.usuario.nome, resp.data.usuario.email, resp.data.usuario.foto_url);

  setTimeout(() => erroEl.classList.add('hidden'), 3000);
}

// ── BACKUP ────────────────────────────────────────────────────────
function renderBackup(backup) {
  const el = document.getElementById('backupStatus');
  if (!backup) {
    el.textContent = 'Nenhum backup registrado ainda. O primeiro ocorre ~5s após o servidor iniciar.';
    return;
  }
  const fmt = new Date(backup.realizado_em).toLocaleString('pt-BR');
  el.innerHTML = `Último backup automático realizado em: <strong>${fmt}</strong>
    &nbsp;·&nbsp; Status: <strong style="color:var(--green)">${backup.status}</strong>`;
}

// ── CATEGORIAS DE RECEITAS ────────────────────────────────────────
function renderCatReceitas(lista) {
  const el = document.getElementById('listaCatReceitas');
  if (!lista?.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhuma categoria cadastrada.</p>';
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
  _tipoModal = 'receita'; _editandoCatId = id;
  document.getElementById('modalCatTitulo').textContent = 'Editar Categoria de Receita';
  document.getElementById('catNome').value = nome;
  document.getElementById('erroCat').classList.add('hidden');
  document.getElementById('modalCatOverlay').classList.remove('hidden');
}

async function deletarCatReceita(id) {
  if (!confirm('Remover esta categoria? Receitas já lançadas não serão afetadas.')) return;
  const resp = await apiDelete(`/configuracoes/categorias-receitas/${id}`);
  if (resp?.ok) carregarPagina();
}

// ── CATEGORIAS DE DESPESAS ────────────────────────────────────────
function renderCatDespesas(lista) {
  const el = document.getElementById('listaCatDespesas');
  if (!lista?.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhuma categoria cadastrada.</p>';
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
  _tipoModal = 'despesa'; _editandoCatId = id;
  document.getElementById('modalCatTitulo').textContent = 'Editar Categoria de Despesa';
  document.getElementById('catNome').value = nome;
  document.getElementById('erroCat').classList.add('hidden');
  document.getElementById('modalCatOverlay').classList.remove('hidden');
}

async function deletarCatDespesa(id) {
  if (!confirm('Remover esta categoria? Despesas já lançadas não serão afetadas.')) return;
  const resp = await apiDelete(`/configuracoes/categorias-despesas/${id}`);
  if (resp?.ok) carregarPagina();
}

// ── Modal Categoria ───────────────────────────────────────────────
function abrirModalCategoria(tipo) {
  _tipoModal = tipo; _editandoCatId = null;
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

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { setTimeout(carregarPagina, 150); });

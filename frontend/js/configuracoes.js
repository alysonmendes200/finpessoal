// ===== FINPESSOAL – CONFIGURAÇÕES v5 (Upload Base64) =====

let _tipoModal     = null;
let _editandoCatId = null;

// ══════════════════════════════════════════════════════════════════
// ACCORDION
// ══════════════════════════════════════════════════════════════════
const _accordionState = {};

function toggleAccordion(id) {
  const corpo  = document.getElementById(`corpo-${id}`);
  const chev   = document.getElementById(`chev-${id}`);
  const header = corpo.previousElementSibling;
  const abrindo = !_accordionState[id];
  _accordionState[id] = abrindo;
  corpo.classList.toggle('aberto', abrindo);
  chev.classList.toggle('aberto', abrindo);
  header.classList.toggle('aberto', abrindo);
}

// ══════════════════════════════════════════════════════════════════
// INIT – tudo em paralelo
// ══════════════════════════════════════════════════════════════════
async function carregarPagina() {
  const [confResp, perfilResp] = await Promise.all([
    apiGet('/configuracoes/tudo'),
    apiGet('/auth/perfil')
  ]);

  if (confResp?.ok) {
    renderCatReceitas(confResp.data.categorias_receitas);
    renderCatDespesas(confResp.data.categorias_despesas);
    renderBackup(confResp.data.ultimo_backup);
  }
  if (perfilResp?.ok) {
    const u = perfilResp.data;
    document.getElementById('perfilNome').value  = u.nome  || '';
    document.getElementById('perfilEmail').value = u.email || '';
    atualizarPreviewAvatar(u.nome, u.email, u.foto_url);
  }
}

// ══════════════════════════════════════════════════════════════════
// PERFIL – AVATAR
// ══════════════════════════════════════════════════════════════════
function iniciais(nome) {
  if (!nome) return '?';
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function atualizarPreviewAvatar(nome, email, fotoUrl) {
  const nomeEl  = document.getElementById('perfilNomePreview');
  const emailEl = document.getElementById('perfilEmailPreview');
  if (nomeEl)  nomeEl.textContent  = nome  || '–';
  if (emailEl) emailEl.textContent = email || '–';

  const avatar = document.getElementById('perfilAvatarPreview');
  if (!avatar) return;

  if (fotoUrl) {
    avatar.innerHTML = '';
    const img = document.createElement('img');
    img.src     = fotoUrl;
    img.alt     = 'Foto de perfil';
    img.onerror = () => {
      avatar.innerHTML    = '';
      avatar.textContent  = iniciais(nome);
      avatar.classList.remove('tem-foto');
    };
    avatar.appendChild(img);
    avatar.classList.add('tem-foto');
  } else {
    avatar.innerHTML    = '';
    avatar.textContent  = iniciais(nome);
    avatar.classList.remove('tem-foto');
  }
}

// ══════════════════════════════════════════════════════════════════
// UPLOAD DE FOTO VIA BASE64
// Converte a imagem no browser, comprime se necessário, envia como JSON.
// Funciona em qualquer host (Render, Vercel, etc.) sem filesystem.
// ══════════════════════════════════════════════════════════════════
async function previewEUploadFoto(input) {
  if (!input.files || !input.files[0]) return;

  const file  = input.files[0];
  const maxMB = 10; // limite de leitura (o backend rejeita > ~600 KB em base64)

  if (file.size > maxMB * 1024 * 1024) {
    mostrarStatus('uploadStatus', `❌ Arquivo muito grande. Máximo ${maxMB} MB.`, 'erro');
    input.value = ''; return;
  }

  // ── 1. Preview instantâneo ─────────────────────────────────────
  const objectUrl = URL.createObjectURL(file);
  const avatar    = document.getElementById('perfilAvatarPreview');
  avatar.innerHTML = '';
  const imgPrev = document.createElement('img');
  imgPrev.src = objectUrl; imgPrev.alt = 'Preview';
  avatar.appendChild(imgPrev);
  avatar.classList.add('tem-foto');

  const label = document.querySelector('.perfil-upload-label');
  if (label) label.classList.add('carregando');
  mostrarStatus('uploadStatus', '⏳ Processando imagem...', 'info');
  mostrarProgressBar(30);

  try {
    // ── 2. Comprime e converte para base64 via Canvas ─────────────
    const base64 = await comprimirParaBase64(file, 800, 0.75);
    mostrarProgressBar(70);
    mostrarStatus('uploadStatus', '⏳ Enviando...', 'info');

    // ── 3. Envia como JSON para o backend ─────────────────────────
    const resp = await apiFetch('/auth/upload-foto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foto_base64: base64 })
    });

    URL.revokeObjectURL(objectUrl);
    if (label) label.classList.remove('carregando');
    ocultarProgressBar();
    input.value = '';

    if (resp && resp.ok) {
      // Persiste token e usuário atualizados
      if (resp.data.token && resp.data.usuario) {
        localStorage.setItem('fp_token',   resp.data.token);
        localStorage.setItem('fp_usuario', JSON.stringify(resp.data.usuario));
      }
      // Atualiza avatar com base64 persistido
      const u = getUsuario();
      atualizarPreviewAvatar(u?.nome, u?.email, resp.data.foto_url || u?.foto_url);
      // Atualiza sidebar imediatamente
      if (typeof renderizarSidebarUser === 'function') renderizarSidebarUser();
      mostrarStatus('uploadStatus', '✅ Foto atualizada com sucesso!', 'sucesso');
    } else {
      const erro = resp?.data?.erro || 'Erro ao enviar foto.';
      mostrarStatus('uploadStatus', `❌ ${erro}`, 'erro');
      const u = getUsuario();
      atualizarPreviewAvatar(u?.nome, u?.email, u?.foto_url);
    }
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    if (label) label.classList.remove('carregando');
    ocultarProgressBar();
    mostrarStatus('uploadStatus', '❌ Erro inesperado. Tente novamente.', 'erro');
  }
}

/**
 * Comprime imagem via Canvas e retorna string base64 (data:image/jpeg;base64,...).
 * maxDim: dimensão máxima (largura ou altura), quality: 0-1 JPEG
 */
function comprimirParaBase64(file, maxDim = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Redimensiona mantendo proporção
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else                { width = Math.round(width * maxDim / height);  height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Helper para chamadas fetch diretas (sem JSON auto-parse do apiGet)
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const resp = await fetch('/api' + url, { ...options, headers });
    const data = await resp.json();
    if (resp.status === 401 || resp.status === 403) {
      localStorage.removeItem('fp_token');
      localStorage.removeItem('fp_usuario');
      window.location.href = '/';
      return null;
    }
    return { ok: resp.ok, status: resp.status, data };
  } catch (err) {
    return { ok: false, data: { erro: 'Erro de conexão.' } };
  }
}

// ── Salvar nome / senha ───────────────────────────────────────────
async function salvarPerfil() {
  const erroEl = document.getElementById('erroSucesoPerfil');
  erroEl.className = 'alerta hidden';

  const nome       = document.getElementById('perfilNome').value.trim();
  const senhaAtual = document.getElementById('perfilSenhaAtual').value;
  const novaSenha  = document.getElementById('perfilNovaSenha').value;

  if (!nome) {
    mostrarStatus('erroSucesoPerfil', 'O nome não pode ficar vazio.', 'erro'); return;
  }

  const usuarioAtual = getUsuario();
  const corpo = { nome, foto_url: usuarioAtual?.foto_url || null };
  if (novaSenha) { corpo.senha_atual = senhaAtual; corpo.nova_senha = novaSenha; }

  const resp = await apiPut('/auth/perfil', corpo);
  if (!resp || !resp.ok) {
    mostrarStatus('erroSucesoPerfil', resp?.data?.erro || 'Erro ao salvar.', 'erro'); return;
  }

  localStorage.setItem('fp_token',   resp.data.token);
  localStorage.setItem('fp_usuario', JSON.stringify(resp.data.usuario));
  if (typeof renderizarSidebarUser === 'function') renderizarSidebarUser();

  document.getElementById('perfilSenhaAtual').value = '';
  document.getElementById('perfilNovaSenha').value  = '';
  atualizarPreviewAvatar(resp.data.usuario.nome, resp.data.usuario.email, resp.data.usuario.foto_url);
  mostrarStatus('erroSucesoPerfil', '✅ Perfil salvo com sucesso!', 'sucesso');
}

// ── Helpers de UI ─────────────────────────────────────────────────
function mostrarProgressBar(pct) {
  const wrap = document.getElementById('uploadProgress');
  const bar  = document.getElementById('uploadProgressBar');
  if (!wrap || !bar) return;
  wrap.classList.remove('hidden');
  bar.style.width = pct + '%';
}
function ocultarProgressBar() {
  const wrap = document.getElementById('uploadProgress');
  const bar  = document.getElementById('uploadProgressBar');
  if (!wrap || !bar) return;
  bar.style.width = '0%';
  setTimeout(() => wrap.classList.add('hidden'), 400);
}
function mostrarStatus(idEl, msg, tipo) {
  const el = document.getElementById(idEl);
  if (!el) return;
  el.className = `alerta alerta-${tipo === 'sucesso' ? 'sucesso' : tipo === 'info' ? 'info' : 'erro'}`;
  el.textContent = msg;
  if (tipo === 'sucesso') setTimeout(() => el.classList.add('hidden'), 3500);
}

// ══════════════════════════════════════════════════════════════════
// BACKUP
// ══════════════════════════════════════════════════════════════════
function renderBackup(backup) {
  const el = document.getElementById('backupStatus');
  if (!backup) {
    el.textContent = 'Nenhum backup registrado ainda. O primeiro ocorre ~5s após o servidor iniciar.';
    return;
  }
  const fmt = new Date(backup.realizado_em).toLocaleString('pt-BR');
  el.innerHTML = `Último backup: <strong>${fmt}</strong> · Status: <strong style="color:var(--green)">${backup.status}</strong>`;
}

// ══════════════════════════════════════════════════════════════════
// CATEGORIAS DE RECEITAS
// ══════════════════════════════════════════════════════════════════
function renderCatReceitas(lista) {
  const el = document.getElementById('listaCatReceitas');
  if (!lista?.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhuma categoria.</p>'; return; }
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
  if (!confirm('Remover esta categoria?')) return;
  const resp = await apiDelete(`/configuracoes/categorias-receitas/${id}`);
  if (resp?.ok) carregarPagina();
}

// ══════════════════════════════════════════════════════════════════
// CATEGORIAS DE DESPESAS
// ══════════════════════════════════════════════════════════════════
function renderCatDespesas(lista) {
  const el = document.getElementById('listaCatDespesas');
  if (!lista?.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Nenhuma categoria.</p>'; return; }
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
  if (!confirm('Remover esta categoria?')) return;
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
document.addEventListener('DOMContentLoaded', () => { carregarPagina(); });

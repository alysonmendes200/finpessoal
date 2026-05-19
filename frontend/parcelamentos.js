// ===== FINPESSOAL – RECEITAS JS v5 =====

let todasReceitas       = [];
let todasParceladas     = [];
let filtroAtivo         = 'todos';
let editandoId          = null;
let editandoParceladaId = null;

// ── Init: sem setTimeout, tudo em paralelo ────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Carrega configurações e dados em paralelo
  const [,] = await Promise.all([
    carregarConfiguracoes(),
    // dados chegam depois que as configs estão prontas
  ]);
  renderizarSidebarMesSel(atualizarTotalMes);
  await popularSelectsReceitas();
  // Carrega listagem global + parceladas em paralelo
  await Promise.all([carregarReceitas(), carregarParceladas()]);
});

// ── Selects dinâmicos ─────────────────────────────────────────────
async function popularSelectsReceitas() {
  const cats = _catsReceitas.length ? _catsReceitas : await buscarCatsReceitas();
  const opts = cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
  ['recCategoria', 'rpCategoria'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.innerHTML = opts || '<option>Sem categorias</option>';
  });
}
async function buscarCatsReceitas() {
  const r = await apiGet('/configuracoes/categorias-receitas');
  return r?.ok ? r.data : [];
}

// ── Listagem global (todas as receitas) ───────────────────────────
async function carregarReceitas() {
  const resp = await apiGet('/receitas?todos=1');
  if (!resp || !resp.ok) return;
  todasReceitas = resp.data;
  filtrarTipo(filtroAtivo, null);
  atualizarTotalMes();
}

// Total do mês/ano global selecionado
function atualizarTotalMes() {
  const mes   = getMesGlobal();
  const ano   = getAnoGlobal();
  const total = todasReceitas
    .filter(r => parseInt(r.mes) === mes && parseInt(r.ano) === ano)
    .reduce((s, r) => s + parseFloat(r.valor), 0);
  const el = document.getElementById('totalMes');
  if (el) el.textContent = formatarMoeda(total);
}

function filtrarTipo(tipo, btn) {
  filtroAtivo = tipo;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const lista = tipo === 'todos' ? todasReceitas : todasReceitas.filter(r => r.tipo === tipo);
  renderReceitas(lista);
}

function renderReceitas(lista) {
  const el = document.getElementById('listaReceitas');
  if (!lista || !lista.length) {
    el.innerHTML = '<p class="lista-vazia">Nenhuma receita cadastrada.</p>';
    return;
  }
  el.innerHTML = lista.map(r => `
    <div class="item-card">
      <div class="item-emoji">${emojiCat(r.categoria)}</div>
      <div class="item-info">
        <div class="item-desc">${r.descricao}
          <span class="badge badge-${r.tipo}">${r.tipo === 'fixo' ? 'Fixa' : 'Único'}</span>
        </div>
        <div class="item-sub">${r.categoria} · ${MESES[r.mes - 1]} ${r.ano}</div>
      </div>
      <div class="item-valor item-valor-pos">${formatarMoeda(r.valor)}</div>
      <div class="item-acoes">
        <button class="btn-acao" onclick="abrirEdicao(${r.id})" title="Editar">✏️</button>
        <button class="btn-acao danger" onclick="deletarReceita(${r.id})" title="Excluir">🗑️</button>
      </div>
    </div>`).join('');
}

async function deletarReceita(id) {
  if (!confirm('Remover esta receita?')) return;
  const resp = await apiDelete(`/receitas/${id}`);
  if (resp?.ok) carregarReceitas();
}

// ── Modal novo ────────────────────────────────────────────────────
function abrirModal() {
  editandoId = null;
  document.getElementById('modalTitulo').textContent = 'Nova Receita';
  document.getElementById('erroModal').classList.add('hidden');
  document.getElementById('recTipo').value      = 'unico';
  document.getElementById('recDescricao').value = '';
  document.getElementById('recValor').value     = '';
  const sel = document.getElementById('recCategoria');
  if (sel?.options.length) sel.selectedIndex = 0;
  preencherMesAno('recMes', 'recAno', getMesGlobal(), getAnoGlobal());
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function abrirEdicao(id) {
  const r = todasReceitas.find(x => x.id === id);
  if (!r) return;
  editandoId = id;
  document.getElementById('modalTitulo').textContent = 'Editar Receita';
  document.getElementById('erroModal').classList.add('hidden');
  document.getElementById('recTipo').value      = r.tipo;
  document.getElementById('recDescricao').value = r.descricao;
  document.getElementById('recValor').value     = r.valor;
  const sel = document.getElementById('recCategoria');
  if (sel) sel.value = r.categoria;
  preencherMesAno('recMes', 'recAno', r.mes, r.ano);
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editandoId = null;
}

async function salvarReceita() {
  const erroEl    = document.getElementById('erroModal');
  erroEl.classList.add('hidden');
  const descricao = document.getElementById('recDescricao').value.trim();
  const valor     = parseFloat(document.getElementById('recValor').value);
  const categoria = document.getElementById('recCategoria').value;
  const tipo      = document.getElementById('recTipo').value;
  const mes       = parseInt(document.getElementById('recMes').value);
  const ano       = parseInt(document.getElementById('recAno').value);
  if (!descricao || isNaN(valor) || valor <= 0) {
    erroEl.textContent = 'Preencha descrição e valor válido.';
    erroEl.classList.remove('hidden'); return;
  }
  const corpo = { descricao, valor, categoria, tipo, mes, ano };
  const resp  = editandoId
    ? await apiPut(`/receitas/${editandoId}`, corpo)
    : await apiPost('/receitas', corpo);
  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.remove('hidden'); return;
  }
  fecharModal();
  carregarReceitas();
}

// ═══ RECEITAS PARCELADAS ══════════════════════════════════════════

async function carregarParceladas() {
  const resp = await apiGet('/receitas/parceladas');
  if (!resp || !resp.ok) return;
  todasParceladas = resp.data;
  renderParceladas(todasParceladas);
}

function renderParceladas(lista) {
  const el = document.getElementById('listaReceitasParceladas');
  if (!lista || !lista.length) {
    el.innerHTML = '<p class="lista-vazia">Nenhum recebimento parcelado cadastrado.</p>';
    return;
  }
  el.innerHTML = lista.map(p => {
    const pct = Math.min(((p.parcela_atual - 1) / p.total_parcelas) * 100, 100);
    return `
    <div class="item-card">
      <div class="item-emoji">${emojiCat(p.categoria)}</div>
      <div class="item-info">
        <div class="item-desc">${p.descricao}
          <span class="badge badge-parcelado">Parcelado</span>
        </div>
        <div class="item-sub">
          Parcela ${p.parcela_atual}/${p.total_parcelas}
          · ${p.parcelas_restantes} restante${p.parcelas_restantes !== 1 ? 's' : ''}
          · Saldo: ${formatarMoeda(p.valor_restante)}
        </div>
        <div class="parcela-progresso"><div class="parcela-fill" style="width:${pct.toFixed(1)}%"></div></div>
      </div>
      <div class="item-valor item-valor-pos">
        ${formatarMoeda(p.valor_parcela)}<span class="item-unidade">/mês</span>
      </div>
      <div class="item-acoes">
        <button class="btn-acao success" onclick="avancarParcelada(${p.id})" title="Parcela recebida">✅</button>
        <button class="btn-acao"         onclick="abrirEdicaoParcelada(${p.id})" title="Editar">✏️</button>
        <button class="btn-acao danger"  onclick="deletarParcelada(${p.id})" title="Excluir">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

async function avancarParcelada(id) {
  if (!confirm('Marcar parcela como recebida?')) return;
  const resp = await apiPatch(`/receitas/parceladas/${id}/avancar`, {});
  if (resp?.ok) carregarParceladas();
  else alert(resp?.data?.erro || 'Erro.');
}
async function deletarParcelada(id) {
  if (!confirm('Remover?')) return;
  const resp = await apiDelete(`/receitas/parceladas/${id}`);
  if (resp?.ok) carregarParceladas();
}

function abrirModalParcelada() {
  editandoParceladaId = null;
  document.getElementById('modalParceladaTitulo').textContent = 'Novo Recebimento Parcelado';
  document.getElementById('erroModalParcelada').classList.add('hidden');
  ['rpDescricao','rpValorTotal','rpTotalParcelas','rpValorParcela'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sel = document.getElementById('rpCategoria');
  if (sel?.options.length) sel.selectedIndex = 0;
  const agora = new Date();
  preencherMesAno('rpMesInicio', 'rpAnoInicio', agora.getMonth() + 1, agora.getFullYear());
  document.getElementById('modalParceladaOverlay').classList.remove('hidden');
}

function abrirEdicaoParcelada(id) {
  const p = todasParceladas.find(x => x.id === id);
  if (!p) return;
  editandoParceladaId = id;
  document.getElementById('modalParceladaTitulo').textContent = 'Editar Recebimento Parcelado';
  document.getElementById('erroModalParcelada').classList.add('hidden');
  document.getElementById('rpDescricao').value     = p.descricao;
  document.getElementById('rpValorTotal').value    = p.valor_total;
  document.getElementById('rpTotalParcelas').value = p.total_parcelas;
  document.getElementById('rpValorParcela').value  = p.valor_parcela;
  const sel = document.getElementById('rpCategoria');
  if (sel) sel.value = p.categoria;
  preencherMesAno('rpMesInicio', 'rpAnoInicio', p.mes_inicio, p.ano_inicio);
  document.getElementById('modalParceladaOverlay').classList.remove('hidden');
}
function fecharModalParcelada() {
  document.getElementById('modalParceladaOverlay').classList.add('hidden');
  editandoParceladaId = null;
}
function calcularParcelaReceita() {
  const t = parseFloat(document.getElementById('rpValorTotal').value);
  const n = parseInt(document.getElementById('rpTotalParcelas').value);
  if (t > 0 && n > 0) document.getElementById('rpValorParcela').value = (t / n).toFixed(2);
}
async function salvarReceitaParcelada() {
  const erroEl = document.getElementById('erroModalParcelada');
  erroEl.classList.add('hidden');
  const descricao      = document.getElementById('rpDescricao').value.trim();
  const valor_total    = parseFloat(document.getElementById('rpValorTotal').value);
  const total_parcelas = parseInt(document.getElementById('rpTotalParcelas').value);
  const valor_parcela  = parseFloat(document.getElementById('rpValorParcela').value);
  const categoria      = document.getElementById('rpCategoria').value;
  const mes_inicio     = parseInt(document.getElementById('rpMesInicio').value);
  const ano_inicio     = parseInt(document.getElementById('rpAnoInicio').value);
  if (!descricao || isNaN(valor_parcela) || isNaN(total_parcelas)) {
    erroEl.textContent = 'Preencha todos os campos.';
    erroEl.classList.remove('hidden'); return;
  }
  const corpo = {
    descricao,
    valor_total: isNaN(valor_total) ? valor_parcela * total_parcelas : valor_total,
    valor_parcela, total_parcelas, mes_inicio, ano_inicio, categoria
  };
  const resp = editandoParceladaId
    ? await apiPut(`/receitas/parceladas/${editandoParceladaId}`, corpo)
    : await apiPost('/receitas/parceladas', corpo);
  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.remove('hidden'); return;
  }
  fecharModalParcelada();
  carregarParceladas();
}

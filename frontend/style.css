// ===== FINPESSOAL – PARCELAMENTOS JS v5 =====

let todosParcelamentos = [];
let editandoId         = null;

document.addEventListener('DOMContentLoaded', async () => {
  await carregarConfiguracoes();
  renderizarSidebarMesSel(null);
  await popularSelectsParcelamentos();
  await carregarParcelamentos();
});

async function popularSelectsParcelamentos() {
  const cats = _catsDespesas.length ? _catsDespesas : await buscarCatsDespesas();
  const sel  = document.getElementById('parCategoria');
  if (sel) sel.innerHTML = cats.length
    ? cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('')
    : '<option>Sem categorias</option>';
}
async function buscarCatsDespesas() {
  const r = await apiGet('/configuracoes/categorias-despesas');
  return r?.ok ? r.data : [];
}

async function carregarParcelamentos() {
  const resp = await apiGet('/parcelamentos');
  if (!resp || !resp.ok) return;
  todosParcelamentos = resp.data;
  renderParcelamentos(todosParcelamentos);
  const total = todosParcelamentos.reduce((s, p) => s + parseFloat(p.valor_parcela), 0);
  const el = document.getElementById('totalParcelas');
  if (el) el.textContent = formatarMoeda(total);
}

function renderParcelamentos(lista) {
  const el = document.getElementById('listaParcelamentos');
  if (!lista || !lista.length) {
    el.innerHTML = '<p class="lista-vazia">Nenhum parcelamento ativo.</p>';
    return;
  }
  el.innerHTML = lista.map(p => {
    const pct       = Math.min(((p.parcela_atual - 1) / p.total_parcelas) * 100, 100);
    const restantes = p.total_parcelas - p.parcela_atual + 1;
    return `
    <div class="item-card">
      <div class="item-emoji">${emojiCat(p.categoria)}</div>
      <div class="item-info">
        <div class="item-desc">${p.descricao}</div>
        <div class="item-sub">
          Parcela ${p.parcela_atual}/${p.total_parcelas}
          · ${restantes} restante${restantes !== 1 ? 's' : ''}
          · Saldo: ${formatarMoeda(p.valor_restante)}
        </div>
        <div class="parcela-progresso"><div class="parcela-fill" style="width:${pct.toFixed(1)}%"></div></div>
      </div>
      <div class="item-valor item-valor-parc">
        ${formatarMoeda(p.valor_parcela)}<span class="item-unidade">/mês</span>
      </div>
      <div class="item-acoes">
        <button class="btn-acao success" onclick="avancarParcela(${p.id})"      title="Paga">✅</button>
        <button class="btn-acao"         onclick="abrirEdicao(${p.id})"         title="Editar">✏️</button>
        <button class="btn-acao danger"  onclick="deletarParcelamento(${p.id})" title="Excluir">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

async function avancarParcela(id) {
  if (!confirm('Marcar parcela atual como paga e avançar?')) return;
  const resp = await apiPatch(`/parcelamentos/${id}/avancar`, {});
  if (resp?.ok) carregarParcelamentos();
  else alert(resp?.data?.erro || 'Erro.');
}
async function deletarParcelamento(id) {
  if (!confirm('Remover este parcelamento?')) return;
  const resp = await apiDelete(`/parcelamentos/${id}`);
  if (resp?.ok) carregarParcelamentos();
}

function calcularParcela() {
  const t = parseFloat(document.getElementById('parValorTotal').value);
  const n = parseInt(document.getElementById('parTotalParcelas').value);
  if (t > 0 && n > 0) document.getElementById('parValorParcela').value = (t / n).toFixed(2);
}

function abrirModal() {
  editandoId = null;
  document.getElementById('modalTitulo').textContent = 'Novo Parcelamento';
  document.getElementById('erroModal').classList.add('hidden');
  ['parDescricao','parValorTotal','parTotalParcelas','parValorParcela'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sel = document.getElementById('parCategoria');
  if (sel?.options.length) sel.selectedIndex = 0;
  const agora = new Date();
  preencherMesAno('parMesInicio', 'parAnoInicio', agora.getMonth() + 1, agora.getFullYear());
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function abrirEdicao(id) {
  const p = todosParcelamentos.find(x => x.id === id);
  if (!p) return;
  editandoId = id;
  document.getElementById('modalTitulo').textContent = 'Editar Parcelamento';
  document.getElementById('erroModal').classList.add('hidden');
  document.getElementById('parDescricao').value     = p.descricao;
  document.getElementById('parValorTotal').value    = p.valor_total;
  document.getElementById('parTotalParcelas').value = p.total_parcelas;
  document.getElementById('parValorParcela').value  = p.valor_parcela;
  const sel = document.getElementById('parCategoria');
  if (sel) sel.value = p.categoria;
  preencherMesAno('parMesInicio', 'parAnoInicio', p.mes_inicio, p.ano_inicio);
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editandoId = null;
}

async function salvarParcelamento() {
  const erroEl = document.getElementById('erroModal');
  erroEl.classList.add('hidden');
  const descricao      = document.getElementById('parDescricao').value.trim();
  const valor_total    = parseFloat(document.getElementById('parValorTotal').value);
  const total_parcelas = parseInt(document.getElementById('parTotalParcelas').value);
  const valor_parcela  = parseFloat(document.getElementById('parValorParcela').value);
  const categoria      = document.getElementById('parCategoria').value;
  const mes_inicio     = parseInt(document.getElementById('parMesInicio').value);
  const ano_inicio     = parseInt(document.getElementById('parAnoInicio').value);
  if (!descricao || isNaN(valor_parcela) || isNaN(total_parcelas)) {
    erroEl.textContent = 'Preencha todos os campos.';
    erroEl.classList.remove('hidden'); return;
  }
  const corpo = {
    descricao,
    valor_total: isNaN(valor_total) ? valor_parcela * total_parcelas : valor_total,
    valor_parcela, total_parcelas, mes_inicio, ano_inicio, categoria
  };
  const resp = editandoId
    ? await apiPut(`/parcelamentos/${editandoId}`, corpo)
    : await apiPost('/parcelamentos', corpo);
  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.remove('hidden'); return;
  }
  fecharModal();
  carregarParcelamentos();
}

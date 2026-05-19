// ===== FINPESSOAL – DESPESAS JS v4 =====
// Lista TODAS as despesas. Total calculado sobre o mês global selecionado.

let todasDespesas = [];
let filtroAtivo   = 'todos';
let editandoId    = null;

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(r => setTimeout(r, 180));
  renderizarSidebarMesSel(atualizarTotalMes);
  await popularSelectsDespesas();
  await carregarDespesas();
});

async function popularSelectsDespesas() {
  const [cats, tipos] = await Promise.all([buscarCatsDespesas(), buscarTiposDespesas()]);
  const selCat  = document.getElementById('despCategoria');
  const selTipo = document.getElementById('despTipo');
  if (selCat) selCat.innerHTML = cats.length
    ? cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('')
    : '<option>Sem categorias</option>';
  if (selTipo) selTipo.innerHTML = tipos.length
    ? tipos.map(t => `<option value="${t.codigo}">${t.nome}</option>`).join('')
    : '<option>Sem tipos</option>';

  // Botões de filtro dinâmicos
  const filtrosEl = document.getElementById('filtrosTipo');
  if (filtrosEl && tipos.length) {
    filtrosEl.innerHTML =
      `<button class="filtro-btn active" onclick="filtrarTipo('todos',this)">Todos</button>` +
      tipos.map(t => `<button class="filtro-btn" onclick="filtrarTipo('${t.codigo}',this)">${t.nome}</button>`).join('');
  }
}

async function buscarCatsDespesas() {
  if (_catsDespesas.length) return _catsDespesas;
  const r = await apiGet('/configuracoes/categorias-despesas');
  return r?.ok ? r.data : [];
}
async function buscarTiposDespesas() {
  if (_tiposDespesas.length) return _tiposDespesas;
  const r = await apiGet('/configuracoes/tipos-despesas');
  return r?.ok ? r.data : [];
}

// ── Listagem global ───────────────────────────────────────────────
async function carregarDespesas() {
  const resp = await apiGet('/despesas?todos=1');
  if (!resp || !resp.ok) return;
  todasDespesas = resp.data;
  filtrarTipo(filtroAtivo, null);
  atualizarTotalMes();
}

function atualizarTotalMes() {
  const mes = getMesGlobal();
  const ano = getAnoGlobal();
  const total = todasDespesas
    .filter(d => parseInt(d.mes)===mes && parseInt(d.ano)===ano)
    .reduce((s,d) => s + parseFloat(d.valor), 0);
  const el = document.getElementById('totalMes');
  if (el) el.textContent = formatarMoeda(total);
}

function filtrarTipo(tipo, btn) {
  filtroAtivo = tipo;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const lista = tipo === 'todos' ? todasDespesas : todasDespesas.filter(d => d.tipo===tipo);
  renderDespesas(lista);
}

function renderDespesas(lista) {
  const el = document.getElementById('listaDespesas');
  if (!lista || !lista.length) {
    el.innerHTML = '<p class="lista-vazia">Nenhuma despesa cadastrada.</p>';
    return;
  }
  el.innerHTML = lista.map(d => {
    const tipoLabel = _tiposDespesas.find(t=>t.codigo===d.tipo)?.nome || d.tipo;
    return `
    <div class="item-card ${d.pago?'pago':''}">
      <div class="item-emoji">${emojiCat(d.categoria)}</div>
      <div class="item-info">
        <div class="item-desc">
          ${d.descricao}
          <span class="badge badge-${d.tipo}">${tipoLabel}</span>
          ${d.pago?'<span class="badge" style="background:#d1fae5;color:#059669">Pago</span>':''}
        </div>
        <div class="item-sub">${d.categoria} • ${MESES[d.mes-1]} ${d.ano}</div>
      </div>
      <div class="item-valor" style="color:var(--red)">${formatarMoeda(d.valor)}</div>
      <div class="item-acoes">
        <button class="btn-acao ${d.pago?'':'success'}"
                onclick="togglePago(${d.id},${!d.pago})"
                title="${d.pago?'Desfazer':'Marcar como pago'}">${d.pago?'↩️':'✅'}</button>
        <button class="btn-acao" onclick="abrirEdicao(${d.id})" title="Editar">✏️</button>
        <button class="btn-acao danger" onclick="deletarDespesa(${d.id})" title="Excluir">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

async function togglePago(id, pago) {
  const resp = await apiPatch(`/despesas/${id}/pago`, { pago });
  if (resp?.ok) carregarDespesas();
}
async function deletarDespesa(id) {
  if (!confirm('Remover esta despesa?')) return;
  const resp = await apiDelete(`/despesas/${id}`);
  if (resp?.ok) carregarDespesas();
}

function abrirModal() {
  editandoId = null;
  document.getElementById('modalTitulo').textContent = 'Nova Despesa';
  document.getElementById('erroModal').classList.add('hidden');
  document.getElementById('despDescricao').value = '';
  document.getElementById('despValor').value     = '';
  const selCat  = document.getElementById('despCategoria');
  const selTipo = document.getElementById('despTipo');
  if (selCat  && selCat.options.length)  selCat.selectedIndex  = 0;
  if (selTipo && selTipo.options.length) selTipo.selectedIndex = 0;
  preencherMesAno('despMes','despAno', getMesGlobal(), getAnoGlobal());
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function abrirEdicao(id) {
  const d = todasDespesas.find(x => x.id===id);
  if (!d) return;
  editandoId = id;
  document.getElementById('modalTitulo').textContent = 'Editar Despesa';
  document.getElementById('erroModal').classList.add('hidden');
  document.getElementById('despDescricao').value = d.descricao;
  document.getElementById('despValor').value     = d.valor;
  const selCat  = document.getElementById('despCategoria');
  const selTipo = document.getElementById('despTipo');
  if (selCat)  selCat.value  = d.categoria;
  if (selTipo) selTipo.value = d.tipo;
  preencherMesAno('despMes','despAno', d.mes, d.ano);
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editandoId = null;
}

async function salvarDespesa() {
  const erroEl = document.getElementById('erroModal');
  erroEl.classList.add('hidden');
  const descricao = document.getElementById('despDescricao').value.trim();
  const valor     = parseFloat(document.getElementById('despValor').value);
  const categoria = document.getElementById('despCategoria').value;
  const tipo      = document.getElementById('despTipo').value;
  const mes       = parseInt(document.getElementById('despMes').value);
  const ano       = parseInt(document.getElementById('despAno').value);
  if (!descricao || isNaN(valor) || valor<=0) {
    erroEl.textContent='Preencha a descrição e um valor válido.';
    erroEl.classList.remove('hidden'); return;
  }
  if (!categoria||!tipo) {
    erroEl.textContent='Selecione categoria e tipo.';
    erroEl.classList.remove('hidden'); return;
  }
  const corpo = { descricao, valor, categoria, tipo, mes, ano };
  const resp  = editandoId
    ? await apiPut(`/despesas/${editandoId}`, corpo)
    : await apiPost('/despesas', corpo);
  if (!resp || !resp.ok) {
    erroEl.textContent=resp?.data?.erro||'Erro ao salvar.';
    erroEl.classList.remove('hidden'); return;
  }
  fecharModal();
  carregarDespesas();
}

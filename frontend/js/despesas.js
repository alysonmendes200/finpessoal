// ===== FINPESSOAL - DESPESAS =====

let todasDespesas = [];
let filtroAtivo   = 'todos';
let editandoId    = null; // null = novo, número = editando

async function carregarDespesas() {
  const mes = getMesSelecionado();
  const ano = getAnoSelecionado();

  const resp = await apiGet(`/despesas?mes=${mes}&ano=${ano}`);
  if (!resp || !resp.ok) return;

  todasDespesas = resp.data;
  filtrarTipo(filtroAtivo, null);

  const total = todasDespesas.reduce((s, d) => s + parseFloat(d.valor), 0);
  document.getElementById('totalMes').textContent = formatarMoeda(total);
}

function filtrarTipo(tipo, btn) {
  filtroAtivo = tipo;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const lista = tipo === 'todos' ? todasDespesas : todasDespesas.filter(d => d.tipo === tipo);
  renderDespesas(lista);
}

const LABEL_TIPO = { fixo: 'Fixa', variavel: 'Variável', fatura: 'Fatura' };

function renderDespesas(lista) {
  const el = document.getElementById('listaDespesas');
  if (!lista || lista.length === 0) {
    el.innerHTML = '<p class="lista-vazia">Nenhuma despesa encontrada.</p>';
    return;
  }
  el.innerHTML = lista.map(d => `
    <div class="item-card ${d.pago ? 'pago' : ''}">
      <div class="item-emoji">${emojiCat(d.categoria)}</div>
      <div class="item-info">
        <div class="item-desc">
          ${d.descricao}
          <span class="badge badge-${d.tipo}">${LABEL_TIPO[d.tipo] || d.tipo}</span>
          ${d.pago ? '<span class="badge" style="background:#d1fae5;color:#059669">Pago</span>' : ''}
        </div>
        <div class="item-sub">${d.categoria} • ${MESES[d.mes - 1]} ${d.ano}</div>
      </div>
      <div class="item-valor" style="color:var(--red)">${formatarMoeda(d.valor)}</div>
      <div class="item-acoes">
        <button class="btn-acao ${d.pago ? '' : 'success'}"
                onclick="togglePago(${d.id}, ${!d.pago})"
                title="${d.pago ? 'Desfazer pagamento' : 'Marcar como pago'}">
          ${d.pago ? '↩️' : '✅'}
        </button>
        <button class="btn-acao" onclick="abrirEdicao(${d.id})" title="Editar">✏️</button>
        <button class="btn-acao danger" onclick="deletarDespesa(${d.id})" title="Excluir">🗑️</button>
      </div>
    </div>`).join('');
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

// ── Modal novo ────────────────────────────────────────────────────
function abrirModal() {
  editandoId = null;
  document.getElementById('modalTitulo').textContent = 'Nova Despesa';
  document.getElementById('erroModal').classList.add('hidden');
  document.getElementById('despDescricao').value = '';
  document.getElementById('despValor').value     = '';
  document.getElementById('despCategoria').value = 'moradia';
  document.getElementById('despTipo').value      = 'fixo';
  preencherMesAno('despMes', 'despAno', getMesSelecionado(), getAnoSelecionado());
  document.getElementById('modalOverlay').classList.remove('hidden');
}

// ── Modal edição ──────────────────────────────────────────────────
function abrirEdicao(id) {
  const d = todasDespesas.find(x => x.id === id);
  if (!d) return;
  editandoId = id;
  document.getElementById('modalTitulo').textContent = 'Editar Despesa';
  document.getElementById('erroModal').classList.add('hidden');
  document.getElementById('despDescricao').value = d.descricao;
  document.getElementById('despValor').value     = d.valor;
  document.getElementById('despCategoria').value = d.categoria;
  document.getElementById('despTipo').value      = d.tipo;
  preencherMesAno('despMes', 'despAno', d.mes, d.ano);
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editandoId = null;
}

async function salvarDespesa() {
  const erroEl    = document.getElementById('erroModal');
  erroEl.classList.add('hidden');

  const descricao = document.getElementById('despDescricao').value.trim();
  const valor     = parseFloat(document.getElementById('despValor').value);
  const categoria = document.getElementById('despCategoria').value;
  const tipo      = document.getElementById('despTipo').value;
  const mes       = parseInt(document.getElementById('despMes').value);
  const ano       = parseInt(document.getElementById('despAno').value);

  if (!descricao || isNaN(valor) || valor <= 0) {
    erroEl.textContent = 'Preencha a descrição e um valor válido.';
    erroEl.classList.remove('hidden');
    return;
  }

  const corpo = { descricao, valor, categoria, tipo, mes, ano };
  const resp  = editandoId
    ? await apiPut(`/despesas/${editandoId}`, corpo)
    : await apiPost('/despesas', corpo);

  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.remove('hidden');
    return;
  }

  fecharModal();
  carregarDespesas();
}

document.addEventListener('DOMContentLoaded', () => { setTimeout(carregarDespesas, 100); });

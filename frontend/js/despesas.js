// ===== FINPESSOAL - DESPESAS =====

let todasDespesas = [];
let filtroAtivo = 'todos';

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

  const lista = tipo === 'todos'
    ? todasDespesas
    : todasDespesas.filter(d => d.tipo === tipo);

  renderDespesas(lista);
}

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
        <div class="item-desc">${d.descricao} <span class="badge badge-${d.tipo}">${d.tipo}</span></div>
        <div class="item-sub">${d.categoria} • ${MESES[d.mes - 1]} ${d.ano} ${d.pago ? '✅ Pago' : ''}</div>
      </div>
      <div class="item-valor" style="color:var(--danger)">${formatarMoeda(d.valor)}</div>
      <div class="item-acoes">
        <button class="btn-acao ${d.pago ? '' : 'success'}" onclick="togglePago(${d.id}, ${!d.pago})">
          ${d.pago ? '↩️' : '✅'}
        </button>
        <button class="btn-acao danger" onclick="deletarDespesa(${d.id})">🗑️</button>
      </div>
    </div>
  `).join('');
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
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('erroModal').classList.add('hidden');

  const mes = getMesSelecionado();
  const ano = getAnoSelecionado();
  preencherMesAno('despMes', 'despAno', mes, ano);

  document.getElementById('despDescricao').value = '';
  document.getElementById('despValor').value = '';
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

async function salvarDespesa() {
  const erroEl = document.getElementById('erroModal');
  erroEl.classList.add('hidden');

  const descricao = document.getElementById('despDescricao').value.trim();
  const valor = parseFloat(document.getElementById('despValor').value);
  const categoria = document.getElementById('despCategoria').value;
  const tipo = document.getElementById('despTipo').value;
  const mes = parseInt(document.getElementById('despMes').value);
  const ano = parseInt(document.getElementById('despAno').value);

  if (!descricao || isNaN(valor) || valor <= 0) {
    erroEl.textContent = 'Preencha a descrição e um valor válido.';
    erroEl.classList.remove('hidden');
    return;
  }

  const resp = await apiPost('/despesas', { descricao, valor, categoria, tipo, mes, ano });

  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.remove('hidden');
    return;
  }

  fecharModal();
  carregarDespesas();
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(carregarDespesas, 100);
});

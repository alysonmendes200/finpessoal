// ===== FINPESSOAL - RECEITAS =====

let todasReceitas = [];

async function carregarReceitas() {
  const mes = getMesSelecionado();
  const ano = getAnoSelecionado();

  const resp = await apiGet(`/receitas?mes=${mes}&ano=${ano}`);
  if (!resp || !resp.ok) return;

  todasReceitas = resp.data;
  renderReceitas(todasReceitas);

  const total = todasReceitas.reduce((s, r) => s + parseFloat(r.valor), 0);
  document.getElementById('totalMes').textContent = formatarMoeda(total);
}

function renderReceitas(lista) {
  const el = document.getElementById('listaReceitas');

  if (!lista || lista.length === 0) {
    el.innerHTML = '<p class="lista-vazia">Nenhuma receita cadastrada neste mês.</p>';
    return;
  }

  el.innerHTML = lista.map(r => `
    <div class="item-card">
      <div class="item-emoji">${emojiCat(r.categoria)}</div>
      <div class="item-info">
        <div class="item-desc">${r.descricao}</div>
        <div class="item-sub">${r.categoria} • ${MESES[r.mes - 1]} ${r.ano}</div>
      </div>
      <div class="item-valor" style="color:var(--accent)">${formatarMoeda(r.valor)}</div>
      <div class="item-acoes">
        <button class="btn-acao danger" onclick="deletarReceita(${r.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function deletarReceita(id) {
  if (!confirm('Remover esta receita?')) return;
  const resp = await apiDelete(`/receitas/${id}`);
  if (resp?.ok) carregarReceitas();
}

function abrirModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('erroModal').classList.add('hidden');

  const agora = new Date();
  const mes = getMesSelecionado();
  const ano = getAnoSelecionado();
  preencherMesAno('recMes', 'recAno', mes, ano);

  // Limpar campos
  document.getElementById('recDescricao').value = '';
  document.getElementById('recValor').value = '';
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

async function salvarReceita() {
  const erroEl = document.getElementById('erroModal');
  erroEl.classList.add('hidden');

  const descricao = document.getElementById('recDescricao').value.trim();
  const valor = parseFloat(document.getElementById('recValor').value);
  const categoria = document.getElementById('recCategoria').value;
  const mes = parseInt(document.getElementById('recMes').value);
  const ano = parseInt(document.getElementById('recAno').value);

  if (!descricao || isNaN(valor) || valor <= 0) {
    erroEl.textContent = 'Preencha a descrição e um valor válido.';
    erroEl.classList.remove('hidden');
    return;
  }

  const resp = await apiPost('/receitas', { descricao, valor, categoria, mes, ano });

  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.remove('hidden');
    return;
  }

  fecharModal();
  carregarReceitas();
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(carregarReceitas, 100);
});

// ===== FINPESSOAL - PARCELAMENTOS =====

async function carregarParcelamentos() {
  const resp = await apiGet('/parcelamentos');
  if (!resp || !resp.ok) return;

  const lista = resp.data;
  renderParcelamentos(lista);

  const total = lista.reduce((s, p) => s + parseFloat(p.valor_parcela), 0);
  document.getElementById('totalParcelas').textContent = formatarMoeda(total);
}

function renderParcelamentos(lista) {
  const el = document.getElementById('listaParcelamentos');

  if (!lista || lista.length === 0) {
    el.innerHTML = '<p class="lista-vazia">Nenhum parcelamento ativo.</p>';
    return;
  }

  el.innerHTML = lista.map(p => {
    const pct = ((p.parcela_atual - 1) / p.total_parcelas) * 100;
    const restantes = p.total_parcelas - p.parcela_atual + 1;

    return `
    <div class="item-card">
      <div class="item-emoji">${emojiCat(p.categoria)}</div>
      <div class="item-info" style="flex:1">
        <div class="item-desc">${p.descricao}</div>
        <div class="item-sub">
          Parcela ${p.parcela_atual}/${p.total_parcelas} 
          • ${restantes} restantes 
          • Saldo: ${formatarMoeda(p.valor_restante)}
        </div>
        <div class="parcela-progresso">
          <div class="parcela-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
      </div>
      <div style="text-align:right;margin-left:12px">
        <div class="item-valor" style="color:var(--accent2)">${formatarMoeda(p.valor_parcela)}<span style="font-size:11px;color:var(--text-muted)">/mês</span></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Total: ${formatarMoeda(p.valor_total)}</div>
      </div>
      <div class="item-acoes" style="flex-direction:column">
        <button class="btn-acao success" onclick="avancarParcela(${p.id})" title="Marcar parcela como paga">✅</button>
        <button class="btn-acao danger" onclick="deletarParcelamento(${p.id})">🗑️</button>
      </div>
    </div>
  `}).join('');
}

async function avancarParcela(id) {
  if (!confirm('Marcar parcela atual como paga e avançar?')) return;
  const resp = await apiPatch(`/parcelamentos/${id}/avancar`, {});
  if (resp?.ok) {
    carregarParcelamentos();
  } else {
    alert(resp?.data?.erro || 'Erro ao avançar parcela.');
  }
}

async function deletarParcelamento(id) {
  if (!confirm('Remover este parcelamento?')) return;
  const resp = await apiDelete(`/parcelamentos/${id}`);
  if (resp?.ok) carregarParcelamentos();
}

function calcularParcela() {
  const total = parseFloat(document.getElementById('parValorTotal').value);
  const numParcelas = parseInt(document.getElementById('parTotalParcelas').value);

  if (total > 0 && numParcelas > 0) {
    document.getElementById('parValorParcela').value = (total / numParcelas).toFixed(2);
  }
}

function abrirModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('erroModal').classList.add('hidden');

  const agora = new Date();
  preencherMesAno('parMesInicio', 'parAnoInicio', agora.getMonth() + 1, agora.getFullYear());

  document.getElementById('parDescricao').value = '';
  document.getElementById('parValorTotal').value = '';
  document.getElementById('parTotalParcelas').value = '';
  document.getElementById('parValorParcela').value = '';
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

async function salvarParcelamento() {
  const erroEl = document.getElementById('erroModal');
  erroEl.classList.add('hidden');

  const descricao = document.getElementById('parDescricao').value.trim();
  const valor_total = parseFloat(document.getElementById('parValorTotal').value);
  const total_parcelas = parseInt(document.getElementById('parTotalParcelas').value);
  const valor_parcela = parseFloat(document.getElementById('parValorParcela').value);
  const categoria = document.getElementById('parCategoria').value;
  const mes_inicio = parseInt(document.getElementById('parMesInicio').value);
  const ano_inicio = parseInt(document.getElementById('parAnoInicio').value);

  if (!descricao || isNaN(valor_total) || isNaN(total_parcelas) || isNaN(valor_parcela)) {
    erroEl.textContent = 'Preencha todos os campos corretamente.';
    erroEl.classList.remove('hidden');
    return;
  }

  const resp = await apiPost('/parcelamentos', {
    descricao, valor_total, valor_parcela, total_parcelas,
    mes_inicio, ano_inicio, categoria
  });

  if (!resp || !resp.ok) {
    erroEl.textContent = resp?.data?.erro || 'Erro ao salvar.';
    erroEl.classList.remove('hidden');
    return;
  }

  fecharModal();
  carregarParcelamentos();
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(carregarParcelamentos, 100);
});

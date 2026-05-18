// ===== FINPESSOAL - PREVISÕES =====

let graficoProjecao = null;

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

async function simular() {
  const mes = getMesSelecionado();
  const ano = getAnoSelecionado();

  const resp = await apiGet(`/previsao/simular?mes=${mes}&ano=${ano}`);
  if (!resp || !resp.ok) return;

  const d = resp.data;

  // ── Cards ──────────────────────────────────────────────────────
  document.getElementById('prevReceitas').textContent  = formatarMoeda(d.totalReceitas);
  document.getElementById('prevDespFixas').textContent = formatarMoeda(d.despesas.totalFixas);
  document.getElementById('prevParcelas').textContent  = formatarMoeda(d.despesas.totalParcelamentos);

  const saldoEl   = document.getElementById('prevSaldo');
  const cardSaldo = document.getElementById('cardSaldoPrev');
  saldoEl.textContent = formatarMoeda(d.saldoProjetado);
  const saldoPositivo = d.saldoProjetado >= 0;
  const saldoOk       = d.saldoProjetado > d.totalReceitas * 0.1; // >10% de margem = verde

  cardSaldo.classList.remove('negativo');
  if (!saldoPositivo) {
    cardSaldo.classList.add('negativo');
  }

  // ── Tabela Entradas ────────────────────────────────────────────
  const tbEntradas = document.getElementById('tabelaEntradas');
  const linhasEntradas = [];

  d.receitas.fixas.forEach(r => {
    linhasEntradas.push(`
      <tr>
        <td>${r.descricao}</td>
        <td><span class="badge badge-fixo">Fixa</span></td>
        <td style="text-align:right;color:var(--green);font-weight:600">${formatarMoeda(r.valor)}</td>
      </tr>`);
  });

  d.receitas.parceladas.forEach(r => {
    linhasEntradas.push(`
      <tr>
        <td>${r.descricao}</td>
        <td><span class="badge badge-parcelado">${r.label}</span></td>
        <td style="text-align:right;color:var(--green);font-weight:600">${formatarMoeda(r.valor_parcela)}</td>
      </tr>`);
  });

  d.receitas.unicas.forEach(r => {
    linhasEntradas.push(`
      <tr>
        <td>${r.descricao}</td>
        <td><span class="badge badge-unico">Único</span></td>
        <td style="text-align:right;color:var(--green);font-weight:600">${formatarMoeda(r.valor)}</td>
      </tr>`);
  });

  tbEntradas.innerHTML = linhasEntradas.length
    ? linhasEntradas.join('')
    : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma entrada projetada</td></tr>`;

  // Rodapé total entradas
  if (linhasEntradas.length) {
    tbEntradas.innerHTML += `
      <tr style="background:#f8fafc">
        <td colspan="2" style="font-weight:600;color:var(--text-dark)">Total Entradas</td>
        <td style="text-align:right;font-weight:700;color:var(--green)">${formatarMoeda(d.totalReceitas)}</td>
      </tr>`;
  }

  // ── Tabela Saídas ──────────────────────────────────────────────
  const tbSaidas = document.getElementById('tabelaSaidas');
  const linhasSaidas = [];

  d.despesas.fixas.forEach(dp => {
    linhasSaidas.push(`
      <tr>
        <td>${dp.descricao}</td>
        <td><span class="badge badge-fixo">Fixa</span></td>
        <td style="text-align:right;color:var(--red);font-weight:600">${formatarMoeda(dp.valor)}</td>
      </tr>`);
  });

  d.despesas.parcelamentos.forEach(p => {
    linhasSaidas.push(`
      <tr>
        <td>${p.descricao}</td>
        <td><span class="badge badge-saida">${p.label}</span></td>
        <td style="text-align:right;color:var(--red);font-weight:600">${formatarMoeda(p.valor_parcela)}</td>
      </tr>`);
  });

  tbSaidas.innerHTML = linhasSaidas.length
    ? linhasSaidas.join('')
    : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma saída fixa projetada</td></tr>`;

  if (linhasSaidas.length) {
    tbSaidas.innerHTML += `
      <tr style="background:#f8fafc">
        <td colspan="2" style="font-weight:600;color:var(--text-dark)">Total Saídas</td>
        <td style="text-align:right;font-weight:700;color:var(--red)">${formatarMoeda(d.totalDespesas)}</td>
      </tr>`;
  }

  // ── Tabela Parcelamentos Detalhados ────────────────────────────
  const tbParc = document.getElementById('tabelaParcelamentos');
  const todos = [
    ...d.despesas.parcelamentos.map(p => ({ ...p, sentido: 'saida' })),
    ...d.receitas.parceladas.map(p => ({ ...p, sentido: 'entrada' }))
  ];

  if (!todos.length) {
    tbParc.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum parcelamento ativo neste mês</td></tr>`;
  } else {
    const valorRestanteCalc = (p) => {
      const restantes = p.total_parcelas - parseInt(p.numero_parcela) + 1;
      return restantes * parseFloat(p.valor_parcela);
    };
    tbParc.innerHTML = todos.map(p => `
      <tr>
        <td>
          <span class="badge badge-${p.sentido}" style="margin-right:6px">${p.sentido === 'entrada' ? '📥' : '📤'}</span>
          ${p.descricao}
        </td>
        <td><span class="badge badge-${p.sentido}">${p.label}</span></td>
        <td style="color:var(--text-muted)">${p.categoria}</td>
        <td style="text-align:right;font-weight:600;color:${p.sentido === 'entrada' ? 'var(--green)' : 'var(--red)'}">
          ${p.sentido === 'saida' ? '-' : '+'}${formatarMoeda(p.valor_parcela)}
        </td>
        <td style="text-align:right;color:var(--text-muted)">${formatarMoeda(valorRestanteCalc(p))}</td>
      </tr>`).join('');
  }

  // ── Gráfico Projeção 6 meses ───────────────────────────────────
  renderGraficoProjecao(d.projecao6meses);
}

function renderGraficoProjecao(projecao) {
  const ctx = document.getElementById('graficoProjecao').getContext('2d');
  if (graficoProjecao) graficoProjecao.destroy();

  const labels   = projecao.map(p => `${MESES_ABREV[p.mes - 1]}/${String(p.ano).slice(2)}`);
  const receitas = projecao.map(p => parseFloat(p.totalReceitas));
  const despesas = projecao.map(p => parseFloat(p.totalDespesas));
  const saldos   = projecao.map(p => parseFloat(p.saldo));

  graficoProjecao = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Receitas',
          data: receitas,
          backgroundColor: 'rgba(37,99,235,0.75)',
          borderRadius: 6,
          borderSkipped: false,
          order: 1
        },
        {
          label: 'Despesas',
          data: despesas,
          backgroundColor: 'rgba(220,38,38,0.65)',
          borderRadius: 6,
          borderSkipped: false,
          order: 1
        },
        {
          label: 'Saldo',
          data: saldos,
          type: 'line',
          borderColor: '#059669',
          backgroundColor: 'rgba(5,150,105,0.08)',
          pointBackgroundColor: '#059669',
          pointRadius: 5,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          order: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#64748b', font: { size: 12, family: 'Inter' } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatarMoeda(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: '#f1f5f9' } },
        y: {
          ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => 'R$ ' + (v/1000).toFixed(0) + 'k' },
          grid: { color: '#f1f5f9' }
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(simular, 100);
});

// ===== FINPESSOAL - DASHBOARD =====

let graficoCat = null;
let graficoAnual = null;

const CORES = [
  '#00d4aa','#6c63ff','#ff4d6d','#ffb830','#00b4d8',
  '#f72585','#4cc9f0','#7209b7','#f77f00','#43aa8b'
];

async function carregarDados() {
  const mes = getMesSelecionado();
  const ano = getAnoSelecionado();

  const resp = await apiGet(`/dashboard/resumo?mes=${mes}&ano=${ano}`);
  if (!resp || !resp.ok) return;

  const d = resp.data;
  document.getElementById('anoGrafico').textContent = ano;

  // Cards
  document.getElementById('totalReceitas').textContent = formatarMoeda(d.totalReceitas);
  document.getElementById('totalGastos').textContent = formatarMoeda(d.totalGastos);
  document.getElementById('totalParcelas').textContent = formatarMoeda(d.totalParcelas);

  const saldoEl = document.getElementById('saldo');
  const cardSaldo = document.getElementById('cardSaldo');
  saldoEl.textContent = formatarMoeda(d.saldo);
  cardSaldo.classList.toggle('positivo', d.saldo >= 0);
  cardSaldo.classList.toggle('negativo', d.saldo < 0);

  // Barra de progresso
  const pct = d.totalReceitas > 0 ? Math.min((d.totalGastos / d.totalReceitas) * 100, 100) : 0;
  const barraFill = document.getElementById('barraFill');
  barraFill.style.width = pct.toFixed(1) + '%';
  barraFill.classList.toggle('perigo', pct > 80);
  document.getElementById('progressoTexto').textContent = `${pct.toFixed(1)}% comprometido`;
  document.getElementById('progressoValores').textContent =
    `${formatarMoeda(d.totalGastos)} de ${formatarMoeda(d.totalReceitas)}`;

  // Gráfico categorias (rosca)
  renderGraficoCategorias(d.categorias);

  // Gráfico anual (barras)
  renderGraficoAnual(d.evolucaoMensal);
}

function renderGraficoCategorias(categorias) {
  const ctx = document.getElementById('graficoCategorias').getContext('2d');

  if (graficoCat) graficoCat.destroy();

  if (!categorias || categorias.length === 0) {
    return;
  }

  const labels = categorias.map(c => c.categoria);
  const valores = categorias.map(c => parseFloat(c.total));
  const cores = categorias.map((_, i) => CORES[i % CORES.length]);

  graficoCat = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: cores,
        borderColor: '#1e2330',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatarMoeda(ctx.raw)}`
          }
        }
      },
      cutout: '65%'
    }
  });

  // Legenda customizada
  const legenda = document.getElementById('legendaCategorias');
  legenda.innerHTML = categorias.map((c, i) => `
    <div class="legenda-item">
      <div class="legenda-cor" style="background:${CORES[i % CORES.length]}"></div>
      <span class="legenda-nome">${c.categoria}</span>
      <span class="legenda-valor">${formatarMoeda(c.total)}</span>
    </div>
  `).join('');
}

function renderGraficoAnual(evolucao) {
  const ctx = document.getElementById('graficoAnual').getContext('2d');

  if (graficoAnual) graficoAnual.destroy();

  const labels = MESES.map(m => m.substring(0, 3));
  const receitas = evolucao.map(e => parseFloat(e.receitas));
  const despesas = evolucao.map(e => parseFloat(e.despesas));

  graficoAnual = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Receitas',
          data: receitas,
          backgroundColor: 'rgba(0,212,170,0.7)',
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Gastos',
          data: despesas,
          backgroundColor: 'rgba(255,77,109,0.7)',
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#7a8099', font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatarMoeda(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#7a8099', font: { size: 11 } },
          grid: { color: '#2a2f3d' }
        },
        y: {
          ticks: {
            color: '#7a8099',
            font: { size: 11 },
            callback: (v) => 'R$ ' + (v/1000).toFixed(0) + 'k'
          },
          grid: { color: '#2a2f3d' }
        }
      }
    }
  });
}

// Aguarda DOM + autenticação
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(carregarDados, 100);
});

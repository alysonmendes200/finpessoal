// ===== FINPESSOAL – DASHBOARD JS v2 =====

let graficoCat  = null;
let graficoAnual = null;

const CORES_CAT = [
  '#2563eb','#0891b2','#059669','#d97706','#7c3aed',
  '#db2777','#0284c7','#16a34a','#ea580c','#9333ea','#0f766e','#b45309'
];

async function carregarDados() {
  const mes = getMesSelecionado();
  const ano = getAnoSelecionado();

  const resp = await apiGet(`/dashboard/resumo?mes=${mes}&ano=${ano}`);
  if (!resp || !resp.ok) return;

  const d = resp.data;
  document.getElementById('anoGrafico').textContent = ano;

  // ── Cards ──
  document.getElementById('totalReceitas').textContent = formatarMoeda(d.totalReceitas);
  document.getElementById('totalGastos').textContent   = formatarMoeda(d.totalGastos);
  document.getElementById('totalParcelas').textContent = formatarMoeda(d.totalParcelas);

  const saldoEl   = document.getElementById('saldo');
  const cardSaldo = document.getElementById('cardSaldo');
  saldoEl.textContent = formatarMoeda(d.saldo);
  cardSaldo.classList.toggle('negativo', d.saldo < 0);

  // ── Diagnóstico ──
  renderDiagnostico('cardDiagnostico', d.totalReceitas, d.totalGastos, d.saldo);

  // ── Gráficos ──
  renderGraficoCategorias(d.categorias);
  renderGraficoAnual(d.evolucaoMensal);
}

function renderGraficoCategorias(categorias) {
  const ctx = document.getElementById('graficoCategorias').getContext('2d');
  if (graficoCat) graficoCat.destroy();

  if (!categorias || categorias.length === 0) {
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    document.getElementById('legendaCategorias').innerHTML =
      '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px 0">Sem gastos lançados neste mês</p>';
    return;
  }

  const labels = categorias.map(c => c.categoria);
  const valores = categorias.map(c => parseFloat(c.total));
  const cores   = categorias.map((_,i) => CORES_CAT[i % CORES_CAT.length]);

  graficoCat = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data:valores, backgroundColor:cores, borderColor:'#fff', borderWidth:3, hoverBorderWidth:4 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { display:false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatarMoeda(ctx.raw)}` } }
      },
      cutout:'68%'
    }
  });

  document.getElementById('legendaCategorias').innerHTML = categorias.map((c,i) => `
    <div class="legenda-item">
      <div class="legenda-cor" style="background:${CORES_CAT[i % CORES_CAT.length]}"></div>
      <span class="legenda-nome">${c.categoria}</span>
      <span class="legenda-valor">${formatarMoeda(c.total)}</span>
    </div>`).join('');
}

function renderGraficoAnual(evolucao) {
  const ctx = document.getElementById('graficoAnual').getContext('2d');
  if (graficoAnual) graficoAnual.destroy();

  const labels   = MESES.map(m => m.substring(0,3));
  const receitas = evolucao.map(e => parseFloat(e.receitas));
  const despesas = evolucao.map(e => parseFloat(e.despesas));

  graficoAnual = new Chart(ctx, {
    type:'bar',
    data: {
      labels,
      datasets: [
        { label:'Receitas', data:receitas, backgroundColor:'rgba(37,99,235,0.75)', borderRadius:6, borderSkipped:false },
        { label:'Gastos',   data:despesas, backgroundColor:'rgba(220,38,38,0.60)', borderRadius:6, borderSkipped:false }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { labels:{ color:'#64748b', font:{ size:12, family:'Inter' } } },
        tooltip: { callbacks:{ label:ctx => ` ${ctx.dataset.label}: ${formatarMoeda(ctx.raw)}` } }
      },
      scales: {
        x: { ticks:{ color:'#94a3b8', font:{ size:11 } }, grid:{ color:'#f1f5f9' } },
        y: { ticks:{ color:'#94a3b8', font:{ size:11 }, callback:v => 'R$ '+(v/1000).toFixed(0)+'k' }, grid:{ color:'#f1f5f9' } }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => { setTimeout(carregarDados, 150); });

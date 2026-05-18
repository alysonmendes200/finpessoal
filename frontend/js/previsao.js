// ===== FINPESSOAL – PREVISÕES JS v2 =====

let graficoProjecao = null;
let _dadosSimulacao  = null; // cache dos dados da última simulação

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Simulação principal ───────────────────────────────────────────
async function simular() {
  const mes = getMesSelecionado();
  const ano = getAnoSelecionado();

  const resp = await apiGet(`/previsao/simular?mes=${mes}&ano=${ano}`);
  if (!resp || !resp.ok) return;

  _dadosSimulacao = resp.data;
  renderTudo(_dadosSimulacao);
}

// ── Atualizar apenas o simulador de compra (sem nova chamada API) ─
function atualizarSimulador() {
  if (!_dadosSimulacao) return;
  const simValor    = parseFloat(document.getElementById('simValor').value)    || 0;
  const simParcelas = parseInt(document.getElementById('simParcelas').value)   || 1;
  const simValParc  = simParcelas > 0 ? simValor / simParcelas : simValor;

  // Aplica impacto sobre projecao6meses do cache
  const projecaoComImpacto = _dadosSimulacao.projecao6meses.map((p, i) => ({
    ...p,
    totalDespesas: p.totalDespesas + (i < simParcelas ? simValParc : 0),
    saldo:         p.saldo         - (i < simParcelas ? simValParc : 0),
    impactoSim:    i < simParcelas ? simValParc : 0
  }));

  renderGrafico(projecaoComImpacto, simValor > 0);

  // Resumo textual do simulador
  const el = document.getElementById('simResumo');
  if (simValor > 0) {
    const totalImpacto = simValParc * Math.min(simParcelas, 6);
    el.textContent = `💡 ${simParcelas}x de ${formatarMoeda(simValParc)} — impacto de ${formatarMoeda(totalImpacto)} nos próximos ${Math.min(simParcelas,6)} meses.`;
  } else {
    el.textContent = '';
  }
}

// ── Renderiza tudo com os dados da API ────────────────────────────
function renderTudo(d) {
  // Cards
  document.getElementById('prevReceitas').textContent  = formatarMoeda(d.totalReceitas);
  document.getElementById('prevDespFixas').textContent = formatarMoeda(d.despesas.totalFixas);
  document.getElementById('prevParcelas').textContent  = formatarMoeda(d.despesas.totalParcelamentos);
  document.getElementById('prevSaldo').textContent     = formatarMoeda(d.saldoProjetado);
  document.getElementById('cardSaldoPrev').classList.toggle('negativo', d.saldoProjetado < 0);

  // Diagnóstico
  renderDiagnostico('cardDiagnostico', d.totalReceitas, d.totalDespesas, d.saldoProjetado);

  // Fatura Fantasma
  const ff = d.faturaFantasma;
  if (ff && ff.totalEstimado > 0) {
    document.getElementById('faturaFantasmaBox').style.display = 'flex';
    document.getElementById('faturaFantasmaTexto').textContent =
      `Fatura atual: ${formatarMoeda(ff.faturaAtual)} + compromissos parcelados: ${formatarMoeda(ff.faturaFutura)}`;
    document.getElementById('faturaFantasmaVal').textContent = formatarMoeda(ff.totalEstimado);
  } else {
    document.getElementById('faturaFantasmaBox').style.display = 'none';
  }

  // Regra 50/30/20
  const r = d.regra502030;
  if (r) {
    const pct50 = r.ideal50 > 0 ? Math.min((r.necessidades / r.ideal50) * 100, 120) : 0;
    const pct30 = r.ideal30 > 0 ? Math.min((r.desejos / r.ideal30) * 100, 120) : 0;
    const pct20 = r.ideal20 > 0 ? Math.min((r.futuro   / r.ideal20) * 100, 120) : 0;

    document.getElementById('reg50Val').textContent   = formatarMoeda(r.necessidades);
    document.getElementById('reg50Ideal').textContent = `Ideal: ${formatarMoeda(r.ideal50)}`;
    document.getElementById('reg50Bar').style.width   = pct50.toFixed(1) + '%';

    document.getElementById('reg30Val').textContent   = formatarMoeda(r.desejos);
    document.getElementById('reg30Ideal').textContent = `Ideal: ${formatarMoeda(r.ideal30)}`;
    document.getElementById('reg30Bar').style.width   = pct30.toFixed(1) + '%';

    document.getElementById('reg20Val').textContent   = formatarMoeda(r.futuro);
    document.getElementById('reg20Ideal').textContent = `Ideal: ${formatarMoeda(r.ideal20)}`;
    document.getElementById('reg20Bar').style.width   = pct20.toFixed(1) + '%';
  }

  // Tabela entradas
  const tbEnt = document.getElementById('tabelaEntradas');
  const linhasEnt = [];
  d.receitas.fixas.forEach(r => linhasEnt.push(
    `<tr><td>${r.descricao}</td><td><span class="badge badge-fixo">Fixa</span></td>
     <td style="text-align:right;color:var(--green);font-weight:700">${formatarMoeda(r.valor)}</td></tr>`
  ));
  d.receitas.parceladas.forEach(r => linhasEnt.push(
    `<tr><td>${r.descricao}</td><td><span class="badge badge-parcelado">${r.label}</span></td>
     <td style="text-align:right;color:var(--green);font-weight:700">${formatarMoeda(r.valor_parcela)}</td></tr>`
  ));
  d.receitas.unicas.forEach(r => linhasEnt.push(
    `<tr><td>${r.descricao}</td><td><span class="badge badge-unico">Único</span></td>
     <td style="text-align:right;color:var(--green);font-weight:700">${formatarMoeda(r.valor)}</td></tr>`
  ));
  if (linhasEnt.length) {
    linhasEnt.push(
      `<tr style="background:#f8fafc"><td colspan="2" style="font-weight:700;color:var(--text)">Total</td>
       <td style="text-align:right;font-weight:800;color:var(--green)">${formatarMoeda(d.totalReceitas)}</td></tr>`
    );
  }
  tbEnt.innerHTML = linhasEnt.length
    ? linhasEnt.join('')
    : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma entrada projetada</td></tr>';

  // Tabela saídas
  const tbSai = document.getElementById('tabelaSaidas');
  const linhasSai = [];
  d.despesas.fixas.forEach(dp => linhasSai.push(
    `<tr><td>${dp.descricao}</td><td><span class="badge badge-fixo">Fixa</span></td>
     <td style="text-align:right;color:var(--red);font-weight:700">${formatarMoeda(dp.valor)}</td></tr>`
  ));
  d.despesas.parcelamentos.forEach(p => linhasSai.push(
    `<tr><td>${p.descricao}</td><td><span class="badge badge-saida">${p.label}</span></td>
     <td style="text-align:right;color:var(--red);font-weight:700">${formatarMoeda(p.valor_parcela)}</td></tr>`
  ));
  if (linhasSai.length) {
    linhasSai.push(
      `<tr style="background:#f8fafc"><td colspan="2" style="font-weight:700;color:var(--text)">Total</td>
       <td style="text-align:right;font-weight:800;color:var(--red)">${formatarMoeda(d.totalDespesas)}</td></tr>`
    );
  }
  tbSai.innerHTML = linhasSai.length
    ? linhasSai.join('')
    : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:20px">Nenhuma saída fixa projetada</td></tr>';

  // Tabela parcelamentos
  const tbParc = document.getElementById('tabelaParcelamentos');
  const todos = [
    ...d.despesas.parcelamentos.map(p => ({ ...p, sentido:'saida' })),
    ...d.receitas.parceladas.map(p => ({ ...p, sentido:'entrada' }))
  ];
  if (!todos.length) {
    tbParc.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum parcelamento ativo neste mês</td></tr>';
  } else {
    tbParc.innerHTML = todos.map(p => {
      const restantes = p.total_parcelas - parseInt(p.numero_parcela) + 1;
      const valRestante = restantes * parseFloat(p.valor_parcela);
      const cor = p.sentido === 'entrada' ? 'var(--green)' : 'var(--red)';
      const sinal = p.sentido === 'entrada' ? '+' : '-';
      return `<tr>
        <td>${p.descricao} <span class="badge badge-${p.sentido}">${p.sentido === 'entrada' ? '📥' : '📤'}</span></td>
        <td><span class="badge badge-${p.sentido}">${p.label}</span></td>
        <td style="color:var(--text-muted)">${p.categoria}</td>
        <td style="text-align:right;font-weight:700;color:${cor}">${sinal}${formatarMoeda(p.valor_parcela)}</td>
        <td style="text-align:right;color:var(--text-muted)">${formatarMoeda(valRestante)}</td>
      </tr>`;
    }).join('');
  }

  // Gráfico (sem simulador ativo)
  renderGrafico(d.projecao6meses, false);
}

// ── Gráfico de projeção ───────────────────────────────────────────
function renderGrafico(projecao, comSimulador) {
  const ctx = document.getElementById('graficoProjecao').getContext('2d');
  if (graficoProjecao) graficoProjecao.destroy();

  const labels   = projecao.map(p => `${MESES_ABREV[p.mes-1]}/${String(p.ano).slice(2)}`);
  const receitas = projecao.map(p => parseFloat(p.totalReceitas));
  const despesas = projecao.map(p => parseFloat(p.totalDespesas));
  const saldos   = projecao.map(p => parseFloat(p.saldo));
  const impactos = projecao.map(p => parseFloat(p.impactoSim || 0));

  const datasets = [
    { label:'Receitas', data:receitas, backgroundColor:'rgba(37,99,235,0.75)',  borderRadius:6, borderSkipped:false, order:1 },
    { label:'Despesas', data:despesas, backgroundColor:'rgba(220,38,38,0.65)',  borderRadius:6, borderSkipped:false, order:1 },
    {
      label:'Saldo', data:saldos, type:'line',
      borderColor:'#059669', backgroundColor:'rgba(5,150,105,0.08)',
      pointBackgroundColor:'#059669', pointRadius:5, borderWidth:2.5, tension:0.35, fill:true, order:0
    }
  ];

  if (comSimulador) {
    datasets.push({
      label:'Impacto da Compra', data:impactos,
      backgroundColor:'rgba(249,115,22,0.55)', borderRadius:6, borderSkipped:false, order:1
    });
  }

  graficoProjecao = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
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

document.addEventListener('DOMContentLoaded', () => { setTimeout(simular, 150); });

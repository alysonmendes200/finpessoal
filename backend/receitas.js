const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// ── Helper: monta dados de um mês específico ──────────────────────
async function calcularMes(uid, mes, ano, totalFixasRec, totalFixasDesp) {
  const [rp, dp] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(valor_parcela),0) AS total FROM receitas_parceladas
       WHERE usuario_id=$1
         AND (ano_inicio < $3 OR (ano_inicio=$3 AND mes_inicio<=$2))
         AND ($3::int - ano_inicio)*12 + ($2::int - mes_inicio) < total_parcelas`,
      [uid, mes, ano]
    ),
    pool.query(
      `SELECT COALESCE(SUM(valor_parcela),0) AS total FROM parcelamentos
       WHERE usuario_id=$1
         AND (ano_inicio < $3 OR (ano_inicio=$3 AND mes_inicio<=$2))
         AND ($3::int - ano_inicio)*12 + ($2::int - mes_inicio) < total_parcelas`,
      [uid, mes, ano]
    )
  ]);
  const totalRec  = totalFixasRec  + parseFloat(rp.rows[0].total);
  const totalDesp = totalFixasDesp + parseFloat(dp.rows[0].total);
  return { mes, ano, totalReceitas: totalRec, totalDespesas: totalDesp, saldo: totalRec - totalDesp };
}

// ── GET /api/previsao/simular ─────────────────────────────────────
router.get('/simular', autenticar, async (req, res) => {
  const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
  const ano = parseInt(req.query.ano) || new Date().getFullYear();
  const uid = req.usuario.id;

  // Opcional: valor fictício de nova compra para simulação de impacto
  const simValor    = parseFloat(req.query.sim_valor)    || 0;
  const simParcelas = parseInt(req.query.sim_parcelas)   || 1;
  const simValParc  = simParcelas > 0 ? simValor / simParcelas : simValor;

  try {
    // ── RECEITAS ─────────────────────────────────────────────────

    // Fixas: mais recente de cada descrição distinta
    const fixasRecRes = await pool.query(
      `SELECT DISTINCT ON (descricao) descricao, valor, categoria
       FROM receitas WHERE usuario_id=$1 AND tipo='fixo'
       ORDER BY descricao, ano DESC, mes DESC`,
      [uid]
    );
    const receitasFixas      = fixasRecRes.rows;
    const totalReceitasFixas = receitasFixas.reduce((s, r) => s + parseFloat(r.valor), 0);

    // Parceladas ativas no mês simulado
    const recParRes = await pool.query(
      `SELECT *, ($2::int - mes_inicio + ($3::int - ano_inicio)*12 + 1) AS numero_parcela
       FROM receitas_parceladas
       WHERE usuario_id=$1
         AND (ano_inicio<$3 OR (ano_inicio=$3 AND mes_inicio<=$2))
         AND ($3::int - ano_inicio)*12 + ($2::int - mes_inicio) < total_parcelas
       ORDER BY criado_em DESC`,
      [uid, mes, ano]
    );
    const receitasParceladas      = recParRes.rows;
    const totalReceitasParceladas = receitasParceladas.reduce((s, r) => s + parseFloat(r.valor_parcela), 0);

    // Únicas do mês
    const unicasRes = await pool.query(
      `SELECT * FROM receitas WHERE usuario_id=$1 AND tipo='unico' AND mes=$2 AND ano=$3`,
      [uid, mes, ano]
    );
    const receitasUnicas      = unicasRes.rows;
    const totalReceitasUnicas = receitasUnicas.reduce((s, r) => s + parseFloat(r.valor), 0);

    const totalReceitas = totalReceitasFixas + totalReceitasParceladas + totalReceitasUnicas;

    // ── DESPESAS ─────────────────────────────────────────────────

    const fixasDesRes = await pool.query(
      `SELECT DISTINCT ON (descricao) descricao, valor, categoria
       FROM despesas WHERE usuario_id=$1 AND tipo='fixo'
       ORDER BY descricao, ano DESC, mes DESC`,
      [uid]
    );
    const despesasFixas      = fixasDesRes.rows;
    const totalDespesasFixas = despesasFixas.reduce((s, d) => s + parseFloat(d.valor), 0);

    const parRes = await pool.query(
      `SELECT *, ($2::int - mes_inicio + ($3::int - ano_inicio)*12 + 1) AS numero_parcela
       FROM parcelamentos
       WHERE usuario_id=$1
         AND (ano_inicio<$3 OR (ano_inicio=$3 AND mes_inicio<=$2))
         AND ($3::int - ano_inicio)*12 + ($2::int - mes_inicio) < total_parcelas
       ORDER BY criado_em DESC`,
      [uid, mes, ano]
    );
    const parcelamentos      = parRes.rows;
    const totalParcelamentos = parcelamentos.reduce((s, p) => s + parseFloat(p.valor_parcela), 0);

    const totalDespesas   = totalDespesasFixas + totalParcelamentos;
    const saldoProjetado  = totalReceitas - totalDespesas;
    const pctComprometido = totalReceitas > 0
      ? Math.min((totalDespesas / totalReceitas) * 100, 100)
      : 0;

    // ── DIAGNÓSTICO ───────────────────────────────────────────────
    let diagnostico;
    if (saldoProjetado > 0) {
      const pctLivre = ((saldoProjetado / totalReceitas) * 100).toFixed(1);
      diagnostico = {
        tipo:    'sucesso',
        emoji:   '🟢',
        titulo:  'CONFIRMADO: Orçamento no azul.',
        detalhe: `Sobra líquida de ${formatBRL(saldoProjetado)} (${pctLivre}% livre)`
      };
    } else if (saldoProjetado === 0) {
      diagnostico = {
        tipo:    'alerta',
        emoji:   '🟡',
        titulo:  'ALERTA: Orçamento zerado.',
        detalhe: 'Vivendo no limite — sem margem para imprevistos'
      };
    } else {
      diagnostico = {
        tipo:    'perigo',
        emoji:   '🔴',
        titulo:  'PERIGO: O dinheiro NÃO vai dar!',
        detalhe: `Faltam ${formatBRL(Math.abs(saldoProjetado))} para cobrir as contas`
      };
    }

    // ── REGRA 50/30/20 ────────────────────────────────────────────
    // Classifica despesas fixas como "necessidades" (50%)
    // parcelamentos como "desejos" (30%)
    // O restante é o "futuro" (20%)
    const necessidades = totalDespesasFixas;
    const desejos      = totalParcelamentos;
    const futuro       = Math.max(saldoProjetado, 0);
    const ideal50      = totalReceitas * 0.50;
    const ideal30      = totalReceitas * 0.30;
    const ideal20      = totalReceitas * 0.20;

    // ── ALERTA FATURA FANTASMA ────────────────────────────────────
    // Parcelas de cartão (tipo='fatura') do mês atual
    const faturaRes = await pool.query(
      `SELECT COALESCE(SUM(valor),0) AS total_atual
       FROM despesas
       WHERE usuario_id=$1 AND tipo='fatura' AND mes=$2 AND ano=$3`,
      [uid, mes, ano]
    );
    // Parcelas de compras parceladas já contratadas nos próximos meses
    const faturaFuturaRes = await pool.query(
      `SELECT COALESCE(SUM(valor_parcela),0) AS total_futuro
       FROM parcelamentos
       WHERE usuario_id=$1
         AND (ano_inicio < $3 OR (ano_inicio=$3 AND mes_inicio<=$2))
         AND ($3::int - ano_inicio)*12 + ($2::int - mes_inicio) < total_parcelas`,
      [uid, mes, ano]
    );
    const faturaAtual  = parseFloat(faturaRes.rows[0].total_atual);
    const faturaFutura = parseFloat(faturaFuturaRes.rows[0].total_futuro);

    // ── PROJEÇÃO 6 MESES (com simulador de nova compra opcional) ──
    const projecao6meses = [];
    for (let i = 0; i < 6; i++) {
      let m = mes + i, a = ano;
      while (m > 12) { m -= 12; a++; }

      const base = await calcularMes(uid, m, a, totalReceitasFixas, totalDespesasFixas);

      // Adiciona impacto da compra simulada (se informada)
      const impactoSim = simValor > 0 && i < simParcelas ? simValParc : 0;

      projecao6meses.push({
        ...base,
        totalDespesas:    base.totalDespesas + impactoSim,
        saldo:            base.saldo - impactoSim,
        impactoSimulado:  impactoSim
      });
    }

    res.json({
      mes, ano,
      totalReceitas, totalDespesas, saldoProjetado,
      pctComprometido,
      diagnostico,
      regra502030: {
        necessidades, desejos, futuro,
        ideal50, ideal30, ideal20
      },
      faturaFantasma: { faturaAtual, faturaFutura, totalEstimado: faturaAtual + faturaFutura },
      simulador:      { valor: simValor, parcelas: simParcelas, valorParcela: simValParc },
      receitas: {
        fixas:      receitasFixas,
        parceladas: receitasParceladas.map(r => ({ ...r, label: `Parcela ${r.numero_parcela} de ${r.total_parcelas}` })),
        unicas:     receitasUnicas,
        totalFixas: totalReceitasFixas, totalParceladas: totalReceitasParceladas, totalUnicas: totalReceitasUnicas
      },
      despesas: {
        fixas:        despesasFixas,
        parcelamentos: parcelamentos.map(p => ({ ...p, label: `Parcela ${p.numero_parcela} de ${p.total_parcelas}` })),
        totalFixas:   totalDespesasFixas, totalParcelamentos
      },
      projecao6meses
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao calcular previsão.' });
  }
});

// Helper server-side para formatar valor (apenas para o diagnóstico no JSON)
function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

module.exports = router;

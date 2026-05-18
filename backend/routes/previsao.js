const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// Helper: calcula o total de meses entre (mesA, anoA) e (mesB, anoB)
function diffMeses(mesInicio, anoInicio, mesFim, anoFim) {
  return (anoFim - anoInicio) * 12 + (mesFim - mesInicio);
}

// GET /api/previsao/simular?mes=&ano=
router.get('/simular', autenticar, async (req, res) => {
  const mes  = parseInt(req.query.mes)  || new Date().getMonth() + 1;
  const ano  = parseInt(req.query.ano)  || new Date().getFullYear();
  const uid  = req.usuario.id;

  try {
    // ── RECEITAS ──────────────────────────────────────────────────

    // 1. Receitas fixas recorrentes (qualquer mês/ano, tipo='fixo')
    //    Pegamos o valor mais recente de cada descrição
    const fixasRes = await pool.query(
      `SELECT DISTINCT ON (descricao) descricao, valor, categoria
       FROM receitas
       WHERE usuario_id = $1 AND tipo = 'fixo'
       ORDER BY descricao, ano DESC, mes DESC`,
      [uid]
    );
    const receitasFixas = fixasRes.rows;
    const totalReceitasFixas = receitasFixas.reduce((s, r) => s + parseFloat(r.valor), 0);

    // 2. Receitas parceladas ativas no mês simulado
    const recParceladasRes = await pool.query(
      `SELECT *,
         ($2::int - mes_inicio + ($3::int - ano_inicio) * 12 + 1) AS numero_parcela
       FROM receitas_parceladas
       WHERE usuario_id = $1
         AND (ano_inicio < $3 OR (ano_inicio = $3 AND mes_inicio <= $2))
         AND ($3::int - ano_inicio) * 12 + ($2::int - mes_inicio) < total_parcelas
       ORDER BY criado_em DESC`,
      [uid, mes, ano]
    );
    const receitasParceladas = recParceladasRes.rows;
    const totalReceitasParceladas = receitasParceladas.reduce((s, r) => s + parseFloat(r.valor_parcela), 0);

    // 3. Receitas únicas lançadas explicitamente para o mês
    const unicasRes = await pool.query(
      `SELECT * FROM receitas
       WHERE usuario_id = $1 AND tipo = 'unico' AND mes = $2 AND ano = $3`,
      [uid, mes, ano]
    );
    const receitasUnicas = unicasRes.rows;
    const totalReceitasUnicas = receitasUnicas.reduce((s, r) => s + parseFloat(r.valor), 0);

    const totalReceitas = totalReceitasFixas + totalReceitasParceladas + totalReceitasUnicas;

    // ── DESPESAS ─────────────────────────────────────────────────

    // 1. Despesas fixas recorrentes
    const despFixasRes = await pool.query(
      `SELECT DISTINCT ON (descricao) descricao, valor, categoria
       FROM despesas
       WHERE usuario_id = $1 AND tipo = 'fixo'
       ORDER BY descricao, ano DESC, mes DESC`,
      [uid]
    );
    const despesasFixas = despFixasRes.rows;
    const totalDespesasFixas = despesasFixas.reduce((s, d) => s + parseFloat(d.valor), 0);

    // 2. Parcelamentos de despesa ativos no mês simulado
    const parcelamentosRes = await pool.query(
      `SELECT *,
         ($2::int - mes_inicio + ($3::int - ano_inicio) * 12 + 1) AS numero_parcela
       FROM parcelamentos
       WHERE usuario_id = $1
         AND (ano_inicio < $3 OR (ano_inicio = $3 AND mes_inicio <= $2))
         AND ($3::int - ano_inicio) * 12 + ($2::int - mes_inicio) < total_parcelas
       ORDER BY criado_em DESC`,
      [uid, mes, ano]
    );
    const parcelamentos = parcelamentosRes.rows;
    const totalParcelamentos = parcelamentos.reduce((s, p) => s + parseFloat(p.valor_parcela), 0);

    const totalDespesas = totalDespesasFixas + totalParcelamentos;
    const saldoProjetado = totalReceitas - totalDespesas;

    // ── PROJEÇÃO 6 MESES ─────────────────────────────────────────
    const projecao6meses = [];
    for (let i = 0; i < 6; i++) {
      let m = mes + i;
      let a = ano;
      while (m > 12) { m -= 12; a++; }

      // Receitas fixas (mesmo valor)
      const rFixas = totalReceitasFixas;

      // Receitas parceladas no mês i
      const rpRes = await pool.query(
        `SELECT COALESCE(SUM(valor_parcela), 0) as total
         FROM receitas_parceladas
         WHERE usuario_id = $1
           AND (ano_inicio < $3 OR (ano_inicio = $3 AND mes_inicio <= $2))
           AND ($3::int - ano_inicio) * 12 + ($2::int - mes_inicio) < total_parcelas`,
        [uid, m, a]
      );
      const rParc = parseFloat(rpRes.rows[0].total);

      // Despesas fixas
      const dFixas = totalDespesasFixas;

      // Parcelamentos no mês i
      const dpRes = await pool.query(
        `SELECT COALESCE(SUM(valor_parcela), 0) as total
         FROM parcelamentos
         WHERE usuario_id = $1
           AND (ano_inicio < $3 OR (ano_inicio = $3 AND mes_inicio <= $2))
           AND ($3::int - ano_inicio) * 12 + ($2::int - mes_inicio) < total_parcelas`,
        [uid, m, a]
      );
      const dParc = parseFloat(dpRes.rows[0].total);

      projecao6meses.push({
        mes: m,
        ano: a,
        totalReceitas: rFixas + rParc,
        totalDespesas: dFixas + dParc,
        saldo: (rFixas + rParc) - (dFixas + dParc)
      });
    }

    res.json({
      mes, ano,
      totalReceitas,
      totalDespesas,
      saldoProjetado,
      receitas: {
        fixas: receitasFixas,
        parceladas: receitasParceladas.map(r => ({
          ...r,
          label: `Parcela ${r.numero_parcela} de ${r.total_parcelas}`
        })),
        unicas: receitasUnicas,
        totalFixas: totalReceitasFixas,
        totalParceladas: totalReceitasParceladas,
        totalUnicas: totalReceitasUnicas
      },
      despesas: {
        fixas: despesasFixas,
        parcelamentos: parcelamentos.map(p => ({
          ...p,
          label: `Parcela ${p.numero_parcela} de ${p.total_parcelas}`
        })),
        totalFixas: totalDespesasFixas,
        totalParcelamentos
      },
      projecao6meses
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao calcular previsão.' });
  }
});

module.exports = router;

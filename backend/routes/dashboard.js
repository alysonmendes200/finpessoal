const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// Resumo geral do mês
router.get('/resumo', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const mesAtual = parseInt(mes) || new Date().getMonth() + 1;
  const anoAtual = parseInt(ano) || new Date().getFullYear();
  const uid = req.usuario.id;

  try {
    // Total receitas
    const receitasRes = await pool.query(
      'SELECT COALESCE(SUM(valor),0) as total FROM receitas WHERE usuario_id=$1 AND mes=$2 AND ano=$3',
      [uid, mesAtual, anoAtual]
    );

    // Total despesas
    const despesasRes = await pool.query(
      'SELECT COALESCE(SUM(valor),0) as total FROM despesas WHERE usuario_id=$1 AND mes=$2 AND ano=$3',
      [uid, mesAtual, anoAtual]
    );

    // Total parcelas do mês
    const parcelasRes = await pool.query(
      `SELECT COALESCE(SUM(valor_parcela),0) as total FROM parcelamentos
       WHERE usuario_id=$1
         AND (ano_inicio < $3 OR (ano_inicio = $3 AND mes_inicio <= $2))
         AND ($3::int - ano_inicio) * 12 + ($2::int - mes_inicio) < total_parcelas`,
      [uid, mesAtual, anoAtual]
    );

    // Despesas por categoria
    const categoriaRes = await pool.query(
      `SELECT categoria, SUM(valor) as total FROM despesas 
       WHERE usuario_id=$1 AND mes=$2 AND ano=$3 GROUP BY categoria ORDER BY total DESC`,
      [uid, mesAtual, anoAtual]
    );

    // Evolução mensal do ano (receitas vs despesas)
    const evolucaoRes = await pool.query(
      `SELECT 
        m.mes,
        COALESCE(r.total, 0) as receitas,
        COALESCE(d.total, 0) as despesas
       FROM generate_series(1,12) AS m(mes)
       LEFT JOIN (SELECT mes, SUM(valor) as total FROM receitas WHERE usuario_id=$1 AND ano=$2 GROUP BY mes) r ON r.mes = m.mes
       LEFT JOIN (SELECT mes, SUM(valor) as total FROM despesas WHERE usuario_id=$1 AND ano=$2 GROUP BY mes) d ON d.mes = m.mes
       ORDER BY m.mes`,
      [uid, anoAtual]
    );

    const totalReceitas = parseFloat(receitasRes.rows[0].total);
    const totalDespesas = parseFloat(despesasRes.rows[0].total);
    const totalParcelas = parseFloat(parcelasRes.rows[0].total);
    const totalGastos = totalDespesas + totalParcelas;
    const saldo = totalReceitas - totalGastos;

    res.json({
      mes: mesAtual,
      ano: anoAtual,
      totalReceitas,
      totalDespesas,
      totalParcelas,
      totalGastos,
      saldo,
      categorias: categoriaRes.rows,
      evolucaoMensal: evolucaoRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar resumo.' });
  }
});

module.exports = router;

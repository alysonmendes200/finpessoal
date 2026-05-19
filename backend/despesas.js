const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

router.get('/resumo', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const mesAtual = parseInt(mes) || new Date().getMonth() + 1;
  const anoAtual = parseInt(ano) || new Date().getFullYear();
  const uid = req.usuario.id;

  try {
    // ── RECEITAS ─────────────────────────────────────────────────

    // 1. Receitas únicas lançadas para este mês/ano exato
    const recUnicasRes = await pool.query(
      `SELECT COALESCE(SUM(valor),0) as total
       FROM receitas
       WHERE usuario_id=$1 AND tipo='unico' AND mes=$2 AND ano=$3`,
      [uid, mesAtual, anoAtual]
    );

    // 2. Receitas fixas: pega o valor mais recente de cada descrição distinta
    //    e projeta para o mês selecionado (independente de qual mês foi cadastrado)
    const recFixasRes = await pool.query(
      `SELECT COALESCE(SUM(ultimo_valor),0) as total FROM (
         SELECT DISTINCT ON (descricao) descricao, valor AS ultimo_valor
         FROM receitas
         WHERE usuario_id=$1 AND tipo='fixo'
         ORDER BY descricao, ano DESC, mes DESC
       ) sub`,
      [uid]
    );

    // 3. Parcelas de receita ativas neste mês
    const recParceladasRes = await pool.query(
      `SELECT COALESCE(SUM(valor_parcela),0) as total
       FROM receitas_parceladas
       WHERE usuario_id=$1
         AND (ano_inicio < $3 OR (ano_inicio = $3 AND mes_inicio <= $2))
         AND ($3::int - ano_inicio) * 12 + ($2::int - mes_inicio) < total_parcelas`,
      [uid, mesAtual, anoAtual]
    );

    const totalReceitas =
      parseFloat(recUnicasRes.rows[0].total) +
      parseFloat(recFixasRes.rows[0].total) +
      parseFloat(recParceladasRes.rows[0].total);

    // ── DESPESAS ─────────────────────────────────────────────────

    // Despesas lançadas para este mês (qualquer tipo)
    const despesasRes = await pool.query(
      `SELECT COALESCE(SUM(valor),0) as total
       FROM despesas
       WHERE usuario_id=$1 AND mes=$2 AND ano=$3`,
      [uid, mesAtual, anoAtual]
    );

    // Parcelamentos ativos no mês
    const parcelasRes = await pool.query(
      `SELECT COALESCE(SUM(valor_parcela),0) as total
       FROM parcelamentos
       WHERE usuario_id=$1
         AND (ano_inicio < $3 OR (ano_inicio = $3 AND mes_inicio <= $2))
         AND ($3::int - ano_inicio) * 12 + ($2::int - mes_inicio) < total_parcelas`,
      [uid, mesAtual, anoAtual]
    );

    const totalDespesas = parseFloat(despesasRes.rows[0].total);
    const totalParcelas = parseFloat(parcelasRes.rows[0].total);
    const totalGastos   = totalDespesas + totalParcelas;
    const saldo         = totalReceitas - totalGastos;

    // ── GRÁFICO CATEGORIAS ────────────────────────────────────────
    // Combina despesas manuais + parcelamentos do mês
    const categoriaRes = await pool.query(
      `SELECT categoria, SUM(valor) as total
       FROM despesas
       WHERE usuario_id=$1 AND mes=$2 AND ano=$3
       GROUP BY categoria
       ORDER BY total DESC`,
      [uid, mesAtual, anoAtual]
    );

    // ── EVOLUÇÃO ANUAL ────────────────────────────────────────────
    // Para cada mês do ano, soma:
    //   receitas únicas + receitas fixas projetadas + parceladas de receita
    //   vs despesas manuais + parcelamentos
    const evolucaoRes = await pool.query(
      `SELECT
         m.mes,
         COALESCE(r_unica.total, 0)                        AS rec_unica,
         COALESCE(r_parc.total, 0)                         AS rec_parc,
         COALESCE(d.total, 0)                              AS despesas,
         COALESCE(p.total, 0)                              AS parcelamentos
       FROM generate_series(1,12) AS m(mes)
       -- receitas únicas
       LEFT JOIN (
         SELECT mes, SUM(valor) as total
         FROM receitas WHERE usuario_id=$1 AND ano=$2 AND tipo='unico'
         GROUP BY mes
       ) r_unica ON r_unica.mes = m.mes
       -- receitas parceladas de entrada ativas em cada mês do ano
       LEFT JOIN (
         SELECT gen.mes,
           COALESCE(SUM(rp.valor_parcela),0) AS total
         FROM generate_series(1,12) gen(mes)
         LEFT JOIN receitas_parceladas rp
           ON rp.usuario_id=$1
           AND (rp.ano_inicio < $2 OR (rp.ano_inicio = $2 AND rp.mes_inicio <= gen.mes))
           AND ($2::int - rp.ano_inicio) * 12 + (gen.mes - rp.mes_inicio) < rp.total_parcelas
         GROUP BY gen.mes
       ) r_parc ON r_parc.mes = m.mes
       -- despesas manuais
       LEFT JOIN (
         SELECT mes, SUM(valor) as total
         FROM despesas WHERE usuario_id=$1 AND ano=$2
         GROUP BY mes
       ) d ON d.mes = m.mes
       -- parcelamentos de despesa ativos em cada mês do ano
       LEFT JOIN (
         SELECT gen.mes,
           COALESCE(SUM(par.valor_parcela),0) AS total
         FROM generate_series(1,12) gen(mes)
         LEFT JOIN parcelamentos par
           ON par.usuario_id=$1
           AND (par.ano_inicio < $2 OR (par.ano_inicio = $2 AND par.mes_inicio <= gen.mes))
           AND ($2::int - par.ano_inicio) * 12 + (gen.mes - par.mes_inicio) < par.total_parcelas
         GROUP BY gen.mes
       ) p ON p.mes = m.mes
       ORDER BY m.mes`,
      [uid, anoAtual]
    );

    // Valor das fixas para o ano todo (projetado)
    const totalFixasAno = parseFloat(recFixasRes.rows[0].total);

    const evolucaoMensal = evolucaoRes.rows.map(row => ({
      mes: row.mes,
      // receitas = únicas daquele mês + parceladas ativas + fixas projetadas
      receitas: parseFloat(row.rec_unica) + parseFloat(row.rec_parc) + totalFixasAno,
      despesas: parseFloat(row.despesas) + parseFloat(row.parcelamentos)
    }));

    res.json({
      mes: mesAtual,
      ano: anoAtual,
      totalReceitas,
      totalDespesas,
      totalParcelas,
      totalGastos,
      saldo,
      categorias: categoriaRes.rows,
      evolucaoMensal
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar resumo.' });
  }
});

module.exports = router;

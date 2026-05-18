const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// Listar parcelamentos ativos
router.get('/', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *, 
        (total_parcelas - parcela_atual + 1) as parcelas_restantes,
        ((total_parcelas - parcela_atual + 1) * valor_parcela) as valor_restante
       FROM parcelamentos 
       WHERE usuario_id = $1 AND parcela_atual <= total_parcelas
       ORDER BY criado_em DESC`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar parcelamentos.' });
  }
});

// Adicionar parcelamento
router.post('/', autenticar, async (req, res) => {
  const { descricao, valor_total, valor_parcela, total_parcelas, mes_inicio, ano_inicio, categoria } = req.body;

  if (!descricao || !valor_total || !valor_parcela || !total_parcelas || !mes_inicio || !ano_inicio) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO parcelamentos 
       (usuario_id, descricao, valor_total, valor_parcela, total_parcelas, parcela_atual, mes_inicio, ano_inicio, categoria) 
       VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8) RETURNING *`,
      [req.usuario.id, descricao, valor_total, valor_parcela, total_parcelas, mes_inicio, ano_inicio, categoria || 'outros']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar parcelamento.' });
  }
});

// Avançar parcela (marcar parcela como paga)
router.patch('/:id/avancar', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE parcelamentos SET parcela_atual = parcela_atual + 1 
       WHERE id = $1 AND usuario_id = $2 AND parcela_atual < total_parcelas RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ erro: 'Parcelamento já concluído ou não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao avançar parcela.' });
  }
});

// Deletar parcelamento
router.delete('/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM parcelamentos WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Parcelamento removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar parcelamento.' });
  }
});

// Total de parcelas do mês atual
router.get('/total-mes', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const mesAtual = parseInt(mes) || new Date().getMonth() + 1;
  const anoAtual = parseInt(ano) || new Date().getFullYear();

  try {
    // Busca parcelamentos que estão ativos no mês/ano solicitado
    const result = await pool.query(
      `SELECT *, 
        (($2::int - mes_inicio) + ($3::int - ano_inicio) * 12 + 1) as parcela_do_mes
       FROM parcelamentos
       WHERE usuario_id = $1
         AND (ano_inicio < $3 OR (ano_inicio = $3 AND mes_inicio <= $2))
         AND (
           ($3::int - ano_inicio) * 12 + ($2::int - mes_inicio) < total_parcelas
         )
       ORDER BY criado_em DESC`,
      [req.usuario.id, mesAtual, anoAtual]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar parcelamentos do mês.' });
  }
});

module.exports = router;

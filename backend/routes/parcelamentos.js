const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// Listar parcelamentos ativos
router.get('/', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *,
         (total_parcelas - parcela_atual + 1) AS parcelas_restantes,
         ((total_parcelas - parcela_atual + 1) * valor_parcela) AS valor_restante
       FROM parcelamentos
       WHERE usuario_id=$1 AND parcela_atual <= total_parcelas
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

// ── EDITAR parcelamento ───────────────────────────────────────────
router.put('/:id', autenticar, async (req, res) => {
  const { descricao, valor_total, valor_parcela, total_parcelas, mes_inicio, ano_inicio, categoria } = req.body;
  if (!descricao || !valor_parcela || !total_parcelas || !mes_inicio || !ano_inicio) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  try {
    const result = await pool.query(
      `UPDATE parcelamentos
       SET descricao=$1, valor_total=$2, valor_parcela=$3, total_parcelas=$4,
           mes_inicio=$5, ano_inicio=$6, categoria=$7
       WHERE id=$8 AND usuario_id=$9
       RETURNING *`,
      [descricao, valor_total, valor_parcela, total_parcelas,
       mes_inicio, ano_inicio, categoria || 'outros',
       req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Não encontrado.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar parcelamento.' });
  }
});

// Avançar parcela
router.patch('/:id/avancar', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE parcelamentos SET parcela_atual = parcela_atual + 1
       WHERE id=$1 AND usuario_id=$2 AND parcela_atual < total_parcelas RETURNING *`,
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
      'DELETE FROM parcelamentos WHERE id=$1 AND usuario_id=$2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Parcelamento removido.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar.' });
  }
});

module.exports = router;

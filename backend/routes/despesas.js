const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// ?todos=1 → lista todas sem filtro de mês
// ?mes=&ano= → filtra por mês/ano (dashboard)
router.get('/', autenticar, async (req, res) => {
  const uid = req.usuario.id;
  try {
    let result;
    if (req.query.todos === '1') {
      result = await pool.query(
        `SELECT * FROM despesas WHERE usuario_id=$1 ORDER BY ano DESC, mes DESC, criado_em DESC`,
        [uid]
      );
    } else {
      const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
      const ano = parseInt(req.query.ano) || new Date().getFullYear();
      result = await pool.query(
        `SELECT * FROM despesas WHERE usuario_id=$1 AND mes=$2 AND ano=$3 ORDER BY criado_em DESC`,
        [uid, mes, ano]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar despesas.' });
  }
});

router.post('/', autenticar, async (req, res) => {
  const { descricao, valor, categoria, tipo, mes, ano } = req.body;
  if (!descricao || !valor || !categoria || !mes || !ano)
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  try {
    const result = await pool.query(
      `INSERT INTO despesas (usuario_id, descricao, valor, categoria, tipo, mes, ano)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.usuario.id, descricao, valor, categoria, tipo || 'fixo', mes, ano]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar despesa.' });
  }
});

router.put('/:id', autenticar, async (req, res) => {
  const { descricao, valor, categoria, tipo, mes, ano } = req.body;
  if (!descricao || !valor || !categoria || !mes || !ano)
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  try {
    const result = await pool.query(
      `UPDATE despesas SET descricao=$1, valor=$2, categoria=$3, tipo=$4, mes=$5, ano=$6
       WHERE id=$7 AND usuario_id=$8 RETURNING *`,
      [descricao, valor, categoria, tipo || 'fixo', mes, ano, req.params.id, req.usuario.id]
    );
    if (!result.rows.length) return res.status(404).json({ erro: 'Despesa não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar despesa.' });
  }
});

router.patch('/:id/pago', autenticar, async (req, res) => {
  const { pago } = req.body;
  try {
    const result = await pool.query(
      `UPDATE despesas SET pago=$1 WHERE id=$2 AND usuario_id=$3 RETURNING *`,
      [pago, req.params.id, req.usuario.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar.' });
  }
});

router.delete('/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM despesas WHERE id=$1 AND usuario_id=$2', [req.params.id, req.usuario.id]);
    res.json({ mensagem: 'Despesa removida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar.' });
  }
});

module.exports = router;

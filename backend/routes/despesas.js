const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// Listar despesas do mês
router.get('/', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const mesAtual = mes || new Date().getMonth() + 1;
  const anoAtual = ano || new Date().getFullYear();

  try {
    const result = await pool.query(
      'SELECT * FROM despesas WHERE usuario_id = $1 AND mes = $2 AND ano = $3 ORDER BY criado_em DESC',
      [req.usuario.id, mesAtual, anoAtual]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar despesas.' });
  }
});

// Adicionar despesa
router.post('/', autenticar, async (req, res) => {
  const { descricao, valor, categoria, tipo, mes, ano } = req.body;

  if (!descricao || !valor || !categoria || !mes || !ano) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO despesas (usuario_id, descricao, valor, categoria, tipo, mes, ano) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.usuario.id, descricao, valor, categoria, tipo || 'fixo', mes, ano]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar despesa.' });
  }
});

// Marcar como pago/não pago
router.patch('/:id/pago', autenticar, async (req, res) => {
  const { pago } = req.body;
  try {
    const result = await pool.query(
      'UPDATE despesas SET pago = $1 WHERE id = $2 AND usuario_id = $3 RETURNING *',
      [pago, req.params.id, req.usuario.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar.' });
  }
});

// Deletar despesa
router.delete('/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM despesas WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Despesa removida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar.' });
  }
});

// Resumo por categoria do mês
router.get('/por-categoria', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const mesAtual = mes || new Date().getMonth() + 1;
  const anoAtual = ano || new Date().getFullYear();

  try {
    const result = await pool.query(
      `SELECT categoria, SUM(valor) as total FROM despesas 
       WHERE usuario_id = $1 AND mes = $2 AND ano = $3 GROUP BY categoria ORDER BY total DESC`,
      [req.usuario.id, mesAtual, anoAtual]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar resumo.' });
  }
});

// Resumo mensal anual
router.get('/resumo-anual', autenticar, async (req, res) => {
  const { ano } = req.query;
  const anoAtual = ano || new Date().getFullYear();
  try {
    const result = await pool.query(
      `SELECT mes, SUM(valor) as total FROM despesas 
       WHERE usuario_id = $1 AND ano = $2 GROUP BY mes ORDER BY mes`,
      [req.usuario.id, anoAtual]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar resumo.' });
  }
});

module.exports = router;

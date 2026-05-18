const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// ── Receitas normais (fixo / unico) ──────────────────────────────

// Listar receitas do mês
router.get('/', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const mesAtual = mes || new Date().getMonth() + 1;
  const anoAtual = ano || new Date().getFullYear();
  try {
    const result = await pool.query(
      `SELECT * FROM receitas
       WHERE usuario_id = $1 AND mes = $2 AND ano = $3
       ORDER BY criado_em DESC`,
      [req.usuario.id, mesAtual, anoAtual]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar receitas.' });
  }
});

// Adicionar receita (tipo: 'fixo' | 'unico')
router.post('/', autenticar, async (req, res) => {
  const { descricao, valor, categoria, tipo, mes, ano } = req.body;
  if (!descricao || !valor || !categoria || !mes || !ano) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  const tipoFinal = ['fixo','unico'].includes(tipo) ? tipo : 'unico';
  try {
    const result = await pool.query(
      `INSERT INTO receitas (usuario_id, descricao, valor, categoria, tipo, mes, ano)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.usuario.id, descricao, valor, categoria, tipoFinal, mes, ano]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar receita.' });
  }
});

// Deletar receita
router.delete('/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM receitas WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Receita removida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar receita.' });
  }
});

// Resumo anual de receitas
router.get('/resumo-anual', autenticar, async (req, res) => {
  const { ano } = req.query;
  const anoAtual = ano || new Date().getFullYear();
  try {
    const result = await pool.query(
      `SELECT mes, SUM(valor) as total FROM receitas
       WHERE usuario_id = $1 AND ano = $2 GROUP BY mes ORDER BY mes`,
      [req.usuario.id, anoAtual]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar resumo.' });
  }
});

// ── Receitas Parceladas ───────────────────────────────────────────

// Listar receitas parceladas ativas
router.get('/parceladas', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *,
        (total_parcelas - parcela_atual + 1) as parcelas_restantes,
        ((total_parcelas - parcela_atual + 1) * valor_parcela) as valor_restante
       FROM receitas_parceladas
       WHERE usuario_id = $1 AND parcela_atual <= total_parcelas
       ORDER BY criado_em DESC`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar receitas parceladas.' });
  }
});

// Criar receita parcelada
router.post('/parceladas', autenticar, async (req, res) => {
  const { descricao, valor_total, valor_parcela, total_parcelas, mes_inicio, ano_inicio, categoria } = req.body;
  if (!descricao || !valor_total || !valor_parcela || !total_parcelas || !mes_inicio || !ano_inicio) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO receitas_parceladas
       (usuario_id, descricao, valor_total, valor_parcela, total_parcelas, parcela_atual, mes_inicio, ano_inicio, categoria)
       VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8) RETURNING *`,
      [req.usuario.id, descricao, valor_total, valor_parcela, total_parcelas, mes_inicio, ano_inicio, categoria || 'outros']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar receita parcelada.' });
  }
});

// Avançar parcela de receita
router.patch('/parceladas/:id/avancar', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE receitas_parceladas SET parcela_atual = parcela_atual + 1
       WHERE id = $1 AND usuario_id = $2 AND parcela_atual < total_parcelas RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ erro: 'Já concluída ou não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao avançar parcela.' });
  }
});

// Deletar receita parcelada
router.delete('/parceladas/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM receitas_parceladas WHERE id = $1 AND usuario_id = $2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Removida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar.' });
  }
});

module.exports = router;

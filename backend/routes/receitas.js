const express = require('express');
const { pool } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// ── Receitas normais ──────────────────────────────────────────────

router.get('/', autenticar, async (req, res) => {
  const mesAtual = parseInt(req.query.mes) || new Date().getMonth() + 1;
  const anoAtual = parseInt(req.query.ano) || new Date().getFullYear();
  try {
    const result = await pool.query(
      `SELECT * FROM receitas
       WHERE usuario_id=$1 AND mes=$2 AND ano=$3
       ORDER BY criado_em DESC`,
      [req.usuario.id, mesAtual, anoAtual]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar receitas.' });
  }
});

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

// ── EDITAR receita ────────────────────────────────────────────────
router.put('/:id', autenticar, async (req, res) => {
  const { descricao, valor, categoria, tipo, mes, ano } = req.body;
  if (!descricao || !valor || !categoria || !mes || !ano) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  const tipoFinal = ['fixo','unico'].includes(tipo) ? tipo : 'unico';
  try {
    const result = await pool.query(
      `UPDATE receitas
       SET descricao=$1, valor=$2, categoria=$3, tipo=$4, mes=$5, ano=$6
       WHERE id=$7 AND usuario_id=$8
       RETURNING *`,
      [descricao, valor, categoria, tipoFinal, mes, ano, req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Receita não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar receita.' });
  }
});

router.delete('/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM receitas WHERE id=$1 AND usuario_id=$2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Receita removida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar receita.' });
  }
});

// ── Receitas parceladas ───────────────────────────────────────────

router.get('/parceladas', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *,
         (total_parcelas - parcela_atual + 1) AS parcelas_restantes,
         ((total_parcelas - parcela_atual + 1) * valor_parcela) AS valor_restante
       FROM receitas_parceladas
       WHERE usuario_id=$1 AND parcela_atual <= total_parcelas
       ORDER BY criado_em DESC`,
      [req.usuario.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar receitas parceladas.' });
  }
});

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

// ── EDITAR receita parcelada ──────────────────────────────────────
router.put('/parceladas/:id', autenticar, async (req, res) => {
  const { descricao, valor_total, valor_parcela, total_parcelas, mes_inicio, ano_inicio, categoria } = req.body;
  if (!descricao || !valor_parcela || !total_parcelas || !mes_inicio || !ano_inicio) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  try {
    const result = await pool.query(
      `UPDATE receitas_parceladas
       SET descricao=$1, valor_total=$2, valor_parcela=$3, total_parcelas=$4,
           mes_inicio=$5, ano_inicio=$6, categoria=$7
       WHERE id=$8 AND usuario_id=$9
       RETURNING *`,
      [descricao, valor_total, valor_parcela, total_parcelas,
       mes_inicio, ano_inicio, categoria || 'outros',
       req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ erro: 'Não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar.' });
  }
});

router.patch('/parceladas/:id/avancar', autenticar, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE receitas_parceladas SET parcela_atual = parcela_atual + 1
       WHERE id=$1 AND usuario_id=$2 AND parcela_atual < total_parcelas RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ erro: 'Já concluída ou não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao avançar parcela.' });
  }
});

router.delete('/parceladas/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM receitas_parceladas WHERE id=$1 AND usuario_id=$2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Removida.' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar.' });
  }
});

module.exports = router;

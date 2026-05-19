const express = require('express');
const { pool } = require('../db');
const { autenticarAdmin } = require('../middleware');
const router = express.Router();

// Todas as rotas exigem perfil='admin'

// ── GET /api/admin/usuarios — lista todos os usuários ─────────────
// Retorna apenas campos de gestão — NUNCA dados financeiros
router.get('/usuarios', autenticarAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        u.id, u.nome, u.email, u.perfil,
        u.licenca_ate, u.bloqueado, u.criado_em,
        -- Dias restantes de licença (NULL se sem licença)
        CASE
          WHEN u.licenca_ate IS NULL THEN NULL
          WHEN u.licenca_ate >= CURRENT_DATE THEN (u.licenca_ate - CURRENT_DATE)
          ELSE -1 * (CURRENT_DATE - u.licenca_ate)
        END AS dias_licenca,
        -- Situação da licença
        CASE
          WHEN u.perfil = 'admin'            THEN 'admin'
          WHEN u.bloqueado                   THEN 'bloqueado'
          WHEN u.licenca_ate IS NULL         THEN 'sem_licenca'
          WHEN u.licenca_ate < CURRENT_DATE  THEN 'expirada'
          WHEN u.licenca_ate - CURRENT_DATE <= 7 THEN 'expirando'
          ELSE 'ativa'
        END AS situacao
      FROM usuarios u
      ORDER BY u.criado_em DESC
    `);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
});

// ── PUT /api/admin/usuarios/:id/licenca ───────────────────────────
// Define a data de expiração da licença
// Body: { dias: 30 }  OU  { licenca_ate: "2025-12-31" }
router.put('/usuarios/:id/licenca', autenticarAdmin, async (req, res) => {
  const uid = parseInt(req.params.id);
  if (uid === req.usuario.id)
    return res.status(400).json({ erro: 'Você não pode alterar sua própria licença por aqui.' });

  let licenca_ate;
  if (req.body.dias !== undefined) {
    const dias = parseInt(req.body.dias);
    if (isNaN(dias) || dias < 1)
      return res.status(400).json({ erro: 'Número de dias inválido. Mínimo: 1.' });
    // Calcula a partir de HOJE (ou da data atual da licença, o que for maior)
    const base = new Date();
    base.setDate(base.getDate() + dias);
    licenca_ate = base.toISOString().split('T')[0]; // YYYY-MM-DD
  } else if (req.body.licenca_ate) {
    licenca_ate = req.body.licenca_ate;
  } else {
    return res.status(400).json({ erro: 'Informe "dias" ou "licenca_ate".' });
  }

  try {
    const r = await pool.query(
      `UPDATE usuarios SET licenca_ate=$1 WHERE id=$2 AND perfil != 'admin'
       RETURNING id, nome, email, perfil, licenca_ate, bloqueado`,
      [licenca_ate, uid]
    );
    if (!r.rows.length) return res.status(404).json({ erro: 'Usuário não encontrado ou é admin.' });
    res.json({ mensagem: 'Licença atualizada.', usuario: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar licença.' });
  }
});

// ── PUT /api/admin/usuarios/:id/bloquear ─────────────────────────
// Bloqueia ou desbloqueia um usuário
// Body: { bloqueado: true/false }
router.put('/usuarios/:id/bloquear', autenticarAdmin, async (req, res) => {
  const uid = parseInt(req.params.id);
  if (uid === req.usuario.id)
    return res.status(400).json({ erro: 'Você não pode bloquear a si mesmo.' });

  const { bloqueado } = req.body;
  if (typeof bloqueado !== 'boolean')
    return res.status(400).json({ erro: '"bloqueado" deve ser true ou false.' });

  try {
    const r = await pool.query(
      `UPDATE usuarios SET bloqueado=$1 WHERE id=$2 AND perfil != 'admin'
       RETURNING id, nome, email, perfil, licenca_ate, bloqueado`,
      [bloqueado, uid]
    );
    if (!r.rows.length) return res.status(404).json({ erro: 'Usuário não encontrado ou é admin.' });
    res.json({
      mensagem: bloqueado ? 'Usuário bloqueado.' : 'Usuário desbloqueado.',
      usuario: r.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao alterar bloqueio.' });
  }
});

// ── DELETE /api/admin/usuarios/:id ───────────────────────────────
// Remove um usuário e todos seus dados (CASCADE no banco)
router.delete('/usuarios/:id', autenticarAdmin, async (req, res) => {
  const uid = parseInt(req.params.id);
  if (uid === req.usuario.id)
    return res.status(400).json({ erro: 'Você não pode remover a si mesmo.' });

  try {
    const r = await pool.query(
      `DELETE FROM usuarios WHERE id=$1 AND perfil != 'admin' RETURNING id, nome`,
      [uid]
    );
    if (!r.rows.length) return res.status(404).json({ erro: 'Usuário não encontrado ou é admin.' });
    res.json({ mensagem: `Usuário "${r.rows[0].nome}" removido.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao remover usuário.' });
  }
});

// ── GET /api/admin/stats ──────────────────────────────────────────
// Estatísticas gerais do sistema
router.get('/stats', autenticarAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)                                                       AS total,
        COUNT(*) FILTER (WHERE perfil='user')                         AS users,
        COUNT(*) FILTER (WHERE bloqueado)                             AS bloqueados,
        COUNT(*) FILTER (WHERE licenca_ate IS NULL AND perfil='user') AS sem_licenca,
        COUNT(*) FILTER (WHERE licenca_ate < CURRENT_DATE AND NOT bloqueado AND perfil='user') AS expiradas,
        COUNT(*) FILTER (WHERE licenca_ate >= CURRENT_DATE AND NOT bloqueado AND perfil='user') AS ativas
      FROM usuarios
    `);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar estatísticas.' });
  }
});

module.exports = router;

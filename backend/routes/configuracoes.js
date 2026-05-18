const express = require('express');
const { pool, CAT_RECEITAS_DEFAULT, CAT_DESPESAS_DEFAULT, TIPOS_DESPESAS_DEFAULT } = require('../db');
const { autenticar } = require('../middleware');
const router = express.Router();

// ── Helper: garante seed para o usuário se não tiver ─────────────
async function garantirSeed(uid, client) {
  const cntRec = await client.query(
    'SELECT COUNT(*) FROM categorias_receitas WHERE usuario_id=$1', [uid]
  );
  if (parseInt(cntRec.rows[0].count) === 0) {
    for (const nome of CAT_RECEITAS_DEFAULT) {
      await client.query(
        'INSERT INTO categorias_receitas (usuario_id, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [uid, nome]
      );
    }
  }
  const cntDesp = await client.query(
    'SELECT COUNT(*) FROM categorias_despesas WHERE usuario_id=$1', [uid]
  );
  if (parseInt(cntDesp.rows[0].count) === 0) {
    for (const nome of CAT_DESPESAS_DEFAULT) {
      await client.query(
        'INSERT INTO categorias_despesas (usuario_id, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [uid, nome]
      );
    }
  }
  const cntTipo = await client.query(
    'SELECT COUNT(*) FROM tipos_despesas WHERE usuario_id=$1', [uid]
  );
  if (parseInt(cntTipo.rows[0].count) === 0) {
    for (const t of TIPOS_DESPESAS_DEFAULT) {
      await client.query(
        'INSERT INTO tipos_despesas (usuario_id, nome, codigo) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [uid, t.nome, t.codigo]
      );
    }
  }
}

// ── GET /api/configuracoes/tudo ───────────────────────────────────
// Retorna categorias de receitas, despesas e tipos em uma só chamada
router.get('/tudo', autenticar, async (req, res) => {
  const uid    = req.usuario.id;
  const client = await pool.connect();
  try {
    await garantirSeed(uid, client);
    const [cr, cd, td, bl] = await Promise.all([
      client.query('SELECT * FROM categorias_receitas WHERE usuario_id=$1 AND ativa=true ORDER BY nome', [uid]),
      client.query('SELECT * FROM categorias_despesas WHERE usuario_id=$1 AND ativa=true ORDER BY nome', [uid]),
      client.query('SELECT * FROM tipos_despesas WHERE usuario_id=$1 AND ativo=true ORDER BY nome', [uid]),
      client.query(
        `SELECT realizado_em, status, detalhes
         FROM backup_log WHERE usuario_id=$1
         ORDER BY realizado_em DESC LIMIT 1`,
        [uid]
      )
    ]);
    res.json({
      categorias_receitas: cr.rows,
      categorias_despesas: cd.rows,
      tipos_despesas:      td.rows,
      ultimo_backup:       bl.rows[0] || null
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar configurações.' });
  } finally {
    client.release();
  }
});

// ═══ CATEGORIAS DE RECEITAS ════════════════════════════════════════

router.get('/categorias-receitas', autenticar, async (req, res) => {
  const client = await pool.connect();
  try {
    await garantirSeed(req.usuario.id, client);
    const r = await client.query(
      'SELECT * FROM categorias_receitas WHERE usuario_id=$1 AND ativa=true ORDER BY nome',
      [req.usuario.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro.' }); }
  finally { client.release(); }
});

router.post('/categorias-receitas', autenticar, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatório.' });
  try {
    const r = await pool.query(
      'INSERT INTO categorias_receitas (usuario_id, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *',
      [req.usuario.id, nome.trim()]
    );
    if (!r.rows.length) return res.status(409).json({ erro: 'Categoria já existe.' });
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao criar.' }); }
});

router.put('/categorias-receitas/:id', autenticar, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatório.' });
  try {
    const r = await pool.query(
      'UPDATE categorias_receitas SET nome=$1 WHERE id=$2 AND usuario_id=$3 RETURNING *',
      [nome.trim(), req.params.id, req.usuario.id]
    );
    if (!r.rows.length) return res.status(404).json({ erro: 'Não encontrada.' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao editar.' }); }
});

router.delete('/categorias-receitas/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'UPDATE categorias_receitas SET ativa=false WHERE id=$1 AND usuario_id=$2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Removida.' });
  } catch (err) { res.status(500).json({ erro: 'Erro ao remover.' }); }
});

// ═══ CATEGORIAS DE DESPESAS ════════════════════════════════════════

router.get('/categorias-despesas', autenticar, async (req, res) => {
  const client = await pool.connect();
  try {
    await garantirSeed(req.usuario.id, client);
    const r = await client.query(
      'SELECT * FROM categorias_despesas WHERE usuario_id=$1 AND ativa=true ORDER BY nome',
      [req.usuario.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro.' }); }
  finally { client.release(); }
});

router.post('/categorias-despesas', autenticar, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatório.' });
  try {
    const r = await pool.query(
      'INSERT INTO categorias_despesas (usuario_id, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *',
      [req.usuario.id, nome.trim()]
    );
    if (!r.rows.length) return res.status(409).json({ erro: 'Categoria já existe.' });
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao criar.' }); }
});

router.put('/categorias-despesas/:id', autenticar, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatório.' });
  try {
    const r = await pool.query(
      'UPDATE categorias_despesas SET nome=$1 WHERE id=$2 AND usuario_id=$3 RETURNING *',
      [nome.trim(), req.params.id, req.usuario.id]
    );
    if (!r.rows.length) return res.status(404).json({ erro: 'Não encontrada.' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao editar.' }); }
});

router.delete('/categorias-despesas/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'UPDATE categorias_despesas SET ativa=false WHERE id=$1 AND usuario_id=$2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Removida.' });
  } catch (err) { res.status(500).json({ erro: 'Erro ao remover.' }); }
});

// ═══ TIPOS DE DESPESAS ════════════════════════════════════════════

router.get('/tipos-despesas', autenticar, async (req, res) => {
  const client = await pool.connect();
  try {
    await garantirSeed(req.usuario.id, client);
    const r = await client.query(
      'SELECT * FROM tipos_despesas WHERE usuario_id=$1 AND ativo=true ORDER BY nome',
      [req.usuario.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro.' }); }
  finally { client.release(); }
});

router.post('/tipos-despesas', autenticar, async (req, res) => {
  const { nome, codigo } = req.body;
  if (!nome?.trim() || !codigo?.trim()) return res.status(400).json({ erro: 'Nome e código obrigatórios.' });
  try {
    const r = await pool.query(
      'INSERT INTO tipos_despesas (usuario_id, nome, codigo) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *',
      [req.usuario.id, nome.trim(), codigo.trim().toLowerCase()]
    );
    if (!r.rows.length) return res.status(409).json({ erro: 'Tipo já existe.' });
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao criar.' }); }
});

router.put('/tipos-despesas/:id', autenticar, async (req, res) => {
  const { nome } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatório.' });
  try {
    const r = await pool.query(
      'UPDATE tipos_despesas SET nome=$1 WHERE id=$2 AND usuario_id=$3 RETURNING *',
      [nome.trim(), req.params.id, req.usuario.id]
    );
    if (!r.rows.length) return res.status(404).json({ erro: 'Não encontrado.' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao editar.' }); }
});

router.delete('/tipos-despesas/:id', autenticar, async (req, res) => {
  try {
    await pool.query(
      'UPDATE tipos_despesas SET ativo=false WHERE id=$1 AND usuario_id=$2',
      [req.params.id, req.usuario.id]
    );
    res.json({ mensagem: 'Removido.' });
  } catch (err) { res.status(500).json({ erro: 'Erro ao remover.' }); }
});

// ── Último backup ─────────────────────────────────────────────────
router.get('/backup-status', autenticar, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT realizado_em, status, detalhes
       FROM backup_log WHERE usuario_id=$1
       ORDER BY realizado_em DESC LIMIT 5`,
      [req.usuario.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro ao buscar status.' }); }
});

module.exports = router;

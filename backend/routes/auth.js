const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool, CAT_RECEITAS_DEFAULT, CAT_DESPESAS_DEFAULT, TIPOS_DESPESAS_DEFAULT } = require('../db');
const { autenticar } = require('../middleware');
const router  = express.Router();

// Helper: gera token com dados do usuário
function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, foto_url: usuario.foto_url },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── Cadastrar ─────────────────────────────────────────────────────
router.post('/cadastrar', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  if (senha.length < 6)
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });

  const client = await pool.connect();
  try {
    const existe = await client.query('SELECT id FROM usuarios WHERE email=$1', [email]);
    if (existe.rows.length > 0)
      return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });

    const hash   = await bcrypt.hash(senha, 10);
    const result = await client.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1,$2,$3) RETURNING id, nome, email, foto_url',
      [nome, email, hash]
    );
    const usuario = result.rows[0];
    const uid     = usuario.id;

    for (const n of CAT_RECEITAS_DEFAULT)
      await client.query('INSERT INTO categorias_receitas(usuario_id,nome) VALUES($1,$2) ON CONFLICT DO NOTHING', [uid, n]);
    for (const n of CAT_DESPESAS_DEFAULT)
      await client.query('INSERT INTO categorias_despesas(usuario_id,nome) VALUES($1,$2) ON CONFLICT DO NOTHING', [uid, n]);
    for (const t of TIPOS_DESPESAS_DEFAULT)
      await client.query('INSERT INTO tipos_despesas(usuario_id,nome,codigo) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [uid, t.nome, t.codigo]);

    const token = gerarToken(usuario);
    res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso!',
      token,
      usuario: { id: uid, nome: usuario.nome, email: usuario.email, foto_url: usuario.foto_url }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno ao cadastrar.' });
  } finally { client.release(); }
});

// ── Login ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: 'Preencha e-mail e senha.' });
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);
    if (!result.rows.length)
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    const usuario      = result.rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta)
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    const token = gerarToken(usuario);
    res.json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, foto_url: usuario.foto_url }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno ao fazer login.' });
  }
});

// ── GET /api/auth/perfil ──────────────────────────────────────────
router.get('/perfil', autenticar, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, nome, email, foto_url, criado_em FROM usuarios WHERE id=$1',
      [req.usuario.id]
    );
    if (!r.rows.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar perfil.' });
  }
});

// ── PUT /api/auth/perfil ──────────────────────────────────────────
router.put('/perfil', autenticar, async (req, res) => {
  const { nome, foto_url, senha_atual, nova_senha } = req.body;
  const uid = req.usuario.id;
  if (!nome?.trim())
    return res.status(400).json({ erro: 'Nome é obrigatório.' });

  const client = await pool.connect();
  try {
    const userRes = await client.query('SELECT * FROM usuarios WHERE id=$1', [uid]);
    if (!userRes.rows.length)
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const usuario = userRes.rows[0];

    let novaSenhaHash = null;
    if (nova_senha) {
      if (!senha_atual) return res.status(400).json({ erro: 'Informe a senha atual para trocar.' });
      const ok = await bcrypt.compare(senha_atual, usuario.senha);
      if (!ok) return res.status(400).json({ erro: 'Senha atual incorreta.' });
      if (nova_senha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
      novaSenhaHash = await bcrypt.hash(nova_senha, 10);
    }

    let sql, params;
    if (novaSenhaHash) {
      sql    = 'UPDATE usuarios SET nome=$1, foto_url=$2, senha=$3 WHERE id=$4 RETURNING id, nome, email, foto_url';
      params = [nome.trim(), foto_url || null, novaSenhaHash, uid];
    } else {
      sql    = 'UPDATE usuarios SET nome=$1, foto_url=$2 WHERE id=$3 RETURNING id, nome, email, foto_url';
      params = [nome.trim(), foto_url || null, uid];
    }

    const upd        = await client.query(sql, params);
    const atualizado = upd.rows[0];
    const token      = gerarToken(atualizado);
    res.json({ mensagem: 'Perfil atualizado com sucesso!', token, usuario: atualizado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  } finally { client.release(); }
});

// ── POST /api/auth/upload-foto ────────────────────────────────────
// Recebe a imagem como base64 em JSON (funciona no Render e qualquer host,
// pois não depende de filesystem persistente).
// Body: { foto_base64: "data:image/jpeg;base64,..." }
router.post('/upload-foto', autenticar, async (req, res) => {
  const { foto_base64 } = req.body;
  if (!foto_base64) return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });

  // Valida formato básico
  if (!foto_base64.startsWith('data:image/')) {
    return res.status(400).json({ erro: 'Formato inválido. Envie uma imagem.' });
  }

  // Valida tamanho aproximado (~1.5x o tamanho real em base64)
  const tamanhoKB = Math.round(foto_base64.length * 0.75 / 1024);
  if (tamanhoKB > 800) {
    return res.status(400).json({ erro: 'Imagem muito grande. Máximo ~600 KB após compressão.' });
  }

  const uid = req.usuario.id;
  try {
    const upd = await pool.query(
      'UPDATE usuarios SET foto_url=$1 WHERE id=$2 RETURNING id, nome, email, foto_url',
      [foto_base64, uid]
    );
    if (!upd.rows.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const atualizado = upd.rows[0];
    const token      = gerarToken(atualizado);
    res.json({
      mensagem: 'Foto atualizada com sucesso!',
      foto_url: foto_base64,
      token,
      usuario:  atualizado
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar foto.' });
  }
});

module.exports = router;

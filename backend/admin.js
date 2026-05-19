const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool, CAT_RECEITAS_DEFAULT, CAT_DESPESAS_DEFAULT, TIPOS_DESPESAS_DEFAULT } = require('../db');
const { autenticar } = require('../middleware');
const router  = express.Router();

// Helper: gera token com todos os campos relevantes
function gerarToken(u) {
  return jwt.sign(
    {
      id:          u.id,
      nome:        u.nome,
      email:       u.email,
      foto_url:    u.foto_url,
      perfil:      u.perfil      || 'user',
      licenca_ate: u.licenca_ate || null,
      bloqueado:   u.bloqueado   || false
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function usuarioPublico(u) {
  return {
    id:          u.id,
    nome:        u.nome,
    email:       u.email,
    foto_url:    u.foto_url,
    perfil:      u.perfil      || 'user',
    licenca_ate: u.licenca_ate || null,
    bloqueado:   u.bloqueado   || false
  };
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
      `INSERT INTO usuarios (nome, email, senha)
       VALUES ($1,$2,$3)
       RETURNING id, nome, email, foto_url, perfil, licenca_ate, bloqueado`,
      [nome, email, hash]
    );
    const u   = result.rows[0];
    const uid = u.id;

    for (const n of CAT_RECEITAS_DEFAULT)
      await client.query('INSERT INTO categorias_receitas(usuario_id,nome) VALUES($1,$2) ON CONFLICT DO NOTHING', [uid, n]);
    for (const n of CAT_DESPESAS_DEFAULT)
      await client.query('INSERT INTO categorias_despesas(usuario_id,nome) VALUES($1,$2) ON CONFLICT DO NOTHING', [uid, n]);
    for (const t of TIPOS_DESPESAS_DEFAULT)
      await client.query('INSERT INTO tipos_despesas(usuario_id,nome,codigo) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [uid, t.nome, t.codigo]);

    res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso!',
      token:    gerarToken(u),
      usuario:  usuarioPublico(u)
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
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email=$1',
      [email]
    );
    if (!result.rows.length)
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

    const u = result.rows[0];
    if (!(await bcrypt.compare(senha, u.senha)))
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

    // Verifica bloqueio antes de emitir token
    if (u.bloqueado)
      return res.status(403).json({ erro: 'Conta bloqueada. Entre em contato com o administrador.', codigo: 'BLOQUEADO' });

    // Verifica licença (admin não tem restrição)
    if (u.perfil !== 'admin' && u.licenca_ate) {
      const expiracao = new Date(u.licenca_ate);
      expiracao.setHours(23, 59, 59, 999);
      if (new Date() > expiracao)
        return res.status(403).json({
          erro:        'Licença expirada. Entre em contato com o administrador.',
          codigo:      'LICENCA_EXPIRADA',
          licenca_ate: u.licenca_ate
        });
    }

    res.json({
      mensagem: 'Login realizado com sucesso!',
      token:    gerarToken(u),
      usuario:  usuarioPublico(u)
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
      'SELECT id, nome, email, foto_url, perfil, licenca_ate, bloqueado, criado_em FROM usuarios WHERE id=$1',
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
    if (!userRes.rows.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const u = userRes.rows[0];

    let novaSenhaHash = null;
    if (nova_senha) {
      if (!senha_atual) return res.status(400).json({ erro: 'Informe a senha atual para trocar.' });
      if (!(await bcrypt.compare(senha_atual, u.senha))) return res.status(400).json({ erro: 'Senha atual incorreta.' });
      if (nova_senha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres.' });
      novaSenhaHash = await bcrypt.hash(nova_senha, 10);
    }

    const sql    = novaSenhaHash
      ? 'UPDATE usuarios SET nome=$1,foto_url=$2,senha=$3 WHERE id=$4 RETURNING id,nome,email,foto_url,perfil,licenca_ate,bloqueado'
      : 'UPDATE usuarios SET nome=$1,foto_url=$2 WHERE id=$3 RETURNING id,nome,email,foto_url,perfil,licenca_ate,bloqueado';
    const params = novaSenhaHash
      ? [nome.trim(), foto_url || null, novaSenhaHash, uid]
      : [nome.trim(), foto_url || null, uid];

    const upd = await client.query(sql, params);
    const atualizado = upd.rows[0];
    res.json({ mensagem: 'Perfil atualizado!', token: gerarToken(atualizado), usuario: usuarioPublico(atualizado) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  } finally { client.release(); }
});

// ── POST /api/auth/upload-foto (base64) ──────────────────────────
router.post('/upload-foto', autenticar, async (req, res) => {
  const { foto_base64 } = req.body;
  if (!foto_base64) return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });
  if (!foto_base64.startsWith('data:image/'))
    return res.status(400).json({ erro: 'Formato inválido.' });
  if (foto_base64.length * 0.75 / 1024 > 800)
    return res.status(400).json({ erro: 'Imagem muito grande. Máximo ~600 KB após compressão.' });

  try {
    const upd = await pool.query(
      'UPDATE usuarios SET foto_url=$1 WHERE id=$2 RETURNING id,nome,email,foto_url,perfil,licenca_ate,bloqueado',
      [foto_base64, req.usuario.id]
    );
    const u = upd.rows[0];
    res.json({ mensagem: 'Foto atualizada!', foto_url: foto_base64, token: gerarToken(u), usuario: usuarioPublico(u) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar foto.' });
  }
});

module.exports = router;

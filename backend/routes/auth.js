const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool, CAT_RECEITAS_DEFAULT, CAT_DESPESAS_DEFAULT, TIPOS_DESPESAS_DEFAULT } = require('../db');
const router  = express.Router();

// ── Cadastrar novo usuário ────────────────────────────────────────
router.post('/cadastrar', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const client = await pool.connect();
  try {
    const existe = await client.query('SELECT id FROM usuarios WHERE email=$1', [email]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const result = await client.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1,$2,$3) RETURNING id, nome, email',
      [nome, email, senhaCriptografada]
    );
    const usuario = result.rows[0];
    const uid     = usuario.id;

    // ── Seed automático de categorias e tipos para o novo usuário
    for (const n of CAT_RECEITAS_DEFAULT) {
      await client.query(
        'INSERT INTO categorias_receitas (usuario_id, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [uid, n]
      );
    }
    for (const n of CAT_DESPESAS_DEFAULT) {
      await client.query(
        'INSERT INTO categorias_despesas (usuario_id, nome) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [uid, n]
      );
    }
    for (const t of TIPOS_DESPESAS_DEFAULT) {
      await client.query(
        'INSERT INTO tipos_despesas (usuario_id, nome, codigo) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [uid, t.nome, t.codigo]
      );
    }

    const token = jwt.sign(
      { id: uid, nome: usuario.nome, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ mensagem: 'Cadastro realizado com sucesso!', token, usuario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno ao cadastrar.' });
  } finally {
    client.release();
  }
});

// ── Login ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Preencha e-mail e senha.' });
  }
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email=$1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    const usuario     = result.rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno ao fazer login.' });
  }
});

module.exports = router;

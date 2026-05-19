const jwt    = require('jsonwebtoken');
const { pool } = require('./db');

// ── Middleware padrão: autentica + verifica bloqueio e licença ────
async function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido. Faça login.' });
  }

  // Verifica assinatura JWT
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ erro: 'Token inválido ou expirado. Faça login novamente.' });
  }

  // Consulta estado ATUAL no banco (garante que bloqueio/licença sejam checados mesmo com token válido)
  try {
    const r = await pool.query(
      'SELECT id, nome, email, foto_url, perfil, licenca_ate, bloqueado FROM usuarios WHERE id = $1',
      [payload.id]
    );

    if (!r.rows.length) {
      return res.status(401).json({ erro: 'Usuário não encontrado.' });
    }

    const u = r.rows[0];

    // Verifica bloqueio
    if (u.bloqueado) {
      return res.status(403).json({
        erro:   'Conta bloqueada. Entre em contato com o administrador.',
        codigo: 'BLOQUEADO'
      });
    }

    // Verifica licença — admin nunca é bloqueado por licença
    if (u.perfil !== 'admin' && u.licenca_ate) {
      const hoje      = new Date();
      const expiracao = new Date(u.licenca_ate);
      expiracao.setHours(23, 59, 59, 999);
      if (hoje > expiracao) {
        return res.status(403).json({
          erro:        'Licença expirada. Entre em contato com o administrador.',
          codigo:      'LICENCA_EXPIRADA',
          licenca_ate: u.licenca_ate
        });
      }
    }

    req.usuario = u;
    next();
  } catch (err) {
    console.error('Erro no middleware autenticar:', err.message);
    return res.status(500).json({ erro: 'Erro interno de autenticação.' });
  }
}

// ── Middleware admin: roda autenticar e depois checa perfil ───────
// Não usa callback — é uma função async que chama autenticar diretamente
async function autenticarAdmin(req, res, next) {
  // Injeta um next intermediário para capturar se autenticar passou
  let passou = false;
  const nextIntermediario = () => { passou = true; };

  await autenticar(req, res, nextIntermediario);

  // Se autenticar já respondeu (bloqueado, expirado, etc.), para aqui
  if (!passou) return;

  if (req.usuario && req.usuario.perfil === 'admin') {
    next();
  } else {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
  }
}

module.exports = { autenticar, autenticarAdmin };

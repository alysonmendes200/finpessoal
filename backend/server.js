const jwt  = require('jsonwebtoken');
const { pool } = require('./db');

// ── Middleware padrão: autentica + verifica bloqueio e licença ────
async function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token)
    return res.status(401).json({ erro: 'Token não fornecido. Faça login.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ erro: 'Token inválido ou expirado. Faça login novamente.' });
  }

  // Consulta estado atualizado do usuário no banco
  // (não confia apenas no token — o admin pode ter bloqueado após o login)
  try {
    const r = await pool.query(
      'SELECT id, nome, email, foto_url, perfil, licenca_ate, bloqueado FROM usuarios WHERE id=$1',
      [payload.id]
    );
    if (!r.rows.length)
      return res.status(401).json({ erro: 'Usuário não encontrado.' });

    const u = r.rows[0];

    // Verifica bloqueio
    if (u.bloqueado)
      return res.status(403).json({ erro: 'Conta bloqueada. Entre em contato com o administrador.', codigo: 'BLOQUEADO' });

    // Verifica licença (admin não tem restrição de licença)
    if (u.perfil !== 'admin' && u.licenca_ate) {
      const hoje       = new Date();
      const expiracao  = new Date(u.licenca_ate);
      expiracao.setHours(23, 59, 59, 999); // fim do dia
      if (hoje > expiracao)
        return res.status(403).json({
          erro:         'Licença expirada. Entre em contato com o administrador.',
          codigo:       'LICENCA_EXPIRADA',
          licenca_ate:  u.licenca_ate
        });
    }

    req.usuario = u;
    next();
  } catch (err) {
    console.error('Erro no middleware autenticar:', err);
    return res.status(500).json({ erro: 'Erro interno de autenticação.' });
  }
}

// ── Middleware admin: exige perfil='admin' ────────────────────────
async function autenticarAdmin(req, res, next) {
  // Roda o autenticar normal primeiro
  autenticar(req, res, () => {
    if (req.usuario?.perfil !== 'admin')
      return res.status(403).json({ erro: 'Acesso restrito ao administrador.' });
    next();
  });
}

module.exports = { autenticar, autenticarAdmin };
